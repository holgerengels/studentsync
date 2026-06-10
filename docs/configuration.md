# Konfiguration

Das gesamte System ist durch JSON-Dateien im `/config`-Verzeichnis konfiguriert. Das Laden und Zusammenführen der Konfiguration erfolgt in `backend/src/config.js`.

## Lade-Reihenfolge

```
1. settings.json       ← Zugangsdaten, Server-Infrastruktur
2. config.json         ← Runtime-Overrides (devMode, Schuljahr, Mappings, Hooks)
3. *.json (auto)       ← Kategorie-Dateien (students.json, teachers.json, fachnetz.json, ...)
4. test.json           ← Test-Overlay (DummyDomain, Test-Tasks)
```

Jede Stufe wird via **Deep Merge** überlagert. Array-Elemente mit gleichem `name`-Feld werden zusammengeführt statt dupliziert.

## settings.json — Infrastruktur & Zugangsdaten

Enthält alle Verbindungsdaten zu externen Systemen. Diese Datei ist **nicht** im Repository und wird pro Umgebung bereitgestellt.

```json
{
  "settings": {
    "server": {
      "ldap": {
        "url": "ldap://...",
        "binddn": "CN=...",
        "bindpw": "...",
        "basedn": "DC=...",
        "allowedGroups": ["Netzwerkteam", "Abteilungsleitung"]
      },
      "jwtSecret": "...",
      "refreshJwtSecret": "..."
    }
  },
  "mongodb": { "uri": "mongodb://..." },
  "asv": { "host": "...", "port": 5433, ... },
  "untis": { "host": "...", "port": 3307, ... },
  "webuntis": { "url": "https://...", "user": "...", "secret": "..." },
  "schulkonsole": { "apiURL": "https://...", ... },
  "mailcow": { "apiURL": "https://...", "apiKey": "..." },
  "moodle": { "url": "https://...", "servicetoken": "..." },
  "xwiki": { "url": "https://...", ... },
  "nextcloud": { "host": "...", ... }
}
```

## config.json — Runtime-Konfiguration

Globale Einstellungen, die das Laufzeitverhalten steuern:

```json
{
  "settings": {
    "devMode": true
  },
  "asv": {
    "schuljahr": "2025/26"
  },
  "untis": {
    "schuljahr": "20252026",
    "emailDomain": "valckenburgschule.de"
  },
  "categories": [
    {
      "name": "students",
      "label": "Schüler*innen",
      "search": ["userId", "firstName", "lastName"],
      "filter": ["clazz"],
      "access": [
        { "group": "Abteilungsleitung" },
        { "group": "Netzwerkteam" }
      ]
    }
  ],
  "hooks": [
    {
      "task": "asv-untis-sync",
      "script": "asv-untis",
      "condition": "true",
      "action": "maintainTicket"
    }
  ],
  "classMapping": [
    { "H11": "H123" },
    { "H12": "H123" }
  ]
}
```

### Kategorien

| Feld | Typ | Beschreibung |
|:---|:---|:---|
| `name` | string | Interner Bezeichner (entspricht dem Verzeichnis in `backend/src/`) |
| `label` | string | Anzeigename im Frontend |
| `search` | string[] | Felder für die Volltextsuche |
| `filter` | string[] | Felder für `@`-Filterung |
| `access` | object[] | Zugriffsregeln (`{ group: "..." }` oder `{ user: "..." }`) |

### Hooks

| Feld | Typ | Beschreibung |
|:---|:---|:---|
| `task` | string | Name des Tasks, nach dessen Ausführung der Hook greift |
| `script` | string | Dateiname (ohne `.js`) im `/config`-Verzeichnis |
| `condition` | string | Name der exportierten Funktion, die `true`/`false` zurückgibt |
| `action` | string | Name der exportierten Funktion, die bei erfüllter Bedingung ausgeführt wird |

Hook-Skripte werden in einer Node.js `vm`-Sandbox ausgeführt, haben aber Zugriff auf `require`, `console`, `fs`, `path` und `process`.

## Kategorie-Dateien — Domain/Diff/Task-Definitionen

Jede JSON-Datei im `/config`-Verzeichnis (außer `settings.json`, `config.json`, `test.json`) wird automatisch als Kategorie-Datei erkannt und enthält drei Arrays:

### `domains` — Registrierte Domains

```json
{
  "name": "asv",
  "titel": "ASV",
  "category": "students",
  "color": "#00457D",
  "actions": [
    {
      "name": "IDs generieren",
      "run": "asv-generate-ids"
    }
  ]
}
```

| Feld | Typ | Beschreibung |
|:---|:---|:---|
| `name` | string | Interner Name, muss mit der Domain-Implementierung übereinstimmen |
| `titel` | string | Anzeigename auf der Dashboard-Karte |
| `category` | string | Zugehörige Kategorie |
| `color` | string | Farbe der Dashboard-Karte (Hex) |
| `actions` | object[] | Action-Buttons auf der Karte (`run` = Task-Name, `download` = Download-Task) |

### `diffs` — Definierte Vergleiche

```json
{
  "name": "asv-schulkonsole",
  "titel": "ASV → Schulkonsole",
  "category": "students",
  "source": "ASV",
  "target": "Schulkonsole"
}
```

Optional können `sourceDomain` und `targetDomain` gesetzt werden, wenn der Domain-Name vom Diff-Label abweicht (z.B. bei Lehrkraft-Domains: `asv-teacher` statt `ASV`).

### `tasks` — Registrierte Tasks

```json
{
  "name": "asv-schulkonsole-sync",
  "titel": "Sync",
  "class": "SyncTask",
  "source": "ASV",
  "target": "Schulkonsole",
  "schedule": "0 2 * * *"
}
```

| Feld | Typ | Beschreibung |
|:---|:---|:---|
| `name` | string | Interner Name (wird in API und Registry verwendet) |
| `class` | string | Klasse der Task-Implementierung |
| `schedule` | string | Optionaler Cron-Ausdruck für automatische Ausführung |

## test.json — Test-Overlay

Fügt die DummyDomain und Test-Tasks hinzu. Wird als letztes geladen und kann bestehende Einträge überschreiben.

```json
{
  "domains": [
    {
      "name": "dummy",
      "titel": "Dummy",
      "category": "students",
      "actions": [
        { "name": "Zufällige Änderungen", "run": "dummy-random-modifications" }
      ]
    }
  ],
  "diffs": [
    {
      "name": "asv-dummy",
      "titel": "ASV → Dummy",
      "category": "students",
      "source": "ASV",
      "target": "Dummy"
    }
  ]
}
```

## Zusätzliche Dateien im Config-Verzeichnis

| Datei | Zweck |
|:---|:---|
| `schulen.csv` | CSV-Mapping von Schulnummern zu Schulnamen und -orten |
| `andere.csv`, `ausser.csv` | Zusätzliche Zuordnungslisten für Domain-spezifische Logik |
| `asv-untis.js` | Hook-Skript für automatische Tix-Ticket-Erstellung |
