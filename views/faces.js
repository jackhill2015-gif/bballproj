// Player faces via facesjs (vendored in vendor/facesjs, Apache-2.0).
// Deterministic: a face is built from a seed hashed from the player's name
// plus class year, so the same player always gets the same face. Nothing is
// stored in the save; faces are generated on demand and memoized in memory.
import { generate } from '../vendor/facesjs/generate.js';
import { display } from '../vendor/facesjs/display.js';

// FNV-1a string hash -> unsigned 32-bit int.
function hashSeed(str) {
  var h = 2166136261 >>> 0;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 seeded PRNG.
function mulberry32(a) {
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hidden staging node: facesjs display() needs a live DOM node for getBBox().
// One shared node, reused for every face, kept off-screen.
var stage = null;
function canRender() {
  return typeof document !== 'undefined'
    && typeof document.createElementNS === 'function'
    && !!document.body;
}
function getStage() {
  if (!stage) {
    stage = document.createElement('div');
    stage.setAttribute('aria-hidden', 'true');
    stage.style.cssText = 'position:absolute;left:-9999px;top:0;width:400px;visibility:hidden;';
    document.body.appendChild(stage);
  }
  return stage;
}

var cache = new Map();

// Full portrait SVG string (400x600: head, shoulders, jersey).
// Returns '' outside a real DOM (e.g. the node test harness) — faces are a
// browser-only enhancement and must never break headless rendering.
function facePortrait(p) {
  if (!canRender()) return '';
  var key = 'full|' + p.name + '|' + (p.cls || 'HS');
  var hit = cache.get(key);
  if (hit) return hit;
  var realRandom = Math.random;
  Math.random = mulberry32(hashSeed(key));
  var face;
  try {
    face = generate(undefined, { gender: 'male' });
    // Hoops OS look: basketball jerseys only, white with black trim, no hats.
    // (Still inside the seeded override, so the pick is deterministic.)
    var BB_JERSEYS = ['jersey', 'jersey2', 'jersey3', 'jersey4', 'jersey5'];
    if (face.jersey) face.jersey.id = BB_JERSEYS[Math.floor(Math.random() * BB_JERSEYS.length)];
    face.teamColors = ['#ffffff', '#000000', '#000000'];
    var acc = face.accessories && face.accessories.id;
    if (acc === 'hat' || acc === 'hat2' || acc === 'hat3' || acc === 'santa-hat') {
      face.accessories.id = 'none';
    }
  } finally {
    Math.random = realRandom;
  }
  var st = getStage();
  st.innerHTML = '';
  display(st, face);
  var svg = st.innerHTML;
  st.innerHTML = '';
  if (cache.size > 600) cache.clear();
  cache.set(key, svg);
  return svg;
}

// Cropped head SVG string, roughly square — for small circular avatars.
// The portrait viewBox is 0 0 400 600; the head sits around x 40-360, y 90-420.
function faceAvatar(p) {
  var key = 'crop|' + p.name + '|' + (p.cls || 'HS');
  var hit = cache.get(key);
  if (hit) return hit;
  var svg = facePortrait(p).replace('viewBox="0 0 400 600"', 'viewBox="40 90 320 330"');
  cache.set(key, svg);
  return svg;
}

// Large face for player pages. Returns an HTML string.
export function playerFaceHTML(p) {
  if (!p || !p.name) return '';
  var svg = facePortrait(p);
  if (!svg) return '';
  return '<div class="pf-face" aria-hidden="true">' + svg + '</div>';
}

// Small circular face for roster rows and portal/recruit pages.
export function playerFaceSmallHTML(p) {
  if (!p || !p.name) return '';
  var svg = faceAvatar(p);
  if (!svg) return '';
  return '<span class="pface" aria-hidden="true">' + svg + '</span>';
}
