// tests/_asignacion-submenus.mjs — SCRUM-284 (B1): dónde va cada uno de los 25 campos.
//
// ── EL FALLO QUE ESTO IMPIDE ──────────────────────────────────────────────────
// «un ajuste que desaparece en una reorganización es el fallo mudo de este ticket. Nadie lo
// nota hasta que alguien va a cambiar su IBAN y no lo encuentra».
//
// El censo (`_censo-configuracion.mjs`) dice QUÉ hay. Esto dice DÓNDE va.
//
// ── 🔴 EL TRINQUETE ERA DE UN SOLO SENTIDO, Y ESO TENÍA UN AGUJERO ────────────
// La primera versión de este mapa vigilaba «ningún campo sin sitio» y NADA MÁS. Con eso, de las
// **11 claves de destino que usaba, solo 5 correspondían a un submenú de los diez**: `fiscales`,
// `whatsapp`, `moneda`, `serie`, `resenas` y `referidos` **no existían como submenú**. Y al revés,
// cinco de los diez submenús no tenían ni un campo. **El guard estaba VERDE todo el tiempo**,
// porque preguntaba si cada campo tenía un sitio, no si el sitio existía.
//
// Es el mismo fallo mudo un piso más arriba, y es el mismo trinquete de un solo sentido que ya
// mordió en SCRUM-299: **un baseline que solo vigila hacia arriba convierte una deuda declarada en
// excepción permanente.** Por eso ahora hay CUATRO comprobaciones y no una:
//
//   ① campo sin sitio            → rojo  (lo de siempre)
//   ② destino que no es submenú  → rojo  (el agujero: asignar a un sitio inventado)
//   ③ submenú sin campos         → rojo, SALVO que esté en `VACIOS_DECLARADOS` con su motivo
//   ④ vacío declarado que YA tiene campos → rojo también, para que la deuda se anote al saldarse
//
// La ④ es la que impide que esto degenere: si un submenú deja de estar vacío en silencio, la lista
// de excepciones sigue declarando un hueco que ya no existe, y nadie se entera nunca de cuándo se
// vació del todo. Misma propiedad que el censo heredado de SCRUM-267.
//
// ── 🔴 MICROCOPY SIN APROBAR ─────────────────────────────────────────────────
// Los nombres visibles de los grupos y submenús NO están aprobados (regla 30). Por eso aquí solo
// hay CLAVES internas, y el rótulo va marcado `[PENDIENTE microcopy oficial]`.
//
// ── LA LISTA HUMANA NO ES CENSO, PERO SÍ CONTROL CRUZADO ─────────────────────
// El censo derivado se dejó fuera tres campos (`createToggle`) con sus suelos en VERDE, y lo
// destapó contrastarlo con la lista del ticket. Por eso la lista del ticket vive aquí abajo TAL
// CUAL, y hay un test que reporta la diferencia en vez de callarla.

/** Rótulo pendiente de aprobación. Todo nombre visible pasa por aquí. */
export const PENDIENTE = (borrador) => `[PENDIENTE microcopy oficial] ${borrador}`;

/**
 * LOS DIEZ SUBMENÚS — el conjunto CERRADO de sitios que existen.
 *
 * Nueve salen de la descripción del ticket; el décimo (`equipo`) lo abrió el fundador al colocar
 * `approvalThreshold`, que no cabía en ninguno de los nueve.
 *
 * ⚠️ ESTA LISTA ES LO QUE HACE POSIBLE EL SENTIDO ② DEL TRINQUETE. Antes no existía: los destinos
 * se DERIVABAN de los valores de `ASIGNACION`, así que cualquier destino inventado se auto-declaraba
 * válido con solo escribirlo. Un conjunto que se define por lo que lo usa no puede detectar un uso
 * equivocado.
 */
export const SUBMENUS = [
  'empresa',
  'facturacion',
  'numeracion',
  'cobro',
  'avisos',
  'publica',
  'marca',
  'datos',
  'cumplimiento',
  'equipo',
];

/**
 * Los ASUNTOS que enumera el ticket, copiados literalmente y sin reordenar.
 * NO es el censo. Es el control cruzado.
 */
export const ASUNTOS_DEL_TICKET = [
  'datos de empresa', 'fiscales', 'dirección', 'WhatsApp', 'moneda',
  'prefijo de factura', 'IBAN/Bizum', 'reseñas de Google', 'avisos por email',
  'marca y color', 'invita y gana', 'página pública',
];

/**
 * Asignación campo → submenú. La clave es la del censo; el valor, una clave de `SUBMENUS`.
 * Los rótulos visibles NO se deciden aquí (microcopy sin aprobar).
 */
export const ASIGNACION = {
  // ── empresa ──────────────────────────────────────────────────────────────────
  // `taxId`/`address` (antes `fiscales`), `whatsappPhone` (antes `whatsapp`) y `defaultCurrency`
  // (antes `moneda`) caen aquí por la propia descripción del ticket: «Empresa — nombre, razón
  // social, NIF, dirección, país, moneda, teléfono WhatsApp». No es decisión nueva.
  name: 'empresa',
  legalName: 'empresa',
  taxId: 'empresa',
  address: 'empresa',
  whatsappPhone: 'empresa',
  defaultCurrency: 'empresa',
  country: 'empresa',
  // ── numeracion ───────────────────────────────────────────────────────────────
  // El ticket coloca el prefijo en DOS submenús a la vez (Facturación y Numeración): eso es una
  // contradicción interna, no una opción. Manda el nombre del submenú — una serie va en Numeración.
  // Facturación queda para reglas de emisión; Numeración, para series y contadores.
  invoiceSeriesPrefix: 'numeracion',
  // ── cobro ────────────────────────────────────────────────────────────────────
  iban: 'cobro',
  bizumPhone: 'cobro',
  clabe: 'cobro', // hermana del IBAN (México) — decisión del fundador
  // ── avisos ───────────────────────────────────────────────────────────────────
  notifyEmailOnPaid: 'avisos',
  notifyEmailOnQuoteAccepted: 'avisos',
  notifyEmailWeeklyDigest: 'avisos',
  // ── marca ────────────────────────────────────────────────────────────────────
  logoUrl: 'marca',
  'brand-color-input': 'marca',
  // ── publica ──────────────────────────────────────────────────────────────────
  'pp-slug': 'publica',
  'pp-zones': 'publica',
  'pp-years': 'publica',
  // Los `qr-*` son controles DE la superficie del QR, que vive dentro de la tarjeta de la página
  // pública (`renderPublicProfileCard`). No son ajustes sueltos con destino propio: van donde va
  // su superficie. Dejaron de ser huérfanos en cuanto se midió la segunda población.
  'qr-formato': 'publica',
  'qr-size': 'publica',
  'qr-dark': 'publica',
  // ── equipo ───────────────────────────────────────────────────────────────────
  // «Importe máximo sin aprobación» gobierna las aprobaciones del equipo. No cabía en ninguno de
  // los nueve del ticket, y por eso el fundador abrió el décimo submenú.
  approvalThreshold: 'equipo',
};

/**
 * FUERA DE CONFIGURACIÓN — decidido, no pendiente.
 *
 * No es lo mismo que «sin sitio»: su sitio está decidido y **no es un submenú**. Sin esta tercera
 * categoría, sacar algo de Configuración sería indistinguible de olvidarlo.
 */
export const FUERA_DE_CONFIGURACION = {
  'ref-link':
    '«Invita y gana meses gratis» NO es un ajuste: por la regla del fundador un ajuste se guarda y ' +
    'persiste, y esto no guarda nada — es una pantalla con un enlace. Sale a la barra lateral ' +
    '(`renderReferralCard` ya es una tarjeta con render propio, así que moverla es cambiar dónde se ' +
    'la llama, no rehacerla). La clave `referidos` desaparece del mapa.',
};

/**
 * SIN SITIO TODAVÍA — y declarado, no olvidado. La asignación es del fundador.
 */
export const PENDIENTES_DE_DECISION = {
  googleReviewUrl:
    'MEDIDO Y NO ENCAJA EN LA CONDICIÓN QUE SE LE PUSO. El criterio era «si es la petición ' +
    'automática de reseña tras el cobro → avisos; si es mostrarlas en la ficha pública → publica». ' +
    'Las DOS ramas son verdaderas a la vez, y hay una tercera: (1) WhatsApp automático al cliente ' +
    'tras el cobro — psp.routes.ts:221 y mpWebhook.routes.ts:181; (2) la ficha pública ' +
    '/p/:slug — publicProfile.service.ts:73; (3) la PÁGINA DE RECIBO, con botón y estrellas — ' +
    'receipt.routes.ts:248. Un campo, tres superficies. Lo decide el fundador.',
};

/**
 * SUBMENÚS VACÍOS A PROPÓSITO — hueco declarado, no error.
 *
 * Se llenan con bloques que HOY NO EXISTEN. El motivo va escrito por submenú: una excepción sin
 * motivo se hereda para siempre, y este mapa ya tuvo una lista de destinos que nadie revisó.
 *
 * ⚠️ Y no puede crecer en silencio: si un submenú de aquí PASA a tener campos, el guard también
 * falla (sentido ④) para que quien lo llene borre su línea y la deuda quede saldada por escrito.
 */
export const VACIOS_DECLARADOS = {
  facturacion:
    'reglas de emisión (IVA por defecto, lugar de negocio). El prefijo, que es lo único que existe ' +
    'hoy, se va a Numeración por el nombre del submenú. Se llena con SCRUM-17 y siguientes.',
  datos:
    'descargar datos + portabilidad + borrar cuenta. La página YA EXISTE y es trabajo de SCRUM-244 ' +
    'que NO se rehace: aquí solo cambiará de dónde se enlaza, y eso es el incremento de la sidebar.',
  cumplimiento:
    'hueco para A7/A8 — VERI*FACTU, firma, evidencias. Nada de eso existe todavía en la pantalla ' +
    '(regla 7: cero claims fiscales hasta SIF-1 8/8).',
};

/**
 * @returns {{sinSitio:string[], destinosInexistentes:string[], submenusVacios:string[],
 *            vaciosQueYaNoLoEstan:string[], asignados:number, pendientes:number,
 *            fuera:number, submenus:string[], porSubmenu:Record<string,string[]>}}
 */
export function revisarAsignacion(clavesDelCenso) {
  // ① campo sin sitio: ni asignado, ni declarado pendiente, ni sacado de Configuración.
  const sinSitio = clavesDelCenso.filter(
    (c) => !(c in ASIGNACION) && !(c in PENDIENTES_DE_DECISION) && !(c in FUERA_DE_CONFIGURACION),
  );

  // ② destino inventado: una asignación a algo que no es uno de los diez submenús.
  const destinosInexistentes = [...new Set(
    Object.entries(ASIGNACION)
      .filter(([, destino]) => !SUBMENUS.includes(destino))
      .map(([campo, destino]) => `${campo} → «${destino}»`),
  )];

  // Qué campos DEL CENSO acaban en cada submenú (solo los que existen de verdad hoy).
  const porSubmenu = Object.fromEntries(SUBMENUS.map((s) => [s, []]));
  for (const clave of clavesDelCenso) {
    const destino = ASIGNACION[clave];
    if (destino && porSubmenu[destino]) porSubmenu[destino].push(clave);
  }

  // ③ submenú sin un solo campo y sin estar declarado vacío.
  const submenusVacios = SUBMENUS.filter((s) => porSubmenu[s].length === 0 && !(s in VACIOS_DECLARADOS));

  // ④ el trinquete en el otro sentido: declarado vacío pero ya tiene campos.
  const vaciosQueYaNoLoEstan = Object.keys(VACIOS_DECLARADOS).filter((s) => (porSubmenu[s] || []).length > 0);

  return {
    sinSitio,
    destinosInexistentes,
    submenusVacios,
    vaciosQueYaNoLoEstan,
    asignados: clavesDelCenso.filter((c) => c in ASIGNACION).length,
    pendientes: clavesDelCenso.filter((c) => c in PENDIENTES_DE_DECISION).length,
    fuera: clavesDelCenso.filter((c) => c in FUERA_DE_CONFIGURACION).length,
    submenus: [...SUBMENUS],
    porSubmenu,
  };
}
