/**
 * VeriFactu — Reglamento de Facturación España (RD 1007/2023 / RTSF)
 *
 * Implementa la cadena de huellas SHA-256 y la URL de QR para el portal
 * de verificación de la AEAT. Solo se aplica a merchants con country='ES'
 * y taxId configurado.
 *
 * Spec: https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Facturacion/
 *       Sistema_Informacion_Verifactu/REGLAMENTO_VERIFACTU.pdf
 */
import crypto from 'crypto';
import { prisma as defaultPrisma } from '../../../core/db/prisma';
import { calcVatBreakdown, calcVatCuotaTotal } from './vat.service';
import { isReceiptNumber } from './invoiceNumber.service';
import { config } from '../../../core/config/env';
// SCRUM-247: la identidad del PRODUCTOR es constante del repo, no configuración de panel.
import {
  VERIFACTU_PRODUCTOR_NOMBRE, VERIFACTU_PRODUCTOR_NIF, VERIFACTU_ID_SISTEMA,
  VERIFACTU_VERSION, VERIFACTU_NUM_INSTALACION,
} from '../../fiscal/verifactu/productor';
// SCRUM-209: el desglose lo construye UN solo sitio del proyecto (registro.builder.ts).
import {
  buildDetallesDesgloseXml,
  clasificarDetalleDesglose,
  DesgloseNoClasificableError,
  MODO_SIN_DESTINATARIO,
  MODO_TIPO_RECTIFICATIVA,
  type ModoTipoRectificativa,
  resolverTipoRectificativa,
  type ModoSinDestinatario,
  RegistroNoEmitibleError,
  resolverSinDestinatario,
} from '../../fiscal/verifactu/registro.builder';

// SCRUM-145: namespaces oficiales de los XSD de la AEAT (los ficheros están en
// `src/modules/fiscal/verifactu/xsd/`). Los `targetNamespace` son la URL del esquema; NO son
// endpoints y no se resuelven en tiempo de ejecución.
const NS_LR = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd';
const NS_INFO = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd';
/** Máximo de registros por envío que admite el XSD (`RegistroFactura` maxOccurs="1000"). */
const MAX_REGISTROS = 1000;

// SCRUM-173: namespace del cerrojo consultivo de la cadena de huellas. Primera clave de
// `pg_advisory_xact_lock(int, int)`; la segunda es el merchantId, para que la serialización
// sea POR EMISOR y dos merchants no se estorben. El número es arbitrario pero fijo: si algún
// día se usan advisory locks para otra cosa, que no colisionen.
const VERIFACTU_LOCK_NS = 1748;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateES(d: Date): string {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/**
 * FechaHoraHusoGenRegistro: ISO 8601 con huso explícito (ej. 2024-01-01T19:20:30+01:00),
 * como exige la spec de huella de la AEAT. Usa el huso del sistema; el MISMO valor
 * que entra en la huella debe remitirse luego en el registro XML (S1-C lo persistirá).
 */
export function formatFechaHoraHuso(d: Date): string {
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? '+' : '-';
  const abs = Math.abs(tzMin);
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
    `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  );
}

/**
 * Huella SHA-256 del registro de facturación de ALTA — conforme a la Orden
 * HAC/1177/2024 y al doc AEAT "Especificaciones para la generación de la huella"
 * (auditado en S1-A, ver docs/AUDITORIA_RRSIF.md).
 *
 * Cadena de entrada EXACTA (campo=valor unidos por '&', valores con trim):
 *   IDEmisorFactura=…&NumSerieFactura=…&FechaExpedicionFactura=dd-mm-aaaa
 *   &TipoFactura=…&CuotaTotal=…&ImporteTotal=…&Huella=…(vacío si 1er registro)
 *   &FechaHoraHusoGenRegistro=ISO8601-con-huso
 * → SHA-256 sobre UTF-8 → 64 hex MAYÚSCULAS.
 *
 * Vector de prueba oficial (doc AEAT): la cadena de ejemplo con NIF 89890001K
 * produce 3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60
 * (blindado en tests/verifactu.test.mjs).
 */
export function computeVeriFactuHash(params: {
  nif: string;
  serie: string;       // NumSerieFactura completo (ej. 2026-CF-001)
  fecha: string;       // FechaExpedicionFactura DD-MM-YYYY
  tipoFactura: string; // 'F1' | 'R1' (catálogo AEAT)
  cuotaTotal: string;  // con punto decimal, 2 decimales
  importeTotal: string;
  prevHash: string;    // huella del registro anterior; '' (VACÍO) si es el primero
  timestamp: string;   // FechaHoraHusoGenRegistro ISO 8601 con huso
}): string {
  const input =
    `IDEmisorFactura=${params.nif.trim()}` +
    `&NumSerieFactura=${params.serie.trim()}` +
    `&FechaExpedicionFactura=${params.fecha.trim()}` +
    `&TipoFactura=${params.tipoFactura.trim()}` +
    `&CuotaTotal=${params.cuotaTotal.trim()}` +
    `&ImporteTotal=${params.importeTotal.trim()}` +
    `&Huella=${params.prevHash.trim()}` +
    `&FechaHoraHusoGenRegistro=${params.timestamp.trim()}`;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex').toUpperCase();
}

/**
 * Huella SHA-256 del registro de ANULACIÓN (S1-C). Cadena según el doc AEAT de
 * especificaciones de huella **[VALIDAR contra el ejemplo oficial de anulación en
 * el entorno de pruebas — S1-D]**:
 *   IDEmisorFacturaAnulada=…&NumSerieFacturaAnulada=…&FechaExpedicionFacturaAnulada=…
 *   &Huella=…&FechaHoraHusoGenRegistro=…
 */
export function computeVeriFactuHashAnulacion(params: {
  nif: string;
  serie: string;
  fecha: string;     // DD-MM-YYYY de la factura anulada
  prevHash: string;  // '' si primer registro de la cadena
  timestamp: string; // ISO 8601 con huso
}): string {
  const input =
    `IDEmisorFacturaAnulada=${params.nif.trim()}` +
    `&NumSerieFacturaAnulada=${params.serie.trim()}` +
    `&FechaExpedicionFacturaAnulada=${params.fecha.trim()}` +
    `&Huella=${params.prevHash.trim()}` +
    `&FechaHoraHusoGenRegistro=${params.timestamp.trim()}`;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex').toUpperCase();
}

/**
 * Construye la URL que codifica el QR de verificación AEAT.
 * https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR
 */
export function buildVeriFactuQrUrl(params: {
  nif: string;
  serie: string;
  fecha: string;   // DD-MM-YYYY
  importe: string; // N.NN
}): string {
  const qs = new URLSearchParams({
    nif:       params.nif,
    numserie:  params.serie,
    fecha:     params.fecha,
    importe:   params.importe,
  });
  return `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?${qs.toString()}`;
}

/**
 * Aplica VeriFactu a una factura:
 *  1. Obtiene la huella de la factura anterior del mismo merchant
 *  2. Calcula la nueva huella
 *  3. Persiste vfHash, vfPrevHash y qrData en el Invoice
 *
 * Devuelve los valores calculados para usarlos en la generación del PDF.
 */
export async function applyVeriFactu(
  invoice: {
    id: number;
    number: string;
    total: { toString(): string };
    createdAt: Date;
    merchantId: number;
    type?: string | null; // 'F1' (default) | 'R1' rectificativa
  },
  taxId: string,
  prismaClient = defaultPrisma,
): Promise<{ vfHash: string; vfPrevHash: string; qrUrl: string }> {
  // V0-0: un justificante de cobro (J-…) no es una factura — jamás entra en la
  // cadena de huellas VeriFactu. Los call-sites capturan y siguen sin QR.
  if (isReceiptNumber(invoice.number)) {
    throw new Error('receipt_document_not_invoiceable');
  }

  // SCRUM-149: FAIL-CLOSED — una factura SIN LÍNEAS no se sella.
  //
  // `cuotaTotal` sale de `calcVatCuotaTotal(lines)`: sin líneas da 0,00, así que la huella
  // declararía CERO IVA repercutido sobre un importe que sí lo lleva. Y la huella es inmutable
  // y encadenada (`vfPrevHash`, regla 29): eso solo se corrige emitiendo una R1.
  //
  // Antes bastaba con que un call-site olvidara copiar las líneas — que es exactamente lo que
  // hacía `createInvoiceFromQuoteAdmin` (retirado en este mismo ticket) y lo que la ruta viva
  // documenta como el "bug E2E V0-1" ya corregido en su día. El guard convierte "que nadie se
  // olvide" en algo que no se puede olvidar.
  //
  // Preferir NO sellar antes que sellar mal: los call-sites capturan (igual que con el
  // justificante de arriba) y el PDF sale sin QR, que es un fallo visible y reparable —
  // al contrario que una cadena de huellas con una cuota falsa dentro.
  const conLineas = await prismaClient.invoice.findUnique({
    where: { id: invoice.id },
    select: { lines: true },
  });
  const lineas = Array.isArray(conLineas?.lines) ? (conLineas!.lines as any[]) : null;
  if (!lineas || lineas.length === 0) {
    throw new Error('invoice_without_lines_not_sealable');
  }

  const fecha = formatDateES(invoice.createdAt);
  const importeTotal = Number(invoice.total.toString()).toFixed(2);

  // Cuota total de IVA real desde las líneas (garantizadas no vacías por el guard de arriba,
  // que además reutiliza esta misma lectura — no hay consulta de más).
  const cuotaTotal = calcVatCuotaTotal(lineas).toFixed(2);

  // ── SCRUM-173 · LA CADENA SE SELLA BAJO CERROJO, Y NUNCA DENTRO DE OTRA TX ──────────────
  //
  // `leer prev → calcular huella → persistir` es una secuencia leer-modificar-escribir sobre
  // un recurso COMPARTIDO (la última huella del merchant) y no tenía ninguna protección.
  // Tres formas de romper la cadena, las tres reales y las tres reproducidas en rojo:
  //
  //  ① SELLAR DENTRO DE OTRA TRANSACCIÓN: las facturas creadas en esa tx aún no están
  //    committeadas, así que el `prev` no las ve y TODAS encadenan al mismo registro anterior
  //    al lote. Es lo que habría pasado al enganchar la consolidación de recapitulativas,
  //    que emite N facturas en un solo `$transaction`.
  //  ② ORDENAR POR `createdAt`: en PostgreSQL `now()` es `transaction_timestamp()`, CONSTANTE
  //    durante toda la transacción, así que N facturas creadas en una misma tx comparten
  //    `createdAt` y "la última con huella" queda indeterminada. Se ordena por `id desc`:
  //    estrictamente monótono y nunca nulo. (`vfTimestamp` NO sirve de criterio: nació en
  //    SCRUM-145 y es NULL en todo el histórico anterior — ordenar por él dejaría fuera las
  //    facturas viejas y encadenaría al sitio equivocado.)
  //  ③ DOS EMISIONES CONCURRENTES: Prisma no fija nivel de aislamiento, así que hereda el de
  //    PostgreSQL — READ COMMITTED. Dos transacciones simultáneas no se ven entre sí y ambas
  //    leen el mismo `prev`. Este ya existía en los cinco caminos de emisión.
  //
  // El cerrojo consultivo por merchant serializa SOLO la cadena de ese emisor: dos merchants
  // distintos no se estorban. Se libera al cerrar la transacción (`_xact_`) incluso si algo
  // lanza — no hay que acordarse de soltarlo.
  //
  // ⚠️ SE ARREGLA AHORA PORQUE LA CADENA ESTÁ VACÍA: `INVOICING_ES_ENABLED` lleva OFF desde
  // siempre → CERO facturas fiscales afectadas. Cada semana de retraso sube el coste, porque
  // una cadena rota solo se deshace emitiendo una R1 por cada factura afectada (regla 29).
  if (typeof (prismaClient as any).$transaction !== 'function') {
    // Fail-closed y explícito: un cliente de transacción dejaría el sellado sin cerrojo y con
    // lecturas que no ven el resto del lote — el peligro ① exactamente. Mejor romper aquí,
    // ruidosamente, que sellar una cadena inválida en silencio.
    throw new Error(
      'verifactu_seal_inside_transaction: applyVeriFactu debe llamarse FUERA de una $transaction, ' +
      'con el cliente global. Sellar dentro de una tx rompe el encadenamiento: las facturas del ' +
      'mismo lote no se ven entre sí y todas encadenarían al mismo registro anterior. ' +
      'Crea las facturas en la tx y séllalas DESPUÉS del commit, una a una.',
    );
  }

  const sellado = await (prismaClient as any).$transaction(async (tx: any) => {
    // Namespace fijo + merchantId: dos claves de 32 bits, para no colisionar con cualquier
    // otro advisory lock de la aplicación.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${VERIFACTU_LOCK_NS}::int, ${invoice.merchantId}::int)`;

    // ── SCRUM-177 · UNA SOLA CADENA: el alta también encadena a las anulaciones ────────────
    //
    // Antes esta consulta miraba SOLO altas (`vfHash not null`), mientras que la anulación
    // usaba `ultimaHuellaDeLaCadena`, que mira altas Y anulaciones. Eran DOS definiciones de
    // "la cadena" conviviendo en el mismo sistema: emitida una anulación, la siguiente alta la
    // saltaba y encadenaba al alta anterior → dos registros apuntando al mismo eslabón. Una
    // secuencia bifurcada es justo lo que la AEAT lee como manipulación.
    //
    // VERIFICADO CONTRA EL XSD OFICIAL (`SuministroInformacion.xsd`), no deducido:
    //  · `RegistroFacturacionAltaType` y `RegistroFacturacionAnulacionType` declaran el MISMO
    //    `Encadenamiento`, con el mismo `EncadenamientoFacturaAnteriorType`.
    //  · Su documentación habla de "el REGISTRO DE FACTURACIÓN anterior" — y una anulación es
    //    un registro de facturación (así se llama su propio tipo).
    //  · `EncadenamientoFacturaAnteriorType` NO tiene ningún campo que discrimine el tipo del
    //    registro anterior. Con dos cadenas, apuntar a un eslabón sin decir a cuál pertenece
    //    sería irreconstruible. **Es la evidencia definitiva.**
    //  · `PrimerRegistroCadenaType` — LA cadena, en singular.
    //
    // ⚠️ `excluirId` NO es una simetría estética: es la única diferencia real entre los dos
    // caminos. Al sellar un ALTA hay que excluir la propia factura, porque un resellado la
    // encontraría a sí misma y se encadenaría a su propia huella. La ANULACIÓN no la excluye:
    // tiene que encadenar precisamente al alta de esa misma factura (fijado por test en
    // SCRUM-173b). Unificar sin este parámetro rompe ese verde.
    const prevHash = await ultimaHuellaDeLaCadena(invoice.merchantId, tx, invoice.id);
    // El instante se toma DENTRO del cerrojo: es el que entra en la huella y tiene que ser
    // posterior al del registro anterior de la cadena.
    const timestamp = formatFechaHoraHuso(new Date());

    const vfHash = computeVeriFactuHash({
      nif: taxId,
      serie: invoice.number,
      fecha,
      tipoFactura: invoice.type === 'R1' ? 'R1' : 'F1',
      cuotaTotal,
      importeTotal,
      prevHash,
      timestamp,
    });

    const qrUrl = buildVeriFactuQrUrl({ nif: taxId, serie: invoice.number, fecha, importe: importeTotal });

    // SCRUM-145: se PERSISTE el instante exacto que entró en la huella. Sin él, el registro
    // emitía `FechaHoraHusoGenRegistro` = fecha de la FACTURA, que NO es lo que se hasheó, y
    // un tercero no podía recomputar la huella para verificarla.
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { vfHash, vfPrevHash: prevHash, qrData: qrUrl, vfTimestamp: new Date(timestamp) },
    });

    return { vfHash, prevHash, qrUrl };
  });

  const { vfHash, prevHash, qrUrl } = sellado;
  console.log(`[verifactu] invoice=${invoice.number} hash=${vfHash.slice(0, 16)}…`);
  return { vfHash, vfPrevHash: prevHash, qrUrl };
}

/**
 * SCRUM-145 — sella el REGISTRO DE ANULACIÓN de una factura ya emitida.
 *
 * Es un registro DISTINTO del de alta, con su propia huella encadenada: la factura anulada
 * CONSERVA su `vfHash` (regla 29 — una emitida jamás se edita ni borra; se anula CON su
 * registro). Por eso se guarda en columnas propias y no se pisa nada.
 *
 * ⚠️ ALCANCE — esto es la MAQUINARIA, no el flujo. Hoy **nada anula facturas**: `annulled` no
 * aparece en `src/`, así que la transición `pending → annulled` que declara la Parte L no tiene
 * ejecutor. Construir ese disparador (endpoint + UI + su registro) es FSM nueva sobre dinero
 * y necesita OK del fundador (AA1.4) — ticket aparte. Lo que queda listo aquí es lo que ese
 * ticket necesitará, y lo que permite emitir `RegistroAnulacion` en el XML.
 *
 * El eslabón anterior se toma de TODA la cadena (altas y anulaciones), no solo de las altas:
 * si la última operación del emisor fue una anulación, la siguiente huella encadena con ella.
 */
export async function applyVeriFactuAnulacion(
  invoice: { id: number; number: string; createdAt: Date; merchantId: number },
  taxId: string,
  prismaClient = defaultPrisma,
): Promise<{ vfAnulHash: string; vfPrevHash: string }> {
  if (isReceiptNumber(invoice.number)) {
    throw new Error('receipt_document_not_invoiceable'); // V0-0: un J- nunca entra en la cadena
  }

  // ── SCRUM-173b · MISMO CERROJO QUE EL ALTA, Y POR LA MISMA RAZÓN ────────────────────────
  //
  // La anulación lee y extiende **LA MISMA CADENA** que el alta (`ultimaHuellaDeLaCadena` mira
  // altas Y anulaciones), así que hereda los tres peligros que SCRUM-173 cerró en
  // `applyVeriFactu`: sellar dentro de otra tx, orden no determinista, y dos emisiones
  // concurrentes leyendo el mismo `prev`.
  //
  // Dejarlo fuera era el peor resultado posible: **un mecanismo a medias parece uno entero**.
  // Quien leyera `applyVeriFactu` daría por serializada toda la cadena, y lo estaría solo por
  // un lado — un alta y una anulación simultáneas del mismo emisor encadenarían al mismo
  // eslabón. Mismo cerrojo y MISMO namespace a propósito: es UNA cadena, no dos, y el cerrojo
  // va por merchant precisamente para que los dos caminos compitan por él.
  if (typeof (prismaClient as any).$transaction !== 'function') {
    throw new Error(
      'verifactu_seal_inside_transaction: applyVeriFactuAnulacion debe llamarse FUERA de una ' +
      '$transaction, con el cliente global. Sellar dentro de una tx rompe el encadenamiento: ' +
      'los registros del mismo lote no se ven entre sí y encadenarían al mismo eslabón anterior.',
    );
  }

  const sellado = await (prismaClient as any).$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${VERIFACTU_LOCK_NS}::int, ${invoice.merchantId}::int)`;

    const prevHash = await ultimaHuellaDeLaCadena(invoice.merchantId, tx);
    // El sello se toma DENTRO del cerrojo: es el que entra en la huella y tiene que ser
    // posterior al del eslabón anterior.
    const timestamp = formatFechaHoraHuso(new Date());

    const vfAnulHash = computeVeriFactuHashAnulacion({
      nif: taxId,
      serie: invoice.number,
      fecha: formatDateES(invoice.createdAt),
      prevHash,
      timestamp,
    });

    // SCRUM-145d: el eslabón anterior se PERSISTE, no se infiere. Antes se resolvía por sello al
    // emitir (el registro inmediatamente anterior), y eso es frágil justo donde no puede serlo:
    // con dos anulaciones próximas en el tiempo el orden por sello puede empatar o invertirse, y
    // una cadena de huellas se sella PARA SIEMPRE. Se guarda lo que de verdad se hasheó — igual
    // que `vfPrevHash` con el alta. Un dato, no una inferencia.
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { vfAnulHash, vfAnulPrevHash: prevHash, vfAnulTimestamp: new Date(timestamp) },
    });

    return { vfAnulHash, prevHash };
  });

  const { vfAnulHash, prevHash } = sellado;
  console.log(`[verifactu] ANULACION invoice=${invoice.number} hash=${vfAnulHash.slice(0, 16)}…`);
  return { vfAnulHash, vfPrevHash: prevHash };
}

/**
 * Último eslabón de la cadena del emisor, mirando altas Y anulaciones.
 *
 * Con CERO anulaciones —el estado de hoy— devuelve exactamente lo mismo que la consulta que
 * ya usaba `applyVeriFactu` (la última factura con huella), así que no altera ninguna cadena
 * persistida; solo deja de romperse el día que exista la primera anulación.
 */
async function ultimaHuellaDeLaCadena(
  merchantId: number,
  prismaClient: any,
  // SCRUM-177: id a EXCLUIR del lado de las altas. Lo pasa `applyVeriFactu` con la factura que
  // está sellando: sin esto, un resellado la encontraría a sí misma y se encadenaría a su
  // propia huella. `applyVeriFactuAnulacion` NO lo pasa a propósito — la anulación tiene que
  // encadenar precisamente al alta de esa misma factura.
  //
  // Solo afecta a las ALTAS: una factura nunca se anula a sí misma, así que excluirla del lado
  // de las anulaciones no tendría sentido y además rompería el caso de dos anulaciones
  // seguidas de la misma factura.
  excluirId?: number,
): Promise<string> {
  const [ultimaAlta, ultimaAnul] = await Promise.all([
    prismaClient.invoice.findFirst({
      where: {
        merchantId,
        vfHash: { not: null },
        ...(excluirId != null ? { id: { not: excluirId } } : {}),
      },
      orderBy: { id: 'desc' },
      select: { vfHash: true, vfTimestamp: true, createdAt: true },
    }),
    prismaClient.invoice.findFirst({
      where: { merchantId, vfAnulHash: { not: null } },
      orderBy: { vfAnulTimestamp: 'desc' },
      select: { vfAnulHash: true, vfAnulTimestamp: true },
    }),
  ]);

  if (!ultimaAnul?.vfAnulHash) return ultimaAlta?.vfHash ?? '';
  if (!ultimaAlta?.vfHash) return ultimaAnul.vfAnulHash;

  // Se compara por el sello del REGISTRO (cuándo se generó), no por la fecha de la factura.
  const tAlta = (ultimaAlta.vfTimestamp ?? ultimaAlta.createdAt).getTime();
  const tAnul = (ultimaAnul.vfAnulTimestamp as Date).getTime();
  return tAnul > tAlta ? ultimaAnul.vfAnulHash : ultimaAlta.vfHash;
}

/**
 * SCRUM-145d — `RegistroAnterior` del registro de ANULACIÓN, por la huella PERSISTIDA.
 *
 * Antes se infería por SELLO (el registro inmediatamente anterior). Eso es frágil justo donde
 * no puede serlo: con dos anulaciones próximas en el tiempo los sellos pueden empatar o
 * invertirse, y una cadena de huellas se sella PARA SIEMPRE. Ahora se busca por
 * `vfAnulPrevHash` — exactamente lo que se hasheó —, igual que el alta hace con `vfPrevHash`.
 *
 * `registros` contiene AMBOS tipos (altas y anulaciones): una anulación puede encadenar con
 * cualquiera de los dos.
 */
function anulacionPrev(
  inv: { number: string; vfAnulPrevHash: string | null },
  taxId: string,
  registros: { huella: string; numero: string; fecha: Date }[],
): string {
  // Vacío = primer registro de la cadena. Es legítimo, no un fallo.
  if (!inv.vfAnulPrevHash) return '';
  const anterior = registros.find((r) => r.huella === inv.vfAnulPrevHash);
  // Huella guardada pero sin registro que la respalde = cadena no acreditable. Se lanza, igual
  // que en el alta: fingir `PrimerRegistro` mentiría sobre la cadena.
  if (!anterior) throw new Error(`verifactu_cadena_anulacion_rota:${inv.number}`);
  return `
        <sum1:RegistroAnterior>
          <sum1:IDEmisorFactura>${xmlEscape(taxId)}</sum1:IDEmisorFactura>
          <sum1:NumSerieFactura>${xmlEscape(anterior.numero)}</sum1:NumSerieFactura>
          <sum1:FechaExpedicionFactura>${formatDateES(anterior.fecha)}</sum1:FechaExpedicionFactura>
          <sum1:Huella>${xmlEscape(anterior.huella)}</sum1:Huella>
        </sum1:RegistroAnterior>`;
}

function xmlEscape(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (s) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' } as any)[s]);
}

/**
 * SCRUM-82: registro RRSIF (RegistrosFacturacion) de un merchant para UN año natural.
 * Extraído de GET /admin/exports/verifactu.xml (SCRUM-73) para que GET /admin/exports/datos.zip
 * (SCRUM-25) pueda incluir el MISMO XML sin duplicar el constructor — misma fuente, sin
 * divergencia posible entre el endpoint suelto y el paquete completo.
 *
 * Estructura inspirada en el XSD SuministroInformacion de la AEAT (RegistroFacturacionAlta:
 * IDFactura, Desglose por tipo, CuotaTotal, Encadenamiento de huellas, Huella SHA-256). El
 * ENVÍO telemático real al SIF requiere certificado digital del emisor — pendiente (tarea
 * usuario), esto es el registro, no la remisión.
 *
 * NO comprueba el flag INVOICING_ES_ENABLED — es responsabilidad del CALLER (mismo patrón que
 * applyVeriFactu, que tampoco mira flags). Lanza si el merchant no existe o no tiene NIF:
 * un XML sin emisor identificable no es un registro válido, y el caller decide cómo tratarlo
 * (404/409 en la ruta suelta, abortar el ZIP entero en datos.zip — nunca un XML a medias).
 */
export async function buildVerifactuRegistrosXml(
  params: { merchantId: number; year: number },
  prismaClient = defaultPrisma,
  // SCRUM-215: el modo lo fija la constante del módulo fiscal. Este parámetro existe SOLO para
  // poder DEMOSTRAR que las dos salidas del dictamen P11 se emiten y validan antes de que el
  // dictamen exista. Producción tiene un único llamador y no lo pasa nunca.
  opts: { modoSinDestinatario?: ModoSinDestinatario; modoTipoRectificativa?: ModoTipoRectificativa } = {},
): Promise<{ xml: string; count: number; excluidos: Array<{ number: string; motivo: string }> }> {
  const merchant = await prismaClient.merchant.findUnique({ where: { id: params.merchantId } });
  if (!merchant) throw new Error('merchant_not_found');
  if (merchant.country !== 'ES' || !merchant.taxId) throw new Error('verifactu_not_applicable');

  const invoices = await prismaClient.invoice.findMany({
    where: {
      merchantId: params.merchantId,
      createdAt: {
        gte: new Date(params.year, 0, 1),
        lte: new Date(params.year, 11, 31, 23, 59, 59, 999),
      },
    },
    orderBy: { createdAt: 'asc' },
    // SCRUM-145: vfTimestamp (sello real de la huella) y los campos de ANULACIÓN.
    include: {
      // SCRUM-145 (gap 6): el NIF del cliente decide si se puede emitir `Destinatarios`.
      customer:  { select: { name: true, taxId: true } },
      // SCRUM-216: `lines` de la factura RECTIFICADA — de ahi salen la base y la cuota
      // SUSTITUIDAS que exige `ImporteRectificacion` en las rectificativas por sustitucion
      // (AEAT 1118). Sin ellas ese camino no se puede construir, solo bloquear.
      rectifies: { select: { number: true, createdAt: true, lines: true } },
    },
  });

  // SCRUM-145 (gap 1): el XSD tope `RegistroFactura` en 1000 por envío. Con más facturas en
  // el ejercicio habría que trocear en varios envíos (lo hará la cola de remisión, S1-D).
  // Hasta entonces se falla en claro: mejor un error que un fichero inválido que parece bueno.
  if (invoices.length > MAX_REGISTROS) {
    throw new Error(`verifactu_demasiados_registros:${invoices.length}`);
  }

  // SCRUM-145 (gap 2): datos del PRODUCTOR (art. 13 RRSIF) — los que se firman en la
  // declaración responsable. FAIL-CLOSED: sin ellos NO se emite. Un `SistemaInformatico`
  // relleno con placeholders sería un registro fiscal que miente sobre quién produjo el
  // software; preferimos un error explícito (el caller ya sabe abortar: 409 en la ruta
  // suelta, ZIP entero abortado — nunca un XML a medias).
  const productor = {
    nombre: VERIFACTU_PRODUCTOR_NOMBRE,
    nif: VERIFACTU_PRODUCTOR_NIF,
    idSistema: VERIFACTU_ID_SISTEMA,
    version: VERIFACTU_VERSION,
    numInstalacion: VERIFACTU_NUM_INSTALACION,
  };
  if (!productor.nombre || !productor.nif || !productor.idSistema || !productor.version || !productor.numInstalacion) {
    throw new Error('verifactu_productor_no_configurado');
  }

  // SCRUM-145 (gap 4): el XSD exige que `RegistroAnterior` identifique la factura anterior
  // COMPLETA (emisor + nº + fecha + huella), no solo su huella. No hace falta columna nueva:
  // la anterior es, por definición, aquella cuya `vfHash` es nuestra `vfPrevHash`. Se indexan
  // TODAS las facturas con huella del merchant (no solo las del año pedido) porque el primer
  // registro de un ejercicio encadena con el último del anterior.
  const conHuella = await prismaClient.invoice.findMany({
    where: { merchantId: params.merchantId, vfHash: { not: null } },
    select: { number: true, createdAt: true, vfHash: true, vfTimestamp: true, vfAnulHash: true, vfAnulTimestamp: true, vfAnulPrevHash: true },
  });
  const porHuella = new Map(conHuella.map((i) => [i.vfHash as string, i]));

  // SCRUM-145 (gap 5): la cadena COMPLETA del emisor ordenada por sello — altas y anulaciones
  // mezcladas —, para poder resolver el `RegistroAnterior` de cada anulación. Se construye una
  // sola vez, no por registro.
  const registrosOrdenados = [
    ...conHuella.map((i) => ({
      sello: (i.vfTimestamp ?? i.createdAt).getTime(),
      huella: i.vfHash as string,
      numero: i.number,
      fecha: i.createdAt,
    })),
    ...conHuella
      .filter((i) => i.vfAnulHash && i.vfAnulTimestamp)
      .map((i) => ({
        sello: (i.vfAnulTimestamp as Date).getTime(),
        huella: i.vfAnulHash as string,
        numero: i.number,
        fecha: i.createdAt,
      })),
  ].sort((a, b) => a.sello - b.sello);

  const nombreEmisor = merchant.legalName || merchant.name;
  // ⚠️ NO UNIFICAR con el formato de los CSV (SCRUM-86). Aquí los importes van con PUNTO
  // decimal (`121.00`) porque lo exige el esquema de la AEAT: el tipo es un decimal XSD, y
  // el separador decimal de XSD es el punto, no depende del locale. Este fichero no lo abre
  // Excel — lo lee Hacienda. Cambiarlo a coma para que "cuadre con los CSV" invalidaría el
  // registro de facturación.
  // SCRUM-209: una factura que no se puede declarar NO tumba el paquete entero. Se excluye
  // ESA, se REPORTA con su número y su motivo, y el resto del ejercicio sale. Un merchant
  // con una factura antigua sin líneas tiene derecho a su pack de inspección con las 400
  // buenas; dejarlo sin nada es convertir un rojo puntual en una caída total.
  //
  // Lo que NO se hace es callarlo: la exclusión viaja DENTRO del propio XML como comentario
  // (así llega igual por el ZIP y por el endpoint suelto, que deben ser idénticos) y además
  // se devuelve al llamador para el LEEME del paquete. Omitir una factura en silencio de un
  // registro fiscal sería peor que el fallo original.
  const excluidos: Array<{ number: string; motivo: string }> = [];

  const construirRegistro = (inv: (typeof invoices)[number]): string => {
    const lines = Array.isArray(inv.lines) ? (inv.lines as any[]) : [];
    const vat = calcVatBreakdown(lines);
    // SCRUM-209: el desglose ya NO se construye aquí. Este bloque tenía su propia plantilla
    // y divergió de la de `registro.builder.ts`: omitía `ClaveRegimen` y
    // `CalificacionOperacion`, así que el XML exportado NO validaba contra el XSD (AEAT
    // 1245 y 1195) mientras `validate-registros-xsd.ps1` daba verde — porque validaba el
    // OTRO constructor, el que no usaba nadie. Ahora hay uno solo, y un guard lo vigila.
    //
    // `clasificarDetalleDesglose` LANZA si un tramo no se puede calificar con certeza (0 %:
    // sujeta-al-0 / exenta / no sujeta son tres declaraciones distintas y el dato que las
    // separa no está en las líneas). Bloquea la emisión en vez de inventarse el código.
    const desglose = buildDetallesDesgloseXml(
      vat.entries.map((e) => clasificarDetalleDesglose(e, inv.number)),
    );

    // Sin líneas no hay desglose que declarar. Antes se emitía un tramo al 0 % con la base
    // igual al total de la factura — es decir, se DECLARABA que la operación no lleva IVA,
    // sobre una factura de la que no sabemos nada. Eso es exactamente lo que el resto de
    // esta función se niega a hacer con la cadena o con el destinatario.
    if (!desglose) {
      throw new DesgloseNoClasificableError(
        `la factura no tiene líneas, así que no hay desglose de IVA que declarar. Antes se ` +
          `emitía un 0% sobre el total (${Number(inv.total).toFixed(2)}), que es una declaración ` +
          'inventada. Corrige las líneas de la factura antes de exportar.',
        inv.number,
      );
    }

    // ⚠️ PENDIENTE FISCAL (asesor): el XSD admite `TipoRectificativa` (S=sustitución /
    // I=diferencias) y `ImporteRectificacion`, ambos minOccurs=0. NO se emiten porque elegir
    // uno u otro es una calificación fiscal, no una decisión de implementación (regla: no
    // inventar). Queda registrado en SCRUM-145 para el dictamen.
    // SCRUM-216: la R1 ya no sale sin `TipoRectificativa` — eso era un 1114 seguro en CADA
    // rectificativa. Omitir un campo que el esquema exige no es abstenerse: es garantizar el
    // rechazo. Hoy `MODO_TIPO_RECTIFICATIVA` vale SIN_CONFIRMAR, así que la R1 se EXCLUYE del
    // registro y se reporta; no se emite con un valor que nadie ha confirmado.
    //
    // La base y la cuota SUSTITUIDAS salen de las líneas de la factura RECTIFICADA (no de la
    // R1): es lo que significa «sustituida» en `DesgloseRectificacionType`.
    const esRectificativa = inv.type === 'R1' && !!inv.rectifies;
    const importeRectificado = esRectificativa && Array.isArray((inv.rectifies as any)!.lines)
      ? (() => {
          const v = calcVatBreakdown((inv.rectifies as any)!.lines as any[]);
          return { baseRectificada: v.base.toFixed(2), cuotaRectificada: v.cuota.toFixed(2) };
        })()
      : null;

    const rectificativa = esRectificativa
      ? resolverTipoRectificativa(
          inv.number,
          importeRectificado,
          opts.modoTipoRectificativa ?? MODO_TIPO_RECTIFICATIVA,
        )
      : { tipoXml: '', importeXml: '' };

    const rectificadas = esRectificativa ? `
      <sum1:FacturasRectificadas>
        <sum1:IDFacturaRectificada>
          <sum1:IDEmisorFactura>${xmlEscape(merchant.taxId!)}</sum1:IDEmisorFactura>
          <sum1:NumSerieFactura>${xmlEscape(inv.rectifies!.number)}</sum1:NumSerieFactura>
          <sum1:FechaExpedicionFactura>${formatDateES(inv.rectifies!.createdAt)}</sum1:FechaExpedicionFactura>
        </sum1:IDFacturaRectificada>
      </sum1:FacturasRectificadas>${rectificativa.importeXml}` : '';

    // SCRUM-145 (gap 4): `RegistroAnterior` completo. Si la huella anterior existe pero NO
    // se encuentra su factura (cadena rota o registro de otro sistema), se cae a
    // `PrimerRegistro` NO: eso mentiría sobre la cadena. Se lanza — un encadenamiento que no
    // se puede acreditar invalida el registro (regla de la skill: la cadena es intocable).
    const anterior = inv.vfPrevHash && inv.vfPrevHash !== '0' ? porHuella.get(inv.vfPrevHash) : null;
    if (inv.vfPrevHash && inv.vfPrevHash !== '0' && !anterior) {
      throw new Error(`verifactu_cadena_rota:${inv.number}`);
    }
    const encadenamiento = inv.vfHash ? `
      <sum1:Encadenamiento>${anterior ? `
        <sum1:RegistroAnterior>
          <sum1:IDEmisorFactura>${xmlEscape(merchant.taxId!)}</sum1:IDEmisorFactura>
          <sum1:NumSerieFactura>${xmlEscape(anterior.number)}</sum1:NumSerieFactura>
          <sum1:FechaExpedicionFactura>${formatDateES(anterior.createdAt)}</sum1:FechaExpedicionFactura>
          <sum1:Huella>${xmlEscape(inv.vfPrevHash!)}</sum1:Huella>
        </sum1:RegistroAnterior>` : `
        <sum1:PrimerRegistro>S</sum1:PrimerRegistro>`}
      </sum1:Encadenamiento>
      <sum1:SistemaInformatico>
        <sum1:NombreRazon>${xmlEscape(productor.nombre)}</sum1:NombreRazon>
        <sum1:NIF>${xmlEscape(productor.nif)}</sum1:NIF>
        <sum1:NombreSistemaInformatico>YaQu</sum1:NombreSistemaInformatico>
        <sum1:IdSistemaInformatico>${xmlEscape(productor.idSistema)}</sum1:IdSistemaInformatico>
        <sum1:Version>${xmlEscape(productor.version)}</sum1:Version>
        <sum1:NumeroInstalacion>${xmlEscape(productor.numInstalacion)}</sum1:NumeroInstalacion>
        <sum1:TipoUsoPosibleSoloVerifactu>S</sum1:TipoUsoPosibleSoloVerifactu>
        <sum1:TipoUsoPosibleMultiOT>S</sum1:TipoUsoPosibleMultiOT>
        <sum1:IndicadorMultiplesOT>S</sum1:IndicadorMultiplesOT>
      </sum1:SistemaInformatico>
      <!-- SCRUM-145: el sello REAL que entró en la huella (vfTimestamp). El fallback a
           createdAt es solo para las filas selladas ANTES de existir la columna: ahí la
           huella sigue sin ser recomputable por un tercero y no hay forma de recuperarlo
           (el instante no se guardó). Ninguna de esas filas se remitirá: la remisión
           empieza post-SIF y solo con registros nuevos. -->
      <sum1:FechaHoraHusoGenRegistro>${formatFechaHoraHuso(inv.vfTimestamp ?? inv.createdAt)}</sum1:FechaHoraHusoGenRegistro>
      <sum1:TipoHuella>01</sum1:TipoHuella>
      <sum1:Huella>${xmlEscape(inv.vfHash)}</sum1:Huella>` : '';

    // SCRUM-145 (gap 6): `Destinatarios` es minOccurs=0 en el XSD, pero SI se emite,
    // `IDDestinatario` exige `NombreRazon` + choice OBLIGATORIO `NIF|IDOtro`. Hasta ahora se
    // emitía `NombreRazon` suelto → XML INVÁLIDO. Se emite solo cuando hay NIF del cliente.
    //
    // SCRUM-215: y cuando NO lo hay, ya no se omite en silencio. Omitirlo era válido contra el
    // XSD y RECHAZADO por la AEAT (1189) — el hueco exacto que ni el esquema ni un assert de
    // cadena podían ver. Ahora se resuelve por `MODO_SIN_DESTINATARIO`, que hoy vale
    // SIN_DICTAMEN: la factura se EXCLUYE del registro y se reporta, en vez de declararse con
    // una marca que nadie ha decidido. El producto no se toca: la factura se emite y se cobra.
    const tipoBase: 'F1' | 'R1' = inv.type === 'R1' ? 'R1' : 'F1';
    const sinDestinatario = !inv.customer?.taxId
      ? resolverSinDestinatario(tipoBase, inv.number, opts.modoSinDestinatario ?? MODO_SIN_DESTINATARIO)
      : null;

    const tipoFactura = sinDestinatario ? sinDestinatario.tipoFactura : tipoBase;
    // Va entre `DescripcionOperacion` y `Destinatarios`: es el orden del XSD (sequence).
    const marcadorSinDestinatario = sinDestinatario ? sinDestinatario.marcadorXml : '';

    const destinatarios = inv.customer?.taxId ? `
      <sum1:Destinatarios>
        <sum1:IDDestinatario>
          <sum1:NombreRazon>${xmlEscape(inv.customer.name || 'Cliente')}</sum1:NombreRazon>
          <sum1:NIF>${xmlEscape(inv.customer.taxId)}</sum1:NIF>
        </sum1:IDDestinatario>
      </sum1:Destinatarios>` : '';

    // SCRUM-145 (gap 5): si la factura tiene sellado un registro de ANULACIÓN, se emite DETRÁS
    // de su alta como registro PROPIO — el XSD declara `RegistroAnulacion` como hermano de
    // `RegistroAlta` dentro de `RegistroFactura`. El alta NO se retira: la factura anulada
    // conserva su registro y su huella (regla 29: una emitida jamás se edita ni borra).
    const anulacion = inv.vfAnulHash && inv.vfAnulTimestamp ? `
  <sum:RegistroFactura>
    <sum1:RegistroAnulacion>
      <sum1:IDVersion>1.0</sum1:IDVersion>
      <sum1:IDFactura>
        <sum1:IDEmisorFacturaAnulada>${xmlEscape(merchant.taxId!)}</sum1:IDEmisorFacturaAnulada>
        <sum1:NumSerieFacturaAnulada>${xmlEscape(inv.number)}</sum1:NumSerieFacturaAnulada>
        <sum1:FechaExpedicionFacturaAnulada>${formatDateES(inv.createdAt)}</sum1:FechaExpedicionFacturaAnulada>
      </sum1:IDFactura>
      <sum1:Encadenamiento>${anulacionPrev(inv, merchant.taxId!, registrosOrdenados) || `
        <sum1:PrimerRegistro>S</sum1:PrimerRegistro>`}
      </sum1:Encadenamiento>
      <sum1:SistemaInformatico>
        <sum1:NombreRazon>${xmlEscape(productor.nombre)}</sum1:NombreRazon>
        <sum1:NIF>${xmlEscape(productor.nif)}</sum1:NIF>
        <sum1:NombreSistemaInformatico>YaQu</sum1:NombreSistemaInformatico>
        <sum1:IdSistemaInformatico>${xmlEscape(productor.idSistema)}</sum1:IdSistemaInformatico>
        <sum1:Version>${xmlEscape(productor.version)}</sum1:Version>
        <sum1:NumeroInstalacion>${xmlEscape(productor.numInstalacion)}</sum1:NumeroInstalacion>
        <sum1:TipoUsoPosibleSoloVerifactu>S</sum1:TipoUsoPosibleSoloVerifactu>
        <sum1:TipoUsoPosibleMultiOT>S</sum1:TipoUsoPosibleMultiOT>
        <sum1:IndicadorMultiplesOT>S</sum1:IndicadorMultiplesOT>
      </sum1:SistemaInformatico>
      <sum1:FechaHoraHusoGenRegistro>${formatFechaHoraHuso(inv.vfAnulTimestamp)}</sum1:FechaHoraHusoGenRegistro>
      <sum1:TipoHuella>01</sum1:TipoHuella>
      <sum1:Huella>${xmlEscape(inv.vfAnulHash)}</sum1:Huella>
    </sum1:RegistroAnulacion>
  </sum:RegistroFactura>` : '';

    return `
  <sum:RegistroFactura>
    <sum1:RegistroAlta>
      <sum1:IDVersion>1.0</sum1:IDVersion>
      <sum1:IDFactura>
        <sum1:IDEmisorFactura>${xmlEscape(merchant.taxId!)}</sum1:IDEmisorFactura>
        <sum1:NumSerieFactura>${xmlEscape(inv.number)}</sum1:NumSerieFactura>
        <sum1:FechaExpedicionFactura>${formatDateES(inv.createdAt)}</sum1:FechaExpedicionFactura>
      </sum1:IDFactura>
      <sum1:NombreRazonEmisor>${xmlEscape(nombreEmisor)}</sum1:NombreRazonEmisor>
      <sum1:TipoFactura>${tipoFactura}</sum1:TipoFactura>${rectificativa.tipoXml}${rectificadas}
      <sum1:DescripcionOperacion>${xmlEscape(lines[0]?.concept || `Factura ${inv.number}`)}</sum1:DescripcionOperacion>${marcadorSinDestinatario}${destinatarios}
      <sum1:Desglose>${desglose}
      </sum1:Desglose>
      <sum1:CuotaTotal>${vat.cuota.toFixed(2)}</sum1:CuotaTotal>
      <sum1:ImporteTotal>${Number(inv.total).toFixed(2)}</sum1:ImporteTotal>${encadenamiento}
    </sum1:RegistroAlta>
  </sum:RegistroFactura>${anulacion}`;
  };

  const registros: string[] = [];
  for (const inv of invoices) {
    try {
      registros.push(construirRegistro(inv));
    } catch (e) {
      // SOLO se excluye lo que no se puede CALIFICAR. Una cadena rota
      // (verifactu_cadena_rota) sigue tumbando el paquete entero A PROPÓSITO: ahí el
      // problema no es una factura, es que el encadenamiento no se puede acreditar, y un
      // pack al que le falta un eslabón sin decirlo es peor que no entregarlo.
      if (e instanceof RegistroNoEmitibleError) {
        excluidos.push({ number: inv.number, motivo: e.motivo });
        continue;
      }
      throw e;
    }
  }

  // SCRUM-145 (gap 1): envelope REAL del XSD. Antes la raíz era `<RegistrosFacturacion>` sin
  // namespaces y el registro se llamaba `<RegistroFacturacionAlta>` — que es el nombre del
  // TIPO, no del ELEMENTO (`SuministroInformacion.xsd:37` declara `RegistroAlta`). Nada de
  // eso validaba. Límite duro del XSD: `RegistroFactura` maxOccurs=1000 por envío.
  // SCRUM-209: el parte de exclusiones viaja DENTRO del documento, como comentario XML.
  // Va aquí y no solo en el LEEME por dos razones: el endpoint suelto (`GET /verifactu.xml`)
  // no tiene LEEME, y el ZIP y el endpuesto deben entregar el MISMO fichero (scrum82). Un
  // comentario no altera la validación XSD y deja el rastro pegado al documento que se
  // enseña en una inspección — que es justo donde tiene que estar.
  const parteExclusiones = excluidos.length === 0 ? '' : `
  <!-- ATENCION: ${excluidos.length} factura(s) de ${params.year} NO se han podido declarar y
       quedan FUERA de este registro. No es una omision silenciosa: se listan aqui con su
       numero y su motivo para que se corrijan y se vuelva a exportar.
${excluidos.map((x) => `       · ${xmlEscape(x.number)}: ${xmlEscape(x.motivo)}`).join('\n')}
  -->`;

  // SCRUM-216: si NO queda ningún registro que declarar, no se entrega un documento vacío.
  // El XSD exige al menos un `RegistroFactura` (`RegFactuSistemaFacturacion`: «Missing child
  // element(s)»), así que un envelope con la cabecera sola es un XML INVÁLIDO — justo lo que
  // toda esta cadena de tickets viene a evitar. Y no es un caso de laboratorio: con las
  // exclusiones de SCRUM-215 y 216, un merchant cuyo ejercicio sean todo facturas a
  // particulares, o solo rectificativas, cae aquí entero.
  //
  // Se devuelve `xml: ''` — «no hay nada que declarar», con el parte de exclusiones intacto
  // para que quien llama diga POR QUÉ. Entregar un fichero inválido sería peor que no
  // entregarlo; entregarlo en silencio, peor todavía.
  if (registros.length === 0) {
    return { xml: '', count: 0, excluidos };
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sum:RegFactuSistemaFacturacion xmlns:sum="${NS_LR}" xmlns:sum1="${NS_INFO}">${parteExclusiones}
  <sum:Cabecera>
    <sum1:ObligadoEmision>
      <sum1:NombreRazon>${xmlEscape(nombreEmisor)}</sum1:NombreRazon>
      <sum1:NIF>${xmlEscape(merchant.taxId)}</sum1:NIF>
    </sum1:ObligadoEmision>
  </sum:Cabecera>
${registros.join('\n')}
</sum:RegFactuSistemaFacturacion>
`;

  // `count` = registros REALMENTE declarados, no facturas miradas. Si contara las miradas,
  // un pack con exclusiones informaría un número que el fichero no respalda.
  return { xml, count: registros.length, excluidos };
}
