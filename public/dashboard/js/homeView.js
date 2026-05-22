// public/dashboard/js/homeView.js

async function renderHomeView(container) {
  container.innerHTML = `
    <div style="max-width:700px">
      <div class="kpi-grid" id="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Cargando…</div></div>
        <div class="kpi-card"><div class="kpi-label">Cargando…</div></div>
        <div class="kpi-card"><div class="kpi-label">Cargando…</div></div>
      </div>
      <button class="home-cta" id="btn-quick-quote">+ ${(window.appLocale && window.appLocale.quoteNew) || 'Nueva cotización'} rápida</button>
      <div style="font-size:13px;font-weight:600;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">
        Actividad reciente
      </div>
      <div class="activity-feed" id="activity-feed">
        <div style="color:#9ca3af;font-size:13px">Cargando…</div>
      </div>
    </div>
  `;

  document.getElementById("btn-quick-quote").addEventListener("click", openQuickQuoteModal);

  try {
    const data = await apiRequest("/admin/metrics/home");
    renderKpis(data);
    renderActivity(data.recentActivity || []);
  } catch (err) {
    document.getElementById("kpi-grid").innerHTML =
      `<div style="color:#b91c1c;font-size:13px;grid-column:1/-1">Error cargando métricas</div>`;
  }
}

function renderKpis(data) {
  const grid = document.getElementById("kpi-grid");
  grid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Pendiente de cobro</div>
      <div class="kpi-value">${fmtMoney(data.pendingAmount)}</div>
      <div class="kpi-sub">${data.pendingCount} factura${data.pendingCount !== 1 ? "s" : ""}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Cotizaciones sin respuesta</div>
      <div class="kpi-value">${data.quotesAwaiting}</div>
      <div class="kpi-sub">esperando decisión</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Cobrado este mes</div>
      <div class="kpi-value">${fmtMoney(data.collectedThisMonth)}</div>
      <div class="kpi-sub">&nbsp;</div>
    </div>
  `;
}

function renderActivity(items) {
  const feed = document.getElementById("activity-feed");
  if (!items.length) {
    feed.innerHTML = `<div style="color:#9ca3af;font-size:13px">Sin actividad reciente</div>`;
    return;
  }
  feed.innerHTML = items.map((item) => {
    const statusLabel = {
      draft: "Borrador", sent: "Enviado", accepted: "Aceptado", rejected: "Rechazado",
    }[item.status] || item.status;
    const statusColor = {
      accepted: "#16a34a", rejected: "#dc2626", sent: "#2563eb", draft: "#9ca3af",
    }[item.status] || "#9ca3af";
    const date = new Date(item.updatedAt).toLocaleDateString("es", { day: "2-digit", month: "short" });
    return `
      <div class="activity-item">
        <div>
          <div class="activity-customer">${esc(item.customer)}</div>
          <div class="activity-meta">Cotización #${item.id} · ${date}</div>
        </div>
        <div style="text-align:right">
          <div class="activity-amount">${fmtMoney(item.total, item.currency)}</div>
          <div style="font-size:12px;color:${statusColor};font-weight:600">${statusLabel}</div>
        </div>
      </div>
    `;
  }).join("");
}

function fmtMoney(amount, currency) {
  const sym = currency === "USD" ? "$" : currency === "MXN" ? "$" : "€";
  return `${sym}${Number(amount).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (s) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[s]
  );
}

// =====================
// QUICK QUOTE MODAL
// =====================

let qqState = {
  customerId: null,
  customerName: "",
  customerPhone: "",
  products: [],    // [{ concept, qty, price }]
  paymentTerms: "FULL_UPFRONT",
};

function openQuickQuoteModal() {
  if (document.getElementById("qq-modal-backdrop")) return;

  qqState = { customerId: null, customerName: "", customerPhone: "", products: [{ concept: "", qty: 1, price: "" }], paymentTerms: "FULL_UPFRONT", tiersMode: false };

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "qq-modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <span class="modal-title">${(window.appLocale && window.appLocale.quoteNew) || 'Nueva cotización'} rápida</span>
        <button class="modal-close" id="qq-close">×</button>
      </div>

      <div class="qq-modal-body">
        <!-- Cliente -->
        <div class="field">
          <label>Cliente</label>
          <div class="qq-autocomplete-wrapper">
            <input id="qq-customer-input" type="text" placeholder="Buscar o crear cliente…" autocomplete="off"
              style="width:100%;padding:9px 10px;border-radius:8px;border:1px solid #d1d5db;font-size:14px"/>
            <div class="qq-dropdown" id="qq-customer-dropdown" style="display:none"></div>
          </div>
          <div id="qq-customer-new" style="display:none;margin-top:6px">
            <input id="qq-customer-phone" type="tel" placeholder="Teléfono WhatsApp (ej: 521XXXXXXXXXX)"
              style="width:100%;padding:9px 10px;border-radius:8px;border:1px solid #d1d5db;font-size:14px;margin-top:4px"/>
          </div>
        </div>

        <!-- Toggle Good/Better/Best -->
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none">
            <input type="checkbox" id="qq-tiers-toggle" style="width:16px;height:16px;accent-color:#22c55e"/>
            <span>Ofrecer 3 opciones de precio (Good/Better/Best)</span>
          </label>
        </div>

        <!-- Modo clásico: líneas -->
        <div class="field" id="qq-classic-mode">
          <label>Concepto / Servicio</label>
          <div id="qq-lines-container"></div>
          <button type="button" id="qq-add-line"
            style="margin-top:6px;font-size:13px;background:none;border:none;color:#22c55e;cursor:pointer;padding:0">
            + Añadir línea
          </button>
        </div>

        <!-- Modo tiers -->
        <div id="qq-tiers-mode" style="display:none">
          <div class="field">
            <label>Concepto / Servicio</label>
            <div class="qq-autocomplete-wrapper">
              <input id="qq-tier-concept" type="text" placeholder="Ej: Instalación eléctrica" autocomplete="off"
                style="width:100%;padding:9px 10px;border-radius:8px;border:1px solid #d1d5db;font-size:14px"/>
              <div class="qq-dropdown" id="qq-tier-pdropdown" style="display:none"></div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
            ${['Básico', 'Estándar', 'Premium'].map((label, i) => `
              <div style="border:2px solid ${i===1?'#22c55e':'#e5e7eb'};border-radius:10px;padding:10px">
                <div style="font-size:12px;font-weight:700;color:${i===1?'#16a34a':'#6b7280'};margin-bottom:6px">
                  ${label}${i===1?' ⭐':''}
                </div>
                <input type="number" class="qq-tier-price" data-tier-idx="${i}" min="0" step="0.01"
                  placeholder="Precio"
                  style="width:100%;padding:7px;border-radius:7px;border:1px solid #d1d5db;font-size:14px"/>
              </div>
            `).join('')}
          </div>
          <p style="font-size:12px;color:#9ca3af;margin:6px 0 0">
            El cliente verá las 3 opciones y elegirá la que prefiera.
          </p>
        </div>

        <!-- Condiciones de pago -->
        <div class="field">
          <label>Condiciones de pago</label>
          <div class="qq-terms" id="qq-terms">
            <label class="selected" id="qq-label-full">
              <input type="radio" name="terms" value="FULL_UPFRONT" checked/>
              100% al aceptar
            </label>
            <label id="qq-label-fifty">
              <input type="radio" name="terms" value="FIFTY_FIFTY"/>
              50% · 50%
            </label>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="flex-direction:column;gap:8px">
        <div id="qq-alert" style="font-size:13px;color:#b91c1c;display:none"></div>
        <div style="display:flex;gap:8px;width:100%;justify-content:flex-end">
          <button class="btn btn-secondary" id="qq-cancel">Cancelar</button>
          <button class="btn btn-primary" id="qq-send" style="min-width:160px">
            Enviar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  document.getElementById("qq-close").addEventListener("click", closeQuickQuote);
  document.getElementById("qq-cancel").addEventListener("click", closeQuickQuote);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeQuickQuote(); });

  document.getElementById("qq-send").addEventListener("click", submitQuickQuote);
  document.getElementById("qq-add-line").addEventListener("click", addQqLine);

  // Payment terms toggle
  document.querySelectorAll(".qq-terms input[type=radio]").forEach((radio) => {
    radio.addEventListener("change", () => {
      qqState.paymentTerms = radio.value;
      document.getElementById("qq-label-full").classList.toggle("selected", qqState.paymentTerms === "FULL_UPFRONT");
      document.getElementById("qq-label-fifty").classList.toggle("selected", qqState.paymentTerms === "FIFTY_FIFTY");
    });
  });

  renderQqLines();
  initCustomerAutocomplete();

  // Toggle Good/Better/Best
  document.getElementById('qq-tiers-toggle')?.addEventListener('change', (e) => {
    const on = e.target.checked;
    document.getElementById('qq-classic-mode').style.display = on ? 'none' : 'block';
    document.getElementById('qq-tiers-mode').style.display = on ? 'block' : 'none';
    qqState.tiersMode = on;
  });

  // Autocomplete en el concepto del modo tiers
  document.getElementById('qq-tier-concept')?.addEventListener('input', (e) => {
    searchProducts(e.target.value, 'tier');
  });
  document.getElementById('qq-tier-concept')?.addEventListener('focus', (e) => {
    if (e.target.value.length >= 1) searchProducts(e.target.value, 'tier');
  });
}

function closeQuickQuote() {
  const el = document.getElementById("qq-modal-backdrop");
  if (el) el.remove();
}

function renderQqLines() {
  const container = document.getElementById("qq-lines-container");
  if (!container) return;
  container.innerHTML = qqState.products.map((line, i) => `
    <div style="display:grid;grid-template-columns:1fr 60px 90px 30px;gap:6px;margin-bottom:6px;align-items:center">
      <div class="qq-autocomplete-wrapper">
        <input type="text" class="qq-concept" data-idx="${i}" value="${esc(line.concept)}"
          placeholder="Concepto…" autocomplete="off"
          style="width:100%;padding:8px;border-radius:7px;border:1px solid #d1d5db;font-size:13px"/>
        <div class="qq-dropdown qq-product-dropdown" id="qq-pdropdown-${i}" style="display:none"></div>
      </div>
      <input type="number" class="qq-qty" data-idx="${i}" value="${line.qty}" min="1"
        style="padding:8px;border-radius:7px;border:1px solid #d1d5db;font-size:13px;text-align:center"/>
      <input type="number" class="qq-price" data-idx="${i}" value="${line.price}" min="0" step="0.01"
        placeholder="Precio" style="padding:8px;border-radius:7px;border:1px solid #d1d5db;font-size:13px"/>
      ${qqState.products.length > 1
        ? `<button type="button" class="btn-icon qq-remove-line" data-idx="${i}">🗑</button>`
        : '<span></span>'}
    </div>
  `).join("");

  container.querySelectorAll(".qq-concept").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx);
      qqState.products[idx].concept = e.target.value;
      searchProducts(e.target.value, idx);
    });
    inp.addEventListener("focus", (e) => {
      const idx = parseInt(e.target.dataset.idx);
      if (e.target.value.length >= 1) searchProducts(e.target.value, idx);
    });
  });

  container.querySelectorAll(".qq-qty").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      qqState.products[parseInt(e.target.dataset.idx)].qty = Number(e.target.value) || 1;
    });
  });

  container.querySelectorAll(".qq-price").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      qqState.products[parseInt(e.target.dataset.idx)].price = e.target.value;
    });
  });

  container.querySelectorAll(".qq-remove-line").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      qqState.products.splice(parseInt(e.target.dataset.idx), 1);
      renderQqLines();
    });
  });
}

function addQqLine() {
  qqState.products.push({ concept: "", qty: 1, price: "" });
  renderQqLines();
}

let productSearchTimer = null;

async function searchProducts(query, lineIdx) {
  clearTimeout(productSearchTimer);
  const isTierMode = lineIdx === 'tier';
  const ddId = isTierMode ? 'qq-tier-pdropdown' : `qq-pdropdown-${lineIdx}`;
  if (!query || query.length < 2) {
    const dd = document.getElementById(ddId);
    if (dd) dd.style.display = "none";
    return;
  }
  productSearchTimer = setTimeout(async () => {
    try {
      const res = await apiRequest(`/admin/products/autocomplete?q=${encodeURIComponent(query)}&merchantId=1`);
      const items = Array.isArray(res) ? res : (res.items || res.products || res.data || []);
      const dd = document.getElementById(ddId);
      if (!dd) return;
      if (!items.length) { dd.style.display = "none"; return; }
      dd.innerHTML = items.map((p) => `
        <div class="qq-dropdown-item" data-name="${esc(p.name)}" data-price="${p.price}" data-idx="${lineIdx}">
          <span>${esc(p.name)}</span>
          <span class="qq-dropdown-item-sub">${Number(p.price).toFixed(2)}</span>
        </div>
      `).join("");
      dd.style.display = "block";
      dd.querySelectorAll(".qq-dropdown-item").forEach((item) => {
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          if (isTierMode) {
            document.getElementById("qq-tier-concept").value = item.dataset.name;
            // Pre-rellenar precio en Estándar (índice 1)
            const priceInputs = document.querySelectorAll(".qq-tier-price");
            if (priceInputs[1]) priceInputs[1].value = item.dataset.price;
          } else {
            const idx = parseInt(item.dataset.idx);
            qqState.products[idx].concept = item.dataset.name;
            qqState.products[idx].price = item.dataset.price;
            renderQqLines();
          }
          dd.style.display = "none";
        });
      });
    } catch {}
  }, 250);
}

let customerSearchTimer = null;

function initCustomerAutocomplete() {
  const input = document.getElementById("qq-customer-input");
  const dd = document.getElementById("qq-customer-dropdown");
  const newSection = document.getElementById("qq-customer-new");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = input.value.trim();
    qqState.customerId = null;
    qqState.customerName = q;

    clearTimeout(customerSearchTimer);
    if (q.length < 2) { dd.style.display = "none"; newSection.style.display = "none"; return; }

    customerSearchTimer = setTimeout(async () => {
      try {
        const customers = await getCustomers(q);
        if (!customers.length) {
          dd.style.display = "none";
          newSection.style.display = "block";
          return;
        }
        dd.innerHTML = customers.slice(0, 5).map((c) => `
          <div class="qq-dropdown-item" data-id="${c.id}" data-name="${esc(c.name)}" data-phone="${esc(c.phone || '')}">
            <span>${esc(c.name)}</span>
            <span class="qq-dropdown-item-sub">${esc(c.phone || "")}</span>
          </div>
        `).join("");
        dd.innerHTML += `<div class="qq-dropdown-item" data-new="1" style="color:#22c55e;border-top:1px solid #e5e7eb">
          + Crear "${esc(q)}"</div>`;
        dd.style.display = "block";
        newSection.style.display = "none";

        dd.querySelectorAll(".qq-dropdown-item").forEach((item) => {
          item.addEventListener("mousedown", (e) => {
            e.preventDefault();
            if (item.dataset.new) {
              qqState.customerId = null;
              qqState.customerName = q;
              newSection.style.display = "block";
            } else {
              qqState.customerId = parseInt(item.dataset.id);
              qqState.customerName = item.dataset.name;
              qqState.customerPhone = item.dataset.phone;
              input.value = item.dataset.name;
              newSection.style.display = "none";
            }
            dd.style.display = "none";
          });
        });
      } catch {}
    }, 250);
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dd.contains(e.target)) dd.style.display = "none";
  });

  document.getElementById("qq-customer-phone")?.addEventListener("input", (e) => {
    qqState.customerPhone = e.target.value;
  });
}

async function submitQuickQuote() {
  const alertEl = document.getElementById("qq-alert");
  const btn = document.getElementById("qq-send");
  alertEl.style.display = "none";

  // Validar cliente
  const customerName = qqState.customerName.trim();
  if (!customerName) { showQqAlert("Indica el nombre del cliente."); return; }

  // Validar y construir payload según modo
  let quotePayload;

  if (qqState.tiersMode) {
    const concept = document.getElementById("qq-tier-concept")?.value.trim();
    if (!concept) { showQqAlert("Introduce el concepto del servicio."); return; }
    const prices = Array.from(document.querySelectorAll(".qq-tier-price")).map((el) => Number(el.value));
    if (prices.some((p) => !p || p <= 0)) { showQqAlert("Introduce los 3 precios."); return; }
    const labels = ["Básico", "Estándar", "Premium"];
    const ids = ["good", "better", "best"];
    quotePayload = {
      tiers: ids.map((id, i) => ({
        id, label: labels[i], recommended: i === 1,
        lines: [{ concept, qty: 1, price: prices[i], tax: 0 }],
      })),
    };
  } else {
    const lines = qqState.products.filter((l) => l.concept.trim() && Number(l.price) > 0);
    if (!lines.length) { showQqAlert("Añade al menos una línea con concepto y precio."); return; }
    quotePayload = {
      lines: lines.map((l) => ({ concept: l.concept.trim(), qty: Number(l.qty) || 1, price: Number(l.price), tax: 0 })),
    };
  }

  btn.disabled = true;
  btn.textContent = "Enviando…";

  try {
    // 1. Si es cliente nuevo, crearlo primero
    let customerId = qqState.customerId;
    if (!customerId) {
      const phone = (document.getElementById("qq-customer-phone")?.value || qqState.customerPhone).trim();
      const newCustomer = await createCustomer({ name: customerName, phone: phone || null });
      customerId = newCustomer.id;
    }

    const merchant_id = window.appMerchantId;

    // 3. Crear el presupuesto
    const quote = await createQuote({
      merchant_id,
      customer_id: customerId,
      currency: (window.appLocale?.currency || "EUR"),
      paymentTerms: qqState.paymentTerms,
      ...quotePayload,
    });

    // 4. Enviar por WhatsApp
    const sendResult = await apiRequest(`/admin/quotes/${quote.id}/send-whatsapp`, {
      method: "POST",
    });

    closeQuickQuote();

    if (sendResult.sent) {
      showToast("Cotización enviada por WhatsApp ✓");
    } else {
      showToast("Cotización creada. Envío WhatsApp pendiente.", true);
    }

    // Refrescar la vista home
    setTimeout(() => renderAppView("home"), 500);

  } catch (err) {
    showQqAlert(err.message || "Error al crear la cotización.");
    btn.disabled = false;
    btn.textContent = "Enviar por WhatsApp";
  }
}

function showQqAlert(msg) {
  const el = document.getElementById("qq-alert");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
}

function showToast(msg, warn = false) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
    background:${warn ? "#f59e0b" : "#16a34a"}; color:#fff;
    padding:10px 20px; border-radius:999px; font-size:14px; font-weight:600;
    z-index:200; box-shadow:0 4px 12px rgba(0,0,0,0.2); white-space:nowrap;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
