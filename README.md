# Knappe der Rauen Schlacht

KDRS ist eine Windows-Begleitapp fuer Age of Empires II Buildorders, gebaut fuer die Freundesgruppe "Maenner der rauen Schlacht".

## Start

```powershell
npm.cmd install
npm.cmd start
```

PowerShell blocks `npm.ps1` on this machine, so `npm.cmd` is the reliable command.

## Windows-App bauen

```powershell
npm.cmd run pack
npm.cmd run dist
```

`pack` erstellt eine entpackte Windows-App zum lokalen Testen. `dist` erstellt Portable- und Installer-Dateien in `dist/`.

## Capture-Benchmark

```powershell
npm.cmd run benchmark:capture
```

Der Benchmark misst native Top-Bar-Captures mit 1000ms und 2500ms Intervall. Fuer kurze Tests:

```powershell
npm.cmd run benchmark:capture -- --duration-ms 10000
```

## Eigene Buildorders

Nutze `Importieren` im Dashboard, um eine eigene Buildorder-JSON-Datei zu laden. Importierte Builds werden im App-Datenordner gespeichert und mit den eingebauten Builds zusammengefuehrt. Mit `Exportieren` kannst du deine eigenen Builds speichern.

Das unterstuetzte Format steht in [examples/custom-build-orders.example.json](examples/custom-build-orders.example.json).

## Aktueller Stand

- Electron-Desktop-App mit Dashboard-Fenster im KDRS/AOE2-inspirierten Stil.
- Windows-Packaging ueber Electron Builder mit Portable- und Installer-Ziel.
- Dashboard oeffnet bevorzugt auf dem zweiten Bildschirm, wenn Windows einen meldet.
- Tray-Menue haelt die App im Hintergrund aktiv, wenn das Dashboard geschlossen wird.
- Optionaler Start mit Windows, damit die App im Hintergrund auf AOE2 warten kann.
- Wenn AOE2 startet, kann das Dashboard automatisch auf dem Begleitbildschirm erscheinen.
- Das Ingame-Overlay bleibt optional verborgen, bis ein Match erkannt wurde.
- Transparentes Always-on-top Overlay rechts unter dem Civ-Menue mit aktuellem Build-Schritt plus den naechsten drei Schritten.
- Dezente echte AOE2-Resource-Icons fuer Food, Wood, Gold und Stone in Buildorder-Schritten.
- Civ-Auswahl, Build-Auswahl und OCR-basierte Dorfbewohneranzeige.
- Import/Export eigener Buildorders im Dashboard.
- Heras Strategy-Guide-PDF von Dezember 2023 wurde in eingebaute Buildorders in [src/data/hera-build-orders.json](src/data/hera-build-orders.json) umgewandelt.
- Build-Fortschritt wird live aus der gewaehlten Buildorder berechnet.
- Optionale globale Hotkeys:
  - `Ctrl+Shift+O`: Overlay umschalten
  - `Ctrl+Shift+D`: Dashboard anzeigen
  - `Ctrl+Alt+Pfeiltasten`: Overlay verschieben
- AOE2-Prozesserkennung fuer `AoE2DE_s`, `AoE2DE`, `AoK HD` und `age2_x1`.
- OCR ist der Standardpfad und gegen Ingame-Lag gedrosselt:
  - AOE2-Prozesscheck nur alle 2,5 Sekunden statt bei jedem UI-Tick
  - Live-Erkennung nutzt native Bildschirmaufnahme ueber `node-screenshots` statt Electron-`desktopCapturer`
  - Electron-`desktopCapturer` bleibt nur fuer manuelle Vorschau/Kalibrierung
  - Overlay erscheint erst, wenn die Ingame-Top-Bar stabil erkannt wurde
  - Dorfbewohner-OCR laeuft nur, wenn sich der kleine Dorfbewohner-Ausschnitt geaendert hat
  - Civ-OCR laeuft nur am Match-Start, bis die Civ stabil erkannt wurde
  - Live-Capture-Intervall Standard 2500ms, Match-Start-Probe Standard 1000ms
  - parallele OCR-Lesevorgaenge werden blockiert
  - Tesseract laeuft in einem separaten Worker-Thread mit Timeout und Neustart bei Haengern
- OCR mit `tesseract.js` fuer Bildschirmbereiche:
  - komplette obere AOE2-Leiste
  - Dorfbewohner-/Pop-Bereich
  - Civ-/Menuebereich
- Civ-Matching nutzt [src/data/civilizations.json](src/data/civilizations.json), inklusive aktueller DLC- und Chronicles-Zivilisationen.
- OCR-Kalibrierung im Dashboard:
  - eigene Einstellungsansicht
  - editierbare Bildschirmbereiche in Prozent
  - Ausschnittvorschau fuer obere Leiste, Dorfbewohner und Civ/Menue
  - kompletter Screenshot mit verschiebbaren OCR-Boxen
  - `OCR testen` fuer Kalibrierungsfeedback
  - Feintuning fuer OCR-Intervalle, Mindest-Sicherheit, stabile Treffer und Bildskalierung
  - Einstellungen werden in Electron-Appdaten gespeichert
- Der normale Workflow ist OCR-first; manuelles Zaehlen ist nicht mehr Teil der Hauptoberflaeche.

## Wichtige Hinweise

AOE2-Bildschirmerkennung haengt von Aufloesung, UI-Skalierung, Sprache und Fenster-/Fullscreen-Modus ab. Die Standard-OCR-Bereiche in [src/main/detector.js](src/main/detector.js) sind aus den Screenshots in `manuel_testing` abgeleitet, muessen aber am echten Setup kalibriert werden.

Fuer zuverlaessige Erkennung: Einstellungen oeffnen, den AOE2-Bildschirm waehlen, `Vorschau aktualisieren` druecken und die Boxen fuer obere Leiste, Dorfbewohner und Civ/Menue passend ziehen. Danach `OCR testen` nutzen.

Das Schliessen des Dashboards beendet die App nicht. Ueber das Tray-Menue kannst du das Dashboard wieder anzeigen, das Overlay umschalten oder die App komplett beenden.

## Projektstruktur

- [src/main/main.js](src/main/main.js) startet Electron, verwaltet App-State und erstellt beide Fenster.
- [src/main/detector.js](src/main/detector.js) erkennt AOE2 und enthaelt den OCR-Pfad.
- [src/main/capture-provider.js](src/main/capture-provider.js) kapselt die native Live-Bildschirmaufnahme.
- [src/main/ocr-worker-thread.js](src/main/ocr-worker-thread.js) fuehrt Tesseract ausserhalb des Electron-Hauptprozesses aus.
- [src/main/settings-store.js](src/main/settings-store.js) speichert Kalibrierung und Overlay-Einstellungen.
- [src/main/build-engine.js](src/main/build-engine.js) ordnet Dorfbewohnerzahl dem aktuellen und den naechsten Build-Schritten zu.
- [src/data/build-orders.json](src/data/build-orders.json) enthaelt die ersten editierbaren Buildorders.
- [src/data/hera-build-orders.json](src/data/hera-build-orders.json) enthaelt konvertierte Hera-Strategy-Guide-Buildorders.
- [src/data/civilizations.json](src/data/civilizations.json) enthaelt Civ-Namen und Aliase fuer OCR-Matching.
- [src/renderer/dashboard.html](src/renderer/dashboard.html) ist das Dashboard fuer den zweiten Bildschirm.
- [src/renderer/overlay.html](src/renderer/overlay.html) ist das kompakte Ingame-Overlay.
