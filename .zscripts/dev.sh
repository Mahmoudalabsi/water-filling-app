#!/bin/bash

# Water Filling App - Persistent Server Script
# This script keeps the Next.js production server running with auto-restart

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
        echo "[INIT] Installing dependencies..."
        bun install 2>&1 || npm install 2>&1
fi

# Generate Prisma client and push schema
echo "[INIT] Setting up database..."
npx prisma generate 2>&1 || true
npx prisma db push 2>&1 || true

# Build if needed
if [ ! -f ".next/standalone/server.js" ]; then
        echo "[INIT] Building production bundle..."
        npx next build 2>&1 || true
fi

# Start production server with auto-restart loop
export PORT=3000
export HOSTNAME=0.0.0.0
export NODE_ENV=production

echo "[SERVER] Starting production server on port 3000 with auto-restart..."
while true; do
        node .next/standalone/server.js 2>&1
        EXIT_CODE=$?
        echo "[SERVER] Process exited with code $EXIT_CODE at $(date). Restarting in 2s..."
        sleep 2
done
