(function () {
  var form = document.getElementById('requestForm');
  var msgEl = document.getElementById('formMsg');
  var btn = document.getElementById('submitBtn');
  var btnText = document.getElementById('btnText');

  if (!form || !msgEl || !btn || !btnText) return;

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

  async function localSignup(payload) {
    try {
      var res = await fetch('/api/student-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var data = await res.json();
      if (!res.ok || data.error) {
        return { ok: false, error: data.error || 'Could not create account' };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'Network error' };
    }
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
      showMsg('Enter username only (e.g. ali123), not @shaheeninstitute.com.', 'err');
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
    btnText.innerHTML = '<span class="spinner-small"></span> Creating account...';

    var payload = {
      name: name,
      username: username,
      class: classVal,
      whatsapp: whatsapp,
      mobile: mobile,
      password: password
    };

    try {
      var local = await localSignup(payload);
      if (local.ok) {
        // Store credentials temporarily so login page can prefill them
        try {
          sessionStorage.setItem('signup_username', username);
          sessionStorage.setItem('signup_password', password);
        } catch (_) {}
        // Redirect to student login page
        window.location.replace('login.html');
      } else {
        var errMsg = local.error || '';
        var lower = errMsg.toLowerCase();
        if (lower.indexOf('already') !== -1 || lower.indexOf('registered') !== -1) {
          showMsg('This username is already registered. Use Student Login or contact your teacher.', 'err');
        } else if (lower.indexOf('rate') !== -1 || lower.indexOf('limit') !== -1 || lower.indexOf('too many') !== -1) {
          showMsg('The server is busy right now. Please wait a minute and try again.', 'err');
        } else {
          showMsg('Could not create account. Please try again or contact your teacher.', 'err');
        }
      }
    } catch (e) {
      showMsg('Network error. Please check your internet and try again.', 'err');
    }

    btn.disabled = false;
    btnText.textContent = 'Create account';
  });
})();
