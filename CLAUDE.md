# StudyLog-Mext (Ablauf-Variante) — Projektkontext für Claude

## Was ist das
Progressive Web App zur Durchführung von Studien-Sessions mit Teilnehmenden in VR-Szenarien.
**Diese Repo-Kopie basiert auf StudyLog-Mext und wird strukturell umgebaut:** weg von der
bisherigen Tab-/Screen-Navigation, hin zu einem **einzigen chronologischen Studienablauf**
aus einzelnen Ablaufschritten (siehe "Umbau: Von Tabs zu Ablaufschritten" unten). Mehrere
Studienleitungen (VR-Team und SEN-Team) nutzen die App gleichzeitig auf eigenen Smartphones,
vollständig offline. Deployment: GitHub Pages.

> Repo-Name / Deployment-Ziel für diese Variante: noch festzulegen (TODO).

## Tech-Stack
Vanilla HTML/CSS/JS, kein Build-Schritt, keine Frameworks/Dependencies. Datenhaltung
ausschließlich lokal via `localStorage`. Offline-Fähigkeit über Service Worker (`sw.js`).

## Umbau: Von Tabs zu Ablaufschritten

### Ziel
Die bisherige Navigation über Tabs/Screens (Teilnehmende · Sensorik · Szenario · Protokoll ·
Bewertung · Ereignisse · Export · Einstellungen) wird für die **Session-Durchführung** ersetzt
durch einen **linearen, zeitlich geordneten Ablauf**, der 1:1 dem realen Studienablauf folgt.

Pro Ablaufschritt:
- **Start** und **Ende** erfassbar — entweder per Button (Timestamp = jetzt) oder per
  manueller Eingabe/Korrektur einer Uhrzeit.
- **Hinweis/Anmerkung** als Freitext pro Schritt hinzufügbar.
- Schritte sind der/dem aktuell laufenden Teilnehmenden zugeordnet.

Die Labels **VR / SEN / TMS (extern)** an den Schritten sind **rein informativ** (Kontext,
welches Team den Schritt fachlich verantwortet) — keine Filter-, Rollen- oder
gerätespezifische Logik.

### Kanonischer Ablauf (Schritte)

**Aktueller Stand (seit v2.27.0, 16 Schritte) — ersetzt die ursprüngliche 19-Schritt-Planung
unten in diesem Abschnitt:** die Schritte „Ankommen, Begrüßung" sowie „VR-Equipment/VR-Brille
an-/ablegen" (Hologate **und** Rollercoaster) entfallen ersatzlos; der Trainerbewertungsbogen
ist kein eingebetteter Abschnitt an einem Fragebogen-Schritt mehr, sondern ein **eigener
Schritt direkt nach dem jeweiligen VR-Durchlauf**.

| Nr. | Schritt | Label |
|-----|---------|-------|
| 1   | Aufklärung + Einverständniserklärung | VR / SEN |
| 2   | Anlegen Sensorik (Shimmer, Brustgurt, Uhr) | SEN |
| 3   | Fragebogen 1 | SEN / VR |
| 4   | TMS (ca. 0,5 h) | TMS (extern) |
| 5   | Fragebogen 2 | SEN / VR |
| 6   | Einweisung + Tutorial VR (Hologate) | VR |
| 7   | VR-Szenarien Hologate (5 Szenarien) | VR |
| 8   | Trainerbewertungsbogen (Hologate) | VR |
| 9   | Fragebogen 3 | SEN / VR |
| 10  | Rollercoaster (Varjo) | VR |
| 11  | Trainerbewertungsbogen (Rollercoaster) | VR |
| 12  | Fragebogen 4 | SEN / VR |
| 13  | Stop Sensorik (Aufzeichnung beenden) | SEN |
| 14  | Sensorik ablegen | SEN |
| 15  | Verabschiedung | VR / SEN |
| 16  | Datensicherung (VR) / Desinfektion & Aufbereitung Sensorik (SEN) / StudyLog-Daten sichern (beide) | VR / SEN |

Diese Liste ist die Referenz für die Default-Schritte. Ob die Schrittliste im UI
editierbar/erweiterbar ist, ist noch offen (siehe unten).

### Teilnehmende anlegen — Verortung im Ablauf
Das **Anlegen neuer Teilnehmender erfolgt durch das VR-Team**, zeitlich **nach Schritt 1
(Aufklärung + Einverständniserklärung)** und **parallel zu Schritt 2** (während das SEN-Team
die Sensorik anlegt).

- Einwilligung zuerst: Schritt 1 muss abgeschlossen sein, bevor personenbezogene Daten
  (Pseudonym, Handedness) angelegt werden — deckt sich mit DSGVO (Einwilligung vor
  Verarbeitung).
- Schritt 2 hat damit zwei nebenläufige Stränge, die unabhängig Start/Ende + Notiz tragen:
  - **SEN:** Sensorik anlegen (Sensorik-Checkliste mit Timestamps).
  - **VR:** Teilnehmende:n im System anlegen (Pseudonym-Vergabe, Handedness).
- Die Anlage-Aktion wird an/neben Schritt 2 in den Ablauf eingebettet (Vermerk „Anlegen
  durch VR"), nicht in eine dauerhaft eigene Rahmen-Ansicht ausgelagert.

### Bestehende Funktionen wandern in den Ablauf
Die Inhalte der bisherigen Feature-Tabs werden **kontextabhängig in die passenden
Ablaufschritte eingebettet**, nicht als separate Tabs beibehalten:
- **Sensorik-Checkliste** (abhakbare Items mit Timestamp) → Schritt 2 „Anlegen Sensorik".
- **VR-Szenario-Ablauf mit Timestamps** (Szenario in Teilschritte unterteilt, je abhakbar) →
  Schritt 7 „VR-Szenarien Hologate" bzw. Schritt 10 „Rollercoaster".
- **Trainerbewertungsbogen** (reduziert auf 4 Items, siehe `docs/ARCHITECTURE.md`) → eigener
  Schritt direkt nach dem jeweiligen VR-Durchlauf (Schritt 8 nach Hologate, Schritt 11 nach
  Rollercoaster), nicht mehr an einem Fragebogen-Schritt eingebettet.
- **Ereignis-Erfassung** (Zeitpunkt-/Zeitraum-Erfassung von Problemen) → pro Schritt bzw. als
  schrittübergreifende Erfassung im Ablauf.
- **Handedness (Links-/Rechtshänder)** → Attribut der Teilnehmenden, gesetzt beim Anlegen
  durch VR (parallel zu Schritt 2), relevant für Sensorplatzierung.

**Export** und **Einstellungen** bleiben zunächst als Rahmen-Ansichten bestehen (kein
Ablaufschritt).

### Noch offen (iterativ mit Claude klären, dann /docs ergänzen)
- Datenmodell für Ablauf-Instanz pro Teilnehmende:r (Schritt-IDs, Start/Ende, Notiz,
  Status offen/laufend/erledigt; nebenläufige Stränge in Schritt 2).
- Ob „Teilnehmende:n auswählen/wechseln" trotz Einbettung der Anlage weiterhin jederzeit
  global erreichbar sein muss (gestaffelte Durchläufe mehrerer Personen) oder ob der Ablauf
  strikt an genau eine:n aktive:n Teilnehmende:n gebunden ist.
- Wie werden bestehende `localStorage`-Daten aus der Tab-Version migriert bzw. koexistieren?
- Editierbarkeit der Schrittliste (fixe Defaults vs. pro Session anpassbar).
- Navigation im Ablauf: freies Springen vs. sequenziell; Verhalten bei parallelen Geräten
  (VR-Team/SEN-Team) ohne Sync.
- Zusammenspiel „ein Ablauf" mit „mehreren VR-Szenarien" (Schritt 7: 5 Szenarien) und
  mehreren Bewertungsbögen.
- Ob der bisherige Session-Timer/„Protokoll" vollständig im Ablauf aufgeht.

## Datenschutz (hart, nicht verhandelbar)
- Keine Daten verlassen das Gerät — kein externer Server, kein Tracking, keine Analytics.
- Pseudonymisierung nach Art. 4 Nr. 5 DSGVO.
- Einwilligung vor Verarbeitung: personenbezogene Teilnehmendendaten erst nach Schritt 1
  (Einverständniserklärung) anlegen.
- Gendergerechte Sprache im UI: "Teilnehmende", nicht "Probanden" (Variablennamen im Code
  dürfen weiterhin `Proband*` heißen — nur sichtbare UI-Texte müssen genderneutral sein).
- Handedness-Auswahl: keine besondere Sensitivität, aber wie alle Teilnehmendendaten
  ausschließlich lokal speichern.

## Nicht verhandelbare Arbeitsregeln
1. **Strukturumbau ist die einzige bewusste Ausnahme von "strict non-regression":** Der
   Wechsel von Tabs zu Ablaufschritten ist gewollt und darf die Navigation/Screens ersetzen.
   **Innerhalb dieses Umbaus gilt weiterhin: kein stiller Funktions- oder Datenverlust.**
   Jede bestehende Erfassungsmöglichkeit (Sensorik-Items, Szenario-Timestamps, 20-Item-
   Bogen, Ereignisse, Handedness, Teilnehmenden-Anlage, Export-Umfang) muss im neuen
   Ablauf-UI erhalten bleiben oder bewusst und abgesprochen entfallen. Alles außerhalb des
   Umbaus bleibt rein additiv oder visuell.
2. **Minimale Diffs**: Kein Refactoring "nebenbei". Wenn ein Bug auftritt: auf den letzten
   bestätigt stabilen Stand zurück, dann nur die minimal nötige Änderung.
3. **Root Cause statt Symptom-Fix**: Ursache systematisch diagnostizieren, keine
   Vermutungs-Fixes.
4. Vor dem Debuggen von Deployment-Fehlern: https://githubstatus.com prüfen (in der
   Vergangenheit gab es dadurch False-Positive-Rabbit-Holes).

## Versionierung (WICHTIG — bei jeder inhaltlichen Änderung)
Single Source of Truth: `const APP_VERSION` ganz oben in `app.js`.

Bei **jedem Commit, der Funktionalität/Inhalt ändert** (nicht bei reinen Doku-Änderungen):
1. `APP_VERSION` in `app.js` hochzählen — Patch (`2.2.1` → `2.2.2`) für Bugfixes/kleine
   Änderungen, Minor (`2.2.x` → `2.3.0`) für neue Features, Major nur nach expliziter Absprache.
2. `CACHE`-Konstante in `sw.js` synchron auf denselben Wert setzen (aktuelles Schema:
   `studylog-v<version>`, z.B. `studylog-v2.13.0`) — erzwingt Invalidierung des alten
   Service-Worker-Caches.
3. Die statischen `<span class="app-version">` Platzhalter in `index.html` (aktuell 2x:
   Sidebar-Footer + mobile Topbar) auf denselben Wert setzen — sie werden zusätzlich beim
   Laden per JS aus `APP_VERSION` überschrieben (Zeile mit
   `document.querySelectorAll('.app-version')...` im INIT-Block von `app.js`), das ist nur
   der No-Flash-Fallback für den ersten Paint.

> Der Tabs→Ablauf-Umbau ist ein Kandidat für einen **Major-Bump** — vor dem ersten
> Umbau-Commit mit dem/der Nutzer:in klären.

## Bekannte, bereits gelöste Bugs (nicht wiederholen)
- iOS Safari PWA: `<div>` als Klick-Ziel funktioniert nicht zuverlässig → immer `<button>`.
- iOS Zoom bei Input-Fokus: `font-size: 16px` auf Inputs + Viewport-Meta-Fix.
- Samsung Android Touch-Bug: `maximum-scale=1.0, user-scalable=no` aus Viewport entfernen.
- Service-Worker-Deadlock: `sw.js` darf sich nicht selbst in `ASSETS` cachen.
- Confirm-Dialog z-index: `#confirm-overlay` braucht `z-index: 300`.
- `.hidden`-Klasse muss `display: none !important` sein — `opacity:0; pointer-events:none`
  lässt unsichtbare Elemente Klicks blockieren.
- Alles JS in `DOMContentLoaded` wrappen (sonst iOS-PWA-Button-Fails).
- Delete-Bug-Muster: IDs vor dem Nullen in `const` zwischenspeichern.

## Git-Workflow in dieser Umgebung
Der verbundene Ordner läuft über eine Sandbox-Bridge, die zwar Dateien schreiben, aber keine
Dateien löschen/umbenennen kann — `git commit`/`git push` funktionieren darüber **nicht
zuverlässig** (Lock-Dateien bleiben hängen). Deshalb: Claude bearbeitet Dateien direkt
(Edit/Write), Commit + Push erfolgt lokal in SourceTree oder Git Bash. Claude schlägt dazu
jeweils eine Commit-Message vor.

## Datenschutz für Projektdateien selbst
Keine personenbezogenen Daten (Namen, Arbeitgeber o.ä.) in Code-Kommentare, Doku-Dateien,
Commit-Messages oder sonstige Texte schreiben, die Claude erstellt oder bearbeitet.

## Technische Dokumentation (`/docs`)
Es existiert eine ausführliche technische Dokumentation unter `/docs`
(`OVERVIEW.md`, `DATENFLUSS.md`, `BEDIENUNG.md`, `ARCHITECTURE.md`) — u.a. Grundlage für eine
Datenschutz-Bewertung (DSGVO/DSFA) und für neue Entwickler:innen/KI-Modelle ohne Chatverlauf.
**Bei jeder Code-Änderung, die Datenerfassung, -speicherung, -übertragung, Architektur oder
Bedienung betrifft, die passende(n) Datei(en) in `/docs` automatisch mitaktualisieren** —
ohne dass extra danach gefragt werden muss. Unklare Datenschutz-Aspekte in `DATENFLUSS.md`
weiterhin mit "TODO: Datenschutz prüfen" markieren. **Der Tabs→Ablauf-Umbau betrifft
Architektur und Bedienung umfassend: sobald Umsetzungsdetails feststehen, alle vier
/docs-Dateien entsprechend nachziehen.**
