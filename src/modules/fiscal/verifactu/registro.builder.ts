// S1-C (master U1.3) — Builders PUROS de registros de facturación VERI*FACTU
// conformes a SuministroLR.xsd / SuministroInformacion.xsd (vendorizados en ./xsd,
// espejo del WSDL oficial — ver docs/SIF_SPEC_NOTES.md y docs/AUDITORIA_RRSIF.md).
//
// Sin BD ni red: reciben todo por parámetros (testeables y validables contra XSD
// con scripts/validate-registros-xsd.ps1). El cliente SOAP (S1-D) los envuelve.
//
// ORDEN DE ELEMENTOS = orden del XSD (sequence): cambiarlo rompe la validación.

const NS_LR = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd';
const NS_SF = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd';

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (s) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' } as Record<string, string>)[s]);
}

/** Datos del SISTEMA INFORMÁTICO (bloque obligatorio; ligado a la declaración responsable S1-E). */
export interface SistemaInformatico {
  nombreRazonProductor: string; // productor del SIF (empresa/persona) — declaración S1-E
  nifProductor: string;
  nombreSistema: string;        // 'YaQu' (TextMax30)
  idSistema: string;            // código de 2 caracteres asignado por el productor (ej. '01')
  version: string;              // versión del SIF declarada
  numeroInstalacion: string;    // identificador de la instalación (SaaS: '1')
  soloVerifactu: 'S' | 'N';     // YaQu: 'S' (solo modalidad VERI*FACTU)
  multiOT: 'S' | 'N';           // soporta varios obligados: SaaS multi-tenant → 'S'
  indicadorMultiplesOT: 'S' | 'N';
}

export interface Encadenamiento {
  primerRegistro: boolean;
  anterior?: { idEmisorFactura: string; numSerieFactura: string; fechaExpedicion: string; huella: string };
}

export interface DetalleDesglose {
  // SCRUM-209: `claveRegimen` era OPCIONAL y eso era un 1245 latente — un llamador que la
  // omitiera producía un registro que la AEAT rechaza, sin que nada chillara
  // (docs/legal/SEMAFORO_CALIBRACION.md §7.2). Ahora es OBLIGATORIA: el tipo lo impide.
  claveRegimen: string;         // IdOperacionesTrascendenciaTributariaType (L8A)
  calificacion: string;         // CalificacionOperacionType: S1 | S2 | N1 | N2
  tipoImpositivo?: string;      // ej. '21'
  baseImponible: string;        // ImporteSgn12.2 (punto decimal, 2 dec)
  cuotaRepercutida?: string;
}

/** Operación SUJETA y NO EXENTA (el caso general). `CalificacionOperacionType`. */
export const CALIFICACION_SUJETA_NO_EXENTA = 'S1';
/** Régimen general de IVA. `IdOperacionesTrascendenciaTributariaType`, lista L8A. */
export const CLAVE_REGIMEN_GENERAL = '01';

/**
 * SCRUM-209 · Una línea que NO se puede calificar con certeza NO recibe un código por
 * defecto: se bloquea la emisión. Adivinar un régimen o una calificación es declarar en
 * falso ante la AEAT, y queda sellado en la huella (regla 29: solo se corrige con una R1).
 */
export class DesgloseNoClasificableError extends Error {
  constructor(public readonly motivo: string, public readonly ref?: string) {
    super(`verifactu_desglose_no_clasificable${ref ? `:${ref}` : ''} — ${motivo}`);
    this.name = 'DesgloseNoClasificableError';
  }
}

/**
 * Traduce un tramo del desglose de IVA (`calcVatBreakdown`) a su calificación fiscal.
 *
 * SOLO sabe resolver el caso general: **sujeta y no exenta a un tipo positivo** → `S1` + `01`.
 * Eso cubre el 21/10/4 % del régimen general, que es todo lo que YaQu emite hoy.
 *
 * ⚠️ EL 0 % NO ES CLASIFICABLE, y por eso lanza. De `tax: 0` no se puede distinguir:
 *   · una operación **sujeta al 0 %** (existe desde 2023 en alimentación básica) → S1
 *   · una operación **exenta** (art. 20 LIVA) → `OperacionExenta`, y CalificacionOperacion
 *     NO debe ir informada (son excluyentes — AEAT 1196)
 *   · una operación **no sujeta** → N1 / N2
 * Son tres declaraciones distintas y el dato que las separa no existe en `Invoice.lines`
 * (`VatLine` solo guarda `qty`, `price` y `tax`). Emitir `S1` "porque es lo más común"
 * sería inventarse la calificación fiscal de un tercero.
 */
export function clasificarDetalleDesglose(
  entrada: { rate: number; base: number; cuota: number },
  ref?: string,
): DetalleDesglose {
  if (!Number.isFinite(entrada.rate) || entrada.rate <= 0) {
    throw new DesgloseNoClasificableError(
      `tramo de IVA al ${entrada.rate}% (base ${entrada.base.toFixed(2)}): no se puede saber si es ` +
        'sujeta al 0%, exenta (art. 20 LIVA) o no sujeta, y cada una declara una cosa distinta. ' +
        'El dato que las separa no está en las líneas de la factura. Se bloquea la emisión en vez ' +
        'de elegir un código: adivinarlo es declarar en falso.',
      ref,
    );
  }
  return {
    claveRegimen: CLAVE_REGIMEN_GENERAL,
    calificacion: CALIFICACION_SUJETA_NO_EXENTA,
    tipoImpositivo: String(entrada.rate),
    baseImponible: entrada.base.toFixed(2),
    cuotaRepercutida: entrada.cuota.toFixed(2),
  };
}

/**
 * ÚNICO constructor del bloque `DetalleDesglose` del proyecto (SCRUM-209).
 *
 * Antes había dos, y divergieron: el del servicio omitía `ClaveRegimen` y
 * `CalificacionOperacion`, así que el XML que se exportaba NO validaba (AEAT 1245 y 1195)
 * mientras el `.ps1` daba verde validando este de aquí, que no usaba nadie. Cualquier
 * generador de registros pasa por esta función o no pasa: hay un guard que lo vigila
 * (`tests/scrum209-un-solo-desglose.test.mjs`).
 *
 * UNA SOLA SALIDA POSIBLE. La primera versión aceptaba el prefijo como parámetro, porque
 * cada llamador declaraba el mismo namespace con otro alias (`sf:` aquí, `sum1:` en el
 * servicio). Eso era la misma enfermedad con otra cara: un constructor con dos salidas
 * posibles, y las dos en código de PRODUCCIÓN — no era una costura de test. Se fijó a
 * `sum1:`, que es el alias que ya usaba el camino en uso (la exportación ZIP), y este
 * fichero se alineó con él. Para la AEAT el alias es irrelevante —lo que identifica es el
 * namespace—, pero tener una sola forma de escribirlo es lo que impide volver a divergir.
 *
 * ORDEN DE ELEMENTOS = orden del XSD (sequence). Cambiarlo rompe la validación.
 */
export function buildDetallesDesgloseXml(detalles: DetalleDesglose[]): string {
  return detalles.map((d) => `
        <sum1:DetalleDesglose>
          <sum1:Impuesto>01</sum1:Impuesto>
          <sum1:ClaveRegimen>${esc(d.claveRegimen)}</sum1:ClaveRegimen>
          <sum1:CalificacionOperacion>${esc(d.calificacion)}</sum1:CalificacionOperacion>${d.tipoImpositivo ? `
          <sum1:TipoImpositivo>${esc(d.tipoImpositivo)}</sum1:TipoImpositivo>` : ''}
          <sum1:BaseImponibleOimporteNoSujeto>${esc(d.baseImponible)}</sum1:BaseImponibleOimporteNoSujeto>${d.cuotaRepercutida ? `
          <sum1:CuotaRepercutida>${esc(d.cuotaRepercutida)}</sum1:CuotaRepercutida>` : ''}
        </sum1:DetalleDesglose>`).join('');
}

export interface RegistroAltaParams {
  idEmisorFactura: string;      // NIF del obligado (merchant)
  numSerieFactura: string;      // serie+número (ej. 2026-CF-001)
  fechaExpedicion: string;      // dd-mm-aaaa
  nombreRazonEmisor: string;
  tipoFactura: 'F1' | 'F2' | 'R1';
  // Solo R1:
  rectifica?: { numSerieFactura: string; fechaExpedicion: string };
  tipoRectificativa?: 'S' | 'I'; // YaQu usa 'I' (incremental: líneas en negativo) [VALIDAR asesor S1-F]
  descripcionOperacion: string;  // TextMax500
  // F1 exige destinatario identificado (NIF u otro); sin NIF del cliente → F2 (simplificada).
  destinatario?: { nombreRazon: string; nif: string };
  desglose: DetalleDesglose[];
  cuotaTotal: string;
  importeTotal: string;
  encadenamiento: Encadenamiento;
  sistema: SistemaInformatico;
  fechaHoraHusoGenRegistro: string; // ISO 8601 con huso — EL MISMO valor usado en la huella
  huella: string;                   // SHA-256 (TipoHuella 01)
}

function xmlSistema(s: SistemaInformatico): string {
  return `<sum1:SistemaInformatico>
      <sum1:NombreRazon>${esc(s.nombreRazonProductor)}</sum1:NombreRazon>
      <sum1:NIF>${esc(s.nifProductor)}</sum1:NIF>
      <sum1:NombreSistemaInformatico>${esc(s.nombreSistema)}</sum1:NombreSistemaInformatico>
      <sum1:IdSistemaInformatico>${esc(s.idSistema)}</sum1:IdSistemaInformatico>
      <sum1:Version>${esc(s.version)}</sum1:Version>
      <sum1:NumeroInstalacion>${esc(s.numeroInstalacion)}</sum1:NumeroInstalacion>
      <sum1:TipoUsoPosibleSoloVerifactu>${s.soloVerifactu}</sum1:TipoUsoPosibleSoloVerifactu>
      <sum1:TipoUsoPosibleMultiOT>${s.multiOT}</sum1:TipoUsoPosibleMultiOT>
      <sum1:IndicadorMultiplesOT>${s.indicadorMultiplesOT}</sum1:IndicadorMultiplesOT>
    </sum1:SistemaInformatico>`;
}

function xmlEncadenamiento(e: Encadenamiento): string {
  if (e.primerRegistro || !e.anterior) {
    return `<sum1:Encadenamiento><sum1:PrimerRegistro>S</sum1:PrimerRegistro></sum1:Encadenamiento>`;
  }
  return `<sum1:Encadenamiento>
      <sum1:RegistroAnterior>
        <sum1:IDEmisorFactura>${esc(e.anterior.idEmisorFactura)}</sum1:IDEmisorFactura>
        <sum1:NumSerieFactura>${esc(e.anterior.numSerieFactura)}</sum1:NumSerieFactura>
        <sum1:FechaExpedicionFactura>${esc(e.anterior.fechaExpedicion)}</sum1:FechaExpedicionFactura>
        <sum1:Huella>${esc(e.anterior.huella)}</sum1:Huella>
      </sum1:RegistroAnterior>
    </sum1:Encadenamiento>`;
}

export function buildRegistroAlta(p: RegistroAltaParams): string {
  const rectificadas = p.tipoFactura === 'R1' && p.rectifica
    ? `<sum1:TipoRectificativa>${p.tipoRectificativa ?? 'I'}</sum1:TipoRectificativa>
    <sum1:FacturasRectificadas>
      <sum1:IDFacturaRectificada>
        <sum1:IDEmisorFactura>${esc(p.idEmisorFactura)}</sum1:IDEmisorFactura>
        <sum1:NumSerieFactura>${esc(p.rectifica.numSerieFactura)}</sum1:NumSerieFactura>
        <sum1:FechaExpedicionFactura>${esc(p.rectifica.fechaExpedicion)}</sum1:FechaExpedicionFactura>
      </sum1:IDFacturaRectificada>
    </sum1:FacturasRectificadas>`
    : '';

  const destinatarios = p.destinatario
    ? `<sum1:Destinatarios>
      <sum1:IDDestinatario>
        <sum1:NombreRazon>${esc(p.destinatario.nombreRazon)}</sum1:NombreRazon>
        <sum1:NIF>${esc(p.destinatario.nif)}</sum1:NIF>
      </sum1:IDDestinatario>
    </sum1:Destinatarios>`
    : '';

  // SCRUM-209: delega en el constructor ÚNICO. Antes tenía su propia copia de la plantilla,
  // y era la copia BUENA — la que divergió fue la del servicio. Pasar por aquí las dos es
  // lo que impide que vuelvan a separarse.
  const detalles = buildDetallesDesgloseXml(p.desglose);

  return `<sum1:RegistroAlta xmlns:sum1="${NS_SF}">
    <sum1:IDVersion>1.0</sum1:IDVersion>
    <sum1:IDFactura>
      <sum1:IDEmisorFactura>${esc(p.idEmisorFactura)}</sum1:IDEmisorFactura>
      <sum1:NumSerieFactura>${esc(p.numSerieFactura)}</sum1:NumSerieFactura>
      <sum1:FechaExpedicionFactura>${esc(p.fechaExpedicion)}</sum1:FechaExpedicionFactura>
    </sum1:IDFactura>
    <sum1:NombreRazonEmisor>${esc(p.nombreRazonEmisor)}</sum1:NombreRazonEmisor>
    <sum1:TipoFactura>${p.tipoFactura}</sum1:TipoFactura>
    ${rectificadas}
    <sum1:DescripcionOperacion>${esc(p.descripcionOperacion)}</sum1:DescripcionOperacion>
    ${destinatarios}
    <sum1:Desglose>
      ${detalles}
    </sum1:Desglose>
    <sum1:CuotaTotal>${esc(p.cuotaTotal)}</sum1:CuotaTotal>
    <sum1:ImporteTotal>${esc(p.importeTotal)}</sum1:ImporteTotal>
    ${xmlEncadenamiento(p.encadenamiento)}
    ${xmlSistema(p.sistema)}
    <sum1:FechaHoraHusoGenRegistro>${esc(p.fechaHoraHusoGenRegistro)}</sum1:FechaHoraHusoGenRegistro>
    <sum1:TipoHuella>01</sum1:TipoHuella>
    <sum1:Huella>${esc(p.huella)}</sum1:Huella>
  </sum1:RegistroAlta>`;
}

export interface RegistroAnulacionParams {
  idEmisorFacturaAnulada: string;
  numSerieFacturaAnulada: string;
  fechaExpedicionAnulada: string; // dd-mm-aaaa
  encadenamiento: Encadenamiento;
  sistema: SistemaInformatico;
  fechaHoraHusoGenRegistro: string;
  huella: string;
}

export function buildRegistroAnulacion(p: RegistroAnulacionParams): string {
  return `<sum1:RegistroAnulacion xmlns:sum1="${NS_SF}">
    <sum1:IDVersion>1.0</sum1:IDVersion>
    <sum1:IDFactura>
      <sum1:IDEmisorFacturaAnulada>${esc(p.idEmisorFacturaAnulada)}</sum1:IDEmisorFacturaAnulada>
      <sum1:NumSerieFacturaAnulada>${esc(p.numSerieFacturaAnulada)}</sum1:NumSerieFacturaAnulada>
      <sum1:FechaExpedicionFacturaAnulada>${esc(p.fechaExpedicionAnulada)}</sum1:FechaExpedicionFacturaAnulada>
    </sum1:IDFactura>
    ${xmlEncadenamiento(p.encadenamiento)}
    ${xmlSistema(p.sistema)}
    <sum1:FechaHoraHusoGenRegistro>${esc(p.fechaHoraHusoGenRegistro)}</sum1:FechaHoraHusoGenRegistro>
    <sum1:TipoHuella>01</sum1:TipoHuella>
    <sum1:Huella>${esc(p.huella)}</sum1:Huella>
  </sum1:RegistroAnulacion>`;
}

/** Envuelve registros en RegFactuSistemaFacturacion (cuerpo del SOAP de S1-D). */
export function buildRegFactuEnvelope(params: {
  obligado: { nombreRazon: string; nif: string };
  registrosXml: string[]; // salida de buildRegistroAlta/buildRegistroAnulacion (máx 1000)
}): string {
  if (params.registrosXml.length === 0 || params.registrosXml.length > 1000) {
    throw new Error('registros_fuera_de_rango'); // límite del servicio AEAT
  }
  const registros = params.registrosXml
    .map((r) => `  <sum:RegistroFactura>\n  ${r}\n  </sum:RegistroFactura>`)
    .join('\n');
  return `<sum:RegFactuSistemaFacturacion xmlns:sum="${NS_LR}" xmlns:sum1="${NS_SF}">
  <sum:Cabecera>
    <sum1:ObligadoEmision>
      <sum1:NombreRazon>${esc(params.obligado.nombreRazon)}</sum1:NombreRazon>
      <sum1:NIF>${esc(params.obligado.nif)}</sum1:NIF>
    </sum1:ObligadoEmision>
  </sum:Cabecera>
${registros}
</sum:RegFactuSistemaFacturacion>`;
}
