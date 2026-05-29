#!/bin/bash
cd /home/z/my-project
while true; do
  node node_modules/.bin/next start -p 3000 -H 0.0.0.0
  echo "Server crashed, restarting in 2 seconds..."
  sleep 2
done
