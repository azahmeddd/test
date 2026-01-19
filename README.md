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

## Connecting the script to a spreadsheet

This project is intended to run as a **bound** Apps Script attached to the Google Sheet you want to sync. That gives you the custom menu and spreadsheet access without extra authorization steps.

### Option A: Apps Script editor (no local CLI)

1. Open the target Google Sheet.
2. Go to **Extensions → Apps Script** (this opens a bound Apps Script project).
3. Replace the contents of the editor files with the files from `src/` in this repo (and keep `appsscript.json` in the project).
4. Save, then refresh the spreadsheet tab.
5. The custom menu from `src/ui.js` should appear. If it does not, re-open the spreadsheet or run any top-level function once to authorize.

### Option B: clasp (recommended for keeping local files in sync)

1. Install clasp and log in:
   ```bash
   npm install -g @google/clasp
   clasp login
   ```
2. Create a **bound** script for the target spreadsheet:
   ```bash
   clasp create --title "SellerLab Arrivals" --type sheets --parentId <SPREADSHEET_ID>
   ```
   - This creates `.clasp.json` that points at the bound script for that specific Sheet.
3. Push the repo code:
   ```bash
   clasp push
   ```
4. Refresh the spreadsheet. The custom menu from `src/ui.js` should now be available.

## Scheduling automatic runs (Apps Script triggers)

Apps Script triggers are how you schedule automatic syncing. These are set **inside the Apps Script project** (the bound script attached to the Sheet).

### Add a time-driven trigger (in the Apps Script UI)

1. Open the bound script (from the Sheet: **Extensions → Apps Script**).
2. Click the **Triggers** icon (alarm clock) in the left sidebar.
3. Click **Add Trigger** (bottom right).
4. Set:
   - **Choose which function to run**: pick the function you want scheduled (for example, `fetchArrivals_ToLinks_AutoLogin()`).
   - **Choose which deployment should run**: `Head`.
   - **Select event source**: `Time-driven`.
   - **Select type of time based trigger**: choose your schedule (hourly, daily, etc.).
5. Save and authorize the project when prompted.

### Add a menu item that creates a trigger (optional)

If you want a one-click menu action that creates triggers, add a new menu entry in `src/ui.js` that calls a trigger-setup function. You can then implement that function to call `ScriptApp.newTrigger(...)`. (No code changes are made in this update; this is just a pointer if you want the menu-driven setup later.)
