import { supabase, initAuthGuard } from './auth-guard.js';

await initAuthGuard();

const fromDate = document.getElementById('fromDate');
const toDate = document.getElementById('toDate');
const applyBtn = document.getElementById('applyBtn');
const last30Btn = document.getElementById('last30Btn');
const msg = document.getElementById('msg');
const statToday = document.getElementById('statToday');
const statTotal = document.getElementById('statTotal');
const statDays = document.getElementById('statDays');
const tableBody = document.getElementById('tableBody');

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function setLast30Days() {
  const now = new Date();
  const from = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  fromDate.value = ymd(from);
  toDate.value = ymd(now);
}

async function loadStats() {
  msg.textContent = '';
  tableBody.innerHTML = '<tr><td colspan="2" class="loading">Loading...</td></tr>';

  const { data: sess } = await supabase.auth.getSession();
  const token = sess && sess.session && sess.session.access_token ? sess.session.access_token : null;
  if (!token) {
    msg.textContent = 'Not authenticated';
    return;
  }

  const params = new URLSearchParams();
  if (fromDate.value) params.set('from', fromDate.value);
  if (toDate.value) params.set('to', toDate.value);

  try {
    const res = await fetch('/api/mcq-daily-stats?' + params.toString(), {
      headers: { authorization: 'Bearer ' + token },
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      msg.textContent = data.error || 'Could not load stats';
      tableBody.innerHTML = '<tr><td colspan="2" class="loading">No data</td></tr>';
      return;
    }

    statToday.textContent = data.todayTotal != null ? data.todayTotal : 0;
    statTotal.textContent = data.totalMcqs != null ? data.totalMcqs : 0;
    statDays.textContent = data.days != null ? data.days : 0;

    const rows = data.daily || [];
    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="2" class="loading">No records found</td></tr>';
      return;
    }

    tableBody.innerHTML = rows.map(function (row) {
      return '<tr><td>' + row.date + '</td><td>' + row.total + '</td></tr>';
    }).join('');
  } catch (e) {
    msg.textContent = 'Network error while loading stats';
    tableBody.innerHTML = '<tr><td colspan="2" class="loading">No data</td></tr>';
  }
}

setLast30Days();
applyBtn.addEventListener('click', loadStats);
last30Btn.addEventListener('click', function () { setLast30Days(); loadStats(); });
loadStats();
