#!/bin/sh
# עדכון האפליקציה לגרסה האחרונה מ-GitHub: גיבוי, משיכת הקוד, בנייה והפעלה מחדש.
# הנתונים (מסד, קבצים שהורדו, תעודות) נשמרים ב-volumes ואינם נמחקים.
# הרצה מתוך תיקיית הפרויקט:  ./scripts/update.sh
# לבנייה מחדש גם כשאין קוד חדש (למשל אחרי git pull ידני):  ./scripts/update.sh --force
set -eu
cd "$(dirname "$0")/.."
. ./.env

before=$(git rev-parse --short HEAD)
git pull --ff-only
after=$(git rev-parse --short HEAD)
if [ "$before" = "$after" ] && [ "${1:-}" != "--force" ]; then
  echo "אין עדכון חדש (גרסה $after)"
  exit 0
fi

./scripts/backup.sh

# עם דומיין מוגדר מפעילים גם את Caddy (HTTPS)
if [ -n "${APP_DOMAIN:-}" ]; then
  files="-f docker-compose.yml -f docker-compose.prod.yml"
else
  files="-f docker-compose.yml"
fi
docker compose $files up -d --build
docker image prune -f >/dev/null
echo "עודכן מ-$before ל-$after"
