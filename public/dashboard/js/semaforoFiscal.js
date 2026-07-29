// SCRUM-210 · SEMÁFORO FISCAL — lo que ve el fontanero.
//
// TRES COMPORTAMIENTOS, y el tercero es no hacer nada:
//   🔴 ROJO  → la acción se DESHABILITA con la explicación SIEMPRE visible. Jamás se oculta:
//              si no ve el botón, cree que YaQu no sabe hacerlo.
//   🟠 ÁMBAR → pantalla intermedia con las cuatro cosas que necesita saber y dos salidas.
//              NUNCA un «¿estás seguro?»: un modal genérico se clica sin leer y no protege a nadie.
//   🟢 VERDE → SILENCIO. Ni badge ni toast de «todo correcto» (SCRUM-210).
//
// ⚠️ SE CONSTRUYE CONTRA EL CONTRATO, no contra el back: el endpoint del freno todavía NO existe.
// `fetchSemaforo()` devuelve una respuesta simulada con la forma FIJA acordada
// `{ color, avisoId, avisoVersion, titulo, porque, opciones[] }`. Ver el TODO de cableado abajo.
//
// Microcopy: regla 30 — aprobado por el fundador antes de programar. NO se reformula aquí.

/* ─────────────────────────────────────────────────────────────────────────────────────────
 * CATÁLOGO DE AVISOS
 *
 * Los identificadores son SEMÁNTICOS a propósito, no aleatorios: cuando SCRUM-207 publique el
 * catálogo versionado de verdad, estos se ADOPTAN (mismo id, versión real) en vez de sustituirse.
 * Un uuid aquí obligaría a una migración de datos el día del cableado; un nombre, no.
 *
 * `version: 0` significa «texto todavía no versionado por el catálogo oficial».
 * TODO SCRUM-207: sustituir `version: 0` por la versión real del catálogo y dejar de declarar
 * los textos aquí — pasan a venir en la respuesta del endpoint.
 * ───────────────────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ HUECO DELIBERADO — NO RELLENAR SIN DICTAMEN.
 *
 * El aviso de «cliente sin NIF» necesita una frase sobre qué implica emitir una simplificada
 * (límites, cuándo no cabe). Eso es criterio FISCAL, no de producto: lo decide el asesor.
 * Se deja VISIBLE y marcado a propósito — un hueco que se ve es una pregunta abierta; uno
 * escondido detrás de una frase inventada es una afirmación fiscal falsa firmada por nosotros.
 * Mientras esté así, el bloque no se pinta (ver `bloquePendiente`).
 */
const PENDIENTE_ASESOR = '[PENDIENTE ASESOR]';

const AVISO_VERSION_SIN_CATALOGO = 0; // TODO SCRUM-207

const AVISOS = {
  // ── ROJOS: la AEAT lo rechazaría, o rompería la cadena. No se negocia. ──────────────────
  ROJO_SIN_LINEAS: {
    color: 'rojo',
    avisoId: 'ROJO_SIN_LINEAS',
    avisoVersion: AVISO_VERSION_SIN_CATALOGO,
    titulo: 'No se puede emitir: esta factura no tiene ningún concepto.',
    porque: 'Añade al menos una línea con su importe.',
    opciones: [],
  },
  ROJO_ANULADA: {
    color: 'rojo',
    avisoId: 'ROJO_ANULADA',
    avisoVersion: AVISO_VERSION_SIN_CATALOGO,
    titulo: 'Esta factura está anulada y no se puede reactivar.',
    porque: 'Si el trabajo se hizo, crea una factura nueva.',
    opciones: [],
  },
  ROJO_MESES_DISTINTOS: {
    color: 'rojo',
    avisoId: 'ROJO_MESES_DISTINTOS',
    avisoVersion: AVISO_VERSION_SIN_CATALOGO,
    titulo: 'Estos partes son de meses distintos y una factura recapitulativa solo agrupa los de un mismo mes.',
    porque: 'YaQu puede crear una factura por cada mes.',
    // Único rojo con salida: no es un callejón, hay algo que YaQu puede hacer por él.
    opciones: [{ id: 'ver_como_quedarian', etiqueta: 'Ver cómo quedarían', tipo: 'secundaria' }],
  },

  // ── ÁMBARES: corregible. Se avisa, decide el usuario, y queda registrado. ───────────────
  AMBAR_PLAZO_VENCIDO: {
    color: 'ambar',
    avisoId: 'AMBAR_PLAZO_VENCIDO',
    avisoVersion: AVISO_VERSION_SIN_CATALOGO,
    // `titulo: null` = el cuerpo va ENTERO, sin trocear en bloques. El copy de plazo vencido
    // ya venía aprobado de SCRUM-69 y partirlo en «qué pasa / por qué» sería reformularlo:
    // reformatear copy aprobado ES reescribirlo. Se pinta tal cual salga de `copyRojo()`.
    titulo: null,
    porque: null, // se rellena con copyRojo(mesLabel) en `avisoPlazoVencido()`
    opciones: [
      { id: 'facturar_de_otra_forma', etiqueta: 'Facturar de otra forma', accion: 'alternativa', tipo: 'primaria' },
      { id: 'emitir_igualmente', etiqueta: 'Emitir igualmente', accion: 'confirmar', tipo: 'secundaria' },
    ],
  },
  AMBAR_CLIENTE_SIN_NIF: {
    color: 'ambar',
    avisoId: 'AMBAR_CLIENTE_SIN_NIF',
    avisoVersion: AVISO_VERSION_SIN_CATALOGO,
    titulo: 'Este cliente no tiene NIF.',
    porque: 'Sin NIF, la factura se emite como simplificada.',
    pendiente: PENDIENTE_ASESOR,
    opciones: [
      { id: 'anadir_nif', etiqueta: 'Añadir el NIF', accion: 'alternativa', tipo: 'primaria' },
      { id: 'emitir_igualmente', etiqueta: 'Emitir igualmente', accion: 'confirmar', tipo: 'secundaria' },
    ],
  },
};

// Pie común de TODO ámbar. Es la mitad «demostrable» del compromiso: el usuario tiene que
// saber que su decisión se guarda ANTES de tomarla, no enterarse después.
const PIE_AMBAR = 'Tu decisión queda registrada junto con este aviso.';

/** El aviso de plazo vencido necesita el mes; el copy aprobado lo lleva dentro. */
function avisoPlazoVencido(mesLabel) {
  // `copyRojo` vive en api.js (compartido con la bandeja de SCRUM-69) — una sola copia del
  // texto aprobado. Duplicarlo aquí sería el fallo de «dos listas a mano que deben cuadrar».
  const cuerpo = typeof window !== 'undefined' && window.copyRojo
    ? window.copyRojo(mesLabel)
    : '';
  return Object.assign({}, AVISOS.AMBAR_PLAZO_VENCIDO, { porque: cuerpo });
}

/* ─────────────────────────────────────────────────────────────────────────────────────────
 * EL PAYLOAD DE CONFIRMACIÓN — lo que no se puede negociar
 * ───────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Construye lo que el front manda al confirmar un ámbar.
 *
 * 🔑 NUNCA UN BOOLEANO. Si solo se mandara «aceptó», el día que cambie el microcopy el
 * AuditLog MENTIRÍA: diría que el usuario aceptó un texto que ya no es el que se le mostró, y
 * dejaría de servir como escudo. Por eso viajan SIEMPRE el identificador del aviso Y la versión
 * de su texto — las dos, y por separado: con una sola no se puede reproducir lo que vio.
 *
 * Lanza en vez de devolver un payload cojo: un registro incompleto es peor que uno ausente,
 * porque parece que hay prueba y no la hay.
 */
function buildAvisoPayload(aviso, opcionId) {
  if (!aviso || typeof aviso !== 'object') {
    throw new Error('semaforo_payload_sin_aviso');
  }
  if (!aviso.avisoId) {
    throw new Error('semaforo_payload_sin_avisoId: sin identificador no se sabe QUÉ aceptó');
  }
  // `0` es una versión válida (catálogo aún sin publicar), así que se comprueba la AUSENCIA,
  // no la falsedad: `!aviso.avisoVersion` daría error con la versión 0, que es la de hoy.
  if (aviso.avisoVersion === undefined || aviso.avisoVersion === null) {
    throw new Error('semaforo_payload_sin_avisoVersion: sin versión no se sabe QUÉ TEXTO vio');
  }
  if (!opcionId) {
    throw new Error('semaforo_payload_sin_opcion');
  }
  return {
    avisoId: aviso.avisoId,
    avisoVersion: aviso.avisoVersion,
    opcion: opcionId,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────────────────
 * RENDER
 * ───────────────────────────────────────────────────────────────────────────────────────── */

/**
 * 🔴 ROJO — acción visible pero deshabilitada + explicación SIEMPRE a la vista.
 *
 * Reutiliza el patrón del 403 por rol (SCRUM-89, `lockActionForRole` + `roleLockedNote` en
 * api.js): mismo gesto, misma clase, misma decisión de fondo — deshabilitar con explicación en
 * vez de ocultar. SIN TOOLTIP como canal único: en móvil no hay hover, así que un tooltip es
 * lo mismo que no decir nada.
 */
function renderRojo(contenedor, aviso, boton) {
  if (boton) {
    boton.disabled = true;
    boton.classList.add('role-locked');
    boton.setAttribute('aria-disabled', 'true');
  }
  const caja = document.createElement('div');
  caja.className = 'semaforo-rojo';
  caja.setAttribute('role', 'note');

  const que = document.createElement('p');
  que.className = 'semaforo-rojo-que';
  que.textContent = aviso.titulo;
  caja.appendChild(que);

  const puede = document.createElement('p');
  puede.className = 'semaforo-rojo-puede';
  puede.textContent = aviso.porque;
  caja.appendChild(puede);

  // El único rojo con salida (meses distintos) ofrece su acción; los demás no llevan ninguna.
  (aviso.opciones || []).forEach((op) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-secondary semaforo-accion';
    b.textContent = op.etiqueta;
    b.dataset.opcion = op.id;
    caja.appendChild(b);
  });

  if (boton && boton.parentNode) boton.parentNode.insertBefore(caja, boton.nextSibling);
  else if (contenedor) contenedor.appendChild(caja);
  return caja;
}

/** El hueco del asesor: mientras siga sin dictamen, NO se pinta nada en su lugar. */
function bloquePendiente(aviso) {
  return aviso.pendiente === PENDIENTE_ASESOR ? null : aviso.pendiente || null;
}

/**
 * 🟠 ÁMBAR — pantalla intermedia. Cuatro bloques y dos salidas.
 *
 * SIN ESTÉTICA DE PELIGRO a propósito: no está haciendo nada ilegal, está haciendo algo
 * corregible. Asustarle con rojo agresivo empeora su situación — o abandona una factura que
 * podía emitir, o aprende a ignorar los avisos. Ámbar sobrio (`--amber-50` / `#92400e`, los
 * tokens que ya usa `status-pill-pending`), nunca `--danger`.
 *
 * `onConfirmar` recibe el PAYLOAD ya construido, nunca un booleano.
 */
function renderAmbar(contenedor, aviso, handlers) {
  const h = handlers || {};
  const caja = document.createElement('div');
  caja.className = 'semaforo-ambar';
  caja.setAttribute('role', 'region');
  caja.setAttribute('aria-label', 'Antes de emitir');

  // ① QUÉ PASA + ② POR QUÉ.
  // Si el aviso no trae título, su texto va ENTERO como cuerpo, sin encabezados de bloque:
  // es copy aprobado de una pieza (plazo vencido, SCRUM-69) y trocearlo sería reformularlo.
  if (aviso.titulo) {
    const t = document.createElement('p');
    t.className = 'semaforo-ambar-titulo';
    t.textContent = aviso.titulo;
    caja.appendChild(t);
  }
  if (aviso.porque) {
    const p = document.createElement('p');
    p.className = aviso.titulo ? 'semaforo-ambar-porque' : 'semaforo-ambar-cuerpo';
    p.textContent = aviso.porque;
    caja.appendChild(p);
  }

  const pendiente = bloquePendiente(aviso);
  if (pendiente) {
    const x = document.createElement('p');
    x.className = 'semaforo-ambar-porque';
    x.textContent = pendiente;
    caja.appendChild(x);
  }

  // ③ QUÉ PUEDES HACER — las dos salidas.
  //
  // ⚠️ EL PESO VISUAL VA A LA ALTERNATIVA SEGURA, no a «emitir igualmente». Se corrigió al VER
  // la primera captura: con «Emitir igualmente» en verde de marca, la acción más grande de la
  // pantalla era justo la que el ticket no quiere que se pulse sin leer — el mismo problema del
  // «¿estás seguro?» que este diseño existe para evitar, colado por el color. «Emitir
  // igualmente» sigue visible y a un toque (no se esconde: no está haciendo nada ilegal), pero
  // no es la que atrae el pulgar.
  //
  // `tipo` es SOLO apariencia y `accion` SOLO semántica, separados a propósito: acoplarlos hacía
  // que recolorear un botón cambiara qué handler dispara.
  const acciones = document.createElement('div');
  acciones.className = 'semaforo-ambar-acciones';
  (aviso.opciones || []).forEach((op) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn semaforo-accion ' + (op.tipo === 'primaria' ? 'btn-primary' : 'btn-secondary');
    b.textContent = op.etiqueta;
    b.dataset.opcion = op.id;
    b.addEventListener('click', () => {
      // Aquí es donde el booleano habría entrado por la puerta de atrás. No entra.
      const payload = buildAvisoPayload(aviso, op.id);
      if (op.accion === 'confirmar') { if (h.onConfirmar) h.onConfirmar(payload); }
      else if (h.onAlternativa) h.onAlternativa(payload);
    });
    acciones.appendChild(b);
  });
  caja.appendChild(acciones);

  // ④ QUEDA REGISTRADO — antes de decidir, no después.
  const pie = document.createElement('p');
  pie.className = 'semaforo-ambar-pie';
  pie.textContent = PIE_AMBAR;
  caja.appendChild(pie);

  if (contenedor) contenedor.appendChild(caja);
  return caja;
}

/**
 * 🟢 VERDE — no se pinta NADA. Existe como función para que el llamador no tenga que
 * acordarse de la excepción: `pintarSemaforo` la llama y no pasa nada. Un badge de «todo
 * correcto» entrenaría al usuario a buscar el sello, y el día que falte pensaría que se rompió.
 */
function renderVerde() {
  return null;
}

/** Punto único de entrada: el llamador no decide qué pintar, lo decide el color. */
function pintarSemaforo(contenedor, aviso, opts) {
  if (!aviso || aviso.color === 'verde') return renderVerde();
  if (aviso.color === 'rojo') return renderRojo(contenedor, aviso, (opts || {}).boton);
  return renderAmbar(contenedor, aviso, opts);
}

/* ─────────────────────────────────────────────────────────────────────────────────────────
 * CABLEADO
 * ───────────────────────────────────────────────────────────────────────────────────────── */

/**
 * TODO SCRUM-207 — CABLEADO PENDIENTE.
 *
 * Hoy devuelve una respuesta SIMULADA con la forma fija del contrato. Cuando exista el
 * endpoint del freno, esto pasa a ser un `apiRequest(...)` y el catálogo de arriba deja de
 * declarar textos: vendrán resueltos y versionados desde el back.
 *
 * Lo que NO cambia el día del cableado: la forma del objeto y el payload de confirmación.
 * Por eso el resto del módulo ya está escrito contra ellos y no contra este simulacro.
 */
function fetchSemaforo(_contexto) {
  // TODO SCRUM-207: return apiRequest('/admin/invoices/semaforo', { method: 'POST', body: _contexto });
  return Promise.resolve({ color: 'verde', avisoId: null, avisoVersion: null, titulo: null, porque: null, opciones: [] });
}

window.SEMAFORO_AVISOS = AVISOS;
window.SEMAFORO_PIE_AMBAR = PIE_AMBAR;
window.SEMAFORO_PENDIENTE_ASESOR = PENDIENTE_ASESOR;
window.avisoPlazoVencido = avisoPlazoVencido;
window.buildAvisoPayload = buildAvisoPayload;
window.pintarSemaforo = pintarSemaforo;
window.renderRojo = renderRojo;
window.renderAmbar = renderAmbar;
window.renderVerde = renderVerde;
window.fetchSemaforo = fetchSemaforo;
