import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

const mmTier      = document.getElementById('mmTier');
const mmText      = document.getElementById('mmText');
const mmAddBtn    = document.getElementById('mmAddBtn');
const mmFormMsg   = document.getElementById('mmFormMsg');
const mmListArea  = document.getElementById('mmListArea');
const mmCount     = document.getElementById('mmCount');
const filterAll      = document.getElementById('filterAll');
const filterActive   = document.getElementById('filterActive');
const filterInactive = document.getElementById('filterInactive');
const filterTier     = document.getElementById('filterTier');

let allMsgs  = [];
let viewMode = 'all';

const TIER_ORDER = ['new', 'low', 'medium', 'good', 'great', 'excellent'];

/* ── helpers ── */
function showFormMsg(text, type) {
  mmFormMsg.textContent   = text;
  mmFormMsg.style.display = text ? 'block' : 'none';
  mmFormMsg.style.background = type === 'err' ? '#fef2f2' : '#dcfce7';
  mmFormMsg.style.color      = type === 'err' ? '#b91c1c' : '#16a34a';
  mmFormMsg.style.border     = type === 'err' ? '1px solid #fecaca' : '1px solid #bbf7d0';
  if (type === 'ok') setTimeout(() => { mmFormMsg.style.display = 'none'; }, 3000);
}

function h(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

/* ── load ── */
async function loadMessages() {
  const { data, error } = await supabase
    .from('motivational_messages')
    .select('*')
    .order('tier')
    .order('created_at', { ascending: false });

  if (error) {
    mmListArea.innerHTML = '<div class="empty-mm">Error loading: ' + h(error.message) + '</div>';
    return;
  }
  allMsgs = data || [];
  render();
}

/* ── render ── */
function render() {
  let list = allMsgs;
  if (viewMode === 'active')   list = list.filter(r => r.is_active);
  if (viewMode === 'inactive') list = list.filter(r => !r.is_active);

  const tierFilter = filterTier.value;
  if (tierFilter) list = list.filter(r => r.tier === tierFilter);

  /* sort by tier order */
  list = [...list].sort((a, b) => {
    const ai = TIER_ORDER.indexOf(a.tier);
    const bi = TIER_ORDER.indexOf(b.tier);
    return ai !== bi ? ai - bi : new Date(b.created_at) - new Date(a.created_at);
  });

  mmCount.textContent = list.length + ' message' + (list.length !== 1 ? 's' : '');

  if (!list.length) {
    mmListArea.innerHTML = '<div class="empty-mm">No messages found.</div>';
    return;
  }

  mmListArea.innerHTML = list.map(row => {
    const tierClass   = 'tier-' + h(row.tier);
    const tierBadge   = '<span class="tier-badge ' + tierClass + '">' + h(row.tier) + '</span>';
    const statusBadge = row.is_active
      ? '<span class="badge-active">Active</span>'
      : '<span class="badge-inactive">Inactive</span>';
    const toggleLabel = row.is_active ? 'Deactivate' : 'Activate';
    const toggleClass = row.is_active ? 'active' : 'inactive';

    return (
      '<div class="mm-row" data-id="' + h(String(row.id)) + '">'
      + '<div class="mm-row-head">'
      +   '<div class="mm-row-tier">' + tierBadge + '</div>'
      +   '<div class="mm-row-actions">'
      +     statusBadge
      +     '<button class="btn-toggle-mm ' + toggleClass + '" data-id="' + h(String(row.id)) + '" data-active="' + row.is_active + '">' + toggleLabel + '</button>'
      +     '<button class="btn-del-mm" data-id="' + h(String(row.id)) + '">Delete</button>'
      +   '</div>'
      + '</div>'
      + '<p class="mm-row-msg">' + h(row.message) + '</p>'
      + '</div>'
    );
  }).join('');
}

/* ── add ── */
mmAddBtn.addEventListener('click', async () => {
  const tier    = mmTier.value.trim();
  const message = mmText.value.trim();
  if (!tier)    { showFormMsg('Please select a tier.', 'err'); return; }
  if (!message) { showFormMsg('Message cannot be empty.', 'err'); return; }

  mmAddBtn.disabled    = true;
  mmAddBtn.textContent = 'Adding…';

  const { error } = await supabase
    .from('motivational_messages')
    .insert({ tier, message, is_active: true });

  mmAddBtn.disabled    = false;
  mmAddBtn.textContent = 'Add Message';

  if (error) { showFormMsg('Failed: ' + error.message, 'err'); return; }

  mmTier.value = '';
  mmText.value = '';
  showFormMsg('Message added successfully.', 'ok');
  await loadMessages();
});

/* ── toggle / delete (event delegation) ── */
mmListArea.addEventListener('click', async (e) => {
  const toggleBtn = e.target.closest('.btn-toggle-mm');
  if (toggleBtn) {
    const id        = toggleBtn.dataset.id;
    const isActive  = toggleBtn.dataset.active === 'true';
    const newActive = !isActive;
    toggleBtn.disabled    = true;
    toggleBtn.textContent = '…';
    const { error } = await supabase
      .from('motivational_messages')
      .update({ is_active: newActive })
      .eq('id', id);
    if (error) {
      toggleBtn.disabled    = false;
      toggleBtn.textContent = isActive ? 'Deactivate' : 'Activate';
      return;
    }
    const row = allMsgs.find(r => String(r.id) === id);
    if (row) row.is_active = newActive;
    render();
    return;
  }

  const delBtn = e.target.closest('.btn-del-mm');
  if (delBtn) {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    const id = delBtn.dataset.id;
    delBtn.disabled    = true;
    delBtn.textContent = '…';
    const { error } = await supabase
      .from('motivational_messages')
      .delete()
      .eq('id', id);
    if (error) { delBtn.disabled = false; delBtn.textContent = 'Delete'; return; }
    allMsgs = allMsgs.filter(r => String(r.id) !== id);
    render();
    return;
  }
});

/* ── filters ── */
function setViewMode(mode) {
  viewMode = mode;
  [filterAll, filterActive, filterInactive].forEach(b => b.classList.remove('active-filter'));
  if (mode === 'all')      filterAll.classList.add('active-filter');
  if (mode === 'active')   filterActive.classList.add('active-filter');
  if (mode === 'inactive') filterInactive.classList.add('active-filter');
  render();
}

filterAll.addEventListener('click',      () => setViewMode('all'));
filterActive.addEventListener('click',   () => setViewMode('active'));
filterInactive.addEventListener('click', () => setViewMode('inactive'));
filterTier.addEventListener('change',    () => render());

loadMessages();
