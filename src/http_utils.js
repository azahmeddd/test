/* =========================================================
 * HTTP UTILS (SAFE)
 * ========================================================= */
function _safeFetch(url, options) {
  try {
    const resp = UrlFetchApp.fetch(url, options);
    return { ok: true, resp };
  } catch (e) {
    return { ok: false, error: _errToStr(e) };
  }
}

function _fetchJsonOrTextSafe(url, headers) {
  const r = _safeFetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: false,
    headers
  });
  if (!r.ok) return { ok: false, error: r.error };

  const resp = r.resp;
  const code = resp.getResponseCode();
  if (code !== 200) return { ok: false, error: `HTTP ${code}` };

  const txt = resp.getContentText();
  try {
    return { ok: true, data: JSON.parse(txt) };
  } catch (_) {
    return { ok: true, data: txt };
  }
}
