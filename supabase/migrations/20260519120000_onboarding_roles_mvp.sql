-- MVP onboarding extensions for client/vet operational, store and social data.

ALTER TABLE public.client_details
  ADD COLUMN IF NOT EXISTS default_contact_name text,
  ADD COLUMN IF NOT EXISTS default_contact_phone text,
  ADD COLUMN IF NOT EXISTS preferred_fulfillment_method text,
  ADD COLUMN IF NOT EXISTS delivery_notes text,
  ADD COLUMN IF NOT EXISTS emergency_notes text;

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS allergies text,
  ADD COLUMN IF NOT EXISTS chronic_conditions text,
  ADD COLUMN IF NOT EXISTS current_medications text;

ALTER TABLE public.vet_details
  ADD COLUMN IF NOT EXISTS base_address_text text;

ALTER TABLE public.vet_services
  ADD COLUMN IF NOT EXISTS home_visit_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telemedicine_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_radius_km numeric(6, 2);

ALTER TABLE public.vet_finances
  ADD COLUMN IF NOT EXISTS account_holder text;

CREATE TABLE IF NOT EXISTS public.vet_store_settings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  store_display_name text,
  pickup_address_text text,
  pickup_instructions text,
  store_contact_phone text,
  offers_delivery boolean NOT NULL DEFAULT true,
  offers_pickup boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS vet_store_settings_set_updated_at ON public.vet_store_settings;
CREATE TRIGGER vet_store_settings_set_updated_at
  BEFORE UPDATE ON public.vet_store_settings
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.vet_store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vet_store_settings_select_own ON public.vet_store_settings;
CREATE POLICY vet_store_settings_select_own
  ON public.vet_store_settings
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS vet_store_settings_insert_own ON public.vet_store_settings;
CREATE POLICY vet_store_settings_insert_own
  ON public.vet_store_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS vet_store_settings_update_own ON public.vet_store_settings;
CREATE POLICY vet_store_settings_update_own
  ON public.vet_store_settings
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.vet_store_settings TO authenticated;
