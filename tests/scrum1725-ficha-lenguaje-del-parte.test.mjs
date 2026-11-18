// tests/scrum1725-ficha-lenguaje-del-parte.test.mjs — SCRUM-1725 (FICHA, S2 · 18-nov)
//
// LA FICHA DEL TRABAJO LLEVA EL LENGUAJE DEL PARTE, Y SÓLO ELLA.
//
// Orden del fundador (12-nov, reactivada el 18-nov, c.22052): la ficha del Trabajo con el lenguaje visual
// del parte de SCRUM-1722 — tarjeta por bloque, títulos de bloque, acciones que parecen botones. Es FORMA:
// el bloque de styles.css «S2 · SCRUM-1725» sólo restyla. Lo que este test sujeta:
//   ① LA FRONTERA. `.detail-page` lo comparten cinco fichas (albarán, gasto, factura, presupuesto y
//     trabajo). Toda regla del bloque cuelga de `.detail-page--trabajo`, y esa clase sólo la pone
//     jobDetailView.js. Una regla suelta (`.btn-secondary { … }`) cambiaría las otras cuatro sin que
//     nadie lo pidiera.
//   ② SÓLO TOKENS. Ni un color escrito a mano en el bloque (DESIGN.md es la única fuente, Parte AB2).
//   ③ EL ESPACIO ENTRE LOS DOS EJES DEL ALBARÁN. La celda de estado pinta la pastilla y el badge
//     («Sin precios», «Facturado»…) pegados; el texto de la ficha decía «EMITIDOSin precios» (medido en
//     yaqu.app a 390, 18-nov) y así lo lee un lector de pantalla. Cada badge va precedido de un espacio.
// El aspecto se mide con la sonda (capturas antes/después, 390 y 1280, operario y admin) y con el «me
// gusta» del fundador; aquí va lo que se puede romper sin que se vea en una captura.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => readFileSync(path.join(RAIZ, r), 'utf8');
const CSS = leer('public/dashboard/css/styles.css');
const FICHA = leer('public/dashboard/js/jobDetailView.js');

const INICIO = '/* ══ S2 · SCRUM-1725 ·';
const FIN = '/* ══ fin S2 · SCRUM-1725 ══ */';

function bloque(css) {
  const i = css.indexOf(INICIO);
  const f = css.indexOf(FIN);
  assert.ok(i >= 0 && f > i, 'el bloque «S2 · SCRUM-1725» de styles.css existe y está cerrado');
  return css.slice(i, f);
}

/** Los selectores de cada regla del bloque (sin comentarios ni la línea de @media), uno por elemento. */
function selectores(trozo) {
  const sin = sinComentarios(trozo);
  const out = [];
  for (const m of sin.matchAll(/([^{};]+)\{/g)) {
    const cab = m[1].trim();
    if (!cab || cab.startsWith('@')) continue;
    for (const s of partirEnComasDeFuera(cab)) out.push(s.trim());
  }
  return out;
}

/** `a, b:is(c, d)` → ['a', 'b:is(c, d)']: la coma de dentro de un paréntesis no separa selectores. */
function partirEnComasDeFuera(cab) {
  const partes = [];
  let nivel = 0;
  let actual = '';
  for (const ch of cab) {
    if (ch === '(') nivel++;
    if (ch === ')') nivel--;
    if (ch === ',' && nivel === 0) { partes.push(actual); actual = ''; continue; }
    actual += ch;
  }
  partes.push(actual);
  return partes;
}

// El filtro de comentarios es el de la casa (SCRUM-700). En CSS «#» NO es comentario: es un color, y es
// justo lo que mira ②; con el valor por defecto ese caso se quedaría ciego.
const sinComentarios = (css) => soloEjecutable(css, { almohadillaEsComentario: false });

const colores = (css) => css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) || [];

const fuera = (sels) => sels.filter((s) => !s.startsWith('.detail-page--trabajo'));

test('① toda regla del bloque cuelga de .detail-page--trabajo (las otras cuatro fichas no cambian)', () => {
  const sels = selectores(bloque(CSS));
  // Población declarada: si el parser no viera reglas, «0 fuera» sería un cero que no ha mirado.
  assert.ok(sels.length >= 20, `el parser ve las reglas del bloque (vio ${sels.length})`);
  assert.deepEqual(fuera(sels), [], 'reglas que se escapan de la ficha del Trabajo');
});

test('① control positivo: una regla suelta en el bloque SÍ se caza', () => {
  const mutado = bloque(CSS) + '\n.btn-secondary { background: var(--neutral-100); }\n@media (max-width: 640px) { .detail-section { padding: 0; } }\n';
  assert.deepEqual(fuera(selectores(mutado)), ['.btn-secondary', '.detail-section']);
});

test('① la clase la pone la ficha del Trabajo y ninguna otra vista', () => {
  assert.match(FICHA, /page\.className = 'detail-page detail-page--trabajo';/);
  for (const v of ['albaranDetailView.js', 'expensesView.js', 'invoiceDetailView.js', 'quotesDetailView.js']) {
    assert.doesNotMatch(leer(`public/dashboard/js/${v}`), /detail-page--trabajo/, `${v} no lleva la clase de la ficha del Trabajo`);
  }
});

test('② el bloque sólo usa tokens: ni un color escrito a mano', () => {
  const sin = sinComentarios(bloque(CSS));
  assert.ok(/var\(--/.test(sin), 'control: el bloque usa tokens (si no, «sin colores» no dice nada)');
  assert.deepEqual(colores(sin), []);
});

test('② control positivo: un color a mano en el bloque SÍ se caza (el «#» no se toma por comentario)', () => {
  const mutado = sinComentarios(bloque(CSS) + '\n.detail-page--trabajo .x { color: #dc2626; background: rgba(0,0,0,.1); }\n');
  assert.deepEqual(colores(mutado), ['#dc2626', 'rgba(']);
});

test('③ en la celda de estado del albarán cada badge va precedido de un espacio', () => {
  const i = FICHA.indexOf('<td class="jobdet-alb-estado cell-status"');
  assert.ok(i >= 0, 'la celda de estado del albarán existe');
  const celda = FICHA.slice(i, FICHA.indexOf('`</td>`', i));
  const badges = celda.match(/`\s?<span class="job-doc-row__badge"/g) || [];
  assert.equal(badges.length, 3, 'control: se ven los tres badges (Facturado en parte, Facturado, Sin precios)');
  assert.deepEqual(badges.filter((b) => !b.startsWith('` ')), [], 'badge pegado a la pastilla');
});
