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

// SCRUM-145: namespaces oficiales de los XSD de la AEAT (los ficheros están en
// `src/modules/fiscal/verifactu/xsd/`). Los `targetNamespace` son la URL del esquema; NO son
// endpoints y no se resuelven en tiempo de ejecución.
const NS_LR = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd';
const NS_INFO = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd';
/** Máximo de registros por envío que admite el XSD (`RegistroFactura` maxOccurs="1000"). */
const MAX_REGISTROS = 1000;

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

  // Última factura del merchant que ya tenga huella (excluye la actual)
  const prev = await prismaClient.invoice.findFirst({
    where: {
      merchantId: invoice.merchantId,
      vfHash: { not: null },
      id: { not: invoice.id },
    },
    orderBy: { createdAt: 'desc' },
    select: { vfHash: true },
  });

  // S1-A: el PRIMER registro del emisor lleva huella anterior VACÍA (no '0')
  const prevHash = prev?.vfHash ?? '';
  const fecha = formatDateES(invoice.createdAt);
  const timestamp = formatFechaHoraHuso(new Date());
  const importeTotal = Number(invoice.total.toString()).toFixed(2);

  // Cuota total de IVA real desde las líneas (garantizadas no vacías por el guard de arriba,
  // que además reutiliza esta misma lectura — no hay consulta de más).
  const cuotaTotal = calcVatCuotaTotal(lineas).toFixed(2);

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

  await prismaClient.invoice.update({
    where: { id: invoice.id },
    data: { vfHash, vfPrevHash: prevHash, qrData: qrUrl },
  });

  console.log(`[verifactu] invoice=${invoice.number} hash=${vfHash.slice(0, 16)}…`);
  return { vfHash, vfPrevHash: prevHash, qrUrl };
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
): Promise<{ xml: string; count: number }> {
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
    include: {
      // SCRUM-145 (gap 6): el NIF del cliente decide si se puede emitir `Destinatarios`.
      customer:  { select: { name: true, taxId: true } },
      rectifies: { select: { number: true, createdAt: true } },
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
    nombre: config.VERIFACTU_PRODUCTOR_NOMBRE,
    nif: config.VERIFACTU_PRODUCTOR_NIF,
    idSistema: config.VERIFACTU_ID_SISTEMA,
    version: config.VERIFACTU_VERSION,
    numInstalacion: config.VERIFACTU_NUM_INSTALACION,
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
    select: { number: true, createdAt: true, vfHash: true },
  });
  const porHuella = new Map(conHuella.map((i) => [i.vfHash as string, i]));

  const nombreEmisor = merchant.legalName || merchant.name;
  // ⚠️ NO UNIFICAR con el formato de los CSV (SCRUM-86). Aquí los importes van con PUNTO
  // decimal (`121.00`) porque lo exige el esquema de la AEAT: el tipo es un decimal XSD, y
  // el separador decimal de XSD es el punto, no depende del locale. Este fichero no lo abre
  // Excel — lo lee Hacienda. Cambiarlo a coma para que "cuadre con los CSV" invalidaría el
  // registro de facturación.
  const registros = invoices.map((inv) => {
    const lines = Array.isArray(inv.lines) ? (inv.lines as any[]) : [];
    const vat = calcVatBreakdown(lines);
    const desglose = vat.entries.map((e) => `
        <sum1:DetalleDesglose>
          <sum1:Impuesto>01</sum1:Impuesto>
          <sum1:TipoImpositivo>${e.rate}</sum1:TipoImpositivo>
          <sum1:BaseImponibleOimporteNoSujeto>${e.base.toFixed(2)}</sum1:BaseImponibleOimporteNoSujeto>
          <sum1:CuotaRepercutida>${e.cuota.toFixed(2)}</sum1:CuotaRepercutida>
        </sum1:DetalleDesglose>`).join('');

    // ⚠️ PENDIENTE FISCAL (asesor): el XSD admite `TipoRectificativa` (S=sustitución /
    // I=diferencias) y `ImporteRectificacion`, ambos minOccurs=0. NO se emiten porque elegir
    // uno u otro es una calificación fiscal, no una decisión de implementación (regla: no
    // inventar). Queda registrado en SCRUM-145 para el dictamen.
    const rectificadas = inv.type === 'R1' && inv.rectifies ? `
      <sum1:FacturasRectificadas>
        <sum1:IDFacturaRectificada>
          <sum1:IDEmisorFactura>${xmlEscape(merchant.taxId!)}</sum1:IDEmisorFactura>
          <sum1:NumSerieFactura>${xmlEscape(inv.rectifies.number)}</sum1:NumSerieFactura>
          <sum1:FechaExpedicionFactura>${formatDateES(inv.rectifies.createdAt)}</sum1:FechaExpedicionFactura>
        </sum1:IDFacturaRectificada>
      </sum1:FacturasRectificadas>` : '';

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
      <sum1:FechaHoraHusoGenRegistro>${formatFechaHoraHuso(inv.createdAt)}</sum1:FechaHoraHusoGenRegistro>
      <sum1:TipoHuella>01</sum1:TipoHuella>
      <sum1:Huella>${xmlEscape(inv.vfHash)}</sum1:Huella>` : '';

    // SCRUM-145 (gap 6): `Destinatarios` es minOccurs=0 en el XSD, pero SI se emite,
    // `IDDestinatario` exige `NombreRazon` + choice OBLIGATORIO `NIF|IDOtro`. Hasta ahora se
    // emitía `NombreRazon` suelto → XML INVÁLIDO. Se emite solo cuando hay NIF del cliente.
    // ⚠️ PENDIENTE FISCAL (asesor, NO se decide en código): una F1 sin destinatario
    // identificado debe marcarse con `FacturaSinIdentifDestinatarioArt61d` o emitirse como F2
    // simplificada. Mientras no haya dictamen NO se inventa ninguna de las dos: se omite el
    // bloque (válido contra el XSD) y la cuestión queda registrada en SCRUM-145.
    const destinatarios = inv.customer?.taxId ? `
      <sum1:Destinatarios>
        <sum1:IDDestinatario>
          <sum1:NombreRazon>${xmlEscape(inv.customer.name || 'Cliente')}</sum1:NombreRazon>
          <sum1:NIF>${xmlEscape(inv.customer.taxId)}</sum1:NIF>
        </sum1:IDDestinatario>
      </sum1:Destinatarios>` : '';

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
      <sum1:TipoFactura>${inv.type === 'R1' ? 'R1' : 'F1'}</sum1:TipoFactura>${rectificadas}
      <sum1:DescripcionOperacion>${xmlEscape(lines[0]?.concept || `Factura ${inv.number}`)}</sum1:DescripcionOperacion>${destinatarios}
      <sum1:Desglose>${desglose || `
        <sum1:DetalleDesglose>
          <sum1:Impuesto>01</sum1:Impuesto>
          <sum1:TipoImpositivo>0</sum1:TipoImpositivo>
          <sum1:BaseImponibleOimporteNoSujeto>${Number(inv.total).toFixed(2)}</sum1:BaseImponibleOimporteNoSujeto>
          <sum1:CuotaRepercutida>0.00</sum1:CuotaRepercutida>
        </sum1:DetalleDesglose>`}
      </sum1:Desglose>
      <sum1:CuotaTotal>${vat.cuota.toFixed(2)}</sum1:CuotaTotal>
      <sum1:ImporteTotal>${Number(inv.total).toFixed(2)}</sum1:ImporteTotal>${encadenamiento}
    </sum1:RegistroAlta>
  </sum:RegistroFactura>`;
  }).join('\n');

  // SCRUM-145 (gap 1): envelope REAL del XSD. Antes la raíz era `<RegistrosFacturacion>` sin
  // namespaces y el registro se llamaba `<RegistroFacturacionAlta>` — que es el nombre del
  // TIPO, no del ELEMENTO (`SuministroInformacion.xsd:37` declara `RegistroAlta`). Nada de
  // eso validaba. Límite duro del XSD: `RegistroFactura` maxOccurs=1000 por envío.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sum:RegFactuSistemaFacturacion xmlns:sum="${NS_LR}" xmlns:sum1="${NS_INFO}">
  <sum:Cabecera>
    <sum1:ObligadoEmision>
      <sum1:NombreRazon>${xmlEscape(nombreEmisor)}</sum1:NombreRazon>
      <sum1:NIF>${xmlEscape(merchant.taxId)}</sum1:NIF>
    </sum1:ObligadoEmision>
  </sum:Cabecera>
${registros}
</sum:RegFactuSistemaFacturacion>
`;

  return { xml, count: invoices.length };
}
