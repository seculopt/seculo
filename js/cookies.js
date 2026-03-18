/* ============================================================
   SÉCULO EXPLORER — Cookie Consent Banner
   GDPR-compliant | EN / PT bilingual
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'seculo-consent';

  // Already decided — just expose the API and exit
  if (localStorage.getItem(STORAGE_KEY)) {
    exposeAPI();
    return;
  }

  var lang = localStorage.getItem('seculo-lang') || 'en';

  var i18n = {
    en: {
      message: 'We use essential cookies to keep you logged in and process payments securely. With your consent, we also use analytics and functional cookies.',
      acceptAll: 'Accept All',
      essential: 'Essential Only',
      policy: 'Cookie Policy'
    },
    pt: {
      message: 'Utilizamos cookies essenciais para manter a sua sessão e processar pagamentos em segurança. Com o seu consentimento, utilizamos também cookies funcionais e de análise.',
      acceptAll: 'Aceitar Todos',
      essential: 'Apenas Essenciais',
      policy: 'Política de Cookies'
    }
  };

  var t = i18n[lang] || i18n.en;

  // ── Inject banner styles ──
  var css = document.createElement('style');
  css.textContent = [
    '#seculo-cookie-banner{',
      'position:fixed;bottom:0;left:0;right:0;z-index:9999;',
      'background:#191927;border-top:2px solid #C8A96E;',
      'padding:16px 24px;',
    '}',
    '#seculo-cookie-banner .cb-inner{',
      'max-width:1200px;margin:0 auto;',
      'display:flex;align-items:center;justify-content:space-between;',
      'gap:20px;flex-wrap:wrap;',
    '}',
    '#seculo-cookie-banner .cb-text{',
      'color:rgba(255,255,255,0.75);font-size:0.875rem;line-height:1.6;',
      'flex:1;min-width:180px;',
      'font-family:"DM Sans",sans-serif;',
    '}',
    '#seculo-cookie-banner .cb-text a{color:#C8A96E;text-decoration:underline;}',
    '#seculo-cookie-banner .cb-actions{display:flex;gap:10px;flex-shrink:0;}',
    '#seculo-cookie-banner .cb-btn{',
      'padding:9px 20px;border-radius:4px;',
      'font-family:"DM Sans",sans-serif;font-size:0.875rem;font-weight:500;',
      'cursor:pointer;transition:opacity 0.2s,border-color 0.2s,color 0.2s;',
    '}',
    '#seculo-cookie-banner .cb-essential{',
      'background:transparent;',
      'border:1.5px solid rgba(255,255,255,0.3);',
      'color:rgba(255,255,255,0.65);',
    '}',
    '#seculo-cookie-banner .cb-essential:hover{',
      'border-color:#C8A96E;color:#fff;',
    '}',
    '#seculo-cookie-banner .cb-accept{',
      'background:#C8A96E;border:1.5px solid #C8A96E;',
      'color:#191927;font-weight:600;',
    '}',
    '#seculo-cookie-banner .cb-accept:hover{opacity:0.85;}',
    '@media(max-width:600px){',
      '#seculo-cookie-banner .cb-inner{flex-direction:column;align-items:flex-start;}',
    '}'
  ].join('');
  document.head.appendChild(css);

  // ── Build banner HTML ──
  var banner = document.createElement('div');
  banner.id = 'seculo-cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.innerHTML =
    '<div class="cb-inner">' +
      '<p class="cb-text">' +
        t.message + ' <a href="cookie-policy.html">' + t.policy + '</a>' +
      '</p>' +
      '<div class="cb-actions">' +
        '<button class="cb-btn cb-essential">' + t.essential + '</button>' +
        '<button class="cb-btn cb-accept">' + t.acceptAll + '</button>' +
      '</div>' +
    '</div>';

  function dismiss(value) {
    localStorage.setItem(STORAGE_KEY, value);
    banner.remove();
    exposeAPI();
  }

  function inject() {
    document.body.appendChild(banner);
    banner.querySelector('.cb-accept').addEventListener('click', function () {
      dismiss('all');
    });
    banner.querySelector('.cb-essential').addEventListener('click', function () {
      dismiss('essential');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  // ── Public API ──
  // Usage: if (window.seculo && window.seculo.hasConsent('analytics')) { ... }
  function exposeAPI() {
    window.seculo = window.seculo || {};
    window.seculo.hasConsent = function (type) {
      var c = localStorage.getItem(STORAGE_KEY);
      if (!c) return false;
      if (type === 'essential') return true;
      return c === 'all'; // analytics, functional
    };
  }
})();
