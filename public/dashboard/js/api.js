// public/dashboard/js/api.js

// Si el backend sirve el dashboard desde el mismo dominio, base = "".
const API_BASE_URL = ""; // mismo origin (http://localhost:3000)

async function apiRequest(path, options = {}) {
  const url = API_BASE_URL + path;

  const finalOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  };

  const res = await fetch(url, finalOptions);

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* respuesta no JSON */ }

    // Prueba caducada: en vez de un error feo, llevamos al usuario a Planes
    // (cerrando cualquier modal abierto) para que pueda suscribirse.
    if (res.status === 403 && data && data.error === 'trial_expired') {
      document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
      const nav = document.querySelector('.nav-item[data-view="plans"]');
      if (nav) nav.click();
      else window.location.hash = '#plans';
      const e = new Error('Tu prueba ha terminado. Elige un plan para continuar.');
      e.status = 403; e.data = data; e.handled = true;
      throw e;
    }

    // SCRUM-151: el MENSAJE HUMANO gana al código técnico. Esto componía siempre
    // `API 409: no_more_invoices_for_payment_terms` y muchas vistas lo enseñan tal cual, así que
    // CUALQUIER endpoint sin `message` acababa mostrándole al usuario un identificador interno.
    // Arreglarlo aquí lo arregla también para todo lo que venga después. El código sigue
    // disponible en `err.code` y en `err.data` para quien decida POR código (que es lo correcto:
    // ramificar por texto es lo que nunca hay que hacer).
    const err = new Error(data?.message || `API ${res.status}: ${data?.error || res.statusText}`);
    err.status = res.status;
    err.code   = data?.error || null;
    err.data   = data;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

// -------- UI helpers compartidos (carga / error) --------

// Pinta un estado de error con botón de reintento dentro de `container`.
// onRetry se llama al pulsar "Reintentar". Reutilizable por cualquier vista.
function uiErrorState(container, message, onRetry) {
  if (!container) return;
  container.innerHTML = `
    <div class="state-error" role="alert" aria-live="assertive">
      <div class="state-error-ico" aria-hidden="true">⚠️</div>
      <div class="state-error-msg">${message || 'No pudimos cargar la información.'}</div>
      ${onRetry ? '<button type="button" class="state-error-retry">Reintentar</button>' : ''}
    </div>`;
  if (onRetry) {
    container.querySelector('.state-error-retry')?.addEventListener('click', onRetry);
  }
}
window.uiErrorState = uiErrorState;

// Marca un campo como inválido (origen del error) y lo enfoca. Limpia los
// previos dentro de `scope` para no acumular marcas.
function uiMarkFieldError(el, scope) {
  (scope || document).querySelectorAll('.input-error').forEach((n) => n.classList.remove('input-error'));
  if (!el) return;
  el.classList.add('input-error');
  el.focus?.();
  const clear = () => { el.classList.remove('input-error'); el.removeEventListener('input', clear); };
  el.addEventListener('input', clear);
}
window.uiMarkFieldError = uiMarkFieldError;

// P-A66-3: dinero SIEMPRE en formato español también dentro del BO — espejo
// del formatMoneyEs del servidor (core/utils). "2.383,70 €", nunca "2383.70 EUR".
function fmtMoneyEs(n, currency = 'EUR') {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  const opts = {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  // A18.2 (AB6 "9.999,99 €"): es-ES por defecto NO agrupa los miles de 4 cifras
  // (CLDR); useGrouping 'always' fuerza el punto SIEMPRE. Fallback en cascada.
  try {
    return new Intl.NumberFormat('es-ES', { ...opts, useGrouping: 'always' }).format(safe);
  } catch {
    try { return new Intl.NumberFormat('es-ES', opts).format(safe); }
    catch { return safe.toFixed(2) + ' ' + currency; }
  }
}
window.fmtMoneyEs = fmtMoneyEs;

// A6.2: toast compartido de TODO el BO (una sola voz para el feedback de acción).
// kind: 'ok' (verde marca) · 'warn' (ámbar) · 'error' (rojo). Sustituye a los
// alert() del navegador. Uno cada vez; aria-live para lectores de pantalla.
function showToast(msg, kind = 'ok') {
  document.getElementById('yaqu-toast')?.remove();
  // Compat: llamadas antiguas showToast(msg, true) = warn
  if (kind === true) kind = 'warn';
  const colors = { ok: 'var(--brand, #16a34a)', warn: '#b45309', error: '#b91c1c' };
  const toast = document.createElement('div');
  toast.id = 'yaqu-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  toast.style.cssText = `
    position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
    background:${colors[kind] || colors.ok}; color:#fff; max-width:min(92vw,480px);
    padding:10px 20px; border-radius:999px; font-size:14px; font-weight:600;
    z-index:400; box-shadow:0 4px 12px rgba(0,0,0,0.2);
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), kind === 'error' ? 5000 : 3000);
}
window.showToast = showToast;

// Rellena un <tbody> con filas-esqueleto mientras carga una lista. Se sustituyen
// al pintar los datos (tbody.innerHTML = ''). cols = nº de columnas de la tabla.
function uiSkeletonRows(tbody, cols, rows = 6) {
  if (!tbody) return;
  let html = '';
  for (let r = 0; r < rows; r++) {
    let tds = '';
    for (let c = 0; c < cols; c++) {
      const w = 45 + ((r + c) % 4) * 14;   // anchos variados 45–87%
      tds += `<td><span class="skeleton" style="display:block;height:12px;width:${w}%"></span></td>`;
    }
    html += `<tr class="skeleton-row" aria-hidden="true">${tds}</tr>`;
  }
  tbody.innerHTML = html;
}
window.uiSkeletonRows = uiSkeletonRows;

// SCRUM-126: `sent` es la ÚNICA verdad sobre si una notificación (WhatsApp/email) salió,
// en los 9 endpoints de envío del dashboard — nunca `ok` (eso era el punto ciego: un 200
// se lee como éxito si nadie mira el cuerpo). Un solo sitio que lo sepa, para que ningún
// consumidor futuro vuelva a mirar el campo equivocado.
function waSendFailed(result) {
  return !!result && result.sent === false;
}
window.waSendFailed = waSendFailed;

// Mismo criterio para el subobjeto anidado de collect-rest (`whatsapp:{sent,error,message}`
// — la factura SÍ se creó, `ok` de la respuesta es siempre true; el envío es un efecto
// secundario con su propio resultado).
function waCollectRestSent(whatsapp) {
  return !!whatsapp && whatsapp.sent === true;
}
window.waCollectRestSent = waCollectRestSent;

// A20.5 (J5): acciones de FALLBACK cuando un envío de WhatsApp falla — SIEMPRE
// se ofrecen las tres salidas: Copiar enlace · Enviar por email · Reintentar.
// Devuelve el elemento para insertarlo junto al mensaje de error de la vista.
function waFallbackBar({ link, onEmail, onRetry, emailDisabledReason }) {
  const bar = document.createElement('div');
  bar.className = 'wa-fallback-bar';
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-secondary btn-sm';
  copyBtn.textContent = '📋 Copiar enlace';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      showToast('✓ Enlace copiado — mándaselo por SMS o desde tu WhatsApp');
    } catch {
      window.prompt('Copia el enlace:', link);
    }
  });
  bar.appendChild(copyBtn);

  const emailBtn = document.createElement('button');
  emailBtn.className = 'btn-secondary btn-sm';
  emailBtn.textContent = '✉️ Enviar por email';
  if (emailDisabledReason) {
    emailBtn.disabled = true;
    emailBtn.title = emailDisabledReason;
    emailBtn.style.opacity = '.55';
  } else if (onEmail) {
    emailBtn.addEventListener('click', async () => {
      emailBtn.disabled = true;
      emailBtn.textContent = 'Enviando…';
      try {
        const result = await onEmail();
        // SCRUM-115: apiRequest() solo rechaza en HTTP≠2xx. Los 2 endpoints /send-email
        // responden 200+sent:false cuando el envío falla — sin este chequeo, esta barra
        // (compartida por facturas, presupuestos y trabajos) siempre decía "✓ Enviado".
        if (waSendFailed(result)) throw { data: result, message: result.message };
        showToast('✓ Enviado por email'); emailBtn.textContent = '✉️ Enviado';
      } catch (e) {
        showToast('Email falló: ' + (e?.data?.message || e.message), 'error');
        emailBtn.disabled = false; emailBtn.textContent = '✉️ Enviar por email';
      }
    });
  }
  bar.appendChild(emailBtn);

  if (onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-ghost btn-sm';
    retryBtn.textContent = '↻ Reintentar WhatsApp';
    retryBtn.addEventListener('click', () => { bar.remove(); onRetry(); });
    bar.appendChild(retryBtn);
  }
  return bar;
}
window.waFallbackBar = waFallbackBar;

// A6.2: esqueleto para listas de TARJETAS (solicitudes, gastos…): mismas
// proporciones que una fila-card real para que la carga no "salte".
function uiSkeletonCards(container, cards = 4) {
  if (!container) return;
  let html = '';
  for (let i = 0; i < cards; i++) {
    const w = 40 + (i % 3) * 18;
    html += `
      <div class="customers-card" aria-hidden="true" style="display:flex;flex-direction:column;gap:10px">
        <span class="skeleton" style="display:block;height:14px;width:${w}%"></span>
        <span class="skeleton" style="display:block;height:11px;width:${Math.min(w + 32, 92)}%"></span>
      </div>`;
  }
  container.innerHTML = html;
}
window.uiSkeletonCards = uiSkeletonCards;

// progressBar(pct, estado, {cobrado, aceptado, currency}) — barra de % cobrado COMPARTIDA
// (SCRUM-11 → extraída en SCRUM-12). Devuelve label "Cobrado X de Y · %" + barra .progress.
// estado 'Parcial' pinta ámbar; ancho = dato (inline). Tokens de styles.css:487-495.
function progressBar(pct, estado, { cobrado = 0, aceptado = 0, currency = 'EUR' } = {}) {
  const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  const partial = estado === 'Parcial' ? ' progress-fill--partial' : '';
  return `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:12px;margin-bottom:5px">
        <span style="color:var(--muted)">Cobrado <b style="color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums">${fmtMoneyEs(cobrado, currency)}</b> de <b style="color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums">${fmtMoneyEs(aceptado, currency)}</b></span>
        <span style="color:var(--muted);font-variant-numeric:tabular-nums">${p}%</span>
      </div>
      <div class="progress" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="Cobrado ${p}% de ${fmtMoneyEs(aceptado, currency)}">
        <div class="progress-fill${partial}" style="width:${p}%"></div>
      </div>
    </div>`;
}
window.progressBar = progressBar;

// SCRUM-30: mapeo ÚNICO del estado de cobro → clase de status-pill. Antes DUPLICADO inline en
// jobsView/jobDetailView/operariosView (mismos umbrales/colores): Pagado→accepted (verde),
// Parcial→pending (ámbar), Pendiente→draft (neutro). Default draft (defensivo). Regla AB/AB3.
function cobroPillClass(estadoCobro) {
  return { Pagado: 'status-pill-accepted', Parcial: 'status-pill-pending', Pendiente: 'status-pill-draft' }[estadoCobro] || 'status-pill-draft';
}
window.cobroPillClass = cobroPillClass;

// SCRUM-37 · ESTADO DEL PLAN DE TRAMOS — ÚNICA copia en el front de la regla del invariante.
//
// ⚠️ ESTO DUPLICA UNA REGLA DEL SERVIDOR, Y ES A PROPÓSITO. El pro tiene que ver el descuadre
// MIENTRAS edita, no enterarse por un 409 después de guardar; para eso hace falta calcular en
// el navegador. Pero duplicar una regla de dinero es exactamente el patrón que ya ha mordido
// dos veces este mes —`vat_default` pisando el IVA por línea, y el total guardado ganando al
// bruto de las líneas (SCRUM-141)—: dos fuentes que empiezan de acuerdo y se separan sin que
// nadie lo note.
//
// Tres cosas hacen que aquí sea seguro y no una bomba con temporizador:
//   1. **UNA sola copia.** Antes había ya una en `quotesView.js` (`customStagesValid`, SCRUM-27)
//      y el editor de SCRUM-37 iba a ser la segunda. Ahora las dos llaman aquí.
//   2. **Mismas unidades que el servidor**: `percentage` es FRACCIÓN (0,3 = 30 %), y la suma se
//      hace en céntimos con el mismo redondeo. Comparar manzanas con manzanas es lo que permite…
//   3. …un **test DIFERENCIAL** (`tests/scrum37-plan-front-vs-back.test.mjs`): las mismas
//      entradas van a esta función y a `validateCustomBillingPlan`/`validarEdicionPlan` del
//      dominio, y tienen que coincidir. No es un guard que comprueba que aquí «se mencione» a
//      los emitidos: es uno que falla el día que las dos verdades discrepan, que es el fallo real.
//
// El 409 del servidor sigue ahí y sigue mandando. Esto es para que no haga falta llegar a él.
function planTramosEstado(tramos, emitidas) {
  const lista = Array.isArray(tramos) ? tramos : [];
  const yaEmitidos = Number.isFinite(Number(emitidas)) ? Math.max(0, Math.trunc(Number(emitidas))) : 0;

  if (lista.length === 0) {
    return { ok: false, sumaPct: 0, error: 'El plan de cobro debe tener al menos un tramo.' };
  }
  // El plan no puede encoger por debajo de lo ya facturado: esas facturas existen, con su
  // `stageLabel`, y una emitida no se edita ni se borra (regla 29).
  if (lista.length < yaEmitidos) {
    return {
      ok: false,
      sumaPct: 0,
      error: `Ya hay ${yaEmitidos} tramo(s) facturado(s): el plan no puede tener menos.`,
    };
  }

  // OJO CON LAS UNIDADES: `percentage` es FRACCIÓN (0,3 = 30 %), así que `pct * 100` da PUNTOS
  // PORCENTUALES, no céntimos. El servidor llama `sumCents` a esta misma magnitud y compara
  // contra 100; se conserva la aritmética exacta y se le da aquí el nombre que describe lo que
  // es, porque este valor se PINTA en pantalla («Suman 130 %») y equivocarse de unidad ahí es
  // enseñar un número falso al pro. Lo cazó el test diferencial: había puesto `/100`.
  let sumaPuntos = 0;
  for (const t of lista) {
    const label = typeof t?.label === 'string' ? t.label.trim() : '';
    if (!label) return { ok: false, sumaPct: sumaPuntos, error: 'Cada tramo necesita una etiqueta (p. ej. "Anticipo").' };
    const pct = Number(t?.percentage);
    if (!Number.isFinite(pct) || pct <= 0) {
      return { ok: false, sumaPct: sumaPuntos, error: `El tramo "${label}" debe tener un porcentaje mayor que 0.` };
    }
    sumaPuntos += Math.round(pct * 100);
  }
  // La suma cuenta TODOS los tramos, emitidos incluidos. Repartir el 100 % «de lo que queda»
  // es el error natural del pro y es justo lo que hay que delatar en vivo.
  if (sumaPuntos !== 100) {
    return { ok: false, sumaPct: sumaPuntos, error: 'Los tramos deben sumar exactamente el 100 %.' };
  }
  return { ok: true, sumaPct: sumaPuntos, error: '' };
}
window.planTramosEstado = planTramosEstado;

// SCRUM-153: estado de la FACTURA → etiqueta + clase de status-pill CANÓNICA.
//
// Antes esto era un ternario DUPLICADO inline en invoicesView (listado) e invoiceDetailView
// (detalle), y los dos terminaban igual: `: 'PENDIENTE'`. Es decir, **cualquier estado que no
// fuese `paid` ni `expired` se pintaba como PENDIENTE** — así que una factura ANULADA salía en
// pantalla como pendiente de cobro. La ruta de anulación existía y sellaba bien; lo que mentía
// era la pantalla, que es donde el pro toma la decisión de perseguir el cobro.
//
// El fallo real no era el estado que faltaba: era **el `else` que se lo tragaba**. Por eso aquí
// lo desconocido NO cae a «pendiente»: cae a un estado visible y raro (el propio código en
// mayúsculas, con pill neutra), para que un estado nuevo sin mapear se vea en vez de disfrazarse
// del más inocente. Mismo criterio que `cobroPillClass` y `jobStatusMeta`, un paso más lejos.
//
// ANULADA usa la pill `rejected` igual que VENCIDA: las dos dicen «de aquí no viene dinero».
// La ETIQUETA las distingue, que es lo que exige DESIGN.md — el color no es el único canal.
function invoiceStatusMeta(status) {
  const M = {
    paid:     { label: 'PAGADA',    pillClass: 'status-pill-accepted' },
    pending:  { label: 'PENDIENTE', pillClass: 'status-pill-pending' },
    expired:  { label: 'VENCIDA',   pillClass: 'status-pill-rejected' },
    annulled: { label: 'ANULADA',   pillClass: 'status-pill-rejected' },
  };
  return M[status] || { label: String(status || '—').toUpperCase(), pillClass: 'status-pill-draft' };
}
window.invoiceStatusMeta = invoiceStatusMeta;

// SCRUM-31 (F1): estado del TRABAJO (FSM Parte L) → etiqueta + clase de status-pill CANÓNICA.
// Antes hand-styled en JOB_STATE_META (jobsView, deuda SCRUM-11). El color codifica la
// disponibilidad de cobro (verde=terminado→cobrar · ámbar=en curso · neutro=aún no / cerrado);
// la ETIQUETA distingue el estado exacto (el color no es el único canal, DESIGN.md). Sin azul:
// el sistema canónico solo tiene accepted/pending/draft/rejected.
function jobStatusMeta(status) {
  const M = {
    pendiente_agendar: { label: 'Sin agendar', pillClass: 'status-pill-draft' },
    agendado:          { label: 'Agendado',    pillClass: 'status-pill-draft' },
    en_curso:          { label: 'En curso',    pillClass: 'status-pill-pending' },
    terminado:         { label: 'Terminado',   pillClass: 'status-pill-accepted' },
    cerrado:           { label: 'Cerrado',     pillClass: 'status-pill-draft' },
  };
  return M[status] || M.pendiente_agendar;
}
window.jobStatusMeta = jobStatusMeta;

// SCRUM-31 (F3, AB3 aprobado): menú de acciones secundarias (kebab «⋯»). Agrupa elementos de
// acción YA creados (botones/enlaces con sus handlers intactos): 1 primaria visible + el resto
// aquí. Desktop = popover anclado con flip; ≤640px = hoja inferior (reutiliza .modal-overlay/.modal
// como F2). Teclado (↑↓/Home/End/Enter/Esc/Tab), foco al abrir→1.er ítem y al cerrar→trigger,
// cierre por clic-fuera/scroll, uno abierto a la vez. Nunca esconde primaria / Marcar PAGADA / PDF.
let overflowOpenClose = null; // el que esté abierto; se cierra al abrir otro
function overflowMenu(actionEls, { label = 'Más acciones' } = {}) {
  const items = (actionEls || []).filter(Boolean);
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'overflow-trigger btn-ghost btn-sm';
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', label);
  trigger.textContent = '⋯';

  let panel = null, overlay = null;
  // preventScroll: enfocar un ítem NO debe desplazar la página (si lo hace, dispararía onScroll
  // y el popover se cerraría solo al abrir). El popover ya está posicionado junto al trigger.
  function focusItem(i) { const n = items.length; if (n) items[((i % n) + n) % n].focus({ preventScroll: true }); }
  const onDocPointer = (e) => {
    if ((panel && panel.contains(e.target)) || trigger.contains(e.target)) return;
    close(false);
  };
  const onKey = (e) => {
    if (!panel) return;
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(items.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') { close(false); }
  };
  const onScroll = () => close(false);
  function close(restoreFocus) {
    if (!panel && !overlay) return;
    if (overlay) overlay.remove(); else if (panel) panel.remove();
    panel = overlay = null;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDocPointer, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll, true);
    overflowOpenClose = null;
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }
  function open() {
    if (overflowOpenClose) overflowOpenClose();
    const mobile = window.innerWidth <= 640;
    if (mobile) {
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      panel = document.createElement('div');
      panel.className = 'modal overflow-sheet';
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
    } else {
      panel = document.createElement('div');
      panel.className = 'overflow-menu';
      document.body.appendChild(panel);
    }
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-label', label);
    items.forEach((el) => panel.appendChild(el));
    if (!mobile) {
      const r = trigger.getBoundingClientRect();
      panel.style.minWidth = Math.max(180, Math.round(r.width)) + 'px';
      const pw = panel.offsetWidth, ph = panel.offsetHeight;
      const left = Math.max(8, Math.min(r.right - pw, window.innerWidth - pw - 8));
      let top = r.bottom + 6;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6); // flip arriba
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
    }
    trigger.setAttribute('aria-expanded', 'true');
    overflowOpenClose = () => close(false);
    document.addEventListener('pointerdown', onDocPointer, true);
    document.addEventListener('keydown', onKey, true);
    if (!mobile) { window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', onScroll, true); }
    focusItem(0);
  }

  items.forEach((el) => {
    el.setAttribute('role', 'menuitem');
    el.tabIndex = -1;
    el.classList.remove('btn-secondary', 'btn-ghost', 'btn-primary', 'btn-sm');
    el.classList.add('overflow-item');
    el.addEventListener('click', () => close(false)); // activar un ítem cierra el menú
  });
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (trigger.getAttribute('aria-expanded') === 'true') close(true); else open();
  });
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); open(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); open(); focusItem(items.length - 1); }
  });
  return trigger;
}
window.overflowMenu = overflowMenu;

// SCRUM-89: acción vetada por ROL (técnico/operario) — DESHABILITAR CON EXPLICACIÓN, no ocultar
// (que aprenda que el cobro lo hace el admin). El botón queda visible pero disabled; la explicación
// se pone UNA vez por grupo (roleLockedNote), no por botón. La seguridad real la da el 403 del backend.
function lockActionForRole(btn) {
  if (!btn) return btn;
  btn.disabled = true;
  btn.classList.add('role-locked');
  btn.setAttribute('aria-disabled', 'true');
  btn.title = 'Solo para administradores';
  return btn;
}
function roleLockedNote() {
  const p = document.createElement('p');
  p.className = 'role-locked-note';
  p.textContent = 'Esta acción es solo para administradores. Pídeselo a quien gestiona la cuenta.';
  return p;
}
window.lockActionForRole = lockActionForRole;
window.roleLockedNote = roleLockedNote;

// Copy aprobado por el fundador (23-jul, docs/Sprint Scrum/SESION_ACTUAL_SCRUM-69.md) — NO reformular.
// SCRUM-210: vivía dentro de invoicesView.js; se mudó aquí SIN tocar una letra porque ahora lo
// comparten dos superficies — la bandeja de pendientes (SCRUM-69) y el aviso ámbar de plazo
// vencido del semáforo fiscal. Copy aprobado duplicado es copy que acaba divergiendo, y este
// además tiene que ser reproducible desde el AuditLog.
function copyRojo(mesLabel) {
  return `El plazo de este mes venció — ya no se puede agrupar en una recapitulativa de `
    + `${mesLabel}. Puedes facturar estos partes igualmente (factura individual o `
    + `recapitulativa del mes en curso); si tienes dudas, consúltalo con tu asesor.`;
}
window.copyRojo = copyRojo;

// WA-0b · chip de entrega de WhatsApp (J4). Recibe `waDelivery` del detalle
// ({status, templateName, at} | null) y devuelve el HTML del chip, o '' si no hay envío.
// Estados de Meta: sent → delivered → read | failed. Microcopy clara para el merchant.
function waDeliveryChip(waDelivery) {
  if (!waDelivery || !waDelivery.status) return '';
  const map = {
    queued:    { cls: 'wa-chip-sent',      glyph: '🕓', label: 'En cola' },
    sent:      { cls: 'wa-chip-sent',      glyph: '✓',  label: 'Enviado' },
    delivered: { cls: 'wa-chip-delivered', glyph: '✓✓', label: 'Entregado' },
    read:      { cls: 'wa-chip-read',      glyph: '✓✓', label: 'Leído' },
    failed:    { cls: 'wa-chip-failed',    glyph: '⚠',  label: 'No entregado' },
  };
  const m = map[waDelivery.status] || map.sent;
  let when = '';
  if (waDelivery.at) {
    const d = new Date(waDelivery.at);
    if (!isNaN(d)) when = ' · ' + d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
  const title = 'WhatsApp' + (waDelivery.templateName ? ' (' + waDelivery.templateName + ')' : '');
  return `<span class="wa-chip ${m.cls}" title="${title}">`
    + `<span class="wa-chip-glyph">${m.glyph}</span> WhatsApp: ${m.label}${when}</span>`;
}
window.waDeliveryChip = waDeliveryChip;

// -------- Admin – Merchant --------

function getMerchantProfile() {
  // GET /admin/merchant
  return apiRequest("/admin/merchant");
}

function updateMerchantProfile(payload) {
  // PUT /admin/merchant
  return apiRequest("/admin/merchant", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// -------- Admin – Clientes --------

function getCustomers(search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiRequest(`/admin/customers${query}`);
}

function createCustomer(payload) {
  return apiRequest("/admin/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function updateCustomer(id, payload) {
  return apiRequest(`/admin/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// -------- Presupuestos (Quotes) – creación antigua --------

function createQuote(payload) {
  // POST /quote/create
  return apiRequest("/quote/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function acceptQuote(id, payload) {
  // POST /quote/:id/accept
  return apiRequest(`/quote/${id}/accept`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// -------- Admin – Presupuestos (historial + detalle + decisión) --------

// Lista de presupuestos para el BO
async function getQuotesList(search) {
  const params = new URLSearchParams();
  if (search && search.trim() !== "") {
    params.set("search", search.trim());
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/admin/quotes${query}`);
}

// Detalle completo de un presupuesto
async function getQuoteDetailAdmin(id) {
  return apiRequest(`/admin/quotes/${id}`);
}

// Alias para no romper nada si algún sitio llama a getQuoteDetail
async function getQuoteDetail(id) {
  return getQuoteDetailAdmin(id);
}

// Aceptar desde el BO
async function acceptQuoteAdmin(id, payload = {}) {
  return apiRequest(`/admin/quotes/${id}/accept`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Rechazar desde el BO
async function rejectQuoteAdmin(id, payload = {}) {
  return apiRequest(`/admin/quotes/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// -------- Admin – Productos --------

function getProducts(search = "", limit = 20) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("limit", String(limit));
  return apiRequest(`/admin/products?${params.toString()}`);
}
