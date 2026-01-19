/* =========================================================
 * DATE NORMALIZATION
 * ========================================================= */
function _normalizeDate(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, CFG.TIMEZONE, 'yyyy-MM-dd');
  }

  // epoch number (ms or seconds)
  if (typeof val === 'number' && isFinite(val)) {
    const ms = val < 2e10 ? val * 1000 : val; // seconds -> ms (heuristic)
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, CFG.TIMEZONE, 'yyyy-MM-dd');
    }
  }

  const s = String(val).trim();
  if (!s) return '';

  // 1) Exact DD.MM.YYYY or DD.MM.YYYY HH:MM(:SS)
  // Examples: 17.01.2026, 17.01.2026 14:05, 17.01.2026 14:05:33
  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const yyyy = Number(m[3]);
    const HH = Number(m[4] || 0);
    const MI = Number(m[5] || 0);
    const SS = Number(m[6] || 0);
    const d = new Date(yyyy, mm, dd, HH, MI, SS);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, CFG.TIMEZONE, 'yyyy-MM-dd');
    }
  }

  // 2) ISO-ish / YYYY-MM-DD present anywhere
  m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  // 3) If string contains DD.MM.YYYY anywhere (not exact)
  m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm, dd);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, CFG.TIMEZONE, 'yyyy-MM-dd');
    }
  }

  // 4) Last attempt: Date() parsing (works for ISO, RFC, etc.)
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, CFG.TIMEZONE, 'yyyy-MM-dd');
    }
  } catch (_) {}

  return s; // fallback: keep original if totally unknown
}
