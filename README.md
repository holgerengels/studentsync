# Synx — Identity Synchronization Platform

Synx ist eine Identity-Synchronisationsplattform für Schulen. Das System gleicht Benutzeridentitäten (Schüler:innen, Lehrkräfte) automatisiert zwischen verschiedenen Systemen ab und synchronisiert Unterschiede.

## Was kann Synx?

- **Multi-Domain Identity Management**: Liest Identitäten aus unterschiedlichen Systemen (ASV, Untis, WebUntis, Schulkonsole, Nextcloud, Mailcow, Moodle, XWiki) und stellt sie vereinheitlicht dar.
- **Automatischer Diff & Sync**: Vergleicht Identitäten zwischen Quell- und Zieldomains automatisch und synchronisiert Unterschiede per Klick oder zeitgesteuert.
- **Kategoriebasiert**: Organisiert Domains in Kategorien (z.B. Schüler, Lehrkräfte, Fachnetz) mit eigener Zugriffsberechtigung.
- **DevMode-Sicherung**: In Nicht-Produktionsumgebungen werden schreibende Operationen automatisch auf maximal einen Datensatz begrenzt.
- **Audit-Logging**: Jede Ausführung (manuell oder per Cron) wird mit vollständigem Detail in MongoDB protokolliert.
- **Hooks**: Post-Task-Hooks ermöglichen die Integration mit externen Systemen (z.B. automatische Tix-Ticket-Erstellung bei manuellem Sync-Bedarf).
- **Investigate**: Domainübergreifende Identitätssuche innerhalb einer Kategorie.

## Technologie-Stack

| Schicht       | Technologie                        |
|:------------- |:---------------------------------- |
| **Backend**   | Node.js, Express                   |
| **Frontend**  | Vue.js 3, Web Awesome Components   |
| **Datenbank** | MongoDB (Mongoose) für Logs        |
| **Auth**      | LDAP, JWT + Refresh-Token          |
| **Scheduling**| node-cron                          |
| **Deployment**| Docker (Multi-Stage Build)         |

## Architektur im Überblick

```
┌─────────────────────────────────────────────────┐
│                   Frontend (Vue 3)              │
│   Dashboard · Domain Views · Diff Views · Logs  │
└────────────────────┬────────────────────────────┘
                     │  REST API (/api)
┌────────────────────▼────────────────────────────┐
│                 Backend (Express)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Domains  │ │  Tasks   │ │  TaskManager     │ │
│  │ Registry │ │ Registry │ │  (Cron Scheduler)│ │
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │
│       │             │                │           │
│  ┌────▼─────────────▼────────────────▼─────────┐ │
│  │          Task Execution Engine              │ │
│  │  taskRunner → Logger → hookRunner           │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
         │                          │
    ┌────▼────┐               ┌─────▼─────┐
    │ Externe │               │  MongoDB  │
    │ Systeme │               │  (Logs)   │
    └─────────┘               └───────────┘
```

## Erweiterbarkeit

Synx ist vollständig konfigurationsgetrieben und modular erweiterbar:

- **Neue Domain hinzufügen**: Eine Klasse erstellen, die `Domain` (lesend) oder `ManagableDomain` (schreibend) erweitert, in `domains/index.js` registrieren und in der Kategorie-JSON konfigurieren.
- **Neue Kategorie hinzufügen**: Eine JSON-Datei im `/config`-Verzeichnis anlegen – wird automatisch entdeckt.
- **Neue Tasks definieren**: Task-Klasse implementieren (`Task`, `DiffTask` oder `SyncTask` erweitern), registrieren und in der Kategorie-JSON deklarieren.
- **Hooks**: Post-Task-Logik als JavaScript-Dateien im `/config`-Verzeichnis, konfiguriert via `hooks`-Array in `config.json`.

## Verzeichnisstruktur

```
synx/
├── backend/src/
│   ├── domains/          # Basis-Klassen (Domain, ManagableDomain)
│   ├── tasks/            # Basis-Klassen (Task, DiffTask, SyncTask)
│   ├── students/         # Schüler-spezifische Domains & Tasks
│   ├── teachers/         # Lehrer-spezifische Domains & Tasks
│   ├── fachnetz/         # Fachnetz-spezifische Domains & Tasks
│   ├── models/           # Mongoose Models (Log)
│   ├── utils/            # Hilfsfunktionen (devMode, logger, hookRunner, ...)
│   ├── routes.js         # REST API-Endpunkte
│   ├── config.js         # Konfigurationslade-Logik
│   ├── auth.js           # LDAP-Authentifizierung
│   ├── server.js         # Express Server Entry Point
│   └── TaskManager.js    # Cron Scheduler
├── frontend/src/
│   ├── views/            # Dashboard, Domain/Diff Views, Logs, Login
│   ├── components/       # DomainCard, DiffCard, RemnantsDialog, ...
│   ├── stores/           # Pinia Stores (Auth, RequestQueue)
│   ├── composables/      # Vue Composables
│   └── App.vue           # App Shell mit Sidebar-Navigation
├── config/               # JSON-Konfiguration (auto-discovered)
├── deploy/               # Docker-Deployment
└── docker-compose.yml    # Lokale Entwicklungs-Datenbanken
```

## Dokumentation

Detaillierte Dokumentation befindet sich im [`docs/`](docs/) Verzeichnis:

- [**Architektur**](docs/architecture.md) — Systemschichten, Datenfluss und Kernkonzepte
- [**Konfiguration**](docs/configuration.md) — JSON-Konfigurationssystem und Kategorie-Definitionen
- [**Domains**](docs/domains.md) — Domain-Hierarchie und vorhandene Implementierungen
- [**Tasks**](docs/tasks.md) — Task-System, DiffTask, SyncTask und spezialisierte Tasks
- [**Deployment & Betrieb**](docs/deployment.md) — Docker-Setup, Datenbanken und Produktionsbetrieb
- [**Entwicklung**](docs/development.md) — Lokales Setup, DevMode, Tests und neue Domains/Tasks anlegen

## Lizenz

MIT