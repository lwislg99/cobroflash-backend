// public/dashboard/js/jobDetailView.js — SCRUM-12 (TRABAJO-3)
// Detalle del Trabajo: cabecera (totales + semáforo + barra) → timeline de documentos
// (lista cronológica, patrón customerDetailView) → bloque de cobros (tramos). Layout
// canónico .detail-page. Endpoint solo-lectura GET /admin/jobs/:id.
// ⚠️ Las ACCIONES DE COBRO se renderizan pero se CABLEAN en el paso 3 (STOP AA1.4).

// SCRUM-30: el pill de cobro usa el helper compartido cobroPillClass (api.js); antes duplicado aquí.

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

// SCRUM-31 (F4): resolver de la SIGUIENTE acción del héroe (escalera aprobada por el fundador).
// PURO: decide CUÁL acción mostrar a partir de `job`; NO ejecuta nada (el héroe reutiliza los
// endpoints existentes). Prioridad: (1) Cobrar el resto si terminado con saldo · (2) Recordar pago
// si hay factura sin pagar ≥7 días (y hay teléfono) · (3) Enviar para firmar un albarán emitido ·
// (4) Emitir un albarán en borrador · (5) Nuevo albarán si no hay ninguno · (6) nada (null).
// Entre albaranes gana el MÁS AVANZADO: emitido pesa más que borrador.
function jobNextAction(job, isAdmin = true) {
  // SCRUM-89: los niveles de DINERO (1 cobrar, 2 recordar) son admin-only (403 para técnico) — un
  // técnico los SALTA y el héroe solo le sugiere lo que SÍ puede (firmar/emitir/nuevo) o nada (nivel 6),
  // nunca un CTA muerto. El dinero queda deshabilitado en su sitio (la fila de factura), no en el héroe.
  // 1 · terminado con saldo → Cobrar el resto (label honesto SCRUM-34).
  if (isAdmin && job.status === 'terminado' && job.remaining && job.remaining.amount > 0) {
    const restAmount = (job.pendingStagesCount === 1 && job.nextStage)
      ? fmtMoneyEs(job.nextStage.amount, job.nextStage.currency)
      : fmtMoneyEs(job.remaining.amount, job.remaining.currency);
    const label = (job.hasCustomPlan && job.pendingStagesCount >= 2 && job.nextStage)
      ? `🪙 Cobrar siguiente tramo: ${job.nextStage.label} (${fmtMoneyEs(job.nextStage.amount, job.nextStage.currency)})`
      : `💰 Cobrar el resto (${restAmount})`;
    return { level: 1, kind: 'cobrar', label };
  }
  // 2 · factura sin pagar ≥7 días (y con teléfono para poder recordar) → Recordar pago.
  // Condicionado a propósito: no sugerir insistir a un cliente al que se facturó ayer.
  const invoices = Array.isArray(job.invoices) ? job.invoices : [];
  if (isAdmin && job.customer?.phone) {
    const vieja = invoices.find((inv) => {
      if (String(inv.status).toLowerCase() === 'paid') return false;
      const created = inv.createdAt ? new Date(inv.createdAt) : null;
      if (!created || isNaN(created.getTime())) return false;
      return (Date.now() - created.getTime()) >= 7 * 86400000;
    });
    if (vieja) return { level: 2, kind: 'recordar', label: 'Recordar pago', invoiceId: vieja.id };
  }
  // 3/4 · albaranes: gana el MÁS AVANZADO (emitido → firmar; si no, borrador → emitir).
  const albaranes = Array.isArray(job.albaranes) ? job.albaranes : [];
  const emitido = albaranes.find((a) => a.estado === 'emitido');
  if (emitido) return { level: 3, kind: 'firmar', label: 'Enviar para firmar', albaranId: emitido.id };
  const borrador = albaranes.find((a) => a.estado === 'borrador');
  if (borrador) return { level: 4, kind: 'emitir', label: 'Emitir albarán', albaranId: borrador.id };
  // 5 · sin ningún albarán → crear el primero. (Con albaranes todos firmados y nada pendiente → null.)
  if (!albaranes.length) return { level: 5, kind: 'nuevo', label: '+ Nuevo albarán' };
  // 6 · nada que sugerir.
  return null;
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

  // SCRUM-31 (F1): refresh se define arriba porque el CTA de cobro se pinta ahora en el
  // HÉROE (antes vivía al fondo, en 'Cobros'). Lo reutilizan también las acciones de albarán/factura.
  const refresh = () => renderJobDetailView(container, job.id);

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
  const cobroCls = cobroPillClass(job.estadoCobro);
  const jobMeta = jobStatusMeta(job.status); // SCRUM-31 (F1): estado del Trabajo, hoy invisible en el detalle
  const isTecnico = window.appUserRole === 'tecnico'; // SCRUM-89: veta de acciones de dinero (admin-only, 403 backend)

  // ── Resumen: estado de cobro + total + barra + cobrado/pendiente ──
  const sumSec = document.createElement('div');
  sumSec.className = 'detail-section';
  body.appendChild(sumSec);
  // SCRUM-31 (F1): cliente en una línea con tap-to-call (el detalle completo sigue en 'Datos').
  if (job.customer?.name || job.customer?.phone) {
    const cliLine = document.createElement('div');
    cliLine.style.cssText = 'margin-bottom:12px;font-size:13px;color:var(--body)';
    const tel = job.customer?.phone ? String(job.customer.phone).replace(/\s+/g, '') : '';
    cliLine.innerHTML =
      `👤 <strong style="color:var(--ink)">${esc(job.customer?.name || 'Cliente')}</strong>` +
      (job.customer?.phone
        ? ` · <a href="tel:${esc(tel)}" style="color:var(--brand,#16a34a);font-weight:600;text-decoration:none">📞 ${esc(job.customer.phone)}</a>`
        : '');
    sumSec.appendChild(cliLine);
  }
  const sumRow = document.createElement('div');
  sumRow.className = 'detail-summary';
  sumSec.appendChild(sumRow);
  // SCRUM-31 (F1): estado del TRABAJO + estado de cobro JUNTOS (antes solo se veía el de cobro).
  const stBlock = document.createElement('div');
  stBlock.innerHTML =
    `<div class="detail-total-label">Estado</div>` +
    `<span class="status-pill ${jobMeta.pillClass}">${esc(jobMeta.label)}</span> ` +
    `<span class="status-pill ${cobroCls}">${esc(job.estadoCobro)}</span>`;
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

  // ── CTA primario del HÉROE — la SIGUIENTE acción del Trabajo (SCRUM-31 F4). jobNextAction
  // decide CUÁL por la escalera aprobada; aquí SOLO se ejecuta, reutilizando endpoints existentes
  // (collect-rest / send-reminder / enviar-para-firmar / emitir / nuevo albarán). Cero lógica nueva.
  const nextAct = jobNextAction(job, !isTecnico);
  if (nextAct) {
    const cta = document.createElement('button');
    cta.className = 'btn-primary';
    cta.style.marginTop = '16px';
    cta.textContent = nextAct.label;
    cta.addEventListener('click', async () => {
      cta.disabled = true;
      const orig = cta.textContent;
      cta.textContent = 'Enviando…';
      try {
        if (nextAct.kind === 'cobrar') {
          const r = await apiRequest(`/admin/jobs/${job.id}/collect-rest`, { method: 'POST' });
          // SCRUM-126: la factura se crea siempre; el envío es un efecto secundario con su
          // propio resultado en r.whatsapp.sent (ver api.js: waCollectRestSent).
          const waSent = waCollectRestSent(r.whatsapp);
          showToast(waSent
            ? `💰 Enlace de cobro enviado (${fmtMoneyEs(r.amount, r.currency)})`
            : 'Cobro creado — el WhatsApp falló, reenvíalo desde Cobros', waSent ? 'ok' : 'warn');
          refresh();
        } else if (nextAct.kind === 'recordar') {
          const d = await apiRequest(`/admin/invoices/${nextAct.invoiceId}/send-reminder`, { method: 'POST' });
          // SCRUM-115: el endpoint responde 200+ok:true incluso si el envío falló — el
          // resultado real vive en `sent`, no en que la petición haya llegado.
          if (d && d.sent === false) {
            showToast('El WhatsApp del recordatorio falló — reinténtalo desde la factura', 'warn');
            cta.disabled = false; cta.textContent = orig;
          } else {
            showToast('✓ Recordatorio enviado por WhatsApp.');
            refresh();
          }
        } else if (nextAct.kind === 'firmar') {
          const d = await apiRequest(`/admin/albaranes/${nextAct.albaranId}/enviar-para-firmar`, { method: 'POST' });
          if (waSendFailed(d)) setStatus('error', d.message || 'No se pudo enviar por WhatsApp.');
          else showToast('✓ Enviado al cliente para firmar.');
          cta.disabled = false; cta.textContent = orig; // el albarán sigue emitido: no se refresca
        } else if (nextAct.kind === 'emitir') {
          await apiRequest(`/admin/albaranes/${nextAct.albaranId}/emitir`, { method: 'POST' });
          showToast('✓ Albarán emitido.');
          refresh();
        } else if (nextAct.kind === 'nuevo') {
          await apiRequest(`/admin/jobs/${job.id}/albaranes`, { method: 'POST', body: JSON.stringify({ modoValoracion: 'SIN_VALORAR' }) });
          showToast('✓ Albarán creado (borrador).');
          refresh();
        }
      } catch (err) {
        setStatus('error', 'No se pudo completar la acción: ' + (err?.data?.message || err.message));
        cta.disabled = false;
        cta.textContent = orig;
      }
    });
    sumSec.appendChild(cta);
  }

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
  // SCRUM-31 (F5): "Ver presupuesto" se mueve a la FILA de presupuesto de la lista 'Documentos'
  // (antes también estaba aquí; se quita para no duplicar).
  // SCRUM-31 (F6): "Datos" pasa a SEGUNDO PLANO — se appendea más abajo, tras Cobros
  // (el cliente ya está en el héroe con tap-to-call; aquí queda como referencia completa).

  // ── Tipo de trabajo (SCRUM-66 · TRABAJO-4) — SCRUM-31 (F6): PLEGADO a una línea editable.
  // Es config que se toca una vez: se muestra el valor actual + "Cambiar", y expande al selector
  // de 2 tarjetas a demanda. La lógica de PATCH y las tarjetas NO cambian (solo el envoltorio).
  const tipoSec = document.createElement('div');
  tipoSec.className = 'detail-section';
  tipoSec.innerHTML = '<h3 class="detail-section-title">Tipo de trabajo</h3>';
  let tipoActual = job.tipoOperacion === 'OPERACIONES_SUELTAS' ? 'OPERACIONES_SUELTAS' : 'TRABAJO_UNICO';
  const TIPO_CARDS = [
    { value: 'OPERACIONES_SUELTAS', icon: '🔧', title: 'Varios avisos o visitas sueltas', desc: 'Cada visita es un trabajo independiente para este cliente.' },
    { value: 'TRABAJO_UNICO', icon: '🏗️', title: 'Una obra o reforma de varios días', desc: 'Es un solo trabajo que se factura al concluir.' },
  ];
  const tipoCardOf = (v) => TIPO_CARDS.find((c) => c.value === v) || TIPO_CARDS[1];

  // Vista COLAPSADA: valor actual + "Cambiar".
  const tipoCollapsed = document.createElement('div');
  tipoCollapsed.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap';
  const tipoCollapsedLabel = document.createElement('div');
  tipoCollapsedLabel.style.cssText = 'font-size:14px;color:var(--ink)';
  const tipoChangeBtn = document.createElement('button');
  tipoChangeBtn.className = 'btn-ghost btn-sm';
  tipoChangeBtn.textContent = 'Cambiar';
  tipoCollapsed.append(tipoCollapsedLabel, tipoChangeBtn);
  tipoSec.appendChild(tipoCollapsed);

  // Vista EXPANDIDA (oculta por defecto): las 2 tarjetas + hint (idénticas a antes).
  const tipoExpanded = document.createElement('div');
  tipoExpanded.style.display = 'none';
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
  function syncTipoCollapsed() {
    const c = tipoCardOf(tipoActual);
    tipoCollapsedLabel.innerHTML = `<span style="font-size:16px" aria-hidden="true">${c.icon}</span> <strong style="color:var(--ink)">${esc(c.title)}</strong>`;
  }
  const tipoCollapse = () => { tipoExpanded.style.display = 'none'; tipoCollapsed.style.display = 'flex'; };
  const tipoExpand = () => { tipoCollapsed.style.display = 'none'; tipoExpanded.style.display = 'block'; };
  tipoChangeBtn.addEventListener('click', tipoExpand);
  // SCRUM-120: cambiar el TIPO DE OPERACIÓN es admin-only (bandera fiscal; gate backend por campo).
  // Técnico → el selector se ve pero DESHABILITADO con explicación (no dejar un botón muerto — la
  // norma tras SCRUM-89: un gate nuevo que deja UI huérfana se arregla en el MISMO PR). El técnico
  // sigue viendo el tipo actual (solo lectura); no lo puede cambiar.
  if (isTecnico) {
    lockActionForRole(tipoChangeBtn);
    tipoSec.appendChild(roleLockedNote());
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
      if (c.value === tipoActual) { tipoCollapse(); return; } // re-elegir el mismo = solo cerrar
      const prev = tipoActual;
      tipoActual = c.value;
      paintTipoCards();
      TIPO_CARDS.forEach((x) => tipoCardEls[x.value].setAttribute('aria-pressed', String(x.value === tipoActual)));
      try {
        await apiRequest(`/admin/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ tipoOperacion: c.value }) });
        showToast('✓ Tipo de trabajo actualizado.');
        syncTipoCollapsed();
        tipoCollapse(); // SCRUM-31 (F6): reflejar el nuevo valor y volver a plegar
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
  tipoExpanded.appendChild(tipoRow);
  const tipoHint = document.createElement('p');
  tipoHint.style.cssText = 'margin:8px 0 0;color:var(--muted);font-size:12px';
  tipoHint.textContent = 'Nos ayuda a preparar tus facturas correctamente. Si tienes dudas, confírmalo con tu asesor.';
  tipoExpanded.appendChild(tipoHint);
  tipoSec.appendChild(tipoExpanded);

  syncTipoCollapsed();
  body.appendChild(tipoSec);

  // ── Documentos (SCRUM-31 F5): UNA lista cronológica que FUSIONA presupuesto + albaranes +
  // facturas. Cada fila es un .job-doc-row (icono + qué es + estado/fecha/importe + acciones).
  // Mata el timeline read-only + la triple duplicación (Documentos/Albaranes/Cobros) de antes.
  const invoices = Array.isArray(job.invoices) ? job.invoices : [];
  const albaranes = Array.isArray(job.albaranes) ? job.albaranes : [];
  const docsSec = document.createElement('div');
  docsSec.className = 'detail-section';
  docsSec.innerHTML = '<h3 class="detail-section-title">Documentos</h3>';
  body.appendChild(docsSec);
  body.appendChild(infoSec); // SCRUM-31 (F6): "Datos" a segundo plano, bajo lo operativo.
  const docs = []; // { when, el } — se ordena ascendente y se vuelca al final en la lista.
  // Formato de fecha ÚNICO de la lista: día + mes + año + hora. Conserva la HORA (que solo tenía el
  // timeline) y el AÑO (que tenían las secciones) → cero pérdida al fusionar (auditoría F5).
  const docDate = (w) => w ? new Date(w).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  // ── SCRUM-31 (F5): "Cobros" y "Albaranes" dejan de ser secciones propias — sus filas van a la
  // lista fusionada 'Documentos'. (docsSec + Datos ya se han montado arriba.)

  // SCRUM-12 paso 3: acciones de cobro. Tras cada acción de estado, re-fetch del
  // GET /admin/jobs/:id → semáforo/barra/timeline/tramos al día. Solo INVOCA endpoints
  // existentes (collect-rest, invoice status, payment-anomaly, confirm-bizum, send-reminder,
  // resend-whatsapp, send-email); no toca su lógica, ni webhooks, ni la cadena de pago.
  // (refresh se define arriba, junto al fetch — SCRUM-31 F1: el CTA del héroe lo necesita antes.)
  const mkBtn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'btn-secondary btn-sm';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  };
  // SCRUM-31 (F3): agrupa las acciones SECUNDARIAS en un «⋯» (overflowMenu) si hay ≥2;
  // con 1 se deja visible (un kebab para una sola acción es peor). Ignora nulos.
  const addSecondary = (acts, els) => {
    const list = els.filter(Boolean);
    if (list.length >= 2) acts.appendChild(overflowMenu(list));
    else list.forEach((el) => acts.appendChild(el));
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

  // ── SCRUM-31 (F5): la antigua sección "Albaranes" es ahora la TOOLBAR de la lista 'Documentos'.
  // `albSec = docsSec` (alias): el resto del código de consolidación/albaranes que referencia
  // `albSec` sigue montándose dentro de 'Documentos' sin cambios. Botones (por estado): borrador →
  // [Emitir]+«⋯» · emitido → [PDF][Firmar]+«⋯» · firmado → [PDF][Enviar por WhatsApp].
  const albSec = docsSec;
  const newAlbRow = document.createElement('div');
  newAlbRow.className = 'job-doc-toolbar';
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

  // ── SCRUM-135: "+ Añadir gasto" ya vinculado a ESTE trabajo ──────────────────
  // Es el alta rápida "desde la furgoneta" que SCRUM-107 dejó aparcada hasta que existiera
  // Expense.teamMemberId (SCRUM-109, ya en prod): el técnico compra material y lo registra
  // sin llamar al jefe. Por eso NO lleva veta `isTecnico` — a diferencia de las acciones de
  // dinero, POST /admin/expenses está abierto a técnico a propósito, y la autoría se rellena
  // sola con su teamMemberId. Este es además su ÚNICO camino: el nav de Gastos está oculto
  // para él (app.js), y aquí no hace falta que elija trabajo porque ya está dentro de uno.
  //
  // El botón solo aparece si el Trabajo tiene presupuesto: el gasto se guarda por quoteId y
  // sin él no hay nada que vincular (mismo caso que las opciones deshabilitadas del selector).
  if (job.quote?.id != null && typeof openExpenseModal === 'function') {
    const gastoBtn = document.createElement('button');
    gastoBtn.className = 'btn-secondary btn-sm';
    gastoBtn.textContent = '+ Añadir gasto';
    gastoBtn.addEventListener('click', () => {
      openExpenseModal(null, {
        job: { id: job.id, quoteId: job.quote.id, titulo: job.titulo },
        // No hay vista de Gastos que recargar aquí (y para un técnico sus dos llamadas serían
        // 403): basta con confirmar. El gasto no se pinta en esta ficha — mostrar el gasto en
        // el Trabajo sería rentabilidad por obra, que es otro ticket.
        onSaved: () => { showToast('✓ Gasto añadido a este trabajo.'); },
      });
    });
    newAlbRow.appendChild(gastoBtn);
  }

  docsSec.appendChild(newAlbRow);
  const valoradoHint = document.createElement('p');
  valoradoHint.style.cssText = 'margin:4px 0 10px;color:var(--muted);font-size:12px';
  valoradoHint.textContent = 'El parte sigue sin ser una factura.';
  docsSec.appendChild(valoradoHint);

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
  // SCRUM-89: consolidar = emitir factura recapitulativa (admin-only, 403). Técnico → deshabilitado
  // con explicación (no ocultar), solo cuando de verdad aplica (hay partes elegibles). El listener de
  // setConsolidaMode no dispara con el botón disabled.
  if (isTecnico && consolidaEnabled) {
    lockActionForRole(consolidarBtn);
    newAlbRow.appendChild(roleLockedNote());
  }

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

  // SCRUM-31 (F5): el estado vacío ahora es de la LISTA COMPLETA (no solo albaranes) — al final.

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

  // Editor de líneas/notas/modo (borrador/emitido). PATCH → version++ en el backend.
  // Inputs creados por DOM (.value directo): sin interpolar valores en HTML.
  // SCRUM-31 (F2): se monta en un BOTTOM-SHEET (openAlbEditorSheet), no inline. La lógica
  // interna (campos, totales, PATCH) NO cambia; solo se parametrizan el CIERRE (onClose) y el
  // DESTINO del error (onError), porque el statusBox de la página queda DETRÁS del overlay.
  // Sin opts → comportamiento inline de antes intacto.
  function buildAlbEditor(box, alb, { onClose, onError } = {}) {
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
        if (onClose) onClose(); // cierra el sheet antes de re-renderizar
        refresh();
      } catch (e) {
        const msg = e?.data?.message || 'No se pudo guardar el albarán.';
        if (onError) onError(msg); else setStatus('error', msg); // el error se ve DENTRO del sheet
        save.disabled = false;
      }
    });
    saveRow.appendChild(save);
    const cancelEd = document.createElement('button');
    cancelEd.className = 'btn-secondary btn-sm';
    cancelEd.textContent = 'Cancelar';
    cancelEd.addEventListener('click', () => { if (onClose) onClose(); else box.style.display = 'none'; });
    saveRow.appendChild(cancelEd);
    box.appendChild(saveRow);
  }

  // SCRUM-31 (F2): abre el editor de líneas en un BOTTOM-SHEET. Reutiliza .modal-overlay/.modal,
  // que en <640px ya es hoja inferior full-width con scroll y slide-from-bottom (styles.css, como
  // customersView). Cada albarán abre su propio sheet. Se monta en document.body para que el
  // position:fixed no dependa de ningún stacking-context de la vista.
  function openAlbEditorSheet(alb) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Editar albarán ${alb.numero}`);
    const modal = document.createElement('div');
    modal.className = 'modal';
    const header = document.createElement('div');
    header.className = 'modal-header';
    const title = document.createElement('div');
    title.className = 'modal-title';
    title.textContent = `Editar albarán ${alb.numero}`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    header.append(title, closeBtn);
    // Banner de error PROPIO del sheet (el statusBox de la página queda detrás del overlay).
    const errEl = document.createElement('div');
    errEl.className = 'alert error';
    errEl.style.cssText = 'display:none;margin:12px 24px 0';
    const bodyEl = document.createElement('div');
    bodyEl.className = 'modal-body';
    modal.append(header, errEl, bodyEl);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const onKey = (e) => { if (e.key === 'Escape') close(); };
    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    // NO se cierra al pulsar el fondo: evita perder líneas sin querer (usa ×, Cancelar o Esc).

    buildAlbEditor(bodyEl, alb, {
      onClose: close,
      onError: (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; },
    });
    // Foco al primer campo (Concepto) para teclear directo; si no hay, al botón de cerrar.
    (bodyEl.querySelector('.input') || closeBtn).focus();
  }

  albaranes.forEach((alb) => {
    // SCRUM-65: indicador de modo + total orientativo (serializeAlbaran ya trae `totales`).
    const albValorado = alb.modoValoracion === 'VALORADO';
    const item = document.createElement('div');
    item.className = 'job-doc-row';
    item.innerHTML =
      `<div class="job-doc-row__icon" aria-hidden="true">📋</div>` +
      `<div class="job-doc-row__body">` +
        `<div class="job-doc-row__title">Albarán ${esc(alb.numero)}</div>` +
        `<div class="job-doc-row__meta">` +
          `<span class="status-pill ${JOBDET_ALB_PILL[alb.estado] || 'status-pill-draft'}">${jobDetAlbEstado(alb.estado)}</span>` +
          // SCRUM-17: badge "Facturado" derivado (alb.facturado = invoiceId != null en el serializer)
          (alb.facturado ? `<span class="job-doc-row__badge">Facturado</span>` : '') +
          `<span>${esc(docDate(alb.fecha))}</span>` +
          `<span>v${alb.version}</span>` +
          (albValorado ? `<span>Con precios · Total orientativo <span class="job-doc-row__amount">${fmtMoneyEs(alb.totales?.total ?? 0, cur)}</span></span>` : `<span>Sin precios</span>`) +
        `</div>` +
        `<div class="jobdet-alb-fotos job-doc-row__fotos"></div>` +
        `<div class="jobdet-alb-actions job-doc-row__actions"></div>` +
      `</div>`;
    const albBody = item.querySelector('.job-doc-row__body');
    // SCRUM-17: checkbox de selección (modo consolidación) en albaranes elegibles.
    if (alb.estado === 'firmado' && alb.modoValoracion === 'VALORADO' && !alb.facturado) {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:none;align-items:center;gap:6px;margin:0 0 6px;font-size:13px;color:var(--ink);cursor:pointer';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.addEventListener('change', () => {
        if (cb.checked) consolidaSelected.add(alb.id); else consolidaSelected.delete(alb.id);
        updateConsolidaCount();
      });
      wrap.append(cb, document.createTextNode('Incluir en la factura'));
      albBody.insertBefore(wrap, albBody.firstChild);
      consolidaCheckboxes.push({ alb, checkbox: cb, wrap });
    }
    // SCRUM-31 (fix fechas): ordenar por la fecha de OPERACIÓN `alb.fecha` — la MISMA que se muestra
    // en la fila y la legalmente relevante (determina el mes natural de la recapitulativa, SCRUM-17).
    // Antes ordenaba por firmadoAt (cuándo se firmó el papel, no cuándo se hizo el trabajo) → la fila
    // mostraba una fecha y se colocaba por otra, rompiendo el orden ascendente visible.
    docs.push({ when: alb.fecha, el: item });
    const acts = item.querySelector('.jobdet-alb-actions');
    const fotosBox = item.querySelector('.jobdet-alb-fotos');

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
    const editBtn = () => mkBtn('Editar líneas', () => openAlbEditorSheet(alb));
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
      const em = mkBtn('Emitir', async () => {
        em.disabled = true;
        try {
          await apiRequest(`/admin/albaranes/${alb.id}/emitir`, { method: 'POST' });
          showToast('✓ Albarán emitido.');
          refresh();
        } catch (e) { setStatus('error', 'No se pudo emitir: ' + (e?.data?.message || e.message)); em.disabled = false; }
      });
      em.className = 'btn-primary btn-sm';
      acts.appendChild(em); // primaria visible
      acts.appendChild(editBtn()); // SCRUM-31 (descubribilidad): "Editar líneas" VISIBLE (nunca escondida, AB3).
      addSecondary(acts, [fotoBtn()]); // «⋯» → solo Añadir foto (1 ítem = inline; sin muro)
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
      acts.appendChild(fs); // primaria visible (PDF ya está visible arriba)
      acts.appendChild(editBtn()); // SCRUM-31 (descubribilidad): "Editar líneas" VISIBLE (nunca escondida, AB3).
      // SCRUM-49: enviar al cliente el link para FIRMAR a distancia (plantilla albaran_para_firmar_es).
      const firmarWaBtn = mkBtn('Enviar para firmar', async () => {
        firmarWaBtn.disabled = true;
        const orig = firmarWaBtn.textContent;
        firmarWaBtn.textContent = 'Enviando…';
        try {
          const d = await apiRequest(`/admin/albaranes/${alb.id}/enviar-para-firmar`, { method: 'POST' });
          if (waSendFailed(d)) {
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
      // SCRUM-31: visibles = [PDF][Firmar][Editar líneas] (3 nunca-ocultas); «⋯» = Añadir foto ·
      // Enviar para firmar (las menos frecuentes). Emitido: 3 visibles + «⋯»(2), lejos del muro de 5.
      addSecondary(acts, [fotoBtn(), firmarWaBtn]);
    } else {
      acts.appendChild(pdfBtn()); // firmado = congelado: solo PDF
      // SCRUM-47: enviar la copia FIRMADA al WhatsApp del cliente (plantilla albaran_firmado_es).
      const waBtn = mkBtn('Enviar por WhatsApp', async () => {
        waBtn.disabled = true;
        const orig = waBtn.textContent;
        waBtn.textContent = 'Enviando…';
        try {
          const d = await apiRequest(`/admin/albaranes/${alb.id}/enviar-whatsapp`, { method: 'POST' });
          if (waSendFailed(d)) {
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

  // SCRUM-31 (F5): cada factura es una fila .job-doc-row de la lista fusionada (no una sección aparte).
  invoices.forEach((inv) => {
      const paid = String(inv.status).toLowerCase() === 'paid';
      const item = document.createElement('div');
      item.className = 'job-doc-row';
      const when = paid ? (inv.paidAt || inv.createdAt) : inv.createdAt;
      item.innerHTML =
        `<div class="job-doc-row__icon" aria-hidden="true">${paid ? '💰' : '🧾'}</div>` +
        `<div class="job-doc-row__body">` +
          `<div class="job-doc-row__title">${inv.stageLabel ? esc(inv.stageLabel) + ' · ' : ''}${jobDetDocLabel(inv)} ${esc(inv.number)}</div>` +
          `<div class="job-doc-row__meta">` +
            `<span class="status-pill ${jobDetInvPill(inv.status)}">${jobDetInvEstado(inv.status)}</span>` +
            `<span>${esc(docDate(when))}</span>` +
            `<span class="job-doc-row__amount">${fmtMoneyEs(inv.total, inv.currency || cur)}</span>` +
          `</div>` +
          `<div class="jobdet-inv-actions job-doc-row__actions"></div>` +
        `</div>`;
      docs.push({ when, el: item });
      const acts = item.querySelector('.jobdet-inv-actions');
      if (!paid) {
        // Marcar como PAGADA → PUT /admin/invoices/:id/status. Verificación de importe A21.2:
        // si el importe recibido no cuadra → payment-anomaly y la factura NO se marca pagada.
        const marcarBtn = mkBtn('Marcar como PAGADA', async () => {
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
        });

        // Confirmar Bizum → POST /admin/charges/:chargeId/confirm-bizum (doble toque). Solo con chargeId.
        let bizumBtn = null;
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
          bizumBtn = bz;
        }

        // Recordar pago → POST /admin/invoices/:id/send-reminder (solo si el cliente tiene teléfono).
        // SCRUM-126: este botón (distinto del de la CTA del héroe, arriba) nunca miró el
        // resultado del envío — mostraba "✓ Recordatorio enviado" aunque hubiera fallado.
        // Mismo bug que SCRUM-115 arregló en otro sitio del mismo fichero; este quedó fuera.
        const recordarBtn = job.customer?.phone ? mkBtn('Recordar pago', async () => {
          try {
            const d = await apiRequest(`/admin/invoices/${inv.id}/send-reminder`, { method: 'POST' });
            if (waSendFailed(d)) {
              setStatus('error', 'El WhatsApp del recordatorio falló — reinténtalo desde la factura.');
            } else {
              showToast('✓ Recordatorio enviado por WhatsApp.');
              refresh();
            }
          } catch { setStatus('error', 'Error al enviar el recordatorio.'); }
        }) : null;

        // Reenviar por WhatsApp → POST /admin/invoices/:id/resend-whatsapp (+ waFallbackBar en fallo).
        const wa = mkBtn('Reenviar por WhatsApp', async () => {
          wa.disabled = true;
          const orig = wa.textContent;
          wa.textContent = 'Enviando…';
          try {
            const d = await apiRequest(`/admin/invoices/${inv.id}/resend-whatsapp`, { method: 'POST' });
            if (waSendFailed(d)) { // Meta puede rechazar: 200 + sent:false + mensaje legible
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
        // Enlace de pago público (ya existía; NO es acción de cobro). SCRUM-85: payToken, no chargeId.
        let payLink = null;
        if (inv.payToken) {
          payLink = document.createElement('a');
          payLink.className = 'btn-ghost btn-sm';
          payLink.style.textDecoration = 'none';
          payLink.href = `/pay/invoice/${inv.payToken}`;
          payLink.target = '_blank';
          payLink.textContent = 'Enlace de pago';
        }
        // SCRUM-89: reparto por ROL. Admin = layout F3 (Marcar + Bizum visibles + «⋯»(Recordar·Reenviar·
        // Enlace)). Técnico = TODAS las de dinero VISIBLES pero DESHABILITADAS + UNA explicación por grupo
        // (no ocultar: que aprenda que el cobro es del admin); el "Enlace de pago" (no es dinero) sí es suyo.
        if (isTecnico) {
          [marcarBtn, bizumBtn, recordarBtn, wa].filter(Boolean).forEach((b) => acts.appendChild(lockActionForRole(b)));
          acts.appendChild(roleLockedNote());
          if (payLink) acts.appendChild(payLink);
        } else {
          acts.appendChild(marcarBtn);
          if (bizumBtn) acts.appendChild(bizumBtn);
          addSecondary(acts, [recordarBtn, wa, payLink]);
        }
      }
  });

  // ── SCRUM-31 (F5): fila del PRESUPUESTO (📝). Solo aparecía en el timeline como documento; se
  // preserva aquí. Única acción: "Ver presupuesto" (SOLO el botón es clicable, no la fila — F5 dec.3).
  if (job.quote) {
    const item = document.createElement('div');
    item.className = 'job-doc-row';
    item.innerHTML =
      `<div class="job-doc-row__icon" aria-hidden="true">📝</div>` +
      `<div class="job-doc-row__body">` +
        `<div class="job-doc-row__title">Presupuesto #${esc(job.quote.number)}</div>` +
        `<div class="job-doc-row__meta"><span>${esc(docDate(job.createdAt))}</span><span class="job-doc-row__amount">${fmtMoneyEs(job.quote.total, cur)}</span></div>` +
        `<div class="job-doc-row__actions"></div>` +
      `</div>`;
    const qBtn = mkBtn('Ver presupuesto', () => { if (window.renderAppView) window.renderAppView('quotes-detail', { quoteId: job.quote.id }); });
    item.querySelector('.job-doc-row__actions').appendChild(qBtn);
    docs.push({ when: job.createdAt, el: item });
  }

  // ── Volcado CRONOLÓGICO ASCENDENTE de la lista fusionada (o estado vacío de toda la lista) ──
  docs.sort((a, b) => new Date(a.when || 0) - new Date(b.when || 0));
  if (!docs.length) {
    const empty = document.createElement('p');
    empty.style.cssText = 'margin:6px 0 0;color:var(--muted);font-size:13px';
    empty.textContent = 'Aún no hay documentos. Crea un albarán por cada visita o entrega.';
    docsSec.appendChild(empty);
  } else {
    const docList = document.createElement('div');
    docList.className = 'job-doc-list';
    docs.forEach((d) => docList.appendChild(d.el));
    docsSec.appendChild(docList);
  }
}
window.renderJobDetailView = renderJobDetailView;
