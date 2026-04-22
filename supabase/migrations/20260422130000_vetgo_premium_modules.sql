-- Vetgo premium: rewards, triage IA, live tracking
-- Depends on: 20260422120000_vetgo_core.sql (profiles, pets, appointments, emergencies)

-- ---------------------------------------------------------------------------
-- Roles: admin para operaciones privilegiadas (p. ej. sumar puntos)
-- ---------------------------------------------------------------------------
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';

-- ---------------------------------------------------------------------------
-- Enums premium
-- ---------------------------------------------------------------------------
CREATE TYPE public.rewards_tier AS ENUM ('bronze', 'silver', 'gold');

CREATE TYPE public.triage_urgency AS ENUM ('bajo', 'medio', 'alto');

-- ---------------------------------------------------------------------------
-- rewards (1 fila por dueño)
-- ---------------------------------------------------------------------------
CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  tier public.rewards_tier NOT NULL DEFAULT 'bronze',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rewards_owner_id_key UNIQUE (owner_id)
);

CREATE TRIGGER rewards_set_updated_at
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- triage_logs
-- ---------------------------------------------------------------------------
CREATE TABLE public.triage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  urgency_level public.triage_urgency NOT NULL,
  recommendation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- tracking_sessions (cita O emergencia, nunca ambas)
-- ---------------------------------------------------------------------------
CREATE TABLE public.tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments (id) ON DELETE CASCADE,
  emergency_id uuid REFERENCES public.emergencies (id) ON DELETE CASCADE,
  vet_lat double precision NOT NULL,
  vet_lng double precision NOT NULL,
  eta_minutes integer CHECK (eta_minutes IS NULL OR eta_minutes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracking_sessions_one_target_chk
    CHECK (
      (appointment_id IS NOT NULL)::integer + (emergency_id IS NOT NULL)::integer = 1
    )
);

CREATE TRIGGER tracking_sessions_set_updated_at
  BEFORE UPDATE ON public.tracking_sessions
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX tracking_sessions_appointment_id_idx ON public.tracking_sessions (appointment_id);
CREATE INDEX tracking_sessions_emergency_id_idx ON public.tracking_sessions (emergency_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;

-- rewards: el dueño ve su fila; puede crear solo fila inicial en cero; admin actualiza cualquiera
CREATE POLICY rewards_select_own
  ON public.rewards
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY rewards_insert_own_initial
  ON public.rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND points = 0
    AND tier = 'bronze'::public.rewards_tier
  );

-- NOTE:
-- Las políticas que dependen de 'admin'::public.user_role se mueven a
-- una migración posterior para evitar errores de visibilidad del enum
-- en transacciones de migración.

-- triage: solo mascotas del dueño
CREATE POLICY triage_logs_select_own_pet
  ON public.triage_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pets p
      WHERE p.id = triage_logs.pet_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY triage_logs_insert_own_pet
  ON public.triage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pets p
      WHERE p.id = pet_id
        AND p.owner_id = auth.uid()
    )
  );

-- tracking: dueño de la cita/emergencia o veterinario
CREATE POLICY tracking_sessions_select_owner_or_vet
  ON public.tracking_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
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

CREATE POLICY tracking_sessions_insert_vet
  ON public.tracking_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'vet'::public.user_role
    )
  );

CREATE POLICY tracking_sessions_update_vet
  ON public.tracking_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
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
-- Backfill: una fila rewards por perfil existente
-- ---------------------------------------------------------------------------
INSERT INTO public.rewards (owner_id, points, tier)
SELECT pr.id, 0, 'bronze'::public.rewards_tier
FROM public.profiles pr
ON CONFLICT (owner_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.rewards TO authenticated;
GRANT SELECT, INSERT ON public.triage_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tracking_sessions TO authenticated;
