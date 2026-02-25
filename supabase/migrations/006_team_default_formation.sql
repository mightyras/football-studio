-- Add default formation column to teams table.
-- Only admins can update this (covered by existing RLS policy in 002).
ALTER TABLE public.teams
  ADD COLUMN default_formation_id text NOT NULL DEFAULT '4-4-2';
