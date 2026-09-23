/* ============================================================
   SÉCULO EXPLORER — Language Toggle (EN / PT / ES)
   ============================================================ */

(function () {
  var currentLang = 'en';
  var validLangs  = ['en', 'pt', 'es'];
  var htmlEl      = document.documentElement;

  // ── Apply translations to DOM (no event fired) — re-queries DOM each time to catch dynamic elements ──
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
  // applyCurrentLang re-aplica las traducciones al DOM recién renderizado SIN disparar el evento.
  // El release del rediseño (084d2ae, 26-ago-2026) lo dejó llamando a setLang(): renderDashGrid →
  // applyCurrentLang → evento → renderDashGrid → … "Maximum call stack size exceeded" y el
  // dashboard en blanco para cualquier usuario con propiedades guardadas (cazado 23-sep-2026).
  window.applyCurrentLang = function () { applyTranslations(currentLang); };

  // ── Initialise on page load ──
  var saved = localStorage.getItem('seculo-lang') || 'en';
  setLang(validLangs.includes(saved) ? saved : 'en');
})();
