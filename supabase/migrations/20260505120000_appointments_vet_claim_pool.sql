-- Vet may assign pool appointments (vet_id IS NULL) to themselves without service role.

DROP POLICY IF EXISTS appointments_update_claim_pool_for_vet ON public.appointments;

CREATE POLICY appointments_update_claim_pool_for_vet
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (
    vet_id IS NULL
    AND status IN ('pending'::public.appointment_status, 'confirmed'::public.appointment_status)
    AND public.auth_is_vet()
  )
  WITH CHECK (
    vet_id = auth.uid()
    AND public.auth_is_vet()
  );
