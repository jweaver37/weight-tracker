# Weight Tracker

A phone-first web app for logging food, weight, body measurements and workouts.

**Live app:** https://jweaver37.github.io/weight-tracker/

## Running it

Plain HTML, CSS and JavaScript — no build step, no npm.

1. Open this folder in VS Code.
2. Click **Go Live** in the status bar (Live Server extension). The app opens at `http://127.0.0.1:5500`.
3. Edit and save; the page reloads.

Opening `index.html` directly from disk does not work, because browsers block JavaScript modules on `file://` pages.

A Content Security Policy in `index.html` only allows the app's own files and the USDA API. It also blocks Live Server's injected auto-reload script, so refresh the page by hand after saving. Bump `CACHE` in `sw.js` with each change so installed copies pick it up.

Phones need an `https` address (GitHub Pages). On iPhone, use **Share → Add to Home Screen** so Safari keeps the app's data.

## Code layout

| Folder | What lives there |
| --- | --- |
| `js/core/` | Pure logic: nutrition math, targets, trends, units, dates. No DOM or storage — translates to C# section by section for Phase 3. |
| `js/data/` | IndexedDB storage, per-user records, export/import. |
| `js/ui/` | Screens and UI helpers. |

Every record carries a `userId`, and data is stored in metric (kg, cm) and converted for display.

## Data

Data lives in the browser's IndexedDB on each device. Clearing browser data erases it — export a backup from Settings regularly, and use export → import to move between devices.
