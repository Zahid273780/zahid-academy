import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

var SUPABASE_URL = 'https://uygtxlehwtgaftcwsxrr.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z3R4bGVod3RnYWZ0Y3dzeHJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDIxMjIsImV4cCI6MjA4ODQ3ODEyMn0.5rW1hnEffnlWU57jT-IA3L0sOHY8aagTmMmpcZw-0mk';

var supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var _authUser = null;
var _authPerms = {};

var PAGE_TABLE_MAP = {
  'dashboard.html':        'page:dashboard',
  'Navi_for_admin.html':   'page:dashboard',
  'user-form.html':        'page:user-form',
  'import-users.html':     'page:import-users',
  'users.html':            'page:users',
  'admission.html':        'page:admission',
  'students.html':         'page:students',
  'mcqs.html':             'page:manage-mcqs',
  'bulkimport.html':       'page:import-mcqs',
  'publisher.html':        'page:publisher',
  'subjects.html':         'page:subjects',
  'course-structure.html': 'page:course-structure',
  'results.html':          'page:results',
  'subscriptions.html':    'page:subscriptions',
  'rbac.html':             'page:rbac',
  'attendance.html':       'page:attendance',
  'announcements.html':         'page:announcements',
  'motivational-messages.html': 'page:motivational-messages',
  'quotes.html':                'page:quotes',
};

var PAGE_DB_MAP = {
  'page:admission':        'admission_form',
  'page:students':         'admission_form',
  'page:import-mcqs':      'mcqs',
  'page:manage-mcqs':      'mcqs',
  'page:publisher':        'mcqs',
  'page:results':          'studentpractice',
  'page:course-structure': 'coursestructure',
  'page:subjects':         'subjects',
  'page:user-form':        'users',
  'page:import-users':     'users',
  'page:users':            'users',
  'page:subscriptions':    'subscriptions',
  'page:rbac':             'role_permissions',
  'page:attendance':       'attendance',
  'page:announcements':         'announcements',
  'page:motivational-messages': 'motivational_messages',
  'page:quotes':                'quotes',
};

var NAV_LINKS = [
  { href: 'user-form.html',        label: 'User Entry Form',   table: 'page:user-form' },
  { href: 'import-users.html',     label: 'Bulk Import',       table: 'page:import-users' },
  { href: 'admission.html',        label: 'Admission',         table: 'page:admission' },
  { href: 'students.html',         label: 'Students',          table: 'page:students' },
  { href: 'users.html',            label: 'Users',             table: 'page:users' },
  { href: 'course-structure.html', label: 'Course Structure',  table: 'page:course-structure' },
  { href: 'bulkimport.html',       label: 'Bulk Import MCQs',  table: 'page:import-mcqs' },
  { href: 'mcqs.html',             label: 'Manage MCQs',       table: 'page:manage-mcqs' },
  { href: 'subjects.html',         label: 'Subjects',          table: 'page:subjects' },
  { href: 'results.html',          label: 'Results',           table: 'page:results' },
  { href: 'publisher.html',        label: 'Publisher',         table: 'page:publisher' },
  { href: 'subscriptions.html',    label: 'Subscriptions',     table: 'page:subscriptions' },
  { href: 'attendance.html',      label: 'Attendance',        table: 'page:attendance' },
  { href: 'rbac.html',             label: 'Access Control',    table: 'page:rbac' },
  { href: 'announcements.html',         label: 'Announcements',          table: 'page:announcements' },
  { href: 'motivational-messages.html', label: 'Motivational Messages',    table: 'page:motivational-messages' },
  { href: 'quotes.html',                label: 'Quotes of the Day',         table: 'page:quotes' },
];

function injectLoginOverlay() {
  if (document.getElementById('authOverlay')) return;

  var overlay = document.createElement('div');
  overlay.id = 'authOverlay';
  overlay.innerHTML =
    '<div class="ag-backdrop">'
    + '<div class="ag-card">'
    + '<div class="ag-header">'
    + '<div class="ag-icon"><svg width="28" height="28" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>'
    + '<h2>Sign In Required</h2>'
    + '<p>Sign in with your account to access this page</p>'
    + '</div>'
    + '<form id="agLoginForm" class="ag-form">'
    + '<input type="email" id="agEmail" placeholder="Email" required autocomplete="email">'
    + '<input type="password" id="agPassword" placeholder="Password" required autocomplete="current-password">'
    + '<button type="submit" id="agSubmitBtn">Sign In</button>'
    + '<div id="agMsg" class="ag-msg"></div>'
    + '</form>'
    + '</div>'
    + '</div>';

  injectStyles();
  document.body.appendChild(overlay);

  document.getElementById('agLoginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msgEl = document.getElementById('agMsg');
    var btn = document.getElementById('agSubmitBtn');
    msgEl.textContent = '';
    msgEl.className = 'ag-msg';

    var email = document.getElementById('agEmail').value.trim();
    var password = document.getElementById('agPassword').value;

    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      var { data, error } = await supabase.auth.signInWithPassword({ email: email, password: password });
      if (error) {
        msgEl.textContent = error.message;
        msgEl.className = 'ag-msg err';
        btn.disabled = false;
        btn.textContent = 'Sign In';
        return;
      }

      var result = await checkSession();
      if (result) {
        msgEl.textContent = 'Signed in!';
        msgEl.className = 'ag-msg ok';
        setTimeout(function () {
          overlay.remove();
          window.location.reload();
        }, 300);
      } else {
        msgEl.textContent = 'You do not have access to this page.';
        msgEl.className = 'ag-msg err';
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    } catch (err) {
      msgEl.textContent = 'Network error. Try again.';
      msgEl.className = 'ag-msg err';
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

function injectAccessDenied() {
  if (document.getElementById('authOverlay')) return;

  var overlay = document.createElement('div');
  overlay.id = 'authOverlay';
  overlay.innerHTML =
    '<div class="ag-backdrop">'
    + '<div class="ag-card">'
    + '<div class="ag-header" style="background:linear-gradient(135deg,#991b1b,#dc2626);">'
    + '<div class="ag-icon"><svg width="28" height="28" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div>'
    + '<h2>Access Denied</h2>'
    + '<p>You do not have permission to view this page</p>'
    + '</div>'
    + '<div class="ag-form" style="text-align:center;">'
    + '<p style="color:#64748b;font-size:0.9rem;margin:0 0 16px;">Signed in as <strong>' + (_authUser ? _authUser.email : '') + '</strong> (' + (_authUser ? _authUser.role : '') + ')</p>'
    + '<p style="color:#94a3b8;font-size:0.82rem;margin:0 0 16px;">Contact your administrator to request access.</p>'
    + '<button id="agBackBtn" style="width:48%;margin-right:4%;">Go Back</button>'
    + '<button id="agLogoutBtn" style="width:48%;background:linear-gradient(135deg,#991b1b,#dc2626);">Sign Out</button>'
    + '</div>'
    + '</div>'
    + '</div>';

  injectStyles();
  document.body.appendChild(overlay);

  document.getElementById('agBackBtn').addEventListener('click', function () {
    window.history.back();
  });
  document.getElementById('agLogoutBtn').addEventListener('click', async function () {
    await logout();
  });
}

function injectStyles() {
  if (document.getElementById('agStyles')) return;
  var style = document.createElement('style');
  style.id = 'agStyles';
  style.textContent =
    '.ag-backdrop{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px}'
    + '.ag-card{background:#fff;border-radius:20px;width:100%;max-width:400px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.4)}'
    + '.ag-header{background:linear-gradient(135deg,#1e40af,#2563eb);padding:32px 28px 28px;text-align:center;position:relative}'
    + '.ag-header::after{content:"";position:absolute;bottom:-16px;left:0;right:0;height:32px;background:#fff;border-radius:50% 50% 0 0}'
    + '.ag-icon{width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;border:2px solid rgba(255,255,255,0.3)}'
    + '.ag-header h2{color:#fff;font-size:1.3rem;font-weight:800;margin:0 0 4px}'
    + '.ag-header p{color:rgba(255,255,255,0.8);font-size:0.82rem;margin:0}'
    + '.ag-form{padding:20px 28px 28px}'
    + '.ag-form input{width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:0.95rem;margin-bottom:12px;box-sizing:border-box;background:#f8fafc}'
    + '.ag-form input:focus{outline:none;border-color:#2563eb;background:#fff}'
    + '.ag-form button{width:100%;padding:14px;background:linear-gradient(135deg,#1e40af,#2563eb);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:4px}'
    + '.ag-form button:hover{opacity:0.9}'
    + '.ag-form button:disabled{opacity:0.6;cursor:not-allowed}'
    + '.ag-msg{text-align:center;margin-top:10px;padding:8px;border-radius:8px;font-size:0.85rem;font-weight:600}'
    + '.ag-msg.err{background:#fef2f2;color:#b91c1c}'
    + '.ag-msg.ok{background:#dcfce7;color:#16a34a}';
  document.head.appendChild(style);
}

async function checkSession() {
  var { data: sess } = await supabase.auth.getSession();
  if (!sess || !sess.session) return false;

  var userId = sess.session.user.id;
  var { data: profile } = await supabase.from('users').select('role, name, email').eq('id', userId).single();
  if (!profile) return false;

  var role = (profile.role || '').toLowerCase();

  _authUser = {
    id: userId,
    email: profile.email || sess.session.user.email,
    name: profile.name || '',
    role: role,
  };

  var { data: perms } = await supabase.from('role_permissions').select('*').eq('role', role);
  _authPerms = {};
  if (perms) {
    perms.forEach(function (p) {
      _authPerms[p.table_name] = {
        can_view: p.can_view !== undefined ? !!p.can_view : true,
        can_read: !!p.can_read,
        can_write: !!p.can_write,
        can_delete: !!p.can_delete,
      };
    });
  }

  if (role === 'admin') {
    [
      'users', 'admission_form', 'mcqs', 'studentpractice', 'subjects', 'coursestructure', 'role_permissions', 'attendance', 'announcements', 'motivational_messages', 'quotes',
      'page:login', 'page:portal', 'page:practice-test', 'page:give-test',
      'page:admission', 'page:students',
      'page:import-mcqs', 'page:manage-mcqs', 'page:publisher', 'page:results',
      'page:course-structure', 'page:subjects',
      'page:user-form', 'page:import-users', 'page:users', 'page:subscriptions', 'page:attendance', 'page:rbac', 'page:dashboard', 'page:announcements', 'page:motivational-messages', 'page:quotes',
    ].forEach(function (t) {
      _authPerms[t] = { can_view: true, can_read: true, can_write: true, can_delete: true };
    });
  }

  return true;
}

function getCurrentPageTable() {
  var path = window.location.pathname;
  var page = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  return PAGE_TABLE_MAP[page] || null;
}

async function initAuthGuard() {
  var ok = await checkSession();
  if (!ok) {
    injectLoginOverlay();
    return false;
  }

  var tableKey = getCurrentPageTable();
  if (tableKey && !canView(tableKey)) {
    injectAccessDenied();
    return false;
  }

  filterNavLinks();
  return true;
}

function filterNavLinks() {
  var allLinks = document.querySelectorAll('a[href]');
  allLinks.forEach(function (a) {
    var href = a.getAttribute('href');
    var match = NAV_LINKS.find(function (n) { return n.href === href; });
    if (match && !canView(match.table)) {
      var separator = a.previousElementSibling;
      if (separator && separator.tagName === 'SPAN' && separator.textContent.trim() === '|') {
        separator.style.display = 'none';
      }
      a.style.display = 'none';
    }
  });
}

function getAuthUser() { return _authUser; }
function getAuthPerms() { return _authPerms; }
function getSupabase() { return supabase; }

function canView(tableOrPageKey) {
  if (!_authUser) return false;
  if (_authUser.role === 'admin') return true;
  if (!_authPerms[tableOrPageKey]) return false;
  return !!_authPerms[tableOrPageKey].can_view;
}

function canRead(tableName) {
  if (!_authUser) return false;
  if (_authUser.role === 'admin') return true;
  return !!(_authPerms[tableName] && _authPerms[tableName].can_read);
}

function canWrite(tableName) {
  if (!_authUser) return false;
  if (_authUser.role === 'admin') return true;
  return !!(_authPerms[tableName] && _authPerms[tableName].can_write);
}

function canDelete(tableName) {
  if (!_authUser) return false;
  if (_authUser.role === 'admin') return true;
  return !!(_authPerms[tableName] && _authPerms[tableName].can_delete);
}

async function logout() {
  await supabase.auth.signOut();
  _authUser = null;
  _authPerms = {};
  window.location.reload();
}

export {
  supabase,
  initAuthGuard,
  getAuthUser,
  getAuthPerms,
  getSupabase,
  canView,
  canRead,
  canWrite,
  canDelete,
  logout,
  PAGE_DB_MAP,
};
