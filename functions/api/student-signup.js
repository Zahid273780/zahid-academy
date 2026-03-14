import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createUserWithRetry(admin, email, password, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (!error) return { data, error: null };

    const msg = (error.message || '').toLowerCase();
    const isRetryable = msg.includes('rate') || msg.includes('limit') ||
      msg.includes('too many') || msg.includes('timeout') || msg.includes('503');

    if (!isRetryable || attempt === maxRetries) return { data, error };

    await sleep(attempt * 1000);
  }
}

export async function onRequest(context) {
  const req = context.request;
  const env = context.env;

  if (req.method === 'OPTIONS' || req.method === 'GET') {
    return new Response(req.method === 'OPTIONS' ? 'ok' : JSON.stringify({ message: 'Student signup: send POST with name, username, class, whatsapp, mobile, password' }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const name = (body.name || '').trim();
  let username = (body.username || '').trim();
  const classVal = (body.class || '').trim();
  const whatsapp = (body.whatsapp || '').replace(/\D/g, '');
  const mobile = (body.mobile || '').replace(/\D/g, '');
  const password = (body.password || '').trim();

  if (!name || !username || !classVal || !password) {
    return json({ error: 'Name, username, class and password are required' }, 400);
  }
  if (/\d/.test(name)) {
    return json({ error: 'Full name must contain only letters and spaces, no numbers' }, 400);
  }
  if (username.includes('@')) {
    return json({ error: 'Enter username only (e.g. ali123), not an email' }, 400);
  }
  if (whatsapp.length !== 11) {
    return json({ error: 'WhatsApp number must be exactly 11 digits (e.g. 03337502737)' }, 400);
  }
  if (mobile.length !== 11) {
    return json({ error: 'Mobile number must be exactly 11 digits (e.g. 03337502737)' }, 400);
  }
  if (password.length < 4) {
    return json({ error: 'Password must be at least 4 characters' }, 400);
  }

  const email = `${username}@shaeenacademy.com`;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing } = await admin.from('users').select('id').eq('email', email).limit(1).maybeSingle();
  if (existing) {
    return json({ error: 'This username/email is already registered. Use Student Login or contact your teacher.' }, 409);
  }

  const { data: authUser, error: createError } = await createUserWithRetry(admin, email, password);

  if (createError) {
    const msg = (createError.message || '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered')) {
      return json({ error: 'This username is already registered. Use Student Login or contact your teacher.' }, 409);
    }
    if (msg.includes('rate') || msg.includes('limit') || msg.includes('too many')) {
      return json({ error: 'The server is busy right now. Please wait a minute and try again.' }, 429);
    }
    return json({ error: 'Could not create account. Please try again or contact your teacher.' }, 400);
  }
  if (!authUser?.user?.id) {
    return json({ error: 'Could not create account. Please try again.' }, 500);
  }

  const { error: insertError } = await admin.from('users').insert({
    id: authUser.user.id,
    name,
    email,
    role: 'student',
    roll: null,
  });

  if (insertError) {
    return json({ error: 'Account was created but profile could not be saved. Contact your teacher.' }, 500);
  }

  try {
    await admin.from('subscriptions').upsert({
      user_id: authUser.user.id,
      student_name: name,
      email,
      class: classVal || null,
      package_name: 'Free Trial',
      mcq_limit: 100,
      mcqs_used: 0,
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
    }, { onConflict: 'user_id' });
  } catch (_) {
    // Non-fatal: user can still log in; subscription can be added later
  }

  return json({ ok: true });
}

export async function onRequestPost(context) {
  return onRequest(context);
}
