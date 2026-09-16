// tests/scrum324-justificante-deducible.test.mjs — SCRUM-324 (E3)
//
// UN TICKET NO DEDUCE IVA, Y UNA FACTURA COMPLETA NO PUEDE DISPARAR EL AVISO.
//
// ── DE DÓNDE SALE ───────────────────────────────────────────────────────────────────────────
// El diseño v1 de E3 vendía la foto del ticket como «la que más euros le devuelve al bolsillo».
// **Es legalmente falso:** un ticket o factura simplificada NO permite deducir el IVA soportado,
// salvo simplificada CUALIFICADA — con el **NIF DEL DESTINATARIO** (el del profesional, no el del
// proveedor) y la **cuota desglosada**. La v1 listaba el NIF del proveedor, que es otro campo.
//
// Sin estos tests, el flujo estrella capturaría justificantes mayoritariamente no deducibles y el
// producto acabaría diciéndole a un fontanero cuánto se ahorra cuando no se ahorra nada.
//
// Sin gate: funciones puras sobre `dist/`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clasificarJustificante, avisaDeSimplificado, aCentimos,
  VEREDICTO, FALTA, INCOHERENCIA, TOLERANCIA_CENTIMOS,
} from '../dist/modules/expenses/domain/justificante.js';

/** Una factura COMPLETA: todo lo comprobable presente y el papel ya confirmado. */
const COMPLETA = {
  amount: '121.00',
  date: new Date('2026-08-10T10:00:00Z'),
  nifProveedor: 'B12345678',
  vatRate: 21,
  vatAmount: '21.00',
  providerInvoiceNumber: 'F-2026/0912',
  vatDeducible: true,
};

/** El ticket del almacén: importe, y poco más. Es el caso REAL del flujo estrella. */
const TICKET = {
  amount: '121.00',
  date: new Date('2026-08-10T10:00:00Z'),
  nifProveedor: null,
  vatRate: null,
  vatAmount: null,
  providerInvoiceNumber: null,
  vatDeducible: null,
};

test('SCRUM-324 · el ticket del almacén NO deduce, y dice exactamente qué le falta', () => {
  const c = clasificarJustificante(TICKET);
  assert.equal(c.veredicto, VEREDICTO.NO_DEDUCIBLE);
  // No basta con «no deduce»: el ahorro está en saber QUÉ pedir la próxima vez en el mostrador.
  assert.deepEqual(c.faltan.sort(), [
    FALTA.CUOTA_DESGLOSADA, FALTA.NIF_PROVEEDOR, FALTA.NUMERO_FACTURA_PROVEEDOR,
  ].sort());
  assert.equal(avisaDeSimplificado(c), true);
});

test('SCRUM-324 · CONTROL NEGATIVO: una factura completa NO dispara el aviso', () => {
  // 🔴 ES EL TEST QUE DECIDE SI ESTO VALE. Un aviso que salta siempre se aprende a ignorar, y
  // entonces no hemos construido una ayuda: hemos construido ruido. Lo exige el ticket.
  const c = clasificarJustificante(COMPLETA);
  assert.equal(c.veredicto, VEREDICTO.DEDUCIBLE);
  assert.deepEqual(c.faltan, []);
  assert.equal(avisaDeSimplificado(c), false,
    '🔴 el aviso salta con una factura completa: eso es ruido, y el usuario aprende a ignorarlo');
});

test('SCRUM-324 · lo que el sistema NO puede saber no se inventa: tercer veredicto', () => {
  // Si el papel lleva o no el NIF del profesional no está en ningún campo. Darlo por SÍ es el error
  // legal de la v1; darlo por NO convierte el aviso en ruido. Se dice que falta confirmarlo.
  const c = clasificarJustificante({ ...COMPLETA, vatDeducible: null });
  assert.equal(c.veredicto, VEREDICTO.FALTA_CONFIRMAR);
  assert.deepEqual(c.faltan, [FALTA.NIF_DESTINATARIO_EN_EL_DOCUMENTO]);
  assert.equal(avisaDeSimplificado(c), false,
    '🔴 «falta confirmar» no es «no deducible»: avisar aquí sería acusar sin saber');
});

test('SCRUM-324 · una decisión humana de NO deducible no la reabre el sistema', () => {
  const c = clasificarJustificante({ ...COMPLETA, vatDeducible: false });
  assert.equal(c.veredicto, VEREDICTO.NO_DEDUCIBLE);
});

test('SCRUM-324 · sin NIF del proveedor no entra como deducible EN SILENCIO', () => {
  // Verificación exigida por el ticket: o se avisa, o se marca incompleto. Nunca callar.
  const c = clasificarJustificante({ ...COMPLETA, nifProveedor: null });
  assert.equal(c.veredicto, VEREDICTO.NO_DEDUCIBLE);
  assert.ok(c.faltan.includes(FALTA.NIF_PROVEEDOR));
  assert.equal(avisaDeSimplificado(c), true);
});

test('SCRUM-324 · el NIF en blanco es lo mismo que no tenerlo', () => {
  for (const vacio of ['', '   ', null, undefined]) {
    const c = clasificarJustificante({ ...COMPLETA, nifProveedor: vacio });
    assert.ok(c.faltan.includes(FALTA.NIF_PROVEEDOR),
      `🔴 con nifProveedor=${JSON.stringify(vacio)} el gasto pasa como si tuviera NIF`);
  }
});

// ── Familia SCRUM-271: Number('') es 0, y 0 || 1 es 1 ───────────────────────────────────────

test('SCRUM-324 · un gasto SIN importe no se convierte en un gasto de 0 €', () => {
  // `Number('')` es 0. Si el vacío se colara como cero, un gasto sin importe entraría en los
  // totales como un apunte legítimo de 0 € en vez de declararse incompleto.
  assert.equal(aCentimos(''), null);
  assert.equal(aCentimos('   '), null);
  assert.equal(aCentimos(null), null);
  assert.equal(aCentimos(undefined), null);
  assert.equal(aCentimos('no soy un número'), null);

  const c = clasificarJustificante({ ...COMPLETA, amount: '' });
  assert.ok(c.faltan.includes(FALTA.IMPORTE),
    '🔴 un gasto sin importe no se declara incompleto: se ha convertido en otra cosa por el camino');
});

test('SCRUM-324 · un importe de CERO es un cero, no un hueco', () => {
  // El otro lado del mismo filo: si «0» se tratara como vacío, un gasto de 0 € sería indistinguible
  // de uno sin rellenar, y son dos hechos distintos.
  assert.equal(aCentimos('0'), 0);
  assert.equal(aCentimos(0), 0);
  const c = clasificarJustificante({ ...COMPLETA, amount: '0', vatAmount: '0', vatRate: 0 });
  assert.ok(!c.faltan.includes(FALTA.IMPORTE),
    '🔴 un importe de 0 € se está tratando como «falta el importe»');
});

test('SCRUM-324 · los céntimos no pasan por la coma flotante', () => {
  assert.equal(aCentimos('0.07'), 7);
  assert.equal(aCentimos('121.10'), 12110);
  assert.equal(aCentimos('1234.56'), 123456);
});

// ── El tipo de IVA: la trampa que el propio schema avisa ────────────────────────────────────

test('SCRUM-324 · un tipo de IVA en FRACCIÓN se declara, no se traga', () => {
  // `vatRate` es entero de porcentaje (21/10/4/0) — convención de `AlbaranLinea.tipoIva`. La otra
  // convención viva del repo es la fracción de `Quote.lines[].tax` (0.21). Mezclarlas multiplica el
  // IVA por CIEN sin que nada falle, y el comentario del schema lo avisa por escrito.
  const c = clasificarJustificante({ ...COMPLETA, vatRate: 0.21 });
  assert.ok(c.incoherencias.includes(INCOHERENCIA.TIPO_IVA_PARECE_FRACCION),
    '🔴 un 0,21 donde se espera 21 pasa sin decir nada: es el IVA multiplicado por cien');
});

test('SCRUM-324 · la cuota que no cuadra con el total se declara', () => {
  const c = clasificarJustificante({ ...COMPLETA, vatAmount: '30.00' }); // 121 total, 21% → ~21
  assert.ok(c.incoherencias.includes(INCOHERENCIA.CUOTA_NO_CUADRA_CON_EL_TOTAL));
});

test('SCRUM-324 · un céntimo de diferencia NO es un descuadre', () => {
  // El programa del proveedor redondea a su manera. Sin tolerancia, esto sería la fábrica de falsos
  // rojos, y un aviso que salta sin motivo acaba tan ignorado como uno que no salta nunca.
  assert.equal(TOLERANCIA_CENTIMOS, 1);
  const c = clasificarJustificante({ ...COMPLETA, vatAmount: '21.01' });
  assert.deepEqual(c.incoherencias, [],
    '🔴 un céntimo de redondeo se marca como descuadre: eso es la fábrica de falsos rojos');
});

test('SCRUM-324 · una incoherencia NO cambia el veredicto, solo se declara', () => {
  // Misma doctrina que `payment-anomaly` (A21.2): se ANOTA, no se corrige ni se decide nada.
  const c = clasificarJustificante({ ...COMPLETA, vatAmount: '30.00' });
  assert.equal(c.veredicto, VEREDICTO.DEDUCIBLE);
  assert.ok(c.incoherencias.length > 0);
});

// ── El duplicado, que es la vida real ───────────────────────────────────────────────────────

test('SCRUM-324 · el mismo ticket clasificado dos veces da lo mismo, y pasa siempre', () => {
  // Verificación exigida: el mismo ticket fotografiado dos veces desde la furgoneta PASA SIEMPRE.
  // Esta función no deduplica ni puede: clasificar no es dar de alta. Se fija aquí para que nadie
  // meta un «ya lo vi» dentro de una clasificación, que es donde jamás debe estar.
  const a = clasificarJustificante(TICKET);
  const b = clasificarJustificante({ ...TICKET });
  assert.deepEqual(a, b);
  assert.equal(a.veredicto, b.veredicto);
});

// ── SUELO ───────────────────────────────────────────────────────────────────────────────────

test('SCRUM-324 · SUELO: los tres veredictos son alcanzables', () => {
  // Si el módulo devolviera siempre lo mismo, todos los tests de arriba podrían seguir en verde
  // menos uno, y el aviso sería una constante disfrazada de decisión.
  const vistos = new Set([
    clasificarJustificante(COMPLETA).veredicto,
    clasificarJustificante(TICKET).veredicto,
    clasificarJustificante({ ...COMPLETA, vatDeducible: null }).veredicto,
  ]);
  assert.equal(vistos.size, 3,
    `🔴 solo se alcanzan ${vistos.size} veredictos de 3: la clasificación no está discriminando`);
});

test('SCRUM-324 · SUELO: quitar la captura del NIF cae NOMBRÁNDOLA', () => {
  // El ticket lo exige literalmente: «quita la captura del NIF y el test cae nombrándola».
  const c = clasificarJustificante({ ...COMPLETA, nifProveedor: null });
  assert.ok(
    c.faltan.includes(FALTA.NIF_PROVEEDOR),
    `🔴 sin NIF del proveedor la clasificación no lo nombra. Devolvió: ${JSON.stringify(c.faltan)}. `
    + 'Un «incompleto» que no dice QUÉ falta no sirve de nada en el mostrador del almacén.');
});
