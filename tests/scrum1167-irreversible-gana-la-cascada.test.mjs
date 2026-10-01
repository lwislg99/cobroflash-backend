// tests/scrum1167-irreversible-gana-la-cascada.test.mjs — SCRUM-1167
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// «LLEVA LA CLASE» NO ES «MIDE 44». AQUÍ SE CALCULA QUÉ REGLA GANA.
//
// SCRUM-786 le puso `accion-irreversible-btn-44` a «Borrar» proveedor y su test comprobaba que el
// botón LLEVARA la clase. La llevaba, y en escritorio medía 30 px: `.btn.btn-sm { min-height: 30px }`
// pesa (0,2,0) y `.accion-irreversible-btn-44 { min-height: 44px }` pesa (0,1,0). Gana la de 30.
//
// ── QUÉ MIDE ESTE FICHERO, Y QUÉ NO ──────────────────────────────────────────────────────────────
// El banco de vistas es un mini-DOM SIN motor de maquetación: no sabe la altura de nada. La altura
// real la mide `npm run guard:objetivo-tactil` en navegador (Proveedores vuelve a estar vigilada ahí
// desde este ticket, con sus irreversibles a 44 px en los dos anchos). Pero ese guard corre en el
// job de navegador, que no es el check obligatorio. Esto sí lo es, y hace lo que se puede hacer sin
// navegador: resolver la CASCADA de `styles.css` para las clases EXACTAS de cada botón irreversible
// y decir qué `min-height` gana — especificidad y, a igualdad, la última.
//
// ⚠️ LÍMITES DECLARADOS: sólo reglas de nivel superior (fuera de `@media`) y sólo selectores hechos
// SOLO de clases (`.a.b`), que es la forma de las dos reglas en disputa. No ve reglas con
// descendiente (`.x .btn-sm`) ni las de móvil. Por eso el árbitro de la altura es el guard; esto
// es la red que corre siempre y caza exactamente el defecto de este ticket.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
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
    // Cierre con conteo de llaves: un `@media` lleva reglas dentro.
    let prof = 1, j = abre + 1;
    while (j < t.length && prof > 0) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++; }
    if (!preludio.startsWith('@')) reglas.push({ selectores: preludio.split(',').map((s) => s.trim()), cuerpo: t.slice(abre + 1, j - 1) });
    i = j;
  }
  return reglas;
}

const REGLAS = reglasDeNivelSuperior(CSS);

/**
 * La `min-height` que gana para un elemento con EXACTAMENTE estas clases, según las reglas de
 * nivel superior hechas sólo de clases. Devuelve también la regla ganadora, para poder nombrarla.
 */
function minHeightQueGana(clases) {
  const tiene = new Set(clases);
  let mejor = null;
  REGLAS.forEach((r, orden) => {
    const m = r.cuerpo.match(/(?:^|;|\s)min-height\s*:\s*([\d.]+)px\s*(!important)?/);
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

// Las clases EXACTAS que pone el producto a cada irreversible (providersView.js, templatesView.js,
// albaranDetailView.js). Si cambian allí, el test de SCRUM-786 lo nota por el fuente.
const IRREVERSIBLES = [
  { nombre: '«Borrar» proveedor', clases: ['btn', 'btn-danger', 'btn-sm', 'accion-irreversible-btn-44'] },
  { nombre: '«Borrar» plantilla', clases: ['btn-danger', 'btn-sm', 'accion-irreversible-btn-44'] },
  { nombre: '«Emitir» albarán (primaria)', clases: ['btn-primary', 'btn-sm', 'accion-irreversible-btn-44'] },
  // SCRUM-1142 · ficha de factura (invoiceDetailView.js). Las clases las fija por el producto
  // `tests/scrum1142-irreversibles-factura-44.test.mjs`. La rectificativa es un ítem del «⋯».
  { nombre: '«Anular factura…»', clases: ['btn-secondary', 'btn-sm', 'accion-irreversible-btn-44'] },
  { nombre: '«Anular factura» (modal)', clases: ['btn-danger', 'btn-sm', 'accion-irreversible-btn-44'] },
  { nombre: '«Emitir factura rectificativa» (⋯)', clases: ['overflow-item', 'accion-irreversible-btn-44'] },
];

test('SCRUM-1167 · SUELO: el lector de la hoja ve reglas y ve la de `.btn.btn-sm` a 30 px', () => {
  assert.ok(REGLAS.length > 300, `🔴 CIEGO: sólo ${REGLAS.length} reglas de nivel superior en styles.css.`);
  const btnSm = REGLAS.find((r) => r.selectores.includes('.btn.btn-sm'));
  assert.ok(btnSm, '🔴 CIEGO: no encuentro la regla `.btn.btn-sm`; la disputa de este ticket no se está mirando.');
  assert.match(btnSm.cuerpo, /min-height:\s*30px/, '🔴 `.btn.btn-sm` ya no fija 30 px: re-mide este ticket.');
});

test('SCRUM-1167 · CONTROL: el mismo botón SIN la clase irreversible se queda en 30 px (el cálculo discrimina)', () => {
  const g = minHeightQueGana(['btn', 'btn-danger', 'btn-sm']);
  assert.ok(g, '🔴 CIEGO: ninguna regla da min-height a `btn btn-danger btn-sm`.');
  assert.equal(g.px, 30, `🔴 el control no da 30 px (da ${g.px}, regla \`${g.sel}\`): el cálculo no está mirando lo que cree.`);
});

for (const irr of IRREVERSIBLES) {
  test(`SCRUM-1167 · 🔴 ${irr.nombre}: la regla que GANA la cascada fija ≥ 44 px, y sin !important`, () => {
    const g = minHeightQueGana(irr.clases);
    assert.ok(g, `🔴 CIEGO: ninguna regla da min-height a ${irr.nombre}.`);
    assert.ok(g.px >= 44,
      `🔴 ${irr.nombre} lleva \`accion-irreversible-btn-44\` y gana \`${g.sel}\` con ${g.px} px: la clase pierde la cascada.`);
    assert.equal(g.importante, false, `🔴 ${irr.nombre} gana con !important (\`${g.sel}\`): el ticket lo prohíbe.`);
  });
}

// El patrón hermano de SCRUM-1111: un guard que se pone verde RETIRANDO la pantalla que vigila.
test('SCRUM-1167 · el guard táctil sigue vigilando Proveedores y exige «Borrar» como irreversible', () => {
  const sinComentarios = soloCodigo(GUARD, 'guard-objetivo-tactil.mjs');
  assert.match(sinComentarios, /vista:\s*'renderProvidersView'[\s\S]{0,200}irreversibles:\s*\['Borrar'\]/,
    '🔴 `guard-objetivo-tactil.mjs` ya no declara la superficie de Proveedores con «Borrar» como irreversible.');
});
