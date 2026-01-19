/* =========================================================
 * LOGIN
 * ========================================================= */
function _loginOnce() {
  // 1) GET /login to obtain cookies + XSRF token
  const getResp = _safeFetch(`${CFG.BASE}/login`, {
    method: 'get',
    followRedirects: false,
    muteHttpExceptions: true
  });
  if (!getResp.ok) throw new Error(`Login bootstrap failed: ${getResp.error}`);

  const setCookies1 = _getSetCookieArray(getResp.resp);
  const cookieJar1 = _cookieHeaderFromSetCookies(setCookies1);
  const xsrfCookie = _extractCookieValue(setCookies1, 'XSRF-TOKEN');
  if (!xsrfCookie) throw new Error('Could not obtain XSRF-TOKEN from /login');

  // 2) POST /login (JSON) — preserve existing working logic
  const loginPayload = JSON.stringify({ phone: CFG.PHONE, password: CFG.PASSWORD, remember: true });

  const postResp = _safeFetch(`${CFG.BASE}/login`, {
    method: 'post',
    followRedirects: false,
    muteHttpExceptions: true,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': CFG.BASE,
      'Referer': `${CFG.BASE}/login`,
      'X-Requested-With': 'XMLHttpRequest',
      'X-Inertia': 'true',
      'X-XSRF-TOKEN': decodeURIComponent(xsrfCookie),
      'Cookie': cookieJar1
    },
    payload: loginPayload
  });
  if (!postResp.ok) throw new Error(`Login request failed: ${postResp.error}`);

  const code = postResp.resp.getResponseCode();
  if (code !== 302 && code !== 200) {
    throw new Error('Login failed. HTTP ' + code + ' — ' + postResp.resp.getContentText());
  }

  // 3) Merge cookies and warm up session
  const mergedCookie1 = _mergeCookieHeaders(cookieJar1, _cookieHeaderFromSetCookies(_getSetCookieArray(postResp.resp)));

  const warmResp = _safeFetch(`${CFG.BASE}/`, {
    method: 'get',
    followRedirects: true,
    muteHttpExceptions: true,
    headers: { 'Cookie': mergedCookie1 }
  });
  if (!warmResp.ok) throw new Error(`Warmup failed: ${warmResp.error}`);

  const mergedCookie2 = _mergeCookieHeaders(mergedCookie1, _cookieHeaderFromSetCookies(_getSetCookieArray(warmResp.resp)));
  const xsrfFromWarm = _extractCookieValue(_getSetCookieArray(warmResp.resp), 'XSRF-TOKEN') || xsrfCookie;

  const common = {
    'X-Requested-With': 'XMLHttpRequest',
    'X-XSRF-TOKEN': decodeURIComponent(xsrfFromWarm),
    'Cookie': mergedCookie2,
    'Referer': CFG.PAGE_URL,
    'Origin': CFG.BASE,
    'timezone': CFG.TIMEZONE
  };

  // NOTE: no X-Inertia-Version header is used at all (prevents 409 version mismatch loop)
  const headersApi = Object.assign({}, common, {
    'Accept': 'application/json,text/plain,*/*'
  });

  // Inertia JSON responses for order pages
  const headersInertia = Object.assign({}, common, {
    'Accept': 'application/json',
    'X-Inertia': 'true'
  });

  return { headersApi, headersInertia };
}
