#!/usr/bin/env bash
set -e

# SolTrade Universal SME Cryptographic Ledger Showcase
# Targets: Colosseum Crypto World's Fair Hackathon
# Demonstrates Multi-Vertical Protection:
#   1. B2B Commercial Invoicing & Wire Fraud Prevention
#   2. Retail & Warehouse Hardware Inventory Shrinkage Prevention

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CLI="./bin/soltrade"

echo -e "\033[1;36m========================================================================\033[0m"
echo -e "\033[1m   SOLTRADE: UNIVERSAL CRYPTOGRAPHIC LEDGER FOR SMEs ON SOLANA\033[0m"
echo -e "\033[2m   Colosseum Crypto World's Fair Hackathon Live Demonstration\033[0m"
echo -e "\033[1;36m========================================================================\033[0m"
echo ""

# Step 0: Ensure SolTrade is initialized
echo -e "\033[1m[Init] Initializing SolTrade Environment & Solana Identity...\033[0m"
$CLI init --network litesvm

echo ""
echo -e "\033[1;35m>>> RUNNING SHOWCASE 1: B2B COMMERCIAL INVOICE & WIRE FRAUD PREVENTION\033[0m"
echo ""
$CLI demo invoice

echo ""
echo -e "\033[1;35m>>> RUNNING SHOWCASE 2: RETAIL & WAREHOUSE INVENTORY SHRINKAGE PREVENTION\033[0m"
echo ""
$CLI demo inventory

echo ""
echo -e "\033[1;32m========================================================================\033[0m"
echo -e "\033[1;32m   SOLTRADE DEMONSTRATION COMPLETE: 100% CRYPTOGRAPHIC NON-REPUDIATION!\033[0m"
echo -e "\033[2m   SolTrade protects SMEs across invoices, inventory, orders, and databases\033[0m"
echo -e "\033[2m   in 400ms for <\$0.00025 per anchor via Solana consensus.\033[0m"
echo -e "\033[1;32m========================================================================\033[0m"
