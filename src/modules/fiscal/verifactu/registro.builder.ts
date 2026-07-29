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
  // Régimen general IVA: claveRegimen '01', calificacion 'S1' (sujeta no exenta)
  claveRegimen?: string;        // IdOperacionesTrascendenciaTributariaType
  calificacion: string;         // CalificacionOperacionType: S1 | S2 | N1 | N2
  tipoImpositivo?: string;      // ej. '21'
  baseImponible: string;        // ImporteSgn12.2 (punto decimal, 2 dec)
  cuotaRepercutida?: string;
}

export interface RegistroAltaParams {
  idEmisorFactura: string;      // NIF del obligado (merchant)
  numSerieFactura: string;      // serie+número (ej. 2026-CF-001)
  fechaExpedicion: string;      // dd-mm-aaaa
  nombreRazonEmisor: string;
  tipoFactura: 'F1' | 'F2' | 'R1';
  // Solo R1:
  rectifica?: { numSerieFactura: string; fechaExpedicion: string };
  // OBLIGATORIO cuando `tipoFactura === 'R1'` y hay `rectifica`. Opcional en el tipo porque solo
  // aplica a rectificativas; su ausencia en ese caso NO se suple con un defecto — se bloquea.
  // Ver `exigirTipoRectificativa` más abajo (SCRUM-216).
  tipoRectificativa?: 'S' | 'I';
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
  return `<sf:SistemaInformatico>
      <sf:NombreRazon>${esc(s.nombreRazonProductor)}</sf:NombreRazon>
      <sf:NIF>${esc(s.nifProductor)}</sf:NIF>
      <sf:NombreSistemaInformatico>${esc(s.nombreSistema)}</sf:NombreSistemaInformatico>
      <sf:IdSistemaInformatico>${esc(s.idSistema)}</sf:IdSistemaInformatico>
      <sf:Version>${esc(s.version)}</sf:Version>
      <sf:NumeroInstalacion>${esc(s.numeroInstalacion)}</sf:NumeroInstalacion>
      <sf:TipoUsoPosibleSoloVerifactu>${s.soloVerifactu}</sf:TipoUsoPosibleSoloVerifactu>
      <sf:TipoUsoPosibleMultiOT>${s.multiOT}</sf:TipoUsoPosibleMultiOT>
      <sf:IndicadorMultiplesOT>${s.indicadorMultiplesOT}</sf:IndicadorMultiplesOT>
    </sf:SistemaInformatico>`;
}

function xmlEncadenamiento(e: Encadenamiento): string {
  if (e.primerRegistro || !e.anterior) {
    return `<sf:Encadenamiento><sf:PrimerRegistro>S</sf:PrimerRegistro></sf:Encadenamiento>`;
  }
  return `<sf:Encadenamiento>
      <sf:RegistroAnterior>
        <sf:IDEmisorFactura>${esc(e.anterior.idEmisorFactura)}</sf:IDEmisorFactura>
        <sf:NumSerieFactura>${esc(e.anterior.numSerieFactura)}</sf:NumSerieFactura>
        <sf:FechaExpedicionFactura>${esc(e.anterior.fechaExpedicion)}</sf:FechaExpedicionFactura>
        <sf:Huella>${esc(e.anterior.huella)}</sf:Huella>
      </sf:RegistroAnterior>
    </sf:Encadenamiento>`;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-216 (ampliación) · EL TIPO DE UNA RECTIFICATIVA NO TIENE VALOR POR DEFECTO
//
// Aquí había `p.tipoRectificativa ?? 'I'`. Parecía inofensivo porque a este constructor no lo
// llama producción (solo un test y `scripts/gen-registros-sample.mjs`), pero era la peor de las
// dos salidas malas:
//
//   · OMITIR el campo garantiza el RECHAZO (AEAT **1114**) — y un rechazo SE VE.
//   · Un DEFECTO cableado INVENTA la calificación fiscal, la declaración se ACEPTA, y queda
//     SELLADA EN LA HUELLA (regla 29: ya no se edita ni se borra, solo se corrige con otra
//     rectificativa). Una declaración incorrecta aceptada no se ve nunca.
//
// Y el valor no es una tecnicidad: `S` (sustitución) e `I` (diferencias) declaran hechos
// distintos y arrastran `ImporteRectificacion` en sentidos opuestos (1118 lo exige para S,
// 1119 lo prohíbe para el resto). Cuál procede es el dictamen P12 del expediente, que además
// hoy está en contradicción con el código: nuestras R1 se crean negando la original —el
// delta, que apuntaría a I—, mientras el expediente afirmaba lo contrario.
//
// Así que este constructor no elige: EXIGE el valor y, si no lo tiene, BLOQUEA.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Se lanza si una rectificativa llega sin `TipoRectificativa`: no se inventa, se para. */
export class TipoRectificativaAusenteError extends Error {
  constructor(public readonly ref?: string) {
    super(
      `verifactu_tipo_rectificativa_ausente${ref ? `:${ref}` : ''} — una rectificativa exige ` +
        '`TipoRectificativa` (AEAT 1114) y su valor NO se suple con un defecto: elegir entre ' +
        'S (sustitución) e I (diferencias) es una calificación fiscal, y una vez declarada ' +
        'queda sellada en la huella. Pásalo explícitamente o no construyas el registro.',
    );
    this.name = 'TipoRectificativaAusenteError';
  }
}

function exigirTipoRectificativa(p: RegistroAltaParams): 'S' | 'I' {
  if (!p.tipoRectificativa) throw new TipoRectificativaAusenteError(p.numSerieFactura);
  return p.tipoRectificativa;
}

export function buildRegistroAlta(p: RegistroAltaParams): string {
  const rectificadas = p.tipoFactura === 'R1' && p.rectifica
    ? `<sf:TipoRectificativa>${exigirTipoRectificativa(p)}</sf:TipoRectificativa>
    <sf:FacturasRectificadas>
      <sf:IDFacturaRectificada>
        <sf:IDEmisorFactura>${esc(p.idEmisorFactura)}</sf:IDEmisorFactura>
        <sf:NumSerieFactura>${esc(p.rectifica.numSerieFactura)}</sf:NumSerieFactura>
        <sf:FechaExpedicionFactura>${esc(p.rectifica.fechaExpedicion)}</sf:FechaExpedicionFactura>
      </sf:IDFacturaRectificada>
    </sf:FacturasRectificadas>`
    : '';

  const destinatarios = p.destinatario
    ? `<sf:Destinatarios>
      <sf:IDDestinatario>
        <sf:NombreRazon>${esc(p.destinatario.nombreRazon)}</sf:NombreRazon>
        <sf:NIF>${esc(p.destinatario.nif)}</sf:NIF>
      </sf:IDDestinatario>
    </sf:Destinatarios>`
    : '';

  const detalles = p.desglose.map((d) => `<sf:DetalleDesglose>
        ${d.claveRegimen ? `<sf:Impuesto>01</sf:Impuesto><sf:ClaveRegimen>${esc(d.claveRegimen)}</sf:ClaveRegimen>` : ''}
        <sf:CalificacionOperacion>${esc(d.calificacion)}</sf:CalificacionOperacion>
        ${d.tipoImpositivo ? `<sf:TipoImpositivo>${esc(d.tipoImpositivo)}</sf:TipoImpositivo>` : ''}
        <sf:BaseImponibleOimporteNoSujeto>${esc(d.baseImponible)}</sf:BaseImponibleOimporteNoSujeto>
        ${d.cuotaRepercutida ? `<sf:CuotaRepercutida>${esc(d.cuotaRepercutida)}</sf:CuotaRepercutida>` : ''}
      </sf:DetalleDesglose>`).join('\n      ');

  return `<sf:RegistroAlta xmlns:sf="${NS_SF}">
    <sf:IDVersion>1.0</sf:IDVersion>
    <sf:IDFactura>
      <sf:IDEmisorFactura>${esc(p.idEmisorFactura)}</sf:IDEmisorFactura>
      <sf:NumSerieFactura>${esc(p.numSerieFactura)}</sf:NumSerieFactura>
      <sf:FechaExpedicionFactura>${esc(p.fechaExpedicion)}</sf:FechaExpedicionFactura>
    </sf:IDFactura>
    <sf:NombreRazonEmisor>${esc(p.nombreRazonEmisor)}</sf:NombreRazonEmisor>
    <sf:TipoFactura>${p.tipoFactura}</sf:TipoFactura>
    ${rectificadas}
    <sf:DescripcionOperacion>${esc(p.descripcionOperacion)}</sf:DescripcionOperacion>
    ${destinatarios}
    <sf:Desglose>
      ${detalles}
    </sf:Desglose>
    <sf:CuotaTotal>${esc(p.cuotaTotal)}</sf:CuotaTotal>
    <sf:ImporteTotal>${esc(p.importeTotal)}</sf:ImporteTotal>
    ${xmlEncadenamiento(p.encadenamiento)}
    ${xmlSistema(p.sistema)}
    <sf:FechaHoraHusoGenRegistro>${esc(p.fechaHoraHusoGenRegistro)}</sf:FechaHoraHusoGenRegistro>
    <sf:TipoHuella>01</sf:TipoHuella>
    <sf:Huella>${esc(p.huella)}</sf:Huella>
  </sf:RegistroAlta>`;
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
  return `<sf:RegistroAnulacion xmlns:sf="${NS_SF}">
    <sf:IDVersion>1.0</sf:IDVersion>
    <sf:IDFactura>
      <sf:IDEmisorFacturaAnulada>${esc(p.idEmisorFacturaAnulada)}</sf:IDEmisorFacturaAnulada>
      <sf:NumSerieFacturaAnulada>${esc(p.numSerieFacturaAnulada)}</sf:NumSerieFacturaAnulada>
      <sf:FechaExpedicionFacturaAnulada>${esc(p.fechaExpedicionAnulada)}</sf:FechaExpedicionFacturaAnulada>
    </sf:IDFactura>
    ${xmlEncadenamiento(p.encadenamiento)}
    ${xmlSistema(p.sistema)}
    <sf:FechaHoraHusoGenRegistro>${esc(p.fechaHoraHusoGenRegistro)}</sf:FechaHoraHusoGenRegistro>
    <sf:TipoHuella>01</sf:TipoHuella>
    <sf:Huella>${esc(p.huella)}</sf:Huella>
  </sf:RegistroAnulacion>`;
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
    .map((r) => `  <sfLR:RegistroFactura>\n  ${r}\n  </sfLR:RegistroFactura>`)
    .join('\n');
  return `<sfLR:RegFactuSistemaFacturacion xmlns:sfLR="${NS_LR}" xmlns:sf="${NS_SF}">
  <sfLR:Cabecera>
    <sf:ObligadoEmision>
      <sf:NombreRazon>${esc(params.obligado.nombreRazon)}</sf:NombreRazon>
      <sf:NIF>${esc(params.obligado.nif)}</sf:NIF>
    </sf:ObligadoEmision>
  </sfLR:Cabecera>
${registros}
</sfLR:RegFactuSistemaFacturacion>`;
}
