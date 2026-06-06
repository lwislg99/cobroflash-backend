// public/dashboard/js/homeView.js

async function renderHomeView(container) {
  const qLabel = (window.appLocale && window.appLocale.quoteNew) || 'Nueva cotización';
  const firstName = String(window.appUserName || '').trim().split(/\s+/)[0] || '';
  const hour = new Date().getHours();
  const greet = hour < 6 ? 'Buenas noches' : hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  container.innerHTML = `
    <div>
      <!-- Saludo (foco + calidez) -->
      <header class="home-greeting">
        <h1>${greet}${firstName ? ', ' + esc(firstName) : ''} 👋</h1>
        <p>Esto es lo que pasa hoy en tu negocio.</p>
      </header>

      <!-- Número héroe: lo que te deben (foco principal) -->
      <div id="home-hero"></div>

      <!-- Acciones rápidas (FRONT1-1) -->
      <div class="home-section-label">Acciones rápidas</div>
      <div class="home-quick-actions">
        <button class="home-action home-cta" id="btn-quick-quote">
          <span class="home-action-ico">⚡</span>
          <span><span class="home-action-title">${qLabel}</span><span class="home-action-sub">en 30 segundos · tecla <kbd>N</kbd></span></span>
        </button>
        <button class="home-action" id="btn-add-customer">
          <span class="home-action-ico">👤</span>
          <span><span class="home-action-title">Añadir cliente</span><span class="home-action-sub">guárdalo una vez</span></span>
        </button>
        <button class="home-action" id="btn-view-pending">
          <span class="home-action-ico">💰</span>
          <span><span class="home-action-title">Pendientes de cobro</span><span class="home-action-sub">facturas abiertas</span></span>
        </button>
      </div>

      <div class="home-section-label">Resumen</div>
      <div class="kpi-grid" id="kpi-grid">
        <div class="kpi-card"><div class="kpi-label skeleton" style="height:14px;width:60%">&nbsp;</div></div>
        <div class="kpi-card"><div class="kpi-label skeleton" style="height:14px;width:60%">&nbsp;</div></div>
        <div class="kpi-card"><div class="kpi-label skeleton" style="height:14px;width:60%">&nbsp;</div></div>
      </div>

      <!-- Resumen de la semana (sparkline + tendencias) -->
      <div id="week-summary"></div>

      <div style="font-size:13px;font-weight:600;color:#6b756f;margin:8px 0 8px;text-transform:uppercase;letter-spacing:.04em">
        Actividad reciente
      </div>
      <div class="activity-feed" id="activity-feed">
        <div class="activity-item"><div style="display:flex;align-items:center;gap:10px;width:100%"><span class="skeleton" style="width:32px;height:32px;border-radius:50%"></span><span class="skeleton" style="height:12px;width:40%"></span></div></div>
        <div class="activity-item"><div style="display:flex;align-items:center;gap:10px;width:100%"><span class="skeleton" style="width:32px;height:32px;border-radius:50%"></span><span class="skeleton" style="height:12px;width:55%"></span></div></div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:24px" id="top-grids">
        <div class="top-widget-card">
          <div class="top-widget-title">Top clientes</div>
          <div id="top-customers"><div style="color:var(--neutral-500);font-size:13px">Sin datos aún</div></div>
        </div>
        <div class="top-widget-card">
          <div class="top-widget-title">Top servicios</div>
          <div id="top-services"><div style="color:var(--neutral-500);font-size:13px">Sin datos aún</div></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-quick-quote").addEventListener("click", openQuickQuoteModal);
  document.getElementById("btn-add-customer").addEventListener("click", () => window.renderAppView && renderAppView('customers'));
  document.getElementById("btn-view-pending").addEventListener("click", () => window.renderAppView && renderAppView('invoices'));

  try {
    const [data, merchant] = await Promise.all([
      apiRequest("/admin/metrics/home"),
      apiRequest("/admin/merchant").catch(() => null),
    ]);
    renderHero(data);
    renderKpis(data);
    renderWeekSummary(data);
    renderActivity(data.recentActivity || []);
    renderTopCustomers(data.topCustomers || []);
    renderTopServices(data.topServices || []);

    // Setup checklist para usuarios nuevos
    if (merchant) renderSetupChecklist(merchant, data);

    // Badges del sidebar (FRONT1-2)
    updateSidebarBadges(data);

    // Rendimiento del equipo (ANA-3) — solo admin con técnicos
    renderTeamPerformance(container);
  } catch (err) {
    uiErrorState(
      document.getElementById("kpi-grid"),
      "No pudimos cargar tus métricas. Revisa tu conexión.",
      () => renderHomeView(container)
    );
    const af = document.getElementById("activity-feed");
    if (af) af.innerHTML = "";   // detener los skeletons que quedaban cargando
  }
}

function setNavBadge(id, count, max99 = true) {
  const badge = document.getElementById(id);
  if (!badge) return;
  if (count > 0) {
    badge.textContent = max99 && count > 99 ? '99+' : String(count);
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// Actualiza los contadores del sidebar. Expuesto en window para llamarlo desde app.js.
function updateSidebarBadges(data) {
  if (!data) return;
  setNavBadge('req-badge', data.pendingRequests || 0);
  setNavBadge('nav-quotes-badge', data.quotesAwaiting || 0);
  setNavBadge('nav-invoices-badge', data.pendingCount || 0);
}
window.updateSidebarBadges = updateSidebarBadges;

// Refresca los badges del sidebar sin renderizar el Home (para usar al iniciar la app).
async function refreshSidebarBadges() {
  try {
    const data = await apiRequest('/admin/metrics/home');
    updateSidebarBadges(data);
  } catch { /* silencioso */ }
}
window.refreshSidebarBadges = refreshSidebarBadges;

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
          <span style="flex:1;color:${s.done?'#166534':'#333c37'};${s.done?'text-decoration:line-through':''}">${s.label}${s.hint?` <span style="color:#949b92;font-size:11.5px">· ${s.hint}</span>`:''}
          </span>
          ${!s.done?`<button class="btn-ghost btn-sm" onclick="window.renderAppView&&renderAppView('${s.action}')" style="font-size:11.5px;padding:3px 8px;border:1px solid #86efac;color:#166534">Ir →</button>`:''}
        </div>
      `).join('')}
    </div>
  `;

  // Insertar antes del grid de KPIs
  container.parentNode.insertBefore(checklist, container);
}

function renderHero(data) {
  const el = document.getElementById("home-hero");
  if (!el) return;
  const count = data.pendingCount || 0;
  el.innerHTML = `
    <div class="home-hero-card">
      <div>
        <div class="home-hero-label">Pendiente de cobro</div>
        <div class="home-hero-amount">${fmtMoney(data.pendingAmount)}</div>
        <div class="home-hero-sub">${count} factura${count !== 1 ? "s" : ""} por cobrar</div>
      </div>
      ${count > 0
        ? `<button class="btn btn-secondary btn-sm" id="hero-go-invoices">Ver facturas →</button>`
        : `<span class="home-hero-ok">Todo cobrado 🎉</span>`}
    </div>
  `;
  const go = el.querySelector('#hero-go-invoices');
  if (go) go.addEventListener('click', () => window.renderAppView && renderAppView('invoices'));
}

function renderKpis(data) {
  const grid = document.getElementById("kpi-grid");
  const hasExpenses = data.expensesThisMonth > 0;
  grid.innerHTML = `
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
      <div class="kpi-value">${fmtMoney(data.expensesThisMonth)}</div>
      <div class="kpi-sub">${data.expensesCount} gasto${data.expensesCount!==1?'s':''} registrado${data.expensesCount!==1?'s':''}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Beneficio neto</div>
      <div class="kpi-value">${fmtMoney(data.profitThisMonth)}</div>
      <div class="kpi-sub">${profitChip(data.profitThisMonth)}ingresos − gastos</div>
    </div>` : ''}
  `;
}

// Estado del beneficio como chip pequeño: el importe va siempre en tinta
// (Regla del Importe) y el color semántico vive en la etiqueta, no en la cifra.
function profitChip(value) {
  const positive = value >= 0;
  const fg = positive ? '#15803d' : '#b91c1c';
  const bg = positive ? 'rgba(22,163,74,.10)' : 'rgba(220,38,38,.10)';
  const label = positive ? 'En positivo' : 'En pérdida';
  return `<span style="display:inline-block;font-size:10.5px;font-weight:700;color:${fg};background:${bg};border-radius:var(--radius-full);padding:1px 7px;margin-right:6px">${label}</span>`;
}

function trendChip(current, prev) {
  if (prev == null) return '';
  const diff = current - prev;
  if (diff === 0) return `<span style="font-size:11px;color:#6b756f">→ igual</span>`;
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : null;
  const up = diff > 0;
  const color = up ? '#16a34a' : '#dc2626';
  const label = pct !== null ? `${Math.abs(pct)}%` : Math.abs(diff);
  return `<span style="font-size:11px;color:${color};font-weight:600">${up ? '▲' : '▼'} ${label}</span>`;
}

function renderWeekSummary(data) {
  const el = document.getElementById("week-summary");
  if (!el) return;
  const w = data.weekly || {};
  const spark = Array.isArray(data.sparkline) ? data.sparkline : [];
  const respText = data.avgResponseHours != null
    ? (data.avgResponseHours < 48 ? `${data.avgResponseHours} h` : `${Math.round(data.avgResponseHours / 24)} d`)
    : '—';

  el.innerHTML = `
    <div class="week-summary-card">
      <div class="week-summary-item">
        <div class="week-summary-label">Cotizaciones esta semana</div>
        <div class="week-summary-value">${w.quotesThisWeek ?? 0} ${trendChip(w.quotesThisWeek ?? 0, w.quotesLastWeek ?? 0)}</div>
      </div>
      <div class="week-summary-item">
        <div class="week-summary-label">Cobrado esta semana</div>
        <div class="week-summary-value">${fmtMoney(w.collectedThisWeek ?? 0)} ${trendChip(w.collectedThisWeek ?? 0, w.collectedLastWeek ?? 0)}</div>
      </div>
      <div class="week-summary-item">
        <div class="week-summary-label">Respuesta media del cliente</div>
        <div class="week-summary-value">${respText}</div>
      </div>
      <div class="week-summary-item week-summary-spark">
        <div class="week-summary-label">Envíos · últimos 7 días</div>
        ${buildSparkline(spark)}
      </div>
    </div>
  `;
}

function buildSparkline(values) {
  const vals = values.length ? values : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...vals, 1);
  const W = 120, H = 32, n = vals.length;
  const bw = W / n;
  const bars = vals.map((v, i) => {
    const h = Math.max(2, (v / max) * (H - 4));
    const x = i * bw + 1;
    const y = H - h;
    const today = i === n - 1;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${today ? '#16a34a' : '#bbf7d0'}"><title>${v}</title></rect>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block">${bars}</svg>`;
}

function renderActivity(items) {
  const feed = document.getElementById("activity-feed");
  if (!items.length) {
    feed.innerHTML = `<div style="color:#6b756f;font-size:13px">Sin actividad reciente</div>`;
    return;
  }
  feed.innerHTML = items.map((item) => {
    const statusLabel = {
      draft: "Borrador", sent: "Enviado", accepted: "Aceptado", rejected: "Rechazado",
    }[item.status] || item.status;
    const statusColor = {
      accepted: "#16a34a", rejected: "#dc2626", sent: "#2563eb", draft: "#6b756f",
    }[item.status] || "#6b756f";
    const date = new Date(item.updatedAt).toLocaleDateString("es", { day: "2-digit", month: "short" });
    const initial = (item.customer || '?').trim().charAt(0).toUpperCase() || '?';
    return `
      <div class="activity-item" style="cursor:pointer" role="button" tabindex="0"
        data-quote-id="${item.id}"
        aria-label="Cotización ${item.id} de ${esc(item.customer)}, ${statusLabel}, ${fmtMoney(item.total, item.currency)}">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="width:32px;height:32px;border-radius:50%;background:${statusColor}1a;color:${statusColor};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">${esc(initial)}</span>
          <div>
            <div class="activity-customer">${esc(item.customer)}</div>
            <div class="activity-meta">Cotización #${item.id} · ${date}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="activity-amount">${fmtMoney(item.total, item.currency)}</div>
          <div style="font-size:12px;color:${statusColor};font-weight:600">● ${statusLabel}</div>
        </div>
      </div>
    `;
  }).join("");

  // Accesible: click + teclado (Enter/Espacio) en cada fila
  feed.querySelectorAll(".activity-item[data-quote-id]").forEach((row) => {
    const go = () => window.renderAppView && renderAppView("quotes-detail", { quoteId: Number(row.dataset.quoteId) });
    row.addEventListener("click", go);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
    });
  });
}

function renderTopCustomers(items) {
  const el = document.getElementById("top-customers");
  if (!el) return;
  if (!items.length) { el.innerHTML = `<div class="empty-state" style="padding:20px"><div class="empty-state-desc">Sin facturas cobradas aún</div></div>`; return; }
  el.innerHTML = items.map((c, i) => `
    <div class="top-row">
      <div>
        <span style="color:var(--neutral-500);font-weight:700;font-size:12px;margin-right:6px">${i+1}</span>
        <span style="font-weight:600;color:var(--neutral-800)">${esc(c.name)}</span>
        <span style="color:var(--neutral-500);font-size:11px;margin-left:5px">${c.invoices}×</span>
      </div>
      <span style="font-weight:700;color:var(--neutral-900)">${fmtMoney(c.total)}</span>
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
        <span style="font-weight:600;color:var(--neutral-800);font-size:13px">${esc(s.name)}</span>
        <span style="color:var(--neutral-500);font-size:12px">${s.count}×</span>
      </div>
      <div style="background:var(--neutral-100);border-radius:var(--radius-full);height:4px;overflow:hidden">
        <div style="background:var(--green-500);height:100%;width:${Math.round(s.count/max*100)}%;border-radius:var(--radius-full);transition:width .4s"></div>
      </div>
    </div>`).join('');
}

async function renderTeamPerformance(container) {
  // Solo para el propietario/admin
  if (window.appUserRole && window.appUserRole !== 'admin') return;

  let data;
  try {
    data = await apiRequest('/admin/metrics/team');
  } catch { return; }
  if (!data || !data.hasTeam || !Array.isArray(data.members)) return;

  const section = document.createElement('div');
  section.style.cssText = 'margin-top:24px';

  const rows = data.members.map((m) => {
    const accColor = m.acceptanceRate >= 50 ? 'var(--green-600)' : m.acceptanceRate >= 25 ? 'var(--neutral-600)' : 'var(--red-600)';
    const best = m.isBest ? '<span style="background:#fef9c3;color:#a16207;font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;margin-left:6px">⭐ Mejor del mes</span>' : '';
    const roleLabel = m.role === 'owner' ? 'Propietario' : m.role === 'tecnico' ? 'Técnico' : m.role;
    return `
      <tr>
        <td style="font-weight:600">${esc(m.name)}${best}<div style="font-size:11px;color:var(--neutral-500);font-weight:400">${roleLabel}</div></td>
        <td style="text-align:right">${m.sent}</td>
        <td style="text-align:right;color:${accColor};font-weight:600">${m.acceptanceRate}%</td>
        <td style="text-align:right;color:var(--green-700);font-weight:600">${fmtMoney(m.collected)}</td>
      </tr>`;
  }).join('');

  const inactiveAlert = (data.inactive && data.inactive.length)
    ? `<div style="margin-top:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 14px;font-size:13px;color:#9a3412">⚠️ Sin actividad esta semana: <strong>${data.inactive.map(esc).join(', ')}</strong></div>`
    : '';

  section.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:#6b756f;margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">Rendimiento del equipo · este mes</div>
    <div class="data-card">
      <div class="table-scroll">
        <table class="table" style="min-width:420px">
          <thead><tr>
            <th>Miembro</th>
            <th style="text-align:right">Cotizaciones</th>
            <th style="text-align:right">Aceptación</th>
            <th style="text-align:right">Cobrado</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${inactiveAlert ? `<div style="padding:0 16px 14px">${inactiveAlert}</div>` : ''}
    </div>
  `;
  container.appendChild(section);
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

  const qNew = (window.appLocale && window.appLocale.quoteNew) || 'Nueva cotización';
  // Concordancia de género: "Nuevo presupuesto rápido" / "Nueva cotización rápida"
  const qFast = qNew.trim().toLowerCase().startsWith('nuevo') ? 'rápido' : 'rápida';

  const backdrop = document.createElement("div");
  backdrop.className = "modal-overlay";
  backdrop.id = "qq-modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal qq-modal">
      <div class="modal-header">
        <span class="modal-title">${qNew} ${qFast}</span>
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

        <!-- Conceptos: modo clásico (tabla) o 3 opciones (un concepto + 3 precios) -->
        <div class="field">
          <!-- Modo clásico: tabla de líneas -->
          <div id="qq-classic-mode">
            <div class="qq-lines-head">
              <span>Concepto / servicio</span>
              <span style="text-align:center">Cant.</span>
              <span>Precio</span>
              <span></span>
            </div>
            <div id="qq-lines-container"></div>
          </div>

          <!-- Modo 3 opciones: concepto único + 3 tarjetas de precio -->
          <div id="qq-tiers-mode" style="display:none">
            <label>Concepto / servicio</label>
            <div class="qq-autocomplete-wrapper">
              <input id="qq-tier-concept" type="text" placeholder="Ej: Instalación eléctrica" autocomplete="off"/>
              <div class="qq-dropdown" id="qq-tier-pdropdown" style="display:none"></div>
            </div>
            <div class="qq-tiers-grid">
              ${['Básico', 'Estándar', 'Premium'].map((label, i) => `
                <div class="qq-tier-card${i === 1 ? ' is-featured' : ''}">
                  <div class="qq-tier-card-label">${label}${i === 1 ? ' ⭐' : ''}</div>
                  <div class="field" style="margin:0">
                    <input type="number" class="qq-tier-price" data-tier-idx="${i}" min="0" step="0.01" placeholder="Precio"/>
                  </div>
                </div>
              `).join('')}
            </div>
            <p style="font-size:12px;color:var(--neutral-500);margin:8px 0 0">El cliente ve las 3 opciones y elige la que prefiera.</p>
          </div>

          <!-- Acciones: añadir línea + chip para activar las 3 opciones -->
          <div class="qq-lines-actions">
            <button type="button" id="qq-add-line" class="btn-ghost btn-sm" style="color:var(--green-600)">+ Añadir línea</button>
            <button type="button" id="qq-tiers-chip" class="qq-chip" aria-pressed="false">
              <span class="qq-chip-ico">⊞</span> 3 opciones de precio
            </button>
          </div>
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
          <p style="font-size:12px;color:var(--neutral-500);margin:6px 0 0">💡 "100% al aceptar" genera la factura cuando el cliente firma.</p>
        </div>
      </div>

      <div class="modal-footer" style="flex-direction:column;gap:8px">
        <div id="qq-alert" class="alert error" role="alert" aria-live="assertive" style="display:none"></div>
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

  // Escape cierra el modal (igual que ×, Cancelar y clic fuera)
  qqEscHandler = (e) => { if (e.key === "Escape") closeQuickQuote(); };
  document.addEventListener("keydown", qqEscHandler);

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

  // Chip "3 opciones de precio": alterna entre tabla multi-línea y concepto único + 3 niveles.
  document.getElementById('qq-tiers-chip')?.addEventListener('click', () => {
    const on = !qqState.tiersMode;
    qqState.tiersMode = on;

    const chip = document.getElementById('qq-tiers-chip');
    const tierConcept = document.getElementById('qq-tier-concept');
    const firstClassic = document.querySelector('.qq-concept');

    // El concepto se mantiene al cambiar de modo (no perder de qué es el presupuesto)
    if (on && firstClassic && firstClassic.value && tierConcept && !tierConcept.value) {
      tierConcept.value = firstClassic.value;
    } else if (!on && tierConcept && tierConcept.value && firstClassic && !firstClassic.value) {
      firstClassic.value = tierConcept.value;
      if (qqState.products[0]) qqState.products[0].concept = tierConcept.value;
    }

    chip.setAttribute('aria-pressed', String(on));
    document.getElementById('qq-classic-mode').style.display = on ? 'none' : 'block';
    document.getElementById('qq-tiers-mode').style.display = on ? 'block' : 'none';
    document.getElementById('qq-add-line').style.display = on ? 'none' : '';
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

let qqEscHandler = null;
function closeQuickQuote() {
  const el = document.getElementById("qq-modal-backdrop");
  if (el) el.remove();
  if (qqEscHandler) { document.removeEventListener("keydown", qqEscHandler); qqEscHandler = null; }
}

function renderQqLines() {
  const container = document.getElementById("qq-lines-container");
  if (!container) return;
  container.innerHTML = qqState.products.map((line, i) => `
    <div class="qq-line-row">
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
        dd.innerHTML += `<div class="qq-dropdown-item" data-new="1" style="color:#22c55e;border-top:1px solid #e7e9e5">
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
  if (!customerName) { showQqAlert("Indica el nombre del cliente."); uiMarkFieldError(document.getElementById("qq-customer-input")); return; }

  // Validar y construir payload según modo
  let quotePayload;

  if (qqState.tiersMode) {
    const conceptEl = document.getElementById("qq-tier-concept");
    const concept = conceptEl?.value.trim();
    if (!concept) { showQqAlert("Introduce el concepto del servicio."); uiMarkFieldError(conceptEl); return; }
    const priceEls = Array.from(document.querySelectorAll(".qq-tier-price"));
    const prices = priceEls.map((el) => Number(el.value));
    if (prices.some((p) => !p || p <= 0)) { showQqAlert("Introduce los 3 precios."); uiMarkFieldError(priceEls.find((el) => !Number(el.value) || Number(el.value) <= 0)); return; }
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
    if (!lines.length) { showQqAlert("Añade al menos una línea con concepto y precio."); uiMarkFieldError(document.querySelector(".qq-concept")); return; }
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
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
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
