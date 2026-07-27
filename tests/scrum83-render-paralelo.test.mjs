// SCRUM-83 (paso 2 de la escalera) — resolver los PDF del ZIP con concurrencia acotada, sin
// romper nada de lo que el paquete promete (sin gate: corre en `npm test`, no toca BD ni red).
//
// EL DATO QUE MANDA (§7 del ticket): 774 ms por factura, y el 99,8 % es `ensureInvoicePdf` —
// comprimir fueron 24 ms de 15.500. O sea que el cuello es RESOLVER LOS PDF, no el ZIP. De la
// escalera de tres pasos, este es el único que no depende de nada externo: el paso 1 necesita
// el timeout del proxy de Railway y el paso 3 (asíncrono de verdad) necesita almacenamiento
// persistente — verificado: `package.json` no tiene ninguna dependencia de object storage, así
// que hoy no hay dónde dejar el paquete generado.
//
// LO QUE HABÍA QUE NO ROMPER, y por eso cada invariante tiene su test:
//   · el ORDEN de entrada (el ZIP tiene que ser reproducible y `fallidos` legible);
//   · que un PDF roto no se lleve por delante a los 99 buenos;
//   · el TOPE de tareas en vuelo (sin él esto es un `Promise.all` que agota el pool de Prisma
//     y el remedio sale peor que la enfermedad).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as espera } from 'node:timers/promises';

import { mapearConLimite } from '../dist/core/utils/concurrencia.js';
import { EXPORT_PDF_CONCURRENCIA } from '../dist/modules/exports/domain/exportData.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA = path.join(AQUI, '..', 'src', 'modules', 'exports', 'app', 'routes', 'exports.routes.ts');

// ── 1. El orden de entrada se conserva pase lo que pase con los tiempos ───────────────────

test('SCRUM-83 · el resultado sale en orden de ENTRADA, no de finalización', async () => {
  // Tiempos a la contra: el primero es el más lento. Si el helper devolviera por orden de
  // llegada, este caso saldría justo al revés — por eso los tiempos son decrecientes.
  const items = [50, 40, 30, 20, 10, 0];
  const salida = await mapearConLimite(items, 3, async (ms, i) => {
    await espera(ms);
    return `${i}:${ms}`;
  });
  assert.deepEqual(
    salida,
    ['0:50', '1:40', '2:30', '3:20', '4:10', '5:0'],
    '🔴 El orden se ha perdido. En el ZIP eso significa que las facturas entran al paquete en ' +
      'un orden que depende de qué render terminó antes: el mismo export daría ficheros ' +
      'distintos en cada descarga, y la lista de fallidos dejaría de seguir el orden de factura.',
  );
});

// ── 2. El tope se respeta: esto NO es un Promise.all ─────────────────────────────────────

test('SCRUM-83 · nunca hay más de `limite` tareas en vuelo', async () => {
  let enVuelo = 0;
  let pico = 0;
  await mapearConLimite(Array.from({ length: 30 }, (_, i) => i), 4, async () => {
    enVuelo += 1;
    pico = Math.max(pico, enVuelo);
    await espera(5);
    enVuelo -= 1;
  });
  assert.ok(
    pico <= 4,
    `🔴 pico de ${pico} tareas en vuelo con límite 4. Sin tope, 100 facturas son 100 ` +
      `\`ensureInvoicePdf\` a la vez (~300 consultas simultáneas): se agota el pool de Prisma y ` +
      `el arreglo del rendimiento se convierte en una caída para el resto de la app.`,
  );
  assert.equal(pico, 4, 'y debe llegar a 4: si no, no está paralelizando de verdad');
});

test('SCRUM-83 · con menos elementos que el límite no se inventan trabajadores', async () => {
  let pico = 0;
  let enVuelo = 0;
  await mapearConLimite([1, 2], 10, async () => {
    enVuelo += 1; pico = Math.max(pico, enVuelo);
    await espera(5);
    enVuelo -= 1;
  });
  assert.equal(pico, 2);
});

test('SCRUM-83 · un límite absurdo (0) no cuelga la petición', async () => {
  // Con `limite` 0 un bucle mal escrito no arrancaría ningún trabajador y la promesa no se
  // resolvería NUNCA: el export se quedaría colgado sin error, que es peor que ir lento.
  const salida = await mapearConLimite([1, 2, 3], 0, async (n) => n * 2);
  assert.deepEqual(salida, [2, 4, 6]);
});

test('SCRUM-83 · lista vacía: no explota', async () => {
  assert.deepEqual(await mapearConLimite([], 4, async () => 1), []);
});

// ── 3. Un fallo por elemento no se lleva el paquete ──────────────────────────────────────

test('SCRUM-83 · el patrón del export: un PDF roto marca incompleto y los demás siguen', async () => {
  const facturas = ['F-1', 'F-2', 'F-3', 'F-4'];
  const resueltos = await mapearConLimite(facturas, 4, async (numero) => {
    try {
      if (numero === 'F-2') throw new Error('render reventó');
      return { ok: true, numero };
    } catch {
      return { ok: false, numero };
    }
  });
  const listos = resueltos.filter((r) => r.ok).map((r) => r.numero);
  const fallidos = resueltos.filter((r) => !r.ok).map((r) => r.numero);
  assert.deepEqual(listos, ['F-1', 'F-3', 'F-4'], 'los buenos siguen, y en orden');
  assert.deepEqual(fallidos, ['F-2'], 'el roto se anota para poder nombrar el ZIP INCOMPLETO');
});

test('SCRUM-83 · si `fn` rechaza de verdad, el helper NO se lo traga', async () => {
  // Es deliberado: un helper que silencia excepciones hace desaparecer errores que nadie pidió
  // esconder. La tolerancia a fallos se decide en el call-site (arriba), no aquí.
  await assert.rejects(
    () => mapearConLimite([1], 1, async () => { throw new Error('boom'); }),
    /boom/,
  );
});

// ── 4. Ratchet: la ruta usa el mecanismo y no ha vuelto al bucle secuencial ───────────────

test('SCRUM-83 · la ruta del ZIP resuelve los PDF en paralelo acotado', () => {
  const fuente = fs.readFileSync(RUTA, 'utf8');
  assert.ok(fuente.includes('mapearConLimite'), '🔴 la ruta ya no usa el mapeo acotado');
  assert.ok(fuente.includes('EXPORT_PDF_CONCURRENCIA'), '🔴 el límite ya no viene de la constante');
  assert.ok(
    !/for \(const inv of invoices\)/.test(fuente),
    '🔴 ha vuelto el bucle secuencial sobre las facturas: es exactamente el cuello que mide ' +
      'el ticket (774 ms × N, sin enviar un byte).',
  );
  assert.ok(
    EXPORT_PDF_CONCURRENCIA >= 2 && EXPORT_PDF_CONCURRENCIA <= 8,
    `🔴 concurrencia ${EXPORT_PDF_CONCURRENCIA} fuera de rango razonable: por debajo de 2 no ` +
      `paraleliza y por encima de 8 pelea con el resto de la app por el pool de Prisma.`,
  );
});
