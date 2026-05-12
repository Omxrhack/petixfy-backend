-- Social module migration
-- Run in Supabase SQL editor

-- 1. Extend profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. Extend vet_services
ALTER TABLE vet_services
  ADD COLUMN IF NOT EXISTS years_experience INT;

-- 3. follows
CREATE TABLE IF NOT EXISTS follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);

-- 4. posts
CREATE TABLE IF NOT EXISTS posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) <= 2000),
  image_urls  TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_author_idx  ON posts(author_id);
CREATE INDEX IF NOT EXISTS posts_created_idx ON posts(created_at DESC);

-- 5. reviews
CREATE TABLE IF NOT EXISTS reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  rating         INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT CHECK (char_length(comment) <= 1000),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reviewer_id, appointment_id)
);

CREATE INDEX IF NOT EXISTS reviews_reviewee_idx ON reviews(reviewee_id);

-- 6. RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_select ON follows FOR SELECT USING (true);
CREATE POLICY follows_insert ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY follows_delete ON follows FOR DELETE USING (auth.uid() = follower_id);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_select ON posts FOR SELECT USING (true);
CREATE POLICY posts_insert ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_select ON reviews FOR SELECT USING (true);
CREATE POLICY reviews_insert ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
