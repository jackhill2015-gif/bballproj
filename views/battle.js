// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/battle.js
//  Unified 3-stage acquisition engine. Drives BOTH the transfer
//  portal (NIL offers) and HS recruiting (recruiting points)
//  through the same battle rhythm:
//    Round 1 "Initial offers" — concentrate or spread offers
//    Round 2 "Follow-up"      — odds have moved: raise, hold or
//                               withdraw (75% refund)
//    Round 3 "Decision day"   — final adjustments, then everyone
//                               decides (+ late entries if thin)
//  Pure logic + tiny shared render helpers. No DOM dependencies.
// ═══════════════════════════════════════════════════════════

export var ACQ_STAGES = [
  { name: 'Initial offers', tag: 'Round 1 of 3',
    desc: 'Make offers. Commit heavily to a few players or spread offers across many.',
    btn: 'Close initial offers', decideFrac: 0.30 },
  { name: 'Follow-up', tag: 'Round 2 of 3',
    desc: 'Odds have moved. Raise offers, hold, or withdraw (withdrawing refunds 75%).',
    btn: 'Close follow-ups', decideFrac: 0.60 },
  { name: 'Decision day', tag: 'Round 3 of 3',
    desc: 'Last chance to adjust offers. Players commit when you finalize.',
    btn: 'Finalize transfers', decideFrac: 1.00 }
];

export function stageOf(idx) {
  return ACQ_STAGES[Math.max(0, Math.min(2, idx || 0))];
}

// Fraction of committed resources refunded when pulling out of a battle
// after the Open stage — the rest is sunk. Pivoting has a cost.
export var PIVOT_REFUND = 0.75;

// ── Trends: this stage's % vs last stage's ──
export function trendFor(pct, prevPct) {
  if (prevPct === undefined || prevPct === null || typeof prevPct !== 'number')
    return { arrow: '', word: 'New', cls: 'var(--txt3)' };
  if (pct < 20) return { arrow: '', word: 'Long shot', cls: 'var(--red)' };
  var d = pct - prevPct;
  if (d >= 8) return { arrow: '▲', word: 'Gaining', cls: 'var(--grn2)' };
  if (d <= -8) return { arrow: '▼', word: 'Fading', cls: 'var(--red)' };
  return { arrow: '▬', word: 'Holding', cls: 'var(--txt3)' };
}

export function trendHTML(pct, prevPct) {
  var t = trendFor(pct, prevPct);
  return '<span style="font-size:11px;font-weight:500;color:' + t.cls + ';white-space:nowrap;">'
    + (t.arrow ? t.arrow + ' ' : '') + t.word + '</span>';
}

// ── Early-signing odds ──
// Battles are multi-way races, so absolute % rarely cracks 50. What matters
// is the LEAD: a target running away from the field can sign early.
// Design rule: "recruits should be able to sign after any stage but not
// every time" — a real chance on a clear lead, never a guarantee.
export function earlySignChance(lead) {
  if (lead >= 15) return 0.35;
  if (lead >= 8) return 0.20;
  if (lead >= 4) return 0.10;
  return 0;
}
// CPU suitors can also lock up targets the user isn't pursuing.
export function cpuEarlySignChance(lead) {
  if (lead >= 15) return 0.40;
  if (lead >= 8) return 0.22;
  if (lead >= 4) return 0.10;
  return 0;
}

// ── Shared stage stepper (flat, matches the phase-dot rhythm) ──
export function stageStepperHTML(cur) {
  var h = '<div style="display:flex;margin-bottom:12px;" role="list" aria-label="Acquisition stages">';
  ACQ_STAGES.forEach(function(s, i) {
    var on = i === cur, done = i < cur;
    var dot = done ? 'var(--grn2)' : on ? 'var(--blu)' : 'var(--bdr2)';
    var lbl = on ? 'var(--blu)' : done ? 'var(--grn2)' : 'var(--txt3)';
    h += '<div style="flex:1;text-align:center;" role="listitem">'
      + '<div style="width:10px;height:10px;border-radius:50%;background:' + dot + ';margin:0 auto 4px;"></div>'
      + '<div style="font-size:11.5px;font-weight:' + (on ? 600 : 400) + ';color:' + lbl + ';">' + s.name + '</div></div>';
  });
  return h + '</div>';
}

// ── Generic early-decision round (stage 1→2 and 2→3) ──
// cfg: {
//   targets, isOpen(t), decideFrac,
//   invested(t)     — user has resources committed
//   userLead(t)     — user's pct lead over the #2 suitor
//   contention(t)   — sort key; most-contended decide first
//   cpuLead(t)      — top CPU suitor's pct lead over #2 (when user not invested)
//   userSign(t)     — award the target to the user
//   cpuSign(t)      — award the target to a CPU school
// }
// Returns { userSigned: [], cpuSigned: [], stayed: n }.
export function runEarlyRound(cfg) {
  var open = cfg.targets.filter(cfg.isOpen);
  open.sort(function(a, b) { return cfg.contention(b) - cfg.contention(a); });
  var n = Math.min(open.length, Math.max(1, Math.round(open.length * cfg.decideFrac)));
  var deciding = open.slice(0, n);
  var res = { userSigned: [], cpuSigned: [], stayed: 0 };
  deciding.forEach(function(t) {
    if (cfg.invested(t)) {
      if (Math.random() < earlySignChance(cfg.userLead(t))) { cfg.userSign(t); res.userSigned.push(t); }
      else res.stayed++;
    } else {
      if (Math.random() < cpuEarlySignChance(cfg.cpuLead(t))) { cfg.cpuSign(t); res.cpuSigned.push(t); }
      else res.stayed++;
    }
  });
  return res;
}

// ── Thin-board check: the user's class is empty enough that late
// targets should surface on Signing Day ──
export function boardIsThin(signedCount, openPursuits) {
  return signedCount < 2 && openPursuits < 3;
}
