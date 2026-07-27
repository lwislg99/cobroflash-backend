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
//
// ⚠️ ADAPTADO el 27-jul-2026 por DECISIÓN DEL FUNDADOR, en la misma fecha y sobre este mismo
// ticket. Este fichero fijaba el contrato anterior —`motivoSinTramo` devolvía un STRING y las
// dos causas compartían código de error— y sus asserts pedían literalmente el texto "condiciones
// de pago". El fundador decidió después que un Trabajo MANUAL/SIN_CONDICIONES **sí debe poder
// facturarse** desde YaQu ("manual" es «yo pacto CUÁNDO cobro», no «yo facturo fuera»), y con
// eso el texto viejo pasó a ser FALSO: "No disponible para estas condiciones de pago" suena a
// «aquí no se factura».
//
// Lo que cambia y lo que NO: la INTENCIÓN de estos tests se conserva entera —que las dos causas
// no se confundan y que ninguna ruta rechace sin explicar—; lo que se actualiza es el contrato
// que comprueban. Se adapta en vez de borrarse: el detector de rutas de abajo es bueno y sigue
// siendo necesario.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBillingPlan, motivoSinTramo } from '../dist/modules/quotes/domain/billingPlan.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(DIR, '..', 'src', 'modules');

test('SCRUM-151: con plan vacío el motivo explica que no hay TRAMOS, y con su propio código', () => {
  // Atado al generador real, no a un [] escrito a mano: si algún día MANUAL empieza a
  // producir tramos, este test lo nota en vez de seguir verde con una premisa muerta.
  for (const terms of ['MANUAL', 'SIN_CONDICIONES']) {
    const plan = getBillingPlan(terms);
    assert.equal(plan.length, 0, `${terms} debería seguir sin plan automático (getBillingPlan → [])`);
    const { error, message } = motivoSinTramo(plan);

    assert.equal(error, 'no_billing_plan', `${terms}: el plan vacío tiene código propio, no el de "ya se emitió todo"`);
    assert.match(message, /tramos automáticos/i, `${terms}: el motivo debe explicar QUÉ pasa, y fue: ${message}`);
    assert.doesNotMatch(
      message, /no queda/i,
      `${terms}: "no queda ningún tramo" es mentira cuando nunca hubo tramos (motivo: ${message})`,
    );
    // Y no puede sonar a "aquí no se factura": el fundador decidió que MANUAL sí debe poder
    // facturarse. Esta línea es la que cambió de sentido respecto a la versión anterior.
    assert.doesNotMatch(message, /no disponible/i, `${terms}: el texto no puede negar la facturación, solo los tramos`);
  }
});

test('SCRUM-151: con plan agotado cada ruta conserva SU código histórico', () => {
  const plan = getBillingPlan('FIFTY_FIFTY');
  assert.equal(plan.length, 2, 'FIFTY_FIFTY debería seguir teniendo 2 tramos');

  const { error, message } = motivoSinTramo(plan);
  assert.equal(error, 'no_more_invoices_for_payment_terms', 'por defecto, el código de la ruta del presupuesto');
  assert.equal(motivoSinTramo(plan, 'nothing_pending').error, 'nothing_pending', 'la ruta de cobrar el resto conserva el suyo');
  assert.match(message, /Ya se han emitido todas las facturas/, 'el caso "ya se emitió todo" dice exactamente eso');
});

test('SCRUM-151: los dos 409 de facturación explican el motivo (no rechazan a secas)', () => {
  const rutas = [
    ['system/app/routes/quotesAdmin.routes.ts', 'no_more_invoices_for_payment_terms'],
    ['jobs/app/routes/jobs.routes.ts', 'nothing_pending'],
  ];
  for (const [rel, code] of rutas) {
    // SIN COMENTARIOS. Este detector busca una llamada por texto, y el comentario que explica
    // la llamada CONTIENE la llamada: sin esto engancha con la prosa y da por cableada una ruta
    // que podría no estarlo. Es la trampa de auto-referencia de SCRUM-129 — cuarta vez hoy.
    const fuente = fs
      .readFileSync(path.join(SRC, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '$1');
    // Se busca la LLAMADA, no el literal del código: desde que `motivoSinTramo` devuelve
    // {error, message} y se esparce, el código de error ya no está escrito en esa línea.
    const linea = fuente.split(String.fromCharCode(10)).find((l) => l.includes('motivoSinTramo(plan'));

    // GUARDA DEL DETECTOR: si la ruta se mueve o el código de error se renombra, este test
    // pasaría en vacío sin comprobar nada — que es indistinguible de "todo correcto".
    assert.ok(linea, `🔴 DETECTOR CIEGO: no se encuentra la llamada a motivoSinTramo en ${rel} (409 '${code}'). Si la ruta se movió, ACTUALIZA este test; no lo borres.`);

    assert.ok(
      linea.includes('res.status(409).json(motivoSinTramo(plan'),
      `\n\n🔴 RECHAZO SIN EXPLICACIÓN en ${rel}\n\n` +
      `El 409 '${code}' contesta sin decirle al pro por qué. Con condiciones MANUAL o\n` +
      `SIN_CONDICIONES el plan viene vacío y "no queda ningún tramo" es directamente falso.\n` +
      `Arreglo: message: motivoSinTramo(plan) — la función distingue los dos casos.\n`,
    );
  }
});
