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
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const tokenFromBody = (body && body.authToken) || null;
  const token = tokenFromBody || authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return json({ error: 'Not authenticated' }, 401);
  }
  if (body && body.authToken) {
    delete body.authToken;
  }

  const userId = extractUserId(token);
  if (!userId) {
    return json({ error: 'Invalid or expired token' }, 401);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile || (profile.role || '').toLowerCase() !== 'student') {
    return json({ error: 'Access denied' }, 403);
  }

  const rawAttempts = Array.isArray(body.attempts) ? body.attempts : [];
  const testContext = body.testContext && typeof body.testContext === 'object' ? body.testContext : {};

  if (rawAttempts.length === 0) {
    return json({ error: 'attempts array is required and must be non-empty' }, 400);
  }

  const valid = [];
  for (const a of rawAttempts) {
    const mcq_id = a.mcq_id != null ? String(a.mcq_id).trim() : '';
    const selected_option = a.selected_option != null ? String(a.selected_option).trim() : '';
    const is_correct = Boolean(a.is_correct);
    if (!mcq_id) continue;
    valid.push({
      mcq_id,
      selected_option: selected_option || null,
      is_correct,
      time_taken_sec: a.time_taken_sec != null ? Math.max(0, parseInt(a.time_taken_sec, 10) || 0) : null,
    });
  }

  if (valid.length === 0) {
    return json({ error: 'No valid attempts (each must have mcq_id)' }, 400);
  }

  const rows = valid.map((a) => ({
    user_id: userId,
    mcq_id: a.mcq_id,
    selected_option: a.selected_option,
    is_correct: a.is_correct,
    time_taken_sec: a.time_taken_sec,
    course: testContext.course != null ? String(testContext.course) : null,
    class_exam: testContext.classExam != null ? String(testContext.classExam) : null,
    subject: testContext.subject != null ? String(testContext.subject) : null,
    unit: testContext.unit != null ? String(testContext.unit) : null,
    category: testContext.category != null ? String(testContext.category) : null,
    test_number: testContext.testNumber != null ? parseInt(testContext.testNumber, 10) : null,
    test_type: testContext.testType != null ? String(testContext.testType) : null,
  }));

  const { error: insertError } = await adminClient.from('attempts').insert(rows);

  if (insertError) {
    return json({ error: 'Failed to save attempts: ' + insertError.message }, 500);
  }

  const incorrectMcqIds = valid.filter((a) => !a.is_correct).map((a) => a.mcq_id);
  if (incorrectMcqIds.length > 0) {
    const rpc = await adminClient.rpc('add_mistakes', {
      p_user_id: userId,
      p_mcq_ids: incorrectMcqIds,
    });
    if (rpc.error) {
      const fallbackRows = incorrectMcqIds.map((mcq_id) => ({ user_id: userId, mcq_id }));
      await adminClient
        .from('mistake_bucket')
        .upsert(fallbackRows, { onConflict: 'user_id,mcq_id', ignoreDuplicates: true });
    }
  }

  return json({ ok: true, saved: valid.length });
}
