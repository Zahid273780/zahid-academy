import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const NAV_CACHE_TTL_SECONDS = 60;
const NAV_CACHE_VERSION = 'student-nav-v1';

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function normalizeScopeList(values) {
  return Array.isArray(values) && values.length > 0
    ? values.slice().sort((a, b) => String(a).localeCompare(String(b)))
    : null;
}

function buildScopeCacheKey(allowedCourses, allowedSubjects) {
  return JSON.stringify({
    v: NAV_CACHE_VERSION,
    courses: normalizeScopeList(allowedCourses),
    subjects: normalizeScopeList(allowedSubjects),
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
  if (!token) return json({ error: 'Not authenticated' }, 401);

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user: authUser }, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authUser) return json({ error: 'Invalid or expired token' }, 401);

  const { data: profile } = await adminClient
    .from('users').select('role').eq('id', authUser.id).single();
  if (!profile || (profile.role || '').toLowerCase() !== 'student') {
    return json({ error: 'Access denied' }, 403);
  }

  /* ── subscription restrictions ── */
  const { data: subs } = await adminClient
    .from('subscriptions')
    .select('course, allowed_subjects')
    .eq('user_id', authUser.id)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString());

  let allowedCourses = null;
  let allowedSubjects = null;

  if (subs && subs.length > 0) {
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

  const cache = caches.default;
  const cacheUrl = new URL(req.url);
  cacheUrl.search = new URLSearchParams({
    scope: buildScopeCacheKey(allowedCourses, allowedSubjects),
  }).toString();
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  /* ── fetch navigation columns in paginated batches ── */
  const PAGE_SIZE = 1000;
  const NAV_COLS = 'Course,"Class/Exam",Subject,Unit,Category,"Test Number",Topics';
  let allRows = [];
  let from = 0;

  while (true) {
    let q = adminClient.from('mcqs').select(NAV_COLS).eq('hide', false);
    if (allowedCourses) q = q.in('Course', allowedCourses);
    if (allowedSubjects) q = q.in('Subject', allowedSubjects);

    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) return json({ error: 'Failed to load navigation data' }, 500);
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  /* ── group into per-test entries with count ── */
  const map = new Map();
  for (const r of allRows) {
    const key = [
      r['Course'], r['Class/Exam'], r['Subject'],
      r['Unit'], r['Category'] || '', r['Test Number'],
    ].join('||');
    if (!map.has(key)) {
      map.set(key, {
        Course: r['Course'],
        'Class/Exam': r['Class/Exam'],
        Subject: r['Subject'],
        Unit: r['Unit'],
        Category: r['Category'] || '',
        'Test Number': r['Test Number'],
        Topics: r['Topics'] || '',
        count: 0,
      });
    }
    map.get(key).count++;
  }

  const response = json(
    { nav: Array.from(map.values()) },
    200,
    {
      'Cache-Control': `public, max-age=${NAV_CACHE_TTL_SECONDS}`,
    },
  );

  if (context.waitUntil) {
    context.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    await cache.put(cacheKey, response.clone());
  }

  return response;
}
