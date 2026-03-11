(function () {
    var allMcqs = [], currentPath = [], activeQuestions = [], userAnswers = [];
    var currentIndex = 0, score = 0, startTime, timerInterval;
    var questionStartTime = null, attemptRecords = [];
    var currentTestMeta = {};

    var $ = function (id) { return document.getElementById(id); };

    function logout() {
        sessionStorage.removeItem('_st');
        sessionStorage.removeItem('_se');
        window.location.replace('login.html');
    }

    async function apiCall(endpoint, options) {
        var token = sessionStorage.getItem('_st');
        if (!token) { logout(); return null; }

        var res = await fetch(endpoint, Object.assign({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        }, options || {}));

        if (res.status === 401 || res.status === 403) {
            var body = {};
            try { body = await res.clone().json(); } catch (e) {}
            var quotaMsg = body.error && /mcq|quota|subscription|remaining|exhausted|deactivated|expired/i.test(String(body.error));
            if (res.status === 403 && quotaMsg) {
                return res;
            }
            logout();
            return null;
        }
        return res;
    }

    async function init() {
        var token = sessionStorage.getItem('_st');
        if (!token) { logout(); return; }

        try {
            var pendingRaw = sessionStorage.getItem('pendingTestSubmit');
            if (pendingRaw) {
                try {
                    var pendingPayload = JSON.parse(pendingRaw);
                    sessionStorage.removeItem('pendingTestSubmit');
                    if (pendingPayload && pendingPayload.totalMarks != null) {
                        delete pendingPayload.authToken;
                        fetch((window.location.origin || '') + '/api/submit-test', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                            body: JSON.stringify(pendingPayload)
                        }).catch(function () {});
                    }
                } catch (e) {}
            }

            var res = await apiCall('/api/verify-student');
            if (!res) return;
            var data = await res.json();
            if (!data.valid) { logout(); return; }

            $('userBadge').textContent = data.email || sessionStorage.getItem('_se') || '';
            $('sessionLoader').style.display = 'none';
            $('mainSection').classList.remove('hidden');

            var subRes = await apiCall('/api/check-subscription');
            if (subRes) {
                var sub = await subRes.json();
                if (!sub.active) {
                    $('mainSection').innerHTML = '<div class="empty-state grid-full"><i class="fas fa-exclamation-triangle"></i><h3>Subscription required</h3><p>' + (sub.message || 'You cannot take tests right now. Contact your administrator.') + '</p><a href="portal.html">Back to Portal</a></div>';
                    return;
                }
            }
            await loadMcqs();
        } catch (e) {
            logout();
        }
    }

    async function loadMcqs() {
        var res = await apiCall('/api/student-hidden-mcqs');
        if (!res) return;
        var data = await res.json();
        if (data.error) { alert('Error loading data'); return; }
        allMcqs = data.mcqs || [];

        if (allMcqs.length === 0) {
            $('navigationArea').innerHTML =
                '<div class="empty-state grid-full">' +
                '<i class="fas fa-clipboard-check"></i>' +
                '<h3>No Tests Available</h3>' +
                '<p>Your teacher has not assigned any tests yet. Check back later.</p>' +
                '</div>';
            return;
        }

        renderCourses();
    }

    function distinct(arr, key) {
        var seen = new Set();
        return arr.reduce(function (out, x) {
            var v = key(x);
            if (v == null || v === '' || seen.has(v)) return out;
            seen.add(v);
            out.push(v);
            return out;
        }, []).sort(function (a, b) { return String(a).localeCompare(String(b)); });
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

    function renderCourses() {
        resetUI(); currentPath = [];
        $('breadcrumb').innerHTML = '<i class="fas fa-home"></i> Select Course';
        var courses = distinct(allMcqs, function (r) { return mcqVal(r, 'Course'); });
        displayGrid(courses, function (val) { currentPath = [val]; renderClasses(val); });
    }

    function renderClasses(course) {
        $('breadcrumb').innerText = 'Home > ' + course;
        var subset = allMcqs.filter(function (r) { return mcqVal(r, 'Course') === course; });
        var classes = distinct(subset, function (r) { return mcqVal(r, 'Class/Exam'); });
        displayGrid(classes, function (val) { currentPath = [course, val]; renderSubjects(val); });
    }

    function renderSubjects(classExam) {
        $('breadcrumb').innerText = 'Home > ' + currentPath[0] + ' > ' + classExam;
        var subset = allMcqs.filter(function (r) { return mcqVal(r, 'Course') === currentPath[0] && mcqVal(r, 'Class/Exam') === classExam; });
        var subjects = distinct(subset, function (r) { return mcqVal(r, 'Subject'); });
        displayGrid(subjects, function (val) { currentPath = [currentPath[0], classExam, val]; renderUnits(val); });
    }

    function renderUnits(subject) {
        $('breadcrumb').innerText = 'Home > ' + currentPath[0] + ' > ' + currentPath[1] + ' > ' + subject;
        var subset = allMcqs.filter(function (r) { return mcqVal(r, 'Course') === currentPath[0] && mcqVal(r, 'Class/Exam') === currentPath[1] && mcqVal(r, 'Subject') === subject; });
        var units = distinct(subset, function (r) { return mcqVal(r, 'Unit'); });
        displayGrid(units, function (val) { currentPath = currentPath.slice(0, 3).concat([val]); renderCategories(val); });
    }

    function renderCategories(unit) {
        $('breadcrumb').innerText = 'Home > ' + currentPath[0] + ' > ' + currentPath[1] + ' > ' + currentPath[2] + ' > ' + unit;
        var subset = allMcqs.filter(function (r) { return mcqVal(r, 'Course') === currentPath[0] && mcqVal(r, 'Class/Exam') === currentPath[1] && mcqVal(r, 'Subject') === currentPath[2] && mcqVal(r, 'Unit') === unit; });
        var categories = distinct(subset, function (r) { return mcqVal(r, 'Category'); });
        if (categories.length === 0) { renderTests(unit, null); return; }
        displayGrid(categories, function (val) { currentPath = currentPath.slice(0, 4).concat([val]); renderTests(unit, val); });
    }

    function renderTests(unit, category) {
        var crumb = 'Home > ' + currentPath[0] + ' > ' + currentPath[1] + ' > ' + currentPath[2] + ' > ' + unit + (category ? ' > ' + category : '');
        $('breadcrumb').innerText = crumb;

        var subset = allMcqs.filter(function (r) {
            return mcqVal(r, 'Course') === currentPath[0] && mcqVal(r, 'Class/Exam') === currentPath[1] && mcqVal(r, 'Subject') === currentPath[2] && mcqVal(r, 'Unit') === unit;
        });
        if (category) subset = subset.filter(function (r) { return mcqVal(r, 'Category') === category; });

        var testNums = distinct(subset, function (r) { return mcqVal(r, 'Test Number'); }).sort(function (a, b) { return Number(a) - Number(b); });
        var area = $('navigationArea'); area.innerHTML = '';

        testNums.forEach(function (num) {
            var qs = subset.filter(function (r) { return mcqVal(r, 'Test Number') === num; });
            var btn = document.createElement('button'); btn.className = 'nav-btn';
            btn.innerHTML = '<span class="btn-cat">Test #' + num + '</span><span class="btn-range">' + qs.length + ' Questions</span>';
            btn.onclick = function () { showTestInfo(unit, category, num, qs); };
            area.appendChild(btn);
        });
    }

    function showTestInfo(unit, category, testNum, questions) {
        $('mainSection').classList.add('hidden');
        $('testInfoSection').classList.remove('hidden');
        var quotaErr = document.getElementById('quotaErrorMsg');
        if (quotaErr) quotaErr.classList.remove('show');
        $('infoCourse').innerText = currentPath[0];
        $('infoClass').innerText = currentPath[1];
        $('infoSub').innerText = currentPath[2];
        $('infoUnit').innerText = unit;
        $('infoCat').innerText = category || '\u2014';
        $('infoTestNo').innerText = testNum;
        $('infoCount').innerText = questions.length;

        currentTestMeta = {
            course: currentPath[0],
            classExam: currentPath[1],
            subject: currentPath[2],
            unit: unit,
            category: category || null,
            testNumber: testNum
        };

        $('startTestBtn').onclick = async function () {
            var res = await apiCall('/api/reserve-mcqs', {
                body: JSON.stringify({
                    mcqCount: questions.length,
                    course: currentTestMeta.course,
                    classExam: currentTestMeta.classExam,
                    subject: currentTestMeta.subject,
                    unit: unit,
                    category: category || null,
                    testNumber: testNum,
                    testType: 'Mock Test'
                })
            });
            if (!res) return;
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || data.error) {
                var msgEl = document.getElementById('quotaErrorMsg');
                var textEl = document.getElementById('quotaErrorText');
                if (msgEl && textEl) {
                    textEl.textContent = 'Not enough MCQs! Upgrade to unlock all questions.';
                    msgEl.classList.add('show');
                    msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
            document.getElementById('quotaErrorMsg').classList.remove('show');
            $('testInfoSection').classList.add('hidden');
            startQuiz(questions);
        };
    }

    var hasSubmitted = false;

    function startQuiz(questions) {
        activeQuestions = shuffleArray(questions.slice());
        currentIndex = 0; score = 0; userAnswers = [];
        attemptRecords = []; questionStartTime = null;
        startTime = Date.now();
        hasSubmitted = false;
        $('quizSection').classList.remove('hidden');

        timerInterval = setInterval(function () {
            var elapsed = Math.floor((Date.now() - startTime) / 1000);
            var mins = Math.floor(elapsed / 60);
            var secs = elapsed % 60;
            $('quizTimer').innerText = mins + ':' + String(secs).padStart(2, '0');
        }, 1000);

        showQuestion();
    }

    function showQuestion() {
        questionStartTime = Date.now();
        var q = activeQuestions[currentIndex];
        $('quizProgress').innerText = 'Question ' + (currentIndex + 1) + ' of ' + activeQuestions.length;
        $('questionText').innerText = mcqVal(q, 'Question') || '';
        var area = $('optionsArea'); area.innerHTML = '';

        var optionPairs = [
            { letter: 'A', text: mcqVal(q, 'Option A') },
            { letter: 'B', text: mcqVal(q, 'Option B') },
            { letter: 'C', text: mcqVal(q, 'Option C') },
            { letter: 'D', text: mcqVal(q, 'Option D') }
        ].filter(function (p) { return p.text; });
        optionPairs = shuffleArray(optionPairs.slice());

        optionPairs.forEach(function (p) {
            var btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = p.letter + ')  ' + p.text;
            btn.onclick = function () {
                var timeTakenSec = Math.max(0, Math.round((Date.now() - questionStartTime) / 1000));
                var correctAns = mcqVal(q, 'Correct Answer');
                if (q.id) {
                    attemptRecords.push({ mcq_id: q.id, selected_option: p.letter, is_correct: p.letter === correctAns, time_taken_sec: timeTakenSec });
                }
                userAnswers.push(p.letter);
                if (p.letter === correctAns) score++;
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

        hasSubmitted = true;

        apiCall('/api/submit-test', {
            body: JSON.stringify({
                course: currentTestMeta.course,
                classExam: currentTestMeta.classExam,
                subject: currentTestMeta.subject,
                unit: currentTestMeta.unit,
                category: currentTestMeta.category,
                testNumber: currentTestMeta.testNumber,
                totalMarks: activeQuestions.length,
                obtainedMarks: score,
                totalTimeSeconds: totalTime,
                testType: 'Mock Test'
            })
        }).catch(function () {});

        if (attemptRecords.length > 0 && currentTestMeta) {
            apiCall('/api/save-attempts', {
                body: JSON.stringify({
                    attempts: attemptRecords,
                    testContext: {
                        course: currentTestMeta.course,
                        classExam: currentTestMeta.classExam,
                        subject: currentTestMeta.subject,
                        unit: currentTestMeta.unit,
                        category: currentTestMeta.category,
                        testNumber: currentTestMeta.testNumber,
                        testType: 'Mock Test'
                    }
                })
            }).catch(function () {});
        }

        var mistakeList = $('mistakeList');
        mistakeList.innerHTML = '';

        var hasMistakes = false;
        activeQuestions.forEach(function (q, idx) {
            if (userAnswers[idx] !== mcqVal(q, 'Correct Answer')) hasMistakes = true;
        });

        if (!hasMistakes) {
            mistakeList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--success); font-weight:700; font-size:18px;"><i class="fas fa-trophy"></i> Perfect Score! No mistakes.</div>';
            $('mistakeBucketArea').style.display = 'none';
        } else {
            mistakeList.innerHTML = '<h3 style="margin-bottom: 15px; color: var(--error);"><i class="fas fa-times-circle"></i> Review Mistakes</h3>';
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
                    if (mcqVal(q, 'Explanation')) {
                        html += '<div class="explanation-box"><i class="fas fa-lightbulb"></i> ' + mcqVal(q, 'Explanation') + '</div>';
                    }
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
                    bucketMsg.style.color = '';
                    apiCall('/api/mistake-bucket-add', {
                        body: JSON.stringify({ mcq_ids: wrongIds }),
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (sessionStorage.getItem('_st') || '') }
                    }).then(function (res) {
                        return res ? res.json() : {};
                    }).then(function (data) {
                        if (data.error) {
                            bucketMsg.textContent = data.error;
                            bucketMsg.style.color = 'var(--error)';
                            bucketBtn.disabled = false;
                        } else {
                            bucketMsg.textContent = (data.message || 'Added to Mistake Bucket.') + ' You can re-attempt them from the portal.';
                            bucketMsg.style.color = 'var(--success)';
                        }
                    }).catch(function () {
                        bucketMsg.textContent = 'Failed to add. Try again.';
                        bucketMsg.style.color = 'var(--error)';
                        bucketBtn.disabled = false;
                    });
                };
            }
        }
    }

    function submitPartialResultIfNeeded() {
        if (!activeQuestions || activeQuestions.length === 0) return;
        if (hasSubmitted) return;
        if (document.getElementById('quizSection').classList.contains('hidden')) return;
        var token = sessionStorage.getItem('_st');
        if (!token) return;
        var totalTime = Math.floor((Date.now() - startTime) / 1000);
        var payload = {
            course: (currentTestMeta && currentTestMeta.course) || null,
            classExam: (currentTestMeta && currentTestMeta.classExam) || null,
            subject: (currentTestMeta && currentTestMeta.subject) || null,
            unit: (currentTestMeta && currentTestMeta.unit) || null,
            category: (currentTestMeta && currentTestMeta.category) || null,
            testNumber: (currentTestMeta && currentTestMeta.testNumber) || null,
            totalMarks: activeQuestions.length,
            obtainedMarks: score,
            totalTimeSeconds: totalTime,
            testType: 'Mock Test',
            authToken: token
        };
        try {
            var url = (window.location.origin || '') + '/api/submit-test';
            fetch(url, {
                method: 'POST',
                keepalive: true,
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ course: payload.course, classExam: payload.classExam, subject: payload.subject, unit: payload.unit, category: payload.category, testNumber: payload.testNumber, totalMarks: payload.totalMarks, obtainedMarks: payload.obtainedMarks, totalTimeSeconds: payload.totalTimeSeconds, testType: payload.testType })
            });
        } catch (e) {}
    }
    window.addEventListener('beforeunload', submitPartialResultIfNeeded);
    window.addEventListener('pagehide', submitPartialResultIfNeeded);

    function displayGrid(list, callback) {
        var area = $('navigationArea'); area.innerHTML = '';
        if (list.length === 0) {
            area.innerHTML = '<p class="grid-empty-msg">No items found.</p>';
            return;
        }
        list.forEach(function (item) {
            var btn = document.createElement('button'); btn.className = 'nav-btn';
            btn.innerHTML = '<span class="btn-cat">' + item + '</span>';
            btn.onclick = function () { callback(item); }; area.appendChild(btn);
        });
    }

    function resetUI() {
        $('resultArea').classList.add('hidden');
        $('mainSection').classList.remove('hidden');
        $('testInfoSection').classList.add('hidden');
        $('quizSection').classList.add('hidden');
        clearInterval(timerInterval);
    }

    function shuffleArray(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
    }

    $('logoutBtn').onclick = logout;
    $('goHomeBtn').onclick = renderCourses;
    $('breadcrumb').onclick = renderCourses;
    $('backToMenuBtn').onclick = function () { $('testInfoSection').classList.add('hidden'); $('mainSection').classList.remove('hidden'); renderCourses(); };

    init();
})();
