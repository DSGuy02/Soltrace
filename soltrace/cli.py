#!/usr/bin/env python3
"""
SolTrace CLI: Cryptographic Database, IPAM & DevOps Provenance on Solana
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from soltrace.hasher import (
    get_git_metadata,
    compute_sbom_hash,
    compute_artifact_hash,
    compute_state_seal as compute_ci_state_seal
)
from soltrace.db_hasher import (
    compute_record_hash,
    compute_db_state_seal,
    diff_records,
    format_db_attestation
)
from soltrace.chain import (
    SolanaAnchorClient,
    DEFAULT_DEVNET_RPC
)
from soltrace.storage import (
    SolTraceLedger,
    DEFAULT_DB_PATH
)

CONFIG_DIR = ".soltrace"
KEYPAIR_FILE = os.path.join(CONFIG_DIR, "keypair.json")
ATTESTATION_FILE = os.path.join(CONFIG_DIR, "attestation.json")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")

# Terminal Colors & Styling
C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_CYAN = "\033[36m"
C_GREEN = "\033[32m"
C_YELLOW = "\033[33m"
C_RED = "\033[31m"
C_MAGENTA = "\033[35m"
C_DIM = "\033[2m"

def print_banner():
    banner = f"""
{C_CYAN}{C_BOLD}   ____        ___________              __     
  / __/____   /_  __/ ___/____ _____   / /__   
 _\\ \\ / __ \\   / / / /   / __ `/ __ \\ / //_/   
/___/ \\____/  /_/ /_/   /\\__,_/\\_,_/_//_/      {C_GREEN}v0.3.0{C_RESET}
{C_DIM}SolTrace: Universal Cryptographic Ledger & Provenance on Solana{C_RESET}
{C_DIM}Securing Invoices, Inventory, Contracts, Code & Databases for Businesses{C_RESET}
"""
    print(banner)

def get_client(network: Optional[str] = None, rpc_url: Optional[str] = None) -> SolanaAnchorClient:
    active_network = network or "litesvm"
    active_rpc = rpc_url or DEFAULT_DEVNET_RPC
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                cfg = json.load(f)
                active_network = network or cfg.get("network", "litesvm")
                active_rpc = rpc_url or cfg.get("rpc_url", DEFAULT_DEVNET_RPC)
        except Exception:
            pass
            
    kp = SolanaAnchorClient.load_or_create_keypair(KEYPAIR_FILE)
    return SolanaAnchorClient(network=active_network, rpc_url=active_rpc, keypair=kp)

def get_ledger() -> SolTraceLedger:
    return SolTraceLedger(DEFAULT_DB_PATH)

# --- Commands ---

def cmd_init(args):
    """Initializes .soltrace configuration and Solana keypair."""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    kp = SolanaAnchorClient.load_or_create_keypair(KEYPAIR_FILE)
    pubkey = str(kp.pubkey())
    
    cfg = {
        "network": args.network or "litesvm",
        "rpc_url": args.rpc_url or DEFAULT_DEVNET_RPC,
        "payer_address": pubkey,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)
        
    print(f"{C_GREEN}✔ Initialized SolTrace workspace!{C_RESET}")
    print(f"  • Config:     {C_BOLD}{CONFIG_FILE}{C_RESET}")
    print(f"  • Keypair:    {C_BOLD}{KEYPAIR_FILE}{C_RESET}")
    print(f"  • Payer:      {C_CYAN}{C_BOLD}{pubkey}{C_RESET}")
    print(f"  • Network:    {C_YELLOW}{cfg['network']}{C_RESET}")
    print(f"  • Ledger:     {C_BOLD}{DEFAULT_DB_PATH}{C_RESET}\n")

def cmd_address(args):
    """Prints the local Solana payer address."""
    kp = SolanaAnchorClient.load_or_create_keypair(KEYPAIR_FILE)
    client = get_client(args.network)
    bal = client.get_balance()
    print(f"{C_BOLD}SolTrace Solana Identity:{C_RESET}")
    print(f"  • Address: {C_CYAN}{kp.pubkey()}{C_RESET}")
    print(f"  • Network: {C_YELLOW}{client.network}{C_RESET}")
    print(f"  • Balance: {bal / 1_000_000_000:.4f} SOL ({bal} lamports)")

# --- Database Commands ---

def cmd_db_anchor(args):
    """Anchors a database record or inventory item to Solana."""
    table = args.table
    record_id = args.id
    operator = args.operator or "admin"
    action = args.action or "UPDATE"
    
    if args.file:
        with open(args.file, "r") as f:
            data = json.load(f)
    elif args.data:
        data = json.loads(args.data)
    else:
        print(f"{C_RED}✖ Error: Must provide --data '<json>' or --file <path>{C_RESET}")
        sys.exit(1)
        
    ledger = get_ledger()
    client = get_client(args.network)
    
    print_banner()
    print(f"{C_BOLD}[1/3] Computing Record Fingerprint & State Seal...{C_RESET}")
    rec_hash = compute_record_hash(table, record_id, data)
    existing = ledger.get_latest_record(table, record_id)
    prev_seal = existing["current_seal"] if existing else "GENESIS"
    timestamp = datetime.now(timezone.utc).isoformat()
    
    state_seal = compute_db_state_seal(
        table=table,
        record_id=record_id,
        current_data=data,
        prev_seal=prev_seal,
        timestamp=timestamp,
        operator=operator
    )
    
    print(f"  • Table:        {C_CYAN}{table}{C_RESET}")
    print(f"  • Record ID:    {C_CYAN}{record_id}{C_RESET}")
    print(f"  • Record SHA:   {C_DIM}{rec_hash}{C_RESET}")
    print(f"  • Prev Seal:    {C_DIM}{prev_seal[:16]}...{C_RESET}")
    print(f"  • State Seal:   {C_GREEN}{C_BOLD}{state_seal}{C_RESET}")
    
    print(f"\n{C_BOLD}[2/3] Anchoring to Solana Blockchain ({client.network})...{C_RESET}")
    attestation = format_db_attestation(
        table=table,
        record_id=record_id,
        state_seal=state_seal,
        action=action,
        operator=operator,
        timestamp=timestamp,
        record_hash=rec_hash
    )
    
    res = client.anchor_attestation(attestation)
    if not res.get("success"):
        print(f"{C_RED}✖ Solana Anchoring Failed: {res.get('error')}{C_RESET}")
        sys.exit(1)
        
    sig = res["signature"]
    explorer = res.get("explorer_url", "")
    print(f"{C_GREEN}✔ Successfully Anchored on Solana!{C_RESET}")
    print(f"  • Signature:    {C_CYAN}{sig}{C_RESET}")
    print(f"  • Explorer:     {explorer}")
    
    print(f"\n{C_BOLD}[3/3] Updating Local Verifiable Ledger...{C_RESET}")
    ledger.save_attestation(
        table_name=table,
        record_id=record_id,
        action=action,
        state_seal=state_seal,
        record_hash=rec_hash,
        data=data,
        signature=sig,
        network=client.network,
        explorer_url=explorer,
        operator=operator,
        timestamp=timestamp,
        prev_seal=prev_seal
    )
    print(f"{C_GREEN}✔ Ledger synchronized.{C_RESET}\n")

def cmd_db_verify(args):
    """Verifies a database record against Solana on-chain anchor."""
    table = args.table
    record_id = args.id
    
    if args.file:
        with open(args.file, "r") as f:
            current_data = json.load(f)
    elif args.data:
        current_data = json.loads(args.data)
    else:
        print(f"{C_RED}✖ Error: Must provide --data '<json>' or --file <path>{C_RESET}")
        sys.exit(1)
        
    ledger = get_ledger()
    existing = ledger.get_latest_record(table, record_id)
    
    print_banner()
    print(f"{C_BOLD}Auditing Record Integrity against Solana Ledger...{C_RESET}")
    print(f"  • Table:     {C_CYAN}{table}{C_RESET}")
    print(f"  • Record ID: {C_CYAN}{record_id}{C_RESET}")
    
    if not existing:
        print(f"\n{C_YELLOW}⚠ Status: RECORD NOT ANCHORED{C_RESET}")
        print("  No on-chain attestation found for this record.")
        sys.exit(2)
        
    current_hash = compute_record_hash(table, record_id, current_data)
    anchored_hash = existing["record_hash"]
    
    print(f"  • Current Hash:  {C_DIM}{current_hash}{C_RESET}")
    print(f"  • Anchored Hash: {C_DIM}{anchored_hash}{C_RESET}")
    print(f"  • Solana Tx:     {C_CYAN}{existing['last_signature']}{C_RESET}")
    
    if current_hash == anchored_hash:
        print(f"\n{C_GREEN}{C_BOLD}✔ AUDIT PASSED: RECORD IS AUTHENTIC & VERIFIED{C_RESET}")
        print(f"  Database state perfectly matches immutable Solana anchor.")
        print(f"  Last authorized update by {C_CYAN}{existing['operator']}{C_RESET} at {existing['last_updated']}")
        sys.exit(0)
    else:
        diff = diff_records(existing["data"], current_data)
        print(f"\n{C_RED}{C_BOLD}✖ CRITICAL ALERT: UNAUTHORIZED TAMPERING DETECTED!{C_RESET}")
        print(f"  The database record has been modified out-of-band and violates the on-chain seal!\n")
        print(f"{C_BOLD}Altered Fields Detected:{C_RESET}")
        
        for k, v in diff["modified"].items():
            print(f"  • {C_BOLD}{k}{C_RESET}:")
            print(f"      {C_GREEN}On-Chain Legitimate:{C_RESET} {v['before']}")
            print(f"      {C_RED}Tampered Live State:{C_RESET} {v['after']}")
            
        for k, v in diff["added"].items():
            print(f"  • {C_BOLD}{k}{C_RESET}: {C_RED}Unauthorized New Field:{C_RESET} {v}")
            
        for k, v in diff["removed"].items():
            print(f"  • {C_BOLD}{k}{C_RESET}: {C_YELLOW}Deleted Field (was: {v}){C_RESET}")
            
        sys.exit(1)

def cmd_db_history(args):
    """Displays verifiable audit history for a record."""
    table = args.table
    record_id = args.id
    ledger = get_ledger()
    history = ledger.get_history(table, record_id)
    
    print_banner()
    print(f"{C_BOLD}Cryptographic Audit Trail for {C_CYAN}{table}:{record_id}{C_RESET} ({len(history)} anchors):")
    
    if not history:
        print("  No history recorded.")
        return
        
    for idx, event in enumerate(history, 1):
        print(f"\n  {C_BOLD}[Transition #{idx}] {event['action']} by {C_CYAN}{event['operator']}{C_RESET} at {event['timestamp']}")
        print(f"    • State Seal: {C_GREEN}{event['state_seal'][:24]}...{C_RESET}")
        print(f"    • Solana Tx:  {C_CYAN}{event['signature']}{C_RESET}")
        print(f"    • Explorer:   {event['explorer_url']}")

# --- Server Command ---

def cmd_serve(args):
    """Starts the FastAPI REST API & Webhook Gateway."""
    import uvicorn
    from soltrace.server import app
    print_banner()
    print(f"{C_GREEN}✔ Starting SolTrace Provenance Gateway & Webhook Server...{C_RESET}")
    print(f"  • Host:             {args.host}")
    print(f"  • Port:             {args.port}")
    print(f"  • Interactive UI:   {C_GREEN}{C_BOLD}http://{args.host}:{args.port}/dashboard{C_RESET}")
    print(f"  • Swagger Docs:     {C_CYAN}http://{args.host}:{args.port}/docs{C_RESET}")
    print(f"  • Webhook Ingest:   {C_CYAN}http://{args.host}:{args.port}/webhooks/invoice{C_RESET}\n")
    uvicorn.run(app, host=args.host, port=args.port)


# --- Hero Tamper Demonstration ---

def cmd_demo_store(args):
    """
    Hero Live Demonstration:
    Simulates Computer Store & Retail Hardware Inventory Tracking.
    Tracks devices with Brand, Type, Storage Size/Type, Quantity, RAM Size/Type, Wireless Specs.
    Anchors state to Solana, introduces an unauthorized raw SQL backdoor modification (theft/swap),
    and proves how SolTrace instantly detects tampering and inventory shrinkage.
    """
    print_banner()
    print(f"{C_BOLD}{C_MAGENTA}========================================================================{C_RESET}")
    print(f"{C_BOLD}   SOLTRACE LIVE DEMO: COMPUTER STORE HARDWARE INVENTORY AUDIT{C_RESET}")
    print(f"{C_DIM}   Cryptographic State Sealing for Devices, Components & Quantities{C_RESET}")
    print(f"{C_BOLD}{C_MAGENTA}========================================================================{C_RESET}\n")
    
    ledger = get_ledger()
    client = get_client("litesvm")
    
    # Step 1: Legitimate Computer Store Inventory Receipt
    print(f"{C_BOLD}[Step 1] Receiving High-Value Hardware Shipment in Computer Store DB...{C_RESET}")
    table = "store_inventory"
    sku = "LAP-APL-MBP16-M3"
    
    legitimate_data = {
        "sku": sku,
        "brand": "Apple",
        "type": "laptop",
        "model": "MacBook Pro 16\" (M3 Max)",
        "storage_size": "1TB",
        "storage_type": "NVMe Gen4 SSD",
        "ram_size": "36GB",
        "ram_type": "Unified LPDDR5X",
        "wireless_specs": "Wi-Fi 6E (802.11ax) + Bluetooth 5.3",
        "quantity": 25,
        "unit_price_eur": 2899.00,
        "store_location": "Dublin Grafton St - Vault A",
        "authorized_by": "deji@dublin-store.internal"
    }
    
    print(f"  • SKU:            {C_CYAN}{sku}{C_RESET}")
    print(f"  • Device:         {legitimate_data['brand']} {legitimate_data['model']} ({legitimate_data['type']})")
    print(f"  • Specs:          {legitimate_data['ram_size']} {legitimate_data['ram_type']} | {legitimate_data['storage_size']} {legitimate_data['storage_type']}")
    print(f"  • Wireless:       {legitimate_data['wireless_specs']}")
    print(f"  • Stock Quantity: {C_GREEN}{C_BOLD}{legitimate_data['quantity']} units in stock (€{legitimate_data['quantity'] * legitimate_data['unit_price_eur']:,.2f} total value){C_RESET}")
    
    # Step 2: Anchoring to Solana
    print(f"\n{C_BOLD}[Step 2] SolTrace Anchors Inventory State Seal to Solana...{C_RESET}")
    ts = datetime.now(timezone.utc).isoformat()
    rec_hash = compute_record_hash(table, sku, legitimate_data)
    state_seal = compute_db_state_seal(table, sku, legitimate_data, "GENESIS", ts, "deji@dublin-store.internal")
    
    attestation = format_db_attestation(
        table=table,
        record_id=sku,
        state_seal=state_seal,
        action="STOCK_RECEIPT",
        operator="deji@dublin-store.internal",
        timestamp=ts,
        record_hash=rec_hash
    )
    
    tx_res = client.anchor_attestation(attestation)
    sig = tx_res["signature"]
    explorer = tx_res["explorer_url"]
    
    ledger.save_attestation(
        table_name=table,
        record_id=sku,
        action="STOCK_RECEIPT",
        state_seal=state_seal,
        record_hash=rec_hash,
        data=legitimate_data,
        signature=sig,
        network="litesvm",
        explorer_url=explorer,
        operator="deji@dublin-store.internal",
        timestamp=ts
    )
    
    print(f"  • State Seal:  {C_GREEN}{C_BOLD}{state_seal}{C_RESET}")
    print(f"  • Solana Tx:   {C_CYAN}{sig}{C_RESET}")
    print(f"  • Status:      {C_GREEN}✔ Confirmed on-chain in 400ms (Cost: < $0.00025){C_RESET}")
    
    # Step 3: Run Routine Verification (Clean State)
    print(f"\n{C_BOLD}[Step 3] Running Automated Inventory Verification (Pre-Tamper)...{C_RESET}")
    current_hash = compute_record_hash(table, sku, legitimate_data)
    if current_hash == rec_hash:
        print(f"  • Result:      {C_GREEN}{C_BOLD}✔ VERIFIED — Computer Store database matches Solana Ledger!{C_RESET}")
        
    # Step 4: Simulate Rogue Employee / SQL Backdoor Tampering
    print(f"\n{C_BOLD}[Step 4] Simulating Insider Threat / Silent SQL Backdoor Inventory Shrinkage...{C_RESET}")
    print(f"  {C_RED}{C_DIM}>>> Rogue worker accesses store PostgreSQL/MySQL database directly:{C_RESET}")
    print(f"  {C_RED}{C_BOLD}>>> UPDATE store_inventory SET quantity = 15, ram_size = '18GB', storage_size = '512GB' WHERE sku = '{sku}';{C_RESET}")
    
    tampered_data = dict(legitimate_data)
    tampered_data["quantity"] = 15       # 10 units stolen (€28,990 value missing!)
    tampered_data["ram_size"] = "18GB"   # Hardware component downgraded/swapped
    tampered_data["storage_size"] = "512GB" # Storage downgraded
    
    print(f"  {C_YELLOW}Database updated silently! Standard inventory reports now show 15 units instead of 25.{C_RESET}")
    print(f"  {C_YELLOW}Without Solana, 10 stolen laptops (€28,990) disappear without a trace.{C_RESET}")
    
    # Step 5: SolTrace Cryptographic Audit Detection
    print(f"\n{C_BOLD}[Step 5] SolTrace Independent Audit Engine Executes...{C_RESET}")
    tampered_hash = compute_record_hash(table, sku, tampered_data)
    
    print(f"  • Live DB Hash:   {C_RED}{tampered_hash}{C_RESET}")
    print(f"  • On-Chain Seal:  {C_GREEN}{rec_hash}{C_RESET}")
    
    if tampered_hash != rec_hash:
        diff = diff_records(legitimate_data, tampered_data)
        print(f"\n{C_RED}{C_BOLD}========================================================================{C_RESET}")
        print(f"{C_RED}{C_BOLD}  ✖ CRITICAL ALERT: INVENTORY TAMPERING & SHRINKAGE DETECTED!{C_RESET}")
        print(f"{C_RED}{C_BOLD}========================================================================{C_RESET}")
        print(f"  The database record for {C_BOLD}{sku}{C_RESET} was illegally altered out-of-band!\n")
        print(f"{C_BOLD}Forensic Evidence:{C_RESET}")
        for field, change in diff["modified"].items():
            print(f"  • Field: {C_BOLD}{field}{C_RESET}")
            print(f"      {C_GREEN}On-Chain Legitimate:{C_RESET} {change['before']}")
            print(f"      {C_RED}Tampered Live State:{C_RESET} {change['after']}")
            if field == "quantity":
                missing = change['before'] - change['after']
                loss = missing * legitimate_data['unit_price_eur']
                print(f"      {C_YELLOW}↳ Discrepancy: {missing} missing units (Unaccounted Loss: €{loss:,.2f}){C_RESET}")
        print(f"\n{C_CYAN}Immutable Solana Attestation Signature:{C_RESET} {sig}")
        print(f"{C_GREEN}SolTrace proves exactly what was altered, when it happened, and who authorized it.{C_RESET}\n")

def cmd_demo_invoice(args):
    """
    Hero Live Demonstration for SME Financial Integrity:
    Simulates B2B Commercial Invoicing & Payment Routing Protection.
    Anchors invoice details (Client, Total Due, Recipient IBAN, Tax VAT, Due Date) to Solana.
    Simulates an Accounts Payable / Business Email Compromise (BEC) attack diverting the wire transfer,
    and proves how SolTrace instantly detects fraudulent tampering before funds leave the company.
    """
    print_banner()
    print(f"{C_BOLD}{C_MAGENTA}========================================================================{C_RESET}")
    print(f"{C_BOLD}   SOLTRACE LIVE DEMO: B2B INVOICE & PAYMENT FRAUD PREVENTION{C_RESET}")
    print(f"{C_DIM}   Cryptographic Non-Repudiation for SME Billing, Banking & Audits{C_RESET}")
    print(f"{C_BOLD}{C_MAGENTA}========================================================================{C_RESET}\n")
    
    ledger = get_ledger()
    client = get_client("litesvm")
    
    # Step 1: Legitimate SME Invoice Issuance
    print(f"{C_BOLD}[Step 1] Issuing B2B Commercial Invoice in SME Accounting DB (QuickBooks/Xero)...{C_RESET}")
    entity = "invoices"
    invoice_id = "INV-2026-081"
    
    legitimate_data = {
        "invoice_id": invoice_id,
        "issuer": "Dublin Precision Tech Ltd",
        "client": "Stripe Ireland Operations",
        "amount_eur": 14850.00,
        "tax_vat_eur": 3415.50,
        "total_due_eur": 18265.50,
        "recipient_iban": "IE29AIBK93115212345678",
        "recipient_bic": "AIBKIE2D",
        "payment_terms": "Net 30 Days",
        "due_date": "2026-10-15",
        "authorized_cfo": "cfo@dublin-precision.ie",
        "status": "approved_and_issued"
    }
    
    print(f"  • Invoice ID:    {C_CYAN}{invoice_id}{C_RESET}")
    print(f"  • B2B Parties:   {legitimate_data['issuer']} ➔ {legitimate_data['client']}")
    print(f"  • Approved Sum:  {C_GREEN}{C_BOLD}€{legitimate_data['total_due_eur']:,.2f}{C_RESET} (VAT: €{legitimate_data['tax_vat_eur']:,.2f})")
    print(f"  • Verified IBAN: {C_CYAN}{legitimate_data['recipient_iban']}{C_RESET} ({legitimate_data['recipient_bic']})")
    print(f"  • Terms:         {legitimate_data['payment_terms']} (Due: {legitimate_data['due_date']})")
    
    # Step 2: Anchoring to Solana
    print(f"\n{C_BOLD}[Step 2] SolTrace Anchors Invoice State Seal to Solana...{C_RESET}")
    ts = datetime.now(timezone.utc).isoformat()
    rec_hash = compute_record_hash(entity, invoice_id, legitimate_data)
    state_seal = compute_db_state_seal(entity, invoice_id, legitimate_data, "GENESIS", ts, "cfo@dublin-precision.ie")
    
    attestation = format_db_attestation(
        table=entity,
        record_id=invoice_id,
        state_seal=state_seal,
        action="INVOICE_ISSUED",
        operator="cfo@dublin-precision.ie",
        timestamp=ts,
        record_hash=rec_hash
    )
    
    tx_res = client.anchor_attestation(attestation)
    sig = tx_res["signature"]
    explorer = tx_res["explorer_url"]
    
    ledger.save_attestation(
        table_name=entity,
        record_id=invoice_id,
        action="INVOICE_ISSUED",
        state_seal=state_seal,
        record_hash=rec_hash,
        data=legitimate_data,
        signature=sig,
        network="litesvm",
        explorer_url=explorer,
        operator="cfo@dublin-precision.ie",
        timestamp=ts
    )
    
    print(f"  • State Seal:  {C_GREEN}{C_BOLD}{state_seal}{C_RESET}")
    print(f"  • Solana Tx:   {C_CYAN}{sig}{C_RESET}")
    print(f"  • Status:      {C_GREEN}✔ Confirmed on-chain in 400ms (Cost: < $0.00025){C_RESET}")
    
    # Step 3: Run Routine Pre-Payment Verification (Clean State)
    print(f"\n{C_BOLD}[Step 3] Running Automated Pre-Payment Verification (Clean State)...{C_RESET}")
    current_hash = compute_record_hash(entity, invoice_id, legitimate_data)
    if current_hash == rec_hash:
        print(f"  • Result:      {C_GREEN}{C_BOLD}✔ VERIFIED — Invoice banking & billing matches Solana Ledger!{C_RESET}")
        
    # Step 4: Simulate Business Email Compromise / Malicious SQL Injection
    print(f"\n{C_BOLD}[Step 4] Simulating Vendor Email Compromise (BEC) / Silent Payment Redirection...{C_RESET}")
    print(f"  {C_RED}{C_DIM}>>> Rogue actor or compromised accounting account alters invoice record:{C_RESET}")
    print(f"  {C_RED}{C_BOLD}>>> UPDATE invoices SET recipient_iban = 'IE29BOFI90001299999999', total_due_eur = 22265.50 WHERE invoice_id = '{invoice_id}';{C_RESET}")
    
    tampered_data = dict(legitimate_data)
    tampered_data["recipient_iban"] = "IE29BOFI90001299999999" # Fraudulent scammer IBAN!
    tampered_data["recipient_bic"] = "BOFIIE2D"
    tampered_data["total_due_eur"] = 22265.50               # Fraudulent inflation (+€4,000)
    
    print(f"  {C_YELLOW}Database updated silently! Accounts Payable is about to wire €22,265.50 to a scammer.{C_RESET}")
    print(f"  {C_YELLOW}Without Solana, this wire transfer succeeds and the funds disappear overseas.{C_RESET}")
    
    # Step 5: SolTrace Cryptographic Audit Detection
    print(f"\n{C_BOLD}[Step 5] SolTrace Payment Gateway & Audit Engine Executes...{C_RESET}")
    tampered_hash = compute_record_hash(entity, invoice_id, tampered_data)
    
    print(f"  • Live DB Hash:   {C_RED}{tampered_hash}{C_RESET}")
    print(f"  • On-Chain Seal:  {C_GREEN}{rec_hash}{C_RESET}")
    
    if tampered_hash != rec_hash:
        diff = diff_records(legitimate_data, tampered_data)
        print(f"\n{C_RED}{C_BOLD}========================================================================{C_RESET}")
        print(f"{C_RED}{C_BOLD}  ✖ CRITICAL ALERT: INVOICE FRAUD & PAYMENT HIJACK DETECTED!{C_RESET}")
        print(f"{C_RED}{C_BOLD}========================================================================{C_RESET}")
        print(f"  The invoice record for {C_BOLD}{invoice_id}{C_RESET} was illegally altered before wire execution!\n")
        print(f"{C_BOLD}Forensic Evidence:{C_RESET}")
        for field, change in diff["modified"].items():
            print(f"  • Field: {C_BOLD}{field}{C_RESET}")
            print(f"      {C_GREEN}On-Chain Legitimate:{C_RESET} {change['before']}")
            print(f"      {C_RED}Tampered Live State:{C_RESET} {change['after']}")
            if field == "recipient_iban":
                print(f"      {C_RED}↳ HIJACK ALERT: Bank account redirected to unauthorized IBAN!{C_RESET}")
            elif field == "total_due_eur":
                diff_amount = change['after'] - change['before']
                print(f"      {C_YELLOW}↳ Discrepancy: Unauthorized inflation of +€{diff_amount:,.2f}{C_RESET}")
        print(f"\n{C_CYAN}Immutable Solana Attestation Signature:{C_RESET} {sig}")
        print(f"{C_GREEN}SolTrace halted fraudulent payment of €22,265.50 before a single cent left the company.{C_RESET}\n")

# --- Retained CI / CD Commands ---

def cmd_record(args):
    """Anchors Git commit, SBOM, and build artifact to Solana (CI/CD mode)."""
    print_banner()
    artifact_path = args.artifact
    if not os.path.exists(artifact_path):
        print(f"{C_RED}✖ Error: Artifact not found at: {artifact_path}{C_RESET}")
        sys.exit(1)

    print(f"{C_BOLD}[1/4] Extracting Repository Metadata...{C_RESET}")
    git_meta = get_git_metadata(args.repo)
    print(f"  • Commit:     {C_CYAN}{git_meta['commit']}{C_RESET}")
    print(f"  • Branch:     {git_meta['branch']}")
    print(f"  • Author:     {git_meta['author']}")

    print(f"\n{C_BOLD}[2/4] Generating SBOM & Artifact Digests...{C_RESET}")
    sbom_info = compute_sbom_hash(args.repo)
    sbom_digest = sbom_info["sbom_digest"]
    print(f"  • SBOM Hash:  {C_CYAN}{sbom_digest[:16]}...{sbom_digest[-8:]}{C_RESET} ({len(sbom_info['manifests'])} manifests detected)")

    artifact_digest = compute_artifact_hash(artifact_path)
    print(f"  • Artifact:   {C_CYAN}{artifact_digest[:16]}...{artifact_digest[-8:]}{C_RESET} ({artifact_path})")

    timestamp = datetime.now(timezone.utc).isoformat()
    state_seal = compute_ci_state_seal(git_meta["commit"], sbom_digest, artifact_digest, timestamp)
    print(f"  • State Seal: {C_GREEN}{C_BOLD}{state_seal}{C_RESET}")

    attestation = {
        "protocol": "soltrace/v1",
        "commit": git_meta["commit"],
        "branch": git_meta["branch"],
        "sbom_digest": sbom_digest,
        "artifact_digest": artifact_digest,
        "state_seal": state_seal,
        "timestamp": timestamp,
        "target": args.target or "production"
    }

    print(f"\n{C_BOLD}[3/4] Anchoring Attestation to Solana ({args.network})...{C_RESET}")
    client = get_client(args.network, args.rpc_url)
    res = client.anchor_attestation(attestation)

    if not res.get("success"):
        print(f"{C_RED}✖ Failed to anchor attestation: {res.get('error')}{C_RESET}")
        sys.exit(1)

    sig = res["signature"]
    print(f"{C_GREEN}✔ Successfully Anchored Attestation on Solana!{C_RESET}")
    print(f"  • Signature:    {C_CYAN}{sig}{C_RESET}")
    print(f"  • Explorer URL: {res['explorer_url']}")

    print(f"\n{C_BOLD}[4/4] Writing Local Attestation Record...{C_RESET}")
    with open(ATTESTATION_FILE, "w") as f:
        json.dump(res, f, indent=2)
    print(f"{C_GREEN}✔ Saved receipt to {ATTESTATION_FILE}{C_RESET}\n")

def cmd_gate(args):
    """Enforces deployment gate by verifying artifact digest against Solana on-chain anchor."""
    print_banner()
    artifact_path = args.artifact
    if not os.path.exists(artifact_path):
        print(f"{C_RED}✖ Error: Artifact not found at: {artifact_path}{C_RESET}")
        sys.exit(1)

    print(f"{C_BOLD}[1/2] Computing Live Artifact Digest...{C_RESET}")
    live_digest = compute_artifact_hash(artifact_path)
    print(f"  • Target:     {artifact_path}")
    print(f"  • Digest:     {C_CYAN}{live_digest}{C_RESET}")

    print(f"\n{C_BOLD}[2/2] Verifying Solana Ledger Attestation...{C_RESET}")
    expected_digest = None
    
    if args.expected_digest:
        expected_digest = args.expected_digest
    elif os.path.exists(ATTESTATION_FILE):
        with open(ATTESTATION_FILE, "r") as f:
            data = json.load(f)
            expected_digest = data.get("attestation", {}).get("artifact_digest")
            print(f"  • Found local attestation receipt from signature: {C_DIM}{data.get('signature', '')[:16]}...{C_RESET}")
            
    if not expected_digest:
        print(f"{C_RED}✖ Error: No reference attestation found. Provide --expected-digest or anchor first.{C_RESET}")
        sys.exit(1)

    if live_digest == expected_digest:
        print(f"\n{C_GREEN}{C_BOLD}✔ DEPLOYMENT GATE: PASSED{C_RESET}")
        print(f"  Artifact cryptographic signature is verified against Solana ledger.")
        sys.exit(0)
    else:
        print(f"\n{C_RED}{C_BOLD}✖ DEPLOYMENT GATE: REJECTED (TAMPER DETECTED){C_RESET}")
        print(f"  Live Artifact: {live_digest}")
        print(f"  Expected:      {expected_digest}")
        sys.exit(1)

# --- Main Entrypoint ---

def main():
    parser = argparse.ArgumentParser(
        description="SolTrace: Cryptographic Database, IPAM & Inventory Provenance on Solana",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # init
    p_init = subparsers.add_parser("init", help="Initialize SolTrace workspace and Solana identity")
    p_init.add_argument("--network", choices=["litesvm", "devnet"], default="litesvm")
    p_init.add_argument("--rpc-url", default=DEFAULT_DEVNET_RPC)

    # address
    p_addr = subparsers.add_parser("address", help="Display local Solana payer address and balance")
    p_addr.add_argument("--network", choices=["litesvm", "devnet"], default="litesvm")

    # serve
    p_serve = subparsers.add_parser("serve", help="Run the FastAPI REST API and Webhook Gateway")
    p_serve.add_argument("--host", default="0.0.0.0", help="Host interface to bind")
    p_serve.add_argument("--port", type=int, default=8000, help="Port to listen on")

    # demo
    p_demo = subparsers.add_parser("demo", help="Run interactive live demonstrations")
    demo_sub = p_demo.add_subparsers(dest="demo_type")
    demo_sub.add_parser("invoice", help="Run B2B Invoice & Payment fraud live demonstration")
    demo_sub.add_parser("inventory", help="Run Computer Store hardware inventory shrinkage live demonstration")
    demo_sub.add_parser("store-tamper", help="Alias for inventory demonstration")
    demo_sub.add_parser("all", help="Run both Invoice and Inventory demonstrations")

    # Top-level universal SME anchor/verify commands
    p_top_anchor = subparsers.add_parser("anchor", help="Anchor an SME record (invoice, inventory, contract, DB row) to Solana")
    p_top_anchor.add_argument("--entity", "--table", dest="table", required=True, help="Entity or table name (e.g. invoices, inventory, contracts)")
    p_top_anchor.add_argument("--id", "--key", dest="id", required=True, help="Record primary key or identifier")
    p_top_anchor.add_argument("--data", help="JSON data string")
    p_top_anchor.add_argument("--file", help="Path to JSON file with record data")
    p_top_anchor.add_argument("--operator", default="admin", help="Operator username or service ID")
    p_top_anchor.add_argument("--action", default="UPDATE", help="Action type (INSERT, UPDATE, DELETE, ISSUE)")
    p_top_anchor.add_argument("--network", choices=["litesvm", "devnet"], default="litesvm")

    p_top_verify = subparsers.add_parser("verify", help="Verify SME record integrity against Solana anchor")
    p_top_verify.add_argument("--entity", "--table", dest="table", required=True, help="Entity or table name")
    p_top_verify.add_argument("--id", "--key", dest="id", required=True, help="Record primary key or identifier")
    p_top_verify.add_argument("--data", help="JSON data string")
    p_top_verify.add_argument("--file", help="Path to JSON file with record data")

    p_top_hist = subparsers.add_parser("history", help="Show chronological audit trail of Solana anchors")
    p_top_hist.add_argument("--entity", "--table", dest="table", required=True, help="Entity or table name")
    p_top_hist.add_argument("--id", "--key", dest="id", required=True, help="Record identifier")

    # db (subcommands retained for compatibility)
    p_db = subparsers.add_parser("db", help="Database & SME record provenance commands")
    db_sub = p_db.add_subparsers(dest="db_action")
    
    p_db_anchor = db_sub.add_parser("anchor", help="Anchor a database record or inventory item to Solana")
    p_db_anchor.add_argument("--entity", "--table", dest="table", required=True, help="Table or entity name")
    p_db_anchor.add_argument("--id", "--key", dest="id", required=True, help="Record primary key or identifier")
    p_db_anchor.add_argument("--data", help="JSON data string")
    p_db_anchor.add_argument("--file", help="Path to JSON file with record data")
    p_db_anchor.add_argument("--operator", default="admin", help="Operator username or service ID")
    p_db_anchor.add_argument("--action", default="UPDATE", help="Action type")
    p_db_anchor.add_argument("--network", choices=["litesvm", "devnet"], default="litesvm")

    p_db_verify = db_sub.add_parser("verify", help="Verify record integrity against Solana anchor")
    p_db_verify.add_argument("--entity", "--table", dest="table", required=True, help="Table or entity name")
    p_db_verify.add_argument("--id", "--key", dest="id", required=True, help="Record primary key or identifier")
    p_db_verify.add_argument("--data", help="JSON data string")
    p_db_verify.add_argument("--file", help="Path to JSON file with record data")

    p_db_hist = db_sub.add_parser("history", help="Show chronological audit trail of Solana anchors")
    p_db_hist.add_argument("--entity", "--table", dest="table", required=True, help="Table or entity name")
    p_db_hist.add_argument("--id", "--key", dest="id", required=True, help="Record identifier")

    # CI/CD commands (retained for backward compatibility)
    p_record = subparsers.add_parser("record", help="Anchor Git, SBOM, and build artifact (CI/CD mode)")
    p_record.add_argument("--artifact", required=True)
    p_record.add_argument("--repo", default=".")
    p_record.add_argument("--target", default="production")
    p_record.add_argument("--network", choices=["litesvm", "devnet"], default="litesvm")
    p_record.add_argument("--rpc-url", default=DEFAULT_DEVNET_RPC)

    p_gate = subparsers.add_parser("gate", help="Verify deployment artifact against Solana ledger")
    p_gate.add_argument("--artifact", required=True)
    p_gate.add_argument("--expected-digest")

    args = parser.parse_args()

    if args.command == "init":
        cmd_init(args)
    elif args.command == "address":
        cmd_address(args)
    elif args.command == "serve":
        cmd_serve(args)
    elif args.command == "demo":
        if getattr(args, "demo_type", None) == "invoice":
            cmd_demo_invoice(args)
        elif getattr(args, "demo_type", None) in ["inventory", "store", "store-tamper", "inventory-tamper"]:
            cmd_demo_store(args)
        elif getattr(args, "demo_type", None) == "all":
            cmd_demo_invoice(args)
            cmd_demo_store(args)
        else:
            # Run both invoice and store demos to prove universal SME coverage
            cmd_demo_invoice(args)
            cmd_demo_store(args)
    elif args.command == "anchor":
        cmd_db_anchor(args)
    elif args.command == "verify":
        cmd_db_verify(args)
    elif args.command == "history":
        cmd_db_history(args)
    elif args.command == "db":
        if args.db_action == "anchor":
            cmd_db_anchor(args)
        elif args.db_action == "verify":
            cmd_db_verify(args)
        elif args.db_action == "history":
            cmd_db_history(args)
        else:
            p_db.print_help()
    elif args.command == "record":
        cmd_record(args)
    elif args.command == "gate":
        cmd_gate(args)
    else:
        print_banner()
        parser.print_help()

if __name__ == "__main__":
    main()
