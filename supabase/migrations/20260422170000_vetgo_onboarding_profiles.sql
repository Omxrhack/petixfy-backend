-- Expanded onboarding model for client and vet role flows

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(6, 2),
  ADD COLUMN IF NOT EXISTS is_neutered boolean,
  ADD COLUMN IF NOT EXISTS vaccines_up_to_date text,
  ADD COLUMN IF NOT EXISTS medical_notes text,
  ADD COLUMN IF NOT EXISTS temperament text;

CREATE TABLE IF NOT EXISTS public.client_details (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  address_text text NOT NULL,
  address_notes text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vet_details (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  cedula text NOT NULL,
  university text,
  experience_years text NOT NULL,
  base_latitude double precision,
  base_longitude double precision,
  coverage_radius_km numeric(6, 2) NOT NULL DEFAULT 5,
  has_vehicle boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vet_services (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  specialty text NOT NULL,
  offered_services text[] NOT NULL DEFAULT '{}',
  accepts_emergencies boolean NOT NULL DEFAULT false,
  schedule_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vet_finances (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  clabe text NOT NULL,
  bank_name text NOT NULL,
  rfc text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS client_details_set_updated_at ON public.client_details;
CREATE TRIGGER client_details_set_updated_at
  BEFORE UPDATE ON public.client_details
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS vet_details_set_updated_at ON public.vet_details;
CREATE TRIGGER vet_details_set_updated_at
  BEFORE UPDATE ON public.vet_details
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS vet_services_set_updated_at ON public.vet_services;
CREATE TRIGGER vet_services_set_updated_at
  BEFORE UPDATE ON public.vet_services
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS vet_finances_set_updated_at ON public.vet_finances;
CREATE TRIGGER vet_finances_set_updated_at
  BEFORE UPDATE ON public.vet_finances
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.client_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_finances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_details_select_own ON public.client_details;
CREATE POLICY client_details_select_own
  ON public.client_details
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS client_details_insert_own ON public.client_details;
CREATE POLICY client_details_insert_own
  ON public.client_details
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS client_details_update_own ON public.client_details;
CREATE POLICY client_details_update_own
  ON public.client_details
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS vet_details_select_own ON public.vet_details;
CREATE POLICY vet_details_select_own
  ON public.vet_details
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS vet_details_insert_own ON public.vet_details;
CREATE POLICY vet_details_insert_own
  ON public.vet_details
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS vet_details_update_own ON public.vet_details;
CREATE POLICY vet_details_update_own
  ON public.vet_details
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS vet_services_select_own ON public.vet_services;
CREATE POLICY vet_services_select_own
  ON public.vet_services
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS vet_services_insert_own ON public.vet_services;
CREATE POLICY vet_services_insert_own
  ON public.vet_services
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS vet_services_update_own ON public.vet_services;
CREATE POLICY vet_services_update_own
  ON public.vet_services
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS vet_finances_select_own ON public.vet_finances;
CREATE POLICY vet_finances_select_own
  ON public.vet_finances
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS vet_finances_insert_own ON public.vet_finances;
CREATE POLICY vet_finances_insert_own
  ON public.vet_finances
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS vet_finances_update_own ON public.vet_finances;
CREATE POLICY vet_finances_update_own
  ON public.vet_finances
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.client_details TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vet_details TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vet_services TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vet_finances TO authenticated;
