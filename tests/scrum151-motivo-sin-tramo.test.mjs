// SCRUM-151 — un trabajo con condiciones MANUAL/SIN_CONDICIONES no puede facturarse, y el
// sistema tiene que DECIRLO en vez de rechazar a secas.
//
// LA PREMISA DEL TICKET, CORREGIDA
// --------------------------------
// El ticket daba por hecho que el pro se comía un 409 crudo desde la pantalla. No es así:
// `quotesDetailView.js` ya deshabilita el botón con "No disponible para estas condiciones de
// pago" (rama `else` final), y el héroe del Trabajo no ofrece cobrar porque `remaining` se
// queda a null con el plan vacío. Lo que SÍ estaba mal era el rechazo de la API:
//   · `POST /admin/quotes/:id/invoice` devolvía el 409 pelado, sin una línea de explicación;
//   · el cobro del resto devolvía "No queda ningún tramo por cobrar", que con plan vacío es
//     falso: no es que no quede, es que MANUAL/SIN_CONDICIONES nunca generan tramos.
//
// Sin gate y sin BD: la decisión vive en una función pura y el cableado se comprueba leyendo
// las rutas como TEXTO.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBillingPlan, motivoSinTramo } from '../dist/modules/quotes/domain/billingPlan.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(DIR, '..', 'src', 'modules');

test('SCRUM-151: con plan vacío el motivo habla de las CONDICIONES, no de tramos agotados', () => {
  // Atado al generador real, no a un [] escrito a mano: si algún día MANUAL empieza a
  // producir tramos, este test lo nota en vez de seguir verde con una premisa muerta.
  for (const terms of ['MANUAL', 'SIN_CONDICIONES']) {
    const plan = getBillingPlan(terms);
    assert.equal(plan.length, 0, `${terms} debería seguir sin plan automático (getBillingPlan → [])`);
    const motivo = motivoSinTramo(plan);
    assert.match(motivo, /condiciones de pago/i, `${terms}: el motivo debe explicar QUÉ pasa, y fue: ${motivo}`);
    assert.doesNotMatch(
      motivo, /no queda/i,
      `${terms}: "no queda ningún tramo" es mentira cuando nunca hubo tramos (motivo: ${motivo})`,
    );
  }
});

test('SCRUM-151: con plan agotado el motivo sigue siendo el de siempre', () => {
  const plan = getBillingPlan('FIFTY_FIFTY');
  assert.equal(plan.length, 2, 'FIFTY_FIFTY debería seguir teniendo 2 tramos');
  assert.match(motivoSinTramo(plan), /no queda/i, 'el caso "ya se emitió todo" no cambia de texto');
});

test('SCRUM-151: los dos 409 de facturación explican el motivo (no rechazan a secas)', () => {
  const rutas = [
    ['system/app/routes/quotesAdmin.routes.ts', 'no_more_invoices_for_payment_terms'],
    ['jobs/app/routes/jobs.routes.ts', 'nothing_pending'],
  ];
  for (const [rel, code] of rutas) {
    const fuente = fs.readFileSync(path.join(SRC, rel), 'utf8');
    const linea = fuente.split('\n').find((l) => l.includes(`error: '${code}'`));

    // GUARDA DEL DETECTOR: si la ruta se mueve o el código de error se renombra, este test
    // pasaría en vacío sin comprobar nada — que es indistinguible de "todo correcto".
    assert.ok(linea, `🔴 DETECTOR CIEGO: no se encuentra el 409 '${code}' en ${rel}. Si la ruta se movió, ACTUALIZA este test; no lo borres.`);

    assert.ok(
      linea.includes('motivoSinTramo(plan)'),
      `\n\n🔴 RECHAZO SIN EXPLICACIÓN en ${rel}\n\n` +
      `El 409 '${code}' contesta sin decirle al pro por qué. Con condiciones MANUAL o\n` +
      `SIN_CONDICIONES el plan viene vacío y "no queda ningún tramo" es directamente falso.\n` +
      `Arreglo: message: motivoSinTramo(plan) — la función distingue los dos casos.\n`,
    );
  }
});
