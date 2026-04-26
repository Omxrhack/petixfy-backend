-- Auth gates: add client role and profile flags for verification/onboarding

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'client';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET
  is_verified = COALESCE(is_verified, false),
  onboarding_completed = COALESCE(onboarding_completed, false)
WHERE is_verified IS NULL OR onboarding_completed IS NULL;
