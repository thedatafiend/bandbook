-- BandBook schema migration
-- Implements the data model from PRD Section 3

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Custom types
create type song_status as enum ('draft', 'in-progress', 'finished');
create type section_type as enum ('verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'custom');

-- ============================================================
-- BANDS
-- ============================================================
create table bands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  passcode_hash text not null,
  invite_token text not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create unique index bands_invite_token_idx on bands (invite_token);

-- ============================================================
-- MEMBERS
-- ============================================================
create table members (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  nickname text not null,
  session_token text not null default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create unique index members_session_token_idx on members (session_token);
create index members_band_id_idx on members (band_id);

-- ============================================================
-- SONGS
-- ============================================================
create table songs (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  title text not null,
  status song_status not null default 'draft',
  current_version_id uuid, -- FK added after versions table exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_member_id uuid not null references members(id)
);

create index songs_band_id_idx on songs (band_id);

-- ============================================================
-- VERSIONS (audio)
-- ============================================================
create table versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  version_number integer not null,
  label text,
  audio_url text not null,
  audio_duration real,
  notes text,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  created_by_member_id uuid not null references members(id)
);

create index versions_song_id_idx on versions (song_id);

-- Now add the FK from songs.current_version_id -> versions.id
alter table songs
  add constraint songs_current_version_id_fk
  foreign key (current_version_id) references versions(id)
  on delete set null;

-- ============================================================
-- LYRIC SECTIONS
-- ============================================================
create table lyric_sections (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  section_type section_type not null,
  section_label text,
  content text not null default '',
  sort_order integer not null,
  updated_at timestamptz not null default now(),
  updated_by_member_id uuid not null references members(id)
);

create index lyric_sections_song_id_idx on lyric_sections (song_id);

-- ============================================================
-- LYRIC REVISIONS
-- ============================================================
create table lyric_revisions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by_member_id uuid not null references members(id),
  revision_note text
);

create index lyric_revisions_song_id_idx on lyric_revisions (song_id);
create index lyric_revisions_created_at_idx on lyric_revisions (song_id, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- RLS is enabled but policies use session_token passed as a
-- Supabase RPC parameter or via a custom header. For V1, the
-- API routes handle auth server-side, so we set permissive
-- policies that the server-side client uses with the service key.
-- More granular RLS policies can be added in Phase 2.

alter table bands enable row level security;
alter table members enable row level security;
alter table songs enable row level security;
alter table versions enable row level security;
alter table lyric_sections enable row level security;
alter table lyric_revisions enable row level security;

-- Service-role bypass policies (server-side API routes use service key)
create policy "Service role full access" on bands for all using (true) with check (true);
create policy "Service role full access" on members for all using (true) with check (true);
create policy "Service role full access" on songs for all using (true) with check (true);
create policy "Service role full access" on versions for all using (true) with check (true);
create policy "Service role full access" on lyric_sections for all using (true) with check (true);
create policy "Service role full access" on lyric_revisions for all using (true) with check (true);

-- ============================================================
-- STORAGE BUCKET for audio files
-- ============================================================
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;
