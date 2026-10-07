// ═══════════════════════════════════════════════════════════
//  HOOPS OS — backup.js
//  Back up the dynasty to a file and restore it. On iPhone the
//  share sheet offers "Save to Files"; elsewhere it downloads.
//  Backups cover one save slot; a restore goes into a slot you pick.
// ═══════════════════════════════════════════════════════════

import { getRawSave, saveStateNow } from './state.js';
import { SLOTS, readSlot, writeSlotNow, setActiveSlot } from './storage.js';
import { slotSummary } from './views/setup.js';

function fileName(s) {
  var team = (s.teams && s.teams[s.tid] && s.teams[s.tid].name) || 'dynasty';
  var d = new Date();
  var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return 'hoops-os-' + String(s.yr || '') + '-' + stamp + '.json';
}

// slot given (home screen): back up that slot as stored. No slot (in game):
// save the latest move first, then back up the active slot.
export function backupDynasty(toast, slot) {
  var s = null;
  if (slot) {
    try { s = JSON.parse(readSlot(slot)); } catch (e) { s = null; }
  } else {
    saveStateNow();
    s = getRawSave();
  }
  if (!s) { toast && toast('No saved dynasty to back up.'); return; }
  var text = JSON.stringify(s);
  var name = fileName(s);
  var file = null;
  try { file = new File([text], name, { type: 'application/json' }); } catch (e) { file = null; }
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Hoops OS backup' })
      .then(function() { toast && toast('Backup saved.'); })
      .catch(function(err) { if (err && err.name !== 'AbortError') downloadFallback(text, name, toast); });
    return;
  }
  downloadFallback(text, name, toast);
}

function downloadFallback(text, name, toast) {
  var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function() { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1000);
  toast && toast('Backup downloaded: ' + name);
}

export function restoreDynasty(toast) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = function() {
    var f = input.files && input.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function() {
      var s;
      try { s = JSON.parse(reader.result); } catch (e) { s = null; }
      if (!s || typeof s !== 'object' || !Array.isArray(s.teams) || typeof s.tid !== 'number') {
        toast && toast('That file isn’t a Hoops OS backup.');
        return;
      }
      chooseSlot(s, toast);
    };
    reader.readAsText(f);
  };
  input.click();
}

// Pick the slot to restore into. A filled slot asks before it's replaced.
function chooseSlot(s, toast) {
  var text = JSON.stringify(s);
  var sum = slotSummary(s) || { team: 'dynasty', yr: s.yr || '' };
  var old = document.getElementById('mo-ov'); if (old && old.parentNode) old.parentNode.removeChild(old);
  var ov = document.createElement('div');
  ov.id = 'mo-ov'; ov.className = 'mo-ov';
  var rows = SLOTS.map(function(n) {
    return '<button class="restore-slot" data-rs="' + n + '"><span class="restore-slot-n">Slot ' + n + '</span>'
      + '<span class="restore-slot-d"></span></button>';
  }).join('');
  ov.innerHTML = '<div class="panel mo-p" role="dialog" aria-label="Restore backup"><div class="panel-h"><span>Restore backup</span></div>'
    + '<div class="panel-b"><div class="mo-msg"></div><div class="restore-slots">' + rows + '</div>'
    + '<div class="big-btn-row" style="margin:12px 0 0;"><button class="btn-big secondary" data-rs="cancel">Cancel</button></div></div></div>';
  ov.querySelector('.mo-msg').textContent = sum.team + ', ' + sum.yr + '. Choose a slot for it.';
  SLOTS.forEach(function(n) {
    var cur = slotSummary(readSlot(n));
    ov.querySelector('[data-rs="' + n + '"] .restore-slot-d').textContent = cur ? cur.team + ', ' + cur.yr : 'Empty';
  });
  document.body.appendChild(ov);
  var close = function() { if (ov.parentNode) ov.parentNode.removeChild(ov); };
  ov.addEventListener('click', function(e) {
    var b = e.target.closest && e.target.closest('[data-rs]');
    if (e.target === ov || (b && b.getAttribute('data-rs') === 'cancel')) { close(); return; }
    if (!b) return;
    var n = parseInt(b.getAttribute('data-rs'), 10);
    var cur = slotSummary(readSlot(n));
    if (cur && !confirm('Replace the ' + cur.team + ' dynasty in slot ' + n + '? This cannot be undone.')) return;
    close();
    writeSlotNow(n, text)
      .then(function() { setActiveSlot(n); location.reload(); })
      .catch(function() { toast && toast('Couldn\u2019t restore: storage is full or blocked.'); });
  });
}
