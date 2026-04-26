const { supabaseAnon } = require('../lib/supabaseAnon');
const { createSupabaseClientWithJwt } = require('../lib/supabaseUserClient');
const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');

const DEFAULT_PROFILE_FLAGS = {
  is_verified: false,
  onboarding_completed: false,
};

function sessionPayload(session) {
  if (!session) {
    return null;
  }

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    token_type: session.token_type,
  };
}

function userPayload(user, profile) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    phone: profile?.phone ?? user.phone ?? null,
    role: profile?.role ?? null,
    is_verified: profile?.is_verified ?? false,
    onboarding_completed: profile?.onboarding_completed ?? false,
  };
}

function getServiceClient() {
  return createSupabaseServiceRoleClient();
}

async function upsertProfileWithServiceRole(userId, updates) {
  const serviceClient = createSupabaseServiceRoleClient();
  const payload = {
    id: userId,
    ...DEFAULT_PROFILE_FLAGS,
    ...updates,
  };

  const { data, error } = await serviceClient.from('profiles').upsert(payload).select().maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

async function fetchProfileByUserWithJwt(userId, accessToken) {
  const userClient = createSupabaseClientWithJwt(accessToken);
  const { data, error } = await userClient
    .from('profiles')
    .select('id, role, full_name, phone, is_verified, onboarding_completed')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

async function fetchProfileByUserWithServiceRole(userId) {
  const serviceClient = getServiceClient();
  const { data, error } = await serviceClient
    .from('profiles')
    .select('id, role, full_name, phone, is_verified, onboarding_completed')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

function isEmailRateLimitError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  if (
    msg.includes('email rate limit') ||
    msg.includes('rate limit exceeded') ||
    msg.includes('over_email_send_rate_limit') ||
    msg.includes('over email send rate limit')
  ) {
    return true;
  }
  // Supabase suele responder 429 cuando excede la cuota.
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
    return true;
  }
  return false;
}

const RATE_LIMIT_MESSAGE =
  'Has pedido demasiados códigos seguidos. Espera unos minutos antes de intentarlo de nuevo o usa el último código que recibiste.';

async function findAuthUserByEmail(email) {
  const serviceClient = createSupabaseServiceRoleClient();
  const target = (email || '').toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const match = users.find((u) => (u.email || '').toLowerCase() === target);
    if (match) {
      return match;
    }
    if (users.length < perPage) {
      return null;
    }
    page += 1;
    if (page > 25) {
      return null;
    }
  }
}

async function register(req, res) {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
    });

    // Caso A: Supabase devuelve un error explícito de "ya registrado".
    if (error) {
      // Rate limit del SMTP de Supabase.
      if (isEmailRateLimitError(error)) {
        return res.status(429).json({
          error: RATE_LIMIT_MESSAGE,
          code: 'EMAIL_RATE_LIMIT',
        });
      }

      const message = (error.message || '').toLowerCase();
      const looksAlreadyRegistered =
        message.includes('already registered') ||
        message.includes('already exists') ||
        message.includes('user already');

      if (!looksAlreadyRegistered) {
        return res.status(400).json({ error: error.message });
      }

      let existing = null;
      try {
        existing = await findAuthUserByEmail(email);
      } catch (lookupErr) {
        return res.status(400).json({ error: error.message, details: lookupErr.message });
      }

      if (!existing) {
        return res.status(400).json({ error: error.message });
      }

      if (existing.email_confirmed_at) {
        return res.status(409).json({
          error: 'Este correo ya está registrado. Inicia sesión.',
          code: 'EMAIL_ALREADY_VERIFIED',
        });
      }

      // El correo ya existe pero no está verificado. NO reenviamos OTP automáticamente
      // para no agotar la cuota del SMTP. El cliente puede usar el código que ya recibió
      // o pedir un reenvío explícito desde la pantalla de OTP.
      return res.status(200).json({
        verification_required: true,
        already_registered: true,
        resent: false,
        user: {
          id: existing.id,
          email: existing.email,
        },
      });
    }

    if (!data?.user) {
      return res.status(400).json({ error: 'Register failed: user was not created' });
    }

    // Caso B: signUp aparentemente OK, pero Supabase oculta usuarios verificados.
    // Si identities = [] y email_confirmed_at != null => el correo ya estaba verificado.
    const identities = data.user.identities ?? [];
    const isAlreadyConfirmed = !!data.user.email_confirmed_at;

    if (identities.length === 0 && isAlreadyConfirmed) {
      return res.status(409).json({
        error: 'Este correo ya está registrado. Inicia sesión.',
        code: 'EMAIL_ALREADY_VERIFIED',
      });
    }

    const alreadyRegisteredButUnverified =
      identities.length === 0 && !isAlreadyConfirmed;

    const profile = await upsertProfileWithServiceRole(data.user.id, {
      role: 'client',
      ...DEFAULT_PROFILE_FLAGS,
    });

    return res.status(201).json({
      verification_required: true,
      already_registered: alreadyRegisteredButUnverified,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      profile: profile ?? {
        id: data.user.id,
        role: 'client',
        ...DEFAULT_PROFILE_FLAGS,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to register user', details: err.message });
  }
}

async function verifyOtp(req, res) {
  try {
    const { email, token } = req.body;
    const { data, error } = await supabaseAnon.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data?.user) {
      return res.status(400).json({ error: 'OTP verification failed: user not found' });
    }

    await upsertProfileWithServiceRole(data.user.id, {
      is_verified: true,
    });

    let profile = null;
    if (data.session?.access_token) {
      profile = await fetchProfileByUserWithJwt(data.user.id, data.session.access_token);
    } else {
      profile = await fetchProfileByUserWithServiceRole(data.user.id);
    }

    return res.json({
      access_token: data.session?.access_token ?? null,
      refresh_token: data.session?.refresh_token ?? null,
      expires_in: data.session?.expires_in ?? null,
      token_type: data.session?.token_type ?? null,
      user: userPayload(data.user, profile),
      profile,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify OTP', details: err.message });
  }
}

async function completeOnboarding(req, res) {
  try {
    const { role, full_name, phone, avatar_url } = req.body;
    const userId = req.user.id;

    const { data: profile, error: profileError } = await req.supabase
      .from('profiles')
      .update({
        role,
        full_name,
        phone,
        avatar_url: avatar_url || null,
        onboarding_completed: true,
      })
      .eq('id', userId)
      .select('id, role, full_name, phone, avatar_url, is_verified, onboarding_completed')
      .maybeSingle();

    if (profileError) {
      return res.status(400).json({ error: profileError.message, details: profileError });
    }

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found for onboarding' });
    }

    let details = null;

    if (role === 'client') {
      const { client_details, pet_profile } = req.body;

      const { data: clientDetailsData, error: clientDetailsError } = await req.supabase
        .from('client_details')
        .upsert({
          profile_id: userId,
          address_text: client_details.address_text,
          address_notes: client_details.address_notes || null,
          latitude: client_details.latitude ?? null,
          longitude: client_details.longitude ?? null,
        })
        .select('*')
        .maybeSingle();

      if (clientDetailsError) {
        return res.status(400).json({ error: clientDetailsError.message, details: clientDetailsError });
      }

      const petInsert = {
        owner_id: userId,
        name: pet_profile.name,
        species: pet_profile.species,
        breed: pet_profile.breed || null,
        sex: pet_profile.sex,
        birth_date: pet_profile.birth_date || null,
        weight: pet_profile.weight_kg ?? null,
        weight_kg: pet_profile.weight_kg ?? null,
        is_neutered: pet_profile.is_neutered,
        vaccines_up_to_date: pet_profile.vaccines_up_to_date,
        medical_notes: pet_profile.medical_notes || null,
        temperament: pet_profile.temperament,
      };

      const { data: petData, error: petError } = await req.supabase.from('pets').insert(petInsert).select('*').single();

      if (petError) {
        return res.status(400).json({ error: petError.message, details: petError });
      }

      details = {
        client_details: clientDetailsData,
        pet_profile: petData,
      };
    }

    if (role === 'vet') {
      const { vet_details, vet_services, vet_finances } = req.body;

      const { data: vetDetailsData, error: vetDetailsError } = await req.supabase
        .from('vet_details')
        .upsert({
          profile_id: userId,
          cedula: vet_details.cedula,
          university: vet_details.university || null,
          experience_years: vet_details.experience_years,
          base_latitude: vet_details.base_latitude ?? null,
          base_longitude: vet_details.base_longitude ?? null,
          coverage_radius_km: vet_details.coverage_radius_km,
          has_vehicle: vet_details.has_vehicle,
        })
        .select('*')
        .maybeSingle();

      if (vetDetailsError) {
        return res.status(400).json({ error: vetDetailsError.message, details: vetDetailsError });
      }

      const { data: vetServicesData, error: vetServicesError } = await req.supabase
        .from('vet_services')
        .upsert({
          profile_id: userId,
          specialty: vet_services.specialty,
          offered_services: vet_services.offered_services,
          accepts_emergencies: vet_services.accepts_emergencies,
          schedule_json: vet_services.schedule_json,
        })
        .select('*')
        .maybeSingle();

      if (vetServicesError) {
        return res.status(400).json({ error: vetServicesError.message, details: vetServicesError });
      }

      const { data: vetFinancesData, error: vetFinancesError } = await req.supabase
        .from('vet_finances')
        .upsert({
          profile_id: userId,
          clabe: vet_finances.clabe,
          bank_name: vet_finances.bank_name,
          rfc: vet_finances.rfc || null,
        })
        .select('*')
        .maybeSingle();

      if (vetFinancesError) {
        return res.status(400).json({ error: vetFinancesError.message, details: vetFinancesError });
      }

      details = {
        vet_details: vetDetailsData,
        vet_services: vetServicesData,
        vet_finances: vetFinancesData,
      };
    }

    return res.json({
      message: 'Onboarding completed',
      profile,
      details,
      user: userPayload(req.user, profile),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to complete onboarding', details: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) {
      const message = (error.message || '').toLowerCase();
      const emailNotConfirmed =
        message.includes('email not confirmed') ||
        message.includes('not confirmed') ||
        message.includes('email_not_confirmed');

      if (emailNotConfirmed) {
        // Avisamos al cliente para que vaya a la pantalla de OTP. El reenvío
        // se hace solo si el usuario lo solicita explícitamente (desde OtpScreen).
        return res.status(403).json({
          error:
            'Tu correo no está verificado. Ingresa el código que te enviamos o pide uno nuevo.',
          code: 'EMAIL_NOT_CONFIRMED',
          verification_required: true,
          resent: false,
          user: { email },
        });
      }

      if (isEmailRateLimitError(error)) {
        return res.status(429).json({
          error: RATE_LIMIT_MESSAGE,
          code: 'EMAIL_RATE_LIMIT',
        });
      }

      return res.status(401).json({ error: error.message });
    }

    if (!data?.session || !data?.user) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    const profile = await fetchProfileByUserWithJwt(data.user.id, data.session.access_token);

    return res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: userPayload(data.user, profile),
      profile,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to login user', details: err.message });
  }
}

async function signup(req, res) {
  // Legacy alias while frontend migrates to /register.
  return register(req, res);
}

async function logout(req, res) {
  try {
    const { error } = await req.supabase.auth.signOut({ scope: 'global' });

    if (error) {
      return res.status(401).json({ error: error.message, details: error });
    }

    return res.json({ message: 'Logout successful' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to logout user', details: err.message });
  }
}

async function resendOtp(req, res) {
  try {
    const { email } = req.body;

    const { error } = await supabaseAnon.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      if (isEmailRateLimitError(error)) {
        return res.status(429).json({
          error: RATE_LIMIT_MESSAGE,
          code: 'EMAIL_RATE_LIMIT',
        });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      message: 'Verification code resent',
      resent: true,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resend OTP', details: err.message });
  }
}

module.exports = { register, verifyOtp, resendOtp, completeOnboarding, login, signup, logout };
