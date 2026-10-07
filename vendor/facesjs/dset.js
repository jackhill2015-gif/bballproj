// Minimal local stand-in for the "dset" package (deep object set).
// facesjs's generateRelative.js imports it, but generate() never calls
// generateRelative() unless options.relative is set, which this game never does.
// This file exists only so the ES module graph resolves in the browser.
export function dset(obj, keys, val) {
  var parts = Array.isArray(keys) ? keys : String(keys).split('.');
  var cur = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    var k = parts[i];
    if (cur[k] === null || cur[k] === undefined || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = val;
}
