import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

var attDate = document.getElementById('attDate');
var selClass = document.getElementById('selClass');
var subjectChips = document.getElementById('subjectChips');
var markingSection = document.getElementById('markingSection');
var rollInput = document.getElementById('rollInput');
var rollName = document.getElementById('rollName');
var attHead = document.getElementById('attHead');
var attBody = document.getElementById('attBody');
var attEmpty = document.getElementById('attEmpty');
var attMsg = document.getElementById('attMsg');
var attDashboard = document.getElementById('attDashboard');

var currentStatus = 'present';
var studentsList = [];
var selectedSubjectsList = [];
var attendanceMap = {};
var subjectColumnMap = { physics: 'physics', chemistry: 'chemistry', biology: 'biology', cs: 'cs', 'computer science': 'cs' };

function subjectToColumn(subjectName) {
  if (!subjectName) return null;
  var s = (subjectName + '').toLowerCase().trim();
  if (subjectColumnMap[s]) return subjectColumnMap[s];
  if (s.indexOf('physics') !== -1) return 'physics';
  if (s.indexOf('chemistry') !== -1) return 'chemistry';
  if (s.indexOf('biology') !== -1 || s.indexOf('bio') !== -1) return 'biology';
  if (s.indexOf('computer') !== -1 || s === 'cs') return 'cs';
  return null;
}

function setToday() {
  var d = new Date();
  attDate.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function loadClasses() {
  var { data } = await supabase.from('admission_form').select('class').not('class', 'is', null);
  var classes = [...new Set((data || []).map(function (r) { return r.class; }))].filter(Boolean).sort(function (a, b) { return a - b; });
  selClass.innerHTML = '<option value="">— Select class —</option>' + classes.map(function (c) { return '<option value="' + c + '">Class ' + c + '</option>'; }).join('');
}

function getSelectedSubjects() {
  var list = [];
  subjectChips.querySelectorAll('.subject-toggle.selected').forEach(function (btn) {
    if (btn.dataset.subject) list.push(btn.dataset.subject);
  });
  return list;
}

async function loadSubjects() {
  var cls = selClass.value;
  subjectChips.innerHTML = 'Select class first.';
  if (!cls) return;
  var { data } = await supabase.from('subjects').select('subject').eq('class', parseInt(cls)).order('subject');
  var subs = data || [];
  if (subs.length === 0) {
    subjectChips.innerHTML = '<span style="color:#94a3b8;">No subjects for this class. <a href="subjects.html">Add subjects</a></span>';
    return;
  }
  subjectChips.innerHTML = '';
  subs.forEach(function (r) {
    var subj = r.subject || '';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'subject-toggle';
    btn.dataset.subject = subj;
    btn.textContent = subj;
    btn.addEventListener('click', function () {
      btn.classList.toggle('selected');
      loadStudentsAndAttendance();
    });
    subjectChips.appendChild(btn);
  });
  loadStudentsAndAttendance();
}

async function loadStudentsAndAttendance() {
  var cls = selClass.value;
  var dt = attDate.value;
  selectedSubjectsList = getSelectedSubjects();
  if (!cls || !dt || selectedSubjectsList.length === 0) {
    markingSection.style.display = 'none';
    rollName.textContent = '';
    return;
  }
  var clsNum = parseInt(cls);
  var { data: adm } = await supabase.from('admission_form').select('roll, name, physics, chemistry, biology, cs').eq('class', clsNum).eq('status', 'Active');
  var admList = adm || [];
  var rollToCol = { Physics: 'physics', Chemistry: 'chemistry', Biology: 'biology', CS: 'cs', 'Computer Science': 'cs' };
  function isEnrolled(st, subj) {
    var col = rollToCol[subj] || subjectToColumn(subj);
    return col && st[col] === true;
  }
  var byRoll = {};
  admList.forEach(function (s) {
    var subs = selectedSubjectsList.filter(function (subj) { return isEnrolled(s, subj); });
    if (subs.length === 0) return;
    byRoll[s.roll] = { roll: s.roll, name: s.name, subjects: subs };
  });
  studentsList = Object.keys(byRoll).map(function (r) { return byRoll[r]; }).sort(function (a, b) { return a.roll - b.roll; });

  if (studentsList.length === 0) {
    markingSection.style.display = 'block';
    attBody.innerHTML = '';
    attEmpty.style.display = 'block';
    attEmpty.textContent = 'No students enrolled in selected subjects for Class ' + cls + '.';
    rollName.textContent = '';
    return;
  }
  attEmpty.style.display = 'none';

  attendanceMap = {};
  for (var i = 0; i < selectedSubjectsList.length; i++) {
    var subj = selectedSubjectsList[i];
    var { data: att } = await supabase.from('attendance').select('roll, status').eq('att_date', dt).eq('class', clsNum).eq('subject', subj);
    (att || []).forEach(function (r) {
      if (!attendanceMap[r.roll]) attendanceMap[r.roll] = {};
      attendanceMap[r.roll][subj] = r.status;
    });
  }

  markingSection.style.display = 'block';
  attDashboard.style.display = 'grid';
  renderTable();
  attMsg.textContent = '';
  updateRollName();
}

function getStatus(roll, subject) {
  var st = attendanceMap[roll] && attendanceMap[roll][subject];
  return st || null;
}

function setStatus(roll, subject, status) {
  if (!attendanceMap[roll]) attendanceMap[roll] = {};
  attendanceMap[roll][subject] = status;
}

function renderTable() {
  var headers = '<th>Roll</th><th>Name</th>';
  selectedSubjectsList.forEach(function (subj) { headers += '<th>' + escapeHtml(subj) + '</th>'; });
  attHead.innerHTML = '<tr>' + headers + '</tr>';
  attBody.innerHTML = studentsList.map(function (s) {
    var row = '<td><strong>' + s.roll + '</strong></td><td>' + escapeHtml(s.name || '—') + '</td>';
    selectedSubjectsList.forEach(function (subj) {
      if (s.subjects.indexOf(subj) === -1) {
        row += '<td style="color:#94a3b8;">—</td>';
      } else {
        var st = getStatus(s.roll, subj);
        if (!st) {
          row += '<td style="color:#94a3b8;">—</td>';
        } else {
          var cls = st === 'present' ? 'status-p' : st === 'holiday' ? 'status-h' : 'status-a';
          row += '<td class="' + cls + '">' + st.charAt(0).toUpperCase() + st.slice(1) + '</td>';
        }
      }
    });
    return '<tr>' + row + '</tr>';
  }).join('');
  updateAttendanceDashboard();
}

function updateAttendanceDashboard() {
  var present = 0, absent = 0, holiday = 0;
  studentsList.forEach(function (s) {
    s.subjects.forEach(function (subj) {
      var st = getStatus(s.roll, subj);
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'holiday') holiday++;
    });
  });
  var dashP = document.getElementById('dashPresent');
  var dashA = document.getElementById('dashAbsent');
  var dashH = document.getElementById('dashHoliday');
  if (dashP) dashP.textContent = present;
  if (dashA) dashA.textContent = absent;
  if (dashH) dashH.textContent = holiday;
}

function updateRollName() {
  var roll = parseInt(rollInput.value, 10);
  if (!roll) { rollName.textContent = ''; return; }
  var found = studentsList.find(function (s) { return s.roll === roll; });
  rollName.textContent = found ? '— ' + (found.name || '') : '— ?';
}

function escapeHtml(str) {
  var d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

async function saveAttendance(roll, status, silent) {
  var dt = attDate.value;
  var cls = parseInt(selClass.value);
  if (!dt || !cls || selectedSubjectsList.length === 0) return;
  var student = studentsList.find(function (s) { return s.roll === parseInt(roll, 10); });
  var subjectsToSave = student ? student.subjects : [];
  if (subjectsToSave.length === 0) return;
  var studentName = student ? (student.name || null) : null;
  for (var i = 0; i < subjectsToSave.length; i++) {
    var subj = subjectsToSave[i];
    var payload = { att_date: dt, class: cls, subject: subj, roll: parseInt(roll), student_name: studentName, status: status, updated_at: new Date().toISOString() };
    var { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'att_date,class,subject,roll' });
    if (error) {
      attMsg.textContent = 'Error: ' + error.message;
      attMsg.className = 'msg err';
      return;
    }
    setStatus(parseInt(roll), subj, status);
  }
  renderTable();
  updateAttendanceDashboard();
  if (!silent) {
    attMsg.textContent = 'Saved for ' + subjectsToSave.length + ' subject(s).';
    attMsg.className = 'msg ok';
    setTimeout(function () { attMsg.textContent = ''; }, 1500);
  }
}

function setToggleActive(btn) {
  document.querySelectorAll('.toggle-btn').forEach(function (b) { b.classList.remove('active', 'absent', 'holiday'); });
  btn.classList.add(btn.dataset.status === 'present' ? 'active' : btn.dataset.status === 'holiday' ? 'holiday' : 'absent');
  currentStatus = btn.dataset.status;
}

document.getElementById('btnPresent').addEventListener('click', function () { setToggleActive(this); });
document.getElementById('btnAbsent').addEventListener('click', function () { setToggleActive(this); });
document.getElementById('btnHoliday').addEventListener('click', function () { setToggleActive(this); });

document.getElementById('btnMarkRoll').addEventListener('click', function () {
  var roll = parseInt(rollInput.value, 10);
  if (!roll) {
    attMsg.textContent = 'Enter a roll number.';
    attMsg.className = 'msg err';
    return;
  }
  var found = studentsList.find(function (s) { return s.roll === roll; });
  if (!found) {
    attMsg.textContent = 'Roll ' + roll + ' is not in the list for this class/subjects.';
    attMsg.className = 'msg err';
    return;
  }
  saveAttendance(roll, currentStatus);
  rollInput.value = '';
  rollName.textContent = '';
  rollInput.focus();
});

rollInput.addEventListener('input', updateRollName);
rollInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('btnMarkRoll').click();
  }
});

document.getElementById('btnMarkAllPresent').addEventListener('click', async function () {
  if (studentsList.length === 0) return;
  attMsg.textContent = 'Saving...';
  attMsg.className = 'msg';
  for (var i = 0; i < studentsList.length; i++) {
    await saveAttendance(studentsList[i].roll, 'present', true);
  }
  updateAttendanceDashboard();
  attMsg.textContent = 'All marked Present in all selected subjects.';
  attMsg.className = 'msg ok';
});

document.getElementById('btnMarkAllAbsent').addEventListener('click', async function () {
  if (studentsList.length === 0) return;
  attMsg.textContent = 'Saving...';
  attMsg.className = 'msg';
  for (var i = 0; i < studentsList.length; i++) {
    await saveAttendance(studentsList[i].roll, 'absent', true);
  }
  updateAttendanceDashboard();
  attMsg.textContent = 'All marked Absent in all selected subjects.';
  attMsg.className = 'msg ok';
});

document.getElementById('btnMarkAllHoliday').addEventListener('click', async function () {
  if (studentsList.length === 0) return;
  attMsg.textContent = 'Saving...';
  attMsg.className = 'msg';
  for (var i = 0; i < studentsList.length; i++) {
    await saveAttendance(studentsList[i].roll, 'holiday', true);
  }
  updateAttendanceDashboard();
  attMsg.textContent = 'All marked Holiday in all selected subjects.';
  attMsg.className = 'msg ok';
});

document.getElementById('btnLoadAttendance').addEventListener('click', function () {
  if (!selClass.value || getSelectedSubjects().length === 0) {
    attMsg.textContent = 'Select class and at least one subject, then click Load attendance.';
    attMsg.className = 'msg err';
    return;
  }
  attMsg.textContent = '';
  loadStudentsAndAttendance();
});

selClass.addEventListener('change', loadSubjects);
attDate.addEventListener('change', loadStudentsAndAttendance);

setToday();
loadClasses();
