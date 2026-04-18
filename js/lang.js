/* ============================================================
   SÉCULO EXPLORER — Language Toggle (EN / PT / ES)
   ============================================================ */

(function () {
  var currentLang = 'en';
  var validLangs  = ['en', 'pt', 'es'];
  var htmlEl      = document.documentElement;

  // ── Apply translations to DOM (no event fired) ──
  function applyTranslations(lang) {
    document.querySelectorAll('[data-en]').forEach(function (el) {
      var text = el.dataset[lang];
      if (text !== undefined) el.innerHTML = text;
    });

    htmlEl.setAttribute('lang', lang);

    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  }

  // ── Apply language + fire event (only for user-triggered changes) ──
  function setLang(lang) {
    if (!validLangs.includes(lang)) lang = 'en';
    currentLang = lang;
    localStorage.setItem('seculo-lang', lang);
    applyTranslations(lang);
    document.dispatchEvent(new CustomEvent('seculo-lang-change', { detail: { lang: lang } }));
  }

  // ── Attach click listeners ──
  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { setLang(btn.dataset.lang); });
  });

  // ── Public API ──
  window.getCurrentLang  = function () { return currentLang; };
  // applyCurrentLang re-applies translations to newly rendered DOM WITHOUT firing the event
  // (avoids infinite loop: renderDashGrid → applyCurrentLang → event → renderDashGrid)
  window.applyCurrentLang = function () { applyTranslations(currentLang); };

  // ── Initialise on page load ──
  var saved = localStorage.getItem('seculo-lang') || 'en';
  setLang(validLangs.includes(saved) ? saved : 'en');
})();
