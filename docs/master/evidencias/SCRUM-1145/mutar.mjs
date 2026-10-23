// Rojo primero y mutaciones de SCRUM-1145. Restaura SIEMPRE el fichero (y comprueba el contenido).
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
const RAIZ = process.argv[2];
const F = RAIZ + '/public/dashboard/js/customerDetailView.js';
const BUENO = fs.readFileSync(F, 'utf8');
const MAIN = execFileSync('git', ['-C', RAIZ, 'show', 'origin/main:public/dashboard/js/customerDetailView.js'], { encoding: 'utf8' });

function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/scrum1145-pestana-sitios.test.mjs'], { cwd: RAIZ, encoding: 'utf8', env: (() => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; delete e.NODE_OPTIONS; delete e.FORCE_COLOR; return e; })() });
  const out = r.stdout || '';
  const n = (k) => Number((out.match(new RegExp('^# ' + k + ' (\\d+)', 'm')) || [])[1]);
  const caidos = out.split('\n').filter((l) => /^not ok \d+ /.test(l)).map((l) => l.replace(/^not ok \d+ - /, '').slice(0, 70));
  return { tests: n('tests'), pass: n('pass'), fail: n('fail'), skip: n('skipped'), caidos, bytes: out.length };
}

const MUTACIONES = [
  ['BASE (sin mutar)', (s) => s],
  ['main (sin la pestaña)', () => MAIN],
  ['pide los sitios al pintar la ficha', (s) => s.replace("  const tabSitios = makeTab(", "  apiRequest(`/admin/customers/${id}/sites`).catch(() => null);\n  const tabSitios = makeTab(")],
  ['sin fila fiscal', (s) => s.replace('const filaFiscal = fiscal ? fila(T.fiscal, fiscal) : null;', 'const filaFiscal = null;')],
  ['borrar pregunta', (s) => s.replace('    function borrar(s, boton) {\n', '    function borrar(s, boton) {\n      if (!window.confirm(T.eliminar)) return;\n')],
  ['en blanco viaja ""', (s) => s.replace("out[k] = k === 'name' ? t : (t === '' ? null : t);", 'out[k] = t;')],
  ['sin «Cómo llegar» en los sitios', (s) => s.replace('        if (llegar) acciones.appendChild(llegar);\n', '')],
  ['el error de carga dice «no hay sitios»', (s) => s.replace("        avisar(window.mensajeParaPersona(err, T.errorCarga));", '        pintarLista([]);')],
  ['PUT al id equivocado', (s) => s.replace('`/admin/customers/${id}/sites/${sitio.id}`', '`/admin/customers/${id}/sites/${id}`')],
];

const filas = [];
try {
  for (const [nombre, mutar] of MUTACIONES) {
    const nuevo = mutar(BUENO);
    if (nombre !== 'BASE (sin mutar)' && nuevo === BUENO) { filas.push({ nombre, veredicto: 'NO APLICÓ (el patrón no casa)' }); continue; }
    fs.writeFileSync(F, nuevo);
    const r = correr();
    const ciego = !(r.tests > 0) || r.pass + r.fail + r.skip !== r.tests;
    filas.push({ nombre, veredicto: ciego ? 'CIEGO' : (r.fail > 0 ? 'MUERE' : 'VIVE'), ...r });
  }
} finally {
  fs.writeFileSync(F, BUENO);
}
const ok = fs.readFileSync(F, 'utf8') === BUENO;
for (const f of filas) console.log(JSON.stringify(f));
console.log('restaurado por contenido:', ok);
