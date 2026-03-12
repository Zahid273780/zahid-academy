(function () {
    var token = sessionStorage.getItem('_st');
    if (token) {
        window.location.replace('portal.html');
        return;
    }

    var form = document.getElementById('loginForm');
    var loginBtn = document.getElementById('loginBtn');
    var btnText = document.getElementById('btnText');
    var msgEl = document.getElementById('loginMsg');

    function showMsg(text, type) {
        msgEl.textContent = text;
        msgEl.className = 'login-msg ' + type;
    }
    function hideMsg() {
        msgEl.textContent = '';
        msgEl.className = 'login-msg';
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        hideMsg();

        var username = document.getElementById('email').value.trim();
        var password = document.getElementById('password').value;

        if (!username || !password) {
            showMsg('Please enter both username and password.', 'err');
            return;
        }

        var email = username.includes('@') ? username : username + '@zahidacademy.com';

        loginBtn.disabled = true;
        btnText.innerHTML = '<span class="spinner-small"></span> Signing in...';

        try {
            var res = await fetch('/api/student-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
            });

            var data = await res.json().catch(function () { return {}; });

            if (!res.ok) {
                showMsg(data.error || 'Login failed', 'err');
                loginBtn.disabled = false;
                btnText.innerHTML = 'Sign In';
                return;
            }

            sessionStorage.setItem('_st', data.token);
            sessionStorage.setItem('_se', data.email);

            showMsg('Login successful! Redirecting...', 'ok');
            btnText.innerHTML = '<span class="spinner-small"></span> Redirecting...';

            setTimeout(function () {
                window.location.replace('portal.html');
            }, 500);
        } catch (err) {
            showMsg('Network error. Please try again.', 'err');
            loginBtn.disabled = false;
            btnText.innerHTML = 'Sign In';
        }
    });
})();
