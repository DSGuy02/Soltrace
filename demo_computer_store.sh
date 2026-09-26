#!/usr/bin/env bash
set -e

# SolTrace Computer Store & Hardware Inventory Demo Script
# Demonstrates cryptographic state sealing for retail devices, specs, and quantities on Solana.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CLI="./bin/soltrade"

echo -e "\033[1;36m========================================================================\033[0m"
echo -e "\033[1m   SOLTRACE COMPUTER STORE & HARDWARE INVENTORY PROVENANCE DEMO\033[0m"
echo -e "\033[2m   Anchoring Hardware Specs, Quantities, and Store Records to Solana\033[0m"
echo -e "\033[1;36m========================================================================\033[0m"
echo ""

# Step 0: Ensure SolTrace is initialized
echo -e "\033[1m[Step 0] Initializing SolTrace Environment...\033[0m"
$CLI init --network litesvm

echo ""
echo -e "\033[1m[Step 1] Loading Computer Store Catalog Sample...\033[0m"
DEVICE_FILE="examples/computer_store_catalog.json"
echo "  • Catalog: $DEVICE_FILE"

# Extract first device (MacBook Pro 16")
SKU="LAP-APL-MBP16-M3"
LEGITIMATE_DATA='{
  "sku": "LAP-APL-MBP16-M3",
  "brand": "Apple",
  "model": "MacBook Pro 16\"",
  "type": "laptop",
  "storage_size": "1TB",
  "storage_type": "NVMe Gen4 SSD",
  "ram_size": "36GB",
  "ram_type": "Unified LPDDR5X",
  "wireless_specs": "Wi-Fi 6E (802.11ax) + Bluetooth 5.3",
  "quantity": 25,
  "unit_price_eur": 2899.00,
  "store_location": "Dublin Grafton St - Vault A"
}'

echo ""
echo -e "\033[1m[Step 2] Anchoring Legitimate Shipment Receipt to Solana...\033[0m"
$CLI db anchor \
  --table store_inventory \
  --id "$SKU" \
  --data "$LEGITIMATE_DATA" \
  --operator "deji@dublin-store.internal" \
  --action "STOCK_RECEIPT"

echo ""
echo -e "\033[1m[Step 3] Running Integrity Audit on Clean Database Record...\033[0m"
$CLI db verify \
  --table store_inventory \
  --id "$SKU" \
  --data "$LEGITIMATE_DATA"

echo ""
echo -e "\033[1;31m[Step 4] Simulating Insider Theft / Silent SQL Database Tampering...\033[0m"
echo -e "\033[2m  >>> Direct unauthorized database edit (bypassing application & audit logs):\033[0m"
echo -e "\033[1;31m  >>> UPDATE store_inventory SET quantity = 15, ram_size = '18GB', storage_size = '512GB' WHERE sku = '$SKU';\033[0m"

TAMPERED_DATA='{
  "sku": "LAP-APL-MBP16-M3",
  "brand": "Apple",
  "model": "MacBook Pro 16\"",
  "type": "laptop",
  "storage_size": "512GB",
  "storage_type": "NVMe Gen4 SSD",
  "ram_size": "18GB",
  "ram_type": "Unified LPDDR5X",
  "wireless_specs": "Wi-Fi 6E (802.11ax) + Bluetooth 5.3",
  "quantity": 15,
  "unit_price_eur": 2899.00,
  "store_location": "Dublin Grafton St - Vault A"
}'

echo ""
echo -e "\033[1m[Step 5] SolTrace Independent Audit Engine Executes Verification...\033[0m"
set +e
$CLI db verify \
  --table store_inventory \
  --id "$SKU" \
  --data "$TAMPERED_DATA"
VERIFY_EXIT=$?
set -e

if [ $VERIFY_EXIT -eq 1 ]; then
  echo ""
  echo -e "\033[1;32m✔ SUCCESS: SolTrace successfully detected unauthorized database tampering and shrinkage!\033[0m"
fi

echo ""
echo -e "\033[1m[Step 6] Inspecting Verifiable On-Chain Transition History...\033[0m"
$CLI db history --table store_inventory --id "$SKU"

echo ""
echo -e "\033[1;32m========================================================================\033[0m"
echo -e "\033[1;32m   DEMO COMPLETE: Cryptographic Provenance Verified on Solana!\033[0m"
echo -e "\033[1;32m========================================================================\033[0m"
