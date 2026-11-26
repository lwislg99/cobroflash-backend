// src/modules/invoicing/domain/libroRegistro.ts — SCRUM-296 (A6) · el LIBRO DE REGISTRO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ES Y POR QUÉ NO ES UNA TABLA MÁS
//
// El libro de facturas emitidas es lo primero que pide un asesor. Cualquier facturador lo tiene.
// Lo que ningún facturador puede hacer es **enlazar cada asiento con su presupuesto, su albarán y
// su cobro**, porque no tiene los tres objetos atados. Aquí sí: es la trazabilidad completa de un
// euro, desde que se presupuestó hasta que entró.
//
// ⚠️ ES SOLO LECTURA sobre facturas YA EMITIDAS. No toca el camino de emisión (regla 38, que lo
// permite explícitamente para leer): no compone números, no reserva nada, no escribe.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SUELO, Y AQUÍ NO ES UNA FORMALIDAD
//
// Un libro vacío **no se lee como «no encontré nada»: se lee como «no facturaste nada»**, y eso
// ante Hacienda no es un hueco, es una afirmación. Por eso el resultado lleva SIEMPRE `miradas`:
// cuántas facturas se examinaron. Cero asientos con `miradas: 0` significa «no había»; cero
// asientos con `miradas: 40` significa **que algo está roto**, y quien lo consuma puede
// distinguirlo. Sin ese número, las dos cosas se leen igual de tranquilizadoras.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS IMPORTES NO SE COERCIONAN NUNCA (familia SCRUM-271)
//
// `Number('')` es `0` y `Number([])` es `0`. Un total ilegible convertido en `0,00 €` es un
// asiento que **afirma** que esa factura no cobró nada — y en un libro de registro eso es peor
// que no tener la fila. Un importe que no se puede leer sale como `null` y se cuenta aparte, con
// su número de factura delante.
import { calcVatBreakdown } from './vat.service';
import type { Causa } from './vat.service'; // SCRUM-1063e
import { partirPorSuplido } from './suplidos'; // SCRUM-1063c
import { filasVivas, centimosDe, prorratear, type FilaDeCobro, type TramoDeDevengo } from './devengoPorCaja'; // SCRUM-1732d

/**
 * SCRUM-1063c · el desglose de las líneas de suplido, con la MISMA función que `porTipo`. No llama a
 * `desgloseConSuplidos` ni toca `porTipo`: solo dice qué parte de él son suplidos.
 */
function suplidosPorTipo(lineas: any[]): AsientoLibro['suplidosPorTipo'] {
  const particion = partirPorSuplido(lineas);
  if (!particion.ok) return null;
  return calcVatBreakdown(particion.suplidos).entries.map((e) => ({ tipo: e.rate, base: e.base, cuota: e.cuota }));
}

/** Lo que el libro necesita de cada factura. Deliberadamente poco: esto solo LEE. */
export interface FacturaParaLibro {
  /** Opcional a propósito: sin `id` el asiento se construye igual, solo pierde los albaranes vivos. */
  id?: number;
  merchantId: number;
  number: string | null;
  createdAt: Date | string | null;
  type: string | null;
  total: unknown;
  currency: string | null;
  status: string | null;
  customerId: number | null;
  /** SCRUM-1058c · las columnas congeladas al emitir (`clienteCongelado.ts`). Opcionales: el 303 no las pide. */
  customerName?: string | null;
  customerLegalName?: string | null;
  customerTaxId?: string | null;
  quoteId: number | null;
  chargeId: number | null;
  albaranRefs: unknown;
  lines: unknown;
}

export interface AsientoLibro {
  numero: string;
  fecha: string | null;
  tipo: string | null;
  clienteId: number | null;
  /**
   * SCRUM-1058c · el destinatario que se CONGELÓ en la factura. `null` = factura anterior al
   * escritor (`customerName` a NULL): ahí sólo queda la ficha viva. Se copia, no se resuelve.
   */
  clienteCongelado: { name: string; legalName: string | null; taxId: string | null } | null;
  base: number | null;
  cuota: number | null;
  /**
   * SCRUM-295 (A5) · el desglose POR TIPO de la misma factura, en porcentaje (21, 10, 4, 0…).
   *
   * ⚠️ Sale de la MISMA llamada a `calcVatBreakdown` que `base` y `cuota` de arriba — no de una
   * segunda pasada. Es lo que permite que el modelo 303 se construya SOBRE el libro en vez de
   * volver a agregar por su cuenta: si el 303 y el libro contasen por caminos distintos, un día
   * dirían cifras distintas y el profesional tendría dos documentos oficiales contradictorios
   * sin saber cuál miente.
   *
   * SCRUM-1063e · `causa` va SOLO en la entrada que la tiene (hoy, S2), con la convención de
   * `calcVatBreakdown`: sin S2 la entrada es la de siempre, sin la clave (SCRUM-1063 c.20746). Sin
   * ella el 303 no puede separar una ISP de una exenta ni de un suplido al mismo tipo.
   */
  porTipo: { tipo: number; base: number; cuota: number; causa?: Causa }[];
  /**
   * SCRUM-1063c · la parte de `porTipo` que son SUPLIDOS (`partirPorSuplido` de `suplidos.ts`,
   * pasada por el mismo `calcVatBreakdown`). Es un SUBCONJUNTO informativo: `porTipo`, `base` y
   * `cuota` siguen incluyéndolos, porque la base sellada todavía los incluye (regla 38; la decisión
   * del fundador, SCRUM-1063 c.20717, es esperar a la emisión). Sirve para que el 303 no le dé a una
   * línea de suplido el motivo de una exenta.
   *
   * `[]` = sin suplidos (o sin líneas). `null` = alguna marca de suplido ILEGIBLE: «no se sabe»,
   * no «no hay» (el suelo de `leerMarcaSuplido`).
   */
  suplidosPorTipo: { tipo: number; base: number; cuota: number }[] | null;
  total: number | null;
  /**
   * SCRUM-1732d (U′, c.22012) · los cobros de la factura (RIVA 61 decies.1: fecha, importe y medio de
   * cada cobro), de `invoice_payments`, sin las anuladas ni las anulaciones (Q4). `[]` sin criterio de
   * caja o sin filas (la factura `paid` sin filas se lee como hoy, c.21926 §①). `metodo: null` = no
   * consta el medio (Q3). `origen` es `fecha_origen` de la fila.
   */
  cobros: { fecha: string; importe: number; metodo: string | null; origen: string | null }[];
  /**
   * SCRUM-1055c (c.21863 ⑤; vía sin esquema, c.22874) · `true` = algún cobro vivo de la factura se
   * apuntó a mano sin decir qué día entró el dinero (`fecha_origen = 'marcado'`): su fecha es la del
   * marcado. `aviso` y `declarada` no la llevan. Sólo con criterio de caja (como `cobros`). Una
   * factura `paid` SIN filas no la lleva —no se afirma lo que no se sabe— y se cuenta en `cobrosSinFilas`.
   */
  cobroSinFechaDeclarada?: boolean;
  moneda: string | null;
  estado: string | null;
  /** ⚠️ `true` = el importe no se pudo leer. NO es cero: es «no se sabe». */
  importeIlegible: boolean;
  /** La trazabilidad del euro: de dónde viene, qué se entregó a cambio y dónde acabó. */
  enlaces: {
    presupuestoId: number | null;
    /**
     * `true` = ese presupuesto tiene FIRMA. `null` = esta factura no viene de un presupuesto.
     *
     * ⚠️ Se deriva de `Quote.signatureUrl`, NO de `acceptedAt`: aceptar y firmar no son lo
     * mismo, y en un libro que se le enseña a un tercero el enlace tiene que apuntar a la
     * prueba, no a la intención. El motivo largo está en `libroRegistro.repo.ts`.
     */
    presupuestoFirmado: boolean | null;
    /** Los albaranes SELLADOS en la factura (`albaranRefs`): lo que el documento dice. */
    albaranes: { albaranId: number | null; numero: string | null }[];
    /**
     * Albaranes que apuntan hoy a esta factura y NO estaban en el sello. No se añaden a la
     * lista de arriba —la factura emitida dice lo que dice, regla 29— pero tampoco se ocultan:
     * un descuadre entre el documento sellado y la relación viva es exactamente lo que un
     * libro de registro tiene que dejar ver.
     */
    albaranesNoSellados: number;
    cobroId: number | null;
  };
}

/** Un albarán que apunta HOY a la factura (relación viva), frente a los sellados en ella. */
export interface AlbaranVivo {
  albaranId: number;
  numero: string | null;
}

export interface LibroRegistro {
  asientos: AsientoLibro[];
  /** Cuántas facturas se examinaron. Es lo que distingue «no había» de «no supe leer». */
  miradas: number;
  /** Filas descartadas por no ser de este merchant. Se cuentan, nunca se tiran en silencio. */
  ajenas: number;
  /** Filas sin número: no son asiento (el número ES la identidad fiscal), pero se declaran. */
  sinNumero: number;
  /**
   * SCRUM-389 · el IMPORTE de esas filas sin número, no solo cuántas son.
   *
   * Lo pide Informes: su cuadro declara «N facturas sin desglose (total X €) no incluidas». Sin
   * este número, unificar los dos agregadores obligaría a Informes a enseñar un recuento sin su
   * importe — y un «hay 3 facturas fuera» sin decir cuánto dinero es no se puede revisar a mano,
   * que es exactamente lo que ese aviso pide que hagas.
   */
  sinNumeroImporte: number;
  /** Números de las facturas cuyo importe no se pudo leer. */
  importesIlegibles: string[];
  /**
   * SCRUM-1232 · justificantes de ESTE merchant que se dejaron fuera por no ser facturas.
   *
   * Sólo viene cuando se pidió el libro de EXPEDIDAS (`soloFacturas`, en el lector). Ausente
   * significa «no se filtró», no «cero»: el 303 pide el libro sin filtro y no tiene que parecer
   * que se ha mirado. Lo que un libro fiscal descarta se cuenta, igual que `ajenas` y `sinNumero`.
   */
  justificantesFuera?: number;
  /** SCRUM-1732d · Q3 · números de las facturas con algún cobro sin medio. Sólo con criterio de caja. */
  cobrosSinMedio?: string[];
  /** SCRUM-1732d · Q5 · lo cobrado por encima del total, por factura. No devenga. Sólo con caja. */
  cobradoDeMas?: { numero: string; importe: number }[];
  /** SCRUM-1055c · cuántos asientos llevan `cobroSinFechaDeclarada`. Sólo con caja; viaja con el dato. */
  cobrosSinFechaDeclarada?: number;
  /**
   * SCRUM-1055c · facturas de caja `paid` SIN ninguna fila en `invoice_payments` (anteriores a 1732, que
   * se leen como hoy): de su fecha no se sabe el origen, así que no llevan la señal y se CUENTAN aquí.
   */
  cobrosSinFilas?: number;
}

/** SCRUM-1732d · el devengo de una factura en el periodo: sus tramos y cuáles caen dentro. */
export interface DevengoDelPeriodo {
  tramos: readonly TramoDeDevengo[];
  totalCentimos: number;
  dentro: readonly boolean[];
}

/** La suma de las partes de `valor` que caen dentro del periodo. */
function parteDelPeriodo(valor: number, d: DevengoDelPeriodo): number {
  const partes = prorratear(valor, d.tramos, d.totalCentimos);
  return Math.round(partes.reduce((s, p, i) => (d.dentro[i] ? s + p * 100 : s), 0)) / 100;
}

/** Lee un importe SIN coercionar. Devuelve `null` si no es un número utilizable. */
function importe(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (Array.isArray(valor)) return null; // `Number([])` es 0 — familia SCRUM-271
  if (typeof valor === 'object' && typeof (valor as any).toString === 'function') {
    // Prisma `Decimal`: su `toString` es exacto; `Number()` directo también funcionaría, pero
    // pasar por el texto evita depender de la representación interna.
    const n = Number((valor as any).toString());
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function refsDeAlbaran(valor: unknown): { albaranId: number | null; numero: string | null }[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((r) => r && typeof r === 'object')
    .map((r: any) => ({
      albaranId: typeof r.albaranId === 'number' ? r.albaranId : null,
      numero: typeof r.numero === 'string' ? r.numero : null,
    }));
}

/**
 * Construye el libro. Puro: recibe las facturas ya leídas y no toca la base.
 *
 * ⚠️ FILTRA POR MERCHANT AQUÍ TAMBIÉN, aunque la consulta ya lo haga. No es desconfianza
 * decorativa: el guard de tenencia de SCRUM-243 tiene un agujero conocido (SCRUM-348), así que
 * apoyarse solo en él dejaría el aislamiento de este libro colgando de algo que ya se sabe
 * incompleto. Y lo que se filtra **se cuenta** (`ajenas`): un descarte silencioso en un documento
 * fiscal es indistinguible de un dato que nunca existió.
 */
export function construirLibroRegistro(params: {
  facturas: readonly FacturaParaLibro[];
  merchantId: number;
  /** Ids de presupuesto CON firma. Lo calcula quien lee la base; aquí solo se consulta. */
  presupuestosFirmados?: Iterable<number>;
  /** Albaranes que apuntan hoy a cada factura, por id de factura. */
  albaranesVivos?: ReadonlyMap<number, readonly AlbaranVivo[]>;
  /**
   * SCRUM-1732d · las filas de `invoice_payments` por id de factura. PRESENTE = criterio de caja: cada
   * asiento lleva sus `cobros` y el libro declara `cobrosSinMedio` y `cobradoDeMas`.
   */
  cobrosPorFactura?: ReadonlyMap<number, readonly FilaDeCobro[]>;
  /**
   * SCRUM-1732d · SOLO el libro que lee el 303 con caja: la parte de cada factura que devenga en el
   * periodo. Con ella los importes del asiento son los de sus tramos dentro, no los de la operación.
   */
  devengo?: ReadonlyMap<number, DevengoDelPeriodo>;
}): LibroRegistro {
  const asientos: AsientoLibro[] = [];
  const importesIlegibles: string[] = [];
  const firmados = new Set<number>(params.presupuestosFirmados ?? []);
  let ajenas = 0;
  let sinNumero = 0;
  let sinNumeroImporte = 0;
  const cobrosSinMedio: string[] = [];
  const cobradoDeMas: { numero: string; importe: number }[] = [];
  let cobrosSinFechaDeclarada = 0;
  let cobrosSinFilas = 0;

  for (const f of params.facturas) {
    if (f.merchantId !== params.merchantId) { ajenas += 1; continue; }
    if (typeof f.number !== 'string' || f.number === '') {
      sinNumero += 1;
      // El importe se acumula solo si se puede LEER: un total ilegible no suma cero (familia
      // SCRUM-271), se queda fuera y ya lo cuenta `sinNumero`.
      const suyo = importe(f.total);
      if (suyo !== null) sinNumeroImporte += suyo;
      continue;
    }

    const total = importe(f.total);
    const desglose = calcVatBreakdown(Array.isArray(f.lines) ? (f.lines as any[]) : []);
    // La base y la cuota salen del MISMO cálculo que usa la emisión: recomputarlas aquí con otra
    // fórmula sería un segundo sitio calculando lo mismo, y el libro acabaría cuadrando consigo
    // mismo en vez de con las facturas.
    const tieneLineas = Array.isArray(f.lines) && f.lines.length > 0;

    if (total === null) importesIlegibles.push(f.number);

    const presupuestoId = typeof f.quoteId === 'number' ? f.quoteId : null;
    const sellados = refsDeAlbaran(f.albaranRefs);
    const vivos = typeof f.id === 'number' ? (params.albaranesVivos?.get(f.id) ?? []) : [];
    // Un albarán vivo cuenta como «no sellado» si su id no está entre los del sello. Se compara
    // por id, no por número: el número es texto del merchant y puede cambiar de forma.
    const idsSellados = new Set(sellados.map((r) => r.albaranId).filter((n) => n !== null));
    const noSellados = vivos.filter((v) => !idsSellados.has(v.albaranId)).length;

    // SCRUM-1055c · `undefined` = factura que no va por caja; `[]` = de caja y SIN filas (el lector la pide).
    const crudas = typeof f.id === 'number' ? params.cobrosPorFactura?.get(f.id) : undefined;
    const filas = filasVivas(crudas ?? []);
    const cobros = filas.map((c) => ({
      fecha: c.fechaCobro.toISOString(),
      importe: (centimosDe(c.importe) ?? Number.NaN) / 100,
      metodo: c.metodo ?? null,
      origen: c.fechaOrigen ?? null,
    }));
    if (cobros.some((c) => c.metodo === null)) cobrosSinMedio.push(f.number);
    // SCRUM-1055c · sobre las filas VIVAS: una anulación (que nace `marcado`) no la enciende.
    const sinFechaDeclarada = cobros.some((c) => c.origen === 'marcado');
    if (sinFechaDeclarada) cobrosSinFechaDeclarada += 1;
    if (crudas !== undefined && crudas.length === 0 && f.status === 'paid') cobrosSinFilas += 1;
    const totalC = centimosDe(f.total);
    const cobradoC = filas.reduce((s, c) => s + (centimosDe(c.importe) ?? 0), 0);
    if (totalC !== null && cobradoC > totalC) cobradoDeMas.push({ numero: f.number, importe: (cobradoC - totalC) / 100 });

    const dev = typeof f.id === 'number' ? params.devengo?.get(f.id) : undefined;
    const porTipo = tieneLineas
      ? desglose.entries.map((e) => {
        const base = dev ? parteDelPeriodo(e.base, dev) : e.base;
        const cuota = dev ? parteDelPeriodo(e.cuota, dev) : e.cuota;
        return e.causa ? { tipo: e.rate, base, cuota, causa: e.causa } : { tipo: e.rate, base, cuota };
      })
      : [];
    const suplidos = suplidosPorTipo(tieneLineas ? (f.lines as any[]) : []);
    const suma = (k: 'base' | 'cuota') => Math.round(porTipo.reduce((s, e) => s + e[k] * 100, 0)) / 100;

    asientos.push({
      numero: f.number,
      fecha: f.createdAt instanceof Date
        ? f.createdAt.toISOString()
        : (typeof f.createdAt === 'string' ? f.createdAt : null),
      tipo: f.type ?? null,
      clienteId: typeof f.customerId === 'number' ? f.customerId : null,
      clienteCongelado: f.customerName != null
        ? { name: f.customerName, legalName: f.customerLegalName ?? null, taxId: f.customerTaxId ?? null }
        : null,
      base: tieneLineas ? (dev ? suma('base') : desglose.base) : null,
      cuota: tieneLineas ? (dev ? suma('cuota') : desglose.cuota) : null,
      // Mismo `desglose`, misma llamada: el 303 suma ESTO, así que no hay dos caminos que puedan
      // divergir. Sin líneas la lista va vacía — no cero, vacía: «no se puede desglosar» y
      // «desglosa a cero» son cosas distintas, y el 303 tiene que poder separarlas.
      // SCRUM-1732d: con `devengo` (sólo el 303 con caja), cada entrada es la parte de sus tramos.
      porTipo,
      suplidosPorTipo: suplidos && dev
        ? suplidos.map((x) => ({ tipo: x.tipo, base: parteDelPeriodo(x.base, dev), cuota: parteDelPeriodo(x.cuota, dev) }))
        : suplidos,
      total: total !== null && dev ? parteDelPeriodo(total, dev) : total,
      cobros,
      ...(params.cobrosPorFactura ? { cobroSinFechaDeclarada: sinFechaDeclarada } : {}),
      moneda: f.currency ?? null,
      estado: f.status ?? null,
      importeIlegible: total === null,
      enlaces: {
        presupuestoId,
        // `null` cuando no hay presupuesto: «no viene de uno» y «viene de uno sin firmar» son
        // cosas distintas, y un `false` para las dos las haría indistinguibles.
        presupuestoFirmado: presupuestoId === null ? null : firmados.has(presupuestoId),
        albaranes: sellados,
        albaranesNoSellados: noSellados,
        cobroId: typeof f.chargeId === 'number' ? f.chargeId : null,
      },
    });
  }

  return {
    asientos,
    miradas: params.facturas.length,
    ajenas,
    sinNumero,
    sinNumeroImporte: Math.round(sinNumeroImporte * 100) / 100,
    importesIlegibles,
    ...(params.cobrosPorFactura ? { cobrosSinMedio, cobradoDeMas, cobrosSinFechaDeclarada, cobrosSinFilas } : {}),
  };
}
