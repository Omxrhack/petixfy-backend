-- Infinite RLS recursion on emergencies: own-pet policies subselect pets under RLS,
-- while pets_select_by_assigned_vet subselects emergencies ? cycle.
-- Ownership check bypasses pets RLS via SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.auth_owns_pet(p_pet_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pets p
    WHERE p.id = p_pet_id
      AND p.owner_id = auth.uid()
  );
$$;

ALTER FUNCTION public.auth_owns_pet(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.auth_owns_pet(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_owns_pet(uuid) TO authenticated;

DROP POLICY IF EXISTS emergencies_select_own_pet ON public.emergencies;
CREATE POLICY emergencies_select_own_pet
  ON public.emergencies
  FOR SELECT
  TO authenticated
  USING (public.auth_owns_pet(emergencies.pet_id));

DROP POLICY IF EXISTS emergencies_insert_own_pet ON public.emergencies;
CREATE POLICY emergencies_insert_own_pet
  ON public.emergencies
  FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_owns_pet(pet_id));

DROP POLICY IF EXISTS emergencies_update_own_pet ON public.emergencies;
CREATE POLICY emergencies_update_own_pet
  ON public.emergencies
  FOR UPDATE
  TO authenticated
  USING (public.auth_owns_pet(emergencies.pet_id))
  WITH CHECK (public.auth_owns_pet(emergencies.pet_id));
