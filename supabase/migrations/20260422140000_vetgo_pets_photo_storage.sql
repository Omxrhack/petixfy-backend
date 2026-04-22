-- Foto de mascota + bucket Storage vetgo-images (rutas bajo carpeta = auth.uid())

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS photo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('vetgo-images', 'vetgo-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Lectura pública de objetos del bucket (URLs públicas / catálogo de imágenes)
CREATE POLICY vetgo_images_select_public
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'vetgo-images');

-- Solo el dueño autenticado escribe en su carpeta raíz (primer segmento = auth.uid())
CREATE POLICY vetgo_images_insert_own_folder
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vetgo-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY vetgo_images_update_own_folder
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vetgo-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'vetgo-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY vetgo_images_delete_own_folder
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vetgo-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
