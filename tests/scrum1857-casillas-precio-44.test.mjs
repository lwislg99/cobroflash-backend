// tests/scrum1857-casillas-precio-44.test.mjs — SCRUM-1857 ①
//
// «PARTES POR VALORAR»: LA CASILLA DEL PRECIO POR UNIDAD, A 44 PX DE TOQUE (AB6).
//
// `parteOficinaView.js` pinta en cada línea del parte un `INPUT.po-col-precio` (number) sin regla de
// altura: medido en yaqu.app, 20 px de caja y 21 de toque a 390, 929 y 1280 (guion y cifras en
// `docs/master/SCRUM-1857.md`). La cura es POR CONTENEDOR, sólo tamaño: `#po-detalle .po-linea >
// input.po-col-precio { min-height: 44px }`. El `input` global no se toca, ni el ancho de la columna,
// ni «Guardar precios» (decisión c.22779: conforme con DESIGN.md).
//
// QUÉ MIRA: la casilla montada en el banco de vistas (lleva su clase, está dentro de `.po-linea` y ésta
// dentro de `#po-detalle`: el selector la alcanza) y `styles.css` sin comentarios. Los píxeles, en
// navegador, los mide el guion del registro.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { leerFuente } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = leerFuente(path.join(RAIZ, 'public/dashboard/css/styles.css'), { ancla: '#po-detalle .po-linea' });
const SELECTOR = '#po-detalle .po-linea > input.po-col-precio';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '#po-detalle .po-linea > input.po-col-precio { min-height: 44px; }',
    a: '#po-detalle .po-linea > input.po-col-precio { min-height: 20px; }',
    cae: 'SCRUM-1857 · ② la regla da 44 px de alto a la casilla, y sólo a ella',
  },
  {
    fichero: 'public/dashboard/js/parteOficinaView.js',
    de: "inp.className = 'po-col-precio';",
    a: "inp.className = 'po-col-precio-x';",
    cae: 'SCRUM-1857 · ① la casilla del precio cuelga de `.po-linea` dentro de `#po-detalle`, con su clase',
  },
];

const NAV = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
const PARTE = {
  id: 1857, numero: 'PT-1857', clienteNombre: 'Cliente Ejemplo', obra: null,
  puedeEditarPrecios: { ok: true },
  lineas: [
    { id: 1, bloque: 'materiales', descripcion: 'ZZ tubo', unds: 2, precioUnitario: 3.5, importe: 7 },
    { id: 2, bloque: 'mano_obra', descripcion: 'ZZ horas', unds: 1, precioUnitario: null, importe: null },
  ],
};

/** Reglas con su `@media`; recibe el CSS ya sin comentarios. */
function reglas(css) {
  const out = [];
  const recorrer = (t, medio) => {
    let i = 0;
    while (i < t.length) {
      const abre = t.indexOf('{', i);
      if (abre < 0) break;
      const preludio = t.slice(i, abre).trim();
      let prof = 1, j = abre + 1;
      while (j < t.length && prof > 0) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++; }
      const cuerpo = t.slice(abre + 1, j - 1);
      if (preludio.startsWith('@media') || preludio.startsWith('@supports')) recorrer(cuerpo, preludio.replace(/\s+/g, ' '));
      else if (!preludio.startsWith('@')) out.push({ selectores: preludio.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), cuerpo: cuerpo.replace(/\s+/g, ''), medio });
      i = j;
    }
  };
  recorrer(css, null);
  return out;
}

test('SCRUM-1857 · ① la casilla del precio cuelga de `.po-linea` dentro de `#po-detalle`, con su clase', async () => {
  // La red del banco contesta los GET (modelo: `scrum1285-guardado-en-vuelo`); nada se escribe.
  const fetch = async (url) => {
    const u = String(url);
    let cuerpo = [];
    if (/\/oficina\/pendientes$/.test(u)) cuerpo = { pendientes: [{ id: PARTE.id, numero: PARTE.numero, lineas: PARTE.lineas }], firmadosLeidos: 1 };
    else if (/\/admin\/partes\/1857\/oficina$/.test(u)) cuerpo = PARTE;
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}) };
  };
  const b = cargarDashboard(RAIZ, { red: { navigator: NAV, fetch } });
  const v = await pintarVista(b, 'renderPartesOficinaView');
  assert.equal(v.error, null, `🔴 la vista revienta: ${v.error && v.error.message}`);
  // Se abre el parte como lo abre la persona: pulsando su fila.
  const fila = todos(v.contenedor).find((n) => n.className === 'customers-card' && (n._oyentes.click || []).length > 0);
  assert.ok(fila, 'CIEGO: la lista no pinta la fila del parte');
  fila.disparar('click');
  for (let i = 0; i < 25; i++) await new Promise((r) => setImmediate(r));
  const casillas = todos(v.contenedor).filter((n) => n.tagName === 'INPUT' && String(n.className).split(/\s+/).includes('po-col-precio'));
  assert.equal(casillas.length, 2, `CIEGO: se esperaban las 2 casillas .po-col-precio del parte y el banco pinta ${casillas.length}`);
  for (const c of casillas) {
    const linea = c.parentNode;
    assert.ok(linea && String(linea.className).split(/\s+/).includes('po-linea'), '🔴 la casilla ya no es hija directa de `.po-linea`: el selector no la alcanza');
    let p = linea; let enDetalle = false;
    for (; p; p = p.parentNode) if (p.id === 'po-detalle' || (p._attrs && p._attrs.id === 'po-detalle')) { enDetalle = true; break; }
    assert.ok(enDetalle, '🔴 la línea ya no está dentro de `#po-detalle`: el selector no la alcanza');
  }
});

test('SCRUM-1857 · ② la regla da 44 px de alto a la casilla, y sólo a ella', () => {
  const todas = reglas(CSS);
  assert.ok(todas.some((r) => r.selectores.includes('#po-detalle .po-linea')), 'CIEGO: el parser no ve `#po-detalle .po-linea` en styles.css');
  const propias = todas.filter((r) => r.selectores.includes(SELECTOR));
  assert.equal(propias.length, 1, `🔴 se esperaba UNA regla \`${SELECTOR}\` y hay ${propias.length}`);
  assert.equal(propias[0].medio, null, '🔴 la regla vive dentro de un @media: algún ancho se quedaría sin los 44');
  assert.match(propias[0].cuerpo, /min-height:44px/, '🔴 la casilla no llega a 44 px de alto');
  // Sólo tamaño: ni color, ni borde, ni ancho (la columna casa con la cabecera).
  assert.deepEqual(propias[0].cuerpo.split(';').filter(Boolean), ['min-height:44px'], '🔴 la cura toca algo más que el tamaño');
  // Y el `input` global no se ha tocado para esto.
  assert.ok(!todas.some((r) => r.selectores.some((s) => /^input(\[type="?number"?\])?$/.test(s)) && /min-height:44px/.test(r.cuerpo)),
    '🔴 los 44 px se han puesto al `input` global: la cura tenía que ser por contenedor');
});
