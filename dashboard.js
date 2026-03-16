import { supabase, initAuthGuard, getAuthUser, canView, logout } from './auth-guard.js';

var NAV_CATEGORIES = [
  {
    id: 'students', label: 'Students', icon: 'fas fa-user-graduate',
    items: [
      { href: 'admission.html', label: 'Admission', icon: 'fas fa-file-signature', table: 'page:admission' },
      { href: 'students.html',  label: 'Student List', icon: 'fas fa-list-ul', table: 'page:students' },
      { href: 'attendance.html', label: 'Attendance', icon: 'fas fa-clipboard-check', table: 'page:attendance' },
      { href: 'attendance-reports.html', label: 'Attendance Reports', icon: 'fas fa-chart-bar', table: 'page:attendance' },
    ]
  },
  {
    id: 'exams', label: 'Exams', icon: 'fas fa-pen-fancy',
    items: [
      { href: 'bulkimport.html', label: 'Import MCQs', icon: 'fas fa-file-import', table: 'page:import-mcqs' },
      { href: 'mcqs.html',       label: 'Manage MCQs', icon: 'fas fa-tasks', table: 'page:manage-mcqs' },
      { href: 'publisher.html',  label: 'Publisher', icon: 'fas fa-bullhorn', table: 'page:publisher' },
      { href: 'results.html',    label: 'Results', icon: 'fas fa-chart-bar', table: 'page:results' },
    ]
  },
  {
    id: 'curriculum', label: 'Curriculum', icon: 'fas fa-book-open',
    items: [
      { href: 'course-structure.html', label: 'Course Structure', icon: 'fas fa-sitemap',     table: 'page:course-structure' },
      { href: 'subjects.html',         label: 'Subjects',         icon: 'fas fa-bookmark',    table: 'page:subjects' },
      { href: 'study/admin.html',      label: 'Study Notes',      icon: 'fas fa-book-reader', table: 'page:course-structure' },
    ]
  },
  {
    id: 'communications', label: 'Communications', icon: 'fas fa-bullhorn',
    items: [
      { href: 'announcements.html',         label: 'Announcements',        icon: 'fas fa-bullhorn',    table: 'page:announcements' },
      { href: 'motivational-messages.html', label: 'Motivational Messages', icon: 'fas fa-fire',       table: 'page:motivational-messages' },
      { href: 'quotes.html',                label: 'Quotes of the Day',     icon: 'fas fa-quote-right', table: 'page:quotes' },
    ]
  },
  {
    id: 'settings', label: 'Settings', icon: 'fas fa-cog',
    items: [
      { href: 'users.html',         label: 'Users',          icon: 'fas fa-users-cog',   table: 'page:users' },
      { href: 'subscriptions.html', label: 'Subscriptions',  icon: 'fas fa-ticket-alt',  table: 'page:subscriptions' },
      { href: 'rbac.html',          label: 'Access Control', icon: 'fas fa-shield-alt',  table: 'page:rbac' },
    ]
  },
];

var QUICK_ACCESS = [
  { href: 'admission.html',      label: 'Admission',      icon: 'fas fa-file-signature', table: 'page:admission' },
  { href: 'students.html',       label: 'Students',       icon: 'fas fa-user-graduate',  table: 'page:students' },
  { href: 'mcqs.html',           label: 'Manage MCQs',    icon: 'fas fa-tasks',          table: 'page:manage-mcqs' },
  { href: 'results.html',        label: 'Results',        icon: 'fas fa-chart-bar',      table: 'page:results' },
  { href: 'publisher.html',      label: 'Publisher',      icon: 'fas fa-broadcast-tower',table: 'page:publisher' },
  { href: 'announcements.html',  label: 'Announcements',  icon: 'fas fa-bullhorn',       table: 'page:announcements' },
  { href: 'users.html',          label: 'Users',          icon: 'fas fa-users-cog',      table: 'page:users' },
  { href: 'subscriptions.html',  label: 'Subscriptions',  icon: 'fas fa-ticket-alt',     table: 'page:subscriptions' },
  { href: 'rbac.html',           label: 'Access Control', icon: 'fas fa-shield-alt',     table: 'page:rbac' },
  { href: 'study/admin.html',    label: 'Study Notes',    icon: 'fas fa-book-reader',    table: 'page:course-structure' },
];

async function boot() {
  var ok = await initAuthGuard();
  if (!ok) return;

  var user = getAuthUser();
  if (!user) return;

  document.getElementById('userName').textContent = user.name || user.email;
  document.getElementById('userRole').textContent = user.role;
  document.getElementById('welcomeMsg').textContent = 'Welcome, ' + (user.name || user.email).split(' ')[0] + '!';

  var avatar = document.getElementById('userAvatar');
  avatar.textContent = ((user.name || user.email || '??').substring(0, 2)).toUpperCase();
  avatar.className = 'user-avatar avatar-' + user.role;

  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var now = new Date();
  document.getElementById('welcomeDate').textContent = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();

  buildSidebar(user);
  buildQuickLinks();
  loadStats();
  loadQuoteOfDay();
}

function buildSidebar(user) {
  var nav = document.getElementById('sidebarNav');
  var html = '';

  NAV_CATEGORIES.forEach(function (cat) {
    var visibleItems = cat.items.filter(function (item) {
      return canView(item.table);
    });
    if (visibleItems.length === 0) return;

    html += '<div class="nav-category">'
      + '<button class="nav-cat-btn" data-cat="' + cat.id + '">'
      + '<i class="cat-icon ' + cat.icon + '"></i> ' + cat.label
      + '<i class="cat-arrow fas fa-chevron-right"></i>'
      + '</button>'
      + '<div class="nav-items" id="cat-' + cat.id + '">';

    visibleItems.forEach(function (item) {
      html += '<a href="' + item.href + '" class="nav-item"><i class="' + item.icon + '"></i> ' + item.label + '</a>';
    });

    html += '</div></div>';
  });

  nav.innerHTML = html;

  nav.querySelectorAll('.nav-cat-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var catId = btn.dataset.cat;
      var items = document.getElementById('cat-' + catId);
      var isOpen = items.classList.contains('open');

      nav.querySelectorAll('.nav-items').forEach(function (el) { el.classList.remove('open'); });
      nav.querySelectorAll('.nav-cat-btn').forEach(function (el) { el.classList.remove('open'); });

      if (!isOpen) {
        items.classList.add('open');
        btn.classList.add('open');
      }
    });
  });
}

function buildQuickLinks() {
  var container = document.getElementById('quickLinks');
  var html = '';
  QUICK_ACCESS.forEach(function (item) {
    if (!canView(item.table)) return;
    html += '<a href="' + item.href + '" class="quick-link"><i class="' + item.icon + '"></i><span>' + item.label + '</span></a>';
  });
  container.innerHTML = html;
}

async function loadStats() {
  try {
    var results = await Promise.all([
      supabase.from('admission_form').select('roll', { count: 'exact', head: true }),
      supabase.from('mcqs').select('id', { count: 'exact', head: true }),
      supabase.from('studentpractice').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('subjects').select('id', { count: 'exact', head: true }),
    ]);

    var counts = results.map(function (r) { return r.count || 0; });
    document.getElementById('statStudents').textContent = counts[0];
    document.getElementById('statMcqs').textContent = counts[1];
    document.getElementById('statTests').textContent = counts[2];
    document.getElementById('statUsers').textContent = counts[3];
    document.getElementById('statSubjects').textContent = counts[4];
  } catch (e) {}
}

async function loadQuoteOfDay() {
  try {
    var { data } = await supabase.from('quotes').select('quote, author').eq('is_active', true);
    if (!data || data.length === 0) return;
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((now - start) / 86400000);
    var q = data[dayOfYear % data.length];
    if (!q) return;
    document.getElementById('quoteText').textContent = q.quote;
    document.getElementById('quoteAuthor').textContent = '— ' + (q.author || 'Unknown');
    document.getElementById('quoteCard').style.display = 'flex';
  } catch (e) {}
}

document.getElementById('logoutBtn').addEventListener('click', async function () {
  await logout();
});

document.getElementById('menuToggle').addEventListener('click', function () {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlayBg').classList.toggle('show');
});
document.getElementById('overlayBg').addEventListener('click', function () {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlayBg').classList.remove('show');
});

boot();
