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

function isMissingTableError(error) {
  const message = (error && error.message ? String(error.message) : '').toLowerCase();
  const code = error && error.code ? String(error.code) : '';
  return code === '42P01' || message.includes('does not exist') || message.includes('relation');
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

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: 'Invalid or expired token' }, 401);

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single();
  if (!profile || (profile.role || '').toLowerCase() !== 'student') return json({ error: 'Access denied' }, 403);

  const body = await req.json().catch(() => ({}));
  const mcqId = body.mcq_id != null ? String(body.mcq_id).trim() : '';
  if (!mcqId) return json({ error: 'mcq_id is required' }, 400);

  const { error } = await admin
    .from('student_important_mcqs')
    .delete()
    .eq('user_id', user.id)
    .eq('mcq_id', mcqId);

  if (error) {
    if (isMissingTableError(error)) {
      return json({ error: 'Important bucket is not set up yet. Run student-important-table.sql first.' }, 503);
    }
    return json({ error: error.message || 'Failed to remove important item' }, 500);
  }
  return json({ ok: true, message: 'Removed from Important bucket' });
}
