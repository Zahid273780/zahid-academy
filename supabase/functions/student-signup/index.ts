// Supabase Edge Function: student-signup
// Deploy via Dashboard (Edge Functions > Deploy new > Via Editor) or CLI: supabase functions deploy student-signup
// Invoke: POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/student-signup
// Headers: Authorization: Bearer YOUR_ANON_KEY, Content-Type: application/json

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS });
  }
  if (req.method === 'GET') {
    return json({
      message:
        'Student signup: send POST with name, username, class, whatsapp, mobile, password',
    });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const name = String(body.name ?? '').trim();
  const username = String(body.username ?? '').trim().toLowerCase();
  const classVal = String(body.class ?? '').trim();
  const whatsapp = String(body.whatsapp ?? '').replace(/\D/g, '');
  const mobile = String(body.mobile ?? '').replace(/\D/g, '');
  const password = String(body.password ?? '').trim();

  if (!name || !username || !classVal || !password) {
    return json(
      { error: 'Name, username, class and password are required' },
      400
    );
  }
  if (/\d/.test(name)) {
    return json(
      {
        error:
          'Full name must contain only letters and spaces, no numbers',
      },
      400
    );
  }
  if (username.includes('@')) {
    return json(
      { error: 'Enter username only (e.g. ali123), not an email' },
      400
    );
  }
  if (whatsapp.length !== 11) {
    return json(
      {
        error:
          'WhatsApp number must be exactly 11 digits (e.g. 03337502737)',
      },
      400
    );
  }
  if (mobile.length !== 11) {
    return json(
      {
        error:
          'Mobile number must be exactly 11 digits (e.g. 03337502737)',
      },
      400
    );
  }
  if (password.length < 4) {
    return json({ error: 'Password must be at least 4 characters' }, 400);
  }

  const email = `${username}@shaeenacademy.com`;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return json(
      {
        error:
          'This username/email is already registered. Use Student Login or contact your teacher.',
      },
      409
    );
  }

  const { data: authUser, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError) {
    const msg = (createError.message ?? '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered')) {
      return json(
        {
          error:
            'This username/email is already registered. Use Student Login or contact your teacher.',
        },
        409
      );
    }
    return json(
      { error: createError.message ?? 'Could not create account' },
      400
    );
  }
  if (!authUser?.user?.id) {
    return json({ error: 'Could not create account' }, 500);
  }

  const { error: insertError } = await admin.from('users').insert({
    id: authUser.user.id,
    name,
    email,
    role: 'student',
    roll: null,
  });

  if (insertError) {
    return json(
      {
        error:
          'Account was created but profile could not be saved. Contact your teacher.',
      },
      500
    );
  }

  try {
    await admin.from('subscriptions').upsert(
      {
        user_id: authUser.user.id,
        student_name: name,
        email,
        class: classVal || null,
        package_name: 'Free Trial',
        mcq_limit: 100,
        mcqs_used: 0,
        starts_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 15 * 24 * 60 * 60 * 1000
        ).toISOString(),
        is_active: true,
      },
      { onConflict: 'user_id' }
    );
  } catch {
    // Non-fatal: user can still log in
  }

  return json({ ok: true });
});
