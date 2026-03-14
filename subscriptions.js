import { supabase, initAuthGuard } from './auth-guard.js';

const tbody = document.getElementById('tbody');
const emptyMsg = document.getElementById('emptyMsg');
const countLabel = document.getElementById('countLabel');
const searchName = document.getElementById('searchName');
const filterStatus = document.getElementById('filterStatus');
const statActive = document.getElementById('statActive');
const statQuota = document.getElementById('statQuota');
const statExpired = document.getElementById('statExpired');
const statOff = document.getElementById('statOff');
const modalMsg = document.getElementById('modalMsg');

// Edit modal
const editModal = document.getElementById('editModal');
const editSubId = document.getElementById('editSubId');
const editCourse = document.getElementById('editCourse');
const editPackageName = document.getElementById('editPackageName');
const editMcqLimit = document.getElementById('editMcqLimit');
const editDays = document.getElementById('editDays');
const editPriority = document.getElementById('editPriority');
const editActive = document.getElementById('editActive');
const modalSave = document.getElementById('modalSave');
const modalCancel = document.getElementById('modalCancel');

// Add modal
const addModal = document.getElementById('addModal');
const addStudentSearch = document.getElementById('addStudentSearch');
const addStudentList = document.getElementById('addStudentList');
const addStudentSelectAll = document.getElementById('addStudentSelectAll');
const addCourseSelect = document.getElementById('addCourseSelect');
const addPackageName = document.getElementById('addPackageName');
const addMcqLimit = document.getElementById('addMcqLimit');
const addDays = document.getElementById('addDays');
const addPriority = document.getElementById('addPriority');
const addActive = document.getElementById('addActive');
const addSave = document.getElementById('addSave');
const addCancel = document.getElementById('addCancel');
const addModalMsg = document.getElementById('addModalMsg');
const btnAddSub = document.getElementById('btnAddSub');

let allSubs = [];
let allStudents = [];
let allSubjects = [];
let allCourses = [];
let selectedStudentIds = [];

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = 'msg ' + (type || '');
}

function subStatus(sub) {
  if (!sub.is_active) return 'off';
  const now = new Date();
  const exp = new Date(sub.expires_at);
  if (exp < now) return 'expired';
  if (sub.mcq_limit > 0 && sub.mcqs_used >= sub.mcq_limit) return 'exhausted';
  return 'active';
}

function statusLabel(status) {
  if (status === 'active') return '<span class="status-ok">Active</span>';
  if (status === 'expired') return '<span class="status-expired">Expired</span>';
  if (status === 'exhausted') return '<span class="status-exhausted">Exhausted</span>';
  return '<span class="status-off">Deactivated</span>';
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString();
}

function getStudentRoll(userId) {
  const s = allStudents.find(u => u.id === userId);
  return s ? (s.roll || '—') : '—';
}

function renderTable() {
  const search = (searchName.value || '').toLowerCase();
  const statusFilter = filterStatus.value;

  const filtered = allSubs.filter(s => {
    const nameMatch = (s.student_name || '').toLowerCase().includes(search) ||
      (s.email || '').toLowerCase().includes(search);
    const status = subStatus(s);
    const statusMatch = !statusFilter || status === statusFilter;
    return nameMatch && statusMatch;
  });

  countLabel.textContent = filtered.length + ' subscription' + (filtered.length !== 1 ? 's' : '');

  // Stats
  const active = allSubs.filter(s => subStatus(s) === 'active');
  const withQuota = active.filter(s => (s.mcq_limit - s.mcqs_used) > 0);
  const expired = allSubs.filter(s => subStatus(s) === 'expired' || subStatus(s) === 'exhausted');
  const off = allSubs.filter(s => subStatus(s) === 'off');
  statActive.textContent = active.length;
  statQuota.textContent = withQuota.length;
  statExpired.textContent = expired.length;
  statOff.textContent = off.length;

  if (!filtered.length) {
    tbody.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';

  tbody.innerHTML = filtered.map(s => {
    const status = subStatus(s);
    const remaining = Math.max(0, s.mcq_limit - s.mcqs_used);
    return `<tr>
      <td>${esc(s.student_name || '—')}</td>
      <td>${esc(s.email || '—')}</td>
      <td>${esc(s.class != null ? s.class : '—')}</td>
      <td>${esc(s.course || '—')}</td>
      <td>${esc(getStudentRoll(s.user_id))}</td>
      <td>${esc(s.package_name)}</td>
      <td>${s.mcq_limit}</td>
      <td>${s.mcqs_used}</td>
      <td>${remaining}</td>
      <td>${formatDate(s.expires_at)}</td>
      <td>${statusLabel(status)}</td>
      <td>
        <button class="btn-edit" data-id="${s.id}">Edit</button>
        <button class="btn-delete" data-id="${s.id}">Delete</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteSub(btn.dataset.id));
  });
}

async function loadSubs() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showMsg(modalMsg, 'Failed to load subscriptions: ' + error.message, 'err');
    return;
  }
  allSubs = data || [];
  renderTable();
}

async function loadStudents() {
  const { data } = await supabase
    .from('users')
    .select('id, name, email, roll')
    .eq('role', 'student')
    .order('name');
  allStudents = data || [];
  renderStudentList();
}

function renderStudentList(filterText = '') {
  if (!addStudentList) return;
  const q = (filterText || '').toLowerCase();
  const rows = allStudents.filter(s => {
    const name = (s.name || '').toLowerCase();
    const email = (s.email || '').toLowerCase();
    const roll = (s.roll || '').toString().toLowerCase();
    if (!q) return true;
    return name.includes(q) || email.includes(q) || roll.includes(q);
  });
  addStudentList.innerHTML = rows.map(s => {
    const id = s.id;
    const checked = selectedStudentIds.includes(id) ? 'checked' : '';
    const roll = s.roll != null ? `Roll: ${s.roll}` : '';
    return `<div class="student-row">
      <input type="checkbox" class="student-check" data-id="${id}" ${checked}>
      <div>
        <div class="student-main">${esc(s.name || '—')}</div>
        <div class="student-email">${esc(s.email || '')}</div>
        <div class="student-meta">${esc(roll)}</div>
      </div>
    </div>`;
  }).join('');

  const checks = addStudentList.querySelectorAll('.student-check');
  checks.forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.getAttribute('data-id');
      if (cb.checked) {
        if (!selectedStudentIds.includes(id)) selectedStudentIds.push(id);
      } else {
        selectedStudentIds = selectedStudentIds.filter(x => x !== id);
      }
      if (addStudentSelectAll) {
        const allEnabled = Array.from(addStudentList.querySelectorAll('.student-check')).every(c => c.checked);
        addStudentSelectAll.checked = allEnabled && rows.length > 0;
      }
    });
  });

  if (addStudentSelectAll) {
    const allEnabled = rows.length > 0 && rows.every(s => selectedStudentIds.includes(s.id));
    addStudentSelectAll.checked = allEnabled;
  }
}

async function loadSubjects() {
  const { data } = await supabase.from('subjects').select('id, name').order('name');
  allSubjects = data || [];
}

async function loadCourses() {
  const { data, error } = await supabase.from('coursestructure').select('Course').order('Course');
  if (error) return;
  const names = [...new Set((data || []).map(r => r.Course).filter(Boolean))];
  allCourses = names;
  const optionsHtml = ['<option value="">— Select course —</option>']
    .concat(names.map(c => `<option value="${esc(c)}">${esc(c)}</option>`))
    .join('');
  if (addCourseSelect) addCourseSelect.innerHTML = optionsHtml;
  if (editCourse) editCourse.innerHTML = optionsHtml;
}

// Subject multi-select helpers
function buildSubjectCheckboxes(containerId, selected = []) {
  const panel = document.querySelector('#' + containerId + ' .subject-dropdown-panel');
  const btn = document.querySelector('#' + containerId + ' .subject-dropdown-btn');
  if (!panel) return;

  if (!allSubjects.length) {
    panel.innerHTML = '<div class="subject-dropdown-empty">No subjects found</div>';
    return;
  }

  panel.innerHTML = allSubjects.map(s => `
    <label>
      <input type="checkbox" value="${esc(s.name)}" ${selected.includes(s.name) ? 'checked' : ''}>
      ${esc(s.name)}
    </label>`).join('');

  panel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => updateSubjectBtnLabel(containerId));
  });

  updateSubjectBtnLabel(containerId);

  btn.onclick = () => panel.classList.toggle('open');
  document.addEventListener('click', (e) => {
    if (!document.getElementById(containerId).contains(e.target)) {
      panel.classList.remove('open');
    }
  }, { once: false });
}

function updateSubjectBtnLabel(containerId) {
  const checked = Array.from(document.querySelectorAll('#' + containerId + ' input[type="checkbox"]:checked'));
  const btn = document.querySelector('#' + containerId + ' .subject-dropdown-btn');
  btn.textContent = checked.length === 0 ? 'All subjects' : checked.map(c => c.value).join(', ');
}

function getSelectedSubjects(containerId) {
  return Array.from(document.querySelectorAll('#' + containerId + ' input[type="checkbox"]:checked'))
    .map(c => c.value);
}

function openEditModal(id) {
  const sub = allSubs.find(s => s.id === id);
  if (!sub) return;

  editSubId.value = sub.id;
  if (editCourse) editCourse.value = sub.course || '';
  editPackageName.value = sub.package_name || '';
  editMcqLimit.value = sub.mcq_limit;
  editDays.value = '';
  editPriority.value = sub.priority || 0;
  editActive.value = sub.is_active ? 'true' : 'false';

  const selected = sub.allowed_subjects
    ? sub.allowed_subjects.split(',').map(x => x.trim()).filter(Boolean)
    : [];
  buildSubjectCheckboxes('editAllowedSubjects', selected);

  showMsg(modalMsg, '', '');
  editModal.classList.add('show');
}

modalCancel.addEventListener('click', () => editModal.classList.remove('show'));
editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.classList.remove('show'); });

modalSave.addEventListener('click', async () => {
  const id = editSubId.value;
  const sub = allSubs.find(s => s.id === id);
  if (!sub) return;

  const packageName = editPackageName.value.trim();
  const mcqLimit = parseInt(editMcqLimit.value, 10);
  const days = parseInt(editDays.value, 10);
  const priority = parseInt(editPriority.value, 10) || 0;
  const isActive = editActive.value === 'true';
  const subjects = getSelectedSubjects('editAllowedSubjects');

  if (!packageName || isNaN(mcqLimit) || mcqLimit < 1) {
    showMsg(modalMsg, 'Package name and MCQ limit are required.', 'err');
    return;
  }

  const updates = {
    course: editCourse ? (editCourse.value || null) : sub.course || null,
    package_name: packageName,
    mcq_limit: mcqLimit,
    priority,
    is_active: isActive,
    allowed_subjects: subjects.length ? subjects.join(',') : null,
  };

  if (!isNaN(days) && days > 0) {
    updates.expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  modalSave.disabled = true;
  const { error } = await supabase.from('subscriptions').update(updates).eq('id', id);
  modalSave.disabled = false;

  if (error) {
    showMsg(modalMsg, 'Save failed: ' + error.message, 'err');
    return;
  }

  editModal.classList.remove('show');
  showMsg(modalMsg, 'Saved.', 'ok');
  await loadSubs();
});

btnAddSub.addEventListener('click', async () => {
  addPackageName.value = 'Free Trial';
  addMcqLimit.value = '100';
  addDays.value = '15';
  addPriority.value = '0';
  addActive.value = 'true';
  selectedStudentIds = [];
  if (addCourseSelect) addCourseSelect.value = '';
  renderStudentList('');
  if (addStudentSearch) addStudentSearch.value = '';
  if (addStudentSelectAll) addStudentSelectAll.checked = false;
  buildSubjectCheckboxes('addAllowedSubjects', []);
  showMsg(addModalMsg, '', '');
  addModal.classList.add('show');
});

addCancel.addEventListener('click', () => addModal.classList.remove('show'));
addModal.addEventListener('click', (e) => { if (e.target === addModal) addModal.classList.remove('show'); });

if (addStudentSearch) {
  addStudentSearch.addEventListener('input', () => {
    renderStudentList(addStudentSearch.value || '');
  });
}

if (addStudentSelectAll) {
  addStudentSelectAll.addEventListener('change', () => {
    if (!addStudentList) return;
    const checks = addStudentList.querySelectorAll('.student-check');
    selectedStudentIds = [];
    checks.forEach(cb => {
      cb.checked = addStudentSelectAll.checked;
      if (cb.checked) selectedStudentIds.push(cb.getAttribute('data-id'));
    });
  });
}

addSave.addEventListener('click', async () => {
  const userIds = selectedStudentIds.slice();
  const courseName = addCourseSelect ? addCourseSelect.value.trim() : '';
  const packageName = addPackageName.value.trim();
  const mcqLimit = parseInt(addMcqLimit.value, 10);
  const days = parseInt(addDays.value, 10);
  const priority = parseInt(addPriority.value, 10) || 0;
  const isActive = addActive.value === 'true';
  const subjects = getSelectedSubjects('addAllowedSubjects');

  if (!userIds.length) { showMsg(addModalMsg, 'Select at least one student.', 'err'); return; }
  if (!courseName) { showMsg(addModalMsg, 'Select a course.', 'err'); return; }
  if (!packageName) { showMsg(addModalMsg, 'Enter a package name.', 'err'); return; }
  if (isNaN(mcqLimit) || mcqLimit < 1) { showMsg(addModalMsg, 'Enter a valid MCQ limit.', 'err'); return; }
  if (isNaN(days) || days < 1) { showMsg(addModalMsg, 'Enter valid days.', 'err'); return; }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const payloads = userIds.map(id => {
    const student = allStudents.find(s => s.id === id);
    return {
      user_id: id,
      student_name: student ? (student.name || student.email) : '',
      email: student ? student.email : '',
      course: courseName,
      package_name: packageName,
      mcq_limit: mcqLimit,
      mcqs_used: 0,
      starts_at: now.toISOString(),
      expires_at: expiresAt,
      is_active: isActive,
      priority,
      allowed_subjects: subjects.length ? subjects.join(',') : null,
    };
  });

  addSave.disabled = true;
  const { error } = await supabase.from('subscriptions').insert(payloads);
  addSave.disabled = false;

  if (error) {
    showMsg(addModalMsg, 'Failed: ' + error.message, 'err');
    return;
  }

  addModal.classList.remove('show');
  showMsg(modalMsg, 'Subscription(s) added.', 'ok');
  await loadSubs();
});

async function deleteSub(id) {
  if (!confirm('Delete this subscription? This cannot be undone.')) return;
  const { error } = await supabase.from('subscriptions').delete().eq('id', id);
  if (error) {
    showMsg(modalMsg, 'Delete failed: ' + error.message, 'err');
    return;
  }
  showMsg(modalMsg, 'Deleted.', 'ok');
  await loadSubs();
}

searchName.addEventListener('input', renderTable);
filterStatus.addEventListener('change', renderTable);

(async function init() {
  const ok = await initAuthGuard();
  if (!ok) return;
  await Promise.all([loadStudents(), loadSubjects(), loadCourses()]);
  await loadSubs();
})();
