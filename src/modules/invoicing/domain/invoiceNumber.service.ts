/**
 * Numeración de facturas — serie anual por merchant (Sprint SPAIN).
 *
 * Formato: `2026-CF-001` (año - prefijo del merchant - secuencia correlativa).
 * Al cambiar de año natural la secuencia vuelve a 1 (serie nueva), como exige
 * la práctica habitual del Reglamento de Facturación español (series por año).
 *
 * ÚNICO punto del backend que asigna números de factura: antes había 4 sitios
 * con 3 formatos distintos (CF000007, CF-00005 y un CF-INV aleatorio) que
 * además colisionaban entre merchants al ser `number` único global.
 */
import { Prisma } from '@prisma/client';
import { getEmissionMode } from './emission.service';
import { isFlagEnabled } from '../../../core/flags';
import { recordAuditOrThrow, sobreFiscal, type ActorAudit } from '../../system/audit.service';
// SCRUM-780: el formato del número nuevo sale del sitio único, el mismo que compone P y AB.
import { SERIES, formatoNumeroDocumento, parseNumeroDocumento } from '../../../core/documentos/formatoNumero';
// SCRUM-735 (GO comentario 16573): el día/año de la serie sale de la zona del MERCHANT, no del
// reloj del proceso.
import { zonaDelMerchant, diaNaturalEn } from '../../../core/zonaDelMerchant';

/**
 * SCRUM-207 · los 7 caminos por los que puede nacer una factura (mapa de SCRUM-200 §2.1).
 * Unión CERRADA y parámetro OBLIGATORIO: un camino nuevo NO COMPILA hasta que declara cuál
 * es. Mismo criterio que el censo de SCRUM-203 — la lista y el código se atan, en vez de
 * confiar en que alguien se acuerde de rellenar un campo opcional.
 */
export type CaminoEmision =
  | 'C1' // el CLIENTE acepta el presupuesto desde WhatsApp (sin login)
  | 'C2' // el pro cobra el resto (collect-rest)
  | 'C3' // facturar un presupuesto
  | 'C4' // emisión manual (SCRUM-178)
  | 'C5' // rectificativa R1 (SCRUM-153)
  | 'C6' // un cobro pagado se convierte en factura (webhooks e interno)
  | OrigenC7; // SCRUM-347: los cuatro de `emitInvoice()` — ver abajo

/**
 * SCRUM-347 · LOS CUATRO CAMINOS QUE `C7` METÍA EN LA MISMA ETIQUETA.
 *
 * `C7` no era un fallo de la auditoría: **era un cajón**. La auditoría registra el origen desde
 * SCRUM-207 —`meta.camino`, obligatorio por tipo— y distingue bien seis. El séptimo etiquetaba a
 * `emitInvoice()` ENTERO, y por ahí pasan cuatro caminos con historias distintas.
 *
 * En una inspección, «esta factura nació de un albarán firmado» y «ésta nació suelta» son dos
 * cosas distintas — y hasta hoy las dos eran `C7`.
 *
 * Censo DERIVADO por AST (SCRUM-347), 199 ficheros `.ts` barridos, 4 llamadores:
 *   · `POST /albaranes/:id/facturar-parcial`      → `C7-parcial`
 *   · `POST /albaranes/:id/convertir-en-factura`  → `C7-albaran`      (A0.4)
 *   · `emitirRecapitulativas()`                   → `C7-recapitulativa`
 *   · `POST /admin/invoices`                      → `C7-suelta`       (A0.5)
 *
 * ⚠️ `'C7'` A SECAS YA NO EXISTE EN EL TIPO, y es deliberado: dejarlo habría permitido que un
 * llamador nuevo volviera a elegir la etiqueta vaga. Lo que sí sigue existiendo es el DATO: las
 * facturas ya registradas conservan su `meta.camino: 'C7'` histórico. **No se reescribe, no se
 * backfillea y no se supone de cuál de los cuatro venía** (regla 29). No saber su origen es un
 * dato, no un hueco: el censo las cuenta como «N con origen C7 sin desglosar».
 *
 * Se comprobó antes de ampliar (condición del GO) que nadie INDEXA por este tipo: un
 * `ALGO[camino]` se habría quedado en `undefined` **en silencio** al añadir variantes. Medido por
 * AST sobre 714 ficheros — 0 indexados, 0 switches, 1 anotación de tipo.
 */
export type OrigenC7 =
  | 'C7-parcial'         // parcial de un albarán
  | 'C7-albaran'         // albarán → factura (A0.4)
  | 'C7-recapitulativa'  // recapitulativa mensual
  | 'C7-suelta';         // factura suelta desde admin (A0.5)

/** Los cuatro, para que un guard los DERIVE en vez de reescribir la lista. */
export const ORIGENES_C7: readonly OrigenC7[] = [
  'C7-parcial', 'C7-albaran', 'C7-recapitulativa', 'C7-suelta',
] as const;

/**
 * Referencias de justificante `J-YYYYMMDD-XXXX` (V0-0). Ya NO se generan: SCRUM-1027 dejó el
 * generador sin llamador y SCRUM-825 lo retiró con firma del fundador (comentario 17446, D1). Se
 * queda SÓLO el reconocedor, porque los justificantes ya emitidos siguen en la base y se tienen
 * que poder identificar (regla 29).
 */
/**
 * Namespace del advisory lock que serializa la RESERVA de serie (SCRUM-234).
 * Distinto del de VeriFactu (1748) a propósito: reservar número y sellar son secciones
 * críticas independientes y compartir namespace las pondría en cola una detrás de otra.
 */
export const SERIE_LOCK_NS = 1749;
export const RECEIPT_NUMBER_PREFIX = 'J-';

export function isReceiptNumber(number: string | null | undefined): boolean {
  return typeof number === 'string' && number.startsWith(RECEIPT_NUMBER_PREFIX);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-780 · EL CORTE AL FORMATO `F<AA><NNNN>`
//
// ── POR QUÉ UN CORTE Y NUNCA UNA MIGRACIÓN ──────────────────────────────────────────────────
// REGLA 29: una factura EMITIDA no se edita, no se borra y NO SE RENUMERA. La regla **no
// distingue si el merchant era de prueba** — distingue si el documento SALIÓ. En dev hay cinco
// facturas emitidas (`2026-FG-001..005`, medidas el 7-sep-2026 en `yaqu_dev_javier`) y ninguna
// cambia de número: ni aquí, ni en ningún otro entorno, por ningún motivo.
//
// De ahí sale la forma del código: el formato NO se decide por «lo que hay configurado hoy», que
// cambiaría el pasado cada vez que alguien toque una preferencia. Se decide por LA FECHA DE LA
// FACTURA, que es un dato de la factura y no cambia nunca.
//
// ── LA FECHA DE CORTE ES UN DATO, NO CÓDIGO ─────────────────────────────────────────────────
// Firmada por el fundador el 7-sep-2026. Vive en `CORTE_FORMATO_F` y en ningún otro sitio: quien
// la mueva está renumerando facturas ya emitidas, y por eso tiene que ser UN valor con nombre y
// no una condición escrita dentro de un `if`.
//
// 🔴 SIN FECHA SE FORMATEA COMO SIEMPRE, y no es una comodidad: es lo que protege a los
//    llamadores que COMPONEN números ya emitidos sin saber su fecha —`huecosSerie` (SCRUM-291) y
//    `vistaPreviaSerie` (SCRUM-313)—. Si al no saber la fecha esto eligiera el formato nuevo, el
//    detector de huecos dejaría de casar lo ya emitido y lo daría por perdido.
//
// ⚠️ LA RECTIFICATIVA NO ENTRA, y su letra R sigue SIN FIRMAR. No es cosmético: las dos series
//    tienen contadores independientes (`nextInvoiceNumber` y `nextRectInvoiceNumber`), así que
//    una `F260003` ordinaria y una `F260003` rectificativa CHOCARÍAN en cuanto un merchant emita
//    tres de cada — y con `@@unique([merchantId, number])` la segunda emisión, que era válida,
//    revienta con un 500. Un formato para la rectificativa necesita letra propia, y esa letra es
//    decisión del fundador. Hasta entonces se queda en `AAAA-PREF-R-NNN`, intacta.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Cuándo empieza el formato nuevo. `desde: null` sería el corte APAGADO. */
export interface CorteDeFormato {
  readonly desde: Date | null;
}

/**
 * EL DATO FIRMADO: 7-sep-2026, 00:00 UTC. El instante EXACTO cae ya del lado nuevo (`>=`), porque
 * un corte con el borde abierto deja un instante en el que no se sabe qué formato toca.
 */
export const CORTE_FORMATO_F: CorteDeFormato = Object.freeze({
  desde: new Date('2026-09-07T00:00:00.000Z'),
});

/**
 * ¿Le toca a esta factura el formato nuevo? Pura, y separada del formateo para que un guard pueda
 * preguntarlo sin componer un número.
 */
export function usaFormatoF(
  emitidaEn: Date | null | undefined,
  rectifying: boolean,
  corte: CorteDeFormato = CORTE_FORMATO_F,
): boolean {
  if (corte.desde == null) return false;                       // corte apagado
  if (rectifying) return false;                                // R sin firmar: intacta
  if (!(emitidaEn instanceof Date) || Number.isNaN(emitidaEn.getTime())) return false;
  return emitidaEn.getTime() >= corte.desde.getTime();
}

/**
 * Formatea un número de la serie. `rectifying` usa la serie propia de rectificativas (R).
 *
 * `emitidaEn` es LA FECHA DE LA FACTURA — no «ahora». Pasar `new Date()` aquí para una factura
 * vieja la renumeraría, que es justo lo que la regla 29 prohíbe.
 *
 * 🔴 DESPUÉS DEL CORTE EL PREFIJO YA NO DECIDE. El fundador retiró `invoiceSeriesPrefix` del
 *    número el 7-sep-2026: un solo formato para todos. El parámetro se conserva porque sigue
 *    decidiendo el de las facturas ANTERIORES al corte, que no se renumeran nunca.
 */
export function formatInvoiceNumber(
  prefix: string | null | undefined,
  year: number,
  seq: number,
  rectifying = false,
  emitidaEn?: Date | null,
  corte: CorteDeFormato = CORTE_FORMATO_F,
): string {
  if (usaFormatoF(emitidaEn, rectifying, corte)) {
    // El formato sale del SITIO ÚNICO (`core/documentos/formatoNumero`), el mismo que compone
    // `P260001` y `AB260001`. Escribir aquí una segunda plantilla sería el defecto que ese módulo
    // existe para impedir: basta con que una rellene a 4 y la otra a 3 para que el profesional
    // vea dos formatos en la misma pantalla.
    return formatoNumeroDocumento(SERIES.factura, year, seq);
  }
  const p = (prefix ?? '').trim() || 'CF';
  return `${year}-${p}${rectifying ? '-R' : ''}-${String(seq).padStart(3, '0')}`;
}

/**
 * SCRUM-33: número + etiqueta del tramo (SCRUM-27), para todo lo que el CLIENTE ve
 * (concepto del cobro, plantilla WhatsApp) — nunca cambia la numeración fiscal en sí,
 * solo el texto de display. null en presets (sin plan personalizado) → se omite,
 * mismo patrón condicional que ya usa el PDF (nunca un placeholder inventado).
 * Deliberadamente NO se añade una variable nueva a la plantilla de WhatsApp
 * (Meta no acepta variables vacías, y los presets no tienen etiqueta): el label
 * viaja DENTRO del valor de la variable "número de documento" que ya existe.
 */
export function appendStageLabel(number: string, stageLabel?: string | null): string {
  return stageLabel ? `${number} — ${stageLabel}` : number;
}

/**
 * SCRUM-780 · LA SECUENCIA DE LA SERIE `F`, DERIVADA DE LO YA EMITIDO.
 *
 * ── POR QUÉ NO SALE DE `nextInvoiceNumber` ──────────────────────────────────────────────────
 * El fundador firmó que `F26xxxx` es una serie **NUEVA que empieza en 0001 y es correlativa
 * dentro de sí misma**. `nextInvoiceNumber` NO puede darla: es el contador de la serie vieja y en
 * dev vale 6 para el merchant 1, que ya gastó `2026-FG-001..005`. Con él, su primera factura del
 * formato nuevo saldría `F260006` y la serie F nacería con cinco huecos que nadie podría cerrar
 * jamás — porque cerrarlos exigiría renumerar, y eso es la regla 29.
 *
 * Un contador propio querría una columna nueva, y el schema es del fundador. Así que se DERIVA de
 * lo emitido, que es la única fuente que no puede desincronizarse de la realidad.
 *
 * 🔴 ES SEGURO PORQUE VIVE DENTRO DEL CERROJO. `allocateInvoiceNumber` toma
 * `pg_advisory_xact_lock` como PRIMERA sentencia, así que dos emisiones del mismo merchant no
 * pueden derivar el mismo máximo. Fuera de ese cerrojo esto sería un read-then-write con carrera,
 * exactamente el defecto que SCRUM-234 arregló.
 *
 * ⚠️ AQUÍ SÍ SE PARSEA, y `huecosSerie` (SCRUM-291) explícitamente NO. No es una contradicción:
 * allí se parsearía un formato AJENO y viejo, que envejece; aquí se parsea el formato PROPIO y
 * actual, con el MISMO parser del módulo que lo compone (`parseNumeroDocumento`), así que los dos
 * no pueden divergir. Si mañana cambia la forma, cambia en un sitio y esto lo sigue solo.
 */
/**
 * Lo ÚNICO que necesita `leerSeqDeLaSerieF`: poder listar números de factura. Se declara aquí en
 * vez de pedir un `Prisma.TransactionClient`, y no es cosmética de tipos.
 *
 * 🔴 SCRUM-219 CAZÓ LA PRIMERA VERSIÓN, y tenía razón. Pedía `TransactionClient`, y la vista
 * previa le pasa el cliente GLOBAL —que compila limpio porque `TransactionClient` es un `Omit` de
 * `PrismaClient`—. Ese guard existe porque pasar el cliente global a quien ESCRIBE deja la
 * escritura sin rollback, y en la serie fiscal eso convierte un hueco imposible en uno real. Aquí
 * no se escribe nada, pero la forma de decirlo no es hacer una excepción al guard: es pedir
 * exactamente lo que se usa. Así la vista previa puede pasar el cliente global sin mentir, y la
 * emisión sigue pasando su `tx` — que es lo que hace que derivar dentro del cerrojo no tenga
 * carrera.
 */
export interface LectorDeFacturas {
  invoice: {
    findMany(args: {
      where: { merchantId: number; number: { startsWith: string } };
      select: { number: true };
    }): Promise<{ number: string }[]>;
  };
}

export async function leerSeqDeLaSerieF(
  db: LectorDeFacturas,
  merchantId: number,
  year: number,
): Promise<number> {
  const prefijoF = `${SERIES.factura}${String(year % 100).padStart(2, '0')}`;
  const emitidas = await db.invoice.findMany({
    where: { merchantId, number: { startsWith: prefijoF } },
    select: { number: true },
  });
  return siguienteSeqDeLaSerieF(emitidas.map((f) => f.number), year);
}

export function siguienteSeqDeLaSerieF(numeros: readonly string[], year: number): number {
  let max = 0;
  for (const n of numeros) {
    const p = parseNumeroDocumento(n);
    if (p && p.serie === SERIES.factura && p.year === year && p.seq > max) max = p.seq;
  }
  return max + 1;
}

/**
 * SCRUM-1216b · EL ARRANQUE DECLARADO ENTRA EN LA SERIE F.
 *
 * GO del fundador para el camino de emisión: SCRUM-1216, comentario 17347 (28-sep-2026). De las
 * tres firmas de SCRUM-780 se reabre UNA —«serie nueva que empieza en 0001» pasa a «empieza donde
 * él diga»—; el formato `F<AA><NNNN>` y la retirada del prefijo siguen intactos.
 *
 * Por qué importa: la AEAT acepta el mismo número si cambia la fecha (medido en pruebas, SCRUM-1216),
 * así que empezar en 0001 a quien ya usó `F26…` en su programa anterior repetiría un número suyo sin
 * que nadie se enterase nunca.
 *
 * La regla es `máx(derivada, arranque)`, sin aritmética:
 *   · `invoiceStartSeq` guarda YA el arranque (declaró 41 → 42): nadie suma después, y así la vista
 *     previa y el emisor no pueden discrepar por un `+1`;
 *   · cuenta SÓLO si `invoiceStartYear` es el año que se numera. Año PROPIO a propósito:
 *     `invoiceSeriesYear` lo reescribe este mismo emisor en cada factura;
 *   · `null` = NO declaró nada → manda lo derivado (0001 si no hay nada). `null` NO es 1;
 *   · el máximo, y no el arranque a secas: con F…0042 y 0043 ya emitidas, la siguiente es la 44.
 *     Nunca repite.
 *   · `nextInvoiceNumber` NO entra: es el contador de la serie VIEJA. Con él, el merchant 1 de dev
 *     (gastó `2026-FG-001..005`, contador en 6) nacería en F260006 sin haber declarado nada, que es
 *     lo que SCRUM-780 firmó que no pasa.
 *
 * Pura, y la usan el emisor y la vista previa: son el mismo número y no pueden decirlo dos veces.
 */
export function seqDeLaSerieF(
  derivada: number,
  arranque: { invoiceStartSeq?: number | null; invoiceStartYear?: number | null } | null | undefined,
  year: number,
): number {
  const s = arranque?.invoiceStartSeq;
  const declarado = arranque?.invoiceStartYear === year && typeof s === 'number' && Number.isInteger(s) && s >= 1
    ? s
    : null;
  return declarado === null ? derivada : Math.max(derivada, declarado);
}

/** Secuencia que toca emitir: si la serie guardada no es la del año en curso, empieza serie nueva en 1. */
export function resolveSeriesSeq(
  m: { invoiceSeriesYear: number | null; nextInvoiceNumber: number },
  year: number,
): number {
  return m.invoiceSeriesYear === year ? m.nextInvoiceNumber : 1;
}

/**
 * Reserva el siguiente número de la serie anual del merchant y avanza el contador.
 * DEBE llamarse dentro de la misma transacción que crea la factura, para que
 * un fallo en el create no deje huecos en la serie.
 *
 * `rectifying: true` usa la serie separada de rectificativas (2026-CF-R-001),
 * obligatoria legalmente. Ambas series comparten `invoiceSeriesYear`: al cambiar
 * de año se resetean LOS DOS contadores.
 *
 * ── SCRUM-207 · AQUÍ SE ESCRIBE `factura_emitida`, Y NO ES UN DETALLE DE SITIO ────────
 * Este es el **punto de no retorno A** (SCRUM-200 §5): cuando esta función vuelve, el
 * número está consumido y la serie ha avanzado, dentro de la misma transacción que crea
 * la factura. El registro se escribe **con el mismo `tx`**, así que:
 *
 *   · si el registro falla → la transacción se deshace → NO hay número consumido, NO hay
 *     factura, NO hay hueco en la serie. «Factura sin su registro» pasa de ser algo que
 *     hay que recordar a algo que **no puede ocurrir**;
 *   · y como los 7 caminos pasan por este embudo SIN EXCEPCIÓN (medido y vigilado por el
 *     guard de SCRUM-203), cubrir este punto los cubre los 7 — sin 7 call-sites que
 *     alguien pueda olvidar en el octavo.
 *
 * Se audita **también el justificante**: un `J-…` no entra en la cadena de huellas, pero
 * es un documento con referencia que se le manda a un cliente. `esJustificante` lo
 * distingue en el registro.
 *
 * ⚠️ `entityId` va a `null` a propósito: la factura AÚN NO EXISTE cuando se reserva su
 * número. El identificador que se congela es `meta.numero`, que además es la identidad
 * FISCAL del documento (el `id` de la BD no lo es). La consulta de inspección resuelve por
 * los dos — ver `auditoriaFiscal.query.ts`.
 */
export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient,
  merchantId: number,
  opts: {
    /** OBLIGATORIO desde SCRUM-207: cuál de los 7 caminos está emitiendo. */
    camino: CaminoEmision;
    /** OBLIGATORIO: quién actúa. En C1 NO es el propietario, es el cliente final. */
    actor: ActorAudit;
    rectifying?: boolean;
  },
  now = new Date(),
): Promise<string> {
  // ── SCRUM-234 · SERIALIZA LA RESERVA. Primera sentencia, antes de leer nada. ──────────
  //
  // Lo de abajo es un read-then-write: se lee `nextInvoiceNumber` y se escribe `seq + 1` como
  // valor ABSOLUTO. Sin cerrojo eso no serializa ni dentro de una transacción, porque ningún
  // `$transaction` del proyecto fija `isolationLevel` (default READ COMMITTED) y el
  // `findUnique` no bloquea la fila. Dos emisiones concurrentes leían el MISMO número.
  //
  // Lo que impedía el duplicado no era el aislamiento: era el índice `@@unique([merchantId,
  // number])`. Un backstop que funciona REVENTANDO la segunda emisión — y la segunda emisión
  // era perfectamente válida. El profesional veía `API 500: internal_error` al facturar.
  //
  // POR QUÉ CERROJO Y NO `{ increment: 1 }` (que es lo que usa `quoteNumber`): esta serie tiene
  // REINICIO ANUAL (`invoiceSeriesYear`) y DOS contadores (F1 y R1). `increment` no puede
  // expresar «y si cambió el año, vuelve a 1» en un solo update atómico, así que llevarlo a esa
  // forma obligaría a mover el reinicio de sitio — y eso es semántica fiscal, no una
  // optimización. El cerrojo serializa sin tocar una línea de la lógica del año.
  //
  // NAMESPACE PROPIO (no el de VeriFactu): compartirlo haría que reservar un número esperase a
  // que terminase un sellado del mismo merchant, y son dos secciones críticas sin relación.
  //
  // ⚠️ El cerrojo es de TRANSACCIÓN: se libera al commit. Eso es lo correcto —cubre reserva Y
  // creación, que viven en la misma `tx`— pero significa que si alguien llamase a esta función
  // con el cliente GLOBAL en vez de con una `tx`, el lock se tomaría y liberaría en el mismo
  // instante y no serviría de nada. Lo que lo impide es el guard de SCRUM-207 (misma `tx` en los
  // 7 caminos); SCRUM-219 es el hueco de tipos que lo haría posible. Los dos sostienen esto.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIE_LOCK_NS}::int, ${merchantId}::int)`;
  const m = await tx.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      email: true,
      country: true,
      // SCRUM-81: `flags` es OBLIGATORIO para que getEmissionMode aquí resuelva el modo con la
      // MISMA información que el gate del endpoint (Parte P: override de INVOICING_ES_ENABLED por
      // merchant, precedencia merchant > país > env > default). Sin él, un merchant con el override
      // ON habría emitido un J- de justificante mientras el gate lo trataba como fiscal → factura
      // fiscal con numeración de justificante, fuera de serie. Para merchants sin override (todos
      // hoy, flags null) el comportamiento es IDÉNTICO al previo.
      flags: true,
      // SCRUM-735: el AÑO de la serie sale de la zona de ESTE merchant (`zonaDelMerchant`), no
      // del reloj del proceso — ver el `year` de abajo.
      timezone: true,
      invoiceSeriesPrefix: true,
      nextInvoiceNumber: true,
      nextRectInvoiceNumber: true,
      invoiceSeriesYear: true,
      // SCRUM-1216b: el arranque declarado de la serie F (ver `seqDeLaSerieF`).
      invoiceStartSeq: true,
      invoiceStartYear: true,
    },
  });
  if (!m) throw new Error('merchant_not_found');
  // SCRUM-735 (GO comentario 16573): antes el año salía de leer `now` con los getters locales
  // del reloj del PROCESO (Railway va en UTC). En Nochevieja española eso reinicia la serie —o
  // no— una noche antes de tiempo. `m` ya está leído arriba: ni una consulta de más.
  const year = Number(diaNaturalEn(now, zonaDelMerchant(m)).slice(0, 4));

  const rect = !!opts.rectifying;

  // SCRUM-207: el modo fiscal del MOMENTO, congelado en el registro. Se calcula con la
  // misma `m` que ya está leída — ni una consulta de más.
  const flagsFiscales = {
    INVOICING_ES_ENABLED: isFlagEnabled('INVOICING_ES_ENABLED', { merchant: m }),
    SIF_ENABLED: isFlagEnabled('SIF_ENABLED', { merchant: m }),
  };

  /** Escribe `factura_emitida` DENTRO de `tx`. Si falla, sube y la transacción se deshace. */
  const auditar = (numero: string, esJustificante: boolean) =>
    recordAuditOrThrow(
      {
        merchantId,
        teamMemberId: opts.actor.teamMemberId ?? null,
        action: 'factura_emitida',
        entityType: 'invoice',
        entityId: null, // la factura aún no existe — la identidad es `meta.numero`
        meta: sobreFiscal({
          actor: opts.actor,
          flagsFiscales,
          payload: {
            numero,
            esJustificante,
            camino: opts.camino,
            // F1 / R1 es lo que este embudo sabe. El tipo REAL lo fija quien crea la fila
            // (`Invoice.type`); aquí se registra la intención con la que se pidió el número.
            tipoFactura: esJustificante ? 'JUST' : rect ? 'R1' : 'F1',
          },
        }),
      },
      tx,
    );

  // SCRUM-1027 · REGLA 24 (enmienda SCRUM-612c, 21-sep-2026): con INVOICING_ES_ENABLED en OFF,
  // en España, YA NO SALE NINGÚN DOCUMENTO — ni factura, ni justificante. Antes esta rama emitía
  // un `J-…` (V0-0); ahora es EXACTAMENTE lo que ya hacía para las rectificativas (`if (rect)
  // throw`), extendido a los siete caminos: el punto ÚNICO de decisión deja de tener dos
  // desenlaces para `receipt` y pasa a tener uno solo. No avanza NINGÚN contador de la serie
  // fiscal — ni se llega a intentar.
  //
  // El generador de referencias `J-` que esta rama llamaba se quedó sin llamador con este cambio,
  // y SCRUM-825 lo retiró después con firma del fundador (comentario 17446, D1). Esta rama no
  // cambió con esa retirada: sigue rechazando igual.
  if (getEmissionMode(m) === 'receipt') {
    throw new Error('invoicing_es_disabled');
  }
  const sameYear = m.invoiceSeriesYear === year;

  // ── SCRUM-780 · DE QUÉ CONTADOR SALE LA SECUENCIA ──────────────────────────────────────
  // Después del corte la serie ordinaria es `F<AA><NNNN>` y empieza en 0001, así que su
  // secuencia se DERIVA de lo ya emitido en esa serie (ver `siguienteSeqDeLaSerieF`). Antes del
  // corte, y siempre para las rectificativas, no cambia ni una línea de lo de antes.
  const enFormatoF = usaFormatoF(now, rect);
  let seq: number;
  if (rect) {
    seq = sameYear ? m.nextRectInvoiceNumber : 1;
  } else if (enFormatoF) {
    // El `startsWith` acota la lectura a la serie F de ESTE año; el veredicto lo da el parser,
    // no el prefijo, para que un número parecido no cuele.
    const prefijoF = `${SERIES.factura}${String(year % 100).padStart(2, '0')}`;
    const emitidas = await tx.invoice.findMany({
      where: { merchantId, number: { startsWith: prefijoF } },
      select: { number: true },
    });
    // SCRUM-1216b: y si declaró un arranque para ESTE año, no se empieza por debajo de él.
    seq = seqDeLaSerieF(siguienteSeqDeLaSerieF(emitidas.map((f) => f.number), year), m, year);
  } else {
    seq = resolveSeriesSeq(m, year);
  }

  await tx.merchant.update({
    where: { id: merchantId },
    data: {
      invoiceSeriesYear: year,
      ...(rect
        ? { nextRectInvoiceNumber: seq + 1, ...(sameYear ? {} : { nextInvoiceNumber: 1 }) }
        // 🔴 EN FORMATO F EL CONTADOR NO RETROCEDE. La secuencia sale derivada, así que
        // `nextInvoiceNumber` ya no la manda; pero bajarlo (de 6 a 2 en el merchant 1 de dev)
        // dejaría el contador de la serie VIEJA apuntando a `2026-FG-002`, que ya existe. Hoy eso
        // no puede emitirse —los 7 llamadores usan el reloj real y el corte queda atrás, medido—,
        // y precisamente por eso no se apoya el diseño en ello: se conserva el máximo y el
        // duplicado deja de ser posible aunque mañana alguien emita con una fecha pasada.
        : { nextInvoiceNumber: Math.max(m.nextInvoiceNumber, seq + 1), ...(sameYear ? {} : { nextRectInvoiceNumber: 1 }) }),
    },
  });
  const numero = formatInvoiceNumber(m.invoiceSeriesPrefix, year, seq, rect, now);
  await auditar(numero, false);
  return numero;
}
