// public/dashboard/js/homeView.js

async function renderHomeView(container) {
  container.innerHTML = `
    <div>
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

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:24px" id="top-grids">
        <div class="top-widget-card">
          <div class="top-widget-title">Top clientes</div>
          <div id="top-customers"><div style="color:var(--slate-300);font-size:13px">Sin datos aún</div></div>
        </div>
        <div class="top-widget-card">
          <div class="top-widget-title">Top servicios</div>
          <div id="top-services"><div style="color:var(--slate-300);font-size:13px">Sin datos aún</div></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-quick-quote").addEventListener("click", openQuickQuoteModal);

  try {
    const [data, merchant] = await Promise.all([
      apiRequest("/admin/metrics/home"),
      apiRequest("/admin/merchant").catch(() => null),
    ]);
    renderKpis(data);
    renderActivity(data.recentActivity || []);
    renderTopCustomers(data.topCustomers || []);
    renderTopServices(data.topServices || []);

    // Setup checklist para usuarios nuevos
    if (merchant) renderSetupChecklist(merchant, data);

    // Badge de solicitudes pendientes
    if (data.pendingRequests > 0) {
      const badge = document.getElementById('req-badge');
      if (badge) { badge.textContent = String(data.pendingRequests); badge.style.display = 'inline-block'; }
    }
  } catch (err) {
    document.getElementById("kpi-grid").innerHTML =
      `<div style="color:#b91c1c;font-size:13px;grid-column:1/-1">Error cargando métricas</div>`;
  }
}

function renderSetupChecklist(merchant, data) {
  const steps = [
    { label: 'Añade tu logo',            done: !!merchant.logoUrl,       action: 'settings', hint: 'Aparecerá en PDFs' },
    { label: 'Completa datos fiscales',  done: !!(merchant.taxId && merchant.address), action: 'settings', hint: 'NIF y dirección para facturas legales' },
    { label: 'Conecta WhatsApp',         done: !!merchant.whatsappPhone,  action: 'settings', hint: 'Recibe notificaciones de pagos' },
    { label: 'Crea tu primer presupuesto', done: data.recentActivity && data.recentActivity.length > 0, action: 'quotes-new', hint: null },
  ];

  const incomplete = steps.filter(s => !s.done);
  if (incomplete.length === 0) return; // todo completo → no mostrar

  const container = document.querySelector('.kpi-grid');
  if (!container) return;

  const checklist = document.createElement('div');
  checklist.style.cssText = 'background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1px solid #bbf7d0;border-radius:14px;padding:16px 18px;margin-bottom:20px;grid-column:1/-1';
  checklist.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-weight:700;font-size:14px;color:#166534">🚀 Completa tu configuración</div>
        <div style="font-size:12px;color:#4d7c0f;margin-top:2px">${incomplete.length} paso${incomplete.length!==1?'s':''} restante${incomplete.length!==1?'s':''}</div>
      </div>
      <div style="background:#dcfce7;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;color:#166534">${steps.filter(s=>s.done).length}/${steps.length}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${steps.map(s => `
        <div style="display:flex;align-items:center;gap:10px;font-size:13px;${s.done?'opacity:.5':''}">
          <span style="width:18px;height:18px;border-radius:50%;border:2px solid ${s.done?'#16a34a':'#86efac'};background:${s.done?'#16a34a':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${s.done?'<span style="color:#fff;font-size:10px">✓</span>':''}
          </span>
          <span style="flex:1;color:${s.done?'#166534':'#374151'};${s.done?'text-decoration:line-through':''}">${s.label}${s.hint?` <span style="color:#94a3b8;font-size:11.5px">· ${s.hint}</span>`:''}
          </span>
          ${!s.done?`<button class="btn-ghost btn-sm" onclick="window.renderAppView&&renderAppView('${s.action}')" style="font-size:11.5px;padding:3px 8px;border:1px solid #86efac;color:#166534">Ir →</button>`:''}
        </div>
      `).join('')}
    </div>
  `;

  // Insertar antes del grid de KPIs
  container.parentNode.insertBefore(checklist, container);
}

function renderKpis(data) {
  const grid = document.getElementById("kpi-grid");
  const hasExpenses = data.expensesThisMonth > 0;
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
    ${hasExpenses ? `
    <div class="kpi-card">
      <div class="kpi-label">Gastos este mes</div>
      <div class="kpi-value" style="color:#dc2626">${fmtMoney(data.expensesThisMonth)}</div>
      <div class="kpi-sub">${data.expensesCount} gasto${data.expensesCount!==1?'s':''} registrado${data.expensesCount!==1?'s':''}</div>
    </div>
    <div class="kpi-card" style="border:2px solid ${data.profitThisMonth>=0?'#22c55e':'#dc2626'}">
      <div class="kpi-label">Beneficio neto</div>
      <div class="kpi-value" style="color:${data.profitThisMonth>=0?'#16a34a':'#dc2626'}">${fmtMoney(data.profitThisMonth)}</div>
      <div class="kpi-sub">ingresos − gastos</div>
    </div>` : ''}
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

function renderTopCustomers(items) {
  const el = document.getElementById("top-customers");
  if (!el) return;
  if (!items.length) { el.innerHTML = `<div class="empty-state" style="padding:20px"><div class="empty-state-desc">Sin facturas cobradas aún</div></div>`; return; }
  el.innerHTML = items.map((c, i) => `
    <div class="top-row">
      <div>
        <span style="color:var(--slate-300);font-weight:700;font-size:12px;margin-right:6px">${i+1}</span>
        <span style="font-weight:600;color:var(--slate-800)">${esc(c.name)}</span>
        <span style="color:var(--slate-400);font-size:11px;margin-left:5px">${c.invoices}×</span>
      </div>
      <span style="font-weight:700;color:var(--slate-900)">${fmtMoney(c.total)}</span>
    </div>`).join('');
}

function renderTopServices(items) {
  const el = document.getElementById("top-services");
  if (!el) return;
  if (!items.length) { el.innerHTML = `<div class="empty-state" style="padding:20px"><div class="empty-state-desc">Sin cotizaciones aceptadas aún</div></div>`; return; }
  const max = items[0]?.count || 1;
  el.innerHTML = items.map((s) => `
    <div class="top-row" style="flex-direction:column;align-items:stretch;gap:5px">
      <div style="display:flex;justify-content:space-between">
        <span style="font-weight:600;color:var(--slate-800);font-size:13px">${esc(s.name)}</span>
        <span style="color:var(--slate-400);font-size:12px">${s.count}×</span>
      </div>
      <div style="background:var(--slate-100);border-radius:var(--radius-full);height:4px;overflow:hidden">
        <div style="background:var(--green-500);height:100%;width:${Math.round(s.count/max*100)}%;border-radius:var(--radius-full);transition:width .4s"></div>
      </div>
    </div>`).join('');
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

function openQuickQuoteModal(prefill) {
  if (document.getElementById("qq-modal-backdrop")) return;

  qqState = { customerId: null, customerName: "", customerPhone: "", products: [{ concept: "", qty: 1, price: "" }], paymentTerms: "FULL_UPFRONT", tiersMode: false };

  const backdrop = document.createElement("div");
  backdrop.className = "modal-overlay";
  backdrop.id = "qq-modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <span class="modal-title">${(window.appLocale && window.appLocale.quoteNew) || 'Nueva cotización'} rápida</span>
        <button class="modal-close" id="qq-close">&times;</button>
      </div>

      <div class="qq-modal-body">
        <!-- Cliente -->
        <div class="field">
          <label>Cliente</label>
          <div class="qq-autocomplete-wrapper">
            <input id="qq-customer-input" type="text" placeholder="Buscar o crear cliente…" autocomplete="off"/>
            <div class="qq-dropdown" id="qq-customer-dropdown" style="display:none"></div>
          </div>
          <div id="qq-customer-new" style="display:none;margin-top:6px">
            <div class="field" style="margin:0">
              <input id="qq-customer-phone" type="tel" placeholder="Teléfono WhatsApp (ej: 521XXXXXXXXXX)"/>
            </div>
          </div>
        </div>

        <!-- Toggle Good/Better/Best -->
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;font-weight:500">
            <input type="checkbox" id="qq-tiers-toggle" style="width:16px;height:16px;accent-color:var(--green-500);flex-shrink:0"/>
            <span>Ofrecer 3 opciones de precio (Good/Better/Best)</span>
          </label>
        </div>

        <!-- Modo clásico: líneas -->
        <div class="field" id="qq-classic-mode">
          <label>Concepto / Servicio</label>
          <div id="qq-lines-container"></div>
          <button type="button" id="qq-add-line" class="btn-ghost btn-sm" style="margin-top:6px;align-self:flex-start;color:var(--green-600)">
            + Añadir línea
          </button>
        </div>

        <!-- Modo tiers -->
        <div id="qq-tiers-mode" style="display:none">
          <div class="field">
            <label>Concepto / Servicio</label>
            <div class="qq-autocomplete-wrapper">
              <input id="qq-tier-concept" type="text" placeholder="Ej: Instalación eléctrica" autocomplete="off"/>
              <div class="qq-dropdown" id="qq-tier-pdropdown" style="display:none"></div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">
            ${['Básico', 'Estándar', 'Premium'].map((label, i) => `
              <div style="border:2px solid ${i===1?'var(--green-500)':'var(--slate-200)'};border-radius:var(--radius-md);padding:10px">
                <div style="font-size:12px;font-weight:700;color:${i===1?'var(--green-600)':'var(--slate-500)'};margin-bottom:6px">
                  ${label}${i===1?' ⭐':''}
                </div>
                <div class="field" style="margin:0">
                  <input type="number" class="qq-tier-price" data-tier-idx="${i}" min="0" step="0.01" placeholder="Precio"/>
                </div>
              </div>
            `).join('')}
          </div>
          <p style="font-size:12px;color:var(--slate-400);margin:6px 0 0">
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
        <div id="qq-alert" class="alert error" style="display:none"></div>
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

  // Prefill (paso WOW del onboarding): cliente nuevo + primera línea ya rellenados
  if (prefill && typeof prefill === "object") {
    if (prefill.customerName) {
      const custInput = document.getElementById("qq-customer-input");
      const newSection = document.getElementById("qq-customer-new");
      if (custInput) custInput.value = prefill.customerName;
      qqState.customerId = null;
      qqState.customerName = prefill.customerName;
      if (newSection) newSection.style.display = "block";
      if (prefill.customerPhone) {
        const phoneInput = document.getElementById("qq-customer-phone");
        if (phoneInput) phoneInput.value = prefill.customerPhone;
        qqState.customerPhone = prefill.customerPhone;
      }
    }
    if (prefill.line && prefill.line.concept) {
      qqState.products = [{
        concept: prefill.line.concept,
        qty: 1,
        price: prefill.line.price != null ? String(prefill.line.price) : "",
      }];
      renderQqLines();
    }
  }
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
        <div class="field" style="margin:0">
          <input type="text" class="qq-concept" data-idx="${i}" value="${esc(line.concept)}"
            placeholder="Concepto…" autocomplete="off"/>
        </div>
        <div class="qq-dropdown qq-product-dropdown" id="qq-pdropdown-${i}" style="display:none"></div>
      </div>
      <div class="field" style="margin:0">
        <input type="number" class="qq-qty" data-idx="${i}" value="${line.qty}" min="1" style="text-align:center"/>
      </div>
      <div class="field" style="margin:0">
        <input type="number" class="qq-price" data-idx="${i}" value="${line.price}" min="0" step="0.01" placeholder="Precio"/>
      </div>
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
  el.className = "alert error";
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
