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

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const {
    name,
    type,
    course,
    classExam,
    subject,
    unit,
    category,
    testNumber,
    mcqIds,
  } = body || {};

  if (!name || typeof name !== 'string') {
    return json({ error: 'Missing test name' }, 400);
  }

  if (type !== 'mock' && type !== 'practice') {
    return json({ error: 'Invalid test type' }, 400);
  }

  if (!Array.isArray(mcqIds) || mcqIds.length === 0) {
    return json({ error: 'No MCQs selected' }, 400);
  }

  if (!course || !classExam || !subject || !unit) {
    return json({ error: 'Missing course/class/subject/unit' }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const mcqCount = mcqIds.length;

  const { data: testRow, error: testErr } = await adminClient
    .from('tests')
    .insert({
      name,
      type,
      course,
      class_exam: classExam,
      subject,
      unit,
      category: category || null,
      test_number: testNumber != null ? testNumber : null,
      mcq_count: mcqCount,
    })
    .select('id')
    .single();

  if (testErr || !testRow) {
    return json({ error: 'Failed to create test' }, 500);
  }

  const testId = testRow.id;

  const rows = mcqIds.map((id, idx) => ({
    test_id: testId,
    mcq_id: id,
    position: idx + 1,
  }));

  const { error: linkErr } = await adminClient
    .from('test_mcqs')
    .insert(rows);

  if (linkErr) {
    return json({ error: 'Failed to link MCQs to test' }, 500);
  }

  return json({ ok: true, id: testId });
}

