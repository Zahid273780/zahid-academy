import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

let allUsers = [];
const tbody = document.getElementById('tbody');
const searchEl = document.getElementById('search');
const filterRoleEl = document.getElementById('filterRole');
const emptyEl = document.getElementById('empty');
const msgEl = document.getElementById('msg');

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = type || '';
}

function render(users) {
  if (users.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  tbody.innerHTML = users.map(u => `
    <tr data-id="${u.id}">
      <td>${(u.name || '').trim() || '—'}</td>
      <td>${u.email || '—'}</td>
      <td><span class="role-badge role-${(u.role || '').toLowerCase()}">${(u.role || '').toLowerCase() || '—'}</span></td>
      <td><button type="button" class="btn-del" data-id="${u.id}" data-email="${(u.email || '').replace(/"/g, '&quot;')}">Delete</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const email = btn.getAttribute('data-email');
      if (!confirm('Delete user "' + email + '"?\nThis removes them from auth and the users table.')) return;
      deleteUser(id);
    });
  });
}

function filter() {
  const q = (searchEl.value || '').trim().toLowerCase();
  const role = (filterRoleEl.value || '').trim().toLowerCase();
  let list = allUsers;
  if (q) {
    list = list.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }
  if (role) {
    list = list.filter(u => (u.role || '').toLowerCase() === role);
  }
  render(list);
}

async function loadUsers() {
  const { data, error } = await supabase.from('users').select('id, name, email, role').order('role').order('email');
  if (error) {
    showMsg('Error loading users: ' + error.message, 'err');
    return;
  }
  allUsers = data || [];
  filter();
}

async function deleteUser(userId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showMsg('Session expired. Please sign in again.', 'err');
    return;
  }
  showMsg('Deleting…', '');
  try {
    const res = await fetch('/api/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ userId: userId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showMsg(data.error || res.statusText || 'Delete failed', 'err');
      return;
    }
    showMsg('User deleted.', 'ok');
    allUsers = allUsers.filter(u => u.id !== userId);
    filter();
    setTimeout(() => showMsg('', ''), 2000);
  } catch (e) {
    showMsg(e.message || 'Network error', 'err');
  }
}

searchEl.addEventListener('input', filter);
filterRoleEl.addEventListener('change', filter);
await loadUsers();
