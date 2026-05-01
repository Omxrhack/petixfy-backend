-- Dueño puede ver datos básicos del veterinario asignado a sus citas (nombre, foto en join).

DROP POLICY IF EXISTS profiles_select_assigned_vet_for_owner ON public.profiles;

CREATE POLICY profiles_select_assigned_vet_for_owner
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.owner_id = auth.uid()
        AND a.vet_id = profiles.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.emergencies e
      JOIN public.pets p ON p.id = e.pet_id
      WHERE p.owner_id = auth.uid()
        AND e.assigned_vet_id = profiles.id
    )
  );
