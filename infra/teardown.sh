#!/usr/bin/env bash
#
# Tears down all Azure resources for the PoC.
#
# Usage:
#   ./infra/teardown.sh
#
set -euo pipefail

RESOURCE_GROUP="rg-durable-fn-event-poc"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOURCES_FILE="${SCRIPT_DIR}/resources.env"

echo "=== Deleting resource group: ${RESOURCE_GROUP} ==="
echo "This will delete ALL resources in the group."
read -rp "Are you sure? (y/N) " confirm

if [[ "${confirm}" =~ ^[Yy]$ ]]; then
  az group delete \
    --name "${RESOURCE_GROUP}" \
    --yes \
    --no-wait
  echo "Deletion started (running in background)."

  if [[ -f "${RESOURCES_FILE}" ]]; then
    rm "${RESOURCES_FILE}"
    echo "Removed ${RESOURCES_FILE}"
  fi
else
  echo "Aborted."
fi
