// docs/master/evidencias/SCRUM-1560f/d-censo-tactil.mjs — SCRUM-1560f · EL CENSO TÁCTIL, EN NAVEGADOR
//
// Dos pasadas de `scripts/censo-objetivo-tactil-panel.mjs` sobre este árbol (`origin/main`):
//   A · tal cual: ¿nombra en algún sitio los dos paneles de Configuración que con los datos de muestra
//       no pintan nada (`publica`, `cumplimiento`; los da `b-estados.mjs`)?
//   B · con `renderCobrosView` vaciada (la misma mutación que `c-mutar.mjs`, que allí lleva la vista de
//       29 a 0 nodos): ¿sale Cobros entre las que NO midió, o sale como medida y limpia?
// Control: en A, Cobros tiene que salir MEDIDA (si no, B no prueba nada); en B, el `public/` tiene que
// quedar limpio al acabar.
//
//   node docs/master/evidencias/SCRUM-1560f/d-censo-tactil.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const JS = path.join(RAIZ, 'public/dashboard/js');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1560f-censo-'));

if (execFileSync('git', ['status', '--porcelain', '--', 'public'], { cwd: RAIZ, encoding: 'utf8' }).trim()) {
  console.log('CIEGO · `public/` tiene cambios sin comitear.'); process.exit(2);
}

function localizar(fn) {
  for (const f of fs.readdirSync(JS).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(JS, f), 'utf8');
    if (!src.includes(fn)) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    let pos = null;
    const visita = (n) => { if (pos === null) { if (ts.isFunctionDeclaration(n) && n.name?.text === fn && n.body) pos = n.body.getStart(sf) + 1; else ts.forEachChild(n, visita); } };
    visita(sf);
    if (pos !== null) return { fichero: path.join(JS, f), src, pos };
  }
  return null;
}

function censo(nombre) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['scripts/censo-objetivo-tactil-panel.mjs'], { cwd: RAIZ, encoding: 'utf8', timeout: 900000 });
  const out = (r.stdout || '') + (r.stderr || '');
  fs.writeFileSync(path.join(OUT, `${nombre}.txt`), out);
  return { codigo: r.status, out, s: Math.round((Date.now() - t0) / 1000) };
}

const lineas = (out, re) => out.split('\n').filter((l) => re.test(l)).map((l) => l.trim().slice(0, 200));

const A = censo('A-tal-cual');
console.log(`A · tal cual: código ${A.codigo} · ${A.s} s · ${A.out.split('\n').length} líneas (salida entera en ${OUT})`);
const panelesA = lineas(A.out, /publica|cumplimiento|p[áa]gina p[úu]blica|Cumplimiento/i);
console.log(`  líneas que nombran «publica»/«cumplimiento»: ${panelesA.length}`);
for (const l of panelesA.slice(0, 8)) console.log(`    ${l}`);
const cobrosA = lineas(A.out, /renderCobrosView|Cobros/);
console.log(`  líneas que nombran Cobros: ${cobrosA.length}`);
for (const l of cobrosA.slice(0, 6)) console.log(`    ${l}`);

const l = localizar('renderCobrosView');
let B = null;
try {
  fs.writeFileSync(l.fichero, l.src.slice(0, l.pos) + ' return; ' + l.src.slice(l.pos));
  B = censo('B-cobros-vaciada');
} finally {
  fs.writeFileSync(l.fichero, l.src);
}
console.log(`\nB · Cobros vaciada: código ${B.codigo} · ${B.s} s`);
const cobrosB = lineas(B.out, /renderCobrosView|Cobros/);
console.log(`  líneas que nombran Cobros: ${cobrosB.length}`);
for (const x of cobrosB.slice(0, 8)) console.log(`    ${x}`);
const sucio = execFileSync('git', ['status', '--porcelain', '--', 'public'], { cwd: RAIZ, encoding: 'utf8' }).trim();
console.log(`\npublic/ al acabar: ${sucio ? 'SUCIO → ' + sucio : 'limpio'}`);
