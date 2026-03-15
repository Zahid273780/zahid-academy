import { supabase, initAuthGuard, canWrite } from './auth-guard.js';
await initAuthGuard();

const selCourse    = document.getElementById('selCourse');
const selClassExam = document.getElementById('selClassExam');
const selSubject   = document.getElementById('selSubject');
const selUnit      = document.getElementById('selUnit');
const selCategory  = document.getElementById('selCategory');
const msgEl        = document.getElementById('msg');
const testListEl   = document.getElementById('testList');
const emptyMsgEl   = document.getElementById('emptyMsg');
const statTotal    = document.getElementById('statTotal');
const statVisible  = document.getElementById('statVisible');
const statHidden   = document.getElementById('statHidden');
const viewAll      = document.getElementById('viewAll');
const viewPublished = document.getElementById('viewPublished');
const viewHidden   = document.getElementById('viewHidden');

/* edit modal elements */
const editModal   = document.getElementById('editTestModal');
const etCourse    = document.getElementById('etCourse');
const etClassExam = document.getElementById('etClassExam');
const etSubject   = document.getElementById('etSubject');
const etUnit      = document.getElementById('etUnit');
const etCategory  = document.getElementById('etCategory');
const etTopics    = document.getElementById('etTopics');
const etTestNumber = document.getElementById('etTestNumber');
const etMsg       = document.getElementById('etMsg');
const etSaveBtn   = document.getElementById('etSaveBtn');
const etCancelBtn = document.getElementById('etCancelBtn');

let allTests = [];
let viewMode = 'all';
let editingTest = null;

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = type || '';
  if (type === 'ok') setTimeout(() => { msgEl.textContent = ''; msgEl.className = ''; }, 3000);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function col(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  return '';
}

async function loadTests() {
  showMsg('Loading…', '');
  const { data, error } = await supabase
    .from('mcqs')
    .select('id, Course, "Class/Exam", Subject, Unit, Category, Topics, "Test Number", Question, hide')
    .order('Course').order('Subject').order('Unit').order('"Test Number"');

  if (error) { showMsg('Error: ' + error.message, 'err'); return; }

  const rows = data || [];

  const groups = new Map();
  for (const row of rows) {
    const course    = col(row, 'Course', 'course');
    const classExam = col(row, 'Class/Exam', 'class_exam', 'classexam');
    const subject   = col(row, 'Subject', 'subject');
    const unit      = col(row, 'Unit', 'unit');
    const category  = col(row, 'Category', 'category');
    const topics    = col(row, 'Topics', 'topics');
    const testNum   = col(row, 'Test Number', 'test_number', 'testnumber');
    const key       = [course, classExam, subject, unit, category, testNum].join('|||');

    if (!groups.has(key)) {
      groups.set(key, {
        course, classExam, subject, unit, category, topics, testNum,
        mcqs: [],
        hide: row.hide,
      });
    }
    const g = groups.get(key);
    g.mcqs.push(row);
    if (!row.hide) g.hide = false;
  }

  allTests = Array.from(groups.values());

  updateStats();
  populateFilters();
  render();
  showMsg('', '');
}

function updateStats() {
  const total   = allTests.length;
  const visible = allTests.filter(t => !t.hide).length;
  const hidden  = allTests.filter(t =>  t.hide).length;
  if (statTotal)   statTotal.textContent   = total;
  if (statVisible) statVisible.textContent = visible;
  if (statHidden)  statHidden.textContent  = hidden;
}

function populateFilters() {
  function opts(sel, values, current) {
    sel.innerHTML = '<option value="">— All —</option>' +
      values.map(v => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }

  const unique = (key) => [...new Set(allTests.map(t => t[key]).filter(Boolean))].sort();

  opts(selCourse,    unique('course'),    selCourse.value);
  opts(selClassExam, unique('classExam'), selClassExam.value);
  opts(selSubject,   unique('subject'),   selSubject.value);
  opts(selUnit,      unique('unit'),      selUnit.value);
  opts(selCategory,  unique('category'),  selCategory.value);

  [selCourse, selClassExam, selSubject, selUnit, selCategory].forEach(s => {
    s.disabled = false;
  });
}

function getFiltered() {
  let list = allTests;
  if (selCourse.value)    list = list.filter(t => t.course    === selCourse.value);
  if (selClassExam.value) list = list.filter(t => t.classExam === selClassExam.value);
  if (selSubject.value)   list = list.filter(t => t.subject   === selSubject.value);
  if (selUnit.value)      list = list.filter(t => t.unit      === selUnit.value);
  if (selCategory.value)  list = list.filter(t => t.category  === selCategory.value);
  if (viewMode === 'published') list = list.filter(t => !t.hide);
  if (viewMode === 'hidden')    list = list.filter(t =>  t.hide);
  return list;
}

function render() {
  const list = getFiltered();
  testListEl.innerHTML = '';
  emptyMsgEl.style.display = list.length ? 'none' : 'block';
  if (!list.length) return;

  const canEdit = canWrite('mcqs');

  list.forEach(test => {
    const isHidden = test.hide;
    const group = document.createElement('div');
    group.className = 'test-group';

    const previewQs = test.mcqs.slice(0, 3);
    const previewHtml = previewQs.map((q, i) =>
      `<div class="mcq-preview"><span class="q-num">Q${i + 1}.</span><span class="q-text">${esc(col(q, 'Question', 'question'))}</span></div>`
    ).join('') + (test.mcqs.length > 3
      ? `<div class="mcq-preview" style="color:#94a3b8;">… and ${test.mcqs.length - 3} more question(s)</div>`
      : '');

    const toggleBtn = isHidden
      ? `<button class="btn btn-publish" data-action="publish">Publish</button>`
      : `<button class="btn btn-unpublish" data-action="unpublish">Unpublish</button>`;
    const deleteBtn = `<button class="btn btn-delete" data-action="delete">Delete</button>`;
    const editBtn   = `<button class="btn" data-action="edit" style="background:#eff6ff;color:#1d4ed8;border:1.5px solid #bfdbfe;">Edit</button>`;
    const btnHtml = canEdit ? editBtn + toggleBtn + deleteBtn : '';

    group.innerHTML = `
      <div class="test-group-head">
        <div class="test-group-info">
          <div class="test-group-title">
            Test #${esc(String(test.testNum))}
            ${test.category ? `<span class="badge badge-count" style="margin-left:8px;">${esc(test.category)}</span>` : ''}
          </div>
          <div class="test-group-meta">
            ${esc(test.course)} › ${esc(test.classExam)} › ${esc(test.subject)} › ${esc(test.unit)}
            ${test.topics ? `<span class="badge badge-count" style="margin-left:6px;background:#ede9fe;color:#6d28d9;border:1px solid #ddd6fe;">📚 ${esc(test.topics)}</span>` : ''}
          </div>
        </div>
        <div class="test-group-actions">
          <span class="badge ${isHidden ? 'badge-hidden' : 'badge-visible'}">${isHidden ? 'Hidden' : 'Published'}</span>
          <span class="badge badge-count">${test.mcqs.length} MCQs</span>
          ${btnHtml}
        </div>
      </div>
      <div class="test-group-body">${previewHtml}</div>
    `;

    const editBtnEl = group.querySelector('[data-action="edit"]');
    if (editBtnEl) {
      editBtnEl.addEventListener('click', () => openEditModal(test));
    }
    const btn = group.querySelector('[data-action="publish"], [data-action="unpublish"]');
    if (btn) {
      btn.addEventListener('click', () => toggleTest(test, btn));
    }
    const delBtn = group.querySelector('[data-action="delete"]');
    if (delBtn) {
      delBtn.addEventListener('click', () => deleteTest(test, delBtn));
    }

    testListEl.appendChild(group);
  });
}

async function toggleTest(test, btn) {
  const newHide = !test.hide;
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const ids = test.mcqs.map(q => q.id);
  const { error } = await supabase
    .from('mcqs')
    .update({ hide: newHide })
    .in('id', ids);

  if (error) {
    showMsg('Error: ' + error.message, 'err');
    btn.disabled = false;
    btn.textContent = newHide ? 'Unpublish' : 'Publish';
    return;
  }

  test.hide = newHide;
  test.mcqs.forEach(q => { q.hide = newHide; });
  showMsg(newHide ? 'Test hidden from students.' : 'Test published to students.', 'ok');
  updateStats();
  render();
}

async function deleteTest(test, btn) {
  const confirmed = confirm(`Delete Test #${test.testNum} (${test.mcqs.length} MCQs)?\nThis cannot be undone.`);
  if (!confirmed) return;

  btn.disabled = true;
  btn.textContent = 'Deleting…';

  const ids = test.mcqs.map(q => q.id);
  const { error } = await supabase
    .from('mcqs')
    .delete()
    .in('id', ids);

  if (error) {
    showMsg('Error: ' + error.message, 'err');
    btn.disabled = false;
    btn.textContent = 'Delete';
    return;
  }

  allTests = allTests.filter(t => t !== test);
  showMsg(`Test #${test.testNum} deleted (${ids.length} MCQs removed).`, 'ok');
  updateStats();
  populateFilters();
  render();
}

/* ─── edit modal ───────────────────────────────────── */

function showEtMsg(text, type) {
  etMsg.textContent = text;
  etMsg.style.display = text ? 'block' : 'none';
  etMsg.style.background = type === 'err' ? '#fef2f2' : '#f0fdf4';
  etMsg.style.color      = type === 'err' ? '#dc2626'  : '#166534';
}

function openEditModal(test) {
  editingTest = test;
  etCourse.value     = test.course    || '';
  etClassExam.value  = test.classExam || '';
  etSubject.value    = test.subject   || '';
  etUnit.value       = test.unit      || '';
  etCategory.value   = test.category  || '';
  etTopics.value     = test.topics    || '';
  etTestNumber.value = test.testNum   || '';
  showEtMsg('', '');
  etSaveBtn.disabled    = false;
  etSaveBtn.textContent = 'Save Changes';
  editModal.style.display = 'flex';
}

function closeEditModal() {
  editModal.style.display = 'none';
  editingTest = null;
}

etCancelBtn.addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });

etSaveBtn.addEventListener('click', async () => {
  const course    = etCourse.value.trim();
  const classExam = etClassExam.value.trim();
  const subject   = etSubject.value.trim();
  const unit      = etUnit.value.trim();
  const category  = etCategory.value.trim();
  const topics    = etTopics.value.trim();
  const testNum   = etTestNumber.value.trim();

  if (!course)    { showEtMsg('Course is required.', 'err'); return; }
  if (!classExam) { showEtMsg('Class/Exam is required.', 'err'); return; }
  if (!subject)   { showEtMsg('Subject is required.', 'err'); return; }
  if (!unit)      { showEtMsg('Unit is required.', 'err'); return; }
  if (!testNum)   { showEtMsg('Test Number is required.', 'err'); return; }

  etSaveBtn.disabled    = true;
  etSaveBtn.textContent = 'Saving…';

  const ids = editingTest.mcqs.map(q => q.id);
  const { error } = await supabase
    .from('mcqs')
    .update({
      'Course':       course,
      'Class/Exam':   classExam,
      'Subject':      subject,
      'Unit':         unit,
      'Category':     category || null,
      'Topics':       topics   || null,
      'Test Number':  parseInt(testNum, 10),
    })
    .in('id', ids);

  if (error) {
    showEtMsg('Save failed: ' + error.message, 'err');
    etSaveBtn.disabled    = false;
    etSaveBtn.textContent = 'Save Changes';
    return;
  }

  closeEditModal();
  showMsg('Test updated successfully.', 'ok');
  loadTests();
});

[selCourse, selClassExam, selSubject, selUnit, selCategory].forEach(s => {
  s.addEventListener('change', render);
});

[viewAll, viewPublished, viewHidden].forEach(btn => {
  btn.addEventListener('click', () => {
    viewMode = btn === viewAll ? 'all' : btn === viewPublished ? 'published' : 'hidden';
    [viewAll, viewPublished, viewHidden].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

loadTests();
