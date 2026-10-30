// tests/scrum1593-censo-tactil-ocultos.test.mjs — SCRUM-1593
//
// `censo:tactil-panel` contaba como `sinPintar` lo que no tenía caja, estuviera oculto o no, y los dos
// `select` de Facturación (Configuración, pestaña cerrada al montar) salían ahí: «no hay nada que
// tocar» de lo que no se había podido mirar. Ahora el censo abre las pestañas y lo que siga oculto en
// TODOS los estados y anchuras sale aparte como NO MEDIDO. La cuenta la hace `noMedidosPorOcultos`.
//
// El censo entero (navegador, ~80 s) no corre aquí: su control positivo y su sonda oculta van dentro
// del propio censo y salen 2 si fallan. Esto fija la cuenta, que es pura.
import test from 'node:test';
import assert from 'node:assert/strict';
import { noMedidosPorOcultos } from '../scripts/_censo-distintos.mjs';

const ficha = (i, sel = 'SELECT.input') => ({ i, sel, texto: `t${i}` });
const res = (fn, ancho, { medidos = [], ocultos = [], sinCaja = [], noTocables = [] } = {}, estado = null) =>
  ({ fn, estado, ancho, medidos, ocultos, sinCaja, noTocables });

test('oculto al montar y medido al abrir su pestaña: NO cuenta como no medido', () => {
  const r = noMedidosPorOcultos([
    res('renderSettingsView', 929, { ocultos: [ficha(19), ficha(20)] }),
    res('renderSettingsView', 929, { medidos: [{ ...ficha(19), tocable: 44.9, cumple: true }, { ...ficha(20), tocable: 44.9, cumple: true }] }, 'pestaña «Facturación»'),
  ]);
  assert.equal(r.size, 0);
});

test('oculto en todos los estados y anchuras: cuenta UNA vez, con su pantalla', () => {
  const r = noMedidosPorOcultos([
    res('renderQuotesView', 929, { ocultos: [ficha(7, 'BUTTON.quote-paso__cambiar')] }),
    res('renderQuotesView', 390, { ocultos: [ficha(7, 'BUTTON.quote-paso__cambiar')] }),
  ]);
  assert.deepEqual([...r.keys()], ['renderQuotesView|7']);
  assert.equal(r.get('renderQuotesView|7').sel, 'BUTTON.quote-paso__cambiar');
});

test('visto a OTRA anchura (sin caja o no tocable también es visto): no es «no medido»', () => {
  const r = noMedidosPorOcultos([
    res('renderJobDetailView', 390, { ocultos: [ficha(1), ficha(2)] }),
    res('renderJobDetailView', 929, { sinCaja: [ficha(1)], noTocables: [{ ...ficha(2), motivo: 'x' }] }),
  ]);
  assert.equal(r.size, 0);
});

test('la identidad es pantalla + posición: el mismo i en otra pantalla no lo da por visto', () => {
  const r = noMedidosPorOcultos([
    res('renderSettingsView', 929, { ocultos: [ficha(3)] }),
    res('renderHomeView', 929, { medidos: [{ ...ficha(3), tocable: 50, cumple: true }] }),
  ]);
  assert.deepEqual([...r.keys()], ['renderSettingsView|3']);
});

test('un oculto sin posición revienta: no se adivina', () => {
  assert.throws(() => noMedidosPorOcultos([res('renderX', 929, { ocultos: [{ sel: 'BUTTON', texto: 'a' }] })]), /sin posición/);
});
