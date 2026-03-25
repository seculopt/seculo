// utm.js — capture UTM params from URL and persist in localStorage
// Include in any seculopt.com page that is a possible landing destination.
// Other scripts (auth-register.js, etc.) read from window.SECULO_UTM.

(function () {
  var p = new URLSearchParams(window.location.search);
  var utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
    if (p.get(k)) utm[k] = p.get(k);
  });

  // If no UTMs in URL, restore from localStorage (return visitor)
  if (!Object.keys(utm).length) {
    try { utm = JSON.parse(localStorage.getItem('seculo_utm') || '{}'); } catch (e) {}
  } else {
    localStorage.setItem('seculo_utm', JSON.stringify(utm));
  }

  window.SECULO_UTM = utm;
})();
