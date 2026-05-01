const crypto = require('crypto');
const { supabaseAnon } = require('../lib/supabaseAnon');
const { safeBasename } = require('../lib/safeBasename');
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
    .select('id, role, full_name, phone, avatar_url, is_verified, onboarding_completed')
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
    .select('id, role, full_name, phone, avatar_url, is_verified, onboarding_completed')
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
  'El servicio de correo del proyecto está saturado momentáneamente y no pudo enviar el código. Esto pasa con cualquier correo, no solo con el tuyo. Intenta de nuevo en unos minutos.';

const OTP_TTL_MS = 15 * 60 * 1000;
const otpStore = new Map();
const pendingLoginPasswordStore = new Map();
/** Contraseña del flujo /register guardada hasta verificar correo (para reenvíos OTP con sesión). */
const pendingRegistrationPasswordStore = new Map();

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function generateOtpCode(length = 6) {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(length, '0');
}

function otpExpiryLabel(date) {
  try {
    return date.toLocaleString('es-MX', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date.toISOString();
  }
}

function saveOtp(email, code, bootstrapPassword = null) {
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  otpStore.set(normalizeEmail(email), {
    code,
    expiresAtMs: expiresAt.getTime(),
    bootstrapPassword: bootstrapPassword || null,
  });
  return expiresAt;
}

function verifyStoredOtp(email, code) {
  const key = normalizeEmail(email);
  const entry = otpStore.get(key);
  if (!entry) return { ok: false, reason: 'not_found' };
  if (Date.now() > entry.expiresAtMs) {
    otpStore.delete(key);
    return { ok: false, reason: 'expired' };
  }
  if (String(code).trim() !== entry.code) {
    return { ok: false, reason: 'invalid' };
  }
  otpStore.delete(key);
  return { ok: true, bootstrapPassword: entry.bootstrapPassword ?? null };
}

function savePendingLoginPassword(email, password) {
  pendingLoginPasswordStore.set(normalizeEmail(email), {
    password,
    expiresAtMs: Date.now() + OTP_TTL_MS,
  });
}

function getPendingLoginPassword(email) {
  const key = normalizeEmail(email);
  const entry = pendingLoginPasswordStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtMs) {
    pendingLoginPasswordStore.delete(key);
    return null;
  }
  return entry.password;
}

function clearPendingLoginPassword(email) {
  pendingLoginPasswordStore.delete(normalizeEmail(email));
}

function savePendingRegistrationPassword(email, password) {
  if (!password || typeof password !== 'string') return;
  pendingRegistrationPasswordStore.set(normalizeEmail(email), {
    password,
    expiresAtMs: Date.now() + OTP_TTL_MS,
  });
}

function getPendingRegistrationPassword(email) {
  const key = normalizeEmail(email);
  const entry = pendingRegistrationPasswordStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtMs) {
    pendingRegistrationPasswordStore.delete(key);
    return null;
  }
  return entry.password;
}

function clearPendingRegistrationPassword(email) {
  pendingRegistrationPasswordStore.delete(normalizeEmail(email));
}

async function sendOtpWithEmailJs(email, code, expiresAt) {
  const serviceId = process.env.EMAIL_SERVICE;
  const publicKey = process.env.EMAIL_KEY;
  const privateKey = process.env.EMAIL_SECRET;
  const templateId = process.env.EMAIL_TEMPLATE;
  if (!serviceId || !publicKey || !privateKey || !templateId) {
    throw new Error('Email provider is not configured (EMAIL_SERVICE/EMAIL_KEY/EMAIL_SECRET/EMAIL_TEMPLATE).');
  }

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        email,
        passcode: code,
        time: otpExpiryLabel(expiresAt),
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('[otp][emailjs] send failed', {
      status: response.status,
      email,
      templateId,
      serviceId,
      details: details || null,
    });
    throw new Error(`Email provider rejected OTP send (${response.status}): ${details || 'unknown error'}`);
  }

  console.log('[otp][emailjs] sent', {
    email,
    templateId,
    serviceId,
    expiresAt: expiresAt.toISOString(),
  });
}

async function issueAndSendOtp(email, bootstrapPassword = null) {
  const code = generateOtpCode(6);
  const fallbackPassword =
    bootstrapPassword || getPendingRegistrationPassword(email) || getPendingLoginPassword(email);
  const expiresAt = saveOtp(email, code, fallbackPassword);
  if (fallbackPassword) {
    savePendingRegistrationPassword(normalizeEmail(email), fallbackPassword);
  }
  await sendOtpWithEmailJs(email, code, expiresAt);
  return expiresAt;
}

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
    const serviceClient = createSupabaseServiceRoleClient();
    const normalized = normalizeEmail(email);

    let existing = await findAuthUserByEmail(normalized);
    if (existing?.email_confirmed_at) {
      return res.status(409).json({
        error: 'Este correo ya está registrado. Inicia sesión.',
        code: 'EMAIL_ALREADY_VERIFIED',
      });
    }

    let user = existing;
    if (!user) {
      const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
        email: normalized,
        password,
        email_confirm: false,
      });
      if (createError || !created?.user) {
        return res.status(400).json({ error: createError?.message || 'Register failed: user was not created' });
      }
      user = created.user;
    } else {
      const { error: updateError } = await serviceClient.auth.admin.updateUserById(user.id, {
        password,
      });
      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }
    }

    const profile = await upsertProfileWithServiceRole(user.id, {
      role: 'client',
      ...DEFAULT_PROFILE_FLAGS,
    });

    try {
      savePendingRegistrationPassword(normalized, password);
      await issueAndSendOtp(normalized, password);
    } catch (mailErr) {
      console.error('[otp][register] failed to send OTP', {
        email: normalized,
        error: mailErr.message,
      });
      return res.status(500).json({
        error: 'No se pudo enviar el código de verificación',
        details: mailErr.message,
      });
    }

    return res.status(201).json({
      verification_required: true,
      already_registered: !!existing,
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profile ?? {
        id: user.id,
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
    const check = verifyStoredOtp(email, token);
    if (!check.ok) {
      console.warn('[otp][verify] invalid attempt', {
        email: normalizeEmail(email),
        reason: check.reason,
      });
      const message =
        check.reason === 'expired'
          ? 'El código expiró. Solicita uno nuevo.'
          : check.reason === 'not_found'
            ? 'Ese código ya no es válido (quizá expiró o el servidor se reinició). Pulsa «Reenviar código».'
            : 'Código incorrecto.';
      return res.status(400).json({ error: message });
    }

    const existing = await findAuthUserByEmail(email);
    if (!existing) {
      return res.status(400).json({ error: 'OTP verification failed: user not found' });
    }

    const serviceClient = createSupabaseServiceRoleClient();
    const { error: confirmError } = await serviceClient.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
    });
    if (confirmError) {
      return res.status(400).json({ error: confirmError.message });
    }

    await upsertProfileWithServiceRole(existing.id, {
      is_verified: true,
    });

    let session = null;
    let userForPayload = existing;
    if (check.bootstrapPassword) {
      const { data: signinData, error: signinError } = await supabaseAnon.auth.signInWithPassword({
        email: normalizeEmail(email),
        password: check.bootstrapPassword,
      });
      if (!signinError && signinData?.session && signinData?.user) {
        session = signinData.session;
        userForPayload = signinData.user;
      }
    }
    if (!session && check.bootstrapPassword) {
      console.warn('[otp][verify] Supabase signIn failed after valid OTP', {
        email: normalizeEmail(email),
      });
    }
    if (!session && !check.bootstrapPassword) {
      console.warn('[otp][verify] no bootstrap password; client must login manually', {
        email: normalizeEmail(email),
      });
    }
    clearPendingLoginPassword(email);
    clearPendingRegistrationPassword(email);

    const profile = session?.access_token
      ? await fetchProfileByUserWithJwt(existing.id, session.access_token)
      : await fetchProfileByUserWithServiceRole(existing.id);

    return res.json({
      access_token: session?.access_token ?? null,
      refresh_token: session?.refresh_token ?? null,
      expires_in: session?.expires_in ?? null,
      token_type: session?.token_type ?? null,
      user: userPayload(userForPayload, profile),
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

async function refreshSession(req, res) {
  try {
    const { refresh_token: refreshToken } = req.body;

    const { data, error } = await supabaseAnon.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    if (!data?.session || !data?.user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
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
    return res.status(500).json({ error: 'Failed to refresh session', details: err.message });
  }
}

/**
 * Sube foto de perfil a Storage (bucket vetgo-images, carpeta = auth.uid) y actualiza profiles.avatar_url.
 * Multipart campo `photo` (misma regla que mascotas).
 */
async function uploadProfileAvatar(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'photo file is required (multipart field name: photo)' });
    }

    const userId = req.user.id;
    const objectPath = `${userId}/profile/${Date.now()}-${safeBasename(req.file.originalname)}`;

    const { error: uploadError } = await req.supabase.storage.from('vetgo-images').upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true,
    });

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message, details: uploadError });
    }

    const {
      data: { publicUrl },
    } = req.supabase.storage.from('vetgo-images').getPublicUrl(objectPath);

    const { data, error } = await req.supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)
      .select('id, role, full_name, phone, avatar_url, is_verified, onboarding_completed')
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to upload profile photo', details: err.message });
  }
}

async function me(req, res) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const profile = await fetchProfileByUserWithJwt(req.user.id, token);

    return res.json({
      user: userPayload(req.user, profile),
      profile,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load session', details: err.message });
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
        savePendingLoginPassword(email, password);
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
    const profileVerified = profile?.is_verified ?? false;
    if (!profileVerified) {
      return res.status(403).json({
        error: 'Tu correo no está verificado. Ingresa el código que te enviamos o pide uno nuevo.',
        code: 'EMAIL_NOT_CONFIRMED',
        verification_required: true,
        resent: false,
        user: { email },
      });
    }

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
    const normalized = normalizeEmail(email);
    const existing = await findAuthUserByEmail(normalized);
    if (!existing) {
      return res.status(404).json({ error: 'No existe una cuenta con ese correo.' });
    }
    if (existing.email_confirmed_at) {
      return res.status(409).json({
        error: 'Este correo ya está verificado. Inicia sesión.',
        code: 'EMAIL_ALREADY_VERIFIED',
      });
    }

    try {
      await issueAndSendOtp(normalized);
    } catch (mailErr) {
      console.error('[otp][resend] failed to send OTP', {
        email: normalized,
        error: mailErr.message,
      });
      return res.status(500).json({
        error: 'No se pudo reenviar el código de verificación',
        details: mailErr.message,
      });
    }

    return res.json({
      message: 'Verification code resent',
      resent: true,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resend OTP', details: err.message });
  }
}

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  completeOnboarding,
  login,
  signup,
  logout,
  refreshSession,
  me,
  uploadProfileAvatar,
};
