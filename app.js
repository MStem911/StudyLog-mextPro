'use strict';

// ── App Version (Single Source of Truth) ───────────────────────────────────
// Bei jeder inhaltlichen Änderung Patch-Version erhöhen (z.B. 2.2.1 -> 2.2.2).
// sw.js CACHE-Name manuell synchron mitziehen, damit alte Caches invalidiert werden.
const APP_VERSION = '2.32.1';

document.addEventListener('DOMContentLoaded', function() {

// ── Storage Keys ────────────────────────────────────────────────────────────
const KEY_PROBANDEN  = 'sl_probanden';
const KEY_SESSIONS   = 'sl_sessions';
const KEY_SETTINGS   = 'sl_settings';
const KEY_SCENARIOS  = 'sl_scenarios';
const KEY_TAGS       = 'sl_tags';
const KEY_BEWERTUNGEN = 'sl_bewertungen';
const KEY_SENSORIK   = 'sl_sensorik';
const KEY_EVENTS      = 'sl_events';
const KEY_EVENT_TAGS  = 'sl_event_tags';
const KEY_HOLOGATE_LABELS = 'sl_hologate_labels';

const DEFAULT_SCENARIOS = [
  { id: 'sc_tut',  name: 'Tutorial',     abbr: 'TUT', icon: '🎓' },
  { id: 'sc_holo', name: 'Hologate',     abbr: 'HG',  icon: '🥽' },
  { id: 'sc_rc',   name: 'Rollercoaster', abbr: 'RC',  icon: '🎢' },
];

// Sensorik-Hardware-Items (Schritt 2 „Anlegen Sensorik"): feste Liste, kein UI zum Bearbeiten.
// Der Zeitpunkt „angelegt" wird PRO Teilnehmende:r in p.sensorik[itemId] als ISO-String
// gespeichert (fehlender Schlüssel = für diese Person noch nicht angelegt).
const SENSORIK_ITEMS = [
  { id: 'se_shimmer',   label: 'Shimmer' },
  { id: 'se_brustgurt', label: 'Brustgurt' },
  { id: 'se_uhr',       label: 'Uhr' },
];

const DEFAULT_TAGS = [
  'Szenario verkürzt',
  'Techn. Fehler',
  'Proband abgebrochen',
  'Setup-Abweichung',
  'Proband unsicher',
  'Szenario wiederholt',
];

// Kategorien für den Tab "Ereignisse" — eigene, frei erweiterbare Liste (getrennt von
// den Abweichungs-Tags der Sitzungsaufzeichnung, da inhaltlich andere Bedeutung).
const DEFAULT_EVENT_TAGS = ['Sensorik', 'VR', 'Fragebogen', 'TMS', 'Sonstiges'];

// Ablauf-Zeitleiste ("Ablauf"): der reale Studienablauf als feste, geordnete Schrittfolge.
// Pro Teilnehmende:r wird zu jedem Schritt in p.ablauf[stepId] = { startISO, endISO, note }
// gespeichert (fehlender Schlüssel = Schritt noch nicht angefasst). Die Labels (tag) sind
// rein informativ — kein Filter-/Rollenverhalten. Reihenfolge = Anzeigereihenfolge.
// v2.27.0: Die Schritte „VR-Equipment/VR-Brille an-/ablegen" (Hologate + Rollercoaster)
// entfallen; der Trainerbewertungsbogen ist kein eingebetteter Abschnitt mehr, sondern ein
// eigener Schritt direkt nach dem jeweiligen VR-Durchlauf. Migration alter Ablauf-Daten:
// siehe FLOW_STEP_ID_REMAP_V227 / BEW_STEP_ID_REMAP_V227 in load().
// v2.32.0: „Verabschiedung" entfällt ersatzlos, der bisher letzte Schritt „Datensicherung"
// rückt auf (siehe FLOW_STEP_ID_REMAP_V232 in load()). Rollercoaster (fs_10) hat wie Hologate
// nur noch einen festen Durchlauf ohne Hinzufügen/Löschen. Stop Sensorik (fs_13) erfasst nur
// noch einen einzelnen Zeitpunkt statt Start/Ende (siehe SINGLE_TIME_STEPS). Datensicherung
// (letzter Schritt) besteht nur noch aus zwei Häkchen ohne Zeiterfassung.
const FLOW_STEPS = [
  { id: 'fs_01', nr: '1',  label: 'Aufklärung + Einverständniserklärung',                     tag: 'VR / SEN' },
  { id: 'fs_02', nr: '2',  label: 'Anlegen Sensorik (Shimmer, Brustgurt, Uhr)',              tag: 'SEN' },
  { id: 'fs_03', nr: '3',  label: 'Fragebogen 1',                                            tag: 'SEN / VR' },
  { id: 'fs_04', nr: '4',  label: 'TMS (ca. 0,5 h)',                                         tag: 'TMS (extern)' },
  { id: 'fs_05', nr: '5',  label: 'Fragebogen 2',                                            tag: 'SEN / VR' },
  { id: 'fs_06', nr: '6',  label: 'Einweisung + Tutorial VR (Hologate)',                     tag: 'VR' },
  { id: 'fs_07', nr: '7',  label: 'VR-Szenarien Hologate (5 Szenarien)',                     tag: 'VR' },
  { id: 'fs_08', nr: '8',  label: 'Trainerbewertungsbogen (Hologate)',                       tag: 'VR' },
  { id: 'fs_09', nr: '9',  label: 'Fragebogen 3',                                            tag: 'SEN / VR' },
  { id: 'fs_10', nr: '10', label: 'Rollercoaster (Varjo)',                                   tag: 'VR' },
  { id: 'fs_11', nr: '11', label: 'Trainerbewertungsbogen (Rollercoaster)',                  tag: 'VR' },
  { id: 'fs_12', nr: '12', label: 'Fragebogen 4',                                            tag: 'SEN / VR' },
  { id: 'fs_13', nr: '13', label: 'Stop Sensorik (Aufzeichnung beenden)',                    tag: 'SEN' },
  { id: 'fs_14', nr: '14', label: 'Sensorik ablegen',                                        tag: 'SEN' },
  { id: 'fs_15', nr: '15', label: 'Datensicherung / Desinfektion & Aufbereitung Sensorik / StudyLog-Daten sichern', tag: 'VR / SEN' },
];
const LAST_FLOW_STEP_ID = FLOW_STEPS[FLOW_STEPS.length - 1].id;

// Trainerbewertungsbogen: eigener Ablauf-Schritt direkt nach dem jeweiligen VR-Durchlauf
// (Hologate → Schritt 8, Rollercoaster → Schritt 11), von VR ausgefüllt, während die
// Teilnehmenden den anschließenden Fragebogen bearbeiten.
const BEW_STEP_META = {
  fs_08: { scenarioLabel: 'Hologate-Szenarien (Schritt 7)',     defaultLabel: 'Hologate (gesamt)',
           hint: 'Bewertet werden alle Hologate-Szenarien aus Schritt 7 gemeinsam (ohne das Tutorial aus Schritt 6) — von VR ausfüllen, während die Teilnehmenden Fragebogen 3 bearbeiten.' },
  fs_11: { scenarioLabel: 'Rollercoaster / Varjo (Schritt 10)', defaultLabel: 'Rollercoaster',
           hint: 'Bewertet wird nur der Rollercoaster-Durchlauf (inkl. dem in der Szene enthaltenen Schießen) — von VR ausfüllen, während die Teilnehmenden Fragebogen 4 bearbeiten.' },
};

// Trainerbewertungsbogen (reduziert, ab v2.16.0): nur der Block „Vergleich zur
// Selbsteinschätzung" — 4 Items, Schulnoten-Skala 1–6. Item-Schlüssel z17..z20 wie zuvor,
// nur die Fragetexte sind angepasst (spiegeln den Teilnehmerfragebogen).
const BEW_OV_ITEMS  = ['z17', 'z18', 'z19', 'z20'];
const BEW_OV_TITLE  = 'Vergleich zur Selbsteinschätzung';
const BEW_OV_INTRO   = 'Die folgenden Fragen entsprechen inhaltlich den Fragen des ' +
  'Teilnehmerfragebogens und dienen dem späteren Vergleich zwischen Selbst- und ' +
  'Fremdeinschätzung der gezeigten Leistung.';
const BEW_OV_QUESTIONS = [
  ['z17', '1. Die Lage wurde effektiv erfasst.'],
  ['z18', '2. Die Entscheidungen waren angemessen.'],
  ['z19', '3. Die richtigen Prioritäten wurden gesetzt.'],
  ['z20', '4. Gesamtleistung'],
];

// VR-Szenario-Durchläufe: Schritte, deren Ablauf in einzelne, teils abhakbare Teilschritte
// („Phasen") zerlegt wird (Anforderung „VR-Szenario-Ablauf mit Timestamps"). Pro Schritt ein
// oder mehrere feste Durchläufe in p.szenarien[stepId] = [ { id, label, phases: { [phaseId]:
// ISO | true } } ]. Seit v2.32.0 sind BEIDE Schritte feste Durchläufe ohne Hinzufügen/Löschen/
// Umbenennen (Hologate: 5 feste Durchläufe, Rollercoaster: genau 1) — siehe
// ensureHologateRuns() / ensureRollercoasterRun().
const SZENARIO_FIXED_STEPS = new Set(['fs_07', 'fs_10']);
// Schritt 7: feste Reihenfolge von 5 Hologate-Durchläufen, je nur mit Start + Stopp
// (Zeitstempel). Die Anzahl (5) ist fest, die Bezeichnungen sind seit v2.31.0 in den
// Einstellungen editierbar (siehe `hologateLabels` im State-Abschnitt / KEY_HOLOGATE_LABELS).
const DEFAULT_HOLOGATE_LABELS = ['Scheiben', 'Köpfe', 'Laufen', 'Drohnen', 'Kombi'];
const SZENARIO_PHASES_HOLOGATE = [
  { id: 'p_start', label: 'Szenario starten', ts: true },
  { id: 'p_end',   label: 'Szenario beendet', ts: true },
];
// Feste Phasen je Durchlauf. `ts: true` → beim Abhaken wird ein Zeitstempel erfasst;
// `ts: false` → reines Häkchen ohne Zeit.
const SZENARIO_PHASES_RUN = [
  { id: 'p_start',  label: 'Szenario starten',                  ts: true  },
  { id: 'p_kalib',  label: 'Person kalibriert',                 ts: false },
  { id: 'p_run',    label: 'Person durchläuft das Szenario',    ts: false },
  { id: 'p_end',    label: 'Szenario beendet',                  ts: true  },
  { id: 'p_brille', label: 'Brille abgezogen',                  ts: false },
  { id: 'p_bew',    label: 'Selbstbewertung + Bewertungsbogen', ts: false },
];
// Tutorial (Schritt 6): Zeit wird — wie bei TMS (Schritt 4) — über die normalen Start-/Ende-
// Felder erfasst (Button „Jetzt" oder manuelle Eingabe), seit v2.28.0 kein eigener
// Durchlauf/Phasen-Mechanismus mehr. Die drei Zwischenschritte bleiben als reine, nicht
// abhakbare Ablauf-Erinnerung erhalten (keine eigenen Zeitstempel).
const TUTORIAL_REMINDERS = [
  'Person kalibriert',
  'Person durchläuft das Tutorial',
  'Direkt ins VR-Szenario gewechselt',
];
function tutorialReminderSectionHTML() {
  return `<div class="bew-section">
    <div class="card-label" style="margin-bottom:6px">TUTORIAL-ABLAUF</div>
    <p class="meta-text" style="margin-bottom:8px">Nur zur Erinnerung — Start/Ende oben erfassen das VR-Szenario-Tutorial selbst.</p>
    ${TUTORIAL_REMINDERS.map(t => `<div class="ablauf-sz-reminder"><span class="ablauf-sz-reminder-mark">•</span>${esc(t)}</div>`).join('')}
  </div>`;
}
function szPhasesFor(stepId) {
  if (stepId === 'fs_07') return SZENARIO_PHASES_HOLOGATE;
  return SZENARIO_PHASES_RUN;
}

// ── State ────────────────────────────────────────────────────────────────────
let probanden        = [];
let sessions         = [];
let settings         = { deviceLabel: '', lastExport: null, multiProband: false };
let scenarios        = [];
let tags             = [];
let bewertungen      = [];
let events            = [];
let eventTags         = [];
let hologateLabels    = [];
let selectedEventType = 'timestamp';
let selectedSensorikProbandId = '';
let selectedScenId   = '';
let selectedProbandIds = [];
let selectedBewSessionIds = [];
let timerInterval    = null;
let timerStart       = null;
let timerElapsed     = 0;
let sessionStartISO  = null;
let sessionEndISO    = null;
let sessionRunning   = false;
let sessionPaused    = false;
let pauseStart       = null;
let pauseStartISO    = null;
let pauses           = [];
let detailSessionId  = null;
let editingProbandId = null;
let confirmCallback  = null;
let pendingBewertungSessionIds = [];

// ── Persistence ──────────────────────────────────────────────────────────────
function save() {
  try {
    localStorage.setItem(KEY_PROBANDEN,   JSON.stringify(probanden));
    localStorage.setItem(KEY_SESSIONS,    JSON.stringify(sessions));
    localStorage.setItem(KEY_SETTINGS,    JSON.stringify(settings));
    localStorage.setItem(KEY_SCENARIOS,   JSON.stringify(scenarios));
    localStorage.setItem(KEY_TAGS,        JSON.stringify(tags));
    localStorage.setItem(KEY_BEWERTUNGEN, JSON.stringify(bewertungen));
    localStorage.setItem(KEY_EVENTS,      JSON.stringify(events));
    localStorage.setItem(KEY_EVENT_TAGS,  JSON.stringify(eventTags));
    localStorage.setItem(KEY_HOLOGATE_LABELS, JSON.stringify(hologateLabels));
  } catch(e) { showToast('⚠ Speicherfehler'); }
}

// ── Migration v2.27.0: Ablauf-Umbau (VR-Equipment-Schritte entfallen, Trainerbewertungsbogen
// wird eigener Schritt) ─────────────────────────────────────────────────────────────────────
// Alte Schritt-ID → neue Schritt-ID für p.ablauf/p.szenarien/p.ereignisse (fs_01–fs_05
// unverändert, daher hier nicht aufgeführt). `null` = Schritt entfallen (VR-Equipment/
// VR-Brille an-/ablegen) — dessen Anmerkung/Zeiten werden verworfen.
const FLOW_STEP_ID_REMAP_V227 = {
  fs_06: null,    // Anlegen VR-Equipment (Hologate) — entfällt
  fs_07: 'fs_06', // Einweisung + Tutorial VR (Hologate)
  fs_08: 'fs_07', // VR-Szenarien Hologate
  fs_09: null,    // Ablegen VR-Equipment (Hologate) — entfällt
  fs_10: 'fs_09', // Fragebogen 3
  fs_11: null,    // VR-Brille anlegen (Rollercoaster) — entfällt
  fs_12: 'fs_10', // Rollercoaster (Varjo)
  fs_13: null,    // VR-Brille ablegen (Rollercoaster) — entfällt
  fs_14: 'fs_12', // Fragebogen 4
  fs_15: 'fs_13', // Stop Sensorik
  fs_16: 'fs_14', // Sensorik ablegen
  fs_17: 'fs_15', // Verabschiedung
  fs_18: 'fs_16', // Datensicherung / Desinfektion / StudyLog-Daten sichern
};
// p.bewertungen war bisher am jeweiligen Fragebogen-Schritt eingebettet (fs_10/fs_14) und
// zieht jetzt auf den neuen, eigenen Bewertungsbogen-Schritt um (fs_08/fs_11) — andere
// Zielspalte als beim allgemeinen Remap oben, deshalb eine eigene Tabelle.
const BEW_STEP_ID_REMAP_V227 = { fs_10: 'fs_08', fs_14: 'fs_11' };

// Baut ein { [stepId]: … }-Objekt anhand einer Remap-Tabelle neu auf: entfallene Schritte
// (Ziel `null`) werden verworfen, alle anderen Schlüssel unverändert übernommen.
function remapStepKeyedObject(obj, map) {
  if (!obj || typeof obj !== 'object') return {};
  const next = {};
  Object.keys(obj).forEach(key => {
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      const target = map[key];
      if (target) next[target] = obj[key];
    } else {
      next[key] = obj[key];
    }
  });
  return next;
}

// Einmalige Migration pro Teilnehmende:r (Flag `_flowIdsMigratedV227` verhindert eine
// zweite, dann falsche Anwendung auf bereits umgezogene Daten). Rückgabewert: true, wenn
// tatsächlich migriert wurde (Aufrufer nutzt das, um genau einmal direkt zu speichern).
function migrateFlowStepIdsV227(pr) {
  if (pr._flowIdsMigratedV227) return false;
  pr.ablauf      = remapStepKeyedObject(pr.ablauf, FLOW_STEP_ID_REMAP_V227);
  pr.szenarien   = remapStepKeyedObject(pr.szenarien, FLOW_STEP_ID_REMAP_V227);
  pr.bewertungen = remapStepKeyedObject(pr.bewertungen, BEW_STEP_ID_REMAP_V227);
  if (Array.isArray(pr.ereignisse)) {
    pr.ereignisse = pr.ereignisse
      .filter(ev => !ev.stepId || !(ev.stepId in FLOW_STEP_ID_REMAP_V227) || FLOW_STEP_ID_REMAP_V227[ev.stepId])
      .map(ev => {
        const target = ev.stepId && FLOW_STEP_ID_REMAP_V227[ev.stepId];
        return target ? { ...ev, stepId: target } : ev;
      });
  }
  pr._flowIdsMigratedV227 = true;
  return true;
}

// ── Migration v2.28.0: Tutorial-Zeit (Schritt 6) wird — wie Schritt 4 „TMS" — über normale
// Start-/Ende-Felder erfasst statt per Tap auf „Tutorial starten"/„Tutorial beendet" im
// (jetzt entfallenen) Szenario-Durchlauf. Bereits erfasste Zeitstempel aus dem alten
// Durchlauf (p.szenarien.fs_06) ziehen nach p.ablauf.fs_06 um; der Durchlauf selbst entfällt
// (Tutorial hat keine „Durchläufe" mehr). Läuft NACH migrateFlowStepIdsV227, damit
// p.szenarien.fs_06 unabhängig vom Alt-Schema bereits der Tutorial-Durchlauf ist.
function migrateTutorialTimeV228(pr) {
  if (pr._tutorialTimeMigratedV228) return false;
  const run = (pr.szenarien && Array.isArray(pr.szenarien.fs_06)) ? pr.szenarien.fs_06[0] : null;
  const phases = (run && run.phases) || {};
  if (phases.p_start || phases.p_end) {
    const prev = pr.ablauf.fs_06 || {};
    pr.ablauf.fs_06 = {
      startISO: prev.startISO || phases.p_start || null,
      endISO:   prev.endISO   || phases.p_end   || null,
      note:     prev.note     || '',
      noteISO:  prev.noteISO  || null,
    };
  }
  if (pr.szenarien) delete pr.szenarien.fs_06;
  pr._tutorialTimeMigratedV228 = true;
  return true;
}

// ── Migration v2.32.0a: „Verabschiedung" entfällt ersatzlos, der bisher letzte Schritt
// „Datensicherung" rückt von fs_16 auf fs_15 nach (fs_15 „Verabschiedung" selbst entfällt) ──
const FLOW_STEP_ID_REMAP_V232 = { fs_15: null, fs_16: 'fs_15' };

function migrateVerabschiedungRemovalV232(pr) {
  if (pr._verabschiedungRemovedV232) return false;
  pr.ablauf      = remapStepKeyedObject(pr.ablauf, FLOW_STEP_ID_REMAP_V232);
  pr.szenarien   = remapStepKeyedObject(pr.szenarien, FLOW_STEP_ID_REMAP_V232);
  pr.bewertungen = remapStepKeyedObject(pr.bewertungen, FLOW_STEP_ID_REMAP_V232);
  if (Array.isArray(pr.ereignisse)) {
    pr.ereignisse = pr.ereignisse
      .filter(ev => !ev.stepId || !(ev.stepId in FLOW_STEP_ID_REMAP_V232) || FLOW_STEP_ID_REMAP_V232[ev.stepId])
      .map(ev => {
        const target = ev.stepId && FLOW_STEP_ID_REMAP_V232[ev.stepId];
        return target ? { ...ev, stepId: target } : ev;
      });
  }
  pr._verabschiedungRemovedV232 = true;
  return true;
}

// ── Migration v2.32.0b: Rollercoaster (fs_10) wird — wie Hologate — ein fester Einzel-
// Durchlauf; die bisherige allgemeine Start-/Endzeit AM SCHRITT (p.ablauf.fs_10) meinte schon
// vorher inhaltlich den VR-Szenario-Durchlauf selbst und zieht daher in dessen Durchlauf-Phasen
// (p_start/p_end) um, sofern dort noch nichts erfasst ist — die Schritt-Zeitfelder entfallen
// (fs_10 hat seit v2.32.0 keine eigene Start-/Endzeit mehr, siehe NO_TIME_STEPS). Ein evtl.
// vorhandenes `note`/`noteISO` bleibt erhalten.
function migrateRollercoasterTimeV232(pr) {
  if (pr._rcTimeMigratedV232) return false;
  const stepData = pr.ablauf && pr.ablauf.fs_10;
  if (stepData && (stepData.startISO || stepData.endISO)) {
    if (!pr.szenarien || typeof pr.szenarien !== 'object') pr.szenarien = {};
    if (!Array.isArray(pr.szenarien.fs_10) || !pr.szenarien.fs_10.length) {
      pr.szenarien.fs_10 = [{ id: 'rc_0', label: 'Rollercoaster', phases: {} }];
    }
    const run = pr.szenarien.fs_10[0];
    if (!run.phases || typeof run.phases !== 'object') run.phases = {};
    if (stepData.startISO && !run.phases.p_start) run.phases.p_start = stepData.startISO;
    if (stepData.endISO   && !run.phases.p_end)   run.phases.p_end   = stepData.endISO;
  }
  if (stepData) {
    if (stepData.note && stepData.note.trim()) {
      pr.ablauf.fs_10 = { note: stepData.note, noteISO: stepData.noteISO || null };
    } else {
      delete pr.ablauf.fs_10;
    }
  }
  pr._rcTimeMigratedV232 = true;
  return true;
}

function load() {
  try {
    const p  = localStorage.getItem(KEY_PROBANDEN);
    const s  = localStorage.getItem(KEY_SESSIONS);
    const st = localStorage.getItem(KEY_SETTINGS);
    const sc = localStorage.getItem(KEY_SCENARIOS);
    const tg = localStorage.getItem(KEY_TAGS);
    const bw = localStorage.getItem(KEY_BEWERTUNGEN);
    const ev = localStorage.getItem(KEY_EVENTS);
    const evt = localStorage.getItem(KEY_EVENT_TAGS);
    const hl = localStorage.getItem(KEY_HOLOGATE_LABELS);
    if (p)  probanden   = JSON.parse(p);
    if (s)  sessions    = JSON.parse(s);
    if (st) settings    = { ...settings, ...JSON.parse(st) };
    if (bw) bewertungen = JSON.parse(bw);
    if (ev) events      = JSON.parse(ev);
    eventTags = evt ? JSON.parse(evt) : [...DEFAULT_EVENT_TAGS];
    if (!eventTags.length) eventTags = [...DEFAULT_EVENT_TAGS];
    // Sensorik wird pro Person in p.sensorik geführt; für Alt-Daten sicherstellen, dass
    // das Objekt existiert. Der frühere globale Key sl_sensorik (v2.9.0) wird verworfen.
    probanden.forEach(pr => { if (!pr.sensorik || typeof pr.sensorik !== 'object') pr.sensorik = {}; });
    // Ablauf-Zeitleiste wird pro Person in p.ablauf geführt; für Alt-Daten Objekt sicherstellen.
    probanden.forEach(pr => { if (!pr.ablauf || typeof pr.ablauf !== 'object') pr.ablauf = {}; });
    // Trainerbewertungsbögen im Ablauf: p.bewertungen = { [stepId]: [ {id,label,scores,notes,savedAt} ] }
    probanden.forEach(pr => { if (!pr.bewertungen || typeof pr.bewertungen !== 'object' || Array.isArray(pr.bewertungen)) pr.bewertungen = {}; });
    // Ereignisse im Ablauf: p.ereignisse = [ {id, stepId, tag, note, type, timeISO?|startISO?/endISO?, createdAt} ]
    probanden.forEach(pr => { if (!Array.isArray(pr.ereignisse)) pr.ereignisse = []; });
    // VR-Szenario-Durchläufe: p.szenarien = { [stepId]: [ {id, label, phases:{[phaseId]: ISO|true}} ] }
    probanden.forEach(pr => { if (!pr.szenarien || typeof pr.szenarien !== 'object' || Array.isArray(pr.szenarien)) pr.szenarien = {}; });
    // Sensorik-ablegen-Checkliste (Schritt „Sensorik ablegen"): p.sensorikAblegen = { [itemId]: ISO }
    probanden.forEach(pr => { if (!pr.sensorikAblegen || typeof pr.sensorikAblegen !== 'object') pr.sensorikAblegen = {}; });
    localStorage.removeItem(KEY_SENSORIK);
    scenarios = sc ? JSON.parse(sc) : deepCopy(DEFAULT_SCENARIOS);
    if (!scenarios.length) scenarios = deepCopy(DEFAULT_SCENARIOS);
    tags = tg ? JSON.parse(tg) : [...DEFAULT_TAGS];
    if (!tags.length) tags = [...DEFAULT_TAGS];
    // Bezeichnungen der 5 festen Hologate-Durchläufe (Schritt 7) — Anzahl ist fest, daher bei
    // abweichender Länge (z.B. beschädigte Daten) auf den Standard zurückfallen.
    hologateLabels = hl ? JSON.parse(hl) : [...DEFAULT_HOLOGATE_LABELS];
    if (!Array.isArray(hologateLabels) || hologateLabels.length !== DEFAULT_HOLOGATE_LABELS.length) {
      hologateLabels = [...DEFAULT_HOLOGATE_LABELS];
    }
    // v2.27.0/v2.28.0/v2.32.0: VR-Equipment-Schritte entfallen, Trainerbewertungsbogen wird
    // eigener Schritt, Tutorial-Zeit wandert vom Szenario-Durchlauf in normale Start-/Ende-
    // Felder, „Verabschiedung" entfällt (Datensicherung rückt auf), Rollercoaster-Schrittzeit
    // wandert in dessen Durchlauf-Phase — Alt-Daten auf die neuen Schritt-IDs/Felder ummappen.
    // Erst hier (nach scenarios/tags), damit ein sofortiges save() diese nicht mit ihren Modul-
    // Startwerten überschreibt; alle Migrationsfunktionen geben zurück, ob sich etwas geändert
    // hat, damit direkt persistiert wird statt auf den nächsten ohnehin fälligen save() zu
    // warten. migrateTutorialTimeV228 muss NACH migrateFlowStepIdsV227 laufen (siehe dortiger
    // Kommentar); migrateVerabschiedungRemovalV232 muss ebenfalls NACH migrateFlowStepIdsV227
    // laufen (setzt dessen fs_15/fs_16-IDs voraus).
    const migratedIds = probanden.map(migrateFlowStepIdsV227).some(Boolean);
    const migratedTut = probanden.map(migrateTutorialTimeV228).some(Boolean);
    const migratedVer = probanden.map(migrateVerabschiedungRemovalV232).some(Boolean);
    const migratedRc  = probanden.map(migrateRollercoasterTimeV232).some(Boolean);
    if (migratedIds || migratedTut || migratedVer || migratedRc) save();
  } catch(e) {
    scenarios = deepCopy(DEFAULT_SCENARIOS);
    tags = [...DEFAULT_TAGS];
    eventTags = [...DEFAULT_EVENT_TAGS];
    hologateLabels = [...DEFAULT_HOLOGATE_LABELS];
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function deepCopy(x) { return JSON.parse(JSON.stringify(x)); }

// Pseudonym-Format: 1 Buchstabe, 4 Zahlen, 3 Buchstaben (z.B. "P1234ABC")
const PSEUDO_FORMAT_REGEX = /^[A-Za-z]\d{4}[A-Za-z]{3}$/;
function isValidPseudoFormat(pseudo) { return PSEUDO_FORMAT_REGEX.test(pseudo); }

// Live-Validierung: markiert das Eingabefeld rot + zeigt Hinweistext, solange das Format
// nicht passt. Leeres Feld gilt nicht als ungültig (keine Fehlermeldung vor der ersten Eingabe).
function setPseudoFieldValidity(inputId, errorId) {
  const input   = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  const pseudo  = input.value.trim();
  const invalid = pseudo.length > 0 && !isValidPseudoFormat(pseudo);
  input.classList.toggle('field-invalid', invalid);
  errorEl.classList.toggle('hidden', !invalid);
  return !invalid;
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return String(Math.floor(s / 60)).padStart(2,'0') + ':' + String(s % 60).padStart(2,'0');
}

function localTimeStr(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
function localDateStr(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function localDatetimeStr(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE') + '  ' +
         d.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function isoToTimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return String(d.getHours()).padStart(2,'0') + ':' +
         String(d.getMinutes()).padStart(2,'0') + ':' +
         String(d.getSeconds()).padStart(2,'0');
}

function rebuildISO(originalISO, timeStr) {
  if (!originalISO || !timeStr) return originalISO || null;
  const orig  = new Date(originalISO);
  const parts = timeStr.split(':');
  return new Date(
    orig.getFullYear(), orig.getMonth(), orig.getDate(),
    parseInt(parts[0],10)||0, parseInt(parts[1],10)||0, parseInt(parts[2],10)||0, 0
  ).toISOString();
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, dur = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add('hidden'), dur);
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function showConfirm(title, msg, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  document.getElementById('confirm-overlay').classList.remove('hidden');
  confirmCallback = onOk;
}
document.getElementById('confirm-ok').addEventListener('click', () => {
  document.getElementById('confirm-overlay').classList.add('hidden');
  if (typeof confirmCallback === 'function') confirmCallback();
  confirmCallback = null;
});
document.getElementById('confirm-cancel').addEventListener('click', () => {
  document.getElementById('confirm-overlay').classList.add('hidden');
  confirmCallback = null;
});

// ── Navigation ────────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  ablauf:    'Ablauf',
  probanden: 'Teilnehmende',
  sensorik:  'Sensorik',
  session:   'Szenario aufzeichnen',
  log:       'Protokoll',
  bewertung: 'Trainerbewertungsbogen',
  ereignisse:'Ereignisse',
  export:    'Export',
  settings:  'Einstellungen',
};

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  // Bottom nav (mobile)
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  // Sidebar nav (tablet/desktop)
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  document.getElementById('screen-' + name)?.classList.add('active');
  document.querySelector(`.nav-btn[data-screen="${name}"]`)?.classList.add('active');
  document.querySelector(`.nav-item[data-screen="${name}"]`)?.classList.add('active');

  // Update desktop page title
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[name] || 'StudyLog';

  if (name === 'ablauf')    renderAblauf();
  if (name === 'sensorik')  renderSensorik();
  if (name === 'session')   renderSessionScreen();
  if (name === 'log')       renderLog();
  if (name === 'export')    renderExport();
  if (name === 'probanden') renderProbanden();
  if (name === 'bewertung') renderBewertungScreen();
  if (name === 'ereignisse')renderEreignisse();
  if (name === 'settings')  renderSettingsScreen();
}

// Mobile bottom nav
document.querySelectorAll('.nav-btn').forEach(btn =>
  btn.addEventListener('click', () => showScreen(btn.dataset.screen))
);
// Sidebar nav (tablet/desktop)
document.querySelectorAll('.nav-item').forEach(btn =>
  btn.addEventListener('click', () => showScreen(btn.dataset.screen))
);

// "Jetzt"-Buttons: aktuelle Uhrzeit in das zugehörige Zeitfeld schreiben (Sensorik angelegt/abgelegt)
document.querySelectorAll('.btn-time-now').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    target.value = isoToTimeInput(new Date().toISOString());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEILNEHMENDE
// ══════════════════════════════════════════════════════════════════════════════
function renderProbanden(filter = '') {
  const list  = document.getElementById('proband-list');
  const empty = document.getElementById('proband-empty');
  const label = document.getElementById('proband-count-label');
  const lower = filter.toLowerCase();
  const filtered = probanden.filter(p =>
    p.pseudo.toLowerCase().includes(lower) || String(p.sensor).includes(lower)
  );
  label.textContent = `TEILNEHMENDE (${filtered.length})`;
  if (!filtered.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = filtered.map(p => {
    const done     = sessions.filter(s => s.probandId === p.id).length;
    const initials = p.pseudo.slice(-2).toUpperCase();
    const sensTimes = (p.sensorAngelegtISO || p.sensorAbgelegtISO)
      ? '  ·  Sensorik ' + (p.sensorAngelegtISO ? isoToTimeInput(p.sensorAngelegtISO).slice(0,5) : '–')
             + '–' + (p.sensorAbgelegtISO ? isoToTimeInput(p.sensorAbgelegtISO).slice(0,5) : '–')
      : '';
    return `<button class="proband-item" data-id="${esc(p.id)}">
      <div class="avatar">${esc(initials)}</div>
      <div class="proband-info">
        <div class="proband-name">${esc(p.pseudo)}</div>
        <div class="proband-sub">${p.sensor ? 'SNR: ' + esc(p.sensor) : 'ohne SNR'}${p.handedness ? '  ·  Hand: ' + esc(p.handedness) : ''}${p.note ? '  ·  ' + esc(p.note) : ''}${sensTimes}</div>
      </div>
      <span class="badge badge-count">${done} Sitzung${done !== 1 ? 'en' : ''}</span>
    </button>`;
  }).join('');
  list.querySelectorAll('.proband-item').forEach(el =>
    el.addEventListener('click', () => openProbandEdit(el.dataset.id))
  );
}

document.getElementById('search-input').addEventListener('input', e => renderProbanden(e.target.value));

// „Neue Person anlegen" ist jetzt ein Overlay (aus Schritt 1 bzw. dem „+" oben im Ablauf).
function openProbandAddOverlay() {
  clearAddForm();
  document.getElementById('proband-add-overlay').classList.remove('hidden');
}
function closeProbandAddOverlay() {
  document.getElementById('proband-add-overlay').classList.add('hidden');
  clearAddForm();
}
document.getElementById('btn-add-proband').addEventListener('click', openProbandAddOverlay);
document.getElementById('proband-add-close').addEventListener('click', closeProbandAddOverlay);
document.getElementById('btn-cancel-proband').addEventListener('click', closeProbandAddOverlay);
document.getElementById('proband-add-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('proband-add-overlay')) closeProbandAddOverlay();
});
document.getElementById('btn-save-proband').addEventListener('click', saveNewProband);
document.getElementById('inp-pseudo').addEventListener('input', () =>
  setPseudoFieldValidity('inp-pseudo', 'inp-pseudo-error')
);

function saveNewProband() {
  const pseudo = document.getElementById('inp-pseudo').value.trim();
  const note   = document.getElementById('inp-note').value.trim();
  const handedness = document.getElementById('inp-handedness').value;
  if (!pseudo) { showToast('⚠ Pseudonym eingeben'); return; }
  if (!setPseudoFieldValidity('inp-pseudo', 'inp-pseudo-error')) { showToast('⚠ Format ungültig (z.B. P1234ABC)'); return; }
  if (handedness !== 'Rechts' && handedness !== 'Links') { showToast('⚠ Händigkeit wählen'); return; }
  if (probanden.some(p => p.pseudo.toLowerCase() === pseudo.toLowerCase())) { showToast('⚠ Pseudonym vergeben'); return; }
  const nowISO = new Date().toISOString();
  // Sensoriknummer wird beim Anlegen nicht mehr erfasst – ggf. nachträglich über "Person bearbeiten".
  // Sensorik-Zeiten ebenfalls nur im Bearbeiten-Dialog.
  const newId = uid();
  probanden.push({ id: newId, pseudo, sensor: '', note, handedness, sensorik: {}, ablauf: {}, sensorAngelegtISO: null, sensorAbgelegtISO: null, createdAt: nowISO });
  save();
  clearAddForm();
  document.getElementById('proband-add-overlay').classList.add('hidden');
  const searchEl = document.getElementById('search-input');
  renderProbanden(searchEl ? searchEl.value : '');
  showToast('✓ ' + pseudo + ' angelegt');
  // Neue Person wird die aktive im Ablauf; nach dem Anlegen direkt weiter zur Sensorik.
  selectedSensorikProbandId = newId;
  selectedAblaufProbandId   = newId;
  expandedFlowStepId        = 'fs_02';
  renderAblauf();
  showScreen('ablauf');
}
document.getElementById('sensorik-prompt-yes').addEventListener('click', () => {
  document.getElementById('sensorik-prompt-overlay').classList.add('hidden');
});
document.getElementById('sensorik-prompt-no').addEventListener('click', () => {
  document.getElementById('sensorik-prompt-overlay').classList.add('hidden');
});
function clearAddForm() {
  ['inp-pseudo','inp-note','inp-handedness'].forEach(id => { document.getElementById(id).value = ''; });
  setPseudoFieldValidity('inp-pseudo', 'inp-pseudo-error');
}

// ── Teilnehmende Edit/Delete ──────────────────────────────────────────────────
function openProbandEdit(id) {
  const p = probanden.find(x => x.id === id);
  if (!p) return;
  editingProbandId = id;
  document.getElementById('edit-pseudo').value = p.pseudo;
  document.getElementById('edit-sensor').value = p.sensor || '';
  document.getElementById('edit-note').value   = p.note || '';
  document.getElementById('edit-handedness').value = p.handedness || '';
  document.getElementById('edit-sensor-an').value = isoToTimeInput(p.sensorAngelegtISO);
  document.getElementById('edit-sensor-ab').value = isoToTimeInput(p.sensorAbgelegtISO);
  setPseudoFieldValidity('edit-pseudo', 'edit-pseudo-error');
  document.getElementById('proband-edit-overlay').classList.remove('hidden');
}
function closeProbandEdit() {
  document.getElementById('proband-edit-overlay').classList.add('hidden');
  editingProbandId = null;
}
document.getElementById('proband-edit-close').addEventListener('click', closeProbandEdit);
document.getElementById('proband-edit-cancel').addEventListener('click', closeProbandEdit);
document.getElementById('proband-edit-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('proband-edit-overlay')) closeProbandEdit();
});
document.getElementById('edit-pseudo').addEventListener('input', () =>
  setPseudoFieldValidity('edit-pseudo', 'edit-pseudo-error')
);

document.getElementById('btn-save-proband-edit').addEventListener('click', () => {
  if (!editingProbandId) return;
  const idx    = probanden.findIndex(x => x.id === editingProbandId);
  if (idx === -1) return;
  const pseudo = document.getElementById('edit-pseudo').value.trim();
  const sRaw   = document.getElementById('edit-sensor').value.trim();
  const note   = document.getElementById('edit-note').value.trim();
  const handedness = document.getElementById('edit-handedness').value;
  const anRaw  = document.getElementById('edit-sensor-an').value;
  const abRaw  = document.getElementById('edit-sensor-ab').value;
  if (!pseudo) { showToast('⚠ Pseudonym eingeben'); return; }
  if (!setPseudoFieldValidity('edit-pseudo', 'edit-pseudo-error')) { showToast('⚠ Format ungültig (z.B. P1234ABC)'); return; }
  // Sensoriknummer ist optional; nur prüfen, wenn eine eingegeben wurde
  let sensor = '';
  if (sRaw) {
    sensor = parseInt(sRaw, 10);
    if (isNaN(sensor) || sensor < 1 || sensor > 12) { showToast('⚠ Sensoriknummer 1–12'); return; }
    if (probanden.some((p,i) => i !== idx && String(p.sensor) === String(sensor))) { showToast('⚠ SNR vergeben'); return; }
  }
  if (handedness !== 'Rechts' && handedness !== 'Links') { showToast('⚠ Händigkeit wählen'); return; }
  if (probanden.some((p,i) => i !== idx && p.pseudo.toLowerCase() === pseudo.toLowerCase())) { showToast('⚠ Pseudonym vergeben'); return; }
  const baseAn = probanden[idx].sensorAngelegtISO || probanden[idx].createdAt || new Date().toISOString();
  const baseAb = probanden[idx].sensorAbgelegtISO || probanden[idx].createdAt || new Date().toISOString();
  const sensorAngelegtISO = anRaw ? rebuildISO(baseAn, anRaw) : null;
  const sensorAbgelegtISO = abRaw ? rebuildISO(baseAb, abRaw) : null;
  probanden[idx] = { ...probanden[idx], pseudo, sensor, note, handedness, sensorAngelegtISO, sensorAbgelegtISO };
  sessions = sessions.map(s => s.probandId === editingProbandId ? { ...s, pseudo, sensor } : s);
  events   = events.map(e => e.probandId === editingProbandId ? { ...e, pseudo } : e);
  save();
  closeProbandEdit();
  renderProbanden(document.getElementById('search-input').value);
  buildProbandSelect();
  showToast('✓ Gespeichert');
});

document.getElementById('btn-delete-proband').addEventListener('click', () => {
  if (!editingProbandId) return;
  const idToDelete = editingProbandId;
  const p     = probanden.find(x => x.id === idToDelete);
  const count = sessions.filter(s => s.probandId === idToDelete).length;
  const warn  = count > 0 ? ` ${count} Sitzung(en) bleiben erhalten.` : '';
  showConfirm('Person löschen',
    `"${p ? p.pseudo : ''}" löschen?${warn}`,
    () => {
      probanden = probanden.filter(x => x.id !== idToDelete);
      if (selectedSensorikProbandId === idToDelete) selectedSensorikProbandId = '';
      if (selectedAblaufProbandId === idToDelete) { selectedAblaufProbandId = ''; expandedFlowStepId = ''; }
      save();
      closeProbandEdit();
      renderProbanden(document.getElementById('search-input').value);
      buildProbandSelect();
      renderSensorik();
      renderAblauf();
      showToast('Person gelöscht');
    }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// SESSION
// ══════════════════════════════════════════════════════════════════════════════
function buildScenarioGrid() {
  const grid = document.getElementById('scenario-grid');
  if (!scenarios.length) {
    grid.innerHTML = '<div style="color:var(--text3);font-size:12px">Keine Szenarien — unter ⚙ Verwalten hinzufügen</div>';
    return;
  }
  if (!selectedScenId || !scenarios.find(s => s.id === selectedScenId)) {
    selectedScenId = scenarios[0].id;
  }
  grid.innerHTML = scenarios.map(sc => `
    <button class="scenario-btn${sc.id === selectedScenId ? ' selected' : ''}" data-scid="${esc(sc.id)}">
      <span class="sc-icon">${esc(sc.icon)}</span>
      <span>${esc(sc.name)}</span>
      <span class="sc-abbr">${esc(sc.abbr)}</span>
    </button>`).join('');
  grid.querySelectorAll('.scenario-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      selectedScenId = btn.dataset.scid;
      grid.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    })
  );
}

function buildProbandSelect() {
  const sel = document.getElementById('sel-proband');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Teilnehmende wählen —</option>' +
    probanden.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}${p.sensor ? '  ·  SNR ' + esc(p.sensor) : ''}</option>`).join('');
  // Vorauswahl: bestehende Auswahl behalten, sonst die aktuell aktive Person
  // (zuletzt in Sensorik / beim Anlegen gewählt), sonst die zuletzt angelegte Person.
  if (probanden.some(p => p.id === cur)) {
    sel.value = cur;
  } else if (probanden.some(p => p.id === selectedSensorikProbandId)) {
    sel.value = selectedSensorikProbandId;
  } else if (probanden.length) {
    sel.value = probanden[probanden.length - 1].id;
  }

  const multiMode = !!settings.multiProband;
  sel.classList.toggle('hidden', multiMode);
  document.getElementById('proband-multi-list').classList.toggle('hidden', !multiMode);
  if (multiMode) buildProbandMultiList();
  updateProbandBadge();
}

function buildProbandMultiList() {
  const list = document.getElementById('proband-multi-list');
  selectedProbandIds = selectedProbandIds.filter(id => probanden.some(p => p.id === id));
  if (!probanden.length) {
    list.innerHTML = '<div style="color:var(--text3);font-size:15px">Keine Teilnehmenden angelegt</div>';
    return;
  }
  list.innerHTML = probanden.map(p => {
    const isSel = selectedProbandIds.includes(p.id);
    return `<button class="proband-multi-item${isSel ? ' selected' : ''}" data-id="${esc(p.id)}">
      <span class="pm-check">${isSel ? '✓' : ''}</span>
      <span>${esc(p.pseudo)}${p.sensor ? '  ·  SNR ' + esc(p.sensor) : ''}</span>
    </button>`;
  }).join('');
  list.querySelectorAll('.proband-multi-item').forEach(btn =>
    btn.addEventListener('click', () => {
      const id  = btn.dataset.id;
      const idx = selectedProbandIds.indexOf(id);
      if (idx === -1) selectedProbandIds.push(id); else selectedProbandIds.splice(idx, 1);
      buildProbandMultiList();
      updateProbandBadge();
    })
  );
}

function getSelectedProbandIds() {
  if (settings.multiProband) return selectedProbandIds.slice();
  const v = document.getElementById('sel-proband').value;
  return v ? [v] : [];
}

function updateProbandBadge() {
  const badge = document.getElementById('proband-badge');
  if (settings.multiProband) {
    const n = selectedProbandIds.length;
    if (n > 0) {
      badge.textContent = `✓  ${n} Teilnehmende ausgewählt`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
    return;
  }
  const sel = document.getElementById('sel-proband');
  const p   = probanden.find(x => x.id === sel.value);
  if (p) {
    badge.textContent = `✓  ${p.pseudo}${p.note ? '  ·  ' + p.note : ''}`;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}
document.getElementById('sel-proband').addEventListener('change', updateProbandBadge);

function renderSessionScreen() {
  buildProbandSelect();
  buildScenarioGrid();
  if (!sessionRunning && !sessionEndISO) renderTagRow('deviation-tags');
  updateTimerUI();
}

// ── Tags ──────────────────────────────────────────────────────────────────────
function renderTagRow(containerId, selectedTags = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = tags.map(tag => `
    <button class="tag${selectedTags.includes(tag) ? ' active' : ''}" data-tag="${esc(tag)}">${esc(tag)}</button>
  `).join('');
  container.querySelectorAll('.tag').forEach(btn =>
    btn.addEventListener('click', () => btn.classList.toggle('active'))
  );
}
function getActiveTags(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} .tag.active`)).map(t => t.dataset.tag);
}

// ── Sensorik-Checkliste (pro Teilnehmende:r) ──────────────────────────────────
function buildSensorikProbandSelect() {
  const sel = document.getElementById('sensorik-proband-select');
  if (!sel) return;
  // Default: zuletzt angelegte Person, falls (noch) keine gültige Auswahl besteht
  if (!probanden.some(p => p.id === selectedSensorikProbandId)) {
    selectedSensorikProbandId = probanden.length ? probanden[probanden.length - 1].id : '';
  }
  sel.innerHTML = probanden.length
    ? probanden.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}${p.sensor ? '  ·  SNR ' + esc(p.sensor) : ''}</option>`).join('')
    : '<option value="">— keine Teilnehmenden —</option>';
  sel.value = selectedSensorikProbandId;
  sel.disabled = !probanden.length;
}
document.getElementById('sensorik-proband-select').addEventListener('change', e => {
  selectedSensorikProbandId = e.target.value;
  renderSensorik();
});

function renderSensorik() {
  const list  = document.getElementById('sensorik-list');
  const empty = document.getElementById('sensorik-empty');
  const btnReset = document.getElementById('btn-reset-sensorik');
  if (!list) return;
  buildSensorikProbandSelect();
  const p = probanden.find(x => x.id === selectedSensorikProbandId);
  if (!p) {
    list.innerHTML = '';
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    btnReset.classList.add('hidden');
    return;
  }
  if (!p.sensorik) p.sensorik = {};
  empty.classList.add('hidden');
  list.classList.remove('hidden');
  btnReset.classList.remove('hidden');
  list.innerHTML = SENSORIK_ITEMS.map(item => {
    const at = p.sensorik[item.id] || null;
    const done = !!at;
    const timeStr = done ? localDatetimeStr(at) : 'noch nicht angelegt';
    return `<button class="sensorik-item${done ? ' checked' : ''}" data-id="${esc(item.id)}">
      <span class="sensorik-check">${done ? '✓' : ''}</span>
      <span class="sensorik-info">
        <span class="sensorik-name">${esc(item.label)}</span>
        <span class="sensorik-time">${esc(timeStr)}</span>
      </span>
    </button>`;
  }).join('');
  list.querySelectorAll('.sensorik-item').forEach(btn =>
    btn.addEventListener('click', () => toggleSensorik(btn.dataset.id))
  );
}

function toggleSensorik(id) {
  const p = probanden.find(x => x.id === selectedSensorikProbandId);
  if (!p) return;
  if (!p.sensorik) p.sensorik = {};
  const item = SENSORIK_ITEMS.find(x => x.id === id);
  if (!item) return;
  if (p.sensorik[id]) {
    // Erfassung rückgängig machen — Sicherheitsabfrage, da der Zeitstempel verloren geht
    showConfirm('Erfassung rückgängig machen',
      `„${item.label}" wurde für ${p.pseudo} um ${localTimeStr(p.sensorik[id])} als angelegt erfasst. Erfassung wirklich entfernen?`,
      () => { delete p.sensorik[id]; save(); renderSensorik(); showToast('Erfassung entfernt'); });
  } else {
    p.sensorik[id] = new Date().toISOString();
    save();
    renderSensorik();
    if (SENSORIK_ITEMS.every(it => p.sensorik[it.id])) {
      showToast('✓ Sensorik komplett erfasst');
    } else {
      showToast('✓ ' + item.label + '  ·  ' + localTimeStr(p.sensorik[id]));
    }
  }
}

document.getElementById('btn-reset-sensorik').addEventListener('click', () => {
  const p = probanden.find(x => x.id === selectedSensorikProbandId);
  if (!p || !p.sensorik || !Object.keys(p.sensorik).length) { showToast('Nichts zurückzusetzen'); return; }
  showConfirm('Checkliste zurücksetzen',
    `Alle erfassten Sensorik-Zeitpunkte für „${p.pseudo}" werden entfernt.`,
    () => { p.sensorik = {}; save(); renderSensorik(); showToast('Checkliste zurückgesetzt'); });
});

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer() {
  if (sessionRunning) return;
  if (sessionEndISO) {
    // Es liegt eine gestoppte, aber noch nicht gespeicherte Aufzeichnung vor
    showConfirm('Aufzeichnung verwerfen?',
      'Die letzte Aufzeichnung wurde noch nicht gespeichert. Wenn du jetzt eine neue Sitzung startest, geht sie unwiderruflich verloren. Trotzdem verwerfen und neu starten?',
      () => beginTimer());
    return;
  }
  beginTimer();
}

function beginTimer() {
  if (!getSelectedProbandIds().length) { showToast('⚠ Teilnehmende wählen'); return; }
  if (!selectedScenId) { showToast('⚠ Szenario wählen'); return; }
  timerStart      = Date.now();
  timerElapsed    = 0;
  sessionRunning  = true;
  sessionPaused   = false;
  pauseStart      = null;
  pauseStartISO   = null;
  pauses          = [];
  sessionStartISO = new Date().toISOString();
  sessionEndISO   = null;
  document.getElementById('save-card').classList.add('hidden');
  runTimerInterval();
  updateTimerUI();
}

function runTimerInterval() {
  timerInterval = setInterval(() => {
    timerElapsed = Math.floor((Date.now() - timerStart) / 1000);
    document.getElementById('timer-display').textContent = formatTime(timerElapsed);
  }, 500);
}

function pauseTimer() {
  if (!sessionRunning || sessionPaused) return;
  clearInterval(timerInterval);
  timerInterval = null;
  timerElapsed  = Math.max(0, Math.floor((Date.now() - timerStart) / 1000));
  document.getElementById('timer-display').textContent = formatTime(timerElapsed);
  sessionPaused = true;
  pauseStart    = Date.now();
  pauseStartISO = new Date().toISOString();
  updateTimerUI();
}

function resumeTimer() {
  if (!sessionRunning || !sessionPaused) return;
  const pauseDurationMs = Date.now() - pauseStart;
  pauses.push({
    startISO:   pauseStartISO,
    endISO:     new Date().toISOString(),
    duration_s: Math.round(pauseDurationMs / 1000)
  });
  timerStart    += pauseDurationMs; // schiebt den Startpunkt vor, damit die aktive Dauer die Pause ausklammert
  sessionPaused  = false;
  pauseStart     = null;
  pauseStartISO  = null;
  runTimerInterval();
  updateTimerUI();
}

function stopTimer() {
  if (!sessionRunning) return;
  if (sessionPaused) {
    pauses.push({
      startISO:   pauseStartISO,
      endISO:     new Date().toISOString(),
      duration_s: Math.round((Date.now() - pauseStart) / 1000)
    });
    sessionPaused = false;
    pauseStart    = null;
    pauseStartISO = null;
  } else {
    clearInterval(timerInterval);
    timerInterval = null;
    timerElapsed  = Math.max(0, Math.floor((Date.now() - timerStart) / 1000));
  }
  sessionRunning = false;
  sessionEndISO  = new Date().toISOString();
  document.getElementById('save-card').classList.remove('hidden');
  updateTimerUI();
  setTimeout(() =>
    document.getElementById('save-card').scrollIntoView({ behavior:'smooth', block:'nearest' }), 100
  );
}

function totalPauseSeconds(list) {
  return list.reduce((sum, p) => sum + (p.duration_s || 0), 0);
}

function updateTimerUI() {
  const status    = document.getElementById('timer-status');
  const meta      = document.getElementById('timer-meta');
  const btnStart  = document.getElementById('btn-start');
  const btnPause  = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnStop   = document.getElementById('btn-stop');
  const display   = document.getElementById('timer-display');
  const sc = scenarios.find(s => s.id === selectedScenId);
  const pauseInfo = pauses.length
    ? '  ·  Pausen: ' + pauses.length + ' (' + formatTime(totalPauseSeconds(pauses)) + ')'
    : '';

  [btnStart, btnPause, btnResume, btnStop].forEach(b => b.classList.add('hidden'));

  if (sessionRunning && sessionPaused) {
    status.innerHTML = '<span class="status-paused">⏸ PAUSIERT</span>';
    meta.textContent = 'Pausiert seit ' + localTimeStr(pauseStartISO) + (sc ? '  ·  ' + sc.abbr : '') + pauseInfo;
    btnResume.classList.remove('hidden');
    btnStop.classList.remove('hidden');
  } else if (sessionRunning) {
    status.innerHTML = '<span class="status-running">● LÄUFT</span>';
    meta.textContent = 'Start: ' + localTimeStr(sessionStartISO) + (sc ? '  ·  ' + sc.abbr : '') + pauseInfo;
    btnPause.classList.remove('hidden');
    btnStop.classList.remove('hidden');
  } else if (sessionEndISO) {
    status.innerHTML = '<span class="status-done">✓ Abgeschlossen</span>';
    meta.textContent = localTimeStr(sessionStartISO) + ' → ' + localTimeStr(sessionEndISO) + '  ·  ' + formatTime(timerElapsed) + pauseInfo;
    btnStart.classList.remove('hidden');
    display.textContent = formatTime(timerElapsed);
  } else {
    status.innerHTML = '<span class="status-idle">Bereit</span>';
    meta.textContent = '';
    display.textContent = '00:00';
    btnStart.classList.remove('hidden');
  }
}

document.getElementById('btn-start').addEventListener('click', startTimer);
document.getElementById('btn-pause').addEventListener('click', pauseTimer);
document.getElementById('btn-resume').addEventListener('click', resumeTimer);
document.getElementById('btn-stop').addEventListener('click', stopTimer);

document.getElementById('btn-save-session').addEventListener('click', () => {
  const probandIds = getSelectedProbandIds();
  if (!probandIds.length) { showToast('⚠ Keine Teilnehmenden'); return; }
  if (!sessionStartISO) { showToast('⚠ Nicht gestartet'); return; }
  if (!sessionEndISO)   { showToast('⚠ Nicht gestoppt'); return; }
  const sc = scenarios.find(x => x.id === selectedScenId);
  const deviations = getActiveTags('deviation-tags');
  const notes      = document.getElementById('session-notes').value.trim();
  const newSessionIds = probandIds.map(probandId => {
    const p = probanden.find(x => x.id === probandId);
    const newSessionId = uid();
    sessions.push({
      id: newSessionId, probandId,
      pseudo:       p  ? p.pseudo  : '?',
      sensor:       p  ? p.sensor  : '?',
      scenarioId:   selectedScenId,
      scenarioName: sc ? sc.name   : '?',
      scenarioAbbr: sc ? sc.abbr   : '?',
      date:         localDateStr(sessionStartISO),
      startISO:     sessionStartISO,
      endISO:       sessionEndISO,
      duration_s:   timerElapsed,
      pauses:          pauses.slice(),
      pauseCount:      pauses.length,
      pauseDuration_s: totalPauseSeconds(pauses),
      deviations, notes,
      deviceLabel:  settings.deviceLabel || '',
      createdAt:    new Date().toISOString()
    });
    return newSessionId;
  });
  save();
  sessionStartISO = null; sessionEndISO = null; timerElapsed = 0;
  pauses = []; sessionPaused = false; pauseStart = null; pauseStartISO = null;
  document.getElementById('save-card').classList.add('hidden');
  renderTagRow('deviation-tags');
  document.getElementById('session-notes').value = '';
  updateTimerUI();
  showToast(newSessionIds.length > 1 ? `✓ ${newSessionIds.length} Sitzungen gespeichert` : '✓ Sitzung gespeichert');
  // Bewertungsbogen-Prompt — bei mehreren Teilnehmenden Vorschlag zur gemeinsamen Bewertung
  pendingBewertungSessionIds = newSessionIds.slice();
  if (newSessionIds.length === 1) {
    const ps  = sessions.find(s => s.id === newSessionIds[0]);
    const sc2 = scenarios.find(x => x.id === ps.scenarioId);
    document.getElementById('bew-prompt-msg').textContent =
      `Möchtest du jetzt den Trainerbewertungsbogen für ${ps.pseudo} · ${sc2 ? sc2.abbr : ps.scenarioAbbr || '?'} ausfüllen?`;
  } else {
    const names = newSessionIds.map(id => { const s = sessions.find(x => x.id === id); return s ? s.pseudo : '?'; }).join(', ');
    document.getElementById('bew-prompt-msg').textContent =
      `Möchtest du jetzt den Trainerbewertungsbogen für ${names} gemeinsam ausfüllen?`;
  }
  document.getElementById('bew-prompt-overlay').classList.remove('hidden');
});

// ── Scenario Manager ──────────────────────────────────────────────────────────
document.getElementById('btn-manage-scenarios').addEventListener('click', () => {
  renderScenarioManager();
  document.getElementById('scenario-overlay').classList.remove('hidden');
});
document.getElementById('scenario-close').addEventListener('click', () => {
  document.getElementById('scenario-overlay').classList.add('hidden');
  buildScenarioGrid();
});

function renderScenarioManager() {
  const list = document.getElementById('scenario-list-modal');
  if (!scenarios.length) {
    list.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px">Keine Szenarien</div>';
    return;
  }
  list.innerHTML = scenarios.map((sc, i) => `
    <div class="scenario-manager-item">
      <span class="sm-icon">${esc(sc.icon)}</span>
      <div class="sm-info">
        <div class="sm-name">${esc(sc.name)}</div>
        <div class="sm-abbr">${esc(sc.abbr)}</div>
      </div>
      <div class="sm-btns">
        ${i > 0 ? `<button class="sm-btn" data-action="up" data-idx="${i}">↑</button>` : ''}
        <button class="sm-btn del" data-action="del" data-idx="${i}">✕</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-action]').forEach(btn =>
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (btn.dataset.action === 'del') {
        if (scenarios.length <= 1) { showToast('⚠ Mindestens 1 Szenario'); return; }
        showConfirm('Szenario löschen', `"${scenarios[idx].name}" löschen?`, () => {
          if (selectedScenId === scenarios[idx].id) selectedScenId = '';
          scenarios.splice(idx, 1); save(); renderScenarioManager();
        });
      } else if (btn.dataset.action === 'up') {
        [scenarios[idx], scenarios[idx-1]] = [scenarios[idx-1], scenarios[idx]];
        save(); renderScenarioManager();
      }
    })
  );
}

document.getElementById('btn-add-scenario').addEventListener('click', () => {
  const name = document.getElementById('new-scenario-name').value.trim();
  const abbr = document.getElementById('new-scenario-abbr').value.trim().toUpperCase();
  const icon = document.getElementById('new-scenario-icon').value.trim() || '📋';
  if (!name) { showToast('⚠ Name eingeben'); return; }
  if (!abbr) { showToast('⚠ Abkürzung eingeben'); return; }
  if (scenarios.some(s => s.abbr === abbr)) { showToast('⚠ Abkürzung vergeben'); return; }
  scenarios.push({ id: uid(), name, abbr, icon });
  save();
  document.getElementById('new-scenario-name').value = '';
  document.getElementById('new-scenario-abbr').value = '';
  document.getElementById('new-scenario-icon').value = '';
  renderScenarioManager();
  showToast('✓ Szenario hinzugefügt');
});

// ── Tag Manager ───────────────────────────────────────────────────────────────
document.getElementById('btn-manage-tags').addEventListener('click', () => {
  renderTagManager();
  document.getElementById('tag-overlay').classList.remove('hidden');
});
document.getElementById('tag-close').addEventListener('click', () => {
  document.getElementById('tag-overlay').classList.add('hidden');
  renderTagRow('deviation-tags');
});
document.getElementById('tag-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('tag-overlay')) {
    document.getElementById('tag-overlay').classList.add('hidden');
    renderTagRow('deviation-tags');
  }
});

function renderTagManager() {
  const list = document.getElementById('tag-list-modal');
  if (!tags.length) {
    list.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px">Keine Tags</div>';
    return;
  }
  list.innerHTML = tags.map((tag, i) => `
    <div class="scenario-manager-item" data-idx="${i}">
      <div class="sm-info"><div class="sm-name">${esc(tag)}</div></div>
      <div class="sm-btns">
        <button class="sm-btn" data-action="edit" data-idx="${i}">✏</button>
        <button class="sm-btn del" data-action="del" data-idx="${i}">✕</button>
      </div>
    </div>
    <div class="tag-edit-row hidden" id="tag-edit-row-${i}">
      <input type="text" class="tag-edit-input" id="tag-edit-input-${i}" value="${esc(tag)}" autocorrect="off">
      <div class="btn-row" style="margin-top:6px">
        <button class="btn btn-primary flex-1" data-action="save" data-idx="${i}">✓ Speichern</button>
        <button class="btn btn-ghost" data-action="cancel-edit" data-idx="${i}">Abbrechen</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-action]').forEach(btn =>
    btn.addEventListener('click', () => {
      const idx    = parseInt(btn.dataset.idx, 10);
      const action = btn.dataset.action;
      if (action === 'del') {
        if (tags.length <= 1) { showToast('⚠ Mindestens 1 Tag'); return; }
        showConfirm('Tag löschen', `"${tags[idx]}" löschen?`, () => {
          tags.splice(idx, 1); save(); renderTagManager();
        });
      } else if (action === 'edit') {
        document.getElementById(`tag-edit-row-${idx}`).classList.remove('hidden');
        document.getElementById(`tag-edit-input-${idx}`).focus();
      } else if (action === 'cancel-edit') {
        document.getElementById(`tag-edit-row-${idx}`).classList.add('hidden');
      } else if (action === 'save') {
        const val = document.getElementById(`tag-edit-input-${idx}`).value.trim();
        if (!val) { showToast('⚠ Bezeichnung eingeben'); return; }
        if (tags.some((t,i) => i !== idx && t.toLowerCase() === val.toLowerCase())) { showToast('⚠ Tag vergeben'); return; }
        tags[idx] = val; save(); renderTagManager();
        showToast('✓ Tag aktualisiert');
      }
    })
  );
}

document.getElementById('btn-add-tag').addEventListener('click', () => {
  const val = document.getElementById('new-tag-label').value.trim();
  if (!val) { showToast('⚠ Bezeichnung eingeben'); return; }
  if (tags.some(t => t.toLowerCase() === val.toLowerCase())) { showToast('⚠ Tag vergeben'); return; }
  tags.push(val); save();
  document.getElementById('new-tag-label').value = '';
  renderTagManager();
  showToast('✓ Tag hinzugefügt');
});

// ══════════════════════════════════════════════════════════════════════════════
// LOG
// ══════════════════════════════════════════════════════════════════════════════
function buildLogFilters() {
  const stSel = document.getElementById('log-filter-station');
  const prSel = document.getElementById('log-filter-proband');
  const stVal = stSel.value;
  const prVal = prSel.value;
  stSel.innerHTML = '<option value="all">Alle Szenarien</option>' +
    scenarios.map(sc => `<option value="${esc(sc.id)}">${esc(sc.icon)} ${esc(sc.name)}</option>`).join('');
  prSel.innerHTML = '<option value="all">Alle Teilnehmenden</option>' +
    probanden.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}${p.sensor ? ' (SNR ' + esc(p.sensor) + ')' : ''}</option>`).join('');
  if (scenarios.find(s => s.id === stVal)) stSel.value = stVal;
  if (probanden.find(p => p.id === prVal)) prSel.value = prVal;
}

function getFilteredSessions() {
  const stVal = document.getElementById('log-filter-station').value;
  const prVal = document.getElementById('log-filter-proband').value;
  return sessions
    .filter(s => (stVal === 'all' || s.scenarioId === stVal) && (prVal === 'all' || s.probandId === prVal))
    .slice().reverse();
}

function renderLog() {
  buildLogFilters();
  const list     = document.getElementById('log-list');
  const empty    = document.getElementById('log-empty');
  const label    = document.getElementById('log-count-label');
  const filtered = getFilteredSessions();
  label.textContent = `SITZUNGEN (${filtered.length})`;
  if (!filtered.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = filtered.map(s => {
    const hasDev    = s.deviations && s.deviations.length > 0;
    const devLine   = hasDev ? `<div class="log-dev">⚑  ${esc(s.deviations.join('  ·  '))}</div>` : '';
    const hasPause  = s.pauseCount > 0;
    const pauseLine = hasPause
      ? `<div class="log-pause">⏸  ${s.pauseCount} Pause${s.pauseCount !== 1 ? 'n' : ''} · ${esc(formatTime(s.pauseDuration_s || 0))}</div>`
      : '';
    const sc   = scenarios.find(x => x.id === s.scenarioId);
    const icon = sc ? sc.icon + ' ' : '';
    const abbr = s.scenarioAbbr || s.scenarioName || '?';
    return `<button class="log-entry${hasDev ? ' has-deviation' : ''}" data-id="${esc(s.id)}">
      <div class="log-row-top">
        <span class="log-id">${esc(s.pseudo)}  ·  ${icon}${esc(abbr)}</span>
        <span class="log-time">${esc(localTimeStr(s.startISO))} – ${esc(localTimeStr(s.endISO))}</span>
      </div>
      <div class="log-meta">${esc(s.date)}  ·  Dauer: ${esc(formatTime(s.duration_s || 0))}</div>
      ${devLine}
      ${pauseLine}
    </button>`;
  }).join('');
  list.querySelectorAll('.log-entry').forEach(el =>
    el.addEventListener('click', () => openSessionDetail(el.dataset.id))
  );
}

document.getElementById('log-filter-station').addEventListener('change', renderLog);
document.getElementById('log-filter-proband').addEventListener('change', renderLog);

// ── Session Detail ────────────────────────────────────────────────────────────
function openSessionDetail(id) {
  const s = sessions.find(x => x.id === id);
  if (!s) return;
  detailSessionId = id;
  const sc = scenarios.find(x => x.id === s.scenarioId);
  document.getElementById('detail-title').textContent = s.pseudo + '  ·  ' + (sc ? sc.abbr : s.scenarioAbbr || '?');
  const rows = [
    ['Datum',          s.date],
    ['Pseudonym',      s.pseudo],
    ['Sensoriknummer', s.sensor],
    ['Szenario',       (sc ? sc.icon + ' ' : '') + (sc ? sc.name : s.scenarioName || '?')],
    ['Start',          localTimeStr(s.startISO)],
    ['Ende',           localTimeStr(s.endISO)],
    ['Aktive Dauer',   formatTime(s.duration_s || 0) + ' (ohne Pausen)'],
  ];
  if (s.pauseCount) {
    rows.push(['Pausen', s.pauseCount + ' · Gesamt ' + formatTime(s.pauseDuration_s || 0)]);
    rows.push(['Pausenzeiten', s.pauses.map(p =>
      localTimeStr(p.startISO) + '–' + localTimeStr(p.endISO) + ' (' + formatTime(p.duration_s || 0) + ')'
    ).join('; ')]);
  } else {
    rows.push(['Pausen', '—']);
  }
  rows.push(
    ['Abweichungen',   s.deviations?.length ? s.deviations.join(', ') : '—'],
    ['Anmerkungen',    s.notes || '—'],
    ['Gerät/Betreuung',s.deviceLabel || '—'],
  );
  document.getElementById('detail-content').innerHTML = rows
    .map(([k,v]) => `<div class="detail-row"><div class="detail-key">${esc(k)}</div><div class="detail-val">${esc(v)}</div></div>`).join('');
  document.getElementById('detail-overlay').classList.remove('hidden');
}

document.getElementById('detail-close').addEventListener('click', closeDetailOverlay);
document.getElementById('detail-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('detail-overlay')) closeDetailOverlay();
});
function closeDetailOverlay() {
  document.getElementById('detail-overlay').classList.add('hidden');
  detailSessionId = null;
}

document.getElementById('btn-delete-session').addEventListener('click', () => {
  if (!detailSessionId) return;
  const idToDelete = detailSessionId;
  const s = sessions.find(x => x.id === idToDelete);
  showConfirm('Sitzung löschen',
    `Sitzung von ${s ? s.pseudo : ''} löschen?`,
    () => {
      sessions = sessions.filter(x => x.id !== idToDelete);
      save();
      document.getElementById('detail-overlay').classList.add('hidden');
      document.getElementById('edit-overlay').classList.add('hidden');
      detailSessionId = null;
      renderLog();
      showToast('Sitzung gelöscht');
    }
  );
});

document.getElementById('btn-edit-session').addEventListener('click', () => {
  if (!detailSessionId) return;
  openEditSession(detailSessionId);
});

function openEditSession(id) {
  const s = sessions.find(x => x.id === id);
  if (!s) return;
  const prSel = document.getElementById('edit-proband');
  prSel.innerHTML = probanden.map(p =>
    `<option value="${esc(p.id)}"${p.id === s.probandId ? ' selected' : ''}>${esc(p.pseudo)}${p.sensor ? ' (SNR ' + esc(p.sensor) + ')' : ''}</option>`
  ).join('');
  if (!probanden.find(p => p.id === s.probandId)) {
    prSel.innerHTML = `<option value="${esc(s.probandId)}" selected>${esc(s.pseudo)} (gelöscht)</option>` + prSel.innerHTML;
  }
  const scSel = document.getElementById('edit-scenario');
  scSel.innerHTML = scenarios.map(sc =>
    `<option value="${esc(sc.id)}"${sc.id === s.scenarioId ? ' selected' : ''}>${esc(sc.icon)} ${esc(sc.name)}</option>`
  ).join('');
  document.getElementById('edit-date-info').textContent = '📅 ' + s.date + ' (Datum nicht änderbar)';
  document.getElementById('edit-start-time').value = isoToTimeInput(s.startISO);
  document.getElementById('edit-end-time').value   = isoToTimeInput(s.endISO);
  document.getElementById('edit-notes').value = s.notes || '';
  renderTagRow('edit-deviation-tags', s.deviations || []);
  document.getElementById('detail-overlay').classList.add('hidden');
  document.getElementById('edit-overlay').classList.remove('hidden');
}

document.getElementById('edit-close').addEventListener('click', () =>
  document.getElementById('edit-overlay').classList.add('hidden')
);
document.getElementById('edit-cancel').addEventListener('click', () =>
  document.getElementById('edit-overlay').classList.add('hidden')
);
document.getElementById('edit-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('edit-overlay'))
    document.getElementById('edit-overlay').classList.add('hidden');
});

document.getElementById('btn-save-edit').addEventListener('click', () => {
  if (!detailSessionId) { showToast('⚠ Keine Sitzung ausgewählt'); return; }
  const idx = sessions.findIndex(x => x.id === detailSessionId);
  if (idx === -1) return;
  const s          = sessions[idx];
  const probandId  = document.getElementById('edit-proband').value;
  const scenarioId = document.getElementById('edit-scenario').value;
  const startTime  = document.getElementById('edit-start-time').value;
  const endTime    = document.getElementById('edit-end-time').value;
  const notes      = document.getElementById('edit-notes').value.trim();
  const deviations = getActiveTags('edit-deviation-tags');
  if (!startTime) { showToast('⚠ Startzeit eingeben'); return; }
  if (!endTime)   { showToast('⚠ Endzeit eingeben'); return; }
  const newStartISO = rebuildISO(s.startISO, startTime);
  const newEndISO   = rebuildISO(s.endISO || s.startISO, endTime);
  if (!newStartISO || !newEndISO) { showToast('⚠ Ungültige Zeit'); return; }
  if (new Date(newEndISO) <= new Date(newStartISO)) { showToast('⚠ Ende muss nach Start liegen'); return; }
  const dur = Math.round((new Date(newEndISO) - new Date(newStartISO)) / 1000);
  const p   = probanden.find(x => x.id === probandId);
  const sc  = scenarios.find(x => x.id === scenarioId);
  sessions[idx] = {
    ...s, probandId,
    pseudo:       p  ? p.pseudo : s.pseudo,
    sensor:       p  ? p.sensor : s.sensor,
    scenarioId,
    scenarioName: sc ? sc.name  : s.scenarioName,
    scenarioAbbr: sc ? sc.abbr  : s.scenarioAbbr,
    startISO: newStartISO, endISO: newEndISO,
    date: localDateStr(newStartISO),
    duration_s: dur, notes, deviations,
    editedAt: new Date().toISOString()
  };
  save();
  document.getElementById('edit-overlay').classList.add('hidden');
  detailSessionId = null;
  renderLog();
  showToast('✓ Sitzung aktualisiert');
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════════════════
function buildExportFilters() {
  const sel = document.getElementById('export-filter-station');
  const cur = sel.value;
  sel.innerHTML = '<option value="all">Alle Szenarien</option>' +
    scenarios.map(sc => `<option value="${esc(sc.id)}">${esc(sc.icon)} ${esc(sc.name)}</option>`).join('');
  if (scenarios.find(s => s.id === cur)) sel.value = cur;
}
function getExportSessions() {
  const v = document.getElementById('export-filter-station').value;
  return v === 'all' ? sessions : sessions.filter(s => s.scenarioId === v);
}
function renderStats() {
  const data  = getExportSessions();
  const total = data.length;
  const avg   = total > 0 ? Math.round(data.reduce((a,s) => a + (s.duration_s||0), 0) / total) : 0;
  const devs  = data.filter(s => s.deviations?.length > 0).length;
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Sitzungen</div></div>
    <div class="stat-card"><div class="stat-value">${formatTime(avg)}</div><div class="stat-label">⌀ Dauer</div></div>
    <div class="stat-card"><div class="stat-value">${devs}</div><div class="stat-label">Abweich.</div></div>`;
}
function renderExport() {
  buildExportFilters();
  renderStats();
  document.getElementById('inp-device-label').value = settings.deviceLabel || '';
  document.getElementById('last-export-info').textContent =
    settings.lastExport ? localDatetimeStr(settings.lastExport) : 'Noch kein Export';
}
document.getElementById('export-filter-station').addEventListener('change', renderStats);
document.getElementById('inp-device-label').addEventListener('change', e => {
  settings.deviceLabel = e.target.value.trim(); save();
});

function escCsv(val) {
  const s = String(val ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g,'""') + '"' : s;
}
document.getElementById('btn-export-csv').addEventListener('click', () => {
  const data = getExportSessions();
  if (!data.length) { showToast('⚠ Keine Daten'); return; }
  const hdr = ['ID','Datum','Pseudonym','Sensoriknummer','Szenario','Szenario_Abkuerzung',
                'Start_ISO','Ende_ISO','Start_Uhrzeit','Ende_Uhrzeit',
                'Dauer_s','Dauer_mm_ss','Pausen_Anzahl','Pausen_Dauer_s','Pausen_Detail',
                'Abweichungen','Anmerkungen','Geraet_Betreuung',
                'Bew_A1','Bew_A2','Bew_A3','Bew_A4',
                'Bew_B5','Bew_B6','Bew_B7','Bew_B8',
                'Bew_C9','Bew_C10','Bew_D11','Bew_D12',
                'Bew_E13','Bew_E15','Bew_E16',
                'Bew_Z17','Bew_Z18','Bew_Z19','Bew_Z20',
                'Bew_Anmerkungen'];
  const rows = data.map(s => {
    const bew = bewertungen.find(b => b.sessionId === s.id);
    const sc = bew ? bew.scores : {};
    return [
      s.id, s.date, s.pseudo, s.sensor,
      s.scenarioName||'?', s.scenarioAbbr||'?',
      s.startISO, s.endISO,
      localTimeStr(s.startISO), localTimeStr(s.endISO),
      s.duration_s||0, formatTime(s.duration_s||0),
      s.pauseCount||0, s.pauseDuration_s||0,
      (s.pauses||[]).map(p => localTimeStr(p.startISO)+'-'+localTimeStr(p.endISO)+' ('+formatTime(p.duration_s||0)+')').join('; '),
      (s.deviations||[]).join('; '), s.notes||'', s.deviceLabel||'',
      sc.a1??'', sc.a2??'', sc.a3??'', sc.a4??'',
      sc.b5??'', sc.b6??'', sc.b7??'', sc.b8??'',
      sc.c9??'', sc.c10??'', sc.d11??'', sc.d12??'',
      sc.e13??'', sc.e15??'', sc.e16??'',
      sc.z17??'', sc.z18??'', sc.z19??'', sc.z20??'',
      bew ? (bew.notes||'') : ''
    ].map(escCsv).join(',');
  });
  downloadFile('\uFEFF' + [hdr.join(','),...rows].join('\r\n'), `studylog_${dateSlug()}.csv`, 'text/csv;charset=utf-8;');
  recordExport(); showToast('✓ CSV: ' + data.length + ' Sitzungen');
});
document.getElementById('btn-export-json').addEventListener('click', () => {
  const data = getExportSessions();
  if (!data.length) { showToast('⚠ Keine Daten'); return; }
  const enriched = data.map(s => ({
    ...s,
    start_local: localTimeStr(s.startISO),
    end_local:   localTimeStr(s.endISO),
    bewertung:   bewertungen.find(b => b.sessionId === s.id) || null
  }));
  downloadFile(JSON.stringify(enriched, null, 2), `studylog_${dateSlug()}.json`, 'application/json');
  recordExport(); showToast('✓ JSON: ' + data.length + ' Sitzungen');
});
function dateSlug() { return new Date().toISOString().slice(0,10).replace(/-/g,''); }
function downloadFile(content, filename, type) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type })), download: filename
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function recordExport() {
  settings.lastExport = new Date().toISOString(); save();
  document.getElementById('last-export-info').textContent = localDatetimeStr(settings.lastExport);
}
document.getElementById('btn-clear-data').addEventListener('click', () => {
  showConfirm('⚠ Alle Daten löschen',
    'Alle Teilnehmenden (inkl. erfasster Sensorik-Zeitpunkte), Sitzungsdaten, Bewertungen und erfassten Ereignisse werden unwiderruflich gelöscht. Vorher exportieren!',
    () => {
      probanden = []; sessions = []; bewertungen = []; events = []; settings.lastExport = null;
      selectedProbandIds = []; selectedBewSessionIds = []; pendingBewertungSessionIds = [];
      selectedSensorikProbandId = '';
      selectedAblaufProbandId = ''; expandedFlowStepId = '';
      save(); renderProbanden(); renderLog(); renderExport(); renderSensorik(); renderEreignisse(); renderAblauf();
      showToast('Alle Daten gelöscht');
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// EINSTELLUNGEN
// ══════════════════════════════════════════════════════════════════════════════
// Seit v2.31.0: „Mehrere Teilnehmende gleichzeitig" (Alt-Feature der inzwischen
// unerreichbaren Sitzungsaufzeichnungs-/Bewertungs-Screens) entfällt aus den Einstellungen.
// Stattdessen editierbar: Bezeichnungen der 5 Hologate-Durchläufe + Ereignis-Kategorien.
function renderSettingsScreen() {
  renderHologateLabelSettings();
}

// Bezeichnungen der 5 festen Hologate-Durchläufe (Schritt 7) — Reihenfolge/Anzahl fest,
// nur der Text je Position ist editierbar. Wirkt sich sofort auf Schritt 7 aus, da
// ensureHologateRuns() bei jedem Render aus `hologateLabels` neu beschriftet.
function renderHologateLabelSettings() {
  const box = document.getElementById('settings-hologate-labels');
  if (!box) return;
  box.innerHTML = hologateLabels.map((label, i) => `
    <div style="margin-bottom:8px">
      <label class="field-label" for="hologate-label-${i}">Durchlauf ${i + 1}</label>
      <input type="text" id="hologate-label-${i}" class="hologate-label-input" data-idx="${i}" value="${esc(label)}" autocorrect="off">
    </div>`).join('');
  box.querySelectorAll('.hologate-label-input').forEach(inp =>
    inp.addEventListener('change', () => {
      const idx = parseInt(inp.dataset.idx, 10);
      const val = inp.value.trim();
      if (!val) { inp.value = hologateLabels[idx]; showToast('⚠ Bezeichnung darf nicht leer sein'); return; }
      hologateLabels[idx] = val;
      save();
      renderAblauf();
      showToast('✓ Gespeichert');
    })
  );
}
document.getElementById('btn-reset-hologate-labels').addEventListener('click', () => {
  showConfirm('Auf Standard zurücksetzen', 'Alle 5 Bezeichnungen auf die Standardwerte zurücksetzen?', () => {
    hologateLabels = [...DEFAULT_HOLOGATE_LABELS];
    save();
    renderHologateLabelSettings();
    renderAblauf();
    showToast('✓ Zurückgesetzt');
  });
});

// Ereignis-Kategorien-Manager (Overlay + renderEventTagManager() existieren bereits für den
// früheren Tab „Ereignisse"; hier nur ein zusätzlicher Aufrufpfad aus den Einstellungen).
function openEventTagManager() {
  renderEventTagManager();
  document.getElementById('event-tag-overlay').classList.remove('hidden');
}
document.getElementById('btn-settings-manage-event-tags').addEventListener('click', openEventTagManager);

// ══════════════════════════════════════════════════════════════════════════════
// BEWERTUNGSBOGEN
// ══════════════════════════════════════════════════════════════════════════════

const BEW_ITEMS = ['a1','a2','a3','a4','b5','b6','b7','b8','c9','c10','d11','d12','e13','e15','e16','z17','z18','z19','z20'];

// Post-Session Prompt
document.getElementById('bew-prompt-yes').addEventListener('click', () => {
  document.getElementById('bew-prompt-overlay').classList.add('hidden');
  showScreen('bewertung');
  // Sitzung(en) vorauswählen
  if (pendingBewertungSessionIds.length) {
    if (settings.multiProband) {
      selectedBewSessionIds = pendingBewertungSessionIds.slice();
      buildBewSessionMultiList();
      updateBewertungForm();
    } else {
      const sel = document.getElementById('bew-session-select');
      sel.value = pendingBewertungSessionIds[0];
      sel.dispatchEvent(new Event('change'));
    }
  }
});
document.getElementById('bew-prompt-no').addEventListener('click', () => {
  document.getElementById('bew-prompt-overlay').classList.add('hidden');
  pendingBewertungSessionIds = [];
  setTimeout(() => showScreen('log'), 100);
});

function renderBewertungScreen() {
  buildBewertungSessionSelect();
}

function buildBewertungSessionSelect() {
  const sel = document.getElementById('bew-session-select');
  const cur = sel.value;
  const sorted = sessions.slice().reverse();
  sel.innerHTML = '<option value="">— Sitzung wählen —</option>' +
    sorted.map(s => {
      const sc = scenarios.find(x => x.id === s.scenarioId);
      const hasBew = bewertungen.some(b => b.sessionId === s.id);
      return `<option value="${esc(s.id)}">${esc(s.pseudo)} · ${sc ? esc(sc.abbr) : esc(s.scenarioAbbr || '?')} · ${esc(s.date)}${hasBew ? ' ✓' : ''}</option>`;
    }).join('');
  if (sorted.find(s => s.id === cur)) sel.value = cur;

  const multiMode = !!settings.multiProband;
  sel.classList.toggle('hidden', multiMode);
  document.getElementById('bew-session-multi-list').classList.toggle('hidden', !multiMode);
  if (multiMode) buildBewSessionMultiList();
  updateBewertungForm();
}

function buildBewSessionMultiList() {
  const list = document.getElementById('bew-session-multi-list');
  selectedBewSessionIds = selectedBewSessionIds.filter(id => sessions.some(s => s.id === id));
  const sorted = sessions.slice().reverse();
  if (!sorted.length) {
    list.innerHTML = '<div style="color:var(--text3);font-size:15px">Keine Sitzungen vorhanden</div>';
    return;
  }
  list.innerHTML = sorted.map(s => {
    const sc     = scenarios.find(x => x.id === s.scenarioId);
    const hasBew = bewertungen.some(b => b.sessionId === s.id);
    const isSel  = selectedBewSessionIds.includes(s.id);
    return `<button class="proband-multi-item${isSel ? ' selected' : ''}" data-id="${esc(s.id)}">
      <span class="pm-check">${isSel ? '✓' : ''}</span>
      <span>${esc(s.pseudo)} · ${sc ? esc(sc.abbr) : esc(s.scenarioAbbr || '?')} · ${esc(s.date)}${hasBew ? ' ✓' : ''}</span>
    </button>`;
  }).join('');
  list.querySelectorAll('.proband-multi-item').forEach(btn =>
    btn.addEventListener('click', () => {
      const id  = btn.dataset.id;
      const idx = selectedBewSessionIds.indexOf(id);
      if (idx === -1) selectedBewSessionIds.push(id); else selectedBewSessionIds.splice(idx, 1);
      buildBewSessionMultiList();
      updateBewertungForm();
    })
  );
}

function getSelectedBewSessionIds() {
  if (settings.multiProband) return selectedBewSessionIds.slice();
  const v = document.getElementById('bew-session-select').value;
  return v ? [v] : [];
}

document.getElementById('bew-session-select').addEventListener('change', updateBewertungForm);

function updateBewertungForm() {
  const sessionIds = getSelectedBewSessionIds();
  const container  = document.getElementById('bew-form-container');
  const empty      = document.getElementById('bew-empty');
  const badge      = document.getElementById('bew-session-badge');

  if (!sessionIds.length) {
    container.classList.add('hidden');
    empty.classList.remove('hidden');
    badge.classList.add('hidden');
    return;
  }

  const selSessions = sessionIds.map(id => sessions.find(x => x.id === id)).filter(Boolean);
  empty.classList.add('hidden');
  container.classList.remove('hidden');

  // Badge
  if (selSessions.length === 1) {
    const s  = selSessions[0];
    const sc = scenarios.find(x => x.id === s.scenarioId);
    badge.textContent = `✓  ${s.pseudo}  ·  ${sc ? sc.icon + ' ' + sc.abbr : s.scenarioAbbr || '?'}  ·  ${s.date}`;
  } else {
    badge.textContent = `✓  ${selSessions.length} Teilnehmende ausgewählt`;
  }
  badge.classList.remove('hidden');

  // Info-Card
  const infoCard = document.getElementById('bew-info-card');
  const hasBewAny = selSessions.some(s => bewertungen.some(b => b.sessionId === s.id));
  if (selSessions.length === 1) {
    const s  = selSessions[0];
    const sc = scenarios.find(x => x.id === s.scenarioId);
    infoCard.innerHTML = hasBewAny
      ? `<div class="bew-existing-hint">⚠ Für diese Sitzung existiert bereits eine Bewertung. Speichern überschreibt diese.</div>`
      : `<div class="bew-new-hint">Neue Bewertung für: <strong>${esc(s.pseudo)} · ${esc(sc ? sc.name : s.scenarioName || '?')}</strong></div>`;
  } else {
    const names = selSessions.map(s => esc(s.pseudo)).join(', ');
    infoCard.innerHTML =
      `<div class="bew-new-hint">Gemeinsame Bewertung für: <strong>${names}</strong></div>` +
      (hasBewAny ? `<div class="bew-existing-hint">⚠ Für mindestens eine dieser Sitzungen existiert bereits eine Bewertung. Speichern überschreibt diese.</div>` : '');
  }

  // Skalen neu rendern
  BEW_ITEMS.forEach(key => renderBewScale(key));

  // Bestehende Bewertung vorbefüllen — nur eindeutig bei genau einer ausgewählten Sitzung möglich
  const existing = selSessions.length === 1 ? bewertungen.find(b => b.sessionId === selSessions[0].id) : null;
  if (existing) {
    BEW_ITEMS.forEach(key => {
      const val = existing.scores[key];
      if (val) {
        const container2 = document.querySelector(`.bew-scale[data-item="${key}"]`);
        if (container2) {
          container2.querySelectorAll('.bew-pip-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.val === String(val));
          });
        }
      }
    });
    document.getElementById('bew-notes').value = existing.notes || '';
  } else {
    document.getElementById('bew-notes').value = '';
  }
}

const BEW_SCALE_LABELS = ['sehr gut', 'gut', 'befriedigend', 'ausreichend', 'mangelhaft', 'ungenügend'];

function renderBewScale(key) {
  const container = document.querySelector(`.bew-scale[data-item="${key}"]`);
  if (!container) return;
  container.innerHTML =
    `<span class="bew-scale-endlabel bew-scale-endlabel-left">${BEW_SCALE_LABELS[0]}</span>` +
    `<div class="bew-scale-btns">` +
    [1,2,3,4,5,6].map(n =>
      `<div class="bew-scale-btn-cell"><button class="bew-pip-btn bew-pip-${n}" data-val="${n}" aria-label="Note ${n}: ${BEW_SCALE_LABELS[n-1]}">${n}</button></div>`
    ).join('') +
    `</div>` +
    `<span class="bew-scale-endlabel bew-scale-endlabel-right">${BEW_SCALE_LABELS[5]}</span>`;
  container.querySelectorAll('.bew-pip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.bew-pip-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

function getBewScores() {
  const scores = {};
  BEW_ITEMS.forEach(key => {
    const container = document.querySelector(`.bew-scale[data-item="${key}"]`);
    const selected  = container ? container.querySelector('.bew-pip-btn.selected') : null;
    scores[key]     = selected ? parseInt(selected.dataset.val, 10) : null;
  });
  return scores;
}

document.getElementById('btn-save-bewertung').addEventListener('click', () => {
  const sessionIds = getSelectedBewSessionIds();
  if (!sessionIds.length) { showToast('⚠ Sitzung wählen'); return; }
  const scores = getBewScores();
  const filled = Object.values(scores).filter(v => v !== null).length;
  if (filled === 0) { showToast('⚠ Mindestens eine Bewertung eingeben'); return; }

  if (filled < BEW_ITEMS.length) {
    showConfirm('Nicht vollständig ausgefüllt',
      `Es sind erst ${filled} von ${BEW_ITEMS.length} Bewertungen eingetragen. Trotzdem speichern?`,
      () => saveBewertung(sessionIds, scores));
  } else {
    saveBewertung(sessionIds, scores);
  }
});

// Speichert dieselben Bewertungswerte für eine oder mehrere Sitzungen (gemeinsamer Bewertungsbogen
// bei mehreren Teilnehmenden) — analog zum Muster bei der Sitzungsaufzeichnung erhält jede Sitzung
// einen eigenständigen bewertungen-Eintrag, es gibt kein neues Gruppen-/Relations-Konzept.
function saveBewertung(sessionIds, scores) {
  const notes = document.getElementById('bew-notes').value.trim();
  let updatedCount = 0, createdCount = 0;

  sessionIds.forEach(sessionId => {
    const s  = sessions.find(x => x.id === sessionId);
    const sc = s ? scenarios.find(x => x.id === s.scenarioId) : null;
    const existingIdx = bewertungen.findIndex(b => b.sessionId === sessionId);
    const entry = {
      id:           existingIdx >= 0 ? bewertungen[existingIdx].id : uid(),
      sessionId,
      pseudo:       s  ? s.pseudo       : '?',
      sensor:       s  ? s.sensor       : '?',
      scenarioId:   s  ? s.scenarioId   : '?',
      scenarioName: sc ? sc.name        : (s ? s.scenarioName || '?' : '?'),
      scenarioAbbr: sc ? sc.abbr        : (s ? s.scenarioAbbr || '?' : '?'),
      date:         s  ? s.date         : '?',
      scores, notes,
      savedAt:      new Date().toISOString()
    };
    if (existingIdx >= 0) { bewertungen[existingIdx] = entry; updatedCount++; }
    else { bewertungen.push(entry); createdCount++; }
  });

  if (sessionIds.length > 1) {
    showToast(`✓ ${sessionIds.length} Bewertungen gespeichert`);
  } else {
    showToast(updatedCount ? '✓ Bewertung aktualisiert' : '✓ Bewertung gespeichert');
  }
  save();
  buildBewertungSessionSelect(); // Haken in Dropdown/Liste aktualisieren
  pendingBewertungSessionIds = [];
}

document.getElementById('btn-clear-bewertung').addEventListener('click', () => {
  showConfirm('Eingaben zurücksetzen',
    'Alle bisher eingetragenen Bewertungen und Anmerkungen in diesem Formular werden verworfen.',
    () => resetBewertungForm());
});

function resetBewertungForm() {
  BEW_ITEMS.forEach(key => {
    const container = document.querySelector(`.bew-scale[data-item="${key}"]`);
    if (container) container.querySelectorAll('.bew-pip-btn').forEach(b => b.classList.remove('selected'));
  });
  document.getElementById('bew-notes').value = '';
  showToast('Eingaben zurückgesetzt');
}

// ══════════════════════════════════════════════════════════════════════════════
// EREIGNISSE
// ══════════════════════════════════════════════════════════════════════════════
// Freie Ereignis-/Problemliste (z.B. "Sensorik verrutscht"), unabhängig von Sitzungen.
// Zwei Erfassungsarten: einzelner Zeitpunkt (timeISO) oder Zeitraum (startISO/endISO),
// jeweils per "Jetzt"-Button oder manueller Eingabe. Kategorisierung über eine frei
// erweiterbare Tag-Liste (eventTags), analog zum Tag-Manager der Sitzungsaufzeichnung,
// aber als eigenständige Liste (Kategorien haben andere Bedeutung als Abweichungs-Tags).

function renderEreignisse() {
  buildEventProbandSelect();
  renderEventTagRow('event-tags');
  setEventType(selectedEventType);
  renderEventList();
}

function buildEventProbandSelect() {
  const sel = document.getElementById('event-proband-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— kein Bezug —</option>' +
    probanden.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}${p.sensor ? '  ·  SNR ' + esc(p.sensor) : ''}</option>`).join('');
  if (probanden.some(p => p.id === cur)) sel.value = cur;
}

// Kategorie-Auswahl: im Unterschied zu renderTagRow() ist hier immer nur ein Tag aktiv
// (Einfachauswahl), da die Kategorie primär dem Sortieren/Filtern dient.
function renderEventTagRow(containerId, selectedTag = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = eventTags.map(tag => `
    <button type="button" class="tag${tag === selectedTag ? ' active' : ''}" data-tag="${esc(tag)}">${esc(tag)}</button>
  `).join('');
  container.querySelectorAll('.tag').forEach(btn =>
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    })
  );
}
function getActiveEventTag(containerId) {
  const active = document.querySelector(`#${containerId} .tag.active`);
  return active ? active.dataset.tag : '';
}

function setEventType(type) {
  selectedEventType = type;
  document.getElementById('event-type-timestamp').classList.toggle('selected', type === 'timestamp');
  document.getElementById('event-type-duration').classList.toggle('selected', type === 'duration');
  document.getElementById('event-timestamp-fields').classList.toggle('hidden', type !== 'timestamp');
  document.getElementById('event-duration-fields').classList.toggle('hidden', type !== 'duration');
}
document.getElementById('event-type-timestamp').addEventListener('click', () => setEventType('timestamp'));
document.getElementById('event-type-duration').addEventListener('click', () => setEventType('duration'));

document.getElementById('btn-save-event').addEventListener('click', () => {
  const probandId = document.getElementById('event-proband-select').value;
  const p     = probanden.find(x => x.id === probandId);
  const note  = document.getElementById('event-note').value.trim();
  const tag   = getActiveEventTag('event-tags');
  if (!note) { showToast('⚠ Beschreibung eingeben'); return; }
  if (!tag)  { showToast('⚠ Kategorie wählen'); return; }

  const entry = {
    id: uid(), type: selectedEventType, tag,
    probandId: probandId || '', pseudo: p ? p.pseudo : '',
    note, createdAt: new Date().toISOString()
  };
  const nowISO = new Date().toISOString();

  if (selectedEventType === 'duration') {
    const startTime = document.getElementById('event-start-time').value;
    const endTime   = document.getElementById('event-end-time').value;
    if (!startTime) { showToast('⚠ Startzeit eingeben'); return; }
    if (!endTime)   { showToast('⚠ Endzeit eingeben'); return; }
    entry.startISO = rebuildISO(nowISO, startTime);
    entry.endISO   = rebuildISO(nowISO, endTime);
    if (new Date(entry.endISO) < new Date(entry.startISO)) { showToast('⚠ Ende muss nach Start liegen'); return; }
    entry.duration_s = Math.round((new Date(entry.endISO) - new Date(entry.startISO)) / 1000);
  } else {
    const time = document.getElementById('event-time').value;
    if (!time) { showToast('⚠ Zeitpunkt eingeben'); return; }
    entry.timeISO = rebuildISO(nowISO, time);
  }

  events.push(entry);
  save();
  document.getElementById('event-note').value = '';
  document.getElementById('event-time').value = '';
  document.getElementById('event-start-time').value = '';
  document.getElementById('event-end-time').value = '';
  renderEventTagRow('event-tags');
  renderEventList();
  showToast('✓ Ereignis gespeichert');
});

function buildEventFilters() {
  const tagSel = document.getElementById('event-filter-tag');
  const prSel  = document.getElementById('event-filter-proband');
  const tagVal = tagSel.value;
  const prVal  = prSel.value;
  tagSel.innerHTML = '<option value="all">Alle Kategorien</option>' +
    eventTags.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  prSel.innerHTML = '<option value="all">Alle Teilnehmenden</option>' +
    probanden.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}</option>`).join('');
  if (eventTags.includes(tagVal)) tagSel.value = tagVal;
  if (probanden.find(p => p.id === prVal)) prSel.value = prVal;
}

function getFilteredEvents() {
  const tagVal = document.getElementById('event-filter-tag').value;
  const prVal  = document.getElementById('event-filter-proband').value;
  return events
    .filter(e => (tagVal === 'all' || e.tag === tagVal) && (prVal === 'all' || e.probandId === prVal))
    .slice().reverse();
}

function renderEventList() {
  buildEventFilters();
  const list     = document.getElementById('event-list');
  const empty    = document.getElementById('event-empty');
  const label    = document.getElementById('event-count-label');
  const filtered = getFilteredEvents();
  label.textContent = `EREIGNISSE (${filtered.length})`;
  if (!filtered.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = filtered.map(ev => {
    const timeInfo = ev.type === 'duration'
      ? localTimeStr(ev.startISO) + ' – ' + localTimeStr(ev.endISO) + '  ·  ' + formatTime(ev.duration_s || 0)
      : localTimeStr(ev.timeISO);
    const who = ev.pseudo || 'Allgemein';
    return `<button class="log-entry" data-id="${esc(ev.id)}">
      <div class="log-row-top">
        <span class="log-id">${esc(ev.tag)}  ·  ${esc(who)}</span>
        <span class="log-time">${esc(timeInfo)}</span>
      </div>
      <div class="log-meta">${esc(ev.note)}</div>
    </button>`;
  }).join('');
  list.querySelectorAll('.log-entry').forEach(el =>
    el.addEventListener('click', () => confirmDeleteEvent(el.dataset.id))
  );
}

function confirmDeleteEvent(id) {
  const ev = events.find(x => x.id === id);
  if (!ev) return;
  showConfirm('Ereignis löschen', `„${ev.note}" (${ev.tag}) löschen?`, () => {
    events = events.filter(x => x.id !== id);
    save();
    renderEventList();
    showToast('Ereignis gelöscht');
  });
}

document.getElementById('event-filter-tag').addEventListener('change', renderEventList);
document.getElementById('event-filter-proband').addEventListener('change', renderEventList);

// ── Ereignis-Kategorien-Manager ─────────────────────────────────────────────────
document.getElementById('btn-manage-event-tags').addEventListener('click', () => {
  renderEventTagManager();
  document.getElementById('event-tag-overlay').classList.remove('hidden');
});
document.getElementById('event-tag-close').addEventListener('click', () => {
  document.getElementById('event-tag-overlay').classList.add('hidden');
  renderEventTagRow('event-tags');
  buildEventFilters();
});
document.getElementById('event-tag-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('event-tag-overlay')) {
    document.getElementById('event-tag-overlay').classList.add('hidden');
    renderEventTagRow('event-tags');
    buildEventFilters();
  }
});

function renderEventTagManager() {
  const list = document.getElementById('event-tag-list-modal');
  if (!eventTags.length) {
    list.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px">Keine Kategorien</div>';
    return;
  }
  list.innerHTML = eventTags.map((tag, i) => `
    <div class="scenario-manager-item" data-idx="${i}">
      <div class="sm-info"><div class="sm-name">${esc(tag)}</div></div>
      <div class="sm-btns">
        <button class="sm-btn" data-action="edit" data-idx="${i}">✏</button>
        <button class="sm-btn del" data-action="del" data-idx="${i}">✕</button>
      </div>
    </div>
    <div class="tag-edit-row hidden" id="event-tag-edit-row-${i}">
      <input type="text" class="tag-edit-input" id="event-tag-edit-input-${i}" value="${esc(tag)}" autocorrect="off">
      <div class="btn-row" style="margin-top:6px">
        <button class="btn btn-primary flex-1" data-action="save" data-idx="${i}">✓ Speichern</button>
        <button class="btn btn-ghost" data-action="cancel-edit" data-idx="${i}">Abbrechen</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-action]').forEach(btn =>
    btn.addEventListener('click', () => {
      const idx    = parseInt(btn.dataset.idx, 10);
      const action = btn.dataset.action;
      if (action === 'del') {
        if (eventTags.length <= 1) { showToast('⚠ Mindestens 1 Kategorie'); return; }
        showConfirm('Kategorie löschen', `"${eventTags[idx]}" löschen?`, () => {
          eventTags.splice(idx, 1); save(); renderEventTagManager();
        });
      } else if (action === 'edit') {
        document.getElementById(`event-tag-edit-row-${idx}`).classList.remove('hidden');
        document.getElementById(`event-tag-edit-input-${idx}`).focus();
      } else if (action === 'cancel-edit') {
        document.getElementById(`event-tag-edit-row-${idx}`).classList.add('hidden');
      } else if (action === 'save') {
        const val = document.getElementById(`event-tag-edit-input-${idx}`).value.trim();
        if (!val) { showToast('⚠ Bezeichnung eingeben'); return; }
        if (eventTags.some((t,i) => i !== idx && t.toLowerCase() === val.toLowerCase())) { showToast('⚠ Kategorie vergeben'); return; }
        eventTags[idx] = val; save(); renderEventTagManager();
        showToast('✓ Kategorie aktualisiert');
      }
    })
  );
}

document.getElementById('btn-add-event-tag').addEventListener('click', () => {
  const val = document.getElementById('new-event-tag-label').value.trim();
  if (!val) { showToast('⚠ Bezeichnung eingeben'); return; }
  if (eventTags.some(t => t.toLowerCase() === val.toLowerCase())) { showToast('⚠ Kategorie vergeben'); return; }
  eventTags.push(val); save();
  document.getElementById('new-event-tag-label').value = '';
  renderEventTagManager();
  showToast('✓ Kategorie hinzugefügt');
});

// ══════════════════════════════════════════════════════════════════════════════
// ABLAUF (Studien-Zeitleiste)
// ══════════════════════════════════════════════════════════════════════════════
// Zeigt den festen Studienablauf (FLOW_STEPS) als Zeitleiste für genau eine:n aktive:n
// Teilnehmende:n. Jeder Schritt ist frei anwählbar (Reihenfolge egal); erfasst werden
// Start-/Endzeit (Button "Jetzt" oder manuelle Eingabe) sowie eine Anmerkung.
// Farbcodierung gibt Überblick:
//   offen      – nichts erfasst
//   teilweise  – nur Start ODER Ende ODER nur eine Anmerkung
//   komplett   – Start UND Ende erfasst
// Layout:
//   schmal (Smartphone / Tablet hochkant): einspaltig, Schritt klappt inline auf.
//   breit  (Tablet quer, ab 1024px): zweispaltig (Master-Detail) — links die Schrittliste,
//          rechts ein fest sichtbares Detailfeld für den gewählten Schritt.
let selectedAblaufProbandId = '';
let expandedFlowStepId       = 'fs_01';  // Schritt 1 ist beim Start direkt geöffnet
// Merkt sich, für welchen Schritt die Detailspalte (breites Layout) zuletzt befüllt wurde —
// nur bei einem tatsächlichen Schrittwechsel wird dort nach oben gescrollt, nicht bei jedem
// Re-Render desselben Schritts (z. B. nach Antippen einer Checkliste), siehe renderAblauf().
let lastAblaufDetailStepId  = '';
const ABLAUF_WIDE_MQ = window.matchMedia('(min-width: 1024px)');
// Beim Wechsel Hoch-/Querformat neu aufbauen, damit Inline-Panel <-> Detailspalte umschaltet.
ABLAUF_WIDE_MQ.addEventListener('change', () => {
  if (document.getElementById('screen-ablauf')?.classList.contains('active')) renderAblauf();
});

// Fragebogen-Schritte (3 / 5 / 9 / 12): einheitlich aufgebaut wie Schritt 3 — keine
// Start/Ende-Erfassung, nur die Bestätigungs-Checkbox „Fragebogen ausgefüllt" (+ Anmerkung).
// Ist sie gesetzt (p.ablauf[stepId].done = ISO-Zeitstempel), gilt der Schritt als komplett.
const FRAGEBOGEN_STEPS = new Set(['fs_03', 'fs_05', 'fs_09', 'fs_12']);

// Schritte ohne Start/Ende-Erfassung: 1 (nur Person anlegen), 2 (nur Sensorik-Checkliste),
// die Fragebogen-Schritte 3/5/9/12, 7 + 10 (Zeiten stecken in den jeweiligen Durchlauf-Phasen),
// die Trainerbewertungsbogen-Schritte 8/11 (keine eigene Zeiterfassung — die Bögen tragen ihr
// eigenes `savedAt`), 14 (nur Sensorik-Ablege-Checkliste) und der letzte Schritt (nur zwei
// Häkchen ohne Zeiterfassung, siehe datensicherungSectionHTML). Schritt 6 (Tutorial) hat seit
// v2.28.0 **wieder** normale Start/Ende-Felder (wie Schritt 4 „TMS") und steht daher bewusst
// **nicht** in dieser Liste. Hier gibt es nur Anmerkung + schrittabhängige Abschnitte.
const NO_TIME_STEPS = new Set(['fs_01', 'fs_02', 'fs_07', 'fs_10', 'fs_14', LAST_FLOW_STEP_ID, ...Object.keys(BEW_STEP_META), ...FRAGEBOGEN_STEPS]);

// Schritte mit genau EINEM erfassten Zeitpunkt statt Start+Ende (Stop Sensorik, Schritt 13 —
// hier gibt es nur den einen Zeitpunkt „Aufzeichnung beendet", kein Zeitraum).
const SINGLE_TIME_STEPS = new Set(['fs_13']);

// Abweichende Beschriftung der Zeitfelder für einzelne Schritte, wenn „Start"/„Ende" allein
// missverständlich wäre bzw. bei SINGLE_TIME_STEPS als Label für das einzelne Zeitfeld.
// Schritt 6 „Einweisung + Tutorial VR" besteht aus zwei Teilen (Einweisung + eigentliches
// VR-Tutorial) — die Felder erfassen ausdrücklich nur Start/Ende des VR-Szenario-Tutorials,
// nicht der gesamten Einweisung.
const TIME_FIELD_LABELS = {
  fs_06: {
    start: 'Start (VR-Tutorial)',
    end:   'Ende (VR-Tutorial)',
    hint:  'Start/Ende erfassen ausschließlich das VR-Szenario-Tutorial selbst — nicht die vorangehende Einweisung bzw. den gesamten Schritt.',
  },
  fs_13: {
    start: 'Zeitpunkt',
    hint:  'Hier wird nur ein Zeitpunkt erfasst (Aufzeichnung beendet) — kein Start/Ende.',
  },
};

// Eingabefelder eines Schritts (Start/Ende soweit vorhanden + „Schritt leeren"). Der frühere
// separate „Hinweis / Anmerkung"-Punkt je Schritt entfällt seit v2.30.0 (inhaltlich doppelt
// zu „Ereignisse / Probleme / Anmerkungen", siehe ereignisSectionHTML) — freie Anmerkungen
// gehören jetzt dorthin. **Kein** „Weiter"-Button — der sitzt IMMER ganz unten und wird von
// stepPanelBodyHTML() nach den Zusatzabschnitten angehängt. fs_01 hat gar keine Felder.
function flowStepFieldsHTML(d, stepId) {
  if (stepId === 'fs_01') return '';
  const noTime     = NO_TIME_STEPS.has(stepId);
  const singleTime = SINGLE_TIME_STEPS.has(stepId);
  // Schritt 6 „Einweisung + Tutorial VR" umfasst zwei Teile — Start/Ende meinen hier
  // ausdrücklich nur das VR-Szenario-Tutorial selbst, nicht die vorangehende Einweisung.
  const cfg = TIME_FIELD_LABELS[stepId];
  const startLabel = cfg ? cfg.start : 'Start';
  const endLabel   = cfg ? cfg.end   : 'Ende';
  const fieldHint  = cfg ? `<p class="meta-text" style="margin-bottom:8px">${esc(cfg.hint)}</p>` : '';
  let fragebogenToggle = '';
  if (FRAGEBOGEN_STEPS.has(stepId)) {
    const fbDone = !!d.done;
    const fbSub  = fbDone ? `bestätigt ${esc(localTimeStr(d.done))}` : 'noch nicht bestätigt';
    fragebogenToggle = `<button class="sensorik-item${fbDone ? ' checked' : ''}" id="ablauf-edit-done" style="margin-bottom:12px">
      <span class="sensorik-check">${fbDone ? '✓' : ''}</span>
      <span class="sensorik-info">
        <span class="sensorik-name">Fragebogen ausgefüllt</span>
        <span class="sensorik-time">${fbSub}</span>
      </span>
    </button>`;
  }
  // Kein Zeitfeld an diesem Schritt → nichts mehr generisch zu leeren (Checkliste/Fragebogen-
  // Häkchen/Bewertungsbogen/Datensicherung-Häkchen haben je ihre eigene Rückgängig-/Reset-
  // Funktion).
  if (noTime) return `${fragebogenToggle}`;
  // Nur EIN Zeitpunkt statt Start+Ende (Schritt 13 „Stop Sensorik") — dasselbe Eingabefeld-Id
  // „ablauf-edit-start" wie sonst der Start, damit writeFlowStep()/clearFlowStep() unverändert
  // greifen (ein fehlendes Ende-Feld wird dort bereits generisch berücksichtigt).
  if (singleTime) {
    return `${fragebogenToggle}${fieldHint}
      <div>
        <label class="field-label" for="ablauf-edit-start">${esc(startLabel)}</label>
        <div class="time-capture-row">
          <input type="time" id="ablauf-edit-start" step="1" value="${esc(isoToTimeInput(d.startISO))}">
          <button type="button" class="btn btn-ghost btn-time-now" data-target="ablauf-edit-start">🕐 Jetzt</button>
        </div>
      </div>
      <div class="btn-col" style="margin-top:10px">
        <button class="btn btn-ghost full-width" id="ablauf-edit-clear">Schritt leeren</button>
      </div>`;
  }
  return `${fragebogenToggle}${fieldHint}
    <div class="edit-row-2">
      <div>
        <label class="field-label" for="ablauf-edit-start">${esc(startLabel)}</label>
        <div class="time-capture-row">
          <input type="time" id="ablauf-edit-start" step="1" value="${esc(isoToTimeInput(d.startISO))}">
          <button type="button" class="btn btn-ghost btn-time-now" data-target="ablauf-edit-start">🕐 Jetzt</button>
        </div>
      </div>
      <div>
        <label class="field-label" for="ablauf-edit-end">${esc(endLabel)}</label>
        <div class="time-capture-row">
          <input type="time" id="ablauf-edit-end" step="1" value="${esc(isoToTimeInput(d.endISO))}">
          <button type="button" class="btn btn-ghost btn-time-now" data-target="ablauf-edit-end">🕐 Jetzt</button>
        </div>
      </div>
    </div>
    <div class="btn-col" style="margin-top:10px">
      <button class="btn btn-ghost full-width" id="ablauf-edit-clear">Schritt leeren</button>
    </div>`;
}

// Kompletter Inhalt eines geöffneten Schritts. Reihenfolge überall gleich:
//   [Sensorik-Checkliste nur fs_02/fs_14] → Felder → Zusatzabschnitte → „✓ Weiter" ganz unten.
function stepPanelBodyHTML(d, s) {
  const isLast = s.id === LAST_FLOW_STEP_ID;
  const weiterLabel = s.id === 'fs_01' ? '✓ Weiter zur Sensorik' : '✓ Weiter zum nächsten Schritt';
  const weiter = isLast ? '' : `<div class="btn-col" style="margin-top:14px">
    <button class="btn btn-primary full-width" id="ablauf-edit-next">${weiterLabel}</button>
  </div>`;

  if (s.id === 'fs_01') {
    return probandAnlegenSectionHTML() + ereignisSectionHTML('fs_01') + (ablaufProband() ? weiter : '');
  }
  let body = '';
  if (s.id === 'fs_02') body += sensorikSectionHTML();
  if (s.id === 'fs_14') body += sensorikAblegenSectionHTML();
  body += flowStepFieldsHTML(d, s.id);
  body += flowStepExtrasHTML(s.id);
  body += weiter;
  return body;
}

function flowStepState(d) {
  if (!d) return 'offen';
  const hasStart = !!d.startISO;
  const hasEnd   = !!d.endISO;
  if (hasStart && hasEnd) return 'komplett';
  if (hasStart || hasEnd) return 'teilweise';
  return 'offen';
}
// Schritt 1: erledigt, sobald eine Person aktiv ist. Schritt 2: nach Sensorik-Checkliste
// (alle Items angelegt = komplett), sonst Standard-Logik über Start/Ende.
function flowStepStateFor(stepId, d) {
  if (stepId === 'fs_01') return ablaufProband() ? 'komplett' : 'offen';
  if (stepId === 'fs_02') {
    const p = ablaufProband();
    const done = (p && p.sensorik) ? SENSORIK_ITEMS.filter(it => p.sensorik[it.id]).length : 0;
    if (done === SENSORIK_ITEMS.length) return 'komplett';
    if (done > 0) return 'teilweise';
    return 'offen';
  }
  if (stepId === 'fs_07') {
    const p = ablaufProband();
    const runs = (p && p.szenarien && Array.isArray(p.szenarien.fs_07)) ? p.szenarien.fs_07 : [];
    const full    = runs.filter(r => r.phases && r.phases.p_start && r.phases.p_end).length;
    const started = runs.filter(r => r.phases && (r.phases.p_start || r.phases.p_end)).length;
    if (full === hologateLabels.length) return 'komplett';
    if (started > 0) return 'teilweise';
    return 'offen';
  }
  if (stepId === 'fs_10') {
    const p = ablaufProband();
    const run = (p && p.szenarien && Array.isArray(p.szenarien.fs_10)) ? p.szenarien.fs_10[0] : null;
    const ph  = (run && run.phases) || {};
    if (ph.p_start && ph.p_end) return 'komplett';
    if (Object.keys(ph).length > 0) return 'teilweise';
    return 'offen';
  }
  if (stepId === 'fs_14') {
    const p = ablaufProband();
    const done = (p && p.sensorikAblegen) ? SENSORIK_ITEMS.filter(it => p.sensorikAblegen[it.id]).length : 0;
    if (done === SENSORIK_ITEMS.length) return 'komplett';
    if (done > 0) return 'teilweise';
    return 'offen';
  }
  if (BEW_STEP_META[stepId]) {
    const p = ablaufProband();
    const b = (p && p.bewertungen && Array.isArray(p.bewertungen[stepId])) ? p.bewertungen[stepId][0] : null;
    const filled = (b && b.scores) ? BEW_OV_ITEMS.filter(k => b.scores[k] != null).length : 0;
    if (filled === BEW_OV_ITEMS.length) return 'komplett';
    if (filled > 0) return 'teilweise';
    return 'offen';
  }
  if (FRAGEBOGEN_STEPS.has(stepId) && d && d.done) return 'komplett';
  if (SINGLE_TIME_STEPS.has(stepId)) return (d && d.startISO) ? 'komplett' : 'offen';
  if (stepId === LAST_FLOW_STEP_ID) {
    const secured = !!(d && d.dataSecured);
    const disinfected = !!(d && d.disinfected);
    if (secured && disinfected) return 'komplett';
    if (secured || disinfected) return 'teilweise';
    return 'offen';
  }
  return flowStepState(d);
}

function ablaufProband() {
  return probanden.find(p => p.id === selectedAblaufProbandId) || null;
}

function buildAblaufProbandSelect() {
  const sel = document.getElementById('ablauf-proband-select');
  if (!sel) return;
  if (!probanden.some(p => p.id === selectedAblaufProbandId)) {
    selectedAblaufProbandId = probanden.length ? probanden[probanden.length - 1].id : '';
  }
  sel.innerHTML = probanden.length
    ? probanden.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}${p.handedness ? '  ·  ' + esc(p.handedness) : ''}</option>`).join('')
    : '<option value="">— keine Teilnehmenden —</option>';
  sel.value = selectedAblaufProbandId;
  sel.disabled = !probanden.length;
}

function renderAblauf() {
  const timeline = document.getElementById('ablauf-timeline');
  const layout   = document.getElementById('ablauf-layout');
  const detail   = document.getElementById('ablauf-detail');
  const empty    = document.getElementById('ablauf-empty');
  const progress = document.getElementById('ablauf-progress');
  if (!timeline) return;
  buildAblaufProbandSelect();
  const p   = ablaufProband();
  const abl = (p && p.ablauf) ? p.ablauf : {};
  if (p && !p.ablauf) p.ablauf = abl;
  // Ohne Person ist trotzdem der Ablauf sichtbar und Schritt 1 offen — dort wird die Person
  // angelegt. Nur die restlichen Schritte sind bis dahin nicht sinnvoll bedienbar.
  if (!p && !expandedFlowStepId) expandedFlowStepId = 'fs_01';
  empty.classList.add('hidden');
  if (layout) layout.classList.remove('hidden');
  const wide = ABLAUF_WIDE_MQ.matches;

  const c = ablaufCounts(p);
  progress.innerHTML =
    `<div class="ablauf-progress-bar"><span style="width:${c.pct}%"></span></div>` +
    `<div class="ablauf-progress-text">${c.komplett} / ${FLOW_STEPS.length} komplett` +
    `${c.teilweise ? '  ·  ' + c.teilweise + ' angefangen' : ''}</div>`;

  timeline.innerHTML = FLOW_STEPS.map(s => {
    const d       = abl[s.id] || {};
    const state   = flowStepStateFor(s.id, d);
    const isOpen  = expandedFlowStepId === s.id;
    const startTxt = d.startISO ? localTimeStr(d.startISO) : '–';
    const endTxt   = d.endISO   ? localTimeStr(d.endISO)   : '–';
    let summary   = (d.startISO || d.endISO) ? `${startTxt} → ${endTxt}` : 'noch nicht erfasst';
    if (s.id === 'fs_01') summary = p ? 'Teilnehmende:r angelegt' : 'Teilnehmende:n anlegen';
    if (s.id === 'fs_02') {
      const sDone = (p && p.sensorik) ? SENSORIK_ITEMS.filter(it => p.sensorik[it.id]).length : 0;
      summary = sDone ? `Sensorik ${sDone}/${SENSORIK_ITEMS.length}` : 'noch nicht erfasst';
    }
    if (s.id === 'fs_07') {
      const runs = (p && p.szenarien && Array.isArray(p.szenarien.fs_07)) ? p.szenarien.fs_07 : [];
      const rDone = runs.filter(r => r.phases && r.phases.p_start && r.phases.p_end).length;
      summary = rDone ? `Durchläufe ${rDone}/${hologateLabels.length}` : 'noch nicht erfasst';
    }
    if (s.id === 'fs_10') {
      const run = (p && p.szenarien && Array.isArray(p.szenarien.fs_10)) ? p.szenarien.fs_10[0] : null;
      const ph  = (run && run.phases) || {};
      summary = (ph.p_start || ph.p_end)
        ? `${ph.p_start ? localTimeStr(ph.p_start) : '–'} → ${ph.p_end ? localTimeStr(ph.p_end) : '–'}`
        : 'noch nicht erfasst';
    }
    if (s.id === 'fs_14') {
      const sDone = (p && p.sensorikAblegen) ? SENSORIK_ITEMS.filter(it => p.sensorikAblegen[it.id]).length : 0;
      summary = sDone ? `Sensorik ${sDone}/${SENSORIK_ITEMS.length}` : 'noch nicht erfasst';
    }
    if (BEW_STEP_META[s.id]) {
      const b = (p && p.bewertungen && Array.isArray(p.bewertungen[s.id])) ? p.bewertungen[s.id][0] : null;
      const filled = (b && b.scores) ? BEW_OV_ITEMS.filter(k => b.scores[k] != null).length : 0;
      summary = filled ? `${filled}/${BEW_OV_ITEMS.length} bewertet` : 'noch nicht erfasst';
    }
    if (FRAGEBOGEN_STEPS.has(s.id) && d.done) summary = 'Fragebogen ausgefüllt';
    if (SINGLE_TIME_STEPS.has(s.id)) summary = d.startISO ? `erfasst ${startTxt}` : 'noch nicht erfasst';
    if (s.id === LAST_FLOW_STEP_ID) {
      const secured = !!d.dataSecured, disinfected = !!d.disinfected;
      summary = (secured && disinfected) ? 'gesichert & desinfiziert'
        : (secured || disinfected) ? 'teilweise abgehakt' : 'noch nicht erfasst';
    }
    return `
    <div class="ablauf-step-wrap">
      <button class="ablauf-step${isOpen ? ' selected' : ''}" data-state="${state}" data-id="${esc(s.id)}" aria-expanded="${isOpen}">
        <span class="ablauf-step-nr">${s.nr ? esc(s.nr) : '•'}</span>
        <span class="ablauf-step-body">
          <span class="ablauf-step-label">${esc(s.label)}</span>
          <span class="ablauf-step-sub">${esc(s.tag)}  ·  ${esc(summary)}</span>
        </span>
        <span class="ablauf-step-chevron">${isOpen ? '▾' : '▸'}</span>
      </button>
      ${(!wide && isOpen) ? `<div class="ablauf-step-panel">${stepPanelBodyHTML(d, s)}</div>` : ''}
    </div>`;
  }).join('');

  // Detailspalte (nur im Querformat / breiten Layout sichtbar)
  if (detail) {
    if (wide && expandedFlowStepId) {
      const s = FLOW_STEPS.find(x => x.id === expandedFlowStepId);
      const d = (s && abl[s.id]) || {};
      detail.innerHTML = s
        ? `<div class="ablauf-detail-head">${s.nr ? 'Schritt ' + esc(s.nr) + ' · ' : ''}${esc(s.label)}</div>` +
          stepPanelBodyHTML(d, s)
        : '';
      // Nur bei echtem Schrittwechsel nach oben scrollen — ein Re-Render desselben Schritts
      // (z. B. nach Antippen einer Checkliste) soll die aktuelle Scroll-Position nicht stören.
      if (expandedFlowStepId !== lastAblaufDetailStepId) {
        detail.scrollTop = 0;
        lastAblaufDetailStepId = expandedFlowStepId;
      }
    } else if (wide) {
      detail.innerHTML = '<div class="ablauf-detail-empty">Einen Schritt links auswählen, um Start-/Endzeit und eine Anmerkung zu erfassen.</div>';
      lastAblaufDetailStepId = '';
    } else {
      detail.innerHTML = '';
    }
  }

  timeline.querySelectorAll('.ablauf-step').forEach(btn =>
    btn.addEventListener('click', () => {
      // offenen Schritt zuerst sichern, falls der Feld-„change" noch nicht gefeuert hat
      if (expandedFlowStepId && document.getElementById('ablauf-edit-start')) {
        writeFlowStep(expandedFlowStepId);
      }
      expandedFlowStepId = (expandedFlowStepId === btn.dataset.id) ? '' : btn.dataset.id;
      renderAblauf();
    })
  );
  // Feld-Eingaben speichern OHNE die Zeitleiste komplett neu zu bauen (sonst „frisst" das
  // Re-Render den Klick auf die Kopfzeile beim Zuklappen). Stattdessen nur die betroffene
  // Zeile + Fortschritt aktualisieren; das offene Panel bleibt im DOM erhalten. Die Felder
  // liegen je nach Layout im Inline-Panel (schmal) ODER in der Detailspalte (breit).
  const fieldScope = wide && detail ? detail : timeline;
  fieldScope.querySelectorAll('.btn-time-now').forEach(btn =>
    btn.addEventListener('click', () => {
      const t = document.getElementById(btn.dataset.target);
      if (!t) return;
      t.value = isoToTimeInput(new Date().toISOString());
      writeFlowStep(expandedFlowStepId);
      syncAblaufRows();
    })
  );
  ['ablauf-edit-start','ablauf-edit-end'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { writeFlowStep(expandedFlowStepId); syncAblaufRows(); });
  });
  const clearBtn = document.getElementById('ablauf-edit-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => clearFlowStep(expandedFlowStepId));
  const doneBtn = document.getElementById('ablauf-edit-done');
  if (doneBtn) doneBtn.addEventListener('click', () => toggleFragebogenDone(expandedFlowStepId));
  const nextBtn = document.getElementById('ablauf-edit-next');
  if (nextBtn) nextBtn.addEventListener('click', advanceFlowStep);
  const expBtn = document.getElementById('ablauf-open-export');
  if (expBtn) expBtn.addEventListener('click', () => showScreen('export'));

  // Trainerbewertungsbogen-Buttons (nur an fs_08 / fs_11)
  const extrasScope = wide && detail ? detail : timeline;
  extrasScope.querySelectorAll('[data-proband-add]').forEach(btn =>
    btn.addEventListener('click', openProbandAddOverlay)
  );
  // Trainerbewertungsbogen — inline (fs_08 / fs_11), kein Overlay mehr
  extrasScope.querySelectorAll('.bew-pip-btn').forEach(btn => {
    const scaleEl = btn.closest('[data-bew-scale]');
    if (!scaleEl) return;
    btn.addEventListener('click', () => setBewInlineScore(scaleEl.dataset.szStep, scaleEl.dataset.bewScale, parseInt(btn.dataset.val, 10)));
  });
  extrasScope.querySelectorAll('.bew-inline-notes').forEach(el =>
    el.addEventListener('change', () => { writeBewInlineNotes(el.dataset.szStep); syncAblaufRows(); })
  );
  extrasScope.querySelectorAll('[data-bew-reset]').forEach(btn =>
    btn.addEventListener('click', () => resetBewInline(btn.dataset.bewReset))
  );
  // Sensorik-Checkliste (nur an fs_02)
  extrasScope.querySelectorAll('[data-sensorik-toggle]').forEach(btn =>
    btn.addEventListener('click', () => toggleAblaufSensorik(btn.dataset.sensorikToggle))
  );
  const sensResetBtn = document.getElementById('ablauf-sensorik-reset');
  if (sensResetBtn) sensResetBtn.addEventListener('click', resetAblaufSensorik);
  // Sensorik-Checkliste Ablegen (nur an fs_14)
  extrasScope.querySelectorAll('[data-sensorik-ablegen-toggle]').forEach(btn =>
    btn.addEventListener('click', () => toggleAblaufSensorikAblegen(btn.dataset.sensorikAblegenToggle))
  );
  const sensAblegenResetBtn = document.getElementById('ablauf-sensorik-ablegen-reset');
  if (sensAblegenResetBtn) sensAblegenResetBtn.addEventListener('click', resetAblaufSensorikAblegen);
  // Datensicherung & Desinfektion / „Nächsten Durchlauf starten" (nur am letzten Schritt)
  extrasScope.querySelectorAll('[data-datensicherung-toggle]').forEach(btn =>
    btn.addEventListener('click', () => toggleDatensicherung(btn.dataset.datensicherungToggle))
  );
  const nextDurchlaufBtn = document.getElementById('ablauf-next-durchlauf');
  if (nextDurchlaufBtn) nextDurchlaufBtn.addEventListener('click', startNextDurchlauf);
  // Ereignis-Buttons (jeder Schritt)
  extrasScope.querySelectorAll('[data-ev-add]').forEach(btn =>
    btn.addEventListener('click', () => openEreignisOverlay(btn.dataset.evAdd, null))
  );
  extrasScope.querySelectorAll('[data-ev-edit]').forEach(btn =>
    btn.addEventListener('click', () => openEreignisOverlay(expandedFlowStepId, btn.dataset.evEdit))
  );
  // VR-Szenario-Phasen — Inline-Darstellung (fs_07 Hologate / fs_10 Rollercoaster)
  extrasScope.querySelectorAll('[data-sz-phase-inline]').forEach(btn =>
    btn.addEventListener('click', () => toggleRunPhase(btn.dataset.szStep, btn.dataset.szRun, btn.dataset.szPhaseInline))
  );
  extrasScope.querySelectorAll('.ablauf-sz-time-input').forEach(inp =>
    inp.addEventListener('change', () => { writeSzRunTime(inp.dataset.szStep, inp.dataset.szRun, inp.dataset.szTimePhase); syncAblaufRows(); })
  );
  extrasScope.querySelectorAll('.btn-sz-time-now').forEach(btn =>
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.target);
      if (!inp) return;
      inp.value = isoToTimeInput(new Date().toISOString());
      writeSzRunTime(inp.dataset.szStep, inp.dataset.szRun, inp.dataset.szTimePhase);
      syncAblaufRows();
    })
  );

  // gewählten Schritt in der linken Leiste sichtbar scrollen
  if (expandedFlowStepId) {
    const selRow = timeline.querySelector('.ablauf-step.selected');
    if (selRow) selRow.scrollIntoView({ block: 'nearest' });
  }
}

// Zusatzinhalte zwischen den Feldern und dem „Weiter"-Button. (fs_01 „Person anlegen" und
// fs_02 „Sensorik-Checkliste" werden direkt in stepPanelBodyHTML() platziert.)
function flowStepExtrasHTML(stepId) {
  let html = '';
  if (stepId === 'fs_06')             html += tutorialReminderSectionHTML();
  if (SZENARIO_FIXED_STEPS.has(stepId)) html += szenarioSectionHTML(stepId);
  if (BEW_STEP_META[stepId])          html += bewSectionHTML(stepId);
  if (!BEW_STEP_META[stepId])         html += ereignisSectionHTML(stepId);   // Ereignis-Erfassung an jedem Schritt außer den Bewertungsbogen-Schritten
  if (stepId === LAST_FLOW_STEP_ID) {
    html += datensicherungSectionHTML();
    html += `<div class="btn-col" style="margin-top:12px">
      <button class="btn btn-ghost full-width" id="ablauf-open-export">⬇ Daten exportieren (CSV / JSON)</button>
    </div>`;
  }
  return html;
}

// Abschnitt „Ereignisse / Probleme / Anmerkungen" im Detailbereich jedes Schritts (deckt
// seit v2.30.0 auch freie Anmerkungen ab — der frühere separate Anmerkung-Punkt je Schritt
// entfällt, da inhaltlich doppelt).
function ereignisSectionHTML(stepId) {
  const p = ablaufProband();
  if (!p) return '';
  const list = (p.ereignisse || []).filter(e => e.stepId === stepId);
  const rows = list.map(e => {
    const t = e.type === 'duration'
      ? localTimeStr(e.startISO) + ' – ' + localTimeStr(e.endISO)
      : localTimeStr(e.timeISO);
    return `<button class="bew-list-item" data-ev-edit="${esc(e.id)}">
      <span class="bew-list-label">${esc(e.tag)} · ${esc(e.note)}</span>
      <span class="bew-list-meta">${esc(t)}</span>
    </button>`;
  }).join('');
  return `<div class="bew-section">
    <div class="card-label" style="margin-bottom:6px">EREIGNISSE / PROBLEME / ANMERKUNGEN</div>
    <div class="bew-list">${rows || '<div class="meta-text">Noch nichts erfasst.</div>'}</div>
    <button class="btn btn-ghost full-width" data-ev-add="${esc(stepId)}" style="margin-top:8px">＋ Ereignis erfassen</button>
  </div>`;
}

// Abschnitt „Sensorik-Checkliste" im Detailbereich von Schritt 2 (Anlegen Sensorik).
// Pro Hardware-Item wird der Anlege-Zeitpunkt in p.sensorik[itemId] (ISO) festgehalten.
// Abschnitt „Teilnehmende:n anlegen" im Detailbereich von Schritt 1 (Aufklärung + Einverständnis).
function probandAnlegenSectionHTML() {
  const p = ablaufProband();
  const hint = p
    ? `Aktuell gewählt: <strong>${esc(p.pseudo)}</strong>. Neue Person anlegen, sobald die Einverständniserklärung unterschrieben ist.`
    : 'Sobald die Einverständniserklärung unterschrieben ist, hier die Person als Teilnehmende:n anlegen.';
  return `<div class="bew-section">
    <div class="card-label" style="margin-bottom:6px">TEILNEHMENDE:N ANLEGEN</div>
    <p class="meta-text" style="margin-bottom:8px">${hint}</p>
    <button class="btn btn-primary full-width" data-proband-add="1">＋ Teilnehmende:n anlegen</button>
  </div>`;
}

function sensorikSectionHTML() {
  const p = ablaufProband();
  if (!p) return '';
  if (!p.sensorik) p.sensorik = {};
  const anyDone = SENSORIK_ITEMS.some(it => p.sensorik[it.id]);
  const items = SENSORIK_ITEMS.map(item => {
    const at   = p.sensorik[item.id] || null;
    const done = !!at;
    return `<button class="sensorik-item${done ? ' checked' : ''}" data-sensorik-toggle="${esc(item.id)}">
      <span class="sensorik-check">${done ? '✓' : ''}</span>
      <span class="sensorik-info">
        <span class="sensorik-name">${esc(item.label)}</span>
        <span class="sensorik-time">${done ? esc(localDatetimeStr(at)) : 'noch nicht angelegt'}</span>
      </span>
    </button>`;
  }).join('');
  return `<div class="bew-section">
    <div class="card-label" style="margin-bottom:6px">SENSORIK-CHECKLISTE</div>
    <p class="meta-text" style="margin-bottom:8px">Auf ein Item tippen, sobald die Sensorik bei dieser Person angelegt wurde — der Zeitpunkt wird automatisch erfasst. Erneutes Tippen macht die Erfassung rückgängig.</p>
    <div class="sensorik-list">${items}</div>
    ${anyDone ? '<button class="btn btn-ghost full-width" id="ablauf-sensorik-reset" style="margin-top:8px">↺ Checkliste zurücksetzen</button>' : ''}
  </div>`;
}

function toggleAblaufSensorik(id) {
  const p = ablaufProband();
  if (!p) return;
  if (!p.sensorik) p.sensorik = {};
  const item = SENSORIK_ITEMS.find(x => x.id === id);
  if (!item) return;
  if (p.sensorik[id]) {
    showConfirm('Erfassung rückgängig machen',
      `„${item.label}" wurde für ${p.pseudo} um ${localTimeStr(p.sensorik[id])} als angelegt erfasst. Erfassung wirklich entfernen?`,
      () => { delete p.sensorik[id]; save(); renderAblauf(); showToast('Erfassung entfernt'); });
  } else {
    p.sensorik[id] = new Date().toISOString();
    save();
    renderAblauf();
    showToast('✓ ' + item.label + '  ·  ' + localTimeStr(p.sensorik[id]));
  }
}

function resetAblaufSensorik() {
  const p = ablaufProband();
  if (!p || !p.sensorik || !Object.keys(p.sensorik).length) return;
  showConfirm('Checkliste zurücksetzen',
    `Alle erfassten Sensorik-Zeitpunkte für „${p.pseudo}" werden entfernt.`,
    () => { p.sensorik = {}; save(); renderAblauf(); showToast('Checkliste zurückgesetzt'); });
}

// Abschnitt „Sensorik-Checkliste (Ablegen)" im Detailbereich von Schritt 14 (Sensorik
// ablegen) — dieselbe Item-Liste wie beim Anlegen (Schritt 2), aber eigener Datenspeicher
// p.sensorikAblegen[itemId] (ISO), damit Anlege- und Ablege-Zeitpunkt unabhängig erfasst sind.
function sensorikAblegenSectionHTML() {
  const p = ablaufProband();
  if (!p) return '';
  if (!p.sensorikAblegen) p.sensorikAblegen = {};
  const anyDone = SENSORIK_ITEMS.some(it => p.sensorikAblegen[it.id]);
  const items = SENSORIK_ITEMS.map(item => {
    const at   = p.sensorikAblegen[item.id] || null;
    const done = !!at;
    return `<button class="sensorik-item${done ? ' checked' : ''}" data-sensorik-ablegen-toggle="${esc(item.id)}">
      <span class="sensorik-check">${done ? '✓' : ''}</span>
      <span class="sensorik-info">
        <span class="sensorik-name">${esc(item.label)}</span>
        <span class="sensorik-time">${done ? esc(localDatetimeStr(at)) : 'noch nicht abgelegt'}</span>
      </span>
    </button>`;
  }).join('');
  return `<div class="bew-section">
    <div class="card-label" style="margin-bottom:6px">SENSORIK-CHECKLISTE (ABLEGEN)</div>
    <p class="meta-text" style="margin-bottom:8px">Auf ein Item tippen, sobald die Sensorik bei dieser Person abgelegt wurde — der Zeitpunkt wird automatisch erfasst. Erneutes Tippen macht die Erfassung rückgängig.</p>
    <div class="sensorik-list">${items}</div>
    ${anyDone ? '<button class="btn btn-ghost full-width" id="ablauf-sensorik-ablegen-reset" style="margin-top:8px">↺ Checkliste zurücksetzen</button>' : ''}
  </div>`;
}

function toggleAblaufSensorikAblegen(id) {
  const p = ablaufProband();
  if (!p) return;
  if (!p.sensorikAblegen) p.sensorikAblegen = {};
  const item = SENSORIK_ITEMS.find(x => x.id === id);
  if (!item) return;
  if (p.sensorikAblegen[id]) {
    showConfirm('Erfassung rückgängig machen',
      `„${item.label}" wurde für ${p.pseudo} um ${localTimeStr(p.sensorikAblegen[id])} als abgelegt erfasst. Erfassung wirklich entfernen?`,
      () => { delete p.sensorikAblegen[id]; save(); renderAblauf(); showToast('Erfassung entfernt'); });
  } else {
    p.sensorikAblegen[id] = new Date().toISOString();
    save();
    renderAblauf();
    showToast('✓ ' + item.label + '  ·  ' + localTimeStr(p.sensorikAblegen[id]));
  }
}

function resetAblaufSensorikAblegen() {
  const p = ablaufProband();
  if (!p || !p.sensorikAblegen || !Object.keys(p.sensorikAblegen).length) return;
  showConfirm('Checkliste zurücksetzen',
    `Alle erfassten Ablege-Zeitpunkte für „${p.pseudo}" werden entfernt.`,
    () => { p.sensorikAblegen = {}; save(); renderAblauf(); showToast('Checkliste zurückgesetzt'); });
}

// Abschnitt „Datensicherung & Desinfektion" am letzten Ablauf-Schritt: zwei reine Häkchen
// OHNE Zeiterfassung (bewusst kein Timestamp) — „alle Daten gesichert" (LSL, App, Sensorik,
// Varjo Base) und „alles desinfiziert/aufbereitet". Sind beide gesetzt, kann direkt der
// nächste Durchlauf (nächste:r Teilnehmende:r) gestartet werden.
function datensicherungSectionHTML() {
  const p = ablaufProband();
  if (!p) return '';
  if (!p.ablauf) p.ablauf = {};
  const d = p.ablauf[LAST_FLOW_STEP_ID] || {};
  const secured     = !!d.dataSecured;
  const disinfected = !!d.disinfected;
  return `<div class="bew-section">
    <div class="card-label" style="margin-bottom:6px">DATENSICHERUNG &amp; DESINFEKTION</div>
    <div class="sensorik-list">
      <button class="sensorik-item${secured ? ' checked' : ''}" data-datensicherung-toggle="dataSecured">
        <span class="sensorik-check">${secured ? '✓' : ''}</span>
        <span class="sensorik-info">
          <span class="sensorik-name">Alle Daten gesichert</span>
          <span class="sensorik-time">LSL, App, Sensorik, Varjo Base</span>
        </span>
      </button>
      <button class="sensorik-item${disinfected ? ' checked' : ''}" data-datensicherung-toggle="disinfected">
        <span class="sensorik-check">${disinfected ? '✓' : ''}</span>
        <span class="sensorik-info">
          <span class="sensorik-name">Alles desinfiziert / aufbereitet</span>
        </span>
      </button>
    </div>
    ${secured && disinfected ? '<button class="btn btn-primary full-width" id="ablauf-next-durchlauf" style="margin-top:12px">↻ Nächsten Durchlauf starten</button>' : ''}
  </div>`;
}

function toggleDatensicherung(field) {
  const p = ablaufProband();
  if (!p || (field !== 'dataSecured' && field !== 'disinfected')) return;
  if (!p.ablauf) p.ablauf = {};
  const prev = p.ablauf[LAST_FLOW_STEP_ID] || {};
  prev[field] = !prev[field];
  p.ablauf[LAST_FLOW_STEP_ID] = prev;
  save();
  renderAblauf();
}

// „Nächsten Durchlauf starten": öffnet Schritt 1 wieder, damit dort eine neue Person als
// Teilnehmende:r angelegt werden kann — der bisherige Durchlauf bleibt vollständig erhalten.
function startNextDurchlauf() {
  expandedFlowStepId = 'fs_01';
  renderAblauf();
  showToast('Bereit für den nächsten Durchlauf');
}

// Trainerbewertungsbogen als eigener Ablauf-Schritt (fs_08 Hologate / fs_11 Rollercoaster —
// strukturell identisch, nur Hinweistext/Bezeichnung unterscheiden sich). Seit v2.29.0 direkt
// im Schritt dargestellt und ausfüllbar (kein „anlegen"-Button/Overlay mehr): genau ein Bogen
// pro Schritt, jede Antwort speichert sofort beim Antippen.
function ensureSingleBewertung(p, stepId) {
  if (!p.bewertungen || typeof p.bewertungen !== 'object' || Array.isArray(p.bewertungen)) p.bewertungen = {};
  if (!Array.isArray(p.bewertungen[stepId])) p.bewertungen[stepId] = [];
  if (!p.bewertungen[stepId].length) {
    const meta = BEW_STEP_META[stepId];
    p.bewertungen[stepId].push({ id: uid(), label: meta ? meta.defaultLabel : '', scores: {}, notes: '', savedAt: null });
  }
  return p.bewertungen[stepId][0];
}

function bewScalePipsHTML(val) {
  return `<span class="bew-scale-endlabel bew-scale-endlabel-left">${BEW_SCALE_LABELS[0]}</span>` +
    `<div class="bew-scale-btns">` +
    [1,2,3,4,5,6].map(n =>
      `<div class="bew-scale-btn-cell"><button type="button" class="bew-pip-btn bew-pip-${n}${val === n ? ' selected' : ''}" data-val="${n}" aria-label="Note ${n}: ${BEW_SCALE_LABELS[n-1]}">${n}</button></div>`
    ).join('') +
    `</div>` +
    `<span class="bew-scale-endlabel bew-scale-endlabel-right">${BEW_SCALE_LABELS[5]}</span>`;
}

function bewSectionHTML(stepId) {
  const p = ablaufProband();
  if (!p) return '';
  const meta = BEW_STEP_META[stepId];
  const b    = ensureSingleBewertung(p, stepId);
  const legend =
    `<div class="bew-legend card"><div class="card-label" style="margin-bottom:8px">SKALA</div><div class="bew-legend-row">` +
    BEW_SCALE_LABELS.map((lab, i) => `<span class="bew-legend-item"><span class="bew-pip bew-pip-${i+1}">${i+1}</span> ${esc(lab)}</span>`).join('') +
    `</div></div>`;
  const items = BEW_OV_QUESTIONS.map(([key, text]) => `
    <div class="bew-item">
      <span class="bew-item-label">${esc(text)}</span>
      <div class="bew-scale-wrap"><div class="bew-scale" data-bew-scale="${esc(key)}" data-sz-step="${esc(stepId)}">${bewScalePipsHTML(b.scores ? b.scores[key] : null)}</div></div>
    </div>`).join('');
  return `<div class="bew-section">
    <div class="card-label" style="margin-bottom:6px">TRAINERBEWERTUNGSBOGEN · ${esc(meta.scenarioLabel)}</div>
    <p class="meta-text" style="margin-bottom:8px">${esc(meta.hint)}</p>
    ${legend}
    <div class="card">
      <div class="card-label bew-dim-label">${esc(BEW_OV_TITLE)}</div>
      <p class="privacy-text" style="color:var(--text2);line-height:1.5;margin:0 0 12px">${esc(BEW_OV_INTRO)}</p>
      <div class="bew-items">${items}</div>
      <label class="field-label" for="bew-inline-notes-${esc(stepId)}" style="margin-top:12px;display:block">Anmerkungen</label>
      <textarea id="bew-inline-notes-${esc(stepId)}" class="bew-inline-notes" data-sz-step="${esc(stepId)}" rows="2" placeholder="Ergänzende Beobachtungen…" autocorrect="off">${esc(b.notes || '')}</textarea>
    </div>
    <div class="btn-col" style="margin-top:12px">
      <button class="btn btn-ghost full-width" data-bew-reset="${esc(stepId)}">Bewertung zurücksetzen</button>
    </div>
  </div>`;
}

function setBewInlineScore(stepId, key, val) {
  const p = ablaufProband();
  if (!p) return;
  const b = ensureSingleBewertung(p, stepId);
  if (!b.scores) b.scores = {};
  b.scores[key] = val;
  b.savedAt = new Date().toISOString();
  save();
  renderAblauf();
}

function writeBewInlineNotes(stepId) {
  const p = ablaufProband();
  if (!p) return;
  const b = ensureSingleBewertung(p, stepId);
  const el = document.getElementById(`bew-inline-notes-${stepId}`);
  b.notes = el ? el.value.trim() : '';
  save();
}

function resetBewInline(stepId) {
  const p = ablaufProband();
  if (!p) return;
  const meta = BEW_STEP_META[stepId];
  showConfirm('Bewertung zurücksetzen', `Alle Antworten für „${meta.scenarioLabel}" werden entfernt.`, () => {
    if (!p.bewertungen) p.bewertungen = {};
    p.bewertungen[stepId] = [{ id: uid(), label: meta.defaultLabel, scores: {}, notes: '', savedAt: null }];
    save();
    renderAblauf();
    showToast('Bewertung zurückgesetzt');
  });
}

// Abschnitt „VR-Szenario-Durchlauf" im Detailbereich von fs_07 (Hologate) / fs_10
// (Rollercoaster). Beide sind seit v2.32.0 feste Durchläufe direkt im Schritt-Panel, ohne
// Hinzufügen/Löschen/Umbenennen — Hologate mit 5 festen Durchläufen (eigener Name je Position,
// Bezeichnungen in den Einstellungen editierbar), Rollercoaster mit genau einem.
function szenarioSectionHTML(stepId) {
  const p = ablaufProband();
  if (!p) return '';
  const isHologate = stepId === 'fs_07';
  const runs   = isHologate ? ensureHologateRuns(p) : ensureRollercoasterRun(p);
  const phases = szPhasesFor(stepId);
  const runsHTML = isHologate
    ? runs.map((run, i) => `<div class="ablauf-sz-run">
        <div class="ablauf-sz-runname">${i + 1}. ${esc(run.label)}</div>
        ${szRunPhasesHTML(stepId, run, phases)}
      </div>`).join('')
    : `<div class="ablauf-sz-run">${szRunPhasesHTML(stepId, runs[0], phases)}</div>`;
  const title = isHologate ? 'HOLOGATE' : 'ROLLERCOASTER';
  const hint  = isHologate
    ? 'Feste Reihenfolge — Start/Ende je über Button „Jetzt" oder manuelle Eingabe erfassen.'
    : 'Start/Ende erfassen ausschließlich den VR-Szenario-Durchlauf selbst — über Button „Jetzt" oder manuelle Eingabe, die übrigen Phasen abhaken.';
  return `<div class="bew-section">
    <div class="card-label" style="margin-bottom:6px">VR-SZENARIO-DURCHLAUF · ${esc(title)}</div>
    <p class="meta-text" style="margin-bottom:8px">${esc(hint)}</p>
    ${runsHTML}
  </div>`;
}

// Gemeinsame Normalisierung für die festen Szenario-Durchläufe: baut p.szenarien[stepId]
// anhand einer festen Bezeichnungsliste (Länge = Anzahl Durchläufe) mit stabilen IDs neu auf,
// erhält dabei vorhandene `phases` je Position. Reine In-Memory-Normalisierung — persistiert
// wird beim nächsten save().
function ensureFixedSzenarioRuns(p, stepId, labels, idPrefix) {
  if (!p.szenarien || typeof p.szenarien !== 'object' || Array.isArray(p.szenarien)) p.szenarien = {};
  const cur = Array.isArray(p.szenarien[stepId]) ? p.szenarien[stepId] : [];
  p.szenarien[stepId] = labels.map((label, i) => {
    const prev = cur.find(r => r && r.id === idPrefix + i) || cur[i] || {};
    const phases = (prev.phases && typeof prev.phases === 'object' && !Array.isArray(prev.phases)) ? prev.phases : {};
    return { id: idPrefix + i, label, phases };
  });
  return p.szenarien[stepId];
}
// fs_07: genau die 5 festen Hologate-Durchläufe (stabile IDs hg_0..hg_4), Bezeichnungen aus
// den editierbaren Einstellungen `hologateLabels`.
function ensureHologateRuns(p) {
  return ensureFixedSzenarioRuns(p, 'fs_07', hologateLabels, 'hg_');
}
// fs_10: genau 1 fester Rollercoaster-Durchlauf (stabile ID rc_0). Frühere Mehrfach-Durchläufe
// (vor v2.32.0, per „+ Durchlauf hinzufügen" angelegt) werden dabei auf den ersten reduziert —
// siehe migrateRollercoasterTimeV232 für die frühere Schritt-Zeit selbst.
function ensureRollercoasterRun(p) {
  return ensureFixedSzenarioRuns(p, 'fs_10', ['Rollercoaster'], 'rc_');
}

// Rendert eine Szenario-Phase eines Durchlaufs: `ts:true` (Start/Ende) als Zeit-Eingabefeld
// — Button „Jetzt" oder manuelle Eingabe/Korrektur, wie bei den normalen Schritt-Zeitfeldern
// — `ts:false` weiterhin als antippbares Häkchen (kein Zeitwert). Gemeinsam genutzt von der
// Hologate-Inline-Darstellung (fs_07) und der Rollercoaster-Inline-Darstellung (fs_10).
function szPhaseFieldHTML(stepId, run, ph) {
  if (ph.ts) {
    const inputId = `sz-time-${run.id}-${ph.id}`;
    const val = (run.phases && run.phases[ph.id]) || null;
    return `<div>
      <label class="field-label" for="${esc(inputId)}">${esc(ph.label)}</label>
      <div class="time-capture-row">
        <input type="time" step="1" id="${esc(inputId)}" class="ablauf-sz-time-input" data-sz-step="${esc(stepId)}" data-sz-run="${esc(run.id)}" data-sz-time-phase="${esc(ph.id)}" value="${esc(isoToTimeInput(val))}">
        <button type="button" class="btn btn-ghost btn-sz-time-now" data-target="${esc(inputId)}">🕐 Jetzt</button>
      </div>
    </div>`;
  }
  const done = !!(run.phases && run.phases[ph.id]);
  return `<button class="sensorik-item${done ? ' checked' : ''}" data-sz-phase-inline="${esc(ph.id)}" data-sz-run="${esc(run.id)}" data-sz-step="${esc(stepId)}">
    <span class="sensorik-check">${done ? '✓' : ''}</span>
    <span class="sensorik-info">
      <span class="sensorik-name">${esc(ph.label)}</span>
      <span class="sensorik-time">${done ? 'erledigt' : 'offen'}</span>
    </span>
  </button>`;
}

// Alle Phasen eines Durchlaufs: die Zeit-Phasen (ts:true, i.d.R. Start/Ende) nebeneinander
// wie die normalen Schritt-Zeitfelder, darunter die reinen Häkchen-Phasen (falls vorhanden).
function szRunPhasesHTML(stepId, run, phases) {
  const timePhases = phases.filter(ph => ph.ts);
  const boolPhases = phases.filter(ph => !ph.ts);
  const timeHTML = timePhases.length
    ? `<div class="edit-row-2">${timePhases.map(ph => szPhaseFieldHTML(stepId, run, ph)).join('')}</div>` : '';
  const boolHTML = boolPhases.length
    ? `<div class="sensorik-list" style="margin-top:8px">${boolPhases.map(ph => szPhaseFieldHTML(stepId, run, ph)).join('')}</div>` : '';
  return timeHTML + boolHTML;
}

// Schreibt den Wert eines Szenario-Zeitfelds (Start/Ende) aus dem zugehörigen
// <input type=time> — Pendant zu writeFlowStep() für VR-Szenario-Durchläufe.
function writeSzRunTime(stepId, runId, phaseId) {
  const p = ablaufProband();
  if (!p) return;
  const run = ((p.szenarien && p.szenarien[stepId]) || []).find(r => r.id === runId);
  if (!run) return;
  if (!run.phases) run.phases = {};
  const input = document.getElementById(`sz-time-${runId}-${phaseId}`);
  const t = input ? input.value : '';
  if (!t) {
    delete run.phases[phaseId];
  } else {
    const prevISO = (typeof run.phases[phaseId] === 'string') ? run.phases[phaseId] : new Date().toISOString();
    run.phases[phaseId] = rebuildISO(prevISO, t);
  }
  save();
}

// ── Ereignis-Overlay ───────────────────────────────────────────────────────────
let evOvStepId = '';
let evOvId     = '';
let evOvType   = 'timestamp';

function setEvOvType(type) {
  evOvType = type;
  document.getElementById('ev-ov-type-ts').classList.toggle('selected', type === 'timestamp');
  document.getElementById('ev-ov-type-dur').classList.toggle('selected', type === 'duration');
  document.getElementById('ev-ov-ts-fields').classList.toggle('hidden', type !== 'timestamp');
  document.getElementById('ev-ov-dur-fields').classList.toggle('hidden', type !== 'duration');
}

function renderEvOvTags(selected) {
  const box = document.getElementById('ev-ov-tags');
  box.innerHTML = eventTags.map(t =>
    `<button type="button" class="tag${t === selected ? ' active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`
  ).join('');
  box.querySelectorAll('.tag').forEach(btn =>
    btn.addEventListener('click', () => {
      box.querySelectorAll('.tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    })
  );
}

function openEreignisOverlay(stepId, evId) {
  const p = ablaufProband();
  if (!p) return;
  evOvStepId = stepId;
  evOvId     = evId || '';
  const step = FLOW_STEPS.find(s => s.id === stepId);
  const ex   = evId ? (p.ereignisse || []).find(e => e.id === evId) : null;

  document.getElementById('ev-ov-title').textContent = ex ? 'Ereignis bearbeiten' : 'Ereignis erfassen';
  document.getElementById('ev-ov-context').textContent =
    `${p.pseudo} · ${step ? (step.nr ? 'Schritt ' + step.nr + ' · ' : '') + step.label : ''}`;
  renderEvOvTags(ex ? ex.tag : null);
  document.getElementById('ev-ov-note').value  = ex ? (ex.note || '') : '';
  document.getElementById('ev-ov-time').value  = ex && ex.timeISO  ? isoToTimeInput(ex.timeISO)  : '';
  document.getElementById('ev-ov-start').value = ex && ex.startISO ? isoToTimeInput(ex.startISO) : '';
  document.getElementById('ev-ov-end').value   = ex && ex.endISO   ? isoToTimeInput(ex.endISO)   : '';
  setEvOvType(ex ? ex.type : 'timestamp');
  document.getElementById('ev-ov-delete').classList.toggle('hidden', !ex);
  document.getElementById('ereignis-overlay').classList.remove('hidden');
}

function closeEreignisOverlay() {
  document.getElementById('ereignis-overlay').classList.add('hidden');
  evOvStepId = ''; evOvId = '';
}

function saveEreignisOverlay() {
  const p = ablaufProband();
  if (!p || !evOvStepId) return;
  if (!Array.isArray(p.ereignisse)) p.ereignisse = [];
  const tagBtn = document.querySelector('#ev-ov-tags .tag.active');
  const tag    = tagBtn ? tagBtn.dataset.tag : '';
  const note   = document.getElementById('ev-ov-note').value.trim();
  if (!tag)  { showToast('⚠ Kategorie wählen'); return; }
  if (!note) { showToast('⚠ Beschreibung eingeben'); return; }
  const nowISO = new Date().toISOString();
  const base   = { type: evOvType, tag, note };
  if (evOvType === 'duration') {
    const s = document.getElementById('ev-ov-start').value;
    const e = document.getElementById('ev-ov-end').value;
    if (!s || !e) { showToast('⚠ Start- und Endzeit eingeben'); return; }
    base.startISO = rebuildISO(nowISO, s);
    base.endISO   = rebuildISO(nowISO, e);
    if (new Date(base.endISO) < new Date(base.startISO)) { showToast('⚠ Ende liegt vor Start'); return; }
  } else {
    const t = document.getElementById('ev-ov-time').value;
    if (!t) { showToast('⚠ Zeitpunkt eingeben'); return; }
    base.timeISO = rebuildISO(nowISO, t);
  }
  const idx = evOvId ? p.ereignisse.findIndex(e => e.id === evOvId) : -1;
  const entry = {
    id: idx >= 0 ? p.ereignisse[idx].id : uid(),
    stepId: evOvStepId,
    ...base,
    createdAt: idx >= 0 ? p.ereignisse[idx].createdAt : nowISO
  };
  if (idx >= 0) p.ereignisse[idx] = entry; else p.ereignisse.push(entry);
  save();
  closeEreignisOverlay();
  renderAblauf();
  showToast(idx >= 0 ? '✓ Ereignis aktualisiert' : '✓ Ereignis gespeichert');
}

function deleteEreignisCurrent() {
  const p = ablaufProband();
  if (!p || !evOvId) return;
  const e = (p.ereignisse || []).find(x => x.id === evOvId);
  showConfirm('Ereignis löschen', `„${e ? e.note : 'Ereignis'}" löschen?`, () => {
    p.ereignisse = (p.ereignisse || []).filter(x => x.id !== evOvId);
    save();
    closeEreignisOverlay();
    renderAblauf();
    showToast('Ereignis gelöscht');
  });
}

document.getElementById('ev-ov-close').addEventListener('click', closeEreignisOverlay);
document.getElementById('ev-ov-cancel').addEventListener('click', closeEreignisOverlay);
document.getElementById('ev-ov-save').addEventListener('click', saveEreignisOverlay);
document.getElementById('ev-ov-delete').addEventListener('click', deleteEreignisCurrent);
document.getElementById('ev-ov-type-ts').addEventListener('click', () => setEvOvType('timestamp'));
document.getElementById('ev-ov-type-dur').addEventListener('click', () => setEvOvType('duration'));
document.getElementById('ereignis-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('ereignis-overlay')) closeEreignisOverlay();
});

// ── VR-Szenario-Durchlauf: Häkchen-Phasen ──────────────────────────────────────
// Gemeinsame Häkchen-Logik (ts:false-Phasen ohne Zeitwert, z.B. „Person kalibriert") für die
// Inline-Darstellung beider fixer Szenario-Schritte (fs_07 Hologate, fs_10 Rollercoaster).
// Zeit-Phasen (ts:true, Start/Ende) laufen seit v2.29.0 über eigene Zeit-Eingabefelder (siehe
// writeSzRunTime), nicht mehr hier.
function toggleRunPhase(stepId, runId, phaseId, afterFn) {
  const p = ablaufProband();
  if (!p) return;
  const run = ((p.szenarien && p.szenarien[stepId]) || []).find(r => r.id === runId);
  const ph  = szPhasesFor(stepId).find(x => x.id === phaseId);
  if (!run || !ph || ph.ts) return;
  if (!run.phases) run.phases = {};
  const commit = () => { save(); if (afterFn) afterFn(); renderAblauf(); };
  if (run.phases[phaseId]) {
    showConfirm('Phase zurücksetzen', `Häkchen bei „${ph.label}" entfernen?`, () => { delete run.phases[phaseId]; commit(); });
  } else {
    run.phases[phaseId] = true;
    commit();
  }
}

// „Weiter": aktuellen Schritt sichern und den nächsten Schritt der Liste öffnen.
function advanceFlowStep() {
  if (expandedFlowStepId && document.getElementById('ablauf-edit-start')) {
    writeFlowStep(expandedFlowStepId);
  }
  const idx = FLOW_STEPS.findIndex(s => s.id === expandedFlowStepId);
  if (idx >= 0 && idx < FLOW_STEPS.length - 1) {
    expandedFlowStepId = FLOW_STEPS[idx + 1].id;
  }
  renderAblauf();
}

// Zählt komplette/angefangene Schritte für die aktuell aktive Person (p darf null sein).
function ablaufCounts(p) {
  const abl = (p && p.ablauf) || {};
  let komplett = 0, teilweise = 0;
  FLOW_STEPS.forEach(s => {
    const st = flowStepStateFor(s.id, abl[s.id]);
    if (st === 'komplett') komplett++;
    else if (st === 'teilweise') teilweise++;
  });
  return { komplett, teilweise, pct: Math.round((komplett / FLOW_STEPS.length) * 100) };
}

// Aktualisiert Farbcodierung, Zeit-Zusammenfassung, Notiz-Badge je Schritt-Zeile und den
// Fortschrittsbalken in-place, ohne #ablauf-timeline neu zu rendern.
function syncAblaufRows() {
  const p = ablaufProband();
  if (!p) return;
  if (!p.ablauf) p.ablauf = {};
  FLOW_STEPS.forEach(s => {
    const d   = p.ablauf[s.id];
    const row = document.querySelector(`.ablauf-step[data-id="${s.id}"]`);
    if (!row) return;
    row.dataset.state = flowStepStateFor(s.id, d);
    const sub = row.querySelector('.ablauf-step-sub');
    if (sub) {
      const startTxt = d && d.startISO ? localTimeStr(d.startISO) : '–';
      const endTxt   = d && d.endISO   ? localTimeStr(d.endISO)   : '–';
      let summary    = (d && (d.startISO || d.endISO)) ? `${startTxt} → ${endTxt}` : 'noch nicht erfasst';
      if (s.id === 'fs_01') summary = 'Teilnehmende:r angelegt';
      if (s.id === 'fs_02') {
        const sDone = (p.sensorik) ? SENSORIK_ITEMS.filter(it => p.sensorik[it.id]).length : 0;
        summary = sDone ? `Sensorik ${sDone}/${SENSORIK_ITEMS.length}` : 'noch nicht erfasst';
      }
      if (s.id === 'fs_07') {
        const runs = Array.isArray(p.szenarien && p.szenarien.fs_07) ? p.szenarien.fs_07 : [];
        const rDone = runs.filter(r => r.phases && r.phases.p_start && r.phases.p_end).length;
        summary = rDone ? `Durchläufe ${rDone}/${hologateLabels.length}` : 'noch nicht erfasst';
      }
      if (s.id === 'fs_10') {
        const run = Array.isArray(p.szenarien && p.szenarien.fs_10) ? p.szenarien.fs_10[0] : null;
        const ph  = (run && run.phases) || {};
        summary = (ph.p_start || ph.p_end)
          ? `${ph.p_start ? localTimeStr(ph.p_start) : '–'} → ${ph.p_end ? localTimeStr(ph.p_end) : '–'}`
          : 'noch nicht erfasst';
      }
      if (s.id === 'fs_14') {
        const sDone = (p.sensorikAblegen) ? SENSORIK_ITEMS.filter(it => p.sensorikAblegen[it.id]).length : 0;
        summary = sDone ? `Sensorik ${sDone}/${SENSORIK_ITEMS.length}` : 'noch nicht erfasst';
      }
      if (BEW_STEP_META[s.id]) {
        const b = (p.bewertungen && Array.isArray(p.bewertungen[s.id])) ? p.bewertungen[s.id][0] : null;
        const filled = (b && b.scores) ? BEW_OV_ITEMS.filter(k => b.scores[k] != null).length : 0;
        summary = filled ? `${filled}/${BEW_OV_ITEMS.length} bewertet` : 'noch nicht erfasst';
      }
      if (FRAGEBOGEN_STEPS.has(s.id) && d && d.done) summary = 'Fragebogen ausgefüllt';
      if (SINGLE_TIME_STEPS.has(s.id)) summary = (d && d.startISO) ? `erfasst ${startTxt}` : 'noch nicht erfasst';
      if (s.id === LAST_FLOW_STEP_ID) {
        const secured = !!(d && d.dataSecured), disinfected = !!(d && d.disinfected);
        summary = (secured && disinfected) ? 'gesichert & desinfiziert'
          : (secured || disinfected) ? 'teilweise abgehakt' : 'noch nicht erfasst';
      }
      sub.textContent = `${s.tag}  ·  ${summary}`;
    }
  });
  const c   = ablaufCounts(p);
  const bar = document.querySelector('#ablauf-progress .ablauf-progress-bar span');
  const txt = document.querySelector('#ablauf-progress .ablauf-progress-text');
  if (bar) bar.style.width = c.pct + '%';
  if (txt) txt.textContent = `${c.komplett} / ${FLOW_STEPS.length} komplett` +
    (c.teilweise ? '  ·  ' + c.teilweise + ' angefangen' : '');
}

// Schreibt den aktuell geöffneten Schritt aus den Eingabefeldern in p.ablauf (ohne Re-Render).
// Schreibt Start/Ende aus den Zeitfeldern. Ein evtl. aus einer älteren Version noch
// vorhandenes `note`/`noteISO` (der frühere separate Anmerkung-Punkt, seit v2.30.0 ohne
// eigenes Eingabefeld) wird unangetastet übernommen statt stillschweigend gelöscht.
function writeFlowStep(stepId) {
  const p = ablaufProband();
  if (!p || !stepId) return;
  if (!p.ablauf) p.ablauf = {};
  const startEl = document.getElementById('ablauf-edit-start');
  const endEl   = document.getElementById('ablauf-edit-end');
  if (!startEl && !endEl) return; // Panel nicht offen / Schritt ohne Zeitfelder
  const startT = startEl ? startEl.value : '';
  const endT   = endEl   ? endEl.value   : '';
  const prev      = p.ablauf[stepId] || {};
  const baseStart = prev.startISO || new Date().toISOString();
  const baseEnd   = prev.endISO   || prev.startISO || new Date().toISOString();
  const startISO  = startT ? rebuildISO(baseStart, startT) : null;
  const endISO    = endT   ? rebuildISO(baseEnd,   endT)   : null;
  if (startISO && endISO && new Date(endISO) < new Date(startISO)) {
    showToast('⚠ Ende liegt vor Start — trotzdem gespeichert');
  }
  const note    = prev.note    || '';
  const noteISO = prev.noteISO || null;
  if (!startISO && !endISO && !note) {
    delete p.ablauf[stepId];
  } else {
    p.ablauf[stepId] = { startISO, endISO, note, noteISO };
  }
  save();
}

// „Schritt leeren" ist seit v2.30.0 nur noch an Schritten mit Zeitfeldern verfügbar (NO_TIME-
// Schritte haben je ihre eigene Rückgängig-/Reset-Funktion: Checkliste, Fragebogen-Häkchen,
// Bewertungsbogen). Ein evtl. noch vorhandenes altes `note`/`noteISO` bleibt erhalten.
function clearFlowStep(stepId) {
  const p = ablaufProband();
  if (!p || !stepId) return;
  if (!p.ablauf || !p.ablauf[stepId]) { renderAblauf(); return; }
  const step  = FLOW_STEPS.find(s => s.id === stepId);
  const label = step ? step.label : 'diesen Schritt';
  const question = SINGLE_TIME_STEPS.has(stepId)
    ? `Erfassten Zeitpunkt für „${label}" entfernen?`
    : `Erfasste Start-/Endzeit für „${label}" entfernen?`;
  showConfirm('Schritt leeren', question, () => {
    const prev = p.ablauf[stepId] || {};
    if (prev.note && prev.note.trim()) {
      p.ablauf[stepId] = { note: prev.note, noteISO: prev.noteISO || null };
    } else {
      delete p.ablauf[stepId];
    }
    save();
    renderAblauf();
    showToast('Schritt geleert');
  });
}

// Fragebogen-Bestätigung umschalten (fs_03 / fs_05 / fs_09 / fs_12). Gesetzt → Schritt grün.
function toggleFragebogenDone(stepId) {
  const p = ablaufProband();
  if (!p || !stepId || !FRAGEBOGEN_STEPS.has(stepId)) return;
  if (!p.ablauf) p.ablauf = {};
  const prev = p.ablauf[stepId] || {};
  if (prev.done) {
    delete prev.done;
    const empty = !prev.startISO && !prev.endISO && !(prev.note && prev.note.trim());
    if (empty) delete p.ablauf[stepId];
    else       p.ablauf[stepId] = prev;
  } else {
    prev.done = new Date().toISOString();
    p.ablauf[stepId] = prev;
    showToast('✓ Fragebogen bestätigt');
  }
  save();
  renderAblauf();
}

const ablaufSelectEl = document.getElementById('ablauf-proband-select');
if (ablaufSelectEl) ablaufSelectEl.addEventListener('change', e => {
  selectedAblaufProbandId = e.target.value;
  expandedFlowStepId = '';
  renderAblauf();
});

// Teilnehmende aus dem Ablauf heraus anlegen / bearbeiten (Vollbild-Dialog bzw. Overlay)
const ablaufAddBtn = document.getElementById('ablauf-add-proband');
if (ablaufAddBtn) ablaufAddBtn.addEventListener('click', openProbandAddOverlay);
const ablaufEditBtn = document.getElementById('ablauf-edit-proband');
if (ablaufEditBtn) ablaufEditBtn.addEventListener('click', () => {
  if (selectedAblaufProbandId) openProbandEdit(selectedAblaufProbandId);
  else showToast('⚠ Erst eine Person wählen oder anlegen');
});

// "✕ Zurück zum Ablauf" in den Vollbild-Dialogen (Teilnehmende verwalten / Export)
document.querySelectorAll('[data-back-to-ablauf]').forEach(btn =>
  btn.addEventListener('click', () => showScreen('ablauf'))
);

// Einstellungen-Overlay über das ⚙-Icon oben rechts
const settingsOverlay = document.getElementById('settings-overlay');
const btnOpenSettings = document.getElementById('btn-open-settings');
if (btnOpenSettings && settingsOverlay) {
  btnOpenSettings.addEventListener('click', () => {
    renderSettingsScreen();
    settingsOverlay.classList.remove('hidden');
  });
  document.getElementById('settings-close').addEventListener('click', () => settingsOverlay.classList.add('hidden'));
  settingsOverlay.addEventListener('click', e => {
    if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────────
load();
if (scenarios.length) selectedScenId = scenarios[0].id;
renderProbanden();
renderAblauf();
renderSensorik();
buildScenarioGrid();
buildProbandSelect();
renderTagRow('deviation-tags');
const dateStr = new Date().toLocaleDateString('de-DE', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
['topbar-sub','sidebar-sub'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = dateStr; });
const pdEl = document.getElementById('page-date'); if(pdEl) pdEl.textContent = dateStr;
const ptEl = document.getElementById('page-title'); if(ptEl) ptEl.textContent = PAGE_TITLES['ablauf'];
document.querySelectorAll('.app-version').forEach(el => el.textContent = 'v' + APP_VERSION);

}); // end DOMContentLoaded
