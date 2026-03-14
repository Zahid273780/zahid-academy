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

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await adminClient
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: true })
    .order('expires_at', { ascending: true });

  if (error) {
    return json({ active: false, reason: 'error', message: error.message });
  }

  const now = new Date();
  const activeRows = (rows || []).filter(
    (r) => r.is_active && new Date(r.expires_at) > now && r.mcqs_used < r.mcq_limit
  );

  let totalLimit = 0;
  let totalUsed = 0;
  const subscriptions = (rows || []).map((r) => {
    const exp = new Date(r.expires_at);
    const expired = exp <= now;
    const remaining = Math.max(0, r.mcq_limit - r.mcqs_used);
    const daysLeft = Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));
    if (r.is_active && !expired) {
      totalLimit += r.mcq_limit;
      totalUsed += r.mcqs_used;
    }
    return {
      id: r.id,
      package_name: r.package_name,
      mcq_limit: r.mcq_limit,
      mcqs_used: r.mcqs_used,
      mcqs_remaining: remaining,
      expires_at: r.expires_at,
      days_left: daysLeft,
      is_active: r.is_active,
      expired,
      priority: r.priority != null ? r.priority : 0,
    };
  });

  const totalRemaining = activeRows.reduce(
    (sum, r) => sum + Math.max(0, r.mcq_limit - r.mcqs_used),
    0
  );
  const anyActive = activeRows.length > 0;
  const active = anyActive && totalRemaining > 0;

  let reason = null;
  let message = null;
  if (!anyActive) {
    reason = rows && rows.length > 0 ? 'expired_or_exhausted' : 'no_subscription';
    message =
      rows && rows.length > 0
        ? 'All your subscriptions have expired or are exhausted. Please buy a new plan via Easypaisa (03337502737 – Zahid Hussain).'
        : 'No subscription found. Please buy a plan via Easypaisa (03337502737 – Zahid Hussain).';
  } else if (totalRemaining <= 0) {
    reason = 'quota_exhausted';
    message = 'You have used all MCQs in your active plans. Contact your administrator to upgrade.';
  }

  const soonestExpiry = activeRows.length > 0
    ? activeRows.reduce((min, r) => {
        const t = new Date(r.expires_at).getTime();
        return t < min ? t : min;
      }, Number.MAX_SAFE_INTEGER)
    : null;
  const daysLeft = soonestExpiry != null
    ? Math.max(0, Math.ceil((soonestExpiry - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return json({
    active,
    reason,
    message,
    package_name: activeRows.length === 1 ? activeRows[0].package_name : null,
    mcq_limit: totalLimit,
    mcqs_used: totalUsed,
    mcqs_remaining: totalRemaining,
    days_left: daysLeft,
    subscriptions,
  });
}
