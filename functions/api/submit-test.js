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


function calcGradeAndStatus(percentage) {
  if (percentage >= 90) return { grade: 'A+', status: 'Master' };
  if (percentage >= 80) return { grade: 'A', status: 'Excellent' };
  if (percentage >= 70) return { grade: 'B', status: 'Good' };
  if (percentage >= 60) return { grade: 'C', status: 'Average' };
  if (percentage >= 50) return { grade: 'D', status: 'Below Average' };
  return { grade: 'F', status: 'Fail' };
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

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user: authUser }, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authUser) {
    return json({ error: 'Invalid or expired token' }, 401);
  }
  const userId = authUser.id;

  const { data: userProfile } = await adminClient
    .from('users')
    .select('role, roll, email, name')
    .eq('id', userId)
    .single();

  const submitterRole = (userProfile ? userProfile.role || '' : '').toLowerCase();
  if (!userProfile || !['student', 'admin'].includes(submitterRole)) {
    return json({ error: 'Access denied' }, 403);
  }

  const { course, classExam, subject, unit, category, testNumber, totalMarks, obtainedMarks, totalTimeSeconds, testType } = body;

  if (!course || !classExam || !subject || !unit || !totalMarks || totalMarks <= 0) {
    return json({ error: 'Missing required test fields' }, 400);
  }

  const mcqCount = parseInt(totalMarks, 10);

  const percentage = Math.round((obtainedMarks / totalMarks) * 10000) / 100;
  const avgTime = Math.round((totalTimeSeconds / totalMarks) * 100) / 100;
  const { grade, status } = calcGradeAndStatus(percentage);

  let studentName = userProfile.name || '';
  let fatherName = null;
  let roll = userProfile.roll || null;

  let admission = null;

  if (roll) {
    const { data } = await adminClient
      .from('admission_form')
      .select('name, father, roll')
      .eq('roll', roll)
      .single();
    admission = data;
  }

  if (!admission && studentName) {
    const { data } = await adminClient
      .from('admission_form')
      .select('name, father, roll')
      .ilike('name', studentName)
      .limit(1)
      .single();
    admission = data;
  }

  if (admission) {
    studentName = admission.name || studentName;
    fatherName = admission.father || null;
    if (!roll && admission.roll) roll = admission.roll;
  }

  const row = {
    user_id: userId,
    name: studentName,
    father: fatherName,
    roll: roll,
    course: course,
    class_exam: classExam,
    subject: subject,
    unit: unit,
    category: category || null,
    test_number: testNumber ? parseInt(testNumber, 10) : null,
    total_marks: parseInt(totalMarks, 10),
    obtained_marks: parseInt(obtainedMarks, 10),
    percentage: percentage,
    total_time_seconds: parseInt(totalTimeSeconds, 10),
    avg_time_seconds: avgTime,
    grade: grade,
    status: status,
    test_type: testType === 'Mock Test' ? 'Mock Test' : 'Practice Test',
  };

  const { error: insertError } = await adminClient.from('studentpractice').insert(row);

  if (insertError) {
    return json({ error: 'Failed to save result: ' + insertError.message }, 500);
  }

  return json({ ok: true, grade, status, percentage });
}
