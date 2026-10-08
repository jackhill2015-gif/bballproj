// Swipe navigation (swipe.js): gesture classification and wiring.
// Runs swipe.js in a vm sandbox with stub DOM: no real browser needed.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const DIR = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(DIR, '..', 'swipe.js'), 'utf8');
let fails = 0;
const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

// ── stub DOM ────────────────────────────────────────────────
function makeEnv(opts) {
  opts = opts || {};
  const openIds = opts.openIds || {};   // id -> true when .open/.on
  const clicks = [];
  const listeners = {};

  function cls(initial) {
    const s = new Set(initial || []);
    return {
      add(c) { s.add(c); }, remove(c) { s.delete(c); },
      toggle(c, f) { if (f === undefined) f = !s.has(c); f ? s.add(c) : s.delete(c); },
      contains(c) { return s.has(c); },
    };
  }
  const bodyEl = { scrollWidth: 100, clientWidth: 100, style: {}, parentNode: null, closest: () => null };
  const docEl = { parentNode: null };

  const tabs = (opts.tabs || ['roster', 'schedule', 'dashboard', 'bracket']).map(v => {
    const tab = {
      clicked: 0,
      classList: cls(v === opts.on ? ['on'] : []),
      getAttribute(a) { return a === 'data-view' ? v : null; },
      click() { tab.clicked++; clicks.push(v); },
    };
    return tab;
  });

  function elById(id) {
    elById.cache = elById.cache || {};
    if (elById.cache[id]) return elById.cache[id];
    var el;
    if (id === 'sheet-scrim') el = { classList: cls(openIds[id] ? ['on'] : []), style: {} };
    else if (id === 'mo-ov') el = openIds[id] ? { classList: cls([]) } : null;
    else if (/^v-/.test(id)) el = { classList: cls([]), offsetWidth: 0 };
    else el = { classList: cls(openIds[id] ? ['open'] : []), style: {}, offsetHeight: 360 };
    elById.cache[id] = el;
    return el;
  }

  const document = {
    body: bodyEl, documentElement: docEl,
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push({ f }); },
    querySelectorAll(sel) { return sel === '.nav-btn.nav-main' ? tabs : []; },
    getElementById: elById,
  };
  const window = {
    matchMedia() { return { matches: !!opts.reduceMotion }; },
    getComputedStyle() { return { overflowX: 'visible' }; },
    setTimeout(fn) { timers.push(fn); return timers.length; },
  };
  const timers = [];
  // default touch target: plain content, no scroller, no fields
  function target(o) {
    o = o || {};
    return {
      scrollWidth: o.w || 100, clientWidth: o.cw || 100,
      style: { overflowX: o.ox || '' },
      parentNode: bodyEl,
      closest(sel) {
        if (o.input && /input|select|textarea/.test(sel)) return {};
        if (o.handle && /more-handle/.test(sel)) return {};
        return null;
      },
    };
  }
  return { document, window, listeners, clicks, tabs, target, cls, timers,
    runTimers() { const t = timers.splice(0); t.forEach(fn => fn()); } };
}

function load(env) {
  const sandbox = { document: env.document, window: env.window, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'swipe.js' });
  return sandbox.window.__swipeNav;
}

function touch(env, x0, y0, x1, y1, targetEl) {
  const t = targetEl || env.target();
  env.listeners.touchstart[0].f({ touches: [{ clientX: x0, clientY: y0 }], target: t });
  env.listeners.touchend[0].f({ changedTouches: [{ clientX: x1, clientY: y1 }] });
}

// ── 1. pure gesture classification ──────────────────────────
{
  const env = makeEnv();
  const nav = load(env);
  check(!!nav, 'swipe.js loads and exposes test hook');
  const ti = nav.targetIndex;
  check(ti(-70, 5, 1, 4) === 2, 'swipe left -> next tab right');
  check(ti(70, 5, 1, 4) === 0, 'swipe right -> previous tab');
  check(ti(-70, 5, 3, 4) === -1, 'stops at the right end');
  check(ti(70, 5, 0, 4) === -1, 'stops at the left end');
  check(ti(-60, 0, 1, 4) === -1, 'exactly 60px is not enough');
  check(ti(-61, 0, 1, 4) === 2, '61px counts');
  check(ti(-70, 60, 1, 4) === -1, 'mostly-vertical swipe ignored');
  check(ti(-100, 60, 1, 4) === 2, 'clearly-horizontal diagonal counts');
  check(ti(-70, 5, 0, 1) === -1, 'single tab: nothing to do');
  check(ti(0, 0, 1, 4) === -1, 'tap is not a swipe');
}

// ── 2. wiring: tab changes go through the nav button click ──
{
  const env = makeEnv({ on: 'schedule' });
  load(env);
  touch(env, 200, 300, 120, 305); // dx=-80: schedule -> dashboard
  check(env.clicks.join() === 'dashboard', 'swipe left clicks the dashboard nav button');
  const env2 = makeEnv({ on: 'schedule' });
  load(env2);
  touch(env2, 120, 300, 200, 295); // dx=+80: schedule -> roster
  check(env2.clicks.join() === 'roster', 'swipe right clicks the roster nav button');
}

// ── 3. negative cases: nothing misfires ─────────────────────
function noClick(name, setup) {
  const env = makeEnv(setup);
  load(env);
  setup.fire(env);
  check(env.clicks.length === 0, name);
}
noClick('short swipe (<60px) does nothing', { on: 'schedule', fire: e => touch(e, 200, 300, 160, 300) });
noClick('vertical scroll does nothing', { on: 'schedule', fire: e => touch(e, 200, 300, 190, 600) });
noClick('end stop: swipe left on Bracket', { on: 'bracket', fire: e => touch(e, 200, 300, 100, 300) });
noClick('end stop: swipe right on Roster', { on: 'roster', fire: e => touch(e, 100, 300, 200, 300) });
noClick('open live gamecast blocks swipe', { on: 'schedule', openIds: { gmod: true }, fire: e => touch(e, 200, 300, 100, 300) });
noClick('open sheet blocks swipe', { on: 'schedule', openIds: { sheet: true }, fire: e => touch(e, 200, 300, 100, 300) });
noClick('open More menu blocks swipe', { on: 'schedule', openIds: { 'more-sheet': true }, fire: e => touch(e, 200, 300, 100, 300) });
noClick('move-on dialog blocks swipe', { on: 'schedule', openIds: { 'mo-ov': true }, fire: e => touch(e, 200, 300, 100, 300) });
noClick('swipe starting in an input is ignored', { on: 'schedule', fire: e => touch(e, 200, 300, 100, 300, e.target({ input: true })) });
noClick('swipe starting in a sideways scroller is ignored', { on: 'schedule', fire: e => touch(e, 200, 300, 100, 300, e.target({ w: 600, cw: 300, ox: 'auto' })) });

// ── 4. the synthetic click after a swipe is swallowed ────────
{
  const env = makeEnv({ on: 'schedule' });
  load(env);
  touch(env, 200, 300, 120, 305); // triggers the tab change
  check(env.clicks.join() === 'dashboard', 'swipe changed the tab first');
  const ev = { stopped: false, prevented: false, stopPropagation() { ev.stopped = true; }, preventDefault() { ev.prevented = true; } };
  env.listeners.click[0].f(ev);
  check(ev.stopped && ev.prevented, 'post-swipe synthetic click is swallowed in capture phase');
}

// ── 5. reduced motion: tab still changes, no animation crash ─
{
  const env = makeEnv({ on: 'schedule', reduceMotion: true });
  load(env);
  touch(env, 200, 300, 120, 305);
  check(env.clicks.join() === 'dashboard', 'reduced motion still switches tabs');
}

// ── 6. tapping the More sheet handle collapses it ───────────
{
  const env = makeEnv({ openIds: { 'more-sheet': true, 'sheet-scrim': true } });
  load(env);
  const handle = env.target({ handle: true });
  env.listeners.click.forEach(l => l.f({ target: handle }));
  check(!env.document.getElementById('more-sheet').classList.contains('open'), 'handle tap removes open from more-sheet');
  check(!env.document.getElementById('sheet-scrim').classList.contains('on'), 'handle tap removes on from scrim');
}
{
  const env = makeEnv({ openIds: { 'more-sheet': true, 'sheet-scrim': true } });
  load(env);
  env.listeners.click.forEach(l => l.f({ target: env.target() }));
  check(env.document.getElementById('more-sheet').classList.contains('open'), 'tap outside the handle leaves the sheet open');
}

// ── 7. drag the handle down to dismiss ──────────────────────
function dragSeq(env, y0, yMove, yEnd) {
  const handle = env.target({ handle: true });
  const mk = (type, y) => type === 'touchmove'
    ? { touches: [{ clientX: 195, clientY: y }], cancelable: true, preventDefault() {} }
    : type === 'touchstart'
      ? { touches: [{ clientX: 195, clientY: y }], target: handle }
      : { changedTouches: [{ clientX: 195, clientY: y }] };
  const fire = (type, y) => env.listeners[type].forEach(l => l.f(mk(type, y)));
  fire('touchstart', y0);
  if (yMove !== null) fire('touchmove', yMove);
  const sh = env.document.getElementById('more-sheet');
  const scrim = env.document.getElementById('sheet-scrim');
  fire('touchend', yEnd);
  return { sh, scrim };
}
{
  // long drag: sheet follows the finger, then closes
  const env = makeEnv({ openIds: { 'more-sheet': true, 'sheet-scrim': true } });
  load(env);
  const handle = env.target({ handle: true });
  env.listeners.touchstart.forEach(l => l.f({ touches: [{ clientX: 195, clientY: 300 }], target: handle }));
  env.listeners.touchmove.forEach(l => l.f({ touches: [{ clientX: 195, clientY: 500 }], cancelable: true, preventDefault() {} }));
  const sh = env.document.getElementById('more-sheet');
  const scrim = env.document.getElementById('sheet-scrim');
  check(sh.style.transform === 'translateY(200px)', 'sheet follows the finger while dragging');
  check(parseFloat(scrim.style.opacity) < 1, 'scrim fades while dragging');
  env.listeners.touchend.forEach(l => l.f({ changedTouches: [{ clientX: 195, clientY: 500 }] }));
  check(sh.classList.contains('open'), 'sheet still open until the close animation finishes');
  env.runTimers();
  check(!sh.classList.contains('open'), 'drag past threshold closes the sheet');
  check(!scrim.classList.contains('on'), 'drag past threshold hides the scrim');
  check(sh.style.transform === '', 'inline styles cleaned up after close');
  check(env.clicks.length === 0, 'drag never triggers a tab change');
}
{
  // short drag: springs back open
  const env = makeEnv({ openIds: { 'more-sheet': true, 'sheet-scrim': true } });
  load(env);
  const { sh, scrim } = dragSeq(env, 300, 330, 330); // dy=30: under threshold, too short to flick
  check(sh.classList.contains('open'), 'short drag leaves the sheet open');
  check(scrim.classList.contains('on'), 'short drag leaves the scrim on');
  env.runTimers();
  check(sh.style.transform === '', 'sheet snaps back (transform cleared)');
}
{
  // upward drag: nothing
  const env = makeEnv({ openIds: { 'more-sheet': true, 'sheet-scrim': true } });
  load(env);
  const { sh } = dragSeq(env, 300, 200, 200);
  check(!sh.style.transform, 'upward drag does not move the sheet');
  check(sh.classList.contains('open'), 'sheet stays open after upward drag');
}
{
  // drag with the sheet closed: nothing
  const env = makeEnv({});
  load(env);
  const { sh } = dragSeq(env, 300, 500, 500);
  check(!sh.classList.contains('open'), 'drag with closed sheet does nothing');
  check(!sh.style.transform, 'no transform applied when sheet is closed');
}
{
  // reduced motion: closes immediately, no animation
  const env = makeEnv({ openIds: { 'more-sheet': true, 'sheet-scrim': true }, reduceMotion: true });
  load(env);
  const { sh, scrim } = dragSeq(env, 300, 500, 500);
  check(!sh.classList.contains('open'), 'reduced motion drag closes the sheet');
  check(!scrim.classList.contains('on'), 'reduced motion drag hides the scrim');
}

if (fails) { console.log(fails + ' FAILURES'); process.exit(1); }
console.log('swipe tests pass');
