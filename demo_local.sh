#!/usr/bin/env bash
set -e

# Delegate to the Universal SME Cryptographic Ledger Showcase
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/demo_sme_showcase.sh" "$@"
