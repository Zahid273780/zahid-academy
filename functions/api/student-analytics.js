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

function extractUserId(token) {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) return null;
      return payload.sub || null;
    }
  } catch {}
  return null;
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

  const authHeader = req.headers.get('authorization') || '';
  let body;
  try {
    body = (await req.json()) || {};
  } catch {
    body = {};
  }
  const tokenFromBody = body.authToken || null;
  const token = tokenFromBody || authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return json({ error: 'Not authenticated' }, 401);
  }

  const userId = extractUserId(token);
  if (!userId) {
    return json({ error: 'Invalid or expired token' }, 401);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userProfile } = await adminClient
    .from('users')
    .select('role, email, name')
    .eq('id', userId)
    .single();

  if (!userProfile || (userProfile.role || '').toLowerCase() !== 'student') {
    return json({ error: 'Access denied' }, 403);
  }

  const { data: practiceRows, error: practiceError } = await adminClient
    .from('studentpractice')
    .select('*')
    .eq('user_id', userId);

  if (practiceError) {
    return json({ error: practiceError.message || 'Failed to load practice data' }, 500);
  }

  const practice = (practiceRows || []).slice().sort((a, b) => {
    const da = a.test_date || a.created_at;
    const db = b.test_date || b.created_at;
    if (!da) return 1;
    if (!db) return -1;
    return new Date(db) - new Date(da);
  });

  const { count: mistakeCount, error: bucketError } = await adminClient
    .from('mistake_bucket')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const mistakeBucketCount = bucketError ? 0 : (mistakeCount ?? 0);

  return json({
    practice,
    mistakeBucketCount,
    name: userProfile.name || null,
    email: userProfile.email || null,
  });
}
