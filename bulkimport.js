import { supabase, initAuthGuard } from './auth-guard.js';

const selCourse = document.getElementById('selCourse');
const selClassExam = document.getElementById('selClassExam');
const selSubject = document.getElementById('selSubject');
const selUnit = document.getElementById('selUnit');
const selCategory = document.getElementById('selCategory');
const selTestNumber = document.getElementById('selTestNumber');
const structureLead = document.getElementById('structureLead');
const mcqCountMsg = document.getElementById('mcqCountMsg');
const parseBtn = document.getElementById('parseBtn');

const form = document.getElementById('form');
const docxFileInput = document.getElementById('docxFile');
const docxName = document.getElementById('docxName');
const bulkText = document.getElementById('bulkText');
const msgEl = document.getElementById('msg');
const reviewSection = document.getElementById('reviewSection');
const reviewList = document.getElementById('reviewList');
const reviewCount = document.getElementById('reviewCount');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const importSelectedBtn = document.getElementById('importSelectedBtn');
const importTypeNotice = document.getElementById('importTypeNotice');
const typePractice = document.getElementById('typePractice');
const typeMock = document.getElementById('typeMock');
const labelPractice = document.getElementById('labelPractice');
const labelMock = document.getElementById('labelMock');
const inputTopics = document.getElementById('inputTopics');
const topicsRow = document.getElementById('topicsRow');
const testNumRow = document.getElementById('testNumRow');
const radioManual = document.getElementById('radioManual');
const radioAuto = document.getElementById('radioAuto');
const labelManualMode = document.getElementById('labelManualMode');
const labelAutoMode = document.getElementById('labelAutoMode');
const manualTestRow = document.getElementById('manualTestRow');
const autoTestRow = document.getElementById('autoTestRow');
const startTestNumInput = document.getElementById('startTestNum');
const batchSizeInput = document.getElementById('batchSize');
const autoTestSummary = document.getElementById('autoTestSummary');

let autoTestMode = false;
let rangeTestMap = [];
let autoStartLookupSeq = 0;
const importMsgEl = document.getElementById('importMsg');

function showImportMsg(text, type) {
  if (!importMsgEl) return;
  importMsgEl.textContent = text || '';
  importMsgEl.className = type ? type : '';
  if (type === 'ok') setTimeout(() => { importMsgEl.textContent = ''; importMsgEl.className = ''; }, 5000);
}

let structures = [];

function showTopicsRow() {
  if (topicsRow) topicsRow.style.display = '';
}
function hideTopicsRow() {
  if (topicsRow) topicsRow.style.display = 'none';
  if (inputTopics) inputTopics.value = '';
  // Note: Test # row is NOT hidden here — it's controlled by Category selection only
}
function showTestNumRow() {
  if (testNumRow) testNumRow.style.display = '';
}
function hideTestNumRow() {
  if (testNumRow) testNumRow.style.display = 'none';
}
let parsedMcqs = [];

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#039;");
}

function setSelectDisabled(select, disabled) {
  select.disabled = disabled;
  if (disabled) select.value = '';
}

function unique(values) {
  return Array.from(new Set(values.filter(v => v != null && String(v).trim() !== ''))).sort();
}

function populateSelect(select, placeholder, values) {
  const opts = ['<option value="">' + placeholder + '</option>']
    .concat(values.map(v => '<option value="' + escapeHtml(String(v)) + '">' + escapeHtml(String(v)) + '</option>'));
  select.innerHTML = opts.join('');
  select.disabled = values.length === 0;
}

function currentFilter() {
  return {
    course: selCourse.value || null,
    classExam: selClassExam.value || null,
    subject: selSubject.value || null,
    unit: selUnit.value || null,
    category: selCategory.value || null,
  };
}

async function fetchNextStartingTestNumber(filter) {
  const PAGE_SIZE = 1000;
  let from = 0;
  let maxTestNumber = 0;
  let hasTestNumber = false;

  while (true) {
    let q = supabase.from('mcqs').select('"Test Number"');
    q = q.eq('Course', filter.course);
    q = q.filter('"Class/Exam"', 'eq', filter.classExam);
    q = q.eq('Subject', filter.subject);
    q = q.eq('Unit', filter.unit);
    if (filter.category) {
      q = q.eq('Category', filter.category);
    } else {
      q = q.is('Category', null);
    }
    q = q.range(from, from + PAGE_SIZE - 1);

    const { data, error } = await q;
    if (error) throw new Error(error.message || 'Failed to read existing tests');

    const rows = data || [];
    for (const row of rows) {
      const value = Number.parseInt(row['Test Number'], 10);
      if (Number.isFinite(value) && value > 0) {
        hasTestNumber = true;
        if (value > maxTestNumber) maxTestNumber = value;
      }
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return hasTestNumber ? (maxTestNumber + 1) : 1;
}

async function autoFillStartingTestNumber() {
  if (!autoTestMode || !startTestNumInput) return;
  const f = currentFilter();
  if (!f.course || !f.classExam || !f.subject || !f.unit) return;

  const requestSeq = ++autoStartLookupSeq;
  try {
    const next = await fetchNextStartingTestNumber(f);
    if (requestSeq !== autoStartLookupSeq) return;
    startTestNumInput.value = String(next);
  } catch (error) {
    if (requestSeq !== autoStartLookupSeq) return;
    console.warn('Auto start test-number lookup failed:', error);
    if (!startTestNumInput.value || Number.parseInt(startTestNumInput.value, 10) < 1) {
      startTestNumInput.value = '1';
    }
  }
}

function showMsg(text, type) {
  msgEl.textContent = text || '';
  msgEl.className = type ? type : '';
}

function updateParseButton() {
  const f = currentFilter();
  parseBtn.disabled = !(f.course && f.classExam && f.subject && f.unit);
}

function updateClassExamOptions() {
  const course = selCourse.value || null;
  const rows = course ? structures.filter(r => r.Course === course) : [];
  const classValues = unique(rows.map(r => r['Class/Exam']));
  populateSelect(selClassExam, '— Class/Exam —', classValues);
  setSelectDisabled(selSubject, true);
  setSelectDisabled(selUnit, true);
  setSelectDisabled(selCategory, true);
  setSelectDisabled(selTestNumber, true);
  hideTopicsRow();
  mcqCountMsg.textContent = '';
  updateParseButton();
}

function updateSubjectOptions() {
  const course = selCourse.value || null;
  const classExam = selClassExam.value || null;
  const rows = (course && classExam)
    ? structures.filter(r => r.Course === course && r['Class/Exam'] === classExam)
    : [];
  const subjectValues = unique(rows.map(r => r.Subject));
  populateSelect(selSubject, '— Subject —', subjectValues);
  setSelectDisabled(selUnit, true);
  setSelectDisabled(selCategory, true);
  setSelectDisabled(selTestNumber, true);
  mcqCountMsg.textContent = '';
  updateParseButton();
}

function updateUnitOptions() {
  const course = selCourse.value || null;
  const classExam = selClassExam.value || null;
  const subject = selSubject.value || null;
  const rows = (course && classExam && subject)
    ? structures.filter(r => r.Course === course && r['Class/Exam'] === classExam && r.Subject === subject)
    : [];
  const unitValues = unique(rows.map(r => r.Unit));
  populateSelect(selUnit, '— Unit —', unitValues);
  setSelectDisabled(selCategory, true);
  setSelectDisabled(selTestNumber, true);
  mcqCountMsg.textContent = '';
  updateParseButton();
}

function updateCategoryAndTestOptions() {
  const course = selCourse.value || null;
  const classExam = selClassExam.value || null;
  const subject = selSubject.value || null;
  const unit = selUnit.value || null;
  const rows = (course && classExam && subject && unit)
    ? structures.filter(r =>
        r.Course === course &&
        r['Class/Exam'] === classExam &&
        r.Subject === subject &&
        r.Unit === unit
      )
    : [];

  const categoryValues = unique(rows.map(r => r.Category));
  const testNumberValues = unique(rows.map(r => r['Test Number']));

  populateSelect(selCategory, '— Category —', categoryValues);
  populateSelect(selTestNumber, '— Test # —', testNumberValues);

  // Reset Topics and Test # cascade when unit changes
  hideTopicsRow();

  mcqCountMsg.textContent = rows.length
    ? 'Matching structures: ' + rows.length
    : '';

  updateParseButton();
}

async function loadStructures() {
  structureLead.textContent = 'Loading structures…';

  const { data, error } = await supabase.from('coursestructure').select('*').order('Course');
  if (error) {
    structureLead.textContent = 'Could not load course structure: ' + error.message;
    return;
  }

  structures = data || [];
  if (!structures.length) {
    structureLead.textContent = 'No course structure rows found. Add some in Course Structure first.';
    return;
  }

  structureLead.textContent = 'Select course, class, subject and unit for these MCQs.';

  const courseValues = unique(structures.map(r => r.Course));
  populateSelect(selCourse, '— Course —', courseValues);

  setSelectDisabled(selClassExam, true);
  setSelectDisabled(selSubject, true);
  setSelectDisabled(selUnit, true);
  setSelectDisabled(selCategory, true);
  setSelectDisabled(selTestNumber, true);

  updateParseButton();
}

function parseMcqText(text) {
  const OPTION_RE = /^[a-d][)\.]\s*/i;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (OPTION_RE.test(line)) {
      if (current) current.optionLines.push(line);
    } else {
      if (current) blocks.push(current);
      current = { qText: line, optionLines: [] };
    }
  }
  if (current) blocks.push(current);

  const result = [];

  for (const block of blocks) {
    let qText = block.qText;
    qText = qText.replace(/^\d+[\)\.]\s*/, '').trim();
    if (!qText) continue;

    const options = {};
    let correct = '';
    const letters = ['A', 'B', 'C', 'D'];
    let nextLetterIndex = 0;
    let explanation = '';

    for (const line of block.optionLines) {
      const exp = line.match(/^Explanation[:\.\-]?\s*(.+)$/i);
      if (exp) { explanation = exp[1].trim(); continue; }

      const ans = line.match(/^Answer[:\.\-]?\s*([A-D])/i);
      if (ans) { correct = ans[1].toUpperCase(); continue; }

      let raw = line.trim();
      const hasStar = raw.endsWith('*') || raw.indexOf(' *') !== -1 || raw.startsWith('*');
      raw = raw.replace(/\*/g, '').trim();

      const pref = raw.match(/^([A-D])[)\.\:]\s*(.+)$/i);
      let letter, text2;
      if (pref) {
        letter = pref[1].toUpperCase();
        text2 = pref[2].trim();
      } else {
        letter = letters[nextLetterIndex] || '';
        text2 = raw;
        nextLetterIndex++;
      }

      if (!letter || !text2) continue;
      options[letter] = text2;
      if (hasStar && !correct) correct = letter;
    }

    if (!options['A'] || !options['B'] || !correct) continue;

    result.push({
      Question: qText,
      'Option A': options['A'] || '',
      'Option B': options['B'] || '',
      'Option C': options['C'] || '',
      'Option D': options['D'] || '',
      'Correct Answer': correct,
      Explanation: explanation || '',
      _checked: true 
    });
  }

  return result;
}

function optionHtml(letter, text, correctLetter) {
  const isCorrect = letter === correctLetter;
  const bg    = isCorrect ? '#dcfce7' : '#f8fafc';
  const border = isCorrect ? '1.5px solid #16a34a' : '1px solid #e2e8f0';
  const color  = isCorrect ? '#15803d' : '#334155';
  const badge  = isCorrect
    ? '<span style="margin-left:6px;font-size:0.7rem;background:#16a34a;color:#fff;padding:1px 6px;border-radius:4px;font-weight:700;">✓ Correct</span>'
    : '';
  return (
    `<div style="background:${bg};border:${border};border-radius:8px;padding:8px 12px;color:${color};font-size:0.875rem;">
      <span style="font-weight:700;margin-right:6px;">${letter}.</span>${text}${badge}
    </div>`
  );
}

function getBatchSize() {
  const value = parseInt(batchSizeInput ? batchSizeInput.value : '20', 10);
  return value > 0 ? value : 20;
}

function buildRangeTestMap(forceReset) {
  if (!autoTestMode || parsedMcqs.length === 0) { rangeTestMap = []; return; }
  const chunkSize = getBatchSize();
  const chunks = Math.ceil(parsedMcqs.length / chunkSize);
  const startNum = parseInt(startTestNumInput ? startTestNumInput.value : '1', 10) || 1;
  const oldMap = forceReset ? [] : rangeTestMap.slice();
  rangeTestMap = [];
  for (let i = 0; i < chunks; i++) {
    const s = i * chunkSize;
    const e = Math.min((i + 1) * chunkSize, parsedMcqs.length);
    const old = oldMap.find(r => r.start === s && r.end === e);
    rangeTestMap.push({ start: s, end: e, testNum: old ? old.testNum : startNum + i });
  }
  updateAutoSummary();
}

function updateAutoSummary() {
  if (!autoTestSummary) return;
  if (!autoTestMode || rangeTestMap.length === 0) { autoTestSummary.textContent = ''; return; }
  const first = rangeTestMap[0].testNum;
  const last = rangeTestMap[rangeTestMap.length - 1].testNum;
  autoTestSummary.textContent = '\u2192 ' + rangeTestMap.length + ' batches of ' + getBatchSize() + ' \u2192 Tests ' + first + '..' + last;
}

// Build batch buttons using the selected MCQs-per-test size.
function updateBatchButtons() {
  let rangeContainer = document.getElementById('rangeButtonsContainer');
  
  if (!rangeContainer) {
    rangeContainer = document.createElement('div');
    rangeContainer.id = 'rangeButtonsContainer';
    rangeContainer.style.cssText = "display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1.5rem; align-items:center;";
    reviewList.parentNode.insertBefore(rangeContainer, reviewList);
  }
  
  rangeContainer.innerHTML = '';
  if (parsedMcqs.length === 0) return;

  const chunkSize = getBatchSize();
  const chunks = Math.ceil(parsedMcqs.length / chunkSize);

  if (autoTestMode) buildRangeTestMap(false);

  if (chunks > 0) {
    const rangeLabel = document.createElement('span');
    rangeLabel.style.cssText = "font-size:0.9rem; font-weight:600; color:#1e293b; margin-right:8px; width:100%;";
    rangeLabel.textContent = autoTestMode ? "Test Mapping (click range to select, edit test # to override):" : "Select Batch:";
    rangeContainer.appendChild(rangeLabel);

    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize + 1;
      const end = Math.min((i + 1) * chunkSize, parsedMcqs.length);

      const wrapper = document.createElement('div');
      wrapper.style.cssText = "display:inline-flex; align-items:center; gap:4px;";

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = "padding: 0.4rem 0.85rem; font-size: 0.85rem; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; transition: all 0.2s;";
      btn.textContent = `${start} - ${end}`;

      let isBatchActive = true;
      parsedMcqs.forEach((q, idx) => {
        const inRange = (idx >= start - 1 && idx < end);
        if (inRange && !q._checked) isBatchActive = false;
        if (!inRange && q._checked) isBatchActive = false;
      });

      if (isBatchActive) {
        btn.style.background = '#dbeafe';
        btn.style.borderColor = '#2563eb';
        btn.style.color = '#1d4ed8';
        btn.style.fontWeight = '700';
      } else {
        btn.style.background = '#ffffff';
        btn.style.color = '#475569';
        btn.style.fontWeight = '500';
      }

      btn.addEventListener('click', () => {
        parsedMcqs.forEach((q, idx) => {
          q._checked = (idx >= start - 1 && idx < end);
        });
        document.querySelectorAll('.mcq-check').forEach((cb) => {
          const idx = parseInt(cb.getAttribute('data-idx'), 10);
          cb.checked = parsedMcqs[idx]._checked;
          const card = cb.closest('.mcq-card');
          if (card) card.style.opacity = cb.checked ? '1' : '0.5';
        });
        updateBatchButtons();
      });

      wrapper.appendChild(btn);

      if (autoTestMode && rangeTestMap[i]) {
        const numInput = document.createElement('input');
        numInput.type = 'number';
        numInput.min = '1';
        numInput.value = rangeTestMap[i].testNum;
        numInput.style.cssText = "width:52px; padding:4px 6px; font-size:0.8rem; border:1.5px solid #16a34a; border-radius:6px; text-align:center; font-weight:700; color:#15803d; background:#f0fdf4;";
        numInput.title = `Test # for MCQs ${start}-${end}`;
        const rangeIdx = i;
        numInput.addEventListener('change', () => {
          const v = parseInt(numInput.value, 10);
          if (v > 0) {
            rangeTestMap[rangeIdx].testNum = v;
          } else {
            numInput.value = rangeTestMap[rangeIdx].testNum;
          }
          updateAutoSummary();
          renderPreview();
        });
        wrapper.appendChild(numInput);
      }

      rangeContainer.appendChild(wrapper);
    }
  }
}

function renderPreview() {
  if (!parsedMcqs.length) {
    reviewSection.classList.add('hidden');
    reviewList.innerHTML = '';
    reviewCount.textContent = '';
    let rangeContainer = document.getElementById('rangeButtonsContainer');
    if (rangeContainer) rangeContainer.innerHTML = '';
    return;
  }

  reviewSection.classList.remove('hidden');
  reviewCount.textContent = parsedMcqs.length + ' questions parsed';

  const html = parsedMcqs.map(function (q, idx) {
    const correct = q['Correct Answer'] || '';
    
    const safeQ = escapeHtml(q.Question);
    const safeA = escapeHtml(q['Option A']);
    const safeB = escapeHtml(q['Option B']);
    const safeC = escapeHtml(q['Option C']);
    const safeD = escapeHtml(q['Option D']);
    const safeExp = escapeHtml(q.Explanation);

    const opacity = q._checked !== false ? '1' : '0.5';

    return `
      <div class="mcq-card" data-idx="${idx}" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.05);transition:opacity 0.2s;opacity:${opacity};">
        
        <div class="mcq-card-head" title="Click anywhere to edit" style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;">
          <input type="checkbox" class="mcq-check" data-idx="${idx}" ${q._checked !== false ? 'checked' : ''} style="margin-top:3px;width:16px;height:16px;flex-shrink:0;accent-color:#2563eb;cursor:pointer;">
          
          <div style="flex:1;min-width:0;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div class="mcq-q-text" style="font-weight:700;font-size:0.95rem;color:#1e293b;line-height:1.4;">
              <span style="color:#2563eb;margin-right:6px;">${idx + 1}.</span>${autoTestMode && rangeTestMap.length ? (() => { const m = rangeTestMap.find(r => idx >= r.start && idx < r.end); return m ? `<span style="background:#f0fdf4;color:#15803d;padding:2px 8px;border-radius:4px;font-size:0.72rem;font-weight:700;margin-right:6px;border:1px solid #bbf7d0;">T#${m.testNum}</span>` : ''; })() : ''}${safeQ}
            </div>
            
            <div class="card-actions" style="display:flex;gap:6px;flex-shrink:0;">
              <button type="button" class="btn-edit" data-idx="${idx}" style="padding:4px 10px;font-size:0.75rem;font-weight:600;background:#dbeafe;color:#1d4ed8;border:none;border-radius:6px;cursor:pointer;">Edit</button>
              <button type="button" class="btn-remove" data-idx="${idx}" style="padding:4px 10px;font-size:0.75rem;font-weight:600;background:#fef2f2;color:#b91c1c;border:none;border-radius:6px;cursor:pointer;">Delete</button>
            </div>
          </div>
        </div>
        
        <div class="mcq-card-body" title="Click anywhere to edit" style="padding-left:28px;margin-top:12px;cursor:pointer;display:block;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${safeA ? optionHtml('A', safeA, correct) : ''}
            ${safeB ? optionHtml('B', safeB, correct) : ''}
            ${safeC ? optionHtml('C', safeC, correct) : ''}
            ${safeD ? optionHtml('D', safeD, correct) : ''}
          </div>
          ${safeExp ? `<div style="margin-top:10px;padding:8px 12px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:0.8rem;color:#92400e;"><strong>Explanation:</strong> ${safeExp}</div>` : ''}
        </div>
        
        <div class="mcq-edit" style="display:none;padding-left:28px;margin-top:16px;border-top:1px dashed #cbd5e1;padding-top:16px;">
          <label style="font-size:0.8rem;font-weight:600;color:#475569;display:block;margin-bottom:4px;">Question</label>
          <textarea class="edit-q" style="width:100%;min-height:60px;padding:8px;border:2px solid #e2e8f0;border-radius:6px;margin-bottom:12px;font-family:inherit;font-size:0.85rem;">${safeQ}</textarea>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div><label style="font-size:0.75rem;font-weight:600;color:#475569;">Option A</label><input type="text" class="edit-a" value="${safeA}" style="width:100%;padding:6px;border:2px solid #e2e8f0;border-radius:6px;font-size:0.85rem;"></div>
            <div><label style="font-size:0.75rem;font-weight:600;color:#475569;">Option B</label><input type="text" class="edit-b" value="${safeB}" style="width:100%;padding:6px;border:2px solid #e2e8f0;border-radius:6px;font-size:0.85rem;"></div>
            <div><label style="font-size:0.75rem;font-weight:600;color:#475569;">Option C</label><input type="text" class="edit-c" value="${safeC}" style="width:100%;padding:6px;border:2px solid #e2e8f0;border-radius:6px;font-size:0.85rem;"></div>
            <div><label style="font-size:0.75rem;font-weight:600;color:#475569;">Option D</label><input type="text" class="edit-d" value="${safeD}" style="width:100%;padding:6px;border:2px solid #e2e8f0;border-radius:6px;font-size:0.85rem;"></div>
          </div>
          
          <div style="display:flex;align-items:center;gap:16px;background:#f8fafc;padding:10px;border-radius:8px;margin-bottom:12px;">
            <span style="font-size:0.8rem;font-weight:700;color:#334155;">Correct Answer:</span>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="correct_${idx}" value="A" ${correct === 'A' ? 'checked' : ''} style="width:auto;margin:0;accent-color:#2563eb;"> A</label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="correct_${idx}" value="B" ${correct === 'B' ? 'checked' : ''} style="width:auto;margin:0;accent-color:#2563eb;"> B</label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="correct_${idx}" value="C" ${correct === 'C' ? 'checked' : ''} style="width:auto;margin:0;accent-color:#2563eb;"> C</label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="correct_${idx}" value="D" ${correct === 'D' ? 'checked' : ''} style="width:auto;margin:0;accent-color:#2563eb;"> D</label>
          </div>
          
          <div style="margin-bottom:16px;">
            <label style="font-size:0.8rem;font-weight:600;color:#475569;display:block;margin-bottom:4px;">Explanation (Optional)</label>
            <input type="text" class="edit-exp" value="${safeExp}" style="width:100%;padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-size:0.85rem;">
          </div>
          
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-primary btn-save-edit" data-idx="${idx}" style="padding:6px 14px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-weight:600;cursor:pointer;">Save changes</button>
            <button type="button" class="btn btn-cancel-edit" style="padding:6px 14px;border-radius:6px;border:none;background:#e2e8f0;color:#475569;font-weight:600;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  reviewList.innerHTML = html;
  
  updateBatchButtons();
}

async function extractTextFromDocx(file) {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error('JSZip not loaded');

  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) throw new Error('Invalid .docx file — word/document.xml not found');

  const xmlText = await xmlFile.async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  const paragraphs = xmlDoc.getElementsByTagName('w:p');
  const lines = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const runs = paragraphs[i].getElementsByTagName('w:t');
    let line = '';
    for (let j = 0; j < runs.length; j++) {
      line += runs[j].textContent;
    }
    line = line.trim();
    if (line) lines.push(line);
  }

  return lines.join('\n');
}

async function handleParse(e) {
  e.preventDefault();
  showMsg('', '');

  const f = currentFilter();
  if (!f.course || !f.classExam || !f.subject || !f.unit) {
    showMsg('Please select course, class, subject and unit first.', 'err');
    return;
  }

  const file = docxFileInput.files && docxFileInput.files[0];
  let text = '';

  if (file) {
    showMsg('Reading .docx file…', '');
    try {
      text = await extractTextFromDocx(file);
      if (!text.trim()) {
        showMsg('The .docx file appears to be empty or has no readable text.', 'err');
        return;
      }
    } catch (err) {
      showMsg('Failed to read .docx: ' + err.message, 'err');
      return;
    }
  } else {
    text = (bulkText.value || '').trim();
    if (!text) {
      showMsg('Paste MCQ text or upload a .docx file.', 'err');
      return;
    }
  }

  const parsed = parseMcqText(text);
  if (!parsed.length) {
    showMsg('Could not detect any questions. Please check the format.', 'err');
    return;
  }

  parsedMcqs = parsed;
  showMsg('Parsed ' + parsedMcqs.length + ' questions. Review and then click Import selected.', 'ok');
  renderPreview();
}

async function handleImportSelected() {
  showImportMsg('', '');
  if (!parsedMcqs.length) {
    showImportMsg('Nothing to import. Parse MCQs first.', 'err');
    return;
  }

  const toImport = parsedMcqs.filter(q => q._checked !== false);
  
  if (!toImport.length) {
    showImportMsg('Select at least one question to import.', 'err');
    return;
  }

  const f = currentFilter();
  const isMockTest = typeMock && typeMock.checked;
  const hideValue = isMockTest ? true : false;
  const topics = inputTopics ? (inputTopics.value.trim() || null) : null;

  // Validate auto mode mapping
  if (autoTestMode) {
    buildRangeTestMap(false);
    for (const r of rangeTestMap) {
      if (!r.testNum || r.testNum < 1 || isNaN(r.testNum)) {
        showImportMsg('Invalid test number in auto mapping for MCQs ' + (r.start + 1) + '-' + r.end + '. Fix it before importing.', 'err');
        return;
      }
    }
  } else {
    // Manual mode: Test Number is required or students won't see the MCQs
    if (!selTestNumber.value) {
      showImportMsg('⚠ Please select a Test Number before importing. Without it, students will not see these MCQs in the test list.', 'err');
      return;
    }
  }

  // Build rows with correct test number per MCQ
  const rows = [];
  for (let idx = 0; idx < parsedMcqs.length; idx++) {
    const q = parsedMcqs[idx];
    if (q._checked === false) continue;

    let testNumber;
    if (autoTestMode && rangeTestMap.length > 0) {
      const mapping = rangeTestMap.find(r => idx >= r.start && idx < r.end);
      testNumber = mapping ? mapping.testNum : null;
    } else {
      testNumber = selTestNumber.value ? parseInt(selTestNumber.value, 10) : null;
    }

    rows.push({
      Course: f.course,
      'Class/Exam': f.classExam,
      Subject: f.subject,
      Unit: f.unit,
      Category: f.category || null,
      'Test Number': testNumber,
      Topics: topics,
      Question: q.Question,
      'Option A': q['Option A'],
      'Option B': q['Option B'],
      'Option C': q['Option C'],
      'Option D': q['Option D'],
      'Correct Answer': q['Correct Answer'],
      Explanation: q.Explanation || null,
      hide: hideValue
    });
  }

  if (!rows.length) {
    showImportMsg('No valid rows to import.', 'err');
    return;
  }

  importSelectedBtn.disabled = true;
  importSelectedBtn.textContent = 'Importing…';

  const { error } = await supabase.from('mcqs').insert(rows);
  importSelectedBtn.disabled = false;
  importSelectedBtn.textContent = 'Import selected';

  if (error) {
    showImportMsg('Import failed: ' + error.message, 'err');
    return;
  }

  if (autoTestMode && rangeTestMap.length > 0) {
    const first = rangeTestMap[0].testNum;
    const last = rangeTestMap[rangeTestMap.length - 1].testNum;
    showImportMsg('Imported ' + rows.length + ' MCQs across Tests ' + first + '..' + last + '.', 'ok');
  } else {
    showImportMsg('Imported ' + rows.length + ' questions into MCQs.', 'ok');
  }

  if (autoTestMode) {
    await autoFillStartingTestNumber();
    buildRangeTestMap(true);
    if (parsedMcqs.length > 0) {
      updateBatchButtons();
      renderPreview();
    }
  }
}

(async function init() {
  const ok = await initAuthGuard();
  if (!ok) return;

  selCourse.addEventListener('change', () => { updateClassExamOptions(); });
  selClassExam.addEventListener('change', () => { updateSubjectOptions(); });
  selSubject.addEventListener('change', () => { updateUnitOptions(); });
  selUnit.addEventListener('change', () => { updateCategoryAndTestOptions(); });

  // Category selected → reveal both Topics AND Test # rows
  selCategory.addEventListener('change', async () => {
    if (!selCategory.disabled) {
      showTopicsRow();
      showTestNumRow();
    }
    if (autoTestMode) {
      await autoFillStartingTestNumber();
      buildRangeTestMap(true);
      if (parsedMcqs.length > 0) {
        updateBatchButtons();
        renderPreview();
      }
    }
    updateParseButton();
  });

  // Topics input: no longer controls Test # visibility (Test # always shown with Category)
  if (inputTopics) {
    inputTopics.addEventListener('input', () => {
      updateParseButton();
    });
  }

  selTestNumber.addEventListener('change', () => {
    // Auto-fill Topics from the matching coursestructure row
    const f = currentFilter();
    const testNum = selTestNumber.value ? parseInt(selTestNumber.value, 10) : null;
    if (testNum !== null && f.course && f.classExam && f.subject && f.unit) {
      const match = structures.find(r =>
        r.Course === f.course &&
        r['Class/Exam'] === f.classExam &&
        r.Subject === f.subject &&
        r.Unit === f.unit &&
        (!f.category || r.Category === f.category) &&
        r['Test Number'] === testNum
      );
      if (match && match.Topics && inputTopics) {
        inputTopics.value = match.Topics;
        showTestNumRow();
      }
    }
    updateParseButton();
  });

  // Auto/Manual test mode toggle
  async function updateTestModeUI() {
    autoTestMode = radioAuto && radioAuto.checked;
    if (manualTestRow) manualTestRow.style.display = autoTestMode ? 'none' : 'flex';
    if (autoTestRow) autoTestRow.style.display = autoTestMode ? 'flex' : 'none';
    if (labelManualMode) {
      labelManualMode.style.borderColor = autoTestMode ? '#e2e8f0' : '#2563eb';
      labelManualMode.style.background = autoTestMode ? '#fff' : '#eff6ff';
    }
    if (labelAutoMode) {
      labelAutoMode.style.borderColor = autoTestMode ? '#16a34a' : '#e2e8f0';
      labelAutoMode.style.background = autoTestMode ? '#f0fdf4' : '#fff';
    }
    if (autoTestMode) {
      await autoFillStartingTestNumber();
      buildRangeTestMap(true);
    }
    if (parsedMcqs.length > 0) {
      updateBatchButtons();
      renderPreview();
    }
  }
  if (radioManual) radioManual.addEventListener('change', updateTestModeUI);
  if (radioAuto) radioAuto.addEventListener('change', updateTestModeUI);
  if (startTestNumInput) {
    startTestNumInput.addEventListener('change', () => {
      const v = parseInt(startTestNumInput.value, 10);
      if (!v || v < 1) { startTestNumInput.value = 1; }
      buildRangeTestMap(true);
      if (parsedMcqs.length > 0) {
        updateBatchButtons();
        renderPreview();
      }
    });
  }
  if (batchSizeInput) {
    batchSizeInput.addEventListener('change', () => {
      const v = parseInt(batchSizeInput.value, 10);
      if (!v || v < 1) { batchSizeInput.value = 20; }
      buildRangeTestMap(true);
      if (parsedMcqs.length > 0) {
        updateBatchButtons();
        renderPreview();
      }
    });
  }
  updateTestModeUI();

  function updateTypeLabels() {
    if (!labelPractice || !labelMock) return;
    if (typeMock && typeMock.checked) {
      labelMock.style.borderColor = '#dc2626';
      labelMock.style.background = '#fef2f2';
      labelPractice.style.borderColor = '#e2e8f0';
      labelPractice.style.background = '#fff';
    } else {
      labelPractice.style.borderColor = '#2563eb';
      labelPractice.style.background = '#eff6ff';
      labelMock.style.borderColor = '#e2e8f0';
      labelMock.style.background = '#fff';
    }
  }

  if (typePractice) typePractice.addEventListener('change', updateTypeLabels);
  if (typeMock) typeMock.addEventListener('change', updateTypeLabels);
  updateTypeLabels();

  form.addEventListener('submit', handleParse);
  
  selectAllBtn.addEventListener('click', function () {
    parsedMcqs.forEach(q => q._checked = true);
    
    document.querySelectorAll('.mcq-check').forEach(cb => { 
      cb.checked = true; 
      const card = cb.closest('.mcq-card');
      if (card) card.style.opacity = '1';
    });
    updateBatchButtons();
  });
  
  deselectAllBtn.addEventListener('click', function () {
    parsedMcqs.forEach(q => q._checked = false);
    
    document.querySelectorAll('.mcq-check').forEach(cb => { 
      cb.checked = false; 
      const card = cb.closest('.mcq-card');
      if (card) card.style.opacity = '0.5';
    });
    updateBatchButtons();
  });
  
  importSelectedBtn.addEventListener('click', handleImportSelected);

  // --- Dynamic UI Event Delegation ---
  reviewList.addEventListener('click', function (e) {
    
    if (e.target.classList.contains('mcq-check')) {
      const idx = parseInt(e.target.getAttribute('data-idx'), 10);
      parsedMcqs[idx]._checked = e.target.checked;
      
      const card = e.target.closest('.mcq-card');
      if (card) card.style.opacity = e.target.checked ? '1' : '0.5';
      
      updateBatchButtons(); 
      return;
    }

    if (e.target.closest('.btn-remove')) {
      const idx = parseInt(e.target.closest('.btn-remove').getAttribute('data-idx'), 10);
      parsedMcqs.splice(idx, 1);
      if (autoTestMode) buildRangeTestMap(true);
      renderPreview();
      return;
    }

    const clickedHeader = e.target.closest('.mcq-card-head');
    const clickedBody = e.target.closest('.mcq-card-body');
    const clickedEditBtn = e.target.closest('.btn-edit');
    
    if ((clickedHeader && !e.target.closest('.card-actions') && !e.target.closest('.mcq-check')) || clickedBody || clickedEditBtn) {
      const card = e.target.closest('.mcq-card');
      const editDiv = card.querySelector('.mcq-edit');
      const bodyDiv = card.querySelector('.mcq-card-body');
      
      if (editDiv.style.display === 'block') {
        editDiv.style.display = 'none';
        bodyDiv.style.display = 'block';
      } else {
        reviewList.querySelectorAll('.mcq-edit').forEach(el => el.style.display = 'none');
        reviewList.querySelectorAll('.mcq-card-body').forEach(el => el.style.display = 'block');
        
        editDiv.style.display = 'block';
        bodyDiv.style.display = 'none';
      }
      return;
    }

    if (e.target.closest('.btn-cancel-edit')) {
      const card = e.target.closest('.mcq-card');
      card.querySelector('.mcq-edit').style.display = 'none';
      card.querySelector('.mcq-card-body').style.display = 'block';
      return;
    }

    if (e.target.closest('.btn-save-edit')) {
      const card = e.target.closest('.mcq-card');
      const idx = parseInt(e.target.closest('.btn-save-edit').getAttribute('data-idx'), 10);
      const correctRadio = card.querySelector(`input[name="correct_${idx}"]:checked`);
      
      parsedMcqs[idx].Question = card.querySelector('.edit-q').value.trim();
      parsedMcqs[idx]['Option A'] = card.querySelector('.edit-a').value.trim();
      parsedMcqs[idx]['Option B'] = card.querySelector('.edit-b').value.trim();
      parsedMcqs[idx]['Option C'] = card.querySelector('.edit-c').value.trim();
      parsedMcqs[idx]['Option D'] = card.querySelector('.edit-d').value.trim();
      parsedMcqs[idx].Explanation = card.querySelector('.edit-exp').value.trim();
      if (correctRadio) parsedMcqs[idx]['Correct Answer'] = correctRadio.value;

      renderPreview();
      return;
    }
  });

  await loadStructures();
})();