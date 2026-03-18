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

export async function onRequest(context) {
  const req = context.request;
  const env = context.env;

  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Server misconfigured' }, 500);

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return json({ error: 'Not authenticated' }, 401);

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user: authUser }, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authUser) return json({ error: 'Invalid or expired token' }, 401);

  const { data: profile } = await adminClient
    .from('users').select('role').eq('id', authUser.id).single();
  if (!profile || (profile.role || '').toLowerCase() !== 'admin') {
    return json({ error: 'Admin access required' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const { course, classExam, subject, unit, category, testNumber } = body;

  if (!course || !classExam || !subject || !unit || testNumber === undefined || testNumber === null) {
    return json({ error: 'course, classExam, subject, unit, testNumber are required' }, 400);
  }

  const PAGE_SIZE = 1000;
  let mcqs = [];
  let from = 0;

  while (true) {
    let q = adminClient.from('mcqs').select('*').eq('hide', false);
    q = q.eq('Course', course);
    q = q.filter('"Class/Exam"', 'eq', classExam);
    q = q.eq('Subject', subject);
    q = q.eq('Unit', unit);
    if (category) {
      q = q.eq('Category', category);
    } else {
      q = q.is('Category', null);
    }
    q = q.filter('"Test Number"', 'eq', testNumber);
    q = q.range(from, from + PAGE_SIZE - 1);

    const { data, error } = await q;
    if (error) return json({ error: 'Failed to load MCQs: ' + error.message }, 500);
    mcqs.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return json({ mcqs });
}
