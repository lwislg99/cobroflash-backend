// tests/scrum259-diagnostico-ausencia.test.mjs — SCRUM-259
//
// Demuestra las TRES ramas del diagnóstico de `tenancy-permisos:258` SIN BD ni turno: el
// `diagnosticarAusencia` recibe el prisma INYECTADO, así que un doble sirve cada estado.
//   (a) job VIVO fuera de la lista  → FILTRO
//   (b) job BORRADO                 → alguien borró por debajo (con estado del merchant)
//   (c) el re-read LANZA            → NO COMPROBABLE, y NUNCA se lee como (b)
// Y el último test cumple ROJO-PRIMERO: el mensaje nuevo tiene que verse SALIR de un `assert.fail`
// real (no basta con escribirlo). Se imprime cada mensaje para que sea evidencia, no promesa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticarAusencia, mensajeAusencia } from './_tenancy-diag.mjs';

// Doble del prisma: sirve el job/merchant que le digas; `jobThrows` fuerza que el re-read del Job
// lance (rama c). Escribir NO hace nada: asertamos sobre lo que DEVUELVE el diagnóstico.
const prismaFalso = ({ job = null, jobThrows = false, merchant = null } = {}) => ({
  job: { findUnique: async () => { if (jobThrows) throw new Error('conexión caída'); return job; } },
  merchant: { findUnique: async () => merchant },
});

const opts = { jobId: 7, merchantId: 5, idsLen: 2, ahoraIso: '2026-08-02T10:00:00.000Z' };

test('SCRUM-259 · (a) job VIVO fuera de la lista → FILTRO (no borrado)', async () => {
  const p = prismaFalso({ job: { id: 7, operarioId: 3, merchantId: 5 }, merchant: { id: 5 } });
  const msg = await diagnosticarAusencia(p, opts);
  process.stdout.write(`  (a) → ${msg}\n`);
  assert.match(msg, /\(a\)/);
  assert.match(msg, /FILTRO/);
  assert.match(msg, /operarioId=3/);              // el dato que hace falta para mirar el filtro
  assert.match(msg, /2026-08-02T10:00:00\.000Z/); // (v) la hora del re-read
});

test('SCRUM-259 · (b) job BORRADO + merchant también → apunta a clean-staging', async () => {
  const p = prismaFalso({ job: null, merchant: null }); // findUnique del job devuelve null
  const msg = await diagnosticarAusencia(p, { ...opts, idsLen: 0 });
  process.stdout.write(`  (b) → ${msg}\n`);
  assert.match(msg, /\(b\)/);
  assert.match(msg, /YA NO EXISTE/);
  assert.match(msg, /TAMBIÉN borrado/);   // (iv) distingue "borraron el job" de "el merchant entero"
  assert.match(msg, /clean-staging/);     // nombra el candidato medido
});

test('SCRUM-259 · (b bis) job borrado pero merchant VIVO → borraron el job, no el merchant', async () => {
  const p = prismaFalso({ job: null, merchant: { id: 5 } });
  const msg = await diagnosticarAusencia(p, { ...opts, idsLen: 1 });
  process.stdout.write(`  (b bis) → ${msg}\n`);
  assert.match(msg, /\(b\)/);
  assert.match(msg, /merchant 5 SIGUE vivo/);
});

test('SCRUM-259 · (c) el re-read LANZA → NO COMPROBABLE, y NO se confunde con (b)', async () => {
  const p = prismaFalso({ jobThrows: true });
  const msg = await diagnosticarAusencia(p, { ...opts, idsLen: 1 });
  process.stdout.write(`  (c) → ${msg}\n`);
  assert.match(msg, /\(c\)/);
  assert.match(msg, /NO COMPROBABLE/);
  // el corazón de (iii): "no pude mirar" JAMÁS puede leerse como "no está". El token /YA NO EXISTE/
  // tiene positivo en el test (b) de arriba → este negativo está respaldado (SCRUM-237).
  assert.doesNotMatch(msg, /YA NO EXISTE/);
});

test('SCRUM-259 · ROJO-PRIMERO: el mensaje SALE de un assert.fail real, en las tres ramas', () => {
  const casos = [
    ['a', prismaFalso({ job: { id: 7, operarioId: 3, merchantId: 5 }, merchant: { id: 5 } }), /\(a\).*FILTRO/s],
    ['b', prismaFalso({ job: null, merchant: null }), /\(b\).*YA NO EXISTE/s],
    ['c', prismaFalso({ jobThrows: true }), /\(c\).*NO COMPROBABLE/s],
  ];
  for (const [rama, p, patron] of casos) {
    // reproduce el uso REAL del test gateado: fallar con el diagnóstico dentro del mensaje.
    assert.rejects(
      async () => {
        const diag = await diagnosticarAusencia(p, opts);
        assert.fail(`el técnico debe ver SU Trabajo en la lista — ${diag}`);
      },
      (e) => patron.test(e.message),
      `la rama (${rama}) debe salir DENTRO del mensaje del assert.fail`,
    );
  }
});

// REUTILIZACIÓN (SCRUM-269, «un merchant no ve SU albarán»): mensajeAusencia es NEUTRO de entidad.
// Se usa TAL CUAL para otra entidad — solo cambian `etiqueta` y `contexto`; no hay nada de `job`.
test('SCRUM-259 · mensajeAusencia se reutiliza tal cual para el albarán de SCRUM-269', () => {
  const b = mensajeAusencia({ estado: 'borrado', etiqueta: 'el albarán', id: 42, merchantId: 9, merchantEstado: 'vivo', idsLen: 0 });
  process.stdout.write(`  (269/b) → ${b}\n`);
  assert.match(b, /\(b\) el albarán\(id=42\) YA NO EXISTE/);
  assert.match(b, /merchant 9 SIGUE vivo/);
  const a = mensajeAusencia({ estado: 'existe', etiqueta: 'el albarán', id: 42, merchantId: 9, contexto: 'merchantId=9', idsLen: 3 });
  assert.match(a, /\(a\) el albarán EXISTE \(id=42, merchantId=9\)/);
  assert.match(a, /FILTRO\/consulta/);
  const c = mensajeAusencia({ estado: 'no-comprobable', etiqueta: 'el albarán', id: 42, merchantId: 9, idsLen: 1 });
  assert.match(c, /\(c\) NO COMPROBABLE/);
  assert.doesNotMatch(c, /YA NO EXISTE/); // (c)≠(b) también aquí; token con positivo en el caso (b)
});
