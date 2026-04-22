const { createClient } = require('@supabase/supabase-js');
const { supabaseAnon } = require('../lib/supabaseAnon');
const { createSupabaseClientWithJwt } = require('../lib/supabaseUserClient');
const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

/**
 * La API recibe `client` / `vet`, pero en BD (profiles.role) el rol cliente es `owner`.
 */
function mapApiRoleToDbRole(role) {
  return role === 'vet' ? 'vet' : 'owner';
}

function parseBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim() || null;
}

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

function userPayload(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
  };
}

async function updateAndReadProfile(userId, profileUpdates, accessToken) {
  const jwtClient = accessToken ? createSupabaseClientWithJwt(accessToken) : null;

  if (jwtClient) {
    const updateResult = await jwtClient.from('profiles').update(profileUpdates).eq('id', userId).select().maybeSingle();
    if (!updateResult.error && updateResult.data) {
      return { data: updateResult.data, source: 'jwt' };
    }
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const { data, error } = await serviceClient
    .from('profiles')
    .update(profileUpdates)
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return { data, source: 'service_role' };
}

async function signup(req, res) {
  try {
    const { email, password, full_name, phone, role } = req.body;

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, phone, role },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!data?.user) {
      return res.status(400).json({ error: 'Sign up failed: user was not created' });
    }

    const profileUpdates = {
      full_name,
      phone,
      role: mapApiRoleToDbRole(role),
    };

    const profileResult = await updateAndReadProfile(
      data.user.id,
      profileUpdates,
      data.session?.access_token,
    );

    return res.status(201).json({
      user: userPayload(data.user),
      session: sessionPayload(data.session),
      profile: profileResult.data,
      profile_source: profileResult.source,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to sign up user', details: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: error.message, details: error });
    }

    if (!data?.session || !data?.user) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    let profile = null;
    const userClient = createSupabaseClientWithJwt(data.session.access_token);
    const { data: profileData, error: profileError } = await userClient
      .from('profiles')
      .select('id, role, full_name, phone')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      return res.status(400).json({ error: profileError.message, details: profileError });
    }

    profile = profileData ?? null;

    return res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: userPayload(data.user),
      profile,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to login user', details: err.message });
  }
}

async function logout(req, res) {
  try {
    const accessToken = parseBearerToken(req);
    const { refresh_token: refreshToken } = req.body;

    if (!accessToken) {
      return res.status(401).json({ error: 'Authorization Bearer token is required' });
    }

    if (!url || !anonKey) {
      return res.status(500).json({ error: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set' });
    }

    const authClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { error: setSessionError } = await authClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (setSessionError) {
      return res.status(401).json({ error: setSessionError.message, details: setSessionError });
    }

    const { error } = await authClient.auth.signOut({ scope: 'global' });

    if (error) {
      return res.status(401).json({ error: error.message, details: error });
    }

    return res.json({ message: 'Logout successful' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to logout user', details: err.message });
  }
}

module.exports = { signup, login, logout };
