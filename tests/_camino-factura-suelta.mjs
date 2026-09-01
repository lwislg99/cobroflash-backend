// tests/_camino-factura-suelta.mjs — SCRUM-616 · EL CAMINO DE LA FACTURA SUELTA, EN PURO.
//
// Recorre lo que le pasa a una línea desde que sale del front hasta lo que queda GUARDADO, y
// devuelve el recorrido entero para poder afirmarlo. Puro: ni base de datos ni turno de staging.
//
// ── 🔴 POR QUÉ ESTO SE PUEDE HACER SIN BASE DE DATOS, Y NO ES UN ATAJO ────────
// Porque el camino de escritura NO transforma nada después de validar. Medido:
//
//   invoicesAdmin.routes.ts:131   emitInvoice(tx, { … lines: val.lineas … })
//   invoicing.service.ts:94       lines: (input.lines as any) ?? undefined
//
// O sea: lo que `validarFacturaSuelta` devuelve en `lineas` es LITERALMENTE lo que aterriza en
// la columna `Invoice.lines`. No hay una segunda normalización escondida entre medias. Por eso
// caracterizar la función pura ES caracterizar lo guardado — y por eso este fichero sólo LEE el
// camino de emisión, que es lo que la regla 38 permite.
//
// Si algún día alguien mete una transformación entre esas dos líneas, este supuesto deja de
// valer y esta caracterización mediría otra cosa. `scrum616` lo comprueba: no se da por bueno.
//
// ── LAS TRES POBLACIONES, QUE NO SON LA MISMA ────────────────────────────────
//   LA QUE VIAJA     · lo que `lineaParaPayload` (quoteSuplido.js) entrega al servidor.
//   LA QUE SOBREVIVE · lo que `validarFacturaSuelta` deja pasar = lo que se guarda.
//   LA DESCARTADA    · la diferencia. Hoy nadie la nombra, y ése es el hueco de este ticket.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Publica las funciones de `quoteSuplido.js` sin navegador.
 *
 * Es un script clásico (ni DOM ni red) que cuelga lo suyo de `window`, así que se evalúa con un
 * `window` de mentira. Mismo procedimiento que `scrum500-suplidos.test.mjs`, y a propósito: dos
 * formas distintas de cargar el mismo fichero acabarían midiendo dos cosas distintas.
 */
export function cargarFrontSuplido() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quoteSuplido.js'), 'utf8');
  const ventana = {};
  new Function('window', fuente)(ventana);
  return ventana;
}

/** Las claves de un objeto, ordenadas, para poder compararlas con `deepEqual`. */
export const claves = (o) => Object.keys(o).sort();

/**
 * EL RECORRIDO COMPLETO de una línea. Recibe las funciones del dominio por parámetro para que
 * este módulo no dependa de `dist/` — quien lo llama ya las ha importado y así el suelo del test
 * puede comprobar que existen ANTES de recorrer nada.
 *
 * @returns {{viaja:object, guardado:object|null, claveViajan:string[], claveSobreviven:string[],
 *            claveDescartadas:string[]}}
 */
export function recorrerLinea({ lineaParaPayload, validarFacturaSuelta }, entrada, customerId = 7) {
  const viaja = lineaParaPayload(entrada);
  const r = validarFacturaSuelta({ customerId, lines: [viaja] });
  const guardado = r.ok ? r.lineas[0] : null;
  const claveViajan = claves(viaja);
  const claveSobreviven = guardado ? claves(guardado) : [];
  return {
    viaja,
    guardado,
    ok: r.ok,
    error: r.ok ? null : r.error,
    claveViajan,
    claveSobreviven,
    claveDescartadas: claveViajan.filter((k) => !claveSobreviven.includes(k)),
  };
}

/**
 * El DOCUMENTO tal como queda: las líneas guardadas, su desglose y el total con el que se emite.
 *
 * El `.toFixed(2)` no es adorno: es exactamente lo que hace la ruta
 * (`invoicesAdmin.routes.ts`, `const total = (bd.base + bd.cuota).toFixed(2)`), y el total es un
 * `Decimal(12,2)`. Redondear en otro sitio daría otro número.
 */
export function recorrerDocumento({ validarFacturaSuelta, calcVatBreakdown }, lineasQueViajan, customerId = 7) {
  const r = validarFacturaSuelta({ customerId, lines: lineasQueViajan });
  if (!r.ok) return { ok: false, error: r.error };
  const bd = calcVatBreakdown(r.lineas);
  return {
    ok: true,
    customerId: r.customerId,
    guardado: r.lineas,
    base: bd.base,
    cuota: bd.cuota,
    entries: bd.entries,
    total: (bd.base + bd.cuota).toFixed(2),
  };
}
