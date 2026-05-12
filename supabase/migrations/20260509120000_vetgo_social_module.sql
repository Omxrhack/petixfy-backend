-- Social: follows, posts, reviews + profile/vet_services columns.
-- Equivalente a migrations/001_social_module.sql; debe aplicarse con
-- `supabase db push` / migraciones enlazadas al proyecto remoto.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE public.vet_services
  ADD COLUMN IF NOT EXISTS years_experience integer;

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows (following_id);

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) <= 2000),
  image_urls text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_author_idx ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS posts_created_idx ON public.posts (created_at DESC);

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments (id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reviewer_id, appointment_id)
);

CREATE INDEX IF NOT EXISTS reviews_reviewee_idx ON public.reviews (reviewee_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_select ON public.follows;
CREATE POLICY follows_select
  ON public.follows FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS follows_insert ON public.follows;
CREATE POLICY follows_insert
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS follows_delete ON public.follows;
CREATE POLICY follows_delete
  ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS posts_select ON public.posts;
CREATE POLICY posts_select
  ON public.posts FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS posts_insert ON public.posts;
CREATE POLICY posts_insert
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS reviews_select ON public.reviews;
CREATE POLICY reviews_select
  ON public.reviews FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS reviews_insert ON public.reviews;
CREATE POLICY reviews_insert
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT, INSERT ON public.posts TO authenticated;
GRANT SELECT, INSERT ON public.reviews TO authenticated;
