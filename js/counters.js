/* ============================================================
   SÉCULO EXPLORER — Number count-up
   ------------------------------------------------------------
   Any element with data-count-to counts from zero to that value
   the first time it scrolls into view.

     <span data-count-to="98" data-count-suffix="%+">98%+</span>

   Optional attributes:
     data-count-suffix   text pinned after the number ("%+")
     data-count-prefix   text pinned before it
     data-count-ms       duration override in milliseconds

   The markup always holds the final value, so if this script never
   runs the correct number is already on the page.
   ============================================================ */

(function () {
  'use strict';

  var DEFAULT_MS = 1900;

  var els = document.querySelectorAll('[data-count-to]');
  if (!els.length) return;

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function render(el, value) {
    var prefix = el.getAttribute('data-count-prefix') || '';
    var suffix = el.getAttribute('data-count-suffix') || '';
    el.textContent = prefix + value + suffix;
  }

  // Decelerating curve — fast off the mark, easing into the final number,
  // which reads as settling rather than stopping dead.
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function run(el) {
    var target = parseFloat(el.getAttribute('data-count-to'));
    if (isNaN(target)) return;

    var duration = parseInt(el.getAttribute('data-count-ms'), 10) || DEFAULT_MS;
    var start    = null;

    // Hold the width the final value will occupy, so the surrounding layout
    // does not jitter as the digit count grows during the count.
    el.style.minWidth = el.getBoundingClientRect().width + 'px';
    el.style.display  = 'inline-block';

    render(el, 0);

    function frame(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / duration, 1);
      render(el, Math.round(easeOut(t) * target));
      if (t < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  // No observer support, or motion is unwelcome: leave the final values as
  // authored in the markup.
  if (reduced || !('IntersectionObserver' in window)) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);   // count once
      run(entry.target);
    });
  }, { threshold: 0.4 });

  // A counter in the hero is already inside the viewport on load, but the
  // hero is still transparent behind the intro curtain. Observing straight
  // away would run the whole count before anyone could see it, so wait for
  // the container's reveal animation to finish first.
  function observeWhenRevealed(el) {
    var revealed = el.closest('.hero-content > *');

    if (revealed && getComputedStyle(revealed).opacity === '0') {
      revealed.addEventListener('animationend', function () {
        observer.observe(el);
      }, { once: true });
      return;
    }

    observer.observe(el);
  }

  els.forEach(observeWhenRevealed);
})();
