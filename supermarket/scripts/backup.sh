#!/bin/sh
# גיבוי המסד לקובץ דחוס בתיקיית backups/, ושמירת 14 הגיבויים האחרונים.
# הרצה מתוך תיקיית הפרויקט:  ./scripts/backup.sh
# לגיבוי יומי אוטומטי, ב-crontab של השרת:
#   30 7 * * * cd /opt/supermarket && ./scripts/backup.sh >> backups/backup.log 2>&1
set -eu
cd "$(dirname "$0")/.."
. ./.env
mkdir -p backups
file="backups/supermarket-$(date +%Y%m%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$file"
echo "נשמר $file ($(du -h "$file" | cut -f1))"
ls -1t backups/supermarket-*.sql.gz | tail -n +15 | xargs -r rm --
