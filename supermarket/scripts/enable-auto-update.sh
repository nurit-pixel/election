#!/bin/sh
# מגדיר עדכון אוטומטי של האפליקציה כל לילה ב-04:00 (לפני הריצה הלילית של 06:00).
# הרצה חד-פעמית מתוך תיקיית הפרויקט:  ./scripts/enable-auto-update.sh
set -eu
cd "$(dirname "$0")/.."
dir=$(pwd)
mkdir -p backups
line="0 4 * * * cd $dir && ./scripts/update.sh >> backups/update.log 2>&1"
(crontab -l 2>/dev/null | grep -v "scripts/update.sh" || true; echo "$line") | crontab -
echo "AUTO-UPDATE ENABLED: every night at 04:00"
crontab -l | grep "scripts/update.sh"
