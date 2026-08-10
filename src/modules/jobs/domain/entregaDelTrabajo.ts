// src/modules/jobs/domain/entregaDelTrabajo.ts — SCRUM-423
//
// EL ENCHUFE de `entregaPendiente` (C6 · SCRUM-305) a la pantalla del Trabajo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ HACE Y QUÉ NO
//
// `resumenEntrega` es PURO y recibe tres cosas ya resueltas: las líneas del presupuesto
// ORIGINAL, si hay adicionales, y los albaranes. Este módulo resuelve esas tres cosas a partir
// de lo que la ruta del Trabajo ya tiene en la mano, y **no recalcula nada**: la aritmética de
// «quedan 3» sigue viviendo entera en C6 y aquí no se copia ni una línea de ella.
//
// Existe como fichero aparte —y no dentro de `jobs.routes.ts`— por una razón concreta: el SUELO
// de abajo tiene que poder ejercitarse SIN base de datos. Un suelo que sólo se puede probar
// levantando Postgres es un suelo que no se prueba.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL SUELO, QUE ES LO QUE MÁS IMPORTA DE ESTE FICHERO
//
// «No queda nada por entregar» y «no supe leer lo entregado» **dan la misma pantalla**: ninguna
// línea. Y no son lo mismo ni de lejos — el segundo le está diciendo al profesional que ya puede
// facturar una obra que quizá no ha entregado. Por eso los estados están SEPARADOS en el tipo, y
// `ILEGIBLE` no se puede confundir con `CALCULADO` con `pendienteTotal: 0`.
//
// ⚠️ Y el caso que de verdad muerde no es `lines: null` —ése salta a la vista—: es un array de
// líneas **cuyas cantidades no se pueden leer**. Ahí `resumenEntrega` calcularía `presupuestada:
// 0` para todas, daría `pendienteTotal: 0` y la pantalla diría, con toda tranquilidad, que no
// queda nada. Un cero derivado de no saber leer es la mentira más cara de esta pantalla, así que
// se caza aquí: si hay líneas y NINGUNA tiene cantidad legible, esto es ILEGIBLE, no un cero.
import { resumenEntrega, type ResumenEntrega, type AlbaranParaEntrega } from './entregaPendiente';

export const SIN_EJE = 'sin_eje';
export const ILEGIBLE = 'ilegible';
export const CALCULADO = 'calculado';

export type MotivoIlegible =
  | 'lineas_no_son_lista'
  | 'ninguna_linea_con_cantidad_legible'
  | 'albaranes_no_son_lista';

export type EntregaDelTrabajo =
  /** El Trabajo no tiene presupuesto original: no hay eje contra el que medir. NO es un fallo. */
  | { estado: typeof SIN_EJE }
  /** No se pudo leer lo necesario. NUNCA se pinta como «nada pendiente». */
  | { estado: typeof ILEGIBLE; motivo: MotivoIlegible }
  | { estado: typeof CALCULADO; resumen: ResumenEntrega };

/** ¿Esta línea de presupuesto trae una cantidad que se pueda usar? */
function cantidadLegible(l: any): boolean {
  const q = l?.qty;
  if (typeof q === 'number') return Number.isFinite(q);
  // `.env`-style: los Json de Prisma a veces traen números como cadena. Se acepta solo si de
  // verdad es un número; `''` y `[]` NO lo son (familia SCRUM-271: `Number([])` es 0).
  return typeof q === 'string' && q.trim() !== '' && Number.isFinite(Number(q));
}

/**
 * Resuelve el estado de entrega de un Trabajo a partir de lo que la ruta ya tiene cargado.
 *
 * @param quotes  los presupuestos del Trabajo, **con el ORIGINAL el primero** — es el orden que
 *   garantiza `quotesDeJob`. El original define el eje; el resto solo decide `hayAdicionales`.
 * @param albaranes  los albaranes del Trabajo, crudos.
 */
export function entregaDelTrabajo(quotes: any[], albaranes: any[]): EntregaDelTrabajo {
  const lista = Array.isArray(quotes) ? quotes : [];
  const original = lista[0] ?? null;

  // Sin presupuesto original no hay contra qué comparar, y eso NO es un fallo: es un Trabajo
  // manual (SCRUM-51). Se distingue de `ILEGIBLE` a propósito.
  if (!original) return { estado: SIN_EJE };

  if (!Array.isArray(albaranes)) return { estado: ILEGIBLE, motivo: 'albaranes_no_son_lista' };

  const lineas = original.lines;
  if (!Array.isArray(lineas)) return { estado: ILEGIBLE, motivo: 'lineas_no_son_lista' };

  // Un presupuesto con CERO líneas es legible y está vacío: no hay nada que entregar y eso es una
  // respuesta, no una ceguera. Pero líneas que existen y no dejan leer NI UNA cantidad, sí lo es.
  if (lineas.length > 0 && !lineas.some(cantidadLegible)) {
    return { estado: ILEGIBLE, motivo: 'ninguna_linea_con_cantidad_legible' };
  }

  const paraEntrega: AlbaranParaEntrega[] = albaranes.map((a: any) => ({
    estado: String(a?.estado ?? ''),
    modoValoracion: String(a?.modoValoracion ?? ''),
    lineas: a?.lineas,
  }));

  return {
    estado: CALCULADO,
    resumen: resumenEntrega({
      lineasPresupuestoOriginal: lineas,
      hayAdicionales: lista.length > 1,
      albaranes: paraEntrega,
    }),
  };
}

/**
 * Lo que viaja al navegador. Mínimo y explícito: el frontend NO vuelve a derivar nada.
 *
 * ⚠️ `estado` viaja SIEMPRE, incluido `ilegible`. Podría omitirse el campo entero cuando no hay
 * número —la pantalla no lo pinta igual— pero entonces «no hay dato» y «no se pudo leer» volverían
 * a ser indistinguibles desde fuera, que es justo lo que este módulo separa. Que la pantalla
 * decida no pintarlo es una cosa; que nadie pueda saberlo es otra.
 */
export function entregaParaVista(e: EntregaDelTrabajo) {
  if (e.estado !== CALCULADO) {
    return { estado: e.estado, motivo: e.estado === ILEGIBLE ? e.motivo : null, calculable: false };
  }
  const r = e.resumen;
  return {
    estado: CALCULADO,
    calculable: r.calculable,
    motivo: r.calculable ? null : r.motivo,
    // 🔴 DOS NÚMEROS DISTINTOS, Y CONFUNDIRLOS ERA MI ERROR (medido al escribir la copy).
    //
    // `pendienteTotal` es la SUMA DE CANTIDADES pendientes (horas, m², ud) — no un conteo. Un
    // Trabajo con «2,5 m de bajante» pendientes da `pendienteTotal: 2.5`, y rotularlo «2,5 líneas
    // del presupuesto sin entregar» sería falso, además de un decimal en una cuenta de cosas.
    //
    // La copy aprobada (10-ago-2026) dice **líneas**, así que la pantalla necesita el CONTEO de
    // líneas que aún tienen algo pendiente. Se cuenta sobre el resultado que C6 ya produjo: no se
    // recalcula ni un pendiente, solo se cuentan los suyos que no son cero.
    //
    // Los dos viajan: `pendienteTotal` porque es lo que C6 calcula y nadie más lo tiene, y
    // `lineasPendientes` porque es lo que se rotula. Quien pinte elige, y no puede confundirlos
    // sin querer porque se llaman cosas distintas.
    pendienteTotal: r.calculable ? r.pendienteTotal : null,
    lineasPendientes: r.calculable ? r.lineas.filter((l) => l.pendiente > 0).length : null,
    sinAtribuir: r.sinAtribuir,
    enPartesSinFirmar: r.enPartesSinFirmar,
    albaranesValorados: r.albaranesValorados,
  };
}
