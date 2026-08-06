/* ============================================================
   SÉCULO EXPLORER — Navigation JS
   ============================================================ */

(function () {
  const nav    = document.querySelector('.site-nav');
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelectorAll('.nav-links a');

  if (!nav || !toggle) return;

  // ── Hamburger toggle ──
  toggle.addEventListener('click', function () {
    nav.classList.toggle('is-open');
    const isOpen = nav.classList.contains('is-open');
    toggle.setAttribute('aria-expanded', isOpen);
  });

  // ── Close menu when a nav link is clicked ──
  links.forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  // ── Close menu when clicking outside the nav ──
  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target)) {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // ── Scroll: add 'scrolled' class when page scrolled > 20px ──
  function handleScroll() {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // run on load

  // ── IntersectionObserver: scroll-triggered reveals ──
  const animatedEls = document.querySelectorAll('.animate-on-scroll, .rule-draw');

  if (animatedEls.length > 0) {
    // No observer support: reveal everything rather than leaving the page
    // blank, since these elements start at opacity 0.
    if (!('IntersectionObserver' in window)) {
      animatedEls.forEach(function (el) { el.classList.add('in-view'); });
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target); // animate once
          }
        });
      },
      // A threshold alone never fires for elements taller than the viewport,
      // which is common on mobile. Trigger as soon as any part clears the
      // bottom 12% of the screen instead.
      { threshold: 0, rootMargin: '0px 0px -12% 0px' }
    );

    animatedEls.forEach(function (el) {
      observer.observe(el);
    });
  }
})();
