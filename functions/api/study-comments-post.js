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

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return json({ error: 'Not authenticated' }, 401);

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: 'Invalid or expired token' }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { chapter_slug, comment } = body;
  if (!chapter_slug || !comment || !comment.trim()) {
    return json({ error: 'Missing chapter_slug or comment' }, 400);
  }
  if (comment.trim().length > 1000) {
    return json({ error: 'Comment too long (max 1000 characters)' }, 400);
  }

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single();

  const userName = (profile && profile.name) ? profile.name : (user.email || 'Student');

  const { error: insertError } = await supabase.from('study_comments').insert({
    chapter_slug,
    user_id: user.id,
    user_name: userName,
    body: comment.trim(),
  });

  if (insertError) return json({ error: 'Failed to save comment' }, 500);

  return json({ ok: true, user_name: userName });
}
