-- Appointment detail fields for scheduled visits.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_type text,
  ADD COLUMN IF NOT EXISTS reason text;
