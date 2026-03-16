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

export async function onRequest(context) {
  const req = context.request;
  const env = context.env;

  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return json({ error: 'Missing slug param' }, 400);

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Allow admins/teachers to preview unpublished chapters
  let isAdmin = false;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
      if (profile && ['admin', 'teacher'].includes((profile.role || '').toLowerCase())) {
        isAdmin = true;
      }
    }
  }

  let query = supabase.from('study_chapters').select('*').eq('slug', slug).single();

  const { data, error } = await query;

  if (error || !data) return json({ error: 'Chapter not found' }, 404);
  if (!isAdmin && !data.published) return json({ error: 'Chapter not found' }, 404);

  return json({ chapter: data });
}
