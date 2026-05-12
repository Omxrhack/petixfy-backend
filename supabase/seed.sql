-- Vetgo demo seed data.
-- Runs after migrations via supabase/config.toml [db.seed].
-- Demo password for every auth user: VetgoDemo123!

-- ---------------------------------------------------------------------------
-- Auth users + identities
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'ana.demo@vetgo.local',
    crypt('VetgoDemo123!', gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ana Ramirez"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'bruno.demo@vetgo.local',
    crypt('VetgoDemo123!', gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Bruno Salazar"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'carla.demo@vetgo.local',
    crypt('VetgoDemo123!', gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Carla Medina"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated',
    'authenticated',
    'diego.demo@vetgo.local',
    crypt('VetgoDemo123!', gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Diego Torres"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555555',
    'authenticated',
    'authenticated',
    'laura.vet@vetgo.local',
    crypt('VetgoDemo123!', gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Dra. Laura Vega"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '66666666-6666-4666-8666-666666666666',
    'authenticated',
    'authenticated',
    'mateo.vet@vetgo.local',
    crypt('VetgoDemo123!', gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Dr. Mateo Ruiz"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '77777777-7777-4777-8777-777777777777',
    'authenticated',
    'authenticated',
    'sofia.vet@vetgo.local',
    crypt('VetgoDemo123!', gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Dra. Sofia Nunez"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '88888888-8888-4888-8888-888888888888',
    'authenticated',
    'authenticated',
    'admin.demo@vetgo.local',
    crypt('VetgoDemo123!', gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Equipo Vetgo"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '{"sub":"11111111-1111-4111-8111-111111111111","email":"ana.demo@vetgo.local","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    '{"sub":"22222222-2222-4222-8222-222222222222","email":"bruno.demo@vetgo.local","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333',
    '{"sub":"33333333-3333-4333-8333-333333333333","email":"carla.demo@vetgo.local","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '44444444-4444-4444-8444-444444444444',
    '44444444-4444-4444-8444-444444444444',
    '{"sub":"44444444-4444-4444-8444-444444444444","email":"diego.demo@vetgo.local","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '55555555-5555-4555-8555-555555555555',
    '55555555-5555-4555-8555-555555555555',
    '{"sub":"55555555-5555-4555-8555-555555555555","email":"laura.vet@vetgo.local","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    '66666666-6666-4666-8666-666666666666',
    '66666666-6666-4666-8666-666666666666',
    '{"sub":"66666666-6666-4666-8666-666666666666","email":"mateo.vet@vetgo.local","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '77777777-7777-4777-8777-777777777777',
    '77777777-7777-4777-8777-777777777777',
    '{"sub":"77777777-7777-4777-8777-777777777777","email":"sofia.vet@vetgo.local","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    '88888888-8888-4888-8888-888888888888',
    '88888888-8888-4888-8888-888888888888',
    '{"sub":"88888888-8888-4888-8888-888888888888","email":"admin.demo@vetgo.local","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Profiles and onboarding data
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (
  id,
  role,
  full_name,
  phone,
  avatar_url,
  is_verified,
  onboarding_completed,
  bio,
  location
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'owner',
    'Ana Ramirez',
    '+52 55 1000 1101',
    'https://i.pravatar.cc/300?img=47',
    true,
    true,
    'Mama de Nala y Max. Fan de las caminatas largas y la adopcion responsable.',
    'Condesa, Ciudad de Mexico'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'owner',
    'Bruno Salazar',
    '+52 55 1000 1102',
    'https://i.pravatar.cc/300?img=12',
    true,
    true,
    'Comparte tips de entrenamiento basico y bienestar canino.',
    'Roma Norte, Ciudad de Mexico'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'client',
    'Carla Medina',
    '+52 55 1000 1103',
    'https://i.pravatar.cc/300?img=32',
    true,
    true,
    'Primeriza con gatos, aprendiendo de nutricion y enriquecimiento ambiental.',
    'Narvarte, Ciudad de Mexico'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'client',
    'Diego Torres',
    '+52 55 1000 1104',
    'https://i.pravatar.cc/300?img=60',
    true,
    true,
    'Casa multiespecie con perro senior y conejo curioso.',
    'Coyoacan, Ciudad de Mexico'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'vet',
    'Dra. Laura Vega',
    '+52 55 2000 2201',
    'https://i.pravatar.cc/300?img=45',
    true,
    true,
    'MVZ enfocada en medicina preventiva, vacunacion y seguimiento familiar.',
    'Polanco, Ciudad de Mexico'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'vet',
    'Dr. Mateo Ruiz',
    '+52 55 2000 2202',
    'https://i.pravatar.cc/300?img=53',
    true,
    true,
    'Urgencias, triage y visitas a domicilio para perros y gatos.',
    'Del Valle, Ciudad de Mexico'
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    'vet',
    'Dra. Sofia Nunez',
    '+52 55 2000 2203',
    'https://i.pravatar.cc/300?img=5',
    true,
    true,
    'Dermatologia, alergias y control de piel para mascotas sensibles.',
    'Santa Fe, Ciudad de Mexico'
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    'admin',
    'Equipo Vetgo',
    '+52 55 3000 3301',
    'https://i.pravatar.cc/300?img=68',
    true,
    true,
    'Cuenta demo para operaciones, moderacion y pruebas internas.',
    'Ciudad de Mexico'
  )
ON CONFLICT (id) DO UPDATE
SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  avatar_url = EXCLUDED.avatar_url,
  is_verified = EXCLUDED.is_verified,
  onboarding_completed = EXCLUDED.onboarding_completed,
  bio = EXCLUDED.bio,
  location = EXCLUDED.location,
  updated_at = now();

INSERT INTO public.client_details (
  profile_id,
  address_text,
  address_notes,
  latitude,
  longitude
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'Av. Veracruz 102, Condesa, Ciudad de Mexico',
    'Porton azul, tocar timbre 2B.',
    19.4142,
    -99.1736
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Colima 215, Roma Norte, Ciudad de Mexico',
    'Departamento interior con elevador.',
    19.4197,
    -99.1622
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'La Morena 408, Narvarte, Ciudad de Mexico',
    'Estacionamiento para visitas sobre la calle lateral.',
    19.3912,
    -99.1557
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'Francisco Sosa 88, Coyoacan, Ciudad de Mexico',
    'Casa con reja negra y jardin frontal.',
    19.3495,
    -99.1628
  )
ON CONFLICT (profile_id) DO UPDATE
SET
  address_text = EXCLUDED.address_text,
  address_notes = EXCLUDED.address_notes,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  updated_at = now();

INSERT INTO public.vet_details (
  profile_id,
  cedula,
  university,
  experience_years,
  base_latitude,
  base_longitude,
  coverage_radius_km,
  has_vehicle
)
VALUES
  (
    '55555555-5555-4555-8555-555555555555',
    'MVZ-1002345',
    'UNAM',
    '8',
    19.4326,
    -99.1910,
    8.50,
    true
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'MVZ-2003456',
    'UAM Xochimilco',
    '6',
    19.3800,
    -99.1648,
    12.00,
    true
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    'MVZ-3004567',
    'Universidad La Salle',
    '10',
    19.3598,
    -99.2769,
    10.00,
    false
  )
ON CONFLICT (profile_id) DO UPDATE
SET
  cedula = EXCLUDED.cedula,
  university = EXCLUDED.university,
  experience_years = EXCLUDED.experience_years,
  base_latitude = EXCLUDED.base_latitude,
  base_longitude = EXCLUDED.base_longitude,
  coverage_radius_km = EXCLUDED.coverage_radius_km,
  has_vehicle = EXCLUDED.has_vehicle,
  updated_at = now();

INSERT INTO public.vet_services (
  profile_id,
  specialty,
  offered_services,
  accepts_emergencies,
  schedule_json,
  years_experience,
  on_duty
)
VALUES
  (
    '55555555-5555-4555-8555-555555555555',
    'Medicina preventiva',
    ARRAY['Consulta general', 'Vacunacion', 'Desparasitacion', 'Certificado de viaje']::text[],
    true,
    '{"mon":["09:00","17:00"],"wed":["09:00","17:00"],"fri":["10:00","16:00"]}'::jsonb,
    8,
    true
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'Urgencias y triage',
    ARRAY['Urgencias', 'Triage', 'Curaciones', 'Visita a domicilio']::text[],
    true,
    '{"tue":["08:00","18:00"],"thu":["08:00","18:00"],"sat":["09:00","14:00"]}'::jsonb,
    6,
    true
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    'Dermatologia veterinaria',
    ARRAY['Dermatologia', 'Alergias', 'Control de piel', 'Seguimiento cronico']::text[],
    false,
    '{"mon":["11:00","19:00"],"thu":["11:00","19:00"],"sun":["10:00","13:00"]}'::jsonb,
    10,
    false
  )
ON CONFLICT (profile_id) DO UPDATE
SET
  specialty = EXCLUDED.specialty,
  offered_services = EXCLUDED.offered_services,
  accepts_emergencies = EXCLUDED.accepts_emergencies,
  schedule_json = EXCLUDED.schedule_json,
  years_experience = EXCLUDED.years_experience,
  on_duty = EXCLUDED.on_duty,
  updated_at = now();

INSERT INTO public.vet_finances (
  profile_id,
  clabe,
  bank_name,
  rfc
)
VALUES
  (
    '55555555-5555-4555-8555-555555555555',
    '002180000000000001',
    'Banamex',
    'VEGL860101AA1'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    '012180000000000002',
    'BBVA',
    'RUMM900202BB2'
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '014180000000000003',
    'Santander',
    'NUSF820303CC3'
  )
ON CONFLICT (profile_id) DO UPDATE
SET
  clabe = EXCLUDED.clabe,
  bank_name = EXCLUDED.bank_name,
  rfc = EXCLUDED.rfc,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Pets
-- ---------------------------------------------------------------------------
INSERT INTO public.pets (
  id,
  owner_id,
  name,
  species,
  breed,
  birth_date,
  weight,
  sex,
  weight_kg,
  is_neutered,
  vaccines_up_to_date,
  medical_notes,
  temperament,
  photo_url
)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '11111111-1111-4111-8111-111111111111',
    'Nala',
    'Perro',
    'Labrador mix',
    '2020-04-12',
    24.50,
    'hembra',
    24.50,
    true,
    'si',
    'Control de peso y alergia estacional leve.',
    'Sociable y tranquila',
    'https://images.unsplash.com/photo-1552053831-71594a27632d?w=900'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    '11111111-1111-4111-8111-111111111111',
    'Max',
    'Gato',
    'Europeo domestico',
    '2021-09-03',
    5.10,
    'macho',
    5.10,
    true,
    'si',
    'Sensibilidad digestiva a cambios bruscos de alimento.',
    'Curioso y jugueton',
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=900'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    '22222222-2222-4222-8222-222222222222',
    'Rocky',
    'Perro',
    'Border collie',
    '2019-01-20',
    18.20,
    'macho',
    18.20,
    true,
    'si',
    'Alta energia; requiere ejercicio diario.',
    'Activo e inteligente',
    'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=900'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    '22222222-2222-4222-8222-222222222222',
    'Lola',
    'Perro',
    'Pug',
    '2018-07-15',
    8.40,
    'hembra',
    8.40,
    true,
    'parcial',
    'Vigilar respiracion en calor y ejercicio intenso.',
    'Carinosa y dormilona',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=900'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
    '33333333-3333-4333-8333-333333333333',
    'Michi',
    'Gato',
    'Siames mix',
    '2022-02-11',
    4.30,
    'macho',
    4.30,
    false,
    'si',
    'Plan pendiente de esterilizacion.',
    'Timido al inicio',
    'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=900'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
    '33333333-3333-4333-8333-333333333333',
    'Mora',
    'Gato',
    'Carey',
    '2023-05-09',
    3.20,
    'hembra',
    3.20,
    false,
    'si',
    'Sin antecedentes medicos relevantes.',
    'Juguetona y vocal',
    'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=900'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
    '44444444-4444-4444-8444-444444444444',
    'Toby',
    'Perro',
    'Schnauzer senior',
    '2014-11-22',
    10.90,
    'macho',
    10.90,
    true,
    'si',
    'Seguimiento dental y articulaciones.',
    'Calmado y protector',
    'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=900'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8',
    '44444444-4444-4444-8444-444444444444',
    'Copito',
    'Conejo',
    'Mini lop',
    '2022-12-18',
    1.90,
    'macho',
    1.90,
    false,
    'no aplica',
    'Dieta alta en heno, revisar dientes.',
    'Nervioso con ruidos',
    'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=900'
  )
ON CONFLICT (id) DO UPDATE
SET
  owner_id = EXCLUDED.owner_id,
  name = EXCLUDED.name,
  species = EXCLUDED.species,
  breed = EXCLUDED.breed,
  birth_date = EXCLUDED.birth_date,
  weight = EXCLUDED.weight,
  sex = EXCLUDED.sex,
  weight_kg = EXCLUDED.weight_kg,
  is_neutered = EXCLUDED.is_neutered,
  vaccines_up_to_date = EXCLUDED.vaccines_up_to_date,
  medical_notes = EXCLUDED.medical_notes,
  temperament = EXCLUDED.temperament,
  photo_url = EXCLUDED.photo_url,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Appointments, emergencies, rewards and tracking
-- ---------------------------------------------------------------------------
INSERT INTO public.appointments (
  id,
  pet_id,
  owner_id,
  scheduled_at,
  status,
  appointment_type,
  reason,
  notes,
  vet_id,
  fee_mxn
)
VALUES
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '11111111-1111-4111-8111-111111111111',
    now() - interval '9 days',
    'completed',
    'Vacunacion',
    'Refuerzo anual',
    'Vacunacion anual y revision general.',
    '55555555-5555-4555-8555-555555555555',
    650.00
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    '11111111-1111-4111-8111-111111111111',
    now() + interval '2 days',
    'confirmed',
    'Nutricion',
    'Seguimiento digestivo',
    'Revision digestiva y ajuste de alimento.',
    '55555555-5555-4555-8555-555555555555',
    520.00
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    '22222222-2222-4222-8222-222222222222',
    now() - interval '4 days',
    'completed',
    'Curacion',
    'Lesion en almohadilla',
    'Curacion de almohadilla y control de actividad.',
    '66666666-6666-4666-8666-666666666666',
    780.00
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
    '33333333-3333-4333-8333-333333333333',
    now() + interval '5 days',
    'pending',
    'Esterilizacion',
    'Valoracion prequirurgica',
    'Valoracion para esterilizacion.',
    NULL,
    450.00
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
    '44444444-4444-4444-8444-444444444444',
    now() + interval '1 day',
    'confirmed',
    'Dental',
    'Revision senior',
    'Revision dental senior.',
    '77777777-7777-4777-8777-777777777777',
    700.00
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8',
    '44444444-4444-4444-8444-444444444444',
    now() - interval '15 days',
    'completed',
    'Dental',
    'Control dental exoticos',
    'Revision dental de conejo y recomendaciones de dieta.',
    '77777777-7777-4777-8777-777777777777',
    620.00
  )
ON CONFLICT (id) DO UPDATE
SET
  pet_id = EXCLUDED.pet_id,
  owner_id = EXCLUDED.owner_id,
  scheduled_at = EXCLUDED.scheduled_at,
  status = EXCLUDED.status,
  appointment_type = EXCLUDED.appointment_type,
  reason = EXCLUDED.reason,
  notes = EXCLUDED.notes,
  vet_id = EXCLUDED.vet_id,
  fee_mxn = EXCLUDED.fee_mxn,
  updated_at = now();

INSERT INTO public.emergencies (
  id,
  pet_id,
  symptoms,
  latitude,
  longitude,
  status,
  assigned_vet_id
)
VALUES
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    'Respiracion agitada despues del paseo y jadeo persistente.',
    19.4190,
    -99.1610,
    'dispatched',
    '66666666-6666-4666-8666-666666666666'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
    'Vomito recurrente y poca ingesta de agua desde la manana.',
    19.3915,
    -99.1550,
    'open',
    NULL
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
    'Dolor al caminar y rigidez en patas traseras.',
    19.3502,
    -99.1625,
    'closed',
    '77777777-7777-4777-8777-777777777777'
  )
ON CONFLICT (id) DO UPDATE
SET
  pet_id = EXCLUDED.pet_id,
  symptoms = EXCLUDED.symptoms,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  status = EXCLUDED.status,
  assigned_vet_id = EXCLUDED.assigned_vet_id,
  updated_at = now();

INSERT INTO public.rewards (
  owner_id,
  points,
  tier
)
VALUES
  ('11111111-1111-4111-8111-111111111111', 620, 'silver'),
  ('22222222-2222-4222-8222-222222222222', 280, 'bronze'),
  ('33333333-3333-4333-8333-333333333333', 120, 'bronze'),
  ('44444444-4444-4444-8444-444444444444', 1320, 'gold')
ON CONFLICT (owner_id) DO UPDATE
SET
  points = EXCLUDED.points,
  tier = EXCLUDED.tier,
  updated_at = now();

INSERT INTO public.triage_logs (
  id,
  pet_id,
  answers,
  urgency_level,
  recommendation
)
VALUES
  (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    '{"symptoms":["jadeo","cansancio"],"duration_hours":2,"temperature":"alta"}'::jsonb,
    'medio',
    'Mantener en sombra, ofrecer agua y solicitar valoracion si no mejora.'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
    '{"symptoms":["vomito","apatia"],"duration_hours":8,"water_intake":"baja"}'::jsonb,
    'alto',
    'Recomendacion de consulta el mismo dia para descartar deshidratacion.'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
    '{"symptoms":["dolor","cojera"],"duration_hours":12,"trauma":"no"}'::jsonb,
    'medio',
    'Reposo, evitar escaleras y agendar revision ortopedica.'
  )
ON CONFLICT (id) DO UPDATE
SET
  pet_id = EXCLUDED.pet_id,
  answers = EXCLUDED.answers,
  urgency_level = EXCLUDED.urgency_level,
  recommendation = EXCLUDED.recommendation;

INSERT INTO public.tracking_sessions (
  id,
  appointment_id,
  emergency_id,
  vet_lat,
  vet_lng,
  eta_minutes
)
VALUES
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    NULL,
    19.4308,
    -99.1890,
    18
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    NULL,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    19.3861,
    -99.1670,
    9
  )
ON CONFLICT (id) DO UPDATE
SET
  appointment_id = EXCLUDED.appointment_id,
  emergency_id = EXCLUDED.emergency_id,
  vet_lat = EXCLUDED.vet_lat,
  vet_lng = EXCLUDED.vet_lng,
  eta_minutes = EXCLUDED.eta_minutes,
  updated_at = now();

INSERT INTO public.reviews (
  id,
  reviewer_id,
  reviewee_id,
  appointment_id,
  rating,
  comment
)
VALUES
  (
    'ffffffff-ffff-4fff-8fff-fffffffffff1',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    5,
    'Explicacion clara, trato amable y seguimiento puntual.'
  ),
  (
    'ffffffff-ffff-4fff-8fff-fffffffffff2',
    '22222222-2222-4222-8222-222222222222',
    '66666666-6666-4666-8666-666666666666',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    5,
    'Llego rapido y Rocky mejoro mucho con las indicaciones.'
  ),
  (
    'ffffffff-ffff-4fff-8fff-fffffffffff3',
    '44444444-4444-4444-8444-444444444444',
    '77777777-7777-4777-8777-777777777777',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6',
    4,
    'Muy buena consulta para Copito, nos dio un plan claro.'
  )
ON CONFLICT (id) DO UPDATE
SET
  reviewer_id = EXCLUDED.reviewer_id,
  reviewee_id = EXCLUDED.reviewee_id,
  appointment_id = EXCLUDED.appointment_id,
  rating = EXCLUDED.rating,
  comment = EXCLUDED.comment;

-- ---------------------------------------------------------------------------
-- Social graph
-- ---------------------------------------------------------------------------
INSERT INTO public.follows (follower_id, following_id)
VALUES
  ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555'),
  ('11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666'),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'),
  ('22222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666'),
  ('22222222-2222-4222-8222-222222222222', '77777777-7777-4777-8777-777777777777'),
  ('33333333-3333-4333-8333-333333333333', '55555555-5555-4555-8555-555555555555'),
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111'),
  ('44444444-4444-4444-8444-444444444444', '77777777-7777-4777-8777-777777777777'),
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222'),
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111'),
  ('66666666-6666-4666-8666-666666666666', '22222222-2222-4222-8222-222222222222'),
  ('77777777-7777-4777-8777-777777777777', '44444444-4444-4444-8444-444444444444'),
  ('88888888-8888-4888-8888-888888888888', '55555555-5555-4555-8555-555555555555')
ON CONFLICT (follower_id, following_id) DO NOTHING;

INSERT INTO public.posts (
  id,
  author_id,
  body,
  image_urls,
  created_at
)
VALUES
  (
    '99999999-9999-4999-8999-999999999901',
    '11111111-1111-4111-8111-111111111111',
    'Nala termino su vacuna anual y se porto increible. Agenda al dia.',
    ARRAY['https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=900']::text[],
    now() - interval '3 days'
  ),
  (
    '99999999-9999-4999-8999-999999999902',
    '11111111-1111-4111-8111-111111111111',
    'Max esta probando alimento nuevo. Voy cambiando la mezcla poco a poco.',
    '{}'::text[],
    now() - interval '1 day 5 hours'
  ),
  (
    '99999999-9999-4999-8999-999999999903',
    '22222222-2222-4222-8222-222222222222',
    'Rocky aprendio a caminar sin jalar. Paciencia, premio y paseos cortos.',
    ARRAY['https://images.unsplash.com/photo-1558788353-f76d92427f16?w=900']::text[],
    now() - interval '2 days 6 hours'
  ),
  (
    '99999999-9999-4999-8999-999999999904',
    '33333333-3333-4333-8333-333333333333',
    'Michi descubrio la fuente de agua y por fin toma mas. Pequenas victorias.',
    ARRAY['https://images.unsplash.com/photo-1574158622682-e40e69881006?w=900']::text[],
    now() - interval '20 hours'
  ),
  (
    '99999999-9999-4999-8999-999999999905',
    '44444444-4444-4444-8444-444444444444',
    'Toby tiene revision dental manana. Los seniors necesitan mas rutina.',
    '{}'::text[],
    now() - interval '16 hours'
  ),
  (
    '99999999-9999-4999-8999-999999999906',
    '55555555-5555-4555-8555-555555555555',
    'Tip vet: si cambias alimento, haz transicion de 7 a 10 dias para evitar malestar.',
    '{}'::text[],
    now() - interval '4 days'
  ),
  (
    '99999999-9999-4999-8999-999999999907',
    '55555555-5555-4555-8555-555555555555',
    'Vacunacion al dia protege tambien a la comunidad. Revisa cartilla cada ano.',
    '{}'::text[],
    now() - interval '10 hours'
  ),
  (
    '99999999-9999-4999-8999-999999999908',
    '66666666-6666-4666-8666-666666666666',
    'Urgencias: encia palida, dificultad para respirar o colapso requieren atencion inmediata.',
    '{}'::text[],
    now() - interval '2 days'
  ),
  (
    '99999999-9999-4999-8999-999999999909',
    '77777777-7777-4777-8777-777777777777',
    'Picazon constante no siempre es pulga. Puede ser alergia, piel seca o infeccion.',
    '{}'::text[],
    now() - interval '8 hours'
  ),
  (
    '99999999-9999-4999-8999-999999999910',
    '88888888-8888-4888-8888-888888888888',
    'Bienvenidos al feed demo de Vetgo. Sigan perfiles, comenten y prueben reposts.',
    '{}'::text[],
    now() - interval '6 hours'
  )
ON CONFLICT (id) DO UPDATE
SET
  author_id = EXCLUDED.author_id,
  body = EXCLUDED.body,
  image_urls = EXCLUDED.image_urls,
  created_at = EXCLUDED.created_at;

INSERT INTO public.post_likes (post_id, user_id)
VALUES
  ('99999999-9999-4999-8999-999999999901', '33333333-3333-4333-8333-333333333333'),
  ('99999999-9999-4999-8999-999999999901', '55555555-5555-4555-8555-555555555555'),
  ('99999999-9999-4999-8999-999999999902', '55555555-5555-4555-8555-555555555555'),
  ('99999999-9999-4999-8999-999999999903', '11111111-1111-4111-8111-111111111111'),
  ('99999999-9999-4999-8999-999999999903', '66666666-6666-4666-8666-666666666666'),
  ('99999999-9999-4999-8999-999999999904', '11111111-1111-4111-8111-111111111111'),
  ('99999999-9999-4999-8999-999999999904', '77777777-7777-4777-8777-777777777777'),
  ('99999999-9999-4999-8999-999999999905', '22222222-2222-4222-8222-222222222222'),
  ('99999999-9999-4999-8999-999999999906', '11111111-1111-4111-8111-111111111111'),
  ('99999999-9999-4999-8999-999999999906', '22222222-2222-4222-8222-222222222222'),
  ('99999999-9999-4999-8999-999999999907', '33333333-3333-4333-8333-333333333333'),
  ('99999999-9999-4999-8999-999999999908', '44444444-4444-4444-8444-444444444444'),
  ('99999999-9999-4999-8999-999999999909', '22222222-2222-4222-8222-222222222222'),
  ('99999999-9999-4999-8999-999999999910', '11111111-1111-4111-8111-111111111111'),
  ('99999999-9999-4999-8999-999999999910', '55555555-5555-4555-8555-555555555555')
ON CONFLICT (post_id, user_id) DO NOTHING;

INSERT INTO public.post_comments (
  id,
  post_id,
  author_id,
  body,
  created_at
)
VALUES
  (
    '12121212-1212-4212-8212-121212121201',
    '99999999-9999-4999-8999-999999999901',
    '55555555-5555-4555-8555-555555555555',
    'Excelente. Mantener cartilla actualizada ayuda muchisimo.',
    now() - interval '2 days 23 hours'
  ),
  (
    '12121212-1212-4212-8212-121212121202',
    '99999999-9999-4999-8999-999999999903',
    '11111111-1111-4111-8111-111111111111',
    'Que buen avance. Me sirve para practicar con Nala.',
    now() - interval '2 days'
  ),
  (
    '12121212-1212-4212-8212-121212121203',
    '99999999-9999-4999-8999-999999999904',
    '77777777-7777-4777-8777-777777777777',
    'Buena idea. La hidratacion en gatos cambia mucho con fuentes.',
    now() - interval '18 hours'
  ),
  (
    '12121212-1212-4212-8212-121212121204',
    '99999999-9999-4999-8999-999999999908',
    '44444444-4444-4444-8444-444444444444',
    'Gracias por la lista, la voy a guardar para emergencias.',
    now() - interval '1 day 20 hours'
  ),
  (
    '12121212-1212-4212-8212-121212121205',
    '99999999-9999-4999-8999-999999999909',
    '22222222-2222-4222-8222-222222222222',
    'Lola se rasca seguido, agendare revision de piel.',
    now() - interval '7 hours'
  ),
  (
    '12121212-1212-4212-8212-121212121206',
    '99999999-9999-4999-8999-999999999910',
    '55555555-5555-4555-8555-555555555555',
    'Listos para probar el feed con casos reales demo.',
    now() - interval '5 hours'
  )
ON CONFLICT (id) DO UPDATE
SET
  post_id = EXCLUDED.post_id,
  author_id = EXCLUDED.author_id,
  body = EXCLUDED.body,
  created_at = EXCLUDED.created_at;

INSERT INTO public.post_reposts (
  id,
  reposter_id,
  original_post_id,
  quote_body,
  created_at
)
VALUES
  (
    '13131313-1313-4313-8313-131313131301',
    '11111111-1111-4111-8111-111111111111',
    '99999999-9999-4999-8999-999999999906',
    'Esto me sirvio con Max.',
    now() - interval '23 hours'
  ),
  (
    '13131313-1313-4313-8313-131313131302',
    '22222222-2222-4222-8222-222222222222',
    '99999999-9999-4999-8999-999999999908',
    'Informacion clave para tener a mano.',
    now() - interval '1 day 10 hours'
  ),
  (
    '13131313-1313-4313-8313-131313131303',
    '33333333-3333-4333-8333-333333333333',
    '99999999-9999-4999-8999-999999999907',
    NULL,
    now() - interval '9 hours'
  ),
  (
    '13131313-1313-4313-8313-131313131304',
    '88888888-8888-4888-8888-888888888888',
    '99999999-9999-4999-8999-999999999909',
    'Tema frecuente para la comunidad.',
    now() - interval '4 hours'
  )
ON CONFLICT (reposter_id, original_post_id) DO UPDATE
SET
  quote_body = EXCLUDED.quote_body,
  created_at = EXCLUDED.created_at;
