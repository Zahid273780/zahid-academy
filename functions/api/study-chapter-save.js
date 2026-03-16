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

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'teacher'].includes((profile.role || '').toLowerCase())) {
    return json({ error: 'Access denied — admin or teacher only' }, 403);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { slug, title, course, subject, order, description, content, published, action } = body;

  // Delete action
  if (action === 'delete') {
    if (!slug) return json({ error: 'Missing slug' }, 400);
    const { error } = await supabase.from('study_chapters').delete().eq('slug', slug);
    if (error) return json({ error: 'Delete failed: ' + error.message }, 500);
    return json({ ok: true, deleted: slug });
  }

  // Validate required fields for save
  if (!slug || !title || !course || !subject) {
    return json({ error: 'Missing required fields: slug, title, course, subject' }, 400);
  }

  const payload = {
    slug: slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    title: title.trim(),
    course: course.trim(),
    subject: subject.trim(),
    order: parseInt(order, 10) || 1,
    description: (description || '').trim() || null,
    content: Array.isArray(content) ? content : [],
    published: published === true,
  };

  const { data: existing } = await supabase.from('study_chapters').select('id').eq('slug', payload.slug).single();

  let error;
  if (existing) {
    ({ error } = await supabase.from('study_chapters').update(payload).eq('slug', payload.slug));
  } else {
    ({ error } = await supabase.from('study_chapters').insert(payload));
  }

  if (error) return json({ error: 'Save failed: ' + error.message }, 500);
  return json({ ok: true, slug: payload.slug, published: payload.published });
}
