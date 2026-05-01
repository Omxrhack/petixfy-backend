-- Infinite RLS recursion on profiles: policies ON profiles must not SELECT profiles
-- under RLS. Vet role checks use SECURITY DEFINER helper (bypasses RLS).

CREATE OR REPLACE FUNCTION public.auth_is_vet()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'vet'::public.user_role
  );
$$;

ALTER FUNCTION public.auth_is_vet() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.auth_is_vet() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_vet() TO authenticated;

-- ---------------------------------------------------------------------------
-- appointments / emergencies (vet_flow_dashboard.sql)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS appointments_select_assigned_vet ON public.appointments;
CREATE POLICY appointments_select_assigned_vet
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    vet_id IS NOT NULL
    AND vet_id = auth.uid()
    AND public.auth_is_vet()
  );

DROP POLICY IF EXISTS appointments_update_assigned_vet ON public.appointments;
CREATE POLICY appointments_update_assigned_vet
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (
    vet_id = auth.uid()
    AND public.auth_is_vet()
  )
  WITH CHECK (
    vet_id = auth.uid()
    AND public.auth_is_vet()
  );

DROP POLICY IF EXISTS emergencies_select_assigned_vet ON public.emergencies;
CREATE POLICY emergencies_select_assigned_vet
  ON public.emergencies
  FOR SELECT
  TO authenticated
  USING (
    assigned_vet_id IS NOT NULL
    AND assigned_vet_id = auth.uid()
    AND public.auth_is_vet()
  );

DROP POLICY IF EXISTS emergencies_update_assigned_vet ON public.emergencies;
CREATE POLICY emergencies_update_assigned_vet
  ON public.emergencies
  FOR UPDATE
  TO authenticated
  USING (
    assigned_vet_id = auth.uid()
    AND public.auth_is_vet()
  )
  WITH CHECK (public.auth_is_vet());

-- ---------------------------------------------------------------------------
-- Citas en pool, mascotas, profiles (vet), client_details (vet_sees_pool_appointments.sql)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS appointments_select_pool_for_vet ON public.appointments;
CREATE POLICY appointments_select_pool_for_vet
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    vet_id IS NULL
    AND status IN ('pending'::public.appointment_status, 'confirmed'::public.appointment_status)
    AND public.auth_is_vet()
  );

DROP POLICY IF EXISTS pets_select_by_assigned_vet ON public.pets;
CREATE POLICY pets_select_by_assigned_vet
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_vet()
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
    public.auth_is_vet()
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
    public.auth_is_vet()
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

-- ---------------------------------------------------------------------------
-- tracking_sessions (vetgo_premium_modules.sql)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tracking_sessions_select_owner_or_vet ON public.tracking_sessions;
CREATE POLICY tracking_sessions_select_owner_or_vet
  ON public.tracking_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_vet()
    OR EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id = tracking_sessions.appointment_id
        AND a.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.emergencies e
      JOIN public.pets p ON p.id = e.pet_id
      WHERE e.id = tracking_sessions.emergency_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tracking_sessions_insert_vet ON public.tracking_sessions;
CREATE POLICY tracking_sessions_insert_vet
  ON public.tracking_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_is_vet());

DROP POLICY IF EXISTS tracking_sessions_update_vet ON public.tracking_sessions;
CREATE POLICY tracking_sessions_update_vet
  ON public.tracking_sessions
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_vet())
  WITH CHECK (public.auth_is_vet());

-- ---------------------------------------------------------------------------
-- products (vetgo_core.sql)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS products_insert_vet ON public.products;
CREATE POLICY products_insert_vet
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_is_vet());

DROP POLICY IF EXISTS products_update_vet ON public.products;
CREATE POLICY products_update_vet
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_vet())
  WITH CHECK (public.auth_is_vet());

DROP POLICY IF EXISTS products_delete_vet ON public.products;
CREATE POLICY products_delete_vet
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.auth_is_vet());
