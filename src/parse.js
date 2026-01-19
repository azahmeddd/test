/* =========================================================
 * BATCH FETCH + PARSE ORDER PAGES (INERTIA JSON ONLY)
 * ========================================================= */
function _parseOrderLinksBatch(headersInertia, links, run, startMs, maxRuntimeMs) {
  const rows = [];
  const linksWithItems = new Set();

  let parsedOk = 0;
  let noItems = 0;
  let errorsCount = 0;

  const batchSize = Math.max(1, CFG.FETCHALL_BATCH || 10);

  for (let i = 0; i < links.length; i += batchSize) {
    if (Date.now() - startMs > maxRuntimeMs) {
      run.notes.push('Time limit reached during parsing');
      break;
    }

    const chunk = links.slice(i, i + batchSize);

    // fetchAll requests
    const reqs = chunk.map(url => ({
      url,
      method: 'get',
      followRedirects: false,
      muteHttpExceptions: true,
      headers: headersInertia
    }));

    let resps;
    try {
      resps = UrlFetchApp.fetchAll(reqs);
    } catch (e) {
      errorsCount++;
      run.errors.push('fetchAll failed: ' + _errToStr(e));
      break;
    }

    for (let k = 0; k < resps.length; k++) {
      if (Date.now() - startMs > maxRuntimeMs) break;

      const url = chunk[k];
      const resp = resps[k];
      const code = resp.getResponseCode();

      if (code !== 200) {
        errorsCount++;
        run.httpErrors.push(`HTTP ${code}: ${url}`);
        continue;
      }

      const txt = resp.getContentText();
      let page;
      try {
        page = JSON.parse(txt);
      } catch (e) {
        errorsCount++;
        run.httpErrors.push(`JSON parse error: ${url}`);
        continue;
      }

      const rec = _parseInertiaOrderPage(page, url);
      if (!rec.items || !rec.items.length) {
        noItems++;
        continue;
      }

      for (const it of rec.items) {
        rows.push([
          rec.orderNum || '',
          rec.link,
          rec.reqType || '',
          rec.reqDate || '',
          it.barcode || '',
          it.name || '',
          it.qty_ordered || 0,
          it.qty_actual || 0,
          it.comment || '',
          rec.startDT || '',
          rec.endDT || ''
        ]);
      }

      linksWithItems.add(url);
      parsedOk++;
    }
  }

  // Sort produced rows to keep newest on top in incremental
  rows.sort((a, b) => {
    const na = _extractOrderNumberNumeric(String(a[0] || ''));
    const nb = _extractOrderNumberNumeric(String(b[0] || ''));
    return nb - na;
  });

  return { rows, linksWithItems, parsedOk, noItems, errorsCount };
}

/* =========================================================
 * PARSE ONE ORDER PAGE (INERTIA JSON, NO HTML FALLBACK)
 * ========================================================= */
function _parseInertiaOrderPage(page, link) {
  // Expect Inertia JSON: { component, props, url, version }
  if (!page || typeof page !== 'object' || !page.props) {
    return { link, orderNum: _extractOrderNumberFromText(link) || '', reqType: '', reqDate: '', items: [], startDT: '', endDT: '' };
  }

  const props = page.props || {};
  const req = props.request || {};

  const orderNum =
    req.delivery_number ||
    req.order_number ||
    req.number ||
    _extractOrderNumberFromText(link) ||
    '';

  const reqType =
    req.type ||
    req.request_type ||
    '';

  // Use explicit request date fields; normalize to yyyy-MM-dd
  const reqDateRaw =
    req.createdAt ||
    req.created_at ||
    req.date ||
    req.collection_date ||
    '';
  const reqDate = _normalizeDate(reqDateRaw);

  const comment =
    (typeof req.comment === 'string' ? req.comment : '') ||
    (typeof req.notes === 'string' ? req.notes : '') ||
    '';

  // Stage history: use request.stageLogs only (no HTML extraction)
  const stageLogs = Array.isArray(req.stageLogs) ? req.stageLogs : (Array.isArray(req.stage_logs) ? req.stage_logs : []);
  const { startDT, endDT } = _extractStartEndFromStageLogs(stageLogs);

  // Items: request.products (explicit)
  const products = Array.isArray(req.products) ? req.products : [];

  const agg = new Map(); // barcode -> { name, qty_ordered, qty_actual }

  for (const it of products) {
    const bc = (it && (it.barcode || it.ean || it.gtin)) ? String(it.barcode || it.ean || it.gtin).trim() : '(no-barcode)';
    const nm = it && it.name ? String(it.name) : '';

    // Explicit fields only (no type dictionaries / no text parsing)
    const ordered = _numOrZero(it.amount ?? it.request_qty ?? it.request_quantity ?? it.qty ?? it.quantity);
    const actual = _numOrZero(
      (it.acceptedAmount ?? it.accepted_amount ?? it.accepted_qty ?? it.qty_accepted) ??
      (it.delivery_amount ?? it.shipped_qty ?? it.qty_delivered) ??
      (it.qty_received ?? it.received_qty ?? it.fact_qty ?? it.qty_fact)
    );

    if (agg.has(bc)) {
      const rec = agg.get(bc);
      rec.qty_ordered += ordered;
      rec.qty_actual += actual;
      if (!rec.name && nm) rec.name = nm;
    } else {
      agg.set(bc, { name: nm, qty_ordered: ordered, qty_actual: actual });
    }
  }

  const items = Array.from(agg.entries()).map(([barcode, rec]) => ({
    barcode,
    name: rec.name || '',
    qty_ordered: rec.qty_ordered || 0,
    qty_actual: rec.qty_actual || 0,
    comment: comment || ''
  }));

  return { link, orderNum, reqType, reqDate, items, startDT, endDT };
}

function _extractStartEndFromStageLogs(stageLogs) {
  if (!stageLogs || !stageLogs.length) return { startDT: '', endDT: '' };

  // Use created_at if present; keep original format
  const vals = stageLogs
    .map(x => x && (x.created_at || x.createdAt || x.start || x.started_at) ? String(x.created_at || x.createdAt || x.start || x.started_at).trim() : '')
    .filter(Boolean);

  if (!vals.length) return { startDT: '', endDT: '' };

  // If they are in DD.MM.YYYY HH:MM:SS, order should already be chronological; use first/last
  return { startDT: vals[0], endDT: vals[vals.length - 1] };
}
