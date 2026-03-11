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

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const {
    mcqCount,
    course,
    classExam,
    subject,
    unit,
    category,
    testNumber,
    testType,
  } = body || {};

  const count = parseInt(mcqCount, 10);
  if (!count || count <= 0) {
    return json({ error: 'Invalid mcqCount' }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userProfile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (!userProfile || (userProfile.role || '').toLowerCase() !== 'student') {
    return json({ error: 'Access denied' }, 403);
  }

  const { data: rows, error } = await adminClient
    .from('subscriptions')
    .select('id, mcq_limit, mcqs_used, is_active, expires_at, priority')
    .eq('user_id', userId)
    .order('priority', { ascending: true })
    .order('expires_at', { ascending: true });

  if (error) {
    return json({ error: 'Failed to load subscriptions' }, 500);
  }

  const now = new Date();
  const usable = (rows || []).filter((r) => {
    if (!r.is_active) return false;
    if (new Date(r.expires_at) <= now) return false;
    return r.mcqs_used < r.mcq_limit;
  });

  const totalRemaining = usable.reduce(
    (sum, r) => sum + Math.max(0, r.mcq_limit - r.mcqs_used),
    0
  );

  if (usable.length === 0) {
    return json(
      {
        error: 'No subscription found or all have expired/exhausted. Contact your administrator.',
      },
      403
    );
  }

  if (count > totalRemaining) {
    return json(
      {
        error:
          'Not enough MCQs remaining. You have ' +
          totalRemaining +
          ' left but this test needs ' +
          count +
          '.',
      },
      403
    );
  }

  let toDeduct = count;
  for (const row of usable) {
    if (toDeduct <= 0) break;
    const remaining = row.mcq_limit - row.mcqs_used;
    if (remaining <= 0) continue;
    const take = Math.min(toDeduct, remaining);
    const newUsed = row.mcqs_used + take;
    const { error: updateError } = await adminClient
      .from('subscriptions')
      .update({ mcqs_used: newUsed })
      .eq('id', row.id);

    if (updateError) {
      return json(
        { error: 'Failed to reserve MCQs: ' + updateError.message },
        500
      );
    }
    toDeduct -= take;
  }

  const { data: updatedRows } = await adminClient
    .from('subscriptions')
    .select('mcq_limit, mcqs_used')
    .eq('user_id', userId);

  const totalUsed = (updatedRows || []).reduce((s, r) => s + r.mcqs_used, 0);
  const totalLimit = (updatedRows || []).reduce((s, r) => s + r.mcq_limit, 0);
  const newRemaining = Math.max(0, totalLimit - totalUsed);

  return json({
    ok: true,
    mcq_count: count,
    mcqs_used: totalUsed,
    mcqs_remaining: newRemaining,
    mcq_limit: totalLimit,
    meta: {
      course: course || null,
      classExam: classExam || null,
      subject: subject || null,
      unit: unit || null,
      category: category || null,
      testNumber: testNumber || null,
      testType: testType || null,
    },
  });
}
