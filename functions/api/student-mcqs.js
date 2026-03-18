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

  /* ── read optional filter parameters from request body ── */
  const body = await req.json().catch(() => ({}));
  const { course, classExam, subject, unit, category, testNumber } = body;

  /* ── fetch MCQs with server-side filters + pagination ── */
  const PAGE_SIZE = 1000;
  let mcqs = [];
  let from = 0;

  while (true) {
    let q = adminClient.from('mcqs').select('*').eq('hide', false);

    // subscription restrictions (server-side)
    if (allowedCourses) q = q.in('Course', allowedCourses);
    if (allowedSubjects) q = q.in('Subject', allowedSubjects);

    // navigation filters from client
    // Note: columns with special chars (/, space) must use .filter() with quoted identifiers
    if (course) q = q.eq('Course', course);
    if (classExam) q = q.filter('"Class/Exam"', 'eq', classExam);
    if (subject) q = q.eq('Subject', subject);
    if (unit) q = q.eq('Unit', unit);
    if (category) q = q.eq('Category', category);
    if (testNumber !== undefined && testNumber !== null) q = q.filter('"Test Number"', 'eq', testNumber);

    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) return json({ error: 'Failed to load data' }, 500);
    mcqs.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const hasContext = course && classExam && subject && unit && testNumber !== undefined && testNumber !== null;
  if (!hasContext) {
    return json({ mcqs });
  }

  let exclusionQuery = adminClient
    .from('student_not_relevant_mcqs')
    .select('mcq_id')
    .eq('user_id', userId)
    .eq('course', course)
    .eq('class_exam', classExam)
    .eq('subject', subject)
    .eq('unit', unit)
    .eq('test_number', Number(testNumber));

  if (category != null && String(category).trim() !== '') {
    exclusionQuery = exclusionQuery.eq('category', String(category).trim());
  } else {
    exclusionQuery = exclusionQuery.is('category', null);
  }

  const { data: excludedRows, error: excludedErr } = await exclusionQuery;
  if (excludedErr) {
    if (isMissingTableError(excludedErr)) {
      return json({ mcqs, setupRequired: true, setupMessage: 'Run student-not-relevant-table.sql to enable Not Relevant filtering.' });
    }
    return json({ error: 'Failed to load Not Relevant exclusions' }, 500);
  }

  const excluded = new Set((excludedRows || []).map((r) => String(r.mcq_id || '').trim()).filter(Boolean));
  if (!excluded.size) {
    return json({ mcqs });
  }

  const filtered = (mcqs || []).filter((row) => {
    const rowId = row?.id != null ? String(row.id).trim() : '';
    return rowId && !excluded.has(rowId);
  });

  return json({ mcqs: filtered });
}
