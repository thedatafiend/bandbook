# Accounts Migration Plan

**Status:** Planning
**Created:** 2026-03-30
**Target Phase:** Phase 3 (per PRD roadmap)

---

## 1. Overview

BandBook currently uses a **lightweight member identity** system: members are identified by a nickname, email, and session token scoped to a single band. There are no persistent user accounts, no passwords, and no cross-band identity.

This plan describes migrating to a **proper accounts system** where a user has a single account that can belong to multiple bands, with role-based access control and email-based authentication.

---

## 2. Current State

### Identity Model (V1)
- **Member** = band-scoped identity record (nickname + email + session_token)
- A person in two bands has **two separate Member records** with no link between them
- Session recovery works by email + band passcode (no password)
- No email verification, no OAuth, no persistent cross-band identity
- Cookies: `bb_session` (session token) + `bb_band` (band ID)

### Database Tables Affected
| Table | Account-Relevant Columns |
|-------|--------------------------|
| `members` | `id`, `band_id`, `nickname`, `email`, `session_token` |
| `songs` | `created_by_member_id` FK |
| `versions` | `created_by_member_id` FK |
| `lyric_sections` | `updated_by_member_id` FK |
| `lyric_revisions` | `created_by_member_id` FK |

### Key Constraints
- `members.session_token` is UNIQUE (used for auth)
- `members.email` has a non-unique index (used for recovery)
- All `*_member_id` FKs reference `members(id)` directly
- Band-scoping is enforced via `band_id` on members and data tables

---

## 3. Target State

### New Identity Model
```
Account (1) ──< Membership (many) >── Band (1)
   │
   └── email, password_hash, display_name, verified, created_at
```

- **Account**: A persistent user identity with email-based auth
- **Membership**: A join table linking accounts to bands with a role and band-specific nickname
- **Member** table: Retained as `memberships` (renamed), but now FK'd to `accounts` instead of being standalone

### New Tables

#### `accounts`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `email` | `text` UNIQUE NOT NULL | Login identity; lowercase, trimmed |
| `password_hash` | `text` | bcrypt; nullable during migration grace period |
| `display_name` | `text` NOT NULL | Default display name across bands |
| `email_verified` | `boolean` DEFAULT false | For future email verification |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

#### `memberships` (evolved from `members`)
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | Same as current `members.id` (preserves FKs) |
| `account_id` | `uuid` FK → accounts | NEW: links to account |
| `band_id` | `uuid` FK → bands | Same as current |
| `nickname` | `text` NOT NULL | Band-specific display name |
| `role` | `membership_role` ENUM | `'admin'`, `'member'`, `'viewer'` |
| `created_at` | `timestamptz` | |
| `last_active_at` | `timestamptz` | |

#### Dropped Columns (from current `members`)
- `email` → moved to `accounts`
- `session_token` → replaced by account-level session management

### Session Model
- Replace per-member session tokens with account-level sessions
- New cookie: `bb_account_session` (replaces `bb_session`)
- Keep `bb_band` cookie for active band context
- Support switching between bands without re-authentication

---

## 4. Migration Strategy

### Phase A: Prepare (Non-Breaking)

**Goal:** Add the accounts infrastructure alongside existing members, with zero user-facing changes.

1. **Create `accounts` table** with email + password_hash (nullable)
2. **Create `account_sessions` table** for new session management
3. **Add `account_id` column** to `members` table (nullable FK → accounts)
4. **Backfill accounts** from existing members:
   - Group members by lowercase email
   - For each unique email, create one `accounts` row
   - Set `members.account_id` to the corresponding account
   - Use existing member nickname as `accounts.display_name` (pick the most recently active member if multiple)
5. **Add `role` column** to members with default `'member'`; set band creators to `'admin'`

**Migration SQL sketch:**
```sql
-- New account table
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text,  -- nullable during migration
  display_name text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX accounts_email_idx ON accounts (lower(email));

-- New role enum
CREATE TYPE membership_role AS ENUM ('admin', 'member', 'viewer');

-- Evolve members table
ALTER TABLE members ADD COLUMN account_id uuid REFERENCES accounts(id);
ALTER TABLE members ADD COLUMN role membership_role NOT NULL DEFAULT 'member';

-- Backfill: create accounts from unique emails
INSERT INTO accounts (email, display_name)
SELECT DISTINCT ON (lower(email)) lower(email), nickname
FROM members
ORDER BY lower(email), last_active_at DESC;

-- Link members to accounts
UPDATE members SET account_id = accounts.id
FROM accounts
WHERE lower(members.email) = lower(accounts.email);

-- Make account_id NOT NULL after backfill
ALTER TABLE members ALTER COLUMN account_id SET NOT NULL;
```

### Phase B: Dual Auth (Backward-Compatible)

**Goal:** Support both old session tokens and new account-based auth simultaneously.

1. **Add account-level session table:**
   ```sql
   CREATE TABLE account_sessions (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     session_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
     expires_at timestamptz NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   );
   ```
2. **Update `getAuthContext()`** to check both auth paths:
   - First try new `bb_account_session` cookie → look up account → resolve membership for active band
   - Fall back to old `bb_session` cookie → existing member lookup
3. **Add login/signup API routes** (`/api/auth/login`, `/api/auth/signup`)
4. **Add password-set flow** for existing members who don't have a password yet
5. **Add band-switching API** (`/api/auth/switch-band`) that updates `bb_band` cookie without re-auth

### Phase C: UI Migration

**Goal:** Update all user-facing flows to use accounts.

1. **New landing page flows:**
   - Sign up (email + password + display name)
   - Log in (email + password)
   - Create band (logged-in user creates a band, becomes admin)
   - Join band (logged-in user joins via invite link)
2. **Settings page:**
   - Account settings (email, password, display name) — separate from band settings
   - Band switcher in nav/sidebar
3. **Update member references in UI:**
   - Show band-specific nickname where relevant (lyrics, versions)
   - Show account display name in account-level contexts
4. **Migrate session recovery flow:**
   - Replace email+passcode recovery with standard "forgot password" flow
   - Keep passcode for band-level access gating (join only)
5. **Deprecate old join flow:**
   - Invite link now requires login/signup first, then joins the band

### Phase D: Cleanup

**Goal:** Remove legacy auth, rename tables, tighten constraints.

1. **Rename `members` → `memberships`** (with backward-compat view if needed)
2. **Drop deprecated columns:** `members.email`, `members.session_token`
3. **Update all TypeScript types** (Member → Membership, add Account type)
4. **Update RLS policies** to use account-level auth
5. **Remove old session cookie logic** (`bb_session`)
6. **Run final data integrity checks**

---

## 5. API Route Changes

| Current Route | Change | Notes |
|---------------|--------|-------|
| `POST /api/bands/create` | Requires logged-in account | Creator gets `admin` role |
| `POST /api/bands/join` | Requires logged-in account | Passcode still required; creates membership |
| `GET /api/auth/me` | Returns account + active membership | Band context from `bb_band` cookie |
| `POST /api/auth/recover/*` | Replaced by login + forgot-password | Remove after Phase D |
| **NEW** `POST /api/auth/signup` | Create account | Email + password + display name |
| **NEW** `POST /api/auth/login` | Log in | Email + password → session |
| **NEW** `POST /api/auth/logout` | Log out | Clear session |
| **NEW** `POST /api/auth/switch-band` | Switch active band | Updates `bb_band` cookie |
| **NEW** `GET /api/auth/bands` | List user's bands | Returns all memberships |
| **NEW** `PUT /api/auth/account` | Update account settings | Email, password, display name |

---

## 6. TypeScript Type Changes

```typescript
// NEW
export interface Account {
  id: string;
  email: string;
  display_name: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

// EVOLVED (from Member)
export interface Membership {
  id: string;
  account_id: string;
  band_id: string;
  nickname: string;
  role: 'admin' | 'member' | 'viewer';
  created_at: string;
  last_active_at: string;
}

// UPDATED
export interface AuthContext {
  account: Account;
  membership: Membership;
  band: Band;
}
```

---

## 7. Role-Based Access Control

| Action | Admin | Member | Viewer |
|--------|-------|--------|--------|
| View songs, lyrics, versions | Yes | Yes | Yes |
| Create/edit songs | Yes | Yes | No |
| Upload audio versions | Yes | Yes | No |
| Edit lyrics | Yes | Yes | No |
| Delete versions | Yes | Yes (own) | No |
| Change band settings | Yes | No | No |
| Manage members/roles | Yes | No | No |
| Regenerate invite link | Yes | No | No |
| Change band passcode | Yes | No | No |
| Delete band | Yes | No | No |

---

## 8. Data Migration Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Duplicate emails across bands point to different people | During backfill, create one account per unique email. If contested, the account holder can change email on one membership. |
| Members with no email (shouldn't exist, but defensive) | Migration script skips these; flag for manual review |
| Existing session tokens stop working | Phase B maintains dual auth; old tokens work until Phase D cutover |
| FK references to `members.id` break on rename | `memberships` table keeps same `id` values; rename is transparent to FKs |
| Password-less accounts after migration | Grace period: accounts without passwords use "set password" flow on next login. Old session tokens continue to work. |
| Band creator unknown (for admin role assignment) | Heuristic: earliest `created_at` member in each band gets admin role |

---

## 9. Testing Requirements

Each phase must include:

- **Unit tests** for new auth functions (account creation, login, session validation, role checks)
- **Integration tests** for API routes (signup, login, switch-band, dual-auth fallback)
- **Migration tests** verifying:
  - Account backfill correctness (email dedup, display name selection)
  - FK integrity after `account_id` addition
  - Dual-auth works for both old and new sessions
  - Role assignment accuracy
- **E2E smoke tests** for critical flows:
  - Existing user can still access their band after migration
  - New user can sign up, create band, invite member
  - Band switching works without re-login

---

## 10. Rollback Plan

- **Phase A:** Drop `account_id` column, drop `accounts` table, drop `role` column
- **Phase B:** Remove new auth routes, revert `getAuthContext()` to original
- **Phase C:** Revert UI to old flows (git revert)
- **Phase D:** Not easily reversible — this is the point of no return. Only execute after thorough Phase B+C validation.

---

## 11. Open Questions

1. **OAuth providers?** Should we support Google/GitHub login in addition to email+password? (Recommendation: defer to post-migration enhancement)
2. **Email verification?** Required for password reset. Should we enforce on signup or allow a grace period? (Recommendation: optional at signup, required for password reset)
3. **Multi-band session UX?** Sidebar band switcher vs. separate dashboard? (Recommendation: nav-level band switcher)
4. **Viewer role use case?** Is read-only access needed for V1 of accounts, or can we ship with just admin+member? (Recommendation: ship admin+member first, add viewer later)
5. **Migration timeline?** How long is the dual-auth grace period before Phase D cleanup? (Recommendation: 90 days)
