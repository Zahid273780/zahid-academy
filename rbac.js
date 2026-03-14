import { supabase, initAuthGuard, getAuthUser, canView } from './auth-guard.js';

const ROLES = ['admin', 'teacher', 'student', 'accountant'];
const PERMS = ['can_view', 'can_read', 'can_write', 'can_delete'];
const PERM_LETTERS = { can_view: 'V', can_read: 'R', can_write: 'W', can_delete: 'D' };
const PERM_CLASSES = { can_view: 'cb-view', can_read: 'cb-read', can_write: 'cb-write', can_delete: 'cb-delete' };

// Display labels for page:xxx and table names (so "Page / Resource" column shows HTMLs/pages clearly)
const RESOURCE_LABELS = {
  'page:login': 'Login',
  'page:portal': 'Portal',
  'page:practice-test': 'Practice Test',
  'page:give-test': 'Give Test',
  'page:admission': 'Admission',
  'page:students': 'Students',
  'page:attendance': 'Attendance',
  'page:attendance-reports': 'Attendance Reports',
  'page:import-mcqs': 'Import MCQs',
  'page:manage-mcqs': 'Manage MCQs',
  'page:publisher': 'Publisher',
  'page:results': 'Results',
  'page:course-structure': 'Course Structure',
  'page:subjects': 'Subjects',
  'page:user-form': 'User Entry Form',
  'page:import-users': 'Import Users / Form Requests',
  'page:users': 'Users',
  'page:subscriptions': 'Subscriptions',
  'page:rbac': 'Access Control',
  'page:dashboard': 'Dashboard',
  'role_permissions': 'Role permissions (table)',
  'users': 'Users (table)',
  'admission_form': 'Admission form (table)',
  'mcqs': 'MCQs (table)',
  'studentpractice': 'Student practice (table)',
  'subjects': 'Subjects (table)',
  'coursestructure': 'Course structure (table)',
  'attendance': 'Attendance (table)',
};

function labelFor(tableName) {
  return RESOURCE_LABELS[tableName] || tableName;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

let allPermissions = [];
let studentLocked = true;

function applyStudentLock() {
  const cells = document.querySelectorAll('#permBody .student-perm-cell');
  const btn = document.getElementById('studentLockBtn');
  if (!btn) return;
  if (studentLocked) {
    cells.forEach(c => c.classList.add('col-locked'));
    btn.classList.add('locked');
    btn.title = 'Student column is locked. Click to unlock and allow edits.';
    btn.innerHTML = '<span class="lock-icon">🔒</span><span class="lock-label">Locked</span>';
  } else {
    cells.forEach(c => c.classList.remove('col-locked'));
    btn.classList.remove('locked');
    btn.title = 'Student column is unlocked. Click to lock and prevent accidental edits.';
    btn.innerHTML = '<span class="lock-icon">🔓</span><span class="lock-label">Unlocked</span>';
  }
}

async function loadPermissions() {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('role, table_name, can_view, can_read, can_write, can_delete')
    .order('table_name')
    .order('role');
  if (error) {
    document.getElementById('msg').textContent = 'Failed to load permissions: ' + error.message;
    document.getElementById('msg').className = 'err';
    return;
  }
  allPermissions = data || [];
  renderMatrix();
}

function getPerm(resource, role, perm) {
  const row = allPermissions.find(
    (p) => p.table_name === resource && p.role === role
  );
  return row ? !!row[perm] : false;
}

function renderMatrix() {
  const resources = [...new Set(allPermissions.map((p) => p.table_name))].sort(
    (a, b) => {
      const aPage = a.startsWith('page:') ? 0 : 1;
      const bPage = b.startsWith('page:') ? 0 : 1;
      if (aPage !== bPage) return aPage - bPage;
      return a.localeCompare(b);
    }
  );
  const tbody = document.getElementById('permBody');
  let html = '';
  for (const res of resources) {
    const label = labelFor(res);
    const isPage = res.startsWith('page:');
    html += '<tr>';
    html +=
      '<td class="table-label">' +
      escapeHtml(label) +
      (isPage ? '' : '<span class="table-desc">' + escapeHtml(res) + '</span>') +
      '</td>';
    for (const role of ROLES) {
      const isStudent = role === 'student';
      html += '<td class="perm-cell' + (isStudent ? ' student-perm-cell' + (studentLocked ? ' col-locked' : '') : '') + '"><div class="rwd-group">';
      for (const perm of PERMS) {
        const checked = getPerm(res, role, perm);
        const id = 'cb_' + res.replace(/[^a-z0-9]/gi, '_') + '_' + role + '_' + perm;
        html +=
          '<label class="cb-wrap ' +
          PERM_CLASSES[perm] +
          '" title="' +
          perm.replace('_', ' ') +
          '">' +
          '<input type="checkbox" data-resource="' +
          escapeHtml(res) +
          '" data-role="' +
          escapeHtml(role) +
          '" data-perm="' +
          perm +
          '" id="' +
          escapeHtml(id) +
          '" ' +
          (checked ? 'checked' : '') +
          '><span class="cb-box">' +
          PERM_LETTERS[perm] +
          '</span></label>';
      }
      html += '</div></td>';
    }
    html += '</tr>';
  }
  tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">No permissions in database. Run rbac-setup.sql in Supabase.</td></tr>';
}

function collectMatrixState() {
  const rows = [];
  const checks = document.querySelectorAll('#permBody input[type="checkbox"]');
  const byKey = {};
  checks.forEach((input) => {
    const resource = input.dataset.resource;
    const role = input.dataset.role;
    const perm = input.dataset.perm;
    const key = resource + '|' + role;
    if (!byKey[key]) {
      byKey[key] = {
        role,
        table_name: resource,
        can_view: false,
        can_read: false,
        can_write: false,
        can_delete: false,
      };
    }
    byKey[key][perm] = input.checked;
  });
  return Object.values(byKey);
}

async function savePermissions() {
  const msgEl = document.getElementById('msg');
  const btn = document.getElementById('savePermsBtn');
  const rows = collectMatrixState();
  btn.disabled = true;
  msgEl.textContent = 'Saving…';
  msgEl.className = '';
  const { error } = await supabase.from('role_permissions').upsert(rows, {
    onConflict: 'role,table_name',
    ignoreDuplicates: false,
  });
  if (error) {
    msgEl.textContent = 'Save failed: ' + error.message;
    msgEl.className = 'err';
    btn.disabled = false;
    return;
  }
  msgEl.textContent = 'Saved.';
  msgEl.className = 'ok';
  allPermissions = rows;
  btn.disabled = false;
}

async function loadUserCounts() {
  for (const role of ROLES) {
    const r = role.charAt(0).toUpperCase() + role.slice(1);
    const id = 'stat' + r;
    const el = document.getElementById(id);
    if (!el) continue;
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .ilike('role', role);
    el.textContent = error ? '--' : (count ?? 0);
  }
}

async function loadUsersTab() {
  const search = (document.getElementById('userSearch') || {}).value || '';
  const roleFilter = (document.getElementById('userRoleFilter') || {}).value || '';
  let q = supabase.from('users').select('id, name, email, role').order('name');
  if (roleFilter) q = q.ilike('role', roleFilter);
  if (search.trim()) {
    q = q.or('name.ilike.%' + search.trim() + '%,email.ilike.%' + search.trim() + '%');
  }
  const { data: users, error } = await q;
  const grid = document.getElementById('userGrid');
  const empty = document.getElementById('userEmpty');
  const countLabel = document.getElementById('userCount');
  if (error) {
    grid.innerHTML = '<p style="color:#b91c1c;">Failed to load users.</p>';
    empty.style.display = 'none';
    if (countLabel) countLabel.textContent = '';
    return;
  }
  const list = users || [];
  if (countLabel) countLabel.textContent = list.length + ' user(s)';
  if (list.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = list
    .map(
      (u) =>
        '<div class="user-card">' +
        '<div class="user-avatar">' +
        (u.name || u.email || '?').toString().substring(0, 2).toUpperCase() +
        '</div>' +
        '<div class="user-info">' +
        '<div class="user-name">' +
        escapeHtml(u.name || '—') +
        '</div>' +
        '<div class="user-email">' +
        escapeHtml(u.email || '') +
        '</div>' +
        '<span class="user-role ' +
        (u.role || '').toLowerCase() +
        '">' +
        escapeHtml((u.role || '').toLowerCase()) +
        '</span>' +
        '</div></div>'
    )
    .join('');
}

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  const tab = document.querySelector('.tab[data-tab="' + tabId + '"]');
  const sec = document.getElementById('sec-' + tabId);
  if (tab) tab.classList.add('active');
  if (sec) sec.classList.add('active');
  if (tabId === 'users') loadUsersTab();
}

async function boot() {
  const ok = await initAuthGuard();
  if (!ok) return;
  if (!canView('page:rbac')) {
    document.body.innerHTML = '<div class="page"><p class="nav"><a href="dashboard.html" class="back-link">← Back to Dashboard</a></p><div class="card"><p>You do not have access to Access Control.</p></div></div>';
    return;
  }
  await loadUserCounts();
  await loadPermissions();
  document.getElementById('savePermsBtn').addEventListener('click', savePermissions);

  const lockBtn = document.getElementById('studentLockBtn');
  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      studentLocked = !studentLocked;
      applyStudentLock();
    });
  }

  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
  const userSearch = document.getElementById('userSearch');
  const userRoleFilter = document.getElementById('userRoleFilter');
  if (userSearch) userSearch.addEventListener('input', () => loadUsersTab());
  if (userRoleFilter) userRoleFilter.addEventListener('change', () => loadUsersTab());
}

boot();
