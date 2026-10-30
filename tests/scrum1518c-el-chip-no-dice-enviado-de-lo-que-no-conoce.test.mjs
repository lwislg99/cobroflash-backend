// tests/scrum1518c-el-chip-no-dice-enviado-de-lo-que-no-conoce.test.mjs
//
// SCRUM-1518c · el chip de WhatsApp (`waDeliveryChip`, api.js) pintaba «WhatsApp: Enviado» para
// CUALQUIER estado que no conocía (`map[status] || map.sent`). El único alcanzable hoy es `received`,
// el de los mensajes que escribe el CLIENTE: así, lo que dijo él salía como si lo hubiéramos mandado
// nosotros. #2688 (1518b) ya los saca de la pestaña de la ficha; esto es la otra mitad, la del chip.
//
// El criterio es el de 1518b: lo que no es un envío que conocemos no se enseña como envío. El chip
// devuelve '' —su respuesta de siempre para «no hay envío», que los cuatro llamadores ya tratan— y no
// estrena ningún rótulo (regla 39).
//
// Control: los cinco estados que SÍ conoce siguen diciendo lo mismo. Sin él, «no decir Enviado
// nunca» pasaría este test, y es la mentira contraria.
//
// Se mide sobre el `api.js` de verdad, cargado en el banco de vistas, no sobre una copia.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const chip = (w, o) => cargarDashboard(RAIZ, { datos: () => ({}) }).ctx.waDeliveryChip(w, o);

const CONOCIDOS = {
  queued: 'En cola',
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leído',
  failed: 'No entregado',
};

test('SCRUM-1518c · control: un envío nuestro de verdad sigue diciendo «Enviado», y los otros cuatro su rótulo', () => {
  for (const [status, rotulo] of Object.entries(CONOCIDOS)) {
    for (const opciones of [undefined, { sinFecha: true }]) {
      const html = chip({ status, templateName: 'presupuesto_enviado', at: '2026-10-29T10:00:00Z' }, opciones);
      assert.ok(html.includes(`WhatsApp: ${rotulo}`), `🔴 «${status}» ya no pinta «WhatsApp: ${rotulo}»: ${html}`);
    }
  }
});

test('SCRUM-1518c · lo que escribe el CLIENTE (`received`) no sale como un envío nuestro', () => {
  const html = chip({ status: 'received', templateName: null, at: '2026-10-29T10:00:00Z' });
  assert.equal(html, '', `🔴 un mensaje del cliente pinta chip: ${html}`);
});

test('SCRUM-1518c · ningún estado que el chip no conoce se pinta «Enviado» (ni rompe el chip)', () => {
  // `warning` lo manda Meta y el webhook no lo aplica (S4, SCRUM-1518 ①); los de `Object.prototype`
  // existen en cualquier objeto literal y un `map[status]` a pelo los encuentra.
  for (const status of ['received', 'warning', 'deleted', 'SENT', 'constructor', 'toString', '__proto__']) {
    const html = chip({ status, templateName: 'presupuesto_enviado', at: '2026-10-29T10:00:00Z' });
    assert.equal(html, '', `🔴 el estado desconocido «${status}» pinta chip: ${html}`);
  }
});

test('SCRUM-1518c · sin envío, nada (como siempre)', () => {
  assert.equal(chip(null), '');
  assert.equal(chip({ status: '' }), '');
});
