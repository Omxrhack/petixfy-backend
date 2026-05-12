-- Seed social denso: bios/ubicación por rol (solo si vacíos), posts por rol (vet / owner / client / admin),
-- follows, likes, comentarios y reposts. Solo usa filas existentes en public.profiles (usuarios auth ya creados).

-- ─── 1) Bio + ciudad si vienen vacíos ─────────────────────────────────────────
UPDATE public.profiles AS p
SET
  bio = CASE
    WHEN p.bio IS NOT NULL AND btrim(p.bio) <> '' THEN p.bio
    WHEN p.role = 'vet'::public.user_role THEN 'MVZ · consulta general, urgencias y seguimiento.'
    WHEN p.role = 'client'::public.user_role THEN 'Familia con mascotas · adopción responsable.'
    WHEN p.role = 'owner'::public.user_role THEN 'Dueño de mascotas · tips y experiencias.'
    WHEN p.role = 'admin'::public.user_role THEN 'Equipo Vetgo.'
    ELSE 'Usuario Vetgo Social.'
  END,
  location = CASE
    WHEN p.location IS NOT NULL AND btrim(p.location) <> '' THEN p.location
    ELSE (
      ARRAY[
        'Ciudad de México',
        'Guadalajara',
        'Monterrey',
        'Mérida',
        'Puebla',
        'Querétaro',
        'León',
        'Tijuana'
      ]
    )[1 + mod(abs(hashtext(p.id::text)), 8)]
  END
WHERE EXISTS (SELECT 1 FROM public.profiles LIMIT 1);

-- ─── 2) Posts: 4 por perfil según rol ─────────────────────────────────────────
INSERT INTO public.posts (author_id, body, image_urls)
SELECT pr.id, x.body, x.imgs
FROM public.profiles pr
CROSS JOIN generate_series(1, 4) AS slot(n)
JOIN (
  VALUES
    ('vet'::public.user_role, 1, 'Antibióticos: completa el tratamiento aunque mejore antes. Evita resistencias.', '{}'::text[]),
    ('vet'::public.user_role, 2, 'Desparasitación interna cada 3–6 meses según hábito y zona.', '{}'::text[]),
    ('vet'::public.user_role, 3, 'En verano evita ejercicio intenso en pleno sol; hidratación y sombra.', ARRAY['https://picsum.photos/id/237/800/450']::text[]),
    ('vet'::public.user_role, 4, 'Vacunación anual: protege a tu mascota y reduce riesgos zoonóticos.', '{}'::text[]),
    ('owner'::public.user_role, 1, 'Paseo largo en el parque — cuando mueve la cola así, vale cada minuto.', ARRAY['https://picsum.photos/id/1025/800/450']::text[]),
    ('owner'::public.user_role, 2, '¿Snacks naturales para dientes? Mi peludo es delicado con texturas.', '{}'::text[]),
    ('owner'::public.user_role, 3, 'Adopción con cabeza: tiempo, espacio y presupuesto antes de sumar un integrante.', '{}'::text[]),
    ('owner'::public.user_role, 4, 'Rescatado hace tiempo — la mejor decisión de la casa.', ARRAY['https://picsum.photos/id/169/800/450']::text[]),
    ('client'::public.user_role, 1, 'Primera consulta en Vetgo muy clara. Gracias al equipo.', '{}'::text[]),
    ('client'::public.user_role, 2, 'Mi gato come mejor tras el cambio de alimento que recomendaron.', '{}'::text[]),
    ('client'::public.user_role, 3, 'Domingo de relax con el felino — foto obligada.', ARRAY['https://picsum.photos/id/219/800/450']::text[]),
    ('client'::public.user_role, 4, 'Vacuna puntual y sin estrés. Buen servicio.', '{}'::text[]),
    ('admin'::public.user_role, 1, 'Vetgo Social: gracias por construir comunidad con responsabilidad.', '{}'::text[]),
    ('admin'::public.user_role, 2, 'Reportar contenido que incumpla normas ayuda a mantener el espacio sano.', '{}'::text[]),
    ('admin'::public.user_role, 3, 'Seguimos mejorando mapa y citas — feedback bienvenido.', '{}'::text[]),
    ('admin'::public.user_role, 4, 'Compartan consejos y historias positivas.', ARRAY['https://picsum.photos/id/433/800/450']::text[])
) AS x(role, sn, body, imgs)
  ON x.role = pr.role AND x.sn = slot.n
WHERE EXISTS (SELECT 1 FROM public.profiles LIMIT 1);

-- Perfiles sin ningún post (rol no contemplado arriba): dos líneas genéricas.
INSERT INTO public.posts (author_id, body, image_urls)
SELECT pr.id, t.body, t.imgs
FROM public.profiles pr
CROSS JOIN (
  VALUES
    ('Compartiendo tips de bienestar animal en Vetgo Social.', '{}'::text[]),
    ('¿Qué aprendiste hoy con tu mascota? Cuéntalo aquí.', '{}'::text[])
) AS t(body, imgs)
WHERE NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.author_id = pr.id);

-- ─── 3) Follows (grafo disperso, sin duplicados) ────────────────────────────────
INSERT INTO public.follows (follower_id, following_id)
SELECT f.id, t.id
FROM public.profiles f
JOIN public.profiles t ON t.id <> f.id
WHERE mod(abs(hashtext(f.id::text || t.id::text)), 10) = 0
ON CONFLICT DO NOTHING;

-- ─── 4) Likes ─────────────────────────────────────────────────────────────────
INSERT INTO public.post_likes (post_id, user_id)
SELECT po.id, u.id
FROM public.posts po
JOIN public.profiles u ON u.id <> po.author_id
WHERE mod(abs(hashtext(po.id::text || u.id::text)), 8) = 0
ON CONFLICT DO NOTHING;

-- ─── 5) Comentarios ───────────────────────────────────────────────────────────
INSERT INTO public.post_comments (post_id, author_id, body)
SELECT po.id, u.id, c.txt
FROM public.posts po
JOIN public.profiles u ON u.id <> po.author_id
JOIN LATERAL (
  SELECT (ARRAY[
    'Totalmente de acuerdo.',
    'Gracias por compartir.',
    'Lo anoto para casa.',
    'En mi caso funcionó igual.',
    '¿Alguna marca que recomienden?',
    '¡Qué buena foto!',
    'Saludos desde el feed.'
  ])[
    1 + mod(abs(hashtext(po.id::text || u.id::text)), 7)
  ] AS txt
) c ON mod(abs(hashtext(po.id::text || u.id::text)), 13) = 0
LIMIT 400;

-- ─── 6) Reposts sin cita ───────────────────────────────────────────────────────
INSERT INTO public.post_reposts (reposter_id, original_post_id, quote_body)
SELECT r.id, po.id, NULL::text
FROM public.posts po
JOIN public.profiles r ON r.id <> po.author_id
WHERE mod(abs(hashtext(r.id::text || po.id::text)), 19) = 0
ON CONFLICT (reposter_id, original_post_id) DO NOTHING;
