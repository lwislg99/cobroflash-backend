// src/modules/jobs/domain/albaran.service.ts — SCRUM-14 (ALBARAN-1)
// Dominio del albarán / parte de trabajo (documento NO FISCAL, Parte L del master):
// transiciones borrador→emitido→firmado, validación del shape de lineas (condición 4
// del OK del fundador), serialización y regeneración del PDF bajo demanda (el disco
// de Railway es efímero — mismo patrón que ensureInvoicePdf).
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../../../core/db/prisma';
import { albaranesDir } from '../../../core/storage/dirs';
import { generateAlbaranPdf } from '../infra/albaranPdf.service';

export const ALBARAN_ESTADOS = ['borrador', 'emitido', 'firmado'] as const;
export type AlbaranEstado = (typeof ALBARAN_ESTADOS)[number];

// SCRUM-65: SIN_VALORAR (hoy, sin precios) | VALORADO (líneas con precio+IVA).
// El albarán VALORADO sigue SIN validez fiscal (docs/legal/INVESTIGACION_ALBARANES.md
// §1.3): no devenga IVA, no sustituye a la factura. Editable solo en 'borrador'.
export const ALBARAN_MODOS_VALORACION = ['SIN_VALORAR', 'VALORADO'] as const;
export type AlbaranModoValoracion = (typeof ALBARAN_MODOS_VALORACION)[number];

// Parte L: borrador → emitido → firmado. Firmar exige emitido (la UI no ofrece
// firmar un borrador); firmado es TERMINAL y congela el documento.
export function canTransitionAlbaran(from: string, to: string): boolean {
  if (from === 'borrador' && to === 'emitido') return true;
  if (from === 'emitido' && to === 'firmado') return true;
  return false;
}

export interface AlbaranLinea {
  concepto: string;
  cantidad: number;
  unidad: string;
  // SCRUM-65: solo presentes en modo VALORADO (undefined/null en SIN_VALORAR).
  // precioUnitario en la MISMA unidad decimal que Quote.lines[].price (no céntimos).
  // tipoIva en TANTO POR CIENTO entero (21/10/4/0) — distinto de Quote.lines[].tax,
  // que es la fracción 0.21 (convención propia del albarán, fijada en el brief).
  precioUnitario?: number;
  tipoIva?: number;
}

/**
 * Valida el shape de `lineas` (condición 4 del OK original + SCRUM-65): array de
 * {concepto: string no vacío, cantidad: number > 0, unidad: string} + en modo
 * VALORADO exige precioUnitario/tipoIva en TODAS las líneas; en SIN_VALORAR los
 * rechaza si llegan. Devuelve la lista normalizada (trim) o un mensaje de error humano.
 */
export function validarLineas(
  input: unknown,
  modoValoracion: AlbaranModoValoracion = 'SIN_VALORAR',
): { ok: true; lineas: AlbaranLinea[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'lineas debe ser un array' };
  if (input.length > 200) return { ok: false, error: 'máximo 200 líneas por albarán' };
  const valorado = modoValoracion === 'VALORADO';
  const out: AlbaranLinea[] = [];
  for (let i = 0; i < input.length; i++) {
    const l = input[i] as any;
    const concepto = typeof l?.concepto === 'string' ? l.concepto.trim() : '';
    const cantidad = Number(l?.cantidad);
    const unidad = typeof l?.unidad === 'string' ? l.unidad.trim() : null;
    if (!concepto) return { ok: false, error: `línea ${i + 1}: concepto vacío` };
    if (concepto.length > 300) return { ok: false, error: `línea ${i + 1}: concepto demasiado largo (máx. 300)` };
    if (!Number.isFinite(cantidad) || cantidad <= 0) return { ok: false, error: `línea ${i + 1}: cantidad debe ser un número > 0` };
    if (cantidad > 1_000_000) return { ok: false, error: `línea ${i + 1}: cantidad fuera de rango` };
    if (unidad === null) return { ok: false, error: `línea ${i + 1}: unidad debe ser texto (ud, m, m², h…)` };
    if (unidad.length > 40) return { ok: false, error: `línea ${i + 1}: unidad demasiado larga (máx. 40)` };

    const tienePrecio = l?.precioUnitario !== undefined && l?.precioUnitario !== null && l?.precioUnitario !== '';
    const tieneIva = l?.tipoIva !== undefined && l?.tipoIva !== null && l?.tipoIva !== '';
    const linea: AlbaranLinea = { concepto, cantidad, unidad };

    if (!valorado) {
      if (tienePrecio || tieneIva) {
        return { ok: false, error: `línea ${i + 1}: este albarán es SIN_VALORAR — no puede llevar precio ni IVA` };
      }
    } else {
      if (!tienePrecio) return { ok: false, error: `línea ${i + 1}: falta el precio unitario (albarán valorado)` };
      if (!tieneIva) return { ok: false, error: `línea ${i + 1}: falta el tipo de IVA (albarán valorado)` };
      const precioUnitario = Number(l.precioUnitario);
      const tipoIva = Number(l.tipoIva);
      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
        return { ok: false, error: `línea ${i + 1}: el precio unitario debe ser un número ≥ 0` };
      }
      if (precioUnitario > 1_000_000) return { ok: false, error: `línea ${i + 1}: precio unitario fuera de rango` };
      if (!Number.isFinite(tipoIva) || tipoIva < 0 || tipoIva > 100) {
        return { ok: false, error: `línea ${i + 1}: el tipo de IVA debe ser un número entre 0 y 100` };
      }
      linea.precioUnitario = precioUnitario;
      linea.tipoIva = tipoIva;
    }
    out.push(linea);
  }
  return { ok: true, lineas: out };
}

/**
 * Totales orientativos del albarán VALORADO — SCRUM-65. Aritmética en ENTEROS DE
 * CÉNTIMOS (regla de la casa): se redondea una vez por línea (importe = precio×cantidad,
 * cuota = importe×IVA%) y se suman céntimos, nunca floats acumulados. Sin desglose por
 * tipo de IVA (a propósito: un albarán valorado NO simula el desglose de una factura).
 */
export function calcAlbaranTotales(lineas: AlbaranLinea[] | null | undefined): {
  baseCents: number;
  cuotaCents: number;
  totalCents: number;
  base: number;
  cuota: number;
  total: number;
} {
  let baseCents = 0;
  let cuotaCents = 0;
  for (const l of Array.isArray(lineas) ? lineas : []) {
    if (l.precioUnitario === undefined || l.precioUnitario === null) continue; // SIN_VALORAR o línea sin precio
    const lineaBaseCents = Math.round(Number(l.precioUnitario) * Number(l.cantidad) * 100);
    const lineaCuotaCents = Math.round(lineaBaseCents * (Number(l.tipoIva || 0) / 100));
    baseCents += lineaBaseCents;
    cuotaCents += lineaCuotaCents;
  }
  const totalCents = baseCents + cuotaCents;
  return {
    baseCents, cuotaCents, totalCents,
    base: baseCents / 100, cuota: cuotaCents / 100, total: totalCents / 100,
  };
}

// ─── SCRUM-17 (FISCAL-2): consolidación en factura recapitulativa (motor de rotura) ─────
// Art. 13 RD 1619/2012: la recapitulativa solo agrupa operaciones del MISMO mes natural. La
// selección que cruza meses NO se rechaza → se parte en N grupos (una factura por mes). Puro y
// testeable sin BD (patrón validarLineas/billingPlan). `tipoIva` NO entra en la clave de rotura
// (decisión fundador 22-jul: una factura admite desglose multi-IVA y el builder lo calcula de lines).

// Shape mínimo que necesitan las funciones puras (el llamador resuelve customerId vía Job.customerId).
export interface AlbaranConsolidable {
  id: number;
  numero: string;
  fecha: Date | string;
  estado: string;
  modoValoracion: string;
  invoiceId: number | null;
  customerId: number;
  /**
   * SCRUM-170: ¿tiene ya alguna cantidad facturada por la vía PARCIAL? Es opcional para no
   * romper a los llamadores de siempre, pero el que emite TIENE que rellenarlo: un albarán a
   * medias no lleva `invoiceId` (ese campo marca el albarán entero), así que sin este dato la
   * consolidación se lo tragaría y facturaría dos veces lo mismo.
   */
  facturadoParcial?: boolean;
}

/**
 * Valida que una selección de albaranes puede consolidarse. NO valida el mes natural (eso es
 * rotura, no error). Mensaje humano con el albarán exacto (patrón validarLineas). `job` aporta
 * tipoOperacion (SCRUM-66): un TRABAJO_UNICO nunca ofrece recapitulativa.
 */
export function validarConsolidacion(
  albaranes: AlbaranConsolidable[],
  job: { tipoOperacion?: string | null; customerId: number },
): { ok: true } | { ok: false; error: string; message: string } {
  if (!Array.isArray(albaranes) || albaranes.length === 0) {
    return { ok: false, error: 'seleccion_vacia', message: 'Selecciona al menos un parte de trabajo firmado.' };
  }
  if (job.tipoOperacion === 'TRABAJO_UNICO') {
    return { ok: false, error: 'consolidacion_no_aplica', message: 'Este Trabajo es una obra única: se factura al concluir, no se agrupan partes por mes.' };
  }
  for (const a of albaranes) {
    if (a.estado !== 'firmado') {
      return { ok: false, error: 'albaran_no_firmado', message: `El parte ${a.numero} no está firmado. Solo se consolidan partes firmados.` };
    }
    if (a.modoValoracion !== 'VALORADO') {
      return { ok: false, error: 'albaran_sin_precios', message: `El parte ${a.numero} no lleva precios. Edítalo para añadirlos o quítalo de la selección.` };
    }
    if (a.invoiceId != null) {
      return { ok: false, error: 'albaran_ya_facturado', message: `El parte ${a.numero} ya está facturado.` };
    }
    // SCRUM-170: y el que está a MEDIAS tampoco entra. Consolidar es facturar el albarán
    // entero; si ya se facturó parte de sus líneas, esta vía cobraría otra vez lo mismo — y
    // una factura emitida no se borra (regla 29). Lo pendiente se factura por su ruta parcial.
    if (a.facturadoParcial) {
      return { ok: false, error: 'albaran_facturado_parcial', message: `El parte ${a.numero} ya tiene líneas facturadas: factura lo que queda desde el propio parte.` };
    }
    if (a.customerId !== job.customerId) {
      return { ok: false, error: 'cliente_mixto', message: `El parte ${a.numero} es de otro cliente.` };
    }
  }
  return { ok: true };
}

/** Clave de mes natural (YYYY-MM) de una fecha — la rotura del art. 13. */
export function mesNaturalKey(fecha: Date | string): string {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** Etiqueta legible del mes natural ("marzo 2026") para el modal de confirmación. */
export function mesNaturalLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MESES_ES[(m || 1) - 1]} ${y}`;
}

export interface RoturaGrupo {
  mesKey: string;   // "2026-03"
  mesLabel: string; // "marzo 2026"
  albaranes: AlbaranConsolidable[];
}

/**
 * Motor de ROTURA: agrupa por mes natural de `fecha` (cliente y serie ya son únicos por
 * validación/diseño: 1 Job = 1 cliente, serie ALB única por merchant). Grupos ORDENADOS por
 * mes ascendente → 1 mes = 1 factura, N meses = N facturas. tipoIva NO rompe (decisión 22-jul).
 */
export function groupByRotura(albaranes: AlbaranConsolidable[]): RoturaGrupo[] {
  const map = new Map<string, AlbaranConsolidable[]>();
  for (const a of albaranes) {
    const key = mesNaturalKey(a.fecha);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return [...map.keys()].sort().map((mesKey) => ({
    mesKey,
    mesLabel: mesNaturalLabel(mesKey),
    albaranes: map.get(mesKey)!,
  }));
}

// ─── SCRUM-68 (ALBARAN-6): evidencias probatorias de la firma ───────────────────────
// Al firmar (remoto o in situ) sellamos QUIÉN, CUÁNDO, DESDE DÓNDE y sobre QUÉ contenido.
// ⚠️ PRIVACIDAD: `ip`/`ua` son datos personales → viven SOLO en Albaran.evidenciaFirma.
// NUNCA se exponen: ni en serializeAlbaran, ni en el PDF, ni en el HTML público, ni en la API.
export interface FirmaEvidencia {
  v: number;
  canal: 'remoto' | 'in_situ';
  firmadoAt: string;          // ISO 8601, reloj del servidor (no del cliente)
  ip: string | null;          // ⚠️ NO exponer
  ua: string | null;          // ⚠️ NO exponer (user-agent, truncado)
  tokenId: string | null;     // firmaToken usado (canal remoto); null in situ
  firmante: string;           // nombre declarado del firmante (= cliente del albarán)
  hashAlg: 'sha256';
  contentHash: string;        // SHA-256 del CONTENIDO canónico (NO del PDF, §1.3 del brief)
  // SCRUM-300 (v:2): quién firmó y en calidad de qué. AUSENTES en las evidencias v:1, que
  // siguen siendo válidas tal cual — por eso son opcionales y NUNCA se rellenan a posteriori.
  firmadoPorNombre?: string | null;
  firmadoPorCalidad?: string | null;
}

/**
 * SCRUM-300: versión del CONTENIDO canónico que se sella HOY. Subió de 1 a 2 porque el campo
 * `obra` CAMBIÓ DE FUENTE — no porque se añadan campos. Hasta ahora `obra` salía de
 * `Job.direccion`, que nadie escribe (su único escritor en el árbol es un script de demo), así
 * que el sello llevaba meses guardando el lugar de obra VACÍO. Pasarlo a `Albaran.lugarEntrega`
 * cambia lo que significa un campo ya sellado, y eso exige versión nueva: sin ella, dos hashes
 * calculados con reglas distintas serían indistinguibles.
 */
export const ALBARAN_CONTENIDO_VERSION_ACTUAL = 2;

export interface AlbaranContenidoParams {
  numero: string;
  fecha: Date | string;
  modoValoracion: string;
  lineas: AlbaranLinea[];
  notas: string | null;
  obra: string | null;
  referenciaTrabajo: string | null;
  cliente: string | null;
  emisor: string | null;
  emisorNif: string | null;
  // Solo v:2. En v:1 se ignoran (el objeto canónico de v:1 no los tiene, y no puede tenerlos).
  firmadoPorNombre?: string | null;
  firmadoPorCalidad?: string | null;
}

/** Las líneas, en su forma canónica. Idéntica en v:1 y v:2 — no ha cambiado. */
function lineasCanonicas(lineas: AlbaranLinea[]) {
  return (Array.isArray(lineas) ? lineas : []).map((l) => ({
    concepto: l.concepto,
    cantidad: l.cantidad,
    unidad: l.unidad ?? null,
    precioUnitario: l.precioUnitario ?? null,
    tipoIva: l.tipoIva ?? null,
  }));
}

/**
 * El objeto canónico de cada versión, CADA UNO ESCRITO ENTERO Y APARTE.
 *
 * ┌─ SI HAS VENIDO A DEDUPLICAR ESTO, LEE ESTO PRIMERO ────────────────────────────────────┐
 * │                                                                                        │
 * │ Las dos ramas repiten nueve claves y parece un objeto base con dos spreads esperando a  │
 * │ que alguien lo extraiga. NO LO ES, y el motivo no se ve en el diff:                     │
 * │                                                                                        │
 * │ `JSON.stringify` serializa las claves EN SU ORDEN DE INSERCIÓN. Un helper compartido    │
 * │ ata el orden de v:1 al de v:2, así que el día que alguien añada un campo a v:2 —o       │
 * │ reordene los del helper— el hash de **v:1** cambiaría. Y no lo notaría nadie: los       │
 * │ albaranes v:1 ya firmados no se vuelven a sellar, así que no hay nada que se rompa en   │
 * │ el momento. Lo que se rompe es DESPUÉS, cuando alguien intente verificar uno y le       │
 * │ salga «no coincide» sobre un documento intacto — o sea, una acusación de falsificación  │
 * │ contra un papel que nadie tocó.                                                         │
 * │                                                                                        │
 * │ El hash de v:1 tiene que poder recalcularse IGUAL dentro de diez años para verificar    │
 * │ un albarán firmado hoy. Diez líneas duplicadas son el precio de que romperlo sea        │
 * │ IMPOSIBLE en vez de estar vigilado. Regla: **una versión cerrada no se refactoriza.**   │
 * │                                                                                        │
 * │ (`tests/scrum300-albaran-firmado-por.test.mjs` verifica un v:1 contra su hash de        │
 * │ entonces. Si tocas esto, ese test es el que te lo dirá.)                                │
 * └────────────────────────────────────────────────────────────────────────────────────────┘
 */
function contenidoCanonico(params: AlbaranContenidoParams, version: number): unknown {
  const fecha = params.fecha instanceof Date ? params.fecha.toISOString() : String(params.fecha);

  if (version === 1) {
    return {
      v: 1,
      numero: params.numero,
      fecha,
      modoValoracion: params.modoValoracion,
      obra: params.obra ?? null,
      referenciaTrabajo: params.referenciaTrabajo ?? null,
      cliente: params.cliente ?? null,
      emisor: params.emisor ?? null,
      emisorNif: params.emisorNif ?? null,
      notas: params.notas ?? null,
      lineas: lineasCanonicas(params.lineas),
    };
  }

  if (version === 2) {
    return {
      v: 2,
      numero: params.numero,
      fecha,
      modoValoracion: params.modoValoracion,
      obra: params.obra ?? null,
      referenciaTrabajo: params.referenciaTrabajo ?? null,
      cliente: params.cliente ?? null,
      emisor: params.emisor ?? null,
      emisorNif: params.emisorNif ?? null,
      notas: params.notas ?? null,
      lineas: lineasCanonicas(params.lineas),
      firmadoPorNombre: params.firmadoPorNombre ?? null,
      firmadoPorCalidad: params.firmadoPorCalidad ?? null,
    };
  }

  // Una versión que no conocemos NO se aproxima con la más parecida: se dice. Un verificador
  // que «hace lo que puede» con una versión futura devolvería «no coincide» sobre un documento
  // intacto, y eso se lee como una falsificación que no ha ocurrido.
  throw new Error(`albaran_contenido_version_desconocida:${version}`);
}

/**
 * SHA-256 del CONTENIDO canónico del albarán — NO del binario del PDF (§1.3): lo que se
 * firma es el contenido (número, fecha, líneas, partes, notas), no una representación.
 * Serialización determinista (claves fijas, `null` explícito) → el mismo contenido produce
 * SIEMPRE el mismo hash y cualquier alteración posterior lo cambia (prueba de integridad).
 *
 * `version` por defecto = la ACTUAL, que es lo correcto al SELLAR. Para VERIFICAR una evidencia
 * ya guardada NO se usa el defecto: se pasa la versión leída del dato (ver `recomputarHashDeEvidencia`).
 */
export function computeAlbaranContentHash(
  params: AlbaranContenidoParams,
  version: number = ALBARAN_CONTENIDO_VERSION_ACTUAL,
): string {
  return crypto.createHash('sha256').update(JSON.stringify(contenidoCanonico(params, version)), 'utf8').digest('hex');
}

/**
 * SCRUM-300: de dónde sale el campo `obra` SEGÚN LA VERSIÓN del sello.
 *
 * v:1 lo tomaba de `Job.direccion`; v:2 lo toma de `Albaran.lugarEntrega`. Verificar —o imprimir—
 * un documento v:1 con la regla de v:2 daría «no coincide» sobre un albarán intacto. La versión
 * se LEE del dato; nunca se supone.
 *
 * `version` null/undefined = albarán SIN FIRMAR todavía → manda el campo de hoy.
 */
export function obraSegunVersion(
  version: number | null | undefined,
  fuentes: { lugarEntrega: string | null; jobDireccion: string | null },
): string | null {
  if (version === 1) return fuentes.jobDireccion || null;
  return fuentes.lugarEntrega || null;
}

/**
 * Recalcula el hash de una evidencia YA GUARDADA para VERIFICARLA. No la reescribe: recalcular y
 * volver a guardar el sello de un documento firmado es falsificarlo aunque el resultado coincida
 * (regla 29). Esto solo compara.
 *
 * La versión sale de `evidencia.v` — un lector que diera por hecho v:2 rompería en silencio todos
 * los v:1, que es exactamente el fallo que este parámetro existe para evitar.
 */
export function recomputarHashDeEvidencia(params: {
  evidencia: Pick<FirmaEvidencia, 'v'> & Partial<FirmaEvidencia>;
  albaran: { numero: string; fecha: Date | string; modoValoracion: string; lineas: unknown; notas: string | null; lugarEntrega: string | null };
  jobDireccion: string | null;
  referenciaTrabajo: string | null;
  cliente: string | null;
  emisor: string | null;
  emisorNif: string | null;
}): string {
  const { evidencia: ev, albaran: a } = params;
  return computeAlbaranContentHash(
    {
      numero: a.numero,
      fecha: a.fecha,
      modoValoracion: a.modoValoracion,
      lineas: (Array.isArray(a.lineas) ? a.lineas : []) as unknown as AlbaranLinea[],
      notas: a.notas ?? null,
      obra: obraSegunVersion(ev.v, { lugarEntrega: a.lugarEntrega, jobDireccion: params.jobDireccion }),
      referenciaTrabajo: params.referenciaTrabajo,
      cliente: params.cliente,
      emisor: params.emisor,
      emisorNif: params.emisorNif,
      // En v:1 estos campos no entran en el objeto canónico, así que da igual lo que valgan.
      firmadoPorNombre: ev.firmadoPorNombre ?? null,
      firmadoPorCalidad: ev.firmadoPorCalidad ?? null,
    },
    ev.v,
  );
}

/** ¿La evidencia guardada sigue cuadrando con el contenido actual del albarán? Solo LEE. */
export function verificarEvidenciaAlbaran(params: Parameters<typeof recomputarHashDeEvidencia>[0]): boolean {
  return recomputarHashDeEvidencia(params) === params.evidencia.contentHash;
}

/**
 * Construye y sella las evidencias en el momento de firmar. Resuelve el contenido real
 * (job→customer→merchant) para calcular el hash y el nombre del firmante. Se guarda tal cual
 * en Albaran.evidenciaFirma (aditivo, Json). El llamador aporta ip/ua/tokenId del request.
 */
export async function buildFirmaEvidencia(params: {
  albaran: { id: number; numero: string; fecha: Date; modoValoracion: string; lineas: unknown; notas: string | null; jobId: number; merchantId: number; lugarEntrega: string | null };
  canal: 'remoto' | 'in_situ';
  ip: string | null;
  ua: string | null;
  tokenId: string | null;
  firmadoAt: Date;
  // SCRUM-300: llegan CON la petición de firma, así que entran en el contenido ANTES de sellarlo.
  // Ese orden es la razón de que añadirlos no rompa el sello: no se pegan después.
  firmadoPorNombre?: string | null;
  firmadoPorCalidad?: string | null;
}): Promise<FirmaEvidencia> {
  const a = params.albaran;
  const job = await prisma.job.findUnique({
    where: { id: a.jobId },
    select: { customerId: true, titulo: true, direccion: true },
  });
  const [customer, merchant] = await Promise.all([
    job
      ? prisma.customer.findUnique({ where: { id: job.customerId }, select: { name: true, legalName: true } })
      : Promise.resolve(null),
    prisma.merchant.findUnique({ where: { id: a.merchantId }, select: { name: true, legalName: true, taxId: true } }),
  ]);
  const cliente = customer?.legalName || customer?.name || null;
  const firmadoPorNombre = params.firmadoPorNombre ?? null;
  const firmadoPorCalidad = params.firmadoPorCalidad ?? null;
  const contentHash = computeAlbaranContentHash(
    {
      numero: a.numero,
      fecha: a.fecha,
      modoValoracion: a.modoValoracion,
      lineas: (Array.isArray(a.lineas) ? a.lineas : []) as unknown as AlbaranLinea[],
      notas: a.notas ?? null,
      // SCRUM-300: la obra ya NO sale de `Job.direccion` (que nadie escribe) sino del campo del
      // albarán. Es un cambio de FUENTE de un campo ya sellado → por eso la versión sube a 2.
      obra: obraSegunVersion(ALBARAN_CONTENIDO_VERSION_ACTUAL, {
        lugarEntrega: a.lugarEntrega ?? null,
        jobDireccion: job?.direccion || null,
      }),
      referenciaTrabajo: job?.titulo || null,
      cliente,
      emisor: merchant?.legalName || merchant?.name || null,
      emisorNif: merchant?.taxId || null,
      firmadoPorNombre,
      firmadoPorCalidad,
    },
    ALBARAN_CONTENIDO_VERSION_ACTUAL,
  );
  return {
    v: ALBARAN_CONTENIDO_VERSION_ACTUAL,
    canal: params.canal,
    firmadoAt: params.firmadoAt.toISOString(),
    ip: params.ip || null,
    ua: params.ua ? String(params.ua).slice(0, 500) : null,
    tokenId: params.tokenId || null,
    // `firmante` era «el cliente del albarán» por definición. Ahora, si consta QUIÉN firmó de
    // verdad, es ese nombre el que vale: era justo el hueco que abre SCRUM-300 (un trazo sin
    // nombre). Se conserva el cliente como respaldo para no dejar la evidencia sin firmante.
    firmante: firmadoPorNombre || cliente || 'Cliente',
    hashAlg: 'sha256',
    contentHash,
    firmadoPorNombre,
    firmadoPorCalidad,
  };
}

/** Forma que viaja al front (lista en el detalle del Trabajo y respuestas de las rutas). */
export function serializeAlbaran(a: any) {
  const lineas = Array.isArray(a.lineas) ? a.lineas : [];
  const modoValoracion: AlbaranModoValoracion = a.modoValoracion === 'VALORADO' ? 'VALORADO' : 'SIN_VALORAR';
  return {
    id: a.id,
    jobId: a.jobId,
    numero: a.numero,
    fecha: a.fecha,
    modoValoracion,
    lineas,
    // SCRUM-65: totales orientativos, solo con contenido real en modo VALORADO
    // (evita que el front reimplemente la aritmética de céntimos).
    totales: modoValoracion === 'VALORADO' ? calcAlbaranTotales(lineas) : null,
    estado: a.estado,
    version: a.version,
    firmadoAt: a.firmadoAt,
    notas: a.notas,
    // SCRUM-300 (C5). ⚠️ `evidenciaFirma` sigue SIN salir de aquí: lleva ip/ua (dato personal).
    // Estos tres son contenido del documento, no evidencia técnica.
    lugarEntrega: a.lugarEntrega ?? null,
    firmadoPorNombre: a.firmadoPorNombre ?? null,
    firmadoPorCalidad: a.firmadoPorCalidad ?? null,
    pdfUrl: a.pdfUrl,
    // SCRUM-17: badge "Facturado" DERIVADO (invoiceId != null) — nunca flag manual (regla 27).
    facturado: a.invoiceId != null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

/**
 * Garantiza que el PDF del albarán existe en disco y devuelve su ruta (patrón
 * ensureInvoicePdf: Railway pierde el disco en cada deploy → regenerar si falta).
 * `force` = regenerar SIEMPRE (tras firmar, para incrustar el bloque de firma).
 */
export async function ensureAlbaranPdf(albaranId: number, force = false): Promise<{ diskPath: string; pdfUrl: string; numero: string }> {
  const albaran = await prisma.albaran.findUnique({ where: { id: albaranId } });
  if (!albaran) throw new Error('albaran_not_found');

  // SCRUM-48: nombre prefijado con merchantId (mata la colisión entre merchants) y pdfUrl
  // apuntando al endpoint AUTENTICADO (ya no hay estático público /albaranes).
  const fileName = `${albaran.merchantId}-${albaran.numero}.pdf`;
  const diskPath = path.join(albaranesDir, fileName);
  const pdfUrl = `/admin/albaranes/${albaran.id}/pdf`;

  if (!force && albaran.pdfUrl === pdfUrl && fs.existsSync(diskPath)) {
    return { diskPath, pdfUrl, numero: albaran.numero };
  }

  const [merchant, job] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id: albaran.merchantId },
      select: { name: true, legalName: true, taxId: true, address: true, logoUrl: true, whatsappPhone: true },
    }),
    prisma.job.findUnique({ where: { id: albaran.jobId } }),
  ]);
  const customer = job
    ? await prisma.customer.findUnique({ where: { id: job.customerId }, select: { name: true, legalName: true, taxId: true } })
    : null;

  const modoValoracion: AlbaranModoValoracion = albaran.modoValoracion === 'VALORADO' ? 'VALORADO' : 'SIN_VALORAR';
  const lineas = (Array.isArray(albaran.lineas) ? albaran.lineas : []) as unknown as AlbaranLinea[];

  await generateAlbaranPdf({
    merchantId: albaran.merchantId,
    numero: albaran.numero,
    fecha: albaran.fecha,
    emisionAt: albaran.createdAt, // SCRUM-67: fecha de emisión ≠ fecha de entrega/ejecución
    version: albaran.version,
    modoValoracion,
    merchant: merchant ?? { name: '—', legalName: null, taxId: null, address: null, logoUrl: null, whatsappPhone: null },
    customer: customer
      ? { name: customer.name, legalName: customer.legalName, taxId: customer.taxId }
      : { name: null, legalName: null, taxId: null },
    // SCRUM-300: el PDF imprime la obra QUE SE SELLÓ, y eso depende de la versión de la
    // evidencia. Un albarán v:1 se selló con `Job.direccion`; uno v:2, con `Albaran.lugarEntrega`.
    // Imprimir la fuente de hoy en un documento firmado ayer haría que el papel dijera una cosa
    // y su hash certificara otra. Sin firmar (v = undefined) manda el campo de hoy.
    obra: obraSegunVersion((albaran.evidenciaFirma as any)?.v, {
      lugarEntrega: albaran.lugarEntrega ?? null,
      jobDireccion: job?.direccion || null,
    }),
    referenciaTrabajo: job?.titulo || null, // SCRUM-67: referencia al Trabajo/presupuesto origen
    lineas,
    totales: modoValoracion === 'VALORADO' ? calcAlbaranTotales(lineas) : null,
    notas: albaran.notas,
    signatureData: albaran.signatureUrl,
    firmadoAt: albaran.firmadoAt,
    // SCRUM-300 (C5): QUIÉN firmó y EN CALIDAD DE QUÉ, junto al trazo. Salen de las columnas del
    // albarán (el documento), no de la evidencia (la prueba técnica). En los ya firmados son
    // null y el bloque de firma sale exactamente como salía.
    firmadoPorNombre: albaran.firmadoPorNombre ?? null,
    firmadoPorCalidad: albaran.firmadoPorCalidad ?? null,
    // SCRUM-68: certificado de evidencias (solo hash/firmante/canal — NUNCA ip/ua).
    evidencia: (albaran.evidenciaFirma as unknown as FirmaEvidencia | null) ?? null,
  });

  if (albaran.pdfUrl !== pdfUrl) {
    await prisma.albaran.update({ where: { id: albaranId }, data: { pdfUrl } });
  }
  return { diskPath, pdfUrl, numero: albaran.numero };
}
