-- Vet dashboard flow: assignment columns + on_duty + RLS for vets reading linked data

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS vet_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_mxn numeric(12, 2);

ALTER TABLE public.emergencies
  ADD COLUMN IF NOT EXISTS assigned_vet_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.vet_services
  ADD COLUMN IF NOT EXISTS on_duty boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS emergencies_assigned_vet_status_idx
  ON public.emergencies (assigned_vet_id, status);

CREATE INDEX IF NOT EXISTS appointments_vet_id_scheduled_at_idx
  ON public.appointments (vet_id, scheduled_at);

-- ---------------------------------------------------------------------------
-- Appointments: vet may read/update assigned rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS appointments_select_assigned_vet ON public.appointments;
CREATE POLICY appointments_select_assigned_vet
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    vet_id IS NOT NULL
    AND vet_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
  );

DROP POLICY IF EXISTS appointments_update_assigned_vet ON public.appointments;
CREATE POLICY appointments_update_assigned_vet
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (
    vet_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
  )
  WITH CHECK (
    vet_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
  );

-- ---------------------------------------------------------------------------
-- Emergencies: assigned vet may read/update
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS emergencies_select_assigned_vet ON public.emergencies;
CREATE POLICY emergencies_select_assigned_vet
  ON public.emergencies
  FOR SELECT
  TO authenticated
  USING (
    assigned_vet_id IS NOT NULL
    AND assigned_vet_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
  );

DROP POLICY IF EXISTS emergencies_update_assigned_vet ON public.emergencies;
CREATE POLICY emergencies_update_assigned_vet
  ON public.emergencies
  FOR UPDATE
  TO authenticated
  USING (
    assigned_vet_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
  );

-- ---------------------------------------------------------------------------
-- Pets: vet read-only when linked by assignment
-- ---------------------------------------------------------------------------
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
    )
  );

-- ---------------------------------------------------------------------------
-- Profiles: vet read-only for owners linked by assignment (nombre de contacto)
-- ---------------------------------------------------------------------------
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
    )
  );

-- ---------------------------------------------------------------------------
-- Client details: vet read-only when owner has assigned appointment or emergency
-- ---------------------------------------------------------------------------
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
    )
  );
