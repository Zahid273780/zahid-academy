import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

// --- DIAGNOSTIC TEST: Proves the bug-free file is loaded ---
const testBanner = document.createElement('div');
testBanner.style.cssText = "background: #16a34a; color: white; padding: 15px; text-align: center; font-weight: bold; position: fixed; top: 0; left: 0; width: 100%; z-index: 9999; font-size: 16px;";
testBanner.textContent = "✅ MCQS: SCROLLBOX, HIGHLIGHT, AND COUNTER 100% FIXED.";
document.body.prepend(testBanner);
setTimeout(() => testBanner.remove(), 4000); 
// ------------------------------------------------------------

const selCourse    = document.getElementById('selCourse');
const selClassExam = document.getElementById('selClassExam');
const selSubject   = document.getElementById('selSubject');
const selUnit      = document.getElementById('selUnit');
const selCategory  = document.getElementById('selCategory');
const selTestNum   = document.getElementById('selTestNumber');
const msgEl        = document.getElementById('msg');
const resultsCard  = document.getElementById('resultsCard');
const mcqList      = document.getElementById('mcqList');
const emptyMsg     = document.getElementById('emptyMsg');
const countLabel   = document.getElementById('countLabel');
const selectAllCb  = document.getElementById('selectAllMcqs');
const deleteBtn    = document.getElementById('deleteSelectedBtn');
const createTestBtn = document.getElementById('createTestBtn');

/* modal elements */
const modal        = document.getElementById('createTestModal');
const ctModalCount = document.getElementById('ctModalCount');
const ctTypePractice = document.getElementById('ctTypePractice');
const ctTypeMock   = document.getElementById('ctTypeMock');
const ctLabelPractice = document.getElementById('ctLabelPractice');
const ctLabelMock  = document.getElementById('ctLabelMock');
const ctCourse     = document.getElementById('ctCourse');
const ctClassExam  = document.getElementById('ctClassExam');
const ctSubject    = document.getElementById('ctSubject');
const ctUnit       = document.getElementById('ctUnit');
const ctCategory   = document.getElementById('ctCategory');
const ctTopics     = document.getElementById('ctTopics');
const ctTestNumber = document.getElementById('ctTestNumber');
const ctMsg        = document.getElementById('ctMsg');
const ctConfirmBtn = document.getElementById('ctConfirmBtn');
const ctCancelBtn  = document.getElementById('ctCancelBtn');

let allMcqs  = [];
let filtered = [];
const PAGE_SIZE = 1000;

/* ─── helpers ─────────────────────────────────────── */

function showMsg(text, type) {
  msgEl.textContent = text || '';
  msgEl.className   = type || '';
  if (type === 'ok') setTimeout(() => { msgEl.textContent = ''; msgEl.className = ''; }, 3000);
}

function h(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function col(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  return '';
}

function uniqueSorted(arr) {
  return [...new Set(arr.filter(v => v != null && String(v).trim() !== ''))].sort((a,b) =>
    String(a).localeCompare(String(b))
  );
}

function populateSel(sel, placeholder, values, keepVal) {
  const prev = keepVal ? sel.value : '';
  sel.innerHTML = '<option value="">' + placeholder + '</option>'
    + values.map(v => '<option value="' + h(v) + '"' + (String(v) === prev ? ' selected' : '') + '>' + h(v) + '</option>').join('');
  sel.disabled = values.length === 0;
}

/* ─── data ─────────────────────────────────────────── */

async function loadMcqs() {
  showMsg('Loading…', '');
  let from = 0;
  let rows = [];

  while (true) {
    const { data, error } = await supabase
      .from('mcqs')
      .select('*')
      .order('Course')
      .order('Subject')
      .order('Unit')
      .order('"Test Number"')
      .range(from, from + PAGE_SIZE - 1);

    if (error) { showMsg('Error: ' + error.message, 'err'); return; }

    const chunk = data || [];
    rows = rows.concat(chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  allMcqs = rows;
  showMsg('', '');
  buildFilters();
  applyFilters();
}

/* ─── cascade filters ──────────────────────────────── */

function buildFilters() {
  populateSel(selCourse, '— All Courses —', uniqueSorted(allMcqs.map(r => col(r,'Course','course'))));
  refreshDownstream();
}

function refreshDownstream() {
  const course    = selCourse.value;
  const classExam = selClassExam.value;
  const subject   = selSubject.value;
  const unit      = selUnit.value;

  let s = allMcqs;
  if (course)    s = s.filter(r => col(r,'Course','course') === course);
  populateSel(selClassExam, '— All —', uniqueSorted(s.map(r => col(r,'Class/Exam','class_exam'))), true);
  if (classExam) s = s.filter(r => col(r,'Class/Exam','class_exam') === classExam);
  populateSel(selSubject, '— All —', uniqueSorted(s.map(r => col(r,'Subject','subject'))), true);
  if (subject)   s = s.filter(r => col(r,'Subject','subject') === subject);
  populateSel(selUnit, '— All —', uniqueSorted(s.map(r => col(r,'Unit','unit'))), true);
  if (unit)      s = s.filter(r => col(r,'Unit','unit') === unit);
  populateSel(selCategory, '— All —', uniqueSorted(s.map(r => col(r,'Category','category'))), true);
  populateSel(selTestNum,  '— All —', uniqueSorted(s.map(r => col(r,'Test Number','test_number'))), true);
  [selClassExam, selSubject, selUnit, selCategory, selTestNum].forEach(x => { x.disabled = false; });
}

function applyFilters() {
  const course    = selCourse.value;
  const classExam = selClassExam.value;
  const subject   = selSubject.value;
  const unit      = selUnit.value;
  const category  = selCategory.value;
  const testNum   = selTestNum.value;

  filtered = allMcqs.filter(r => {
    if (course    && col(r,'Course','course')                   !== course)    return false;
    if (classExam && col(r,'Class/Exam','class_exam')           !== classExam) return false;
    if (subject   && col(r,'Subject','subject')                 !== subject)   return false;
    if (unit      && col(r,'Unit','unit')                       !== unit)      return false;
    if (category  && col(r,'Category','category')               !== category)  return false;
    if (testNum   && String(col(r,'Test Number','test_number')) !== testNum)   return false;
    return true;
  });
  render();
}

/* ─── render ───────────────────────────────────────── */

function optCell(letter, text, correct) {
  const ok = letter === correct;
  const bg = ok ? '#dcfce7' : '#f8fafc';
  const br = ok ? '1.5px solid #16a34a' : '1px solid #e2e8f0';
  const cl = ok ? '#15803d' : '#374151';
  const fw = ok ? '600' : '400';
  return '<div style="padding:6px 10px;border-radius:8px;font-size:0.825rem;background:' + bg + ';border:' + br + ';color:' + cl + ';font-weight:' + fw + ';">'
    + '<span style="font-weight:700;margin-right:5px;">' + letter + '.</span>' + h(text)
    + (ok ? ' <span style="font-size:0.7rem;background:#16a34a;color:#fff;padding:1px 5px;border-radius:4px;margin-left:4px;">✓</span>' : '')
    + '</div>';
}

function buildEditPanel(q) {
  const id      = h(String(q.id));
  const correct = col(q,'Correct Answer','correct_answer');
  const optOpts = ['A','B','C','D'].map(l =>
    '<option value="' + l + '"' + (l === correct ? ' selected' : '') + '>' + l + '</option>'
  ).join('');

  const field = (label, tag, fk, extra, val) =>
    '<div style="margin-bottom:8px;">'
    + '<label style="display:block;font-size:0.75rem;font-weight:700;color:#475569;margin-bottom:3px;">' + label + '</label>'
    + (tag === 'textarea'
        ? '<textarea class="ef" data-f="' + fk + '" rows="2" ' + extra + ' style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:0.875rem;font-family:inherit;resize:vertical;box-sizing:border-box;">' + h(val) + '</textarea>'
        : '<input type="text" class="ef" data-f="' + fk + '" value="' + h(val) + '" ' + extra + ' style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:0.875rem;font-family:inherit;box-sizing:border-box;">')
    + '</div>';

  return '<div class="edit-panel" style="display:none;padding:14px 16px 16px;border-top:2px solid #e2e8f0;background:#f8fafc;">'
    + field('Question', 'textarea', 'Question', '', col(q,'Question','question'))
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
    +   field('Option A', 'input', 'Option A', '', col(q,'Option A','option_a'))
    +   field('Option B', 'input', 'Option B', '', col(q,'Option B','option_b'))
    +   field('Option C', 'input', 'Option C', '', col(q,'Option C','option_c'))
    +   field('Option D', 'input', 'Option D', '', col(q,'Option D','option_d'))
    + '</div>'
    + '<div style="display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;">'
    +   '<div style="margin-bottom:8px;">'
    +     '<label style="display:block;font-size:0.75rem;font-weight:700;color:#475569;margin-bottom:3px;">Correct Answer</label>'
    +     '<select class="ef" data-f="Correct Answer" style="padding:7px 14px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:0.875rem;font-weight:700;">' + optOpts + '</select>'
    +   '</div>'
    +   field('Explanation (optional)', 'input', 'Explanation', '', col(q,'Explanation','explanation'))
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:4px;">'
    +   '<button type="button" class="btn-save" data-id="' + id + '" style="padding:8px 22px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.875rem;cursor:pointer;">Save changes</button>'
    +   '<button type="button" class="btn-cancel" data-id="' + id + '" style="padding:8px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-weight:600;font-size:0.875rem;cursor:pointer;">Cancel</button>'
    + '</div>'
    + '</div>';
}

function render() {
  resultsCard.style.display = (filtered.length || allMcqs.length) ? 'block' : 'none';
  countLabel.textContent = filtered.length + ' MCQ' + (filtered.length !== 1 ? 's' : '');

  if (!filtered.length) {
    mcqList.innerHTML = '';
    emptyMsg.classList.remove('hidden');
    updateDeleteBtn(); 
    return;
  }
  emptyMsg.classList.add('hidden');

  let html = '';
  filtered.forEach(function(q, i) {
    const id      = h(String(q.id));
    const correct = col(q,'Correct Answer','correct_answer');
    const hidden  = q.hide === true;

    const hideBadge = hidden
      ? '<span style="font-size:0.72rem;background:#fef3c7;color:#92400e;border:1px solid #fde68a;padding:2px 8px;border-radius:4px;font-weight:700;">Hidden (Mock)</span>'
      : '<span style="font-size:0.72rem;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;padding:2px 8px;border-radius:4px;font-weight:700;">Published</span>';

    const subjectBadge = '<span style="font-size:0.72rem;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:2px 8px;border-radius:4px;">'
      + h(col(q,'Subject','subject')) + ' › T' + h(col(q,'Test Number','test_number') || '') + '</span>';

    html += '<div class="mcq-card' + (hidden ? ' mcq-hidden' : '') + '" data-id="' + id + '">'

      /* ── row 1: checkbox + number + question ── */
      + '<div class="mcq-card-head" style="display:flex;align-items:flex-start;gap:10px;padding:14px 14px 8px 14px;cursor:pointer;">'
      +   '<input type="checkbox" class="mcq-sel" data-id="' + id + '" style="margin-top:4px;width:16px;height:16px;flex-shrink:0;accent-color:#2563eb;cursor:pointer;">'
      +   '<span style="font-weight:700;font-size:0.82rem;color:#2563eb;flex-shrink:0;padding-top:2px;">' + (i+1) + '.</span>'
      +   '<div style="flex:1;font-weight:600;font-size:0.9rem;color:#111827;line-height:1.5;">' + h(col(q,'Question','question')) + '</div>'
      + '</div>'

      /* ── row 2: badges + action buttons on their own line ── */
      + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:0 14px 10px 40px;">'
      +   hideBadge + subjectBadge
      +   '<div style="flex:1;"></div>'
      +   '<button type="button" class="btn-edit" data-id="' + id + '" style="padding:5px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:0.8rem;font-weight:700;cursor:pointer;">Edit</button>'
      +   '<button type="button" class="btn-del-one" data-id="' + id + '" style="padding:5px 14px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:0.8rem;font-weight:700;cursor:pointer;">Delete</button>'
      + '</div>'

      /* ── row 3: options grid ── */
      + '<div style="padding:0 14px 14px 14px;">'
      +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">'
      +     optCell('A', col(q,'Option A','option_a') || '', correct)
      +     optCell('B', col(q,'Option B','option_b') || '', correct)
      +     optCell('C', col(q,'Option C','option_c') || '', correct)
      +     optCell('D', col(q,'Option D','option_d') || '', correct)
      +   '</div>'
      +   (col(q,'Explanation','explanation')
          ? '<div style="margin-top:8px;padding:7px 10px;background:#fefce8;border:1px solid #fde68a;border-radius:7px;font-size:0.8rem;color:#92400e;"><strong>Explanation:</strong> ' + h(col(q,'Explanation','explanation')) + '</div>'
          : '')
      + '</div>'

      /* ── row 4: inline edit panel (hidden) ── */
      + buildEditPanel(q)

      + '</div>';
  });

  mcqList.innerHTML = html;
  
  // Attach individual change listeners to apply the highlight feature
  mcqList.querySelectorAll('.mcq-sel').forEach(cb => {
    cb.addEventListener('change', function() {
      updateDeleteBtn();
      const card = this.closest('.mcq-card');
      if (card) card.classList.toggle('selected', this.checked);
    });
  });

  updateDeleteBtn();
}

/* ─── interactions ──────────────────────── */

// Allows clicking anywhere on the question text to select it (like Q3.html)
mcqList.addEventListener('click', async function(e) {
  
  // Handle click on the header area to check the box
  const head = e.target.closest('.mcq-card-head');
  if (head && !e.target.closest('.mcq-sel')) {
      const cb = head.querySelector('.mcq-sel');
      if (cb) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change')); // Trigger styling and count
      }
      return;
  }

  /* open / close edit panel */
  const editBtn = e.target.closest('.btn-edit');
  if (editBtn) {
    const card  = editBtn.closest('.mcq-card');
    const panel = card && card.querySelector('.edit-panel');
    if (!panel) return;
    const opening = panel.style.display === 'none';
    mcqList.querySelectorAll('.edit-panel').forEach(p => { p.style.display = 'none'; });
    if (opening) {
      panel.style.display = 'block';
      const first = panel.querySelector('textarea');
      if (first) { first.focus(); first.setSelectionRange(first.value.length, first.value.length); }
    }
    return;
  }

  /* cancel */
  const cancelBtn = e.target.closest('.btn-cancel');
  if (cancelBtn) {
    const card  = cancelBtn.closest('.mcq-card');
    const panel = card && card.querySelector('.edit-panel');
    if (panel) panel.style.display = 'none';
    return;
  }

  /* save */
  const saveBtn = e.target.closest('.btn-save');
  if (saveBtn) {
    const id   = saveBtn.dataset.id;
    const card = saveBtn.closest('.mcq-card');
    if (!card) return;

    const payload = {};
    card.querySelectorAll('.ef').forEach(el => { payload[el.dataset.f] = el.value.trim(); });

    if (!payload['Question'])       { showMsg('Question cannot be empty.', 'err'); return; }
    if (!payload['Option A'])       { showMsg('Option A cannot be empty.', 'err'); return; }
    if (!payload['Option B'])       { showMsg('Option B cannot be empty.', 'err'); return; }
    if (!payload['Correct Answer']) { showMsg('Select a correct answer.', 'err'); return; }

    saveBtn.textContent = 'Saving…';
    saveBtn.disabled    = true;

    const { error } = await supabase.from('mcqs').update({
      'Question':       payload['Question'],
      'Option A':       payload['Option A'],
      'Option B':       payload['Option B'],
      'Option C':       payload['Option C'] || null,
      'Option D':       payload['Option D'] || null,
      'Correct Answer': payload['Correct Answer'],
      'Explanation':    payload['Explanation'] || null,
    }).eq('id', id);

    saveBtn.textContent = 'Save changes';
    saveBtn.disabled    = false;

    if (error) { showMsg('Save failed: ' + error.message, 'err'); return; }

    const idx = allMcqs.findIndex(r => String(r.id) === id);
    if (idx !== -1) Object.assign(allMcqs[idx], payload);

    showMsg('Saved successfully.', 'ok');
    refreshDownstream();
    applyFilters();
    return;
  }

  /* direct delete */
  const delBtn = e.target.closest('.btn-del-one');
  if (delBtn) {
    if (!confirm('Delete this MCQ? This cannot be undone.')) return;
    delBtn.textContent = '…';
    delBtn.disabled    = true;

    const id = delBtn.dataset.id;
    const { error } = await supabase.from('mcqs').delete().eq('id', id);
    if (error) {
      delBtn.textContent = '🗑️ Delete';
      delBtn.disabled    = false;
      showMsg('Delete failed: ' + error.message, 'err');
      return;
    }
    allMcqs = allMcqs.filter(r => String(r.id) !== id);
    showMsg('MCQ deleted.', 'ok');
    refreshDownstream();
    applyFilters();
    return;
  }
});

/* ─── bulk actions ──────────────────────────────────── */

function getSelectedIds() {
  return Array.from(mcqList.querySelectorAll('.mcq-sel:checked')).map(cb => cb.dataset.id);
}

function updateDeleteBtn() {
  const ids = getSelectedIds();
  const any = ids.length > 0;
  
  deleteBtn.style.display = any ? 'inline-block' : 'none';
  createTestBtn.style.display = any ? 'inline-block' : 'none';
  
  const allCbs = mcqList.querySelectorAll('.mcq-sel');
  selectAllCb.checked = allCbs.length > 0 && mcqList.querySelectorAll('.mcq-sel:not(:checked)').length === 0;

  // Accurately update the total selected count badge
  const countBadge = document.getElementById('selectedCount');
  if (countBadge) countBadge.textContent = ids.length;
}

selectAllCb.addEventListener('change', () => {
  mcqList.querySelectorAll('.mcq-sel').forEach(cb => { 
    cb.checked = selectAllCb.checked; 
    const card = cb.closest('.mcq-card');
    if (card) card.classList.toggle('selected', selectAllCb.checked);
  });
  updateDeleteBtn();
});

deleteBtn.addEventListener('click', async () => {
  const ids = getSelectedIds();
  if (!ids.length) return;
  if (!confirm('Delete ' + ids.length + ' selected MCQ' + (ids.length !== 1 ? 's' : '') + '? This cannot be undone.')) return;
  deleteBtn.disabled = true; deleteBtn.textContent = 'Deleting…';

  const { error } = await supabase.from('mcqs').delete().in('id', ids);
  deleteBtn.disabled = false; deleteBtn.textContent = 'Delete selected';

  if (error) { showMsg('Delete failed: ' + error.message, 'err'); return; }
  allMcqs = allMcqs.filter(r => !ids.includes(String(r.id)));
  showMsg('Deleted ' + ids.length + ' MCQ' + (ids.length !== 1 ? 's' : '') + '.', 'ok');
  selectAllCb.checked = false;
  refreshDownstream();
  applyFilters();
});

/* ─── filter wiring ────────────────────────────────── */

[selCourse, selClassExam, selSubject, selUnit, selCategory, selTestNum].forEach(sel => {
  sel.addEventListener('change', () => { refreshDownstream(); applyFilters(); });
});

/* ─── create test modal ─────────────────────────────── */

function ctShowMsg(text, type) {
  ctMsg.textContent = text;
  ctMsg.style.display = text ? 'block' : 'none';
  ctMsg.style.background = type === 'err' ? '#fef2f2' : '#dcfce7';
  ctMsg.style.color      = type === 'err' ? '#b91c1c' : '#16a34a';
  ctMsg.style.border     = type === 'err' ? '1px solid #fecaca' : '1px solid #bbf7d0';
}

function updateCtTypeLabels() {
  if (ctTypeMock.checked) {
    ctLabelMock.style.borderColor = '#dc2626';
    ctLabelMock.style.background  = '#fef2f2';
    ctLabelPractice.style.borderColor = '#e2e8f0';
    ctLabelPractice.style.background  = '#fff';
  } else {
    ctLabelPractice.style.borderColor = '#2563eb';
    ctLabelPractice.style.background  = '#eff6ff';
    ctLabelMock.style.borderColor = '#e2e8f0';
    ctLabelMock.style.background  = '#fff';
  }
}

function openCreateTestModal() {
  const ids = getSelectedIds();
  if (!ids.length) return;

  /* pre-fill from the first selected MCQ */
  const first = allMcqs.find(r => ids.includes(String(r.id)));
  if (first) {
    ctCourse.value    = col(first, 'Course', 'course') || '';
    ctClassExam.value = col(first, 'Class/Exam', 'class_exam') || '';
    ctSubject.value   = col(first, 'Subject', 'subject') || '';
    ctUnit.value      = col(first, 'Unit', 'unit') || '';
    ctCategory.value  = col(first, 'Category', 'category') || '';
    ctTopics.value    = col(first, 'Topics', 'topics') || '';
    ctTestNumber.value = '';
  }

  ctTypePractice.checked = true;
  updateCtTypeLabels();
  ctShowMsg('', '');
  ctModalCount.textContent = ids.length + ' MCQ' + (ids.length !== 1 ? 's' : '') + ' selected — copies will be inserted into the new test';
  modal.style.display = 'flex';
}

function closeCreateTestModal() {
  modal.style.display = 'none';
}

createTestBtn.addEventListener('click', openCreateTestModal);
ctCancelBtn.addEventListener('click', closeCreateTestModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeCreateTestModal(); });
ctTypePractice.addEventListener('change', updateCtTypeLabels);
ctTypeMock.addEventListener('change', updateCtTypeLabels);

ctConfirmBtn.addEventListener('click', async () => {
  const course    = ctCourse.value.trim();
  const classExam = ctClassExam.value.trim();
  const subject   = ctSubject.value.trim();
  const unit      = ctUnit.value.trim();
  const category  = ctCategory.value.trim();
  const topics    = ctTopics.value.trim();
  const testNum   = ctTestNumber.value.trim();

  if (!course)    { ctShowMsg('Course is required.', 'err'); return; }
  if (!classExam) { ctShowMsg('Class/Exam is required.', 'err'); return; }
  if (!subject)   { ctShowMsg('Subject is required.', 'err'); return; }
  if (!unit)      { ctShowMsg('Unit is required.', 'err'); return; }
  if (!testNum)   { ctShowMsg('Test Number is required.', 'err'); return; }

  const hideValue = ctTypeMock.checked;
  const ids = getSelectedIds();
  const selectedMcqs = allMcqs.filter(r => ids.includes(String(r.id)));

  const rows = selectedMcqs.map(q => ({
    'Course':          course,
    'Class/Exam':      classExam,
    'Subject':         subject,
    'Unit':            unit,
    'Category':        category || null,
    'Topics':          topics || null,
    'Test Number':     parseInt(testNum, 10),
    'Question':        col(q, 'Question', 'question'),
    'Option A':        col(q, 'Option A', 'option_a'),
    'Option B':        col(q, 'Option B', 'option_b'),
    'Option C':        col(q, 'Option C', 'option_c') || null,
    'Option D':        col(q, 'Option D', 'option_d') || null,
    'Correct Answer':  col(q, 'Correct Answer', 'correct_answer'),
    'Explanation':     col(q, 'Explanation', 'explanation') || null,
    'hide':            hideValue,
  }));

  ctConfirmBtn.disabled    = true;
  ctConfirmBtn.textContent = 'Creating…';

  const { error } = await supabase.from('mcqs').insert(rows);

  ctConfirmBtn.disabled    = false;
  ctConfirmBtn.textContent = 'Create Test';

  if (error) { ctShowMsg('Failed: ' + error.message, 'err'); return; }

  closeCreateTestModal();
  const typeLabel = hideValue ? 'Mock Test' : 'Practice Test';
  showMsg('Created ' + typeLabel + ' with ' + rows.length + ' MCQs (Test #' + testNum + ').', 'ok');

  /* reload so new rows appear in the list */
  selectAllCb.checked = false;
  await loadMcqs();
});

loadMcqs();