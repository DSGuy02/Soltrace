import pytest
from fastapi.testclient import TestClient
from soltrace.server import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "SolTrace Provenance Gateway" in data["service"]
    assert "docs_url" in data

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["solana_connected"] is True

def test_anchor_and_verify_clean_record():
    payload = {
        "table": "dcim_device",
        "record_id": "TEST-SRV-01",
        "data": {
            "model": "PowerEdge R750",
            "rack": "Rack-01",
            "ip": "10.10.10.5",
            "status": "active"
        },
        "operator": "engineer@intel.internal",
        "action": "CREATE"
    }
    
    # 1. Anchor Record
    anchor_resp = client.post("/api/v1/anchor", json=payload)
    assert anchor_resp.status_code == 200
    anchor_data = anchor_resp.json()
    assert anchor_data["success"] is True
    assert anchor_data["status"] == "ANCHORED_ON_SOLANA"
    assert "signature" in anchor_data
    assert len(anchor_data["state_seal"]) == 64
    
    # 2. Verify with identical clean data
    verify_req = {
        "table": "dcim_device",
        "record_id": "TEST-SRV-01",
        "current_data": payload["data"]
    }
    verify_resp = client.post("/api/v1/verify", json=verify_req)
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["verified"] is True
    assert verify_data["status"] == "VERIFIED"

def test_tamper_detection():
    payload = {
        "table": "dcim_device",
        "record_id": "TEST-SRV-TAMPER",
        "data": {
            "mac": "AA:BB:CC:DD:EE:FF",
            "ip": "192.168.1.100",
            "status": "active"
        },
        "operator": "admin",
        "action": "CREATE"
    }
    
    # Anchor legitimate
    client.post("/api/v1/anchor", json=payload)
    
    # Verify with modified data (tampered out-of-band)
    tampered_data = {
        "mac": "AA:BB:CC:DD:EE:FF",
        "ip": "192.168.1.200",  # Changed IP
        "status": "decommissioned" # Changed status
    }
    verify_req = {
        "table": "dcim_device",
        "record_id": "TEST-SRV-TAMPER",
        "current_data": tampered_data
    }
    verify_resp = client.post("/api/v1/verify", json=verify_req)
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["verified"] is False
    assert verify_data["status"] == "TAMPER_DETECTED"
    assert "differences" in verify_data
    assert "ip" in verify_data["differences"]["modified"]
    assert "status" in verify_data["differences"]["modified"]

def test_netbox_webhook():
    netbox_payload = {
        "event": "updated",
        "timestamp": "2026-09-26T14:30:00Z",
        "model": "dcim.device",
        "username": "netbox_user",
        "data": {
            "id": 55,
            "name": "DUB-CORE-SW-01",
            "status": {"value": "active"},
            "rack": {"name": "Rack-IE-01"},
            "comments": "Core switch anchored to Solana"
        }
    }
    resp = client.post("/webhooks/netbox", json=netbox_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["table"] == "netbox_dcim_device"
    assert data["record_id"] == "DUB-CORE-SW-01"
    assert "netbox:netbox_user" in data["signature"] or "signature" in data

def test_snipeit_webhook():
    snipeit_payload = {
        "target_type": "asset",
        "action_type": "checkout",
        "admin": {"name": "AssetAdmin", "email": "admin@company.com"},
        "item": {
            "id": 12,
            "asset_tag": "ASSET-MBP-99",
            "name": "MacBook Pro 16",
            "assigned_to": "Engineer X"
        }
    }
    resp = client.post("/webhooks/snipeit", json=snipeit_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["table"] == "snipeit_asset"
    assert data["record_id"] == "ASSET-MBP-99"

def test_record_history():
    table = "dcim_device"
    rec_id = "HIST-SRV-01"
    
    # Anchor transition 1
    client.post("/api/v1/anchor", json={
        "table": table,
        "record_id": rec_id,
        "data": {"v": 1},
        "operator": "user1",
        "action": "CREATE"
    })
    # Anchor transition 2
    client.post("/api/v1/anchor", json={
        "table": table,
        "record_id": rec_id,
        "data": {"v": 2},
        "operator": "user2",
        "action": "UPDATE"
    })
    
    resp = client.get(f"/api/v1/records/{table}/{rec_id}/history")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_anchors"] >= 2
    assert len(data["history"]) >= 2

def test_computer_store_inventory_webhook():
    store_payload = {
        "event": "stock_shipment_received",
        "operator": "dublin_store_manager",
        "device": {
            "sku": "LAP-APL-MBP16-TEST",
            "brand": "Apple",
            "type": "laptop",
            "model": "MacBook Pro 16",
            "storage_size": "1TB",
            "storage_type": "NVMe Gen4 SSD",
            "quantity": 20,
            "ram_size": "36GB",
            "ram_type": "Unified LPDDR5X",
            "wireless_specs": "Wi-Fi 6E + Bluetooth 5.3"
        }
    }
    resp = client.post("/webhooks/inventory", json=store_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["table"] == "store_inventory"
    assert data["record_id"] == "LAP-APL-MBP16-TEST"
    assert "store:dublin_store_manager" in data["signature"] or "signature" in data

def test_invoice_webhook():
    invoice_payload = {
        "event": "invoice_approved",
        "operator": "quickbooks_connector",
        "invoice": {
            "invoice_number": "INV-2026-TEST-99",
            "client": "Acme Global",
            "amount": 9500.00,
            "recipient_iban": "IE29AIBK93115212345678"
        }
    }
    resp = client.post("/webhooks/invoice", json=invoice_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["table"] == "invoices"
    assert data["record_id"] == "INV-2026-TEST-99"

def test_order_webhook():
    order_payload = {
        "event": "order_placed",
        "operator": "shopify_webhook",
        "order": {
            "order_number": "ORD-10042",
            "customer": "customer@example.com",
            "total_price": 149.99
        }
    }
    resp = client.post("/webhooks/order", json=order_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["table"] == "orders"
    assert data["record_id"] == "ORD-10042"

def test_dashboard_page():
    resp = client.get("/dashboard")
    assert resp.status_code == 200
    assert "SolTrace" in resp.text
    assert "Universal Cryptographic Ledger" in resp.text
    assert "Interactive Showcase" in resp.text

def test_static_assets():
    resp_css = client.get("/static/style.css")
    assert resp_css.status_code == 200
    assert "--solana-cyan" in resp_css.text

    resp_js = client.get("/static/app.js")
    assert resp_js.status_code == 200
    assert "SHOWCASE_PRESETS" in resp_js.text

def test_list_records_endpoint():
    resp = client.get("/api/v1/records")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)

def test_examples_endpoint():
    resp = client.get("/api/v1/examples")
    assert resp.status_code == 200
    data = resp.json()
    assert "invoice" in data
    assert "computer_store_catalog" in data
    assert "order" in data

def test_cpa_certificate_endpoint():
    # Anchor an invoice first
    inv_payload = {
        "table": "invoices",
        "record_id": "CERT-INV-001",
        "data": {
            "amount": 5000.00,
            "iban": "IE29AIBK93012345678901"
        },
        "operator": "cfo@company.com",
        "action": "ISSUE"
    }
    client.post("/api/v1/anchor", json=inv_payload)

    # Get certificate
    cert_resp = client.get("/api/v1/certificate/invoices/CERT-INV-001")
    assert cert_resp.status_code == 200
    cert = cert_resp.json()
    assert cert["status"] == "MATHEMATICALLY_VERIFIED"
    assert cert["entity"] == "invoices"
    assert cert["record_id"] == "CERT-INV-001"
    assert len(cert["state_seal"]) == 64
    assert len(cert["solana_signature"]) > 0

