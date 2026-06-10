# Domains

Domains kapseln den lesenden und schreibenden Zugriff auf externe Identitätssysteme. Jede Domain implementiert mindestens `readIdentities()` und gibt eine Liste von Identity-Objekten zurück.

## Klassenhierarchie

```
Domain (backend/src/domains/Domain.js)
│   - getIdentities()     → Cache-Logik mit Promise-basiertem Locking
│   - readIdentities()    → Muss von Subklassen implementiert werden
│   - invalidate()        → Cache verwerfen
│   - lock() / unlock()   → Verhindert Invalidierung während Sync
│   - supportedProperties → Definiert, welche Felder die Domain liefert
│
└── ManagableDomain (backend/src/domains/ManagableDomain.js)
    - addIdentity(identity)
    - changeIdentity(identity)
    - removeIdentity(identity)
```

### Caching-Verhalten

- Nach dem ersten `getIdentities()`-Aufruf werden Identitäten im Speicher gecached.
- Ein `invalidate()` verwirft den Cache und erzwingt beim nächsten Abruf ein neues `readIdentities()`.
- Während eines laufenden Sync-Vorgangs (`lock()` → `unlock()`) wird `invalidate()` aufgeschoben, um Race Conditions zu vermeiden.
- Parallele `getIdentities()`-Aufrufe teilen sich ein einziges `_fetchPromise` — es wird niemals doppelt geladen.

## Schüler-Domains (`backend/src/students/domains/`)

### ASV

- **Quelle**: PostgreSQL-Datenbank der Allgemeinen Schulverwaltung
- **Properties**: `userId`, `firstName`, `lastName`, `clazz`, `birthdate`, `gender`, `email`
- **Besonderheit**: Generiert und verwaltet Benutzer-IDs algorithmisch (Nachname + Punkt + 3 Buchstaben Vorname + optionaler Zähler)
- **Actions**: `IdGenerationTask` — erzeugt eindeutige userIds für neue Schüler

### Schulkonsole

- **Quelle**: REST-API der PaedML-Schulkonsole (mit TLS-Client-Zertifikaten)
- **Typ**: `ManagableDomain` — unterstützt Add/Change/Remove
- **Properties**: `userId`, `firstName`, `lastName`, `clazz`

### Untis

- **Quelle**: MySQL-Datenbank (Untis MultiUser)
- **Typ**: `ManagableDomain`
- **Properties**: `userId`, `firstName`, `lastName`, `clazz`
- **Actions**: `UntisGenerateImportTask` — erzeugt eine CSV-Importdatei

### WebUntis

- **Quelle**: HTTP-Scraping der WebUntis-Webanwendung (inkl. TOTP-2FA-Login)
- **Typ**: `ManagableDomain`
- **Properties**: `userId`, `firstName`, `lastName`, `clazz`, `email`
- **Besonderheiten**:
  - Login über `j_spring_security_check` mit Session-Cookie und TOTP
  - CSV-Export der Schülerliste via Report-URL
  - Formularbasiertes Setzen von Austrittsdaten
  - Erziehungsberechtigten-Sync
- **Actions**: `WebUntisSetExitDatesTask`, `WebUntisGuardianSyncTask`, `WebUntisMajorityTask`

### Nextcloud

- **Quelle**: SSH-Zugriff auf das Nextcloud-Datenverzeichnis
- **Typ**: Read-only (Liest vorhandene Home-Verzeichnisse)
- **Properties**: `userId`
- **Actions**: `NextcloudRemnantsListTask` — findet verwaiste Ordner, `NextcloudRemnantsPurgeTask` — löscht sie

### DummyDomain

- **Quelle**: MongoDB (persistierte Mock-Daten)
- **Typ**: `ManagableDomain`
- **Zweck**: Sichere Testumgebung ohne Zugriff auf reale Systeme
- **Actions**: `DummyRandomModificationsTask` — erzeugt zufällige Änderungen zum Testen

## Lehrer-Domains (`backend/src/teachers/domains/`)

### ASVTeacher

- **Quelle**: PostgreSQL (ASV-Datenbank, Lehrer-Tabellen)
- **Properties**: `userId`, `firstName`, `lastName`, `kuerzel`

### UntisTeacher

- **Quelle**: MySQL (Untis MultiUser)
- **Properties**: `userId`, `firstName`, `lastName`, `externalId`
- **Actions**: `UntisTeacherExternalIdsTask` — Synchronisiert externe IDs

### SchulkonsoleTeacher

- **Quelle**: REST-API der PaedML-Schulkonsole
- **Properties**: `userId`, `firstName`, `lastName`
- **Actions**: `MailcowTeacherInitialsTask` — Synchronisiert Kürzel aus ASV in Mailcow `custom_attributes`

### MailCowTeacher

- **Quelle**: Mailcow REST-API
- **Properties**: `userId` (Kürzel aus `custom_attributes`), `firstName`, `lastName`, `email`

## Fachnetz-Domains (`backend/src/fachnetz/domains/`)

### Fachnetz

- **Quelle**: Moodle (Fachnetz BW) via HTTP-Report-Download und REST-API
- **Properties**: `userId`, `firstName`, `lastName`, `email`, `schulname`, `schulort`
- **Actions**: `ProfileMaintenanceTask` — Pflegt Profilfelder über die Moodle-REST-API

### Arbeitsheft

- **Quelle**: XWiki REST-API (Mathe-Arbeitsheft)
- **Properties**: `userId`, `firstName`, `lastName`, `email`, `schulname`, `schulort`
- **Besonderheit**: Konvertiert Benutzernamen in XWiki-Format (Punkte werden entfernt)

## Mock-Domains (`backend/src/domains/mocks/`)

Für Tests ohne Backend-Infrastruktur. Stellt hart-kodierte Identitäten bereit und emuliert Mock-Logins über Umgebungsvariablen.

## Eine neue Domain implementieren

1. Klasse erstellen, die `Domain` oder `ManagableDomain` erweitert:

```javascript
const Domain = require('../../domains/Domain');

class MeineDomain extends Domain {
    constructor() {
        super('meine-domain');
    }

    get supportedProperties() {
        return ['userId', 'firstName', 'lastName', 'email'];
    }

    async readIdentities() {
        // Daten aus dem Quellsystem lesen
        return [{ userId: 'test', firstName: 'Max', lastName: 'Muster', email: '...' }];
    }
}
```

2. In `backend/src/<kategorie>/domains/` ablegen.

3. In der entsprechenden Kategorie-Datei `domains/index.js` exportieren.

4. In der Kategorie-JSON (`config/<kategorie>.json`) registrieren:

```json
{
  "domains": [
    { "name": "meine-domain", "titel": "Meine Domain", "category": "students", "color": "#123456" }
  ]
}
```
