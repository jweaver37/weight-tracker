# Weight Tracker

A phone-first web app for logging food, weight and workouts. See `Weight Loss Tracker App - Project Spec.pdf` for the full plan.

## Running it

Plain HTML, CSS and JavaScript — no build step, no npm.

1. Open this folder in VS Code.
2. Click **Go Live** in the status bar (Live Server extension). The app opens at `http://127.0.0.1:5500`.
3. Edit and save; the page reloads.

Opening `index.html` directly from disk does not work, because browsers block JavaScript modules on `file://` pages.

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
