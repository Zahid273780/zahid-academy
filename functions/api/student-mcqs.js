import { createClient } from '@supabase/supabase-js';

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
  const token = authHeader.replace('Bearer ', '').trim();
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

  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile || (profile.role || '').toLowerCase() !== 'student') {
    return json({ error: 'Access denied' }, 403);
  }

  const { data: subs } = await adminClient
    .from('subscriptions')
    .select('allowed_subjects')
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString());

  let allowedSubjects = null;
  if (subs && subs.length > 0) {
    const merged = new Set();
    let anyEmpty = false;
    for (const s of subs) {
      const raw = (s.allowed_subjects || '').trim();
      if (!raw) {
        anyEmpty = true;
        break;
      }
      raw.split(',').forEach((x) => {
        const t = x.trim();
        if (t) merged.add(t);
      });
    }
    if (!anyEmpty && merged.size > 0) {
      allowedSubjects = Array.from(merged);
    }
  }

  const { data, error } = await adminClient.from('mcqs').select('*').eq('hide', false);

  if (error) {
    return json({ error: 'Failed to load data' }, 500);
  }

  let mcqs = data || [];
  if (allowedSubjects && allowedSubjects.length > 0) {
    const subjectKey = mcqs[0] && mcqs[0].Subject !== undefined ? 'Subject' : 'subject';
    mcqs = mcqs.filter((r) => allowedSubjects.includes(r[subjectKey] || r.Subject || r.subject));
  }

  return json({ mcqs });
}
