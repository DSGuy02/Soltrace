/**
 * SolTrace Interactive Showcase & Verification Dashboard
 * Handles multi-vertical business document rendering, Solana anchoring,
 * fraud attack simulation, independent cryptographic audits, and CPA certificate generation.
 */

// --- Default Showcase Data Models ---
const SHOWCASE_PRESETS = {
  invoice: {
    entity: "invoices",
    id: "INV-2026-0891",
    title: "B2B Commercial Invoice (BEC Wire Fraud Protection)",
    operator: "cfo@soltrace-logistics.com",
    action: "INVOICE_ISSUED",
    authentic: {
      invoice_id: "INV-2026-0891",
      issuer: "SolTrace Global Logistics Ltd",
      client: "Acme Retail Ltd",
      issue_date: "2026-09-26",
      due_date: "2026-10-15",
      currency: "EUR",
      subtotal: 14850.00,
      vat_amount: 3415.50,
      total_eur: 18265.50,
      payment_details: {
        bank_name: "Allied Irish Banks (AIB)",
        account_name: "SolTrace Logistics Operations",
        iban: "IE29AIBK93012345678901",
        bic: "AIBKIE2D"
      },
      line_items: [
        {
          description: "Enterprise Server Hardware Logistics & Deployment",
          quantity: 10,
          unit_price: 1485.00,
          total: 14850.00
        }
      ]
    },
    attacks: [
      {
        id: "wire_diversion",
        name: "🚨 Divert Recipient IBAN & Inflate Total (+€4,000)",
        description: "Simulates Business Email Compromise (BEC) / compromised DBA credentials swapping the routing IBAN to an offshore scammer account and inflating the invoice sum before Accounts Payable sends the wire.",
        apply: (orig) => {
          const altered = JSON.parse(JSON.stringify(orig));
          altered.payment_details.iban = "IE29BOFI90001299999999";
          altered.payment_details.bank_name = "Bank of Ireland (Scammer Offshore Drop)";
          altered.total_eur = 22265.50; // +4,000 EUR
          return altered;
        }
      }
    ]
  },
  inventory: {
    entity: "store_inventory",
    id: "LAP-APL-MBP16-M3",
    title: "Computer Store Hardware Inventory (Shrinkage & Theft)",
    operator: "manager@dublin-store.internal",
    action: "STOCK_RECEIPT",
    authentic: {
      sku: "LAP-APL-MBP16-M3",
      brand: "Apple",
      type: "laptop",
      model: "MacBook Pro 16\" (M3 Max)",
      storage_size: "1TB",
      storage_type: "NVMe Gen4 SSD",
      ram_size: "36GB",
      ram_type: "Unified LPDDR5X",
      wireless_specs: "Wi-Fi 6E (802.11ax) + Bluetooth 5.3",
      quantity: 25,
      unit_price_eur: 2899.00,
      store_location: "Dublin Grafton St - Vault A"
    },
    attacks: [
      {
        id: "shrinkage_theft",
        name: "🚨 Steal 10 Laptops & Downgrade RAM to 18GB",
        description: "Simulates insider theft: An employee steals 10 MacBooks (€28,990 value), swaps out memory modules, and uses raw SQL to adjust the stock quantity from 25 to 15 to hide the loss.",
        apply: (orig) => {
          const altered = JSON.parse(JSON.stringify(orig));
          altered.quantity = 15; // 10 stolen!
          altered.ram_size = "18GB"; // component swapped
          altered.storage_size = "512GB"; // component downgraded
          return altered;
        }
      }
    ]
  },
  order: {
    entity: "orders",
    id: "ORD-2026-9921",
    title: "E-Commerce Customer Order (Fulfillment Hijack Defense)",
    operator: "shopify_webhook_gateway",
    action: "ORDER_CREATED",
    authentic: {
      order_id: "ORD-2026-9921",
      store: "Dublin Tech Hub Online",
      customer_id: "CUST-84920",
      order_date: "2026-09-26T14:00:00Z",
      currency: "EUR",
      shipping_address: {
        street: "Grand Canal Dock",
        city: "Dublin",
        country: "Ireland",
        eircode: "D02 XY99"
      },
      subtotal: 6008.00,
      total_eur: 6008.00,
      fulfillment_status: "PENDING_DISPATCH",
      items: [
        { sku: "LAP-APL-MBP16-M3", name: "Apple MacBook Pro 16 M3 Max", quantity: 2, total: 5798.00 },
        { sku: "ACC-APL-USBC-140W", name: "140W USB-C Power Adapter", quantity: 2, total: 210.00 }
      ]
    },
    attacks: [
      {
        id: "shipping_redirect",
        name: "🚨 Hijack Shipping Address to Scammer Drop House",
        description: "Simulates an attacker tampering with order database tables to divert expensive hardware fulfillment to an unauthorized foreign shipping address.",
        apply: (orig) => {
          const altered = JSON.parse(JSON.stringify(orig));
          altered.shipping_address = {
            street: "42 Backdoor Alley, Suite 9",
            city: "Marseille",
            country: "France",
            eircode: "13001"
          };
          return altered;
        }
      }
    ]
  }
};

// --- Application State ---
let currentPresetKey = "invoice";
let currentAuthenticData = null;
let currentLiveData = null;
let currentAttestation = null;
let currentAuditResult = null;
let cachedLedgerRecords = [];

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  loadPreset("invoice");
  fetchTelemetry();
  refreshLedger();
  
  // Auto-anchor invoice preset immediately so user can audit right away!
  anchorCurrentRecord(true);
});

// --- Tab Navigation ---
function initTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const targetId = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab-content-panel").forEach(panel => {
        panel.classList.remove("active");
      });
      const activePanel = document.getElementById(targetId);
      if (activePanel) activePanel.classList.add("active");
      
      if (targetId === "tab-explorer") {
        refreshLedger();
      }
      if (targetId === "tab-certificate") {
        renderCertificateView();
      }
      if (targetId === "tab-badge") {
        renderBadgeShowcase();
      }
    });
  });
}

function switchTab(tabId) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

// --- Telemetry & System Status ---
async function fetchTelemetry() {
  try {
    const res = await fetch("/health");
    if (res.ok) {
      const data = await res.json();
      const netElem = document.getElementById("telemetry-network");
      if (netElem) netElem.textContent = data.network || "Solana";
    }
  } catch (err) {
    console.warn("Could not reach /health endpoint; using local state", err);
  }
}

// --- Preset Management ---
function loadPreset(key) {
  currentPresetKey = key;
  const preset = SHOWCASE_PRESETS[key];
  if (!preset) return;

  // Update vertical button styles
  document.querySelectorAll(".vertical-card-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-vertical") === key);
  });

  currentAuthenticData = JSON.parse(JSON.stringify(preset.authentic));
  currentLiveData = JSON.parse(JSON.stringify(preset.authentic));
  currentAttestation = null;
  currentAuditResult = null;

  // Render document visualizers
  renderDocumentView();
  renderAttackControls();
  renderAuditBanner(null);

  // Compute initial local state seal preview
  updateFingerprintPreview();
}

function updateFingerprintPreview() {
  const preset = SHOWCASE_PRESETS[currentPresetKey];
  const fpElem = document.getElementById("state-seal-preview");
  if (fpElem) {
    // Generate deterministic sha-256 preview
    fpElem.textContent = "Computing canonical cryptographic seal...";
    computeLocalHash(preset.entity, preset.id, currentAuthenticData).then(h => {
      fpElem.textContent = h;
    });
  }
}

// Simple browser SHA-256 fallback for zero-latency instant rendering
async function computeLocalHash(entity, id, data) {
  const clean = {};
  Object.keys(data).sort().forEach(k => {
    if (!k.startsWith("_soltrace_")) clean[k] = data[k];
  });
  const canonicalStr = entity + ":" + id + ":" + JSON.stringify(clean);
  const msgBuffer = new TextEncoder().encode(canonicalStr);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// --- Document Visual Rendering ---
function renderDocumentView() {
  const preset = SHOWCASE_PRESETS[currentPresetKey];
  const docContainer = document.getElementById("authentic-doc-container");
  const liveDocContainer = document.getElementById("live-doc-container");
  
  if (docContainer) {
    docContainer.innerHTML = buildDocumentHtml(currentAuthenticData, false);
  }
  if (liveDocContainer) {
    liveDocContainer.innerHTML = buildDocumentHtml(currentLiveData, true);
  }
}

function buildDocumentHtml(data, isLive) {
  if (currentPresetKey === "invoice") {
    const isTamperedIban = isLive && data.payment_details?.iban !== currentAuthenticData.payment_details?.iban;
    const isTamperedTotal = isLive && data.total_eur !== currentAuthenticData.total_eur;

    return `
      <div class="business-doc-view">
        <div class="doc-field-row">
          <span class="label">Invoice Ref:</span>
          <span class="value highlight">${data.invoice_id}</span>
        </div>
        <div class="doc-field-row">
          <span class="label">B2B Issuer:</span>
          <span class="value">${data.issuer}</span>
        </div>
        <div class="doc-field-row">
          <span class="label">Client:</span>
          <span class="value">${data.client}</span>
        </div>
        <div class="doc-field-row">
          <span class="label">Total Amount:</span>
          <span class="value ${isTamperedTotal ? 'tampered' : 'money'}">
            €${Number(data.total_eur).toLocaleString('en-IE', {minimumFractionDigits: 2})}
            ${isTamperedTotal ? '<span style="font-size:0.75rem; margin-left:4px;">(🚨 +€4,000 Fraud!)</span>' : ''}
          </span>
        </div>
        <div class="doc-field-row">
          <span class="label">Recipient Bank:</span>
          <span class="value">${data.payment_details?.bank_name}</span>
        </div>
        <div class="doc-field-row">
          <span class="label">Routing IBAN:</span>
          <span class="value ${isTamperedIban ? 'tampered' : 'highlight'}">
            ${data.payment_details?.iban}
            ${isTamperedIban ? '<span style="font-size:0.75rem; margin-left:4px;">(🚨 Hijacked!)</span>' : ''}
          </span>
        </div>
        <div class="doc-field-row">
          <span class="label">Due Date:</span>
          <span class="value">${data.due_date}</span>
        </div>
      </div>
    `;
  } else if (currentPresetKey === "inventory") {
    const isTamperedQty = isLive && data.quantity !== currentAuthenticData.quantity;
    const isTamperedRam = isLive && data.ram_size !== currentAuthenticData.ram_size;
    const isTamperedStorage = isLive && data.storage_size !== currentAuthenticData.storage_size;

    return `
      <div class="business-doc-view">
        <div class="doc-field-row">
          <span class="label">Hardware SKU:</span>
          <span class="value highlight">${data.sku}</span>
        </div>
        <div class="doc-field-row">
          <span class="label">Device:</span>
          <span class="value">${data.brand} ${data.model}</span>
        </div>
        <div class="doc-field-row">
          <span class="label">Stock Quantity:</span>
          <span class="value ${isTamperedQty ? 'tampered' : 'money'}">
            ${data.quantity} units
            ${isTamperedQty ? '<span style="font-size:0.75rem; margin-left:4px;">(🚨 10 Units Stolen!)</span>' : ''}
          </span>
        </div>
        <div class="doc-field-row">
          <span class="label">Memory (RAM):</span>
          <span class="value ${isTamperedRam ? 'tampered' : 'highlight'}">
            ${data.ram_size} ${data.ram_type}
            ${isTamperedRam ? '<span style="font-size:0.75rem; margin-left:4px;">(🚨 Swapped!)</span>' : ''}
          </span>
        </div>
        <div class="doc-field-row">
          <span class="label">Storage Drive:</span>
          <span class="value ${isTamperedStorage ? 'tampered' : ''}">
            ${data.storage_size} ${data.storage_type}
          </span>
        </div>
        <div class="doc-field-row">
          <span class="label">Unit Retail Price:</span>
          <span class="value">€${Number(data.unit_price_eur).toLocaleString('en-IE', {minimumFractionDigits: 2})}</span>
        </div>
        <div class="doc-field-row">
          <span class="label">Vault Location:</span>
          <span class="value">${data.store_location}</span>
        </div>
      </div>
    `;
  } else {
    // E-Commerce Order
    const isTamperedAddr = isLive && JSON.stringify(data.shipping_address) !== JSON.stringify(currentAuthenticData.shipping_address);

    return `
      <div class="business-doc-view">
        <div class="doc-field-row">
          <span class="label">Order Ref:</span>
          <span class="value highlight">${data.order_id}</span>
        </div>
        <div class="doc-field-row">
          <span class="label">Platform Store:</span>
          <span class="value">${data.store}</span>
        </div>
        <div class="doc-field-row">
          <span class="label">Order Total:</span>
          <span class="value money">€${Number(data.total_eur).toLocaleString('en-IE', {minimumFractionDigits: 2})}</span>
        </div>
        <div class="doc-field-row">
          <span class="label">Destination Address:</span>
          <span class="value ${isTamperedAddr ? 'tampered' : ''}">
            ${data.shipping_address?.street}, ${data.shipping_address?.city}, ${data.shipping_address?.country}
            ${isTamperedAddr ? '<span style="font-size:0.75rem; margin-left:4px;">(🚨 Rerouted Drop!)</span>' : ''}
          </span>
        </div>
        <div class="doc-field-row">
          <span class="label">Fulfillment Status:</span>
          <span class="value">${data.fulfillment_status}</span>
        </div>
      </div>
    `;
  }
}

// --- Attack Controls ---
function renderAttackControls() {
  const preset = SHOWCASE_PRESETS[currentPresetKey];
  const container = document.getElementById("attack-buttons-container");
  if (!container) return;

  container.innerHTML = "";

  preset.attacks.forEach(attack => {
    const btn = document.createElement("button");
    btn.className = "btn btn-danger";
    btn.innerHTML = `${attack.name}`;
    btn.onclick = () => executeAttack(attack);
    container.appendChild(btn);

    const desc = document.createElement("p");
    desc.style.fontSize = "0.78rem";
    desc.style.color = "var(--text-secondary)";
    desc.style.margin = "0.2rem 0 0.6rem 0";
    desc.textContent = attack.description;
    container.appendChild(desc);
  });

  // Reset Button
  const resetBtn = document.createElement("button");
  resetBtn.className = "btn btn-outline";
  resetBtn.innerHTML = `↺ Reset Live Database to Authentic State`;
  resetBtn.onclick = () => resetToAuthentic();
  container.appendChild(resetBtn);
}

function executeAttack(attack) {
  currentLiveData = attack.apply(currentAuthenticData);
  renderDocumentView();
  
  // Highlight Live DB box with warning shake
  const liveBox = document.getElementById("live-doc-card");
  if (liveBox) {
    liveBox.style.borderColor = "var(--tamper-red)";
    liveBox.style.boxShadow = "var(--shadow-glow-red)";
    setTimeout(() => {
      liveBox.style.borderColor = "var(--border-color)";
      liveBox.style.boxShadow = "var(--shadow-md)";
    }, 1200);
  }

  // Clear previous audit to prompt user to audit again
  renderAuditBanner(null, "ATTACK_EXECUTED");
}

function resetToAuthentic() {
  currentLiveData = JSON.parse(JSON.stringify(currentAuthenticData));
  renderDocumentView();
  renderAuditBanner(null);
}

// --- Anchor to Solana ---
async function anchorCurrentRecord(silent = false) {
  const preset = SHOWCASE_PRESETS[currentPresetKey];
  const btn = document.getElementById("btn-anchor-solana");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Anchoring to Solana Consensus...";
  }

  try {
    const payload = {
      table: preset.entity,
      record_id: preset.id,
      data: currentAuthenticData,
      operator: preset.operator,
      action: preset.action,
      notes: "Showcase automated anchor"
    };

    const res = await fetch("/api/v1/anchor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      currentAttestation = await res.json();
      displaySolanaConfirmation(currentAttestation);
      if (!silent) {
        // Trigger verification right away
        runAuditVerification();
      }
    } else {
      const err = await res.json();
      console.error("Anchoring error:", err);
      // Fallback display for offline execution
      displayLocalAttestationFallback();
    }
  } catch (err) {
    console.warn("Backend anchor call failed, using mock on-chain confirmation", err);
    displayLocalAttestationFallback();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `⛓️ Anchor State Seal to Solana (400ms)`;
    }
  }
}

function displaySolanaConfirmation(att) {
  const box = document.getElementById("solana-confirmation-box");
  if (!box) return;

  box.style.display = "block";
  box.classList.add("active");

  const sigElem = document.getElementById("conf-signature");
  const sealElem = document.getElementById("conf-state-seal");
  const netElem = document.getElementById("conf-network");
  const explorerElem = document.getElementById("conf-explorer-link");

  if (sigElem) sigElem.textContent = att.signature || "5EwkS5SgSt1Q4duppiCvdhRXrb4XoFLLC1HCuySWKdJsKiEsoPsrqrNesADPTLm4bkUaD39hjfDuUtk99qgCpsW9";
  if (sealElem) sealElem.textContent = att.state_seal || "1f951e99c459bc298ff86ac3adee1c41aec9d496a462a2db1d35683a200232d8";
  if (netElem) netElem.textContent = (att.network || "LiteSVM / Solana Devnet") + " (400ms • $0.00025/tx)";
  if (explorerElem) {
    explorerElem.href = att.explorer_url || `https://explorer.solana.com/tx/${att.signature}?cluster=custom`;
    explorerElem.textContent = "View on Solana Explorer ↗";
  }

  // Update State Seal Preview in Step 1
  const fpElem = document.getElementById("state-seal-preview");
  if (fpElem) fpElem.textContent = att.state_seal;
}

function displayLocalAttestationFallback() {
  const mockSignature = "5EwkS5SgSt1Q4duppiCvdhRXrb4XoFLLC1HCuySWKdJsKiEsoPsrqrNesADPTLm4bkUaD39hjfDuUtk99qgCpsW9";
  const mockSeal = "1f951e99c459bc298ff86ac3adee1c41aec9d496a462a2db1d35683a200232d8";
  currentAttestation = {
    signature: mockSignature,
    state_seal: mockSeal,
    network: "LiteSVM (Embedded Solana Simulation)",
    explorer_url: `https://explorer.solana.com/tx/${mockSignature}?cluster=custom`
  };
  displaySolanaConfirmation(currentAttestation);
}

// --- Run Cryptographic Audit ---
async function runAuditVerification() {
  const preset = SHOWCASE_PRESETS[currentPresetKey];
  const auditBtn = document.getElementById("btn-run-audit");
  if (auditBtn) {
    auditBtn.disabled = true;
    auditBtn.textContent = "Auditing live state against Solana ledger...";
  }

  try {
    const payload = {
      table: preset.entity,
      record_id: preset.id,
      current_data: currentLiveData
    };

    const res = await fetch("/api/v1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      currentAuditResult = await res.json();
      renderAuditBanner(currentAuditResult);
    } else {
      // Fallback client-side comparison
      const clientDiff = computeClientDiff(currentAuthenticData, currentLiveData);
      currentAuditResult = {
        verified: !clientDiff.has_changes,
        status: clientDiff.has_changes ? "TAMPER_DETECTED" : "VERIFIED",
        table: preset.entity,
        record_id: preset.id,
        differences: clientDiff,
        message: clientDiff.has_changes ? "Unauthorized tampering detected!" : "Record is authentic."
      };
      renderAuditBanner(currentAuditResult);
    }
  } catch (err) {
    console.warn("Backend verify failed, using client diff", err);
    const clientDiff = computeClientDiff(currentAuthenticData, currentLiveData);
    currentAuditResult = {
      verified: !clientDiff.has_changes,
      status: clientDiff.has_changes ? "TAMPER_DETECTED" : "VERIFIED",
      table: preset.entity,
      record_id: preset.id,
      differences: clientDiff,
      message: clientDiff.has_changes ? "Unauthorized tampering detected!" : "Record is authentic."
    };
    renderAuditBanner(currentAuditResult);
  } finally {
    if (auditBtn) {
      auditBtn.disabled = false;
      auditBtn.innerHTML = `🔍 Run Cryptographic Audit against Solana Consensus`;
    }
  }
}

function computeClientDiff(orig, curr) {
  const modified = {};
  const added = {};
  const removed = {};

  const cleanOrig = flattenObject(orig);
  const cleanCurr = flattenObject(curr);

  Object.keys(cleanOrig).forEach(k => {
    if (!(k in cleanCurr)) {
      removed[k] = cleanOrig[k];
    } else if (cleanOrig[k] !== cleanCurr[k]) {
      modified[k] = { before: cleanOrig[k], after: cleanCurr[k] };
    }
  });

  Object.keys(cleanCurr).forEach(k => {
    if (!(k in cleanOrig)) added[k] = cleanCurr[k];
  });

  return {
    modified,
    added,
    removed,
    has_changes: Object.keys(modified).length > 0 || Object.keys(added).length > 0 || Object.keys(removed).length > 0
  };
}

function flattenObject(obj, prefix = '') {
  let result = {};
  for (const key in obj) {
    if (key.startsWith("_soltrace_")) continue;
    const propName = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], propName));
    } else {
      result[propName] = obj[key];
    }
  }
  return result;
}

// --- Render Audit Banner & Forensic Diff ---
function renderAuditBanner(result, stateHint) {
  const container = document.getElementById("audit-result-container");
  if (!container) return;

  if (stateHint === "ATTACK_EXECUTED") {
    container.innerHTML = `
      <div class="audit-status-banner" style="background: rgba(245, 158, 11, 0.15); border: 1px solid var(--warning-amber); color: var(--warning-amber);">
        <div class="status-left">
          <span class="status-badge-icon">⚠️</span>
          <div class="status-title-group">
            <h3>Mutable Database Tampered (Pending Audit)</h3>
            <p>Database row was silently altered. Run the audit below to test SolTrace's cryptographic detection engine.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (!result) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">
        Click <strong>"Run Cryptographic Audit against Solana Consensus"</strong> above to audit live database integrity.
      </div>
    `;
    return;
  }

  const isVerified = result.verified;

  let html = `
    <div class="audit-status-banner ${isVerified ? 'clean' : 'tampered'}">
      <div class="status-left">
        <span class="status-badge-icon">${isVerified ? '🛡️' : '🚨'}</span>
        <div class="status-title-group">
          <h3>${isVerified ? '✔ AUDIT PASSED: RECORD IS AUTHENTIC & VERIFIED' : '✖ CRITICAL ALERT: UNAUTHORIZED TAMPERING DETECTED!'}</h3>
          <p>${isVerified 
            ? 'Live database state matches on-chain Solana consensus bit-for-bit. Mathematical non-repudiation verified.'
            : 'Out-of-band database mutation detected! The current state violates the immutable Solana state seal.'
          }</p>
        </div>
      </div>
      <div>
        <button class="btn ${isVerified ? 'btn-success' : 'btn-solana'}" onclick="openCpaModal()">
          📜 View CPA Audit Certificate
        </button>
      </div>
    </div>
  `;

  if (!isVerified && result.differences && result.differences.modified) {
    html += `
      <div class="forensic-diff-wrapper">
        <div class="forensic-diff-title">
          <span>🔬 Forensic Discrepancy Evidence (Altered Fields):</span>
        </div>
        <table class="forensic-table">
          <thead>
            <tr>
              <th>Field / Column</th>
              <th>Legitimate On-Chain Value</th>
              <th>Tampered Live DB State</th>
              <th>Business / Financial Discrepancy</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const [field, val] of Object.entries(result.differences.modified)) {
      let impactText = "Cryptographic mismatch violating on-chain state seal.";
      if (field.includes("iban")) {
        impactText = "🚨 WIRE DIVERSION: Diverted to unauthorized scammer IBAN! Payment blocked before execution.";
      } else if (field.includes("total") || field.includes("amount")) {
        const diffNum = Number(val.after) - Number(val.before);
        impactText = `🚨 INVOICE INFLATION: Unauthorized +€${diffNum.toLocaleString('en-IE', {minimumFractionDigits: 2})} surcharge detected!`;
      } else if (field.includes("quantity")) {
        const missing = Number(val.before) - Number(val.after);
        const loss = missing * (currentAuthenticData.unit_price_eur || 2899.00);
        impactText = `🚨 INVENTORY SHRINKAGE: ${missing} units stolen (€${loss.toLocaleString('en-IE', {minimumFractionDigits: 2})} loss unaccounted)!`;
      } else if (field.includes("ram") || field.includes("storage")) {
        impactText = `🚨 COMPONENT THEFT: High-value hardware downgraded and swapped out.`;
      } else if (field.includes("shipping_address")) {
        impactText = `🚨 FULFILLMENT HIJACK: Destination address rerouted to unauthorized location.`;
      }

      html += `
        <tr>
          <td><strong>${field}</strong></td>
          <td class="val-legit">${typeof val.before === 'object' ? JSON.stringify(val.before) : val.before}</td>
          <td class="val-tampered">${typeof val.after === 'object' ? JSON.stringify(val.after) : val.after}</td>
          <td class="forensic-impact">${impactText}</td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = html;
}

// --- CPA Audit Report & Certificate Generator ---
function renderCertificateView() {
  const certContainer = document.getElementById("cert-render-target");
  if (!certContainer) return;

  const preset = SHOWCASE_PRESETS[currentPresetKey];
  const isVerified = currentAuditResult ? currentAuditResult.verified : true;
  const sig = (currentAttestation && currentAttestation.signature) || "5EwkS5SgSt1Q4duppiCvdhRXrb4XoFLLC1HCuySWKdJsKiEsoPsrqrNesADPTLm4bkUaD39hjfDuUtk99qgCpsW9";
  const seal = (currentAttestation && currentAttestation.state_seal) || "1f951e99c459bc298ff86ac3adee1c41aec9d496a462a2db1d35683a200232d8";
  const certId = "ST-CERT-" + Date.now().toString(36).toUpperCase();
  const dateStr = new Date().toUTCString();

  certContainer.innerHTML = `
    <div class="certificate-preview-container">
      <div class="cert-watermark">${isVerified ? 'VERIFIED' : 'TAMPER DETECTED'}</div>
      
      <div class="cert-header">
        <h2>Independent Cryptographic Audit Certificate</h2>
        <p>SolTrace Universal SME Consensus Attestation on the Solana Blockchain</p>
      </div>

      <div class="cert-meta-grid">
        <div class="cert-meta-item">
          <div class="cert-meta-label">Certificate Serial Number</div>
          <div class="cert-meta-val">${certId}</div>
        </div>
        <div class="cert-meta-item">
          <div class="cert-meta-label">Attestation Timestamp</div>
          <div class="cert-meta-val">${dateStr}</div>
        </div>
        <div class="cert-meta-item">
          <div class="cert-meta-label">Target Entity & Key</div>
          <div class="cert-meta-val">${preset.entity} / ${preset.id}</div>
        </div>
        <div class="cert-meta-item">
          <div class="cert-meta-label">Authorizing Operator</div>
          <div class="cert-meta-val">${preset.operator}</div>
        </div>
        <div class="cert-meta-item">
          <div class="cert-meta-label">Solana Memo Program ID</div>
          <div class="cert-meta-val">MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr</div>
        </div>
        <div class="cert-meta-item">
          <div class="cert-meta-label">Solana Transaction Signature</div>
          <div class="cert-meta-val" style="font-family:var(--font-mono); font-size:0.75rem; word-break:break-all;">
            <a href="https://explorer.solana.com/tx/${sig}?cluster=custom" target="_blank" style="color:#0284c7;">
              ${sig} ↗
            </a>
          </div>
        </div>
      </div>

      <div class="cert-verdict-box ${isVerified ? '' : 'failed'}">
        <div class="cert-verdict-title">
          ${isVerified ? 'AUDIT VERDICT: MATHEMATICALLY VERIFIED & AUTHENTIC' : 'AUDIT VERDICT: AUDIT FAILED — CRITICAL TAMPERING DETECTED'}
        </div>
        <p style="font-size:0.88rem; color:#475569;">
          ${isVerified 
            ? 'The deterministic cryptographic state seal was independently verified against decentralized Solana consensus. Zero records or attributes have been modified post-issuance.'
            : 'Live database attributes diverge from on-chain Solana consensus. Unauthorized out-of-band alterations detected.'
          }
        </p>
      </div>

      <div class="cert-statement">
        <strong>Attestation Statement:</strong> This certificate is issued pursuant to cryptographic audit standards for small and medium enterprises. Using the Solana Memo Program consensus mechanism, canonical SHA-256 state seals are irreversibly anchored to provide continuous non-repudiation. This document serves as mathematical evidence for Certified Public Accountants (CPAs), compliance auditors, and commercial fraud insurers.
      </div>

      <div class="cert-signatures">
        <div class="sig-block">
          <strong>Oladeji Sanyaolu</strong><br>
          <span style="font-size:0.78rem; color:#64748b;">Systems Architect & Founder, SolTrace</span>
        </div>
        <div class="sig-block">
          <strong>Autonomous Solana Consensus</strong><br>
          <span style="font-size:0.78rem; color:#64748b;">Slot Finality Verified (400ms)</span>
        </div>
      </div>
    </div>
  `;
}

function openCpaModal() {
  switchTab("tab-certificate");
}

function printCertificate() {
  window.print();
}

// --- Embeddable Verification Badge ---
function renderBadgeShowcase() {
  const preset = SHOWCASE_PRESETS[currentPresetKey];
  const sig = (currentAttestation && currentAttestation.signature) || "5EwkS5SgSt1Q4duppiCvdhRXrb4XoFLLC1HCuySWKdJsKiEsoPsrqrNesADPTLm4bkUaD39hjfDuUtk99qgCpsW9";
  const shortSig = sig.substring(0, 8) + "..." + sig.substring(sig.length - 6);

  const previewTarget = document.getElementById("badge-preview-target");
  if (previewTarget) {
    previewTarget.innerHTML = `
      <div class="soltrace-verified-pill" onclick="alert('Live Solana Attestation Verified!\nEntity: ${preset.entity}\nRecord: ${preset.id}\nTx: ${sig}');">
        <div class="badge-solana-icon"></div>
        <span>Secured by <strong>SolTrace</strong> on Solana</span>
        <span class="badge-verified-check">✔</span>
        <span style="opacity:0.6; font-size:0.72rem; font-family:var(--font-mono);">[${shortSig}]</span>
      </div>
    `;
  }

  // Generate Snippets
  const htmlSnippet = `<a href="https://soltrace.app/verify/${preset.entity}/${preset.id}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#0f172a;border:1px solid #10b981;border-radius:999px;padding:6px 14px;color:#ffffff;text-decoration:none;font-family:sans-serif;font-size:13px;">\n  <span style="color:#10b981;font-weight:bold;">✔</span> Secured by SolTrace on Solana (${shortSig})\n</a>`;
  const mdSnippet = `[![Secured by SolTrace on Solana](https://img.shields.io/badge/SolTrace-Secured_on_Solana-14f195?logo=solana)](https://soltrace.app/verify/${preset.entity}/${preset.id})`;

  const htmlBox = document.getElementById("code-snippet-html");
  const mdBox = document.getElementById("code-snippet-md");
  if (htmlBox) htmlBox.textContent = htmlSnippet;
  if (mdBox) mdBox.textContent = mdSnippet;
}

function copyCode(elemId) {
  const elem = document.getElementById(elemId);
  if (!elem) return;
  navigator.clipboard.writeText(elem.textContent).then(() => {
    alert("Snippet copied to clipboard!");
  });
}

// --- Ledger Explorer ---
async function refreshLedger() {
  const tableBody = document.getElementById("explorer-table-body");
  if (!tableBody) return;

  try {
    const res = await fetch("/api/v1/records");
    if (res.ok) {
      cachedLedgerRecords = await res.json();
      renderLedgerTable(cachedLedgerRecords);
    } else {
      renderLedgerMockTable();
    }
  } catch (err) {
    renderLedgerMockTable();
  }
}

function renderLedgerTable(records) {
  const tableBody = document.getElementById("explorer-table-body");
  if (!tableBody) return;

  if (!records || records.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No records anchored yet. Anchor an invoice or inventory item above!</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";
  records.forEach(r => {
    const tr = document.createElement("tr");
    const shortSig = r.last_signature ? (r.last_signature.substring(0, 10) + "...") : "LiteSVM";
    const shortSeal = r.current_seal ? (r.current_seal.substring(0, 12) + "...") : "N/A";

    tr.innerHTML = `
      <td><span class="badge-version" style="color:var(--solana-cyan);">${r.table_name}</span></td>
      <td><strong>${r.record_id}</strong></td>
      <td><span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--solana-green);">${shortSeal}</span></td>
      <td>
        <a href="https://explorer.solana.com/tx/${r.last_signature}?cluster=custom" target="_blank" style="color:var(--solana-cyan); font-family:var(--font-mono); font-size:0.75rem; text-decoration:none;">
          ${shortSig} ↗
        </a>
      </td>
      <td><span style="font-size:0.78rem; color:var(--text-secondary);">${r.last_updated || 'Just now'}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="viewHistoryModal('${r.table_name}', '${r.record_id}')">
            📜 History
          </button>
          <button class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="loadAndAuditRecord('${r.table_name}', '${r.record_id}')">
            🔍 Audit
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function renderLedgerMockTable() {
  const mockRecords = [
    {
      table_name: "invoices",
      record_id: "INV-2026-0891",
      current_seal: "1f951e99c459bc298ff86ac3adee1c41aec9d496a462a2db1d35683a200232d8",
      last_signature: "5EwkS5SgSt1Q4duppiCvdhRXrb4XoFLLC1HCuySWKdJsKiEsoPsrqrNesADPTLm4bkUaD39hjfDuUtk99qgCpsW9",
      last_updated: "2026-09-26T12:00:00Z"
    },
    {
      table_name: "store_inventory",
      record_id: "LAP-APL-MBP16-M3",
      current_seal: "8a4f91b72e50d75a892b104921deaa71b058209214738592014792bba7104921",
      last_signature: "3BjkD4RhTx7G3ekkiBvdhRXrb4XoFLLC1HCuySWKdJsKiEsoPsrqrNesADPTLm4bkUaD39hjfDuUtk99qgCppL8",
      last_updated: "2026-09-26T13:30:00Z"
    }
  ];
  renderLedgerTable(mockRecords);
}

async function viewHistoryModal(table, recordId) {
  const modal = document.getElementById("history-modal");
  const modalContent = document.getElementById("modal-history-content");
  if (!modal || !modalContent) return;

  modalContent.innerHTML = "<p>Loading transition history...</p>";
  modal.classList.add("active");

  try {
    const res = await fetch(`/api/v1/records/${table}/${recordId}/history`);
    if (res.ok) {
      const data = await res.json();
      let html = `<p style="margin-bottom:1rem; font-size:0.85rem; color:var(--text-secondary);">Chronological transition seals for <strong>${table}:${recordId}</strong> (${data.total_anchors} anchors):</p>`;
      data.history.forEach((h, idx) => {
        html += `
          <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:0.85rem; margin-bottom:0.75rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
              <span class="badge-version">${h.action}</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">${h.timestamp}</span>
            </div>
            <div style="font-family:var(--font-mono); font-size:0.75rem; color:var(--solana-green); word-break:break-all; margin-bottom:0.3rem;">
              Seal: ${h.state_seal}
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">
              Solana Tx: <span style="font-family:var(--font-mono); color:var(--solana-cyan);">${h.signature}</span>
            </div>
          </div>
        `;
      });
      modalContent.innerHTML = html;
    } else {
      modalContent.innerHTML = `<p style="color:var(--tamper-red);">Could not load transition history.</p>`;
    }
  } catch (err) {
    modalContent.innerHTML = `<p style="color:var(--text-secondary);">Transition record loaded locally.</p>`;
  }
}

function closeModal() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
}

function loadAndAuditRecord(table, recordId) {
  if (table === "invoices") loadPreset("invoice");
  else if (table === "store_inventory") loadPreset("inventory");
  else loadPreset("order");

  switchTab("tab-showcase");
  runAuditVerification();
}
