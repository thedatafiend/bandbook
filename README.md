# BandBook

[![CI Tests](https://github.com/thedatafiend/bandbook/actions/workflows/test.yml/badge.svg)](https://github.com/thedatafiend/bandbook/actions/workflows/test.yml)
![Next.js](https://img.shields.io/badge/Next.js-16.2.1-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Database_&_Auth-3FCF8E?logo=supabase&logoColor=white)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC_BY--NC_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

A collaborative songwriting workspace for bands. Upload rehearsal recordings, compose structured lyrics, manage song versions, and keep your entire catalog in one shared space — all from your phone.

## What is BandBook?

BandBook replaces the mess of voice memos, group chats, and shared drives that most bands use to track their songs. Create a band, invite your members with a simple link + passcode, and start building your catalog together.

No accounts or email signups required — just pick a nickname and you're in.

## Features

### Song Catalog

Browse, search, and filter your band's songs in one place. Each song card shows its status (Draft, In Progress, Finished), how many recorded versions exist, whether lyrics have been added, and when it was last updated. Sort by title, date created, or last updated.

### Audio Versions

Upload rehearsal recordings or demos in common audio formats (.m4a, .mp3, .wav, .aac, .ogg) up to 500 MB. Every take is preserved as a numbered version with optional labels and notes, so you never lose a good idea. Mark any version as the "current" take and play it back directly in the app.

### Lyrics Composer

Write lyrics with structured sections — verses, choruses, bridges, pre-choruses, intros, outros, or custom sections. Reorder them as the song evolves. Every edit is saved as a revision with a full history, so you can always look back at where a song came from.

### Band Management

Create a band with a name and passcode, then share an invite link with your bandmates. View who's in the band, when they joined, and when they were last active. Regenerate invite links or change the passcode from settings at any time.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Supabase](https://supabase.com/) project

### Setup

1. Clone the repo and install dependencies:

   ```bash
   git clone <repo-url>
   cd bandbook
   npm install
   ```

2. Create a `.env.local` file with your Supabase credentials:

   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. Apply the database migrations from `supabase/migrations/` to your Supabase project.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and create your first band.

## Tech Stack

- **Framework** — Next.js (App Router)
- **Language** — TypeScript
- **Styling** — Tailwind CSS
- **Database** — PostgreSQL via Supabase
- **Storage** — Supabase Storage (audio files)
- **Auth** — Session tokens with bcrypt-hashed passcodes (no email/password)
