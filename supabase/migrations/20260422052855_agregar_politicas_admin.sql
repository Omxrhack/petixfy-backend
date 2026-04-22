-- Políticas separadas para rol admin (deben ejecutarse después de agregar el valor enum)

CREATE POLICY rewards_update_admin
  ON public.rewards
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'admin'::public.user_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'admin'::public.user_role
    )
  );

CREATE POLICY rewards_insert_admin
  ON public.rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'admin'::public.user_role
    )
  );
