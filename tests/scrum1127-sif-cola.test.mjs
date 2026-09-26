// tests/scrum1127-sif-cola.test.mjs — SCRUM-1127 · las decisiones puras de la cola de remisión.
//
// Sin base (la tabla `VfSubmission` NO existe: ver `docs/master/SCRUM-1127.md`) y sin red.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cola = require(path.join(RAIZ, 'dist/modules/fiscal/verifactu/sif.cola.js'));
const { MAX_REGISTROS_POR_ENVIO } = require(path.join(RAIZ, 'dist/modules/fiscal/verifactu/registro.builder.js'));

const REG = { idEmisorFactura: 'B00000000', numSerieFactura: 'F-1', fechaExpedicionFactura: '25-09-2026', tipoOperacion: 'Alta' };
const noEnviado = { tipo: 'no_enviado', etapa: 'conectar', motivo: 'ECONNREFUSED', ms: 3 };

test('SCRUM-1127 · trocear: como mucho 1.000 por envío, el tope del XSD y del builder', () => {
  assert.equal(MAX_REGISTROS_POR_ENVIO, 1000);
  const n = 2 * MAX_REGISTROS_POR_ENVIO + 1;
  const lotes = cola.trocear(Array.from({ length: n }, (_, i) => i));
  assert.deepEqual(lotes.map((l) => l.length), [MAX_REGISTROS_POR_ENVIO, MAX_REGISTROS_POR_ENVIO, 1]);
  assert.deepEqual(lotes.flat(), Array.from({ length: n }, (_, i) => i), 'se pierde o se reordena algo');
  assert.deepEqual(cola.trocear([]), []);
  assert.throws(() => cola.trocear([1], MAX_REGISTROS_POR_ENVIO + 1), /verifactu_tamano_de_lote_invalido/);
  assert.throws(() => cola.trocear([1], 0), /verifactu_tamano_de_lote_invalido/);
});

test('SCRUM-1127 · flujo de control: nunca menos de 60 s, y si la AEAT pide más, lo que pide', () => {
  assert.equal(cola.ESPERA_MINIMA_S, 60);
  assert.equal(cola.esperaSiguienteEnvio(null), 60);
  assert.equal(cola.esperaSiguienteEnvio(0), 60);
  assert.equal(cola.esperaSiguienteEnvio(30), 60);
  assert.equal(cola.esperaSiguienteEnvio(120), 120);
  assert.equal(cola.esperaSiguienteEnvio(Number.NaN), 60);
});

test('SCRUM-1127 · backoff: 60, 120, 240, 480… con techo', () => {
  assert.deepEqual([1, 2, 3, 4].map(cola.backoffS), [60, 120, 240, 480]);
  assert.equal(cola.backoffS(50), cola.BACKOFF_TOPE_S);
  assert.equal(cola.backoffS(0), 60);
});

test('SCRUM-1127 · lo que no sabemos si llegó se reintenta, y al 5º intento pasa a una persona', () => {
  assert.equal(cola.MAX_INTENTOS, 5);
  const seguir = [];
  for (let previos = 0; previos < cola.MAX_INTENTOS; previos += 1) {
    const d = cola.decidirTrasEnvio([{ registro: REG, intentosPrevios: previos }], noEnviado).registros[0];
    seguir.push(d.estado);
    assert.equal(d.intentos, previos + 1);
    assert.equal(d.lastError, 'no_enviado:conectar:ECONNREFUSED');
  }
  assert.deepEqual(seguir, ['pending', 'pending', 'pending', 'pending', 'manual_review']);
  const ultimo = cola.decidirTrasEnvio([{ registro: REG, intentosPrevios: 4 }], noEnviado).registros[0];
  assert.equal(ultimo.requierePersona, true);
  assert.equal(ultimo.reintentarEnS, null);
});

test('SCRUM-1127 · un registro que se quedó en «sent» NO está aceptado: vuelve a la cola', () => {
  const d = cola.recuperarEnviadoSinCierre(REG, 0);
  assert.equal(d.estado, 'pending');
  assert.match(d.lastError, /^sin_respuesta:/);
  assert.equal(cola.recuperarEnviadoSinCierre(REG, 4).estado, 'manual_review');
});

test('SCRUM-1127 · los estados son los de la FSM de SIF_SPEC_NOTES §6, y ninguno más', () => {
  assert.deepEqual([...cola.ESTADOS_VF_SUBMISSION], ['pending', 'sent', 'accepted', 'rejected', 'manual_review']);
});

test('SCRUM-1127 · alta y anulación de la MISMA factura son registros distintos', () => {
  const anulacion = { ...REG, tipoOperacion: 'Anulacion' };
  assert.notEqual(cola.clave(REG), cola.clave(anulacion));
  const respondido = {
    tipo: 'respondido', httpStatus: 200, ms: 1,
    respuesta: {
      estadoEnvio: 'Correcto', csv: 'A-X', tiempoEsperaEnvioS: 60,
      lineas: [{ ...REG, estadoRegistro: 'Correcto', codigoError: null, descripcionError: null, duplicado: null }],
    },
  };
  const d = cola.decidirTrasEnvio([{ registro: REG, intentosPrevios: 0 }, { registro: anulacion, intentosPrevios: 0 }], respondido);
  assert.deepEqual(d.registros.map((r) => r.estado), ['accepted', 'pending'],
    '🔴 la línea del alta no puede dar por aceptada la anulación');
});
