// tests/scrum962f-editor-cuatro-44.test.mjs — SCRUM-962f
//
// Sin gate: lee styles.css y monta el editor de presupuestos en el banco con los datos del censo. Ni BD, ni red,
// ni navegador.
//
// Cuatro controles del editor medían menos de 44 px de toque (962c, editor vivo, toque real):
//   · los radios «Razón social / Nombre comercial» y la casilla «Incluir descripción en el PDF» (Condiciones ›
//     Ajustes del documento): 16×16, con una etiqueta que SÍ los activa pero que mide LO MISMO (19,4 / 20,1).
//     ⚠️ No es el caso de una etiqueta envolvente grande —que haría del corto un artefacto del medidor—: aquí
//     hay que subir la ETIQUETA a 44, y el control gana área con un `::before` anclado a su IZQUIERDA (crece
//     hacia su propio texto, nunca hacia la etiqueta vecina: los dos radios van pegados).
//   · el <select> «IVA %» de los ajustes de la línea: nativo a 21 px. Su etiqueta lo ENFOCA pero NO lo abre
//     (medido con `:open`), así que la etiqueta no le presta el área: el control tiene que medir 44, como
//     «Coste» y «Dto. %», que ya lo hacían con `.quote-ajustes-campos input`.
// La GEOMETRÍA la mide en navegador `docs/master/evidencias/scrum962f/lote2-medida.mjs`; este test vigila lo
// que la sostiene, en las reglas y en el producto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO } from '../scripts/_datos-del-censo.mjs';
import { cargarDashboard, pintarVista } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.quote-ajustes .inline-checkbox label { min-height: 44px; cursor: pointer; }',
    a: '.quote-ajustes .inline-checkbox label { min-height: 20px; cursor: pointer; }',
    cae: 'SCRUM-962f ① ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '  left: 0;\n  width: 44px;\n  height: 44px;',
    a: '  left: -14px;\n  width: 44px;\n  height: 44px;',
    cae: 'SCRUM-962f ② ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.quote-ajustes .radio-label,\n.quote-ajustes .inline-checkbox label {',
    a: '.radio-label,\n.inline-checkbox label {',
    cae: 'SCRUM-962f ③ ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.quote-ajustes-campos input,\n.quote-ajustes-campos select /*',
    a: '.quote-ajustes-campos input,\n.quote-ajustes-campos textarea /*',
    cae: 'SCRUM-962f ④ ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.quote-ajustes-campos select:disabled, /*',
    a: '.quote-ajustes-campos textarea:disabled, /*',
    cae: 'SCRUM-962f ④ ·',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: 'ajustesCampos.appendChild(vatTd);',
    a: 'void vatTd;',
    cae: 'SCRUM-962f ⑤ ·',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: 'lbl.className = "radio-label";',
    a: 'lbl.className = "opcion-nombre";',
    cae: 'SCRUM-962f ⑥ ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Sin comentarios con el helper único (trinquetes SCRUM-694/700); sobre styles.css da lo mismo que la regex de bloques.
const CSS = soloCodigo(fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8'), 'styles.css');
const reglas = () => CSS.replace(/@media[^{]*\{/g, '').split('}')
  .map((b) => { const [sel, cuerpo = ''] = b.split('{'); return { sel: sel.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), cuerpo }; });
const con = (s) => reglas().filter((r) => r.sel.includes(s));
const cuerpoDe = (s) => con(s).map((r) => r.cuerpo).join(';');
const CONTROLES = ['.quote-ajustes .radio-label input[type="radio"]', '.quote-ajustes .inline-checkbox input[type="checkbox"]'];
const ETIQUETAS = ['.quote-ajustes .radio-label', '.quote-ajustes .inline-checkbox label'];

test('SCRUM-962f ① · las etiquetas suben a 44, y radio y casilla llevan su `::before` de 44×44 contra un padre relativo', () => {
  for (const s of ETIQUETAS) assert.match(cuerpoDe(s), /min-height:\s*44px/, `🔴 ${s} no tiene min-height de 44 px: la etiqueta vuelve a medir lo que el control.`);
  for (const s of CONTROLES) {
    assert.match(cuerpoDe(s), /position:\s*relative/, `🔴 ${s} no es \`position: relative\`.`);
    const p = cuerpoDe(`${s}::before`);
    assert.match(p, /content:\s*""/, `🔴 ${s}::before sin \`content\`.`);
    assert.match(p, /position:\s*absolute/, `🔴 ${s}::before no es absoluto.`);
    assert.match(p, /width:\s*44px/, `🔴 ${s}::before no mide 44 de ancho.`);
    assert.match(p, /height:\s*44px/, `🔴 ${s}::before no mide 44 de alto.`);
  }
});

test('SCRUM-962f ② · el área del radio y de la casilla crece hacia SU texto, nunca hacia la etiqueta vecina', () => {
  for (const s of CONTROLES) {
    const p = cuerpoDe(`${s}::before`);
    assert.match(p, /(^|[;\s])left:\s*0(;|\s|$)/, `🔴 ${s}::before no está anclado a su izquierda con left: 0: se sale hacia la etiqueta de al lado.`);
    assert.doesNotMatch(p, /(^|[;\s])(right|inset):/, `🔴 ${s}::before declara right/inset: crece hacia los dos lados y se come el final de «Razón social».`);
  }
});

test('SCRUM-962f ③ · todo está ACOTADO al editor (`.inline-checkbox` la comparten la ficha 360 de J2 y Avisos de J3)', () => {
  const sueltas = reglas().flatMap((r) => r.sel.map((s) => ({ s, cuerpo: r.cuerpo })))
    .filter(({ s, cuerpo }) => /(\.radio-label|\.inline-checkbox)/.test(s) && /min-height:\s*44px|::before/.test(s + cuerpo) && !/^\.quote-ajustes /.test(s))
    .map(({ s }) => s);
  assert.deepEqual(sueltas, [], `🔴 hay reglas de 44 px de esta familia SIN acotar a \`.quote-ajustes\`: ${sueltas.join(' · ')}`);
});

test('SCRUM-962f ④ · el <select> «IVA %» es un campo de 44 como sus hermanos, y bloqueado PARECE bloqueado', () => {
  assert.ok(con('.quote-ajustes-campos select').some((r) => r.sel.includes('.quote-ajustes-campos input') && /min-height:\s*44px/.test(r.cuerpo)),
    '🔴 `.quote-ajustes-campos select` ya no va en la misma regla que sus hermanos `input`: vuelve a ser nativo a 21 px.');
  assert.match(cuerpoDe('.quote-ajustes-campos select'), /(^|[;\s])height:\s*44px/, '🔴 el select sin `height: 44px` mide 45 y no se alinea con sus hermanos.');
  assert.ok(con('.quote-ajustes-campos select:disabled').some((r) => r.sel.includes('.quote-ajustes-campos input:disabled')),
    '🔴 el IVA bloqueado ES este select: sin él en la regla de `:disabled`, con fondo propio, deja de parecer bloqueado.');
});

test('SCRUM-962f ⑥ · el editor pinta los radios y la casilla DENTRO de lo que las reglas nombran', async () => {
  const fn = 'renderQuotesView';
  const dc = datosDelCenso(); dc.enVista(fn);
  const r = await pintarVista(cargarDashboard(RAIZ, { datos: dc.datos }), fn, ...(ARGUMENTOS_DEL_CENSO[fn] || []));
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: ${fn} revienta al montarse: ${r.error && r.error.message}`);
  for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res));
  // Recorrido con la pila de ancestros: el banco no garantiza un `parentNode` fiable.
  const encontrados = [];
  const clases = (n) => String(n.className || '').split(/\s+/);
  (function andar(n, pila) {
    encontrados.push({ n, pila });
    for (const h of n.hijos || []) andar(h, pila.concat([n]));
  })(r.contenedor, []);
  const dentro = (pila, cls) => pila.some((a) => clases(a).includes(cls));
  const radios = encontrados.filter(({ n }) => n.tagName === 'INPUT' && (n.type === 'radio' || (n._attrs || {}).type === 'radio') && n.name === 'df-nombre');
  assert.equal(radios.length, 2, `🔴 NO PUDE MIRAR: esperaba los 2 radios df-nombre y hay ${radios.length}.`);
  for (const { pila } of radios) {
    assert.ok(clases(pila[pila.length - 1]).includes('radio-label'), '🔴 el radio ya no está DENTRO de `.radio-label`: la regla no le llega.');
    assert.ok(dentro(pila, 'quote-ajustes'), '🔴 el radio ya no está dentro de `.quote-ajustes`: el acotado lo deja fuera.');
  }
  const pdf = encontrados.filter(({ n }) => n.tagName === 'INPUT' && n.name === 'include_description');
  assert.equal(pdf.length, 1, `🔴 NO PUDE MIRAR: esperaba la casilla include_description y hay ${pdf.length}.`);
  assert.equal(pdf[0].pila[pdf[0].pila.length - 1].tagName, 'LABEL', '🔴 la casilla del PDF ya no está dentro de su <label>.');
  assert.ok(dentro(pdf[0].pila, 'inline-checkbox') && dentro(pdf[0].pila, 'quote-ajustes'), '🔴 la casilla del PDF salió de `.quote-ajustes .inline-checkbox`.');
});

test('SCRUM-962f ⑤ · el «IVA %» de la línea es un <select> y vive en `.quote-ajustes-campos`', () => {
  // ⚠️ El banco NO pinta ninguna línea al montar (medido: cero `.quote-ajustes-campos` en el árbol; la línea
  // llega después, con `addLine`). Así que aquí no se puede mirar el árbol pintado: se mira la PIEZA real
  // (`tiposDeIva.montar`, cargada por el banco) y el CABLEADO en el fuente. La geometría en vivo la da
  // `docs/master/evidencias/scrum962f/lote2-medida.mjs`, que abre el modal con clics reales.
  const { ctx } = cargarDashboard(RAIZ);
  assert.equal(typeof (ctx.tiposDeIva && ctx.tiposDeIva.montar), 'function', '🔴 NO PUDE MIRAR: el banco no expone `tiposDeIva.montar`.');
  assert.equal(ctx.tiposDeIva.montar(null).tagName, 'SELECT', '🔴 el IVA de la línea ya no es un <select>: la regla `.quote-ajustes-campos select` no le llega.');
  const fuente = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8');
  for (const [frase, por] of [
    ['const vatInput = window.tiposDeIva.montar(', 'el IVA de la línea ya no sale de `tiposDeIva.montar`'],
    ['vatTd.appendChild(vatInput);', 'el <select> del IVA ya no entra en su campo `vatTd`'],
    ['ajustesCampos.className = "quote-ajustes-campos";', 'el contenedor de la hoja de ajustes cambió de clase'],
    ['ajustesCampos.appendChild(vatTd);', 'el campo del IVA ya no cuelga de `.quote-ajustes-campos`'],
  ]) assert.ok(fuente.includes(frase), `🔴 ${por}: la regla de 44 px ya no le llega (busqué «${frase}»).`);
});
