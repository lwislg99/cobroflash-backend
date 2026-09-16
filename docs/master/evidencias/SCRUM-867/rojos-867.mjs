// docs/master/evidencias/SCRUM-867/rojos-867.mjs — los seis rojos de SCRUM-867, vistos caer
//
//   node docs/master/evidencias/SCRUM-867/rojos-867.mjs      (desde la raíz, con el árbol limpio)
//
// EVIDENCIA, NO GUARD. Devuelve a la vida el modal retirado por cada una de las vías por las que un
// fichero del panel puede seguir vivo, y comprueba que cae el test de
// `tests/scrum867-el-modal-muerto.test.mjs` que tiene que caer. Después de cada mutación restaura
// todos los ficheros tocados byte a byte y vuelve a borrar el fichero resucitado.
//
// 🔴 CADA MUTACIÓN SE COMPRUEBA APLICADA ANTES DE CORRER: un rojo que no aparece puede ser una
// mutación que no entró, y eso no es «el guard vigila» sino «no se probó».
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const ANTES = '77ce9d1e86d6ffa921b1c92561ec2d7994f8e5eb';   // origin/main al partir la rama
const TEST = path.join(RAIZ, 'tests', 'scrum867-el-modal-muerto.test.mjs');
const MODAL_REL = 'public/dashboard/js/nuevaFacturaModal.js';

const INDICE = 'public/dashboard/index.html';
const SW = 'public/sw.js';
const VISTA = 'public/dashboard/js/invoicesView.js';
const OTRO_TEST = 'tests/scrum600b-la-factura-usa-el-front.test.mjs';
const TOCADOS = [INDICE, SW, VISTA, OTRO_TEST];

const abs = (rel) => path.join(RAIZ, rel);
const ORIGINALES = new Map(TOCADOS.map((rel) => [rel, fs.readFileSync(abs(rel))]));
const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });

const MUTACIONES = [
  {
    rojo: 'a', debeCaer: '①', fichero: null,
    que: 'el fichero vuelve al árbol',
    aplicar: () => fs.writeFileSync(abs(MODAL_REL), git('show', `${ANTES}:${MODAL_REL}`)),
  },
  {
    rojo: 'b', debeCaer: '②', fichero: INDICE,
    que: 'el índice vuelve a cargarlo con un <script>',
    de: '</head>',
    a: '  <script src="./js/nuevaFacturaModal.js"></script>\n</head>',
  },
  {
    rojo: 'c', debeCaer: '③', fichero: SW,
    que: 'el SHELL del service worker vuelve a precachearlo',
    de: 'const SHELL = [',
    a: "const SHELL = [\n  '/dashboard/js/nuevaFacturaModal.js',",
  },
  {
    rojo: 'd', debeCaer: '④', fichero: VISTA,
    que: 'un script del panel vuelve a llamarlo',
    de: "        if (window.renderAppView) window.renderAppView('invoices-new');",
    a: "        if (window.renderAppView) window.renderAppView('invoices-new');\n        if (false) openNuevaFacturaModal(function () {});",
  },
  {
    rojo: 'e', debeCaer: '⑤', fichero: OTRO_TEST,
    que: 'un instrumento vuelve a MONTARLO',
    de: 'const respirar = () => new Promise((r) => setTimeout(r, 60));',
    a: 'const respirar = () => new Promise((r) => setTimeout(r, 60));\nfunction __rojo867(banco) { banco.ctx.openNuevaFacturaModal(function () {}); }',
  },
  {
    rojo: 'f', debeCaer: '⑥', fichero: VISTA,
    que: 'el botón de la lista vuelve a abrir el modal en vez de navegar',
    de: "        if (window.renderAppView) window.renderAppView('invoices-new');",
    a: '        if (window.openNuevaFacturaModal) window.openNuevaFacturaModal(function () {});',
  },
];

function correrTest() {
  try {
    return execFileSync(process.execPath, ['--test', TEST], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return String(e.stdout || '') + String(e.stderr || '');
  }
}

const falladosDe = (salida) => [...new Set(salida.split(/\r?\n/)
  .filter((l) => /^✖ SCRUM-867 · /.test(l))
  .map((l) => l.replace(/^✖ SCRUM-867 · /, '').replace(/\s*\(\d+(\.\d+)?ms\)\s*$/, '')))];

function restaurarTodo() {
  for (const [rel, bytes] of ORIGINALES) fs.writeFileSync(abs(rel), bytes);
  if (fs.existsSync(abs(MODAL_REL))) fs.unlinkSync(abs(MODAL_REL));
  const igual = [...ORIGINALES].every(([rel, bytes]) => Buffer.compare(fs.readFileSync(abs(rel)), bytes) === 0);
  return igual && !fs.existsSync(abs(MODAL_REL));
}

let malos = 0;
try {
  const base = falladosDe(correrTest());
  if (base.length) {
    console.log(`🔴 CON EL ÁRBOL INTACTO ya fallan: ${base.join(' | ')}. No se puede probar ningún rojo.`);
    process.exit(2);
  }
  console.log('✅ árbol intacto: scrum867 en verde\n');

  for (const m of MUTACIONES) {
    if (m.aplicar) {
      m.aplicar();
    } else {
      const fuente = ORIGINALES.get(m.fichero).toString('utf8');
      const veces = fuente.split(m.de).length - 1;
      if (veces !== 1) {
        console.log(`🔴 ${m.rojo}) NO SE PUDO APLICAR: el ancla aparece ${veces} veces en ${m.fichero}. Esto NO es un rojo probado.`);
        malos++;
        continue;
      }
      fs.writeFileSync(abs(m.fichero), fuente.replace(m.de, m.a));
    }

    const caidos = falladosDe(correrTest());
    if (!restaurarTodo()) {
      console.log('🔴 EL ÁRBOL NO QUEDÓ RESTAURADO BYTE A BYTE. Paro.');
      process.exit(3);
    }
    const cayoElQueToca = caidos.some((t) => t.startsWith(m.debeCaer));
    console.log(`${cayoElQueToca ? '✅' : '🔴'} ${m.rojo}) «${m.que}» → caen ${caidos.length}: ${caidos.map((t) => t.slice(0, 55)).join(' | ') || '(ninguno)'}`);
    if (!cayoElQueToca) malos++;
  }
} finally {
  restaurarTodo();
}

const intacto = restaurarTodo();
const final = falladosDe(correrTest());
console.log(`\nárbol restaurado byte a byte: ${intacto ? 'sí' : '🔴 NO'} · scrum867 tras restaurar: ${final.length ? '🔴 ' + final.join(' | ') : '✅ verde'}`);
console.log(malos ? `\n🔴 ${malos} rojo(s) sin probar` : `\n✅ los ${MUTACIONES.length} rojos, vistos caer`);
process.exit(malos || final.length || !intacto ? 1 : 0);
