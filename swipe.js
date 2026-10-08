// ═══════════════════════════════════════════════════════════
//  HOOPS OS — swipe.js
//  Horizontal swipe navigation between the bottom nav's main tabs
//  (phones only). No libraries.
//
//  How it works:
//  - The tab order is read from the DOM (.nav-btn.nav-main) on every
//    swipe, so tabs added later just work.
//  - A qualifying swipe programmatically clicks the target nav button,
//    so it travels the exact same path as a nav tap (view state,
//    highlighted tab and saves behave identically).
//  - Touch events only: desktop mouse behavior is unchanged.
//  - Swipes are ignored when they start in sideways scrollers, inputs,
//    sliders, or any open sheet / overlay / dialog / menu, and during
//    a live game.
//  - Also: tapping the More sheet's grab handle (.more-handle) collapses
//    the sheet (ui.js owns the sheet but is Claude's lane, so the wiring
//    lives here and mirrors its closeMoreSheet).
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var MIN_DX = 60;   // px of sideways travel to count as a swipe
  var RATIO = 1.4;   // sideways travel must beat vertical by this factor
  var CLICK_SUPPRESS_MS = 350; // swallow the synthetic click after a swipe

  var startX = 0, startY = 0, startTarget = null, tracking = false;
  var suppressClickUntil = 0;

  // Pure gesture -> tab decision, kept separate so the test harness can
  // exercise it without a DOM. Returns the target tab index, or -1.
  function targetIndex(dx, dy, cur, count) {
    var adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx <= MIN_DX) return -1;          // too short to be deliberate
    if (adx < ady * RATIO) return -1;      // not clearly horizontal
    // Swipe left -> the next tab to the right in the nav. Stop at the
    // ends; no wraparound.
    var next = dx < 0 ? cur + 1 : cur - 1;
    if (next < 0 || next >= count) return -1;
    return next;
  }

  function mainTabs() {
    return Array.prototype.slice.call(
      document.querySelectorAll('.nav-btn.nav-main')
    );
  }

  function currentTabIndex(tabs) {
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].classList.contains('on')) return i;
    }
    return -1;
  }

  // True when the touch starts inside anything that scrolls sideways
  // (tables, chip rows, the bracket, ...). Walks up from the target so
  // nested scrollers are caught too.
  function startsInSidewaysScroller(el) {
    var n = el;
    while (n && n !== document.body && n !== document.documentElement) {
      if (n.scrollWidth > n.clientWidth + 1) {
        var ox = n.style && n.style.overflowX;
        if (!ox && window.getComputedStyle) {
          try { ox = window.getComputedStyle(n).overflowX; } catch (e) { ox = ''; }
        }
        if (ox === 'auto' || ox === 'scroll') return true;
      }
      n = n.parentNode;
    }
    return false;
  }

  function startsInField(el) {
    return !!(el && el.closest &&
      el.closest('input, select, textarea, [contenteditable="true"]'));
  }

  // Any open sheet, overlay, dialog, menu, or the live gamecast.
  function overlayOpen() {
    function open(id) {
      var el = document.getElementById(id);
      return !!(el && el.classList.contains('open'));
    }
    if (open('gmod')) return true;        // live gamecast
    if (open('sheet')) return true;       // generic sheet (incl. heads-ups)
    if (open('more-sheet')) return true;  // More menu
    if (document.getElementById('mo-ov')) return true; // move-on dialog
    if (open('play-dropdown')) return true;
    var scrim = document.getElementById('sheet-scrim');
    if (scrim && scrim.classList.contains('on')) return true;
    return false;
  }

  function reduceMotion() {
    return !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Quick, subtle slide on the incoming view. Skipped entirely under
  // prefers-reduced-motion.
  function slideIn(viewName, dir) {
    if (reduceMotion()) return;
    var el = document.getElementById('v-' + viewName);
    if (!el) return;
    var cls = dir < 0 ? 'swipe-in-r' : 'swipe-in-l';
    el.classList.remove('swipe-in-r', 'swipe-in-l');
    void el.offsetWidth; // restart the animation cleanly
    el.classList.add(cls);
    window.setTimeout(function () { el.classList.remove(cls); }, 260);
  }

  function onTouchStart(e) {
    if (!e.touches || e.touches.length !== 1) { tracking = false; return; }
    var t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    startTarget = e.target || null;
    tracking = true;
  }

  function onTouchEnd(e) {
    if (!tracking) return;
    tracking = false;
    if (!e.changedTouches || !e.changedTouches.length) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - startX;
    var dy = t.clientY - startY;

    if (overlayOpen()) return;
    if (startsInField(startTarget)) return;
    if (startsInSidewaysScroller(startTarget)) return;

    var tabs = mainTabs();
    if (tabs.length < 2) return;
    var cur = currentTabIndex(tabs);
    if (cur < 0) return;
    var next = targetIndex(dx, dy, cur, tabs.length);
    if (next < 0) return;

    // Same path as a nav tap: the document-level click delegation in
    // ui.js handles it (view state, highlight, saves unchanged).
    tabs[next].click();
    slideIn(tabs[next].getAttribute('data-view'), dx);

    // The browser fires a synthetic click at the touch point right after
    // touchend; swallow it so the swipe can't also tap whatever is now
    // under the finger on the new tab.
    suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
  }

  function onTouchCancel() { tracking = false; }

  function onClickCapture(e) {
    if (Date.now() < suppressClickUntil) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  // Tapping the More sheet's grab handle collapses the sheet. (ui.js owns
  // the sheet but is Claude's lane; this mirrors its closeMoreSheet.)
  function onHandleTap(e) {
    var t = e.target && e.target.closest ? e.target.closest('#more-sheet .more-handle') : null;
    if (!t) return;
    var sh = document.getElementById('more-sheet');
    var sc = document.getElementById('sheet-scrim');
    if (sh) sh.classList.remove('open');
    if (sc) sc.classList.remove('on');
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });
    // Capture phase so the delegated nav handler in ui.js never sees it.
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('click', onHandleTap);
  }

  // Test hook: the harness exercises targetIndex and the wiring without
  // a real browser.
  if (typeof window !== 'undefined') {
    window.__swipeNav = {
      targetIndex: targetIndex,
      MIN_DX: MIN_DX,
      RATIO: RATIO
    };
  }
})();
