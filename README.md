# AOE2 Buildguides Overlay

Windows companion app for Age of Empires II build orders.

## Start

```powershell
npm.cmd install
npm.cmd start
```

PowerShell blocks `npm.ps1` on this machine, so `npm.cmd` is the reliable command.

## Build Windows App

```powershell
npm.cmd run pack
npm.cmd run dist
```

`pack` creates an unpacked Windows app for local testing. `dist` creates portable and NSIS installer artifacts in `dist/`.

## Custom Build Orders

Use `Import` in the dashboard to load a custom build-order JSON file. Imported builds are stored in the app user data folder and merged with the built-in builds. Use `Export` to save your current custom builds.

See [examples/custom-build-orders.example.json](examples/custom-build-orders.example.json) for the supported format.

## Current MVP

- Electron desktop app with a dashboard window.
- Windows packaging through Electron Builder with portable and installer targets.
- Companion dashboard opens on the second display when Windows reports one.
- Windows tray menu keeps the app running in the background when the dashboard is closed.
- Optional start with Windows so the app can wait in the background for AOE2.
- When AOE2 starts, the dashboard can automatically move to and show on the companion display.
- The in-game overlay can automatically stay hidden until AOE2 is running.
- Transparent always-on-top in-game overlay with the current build step.
- Civ selector, build selector and villager counter.
- Custom build order import/export from the dashboard.
- Hera's December 2023 strategy guide PDF has been converted into built-in build orders in [src/data/hera-build-orders.json](src/data/hera-build-orders.json).
- Build progress is calculated live from the selected build order.
- Optional global hotkeys for manual in-game fallback:
  - `Ctrl+Shift+Up`: villager count +1
  - `Ctrl+Shift+Down`: villager count -1
  - `Ctrl+Shift+O`: toggle overlay
  - `Ctrl+Shift+D`: show dashboard
  - `Ctrl+Alt+Arrow keys`: move overlay
- AOE2 process detection for `AoE2DE_s`, `AoE2DE`, `AoK HD` and `age2_x1`.
- OCR mode prepared with `tesseract.js` for screen regions:
  - villager count region
  - civilization text region
- Civilization matching uses [src/data/civilizations.json](src/data/civilizations.json), including current DLC and Chronicles civilizations.
- OCR calibration in the dashboard:
  - editable screen regions in percent
  - crop preview for villager and civilization regions
  - full screenshot picker with draggable OCR boxes
  - manual "Test OCR now" action for calibration feedback
  - tuning for OCR interval, minimum confidence, required stable reads and crop image scale
  - settings are saved in Electron user data
- Manual mode remains available for reliable use while OCR is calibrated.

## Important Notes

AOE2 screen recognition depends on resolution, UI scale, language and whether the game runs in fullscreen, borderless or windowed mode. The app already has a detector module, but the default OCR regions in [src/main/detector.js](src/main/detector.js) are only a starting point.

For reliable automatic detection, open OCR mode, choose the display that contains AOE2, press "Refresh preview", then drag the Villagers and Civ boxes over the matching UI text. Use "Refresh preview" again until the cropped images show the right parts of the game UI.

Closing the dashboard does not quit the app. Use the tray menu to show the dashboard again, toggle the overlay, or quit completely.

## Project Structure

- [src/main/main.js](src/main/main.js) starts Electron, owns app state and creates both windows.
- [src/main/detector.js](src/main/detector.js) checks whether AOE2 is running and contains the OCR hook.
- [src/main/settings-store.js](src/main/settings-store.js) persists user calibration and overlay settings.
- [src/main/build-engine.js](src/main/build-engine.js) maps villager count to the current and next build step.
- [src/data/build-orders.json](src/data/build-orders.json) contains the first editable build orders.
- [src/data/hera-build-orders.json](src/data/hera-build-orders.json) contains converted Hera strategy guide build orders.
- [src/data/civilizations.json](src/data/civilizations.json) contains civilization names and aliases for OCR matching.
- [src/renderer/dashboard.html](src/renderer/dashboard.html) is the second-monitor dashboard.
- [src/renderer/overlay.html](src/renderer/overlay.html) is the compact in-game overlay.
