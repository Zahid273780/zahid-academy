(function () {
    var token = sessionStorage.getItem('_st');
    if (!token) {
        window.location.replace('login.html');
        return;
    }

    function $(id) { return document.getElementById(id); }

    var chartInstances = [];

    function destroyCharts() {
        chartInstances.forEach(function (ch) {
            if (ch && typeof ch.destroy === 'function') ch.destroy();
        });
        chartInstances = [];
    }

    var CACHE_KEY = '_student_analytics_cache';
    function getCachedAnalytics() {
        try {
            var raw = sessionStorage.getItem(CACHE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    function setCachedAnalytics(data) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch (e) {}
    }

    function logout() {
        sessionStorage.removeItem('_st');
        sessionStorage.removeItem('_se');
        window.location.replace('login.html');
    }

    async function apiCall(endpoint, options) {
        var t = sessionStorage.getItem('_st');
        if (!t) { logout(); return null; }
        var res = await fetch(endpoint, Object.assign({
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t }
        }, options || {}));
        if (res.status === 401 || res.status === 403) {
            logout();
            return null;
        }
        return res;
    }

    function getTestDate(attemptDate) {
        if (!attemptDate) return null;
        var d = new Date(attemptDate);
        return isNaN(d.getTime()) ? null : d;
    }

    function toLocalDate(d) {
        if (!d) return '—';
        var x = d instanceof Date ? d : new Date(d);
        return isNaN(x.getTime()) ? '—' : x.toLocaleDateString();
    }

    function formatTime(seconds) {
        if (seconds == null || isNaN(seconds)) return '—';
        var s = Number(seconds);
        if (s < 60) return s + 's';
        var m = Math.floor(s / 60);
        var sec = s % 60;
        return sec > 0 ? m + 'm ' + sec + 's' : m + 'm';
    }

    function pctClass(pct) {
        if (pct == null || isNaN(pct)) return '';
        var n = Number(pct);
        if (n >= 80) return 'high';
        if (n >= 60) return 'mid';
        return 'low';
    }

    function esc(str) {
        if (str == null) return '';
        var s = String(str);
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    /** Build the shape expected by render* from API response { practice, mistakeBucketCount } */
    function computeFromPractice(practice, mistakeBucketCount) {
        var p = Array.isArray(practice) ? practice : [];
        var totalTests = p.length;
        var totalCorrect = 0;
        var totalAttempted = 0;
        var totalTimeSec = 0;
        var bySubjectMap = {};
        var byTypeMap = {};
        p.forEach(function (r) {
            var correct = r.obtained_marks != null ? Number(r.obtained_marks) : 0;
            var total = r.total_marks != null ? Number(r.total_marks) : 0;
            totalCorrect += correct;
            totalAttempted += total;
            totalTimeSec += (r.total_time_seconds != null ? Number(r.total_time_seconds) : 0);
            var sub = (r.subject || '—').toString();
            if (!bySubjectMap[sub]) bySubjectMap[sub] = { correct: 0, total: 0, count: 0 };
            bySubjectMap[sub].correct += correct;
            bySubjectMap[sub].total += total;
            bySubjectMap[sub].count += 1;
            var type = (r.test_type || '—').toString();
            if (!byTypeMap[type]) byTypeMap[type] = { correct: 0, total: 0, count: 0 };
            byTypeMap[type].correct += correct;
            byTypeMap[type].total += total;
            byTypeMap[type].count += 1;
        });
        var bySubject = Object.keys(bySubjectMap).map(function (sub) {
            var x = bySubjectMap[sub];
            var avgPct = x.total > 0 ? Math.round((x.correct / x.total) * 100) : 0;
            return { subject: sub, tests: x.count, avgPct: avgPct, totalMcqs: x.total };
        });
        var byType = Object.keys(byTypeMap).map(function (type) {
            var x = byTypeMap[type];
            var avgPct = x.total > 0 ? Math.round((x.correct / x.total) * 100) : 0;
            return { type: type, count: x.count, avgPct: avgPct };
        });
        var byTopic = bySubject.map(function (r) { return { topic: r.subject, avgPct: r.avgPct }; });
        var sorted = p.slice().sort(function (a, b) {
            var da = a.test_date || a.created_at;
            var db = b.test_date || b.created_at;
            return new Date(db) - new Date(da);
        });
        var recent = sorted.slice(0, 10).map(function (r) {
            var total = r.total_marks != null ? r.total_marks : 0;
            var score = r.obtained_marks != null ? r.obtained_marks : 0;
            var pct = r.percentage != null ? r.percentage : (total > 0 ? Math.round((score / total) * 100) : 0);
            var testName = (r.subject || '') + (r.unit ? ' Unit ' + r.unit : '') || 'Test';
            return {
                date: r.test_date || r.created_at,
                testName: testName,
                score: score,
                total: total,
                pct: pct,
                grade: r.grade,
                timeSpent: r.total_time_seconds,
                testType: r.test_type
            };
        });
        var learningCurve = sorted.slice(0, 20).reverse().map(function (r) {
            var total = r.total_marks != null ? r.total_marks : 0;
            var score = r.obtained_marks != null ? r.obtained_marks : 0;
            var pct = r.percentage != null ? r.percentage : (total > 0 ? Math.round((score / total) * 100) : 0);
            return { pct: pct };
        });
        var trend = recent.slice(0, 10).map(function (r) {
            return { date: r.date, testName: r.testName, pct: r.pct };
        });
        var avgTimePerMcq = totalAttempted > 0 && totalTimeSec > 0 ? totalTimeSec / totalAttempted : null;
        var weakAreas = bySubject.slice().sort(function (a, b) { return a.avgPct - b.avgPct; }).slice(0, 5);
        var improved = bySubject.slice().sort(function (a, b) { return b.avgPct - a.avgPct; }).slice(0, 5);
        return {
            overview: { totalTests: totalTests, totalCorrect: totalCorrect, totalAttempted: totalAttempted },
            byTopic: byTopic,
            learningCurve: learningCurve,
            timeAnalysis: { avgTimePerMcq: avgTimePerMcq, totalTimeSec: totalTimeSec },
            bySubject: bySubject,
            byType: byType,
            recent: recent,
            mistakeBucketCount: mistakeBucketCount,
            mistakeBucket: [],
            weakAreas: weakAreas,
            improved: improved,
            trend: trend
        };
    }

    function renderAccuracy(data) {
        var elBig = $('accuracyBig');
        var elSub = $('accuracySubtext');
        var canvas = $('chartAccuracy');
        if (!canvas || !window.Chart) return;

        var correct = (data && data.overview && data.overview.totalCorrect != null) ? data.overview.totalCorrect : 0;
        var attempted = (data && data.overview && data.overview.totalAttempted != null) ? data.overview.totalAttempted : 0;
        var pct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

        if (elBig) elBig.textContent = pct + '%';
        if (elSub) elSub.textContent = (correct + ' / ' + attempted + ' correct');

        var ctx = canvas.getContext('2d');
        destroyCharts();
        var ch = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Correct', 'Incorrect'],
                datasets: [{
                    data: [correct, Math.max(0, attempted - correct)],
                    backgroundColor: ['#22c55e', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '70%',
                plugins: { legend: { display: false } }
            }
        });
        chartInstances.push(ch);
    }

    function renderTopicBarChart(data) {
        var canvas = $('chartTopicBar');
        if (!canvas || !window.Chart) return;
        var topicData = (data && data.byTopic) ? data.byTopic : [];
        var labels = topicData.map(function (t) { return t.topic || t.label || '—'; });
        var values = topicData.map(function (t) { return t.avgPct != null ? t.avgPct : (t.value != null ? t.value : 0); });

        var ctx = canvas.getContext('2d');
        var ch = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Avg %',
                    data: values,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { beginAtZero: true, max: 100 }
                },
                plugins: { legend: { display: false } }
            }
        });
        chartInstances.push(ch);
    }

    function renderLearningCurveChart(data) {
        var canvas = $('chartLearningCurve');
        if (!canvas || !window.Chart) return;
        var curve = (data && data.learningCurve) ? data.learningCurve : [];
        var labels = curve.map(function (_, i) { return 'Test ' + (i + 1); });
        var scores = curve.map(function (s) { return s.pct != null ? s.pct : (s.score != null && s.total ? Math.round((s.score / s.total) * 100) : (s != null ? Number(s) : 0)); });

        var ctx = canvas.getContext('2d');
        var ch = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score %',
                    data: scores,
                    borderColor: 'rgb(99, 102, 241)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        });
        chartInstances.push(ch);
    }

    function renderTimeAnalysis(data) {
        var section = $('timeAnalysisSection');
        if (!section) return;
        var timeData = (data && data.timeAnalysis) ? data.timeAnalysis : {};
        var avgSec = timeData.avgTimePerMcq != null ? timeData.avgTimePerMcq : (timeData.avgTimeSec != null ? timeData.avgTimeSec : null);
        var totalSec = timeData.totalTimeSec != null ? timeData.totalTimeSec : null;
        var html = '<div class="time-stats">';
        html += '<p><strong>Avg time per question:</strong> ' + formatTime(avgSec) + '</p>';
        if (totalSec != null) html += '<p><strong>Total time (all tests):</strong> ' + formatTime(totalSec) + '</p>';
        html += '</div>';
        section.innerHTML = html;
    }

    function renderOverview(data) {
        var container = $('overviewCards');
        if (!container) return;
        var ov = (data && data.overview) ? data.overview : {};
        var totalTests = ov.totalTests != null ? ov.totalTests : 0;
        var totalCorrect = ov.totalCorrect != null ? ov.totalCorrect : 0;
        var totalAttempted = ov.totalAttempted != null ? ov.totalAttempted : 0;
        var pct = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

        var html = '';
        html += '<div class="card"><div class="card-value">' + esc(totalTests) + '</div><div class="card-label">Tests taken</div></div>';
        html += '<div class="card"><div class="card-value">' + esc(totalAttempted) + '</div><div class="card-label">MCQs attempted</div></div>';
        html += '<div class="card"><div class="card-value">' + esc(totalCorrect) + '</div><div class="card-label">Correct</div></div>';
        html += '<div class="card"><div class="card-value ' + pctClass(pct) + '">' + pct + '%</div><div class="card-label">Overall accuracy</div></div>';
        container.innerHTML = html;
    }

    function renderBySubject(data) {
        var tbody = $('bySubjectBody');
        var emptyMsg = $('bySubjectEmpty');
        if (!tbody) return;
        var rows = (data && data.bySubject) ? data.bySubject : [];
        if (rows.length === 0) {
            tbody.innerHTML = '';
            if (emptyMsg) { emptyMsg.classList.remove('hidden'); }
            return;
        }
        if (emptyMsg) emptyMsg.classList.add('hidden');
        tbody.innerHTML = rows.map(function (r) {
            var sub = esc(r.subject || r.name || '—');
            var tests = r.tests != null ? r.tests : (r.count != null ? r.count : '—');
            var avg = r.avgPct != null ? r.avgPct : (r.avg != null ? r.avg : '—');
            var total = r.totalMcqs != null ? r.totalMcqs : (r.mcqs != null ? r.mcqs : '—');
            return '<tr><td>' + sub + '</td><td>' + tests + '</td><td>' + avg + (typeof avg === 'number' ? '%' : '') + '</td><td>' + total + '</td></tr>';
        }).join('');
    }

    function renderByType(data) {
        var section = $('byTypeSection');
        if (!section) return;
        var rows = (data && data.byType) ? data.byType : [];
        if (rows.length === 0) {
            section.innerHTML = '<p class="empty-msg">No data by test type.</p>';
            return;
        }
        var html = '<div class="table-wrap" style="overflow-x:auto;"><table><thead><tr><th>Type</th><th>Count</th><th>Avg %</th></tr></thead><tbody>';
        rows.forEach(function (r) {
            var type = esc(r.type || r.name || '—');
            var count = r.count != null ? r.count : '—';
            var avg = r.avgPct != null ? r.avgPct : (r.avg != null ? r.avg : '—');
            html += '<tr><td>' + type + '</td><td>' + count + '</td><td>' + avg + (typeof avg === 'number' ? '%' : '') + '</td></tr>';
        });
        html += '</tbody></table></div>';
        section.innerHTML = html;
    }

    function renderRecent(data) {
        var tbody = $('recentBody');
        var emptyMsg = $('recentEmpty');
        if (!tbody) return;
        var rows = (data && data.recent) ? data.recent : [];
        if (rows.length === 0) {
            tbody.innerHTML = '';
            if (emptyMsg) emptyMsg.classList.remove('hidden');
            return;
        }
        if (emptyMsg) emptyMsg.classList.add('hidden');
        tbody.innerHTML = rows.map(function (r) {
            var date = toLocalDate(r.date || r.attempt_date);
            var testName = esc(r.testName || r.test_name || r.test || '—');
            var score = r.score != null ? r.score : '—';
            var total = r.total != null ? r.total : '—';
            var pct = r.pct != null ? r.pct : (typeof score === 'number' && typeof total === 'number' && total > 0 ? Math.round((score / total) * 100) : '—');
            var grade = esc(r.grade || '—');
            var timeStr = formatTime(r.timeSpent != null ? r.timeSpent : r.time_taken_sec);
            var type = esc(r.testType || r.test_type || r.type || '—');
            return '<tr><td>' + date + '</td><td>' + testName + '</td><td>' + score + '/' + total + '</td><td>' + pct + (typeof pct === 'number' ? '%' : '') + '</td><td>' + grade + '</td><td>' + timeStr + '</td><td>' + type + '</td></tr>';
        }).join('');
    }

    function renderMistakeBucket(data) {
        var section = $('mistakeBucketSection');
        if (!section) return;
        var list = (data && data.mistakeBucket) ? data.mistakeBucket : [];
        var countOnly = (data && data.mistakeBucketCount != null) ? Number(data.mistakeBucketCount) : 0;
        if (list.length > 0) {
            var html = '<ul class="mistake-list">';
            list.forEach(function (item) {
                var text = esc(item.text || item.question_preview || item.mcq_id || 'Question');
                var count = item.mistake_count != null ? item.mistake_count : (item.count != null ? item.count : 1);
                html += '<li>' + text + ' <span class="badge">' + count + '×</span></li>';
            });
            html += '</ul>';
            section.innerHTML = html;
            return;
        }
        if (countOnly > 0) {
            section.innerHTML = '<p class="empty-msg">You have <strong>' + esc(countOnly) + '</strong> item(s) in your mistake bucket. Review them from the practice area.</p>';
            return;
        }
        section.innerHTML = '<p class="empty-msg">No repeated mistakes in your bucket.</p>';
    }

    function renderWeakAreas(data) {
        var section = $('weakAreasSection');
        if (!section) return;
        var list = (data && data.weakAreas) ? data.weakAreas : [];
        if (list.length === 0) {
            section.innerHTML = '<p class="empty-msg">No weak areas identified yet. Keep practicing.</p>';
            return;
        }
        var html = '<ul class="weak-list">';
        list.forEach(function (item) {
            var topic = esc(item.topic || item.name || item.subject || '—');
            var pct = item.avgPct != null ? item.avgPct : (item.pct != null ? item.pct : '—');
            html += '<li><span class="topic">' + topic + '</span> <span class="' + pctClass(pct) + '">' + pct + (typeof pct === 'number' ? '%' : '') + '</span></li>';
        });
        html += '</ul>';
        section.innerHTML = html;
    }

    function renderImproved(data) {
        var section = $('improvedSection');
        if (!section) return;
        var list = (data && data.improved) ? data.improved : [];
        if (list.length === 0) {
            section.innerHTML = '<p class="empty-msg">Not enough data yet to show improved topics.</p>';
            return;
        }
        var html = '<ul class="improved-list">';
        list.forEach(function (item) {
            var topic = esc(item.topic || item.name || '—');
            var pct = item.avgPct != null ? item.avgPct : (item.pct != null ? item.pct : '—');
            html += '<li><span class="topic">' + topic + '</span> <span class="high">' + pct + (typeof pct === 'number' ? '%' : '') + '</span></li>';
        });
        html += '</ul>';
        section.innerHTML = html;
    }

    function renderTrend(data) {
        var section = $('trendSection');
        if (!section) return;
        var last10 = (data && data.trend) ? data.trend : (data && data.last10) ? data.last10 : [];
        if (!Array.isArray(last10)) last10 = [];
        if (last10.length === 0) {
            section.innerHTML = '<p class="empty-msg">No trend data (last 10 tests).</p>';
            return;
        }
        var html = '<div class="trend-text">';
        last10.forEach(function (t, i) {
            var date = toLocalDate(t.date || t.attempt_date);
            var label = esc(t.testName || t.test_name || 'Test');
            var pct = t.pct != null ? t.pct : (t.score != null && t.total ? Math.round((t.score / t.total) * 100) : '—');
            html += '<p>' + (i + 1) + '. ' + date + ' – ' + label + ': ' + pct + (typeof pct === 'number' ? '%' : '') + '</p>';
        });
        html += '</div>';
        section.innerHTML = html;
    }

    function renderAll(data) {
        destroyCharts();
        renderOverview(data);
        renderAccuracy(data);
        renderTopicBarChart(data);
        renderLearningCurveChart(data);
        renderTimeAnalysis(data);
        renderBySubject(data);
        renderByType(data);
        renderRecent(data);
        renderMistakeBucket(data);
        renderWeakAreas(data);
        renderImproved(data);
        renderTrend(data);
    }

    function applyAnalyticsData(data) {
        var loader = $('sessionLoader');
        var main = $('mainSection');
        var noData = $('noDataMsg');
        var content = $('analyticsContent');
        var userEmailEl = $('userEmail');

        if (loader) loader.classList.add('hidden');
        if (main) main.classList.remove('hidden');
        if (userEmailEl) userEmailEl.textContent = (data && data.email) ? data.email : sessionStorage.getItem('_se') || '';

        var hasData = data && (data.overview || data.recent || data.bySubject);
        var hasPractice = hasData && data.overview && data.overview.totalAttempted > 0;
        var hasRecent = hasData && data.recent && data.recent.length > 0;
        if (hasData && (hasPractice || hasRecent)) {
            if (noData) noData.classList.add('hidden');
            if (content) content.classList.remove('hidden');
            renderAll(data);
        } else {
            if (noData) noData.classList.remove('hidden');
            if (content) content.classList.add('hidden');
        }
    }

    function init() {
        var token = sessionStorage.getItem('_st');
        if (!token) {
            window.location.replace('login.html');
            return;
        }

        var loader = $('sessionLoader');
        var main = $('mainSection');

        (async function () {
            try {
                var verifyRes = await apiCall('/api/verify-student');
                if (!verifyRes) return;
                var verifyData = await verifyRes.json();
                if (!verifyData || !verifyData.valid) {
                    logout();
                    return;
                }

                if (loader) loader.classList.add('hidden');
                if (main) main.classList.remove('hidden');
                var userEmailEl = $('userEmail');
                if (userEmailEl) userEmailEl.textContent = verifyData.email || sessionStorage.getItem('_se') || '';

                var cached = getCachedAnalytics();
                if (cached) applyAnalyticsData(cached);

                var analyticsRes = await apiCall('/api/student-analytics');
                if (!analyticsRes) return;
                var raw = await analyticsRes.json().catch(function () { return {}; });
                if (raw.error) {
                    if ($('noDataMsg')) {
                        $('noDataMsg').classList.remove('hidden');
                        $('noDataMsg').innerHTML = '<p>' + esc(raw.error) + '</p>';
                    }
                    if ($('analyticsContent')) $('analyticsContent').classList.add('hidden');
                    return;
                }
                var practice = raw.practice || [];
                var mistakeBucketCount = raw.mistakeBucketCount != null ? raw.mistakeBucketCount : 0;
                var analyticsData = computeFromPractice(practice, mistakeBucketCount);
                analyticsData.email = raw.email || verifyData.email || sessionStorage.getItem('_se') || '';
                setCachedAnalytics(analyticsData);
                applyAnalyticsData(analyticsData);
            } catch (e) {
                logout();
            }
        })();
    }

    $('logoutBtn').addEventListener('click', logout);
    init();
})();
