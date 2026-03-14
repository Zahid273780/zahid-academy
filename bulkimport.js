import { supabase, initAuthGuard } from './auth-guard.js';

// --- DIAGNOSTIC TEST: This proves the new file is running ---
const testBanner = document.createElement('div');
testBanner.style.cssText = "background: #16a34a; color: white; padding: 10px; text-align: center; font-weight: bold; position: fixed; top: 0; left: 0; width: 100%; z-index: 9999;";
testBanner.textContent = "✅ NEW SCRIPT LOADED SUCCESSFULLY! EDIT/DELETE ENABLED.";
document.body.prepend(testBanner);
setTimeout(() => testBanner.remove(), 5000); // Removes after 5 seconds
// ------------------------------------------------------------

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

let structures = [];
let parsedMcqs = [];

// Security: Escapes HTML to prevent XSS vulnerabilities
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

function renderPreview() {
  if (!parsedMcqs.length) {
    reviewSection.classList.add('hidden');
    reviewList.innerHTML = '';
    reviewCount.textContent = '';
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
              <span style="color:#2563eb;margin-right:6px;">${idx + 1}.</span>${safeQ}
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
  showMsg('', '');
  if (!parsedMcqs.length) {
    showMsg('Nothing to import. Parse MCQs first.', 'err');
    return;
  }

  const toImport = parsedMcqs.filter(q => q._checked !== false);
  
  if (!toImport.length) {
    showMsg('Select at least one question to import.', 'err');
    return;
  }

  const f = currentFilter();
  const testNumber = selTestNumber.value ? parseInt(selTestNumber.value, 10) : null;
  const isMockTest = typeMock && typeMock.checked;
  const hideValue = isMockTest ? true : false;

  const rows = toImport.map(q => {
    return {
      Course: f.course,
      'Class/Exam': f.classExam,
      Subject: f.subject,
      Unit: f.unit,
      Category: f.category || null,
      'Test Number': testNumber,
      Question: q.Question,
      'Option A': q['Option A'],
      'Option B': q['Option B'],
      'Option C': q['Option C'],
      'Option D': q['Option D'],
      'Correct Answer': q['Correct Answer'],
      Explanation: q.Explanation || null,
      hide: hideValue
    };
  });

  importSelectedBtn.disabled = true;
  importSelectedBtn.textContent = 'Importing…';

  const { error } = await supabase.from('mcqs').insert(rows);
  importSelectedBtn.disabled = false;
  importSelectedBtn.textContent = 'Import selected';

  if (error) {
    showMsg('Import failed: ' + error.message, 'err');
    return;
  }

  showMsg('Imported ' + rows.length + ' questions into MCQs.', 'ok');
}

(async function init() {
  const ok = await initAuthGuard();
  if (!ok) return;

  selCourse.addEventListener('change', () => { updateClassExamOptions(); });
  selClassExam.addEventListener('change', () => { updateSubjectOptions(); });
  selSubject.addEventListener('change', () => { updateUnitOptions(); });
  selUnit.addEventListener('change', () => { updateCategoryAndTestOptions(); });
  selCategory.addEventListener('change', updateParseButton);
  selTestNumber.addEventListener('change', updateParseButton);

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
    renderPreview();
  });
  
  deselectAllBtn.addEventListener('click', function () {
    parsedMcqs.forEach(q => q._checked = false);
    renderPreview();
  });
  
  importSelectedBtn.addEventListener('click', handleImportSelected);

  // --- Dynamic UI Event Delegation ---
  reviewList.addEventListener('click', function (e) {
    
    if (e.target.classList.contains('mcq-check')) {
      const idx = parseInt(e.target.getAttribute('data-idx'), 10);
      parsedMcqs[idx]._checked = e.target.checked;
      const card = e.target.closest('.mcq-card');
      card.style.opacity = e.target.checked ? '1' : '0.5';
      return;
    }

    if (e.target.closest('.btn-remove')) {
      const idx = parseInt(e.target.closest('.btn-remove').getAttribute('data-idx'), 10);
      parsedMcqs.splice(idx, 1);
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