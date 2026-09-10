'use strict';

// ── App Version (Single Source of Truth) ───────────────────────────────────
// Bei jeder inhaltlichen Änderung Patch-Version erhöhen (z.B. 2.2.1 -> 2.2.2).
// sw.js CACHE-Name manuell synchron mitziehen, damit alte Caches invalidiert werden.
const APP_VERSION = '2.17.0';

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

const DEFAULT_SCENARIOS = [
  { id: 'sc_tut',  name: 'Tutorial',     abbr: 'TUT', icon: '🎓' },
  { id: 'sc_holo', name: 'Hologate',     abbr: 'HG',  icon: '🥽' },
  { id: 'sc_rc',   name: 'Rollercoaster', abbr: 'RC',  icon: '🎢' },
];

// Sensorik-Hardware-Items (Tab "Sensorik"): feste Liste, kein UI zum Bearbeiten.
// Der Zeitpunkt "angelegt" wird PRO Teilnehmende:r in p.sensorik[itemId] als ISO-String
// gespeichert (fehlender Schlüssel = für diese Person noch nicht angelegt).
const SENSORIK_ITEMS = [
  { id: 'se_ecg',    label: 'Shimmer ECG' },
  { id: 'se_gsr',    label: 'Shimmer GSR+' },
  { id: 'se_polar',  label: 'Polar Brustgurt' },
  { id: 'se_garmin', label: 'Garmin' },
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
const FLOW_STEPS = [
  { id: 'fs_ankommen', nr: '',   label: 'Ankommen, Begrüßung',                                tag: 'VR / SEN' },
  { id: 'fs_01', nr: '1',  label: 'Aufklärung + Einverständniserklärung',                     tag: 'VR / SEN' },
  { id: 'fs_02', nr: '2',  label: 'Anlegen Sensorik (Shimmer, Brustgurt, Uhr)',              tag: 'SEN' },
  { id: 'fs_03', nr: '3',  label: 'Fragebogen 1',                                            tag: 'SEN / VR' },
  { id: 'fs_04', nr: '4',  label: 'TMS (ca. 0,5 h)',                                         tag: 'TMS (extern)' },
  { id: 'fs_05', nr: '5',  label: 'Fragebogen 2',                                            tag: 'SEN / VR' },
  { id: 'fs_06', nr: '6',  label: 'Anlegen VR-Equipment (Hologate)',                         tag: 'VR' },
  { id: 'fs_07', nr: '7',  label: 'Einweisung + Tutorial VR (Hologate)',                     tag: 'VR' },
  { id: 'fs_08', nr: '8',  label: 'VR-Szenarien Hologate (5 Szenarien)',                     tag: 'VR' },
  { id: 'fs_09', nr: '9',  label: 'Ablegen VR-Equipment (Hologate)',                         tag: 'VR' },
  { id: 'fs_10', nr: '10', label: 'Fragebogen 3',                                            tag: 'SEN / VR' },
  { id: 'fs_11', nr: '11', label: 'VR-Brille anlegen (Rollercoaster)',                       tag: 'VR' },
  { id: 'fs_12', nr: '12', label: 'Rollercoaster (Varjo)',                                   tag: 'VR' },
  { id: 'fs_13', nr: '13', label: 'VR-Brille ablegen (Rollercoaster)',                       tag: 'VR' },
  { id: 'fs_14', nr: '14', label: 'Fragebogen 4',                                            tag: 'SEN / VR' },
  { id: 'fs_15', nr: '15', label: 'Stop Sensorik (Aufzeichnung beenden)',                    tag: 'SEN' },
  { id: 'fs_16', nr: '16', label: 'Sensorik ablegen',                                        tag: 'SEN' },
  { id: 'fs_17', nr: '17', label: 'Verabschiedung',                                          tag: 'VR / SEN' },
  { id: 'fs_18', nr: '18', label: 'Datensicherung / Desinfektion & Aufbereitung Sensorik / StudyLog-Daten sichern', tag: 'VR / SEN' },
];
const LAST_FLOW_STEP_ID = FLOW_STEPS[FLOW_STEPS.length - 1].id;

// Schritte, an denen VR den Trainerbewertungsbogen zum vorangegangenen VR-Szenario ausfüllt
// (nach dem Ablegen, während die Teilnehmenden den Fragebogen bearbeiten). Ein Bogen pro
// VR-Szenario — Hologate (Schritt 8) hat mehrere, Rollercoaster (Schritt 12) i.d.R. einen.
const BEW_STEP_META = {
  fs_10: { scenarioLabel: 'Hologate-Szenarien (Schritt 8)',   defaultLabel: 'Szenario ' },
  fs_14: { scenarioLabel: 'Rollercoaster / Varjo (Schritt 12)', defaultLabel: 'Rollercoaster' },
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

// ── State ────────────────────────────────────────────────────────────────────
let probanden        = [];
let sessions         = [];
let settings         = { deviceLabel: '', lastExport: null, multiProband: false };
let scenarios        = [];
let tags             = [];
let bewertungen      = [];
let events            = [];
let eventTags         = [];
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
  } catch(e) { showToast('⚠ Speicherfehler'); }
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
    localStorage.removeItem(KEY_SENSORIK);
    scenarios = sc ? JSON.parse(sc) : deepCopy(DEFAULT_SCENARIOS);
    if (!scenarios.length) scenarios = deepCopy(DEFAULT_SCENARIOS);
    tags = tg ? JSON.parse(tg) : [...DEFAULT_TAGS];
    if (!tags.length) tags = [...DEFAULT_TAGS];
  } catch(e) {
    scenarios = deepCopy(DEFAULT_SCENARIOS);
    tags = [...DEFAULT_TAGS];
    eventTags = [...DEFAULT_EVENT_TAGS];
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

document.getElementById('btn-add-proband').addEventListener('click', () =>
  document.getElementById('add-form').classList.toggle('hidden')
);
document.getElementById('btn-cancel-proband').addEventListener('click', () => {
  document.getElementById('add-form').classList.add('hidden');
  clearAddForm();
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
  document.getElementById('add-form').classList.add('hidden');
  renderProbanden(document.getElementById('search-input').value);
  showToast('✓ ' + pseudo + ' angelegt');
  // Neue Person wird die aktive im Ablauf; zurück zum Ablauf.
  selectedSensorikProbandId = newId;
  selectedAblaufProbandId   = newId;
  expandedFlowStepId        = '';
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
function renderSettingsScreen() {
  document.getElementById('chk-multi-proband').checked = !!settings.multiProband;
}
document.getElementById('chk-multi-proband').addEventListener('change', e => {
  settings.multiProband = e.target.checked;
  if (!settings.multiProband) { selectedProbandIds = []; selectedBewSessionIds = []; }
  save();
});

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
let expandedFlowStepId       = '';
const ABLAUF_WIDE_MQ = window.matchMedia('(min-width: 1024px)');
// Beim Wechsel Hoch-/Querformat neu aufbauen, damit Inline-Panel <-> Detailspalte umschaltet.
ABLAUF_WIDE_MQ.addEventListener('change', () => {
  if (document.getElementById('screen-ablauf')?.classList.contains('active')) renderAblauf();
});

// Eingabefelder (Start/Ende/Anmerkung + „Weiter"/„Schritt leeren") für einen Schritt —
// identisch im Inline-Panel (schmal) wie in der Detailspalte (breit); IDs bleiben eindeutig,
// da immer nur eine der beiden Stellen gerendert wird. `isLast` = letzter Schritt (kein „Weiter").
function flowStepFieldsHTML(d, isLast) {
  return `
    <div class="edit-row-2">
      <div>
        <label class="field-label" for="ablauf-edit-start">Start</label>
        <div class="time-capture-row">
          <input type="time" id="ablauf-edit-start" step="1" value="${esc(isoToTimeInput(d.startISO))}">
          <button type="button" class="btn btn-ghost btn-time-now" data-target="ablauf-edit-start">🕐 Jetzt</button>
        </div>
      </div>
      <div>
        <label class="field-label" for="ablauf-edit-end">Ende</label>
        <div class="time-capture-row">
          <input type="time" id="ablauf-edit-end" step="1" value="${esc(isoToTimeInput(d.endISO))}">
          <button type="button" class="btn btn-ghost btn-time-now" data-target="ablauf-edit-end">🕐 Jetzt</button>
        </div>
      </div>
    </div>
    <label class="field-label" for="ablauf-edit-note">Hinweis / Anmerkung</label>
    <textarea id="ablauf-edit-note" rows="2" placeholder="Anmerkung zu diesem Schritt…" autocorrect="off">${esc(d.note || '')}</textarea>
    <div class="btn-col" style="margin-top:12px">
      ${isLast ? '' : '<button class="btn btn-primary full-width" id="ablauf-edit-next">✓ Weiter zum nächsten Schritt</button>'}
      <button class="btn btn-ghost full-width" id="ablauf-edit-clear">Schritt leeren</button>
    </div>`;
}

function flowStepState(d) {
  if (!d) return 'offen';
  const hasStart = !!d.startISO;
  const hasEnd   = !!d.endISO;
  const hasNote  = !!(d.note && d.note.trim());
  if (hasStart && hasEnd) return 'komplett';
  if (hasStart || hasEnd || hasNote) return 'teilweise';
  return 'offen';
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
  const p = ablaufProband();
  if (!p) {
    timeline.innerHTML = '';
    if (detail) detail.innerHTML = '';
    if (layout) layout.classList.add('hidden');
    progress.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  if (!p.ablauf) p.ablauf = {};
  empty.classList.add('hidden');
  if (layout) layout.classList.remove('hidden');
  const wide = ABLAUF_WIDE_MQ.matches;

  const c = ablaufCounts(p);
  progress.innerHTML =
    `<div class="ablauf-progress-bar"><span style="width:${c.pct}%"></span></div>` +
    `<div class="ablauf-progress-text">${c.komplett} / ${FLOW_STEPS.length} komplett` +
    `${c.teilweise ? '  ·  ' + c.teilweise + ' angefangen' : ''}</div>`;

  timeline.innerHTML = FLOW_STEPS.map(s => {
    const d       = p.ablauf[s.id] || {};
    const state   = flowStepState(d);
    const isOpen  = expandedFlowStepId === s.id;
    const startTxt = d.startISO ? localTimeStr(d.startISO) : '–';
    const endTxt   = d.endISO   ? localTimeStr(d.endISO)   : '–';
    const summary  = (d.startISO || d.endISO) ? `${startTxt} → ${endTxt}` : 'noch nicht erfasst';
    const noteBadge = (d.note && d.note.trim()) ? ' <span class="ablauf-note-badge" aria-label="Anmerkung vorhanden">✎</span>' : '';
    return `
    <div class="ablauf-step-wrap">
      <button class="ablauf-step${isOpen ? ' selected' : ''}" data-state="${state}" data-id="${esc(s.id)}" aria-expanded="${isOpen}">
        <span class="ablauf-step-nr">${s.nr ? esc(s.nr) : '•'}</span>
        <span class="ablauf-step-body">
          <span class="ablauf-step-label">${esc(s.label)}${noteBadge}</span>
          <span class="ablauf-step-sub">${esc(s.tag)}  ·  ${esc(summary)}</span>
        </span>
        <span class="ablauf-step-chevron">${isOpen ? '▾' : '▸'}</span>
      </button>
      ${(!wide && isOpen) ? `<div class="ablauf-step-panel">${flowStepFieldsHTML(d, s.id === LAST_FLOW_STEP_ID)}${flowStepExtrasHTML(s.id)}</div>` : ''}
    </div>`;
  }).join('');

  // Detailspalte (nur im Querformat / breiten Layout sichtbar)
  if (detail) {
    if (wide && expandedFlowStepId) {
      const s = FLOW_STEPS.find(x => x.id === expandedFlowStepId);
      const d = (s && p.ablauf[s.id]) || {};
      detail.innerHTML = s
        ? `<div class="ablauf-detail-head">${s.nr ? 'Schritt ' + esc(s.nr) + ' · ' : ''}${esc(s.label)}</div>` +
          flowStepFieldsHTML(d, s.id === LAST_FLOW_STEP_ID) + flowStepExtrasHTML(s.id)
        : '';
    } else if (wide) {
      detail.innerHTML = '<div class="ablauf-detail-empty">Einen Schritt links auswählen, um Start-/Endzeit und eine Anmerkung zu erfassen.</div>';
    } else {
      detail.innerHTML = '';
    }
  }

  timeline.querySelectorAll('.ablauf-step').forEach(btn =>
    btn.addEventListener('click', () => {
      // offenen Schritt zuerst sichern, falls der Feld-„change" noch nicht gefeuert hat
      if (expandedFlowStepId && document.getElementById('ablauf-edit-note')) {
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
  ['ablauf-edit-start','ablauf-edit-end','ablauf-edit-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { writeFlowStep(expandedFlowStepId); syncAblaufRows(); });
  });
  const clearBtn = document.getElementById('ablauf-edit-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => clearFlowStep(expandedFlowStepId));
  const nextBtn = document.getElementById('ablauf-edit-next');
  if (nextBtn) nextBtn.addEventListener('click', advanceFlowStep);
  const expBtn = document.getElementById('ablauf-open-export');
  if (expBtn) expBtn.addEventListener('click', () => showScreen('export'));

  // Trainerbewertungsbogen-Buttons (nur an fs_10 / fs_14)
  const extrasScope = wide && detail ? detail : timeline;
  extrasScope.querySelectorAll('[data-bew-add]').forEach(btn =>
    btn.addEventListener('click', () => openBewOverlay(btn.dataset.bewAdd, null))
  );
  extrasScope.querySelectorAll('[data-bew-edit]').forEach(btn =>
    btn.addEventListener('click', () => openBewOverlay(expandedFlowStepId, btn.dataset.bewEdit))
  );
  // Sensorik-Checkliste (nur an fs_02)
  extrasScope.querySelectorAll('[data-sensorik-toggle]').forEach(btn =>
    btn.addEventListener('click', () => toggleAblaufSensorik(btn.dataset.sensorikToggle))
  );
  const sensResetBtn = document.getElementById('ablauf-sensorik-reset');
  if (sensResetBtn) sensResetBtn.addEventListener('click', resetAblaufSensorik);
  // Ereignis-Buttons (jeder Schritt)
  extrasScope.querySelectorAll('[data-ev-add]').forEach(btn =>
    btn.addEventListener('click', () => openEreignisOverlay(btn.dataset.evAdd, null))
  );
  extrasScope.querySelectorAll('[data-ev-edit]').forEach(btn =>
    btn.addEventListener('click', () => openEreignisOverlay(expandedFlowStepId, btn.dataset.evEdit))
  );

  // gewählten Schritt in der linken Leiste sichtbar scrollen
  if (expandedFlowStepId) {
    const selRow = timeline.querySelector('.ablauf-step.selected');
    if (selRow) selRow.scrollIntoView({ block: 'nearest' });
  }
}

// Zusatzinhalte, die nur an bestimmten Schritten im Detailbereich erscheinen.
function flowStepExtrasHTML(stepId) {
  let html = '';
  if (stepId === 'fs_02')        html += sensorikSectionHTML();
  if (BEW_STEP_META[stepId])     html += bewSectionHTML(stepId);
  html += ereignisSectionHTML(stepId);   // Ereignis-Erfassung an jedem Schritt
  if (stepId === LAST_FLOW_STEP_ID) {
    html += `<div class="btn-col" style="margin-top:12px">
      <button class="btn btn-ghost full-width" id="ablauf-open-export">⬇ Daten exportieren (CSV / JSON)</button>
    </div>`;
  }
  return html;
}

// Abschnitt „Ereignisse / Probleme" im Detailbereich jedes Schritts.
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
    <div class="card-label" style="margin-bottom:6px">EREIGNISSE / PROBLEME</div>
    <div class="bew-list">${rows || '<div class="meta-text">Kein Ereignis zu diesem Schritt.</div>'}</div>
    <button class="btn btn-ghost full-width" data-ev-add="${esc(stepId)}" style="margin-top:8px">＋ Ereignis erfassen</button>
  </div>`;
}

// Abschnitt „Sensorik-Checkliste" im Detailbereich von Schritt 2 (Anlegen Sensorik).
// Pro Hardware-Item wird der Anlege-Zeitpunkt in p.sensorik[itemId] (ISO) festgehalten.
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

// Abschnitt „Trainerbewertungsbogen" im Detailbereich der Schritte fs_10 / fs_14.
function bewSectionHTML(stepId) {
  const p = ablaufProband();
  if (!p) return '';
  const meta  = BEW_STEP_META[stepId];
  const list  = (p.bewertungen && p.bewertungen[stepId]) || [];
  const rows  = list.map(b => {
    const filled = BEW_OV_ITEMS.filter(k => b.scores && b.scores[k] != null).length;
    return `<button class="bew-list-item" data-bew-edit="${esc(b.id)}">
      <span class="bew-list-label">${esc(b.label || 'Bewertungsbogen')}</span>
      <span class="bew-list-meta">${filled}/${BEW_OV_ITEMS.length} ausgefüllt</span>
    </button>`;
  }).join('');
  return `<div class="bew-section">
    <div class="card-label" style="margin-bottom:6px">TRAINERBEWERTUNGSBOGEN · ${esc(meta.scenarioLabel)}</div>
    <p class="meta-text" style="margin-bottom:8px">Ein Bogen pro VR-Szenario — von VR ausfüllen, während die Teilnehmenden den Fragebogen bearbeiten.</p>
    <div class="bew-list">${rows || '<div class="meta-text">Noch kein Bogen angelegt.</div>'}</div>
    <button class="btn btn-primary full-width" data-bew-add="${esc(stepId)}" style="margin-top:8px">＋ Bewertungsbogen anlegen</button>
  </div>`;
}

// ── Trainerbewertungsbogen-Overlay ──────────────────────────────────────────────
let bewOvStepId = '';
let bewOvId     = '';

function bewFormHTML() {
  const legend =
    `<div class="bew-legend card"><div class="card-label" style="margin-bottom:8px">SKALA</div><div class="bew-legend-row">` +
    BEW_SCALE_LABELS.map((lab, i) => `<span class="bew-legend-item"><span class="bew-pip bew-pip-${i+1}">${i+1}</span> ${esc(lab)}</span>`).join('') +
    `</div></div>`;
  const block = `
    <div class="card">
      <div class="card-label bew-dim-label">${esc(BEW_OV_TITLE)}</div>
      <p class="privacy-text" style="color:var(--text2);line-height:1.5;margin:0 0 12px">${esc(BEW_OV_INTRO)}</p>
      <div class="bew-items">
        ${BEW_OV_QUESTIONS.map(([key, text]) => `
          <div class="bew-item">
            <span class="bew-item-label">${esc(text)}</span>
            <div class="bew-scale-wrap"><div class="bew-scale bew-ov-scale" data-item="${esc(key)}"></div></div>
          </div>`).join('')}
      </div>
    </div>`;
  return legend + block;
}

function renderBewOvScale(key, val) {
  const container = document.querySelector(`#bew-ov-form .bew-ov-scale[data-item="${key}"]`);
  if (!container) return;
  container.innerHTML =
    `<span class="bew-scale-endlabel bew-scale-endlabel-left">${BEW_SCALE_LABELS[0]}</span>` +
    `<div class="bew-scale-btns">` +
    [1,2,3,4,5,6].map(n =>
      `<div class="bew-scale-btn-cell"><button type="button" class="bew-pip-btn bew-pip-${n}${val === n ? ' selected' : ''}" data-val="${n}" aria-label="Note ${n}: ${BEW_SCALE_LABELS[n-1]}">${n}</button></div>`
    ).join('') +
    `</div>` +
    `<span class="bew-scale-endlabel bew-scale-endlabel-right">${BEW_SCALE_LABELS[5]}</span>`;
  container.querySelectorAll('.bew-pip-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      container.querySelectorAll('.bew-pip-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    })
  );
}

function readBewOvScores() {
  const scores = {};
  BEW_OV_ITEMS.forEach(key => {
    const sel = document.querySelector(`#bew-ov-form .bew-ov-scale[data-item="${key}"] .bew-pip-btn.selected`);
    scores[key] = sel ? parseInt(sel.dataset.val, 10) : null;
  });
  return scores;
}

function openBewOverlay(stepId, bid) {
  const p = ablaufProband();
  const meta = BEW_STEP_META[stepId];
  if (!p || !meta) return;
  bewOvStepId = stepId;
  bewOvId     = bid || '';
  const list  = (p.bewertungen && p.bewertungen[stepId]) || [];
  const existing = bid ? list.find(b => b.id === bid) : null;

  document.getElementById('bew-ov-title').textContent = existing ? 'Bewertungsbogen bearbeiten' : 'Neuer Bewertungsbogen';
  document.getElementById('bew-ov-context').textContent = `${p.pseudo} · ${meta.scenarioLabel}`;
  document.getElementById('bew-ov-label').value = existing
    ? (existing.label || '')
    : (stepId === 'fs_10' ? meta.defaultLabel + (list.length + 1) : meta.defaultLabel);
  document.getElementById('bew-ov-notes').value = existing ? (existing.notes || '') : '';
  document.getElementById('bew-ov-form').innerHTML = bewFormHTML();
  BEW_OV_ITEMS.forEach(key => renderBewOvScale(key, existing && existing.scores ? existing.scores[key] : null));
  document.getElementById('bew-ov-delete').classList.toggle('hidden', !existing);
  document.getElementById('bewertung-overlay').classList.remove('hidden');
  document.getElementById('bewertung-overlay').scrollTop = 0;
}

function closeBewOverlay() {
  document.getElementById('bewertung-overlay').classList.add('hidden');
  bewOvStepId = ''; bewOvId = '';
}

function saveBewOverlay() {
  const p = ablaufProband();
  if (!p || !bewOvStepId) return;
  if (!p.bewertungen) p.bewertungen = {};
  if (!Array.isArray(p.bewertungen[bewOvStepId])) p.bewertungen[bewOvStepId] = [];
  const label  = document.getElementById('bew-ov-label').value.trim();
  const notes  = document.getElementById('bew-ov-notes').value.trim();
  const scores = readBewOvScores();
  const filled = BEW_OV_ITEMS.filter(k => scores[k] != null).length;
  if (!label)       { showToast('⚠ Bezeichnung eingeben'); return; }
  if (filled === 0) { showToast('⚠ Mindestens eine Bewertung eingeben'); return; }

  const commit = () => {
    const arr = p.bewertungen[bewOvStepId];
    const idx = bewOvId ? arr.findIndex(b => b.id === bewOvId) : -1;
    const entry = {
      id: idx >= 0 ? arr[idx].id : uid(),
      label, scores, notes, savedAt: new Date().toISOString()
    };
    if (idx >= 0) arr[idx] = entry; else arr.push(entry);
    save();
    closeBewOverlay();
    renderAblauf();
    showToast(idx >= 0 ? '✓ Bewertung aktualisiert' : '✓ Bewertung gespeichert');
  };
  if (filled < BEW_OV_ITEMS.length) {
    showConfirm('Nicht vollständig ausgefüllt',
      `Es sind erst ${filled} von ${BEW_OV_ITEMS.length} Bewertungen eingetragen. Trotzdem speichern?`, commit);
  } else {
    commit();
  }
}

function deleteBewCurrent() {
  const p = ablaufProband();
  if (!p || !bewOvStepId || !bewOvId) return;
  const arr = (p.bewertungen && p.bewertungen[bewOvStepId]) || [];
  const b = arr.find(x => x.id === bewOvId);
  showConfirm('Bogen löschen', `„${b ? b.label : 'Bewertungsbogen'}" wirklich löschen?`, () => {
    p.bewertungen[bewOvStepId] = arr.filter(x => x.id !== bewOvId);
    save();
    closeBewOverlay();
    renderAblauf();
    showToast('Bogen gelöscht');
  });
}

document.getElementById('bew-ov-close').addEventListener('click', closeBewOverlay);
document.getElementById('bew-ov-cancel').addEventListener('click', closeBewOverlay);
document.getElementById('bew-ov-save').addEventListener('click', saveBewOverlay);
document.getElementById('bew-ov-delete').addEventListener('click', deleteBewCurrent);
document.getElementById('bewertung-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('bewertung-overlay')) closeBewOverlay();
});

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

// „Weiter": aktuellen Schritt sichern und den nächsten Schritt der Liste öffnen.
function advanceFlowStep() {
  if (expandedFlowStepId && document.getElementById('ablauf-edit-note')) {
    writeFlowStep(expandedFlowStepId);
  }
  const idx = FLOW_STEPS.findIndex(s => s.id === expandedFlowStepId);
  if (idx >= 0 && idx < FLOW_STEPS.length - 1) {
    expandedFlowStepId = FLOW_STEPS[idx + 1].id;
  }
  renderAblauf();
}

// Zählt komplette/angefangene Schritte für die aktuell aktive Person.
function ablaufCounts(p) {
  let komplett = 0, teilweise = 0;
  FLOW_STEPS.forEach(s => {
    const st = flowStepState(p.ablauf && p.ablauf[s.id]);
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
    row.dataset.state = flowStepState(d);
    const sub = row.querySelector('.ablauf-step-sub');
    if (sub) {
      const startTxt = d && d.startISO ? localTimeStr(d.startISO) : '–';
      const endTxt   = d && d.endISO   ? localTimeStr(d.endISO)   : '–';
      const summary  = (d && (d.startISO || d.endISO)) ? `${startTxt} → ${endTxt}` : 'noch nicht erfasst';
      sub.textContent = `${s.tag}  ·  ${summary}`;
    }
    const label = row.querySelector('.ablauf-step-label');
    if (label) {
      const badge   = label.querySelector('.ablauf-note-badge');
      const hasNote = !!(d && d.note && d.note.trim());
      if (hasNote && !badge) {
        label.insertAdjacentHTML('beforeend', ' <span class="ablauf-note-badge" aria-label="Anmerkung vorhanden">✎</span>');
      } else if (!hasNote && badge) {
        badge.remove();
      }
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
function writeFlowStep(stepId) {
  const p = ablaufProband();
  if (!p || !stepId) return;
  if (!p.ablauf) p.ablauf = {};
  const startEl = document.getElementById('ablauf-edit-start');
  const endEl   = document.getElementById('ablauf-edit-end');
  const noteEl  = document.getElementById('ablauf-edit-note');
  if (!startEl && !endEl && !noteEl) return; // Panel nicht offen
  const startT = startEl ? startEl.value : '';
  const endT   = endEl   ? endEl.value   : '';
  const note   = noteEl  ? noteEl.value.trim() : '';
  const prev      = p.ablauf[stepId] || {};
  const baseStart = prev.startISO || new Date().toISOString();
  const baseEnd   = prev.endISO   || prev.startISO || new Date().toISOString();
  const startISO  = startT ? rebuildISO(baseStart, startT) : null;
  const endISO    = endT   ? rebuildISO(baseEnd,   endT)   : null;
  if (startISO && endISO && new Date(endISO) < new Date(startISO)) {
    showToast('⚠ Ende liegt vor Start — trotzdem gespeichert');
  }
  if (!startISO && !endISO && !note) {
    delete p.ablauf[stepId];
  } else {
    p.ablauf[stepId] = { startISO, endISO, note };
  }
  save();
}

function clearFlowStep(stepId) {
  const p = ablaufProband();
  if (!p || !stepId) { expandedFlowStepId = ''; renderAblauf(); return; }
  if (!p.ablauf || !p.ablauf[stepId]) { expandedFlowStepId = ''; renderAblauf(); return; }
  const step = FLOW_STEPS.find(s => s.id === stepId);
  showConfirm('Schritt leeren',
    `Erfasste Zeiten und Anmerkung für „${step ? step.label : 'diesen Schritt'}" entfernen?`,
    () => {
      delete p.ablauf[stepId];
      save();
      expandedFlowStepId = '';
      renderAblauf();
      showToast('Schritt geleert');
    });
}

const ablaufSelectEl = document.getElementById('ablauf-proband-select');
if (ablaufSelectEl) ablaufSelectEl.addEventListener('change', e => {
  selectedAblaufProbandId = e.target.value;
  expandedFlowStepId = '';
  renderAblauf();
});

// Teilnehmende aus dem Ablauf heraus anlegen / bearbeiten (Vollbild-Dialog bzw. Overlay)
const ablaufAddBtn = document.getElementById('ablauf-add-proband');
if (ablaufAddBtn) ablaufAddBtn.addEventListener('click', () => showScreen('probanden'));
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
