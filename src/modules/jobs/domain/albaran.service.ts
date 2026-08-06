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
  /**
   * SCRUM-367 · ÍNDICE DE LA LÍNEA DEL PRESUPUESTO de la que sale esta línea.
   *
   * Hoy **nada ata una línea de albarán con su línea de presupuesto**: medido en A0.2, el esquema
   * entero tiene exactamente un enlace por línea (`AlbaranLineaFacturada`) y está al lado
   * equivocado del ciclo — da lo FACTURADO, no lo PRESUPUESTADO. Sin este campo, «quedan 3 metros
   * de bajante por entregar» (C6) y media G5 solo se pueden responder cruzando textos, que no es un
   * mecanismo: es una apuesta.
   *
   * Va DENTRO del `Json` que ya existe (`Albaran.lineas`), así que **no toca
   * `prisma/schema.prisma` ni exige migración**.
   *
   * **Ausente = línea añadida en obra.** Eso es lo que pasa a distinguir las dos categorías, que es
   * justo lo que SCRUM-257 declaró fuera de alcance por no tener con qué. Y afina aquel ticket: no
   * había «líneas prellenadas» porque nada prellenaba — la segunda categoría no existía.
   */
  quoteLineIndex?: number;
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
  /**
   * SCRUM-367 · cuántas líneas tiene el presupuesto de origen, para validar `quoteLineIndex`.
   *
   * `undefined` = no se puede comprobar (no hay presupuesto a mano) → el índice se CONSERVA tal
   * cual. `número` = se valida contra el rango real y un índice fuera de él **se rechaza**.
   *
   * **Un enlace roto es peor que ningún enlace**, porque C6 se lo creería y respondería «no queda
   * nada por entregar» sobre una correspondencia que no existe.
   */
  lineasDelPresupuesto?: number,
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

    // ── SCRUM-367 · CONSERVAR EL ORIGEN ────────────────────────────────────────────────
    //
    // ESTE ES EL PUNTO QUE HACE QUE TODO LO DEMÁS VALGA. Esta función reconstruye la línea campo
    // a campo, así que hasta hoy **se comía cualquier extra en la primera edición**: se podía
    // guardar el índice al crear y desaparecía en silencio al editar, dejando el mecanismo verde
    // y vacío.
    //
    // No se EXIGE: una línea sin origen es perfectamente válida —es la añadida en obra—. Solo se
    // conserva si viene, y se rechaza si viene MAL.
    const bruto = (l as any)?.quoteLineIndex;
    if (bruto !== undefined && bruto !== null && bruto !== '') {
      // ⚠️ FAMILIA SCRUM-271, y aquí mordió de verdad: `Number([])` es **0**, un entero ≥ 0
      // perfectamente válido. Con `Number()` a pelo, un array vacío —o cualquier objeto que
      // convierta a 0— se guardaba atado a la PRIMERA partida del presupuesto, en silencio.
      // Por eso se exige que el tipo sea número o cadena de dígitos ANTES de convertir.
      const esNumero = typeof bruto === 'number';
      const esDigitos = typeof bruto === 'string' && /^\d+$/.test(bruto.trim());
      if (!esNumero && !esDigitos) {
        return { ok: false, error: `línea ${i + 1}: quoteLineIndex debe ser un entero ≥ 0` };
      }
      const idx = Number(bruto);
      if (!Number.isInteger(idx) || idx < 0) {
        return { ok: false, error: `línea ${i + 1}: quoteLineIndex debe ser un entero ≥ 0` };
      }
      if (lineasDelPresupuesto !== undefined && idx >= lineasDelPresupuesto) {
        return {
          ok: false,
          error: `línea ${i + 1}: quoteLineIndex ${idx} no existe en el presupuesto (tiene ${lineasDelPresupuesto} línea(s))`,
        };
      }
      linea.quoteLineIndex = idx;
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
/**
 * SCRUM-367 · cuántas líneas tiene el presupuesto que originó este Trabajo.
 *
 * Sirve para validar `quoteLineIndex` contra el rango REAL en vez de creerse lo que llega del
 * cliente. Devuelve `undefined` cuando no hay presupuesto o no se puede leer: entonces el índice se
 * conserva sin validar el rango, que es honesto — **lo que no se puede es fingir que se comprobó**.
 *
 * Scopeado por merchant (regla 2).
 */
export async function contarLineasDePresupuesto(jobId: number, merchantId: number): Promise<number | undefined> {
  const job = await prisma.job.findFirst({ where: { id: jobId, merchantId }, select: { quoteId: true } });
  if (!job?.quoteId) return undefined;
  const quote = await prisma.quote.findFirst({ where: { id: job.quoteId, merchantId }, select: { lines: true } });
  return Array.isArray(quote?.lines) ? (quote!.lines as unknown[]).length : undefined;
}

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
  firmante: string;           // SCRUM-300: nombre DECLARADO por quien firma (v2). En v:1 era el
                              // nombre del cliente, puesto por nosotros y sin que nadie lo dijera.
  firmadoPorCalidad?: string | null; // en calidad de qué firma (v2; ausente en v:1)
  hashAlg: 'sha256';
  contentHash: string;        // SHA-256 del CONTENIDO canónico (NO del PDF, §1.3 del brief)
}

/**
 * SHA-256 del CONTENIDO canónico del albarán — NO del binario del PDF (§1.3): lo que se
 * firma es el contenido (número, fecha, líneas, partes, notas), no una representación.
 * Serialización determinista (claves fijas, `null` explícito) → el mismo contenido produce
 * SIEMPRE el mismo hash y cualquier alteración posterior lo cambia (prueba de integridad).
 */
export const EVIDENCIA_VERSION_ACTUAL = 2;

/**
 * ⚠️ ESTA FUNCIÓN SELLA EN v2 Y SOLO EN v2 (SCRUM-300).
 *
 * Los sobres v:1 —todos los albaranes firmados antes de esta tarea— se calcularon con una forma
 * canónica DISTINTA: sin `lugarEntrega`, sin `fechaEntrega`, sin quién firmó, y con un campo
 * `obra` que salía de `Job.direccion`. Como `Job.direccion` no la escribe nadie (medido en
 * SCRUM-300: ningún endpoint la acepta), ese `obra` fue SIEMPRE `null`. O sea: llevamos meses
 * sellando el lugar de la obra vacío.
 *
 * Esos sobres NO se recalculan, NO se migran y NO se tocan: quedan como están, porque con su
 * `obra: null` son la verdad de lo que se firmó. Esta función NO los reproduce, y eso es
 * deliberado — quien construya el verificador (SCRUM-369) tiene que saber que hay DOS
 * poblaciones y que `v` es lo que las distingue. Un verificador que pase todo por aquí daría
 * por falsificado el histórico entero.
 */
export function computeAlbaranContentHash(params: {
  numero: string;
  fecha: Date | string;
  modoValoracion: string;
  lineas: AlbaranLinea[];
  notas: string | null;
  /** SCRUM-300: campo PROPIO del albarán. NUNCA el domicilio fiscal (ver el suelo del ticket). */
  lugarEntrega: string | null;
  fechaEntrega: Date | string | null;
  firmadoPorNombre: string | null;
  firmadoPorCalidad: string | null;
  referenciaTrabajo: string | null;
  cliente: string | null;
  emisor: string | null;
  emisorNif: string | null;
}): string {
  const canonical = {
    v: EVIDENCIA_VERSION_ACTUAL,
    numero: params.numero,
    fecha: params.fecha instanceof Date ? params.fecha.toISOString() : String(params.fecha),
    modoValoracion: params.modoValoracion,
    lugarEntrega: params.lugarEntrega ?? null,
    fechaEntrega:
      params.fechaEntrega instanceof Date
        ? params.fechaEntrega.toISOString()
        : params.fechaEntrega
          ? String(params.fechaEntrega)
          : null,
    firmadoPorNombre: params.firmadoPorNombre ?? null,
    firmadoPorCalidad: params.firmadoPorCalidad ?? null,
    referenciaTrabajo: params.referenciaTrabajo ?? null,
    cliente: params.cliente ?? null,
    emisor: params.emisor ?? null,
    emisorNif: params.emisorNif ?? null,
    notas: params.notas ?? null,
    lineas: (Array.isArray(params.lineas) ? params.lineas : []).map((l) => ({
      concepto: l.concepto,
      cantidad: l.cantidad,
      unidad: l.unidad ?? null,
      precioUnitario: l.precioUnitario ?? null,
      tipoIva: l.tipoIva ?? null,
    })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}

/**
 * Construye y sella las evidencias en el momento de firmar. Resuelve el contenido real
 * (job→customer→merchant) para calcular el hash y el nombre del firmante. Se guarda tal cual
 * en Albaran.evidenciaFirma (aditivo, Json). El llamador aporta ip/ua/tokenId del request.
 */
export async function buildFirmaEvidencia(params: {
  albaran: {
    id: number; numero: string; fecha: Date; modoValoracion: string; lineas: unknown;
    notas: string | null; jobId: number; merchantId: number;
    lugarEntrega?: string | null; fechaEntrega?: Date | null;
  };
  canal: 'remoto' | 'in_situ';
  ip: string | null;
  ua: string | null;
  tokenId: string | null;
  firmadoAt: Date;
  /**
   * SCRUM-300: la DECLARACIÓN de quien firma, tal y como la ha escrito. Obligatoria — y por eso
   * no tiene valor por defecto ni se rellena con el nombre del cliente: si firma el encargado y
   * nadie lo corrige, un nombre prerrellenado sellaría una declaración FALSA, que se impugna y
   * arrastra al documento entero. Un hueco es menos daño que una mentira firmada.
   */
  firmadoPorNombre: string;
  firmadoPorCalidad: string | null;
}): Promise<FirmaEvidencia> {
  const a = params.albaran;
  const nombreFirmante = String(params.firmadoPorNombre ?? '').trim();
  if (!nombreFirmante) {
    // Fail-closed a propósito: antes esto ponía `cliente || 'Cliente'`, así que el sobre afirmaba
    // que había firmado el cliente aunque nadie lo hubiera dicho. Preferimos no sellar a sellar
    // un nombre que nadie ha declarado.
    throw new Error('firma_sin_nombre');
  }
  const job = await prisma.job.findUnique({
    where: { id: a.jobId },
    select: { customerId: true, titulo: true },
  });
  const [customer, merchant] = await Promise.all([
    job
      ? prisma.customer.findUnique({ where: { id: job.customerId }, select: { name: true, legalName: true } })
      : Promise.resolve(null),
    prisma.merchant.findUnique({ where: { id: a.merchantId }, select: { name: true, legalName: true, taxId: true } }),
  ]);
  const cliente = customer?.legalName || customer?.name || null;
  const contentHash = computeAlbaranContentHash({
    numero: a.numero,
    fecha: a.fecha,
    modoValoracion: a.modoValoracion,
    lineas: (Array.isArray(a.lineas) ? a.lineas : []) as unknown as AlbaranLinea[],
    notas: a.notas ?? null,
    // 🔴 SUELO DEL TICKET: el lugar de entrega sale del ALBARÁN y de ningún otro sitio. Si está
    // vacío, se sella vacío. NO se cae al domicilio fiscal del merchant ni al del cliente:
    // poner una dirección equivocada en un documento de entrega es peor que dejarla en blanco,
    // porque el cliente la firma sin mirar y luego el papel dice que se entregó donde no fue.
    lugarEntrega: a.lugarEntrega ?? null,
    fechaEntrega: a.fechaEntrega ?? null,
    firmadoPorNombre: nombreFirmante,
    firmadoPorCalidad: params.firmadoPorCalidad ?? null,
    referenciaTrabajo: job?.titulo || null,
    cliente,
    emisor: merchant?.legalName || merchant?.name || null,
    emisorNif: merchant?.taxId || null,
  });
  return {
    v: EVIDENCIA_VERSION_ACTUAL,
    canal: params.canal,
    firmadoAt: params.firmadoAt.toISOString(),
    ip: params.ip || null,
    ua: params.ua ? String(params.ua).slice(0, 500) : null,
    tokenId: params.tokenId || null,
    // El firmante es QUIEN HA DICHO QUE FIRMA, no el titular del trabajo. Son cosas distintas
    // en cuanto firma el encargado, la vecina o el portero — que es el caso normal en obra.
    firmante: nombreFirmante,
    firmadoPorCalidad: params.firmadoPorCalidad ?? null,
    hashAlg: 'sha256',
    contentHash,
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
    // SCRUM-300 (C5). null = «No se pidió al firmar»: son los albaranes anteriores a esta tarea,
    // y el front lo dice con esas palabras en vez de dejar un hueco mudo. Un blanco en un
    // documento legal se lee como un fallo del sistema; esto explica por qué está vacío.
    fechaEntrega: a.fechaEntrega ?? null,
    lugarEntrega: a.lugarEntrega ?? null,
    firmadoPorNombre: a.firmadoPorNombre ?? null,
    firmadoPorCalidad: a.firmadoPorCalidad ?? null,
    notas: a.notas,
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
    // 🔴 SCRUM-300 · SUELO: del ALBARÁN y de ningún otro sitio. Antes esto era `job.direccion`,
    // que no la escribe nadie, así que el PDF nunca imprimió el lugar de la obra. No se sustituye
    // por `merchant.address` (domicilio FISCAL del profesional) ni por nada parecido: es la
    // dirección de OTRO, y en un documento de entrega firmada eso miente.
    lugarEntrega: albaran.lugarEntrega ?? null,
    fechaEntrega: albaran.fechaEntrega ?? null,
    referenciaTrabajo: job?.titulo || null, // SCRUM-67: referencia al Trabajo/presupuesto origen
    lineas,
    totales: modoValoracion === 'VALORADO' ? calcAlbaranTotales(lineas) : null,
    notas: albaran.notas,
    signatureData: albaran.signatureUrl,
    firmadoAt: albaran.firmadoAt,
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
