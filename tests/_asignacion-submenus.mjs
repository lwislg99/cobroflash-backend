// tests/_asignacion-submenus.mjs — SCRUM-284 (B1): dónde va cada uno de los 25 campos.
//
// ── EL FALLO QUE ESTO IMPIDE ──────────────────────────────────────────────────
// «un ajuste que desaparece en una reorganización es el fallo mudo de este ticket. Nadie lo
// nota hasta que alguien va a cambiar su IBAN y no lo encuentra».
//
// El censo (`_censo-configuracion.mjs`) dice QUÉ hay. Esto dice DÓNDE va, y el guard falla si
// un campo no está en ninguna de las dos listas de abajo. Un campo nuevo que nadie coloque no
// pasa en silencio: pasa en rojo.
//
// ── 🔴 MICROCOPY SIN APROBAR ─────────────────────────────────────────────────
// Los nombres visibles de los grupos y submenús NO están aprobados (regla 30: la microcopy la
// aprueba el fundador). Por eso aquí solo hay CLAVES internas, y el rótulo va marcado
// `[PENDIENTE microcopy oficial]`. Un guard comprueba que ningún rótulo se cuele sin marcador.
//
// ── LA LISTA HUMANA NO ES CENSO, PERO SÍ CONTROL CRUZADO ─────────────────────
// Lección propia de hoy: el censo derivado se dejó fuera tres campos (`createToggle`) y sus
// suelos estaban en verde. Lo destapó contrastarlo con la lista del ticket. Por eso la lista
// del ticket vive aquí abajo TAL CUAL, y hay un test que reporta la diferencia en los dos
// sentidos en vez de callarla.

/** Rótulo pendiente de aprobación. Todo nombre visible pasa por aquí. */
export const PENDIENTE = (borrador) => `[PENDIENTE microcopy oficial] ${borrador}`;

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
 * Asignación campo → submenú. La clave es la del censo; el valor, la clave interna del submenú.
 * Los rótulos visibles NO se deciden aquí (microcopy sin aprobar).
 */
export const ASIGNACION = {
  // datos de empresa
  name: 'empresa',
  legalName: 'empresa',
  logoUrl: 'marca',
  // fiscales + dirección
  taxId: 'fiscales',
  address: 'fiscales',
  // canal
  whatsappPhone: 'whatsapp',
  // documentos
  defaultCurrency: 'moneda',
  invoiceSeriesPrefix: 'serie',
  // cobro
  iban: 'cobro',
  bizumPhone: 'cobro',
  // reputación
  googleReviewUrl: 'resenas',
  // avisos por email
  notifyEmailOnPaid: 'avisos',
  notifyEmailOnQuoteAccepted: 'avisos',
  notifyEmailWeeklyDigest: 'avisos',
  // marca
  'brand-color-input': 'marca',
  // página pública
  'pp-slug': 'publica',
  'pp-zones': 'publica',
  'pp-years': 'publica',
  // invita y gana
  'ref-link': 'referidos',
};

/**
 * SIN SITIO TODAVÍA — y declarado, no olvidado.
 *
 * Son los cinco huérfanos que el censo destapó y que la lista del ticket NO menciona. NO se
 * asignan por cuenta propia: la asignación es del fundador. Están aquí para que el guard sepa
 * que se conocen, y para que un campo NUEVO —que no esté ni asignado ni aquí— siga cayendo.
 *
 * El motivo va escrito por campo: una excepción sin motivo se hereda para siempre.
 */
export const PENDIENTES_DE_DECISION = {
  approvalThreshold:
    'gobierna las APROBACIONES DE EQUIPO y no hay submenú de Equipo entre los que enumera el ' +
    'ticket. Es el que más pesa: no es un ajuste suelto, es un asunto entero sin sitio.',
  clabe:
    'CLABE interbancaria (México). Es hermana del IBAN, pero el ticket solo dice «IBAN/Bizum» ' +
    'y el país está en F3: agruparla con el IBAN puede ser correcto o puede esconder que hoy ' +
    'no aplica. Lo decide el fundador.',
  country:
    'selector de país. Puede ser de «datos de empresa» o puede ser un ajuste de nivel superior ' +
    'que condiciona a los demás (moneda, fiscalidad, métodos de cobro).',
  'qr-formato': 'opción de DESCARGA del QR, no un ajuste que se guarde. Puede que no pertenezca a ningún submenú.',
  'qr-size': 'ídem qr-formato.',
  'qr-dark': 'ídem qr-formato.',
};

/**
 * @returns {{sinSitio:string[], asignados:number, pendientes:number, submenus:string[]}}
 */
export function revisarAsignacion(clavesDelCenso) {
  const sinSitio = clavesDelCenso.filter(
    (c) => !(c in ASIGNACION) && !(c in PENDIENTES_DE_DECISION),
  );
  return {
    sinSitio,
    asignados: clavesDelCenso.filter((c) => c in ASIGNACION).length,
    pendientes: clavesDelCenso.filter((c) => c in PENDIENTES_DE_DECISION).length,
    submenus: [...new Set(Object.values(ASIGNACION))].sort(),
  };
}
