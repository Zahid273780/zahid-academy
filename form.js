(function () {
  var form = document.getElementById('requestForm');
  var msgEl = document.getElementById('formMsg');
  var btn = document.getElementById('submitBtn');
  var btnText = document.getElementById('btnText');

  function showMsg(text, type) {
    msgEl.textContent = text;
    msgEl.className = 'login-msg ' + type;
  }
  function clearMsg() {
    msgEl.textContent = '';
    msgEl.className = 'login-msg';
  }

  function onlyDigits(s) {
    return (s || '').replace(/\D/g, '');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearMsg();

    var name = document.getElementById('fullName').value.trim();
    var username = document.getElementById('username').value.trim();
    var classVal = document.getElementById('class').value.trim();
    var whatsapp = onlyDigits(document.getElementById('whatsapp').value);
    var mobile = onlyDigits(document.getElementById('mobile').value);
    var password = document.getElementById('password').value;

    if (!name || !username || !classVal || !password) {
      showMsg('Please fill in all required fields.', 'err');
      return;
    }
    if (/[0-9]/.test(name)) {
      showMsg('Full name must contain only letters and spaces, no numbers.', 'err');
      return;
    }
    if (username.indexOf('@') !== -1) {
      showMsg('Enter username only (e.g. ali123), not @zahidacademy.com.', 'err');
      return;
    }
    if (whatsapp.length !== 11) {
      showMsg('WhatsApp number must be exactly 11 digits (e.g. 03337502737).', 'err');
      return;
    }
    if (mobile.length !== 11) {
      showMsg('Mobile number must be exactly 11 digits (e.g. 03337502737).', 'err');
      return;
    }
    if (password.length < 4) {
      showMsg('Password must be at least 4 characters.', 'err');
      return;
    }

    btn.disabled = true;
    btnText.innerHTML = '<span class="spinner-small"></span> Submitting...';

    try {
      var res = await fetch('/api/login-form-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          username: username,
          class: classVal,
          whatsapp: whatsapp,
          mobile: mobile,
          password: password
        })
      });
      var data = await res.json().catch(function () { return {}; });

      if (!res.ok) {
        showMsg(data.error || 'Could not submit. Please try again.', 'err');
        btn.disabled = false;
        btnText.textContent = 'Submit request';
        return;
      }

      showMsg('Request saved. Your teacher will share your login ID.', 'ok');
      form.reset();
      btn.disabled = false;
      btnText.textContent = 'Submit request';
    } catch (err) {
      showMsg('Network error. Please try again.', 'err');
      btn.disabled = false;
      btnText.textContent = 'Submit request';
    }
  });
})();
