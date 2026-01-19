/* =========================================================
 * LINK COLLECTION (INCREMENTAL, BOUNDED)
 * ========================================================= */
function _scanFirstPageOrders(headersApi) {
  const q = Object.assign({}, CFG.DEFAULT_QUERY, {
    itemsPerPage: String(CFG.ITEMS_PER_PAGE),
    page: '1'
  });
  const url = _buildUrl(CFG.BASE + CFG.TABLE_SORT_PATH, q);
  const payload = _fetchJsonOrTextSafe(url, headersApi);

  const links = payload.ok ? _extractLinksFromPayload(payload.data) : [];
  const map = new Map(); // orderNum -> link
  for (const href of links) {
    const ord = _extractOrderNumberFromText(href);
    if (ord && !map.has(ord)) map.set(ord, href);
  }
  return map;
}

function _collectNewLinksBounded(headersApi, knownLinks, startMs, maxRuntimeMs) {
  const newSet = new Set();
  const baseQ = Object.assign({}, CFG.DEFAULT_QUERY, { itemsPerPage: String(CFG.ITEMS_PER_PAGE) });

  let consecAllKnown = 0;
  const maxPage = CFG.MAX_PAGES;

  for (let page = 1; page <= maxPage; page++) {
    if (Date.now() - startMs > maxRuntimeMs) break;

    Utilities.sleep(CFG.SLEEP_MS_EACH);

    const url = _buildUrl(CFG.BASE + CFG.TABLE_SORT_PATH, Object.assign({}, baseQ, { page: String(page) }));
    const payload = _fetchJsonOrTextSafe(url, headersApi);
    if (!payload.ok) break;

    const pageLinks = _extractLinksFromPayload(payload.data);
    if (!pageLinks.length) break;

    let allKnown = true;

    for (const link of pageLinks) {
      if (!link) continue;

      if (!knownLinks.has(link) && !newSet.has(link)) {
        allKnown = false;
        newSet.add(link);

        if (newSet.size >= CFG.MAX_NEW_LINKS_PER_RUN) {
          // Cap: avoid deep page scanning (bandwidth quota protection)
          page = maxPage + 1;
          break;
        }
      }
    }

    if (allKnown) consecAllKnown++;
    else consecAllKnown = 0;

    // Same core stopping logic: stop after 2 consecutive pages with no new links
    if (consecAllKnown >= 2) break;
  }

  const links = Array.from(newSet);

  links.sort((a, b) => {
    const na = _extractOrderNumberNumeric(_extractOrderNumberFromText(a));
    const nb = _extractOrderNumberNumeric(_extractOrderNumberFromText(b));
    return nb - na;
  });

  return links;
}

/* =========================================================
 * LINK COLLECTION (BACKFILL, BOUNDED)
 * ========================================================= */
function _collectMissingLinksForBackfillBounded(headersApi, knownLinks, startMs, maxRuntimeMs) {
  const missingSet = new Set();
  const baseQ = Object.assign({}, CFG.DEFAULT_QUERY, { itemsPerPage: String(CFG.ITEMS_PER_PAGE) });
  const maxPage = CFG.BACKFILL_MAX_PAGES || 2000;

  for (let page = 1; page <= maxPage; page++) {
    if (Date.now() - startMs > maxRuntimeMs) break;

    Utilities.sleep(CFG.SLEEP_MS_EACH);

    const url = _buildUrl(CFG.BASE + CFG.TABLE_SORT_PATH, Object.assign({}, baseQ, { page: String(page) }));
    const payload = _fetchJsonOrTextSafe(url, headersApi);
    if (!payload.ok) break;

    const pageLinks = _extractLinksFromPayload(payload.data);
    if (!pageLinks.length) break;

    for (const link of pageLinks) {
      if (!link) continue;
      if (!knownLinks.has(link)) missingSet.add(link);
      if (missingSet.size >= CFG.MAX_NEW_LINKS_PER_RUN) {
        // Cap collection per run (parse oldest chunk next)
        page = maxPage + 1;
        break;
      }
    }
  }

  const result = Array.from(missingSet);

  // oldest -> newest
  result.sort((a, b) => {
    const na = _extractOrderNumberNumeric(_extractOrderNumberFromText(a));
    const nb = _extractOrderNumberNumeric(_extractOrderNumberFromText(b));
    return na - nb;
  });

  return result;
}

/* =========================================================
 * LINK EXTRACTION (KEEPING WORKING LOGIC)
 * ========================================================= */
function _mineForLinks(payload, linkSet, orphanSet) {
  if (payload == null) return;

  const ABS = /https?:\/\/app\.sellerlab\.uz\/customer\/requests\/(WH-[A-Z0-9]{1,8}-\d+)\b/g;
  const REL = /href="(\/customer\/requests\/(WH-[A-Z0-9]{1,8}-\d+))"/g;
  const ORD = /\bWH-[A-Z0-9]{1,8}-\d+\b/g;

  function eat(t) {
    if (!t) return;
    let m;
    while ((m = ABS.exec(t)) !== null) linkSet.add(m[0]);
    while ((m = REL.exec(t)) !== null) {
      linkSet.add(CFG.BASE + (m[1].startsWith('/') ? m[1] : '/' + m[1]));
    }
    while ((m = ORD.exec(t)) !== null) orphanSet.add(m[0]);
  }

  (function walk(v) {
    if (v == null) return;
    if (typeof v === 'string') {
      eat(v);
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) walk(v[i]);
    } else if (typeof v === 'object') {
      for (const k in v) {
        try { walk(v[k]); } catch (_) {}
      }
    }
  })(payload);
}

function _extractLinksFromPayload(payload) {
  const pageSet = new Set();
  const orphan = new Set();

  _mineForLinks(payload, pageSet, orphan);

  for (const on of orphan) {
    pageSet.add(`${CFG.BASE}/customer/requests/${encodeURIComponent(on)}`);
  }
  return Array.from(pageSet);
}
