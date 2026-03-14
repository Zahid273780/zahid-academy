import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return json({ error: 'Not authenticated' }, 401);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user: authUser }, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authUser) {
    return json({ error: 'Invalid or expired token' }, 401);
  }
  const userId = authUser.id;

  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile || (profile.role || '').toLowerCase() !== 'student') {
    return json({ error: 'Access denied' }, 403);
  }

  const { data: bucketRows, error: bucketError } = await adminClient
    .from('mistake_bucket')
    .select('mcq_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (bucketError) {
    return json({ error: bucketError.message || 'Failed to load bucket' }, 500);
  }

  const rawIds = (bucketRows || []).map((r) => r.mcq_id).filter(Boolean);
  const mcqIds = rawIds.map((id) => (typeof id === 'string' ? id : String(id)).trim()).filter(Boolean);

  if (mcqIds.length === 0) {
    return json({ mcqs: [], count: 0 });
  }

  let mcqs = null;
  let mcqError = null;

  const { data: mcqsData, error: mcqErr } = await adminClient
    .from('mcqs')
    .select('*')
    .in('id', mcqIds);

  mcqs = mcqsData;
  mcqError = mcqErr;

  if (mcqError) {
    return json({ error: mcqError.message || 'Failed to load MCQs' }, 500);
  }

  if ((mcqs || []).length === 0 && mcqIds.length > 0) {
    const asNumbers = mcqIds.map((id) => (id === '' || isNaN(Number(id)) ? null : Number(id))).filter((n) => n != null);
    if (asNumbers.length === mcqIds.length) {
      const { data: mcqsNum, error: errNum } = await adminClient
        .from('mcqs')
        .select('*')
        .in('id', asNumbers);
      if (!errNum && (mcqsNum || []).length > 0) {
        mcqs = mcqsNum;
      }
    }
  }

  function rowId(r) {
    if (!r) return '';
    const v = r.id ?? r.Id ?? r.ID;
    return v != null ? String(v).trim() : '';
  }

  const orderMap = new Map(mcqIds.map((id, i) => [id, i]));
  const sorted = (mcqs || [])
    .slice()
    .sort((a, b) => (orderMap.get(rowId(a)) ?? 9999) - (orderMap.get(rowId(b)) ?? 9999));
  const count = sorted.length > 0 ? sorted.length : mcqIds.length;

  const normalized = sorted.map((r) => ({ ...r, id: rowId(r) || r.id }));

  return json({ mcqs: normalized, count });
}
