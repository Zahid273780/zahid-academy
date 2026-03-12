import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

var fromMonth = document.getElementById('fromMonth');
var toMonth = document.getElementById('toMonth');
var selClass = document.getElementById('selClass');
var btnGenerate = document.getElementById('btnGenerate');
var btnApplyFilter = document.getElementById('btnApplyFilter');
var filterExactly = document.getElementById('filterExactly');
var filterOrLess = document.getElementById('filterOrLess');
var reportMsg = document.getElementById('reportMsg');
var reportSummary = document.getElementById('reportSummary');
var tableWrap = document.getElementById('tableWrap');
var reportHead = document.getElementById('reportHead');
var reportBody = document.getElementById('reportBody');
var reportEmpty = document.getElementById('reportEmpty');

var reportData = [];
var allRows = [];

function setDefaultMonths() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  fromMonth.value = y + '-' + m;
  toMonth.value = y + '-' + m;
}

function monthToRange(fromVal, toVal) {
  if (!fromVal || !toVal) return null;
  var start = fromVal + '-01';
  var toParts = toVal.split('-');
  var y = parseInt(toParts[0], 10);
  var mo = parseInt(toParts[1], 10);
  var lastDay = new Date(y, mo, 0).getDate();
  var end = toVal + '-' + String(lastDay).padStart(2, '0');
  return { start: start, end: end };
}

async function loadClasses() {
  var { data } = await supabase.from('admission_form').select('class').not('class', 'is', null);
  var classes = [...new Set((data || []).map(function (r) { return r.class; }))].filter(Boolean).sort(function (a, b) { return a - b; });
  selClass.innerHTML = '<option value="">— Select class —</option>' + classes.map(function (c) { return '<option value="' + c + '">Class ' + c + '</option>'; }).join('');
}

async function generateReport() {
  var range = monthToRange(fromMonth.value, toMonth.value);
  var cls = selClass.value;
  if (!range || !cls) {
    reportMsg.textContent = 'Please select From month, To month, and Class.';
    reportMsg.className = 'msg err';
    return;
  }
  var clsNum = parseInt(cls, 10);
  reportMsg.textContent = 'Loading...';
  reportMsg.className = 'msg';
  tableWrap.style.display = 'none';
  reportEmpty.style.display = 'none';

  var { data: attRows } = await supabase
    .from('attendance')
    .select('att_date, roll')
    .gte('att_date', range.start)
    .lte('att_date', range.end)
    .eq('class', clsNum)
    .eq('status', 'absent');

  var absentByRoll = {};
  (attRows || []).forEach(function (r) {
    if (!absentByRoll[r.roll]) absentByRoll[r.roll] = new Set();
    absentByRoll[r.roll].add(r.att_date);
  });

  var { data: admList } = await supabase
    .from('admission_form')
    .select('roll, name')
    .eq('class', clsNum)
    .eq('status', 'Active');

  allRows = (admList || []).map(function (s) {
    var days = absentByRoll[s.roll] ? absentByRoll[s.roll].size : 0;
    return { class: clsNum, roll: s.roll, name: s.name || '—', absentDays: days };
  }).sort(function (a, b) { return b.absentDays - a.absentDays; });

  reportData = allRows;
  applyFilter();
  reportMsg.textContent = 'Report generated for ' + range.start + ' to ' + range.end + ', Class ' + cls + '.';
  reportMsg.className = 'msg ok';
}

function applyFilter() {
  var exactVal = filterExactly.value.trim() === '' ? null : parseInt(filterExactly.value, 10);
  var orLessVal = filterOrLess.value.trim() === '' ? null : parseInt(filterOrLess.value, 10);

  if (exactVal !== null && !isNaN(exactVal)) {
    reportData = allRows.filter(function (r) { return r.absentDays === exactVal; });
    reportSummary.textContent = 'Showing students absent exactly ' + exactVal + ' day(s). Total: ' + reportData.length;
  } else if (orLessVal !== null && !isNaN(orLessVal)) {
    reportData = allRows.filter(function (r) { return r.absentDays <= orLessVal; });
    reportSummary.textContent = 'Showing students absent ' + orLessVal + ' days or less. Total: ' + reportData.length;
  } else {
    reportData = allRows.slice();
    reportSummary.textContent = 'Showing all students. Total: ' + reportData.length;
  }

  reportSummary.style.display = 'block';

  if (reportData.length === 0) {
    tableWrap.style.display = 'none';
    reportEmpty.style.display = 'block';
    reportEmpty.textContent = 'No students match the current filter. Try changing "Absent exactly" or "Absent ___ days or less".';
    return;
  }

  reportEmpty.style.display = 'none';
  tableWrap.style.display = 'block';
  reportBody.innerHTML = reportData.map(function (r) {
    return '<tr><td>' + r.class + '</td><td><strong>' + r.roll + '</strong></td><td>' + escapeHtml(r.name) + '</td><td class="days-absent">' + r.absentDays + '</td></tr>';
  }).join('');
}

function escapeHtml(str) {
  var d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

btnGenerate.addEventListener('click', generateReport);
btnApplyFilter.addEventListener('click', function () {
  if (allRows.length === 0) {
    reportMsg.textContent = 'Generate a report first, then apply a filter.';
    reportMsg.className = 'msg err';
    return;
  }
  applyFilter();
  reportMsg.textContent = 'Filter applied.';
  reportMsg.className = 'msg ok';
});

setDefaultMonths();
loadClasses();
