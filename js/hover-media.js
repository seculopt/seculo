/* ============================================================
   SÉCULO EXPLORER — Cursor-following photo
   ------------------------------------------------------------
   On a list marked [data-hover-media], hovering a row reveals a
   photo that follows the cursor.

   Each row supplies its own photo through the --img custom
   property, set in the PHOTO PICKER block in index.html — so
   swapping these photos stays a one-line CSS edit like every
   other slot, with no filenames buried in the markup here.

   Pointer devices only, and skipped entirely under reduced
   motion. The section reads perfectly well without it.
   ============================================================ */

(function () {
  'use strict';

  var lists = document.querySelectorAll('[data-hover-media]');
  if (!lists.length) return;

  var fine = window.matchMedia &&
             window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!fine || reduced) return;

  lists.forEach(function (list) {
    var rows = list.querySelectorAll('li');
    if (!rows.length) return;

    var el = document.createElement('div');
    el.className = 'hover-media';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);

    // Target position is where the cursor is; current position chases it,
    // which is what gives the photo its drift rather than sticking rigidly
    // to the pointer.
    var targetX = 0, targetY = 0;
    var currentX = 0, currentY = 0;
    var raf = null;
    var active = false;

    function loop() {
      // Ease toward the cursor. 0.12 is slow enough to read as a glide and
      // fast enough not to feel laggy.
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      el.style.left = currentX + 'px';
      el.style.top  = currentY + 'px';

      if (active || Math.abs(targetX - currentX) > 0.5 ||
                    Math.abs(targetY - currentY) > 0.5) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }

    function start() {
      if (!raf) raf = requestAnimationFrame(loop);
    }

    rows.forEach(function (row) {
      row.addEventListener('mouseenter', function () {
        // Read the photo from the row's own --img, so the picker block
        // remains the single place photos are chosen.
        var img = getComputedStyle(row).getPropertyValue('--img').trim();
        if (!img || img === 'none') return;

        el.style.backgroundImage = img;
        active = true;
        list.classList.add('is-hovering');
        el.classList.add('is-active');
        start();
      });
    });

    list.addEventListener('mousemove', function (e) {
      targetX = e.clientX;
      targetY = e.clientY;

      // Jump straight to the cursor on the first move of a hover, otherwise
      // the photo flies in from wherever it was last left.
      if (!el.classList.contains('is-active')) {
        currentX = targetX;
        currentY = targetY;
      }
      start();
    });

    list.addEventListener('mouseleave', function () {
      active = false;
      list.classList.remove('is-hovering');
      el.classList.remove('is-active');
    });
  });
})();
