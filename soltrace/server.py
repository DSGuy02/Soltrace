"""
SolTrace REST API Gateway & Webhook Ingestion Server
Provides REST APIs for internal company software and native webhook adapters
for NetBox, Snipe-IT, and generic databases to anchor and verify records on Solana.
"""

import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from soltrace.db_hasher import (
    compute_record_hash,
    compute_db_state_seal,
    diff_records,
    format_db_attestation
)
from soltrace.chain import SolanaAnchorClient, DEFAULT_DEVNET_RPC
from soltrace.storage import SolTraceLedger, DEFAULT_DB_PATH

# Initialize App
app = FastAPI(
    title="SolTrace Universal SME Ledger Gateway",
    description="Universal Cryptographic Ledger on Solana for Small & Medium Enterprises (SMEs): Invoices, Inventory, Orders, Contracts, Code & Databases.",
    version="0.3.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for internal enterprise dashboards
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_DIR = ".soltrace"
KEYPAIR_FILE = os.path.join(CONFIG_DIR, "keypair.json")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")

def get_client() -> SolanaAnchorClient:
    network = "litesvm"
    rpc_url = DEFAULT_DEVNET_RPC
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                cfg = json.load(f)
                network = cfg.get("network", "litesvm")
                rpc_url = cfg.get("rpc_url", DEFAULT_DEVNET_RPC)
        except Exception:
            pass
            
    kp = SolanaAnchorClient.load_or_create_keypair(KEYPAIR_FILE)
    return SolanaAnchorClient(network=network, rpc_url=rpc_url, keypair=kp)

def get_ledger() -> SolTraceLedger:
    return SolTraceLedger(DEFAULT_DB_PATH)

# --- Pydantic Request/Response Models ---

class AnchorRecordRequest(BaseModel):
    table: str = Field(..., description="Table name or entity type (e.g. 'dcim_device', 'ipam_ip', 'asset')")
    record_id: str = Field(..., description="Unique record identifier or primary key")
    data: Dict[str, Any] = Field(..., description="Current state of the database record / inventory item")
    operator: Optional[str] = Field("system", description="User or service identity executing the change")
    action: Optional[str] = Field("UPDATE", description="Operation type: INSERT, UPDATE, DELETE, CHECKOUT, etc.")
    notes: Optional[str] = Field(None, description="Optional change justification or ticket reference")

class AnchorRecordResponse(BaseModel):
    success: bool
    status: str
    table: str
    record_id: str
    action: str
    state_seal: str
    record_hash: str
    network: str
    signature: str
    explorer_url: str
    timestamp: str

class VerifyRecordRequest(BaseModel):
    table: str = Field(..., description="Table name or entity type")
    record_id: str = Field(..., description="Unique record identifier")
    current_data: Dict[str, Any] = Field(..., description="Current live database state to be verified")

class VerifyRecordResponse(BaseModel):
    verified: bool
    status: str
    table: str
    record_id: str
    current_hash: str
    anchored_hash: Optional[str] = None
    last_signature: Optional[str] = None
    last_updated: Optional[str] = None
    differences: Optional[Dict[str, Any]] = None
    message: str

# --- Endpoints ---

@app.get("/")
def get_root():
    client = get_client()
    return {
        "service": "SolTrace Provenance Gateway",
        "version": "0.2.0",
        "description": "Cryptographic Database & Inventory Provenance on Solana",
        "solana_network": client.network,
        "payer_address": str(client.keypair.pubkey()),
        "docs_url": "/docs",
        "endpoints": {
            "anchor": "/api/v1/anchor",
            "verify": "/api/v1/verify",
            "history": "/api/v1/records/{table}/{record_id}/history",
            "webhooks": {
                "netbox": "/webhooks/netbox",
                "snipeit": "/webhooks/snipeit",
                "generic": "/webhooks/generic"
            }
        }
    }

@app.get("/health")
def healthcheck():
    client = get_client()
    return {
        "status": "healthy",
        "solana_connected": True,
        "network": client.network,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.post("/api/v1/anchor", response_model=AnchorRecordResponse)
def anchor_record(req: AnchorRecordRequest):
    """
    Anchors a database record or inventory mutation to the Solana blockchain.
    Computes deterministic SHA-256 state seal and commits an immutable Memo on-chain.
    """
    ledger = get_ledger()
    client = get_client()
    
    timestamp = datetime.now(timezone.utc).isoformat()
    rec_hash = compute_record_hash(req.table, req.record_id, req.data)
    
    # Check for previous state seal to maintain hash chain
    existing = ledger.get_latest_record(req.table, req.record_id)
    prev_seal = existing["current_seal"] if existing else "GENESIS"
    
    state_seal = compute_db_state_seal(
        table=req.table,
        record_id=req.record_id,
        current_data=req.data,
        prev_seal=prev_seal,
        timestamp=timestamp,
        operator=req.operator or "system"
    )
    
    attestation = format_db_attestation(
        table=req.table,
        record_id=req.record_id,
        state_seal=state_seal,
        action=req.action or "UPDATE",
        operator=req.operator or "system",
        timestamp=timestamp,
        record_hash=rec_hash
    )
    
    # Anchor to Solana
    tx_res = client.anchor_attestation(attestation)
    
    if not tx_res.get("success"):
        raise HTTPException(
            status_code=502,
            detail=f"Solana anchoring failed: {tx_res.get('error', 'Unknown error')}"
        )
        
    sig = tx_res.get("signature", "")
    explorer = tx_res.get("explorer_url", "")
    network = tx_res.get("network", client.network)
    
    # Save to local verifiable ledger
    ledger.save_attestation(
        table_name=req.table,
        record_id=req.record_id,
        action=req.action or "UPDATE",
        state_seal=state_seal,
        record_hash=rec_hash,
        data=req.data,
        signature=sig,
        network=network,
        explorer_url=explorer,
        operator=req.operator or "system",
        timestamp=timestamp,
        prev_seal=prev_seal
    )
    
    return AnchorRecordResponse(
        success=True,
        status="ANCHORED_ON_SOLANA",
        table=req.table,
        record_id=req.record_id,
        action=req.action or "UPDATE",
        state_seal=state_seal,
        record_hash=rec_hash,
        network=network,
        signature=sig,
        explorer_url=explorer,
        timestamp=timestamp
    )

@app.post("/api/v1/verify", response_model=VerifyRecordResponse)
def verify_record(req: VerifyRecordRequest):
    """
    Verifies the integrity of a database record against the immutable Solana ledger.
    If the database row was tampered with directly via raw SQL, SolTrace flags TAMPER_DETECTED.
    """
    ledger = get_ledger()
    existing = ledger.get_latest_record(req.table, req.record_id)
    
    current_hash = compute_record_hash(req.table, req.record_id, req.current_data)
    
    if not existing:
        return VerifyRecordResponse(
            verified=False,
            status="RECORD_NOT_ANCHORED",
            table=req.table,
            record_id=req.record_id,
            current_hash=current_hash,
            message="No on-chain attestation found for this record."
        )
        
    anchored_hash = existing["record_hash"]
    last_sig = existing["last_signature"]
    last_ts = existing["last_updated"]
    
    if current_hash == anchored_hash:
        return VerifyRecordResponse(
            verified=True,
            status="VERIFIED",
            table=req.table,
            record_id=req.record_id,
            current_hash=current_hash,
            anchored_hash=anchored_hash,
            last_signature=last_sig,
            last_updated=last_ts,
            message="✔ Database record perfectly matches on-chain Solana attestation."
        )
    else:
        # Cryptographic mismatch: calculate differences
        diff = diff_records(existing["data"], req.current_data)
        return VerifyRecordResponse(
            verified=False,
            status="TAMPER_DETECTED",
            table=req.table,
            record_id=req.record_id,
            current_hash=current_hash,
            anchored_hash=anchored_hash,
            last_signature=last_sig,
            last_updated=last_ts,
            differences=diff,
            message="✖ ALERT: Database record has been altered out-of-band! Cryptographic hash does not match Solana anchor."
        )

@app.get("/api/v1/records/{table}/{record_id}/history")
def get_record_history(table: str, record_id: str):
    """Retrieves full chronological audit trail and Solana transaction signatures for a record."""
    ledger = get_ledger()
    history = ledger.get_history(table, record_id)
    return {
        "table": table,
        "record_id": record_id,
        "total_anchors": len(history),
        "history": history
    }

# --- Webhook Ingestion Adapters ---

@app.post("/webhooks/netbox")
async def webhook_netbox(request: Request):
    """
    Native webhook adapter for NetBox (IPAM / DCIM).
    Directly consumes standard NetBox webhook payloads on dcim.device, ipam.ipaddress, dcim.rack.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    event = payload.get("event", "updated")
    model = payload.get("model", "generic")
    data = payload.get("data", {})
    username = payload.get("username", "netbox_admin")
    
    # NetBox devices/IPs use 'name', 'address', or 'id'
    record_id = (
        data.get("name") or 
        data.get("address") or 
        str(data.get("id", "unknown"))
    )
    
    table_name = f"netbox_{model.replace('.', '_')}"
    
    # Extract cleaned data payload
    anchor_req = AnchorRecordRequest(
        table=table_name,
        record_id=str(record_id),
        data=data,
        operator=f"netbox:{username}",
        action=event.upper(),
        notes=f"NetBox Webhook event '{event}' on {model}"
    )
    
    return anchor_record(anchor_req)

@app.post("/webhooks/snipeit")
async def webhook_snipeit(request: Request):
    """
    Native webhook adapter for Snipe-IT (IT Asset Management).
    Consumes Snipe-IT event webhooks for assets, licenses, and components.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    target_type = payload.get("target_type", "asset")
    action_type = payload.get("action_type", "update")
    item = payload.get("item", {})
    admin = payload.get("admin", {})
    
    record_id = (
        item.get("asset_tag") or 
        item.get("serial") or 
        str(item.get("id", "unknown"))
    )
    
    admin_name = admin.get("email") or admin.get("name") or "snipeit_admin"
    table_name = f"snipeit_{target_type}"
    
    anchor_req = AnchorRecordRequest(
        table=table_name,
        record_id=str(record_id),
        data=item,
        operator=f"snipeit:{admin_name}",
        action=action_type.upper(),
        notes=f"Snipe-IT Webhook {action_type} on {target_type}"
    )
    
    return anchor_record(anchor_req)

@app.post("/webhooks/inventory")
@app.post("/webhooks/store")
async def webhook_inventory(request: Request):
    """
    Native webhook adapter for Computer Store & Retail Hardware Inventory systems.
    Ingests device stock events (Brand, Type, Storage Size/Type, Quantity, RAM Size/Type, Wireless Specs).
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    event = payload.get("event") or payload.get("action") or "STOCK_UPDATE"
    operator = payload.get("operator") or payload.get("user") or "store_clerk"
    
    # Check if payload nests under 'device' or 'item' or is flat
    device_data = payload.get("device") or payload.get("item") or payload.get("data") or payload
    
    sku = (
        device_data.get("sku") or 
        device_data.get("serial") or 
        device_data.get("id") or 
        payload.get("sku") or
        "UNKNOWN-SKU"
    )
    
    table_name = "store_inventory"
    
    anchor_req = AnchorRecordRequest(
        table=table_name,
        record_id=str(sku),
        data=device_data,
        operator=f"store:{operator}",
        action=str(event).upper(),
        notes=f"Computer store hardware event: {event}"
    )
    
    return anchor_record(anchor_req)

@app.post("/webhooks/invoice")
@app.post("/webhooks/billing")
async def webhook_invoice(request: Request):
    """
    Native webhook adapter for SME Invoicing, Billing & Accounting (QuickBooks, Xero, Stripe).
    Anchors invoice metadata, recipient IBAN, amounts, tax codes, and payment milestones.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    event = payload.get("event") or payload.get("action") or "INVOICE_ISSUED"
    operator = payload.get("operator") or payload.get("user") or "accounting_system"
    
    inv_data = payload.get("invoice") or payload.get("data") or payload
    invoice_id = (
        inv_data.get("invoice_id") or 
        inv_data.get("invoice_number") or 
        inv_data.get("id") or 
        payload.get("invoice_id") or
        "UNKNOWN-INV"
    )
    
    anchor_req = AnchorRecordRequest(
        table="invoices",
        record_id=str(invoice_id),
        data=inv_data,
        operator=f"invoice:{operator}",
        action=str(event).upper(),
        notes=f"SME Invoice event: {event}"
    )
    return anchor_record(anchor_req)

@app.post("/webhooks/order")
@app.post("/webhooks/ecommerce")
async def webhook_order(request: Request):
    """
    Native webhook adapter for SME E-Commerce & Order Management (Shopify, WooCommerce, Stripe Orders).
    Anchors purchase orders, line items, shipping addresses, and payment receipts.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    event = payload.get("event") or payload.get("action") or "ORDER_CREATED"
    operator = payload.get("operator") or payload.get("user") or "store_platform"
    
    order_data = payload.get("order") or payload.get("data") or payload
    order_id = (
        order_data.get("order_id") or 
        order_data.get("order_number") or 
        order_data.get("id") or 
        payload.get("order_id") or
        "UNKNOWN-ORDER"
    )
    
    anchor_req = AnchorRecordRequest(
        table="orders",
        record_id=str(order_id),
        data=order_data,
        operator=f"ecommerce:{operator}",
        action=str(event).upper(),
        notes=f"E-commerce order event: {event}"
    )
    return anchor_record(anchor_req)

@app.post("/webhooks/generic")
async def webhook_generic(request: Request):
    """Universal webhook adapter for any internal ERP, WMS, or database CDC pipeline."""
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    table = payload.get("table") or payload.get("entity") or "internal_records"
    record_id = payload.get("id") or payload.get("record_id") or payload.get("key")
    data = payload.get("data") or payload.get("record") or payload
    operator = payload.get("operator") or payload.get("user") or "webhook"
    action = payload.get("action") or payload.get("event") or "UPDATE"
    
    if not record_id:
        raise HTTPException(status_code=400, detail="Could not determine record_id from payload")
        
    anchor_req = AnchorRecordRequest(
        table=str(table),
        record_id=str(record_id),
        data=data,
        operator=str(operator),
        action=str(action).upper()
    )
    
    return anchor_record(anchor_req)
