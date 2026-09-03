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
        <p style="margin:0;font-size:13px;color:var(--muted)">Tus trabajos: los que vienen de un presupuesto aceptado, y los que abres tú.</p>
      </div>
      <div id="jobs-nuevo" style="margin-bottom:14px"></div>
      <div id="jobs-filter" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"></div>
      <div id="jobs-list" style="display:flex;flex-direction:column;gap:12px"></div>
    </div>
  `;
  const list = document.getElementById('jobs-list');
  const filterBar = document.getElementById('jobs-filter');

  // ── SCRUM-651 (T2) · LA PUERTA DEL TRABAJO SIN PRESUPUESTO ──────────────────────────
  //
  // Va ANTES del `return` del estado vacio a proposito: con cero trabajos es justo cuando mas
  // falta hace poder abrir el primero. Si se colgara despues, un merchant nuevo veria una
  // pantalla que le dice que espere a que alguien acepte un presupuesto — y ya no es verdad.
  //
  // El subtitulo y el estado vacio decian que un Trabajo nace de un presupuesto aceptado, y con
  // esta puerta pasaba a ser media verdad: el estado vacio llegaba a contradecir al boton que
  // tiene al lado. Se reporto y el fundador firmo los dos textos el 2-sep-2026 (regla 30).
  const zonaNuevo = document.getElementById('jobs-nuevo');
  if (zonaNuevo && typeof abrirModalTrabajoNuevo === 'function') {
    const bNuevo = document.createElement('button');
    // SCRUM-412: una PRIMARIA nunca es `sm`. Y esta lo es — es la accion que abre el Trabajo,
    // que es la razon de ser de esta pantalla para un merchant que todavia no tiene ninguno.
    bNuevo.className = 'btn-primary';
    bNuevo.id = 'jobs-nuevo-btn';
    bNuevo.textContent = MARCA_651 + ' Trabajo nuevo';
    bNuevo.addEventListener('click', () => abrirModalTrabajoNuevo(() => renderJobsView(container)));
    zonaNuevo.appendChild(bNuevo);

    // Sprint Tecnosel · LA PUERTA A «PARTES POR VALORAR». No va en la barra lateral porque su
    // rótulo no está aprobado y ahí no cabe un marcador (SCRUM-420): cuando el fundador lo firme,
    // se mueve. Mientras, la pantalla es alcanzable — que es lo que la separa de un fichero.
    const bValorar = document.createElement("button");
    bValorar.className = "btn-secondary btn-sm";
    bValorar.id = "jobs-partes-valorar";
    bValorar.style.marginLeft = "8px";
    bValorar.textContent = MARCA_651 + " Partes por valorar";
    bValorar.addEventListener("click", () => {
      if (window.renderAppView) window.renderAppView("partes-oficina");
    });
    zonaNuevo.appendChild(bValorar);
  }

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
      <div class="empty-state-desc">Todavía no tienes ningún trabajo. Se crean solos cuando un cliente acepta un presupuesto, o los abres tú desde aquí.</div>
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
// SCRUM-436 · el formato de la casa, y NO una copia. Este fichero ya usaba `fmtMoneyEs` en cuatro
// sitios (`:188`, `:261`, `:347`, `:356`) cuando SCRUM-428 le añadió este formateador local: la
// misma pantalla imprimía «1000,00 €» en la cabecera del grupo y «1.000,00 €» en las filas de
// debajo. El censo que lo denunció era mío y estaba MAL: sí había un formateador compartido
// (`fmtMoneyEs`, api.js:190, 66 usos), y no lo busqué antes de escribir el quinto.
function eurosJobs(n) {
  return fmtMoneyEs(n);
}

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
    // SCRUM-428 · EL DINERO, EN LA CABECERA DEL GRUPO QUE YA LO NOMBRABA.
    //
    // El rótulo «✅ Terminados — cobra el resto» ya existía y ya decía qué hacer; lo que no decía
    // es CUÁNTO. Ese número es el estado más importante del negocio y hasta hoy había que
    // deducirlo abriendo los Trabajos uno a uno.
    //
    // Se añade con el MISMO patrón que el recuento de al lado (` · valor`), sin una palabra
    // nueva: el importe cuelga del rótulo ya aprobado en vez de estrenar microcopy (regla 30).
    //
    // ⚠️ Se calcula sobre `g.items`, que es lo que el profesional TIENE DELANTE con el filtro de
    // cobro que haya pulsado. Sumar sobre la lista completa daría un total que no corresponde a
    // lo que se ve, y un importe que no cuadra con las filas de debajo no se cree: se ignora.
    const resumen = g.key === 'terminado' && typeof resumenTerminadoSinCobrar === 'function'
      ? resumenTerminadoSinCobrar(g.items)
      : null;
    // EL IMPORTE SE ENSEÑA SIEMPRE, PORQUE AHORA LA LÍNEA DE ABAJO DICE QUÉ QUEDA FUERA.
    //
    // Hasta el 10-ago-2026 la cabecera se CALLABA el importe cuando había terminados sin importe
    // conocido: la suma de los demás es correcta y se lee como el total, y no había una frase
    // aprobada para decir cuántos quedaban fuera. Callarse era entonces lo único que no mentía.
    //
    // Con el texto aprobado (fundador, 10-ago-2026) la decisión se invierte, y por su propio
    // motivo: **con la frase puesta, callarse el importe es contar MENOS de lo que se sabe**. La
    // cifra y su salvedad viajan juntas, que es la única forma en que las dos son verdad.
    const importe = resumen && resumen.cuantos > 0 ? ` · ${eurosJobs(resumen.importe)}` : '';
    sec.innerHTML = `<div style="font-size:12px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em;margin:4px 0 8px">${g.title} · ${g.items.length}${importe}</div>`;

    // 🔴 LA SALVEDAD, PEGADA A LA CIFRA Y NO EN UNA AYUDA QUE NADIE ABRE.
    //
    // Un terminado sin eje de cobro no es un terminado de 0 €: es uno del que no se sabe cuánto
    // falta. Si esta línea desaparece, el importe de arriba vuelve a leerse como si lo contara
    // todo — y entonces el número de arriba tampoco se puede enseñar.
    //
    // ⚠️ TEXTO OFICIAL APROBADO (regla 30, fundador 10-ago-2026). No se reescribe ni se «mejora».
    if (resumen && resumen.sinImporte > 0) {
      const salvedad = document.createElement('div');
      salvedad.style.cssText = 'font-size:12px;color:var(--muted);margin:-4px 0 8px';
      salvedad.textContent =
        `${resumen.sinImporte} sin importe de referencia: no se sabe cuánto falta y no entran en el total.`;
      sec.appendChild(salvedad);
    }

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

// SCRUM-344 · SECCIÓN PROPIA DEL CIERRE — la excepción escrita en la regla 5: lo destructivo vive
// en el «⋮» SALVO los actos irreversibles, que van en su bloque CON SU EXPLICACIÓN. Aquí el riesgo
// no es el clic accidental (esconder), es NO ENTENDER lo que se hace (explicar).
//
// SE AVISA, NO SE IMPIDE (decisión del fundador): cerrar con saldo puede ser legítimo —cobraste por
// fuera, o lo das por perdido—. Impedirlo obligaría a marcar pagado lo que no se pagó para poder
// cerrar, y ensuciar el dato de cobro es peor que el problema que resuelve.
//
// LAS DOS CARAS: sin saldo por facturar la sección solo EXPLICA y cerrar sigue siendo UN clic, sin
// fricción nueva. La condición y el importe salen de `avisoCierreTrabajo` (jobsCierreTrabajo.js),
// que es la única copia de la regla; aquí no se decide nada.
//
// NI UNA PALABRA SUELTA: todo el texto visible sale de `CIERRE_TEXTOS` (regla 30, con guard). Lo
// único que esta función escribe es el IMPORTE, que es un número y no microcopy.
function jobCierreSection(j, patch) {
  const aviso = avisoCierreTrabajo(j);
  const importeFmt = fmtMoneyEs(aviso.importe, aviso.currency);

  const sec = document.createElement('div');
  sec.className = 'job-cierre';
  sec.style.cssText = 'border-top:1px solid var(--neutral-200);padding-top:12px;display:flex;flex-direction:column;gap:8px;align-items:flex-start';

  const titulo = document.createElement('div');
  titulo.style.cssText = 'font-size:12px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em';
  titulo.textContent = textoCierre('titulo', importeFmt);
  sec.appendChild(titulo);

  const explicacion = document.createElement('div');
  explicacion.style.cssText = 'font-size:12.5px;color:var(--muted);line-height:1.5';
  explicacion.textContent = textoCierre('explicacion', importeFmt);
  sec.appendChild(explicacion);

  if (aviso.haySaldoPendiente) {
    // Inventario AB3: `.alert.warning`, componente existente. Cero tokens nuevos.
    // El importe viaja DENTRO de la frase (va en la ranura, no en un elemento aparte): un número
    // suelto al lado de un aviso obliga al usuario a relacionarlos él.
    const banda = document.createElement('div');
    banda.className = 'alert warning';
    banda.style.cssText = 'width:100%;font-size:12.5px';
    banda.textContent = textoCierre('avisoSaldo', importeFmt);
    sec.appendChild(banda);
  }

  const btnCerrar = document.createElement('button');
  btnCerrar.className = 'btn-ghost btn-sm';
  // AB6 · objetivo al pulgar. `btn-sm` se queda en 30 px (styles.css:442) y esta es la acción que
  // no se puede deshacer: la que menos puede pulsarse por error de puntería.
  btnCerrar.style.minHeight = '44px';
  btnCerrar.textContent = textoCierre('boton', importeFmt);
  btnCerrar.addEventListener('click', () => {
    // AVISO, NO BLOQUEO: se puede seguir. Sin saldo no hay confirm — un clic, como siempre.
    if (aviso.haySaldoPendiente && !window.confirm(textoCierre('confirmar', importeFmt))) return;
    patch({ status: 'cerrado' }, '🔒 Trabajo cerrado');
  });
  sec.appendChild(btnCerrar);

  return sec;
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
  // SCRUM-363 · el eje lo decide el BACKEND (`importeReferencia`), no esta vista. Antes era
  // `aceptado > 0`, un segundo criterio: en cuanto el eje puede venir de lo facturado, el mismo
  // Trabajo salía «Pagado» en el detalle y sin chip aquí. El chip se pinta si hay veredicto; la
  // barra necesita además un importe contra el que dibujar el porcentaje.
  const referencia = Number(j.importeReferencia ?? 0);
  const showCobro = !!j.estadoCobro && referencia > 0;
  const pct = showCobro ? Math.min(100, Math.round((cobrado / referencia) * 100)) : 0;
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
    ${showCobro ? progressBar(pct, j.estadoCobro, { cobrado, aceptado: referencia, currency: cur }) : ''}
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
    // SCRUM-366: baja a SECUNDARIO. Es un movimiento de la FSM, no «la siguiente acción»: esa la
    // decide la escalera compartida (abajo) y era la que discrepaba con el detalle.
    addBtn('✅ Marcar terminado', 'btn-secondary btn-sm', () => patch({ status: 'terminado' }, '✅ Trabajo terminado'));
  }

  // ── SCRUM-366 · LA SIGUIENTE ACCIÓN SALE DE LA ESCALERA COMPARTIDA ───────────────────
  //
  // Antes esta tarjeta decidía por su cuenta —`en_curso` → «Marcar terminado»— mientras el
  // detalle consultaba `jobNextAction`. Mismo Trabajo, mismo estado, dos respuestas distintas y
  // nada que avisara. No fue descuido: la escalera vivía DENTRO de `jobDetailView.js` y desde
  // aquí no era nombrable.
  //
  // ⚠️ EL BOTÓN NAVEGA AL DETALLE, no ejecuta. Y es deliberado: duplicar aquí la EJECUCIÓN
  // (collect-rest, enviar-para-firmar, emitir…) reintroduciría exactamente el defecto que este
  // ticket cierra, solo que un nivel más abajo — dos copias del «cómo» en vez de dos del «qué».
  // Un solo ejecutor, en el detalle; la lista dice qué toca y lleva hasta allí.
  // `!isTecnico` es EXACTAMENTE lo que pasa el detalle (`jobDetailView.js`), y las dos lo derivan
  // de `window.appUserRole`. Si una calculara el rol distinto, volverían a discrepar por otro
  // camino — el mismo defecto con otro disfraz.
  const siguiente = typeof jobNextAction === 'function' ? jobNextAction(j, !isTecnico) : null;
  if (siguiente) {
    addBtn(siguiente.label, 'btn-primary btn-sm', () => {
      if (window.renderAppView) window.renderAppView('job-detail', { jobId: j.id });
    });
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
    // SCRUM-344: «Cerrar trabajo» YA NO va suelto en este renglón — ver jobCierreSection, que lo
    // pinta en su propia sección al pie de la tarjeta. Cerrar es el único acto IRREVERSIBLE de la
    // FSM y mata «Cobrar el resto»; eso se explica, no se esconde.
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

  // SCRUM-344: la sección propia del cierre va la ÚLTIMA de la tarjeta — separada del día a día,
  // con su explicación delante. Solo existe cuando la FSM permite cerrar (`terminado → cerrado`).
  if (puedeCerrarTrabajo(j)) card.appendChild(jobCierreSection(j, patch));

  // SCRUM-12: la tarjeta abre el detalle del Trabajo; los controles internos (botones,
  // enlace .ics, datetime de agendar, notas) NO disparan la navegación (guard por target).
  card.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, textarea, select, label')) return;
    if (window.renderAppView) window.renderAppView('jobs-detail', { jobId: j.id });
  });

  return card;
}
