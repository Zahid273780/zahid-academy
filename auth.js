/**
 * Shared auth & role-based access for Zahid Academy RBC system.
 * Use with: import { supabase, getSessionRole, requireRole } from './auth.js';
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://uygtxlehwtgaftcwsxrr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kG0Vz7eavEBWLdQZJSnkuA_7rn2InXc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LOGIN_PAGE = 'index.html';

/**
 * Get current session and user's role from `users` table.
 * @returns {{ session: object, role: string }} or null if not logged in or no profile.
 */
export async function getSessionRole() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: profile } = await supabase.from('users').select('role').eq('id', session.user.id).single();
  if (!profile) return null;
  return { session, role: (profile.role || '').toLowerCase() };
}

/**
 * Require one of the given roles. Redirects to login if not authenticated or wrong role.
 * @param {string[]} allowedRoles - e.g. ['admin'], ['teacher'], ['student'], ['admin','teacher']
 * @returns {Promise<{ session, role }>} - use after await to render the page
 */
export async function requireRole(allowedRoles) {
  const result = await getSessionRole();
  if (!result) {
    window.location.href = LOGIN_PAGE;
    return null;
  }
  const allowed = allowedRoles.map(r => r.toLowerCase());
  if (!allowed.includes(result.role)) {
    window.location.href = LOGIN_PAGE;
    return null;
  }
  return result;
}
