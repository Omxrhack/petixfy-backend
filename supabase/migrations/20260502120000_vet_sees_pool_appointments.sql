-- Veterinarios pueden ver citas sin vet_id (pool pendientes/confirmadas) para poder trabajar datos en agenda.

DROP POLICY IF EXISTS appointments_select_pool_for_vet ON public.appointments;
CREATE POLICY appointments_select_pool_for_vet
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    vet_id IS NULL
    AND status IN ('pending'::public.appointment_status, 'confirmed'::public.appointment_status)
    AND EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
  );

DROP POLICY IF EXISTS pets_select_by_assigned_vet ON public.pets;
CREATE POLICY pets_select_by_assigned_vet
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.pet_id = pets.id
          AND a.vet_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.emergencies e
        WHERE e.pet_id = pets.id
          AND e.assigned_vet_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.appointments a2
        WHERE a2.pet_id = pets.id
          AND a2.vet_id IS NULL
          AND a2.status IN ('pending'::public.appointment_status, 'confirmed'::public.appointment_status)
      )
    )
  );

DROP POLICY IF EXISTS profiles_select_by_assignment_for_vet ON public.profiles;
CREATE POLICY profiles_select_by_assignment_for_vet
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.owner_id = profiles.id
          AND a.vet_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.emergencies e
        JOIN public.pets p ON p.id = e.pet_id
        WHERE p.owner_id = profiles.id
          AND e.assigned_vet_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.appointments a2
        WHERE a2.owner_id = profiles.id
          AND a2.vet_id IS NULL
          AND a2.status IN ('pending'::public.appointment_status, 'confirmed'::public.appointment_status)
      )
    )
  );

DROP POLICY IF EXISTS client_details_select_by_assigned_vet ON public.client_details;
CREATE POLICY client_details_select_by_assigned_vet
  ON public.client_details
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.owner_id = client_details.profile_id
          AND a.vet_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.emergencies e
        JOIN public.pets p ON p.id = e.pet_id
        WHERE p.owner_id = client_details.profile_id
          AND e.assigned_vet_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.appointments a2
        WHERE a2.owner_id = client_details.profile_id
          AND a2.vet_id IS NULL
          AND a2.status IN ('pending'::public.appointment_status, 'confirmed'::public.appointment_status)
      )
    )
  );
