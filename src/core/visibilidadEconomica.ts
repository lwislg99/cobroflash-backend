// src/core/visibilidadEconomica.ts — SCRUM-597 (DOC-07) · P-DOC-3
//
// ÚNICO lugar donde se responde «¿este rol ve COSTE y MARGEN?». Mismo patrón que
// `entitlements.ts` (regla 34): las rutas PREGUNTAN aquí, no reimplementan el criterio.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA FIRMA QUE LO ORDENA (P-DOC-3, fundador, 7-sep-2026)
//
//   «Coste y margen los ven el PROPIETARIO y los ADMINS. Los técnicos NO.»
//
// Y no los ven EN NINGÚN SITIO: ni en el documento, ni en el catálogo, ni en la línea, ni
// derivables restando dos números que sí vean.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL PROPIETARIO NO ES UN ROL, Y POR ESO NO SE NOMBRA AQUÍ
//
// Medido antes de escribir esto: `TeamMember.role` sólo tiene DOS valores —`admin` y `tecnico`
// (`schema.prisma:967`)— y el propietario **no tiene fila en `team_members`**. Su sesión lleva
// `teamMemberId = null` y `requireAuth` la resuelve como `admin` (`authMiddleware.ts:33`).
//
// O sea que «propietario y admins» y «no es técnico» son EL MISMO CONJUNTO, hoy y medido. Se
// escribe como negación a propósito: una lista blanca de roles que ven (`['admin']`) diría lo
// mismo hoy y dejaría FUERA al propietario el día que alguien deje de sintetizarle el `admin`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 FAIL-CLOSED, Y ES LA DECISIÓN QUE MÁS IMPORTA AQUÍ
//
// Un rol que no se reconoce **NO VE**. Si mañana entra un tercer rol —«oficina», «comercial»—
// hereda la ocultación y alguien tiene que venir a este fichero a concedérsela con su motivo. Al
// revés (`role !== 'tecnico'`) el rol nuevo nacería VIENDO el margen del negocio sin que nadie lo
// haya decidido, y eso no se nota hasta que se nota.
//
// Es también lo que hace segura la ausencia de sesión: sin `userRole` no se ve nada.

/** Los roles que HOY existen en `team_members`. La lista es cerrada (regla 27). */
const ROLES_QUE_VEN_ECONOMIA: ReadonlySet<string> = new Set(['admin']);

/**
 * ¿Esta sesión ve coste y margen?
 *
 * `userRole` es el que deja `requireAuth`: `'admin'` para el propietario y para los
 * administradores, `'tecnico'` para los operarios.
 */
export function veEconomiaDelNegocio(userRole: string | null | undefined): boolean {
  return typeof userRole === 'string' && ROLES_QUE_VEN_ECONOMIA.has(userRole);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS SITIOS DONDE EL DATO VIVE
//
//   · CATÁLOGO  — `Product.cost` (`schema.prisma:848`). El margen NO se guarda: se DERIVA de
//     coste y precio en `public/dashboard/js/margenCatalogo.js`. Por eso basta con quitar el
//     coste: sin él, `margenDesde()` devuelve `null` y no hay nada que derivar.
//   · LÍNEA     — `costeUnitario` dentro de `Quote.lines` / `Invoice.lines`, congelado en el
//     momento de la venta (SCRUM-661).
//
// 🔴 SE OMITE LA CLAVE, NO SE PONE A CERO. Es la regla de SCRUM-661 y aquí importa el doble: un
// `0` significaría «costó cero», que es una afirmación que nadie ha hecho, y además dejaría al
// técnico un número del que restar. Ausente es ausente.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Un artículo del catálogo tal y como sale de `products.service`. */
type ConCoste = { cost?: unknown };

/**
 * El artículo sin su coste. Devuelve OTRO objeto: mutar el que viene reescribiría lo que el
 * llamador tenga guardado, y estas listas se reutilizan.
 */
export function sinCosteDeCatalogo<T extends ConCoste>(item: T): Omit<T, 'cost'> {
  const { cost: _fuera, ...resto } = item;
  return resto;
}

/** La lista entera. `map` y no un bucle: el llamador recibe una lista nueva, no la suya tocada. */
export function sinCosteDeCatalogoEnLista<T extends ConCoste>(items: readonly T[]): Array<Omit<T, 'cost'>> {
  return items.map(sinCosteDeCatalogo);
}

/**
 * Las líneas de un documento sin el coste congelado.
 *
 * `lines` viaja como `Json` en el schema, así que puede ser cualquier cosa: si no es una lista se
 * devuelve TAL CUAL. Inventar `[]` aquí borraría el documento de la pantalla para el técnico, y
 * un documento vacío es una mentira distinta pero mentira igual.
 */
export function sinCosteEnLineas(lines: unknown): unknown {
  if (!Array.isArray(lines)) return lines;
  return lines.map((l) => {
    if (!l || typeof l !== 'object' || Array.isArray(l)) return l;
    const { costeUnitario: _fuera, ...resto } = l as Record<string, unknown>;
    return resto;
  });
}


/**
 * UN DOCUMENTO ENTERO —presupuesto o factura— sin coste en ninguna de sus líneas.
 *
 * 🔴 TAMBIÉN LAS DEL PRESUPUESTO ANIDADO, y esto no es celo: medido, `getInvoiceDetailAdmin`
 * hace `include: { quote: true }`, así que el detalle de una factura ARRASTRA el presupuesto de
 * origen con sus líneas completas. Tapar sólo `lines` habría dejado el mismo coste saliendo por
 * `quote.lines`, en la misma respuesta. Es exactamente la puerta de atrás que este ticket existe
 * para cerrar, y por eso se resuelve AQUÍ y no en cada ruta: una boca que se olvide de la
 * anidación no es un despiste que se vea al leer el diff.
 */
export function sinCosteEnDocumento<T extends Record<string, unknown>>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc;
  const salida: Record<string, unknown> = { ...doc };
  if ('lines' in salida) salida.lines = sinCosteEnLineas(salida.lines);
  const anidado = salida.quote;
  if (anidado && typeof anidado === 'object' && !Array.isArray(anidado) && 'lines' in anidado) {
    salida.quote = { ...(anidado as Record<string, unknown>), lines: sinCosteEnLineas((anidado as Record<string, unknown>).lines) };
  }
  return salida as T;
}

/** La lista entera de documentos. */
export function sinCosteEnDocumentos<T extends Record<string, unknown>>(docs: readonly T[]): T[] {
  return docs.map(sinCosteEnDocumento);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ¿PUEDE ESTA OCULTACIÓN BORRAR EL DATO? MEDIDO: NO, Y POR QUÉ
//
// Es la pregunta obligada: si al técnico se le quitan las claves de la respuesta y el técnico
// GUARDA, su navegador devolvería el documento SIN ellas y la escritura las borraría. La
// ocultación habría destruido el hecho, en silencio — y el coste congelado de SCRUM-661 existe
// justo porque `Product.cost` es MUTABLE y sin él el margen real de una venta no se puede
// reconstruir «ni en teoría».
//
// No ocurre, y no es por cuidado: **no hay por dónde**. Medido sobre el árbol antes de escribir
// esto — `Quote.lines` se escribe en UN solo sitio, `POST /quote/create`
// (`quotes.routes.ts`, vía `canonicalLines`), y NO existe ningún endpoint que reescriba las
// líneas de un presupuesto ya creado: el panel sólo llama a `createQuote`, `accept` y `reject`
// (`api.js:1335-1384`). Las de la factura se escriben al EMITIR, y una factura emitida no se
// edita (regla 29).
//
// ⚠️ CONSECUENCIA QUE SÍ EXISTE, y se declara en vez de simularse: un presupuesto creado POR UN
// TÉCNICO nace sin `costeUnitario`, porque el campo ya no le llega. El servidor PODRÍA sellarlo
// desde el catálogo, pero la línea sólo referencia al producto por `concept` —texto libre, sin
// `productId`— así que hacerlo sería ADIVINAR de qué artículo se trata, y eso es fabricar un
// hecho: justo lo que SCRUM-661 existe para impedir. Queda dicho para el fundador.
