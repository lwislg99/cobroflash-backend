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
// SCRUM-727b: y el de técnico, por el mismo motivo — asignar recarga la lista, y perder el
// filtro justo después de asignar sería devolverle al jefe las 19 filas que acababa de acotar.
let jobsTecnicoFilter = 'all';
// SCRUM-816 · y el TEXTO escrito en el buscador de técnicos, por el mismo motivo: `paint()`
// rehace la barra entera, así que sin esto la caja se vaciaría sola al elegir en el selector.
let jobsTecnicoBusqueda = '';

/**
 * SCRUM-816 · comparar nombres SIN tildes y sin mayúsculas.
 *
 * Buscar «sanchis» tiene que encontrar a «Toni Sanchís». Sin esto, el buscador falla justo con
 * los apellidos españoles, que es donde se usa. No se toma de ningún sitio porque no hay: medido
 * el 7-sep-2026, en `public/dashboard/js/` no existía ni un `normalize('NFD')`.
 */
function sinTildes(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function renderJobsView(container) {
  // SCRUM-727b · sin un solo `style=` en línea: lo que había aquí se ha mudado a la hoja, bajo
  // `.jobs-pantalla`. Los textos no cambian ni una coma (regla 30).
  //
  // ── SCRUM-816 · EL SUBTÍTULO SE BORRA (fundador, 7-sep-2026) ──────────────────────────────
  //
  // Decía «Tus trabajos: los que vienen de un presupuesto aceptado, y los que abres tú», y era la
  // TERCERA vez que esta pantalla se presentaba: migaja «Trabajos» + título «Trabajos» + esa
  // frase. 🔒 La explicación de una pantalla se lee una vez y estorba mil.
  //
  // 🔴 NO SE MUDA AL ESTADO VACÍO, y ésa fue la corrección. El estado vacío YA tiene su texto
  // aprobado (SCRUM-651, fundador 2-sep-2026): «Todavía no tienes ningún trabajo. Se crean solos
  // cuando un cliente acepta un presupuesto, o los abres tú desde aquí.» Mudar el subtítulo allí
  // habría puesto DOS textos aprobados diciendo lo mismo en la misma caja. La explicación ya vive
  // donde hace falta; lo que sobraba era la de arriba.
  container.innerHTML = `
    <div class="jobs-pantalla">
      <div class="customers-card jobs-cabecera">
        <h2>Trabajos</h2>
      </div>
      <div id="jobs-nuevo" class="jobs-nuevo"></div>
      <div id="jobs-filter" class="jobs-filtros"></div>
      <div id="jobs-list" class="jobs-lista"></div>
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
    // SCRUM-769 · rótulo FIRMADO por el fundador el 6-sep-2026: «Trabajo nuevo» → «Nuevo trabajo»,
    // el mismo patrón que las otras listas. Se conserva escrito aquí como RESPALDO —igual que en
    // `quotesListView` y `customersView`— por si la pieza no ha cargado; el que manda es el de
    // `atajoNuevo.TEXTOS` y `etiquetar` lo pisa un renglón más abajo.
    bNuevo.textContent = 'Nuevo trabajo';
    bNuevo.addEventListener('click', () => abrirModalTrabajoNuevo(() => renderJobsView(container)));
    // SCRUM-769 · el atajo «N», por el MISMO mecanismo que las otras cuatro (SCRUM-599): nada se
    // reimplementa aquí. Este botón encaja en el patrón porque ABRE una creación —el modal de
    // Trabajo nuevo— en vez de confirmarla.
    if (window.atajoNuevo) {
      window.atajoNuevo.etiquetar(bNuevo, 'jobs');
      window.atajoNuevo.registrar('jobs', () => bNuevo.click());
    }
    zonaNuevo.appendChild(bNuevo);

    // Sprint Tecnosel · LA PUERTA A «PARTES POR VALORAR». No va en la barra lateral porque su
    // rótulo no está aprobado y ahí no cabe un marcador (SCRUM-420): cuando el fundador lo firme,
    // se mueve. Mientras, la pantalla es alcanzable — que es lo que la separa de un fichero.
    const bValorar = document.createElement("button");
    bValorar.className = "btn-secondary btn-sm";
    bValorar.id = "jobs-partes-valorar";
    bValorar.style.marginLeft = "8px";
    bValorar.textContent = "Partes por valorar";
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

  // SCRUM-727b · el equipo, para que el filtro pueda ofrecer también a quien NO tiene trabajos.
  // Si falla, no se cae la pantalla: el filtro se queda con los técnicos que aparezcan en la
  // lista. Peor filtro, misma lista — nunca al revés.
  let equipo = [];
  try {
    const r = await apiRequest('/admin/team');
    equipo = (Array.isArray(r) ? r : (r && r.miembros) || []).filter((m) => m && m.id != null);
  } catch { equipo = []; }

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

    // ── SCRUM-727b · EL FILTRO POR TÉCNICO ────────────────────────────────────────────────
    //
    // 🔴 Es la razón de ser del ticket: la pregunta del jefe no es «qué trabajos hay», es «qué
    // tiene Miguel esta semana». Hasta hoy no se podía ni formular, porque el nombre del técnico
    // no llegaba a esta pantalla.
    //
    // Las opciones son TODO EL EQUIPO, no solo quien ya tiene trabajos. La primera versión las
    // sacaba de la propia lista y se cayó al medirla: si Nadia no tiene ningún trabajo, Nadia no
    // salía en el desplegable, y entonces «¿qué tiene Nadia esta semana?» no se podía ni
    // preguntar. «Ninguno» también es una respuesta, y hay que poder obtenerla.
    //
    // SUELO: si no hay ni un técnico —ni en el equipo ni asignado en ningún trabajo— el selector
    // no se pinta. Un desplegable con una sola opción no es un filtro: es un adorno que promete
    // lo que no puede dar.
    const tecnicos = tecnicosParaElFiltro(jobs, equipo);
    if (tecnicos.length) {
      const caja = document.createElement('div');
      caja.className = 'jobs-filtro-tecnico';
      const lab = document.createElement('label');
      lab.setAttribute('for', 'jobs-filtro-tecnico-select');
      lab.textContent = 'Técnico';                       // microcopy firmada (4-sep-2026)

      // ── SCRUM-816 · ESCRIBIR PARA BUSCAR, Y **EN CLIENTE** ────────────────────────────────
      //
      // 🔴 EL TICKET PEDÍA COPIAR `nuevaFacturaModal.js` (búsqueda en SERVIDOR, espera de 250 ms)
      // Y ESO AQUÍ ESTÁ MAL. Aquel busca CLIENTES, que son miles y no caben en una respuesta. Los
      // técnicos no: `/admin/team` ya trae el equipo ENTERO en una sola petición, y esta pantalla
      // ya la hace veinte líneas más arriba. Filtrar sobre lo que ya está cargado no gasta ni una
      // petición — y, sobre todo, **no puede tener la carrera** que el propio ticket avisaba (la
      // respuesta lenta de una consulta anterior pisando a la última): no hay segunda consulta
      // que pueda llegar tarde. La trampa no se esquiva: no existe. (Fundador, 7-sep-2026.)
      //
      // 🔴 Y NO LLAMA A `paint()`. La barra se repinta entera en cada `paint`, así que teclear
      // una letra habría destruido este mismo `<input>` y con él el foco: la segunda letra no se
      // podría escribir. Escribir sólo re-pinta LAS OPCIONES del selector.
      const buscador = document.createElement('input');
      buscador.type = 'search';
      buscador.id = 'jobs-filtro-tecnico-buscar';
      buscador.className = 'input jobs-filtro-tecnico-buscar';
      // El MISMO literal firmado que la etiqueta de al lado, a propósito: no se estrena texto
      // para un control que filtra exactamente lo que esa etiqueta ya nombra (regla 30).
      buscador.setAttribute('aria-label', 'Técnico');
      buscador.value = jobsTecnicoBusqueda;

      const sel = document.createElement('select');
      sel.id = 'jobs-filtro-tecnico-select';
      sel.className = 'input';

      // Las opciones, derivadas del texto escrito. Se rehacen enteras en cada tecla.
      const pintarOpciones = () => {
        sel.innerHTML = '';
        const opcion = (valor, texto) => {
          const o = document.createElement('option');
          o.value = valor;
          o.textContent = texto;
          if (String(jobsTecnicoFilter) === String(valor)) o.selected = true;
          sel.appendChild(o);
        };
        opcion('all', 'Todos los técnicos');
        const aguja = sinTildes(jobsTecnicoBusqueda);
        for (const [id, nombre] of tecnicos) {
          // 🔴 EL SELECCIONADO NO SE PUEDE CAER DE LA LISTA. Si el filtro activo es Miguel y se
          // teclea «nad», quitar su opción cambiaría el `value` del selector **sin que nadie haya
          // elegido nada** y la lista de abajo pasaría a enseñar otra cosa. Un buscador que
          // cambia el filtro por escribir es peor que no tenerlo.
          const casa = !aguja || sinTildes(nombre).includes(aguja);
          if (casa || String(jobsTecnicoFilter) === String(id)) opcion(String(id), nombre);
        }
        // «Sin asignar» dice lo MISMO que la celda de la fila, a propósito: el jefe filtra por lo
        // que ve escrito, y dos palabras distintas para la misma cosa le hacen dudar de las dos.
        opcion('sin', 'Sin asignar');
      };
      pintarOpciones();

      buscador.addEventListener('input', () => {
        jobsTecnicoBusqueda = buscador.value;
        pintarOpciones();
      });
      sel.addEventListener('change', () => { jobsTecnicoFilter = sel.value; paint(); });
      caja.appendChild(lab);
      caja.appendChild(buscador);
      caja.appendChild(sel);
      filterBar.appendChild(caja);
    }

    const porCobro = jobsCobroFilter === 'all' ? jobs : jobs.filter((j) => j.estadoCobro === jobsCobroFilter);
    const shown = porCobro.filter((j) => pasaFiltroTecnico(j, jobsTecnicoFilter));
    renderJobRows(list, shown, container, jobs, equipo);
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

/**
 * SCRUM-644 · UN SOLO SITIO por el que el mensaje del servidor puede asomar a la pantalla.
 *
 * El trinquete de SCRUM-644 cuenta los SITIOS que pintan un `.message` crudo, y el techo de este
 * fichero era 2. Con el modal de técnicos habrían sido tres — y **un trinquete solo baja**. En vez
 * de subirlo, los tres caminos pasan por aquí y quedan en UNO.
 *
 * ⚠️ Esto REDUCE la superficie, no la cura: por esta rendija sigue pudiendo salir un identificador
 * del servidor. Lo que cambia es que ahora hay un único punto donde traducirlo el día que se haga,
 * en vez de tres. Traducirlo es otro ticket (el patrón es `mensajeDeErrorProveedor`, SCRUM-644).
 *
 * Los prefijos son los literales que ya usaba esta pantalla: no se estrena microcopy (regla 30).
 */
function avisoDeFallo(prefijo, err) {
  const detalle = (err && err.data && err.data.message) || (err && err.message) || '';
  showToast(detalle ? prefijo + ': ' + detalle : prefijo, 'error');
}

// ══ SCRUM-727b · LA LISTA DE TRABAJOS ES UNA LISTA ═══════════════════════════════════════════
//
// PASO 0, medido y no opinado: Clientes, Presupuestos, Albaranes y Facturas usan las cuatro
// `table-scroll` + `table.table--cards-mobile`. Trabajos usaba CERO de los cuatro patrones — era
// la única pantalla de listado que no era un listado. No se estrena componente: se copia el que
// ya existe, con sus clases de celda (`cell-client`, `cell-amount`, `cell-status`, `cell-date`,
// `cell-actions`), que son las que la hoja convierte en card por debajo de 640 px.
//
// LO QUE NO SE PIERDE POR EL CAMINO, y casi se pierde:
//   · Los GRUPOS siguen. Su cabecera lleva el importe de «Terminados» y su salvedad, que son
//     microcopy aprobada (SCRUM-428, fundador 10-ago-2026). Una tabla admite varios `<tbody>`,
//     así que se agrupa sin dejar de ser una fila por trabajo.
//   · Las TRANSICIONES siguen. `jobDetailView.js` tiene CERO —ni agendar, ni empezar, ni
//     terminar, ni cerrar— y `scheduledAt` no aparece ni una vez en él: esta lista era el único
//     sitio del producto donde se agenda un Trabajo. Sacar el selector de fecha a pelo habría
//     borrado la función. Se van al «⋯» (AB3, el que ya usa el detalle) y «Agendar» abre el
//     modal de la casa.
//
// 🔒 Y ese mismo «⋯» es el candado de la asignación: **una acción que modifica datos no puede
// dispararse con el mismo gesto con el que se navega**. Abrir el Trabajo es un clic en la fila;
// asignar es entrar en el menú y confirmar en un modal. Dos gestos distintos, uno reversible.

/** Nombres de los técnicos de un Trabajo. Vacío ⇒ el rótulo aprobado, nunca una celda en blanco. */
function tecnicosDeTrabajo(j) {
  const lista = Array.isArray(j.asignados) ? j.asignados : [];
  return lista.map((a) => a && a.name).filter(Boolean);
}

/**
 * La celda de técnicos. Aguanta VARIOS sin romper la fila y con CERO dice algo.
 *
 * 🔴 Aquí NO se lee `assignedUserId`, y es lo que decide el ticket: esa columna es el espejo del
 * PRIMER asignado, así que un Trabajo con tres técnicos habría enseñado uno — no incompleto,
 * MINTIENDO con cara de estar bien. El dato bueno es `asignados`, que ahora viaja en el lote.
 */
function celdaTecnicos(j) {
  const td = document.createElement('td');
  td.className = 'cell-tecnicos';
  const nombres = tecnicosDeTrabajo(j);
  if (!nombres.length) {
    td.textContent = 'Sin asignar';           // microcopy firmada (fundador, 4-sep-2026)
    td.className += ' cell-tecnicos-vacio';
    return td;
  }
  // Se pintan TODOS. Envuelven en varias líneas dentro de su celda en vez de recortar: recortar
  // a «Israel…» deja al jefe sin saber si faltan uno o cuatro, que es la pregunta que hace.
  td.textContent = nombres.join(', ');
  td.title = nombres.join(', ');
  return td;
}

/** Lo que dice el resumen del desplegable: los nombres, o el rótulo aprobado con cero. */
function rotuloDeTecnicos(nombres) {
  return nombres.length ? nombres.join(', ') : 'Sin asignar';
}

/**
 * ═══ SCRUM-816 · ASIGNAR TÉCNICO DESDE LA FILA, SIN ROMPER EL CANDADO ════════════════════════
 *
 * 🔒 EL CANDADO DE SCRUM-727, LITERAL: **una acción que modifica datos y se dispara con el mismo
 * gesto con el que se navega es una acción que se va a disparar sin querer. Y el jefe no se
 * entera hasta que el técnico se presenta en una obra que no era la suya.**
 *
 * El candado NO se levanta: se cumple de otra forma. Antes eran dos gestos (abrir el «⋯», y
 * confirmar en un modal); ahora es un control PROPIO dentro de la celda, que se abre y se marca
 * — y el gesto de navegar (clic en la fila) sigue sin poder tocar un dato. Las dos direcciones se
 * prueban CORRIENDO, no razonando, y son dos pruebas distintas:
 *   · el clic en el desplegable asigna y NO navega;
 *   · el clic en la fila navega y NO asigna a nadie.
 *
 * 🔴 Y LA GUARDA DE LA FILA ESTABA ATADA A LA FORMA, NO AL HECHO. Decía
 * `closest('button, a, input, textarea, select, label')`: una lista de ETIQUETAS. Un `<summary>`
 * no está en ella, ni el `<div>` que envuelve las casillas, así que pulsar el hueco entre dos
 * nombres habría navegado al Trabajo en mitad de una asignación. La guarda pasa a preguntar por
 * el HECHO —«¿este clic ha caído dentro de un control de la fila?»— con `[data-fila-no-navega]`,
 * que el control se pone a sí mismo. La lista de etiquetas SE QUEDA: cubre los controles que ya
 * existían y quitarla sería cambiar dos cosas a la vez.
 *
 * ⚠️ SE GUARDA AL MARCAR, y se dice. Con `<details>` no hay «Aceptar» que pulsar, así que cada
 * casilla es una escritura — y si esa escritura falla, **lo que se ve vuelve atrás**: la casilla
 * se desmarca y el resumen recupera el texto anterior. Un desplegable que se queda con el nombre
 * puesto y no lo ha guardado es peor que no tenerlo.
 *
 * ⚠️ LA LISTA SE REFRESCA AL CERRAR, no en cada casilla. Un Trabajo puede llevar tres técnicos:
 * repintar entre marca y marca cerraría el desplegable en la cara del jefe. Al cerrar sí, porque
 * si está filtrando por técnico la fila puede haber dejado de pertenecer al filtro.
 *
 * SUELO: con CERO técnicos asignables no se pinta un desplegable vacío —un control sin opciones
 * es un adorno que promete lo que no puede dar—; se deja la celda de siempre, y el «⋯ → Técnicos»
 * sigue abriendo el modal que lo DICE con todas las letras.
 */
function celdaTecnicosConDesplegable(j, equipo, refrescar) {
  const miembros = (Array.isArray(equipo) ? equipo : []).filter((m) => m && m.id != null);
  if (!miembros.length) return celdaTecnicos(j);

  const td = document.createElement('td');
  td.className = 'cell-tecnicos';

  const menu = document.createElement('details');
  menu.className = 'jobs-tecnicos-menu';
  // 🔒 EL HECHO, no la forma: este subárbol es un control de la fila y lo declara él mismo.
  menu.setAttribute('data-fila-no-navega', '');

  const resumen = document.createElement('summary');
  resumen.className = 'jobs-tecnicos-resumen';

  let nombres = tecnicosDeTrabajo(j);
  const pintarResumen = () => {
    resumen.textContent = rotuloDeTecnicos(nombres);
    resumen.title = rotuloDeTecnicos(nombres);
    resumen.classList.toggle('jobs-tecnicos-resumen-vacio', nombres.length === 0);
  };
  pintarResumen();
  menu.appendChild(resumen);

  const lista = document.createElement('div');
  lista.className = 'jobs-tecnicos-lista';
  const yaAsignados = new Set((Array.isArray(j.asignados) ? j.asignados : []).map((a) => String(a.id)));
  const casillas = [];
  for (const m of miembros) {
    const fila = document.createElement('label');
    fila.className = 'jobs-asignar-fila';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = String(m.id);
    cb.checked = yaAsignados.has(String(m.id));
    const txt = document.createElement('span');
    txt.textContent = m.name || ('#' + m.id);
    fila.appendChild(cb);
    fila.appendChild(txt);
    lista.appendChild(fila);
    casillas.push(cb);
  }
  menu.appendChild(lista);

  let hayCambios = false;
  const marcados = () => casillas.filter((c) => c.checked);
  const nombreDe = (cb) => {
    const m = miembros.find((x) => String(x.id) === cb.value);
    return (m && m.name) || ('#' + cb.value);
  };

  for (const cb of casillas) {
    cb.addEventListener('change', async () => {
      // 🔴 EL ESTADO ANTERIOR SE RECONSTRUYE, NO SE LEE. `change` salta DESPUÉS de que el
      // navegador haya cambiado la casilla, así que `casillas.map((c) => c.checked)` devuelve el
      // estado NUEVO — y revertir con eso dejaba la marca puesta. Lo cazó corriendo
      // `guard:lista-trabajos` con el guardado roto: decía «No se pudo guardar» y se quedaba con
      // el técnico marcado, que es la mitad peligrosa del defecto que este control viene a
      // evitar. La única que ha cambiado es ÉSTA, así que su valor anterior es el contrario.
      const antesMarcados = casillas.map((c) => (c === cb ? !c.checked : c.checked));
      const antesNombres = nombres;
      const ids = marcados().map((c) => Number(c.value));
      const nuevos = marcados().map(nombreDe);

      // Lo que se ve cambia YA: es la respuesta al gesto. Si el guardado falla, vuelve atrás.
      nombres = nuevos;
      pintarResumen();
      casillas.forEach((c) => { c.disabled = true; });
      try {
        await apiRequest(`/admin/jobs/${j.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ assignedUserIds: ids }),
        });
        // LO DICE, y dice QUIÉN queda — no un «guardado» mudo. Los dos literales son los que ya
        // usa el modal del «⋯» desde SCRUM-727b: cero microcopy nueva (regla 30).
        showToast(nuevos.length ? `✓ Técnicos: ${nuevos.join(', ')}` : '✓ Sin asignar');
        // El Trabajo en memoria se pone al día: si no, un repintado posterior resucitaría lo viejo.
        j.asignados = marcados().map((c) => ({ id: Number(c.value), name: nombreDe(c) }));
        hayCambios = true;
      } catch (err) {
        // 🔴 REVERTIR LO QUE SE VE. Sin esto la pantalla afirmaría una asignación que no existe.
        casillas.forEach((c, i) => { c.checked = antesMarcados[i]; });
        nombres = antesNombres;
        pintarResumen();
        avisoDeFallo('No se pudo guardar', err);
      } finally {
        casillas.forEach((c) => { c.disabled = false; });
      }
    });
  }

  menu.addEventListener('toggle', () => {
    if (!menu.open && hayCambios) { hayCambios = false; refrescar(); }
  });

  td.appendChild(menu);
  return td;
}

/**
 * Las opciones del filtro: TODO EL EQUIPO, y no solo quien ya tiene trabajos.
 *
 * 🔴 La primera versión las derivaba de la propia lista, y estaba mal por una razón que salió
 * midiendo: si Nadia no tiene ningún trabajo, Nadia no aparecía, y entonces **«¿qué tiene Nadia
 * esta semana?» no se podía ni preguntar**. Esa es exactamente la pregunta del ticket. Un
 * empleado sin trabajos tiene que poder elegirse y contestar «ninguno», que es una respuesta.
 *
 * Los del equipo se completan con los que aparezcan asignados en la lista aunque el equipo no los
 * traiga (uno dado de baja sigue figurando en trabajos viejos): si no, su fila sería inalcanzable.
 */
function tecnicosParaElFiltro(jobs, miembros) {
  const porId = new Map();
  for (const m of Array.isArray(miembros) ? miembros : []) {
    if (m && m.id != null) porId.set(String(m.id), m.name || ('#' + m.id));
  }
  for (const j of jobs) {
    for (const a of Array.isArray(j.asignados) ? j.asignados : []) {
      if (a && a.id != null && !porId.has(String(a.id))) porId.set(String(a.id), a.name);
    }
  }
  return [...porId.entries()].sort((x, y) => String(x[1]).localeCompare(String(y[1]), 'es'));
}

/** ¿Este Trabajo pasa el filtro de técnico? `all` = todos; `sin` = los que no tiene nadie. */
function pasaFiltroTecnico(j, filtro) {
  if (filtro === 'all') return true;
  const nombres = tecnicosDeTrabajo(j);
  if (filtro === 'sin') return nombres.length === 0;
  return (Array.isArray(j.asignados) ? j.asignados : []).some((a) => a && String(a.id) === String(filtro));
}

function renderJobRows(list, jobs, container, todos, equipo) {
  list.innerHTML = '';

  // 🔴 CONTROL NEGATIVO DEL FILTRO, escrito en el propio camino: si el filtro no encuentra nada,
  // esto enseña VACÍO y lo dice. Un filtro que al no encontrar nada enseña la lista entera es
  // peor que ninguno — el jefe cree que Miguel tiene 19 trabajos.
  if (!jobs.length) {
    const vacio = document.createElement('div');
    vacio.className = 'customers-card jobs-vacio-filtro';
    vacio.textContent = todos && todos.length
      ? 'No hay trabajos con ese filtro.'
      : 'No hay trabajos con ese estado de cobro.';
    list.appendChild(vacio);
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

  const card = document.createElement('div');
  card.className = 'customers-card jobs-card';
  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';
  card.appendChild(scroll);

  const table = document.createElement('table');
  // `table--trabajos` NO es un componente nuevo: es el modificador que le da a la columna de
  // técnicos su hueco en la card de móvil. Sin él habría que cambiar la rejilla COMPARTIDA y se
  // movían las cuatro listas hermanas de golpe.
  table.className = 'table table--cards-mobile table--trabajos';
  scroll.appendChild(table);

  const thead = document.createElement('thead');
  // Los rótulos son los que ya usan las listas hermanas en producción; «Técnicos» lo firmó el
  // fundador el 4-sep-2026 (regla 30, `docs/microcopy/`).
  //
  // ── SCRUM-816 · «ESTADO» Y «FECHA» ERAN LA MISMA PREGUNTA ─────────────────────────────────
  //
  // Se funden en una. Y no es que quepan juntas: es que **contestan lo mismo** —«¿cuándo se hace
  // esto?»—, y separadas se contradecían a media pantalla. FECHA estaba vacía («—») en 11 de 12
  // filas de la captura de producción: una columna que no dice nada el 92% del tiempo gasta ancho
  // y no informa. Y la insignia que iba al lado repetía en una palabra lo que la fecha ya decía.
  //
  // 🔴 LO QUE SE PODÍA PERDER Y NO SE PIERDE. La FSM tiene cinco estados y sólo dos hablan de
  // agenda; «En curso», «Terminado» y «Cerrado» no responden a «cuándo». Pero **cada fila vive
  // bajo una cabecera de grupo que ya los nombra** (🔨 En curso · ✅ Terminados · 🔒 Cerrados), y
  // esas cabeceras llevan microcopy aprobada de SCRUM-428. Así que la fusión no borra el estado:
  // lo deja donde ya estaba dicho, en vez de repetirlo veinte veces.
  //
  // Se retira el `<th>Estado</th>`. No se estrena ni un rótulo: «Fecha» ya estaba.
  thead.innerHTML =
    '<tr><th>Cliente</th><th>Técnicos</th><th style="text-align:right">Importe</th>'
    + '<th>Fecha</th><th>Acciones</th></tr>';
  table.appendChild(thead);

  for (const g of groups) {
    if (!g.items.length) continue;
    const tbody = document.createElement('tbody');
    tbody.className = 'jobs-grupo';

    // La cabecera del grupo, con su importe y su salvedad: microcopy aprobada que NO se toca.
    const resumen = g.key === 'terminado' && typeof resumenTerminadoSinCobrar === 'function'
      ? resumenTerminadoSinCobrar(g.items)
      : null;
    const importe = resumen && resumen.cuantos > 0 ? ` · ${eurosJobs(resumen.importe)}` : '';
    const trTitulo = document.createElement('tr');
    trTitulo.className = 'jobs-grupo-titulo';
    const tdTitulo = document.createElement('td');
    tdTitulo.colSpan = 5;
    tdTitulo.textContent = `${g.title} · ${g.items.length}${importe}`;
    trTitulo.appendChild(tdTitulo);
    tbody.appendChild(trTitulo);

    if (resumen && resumen.sinImporte > 0) {
      const trSalvedad = document.createElement('tr');
      trSalvedad.className = 'jobs-grupo-salvedad';
      const tdSalvedad = document.createElement('td');
      tdSalvedad.colSpan = 5;
      // ⚠️ TEXTO OFICIAL APROBADO (regla 30, fundador 10-ago-2026). Ni se reescribe ni se «mejora».
      tdSalvedad.textContent =
        `${resumen.sinImporte} sin importe de referencia: no se sabe cuánto falta y no entran en el total.`;
      trSalvedad.appendChild(tdSalvedad);
      tbody.appendChild(trSalvedad);
    }

    if (g.collapsed) {
      const tr = document.createElement('tr');
      tr.className = 'jobs-grupo-abrir';
      const td = document.createElement('td');
      td.colSpan = 5;
      const btn = document.createElement('button');
      btn.className = 'btn-ghost btn-sm';
      btn.textContent = `Ver ${g.items.length} cerrado${g.items.length !== 1 ? 's' : ''}`;
      btn.addEventListener('click', () => {
        tr.remove();
        g.items.forEach((j) => tbody.appendChild(jobRow(j, container, equipo)));
      });
      td.appendChild(btn);
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      g.items.forEach((j) => tbody.appendChild(jobRow(j, container, equipo)));
    }
    table.appendChild(tbody);
  }

  list.appendChild(card);
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

// ── SCRUM-823 · `jobsModal` y `abrirAgendar` YA NO VIVEN AQUÍ ────────────────────────────────
//
// Se han mudado VERBATIM a `js/jobAgendar.js` (`abrirAgendarTrabajo`), y el motivo es el defecto
// de SCRUM-366 en espejo: viviendo dentro de esta vista, **el detalle del Trabajo no podía
// nombrarlas** — y por eso esta lista era el único sitio del producto donde se agendaba.
//
// Esta vista las sigue usando por el global, que es como se comparte todo en un panel sin bundler
// (regla 4). No cambia ni un comportamiento: cambia quién más puede alcanzarlas.


/**
 * Asignar técnicos SIN entrar en el Trabajo.
 *
 * 🔒 EL CANDADO. Se llega por el «⋯» y hay que CONFIRMAR: dos gestos deliberados, ninguno de
 * ellos el que abre el Trabajo. Una acción que modifica datos disparada con el gesto de navegar
 * se dispara sin querer, y el jefe no se entera hasta que el técnico aparece en una obra que no
 * era la suya. Y al guardar lo DICE — un cambio silencioso no se puede deshacer si no se ve.
 *
 * SUELO: con cero técnicos asignables no se abre un formulario vacío que no lleva a nada; se
 * dice que no hay a quién asignar.
 */
async function abrirAsignar(j, refrescar) {
  let miembros = [];
  try {
    const r = await apiRequest('/admin/team');
    miembros = (Array.isArray(r) ? r : (r && r.miembros) || []).filter((m) => m && m.id != null);
  } catch {
    showToast('No se pudo cargar el equipo', 'error');
    return;
  }

  const cuerpo = document.createElement('div');
  cuerpo.className = 'jobs-modal-cuerpo';

  if (!miembros.length) {
    const nada = document.createElement('div');
    nada.className = 'jobs-modal-vacio';
    nada.textContent = 'Todavía no tienes a nadie en el equipo a quien asignar este trabajo.';
    cuerpo.appendChild(nada);
    jobsModal('Técnicos', cuerpo, () => {});
    return;
  }

  const yaAsignados = new Set((Array.isArray(j.asignados) ? j.asignados : []).map((a) => String(a.id)));
  const casillas = [];
  for (const m of miembros) {
    const fila = document.createElement('label');
    fila.className = 'jobs-asignar-fila';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = String(m.id);
    cb.checked = yaAsignados.has(String(m.id));
    const txt = document.createElement('span');
    txt.textContent = m.name || ('#' + m.id);
    fila.appendChild(cb);
    fila.appendChild(txt);
    cuerpo.appendChild(fila);
    casillas.push(cb);
  }

  jobsModal('Técnicos', cuerpo, (pie, cerrar) => {
    const okAsignar = document.createElement('button');
    okAsignar.className = 'btn-primary btn-sm';
    okAsignar.textContent = 'Guardar';
    okAsignar.addEventListener('click', async () => {
      const ids = casillas.filter((c) => c.checked).map((c) => Number(c.value));
      okAsignar.disabled = true;
      try {
        await apiRequest(`/admin/jobs/${j.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ assignedUserIds: ids }),
        });
        cerrar();
        // Lo DICE: quién queda asignado, no un «guardado» mudo.
        const nombres = casillas.filter((c) => c.checked)
          .map((c) => (miembros.find((m) => String(m.id) === c.value) || {}).name)
          .filter(Boolean);
        showToast(nombres.length ? `✓ Técnicos: ${nombres.join(', ')}` : '✓ Sin asignar');
        refrescar();
      } catch (err) {
        okAsignar.disabled = false;
        avisoDeFallo('No se pudo guardar', err);
      }
    });
    pie.appendChild(okAsignar);
  });
}

function jobRow(j, container, equipo) {
  const tr = document.createElement('tr');
  tr.className = 'jobs-fila';

  const fecha = j.scheduledAt
    ? new Date(j.scheduledAt).toLocaleString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

  const cobrado = Number(j.totalCobrado || 0);
  const cur = j.quote?.currency || 'EUR';
  const referencia = Number(j.importeReferencia ?? 0);
  const showCobro = !!j.estadoCobro && referencia > 0;
  const isTecnico = window.appUserRole === 'tecnico'; // SCRUM-89: el dinero es admin-only (403)

  const refresh = () => renderJobsView(container);
  const patch = async (body, okMsg) => {
    try {
      await apiRequest(`/admin/jobs/${j.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      if (okMsg) showToast(okMsg);
      refresh();
    } catch (err) {
      if (err?.data?.error === 'invalid_transition') showToast('Ese cambio de estado no está permitido.', 'error');
      else avisoDeFallo('No se pudo guardar', err);
    }
  };

  // ① Cliente
  const tdCliente = document.createElement('td');
  tdCliente.className = 'cell-client';
  tdCliente.textContent = j.customer?.name || 'Cliente';
  tr.appendChild(tdCliente);

  // ② Técnicos — el dato que hasta hoy no llegaba a esta pantalla, y desde SCRUM-816 el control
  // que lo cambia sin salir de la fila. Con cero equipo cae a la celda de siempre (su SUELO).
  tr.appendChild(celdaTecnicosConDesplegable(j, equipo, refresh));

  // ③ Importe y cobrado
  const tdImporte = document.createElement('td');
  tdImporte.className = 'cell-amount';
  if (j.quote) {
    const total = document.createElement('div');
    total.className = 'jobs-importe-total';
    total.textContent = fmtMoneyEs(j.quote.total, j.quote.currency);
    tdImporte.appendChild(total);
  } else {
    tdImporte.appendChild(document.createTextNode('—'));
  }
  if (showCobro) {
    const cob = document.createElement('div');
    cob.className = 'jobs-importe-cobrado';
    cob.textContent = `${fmtMoneyEs(cobrado, cur)} de ${fmtMoneyEs(referencia, cur)}`;
    tdImporte.appendChild(cob);
  }
  tr.appendChild(tdImporte);

  // ── ④ CUÁNDO — la columna que antes eran dos ────────────────────────────────────────────
  //
  // SCRUM-816. Aquí vivían ESTADO y FECHA, una al lado de la otra, contestando lo mismo. Y en la
  // celda de ESTADO se apilaban DOS insignias de dimensiones distintas: una de agenda
  // (`SIN AGENDAR`) y otra de cobro (`PARCIAL`). Apiladas no se leía ninguna.
  //
  // 🔴 EL COBRO NO SE PIERDE, SE DEJA DE REPETIR. Ya estaba dicho dos columnas antes, y mejor:
  // «597,14 € de 1.194,27 €» en la celda de IMPORTE, que es la línea que se pinta justo arriba.
  // La insignia decía lo mismo con una palabra en vez de con las dos cifras. El control de que no
  // se pierde está escrito como test: con eje de cobro, la fila SIGUE diciendo cuánto va cobrado.
  //
  // Con fecha se pinta la fecha; sin ella, «Sin agendar» — el MISMO literal que llevaba la
  // insignia (`JOB_STATE_META`), en el mismo sitio donde antes había un guion que no informaba.
  const tdFecha = document.createElement('td');
  tdFecha.className = 'cell-date';
  if (j.scheduledAt) {
    tdFecha.textContent = fecha;
  } else {
    const pill = document.createElement('span');
    pill.className = 'jobs-estado-pill jobs-estado-pendiente_agendar';
    pill.textContent = JOB_STATE_META.pendiente_agendar.label;
    tdFecha.appendChild(pill);
  }
  tr.appendChild(tdFecha);

  // ⑤ Acción principal + el «⋯»
  const tdAcc = document.createElement('td');
  tdAcc.className = 'cell-actions';
  const caja = document.createElement('div');
  caja.className = 'jobs-acciones';
  tdAcc.appendChild(caja);

  // 🔴 DOS BOTONES CON EL MISMO RÓTULO, uno que navega y otro que cobra. `jobNextAction` devuelve
  // `💰 Cobrar el resto (importe)` para un terminado con saldo — la MISMA cadena que el botón de
  // ejecutar de abajo—, así que la fila sacaba el par y no había forma de saber cuál hacía qué.
  // Se queda el que EJECUTA: el detalle está a un clic en la propia fila.
  const cobraAqui = j.status === 'terminado' && j.remaining && j.remaining.amount > 0;
  const siguiente = typeof jobNextAction === 'function' ? jobNextAction(j, !isTecnico) : null;
  if (siguiente && !cobraAqui) {
    const bSiguiente = document.createElement('button');
    bSiguiente.className = 'btn-primary btn-sm';
    bSiguiente.textContent = siguiente.label;
    // ── SCRUM-823 · «Agendar» SE EJECUTA AQUÍ, no lleva al detalle ─────────────────────────
    //
    // El resto de acciones de la escalera abren el Trabajo, y está bien: firmar, emitir o crear un
    // albarán se hacen mirando el documento. Agendar no: es poner una fecha, y el jefe la pone
    // repartiendo el día sobre la lista entera. Mandarlo al detalle para escribir una fecha y
    // volver es justo el paseo que esta pantalla existe para ahorrar.
    //
    // 🔒 Y NO LEVANTA EL CANDADO DE SCRUM-727: sigue siendo un `<button>` —un gesto distinto del
    // que navega, que es el clic en la fila— y el modal pide fecha y hay que confirmar. Dos gestos
    // deliberados, ninguno de ellos el de abrir el Trabajo.
    if (siguiente.kind === 'agendar' && typeof abrirAgendarTrabajo === 'function') {
      bSiguiente.addEventListener('click', () => abrirAgendarTrabajo(j, patch));
    } else {
      // SCRUM-727 · `jobs-detail`, en plural. En singular el router caía en su `default:` y este
      // botón —el del dinero— dejaba al usuario en Inicio, sin aviso ni traza.
      bSiguiente.addEventListener('click', () => {
        if (window.renderAppView) window.renderAppView('jobs-detail', { jobId: j.id });
      });
    }
    caja.appendChild(bSiguiente);
  }

  if (cobraAqui) {
    const cobrarBtn = document.createElement('button');
    cobrarBtn.className = 'btn-primary btn-sm';
    cobrarBtn.textContent = `💰 Cobrar el resto (${fmtMoneyEs(j.remaining.amount, j.remaining.currency)})`;
    cobrarBtn.addEventListener('click', async (ev) => {
      const b = ev.currentTarget;
      b.disabled = true; b.textContent = 'Enviando…';
      try {
        const r = await apiRequest(`/admin/jobs/${j.id}/collect-rest`, { method: 'POST' });
        const waSent = waCollectRestSent(r.whatsapp);
        showToast(waSent
          ? `💰 Enlace de cobro enviado (${fmtMoneyEs(r.amount, r.currency)})`
          : 'Cobro creado — el WhatsApp falló, reenvíalo desde Cobros', waSent ? 'ok' : 'warn');
        refresh();
      } catch (err) {
        avisoDeFallo('No se pudo generar el cobro', err);
        b.disabled = false;
      }
    });
    caja.appendChild(cobrarBtn);
    if (isTecnico) { lockActionForRole(cobrarBtn); caja.appendChild(roleLockedNote()); }
  }

  // ── El «⋯»: TODO lo que modifica el Trabajo vive aquí ────────────────────────────────────
  const menu = [];
  const opcion = (texto, fn) => {
    const b = document.createElement('button');
    b.className = 'btn-ghost btn-sm';
    b.textContent = texto;
    b.addEventListener('click', fn);
    menu.push(b);
    return b;
  };

  opcion('Técnicos', () => abrirAsignar(j, refresh));

  if (j.status === 'pendiente_agendar' || j.status === 'agendado') {
    // SCRUM-823 · la entrada del «⋯» SE QUEDA, y no es un duplicado del botón nuevo: para un
    // Trabajo `agendado` la primaria es su documento, así que **«Reagendar» sólo existe aquí**.
    // Retirarla habría borrado la única forma de cambiar una fecha ya puesta.
    opcion(j.status === 'agendado' ? 'Reagendar' : 'Agendar', () => abrirAgendarTrabajo(j, patch));
  }
  if (j.status === 'agendado') {
    opcion('▶ Empezar', () => patch({ status: 'en_curso' }));
    const ics = document.createElement('a');
    ics.className = 'btn-ghost btn-sm';
    ics.href = `/admin/jobs/${j.id}/ics`;
    ics.textContent = '📆 Añadir a mi calendario';
    menu.push(ics);
  }
  if (j.status === 'en_curso') {
    opcion('✅ Marcar terminado', () => patch({ status: 'terminado' }, '✅ Trabajo terminado'));
  }
  // Cerrar es el único acto IRREVERSIBLE de la FSM y su explicación no se esconde: se abre en el
  // modal ENTERA, con los textos de `CIERRE_TEXTOS` tal cual (regla 30). Cambia el sitio, no una
  // palabra: aquí el riesgo no es el clic accidental, es no entender lo que se hace.
  if (typeof puedeCerrarTrabajo === 'function' && puedeCerrarTrabajo(j)) {
    opcion('Cerrar trabajo', () => {
      const cuerpo = document.createElement('div');
      cuerpo.className = 'jobs-modal-cuerpo';
      cuerpo.appendChild(jobCierreSection(j, patch));
      jobsModal('Cerrar trabajo', cuerpo, () => {});
    });
  }

  if (menu.length && typeof overflowMenu === 'function') caja.appendChild(overflowMenu(menu));
  tr.appendChild(tdAcc);

  // La fila abre el Trabajo. Los controles de dentro NO disparan la navegación (guard por
  // target, igual que hacía la tarjeta): sin esto, pulsar «Técnicos» te llevaría al detalle.
  //
  // 🔴 SCRUM-816 · LA GUARDA PREGUNTA POR EL HECHO, NO POR LA FORMA. La lista de etiquetas de
  // abajo se queda —cubre los controles que ya existían— pero no basta: el desplegable de
  // técnicos tiene un `<summary>` y un `<div>` que NO son ninguna de esas seis etiquetas, así que
  // pulsar el hueco entre dos nombres habría navegado al Trabajo en mitad de una asignación.
  // `[data-fila-no-navega]` lo declara el propio control, y por eso un control futuro entra solo:
  // 🔒 una lista de etiquetas se satisface dejando de enumerar.
  tr.addEventListener('click', (e) => {
    if (e.target.closest('[data-fila-no-navega]')) return;
    if (e.target.closest('button, a, input, textarea, select, label')) return;
    if (window.renderAppView) window.renderAppView('jobs-detail', { jobId: j.id });
  });

  return tr;
}
