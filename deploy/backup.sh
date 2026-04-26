#!/bin/sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/quokka_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting backup -> ${BACKUP_FILE}"
pg_dump --no-owner --no-acl | gzip > "${BACKUP_FILE}"

# Retention
find /backups -name "quokka_*.sql.gz" -mtime "+${BACKUP_RETENTION_DAYS:-14}" -delete

echo "[$(date)] Backup complete. Total size:"
du -sh /backups
