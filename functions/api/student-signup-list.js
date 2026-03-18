import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function getCallerId(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1]));
      return payload.sub || null;
    }
  } catch {}
  return null;
}

export async function onRequest(context) {
  const req = context.request;
  const env = context.env;

  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Server misconfigured' }, 500);

  const callerId = getCallerId(req);
  if (!callerId) return json({ error: 'Not authenticated' }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await admin.from('users').select('role').eq('id', callerId).single();
  if (!profile || (profile.role || '').toLowerCase() !== 'admin') {
    return json({ error: 'Admin only' }, 403);
  }

  const url = new URL(req.url);
  const date = (url.searchParams.get('date') || '').trim();
  const name = (url.searchParams.get('name') || '').trim();
  const number = (url.searchParams.get('number') || '').replace(/\D/g, '');

  let query = admin
    .from('users')
    .select('id, name, email, username, mobile, whatsapp, created_at, role')
    .eq('role', 'student')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (date) {
    query = query
      .gte('created_at', date + 'T00:00:00.000Z')
      .lte('created_at', date + 'T23:59:59.999Z');
  }

  if (name) {
    query = query.ilike('name', `%${name}%`);
  }

  if (number) {
    query = query.or(`mobile.ilike.%${number}%,whatsapp.ilike.%${number}%`);
  }

  const { data: rows, error } = await query;
  if (error) return json({ error: error.message }, 500);

  return json({ rows: rows || [] });
}
