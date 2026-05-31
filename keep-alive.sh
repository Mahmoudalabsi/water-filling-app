#!/bin/bash
while true; do
  if ! curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 | grep -q "200"; then
    cd /home/z/my-project
    PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js &
    sleep 5
  fi
  sleep 10
done
