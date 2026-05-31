#!/bin/bash
PIDFILE="/home/z/my-project/server.pid"
LOGFILE="/home/z/my-project/dev.log"

cd /home/z/my-project
export PORT=3000
export HOSTNAME=0.0.0.0
export DATABASE_URL="file:/home/z/my-project/db/custom.db"

while true; do
  # Check if port 3000 is responding
  if ! curl -s --connect-timeout 2 --max-time 5 http://127.0.0.1:3000 > /dev/null 2>&1; then
    echo "[$(date)] Server not responding, starting..." >> "$LOGFILE"
    # Kill any stale processes
    pkill -f "standalone/server.js" 2>/dev/null || true
    sleep 1
    node .next/standalone/server.js >> "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    sleep 3
    if curl -s --connect-timeout 2 http://127.0.0.1:3000 > /dev/null 2>&1; then
      echo "[$(date)] Server started successfully" >> "$LOGFILE"
    else
      echo "[$(date)] Server failed to start" >> "$LOGFILE"
    fi
  fi
  sleep 5
done
