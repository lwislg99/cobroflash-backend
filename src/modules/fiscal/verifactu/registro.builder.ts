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
 * Una factura que NO se puede declarar con certeza. Quien construye el envío la EXCLUYE y la
 * REPORTA con su número y su motivo (SCRUM-209): ni se inventa el dato que falta, ni se tumba
 * el paquete entero por una factura.
 */
export class RegistroNoEmitibleError extends Error {
  constructor(public readonly motivo: string, public readonly ref?: string, codigo = 'verifactu_registro_no_emitible') {
    super(`${codigo}${ref ? `:${ref}` : ''} — ${motivo}`);
    this.name = new.target.name;
  }
}

/**
 * SCRUM-209 · Una línea que NO se puede calificar con certeza NO recibe un código por
 * defecto: se bloquea la emisión. Adivinar un régimen o una calificación es declarar en
 * falso ante la AEAT, y queda sellado en la huella (regla 29: solo se corrige con una R1).
 */
export class DesgloseNoClasificableError extends RegistroNoEmitibleError {
  constructor(motivo: string, ref?: string) {
    super(motivo, ref, 'verifactu_desglose_no_clasificable');
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-215 · LA FACTURA SIN DESTINATARIO IDENTIFICADO
//
// EL PROBLEMA, y por qué no es un borde: el XSD deja `Destinatarios` en `minOccurs="0"`, pero
// la AEAT rechaza con **1189** una F1/R1 que no lo lleve. Hoy el emisor lo omite en cuanto el
// cliente no tiene NIF — y en oficios el cliente sin NIF **es el caso normal**: un fontanero
// que arregla un baño a un particular no le pide el NIF. O sea que el rechazo no ocurre en un
// caso raro: ocurre en el flujo principal, en cada factura a un particular.
//
// EL ESQUEMA PREVÉ DOS SALIDAS, y son declaraciones DISTINTAS:
//
//   A · `FacturaSinIdentifDestinatarioArt61d = S` — sigue siendo una factura COMPLETA (F1);
//       se declara que el destinatario no está identificado al amparo del art. 61.d RIVA.
//   B · `FacturaSimplificadaArt7273 = S` con `TipoFactura = F2` — la factura ES simplificada
//       (arts. 7.2 y 7.3 del Reglamento). No es la misma factura con una marca: es otro
//       documento, con otro contenido obligatorio y con el techo de importe del art. 4.1
//       RD 1619/2012.
//
// 🚨 CUÁL PROCEDE LO DICE EL DICTAMEN P11, NO ESTE FICHERO. Elegir aquí sería exactamente lo
// que el proyecto se prohíbe: decidir una calificación fiscal en código. Por eso el mecanismo
// deja las DOS construidas y la elección en una constante marcada.
// ─────────────────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-216 · EL TIPO DE RECTIFICATIVA
//
// El emisor no ponía `TipoRectificativa` en NINGUNA R1 → error AEAT **1114** en cada una. Se
// omitió a propósito, con el criterio correcto («no inventar una calificación fiscal») aplicado
// al revés: **omitir un campo que el esquema exige no es abstenerse, es garantizar el rechazo.**
// La abstención de verdad es bloquear y pedir el dato.
//
// 🔴 Y AL MEDIRLO APARECE UNA CONTRADICCIÓN QUE HAY QUE RESOLVER ANTES DE ELEGIR:
//
//   · P12 del expediente dice que nuestras R1 «consignan el total corregido» → apuntaría a
//     **S (SUSTITUTIVA)**.
//   · El código hace otra cosa: `invoicesAdmin.routes.ts` crea la R1 con
//     `total: -original.total` y las líneas con el precio negado. Eso es el **delta**, no el
//     total corregido → es **I (INCREMENTAL)**.
//   · Y este mismo fichero lo dice desde S1-C: «YaQu usa 'I' (incremental: líneas en
//     negativo)», marcado `[VALIDAR asesor S1-F]` y nunca validado.
//
// Dos documentos y el código no dicen lo mismo. Se construyen las DOS salidas, y la que rige
// hoy la fija `MODO_TIPO_RECTIFICATIVA` (abajo): **`I`, por decisión del fundador del
// 30-jul-2026**, porque es la que coincide con lo que el documento realmente contiene. El modo
// `SIN_CONFIRMAR` se conserva —y tiene su test— para el caso de que haya que volver a bloquear.
//
// LA ELECCIÓN ARRASTRA MÁS QUE UN VALOR:
//   · `I` → `ImporteRectificacion` NO debe ir (AEAT 1119). Encaja con las R1 de hoy tal cual.
//   · `S` → `ImporteRectificacion` es OBLIGATORIO (AEAT 1118) con la base y cuota SUSTITUIDAS,
//     **y además la R1 tendría que consignar el total corregido en vez del negativo** — o sea,
//     habría que cambiar cómo se CREAN las rectificativas, no solo cómo se declaran.
// ─────────────────────────────────────────────────────────────────────────────────────────

export type ModoTipoRectificativa = 'SIN_CONFIRMAR' | 'INCREMENTAL_I' | 'SUSTITUTIVA_S';

/**
 * ✅ **`I` (INCREMENTAL) — decisión del FUNDADOR, 30-jul-2026.**
 *
 * Y conviene leer POR QUÉ, porque no es una elección de doctrina fiscal: **el producto ya emite
 * el DELTA**. `invoicesAdmin.routes.ts` crea la R1 con `total: -original.total` y las líneas
 * con el precio negado. Un documento cuyos importes SON la diferencia es, por definición, una
 * rectificativa **por diferencias** = `I`. No se está eligiendo entre S e I: se está haciendo
 * que la etiqueta coincida con lo que el documento ya contiene. Declararla `S` sería consignar
 * como «total corregido» un importe que es el delta — y eso queda sellado en la huella.
 *
 * ⚠️ **EL RATCHET SE QUEDA Y NO SE QUITA.** El máster reserva la confirmación al dictamen del
 * asesor (`docs/YAQU_MASTER.md:1328-1331`: *«qué `TipoRectificativa` (S/I) corresponde a
 * nuestras R1»*), y P12 del expediente sigue diciendo lo contrario que el código. Esto NO cierra
 * esa pregunta: la alinea con la realidad de hoy. El test del ratchet fija este valor para que
 * el día que llegue el dictamen alguien tenga que venir aquí a propósito.
 *
 * Si algún día se confirma `S`, no basta con cambiar esta constante: hay que cambiar **cómo se
 * CREAN** las R1 (que consignen el total corregido en vez del negativo) y añadir
 * `ImporteRectificacion` (AEAT 1118). Las dos salidas están construidas y probadas.
 */
export const MODO_TIPO_RECTIFICATIVA: ModoTipoRectificativa = 'INCREMENTAL_I';

/** Base y cuota SUSTITUIDAS — solo para rectificativas por sustitución (`DesgloseRectificacionType`). */
export interface ImporteRectificado {
  baseRectificada: string;
  cuotaRectificada: string;
}

export class TipoRectificativaSinConfirmarError extends RegistroNoEmitibleError {
  constructor(motivo: string, ref?: string) {
    super(motivo, ref, 'verifactu_tipo_rectificativa_sin_confirmar');
  }
}

/**
 * Resuelve el bloque de rectificación de una R1: el `TipoRectificativa` y, si procede, el
 * `ImporteRectificacion`. Los dos van en el orden del XSD — `TipoRectificativa` justo tras
 * `TipoFactura`, e `ImporteRectificacion` tras `FacturasRectificadas`.
 *
 * `importeRectificado` solo se usa en el modo sustitutiva; si falta, se bloquea en vez de
 * emitir una S sin el bloque que la AEAT exige (1118).
 */
export function resolverTipoRectificativa(
  ref?: string,
  importeRectificado?: ImporteRectificado | null,
  modo: ModoTipoRectificativa = MODO_TIPO_RECTIFICATIVA,
): { tipoXml: string; importeXml: string } {
  if (modo === 'SIN_CONFIRMAR') {
    throw new TipoRectificativaSinConfirmarError(
      'una rectificativa sin `TipoRectificativa` la rechaza la AEAT (error 1114), y el valor ' +
        'no se puede elegir en código: P12 del expediente dice que nuestras R1 consignan el ' +
        'total corregido (que sería S, sustitutiva), pero el código las crea con el total en ' +
        'NEGATIVO y las líneas negadas —el delta—, que es I (incremental); y registro.builder ' +
        'lo viene diciendo desde S1-C con un [VALIDAR] que nadie validó. Hasta que P12 se ' +
        'confirme CONTRA EL CÓDIGO, la rectificativa queda fuera del registro. La factura no ' +
        'está bloqueada: la R1 se emite y se entrega igual.',
      ref,
    );
  }

  if (modo === 'INCREMENTAL_I') {
    // 1119: si NO es por sustitución, `ImporteRectificacion` no debe llevar valor.
    return { tipoXml: `\n      <sum1:TipoRectificativa>I</sum1:TipoRectificativa>`, importeXml: '' };
  }

  // SUSTITUTIVA_S — 1118: el bloque es OBLIGATORIO.
  if (!importeRectificado) {
    throw new TipoRectificativaSinConfirmarError(
      'una rectificativa por SUSTITUCIÓN exige el bloque `ImporteRectificacion` con la base y ' +
        'la cuota sustituidas (AEAT 1118), y no se ha podido calcular a partir de la factura ' +
        'rectificada. Se bloquea en vez de emitir una S incompleta.',
      ref,
    );
  }
  return {
    tipoXml: `\n      <sum1:TipoRectificativa>S</sum1:TipoRectificativa>`,
    importeXml: `
      <sum1:ImporteRectificacion>
        <sum1:BaseRectificada>${esc(importeRectificado.baseRectificada)}</sum1:BaseRectificada>
        <sum1:CuotaRectificada>${esc(importeRectificado.cuotaRectificada)}</sum1:CuotaRectificada>
      </sum1:ImporteRectificacion>`,
  };
}

export type ModoSinDestinatario = 'SIN_DICTAMEN' | 'ART_61D' | 'SIMPLIFICADA_F2';

/**
 * ⏸️ SIN DICTAMEN. Mientras valga esto, una factura sin NIF del cliente **no entra en el
 * registro**: se excluye y se reporta (SCRUM-209). NO se bloquea nada del producto — la
 * factura se crea, se envía y se cobra igual; lo único que espera es su registro fiscal.
 *
 * Cambiar esta constante es aplicar el dictamen. No se toca sin él.
 */
export const MODO_SIN_DESTINATARIO: ModoSinDestinatario = 'SIN_DICTAMEN';

/** Se lanza mientras no haya dictamen: la factura se excluye del envío y se dice por qué. */
export class DestinatarioSinDictamenError extends RegistroNoEmitibleError {
  constructor(motivo: string, ref?: string) {
    super(motivo, ref, 'verifactu_destinatario_sin_dictamen');
  }
}

/**
 * Resuelve QUÉ se emite para una factura sin destinatario identificado.
 *
 * Devuelve el `TipoFactura` que corresponde y el fragmento XML del marcador, en el orden del
 * XSD (los dos campos van entre `DescripcionOperacion` y `Destinatarios`).
 *
 * `tipoOriginal` importa: bajo `SIMPLIFICADA_F2` solo una **F1** puede convertirse en F2. Una
 * rectificativa sin NIF sería una **R5** (rectificativa de simplificada), que el producto no
 * modela — así que no se resuelve, se excluye. Inventar el tipo de una rectificativa es la
 * misma clase de error que inventar la calificación del desglose.
 */
export function resolverSinDestinatario(
  tipoOriginal: 'F1' | 'R1',
  ref?: string,
  modo: ModoSinDestinatario = MODO_SIN_DESTINATARIO,
): { tipoFactura: 'F1' | 'F2' | 'R1'; marcadorXml: string } {
  if (modo === 'SIN_DICTAMEN') {
    throw new DestinatarioSinDictamenError(
      'la factura no tiene NIF del cliente y la AEAT rechaza una F1/R1 sin `Destinatarios` ' +
        '(error 1189). El esquema admite dos salidas —`FacturaSinIdentifDestinatarioArt61d` ' +
        '(factura completa, art. 61.d RIVA) o `FacturaSimplificadaArt7273` con TipoFactura F2 ' +
        '(arts. 7.2/7.3)— y son declaraciones distintas: cuál procede lo decide el dictamen ' +
        'P11, no el código. Hasta entonces la factura queda FUERA del registro, no se declara ' +
        'con un dato inventado. La factura en sí no está bloqueada: se emite, se envía y se ' +
        'cobra igual.',
      ref,
    );
  }

  if (modo === 'ART_61D') {
    return {
      tipoFactura: tipoOriginal,
      marcadorXml: `\n      <sum1:FacturaSinIdentifDestinatarioArt61d>S</sum1:FacturaSinIdentifDestinatarioArt61d>`,
    };
  }

  // SIMPLIFICADA_F2
  if (tipoOriginal !== 'F1') {
    throw new DestinatarioSinDictamenError(
      `una ${tipoOriginal} sin NIF del cliente no se puede emitir como simplificada: su tipo ` +
        'sería R5 (rectificativa de factura simplificada) y el producto no lo modela. Se ' +
        'excluye en vez de inventarle el tipo a una rectificativa.',
      ref,
    );
  }
  return {
    tipoFactura: 'F2',
    marcadorXml: `\n      <sum1:FacturaSimplificadaArt7273>S</sum1:FacturaSimplificadaArt7273>`,
  };
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
    // RESOLUCIÓN 209↔main, CRUZADA a propósito: la LÓGICA de main con el PREFIJO de 209.
    //   · `exigirTipoRectificativa(p)` (guard de SCRUM-216) sustituye al `?? 'I'`: un defecto
    //     ahí inventa una CALIFICACIÓN FISCAL que no ha decidido nadie (S vs I, dictamen P12)
    //     y la sella en una huella inmutable. El defecto ERA el defecto; el guard es el arreglo.
    //   · `sum1:` sustituye al `sf:`, y no por estética: este fichero declara `xmlns:sum1` en
    //     sus TRES raíces y NO declara `xmlns:sf` en ninguna, así que `sf:` salía SIN VINCULAR
    //     — XML mal formado, no solo inconsistente.
    ? `<sum1:TipoRectificativa>${exigirTipoRectificativa(p)}</sum1:TipoRectificativa>
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

/**
 * Máximo de `RegistroFactura` por envío que admite el XSD (`maxOccurs="1000"`).
 *
 * SCRUM-240: vive AQUÍ, con el constructor del sobre, y el servicio lo importa. Antes había
 * dos: un `MAX_REGISTROS = 1000` en el servicio y un `1000` literal en el sobre. Dos copias de
 * un número que el XSD fija son dos oportunidades de que solo se actualice una.
 */
export const MAX_REGISTROS_POR_ENVIO = 1000;

/**
 * SCRUM-240 · EL ÚNICO GENERADOR DEL CONTENIDO DEL SOBRE `RegFactuSistemaFacturacion`.
 *
 * ANTES HABÍA DOS, y la medición de la fase 1 es la que decidió unificarlos: sobre las mismas
 * entradas, el sobre del servicio (el que exporta el producto) y el de aquí producían
 * **el mismo contenido línea a línea**. Lo único que cambiaba era la DECLARACIÓN XML, la
 * SANGRÍA y el SALTO FINAL. Eso no son dos constructores: es uno con dos presentaciones,
 * escrito dos veces. Y escrito dos veces es una divergencia futura esperando su turno — que es
 * literalmente lo que pasó una capa más abajo entre S1-C y SCRUM-209, con el desglose.
 *
 * Por eso la presentación entra por parámetro y el contenido no se duplica:
 *   · `declaracionXml` — `<?xml …?>` delante. La exportación la lleva; el cuerpo SOAP NO puede
 *     llevarla (un cuerpo SOAP no admite declaración XML dentro).
 *   · `saltoFinal` — `\n` al final. La exportación acaba en salto; el cuerpo SOAP no.
 *   · `comentario` — se pega a la etiqueta de apertura. Hoy solo lo usa la exportación, para el
 *     parte de exclusiones de SCRUM-209/215/216.
 *
 * NO LLEVA LÍMITES NI DECIDE QUÉ HACER CON CERO REGISTROS a propósito: eso es política del
 * llamador, no del formato (ver `construirCuerpoSoapRegFactu` y el servicio de exportación).
 *
 * `registrosFacturaXml` llega YA envuelto en `<sum:RegistroFactura>`: el sobre no opina sobre
 * la sangría de lo que envuelve, solo lo une con saltos de línea.
 */
export function construirSobreRegFactu(params: {
  obligado: { nombreRazon: string; nif: string };
  registrosFacturaXml: string[];
  comentario?: string;
  declaracionXml?: boolean;
  saltoFinal?: boolean;
}): string {
  const declaracion = params.declaracionXml ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '';
  const fin = params.saltoFinal ? '\n' : '';
  return `${declaracion}<sum:RegFactuSistemaFacturacion xmlns:sum="${NS_LR}" xmlns:sum1="${NS_SF}">${params.comentario ?? ''}
  <sum:Cabecera>
    <sum1:ObligadoEmision>
      <sum1:NombreRazon>${esc(params.obligado.nombreRazon)}</sum1:NombreRazon>
      <sum1:NIF>${esc(params.obligado.nif)}</sum1:NIF>
    </sum1:ObligadoEmision>
  </sum:Cabecera>
${params.registrosFacturaXml.join('\n')}
</sum:RegFactuSistemaFacturacion>${fin}`;
}

/**
 * PRESENTACIÓN «CUERPO SOAP», para el envío a la AEAT de S1-D. Se llamaba
 * `buildRegFactuEnvelope`, que no decía de qué era el sobre; ahora dice lo que es.
 *
 * **HOY NO LA LLAMA NADIE EN PRODUCCIÓN** (medido en SCRUM-240: cero llamadores en `src/`; solo
 * su test y `scripts/gen-registros-sample.mjs`). Se conserva porque el envío SOAP de S1-D irá
 * por aquí, y **sin declaración XML porque un cuerpo SOAP no la admite** — esa ausencia no es
 * un descuido, es el motivo de que exista esta presentación.
 *
 * LOS CASOS LÍMITE SIGUEN AL DE PRODUCCIÓN, decisión del fundador en SCRUM-240 — antes esta
 * función lanzaba `registros_fuera_de_rango` en los dos casos, y eso era una tercera política
 * para el mismo hecho:
 *   · CERO registros → se devuelve `''`, como hace la exportación (SCRUM-216). Un sobre con la
 *     cabecera sola es XML INVÁLIDO (el XSD exige al menos un `RegistroFactura`), y entregar un
 *     fichero inválido es peor que no entregarlo.
 *   · MÁS DE 1000 → `verifactu_demasiados_registros:N`, el mismo error y el mismo texto que
 *     lanza la exportación, para que el día que S1-D trocee en varios envíos el motivo se lea
 *     igual en los dos caminos.
 */
export function construirCuerpoSoapRegFactu(params: {
  obligado: { nombreRazon: string; nif: string };
  registrosXml: string[]; // salida de buildRegistroAlta/buildRegistroAnulacion
}): string {
  if (params.registrosXml.length > MAX_REGISTROS_POR_ENVIO) {
    throw new Error(`verifactu_demasiados_registros:${params.registrosXml.length}`);
  }
  if (params.registrosXml.length === 0) return '';
  return construirSobreRegFactu({
    obligado: params.obligado,
    registrosFacturaXml: params.registrosXml.map(
      (r) => `  <sum:RegistroFactura>\n  ${r}\n  </sum:RegistroFactura>`,
    ),
  });
}
