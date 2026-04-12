studentsync wurde von Grund auf neu entwickelt und heißt nun synx. Diese Spezifikation beschreibt die final implementierte Architektur.

Technologien:

* Backend node.js (Express)
* Frontend vue.js mit Komponenten von @[awesome.me/webawesome](http://awesome.me/webawesome)
* Design und App-Shell basieren 1:1 auf dem Projekt [https://github.com/holgerengels/tix](https://github.com/holgerengels/tix) (Responsives Sidebar-Layout mit dynamischem Overlay und Tix-Farbwelt).
* Authentifizierung voll nativ integriert gegen LDAP (Analog zu Tix, inkl. Refresh-Cookies und Session-Management).
* Log-Persistenz und Dummy/Mock-Datenspeicherung in MongoDB via Mongoose. Die Datenbank ist über `docker-compose` bereitgestellt.

Verzeichnisstruktur:

* backend/src (beinhaltet models/, domains/, tasks/, routes/)
* backend/tests  
* frontend/src (beinhaltet views/, router/, App.vue Layouts)
* frontend/tests  
* config (JSON-Definitionen)
* deploy

Architektur:

* Die **Identities** (Klasse Identity): Besitzen userId, firstName, lastName, …. Die `userId` (Account-Name) identifiziert eine Identity eindeutig.  
* Die **Domains** (Basisklasse Domain: ASV, Untis, WebUntis, Schulkonsole, Dummy): 
    * Stellen die Methode `getIdentities()` bereit, welche intern `readIdentities()` (oft via Cache) aufruft. 
    * `invalidate()` forciert einen sofortigen neuen Abruf (Refresh).
* Abgeleitet von Domain ist **ManagableDomain**. Diese schreibt Daten aktiv über `addIdentity`, `changeIdentity`, und `removeIdentity`. 
    * Komplexe HTTP-Automatisierungen (z.B. das WebUntis Austrittsdatum Form-Scraping über Tokens) sind nativ hier eingekapselt.
* Die **Diff-Klasse**: Vergleicht Source und Target basierend auf überschneidenden Feldern und clustert identifizierte Schüler in `added`, `changed`, und `removed`.
* Die universelle **Task Execution Engine** (`/api/execute/:taskName`):
    * Jeder Task (`DiffTask`, `SyncTask`, `IdGenerationTask`, `WebUntisSetExitDatesTask`) wird über dieselbe API ausgeführt und vom Backend via Name gemappt.
    * Tasks erzeugen einen Report und rendern ihr Ergebnis selbsttätig über eine `summarize()` oder `format()` Funktion im UI.
    * **SyncTask** gleicht gefundene Unterschiede durch Methodensaufrufe in der Target-Domain aus.
* Die Ausführung kann manuell per Dashboard-Klick oder automatisch über den integrierten Cron-Scheduler erfolgen.
* **Revision & Logging**: Jede manuelle oder zeitgesteuerte Ausführung eines schreibenden Tasks speichert einen permanenten JSON-Datensatz (`SyncLog`) passgenau via Mongoose in der MongoDB. Dabei werden exakte UserID-Arrays protokolliert, um jederzeit Audit-Trails der betroffenen Schüler einsehen zu können.
* **Safety DevMode**: Wenn `devMode: true` aktiv ist (Standard in Non-Prod), greift eine harte Firewall in ausführenden Tasks, die jede Mutations-Schleife (Sync, ExitDates) strikt nach maximal *einem* Datensatz abbricht.

Die App-Shell und UI:

Die Nutzeroberfläche ist eng nach dem Vorbild von Tix gegossen (permanente Sidebar am Desktop, Overlay-Drawer via Hamburger-Menu am Smartphone).
Zentraler Einstiegspunkt ist das **Dashboard**, das vollgenerisch pro Domain und pro ASV-Diff eine interaktive Karte aufbaut. Die Karten beinhalten direkte Action-Buttons mit Live-Rotatoren für Syncs, Data-Generators und Neu-Laden Calls. HTML-Ergebnisse des Backends werden sofort fließend pro Karte gerendert. 
Eine dedizierte historische Log-Seite bereitet die MongoDB SyncLogs visuell und filterbar tabellarisch auf.
Unterseiten (`/domain/:name` und `/diff/:name`) listen alle betroffenen Identities tabellarisch, reaktiv suchbar (inklusive globalem `@klasse` Filter) für tausende Entries performant auf.

Konfiguration (JSON-Driven):

Das gesamte System ist durch drei Konfigurationsdateien im Ordner `/config` flexibel definierbar:
* `default.json` registriert die Domains, die möglichen Mapping-Diffs (Wer against Wen), Tasks und baut darauf basierend das Frontend-Mapping der Aktions-Buttons dynamisch auf.
* `settings.json` dient den Umgebungsvariablen und Restriktionen (z.B. MongoDB Uri, Log-Limits, `devMode` Flag).
* `test.json` deklariert spezielle Entwicklersandboxen wie die `DummyDomain` und deren `DummyRandomModificationsTask` um gefahrlos im Testbetrieb Daten zu wirbeln.