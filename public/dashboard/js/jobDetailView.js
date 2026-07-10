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
  const invWaFallback = (inv, chargeId, onRetry) => {
    const cid = chargeId || inv.chargeId;
    statusBox.querySelectorAll('.wa-fallback-bar').forEach((b) => b.remove());
    statusBox.appendChild(waFallbackBar({
      link: cid ? location.origin + '/pay/invoice/' + cid : location.origin,
      onEmail: job.customer?.email ? () => apiRequest(`/admin/invoices/${inv.id}/send-email`, { method: 'POST' }) : null,
      emailDisabledReason: job.customer?.email ? null : 'Este cliente no tiene email guardado',
      onRetry,
    }));
  };

  // CTA primario "Cobrar el resto" (terminado + remaining>0) → POST /admin/jobs/:id/collect-rest.
  if (job.status === 'terminado' && job.remaining && job.remaining.amount > 0) {
    const ctaLabel = `💰 Cobrar el resto (${fmtMoneyEs(job.remaining.amount, job.remaining.currency)})`;
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
              invWaFallback(inv, d.charge_id, () => wa.click());
              wa.disabled = false; wa.textContent = orig;
            } else {
              showToast('✓ Factura reenviada por WhatsApp.');
              refresh();
            }
          } catch (e) {
            setStatus('error', e?.data?.message || ('No se pudo enviar por WhatsApp: ' + (e?.data?.error || 'desconocido')));
            invWaFallback(inv, e?.data?.charge_id, () => wa.click());
            wa.disabled = false; wa.textContent = orig;
          }
        });
        acts.appendChild(wa);

        // Enlace de pago público (ya existía; NO es acción de cobro).
        if (inv.chargeId) {
          const pay = document.createElement('a');
          pay.className = 'btn-ghost btn-sm';
          pay.style.textDecoration = 'none';
          pay.href = `/pay/invoice/${inv.chargeId}`;
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
