-- Allow admin-managed registration fields to be optional in the database
ALTER TABLE public.registrations
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL;
