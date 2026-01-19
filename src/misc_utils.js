/* =========================================================
 * MISC UTILS
 * ========================================================= */
function _buildUrl(base, query) {
  const params = Object.keys(query)
    .filter(k => query[k] != null)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]))}`)
    .join('&');
  return params ? `${base}?${params}` : base;
}

function _getSetCookieArray(resp) {
  const h = resp.getAllHeaders ? resp.getAllHeaders() : {};
  let sc = h['Set-Cookie'] || h['set-cookie'];
  if (!sc) return [];
  return Array.isArray(sc) ? sc : [sc];
}

function _cookieHeaderFromSetCookies(setCookies) {
  const simple = setCookies.map(s => s.split(';')[0]).filter(Boolean);
  const map = {};
  simple.forEach(pair => {
    const eq = pair.indexOf('=');
    if (eq > 0) map[pair.slice(0, eq).trim()] = pair.trim();
  });
  return Object.values(map).join('; ');
}

function _mergeCookieHeaders(a, b) {
  const merged = {};
  function add(header) {
    (header || '').split(';').forEach(part => {
      const p = part.trim();
      if (!p) return;
      const eq = p.indexOf('=');
      if (eq > 0) merged[p.slice(0, eq).trim()] = p;
    });
  }
  add(a);
  add(b);
  return Object.values(merged).join('; ');
}

function _extractCookieValue(setCookies, name) {
  const target = setCookies.find(s => s.startsWith(name + '='));
  if (!target) return null;
  const firstPart = target.split(';')[0];
  return firstPart.substring(name.length + 1);
}

function _getSpreadsheet() {
  if (CFG && CFG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function _getOrCreateSheet(name) {
  const ss = _getSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

const ORDER_RE = /\bWH-[A-Z0-9]{1,8}-\d+\b/;
function _extractOrderNumberFromText(t) {
  const m = (t || '').match(ORDER_RE);
  return m ? m[0] : '';
}

function _extractOrderNumberNumeric(orderStr) {
  if (!orderStr) return 0;
  const m = String(orderStr).match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function _numOrZero(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function _errToStr(e) {
  try {
    if (!e) return 'Unknown error';
    if (typeof e === 'string') return e;
    if (e && e.message) return e.message;
    return String(e);
  } catch (_) {
    return 'Unstringifiable error';
  }
}

function _colLetter(n) {
  // 1-based column number to A1 letter
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
