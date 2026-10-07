// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/tips.js
//  First-time tips: short, dismissable cards shown once each for a new
//  player. Dismissals live in ui-prefs ("hoops_os_ui", tips section) —
//  never in the game save. Injected by ui.js at the end of refreshView(),
//  so no view file needs to know about tips (recruiting.js stays untouched).
//  Tips render in-flow at the top of the content: they push content down
//  and can never cover the Play button or the bottom nav.
// ═══════════════════════════════════════════════════════════
import { G } from '../state.js';
import { getUiPrefs, setUiPrefs } from './ui-prefs.js';

// One or two sentences each. Plain staff voice: say what the screen does.
var TIPS = {
  home: 'Sim game plays your next game instantly. Your next opponent is in the Next game panel.',
  roster: 'Auto-manage keeps your best healthy players starting and resets minutes each week. Turn it off to set the lineup yourself.',
  offseason: 'The strip at the top tracks the offseason order. Departures, portal, recruiting and signing day happen in that order.',
  recruiting: 'Open spots are in the header. You can pursue one player per open spot, and your percentage is the real chance he signs on signing day.'
};

function tipHTML(key) {
  return '<div class="tip-card" data-tipcard="' + key + '">'
    + '<div class="tip-text">' + TIPS[key] + '</div>'
    + '<button class="btn-quiet tip-gotit" data-action="tip-dismiss" data-tip="' + key + '">Got it</button>'
    + '</div>';
}

// Called by ui.js refreshView() after the view renders (renderers replace
// innerHTML, so a tip injected here survives until the next re-render).
export function injectTips(view) {
  var prefs;
  try { prefs = getUiPrefs('tips'); } catch (e) { return; }
  var keys = [], target = null, afterStrip = false;
  if (view === 'dashboard' && prefs.home) {
    keys = ['home']; target = 'dash-content';
  } else if (view === 'roster' && prefs.roster) {
    keys = ['roster']; target = 'roster-content';
  } else if (view === 'offseason') {
    if (prefs.offseason) keys.push('offseason');
    if (prefs.recruiting && G && G.offseasonStep === 'recruiting') keys.push('recruiting');
    target = 'offseason-content'; afterStrip = true;
  }
  if (!keys.length || !target || typeof document === 'undefined') return;
  var host = document.getElementById(target);
  if (!host) return;
  var already = keys.some(function(k) { return !!host.querySelector('[data-tipcard="' + k + '"]'); });
  if (already) return;
  var html = keys.map(function(k) { return tipHTML(k); }).join('');
  if (afterStrip) {
    var strip = host.querySelector('.os-strip');
    if (strip) { strip.insertAdjacentHTML('afterend', html); return; }
  }
  host.insertAdjacentHTML('afterbegin', html);
}

export function dismissTip(key) {
  if (!TIPS.hasOwnProperty(key)) return;
  var cur = getUiPrefs('tips');
  cur[key] = false;
  setUiPrefs('tips', cur);
}

export function resetTips() {
  setUiPrefs('tips', { home: true, roster: true, offseason: true, recruiting: true });
}
