#!/usr/bin/env bash
#
# clone-untis.sh — Kopiert die produktive Untis-Datenbank (MySQL) in die lokale Docker-Instanz.
#
# Verwendung:
#   ./scripts/clone-untis.sh --host <HOST> --port <PORT> --db <DB> --user <USER> --password <PASSWORD>
#
# Die lokale Zieldatenbank wird über docker-compose bereitgestellt (synx_mysql, Port 3307).
#

set -euo pipefail

# --- Defaults ---
REMOTE_HOST=""
REMOTE_PORT="3306"
REMOTE_DB=""
REMOTE_USER=""
REMOTE_PASSWORD=""

LOCAL_HOST="127.0.0.1"
LOCAL_PORT="3307"
LOCAL_DB="untis"
LOCAL_USER="root"
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

echo "=== Untis-Datenbank klonen ==="
echo "  Quelle:  ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}/${REMOTE_DB}"
echo "  Ziel:    ${LOCAL_USER}@${LOCAL_HOST}:${LOCAL_PORT}/${LOCAL_DB}"
echo ""

# --- Prüfe ob lokaler Container läuft ---
if ! docker ps --format '{{.Names}}' | grep -q '^synx_mysql$'; then
  echo "Fehler: Container 'synx_mysql' läuft nicht. Starte ihn mit: docker compose up -d mysql" >&2
  exit 1
fi

# --- Lokale Datenbank leeren und neu erstellen ---
echo "→ Lokale Datenbank '${LOCAL_DB}' wird zurückgesetzt …"
mysql -h "$LOCAL_HOST" -P "$LOCAL_PORT" -u "$LOCAL_USER" -p"$LOCAL_PASSWORD" \
  -e "DROP DATABASE IF EXISTS \`${LOCAL_DB}\`; CREATE DATABASE \`${LOCAL_DB}\`;"

# --- Datenbankgröße ermitteln ---
echo "→ Ermittle Größe der Remote-Datenbank …"
DB_SIZE_BYTES=$(mysql -h "$REMOTE_HOST" -P "$REMOTE_PORT" -u "$REMOTE_USER" -p"$REMOTE_PASSWORD" \
  -sNe "SELECT SUM(data_length + index_length) FROM information_schema.tables WHERE table_schema = '${REMOTE_DB}';" \
  2>/dev/null || echo "0")
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
  ESTIMATED_SIZE=$(( DB_SIZE_BYTES * 3 / 2 ))
  if [[ "$ESTIMATED_SIZE" -gt 0 ]]; then
    PV_ARGS="-pterba -s $ESTIMATED_SIZE -N 'Dump→Import'"
  else
    PV_ARGS="-pterb -N 'Dump→Import'"
  fi
  mysqldump -h "$REMOTE_HOST" -P "$REMOTE_PORT" -u "$REMOTE_USER" -p"$REMOTE_PASSWORD" \
    --single-transaction --routines --triggers --set-gtid-purged=OFF \
    "$REMOTE_DB" \
    | eval pv $PV_ARGS \
    | mysql -h "$LOCAL_HOST" -P "$LOCAL_PORT" -u "$LOCAL_USER" -p"$LOCAL_PASSWORD" "$LOCAL_DB"
else
  echo "→ Dumpe Remote-Datenbank und importiere lokal …"
  echo "  (Tipp: 'sudo apt install pv' für eine bessere Fortschrittsanzeige)"
  mysqldump -h "$REMOTE_HOST" -P "$REMOTE_PORT" -u "$REMOTE_USER" -p"$REMOTE_PASSWORD" \
    --single-transaction --routines --triggers --set-gtid-purged=OFF --verbose \
    "$REMOTE_DB" \
    | mysql -h "$LOCAL_HOST" -P "$LOCAL_PORT" -u "$LOCAL_USER" -p"$LOCAL_PASSWORD" "$LOCAL_DB"
fi

END_TIME=$(date +%s)
ELAPSED=$(( END_TIME - START_TIME ))
MINUTES=$(( ELAPSED / 60 ))
SECONDS_REMAINING=$(( ELAPSED % 60 ))

echo ""
echo "✓ Untis-Datenbank erfolgreich geklont. (Dauer: ${MINUTES}m ${SECONDS_REMAINING}s)"
