/* ============================================================
   SÉCULO EXPLORER — Language Toggle (EN / PT)
   ============================================================ */

(function () {
  // All translatable elements have data-en and data-pt attributes
  const translatables = document.querySelectorAll('[data-en]');
  const langBtns      = document.querySelectorAll('.lang-btn');
  const htmlEl        = document.documentElement;

  // ── Apply language ──
  function setLang(lang) {
    // Update all translatable text nodes
    translatables.forEach(function (el) {
      const text = el.dataset[lang];
      if (text !== undefined) {
        el.innerHTML = text;
      }
    });

    // Update html lang attribute
    htmlEl.setAttribute('lang', lang);

    // Update active state on ALL lang buttons (nav + footer)
    langBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Persist preference
    localStorage.setItem('seculo-lang', lang);
  }

  // ── Attach click listeners ──
  langBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setLang(btn.dataset.lang);
    });
  });

  // ── Initialise on page load ──
  const saved = localStorage.getItem('seculo-lang') || 'en';
  const validLangs = ['en', 'pt', 'es'];
  setLang(validLangs.includes(saved) ? saved : 'en');
})();
