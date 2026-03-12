import { createClient } from 'npm:@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequest(context) {
  const req = context.request;
  const env = context.env;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
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
  username = username.toLowerCase();

  if (username.includes('@')) {
    return json({ error: 'Username must not contain @. Just enter something like ali123.' }, 400);
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

  const email = `${username}@zahidacademy.com`;

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingUsers, error: userErr } = await adminClient
    .from('users')
    .select('email')
    .eq('email', email)
    .limit(1);

  if (userErr) {
    return json({ error: 'Could not check existing users' }, 500);
  }
  if (existingUsers && existingUsers.length > 0) {
    return json({ error: 'An account with this username/email already exists. Please contact your teacher.' }, 409);
  }

  const { data: existingReqs, error: reqErr } = await adminClient
    .from('login_form')
    .select('id')
    .or(`username.eq.${username},email.eq.${email}`)
    .limit(1);

  if (reqErr) {
    return json({ error: 'Could not check existing requests' }, 500);
  }
  if (existingReqs && existingReqs.length > 0) {
    return json({ error: 'You already submitted this form. Please wait for your teacher to create your account.' }, 409);
  }

  // Auto-generate next roll number from existing users + login_form
  let nextRoll = null;
  try {
    const { data: maxUserRollRow } = await adminClient
      .from('users')
      .select('roll')
      .not('roll', 'is', null)
      .order('roll', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: maxReqRollRow } = await adminClient
      .from('login_form')
      .select('roll')
      .not('roll', 'is', null)
      .order('roll', { ascending: false })
      .limit(1)
      .maybeSingle();

    const maxUserRoll = maxUserRollRow && typeof maxUserRollRow.roll === 'number' ? maxUserRollRow.roll : 0;
    const maxReqRoll = maxReqRollRow && typeof maxReqRollRow.roll === 'number' ? maxReqRollRow.roll : 0;
    const currentMax = Math.max(maxUserRoll, maxReqRoll);
    nextRoll = currentMax > 0 ? currentMax + 1 : 1;
  } catch {
    // If roll generation fails for some reason, keep it null; admin can assign later.
    nextRoll = null;
  }

  // Always enforce role = 'student' at backend
  const role = 'student';

  const { error: insertErr } = await adminClient.from('login_form').insert({
    name,
    username,
    email,
    role,
    password,
    roll: nextRoll,
    class: classVal,
    whatsapp: whatsapp,
    mobile: mobile,
  });

  if (insertErr) {
    return json({ error: 'Could not save your request. Please try again later.' }, 500);
  }

  return json({ ok: true });
}

// Explicit POST handler so Cloudflare Pages reliably invokes this for POST /api/login-form-submit
export async function onRequestPost(context) {
  return onRequest(context);
}

