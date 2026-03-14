import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY not set' }, 500);
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return json({ error: 'Not authenticated' }, 401);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let callerId = null;
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1]));
      callerId = payload.sub || null;
    }
  } catch {}

  if (!callerId) {
    return json({ error: 'Invalid token' }, 401);
  }

  const { data: profile } = await supabaseAdmin.from('users').select('role').eq('id', callerId).single();
  if (!profile || (profile.role || '').toLowerCase() !== 'admin') {
    return json({ error: 'Only admins can bulk create users' }, 403);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const users = Array.isArray(body.users) ? body.users : [];
  if (users.length === 0) {
    return json({ error: 'No users provided' }, 400);
  }
  if (users.length > 500) {
    return json({ error: 'Maximum 500 users per request' }, 400);
  }

  const success = [];
  const failed = [];

  for (const u of users) {
    const email = (u.email || '').trim();
    const name = (u.name || '').trim();
    const password = String(u.password || '').trim();
    const role = (u.role || 'student').toLowerCase();
    const roll = u.roll ? parseInt(u.roll, 10) : null;

    if (!email) { failed.push({ email: '(empty)', error: 'Missing email' }); continue; }
    if (!['admin', 'teacher', 'student'].includes(role)) { failed.push({ email, error: 'Invalid role' }); continue; }
    if (password.length < 6) { failed.push({ email, error: 'Password too short (min 6)' }); continue; }

    try {
      // Avoid hitting Supabase auth/email rate limits by spacing out requests
      await sleep(500);

      const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        const message = createError.message || 'Unknown error';
        if (message.toLowerCase().includes('email rate limit')) {
          failed.push({ email, error: 'Email rate limit exceeded at Supabase. Please wait a bit and retry this user.' });
        } else {
          failed.push({ email, error: message });
        }
        continue;
      }
      if (!authUser?.user?.id) { failed.push({ email, error: 'No user id returned' }); continue; }

      const userRow = {
        id: authUser.user.id,
        name: name || email,
        email,
        role,
      };
      if (roll) userRow.roll = roll;

      const { error: insertError } = await supabaseAdmin.from('users').insert(userRow);

      if (insertError) { failed.push({ email, error: insertError.message }); continue; }

      if (role === 'student') {
        let classVal = null;
        if (roll) {
          const { data: adm } = await supabaseAdmin.from('admission_form').select('class').eq('roll', roll).limit(1).single();
          if (adm && adm.class != null) classVal = adm.class;
        }
        await supabaseAdmin.from('subscriptions').upsert({
          user_id: authUser.user.id,
          student_name: name || email,
          email: email,
          class: classVal,
          package_name: 'Free Trial',
          mcq_limit: 100,
          mcqs_used: 0,
          starts_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
        }, { onConflict: 'user_id' });
      }

      success.push({ id: authUser.user.id, email, name: name || email, role, roll });
    } catch (e) {
      failed.push({ email, error: e.message || 'Unknown error' });
    }
  }

  return json({ success, failed });
}
