import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

var allResults = [];
var tableBody = document.getElementById('tableBody');
var emptyMsg = document.getElementById('emptyMsg');
var searchName = document.getElementById('searchName');
var searchRoll = document.getElementById('searchRoll');
var monthPicker = document.getElementById('monthPicker');
var gradeFilter = document.getElementById('gradeFilter');
var typeFilter = document.getElementById('typeFilter');
var countLabel = document.getElementById('countLabel');

var now = new Date();
monthPicker.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

async function loadData() {
  var { data, error } = await supabase
    .from('studentpractice')
    .select('*')
    .order('test_date', { ascending: false });

  if (error) {
    tableBody.innerHTML = '<tr><td colspan="19" class="loading-msg" style="color:#dc2626;">Error: ' + error.message + '</td></tr>';
    return;
  }

  allResults = data || [];
  updateDashboard();
  renderTable();
}

function toLocalDate(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getMonthRange() {
  var val = monthPicker.value;
  if (!val) return null;
  var parts = val.split('-');
  var y = parseInt(parts[0]);
  var m = parseInt(parts[1]);
  var start = y + '-' + String(m).padStart(2, '0') + '-01';
  var endDate = new Date(y, m, 0);
  var end = y + '-' + String(m).padStart(2, '0') + '-' + String(endDate.getDate()).padStart(2, '0');
  var label = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { start: start, end: end, label: label };
}

function updateDashboard() {
  document.getElementById('statTotal').textContent = allResults.length;

  var today = todayStr();
  var todayCount = allResults.filter(function (r) { return toLocalDate(r.test_date) === today; }).length;
  document.getElementById('statToday').textContent = todayCount;
  document.getElementById('statTodaySub').textContent = today;

  var range = getMonthRange();
  if (range) {
    var monthCount = allResults.filter(function (r) {
      var d = toLocalDate(r.test_date);
      return d >= range.start && d <= range.end;
    }).length;
    document.getElementById('statMonth').textContent = monthCount;
    document.getElementById('statMonthSub').textContent = range.label;
  }

  if (allResults.length > 0) {
    var totalPct = allResults.reduce(function (sum, r) { return sum + (parseFloat(r.percentage) || 0); }, 0);
    document.getElementById('statAvg').textContent = (totalPct / allResults.length).toFixed(1) + '%';
  } else {
    document.getElementById('statAvg').textContent = '--';
  }

  var uniqueRolls = new Set();
  allResults.forEach(function (r) {
    if (r.roll) uniqueRolls.add(r.roll);
    else if (r.user_id) uniqueRolls.add(r.user_id);
  });
  document.getElementById('statStudents').textContent = uniqueRolls.size;
}

function getFiltered() {
  var nameQ = searchName.value.trim().toLowerCase();
  var rollQ = searchRoll.value.trim();
  var gradeQ = gradeFilter.value;
  var range = getMonthRange();

  return allResults.filter(function (r) {
    if (rollQ && String(r.roll) !== rollQ) return false;

    if (nameQ) {
      var name = (r.name || '').toLowerCase();
      var father = (r.father || '').toLowerCase();
      if (name.indexOf(nameQ) === -1 && father.indexOf(nameQ) === -1) return false;
    }

    if (gradeQ && r.grade !== gradeQ) return false;

    var typeQ = typeFilter.value;
    if (typeQ && (r.test_type || '') !== typeQ) return false;

    if (range) {
      var d = toLocalDate(r.test_date);
      if (d < range.start || d > range.end) return false;
    }

    return true;
  });
}

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function formatTime(secs) {
  if (!secs && secs !== 0) return '--';
  var m = Math.floor(secs / 60);
  var s = secs % 60;
  if (m > 0) return m + 'm ' + s + 's';
  return secs + 's';
}

function pctClass(pct) {
  if (pct >= 70) return 'pct-high';
  if (pct >= 50) return 'pct-mid';
  return 'pct-low';
}

function gradeClass(status) {
  var s = (status || '').toLowerCase();
  if (s === 'master') return 'grade-master';
  if (s === 'excellent') return 'grade-excellent';
  if (s === 'good') return 'grade-good';
  if (s === 'average' || s === 'below average') return 'grade-avg';
  return 'grade-fail';
}

function renderTable() {
  var rows = getFiltered();
  emptyMsg.style.display = rows.length === 0 ? 'block' : 'none';
  countLabel.textContent = rows.length + ' result' + (rows.length !== 1 ? 's' : '');

  if (rows.length === 0) {
    tableBody.innerHTML = '';
    return;
  }

  tableBody.innerHTML = rows.map(function (r) {
    var pct = parseFloat(r.percentage) || 0;
    var dateStr = toLocalDate(r.test_date);

    var isMock = (r.test_type || '').toLowerCase().indexOf('mock') !== -1;
    var typeBadge = isMock
      ? '<span class="type-badge type-mock">Mock Test</span>'
      : '<span class="type-badge type-practice">Practice</span>';

    return '<tr>'
      + '<td><span class="roll-badge">' + (r.roll || '--') + '</span></td>'
      + '<td><strong>' + esc(r.name) + '</strong></td>'
      + '<td>' + esc(r.father || '--') + '</td>'
      + '<td>' + typeBadge + '</td>'
      + '<td>' + esc(r.course) + '</td>'
      + '<td>' + esc(r.class_exam) + '</td>'
      + '<td>' + esc(r.subject) + '</td>'
      + '<td>' + esc(r.unit) + '</td>'
      + '<td>' + esc(r.category || '--') + '</td>'
      + '<td>' + (r.test_number || '--') + '</td>'
      + '<td>' + r.total_marks + '</td>'
      + '<td>' + r.obtained_marks + '</td>'
      + '<td class="pct-cell ' + pctClass(pct) + '">' + pct + '%</td>'
      + '<td class="date-cell">' + formatTime(r.total_time_seconds) + '</td>'
      + '<td class="date-cell">' + (parseFloat(r.avg_time_seconds) || 0).toFixed(1) + 's</td>'
      + '<td><span class="grade-badge ' + gradeClass(r.status) + '">' + esc(r.grade) + '</span></td>'
      + '<td><span class="grade-badge ' + gradeClass(r.status) + '">' + esc(r.status) + '</span></td>'
      + '<td class="date-cell">' + dateStr + '</td>'
      + '<td><button class="btn-del" data-id="' + r.id + '" data-name="' + esc(r.name) + '">Del</button></td>'
      + '</tr>';
  }).join('');

  tableBody.querySelectorAll('.btn-del').forEach(function (btn) {
    btn.addEventListener('click', function () {
      deleteResult(btn.dataset.id, btn.dataset.name);
    });
  });
}

async function deleteResult(id, name) {
  if (!confirm('Delete test result for "' + name + '"?\n\nThis cannot be undone.')) return;

  var { error } = await supabase.from('studentpractice').delete().eq('id', id);
  if (error) {
    alert('Delete failed: ' + error.message);
    return;
  }

  allResults = allResults.filter(function (r) { return r.id !== id; });
  updateDashboard();
  renderTable();
}

searchName.addEventListener('input', renderTable);
searchRoll.addEventListener('input', renderTable);
gradeFilter.addEventListener('change', renderTable);
typeFilter.addEventListener('change', renderTable);
monthPicker.addEventListener('change', function () {
  updateDashboard();
  renderTable();
});

loadData();
