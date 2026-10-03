// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/strategy.js
//  Gameplan: offensive and defensive scheme, shown as a panel on
//  the Roster screen (the separate Strategy screen was retired —
//  rotation lives in the depth chart, and per-player usage sliders
//  were dropped as too fiddly).
// ═══════════════════════════════════════════════════════════

import { G, saveState } from '../state.js';
import { toast } from '../ui.js';

// Display name → the sim's scheme key (simulation.js reads t.strat.off / .def)
var OFFENSE = [
  { name: 'Balanced', key: 'balanced', desc: 'Even mix of inside and outside shots.' },
  { name: 'Motion', key: 'motion', desc: 'Ball movement; shots spread across the lineup.' },
  { name: 'Drive', key: 'drive', desc: 'Runs through your point guard; attacks the rim and draws fouls.' },
  { name: 'Set', key: 'set', desc: 'Slow pace; feeds the post.' },
  { name: 'Early', key: 'early', desc: 'Fast pace; heavy on threes.' }
];
var DEFENSE = [
  { name: 'Man-to-man', key: 'man', desc: 'Standard defense, no special strengths or weaknesses.' },
  { name: '2-3 zone', key: '2-3', desc: 'Protects the paint; gives up more open threes.' },
  { name: '3-2 zone', key: '3-2', desc: 'Contests threes; softer inside.' },
  { name: '1-3-1 zone', key: '1-3-1', desc: 'Pressures ball handlers into turnovers.' },
  { name: 'Box-and-one', key: 'box1', desc: "Shadows the opponent's best scorer." }
];

function ensureStrat(t) {
  if (!t.strat) t.strat = {};
  if (!t.strat.off) t.strat.off = 'balanced';
  if (!t.strat.def) t.strat.def = 'man';
  if (t.strat.def === 'zone') t.strat.def = '2-3';
  if (t.strat.def === 'box') t.strat.def = 'box1';
  // Usage sliders are gone: clear any old per-player overrides so nothing
  // invisible keeps shaping shot distribution (missing = neutral in the sim).
  (t.rost || []).forEach(function(p) { if (p.usage !== undefined) delete p.usage; });
}

// One compact dropdown per side, with a one-line description under it
function group(list, kind, current) {
  var cur = list.find(function(x) { return x.key === current; }) || list[0];
  var h = '<div class="gp-col"><label class="gp-lbl" for="gp-' + kind + '">' + (kind === 'off' ? 'Offense' : 'Defense') + '</label>'
    + '<select class="sel" id="gp-' + kind + '" data-gpsel="' + kind + '">';
  list.forEach(function(x) {
    h += '<option value="' + x.key + '"' + (x.key === cur.key ? ' selected' : '') + '>' + x.name + '</option>';
  });
  return h + '</select><div class="gp-desc">' + cur.desc + '</div></div>';
}

export function gameplanPanelHTML() {
  var t = G.teams[G.tid];
  if (!t) return '';
  ensureStrat(t);
  return '<div class="panel" id="gameplan"><div class="panel-h"><span>Gameplan</span><small>Applies from your next game</small></div><div class="panel-b">'
    + '<div class="gp-row">' + group(OFFENSE, 'off', t.strat.off) + group(DEFENSE, 'def', t.strat.def) + '</div></div></div>';
}

// Dropdown change → returns true when the gameplan changed (caller re-renders)
export function handleGameplanChange(target) {
  var kind = target && target.getAttribute && target.getAttribute('data-gpsel');
  if (!kind) return false;
  var t = G.teams[G.tid];
  ensureStrat(t);
  var list = kind === 'off' ? OFFENSE : DEFENSE;
  var pick = list.find(function(x) { return x.key === target.value; });
  if (!pick) return false;
  t.strat[kind] = pick.key;
  saveState();
  toast((kind === 'off' ? 'Offense' : 'Defense') + ' set to ' + pick.name.toLowerCase());
  return true;
}

// Returns true if the click was a gameplan pick (caller re-renders).
export function handleGameplanClick(target) {
  var b = target.closest ? target.closest('[data-gp]') : null;
  if (!b) return false;
  var t = G.teams[G.tid];
  ensureStrat(t);
  var kind = b.getAttribute('data-gp'), key = b.getAttribute('data-gpkey');
  var list = kind === 'off' ? OFFENSE : DEFENSE;
  var pick = list.find(function(x) { return x.key === key; });
  if (!pick) return false;
  t.strat[kind] = key;
  saveState();
  toast((kind === 'off' ? 'Offense' : 'Defense') + ' set to ' + pick.name.toLowerCase());
  return true;
}

// Kept for older imports: the Strategy route now shows the roster screen.
export function renderStrategy() {
  if (typeof window !== 'undefined' && window.navTo) window.navTo('roster');
}
