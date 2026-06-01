-- Shareable recording links
--
-- A recording_share is a public, revocable link to a single song version.
-- 3rd parties who open the link can stream that one recording without
-- authenticating or seeing the band, song list, or any other versions.
--
-- A version may accumulate multiple share rows over time (e.g. revoke then
-- re-share generates a fresh token), but at most one is "active" at a time
-- (active == revoked_at is null). The token is the public, URL-safe secret.

create table recording_shares (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references versions(id) on delete cascade,
  token text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by_member_id uuid not null references members(id)
);

create index recording_shares_version_id_idx on recording_shares (version_id);

-- Ensure only one active (non-revoked) share per version.
create unique index recording_shares_one_active_per_version_idx
  on recording_shares (version_id)
  where revoked_at is null;

-- RLS: mirror the permissive, application-enforced policy used by the rest of
-- the schema. Authorization for create/revoke happens in the API routes via
-- getAuthContext(); public reads happen by unguessable token.
alter table recording_shares enable row level security;
create policy "Service role full access" on recording_shares for all using (true) with check (true);
