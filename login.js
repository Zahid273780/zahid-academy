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
    var userInput = document.getElementById('email');
    var passInput = document.getElementById('password');

    var SUPABASE_URL = 'https://uygtxlehwtgaftcwsxrr.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z3R4bGVod3RnYWZ0Y3dzeHJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDIxMjIsImV4cCI6MjA4ODQ3ODEyMn0.5rW1hnEffnlWU57jT-IA3L0sOHY8aagTmMmpcZw-0mk';

    function showMsg(text, type) {
        msgEl.textContent = text;
        msgEl.className = 'login-msg ' + type;
    }
    function hideMsg() {
        msgEl.textContent = '';
        msgEl.className = 'login-msg';
    }

    // Prefill from recent signup, if present
    try {
        var savedUser = sessionStorage.getItem('signup_username');
        var savedPass = sessionStorage.getItem('signup_password');
        if (savedUser && savedPass) {
            userInput.value = savedUser;
            passInput.value = savedPass;
            showMsg('Account created successfully. Please sign in.', 'ok');
            sessionStorage.removeItem('signup_username');
            sessionStorage.removeItem('signup_password');
        }
    } catch (_) {}

    async function studentLogin(email, password) {
        var res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ email: email, password: password })
        });
        var data = await res.json();
        if (!res.ok) {
            return { ok: false, error: data.error_description || data.msg || 'Invalid credentials' };
        }
        
        var profileRes = await fetch(SUPABASE_URL + '/rest/v1/users?id=eq.' + data.user.id + '&select=role', {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + data.access_token
            }
        });
        var profileData = await profileRes.json();
        var role = (profileData && profileData[0] && profileData[0].role) ? profileData[0].role.toLowerCase() : '';
        
        if (role !== 'student') {
            return { ok: false, error: 'Staff must login via Admin Portal.' };
        }
        
        return { ok: true, session: data };
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

        var email = username.includes('@') ? username : username + '@shaheeninstitute.com';

        loginBtn.disabled = true;
        btnText.innerHTML = '<span class="spinner-small"></span> Signing in...';

        try {
            var result = await studentLogin(email, password);

            if (!result.ok) {
                showMsg(result.error || 'Login failed', 'err');
                loginBtn.disabled = false;
                btnText.innerHTML = 'Sign In';
                return;
            }

            sessionStorage.setItem('_st', result.session.access_token);
            sessionStorage.setItem('_se', email);

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