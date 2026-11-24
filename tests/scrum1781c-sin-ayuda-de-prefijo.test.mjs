// [J3] SCRUM-1781c · con el prefijo en su propio desplegable (SCRUM-1781b), sobran los textos de ayuda
// que dicen que el prefijo va DENTRO del número. Firma del fundador: SCRUM-1781 c.22275, literal
// «1-Sí quitalo» — solo QUITAR, ningún texto nuevo. Lista exacta en c.22274.
//
// Se mide sobre las pantallas MONTADAS en el banco de vistas (no sobre la fuente): el texto de cada
// nodo, su `placeholder` y su `title`. Población declarada en cada caso, y dos controles:
//   · positivo SEMBRADO: el mismo buscador, sobre un nodo fabricado con un literal prohibido, lo caza;
//   · positivo de la pantalla: el rótulo sigue y el desplegable de prefijo sigue con +34.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, pintarVista, todos, nodo } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const respiro = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

/** Lo que c.22275 manda quitar. */
const QUITADOS = ['34XXXXXXXXX', 'con código de país', 'E.164 sin +'];

/** Cada texto visible del subárbol (texto propio, placeholder, title) con el literal prohibido que lleva. */
function hallazgos(raiz) {
  const nodos = todos(raiz);
  const out = [];
  for (const n of nodos) {
    for (const t of [n.textContent, n.placeholder, n.title, n.getAttribute && n.getAttribute('placeholder')]) {
      if (typeof t !== 'string' || !t) continue;
      for (const q of QUITADOS) if (t.includes(q)) out.push(`${n.tagName}#${n.id || '-'}: «${t.trim()}»`);
    }
  }
  return { nodos: nodos.length, out };
}

function textoDe(n) { return String(n.textContent || '').trim(); }

/** El rótulo de la fila del campo: el `<label>` hermano del contenedor de la fila del teléfono. */
function rotuloDe(input) {
  let p = input._padre;
  for (let i = 0; i < 3 && p; i++, p = p._padre) {
    const l = p.hijos.find((h) => h.tagName === 'LABEL');
    if (l) return l;
  }
  return null;
}

function prefijoJuntoA(input) {
  const fila = input._padre;
  const sel = (fila?.hijos || []).filter((n) => n.tagName === 'SELECT' && String(n.className).split(/\s+/).includes('prefijo-pais'));
  assert.equal(sel.length, 1, '🔴 CIEGO: no hay UN desplegable de prefijo junto al teléfono');
  return sel[0];
}

function montarAsistente() {
  const banco = cargarDashboard(RAIZ, { datos: (url) => (/\/admin\/products$/.test(url) ? [] : {}) });
  assert.equal(typeof banco.ctx.showOnboardingWizard, 'function', '🔴 CIEGO: el panel no publica showOnboardingWizard');
  banco.ctx.openQuickQuoteModal = () => {};
  banco.ctx.showOnboardingWizard(() => {});
  const id = (x) => banco.reg.porId.get(x) || null;
  const pulsar = async (x) => {
    const n = id(x);
    assert.ok(n, `🔴 CIEGO: no existe #${x}`);
    for (const f of n._oyentes.click || []) await f.call(n, { type: 'click', target: n, preventDefault() {}, stopPropagation() {} });
  };
  return { banco, id, pulsar };
}

test('SCRUM-1781c · control SEMBRADO: el buscador caza un literal prohibido en texto y en marcador', () => {
  const reg = { porId: new Map() };
  for (const q of QUITADOS) {
    const a = nodo('input', reg); a.placeholder = `Ej: ${q}`;
    const b = nodo('label', reg); b.textContent = `Teléfono (${q})`;
    assert.equal(hallazgos(a).out.length, 1, `🔴 el buscador NO ve «${q}» en un placeholder: sería un verde ciego`);
    assert.equal(hallazgos(b).out.length, 1, `🔴 el buscador NO ve «${q}» en un texto: sería un verde ciego`);
  }
});

test('SCRUM-1781c · ① alta, «Tu WhatsApp»: sin la ayuda del prefijo, y el desplegable +34 sigue', async () => {
  const a = montarAsistente();
  const input = a.id('ob-phone');
  assert.ok(input, '🔴 CIEGO: no encuentro #ob-phone');
  const { nodos, out } = hallazgos(a.banco.ctx.document.body);
  assert.ok(nodos > 20, `🔴 CIEGO: el paso 1 montó solo ${nodos} nodos`);
  assert.deepEqual(out, [], `🔴 quedan textos de ayuda del prefijo en el paso 1 (${nodos} nodos):\n${out.join('\n')}`);
  assert.equal(input.placeholder, '', '🔴 «Tu WhatsApp» sigue con marcador (c.22275: se quita, sin texto nuevo)');
  assert.match(textoDe(rotuloDe(input)), /^Tu WhatsApp/, '🔴 el rótulo «Tu WhatsApp» no está');
  assert.equal(prefijoJuntoA(input).value, '34', '🔴 el desplegable no abre con +34');
});

test('SCRUM-1781c · ② alta, primer cliente «Su WhatsApp»: sin ayuda del prefijo, rótulo y +34 siguen', async () => {
  const a = montarAsistente();
  a.id('ob-name').value = 'Fontanería Pepe';
  await a.pulsar('ob-next');
  for (let i = 0; i < 6 && !a.id('ob-wow'); i++) {
    if (a.id('ob-serie-no')) await a.pulsar('ob-serie-no');
    await a.pulsar('ob-next');
  }
  const input = a.id('ob-cust-phone');
  assert.ok(input, '🔴 CIEGO: no llegué al paso del primer cliente');
  const { nodos, out } = hallazgos(a.banco.ctx.document.body);
  assert.ok(nodos > 20, `🔴 CIEGO: el último paso montó solo ${nodos} nodos`);
  assert.deepEqual(out, [], `🔴 quedan textos de ayuda del prefijo en el primer cliente (${nodos} nodos):\n${out.join('\n')}`);
  assert.equal(input.placeholder, '', '🔴 «Su WhatsApp» sigue con marcador (c.22275: se quita, sin texto nuevo)');
  const rot = rotuloDe(input);
  assert.equal(textoDe(rot), 'Su WhatsApp', '🔴 el rótulo debe quedar «Su WhatsApp», sin más');
  assert.equal(rot.hijos.length, 0, '🔴 el rótulo conserva un añadido (el «(con código de país)»)');
  assert.equal(prefijoJuntoA(input).value, '34', '🔴 el desplegable no abre con +34');
});

test('SCRUM-1781c · ③ Configuración: el rótulo queda «Teléfono WhatsApp» y el desplegable +34 sigue', async () => {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/merchant$/.test(url)
      ? { name: 'Pepe', legalName: 'Pepe SL', taxId: 'B00000000', address: 'C/ Falsa 1', whatsappPhone: '', defaultCurrency: 'EUR' }
      : []),
  });
  const r = await pintarVista(banco, 'renderSettingsView');
  assert.equal(r.error, null, `🔴 CIEGO: Configuración no se monta: ${r.error && r.error.message}`);
  await respiro();
  const campos = todos(r.contenedor).filter((n) => n.tagName === 'INPUT' && n.name === 'whatsappPhone');
  assert.equal(campos.length, 1, `🔴 CIEGO: esperaba UN campo whatsappPhone y hay ${campos.length}`);
  const { nodos, out } = hallazgos(r.contenedor);
  assert.ok(nodos > 50, `🔴 CIEGO: Configuración montó solo ${nodos} nodos`);
  assert.deepEqual(out, [], `🔴 quedan textos de ayuda del prefijo en Configuración (${nodos} nodos):\n${out.join('\n')}`);
  assert.equal(textoDe(rotuloDe(campos[0])), 'Teléfono WhatsApp', '🔴 el rótulo debe quedar «Teléfono WhatsApp»');
  assert.equal(prefijoJuntoA(campos[0]).value, '34', '🔴 el desplegable no abre con +34');
});
