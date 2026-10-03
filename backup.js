// ═══════════════════════════════════════════════════════════
//  HOOPS OS — backup.js
//  Back up the dynasty to a file and restore it. On iPhone the
//  share sheet offers "Save to Files"; elsewhere it downloads.
// ═══════════════════════════════════════════════════════════

import { G, getRawSave, saveStateNow } from './state.js';

var SAVE_KEY = 'hoops_os_v3';

function fileName(s) {
  var team = (s.teams && s.teams[s.tid] && s.teams[s.tid].name) || 'dynasty';
  var d = new Date();
  var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return 'hoops-os-' + String(s.yr || '') + '-' + stamp + '.json';
}

export function backupDynasty(toast) {
  if (G.teams && G.teams.length && G.tid >= 0) saveStateNow(); // include the latest move
  var s = getRawSave();
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
      var team = s.teams[s.tid] && s.teams[s.tid].name;
      if (!confirm('Restore this backup (' + (s.yr || '') + (team ? ', ' + team : '') + ')? It replaces the dynasty on this device.')) return;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }
      catch (e) { toast && toast('Couldn’t restore: storage is full or blocked.'); return; }
      location.reload();
    };
    reader.readAsText(f);
  };
  input.click();
}
