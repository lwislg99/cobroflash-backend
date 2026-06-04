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
    <h2 style="margin:0 0 4px;font-size:17px;font-weight:700;color:var(--slate-900)">Informe de rentabilidad</h2>
    <p style="margin:0;font-size:13px;color:var(--slate-400)">Ingresos, gastos y beneficio neto por mes.</p>
  `;
  header.appendChild(titleBlock);

  // Selector de año
  const yearRow = document.createElement('div');
  yearRow.style.cssText = 'display:flex;align-items:center;gap:8px';
  const yearSelect = document.createElement('select');
  yearSelect.style.cssText = 'padding:6px 10px;border:1.5px solid var(--slate-200);border-radius:8px;font-size:13px;background:#fff;cursor:pointer';
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
  exportRow.appendChild(btnInv);
  exportRow.appendChild(btnExp);
  exportRow.appendChild(btnQuot);

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

  // ── Analytics: funnel + rentabilidad por servicio ────────────────────────
  const funnelCard = document.createElement('div');
  funnelCard.className = 'customers-card';
  wrap.appendChild(funnelCard);

  const servicesCard = document.createElement('div');
  servicesCard.className = 'customers-card';
  wrap.appendChild(servicesCard);

  loadAnalytics(funnelCard, servicesCard);

  async function load(year) {
    chartCard.innerHTML = '<p style="color:var(--slate-400);font-size:13px;padding:8px 0">Cargando…</p>';
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
    kpiWrap.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px';
    chartCard.innerHTML = '';
    chartCard.appendChild(kpiWrap);

    const kpis = [
      { label: 'Ingresos totales', value: totals.revenue,  prev: prevYear.revenue,  color: 'var(--green-600)' },
      { label: 'Gastos totales',   value: totals.expenses, prev: prevYear.expenses, color: 'var(--red-600)' },
      { label: 'Beneficio neto',   value: totals.profit,   prev: prevYear.profit,   color: totals.profit >= 0 ? 'var(--green-600)' : 'var(--red-600)' },
    ];

    kpis.forEach(({ label, value, prev, color }) => {
      const pct = prev !== 0 ? Math.round((value - prev) / Math.abs(prev) * 100) : null;
      const sign = pct === null ? '' : pct >= 0 ? '▲' : '▼';
      const pctColor = pct === null ? 'var(--slate-400)' : pct >= 0 ? 'var(--green-600)' : 'var(--red-600)';
      const kpi = document.createElement('div');
      kpi.className = 'kpi-card';
      kpi.innerHTML = `
        <div class="kpi-label">${label}</div>
        <div class="kpi-value" style="color:${color};font-size:22px">${fmt(value)} <span style="font-size:12px;font-weight:400;color:var(--slate-400)">${currency}</span></div>
        ${pct !== null ? `<div class="kpi-sub" style="color:${pctColor}">${sign} ${Math.abs(pct)}% vs ${year - 1}</div>` : ''}
      `;
      kpiWrap.appendChild(kpi);
    });

    // ── Gráfico SVG de barras ─────────────────────────────────────────────
    const chartTitle = document.createElement('h3');
    chartTitle.style.cssText = 'margin:0 0 12px;font-size:13px;font-weight:700;color:var(--slate-600);text-transform:uppercase;letter-spacing:.04em';
    chartTitle.textContent = `Desglose mensual ${year}`;
    chartCard.appendChild(chartTitle);

    chartCard.appendChild(buildBarChart(months, currency));

    // Leyenda
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;gap:16px;margin-top:10px;font-size:12px;color:var(--slate-500)';
    legend.innerHTML = `
      <span><span style="display:inline-block;width:10px;height:10px;background:#22c55e;border-radius:2px;margin-right:4px"></span>Ingresos</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:#f87171;border-radius:2px;margin-right:4px"></span>Gastos</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:#818cf8;border-radius:2px;margin-right:4px"></span>Beneficio</span>
    `;
    chartCard.appendChild(legend);

    // ── Tabla resumen mensual ─────────────────────────────────────────────
    summaryCard.innerHTML = `
      <h3 style="margin:0 0 14px;font-size:13px;font-weight:700;color:var(--slate-600);text-transform:uppercase;letter-spacing:.04em">Resumen mensual</h3>
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
        <td style="text-align:right;color:var(--green-700)">${m.revenue > 0 ? fmt(m.revenue) : '<span style="color:var(--slate-300)">—</span>'}</td>
        <td style="text-align:right;color:var(--red-600)">${m.expenses > 0 ? fmt(m.expenses) : '<span style="color:var(--slate-300)">—</span>'}</td>
        <td style="text-align:right;font-weight:600;color:${profitColor}">${fmt(m.profit)}</td>
        <td style="text-align:right;color:var(--slate-500)">${margin !== null ? margin + '%' : '—'}</td>
      `;
      tbody.appendChild(tr);
    });

    // Fila de totales
    const totalMargin = totals.revenue > 0 ? Math.round(totals.profit / totals.revenue * 100) : null;
    const trTotal = document.createElement('tr');
    trTotal.style.cssText = 'background:var(--slate-50);font-weight:700;border-top:2px solid var(--slate-200)';
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

    // Actualizar links de exportar con el año
    btnInv.href  = `/admin/exports/invoices.csv?from=${year}-01-01&to=${year}-12-31`;
    btnExp.href  = `/admin/exports/expenses.csv?from=${year}-01-01&to=${year}-12-31`;
    btnQuot.href = `/admin/exports/quotes.csv?from=${year}-01-01&to=${year}-12-31`;
  }

  yearSelect.addEventListener('change', () => load(yearSelect.value));
  load(currentYear);
}

// ── Analytics: funnel de conversión + rentabilidad por servicio ──────────
async function loadAnalytics(funnelCard, servicesCard) {
  funnelCard.innerHTML = '<p style="color:var(--slate-400);font-size:13px;padding:8px 0">Cargando funnel…</p>';
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

function renderFunnel(card, data) {
  const c = data.current || {};
  const p = data.previous || {};
  const L = window.appLocale || {};
  const quoteWord = L.quotePlural || 'Cotizaciones';

  // Embudo: Enviadas → Aceptadas → Facturadas → Cobradas
  const stages = [
    { label: 'Enviadas',   value: c.sent || 0,      prev: p.sent || 0,      color: '#22c55e' },
    { label: 'Aceptadas',  value: c.accepted || 0,  prev: p.accepted || 0,  color: '#10b981' },
    { label: 'Facturadas', value: c.invoiced || 0,  prev: p.invoiced || 0,  color: '#0ea5e9' },
    { label: 'Cobradas',   value: c.collected || 0, prev: p.collected || 0, color: '#6366f1' },
  ];
  const maxVal = Math.max(...stages.map(s => s.value), 1);

  card.innerHTML = `
    <h3 style="margin:0 0 4px;font-size:13px;font-weight:700;color:var(--slate-600);text-transform:uppercase;letter-spacing:.04em">Funnel de conversión · ${quoteWord}</h3>
    <p style="margin:0 0 16px;font-size:12px;color:var(--slate-400)">Mes actual vs mes anterior</p>
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
        <span style="color:var(--slate-600);font-weight:600">${s.label}</span>
        <span style="color:var(--slate-700)"><strong>${s.value}</strong> <span style="color:${diffColor};font-size:11px">${diffTxt}</span></span>
      </div>
      <div style="background:var(--slate-100);border-radius:6px;height:14px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${s.color};border-radius:6px;transition:width .4s"></div>
      </div>
    `;
    bars.appendChild(row);
  });
  card.appendChild(bars);

  // KPIs: tasa de aceptación + tiempo de respuesta + pendientes
  const kpis = document.createElement('div');
  kpis.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px';
  const accRate = data.acceptanceRate != null ? data.acceptanceRate + '%' : '—';
  const respTime = c.avgResponseHours != null ? c.avgResponseHours + ' h' : '—';
  kpis.innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Tasa de aceptación</div><div class="kpi-value" style="font-size:20px;color:var(--green-600)">${accRate}</div></div>
    <div class="kpi-card"><div class="kpi-label">Tiempo medio de respuesta</div><div class="kpi-value" style="font-size:20px">${respTime}</div></div>
    <div class="kpi-card"><div class="kpi-label">Sin responder</div><div class="kpi-value" style="font-size:20px;color:var(--slate-500)">${c.awaiting || 0}</div></div>
  `;
  card.appendChild(kpis);

  // Motivos de rechazo
  if (Array.isArray(data.rejectionReasons) && data.rejectionReasons.length) {
    const rej = document.createElement('div');
    rej.style.cssText = 'margin-top:18px';
    rej.innerHTML = `<h4 style="margin:0 0 8px;font-size:12px;font-weight:700;color:var(--slate-500);text-transform:uppercase">Motivos de rechazo (este mes)</h4>`;
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:5px';
    data.rejectionReasons.forEach(r => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;justify-content:space-between;font-size:13px;color:var(--slate-600)';
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
    <h3 style="margin:0 0 4px;font-size:13px;font-weight:700;color:var(--slate-600);text-transform:uppercase;letter-spacing:.04em">Rentabilidad por servicio</h3>
    <p style="margin:0 0 14px;font-size:12px;color:var(--slate-400)">Qué servicios cotizas más y cuáles cierras mejor.</p>
  `;

  if (!services.length) {
    card.innerHTML += '<p style="color:var(--slate-400);font-size:13px">Aún no hay suficientes datos. Envía cotizaciones para ver estadísticas por servicio.</p>';
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
    const accColor = s.acceptanceRate >= 50 ? 'var(--green-600)' : s.acceptanceRate >= 25 ? 'var(--slate-600)' : 'var(--red-600)';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600">${escReport(s.name)}</td>
      <td style="text-align:right">${s.quoted}</td>
      <td style="text-align:right;color:${accColor};font-weight:600">${s.acceptanceRate}%</td>
      <td style="text-align:right;color:var(--slate-500)">${fmt(s.avgPrice)}</td>
      <td style="text-align:right;color:var(--green-700);font-weight:600">${fmt(s.revenue)}</td>
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
  baseLine.setAttribute('stroke', '#e2e8f0'); baseLine.setAttribute('stroke-width', '1');
  svg.appendChild(baseLine);

  // Líneas horizontales de referencia
  [0.25, 0.5, 0.75, 1].forEach(f => {
    const y = padT + chartH - f * chartH;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', String(padL)); line.setAttribute('x2', String(W - padR));
    line.setAttribute('y1', String(y)); line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#f1f5f9'); line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', String(padL - 6));
    label.setAttribute('y', String(y + 4));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('font-size', '10');
    label.setAttribute('fill', '#94a3b8');
    label.textContent = Math.round(maxVal * f).toLocaleString('es-ES');
    svg.appendChild(label);
  });

  // Barras por mes
  months.forEach((m, i) => {
    const cx = padL + i * groupW + groupW / 2;

    const bars = [
      { value: m.revenue,  color: '#22c55e', offset: -barW - 2 },
      { value: m.expenses, color: '#f87171', offset: 0 },
      { value: m.profit,   color: '#818cf8', offset: barW + 2 },
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
    txt.setAttribute('fill', '#64748b');
    txt.textContent = m.label;
    svg.appendChild(txt);
  });

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'overflow-x:auto;-webkit-overflow-scrolling:touch';
  wrapper.appendChild(svg);
  return wrapper;
}
