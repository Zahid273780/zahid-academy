import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

const qText     = document.getElementById('qText');
const qAuthor   = document.getElementById('qAuthor');
const qAddBtn   = document.getElementById('qAddBtn');
const qFormMsg  = document.getElementById('qFormMsg');
const qListArea = document.getElementById('qListArea');
const qCount    = document.getElementById('qCount');
const filterAll      = document.getElementById('filterAll');
const filterActive   = document.getElementById('filterActive');
const filterInactive = document.getElementById('filterInactive');
const todayPreview = document.getElementById('todayPreview');
const tpQuote      = document.getElementById('tpQuote');
const tpAuthor     = document.getElementById('tpAuthor');

let allQuotes = [];
let viewMode  = 'all';

/* ── helpers ── */
function showFormMsg(text, type) {
  qFormMsg.textContent   = text;
  qFormMsg.style.display = text ? 'block' : 'none';
  qFormMsg.style.background = type === 'err' ? '#fef2f2' : '#dcfce7';
  qFormMsg.style.color      = type === 'err' ? '#b91c1c' : '#16a34a';
  qFormMsg.style.border     = type === 'err' ? '1px solid #fecaca' : '1px solid #bbf7d0';
  if (type === 'ok') setTimeout(() => { qFormMsg.style.display = 'none'; }, 3000);
}

function h(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function getDayOfYear() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}

/* ── load ── */
async function loadQuotes() {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .order('id');

  if (error) {
    qListArea.innerHTML = '<div class="empty-q">Error: ' + h(error.message) + '</div>';
    return;
  }
  allQuotes = data || [];
  showTodayPreview();
  render();
}

/* ── today preview ── */
function showTodayPreview() {
  const active = allQuotes.filter(r => r.is_active);
  if (active.length === 0) return;
  const q = active[getDayOfYear() % active.length];
  tpQuote.textContent  = q.quote;
  tpAuthor.textContent = q.author;
  todayPreview.style.display = 'block';
}

/* ── render ── */
function render() {
  let list = allQuotes;
  if (viewMode === 'active')   list = list.filter(r => r.is_active);
  if (viewMode === 'inactive') list = list.filter(r => !r.is_active);

  qCount.textContent = list.length + ' quote' + (list.length !== 1 ? 's' : '');

  if (!list.length) {
    qListArea.innerHTML = '<div class="empty-q">No quotes found.</div>';
    return;
  }

  const dayIdx = getDayOfYear();
  const active = allQuotes.filter(r => r.is_active);

  qListArea.innerHTML = list.map((row, i) => {
    const isTodayQuote = active.length > 0 && active[dayIdx % active.length]?.id === row.id;
    const badge = row.is_active
      ? '<span class="badge-active">' + (isTodayQuote ? '⭐ Today' : 'Active') + '</span>'
      : '<span class="badge-inactive">Inactive</span>';
    const toggleLabel = row.is_active ? 'Deactivate' : 'Activate';
    const toggleClass = row.is_active ? 'active' : 'inactive';

    return (
      '<div class="q-row" data-id="' + h(String(row.id)) + '">'
      + '<div class="q-row-head">'
      +   '<div style="flex:1;">'
      +     '<p class="q-text">' + h(row.quote) + '</p>'
      +     '<p class="q-author">' + h(row.author) + '</p>'
      +   '</div>'
      +   '<div class="q-row-actions">'
      +     badge
      +     '<button class="btn-toggle-q ' + toggleClass + '" data-id="' + h(String(row.id)) + '" data-active="' + row.is_active + '">' + toggleLabel + '</button>'
      +     '<button class="btn-del-q" data-id="' + h(String(row.id)) + '">Delete</button>'
      +   '</div>'
      + '</div>'
      + '</div>'
    );
  }).join('');
}

/* ── add ── */
qAddBtn.addEventListener('click', async () => {
  const quote  = qText.value.trim();
  const author = qAuthor.value.trim() || 'Unknown';
  if (!quote) { showFormMsg('Quote text cannot be empty.', 'err'); return; }

  qAddBtn.disabled    = true;
  qAddBtn.textContent = 'Adding…';

  const { error } = await supabase.from('quotes').insert({ quote, author, is_active: true });

  qAddBtn.disabled    = false;
  qAddBtn.textContent = 'Add Quote';

  if (error) { showFormMsg('Failed: ' + error.message, 'err'); return; }

  qText.value   = '';
  qAuthor.value = '';
  showFormMsg('Quote added successfully.', 'ok');
  await loadQuotes();
});

/* ── toggle / delete ── */
qListArea.addEventListener('click', async (e) => {
  const toggleBtn = e.target.closest('.btn-toggle-q');
  if (toggleBtn) {
    const id        = toggleBtn.dataset.id;
    const isActive  = toggleBtn.dataset.active === 'true';
    const newActive = !isActive;
    toggleBtn.disabled    = true;
    toggleBtn.textContent = '…';
    const { error } = await supabase.from('quotes').update({ is_active: newActive }).eq('id', id);
    if (error) { toggleBtn.disabled = false; toggleBtn.textContent = isActive ? 'Deactivate' : 'Activate'; return; }
    const row = allQuotes.find(r => String(r.id) === id);
    if (row) row.is_active = newActive;
    showTodayPreview();
    render();
    return;
  }

  const delBtn = e.target.closest('.btn-del-q');
  if (delBtn) {
    if (!confirm('Delete this quote? This cannot be undone.')) return;
    const id = delBtn.dataset.id;
    delBtn.disabled    = true;
    delBtn.textContent = '…';
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) { delBtn.disabled = false; delBtn.textContent = 'Delete'; return; }
    allQuotes = allQuotes.filter(r => String(r.id) !== id);
    showTodayPreview();
    render();
    return;
  }
});

/* ── filters ── */
function setFilter(mode) {
  viewMode = mode;
  [filterAll, filterActive, filterInactive].forEach(b => b.classList.remove('active-filter'));
  if (mode === 'all')      filterAll.classList.add('active-filter');
  if (mode === 'active')   filterActive.classList.add('active-filter');
  if (mode === 'inactive') filterInactive.classList.add('active-filter');
  render();
}

filterAll.addEventListener('click',      () => setFilter('all'));
filterActive.addEventListener('click',   () => setFilter('active'));
filterInactive.addEventListener('click', () => setFilter('inactive'));

loadQuotes();
