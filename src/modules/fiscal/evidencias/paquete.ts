// src/modules/fiscal/evidencias/paquete.ts — SCRUM-297 (A7) · el paquete de evidencias.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ PREGUNTA CONTESTA, Y POR QUÉ NO ES NINGUNA DE LAS DOS QUE YA EXISTÍAN
//
//   `portabilidadCompleta.ts` contesta «dame TODO lo mío» (RGPD).
//   `exportData.ts`           contesta «dame mi ACTIVIDAD».
//   Esto contesta una tercera: **DEMUESTRA QUE LO QUE DECLARASTE PASÓ.**
//
// No construye mecanismo nuevo: JUNTA cinco piezas que ya están en main —el Libro (A6), el
// modelo 303 (A5), el verificador del sello (SCRUM-369), su barrido (SCRUM-371) y el
// `quoteLineIndex` que ata cada línea entregada a su línea del presupuesto (SCRUM-367)—.
//
// ⚠️ ES LECTURA PURA (regla 38). Este módulo no importa `prisma`, no compone números, no sella
// y no escribe: no es una promesa, es que no tiene con qué. Un guard lo comprueba sobre el AST.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL PAQUETE NO RECALCULA NI ARREGLA NADA
//
// Si el verificador dice que un sobre no cuadra, el paquete **LO DECLARA**: no lo corrige, no lo
// oculta y no lo deja fuera. Un paquete de cumplimiento que esconde lo que no cuadra es peor que
// no tenerlo, **porque quien lo entrega cree que entrega todo**.
//
// Mismo espíritu que la regla 29 y que el propio verificador: lo firmado no se toca ni siquiera
// para arreglarlo — un sobre reescrito deja de ser prueba de nada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ESTADO VA EN EL ÍNDICE, NO SOLO EN EL CSV DEL ASIENTO
//
// Quien abre un ZIP mira el índice, no las 400 filas. **Un estado enterrado en la fila 287 está
// declarado y no está dicho.** Por eso el índice lleva una columna de estado por asiento, y su
// valor es el que YA DEVUELVE el verificador (`cuadra` o su `motivo`): cero prosa, cero
// interpretación, cero calendarios (regla 26).
import crypto from 'crypto';
import type { LibroRegistro, AsientoLibro } from '../../invoicing/domain/libroRegistro';
import type { Modelo303 } from '../modelo303/modelo303';
import type { ResultadoSobre, InformeVerificacion } from '../../jobs/domain/albaranVerificacion';

const SEP = ';';

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function fila(campos: unknown[]): string {
  return campos.map(csvEscape).join(SEP);
}
function csv(cabecera: string[], filas: unknown[][]): string {
  return '﻿' + [fila(cabecera), ...filas.map(fila)].join('\r\n');
}

/**
 * Importe para CSV. `null` sale VACÍO, nunca `0,00`.
 *
 * ⚠️ A propósito NO se usa `csvNum` de `exportData`: ése hace `Number(n ?? 0)` y convierte lo
 * ilegible en cero (familia SCRUM-271). En un paquete de cumplimiento, un importe que no se pudo
 * leer impreso como `0,00` es una AFIRMACIÓN de que esa factura no cobró nada.
 */
function eur(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toFixed(2).replace('.', ',');
}

export interface AlbaranDelPaquete {
  albaranId: number;
  numero: string;
  /** La factura que lo consolidó, si alguna. */
  invoiceId: number | null;
  /** Lo que dijo el verificador. NO se reinterpreta. */
  resultado: ResultadoSobre;
  /** Líneas del albarán, para el CSV de entregas (con su `quoteLineIndex`, SCRUM-367). */
  lineas: unknown;
}

export interface FilaIndice {
  numero: string;
  fecha: string | null;
  total: string;
  moneda: string | null;
  /**
   * El VALOR DERIVADO del verificador: `cuadra`, uno de sus motivos, o `sin_albaranes`.
   * Nada más. Sin prosa, sin «pendiente de», sin fechas de nada.
   */
  estadoSello: string;
  presupuestoId: number | null;
  presupuestoFirmado: string;
  albaranes: string;
  cobroId: number | null;
  /** Lo que a este asiento le FALTA, dicho. Un hueco no declarado es un hueco invisible. */
  huecos: string;
}

export interface PaqueteEvidencias {
  ficheros: { nombre: string; contenido: string }[];
  indice: FilaIndice[];
  resumen: {
    asientos: number;
    miradas: number;
    albaranesExaminados: number;
    albaranesQueCuadran: number;
    albaranesConHallazgo: number;
    facturasSinAlbaran: number;
    facturasSueltas: number;
  };
  /** Motivos por los que este paquete NO se puede leer como «todo en orden». */
  avisos: string[];
}

/** Nombre de cada pieza. Que sean constantes permite que un guard los cense sin adivinar. */
export const FICHEROS = Object.freeze({
  indice: 'indice.csv',
  libro: 'libro-registro.csv',
  modelo303: 'modelo-303.csv',
  verificacion: 'albaranes-verificacion.csv',
  entregas: 'entregas-por-linea.csv',
  manifiesto: 'manifiesto.json',
  // SCRUM-438: el alcance de lo que las verificaciones de este paquete pueden demostrar.
  politicaSobres: 'alcance-de-la-verificacion.txt',
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-438 · POLÍTICA DE LOS SOBRES ANTERIORES A v:3 — **MICROCOPY SIN APROBAR (regla 30)**
//
// Lo lee un ASESOR FISCAL o un inspector, no un profesional: el registro es más formal, pero el
// criterio es el mismo — no puede prometer más de lo que se puede demostrar, y tampoco menos.
//
// Qué intenta decir, para que se pueda corregir con el criterio delante:
//   · lo que SÍ se demuestra: que el contenido del documento no ha cambiado desde que se firmó;
//   · lo que NO: que cinco datos que el sello lee de otras tablas sigan siendo los de aquel día,
//     porque el sobre no los guardó — los vuelve a leer al verificar;
//   · y que eso NO es una manipulación ni un defecto del documento: es el alcance del sello.
export const POLITICA_SOBRES_ANTERIORES = `[PENDIENTE microcopy oficial · propuesta, SCRUM-438]

ALCANCE DE LA VERIFICACIÓN DE ALBARANES FIRMADOS

Los albaranes de este paquete se verifican recalculando la huella (SHA-256) del contenido que se
firmó y comparándola con la que quedó guardada en el momento de la firma.

QUÉ DEMUESTRA UNA VERIFICACIÓN QUE CUADRA
  El contenido del albarán —su número, su fecha, sus líneas, sus notas y el lugar y la fecha de
  entrega— es el mismo que el cliente firmó. Ninguno de esos datos se ha alterado después.

QUÉ NO DEMUESTRA, Y POR QUÉ SE DICE AQUÍ
  La huella incluye además CINCO datos que no se guardaron dentro del sobre de la firma y que se
  vuelven a leer de la base en cada verificación: la dirección de la obra, el nombre del trabajo,
  el nombre del cliente, y el nombre y el NIF del emisor.

  Si alguno de esos cinco se corrige después de firmar —por ejemplo, al arreglar la razón social
  de un cliente— la huella recalculada deja de coincidir SIN que el documento se haya tocado.

  Por eso estos albaranes se declaran DE INTEGRIDAD PARCIAL VERIFICABLE: se puede demostrar que el
  documento no ha cambiado, y no se puede demostrar por sí solo que esos cinco datos sean los de
  la fecha de la firma.

CÓMO SE ACOTA ESO
  Los albaranes firmados antes de la versión 3 del sobre pueden llevar un ATESTIGUAMIENTO: una
  verificación fechada, ejecutada en un momento concreto, que deja constancia de que entonces la
  huella coincidía y de con qué valores de esos cinco datos. Un atestiguamiento no es una firma ni
  un sellado: no añade ninguna garantía criptográfica. Lo que permite es fechar el antes y el
  después, de modo que una discrepancia posterior se pueda explicar por un cambio concreto.

  A partir de la versión 3 del sobre, los cinco datos quedan dentro de lo firmado y esta salvedad
  deja de aplicar a los documentos nuevos.
`;

/** El estado de un asiento a partir de los albaranes que le apuntan. */
function estadoDelAsiento(resultados: ResultadoSobre[]): string {
  if (resultados.length === 0) return 'sin_albaranes';
  const fallo = resultados.find((r) => !r.cuadra);
  // El primero que no cuadra manda: un asiento con un sobre roto no puede salir como «cuadra»
  // porque los otros tres sí lo hagan.
  return fallo && !fallo.cuadra ? fallo.motivo : 'cuadra';
}

function huecosDe(a: AsientoLibro, albaranes: AlbaranDelPaquete[]): string[] {
  const h: string[] = [];
  if (a.enlaces.presupuestoId === null) h.push('sin_presupuesto');
  else if (a.enlaces.presupuestoFirmado === false) h.push('presupuesto_sin_firma');
  if (albaranes.length === 0) h.push('sin_albaran');
  if (a.enlaces.cobroId === null) h.push('sin_cobro');
  if (a.importeIlegible) h.push('importe_ilegible');
  if (a.enlaces.albaranesNoSellados > 0) h.push('albaran_posterior_al_sello');
  return h;
}

/**
 * Construye el paquete. Puro: recibe lo que otros ya leyeron y no toca la base.
 *
 * `albaranesPorFactura` va por id de factura; los albaranes sin factura entran igual en el CSV de
 * verificación —son documentos del periodo— pero no cuelgan de ningún asiento.
 */
export function construirPaqueteEvidencias(params: {
  libro: LibroRegistro;
  modelo303: Modelo303;
  albaranes: readonly AlbaranDelPaquete[];
  informeVerificacion: InformeVerificacion;
  merchantId: number;
  periodo: { desde: string; hasta: string; año: number; trimestre: number };
}): PaqueteEvidencias {
  let facturasSinAlbaran = 0;
  let facturasSueltas = 0;

  const indice: FilaIndice[] = params.libro.asientos.map((a) => {
    // Los albaranes del asiento son los que la factura SELLÓ (`albaranRefs`), no los que hoy la
    // apuntan: el paquete enseña lo que el documento emitido dice (regla 29). Un albarán que
    // apareciera después ya lo declara el Libro en `albaranesNoSellados`, y de ahí sale su hueco.
    const sellados = new Set(a.enlaces.albaranes.map((s) => s.albaranId).filter((n) => n !== null));
    const albaranesDelAsiento = params.albaranes.filter((x) => sellados.has(x.albaranId));

    if (albaranesDelAsiento.length === 0) facturasSinAlbaran += 1;
    const huecos = huecosDe(a, albaranesDelAsiento);
    if (a.enlaces.presupuestoId === null && a.enlaces.cobroId === null && albaranesDelAsiento.length === 0) {
      facturasSueltas += 1;
    }

    return {
      numero: a.numero,
      fecha: a.fecha,
      total: eur(a.total),
      moneda: a.moneda,
      estadoSello: estadoDelAsiento(albaranesDelAsiento.map((x) => x.resultado)),
      presupuestoId: a.enlaces.presupuestoId,
      // Tres valores, no dos: «no viene de un presupuesto» no es «viene de uno sin firmar».
      presupuestoFirmado: a.enlaces.presupuestoFirmado === null ? '' : String(a.enlaces.presupuestoFirmado),
      albaranes: a.enlaces.albaranes.map((s) => s.numero ?? String(s.albaranId ?? '')).join(' '),
      cobroId: a.enlaces.cobroId,
      huecos: huecos.join(' '),
    };
  });

  // ── Los avisos: por qué este paquete puede no ser «todo en orden» ────────────────────────
  const avisos: string[] = [];
  if (params.libro.miradas > 0 && params.libro.asientos.length === 0) {
    avisos.push(`se revisaron ${params.libro.miradas} facturas y no salió ningún asiento`);
  }
  if (params.libro.sinNumero > 0) avisos.push(`${params.libro.sinNumero} factura(s) sin número fuera del libro`);
  if (params.libro.importesIlegibles.length > 0) {
    avisos.push(`${params.libro.importesIlegibles.length} importe(s) ilegibles: ${params.libro.importesIlegibles.join(' ')}`);
  }
  if (params.informeVerificacion.conclusion === 'no_se_pudo_mirar') {
    avisos.push('no se examinó ningún albarán firmado: el sello no se ha comprobado');
  }
  if (params.informeVerificacion.hallazgos.length > 0) {
    avisos.push(`${params.informeVerificacion.hallazgos.length} albarán(es) con el sello sin cuadrar`);
  }
  if (params.informeVerificacion.versionesNoSoportadas.length > 0) {
    avisos.push(`versiones de sobre sin receta: ${params.informeVerificacion.versionesNoSoportadas.join(' ')}`);
  }
  for (const m of params.modelo303.motivosParaNoFiarse) avisos.push(`modelo 303: ${m}`);

  // ── Los ficheros ────────────────────────────────────────────────────────────────────────
  const ficheros: { nombre: string; contenido: string }[] = [];

  ficheros.push({
    nombre: FICHEROS.indice,
    contenido: csv(
      ['numero', 'fecha', 'total', 'moneda', 'estado_sello', 'presupuesto_id', 'presupuesto_firmado', 'albaranes', 'cobro_id', 'huecos'],
      indice.map((f) => [f.numero, f.fecha, f.total, f.moneda, f.estadoSello, f.presupuestoId, f.presupuestoFirmado, f.albaranes, f.cobroId, f.huecos]),
    ),
  });

  ficheros.push({
    nombre: FICHEROS.libro,
    contenido: csv(
      ['numero', 'fecha', 'tipo', 'cliente_id', 'base', 'cuota', 'total', 'moneda', 'estado', 'importe_ilegible'],
      params.libro.asientos.map((a) => [
        a.numero, a.fecha, a.tipo, a.clienteId, eur(a.base), eur(a.cuota), eur(a.total), a.moneda, a.estado,
        a.importeIlegible ? 'si' : 'no',
      ]),
    ),
  });

  ficheros.push({
    nombre: FICHEROS.modelo303,
    contenido: csv(
      ['casilla_base', 'casilla_tipo', 'casilla_cuota', 'tipo', 'base', 'cuota'],
      [
        ...params.modelo303.casillas.map((c) => [c.casillaBase, c.casillaTipo, c.casillaCuota, c.tipo, eur(c.base), eur(c.cuota)]),
        ['', '', params.modelo303.casillaTotalCuota.casilla, 'TOTAL', eur(params.modelo303.totalBase), eur(params.modelo303.casillaTotalCuota.valor)],
        // Lo que NO está en ninguna casilla se declara AQUÍ, no se calla: si no, el CSV parecería
        // cuadrar por el simple hecho de no mencionarlo.
        ...params.modelo303.sinClasificar.map((o) => ['', '', '', `SIN_CLASIFICAR ${o.motivo} ${o.numero}`, eur(o.base), eur(o.cuota)]),
      ],
    ),
  });

  ficheros.push({
    nombre: FICHEROS.verificacion,
    contenido: csv(
      ['albaran', 'version_sobre', 'cuadra', 'motivo', 'factura'],
      params.albaranes.map((x) => [
        x.numero,
        x.resultado.v ?? '',
        x.resultado.cuadra ? 'si' : 'no',
        x.resultado.cuadra ? '' : x.resultado.motivo,
        x.invoiceId ?? '',
      ]),
    ),
  });

  // SCRUM-367: `quoteLineIndex` ata cada línea entregada a su línea del presupuesto. Es lo que
  // permite enseñar que lo entregado es lo presupuestado, línea a línea.
  const filasEntregas: unknown[][] = [];
  for (const x of params.albaranes) {
    const lineas = Array.isArray(x.lineas) ? (x.lineas as any[]) : [];
    lineas.forEach((l, i) => {
      filasEntregas.push([
        x.numero, i,
        typeof l?.quoteLineIndex === 'number' ? l.quoteLineIndex : '',
        l?.concepto ?? '', l?.cantidad ?? '', l?.unidad ?? '',
      ]);
    });
  }
  ficheros.push({
    nombre: FICHEROS.entregas,
    contenido: csv(['albaran', 'linea', 'linea_del_presupuesto', 'concepto', 'cantidad', 'unidad'], filasEntregas),
  });

  const resumen = {
    asientos: params.libro.asientos.length,
    miradas: params.libro.miradas,
    albaranesExaminados: params.informeVerificacion.examinados,
    albaranesQueCuadran: params.informeVerificacion.cuadran,
    albaranesConHallazgo: params.informeVerificacion.hallazgos.length,
    facturasSinAlbaran,
    facturasSueltas,
  };

  // El manifiesto va EL ÚLTIMO: lleva el SHA-256 de cada fichero anterior, que es lo que permite
  // a un tercero comprobar que el ZIP no se ha tocado desde que se generó.
  // ── SCRUM-438 · LA POLÍTICA DE LOS SOBRES ANTERIORES, DENTRO DEL PAQUETE ─────────────────
  //
  // 🔴 VA AQUÍ Y NO EN UN DOCUMENTO APARTE, y ésa es la decisión: un paquete de evidencias que
  // afirma integridad tiene que llevar DENTRO el alcance de lo que afirma. Un documento externo
  // se separa del ZIP el primer día, y entonces quien lo recibe lee las verificaciones sin el
  // matiz que las acota — que es exactamente la lectura que no se puede permitir.
  //
  // Se incluye SIEMPRE, cuadren o no: si solo saliera cuando algo falla, su presencia sería en sí
  // misma una señal de problema y quien prepara el paquete tendría un motivo para quitarla.
  ficheros.push({ nombre: FICHEROS.politicaSobres, contenido: POLITICA_SOBRES_ANTERIORES });

  const manifiesto = {
    version: 1,
    merchantId: params.merchantId,
    periodo: params.periodo,
    resumen,
    avisos,
    ficheros: ficheros.map((f) => ({
      nombre: f.nombre,
      bytes: Buffer.byteLength(f.contenido, 'utf8'),
      sha256: crypto.createHash('sha256').update(f.contenido, 'utf8').digest('hex'),
    })),
  };
  ficheros.push({ nombre: FICHEROS.manifiesto, contenido: JSON.stringify(manifiesto, null, 2) });


  return { ficheros, indice, resumen, avisos };
}
