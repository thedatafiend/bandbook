# Accounts Migration Plan

**Status:** In Progress (Clerk Integration)
**Created:** 2026-03-30
**Updated:** 2026-04-14
**Target Phase:** Phase 3 (per PRD roadmap)

---

## 1. Overview

BandBook currently uses a **lightweight member identity** system: members are identified by a nickname, email, and session token scoped to a single band. There are no persistent user accounts, no passwords, and no cross-band identity.

This plan describes migrating to a **proper accounts system** using **Clerk** as the managed authentication provider. Clerk handles user accounts, sessions, passwords, email verification, and OAuth — allowing us to focus on band-specific features like memberships, roles, and band switching.

### Why Clerk?

After evaluating a fully custom accounts migration against Clerk, we chose Clerk because:

1. **~50-60% less migration work** — Clerk eliminates the `accounts` table, `account_sessions` table, login/signup/logout routes, password hashing, email verification, and session cookie management.
2. **Stronger security posture** — Auth is Clerk's core business. No custom session token implementation to audit.
3. **Free tier is sufficient** — BandBook is a niche app; 10,000 MAU free tier is unlikely to be exceeded.
4. **OAuth and MFA come free** — Previously deferred as "post-migration enhancements," now available day one.
5. **Reduced ongoing maintenance** — No custom auth code to patch, update, or debug.

### What Clerk does NOT replace

- **Memberships table** (band-scoped identity with roles and nicknames)
- **RBAC enforcement** in API routes
- **Band context** (`bb_band` cookie, band switching)
- **Band passcode** join flow
- **FK migration** (`*_member_id` columns)

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
Clerk User (1) ──< Membership (many) >── Band (1)
   │
   └── email, password, display_name (managed by Clerk)
```

- **Clerk User**: A persistent user identity managed entirely by Clerk (email, password, OAuth, sessions)
- **Membership**: A join table linking Clerk users to bands with a role and band-specific nickname
- **Member** table: Evolved into `memberships`, with `clerk_user_id` replacing `session_token` + `email`

### Evolved Tables

#### `memberships` (evolved from `members`)
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | Same as current `members.id` (preserves FKs) |
| `clerk_user_id` | `text` NOT NULL | Clerk user ID (e.g., `user_2abc...`) |
| `band_id` | `uuid` FK → bands | Same as current |
| `nickname` | `text` NOT NULL | Band-specific display name |
| `role` | `membership_role` ENUM | `'admin'`, `'member'`, `'viewer'` |
| `created_at` | `timestamptz` | |
| `last_active_at` | `timestamptz` | |

#### Dropped Columns (from current `members`)
- `email` → managed by Clerk
- `session_token` → replaced by Clerk session management

### Session Model
- Clerk manages all sessions via `__session` JWT cookie
- Keep `bb_band` cookie for active band context
- Support switching between bands without re-authentication

---

## 4. Migration Strategy (Clerk)

### Phase 1: Auth Infrastructure (replaces old Phases A+B)

**Goal:** Replace custom session auth with Clerk, add membership evolution.

1. **Install `@clerk/nextjs`** and configure `ClerkProvider` in layout
2. **Add `clerk_user_id` column** to `members` table (nullable during migration)
3. **Add `role` column** to members with default `'member'`
4. **Rewrite `getAuthContext()`** to use Clerk `auth()` + membership lookup
5. **Rewrite `proxy.ts`** to use Clerk session status for route protection
6. **Update band create/join routes** to require Clerk authentication
7. **Remove legacy auth**: recover routes, session token management, `bb_session` cookie
8. **Add Clerk sign-in/sign-up pages** at `/sign-in` and `/sign-up`

**Migration SQL:**
```sql
-- New role enum
CREATE TYPE membership_role AS ENUM ('admin', 'member', 'viewer');

-- Evolve members table
ALTER TABLE members ADD COLUMN clerk_user_id text;
ALTER TABLE members ADD COLUMN role membership_role NOT NULL DEFAULT 'member';

CREATE INDEX members_clerk_user_id_idx ON members (clerk_user_id);
```

### Phase 2: UI + RBAC (maps to old Phase C)

1. **Band switcher** in nav/sidebar
2. **RBAC enforcement** in API routes
3. **Account settings** via Clerk `<UserButton>` / `<UserProfile>`
4. **Update member references in UI** to show band-specific nicknames

### Phase 3: Cleanup (maps to old Phase D)

1. **Rename `members` → `memberships`** (with backward-compat view if needed)
2. **Drop deprecated columns:** `email`, `session_token`
3. **Make `clerk_user_id` NOT NULL** after backfill
4. **Update all TypeScript types** (Member → Membership)
5. **Run final data integrity checks**

---

## 5. API Route Changes

| Current Route | Change | Notes |
|---------------|--------|-------|
| `POST /api/bands/create` | Requires Clerk auth | Creator gets `admin` role |
| `POST /api/bands/join` | Requires Clerk auth | Passcode still required; creates membership |
| `GET /api/auth/me` | Returns Clerk user + active membership | Band context from `bb_band` cookie |
| `POST /api/auth/recover/*` | **Deleted** | Clerk handles password reset |
| **NEW** `POST /api/auth/switch-band` | Switch active band | Updates `bb_band` cookie |
| **NEW** `GET /api/auth/bands` | List user's bands | Returns all memberships for Clerk user |

**Routes eliminated by Clerk** (no longer needed):
- `POST /api/auth/signup` — Clerk `<SignUp>` component
- `POST /api/auth/login` — Clerk `<SignIn>` component
- `POST /api/auth/logout` — Clerk `<UserButton>` sign-out
- `PUT /api/auth/account` — Clerk `<UserProfile>` component

---

## 6. TypeScript Type Changes

```typescript
// EVOLVED (from Member)
export interface Membership {
  id: string;
  clerk_user_id: string;
  band_id: string;
  nickname: string;
  role: 'admin' | 'member' | 'viewer';
  created_at: string;
  last_active_at: string;
}

// UPDATED
export interface AuthContext {
  userId: string;        // Clerk user ID
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
| Duplicate emails across bands point to different people | Same as before — one Clerk user per unique email. Band-specific identity preserved via membership nicknames. |
| Members with no email (shouldn't exist, but defensive) | Migration script skips these; flag for manual review |
| Existing session tokens stop working | Dual-auth grace period: old `bb_session` tokens work alongside Clerk until Phase 3 cutover |
| FK references to `members.id` break on rename | `memberships` table keeps same `id` values; rename is transparent to FKs |
| Clerk user creation for existing members | Use Clerk Backend API to create users, link via `clerk_user_id` |
| Band creator unknown (for admin role assignment) | Heuristic: earliest `created_at` member in each band gets admin role |

---

## 9. Testing Requirements

Each phase must include:

- **Unit tests** for new auth functions (`getAuthContext` with Clerk, role checks)
- **Integration tests** for API routes (band create/join with Clerk auth, band switching)
- **Migration tests** verifying:
  - `clerk_user_id` backfill correctness
  - FK integrity after column additions
  - Role assignment accuracy
- **E2E smoke tests** for critical flows:
  - New user can sign up via Clerk, create band, invite member
  - Existing user can still access their band after migration
  - Band switching works without re-login

---

## 10. Rollback Plan

- **Phase 1:** Remove `clerk_user_id` column, remove `role` column, revert `getAuthContext()`, uninstall `@clerk/nextjs`
- **Phase 2:** Revert UI to old flows (git revert)
- **Phase 3:** Not easily reversible — this is the point of no return. Only execute after thorough Phase 1+2 validation.

---

## 11. Open Questions

1. ~~**OAuth providers?**~~ Resolved: Clerk provides Google/GitHub login out of the box.
2. ~~**Email verification?**~~ Resolved: Clerk handles this automatically.
3. **Multi-band session UX?** Sidebar band switcher vs. separate dashboard? (Recommendation: nav-level band switcher)
4. **Viewer role use case?** Is read-only access needed for V1 of accounts, or can we ship with just admin+member? (Recommendation: ship admin+member first, add viewer later)
5. ~~**Migration timeline?**~~ Simplified: no dual-auth grace period needed with Clerk's session management.
