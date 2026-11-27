# Wellenrechner nach DIN 743

Werkzeug für den Tragfähigkeitsnachweis von Wellen und Achsen nach DIN 743 Teil 1 bis 3 (Teil 1 und 2: 12/2012, Teil 3: 07/2024). Ziel ist nicht nur das Ergebnis, sondern ein nachvollziehbarer Rechenweg: Jede berechnete Größe kommt mit Formel, eingesetzten Zahlen, Fundstelle in der Norm und einer kurzen Erklärung, warum sie gebraucht wird.

Aufgebaut wie der [Schraubenrechner nach VDI 2230](https://github.com/OttoElle/Screw-Calculator).

## Stand

**Schritt 1: Rechenkern** (`src/core/`)

- Nachweis für einen Kerbquerschnitt mit Zug/Druck, Biegung und Torsion (Mittelwert, Amplitude, Maximalwert), Voll- und Hohlwelle
- Ablauf nach DIN 743-1, Anhang B: Werkstoffkennwerte, technologischer Größeneinfluss K1(deff), Kerbwirkungszahl, Gesamteinflussfaktor, Nennspannungen, Bauteilfließgrenze, Bauteildauerfestigkeit, Sicherheiten
- Nachweis gegen Dauerbruch (Beanspruchungsfall 1 und 2, einschließlich Druckmittelspannungen nach Tabelle A.1) und gegen bleibende Verformung
- Kerbformen nach DIN 743-2: Absatz (auch mit Freistich), Rundnut, Querbohrung (über Formzahl und Stützzahl) sowie Passfedernut, Pressverband, Keil-, Kerbzahn- und Zahnwelle, Spitzkerbe, Sicherungsringnut (experimentelle Kerbwirkungszahlen mit Umrechnung über K3) und eigene Kerbwirkungszahlen
- Rauheitseinfluss KF, Oberflächenverfestigung KV als Eingabe, harte Randschicht
- Werkstoffe aus DIN 743-3, Tabellen A.1 bis A.5, mit der jeweils passenden K1-Gleichung

Die Tests in `src/core/calculate.test.ts` rechnen alle drei Beispiele aus DIN 743 Beiblatt 1 (07/2024) nach, einschließlich der Zwischenergebnisse. Die Abweichungen liegen unter 1 %.

**Schritt 2: Entwurfsberechnung** (`src/core/design.ts`)

- Überschlägiger Mindestdurchmesser aus dem Vergleichsmoment Mv = √(Mb² + 0,75 · (α0 · T)²) und einer zulässigen Spannung mit geschätztem Gesamteinflussfaktor. Dieser Ansatz ist nicht Teil der DIN 743 und wird auch so gekennzeichnet.
- Mindestdurchmesser nach DIN 743 durch Rückwärtsrechnung: Der vollständige Nachweis wird gelöst, bis die maßgebende Sicherheit gerade Smin erreicht, wobei die Kerbmaße maßstäblich mitwachsen. Dazu kommen der auf ganze Millimeter gerundete Durchmesser mit Nachweis und der Verlauf S(d) für ein Diagramm.

**Schritt 3: Web-App** (`src/App.tsx`, `src/ui/`)

- Eingabemaske mit Werkstoffauswahl nach DIN 743-3 (oder eigener Werkstoff), Kerbform mit passenden Maßen, Oberfläche, Belastung als Mittelwert, Amplitude und Maximalwert, Beanspruchungsfall. Die Eingaben werden im Browser gespeichert.
- Nachweis: Ergebnis mit Auslastungsbalken, schematische Kerbskizze, Ablaufschema nach DIN 743-1 Anhang B (ein Klick springt zum Rechenschritt) und ein Rechenweg, der jede Größe mit Formel, eingesetzten Werten, Normstelle und Erklärung zeigt
- Entwurf: Überschlag und Mindestdurchmesser nach DIN 743, Diagramm S(d), Übernahme des Durchmessers mit maßstäblich angepassten Kerbmaßen
- Die drei Beispiele aus Beiblatt 1 lassen sich direkt laden
- Automatisches Deployment auf GitHub Pages bei jedem Push auf `main` (`.github/workflows/deploy.yml`)

Noch nicht enthalten: Nachweis gegen Anriss bei harten Randschichten (DIN 743-1, 5.1.2), Zeitfestigkeit (DIN 743-4).

## Nächste Schritte

1. Später: Schnittgrößen aus einem Wellenmodell mit Lagern und Kräften, Zeitfestigkeit nach Teil 4, PDF-Bericht

## Lokal starten (Windows)

Node.js installieren (https://nodejs.org), dann `start.bat` doppelklicken. Beim ersten Start werden die Abhängigkeiten installiert, danach öffnet sich die App im Browser.

## Entwicklung

```bash
npm install
npm test          # Rechenkern-Tests
npm run lint
npm run typecheck
npm run dev       # Entwicklungsserver
```

Hinweis: Die Norm selbst ist urheberrechtlich geschützt und nicht Teil dieses Repositorys.
