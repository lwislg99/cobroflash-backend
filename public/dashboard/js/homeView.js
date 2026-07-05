// public/dashboard/js/homeView.js

async function renderHomeView(container) {
  const qLabel = (window.appLocale && window.appLocale.quoteNew) || 'Nueva cotización';
  const firstName = String(window.appUserName || '').trim().split(/\s+/)[0] || '';
  const hour = new Date().getHours();
  const greet = hour < 6 ? 'Buenas noches' : hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  container.innerHTML = `
    <div>
      <!-- Saludo (foco + calidez) + A6.7 Personalizar -->
      <header class="home-greeting" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div>
          <h1>${greet}${firstName ? ', ' + esc(firstName) : ''} 👋</h1>
          <p>Esto es lo que pasa hoy en tu negocio.</p>
        </div>
        ${window.appUserRole === 'admin' ? '<button class="btn-ghost btn-sm" id="btn-home-prefs" title="Elige qué bloques ves en tu Home">⚙ Personalizar</button>' : ''}
      </header>

      <!-- Número héroe: lo que te deben (foco principal) -->
      <div id="home-hero" data-home-block="hero"></div>

      <!-- Acciones rápidas (FRONT1-1) -->
      <div data-home-block="quick">
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
      </div>

      <div data-home-block="kpis">
        <div class="home-section-label">Resumen</div>
        <div class="kpi-grid" id="kpi-grid">
          <div class="kpi-card"><div class="kpi-label skeleton" style="height:14px;width:60%">&nbsp;</div></div>
          <div class="kpi-card"><div class="kpi-label skeleton" style="height:14px;width:60%">&nbsp;</div></div>
          <div class="kpi-card"><div class="kpi-label skeleton" style="height:14px;width:60%">&nbsp;</div></div>
        </div>
      </div>

      <!-- Resumen de la semana (sparkline + tendencias) -->
      <div id="week-summary" data-home-block="week"></div>

      <div data-home-block="activity">
        <div style="font-size:13px;font-weight:600;color:#6b756f;margin:8px 0 8px;text-transform:uppercase;letter-spacing:.04em">
          Actividad reciente
        </div>
        <div class="activity-feed" id="activity-feed">
          <div class="activity-item"><div style="display:flex;align-items:center;gap:10px;width:100%"><span class="skeleton" style="width:32px;height:32px;border-radius:50%"></span><span class="skeleton" style="height:12px;width:40%"></span></div></div>
          <div class="activity-item"><div style="display:flex;align-items:center;gap:10px;width:100%"><span class="skeleton" style="width:32px;height:32px;border-radius:50%"></span><span class="skeleton" style="height:12px;width:55%"></span></div></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:24px" id="top-grids" data-home-block="tops">
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
  document.getElementById("btn-home-prefs")?.addEventListener("click", openHomePrefsPanel);

  // A6.7: aplicar preferencias cacheadas al instante (sin flash en re-renders)
  if (window.appHomePrefs) applyHomePrefs(window.appHomePrefs);

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

    // A6.7: preferencias de bloques desde BD (null = todo visible)
    if (merchant && merchant.homePrefs !== undefined) {
      window.appHomePrefs = merchant.homePrefs || {};
      applyHomePrefs(window.appHomePrefs);
    }

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
  // A1.3: la checklist es tarea del admin (logo, datos fiscales → Configuración);
  // un técnico ni la ve (además su perfil reducido no trae taxId/address).
  if (window.appUserRole && window.appUserRole !== 'admin') return;
  // A6.3: los pasos que hacen que la demo/alta se sienta completa — logo,
  // cómo cobras (IBAN/Bizum), WhatsApp, reseñas y el primer presupuesto.
  const steps = [
    { label: 'Añade tu logo',              done: !!merchant.logoUrl,       action: 'settings', hint: 'Aparecerá en tus presupuestos' },
    { label: 'Configura cómo cobras',      done: !!(merchant.iban || merchant.bizumPhone), action: 'settings', hint: 'IBAN para transferencia o Bizum' },
    { label: 'Conecta tu WhatsApp',        done: !!merchant.whatsappPhone,  action: 'settings', hint: 'Te avisamos cuando acepten o paguen' },
    { label: 'Enlace de reseñas de Google', done: !!merchant.googleReviewUrl, action: 'settings', hint: 'Se lo pedimos al cliente tras pagar' },
    { label: 'Completa NIF y dirección',   done: !!(merchant.taxId && merchant.address), action: 'settings', hint: 'Salen en tus PDF' },
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
  // A2.6 (Parte E): el héroe es TU DINERO EN JUEGO = pendiente de cobrar
  // (facturas) + esperando el sí (presupuestos vivos). Cifra única en Tinta.
  const el = document.getElementById("home-hero");
  if (!el) return;
  const count = data.pendingCount || 0;
  const awaiting = data.quotesAwaiting || 0;
  const pendingAmt = Number(data.pendingAmount || 0);
  const awaitingAmt = Number(data.awaitingAmount || 0);
  const inPlay = pendingAmt + awaitingAmt;

  const parts = [];
  if (pendingAmt > 0) parts.push(`${fmtMoney(pendingAmt)} por cobrar (${count} factura${count !== 1 ? "s" : ""})`);
  if (awaitingAmt > 0) parts.push(`${fmtMoney(awaitingAmt)} esperando el sí (${awaiting} presupuesto${awaiting !== 1 ? "s" : ""})`);

  if (inPlay > 0) {
    el.innerHTML = `
      <div class="home-hero-card">
        <div>
          <div class="home-hero-label">💶 Tienes en juego</div>
          <div class="home-hero-amount">${fmtMoney(inPlay)}</div>
          <div class="home-hero-sub">${parts.join(" · ")}</div>
        </div>
        ${count > 0
          ? `<button class="btn btn-secondary btn-sm" id="hero-go-invoices">Ver facturas →</button>`
          : `<button class="btn btn-secondary btn-sm" id="hero-go-quotes">Ver presupuestos →</button>`}
      </div>
    `;
  } else {
    // Empty state digno: nada pendiente → invitar a crear el siguiente
    el.innerHTML = `
      <div class="home-hero-card">
        <div>
          <div class="home-hero-label">💶 Dinero en juego</div>
          <div class="home-hero-amount">0,00 €</div>
          <div class="home-hero-sub">Nada pendiente 🎉 Crea un presupuesto y pon dinero en juego.</div>
        </div>
        <span class="home-hero-ok">Todo cobrado</span>
      </div>
    `;
  }
  const go = el.querySelector('#hero-go-invoices');
  if (go) go.addEventListener('click', () => window.renderAppView && renderAppView('invoices'));
  const goQ = el.querySelector('#hero-go-quotes');
  if (goQ) goQ.addEventListener('click', () => window.renderAppView && renderAppView('quotes-list'));
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

  // Dos modos MUTUAMENTE EXCLUYENTES con su propio estado: al cambiar de modo
  // no se transforman los datos, cada uno se conserva por separado.
  qqState = {
    customerId: null, customerName: "", customerPhone: "",
    mode: "single",                                   // 'single' | 'tiers'
    products: [{ concept: "", qty: 1, price: "" }],   // modo "Un precio"
    tiers: {                                          // modo "3 opciones"
      concept: "",
      levels: [
        { id: "good",   label: "Básico",   price: "", includes: "" },
        { id: "better", label: "Estándar", price: "", includes: "" },
        { id: "best",   label: "Premium",  price: "", includes: "" },
      ],
    },
    paymentTerms: "FULL_UPFRONT",
  };

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
          <label class="qq-flabel">Cliente</label>
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

        <!-- Elección clara del modo de cotización (no un checkbox que muta el form) -->
        <div class="field">
          <label class="qq-flabel">¿Cómo quieres cotizar?</label>
          <div class="qq-mode" role="tablist" aria-label="Modo de cotización">
            <button type="button" class="qq-mode-btn is-active" data-mode="single" role="tab" aria-selected="true">
              <span class="qq-mode-title">Un precio</span>
              <span class="qq-mode-sub">Un importe para todo el trabajo</span>
            </button>
            <button type="button" class="qq-mode-btn" data-mode="tiers" role="tab" aria-selected="false">
              <span class="qq-mode-title">3 opciones</span>
              <span class="qq-mode-sub">El cliente elige nivel y paga ese</span>
            </button>
          </div>
        </div>

        <!-- MODO "Un precio": líneas que suman a un total -->
        <div class="field" id="qq-mode-single">
          <div class="qq-lines-head">
            <span>Concepto / servicio</span>
            <span style="text-align:center">Cant.</span>
            <span>Precio</span>
            <span></span>
          </div>
          <div id="qq-lines-container"></div>
          <div class="qq-lines-actions">
            <button type="button" id="qq-add-line" class="btn-ghost btn-sm" style="color:var(--green-600)">+ Añadir línea</button>
          </div>
          <div class="qq-total">
            <span class="qq-total-label">Total</span>
            <span class="qq-total-amount" id="qq-total-amount">${esc(fmtMoney(0, window.appLocale?.currency))}</span>
          </div>
        </div>

        <!-- MODO "3 opciones" (Good/Better/Best): concepto único + 3 niveles apilados -->
        <div class="field" id="qq-mode-tiers" style="display:none">
          <label class="qq-flabel">¿De qué es el presupuesto?</label>
          <div class="qq-autocomplete-wrapper">
            <input id="qq-tier-concept" type="text" placeholder="Ej: Instalación eléctrica" autocomplete="off"/>
            <div class="qq-dropdown" id="qq-tier-pdropdown" style="display:none"></div>
          </div>
          <div class="qq-tiers-stack">
            ${[0, 1, 2].map((i) => {
              const lv = qqState.tiers.levels[i];
              const feat = lv.id === 'better';
              return `
              <div class="qq-tier-row${feat ? ' is-featured' : ''}">
                <div class="qq-tier-row-head">
                  <span class="qq-tier-card-label">${lv.label}</span>
                  ${feat ? '<span class="qq-tier-badge">Recomendada</span>' : ''}
                </div>
                <div class="qq-tier-row-fields">
                  <div class="field" style="margin:0">
                    <input type="number" class="qq-tier-price" data-tier-idx="${i}" min="0" step="0.01" placeholder="Precio"/>
                  </div>
                  <div class="field" style="margin:0">
                    <input type="text" class="qq-tier-includes" data-tier-idx="${i}" placeholder="Qué incluye (ej: Marcas + garantía)"/>
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <p class="qq-help">El cliente elige una opción y esa se convierte en su presupuesto.</p>
        </div>

        <!-- Condiciones de pago -->
        <div class="field">
          <label class="qq-flabel">Condiciones de pago</label>
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

  // Selector de modo: decide qué formulario se muestra. Cada modo conserva su
  // estado por separado (no se transforma uno en otro).
  document.querySelectorAll('.qq-mode-btn').forEach((b) => {
    b.addEventListener('click', () => setQqMode(b.dataset.mode));
  });

  // Modo "3 opciones": concepto general + binding de precio/qué incluye al estado
  const tierConceptEl = document.getElementById('qq-tier-concept');
  tierConceptEl?.addEventListener('input', (e) => {
    qqState.tiers.concept = e.target.value;
    searchProducts(e.target.value, 'tier');
  });
  tierConceptEl?.addEventListener('focus', (e) => {
    if (e.target.value.length >= 1) searchProducts(e.target.value, 'tier');
  });
  document.querySelectorAll('.qq-tier-price').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      qqState.tiers.levels[parseInt(e.target.dataset.tierIdx)].price = e.target.value;
    });
  });
  document.querySelectorAll('.qq-tier-includes').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      qqState.tiers.levels[parseInt(e.target.dataset.tierIdx)].includes = e.target.value;
    });
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

// Cambia el modo de cotización mostrando solo su formulario. No transforma datos:
// cada modo conserva su propio estado (products vs tiers).
function setQqMode(mode) {
  qqState.mode = mode;
  document.querySelectorAll('.qq-mode-btn').forEach((b) => {
    const active = b.dataset.mode === mode;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', String(active));
  });
  const single = document.getElementById('qq-mode-single');
  const tiers = document.getElementById('qq-mode-tiers');
  if (single) single.style.display = mode === 'single' ? '' : 'none';
  if (tiers) tiers.style.display = mode === 'tiers' ? '' : 'none';
}

// Total en vivo del modo "Un precio" (importe en tinta tabular, como /pay/invoice).
function updateQqTotal() {
  const el = document.getElementById('qq-total-amount');
  if (!el) return;
  const total = qqState.products.reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0), 0
  );
  el.textContent = fmtMoney(total, window.appLocale?.currency);
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
      updateQqTotal();
    });
  });

  container.querySelectorAll(".qq-price").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      qqState.products[parseInt(e.target.dataset.idx)].price = e.target.value;
      updateQqTotal();
    });
  });

  container.querySelectorAll(".qq-remove-line").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      qqState.products.splice(parseInt(e.target.dataset.idx), 1);
      renderQqLines();
    });
  });

  updateQqTotal();
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
            qqState.tiers.concept = item.dataset.name;
            // Pre-rellenar precio en Estándar (índice 1)
            const priceInputs = document.querySelectorAll(".qq-tier-price");
            if (priceInputs[1]) priceInputs[1].value = item.dataset.price;
            qqState.tiers.levels[1].price = item.dataset.price;
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
        dd.innerHTML += `<div class="qq-dropdown-item" data-new="1" style="color:var(--green-600);border-top:1px solid var(--border)">
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

  // Validar y construir payload según el modo elegido (datos desde el estado).
  let quotePayload;

  if (qqState.mode === "tiers") {
    const concept = (qqState.tiers.concept || "").trim();
    if (!concept) { showQqAlert("Escribe de qué es el presupuesto."); uiMarkFieldError(document.getElementById("qq-tier-concept")); return; }
    const levels = qqState.tiers.levels;
    const bad = levels.findIndex((lv) => !(Number(lv.price) > 0));
    if (bad !== -1) {
      showQqAlert("Pon un precio en las 3 opciones.");
      uiMarkFieldError(document.querySelector(`.qq-tier-price[data-tier-idx="${bad}"]`));
      return;
    }
    quotePayload = {
      tiers: levels.map((lv) => ({
        id: lv.id,
        label: lv.label,
        recommended: lv.id === "better",
        description: (lv.includes || "").trim() || undefined,   // "Qué incluye"
        lines: [{ concept, qty: 1, price: Number(lv.price), tax: 0 }],
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

    // A1.3: técnico por encima de su límite → el presupuesto nace pendiente de
    // aprobación. NO se intenta enviar (daba "API 409: pending_approval" crudo);
    // mensaje digno y al detalle.
    if (quote.status === 'pending_approval') {
      closeQuickQuote();
      showToast('📋 Enviado a un administrador para aprobación');
      setTimeout(() => {
        if (window.renderAppView) renderAppView("quotes-detail", { quoteId: quote.id });
      }, 400);
      return;
    }

    // 4. Enviar por WhatsApp
    const sendResult = await apiRequest(`/admin/quotes/${quote.id}/send-whatsapp`, {
      method: "POST",
    });

    closeQuickQuote();

    const qLabel = (window.appLocale && window.appLocale.quote) || 'presupuesto';
    const qCap = qLabel.charAt(0).toUpperCase() + qLabel.slice(1);
    if (sendResult.sent) {
      showToast(`✓ ${qCap} enviado por WhatsApp`);
    } else {
      // P3-2: mensaje claro del backend si Meta rechazó (en vez de un 502 críptico)
      showToast(sendResult.message || `${qCap} creado. Envío WhatsApp pendiente.`, true);
    }

    // P2-2: en vez de volver a Home con un aviso discreto, abrimos el DETALLE del
    // presupuesto recién enviado (muestra estado SENT + timeline) como feedback claro.
    setTimeout(() => {
      if (window.renderAppView) renderAppView("quotes-detail", { quoteId: quote.id });
      else renderAppView("home");
    }, 400);

  } catch (err) {
    // A1.3: red de seguridad — si el 409 de aprobación llegara por otro camino,
    // jamás enseñar "API 409: pending_approval" crudo.
    const msg = (err && err.data && err.data.error === 'pending_approval')
      ? '📋 Enviado a un administrador para aprobación'
      : (err.message || "Error al crear la cotización.");
    showQqAlert(msg);
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

// A6.2: showToast ahora es compartido y vive en api.js (window.showToast).

// ── A6.7: Home personalizable (versión ligera — checkboxes, sin drag&drop) ──
const HOME_BLOCKS = [
  ['hero',     '💶 Dinero en juego'],
  ['quick',    '⚡ Acciones rápidas'],
  ['kpis',     '📊 Resumen (KPIs)'],
  ['week',     '📈 Resumen de la semana'],
  ['activity', '🕑 Actividad reciente'],
  ['tops',     '🏆 Top clientes y servicios'],
];

// Muestra/oculta cada bloque según prefs ({clave:false} = oculto; default visible)
function applyHomePrefs(prefs) {
  document.querySelectorAll('[data-home-block]').forEach((el) => {
    const k = el.getAttribute('data-home-block');
    el.style.display = prefs && prefs[k] === false ? 'none' : '';
  });
}

function openHomePrefsPanel() {
  if (document.getElementById('home-prefs-backdrop')) return;
  const prefs = window.appHomePrefs || {};

  const backdrop = document.createElement('div');
  backdrop.id = 'home-prefs-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,28,23,.45);display:flex;align-items:center;justify-content:center;z-index:320;padding:16px';
  backdrop.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:22px 20px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.2)" role="dialog" aria-label="Personalizar Home">
      <h2 style="margin:0 0 4px;font-size:16px;color:var(--ink)">Tu Home, a tu gusto</h2>
      <p style="margin:0 0 14px;font-size:13px;color:var(--muted)">Elige qué bloques quieres ver. Se guarda en tu cuenta.</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${HOME_BLOCKS.map(([k, label]) => `
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;border:1px solid var(--border,#e7e9e5);border-radius:10px;padding:9px 12px;font-size:14px;color:var(--ink)">
            <input type="checkbox" data-pref="${k}" ${prefs[k] === false ? '' : 'checked'} style="width:17px;height:17px;accent-color:#16a34a;flex-shrink:0"/>
            <span>${label}</span>
          </label>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button id="hp-cancel" class="btn-ghost btn-sm" style="flex:1">Cancelar</button>
        <button id="hp-save" class="btn-primary btn-sm" style="flex:2">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector('#hp-cancel').addEventListener('click', close);
  backdrop.querySelector('#hp-save').addEventListener('click', async () => {
    const next = {};
    backdrop.querySelectorAll('input[data-pref]').forEach((cb) => { next[cb.dataset.pref] = cb.checked; });
    const btn = backdrop.querySelector('#hp-save');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      await updateMerchantProfile({ homePrefs: next });
      window.appHomePrefs = next;
      applyHomePrefs(next);
      close();
      showToast('✓ Home actualizada');
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Guardar';
      showToast('No se pudo guardar: ' + (err && err.message ? err.message : 'inténtalo de nuevo'), 'error');
    }
  });
}
