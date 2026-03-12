import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();
const TABLE = 'coursestructure';

const form = document.getElementById('form');
const formTitle = document.getElementById('formTitle');
let editingRow = null;
const submitBtn = document.getElementById('submitBtn');
const cancelEdit = document.getElementById('cancelEdit');
const tbody = document.getElementById('tbody');
const emptyEl = document.getElementById('empty');
const msgEl = document.getElementById('msg');

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = type || '';
}

function clearForm() {
  editingRow = null;
  formTitle.textContent = 'Add new';
  submitBtn.textContent = 'Save';
  cancelEdit.classList.add('hidden');
  form.reset();
}

function getRowPayload() {
  const tn = document.getElementById('fieldTestNumber').value.trim();
  return {
    'Course': document.getElementById('fieldCourse').value.trim(),
    'Class/Exam': document.getElementById('fieldClassExam').value.trim(),
    'Subject': document.getElementById('fieldSubject').value.trim(),
    'Unit': document.getElementById('fieldUnit').value.trim(),
    'Category': document.getElementById('fieldCategory').value.trim() || null,
    'Range': document.getElementById('fieldRange').value.trim() || null,
    'Test Number': tn === '' ? null : parseInt(tn, 10),
  };
}

function fillFormFromRow(row) {
  document.getElementById('fieldCourse').value = row.Course || '';
  document.getElementById('fieldClassExam').value = row['Class/Exam'] || '';
  document.getElementById('fieldSubject').value = row.Subject || '';
  document.getElementById('fieldUnit').value = row.Unit || '';
  document.getElementById('fieldCategory').value = row.Category || '';
  document.getElementById('fieldRange').value = row.Range || '';
  document.getElementById('fieldTestNumber').value = row['Test Number'] != null ? row['Test Number'] : '';
}

function setEdit(row) {
  editingRow = row;
  fillFormFromRow(row);
  formTitle.textContent = 'Edit';
  submitBtn.textContent = 'Update';
  cancelEdit.classList.remove('hidden');
}

function copyToForm(row) {
  editingRow = null;
  fillFormFromRow(row);
  formTitle.textContent = 'Add new';
  submitBtn.textContent = 'Save';
  cancelEdit.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showMsg('Form filled. Change any fields and click Save to add a new entry.', 'ok');
  setTimeout(() => showMsg('', ''), 3000);
}

async function load() {
  const { data, error } = await supabase.from(TABLE).select('*').order('Course');
  if (error) {
    showMsg('Error loading: ' + error.message, 'err');
    tbody.innerHTML = '';
    return;
  }
  const rows = (data || []).map(r => ({
    'Course': r.Course,
    'Class/Exam': r['Class/Exam'],
    'Subject': r.Subject,
    'Unit': r.Unit,
    'Category': r.Category,
    'Range': r.Range,
    'Test Number': r['Test Number'],
  }));
  if (rows.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  tbody.innerHTML = rows.map(r => {
    const tn = r['Test Number'] != null ? r['Test Number'] : '—';
    return `
      <tr>
        <td>${escapeHtml(r.Course || '—')}</td>
        <td>${escapeHtml(r['Class/Exam'] || '—')}</td>
        <td>${escapeHtml(r.Subject || '—')}</td>
        <td>${escapeHtml(r.Unit || '—')}</td>
        <td>${escapeHtml(r.Category || '—')}</td>
        <td>${escapeHtml(r.Range || '—')}</td>
        <td>${tn}</td>
        <td>
          <div class="actions">
            <button type="button" class="btn btn-copy btn-sm" data-copy title="Copy to form">Copy</button>
            <button type="button" class="btn btn-ghost btn-sm" data-edit>Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete>Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-copy]').forEach((btn, i) => {
    btn.addEventListener('click', () => copyToForm(rows[i]));
  });
  tbody.querySelectorAll('[data-edit]').forEach((btn, i) => {
    btn.addEventListener('click', () => setEdit(rows[i]));
  });
  tbody.querySelectorAll('[data-delete]').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this course structure?')) return;
      deleteRow(rows[i]);
    });
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function deleteRow(row) {
  const colClassExam = '"Class/Exam"';
  const colTestNumber = '"Test Number"';
  let q = supabase.from(TABLE).delete().eq('Course', row.Course).eq(colClassExam, row['Class/Exam']).eq('Subject', row.Subject).eq('Unit', row.Unit);
  if (row.Category != null) q = q.eq('Category', row.Category); else q = q.is('Category', null);
  if (row.Range != null) q = q.eq('Range', row.Range); else q = q.is('Range', null);
  if (row['Test Number'] != null) q = q.eq(colTestNumber, row['Test Number']); else q = q.is(colTestNumber, null);
  const { error } = await q;
  if (error) {
    showMsg('Delete failed: ' + error.message, 'err');
    return;
  }
  showMsg('Deleted.', 'ok');
  load();
  setTimeout(() => showMsg('', ''), 2000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = getRowPayload();

  if (editingRow) {
    const colClassExam = '"Class/Exam"';
    const colTestNumber = '"Test Number"';
    let q = supabase.from(TABLE).update(payload).eq('Course', editingRow.Course).eq(colClassExam, editingRow['Class/Exam']).eq('Subject', editingRow.Subject).eq('Unit', editingRow.Unit);
    if (editingRow.Category != null) q = q.eq('Category', editingRow.Category); else q = q.is('Category', null);
    if (editingRow.Range != null) q = q.eq('Range', editingRow.Range); else q = q.is('Range', null);
    if (editingRow['Test Number'] != null) q = q.eq(colTestNumber, editingRow['Test Number']); else q = q.is(colTestNumber, null);
    const { error } = await q;
    if (error) {
      showMsg('Update failed: ' + error.message, 'err');
      return;
    }
    showMsg('Updated.', 'ok');
  } else {
    const { error } = await supabase.from(TABLE).insert(payload);
    if (error) {
      showMsg('Save failed: ' + error.message, 'err');
      return;
    }
    showMsg('Saved.', 'ok');
  }
  clearForm();
  load();
  setTimeout(() => showMsg('', ''), 2000);
});

cancelEdit.addEventListener('click', clearForm);

load();
