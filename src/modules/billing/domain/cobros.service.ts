// src/modules/billing/domain/cobros.service.ts — SCRUM-285 (B4)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ ES UN COBRO AQUÍ, Y POR QUÉ SON DOS POBLACIONES Y NO UNA
//
// El diseño §B4 pide un menú «Cobros = los cobros con su justificante». La tentación es listar
// `Charge` y ya está. **Medido: eso esconde dinero.**
//
// Un cobro por TRANSFERENCIA o EFECTIVO no crea `Charge`: `updateInvoiceStatusAdmin`
// (`system/invoiceAdmin.ts:93`) marca `paidAt` en la Invoice y no toca `Charge` en ningún punto,
// y `Invoice.chargeId` es nullable. O sea que los cobros que el profesional marca A MANO —los que
// más necesita repasar, porque nadie los ha confirmado por él— no aparecerían.
//
// > **Una pantalla que lista solo `Charge` no está incompleta: miente por omisión.**
//
// Así que la población es la UNIÓN, sin solaparse:
//   · todo `Charge` del merchant (pedido, cobrado o caducado);
//   · toda `Invoice` SIN `chargeId` — su cobro no pasó por ninguna pasarela. Cobrada (dinero que
//     entró y solo consta aquí) o pendiente (la deuda que hoy hay que deducir mirando Facturas).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-445 · LA FUSIÓN SE DISEÑÓ CONTRA UNA PROPIEDAD QUE NADIE COMPROBÓ QUE EXISTIERA
//
// La primera versión decía que `chargeId: null` impedía contar dos veces: «si la factura tiene
// charge, el charge ya la representa». **Era falso, y no a medias: el filtro no excluía NADA.**
// Medido: `Invoice.chargeId` **no lo escribe nadie en todo el árbol** — `ensureInvoiceForCharge`
// crea la factura del cobro con `merchantId, customerId, quoteId, number, type, total, currency,
// lines, pdfUrl, qrData` y sin ese campo. Así que cada cobro por pasarela salía DOS VECES: su
// `Charge` y su justificante. En la pantalla del dinero, ver el doble es peor que no ver.
//
// El campo está en el esquema, es nullable, y **parecía escrito**. Es el mismo defecto que
// `Job.direccion` en otra tabla: una columna declarada que nadie rellena, y un mecanismo apoyado
// encima como si estuviera llena.
//
// ── EL ENLACE QUE SÍ EXISTE, y por eso no hace falta tocar el esquema ─────────────────────
// `ensurePdfAndEvent` escribe un `Event{ chargeId, type: 'invoiced', payload.invoice_id }`
// (`lib/invoicing.ts:270`) — el ÚNICO sitio del árbol con ese tipo, y por él pasa todo
// `ensureInvoiceForCharge`. Ese evento es el vínculo real entre un cobro y su justificante.
//
// Desduplicar por ahí tiene una ventaja que escribir `chargeId` no tendría: **arregla también los
// justificantes que YA existen**, porque el evento se lleva escribiendo desde siempre. Escribir el
// campo arreglaría el futuro y dejaría los históricos duplicados.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL MÉTODO NO SE PUEDE SABER DE LA MITAD, Y NO SE INVENTA
//
// `Charge.method` existe. Y desde SCRUM-441 (fase 2), `Invoice.paidVia` TAMBIÉN: un cobro marcado a mano
// puede decir cómo entró el dinero, y esta fusión lo lee.
//
// ⚠️ ESTE PÁRRAFO DECÍA LO CONTRARIO —«`Invoice` NO guarda método de cobro»— y era cierto cuando se
// escribió. La columna llegó por otro carril y **el comentario siguió aquí afirmando lo viejo
// mientras el código mapeaba un `null` a fuego**: el dato se escribía y no lo leía nadie.
//
// Lo que NO cambia: `null` sigue siendo un valor legítimo —«no consta»— y no se rellena con un
// valor por defecto. Escribir «transferencia» porque suele serlo es exactamente el bug que
// `paidVia.ts` cierra («ante lo desconocido, no se toca el método del cobro y se grita en el
// log»). Sin `paidVia`, el cobro sale con `metodo: null` y la pantalla lo agrupa aparte,
// DICIÉNDOLO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA FECHA DE LA DEUDA es `createdAt`, y es la fiable
//
// «Antigüedad de la deuda» es de lo que está SIN cobrar, así que se mide desde que el cobro se
// pidió (o la factura se emitió) — dato que no se toca nunca. NO se usa `paidAt` ni `updatedAt`:
// ninguno es la fecha en que entró el dinero (hallazgo E0 del censo de este mismo ticket), y para
// la deuda ni siquiera hacen falta.
import { prisma } from '../../../core/db/prisma';
import { cuboDeCobro, metodoDeUnCobro } from './metodoDeCobro';

/**
 * La clave derivada, para que las dos poblaciones pasen por el MISMO sitio.
 *
 * 🔴 SE EXPORTA PARA QUE LAS FIXTURES DERIVEN DE ELLA. La de SCRUM-474 construía el cobro a mano y
 * se quedó atrás en cuanto este serializador estrenó `metodoCubo`: la vista filtraba por un campo
 * que la fixture no tenía, así que el test veía 0 filas y acusaba al filtro. Una fixture escrita a
 * mano vuelve a quedarse atrás la próxima vez; una que llama a esta función, no.
 */
export function camposDeMetodo(metodo: string | null): { metodoCubo: string } {
  return { metodoCubo: cuboDeCobro(metodo) };
}

/**
 * SCRUM-441 (fase 2) · el método DECLARADO en un cobro marcado a mano, normalizado a «no consta».
 *
 * Una cadena vacía no es un método: es la misma ausencia que `null`, escrita de otra forma. Se
 * unifican una sola vez, porque **dos maneras de decir «no consta» divergen en cuanto alguien filtre
 * por una de ellas**. Lo cazó el control negativo de SCRUM-441: `?? null` deja pasar `''`, porque
 * `??` solo cubre `null` y `undefined`.
 *
 * 🔴 SCRUM-499 · ESTA FUNCIÓN VIVÍA AQUÍ Y SE HA RETIRADO. Era idéntica a
 * `metodoDeclaradoEnFactura` de `metodoDeCobro.ts` (SCRUM-491) —a propósito: se escribieron con la
 * misma semántica para que unificarlas fuese UNA LÍNEA en cuanto las dos ramas estuvieran en
 * `main`—. Dos funciones iguales en dos ficheros no fallan el día que se escriben: fallan el día
 * que alguien arregla una. Ahora las TRES pantallas que enseñan un método leen por el mismo sitio.
 */

/** Un cobro, venga de donde venga. Forma ÚNICA para que la pantalla no sepa de dónde salió. */
export type Cobro = {
  origen: 'charge' | 'invoice';
  id: number;
  fecha: string;
  cliente: string | null;
  concepto: string | null;
  importe: string;
  moneda: string;
  /** `null` = no consta. NO es «otro»: es que nadie lo registró. Se conserva CRUDO. */
  metodo: string | null;
  /**
   * SCRUM-474 fase 2 · el método AGRUPADO, derivado de `PAID_VIA` **en el servidor**.
   *
   * El crudo se queda al lado —`card:stripe` no se pierde ni se migra— y esto es lo único que la
   * pantalla necesita para filtrar sin decidir nada fiscal: en qué cubo cae. Antes la vista tenía
   * su propia lista de cubos y su propia regla, o sea el conjunto cerrado duplicado en un sitio
   * donde no lo vigila nadie.
   *
   * ⚠️ Aquí NO viaja el texto de la celda: cómo se pinta el método es SCRUM-481, otro carril.
   */
  metodoCubo: string;
  estado: string;
  referencia: string | null;
  /** Número del documento, si lo hay. La pantalla lo clasifica con `tipoDeFactura`. */
  numero: string | null;
  tipo: string | null;
  invoiceId: number | null;
  chargeId: number | null;
};

/** Lo que la fusión necesita de un `Charge`. Los nombres son los del esquema: no se traducen. */
export type ChargeParaCobro = {
  id: number; createdAt: Date; amount: unknown; currency: string;
  method: string | null; status: string; concept: string | null; reference: string | null;
  customer?: { name: string | null } | null;
};

/** Lo que la fusión necesita de una `Invoice`. */
export type InvoiceParaCobro = {
  id: number; createdAt: Date; total: unknown; currency: string; status: string;
  number: string | null; type?: string | null;
  /**
   * SCRUM-441 (fase 2) · CÓMO ENTRÓ EL DINERO en un cobro marcado a mano.
   *
   * `null` = **no consta**, y se guarda así: la columna es nullable, sin `@default`, y no se
   * rellena por copia desde `Charge.method`. Un método por defecto sería inventarse el dato.
   */
  paidVia?: string | null;
  customer?: { name: string | null } | null;
};

/** Estados que cuentan como DEUDA: dinero pedido o facturado que todavía no ha entrado. */
export const ESTADOS_DEUDA = ['pending'] as const;

export function esDeuda(cobro: Pick<Cobro, 'estado'>): boolean {
  return (ESTADOS_DEUDA as readonly string[]).includes(cobro.estado);
}

/** Días que lleva pendiente. `null` si no es deuda — un cobro cobrado no tiene antigüedad de deuda. */
export function diasDeDeuda(cobro: Cobro, ahora = new Date()): number | null {
  if (!esDeuda(cobro)) return null;
  const desde = new Date(cobro.fecha).getTime();
  if (Number.isNaN(desde)) return null;
  return Math.max(0, Math.floor((ahora.getTime() - desde) / 86400000));
}

/**
 * Los cobros del merchant, las dos poblaciones fundidas y ordenadas por fecha.
 *
 * Multi-tenant: las dos consultas filtran por `merchantId` (regla 2).
 */
export async function listarCobros(merchantId: number): Promise<Cobro[]> {
  const [charges, candidatas, invoiced] = await Promise.all([
    prisma.charge.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      // `chargeId: null` se conserva y HOY NO EXCLUYE NADA — nadie escribe ese campo (ver arriba).
      // Se deja porque el día que alguien lo escriba será correcto, no porque filtre: quien
      // desduplica de verdad es el cruce con los eventos de abajo.
      where: { merchantId, chargeId: null },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
    }),
    // El vínculo REAL cobro → justificante. Multi-tenant por la relación (regla 2).
    prisma.event.findMany({
      where: { type: 'invoiced', charge: { merchantId } },
      select: { payload: true },
    }),
  ]);

  return fundirCobros({ charges, candidatas, invoiced });
}

/**
 * LA FUSIÓN, PURA: dadas las tres poblaciones, la lista sin duplicar.
 *
 * Se separa de la consulta a propósito. Lo que hay que poder probar es la DECISIÓN —quién sale,
 * quién se queda y quién se cae por duplicado— y probarla exige fabricar las tres poblaciones a
 * mano. Con la consulta dentro haría falta una base de datos, y el defecto que este ticket cierra
 * es justo de decisión: la fusión se apoyaba en un campo vacío.
 */
export function fundirCobros(entrada: {
  charges: ChargeParaCobro[];
  candidatas: InvoiceParaCobro[];
  invoiced: Array<{ payload: unknown }>;
}): Cobro[] {
  const { charges, candidatas, invoiced } = entrada;

  // Las facturas que YA están representadas por su `Charge` en esta misma lista.
  const yaLasTraeSuCharge = new Set(
    invoiced
      .map((e) => (e.payload as { invoice_id?: unknown } | null)?.invoice_id)
      .filter((id): id is number => typeof id === 'number'),
  );
  // ⚠️ Solo se quitan las que tienen charge. Un cobro marcado A MANO —transferencia, efectivo— no
  // genera ni `Charge` ni evento, así que no está en este conjunto y SIGUE saliendo. Desduplicar
  // no puede volver a esconder el dinero que la fase 1 sacó a la luz.
  // SCRUM-445 · EL VINCULO MANDA SOBRE EL EVENTO. Desde que `ensureInvoiceForCharge` escribe
  // `Invoice.chargeId`, una factura que nacio de un cobro lo dice ella misma. La consulta ya filtra
  // por esa columna; se comprueba TAMBIEN aqui a proposito, porque la decision —quien sale y quien
  // se cae— es lo que este modulo existe para poder probar sin base de datos.
  //
  // ⚠️ Sigue mirando el evento: los cobros ANTERIORES al arreglo tienen `chargeId` nulo y su unico
  // vinculo es el `Event`. Quitar esa via desduplicaria peor que antes para todo el historico.
  const vinculada = (inv: InvoiceParaCobro) =>
    (inv as { chargeId?: number | null }).chargeId != null || yaLasTraeSuCharge.has(inv.id);
  const sueltas = candidatas.filter((inv) => !vinculada(inv));

  const deCharge: Cobro[] = charges.map((ch) => ({
    origen: 'charge',
    id: ch.id,
    fecha: ch.createdAt.toISOString(),
    cliente: ch.customer?.name ?? null,
    concepto: ch.concept ?? null,
    importe: String(ch.amount),
    moneda: ch.currency,
    metodo: ch.method ?? null,
    ...camposDeMetodo(ch.method ?? null),
    estado: ch.status,
    referencia: ch.reference ?? null,
    numero: null,
    tipo: null,
    invoiceId: null,
    chargeId: ch.id,
  }));

  const deInvoice: Cobro[] = sueltas.map((inv) => ({
    origen: 'invoice',
    id: inv.id,
    fecha: inv.createdAt.toISOString(),
    cliente: inv.customer?.name ?? null,
    concepto: null,
    importe: String(inv.total),
    moneda: inv.currency,
    // 🔴 SCRUM-441 (fase 2) · AQUÍ HABÍA UN `null` A FUEGO, Y SU MOTIVO DEJÓ DE SER CIERTO.
    //
    // Decía «la Invoice no guarda método», y era verdad cuando se escribió. Ya no: existe
    // `Invoice.paidVia` y otro carril la ESCRIBE al marcar un cobro a mano. El `null` fijo hacía
    // que ese dato se escribiera y **no lo leyera nadie** — el cobro seguía saliendo en el cubo
    // «sin método» con su método delante.
    //
    // ⚠️ Y `null` SIGUE SIENDO POSIBLE, que es la mitad que no se toca: una factura sin `paidVia`
    // —las históricas, y las que se marquen sin elegir— sale igual que antes. `null` es «no
    // consta», no un hueco que rellenar: escribir «transferencia» porque suele serlo es el bug que
    // `paidVia.ts` cierra. Por eso pasa por la MISMA función que los demás y no se escribe el cubo
    // a mano: un `sin-metodo` a dedo dejaría de moverse el día que la clasificación cambie.
    // ⚠️ `?? null` NO basta: una cadena VACÍA no es un método, y `??` solo cubre null/undefined.
    // Lo cazó el control negativo —`paidVia: ''` salía como `metodo: ''`—. En una pantalla de
    // dinero, «» y `null` significan lo mismo y tienen que verse igual desde el primer día: dos
    // formas de decir «no consta» divergen en cuanto alguien filtre por una de ellas.
    // 🔴 SCRUM-499 · la lectura es la de `metodoDeCobro.ts`, la MISMA que leen Informes y el paquete
    // de evidencia de disputa. Antes vivía aquí copiada con la misma semántica; ahora hay una sola.
    // Estas facturas vienen por construcción SIN `Charge` (`chargeId: null`), así que la regla se
    // reduce a lo declarado — y aun así se entra por la puerta común, para que el día que la regla
    // cambie no haya que acordarse de este sitio.
    metodo: metodoDeUnCobro(inv),
    ...camposDeMetodo(metodoDeUnCobro(inv)),
    estado: inv.status,
    referencia: null,
    numero: inv.number,
    tipo: (inv as { type?: string | null }).type ?? null,
    invoiceId: inv.id,
    chargeId: null,
  }));

  return [...deCharge, ...deInvoice]
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}
