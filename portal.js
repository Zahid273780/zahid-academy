(function () {
  var token = sessionStorage.getItem('_st');
  if (!token) {
    sessionStorage.removeItem('_st');
    sessionStorage.removeItem('_se');
    window.location.replace('login.html');
    return;
  }

  var loader = document.getElementById('loader');
  var main = document.getElementById('main');
  var userEmail = document.getElementById('userEmail');
  var subBar = document.getElementById('subBar');
  var subPackage = document.getElementById('subPackage');
  var subUsed = document.getElementById('subUsed');
  var subLimit = document.getElementById('subLimit');
  var subRemaining = document.getElementById('subRemaining');
  var subDays = document.getElementById('subDays');
  var subMessage = document.getElementById('subMessage');

  function clearAndRedirect() {
    sessionStorage.removeItem('_st');
    sessionStorage.removeItem('_se');
    window.location.replace('login.html');
  }

  fetch('/api/verify-student', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }).then(function (res) {
    if (res.status === 401 || res.status === 403) {
      clearAndRedirect();
      return null;
    }
    return res.json();
  }).then(function (data) {
    if (!data || !data.valid) {
      clearAndRedirect();
      return;
    }
    if (userEmail) userEmail.textContent = data.email || sessionStorage.getItem('_se') || '';
    if (loader) loader.style.display = 'none';
    if (main) main.style.display = 'block';

    fetch('/api/check-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    }).then(function (r) { return r.json(); }).then(function (sub) {
      if (!subBar) return;
      subBar.style.display = 'block';
      subBar.classList.add('show');
      var packageLabel = sub.package_name || (sub.subscriptions && sub.subscriptions.length > 1 ? 'Multiple plans' : (sub.subscriptions && sub.subscriptions[0] ? sub.subscriptions[0].package_name : '—'));
      if (subPackage) subPackage.textContent = packageLabel;
      if (subUsed) subUsed.textContent = sub.mcqs_used != null ? sub.mcqs_used : '0';
      if (subLimit) subLimit.textContent = sub.mcq_limit != null ? sub.mcq_limit : '0';
      if (subRemaining) subRemaining.textContent = sub.mcqs_remaining != null ? sub.mcqs_remaining : '0';
      if (subDays) subDays.textContent = sub.days_left != null ? sub.days_left : '—';

      if (subMessage) {
        subMessage.style.display = sub.message ? 'block' : 'none';
        subMessage.textContent = sub.message || '';
      }
      if (sub.message) {
        subBar.classList.add('sub-err');
      } else {
        subBar.classList.remove('sub-err');
      }

      var practiceCard = document.querySelector('.portal-card.practice');
      var givetestCard = document.querySelector('.portal-card.givetest');
      if (!sub.active && practiceCard) {
        practiceCard.style.opacity = '0.6';
        practiceCard.style.pointerEvents = 'none';
        practiceCard.title = sub.message || 'Subscription not active';
      }
      if (!sub.active && givetestCard) {
        givetestCard.style.opacity = '0.6';
        givetestCard.style.pointerEvents = 'none';
        givetestCard.title = sub.message || 'Subscription not active';
      }
    }).catch(function () {
      if (subBar) {
        subBar.style.display = 'block';
        subBar.classList.add('show');
      }
      if (subPackage) subPackage.textContent = '—';
      if (subMessage) {
        subMessage.style.display = 'block';
        subMessage.textContent = 'Could not load subscription. Try again or contact support.';
      }
      if (subBar) subBar.classList.add('sub-err');
    });
  }).catch(function () {
    clearAndRedirect();
  });

  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      sessionStorage.removeItem('_st');
      sessionStorage.removeItem('_se');
      window.location.replace('login.html');
    });
  }
})();
