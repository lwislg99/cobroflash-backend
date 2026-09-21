// tests/scrum862-el-fallo-entra-en-el-denominador.test.mjs — SCRUM-862
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 CON 9 FALLOS DE 10 LA PANTALLA ENSEÑA 100 % Y LA ALERTA CALLA
//
// `SENT_OR_MORE = {sent, delivered, read}` y `DELIVERED_OR_MORE = {delivered, read}`. El estado
// `failed` **no está en ninguno de los dos**, así que un mensaje fallido no entra en el
// denominador de la tasa. La «tasa de entrega» no mide entregas sobre INTENTOS: mide entregas
// sobre los que no fallaron, y por construcción NO PUEDE BAJAR por culpa de un fallo.
//
// Medido sobre el servicio real antes de tocar nada (hallazgo de SCRUM-530, `P1-WA-TASA`):
//
//     1 entregado + 9 fallidos  →  sample 1 · tasa 100 % · alerta APAGADA
//
// ── ⛔ LO QUE NO SE TOCA, Y ES LA MITAD DEL TICKET ───────────────────────────────────────────
//
// Lo obvio —meter `failed` en `SENT_OR_MORE`— ROMPE una cifra que hoy es correcta: `month.sent`
// pasaría de 1 a 10 y la tarjeta enseñaría «Enviados 10 · Fallidos 9», contando los mismos nueve
// dos veces. Los KPI del mes ya muestran los fallos APARTE y están bien. Así que el arreglo va
// sólo en el DENOMINADOR de las dos tasas, y este fichero lo sujeta por los dos lados.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const AHORA = new Date('2026-09-16T12:00:00Z');
const AYER = new Date(AHORA.getTime() - 86400000);

const fila = (status) => ({ status, templateName: 'quote_decision_es', createdAt: AYER, costEstimate: 0.023 });
const n = (k, s) => Array(k).fill(0).map(() => fila(s));

/** Llama al servicio REAL con la base doblada. Ni una base, ni una clave, ni un byte de red. */
async function metricas(filas) {
  const fP = requiere.resolve(path.join(RAIZ, 'dist/core/db/prisma.js'));
  const fS = requiere.resolve(path.join(RAIZ, 'dist/modules/messaging/domain/whatsappLog.service.js'));
  requiere.cache[fP] = {
    id: fP, filename: fP, loaded: true,
    exports: { prisma: { whatsAppMessage: { findMany: async () => filas } } },
  };
  delete requiere.cache[fS];
  const { getWhatsAppMetrics } = requiere(fS);
  return getWhatsAppMetrics(4242, AHORA);
}

// ═══ SUELO ═══════════════════════════════════════════════════════════════════════════════════

test('SCRUM-862 · 🔴 SUELO: hay envíos que examinar, o el banco se declara CIEGO', async () => {
  const m = await metricas([...n(1, 'delivered'), ...n(9, 'failed')]);
  assert.notEqual(m.month.total, 0,
    '🔴 CIEGO: el servicio no ha visto NI UN mensaje, así que cualquier cosa que diga la tasa no '
    + 'distingue el defecto de un doble que no da datos. Vacío y no-medido se leen igual.');
  assert.equal(m.month.failed, 9, 'y ve los nueve fallos: el doble está dando lo que se le pide');
});

// ═══ 🔴 EL QUE DECIDE ════════════════════════════════════════════════════════════════════════

test('SCRUM-862 · 🔴 EL QUE DECIDE: 1 entregado + 9 fallidos → muestra 10, tasa 10 %, alerta ACTIVA', async () => {
  const m = await metricas([...n(1, 'delivered'), ...n(9, 'failed')]);
  assert.equal(m.alert.sample, 10,
    `🔴 la muestra de 7 días vale ${m.alert.sample}: los nueve fallos no entran en el denominador, `
    + 'así que un desastre de entrega parece una semana tranquila con un solo envío.');
  assert.equal(m.alert.deliveryRate7d, 10,
    `🔴 LA PANTALLA ENSEÑA ${m.alert.deliveryRate7d} % CON 9 FALLOS DE 10. La tasa de entrega no `
    + 'puede bajar por culpa de un fallo, que es exactamente lo único que debería hacerla bajar.');
  assert.equal(m.alert.active, true,
    '🔴 y la alerta sigue APAGADA con el 10 % de entrega: el profesional no se entera de nada.');
});

test('SCRUM-862 · 🔴 la tasa POR PLANTILLA tiene el mismo agujero, y en la misma tarjeta', async () => {
  const m = await metricas([...n(1, 'delivered'), ...n(9, 'failed')]);
  const t = m.byTemplate.find((x) => x.templateName === 'quote_decision_es');
  assert.ok(t, '🔴 CIEGO: no hay fila de plantilla que mirar');
  assert.equal(t.deliveryRate, 10,
    `🔴 la tabla por plantilla dice ${t.deliveryRate} % de entrega con 9 fallos de 10. Dejarla `
    + 'mal mientras la alerta dice 10 % pondría DOS cifras que se contradicen en la MISMA tarjeta.');
});

// ═══ ✅ POSITIVO — si esto se mueve, he tocado algo que estaba bien ═══════════════════════════

test('SCRUM-862 · ✅ POSITIVO: 20 enviados / 10 entregados sigue en 50 % y sigue alertando', async () => {
  const m = await metricas([...n(10, 'delivered'), ...n(10, 'sent')]);
  assert.equal(m.alert.sample, 20, 'la muestra no se mueve: no hay fallos que sumar');
  assert.equal(m.alert.deliveryRate7d, 50, 'la tasa no se mueve');
  assert.equal(m.alert.active, true, 'y sigue alertando, como antes');
});

// ═══ ✅ NEGATIVO — un arreglo que alerte a todo el mundo se apaga en una semana ════════════════

test('SCRUM-862 · ✅ NEGATIVO: todo entregado sigue en 100 % y SIN alerta', async () => {
  const m = await metricas(n(12, 'delivered'));
  assert.equal(m.alert.deliveryRate7d, 100, 'sin fallos, la tasa es 100 %');
  assert.equal(m.alert.active, false,
    '🔴 se estaría alertando a un merchant con entrega perfecta: eso es lo que hace que la gente '
    + 'apague los avisos, y entonces no protegen a nadie.');
});

// ═══ ⛔ LA CIFRA QUE NO SE PUEDE MOVER ════════════════════════════════════════════════════════

test('SCRUM-862 · ⛔ los KPI del MES no se tocan: `sent` y `failed` siguen separados', async () => {
  const m = await metricas([...n(1, 'delivered'), ...n(9, 'failed')]);
  assert.equal(m.month.sent, 1,
    `🔴 \`month.sent\` vale ${m.month.sent}. Si los fallos entran aquí, la tarjeta enseña `
    + '«Enviados 10 · Fallidos 9» contando los mismos nueve DOS VECES. Esta cifra hoy es correcta '
    + 'y el arreglo del denominador no puede llevársela por delante.');
  assert.equal(m.month.failed, 9, 'los fallos se siguen viendo aparte, que es lo que los hace útiles');
  assert.equal(m.month.total, 10, 'y el total sigue siendo todas las filas');
});

// ═══ El vacío no se convierte en un cero mentiroso ════════════════════════════════════════════

test('SCRUM-862 · sin ningún mensaje la tasa es `null`, no 0 %', async () => {
  const m = await metricas([]);
  assert.equal(m.alert.deliveryRate7d, null,
    'una semana sin envíos no tiene tasa. Un 0 % ahí sería un desastre inventado, y es la misma '
    + 'familia que «un CERO no es está limpio, es no he mirado».');
  assert.equal(m.alert.active, false, 'y no se alerta sobre la nada');
});
