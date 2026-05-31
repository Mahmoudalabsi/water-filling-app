#!/bin/bash
cd /home/z/my-project
export PORT=3000
export HOSTNAME=0.0.0.0
while true; do
  node .next/standalone/server.js
  RET=$?
  echo "[$(date)] Server exited with code $RET, restarting in 2s..." >&2
  sleep 2
done
