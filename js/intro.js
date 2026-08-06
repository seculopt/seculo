/* ============================================================
   SÉCULO EXPLORER — Intro curtain
   ------------------------------------------------------------
   The curtain lifts on a pure CSS animation (see animations.css),
   so this script is an optimisation, never a dependency: if it
   fails to load, the page still reveals itself on time.

   What it adds:
     - skips the curtain on repeat visits within a session
     - skips it for anyone who prefers reduced motion
     - drops the hero's start offset whenever the curtain is skipped
     - stops the page scrolling underneath while it is up
   ============================================================ */

(function () {
  'use strict';

  var SESSION_KEY = 'seculo-intro-played';
  var TOTAL_MS    = 2650;   // .js .intro delay (1.75s) + duration (0.9s)

  var root  = document.documentElement;
  var intro = document.querySelector('.intro');

  // Hero rises immediately rather than waiting out a curtain that is not there.
  function skip() {
    root.classList.add('intro-skip');
  }

  function remove() {
    if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
  }

  // No curtain on this page at all.
  if (!intro) {
    skip();
    return;
  }

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var seen = false;
  try {
    seen = sessionStorage.getItem(SESSION_KEY) === '1';
  } catch (e) {
    // Private mode or storage disabled — treat as a first visit and play once.
    seen = false;
  }

  if (reduced || seen) {
    remove();
    skip();
    return;
  }

  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch (e) { /* non-fatal */ }

  // body may not exist yet depending on where this script is placed.
  function lock() { document.body.classList.add('intro-active'); }

  if (document.body) lock();
  else document.addEventListener('DOMContentLoaded', lock);

  setTimeout(function () {
    document.body.classList.remove('intro-active');
    remove();
  }, TOTAL_MS);
})();
