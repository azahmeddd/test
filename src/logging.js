/* =========================================================
 * LOG SHEET
 * ========================================================= */
function _startRunLog(fnName) {
  return {
    fn: fnName,
    start: new Date(),
    end: null,
    notes: [],
    errors: [],
    httpErrors: [],
    counters: {
      linksPlanned: 0,
      linksParsedOk: 0,
      linksNoItems: 0,
      rowsProduced: 0
    }
  };
}

function _finishRunLog(run) {
  run.end = new Date();

  const sh = _getOrCreateSheet(CFG.LOG_SHEET);
  const headers = ['start', 'end', 'duration_sec', 'function', 'summary', 'http_errors_sample', 'errors_sample'];

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    const cur = sh.getRange(1, 1, 1, headers.length).getValues()[0].map(v => String(v || '').trim());
    const same = cur.length === headers.length && cur.every((v, i) => v === headers[i]);
    if (!same) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const durationSec = Math.round((run.end.getTime() - run.start.getTime()) / 1000);

  const summaryLines = [
    `start: ${Utilities.formatDate(run.start, CFG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')}`,
    `end: ${Utilities.formatDate(run.end, CFG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')}`,
    `duration_sec: ${durationSec}`,
    `linksPlanned: ${run.counters.linksPlanned}`,
    `linksParsedOk: ${run.counters.linksParsedOk}`,
    `linksNoItems: ${run.counters.linksNoItems}`,
    `rowsProduced: ${run.counters.rowsProduced}`
  ];
  if (run.notes.length) {
    summaryLines.push('notes:', ...run.notes.map(x => `- ${x}`));
  }

  const httpSample = run.httpErrors.slice(0, 20);
  const errSample = run.errors.slice(0, 10);

  const row = [
    Utilities.formatDate(run.start, CFG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
    Utilities.formatDate(run.end, CFG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
    durationSec,
    run.fn,
    summaryLines.join('\n'),
    httpSample.length ? httpSample.join('\n') : '',
    errSample.length ? errSample.join('\n') : ''
  ];

  // Insert newest on top (row 2)
  sh.insertRowsAfter(1, 1);
  sh.getRange(2, 1, 1, headers.length).setValues([row]);
  sh.autoResizeColumns(1, headers.length);
}
