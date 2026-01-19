/* =========================================================
 * SellerLab · Product Arrivals configuration
 * ========================================================= */
const CFG = {
  BASE: 'https://app.sellerlab.uz',
  PAGE_URL: 'https://app.sellerlab.uz/customer/product-arrivals',
  TABLE_SORT_PATH: '/api/table-sort',

  // OUTPUT
  OUT_SHEET: 'arrivals_links',
  LOG_SHEET: 'arrivals_log',

  // SPREADSHEET
  SPREADSHEET_ID: '1mVEKmOBFgW14eDmCLabp-OmcNrgtEjchUADaMGqw_UA',

  // LOGIN
  PHONE: '77078808084',
  PASSWORD: 'Q123456789',

  // PAGINATION
  ITEMS_PER_PAGE: 100,
  MAX_PAGES: 300,           // incremental mode max pages
  BACKFILL_MAX_PAGES: 2000, // backfill mode max pages

  // SAFETY / QUOTA
  MAX_NEW_LINKS_PER_RUN: 250,     // prevents deep page scans on large backlogs
  MAX_ORDER_PAGES_PER_RUN: 250,   // prevents huge order page downloads in one run
  FETCHALL_BATCH: 10,             // batch size for fetchAll() on order pages
  SLEEP_MS_EACH: 50,

  DEFAULT_QUERY: {
    itemsPerPage: '100',
    sortBy: '',
    direction: '',
    customer_id: 'all',
    type: 'all',
    from: '',
    to: '',
    page: '1',
    search: '',
    target: 'productTransaction'
  },

  TIMEZONE: 'Asia/Tashkent'
};
