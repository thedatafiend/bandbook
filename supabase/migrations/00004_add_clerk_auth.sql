-- Add Clerk authentication support to members table
-- Phase 1 of Clerk migration: add clerk_user_id and role columns

-- New role enum for RBAC
CREATE TYPE membership_role AS ENUM ('admin', 'member', 'viewer');

-- Add Clerk user ID column (nullable during migration)
ALTER TABLE members ADD COLUMN clerk_user_id text;

-- Add role column with default 'member'
ALTER TABLE members ADD COLUMN role membership_role NOT NULL DEFAULT 'member';

-- Index for fast membership lookups by Clerk user ID
CREATE INDEX members_clerk_user_id_idx ON members (clerk_user_id);

-- Set earliest member in each band as admin (band creator heuristic)
UPDATE members SET role = 'admin'
WHERE id IN (
  SELECT DISTINCT ON (band_id) id
  FROM members
  ORDER BY band_id, created_at ASC
);
