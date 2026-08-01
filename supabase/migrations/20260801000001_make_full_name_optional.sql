-- Allow full_name to be optional in the database to support full CMS control
ALTER TABLE public.registrations
  ALTER COLUMN full_name DROP NOT NULL;
