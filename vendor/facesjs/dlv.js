// Minimal local stand-in for the "dlv" package (deep object get).
// facesjs's generateRelative.js imports it, but generate() never calls
// generateRelative() unless options.relative is set, which this game never does.
// This file exists only so the ES module graph resolves in the browser.
export default function dlv(obj, key, def) {
  var parts = Array.isArray(key) ? key : String(key).split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur === null || cur === undefined) return def;
    cur = cur[parts[i]];
  }
  return cur === undefined ? def : cur;
}
