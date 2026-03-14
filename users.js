import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

let allUsers = [];
const tbody = document.getElementById('tbody');
const searchEl = document.getElementById('search');
const filterRoleEl = document.getElementById('filterRole');
const emptyEl = document.getElementById('empty');
const msgEl = document.getElementById('msg');
const selectAllEl = document.getElementById('selectAll');
const deleteSelectedBtn = document.getElementById('deleteSelected');

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = type || '';
}

function updateBulkDeleteState() {
  const checks = Array.from(tbody.querySelectorAll('.row-check'));
  if (!checks.length) {
    deleteSelectedBtn.disabled = true;
    if (selectAllEl) selectAllEl.checked = false;
    return;
  }
  const enabledChecks = checks.filter(cb => !cb.disabled);
  const anyChecked = enabledChecks.some(cb => cb.checked);
  deleteSelectedBtn.disabled = !anyChecked;
  if (selectAllEl) {
    selectAllEl.checked = enabledChecks.length > 0 && enabledChecks.every(cb => cb.checked);
  }
}

function render(users) {
  if (users.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    updateBulkDeleteState();
    return;
  }
  emptyEl.classList.add('hidden');
  tbody.innerHTML = users.map(u => {
    const role = (u.role || '').toLowerCase();
    const isAdmin = role === 'admin';
    const canDelete = !isAdmin;
    const safeEmail = (u.email || '').replace(/"/g, '&quot;');
    const checkbox = `<input type="checkbox" class="row-check" data-id="${u.id}" ${canDelete ? '' : 'disabled'}>`;
    const actions = canDelete
      ? `<button type="button" class="btn-del" data-id="${u.id}" data-email="${safeEmail}">Delete</button>`
      : '';
    return `
      <tr data-id="${u.id}">
        <td>${checkbox}</td>
        <td>${(u.name || '').trim() || '—'}</td>
        <td>${u.email || '—'}</td>
        <td><span class="role-badge role-${role}">${role || '—'}</span></td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');

  const checks = Array.from(tbody.querySelectorAll('.row-check'));
  checks.forEach(cb => {
    cb.addEventListener('change', updateBulkDeleteState);
  });

  tbody.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const email = btn.getAttribute('data-email');
      if (!confirm('Delete user "' + email + '"?\nThis removes them from auth and the users table.')) return;
      deleteUser(id);
    });
  });

  if (selectAllEl) {
    selectAllEl.checked = false;
  }
  updateBulkDeleteState();
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
if (selectAllEl) {
  selectAllEl.addEventListener('change', () => {
    const checks = Array.from(tbody.querySelectorAll('.row-check'));
    checks.forEach(cb => {
      if (!cb.disabled) cb.checked = selectAllEl.checked;
    });
    updateBulkDeleteState();
  });
}

if (deleteSelectedBtn) {
  deleteSelectedBtn.addEventListener('click', async () => {
    const checks = Array.from(tbody.querySelectorAll('.row-check'));
    const ids = checks.filter(cb => cb.checked && !cb.disabled).map(cb => cb.getAttribute('data-id'));
    if (!ids.length) return;
    if (!confirm('Delete ' + ids.length + ' selected user(s)?\nThis removes them from auth and the users table.')) return;
    for (const id of ids) {
      // deleteUser updates allUsers and table each time
      await deleteUser(id);
    }
    updateBulkDeleteState();
  });
}

await loadUsers();
