-- Make email nullable now that Clerk manages user identity.
-- New members created via Clerk auth won't have a local email.
ALTER TABLE members ALTER COLUMN email DROP NOT NULL;
ALTER TABLE members ALTER COLUMN email SET DEFAULT '';
