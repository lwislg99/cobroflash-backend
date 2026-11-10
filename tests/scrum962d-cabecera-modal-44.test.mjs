// tests/scrum962d-cabecera-modal-44.test.mjs — SCRUM-962d
//
// Sin gate: lee styles.css y monta la pieza `cabeceraModal` en el banco. Ni BD, ni red, ni navegador.
//
// El «?» y el «×» de la cabecera de los modales medían 27,5×26 y 30×30 de ÁREA de toque (962c, cinco
// modales del editor; la pieza son 28 cabeceras del panel). Se arreglan ampliando el ÁREA y no el dibujo:
// un `::before` de 44×44 posicionado, acotado a `.modal-header >`. La GEOMETRÍA la mide en navegador
// `docs/master/evidencias/scrum962d/cabecera-banco.mjs` (área, alto de la cabecera, capturas); este test,
// que sí corre en cada PR, vigila lo que la sostiene:
//   ① que el `::before` exista con 44×44, posicionado y contra un padre `position: relative`;
//   ② que cada uno crezca HACIA FUERA de la pareja (el «?» anclado a su derecha, el «×» a su izquierda),
//      porque si crecen el uno hacia el otro, el de encima le roba el toque al de debajo;
//   ③ que esté ACOTADO a `.modal-header >`: `.modal-close` se reutiliza a 24 px en la tostada de error
//      (`api.js`), y ahí un área que se sale taparía la página;
//   ④ que la pieza siga pintando los dos botones como hijos DIRECTOS de `.modal-header`, que es lo que
//      el selector `>` nombra. Si un día los envuelve en otro nodo, la regla deja de aplicarse en silencio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387): cada defecto que este test
// promete cazar, con el texto exacto que lo produce y la prueba que TIENE que ponerse roja.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.modal-header > .modal-close { position: relative; }',
    a: '.modal-header > .modal-close { }',
    cae: 'SCRUM-962d ① ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.modal-header > .modal-close::before {\n  content: "";\n  position: absolute;\n  top: 50%;\n  width: 44px;',
    a: '.modal-header > .modal-close::before {\n  content: "";\n  position: absolute;\n  top: 50%;\n  width: 40px;',
    cae: 'SCRUM-962d ① ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.modal-header > .modal-close::before { left: 0; }',
    a: '.modal-header > .modal-close::before { right: 0; }',
    cae: 'SCRUM-962d ② ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.modal-header > .modal-ayuda::before,\n.modal-header > .modal-close::before {',
    a: '.modal-header > .modal-ayuda::before,\n.modal-close::before {',
    cae: 'SCRUM-962d ③ ·',
  },
  {
    fichero: 'public/dashboard/js/modalHeader.js',
    de: '      header.appendChild(ayuda);',
    a: "      const envoltorio = document.createElement('div'); envoltorio.appendChild(ayuda); header.appendChild(envoltorio);",
    cae: 'SCRUM-962d ④ ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const reglas = () => CSS.replace(/@media[^{]*\{/g, '').split('}')
  .map((b) => { const [sel, cuerpo = ''] = b.split('{'); return { sel: sel.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), cuerpo }; });
const con = (s) => reglas().filter((r) => r.sel.includes(s));
const PAREJA = [['.modal-header > .modal-ayuda', 'right'], ['.modal-header > .modal-close', 'left']];

test('SCRUM-962d ① · el «?» y el «×» tienen un `::before` de 44×44, posicionado, contra un padre relativo', () => {
  for (const [s] of PAREJA) {
    assert.ok(con(s).some((r) => /position:\s*relative/.test(r.cuerpo)),
      `🔴 ${s} no es \`position: relative\`: su \`::before\` se colocaría contra otro elemento.`);
    const p = con(`${s}::before`);
    assert.ok(p.length > 0, `🔴 no está \`${s}::before\`: vuelve a 27,5×26 / 30×30.`);
    const todo = p.map((r) => r.cuerpo).join(';');
    assert.match(todo, /position:\s*absolute/, `🔴 ${s}::before no es absoluto: empujaría la cabecera.`);
    assert.match(todo, /content:\s*""/, `🔴 ${s}::before sin \`content\`: no se pinta y no recibe el toque.`);
    assert.match(todo, /width:\s*44px/, `🔴 ${s}::before no mide 44 de ancho.`);
    assert.match(todo, /height:\s*44px/, `🔴 ${s}::before no mide 44 de alto.`);
  }
});

test('SCRUM-962d ② · cada uno crece HACIA FUERA de la pareja, nunca hacia el otro', () => {
  for (const [s, lado] of PAREJA) {
    const todo = con(`${s}::before`).map((r) => r.cuerpo).join(';');
    const otro = lado === 'right' ? 'left' : 'right';
    assert.match(todo, new RegExp(`(^|[;\\s])${lado}:\\s*0`), `🔴 ${s}::before no está anclado a su ${lado === 'right' ? 'derecha' : 'izquierda'}.`);
    assert.doesNotMatch(todo, new RegExp(`(^|[;\\s])${otro}:`),
      `🔴 ${s}::before declara \`${otro}\`: crece hacia el otro botón y le roba el toque del punto que hay entre los dos.`);
  }
});

test('SCRUM-962d ③ · el área ampliada está ACOTADA a la cabecera del modal (la tostada de error usa `.modal-close` a 24 px)', () => {
  const sueltas = reglas().flatMap((r) => r.sel).filter((s) => /\.(modal-close|modal-ayuda)::before/.test(s) && !/^\.modal-header > \.(modal-close|modal-ayuda)::before$/.test(s));
  assert.deepEqual(sueltas, [], `🔴 hay un \`::before\` de la pareja SIN acotar a \`.modal-header >\`: ${sueltas.join(' · ')}`);
});

test('SCRUM-962d ④ · `cabeceraModal` pinta el «?» y el «×» como hijos DIRECTOS de `.modal-header`', () => {
  const { ctx } = cargarDashboard(RAIZ);
  assert.equal(typeof ctx.cabeceraModal, 'function', '🔴 NO PUDE MIRAR: el banco no expone `cabeceraModal`.');
  const h = ctx.cabeceraModal({ titulo: 'Ajustes de la línea' });
  assert.equal(h.className, 'modal-header');
  const directos = h.hijos.map((n) => String(n.className));
  assert.ok(directos.includes('modal-ayuda'), `🔴 el «?» ya no es hijo directo de \`.modal-header\` (${directos.join(', ')}): la regla \`>\` no le llega.`);
  assert.ok(directos.includes('modal-close'), `🔴 el «×» ya no es hijo directo de \`.modal-header\` (${directos.join(', ')}): la regla \`>\` no le llega.`);
  // Control: la variante sin cierre sigue sin «×», y la ayuda sigue siendo directa.
  const s = ctx.cabeceraModal({ titulo: 'Editar cliente', sinCierre: true });
  assert.deepEqual(s.hijos.map((n) => String(n.className)), ['modal-title', 'modal-ayuda']);
});
