#!/usr/bin/env bash
#
# Starts the Function App locally against the Azure Storage backend
# (via the Azurite emulator).
#
# What it does:
#   1. Swaps host.json to use the AzureStorage storage provider
#      (host.storage.json).
#   2. Ensures the local emulators are running (Service Bus + Azurite).
#      DTS is not required for this setup but is harmless if already up.
#   3. Cleans + rebuilds the TypeScript sources.
#   4. Launches `func start` in the foreground.
#
# Usage:
#   ./scripts/start-storage.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "▶ Switching host.json → Azure Storage (host.storage.json)"
cp host.storage.json host.json

echo "▶ Ensuring emulators are running (Service Bus + Azurite)"
(cd emulator && docker compose up -d)

echo "▶ Waiting for Azurite on http://localhost:10000 ..."
for _ in {1..30}; do
  if nc -z localhost 10000 2>/dev/null; then
    echo "   Azurite is up"
    break
  fi
  sleep 1
done

echo "▶ Building TypeScript"
npm run clean
npm run build

echo "▶ Starting Functions host (Azure Storage backend)"
exec func start
