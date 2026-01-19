/* =========================================================
 * SHEET UTILS
 * ========================================================= */
function _readKnownLinks() {
  const sh = _getOrCreateSheet(CFG.OUT_SHEET);
  const lastRow = sh.getLastRow();

  const knownLinks = new Set();

  if (lastRow >= 2) {
    // column B is 'link'
    const vals = sh.getRange(2, 2, lastRow - 1, 1).getValues();
    for (const row of vals) {
      const lnk = String(row[0] ?? '').trim();
      if (lnk) knownLinks.add(lnk);
    }
  }
  return { sheet: sh, knownLinks };
}

function _ensureHeader(sh, headers) {
  const width = headers.length;
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, width).setValues([headers]);
    sh.setFrozenRows(1);
    return;
  }
  const current = sh.getRange(1, 1, 1, width).getValues()[0].map(v => String(v || '').trim());
  const same = current.length === headers.length && current.every((v, i) => v === headers[i]);
  if (!same) {
    sh.getRange(1, 1, 1, width).setValues([headers]);
  }
  sh.setFrozenRows(1);
}

/**
 * Conditional formatting replaces per-run repaint.
 * Stable shading: based on parity of numeric suffix in order_number (WH-…-12345).
 * Also highlights qty_ordered != qty_actual.
 */
function _ensureConditionalFormatting(sh, headers) {
  const lastRow = Math.max(2, sh.getLastRow());
  const lastCol = headers.length;

  const headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || '').trim());
  const idxOrd = headerRow.indexOf('qty_ordered');
  const idxAct = headerRow.indexOf('qty_actual');

  const dataRange = sh.getRange(2, 1, lastRow - 1, lastCol);

  const BG1 = '#E8F5E9';
  const BG2 = '#C8E6C9';
  const DIFF_BG = '#FFCDD2';
  const DIFF_FONT = '#D32F2F';

  const rules = [];

  // 1) Diff rule for qty columns (highest priority)
  if (idxOrd >= 0 && idxAct >= 0) {
    const colOrd = idxOrd + 1;
    const colAct = idxAct + 1;

    const rOrd = sh.getRange(2, colOrd, lastRow - 1, 1);
    const rAct = sh.getRange(2, colAct, lastRow - 1, 1);

    const diffFormula = `=AND($A2<>"",N($${_colLetter(colOrd)}2)<>N($${_colLetter(colAct)}2))`;

    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(diffFormula)
        .setBackground(DIFF_BG)
        .setFontColor(DIFF_FONT)
        .setRanges([rOrd, rAct])
        .build()
    );
  }

  // 2) Row shading based on order_number numeric parity (stable)
  const oddFormula = `=IFERROR(MOD(VALUE(REGEXEXTRACT($A2,"\\d+$")),2)=1,FALSE)`;
  const evenFormula = `=IFERROR(MOD(VALUE(REGEXEXTRACT($A2,"\\d+$")),2)=0,FALSE)`;

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(oddFormula)
      .setBackground(BG1)
      .setRanges([dataRange])
      .build()
  );
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(evenFormula)
      .setBackground(BG2)
      .setRanges([dataRange])
      .build()
  );

  // Replace only rules that target this sheet+range: simplest is to set all rules for sheet to ours.
  // If you have other CF rules on this sheet, move them to another sheet.
  sh.setConditionalFormatRules(rules);
}

/* =========================================================
 * HEADER MIGRATION
 * ========================================================= */
function _migrateHistoryToStartAndAddEnd(sh, targetHeaders) {
  if (sh.getLastRow() === 0) return;

  const width = Math.max(sh.getLastColumn(), targetHeaders.length);
  const current = sh.getRange(1, 1, 1, width).getValues()[0].map(v => String(v || '').trim());

  const idxHistory = current.indexOf('history');
  const hasStart = current.indexOf('start') >= 0;

  if (idxHistory >= 0 && !hasStart) {
    sh.getRange(1, idxHistory + 1).setValue('start');
  }

  const idxStartNow = (function () {
    const row = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(v => String(v || '').trim());
    return row.indexOf('start');
  })();

  if (idxStartNow >= 0) {
    const row2 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(v => String(v || '').trim());
    if (row2.indexOf('end') === -1) {
      sh.insertColumnAfter(idxStartNow + 1);
      sh.getRange(1, idxStartNow + 2).setValue('end');
    }
  }
}
