@echo off
rem Startet den Wellenrechner lokal und oeffnet ihn im Browser.
rem Voraussetzung: Node.js (https://nodejs.org) ist installiert.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden. Bitte von https://nodejs.org installieren.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installiere Abhaengigkeiten, das dauert beim ersten Start etwas...
  call npm install
  if errorlevel 1 (
    echo Installation fehlgeschlagen.
    pause
    exit /b 1
  )
)

echo Starte den Wellenrechner. Zum Beenden dieses Fenster schliessen.
call npm run dev -- --open
pause
