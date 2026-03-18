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
const tableSearch = document.getElementById('tableSearch');

const SORT_KEYS = ['Course', 'Class/Exam', 'Subject', 'Unit', 'Category', 'Topics', 'Test Number'];
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

let allRows = [];
let searchTerm = '';
let sessionNewSignatures = [];
const defaultEmptyText = emptyEl.textContent;

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = type || '';
}

function rowSignature(row) {
  return SORT_KEYS.map((key) => {
    const value = row[key];
    return value == null ? '' : String(value).trim();
  }).join('|');
}

function removeNewSignature(signature) {
  sessionNewSignatures = sessionNewSignatures.filter((s) => s !== signature);
}

function normalizeValue(value) {
  if (value == null) return '';
  return String(value).trim();
}

function naturalCompareRows(a, b) {
  for (const key of SORT_KEYS) {
    const aValue = normalizeValue(a[key]);
    const bValue = normalizeValue(b[key]);

    if (!aValue && bValue) return 1;
    if (aValue && !bValue) return -1;

    const cmp = collator.compare(aValue, bValue);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

function getOrderedRows(rows) {
  const newRows = [];
  const existingRows = [];

  for (const row of rows) {
    const sig = rowSignature(row);
    const newIndex = sessionNewSignatures.indexOf(sig);
    if (newIndex >= 0) {
      newRows.push({ row, newIndex });
    } else {
      existingRows.push(row);
    }
  }

  newRows.sort((a, b) => a.newIndex - b.newIndex);
  existingRows.sort(naturalCompareRows);

  return [...newRows.map((item) => item.row), ...existingRows];
}

function matchesSearch(row, term) {
  if (!term) return true;
  const haystack = SORT_KEYS
    .map((key) => normalizeValue(row[key]).toLowerCase())
    .join(' ');
  return haystack.includes(term);
}

function getDisplayRows() {
  const orderedRows = getOrderedRows(allRows);
  if (!searchTerm) return orderedRows;
  return orderedRows.filter((row) => matchesSearch(row, searchTerm));
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
    'Topics': document.getElementById('fieldTopics').value.trim() || null,
    'Test Number': tn === '' ? null : parseInt(tn, 10),
  };
}

function fillFormFromRow(row) {
  document.getElementById('fieldCourse').value = row.Course || '';
  document.getElementById('fieldClassExam').value = row['Class/Exam'] || '';
  document.getElementById('fieldSubject').value = row.Subject || '';
  document.getElementById('fieldUnit').value = row.Unit || '';
  document.getElementById('fieldCategory').value = row.Category || '';
  document.getElementById('fieldTopics').value = row.Topics || '';
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

function renderRows() {
  const displayRows = getDisplayRows();

  if (displayRows.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    emptyEl.textContent = allRows.length === 0
      ? defaultEmptyText
      : 'No matching course structures found.';
    return;
  }

  emptyEl.classList.add('hidden');
  emptyEl.textContent = defaultEmptyText;

  tbody.innerHTML = displayRows.map(r => {
    const tn = r['Test Number'] != null ? r['Test Number'] : '—';
    return `
      <tr>
        <td>${escapeHtml(r.Course || '—')}</td>
        <td>${escapeHtml(r['Class/Exam'] || '—')}</td>
        <td>${escapeHtml(r.Subject || '—')}</td>
        <td>${escapeHtml(r.Unit || '—')}</td>
        <td>${escapeHtml(r.Category || '—')}</td>
        <td>${escapeHtml(r.Topics || '—')}</td>
        <td>${escapeHtml(String(tn))}</td>
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
    btn.addEventListener('click', () => copyToForm(displayRows[i]));
  });
  tbody.querySelectorAll('[data-edit]').forEach((btn, i) => {
    btn.addEventListener('click', () => setEdit(displayRows[i]));
  });
  tbody.querySelectorAll('[data-delete]').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this course structure?')) return;
      deleteRow(displayRows[i]);
    });
  });
}

async function load() {
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) {
    showMsg('Error loading: ' + error.message, 'err');
    allRows = [];
    tbody.innerHTML = '';
    return;
  }
  allRows = (data || []).map(r => ({
    'Course': r.Course,
    'Class/Exam': r['Class/Exam'],
    'Subject': r.Subject,
    'Unit': r.Unit,
    'Category': r.Category,
    'Topics': r.Topics,
    'Test Number': r['Test Number'],
  }));
  renderRows();
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
  if (row.Topics != null) q = q.eq('Topics', row.Topics); else q = q.is('Topics', null);
  if (row['Test Number'] != null) q = q.eq(colTestNumber, row['Test Number']); else q = q.is(colTestNumber, null);
  const { error } = await q;
  if (error) {
    showMsg('Delete failed: ' + error.message, 'err');
    return;
  }
  removeNewSignature(rowSignature(row));
  showMsg('Deleted.', 'ok');
  load();
  setTimeout(() => showMsg('', ''), 2000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = getRowPayload();

  if (editingRow) {
    const oldSignature = rowSignature(editingRow);
    const wasNew = sessionNewSignatures.includes(oldSignature);
    const colClassExam = '"Class/Exam"';
    const colTestNumber = '"Test Number"';
    let q = supabase.from(TABLE).update(payload).eq('Course', editingRow.Course).eq(colClassExam, editingRow['Class/Exam']).eq('Subject', editingRow.Subject).eq('Unit', editingRow.Unit);
    if (editingRow.Category != null) q = q.eq('Category', editingRow.Category); else q = q.is('Category', null);
    if (editingRow.Topics != null) q = q.eq('Topics', editingRow.Topics); else q = q.is('Topics', null);
    if (editingRow['Test Number'] != null) q = q.eq(colTestNumber, editingRow['Test Number']); else q = q.is(colTestNumber, null);
    const { error } = await q;
    if (error) {
      showMsg('Update failed: ' + error.message, 'err');
      return;
    }
    removeNewSignature(oldSignature);
    if (wasNew) {
      sessionNewSignatures.unshift(rowSignature(payload));
    }
    showMsg('Updated.', 'ok');
  } else {
    const { error } = await supabase.from(TABLE).insert(payload);
    if (error) {
      showMsg('Save failed: ' + error.message, 'err');
      return;
    }
    sessionNewSignatures.unshift(rowSignature(payload));
    showMsg('Saved.', 'ok');
  }
  clearForm();
  load();
  setTimeout(() => showMsg('', ''), 2000);
});

cancelEdit.addEventListener('click', clearForm);

if (tableSearch) {
  tableSearch.addEventListener('input', (e) => {
    searchTerm = String(e.target.value || '').trim().toLowerCase();
    renderRows();
  });
}

load();
