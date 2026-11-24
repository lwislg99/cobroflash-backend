// src/modules/invoicing/domain/libroRegistro.repo.ts — SCRUM-296 (A6) · el LECTOR del libro.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE FICHERO EXISTE, SEPARADO DEL CONSTRUCTOR
//
// `libroRegistro.ts` es puro y su guard PROHÍBE la palabra `prisma.`: así el que lo lea sabe,
// sin ejecutarlo, que ese módulo no puede escribir en el camino de emisión (regla 38). El día
// que la consulta viviera dentro, ese guard habría que aflojarlo — y un guard aflojado deja de
// vigilar lo que se escribió para vigilar. La consulta vive aquí, y aquí tiene el suyo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS TRES CONSULTAS LLEVAN `merchantId`. LAS TRES.
//
// No es ceremonia multi-tenant: en un libro de registro, colar la factura de otro no es una
// fuga de datos — es **declarar como propia la facturación de un tercero**. Y el `merchantId`
// viaja también en el `select`, para que el constructor pueda volver a comprobarlo y CONTAR lo
// que descarte. Si un día alguien quita el `where`, el libro no enseña facturas ajenas: las
// cuenta en `ajenas` y quien lo lea lo ve.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// «PRESUPUESTO FIRMADO» SE DERIVA DE `signatureUrl`, NO DE `acceptedAt` — Y ES UNA DECISIÓN
//
// Aceptar y FIRMAR no son lo mismo. `acceptedAt` dice que el cliente le dio a un botón;
// `signatureUrl` es el trazo, y es la PRUEBA el día que ese cliente diga que él no pidió esto.
// En un libro que existe para enseñárselo a un tercero, el enlace tiene que apuntar a la
// prueba, no a la intención. Es el mismo criterio que ya usa `metrics.service` para el paso
// «Que tu cliente firme» (SCRUM-314/315): un solo significado de «firmado» en toda la casa.
//
// ⚠️ Y la firma NO VIAJA. `signatureUrl` es un data-URI con el trazo del cliente — dato
// personal, y de paso decenas de KB por fila. Al libro llega solo el HECHO de que existe: el
// filtro `signatureUrl: { not: null }` se resuelve EN POSTGRES y de vuelta viene el `id`.
import {
  construirLibroRegistro,
  type LibroRegistro,
  type FacturaParaLibro,
  type AlbaranVivo,
  type DevengoDelPeriodo,
} from './libroRegistro';
// SCRUM-294 (fase B): qué fecha devenga. Se importa el criterio, no se copia la regla.
import { campoDeDevengo, CAMPO_EMISION, CAMPO_COBRO, fechaDeDevengo, topeDeDevengo, tramosDeDevengo, type FilaDeCobro } from './devengoPorCaja';
import { diaNaturalEn, inicioDelDiaEn, finDelDiaEn } from '../../../core/zonaDelMerchant';
/**
 * Lo mínimo del cliente Prisma que el lector usa. Se pide por parámetro (no se importa el
 * singleton) para que el test pueda apuntarlo a SU Postgres sin tocar ninguna variable de
 * entorno del proyecto — que es justo como se ha medido esto contra una base real.
 */
export interface ClienteDelLibro {
  invoice: { findMany(args: any): Promise<any[]> };
  quote: { findMany(args: any): Promise<any[]> };
  albaran: { findMany(args: any): Promise<any[]> };
  /**
   * SCRUM-1732d · `invoice_payments` (PR-1). Opcional en el tipo porque sin criterio de caja no se lee;
   * CON caja, si falta, el libro LANZA: «no pude leer los cobros» no se convierte en «no hubo cobros».
   */
  invoicePayment?: { findMany(args: any): Promise<any[]> };
}

export interface RangoLibro {
  merchantId: number;
  desde?: Date;
  hasta?: Date;
  /**
   * SCRUM-1445d (fase 1) · la zona del comercio para los años y topes del criterio de caja.
   * AUSENTE = la zona del proceso, como hasta hoy; la fase 2 se la pasa cada llamador.
   */
  zona?: string;
  /**
   * SCRUM-294 (fase B) · la configuración de criterio de caja **del merchant**, tal cual se lea.
   *
   * **AUSENTE** = no se preguntó, y el libro se comporta como siempre: por fecha de emisión. Es el
   * estado de hoy, porque la columna del merchant todavía no existe (ver la entrada del ticket).
   *
   * **PRESENTE** = se preguntó, y entonces manda `campoDeDevengo()`: si el valor no se puede leer,
   * **LANZA**. No se degrada a emisión — «sin criterio de caja» es un valor legítimo y degradar a
   * él esconde el fallo para siempre.
   */
  criterioCaja?: unknown;
  /**
   * SCRUM-1232 · `true` = el libro de facturas EXPEDIDAS: deja fuera los justificantes.
   *
   * 🔴 NO ES EL DEFECTO, Y NO LO PIDE EL 303. La norma separa las dos poblaciones (SCRUM-1232b,
   * `docs/master/SCRUM-1232.md`): el libro de expedidas son FACTURAS y nada más (RIVA 62.1.a y 63),
   * y el 303 declara lo DEVENGADO, no lo documentado (LIVA 75/167, RIVA 71). Un justificante documenta
   * una operación que devengó IVA aunque no se facturara: sacarlo del 303 INFRADECLARARÍA.
   *
   * Por eso es opcional y va apagado: lo encienden la pantalla del libro y el libro de la AEAT, y el
   * 303, las evidencias e Informes siguen leyendo lo de siempre. Encenderlo por defecto cambiaría el
   * 303 sin que su código moviera una letra. ⚠️ 2-oct-2026 · SCRUM-1252: las evidencias YA lo encienden (su 303, no).
   */
  soloFacturas?: boolean;
  /**
   * SCRUM-1732d (U′, c.22012) · `true` = el libro que lee el 303. Con criterio de caja trae las
   * facturas que DEVENGAN en el rango (`leerPorCaja`) con los importes de sus tramos dentro. Ausente,
   * el libro de expedidas: cada factura en el periodo de su EXPEDICIÓN, entera (RIVA 69.5 y 63.3), con
   * sus `cobros`. Sin caja no cambia nada.
   */
  devengo?: boolean;
}

/**
 * SCRUM-1232 · ¿Es un justificante de cobro? Por `type === 'JUST'`, y SÓLO por eso.
 *
 * 🔴 EL NÚMERO `J-` NO DECIDE, y es una decisión, no un olvido. `receipt.routes.ts:104` e
 * `invoiceAdmin.ts:251` miran también el número, y el censo del 10-ago-2026 contó **5 documentos `F1`
 * con número `J-`** (`PREGUNTAS_ASESOR.md:640-641`). La primera versión de este arreglo los sacaba del
 * libro por el número. El fundador dijo qué son (28-sep-2026, transmitido por el orquestador):
 * «Todos deberían ser facturas». Son FACTURAS con el número mal puesto, y sacarlas por el número le
 * quitaría cinco facturas a un libro que se entrega al gestor. Qué hacer con ellas es SCRUM-1252. Aquí
 * se quedan dentro, y el test lo vigila con la mutación «filtro también por número».
 *
 * ⚠️ El filtro va en el CÓDIGO y no en el `where`, para que un justificante AJENO que se colara siga
 * llegando al constructor y se cuente en `ajenas` (SCRUM-348), en vez de desaparecer en la consulta.
 */
export function esJustificante(f: { type: string | null }): boolean {
  return f.type === 'JUST';
}

/** Las columnas que el libro necesita. Explícitas: un `select` abierto traería la firma. */
const CAMPOS_FACTURA = {
  id: true,
  merchantId: true,
  number: true,
  createdAt: true,
  // SCRUM-294 (fase B): la fecha del COBRO. Es la que devenga con criterio de caja, y sin traerla
  // no se puede decidir en qué trimestre cae la factura de un merchant acogido al RECC.
  paidAt: true,
  type: true,
  total: true,
  currency: true,
  status: true,
  customerId: true,
  // SCRUM-1058c: el destinatario CONGELADO al emitir. Es el que declara el libro de expedidas.
  customerName: true,
  customerLegalName: true,
  customerTaxId: true,
  quoteId: true,
  chargeId: true,
  albaranRefs: true,
  lines: true,
  // SCRUM-1730f (c.21789 ③, c.22620): el criterio CONGELADO al sellar y, para una R1, su F1.
  merchantCriterioCaja: true,
  rectifiesId: true,
} as const;

type FacturaLeida = FacturaParaLibro & { id: number; merchantCriterioCaja?: boolean | null; rectifiesId?: number | null };

/**
 * SCRUM-1730f (GO c.21789 ③) · ¿hay ALGUNA factura del comercio sellada por caja? Si no, el libro es el de
 * siempre, por emisión, diga lo que diga el vivo. Se re-comprueba la fila: una ajena no cuenta (regla 2).
 */
async function hayFacturaPorCaja(db: ClienteDelLibro, merchantId: number): Promise<boolean> {
  const fs = await db.invoice.findMany({
    where: { merchantId: merchantId, merchantCriterioCaja: true },
    select: { id: true, merchantId: true, merchantCriterioCaja: true },
    take: 1,
  });
  return fs.some((f) => f.merchantId === merchantId && f.merchantCriterioCaja === true);
}

/**
 * SCRUM-1730f · las que devengan POR CAJA: su congelado es `true`. NULL o `false` = por emisión, sin caer
 * al vivo (c.21789 ③). Una R1 sin congelado propio hereda el de su F1 por `rectifiesId` (c.22620: «El
 * criterio es de la operación, no del papel»); sin original encontrada, NULL = emisión.
 */
async function idsPorCaja(db: ClienteDelLibro, merchantId: number, facturas: readonly FacturaLeida[]): Promise<Set<number>> {
  const idsOriginal = [...new Set(facturas
    .filter((f) => f.merchantCriterioCaja == null && typeof f.rectifiesId === 'number')
    .map((f) => f.rectifiesId as number))];
  const originales = idsOriginal.length === 0 ? [] : await db.invoice.findMany({
    where: { merchantId: merchantId, id: { in: idsOriginal } },
    select: { id: true, merchantId: true, merchantCriterioCaja: true },
  });
  const congeladoDe = new Map<number, boolean | null>(originales
    .filter((o) => o.merchantId === merchantId && idsOriginal.includes(o.id))
    .map((o) => [o.id, o.merchantCriterioCaja ?? null]));
  const ids = new Set<number>();
  for (const f of facturas) {
    const heredado = typeof f.rectifiesId === 'number' ? (congeladoDe.get(f.rectifiesId) ?? null) : null;
    if ((f.merchantCriterioCaja ?? heredado) === true) ids.add(f.id);
  }
  return ids;
}

/**
 * SCRUM-1730 (i) y (ii) · Las facturas que DEVENGAN en el rango con criterio de caja.
 *
 * Ya no basta con filtrar por `paidAt`: una factura con líneas S2 devenga por emisión, y una sin
 * cobro (o cobrada después del tope) devenga el 31-dic del año siguiente al de la operación. Quien
 * decide es `fechaDeDevengo`, una sola regla para todas; la base sólo trae CANDIDATAS, con tres
 * consultas de un rango cada una:
 *   · cobradas en el rango (las S1 de siempre);
 *   · emitidas en el rango (las S2, por emisión);
 *   · emitidas en un año cuyo 31-dic SIGUIENTE cae en el rango (las del tope).
 * Después, cada candidata entra sólo si su fecha de devengo está dentro. Una cobrada después del
 * tope sale como candidata por su `paidAt`, pero su devengo es el tope y se queda fuera: no se cuenta
 * dos veces.
 */
async function leerPorCaja(db: ClienteDelLibro, rango: RangoLibro):
  Promise<{ facturas: FacturaLeida[]; filas: Map<number, FilaDeCobro[]>; devengo: Map<number, DevengoDelPeriodo> }> {
  const { desde, hasta } = rango;
  const rangoDe = (gte?: Date, lte?: Date) => ({ ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) });
  const consulta = (where: Record<string, unknown>) =>
    db.invoice.findMany({ where: { merchantId: rango.merchantId, ...where }, select: CAMPOS_FACTURA }) as
      Promise<FacturaLeida[]>;

  // El tope de una factura emitida en el año X es el 31-dic de X+1. Los años X cuyo tope cae en el
  // rango van de (año de `desde`) − 1 hasta (último 31-dic que cabe antes de `hasta`) − 1.
  // SCRUM-1445d: con `rango.zona`, el año y sus bordes son los de esa zona; sin ella, los del proceso.
  const { zona } = rango;
  // El año se calcula AQUÍ y no en una flecha con nombre: el censo de 1093h clasifica por función
  // (`leerPorCaja`, AGREGADO), y una flecha nueva sería otra identidad sin clasificar.
  const añoDesde = desde ? (zona !== undefined ? Number(diaNaturalEn(desde, zona).slice(0, 4)) : desde.getFullYear()) : undefined;
  const añoHasta = hasta ? (zona !== undefined ? Number(diaNaturalEn(hasta, zona).slice(0, 4)) : hasta.getFullYear()) : undefined;
  const dia = (a: number, md: string) => `${String(a).padStart(4, '0')}-${md}`;
  const primeroDeEnero = (a: number) => (zona !== undefined ? inicioDelDiaEn(dia(a, '01-01'), zona) : new Date(a, 0, 1, 0, 0, 0, 0));
  const finDeAño = (a: number) => (zona !== undefined ? finDelDiaEn(dia(a, '12-31'), zona) : new Date(a, 11, 31, 23, 59, 59, 999));
  const primerX = añoDesde !== undefined ? añoDesde - 1 : undefined;
  const ultimoX = hasta && añoHasta !== undefined
    ? (hasta.getTime() >= topeDeDevengo(primeroDeEnero(añoHasta - 1), zona).getTime()
      ? añoHasta : añoHasta - 1) - 1
    : undefined;
  const hayTope = primerX === undefined || ultimoX === undefined || primerX <= ultimoX;

  const tandas = await Promise.all([
    consulta({ paidAt: rangoDe(desde, hasta) }),
    consulta({ createdAt: rangoDe(desde, hasta) }),
    hayTope
      ? consulta({ createdAt: rangoDe(
        primerX === undefined ? undefined : primeroDeEnero(primerX),
        ultimoX === undefined ? undefined : finDeAño(ultimoX),
      ) })
      : Promise.resolve([] as FacturaLeida[]),
    // SCRUM-1732d · las que tienen un TRAMO cobrado en el rango (`invoice_payments`, por `fecha_cobro`).
    leerFilasDeCobro(db, rango.merchantId, { fechaCobro: rangoDe(desde, hasta) }).then((fs) => {
      const ids = [...new Set(fs.map((f) => f.invoiceId))];
      return ids.length === 0 ? [] as FacturaLeida[] : consulta({ id: { in: ids } });
    }),
  ]);
  const candidatas = [...new Map(tandas.flat().map((f) => [f.id, f])).values()];
  // SCRUM-1730f · decide cada factura su congelado; solo las de caja traen cobros.
  const deCaja = await idsPorCaja(db, rango.merchantId, candidatas);
  const filas = await filasPorFactura(db, rango.merchantId, candidatas.filter((f) => deCaja.has(f.id)).map((f) => f.id));

  const dentro = (d: Date | null) => d !== null
    && (!desde || d.getTime() >= desde.getTime()) && (!hasta || d.getTime() <= hasta.getTime());
  const porId = new Map<number, { f: FacturaLeida; d: Date }>();
  const devengo = new Map<number, DevengoDelPeriodo>();
  for (const f of candidatas) {
    if (!deCaja.has(f.id)) {
      // SCRUM-1730f · sellada sin caja (o NULL): devenga entera en su emisión.
      const e = fechaDeDevengo(f as never, CAMPO_EMISION, zona);
      if (e && dentro(e)) porId.set(f.id, { f, d: e });
      continue;
    }
    // SCRUM-1732d · con filas, por TRAMOS: entra si alguno cae dentro, y se ordena por el primero.
    const t = tramosDeDevengo(f as never, filas.get(f.id), zona);
    if (t) {
      const marcas = t.tramos.map((x) => dentro(x.fecha));
      const i = marcas.indexOf(true);
      if (i >= 0) { porId.set(f.id, { f, d: t.tramos[i].fecha }); devengo.set(f.id, { ...t, dentro: marcas }); }
      continue;
    }
    const d = fechaDeDevengo(f as never, CAMPO_COBRO, zona);
    if (d && dentro(d)) porId.set(f.id, { f, d });
  }
  // Por fecha de devengo y, a igualdad, por número: el mismo orden que la consulta de siempre.
  const facturas = [...porId.values()]
    .sort((a, b) => a.d.getTime() - b.d.getTime() || String(a.f.number).localeCompare(String(b.f.number)))
    .map((x) => x.f);
  return { facturas, filas, devengo };
}

/** SCRUM-1732d · lee filas de `invoice_payments` del merchant. Sin el modelo, LANZA. */
async function leerFilasDeCobro(db: ClienteDelLibro, merchantId: number, where: Record<string, unknown>):
  Promise<(FilaDeCobro & { invoiceId: number; merchantId: number })[]> {
  if (!db.invoicePayment) {
    throw new Error('[libroRegistro] con criterio de caja hay que leer invoice_payments y este cliente no la trae: no se sigue como si no hubiera cobros');
  }
  const fs = await db.invoicePayment.findMany({
    // `merchantId:` escrito entero, no abreviado: es lo que lee el guard de tenencia (scrum296).
    where: { merchantId: merchantId, ...where },
    select: { id: true, merchantId: true, invoiceId: true, importe: true, fechaCobro: true, fechaOrigen: true, metodo: true, tipo: true, anulaId: true },
  });
  // Como las facturas: una fila ajena que se colara no cuenta (regla 2).
  return fs.filter((f) => f.merchantId === merchantId);
}

/** SCRUM-1732d · las filas de esas facturas, agrupadas por factura. */
async function filasPorFactura(db: ClienteDelLibro, merchantId: number, ids: number[]): Promise<Map<number, FilaDeCobro[]>> {
  const porFactura = new Map<number, FilaDeCobro[]>();
  if (ids.length === 0) {
    if (!db.invoicePayment) await leerFilasDeCobro(db, merchantId, {});
    return porFactura;
  }
  for (const f of await leerFilasDeCobro(db, merchantId, { invoiceId: { in: ids } })) {
    const l = porFactura.get(f.invoiceId) ?? [];
    l.push(f);
    porFactura.set(f.invoiceId, l);
  }
  return porFactura;
}

/**
 * Lee el libro de registro de UN merchant contra la base.
 *
 * Solo lectura: tres `findMany` y nada más. No compone números, no reserva, no escribe.
 */
export async function leerLibroRegistro(
  db: ClienteDelLibro,
  rango: RangoLibro,
): Promise<LibroRegistro> {
  const fecha: Record<string, Date> = {};
  if (rango.desde) fecha.gte = rango.desde;
  if (rango.hasta) fecha.lte = rango.hasta;

  // 🔴 SCRUM-294 (fase B) · QUÉ FECHA DECIDE EL TRIMESTRE.
  //
  // Con criterio de caja, el IVA se devenga al COBRAR: una factura emitida en un trimestre y
  // cobrada en otro declara en el del cobro. Aquí eso es, literalmente, por qué columna se filtra.
  //
  // Si nadie pregunta por el criterio (`criterioCaja` ausente) se filtra por emisión, que es lo que
  // este libro ha hecho siempre. Si alguien pregunta, manda `campoDeDevengo` — y una lectura
  // fallida LANZA en vez de caer a emisión.
  //
  // SCRUM-1730f (GO c.21789 ③) · el vivo ya NO decide qué factura va por caja: lo decide su congelado.
  // Se sigue leyendo para que una lectura fallida LANCE; el camino por caja corre si alguna está sellada así.
  const preguntado = 'criterioCaja' in rango;
  if (preguntado) campoDeDevengo(rango.criterioCaja);
  const campo = preguntado && await hayFacturaPorCaja(db, rango.merchantId) ? CAMPO_COBRO : CAMPO_EMISION;

  // SCRUM-1732d (U′) · con caja, SOLO el 303 (`devengo`) lee por devengo. El libro de expedidas va
  // por EXPEDICIÓN también con caja (RIVA 69.5): ni se trae al periodo del cobro ni se repite.
  const porDevengo = campo !== CAMPO_EMISION && rango.devengo === true && Object.keys(fecha).length > 0;
  const porCaja = porDevengo ? await leerPorCaja(db, rango) : null;
  const leidas = porCaja
    ? porCaja.facturas
    : ((await db.invoice.findMany({
      where: {
        merchantId: rango.merchantId,
        ...(Object.keys(fecha).length > 0 ? { [CAMPO_EMISION]: fecha } : {}),
      },
      select: CAMPOS_FACTURA,
      // Por fecha y, a igualdad, por número: dos facturas del mismo día tienen que salir en el
      // orden en que se emitieron, que es el de la serie.
      orderBy: [{ [CAMPO_EMISION]: 'asc' }, { number: 'asc' }],
    })) as unknown as FacturaLeida[]);

  // SCRUM-1232 · fuera los justificantes, pero SÓLO los de este merchant: uno ajeno que se colara
  // tiene que llegar al constructor para contarse en `ajenas`, no desaparecer aquí (SCRUM-348).
  const esJustificanteMio = (f: FacturaParaLibro) =>
    f.merchantId === rango.merchantId && esJustificante(f);
  const facturas = rango.soloFacturas ? leidas.filter((f) => !esJustificanteMio(f)) : leidas;

  const idsFactura = facturas.map((f) => f.id).filter((n) => typeof n === 'number');
  const idsPresupuesto = [
    ...new Set(facturas.map((f) => f.quoteId).filter((n): n is number => typeof n === 'number')),
  ];

  // Las dos consultas de enlace se piden a la vez: son independientes y ninguna depende del
  // resultado de la otra.
  const [firmados, albaranes] = await Promise.all([
    idsPresupuesto.length === 0
      ? Promise.resolve([] as { id: number }[])
      : (db.quote.findMany({
          where: {
            merchantId: rango.merchantId,
            id: { in: idsPresupuesto },
            // El filtro se resuelve en Postgres: el data-URI de la firma no sale de la base.
            signatureUrl: { not: null },
          },
          select: { id: true },
        }) as Promise<{ id: number }[]>),
    idsFactura.length === 0
      ? Promise.resolve([] as { id: number; numero: string; invoiceId: number }[])
      : (db.albaran.findMany({
          where: { merchantId: rango.merchantId, invoiceId: { in: idsFactura } },
          select: { id: true, numero: true, invoiceId: true },
        }) as Promise<{ id: number; numero: string; invoiceId: number }[]>),
  ]);

  const albaranesVivos = new Map<number, AlbaranVivo[]>();
  for (const a of albaranes) {
    const lista = albaranesVivos.get(a.invoiceId) ?? [];
    lista.push({ albaranId: a.id, numero: a.numero });
    albaranesVivos.set(a.invoiceId, lista);
  }

  // SCRUM-1732d · con caja, los cobros de cada factura (RIVA 61 decies.1): los del 303 ya vienen leídos.
  const cobrosPorFactura = campo === CAMPO_EMISION
    ? undefined
    : (porCaja?.filas ?? await filasPorFactura(db, rango.merchantId, [...await idsPorCaja(db, rango.merchantId, facturas)]));

  const libro = construirLibroRegistro({
    facturas,
    merchantId: rango.merchantId,
    presupuestosFirmados: firmados.map((q) => q.id),
    albaranesVivos,
    ...(cobrosPorFactura ? { cobrosPorFactura } : {}),
    ...(porCaja ? { devengo: porCaja.devengo } : {}),
  });
  return rango.soloFacturas
    ? { ...libro, justificantesFuera: leidas.length - facturas.length }
    : libro;
}
