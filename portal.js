(function () {
  var SUPABASE_URL = 'https://uygtxlehwtgaftcwsxrr.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z3R4bGVod3RnYWZ0Y3dzeHJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDIxMjIsImV4cCI6MjA4ODQ3ODEyMn0.5rW1hnEffnlWU57jT-IA3L0sOHY8aagTmMmpcZw-0mk';

  var token = sessionStorage.getItem('_st');
  if (!token) {
    sessionStorage.removeItem('_st');
    sessionStorage.removeItem('_se');
    window.location.replace('login.html');
    return;
  }

  var loader       = document.getElementById('loader');
  var main         = document.getElementById('main');
  var userEmail    = document.getElementById('userEmail');
  var subBar       = document.getElementById('subBar');
  var subPackage   = document.getElementById('subPackage');
  var subUsed      = document.getElementById('subUsed');
  var subLimit     = document.getElementById('subLimit');
  var subRemaining = document.getElementById('subRemaining');
  var subDays      = document.getElementById('subDays');
  var subMessage   = document.getElementById('subMessage');

  var statsSection  = document.getElementById('statsSection');
  var statAttempted = document.getElementById('statAttempted');
  var statCorrect   = document.getElementById('statCorrect');
  var statAccuracy  = document.getElementById('statAccuracy');
  var statMistakes  = document.getElementById('statMistakes');
  var motivBanner   = document.getElementById('motivBanner');
  var motivText     = document.getElementById('motivText');
  var annSection    = document.getElementById('announcementsSection');
  var annList       = document.getElementById('announcementsList');
  var quoteCard     = document.getElementById('quoteCard');
  var quoteText     = document.getElementById('quoteText');
  var quoteAuthor   = document.getElementById('quoteAuthor');

  function clearAndRedirect() {
    sessionStorage.removeItem('_st');
    sessionStorage.removeItem('_se');
    window.location.replace('login.html');
  }

  function apiPost(endpoint) {
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    });
  }

  /* ── motivational messages cache (loaded from Supabase) ── */
  var motivMsgsByTier = {};

  function getTier(attempted, accuracy) {
    if (attempted === 0) return 'new';
    if (accuracy >= 90)  return 'excellent';
    if (accuracy >= 75)  return 'great';
    if (accuracy >= 50)  return 'good';
    if (accuracy >= 25)  return 'medium';
    return 'low';
  }

  /* day-of-year seed — same index all day, advances each day */
  function daySeed() {
    var now   = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  }

  function pickMotivMessage(attempted, correct, accuracy) {
    var tier = getTier(attempted, accuracy);
    var pool = motivMsgsByTier[tier] || [];

    /* milestone prefix for attempts */
    var milestone = '';
    if (attempted === 0) {
      milestone = '';
    } else if (attempted >= 1000) {
      milestone = 'You have crossed 1,000 questions — that is a serious commitment. ';
    } else if (attempted >= 500) {
      milestone = 'Over 500 questions attempted — you are building real stamina! ';
    } else if (attempted >= 200) {
      milestone = '200+ questions done — you are well on your way! ';
    } else if (attempted >= 100) {
      milestone = attempted + ' questions attempted — a solid start! ';
    } else if (attempted > 0) {
      milestone = attempted + ' questions attempted so far. ';
    }

    if (pool.length === 0) {
      return milestone + (attempted === 0
        ? 'Start your first test today and watch this dashboard come to life!'
        : correct + ' correct out of ' + attempted + ' attempted (' + accuracy + '%). Keep going!');
    }

    /* pick using daily seed so the message changes each day, not each refresh */
    var base = pool[daySeed() % pool.length];
    return attempted > 0 ? milestone + base : base;
  }

  /* ── fetch motivational messages from Supabase ── */
  function fetchMotivMessages() {
    return fetch(
      SUPABASE_URL + '/rest/v1/motivational_messages?is_active=eq.true&select=message,tier',
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + token
        }
      }
    )
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      motivMsgsByTier = {};
      (rows || []).forEach(function (row) {
        if (!motivMsgsByTier[row.tier]) motivMsgsByTier[row.tier] = [];
        motivMsgsByTier[row.tier].push(row.message);
      });
    })
    .catch(function () {});
  }

  /* ── render stats ── */
  function renderStats(practice, mistakeBucketCount) {
    var totalAttempted = 0;
    var totalCorrect   = 0;
    (practice || []).forEach(function (r) {
      totalAttempted += (r.total_marks    != null ? Number(r.total_marks)    : 0);
      totalCorrect   += (r.obtained_marks != null ? Number(r.obtained_marks) : 0);
    });
    var accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    var bucketCount = mistakeBucketCount != null ? Number(mistakeBucketCount) : 0;

    statAttempted.textContent = totalAttempted.toLocaleString();
    statCorrect.textContent   = totalCorrect.toLocaleString();
    statAccuracy.textContent  = accuracy + '%';
    statMistakes.textContent  = bucketCount.toLocaleString();

    statsSection.style.display = 'grid';

    var msg = pickMotivMessage(totalAttempted, totalCorrect, accuracy);
    motivText.textContent = msg;
    motivBanner.style.display = 'flex';
  }

  /* ── render announcements ── */
  function renderAnnouncements(rows) {
    if (!rows || rows.length === 0) return;
    annSection.style.display = 'block';
    var html = '';
    rows.forEach(function (row) {
      var date = row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      html += '<div class="ann-card">'
        + '<div class="ann-head">'
        +   '<span class="ann-title">' + esc(row.title) + '</span>'
        +   (date ? '<span class="ann-date">' + date + '</span>' : '')
        + '</div>'
        + '<p class="ann-msg">' + esc(row.message) + '</p>'
        + '</div>';
    });
    annList.innerHTML = html;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  /* ── fetch & show quote of the day ── */
  function fetchAndShowQuote() {
    fetch(
      SUPABASE_URL + '/rest/v1/quotes?is_active=eq.true&select=quote,author',
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + token
        }
      }
    )
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      if (!rows || rows.length === 0) return;
      /* use day-of-year as seed so the same quote shows all day */
      var now = new Date();
      var start = new Date(now.getFullYear(), 0, 0);
      var dayOfYear = Math.floor((now - start) / 86400000);
      var q = rows[dayOfYear % rows.length];
      if (!q) return;
      quoteText.textContent   = q.quote;
      quoteAuthor.textContent = q.author;
      quoteCard.style.display = 'block';
    })
    .catch(function () {});
  }

  /* ── fetch announcements from Supabase REST ── */
  function fetchAnnouncements() {
    return fetch(
      SUPABASE_URL + '/rest/v1/announcements?is_active=eq.true&order=created_at.desc',
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + token
        }
      }
    ).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }

  /* ── main init ── */
  apiPost('/api/verify-student')
    .then(function (res) {
      if (res.status === 401 || res.status === 403) { clearAndRedirect(); return null; }
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.valid) { clearAndRedirect(); return; }

      if (userEmail) userEmail.textContent = data.email || sessionStorage.getItem('_se') || '';
      if (loader) loader.style.display = 'none';
      if (main)   main.style.display   = 'block';

      /* subscription */
      apiPost('/api/check-subscription')
        .then(function (r) { return r.json(); })
        .then(function (sub) {
          if (!subBar) return;
          subBar.style.display = 'block';
          subBar.classList.add('show');
          var pkg = sub.package_name || (sub.subscriptions && sub.subscriptions.length > 1
            ? 'Multiple plans'
            : (sub.subscriptions && sub.subscriptions[0] ? sub.subscriptions[0].package_name : '—'));
          if (subPackage)   subPackage.textContent   = pkg;
          if (subUsed)      subUsed.textContent      = sub.mcqs_used      != null ? sub.mcqs_used      : '0';
          if (subLimit)     subLimit.textContent     = sub.mcq_limit      != null ? sub.mcq_limit      : '0';
          if (subRemaining) subRemaining.textContent = sub.mcqs_remaining != null ? sub.mcqs_remaining : '0';
          if (subDays)      subDays.textContent      = sub.days_left      != null ? sub.days_left      : '—';
          if (subMessage) {
            subMessage.style.display = sub.message ? 'block' : 'none';
            subMessage.textContent   = sub.message || '';
          }
          subBar.classList.toggle('sub-err', !!sub.message);

          var practiceCard = document.querySelector('.portal-card.practice');
          var givetestCard = document.querySelector('.portal-card.givetest');
          if (!sub.active && practiceCard) {
            practiceCard.style.opacity       = '0.6';
            practiceCard.style.pointerEvents = 'none';
            practiceCard.title               = sub.message || 'Subscription not active';
          }
          if (!sub.active && givetestCard) {
            givetestCard.style.opacity       = '0.6';
            givetestCard.style.pointerEvents = 'none';
            givetestCard.title               = sub.message || 'Subscription not active';
          }
        })
        .catch(function () {
          if (subBar) { subBar.style.display = 'block'; subBar.classList.add('show', 'sub-err'); }
          if (subPackage) subPackage.textContent = '—';
          if (subMessage) { subMessage.style.display = 'block'; subMessage.textContent = 'Could not load subscription.'; }
        });

      /* stats — fetch motiv messages and analytics in parallel */
      Promise.all([
        fetchMotivMessages(),
        apiPost('/api/student-analytics').then(function (r) { return r && r.ok ? r.json() : null; }).catch(function () { return null; })
      ]).then(function (results) {
        var analytics = results[1];
        if (analytics) renderStats(analytics.practice, analytics.mistakeBucketCount);
      });

      /* quote of the day */
      fetchAndShowQuote();

      /* announcements */
      fetchAnnouncements().then(renderAnnouncements);
    })
    .catch(function () { clearAndRedirect(); });

  /* logout */
  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      sessionStorage.removeItem('_st');
      sessionStorage.removeItem('_se');
      window.location.replace('login.html');
    });
  }
})();
