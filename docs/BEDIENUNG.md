# StudyLog-V2 — Bedienungsanleitung

> Anleitung für Studienleitende, die die App zur Durchführung nutzen. Keine technischen
> Details — dafür siehe [ARCHITECTURE.md](./ARCHITECTURE.md). Datenschutz-Hintergrund:
> siehe [DATENFLUSS.md](./DATENFLUSS.md).

## Installation & Start

1. Die von der Studienleitung genannte App-URL im Browser öffnen (auf dem iPhone: **Safari**
   verwenden, nicht Chrome — sonst funktioniert "Zum Home-Bildschirm" nicht zuverlässig).
2. **Auf dem Home-Bildschirm installieren** (empfohlen, damit die App offline funktioniert
   und wie eine normale App aussieht):
   - **iPhone/iPad:** Teilen-Symbol antippen → "Zum Home-Bildschirm" → Hinzufügen.
   - **Android:** Menü (⋮) öffnen → "Zum Startbildschirm hinzufügen" bzw. "App installieren".
3. App-Symbol auf dem Home-Bildschirm antippen — die App startet auch ohne Internetverbindung.

## Aufbau der App

Ab **v2.14.0** hat die App **keine Tab-Leiste** mehr. Die gesamte Bedienung läuft über den
**Ablauf** — die chronologische Schrittliste des Studienablaufs:

- **Tablet (Querformat, empfohlen):** links die Schritt-Leiste (mit eigener Scrollbar, falls
  nicht alle Schritte auf einmal passen), rechts das Eingabefeld für den gewählten Schritt.
- **Smartphone:** die Schritt-Leiste füllt den Bildschirm; ein angetippter Schritt klappt in
  der Liste auf.

Oben rechts neben dem App-Namen öffnet das **⚙-Icon** die **Einstellungen** (Mehrfachauswahl
von Teilnehmenden, „Alle Daten löschen"). Alles Weitere wird aus dem Ablauf heraus geöffnet:

| Aufruf | Öffnet |
|---|---|
| **＋** neben der Personen-Auswahl (oder „＋ Teilnehmende:n anlegen" in Schritt 1) | Overlay „Teilnehmende:n anlegen": Pseudonym + Händigkeit + optionale Notiz |
| **✎** neben der Personen-Auswahl | Bearbeiten-Dialog der aktuell gewählten Person |
| Button in **Schritt 18** („Datensicherung") | Vollbild-Dialog „Datensicherung / Export" (CSV/JSON, Statistiken). Mit **✕** zurück |

**Trainerbewertungsbogen (Schritt 10 / 14):** Im Detailbereich von **Schritt 10
„Fragebogen 3"** (für die Hologate-Szenarien) bzw. **Schritt 14 „Fragebogen 4"** (für
Rollercoaster) → **＋ Bewertungsbogen anlegen** → Bezeichnung eintragen (z. B. „Szenario 1"),
bewerten, optional Anmerkungen, **💾 speichern**. Für Hologate wird pro durchlaufenem
Szenario ein eigener Bogen angelegt; bestehende Bögen sind in der Liste antippbar
(bearbeiten/löschen). Gedacht für VR, während die Teilnehmenden den Fragebogen bearbeiten.

Der Bogen ist ab v2.16.0 **reduziert** auf den Block **„Vergleich zur Selbsteinschätzung"** —
diese vier Fragen entsprechen inhaltlich den Fragen des Teilnehmerfragebogens (Selbst-/
Fremd-Vergleich), Schulnoten-Skala 1–6:
1. Die Lage wurde effektiv erfasst.
2. Die Entscheidungen waren angemessen.
3. Die richtigen Prioritäten wurden gesetzt.
4. Gesamtleistung

**Noch nicht umgestellt:** der CSV/JSON-Export bezieht die im Ablauf erfassten Daten
(Zeiten, Bewertungen, Ereignisse, Sensorik, Szenario-Durchläufe) noch nicht ein — er
basiert weiter auf der alten Datenstruktur. Bereits erfasste Daten bleiben gespeichert.

## Die Ablauf-Schrittliste nutzen

Der Ablauf bildet den kompletten Studienablauf als feste Schrittfolge ab (Schritte 1–18,
von „Aufklärung + Einverständniserklärung" über „Anlegen Sensorik", „Fragebogen 1", „TMS", …
bis „Datensicherung / Aufbereitung"). Die Kürzel
VR / SEN / TMS an den Schritten sind nur ein Hinweis, welches Team den Schritt fachlich
verantwortet — sie haben keine weitere Funktion.

1. Beim Start ist **Schritt 1 „Aufklärung + Einverständniserklärung"** direkt geöffnet.
   Dieser Schritt hat **keine Zeitfelder** — sobald die Einverständniserklärung
   unterschrieben ist, hier über **„＋ Teilnehmende:n anlegen"** die Person anlegen (Overlay:
   Pseudonym + Händigkeit + optionale Notiz). Nach dem Bestätigen springt die App
   automatisch zu **Schritt 2 „Anlegen Sensorik"**. Schritt 1 wird grün markiert
   („Teilnehmende:r angelegt"). Weitere Personen später ebenso oder über das **＋** oben;
   die aktive Person wird über das Dropdown gewechselt. Die Schrittliste gilt jeweils nur
   für die gewählte Person.
2. Einen **Schritt antippen** — die Reihenfolge ist frei, man muss nicht oben anfangen.
   Der Schritt zeigt dann (rechts in der Spalte bzw. aufgeklappt in der Liste):
   - **Start** und **Ende**: je über den Button **🕐 Jetzt** die aktuelle Uhrzeit
     übernehmen, oder eine Uhrzeit manuell eintragen/korrigieren. **Schritt 1, 2 und 3 haben
     keine Start/Ende-Felder** (Schritt 1: Person anlegen; Schritt 2: nur die Checkliste;
     Schritt 3 „Fragebogen 1": keine Zeiterfassung).
   - **Hinweis / Anmerkung**: Freitext zu diesem Schritt (z. B. Besonderheiten, Abweichungen).
     Sobald etwas eingetragen ist, wird die **Uhrzeit der Notiz** festgehalten und neben dem
     Feld angezeigt („· notiert 14:51"). Gilt in **jedem** Schritt.
   - **✓ Weiter zum nächsten Schritt**: sitzt in **jedem** Schritt **ganz unten** (nach allen
     Abschnitten), speichert und öffnet den folgenden Schritt. Am letzten Schritt steht dort
     stattdessen der Export-Button.
   Eingaben werden sofort gespeichert.
3. Die **Farbe** jedes Schritts zeigt den Stand auf einen Blick:
   - **grau** – noch nichts erfasst,
   - **gelb** – angefangen (nur Start *oder* Ende *oder* nur eine Anmerkung),
   - **grün** – Start *und* Ende erfasst.
   Ein ✎ neben dem Schrittnamen zeigt an, dass eine Anmerkung hinterlegt ist. Oben läuft ein
   Fortschrittsbalken („X / 18 komplett").
4. **Schritt leeren** (im aufgeklappten Schritt) entfernt nach Rückfrage die erfassten Zeiten
   und die Anmerkung dieses einen Schritts.
5. **Ereignisse / Probleme** (an jedem Schritt): über **＋ Ereignis erfassen** eine Kategorie
   wählen (Sensorik / VR / Fragebogen / TMS / Sonstiges), eine kurze Beschreibung eintragen
   und entweder einen **Zeitpunkt** oder einen **Zeitraum** festhalten (Button „Jetzt" oder
   manuell). Erfasste Ereignisse stehen als Liste am jeweiligen Schritt und lassen sich
   antippen zum Bearbeiten/Löschen.

Einzelne Schritte haben zusätzliche Felder:
- **Schritt 2 „Anlegen Sensorik"**: **nur** die **Sensorik-Checkliste** (Shimmer, Brustgurt,
  Uhr) — keine Start/Ende-Felder. Ein Item antippen, sobald die Sensorik angelegt ist — der
  Zeitpunkt wird automatisch erfasst. Erneutes Tippen macht die Erfassung (nach Rückfrage)
  rückgängig. Der Schritt wird grün, sobald alle drei Items angelegt sind (Anzeige
  „Sensorik 3/3"). Eine Anmerkung (mit Uhrzeit) ist wie in jedem Schritt möglich.
- **Schritt 6 „Anlegen VR-Equipment"**: reine **Anzeigeliste** des anzulegenden Equipments
  (Fußtracker, Handtracker, Weste, VR-Brille) — nichts zum Abhaken, nur als Erinnerung.
- **Schritt 7 / Schritt 8 / Schritt 12**: **VR-Szenario-Durchläufe** — pro Durchlauf über
  **＋ Durchlauf hinzufügen** eine Bezeichnung vergeben und die festen Phasen abhaken.
  „Starten" und „Beendet" erfassen beim Abhaken automatisch die Uhrzeit; die übrigen Phasen
  sind reine Häkchen. Für Hologate (Schritt 8) je durchlaufenem Szenario einen Durchlauf.
  - **Schritt 8 / 12 (Szenario):** Bezeichnung und Phasen werden in einem Overlay bearbeitet.
    Szenario starten (Zeit) · Person kalibriert · Person durchläuft das Szenario · Szenario
    beendet (Zeit) · Brille abgezogen · Selbstbewertung + Bewertungsbogen.
  - **Schritt 7 (Tutorial):** Bezeichnung und Phasen werden **direkt im Schritt** bearbeitet
    (kein Overlay). Kürzer — Tutorial starten (Zeit) · Person kalibriert · Person durchläuft
    das Tutorial · Tutorial beendet (Zeit) · **Direkt ins VR-Szenario gewechselt** (keine
    Bewertung, Brille bleibt auf).
- **Schritt 10 / Schritt 14**: der **Trainerbewertungsbogen** (siehe unten).

Die im Ablauf erfassten Daten werden lokal bei der jeweiligen Person gespeichert. Sie sind
aktuell **nicht** Teil des CSV-/JSON-Exports.

## Typischer Ablauf einer Nutzungssitzung

> **Hinweis:** Die folgenden Abschnitte 2–7 beschreiben noch den früheren Tab-Ablauf
> (Sensorik-, Szenario-, Bewertungs-, Ereignis- und Protokoll-Tab). Diese Bereiche sind ab
> v2.14.0 nicht mehr direkt erreichbar und werden gerade in die Ablauf-Schritte überführt.
> Aktuell gültig sind „Aufbau der App" und „Die Ablauf-Schrittliste nutzen" oben sowie
> Abschnitt 1 (Person anlegen — jetzt über **＋** im Ablauf) und der Export (über Schritt 18).

### 1. Teilnehmende Person anlegen (einmalig pro Person)

1. Im Bereich **Teilnehmende** auf **+** tippen.
2. **Pseudonym** eingeben — **kein Klarname**. Format ist vorgegeben: 1 Buchstabe, dann 4
   Zahlen, dann 3 Buchstaben (z. B. `P1234ABC`). Passt die Eingabe nicht zum Format, wird das
   Feld sofort rot markiert mit dem Hinweis "Format nicht korrekt" darunter; Anlegen ist erst
   möglich, wenn das Format stimmt.
3. **Händigkeit** wählen — "Rechts" oder "Links" (Pflichtfeld, relevant für die
   Sensorplatzierung). Ohne Auswahl ist Anlegen/Speichern nicht möglich.
4. Optional: Notiz eintragen (z. B. "Brille").
5. Mit **✓ Anlegen** speichern.
6. Danach fragt die App **"Sensorik erfassen?"**. Mit **Ja, zur Sensorik** springt man direkt
   in den Sensorik-Tab, wobei die gerade angelegte Person schon ausgewählt ist. **Später /
   Nein** bleibt bei den Teilnehmenden.

Die **Sensoriknummer** (1–12) wird beim Anlegen **nicht mehr** abgefragt. Sie ist optional
und kann bei Bedarf nachträglich über **Person bearbeiten** (Tippen auf eine bereits
angelegte Person) eingetragen werden — ebenso die Uhrzeiten "Sensorik angelegt" / "Sensorik
abgelegt". Die **Sensorik-Checkliste** im gleichnamigen Tab (siehe nächster Abschnitt) ist
davon unabhängig.

### 2. Sensorik anlegen und abhaken

1. In den Bereich **🩹 Sensorik** wechseln. Oben im Dropdown **Teilnehmende:r** die Person
   wählen — standardmäßig ist die **zuletzt angelegte** Person vorausgewählt.
2. Die Checkliste enthält feste Items: Shimmer, Brustgurt, Uhr —
   die erfassten Zeitpunkte gelten jeweils **nur für die ausgewählte Person**.
3. Sobald eine Sensorik-Einheit bei dieser Person angelegt ist, das entsprechende Item
   **antippen** — der aktuelle Zeitpunkt (Datum + Uhrzeit, Gerätezeit) wird automatisch
   erfasst, gespeichert und unter dem Item angezeigt.
4. Versehentlich abgehakt? Item erneut antippen und die Sicherheitsabfrage bestätigen — die
   Erfassung wird entfernt.
5. Mit **↺ Zurücksetzen** (oben rechts) alle erfassten Zeitpunkte **der ausgewählten Person**
   auf einmal löschen.
6. Sobald **alle vier Items** für die Person abgehakt sind, wechselt die App automatisch in
   den Tab **Szenario**.

### 3. Szenario durchführen

1. Im Bereich **Szenario**: die Person im Dropdown ist bereits vorausgewählt (dieselbe wie
   zuletzt im Sensorik-Tab bzw. die zuletzt angelegte Person) — bei Bedarf umstellen. Ist unter
   **⚙ Einstellungen** die Option "Mehrere Teilnehmende gleichzeitig" aktiviert, erscheint
   stattdessen eine Liste zum Antippen mehrerer Personen (z. B. wenn ein Szenario von
   mehreren Teilnehmenden gemeinsam durchlaufen wird). Beim Speichern entsteht dann für
   jede ausgewählte Person eine eigene, unabhängige Sitzungsaufzeichnung mit identischer
   Start-/Endzeit.
2. Passendes **Szenario** antippen (im Auslieferungszustand: Tutorial, Hologate,
   Rollercoaster — über **⚙ Verwalten** änderbar).
3. **▶ Start** drücken, sobald das Szenario beginnt — der Timer läuft.
4. Falls die Sitzung unterbrochen werden muss (z. B. technische Störung, Rückfrage):
   **⏸ Pause** drücken — der Timer friert ein. Mit **▶ Fortsetzen** läuft er weiter, ab
   dem eingefrorenen Stand. Jede Pause wird mit genauer Start-/Endzeit und Dauer
   protokolliert; eine Sitzung kann beliebig oft pausiert werden.
5. Nach Abschluss des Szenarios **⏹ Stopp** drücken (auch aus einer laufenden Pause heraus
   möglich).
6. Falls während der Sitzung etwas vom geplanten Ablauf abgewichen ist: passende
   **Abweichungs-Tags** antippen (z. B. "Techn. Fehler") und/oder eine Freitextnotiz
   eintragen.
7. Mit **💾 Sitzung speichern** abschließen.
8. Die App fragt danach, ob direkt der **Trainerbewertungsbogen** ausgefüllt werden soll
   (siehe Schritt 4) — kann auch später über den Bereich **Bewertung** nachgeholt werden.
   War nur eine Person ausgewählt, bezieht sich der Bogen auf diese eine Sitzung. Wurden
   mehrere Personen gleichzeitig ausgewählt, schlägt die App vor, alle gemeinsam in **einem**
   Bewertungsbogen zu bewerten (die eingetragenen Noten/Anmerkungen werden dann identisch in
   die jeweils eigenständige Bewertung jeder Person übernommen) — eine getrennte
   Einzelbewertung je Person bleibt über den Bereich **Bewertung** weiterhin möglich.

**Wichtig:** Wird nach dem Stoppen erneut **▶ Start** gedrückt, ohne vorher zu speichern,
fragt die App zur Sicherheit nach ("Aufzeichnung verwerfen?"), bevor die noch nicht
gespeicherte Aufzeichnung durch die neue Sitzung überschrieben wird.

### 4. Trainerbewertungsbogen ausfüllen (optional, pro Sitzung)

1. Im Bereich **Bewertung** die gewünschte Sitzung im Dropdown auswählen (bereits bewertete
   Sitzungen sind mit ✓ markiert). Ist unter **⚙ Einstellungen** die Option "Mehrere
   Teilnehmende gleichzeitig" aktiviert, erscheint stattdessen eine Liste zum Antippen
   mehrerer Sitzungen — so lassen sich mehrere Teilnehmende in **einem** gemeinsamen Bogen
   bewerten (z. B. wenn sie dasselbe Szenario gemeinsam durchlaufen haben). Beim
   Vorbefüllen mit einer bereits vorhandenen Bewertung ist das nur bei Auswahl einer
   einzelnen Sitzung möglich; bei Mehrfachauswahl startet der Bogen leer.
2. Für jede der 19 Bewertungsfragen eine Note von **1 (sehr gut)** bis **6 (ungenügend)**
   vergeben.
3. Optional Anmerkungen eintragen.
4. Mit **💾 Bewertung speichern** abschließen. Bei Mehrfachauswahl werden dieselben Noten und
   Anmerkungen als **eigenständige** Bewertung für jede ausgewählte Sitzung gespeichert.
   Erneutes Speichern für eine bereits bewertete Sitzung überschreibt deren vorherige
   Bewertung. Sind noch nicht alle 19 Fragen beantwortet, fragt die App vor dem Speichern
   nach ("Trotzdem speichern?" / "Abbrechen") — so bleibt die unvollständige Bewertung nicht
   versehentlich als vermeintlich fertig stehen.

### 5. Ereignisse/Probleme erfassen (optional, jederzeit möglich)

1. In den Bereich **❗ Ereignisse** wechseln, z. B. sobald Sensorik abgefallen/verrutscht ist
   oder ein anderes Problem auffällt.
2. Optional die betroffene **Teilnehmende:r** im Dropdown wählen — ohne Auswahl gilt das
   Ereignis als allgemein (kein Personenbezug).
3. Eine kurze **Beschreibung** eintragen (z. B. "Sensorik verrutscht") und eine **Kategorie**
   antippen (Standard: Sensorik, VR, Fragebogen, TMS, Sonstiges). Über **⚙ Tags** lassen sich
   Kategorien umbenennen, löschen oder neue hinzufügen.
4. **Erfassungsart** wählen:
   - **🕐 Zeitpunkt** — ein einzelner Moment. Mit **🕐 Jetzt** die aktuelle Uhrzeit
     übernehmen, oder die Uhrzeit manuell eintragen.
   - **⏱ Zeitraum** — Start und Ende. Für beide Felder jeweils **🕐 Jetzt** antippen (z. B.
     einmal beim Auftreten, einmal beim Beheben des Problems) oder die Uhrzeiten manuell
     eintragen.
5. Mit **✓ Ereignis speichern** abschließen. Das Ereignis erscheint in der Liste darunter,
   die sich nach Kategorie und Teilnehmende:r filtern lässt.
6. Ein fehlerhafter Eintrag lässt sich antippen und nach Sicherheitsabfrage löschen (kein
   separater Bearbeiten-Dialog — bei Bedarf löschen und neu erfassen).

**Hinweis:** Erfasste Ereignisse sind aktuell **nicht** Teil des CSV-/JSON-Exports — sie
lassen sich nur innerhalb der App im Tab **Ereignisse** einsehen.

### 6. Sitzung im Protokoll prüfen oder korrigieren

1. Im Bereich **Protokoll** die Liste aller Sitzungen einsehen, bei Bedarf nach Szenario
   oder Person filtern.
2. Eintrag antippen, um Details zu sehen.
3. Über **✏ Bearbeiten** lassen sich Start-/Endzeit, Szenario, Person, Abweichungen und
   Notizen nachträglich korrigieren (das Datum selbst ist nicht änderbar).
4. Über **Sitzung löschen** kann ein fehlerhafter Eintrag entfernt werden.

### 7. Am Ende der Erhebung: Export

1. Im Bereich **Export** optional ein **Geräte-/Betreuungslabel** eintragen (hilfreich, wenn
   mehrere Geräte parallel genutzt wurden).
2. Optional nach Szenario filtern.
3. **⬇ CSV exportieren** oder **⬇ JSON exportieren** antippen — die Datei wird auf dem Gerät
   gespeichert (z. B. im Download-Ordner).
4. Die exportierte Datei anschließend gemäß den Vorgaben der Studienleitung sicher
   weitergeben bzw. ablegen (dies erfolgt außerhalb der App).
5. **Erst nach erfolgreichem Export und Sicherung der Daten:** Falls gewünscht, im Bereich
   **⚙ Einstellungen** über **⚠ Alle Daten löschen** sämtliche Teilnehmenden-, Sitzungs-,
   Bewertungs- und Ereignisdaten auf diesem Gerät unwiderruflich entfernen. Die App warnt vor
   dieser Aktion — sie kann nicht rückgängig gemacht werden.

## Mehrere Geräte

Jedes Gerät führt seine eigenen, unabhängigen Daten. Es findet **keine automatische
Synchronisation** zwischen Geräten statt. Wurden mehrere Geräte parallel genutzt, muss auf
jedem Gerät einzeln exportiert werden; das Zusammenführen der Export-Dateien erfolgt
anschließend außerhalb der App (z. B. in Excel).
