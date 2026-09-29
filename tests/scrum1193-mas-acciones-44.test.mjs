// tests/scrum1193-mas-acciones-44.test.mjs — SCRUM-1193
//
// EL «⋯» DE ACCIONES SECUNDARIAS MEDÍA 30 px EN TODAS LAS PANTALLAS QUE NO LO SUBÍAN A MANO.
//
// `overflowMenu` (api.js) crea el disparador con `overflow-trigger btn-ghost btn-sm`, y `.btn-sm`
// fija `min-height: 30px`. Cuatro pantallas lo subían a 44 con una regla propia (líneas del
// presupuesto, cabecera de presupuestos, Trabajos, Gastos); la ficha del Trabajo, el albarán y la
// factura no. Medido en navegador por S3 (SCRUM-1172): 30,7 px a 929, 31,0 px a 390.
//
// El arreglo va en el COMPONENTE, no pantalla a pantalla: `.overflow-trigger.btn-ghost.btn-sm` (0,3,0).
//
// Mismo método que SCRUM-1167: el banco no sabe la altura de nada (SCRUM-1158), así que aquí se
// RESUELVE LA CASCADA de `styles.css` para las clases EXACTAS que pone `api.js`, leídas del fuente.
// Los píxeles los juzga `npm run guard:objetivo-tactil` en navegador.
// ⚠️ LÍMITES: sólo reglas de nivel superior hechas sólo de clases; no ve descendientes ni `@media`.
// Aparte se comprueba que NINGUNA regla, de ninguna forma, baje de 44 `min-height`/`height` de algo
// que se llame `overflow-trigger`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
const API = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/api.js'), 'utf8');
const GUARD = fs.readFileSync(path.join(RAIZ, 'scripts/guard-objetivo-tactil.mjs'), 'utf8');

/** Reglas de nivel superior, en orden. Los bloques `@…{…}` se saltan enteros. */
function reglasDeNivelSuperior(css) {
  const t = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const reglas = [];
  let i = 0;
  while (i < t.length) {
    const abre = t.indexOf('{', i);
    if (abre < 0) break;
    const preludio = t.slice(i, abre).trim();
    let prof = 1, j = abre + 1;
    while (j < t.length && prof > 0) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++; }
    if (!preludio.startsWith('@')) reglas.push({ selectores: preludio.split(',').map((s) => s.trim()), cuerpo: t.slice(abre + 1, j - 1) });
    i = j;
  }
  return reglas;
}
const REGLAS = reglasDeNivelSuperior(CSS);

/** La propiedad `prop` (px) que gana para un elemento con EXACTAMENTE estas clases. */
function queGana(clases, prop) {
  const tiene = new Set(clases);
  const re = new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([\\d.]+)px\\s*(!important)?`);
  let mejor = null;
  REGLAS.forEach((r, orden) => {
    const m = r.cuerpo.match(re);
    if (!m) return;
    for (const sel of r.selectores) {
      if (!/^(\.[\w-]+)+$/.test(sel)) continue;
      const suyas = sel.split('.').filter(Boolean);
      if (!suyas.every((c) => tiene.has(c))) continue;
      const cand = { px: Number(m[1]), importante: Boolean(m[2]), peso: suyas.length, orden, sel };
      if (!mejor || cand.peso > mejor.peso || (cand.peso === mejor.peso && cand.orden >= mejor.orden)) mejor = cand;
    }
  });
  return mejor;
}

/** Las clases del disparador, LEÍDAS de `overflowMenu` en api.js (no copiadas). */
function clasesDelDisparador() {
  const codigo = soloCodigo(API, 'api.js');
  const ini = codigo.indexOf('function overflowMenu(');
  assert.ok(ini >= 0, '🔴 CIEGO: `overflowMenu` ya no está en api.js');
  const m = codigo.slice(ini, ini + 1500).match(/trigger\.className\s*=\s*['"]([^'"]+)['"]/);
  assert.ok(m, '🔴 CIEGO: no encuentro `trigger.className = …` en `overflowMenu`');
  return m[1].split(/\s+/).filter(Boolean);
}

test('SCRUM-1193 · SUELO: el disparador sigue llevando `btn-sm` (la clase que lo dejaba en 30 px)', () => {
  const c = clasesDelDisparador();
  assert.ok(c.includes('overflow-trigger') && c.includes('btn-sm'), `el disparador lleva ${c.join(' ')}: re-mide este ticket`);
  assert.ok(REGLAS.length > 300, `🔴 CIEGO: sólo ${REGLAS.length} reglas de nivel superior.`);
});

test('SCRUM-1193 · CONTROL: el mismo botón SIN `overflow-trigger` se queda en 30 px (el cálculo discrimina)', () => {
  const g = queGana(clasesDelDisparador().filter((c) => c !== 'overflow-trigger'), 'min-height');
  assert.ok(g, '🔴 CIEGO: ninguna regla da min-height a `btn-ghost btn-sm`');
  assert.equal(g.px, 30, `el control da ${g.px} (\`${g.sel}\`): el cálculo no mira lo que cree`);
});

for (const prop of ['min-height', 'min-width']) {
  test(`SCRUM-1193 · 🔴 el «⋯» de overflowMenu: la regla que GANA fija ${prop} ≥ 44 px, sin !important`, () => {
    const g = queGana(clasesDelDisparador(), prop);
    assert.ok(g, `🔴 ninguna regla da ${prop} al «⋯»: se queda en lo que diga \`.btn-sm\``);
    assert.ok(g.px >= 44, `🔴 el «⋯» gana \`${g.sel}\` con ${g.px} px de ${prop}: por debajo de AB6`);
    assert.equal(g.importante, false, `🔴 gana con !important (\`${g.sel}\`)`);
  });
}

test('SCRUM-1193 · ninguna regla (con descendiente o dentro de @media) baja el «⋯» de 44 px', () => {
  const t = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const bajas = [];
  for (const m of t.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    if (!/overflow-trigger/.test(m[1])) continue;
    for (const d of m[2].matchAll(/(?:^|[;\s])((?:min-)?(?:height|width))\s*:\s*([\d.]+)px/g)) {
      if (Number(d[2]) < 44) bajas.push(`${m[1].trim().replace(/\s+/g, ' ')} { ${d[1]}: ${d[2]}px }`);
    }
  }
  assert.deepEqual(bajas, [], '🔴 alguna regla vuelve a encoger el «⋯»');
});

test('SCRUM-1193 · la excepción del «⋯» en el guard táctil está RETIRADA: la ficha del Trabajo se vigila sin excusa', () => {
  const codigo = soloCodigo(GUARD, 'guard-objetivo-tactil.mjs');
  assert.doesNotMatch(codigo, /BUTTON\.overflow-trigger/, '🔴 el guard sigue excusando el «⋯»');
  assert.match(codigo, /vista:\s*'renderJobDetailView'/, '🔴 la ficha del Trabajo ha salido del guard: verde por retirar lo vigilado');
});
