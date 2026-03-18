import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

function normalizeId(row) {
  if (!row) return '';
  const value = row.id ?? row.Id ?? row.ID;
  return value != null ? String(value).trim() : '';
}

export async function onRequest(context) {
  const req = context.request;
  const env = context.env;

  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Server misconfigured' }, 500);

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return json({ error: 'Not authenticated' }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: 'Invalid or expired token' }, 401);

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single();
  const importantReaderRole = (profile ? profile.role || '' : '').toLowerCase();
  if (!profile || !['student', 'admin'].includes(importantReaderRole)) return json({ error: 'Access denied' }, 403);

  const { data: rows, error } = await admin
    .from('student_important_mcqs')
    .select('mcq_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      return json({ mcqs: [], count: 0, setupRequired: true, setupMessage: 'Run student-important-table.sql in Supabase SQL editor.' });
    }
    return json({ error: error.message || 'Failed to load important bucket' }, 500);
  }

  const ids = (rows || []).map((r) => String(r.mcq_id || '').trim()).filter(Boolean);
  if (!ids.length) return json({ mcqs: [], count: 0 });

  const { data: mcqs, error: mcqError } = await admin.from('mcqs').select('*').in('id', ids);
  if (mcqError) return json({ error: mcqError.message || 'Failed to load MCQs' }, 500);

  const orderMap = new Map(ids.map((id, i) => [id, i]));
  const normalized = (mcqs || []).map((r) => ({ ...r, id: normalizeId(r) || r.id }));
  normalized.sort((a, b) => (orderMap.get(String(a.id)) ?? 999999) - (orderMap.get(String(b.id)) ?? 999999));

  return json({ mcqs: normalized, count: normalized.length });
}
