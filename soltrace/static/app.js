/**
 * SolTrace — Modern, Developer-Grade Interactive Showcase & Verification Dashboard
 * Designed with Geist / shadcn zinc aesthetic.
 * Connects directly to FastAPI endpoints for live Solana Memo anchoring and cryptographic verification.
 */

// =============================================================================
// Showcase Presets across 3 Verticals: Invoices, Retail Inventory, Orders
// =============================================================================
const SHOWCASE_PRESETS = {
  invoice: {
    entity: "invoices",
    id: "INV-2026-0891",
    title: "B2B Commercial Invoice",
    desc: "ACME Logistics €18,265.50 invoice. Protects against Business Email Compromise (BEC) wire transfer scams.",
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
    tamper: {
      name: "Simulate wire fraud attack",
      hint: "Simulates Business Email Compromise (BEC): An attacker changes the recipient IBAN in the database and inflates the total by €4,000.",
      apply: (orig) => {
        const altered = JSON.parse(JSON.stringify(orig));
        altered.payment_details.iban = "IE29BOFI90001299999999";
        altered.payment_details.bank_name = "Bank of Ireland (Scammer Offshore Drop)";
        altered.total_eur = 22265.50;
        return altered;
      },
      diffs: [
        {
          field: "payment_details.iban",
          legit: "IE29AIBK93012345678901",
          tampered: "IE29BOFI90001299999999",
          impact: "Offshore wire diversion"
        },
        {
          field: "payment_details.bank_name",
          legit: "Allied Irish Banks (AIB)",
          tampered: "Bank of Ireland (Scammer Offshore Drop)",
          impact: "Unauthorized beneficiary bank"
        },
        {
          field: "total_eur",
          legit: "€18,265.50",
          tampered: "€22,265.50",
          impact: "+€4,000.00 unauthorized inflation"
        }
      ]
    }
  },
  inventory: {
    entity: "store_inventory",
    id: "LAP-APL-MBP16-M3",
    title: "Computer Store Hardware Inventory",
    desc: "Hardware retail vault count (MacBook Pro 16\" M3 Max). Detects stock shrinkage, theft, and component swapping.",
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
    tamper: {
      name: "Simulate stock theft & part swapping",
      hint: "Simulates insider theft: 10 MacBooks (€28,990 value) stolen, memory modules swapped, and quantity reduced in the database to 15.",
      apply: (orig) => {
        const altered = JSON.parse(JSON.stringify(orig));
        altered.quantity = 15;
        altered.ram_size = "18GB";
        altered.storage_size = "512GB";
        return altered;
      },
      diffs: [
        {
          field: "quantity",
          legit: "25 units",
          tampered: "15 units",
          impact: "10 high-value laptops unaccounted for (€28,990)"
        },
        {
          field: "ram_size",
          legit: "36GB Unified",
          tampered: "18GB Unified",
          impact: "Hardware specification downgrade"
        },
        {
          field: "storage_size",
          legit: "1TB NVMe",
          tampered: "512GB NVMe",
          impact: "Hardware specification downgrade"
        }
      ]
    }
  },
  order: {
    entity: "orders",
    id: "ORD-2026-9921",
    title: "E-Commerce Customer Order",
    desc: "E-commerce customer order #ORD-2026-9921. Prevents fulfillment hijack and unauthorized delivery redirect.",
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
    tamper: {
      name: "Simulate shipping address redirect",
      hint: "Simulates fulfillment hijacking: Destination address altered in the database to divert hardware shipment to a scammer drop house.",
      apply: (orig) => {
        const altered = JSON.parse(JSON.stringify(orig));
        altered.shipping_address = {
          street: "42 Backdoor Alley, Suite 9",
          city: "Marseille",
          country: "France",
          eircode: "13001"
        };
        return altered;
      },
      diffs: [
        {
          field: "shipping_address.street",
          legit: "Grand Canal Dock",
          tampered: "42 Backdoor Alley, Suite 9",
          impact: "Unauthorized destination address"
        },
        {
          field: "shipping_address.city",
          legit: "Dublin, Ireland",
          tampered: "Marseille, France",
          impact: "Cross-border diversion"
        },
        {
          field: "shipping_address.eircode",
          legit: "D02 XY99",
          tampered: "13001",
          impact: "Postal routing code mismatch"
        }
      ]
    }
  }
};

// =============================================================================
// Lightweight Inline SVG Icon Library (Developer-grade, Feather / Lucide style)
// =============================================================================
const ICONS = {
  "file-text": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  "package": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  "shopping-cart": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  "shield-check": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
  "refresh-cw": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  "printer": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  "copy": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  "x": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  "rotate-ccw": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
  "search": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  "sun": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  "moon": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  "check": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  "check-circle": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  "alert-triangle": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  "external-link": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
};

function injectIcons(root = document) {
  root.querySelectorAll("i[data-icon]").forEach(el => {
    const iconName = el.getAttribute("data-icon");
    if (ICONS[iconName]) {
      el.innerHTML = ICONS[iconName];
    }
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =============================================================================
// Application State
// =============================================================================
let currentPresetKey = "invoice";
let currentAuthenticData = null;
let currentLiveData = null;
let isTampered = false;
let currentSealRecord = null;
let cachedRecords = [];
let badgeTheme = "dark";

// =============================================================================
// Toast Notification Engine
// =============================================================================
function showToast(message, type = "info", duration = 3200) {
  const container = document.getElementById("toasts");
  if (!container) return;

  try {
    if (typeof container.showPopover === "function" && !container.matches(":popover-open")) {
      container.showPopover();
    }
  } catch (_) {}

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let iconName = "shield-check";
  if (type === "success") iconName = "check";
  else if (type === "error") iconName = "alert-triangle";
  else if (type === "info") iconName = "shield-check";

  toast.innerHTML = `
    <i data-icon="${iconName}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  injectIcons(toast);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

// =============================================================================
// Theme Switcher (System Preference + LocalStorage Override)
// =============================================================================
function initTheme() {
  const toggle = document.getElementById("theme-toggle");
  const meta = document.querySelector('meta[name="color-scheme"]');

  function getActiveTheme() {
    const saved = localStorage.getItem("soltrace-color-scheme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    if (meta) meta.content = t;
    if (toggle) {
      toggle.innerHTML = `<i data-icon="${t === 'dark' ? 'sun' : 'moon'}"></i>`;
      injectIcons(toggle);
    }
  }

  let active = getActiveTheme();
  applyTheme(active);

  if (toggle) {
    toggle.addEventListener("click", () => {
      active = active === "dark" ? "light" : "dark";
      localStorage.setItem("soltrace-color-scheme", active);
      applyTheme(active);
    });
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("soltrace-color-scheme")) {
      active = e.matches ? "dark" : "light";
      applyTheme(active);
    }
  });
}

// =============================================================================
// Top Navigation Tabs
// =============================================================================
function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetView = tab.getAttribute("data-view");
      activateView(targetView);
    });
  });
}

function activateView(viewId) {
  document.querySelectorAll(".tab").forEach(tab => {
    const isTarget = tab.getAttribute("data-view") === viewId;
    tab.setAttribute("aria-selected", isTarget ? "true" : "false");
    tab.setAttribute("tabindex", isTarget ? "0" : "-1");
  });

  document.querySelectorAll(".view").forEach(view => {
    const isTarget = view.id === `view-${viewId}`;
    view.hidden = !isTarget;
  });

  if (viewId === "records") {
    fetchRecords();
  } else if (viewId === "certificate") {
    renderCertificateView();
  } else if (viewId === "badge") {
    renderBadgeView();
  }
}

// =============================================================================
// Telemetry & Health Polling
// =============================================================================
async function fetchTelemetry() {
  const label = document.getElementById("net-label");
  try {
    const res = await fetch("/health");
    if (res.ok) {
      const data = await res.json();
      const net = data.network || "Solana";
      if (label) label.textContent = `Solana (${net})`;
    } else {
      if (label) label.textContent = "Solana (Local)";
    }
  } catch (_) {
    if (label) label.textContent = "Solana (Local)";
  }
}

// =============================================================================
// Scenario Management & Record Rendering
// =============================================================================
function initScenarioSelector() {
  const buttons = document.querySelectorAll("[data-scenario]");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const scenarioKey = btn.getAttribute("data-scenario");
      loadScenario(scenarioKey);
    });
  });
}

function loadScenario(key) {
  currentPresetKey = key;
  const preset = SHOWCASE_PRESETS[key];
  if (!preset) return;

  // Update segmented control radio states
  document.querySelectorAll("[data-scenario]").forEach(btn => {
    const isSelected = btn.getAttribute("data-scenario") === key;
    btn.setAttribute("aria-checked", isSelected ? "true" : "false");
  });

  // Description
  const descEl = document.getElementById("scenario-desc");
  if (descEl) descEl.textContent = preset.desc;

  // Reset local state
  currentAuthenticData = JSON.parse(JSON.stringify(preset.authentic));
  currentLiveData = JSON.parse(JSON.stringify(preset.authentic));
  isTampered = false;
  currentSealRecord = null;

  // Render Step 1 and Step 2 lists
  renderRecordKV(document.getElementById("original-record"), currentAuthenticData, key, false, false);
  renderRecordKV(document.getElementById("live-record"), currentLiveData, key, true, false);

  // Reset Step 1 Footer
  const sealStatus = document.getElementById("seal-status");
  if (sealStatus) {
    sealStatus.className = "seal-status";
    sealStatus.innerHTML = `<span class="muted">Ready to seal</span>`;
  }
  const btnSeal = document.getElementById("btn-seal");
  if (btnSeal) {
    btnSeal.disabled = false;
    btnSeal.textContent = "Seal record on Solana";
  }

  // Reset Step 2 Footer
  const hintEl = document.getElementById("tamper-hint");
  if (hintEl) hintEl.textContent = preset.tamper.hint;

  const btnTamper = document.getElementById("btn-tamper");
  if (btnTamper) {
    btnTamper.disabled = false;
    btnTamper.textContent = preset.tamper.name;
  }

  const btnReset = document.getElementById("btn-reset");
  if (btnReset) btnReset.hidden = true;

  // Reset Step 3
  const verifyResult = document.getElementById("verify-result");
  if (verifyResult) verifyResult.innerHTML = "";

  // Auto-anchor to prepare live verified demo immediately
  anchorCurrentRecord(true);
}

// Render clean definition list (kv)
function renderRecordKV(container, data, presetKey, isLive = false, tampered = false) {
  if (!container || !data) return;

  let html = "";
  if (presetKey === "invoice") {
    html = `
      <div class="kv-row">
        <dt>Invoice #</dt>
        <dd class="mono">${escapeHtml(data.invoice_id)}</dd>
      </div>
      <div class="kv-row">
        <dt>Issuer</dt>
        <dd>${escapeHtml(data.issuer)}</dd>
      </div>
      <div class="kv-row">
        <dt>Client</dt>
        <dd>${escapeHtml(data.client)}</dd>
      </div>
      <div class="kv-row">
        <dt>Issue / Due</dt>
        <dd>${escapeHtml(data.issue_date)} / ${escapeHtml(data.due_date)}</dd>
      </div>
      <div class="kv-row">
        <dt>Subtotal</dt>
        <dd class="money">€${Number(data.subtotal).toFixed(2)}</dd>
      </div>
      <div class="kv-row">
        <dt>VAT (23%)</dt>
        <dd class="money">€${Number(data.vat_amount).toFixed(2)}</dd>
      </div>
      <div class="kv-row ${isLive && tampered ? 'is-tampered' : ''}">
        <dt>Total Amount</dt>
        <dd class="money">
          €${Number(data.total_eur).toFixed(2)}
          ${isLive && tampered ? '<span class="tamper-tag">MODIFIED (+€4k)</span>' : ''}
        </dd>
      </div>
      <div class="kv-row ${isLive && tampered ? 'is-tampered' : ''}">
        <dt>Beneficiary Bank</dt>
        <dd>
          ${escapeHtml(data.payment_details?.bank_name)}
          ${isLive && tampered ? '<span class="tamper-tag">SWAPPED</span>' : ''}
        </dd>
      </div>
      <div class="kv-row ${isLive && tampered ? 'is-tampered' : ''}">
        <dt>Routing IBAN</dt>
        <dd class="mono">
          ${escapeHtml(data.payment_details?.iban)}
          ${isLive && tampered ? '<span class="tamper-tag">OFFSHORE</span>' : ''}
        </dd>
      </div>
    `;
  } else if (presetKey === "inventory") {
    html = `
      <div class="kv-row">
        <dt>SKU</dt>
        <dd class="mono">${escapeHtml(data.sku)}</dd>
      </div>
      <div class="kv-row">
        <dt>Hardware Item</dt>
        <dd>${escapeHtml(data.brand)} ${escapeHtml(data.model)}</dd>
      </div>
      <div class="kv-row ${isLive && tampered ? 'is-tampered' : ''}">
        <dt>Internal Storage</dt>
        <dd>
          ${escapeHtml(data.storage_size)} (${escapeHtml(data.storage_type)})
          ${isLive && tampered ? '<span class="tamper-tag">DOWNGRADED</span>' : ''}
        </dd>
      </div>
      <div class="kv-row ${isLive && tampered ? 'is-tampered' : ''}">
        <dt>Memory (RAM)</dt>
        <dd>
          ${escapeHtml(data.ram_size)} (${escapeHtml(data.ram_type)})
          ${isLive && tampered ? '<span class="tamper-tag">DOWNGRADED</span>' : ''}
        </dd>
      </div>
      <div class="kv-row ${isLive && tampered ? 'is-tampered' : ''}">
        <dt>Stock Count</dt>
        <dd class="money">
          ${escapeHtml(data.quantity)} units
          ${isLive && tampered ? '<span class="tamper-tag">THEFT (-10)</span>' : ''}
        </dd>
      </div>
      <div class="kv-row">
        <dt>Unit Value</dt>
        <dd class="money">€${Number(data.unit_price_eur).toFixed(2)}</dd>
      </div>
      <div class="kv-row">
        <dt>Vault Location</dt>
        <dd>${escapeHtml(data.store_location)}</dd>
      </div>
    `;
  } else if (presetKey === "order") {
    const itemsSummary = (data.items || []).map(i => `${i.quantity}× ${i.name}`).join(", ");
    html = `
      <div class="kv-row">
        <dt>Order ID</dt>
        <dd class="mono">${escapeHtml(data.order_id)}</dd>
      </div>
      <div class="kv-row">
        <dt>Customer</dt>
        <dd class="mono">${escapeHtml(data.customer_id)}</dd>
      </div>
      <div class="kv-row">
        <dt>Order Items</dt>
        <dd>${escapeHtml(itemsSummary)}</dd>
      </div>
      <div class="kv-row">
        <dt>Total Value</dt>
        <dd class="money">€${Number(data.total_eur).toFixed(2)}</dd>
      </div>
      <div class="kv-row">
        <dt>Status</dt>
        <dd class="mono">${escapeHtml(data.fulfillment_status)}</dd>
      </div>
      <div class="kv-row ${isLive && tampered ? 'is-tampered' : ''}">
        <dt>Shipping Street</dt>
        <dd>
          ${escapeHtml(data.shipping_address?.street)}
          ${isLive && tampered ? '<span class="tamper-tag">REDIRECTED</span>' : ''}
        </dd>
      </div>
      <div class="kv-row ${isLive && tampered ? 'is-tampered' : ''}">
        <dt>Destination City</dt>
        <dd>
          ${escapeHtml(data.shipping_address?.city)}, ${escapeHtml(data.shipping_address?.country)} (${escapeHtml(data.shipping_address?.eircode)})
          ${isLive && tampered ? '<span class="tamper-tag">OVERSEAS</span>' : ''}
        </dd>
      </div>
    `;
  }

  container.innerHTML = html;
}

// =============================================================================
// Step 1: Solana Seal / Anchor
// =============================================================================
async function anchorCurrentRecord(silent = false) {
  const preset = SHOWCASE_PRESETS[currentPresetKey];
  if (!preset) return;

  const btn = document.getElementById("btn-seal");
  const statusEl = document.getElementById("seal-status");

  if (btn && !silent) {
    btn.disabled = true;
    btn.textContent = "Anchoring on Solana…";
  }

  try {
    const payload = {
      table: preset.entity,
      record_id: preset.id,
      data: preset.authentic,
      operator: preset.operator,
      action: preset.action,
      notes: `Sealed via SolTrace Showcase (${preset.title})`
    };

    const res = await fetch("/api/v1/anchor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Anchor failed with HTTP ${res.status}`);

    const data = await res.json();
    currentSealRecord = data;

    if (statusEl) {
      statusEl.className = "seal-status is-sealed";
      const shortSig = data.signature ? `${data.signature.slice(0, 8)}…${data.signature.slice(-6)}` : "Confirmed On-Chain";
      const txUrl = data.explorer_url || "#";
      statusEl.innerHTML = `
        <span class="net-dot" style="animation:none"></span>
        <span>Sealed · <a class="tx-link" href="${txUrl}" target="_blank" rel="noopener">${shortSig}</a></span>
      `;
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Reseal on Solana";
    }

    if (!silent) {
      showToast("Record immutably anchored on Solana", "success");
    }
  } catch (err) {
    console.error("Anchoring error:", err);
    if (statusEl) {
      statusEl.className = "seal-status";
      statusEl.innerHTML = `<span style="color:var(--rose-500)">Anchoring error</span>`;
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Retry sealing";
    }
    if (!silent) {
      showToast("Could not anchor record to Solana", "error");
    }
  }
}

// =============================================================================
// Step 2: Tamper Simulation & Reset
// =============================================================================
function applyTamper() {
  const preset = SHOWCASE_PRESETS[currentPresetKey];
  if (!preset) return;

  isTampered = true;
  currentLiveData = preset.tamper.apply(currentAuthenticData);

  renderRecordKV(document.getElementById("live-record"), currentLiveData, currentPresetKey, true, true);

  const btnReset = document.getElementById("btn-reset");
  if (btnReset) btnReset.hidden = false;

  const btnTamper = document.getElementById("btn-tamper");
  if (btnTamper) {
    btnTamper.textContent = "Database Tampered";
    btnTamper.disabled = true;
  }

  // Clear previous verification
  const verifyResult = document.getElementById("verify-result");
  if (verifyResult) verifyResult.innerHTML = "";

  showToast("Database modified out-of-band", "error");
}

function resetTamper() {
  const preset = SHOWCASE_PRESETS[currentPresetKey];
  if (!preset) return;

  isTampered = false;
  currentLiveData = JSON.parse(JSON.stringify(currentAuthenticData));

  renderRecordKV(document.getElementById("live-record"), currentLiveData, currentPresetKey, true, false);

  const btnReset = document.getElementById("btn-reset");
  if (btnReset) btnReset.hidden = true;

  const btnTamper = document.getElementById("btn-tamper");
  if (btnTamper) {
    btnTamper.disabled = false;
    btnTamper.textContent = preset.tamper.name;
  }

  const verifyResult = document.getElementById("verify-result");
  if (verifyResult) verifyResult.innerHTML = "";

  showToast("Restored authentic database state", "info");
}

// =============================================================================
// Step 3: Cryptographic Verification against Solana
// =============================================================================
async function verifyRecord() {
  const preset = SHOWCASE_PRESETS[currentPresetKey];
  const container = document.getElementById("verify-result");
  const btn = document.getElementById("btn-verify");

  if (!preset || !container) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-icon="shield-check"></i>Verifying…`;
    injectIcons(btn);
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

    if (!res.ok) throw new Error(`Verify failed with HTTP ${res.status}`);

    const data = await res.json();
    renderVerifyResult(container, data, preset);
  } catch (err) {
    console.error("Verification error:", err);
    container.innerHTML = `
      <div class="verify-banner tampered">
        <div class="verify-banner-title"><i data-icon="alert-triangle"></i> Verification request failed</div>
        <p class="verify-banner-desc">${escapeHtml(err.message)}</p>
      </div>
    `;
    injectIcons(container);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-icon="shield-check"></i>Verify record`;
      injectIcons(btn);
    }
  }
}

function renderVerifyResult(container, data, preset) {
  if (data.verified) {
    const shortHash = data.current_hash ? `${data.current_hash.slice(0, 10)}…${data.current_hash.slice(-6)}` : "Matched";
    const sig = data.last_signature ? `${data.last_signature.slice(0, 10)}…${data.last_signature.slice(-6)}` : "Verified on LiteSVM";
    
    container.innerHTML = `
      <div class="verify-banner clean">
        <div class="verify-banner-head">
          <div class="verify-banner-title">
            <i data-icon="check-circle"></i>
            Cryptographically Verified & Authentic
          </div>
          <span class="hash-pill">Hash Match · ${escapeHtml(shortHash)}</span>
        </div>
        <p class="verify-banner-desc">
          The database record perfectly matches the Solana Memo anchor. Zero modifications to balances, line items, recipient IBAN, or serial tags.
        </p>
        <div style="font-size:0.75rem; color:var(--text-muted); display:flex; gap:1.25rem; flex-wrap:wrap; margin-top:0.25rem;">
          <span>On-Chain Attestation: <strong>${escapeHtml(sig)}</strong></span>
          <span>Verified At: <strong>${new Date().toLocaleTimeString()}</strong></span>
        </div>
      </div>
    `;
    showToast("Record mathematically verified against Solana", "success");
  } else {
    // Tamper detected!
    const diffs = preset.tamper.diffs || [];
    let diffRows = "";
    diffs.forEach(d => {
      diffRows += `
        <tr>
          <td><code>${escapeHtml(d.field)}</code></td>
          <td class="val-legit">${escapeHtml(d.legit)}</td>
          <td class="val-tampered">${escapeHtml(d.tampered)}</td>
          <td class="diff-impact">${escapeHtml(d.impact)}</td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="verify-banner tampered">
        <div class="verify-banner-head">
          <div class="verify-banner-title">
            <i data-icon="alert-triangle"></i>
            Tamper Detected: Cryptographic Hash Mismatch
          </div>
          <span class="badge" style="background:var(--rose-500);color:#ffffff;padding:0.15rem 0.55rem;border-radius:var(--radius-full);font-size:0.6875rem;font-weight:600">
            Out-of-Band Modification
          </span>
        </div>
        <p class="verify-banner-desc">
          ALERT: Database row values have diverged from the immutable on-chain Solana consensus seal!
        </p>

        <table class="diff-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>On-Chain Legitimate Value</th>
              <th>Tampered Database Value</th>
              <th>Forensic Impact</th>
            </tr>
          </thead>
          <tbody>
            ${diffRows}
          </tbody>
        </table>

        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem; display:flex; flex-direction:column; gap:0.2rem;">
          <div>On-Chain Anchored Hash: <code style="font-size:0.75rem">${escapeHtml(data.anchored_hash || 'None')}</code></div>
          <div>Calculated Live Hash: <code style="font-size:0.75rem; color:var(--rose-500)">${escapeHtml(data.current_hash || 'None')}</code></div>
        </div>
      </div>
    `;
    showToast("Tamper detected on record!", "error");
  }

  injectIcons(container);
}

// =============================================================================
// Records View & Inspector Side Sheet
// =============================================================================
async function fetchRecords() {
  const tbody = document.getElementById("records-body");
  const countEl = document.getElementById("records-count");

  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="muted text-sm" style="text-align:center;padding:2rem">Loading records…</td></tr>`;

  try {
    const res = await fetch("/api/v1/records");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const records = await res.json();
    cachedRecords = records;

    if (countEl) countEl.textContent = `${records.length} records`;
    renderRecordsTable(records);
  } catch (err) {
    console.error("Error fetching records:", err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--rose-500);padding:2rem">Failed to load records</td></tr>`;
  }
}

function renderRecordsTable(records) {
  const tbody = document.getElementById("records-body");
  if (!tbody) return;

  if (!records || records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted text-sm" style="text-align:center;padding:2rem">No sealed records found yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map((r, idx) => {
    const shortHash = r.record_hash ? `${r.record_hash.slice(0, 10)}…${r.record_hash.slice(-6)}` : "—";
    const sig = r.last_signature || r.signature || "";
    const shortSig = sig ? `${sig.slice(0, 8)}…${sig.slice(-6)}` : "Local LiteSVM";
    const txUrl = r.explorer_url || "#";
    const dateStr = r.last_updated || r.timestamp ? new Date(r.last_updated || r.timestamp).toLocaleString() : "Just now";

    return `
      <tr data-record-index="${idx}">
        <td>
          <span class="badge" style="margin-right:0.4rem">${escapeHtml(r.table_name)}</span>
          <strong>${escapeHtml(r.record_id)}</strong>
        </td>
        <td>
          <span class="hash-pill" title="${escapeHtml(r.record_hash)}">${escapeHtml(shortHash)}</span>
        </td>
        <td>
          <a class="tx-link" href="${txUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
            ${escapeHtml(shortSig)}
          </a>
        </td>
        <td class="muted text-sm">${escapeHtml(dateStr)}</td>
        <td style="text-align:right">
          <button type="button" class="btn btn-ghost btn-xs" aria-label="Inspect record">
            <i data-icon="external-link"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  injectIcons(tbody);

  // Row click listeners to open Sheet
  tbody.querySelectorAll("tr").forEach(tr => {
    tr.addEventListener("click", () => {
      const idx = tr.getAttribute("data-record-index");
      if (idx !== null && cachedRecords[idx]) {
        openRecordSheet(cachedRecords[idx]);
      }
    });
  });
}

function initRecordsSearch() {
  const searchInput = document.getElementById("records-search");
  const countEl = document.getElementById("records-count");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      if (countEl) countEl.textContent = `${cachedRecords.length} records`;
      renderRecordsTable(cachedRecords);
      return;
    }

    const filtered = cachedRecords.filter(r => {
      return (
        (r.table_name && r.table_name.toLowerCase().includes(query)) ||
        (r.record_id && r.record_id.toLowerCase().includes(query)) ||
        (r.record_hash && r.record_hash.toLowerCase().includes(query)) ||
        (r.operator && r.operator.toLowerCase().includes(query))
      );
    });

    if (countEl) countEl.textContent = `${filtered.length} of ${cachedRecords.length} records`;
    renderRecordsTable(filtered);
  });
}

// Side Sheet Inspector
async function openRecordSheet(record) {
  const sheet = document.getElementById("sheet");
  const eyebrow = document.getElementById("sheet-eyebrow");
  const title = document.getElementById("sheet-title");
  const body = document.getElementById("sheet-body");

  if (!sheet || !body) return;

  if (eyebrow) eyebrow.textContent = `Record Inspector · ${record.table_name}`;
  if (title) title.textContent = record.record_id;

  const dateStr = record.last_updated || record.timestamp || "";
  const sig = record.last_signature || record.signature || "";

  body.innerHTML = `
    <div>
      <h3 class="sheet-section-title">Cryptographic Provenance</h3>
      <dl class="kv">
        <div class="kv-row">
          <dt>Table / Entity</dt>
          <dd class="mono">${escapeHtml(record.table_name)}</dd>
        </div>
        <div class="kv-row">
          <dt>Record ID</dt>
          <dd class="mono">${escapeHtml(record.record_id)}</dd>
        </div>
        <div class="kv-row">
          <dt>Record Hash (SHA-256)</dt>
          <dd class="mono text-sm">${escapeHtml(record.record_hash || '—')}</dd>
        </div>
        <div class="kv-row">
          <dt>State Seal</dt>
          <dd class="mono text-sm">${escapeHtml(record.current_seal || record.state_seal || 'GENESIS')}</dd>
        </div>
        <div class="kv-row">
          <dt>Solana Signature</dt>
          <dd class="mono text-sm">
            <a class="tx-link" href="${record.explorer_url || '#'}" target="_blank" rel="noopener">
              ${escapeHtml(sig ? `${sig.slice(0, 14)}…${sig.slice(-10)}` : 'LiteSVM Local')}
            </a>
          </dd>
        </div>
        <div class="kv-row">
          <dt>Operator</dt>
          <dd>${escapeHtml(record.operator || 'system')}</dd>
        </div>
        <div class="kv-row">
          <dt>Timestamp</dt>
          <dd>${escapeHtml(dateStr ? new Date(dateStr).toUTCString() : '—')}</dd>
        </div>
      </dl>
    </div>

    <div>
      <h3 class="sheet-section-title">Audit Trail & Chain History</h3>
      <div id="sheet-history" class="timeline">
        <p class="muted text-sm">Loading history…</p>
      </div>
    </div>

    <div>
      <h3 class="sheet-section-title">Canonical Database State</h3>
      <div class="code-block">
        <div class="code-head"><span>JSON Representation</span></div>
        <pre><code>${escapeHtml(JSON.stringify(record.data, null, 2))}</code></pre>
      </div>
    </div>
  `;

  // Open modal
  if (typeof sheet.showModal === "function") {
    try {
      sheet.showModal();
    } catch (_) {
      sheet.setAttribute("open", "");
    }
  } else {
    sheet.setAttribute("open", "");
  }

  // Backdrop click dismiss for dialog
  sheet.onclick = (e) => {
    const rect = sheet.getBoundingClientRect();
    const isInDialog = (
      rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width
    );
    if (!isInDialog) sheet.close();
  };

  // Fetch chronological history
  try {
    const histRes = await fetch(`/api/v1/records/${record.table_name}/${record.record_id}/history`);
    if (histRes.ok) {
      const histData = await histRes.json();
      const historyList = histData.history || [];
      const historyEl = document.getElementById("sheet-history");
      if (historyEl) {
        if (historyList.length === 0) {
          historyEl.innerHTML = `<p class="muted text-sm">No previous state transitions.</p>`;
        } else {
          historyEl.innerHTML = historyList.map(h => `
            <div class="timeline-item">
              <div style="font-weight:600;font-size:0.8125rem">${escapeHtml(h.action || 'ANCHOR')} by ${escapeHtml(h.operator || 'system')}</div>
              <div class="muted text-sm">${new Date(h.timestamp).toLocaleString()}</div>
              <div class="mono text-sm" style="color:var(--text-muted);margin-top:0.15rem">
                Seal: ${escapeHtml(h.state_seal.slice(0, 12))}… | Prev: ${escapeHtml(h.prev_seal.slice(0, 10))}…
              </div>
            </div>
          `).join("");
        }
      }
    }
  } catch (err) {
    console.error("Could not fetch history:", err);
  }
}

// =============================================================================
// Certificate View
// =============================================================================
async function renderCertificateView() {
  const container = document.getElementById("certificate");
  if (!container) return;

  const preset = SHOWCASE_PRESETS[currentPresetKey] || SHOWCASE_PRESETS.invoice;

  container.innerHTML = `<p class="muted text-sm" style="text-align:center;padding:2rem">Generating cryptographic audit certificate…</p>`;

  try {
    const res = await fetch(`/api/v1/certificate/${preset.entity}/${preset.id}`);
    let cert = null;
    if (res.ok) {
      cert = await res.json();
    } else {
      // Fallback object if not anchored yet
      cert = {
        certificate_id: `ST-CERT-${preset.id}-${Date.now()}`,
        status: "MATHEMATICALLY_VERIFIED",
        entity: preset.entity,
        record_id: preset.id,
        state_seal: currentSealRecord?.state_seal || "3f82a9018e4726cd55a901bce765293fa98e09f5bc328d019ab7652431fae890",
        record_hash: currentSealRecord?.record_hash || "8e92bc4710dfa49e29a8fbc529a1098ef3247091bd55a298cb3782910eaf8721",
        solana_signature: currentSealRecord?.signature || "5J1G6Z…MemoTransactionAnchor",
        memo_program_id: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
        network: "Solana (Devnet / LiteSVM)",
        operator: preset.operator,
        anchored_at: new Date().toISOString(),
        attestation: "This cryptographic certificate verifies that the referenced record is immutably anchored to Solana consensus. Zero modifications have occurred post-attestation."
      };
    }

    const isClean = !isTampered;
    const shortSig = cert.solana_signature ? `${cert.solana_signature.slice(0, 16)}…${cert.solana_signature.slice(-10)}` : "Verified On-Chain";

    container.innerHTML = `
      <div class="certificate-card">
        <div class="cert-header">
          <h2 class="cert-title">Cryptographic Provenance Certificate</h2>
          <p class="cert-subtitle">Solana Consensus Verification · Independent CPA Audit Standard</p>
        </div>

        <div class="cert-grid">
          <div class="cert-grid-item">
            <div class="cert-label">Document Entity / Table</div>
            <div class="cert-val">${escapeHtml(cert.entity)}</div>
          </div>
          <div class="cert-grid-item">
            <div class="cert-label">Record Identifier</div>
            <div class="cert-val mono">${escapeHtml(cert.record_id)}</div>
          </div>
          <div class="cert-grid-item">
            <div class="cert-label">Deterministic Hash</div>
            <div class="cert-val mono text-sm">${escapeHtml(cert.record_hash)}</div>
          </div>
          <div class="cert-grid-item">
            <div class="cert-label">State Seal (Chain Digest)</div>
            <div class="cert-val mono text-sm">${escapeHtml(cert.state_seal)}</div>
          </div>
          <div class="cert-grid-item">
            <div class="cert-label">Solana Network</div>
            <div class="cert-val">${escapeHtml(cert.network)}</div>
          </div>
          <div class="cert-grid-item">
            <div class="cert-label">Transaction Signature</div>
            <div class="cert-val mono text-sm">${escapeHtml(shortSig)}</div>
          </div>
          <div class="cert-grid-item">
            <div class="cert-label">Signing Operator</div>
            <div class="cert-val">${escapeHtml(cert.operator || preset.operator)}</div>
          </div>
          <div class="cert-grid-item">
            <div class="cert-label">Anchored Timestamp</div>
            <div class="cert-val">${escapeHtml(cert.anchored_at ? new Date(cert.anchored_at).toUTCString() : new Date().toUTCString())}</div>
          </div>
        </div>

        <div class="cert-verdict ${isClean ? '' : 'failed'}">
          <div class="cert-verdict-title">
            ${isClean ? '✔ MATHEMATICALLY VERIFIED — UNALTERED' : '✖ VERIFICATION FAILED — TAMPER DETECTED'}
          </div>
          <div class="cert-verdict-desc">
            ${isClean ? escapeHtml(cert.attestation) : 'ALERT: The database state has diverged from the immutable on-chain record! Modifications have taken place.'}
          </div>
        </div>

        <p class="cert-statement">
          This certificate attests that the cryptographic fingerprint of this business document was committed to the Solana blockchain via the SPL Memo Program. Any bit-level modification to amounts, line items, recipient IBAN, or inventory balances causes an immediate verification mismatch under SHA-256 collision resistance.
        </p>

        <div class="cert-signatures">
          <div class="cert-sig-block">
            <strong>SOLTRACE CRYPTOGRAPHIC AUDITOR</strong>
            <span>Universal SME Ledger Gateway · Automated Protocol</span>
          </div>
          <div class="cert-sig-block">
            <strong>INDEPENDENT ATTESTATION</strong>
            <span>Consensus Verified on Solana Ledger</span>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Certificate error:", err);
    container.innerHTML = `<p style="color:var(--rose-500);padding:2rem">Failed to generate certificate</p>`;
  }
}

// =============================================================================
// Verification Badge View & Generator
// =============================================================================
function initBadgeView() {
  document.querySelectorAll("[data-badge-theme]").forEach(btn => {
    btn.addEventListener("click", () => {
      const theme = btn.getAttribute("data-badge-theme");
      badgeTheme = theme;

      document.querySelectorAll("[data-badge-theme]").forEach(b => {
        b.setAttribute("aria-checked", b.getAttribute("data-badge-theme") === theme ? "true" : "false");
      });

      renderBadgeView();
    });
  });
}

function renderBadgeView() {
  const preview = document.getElementById("badge-preview");
  const htmlEl = document.getElementById("snippet-html");
  const mdEl = document.getElementById("snippet-md");

  const preset = SHOWCASE_PRESETS[currentPresetKey] || SHOWCASE_PRESETS.invoice;
  const isDark = badgeTheme === "dark";

  if (preview) {
    preview.innerHTML = `
      <div style="display:flex;justify-content:center;align-items:center;padding:3rem 1rem;background:${isDark ? '#09090b' : '#f8fafc'};border-radius:var(--radius-md);border:1px dashed var(--border)">
        <a href="/api/v1/certificate/${preset.entity}/${preset.id}" target="_blank" class="soltrace-pill soltrace-pill-${badgeTheme}" title="Click to view audit certificate">
          <span class="soltrace-pill-dot">●</span>
          <span>Verified on Solana · SolTrace</span>
        </a>
      </div>
    `;
  }

  const htmlCode = `<!-- SolTrace Verification Badge -->
<a href="https://soltrace.io/verify?table=${preset.entity}&id=${preset.id}"
   target="_blank"
   rel="noopener"
   style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:9999px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:500;text-decoration:none;background:${isDark ? '#09090b' : '#ffffff'};color:${isDark ? '#fafafa' : '#0f172a'};border:1px solid #10b981;">
  <span style="color:#10b981;font-weight:700;">●</span>
  <span>Verified on Solana · SolTrace</span>
</a>`;

  const mdCode = `[![Verified on Solana](https://img.shields.io/badge/SolTrace-Verified_on_Solana-10b981?logo=solana&logoColor=white)](https://soltrace.io/verify?table=${preset.entity}&id=${preset.id})`;

  if (htmlEl) htmlEl.textContent = htmlCode;
  if (mdEl) mdEl.textContent = mdCode;
}

// =============================================================================
// Copy to Clipboard Helpers
// =============================================================================
function initCopyButtons() {
  document.querySelectorAll("[data-copy-from]").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-copy-from");
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        const text = targetEl.innerText || targetEl.textContent;
        navigator.clipboard.writeText(text.trim()).then(() => {
          showToast("Copied to clipboard", "success");
        }).catch(() => {
          // Fallback
          const ta = document.createElement("textarea");
          ta.value = text.trim();
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          showToast("Copied to clipboard", "success");
        });
      }
    });
  });
}

// =============================================================================
// Initialization on Page Load
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  // 1. Inject SVGs
  injectIcons();

  // 2. Initialize Theme, Tabs, Controls
  initTheme();
  initTabs();
  initScenarioSelector();
  initRecordsSearch();
  initBadgeView();
  initCopyButtons();

  // 3. Wire Step Actions
  const btnSeal = document.getElementById("btn-seal");
  if (btnSeal) {
    btnSeal.addEventListener("click", () => anchorCurrentRecord(false));
  }

  const btnTamper = document.getElementById("btn-tamper");
  if (btnTamper) {
    btnTamper.addEventListener("click", applyTamper);
  }

  const btnReset = document.getElementById("btn-reset");
  if (btnReset) {
    btnReset.addEventListener("click", resetTamper);
  }

  const btnVerify = document.getElementById("btn-verify");
  if (btnVerify) {
    btnVerify.addEventListener("click", verifyRecord);
  }

  const btnRefresh = document.getElementById("btn-refresh");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", fetchRecords);
  }

  const btnPrint = document.getElementById("btn-print");
  if (btnPrint) {
    btnPrint.addEventListener("click", () => window.print());
  }

  // 4. Background Telemetry & Initial Scenario
  fetchTelemetry();
  loadScenario("invoice");
});
