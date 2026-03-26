# BandBook — Product Requirements Document

**A collaborative songwriting workspace for bands**

| Field | Value |
|-------|-------|
| Product Name | BandBook |
| Platform | Mobile-first Progressive Web App (PWA) |
| Access Model | Shared passcode / invite link with optional member nicknames |
| Data Layer | Cloud-hosted (Supabase) |
| Storage Quota | 10 GB per band (free tier) |
| Target Users | Bands actively writing and rehearsing original music |
| Version | 1.1 — March 2026 |
| Status | Draft — V1 Scoping |

---

## 1. Product Overview

### 1.1 Problem Statement

Bands writing original music face a fragmented workflow. Rehearsal recordings live on individual phones, lyrics get drafted in personal notes apps, and there is no single place to track how a song evolves from a rough jam to a finished arrangement. Important takes get lost in camera rolls, lyric edits diverge, and the band has no shared source of truth for their catalog.

### 1.2 Vision

BandBook is a mobile-first collaborative songwriting workspace where a band can upload rehearsal recordings, compose structured lyrics, manage song versions, and maintain a living catalog of their music — all in a single shared environment accessible from any phone.

### 1.3 Product Principles

- **Rehearsal-speed simplicity** — uploading a recording should take fewer taps than texting it to the group chat
- **Lyrics-first friendly** — a song can start as just an idea with lyrics; audio can come later
- **Structured creativity** — lyrics are organized by section (verse, chorus, bridge) so the song structure is always visible
- **Version-aware** — every recording and lyric revision is preserved; the band picks which version is "current"
- **Low-friction access** — no individual accounts required; a shared passcode or link gets you in, with optional nicknames for identity

---

## 2. User Personas & Use Cases

### 2.1 Primary Persona: The Rehearsal Band

A group of 3–6 musicians who meet regularly (e.g. weekly) to jam, write, and rehearse. They generate rough recordings on phones and need a shared space to organize material between rehearsals.

### 2.2 Key Use Cases

| Use Case | Actor | Description |
|----------|-------|-------------|
| Record & upload a jam | Any member | During or after rehearsal, upload a phone recording and either attach it to an existing song or create a new song entry. |
| Start a song from lyrics | Vocalist / lyricist | Create a new song with just a title and lyrics — no audio required. Audio can be added later as versions. |
| Add/edit lyrics | Vocalist / lyricist | Open a song, add structured lyric sections (verse, chorus, bridge, etc.), reorder them, and save. Review past lyric revisions. |
| Review song versions | Any member | Browse all recordings and lyric revisions for a song, listen to takes, compare, and set the current audio version. |
| Browse the catalog | Any member | View all songs the band has created, filter by status, search by name, and open any song to see its full history. |
| Share access | Band admin | Generate an invite link or passcode and share it with a new member so they can access the workspace. |

---

## 3. Core Data Model

The data model centers on five primary entities: Bands, Members, Songs, Versions (audio), and Lyric Sections. Lyrics are versioned independently of audio through a revision history system.

### 3.1 Entity Relationship

| Entity | Key Fields | Relationships |
|--------|-----------|---------------|
| **Band** | `id`, `name`, `passcode_hash`, `invite_token`, `created_at` | Has many Songs; has many Members |
| **Member** | `id`, `band_id`, `nickname`, `session_token`, `created_at`, `last_active_at` | Belongs to Band; referenced by Versions and Lyric Revisions |
| **Song** | `id`, `band_id`, `title`, `status` (draft/in-progress/finished), `current_version_id` (nullable), `created_at`, `updated_at`, `created_by_member_id` | Belongs to Band; has many Versions and Lyric Sections |
| **Version (Audio)** | `id`, `song_id`, `version_number`, `label`, `audio_url`, `audio_duration`, `notes`, `is_current`, `created_at`, `created_by_member_id` | Belongs to Song; belongs to Member |
| **Lyric Section** | `id`, `song_id`, `section_type` (verse/chorus/bridge/pre-chorus/outro/intro/custom), `section_label`, `content`, `sort_order`, `updated_at`, `updated_by_member_id` | Belongs to Song |
| **Lyric Revision** | `id`, `song_id`, `snapshot` (JSON of all sections + order), `created_at`, `created_by_member_id`, `revision_note` (optional) | Belongs to Song; belongs to Member. Auto-created on each save. |

### 3.2 Schema Notes

- A Song's `current_version_id` is **nullable** — songs can exist with lyrics only and no audio versions.
- When audio versions exist, `current_version_id` points to whichever Version the band has marked as the active take.
- Audio Versions are **append-only**; recordings are never deleted, only superseded.
- Lyric Sections are ordered by `sort_order` and can be reordered via drag-and-drop without changing content.
- Lyric Revisions store a **full snapshot** of the lyric sheet (all sections + order) each time a save occurs. This provides a lightweight undo/history without the complexity of real-time collaboration.
- Members are lightweight identity records (nickname + session). They are not full user accounts — no email or password required.
- Audio files are stored in cloud object storage (e.g. Supabase Storage) with the Version record holding a reference URL.

---

## 4. Feature Specification

### 4.1 Song Creation & Audio Upload

There are two entry points for creating content: starting a song from lyrics (no audio required) or uploading a recording. Both are first-class workflows.

#### Requirements

1. From the home screen, a "+ New Song" button offers two paths: "Start with Lyrics" or "Upload a Recording."
2. **Start with Lyrics:** prompt for a song title (required), then navigate to the Lyrics Composer. No audio is needed.
3. **Upload a Recording:** select an audio file from the device (accept `.m4a`, `.mp3`, `.wav`, `.aac`, `.ogg`; max 500 MB).
4. After file selection for upload, present two paths: "Create New Song" (prompts for title) or "Add to Existing Song" (searchable song list; auto-increments version number).
5. Show upload progress with percentage indicator; support background upload.
6. On completion, navigate to the Song Detail view.
7. All actions are attributed to the current member's nickname.

#### Acceptance Criteria

- A song can be created with only a title and no audio file.
- Audio files up to 500 MB upload successfully on mobile networks.
- Upload resumes if briefly interrupted (e.g. screen lock).
- A new Version record is created with auto-incremented `version_number`.
- If this is the song's first audio version, it is automatically marked as current.
- The uploading member's nickname is recorded on the Version.

---

### 4.2 Song Catalog & Dashboard

The band's central library of all songs, providing at-a-glance status and quick navigation.

#### Requirements

1. Display all songs as cards showing: title, status badge, version count (audio), lyric indicator (has lyrics yes/no), last updated date.
2. Songs without audio display a "Lyrics Only" indicator instead of version count.
3. Support sorting by last updated, title (A–Z), and date created.
4. Support filtering by status: All, Draft, In Progress, Finished.
5. Provide a search bar that filters by song title in real time.
6. Tapping a card opens the Song Detail view.

#### Acceptance Criteria

- Catalog loads within 2 seconds on a typical mobile connection.
- Search results update as the user types (debounced, not per-keystroke).
- Empty state prompts the user to create their first song or upload a recording.
- Lyrics-only songs appear alongside songs with audio without special treatment.

---

### 4.3 Song Detail & Version Management

The single-song view where members can listen to takes, read lyrics, and manage versions.

#### Requirements

1. Show the song title, status, and the current version's audio player at the top. If no audio exists, show a prompt to upload the first recording.
2. Below the player (or prompt), display a tabbed interface: **Versions** | **Lyrics**.
3. **Versions tab:** list all audio versions chronologically (newest first) with version number, label, date, duration, uploaded by (nickname), and a play button. The current version is visually highlighted.
4. Any version can be set as "Current" via a tap-and-confirm action.
5. Each version supports an optional text label (e.g. "Slower tempo take") and freeform notes.
6. **Lyrics tab:** display the composed lyric sheet (see 4.4). If no lyrics exist, show a prompt to start writing.
7. An "Add Recording" button is always accessible from this view to upload a new version directly to this song.

#### Acceptance Criteria

- Audio playback works inline without leaving the app.
- Switching the current version updates the top player immediately.
- Version history is never lost; old versions remain accessible.
- Lyrics-only songs show the Lyrics tab by default and the Versions tab shows an empty state with upload CTA.
- Each version displays the nickname of the member who uploaded it.

---

### 4.4 Lyrics Composer

A structured editor for building song lyrics section by section, designed for mobile use. Lyrics are versioned independently of audio through an automatic revision history.

#### Requirements

1. Provide an "Add Section" button that offers section type choices: Verse, Chorus, Pre-Chorus, Bridge, Intro, Outro, or Custom (user-defined label).
2. Each section displays its type as a colored badge/tag and contains a multi-line text area for lyrics.
3. Sections can be reordered via drag-and-drop (long-press to initiate on mobile).
4. Sections can be duplicated (e.g. reuse "Chorus" at multiple points) or deleted.
5. The composed lyric sheet renders as a readable, scrollable view showing all sections in order with their type labels.
6. Lyrics auto-save on a short debounce (e.g. 2 seconds after last keystroke). Each save creates a Lyric Revision snapshot automatically.
7. A "Revision History" button shows a chronological list of all past lyric snapshots with timestamp and the nickname of the member who made the edit.
8. Any past revision can be previewed in read-only mode. A "Restore this version" action replaces the current lyrics with the selected snapshot (creating a new revision in the process).
9. Support a "Read Mode" that hides editing controls and presents a clean lyric sheet (useful for rehearsal).

#### Acceptance Criteria

- A vocalist can build a full song structure (intro, verse, chorus, verse, chorus, bridge, chorus, outro) in under 2 minutes.
- Reordering sections updates the `sort_order` and persists immediately.
- Read Mode is legible at arm's length (music-stand distance) with large font.
- Revision history is auto-generated on each save with no manual action required from the user.
- Restoring a past revision does not destroy intermediate history — it creates a new revision entry.
- **Last-write-wins:** if two members edit simultaneously, the last save persists. A banner notification warns if the lyrics have been modified by another member since the current view was loaded.

---

### 4.5 Band Access & Member Identity

The mechanism for band members to access the shared workspace. Members are identified by lightweight nicknames rather than full user accounts.

#### Requirements

1. A band workspace is created by one member who sets a band name, a simple passcode (4–8 characters), and their own nickname.
2. A shareable invite link is generated that, when opened, prompts for the passcode and a nickname.
3. On successful entry, the device is granted a persistent session token (stored in browser; no login on return visits). The nickname is associated with the session.
4. Members can change their nickname from a simple profile/settings screen.
5. The band creator can regenerate the invite link or change the passcode at any time.
6. All actions (uploads, lyric edits, version changes) are attributed to the member's nickname for traceability.
7. A "Members" view shows all members who have joined the band with their nicknames and last active date.

#### Acceptance Criteria

- A new member can go from receiving a link to browsing the catalog in under 30 seconds.
- Session persists across browser restarts and phone reboots.
- Changing the passcode does not invalidate existing sessions.
- Nicknames appear on uploaded versions, lyric revisions, and song creation records.
- Duplicate nicknames are allowed (no uniqueness constraint) — this is casual identity, not auth.

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js + Tailwind CSS, installed as PWA | SSR/SSG for fast initial loads, API routes for backend logic, built-in PWA support with next-pwa |
| Backend / API | Supabase (Postgres + Auth + Storage + Realtime) | Managed infrastructure; built-in file storage for audio; row-level security for band isolation |
| Audio Storage | Supabase Storage (S3-compatible) | Supports large file uploads with resumable uploads API; 10 GB free tier per band |
| Hosting | Vercel | First-class Next.js support; free tier sufficient for V1; edge network for fast mobile loads |
| State Management | React Query (TanStack Query) | Handles caching, optimistic updates, and background sync |

### 5.2 Key Technical Decisions

- **PWA with next-pwa:** cache the app shell for instant loads; queue uploads when offline and sync when connectivity returns. Next.js API routes can proxy Supabase calls to keep keys server-side.
- **Resumable uploads:** use Supabase's TUS protocol support for large audio files so uploads survive network interruptions.
- **Row-Level Security (RLS):** Supabase RLS policies scoped to `band_id` ensure data isolation between bands.
- **Audio streaming:** serve audio via signed URLs with range-request support so playback starts before full download.
- **Lyric revision history:** each auto-save writes a new row to the `lyric_revisions` table with a full JSON snapshot of all sections and their order. Snapshots are lightweight (text-only, no binary) so storage overhead is minimal.
- **Conflict handling (V1):** last-write-wins with a stale-data banner. When a member loads the lyrics editor, the current revision ID is noted. On save, if the latest revision ID has changed, a banner warns that someone else has made edits. The save still proceeds (last-write-wins) but the member can review the other revision from history.
- **Member identity:** lightweight — a nickname stored with a session token in the browser. No email, password, or OAuth. The Member record exists primarily for attribution, not access control.
- **Storage quota:** enforced at the Supabase Storage bucket level. The app checks remaining quota before upload and shows a warning when approaching the 10 GB limit.

---

## 6. Screen Map & Navigation

The app uses a simple flat navigation structure optimized for mobile.

| Screen | Purpose | Key Actions |
|--------|---------|-------------|
| Join / Create Band | Entry point; enter passcode + nickname, or create a new band | Enter passcode, set nickname, create band |
| Song Catalog (Home) | Browse all songs; primary dashboard | Search, filter, sort, tap to open, create new song, upload |
| Song Detail | Single-song hub with audio + lyrics | Play audio, switch tabs, set current version, add version |
| Upload Flow | Add a recording; choose new or existing song | Select file, pick destination song, add metadata |
| Lyrics Composer | Build and edit structured lyrics | Add/reorder/duplicate/delete sections, edit text, view revision history |
| Lyrics Read Mode | Clean, large-text lyric sheet for rehearsal | Scroll, toggle back to edit mode |
| Lyric Revision History | Browse and restore past lyric snapshots | Preview revision, restore, view diff |
| Band Settings | Manage passcode, invite link, band name | Regenerate link, change passcode, view members |
| Member Profile | View/edit own nickname | Change nickname |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Catalog loads in < 2s on 4G. Audio playback starts within 1s of tap. |
| Reliability | Uploads retry automatically on failure. No data loss on app crash mid-edit. Lyric revisions provide recovery from accidental edits. |
| Storage | 10 GB per band (free tier). Audio files up to 500 MB each. Alert at 80% quota usage. Lyric revision snapshots excluded from quota (text-only, negligible size). |
| Offline | App shell loads offline. Queued uploads sync when online. Lyrics viewable from cache. |
| Accessibility | Touch targets ≥ 44px. Sufficient color contrast (WCAG AA). Screen reader labels on controls. |
| Security | Passcodes hashed (bcrypt). Audio URLs signed and time-limited. HTTPS only. Session tokens are HTTP-only where possible. |
| Browser Support | Safari (iOS 15+), Chrome (Android 10+). PWA install prompt on both. |

---

## 8. Phased Roadmap

### Phase 1: Core Loop (MVP)

Ship the minimum feature set that replaces the current phone + notes workflow.

- Band creation with passcode access and member nicknames
- Song creation from lyrics only (no audio required) or from audio upload
- Audio upload (new song or add version) with member attribution
- Song catalog with search, status filters, and lyrics-only indicator
- Song detail with version list, audio player, and lyrics tab
- Set current audio version
- Lyrics composer (add sections, edit text, reorder) with auto-save
- Lyric revision history with preview and restore
- Last-write-wins conflict handling with stale-data banner

### Phase 2: Polish & Collaboration

Improve the editing experience and add collaboration features.

- Lyrics Read Mode with large-text rehearsal display
- Real-time collaborative lyrics editing (Supabase Realtime / CRDT)
- Version labels, notes, and comparison (side-by-side audio A/B)
- PWA offline support (cached lyrics, queued uploads)
- Push notifications (new version uploaded, lyrics changed)
- Lyric diff view between revisions

### Phase 3: Expansion

Add power features for bands with a growing catalog.

- Setlist builder — assemble ordered setlists from finished songs with Read Mode for live performance
- Individual member accounts with roles (admin, member, viewer) and email-based auth
- Video recording support — upload and playback of video alongside audio versions
- Song export (PDF lyric sheets, audio download as zip)
- Tempo, key, and tuning metadata per song
- Integration hooks (Spotify link, Bandcamp, etc.)
- Paid tier with expanded storage beyond 10 GB

---

## 9. Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Should lyrics support versioning independently of audio versions? | **Yes.** Lyrics have their own revision history (Lyric Revisions table). Songs can also be created without audio — lyrics-first is a supported workflow. |
| 2 | Is there a need for per-member identity even without full accounts? | **Yes.** Members set a nickname on join. All actions (uploads, lyric edits) are attributed to the member's nickname. No email/password required. |
| 3 | Should the app support video recordings in addition to audio? | **Not in V1.** Video support is deferred to Phase 3 as a future enhancement. |
| 4 | What is the realistic storage budget per band? | **10 GB per band** on the free tier. Paid tiers with expanded storage can be introduced in Phase 3. |
| 5 | Is real-time collaborative lyric editing required for V1? | **No.** V1 uses last-write-wins with a stale-data banner. Automatic lyric revision history provides recovery. Real-time CRDT editing is a Phase 2 target. |

---

## 10. Success Metrics (V1)

- Band creates first song within 5 minutes of setup.
- Average upload-to-playback time < 30 seconds for a 10-minute recording on 4G.
- Band returns to the app at least once between rehearsals to review material.
- Lyrics composer used on ≥ 50% of songs (indicates adoption beyond just audio storage).
- ≥ 25% of songs are created lyrics-first (validates the no-audio-required workflow).
- Zero reports of lost recordings or lyrics in the first 3 months.
- All band members have set a nickname (indicates adoption of member identity).
