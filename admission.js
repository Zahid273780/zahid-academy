import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

const form = document.getElementById('admissionForm');
const messageDiv = document.getElementById('message');
const tableBody = document.getElementById('students-table-body');
const rollInput = document.getElementById('roll');
const rollHint = document.getElementById('rollHint');
const classInput = document.getElementById('class');
const subjectsSection = document.getElementById('subjectsSection');
const feeInput = document.getElementById('fee');
const feeBreakdown = document.getElementById('feeBreakdown');
const classLabel = document.getElementById('classLabel');

let classSubjects = [];
let lastRoll = 0;

// --- Auto-fill roll number ---
async function loadLastRoll() {
  const { data, error } = await supabase
    .from('admission_form')
    .select('roll')
    .order('roll', { ascending: false })
    .limit(1);

  if (!error && data && data.length > 0) {
    lastRoll = data[0].roll;
  } else {
    lastRoll = 0;
  }
  const nextRoll = lastRoll + 1;
  rollInput.value = nextRoll;
  rollInput.placeholder = 'e.g. ' + nextRoll;
  rollHint.innerHTML = 'Last roll: <strong>' + lastRoll + '</strong> — Next suggested: <strong>' + nextRoll + '</strong>';
}

// --- Load subjects from subjects table based on class ---
let debounceTimer;
classInput.addEventListener('input', function () {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function () {
    const cls = parseInt(classInput.value);
    if (cls && cls > 0) {
      loadSubjectsForClass(cls);
    } else {
      subjectsSection.innerHTML = '<div class="no-subjects">Select a class above to load subjects</div>';
      classLabel.textContent = '';
      classSubjects = [];
      recalcFee();
    }
  }, 300);
});

async function loadSubjectsForClass(cls) {
  subjectsSection.className = 'subjects-section loading';
  subjectsSection.innerHTML = 'Loading subjects for class ' + cls + '...';
  classLabel.textContent = '(Class ' + cls + ')';

  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('class', cls)
    .order('subject', { ascending: true });

  subjectsSection.className = 'subjects-section';

  if (error) {
    subjectsSection.innerHTML = '<div class="no-subjects" style="color:#dc2626;">Error loading subjects</div>';
    classSubjects = [];
    return;
  }

  classSubjects = data || [];

  if (classSubjects.length === 0) {
    subjectsSection.innerHTML = '<div class="no-subjects">No subjects found for class ' + cls + '. <a href="subjects.html" style="color:var(--primary);">Add subjects</a></div>';
    recalcFee();
    return;
  }

  renderSubjectCheckboxes();
}

function renderSubjectCheckboxes() {
  var html = '<div class="subjects-grid">';
  classSubjects.forEach(function (s) {
    html += '<label class="subject-chip" data-id="' + s.id + '">'
      + '<input type="checkbox" value="' + s.id + '" data-fee="' + s.fee + '" data-name="' + s.subject + '">'
      + '<span class="sub-name">' + s.subject + '</span>'
      + '<span class="sub-fee">Rs. ' + s.fee + '</span>'
      + '</label>';
  });
  html += '</div>';
  subjectsSection.innerHTML = html;

  subjectsSection.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      cb.closest('.subject-chip').classList.toggle('checked', cb.checked);
      recalcFee();
    });
  });
}

function recalcFee() {
  var total = 0;
  var parts = [];
  subjectsSection.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
    var fee = parseInt(cb.dataset.fee) || 0;
    total += fee;
    parts.push(cb.dataset.name + ' Rs.' + fee);
  });

  feeInput.value = total;

  if (parts.length > 0) {
    feeBreakdown.style.display = 'block';
    feeBreakdown.textContent = parts.join(' + ') + ' = Rs. ' + total;
  } else {
    feeBreakdown.style.display = 'none';
  }
}

function getSelectedSubjects() {
  var selected = [];
  subjectsSection.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
    selected.push(cb.dataset.name);
  });
  return selected;
}

// --- Students table ---
async function fetchStudents() {
  const { data, error } = await supabase
    .from('admission_form')
    .select('*')
    .order('roll', { ascending: true });

  if (error) { console.error('Error fetching:', error); return; }

  tableBody.innerHTML = '';
  data.forEach(function (s) {
    var subsList = [];
    if (s.physics) subsList.push('Phy');
    if (s.chemistry) subsList.push('Chem');
    if (s.biology) subsList.push('Bio');
    if (s.cs) subsList.push('CS');
    var subs = subsList.join(', ');

    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + s.roll + '</td>'
      + '<td><strong>' + s.name + '</strong><br><small>' + s.father + '</small></td>'
      + '<td>' + (s.dob || '-') + '</td>'
      + '<td>' + (s.whatsapp || '-') + '</td>'
      + '<td>' + s.class + '</td>'
      + '<td>' + (subs || 'None') + '</td>'
      + '<td>Rs. ' + (s.fee || 0) + '</td>'
      + '<td>' + s.admission_date + '</td>'
      + '<td><span class="' + (s.status === 'Active' ? 'status-active' : 'status-inactive') + '">' + s.status + '</span></td>';
    tableBody.appendChild(tr);
  });
}

// --- Submit ---
form.addEventListener('submit', async function (e) {
  e.preventDefault();
  
  messageDiv.style.display = 'block';
  messageDiv.style.background = '#e2e8f0';
  messageDiv.style.color = '#1e293b';
  messageDiv.textContent = 'Saving student record...';

  var selectedSubjects = getSelectedSubjects();
  var subsLower = selectedSubjects.map(function(s) { return s.toLowerCase(); });

  var payload = {
    roll: parseInt(rollInput.value),
    name: document.getElementById('name').value,
    father: document.getElementById('father').value,
    gender: document.getElementById('gender').value,
    dob: document.getElementById('dob').value || null,
    phone: document.getElementById('phone').value,
    whatsapp: document.getElementById('whatsapp').value,
    address: document.getElementById('address').value,
    class: parseInt(classInput.value) || null,
    physics: subsLower.indexOf('physics') !== -1,
    chemistry: subsLower.indexOf('chemistry') !== -1,
    biology: subsLower.indexOf('biology') !== -1,
    cs: subsLower.indexOf('cs') !== -1 || subsLower.indexOf('computer science') !== -1,
    admission_date: document.getElementById('admission_date').value,
    fee: parseInt(feeInput.value) || 0,
    status: document.getElementById('status').value
  };

  const { error } = await supabase
    .from('admission_form')
    .insert([payload]);

  if (error) {
    messageDiv.style.background = '#fee2e2';
    messageDiv.style.color = '#991b1b';
    messageDiv.textContent = 'Error: ' + error.message;
  } else {
    messageDiv.style.background = '#dcfce7';
    messageDiv.style.color = '#166534';
    messageDiv.textContent = 'Student Admitted Successfully!';
    form.reset();
    subjectsSection.innerHTML = '<div class="no-subjects">Select a class above to load subjects</div>';
    classLabel.textContent = '';
    feeBreakdown.style.display = 'none';
    classSubjects = [];
    await loadLastRoll();
    fetchStudents();
    setTimeout(function () { messageDiv.style.display = 'none'; }, 3000);
  }
});

// --- Init ---
loadLastRoll();
fetchStudents();
