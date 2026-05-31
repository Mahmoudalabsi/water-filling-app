#!/bin/bash
cd /home/z/my-project
while true; do
  PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js >> /home/z/my-project/dev.log 2>&1
  echo "[$(date)] Server died, restarting in 3 seconds..." >> /home/z/my-project/dev.log
  sleep 3
done
