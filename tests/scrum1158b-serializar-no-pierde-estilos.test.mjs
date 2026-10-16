// tests/scrum1158b-serializar-no-pierde-estilos.test.mjs — SCRUM-1158, segunda cara (c.17197)
//
// `serializar` (`scripts/_pagina-panel.mjs`) sirve al navegador TODOS los estilos en línea que el
// producto pone, por marcado o por JS.
//
// Antes emitía sólo `cssText` y `display`, y el banco no mantiene `cssText`: un `style="…"` del
// marcado se reparte en propiedades sueltas y un `el.style.minHeight = '44px'` también. Medido sobre
// f4910603 con `docs/master/evidencias/scrum1158/censo-estilos-perdidos.mjs`: 876 declaraciones
// perdidas en 16 de 18 vistas, 824 del marcado. En `censo:tactil-panel` eso daba por cortas las
// pestañas de Cobros (los botones `data-filtro-cobro` de `cobrosView.js`, `minHeight` 44 por JS)
// y escondía cortos de verdad.
//
// El nodo sin estilo es el CONTROL: si `serializar` inventara un `style` para todo, cae su caso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodo } from './_banco-vistas.mjs';
import { serializar } from '../scripts/_pagina-panel.mjs';

const reg = () => ({ porId: new Map() });
const estiloServido = (n) => {
  const m = serializar(n).split('>')[0].match(/\sstyle="([^"]*)"/);
  return m ? m[1].replace(/\s+/g, '') : null;
};

test('CONTROL · un elemento sin estilos se sirve sin atributo style', () => {
  assert.equal(estiloServido(nodo('button', reg())), null);
});

test('min-height puesto por JS (las pestañas data-filtro-cobro de Cobros) llega a la página', () => {
  const b = nodo('button', reg());
  b.style.minHeight = '44px';
  assert.match(estiloServido(b) || '', /(^|;)min-height:44px(;|$)/, serializar(b));
});

test('style del MARCADO, con varias declaraciones, llega entero a la página', () => {
  const c = nodo('div', reg());
  c.innerHTML = '<button style="min-height:44px;font-size:13px;color:var(--neutral-500)">Todos</button>';
  const servido = estiloServido(c.hijos[0]) || '';
  for (const d of ['min-height:44px', 'font-size:13px', 'color:var(--neutral-500)']) {
    assert.ok(servido.includes(d), `falta ${d} en ${serializar(c.hijos[0])}`);
  }
});

test('display sigue saliendo, también junto a otras propiedades', () => {
  const b = nodo('div', reg());
  b.style.display = 'none';
  b.style.width = '10px';
  const servido = estiloServido(b) || '';
  assert.ok(servido.includes('display:none'), serializar(b));
  assert.ok(servido.includes('width:10px'), serializar(b));
});

test('lo que JS asigna DESPUÉS del marcado gana, como en el navegador', () => {
  const c = nodo('div', reg());
  c.innerHTML = '<span style="min-height:20px">x</span>';
  c.hijos[0].style.minHeight = '44px';
  const servido = estiloServido(c.hijos[0]) || '';
  assert.ok(servido.includes('min-height:44px'), serializar(c.hijos[0]));
  assert.ok(!servido.includes('min-height:20px'), serializar(c.hijos[0]));
});
