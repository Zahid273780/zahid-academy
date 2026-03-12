import { supabase, initAuthGuard } from './auth-guard.js';
await initAuthGuard();

const addClassInput = document.getElementById('addClass');
const addSubjectInput = document.getElementById('addSubject');
const addFeeInput = document.getElementById('addFee');
const addBtn = document.getElementById('addBtn');
const msgEl = document.getElementById('msg');
const tableBody = document.getElementById('tableBody');
const emptyMsg = document.getElementById('emptyMsg');
const filterClass = document.getElementById('filterClass');
const countLabel = document.getElementById('countLabel');

let allSubjects = [];

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = type || '';
  if (type === 'ok') setTimeout(function () { msgEl.textContent = ''; msgEl.className = ''; }, 3000);
}

async function loadSubjects() {
  showMsg('Loading...', '');
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('class', { ascending: true })
    .order('subject', { ascending: true });

  if (error) { showMsg('Error: ' + error.message, 'err'); return; }
  allSubjects = data || [];
  showMsg('', '');
  buildFilter();
  renderTable();
}

function buildFilter() {
  var current = filterClass.value;
  var classes = [...new Set(allSubjects.map(function (s) { return s.class; }))].sort(function (a, b) { return a - b; });
  filterClass.innerHTML = '<option value="">All Classes</option>' +
    classes.map(function (c) { return '<option value="' + c + '">Class ' + c + '</option>'; }).join('');
  filterClass.value = current;
}

function getFiltered() {
  var cls = filterClass.value;
  if (!cls) return allSubjects;
  return allSubjects.filter(function (s) { return s.class === parseInt(cls); });
}

function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function renderTable() {
  var rows = getFiltered();

  if (rows.length === 0) {
    tableBody.innerHTML = '';
    emptyMsg.classList.remove('hidden');
    countLabel.textContent = '';
    return;
  }

  emptyMsg.classList.add('hidden');
  countLabel.textContent = rows.length + ' subject' + (rows.length !== 1 ? 's' : '');

  tableBody.innerHTML = rows.map(function (s) {
    return '<tr data-id="' + s.id + '">'
      + '<td><span class="class-badge">' + s.class + '</span></td>'
      + '<td>' + escHtml(s.subject) + '</td>'
      + '<td class="fee-col">Rs. ' + s.fee + '</td>'
      + '<td>'
      + '<button class="btn-edit btn-sm" data-edit="' + s.id + '">Edit</button> '
      + '<button class="btn-danger btn-sm" data-del="' + s.id + '">Delete</button>'
      + '</td>'
      + '</tr>';
  }).join('');

  tableBody.querySelectorAll('[data-edit]').forEach(function (btn) {
    btn.addEventListener('click', function () { startEdit(btn.dataset.edit); });
  });

  tableBody.querySelectorAll('[data-del]').forEach(function (btn) {
    btn.addEventListener('click', function () { deleteSubject(btn.dataset.del); });
  });
}

function startEdit(id) {
  var s = allSubjects.find(function (x) { return String(x.id) === String(id); });
  if (!s) return;

  var row = tableBody.querySelector('tr[data-id="' + id + '"]');
  if (!row) return;

  row.innerHTML =
    '<td><input type="number" class="edit-cls" value="' + s.class + '" style="width:60px;padding:0.35rem 0.5rem;font-size:0.85rem;"></td>'
    + '<td><input type="text" class="edit-sub" value="' + escHtml(s.subject) + '" style="padding:0.35rem 0.5rem;font-size:0.85rem;"></td>'
    + '<td><input type="number" class="edit-fee" value="' + s.fee + '" style="width:90px;padding:0.35rem 0.5rem;font-size:0.85rem;"></td>'
    + '<td>'
    + '<button class="btn-edit btn-sm save-btn">Save</button> '
    + '<button class="btn-cancel btn-sm cancel-btn">Cancel</button>'
    + '</td>';

  row.querySelector('.save-btn').addEventListener('click', function () { saveEdit(id, row); });
  row.querySelector('.cancel-btn').addEventListener('click', function () { renderTable(); });
}

async function saveEdit(id, row) {
  var cls = parseInt(row.querySelector('.edit-cls').value);
  var subject = row.querySelector('.edit-sub').value.trim();
  var fee = parseInt(row.querySelector('.edit-fee').value);

  if (!cls || !subject || isNaN(fee)) {
    showMsg('Please fill all fields.', 'err');
    return;
  }

  showMsg('Saving...', '');
  var { error } = await supabase
    .from('subjects')
    .update({ class: cls, subject: subject, fee: fee })
    .eq('id', id);

  if (error) { showMsg('Error: ' + error.message, 'err'); return; }

  var item = allSubjects.find(function (x) { return String(x.id) === String(id); });
  if (item) { item.class = cls; item.subject = subject; item.fee = fee; }

  showMsg('Subject updated.', 'ok');
  buildFilter();
  renderTable();
}

async function deleteSubject(id) {
  var s = allSubjects.find(function (x) { return String(x.id) === String(id); });
  if (!s) return;
  if (!confirm('Delete "' + s.subject + '" (Class ' + s.class + ')?')) return;

  showMsg('Deleting...', '');
  var { error } = await supabase.from('subjects').delete().eq('id', id);
  if (error) { showMsg('Error: ' + error.message, 'err'); return; }

  allSubjects = allSubjects.filter(function (x) { return String(x.id) !== String(id); });
  showMsg('Subject deleted.', 'ok');
  buildFilter();
  renderTable();
}

addBtn.addEventListener('click', async function () {
  var cls = parseInt(addClassInput.value);
  var subject = addSubjectInput.value.trim();
  var fee = parseInt(addFeeInput.value);

  if (!cls || !subject || isNaN(fee)) {
    showMsg('Please fill class, subject and fee.', 'err');
    return;
  }

  var duplicate = allSubjects.find(function (s) {
    return s.class === cls && s.subject.toLowerCase() === subject.toLowerCase();
  });
  if (duplicate) {
    showMsg('This subject already exists for class ' + cls + '.', 'err');
    return;
  }

  showMsg('Adding...', '');
  var { data, error } = await supabase
    .from('subjects')
    .insert([{ class: cls, subject: subject, fee: fee }])
    .select();

  if (error) { showMsg('Error: ' + error.message, 'err'); return; }

  if (data && data.length > 0) {
    allSubjects.push(data[0]);
  }

  showMsg('Subject added!', 'ok');
  addSubjectInput.value = '';
  addFeeInput.value = '';
  buildFilter();
  renderTable();
});

filterClass.addEventListener('change', renderTable);

loadSubjects();
