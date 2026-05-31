#!/bin/bash
cd /home/z/my-project
export PORT=3000
export HOSTNAME=0.0.0.0
export NODE_ENV=production
exec node .next/standalone/server.js
