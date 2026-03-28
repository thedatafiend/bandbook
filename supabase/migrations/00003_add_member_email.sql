-- Add required email column to members for session recovery.
-- Existing rows (if any) get an empty string; new rows must provide a real email.
alter table members add column email text not null default '';

-- Remove the default so future inserts must supply an email explicitly.
alter table members alter column email drop default;

-- Index for recovery lookups: find all members by email.
create index members_email_idx on members (lower(email));
