// SCRUM-195 (rebanada 2) · LA LECTURA DEJA DE ENSEÑAR SOLO EL PRESUPUESTO ORIGINAL.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS TRES SITIOS, Y POR QUÉ NINGUNO SALTABA
//
//   · `serializeJob`      — `remaining` salía solo del original: un adicional aceptado y no
//                           cobrado NO contaba como pendiente. El pro veía MENOS deuda de la
//                           que tiene.
//   · el detalle          — `invoices[]` y la condición de corte miraban `job.quoteId`: las
//                           facturas del adicional no aparecían.
//   · `collect-rest`      — 🔴 EL TRAMPA. `if (!job.quoteId) return 409 job_without_quote` NO
//                           salta con 1:N, porque `job.quoteId` sigue apuntando al original.
//                           Cobraba el resto del original e ignoraba el adicional: fallaba de
//                           MENOS, callando. Y con el original ya cobrado entero, respondía
//                           `nothing_pending` — el pro no podía cobrar lo que le deben.
//
// LOS DOS SENTIDOS SIGUEN VIVOS (paso 1: `Job.quoteId` no se retira), y por eso hay tests de
// convivencia: entre mergear esto y correr el backfill hay una ventana real.
//
// SIN GATE Y CON DOBLES: se prueba la DECISIÓN (qué presupuestos entran, cuál se cobra, cuánto
// queda pendiente), que es donde vive el defecto. La forma HTTP la cubren los tests gateados.

import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveBillingPlan } from '../dist/modules/quotes/domain/billingPlan.js';

// ── EL CRITERIO SE IMPORTA, NO SE COPIA ─────────────────────────────────────────────────
//
// La primera version de este fichero REIMPLEMENTABA aqui el orden, la seleccion y la suma para
// poder probarlos sin levantar la app. Eso no prueba el criterio: prueba la copia. El dia que
// la ruta se desviara, estos tests seguirian verdes -- el defecto de los dos arneses que
// desmontaron SCRUM-198 y SCRUM-216.
//
// Ahora el criterio vive en `presupuestosDelTrabajo.ts`, la ruta lo usa y el test importa EL
// MISMO. `resolveBillingPlan` tambien es el de produccion, inyectado como lo hace la ruta.
import {
  ordenarPresupuestos,
  primeroConTramoPendiente,
  restanteDelTrabajo as restanteDelModulo,
} from '../dist/modules/jobs/domain/presupuestosDelTrabajo.js';

const primeroConPendiente = (quotes, quoteIdDelJob) =>
  primeroConTramoPendiente(quotes, quoteIdDelJob, resolveBillingPlan);
const restanteDelTrabajo = (quotes) => restanteDelModulo(quotes, resolveBillingPlan);

const Q = (over = {}) => ({
  id: 1, total: '1000.00', currency: 'EUR', paymentTerms: 'FIFTY_FIFTY', // el código real del módulo; '50_50' no existe y daría plan vacío
  customBillingPlan: null, lines: [], Invoice: [], ...over,
});

// ═════════════════════════════════════════════════════════════════════════════
// 🔴 collect-rest — EL QUE IMPORTA
// ═════════════════════════════════════════════════════════════════════════════

test('🔴 con el ORIGINAL ya cobrado entero y un ADICIONAL pendiente, SÍ hay qué cobrar', () => {
  // Éste es el caso que antes devolvía `nothing_pending`: el guard preguntaba por el
  // presupuesto equivocado y el pro no podía cobrar lo que le deben.
  const original = Q({ id: 7, Invoice: [{ id: 1 }, { id: 2 }] }); // plan 50/50, las dos emitidas
  const adicional = Q({ id: 9, total: '200.00', Invoice: [] });

  const elegido = primeroConPendiente([original, adicional], 7);

  assert.ok(elegido, '🔴 respondería «nothing_pending» con un adicional pendiente de cobro');
  assert.equal(elegido.id, 9, 'tiene que cobrarse el ADICIONAL, que es el que queda');
});

test('🔴 con el original PENDIENTE, se cobra el original — el adicional espera su turno', () => {
  const original = Q({ id: 7, Invoice: [{ id: 1 }] }); // 50/50: queda un tramo
  const adicional = Q({ id: 9, total: '200.00' });
  assert.equal(primeroConPendiente([original, adicional], 7).id, 7);
});

test('🔴 el orden es DETERMINISTA: pulsar dos veces no cambia de presupuesto', () => {
  const a = Q({ id: 9, total: '200.00' });
  const b = Q({ id: 5, total: '300.00' });
  const original = Q({ id: 7, Invoice: [{ id: 1 }, { id: 2 }] });
  // Da igual en qué orden lleguen de la BD: el criterio ordena.
  assert.equal(primeroConPendiente([a, original, b], 7).id, 5, 'adicionales por id ascendente');
  assert.equal(primeroConPendiente([b, a, original], 7).id, 5, 'el mismo, venga como venga');
});

test('🔴 sin NINGÚN presupuesto pendiente sigue sin haber nada que cobrar', () => {
  const original = Q({ id: 7, Invoice: [{ id: 1 }, { id: 2 }] });
  const adicional = Q({ id: 9, total: '200.00', Invoice: [{ id: 3 }, { id: 4 }] });
  assert.equal(primeroConPendiente([original, adicional], 7), null);
});

test('🔴 CONVIVENCIA · un Trabajo con solo el original (sin backfill) se comporta como siempre', () => {
  const original = Q({ id: 7, Invoice: [{ id: 1 }] });
  assert.equal(primeroConPendiente([original], 7).id, 7);
});

test('🔴 un Trabajo MANUAL (SCRUM-51) con un adicional colgado sí tiene qué cobrar', () => {
  // `job.quoteId` es null: el guard viejo habría devuelto `job_without_quote` y cerrado la
  // puerta a un cobro legítimo. Con el conjunto, la pregunta correcta es «¿hay alguno?».
  const adicional = Q({ id: 9, total: '200.00' });
  assert.equal(primeroConPendiente([adicional], null).id, 9);
});

// ═════════════════════════════════════════════════════════════════════════════
// serializeJob · `remaining` suma todos los presupuestos
// ═════════════════════════════════════════════════════════════════════════════

test('remaining SUMA el adicional: el pro veía menos deuda de la que tiene', () => {
  const original = Q({ id: 7, total: '1000.00', Invoice: [{ id: 1 }] }); // 50/50 → queda 500
  const adicional = Q({ id: 9, total: '200.00' });                        // 50/50 → quedan 200
  assert.equal(restanteDelTrabajo([original, adicional]), 700,
    '🔴 el pendiente del Trabajo no cuenta el adicional');
});

test('remaining con el adicional YA cobrado no lo suma dos veces', () => {
  const original = Q({ id: 7, total: '1000.00', Invoice: [{ id: 1 }] });
  const adicional = Q({ id: 9, total: '200.00', Invoice: [{ id: 3 }, { id: 4 }] });
  assert.equal(restanteDelTrabajo([original, adicional]), 500);
});

test('CONVIVENCIA · con un solo presupuesto el importe es EXACTAMENTE el de antes', () => {
  // El cambio no puede mover el número en el caso 1:1, que es el 100 % de los Trabajos de hoy.
  const original = Q({ id: 7, total: '1000.00', Invoice: [{ id: 1 }] });
  assert.equal(restanteDelTrabajo([original]), 500);
});

test('un Trabajo sin presupuestos no tiene pendiente', () => {
  assert.equal(restanteDelTrabajo([]), 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// El detalle · las facturas de TODOS los presupuestos, por fecha
// ═════════════════════════════════════════════════════════════════════════════

test('invoices[] junta las de todos los presupuestos y las ordena por fecha', () => {
  const detalles = new Map([
    [7, { id: 7, Invoice: [{ id: 1, createdAt: '2026-03-01' }, { id: 2, createdAt: '2026-05-01' }] }],
    [9, { id: 9, Invoice: [{ id: 3, createdAt: '2026-04-01' }] }],
  ]);
  const orden = [{ id: 7 }, { id: 9 }]
    .flatMap((q) => detalles.get(q.id)?.Invoice ?? [])
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((i) => i.id);

  assert.deepEqual(orden, [1, 3, 2],
    '🔴 la factura del adicional no aparece, o aparece fuera de su sitio en el timeline');
});
