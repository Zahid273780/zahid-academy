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
const searchCourseEl = document.getElementById('searchCourse');
const searchTopicsEl = document.getElementById('searchTopics');
const sortToggleBtn  = document.getElementById('sortToggle');
const pageNavEl      = document.getElementById('pageNav');

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
let selectedTests = new Set();
let expandedTests = new Set();
const PAGE_SIZE = 1000;
let sortMode    = 'newest';
let currentPage = 0;
const DISPLAY_PAGE_SIZE = 50;

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
  let from = 0;
  let rows = [];

  while (true) {
    const { data, error } = await supabase
      .from('mcqs')
      .select('id, Course, "Class/Exam", Subject, Unit, Category, Topics, "Test Number", Question, "Option A", "Option B", "Option C", "Option D", "Correct Answer", Explanation, hide, created_at')
      .order('Course')
      .order('Subject')
      .order('Unit')
      .order('"Test Number"')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      showMsg('Error: ' + error.message, 'err');
      return;
    }

    const chunk = data || [];
    rows = rows.concat(chunk);

    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

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
        key,
        course, classExam, subject, unit, category, topics, testNum,
        mcqs: [],
        hide: row.hide,
        maxCreatedAt: row.created_at || null,
      });
    }
    const g = groups.get(key);
    g.mcqs.push(row);
    if (!row.hide) g.hide = false;
    const rca = row.created_at;
    if (rca && (!g.maxCreatedAt || rca > g.maxCreatedAt)) g.maxCreatedAt = rca;
  }

  allTests = Array.from(groups.values());
  expandedTests = new Set(Array.from(expandedTests).filter(k => allTests.some(t => t.key === k)));

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
  function opts(sel, values, current, isFirst) {
    const blank = isFirst ? '— All Courses —' : '— All —';
    sel.innerHTML = `<option value="">${blank}</option>` +
      values.map(v => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(v)}</option>`).join('');
    sel.disabled = false;
  }

  const uniq = (arr, key) => [...new Set(arr.map(t => t[key]).filter(Boolean))].sort();

  // Course: always all tests
  opts(selCourse, uniq(allTests, 'course'), selCourse.value, true);

  // Class/Exam: filtered by selected course
  const byCourse = selCourse.value ? allTests.filter(t => t.course === selCourse.value) : allTests;
  const validCE = uniq(byCourse, 'classExam');
  const curCE = validCE.includes(selClassExam.value) ? selClassExam.value : '';
  opts(selClassExam, validCE, curCE);
  selClassExam.value = curCE;

  // Subject: filtered by course + classExam
  const byCE = curCE ? byCourse.filter(t => t.classExam === curCE) : byCourse;
  const validSub = uniq(byCE, 'subject');
  const curSub = validSub.includes(selSubject.value) ? selSubject.value : '';
  opts(selSubject, validSub, curSub);
  selSubject.value = curSub;

  // Unit: filtered by course + classExam + subject
  const bySub = curSub ? byCE.filter(t => t.subject === curSub) : byCE;
  const validUnit = uniq(bySub, 'unit');
  const curUnit = validUnit.includes(selUnit.value) ? selUnit.value : '';
  opts(selUnit, validUnit, curUnit);
  selUnit.value = curUnit;

  // Category: filtered by all above
  const byUnit = curUnit ? bySub.filter(t => t.unit === curUnit) : bySub;
  const validCat = uniq(byUnit, 'category');
  const curCat = validCat.includes(selCategory.value) ? selCategory.value : '';
  opts(selCategory, validCat, curCat);
  selCategory.value = curCat;
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

  const q1 = (searchCourseEl?.value || '').trim().toLowerCase();
  const q2 = (searchTopicsEl?.value || '').trim().toLowerCase();
  if (q1) list = list.filter(t =>
    (t.course  || '').toLowerCase().includes(q1) ||
    (t.subject || '').toLowerCase().includes(q1) ||
    (t.unit    || '').toLowerCase().includes(q1)
  );
  if (q2) list = list.filter(t =>
    (t.topics || '').toLowerCase().includes(q2) ||
    String(t.testNum || '').includes(q2)
  );
  return list;
}

function getSortedFiltered() {
  const list = getFiltered();
  if (sortMode === 'newest') {
    return [...list].sort((a, b) => {
      const da = a.maxCreatedAt || '';
      const db = b.maxCreatedAt || '';
      return db > da ? 1 : db < da ? -1 : 0;
    });
  }
  return [...list].sort((a, b) => {
    for (const k of ['course', 'classExam', 'subject', 'unit']) {
      const av = (a[k] || '').toLowerCase();
      const bv = (b[k] || '').toLowerCase();
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return (Number(a.testNum) || 0) - (Number(b.testNum) || 0);
  });
}

function renderPageNav(total, totalPages) {
  if (!pageNavEl) return;
  if (total <= DISPLAY_PAGE_SIZE) { pageNavEl.innerHTML = ''; return; }
  const pageStart = currentPage * DISPLAY_PAGE_SIZE;
  const pageEnd   = Math.min(pageStart + DISPLAY_PAGE_SIZE, total);
  let html = `<span class="page-info">${pageStart + 1}–${pageEnd} of ${total} tests</span>`;
  html += `<button id="pgPrev" ${currentPage === 0 ? 'disabled' : ''}>‹ Prev</button>`;
  const maxBtns = 5;
  let startPg = Math.max(0, currentPage - Math.floor(maxBtns / 2));
  let endPg   = Math.min(totalPages - 1, startPg + maxBtns - 1);
  if (endPg - startPg < maxBtns - 1) startPg = Math.max(0, endPg - maxBtns + 1);
  for (let i = startPg; i <= endPg; i++) {
    html += `<button class="page-btn${i === currentPage ? ' active-page' : ''}" data-page="${i}">${i + 1}</button>`;
  }
  html += `<button id="pgNext" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Next ›</button>`;
  pageNavEl.innerHTML = html;
  pageNavEl.querySelector('#pgPrev')?.addEventListener('click', () => { currentPage--; render(); });
  pageNavEl.querySelector('#pgNext')?.addEventListener('click', () => { currentPage++; render(); });
  pageNavEl.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => { currentPage = parseInt(btn.dataset.page, 10); render(); });
  });
}

function render() {
  const list = getSortedFiltered();
  testListEl.innerHTML = '';
  emptyMsgEl.style.display = list.length ? 'none' : 'block';

  const totalPages = Math.max(1, Math.ceil(list.length / DISPLAY_PAGE_SIZE));
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  if (currentPage < 0) currentPage = 0;

  const pageStart = currentPage * DISPLAY_PAGE_SIZE;
  const pageItems = list.slice(pageStart, pageStart + DISPLAY_PAGE_SIZE);

  if (!list.length) { renderPageNav(0, 0); updateBulkBar(); return; }

  const canEdit = canWrite('mcqs');

  pageItems.forEach((test, tIdx) => {
    const globalIdx = pageStart + tIdx;
    const isHidden = test.hide;
    const isExpanded = expandedTests.has(test.key);
    const group = document.createElement('div');
    group.className = 'test-group';

    const allMcqs = test.mcqs;
    const previewText = allMcqs.length
      ? `${allMcqs.length} MCQ(s). Click "Show MCQs" to view and edit.`
      : 'No MCQs in this test.';
    const mcqHtml = allMcqs.map((q, i) => {
      const qId = esc(String(q.id));
      const question = esc(col(q, 'Question', 'question'));
      const optionA = esc(col(q, 'Option A', 'option_a'));
      const optionB = esc(col(q, 'Option B', 'option_b'));
      const optionC = esc(col(q, 'Option C', 'option_c'));
      const optionD = esc(col(q, 'Option D', 'option_d'));
      const explanation = esc(col(q, 'Explanation', 'explanation'));
      const correct = String(col(q, 'Correct Answer', 'correct_answer') || 'A').toUpperCase();
      const hiddenBadge = q.hide ? '<span class="badge badge-hidden" style="margin-left:8px;font-size:0.7rem;">Hidden MCQ</span>' : '';

      return `
        <div class="mcq-editor-item" data-mcq-id="${qId}">
          <div class="mcq-editor-title">Q${i + 1}${hiddenBadge}</div>
          <textarea class="mcq-input mcq-question" data-field="Question" rows="2" placeholder="Question">${question}</textarea>
          <div class="mcq-options-grid">
            <input class="mcq-input" data-field="Option A" placeholder="Option A" value="${optionA}">
            <input class="mcq-input" data-field="Option B" placeholder="Option B" value="${optionB}">
            <input class="mcq-input" data-field="Option C" placeholder="Option C" value="${optionC}">
            <input class="mcq-input" data-field="Option D" placeholder="Option D" value="${optionD}">
          </div>
          <div class="mcq-editor-bottom">
            <label class="mcq-correct-wrap">Correct
              <select class="mcq-input mcq-correct" data-field="Correct Answer">
                <option value="A" ${correct === 'A' ? 'selected' : ''}>A</option>
                <option value="B" ${correct === 'B' ? 'selected' : ''}>B</option>
                <option value="C" ${correct === 'C' ? 'selected' : ''}>C</option>
                <option value="D" ${correct === 'D' ? 'selected' : ''}>D</option>
              </select>
            </label>
            <input class="mcq-input" data-field="Explanation" placeholder="Explanation (optional)" value="${explanation}">
            <div class="mcq-editor-actions">
              <button class="btn mcq-save-btn" data-action="save-mcq" data-mcq-id="${qId}">Save</button>
              <button class="btn btn-delete" data-action="delete-mcq" data-mcq-id="${qId}">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    const bodyHtml = isExpanded
      ? `<div class="mcq-editors-wrap">${mcqHtml || '<div class="mcq-preview">No MCQs in this test.</div>'}</div>`
      : `<div class="mcq-preview">${previewText}</div>`;

    const toggleBtn = isHidden
      ? `<button class="btn btn-publish" data-action="publish">Publish</button>`
      : `<button class="btn btn-unpublish" data-action="unpublish">Unpublish</button>`;
    const showBtn = `<button class="btn btn-show-mcqs" data-action="toggle-mcqs">${isExpanded ? 'Hide MCQs' : 'Show MCQs'}</button>`;
    const deleteBtn = `<button class="btn btn-delete" data-action="delete">Delete</button>`;
    const editBtn   = `<button class="btn" data-action="edit" style="background:#eff6ff;color:#1d4ed8;border:1.5px solid #bfdbfe;">Edit</button>`;
    const btnHtml = canEdit ? showBtn + editBtn + toggleBtn + deleteBtn : showBtn;
    const checkHtml = canEdit ? `<input type="checkbox" class="test-group-check" data-tidx="${globalIdx}" ${selectedTests.has(test) ? 'checked' : ''}>` : '';

    group.innerHTML = `
      <div class="test-group-head">
        ${checkHtml}
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
          <span class="badge badge-count">${test.mcqs.length} MCQs</span>${test.mcqs.some(q=>q.hide) && test.mcqs.some(q=>!q.hide) ? '<span class="badge" style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;font-size:0.7rem;">⚠ mixed visibility</span>' : ''}
          ${btnHtml}
        </div>
      </div>
      <div class="test-group-body">${bodyHtml}</div>
    `;

    const checkEl = group.querySelector('.test-group-check');
    if (checkEl) {
      checkEl.addEventListener('change', () => {
        if (checkEl.checked) selectedTests.add(test);
        else selectedTests.delete(test);
        updateBulkBar();
      });
    }
    const editBtnEl = group.querySelector('[data-action="edit"]');
    if (editBtnEl) {
      editBtnEl.addEventListener('click', () => openEditModal(test));
    }
    const btn = group.querySelector('[data-action="publish"], [data-action="unpublish"]');
    if (btn) {
      btn.addEventListener('click', () => toggleTest(test, btn));
    }
    const showMcqsBtn = group.querySelector('[data-action="toggle-mcqs"]');
    if (showMcqsBtn) {
      showMcqsBtn.addEventListener('click', () => {
        if (expandedTests.has(test.key)) expandedTests.delete(test.key);
        else expandedTests.add(test.key);
        render();
      });
    }
    const delBtn = group.querySelector('[data-action="delete"]');
    if (delBtn) {
      delBtn.addEventListener('click', () => deleteTest(test, delBtn));
    }

    testListEl.appendChild(group);
  });

  renderPageNav(list.length, totalPages);
  updateBulkBar();
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
  selectedTests.delete(test);
  expandedTests.delete(test.key);
  showMsg(`Test #${test.testNum} deleted (${ids.length} MCQs removed).`, 'ok');
  updateStats();
  populateFilters();
  render();
}

function updateBulkBar() {
  let bar = document.getElementById('bulkDeleteBar');
  selectedTests = new Set(Array.from(selectedTests).filter(t => allTests.includes(t)));
  if (selectedTests.size === 0) {
    if (bar) bar.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bulkDeleteBar';
    bar.className = 'bulk-delete-bar';
    testListEl.parentNode.insertBefore(bar, testListEl);
  }
  const totalMcqs = Array.from(selectedTests).reduce((sum, t) => sum + t.mcqs.length, 0);
  bar.innerHTML = `
    <span class="bulk-count">${selectedTests.size} test(s) selected (${totalMcqs} MCQs)</span>
    <button class="btn-bulk-delete">Delete Selected</button>
    <button class="btn-bulk-cancel">Clear Selection</button>
  `;
  bar.querySelector('.btn-bulk-delete').addEventListener('click', bulkDeleteSelected);
  bar.querySelector('.btn-bulk-cancel').addEventListener('click', () => {
    selectedTests.clear();
    render();
  });
}

async function bulkDeleteSelected() {
  const tests = Array.from(selectedTests);
  const totalMcqs = tests.reduce((sum, t) => sum + t.mcqs.length, 0);
  if (!confirm(`Delete ${tests.length} test(s) (${totalMcqs} MCQs total)?\nThis cannot be undone.`)) return;

  const allIds = tests.flatMap(t => t.mcqs.map(q => q.id));
  showMsg('Deleting ' + tests.length + ' test(s)…', '');

  const { error } = await supabase
    .from('mcqs')
    .delete()
    .in('id', allIds);

  if (error) {
    showMsg('Bulk delete failed: ' + error.message, 'err');
    return;
  }

  allTests = allTests.filter(t => !selectedTests.has(t));
  expandedTests = new Set(Array.from(expandedTests).filter(k => allTests.some(t => t.key === k)));
  selectedTests.clear();
  showMsg(`Deleted ${tests.length} test(s) (${allIds.length} MCQs removed).`, 'ok');
  updateStats();
  populateFilters();
  render();
}

function findMcqById(mcqId) {
  for (const test of allTests) {
    const index = test.mcqs.findIndex(q => String(q.id) === String(mcqId));
    if (index !== -1) return { test, index, mcq: test.mcqs[index] };
  }
  return null;
}

testListEl.addEventListener('click', async (event) => {
  const saveBtn = event.target.closest('[data-action="save-mcq"]');
  if (saveBtn) {
    const mcqId = saveBtn.dataset.mcqId;
    const card = saveBtn.closest('.mcq-editor-item');
    if (!card) return;

    const payload = {
      Question: (card.querySelector('[data-field="Question"]')?.value || '').trim(),
      'Option A': (card.querySelector('[data-field="Option A"]')?.value || '').trim(),
      'Option B': (card.querySelector('[data-field="Option B"]')?.value || '').trim(),
      'Option C': (card.querySelector('[data-field="Option C"]')?.value || '').trim(),
      'Option D': (card.querySelector('[data-field="Option D"]')?.value || '').trim(),
      'Correct Answer': (card.querySelector('[data-field="Correct Answer"]')?.value || '').trim().toUpperCase(),
      Explanation: (card.querySelector('[data-field="Explanation"]')?.value || '').trim(),
    };

    if (!payload.Question) { showMsg('Question is required.', 'err'); return; }
    if (!payload['Option A']) { showMsg('Option A is required.', 'err'); return; }
    if (!payload['Option B']) { showMsg('Option B is required.', 'err'); return; }
    if (!['A', 'B', 'C', 'D'].includes(payload['Correct Answer'])) { showMsg('Correct Answer must be A, B, C, or D.', 'err'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const { error } = await supabase
      .from('mcqs')
      .update({
        'Question': payload.Question,
        'Option A': payload['Option A'],
        'Option B': payload['Option B'],
        'Option C': payload['Option C'] || null,
        'Option D': payload['Option D'] || null,
        'Correct Answer': payload['Correct Answer'],
        'Explanation': payload.Explanation || null,
      })
      .eq('id', mcqId);

    if (error) {
      showMsg('Save failed: ' + error.message, 'err');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      return;
    }

    const found = findMcqById(mcqId);
    if (found) {
      Object.assign(found.mcq, {
        'Question': payload.Question,
        'Option A': payload['Option A'],
        'Option B': payload['Option B'],
        'Option C': payload['Option C'] || null,
        'Option D': payload['Option D'] || null,
        'Correct Answer': payload['Correct Answer'],
        'Explanation': payload.Explanation || null,
      });
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
    showMsg('MCQ updated.', 'ok');
    return;
  }

  const deleteBtn = event.target.closest('[data-action="delete-mcq"]');
  if (deleteBtn) {
    const mcqId = deleteBtn.dataset.mcqId;
    if (!confirm('Delete this MCQ? This cannot be undone.')) return;

    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting…';

    const { error } = await supabase
      .from('mcqs')
      .delete()
      .eq('id', mcqId);

    if (error) {
      showMsg('Delete failed: ' + error.message, 'err');
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete';
      return;
    }

    allTests.forEach(test => {
      test.mcqs = test.mcqs.filter(q => String(q.id) !== String(mcqId));
      test.hide = !test.mcqs.some(q => !q.hide);
    });
    allTests = allTests.filter(test => test.mcqs.length > 0);
    selectedTests = new Set(Array.from(selectedTests).filter(t => allTests.includes(t)));
    expandedTests = new Set(Array.from(expandedTests).filter(k => allTests.some(t => t.key === k)));

    updateStats();
    populateFilters();
    render();
    showMsg('MCQ deleted.', 'ok');
  }
});

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

selCourse.addEventListener('change', () => {
  selClassExam.value = '';
  selSubject.value   = '';
  selUnit.value      = '';
  selCategory.value  = '';
  currentPage = 0;
  populateFilters();
  render();
});

selClassExam.addEventListener('change', () => {
  selSubject.value  = '';
  selUnit.value     = '';
  selCategory.value = '';
  currentPage = 0;
  populateFilters();
  render();
});

selSubject.addEventListener('change', () => {
  selUnit.value     = '';
  selCategory.value = '';
  currentPage = 0;
  populateFilters();
  render();
});

selUnit.addEventListener('change', () => {
  selCategory.value = '';
  currentPage = 0;
  populateFilters();
  render();
});

selCategory.addEventListener('change', () => {
  currentPage = 0;
  render();
});

[viewAll, viewPublished, viewHidden].forEach(btn => {
  btn.addEventListener('click', () => {
    viewMode = btn === viewAll ? 'all' : btn === viewPublished ? 'published' : 'hidden';
    [viewAll, viewPublished, viewHidden].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPage = 0;
    render();
  });
});

sortToggleBtn.addEventListener('click', () => {
  sortMode = sortMode === 'newest' ? 'alpha' : 'newest';
  sortToggleBtn.textContent = sortMode === 'newest' ? '⬇ Newest First' : '🔤 A–Z';
  sortToggleBtn.classList.toggle('active-sort', sortMode === 'newest');
  currentPage = 0;
  render();
});
sortToggleBtn.classList.add('active-sort');

[searchCourseEl, searchTopicsEl].forEach(el => {
  el.addEventListener('input', () => { currentPage = 0; render(); });
});

loadTests();
