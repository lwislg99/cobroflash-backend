// public/dashboard/js/jobDetailView.js — SCRUM-12 (TRABAJO-3)
// Detalle del Trabajo: cabecera (totales + semáforo + barra) → timeline de documentos
// (lista cronológica, patrón customerDetailView) → bloque de cobros (tramos). Layout
// canónico .detail-page. Endpoint solo-lectura GET /admin/jobs/:id.
// ⚠️ Las ACCIONES DE COBRO se renderizan pero se CABLEAN en el paso 3 (STOP AA1.4).

// SCRUM-12: pill de cobro DUPLICADO a propósito (centralizar = SCRUM-30). Igual que jobsView.
const JOBDET_COBRO_PILL = { Pagado: 'status-pill-accepted', Parcial: 'status-pill-pending', Pendiente: 'status-pill-draft' };

// Estado de factura → status-pill (mismo mapeo que invoicesView.js:296-297).
function jobDetInvPill(st) {
  const s = String(st || '').toLowerCase();
  return s === 'paid' ? 'status-pill-accepted' : s === 'expired' ? 'status-pill-rejected' : 'status-pill-pending';
}
function jobDetInvEstado(st) {
  const s = String(st || '').toLowerCase();
  return s === 'paid' ? 'Pagada' : s === 'expired' ? 'Vencida' : 'Pendiente';
}
// Tipo de documento (copy ya usado en invoiceDetailView).
function jobDetDocLabel(inv) {
  if (inv.type === 'R1') return 'Rectificativa';
  if (inv.type === 'JUST' || String(inv.number || '').startsWith('J-')) return 'Justificante';
  return 'Factura';
}
// SCRUM-14: estado del albarán → copy canónico (brief; regla 30) + pill del inventario AB3.
const JOBDET_ALB_PILL = { borrador: 'status-pill-draft', emitido: 'status-pill-pending', firmado: 'status-pill-accepted' };
function jobDetAlbEstado(e) {
  return e === 'firmado' ? 'Firmado' : e === 'emitido' ? 'Emitido' : 'Borrador';
}
// Fila de <dl> inlineada (autocontenida; NO depende de addDefRow de quotesDetailView).
function jdAddRow(dl, term, value) {
  if (value === undefined || value === null || value === '' || value === '—') return;
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value;
  dl.appendChild(dt);
  dl.appendChild(dd);
}

async function renderJobDetailView(container, jobId) {
  container.innerHTML = '';
  const id = Number(jobId);

  const page = document.createElement('div');
  page.className = 'detail-page';
  container.appendChild(page);

  const head = document.createElement('div');
  head.className = 'detail-head';
  page.appendChild(head);
  const headLeft = document.createElement('div');
  headLeft.innerHTML = '<h2>Trabajo</h2><p class="detail-sub">Detalle del trabajo, cobros y documentos.</p>';
  head.appendChild(headLeft);
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-secondary btn-sm';
  backBtn.textContent = '← Volver a Trabajos';
  backBtn.addEventListener('click', () => { if (window.renderAppView) window.renderAppView('jobs'); });
  head.appendChild(backBtn);

  const statusBox = document.createElement('div');
  statusBox.className = 'alert';
  statusBox.style.cssText = 'margin:14px 22px 0;display:none';
  page.appendChild(statusBox);
  const setStatus = (type, msg) => {
    statusBox.textContent = msg || '';
    statusBox.className = 'alert' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
    statusBox.style.display = type || msg ? 'block' : 'none';
  };

  const body = document.createElement('div');
  page.appendChild(body);
  body.innerHTML = '<div class="detail-section"><p style="color:var(--muted);font-size:13px;margin:0">Cargando trabajo…</p></div>';

  let job;
  try {
    job = await apiRequest(`/admin/jobs/${id}`);
  } catch {
    body.innerHTML = '';
    setStatus('error', 'No pudimos cargar el trabajo.');
    return;
  }
  body.innerHTML = '';

  if (job.titulo) headLeft.querySelector('h2').textContent = job.titulo;

  // SCRUM-57: "Responsable" en la cabecera = autoría del operario (job.operario, ya en el
  // serializer tras SCRUM-22). Si el Trabajo es del propietario (operario null), el nombre del
  // NEGOCIO — que se trae de /admin/merchant (window.appUserName NO vale: es el usuario logueado).
  let responsableName = job.operario?.name || null;
  if (!responsableName) {
    try {
      const m = await apiRequest('/admin/merchant');
      responsableName = m?.name || m?.legalName || 'Propietario';
    } catch { responsableName = 'Propietario'; }
  }
  const responsableEl = document.createElement('div');
  responsableEl.style.cssText = 'margin-top:6px;font-size:13px;color:var(--muted)';
  responsableEl.innerHTML = `👷 Responsable: <strong style="color:var(--ink)">${esc(responsableName)}</strong>`;
  headLeft.appendChild(responsableEl);

  const cur = job.quote?.currency || 'EUR';
  const aceptado = Number(job.totalAceptado || 0);
  const cobrado = Number(job.totalCobrado || 0);
  const pendiente = Math.max(0, aceptado - cobrado);
  const pct = aceptado > 0 ? Math.min(100, Math.round((cobrado / aceptado) * 100)) : 0;
  const cobroCls = JOBDET_COBRO_PILL[job.estadoCobro] || 'status-pill-draft';

  // ── Resumen: estado de cobro + total + barra + cobrado/pendiente ──
  const sumSec = document.createElement('div');
  sumSec.className = 'detail-section';
  body.appendChild(sumSec);
  const sumRow = document.createElement('div');
  sumRow.className = 'detail-summary';
  sumSec.appendChild(sumRow);
  const stBlock = document.createElement('div');
  stBlock.innerHTML = `<div class="detail-total-label">Estado de cobro</div><span class="status-pill ${cobroCls}">${esc(job.estadoCobro)}</span>`;
  sumRow.appendChild(stBlock);
  const totBlock = document.createElement('div');
  totBlock.style.textAlign = 'right';
  totBlock.innerHTML = `<div class="detail-total-label">Total aceptado</div><div class="detail-total-amount">${fmtMoneyEs(aceptado, cur)}</div>`;
  sumRow.appendChild(totBlock);
  if (aceptado > 0) {
    const bar = document.createElement('div');
    bar.style.marginTop = '14px';
    bar.innerHTML = progressBar(pct, job.estadoCobro, { cobrado, aceptado, currency: cur });
    sumSec.appendChild(bar);
  }
  const twoTotals = document.createElement('div');
  twoTotals.style.cssText = 'display:flex;gap:28px;margin-top:14px;flex-wrap:wrap';
  twoTotals.innerHTML =
    `<div><div class="detail-total-label">Cobrado</div><div style="font-weight:700;color:var(--ink);font-size:16px;font-variant-numeric:tabular-nums">${fmtMoneyEs(cobrado, cur)}</div></div>` +
    `<div><div class="detail-total-label">Pendiente</div><div style="font-weight:700;color:var(--ink);font-size:16px;font-variant-numeric:tabular-nums">${fmtMoneyEs(pendiente, cur)}</div></div>`;
  sumSec.appendChild(twoTotals);

  // ── Datos: cliente, dirección, presupuesto origen (link por quoteNumber) ──
  const infoSec = document.createElement('div');
  infoSec.className = 'detail-section';
  infoSec.innerHTML = '<h3 class="detail-section-title">Datos</h3>';
  const dl = document.createElement('dl');
  dl.className = 'detail-dl';
  jdAddRow(dl, 'Cliente', job.customer?.name);
  jdAddRow(dl, 'Teléfono', job.customer?.phone);
  jdAddRow(dl, 'Dirección', job.direccion);
  if (!dl.children.length) dl.innerHTML = '<dd style="color:var(--muted)">Sin datos.</dd>';
  infoSec.appendChild(dl);
  if (job.quote) {
    const qBtn = document.createElement('button');
    qBtn.className = 'btn-secondary btn-sm';
    qBtn.style.marginTop = '10px';
    qBtn.textContent = `Ver presupuesto #${job.quote.number}`;
    qBtn.addEventListener('click', () => { if (window.renderAppView) window.renderAppView('quotes-detail', { quoteId: job.quote.id }); });
    infoSec.appendChild(qBtn);
  }
  body.appendChild(infoSec);

  // ── Tipo de trabajo (SCRUM-66 · TRABAJO-4): selector de 2 tarjetas, editable ──
  // Guarda Job.tipoOperacion vía PATCH. El motor de facturación que RESPETA la bandera es
  // SCRUM-17; aquí solo se persiste la elección del pro (siempre editable mientras esté abierto).
  const tipoSec = document.createElement('div');
  tipoSec.className = 'detail-section';
  tipoSec.innerHTML = '<h3 class="detail-section-title">Tipo de trabajo</h3>';
  let tipoActual = job.tipoOperacion === 'OPERACIONES_SUELTAS' ? 'OPERACIONES_SUELTAS' : 'TRABAJO_UNICO';
  const TIPO_CARDS = [
    { value: 'OPERACIONES_SUELTAS', icon: '🔧', title: 'Varios avisos o visitas sueltas', desc: 'Cada visita es un trabajo independiente para este cliente.' },
    { value: 'TRABAJO_UNICO', icon: '🏗️', title: 'Una obra o reforma de varios días', desc: 'Es un solo trabajo que se factura al concluir.' },
  ];
  const tipoRow = document.createElement('div');
  tipoRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
  const tipoCardEls = {};
  function paintTipoCards() {
    for (const c of TIPO_CARDS) {
      const sel = c.value === tipoActual;
      tipoCardEls[c.value].style.cssText =
        'flex:1 1 200px;text-align:left;padding:12px 14px;border-radius:12px;cursor:pointer;transition:border-color .15s,background .15s;' +
        (sel ? 'border:2px solid var(--brand,#16a34a);background:#f0fdf4;' : 'border:2px solid var(--border,#e7e9e5);background:#fff;');
    }
  }
  for (const c of TIPO_CARDS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.setAttribute('aria-pressed', String(c.value === tipoActual));
    card.innerHTML =
      `<div style="font-size:20px;line-height:1">${c.icon}</div>` +
      `<div style="font-weight:700;color:var(--ink);font-size:14px;margin-top:6px">${esc(c.title)}</div>` +
      `<div style="color:var(--muted);font-size:12px;margin-top:2px">${esc(c.desc)}</div>`;
    card.addEventListener('click', async () => {
      if (c.value === tipoActual) return;
      const prev = tipoActual;
      tipoActual = c.value;
      paintTipoCards();
      TIPO_CARDS.forEach((x) => tipoCardEls[x.value].setAttribute('aria-pressed', String(x.value === tipoActual)));
      try {
        await apiRequest(`/admin/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ tipoOperacion: c.value }) });
        showToast('✓ Tipo de trabajo actualizado.');
      } catch (e) {
        tipoActual = prev;
        paintTipoCards();
        TIPO_CARDS.forEach((x) => tipoCardEls[x.value].setAttribute('aria-pressed', String(x.value === tipoActual)));
        setStatus('error', 'No se pudo guardar el tipo de trabajo: ' + (e?.data?.message || e.message));
      }
    });
    tipoCardEls[c.value] = card;
    tipoRow.appendChild(card);
  }
  paintTipoCards();
  tipoSec.appendChild(tipoRow);
  const tipoHint = document.createElement('p');
  tipoHint.style.cssText = 'margin:8px 0 0;color:var(--muted);font-size:12px';
  tipoHint.textContent = 'Nos ayuda a preparar tus facturas correctamente. Si tienes dudas, confírmalo con tu asesor.';
  tipoSec.appendChild(tipoHint);
  body.appendChild(tipoSec);

  // ── Timeline de documentos (lista de actividad cronológica) ──
  const tlSec = document.createElement('div');
  tlSec.className = 'detail-section';
  tlSec.innerHTML = '<h3 class="detail-section-title">Documentos</h3>';
  const invoices = Array.isArray(job.invoices) ? job.invoices : [];
  const events = [];
  if (job.quote) {
    events.push({ icon: '📝', when: job.createdAt, title: `Presupuesto #${job.quote.number}`, detail: fmtMoneyEs(job.quote.total, cur) });
  }
  invoices.forEach((inv) => {
    const paid = String(inv.status).toLowerCase() === 'paid';
    events.push({
      icon: paid ? '💰' : '🧾',
      when: paid ? (inv.paidAt || inv.createdAt) : inv.createdAt,
      title: inv.stageLabel ? esc(inv.stageLabel) : `${jobDetDocLabel(inv)} ${esc(inv.number)}`, // SCRUM-27: etiqueta del tramo si es plan custom
      detail: `${jobDetInvEstado(inv.status)} · ${fmtMoneyEs(inv.total, inv.currency || cur)}`,
    });
  });
  // SCRUM-14: los albaranes también son documentos del Trabajo (evento 📋, sin importes)
  const albaranes = Array.isArray(job.albaranes) ? job.albaranes : [];
  albaranes.forEach((alb) => {
    events.push({
      icon: '📋',
      when: alb.estado === 'firmado' ? (alb.firmadoAt || alb.createdAt) : alb.createdAt,
      title: `Albarán ${esc(alb.numero)}`,
      detail: `${jobDetAlbEstado(alb.estado)} · v${alb.version}`,
    });
  });
  events.sort((a, b) => new Date(a.when || 0) - new Date(b.when || 0));
  if (!events.length) {
    tlSec.innerHTML += '<p style="margin:0;color:var(--muted);font-size:13px">Aún no hay documentos.</p>';
  } else {
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:0';
    events.forEach((ev, i) => {
      const when = ev.when ? new Date(ev.when).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:12px;align-items:flex-start;padding:10px 0' + (i < events.length - 1 ? ';border-bottom:1px solid var(--neutral-100)' : '');
      row.innerHTML =
        `<div style="flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--neutral-50);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px">${ev.icon}</div>` +
        `<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:600;color:var(--ink)">${ev.title}</div><div style="font-size:12.5px;color:var(--muted);margin-top:1px">${ev.detail}</div></div>` +
        `<div style="flex-shrink:0;font-size:11.5px;color:var(--muted);white-space:nowrap">${when}</div>`;
      list.appendChild(row);
    });
    tlSec.appendChild(list);
  }
  body.appendChild(tlSec);

  // ── Bloque de cobros (tramos) — botones RENDERIZADOS, SIN cablear (paso 3, STOP AA1.4) ──
  const cobSec = document.createElement('div');
  cobSec.className = 'detail-section';
  cobSec.innerHTML = '<h3 class="detail-section-title">Cobros</h3>';
  body.appendChild(cobSec);

  // SCRUM-12 paso 3: acciones de cobro. Tras cada acción de estado, re-fetch del
  // GET /admin/jobs/:id → semáforo/barra/timeline/tramos al día. Solo INVOCA endpoints
  // existentes (collect-rest, invoice status, payment-anomaly, confirm-bizum, send-reminder,
  // resend-whatsapp, send-email); no toca su lógica, ni webhooks, ni la cadena de pago.
  const refresh = () => renderJobDetailView(container, job.id);
  const mkBtn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'btn-secondary btn-sm';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  };
  // SCRUM-85: payToken (Charge.receiptToken), NUNCA el chargeId — /pay/invoice ya no acepta el id.
  const invWaFallback = (inv, payToken, onRetry) => {
    const token = payToken || inv.payToken;
    statusBox.querySelectorAll('.wa-fallback-bar').forEach((b) => b.remove());
    statusBox.appendChild(waFallbackBar({
      link: token ? location.origin + '/pay/invoice/' + token : location.origin,
      onEmail: job.customer?.email ? () => apiRequest(`/admin/invoices/${inv.id}/send-email`, { method: 'POST' }) : null,
      emailDisabledReason: job.customer?.email ? null : 'Este cliente no tiene email guardado',
      onRetry,
    }));
  };

  // ── SCRUM-14 · Sección "Albaranes" (entre Documentos y Cobros; insertBefore) ──
  // Botones canónicos del brief: borrador → [Editar líneas][Emitir] · emitido →
  // [PDF][Firmar][Editar líneas] · firmado → [PDF] (congelado). Re-fetch tras acción.
  const albSec = document.createElement('div');
  albSec.className = 'detail-section';
  albSec.innerHTML = '<h3 class="detail-section-title">Albaranes</h3>';
  body.insertBefore(albSec, cobSec);

  const newAlbRow = document.createElement('div');
  newAlbRow.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap';
  const newAlbBtn = document.createElement('button');
  newAlbBtn.className = 'btn-secondary btn-sm';
  newAlbBtn.textContent = '+ Nuevo albarán';
  newAlbRow.appendChild(newAlbBtn);
  // SCRUM-65: elegir el modo ANTES de crear (congelado desde 'emitido'; se puede
  // ajustar también mientras el albarán siga en borrador, ver buildAlbEditor).
  const valoradoLabel = document.createElement('label');
  valoradoLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);cursor:pointer';
  const valoradoCheck = document.createElement('input');
  valoradoCheck.type = 'checkbox';
  valoradoLabel.appendChild(valoradoCheck);
  valoradoLabel.appendChild(document.createTextNode('Incluir precios en el parte'));
  newAlbRow.appendChild(valoradoLabel);
  albSec.appendChild(newAlbRow);
  const valoradoHint = document.createElement('p');
  valoradoHint.style.cssText = 'margin:4px 0 0;color:var(--muted);font-size:12px';
  valoradoHint.textContent = 'El parte sigue sin ser una factura.';
  albSec.appendChild(valoradoHint);

  // ── SCRUM-17 (FISCAL-2): consolidar albaranes en factura recapitulativa ──────
  // Botón visible solo si el Trabajo agrupa operaciones sueltas (SCRUM-66) y hay partes
  // elegibles (firmado + con precios + no facturado). El backend re-valida y hace la ROTURA
  // real por mes natural; el modal muestra el preview honesto de cuántas facturas se crearán.
  // (En modo receipt el backend responde 409; ver nota del PR sobre exponer el modo — SCRUM-81.)
  const consolidaEligibles = albaranes.filter((a) => a.estado === 'firmado' && a.modoValoracion === 'VALORADO' && !a.facturado);
  const consolidaEnabled = job.tipoOperacion === 'OPERACIONES_SUELTAS' && consolidaEligibles.length > 0;
  const consolidaSelected = new Set();
  const consolidaCheckboxes = [];
  const CONSOLIDA_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const consolidarBtn = document.createElement('button');
  consolidarBtn.className = 'btn-secondary btn-sm';
  consolidarBtn.textContent = '🧾 Consolidar en factura';
  consolidarBtn.style.display = consolidaEnabled ? '' : 'none';
  newAlbRow.appendChild(consolidarBtn);

  const consolidaBar = document.createElement('div');
  consolidaBar.style.cssText = 'display:none;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap';
  const consolidaConfirm = document.createElement('button');
  consolidaConfirm.className = 'btn-primary btn-sm';
  consolidaConfirm.textContent = 'Consolidar seleccionados';
  const consolidaCancel = document.createElement('button');
  consolidaCancel.className = 'btn-secondary btn-sm';
  consolidaCancel.textContent = 'Cancelar';
  const consolidaCount = document.createElement('span');
  consolidaCount.style.cssText = 'font-size:13px;color:var(--muted)';
  consolidaBar.append(consolidaConfirm, consolidaCancel, consolidaCount);
  albSec.appendChild(consolidaBar);

  function updateConsolidaCount() {
    consolidaCount.textContent = `${consolidaSelected.size} parte(s) seleccionado(s)`;
    consolidaConfirm.disabled = consolidaSelected.size === 0;
  }
  function setConsolidaMode(on) {
    consolidaSelected.clear();
    consolidaCheckboxes.forEach((c) => { c.wrap.style.display = on ? 'flex' : 'none'; c.checkbox.checked = false; });
    consolidaBar.style.display = on ? 'flex' : 'none';
    consolidarBtn.style.display = on ? 'none' : (consolidaEnabled ? '' : 'none');
    updateConsolidaCount();
  }
  consolidarBtn.addEventListener('click', () => setConsolidaMode(true));
  consolidaCancel.addEventListener('click', () => setConsolidaMode(false));
  consolidaConfirm.addEventListener('click', () => {
    const sel = consolidaCheckboxes.filter((c) => consolidaSelected.has(c.alb.id)).map((c) => c.alb);
    if (!sel.length) return;
    // Preview de rotura por mes en cliente (el backend hace la rotura real y autoritativa).
    const byMonth = new Map();
    for (const a of sel) {
      const d = new Date(a.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(a);
    }
    const grupos = [...byMonth.keys()].sort().map((k) => {
      const [y, m] = k.split('-').map(Number);
      const arr = byMonth.get(k);
      return { label: `${CONSOLIDA_MESES[m - 1]} ${y}`, count: arr.length, total: arr.reduce((s, a) => s + Number(a.totales?.total || 0), 0) };
    });
    const nF = grupos.length;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,28,23,.45);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:16px;max-width:420px;width:100%;padding:22px;box-shadow:0 18px 40px -16px rgba(16,24,40,.3)';
    card.innerHTML =
      `<h3 style="margin:0 0 6px;font-size:17px;color:var(--ink)">Consolidar en factura</h3>` +
      `<p style="margin:0 0 4px;font-size:14px;color:var(--body,#3f4a45)">Has seleccionado ${sel.length} parte(s) de ${nF} mes(es) distinto(s).</p>` +
      `<p style="margin:0 0 12px;font-size:13px;color:var(--muted)">La ley solo permite agrupar partes del mismo mes en una factura, así que se crearán <strong>${nF} factura${nF > 1 ? 's' : ''}</strong>:</p>` +
      `<ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:var(--ink)">` +
      grupos.map((g) => `<li><strong>${esc(g.label)}</strong> — ${g.count} parte(s) · ${esc(fmtMoneyEs(g.total, cur))}</li>`).join('') +
      `</ul>`;
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end';
    const cancelM = document.createElement('button');
    cancelM.className = 'btn-secondary btn-sm';
    cancelM.textContent = 'Cancelar';
    const goM = document.createElement('button');
    goM.className = 'btn-primary btn-sm';
    goM.textContent = `Crear ${nF} factura${nF > 1 ? 's' : ''}`;
    cancelM.addEventListener('click', () => overlay.remove());
    goM.addEventListener('click', async () => {
      goM.disabled = true;
      try {
        const res = await apiRequest(`/admin/jobs/${job.id}/consolidar-albaranes`, { method: 'POST', body: JSON.stringify({ albaranIds: sel.map((a) => a.id) }) });
        overlay.remove();
        showToast(`✓ ${res.facturas.length} factura(s) creada(s).`);
        refresh();
      } catch (e) {
        goM.disabled = false;
        setStatus('error', e?.data?.message || 'No se pudo consolidar.');
      }
    });
    btnRow.append(cancelM, goM);
    card.appendChild(btnRow);
    overlay.appendChild(card);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  });

  newAlbBtn.addEventListener('click', async () => {
    newAlbBtn.disabled = true;
    const modoValoracion = valoradoCheck.checked ? 'VALORADO' : 'SIN_VALORAR';
    try {
      await apiRequest(`/admin/jobs/${job.id}/albaranes`, { method: 'POST', body: JSON.stringify({ modoValoracion }) });
      showToast('✓ Albarán creado (borrador).');
      refresh();
    } catch (e) {
      setStatus('error', 'No se pudo crear el albarán: ' + (e?.data?.message || e.message));
      newAlbBtn.disabled = false;
    }
  });

  if (!albaranes.length) {
    const pEmpty = document.createElement('p');
    pEmpty.style.cssText = 'margin:10px 0 0;color:var(--muted);font-size:13px';
    pEmpty.textContent = 'Aún no hay albaranes. Crea uno por cada visita o entrega.';
    albSec.appendChild(pEmpty);
  }

  // SCRUM-65: totales orientativos en vivo — MISMA regla de céntimos enteros que el
  // backend (calcAlbaranTotales), para que lo que ve el pro al teclear no desentone
  // ni un céntimo con lo que sale luego en el PDF.
  function albTotalesJS(lineas) {
    let baseCents = 0, cuotaCents = 0;
    for (const l of lineas) {
      if (l.precioUnitario === undefined || l.precioUnitario === null || !Number.isFinite(l.precioUnitario)) continue;
      const lineaBaseCents = Math.round(l.precioUnitario * (Number(l.cantidad) || 0) * 100);
      const lineaCuotaCents = Math.round(lineaBaseCents * ((Number(l.tipoIva) || 0) / 100));
      baseCents += lineaBaseCents; cuotaCents += lineaCuotaCents;
    }
    return { base: baseCents / 100, total: (baseCents + cuotaCents) / 100 };
  }

  // Editor inline de líneas/notas/modo (borrador/emitido). PATCH → version++ en el
  // backend. Inputs creados por DOM (.value directo): sin interpolar valores en HTML.
  function buildAlbEditor(box, alb) {
    box.innerHTML = '';
    // SCRUM-65: el modo solo se puede TOCAR en 'borrador' (congelado desde 'emitido' —
    // el backend devolvería 409 albaran_locked si se intentase cambiar después).
    const modoEditable = alb.estado === 'borrador';
    let modo = alb.modoValoracion === 'VALORADO' ? 'VALORADO' : 'SIN_VALORAR';

    const modoRow = document.createElement('div');
    modoRow.style.cssText = 'margin-bottom:10px';
    if (modoEditable) {
      const lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink);cursor:pointer';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = modo === 'VALORADO';
      chk.addEventListener('change', () => {
        modo = chk.checked ? 'VALORADO' : 'SIN_VALORAR';
        [...rows.children].forEach(syncRowToModo);
        updateTotales();
      });
      lbl.appendChild(chk);
      lbl.appendChild(document.createTextNode('Incluir precios en el parte'));
      modoRow.appendChild(lbl);
      const hint = document.createElement('p');
      hint.style.cssText = 'margin:2px 0 0;color:var(--muted);font-size:12px';
      hint.textContent = 'El parte sigue sin ser una factura.';
      modoRow.appendChild(hint);
    } else {
      const p = document.createElement('p');
      p.style.cssText = 'margin:0;font-size:12px;color:var(--muted)';
      p.textContent = modo === 'VALORADO' ? 'Con precios (modo congelado tras emitir).' : 'Sin precios (modo congelado tras emitir).';
      modoRow.appendChild(p);
    }
    box.appendChild(modoRow);

    const rows = document.createElement('div');
    // Muestra/oculta las columnas precio+IVA de una fila según el modo actual.
    function syncRowToModo(r) {
      r.querySelectorAll('.alb-precio-field').forEach((el) => { el.style.display = modo === 'VALORADO' ? '' : 'none'; });
    }
    const mkRow = (l) => {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center;flex-wrap:wrap';
      const c = document.createElement('input');
      c.className = 'input'; c.placeholder = 'Concepto'; c.style.cssText = 'flex:3;min-width:0';
      c.value = l.concepto || '';
      const q = document.createElement('input');
      q.className = 'input'; q.placeholder = 'Cant.'; q.type = 'number'; q.min = '0'; q.step = 'any';
      q.style.cssText = 'flex:1;min-width:64px';
      if (l.cantidad !== undefined && l.cantidad !== null) q.value = l.cantidad;
      const u = document.createElement('input');
      u.className = 'input'; u.placeholder = 'Unidad (ud, m, h…)'; u.style.cssText = 'flex:1;min-width:80px';
      u.value = l.unidad || '';
      // SCRUM-65: precio unitario + IVA%, solo visibles/exigidos en modo VALORADO.
      const p = document.createElement('input');
      p.className = 'input alb-precio-field'; p.placeholder = 'Precio ud.'; p.type = 'number'; p.min = '0'; p.step = 'any';
      p.style.cssText = 'flex:1;min-width:80px';
      if (l.precioUnitario !== undefined && l.precioUnitario !== null) p.value = l.precioUnitario;
      const iv = document.createElement('input');
      iv.className = 'input alb-precio-field'; iv.placeholder = 'IVA %'; iv.type = 'number'; iv.min = '0'; iv.max = '100'; iv.step = 'any';
      iv.style.cssText = 'flex:1;min-width:64px';
      iv.value = (l.tipoIva !== undefined && l.tipoIva !== null) ? l.tipoIva : 21;
      [q, p, iv].forEach((inp) => inp.addEventListener('input', updateTotales));
      const del = document.createElement('button');
      del.className = 'btn-ghost btn-sm';
      del.textContent = '✕';
      del.setAttribute('aria-label', 'Quitar línea');
      del.addEventListener('click', () => { r.remove(); updateTotales(); });
      r.appendChild(c); r.appendChild(q); r.appendChild(u); r.appendChild(p); r.appendChild(iv); r.appendChild(del);
      syncRowToModo(r);
      return r;
    };
    const lineas = Array.isArray(alb.lineas) ? alb.lineas : [];
    lineas.forEach((l) => rows.appendChild(mkRow(l)));
    if (!lineas.length) rows.appendChild(mkRow({}));
    box.appendChild(rows);

    const addRow = document.createElement('button');
    addRow.className = 'btn-ghost btn-sm';
    addRow.textContent = '+ Añadir línea';
    addRow.addEventListener('click', () => { rows.appendChild(mkRow({})); updateTotales(); });
    box.appendChild(addRow);

    // Total orientativo (base + total, SIN desglose de cuota — igual que PDF/backend).
    const totalesBox = document.createElement('p');
    totalesBox.style.cssText = 'margin:8px 0 0;font-size:13px;color:var(--ink);font-weight:600;text-align:right';
    box.appendChild(totalesBox);
    function readRowsForTotales() {
      return [...rows.children].map((r) => {
        const inputs = r.querySelectorAll('input');
        return {
          cantidad: Number(String(inputs[1].value).replace(',', '.')),
          precioUnitario: modo === 'VALORADO' && inputs[3].value !== '' ? Number(String(inputs[3].value).replace(',', '.')) : null,
          tipoIva: modo === 'VALORADO' ? Number(String(inputs[4].value).replace(',', '.')) : null,
        };
      });
    }
    function updateTotales() {
      if (modo !== 'VALORADO') { totalesBox.textContent = ''; return; }
      const t = albTotalesJS(readRowsForTotales());
      totalesBox.textContent = `Base: ${fmtMoneyEs(t.base, cur)} · Total orientativo: ${fmtMoneyEs(t.total, cur)}`;
    }
    updateTotales();

    const notas = document.createElement('textarea');
    notas.className = 'input';
    notas.placeholder = 'Notas del albarán (opcional)';
    notas.style.cssText = 'width:100%;margin-top:8px;min-height:56px';
    notas.value = alb.notas || '';
    box.appendChild(notas);

    const saveRow = document.createElement('div');
    saveRow.style.cssText = 'display:flex;gap:8px;margin-top:8px';
    const save = document.createElement('button');
    save.className = 'btn-primary btn-sm';
    save.textContent = 'Guardar cambios';
    save.addEventListener('click', async () => {
      const out = [];
      for (const r of rows.children) {
        const inputs = r.querySelectorAll('input');
        const c = inputs[0].value.trim(), qv = inputs[1].value, u = inputs[2].value.trim();
        const pv = inputs[3].value, ivv = inputs[4].value;
        if (!c && !qv && !u) continue; // fila totalmente vacía se ignora
        const linea = { concepto: c, cantidad: Number(String(qv).replace(',', '.')), unidad: u };
        if (modo === 'VALORADO') {
          linea.precioUnitario = Number(String(pv).replace(',', '.'));
          linea.tipoIva = Number(String(ivv).replace(',', '.'));
        }
        out.push(linea);
      }
      const body = { lineas: out, notas: notas.value };
      // Solo se manda modoValoracion cuando es EDITABLE (borrador); en 'emitido' el
      // backend lo rechaza con 409 aunque el valor no cambie — mejor ni ofrecerlo.
      if (modoEditable) body.modoValoracion = modo;
      save.disabled = true;
      try {
        await apiRequest(`/admin/albaranes/${alb.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        showToast('✓ Albarán actualizado (nueva versión).');
        refresh();
      } catch (e) {
        setStatus('error', e?.data?.message || 'No se pudo guardar el albarán.');
        save.disabled = false;
      }
    });
    saveRow.appendChild(save);
    const cancelEd = document.createElement('button');
    cancelEd.className = 'btn-secondary btn-sm';
    cancelEd.textContent = 'Cancelar';
    cancelEd.addEventListener('click', () => { box.style.display = 'none'; });
    saveRow.appendChild(cancelEd);
    box.appendChild(saveRow);
  }

  albaranes.forEach((alb) => {
    const item = document.createElement('div');
    item.className = 'invoice-item';
    item.style.marginTop = '8px';
    // SCRUM-65: indicador de modo + total orientativo (solo si valorado; el propio
    // serializeAlbaran ya trae `totales` calculado en céntimos, nada que recalcular aquí).
    const albValorado = alb.modoValoracion === 'VALORADO';
    const albMetaBits = [
      new Date(alb.fecha).toLocaleDateString('es-ES'),
      `v${alb.version}`,
      albValorado ? `Con precios · Total orientativo ${fmtMoneyEs(alb.totales?.total ?? 0, cur)}` : 'Sin precios',
    ].join(' · ');
    item.innerHTML =
      `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">` +
      `<div><strong>Albarán ${esc(alb.numero)}</strong> · <span style="font-size:12px;color:var(--muted)">${esc(albMetaBits)}</span></div>` +
      `<span>` +
      `<span class="status-pill ${JOBDET_ALB_PILL[alb.estado] || 'status-pill-draft'}">${jobDetAlbEstado(alb.estado)}</span>` +
      // SCRUM-17: badge "Facturado" derivado (alb.facturado = invoiceId != null en el serializer)
      (alb.facturado ? `<span style="margin-left:6px;font-size:11px;font-weight:700;color:#166534;background:#ecfdf5;border-radius:999px;padding:2px 8px">Facturado</span>` : '') +
      `</span>` +
      `</div>` +
      `<div class="jobdet-alb-fotos" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>` +
      `<div class="jobdet-alb-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div>` +
      `<div class="jobdet-alb-editor" style="display:none;margin-top:10px"></div>`;
    albSec.appendChild(item);
    // SCRUM-17: checkbox de selección (modo consolidación) en albaranes elegibles.
    if (alb.estado === 'firmado' && alb.modoValoracion === 'VALORADO' && !alb.facturado) {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:none;align-items:center;gap:6px;margin-top:6px;font-size:13px;color:var(--ink);cursor:pointer';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.addEventListener('change', () => {
        if (cb.checked) consolidaSelected.add(alb.id); else consolidaSelected.delete(alb.id);
        updateConsolidaCount();
      });
      wrap.append(cb, document.createTextNode('Incluir en la factura'));
      item.insertBefore(wrap, item.firstChild);
      consolidaCheckboxes.push({ alb, checkbox: cb, wrap });
    }
    const acts = item.querySelector('.jobdet-alb-actions');
    const fotosBox = item.querySelector('.jobdet-alb-fotos');
    const editorBox = item.querySelector('.jobdet-alb-editor');

    // Miniaturas de fotos (GET tenancy-safe; la cookie de sesión viaja en el <img>)
    apiRequest(`/admin/albaranes/${alb.id}/fotos`).then((fotos) => {
      (fotos || []).forEach((f) => {
        const img = document.createElement('img');
        img.src = `/admin/attachments/${f.id}`;
        img.alt = 'Foto del albarán';
        img.loading = 'lazy';
        img.style.cssText = 'width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--border)';
        fotosBox.appendChild(img);
      });
    }).catch(() => {});

    const pdfBtn = () => mkBtn('PDF', () => { window.open(`/admin/albaranes/${alb.id}/pdf`, '_blank'); });
    const editBtn = () => mkBtn('Editar líneas', () => {
      const open = editorBox.style.display !== 'none';
      editorBox.style.display = open ? 'none' : 'block';
      if (!open) buildAlbEditor(editorBox, alb);
    });
    const fotoBtn = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.style.display = 'none';
      item.appendChild(input);
      const b = mkBtn('📷 Añadir foto', () => input.click());
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setStatus('error', 'Cada foto puede ocupar como máximo 5 MB.'); input.value = ''; return; }
        const rd = new FileReader();
        rd.onload = async () => {
          try {
            await apiRequest(`/admin/albaranes/${alb.id}/fotos`, { method: 'POST', body: JSON.stringify({ data: rd.result, mime: file.type }) });
            showToast('✓ Foto añadida.');
            refresh();
          } catch (e) { setStatus('error', e?.data?.message || 'No se pudo subir la foto.'); }
        };
        rd.readAsDataURL(file);
      });
      return b;
    };

    if (alb.estado === 'borrador') {
      acts.appendChild(editBtn());
      const em = mkBtn('Emitir', async () => {
        em.disabled = true;
        try {
          await apiRequest(`/admin/albaranes/${alb.id}/emitir`, { method: 'POST' });
          showToast('✓ Albarán emitido.');
          refresh();
        } catch (e) { setStatus('error', 'No se pudo emitir: ' + (e?.data?.message || e.message)); em.disabled = false; }
      });
      em.className = 'btn-primary btn-sm';
      acts.appendChild(em);
      acts.appendChild(fotoBtn());
    } else if (alb.estado === 'emitido') {
      acts.appendChild(pdfBtn());
      const fs = mkBtn('Firmar', () => {
        if (!window.openSignaturePad) { setStatus('error', 'El componente de firma no está cargado.'); return; }
        window.openSignaturePad({
          title: 'Firma del cliente',
          onConfirm: async (dataUri) => {
            try {
              await apiRequest(`/admin/albaranes/${alb.id}/firmar`, { method: 'POST', body: JSON.stringify({ signatureData: dataUri }) });
              showToast('✓ Albarán firmado.');
              refresh();
            } catch (e) { setStatus('error', 'No se pudo firmar: ' + (e?.data?.message || e.message)); }
          },
        });
      });
      fs.className = 'btn-primary btn-sm';
      acts.appendChild(fs);
      acts.appendChild(editBtn());
      acts.appendChild(fotoBtn());
      // SCRUM-49: enviar al cliente el link para FIRMAR a distancia (plantilla albaran_para_firmar_es).
      const firmarWaBtn = mkBtn('Enviar para firmar', async () => {
        firmarWaBtn.disabled = true;
        const orig = firmarWaBtn.textContent;
        firmarWaBtn.textContent = 'Enviando…';
        try {
          const d = await apiRequest(`/admin/albaranes/${alb.id}/enviar-para-firmar`, { method: 'POST' });
          if (d && d.ok === false) {
            setStatus('error', d.message || 'No se pudo enviar por WhatsApp.');
          } else {
            showToast('✓ Enviado al cliente para firmar.');
          }
        } catch (e) {
          setStatus('error', e?.data?.message || 'No se pudo enviar por WhatsApp.');
        }
        firmarWaBtn.disabled = false;
        firmarWaBtn.textContent = orig;
      });
      acts.appendChild(firmarWaBtn);
    } else {
      acts.appendChild(pdfBtn()); // firmado = congelado: solo PDF
      // SCRUM-47: enviar la copia FIRMADA al WhatsApp del cliente (plantilla albaran_firmado_es).
      const waBtn = mkBtn('Enviar por WhatsApp', async () => {
        waBtn.disabled = true;
        const orig = waBtn.textContent;
        waBtn.textContent = 'Enviando…';
        try {
          const d = await apiRequest(`/admin/albaranes/${alb.id}/enviar-whatsapp`, { method: 'POST' });
          if (d && d.ok === false) {
            setStatus('error', d.message || 'No se pudo enviar por WhatsApp.');
          } else {
            showToast('✓ Albarán enviado por WhatsApp.');
          }
        } catch (e) {
          setStatus('error', e?.data?.message || 'No se pudo enviar por WhatsApp.');
        }
        waBtn.disabled = false;
        waBtn.textContent = orig;
      });
      acts.appendChild(waBtn);
    }
  });

  // CTA primario "Cobrar el resto" (terminado + remaining>0) → POST /admin/jobs/:id/collect-rest.
  if (job.status === 'terminado' && job.remaining && job.remaining.amount > 0) {
    // SCRUM-34: label honesto — collect-rest emite SOLO el siguiente tramo.
    // Con 2+ tramos pendientes de un plan CUSTOM: se nombra el tramo (label + importe del tramo).
    // Con el ÚLTIMO tramo: texto de hoy, pero el IMPORTE sale de nextStage.amount (exacto por
    // distributeStageAmounts; remaining es float y con céntimo impar mentiría 1 cént.).
    // Sin esc(): el label va a textContent.
    const restAmount = (job.pendingStagesCount === 1 && job.nextStage)
      ? fmtMoneyEs(job.nextStage.amount, job.nextStage.currency)
      : fmtMoneyEs(job.remaining.amount, job.remaining.currency); // fallback y presets con 2+ pendientes, como hoy
    const ctaLabel = (job.hasCustomPlan && job.pendingStagesCount >= 2 && job.nextStage)
      ? `🪙 Cobrar siguiente tramo: ${job.nextStage.label} (${fmtMoneyEs(job.nextStage.amount, job.nextStage.currency)})`
      : `💰 Cobrar el resto (${restAmount})`;
    const cta = document.createElement('button');
    cta.className = 'btn-primary';
    cta.style.marginBottom = '14px';
    cta.textContent = ctaLabel;
    cta.addEventListener('click', async () => {
      cta.disabled = true;
      cta.textContent = 'Enviando…';
      try {
        const r = await apiRequest(`/admin/jobs/${job.id}/collect-rest`, { method: 'POST' });
        showToast(r.whatsapp === 'sent'
          ? `💰 Enlace de cobro enviado (${fmtMoneyEs(r.amount, r.currency)})`
          : 'Cobro creado — el WhatsApp falló, reenvíalo desde Cobros', r.whatsapp === 'sent' ? 'ok' : 'warn');
        refresh();
      } catch (err) {
        setStatus('error', 'No se pudo generar el cobro: ' + (err?.data?.message || err.message));
        cta.disabled = false;
        cta.textContent = ctaLabel;
      }
    });
    cobSec.appendChild(cta);
  }

  if (!invoices.length) {
    cobSec.innerHTML += '<p style="margin:0;color:var(--muted);font-size:13px">Aún no hay cobros generados.</p>';
  } else {
    invoices.forEach((inv) => {
      const paid = String(inv.status).toLowerCase() === 'paid';
      const item = document.createElement('div');
      item.className = 'invoice-item';
      item.style.marginTop = '8px';
      const when = paid ? inv.paidAt : inv.createdAt;
      item.innerHTML =
        `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">` +
        `<div><strong>${inv.stageLabel ? esc(inv.stageLabel) + ' · ' : ''}${jobDetDocLabel(inv)} ${esc(inv.number)}</strong> · <span class="amount-muted">${fmtMoneyEs(inv.total, inv.currency || cur)}</span>` +
        `${when ? `<br><span style="font-size:12px;color:var(--muted)">${new Date(when).toLocaleDateString('es-ES')}</span>` : ''}</div>` +
        `<span class="status-pill ${jobDetInvPill(inv.status)}">${jobDetInvEstado(inv.status)}</span>` +
        `</div><div class="jobdet-inv-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div>`;
      const acts = item.querySelector('.jobdet-inv-actions');
      if (!paid) {
        // Marcar como PAGADA → PUT /admin/invoices/:id/status. Verificación de importe A21.2:
        // si el importe recibido no cuadra → payment-anomaly y la factura NO se marca pagada.
        acts.appendChild(mkBtn('Marcar como PAGADA', async () => {
          // SCRUM-43: confirmación ligera ANTES del flujo A21.2
          // (el prompt de importe recibido sigue intacto tras ella)
          if (!window.confirm(`¿Marcar como pagada la factura ${inv.number} de ${fmtMoneyEs(inv.total, inv.currency || cur)}?`)) return;
          const totalNum = Number(inv.total);
          const raw = window.prompt('¿Qué importe has recibido? (€)\nSi coincide con el total, confirma tal cual.', totalNum.toFixed(2));
          if (raw === null) return;
          const received = Number(String(raw).replace(',', '.'));
          if (!Number.isFinite(received) || received < 0) { setStatus('error', 'Importe no válido.'); return; }
          if (Math.abs(received - totalNum) > 0.009) {
            try {
              const a = await apiRequest(`/admin/invoices/${inv.id}/payment-anomaly`, { method: 'POST', body: JSON.stringify({ amount: received }) });
              setStatus('error', '⚠️ ' + (a.message || 'Importe distinto anotado. La factura sigue pendiente.'));
            } catch { setStatus('error', 'No se pudo anotar el importe. Inténtalo de nuevo.'); }
            return; // JAMÁS pagada con importe distinto
          }
          try {
            await apiRequest(`/admin/invoices/${inv.id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'paid' }) });
            refresh(); // el semáforo/barra/timeline actualizados = feedback (como invoice-detail)
          } catch (e) {
            setStatus('error', 'Error actualizando estado: ' + (e?.data?.message || e?.data?.error || e.message));
          }
        }));

        // Confirmar Bizum → POST /admin/charges/:chargeId/confirm-bizum (doble toque). Solo con chargeId.
        if (inv.chargeId) {
          const amountTxt = fmtMoneyEs(inv.total, inv.currency || cur);
          const custName = job.customer?.name || 'el cliente';
          const bz = document.createElement('button');
          bz.className = 'btn-secondary btn-sm';
          bz.textContent = '📲 Confirmar Bizum recibido';
          let armed = false;
          bz.addEventListener('click', async () => {
            if (!armed) {
              armed = true;
              bz.className = 'btn-primary btn-sm';
              bz.textContent = `¿Has recibido ${amountTxt} de ${custName} en tu Bizum? Sí, confirmar`;
              setTimeout(() => { if (armed) { armed = false; bz.className = 'btn-secondary btn-sm'; bz.textContent = '📲 Confirmar Bizum recibido'; } }, 6000);
              return;
            }
            bz.disabled = true;
            bz.textContent = 'Confirmando…';
            try {
              await apiRequest(`/admin/charges/${inv.chargeId}/confirm-bizum`, { method: 'POST' });
              showToast('✓ Bizum confirmado: factura cobrada.');
              refresh();
            } catch (e) {
              const msgs = { bizum_disabled: 'Los cobros por Bizum no están activados todavía.', charge_not_pending: 'Este cobro ya no está pendiente.' };
              setStatus('error', msgs[e?.data?.error] || 'No se pudo confirmar el Bizum.');
              bz.disabled = false; armed = false; bz.className = 'btn-secondary btn-sm'; bz.textContent = '📲 Confirmar Bizum recibido';
            }
          });
          acts.appendChild(bz);
        }

        // Recordar pago → POST /admin/invoices/:id/send-reminder (solo si el cliente tiene teléfono).
        if (job.customer?.phone) {
          acts.appendChild(mkBtn('Recordar pago', async () => {
            try {
              await apiRequest(`/admin/invoices/${inv.id}/send-reminder`, { method: 'POST' });
              showToast('✓ Recordatorio enviado por WhatsApp.');
              refresh();
            } catch { setStatus('error', 'Error al enviar el recordatorio.'); }
          }));
        }

        // Reenviar por WhatsApp → POST /admin/invoices/:id/resend-whatsapp (+ waFallbackBar en fallo).
        const wa = mkBtn('Reenviar por WhatsApp', async () => {
          wa.disabled = true;
          const orig = wa.textContent;
          wa.textContent = 'Enviando…';
          try {
            const d = await apiRequest(`/admin/invoices/${inv.id}/resend-whatsapp`, { method: 'POST' });
            if (d && d.ok === false) { // Meta puede rechazar con 200 ok:false + mensaje legible
              setStatus('error', d.message || 'No se pudo enviar por WhatsApp.');
              invWaFallback(inv, d.pay_token, () => wa.click());
              wa.disabled = false; wa.textContent = orig;
            } else {
              showToast('✓ Factura reenviada por WhatsApp.');
              refresh();
            }
          } catch (e) {
            setStatus('error', e?.data?.message || ('No se pudo enviar por WhatsApp: ' + (e?.data?.error || 'desconocido')));
            invWaFallback(inv, e?.data?.pay_token, () => wa.click());
            wa.disabled = false; wa.textContent = orig;
          }
        });
        acts.appendChild(wa);

        // Enlace de pago público (ya existía; NO es acción de cobro). SCRUM-85: payToken, no chargeId.
        if (inv.payToken) {
          const pay = document.createElement('a');
          pay.className = 'btn-ghost btn-sm';
          pay.style.textDecoration = 'none';
          pay.href = `/pay/invoice/${inv.payToken}`;
          pay.target = '_blank';
          pay.textContent = 'Enlace de pago';
          acts.appendChild(pay);
        }
      }
      cobSec.appendChild(item);
    });
  }
}
window.renderJobDetailView = renderJobDetailView;
