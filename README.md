# SolTrace 🛡️
> **Universal Cryptographic Ledger Sidecar for Any SME & Software Team on Solana**  
> *Built for the Colosseum Crypto World's Fair Hackathon (Sept 14 – Oct 12, 2026)*  
> *Sub-Cent Mathematical Immutability for Invoicing, Retail Inventory, Order Fulfillment, Code & Enterprise Databases.*

---

## 🚀 Overview

Small and medium enterprises (SMEs) and software teams face a critical, systemic security vulnerability: **standard business software stores mission-critical financial, operational, and software state in mutable relational databases** (PostgreSQL, MySQL, QuickBooks, Xero, Shopify, InvenTree). Anyone with database administrative rights, raw SQL access, or compromised credentials can silently edit bank accounts, delete stolen inventory counts, inflate prices, or alter code—leaving zero mathematical proof of non-repudiation.

### The Real-World Fraud & Shrinkage Problem
* **$112B+ in Annual Retail Shrinkage:** According to the **National Retail Federation (NRF)**, retail shrinkage exceeds $112 Billion annually in the US alone, with **internal employee theft accounting for ~29% (~$32B+)**—frequently concealed by dishonest staff modifying stock quantities directly in inventory databases.
* **$3B+ in Annual Reported Wire & Invoice Fraud:** The **FBI Internet Crime Complaint Center (IC3)** reports that Business Email Compromise (BEC) and vendor invoice tampering drive over **$3.0 Billion in direct annual reported losses** ($50B+ cumulative globally), with targeted businesses suffering an average loss of **$123,000 per incident**.
* **5% of Total Annual Revenue Lost to Fraud:** The **Association of Certified Fraud Examiners (ACFE)** estimates that organizations lose 5% of their gross revenue to occupational fraud each year, with internal billing and payment tampering schemes causing a median loss of **$100,000+** before detection. Small businesses face the greatest proportional risk due to limited separation of duties.
* **The "Root Privilege Paradox":** Traditional database and cloud audit logs can be truncated or deleted by the very administrators or compromised accounts carrying out the attack.

**SolTrace** solves this by acting as an invisible cryptographic sidecar:
1. **Deterministic State Seals:** Computes canonical SHA-256 digests across any business record (B2B invoices, hardware inventories, purchase orders, legal contracts) or software artifact (Git commits, SBOMs, binaries).
2. **Sub-Cent Solana Consensus:** Anchors state transitions directly to the **Solana Memo Program** (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) in ~400ms for $\approx \$0.00075$ (5,000 lamports / under a tenth of a cent).
3. **Zero-Knowledge Data Privacy:** Zero raw customer data, confidential pricing, or PII ever touches the blockchain—only one-way mathematical digests, ensuring complete GDPR and commercial privacy compliance.
4. **Instant Tamper Detection & Fraud Prevention:** Audits live state against Solana's immutable consensus. If an attacker tampers with an IBAN, inflates an invoice total, wipes stolen retail inventory, or modifies code, SolTrace immediately triggers **TAMPER DETECTED** with a color-coded forensic diff.
5. **Zero-Crypto UX for SMEs:** Integrates via standard REST APIs, webhooks, and background daemons. Business owners pay standard fiat subscriptions while SolTrace manages custodial keypairs and Solana gas under the hood.

---

## 🏆 Colosseum Crypto World's Fair Hackathon Context

- **Track:** Solana Infrastructure & SME Fintech
- **Event Dates:** September 14 – October 12, 2026
- **Founder:** Oladeji Sanyaolu

---

## 📂 Project Structure

```
prototypes/soltrace/
├── bin/
│   └── soltrace                         # Primary CLI entrypoint (auto-detects virtualenv)
├── soltrace/
│   ├── __init__.py                      # Package metadata (SolTrace v0.3.0)
│   ├── db_hasher.py                     # Canonical JSON serialization & SHA-256 state seal engine
│   ├── storage.py                       # Verifiable local SQLite ledger & state transition index
│   ├── server.py                        # FastAPI REST Gateway & Webhook Ingestion server
│   ├── chain.py                         # Solana Devnet & LiteSVM on-chain anchor client
│   ├── hasher.py                        # Git, SBOM, and Artifact digest engine (DevOps CI/CD)
│   └── cli.py                           # Unified CLI (demo, anchor, verify, history, serve, gate)
├── examples/
│   ├── sample_invoice.json              # Sample B2B Invoice with line items & bank details
│   ├── computer_store_catalog.json      # Sample retail computer store hardware catalog
│   └── sample_order.json                # Sample e-commerce customer order
├── tests/
│   ├── test_db_hasher.py                # Database hasher & state seal unit tests
│   ├── test_server.py                   # FastAPI REST endpoints & webhook integration tests
│   └── test_soltrace.py                 # Core Solana anchoring & CI/CD gate tests
├── demo_sme_showcase.sh                 # 1-Click Multi-Vertical SME Demonstration (Invoices + Inventory)
├── demo_computer_store.sh               # 1-Click Retail Hardware Tamper & Shrinkage Demo
├── demo_local.sh                        # 1-Click Showcase launcher
└── README.md                            # Complete documentation & quickstart
```

---

## ⚡ Quickstart

### 🎯 1-Command Multi-Vertical Demonstration
Run the complete multi-vertical showcase (covers B2B Invoicing BEC wire fraud defense and Retail Hardware Shrinkage detection):

```bash
./demo_sme_showcase.sh
```

Or execute via the `soltrace` CLI:
```bash
./bin/soltrace demo all
```

You can also run specific vertical demos:
```bash
# 1. B2B Invoicing & BEC Wire Fraud Protection Demo
./bin/soltrace demo invoice

# 2. Computer Store Hardware Inventory & Shrinkage Demo
./bin/soltrace demo inventory
```

---

## 🖥️ REST API Gateway & Webhooks

SolTrace includes an enterprise-ready FastAPI Gateway with auto-generated OpenAPI documentation.

### Launching the Server
```bash
./bin/soltrace serve --host 0.0.0.0 --port 8000
```

Open **[http://localhost:8000/docs](http://localhost:8000/docs)** for the interactive Swagger UI.

### Key REST Endpoints

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/v1/anchor` | `POST` | Anchor arbitrary business entity or record to Solana |
| `/api/v1/verify` | `POST` | Audit live entity state against the on-chain Solana seal |
| `/api/v1/records/{entity}/{id}/history` | `GET` | Retrieve verifiable cryptographic audit trail |
| `/webhooks/invoice` | `POST` | Ingest B2B invoices (QuickBooks, Xero, Stripe Invoicing) |
| `/webhooks/order` | `POST` | Ingest e-commerce customer orders (Shopify, WooCommerce) |
| `/webhooks/inventory` | `POST` | Ingest retail hardware inventory stock events |
| `/webhooks/store` | `POST` | Ingest computer store hardware catalog events |
| `/webhooks/snipeit` | `POST` | Ingest Snipe-IT IT asset management check-in/out |
| `/webhooks/netbox` | `POST` | Ingest NetBox IPAM / DCIM infrastructure state |
| `/webhooks/generic` | `POST` | Universal JSON adapter for custom ERPs and CDC pipelines |

---

## 💻 CLI Usage

The `soltrace` binary provides high-level commands for any business record or software artifact.

### 1. Anchor a Record
Anchor an invoice, inventory item, purchase order, or contract:
```bash
./bin/soltrace anchor \
  --entity invoices \
  --id "INV-2026-0891" \
  --data '{
    "client": "Acme Retail Ltd",
    "total_eur": 18265.50,
    "iban": "IE29AIBK93012345678901",
    "bic": "AIBKIE2D",
    "due_date": "2026-10-15"
  }' \
  --operator "cfo@soltrace-demo.com" \
  --action "INVOICE_ISSUED"
```

### 2. Verify an Authentic Record
```bash
./bin/soltrace verify \
  --entity invoices \
  --id "INV-2026-0891" \
  --data '{
    "client": "Acme Retail Ltd",
    "total_eur": 18265.50,
    "iban": "IE29AIBK93012345678901",
    "bic": "AIBKIE2D",
    "due_date": "2026-10-15"
  }'
```
*Output: `✔ AUDIT PASSED: RECORD IS AUTHENTIC & VERIFIED`*

### 3. Verify a Tampered Record (e.g. Swapped IBAN & Inflated Amount)
```bash
./bin/soltrace verify \
  --entity invoices \
  --id "INV-2026-0891" \
  --data '{
    "client": "Acme Retail Ltd",
    "total_eur": 22265.50,
    "iban": "RU88HACK00009999888877",
    "bic": "HACKRUMM",
    "due_date": "2026-10-15"
  }'
```
*Output: `✖ CRITICAL ALERT: UNAUTHORIZED TAMPERING DETECTED!` with precise field-by-field diff.*

### 4. Query Verifiable On-Chain Timeline
```bash
./bin/soltrace history --entity invoices --id "INV-2026-0891"
```

---

## 🛡️ DevOps & CI/CD Engine

For software and DevOps teams, SolTrace retains its source-code and artifact provenance engine:
- **Anchor Artifact & SBOM:** `./bin/soltrace record --artifact dist/app.bin`
- **Enforce Deployment Gate:** `./bin/soltrace gate --artifact dist/app.bin`
- **GitHub Action:** Ready for CI/CD pipelines via `.github/workflows/soltrace-ci.yml` and `action.yml`.

---

## 🧪 Automated Test Suite

Run the full pytest suite (21 automated tests covering canonical serialization, SQLite verifiable storage, Solana Memo transactions, REST endpoints, and multi-vertical webhooks):

```bash
PYTHONPATH=prototypes/soltrace .venv/bin/pytest prototypes/soltrace/tests
```

---

## 🤖 AI Usage Disclaimer

Portions of this codebase, test suites, and documentation were built with the assistance of AI development tools (Google Gemini & Antigravity), under human architectural direction and verification.
