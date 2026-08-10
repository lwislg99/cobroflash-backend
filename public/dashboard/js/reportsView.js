// public/dashboard/js/reportsView.js
// Vista de Informes: P&L mensual con gráfico SVG (sin dependencias externas)

async function renderReportsView(container) {
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:20px;max-width:960px';
  container.appendChild(wrap);

  // ── Header ──────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'customers-card';
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap';

  const titleBlock = document.createElement('div');
  titleBlock.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">Informe de rentabilidad</h2>
    <p style="margin:0;font-size:13px;color:var(--neutral-400)">Ingresos, gastos y beneficio neto por mes.</p>
  `;
  header.appendChild(titleBlock);

  // Selector de año
  const yearRow = document.createElement('div');
  yearRow.style.cssText = 'display:flex;align-items:center;gap:8px';
  const yearSelect = document.createElement('select');
  yearSelect.style.cssText = 'padding:6px 10px;border:1.5px solid var(--neutral-200);border-radius:8px;font-size:13px;background:#fff;cursor:pointer';
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 4; y--) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    yearSelect.appendChild(opt);
  }
  yearRow.appendChild(yearSelect);

  // Botones de exportar
  const exportRow = document.createElement('div');
  exportRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';

  function makeExportBtn(label, href) {
    const a = document.createElement('a');
    a.href = href;
    a.className = 'btn-secondary btn-sm';
    a.style.textDecoration = 'none';
    a.innerHTML = `⬇ ${label}`;
    return a;
  }

  const btnInv  = makeExportBtn('Facturas CSV',     '/admin/exports/invoices.csv');
  const btnExp  = makeExportBtn('Gastos CSV',        '/admin/exports/expenses.csv');
  const btnQuot = makeExportBtn('Presupuestos CSV',  '/admin/exports/quotes.csv');
  const btnCust = makeExportBtn('Clientes CSV',      '/admin/exports/customers.csv'); // A11.4 (RGPD)
  exportRow.appendChild(btnInv);
  exportRow.appendChild(btnExp);
  exportRow.appendChild(btnQuot);
  exportRow.appendChild(btnCust);

  // VeriFactu XML (registro RRSIF) — solo aplica a negocios de España con NIF;
  // se descarga vía fetch para poder mostrar el aviso del backend si no aplica.
  const btnVf = document.createElement('button');
  btnVf.className = 'btn-secondary btn-sm';
  btnVf.innerHTML = '⬇ VeriFactu XML';
  btnVf.title = 'Registro de facturación RRSIF del año (España, RD 1007/2023)';
  btnVf.addEventListener('click', async () => {
    const year = yearSelect.value;
    btnVf.disabled = true;
    try {
      // SCRUM-405: por la forma común. ERA EL CUARTO SITIO con el defecto, y no estaba en el
      // censo de SCRUM-356 —que solo miró `exportView.js`—: lo encontró el guard por AST. Aquí
      // pesa más que en los otros tres, porque lo que se descarga es el registro VeriFactu: con
      // un portal cautivo, el profesional se guardaba la página de login del router como
      // `verifactu_2026.xml`.
      await descargarBinario(`/admin/exports/verifactu.xml?year=${year}`, {
        tipoEsperado: 'xml',
        nombrePorDefecto: `verifactu_${year}.xml`,
      });
    } catch (e) {
      if (e && e.code === ERROR_NO_ES_FICHERO) { showToast(MSG_DESCARGA_NO_ES_FICHERO, 'error'); return; }
      showToast('Error de red al descargar el XML.', 'error');
    } finally {
      btnVf.disabled = false;
    }
  });
  exportRow.appendChild(btnVf);

  const rightBlock = document.createElement('div');
  rightBlock.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-items:flex-end';
  rightBlock.appendChild(yearRow);
  rightBlock.appendChild(exportRow);
  header.appendChild(rightBlock);
  wrap.appendChild(header);

  // ── Área de contenido ────────────────────────────────────────────────────
  const alertEl = document.createElement('div');
  alertEl.className = 'alert';
  alertEl.style.display = 'none';
  wrap.appendChild(alertEl);

  const chartCard = document.createElement('div');
  chartCard.className = 'customers-card';
  wrap.appendChild(chartCard);

  const summaryCard = document.createElement('div');
  summaryCard.className = 'customers-card';
  wrap.appendChild(summaryCard);

  // ── IVA repercutido (modelo 303) ─────────────────────────────────────────
  const vatCard = document.createElement('div');
  vatCard.className = 'customers-card';
  wrap.appendChild(vatCard);

  // ── Analytics: funnel + rentabilidad por servicio ────────────────────────
  const funnelCard = document.createElement('div');
  funnelCard.className = 'customers-card';
  wrap.appendChild(funnelCard);

  const servicesCard = document.createElement('div');
  servicesCard.className = 'customers-card';
  wrap.appendChild(servicesCard);

  loadAnalytics(funnelCard, servicesCard);

  // A16.1 (X2): cobros por método + € por recordatorios + pendiente por antigüedad
  const x2Card = document.createElement('div');
  x2Card.className = 'customers-card';
  x2Card.style.display = 'none';
  wrap.appendChild(x2Card);

  // J8: métricas de coste y entrega de WhatsApp (se oculta si aún no hay envíos)
  const waCard = document.createElement('div');
  waCard.className = 'customers-card';
  waCard.style.display = 'none';
  wrap.appendChild(waCard);
  loadWhatsAppMetrics(waCard);

  // V0-3: funnel de PLATAFORMA — solo se pinta para cuentas owner (el endpoint devuelve 403 al resto)
  const platformCard = document.createElement('div');
  platformCard.className = 'customers-card';
  platformCard.style.display = 'none';
  wrap.appendChild(platformCard);
  loadPlatformFunnel(platformCard);

  async function load(year) {
    chartCard.innerHTML = '<p style="color:var(--neutral-400);font-size:13px;padding:8px 0">Cargando…</p>';
    summaryCard.innerHTML = '';

    let data;
    try {
      data = await apiRequest(`/admin/reports/pl?year=${year}`);
    } catch {
      chartCard.innerHTML = '<p style="color:var(--red-600);font-size:13px">Error al cargar los datos.</p>';
      return;
    }

    const { months, totals, prevYear, currency } = data;
    const fmt = (n) => Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ── Tarjetas KPI ─────────────────────────────────────────────────────
    const kpiWrap = document.createElement('div');
    kpiWrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:20px';
    chartCard.innerHTML = '';
    chartCard.appendChild(kpiWrap);

    const kpis = [
      { label: 'Ingresos totales', value: totals.revenue,  prev: prevYear.revenue,  color: 'var(--green-600)' },
      { label: 'Gastos totales',   value: totals.expenses, prev: prevYear.expenses, color: 'var(--red-600)' },
      { label: 'Beneficio neto',   value: totals.profit,   prev: prevYear.profit,   color: totals.profit >= 0 ? 'var(--green-600)' : 'var(--red-600)' },
    ];
    // A15.3 (MANT-1): € que nacieron del ciclo de mantenimientos — solo si existe
    if (Number(totals.maintenance) > 0) {
      kpiWrap.style.gridTemplateColumns = 'repeat(auto-fit,minmax(140px,1fr))';
      kpis.push({ label: '🔧 De mantenimientos', value: totals.maintenance, prev: null, color: 'var(--green-600)' });
    }

    kpis.forEach(({ label, value, prev, color }) => {
      const pct = (prev !== null && prev !== undefined && prev !== 0)
        ? Math.round((value - prev) / Math.abs(prev) * 100) : null;
      const sign = pct === null ? '' : pct >= 0 ? '▲' : '▼';
      const pctColor = pct === null ? 'var(--neutral-400)' : pct >= 0 ? 'var(--green-600)' : 'var(--red-600)';
      const kpi = document.createElement('div');
      kpi.className = 'kpi-card';
      kpi.innerHTML = `
        <div class="kpi-label">${label}</div>
        <div class="kpi-value" style="color:${color};font-size:22px">${fmt(value)} <span style="font-size:12px;font-weight:400;color:var(--neutral-400)">${currency === 'EUR' ? '€' : currency}</span></div>
        ${pct !== null ? `<div class="kpi-sub" style="color:${pctColor}">${sign} ${Math.abs(pct)}% vs ${year - 1}</div>` : ''}
      `;
      kpiWrap.appendChild(kpi);
    });

    // ── Gráfico SVG de barras ─────────────────────────────────────────────
    const chartTitle = document.createElement('h3');
    chartTitle.style.cssText = 'margin:0 0 12px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em';
    chartTitle.textContent = `Desglose mensual ${year}`;
    chartCard.appendChild(chartTitle);

    chartCard.appendChild(buildBarChart(months, currency));

    // Leyenda
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;gap:16px;margin-top:10px;font-size:12px;color:var(--neutral-500)';
    legend.innerHTML = `
      <span><span style="display:inline-block;width:10px;height:10px;background:#22c55e;border-radius:2px;margin-right:4px"></span>Ingresos</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:2px;margin-right:4px"></span>Gastos</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:#2563eb;border-radius:2px;margin-right:4px"></span>Beneficio</span>
    `;
    chartCard.appendChild(legend);

    // ── Tabla resumen mensual ─────────────────────────────────────────────
    summaryCard.innerHTML = `
      <h3 style="margin:0 0 14px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em">Resumen mensual</h3>
    `;

    const tableWrap = document.createElement('div');
    tableWrap.className = 'table-scroll';
    const table = document.createElement('table');
    table.className = 'table';
    table.style.minWidth = '520px';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Mes</th>
          <th style="text-align:right">Ingresos</th>
          <th style="text-align:right">Gastos</th>
          <th style="text-align:right">Beneficio</th>
          <th style="text-align:right">Margen</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');

    months.forEach(m => {
      const margin = m.revenue > 0 ? Math.round(m.profit / m.revenue * 100) : (m.revenue === 0 && m.expenses === 0 ? null : -100);
      const profitColor = m.profit >= 0 ? 'var(--green-700)' : 'var(--red-600)';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600">${m.label}</td>
        <td style="text-align:right;color:var(--green-700)">${m.revenue > 0 ? fmt(m.revenue) : '<span style="color:var(--neutral-300)">—</span>'}</td>
        <td style="text-align:right;color:var(--red-600)">${m.expenses > 0 ? fmt(m.expenses) : '<span style="color:var(--neutral-300)">—</span>'}</td>
        <td style="text-align:right;font-weight:600;color:${profitColor}">${fmt(m.profit)}</td>
        <td style="text-align:right;color:var(--neutral-500)">${margin !== null ? margin + '%' : '—'}</td>
      `;
      tbody.appendChild(tr);
    });

    // Fila de totales
    const totalMargin = totals.revenue > 0 ? Math.round(totals.profit / totals.revenue * 100) : null;
    const trTotal = document.createElement('tr');
    trTotal.style.cssText = 'background:var(--neutral-50);font-weight:700;border-top:2px solid var(--neutral-200)';
    trTotal.innerHTML = `
      <td>TOTAL ${year}</td>
      <td style="text-align:right;color:var(--green-700)">${fmt(totals.revenue)}</td>
      <td style="text-align:right;color:var(--red-600)">${fmt(totals.expenses)}</td>
      <td style="text-align:right;color:${totals.profit >= 0 ? 'var(--green-700)' : 'var(--red-600)'}">${fmt(totals.profit)}</td>
      <td style="text-align:right">${totalMargin !== null ? totalMargin + '%' : '—'}</td>
    `;
    tbody.appendChild(trTotal);

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    summaryCard.appendChild(tableWrap);

    // ── SCRUM-228 · desglose por empleado ─────────────────────────────────
    //
    // EL INVARIANTE MANDA EN EL DISEÑO: las filas suman SIEMPRE lo que dice el pie. Con todo
    // seleccionado el pie es el TOTAL del año y coincide con el KPI de arriba; en cuanto se
    // deselecciona algo, el pie cambia de nombre y avisa — un subtotal parcial no puede
    // parecerse a un total, que es justo cómo se pierde la confianza en una pantalla de dinero.
    if (Array.isArray(data.byEmployee) && data.byEmployee.length > 1) {
      summaryCard.appendChild(buildDesgloseEmpleado(data.byEmployee, year, fmt, currency));
    }

    // Actualizar links de exportar con el año
    btnInv.href  = `/admin/exports/invoices.csv?from=${year}-01-01&to=${year}-12-31`;
    btnExp.href  = `/admin/exports/expenses.csv?from=${year}-01-01&to=${year}-12-31`;
    btnQuot.href = `/admin/exports/quotes.csv?from=${year}-01-01&to=${year}-12-31`;
  }

  // ── Carga del bloque IVA (modelo 303) ────────────────────────────────────
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  let vatQuarter = currentQuarter;

  async function loadVat(year) {
    vatCard.innerHTML = '<p style="color:var(--neutral-400);font-size:13px;padding:8px 0">Cargando IVA…</p>';

    let data;
    try {
      data = await apiRequest(`/admin/reports/vat?year=${year}&quarter=${vatQuarter}`);
    } catch {
      vatCard.innerHTML = '<p style="color:var(--red-600);font-size:13px">Error al cargar el resumen de IVA.</p>';
      return;
    }

    const fmt = (n) => Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    vatCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <div>
          <h3 style="margin:0 0 4px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em">IVA repercutido · modelo 303</h3>
          <p style="margin:0;font-size:12px;color:var(--neutral-400)">Facturas emitidas del ${data.from} al ${data.to} (devengo). Las rectificativas restan.</p>
        </div>
        <div id="vat-quarter-row" style="display:flex;gap:4px"></div>
      </div>
    `;

    // Selector de trimestre (segmented)
    const qRow = vatCard.querySelector('#vat-quarter-row');
    for (let q = 1; q <= 4; q++) {
      const b = document.createElement('button');
      b.className = q === vatQuarter ? 'btn-primary btn-sm' : 'btn-ghost btn-sm';
      b.textContent = `${q}T`;
      b.addEventListener('click', () => { vatQuarter = q; loadVat(yearSelect.value); });
      qRow.appendChild(b);
    }

    if (!data.rates.length && !data.excluded.count) {
      vatCard.innerHTML += '<p style="color:var(--neutral-400);font-size:13px">Sin facturas emitidas en este trimestre.</p>';
      return;
    }

    const tableWrap = document.createElement('div');
    tableWrap.className = 'table-scroll';
    const table = document.createElement('table');
    table.className = 'table';
    table.style.minWidth = '420px';
    table.innerHTML = `
      <thead><tr>
        <th>Tipo IVA</th>
        <th style="text-align:right">Base imponible</th>
        <th style="text-align:right">Cuota</th>
      </tr></thead>
    `;
    const tbody = document.createElement('tbody');
    data.rates.forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600">${r.rate}%</td>
        <td style="text-align:right">${fmtMoneyEs(r.base, data.currency)}</td>
        <td style="text-align:right;font-weight:600">${fmtMoneyEs(r.cuota, data.currency)}</td>
      `;
      tbody.appendChild(tr);
    });
    const trTotal = document.createElement('tr');
    trTotal.style.cssText = 'background:var(--neutral-50);font-weight:700;border-top:2px solid var(--neutral-200)';
    trTotal.innerHTML = `
      <td>TOTAL ${vatQuarter}T ${data.year}</td>
      <td style="text-align:right">${fmtMoneyEs(data.totals.base, data.currency)}</td>
      <td style="text-align:right;color:var(--green-700)">${fmtMoneyEs(data.totals.cuota, data.currency)}</td>
    `;
    tbody.appendChild(trTotal);
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    vatCard.appendChild(tableWrap);

    if (data.excluded.count > 0) {
      const note = document.createElement('p');
      note.style.cssText = 'margin:10px 0 0;font-size:12px;color:var(--neutral-500)';
      note.textContent = `⚠ ${data.excluded.count} ${data.excluded.count === 1 ? 'factura sin desglose de líneas' : 'facturas sin desglose de líneas'} (total ${fmtMoneyEs(data.excluded.total, data.currency)}) ${data.excluded.count === 1 ? 'no incluida' : 'no incluidas'} en el cuadro — revísalas a mano.`;
      vatCard.appendChild(note);
    }
  }

  yearSelect.addEventListener('change', () => { load(yearSelect.value); loadVat(yearSelect.value); loadX2(x2Card, yearSelect.value); });
  load(currentYear);
  loadVat(currentYear);
  loadX2(x2Card, currentYear); // A16.1
}

// ── A16.1 (X2): cómo te pagan + € por recordatorios + pendiente por antigüedad ──
async function loadX2(card, year) {
  let d;
  try { d = await apiRequest(`/admin/reports/x2?year=${year}`); } catch { return; }
  const hasAny = (d.byMethod && d.byMethod.length) || d.pendingTotal > 0 || d.reminderEur > 0;
  if (!hasAny) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  // SCRUM-398 · las etiquetas salen de `paidViaEtiquetas.js`, que es la ÚNICA fuente y está atada
  // por guard al conjunto cerrado de `paidVia.ts`. El mapa que había aquí declaraba `bizum`,
  // `bank` y `mercadopago` —tres valores que NADIE escribe— y le faltaban los que sí llegan
  // (`bizum_auto`, `card:stripe`, `mp`). Cuatro vocabularios distintos para el mismo dato.
  const maxEur = Math.max(1, ...(d.byMethod || []).map((m) => m.eur));
  const methodRows = (d.byMethod || []).map((m) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <span style="width:150px;flex:none;font-size:13px;color:var(--body)">${etiquetaMetodoCobro(m.method)}</span>
      <div style="flex:1;background:var(--neutral-100);border-radius:6px;height:10px;overflow:hidden">
        <div style="width:${Math.round((m.eur / maxEur) * 100)}%;height:100%;background:var(--green-600);border-radius:6px"></div>
      </div>
      <span style="width:130px;flex:none;text-align:right;font-size:13px;font-variant-numeric:tabular-nums">${fmtMoneyEs(m.eur)} <span style="color:var(--muted)">(${m.count})</span></span>
    </div>`).join('');

  const agingRows = (d.aging || []).map((b) => `
    <div class="kpi-card" style="text-align:center">
      <div class="kpi-label">${b.label}</div>
      <div class="kpi-value" style="font-size:17px;${b.bucket === '60+' && b.count ? 'color:var(--red-600)' : ''}">${fmtMoneyEs(b.eur)}</div>
      <div style="font-size:11.5px;color:var(--muted)">${b.count} ${b.count === 1 ? 'cobro' : 'cobros'}</div>
    </div>`).join('');

  card.innerHTML = `
    <h3 style="margin:0 0 4px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em">Cómo te pagan · ${year}</h3>
    <p style="margin:0 0 14px;font-size:12.5px;color:var(--muted)">Cobros completados por método de pago.</p>
    ${methodRows || '<p style="font-size:13px;color:var(--muted)">Aún no hay cobros este año.</p>'}
    ${d.reminderEur > 0 ? `
      <div style="margin-top:12px;background:var(--brand-tint);border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;font-size:13px;color:var(--ink)">
        ⏰ <strong>${fmtMoneyEs(d.reminderEur)}</strong> cobrados en las 72 h siguientes a un recordatorio automático — dinero que el sistema fue a buscar solo.
      </div>` : ''}
    ${d.pendingTotal > 0 ? `
      <h3 style="margin:20px 0 4px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em">Pendiente de cobro por antigüedad</h3>
      <p style="margin:0 0 12px;font-size:12.5px;color:var(--muted)">Foto de hoy: ${fmtMoneyEs(d.pendingTotal)} aún sin cobrar.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">${agingRows}</div>` : ''}
  `;
}

// ── Analytics: funnel de conversión + rentabilidad por servicio ──────────
async function loadAnalytics(funnelCard, servicesCard) {
  funnelCard.innerHTML = '<p style="color:var(--neutral-400);font-size:13px;padding:8px 0">Cargando funnel…</p>';
  servicesCard.innerHTML = '';

  let funnel, services;
  try {
    [funnel, services] = await Promise.all([
      apiRequest('/admin/metrics/funnel'),
      apiRequest('/admin/metrics/services'),
    ]);
  } catch {
    funnelCard.innerHTML = '<p style="color:var(--red-600);font-size:13px">Error al cargar analytics.</p>';
    return;
  }

  renderFunnel(funnelCard, funnel);
  renderServices(servicesCard, services);
}

// ── J8: métricas de coste y entrega de WhatsApp (mes en curso) ──────────────
async function loadWhatsAppMetrics(card) {
  let data;
  try {
    data = await apiRequest('/admin/metrics/whatsapp');
  } catch (err) {
    return; // error → no se pinta
  }
  const m = data && data.month;
  const ch = (data && data.channel) || { templateToday: 0, windowToday: 0, windowMonth: 0, savedEurMonth: 0 };
  // A5.4: la tarjeta también aparece si TODO viajó gratis por ventana este mes
  if (!m || (m.total === 0 && ch.windowMonth === 0)) return;
  card.style.display = '';

  const fmtEur = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const alertHtml = data.alert && data.alert.active
    ? `<div class="alert warning" style="display:block;margin:0 0 14px">⚠ Tasa de entrega de los últimos 7 días: <strong>${data.alert.deliveryRate7d}%</strong> (por debajo del 90%). Revisa el runbook R1/R2.</div>`
    : '';

  // A5.4: plantilla (pagada) vs ventana (gratis) — el ahorro se enseña
  const savedHtml = ch.windowMonth > 0
    ? ` · <strong>${ch.windowMonth}</strong> por ventana (0 €) — ahorro ~<strong>${fmtEur(ch.savedEurMonth)}</strong>`
    : '';

  const kpis = [
    { label: 'Enviados', value: m.sent },
    { label: 'Entregados', value: m.delivered },
    { label: 'Leídos', value: m.read },
    { label: 'Fallidos', value: m.failed },
    { label: 'Por ventana (0 €)', value: ch.windowMonth },
  ];

  card.innerHTML = `
    <h3 style="margin:0 0 4px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em">WhatsApp · este mes</h3>
    <p style="margin:0 0 16px;font-size:12px;color:var(--neutral-400)">Coste estimado: <strong>${fmtEur(m.costEur)}</strong> · ${m.total} plantilla${m.total !== 1 ? 's' : ''}${savedHtml}<br/>Hoy: ${ch.templateToday} plantilla${ch.templateToday !== 1 ? 's' : ''} · ${ch.windowToday} por ventana</p>
    ${alertHtml}
    <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:16px">
      ${kpis.map((k) => `<div><div style="font-size:22px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums">${k.value}</div><div style="font-size:12px;color:var(--muted)">${k.label}</div></div>`).join('')}
    </div>
  `;

  if (data.byTemplate && data.byTemplate.length) {
    const rows = data.byTemplate.map((t) => `
      <tr style="border-top:1px solid var(--border)">
        <td style="padding:6px 8px 6px 0;color:var(--ink)">${t.templateName}</td>
        <td style="padding:6px 8px;text-align:right">${t.enviados}</td>
        <td style="padding:6px 8px;text-align:right">${t.entregados}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700">${t.deliveryRate === null ? '—' : t.deliveryRate + '%'}</td>
      </tr>`).join('');
    const tbl = document.createElement('div');
    tbl.style.cssText = 'overflow-x:auto';
    tbl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead><tr style="text-align:left;color:var(--neutral-500)">
        <th style="padding:4px 8px 4px 0">Plantilla</th><th style="padding:4px 8px;text-align:right">Enviados</th>
        <th style="padding:4px 8px;text-align:right">Entregados</th><th style="padding:4px 8px;text-align:right">Tasa</th>
      </tr></thead><tbody>${rows}</tbody></table>`;
    card.appendChild(tbl);
  }
}

// ── V0-3: funnel de PLATAFORMA (solo owner; 403 para el resto → no se pinta) ──
async function loadPlatformFunnel(card) {
  let data;
  try {
    data = await apiRequest('/admin/metrics/platform-funnel');
  } catch (err) {
    return; // no-owner (403) o error: la sección simplemente no aparece
  }
  card.style.display = '';

  const s = data.steps || {};
  const stages = [
    { label: 'Registrados',   value: s.registered || 0 },
    { label: 'Con 1ª quote',  value: s.firstQuote || 0 },
    { label: 'Han enviado',   value: s.sent || 0 },
    { label: 'Con aceptada',  value: s.accepted || 0 },
    { label: 'Han cobrado',   value: s.collected || 0 },
  ];
  const maxVal = Math.max(...stages.map((x) => x.value), 1);

  card.innerHTML = `
    <h3 style="margin:0 0 4px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em">Funnel de plataforma · merchants (solo owner)</h3>
    <p style="margin:0 0 16px;font-size:12px;color:var(--neutral-400)">registro → 1ª quote → enviada → aceptada → cobrada</p>
  `;

  const bars = document.createElement('div');
  bars.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-bottom:16px';
  stages.forEach((st) => {
    const pct = Math.round((st.value / maxVal) * 100);
    const row = document.createElement('div');
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
        <span style="color:var(--neutral-600);font-weight:600">${st.label}</span>
        <span style="color:var(--neutral-700)"><strong>${st.value}</strong></span>
      </div>
      <div style="background:var(--neutral-100);border-radius:6px;height:14px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:var(--green-600);border-radius:6px"></div>
      </div>
    `;
    bars.appendChild(row);
  });
  card.appendChild(bars);

  // Desgloses de atribución: cómo se cobra y cómo se crean las quotes
  const fmtPairs = (obj, money) => Object.entries(obj || {})
    .map(([k, v]) => `${k}: <strong>${money ? (v.count + ' · ' + v.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €') : v}</strong>`)
    .join(' · ') || '—';
  const meta = document.createElement('p');
  meta.style.cssText = 'margin:0 0 14px;font-size:12px;color:var(--muted)';
  meta.innerHTML = `paid_via → ${fmtPairs(data.paidVia, true)}<br/>quote_created_via → ${fmtPairs(data.quoteCreatedVia, false)}`;
  card.appendChild(meta);

  // A9.2: POR FUENTE — registros → activados (1er presupuesto) → con 1er cobro.
  // El cuadro de mando de la campaña de demos: qué canal trae altas que cobran.
  if (Array.isArray(data.bySource) && data.bySource.length) {
    const src = document.createElement('div');
    src.style.cssText = 'overflow-x:auto;margin-bottom:16px';
    src.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Por fuente de adquisición</div>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="text-align:left;color:var(--neutral-500)">
          <th style="padding:4px 8px 4px 0">Fuente</th>
          <th style="padding:4px 8px;text-align:right">Registros</th>
          <th style="padding:4px 8px;text-align:right">Activados (1ª quote)</th>
          <th style="padding:4px 8px;text-align:right">Con 1er cobro</th>
        </tr></thead>
        <tbody>${data.bySource.map((r) => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:6px 8px 6px 0;color:var(--ink);font-weight:600">${r.source}</td>
            <td style="padding:6px 8px;text-align:right">${r.registered}</td>
            <td style="padding:6px 8px;text-align:right">${r.activated}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:700;color:var(--green-700)">${r.collected}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    card.appendChild(src);
  }

  // Tabla compacta por merchant (los 15 más recientes)
  const rows = (data.merchants || []).slice(0, 15);
  const table = document.createElement('div');
  table.style.cssText = 'overflow-x:auto';
  table.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead><tr style="text-align:left;color:var(--neutral-500)">
        <th style="padding:4px 8px 4px 0">Merchant</th><th style="padding:4px 8px">Fuente</th>
        <th style="padding:4px 8px">Plan</th><th style="padding:4px 8px;text-align:right">Quotes</th>
        <th style="padding:4px 8px;text-align:right">Enviadas</th><th style="padding:4px 8px;text-align:right">Aceptadas</th>
        <th style="padding:4px 8px;text-align:right">Cobrado</th>
      </tr></thead>
      <tbody>${rows.map((m) => `
        <tr style="border-top:1px solid var(--border)">
          <td style="padding:6px 8px 6px 0;color:var(--ink);font-weight:600">${m.name}</td>
          <td style="padding:6px 8px;color:var(--muted)">${m.acquisitionSource || 'orgánico'}</td>
          <td style="padding:6px 8px;color:var(--muted)">${m.plan}</td>
          <td style="padding:6px 8px;text-align:right">${m.quotes}</td>
          <td style="padding:6px 8px;text-align:right">${m.sent}</td>
          <td style="padding:6px 8px;text-align:right">${m.accepted}</td>
          <td style="padding:6px 8px;text-align:right" class="amount">${m.collectedAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  card.appendChild(table);
}

function renderFunnel(card, data) {
  const c = data.current || {};
  const p = data.previous || {};
  const L = window.appLocale || {};
  const quoteWord = L.quotePlural || 'Cotizaciones';

  // Embudo: Enviadas → Aceptadas → Facturadas → Cobradas
  const stages = [
    { label: 'Enviadas',   value: c.sent || 0,      prev: p.sent || 0,      color: '#22c55e' },
    { label: 'Aceptadas',  value: c.accepted || 0,  prev: p.accepted || 0,  color: '#16a34a' },
    { label: 'Facturadas', value: c.invoiced || 0,  prev: p.invoiced || 0,  color: '#2563eb' },
    { label: 'Cobradas',   value: c.collected || 0, prev: p.collected || 0, color: '#1d4ed8' },
  ];
  const maxVal = Math.max(...stages.map(s => s.value), 1);

  card.innerHTML = `
    <h3 style="margin:0 0 4px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em">Funnel de conversión · ${quoteWord}</h3>
    <p style="margin:0 0 16px;font-size:12px;color:var(--neutral-400)">Mes actual vs mes anterior</p>
  `;

  const bars = document.createElement('div');
  bars.style.cssText = 'display:flex;flex-direction:column;gap:10px';
  stages.forEach(s => {
    const pct = Math.round((s.value / maxVal) * 100);
    const diff = s.value - s.prev;
    const diffTxt = diff === 0 ? '' : (diff > 0 ? `▲ ${diff}` : `▼ ${Math.abs(diff)}`);
    const diffColor = diff >= 0 ? 'var(--green-600)' : 'var(--red-600)';
    const row = document.createElement('div');
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
        <span style="color:var(--neutral-600);font-weight:600">${s.label}</span>
        <span style="color:var(--neutral-700)"><strong>${s.value}</strong> <span style="color:${diffColor};font-size:11px">${diffTxt}</span></span>
      </div>
      <div style="background:var(--neutral-100);border-radius:6px;height:14px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${s.color};border-radius:6px;transition:width .4s"></div>
      </div>
    `;
    bars.appendChild(row);
  });
  card.appendChild(bars);

  // KPIs: tasa de aceptación + tiempo de respuesta + pendientes
  const kpis = document.createElement('div');
  kpis.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-top:18px';
  const accRate = data.acceptanceRate != null ? data.acceptanceRate + '%' : '—';
  const respTime = c.avgResponseHours != null ? c.avgResponseHours + ' h' : '—';
  kpis.innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Tasa de aceptación</div><div class="kpi-value" style="font-size:20px;color:var(--green-600)">${accRate}</div></div>
    <div class="kpi-card"><div class="kpi-label">Tiempo medio de respuesta</div><div class="kpi-value" style="font-size:20px">${respTime}</div></div>
    <div class="kpi-card"><div class="kpi-label">Sin responder</div><div class="kpi-value" style="font-size:20px;color:var(--neutral-500)">${c.awaiting || 0}</div></div>
  `;
  card.appendChild(kpis);

  // Motivos de rechazo
  if (Array.isArray(data.rejectionReasons) && data.rejectionReasons.length) {
    const rej = document.createElement('div');
    rej.style.cssText = 'margin-top:18px';
    rej.innerHTML = `<h4 style="margin:0 0 8px;font-size:12px;font-weight:700;color:var(--neutral-500);text-transform:uppercase">Motivos de rechazo (este mes)</h4>`;
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:5px';
    data.rejectionReasons.forEach(r => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;justify-content:space-between;font-size:13px;color:var(--neutral-600)';
      item.innerHTML = `<span>${escReport(r.reason)}</span><span style="font-weight:600">${r.count}</span>`;
      list.appendChild(item);
    });
    rej.appendChild(list);
    card.appendChild(rej);
  }
}

function renderServices(card, data) {
  const services = (data && data.services) || [];
  card.innerHTML = `
    <h3 style="margin:0 0 4px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em">Rentabilidad por servicio</h3>
    <p style="margin:0 0 14px;font-size:12px;color:var(--neutral-400)">Qué servicios cotizas más y cuáles cierras mejor.</p>
  `;

  if (!services.length) {
    card.innerHTML += '<p style="color:var(--neutral-400);font-size:13px">Aún no hay suficientes datos. Envía cotizaciones para ver estadísticas por servicio.</p>';
    return;
  }

  const fmt = (n) => Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-scroll';
  const table = document.createElement('table');
  table.className = 'table';
  table.style.minWidth = '520px';
  table.innerHTML = `
    <thead><tr>
      <th>Servicio</th>
      <th style="text-align:right">Veces cotizado</th>
      <th style="text-align:right">Aceptación</th>
      <th style="text-align:right">Precio medio</th>
      <th style="text-align:right">Ingresos</th>
    </tr></thead>
  `;
  const tbody = document.createElement('tbody');
  services.slice(0, 20).forEach(s => {
    const accColor = s.acceptanceRate >= 50 ? 'var(--green-600)' : s.acceptanceRate >= 25 ? 'var(--neutral-600)' : 'var(--red-600)';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600">${escReport(s.name)}</td>
      <td style="text-align:right">${s.quoted}</td>
      <td style="text-align:right;color:${accColor};font-weight:600">${s.acceptanceRate}%</td>
      <td style="text-align:right;color:var(--neutral-500)">${fmtMoneyEs(s.avgPrice, (window.appLocale && window.appLocale.currency) || 'EUR')}</td>
      <td style="text-align:right;color:var(--green-700);font-weight:600">${fmtMoneyEs(s.revenue, (window.appLocale && window.appLocale.currency) || 'EUR')}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  card.appendChild(tableWrap);
}

function escReport(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Gráfico SVG de barras agrupadas ──────────────────────────────────────
function buildBarChart(months, currency) {
  const W = 860, H = 220;
  const padL = 56, padR = 10, padT = 12, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxVal = Math.max(...months.flatMap(m => [m.revenue, m.expenses, Math.abs(m.profit)]), 1);
  const scaleY = (v) => chartH - (Math.abs(v) / maxVal) * chartH;
  const barW = Math.floor(chartW / months.length / 3) - 2;
  const groupW = chartW / months.length;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', H);
  svg.style.overflow = 'visible';

  const defs = document.createElementNS(svgNS, 'defs');
  svg.appendChild(defs);

  // Línea base Y=0
  const baseline = chartH + padT;
  const baseLine = document.createElementNS(svgNS, 'line');
  baseLine.setAttribute('x1', String(padL)); baseLine.setAttribute('x2', String(W - padR));
  baseLine.setAttribute('y1', String(baseline)); baseLine.setAttribute('y2', String(baseline));
  baseLine.setAttribute('stroke', '#e7e9e3'); baseLine.setAttribute('stroke-width', '1');
  svg.appendChild(baseLine);

  // Líneas horizontales de referencia
  [0.25, 0.5, 0.75, 1].forEach(f => {
    const y = padT + chartH - f * chartH;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', String(padL)); line.setAttribute('x2', String(W - padR));
    line.setAttribute('y1', String(y)); line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#f1f2ee'); line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', String(padL - 6));
    label.setAttribute('y', String(y + 4));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('font-size', '10');
    label.setAttribute('fill', '#949b92');
    label.textContent = Math.round(maxVal * f).toLocaleString('es-ES');
    svg.appendChild(label);
  });

  // Barras por mes
  months.forEach((m, i) => {
    const cx = padL + i * groupW + groupW / 2;

    const bars = [
      { value: m.revenue,  color: '#22c55e', offset: -barW - 2 },
      { value: m.expenses, color: '#ef4444', offset: 0 },
      { value: m.profit,   color: '#2563eb', offset: barW + 2 },
    ];

    bars.forEach(({ value, color, offset }) => {
      if (value === 0) return;
      const bh = Math.max(2, (Math.abs(value) / maxVal) * chartH);
      const bx = cx + offset - barW / 2;
      const by = value >= 0 ? baseline - bh : baseline;

      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', String(bx));
      rect.setAttribute('y', String(by));
      rect.setAttribute('width', String(barW));
      rect.setAttribute('height', String(bh));
      rect.setAttribute('fill', color);
      rect.setAttribute('rx', '3');
      rect.setAttribute('opacity', '0.85');

      // Tooltip
      const title = document.createElementNS(svgNS, 'title');
      title.textContent = `${m.label}: ${Number(value).toLocaleString('es-ES', {minimumFractionDigits:2})} ${currency}`;
      rect.appendChild(title);

      svg.appendChild(rect);
    });

    // Etiqueta del mes
    const txt = document.createElementNS(svgNS, 'text');
    txt.setAttribute('x', String(cx));
    txt.setAttribute('y', String(baseline + 16));
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', '10');
    txt.setAttribute('fill', '#6b756f');
    txt.textContent = m.label;
    svg.appendChild(txt);
  });

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'overflow-x:auto;-webkit-overflow-scrolling:touch';
  wrapper.appendChild(svg);
  return wrapper;
}


// ── SCRUM-228 · desglose por empleado, con el invariante a la vista ─────────────────────────
//
// Cada fila es un cubo de una PARTICIÓN que hace el backend (`desgloseEmpleado.ts`): toda
// factura y todo gasto cae en exactamente uno. Aquí no se recalcula nada ni se filtra nada —
// sumar-seleccionados es aritmética sobre números ya repartidos.
//
// La fila «Sin asignar» recoge lo que no se puede atribuir a nadie: facturas nacidas de un
// albarán o de una recapitulativa, que no tienen presupuesto y por tanto no tienen empleado.
// Es fea a propósito. La alternativa —descartarlas, que es lo que hace hoy la pantalla de
// Equipo (SCRUM-236)— deja unas cifras que no suman el total y nadie avisa.
function buildDesgloseEmpleado(filas, year, fmt, currency) {
  const box = document.createElement('div');
  box.style.cssText = 'margin-top:26px;padding-top:22px;border-top:1px solid var(--neutral-200)';

  // Microcopy OFICIAL: aprobado por el fundador el 29-jul-2026 (regla 30).
  box.innerHTML = `
    <h3 style="margin:0 0 4px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em">Desglose por empleado</h3>
    <p style="margin:0 0 14px;font-size:12.5px;color:var(--neutral-500)">Toca para quitar o añadir a la suma.</p>
  `;

  const sel = new Set(filas.map((f) => f.key)); // todo seleccionado: el pie es el total del año

  const chips = document.createElement('div');
  chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px';
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Empleados incluidos en la suma');

  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-scroll';
  const table = document.createElement('table');
  table.className = 'table';
  table.style.minWidth = '460px';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Empleado</th>
        <th style="text-align:right">Ingresos</th>
        <th style="text-align:right">Gastos</th>
        <th style="text-align:right">Beneficio</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  const pintar = () => {
    tbody.innerHTML = '';
    const dentro = filas.filter((f) => sel.has(f.key));

    dentro.forEach((f) => {
      const tr = document.createElement('tr');
      const nombre = f.esSinAsignar
        ? `${f.label} <span class="badge badge-slate" style="margin-left:6px">sin presupuesto</span>`
        : f.label + (f.esPropietario ? ' <span style="color:var(--neutral-400);font-weight:400">· tú</span>' : '');
      tr.innerHTML = `
        <td style="font-weight:600">${nombre}</td>
        <td style="text-align:right;color:var(--green-700)">${f.revenue !== 0 ? fmt(f.revenue) : '<span style="color:var(--neutral-300)">—</span>'}</td>
        <td style="text-align:right;color:var(--red-600)">${f.expenses !== 0 ? fmt(f.expenses) : '<span style="color:var(--neutral-300)">—</span>'}</td>
        <td style="text-align:right;font-weight:600;color:${f.profit >= 0 ? 'var(--green-700)' : 'var(--red-600)'}">${fmt(f.profit)}</td>
      `;
      tbody.appendChild(tr);
    });

    if (dentro.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="text-align:center;color:var(--neutral-400);padding:22px 0;font-size:13px">Sin nadie seleccionado. Toca un nombre para volver a sumarlo.</td>';
      tbody.appendChild(tr);
      return;
    }

    const suma = (c) => dentro.reduce((a, f) => a + Math.round(Number(f[c]) * 100), 0) / 100;
    const todos = dentro.length === filas.length;
    const pie = document.createElement('tr');
    pie.style.cssText = 'background:var(--neutral-50);font-weight:700;border-top:2px solid var(--neutral-200)';
    // Con todo dentro esto ES el total del año y cuadra con el KPI. Con una selección parcial
    // NO se llama «total»: el nombre cambia y dice cuántos hay dentro.
    pie.innerHTML = `
      <td>${todos ? 'TOTAL ' + year : `Seleccionados (${dentro.length} de ${filas.length})`}</td>
      <td style="text-align:right;color:var(--green-700)">${fmt(suma('revenue'))}</td>
      <td style="text-align:right;color:var(--red-600)">${fmt(suma('expenses'))}</td>
      <td style="text-align:right;color:${suma('profit') >= 0 ? 'var(--green-700)' : 'var(--red-600)'}">${fmt(suma('profit'))}</td>
    `;
    tbody.appendChild(pie);
  };

  filas.forEach((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    // SCRUM-384 · el `style="min-height:44px"` que había aquí SE RETIRÓ, y no solo por redundante.
    //
    // La base ya da 44 px en móvil a `.btn-secondary`/`.btn-primary` sueltas desde SCRUM-352
    // (`.btn-primary:not(.btn-sm)`), así que el objetivo táctil de AB6 se cumple sin esto. Pero
    // al ser INLINE ganaba siempre: a 1280 px forzaba 44 donde la casa da 36, y este botón de
    // filtro era 8 px más alto que sus hermanos en escritorio sin que nadie lo hubiera decidido.
    //
    // Clases del inventario: seleccionado = primario.
    b.textContent = f.label;
    const sincronizar = () => {
      const on = sel.has(f.key);
      b.className = on ? 'btn-primary' : 'btn-secondary';
      b.setAttribute('aria-pressed', String(on));
    };
    b.addEventListener('click', () => {
      if (sel.has(f.key)) sel.delete(f.key); else sel.add(f.key);
      sincronizar();
      pintar();
    });
    sincronizar();
    chips.appendChild(b);
  });

  box.appendChild(chips);
  box.appendChild(tableWrap);
  pintar();
  return box;
}
