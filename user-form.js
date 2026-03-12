import { initAuthGuard } from './auth-guard.js';
await initAuthGuard();

var entries = JSON.parse(localStorage.getItem('userFormEntries') || '[]');

var fRoll = document.getElementById('fRoll');
var fName = document.getElementById('fName');
var fEmail = document.getElementById('fEmail');
var fPassword = document.getElementById('fPassword');
var fRole = document.getElementById('fRole');
var tbody = document.getElementById('tbody');
var emptyMsg = document.getElementById('emptyMsg');
var countLabel = document.getElementById('countLabel');
var exportBtn = document.getElementById('exportBtn');
var clearBtn = document.getElementById('clearBtn');
var msgEl = document.getElementById('msg');

function save() {
  localStorage.setItem('userFormEntries', JSON.stringify(entries));
}

function render() {
  if (entries.length === 0) {
    tbody.innerHTML = '';
    emptyMsg.style.display = '';
    exportBtn.disabled = true;
    clearBtn.disabled = true;
    countLabel.textContent = '0 entries';
    return;
  }
  emptyMsg.style.display = 'none';
  exportBtn.disabled = false;
  clearBtn.disabled = false;
  countLabel.textContent = entries.length + ' entr' + (entries.length === 1 ? 'y' : 'ies');

  tbody.innerHTML = entries.map(function (e, i) {
    return '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td>' + (e.roll || '—') + '</td>'
      + '<td>' + esc(e.name) + '</td>'
      + '<td>' + esc(e.email) + '</td>'
      + '<td><code>' + esc(e.password) + '</code></td>'
      + '<td><span class="role-badge role-' + e.role + '">' + e.role + '</span></td>'
      + '<td><button class="btn-remove" data-idx="' + i + '" title="Remove">&times;</button></td>'
      + '</tr>';
  }).join('');

  tbody.querySelectorAll('.btn-remove').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var idx = parseInt(btn.dataset.idx, 10);
      entries.splice(idx, 1);
      save();
      render();
    });
  });
}

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = 'msg ' + type;
  setTimeout(function () { msgEl.textContent = ''; msgEl.className = ''; }, 3000);
}

function generatePassword() {
  var pw = '';
  for (var i = 0; i < 6; i++) pw += Math.floor(Math.random() * 10);
  return pw;
}

function nameToEmail(name) {
  return name.toLowerCase().replace(/\s+/g, '') + '@zahidacademy.com';
}

var emailManuallyEdited = false;

fName.addEventListener('input', function () {
  var name = fName.value.trim();
  if (name && !emailManuallyEdited) {
    fEmail.value = nameToEmail(name);
  }
  if (!name) {
    fEmail.value = '';
    emailManuallyEdited = false;
  }
  if (!fPassword.value) {
    fPassword.value = generatePassword();
  }
});

fEmail.addEventListener('input', function () {
  emailManuallyEdited = true;
});

document.getElementById('genPwdBtn').addEventListener('click', function () {
  fPassword.value = generatePassword();
});

document.getElementById('addBtn').addEventListener('click', function () {
  var name = fName.value.trim();
  var email = fEmail.value.trim();
  var password = fPassword.value.trim();
  var role = fRole.value;
  var roll = fRoll.value.trim() ? parseInt(fRoll.value, 10) : null;

  if (!name) { showMsg('Name is required.', 'err'); fName.focus(); return; }
  if (!email) { showMsg('Email is required.', 'err'); fEmail.focus(); return; }
  if (!password) { showMsg('Password is required.', 'err'); fPassword.focus(); return; }

  var dup = entries.find(function (e) { return e.email.toLowerCase() === email.toLowerCase(); });
  if (dup) { showMsg('Email "' + email + '" already exists in the list.', 'err'); return; }

  entries.push({ roll: roll, name: name, email: email, password: password, role: role });
  save();
  render();

  fRoll.value = roll ? roll + 1 : '';
  fName.value = '';
  fEmail.value = '';
  fPassword.value = '';
  emailManuallyEdited = false;
  fName.focus();
  showMsg('Added ' + name + ' (' + email + ')', 'ok');
});

fPassword.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addBtn').click(); }
});
fRole.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addBtn').click(); }
});

exportBtn.addEventListener('click', function () {
  if (entries.length === 0) return;

  var lines = ['roll,name,email,password,role'];
  entries.forEach(function (e) {
    lines.push(
      (e.roll || '') + ','
      + csvField(e.name) + ','
      + csvField(e.email) + ','
      + csvField(e.password) + ','
      + e.role
    );
  });

  var csv = lines.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var now = new Date();
  var ts = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  a.download = 'users_' + ts + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showMsg('CSV exported with ' + entries.length + ' entries.', 'ok');
});

clearBtn.addEventListener('click', function () {
  if (!confirm('Clear all ' + entries.length + ' entries? This cannot be undone.')) return;
  entries = [];
  save();
  render();
});

function csvField(val) {
  if (/[,"\r\n]/.test(val)) return '"' + val.replace(/"/g, '""') + '"';
  return val;
}

render();
