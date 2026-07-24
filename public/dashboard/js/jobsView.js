// public/dashboard/js/jobsView.js — A13.2/A13.3 (EXT3, JOB-1)
// "Esta semana": LISTA simple por fecha (la spec PROHÍBE el calendario grid).
// El momento de dinero: terminado + tramo pendiente → "💰 Cobrar el resto".

const JOB_STATE_META = {
  pendiente_agendar: { label: 'Sin agendar', pill: 'background:var(--neutral-100);color:var(--neutral-600)' },
  agendado:          { label: 'Agendado',    pill: 'background:#eff6ff;color:#1d4ed8' },
  en_curso:          { label: 'En curso',    pill: 'background:#fffbeb;color:#b45309' },
  terminado:         { label: 'Terminado',   pill: 'background:var(--brand-tint,#ecfdf5);color:#166534' },
  cerrado:           { label: 'Cerrado',     pill: 'background:var(--neutral-100);color:var(--neutral-500)' },
};

// SCRUM-11: semáforo de COBRO (distinto del estado FSM de arriba) → .status-pill
// canónico, mismo mapeo que invoicesView: Pagado→accepted (verde), Parcial→pending
// (ámbar), Pendiente→draft (neutro). El dato es job.estadoCobro (backend SCRUM-13/28).
// SCRUM-30: el mapeo vive en el helper compartido cobroPillClass (api.js); antes duplicado aquí.

// SCRUM-11: filtro de cobro persistente entre re-renders (una acción FSM recarga la vista).
let jobsCobroFilter = 'all';

async function renderJobsView(container) {
  container.innerHTML = `
    <div style="max-width:860px">
      <div class="customers-card" style="margin-bottom:16px">
        <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">Trabajos</h2>
        <p style="margin:0;font-size:13px;color:var(--muted)">Cada presupuesto aceptado se convierte en un trabajo. Agéndalo, márcalo terminado y cobra el resto con un toque.</p>
      </div>
      <div id="jobs-filter" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"></div>
      <div id="jobs-list" style="display:flex;flex-direction:column;gap:12px"></div>
    </div>
  `;
  const list = document.getElementById('jobs-list');
  const filterBar = document.getElementById('jobs-filter');
  uiSkeletonCards(list, 4);

  let jobs;
  try {
    jobs = await apiRequest('/admin/jobs');
  } catch {
    uiErrorState(list, 'No pudimos cargar los trabajos.', () => renderJobsView(container));
    return;
  }

  if (!jobs.length) {
    list.innerHTML = `<div class="customers-card"><div class="empty-state"><div class="empty-state-icon">🔧</div>
      <div class="empty-state-title">Aquí verás tus trabajos</div>
      <div class="empty-state-desc">Cuando un cliente acepte un presupuesto, el trabajo aparece solo: agéndalo, termínalo y cobra el resto sin perseguir a nadie.</div>
    </div></div>`;
    return;
  }

  // SCRUM-11: filtro por estado de cobro (segmentado; reutiliza botones del inventario,
  // NO crea componente nuevo). Filtra el array ANTES del agrupado → no rompe los grupos.
  const paint = () => {
    const counts = { all: jobs.length, Pendiente: 0, Parcial: 0, Pagado: 0 };
    for (const j of jobs) if (counts[j.estadoCobro] != null) counts[j.estadoCobro]++;

    filterBar.innerHTML = '';
    [['all', 'Todos'], ['Pendiente', 'Pendiente'], ['Parcial', 'Parcial'], ['Pagado', 'Pagado']].forEach(([key, label]) => {
      const b = document.createElement('button');
      b.className = 'btn-sm ' + (jobsCobroFilter === key ? 'btn-secondary' : 'btn-ghost');
      b.textContent = `${label} · ${key === 'all' ? counts.all : counts[key]}`;
      b.setAttribute('aria-pressed', jobsCobroFilter === key ? 'true' : 'false');
      b.addEventListener('click', () => { jobsCobroFilter = key; paint(); });
      filterBar.appendChild(b);
    });

    const shown = jobsCobroFilter === 'all' ? jobs : jobs.filter((j) => j.estadoCobro === jobsCobroFilter);
    renderJobGroups(list, shown, container);
  };
  paint();
}

// Agrupado de LISTA (spec: lista simple por fecha). Extraído (SCRUM-11) para reutilizarlo
// con el filtro de cobro; el agrupado y su lógica NO cambian.
function renderJobGroups(list, jobs, container) {
  list.innerHTML = '';
  if (!jobs.length) {
    list.innerHTML = `<div class="customers-card" style="text-align:center;color:var(--muted);font-size:13px;padding:18px">No hay trabajos con ese estado de cobro.</div>`;
    return;
  }

  const now = Date.now();
  const in7d = now + 7 * 86400000;
  const groups = [
    { key: 'en_curso',  title: '🔨 En curso',         items: [] },
    { key: 'semana',    title: '📅 Esta semana',       items: [] },
    { key: 'sin',       title: '⏳ Sin agendar',       items: [] },
    { key: 'adelante',  title: '🗓 Más adelante',      items: [] },
    { key: 'terminado', title: '✅ Terminados — cobra el resto', items: [] },
    { key: 'cerrado',   title: '🔒 Cerrados', items: [], collapsed: true },
  ];
  for (const j of jobs) {
    const t = j.scheduledAt ? new Date(j.scheduledAt).getTime() : null;
    if (j.status === 'en_curso') groups[0].items.push(j);
    else if (j.status === 'terminado') groups[4].items.push(j);
    else if (j.status === 'cerrado') groups[5].items.push(j);
    else if (j.status === 'agendado' && t !== null && t <= in7d) groups[1].items.push(j);
    else if (j.status === 'pendiente_agendar') groups[2].items.push(j);
    else groups[3].items.push(j);
  }

  for (const g of groups) {
    if (!g.items.length) continue;
    const sec = document.createElement('div');
    sec.innerHTML = `<div style="font-size:12px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em;margin:4px 0 8px">${g.title} · ${g.items.length}</div>`;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    if (g.collapsed && g.items.length) {
      const btn = document.createElement('button');
      btn.className = 'btn-ghost btn-sm';
      btn.textContent = `Ver ${g.items.length} cerrado${g.items.length !== 1 ? 's' : ''}`;
      btn.addEventListener('click', () => { btn.remove(); g.items.forEach((j) => wrap.appendChild(jobCard(j, container))); });
      wrap.appendChild(btn);
    } else {
      g.items.forEach((j) => wrap.appendChild(jobCard(j, container)));
    }
    sec.appendChild(wrap);
    list.appendChild(sec);
  }
}

function jobCard(j, container) {
  const meta = JOB_STATE_META[j.status] || JOB_STATE_META.pendiente_agendar;
  const card = document.createElement('div');
  card.className = 'customers-card';
  card.style.cssText = 'display:flex;flex-direction:column;gap:10px;cursor:pointer';

  const fecha = j.scheduledAt
    ? new Date(j.scheduledAt).toLocaleString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  // SCRUM-11: semáforo de cobro + barra de % (dato de SCRUM-13/28). Se pinta cuando hay
  // un total aceptado contra el que cobrar (Jobs sin presupuesto/total → sin barra).
  const aceptado = Number(j.totalAceptado || 0);
  const cobrado = Number(j.totalCobrado || 0);
  const cur = j.quote?.currency || 'EUR';
  const showCobro = aceptado > 0;
  const pct = showCobro ? Math.min(100, Math.round((cobrado / aceptado) * 100)) : 0;
  const cobroCls = cobroPillClass(j.estadoCobro);
  const isTecnico = window.appUserRole === 'tecnico'; // SCRUM-89: "Cobrar el resto" es admin-only (403)

  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:var(--ink);font-size:15px">${esc(j.customer?.name || 'Cliente')}</div>
        <div style="font-size:12.5px;color:var(--muted)">
          ${j.quote ? `Presupuesto #${j.quote.number} · <span style="color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums">${fmtMoneyEs(j.quote.total, j.quote.currency)}</span>${showCobro ? ` <span class="status-pill ${cobroCls}" style="vertical-align:middle">${esc(j.estadoCobro)}</span>` : ''}` : 'Sin presupuesto'}
          ${fecha ? ` · 📅 ${fecha}` : ''}
        </div>
      </div>
      <span style="flex:none;white-space:nowrap;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.03em;${meta.pill}">${meta.label}</span>
    </div>
    ${showCobro ? progressBar(pct, j.estadoCobro, { cobrado, aceptado, currency: cur }) : ''}
    <div class="job-actions" style="display:flex;gap:8px;flex-wrap:wrap"></div>
  `;

  const actions = card.querySelector('.job-actions');
  const refresh = () => renderJobsView(container);

  const patch = async (body, okMsg) => {
    try {
      await apiRequest(`/admin/jobs/${j.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      if (okMsg) showToast(okMsg);
      refresh();
    } catch (err) {
      showToast(err?.data?.error === 'invalid_transition' ? 'Ese cambio de estado no está permitido.' : 'No se pudo guardar: ' + err.message, 'error');
    }
  };

  const addBtn = (label, cls, fn) => {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', fn);
    actions.appendChild(b);
    return b;
  };

  // Acciones según FSM (L)
  if (j.status === 'pendiente_agendar' || j.status === 'agendado') {
    const dt = document.createElement('input');
    dt.type = 'datetime-local';
    dt.className = 'input';
    dt.style.cssText = 'width:auto;font-size:13px;padding:8px 10px';
    if (j.scheduledAt) {
      const d = new Date(j.scheduledAt);
      dt.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    actions.appendChild(dt);
    addBtn(j.status === 'agendado' ? 'Reagendar' : 'Agendar', 'btn-primary btn-sm', () => {
      if (!dt.value) { showToast('Elige fecha y hora primero.', 'warn'); return; }
      patch({ status: 'agendado', scheduledAt: new Date(dt.value).toISOString() }, '📅 Trabajo agendado');
    });
  }
  if (j.status === 'agendado') {
    addBtn('▶ Empezar', 'btn-secondary btn-sm', () => patch({ status: 'en_curso' }));
    const ics = document.createElement('a');
    ics.className = 'btn-ghost btn-sm';
    ics.style.textDecoration = 'none';
    ics.href = `/admin/jobs/${j.id}/ics`;
    ics.textContent = '📆 Añadir a mi calendario';
    actions.appendChild(ics);
  }
  if (j.status === 'en_curso') {
    addBtn('✅ Marcar terminado', 'btn-primary btn-sm', () => patch({ status: 'terminado' }, '✅ Trabajo terminado'));
  }
  if (j.status === 'terminado') {
    if (j.remaining && j.remaining.amount > 0) {
      // A13.3: EL momento de dinero (V2: siempre acción del pro)
      const cobrarBtn = addBtn(`💰 Cobrar el resto (${fmtMoneyEs(j.remaining.amount, j.remaining.currency)})`, 'btn-primary btn-sm', async (ev) => {
        const b = ev.currentTarget;
        b.disabled = true; b.textContent = 'Enviando…';
        try {
          const r = await apiRequest(`/admin/jobs/${j.id}/collect-rest`, { method: 'POST' });
          // SCRUM-126: la factura se crea siempre; el envío es un efecto secundario con su
          // propio resultado en r.whatsapp.sent (ver api.js: waCollectRestSent).
          const waSent = waCollectRestSent(r.whatsapp);
          showToast(waSent
            ? `💰 Enlace de cobro enviado (${fmtMoneyEs(r.amount, r.currency)})`
            : 'Cobro creado — el WhatsApp falló, reenvíalo desde Cobros', waSent ? 'ok' : 'warn');
          refresh();
        } catch (err) {
          showToast('No se pudo generar el cobro: ' + (err?.data?.message || err.message), 'error');
          b.disabled = false;
        }
      });
      // SCRUM-89: "Cobrar el resto" es admin-only (403). Técnico → deshabilitado con explicación.
      if (isTecnico) { lockActionForRole(cobrarBtn); actions.appendChild(roleLockedNote()); }
    }
    addBtn('Cerrar trabajo', 'btn-ghost btn-sm', () => patch({ status: 'cerrado' }, '🔒 Trabajo cerrado'));
  }

  // Notas internas (blur = guardar)
  const notes = document.createElement('textarea');
  notes.placeholder = 'Notas internas del trabajo…';
  notes.value = j.notes || '';
  notes.rows = 1;
  notes.style.cssText = 'width:100%;resize:vertical;font:inherit;font-size:13px;padding:8px 10px;border:1px solid var(--neutral-200);border-radius:8px;color:var(--body)';
  notes.addEventListener('blur', () => {
    if ((j.notes || '') !== notes.value) {
      apiRequest(`/admin/jobs/${j.id}`, { method: 'PATCH', body: JSON.stringify({ notes: notes.value }) })
        .then(() => { j.notes = notes.value; showToast('✓ Notas guardadas'); })
        .catch(() => showToast('No se pudieron guardar las notas', 'error'));
    }
  });
  card.appendChild(notes);

  // SCRUM-12: la tarjeta abre el detalle del Trabajo; los controles internos (botones,
  // enlace .ics, datetime de agendar, notas) NO disparan la navegación (guard por target).
  card.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, textarea, select, label')) return;
    if (window.renderAppView) window.renderAppView('jobs-detail', { jobId: j.id });
  });

  return card;
}
