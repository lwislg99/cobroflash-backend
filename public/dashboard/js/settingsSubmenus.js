// public/dashboard/js/settingsSubmenus.js — SCRUM-284 (B1)
//
// EL MAPA DE CONFIGURACIÓN, EN UN SOLO SITIO: la pantalla COLOCA desde aquí y el guard VERIFICA
// contra aquí. Vive en `public/` y no en `tests/` por una razón concreta y medida: mientras el mapa
// estuvo solo en el test, el guard comprobaba una tabla **que la pantalla no usaba**, así que su
// verde no decía nada sobre lo que el profesional ve. Dos fuentes que empiezan de acuerdo y se
// separan sin que nadie lo note es el defecto que este ticket entero viene a cerrar.
//
// ── 🔴 EL TRINQUETE ERA DE UN SOLO SENTIDO ────────────────────────────────────
// La primera versión vigilaba «ningún campo sin sitio» y NADA MÁS. Con eso, de sus **11 destinos
// solo 5 eran un submenú de los diez**, y **cinco de los diez no tenían ni un campo** — con el guard
// VERDE todo el tiempo, porque preguntaba «¿tiene sitio este campo?» y nunca «¿existe ese sitio?».
//
// LA CAUSA ESTRUCTURAL, que es la lección: el conjunto de destinos válidos se **DERIVABA de los
// propios valores del mapa** (`new Set(Object.values(ASIGNACION))`). **Un conjunto que se define por
// lo que lo usa no puede detectar un uso equivocado** — escribir un destino inventado lo declaraba
// válido en el mismo gesto. Por eso `SUBMENUS` existe como conjunto CERRADO e independiente.
//
// Los cuatro sentidos del guard: ① campo sin sitio · ② destino que no es submenú · ③ submenú sin
// campos salvo declarado vacío con motivo · ④ vacío declarado que YA tiene campos (para que saldar
// la deuda quede anotado; si bajar fuese silencioso, la lista declararía huecos que ya no existen).

/**
 * LOS DIEZ SUBMENÚS — conjunto CERRADO. Nueve salen de la descripción del ticket; el décimo
 * (`equipo`) lo abrió el fundador al colocar `approvalThreshold`, que no cabía en ninguno.
 */
var SUBMENUS = [
  'empresa', 'facturacion', 'cobro', 'avisos',
  'publica', 'marca', 'datos', 'cumplimiento', 'equipo',
];

// Marcador de regla 30. YA NO lo usan los rótulos de los diez (ver `ROTULOS`), pero sí los textos
// del estado vacío, que son redacción nueva y NO están aprobados.
var MARCA_MICROCOPY_SUBMENU = '[PENDIENTE microcopy oficial]';

/**
 * LOS DIEZ RÓTULOS — APROBADOS por el fundador (5-ago-2026, regla 30).
 *
 * No es redacción nueva y por eso se aprobaron de una vez: **los nueve primeros están escritos en la
 * descripción del ticket** y el décimo es el nombre que usó el fundador al colocar
 * `approvalThreshold`. Aterrizarlos no es escribir microcopy, es dejar de usar el marcador.
 *
 * Y había un motivo de medición para hacerlo YA: con el marcador (28 caracteres) las diez pestañas
 * caían **una por fila** a 390 px, así que las capturas estaban midiendo el marcador y no la
 * pantalla. Con los rótulos reales se sabe de verdad cómo se agrupan.
 *
 * Fijados carácter a carácter en `tests/scrum284-configuracion-submenus.test.mjs`: cambiarlos sin
 * pasar por el fundador sale rojo.
 */
var ROTULOS = {
  empresa: 'Empresa',
  facturacion: 'Facturación',
  cobro: 'Cobros',
  avisos: 'Avisos',
  publica: 'Tu página pública',
  marca: 'Marca',
  datos: 'Tus datos',
  cumplimiento: 'Cumplimiento',
  equipo: 'Equipo',
};

/** Rótulo de un submenú. Lanza si falta, por lo mismo que `submenuDeCampo`: mejor ruidoso que mudo. */
function rotuloDeSubmenu(clave) {
  var r = ROTULOS[clave];
  if (!r) throw new Error('[settings] submenú sin rótulo: ' + clave);
  return r;
}

/** Asignación campo → submenú. La clave es la del censo; el valor, una clave de `SUBMENUS`. */
var ASIGNACION_SUBMENU = {
  // ── empresa ── `taxId`/`address` (antes `fiscales`), `whatsappPhone` (antes `whatsapp`) y
  // `defaultCurrency` (antes `moneda`) caen aquí por la propia descripción del ticket. No es
  // decisión nueva: «Empresa — nombre, razón social, NIF, dirección, país, moneda, teléfono».
  name: 'empresa',
  legalName: 'empresa',
  taxId: 'empresa',
  address: 'empresa',
  whatsappPhone: 'empresa',
  defaultCurrency: 'empresa',
  country: 'empresa',
  // ── numeracion ── el ticket coloca el prefijo en DOS submenús a la vez: es una contradicción
  // interna, no una opción. Manda el nombre del submenú — una serie va en Numeración.
  invoiceSeriesPrefix: 'facturacion',
  // ── cobro ──
  iban: 'cobro',
  bizumPhone: 'cobro',
  clabe: 'cobro',
  // ── avisos ──
  // `googleReviewUrl` va aquí por el criterio del fundador: **el destino de un ajuste sale de lo que
  // GOBIERNA, no de dónde se ve su efecto.** El campo configura el envío automático de la petición
  // de reseña —lo dice el propio texto de la pantalla— y sus otras dos superficies solo lo CONSUMEN.
  // Configurar y consumir no son lo mismo, y este mapa es de configuración. Mismo caso que el logo,
  // que se configura en Marca y aparece en el PDF, en la ficha pública y en los correos.
  //
  // ⚠️ TRES CONSUMIDORES, ANOTADOS AQUÍ PARA QUE NADIE SALGA A BUSCAR EL ORIGEN:
  //   1. WhatsApp automático al cliente tras el cobro — `psp.routes.ts:221`, `mpWebhook.routes.ts:181`
  //   2. la ficha pública `/p/:slug` — `publicProfile.service.ts:73`
  //   3. la página de recibo, con botón y estrellas — `receipt.routes.ts:248`
  googleReviewUrl: 'avisos',
  notifyEmailOnPaid: 'avisos',
  notifyEmailOnQuoteAccepted: 'avisos',
  notifyEmailWeeklyDigest: 'avisos',
  // ── marca ──
  logoUrl: 'marca',
  'brand-color-input': 'marca',
  // ── publica ── los `qr-*` son controles DE la superficie del QR, que vive en la tarjeta de la
  // página pública. No son ajustes sueltos con destino propio: van donde va su superficie.
  'pp-slug': 'publica',
  'pp-zones': 'publica',
  'pp-years': 'publica',
  'qr-formato': 'publica',
  'qr-size': 'publica',
  'qr-dark': 'publica',
  // ── equipo ── «Importe máximo sin aprobación» gobierna las aprobaciones del equipo y no cabía en
  // ninguno de los nueve del ticket: por eso el fundador abrió el décimo.
  approvalThreshold: 'equipo',
};

/**
 * LA SEGUNDA POBLACIÓN — superficies, no campos.
 *
 * La pantalla también tiene BLOQUES que no son campos, y un mapa hecho solo sobre los 25 campos los
 * deja sin sitio: el mismo fallo mudo con otra cara. Aquí van los que SÍ entran en un submenú.
 *
 * ⚠️ Y NO ES DECORACIÓN: es lo que permite comprobar que las dos poblaciones CUADRAN. Los `pp-*` y
 * los `qr-*` están asignados a `publica` como campos, pero quien los pinta es
 * `renderPublicProfileCard`. Si esa tarjeta acabara en otro panel, esos seis campos estarían en el
 * mapa diciendo una cosa y en pantalla apareciendo en otra — y el guard de campos, mirando solo el
 * mapa, seguiría verde. Lo destapó este guard, no una lectura.
 */
var ASIGNACION_SUPERFICIE = {
  renderPublicProfileCard: 'publica',
  // Contador de consumo: no persiste nada, así que no es un ajuste y no tiene campos en el mapa.
  // Vive en Avisos porque habla de lo que se envía, pero queda FUERA del guard de campos.
  renderWaFairUseCard: 'avisos',
  // Bloque inline (no es una funcion render...): estado de Stripe Connect. Es estado + accion, no
  // un ajuste, pero cae solo en Cobros — es de lo que va el submenu.
  connectStatus: 'cobro',
  // SCRUM-298 (A8) · el modo de emision. Bloque inline, como `connectStatus`: es ESTADO, no un
  // ajuste, asi que no tiene campo en el mapa y queda fuera del guard de campos. Cae en
  // Cumplimiento porque es de lo que va el submenu — que documento fiscal sale hoy.
  modoEmision: 'cumplimiento',
  // SCRUM-420 (B1 · incremento 2) · el enlace a «Descargar datos», que SALE de la barra lateral.
  // Lo pedía el diseño §B1 y lo declaraba el propio hueco de `datos` en `VACIOS_DECLARADOS`:
  // «la página YA EXISTE (SCRUM-244) y NO se rehace: aquí solo cambiará de dónde se enlaza, y eso
  // es el incremento de la sidebar». Con esto `datos` deja de estar vacío y sale de esa lista —
  // los dos en el mismo commit, porque el sentido ④ del trinquete cae si van separados.
  renderDescargarDatosCard: 'datos',
};

/**
 * SUPERFICIES CON COLOCACIÓN PROVISIONAL — declarada, con su fecha de caducidad escrita.
 *
 * ⚠️ EXISTE PORQUE «TEMPORAL» ES EXACTAMENTE COMO SE QUEDAN LAS COSAS. Sacar «Invita y gana» de
 * Configuración es correcto y su destino es la barra lateral, pero **su entrada en la barra lateral
 * es el incremento 2**. Entre un incremento y el otro la tarjeta existiría en el código y no la
 * llamaría nadie: el programa de referidos paga un mes gratis al referidor, así que dejarla
 * inalcanzable «solo durante un PR» es una REGRESIÓN DE DINERO, no un detalle de orden.
 *
 * Se sigue pintando donde está hoy —tarjeta suelta al final de Configuración, fuera de los diez
 * paneles— y aquí queda escrito que es provisional y qué la sustituye.
 */
var SUPERFICIES_PROVISIONALES = {
  // SCRUM-314 (D3) · «Eliminar datos de ejemplo», de Luis. Entró en `main` mientras se construían
  // los submenús y es una superficie que este mapa no conocía.
  //
  // SU DESTINO NATURAL SERÍA «Tus datos» —es un acto sobre los datos de la cuenta— **y aun así no va
  // ahí**: el botón SOLO se pinta en la cuenta demo (`esCuentaDemo`, derivado de `isDemoMerchant`; la
  // ruta lo rechaza además por su cuenta). Meterlo en ese panel dejaría «Tus datos» vacío para todo
  // el mundo menos el demo, y **un submenú que aparece vacío para el 99 % de los usuarios es peor que
  // el hueco declarado que ya tiene**: el hueco al menos dice que todavía no hay nada, mientras que
  // un panel que se llena para uno y no para el resto parece roto.
  //
  // Cuando «Tus datos» tenga contenido propio (portabilidad, borrar cuenta), se muda ahí y esta línea
  // se va. Hasta entonces cuelga del `form`, fuera de los diez paneles.
  huecoDatosEjemplo: {
    motivo:
      'Su destino natural es «Tus datos» —es un acto sobre los datos de la cuenta— pero el botón SOLO ' +
      'existe en la cuenta demo, y colocarlo ahí dejaría ese panel vacío para todos los demás. Un ' +
      'submenú que aparece vacío para el 99 % de los usuarios es peor que el hueco declarado que ya ' +
      'tiene: el hueco dice que todavía no hay nada, y un panel que se llena para uno solo parece roto.',
    sustituye: 'quien construya el contenido propio de «Tus datos» (portabilidad, borrar cuenta)',
    // La OTRA MITAD: los identificadores que demuestran que se sigue pintando. Sin esto, «declarada»
    // y «existente» serían la misma frase, y una función declarada pero no montada es la regresión
    // que la declaración existe para impedir.
    seMontaCon: ['huecoEjemplo', 'montarDatosDeEjemplo'],
  },
  renderReferralCard: {
    motivo:
      'Su destino es la barra lateral —no es un ajuste, no persiste nada— pero hasta que exista esa ' +
      'entrada se sigue pintando en Configuración para no dejar inalcanzable un programa que paga ' +
      'dinero al referidor. Dejarla sin llamar «solo durante un PR» es una regresión real.',
    sustituye: 'el incremento 2 de B1 (barra lateral)',
    seMontaCon: ['renderReferralCard'],
  },
};

/**
 * SUPERFICIES QUE NO VAN A NINGÚN SUBMENÚ — decidido, con su motivo.
 */
var SUPERFICIES_FUERA_DE_LOS_DIEZ = {
  renderReadinessCard:
    'ÍNDICE DE ESTADO, no superficie de Configuración. Sus tres elementos (whatsappPhone, iban, ' +
    'taxId) no son campos propios: son REFERENCIAS a campos que ya viven en Empresa y en Cobro. Va ' +
    'en la cabecera, fuera de los diez — y así el «tres destinos» deja de existir como problema.',
  renderReferralCard:
    '«Invita y gana» no es un ajuste: no guarda nada. Sale de Configuración a la barra lateral.',
};

/**
 * FUERA DE CONFIGURACIÓN — decidido, no pendiente. Sin esta tercera categoría, sacar algo de
 * Configuración sería indistinguible de olvidarlo.
 */
var FUERA_DE_CONFIGURACION = {
  'ref-link':
    '«Invita y gana meses gratis» NO es un ajuste: por la regla del fundador un ajuste se guarda y ' +
    'persiste, y esto no guarda nada. Sale a la barra lateral; la clave `referidos` desaparece del mapa.',
};

/** SIN SITIO TODAVÍA — declarado, no olvidado. Hoy vacío: `googleReviewUrl` ya se decidió. */
var PENDIENTES_DE_DECISION = {};

/**
 * SUBMENÚS VACÍOS A PROPÓSITO — hueco declarado, no error. Se llenan con bloques que HOY NO EXISTEN.
 * No puede crecer en silencio: si uno de aquí pasa a tener campos, el sentido ④ falla.
 *
 * ⚠️ `equipo` NO está aquí, y esa es la corrección que hizo el propio mecanismo: el encargo lo
 * listaba como vacío, pero `approvalThreshold` ya estaba colocado ahí por el fundador.
 */
// SCRUM-483 · `facturacion` SALE de aquí, y no por una decisión: por un HECHO MEDIDO. Su texto
// decía que el prefijo —lo único que existía— «va a Numeración por el nombre del submenú». En
// este mismo commit el prefijo SE MUDÓ aquí, así que ese submenú ya tiene contenido y la
// declaración de hueco pasó a ser FALSA. Una declaración falsa se lee igual que una cierta,
// que es exactamente el motivo por el que esta lista existe.
// ⚠️ `cumplimiento` NO se toca: no está en esta lista y aquí no se decide nada sobre él.
var VACIOS_DECLARADOS = {};

// ⚠️ ESTÁ VACÍA A PROPÓSITO, Y ESTO ES LA DECLARACIÓN QUE LO DICE.
// Sin esta constante, «vacía porque ya no quedan huecos» y «vacía porque alguien la borró» se
// leen igual — y el guard de SCRUM-284 no puede distinguirlas, así que tiene que caer.
// El último hueco era `facturacion`, y salió al mudarse aquí `invoiceSeriesPrefix` (SCRUM-483).
// El otro, `numeracion`, se retiró por el veto escrito en la descripción de SCRUM-277.
var VACIOS_DECLARADOS_VACIA_PORQUE =
  'No quedan submenús vacíos: `numeracion` se retiró (veto de SCRUM-277) y `facturacion` dejó ' +
  'de estarlo al recibir `invoiceSeriesPrefix` (SCRUM-483). Estado terminal, no una lista borrada.';

// ⚠️ `datos` ESTUVO AQUÍ y se ha retirado (SCRUM-420, B1 · incremento 2, 10-ago-2026). Su motivo
// decía que «aquí solo cambiará de dónde se enlaza, y eso es el incremento de la sidebar» — y ese
// incremento es éste: `renderDescargarDatosCard` ya coloca el enlace en el panel, así que el hueco
// dejó de serlo. Se retira en vez de reescribirse, por lo mismo que se retiró `cumplimiento`: un
// hueco declarado que ya tiene contenido no es un hueco con otro motivo, deja de ser un hueco.
//
// El sentido ④ del trinquete lo habría cazado en el siguiente `npm test` si se hubiera dejado — y
// esa es la razón de que la retirada vaya en el MISMO commit que el enlace, no en el siguiente.
//
// Lo que NO ha cambiado: «Tus datos» sigue sin contenido PROPIO. Portabilidad y borrar cuenta no
// están en la pantalla, y el hueco de datos de ejemplo (SCRUM-314) sigue fuera de los diez paneles
// con su motivo escrito en `SUPERFICIES_PROVISIONALES`. Este panel ya no está vacío; no está lleno.

// ⚠️ `cumplimiento` ESTUVO AQUÍ y se ha retirado (SCRUM-298, A8, 7-ago-2026). Su motivo decía
// «nada de eso existe todavía en la pantalla», y desde que el modo de emisión vive dentro del
// submenú **ya no es cierto**: `vaciosQueYaNoLoEstan` lo habría cazado en el siguiente `npm test`.
//
// Se retira en vez de reescribirse porque un hueco declarado que ya tiene contenido no es un hueco
// con otro motivo: deja de ser un hueco. **Una excepción que sobrevive a su causa deja de ser una
// nota y pasa a ser un permiso** — aquí, permiso para que el panel se quedara vacío sin que nada
// avisara.
//
// Lo que NO ha cambiado: de A7/A8 solo entra la VISIBILIDAD del modo. La firma, las evidencias y
// el modal de dos caminos siguen sin existir en la pantalla, y su motivo está en
// `docs/master/SCRUM-298.md` — no aquí, para no tener dos sitios diciendo lo mismo.

/**
 * Submenú de un campo. **LANZA si la clave no está en el mapa** — a propósito: un campo que nadie
 * ha colocado no puede pintarse «donde caiga», porque eso es exactamente cómo un ajuste desaparece
 * en una reorganización sin que nadie lo note. Fallar aquí es ruidoso; caer en el sitio equivocado
 * es mudo.
 */
function submenuDeCampo(clave) {
  var destino = ASIGNACION_SUBMENU[clave];
  if (!destino) throw new Error('[settings] campo sin submenú en el mapa: ' + clave);
  return destino;
}

/** Submenú de una SUPERFICIE. Lanza igual que el de campos, y por lo mismo. */
function submenuDeSuperficie(nombre) {
  var destino = ASIGNACION_SUPERFICIE[nombre];
  if (!destino) throw new Error('[settings] superficie sin submenú en el mapa: ' + nombre);
  return destino;
}

/** @returns el reparto y los cuatro sentidos del trinquete. */
function revisarAsignacion(clavesDelCenso) {
  var sinSitio = clavesDelCenso.filter(function (c) {
    return !(c in ASIGNACION_SUBMENU) && !(c in PENDIENTES_DE_DECISION) && !(c in FUERA_DE_CONFIGURACION);
  });

  var destinosInexistentes = Object.keys(ASIGNACION_SUBMENU)
    .filter(function (campo) { return SUBMENUS.indexOf(ASIGNACION_SUBMENU[campo]) === -1; })
    .map(function (campo) { return campo + ' → «' + ASIGNACION_SUBMENU[campo] + '»'; });

  var porSubmenu = {};
  SUBMENUS.forEach(function (s) { porSubmenu[s] = []; });
  clavesDelCenso.forEach(function (clave) {
    var destino = ASIGNACION_SUBMENU[clave];
    if (destino && porSubmenu[destino]) porSubmenu[destino].push(clave);
  });

  // ⚠️ SCRUM-284 · «VACÍO» ES DE LAS DOS POBLACIONES, y esto era un AGUJERO MEDIDO.
  //
  // Los sentidos ③ y ④ contaban solo CAMPOS. Con eso, colocar una SUPERFICIE en un submenú
  // declarado vacío no hacía saltar nada: el panel dejaba de estar vacío para el usuario y la lista
  // seguía declarando un hueco que ya no existía — que es exactamente la deuda-vuelta-excepción que
  // el trinquete existe para impedir, colándose por la población que no miraba.
  //
  // Lo destapó el merge de SCRUM-314: su hueco «Eliminar datos de ejemplo» es una superficie nueva,
  // y al preguntarse qué pasaría si fuese a «Tus datos» el guard respondió que nada.
  var superficiesPorSubmenu = {};
  SUBMENUS.forEach(function (s) { superficiesPorSubmenu[s] = []; });
  Object.keys(ASIGNACION_SUPERFICIE).forEach(function (nombre) {
    var destino = ASIGNACION_SUPERFICIE[nombre];
    if (superficiesPorSubmenu[destino]) superficiesPorSubmenu[destino].push(nombre);
  });
  var tieneAlgo = function (s) { return porSubmenu[s].length > 0 || superficiesPorSubmenu[s].length > 0; };

  return {
    sinSitio: sinSitio,
    destinosInexistentes: destinosInexistentes,
    submenusVacios: SUBMENUS.filter(function (s) { return !tieneAlgo(s) && !(s in VACIOS_DECLARADOS); }),
    vaciosQueYaNoLoEstan: Object.keys(VACIOS_DECLARADOS).filter(tieneAlgo),
    superficiesPorSubmenu: superficiesPorSubmenu,
    asignados: clavesDelCenso.filter(function (c) { return c in ASIGNACION_SUBMENU; }).length,
    pendientes: clavesDelCenso.filter(function (c) { return c in PENDIENTES_DE_DECISION; }).length,
    fuera: clavesDelCenso.filter(function (c) { return c in FUERA_DE_CONFIGURACION; }).length,
    submenus: SUBMENUS.slice(),
    porSubmenu: porSubmenu,
  };
}

if (typeof window !== 'undefined') {
  window.SUBMENUS = SUBMENUS;
  window.MARCA_MICROCOPY_SUBMENU = MARCA_MICROCOPY_SUBMENU;
  window.ASIGNACION_SUBMENU = ASIGNACION_SUBMENU;
  window.VACIOS_DECLARADOS = VACIOS_DECLARADOS;
  window.VACIOS_DECLARADOS_VACIA_PORQUE = VACIOS_DECLARADOS_VACIA_PORQUE;
  window.submenuDeCampo = submenuDeCampo;
  window.submenuDeSuperficie = submenuDeSuperficie;
  window.rotuloDeSubmenu = rotuloDeSubmenu;
  window.ASIGNACION_SUPERFICIE = ASIGNACION_SUPERFICIE;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VACIOS_DECLARADOS_VACIA_PORQUE,
    SUBMENUS: SUBMENUS,
    MARCA_MICROCOPY_SUBMENU: MARCA_MICROCOPY_SUBMENU,
    ASIGNACION_SUBMENU: ASIGNACION_SUBMENU,
    FUERA_DE_CONFIGURACION: FUERA_DE_CONFIGURACION,
    PENDIENTES_DE_DECISION: PENDIENTES_DE_DECISION,
    VACIOS_DECLARADOS: VACIOS_DECLARADOS,
    ASIGNACION_SUPERFICIE: ASIGNACION_SUPERFICIE,
    SUPERFICIES_FUERA_DE_LOS_DIEZ: SUPERFICIES_FUERA_DE_LOS_DIEZ,
    SUPERFICIES_PROVISIONALES: SUPERFICIES_PROVISIONALES,
    ROTULOS: ROTULOS,
    rotuloDeSubmenu: rotuloDeSubmenu,
    submenuDeCampo: submenuDeCampo,
    submenuDeSuperficie: submenuDeSuperficie,
    revisarAsignacion: revisarAsignacion,
  };
}
