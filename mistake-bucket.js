(function () {
  var activeQuestions = [], userAnswers = [];
  var currentIndex = 0, score = 0, startTime, timerInterval;

  function $(id) { return document.getElementById(id); }

  function logout() {
    sessionStorage.removeItem('_st');
    sessionStorage.removeItem('_se');
    window.location.replace('login.html');
  }

  function apiCall(endpoint, options) {
    var token = sessionStorage.getItem('_st');
    if (!token) { logout(); return Promise.resolve(null); }
    return fetch(endpoint, Object.assign({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    }, options || {})).then(function (res) {
      if (res.status === 401 || res.status === 403) { logout(); return null; }
      return res;
    });
  }

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function mcqVal(r, key) {
    if (!r) return undefined;
    var v = r[key];
    if (v !== undefined && v !== null) return v;
    var lower = key.toLowerCase ? key.toLowerCase() : key;
    v = r[lower];
    if (v !== undefined && v !== null) return v;
    var withUnderscore = (key + '').replace(/\s+/g, '_').toLowerCase();
    return r[withUnderscore];
  }

  function showQuestion() {
    var q = activeQuestions[currentIndex];
    $('quizProgress').innerText = 'Question ' + (currentIndex + 1) + ' of ' + activeQuestions.length;
    $('questionText').innerText = mcqVal(q, 'Question') || '';
    var area = $('optionsArea'); area.innerHTML = '';
    var letters = ['A', 'B', 'C', 'D'];
    var options = [mcqVal(q, 'Option A'), mcqVal(q, 'Option B'), mcqVal(q, 'Option C'), mcqVal(q, 'Option D')].filter(Boolean);
    options.forEach(function (opt, idx) {
      var btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerText = letters[idx] + ')  ' + opt;
      btn.onclick = function () {
        userAnswers.push(letters[idx]);
        if (letters[idx] === mcqVal(q, 'Correct Answer')) score++;
        currentIndex++;
        if (currentIndex < activeQuestions.length) showQuestion(); else showResults();
      };
      area.appendChild(btn);
    });
  }

  function showResults() {
    clearInterval(timerInterval);
    var totalTime = Math.floor((Date.now() - startTime) / 1000);
    $('quizSection').classList.add('hidden');
    $('resultArea').classList.remove('hidden');

    var pct = activeQuestions.length > 0 ? Math.round((score / activeQuestions.length) * 100) : 0;
    $('resScore').innerText = score + '/' + activeQuestions.length + ' (' + pct + '%)';
    var mins = Math.floor(totalTime / 60);
    var secs = totalTime % 60;
    $('resTotalTime').innerText = mins > 0 ? mins + 'm ' + secs + 's' : totalTime + 's';
    $('resAvgTime').innerText = (totalTime / activeQuestions.length).toFixed(1) + 's';

    var correctIds = [];
    activeQuestions.forEach(function (q, idx) {
      if (userAnswers[idx] === mcqVal(q, 'Correct Answer') && q.id) correctIds.push(q.id);
    });
    if (correctIds.length > 0) {
      apiCall('/api/mistake-bucket-remove', { body: JSON.stringify({ mcq_ids: correctIds }) }).then(function () {}).catch(function () {});
    }

    var mistakeList = $('mistakeList');
    mistakeList.innerHTML = '';
    var hasMistakes = false;
    activeQuestions.forEach(function (q, idx) {
      if (userAnswers[idx] !== mcqVal(q, 'Correct Answer')) hasMistakes = true;
    });

    if (!hasMistakes) {
      mistakeList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--success); font-weight:700; font-size:18px;"><i class="fas fa-trophy"></i> Perfect! No mistakes this time.</div>';
      if (correctIds.length > 0) {
        mistakeList.innerHTML += '<p style="text-align:center; margin-top:12px; color:var(--primary); font-weight:600;">' + correctIds.length + ' question' + (correctIds.length !== 1 ? 's' : '') + ' removed from your bucket. Go back to see remaining or add more from tests.</p>';
      }
      $('mistakeBucketArea').style.display = 'none';
    } else {
      mistakeList.innerHTML = '<h3 style="margin-bottom:15px; color:var(--error);"><i class="fas fa-times-circle"></i> Review Mistakes</h3>';
      var wrongIds = [];
      activeQuestions.forEach(function (q, idx) {
        var correctLetter = mcqVal(q, 'Correct Answer');
        if (userAnswers[idx] !== correctLetter) {
          if (q.id) wrongIds.push(q.id);
          var yourLetter = userAnswers[idx];
          var yourAnswer = mcqVal(q, 'Option ' + yourLetter) || 'None';
          var correctAnswer = mcqVal(q, 'Option ' + correctLetter) || '\u2014';
          var div = document.createElement('div'); div.className = 'mistake-item';
          var html = '<b>' + (idx + 1) + '. ' + (mcqVal(q, 'Question') || '') + '</b>';
          html += '<small>Your answer: <span class="your-ans">' + yourLetter + ') ' + yourAnswer + '</span></small><br>';
          html += '<small>Correct: <span class="correct-ans">' + correctLetter + ') ' + correctAnswer + '</span></small>';
          if (mcqVal(q, 'Explanation')) html += '<div class="explanation-box"><i class="fas fa-lightbulb"></i> ' + mcqVal(q, 'Explanation') + '</div>';
          div.innerHTML = html;
          mistakeList.appendChild(div);
        }
      });
      var bucketArea = $('mistakeBucketArea');
      var bucketBtn = $('addToMistakeBucketBtn');
      var bucketMsg = $('mistakeBucketMsg');
      bucketArea.style.display = wrongIds.length > 0 ? 'block' : 'none';
      bucketMsg.textContent = '';
      if (bucketBtn && wrongIds.length > 0) {
        bucketBtn.onclick = function () {
          bucketBtn.disabled = true;
          bucketMsg.textContent = 'Adding...';
          apiCall('/api/mistake-bucket-add', { body: JSON.stringify({ mcq_ids: wrongIds }) }).then(function (res) {
            return res ? res.json() : {};
          }).then(function (data) {
            if (data.error) {
              bucketMsg.textContent = data.error;
              bucketMsg.style.color = 'var(--error)';
              bucketBtn.disabled = false;
            } else {
              bucketMsg.textContent = (data.message || 'Added to Mistake Bucket.') + ' Re-attempt from this page anytime.';
              bucketMsg.style.color = 'var(--success)';
            }
          }).catch(function () {
            bucketMsg.textContent = 'Failed to add. Try again.';
            bucketMsg.style.color = 'var(--error)';
            bucketBtn.disabled = false;
          });
        };
      }
      if (correctIds.length > 0) {
        var rem = document.createElement('p');
        rem.style.cssText = 'text-align:center; margin-top:12px; color:var(--primary); font-weight:600;';
        rem.textContent = correctIds.length + ' correct answer' + (correctIds.length !== 1 ? 's' : '') + ' removed from bucket. Remaining mistakes stay until you get them right.';
        mistakeList.appendChild(rem);
      }
    }
  }

  function startQuiz(mcqs) {
    var list = Array.isArray(mcqs) ? mcqs : [];
    if (list.length === 0) return;
    activeQuestions = shuffleArray(list.slice());
    currentIndex = 0;
    score = 0;
    userAnswers = [];
    startTime = Date.now();
    var startSection = $('startSection');
    var resultArea = $('resultArea');
    var quizSection = $('quizSection');
    if (startSection) startSection.classList.add('hidden');
    if (resultArea) resultArea.classList.add('hidden');
    if (quizSection) {
      quizSection.classList.remove('hidden');
      quizSection.style.display = '';
    }
    timerInterval = setInterval(function () {
      var elapsed = Math.floor((Date.now() - startTime) / 1000);
      var mins = Math.floor(elapsed / 60);
      var secs = elapsed % 60;
      $('quizTimer').innerText = mins + ':' + String(secs).padStart(2, '0');
    }, 1000);
    showQuestion();
  }

  function goBackToStart() {
    $('quizSection').classList.add('hidden');
    $('resultArea').classList.add('hidden');
    $('startSection').classList.remove('hidden');
    loadBucket();
  }

  function loadBucket() {
    apiCall('/api/mistake-bucket').then(function (res) {
      if (!res) return null;
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.error || 'Failed to load bucket'); });
      return res.json();
    }).then(function (data) {
      $('sessionLoader').style.display = 'none';
      $('startSection').classList.remove('hidden');
      if (!data) return;
      var mcqsList = Array.isArray(data.mcqs) ? data.mcqs : [];
      var apiCount = (data.count != null) ? Number(data.count) : mcqsList.length;
      var count = mcqsList.length;
      var hasBucketItems = apiCount > 0 || count > 0;
      if (!hasBucketItems) {
        $('bucketStartCard').classList.add('hidden');
        $('bucketEmptyCard').classList.remove('hidden');
      } else {
        $('bucketEmptyCard').classList.add('hidden');
        $('bucketStartCard').classList.remove('hidden');
        var displayCount = count > 0 ? count : apiCount;
        $('bucketCountText').textContent = displayCount + ' question' + (displayCount !== 1 ? 's' : '') + ' in your bucket';
        if (count > 0) {
          $('startBucketBtn').onclick = function () { startQuiz(mcqsList); };
          $('startBucketBtn').disabled = false;
          $('startBucketBtn').title = '';
        } else {
          $('startBucketBtn').onclick = null;
          $('startBucketBtn').disabled = true;
          $('startBucketBtn').title = 'Some questions could not be loaded. They may have been removed from the question bank.';
        }
      }
    }).catch(function (err) {
      $('sessionLoader').style.display = 'none';
      $('startSection').classList.remove('hidden');
      $('bucketStartCard').classList.add('hidden');
      $('bucketEmptyCard').classList.remove('hidden');
      if (err && err.message) alert(err.message);
    });
  }

  async function init() {
    var token = sessionStorage.getItem('_st');
    if (!token) { logout(); return; }

    var verify = await apiCall('/api/verify-student');
    if (!verify) return;
    var v = await verify.json().catch(function () { return {}; });
    if (!v.valid) { logout(); return; }

    $('userBadge').textContent = v.email || sessionStorage.getItem('_se') || '';
    loadBucket();
  }

  $('logoutBtn').onclick = logout;
  $('goHomeBtn').onclick = goBackToStart;

  init();
})();
