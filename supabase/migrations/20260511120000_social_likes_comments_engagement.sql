-- Likes, comentarios y campos de engagement en el feed RPC.

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_likes_post_idx ON public.post_likes (post_id);
CREATE INDEX IF NOT EXISTS post_likes_user_idx ON public.post_likes (user_id);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_comments_post_created_idx
  ON public.post_comments (post_id, created_at DESC);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_likes_select ON public.post_likes;
CREATE POLICY post_likes_select
  ON public.post_likes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS post_likes_insert ON public.post_likes;
CREATE POLICY post_likes_insert
  ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS post_likes_delete ON public.post_likes;
CREATE POLICY post_likes_delete
  ON public.post_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS post_comments_select ON public.post_comments;
CREATE POLICY post_comments_select
  ON public.post_comments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS post_comments_insert ON public.post_comments;
CREATE POLICY post_comments_insert
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT SELECT, INSERT ON public.post_comments TO authenticated;

CREATE OR REPLACE FUNCTION public.post_engagement_batch(
  p_viewer uuid,
  p_post_ids uuid[]
)
RETURNS TABLE (
  post_id uuid,
  like_count integer,
  comment_count integer,
  viewer_has_liked boolean,
  repost_count integer,
  viewer_has_reposted boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pid AS post_id,
    COALESCE((SELECT COUNT(*)::int FROM public.post_likes pl WHERE pl.post_id = pid), 0) AS like_count,
    COALESCE((SELECT COUNT(*)::int FROM public.post_comments pc WHERE pc.post_id = pid), 0) AS comment_count,
    CASE
      WHEN p_viewer IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.post_likes pl
        WHERE pl.post_id = pid AND pl.user_id = p_viewer
      )
    END AS viewer_has_liked,
    COALESCE((SELECT COUNT(*)::int FROM public.post_reposts pr WHERE pr.original_post_id = pid), 0) AS repost_count,
    CASE
      WHEN p_viewer IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.post_reposts pr
        WHERE pr.original_post_id = pid AND pr.reposter_id = p_viewer
      )
    END AS viewer_has_reposted
  FROM unnest(p_post_ids) AS u(pid);
$$;

GRANT EXECUTE ON FUNCTION public.post_engagement_batch(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_engagement_batch(uuid, uuid[]) TO anon;

CREATE OR REPLACE FUNCTION public.social_feed_items(
  p_viewer uuid,
  p_limit integer,
  p_offset integer
)
RETURNS TABLE (item jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH circle AS (
    SELECT DISTINCT uid FROM (
      SELECT p_viewer AS uid
      UNION
      SELECT following_id FROM public.follows WHERE follower_id = p_viewer
    ) s
  ),
  author_posts AS (
    SELECT
      jsonb_build_object(
        'feed_kind', 'post',
        'created_at', p.created_at,
        'post', jsonb_build_object(
          'id', p.id,
          'body', p.body,
          'image_urls', COALESCE(to_jsonb(p.image_urls), '[]'::jsonb),
          'created_at', p.created_at,
          'author', jsonb_build_object(
            'id', authprof.id,
            'full_name', authprof.full_name,
            'avatar_url', authprof.avatar_url
          ),
          'like_count', COALESCE((SELECT COUNT(*)::int FROM public.post_likes pl WHERE pl.post_id = p.id), 0),
          'comment_count', COALESCE((SELECT COUNT(*)::int FROM public.post_comments pc WHERE pc.post_id = p.id), 0),
          'viewer_has_liked', CASE
            WHEN p_viewer IS NULL THEN false
            ELSE EXISTS (
              SELECT 1 FROM public.post_likes pl2
              WHERE pl2.post_id = p.id AND pl2.user_id = p_viewer
            )
          END,
          'repost_count', COALESCE((SELECT COUNT(*)::int FROM public.post_reposts pr WHERE pr.original_post_id = p.id), 0),
          'viewer_has_reposted', CASE
            WHEN p_viewer IS NULL THEN false
            ELSE EXISTS (
              SELECT 1 FROM public.post_reposts pr2
              WHERE pr2.original_post_id = p.id AND pr2.reposter_id = p_viewer
            )
          END
        )
      ) AS item,
      p.created_at AS sort_ts
    FROM public.posts p
    INNER JOIN public.profiles authprof ON authprof.id = p.author_id
    WHERE p.author_id IN (SELECT uid FROM circle)
  ),
  repost_rows AS (
    SELECT
      jsonb_build_object(
        'feed_kind', 'repost',
        'created_at', r.created_at,
        'repost_id', r.id,
        'quote_body', r.quote_body,
        'reposter', jsonb_build_object(
          'id', rp.id,
          'full_name', rp.full_name,
          'avatar_url', rp.avatar_url
        ),
        'post', jsonb_build_object(
          'id', op.id,
          'body', op.body,
          'image_urls', COALESCE(to_jsonb(op.image_urls), '[]'::jsonb),
          'created_at', op.created_at,
          'author', jsonb_build_object(
            'id', ap.id,
            'full_name', ap.full_name,
            'avatar_url', ap.avatar_url
          ),
          'like_count', COALESCE((SELECT COUNT(*)::int FROM public.post_likes pl WHERE pl.post_id = op.id), 0),
          'comment_count', COALESCE((SELECT COUNT(*)::int FROM public.post_comments pc WHERE pc.post_id = op.id), 0),
          'viewer_has_liked', CASE
            WHEN p_viewer IS NULL THEN false
            ELSE EXISTS (
              SELECT 1 FROM public.post_likes pl2
              WHERE pl2.post_id = op.id AND pl2.user_id = p_viewer
            )
          END,
          'repost_count', COALESCE((SELECT COUNT(*)::int FROM public.post_reposts pr WHERE pr.original_post_id = op.id), 0),
          'viewer_has_reposted', CASE
            WHEN p_viewer IS NULL THEN false
            ELSE EXISTS (
              SELECT 1 FROM public.post_reposts pr2
              WHERE pr2.original_post_id = op.id AND pr2.reposter_id = p_viewer
            )
          END
        )
      ) AS item,
      r.created_at AS sort_ts
    FROM public.post_reposts r
    INNER JOIN public.profiles rp ON rp.id = r.reposter_id
    INNER JOIN public.posts op ON op.id = r.original_post_id
    INNER JOIN public.profiles ap ON ap.id = op.author_id
    WHERE r.reposter_id IN (SELECT uid FROM circle)
  ),
  merged AS (
    SELECT author_posts.item, author_posts.sort_ts FROM author_posts
    UNION ALL
    SELECT repost_rows.item, repost_rows.sort_ts FROM repost_rows
  )
  SELECT m.item FROM merged m
  ORDER BY m.sort_ts DESC
  LIMIT p_limit OFFSET p_offset;
$$;

DROP FUNCTION IF EXISTS public.social_profile_feed_items(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.social_profile_feed_items(
  p_profile uuid,
  p_limit integer,
  p_offset integer,
  p_viewer uuid DEFAULT NULL
)
RETURNS TABLE (item jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH author_posts AS (
    SELECT
      jsonb_build_object(
        'feed_kind', 'post',
        'created_at', p.created_at,
        'post', jsonb_build_object(
          'id', p.id,
          'body', p.body,
          'image_urls', COALESCE(to_jsonb(p.image_urls), '[]'::jsonb),
          'created_at', p.created_at,
          'author', jsonb_build_object(
            'id', authprof.id,
            'full_name', authprof.full_name,
            'avatar_url', authprof.avatar_url
          ),
          'like_count', COALESCE((SELECT COUNT(*)::int FROM public.post_likes pl WHERE pl.post_id = p.id), 0),
          'comment_count', COALESCE((SELECT COUNT(*)::int FROM public.post_comments pc WHERE pc.post_id = p.id), 0),
          'viewer_has_liked', CASE
            WHEN p_viewer IS NULL THEN false
            ELSE EXISTS (
              SELECT 1 FROM public.post_likes pl2
              WHERE pl2.post_id = p.id AND pl2.user_id = p_viewer
            )
          END,
          'repost_count', COALESCE((SELECT COUNT(*)::int FROM public.post_reposts pr WHERE pr.original_post_id = p.id), 0),
          'viewer_has_reposted', CASE
            WHEN p_viewer IS NULL THEN false
            ELSE EXISTS (
              SELECT 1 FROM public.post_reposts pr2
              WHERE pr2.original_post_id = p.id AND pr2.reposter_id = p_viewer
            )
          END
        )
      ) AS item,
      p.created_at AS sort_ts
    FROM public.posts p
    INNER JOIN public.profiles authprof ON authprof.id = p.author_id
    WHERE p.author_id = p_profile
  ),
  repost_rows AS (
    SELECT
      jsonb_build_object(
        'feed_kind', 'repost',
        'created_at', r.created_at,
        'repost_id', r.id,
        'quote_body', r.quote_body,
        'reposter', jsonb_build_object(
          'id', rp.id,
          'full_name', rp.full_name,
          'avatar_url', rp.avatar_url
        ),
        'post', jsonb_build_object(
          'id', op.id,
          'body', op.body,
          'image_urls', COALESCE(to_jsonb(op.image_urls), '[]'::jsonb),
          'created_at', op.created_at,
          'author', jsonb_build_object(
            'id', ap.id,
            'full_name', ap.full_name,
            'avatar_url', ap.avatar_url
          ),
          'like_count', COALESCE((SELECT COUNT(*)::int FROM public.post_likes pl WHERE pl.post_id = op.id), 0),
          'comment_count', COALESCE((SELECT COUNT(*)::int FROM public.post_comments pc WHERE pc.post_id = op.id), 0),
          'viewer_has_liked', CASE
            WHEN p_viewer IS NULL THEN false
            ELSE EXISTS (
              SELECT 1 FROM public.post_likes pl2
              WHERE pl2.post_id = op.id AND pl2.user_id = p_viewer
            )
          END,
          'repost_count', COALESCE((SELECT COUNT(*)::int FROM public.post_reposts pr WHERE pr.original_post_id = op.id), 0),
          'viewer_has_reposted', CASE
            WHEN p_viewer IS NULL THEN false
            ELSE EXISTS (
              SELECT 1 FROM public.post_reposts pr2
              WHERE pr2.original_post_id = op.id AND pr2.reposter_id = p_viewer
            )
          END
        )
      ) AS item,
      r.created_at AS sort_ts
    FROM public.post_reposts r
    INNER JOIN public.profiles rp ON rp.id = r.reposter_id
    INNER JOIN public.posts op ON op.id = r.original_post_id
    INNER JOIN public.profiles ap ON ap.id = op.author_id
    WHERE r.reposter_id = p_profile
  ),
  merged AS (
    SELECT author_posts.item, author_posts.sort_ts FROM author_posts
    UNION ALL
    SELECT repost_rows.item, repost_rows.sort_ts FROM repost_rows
  )
  SELECT m.item FROM merged m
  ORDER BY m.sort_ts DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.social_profile_feed_items(uuid, integer, integer, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.social_profile_feed_items(uuid, integer, integer, uuid) TO authenticated;
