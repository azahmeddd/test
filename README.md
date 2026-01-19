# SellerLab Arrivals Apps Script

Google Apps Script project for syncing SellerLab product arrivals into Google Sheets.

## Structure

```
.
├── appsscript.json
└── src
    ├── config.js
    ├── date_utils.js
    ├── http_utils.js
    ├── link_collection.js
    ├── logging.js
    ├── login.js
    ├── main.js
    ├── misc_utils.js
    ├── parse.js
    ├── sheet_utils.js
    └── ui.js
```

## Notes

- `fetchArrivals_ToLinks_AutoLogin()` is the main incremental sync.
- `backfillArrivalsFromOldest()` runs a bounded historical backfill.
- The UI menu and sidebar are defined in `src/ui.js`.

## Deployment

Use clasp or the Apps Script editor to upload the contents of `src/` and `appsscript.json`.
