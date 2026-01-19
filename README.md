# SellerLab Arrivals Apps Script

Google Apps Script project for syncing SellerLab product arrivals into Google Sheets.

## Structure

```
.
└── src
    ├── appsscript.json
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

Use clasp or the Apps Script editor to upload the contents of `src/`.

## Connecting the script to a spreadsheet

This project is intended to run as a **bound** Apps Script attached to the Google Sheet you want to sync. That gives you the custom menu and spreadsheet access without extra authorization steps.

### Option A: Apps Script editor (no local CLI)

1. Open the target Google Sheet.
2. Go to **Extensions → Apps Script** (this opens a bound Apps Script project).
3. Replace the contents of the editor files with the files from `src/` in this repo (including `appsscript.json`).
4. Save, then refresh the spreadsheet tab.
5. The custom menu from `src/ui.js` should appear. If it does not, re-open the spreadsheet or run any top-level function once to authorize.

### Option B: clasp (recommended for keeping local files in sync)

#### 0) Prerequisites (one-time)

1. Install Node.js (LTS).
2. Install clasp and log in:
   ```bash
   npm install -g @google/clasp
   clasp login
   ```
3. Enable the Apps Script API in your Google account / project settings (required for clasp to work).

#### 1) Prepare your repo layout (important)

`clasp` expects the manifest to live inside the sync root. This repo already uses `src/` as the source folder, so ensure `appsscript.json` lives in `src/` (as shown above).

#### 2) Create a bound Apps Script project attached to your Sheet

From the repo root, create a **bound** script for the target spreadsheet:
   ```bash
   clasp create --title "SellerLab Arrivals" --type sheets --parentId 1mVEKmOBFgW14eDmCLabp-OmcNrgtEjchUADaMGqw_UA
   ```
   - This creates `.clasp.json` that points at the bound script for that specific Sheet.

#### 3) Point clasp to `src/` (rootDir)

Edit the generated `.clasp.json` (in the repo root) to include `rootDir`:

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "src"
}
```

#### 4) Push your code to Apps Script

Push the repo code:
   ```bash
   clasp push
   ```

Open the bound script to verify:
   ```bash
   clasp open
   ```

Refresh the spreadsheet. The custom menu from `src/ui.js` should now be available.

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
