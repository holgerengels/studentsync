# Deployment & Betrieb

## Docker-Architektur

Synx wird als Docker-Container ausgeliefert. Das Image enthält das Backend (Node.js) und das gebaute Frontend (statische Dateien). Die Konfiguration wird als Volume gemountet.

### Produktions-Image (Multi-Stage Build)

```dockerfile
# Stage 1: Frontend bauen
FROM node:20 as builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend + gebautes Frontend
FROM node:20
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./
COPY --from=builder /app/frontend/dist ./public
RUN mkdir -p config
EXPOSE 3001
CMD ["node", "src/server.js"]
```

### Produktions-Deployment (`deploy/docker-compose.yml`)

```yaml
services:
  app:
    image: ghcr.io/holgerengels/synx:latest
    ports:
      - "3001:3001"
    volumes:
      - ./config:/config       # Konfiguration (settings.json, *.json)
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      - mongo

  mongo:
    image: mongo:latest
    volumes:
      - mongo-data:/data/db
```

### Build & Push

```bash
cd deploy
./build_and_push.sh
```

## Datenbanken

### MongoDB (Logs & Mock-Daten)

- **Zweck**: Speicherung von Ausführungsprotokollen (SyncLog) und DummyDomain-Daten
- **URI**: Konfiguriert in `settings.json` → `mongodb.uri`
- **Standard**: `mongodb://localhost:27017/synx_logs`
- **Log-Bereinigung**: Automatisch täglich um 3:00 Uhr — `details` werden nach 14 Tagen entfernt, die Log-Metadaten (Task, Trigger, Status, Summary) bleiben erhalten

### PostgreSQL (ASV)

- **Zweck**: Lesender Zugriff auf die ASV-Datenbank
- **Port**: Konfiguriert in `settings.json` → `asv.port`

### MySQL (Untis MultiUser)

- **Zweck**: Lese-/Schreibzugriff auf die Untis-Datenbank
- **Port**: Konfiguriert in `settings.json` → `untis.port`

## Authentifizierung

### LDAP

Synx authentifiziert Benutzer gegen einen LDAP-Server (Active Directory der PaedML):

- **Bind**: Service-Account (`binddn` / `bindpw`) für Gruppenabfragen
- **User-Auth**: Benutzer wird mit DN + Passwort authentifiziert
- **Gruppen**: Nur Mitglieder konfigurierter `allowedGroups` erhalten Zugriff
- **Kategoriefilter**: Pro Kategorie kann der Zugriff auf bestimmte Gruppen oder einzelne User eingeschränkt werden

### JWT

- **Access Token**: Kurzlebig, wird bei jedem API-Call im `Authorization`-Header mitgesendet
- **Refresh Token**: Langlebig, ermöglicht Erneuerung des Access Tokens ohne erneuten Login

## Netzwerk

### Externe Systeme

Synx muss netzwerktechnisch folgende Systeme erreichen können:

| System | Protokoll | Bemerkung |
|:---|:---|:---|
| ASV | PostgreSQL (TCP) | Lokales Netzwerk |
| Untis MultiUser | MySQL (TCP) | Lokales Netzwerk |
| WebUntis | HTTPS | Playground oder Produktions-URL |
| Schulkonsole | HTTPS + TLS Client Cert | Internes Netzwerk (PaedML) |
| LDAP/AD | LDAPS (TCP 636) | Internes Netzwerk |
| Mailcow | HTTPS | Eigener Server |
| Moodle | HTTPS | Externes System (ZSL) |
| XWiki | HTTPS | Externes System (ZSL) |
| Nextcloud | SSH | Eigener Server |

### TLS/SSL

Für interne Server mit selbstsignierten Zertifikaten wird ein TrustStore konfiguriert (`ldap.trustStore`, `schulkonsole.trustStore`).

### Docker Networking

Im Docker-Container wird `host.docker.internal:host-gateway` als Extra-Host konfiguriert, um auf Services auf dem Docker-Host zugreifen zu können.

## Reverse Proxy (Nginx)

Für die Produktionsumgebung empfiehlt sich ein Nginx-Reverse-Proxy vor dem Synx-Container:

- SSL-Terminierung
- WebSocket-Support (für zukünftige Live-Updates)
- Weiterleitung auf Port 3001

## Monitoring

### Logs-Seite

Das Frontend bietet eine dedizierte Logs-Seite, die alle Ausführungen mit Status, Trigger, Dauer und HTML-Summary anzeigt. Filterbar und paginiert.

### Health-Check

```
GET /api/health → { "status": "ok" }
```

### Konsolen-Logs

Das Backend loggt alle Operationen mit Prefix-Tags (`[Domain]`, `[TaskManager]`, `[HookRunner]`, etc.) auf stdout.
