import { supabase, initAuthGuard, getAuthUser, logout as adminLogout } from './auth-guard.js';

/* ── state ──────────────────────────────────────────── */
var navData = [], currentPath = [], activeQuestions = [], userAnswers = [];
var currentIndex = 0, score = 0, startTime, timerInterval;
var questionStartTime = null, attemptRecords = [];
var currentTestMeta = {};
var hasSubmitted = false;

const ATTEMPTED_KEY = '_admin_navi_done';
const $ = (id) => document.getElementById(id);

/* ── token helper ────────────────────────────────────── */
async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data && data.session ? data.session.access_token : null;
}

/* ── api call ─────────────────────────────────────────── */
async function apiCall(endpoint, options) {
    const token = await getToken();
    if (!token) { adminLogout(); return null; }
    const res = await fetch(endpoint, Object.assign({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    }, options || {}));
    if (res.status === 401 || res.status === 403) { adminLogout(); return null; }
    return res;
}

/* ── attempted-tests tracker (admin-scoped localStorage) ── */
function attemptStoreKey(course, classExam, subject, unit, category, testNum) {
    return [course, classExam, subject, unit, category || '', String(testNum)].join('||');
}
function markAttempted(course, classExam, subject, unit, category, testNum) {
    try {
        const key = attemptStoreKey(course, classExam, subject, unit, category, testNum);
        const list = JSON.parse(localStorage.getItem(ATTEMPTED_KEY) || '[]');
        if (!list.includes(key)) { list.push(key); localStorage.setItem(ATTEMPTED_KEY, JSON.stringify(list)); }
    } catch (e) {}
}
function isAttempted(course, classExam, subject, unit, category, testNum) {
    try {
        const key = attemptStoreKey(course, classExam, subject, unit, category, testNum);
        const list = JSON.parse(localStorage.getItem(ATTEMPTED_KEY) || '[]');
        return list.includes(key);
    } catch (e) { return false; }
}

/* ── nav cache ───────────────────────────────────────── */
function navCacheKey() {
    const user = getAuthUser();
    return '_admin_navi_cache_' + (user ? user.email : '');
}
function getNavCache() {
    try {
        const raw = localStorage.getItem(navCacheKey());
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed.ts || Date.now() - parsed.ts > 5 * 60 * 1000) return null;
        return parsed.data || null;
    } catch (e) { return null; }
}
function setNavCache(data) {
    try { localStorage.setItem(navCacheKey(), JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
}

/* ── helpers ─────────────────────────────────────────── */
function distinct(arr, key) {
    const seen = new Set();
    return arr.reduce((out, x) => {
        const v = key(x);
        if (v == null || v === '' || seen.has(v)) return out;
        seen.add(v); out.push(v);
        return out;
    }, []).sort((a, b) => String(a).localeCompare(String(b)));
}
function mcqVal(r, key) {
    if (!r) return undefined;
    let v = r[key];
    if (v !== undefined && v !== null) return v;
    const lower = key.toLowerCase ? key.toLowerCase() : key;
    v = r[lower];
    if (v !== undefined && v !== null) return v;
    return r[(key + '').replace(/\s+/g, '_').toLowerCase()];
}
function setActionMsg(text, isError) {
    const msg = $('questionActionMsg');
    if (!msg) return;
    msg.textContent = text || '';
    msg.style.color = isError ? 'var(--error)' : '#059669';
}
function currentQuestion() { return activeQuestions[currentIndex] || null; }

/* ── nav loading ─────────────────────────────────────── */
async function loadNav() {
    const cached = getNavCache();
    if (cached) {
        navData = cached;
        renderCourses();
        apiCall('/api/admin-nav').then(res => {
            if (!res) return;
            return res.json().then(data => {
                if (!data.error && data.nav) setNavCache(data.nav);
            });
        }).catch(() => {});
        return;
    }
    const res = await apiCall('/api/admin-nav');
    if (!res) return;
    const data = await res.json();
    if (data.error) { alert('Error loading navigation: ' + data.error); return; }
    navData = data.nav || [];
    setNavCache(navData);
    renderCourses();
}

/* ── navigation drilling ─────────────────────────────── */
function renderCourses() {
    resetUI(); currentPath = [];
    $('breadcrumb').innerHTML = '<i class="fas fa-home"></i> Select Course';
    displayGrid(distinct(navData, r => mcqVal(r, 'Course')), val => { currentPath = [val]; renderClasses(val); });
}
function renderClasses(course) {
    $('breadcrumb').innerText = 'Home > ' + course;
    const subset = navData.filter(r => mcqVal(r, 'Course') === course);
    displayGrid(distinct(subset, r => mcqVal(r, 'Class/Exam')), val => { currentPath = [course, val]; renderSubjects(val); });
}
function renderSubjects(classExam) {
    $('breadcrumb').innerText = 'Home > ' + currentPath[0] + ' > ' + classExam;
    const subset = navData.filter(r => mcqVal(r, 'Course') === currentPath[0] && mcqVal(r, 'Class/Exam') === classExam);
    displayGrid(distinct(subset, r => mcqVal(r, 'Subject')), val => { currentPath = [currentPath[0], classExam, val]; renderUnits(val); });
}
function renderUnits(subject) {
    $('breadcrumb').innerText = 'Home > ' + currentPath[0] + ' > ' + currentPath[1] + ' > ' + subject;
    const subset = navData.filter(r => mcqVal(r, 'Course') === currentPath[0] && mcqVal(r, 'Class/Exam') === currentPath[1] && mcqVal(r, 'Subject') === subject);
    displayGrid(distinct(subset, r => mcqVal(r, 'Unit')), val => { currentPath = currentPath.slice(0, 3).concat([val]); renderCategories(val); });
}
function renderCategories(unit) {
    $('breadcrumb').innerText = 'Home > ' + currentPath[0] + ' > ' + currentPath[1] + ' > ' + currentPath[2] + ' > ' + unit;
    const subset = navData.filter(r => mcqVal(r, 'Course') === currentPath[0] && mcqVal(r, 'Class/Exam') === currentPath[1] && mcqVal(r, 'Subject') === currentPath[2] && mcqVal(r, 'Unit') === unit);
    const categories = distinct(subset, r => mcqVal(r, 'Category'));
    if (categories.length === 0 || (categories.length === 1 && !categories[0])) { renderTests(unit, null); return; }
    displayGrid(categories, val => { currentPath = currentPath.slice(0, 4).concat([val]); renderTests(unit, val); });
}
function renderTests(unit, category) {
    const crumb = 'Home > ' + currentPath[0] + ' > ' + currentPath[1] + ' > ' + currentPath[2] + ' > ' + unit + (category ? ' > ' + category : '');
    $('breadcrumb').innerText = crumb;
    let subset = navData.filter(r => mcqVal(r, 'Course') === currentPath[0] && mcqVal(r, 'Class/Exam') === currentPath[1] && mcqVal(r, 'Subject') === currentPath[2] && mcqVal(r, 'Unit') === unit);
    if (category) subset = subset.filter(r => mcqVal(r, 'Category') === category);
    subset.sort((a, b) => Number(mcqVal(a, 'Test Number')) - Number(mcqVal(b, 'Test Number')));
    const area = $('navigationArea');
    area.innerHTML = ''; area.className = 'grid-container test-grid';
    subset.forEach(entry => {
        const num = mcqVal(entry, 'Test Number');
        const topics = mcqVal(entry, 'Topics') || null;
        const count = entry.count;
        const done = isAttempted(currentPath[0], currentPath[1], currentPath[2], unit, category, num);
        const btn = document.createElement('button');
        btn.className = 'nav-btn' + (done ? ' test-done' : '');
        const topicsHtml = topics ? '<span class="btn-range" style="color:#2563eb;border-color:#bfdbfe;background:#eff6ff;">' + topics + '</span>' : '';
        btn.innerHTML = '<span class="btn-cat">Test #' + num + '</span>' + topicsHtml + '<span class="btn-range">' + count + ' Questions</span>';
        btn.onclick = () => showTestInfo(unit, category, num, count, topics);
        area.appendChild(btn);
    });
}

/* ── test info ───────────────────────────────────────── */
function showTestInfo(unit, category, testNum, count, topics) {
    $('mainSection').classList.add('hidden');
    $('testInfoSection').classList.remove('hidden');
    const testErr = $('testErrorMsg');
    if (testErr) testErr.classList.remove('show');
    $('infoCourse').innerText = currentPath[0];
    $('infoClass').innerText = currentPath[1];
    $('infoSub').innerText = currentPath[2];
    $('infoUnit').innerText = unit;
    $('infoCat').innerText = category || '—';
    $('infoTestNo').innerText = testNum;
    $('infoCount').innerText = count;
    const topicsSpan = $('infoTopics');
    if (topicsSpan) topicsSpan.innerText = topics || '—';
    currentTestMeta = {
        course: currentPath[0], classExam: currentPath[1], subject: currentPath[2],
        unit, category: category || null, testNumber: testNum, topics: topics || null,
    };
    $('startTestBtn').onclick = async function () {
        $('startTestBtn').disabled = true;
        $('startTestBtn').textContent = 'Loading…';
        const res = await apiCall('/api/admin-mcqs', {
            body: JSON.stringify({
                course: currentTestMeta.course, classExam: currentTestMeta.classExam,
                subject: currentTestMeta.subject, unit, category: category || null, testNumber: testNum,
            }),
        });
        $('startTestBtn').disabled = false;
        $('startTestBtn').innerHTML = '<i class="fas fa-play"></i> Start Exam Now';
        if (!res) return;
        const mcqData = await res.json().catch(() => ({}));
        if (mcqData.error || !mcqData.mcqs || mcqData.mcqs.length === 0) {
            const msgEl = $('testErrorMsg');
            const textEl = $('testErrorText');
            if (msgEl && textEl) {
                textEl.textContent = mcqData.error || 'No MCQs found for this test.';
                msgEl.classList.add('show');
                msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
        $('testErrorMsg').classList.remove('show');
        $('testInfoSection').classList.add('hidden');
        startQuiz(mcqData.mcqs);
    };
}

/* ── quiz ────────────────────────────────────────────── */
function startQuiz(questions) {
    activeQuestions = shuffleArray(questions.slice());
    currentIndex = 0; score = 0; userAnswers = [];
    attemptRecords = []; questionStartTime = null;
    startTime = Date.now(); hasSubmitted = false;
    setActionMsg('', false);
    $('quizSection').classList.remove('hidden');
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        $('quizTimer').innerText = Math.floor(elapsed / 60) + ':' + String(elapsed % 60).padStart(2, '0');
    }, 1000);
    showQuestion();
}

function showQuestion() {
    questionStartTime = Date.now();
    const q = activeQuestions[currentIndex];
    setActionMsg('', false);
    $('quizProgress').innerText = 'Question ' + (currentIndex + 1) + ' of ' + activeQuestions.length;
    $('questionText').innerText = mcqVal(q, 'Question') || '';
    const area = $('optionsArea');
    area.innerHTML = '';
    let optionPairs = [
        { letter: 'A', text: mcqVal(q, 'Option A') },
        { letter: 'B', text: mcqVal(q, 'Option B') },
        { letter: 'C', text: mcqVal(q, 'Option C') },
        { letter: 'D', text: mcqVal(q, 'Option D') },
    ].filter(p => p.text);
    optionPairs = shuffleArray(optionPairs.slice());
    optionPairs.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = p.letter + ')  ' + p.text;
        btn.onclick = () => {
            const timeTakenSec = Math.max(0, Math.round((Date.now() - questionStartTime) / 1000));
            const correctAns = mcqVal(q, 'Correct Answer');
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
    const markImportantBtn = $('markImportantBtn');
    const delBtn = $('deleteCurrentMcqBtn');
    if (markImportantBtn) markImportantBtn.onclick = markCurrentImportant;
    if (delBtn) delBtn.onclick = deleteCurrentMcq;
}

async function markCurrentImportant() {
    const q = currentQuestion();
    if (!q || q.id == null) { setActionMsg('Unable to mark as Important.', true); return; }
    const res = await apiCall('/api/student-important-add', { body: JSON.stringify({ mcq_id: String(q.id) }) });
    if (!res) return;
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) { setActionMsg(data.error || 'Failed to mark Important.', true); return; }
    setActionMsg('Added to Important bucket.', false);
}

async function deleteCurrentMcq() {
    const q = currentQuestion();
    if (!q || q.id == null) { setActionMsg('No MCQ to delete.', true); return; }
    if (!confirm('Delete this MCQ permanently? This cannot be undone.')) return;
    const delBtn = $('deleteCurrentMcqBtn');
    if (delBtn) { delBtn.disabled = true; delBtn.textContent = 'Deleting…'; }
    const { error } = await supabase.from('mcqs').delete().eq('id', q.id);
    if (delBtn) { delBtn.disabled = false; delBtn.innerHTML = '<i class="fas fa-trash"></i> Delete'; }
    if (error) { setActionMsg('Delete failed: ' + error.message, true); return; }
    activeQuestions.splice(currentIndex, 1);
    try { localStorage.removeItem(navCacheKey()); } catch (e) {}
    if (!activeQuestions.length) { showResults(); return; }
    if (currentIndex >= activeQuestions.length) currentIndex = activeQuestions.length - 1;
    showQuestion();
    setActionMsg('MCQ deleted.', false);
}

/* ── results ─────────────────────────────────────────── */
function showResults() {
    clearInterval(timerInterval);
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    $('quizSection').classList.add('hidden');
    $('resultArea').classList.remove('hidden');
    const pct = activeQuestions.length > 0 ? Math.round((score / activeQuestions.length) * 100) : 0;
    $('resScore').innerText = score + '/' + activeQuestions.length + ' (' + pct + '%)';
    const mins = Math.floor(totalTime / 60), secs = totalTime % 60;
    $('resTotalTime').innerText = mins > 0 ? mins + 'm ' + secs + 's' : totalTime + 's';
    $('resAvgTime').innerText = (totalTime / Math.max(1, activeQuestions.length)).toFixed(1) + 's';
    hasSubmitted = true;
    markAttempted(currentTestMeta.course, currentTestMeta.classExam, currentTestMeta.subject, currentTestMeta.unit, currentTestMeta.category, currentTestMeta.testNumber);
    apiCall('/api/submit-test', {
        body: JSON.stringify({
            course: currentTestMeta.course, classExam: currentTestMeta.classExam,
            subject: currentTestMeta.subject, unit: currentTestMeta.unit,
            category: currentTestMeta.category, testNumber: currentTestMeta.testNumber,
            totalMarks: activeQuestions.length, obtainedMarks: score,
            totalTimeSeconds: totalTime, testType: 'Practice Test',
        }),
    }).catch(() => {});
    if (attemptRecords.length > 0) {
        apiCall('/api/save-attempts', {
            body: JSON.stringify({
                attempts: attemptRecords,
                testContext: {
                    course: currentTestMeta.course, classExam: currentTestMeta.classExam,
                    subject: currentTestMeta.subject, unit: currentTestMeta.unit,
                    category: currentTestMeta.category, testNumber: currentTestMeta.testNumber,
                    testType: 'Practice Test',
                },
            }),
        }).catch(() => {});
    }
    const mistakeList = $('mistakeList');
    mistakeList.innerHTML = '';
    let hasMistakes = false;
    activeQuestions.forEach((q, idx) => { if (userAnswers[idx] !== mcqVal(q, 'Correct Answer')) hasMistakes = true; });
    if (!hasMistakes) {
        mistakeList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--success);font-weight:700;font-size:18px;"><i class="fas fa-trophy"></i> Perfect Score! No mistakes.</div>';
    } else {
        mistakeList.innerHTML = '<h3 style="margin-bottom:15px;color:var(--error);"><i class="fas fa-times-circle"></i> Review Mistakes</h3>';
        activeQuestions.forEach((q, idx) => {
            const correctLetter = mcqVal(q, 'Correct Answer');
            if (userAnswers[idx] !== correctLetter) {
                const yourLetter = userAnswers[idx];
                const div = document.createElement('div'); div.className = 'mistake-item';
                let html = '<b>' + (idx + 1) + '. ' + (mcqVal(q, 'Question') || '') + '</b>';
                html += '<small>Your answer: <span class="your-ans">' + yourLetter + ') ' + (mcqVal(q, 'Option ' + yourLetter) || 'None') + '</span></small><br>';
                html += '<small>Correct: <span class="correct-ans">' + correctLetter + ') ' + (mcqVal(q, 'Option ' + correctLetter) || '—') + '</span></small>';
                if (mcqVal(q, 'Explanation')) html += '<div class="explanation-box"><i class="fas fa-lightbulb"></i> ' + mcqVal(q, 'Explanation') + '</div>';
                div.innerHTML = html; mistakeList.appendChild(div);
            }
        });
    }
}

/* ── partial submit on unload ─────────────────────────── */
function submitPartialIfNeeded() {
    if (!activeQuestions || !activeQuestions.length || hasSubmitted) return;
    if ($('quizSection').classList.contains('hidden')) return;
    getToken().then(token => {
        if (!token) return;
        const totalTime = Math.floor((Date.now() - startTime) / 1000);
        fetch('/api/submit-test', {
            method: 'POST', keepalive: true,
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
                course: currentTestMeta.course, classExam: currentTestMeta.classExam,
                subject: currentTestMeta.subject, unit: currentTestMeta.unit,
                category: currentTestMeta.category, testNumber: currentTestMeta.testNumber,
                totalMarks: activeQuestions.length, obtainedMarks: score,
                totalTimeSeconds: totalTime, testType: 'Practice Test',
            }),
        });
    });
}
window.addEventListener('beforeunload', submitPartialIfNeeded);
window.addEventListener('pagehide', submitPartialIfNeeded);

/* ── grid display ─────────────────────────────────────── */
function displayGrid(list, callback) {
    const area = $('navigationArea');
    area.innerHTML = ''; area.className = 'grid-container';
    if (!list.length) { area.innerHTML = '<p class="grid-empty-msg">No items found.</p>'; return; }
    list.forEach(item => {
        const btn = document.createElement('button'); btn.className = 'nav-btn';
        btn.innerHTML = '<span class="btn-cat">' + item + '</span>';
        btn.onclick = () => callback(item); area.appendChild(btn);
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
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
}

/* ── event wiring ─────────────────────────────────────── */
$('logoutBtn').addEventListener('click', adminLogout);
$('goHomeBtn').addEventListener('click', renderCourses);
$('breadcrumb').addEventListener('click', renderCourses);
$('backToMenuBtn').addEventListener('click', () => { $('testInfoSection').classList.add('hidden'); $('mainSection').classList.remove('hidden'); renderCourses(); });

/* ── init ────────────────────────────────────────────── */
async function init() {
    const authOk = await initAuthGuard();
    if (!authOk) return; // auth-guard shows login overlay
    const user = getAuthUser();
    if (!user || (user.role || '').toLowerCase() !== 'admin') {
        window.location.replace('dashboard.html');
        return;
    }
    $('userBadge').textContent = user.name || user.email || '';
    $('sessionLoader').style.display = 'none';
    $('mainSection').classList.remove('hidden');
    await loadNav();
}
init();
