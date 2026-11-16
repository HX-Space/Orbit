-- Set when an admin resets a password; the user must pick a new one on next sign-in.
ALTER TABLE temp_users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
