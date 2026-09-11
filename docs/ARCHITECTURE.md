# StudyLog-V2 — Architektur (für Entwickler:innen & KI-Modelle)

> Diese Datei ist so geschrieben, dass ein neues Modell **ohne vorherigen Chatverlauf**
> allein daraus produktiv am Projekt weiterarbeiten kann. Für Kontext zu Zweck/Zielgruppe
> siehe [OVERVIEW.md](./OVERVIEW.md), für Datenschutz-Details [DATENFLUSS.md](./DATENFLUSS.md).
> **Verbindliche Arbeitsregeln für Änderungen an diesem Projekt stehen in `/CLAUDE.md`
> im Repo-Root — unbedingt vorher lesen** (u. a. Strict-Non-Regression, minimale Diffs,
> Versionierungspflicht bei jeder inhaltlichen Änderung).

## Ordnerstruktur

```
StudyLog-V2/
├── index.html          # App-Shell: alle Screens + Overlays als statisches Markup
├── style.css            # Gesamtes Styling (Dark-Mode, responsives Layout)
├── app.js                # Gesamte Anwendungslogik (einzige JS-Datei der ausgelieferten App)
├── sw.js                 # Service Worker für Offline-Fähigkeit
├── manifest.json          # PWA-Manifest
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── README.md              # Kurzüberblick, Deployment-Anleitung
├── CLAUDE.md               # Verbindliche Arbeitsregeln für Änderungen an diesem Projekt
└── docs/                    # Diese Dokumentation
    ├── OVERVIEW.md
    ├── DATENFLUSS.md
    ├── BEDIENUNG.md
    └── ARCHITECTURE.md
```

**Nicht Teil der ausgelieferten/deployten App** (von `index.html`/`sw.js` nicht referenziert):
`debug.html` und `download` im Repo-Root sind ältere, textuelle Kopien einer früheren
`app.js`-Version (ohne die Bewertungsbogen-Funktion) — vermutlich Debug-/Backup-Artefakte.
Sie werden von `sw.js` nicht gecacht und von `index.html` nicht eingebunden. Vor dem
Löschen/Ändern dieser Dateien Rücksprache halten, da unklar ist, ob sie noch als Referenz
gebraucht werden (siehe Arbeitsregel "Root Cause statt Symptom-Fix" / "nicht ungefragt
löschen" in `CLAUDE.md`). Ebenso `icon-512 (1).png` im Root ist vermutlich ein Duplikat von
`icons/icon-512.png` und nicht Teil des aktiven Manifests.

## Laufzeitmodell

Es gibt **keinen Build-Schritt**. `index.html` lädt `style.css` und `app.js` direkt per
`<link>`/`<script>`-Tag; alle Dateien werden unverändert per GitHub Pages ausgeliefert.
`app.js` ist komplett in einen `DOMContentLoaded`-Listener gewrappt (Pflicht laut
`CLAUDE.md` — verhindert bekannte iOS-PWA-Button-Bugs). Alle Funktionen, State-Variablen und
Event-Listener leben in diesem einen Closure-Scope; es gibt keine Module/Imports.

## Kernkonzept: State + Persistenz

`app.js` hält den gesamten Anwendungszustand in modul-lokalen `let`-Variablen (z. B.
`probanden`, `sessions`, `scenarios`, `tags`, `bewertungen`, `events`, `eventTags`, `settings`
sowie UI-/Timer-State wie `sessionRunning`, `selectedScenId`, `detailSessionId`,
`selectedEventType`). Zwei zentrale Funktionen synchronisieren diesen State mit
`localStorage`:

- **`load()`** — beim Start einmal aufgerufen, liest alle acht
  `localStorage`-Keys, parsed JSON, füllt fehlende/leere Konfigurationslisten
  (`scenarios`, `tags`, `eventTags`) mit Defaults auf und stellt sicher, dass jeder
  `probanden`-Eintrag ein `sensorik`-Objekt hat. Der frühere globale Key `sl_sensorik`
  (v2.9.0) wird verworfen (`localStorage.removeItem`).
- **`save()`** — nach **jeder** datenverändernden Aktion aufgerufen, schreibt alle acht
  State-Variablen zurück in `localStorage`. Kein Debouncing/Batching — jede einzelne
  Aktion (Person anlegen, Sitzung speichern, Tag umbenennen, Ereignis erfassen …) löst
  einen vollständigen `save()`-Durchlauf aus.

**Wichtig für Änderungen:** Da `save()` immer alle Keys neu schreibt, reicht es bei
neuen Feldern, die betroffene State-Variable (z. B. ein Objekt in `probanden`) zu ergänzen —
es muss keine Migration/Schema-Version gepflegt werden. Es gibt **keine
Schema-Versionierung** von `localStorage`-Daten; neue Felder müssen daher stets mit
`undefined`/`null`-Fallbacks für Alt-Daten umgehen können (siehe z. B. `p.sensorAngelegtISO
|| p.createdAt` in `app.js:357`).

### `localStorage`-Keys und Datenmodelle

| Key | State-Variable | Datensatz-Form (wichtigste Felder) |
|---|---|---|
| `sl_probanden` | `probanden` | `{ id, pseudo, sensor, note, handedness, sensorik, sensorikAblegen, ablauf, szenarien, bewertungen, ereignisse, sensorAngelegtISO, sensorAbgelegtISO, createdAt, _flowIdsMigratedV227, _tutorialTimeMigratedV228, _verabschiedungRemovedV232, _rcTimeMigratedV232 }` — `sensor`: Sensoriknummer 1–12 **oder `''`**; seit v2.10.1 **nicht mehr im Anlege-Formular**, im Bearbeiten-Dialog optional (nur bei Eingabe auf 1–12 + Eindeutigkeit geprüft). `handedness`: `'Rechts'` \| `'Links'` — Pflichtfeld beim Anlegen/Bearbeiten (Formular erzwingt eine Auswahl). `sensorik`: Objekt `{ [itemId]: isoString }` — Zeitpunkt „angelegt" je Sensorik-Item (Tab „Sensorik"/Ablauf-Schritt 2), fehlender Schlüssel = noch nicht angelegt. Item-IDs/-Labels fest in `SENSORIK_ITEMS` (Shimmer / Brustgurt / Uhr). `sensorikAblegen` (seit v2.32.0): Objekt derselben Form `{ [itemId]: isoString }`, aber eigener Datenspeicher für den Ablege-Zeitpunkt (Ablauf-Schritt 14 „Sensorik ablegen") — unabhängig von `sensorik`, dieselben `SENSORIK_ITEMS`, gerendert über `sensorikAblegenSectionHTML()`/`toggleAblaufSensorikAblegen(id)`/`resetAblaufSensorikAblegen()` (Pendants zu den fs_02-Funktionen). `ablauf` (seit v2.13.0): Objekt `{ [stepId]: { startISO, endISO, note, noteISO, done? } }` — Start-/Endzeit je Studienschritt (Bereich „Ablauf"), fehlender Schlüssel = Schritt noch offen; leerer Schritt wird nicht persistiert. `note`/`noteISO` (seit v2.21.0, **seit v2.30.0 ohne eigenes Eingabefeld**): der frühere separate „Hinweis / Anmerkung"-Punkt je Schritt entfiel, weil inhaltlich doppelt zu „Ereignisse / Probleme / Anmerkungen" (`ereignisSectionHTML`, dorthin gehören freie Anmerkungen jetzt). Alt-Daten mit bereits gesetztem `note` bleiben unangetastet erhalten — `writeFlowStep`/`clearFlowStep` übernehmen `prev.note`/`prev.noteISO` beim Schreiben/Leeren, ohne sie zu lesen oder zu setzen; `flowStepState`/`flowStepStateFor` und die Zeilen-Zusammenfassung berücksichtigen `note` seither **nicht mehr**. `done` (seit v2.25.0, nur an den Fragebogen-Schritten `FRAGEBOGEN_STEPS` = `fs_03`/`fs_05`/`fs_09`/`fs_12`) = ISO-Zeitstempel der Checkbox „Fragebogen ausgefüllt"; gesetzt → `flowStepStateFor` liefert `komplett`. `toggleFragebogenDone(stepId)` schaltet ihn um; `writeFlowStep`/`clearFlowStep` lassen ihn unangetastet. **`NO_TIME_STEPS` = `fs_01`/`fs_02`/`fs_07`/`fs_10`/`fs_14`/`LAST_FLOW_STEP_ID` (`fs_15`) + alle `BEW_STEP_META`-Schritte (`fs_08`/`fs_11`) + alle `FRAGEBOGEN_STEPS`** (per Spread zusammengesetzt) haben keine Start/Ende-Felder — `flowStepFieldsHTML` rendert dort seit v2.30.0 nur noch die schrittabhängigen Zusatzelemente (aktuell einzig die Fragebogen-Checkbox, siehe unten); ohne diese ist die Rückgabe leer (`fs_01` immer, `fs_02`/`fs_07`/`fs_10`/`fs_14`/`fs_08`/`fs_11`/`LAST_FLOW_STEP_ID` mangels Checkbox ebenfalls). An den `FRAGEBOGEN_STEPS` rendert `flowStepFieldsHTML` die Checkbox „Fragebogen ausgefüllt" (`#ablauf-edit-done` → `toggleFragebogenDone`) — seit v2.26.1 sind alle vier identisch aufgebaut (nur die Checkbox, keine Zeitfelder, kein eingebetteter Bewertungsbogen mehr). `fs_07` seit v2.24.0 und `fs_10` seit v2.32.0 ohne Zeitfelder (Zeiten stecken in den jeweiligen Durchlauf-Phasen, siehe `szenarien` unten), `fs_08`/`fs_11` seit v2.27.0 (Trainerbewertungsbogen als eigener Schritt, kein Timer — die Bögen tragen ihr eigenes `savedAt`), `fs_14` seit v2.32.0 (Sensorik-Ablege-Checkliste statt Zeitfeldern), `LAST_FLOW_STEP_ID` seit v2.32.0 (zwei Häkchen ohne Zeiterfassung statt Start/Ende, siehe unten).

**`SINGLE_TIME_STEPS` = `fs_13`** (seit v2.32.0): genau **ein** Zeitpunkt statt Start+Ende — „Stop Sensorik" erfasst nur, wann die Aufzeichnung beendet wurde, kein Zeitraum. `flowStepFieldsHTML` rendert für diese Schritte ein einzelnes Zeitfeld mit derselben Eingabefeld-Id `ablauf-edit-start` wie sonst der Start (Button „Jetzt"/manuelle Eingabe schreiben also weiterhin über `writeFlowStep`/`clearFlowStep` nach `p.ablauf[stepId].startISO`, ein fehlendes Ende-Feld wird dort bereits generisch berücksichtigt); `endISO` bleibt für diese Schritte stets `null`. `flowStepStateFor`/die Zeilen-Zusammenfassung werten für `SINGLE_TIME_STEPS` nur `startISO` (nicht `startISO`+`endISO`) für den Status `komplett`. Beschriftung „Zeitpunkt" + erklärender Hinweistext über `TIME_FIELD_LABELS.fs_13`. **`fs_06` (Tutorial) ist bewusst NICHT in `NO_TIME_STEPS`:** hatte zwischen v2.26.0 und v2.27.x einen eigenen Szenario-Durchlauf mit Tap-Phasen „Tutorial starten"/„Tutorial beendet", seit v2.28.0 aber wieder normale Start-/Ende-Felder wie `fs_04` „TMS" (Migration siehe unten). Seit v2.29.1 über `TIME_FIELD_LABELS[stepId]` mit abweichender Beschriftung/Hinweistext (`flowStepFieldsHTML` nutzt `cfg.start`/`cfg.end` statt „Start"/„Ende" und rendert `cfg.hint` als `<p class="meta-text">` oberhalb der Zeitfelder, falls ein Eintrag existiert): `fs_06` → „Start (VR-Tutorial)"/„Ende (VR-Tutorial)" + Hinweis, dass explizit das VR-Szenario-Tutorial gemeint ist, nicht die vorangehende Einweisung/der gesamte Schritt (kein Eintrag für andere Schritte → unveränderte Standardbeschriftung „Start"/„Ende"). **„Schritt leeren"** (`#ablauf-edit-clear` → `clearFlowStep`) rendert `flowStepFieldsHTML` seit v2.30.0 nur noch an Schritten **mit** Zeitfeldern (entfernt dort ausschließlich Start/Ende, ein evtl. vorhandenes Alt-`note` bleibt erhalten); NO_TIME-Schritte haben stattdessen je ihre eigene Rückgängig-/Reset-Funktion (Sensorik-Checkliste, Fragebogen-Checkbox, Bewertung-zurücksetzen). Der Panel-Aufbau läuft für **alle** Schritte über `stepPanelBodyHTML(d, s)` mit fester Reihenfolge: [Sensorik-Checkliste nur `fs_02`/`fs_14`] → Felder (`flowStepFieldsHTML`) → Zusatzabschnitte (`flowStepExtrasHTML`: Szenario/Bewertung/Ereignisse/Export) → **„✓ Weiter" ganz unten** (entfällt am letzten Schritt). `flowStepFieldsHTML` gibt den „Weiter"-Button daher nicht mehr aus. `flowStepStateFor('fs_02', …)` = `komplett` sobald alle `SENSORIK_ITEMS` angelegt sind. Step-IDs/-Labels/-Reihenfolge fest in `FLOW_STEPS` (`fs_01`…`fs_15`, 15 Schritte seit v2.32.0 — zuvor 16 [v2.27.0–v2.31.x]: die Schritte „VR-Equipment/VR-Brille an-/ablegen" [Hologate + Rollercoaster] entfielen, der Trainerbewertungsbogen wurde zum eigenen Schritt; zuvor 18. Seit v2.32.0 entfällt zusätzlich „Verabschiedung" ersatzlos, der bisher letzte Schritt „Datensicherung" rückt von `fs_16` auf `fs_15` nach; Migration alter Daten siehe unten). `bewertungen` (seit v2.15.0): Objekt `{ [stepId]: [ { id, label, scores, notes, savedAt } ] }` — Trainerbewertungsbögen; seit v2.27.0 an **eigenen** Ablauf-Schritten `fs_08` (Hologate, Default-Label „Hologate (gesamt)" — bewertet alle Hologate-Szenarien aus Schritt 7 gemeinsam, ohne Tutorial) und `fs_11` (Rollercoaster, Default-Label „Rollercoaster" — bewertet nur den Rollercoaster-Durchlauf inkl. Schießen), zuvor eingebettet an den damaligen Fragebogen-Schritten `fs_10`/`fs_14`. Konfiguration inkl. Hinweistext je Schritt in `BEW_STEP_META.hint`. Seit v2.16.0 **reduziert** auf den Block „Vergleich zur Selbsteinschätzung": nur noch Items `BEW_OV_ITEMS` = `z17..z20` (4 Fragen aus `BEW_OV_QUESTIONS`, Text `BEW_OV_INTRO`); `scores` enthält entsprechend nur diese 4 Schlüssel. **Seit v2.29.0 kein Overlay mehr** (`#bewertung-overlay`/`openBewOverlay`/etc. entfernt) — `bewSectionHTML(stepId)` rendert die 4 Fragen direkt im Schritt; `ensureSingleBewertung(p, stepId)` legt bei Bedarf genau **einen** Eintrag an (`p.bewertungen[stepId][0]`, `label` = `meta.defaultLabel`, nicht mehr per UI editierbar) und wird verwendet — vorhandene weitere Einträge (Alt-Daten aus der Mehrfach-Bogen-Zeit) bleiben in `p.bewertungen[stepId]` unangetastet erhalten, werden aber nur noch Index 0 angezeigt/bearbeitet. Pip-Klick → `setBewInlineScore(stepId, key, val)` (setzt Wert + `savedAt`, `save()`, `renderAblauf()`), Anmerkungsfeld → `writeBewInlineNotes(stepId)` bei `change`, „Bewertung zurücksetzen" → `resetBewInline(stepId)` (ersetzt `p.bewertungen[stepId]` nach `showConfirm` durch einen frischen leeren Eintrag). `fs_08`/`fs_11` haben dadurch **keinen** Ereignis-Abschnitt (`flowStepExtrasHTML` überspringt `ereignisSectionHTML` für `BEW_STEP_META`-Schritte) und sind strukturell identisch — nur `BEW_STEP_META[stepId].hint`/`.scenarioLabel` unterscheiden den Inhalt. `ereignisse` (seit v2.17.0): Array `[ { id, stepId, tag, note, type:'timestamp'|'duration', timeISO?|startISO?/endISO?, createdAt } ]` — Ereignisse/Probleme je Ablauf-Schritt, Kategorien aus `eventTags`, Bearbeitung im `#ereignis-overlay`. **Seit v2.30.0** trägt der zugehörige Abschnitt (`ereignisSectionHTML`) den Titel **„EREIGNISSE / PROBLEME / ANMERKUNGEN"** — er deckt jetzt auch freie Anmerkungen ab (Kategorie `Sonstiges` eignet sich dafür), nachdem der frühere separate Anmerkung-Punkt je Schritt entfiel; die Datenstruktur selbst ist unverändert. `szenarien` (seit v2.18.0): Objekt `{ [stepId]: [ { id, label, phases: { [phaseId]: isoString | true } } ] }` — VR-Szenario-Durchläufe an `fs_07`/`fs_10` (`SZENARIO_FIXED_STEPS`, seit v2.32.0 ein einfaches `Set` statt des früheren `SZENARIO_STEP_META`-Objekts, da beide Schritte inzwischen strukturell identisch feste Durchläufe sind, siehe „Darstellung" unten; `fs_06` seit v2.28.0 **nicht mehr** hier, siehe Migration unten). Phasen je Schritt über `szPhasesFor(stepId)`: seit v2.32.2 für **beide** Schritte identisch `SZENARIO_PHASES_START_END` (nur `p_start`/`p_end`, beide `ts:true`) — zuvor hatte `fs_10` zusätzlich vier reine Häkchen-Phasen ohne Zeitwert (`p_kalib`/`p_run`/`p_brille`/`p_bew`, vormals `SZENARIO_PHASES_RUN`), die auf expliziten Wunsch ersatzlos entfielen; bereits erfasste Alt-Werte dieser vier Phasen bleiben in `run.phases` unangetastet in `localStorage` stehen, werden aber nicht mehr angezeigt/bearbeitet. **Seit v2.29.0:** die Zeit-Phasen (Start/Ende) werden **wie normale Schritt-Zeitfelder** über `<input type=time>` + Button „Jetzt" erfasst/korrigiert — `szPhaseFieldHTML(stepId, run, ph)` rendert das Zeitfeld (`id="sz-time-<runId>-<phaseId>"`, Klassen `.ablauf-sz-time-input`/`.btn-sz-time-now`); der frühere zweite Zweig für `ts:false`-Häkchen-Phasen (antippbar, z. B. „Person kalibriert") entfiel mit v2.32.2, da `szPhasesFor` seither ausschließlich `ts:true`-Phasen liefert. `szRunPhasesHTML(stepId, run, phases)` gruppiert die Zeitfelder eines Durchlaufs nebeneinander (`.edit-row-2`, wie bei den normalen Schritt-Zeitfeldern). `writeSzRunTime(stepId, runId, phaseId)` liest das Zeitfeld aus und schreibt `run.phases[phaseId]` (Pendant zu `writeFlowStep`); die frühere Häkchen-Logik `toggleRunPhase(stepId, runId, phaseId)` ist mit v2.32.2 entfernt (war seit v2.29.0 nur noch für die Häkchen-Phasen zuständig und damit ohne diese unerreichbar). **Darstellung** (`szenarioSectionHTML(stepId)` — beide Zweige seit v2.32.0 vereint, kein separater `szenarioFixedSectionHTML` mehr): `fs_07` **5 feste Durchläufe** (Bezeichnungen aus `hologateLabels`, Default `DEFAULT_HOLOGATE_LABELS` = Scheiben/Köpfe/Laufen/Drohnen/Kombi, seit v2.31.0 in den Einstellungen editierbar — siehe `sl_hologate_labels` oben; stabile IDs `hg_0`…`hg_4`, per `ensureHologateRuns()` bei jedem Render aus `hologateLabels` normalisiert/neu beschriftet), je mit nummeriertem Durchlaufnamen; `fs_10` seit v2.32.0 ebenfalls **inline, genau 1 fester Durchlauf** (stabile ID `rc_0`, Bezeichnung fix „Rollercoaster", per `ensureRollercoasterRun()` normalisiert — kein numerierter Name, da nur einer existiert), **ohne** Hinzufügen/Löschen/Umbenennen. Beide Ensure-Funktionen sind dünne Wrapper um die gemeinsame `ensureFixedSzenarioRuns(p, stepId, labels, idPrefix)`. Das früher an `fs_10` genutzte `#szenario-run-overlay` (`addSzenarioRun`/`openSzenarioOverlay`/`renderSzOvPhases`/`closeSzenarioOverlay`/`deleteSzenarioRun`/`szCurrentRun`/State `szOvStepId`/`szOvId`) ist seit v2.32.0 **vollständig entfernt** (Markup + JS) — Rollercoaster hatte laut Anforderung nur je einen Durchlauf, das Hinzufügen/Löschen war nie nötig. `toggleRunPhase(stepId, runId, phaseId)` (die frühere gemeinsame Häkchen-Logik für `ts:false`-Phasen) ist seit v2.32.2 entfernt, siehe oben. **Migration v2.32.0** (`migrateRollercoasterTimeV232(pr)`, Flag `_rcTimeMigratedV232`, läuft nach `migrateFlowStepIdsV227`): die frühere Schritt-Zeit `p.ablauf.fs_10.startISO`/`.endISO` (die inhaltlich schon vorher den VR-Szenario-Durchlauf meinte) wandert — sofern dort noch nichts steht — in `p.szenarien.fs_10[0].phases.p_start`/`.p_end`; `p.ablauf.fs_10` behält danach nur noch ein evtl. vorhandenes `note`/`noteISO`, sonst wird der Eintrag gelöscht. Mehrfach-Durchläufe aus der Zeit vor v2.32.0 (per Overlay angelegt) werden von `ensureFixedSzenarioRuns` beim nächsten Render implizit auf den **ersten** Eintrag reduziert (weitere Einträge im Array bleiben zwar in `localStorage` stehen, werden aber nicht mehr angezeigt/normalisiert). **Nicht** zu verwechseln mit dem Alt-Key `sl_bewertungen`/`sl_events` (globale Alt-Daten — bleiben unangetastet). `SENSORIK_ITEMS` seit v2.18.0: `se_shimmer`/`se_brustgurt`/`se_uhr` (Labels Shimmer / Brustgurt / Uhr). Alt-Daten ohne `handedness`/`sensorik`/`ablauf`/`bewertungen`/`ereignisse`/`szenarien` werden beim Laden normalisiert. **Schritt-ID-Migration v2.27.0:** `migrateFlowStepIdsV227(pr)` (aufgerufen aus `load()`, jeweils einmalig pro Person — Flag `_flowIdsMigratedV227` verhindert eine zweite, dann falsche Anwendung) mappt Alt-Daten in `ablauf`/`szenarien` über `FLOW_STEP_ID_REMAP_V227` sowie `bewertungen` separat über `BEW_STEP_ID_REMAP_V227` (andere Zielspalte, da der Bogen vom Fragebogen- auf den neuen Bewertungsbogen-Schritt umzieht) auf die neuen Schritt-IDs um; Einträge der entfallenen Schritte (altes `fs_06`/`fs_09`/`fs_11`/`fs_13`) werden verworfen, ebenso `ereignisse` mit `stepId` dieser Schritte. **Tutorial-Zeit-Migration v2.28.0:** `migrateTutorialTimeV228(pr)` (aufgerufen aus `load()` NACH `migrateFlowStepIdsV227`, Flag `_tutorialTimeMigratedV228`) liest `p.szenarien.fs_06[0].phases.p_start`/`p_end` (aus dem bis v2.27.x genutzten Tap-Mechanismus) und schreibt sie — nur falls dort noch nichts steht — nach `p.ablauf.fs_06.startISO`/`endISO`; `p.szenarien.fs_06` wird danach gelöscht (Tutorial hat keine „Durchläufe" mehr, `SZENARIO_FIXED_STEPS`/`szPhasesFor` kennen `fs_06` seit v2.28.0 nicht mehr). `fs_06` rendert stattdessen über `tutorialReminderSectionHTML()` eine reine, nicht abhakbare Erinnerungsliste (`TUTORIAL_REMINDERS`: Person kalibriert / Person durchläuft das Tutorial / Direkt ins VR-Szenario gewechselt) unterhalb der normalen Start-/Ende-Felder. **Verabschiedung-Migration v2.32.0:** `migrateVerabschiedungRemovalV232(pr)` (aufgerufen aus `load()` NACH `migrateFlowStepIdsV227`, Flag `_verabschiedungRemovedV232`) mappt `ablauf`/`szenarien`/`bewertungen`/`ereignisse` über `FLOW_STEP_ID_REMAP_V232` = `{ fs_15: null, fs_16: 'fs_15' }` um: Einträge des alten `fs_15` „Verabschiedung" werden verworfen (Schritt entfällt ersatzlos), der alte `fs_16` „Datensicherung" zieht auf die neue ID `fs_15` um (inkl. `note`/`noteISO` sowie evtl. noch vorhandener alter `startISO`/`endISO`, die von der neuen 2-Checkbox-UI zwar nicht mehr gelesen, aber auch nicht gelöscht werden). Siehe auch die Rollercoaster-Zeit-Migration `migrateRollercoasterTimeV232` oben bei `szenarien`. `load()` speichert direkt (`save()`), sobald mindestens eine Person durch eine der vier Migrationen (`migrateFlowStepIdsV227`, `migrateTutorialTimeV228`, `migrateVerabschiedungRemovalV232`, `migrateRollercoasterTimeV232`) verändert wurde, statt auf den nächsten ohnehin fälligen Save zu warten. Am neuen letzten Schritt (`LAST_FLOW_STEP_ID` = `fs_15`) trägt `p.ablauf.fs_15` seit v2.32.0 zusätzlich die booleschen Felder `dataSecured`/`disinfected` (bewusst **ohne** ISO-Zeitstempel, anders als `done` bei den Fragebogen-Schritten) — gesetzt/gelöscht über `toggleDatensicherung(field)` (Umschalten, kein „Rückgängig"-Dialog), gerendert über `datensicherungSectionHTML()` als zwei `.sensorik-item`-Häkchen „Alle Daten gesichert" (Hinweistext: LSL, App, Sensorik, Varjo Base) und „Alles desinfiziert/aufbereitet"; `flowStepStateFor(LAST_FLOW_STEP_ID, d)` = `komplett` sobald beide `true` sind, `teilweise` bei genau einem. Sind beide gesetzt, rendert `datensicherungSectionHTML()` zusätzlich den Button `#ablauf-next-durchlauf` → `startNextDurchlauf()`, der nur `expandedFlowStepId = 'fs_01'` setzt + neu rendert (keine Datenänderung an der aktuellen Person) — gedacht, um direkt zur Anlage der/des nächsten Teilnehmenden zu springen |
| `sl_sessions` | `sessions` | `{ id, probandId, pseudo, sensor, scenarioId, scenarioName, scenarioAbbr, date, startISO, endISO, duration_s, pauses[], pauseCount, pauseDuration_s, deviations[], notes, deviceLabel, createdAt, editedAt? }` |
| `sl_bewertungen` | `bewertungen` | `{ id, sessionId, pseudo, sensor, scenarioId, scenarioName, scenarioAbbr, date, scores: { a1..z20 }, notes, savedAt }` |
| `sl_scenarios` | `scenarios` | `{ id, name, abbr, icon }` — Default (nur bei leerem `sl_scenarios`): Tutorial / Hologate / Rollercoaster. Über den Szenario-Manager im Szenario-Screen editierbar |
| `sl_tags` | `tags` | `string[]` — freie Liste von Abweichungs-Bezeichnungen |
| `sl_events` | `events` | `{ id, type: 'timestamp'\|'duration', tag, probandId, pseudo, note, timeISO?, startISO?, endISO?, duration_s?, createdAt }` — `type` bestimmt, ob `timeISO` (Einzelzeitpunkt) oder `startISO`/`endISO`/`duration_s` (Zeitraum) gefüllt ist; `probandId`/`pseudo` sind optional (leerer String = kein Personenbezug) |
| `sl_event_tags` | `eventTags` | `string[]` — freie Liste von Ereignis-Kategorien (Default: `DEFAULT_EVENT_TAGS` = Sensorik/VR/Fragebogen/TMS/Sonstiges), analog zu `sl_tags` aber für den Tab „Ereignisse"; seit v2.31.0 auch aus den **Einstellungen** heraus verwaltbar (`renderEventTagManager()` + `#event-tag-overlay`, Aufrufpfad zusätzlich über `#btn-settings-manage-event-tags` → `openEventTagManager()`, nicht mehr nur über den unerreichbaren Tab) |
| `sl_hologate_labels` | `hologateLabels` | `string[]` (fest 5 Einträge, Default: `DEFAULT_HOLOGATE_LABELS` = Scheiben/Köpfe/Laufen/Drohnen/Kombi) — Bezeichnungen der 5 festen Hologate-Durchläufe aus Schritt 7 (`p.szenarien.fs_07`), seit v2.31.0 in den **Einstellungen** editierbar (`renderHologateLabelSettings()`, `#settings-hologate-labels`); `ensureHologateRuns()` übernimmt die Werte bei jedem Render neu in `run.label`, eine Änderung wirkt sich also sofort auf Schritt 7 aus, ohne die erfassten `phases` zu berühren. Bei fehlender/beschädigter Länge (≠ 5) fällt `load()` auf `DEFAULT_HOLOGATE_LABELS` zurück. „Auf Standard zurücksetzen" (`#btn-reset-hologate-labels`) ersetzt nach `showConfirm` alle 5 Werte |
| `sl_settings` | `settings` | `{ deviceLabel, lastExport, multiProband }` — `multiProband` bleibt seit v2.31.0 dauerhaft `false` (kein UI-Zugriff mehr, siehe Hinweis unten bei „Mehrfachauswahl Teilnehmende") |

**Pausen-Timer (`pauses[]`):** Jeder Eintrag hat die Form `{ startISO, endISO, duration_s }`.
`duration_s` auf Sitzungsebene ist die **aktive Dauer ohne Pausen** — der Timer wird beim
Pausieren eingefroren und beim Fortsetzen exakt an der eingefrorenen Stelle fortgesetzt
(implementiert, indem `timerStart` beim Fortsetzen um die Pausendauer nach vorne verschoben
wird, siehe `resumeTimer()` in `app.js`). `pauseCount`/`pauseDuration_s` sind reine
Bequemlichkeitsfelder (Anzahl bzw. Summe von `pauses[].duration_s`) für Log-Liste und
CSV-Export. Wird eine Sitzung während einer laufenden Pause gestoppt, wird die offene Pause
beim Stoppen automatisch geschlossen (kein hängender/undokumentierter Zeitraum). Die manuelle
Sitzungs-Bearbeitung (`btn-save-edit`) rechnet `duration_s` bei geänderter Start-/Endzeit
weiterhin als rohe Differenz `endISO - startISO` neu — `pauses[]` wird dabei nicht
nachjustiert; das ist ein bekannter Randfall, kein Bug.

Beachte: `sessions`- und `bewertungen`-Einträge speichern `pseudo`/`sensor`/`scenarioName`
**redundant als Kopie** zum Zeitpunkt der Erstellung (statt nur eine `probandId`/`scenarioId`-
Referenz zu halten). Das ist bewusst so gebaut, damit Protokolle auch nach Löschen einer
Person oder eines Szenarios noch lesbar bleiben — hat aber zur Folge, dass ein nachträgliches
Umbenennen eines Szenarios bestehende Sitzungen **nicht** rückwirkend aktualisiert (bei
Personen-Umbenennung dagegen schon, siehe `btn-save-proband-edit`-Handler in `app.js:341`,
der `sessions` aktiv nachzieht). TODO: bei künftigen Änderungen an Szenario-Edit-Funktion
beachten, falls eine Bearbeitungsmöglichkeit für Szenarien ergänzt wird (aktuell gibt es nur
Anlegen/Löschen/Reihenfolge ändern, kein Umbenennen bestehender Szenarien).

**Mehrfachauswahl Teilnehmende (`settings.multiProband`):** **Seit v2.31.0 dauerhaft `false`**
— der zugehörige Einstellungen-Toggle (`#chk-multi-proband`) wurde entfernt, da er sich nur
auf die ohnehin unerreichbaren Session-/Bewertungsbogen-Screens auswirkte; `settings.multiProband`
lässt sich über die UI nicht mehr ändern. Die folgende Beschreibung dokumentiert die interne
Logik, die dadurch dauerhaft inaktiv ist (nicht entfernt, um `app.js` hier minimal zu
verändern). Ist diese Einstellung aktiv,
erlaubt der Sitzungsscreen die Auswahl mehrerer `probandId`s gleichzeitig (State-Array
`selectedProbandIds`, UI in `#proband-multi-list` statt des `<select id="sel-proband">`).
Es gibt **kein** neues Datenmodell für "gemeinsame Sitzungen" — beim Speichern
(`btn-save-session`-Handler) wird für **jede** ausgewählte Person ein eigener, vollständig
unabhängiger `sessions`-Eintrag mit eigener `id` erzeugt, alle mit identischem
`startISO`/`endISO`/`duration_s`/`pauses[]`/`scenarioId`/`deviations`/`notes`. Es existiert
also keine Gruppierungs-ID zwischen diesen Einträgen; ein Zusammenhang ist nur implizit über
identische Zeitstempel/Szenario erkennbar. Der Bewertungsbogen-Prompt nach dem Speichern
erscheint immer und schlägt bei mehreren entstandenen Sitzungen eine **gemeinsame** Bewertung
vor (Text unterscheidet Singular/Plural je nach `newSessionIds.length`).

**Gemeinsame Bewertung mehrerer Teilnehmender (Bewertungsbogen):** ebenfalls seit v2.31.0
dauerhaft inaktiv, siehe Hinweis oben zu `settings.multiProband`. Ist `settings.multiProband`
aktiv, erlaubt auch der Bewertungsscreen die Auswahl mehrerer Sitzungen gleichzeitig
(State-Array `selectedBewSessionIds`, UI in `#bew-session-multi-list` statt des
`<select id="bew-session-select">` — analog zur Teilnehmenden-Mehrfachauswahl bei der
Sitzungsaufzeichnung, siehe `getSelectedBewSessionIds()`). Auch hier gibt es **kein** neues
Datenmodell: `saveBewertung()` legt für **jede** ausgewählte Sitzung einen eigenen,
unabhängigen `bewertungen`-Eintrag mit identischen `scores`/`notes` an (Überschreiben einer
bereits vorhandenen Bewertung pro Sitzung einzeln). Eine Vorbefüllung mit bereits vorhandenen
Bewertungswerten (beim erneuten Öffnen einer Sitzung) findet nur statt, wenn genau **eine**
Sitzung ausgewählt ist — bei Mehrfachauswahl wäre eine Vorbefüllung aus mehreren
möglicherweise unterschiedlichen Alt-Bewertungen nicht eindeutig, daher startet das Formular
dann leer. Nach dem Speichern einer Sitzungsaufzeichnung mit mehreren Teilnehmenden wird
`pendingBewertungSessionIds` (Array, ersetzt das frühere `pendingBewertungSessionId`) mit allen
neu erzeugten Sitzungs-IDs vorbelegt; klickt man im Prompt auf "Ja", werden diese Sitzungen im
Bewertungsscreen automatisch vorausgewählt (Mehrfachauswahl-Modus) bzw. die einzelne Sitzung im
Dropdown vorausgewählt (Einzel-Modus).

**Ereignisse (Tab „Ereignisse", `sl_events`):** Eigenständiges, von Sitzungen unabhängiges
Log für Ereignisse/Probleme (z. B. „Sensorik verrutscht"). Jeder Eintrag hat entweder
`type: 'timestamp'` (ein Zeitpunkt, `timeISO`) oder `type: 'duration'` (Zeitraum,
`startISO`/`endISO`/`duration_s`) — umschaltbar über zwei Toggle-Buttons
(`#event-type-timestamp`/`#event-type-duration`, State-Variable `selectedEventType`),
beide Erfassungsarten füllbar per „Jetzt"-Button (`.btn-time-now`, wie bei den
Sensorik-Zeiten der Teilnehmenden) oder manueller Eingabe im `<input type="time">`. Ein
optionaler Bezug zu einer Person (`probandId`/`pseudo`, wie bei `sessions` als Kopie
hinterlegt) ist möglich, aber nicht Pflicht — ein Ereignis kann auch allgemein (ohne
Personenbezug) erfasst werden. Kategorisierung erfolgt über `eventTags`
(`renderEventTagRow()`) — im Unterschied zur Mehrfachauswahl der Abweichungs-Tags bei
Sitzungen (`renderTagRow()`) ist hier bewusst **Einfachauswahl** implementiert (genau eine
Kategorie pro Ereignis, dient primär dem Filtern/Sortieren der Liste). Löschen einzelner
Ereignisse erfolgt per Klick auf den Listeneintrag + `showConfirm()`, es gibt **keine**
Bearbeiten-Funktion (Korrektur = Löschen + Neuanlage). Diese `sl_events`-Ereignisse (aus dem
längst unerreichbaren Tab „Ereignisse") sind weiterhin **nicht** Teil des CSV-/JSON-Exports —
**nicht zu verwechseln** mit den Ablauf-Ereignissen `p.ereignisse` (pro Schritt/Person, siehe
Datenmodell-Tabelle oben), die seit v2.33.0 sehr wohl exportiert werden (siehe EXPORT unten
und [DATENFLUSS.md](./DATENFLUSS.md)).

## Modul-Verantwortlichkeiten in `app.js` (in Dateireihenfolge)

| Abschnitt (Kommentar-Marker im Code) | Zeilen (ca.) | Verantwortlichkeit |
|---|---|---|
| App Version / Storage Keys / Defaults | 1–~95 | Versions-Konstante, `localStorage`-Keys, Default-Szenarien/-Tags, `SENSORIK_ITEMS` (feste Sensorik-Item-Liste), `FLOW_STEPS` (feste Ablauf-Schrittfolge für den Bereich „Ablauf"), State-Deklaration |
| Persistence | 58–92 | `save()`, `load()` |
| Utilities | 92–166 | `uid()`, Datum/Zeit-Formatierung (`formatTime`, `localTimeStr`, `isoToTimeInput`, `rebuildISO`), `esc()` (HTML-Escaping gegen XSS beim Rendern von Nutzereingaben), `showToast()`, `isValidPseudoFormat()`/`setPseudoFieldValidity()` (Pseudonym-Formatprüfung inkl. Live-Rotmarkierung im Formular) |
| Confirm Dialog | 166–183 | Generischer Bestätigungsdialog (`showConfirm`), von mehreren Lösch-Aktionen wiederverwendet |
| Navigation | 183–234 | `showScreen()` (Screen-Wechsel + Re-Render). Seit v2.14.0 nur noch `ablauf` (Standard), `probanden` und `export` genutzt; keine Nav-Leisten mehr (siehe „Responsive Layout") |
| TEILNEHMENDE | 234–~400 | Liste rendern/filtern, Anlegen, Bearbeiten, Löschen von Personen (inkl. Pseudonym-Formatprüfung — live per `input`-Listener und beim Speichern — beim Anlegen/Bearbeiten) |
| SENSORIK-CHECKLISTE (pro Teilnehmende:r) | vor TIMER | `buildSensorikProbandSelect()` (Personen-Dropdown; Default = zuletzt angelegte Person via `selectedSensorikProbandId`), `renderSensorik()`, `toggleSensorik(id)` (setzt/löscht `p.sensorik[id]` = ISO-String, Löschen per `showConfirm`), Reset-Button `btn-reset-sensorik`. **Hinweis v2.14.0:** dieser Screen hat aktuell keinen Aufrufpfad (Tab entfernt, noch nicht in Schritt 2 eingebettet); die früheren Auto-Sprünge (`showScreen('session')` nach vollständiger Checkliste, `sensorik-prompt-overlay` nach „Person anlegen") sind entfernt |
| SESSION (Nav-Label „Szenario", Screen-ID `session`) | 389–~830 | Szenario-Auswahl, Teilnehmenden-Auswahl (Einzel- **und** Mehrfachauswahl je nach `settings.multiProband`, `getSelectedProbandIds()`; `buildProbandSelect()` wählt im Einzelmodus die aktive Person vor: bestehende Auswahl → `selectedSensorikProbandId` → zuletzt angelegte Person), Start/Pause/Fortsetzen/Stopp-Timer (`startTimer`, `pauseTimer`, `resumeTimer`, `stopTimer`), Tag-Zeilen, Sitzung speichern (ggf. mehrere Einträge bei Mehrfachauswahl), Szenario-/Tag-Manager (CRUD für Konfiguration) |
| LOG | 830–1034 | Sitzungsliste mit Filtern, Detailansicht, Bearbeiten, Löschen |
| EXPORT | vor BEWERTUNGSBOGEN | Seit v2.33.0 auf der Ablauf-Datenstruktur statt `sessions`/`bewertungen`: `getExportProbanden()` liefert **alle** `probanden` (keine Filterung mehr — die frühere „Szenario filtern"-Auswahl entfiel, da sie konzeptionell nicht mehr passt); `renderStats()` zeigt Anzahl Teilnehmende, Anzahl kompletter Durchläufe und deren ⌀-Gesamtdauer (`ablaufDurationInfo()`/`formatDurationLong()`, siehe unten). CSV: `ablaufExportHeaders()`/`ablaufExportRow(p)` — eine Zeile pro Teilnehmende:r, eine Spalte je Schritt-Feld (Hologate-Spalten positionsbasiert `Hologate_1..5_Start/Ende`, unabhängig von den editierbaren `hologateLabels`-Texten; Ereignisse zu einem Text pro Zeile zusammengefasst, analog zur bestehenden Pausen-Zusammenfassung des Alt-Exports). JSON: `ablaufExportRecord(p)` — volle verschachtelte Struktur (`ablauf`/`szenarien`/`bewertungen`/`ereignisse`/`sensorik`/`sensorikAblegen`, jeweils per `deepCopy()`) plus berechnetem `gesamtdauer`-Block. `ablaufDurationInfo(p)` (Gesamtdauer `p.createdAt` → spätester `p.sensorikAblegen`-Wert, `complete` nur bei allen 3 Items) wird sowohl hier als auch in `ablaufDurationSectionHTML()` (Ablauf-Abschnitt, siehe unten) verwendet — eine einzige Quelle für die Kennzahl. Geräte-Label, „Letzter Export"-Anzeige (`recordExport()`) unverändert |
| EINSTELLUNGEN | ~1195 | `renderSettingsScreen()` → `renderHologateLabelSettings()` (5 Textfelder `#settings-hologate-labels`, `change` schreibt `hologateLabels[idx]`, leerer Wert wird abgelehnt; `#btn-reset-hologate-labels` setzt nach `showConfirm` auf `DEFAULT_HOLOGATE_LABELS` zurück), `#btn-settings-manage-event-tags` → `openEventTagManager()` (öffnet `#event-tag-overlay`, nutzt das bestehende `renderEventTagManager()`/`eventTags`-CRUD des früheren Tabs „Ereignisse"), "Alle Daten löschen" (`btn-clear-data`; leert `probanden` inkl. `p.sensorik` und `p.ablauf` — `hologateLabels`/`eventTags`/`tags`/`scenarios` bleiben als Konfiguration unangetastet, wie zuvor schon bei `tags`/`scenarios`). Seit v2.14.0 als `#settings-overlay` (über ⚙ oben rechts), nicht mehr als Screen. **Seit v2.31.0** ohne den früheren Toggle "Mehrere Teilnehmende gleichzeitig" (`#chk-multi-proband` entfernt, `settings.multiProband` bleibt dauerhaft `false`, siehe Hinweis oben) |
| BEWERTUNGSBOGEN | 1157–1410 | Post-Session-Prompt (inkl. Vorschlag zur gemeinsamen Bewertung bei mehreren Teilnehmenden), Sitzungsauswahl (Einzel- **und** Mehrfachauswahl je nach `settings.multiProband`, `getSelectedBewSessionIds()`), 19 Bewertungsskalen (1–6), Speichern/Überschreiben (ggf. mehrere Einträge bei Mehrfachauswahl) |
| EREIGNISSE | nach BEWERTUNGSBOGEN | Formular für neue Ereignisse (optionaler Personenbezug, Kategorie-Einfachauswahl, Zeitpunkt-/Zeitraum-Umschalter je mit „Jetzt"-Button), Liste mit Filtern (Kategorie/Person), Löschen per Klick + `showConfirm()`, eigener Kategorien-Manager (`renderEventTagManager()`, analog zum Tag-Manager der Sitzungsaufzeichnung). Dieser Screen selbst bleibt ohne Aufrufpfad; `renderEventTagManager()`/`#event-tag-overlay` sind seit v2.31.0 aber zusätzlich über die **Einstellungen** erreichbar (siehe EINSTELLUNGEN-Zeile), unabhängig vom Screen |
| ABLAUF (Studien-Zeitleiste) | nach EREIGNISSE | `buildAblaufProbandSelect()` (Personen-Dropdown, Default = zuletzt angelegte Person via `selectedAblaufProbandId`), `renderAblauf()` (Zeitleiste aus `FLOW_STEPS` für die gewählte Person + Fortschrittsbalken; Empty-State ohne Personen), Schritt-Auswahl per `expandedFlowStepId`, `flowStepState()`/`ablaufCounts()` (Farbcodierung offen/teilweise/komplett), `flowStepFieldsHTML()` (Start-/Ende-Felder bzw. seit v2.32.0 das einzelne Zeitfeld an `SINGLE_TIME_STEPS`, einmal gerendert — Inline oder Detailspalte; seit v2.30.0 **ohne** separaten Anmerkung-Punkt, siehe Datenmodell-Tabelle oben), `writeFlowStep()` (schreibt `p.ablauf[stepId]` aus den Feldern **ohne** Full-Render), `syncAblaufRows()` (aktualisiert Zeilen-Farbe/-Text + Fortschritt in-place, damit das offene Panel den Kopfzeilen-Klick nicht „frisst"), `clearFlowStep()` („Schritt leeren" mit `showConfirm`, seit v2.30.0 nur an Schritten mit Zeitfeldern verfügbar). `advanceFlowStep()` („✓ Weiter" → nächster `FLOW_STEPS`-Eintrag), `flowStepExtrasHTML()` — schrittabhängige Zusatzabschnitte: Sensorik-Checkliste an `fs_02` (`sensorikSectionHTML`/`toggleAblaufSensorik`, schreibt `p.sensorik[itemId]`), Tutorial-Erinnerungsliste an `fs_06` (`tutorialReminderSectionHTML()` — seit v2.28.0 statisch, kein State, kein Hinzufügen/Abhaken; die eigentliche Zeit erfasst `flowStepFieldsHTML` ganz normal wie an jedem Standardschritt), VR-Szenario-Durchläufe an `fs_07`/`fs_10` (`szenarioSectionHTML`, seit v2.32.0 EIN gemeinsamer Rendering-Pfad für beide statt einer Verzweigung Liste/Overlay): `fs_07` **inline mit 5 festen, nummerierten Durchläufen** (`ensureHologateRuns`), `fs_10` **inline mit genau 1 festem Durchlauf ohne Nummerierung** (`ensureRollercoasterRun`, seit v2.32.0 — zuvor Liste + `#szenario-run-overlay`, seither entfernt), beide ohne Hinzufügen/Löschen und ohne eigene Schritt-Zeiterfassung (`fs_07`/`fs_10` in `NO_TIME_STEPS`), seit v2.32.2 an beiden Schritten **ausschließlich** die Zeit-Phasen Start/Stopp (`SZENARIO_PHASES_START_END`) — die vier zusätzlichen Häkchen-Phasen, die `fs_10` zuvor hatte, entfielen ersatzlos (siehe Datenmodell-Tabelle oben). `flowStepStateFor` = `komplett` für `fs_07` bei 5/5 Durchläufen mit `p_start`+`p_end`, für `fs_10` bei `p_start`+`p_end` im einzigen Durchlauf; Sensorik-Ablege-Checkliste an `fs_14` (`sensorikAblegenSectionHTML`/`toggleAblaufSensorikAblegen`/`resetAblaufSensorikAblegen`, seit v2.32.0, schreibt `p.sensorikAblegen[itemId]` — Pendant zu `fs_02`, eigener Datenspeicher); `fs_06` hat seit v2.28.0 **keinen** Sonderfall mehr in `flowStepStateFor` (fällt wie `fs_04` „TMS" auf die generische `flowStepState(d)`-Logik über `startISO`/`endISO` zurück — `note` fließt seit v2.30.0 nicht mehr ein). Trainerbewertungsbogen seit v2.27.0 an den **eigenen**, strukturell identischen Schritten `fs_08` (Hologate)/`fs_11` (Rollercoaster) (`bewSectionHTML`, seit v2.29.0 **ohne Overlay** — direkt im Schritt gerendert, Details siehe Datenmodell-Tabelle oben; `flowStepStateFor` = `komplett` sobald alle 4 Fragen beantwortet sind), „Ereignisse / Probleme / Anmerkungen" an **jedem** Schritt **außer** `fs_08`/`fs_11` (`ereignisSectionHTML` + `#ereignis-overlay` — `flowStepExtrasHTML` überspringt den Aufruf für `BEW_STEP_META`-Schritte; deckt seit v2.30.0 auch freie Anmerkungen ab, siehe Datenmodell-Tabelle oben), an `LAST_FLOW_STEP_ID` (`fs_15`) in dieser Reihenfolge: `ablaufDurationSectionHTML()` (seit v2.33.0 — Gesamtdauer-Info, rendert nichts ohne mindestens einen `p.sensorikAblegen`-Wert, siehe `ablaufDurationInfo()` im EXPORT-Abschnitt), der Export-Button `#ablauf-open-export` (seit v2.33.0 **`btn-primary`** statt `btn-ghost`, damit hervorgehoben, und **vor** den Datensicherung-Häkchen platziert), dann `datensicherungSectionHTML()`/`toggleDatensicherung`/`startNextDurchlauf` (seit v2.32.0, siehe Datenmodell-Tabelle oben). **Layout** (`ABLAUF_WIDE_MQ` = `matchMedia('(min-width:768px)')`, `change`-Listener → Re-Render): schmal = einspaltig, Schritt klappt inline auf; ab 768px = Schritt-Leiste links (eigener Scroll) + Detailfeld rechts. Zeiten via `<input type=time>` oder Button „Jetzt", Persistenz per `rebuildISO`/`isoToTimeInput`. Teilnehmende anlegen über `#ablauf-add-proband` **und** die `[data-proband-add]`-Section an `fs_01` (`probandAnlegenSectionHTML`) → `openProbandAddOverlay` (`#proband-add-overlay`, enthält das frühere `#add-form`); bearbeiten über `#ablauf-edit-proband` (→ `openProbandEdit`). **Schritt 1 (`fs_01`) ist Sonderfall:** keine Zeitfelder (`flowStepFieldsHTML` gibt für `fs_01` direkt einen Leerstring zurück; `stepPanelBodyHTML` rendert dort stattdessen `probandAnlegenSectionHTML()` + `ereignisSectionHTML('fs_01')` + den „✓ Weiter zur Sensorik"-Button, letzteren erst wenn `ablaufProband()` existiert), Zustand über `flowStepStateFor` (`komplett` sobald eine Person aktiv ist), `expandedFlowStepId` startet auf `'fs_01'`, und `renderAblauf()` zeigt den Ablauf auch **ohne** aktive Person (nur `fs_01` sinnvoll bedienbar). `saveNewProband()` setzt `expandedFlowStepId='fs_02'` → direkt zur Sensorik |
| INIT | Dateiende | Startsequenz: `load()`, initiales Rendering aller Screens (inkl. `renderSensorik()`, `renderAblauf()`), Versionsanzeige |

## Konventionen im Code

- **XSS-Schutz:** Jeder aus State/Nutzereingabe gerenderte Text durchläuft `esc()` vor dem
  Einfügen in `innerHTML`. Bei neuem Rendering-Code diese Konvention beibehalten.
- **IDs:** `uid()` erzeugt Client-seitige IDs aus Zeitstempel + Zufallsstring (kein UUID-Format,
  aber kollisionsarm genug für den Einzelgeräte-Kontext dieser App).
- **Bestätigung vor destruktiven Aktionen:** Löschaktionen laufen immer über `showConfirm()`,
  nie über direktes Löschen beim Klick.
- **Delete-Bug-Muster (siehe `CLAUDE.md`):** IDs werden vor dem Zurücksetzen von
  `editingProbandId`/`detailSessionId` in eine lokale `const` zwischengespeichert, damit der
  `showConfirm`-Callback (asynchron ausgeführt) noch die richtige ID kennt.
- **`.hidden`-Klasse:** Muss laut `style.css` `display: none !important` sein (nicht
  `opacity:0`), sonst blockieren unsichtbare Elemente Klicks — siehe bekannte Bugs in
  `CLAUDE.md`.

## Service Worker (`sw.js`)

- Cache-Name `CACHE` ist an `APP_VERSION` aus `app.js` gekoppelt (manuell synchron zu halten,
  siehe Versionierungsregel in `CLAUDE.md`) — ändert sich die Versionsnummer, wird beim
  nächsten Laden der alte Cache automatisch gelöscht (`activate`-Handler).
- Strategie: **Cache-first mit Network-Fallback** — gecachte Antwort wird bevorzugt
  ausgeliefert; bei Cache-Miss wird das Netzwerk versucht und die Antwort zusätzlich in den
  Cache geschrieben; schlägt auch das fehl (offline + nicht gecacht), wird `index.html` als
  Fallback ausgeliefert (SPA-artiges Verhalten für Navigation).
- `sw.js` selbst ist **nicht** in der `ASSETS`-Liste enthalten (bewusst — verhindert laut
  `CLAUDE.md` einen bekannten Service-Worker-Deadlock).
- Nur `GET`-Requests werden behandelt; alles andere wird an den Browser durchgereicht.

## Rendering-Modell

Kein Virtual DOM, kein Reaktivitäts-Framework. Jede `render*()`-Funktion (z. B.
`renderProbanden()`, `renderLog()`, `renderBewertungScreen()`) baut den relevanten
DOM-Ausschnitt bei jedem Aufruf komplett neu aus dem aktuellen State via
Template-Strings + `innerHTML` auf und hängt anschließend Event-Listener an die neu
erzeugten Elemente. Es gibt keinen Diffing-Mechanismus — nach jeder State-Änderung muss die
betroffene `render*()`-Funktion explizit erneut aufgerufen werden (das übernehmen die
jeweiligen Event-Handler).

## Responsive Layout

Seit **v2.14.0** gibt es **keine Tab-Navigation** mehr (`.sidebar`, `.sidebar-nav`,
`.bottom-nav`, `.page-header` sind aus `index.html` entfernt; deren CSS-Regeln bleiben als
toter Code stehen). Einzige Ansicht ist `#screen-ablauf`. Eine Topbar über alle Breiten
zeigt links den App-Namen, rechts das ⚙-Icon (`#btn-open-settings` → `#settings-overlay`).
`showScreen()` existiert weiter und wird nur noch für `ablauf`, `probanden` (Vollbild-Dialog
„Teilnehmende verwalten") und `export` (letzter Schritt, `fs_15` seit v2.32.0) genutzt; die zugehörigen Sektionen
tragen eine `.subview-header` mit `[data-back-to-ablauf]`-Schließer. Die alten
`.nav-btn`/`.nav-item`-Listener greifen ins Leere (kein Element), sind aber harmlos.

**Ablauf-Layout** (`.ablauf-layout`): ab **768px** ein Grid `minmax(280px,360px) 1fr` —
links `.ablauf-timeline` (Schritt-Leiste mit eigener `overflow-y:auto`-Scrollbar), rechts
`.ablauf-detail` (Detailfeld, eigener Scroll). `#screen-ablauf` bekommt dafür
`overflow:hidden` + `.screen-inner{height:100%;min-height:0}` und die Leiste/das Feld je
`flex:1;min-height:0`. Unter 768px: einspaltig, Schritt klappt inline auf
(`ABLAUF_WIDE_MQ = matchMedia('(min-width:768px)')`, `change`-Listener → Re-Render).
„✓ Weiter" (`#ablauf-edit-next` → `advanceFlowStep()`) öffnet den nächsten `FLOW_STEPS`-
Eintrag; am letzten Schritt (`LAST_FLOW_STEP_ID`) stattdessen die Datensicherung-Häkchen +
der Export-Button. **Scroll-Reset der Detailspalte (seit v2.32.1):** `renderAblauf()`
vergleicht `expandedFlowStepId` mit dem zuletzt gerenderten `lastAblaufDetailStepId` und
setzt `detail.scrollTop = 0` nur bei einem **echten** Schrittwechsel (Header-Klick, „✓
Weiter", „↻ Nächsten Durchlauf starten") — ein Re-Render desselben Schritts (z. B. nach
Antippen einer Checkliste/eines Häkchens) lässt die aktuelle Scroll-Position unangetastet
(`flowStepExtrasHTML`).

## Bewertungsbogen — Item-Struktur

19 Items, gruppiert in 6 Dimensionen, jeweils Schulnoten-Skala 1 (sehr gut) bis 6
(ungenügend). Item-Keys: `a1–a4` (Lageerkundung), `b5–b8` (Entscheidungsqualität), `c9–c10`
(Führung/Kommunikation), `d11–d12` (Struktur/Effizienz), `e13, e15, e16` (Umsetzung
Lehrgangsinhalte — **Nummer 14 ist im Quellbogen bewusst ausgelassen**, kein Bug), `z17–z20`
(Zusatzblock: subjektiver Leistungsvergleich). Definiert in `BEW_ITEMS` (`app.js:1161`) und
den zugehörigen Label-Texten direkt in `index.html`. Bei Änderungen an den Items müssen
**beide** Stellen synchron gehalten werden (Array in `app.js` + Markup in `index.html`) sowie
die CSV-Exportspalten (`app.js`, `btn-export-csv`-Handler).

## Bekannte Einschränkungen

- Kein automatisiertes Test-Setup (keine Unit-/E2E-Tests im Repo).
- Kein Lint/Format-Tooling konfiguriert.
- `localStorage`-Kapazität ist browserabhängig begrenzt (üblich 5–10 MB); die App fängt
  Schreibfehler nur pauschal per `try/catch` in `save()` ab und zeigt einen generischen
  Toast — kein differenziertes Verhalten bei Speicherplatzmangel.
- Keine Datenmigration/Schema-Versionierung für `localStorage`-Inhalte (siehe oben).
- Sensoriknummer wird nur noch im Bearbeiten-Dialog erfasst und ist dort **optional**; wird
  eine eingegeben, ist sie hart auf den Bereich 1–12 + Eindeutigkeit validiert
  (`btn-save-proband-edit`-Handler). Neue Personen bekommen `sensor: ''`.
- Pseudonym ist hart auf das Format "1 Buchstabe, 4 Zahlen, 3 Buchstaben" (z. B. `P1234ABC`)
  validiert — `PSEUDO_FORMAT_REGEX`/`isValidPseudoFormat()` in `app.js:99–100`. Live-Feedback
  übernimmt `setPseudoFieldValidity()` (`app.js:104–112`): sie markiert das jeweilige
  Eingabefeld (`#inp-pseudo`/`#edit-pseudo`) per CSS-Klasse `field-invalid` (roter Rahmen) und
  blendet den Hinweistext `#inp-pseudo-error`/`#edit-pseudo-error` ("Format nicht korrekt")
  ein, sobald ein nicht-leerer Wert nicht zum Format passt — ausgelöst per `input`-Listener bei
  jedem Tastendruck sowie beim Öffnen des Bearbeiten-Dialogs und beim Klick auf Speichern
  (`app.js:294`, `app.js:351`). Ein leeres Feld gilt bewusst nicht als ungültig (keine
  Fehlermarkierung vor der ersten Eingabe). Die Prüfung greift nur bei Neuanlage/Bearbeitung;
  bereits vorhandene Pseudonyme in älteren `localStorage`-Datenständen, die diesem Format nicht
  entsprechen, werden dadurch **nicht** automatisch verändert (keine Migration) — beim Öffnen
  des Bearbeiten-Dialogs für eine solche Person wird das Feld allerdings sofort als ungültig
  markiert.
- Löschen einzelner Teilnehmender/Sitzungen entfernt keine verknüpften Datensätze in anderen
  Tabellen (siehe [DATENFLUSS.md](./DATENFLUSS.md) für die Datenschutz-Implikation).
- Manuelles Bearbeiten von Start-/Endzeit einer Sitzung (`btn-save-edit`) rechnet
  `duration_s` neu als rohe Differenz, ohne `pauses[]` zu berücksichtigen — bei Sitzungen
  mit Pausen kann `duration_s` nach einer manuellen Zeitkorrektur von der Summe
  aktive Zeit + Pausenzeit abweichen.
- Zwei vermutliche Backup-/Debug-Dateien im Repo-Root (`debug.html`, `download`, siehe oben)
  sind nicht Teil der App und sollten bei größerer Aufräumarbeit hinterfragt, aber nicht
  ungefragt gelöscht werden.
- **Ereignisse (`sl_events`) sind nicht Teil des CSV-/JSON-Exports** — sie lassen sich
  aktuell nur innerhalb der App (Tab „Ereignisse", mit Filtern) einsehen, nicht über den
  Export-Screen mit auswerten.
- Für Ereignisse gibt es **keine Bearbeiten-Funktion** — anders als bei Sitzungen
  (`btn-edit-session`) kann ein fehlerhafter Ereignis-Eintrag nur gelöscht und neu angelegt
  werden.

## Offene TODOs

- TODO: Datenschutzrechtliche Prüfung der in [DATENFLUSS.md](./DATENFLUSS.md) markierten
  Punkte (Rechtsgrundlage, Aufbewahrungsfristen, Umgang mit Exportdateien).
- TODO: Klären, ob die verwaisten Dateien `debug.html`, `download` und
  `icon-512 (1).png` im Repo-Root entfernt werden können.
- TODO: Entscheiden, ob Löschen einer Sitzung künftig automatisch die zugehörige Bewertung
  mitlöschen soll (aktuell bewusst nicht der Fall, siehe oben).

## Pflichten bei Code-Änderungen (Kurzfassung von `CLAUDE.md`)

1. **Strict non-regression:** Änderungen additiv/visuell, nichts Bestehendes unangekündigt
   brechen.
2. **Minimale Diffs**, kein Refactoring nebenbei.
3. Bei jeder inhaltlichen Änderung: `APP_VERSION` in `app.js`, `CACHE` in `sw.js` und die
   beiden `.app-version`-Platzhalter in `index.html` synchron hochzählen.
4. **Diese `/docs`-Dateien bei jeder Änderung an Datenerfassung, -speicherung,
   -übertragung, Architektur oder Bedienung aktuell halten** — siehe Hinweis oben und
   ursprüngliche Anforderung an diese Dokumentation.

Vollständige Regeln: `/CLAUDE.md` im Repo-Root.
