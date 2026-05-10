-- Reposts, RLS, feed RPCs y seeder demo de posts (INSERT…SELECT desde profiles existentes).

CREATE TABLE IF NOT EXISTS public.post_reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reposter_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  original_post_id uuid NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  quote_body text CHECK (quote_body IS NULL OR char_length(quote_body) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reposter_id, original_post_id)
);

CREATE INDEX IF NOT EXISTS post_reposts_reposter_created_idx
  ON public.post_reposts (reposter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS post_reposts_original_idx
  ON public.post_reposts (original_post_id);

ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_reposts_select ON public.post_reposts;
CREATE POLICY post_reposts_select
  ON public.post_reposts FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS post_reposts_insert ON public.post_reposts;
CREATE POLICY post_reposts_insert
  ON public.post_reposts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reposter_id);

DROP POLICY IF EXISTS post_reposts_delete ON public.post_reposts;
CREATE POLICY post_reposts_delete
  ON public.post_reposts FOR DELETE TO authenticated
  USING (auth.uid() = reposter_id);

GRANT SELECT, INSERT, DELETE ON public.post_reposts TO authenticated;

-- Feed unificado: posts de autores en el círculo + reposts hechos por gente del círculo.
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
          )
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
          )
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

-- Perfil: posts propios + reposts del usuario, orden cronológico.
CREATE OR REPLACE FUNCTION public.social_profile_feed_items(
  p_profile uuid,
  p_limit integer,
  p_offset integer
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
          )
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
          )
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

GRANT EXECUTE ON FUNCTION public.social_feed_items(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_profile_feed_items(uuid, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.social_profile_feed_items(uuid, integer, integer) TO authenticated;

-- Seeder demo: hasta 5 posts (1:1 perfil aleatorio ↔ texto) si hay perfiles.
INSERT INTO public.posts (author_id, body, image_urls)
SELECT profs.id,
       txts.body,
       '{}'::text[]
FROM (
  SELECT id,
         row_number() OVER () AS n
  FROM (
    SELECT id FROM public.profiles ORDER BY random() LIMIT 5
  ) pick
) profs
INNER JOIN (
  SELECT body,
         row_number() OVER () AS n
  FROM (
    VALUES
      ('¡Hola desde Vetgo! 🐾'),
      ('Consejo del día: hidrata bien a tu mascota en verano.'),
      ('¿Ya conoces al vet de tu zona? Revisa el mapa en la app.'),
      ('La vacunación anual es clave para prevenir enfermedades.'),
      ('Comparte fotos de tus compañeros peludos aquí.')
  ) v(body)
) txts ON txts.n = profs.n
WHERE EXISTS (SELECT 1 FROM public.profiles LIMIT 1);
