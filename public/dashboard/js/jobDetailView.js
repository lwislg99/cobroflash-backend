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
//
// SCRUM-319 (G4): el RÓTULO se queda aquí —es microcopy— pero la CLASIFICACIÓN se delega en
// `tipoDeFactura` (jobDocsReparto.js). Antes esta función era la única que sabía distinguir un
// justificante de una factura; el reparto habría necesitado su propia copia de esa condición, y
// serían dos sitios decidiendo lo mismo sobre documentos con significados legales distintos.
const JOBDET_DOC_ROTULO = { rectificativa: 'Rectificativa', justificante: 'Justificante', factura: 'Factura' };
function jobDetDocLabel(inv) {
  return JOBDET_DOC_ROTULO[typeof tipoDeFactura === 'function' ? tipoDeFactura(inv) : 'factura'];
}
// SCRUM-14: estado del albarán → copy canónico (brief; regla 30) + pill del inventario AB3.
const JOBDET_ALB_PILL = { borrador: 'status-pill-draft', emitido: 'status-pill-pending', firmado: 'status-pill-accepted' };
function jobDetAlbEstado(e) {
  return e === 'firmado' ? 'Firmado' : e === 'emitido' ? 'Emitido' : 'Borrador';
}
/**
 * SCRUM-318 (G3) · pinta UN bloque del rail a partir de los datos que devuelve su constructor.
 *
 * Aquí no se decide NADA: si un bloque llega, se pinta entero. Toda la lógica de «¿hay dato?» vive
 * en `jobRailBlocks.js`, que es puro y por eso se puede probar sin navegador. Repartir la decisión
 * entre los dos sitios es como se acaba pintando un bloque que el constructor daba por vacío.
 *
 * El rail es de SOLO LECTURA (regla 4 del patrón B2): esta función crea `div`, `span` y `a`, nunca
 * un `input`, un `select` ni un `button`. Hay un guard que lo comprueba, porque es donde más tienta
 * romperlo («ya que está el teléfono, que se pueda cambiar»).
 */
function pintarBloqueRail(bloque) {
  const sec = document.createElement('div');
  sec.className = 'detail-rail-bloque';
  sec.dataset.bloque = bloque.id;

  const h = document.createElement('h3');
  h.className = 'detail-section-title';
  h.textContent = bloque.titulo;
  sec.appendChild(h);

  for (const linea of bloque.lineas || []) {
    const fila = document.createElement('div');
    fila.className = 'detail-rail-linea';

    if (linea.etiqueta) {
      const et = document.createElement('span');
      et.className = 'detail-rail-etiqueta';
      et.textContent = linea.etiqueta;
      fila.appendChild(et);
    }

    // Enlace SOLO si el constructor dio destino. Nada de anclas vacías: un enlace que no lleva a
    // ningún sitio se pulsa igual y parece que falla el móvil, no nosotros.
    let destino = fila;
    if (linea.href) {
      const a = document.createElement('a');
      a.className = 'detail-rail-enlace';
      a.href = linea.href;
      if (/^https?:/i.test(linea.href)) { a.target = '_blank'; a.rel = 'noopener'; }
      fila.appendChild(a);
      destino = a;
    } else if (linea.invoiceId != null) {
      // SCRUM-319 (G4): el justificante de cobro, que baja de la pila al bloque DINERO. Misma
      // navegación que ya usa la ficha de cliente (`appState.invoiceId` + `invoice-detail`), no una
      // inventada para el rail.
      const a = document.createElement('a');
      a.className = 'detail-rail-enlace';
      a.href = '#';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.renderAppView) { window.appState.invoiceId = linea.invoiceId; window.renderAppView('invoice-detail'); }
      });
      fila.appendChild(a);
      destino = a;
    } else if (linea.quoteId != null) {
      // El presupuesto navega DENTRO del dashboard, no sale a una URL.
      const a = document.createElement('a');
      a.className = 'detail-rail-enlace';
      a.href = '#';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.renderAppView) window.renderAppView('quotes-detail', { quoteId: linea.quoteId });
      });
      fila.appendChild(a);
      destino = a;
    }

    const txt = document.createElement('span');
    if (linea.fuerte) txt.className = 'detail-rail-fuerte';
    txt.textContent = (linea.icono ? `${linea.icono} ` : '') + linea.texto;
    destino.appendChild(txt);
    sec.appendChild(fila);
  }

  // El enlace suelto del bloque — hoy solo el mapa de DÓNDE, que no llega a pintarse nunca porque
  // no hay dirección. Va debajo del dato del que sale, y sale del MISMO dato.
  if (bloque.enlace && bloque.enlace.href) {
    const a = document.createElement('a');
    a.className = 'detail-rail-enlace detail-rail-enlace--suelto';
    a.href = bloque.enlace.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = bloque.enlace.texto;
    sec.appendChild(a);
  }
  return sec;
}

/**
 * SCRUM-320 (G5) · pinta «QUÉ FALTA PARA COBRAR».
 *
 * Aquí no se decide nada: los importes y los huecos salen de `jobCobroHuecos.js`, que es puro y por
 * eso se puede probar sin navegador. Esta función solo los coloca.
 *
 * Cada hueco lleva SU enlace en SU línea. No hay una acción principal de sección: elegir una es el
 * trabajo de la cabecera, y hay una sola cabecera.
 */
function pintarQueFaltaParaCobrar(sec, job, fmt, moneda) {
  const i = importesDeCobro(job);
  sec.innerHTML = '<h3 class="detail-section-title">Qué falta para cobrar</h3>';

  const tabla = document.createElement('div');
  tabla.className = 'cobro-lineas';

  const fila = (etiqueta, importe, clase) => {
    const f = document.createElement('div');
    f.className = 'cobro-linea' + (clase ? ' ' + clase : '');
    const e = document.createElement('span');
    e.className = 'cobro-linea__etiqueta';
    e.textContent = etiqueta;
    const v = document.createElement('span');
    v.className = 'cobro-linea__importe';
    v.textContent = fmt(importe, moneda);
    f.append(e, v);
    tabla.appendChild(f);
  };

  fila('Aceptado', i.aceptado);
  // ⚠️ La línea del entregado se OMITE si no se pudo medir. Los albaranes SIN_VALORAR —el modo por
  // DEFECTO— no llevan importe, así que con tres albaranes firmados y sin valorar el número sería
  // «0,00 €»: una afirmación falsa, no un hueco. Ausencia antes que un cero que parece medido.
  if (i.albaranesFirmadosConImporte > 0) fila('Entregado y firmado', i.entregadoFirmado);
  fila('Facturado', i.facturado);
  fila('Cobrado', i.cobrado);
  fila('Te falta por cobrar', i.faltaPorCobrar, 'cobro-linea--total');
  sec.appendChild(tabla);

  // ── LOS HUECOS, cada uno con su enlace ────────────────────────────────────────────────
  const TEXTO_HUECO = {
    'sin-firmar': (h) => `${h.cantidad} ${h.cantidad === 1 ? 'albarán' : 'albaranes'} sin firmar`,
    'sin-facturar': (h) => `${fmt(h.importe, moneda)} entregados sin facturar`,
    'sin-facturar-nada': (h) => `${fmt(h.importe, moneda)} aceptados y sin facturar`,
    // SCRUM-423 · copy APROBADA por el asesor el 10-ago-2026 (regla 30). El formato copia el de
    // los otros cuatro, MEDIDO y no supuesto: número delante, sin mayúscula inicial forzada, sin
    // punto final y sin icono. Singular y plural DE VERDAD —nunca `línea(s)`—, regla dura heredada
    // de C6: cambia el sustantivo, así que se alterna la palabra entera, igual que hace
    // `sin-firmar` con albarán/albaranes.
    //
    // 🔴 UNA SOLA CADENA, y ése es el punto: el número y el motivo por el que puede estar
    // INCOMPLETO no se pueden separar. Si fueran dos nodos, un truncado, un ancho estrecho o un
    // futuro «pinta sólo lo primero» dejarían a alguien leyendo el número a secas — que es
    // precisamente el número que no se puede leer solo. Van pegados por construcción, no por
    // acuerdo. Separador « · », el de la casa (el mismo de «Presupuesto #2 · 24 jun · 853,05 €»),
    // y MISMO PESO VISUAL: ni gris, ni más pequeña, ni entre paréntesis — una salvedad que se ve
    // menos que el número al que corrige no es una salvedad. La coletilla llega FIRMADA desde el
    // servidor (`fraseDeCuenta`, C6): aquí no se escribe copy, sólo se coloca.
    'sin-entregar': (h) => {
      // 🔴 SIN NÚMERO, LA COLETILLA SE PINTA SOLA. «1 línea entregada que no sale del presupuesto»
      // ya es una frase completa y verdadera por sí misma, sale de la misma copy firmada y respeta
      // el registro sustantivo-primero de sus vecinas. Las dos alternativas eran peores: «0 líneas
      // del presupuesto sin entregar · …» es una contradicción en una sola línea, y callar es la
      // pantalla que dice «ya puedes facturar» habiendo entregas que el motor no supo atribuir.
      if (!h.cantidad) return h.fraseSinAtribuir;
      const base = `${h.cantidad} ${h.cantidad === 1 ? 'línea' : 'líneas'} del presupuesto sin entregar`;
      return h.fraseSinAtribuir ? `${base} · ${h.fraseSinAtribuir}` : base;
    },
    'sin-cobrar': (h) => `${fmt(h.importe, moneda)} facturados sin cobrar`,
  };
  const TEXTO_ACCION = {
    'ver-albaranes': 'Ver albaranes',
    'facturar-lo-entregado': 'Facturar lo entregado',
    'facturar-el-trabajo': 'Facturar el trabajo',
    'registrar-cobro': 'Registrar cobro',
  };

  const lista = document.createElement('div');
  lista.className = 'cobro-huecos';
  for (const h of huecosDeCobro(job)) {
    const f = document.createElement('div');
    f.className = 'cobro-hueco';
    f.dataset.hueco = h.id;
    const t = document.createElement('span');
    t.textContent = TEXTO_HUECO[h.id](h);
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'btn-ghost btn-sm';
    a.textContent = TEXTO_ACCION[h.accion];
    // Los tres llevan al sitio donde se resuelve: dentro de esta misma pantalla (albaranes y
    // facturas ya tienen su sección tras G4). Navegar, no ejecutar — ejecutar es de la cabecera y
    // de la fila de cada documento, que ya lo hacen y no se duplica aquí.
    a.addEventListener('click', () => {
      // ⚠️ `facturar-el-trabajo` va a ALBARANES, no a FACTURAS: ese hueco sale precisamente cuando
      // NO hay ninguna factura, así que la sección FACTURAS no está pintada y el enlace no llevaría
      // a ningún sitio. La de albaranes se monta siempre, y es donde se empieza a documentar el
      // trabajo que luego se factura.
      const destino = h.accion === 'registrar-cobro' ? '[data-seccion="facturas"]' : '[data-seccion="albaranes"]';
      const el = document.querySelector(destino);
      if (!el || !el.scrollIntoView) return;
      // AB6: movimiento sobrio y respetando la preferencia del sistema.
      const quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
    });
    f.append(t, a);
    lista.appendChild(f);
  }
  sec.appendChild(lista);
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

// SCRUM-366: `jobNextAction` ya NO vive aquí — se movió VERBATIM a `js/jobNextAction.js` para
// que el listado pueda usar la MISMA escalera. Vivía dentro de este fichero, así que `jobsView.js`
// no podía nombrarla y escribió la suya: mismo Trabajo, dos acciones distintas. El traslado no
// cambió ni un nivel; lo que cambió es que ahora es alcanzable.

// ── SCRUM-304 (C3) · LA COLUMNA «ACCIÓN» DE LA TABLA DE ALBARANES ────────────────────────────
//
// 🔴 UNA SOLA FUENTE DE VERDAD: la primaria sale del REGISTRO DE C2 resuelto con la ley
// (`destinoEfectivo`), nunca de una jerarquía escrita aquí. Dos tablas de acciones para el mismo
// documento es el defecto de SCRUM-240, y esta vez en la capa de interacción.
//
// ⚠️ EL CONTEXTO NO SE COPIA LITERAL DE C2 — y hasta SCRUM-372 ESO ENVENENABA:
// el MISMO derivado de tres valores viajaba con NOMBRE DISTINTO según el endpoint —
// `estadoFacturacion` en el detalle del albarán y `estadoCobro` en el del Trabajo—, siendo la
// MISMA llamada a `estadoCobroAlbaran`. Copiar el contexto de una vista a otra daba `undefined`, y
// `undefined !== 'facturado'` es TRUE: la fila ofrecía «facturar» sobre albaranes ya facturados
// del todo, sin error y sin que nada se pusiera rojo.
//
// YA NO: los cuatro productores serializan `estadoFacturacion`, y `estadoCobro` queda significando
// SOLO el cobro del Trabajo (`Pagado`/`Parcial`/`Pendiente`) — que es otro dato y otro juego de
// valores. Lo vigila `tests/scrum372-un-dato-un-nombre.test.mjs`.
//
// ⚠️ LO QUE EL RENOMBRE **NO** ARREGLA, y por eso queda dicho: leer un campo que el objeto no trae
// sigue dando `undefined`, y `undefined !== 'facturado'` sigue siendo TRUE. Un nombre único quita
// el vector conocido, no la clase entera.
/** Fecha corta para la columna de la tabla: «12 jul». La hora completa vive en el detalle. */
function albFechaCorta(w) {
  return w ? new Date(w).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '';
}

function ctxAlbaranEnFila(alb) {
  return {
    // Tres valores (`sin_facturar` · `parcial` · `facturado`), no un booleano: en una obra por
    // fases `parcial` es lo normal, y aplanarlo escondería que AÚN QUEDA algo que facturar.
    'valorado-con-pendiente': alb.modoValoracion === 'VALORADO' && alb.estadoFacturacion !== 'facturado',
  };
}

/** La acción primaria de este albarán según C2, o `null` si su estado no tiene siguiente paso. */
function primariaDeAlbaran(alb) {
  const registro = (typeof window !== 'undefined' && window.ALBARAN_ACTION_REGISTRY) || [];
  const ctx = ctxAlbaranEnFila(alb);
  return registro.find((a) => window.destinoEfectivo(a, alb.estado, ctx) === 'primaria') || null;
}

/**
 * Destino de UNA acción concreta en la fila, leído del registro de C2.
 *
 * Existe para no reescribir aquí ninguna entrada del registro: copiar los `destinos` de una acción
 * «para consultarlos rápido» es exactamente cómo nacen las dos fuentes de verdad que esta tarea
 * viene a cerrar. Si la acción no está en el registro devuelve `'oculta'`: lo que no está declarado
 * no se pinta.
 */
function destinoEnFila(id, alb) {
  const registro = (typeof window !== 'undefined' && window.ALBARAN_ACTION_REGISTRY) || [];
  const accion = registro.find((a) => a.id === id);
  return accion ? window.destinoEfectivo(accion, alb.estado, ctxAlbaranEnFila(alb)) : 'oculta';
}

// Los rótulos NO se escriben aquí: se leen de `ROTULOS_ALBARAN` (albaranDetailView.js), que ya los
// tiene aprobados. Escribirlos otra vez sería la segunda lista de siempre, y divergirían el día que
// alguien retoque una. `albaranDetailView.js` se carga ANTES que este fichero en `index.html` y hay
// guard de ese orden: si alguien lo cambia, sale rojo en vez de dejar la columna muda.
// MICROCOPY APROBADA por el fundador el 5-ago-2026 (regla 30), los cinco tal cual. Ya no llevan
// `[PENDIENTE microcopy oficial]`, y el guard compara contra el texto aprobado uno a uno.
//
// ⚠️ Y NO ERA SOLO UN RÓTULO: con el marcador, la cabecera medía 29 caracteres de más POR COLUMNA
// y sacaba de pantalla las tres últimas columnas a 390 px. De ahí la regla que salió de aquí —
// CON MARCADOR NO SE JUZGA EL LAYOUT, solo se comprueba que el marcador esté.
const ALB_TABLA_COPY = {
  colNumero: 'Nº',
  colFecha: 'Fecha',
  colEstado: 'Estado',
  colLineas: 'Líneas',
  colAccion: 'Acción',
};

// ── SCRUM-303 (C4) · QUÉ SE ABRE AL PULSAR «NUEVO ALBARÁN», Y POR QUÉ ─────────────────────────
//
// LA MITAD DEL TICKET QUE YA ESTABA HECHA: «se crea vacío y luego se rellena» dejó de ser cierto
// con SCRUM-257 — el albarán nacía YA PRELLENADO, en un solo POST. Medido antes de tocar nada.
// Lo que seguía roto es lo otro: **el documento existía en el instante del clic**, sin que nadie
// lo hubiera mirado y con el número YA QUEMADO. Eso es lo que cierra esta función.
//
// Es PURA a propósito —ni red, ni DOM, ni `await`—: decide qué se abre, y quien llama abre. Así el
// test la ejecuta de verdad sobre los cuatro casos en vez de leer su texto (mismo criterio que
// SCRUM-257(a): un guard de texto pasa en verde con la lógica escrita al revés).
//
// 🔴 EL SUELO, Y ES LA DECISIÓN DEL FUNDADOR DE HOY: «no se pudo LEER el presupuesto» y «el
// presupuesto NO TENÍA líneas» son la misma pantalla vacía y significan cosas OPUESTAS. Se crea
// igualmente en los dos casos —un pro con mala cobertura, de pie y con el cliente delante, NO
// puede quedarse sin poder crear el documento (bloque H)— pero el producto NO MIENTE: cada caso
// dice el suyo. Por eso `motivo` es un código distinto por caso y nunca `null` cuando falta algo.
const ALB_MOTIVO = {
  VALORADO: 'valorado',                       // el backend exige precio; el presupuesto no lo trae
  SIN_PRESUPUESTO: 'sin_presupuesto',         // la vista no trae `quote` (el 409 lo pone el backend)
  ILEGIBLE: 'presupuesto_ilegible',           // se pidió y NO se pudo leer  ← no es lo mismo…
  SIN_LINEAS: 'presupuesto_sin_lineas',       // se leyó y no había nada aprovechable  ← …que esto
};

// REGLA 30 · el microcopy lo aprueba el fundador. Hasta que llegue, cada ranura sale con el
// marcador `[PENDIENTE microcopy oficial]` y su texto detrás — el marcador solo NO valdría aquí,
// porque entonces «ilegible» y «sin líneas» dirían LO MISMO y el suelo de arriba sería decorativo.
// El guard compara contra estas constantes, nunca contra un literal: el día que se aprueben los
// textos, el test sigue verde sin tocarlo (patrón de SCRUM-263).
// 🔴 EL TONO NO ES DECORACIÓN: `styles.css` esconde `.alert` cuando NO lleva modificador de color
// (`.alert:not(.success):not(.ok):not(.error):not(.info):not(.warning) { display: none }`). Un
// aviso con la clase pelada existe en el DOM y NO SE VE — el suelo entero de este ticket quedaría
// verde y mudo, que es justo el defecto que viene a cerrar. Lo cazó la captura AB6, no la suite.
const ALB_AVISO_TONO = {
  valorado: 'info',                    // esperado: lo ha pedido el pro marcando la casilla
  sin_presupuesto: 'info',
  presupuesto_ilegible: 'warning',     // algo ha fallado…
  presupuesto_sin_lineas: 'warning',
  descartadas: 'warning',              // …y algo se ha quedado fuera (SCRUM-271)
};

// MICROCOPY APROBADA por el fundador el 5-ago-2026 (regla 30). Ya NO lleva el marcador
// `[PENDIENTE microcopy oficial]`: los siete textos están decididos y el guard los compara uno a
// uno, así que reescribir uno «que suene mejor» sale rojo. Cambiarlos es cambiar copy aprobada.
const ALB_CREAR_COPY = {
  titulo: 'Nuevo albarán',
  guardar: 'Crear albarán',
  // Singular y plural DE VERDAD: cambian el sustantivo y el verbo, así que se alterna la frase
  // entera (patrón de `exportView.js`). «línea(s)» es abreviatura de programador, y esto lo lee
  // un profesional en obra.
  descartadas: (n) => (n === 1
    ? '1 línea sin cantidad no se ha copiado.'
    : `${n} líneas sin cantidad no se han copiado.`),
  valorado: 'Con precios, las líneas se escriben a mano: el presupuesto no los trae.',
  // «No tiene presupuesto» a secas dejaba dudando si existe y no se ve; la segunda mitad dice qué
  // va a pasar, que es lo que hace falta saber.
  sin_presupuesto: 'Este trabajo no tiene presupuesto, así que empiezas de cero.',
  presupuesto_ilegible: 'No se ha podido leer el presupuesto, así que no se ha rellenado nada. Puedes escribir las líneas a mano.',
  presupuesto_sin_lineas: 'El presupuesto no tiene ninguna línea que se pueda entregar.',
};

function decidirAperturaAlbaran({ modoValoracion, tieneQuote, quoteLeido, lineasQuote }) {
  // VALORADO: `validarLineas` EXIGE precio en todas las líneas y las del presupuesto llegan sin él
  // (decisión del fundador, «sin los precios»), así que prellenar aquí daría un 400 al guardar.
  if (modoValoracion === 'VALORADO') return { lineas: [], descartadas: 0, motivo: ALB_MOTIVO.VALORADO };
  if (!tieneQuote) return { lineas: [], descartadas: 0, motivo: ALB_MOTIVO.SIN_PRESUPUESTO };
  // `quoteLeido === null` es «lo pedí y falló», que NO es «no había líneas». Distinguirlos es el
  // suelo entero de este ticket: confundirlos le diría al pro que el presupuesto estaba vacío.
  if (!quoteLeido) return { lineas: [], descartadas: 0, motivo: ALB_MOTIVO.ILEGIBLE };
  const origen = Array.isArray(lineasQuote) ? lineasQuote : [];
  const lineas = lineasDeQuoteParaAlbaran(origen);
  if (!lineas.length) return { lineas: [], descartadas: origen.length, motivo: ALB_MOTIVO.SIN_LINEAS };
  // Las descartadas se CUENTAN y se avisan: omitir en silencio en un documento que se firma es el
  // defecto de SCRUM-271, y aquí sigue vigente igual que en SCRUM-257.
  return { lineas, descartadas: origen.length - lineas.length, motivo: null };
}

// ── SCRUM-257 · las líneas del presupuesto, convertidas en líneas de albarán ──────────────────
//
// SIN PRECIOS, y no es una preferencia estética: el albarán es COMPROBANTE DE ENTREGA (decisión
// del fundador) y `validarLineas` RECHAZA una línea con precio o IVA en modo SIN_VALORAR. Colar
// `price` aquí no daría un albarán con precios: daría un 400 al crear.
//
// SE COPIA UNA VEZ Y NO SE RE-SINCRONIZA NUNCA. El motivo no es la semántica de «foto»:
// `computeAlbaranContentHash` sella estas líneas como el contenido FIRMADO por el cliente. Volver
// a traerlas del presupuesto no actualizaría una vista — rompería la firma.
//
// Las que no pueden ser línea de albarán se DESCARTAN, porque `validarLineas` rechaza el LOTE
// entero si una sola no vale: colarlas convertiría el prellenado en un error al crear. Quien
// llama compara los dos tamaños para avisar — descartar en silencio en un documento que se firma
// es lo que SCRUM-271 vino a cerrar.
// ── SCRUM-367 · AQUÍ SE ATA CADA LÍNEA A SU ORIGEN ────────────────────────────────────
//
// Éste es el único camino que prellena un albarán desde el presupuesto, así que es el único sitio
// donde el vínculo se puede establecer con certeza — después ya no hay forma de saber de qué línea
// salió cada una salvo cruzando textos, que no es un mecanismo: es una apuesta.
//
// ⚠️ EL ÍNDICE ES EL DE `lines`, NO EL DE `out`. Esta función DESCARTA las líneas que no pueden ser
// línea de albarán, así que las dos listas se desalinean en cuanto se cae una: usar la posición de
// salida ataría la línea 3 del albarán a la 3 del presupuesto cuando en realidad es la 4. Un enlace
// desplazado es peor que ninguno, porque C6 se lo creería y respondería sobre la partida
// equivocada.
function lineasDeQuoteParaAlbaran(lines) {
  if (!Array.isArray(lines)) return [];
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const concepto = typeof l?.concept === 'string' ? l.concept.trim() : '';
    const cantidad = Number(l?.qty);
    if (!concepto || !(cantidad > 0)) continue;
    // `unidad` no viene del presupuesto y el albarán la exige: 'ud' es común, neutro y editable
    // por línea. Vacía dejaría un «—» en el papel que alguien lee en obra.
    out.push({ concepto, cantidad, unidad: 'ud', quoteLineIndex: i });
  }
  return out;
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
  // ── SCRUM-317 (G2) · migas + título, en vez de un botón de volver ────────────────────
  //
  // El subtítulo anterior —«Detalle del trabajo, cobros y documentos.»— desaparece: describía
  // LA PANTALLA, no el trabajo, y eso ya lo dicen las migas. Espacio gastado en decir dónde
  // estás cuando lo que hace falta es decir QUÉ es esto.
  //
  // Las migas dicen `Trabajos ›` (no `Presupuestos ›`), que suena obvio y es exactamente el
  // defecto que este ticket arregla.
  const migas = document.createElement('nav');
  migas.className = 'detail-migas';
  migas.setAttribute('aria-label', 'Migas de navegación');
  const migaTrabajos = document.createElement('button');
  migaTrabajos.type = 'button';
  migaTrabajos.className = 'detail-miga-link';
  migaTrabajos.textContent = 'Trabajos';
  migaTrabajos.addEventListener('click', () => { if (window.renderAppView) window.renderAppView('jobs'); });
  const migaSep = document.createElement('span');
  migaSep.className = 'detail-miga-sep';
  migaSep.setAttribute('aria-hidden', 'true');
  migaSep.textContent = '›';
  const migaActual = document.createElement('span');
  migaActual.className = 'detail-miga-actual';
  migas.appendChild(migaTrabajos);
  migas.appendChild(migaSep);
  migas.appendChild(migaActual);
  headLeft.appendChild(migas);
  const h2 = document.createElement('h2');
  headLeft.appendChild(h2);
  const sub = document.createElement('p');
  sub.className = 'detail-sub';
  headLeft.appendChild(sub);
  // ── SCRUM-316 (G1) · los DOS chips, en la cabecera y juntos ──────────────────────────
  // Estado del TRABAJO y estado de COBRO. Bajaban del bloque de resumen; aquí están donde el
  // patrón los pide, al lado del título.
  //
  // ⚠️ Están juntos y NO son simétricos, y el código no debe sugerir que lo sean: el primero es
  // un estado con tabla de transiciones y auditoría; el segundo es `estadoCobroFor(cobrado,
  // aceptado)`, una división que se recalcula en cada lectura y que no tiene columna en la BD.
  const chips = document.createElement('div');
  chips.className = 'detail-head-chips';
  headLeft.appendChild(chips);
  head.appendChild(headLeft);

  // ── SCRUM-316 (G1) · LA BARRA DE ACCIONES DE LA CABECERA ─────────────────────────────
  //
  // La ley del patrón (B2, SCRUM-283): UNA primaria · máximo DOS secundarias · el resto en «⋮».
  // Se pinta desde `jobActionsRegistry.js`, la MISMA tabla que verifica el guard: nadie la escribe
  // dos veces y una acción que nadie declaró no llega a la cabecera aunque alguien la cree.
  const headRight = document.createElement('div');
  headRight.className = 'detail-head-acciones';
  head.appendChild(headRight);

  const cubosCabecera = { primaria: [], secundaria: [], overflow: [] };
  // Se COLECTA durante el render y se ENSAMBLA al final: así el orden en que cada sección crea su
  // botón no decide el orden de la cabecera — lo decide el registro.
  const enCabecera = (id, el) => {
    if (!el) return;
    const destino = typeof destinoAccionTrabajo === 'function' ? destinoAccionTrabajo(id) : null;
    if (!destino || !cubosCabecera[destino]) return;
    cubosCabecera[destino].push(el);
  };

  const statusBox = document.createElement('div');
  statusBox.className = 'alert';
  statusBox.style.cssText = 'margin:14px 22px 0;display:none';
  page.appendChild(statusBox);
  const setStatus = (type, msg) => {
    statusBox.textContent = msg || '';
    statusBox.className = 'alert' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
    statusBox.style.display = type || msg ? 'block' : 'none';
  };

  // SCRUM-316 (G1): `cuerpo` es la rejilla del patrón — columna principal + rail derecho. El rail
  // solo se añade si G3 le da contenido (ver el final del render); mientras, `body` ocupa el ancho
  // entero y la pantalla se ve exactamente como hoy.
  const cuerpo = document.createElement('div');
  cuerpo.className = 'detail-cuerpo';
  page.appendChild(cuerpo);
  const body = document.createElement('div');
  cuerpo.appendChild(body);
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

  // ── SCRUM-317 (G2) · el Trabajo se llama por su nombre ───────────────────────────────
  //
  // TÍTULO = el CLIENTE, siempre. Es el único dato que no puede faltar (`customerId` es NOT NULL
  // en el modelo) y es como el profesional piensa en el trabajo: «lo de Francisco».
  // SUBTÍTULO = el nombre que le haya puesto el pro + la fecha.
  //
  // ⚠️ EL SEPARADOR SOLO SE PINTA SI HAY ALGO A LOS DOS LADOS. `unirCon` es la única forma de
  // componer estas líneas en esta vista, precisamente para que no exista el camino que produce
  // `Francisco Jiménez · undefined` o un `·` colgando. Filtra vacíos, nulos y espacios: los
  // tres se ven igual de mal y los tres llegan por caminos distintos.
  const unirCon = (sep, ...partes) => partes
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean)
    .join(sep);

  // Fecha NEUTRA, sin «desde el»: el Trabajo tiene CINCO estados y «desde el» suena a abierto
  // en uno `terminado` o `cerrado`. La fecha sola es verdad en los cinco.
  const fechaCorta = (v) => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const nombreCliente = (job.customer?.name || '').trim();
  const nombreTrabajo = (job.titulo || '').trim();
  // SCRUM-424: el valor actual de la dirección de la obra, para el campo de «Datos» y para saber
  // si al salir del campo hay algo que guardar. NO se pinta en la cabecera: eso es el rail.
  const direccionObra = (job.direccion || '').trim();

  h2.textContent = nombreCliente || 'Trabajo';
  sub.textContent = unirCon(' · ', nombreTrabajo, fechaCorta(job.createdAt));
  // Un subtítulo vacío no deja un párrafo en blanco empujando la pantalla.
  sub.style.display = sub.textContent ? '' : 'none';
  migaActual.textContent = unirCon(' · ', nombreCliente, nombreTrabajo);

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
  // SCRUM-318 (G3): el nombre se sigue resolviendo igual, pero se pinta en el rail (bloque
  // RESPONSABLE). En la cabecera competía con el título y con la acción primaria.

  const cur = job.quote?.currency || 'EUR';
  const aceptado = Number(job.totalAceptado || 0);
  const cobrado = Number(job.totalCobrado || 0);
  const pendiente = Math.max(0, aceptado - cobrado);
  const pct = aceptado > 0 ? Math.min(100, Math.round((cobrado / aceptado) * 100)) : 0;
  const cobroCls = cobroPillClass(job.estadoCobro);
  const jobMeta = jobStatusMeta(job.status); // SCRUM-31 (F1): estado del Trabajo, hoy invisible en el detalle
  const isTecnico = window.appUserRole === 'tecnico'; // SCRUM-89: veta de acciones de dinero (admin-only, 403 backend)

  // ── SCRUM-320 (G5) · QUÉ FALTA PARA COBRAR ──────────────────────────────────────────
  //
  // G4 dejó el hueco declarado en `SECCIONES_CUERPO`; aquí se llena. Va la PRIMERA del cuerpo, que
  // es su sitio en el ciclo: qué falta → entregado → facturado.
  //
  // ⚠️ NO TIENE CTA PROPIO. La cabecera contesta «¿cuál es LA siguiente acción?» —una sola, y la
  // elige `jobNextAction`—. Ésta contesta «¿qué falta para cobrar?», que puede tener VARIAS
  // respuestas a la vez. Enumerar huecos no exige elegir uno: cada hueco lleva su propio enlace en
  // su propia línea, así que la escalera no se toca y las dos superficies no pueden contradecirse.
  //
  // Si no hay ningún hueco, la sección NO SE PINTA: no falta nada, y preguntar qué falta cuando no
  // falta nada es ruido (misma regla del hueco que G3 y G4).
  if (typeof seccionCobroVisible === 'function' && seccionCobroVisible(job)) {
    const cobroSec = document.createElement('div');
    cobroSec.className = 'detail-section';
    body.appendChild(cobroSec);
    pintarQueFaltaParaCobrar(cobroSec, job, fmtMoneyEs, cur);
  }

  // ── Resumen: estado de cobro + total + barra + cobrado/pendiente ──
  const sumSec = document.createElement('div');
  sumSec.className = 'detail-section';
  body.appendChild(sumSec);
  // SCRUM-31 (F1) puso aquí el cliente con tap-to-call. SCRUM-318 (G3) lo sube al rail (bloque
  // CLIENTE), donde vive el contexto y donde ya no compite con el dinero por la misma franja.
  const sumRow = document.createElement('div');
  sumRow.className = 'detail-summary';
  sumSec.appendChild(sumRow);
  // SCRUM-31 (F1): estado del TRABAJO + estado de cobro JUNTOS (antes solo se veía el de cobro).
  // SCRUM-316 (G1): los dos chips suben a la CABECERA (`chips`, creado con el título). Aquí ya no
  // se pintan — tenerlos en los dos sitios sería la misma verdad dicha dos veces.
  //
  // ⚠️ CONFLICTO CON SCRUM-363, RESUELTO CONSERVANDO LAS DOS: 363 decide CUÁNDO hay chip de cobro
  // y 316 decide DÓNDE va. Son respuestas a preguntas distintas y ninguna sustituye a la otra —
  // quedarse con la de 316 habría devuelto el «Parcial» falso a la pantalla, en su sitio nuevo.
  chips.innerHTML =
    `<span class="status-pill ${jobMeta.pillClass}">${esc(jobMeta.label)}</span>` +
    // SCRUM-363 · sin eje de cobro NO se pinta chip. Ni «Parcial», ni «Pendiente», ni un hueco
    // gris: un Trabajo sin importe de referencia no admite ninguna afirmación sobre su dinero, y
    // «Parcial» era una afirmación FALSA que además no se podía deshacer nunca (la pestaña
    // «Pagado» no lo enseñaba jamás, así que el pro perseguía un pago que ya tenía).
    (job.estadoCobro ? `<span class="status-pill ${cobroCls}">${esc(job.estadoCobro)}</span>` : '');
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
  // SCRUM-318 (G3): «Cobrado» y «Pendiente» pasan al rail (bloque DINERO). El titular «Total
  // aceptado» se queda AQUÍ, a 2,2 rem: es el momento del dinero (AB1) y meterlo en una columna de
  // 220 px lo encogería. Por eso `Aceptado` no se repite en el rail — ver `bloqueDinero`.

  // ── CTA primario del HÉROE — la SIGUIENTE acción del Trabajo (SCRUM-31 F4). jobNextAction
  // decide CUÁL por la escalera aprobada; aquí SOLO se ejecuta, reutilizando endpoints existentes
  // (collect-rest / send-reminder / enviar-para-firmar / emitir / nuevo albarán). Cero lógica nueva.
  // SCRUM-316 (G1): el CTA es la PRIMARIA del patrón y sube a la cabecera. Quién la ocupa lo sigue
  // decidiendo la escalera, con el mismo criterio y la misma llamada: aquí solo cambia DÓNDE se
  // cuelga. Es la única acción que puede ocupar ese hueco, y por eso el registro declara el slot
  // sin declarar su ocupante.
  const nextAct = jobNextAction(job, !isTecnico);
  if (nextAct) {
    const cta = document.createElement('button');
    // 🔴 SCRUM-380 · SIN `btn-sm`, y el arreglo va POR AQUÍ y no por el CSS.
    //
    // Medido en Chrome a 360 y 390 px: con `btn-sm` este botón salía a **30×124,9 px**. Es la
    // acción que se pulsa de pie, en una obra, con una mano y con guantes — y era el objetivo
    // táctil más pequeño de la pantalla.
    //
    // El primer intento fue subir `.btn-primary.btn-sm` a 44 en móvil, y **chocó con el control
    // negativo de SCRUM-352**: «el bump no debe convertir un `btn-sm` en un botón normal». Ese
    // guard tiene razón y se respeta ENTERO. El defecto no era que `btn-sm` midiera 30: era que
    // **la primaria de una pantalla fuera un `btn-sm`**. Se cambia la clase de ESTE botón y
    // `btn-sm` sigue midiendo 30 para todo lo demás.
    cta.className = 'btn-primary';
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
          // SCRUM-303: este atajo creaba un albarán VACÍO de un POST —sin prellenar siquiera— y con
          // el número ya quemado. Ahora abre la MISMA hoja que el botón de la sección: un solo alta
          // nombrada, para que los dos caminos no vuelvan a divergir (SCRUM-366).
          await abrirAltaAlbaran('SIN_VALORAR');
          cta.disabled = false; cta.textContent = orig; // no se refresca: aún no existe nada
        }
      } catch (err) {
        setStatus('error', 'No se pudo completar la acción: ' + (err?.data?.message || err.message));
        cta.disabled = false;
        cta.textContent = orig;
      }
    });
    enCabecera('cta', cta);
  }

  // ── Datos: cliente, dirección, presupuesto origen (link por quoteNumber) ──
  const infoSec = document.createElement('div');
  infoSec.className = 'detail-section';
  infoSec.innerHTML = '<h3 class="detail-section-title">Datos</h3>';
  const dl = document.createElement('dl');
  dl.className = 'detail-dl';
  // ── SCRUM-318 (G3) · CLIENTE, TELÉFONO y DIRECCIÓN se van al rail ────────────────────
  //
  // Es el defecto entero de este ticket: estaban AQUÍ, debajo de toda la pila de documentos, y
  // son justo lo que se consulta yendo de camino a la obra —a quién llamo y adónde voy—. La pila
  // crece con el trabajo, así que cuanto más avanzado, más lejos quedaba lo que más se mira.
  //
  // Lo que se queda en «Datos» es lo que se EDITA (el nombre del Trabajo): el rail es contexto de
  // solo lectura y un campo editable no puede vivir ahí (regla 4 del patrón B2).
  // `dl` desaparece con ellas — un `<dl>` vacío pintaría «Sin datos.» debajo de un título.

  // ── SCRUM-317 (G2) · aquí el pro le pone NOMBRE al Trabajo ───────────────────────────
  //
  // Va en «Datos» y no en la cabecera a propósito: la cabecera MUESTRA, no edita — meter un
  // campo ahí obligaría a rediseñarla, que es G1. Esto es la puerta mínima para que el nombre
  // se pueda poner; sin ella, `titulo` seguiría siendo un campo que nadie escribe, que es
  // exactamente el estado del que venimos.
  //
  // Se guarda al salir del campo (blur) y solo si CAMBIÓ: un PATCH por cada tecla sería ruido
  // en la red y en el AuditLog.
  const nombreWrap = document.createElement('div');
  nombreWrap.style.cssText = 'margin-top:12px';
  const nombreLabel = document.createElement('label');
  nombreLabel.setAttribute('for', 'job-nombre');
  nombreLabel.style.cssText = 'display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:4px';
  nombreLabel.textContent = 'Nombre del trabajo';
  const nombreInput = document.createElement('input');
  nombreInput.id = 'job-nombre';
  nombreInput.className = 'input';
  nombreInput.type = 'text';
  nombreInput.maxLength = 120; // mismo tope que el backend, para avisar antes de recortar
  nombreInput.placeholder = 'Ej. Reforma baño';
  nombreInput.value = nombreTrabajo;
  nombreInput.style.minHeight = '44px';
  nombreWrap.appendChild(nombreLabel);
  nombreWrap.appendChild(nombreInput);
  infoSec.appendChild(nombreWrap);

  nombreInput.addEventListener('blur', async () => {
    const nuevo = nombreInput.value.trim();
    if (nuevo === nombreTrabajo) return; // nada que guardar
    try {
      await apiRequest(`/admin/jobs/${job.id}`, { method: 'PATCH', body: { titulo: nuevo } });
      refresh(); // la cabecera y las migas se recalculan desde el dato, no a mano
    } catch {
      nombreInput.value = nombreTrabajo; // se deshace lo tecleado: mentir sería peor
      setStatus('error', 'No se pudo guardar el nombre del trabajo.');
    }
  });

  // ── SCRUM-424 (G3) · aquí el pro escribe la DIRECCIÓN DE LA OBRA ─────────────────────
  //
  // Va en «Datos», al lado del nombre, y NO en el rail: el rail es contexto de SOLO LECTURA
  // (patrón B2, regla 4) y su propio guard prohíbe que cree un `input`. Lo que se escribe aquí
  // es lo que el rail pinta enfrente, con su enlace a mapa.
  //
  // Sin este campo, `Job.direccion` seguiría sin escritor y el bloque DÓNDE seguiría siendo
  // código inalcanzable — que es el defecto entero del ticket.
  const dirWrap = document.createElement('div');
  dirWrap.style.cssText = 'margin-top:12px';
  const dirLabel = document.createElement('label');
  dirLabel.setAttribute('for', 'job-direccion');
  dirLabel.style.cssText = 'display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:4px';
  dirLabel.textContent = 'Dirección de la obra';
  const dirInput = document.createElement('input');
  dirInput.id = 'job-direccion';
  dirInput.className = 'input';
  dirInput.type = 'text';
  dirInput.maxLength = 300; // mismo tope que `JOB_DIRECCION_MAX` en el backend
  dirInput.placeholder = 'Ej. Av. Rey Juan Carlos 145, Leganés';
  dirInput.value = direccionObra;
  dirInput.style.minHeight = '44px';
  dirWrap.appendChild(dirLabel);
  dirWrap.appendChild(dirInput);
  infoSec.appendChild(dirWrap);

  dirInput.addEventListener('blur', async () => {
    const nueva = dirInput.value.trim();
    if (nueva === direccionObra) return; // nada que guardar
    try {
      await apiRequest(`/admin/jobs/${job.id}`, { method: 'PATCH', body: { direccion: nueva } });
      refresh(); // el rail se repinta desde el dato: el bloque DÓNDE aparece solo
    } catch (e) {
      dirInput.value = direccionObra; // se deshace lo tecleado: mentir sería peor
      // El 409 de la firma sellada trae su propio motivo y se enseña TAL CUAL: «no se pudo» sin
      // decir por qué obligaría al profesional a adivinar por qué su trabajo es distinto.
      setStatus('error', (e && e.data && e.data.message) || 'No se pudo guardar la dirección de la obra.');
    }
  });
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
  docsSec.dataset.seccion = 'albaranes'; // SCRUM-320: destino del hueco «sin firmar»
  // SCRUM-319 (G4): esta sección ya solo lleva ALBARANES; lo demás salió al rail o a su propio
  // bloque. El rótulo ya existía en el producto: no es microcopy nueva.
  docsSec.innerHTML = '<h3 class="detail-section-title">Albaranes</h3>';
  body.appendChild(docsSec);

  // ── SCRUM-370 · GASTOS DE ESTE TRABAJO ──────────────────────────────────────
  //
  // 🔴 EL DEFECTO NO ERA ESTÉTICO: «+ Añadir gasto» se construyó para el TÉCNICO (SCRUM-135, el
  // alta rápida desde la furgoneta), pero `GET /admin/expenses` es admin-only y su nav está
  // oculto. Metía el gasto, veía el toast, y **no volvía a verlo nunca**. Quien puede crear algo
  // tiene que poder comprobarlo.
  //
  // Se pide a `GET /admin/jobs/:id/gastos`, que hereda el candado del Trabajo (tenencia + la regla
  // de SCRUM-147: un técnico solo ve LOS SUYOS). Por eso NO hace falta comprobar el rol aquí.
  //
  // ⚠️ SIN totales, SIN márgenes y SIN comparar con el presupuesto: eso es rentabilidad por obra y
  // tiene su propio ticket. Y el importe se enseña **tal como está guardado**, sin llamarlo «base»
  // ni «con IVA»: hasta la migración de `Expense` no consta cuál de las dos cosas es, y ponerle
  // nombre sería afirmar algo que no sabemos (SCRUM-403).
  pintarNotasInternas(body, job);

  const gastosSec = document.createElement('div');
  gastosSec.className = 'detail-section';
  gastosSec.dataset.seccion = 'gastos';
  gastosSec.innerHTML = '<h3 class="detail-section-title">Gastos de este trabajo</h3>';
  body.appendChild(gastosSec);
  apiRequest(`/admin/jobs/${job.id}/gastos`)
    .then((r) => {
      const gastos = (r && r.gastos) || [];
      if (!gastos.length) {
        const vacio = document.createElement('p');
        vacio.style.cssText = 'margin:4px 0 0;font-size:13px;color:var(--muted)';
        vacio.textContent = 'Todavía no hay gastos en este trabajo.';
        gastosSec.appendChild(vacio);
        return;
      }
      for (const g of gastos) {
        const fila = document.createElement('div');
        fila.className = 'job-doc-row';
        fila.dataset.gasto = String(g.id);
        const concepto = document.createElement('span');
        concepto.textContent = g.description || g.concepto || '—';
        const importe = document.createElement('strong');
        importe.style.cssText = 'white-space:nowrap';
        importe.textContent = fmtMoneyEs(g.amount, g.currency || cur);
        const cuando = document.createElement('span');
        cuando.style.cssText = 'color:var(--muted);font-size:12px;white-space:nowrap';
        cuando.textContent = albFechaCorta(g.date);
        fila.append(concepto, importe, cuando);
        gastosSec.appendChild(fila);
      }
    })
    // 🔴 El fallo se DICE, y no se confunde con el vacío. Una lista vacía por un 500 y «no hay
    // gastos» se leen IGUAL en pantalla, y una de las dos manda al profesional a meter otra vez
    // algo que ya está guardado — que es justo el daño que este ticket viene a quitar.
    //
    // ⚠️ MICROCOPY: el fundador aprobó el rótulo, los campos y el vacío, no este error. Se usa la
    // FORMA que ya existe en el producto —«No se pudo cargar el albarán» (`albaranDetailView.js`)—
    // en vez de inventar una frase nueva. Señalado para su visto (regla 30).
    .catch(() => {
      const err = document.createElement('p');
      err.style.cssText = 'margin:4px 0 0;font-size:13px;color:var(--muted)';
      err.textContent = 'No se pudieron cargar los gastos.';
      gastosSec.appendChild(err);
    });

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
    // SCRUM-316 (G1): sube a la cabecera como SECUNDARIA. Un gasto no es un documento — estaba
    // en la barra de DOCUMENTOS por inercia, no por diseño. Su guarda (`job.quote?.id != null`)
    // no se toca: si no se crea el botón, no hay secundaria y la cabecera se pinta sin ella.
    enCabecera('btnGasto', gastoBtn);
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
    consolidaCount.textContent = `${consolidaSelected.size} ${consolidaSelected.size === 1 ? 'parte seleccionado' : 'partes seleccionados'}`;
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
      `<p style="margin:0 0 4px;font-size:14px;color:var(--body,#3f4a45)">Has seleccionado ${sel.length} ${sel.length === 1 ? 'parte' : 'partes'} de ${nF} ${nF === 1 ? 'mes' : 'meses distintos'}.</p>` +
      `<p style="margin:0 0 12px;font-size:13px;color:var(--muted)">La ley solo permite agrupar partes del mismo mes en una factura, así que se crearán <strong>${nF} factura${nF > 1 ? 's' : ''}</strong>:</p>` +
      `<ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:var(--ink)">` +
      grupos.map((g) => `<li><strong>${esc(g.label)}</strong> — ${g.count} ${g.count === 1 ? 'parte' : 'partes'} · ${esc(fmtMoneyEs(g.total, cur))}</li>`).join('') +
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
        showToast(`✓ ${res.facturas.length} ${res.facturas.length === 1 ? 'factura creada' : 'facturas creadas'}.`);
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

  // ── SCRUM-303 (C4) · PULSAR AQUÍ YA NO CREA NADA ────────────────────────────────────────────
  //
  // Antes este manejador hacía el POST directamente: el albarán existía —con número— antes de que
  // nadie hubiera visto una línea. Ahora solo LEE el presupuesto y abre la hoja; el POST sale del
  // botón de guardar, dentro del sheet. Si el pro sale, no queda nada: ni documento ni hueco en la
  // serie.
  //
  // Lo que NO cambia (SCRUM-257, criterios cerrados del fundador): el mapeo `lineasDeQuoteParaAlbaran`
  // se reutiliza ENTERO y sin tocarlo, se prellena UNA VEZ y no se re-sincroniza nunca —
  // `computeAlbaranContentHash` sella estas líneas como el contenido firmado—, y el 409
  // `job_without_quote` sigue viviendo en el backend, que es quien manda.
  /**
   * SCRUM-303 · EL ALTA DE UN ALBARÁN, EN UN SOLO SITIO.
   *
   * Hay DOS botones que dan de alta —el «+ Nuevo albarán» de la sección y la siguiente acción
   * `nuevo` de la cabecera— y hasta hoy cada uno lo hacía a su manera: el de la sección prellenaba
   * (SCRUM-257) y el de la cabecera creaba un albarán VACÍO de un POST, sin prellenar nada.
   * Mismo Trabajo, dos altas distintas, y la peor era la del camino más corto.
   *
   * Es exactamente el defecto que SCRUM-366 documentó en este fichero: lo que no se puede nombrar
   * se reescribe distinto. Por eso el alta se nombra UNA vez y los dos botones la llaman.
   */
  async function abrirAltaAlbaran(modoValoracion) {
    const tieneQuote = modoValoracion === 'SIN_VALORAR' && job.quote?.id != null;
    // ⚠️ `quoteLeido` arranca en `true` para el caso en que NI SIQUIERA se pide (VALORADO o sin
    // presupuesto a la vista): ahí no ha fallado ninguna lectura, y decir «ilegible» sería
    // mentir igual que decir «vacío». `decidirAperturaAlbaran` ya corta antes por su motivo.
    let quoteLeido = true;
    let lineasQuote = null;
    if (tieneQuote) {
      // Si el presupuesto no se puede leer se abre IGUALMENTE, con las líneas a mano: quedarse
      // sin prellenado es un incordio; no poder crear el albarán estando en obra es un problema
      // (decisión de SCRUM-257, ratificada por el fundador al decidir el suelo de este ticket).
      // Lo que ya NO se hace es presentarlo como si el presupuesto estuviera vacío.
      const q = await apiRequest(`/admin/quotes/${job.quote.id}`).catch(() => null);
      quoteLeido = !!q;
      lineasQuote = q && Array.isArray(q.lines) ? q.lines : [];
    }
    const decision = decidirAperturaAlbaran({ modoValoracion, tieneQuote, quoteLeido, lineasQuote });
    // Y AQUÍ SE ABRE, NO SE CREA. El POST vive dentro del sheet, en el botón de guardar.
    openAlbCrearSheet(decision, modoValoracion);
  }

  newAlbBtn.addEventListener('click', async () => {
    newAlbBtn.disabled = true;
    const modoValoracion = valoradoCheck.checked ? 'VALORADO' : 'SIN_VALORAR';
    try {
      // SCRUM-257 · el albarán nace PRELLENADO con lo presupuestado, para que el pro tache lo que
      // no ha entregado en vez de teclear la lista entera desde la furgoneta.
      //
      // LAS LÍNEAS SE PIDEN AQUÍ y no vienen en el detalle del Trabajo: ese detalle se carga
      // SIEMPRE, y estas líneas solo hacen falta al crear un albarán. El serializer manda
      // `quote: {id, number, total…}` SIN `lines` —medido—, así que engordarlo habría hecho más
      // pesada la carga de cada día por un botón que se pulsa a veces.
      //
      // ⚠️ SOLO en SIN_VALORAR. En VALORADO el backend EXIGE precio en todas las líneas
      // (`validarLineas`) y las del presupuesto llegan sin él por decisión del fundador («sin los
      // precios»): prellenar ahí daría un 400 al crear. Con precios se rellena a mano, como hoy.
      await abrirAltaAlbaran(modoValoracion);
      newAlbBtn.disabled = false;
    } catch (e) {
      setStatus('error', 'No se pudo crear el albarán: ' + (e?.data?.message || e.message));
      newAlbBtn.disabled = false;
    }
  });

  // SCRUM-31 (F5): el estado vacío ahora es de la LISTA COMPLETA (no solo albaranes) — al final.

  // SCRUM-65: totales orientativos en vivo — MISMA regla de céntimos enteros que el
  // backend (calcAlbaranTotales), para que lo que ve el pro al teclear no desentone
  // ni un céntimo con lo que sale luego en el PDF.

  // Editor de líneas/notas/modo (borrador/emitido). PATCH → version++ en el backend.
  // Inputs creados por DOM (.value directo): sin interpolar valores en HTML.
  // SCRUM-31 (F2): se monta en un BOTTOM-SHEET (openAlbEditorSheet), no inline. La lógica
  // interna (campos, totales, PATCH) NO cambia; solo se parametrizan el CIERRE (onClose) y el
  // DESTINO del error (onError), porque el statusBox de la página queda DETRÁS del overlay.
  // Sin opts → comportamiento inline de antes intacto.
  // SCRUM-303 (C4): `onGuardar` y `textoGuardar` son OPCIONALES y solo los usa la creación. Sin
  // ellos el editor se comporta EXACTAMENTE igual que antes (PATCH sobre un albarán que ya existe),
  // que es lo que mantiene intacta la edición de los albaranes de siempre — incluidos los que hoy
  // están en BORRADOR vacíos y que no se migran ni se borran.

  // SCRUM-31 (F2): abre el editor de líneas en un BOTTOM-SHEET. Reutiliza .modal-overlay/.modal,
  // que en <640px ya es hoja inferior full-width con scroll y slide-from-bottom (styles.css, como
  // customersView). Cada albarán abre su propio sheet. Se monta en document.body para que el
  // position:fixed no dependa de ningún stacking-context de la vista.
  /**
   * SCRUM-170 · HOJA DE «FACTURAR PARTE».
   *
   * Enseña lo SERVIDO, lo ya FACTURADO y lo que queda de cada línea, y deja escribir cuánto se
   * factura ahora. Por defecto propone TODO lo pendiente: el caso normal es cobrar lo que falta,
   * y quien quiera partirlo solo tiene que bajar el número.
   *
   * Los topes viven también en el servidor (`validarPeticionParcial`): esto es comodidad, no
   * seguridad — el importe de una factura no puede depender de lo que valide un navegador.
   */


  /**
   * SCRUM-303 (C4) · LA HOJA DE CREAR, QUE ES LA MISMA HOJA DE EDITAR.
   *
   * 🔴 EL CORAZÓN DEL TICKET: **aquí todavía NO existe ningún albarán**. Se abre con las líneas del
   * presupuesto ya puestas, el pro repasa cantidades, y el POST —el único— sale al GUARDAR. Salir
   * con ×, Esc o Cancelar no crea nada y **no quema número**: hasta hoy el documento existía en el
   * instante del clic, con su `ALB-YYYY-NNN` ya reservado, sin que nadie lo hubiera mirado.
   *
   * Un número quemado no se ve en NINGUNA pantalla: deja un hueco en la serie que solo aparece
   * cuando alguien audita. Por eso ese trozo tiene test propio y no se da por supuesto.
   *
   * Reutiliza `.modal-overlay`/`.modal` y `buildAlbEditor` ENTEROS (inventario AB3): ni componente
   * nuevo ni token nuevo. Lo único que cambia es de dónde sale el guardado.
   */
  function openAlbCrearSheet(decision, modoValoracion) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', ALB_CREAR_COPY.titulo);
    const modal = document.createElement('div');
    modal.className = 'modal';
    // SCRUM-446: la cabecera sale del constructor compartido.
    const header = cabeceraModal({ titulo: ALB_CREAR_COPY.titulo });
    const closeBtn = header.querySelector('.modal-close');

    const errEl = document.createElement('div');
    errEl.className = 'alert error';
    errEl.style.cssText = 'display:none;margin:12px 24px 0';

    // EL AVISO DEL SUELO. `motivo` nunca es null cuando falta algo, así que la pantalla vacía
    // siempre dice POR QUÉ está vacía — «no se pudo leer» y «no tenía líneas» son avisos distintos.
    const avisoEl = document.createElement('div');
    avisoEl.style.cssText = 'margin:12px 24px 0';
    // `descartadas` es una ranura más del aviso: se descartaron líneas del presupuesto y hay que
    // DECIRLO. Callarlo en un documento que alguien firma es el defecto de SCRUM-271.
    const claveAviso = decision.motivo || (decision.descartadas ? 'descartadas' : null);
    if (claveAviso) {
      // El tono es OBLIGATORIO: sin él la hoja de estilos lo esconde y el aviso no existe.
      avisoEl.className = `alert ${ALB_AVISO_TONO[claveAviso]}`;
      avisoEl.textContent = claveAviso === 'descartadas'
        ? ALB_CREAR_COPY.descartadas(decision.descartadas)
        : ALB_CREAR_COPY[claveAviso];
    } else {
      avisoEl.className = 'alert';
      avisoEl.style.display = 'none';
    }

    const bodyEl = document.createElement('div');
    bodyEl.className = 'modal-body';
    modal.append(header, errEl, avisoEl, bodyEl);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const onKey = (e) => { if (e.key === 'Escape') close(); };
    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    // Igual que al editar: el fondo NO cierra, para no perder líneas repasadas sin querer.

    // Albarán DE MENTIRA: sin `id` y sin `numero`, porque todavía no existe ninguno. `estado`
    // 'borrador' es lo que le da sentido al nombre ahora — «lo estoy rellenando», no «lo creé
    // vacío y ya lo llenaré».
    const enBlanco = { estado: 'borrador', modoValoracion, lineas: decision.lineas, notas: '' };

    // ⚠️ AQUÍ NO VIAJA `direccionSugerida`, Y NO ES UN OLVIDO. El contexto sí se pasa —abajo, al
    // cerrar las opciones— pero SIN la sugerencia: es una ayuda de la EDICIÓN de un albarán, no de
    // su creación (decisión del asesor, 6-ago-2026).
    // Consecuencia buscada: al crear en blanco no hay placeholder de lugar de entrega. El
    // `ctx = {}` por defecto de `buildAlbEditor` lo hace inofensivo — `ctx.direccionSugerida` es
    // `undefined`, falsy, y el campo sale vacío en lugar de reventar.
    buildAlbEditor(bodyEl, enBlanco, {
      onClose: close,
      onError: (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; },
      textoGuardar: ALB_CREAR_COPY.guardar,
      onGuardar: async ({ lineas, notas, modoValoracion: modo }) => {
        const cuerpo = lineas.length ? { modoValoracion: modo, lineas, notas } : { modoValoracion: modo, notas };
        await apiRequest(`/admin/jobs/${job.id}/albaranes`, { method: 'POST', body: JSON.stringify(cuerpo) });
        showToast(
          lineas.length
            ? `✓ Albarán creado con ${lineas.length} ${lineas.length === 1 ? 'línea' : 'líneas'}.`
            : '✓ Albarán creado (borrador).',
        );
      },
    }, { cur, refresh, setStatus });
    (bodyEl.querySelector('.input') || closeBtn).focus();
  }

  albaranes.forEach((alb) => {
    // SCRUM-65: indicador de modo + total orientativo (serializeAlbaran ya trae `totales`).
    const albValorado = alb.modoValoracion === 'VALORADO';
    // SCRUM-304 (C3): FILA DE TABLA, no tarjeta. El número lleva al detalle (C2), que es donde
    // viven todas las acciones; aquí solo va la primaria de su estado.
    const nLineas = Array.isArray(alb.lineas) ? alb.lineas.length : 0;
    const item = document.createElement('tr');
    item.innerHTML =
      // `cell-id` ES la ranura del NÚMERO DEL DOCUMENTO, y no es una elección propia: es lo que
      // hacen `invoicesView.js:354` (`tdNumber`) y `quotesListView.js:194` (`tdId`), las otras dos
      // que usan este mismo patrón. La primera versión de aquí lo puso en `cell-client` y metió el
      // CONTEO de líneas en `cell-id` — o sea, una tercera convención para las mismas ranuras.
      //
      // **Se enseña ENTERO**: acortarlo a «0001» dependería de que todas las filas visibles
      // compartan prefijo, que es una coincidencia de los datos de hoy y deja de ser cierta el 1 de
      // enero. El profesional dicta ese número a su gestoría; medio número es un número equivocado.
      `<td class="cell-id">` +
        `<button type="button" class="detail-miga-link jobdet-alb-link">${esc(alb.numero)}</button>` +
        `<div class="jobdet-alb-fotos"></div>` +
      `</td>` +
      // FECHA CORTA, no `docDate`: «12 jul 2026, 11:15» es la hora de consulta, no lo que distingue
      // una entrega de otra. En la card de móvil ocupa el hueco `cell-date`, pequeño y a un lado.
      `<td class="cell-date">${esc(albFechaCorta(alb.fecha))}</td>` +
      // SCRUM-304: el pill y el badge APILAN en móvil (`.jobdet-alb-estado`). Son dos ejes y los
      // dos hacen falta —una celda de Acción vacía es ambigua entre «facturado del todo» y «no
      // facturable por SIN_VALORAR», y el badge es lo único que lo desambigua—, así que crece el
      // alto en vez del ancho.
      `<td class="jobdet-alb-estado cell-status">` +
        `<span class="status-pill ${JOBDET_ALB_PILL[alb.estado] || 'status-pill-draft'}">${jobDetAlbEstado(alb.estado)}</span>` +
        // SCRUM-17/170: «facturado» NO es un estado del documento — es un derivado de TRES valores
        // contra el libro de líneas. Va como badge aparte del pill a propósito: son DOS EJES, y
        // aplanarlos escondería el parcial, que en una obra por fases es el caso normal.
        (alb.estadoFacturacion === 'parcial'
          ? `<span class="job-doc-row__badge">Facturado en parte</span>`
          : (alb.facturado || alb.estadoFacturacion === 'facturado' ? `<span class="job-doc-row__badge">Facturado</span>` : '')) +
        (albValorado ? '' : `<span class="job-doc-row__badge">Sin precios</span>`) +
      `</td>` +
      // LÍNEAS se OCULTA en móvil con `col-hide-mobile`, que es lo que la casa hace con lo
      // informativo que no acciona: `invoicesView.js:392` esconde ahí la Fecha y
      // `quotesListView.js:217` el Método. En la card no hay cabecera, así que un «3» suelto no se
      // lee; en la tabla de escritorio lo rotula su columna. El dato sigue en el detalle.
      `<td class="col-hide-mobile">${nLineas}</td>` +
      `<td class="jobdet-alb-actions cell-actions"></td>`;
    const albBody = item.querySelector('td');
    item.querySelector('.jobdet-alb-link').addEventListener('click', () => {
      if (window.renderAppView) window.renderAppView('albaran-detail', { albaranId: alb.id });
    });
    // SCRUM-17: checkbox de selección (modo consolidación) en albaranes elegibles.
    // SCRUM-170: un albarán a MEDIAS tampoco entra en la consolidación (el backend lo rechaza
    // con `albaran_facturado_parcial`); ofrecer el checkbox sería un botón que solo puede fallar.
    if (alb.estado === 'firmado' && alb.modoValoracion === 'VALORADO' && !alb.facturado && alb.estadoFacturacion !== 'parcial' && alb.estadoFacturacion !== 'facturado') {
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
    docs.push({ when: alb.fecha, el: item, tipo: 'albaran', clave: 'albaran:' + alb.id });
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

    // `pdfBtn` y `fotoBtn` VIVÍAN AQUÍ y se han borrado con sus botones, no dejado «por si acaso»:
    // un constructor de botón que ya no llama nadie es código que se pudre sin que nada lo diga, y
    // el siguiente que lo lea creerá que la fila todavía ofrece esas acciones. Lo que sí se queda
    // es el bloque de miniaturas de arriba: eso es LECTURA, y la fila sigue enseñando las fotos.
    // SCRUM-300 (C5): `direccionSugerida` viaja como UN STRING, no como el `job` entero — el
    // editor necesita un dato, no acceso a media pantalla. Es la precarga del lugar de entrega,
    // y solo como placeholder (ver `buildAlbEditor`).
    const editBtn = () => mkBtn('Editar líneas', () => openAlbEditorSheet(alb, { cur, refresh, setStatus, direccionSugerida: job.direccion || null }));

    // SCRUM-302 (C2) · LA FILA YA NO ES UNA BARRA DE ACCIONES: ES UNA ENTRADA.
    //
    // Emitir, firmar, el PDF, enviar para firmar, enviar por WhatsApp y añadir foto SE HAN IDO a
    // la página del albarán, que las hace de verdad (no las delega). Aquí queda el enlace.
    //
    // ── LO QUE NO SE HA IDO, Y NO ES OLVIDO ────────────────────────────────────────────────
    // «Editar líneas» y «Facturar parte» siguen aquí porque su mecanismo VIVE aquí:
    // `openAlbEditorSheet` y `openFacturarParcialSheet` están anidadas dentro de
    // `renderJobDetailView`, no son globales, y la página solo puede NAVEGAR hasta ellas.
    // Borrarlas de la fila no las movería: las dejaría inalcanzables desde los dos sitios, y los
    // botones de la página pasarían a ser callejones sin salida.
    //
    // Sacarlas es su propio ticket —y el de facturar toca el camino del dinero, así que no se
    // hace de paso (regla 37). Mientras tanto esto NO es una promesa de comentario:
    // `tests/scrum302-sin-callejones.test.mjs` deriva de la página qué acciones navegan hasta
    // aquí y exige que la fila las conserve.
    // ── SCRUM-304 (C3) · UNA SOLA ACCIÓN: LA PRIMARIA DE SU ESTADO, SEGÚN C2 ─────────────────
    //
    // El rótulo sale de `ROTULOS_ALBARAN`, que ya los tiene aprobados. Y el botón NAVEGA al detalle
    // cuando el ejecutor vive allí: es el precedente que el fundador aprobó en SCRUM-366 para la
    // lista de Trabajos —«un solo ejecutor, en el detalle; la lista dice qué toca y lleva hasta
    // allí»—. Duplicar aquí la ejecución sería el mismo defecto un nivel más abajo.
    //
    // ⚠️ SIN PRIMARIA NO SE PINTA NADA. En `firmado` sin nada pendiente, C2 dice que no hay
    // siguiente paso: la celda vacía SIGNIFICA «nada que hacer» y es información. Rellenarla para
    // que la columna «se vea completa» sería inventar un paso que no toca.
    const primaria = primariaDeAlbaran(alb);
    if (primaria) {
      const rotulo = (typeof ROTULOS_ALBARAN !== 'undefined' && ROTULOS_ALBARAN[primaria.id]) || primaria.id;
      if (primaria.id === 'btnFacturar') {
        // El ÚNICO cuyo mecanismo vive aquí (`openFacturarParcialSheet`, anidada en esta vista):
        // éste ejecuta. Es también el puente que `scrum302-sin-callejones` exige conservar.
        const bt = mkBtn(rotulo, () => openFacturarParcialSheet(alb, { refresh, setStatus, customer: job.customer }));
        acts.appendChild(bt);
        // Admin-only como toda emisión (S1): al técnico se le DESHABILITA con explicación, nunca
        // se le esconde (norma de SCRUM-89).
        if (isTecnico) { lockActionForRole(bt); acts.appendChild(roleLockedNote()); }
      } else {
        acts.appendChild(mkBtn(rotulo, () => {
          if (window.renderAppView) window.renderAppView('albaran-detail', { albaranId: alb.id });
        }));
      }
    }

    // ── «Editar líneas»: SOLO en borrador, y esto ARREGLA UNA CONTRADICCIÓN QUE YA EXISTÍA ──────
    //
    // La fila lo pintaba SIEMPRE, mientras el registro de C2 declara
    // `borrador: secundaria · emitido: oculta · firmado: oculta`. O sea que la fila y el registro
    // llevaban discrepando desde antes de esta tarea: la segunda fuente de verdad estaba viva y no
    // la veía nadie, porque solo aparece al CONTRASTAR los dos censos, no al leer cualquiera suelto.
    //
    // Sigue estando en `borrador` —no se puede quitar— porque `openAlbEditorSheet` está anidada en
    // esta vista y el botón del detalle solo NAVEGA hasta aquí (`PUENTES_A_LA_FILA`). Quitarlo
    // dejaría ese botón como callejón sin salida, que es lo que `scrum302-sin-callejones` vigila.
    if (destinoEnFila('btnEditarLineas', alb) !== 'oculta') acts.appendChild(editBtn());
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
            docs.push({
        // El tipo va INLINE a propósito: con una variable de por medio el derivador del guard no
        // puede resolverlo por AST y avisa de un tipo sin sección — que es exactamente su trabajo.
        when, el: item, tipo: tipoDeFactura(inv), clave: tipoDeFactura(inv) + ':' + inv.id,
        // SCRUM-319: a qué factura se ancla si es rectificativa. `rectifiesId` ya existía en el
        // modelo y no llegaba a esta pantalla; ahora sí (serializer, aditivo y de solo lectura).
        rectificaClave: inv.rectifiesId != null ? 'factura:' + inv.rectifiesId : null,
      });
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
    docs.push({ when: job.createdAt, el: item, tipo: 'presupuesto', clave: 'presupuesto:' + job.quote.id });
  }

  // ── SCRUM-319 (G4) · EL REPARTO DE LA PILA ──────────────────────────────────────────
  //
  // Una sola lista por fecha juntaba objetos con ciclos de vida y significados legales distintos.
  // El reparto lo decide `jobDocsReparto.js`, la misma tabla que verifica el guard.
  //
  // El orden CRONOLÓGICO ASCENDENTE se conserva dentro de cada sección: era la única forma de leer
  // el histórico y partirlo no es motivo para perderlo.
  docs.sort((a, b) => new Date(a.when || 0) - new Date(b.when || 0));
  const reparto = repartirDocumentos(docs);

  // ⚠️ NADA SE PIERDE. Un tipo que la tabla no conozca NO se descarta: cae en `desconocidos` y se
  // pinta con el resto. Un documento que desaparece en un reordenamiento es mudo, y es el peor
  // resultado posible de aquella tarea. El guard falla si esta lista no está vacía; la pantalla,
  // aun así, lo enseña — la red y el aviso son dos cosas distintas.
  //
  // SCRUM-304: `enSuSeccion` vivía aquí y SE HA BORRADO con su único llamante (los albaranes, que
  // ahora son tabla), no dejado «por si acaso»: un ayudante que ya no llama nadie es código que se
  // pudre sin que nada lo diga, y el siguiente que lo lea creerá que hay secciones montándose por
  // ahí. Es la misma norma que aplicó C2 al borrar `pdfBtn` y `fotoBtn` de esta misma vista.

  // ALBARANES — su sección, con su acción (`+ Nuevo albarán`, ya en la barra de arriba).
  //
  // SCRUM-304 (C3): TABLA, no lista de tarjetas. Diez albaranes eran diez bloques que había que
  // releer uno a uno porque los botones cambiaban de sitio; ahora son diez líneas con la misma
  // columna de acción. `.table`/`.table-wrap` son del inventario AB3 (ya los usan otras cinco
  // pantallas): ni componente nuevo ni token nuevo.
  //
  // El estado vacío NO se toca: ya existía y sigue siendo el mismo. Una tabla con cabecera y nada
  // debajo es justo lo que el ticket pide evitar, así que la cabecera solo se monta si hay filas.
  const vacioAlb = document.createElement('p');
  vacioAlb.style.cssText = 'margin:6px 0 0;color:var(--muted);font-size:13px';
  vacioAlb.textContent = 'Aún no hay documentos. Crea un albarán por cada visita o entrega.';
  if (!reparto.albaranes.length) {
    docsSec.appendChild(vacioAlb);
  } else {
    // ── SCRUM-304 · EN MÓVIL NO ES UNA TABLA: ES UNA PILA DE CARDS ──────────────────────────
    //
    // El patrón YA EXISTÍA y no había que inventarlo — se descubrió al mirar el resto del producto
    // en vez de seguir quitando columnas. `.table-scroll` + `.table--cards-mobile` (styles.css,
    // A18.1) recompone cada fila como card por debajo de 640 px: la cabecera se oculta, las celdas
    // pasan a bloques de una rejilla y **las acciones ganan `min-height: 44px`**.
    //
    // Se elige ÉSTE y no `.table--stack-mobile` porque es el que usa `albaranesView.js` (C1,
    // SCRUM-301): la lista global del MISMO documento. Dos formas móviles para el mismo albarán
    // según la pantalla sería el defecto de SCRUM-240 en la capa visual.
    const wrap = document.createElement('div');
    wrap.className = 'table-scroll';
    const tabla = document.createElement('table');
    tabla.className = 'table table--cards-mobile';
    tabla.innerHTML =
      `<thead><tr>` +
        `<th>${esc(ALB_TABLA_COPY.colNumero)}</th>` +
        `<th>${esc(ALB_TABLA_COPY.colFecha)}</th>` +
        `<th>${esc(ALB_TABLA_COPY.colEstado)}</th>` +
        `<th class="col-hide-mobile">${esc(ALB_TABLA_COPY.colLineas)}</th>` +
        `<th>${esc(ALB_TABLA_COPY.colAccion)}</th>` +
      `</tr></thead>`;
    const tbody = document.createElement('tbody');
    reparto.albaranes.forEach((d) => tbody.appendChild(d.el));
    tabla.appendChild(tbody);
    wrap.appendChild(tabla);
    docsSec.appendChild(wrap);
  }

  // ── FACTURAS — lo FACTURADO, en su propia sección de la columna principal ────────────
  //
  // Decisión del fundador: ni al rail, ni al bloque DINERO con los justificantes —eso sería el
  // error de B4 en dirección contraria—, ni fuera de la pantalla: que el Trabajo enseñe el ciclo
  // completo (entregado → facturado → cobrado) es el diferencial del producto.
  //
  // ⚠️ LA RECTIFICATIVA CUELGA DE SU ORIGINAL, nunca suelta. Como fila más de una lista ordenada
  // por fecha es legalmente ilegible: no dice a qué factura corrige. Aquí va anidada dentro de la
  // fila de su factura, así que leerlas juntas es la única forma de leerlas.
  const restantes = reparto.facturas.concat(reparto.desconocidos);
  if (restantes.length) {
    const factSec = document.createElement('div');
    factSec.className = 'detail-section';
    factSec.dataset.seccion = 'facturas'; // SCRUM-320: destino del hueco «sin cobrar»
    factSec.innerHTML = '<h3 class="detail-section-title">Facturas</h3>';
    const lista = document.createElement('div');
    lista.className = 'job-doc-list';
    restantes.forEach((d) => {
      lista.appendChild(d.el);
      // Sus rectificativas, justo debajo y sangradas: el vínculo se ve, no se deduce.
      const suyas = reparto.anclada.filter((r) => r.rectificaClave === d.clave);
      if (!suyas.length) return;
      const nido = document.createElement('div');
      nido.className = 'job-doc-rectificativas';
      suyas.forEach((r) => nido.appendChild(r.el));
      lista.appendChild(nido);
    });
    factSec.appendChild(lista);
    body.appendChild(factSec);
  }

  // Los de `rail-presupuesto` y `rail-dinero` NO se pintan aquí: el rail los construye por su
  // cuenta desde `job` (SCRUM-318). Sus filas salen de la pila y sus elementos se descartan — el
  // documento sigue en pantalla, en el rail, y el guard de «nada se pierde» lo comprueba por clave.

  // ── SCRUM-316 (G1) · ENSAMBLADO de la cabecera, en el orden de la ley ────────────────
  // primaria · secundarias · «⋮». El «⋮» reutiliza `overflowMenu` de AB3 (a11y, teclado, hoja
  // inferior en móvil). Si no estuviera cargado, las acciones del overflow se pintan sueltas:
  // perder el menú no puede costar una acción (misma decisión que en factura y en SCRUM-31).
  cubosCabecera.primaria.forEach((b) => headRight.appendChild(b));
  cubosCabecera.secundaria.forEach((b) => headRight.appendChild(b));
  if (cubosCabecera.overflow.length) {
    if (typeof overflowMenu === 'function') headRight.appendChild(overflowMenu(cubosCabecera.overflow));
    else cubosCabecera.overflow.forEach((b) => headRight.appendChild(b));
  }

  // ── SCRUM-318 (G3) · EL RAIL DERECHO, CON SU CONTENIDO ──────────────────────────────
  //
  // G1 dejó la rejilla y los cinco bloques declarados; aquí se llenan. Los constructores viven en
  // `jobRailBlocks.js` y son PUROS: devuelven datos, no DOM. Esta función solo pinta — así el
  // test del enlace a mapa («el href sale del mismo dato que se lee») no necesita navegador.
  //
  // LA REGLA DEL HUECO: un constructor sin dato devuelve `null` y su bloque no existe. Ni «—», ni
  // «Sin datos», ni un título con el cuerpo vacío.
  //
  // ⚠️ HOY «DÓNDE» NO SALE NUNCA: `Job.direccion` es campo propio y nadie lo escribe (medido). Y
  // NO se sustituye por la del cliente —que además no existe en el modelo—: un enlace a mapa que
  // lleva al sitio equivocado es peor que no tenerlo, porque el que no existe no se sigue.
  const bloquesRail = (typeof construirBloquesRail === 'function'
    ? construirBloquesRail(job, { fmtMoney: fmtMoneyEs, fechaCorta, responsableName })
    : []).filter(Boolean);

  if (bloquesRail.length) {
    const rail = document.createElement('aside');
    rail.className = 'detail-rail';
    rail.setAttribute('aria-label', 'Contexto del trabajo');
    for (const b of bloquesRail) rail.appendChild(pintarBloqueRail(b));
    cuerpo.appendChild(rail);
    cuerpo.classList.add('detail-cuerpo--con-rail');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-386 · LAS DOS HOJAS DEL ALBARÁN, FUERA DE `renderJobDetailView`
//
// Vivían ANIDADAS dentro de la vista del Trabajo, y por eso la página del albarán (SCRUM-302)
// no podía hacerlas: solo NAVEGAR hasta ellas. La fila tenía que conservar sus botones para no
// dejar callejones sin salida, que es la deuda que C2 declaró y esto salda.
//
// ⚠️ ES UNA MUDANZA, NO UNA MEJORA. El cuerpo de las tres funciones es el mismo carácter por
// carácter; lo único que cambia son las firmas, porque lo que antes se capturaba del ámbito de
// fuera ahora entra por parámetro. Se recibe DESESTRUCTURADO con los mismos nombres para que el
// cuerpo no se toque — una función que capturaba cuatro cosas y ahora recibe tres no es la
// misma función aunque el diff parezca inocente.
// ═══════════════════════════════════════════════════════════════════════════════════════════

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

function buildAlbEditor(box, alb, { onClose, onError, onGuardar, textoGuardar } = {}, ctx = {}) {
  // SCRUM-386 · lo que antes venía del ámbito de `renderJobDetailView`. Se desestructura con
  // los MISMOS nombres a propósito: así el cuerpo de abajo no cambia ni un carácter, y la
  // mudanza se puede comprobar comparando textos en vez de leyendo.
  const { cur, refresh, setStatus } = ctx;
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
    // ── SCRUM-303 · EL ORIGEN VIAJA CON LA FILA (y sin él, SCRUM-367 se queda en nada) ────────
    //
    // `quoteLineIndex` NO tiene input: no se teclea, se hereda del presupuesto. Pero el guardado
    // reconstruye cada línea **desde los inputs**, así que sin guardarlo en la fila se perdería
    // aquí — exactamente el mismo fallo que SCRUM-367 cerró en `validarLineas`, una capa más
    // arriba. Aquel ticket demostró que el backend lo CONSERVA; nadie comprobó que el front lo
    // MANDE, y no lo hacía: editar un albarán desde esta hoja ya borraba el origen hoy.
    //
    // Es lo que le da de comer a C6 («quedan 3 metros por entregar»). Perderlo no da error: da un
    // albarán que ya no sabe de qué partida salió.
    if (l.quoteLineIndex !== undefined && l.quoteLineIndex !== null && l.quoteLineIndex !== '') {
      r.dataset.quoteLineIndex = String(l.quoteLineIndex);
    }
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

  // ── SCRUM-71 (punto 3) · DICTAR EL PARTE EN OBRA ──────────────────────────────────
  //
  // «He cambiado dos grifos monomando y he estado tres horas» → líneas. El operario dicta
  // con una mano, a pleno sol, con guantes: por eso la revisión va en HOJA INFERIOR (el
  // bottom sheet de AB3/SCRUM-31 F2, que `.modal-overlay .modal` ya da por debajo de 640 px)
  // y NO en un modal de escritorio con checkboxes pequeños.
  //
  // «LA VOZ PROPONE, EL HUMANO CORRIGE», y aquí se lleva más lejos que en presupuestos: las
  // líneas aceptadas **caen en las filas de arriba**, que ya son editables y no se guardan
  // hasta que el pro pulse guardar. No hay una pantalla paralela que «confirme» nada — se
  // aterriza en el formulario que ya conoce. Un presupuesto se rehace; un albarán lo firma
  // el cliente y desde `emitido` se congela, así que la última palabra tiene que ser suya.
  //
  // GATE doble: el flag PROPIO del albarán (`VOICE_ALBARAN_ENABLED`, servido por /admin/me) y
  // el `voiceSupportProbe()` de VZ-1 — si el navegador no vale, el micro NO se pinta y queda
  // el formulario de siempre. Degradación silenciosa: jamás un botón roto.
  // Escape local, y aquí NO es defensa de manual: el concepto viene de un MODELO DE
  // LENGUAJE a partir de lo que alguien dictó. Es la entrada menos controlada de toda la
  // pantalla, va a `innerHTML`, y no se depende de ningún helper global que cargue en otro
  // fichero (la lección de SCRUM-153c: una dependencia invisible cuyo fallo es inyección).
  const escVoz = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const vozDisponible = window.appVoiceAlbaranEnabled === true
    && typeof voiceSupportProbe === 'function' && voiceSupportProbe()
    && typeof attachVoiceInput === 'function';

  if (vozDisponible) {
    const btnDictar = document.createElement('button');
    btnDictar.type = 'button';
    btnDictar.className = 'btn-secondary btn-sm';
    btnDictar.style.cssText = 'margin-left:8px;min-height:44px'; // target al pulgar (AB6)
    btnDictar.textContent = '🎤 Dictar el parte';
    btnDictar.addEventListener('click', () => abrirHojaDictado());
    box.appendChild(btnDictar);

    function abrirHojaDictado() {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="max-width:520px" role="dialog" aria-modal="true" aria-labelledby="voz-t">
          <div class="modal-body">
            <p style="font-size:13px;color:var(--muted);margin:0 0 10px">
              Cuenta lo que has hecho, como se lo contarías a un compañero. Luego lo repasas.
            </p>
            <textarea id="voz-txt" rows="4" class="input" style="width:100%;resize:vertical"
              placeholder="Ej: he cambiado dos grifos monomando y he estado tres horas"></textarea>
            <button class="btn-primary" id="voz-gen" style="width:100%;margin-top:10px;min-height:44px">
              Convertir en líneas
            </button>
            <div class="alert" id="voz-err" style="display:none;margin-top:10px"></div>
            <div id="voz-res" style="margin-top:12px"></div>
          </div>
        </div>`;
      // SCRUM-446: la cabecera sale del constructor compartido.
      overlay.querySelector('.modal').prepend(cabeceraModal({ titulo: "🎤 Dictar el parte", idTitulo: "voz-t", idCierre: "voz-x" }));
      document.body.appendChild(overlay);

      const cerrar = () => overlay.remove();
      overlay.querySelector('#voz-x').onclick = cerrar;
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc); }
      });

      const ta = overlay.querySelector('#voz-txt');
      const btnGen = overlay.querySelector('#voz-gen');
      const err = overlay.querySelector('#voz-err');
      const res = overlay.querySelector('#voz-res');

      // El micro de VZ-1 sobre el textarea: SIEMPRE editable (la voz propone, el humano
      // corrige) y con su degradación propia si el permiso falla.
      attachVoiceInput(ta);
      ta.focus();

      btnGen.addEventListener('click', async () => {
        const texto = (ta.value || '').trim();
        if (!texto) { ta.focus(); return; }
        btnGen.disabled = true;
        const orig = btnGen.textContent;
        btnGen.textContent = 'Convirtiendo…';
        err.style.display = 'none';
        try {
          const d = await apiRequest('/admin/ai/suggest-albaran-lines', {
            method: 'POST',
            body: JSON.stringify({ albaranId: alb.id, description: texto }),
          });
          pintarPropuesta(Array.isArray(d.lines) ? d.lines : []);
        } catch (e) {
          err.textContent = e?.message || 'No se pudieron generar las líneas.';
          err.style.display = 'block';
        } finally {
          btnGen.disabled = false;
          btnGen.textContent = orig;
        }
      });

      function pintarPropuesta(lineas) {
        res.innerHTML = '';
        if (!lineas.length) {
          err.textContent = 'No he sacado ninguna línea. Prueba a contarlo con más detalle.';
          err.style.display = 'block';
          return;
        }
        const titulo = document.createElement('p');
        titulo.style.cssText = 'font-size:13px;font-weight:600;margin:0 0 8px';
        titulo.textContent = 'Repasa antes de añadirlas al parte:';
        res.appendChild(titulo);

        const marcas = [];
        lineas.forEach((l, i) => {
          const fila = document.createElement('label');
          // ≥44 px y toda la fila es el target: en obra no se acierta a un checkbox de 16 px.
          fila.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:10px;'
            + 'min-height:44px;border:1px solid var(--border);border-radius:10px;'
            + 'margin-bottom:6px;background:var(--surface-2);cursor:pointer';
          const chk = document.createElement('input');
          chk.type = 'checkbox'; chk.checked = true;
          chk.style.cssText = 'margin-top:3px;width:20px;height:20px;flex-shrink:0';
          marcas.push({ chk, linea: l });
          const txt = document.createElement('div');
          // SIN_VALORAR: ni se pide ni se muestra precio. El saneado del servidor ya lo
          // garantiza (SCRUM-71 puntos 1-2), pero la pantalla no puede contradecirlo —
          // enseñar un precio que luego no se guarda sería peor que no enseñarlo.
          const detalle = `${l.cantidad} ${l.unidad}`
            + (modo === 'VALORADO' && l.precioUnitario != null ? ` · ${l.precioUnitario} €/ud` : '');
          txt.innerHTML = `<div style="font-weight:600;color:var(--ink)">${escVoz(l.concepto)}</div>`
            + `<div style="color:var(--muted);font-size:13px">${escVoz(detalle)}</div>`;
          fila.append(chk, txt);
          res.appendChild(fila);
        });

        const anadir = document.createElement('button');
        anadir.className = 'btn-primary';
        anadir.style.cssText = 'width:100%;margin-top:10px;min-height:44px';
        anadir.textContent = 'Añadir al parte';
        anadir.addEventListener('click', () => {
          marcas.filter((m) => m.chk.checked).forEach((m) => {
            const l = m.linea;
            rows.appendChild(mkRow({
              concepto: l.concepto,
              cantidad: l.cantidad,
              unidad: l.unidad,
              // En SIN_VALORAR no se arrastra precio ni IVA: esas columnas ni se ven.
              ...(modo === 'VALORADO'
                ? { precioUnitario: l.precioUnitario, tipoIva: l.tipoIva != null ? l.tipoIva * 100 : undefined }
                : {}),
            }));
          });
          updateTotales();
          cerrar();
          showToast('✓ Líneas añadidas — repásalas antes de guardar');
        });
        res.appendChild(anadir);
      }
    }
  }

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

  // ── SCRUM-300 (C5): LUGAR y FECHA de entrega ───────────────────────────────────────
  // Contenido mínimo obligatorio del albarán. Se editan AQUÍ —preparando el documento— y no en
  // el momento de firmar: teclear una dirección con el cliente delante y las manos sucias es
  // justo la fricción en obra que el ticket manda evitar.
  //
  // ⚠️ Los rótulos y las ayudas NO se escriben aquí: llegan servidos por `/admin/me` desde
  // `albaranFirmante.ts` (regla 30). Sin ellos el bloque no se pinta.
  const rotAlb = window.appAlbaranRotulos || {};
  const ayuAlb = window.appAlbaranAyudas || {};
  let lugarEl = null, fEntregaEl = null;
  if (rotAlb.lugarEntrega && rotAlb.fechaEntrega) {
    const campoAlb = (labelText, ayudaText, el) => {
      const w = document.createElement('div');
      w.style.cssText = 'margin-top:8px';
      const l = document.createElement('label');
      l.style.cssText = 'display:block;font-size:12px;font-weight:600;color:var(--ink);margin-bottom:3px';
      l.textContent = labelText;
      w.appendChild(l);
      if (ayudaText) {
        const p = document.createElement('p');
        p.style.cssText = 'margin:0 0 6px;font-size:12px;color:var(--muted);line-height:1.45';
        p.textContent = ayudaText;
        w.appendChild(p);
      }
      w.appendChild(el);
      box.appendChild(w);
      return w;
    };

    lugarEl = document.createElement('input');
    lugarEl.type = 'text';
    lugarEl.className = 'input';
    lugarEl.style.cssText = 'width:100%;min-height:44px';
    lugarEl.maxLength = 300;
    lugarEl.value = alb.lugarEntrega || '';
    // ⚠️ SUELO del ticket: si no hay dirección de obra se deja VACÍO. La sugerencia entra solo
    // como PLACEHOLDER —sugiere, no rellena—: una dirección equivocada en un documento de
    // entrega es peor que ninguna. Hoy `Job.direccion` es null para cualquier merchant real
    // (SCRUM-374), así que lo normal es que no haya nada que sugerir y lo escriba el profesional.
    //
    // ⚠️ Llega por `ctx.direccionSugerida` —UN STRING—, no por el `Job` entero, y no es un rodeo:
    // cuando esta función vivía anidada en `renderJobDetailView` cogía `job` por CLAUSURA, y al
    // sacarla al nivel superior (SCRUM-386/320) esa clausura desapareció. Pasarle el Job le daría
    // acceso a toda la pantalla e invitaría al acoplamiento siguiente; necesita UN DATO. Y con
    // `ctx = {}` por defecto, quien no lo pase obtiene `undefined` —falsy—: sin sugerencia, no
    // pantalla rota. El modo de fallo es el bueno.
    if (ctx.direccionSugerida && !lugarEl.value) lugarEl.placeholder = ctx.direccionSugerida;
    campoAlb(rotAlb.lugarEntrega, ayuAlb.lugarEntrega, lugarEl);

    // ⚠️ Columna PROPIA (`Albaran.fechaEntrega`), NO `Albaran.fecha`: un albarán se prepara un
    // día y se entrega otro, y `fecha` además es la clave del mes natural de la recapitulativa
    // (art. 13). Escribir una sobre la otra movería la factura de mes sin que nadie lo pidiera.
    fEntregaEl = document.createElement('input');
    fEntregaEl.type = 'date';
    fEntregaEl.className = 'input';
    fEntregaEl.style.cssText = 'width:100%;min-height:44px';
    fEntregaEl.value = alb.fechaEntrega ? String(alb.fechaEntrega).slice(0, 10) : '';
    campoAlb(rotAlb.fechaEntrega, ayuAlb.fechaEntrega, fEntregaEl);
  }

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
  save.textContent = textoGuardar || 'Guardar cambios';
  save.addEventListener('click', async () => {
    const out = [];
    for (const r of rows.children) {
      const inputs = r.querySelectorAll('input');
      const c = inputs[0].value.trim(), qv = inputs[1].value, u = inputs[2].value.trim();
      const pv = inputs[3].value, ivv = inputs[4].value;
      if (!c && !qv && !u) continue; // fila totalmente vacía se ignora
      const linea = { concepto: c, cantidad: Number(String(qv).replace(',', '.')), unidad: u };
      // SCRUM-303 · y el origen vuelve a salir con ella. ⚠️ FAMILIA SCRUM-271: `dataset` devuelve
      // SIEMPRE cadena, y `Number('')` es 0 — un índice ausente se convertiría en «la primera
      // partida del presupuesto», en silencio. Se exige que sean dígitos ANTES de convertir.
      const origen = r.dataset.quoteLineIndex;
      if (typeof origen === 'string' && /^\d+$/.test(origen)) linea.quoteLineIndex = Number(origen);
      if (modo === 'VALORADO') {
        linea.precioUnitario = Number(String(pv).replace(',', '.'));
        linea.tipoIva = Number(String(ivv).replace(',', '.'));
      }
      out.push(linea);
    }
    // SCRUM-361 (H6 · fase 2): la versión que ESTE editor abrió viaja con el guardado. Sin ella el
    // servidor no tiene contra qué comparar y la segunda de dos ediciones a la vez pisa a la
    // primera en silencio. `alb.version` viene de `serializeAlbaran` — ya venía, no se añade campo.
    // ⚠️ Es la de cuando se abrió el editor, NO una releída al guardar: releerla aquí volvería a
    // dar siempre «coincide» y el mecanismo entero no serviría para nada.
    const body = { lineas: out, notas: notas.value, version: alb.version };
    // SCRUM-300: se mandan SIEMPRE que el bloque exista, también vacíos — vaciar el lugar de
    // entrega es una decisión legítima del pro y el backend la respeta ('' → null). No tocan
    // `fecha`, que sigue siendo la del documento.
    if (lugarEl) body.lugarEntrega = lugarEl.value;
    if (fEntregaEl) body.fechaEntrega = fEntregaEl.value;
    // Solo se manda modoValoracion cuando es EDITABLE (borrador); en 'emitido' el
    // backend lo rechaza con 409 aunque el valor no cambie — mejor ni ofrecerlo.
    if (modoEditable) body.modoValoracion = modo;
    save.disabled = true;
    try {
      // SCRUM-303: en creación, ÉSTE es el único sitio del que sale el POST — y por eso no hay
      // albarán ni número hasta aquí. En edición no cambia nada: sigue siendo el PATCH de antes.
      if (onGuardar) {
        await onGuardar({ lineas: out, notas: notas.value, modoValoracion: modo });
      } else {
        await apiRequest(`/admin/albaranes/${alb.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        showToast('✓ Albarán actualizado (nueva versión).');
      }
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

function openAlbEditorSheet(alb, ctx) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `Editar albarán ${alb.numero}`);
  const modal = document.createElement('div');
  modal.className = 'modal';
  // SCRUM-446: la cabecera sale del constructor compartido.
  const header = cabeceraModal({ titulo: `Editar albarán ${alb.numero}` });
  const closeBtn = header.querySelector('.modal-close');
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
  }, ctx);
  // Foco al primer campo (Concepto) para teclear directo; si no hay, al botón de cerrar.
  (bodyEl.querySelector('.input') || closeBtn).focus();
}


// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-386 · LA HOJA DE FACTURAR PARCIAL, FUERA DE LA VISTA DEL TRABAJO
//
// Movida con GO explícito del fundador, que corrigió la regla al darlo: la 38 se mide POR
// FICHERO Y POR LADO, no por el nombre de la función. El camino de emisión vive en el SERVIDOR
// (la ruta, `emitInvoice`, `applyVeriFactu`, el sellado). Esto es `public/dashboard/js/`
// haciendo un `apiRequest`: un CLIENTE del camino de emisión, no el camino.
//
// ⚠️ MUDANZA: cuerpo byte-idéntico y la línea del `apiRequest` sin tocar ni un carácter.
// ═══════════════════════════════════════════════════════════════════════════════════════════

function openFacturarParcialSheet(alb, ctx) {
  // SCRUM-386 · lo que antes venía del ámbito de `renderJobDetailView`. Desestructurado con
  // los MISMOS nombres: el cuerpo de abajo no cambia ni un carácter, y eso se comprueba
  // comparando textos, no leyendo el diff.
  const { refresh, setStatus } = ctx;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `Facturar parte del albarán ${alb.numero}`);
  const modal = document.createElement('div');
  modal.className = 'modal';
  // SCRUM-446: la cabecera sale del constructor compartido.
  const header = cabeceraModal({ titulo: `Facturar parte de ${alb.numero}` });
  const closeBtn = header.querySelector('.modal-close');

  const err = document.createElement('div');
  err.className = 'alert error';
  err.style.display = 'none';

  const body = document.createElement('div');
  body.className = 'modal-body';
  const inputs = [];
  (alb.pendientes || []).forEach((p) => {
    if (p.pendiente <= 0) return; // lo ya cobrado no se vuelve a ofrecer
    const fila = document.createElement('div');
    fila.style.cssText = 'display:flex;gap:10px;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)';
    const izq = document.createElement('div');
    izq.style.cssText = 'min-width:0;flex:1';
    izq.innerHTML =
      `<div style="font-weight:600">${esc(p.concepto || 'Sin concepto')}</div>` +
      `<div style="font-size:12px;color:var(--muted)">Servido ${p.servida}${p.unidad ? ' ' + esc(p.unidad) : ''}` +
      (p.facturada > 0 ? ` · ya facturado ${p.facturada}` : '') +
      ` · queda <strong>${p.pendiente}</strong></div>`;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = '0';
    inp.max = String(p.pendiente);
    inp.step = '0.001';
    inp.value = String(p.pendiente); // por defecto, lo que queda
    inp.style.cssText = 'width:110px;min-height:44px'; // target al pulgar (AB6)
    inp.setAttribute('aria-label', `Cantidad a facturar de ${p.concepto || 'la línea'}`);
    inputs.push({ index: p.index, input: inp, max: p.pendiente });
    fila.append(izq, inp);
    body.appendChild(fila);
  });

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const cancelar = document.createElement('button');
  cancelar.className = 'btn-secondary';
  cancelar.type = 'button';
  cancelar.textContent = 'Cancelar';
  const emitir = document.createElement('button');
  emitir.className = 'btn-primary';
  emitir.type = 'button';
  emitir.textContent = 'Emitir factura';
  footer.append(cancelar, emitir);

  const cerrar = () => overlay.remove();
  closeBtn.addEventListener('click', cerrar);
  cancelar.addEventListener('click', cerrar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  // SCRUM-271: el aviso de «se cae alguna línea» necesita recordar si ya se dio, porque la
  // segunda pulsación es la que confirma. Cualquier cambio en un campo lo vuelve a armar, para
  // que una confirmación no se herede de una situación distinta de la que se está mirando.
  let avisadoDeLineasSinCantidad = false;
  for (const { input } of inputs) {
    input.addEventListener('input', () => { avisadoDeLineasSinCantidad = false; });
  }

  // ── SCRUM-292 (A1) · LA REVISIÓN ANTES DE EMITIR ──────────────────────────────────────
  //
  // Una factura sin NIF del cliente se emite, se envía y se cobra — y queda FUERA del registro.
  // En pantalla es idéntica a una registrada, así que el profesional no se entera. Esta puerta
  // ELIMINA el caso en vez de avisar de él: con NIF, la derivación tiene lo que necesita.
  //
  // ⚠️ NO TOCA EL CAMINO DE EMISIÓN (regla 38). Vive ANTES: quien decide el tipo de factura sigue
  // siendo `registro.builder.ts`, sin una línea cambiada. Aquí solo se pide el dato que falta.
  //
  // ⚠️ CON NIF NO PASA NADA: ni pregunta, ni fricción, ni un clic más. Tiene control positivo.
  //
  // ⚠️ EL CLIENTE ENTRA POR `ctx`, EN SU PROPIA LÍNEA. SCRUM-386 sacó esta hoja del ámbito de la
  // vista, y su guard comprueba dos cosas: que no capture nada de `renderJobDetailView` —por eso
  // aquí no se puede tocar `job`— y que la desestructuración siga siendo
  // `const { refresh, setStatus } = ctx;` LITERAL. Añadir `customer` a esa línea la rompería.
  //
  // ⚠️ REGLA 26 · ni una palabra sobre el registro, VeriFactu, la AEAT o el calendario: esa
  // pregunta se responde SOLO con el guion H2. Procedencia: SCRUM-292.
  //
  // 17-ago-2026: los cinco textos de este bloque están APROBADOS y `MARCA_A1` se BORRA. La regla 26
  // sigue exactamente igual de viva: ninguno de ellos nombra el registro, VeriFactu, la AEAT ni el
  // calendario — hablan del NIF del cliente y de si falta algo para emitir, y de nada más.
  //
  // ⚠️ Y la línea de estado ya NO pinta lo mismo en sus dos ramas: ése era el defecto. Conforme y
  // no conforme dicen cosas distintas, que es para lo que existe la caja.
  const clienteA1 = (ctx && ctx.customer) || {};
  const revisionInicial = revisionPreEmision(clienteA1);

  const cajaRevision = document.createElement('div');
  cajaRevision.className = 'preemision';
  cajaRevision.dataset.estado = revisionInicial.estado;
  {
    // LO QUE VA A SALIR, antes de que sea irreversible (regla 29: emitida no se toca).
    //
    // ⚠️ LAS DOS RAMAS LLEVAN MARCADOR, no solo una. Un rótulo que depende de una condición es
    // justo donde un guard de literales se queda ciego: al pasar el valor a una expresión deja de
    // ver el texto y pasa en verde sin comprobar nada. Procedencia: SCRUM-292.
    const linea = document.createElement('p');
    linea.className = 'preemision__linea';
    linea.textContent = revisionInicial.decidible ? 'Todo listo para emitir.' : 'Revisa lo que falta antes de emitir.';
    cajaRevision.appendChild(linea);

    if (revisionInicial.faltaNif) {
      const lbl = document.createElement('label');
      lbl.className = 'preemision__label';
      lbl.setAttribute('for', 'preemision-nif');
      lbl.textContent = 'NIF del cliente (se guardará en su ficha)'; // procedencia: SCRUM-292
      const inp = document.createElement('input');
      inp.id = 'preemision-nif';
      inp.className = 'input';
      inp.maxLength = 20; // el mismo tope que ya valida el backend
      cajaRevision.append(lbl, inp);
    }
  }
  body.appendChild(cajaRevision);

  emitir.addEventListener('click', async () => {
    const todas = inputs.map((i) => ({ index: i.index, cantidad: Number(i.input.value) }));
    const lineas = todas.filter((l) => l.cantidad > 0);

    // ── LA PUERTA ─────────────────────────────────────────────────────────────────────
    // Sin NIF no se emite por este camino sin que el profesional haya visto la pregunta. Si lo
    // rellena, se guarda en `Customer.taxId` por la ruta que YA existe. Si lo deja vacío, se
    // para: no se emite a medias.
    if (revisionInicial.faltaNif) {
      const campo = document.getElementById('preemision-nif');
      const nif = String((campo && campo.value) || '').trim();
      if (!nif) {
        err.textContent = 'Escribe el NIF del cliente. Sin él no se puede emitir la factura.'; // procedencia: SCRUM-292
        err.style.display = 'block';
        return;
      }
      try {
        await apiRequest(`/admin/customers/${clienteA1.id}`, {
          method: 'PATCH', body: JSON.stringify({ taxId: nif }),
        });
        clienteA1.taxId = nif; // en memoria, para que la revisión deje de disparar
        revisionInicial.faltaNif = false;
      } catch {
        err.textContent = 'No hemos podido guardar el NIF en la ficha del cliente. Inténtalo otra vez.'; // procedencia: SCRUM-292
        err.style.display = 'block';
        return;
      }
    }

    if (lineas.length === 0) {
      err.textContent = 'Indica qué cantidad quieres facturar de al menos una línea.';
      err.style.display = 'block';
      return;
    }
    // SCRUM-271: antes solo avisaba si se caían TODAS. Con tres líneas y una sin cantidad se
    // emitía la factura con dos, EN SILENCIO — el pro pedía facturar tres y no se enteraba de
    // haber perdido una. No corrompe un valor: OMITE una línea, y eso en facturación es peor.
    //
    // AVISA Y NO BLOQUEA, a propósito: facturar solo parte de las líneas es un uso legítimo —
    // para eso existe esta pantalla—, así que impedirlo rompería el flujo. La segunda pulsación
    // confirma, que es lo que convierte «no se enteró» en «lo decidió».
    if (lineas.length < todas.length && !avisadoDeLineasSinCantidad) {
      err.textContent = 'Revisa las líneas sin cantidad: no se facturarán.';
      err.style.display = 'block';
      avisadoDeLineasSinCantidad = true;
      return;
    }
    emitir.disabled = true;
    const orig = emitir.textContent;
    emitir.textContent = 'Emitiendo…';
    try {
      const d = await apiRequest(`/admin/albaranes/${alb.id}/facturar-parcial`, {
        method: 'POST', body: JSON.stringify({ lineas }),
      });
      cerrar();
      // El sellado que falla NO se calla (mismo criterio que la consolidación).
      showToast(d && d.veriFactu === false ? '⚠️ Factura emitida, revisa su registro' : '✓ Factura emitida.');
      if (d && d.message) setStatus('error', d.message);
      refresh();
    } catch (e) {
      err.textContent = e?.data?.message || 'No se pudo emitir la factura.';
      err.style.display = 'block';
      emitir.disabled = false;
      emitir.textContent = orig;
    }
  });

  modal.append(header, err, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

window.renderJobDetailView = renderJobDetailView;

// ── SCRUM-427 · NOTAS INTERNAS en el detalle del Trabajo ──────────────────────────────────────
//
// ⚠️ NO SE CREA NINGÚN ALMACENAMIENTO, y medirlo antes fue lo que evitó construir uno de más.
// `Job.notes` ya existía y estaba enchufado de punta a punta MENOS la pantalla: se persiste, la
// API lo devuelve (`jobs.routes.ts:250`), se escribe por `PATCH` con tope de 2.000 y gate POR CAMPO
// (SCRUM-120, que se lo da al operario a propósito), y hasta viaja al calendario dentro del
// `DESCRIPTION:` del `.ics`. Lo único que faltaba era poder verlo y escribirlo desde aquí.
//
// Y ya había un editor: en la LISTA de trabajos (`jobsView.js`). O sea que el defecto real no era
// «no existen las notas», era que **la nota que escribes desde la lista es invisible desde la
// pantalla donde trabajas** — y quien abre el detalle no tiene forma de saber que existe.
//
// ⚠️ `Quote.internalNotes` es OTRA COSA y no se toca: son las notas del PRESUPUESTO, tienen su
// propia sección en Presupuestos y su indicador en esa lista. Dos trabajos del mismo presupuesto
// compartirían esa nota; la del trabajo es del trabajo.
//
// MICROCOPY: reutilizada LITERAL de la sección que ya existe en Presupuestos
// (`quotesDetailView.js`), no inventada — mismo rótulo, misma píldora y mismo placeholder. Que las
// dos pantallas digan lo mismo con las mismas palabras es la mitad del trabajo.
function pintarNotasInternas(body, job) {
  const sec = document.createElement('div');
  sec.className = 'detail-section';
  sec.dataset.seccion = 'notas';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
  header.innerHTML =
    '<h3 class="detail-section-title" style="margin:0">Notas internas</h3>' +
    '<span style="font-size:11px;color:var(--muted);background:var(--neutral-100);padding:2px 8px;border-radius:999px">Solo tú las ves</span>';
  sec.appendChild(header);

  const ta = document.createElement('textarea');
  ta.id = 'job-notas-internas';
  ta.value = job.notes || '';
  ta.rows = 3;
  ta.placeholder = 'Anota detalles del trabajo, acuerdos verbales, recordatorios…';
  ta.style.cssText = 'width:100%;resize:vertical;font:inherit;font-size:14px;padding:10px 12px;'
    + 'border:1px solid var(--neutral-200);border-radius:var(--r-md);color:var(--body);background:var(--surface)';
  sec.appendChild(ta);

  // Guardar al perder el foco, igual que en la lista: dos superficies que guardan el mismo campo
  // de dos maneras distintas acabarían enseñando cosas distintas del mismo trabajo.
  //
  // ⚠️ Y solo si CAMBIÓ. Sin esa comparación, abrir el detalle y cerrarlo mandaría un PATCH por
  // cada visita — escrituras que nadie pidió sobre un campo que otra pantalla también toca.
  ta.addEventListener('blur', () => {
    if ((job.notes || '') === ta.value) return;
    apiRequest(`/admin/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ notes: ta.value }) })
      .then(() => { job.notes = ta.value; showToast('✓ Notas guardadas'); })
      .catch(() => showToast('No se pudieron guardar las notas', 'error'));
  });

  body.appendChild(sec);
}
