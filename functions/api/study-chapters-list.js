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

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Check if requester is admin/teacher (to also return drafts)
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

  let query = supabase
    .from('study_chapters')
    .select('slug, title, course, subject, "order", description, published, created_at')
    .order('course').order('subject').order('"order"');

  if (!isAdmin) query = query.eq('published', true);

  const { data, error } = await query;
  if (error) return json({ error: 'Failed to load chapters' }, 500);

  return json({ chapters: data || [] });
}
