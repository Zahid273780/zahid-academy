import { supabase, initAuthGuard } from './auth-guard.js';

await initAuthGuard();

var tableBody = document.getElementById('tableBody');
var countLabel = document.getElementById('countLabel');
var msg = document.getElementById('msg');

var filterDate = document.getElementById('filterDate');
var filterName = document.getElementById('filterName');
var filterNumber = document.getElementById('filterNumber');
var applyBtn = document.getElementById('applyBtn');
var todayBtn = document.getElementById('todayBtn');

function todayYmd() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function esc(v) {
  var div = document.createElement('div');
  div.textContent = v == null ? '' : String(v);
  return div.innerHTML;
}

function formatDate(v) {
  if (!v) return '—';
  var d = new Date(v);
  if (isNaN(d.getTime())) return esc(v);
  return d.toLocaleString();
}

async function loadRows() {
  msg.textContent = '';
  tableBody.innerHTML = '<tr><td colspan="6" class="loading">Loading...</td></tr>';

  const { data: sess } = await supabase.auth.getSession();
  var token = sess && sess.session && sess.session.access_token ? sess.session.access_token : null;
  if (!token) {
    msg.textContent = 'Not authenticated';
    tableBody.innerHTML = '';
    countLabel.textContent = '0 records';
    return;
  }

  var params = new URLSearchParams();
  if (filterDate.value) params.set('date', filterDate.value);
  if (filterName.value.trim()) params.set('name', filterName.value.trim());
  if (filterNumber.value.trim()) params.set('number', filterNumber.value.trim());

  try {
    var res = await fetch('/api/student-signup-list?' + params.toString(), {
      headers: { authorization: 'Bearer ' + token },
    });
    var data = await res.json();

    if (!res.ok || data.error) {
      msg.textContent = data.error || 'Could not load records';
      tableBody.innerHTML = '';
      countLabel.textContent = '0 records';
      return;
    }

    var rows = data.rows || [];
    countLabel.textContent = rows.length + ' record' + (rows.length === 1 ? '' : 's');

    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="6" class="loading">No records found</td></tr>';
      return;
    }

    tableBody.innerHTML = rows.map(function (r) {
      return '<tr>'
        + '<td>' + esc(r.name || '—') + '</td>'
        + '<td>' + esc(r.username || '—') + '</td>'
        + '<td>' + esc(r.mobile || '—') + '</td>'
        + '<td>' + esc(r.whatsapp || '—') + '</td>'
        + '<td>' + esc(r.email || '—') + '</td>'
        + '<td>' + formatDate(r.created_at) + '</td>'
        + '</tr>';
    }).join('');
  } catch (e) {
    msg.textContent = 'Network error while loading records';
    tableBody.innerHTML = '';
    countLabel.textContent = '0 records';
  }
}

filterDate.value = todayYmd();

applyBtn.addEventListener('click', loadRows);
todayBtn.addEventListener('click', function () {
  filterDate.value = todayYmd();
  loadRows();
});

filterName.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') loadRows();
});
filterNumber.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') loadRows();
});
filterDate.addEventListener('change', loadRows);

loadRows();
