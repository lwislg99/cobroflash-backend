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
  'empresa', 'facturacion', 'numeracion', 'cobro', 'avisos',
  'publica', 'marca', 'datos', 'cumplimiento', 'equipo',
];

// Regla 30: los rótulos de los diez NO están aprobados. Se pintan con el marcador y hay guard.
var MARCA_MICROCOPY_SUBMENU = '[PENDIENTE microcopy oficial]';

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
  invoiceSeriesPrefix: 'numeracion',
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
var VACIOS_DECLARADOS = {
  facturacion:
    'reglas de emisión (IVA por defecto, lugar de negocio). El prefijo, lo único que existe hoy, se ' +
    'va a Numeración por el nombre del submenú. Se llena con SCRUM-17 y siguientes.',
  datos:
    'descargar datos + portabilidad + borrar cuenta. La página YA EXISTE (SCRUM-244) y NO se rehace: ' +
    'aquí solo cambiará de dónde se enlaza, y eso es el incremento de la sidebar.',
  cumplimiento:
    'hueco para A7/A8 — VERI*FACTU, firma, evidencias. Nada de eso existe todavía en la pantalla ' +
    '(regla 7: cero claims fiscales hasta SIF-1 8/8).',
};

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

  return {
    sinSitio: sinSitio,
    destinosInexistentes: destinosInexistentes,
    submenusVacios: SUBMENUS.filter(function (s) { return porSubmenu[s].length === 0 && !(s in VACIOS_DECLARADOS); }),
    vaciosQueYaNoLoEstan: Object.keys(VACIOS_DECLARADOS).filter(function (s) { return (porSubmenu[s] || []).length > 0; }),
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
  window.submenuDeCampo = submenuDeCampo;
  window.submenuDeSuperficie = submenuDeSuperficie;
  window.ASIGNACION_SUPERFICIE = ASIGNACION_SUPERFICIE;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUBMENUS: SUBMENUS,
    MARCA_MICROCOPY_SUBMENU: MARCA_MICROCOPY_SUBMENU,
    ASIGNACION_SUBMENU: ASIGNACION_SUBMENU,
    FUERA_DE_CONFIGURACION: FUERA_DE_CONFIGURACION,
    PENDIENTES_DE_DECISION: PENDIENTES_DE_DECISION,
    VACIOS_DECLARADOS: VACIOS_DECLARADOS,
    ASIGNACION_SUPERFICIE: ASIGNACION_SUPERFICIE,
    SUPERFICIES_FUERA_DE_LOS_DIEZ: SUPERFICIES_FUERA_DE_LOS_DIEZ,
    submenuDeCampo: submenuDeCampo,
    submenuDeSuperficie: submenuDeSuperficie,
    revisarAsignacion: revisarAsignacion,
  };
}
