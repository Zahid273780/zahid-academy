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

  const { data: subs } = await adminClient
    .from('subscriptions')
    .select('course, allowed_subjects')
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString());


  let allowedCourses = null;   // null = unrestricted (all courses)
  let allowedSubjects = null;  // null = unrestricted (all subjects)

  if (subs && subs.length > 0) {
    /* ── course restriction ── */
    const courseSet = new Set();
    let anyCourseUnrestricted = false;
    for (const s of subs) {
      const c = (s.course || '').trim();
      if (!c) { anyCourseUnrestricted = true; break; }
      courseSet.add(c);
    }
    if (!anyCourseUnrestricted && courseSet.size > 0) {
      allowedCourses = Array.from(courseSet);
    }

    /* ── subject restriction (existing logic) ── */
    const subjectSet = new Set();
    let anySubjectUnrestricted = false;
    for (const s of subs) {
      const raw = (s.allowed_subjects || '').trim();
      if (!raw) { anySubjectUnrestricted = true; break; }
      raw.split(',').forEach((x) => { const t = x.trim(); if (t) subjectSet.add(t); });
    }
    if (!anySubjectUnrestricted && subjectSet.size > 0) {
      allowedSubjects = Array.from(subjectSet);
    }
  }


  const { data, error } = await adminClient.from('mcqs').select('*').eq('hide', false);

  if (error) {
    return json({ error: 'Failed to load data' }, 500);
  }

  let mcqs = data || [];

  // #region agent log
  const _dbg_totalBefore = mcqs.length;
  const _dbg_uniqueCourses = [...new Set(mcqs.map(r=>r['Course']||r.course||''))];
  // #endregion

  /* filter by course (subscription course must match MCQ Course) */
  if (allowedCourses && allowedCourses.length > 0) {
    mcqs = mcqs.filter((r) => allowedCourses.includes(r['Course'] || r.course || ''));
  }

  /* filter by subject (existing behaviour) */
  if (allowedSubjects && allowedSubjects.length > 0) {
    mcqs = mcqs.filter((r) => allowedSubjects.includes(r['Subject'] || r.subject || ''));
  }

  // #region agent log
  const _dbg_uniqueAfter = [...new Set(mcqs.map(r=>r['Course']||r.course||''))];
  const _dbg = {
    subsCount: (subs||[]).length,
    subsCoursesRaw: (subs||[]).map(s=>s.course||null),
    allowedCourses,
    allowedSubjects,
    totalMcqsInDb: _dbg_totalBefore,
    uniqueCoursesInDb: _dbg_uniqueCourses,
    mcqsAfterFilter: mcqs.length,
    uniqueCoursesAfterFilter: _dbg_uniqueAfter,
  };
  // #endregion

  return json({ mcqs, _debug: _dbg });
}
