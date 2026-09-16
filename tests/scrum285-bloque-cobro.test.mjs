// SCRUM-285 · §B4 punto 3 — EL BLOQUE «Cobro» DEL DETALLE DE FACTURA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// El detalle de factura SABÍA que había un cobro —`invoice.chargeId` decidía qué botones pintar
// en cinco sitios— y no enseñaba NADA de él. El propio fichero llamaba «callejón» a ese estado.
// El profesional tenía que salir del documento e ir a Cobros a buscar a mano cuándo entró su
// dinero. Ahora el importe y la fecha están a la vista, sin salir de la pantalla.
//
// ⚠️ NO enlaza, y no es un olvido: la ficha de detalle de cobro NO EXISTE (`charge-detail` no
// está en el dispatch, `appState.chargeId` no existe). Está declarado en la entrada de máster.
//
// ⚠️ EL CONTROL NEGATIVO PESA MÁS QUE EL POSITIVO: una factura SIN cobro no pinta bloque. Un
// «Cobro» vacío en la pantalla del dinero se lee como un fallo de carga, y eso es peor que la
// ausencia que veníamos a arreglar.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/invoiceDetailView.js');

/** El bloque de código que pinta la columna derecha del resumen, extraído por su ancla real. */
function columnaDerecha() {
  const src = fs.readFileSync(VISTA, 'utf8');
  const desde = src.indexOf('const totalBlock');
  const hasta = src.indexOf('// Badges de recordatorios');
  if (desde === -1 || hasta === -1 || hasta <= desde) return null;
  return src.slice(desde, hasta);
}

test('SCRUM-285 · SUELO: se encuentra la columna derecha del detalle de factura', () => {
  // Otra sesión buscó hoy un `create` en el fichero equivocado y su suelo la salvó de dar verde
  // sobre el defecto que perseguía. Si estas anclas dejan de existir, este archivo NO puede
  // afirmar nada: falla declarándose ciego en vez de pasar por no ver.
  const col = columnaDerecha();
  assert.ok(col, '🔴 CIEGO: no se encuentran las anclas de la columna derecha (`const totalBlock` … '
    + '`// Badges de recordatorios`) en invoiceDetailView.js. Si la pantalla se reescribió, hay que '
    + 'enseñarle las anclas nuevas ANTES de fiarse de los tests de abajo.');
  assert.ok(col.length > 100,
    `🔴 CIEGO: la columna derecha mide ${col.length} caracteres; es demasiado poco para contenerla`);
});

test('SCRUM-285 · 🔴 POSITIVO: el bloque «Cobro» se pinta con importe y fecha', () => {
  const col = columnaDerecha() || '';
  assert.match(col, />Cobro</,
    '🔴 no está el bloque «Cobro» en la columna derecha del detalle de factura. Sin él, quien '
    + 'mira una factura cobrada no sabe cuándo entró el dinero sin salir de la pantalla.');
  assert.match(col, /detail-cobro-importe/,
    '🔴 el bloque «Cobro» no pinta el IMPORTE: «cuánto» es la mitad de la pregunta');
  assert.match(col, /paidAt/,
    '🔴 el bloque «Cobro» no pinta la FECHA: «cuándo entró» es justo lo que se venía a resolver');
});

test('SCRUM-285 · 🔴 NEGATIVO: sin cobro no se pinta NADA', () => {
  // El que más pesa. El bloque tiene que estar dentro de una condición sobre `chargeId`, no
  // pintado siempre con huecos vacíos.
  const col = columnaDerecha() || '';
  assert.match(col, /if\s*\(\s*invoice\.chargeId\s*\)/,
    '🔴 el bloque «Cobro» NO está condicionado a que exista cobro.\n\n'
    + '  Una factura sin cobrar pintaría un «Cobro» vacío, y en la pantalla del dinero eso se lee\n'
    + '  como un fallo de carga — peor que la ausencia que se venía a arreglar.\n'
    + '  O está el dato, o no está la sección.');
  // Y que el appendChild viva DENTRO de esa condición, no fuera: la condición sin el append
  // dentro es una condición decorativa.
  const cond = col.slice(col.indexOf('if (invoice.chargeId)'));
  const cierre = cond.indexOf('\n    }');
  assert.ok(cierre > 0 && cond.slice(0, cierre).includes('summaryRow.appendChild(cobroBlock)'),
    '🔴 el `appendChild` del bloque «Cobro» está FUERA del `if`: la condición no impide nada');
});

test('SCRUM-285 · el total sigue pintándose (no se lo llevó el bloque nuevo)', () => {
  // Control de daño colateral: al insertar el bloque se puede borrar el `appendChild` del total
  // sin que nada chille. Pasó al escribir esto, y lo cazó la relectura, no el navegador.
  const col = columnaDerecha() || '';
  assert.match(col, /summaryRow\.appendChild\(totalBlock\)/,
    '🔴 el TOTAL ha dejado de añadirse a la columna derecha: el bloque nuevo se lo ha comido');
});
