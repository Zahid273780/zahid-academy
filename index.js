(function () {
  var y = document.getElementById('yearSpan');
  if (y) y.textContent = new Date().getFullYear();

  var useGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  if (useGSAP) {
    gsap.registerPlugin(ScrollTrigger);

    var heroWrap = document.getElementById('hero-visual-wrap');
    var heroLeft = document.getElementById('hero-left');
    var topStrip = document.querySelector('.top-strip-inner');
    if (topStrip) {
      gsap.from(topStrip, { opacity: 0, x: -40, duration: 0.8, ease: 'power3.out' });
    }
    if (heroLeft) {
      gsap.from(heroLeft, { opacity: 0, x: -50, duration: 0.9, ease: 'power3.out' });
    }
    if (heroWrap) {
      gsap.from(heroWrap, { opacity: 0, x: 50, duration: 0.9, ease: 'power3.out' });
      gsap.to(heroWrap, {
        y: 60,
        scale: 0.94,
        ease: 'none',
        scrollTrigger: {
          trigger: document.querySelector('.hero'),
          start: 'top top',
          end: 'bottom top',
          scrub: 1
        }
      });
    }

    gsap.utils.toArray('.section-title').forEach(function (el) {
      gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 85%' }, opacity: 0, y: 24, duration: 0.6, ease: 'power2.out' });
    });
    gsap.utils.toArray('.section-desc').forEach(function (el) {
      gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 85%' }, opacity: 0, y: 20, duration: 0.5, delay: 0.1, ease: 'power2.out' });
    });
    gsap.utils.toArray('.plan-item').forEach(function (el, i) {
      gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 92%' }, opacity: 0, y: 24, duration: 0.5, delay: i * 0.06, ease: 'power2.out' });
    });
  } else {
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) entry.target.classList.add('animate-in');
        });
      }, { rootMargin: '0px 0px -80px 0px', threshold: 0.1 });
      var basicPlan = document.getElementById('basic-plan');
      if (basicPlan) observer.observe(basicPlan);
    } else {
      var basicPlan = document.getElementById('basic-plan');
      if (basicPlan) basicPlan.classList.add('animate-in');
    }
    var hero = document.getElementById('hero-visual');
    var wrap = document.getElementById('hero-visual-wrap');
    if (hero && wrap) {
      function updateHeroScroll() {
        var rect = hero.getBoundingClientRect();
        var vh = window.innerHeight;
        var progress = rect.top < vh && rect.bottom > 0 ? Math.max(0, Math.min(1, -rect.top / (rect.height * 0.6))) : (rect.bottom <= 0 ? 1 : 0);
        wrap.style.transform = 'translateY(' + progress * 60 + 'px) scale(' + (1 - progress * 0.06) + ')';
      }
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (!ticking) requestAnimationFrame(function () { updateHeroScroll(); ticking = false; });
        ticking = true;
      }, { passive: true });
      window.addEventListener('resize', updateHeroScroll);
      updateHeroScroll();
    }
  }

  document.querySelectorAll('.btn-ripple').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      var rect = btn.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.style.width = ripple.style.height = '20px';
      ripple.style.marginLeft = ripple.style.marginTop = '-10px';
      btn.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 600);
    });
  });

  document.querySelectorAll('.magnetic-btn').forEach(function (btn) {
    if (!useGSAP) return;
    btn.addEventListener('mouseenter', function () { gsap.to(btn, { scale: 1.05, duration: 0.2, ease: 'power2.out' }); });
    btn.addEventListener('mouseleave', function () { gsap.to(btn, { x: 0, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' }); });
    btn.addEventListener('mousemove', function (e) {
      var rect = btn.getBoundingClientRect();
      var x = (e.clientX - rect.left - rect.width / 2) * 0.15;
      var y = (e.clientY - rect.top - rect.height / 2) * 0.15;
      gsap.to(btn, { x: x, y: y, duration: 0.2, ease: 'power2.out' });
    });
  });
})();

