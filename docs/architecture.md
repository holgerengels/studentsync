# Architektur

## Systemschichten

Synx ist als klassische Client-Server-Anwendung aufgebaut. Das Frontend kommuniziert über eine REST-API mit dem Backend, das seinerseits Identitätsdaten aus diversen externen Systemen liest und schreibt.

| Schicht | Technologie | Aufgabe |
|:---|:---|:---|
| **Frontend** | Vue 3, Web Awesome Components | Dashboard mit Domain-Karten, Diff-Ansichten, Log-Historie und Investigate-Funktion |
| **Backend** | Node.js, Express | REST-API, Domain-Abstraktion, Task-Ausführung, Cron-Scheduling |
| **Authentifizierung** | LDAP, JWT | Native LDAP-Authentifizierung mit JWT Access-Token und Refresh-Token |
| **Persistenz** | MongoDB (Mongoose) | Ausführungsprotokolle (SyncLogs), Mock-Daten |
| **Externe Systeme** | PostgreSQL, MySQL, HTTP/REST, SSH | ASV (PostgreSQL), Untis (MySQL), WebUntis (HTTP-Scraping), Schulkonsole (REST), Nextcloud (SSH), Mailcow (REST), Moodle (REST), XWiki (REST) |

## Kernkonzepte

### Identity

Die zentrale Dateneinheit in Synx. Jede Identity repräsentiert eine Person (Schüler:in, Lehrkraft, Account) mit mindestens den Feldern:

- `userId` — Eindeutiger Bezeichner (Account-Name)
- `firstName` — Vorname
- `lastName` — Nachname

Je nach Domain werden weitere Felder unterstützt (z.B. `clazz`, `email`, `birthdate`). Die `supportedProperties` einer Domain definieren, welche Felder sie liefert.

### Kategorie

Kategorien gruppieren zusammengehörige Domains und definieren:

- **Suchfelder** (`search`): Welche Felder in der Volltextsuche berücksichtigt werden
- **Filterfelder** (`filter`): Felder für spezielle `@`-Filter (z.B. `@GYM11` filtert nach Klasse)
- **Zugriffsrechte** (`access`): Welche LDAP-Gruppen oder einzelne User Zugriff haben

Aktuell existieren drei Kategorien:
- `students` — Schüler*innen
- `teachers` — Lehrer*innen
- `fachnetz` — Fachnetz/Arbeitsheft Accounts

### Domain

Domains kapseln den Zugriff auf externe Systeme. Die Klassenhierarchie:

```
Domain (Basis, read-only)
  └── ManagableDomain (schreibend: add, change, remove)
```

**Caching**: Jede Domain cached ihre Identitäten nach dem ersten Abruf. Über `invalidate()` wird der Cache verworfen. Der Cache ist Thread-safe über ein Promise-basiertes Locking (`_fetchPromise`) und einen `lock()`/`unlock()`-Mechanismus, der verhindert, dass der Cache während eines laufenden Sync-Vorgangs invalidiert wird.

### Diff

Der Diff-Algorithmus vergleicht Source- und Target-Domain anhand der *Schnittmenge* ihrer `supportedProperties`. Ergebnis:

- **added** — In Source vorhanden, in Target nicht
- **changed** — In beiden vorhanden, aber mit unterschiedlichen Feldwerten
- **removed** — In Target vorhanden, in Source nicht
- **unchanged** — Identisch in beiden Systemen

### Task Execution Engine

Die zentrale Pipeline für alle Operationen:

```
Frontend/Cron
    │
    ▼
taskRunner.runTask(taskName, trigger, params)
    │
    ├── logger.startTask()       ← Log-Eintrag anlegen
    ├── task.execute(params)     ← Task ausführen
    ├── task.summarize(result)   ← HTML-Summary erzeugen
    ├── logger.endTask()         ← Log abschließen
    └── hookRunner.runHooks()    ← Post-Task-Hooks ausführen
```

Jeder Task erzeugt einen Report, den er über `format()` / `summarize()` als HTML-Snippet für die Anzeige im Frontend aufbereitet.

## Datenfluss eines Sync-Vorgangs

```
1. User klickt "Sync" auf einer DiffCard im Dashboard
       │
2. POST /api/sync/:source/:target
       │
3. SyncTask.execute()
   ├── DiffTask.execute()     ← Diff berechnen
   │   ├── sourceDomain.getIdentities()
   │   └── targetDomain.getIdentities()
   ├── DevMode-Limit prüfen   ← Max 1 Operation wenn devMode aktiv
   ├── targetDomain.lock()
   ├── Für jedes added:   targetDomain.addIdentity()
   ├── Für jedes changed: targetDomain.changeIdentity()
   ├── Für jedes removed: targetDomain.removeIdentity()
   └── targetDomain.unlock()
       │
4. Report → Logger → Hooks → Response an Frontend
```

## REST API

| Methode | Endpunkt | Beschreibung |
|:---|:---|:---|
| `POST` | `/api/login` | LDAP-Authentifizierung |
| `POST` | `/api/refresh` | Token-Refresh |
| `GET` | `/api/config/ui` | Konfiguration (gefiltert nach User-Berechtigung) |
| `GET` | `/api/identities/:domain` | Identitäten einer Domain (mit Suche, Filter, Sort, Pagination) |
| `GET` | `/api/investigate/:category/:id` | Identity-Lookup über alle Domains einer Kategorie |
| `POST` | `/api/diff/:source/:target` | Diff berechnen |
| `POST` | `/api/sync/:source/:target` | Sync ausführen |
| `POST` | `/api/execute/:taskName` | Beliebigen registrierten Task ausführen |
| `GET` | `/api/logs` | Ausführungsprotokolle abrufen |

## Frontend-Architektur

Die UI ist nach dem Vorbild des Tix-Systems aufgebaut:

- **App Shell**: Responsives Sidebar-Layout (permanente Sidebar am Desktop, Overlay-Drawer auf Mobile)
- **Dashboard**: Automatisch generierte Domain-Karten und Diff-Karten pro Kategorie mit Action-Buttons und Live-Statusanzeige
- **Domain Views**: Tabellarische Identity-Listen mit Volltextsuche und `@`-Filter
- **Diff Views**: Detailansicht mit Added/Changed/Removed Clustering
- **Logs**: Historische Ansicht aller Ausführungen mit Status, Dauer und HTML-Summary
- **Investigate**: Domainübergreifende Identity-Suche in der Navigation
