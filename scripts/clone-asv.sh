#!/usr/bin/env bash
#
# clone-asv.sh — Kopiert die produktive ASV-Datenbank (PostgreSQL) in die lokale Docker-Instanz.
#
# Verwendung:
#   ./scripts/clone-asv.sh --host <HOST> --port <PORT> --db <DB> --user <USER> --password <PASSWORD>
#
# Die lokale Zieldatenbank wird über docker-compose bereitgestellt (synx_postgres, Port 5433).
#

set -euo pipefail

# --- Defaults ---
REMOTE_HOST=""
REMOTE_PORT="5432"
REMOTE_DB=""
REMOTE_USER=""
REMOTE_PASSWORD=""

LOCAL_HOST="127.0.0.1"
LOCAL_PORT="5433"
LOCAL_DB="asv"
LOCAL_USER="postgres"
LOCAL_PASSWORD="synx"

# --- Argument parsing ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)      REMOTE_HOST="$2";     shift 2 ;;
    --port)      REMOTE_PORT="$2";     shift 2 ;;
    --db)        REMOTE_DB="$2";       shift 2 ;;
    --user)      REMOTE_USER="$2";     shift 2 ;;
    --password)  REMOTE_PASSWORD="$2"; shift 2 ;;
    *)
      echo "Unbekanntes Argument: $1" >&2
      echo "Verwendung: $0 --host HOST --port PORT --db DB --user USER --password PASSWORD" >&2
      exit 1
      ;;
  esac
done

# --- Validierung ---
if [[ -z "$REMOTE_HOST" || -z "$REMOTE_DB" || -z "$REMOTE_USER" || -z "$REMOTE_PASSWORD" ]]; then
  echo "Fehler: --host, --db, --user und --password sind erforderlich." >&2
  echo "Verwendung: $0 --host HOST [--port PORT] --db DB --user USER --password PASSWORD" >&2
  exit 1
fi

echo "=== ASV-Datenbank klonen ==="
echo "  Quelle:  ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}/${REMOTE_DB}"
echo "  Ziel:    ${LOCAL_USER}@${LOCAL_HOST}:${LOCAL_PORT}/${LOCAL_DB}"
echo ""

# --- Prüfe ob lokaler Container läuft ---
if ! docker ps --format '{{.Names}}' | grep -q '^synx_postgres$'; then
  echo "Fehler: Container 'synx_postgres' läuft nicht. Starte ihn mit: docker compose up -d postgres" >&2
  exit 1
fi

# --- Lokale Datenbank leeren und neu erstellen ---
echo "→ Lokale Datenbank '${LOCAL_DB}' wird zurückgesetzt …"

# Verbindungen zur DB trennen und DB neu erstellen
PGPASSWORD="$LOCAL_PASSWORD" psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${LOCAL_DB}' AND pid <> pg_backend_pid();" \
  2>/dev/null || true

PGPASSWORD="$LOCAL_PASSWORD" psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -d postgres -c \
  "DROP DATABASE IF EXISTS \"${LOCAL_DB}\";"

PGPASSWORD="$LOCAL_PASSWORD" psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -d postgres -c \
  "CREATE DATABASE \"${LOCAL_DB}\";"

# --- Datenbankgröße ermitteln ---
echo "→ Ermittle Größe der Remote-Datenbank …"
DB_SIZE_BYTES=$(PGPASSWORD="$REMOTE_PASSWORD" psql -h "$REMOTE_HOST" -p "$REMOTE_PORT" -U "$REMOTE_USER" \
  -d "$REMOTE_DB" -tAc "SELECT pg_database_size(current_database());" 2>/dev/null || echo "0")
DB_SIZE_BYTES="${DB_SIZE_BYTES//[[:space:]]/}"

if [[ "$DB_SIZE_BYTES" -gt 0 ]] 2>/dev/null; then
  DB_SIZE_HUMAN=$(numfmt --to=iec-i --suffix=B "$DB_SIZE_BYTES" 2>/dev/null || echo "${DB_SIZE_BYTES} Bytes")
  echo "  Datenbankgröße: ${DB_SIZE_HUMAN} (Dump wird größer sein, da SQL-Text)"
else
  echo "  Datenbankgröße: unbekannt"
  DB_SIZE_BYTES=0
fi

# --- Dump & Import in einem Schritt ---
START_TIME=$(date +%s)

if command -v pv &>/dev/null; then
  echo "→ Dumpe Remote-Datenbank und importiere lokal (mit Fortschrittsanzeige) …"
  # pv zeigt Durchsatz, übertragene Bytes und geschätzte Restzeit
  # Die geschätzte Größe ist ~1.5x der DB-Größe (SQL-Text ist größer als die Rohdaten)
  ESTIMATED_SIZE=$(( DB_SIZE_BYTES * 3 / 2 ))
  if [[ "$ESTIMATED_SIZE" -gt 0 ]]; then
    PV_ARGS="-pterba -s $ESTIMATED_SIZE -N 'Dump→Import'"
  else
    PV_ARGS="-pterb -N 'Dump→Import'"
  fi
  PGPASSWORD="$REMOTE_PASSWORD" pg_dump -h "$REMOTE_HOST" -p "$REMOTE_PORT" -U "$REMOTE_USER" \
    --no-owner --no-privileges \
    "$REMOTE_DB" \
    | eval pv $PV_ARGS \
    | PGPASSWORD="$LOCAL_PASSWORD" psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -d "$LOCAL_DB" \
      --quiet
else
  echo "→ Dumpe Remote-Datenbank und importiere lokal …"
  echo "  (Tipp: 'sudo apt install pv' für eine bessere Fortschrittsanzeige)"
  # Fallback: pg_dump --verbose zeigt Tabellennamen während des Dumps
  PGPASSWORD="$REMOTE_PASSWORD" pg_dump -h "$REMOTE_HOST" -p "$REMOTE_PORT" -U "$REMOTE_USER" \
    --no-owner --no-privileges --verbose \
    "$REMOTE_DB" 2>&1 \
    | while IFS= read -r line; do
        if [[ "$line" == pg_dump:* ]]; then
          # Fortschritts-Infos von pg_dump auf stderr anzeigen
          printf "\r\033[K  %s" "$line"
        else
          # SQL-Daten an psql weiterleiten
          echo "$line"
        fi
      done \
    | PGPASSWORD="$LOCAL_PASSWORD" psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -d "$LOCAL_DB" \
      --quiet
  echo "" # Neue Zeile nach \r-Ausgaben
fi

END_TIME=$(date +%s)
ELAPSED=$(( END_TIME - START_TIME ))
MINUTES=$(( ELAPSED / 60 ))
SECONDS_REMAINING=$(( ELAPSED % 60 ))

echo ""
echo "✓ ASV-Datenbank erfolgreich geklont. (Dauer: ${MINUTES}m ${SECONDS_REMAINING}s)"
