import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

const annTitle   = document.getElementById('annTitle');
const annMessage = document.getElementById('annMessage');
const annPostBtn = document.getElementById('annPostBtn');
const annFormMsg = document.getElementById('annFormMsg');
const annListArea = document.getElementById('annListArea');
const annCount   = document.getElementById('annCount');
const filterAll      = document.getElementById('filterAll');
const filterActive   = document.getElementById('filterActive');
const filterInactive = document.getElementById('filterInactive');

let allAnn   = [];
let viewMode = 'all';

/* ── helpers ── */
function showFormMsg(text, type) {
  annFormMsg.textContent    = text;
  annFormMsg.style.display  = text ? 'block' : 'none';
  annFormMsg.style.background = type === 'err' ? '#fef2f2' : '#dcfce7';
  annFormMsg.style.color      = type === 'err' ? '#b91c1c' : '#16a34a';
  annFormMsg.style.border     = type === 'err' ? '1px solid #fecaca' : '1px solid #bbf7d0';
  if (type === 'ok') setTimeout(() => { annFormMsg.style.display = 'none'; }, 3000);
}

function h(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── load ── */
async function loadAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { annListArea.innerHTML = '<div class="empty-ann">Error loading: ' + h(error.message) + '</div>'; return; }
  allAnn = data || [];
  render();
}

/* ── render ── */
function render() {
  let list = allAnn;
  if (viewMode === 'active')   list = list.filter(r => r.is_active);
  if (viewMode === 'inactive') list = list.filter(r => !r.is_active);

  annCount.textContent = list.length + ' announcement' + (list.length !== 1 ? 's' : '');

  if (!list.length) {
    annListArea.innerHTML = '<div class="empty-ann">No announcements found.</div>';
    return;
  }

  annListArea.innerHTML = list.map(row => {
    const badge = row.is_active
      ? '<span class="badge-active">Active</span>'
      : '<span class="badge-inactive">Inactive</span>';
    const toggleLabel = row.is_active ? 'Deactivate' : 'Activate';
    const toggleClass = row.is_active ? 'active' : 'inactive';
    return (
      '<div class="ann-row" data-id="' + h(String(row.id)) + '">'
      + '<div class="ann-row-head">'
      +   '<div style="flex:1;">'
      +     '<div class="ann-row-title">' + h(row.title) + '</div>'
      +     '<div class="ann-row-meta">' + formatDate(row.created_at) + '</div>'
      +   '</div>'
      +   '<div class="ann-row-actions">'
      +     badge
      +     '<button class="btn-toggle-ann ' + toggleClass + '" data-id="' + h(String(row.id)) + '" data-active="' + row.is_active + '">' + toggleLabel + '</button>'
      +     '<button class="btn-del-ann" data-id="' + h(String(row.id)) + '">Delete</button>'
      +   '</div>'
      + '</div>'
      + '<p class="ann-row-msg">' + h(row.message) + '</p>'
      + '</div>'
    );
  }).join('');
}

/* ── post ── */
annPostBtn.addEventListener('click', async () => {
  const title   = annTitle.value.trim();
  const message = annMessage.value.trim();
  if (!title)   { showFormMsg('Title is required.', 'err'); return; }
  if (!message) { showFormMsg('Message is required.', 'err'); return; }

  annPostBtn.disabled    = true;
  annPostBtn.textContent = 'Publishing…';

  const { error } = await supabase.from('announcements').insert({ title, message, is_active: true });

  annPostBtn.disabled    = false;
  annPostBtn.textContent = 'Publish Announcement';

  if (error) { showFormMsg('Failed: ' + error.message, 'err'); return; }

  annTitle.value   = '';
  annMessage.value = '';
  showFormMsg('Announcement published successfully.', 'ok');
  await loadAnnouncements();
});

/* ── toggle / delete (event delegation) ── */
annListArea.addEventListener('click', async (e) => {
  const toggleBtn = e.target.closest('.btn-toggle-ann');
  if (toggleBtn) {
    const id        = toggleBtn.dataset.id;
    const isActive  = toggleBtn.dataset.active === 'true';
    const newActive = !isActive;
    toggleBtn.disabled    = true;
    toggleBtn.textContent = '…';
    const { error } = await supabase.from('announcements').update({ is_active: newActive }).eq('id', id);
    if (error) { toggleBtn.disabled = false; toggleBtn.textContent = isActive ? 'Deactivate' : 'Activate'; return; }
    const row = allAnn.find(r => String(r.id) === id);
    if (row) row.is_active = newActive;
    render();
    return;
  }

  const delBtn = e.target.closest('.btn-del-ann');
  if (delBtn) {
    if (!confirm('Delete this announcement? This cannot be undone.')) return;
    const id = delBtn.dataset.id;
    delBtn.disabled    = true;
    delBtn.textContent = '…';
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) { delBtn.disabled = false; delBtn.textContent = 'Delete'; return; }
    allAnn = allAnn.filter(r => String(r.id) !== id);
    render();
    return;
  }
});

/* ── filter tabs ── */
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

loadAnnouncements();
