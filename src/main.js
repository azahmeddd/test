/* =========================================================
 * 1) MAIN INCREMENTAL (NEWEST FIRST)
 * ========================================================= */
function fetchArrivals_ToLinks_AutoLogin() {
  const run = _startRunLog('fetchArrivals_ToLinks_AutoLogin');

  const MAX_RUNTIME_MS = 4 * 60 * 1000; // ~4 minutes
  const START_MS = Date.now();

  try {
    const { sheet: sh, knownLinks } = _readKnownLinks();
    const headers = [
      'order_number',
      'link',
      'request_type',
      'date',
      'barcode',
      'item_name',
      'qty_ordered',
      'qty_actual',
      'comments',
      'start',
      'end'
    ];

    _migrateHistoryToStartAndAddEnd(sh, headers);
    _ensureHeader(sh, headers);
    _ensureConditionalFormatting(sh, headers);

    // Login
    const { headersApi, headersInertia } = _loginOnce();

    // Collect new links (bounded)
    const firstPageMap = _scanFirstPageOrders(headersApi);
    const missingTop100 = [];
    for (const [, href] of firstPageMap.entries()) {
      if (!knownLinks.has(href)) missingTop100.push(href);
    }

    const deepNew = _collectNewLinksBounded(headersApi, knownLinks, START_MS, MAX_RUNTIME_MS);
    const firstSet = new Set(missingTop100);
    const newLinks = [...new Set([
      ...missingTop100,
      ...deepNew.filter(l => !firstSet.has(l))
    ])];

    run.notes.push(`newLinks=${newLinks.length}`);

    if (!newLinks.length) {
      SpreadsheetApp.getActive().toast('Новых ссылок нет — всё актуально.');
      run.notes.push('No new links');
      return;
    }

    // Parse only truly new links and cap amount per run
    const linksToParse = newLinks
      .filter(l => l && !knownLinks.has(l))
      .slice(0, CFG.MAX_ORDER_PAGES_PER_RUN);

    if (!linksToParse.length) {
      SpreadsheetApp.getActive().toast('Новых ссылок нет (после фильтрации).');
      run.notes.push('No links to parse after filtering');
      return;
    }

    // Batch fetch + parse
    const parsed = _parseOrderLinksBatch(headersInertia, linksToParse, run, START_MS, MAX_RUNTIME_MS);
    const outRows = parsed.rows;

    run.counters.linksPlanned = linksToParse.length;
    run.counters.linksParsedOk = parsed.parsedOk;
    run.counters.linksNoItems = parsed.noItems;
    run.counters.rowsProduced = outRows.length;

    // Update knownLinks only for links successfully parsed (produced items)
    for (const l of parsed.linksWithItems) knownLinks.add(l);

    if (!outRows.length) {
      SpreadsheetApp.getActive().toast(`Новые ссылки: ${newLinks.length}, но новых строк не добавлено (ошибки/нет позиций).`);
      return;
    }

    if (Date.now() - START_MS > MAX_RUNTIME_MS) {
      run.notes.push('Time limit reached before write');
    }

    // Insert rows on top (below header)
    sh.insertRowsAfter(1, outRows.length);
    sh.getRange(2, 1, outRows.length, headers.length).setValues(outRows);

    sh.autoResizeColumns(1, headers.length);
    _ensureConditionalFormatting(sh, headers);

    SpreadsheetApp.getActive().toast(
      `Готово: ссылок к парсингу ${linksToParse.length}, успешных ${parsed.parsedOk}, строк добавлено ${outRows.length}.`
    );
  } catch (e) {
    run.errors.push(_errToStr(e));
    throw e;
  } finally {
    _finishRunLog(run);
  }
}

/* =========================================================
 * 2) BACKFILL FROM OLDEST (FULL HISTORY, OLDEST→NEWEST)
 * ========================================================= */
function backfillArrivalsFromOldest() {
  const run = _startRunLog('backfillArrivalsFromOldest');

  const MAX_RUNTIME_MS = 4 * 60 * 1000; // ~4 minutes
  const START_MS = Date.now();

  try {
    const { sheet: sh, knownLinks } = _readKnownLinks();
    const headers = [
      'order_number',
      'link',
      'request_type',
      'date',
      'barcode',
      'item_name',
      'qty_ordered',
      'qty_actual',
      'comments',
      'start',
      'end'
    ];

    _migrateHistoryToStartAndAddEnd(sh, headers);
    _ensureHeader(sh, headers);
    _ensureConditionalFormatting(sh, headers);

    const { headersApi, headersInertia } = _loginOnce();

    // Collect missing links (oldest→newest), but bounded by time+caps
    const missingLinks = _collectMissingLinksForBackfillBounded(headersApi, knownLinks, START_MS, MAX_RUNTIME_MS);
    run.notes.push(`missingLinks=${missingLinks.length}`);

    if (!missingLinks.length) {
      SpreadsheetApp.getActive().toast('Бэкфилл: все доступные заявки уже представлены в листе (по ссылкам).');
      run.notes.push('No missing links');
      return;
    }

    // Parse missing links (oldest first), cap per run
    const linksToParse = missingLinks
      .filter(l => l && !knownLinks.has(l))
      .slice(0, CFG.MAX_ORDER_PAGES_PER_RUN);

    const parsed = _parseOrderLinksBatch(headersInertia, linksToParse, run, START_MS, MAX_RUNTIME_MS);
    const outRows = parsed.rows;

    run.counters.linksPlanned = linksToParse.length;
    run.counters.linksParsedOk = parsed.parsedOk;
    run.counters.linksNoItems = parsed.noItems;
    run.counters.rowsProduced = outRows.length;

    for (const l of parsed.linksWithItems) knownLinks.add(l);

    if (!outRows.length) {
      SpreadsheetApp.getActive().toast(
        `Бэкфилл: строк не добавлено. Без позиций: ${parsed.noItems}, ошибок: ${parsed.errorsCount}.`
      );
      return;
    }

    // Rebuild full table: existing + new, dedupe by (link + barcode), sort by order_number desc
    const lastRow = sh.getLastRow();
    const existingRowsCount = lastRow > 1 ? lastRow - 1 : 0;

    let existingData = [];
    if (existingRowsCount > 0) {
      existingData = sh.getRange(2, 1, existingRowsCount, headers.length).getValues();
    }

    const byKey = new Map();
    const keyOfRow = row => {
      const link = (row[1] || '').toString().trim();
      const bc = (row[4] || '').toString().trim();
      if (!link && !bc) return '';
      return link + '::' + bc;
    };

    for (const row of existingData) {
      const k = keyOfRow(row);
      if (k && !byKey.has(k)) byKey.set(k, row);
    }
    for (const row of outRows) {
      const k = keyOfRow(row);
      if (k && !byKey.has(k)) byKey.set(k, row);
    }

    let allRows = Array.from(byKey.values());
    allRows.sort((a, b) => {
      const na = _extractOrderNumberNumeric(String(a[0] || ''));
      const nb = _extractOrderNumberNumeric(String(b[0] || ''));
      if (na !== nb) return nb - na;
      const da = String(a[3] || '');
      const db = String(b[3] || '');
      if (da !== db) return da < db ? 1 : -1;
      const bca = String(a[4] || '');
      const bcb = String(b[4] || '');
      return bca.localeCompare(bcb);
    });

    // Clear data (not header) and rewrite
    if (existingRowsCount > 0) {
      sh.getRange(2, 1, existingRowsCount, headers.length).clearContent();
    }

    const neededRows = allRows.length;
    if (neededRows > existingRowsCount) {
      sh.insertRowsAfter(1 + existingRowsCount, neededRows - existingRowsCount);
    }

    if (neededRows > 0) {
      sh.getRange(2, 1, neededRows, headers.length).setValues(allRows);
    }

    sh.autoResizeColumns(1, headers.length);
    _ensureConditionalFormatting(sh, headers);

    SpreadsheetApp.getActive().toast(
      `Бэкфилл: добавлено строк ${outRows.length}, обработано заявок ${parsed.parsedOk}, всего строк теперь ${neededRows}.`
    );
  } catch (e) {
    run.errors.push(_errToStr(e));
    throw e;
  } finally {
    _finishRunLog(run);
  }
}
