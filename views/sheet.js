// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/sheet.js
//  Generic bottom-sheet overlay (phone) / centered dialog
//  (desktop). Used by the player profile (views/player.js)
//  and the development report (views/devreport.js).
//  Close via the Close button (data-action="sheet-close",
//  handled in ui.js handleAction), the Escape key, or by
//  tapping the backdrop.
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';

var _escBound = false;

function sheetEl() { return ge('sheet'); }

export function isSheetOpen() {
  var el = sheetEl();
  return !!(el && el.classList.contains('open'));
}

export function openSheet(html, label) {
  var el = sheetEl();
  if (!el) return;
  var body = ge('sheet-body');
  var title = ge('sheet-title');
  if (body) body.innerHTML = html;
  if (title) title.textContent = label || 'Details';
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  if (!_escBound) {
    _escBound = true;
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isSheetOpen()) closeSheet();
    });
  }
  // Tapping the backdrop (not the panel) closes the sheet.
  if (!el._backdropBound) {
    el._backdropBound = true;
    el.addEventListener('click', function(e) {
      if (e.target === el) closeSheet();
    });
  }
  var panel = el.querySelector('.sheet-panel');
  if (panel) panel.scrollTop = 0;
}

export function closeSheet() {
  var el = sheetEl();
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
}
