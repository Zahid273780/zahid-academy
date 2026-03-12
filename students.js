import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

var allStudents = [];
var emailMap = {};

var tableBody = document.getElementById('tableBody');
var emptyMsg = document.getElementById('emptyMsg');
var searchName = document.getElementById('searchName');
var searchRoll = document.getElementById('searchRoll');
var monthPicker = document.getElementById('monthPicker');
var statusFilter = document.getElementById('statusFilter');
var countLabel = document.getElementById('countLabel');

var now = new Date();
monthPicker.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

async function loadData() {
  var [admRes, usersRes] = await Promise.all([
    supabase.from('admission_form').select('*').order('roll', { ascending: false }),
    supabase.from('users').select('roll, email')
  ]);

  if (admRes.error) {
    tableBody.innerHTML = '<tr><td colspan="11" class="loading-msg" style="color:#dc2626;">Error loading: ' + admRes.error.message + '</td></tr>';
    return;
  }

  allStudents = admRes.data || [];

  emailMap = {};
  if (!usersRes.error && usersRes.data) {
    usersRes.data.forEach(function (u) {
      if (u.roll && u.email) {
        emailMap[u.roll] = u.email;
      }
    });
  }

  updateDashboard();
  renderTable();
}

function getMonthRange() {
  var val = monthPicker.value;
  if (!val) return null;
  var parts = val.split('-');
  var y = parseInt(parts[0]);
  var m = parseInt(parts[1]);
  var start = new Date(y, m - 1, 1);
  var end = new Date(y, m, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  };
}

function updateDashboard() {
  var range = getMonthRange();

  document.getElementById('statTotal').textContent = allStudents.length;

  var activeCount = allStudents.filter(function (s) { return s.status === 'Active'; }).length;
  document.getElementById('statActive').textContent = activeCount;

  if (range) {
    var admittedThisMonth = allStudents.filter(function (s) {
      return s.admission_date >= range.start && s.admission_date <= range.end;
    });
    document.getElementById('statAdmitted').textContent = admittedThisMonth.length;
    document.getElementById('statAdmittedSub').textContent = range.label;

    var totalInactive = allStudents.filter(function (s) { return s.status === 'Inactive'; }).length;
    document.getElementById('statLeft').textContent = totalInactive;
    document.getElementById('statLeftSub').textContent = totalInactive + ' total inactive';
  } else {
    document.getElementById('statAdmitted').textContent = '—';
    document.getElementById('statAdmittedSub').textContent = '';
    document.getElementById('statLeft').textContent = allStudents.filter(function (s) { return s.status === 'Inactive'; }).length;
    document.getElementById('statLeftSub').textContent = 'total inactive';
  }
}

function getFiltered() {
  var nameQ = searchName.value.trim().toLowerCase();
  var rollQ = searchRoll.value.trim();
  var statusQ = statusFilter.value;

  return allStudents.filter(function (s) {
    if (rollQ && String(s.roll) !== rollQ) return false;

    if (nameQ) {
      var name = (s.name || '').toLowerCase();
      var father = (s.father || '').toLowerCase();
      var email = (findEmail(s.roll) || '').toLowerCase();
      if (name.indexOf(nameQ) === -1 && father.indexOf(nameQ) === -1 && email.indexOf(nameQ) === -1) return false;
    }

    if (statusQ && s.status !== statusQ) return false;

    return true;
  });
}

function findEmail(roll) {
  if (!roll) return null;
  return emailMap[roll] || null;
}

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function renderTable() {
  var rows = getFiltered();
  emptyMsg.style.display = rows.length === 0 ? 'block' : 'none';
  countLabel.textContent = rows.length + ' student' + (rows.length !== 1 ? 's' : '');

  if (rows.length === 0) {
    tableBody.innerHTML = '';
    return;
  }

  tableBody.innerHTML = rows.map(function (s) {
    var email = findEmail(s.roll);
    var statusClass = s.status === 'Active' ? 'status-active' : s.status === 'Inactive' ? 'status-inactive' : 'status-pending';

    var subsList = [];
    if (s.physics) subsList.push('Phy');
    if (s.chemistry) subsList.push('Chem');
    if (s.biology) subsList.push('Bio');
    if (s.cs) subsList.push('CS');
    var subs = subsList.join(', ');

    var phone = [];
    if (s.phone) phone.push(esc(s.phone));
    if (s.whatsapp && s.whatsapp !== s.phone) phone.push('WA: ' + esc(s.whatsapp));

    return '<tr>'
      + '<td><span class="roll-badge">' + s.roll + '</span></td>'
      + '<td><strong>' + esc(s.name) + '</strong></td>'
      + '<td>' + esc(s.father) + '</td>'
      + '<td class="email-cell ' + (email ? '' : 'none') + '">' + (email ? esc(email) : '—') + '</td>'
      + '<td><span class="class-badge">' + (s.class || '—') + '</span></td>'
      + '<td class="subjects-cell">' + (esc(subs) || '—') + '</td>'
      + '<td class="fee-cell">Rs.' + (s.fee || 0) + '</td>'
      + '<td style="font-size:0.8rem;">' + (phone.join('<br>') || '—') + '</td>'
      + '<td class="date-cell">' + (s.admission_date || '—') + '</td>'
      + '<td><span class="' + statusClass + '">' + s.status + '</span></td>'
      + '<td><button class="btn-del" data-roll="' + s.roll + '" data-name="' + esc(s.name) + '">Delete</button></td>'
      + '</tr>';
  }).join('');

  tableBody.querySelectorAll('.btn-del').forEach(function (btn) {
    btn.addEventListener('click', function () {
      deleteStudent(parseInt(btn.dataset.roll), btn.dataset.name);
    });
  });
}

async function deleteStudent(roll, name) {
  if (!confirm('Delete student "' + name + '" (Roll #' + roll + ')?\n\nThis cannot be undone.')) return;

  var { error } = await supabase.from('admission_form').delete().eq('roll', roll);
  if (error) {
    alert('Delete failed: ' + error.message);
    return;
  }

  allStudents = allStudents.filter(function (s) { return s.roll !== roll; });
  updateDashboard();
  renderTable();
}

searchName.addEventListener('input', renderTable);
searchRoll.addEventListener('input', renderTable);
statusFilter.addEventListener('change', renderTable);
monthPicker.addEventListener('change', updateDashboard);

loadData();
