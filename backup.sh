#!/bin/bash
set -e

DIR="$(dirname "$0")"
source "$DIR/.env"

log() { echo "[$(date '+%d/%m/%Y %T')] $1"; }

MARKER=/root/.macaco-backup-date
TODAY=$(date +%F)
[ -f "$MARKER" ] && [ "$(cat "$MARKER")" = "$TODAY" ] && exit 0

SNAPSHOT="/tmp/macaco-$TODAY.db"
sqlite3 "$DIR/macaco.db" ".backup '$SNAPSHOT'" || { log "ERRO: backup do sqlite falhou"; exit 1; }
scp "$SNAPSHOT" "$BACKUP_HOST:$BACKUP_DIR/macaco-$TODAY.db" || { log "ERRO: envio via scp falhou"; exit 1; }
rm -f "$SNAPSHOT"
echo "$TODAY" > "$MARKER"
log "Backup de $TODAY enviado para $BACKUP_HOST"
ssh "$BACKUP_HOST" "forfiles /P ${BACKUP_DIR//\//\\} /M *.db /D -30 /C \"cmd /c del @path\"" || log "AVISO: limpeza de backups antigos falhou"