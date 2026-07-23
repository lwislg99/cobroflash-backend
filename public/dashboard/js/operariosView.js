// public/dashboard/js/operariosView.js — SCRUM-24 (OPERARIO-3)
// Vista de SUPERVISIÓN por operario, SOLO Admin. Archivo NUEVO: no toca jobsView.js
// ni jobDetailView.js (dominio del carril A). El gate real vive en el backend
// (GET /admin/metrics/operarios con requireRole('admin') + ADMIN_ONLY_ROUTES); aquí
// solo hay UX. Reutiliza progressBar (api.js) y las status-pill de cobro de la casa.
//
// Agrupa por operarioId = AUTOR del Trabajo (SCRUM-22): si el admin reasigna un trabajo,
// el resumen lo sigue atribuyendo a quien lo originó.

// SCRUM-30: semáforo de cobro vía el helper compartido cobroPillClass (api.js); antes duplicado aquí.

// Filtro por operario, persistente entre re-renders (patrón de jobsCobroFilter)
let operariosFilter = 'all';

async function renderOperariosView(container) {
  container.innerHTML = `
    <div style="max-width:860px">
      <div class="customers-card" style="margin-bottom:16px">
        <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">Operarios</h2>
        <p style="margin:0;font-size:13px;color:var(--muted)">Cuánto tiene cada operario en juego: trabajos abiertos, cobrado y pendiente. Se cuenta por quien creó el trabajo.</p>
      </div>
      <div id="operarios-hero"></div>
      <div id="operarios-filter" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"></div>
      <div id="operarios-list" style="display:flex;flex-direction:column;gap:12px"></div>
    </div>
  `;
  const hero = document.getElementById('operarios-hero');
  const filterBar = document.getElementById('operarios-filter');
  const list = document.getElementById('operarios-list');
  uiSkeletonCards(list, 3);

  let data;
  try {
    data = await apiRequest('/admin/metrics/operarios');
  } catch (err) {
    uiErrorState(list, 'No pudimos cargar el resumen de operarios.', () => renderOperariosView(container));
    return;
  }

  const operarios = Array.isArray(data.operarios) ? data.operarios : [];
  const currency = data.currency || 'EUR';

  // Sin equipo todavía: estado vacío digno (mismo patrón que el resto de listas)
  if (!data.hasOperarios) {
    hero.innerHTML = '';
    list.innerHTML = `<div class="customers-card"><div class="empty-state"><div class="empty-state-icon">👷</div>
      <div class="empty-state-title">Aquí verás a tu equipo</div>
      <div class="empty-state-desc">Cuando invites operarios desde Equipo, verás de un vistazo cuánto lleva cobrado cada uno y qué tiene pendiente.</div>
    </div></div>`;
    return;
  }

  // KPI de cabecera (AB1: el dinero primero) — total pendiente y trabajos abiertos
  const totalPendiente = operarios.reduce((a, o) => a + Number(o.pendiente || 0), 0);
  const totalAbiertos = operarios.reduce((a, o) => a + Number(o.abiertos || 0), 0);
  hero.innerHTML = `
    <div class="customers-card" style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)">Pendiente de cobrar</div>
      <div style="font-size:clamp(1.6rem,5vw,2.1rem);font-weight:800;letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1.1;margin-top:2px">${fmtMoneyEs(totalPendiente, currency)}</div>
      <div style="font-size:13px;color:var(--muted);margin-top:2px">${totalAbiertos} ${totalAbiertos === 1 ? 'trabajo abierto' : 'trabajos abiertos'} · ${operarios.length} ${operarios.length === 1 ? 'operario' : 'operarios'}</div>
    </div>
  `;

  const paint = () => {
    // Selector por operario (segmentado, mismo componente que el filtro de Trabajos)
    filterBar.innerHTML = '';
    const opciones = [['all', 'Todos'], ...operarios.map((o) => [String(o.operarioId ?? 'owner'), o.nombre])];
    opciones.forEach(([key, label]) => {
      const b = document.createElement('button');
      b.className = 'btn-sm ' + (operariosFilter === key ? 'btn-secondary' : 'btn-ghost');
      b.textContent = label;
      b.setAttribute('aria-pressed', operariosFilter === key ? 'true' : 'false');
      b.addEventListener('click', () => { operariosFilter = key; paint(); });
      filterBar.appendChild(b);
    });

    const shown = operariosFilter === 'all'
      ? operarios
      : operarios.filter((o) => String(o.operarioId ?? 'owner') === operariosFilter);

    list.innerHTML = '';
    if (!shown.length) {
      list.innerHTML = `<div class="customers-card" style="text-align:center;color:var(--muted);font-size:13px;padding:18px">Ese operario no tiene trabajos.</div>`;
      return;
    }
    shown.forEach((o) => list.appendChild(operarioCard(o, currency)));
  };
  paint();
}

function operarioCard(o, currency) {
  const card = document.createElement('div');
  card.className = 'customers-card';
  card.style.cssText = 'display:flex;flex-direction:column;gap:10px';

  const esOwner = o.operarioId == null;
  const roleLabel = esOwner ? 'Propietario' : (o.role === 'admin' ? 'Admin' : 'Operario'); // A20.3
  const roleClass = o.role === 'tecnico' ? 'status-pill-pending' : 'status-pill-accepted';
  const cobroCls = cobroPillClass(o.estadoCobro);
  const aceptado = Number(o.totalAceptado || 0);
  const cobrado = Number(o.totalCobrado || 0);
  const suspendido = o.status === 'suspended';

  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:var(--ink);font-size:15px">${esc(o.nombre)}</div>
        <div style="font-size:12.5px;color:var(--muted);margin-top:2px">
          <span class="status-pill ${roleClass}" style="vertical-align:middle">${roleLabel}</span>
          ${suspendido ? ' <span class="status-pill status-pill-rejected" style="vertical-align:middle">Suspendido</span>' : ''}
          ${aceptado > 0 ? ` <span class="status-pill ${cobroCls}" style="vertical-align:middle">${esc(o.estadoCobro)}</span>` : ''}
        </div>
      </div>
      <div style="flex:none;text-align:right">
        <div style="font-size:12px;color:var(--muted)">Pendiente</div>
        <div style="font-weight:700;color:var(--ink);font-size:16px;font-variant-numeric:tabular-nums">${fmtMoneyEs(o.pendiente, currency)}</div>
      </div>
    </div>
    ${aceptado > 0 ? progressBar(o.progreso, o.estadoCobro, { cobrado, aceptado, currency }) : ''}
    <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--muted)">
      <span>Abiertos <b style="color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums">${o.abiertos}</b></span>
      <span>Trabajos <b style="color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums">${o.trabajos}</b></span>
    </div>
  `;
  return card;
}

window.renderOperariosView = renderOperariosView;
