/* =========================================================
 * MENU + SIDEBAR
 * ========================================================= */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SellerLab')
    .addItem('Обновить arrivals (сейчас)', 'updateArrivalsNow')
    .addItem('Бэкфилл истории (старые → новые)', 'backfillArrivalsFromOldest')
    .addItem('Панель обновления…', 'showUpdateSidebar')
    .addToUi();
}

function updateArrivalsNow() {
  const uiToast = msg => SpreadsheetApp.getActive().toast(msg);

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(2000)) {
    uiToast('Скрипт уже выполняется. Попробуйте позже.');
    return;
  }

  try {
    uiToast('Старт обновления…');
    fetchArrivals_ToLinks_AutoLogin();
    uiToast('Ручное обновление завершено.');
  } catch (err) {
    uiToast('Ошибка: ' + (err && err.message ? err.message : err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function showUpdateSidebar() {
  const html = HtmlService.createHtmlOutput(`
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <div style="font-family:system-ui,Arial,sans-serif;padding:14px;">
      <h3 style="margin:0 0 10px;">SellerLab · Arrivals</h3>
      <p style="margin:0 0 12px;">Ручной запуск синхронизации прямо сейчас.</p>
      <button id="run"
              style="width:100%;padding:12px 14px;border:0;border-radius:10px;
                     box-shadow:0 1px 3px rgba(0,0,0,.15);font-size:16px;cursor:pointer;">
        Обновить данные
      </button>
      <div id="status" style="margin-top:10px;color:#555;"></div>
      <script>
        const btn = document.getElementById('run');
        const status = document.getElementById('status');

        function setBusy(b) {
          btn.disabled = b;
          btn.textContent = b ? 'Обновляю…' : 'Обновить данные';
          status.textContent = b ? 'Пожалуйста, не закрывайте панель до окончания запуска.' : '';
        }

        btn.addEventListener('click', function () {
          setBusy(true);
          google.script.run
            .withSuccessHandler(function () {
              setBusy(false);
              status.textContent = 'Готово. Проверьте лист "arrivals_links" и "arrivals_log".';
            })
            .withFailureHandler(function (err) {
              setBusy(false);
              status.textContent = 'Ошибка: ' + (err && err.message ? err.message : err);
            })
            .updateArrivalsNow();
        });
      </script>
    </div>
  `).setTitle('SellerLab · Update');

  SpreadsheetApp.getUi().showSidebar(html);
}
