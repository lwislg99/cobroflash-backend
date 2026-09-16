// tests/scrum286-censo-nuevo-presupuesto.test.mjs — SCRUM-286 (B3), guard estructural, sin gate.
//
// NINGÚN CAMPO DEJA DE VIAJAR EN SILENCIO.
//
// El ticket declara su fallo mudo: «un campo que se pierde al reordenar es el fallo mudo de esta
// tarea». Se paga en el ENVÍO — reordenar la pantalla y que un campo deje de viajar no se ve
// mirando la pantalla.
//
// Este fichero NO reordena nada. Solo enumera lo que hoy viaja, y falla si deja de encontrarlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarEnvioPresupuesto, BLOQUES_DEL_TICKET } from './_censo-nuevo-presupuesto.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const VISTA = path.join(AQUI, '..', 'public/dashboard/js/quotesView.js');
const CENSO = censarEnvioPresupuesto(fs.readFileSync(VISTA, 'utf8'), 'quotesView.js');

// Suelos medidos HOY sobre `main`. No son cifras de gusto: son lo que viaja, fijado.
const SUELO_ENVIO = 10;
const SUELO_LINEA = 4;

test('SCRUM-286 · SUELO: el censo encuentra lo que el formulario ENVÍA', () => {
  assert.ok(CENSO.envio.length >= SUELO_ENVIO,
    `🔴 solo ${CENSO.envio.length} campos en el envío (esperados ≥${SUELO_ENVIO}). O un campo ha ` +
    'dejado de viajar, o el detector no lo reconoce. Las dos son rojo: «0 campos» y «no supe ' +
    'mirar» son el mismo número.');
});

test('SCRUM-286 · SUELO: el censo encuentra la sub-población de cada línea', () => {
  assert.ok(CENSO.linea.length >= SUELO_LINEA,
    `🔴 solo ${CENSO.linea.length} campos por línea (esperados ≥${SUELO_LINEA}). Las líneas son ` +
    'el bloque con más superficie del formulario: si se pierde uno, el importe cambia.');
});

test('SCRUM-286 · SUELO: todo campo censado trae su línea real del árbol', () => {
  const sinLinea = [...CENSO.envio, ...CENSO.linea].filter((c) => !Number.isInteger(c.linea) || c.linea <= 0);
  assert.deepEqual(sinLinea, [], '🔴 hay campos sin posición: el censo no está leyendo el árbol.');
});

// ── CONTROL NEGATIVO ─────────────────────────────────────────────────────────
test('SCRUM-286 · NEGATIVO: el borrador de localStorage NO entra en el censo', () => {
  // `saveDraft` construye un objeto muy parecido y va a localStorage, no al servidor. Contarlo
  // inflaría el número y lo volvería falso: son dos poblaciones distintas.
  const fuente = `
    function saveDraft() {
      const snapshot = { customerId: '', paymentTerms: '', vatDefault: '21', lines: [] };
      localStorage.setItem(draftKey(), JSON.stringify(snapshot));
    }
  `;
  const r = censarEnvioPresupuesto(fuente, 'falso.js');
  assert.deepEqual(r.envio, [], 'un objeto que no llega a createQuote no es envío');
  assert.deepEqual(r.linea, []);
});

test('SCRUM-286 · NEGATIVO: un push a OTRO array no cuenta como línea del envío', () => {
  const fuente = `otrasLineas.push({ concept: 'x', qty: 1 });`;
  assert.deepEqual(censarEnvioPresupuesto(fuente, 'falso.js').linea, [],
    'solo cuenta lo que alimenta payloadLines');
});

// ── CONTROL CRUZADO CONTRA LOS CINCO BLOQUES DEL TICKET ──────────────────────
// Norma propia: la lista humana no es censo, pero es la otra mitad del control. Reporta, no
// bloquea — la asignación a bloques es del fundador.
test('SCRUM-286 · el censo, impreso, con su POBLACIÓN declarada', () => {
  const p = CENSO.poblacion;
  console.log(
    `\n📋 SCRUM-286 · censo del ENVÍO de «Nuevo presupuesto»\n` +
    `   POBLACIÓN — fichero:  ${p.fichero}\n` +
    `               frontera: ${p.frontera}\n` +
    `               mide:     ${p.mide}\n` +
    `               excluido: ${p.excluido}\n\n` +
    `   ENVÍO (${CENSO.envio.length}):\n` +
    CENSO.envio.map((c) => `     ${String(c.linea).padStart(4)}  ${c.clave}`).join('\n') +
    `\n\n   POR LÍNEA (${CENSO.linea.length}):\n` +
    CENSO.linea.map((c) => `     ${String(c.linea).padStart(4)}  ${c.clave}`).join('\n') +
    `\n\n   Bloques que enumera el ticket (${BLOQUES_DEL_TICKET.length}): ${BLOQUES_DEL_TICKET.join(' · ')}\n`,
  );
  assert.ok(CENSO.envio.length > 0);
});
