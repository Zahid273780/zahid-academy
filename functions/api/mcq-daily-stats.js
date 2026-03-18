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
  const from = (url.searchParams.get('from') || '').trim();
  const to = (url.searchParams.get('to') || '').trim();

  const today = new Date().toISOString().slice(0, 10);
  const fromDate = from || today;
  const toDate = to || today;

  // Call the database function — all counting done in Postgres, no row cap issues
  const { data, error } = await admin.rpc('get_mcq_daily_stats', {
    from_date: fromDate,
    to_date: toDate,
  });

  if (error) {
    return json({ error: error.message }, 500);
  }

  const daily = (data || []).map(row => ({ date: row.date, total: Number(row.total) }));

  const todayTotal = daily.find(r => r.date === today)?.total || 0;
  const totalMcqs = daily.reduce((sum, r) => sum + r.total, 0);

  return json({
    todayTotal,
    totalMcqs,
    days: daily.length,
    daily,
  });
}
