# Tasks

Tasks sind die Ausführungseinheiten in Synx. Jeder Task implementiert eine `execute()`-Methode und erzeugt einen Report, der über `format()` / `summarize()` als HTML für das Frontend aufbereitet wird.

## Klassenhierarchie

```
Task (backend/src/tasks/Task.js)
│   - execute(parameters)    → Muss von Subklassen implementiert werden
│   - format(report)         → HTML-Rendering des Reports
│   - summarize(report)      → Kurzfassung (Standard: delegiert an format())
│
├── DiffTask (backend/src/tasks/DiffTask.js)
│   - Vergleicht zwei Domains anhand der Schnittmenge ihrer supportedProperties
│   - Erzeugt Report mit added/changed/removed/unchanged
│   - Überschreibbar: getSourceIdentities(), getTargetIdentities()
│
└── SyncTask (backend/src/tasks/SyncTask.js)
    - Erweitert DiffTask: führt Diff aus, dann schreibende Operationen
    - Respektiert DevMode-Limit (max. 1 Operation pro Kategorie)
    - Nutzt lock()/unlock() auf der Target-Domain
```

## Ausführungsmodelle

### Manuelle Ausführung

Über die REST-API:

```
POST /api/execute/:taskName        → Allgemeiner Task
POST /api/diff/:source/:target     → Diff berechnen (read-only, kein Logging)
POST /api/sync/:source/:target     → Sync ausführen (mit Logging)
```

### Automatische Ausführung (Cron)

Tasks mit einem `schedule`-Feld in der Konfiguration werden vom `TaskManager` als Cron-Job registriert:

```json
{
  "name": "asv-generate-ids",
  "schedule": "0 2 * * *"
}
```

Der TaskManager unterstützt auch Legacy-Format (`"HH:MM"` → wird automatisch zu `"MM HH * * *"` konvertiert).

### System-Jobs

Der TaskManager registriert automatisch einen `log-cleanup`-Job (täglich 3:00 Uhr), der die `details` alter Log-Einträge (> 14 Tage) entfernt.

## Task-Pipeline (taskRunner)

Jede Task-Ausführung durchläuft den zentralen `taskRunner`:

```
runTask(taskName, trigger, params)
│
├── 1. Task aus Registry laden
├── 2. Logger: Log-Eintrag mit Status IN_PROGRESS anlegen
├── 3. task.execute(params)
├── 4. task.summarize(result) → HTML-Summary erzeugen
├── 5. Logger: Log-Eintrag mit Status SUCCESS/ERROR abschließen
└── 6. hookRunner: Post-Task-Hooks ausführen
```

## DevMode-Sicherung

> **Kritisch**: Wenn `devMode: true` aktiv ist (Standard in Nicht-Produktionsumgebungen), werden alle schreibenden Operationen in `SyncTask` auf maximal **einen Datensatz** begrenzt.

Die zentrale `devMode`-Utility (`backend/src/utils/devMode.js`) bietet:

- `isDevMode()` — Prüft `config.settings.devMode` und `NODE_ENV`
- `limitInDevMode(items)` — Begrenzt Arrays auf 1 Element im DevMode
- `devModeSuffix(isActive)` — Fügt `[DEV MODE LIMIT]` Badge an HTML an

DevMode ist aktiv wenn:
1. `NODE_ENV !== 'production'` (Standard), ODER
2. `config.settings.devMode === true` (Config-Override hat Vorrang)

## Schüler:innen-Tasks (`backend/src/students/tasks/`)

| Task | Klasse | Beschreibung |
|:---|:---|:---|
| `asv-generate-ids` | `IdGenerationTask` | Generiert eindeutige Benutzer-IDs aus ASV-Daten (Nachname.Vorname + Zähler) |
| `asv-schulkonsole-diff` | `DiffTask` | Vergleich ASV ↔ Schulkonsole |
| `asv-schulkonsole-sync` | `SyncTask` | Synchronisiert Schulkonsole mit ASV-Daten |
| `asv-untis-sync` | `SyncTask` | Synchronisiert Untis mit ASV-Daten |
| `asv-webuntis-sync` | `SyncTask` | Synchronisiert WebUntis mit ASV-Daten |
| `web-untis-set-exit-dates` | `WebUntisSetExitDatesTask` | Setzt Austrittsdaten in WebUntis für entfernte Schüler:innen |
| `web-untis-guardian-sync` | `WebUntisGuardianSyncTask` | Synchronisiert Erziehungsberechtigte in WebUntis |
| `web-untis-majority` | `WebUntisMajorityTask` | Markiert volljährige Schüler:innen in WebUntis |
| `untis-generate-import` | `UntisGenerateImportTask` | Erzeugt CSV-Importdatei für Untis |
| `nextcloud-remnants-list` | `NextcloudRemnantsListTask` | Listet verwaiste Nextcloud-Verzeichnisse |
| `nextcloud-remnants-purge` | `NextcloudRemnantsPurgeTask` | Löscht verwaiste Nextcloud-Verzeichnisse |
| `dummy-random-modifications` | `DummyRandomModificationsTask` | Erzeugt zufällige Änderungen in der DummyDomain (Test) |

## Lehrer-Tasks (`backend/src/teachers/tasks/`)

| Task | Klasse | Beschreibung |
|:---|:---|:---|
| `untis-teacher-external-ids` | `UntisTeacherExternalIdsTask` | Synchronisiert externe IDs in der Untis-Lehrertabelle |
| `mailcow-teacher-initials` | `MailcowTeacherInitialsTask` | Schreibt Lehrer:innen-Kürzel in Mailcow `custom_attributes` |

## Fachnetz-Tasks (`backend/src/fachnetz/tasks/`)

| Task | Klasse | Beschreibung |
|:---|:---|:---|
| `fachnetz-arbeitsheft-diff` | `FachnetzArbeitsheftDiffTask` | Diff mit spezieller UserId-Transformation (XWiki-Format) |
| `fachnetz-arbeitsheft-sync` | `FachnetzArbeitsheftSyncTask` | Sync mit spezieller UserId-Transformation |
| `fachnetz-profile-maintenance` | `ProfileMaintenanceTask` | Pflegt Profilfelder in Moodle über die REST-API |

## DomainMap (`backend/src/fachnetz/tasks/DomainMap.js`)

Hilfssystem für die Fachnetz-Kategorie: Lädt CSV-Zuordnungslisten (E-Mail-Domain → Schulnamen/Orte) und stellt sie den Tasks als Lookup-Map bereit. Nutzt den zentralen `csvParser` (`backend/src/utils/csvParser.js`).

## Hooks

Nach jeder Task-Ausführung prüft der `hookRunner`, ob Hooks für den ausgeführten Task konfiguriert sind. Hook-Skripte werden in einer `vm`-Sandbox ausgeführt.

**Beispiel**: Der `asv-untis`-Hook erstellt nach jedem `asv-untis-sync` automatisch ein Tix-Ticket, wenn manuelle Aktionen erforderlich sind (hinzufügen, löschen, Klassenwechsel). Sind keine Änderungen nötig, werden offene Tickets automatisch geschlossen.

## Einen neuen Task implementieren

1. Task-Klasse erstellen:

```javascript
const Task = require('../../tasks/Task');

class MeinTask extends Task {
    constructor() {
        super('mein-task');
    }

    async execute(parameters = {}) {
        // Logik implementieren
        return {
            success: true,
            details: { updated: [...], errors: [] }
        };
    }

    format(report) {
        // HTML-Rendering für Dashboard-Karte
        return `<div>Aktualisiert: ${report.details.updated.length}</div>`;
    }
}
```

2. In `backend/src/<kategorie>/tasks/` ablegen und in `tasks/index.js` exportieren.

3. In der Kategorie-JSON registrieren:

```json
{
  "tasks": [
    { "name": "mein-task", "titel": "Mein Task", "class": "MeinTask" }
  ]
}
```
