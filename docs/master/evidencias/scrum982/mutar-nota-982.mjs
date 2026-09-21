// SCRUM-982 · BANCO DE MUTACIONES del test `tests/scrum982-la-nota-del-cliente-en-el-trabajo.test.mjs`.
//
// Primero la BASE sin mutar (un inestable parece un mutante muerto, A3); después cada inyección con su
// `git diff --numstat` al lado (A21 nº 3: una mutación que no se aplicó se lee igual que un éxito) y la
// reversión comprobada con `git status --porcelain`. Exige el árbol LIMPIO al empezar (A23 nº 9: si no,
// el `git restore` de la reversión se lleva trabajo sin comitear).
//
// Se corre DESDE la raíz del worktree (o pasándole la ruta):
//   node docs/master/evidencias/scrum982/mutar-nota-982.mjs
// Salidas: 0 = las 13 mutaciones caen donde se espera · 1 = alguna sin cazar · 2 = no supe medir.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WT = path.resolve(process.argv[2] || process.cwd());
const TEST = 'tests/scrum982-la-nota-del-cliente-en-el-trabajo.test.mjs';
const abs = (r) => path.join(WT, r);
const env = { ...process.env }; delete env.FORCE_COLOR; delete env.NODE_OPTIONS;

const git = (...a) => spawnSync('git', ['-C', WT, ...a], { encoding: 'utf8' });

function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: WT, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = r.stdout || '';
  const cae = [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1].replace(/\s+\([\d.]+ms\)$/, ''));
  const ok = [...out.matchAll(/^ok \d+ - (.*)$/gm)].length;
  const tests = Number((out.match(/^# tests (\d+)/m) || [])[1]);
  return { exit: r.status, ok, cae, tests };
}

const MUT = [
  { id: 'M1 notes en CUSTOMER_SELECT (la lista)', f: 'src/modules/jobs/app/routes/jobs.routes.ts',
    de: 'const CUSTOMER_SELECT = { id: true, name: true, phone: true, mobile: true } as const;',
    a: 'const CUSTOMER_SELECT = { id: true, name: true, phone: true, mobile: true, notes: true } as const;',
    espera: ['`notes` viaja en el DETALLE y NO en CUSTOMER_SELECT'] },
  { id: 'M2 el detalle deja de pedir notes', f: 'src/modules/jobs/app/routes/jobs.routes.ts',
    de: '        notes: true,\n', a: '',
    espera: ['`notes` viaja en el DETALLE y NO en CUSTOMER_SELECT'] },
  { id: 'M3 el customer devuelto no lleva notes', f: 'src/modules/jobs/app/routes/jobs.routes.ts',
    de: ', notes: c?.notes ?? null };', a: ' };',
    espera: ['y lo que se pide llega al JSON'] },
  { id: 'M4 serializeJobDetail se exporta', f: 'src/modules/jobs/app/routes/jobs.routes.ts',
    de: 'async function serializeJobDetail(job: any) {', a: 'export async function serializeJobDetail(job: any) {',
    espera: ['el serializador del detalle NO se exporta'] },
  { id: 'M5 el router de Trabajos se monta también en una ruta pública', f: 'src/app.ts',
    de: "mountAdmin(app, '/admin/jobs',       jobsRouter);    // A13 (JOB-1): trabajos",
    a: "mountAdmin(app, '/admin/jobs',       jobsRouter);    // A13 (JOB-1): trabajos\napp.use('/portal/trabajos', jobsRouter);",
    espera: ['ningún otro fichero de src/ importa el router de Trabajos'] },
  { id: 'M6 el router sale de /admin', f: 'src/app.ts',
    de: "mountAdmin(app, '/admin/jobs',       jobsRouter);", a: "app.use('/publico/jobs',       jobsRouter);",
    espera: ['ningún otro fichero de src/ importa el router de Trabajos'] },
  { id: 'M7 la nota sin recortar (sólo espacios cuenta como nota)', f: 'public/dashboard/js/jobRailBlocks.js',
    de: 'const nota = limpio(job && job.customer && job.customer.notes);', a: 'const nota = job && job.customer && job.customer.notes;',
    espera: ['CONTROL NEGATIVO: sin nota, o sólo espacios', 'se recortan los EXTREMOS'] },
  { id: 'M8 rótulo con dos puntos', f: 'public/dashboard/js/jobRailBlocks.js',
    de: "const ROTULO_NOTA_DEL_CLIENTE = 'Nota del cliente';", a: "const ROTULO_NOTA_DEL_CLIENTE = 'Nota del cliente:';",
    espera: ['el rótulo firmado, carácter a carácter'] },
  { id: 'M9 la vista no pone la clase de la nota', f: 'public/dashboard/js/jobDetailView.js',
    de: "if (linea.nota) fila.classList.add('detail-rail-linea--nota');", a: '',
    espera: ['la ficha PINTA la nota entera'] },
  { id: 'M10 la nota entra por innerHTML', f: 'public/dashboard/js/jobDetailView.js',
    de: "txt.textContent = (linea.icono ? `${linea.icono} ` : '') + linea.texto;",
    a: "if (linea.nota) txt.innerHTML = linea.texto; else txt.textContent = (linea.icono ? `${linea.icono} ` : '') + linea.texto;",
    espera: ['la nota entra por `textContent`'] },
  { id: 'M11 el CSS pierde pre-line', f: 'public/dashboard/css/styles.css',
    de: '{ white-space: pre-line; overflow-wrap: anywhere; }', a: '{ overflow-wrap: anywhere; }',
    espera: ['el CSS pone la etiqueta encima'] },
  { id: 'M12 el CSS recorta la nota', f: 'public/dashboard/css/styles.css',
    de: '{ white-space: pre-line; overflow-wrap: anywhere; }', a: '{ white-space: pre-line; overflow-wrap: anywhere; max-height: 4.5em; overflow: hidden; }',
    espera: ['el CSS pone la etiqueta encima'] },
  { id: 'M13 el CSS deja la etiqueta al lado', f: 'public/dashboard/css/styles.css',
    de: '.detail-rail-linea--nota { flex-direction: column; align-items: stretch; gap: 2px; margin-top: 8px; }', a: '.detail-rail-linea--nota { gap: 2px; margin-top: 8px; }',
    espera: ['el CSS pone la etiqueta encima'] },
];

if (git('status', '--porcelain').stdout.trim() !== '') {
  console.log('🔴 el árbol NO está limpio: commitea todo antes de inyectar (A23 nº 9).');
  process.exit(2);
}
const base = correr();
console.log(`BASE sin mutar: exit=${base.exit} tests=${base.tests} ok=${base.ok} caen=${JSON.stringify(base.cae)}`);
if (base.exit !== 0 || base.cae.length || !base.tests) { console.log('🔴 BASE NO VERDE: se aborta (un inestable parece un mutante muerto).'); process.exit(2); }

let mal = 0;
for (const m of MUT) {
  const f = abs(m.f);
  const antes = fs.readFileSync(f, 'utf8');
  const veces = antes.split(m.de).length - 1;
  if (veces !== 1) { console.log(`${m.id}: 🔴 ANCLA: «${m.de.slice(0, 50)}…» aparece ${veces} veces (debe ser 1). NO SE INYECTA.`); mal++; continue; }
  fs.writeFileSync(f, antes.replace(m.de, () => m.a));
  const ns = git('diff', '--numstat', '--', m.f).stdout.trim();
  const r = correr();
  git('restore', '--source=HEAD', '--staged', '--worktree', '--', m.f);
  const limpio = git('status', '--porcelain').stdout.trim() === '';
  const cazado = m.espera.every((e) => r.cae.some((c) => c.includes(e)));
  console.log(`${m.id}\n   numstat: ${ns || '(VACÍO: no se aplicó)'} · exit=${r.exit} tests=${r.tests} caen=${r.cae.length} · esperado cae: ${cazado ? 'SÍ ✅' : 'NO ❌'} · árbol restaurado: ${limpio ? 'sí' : 'NO ❌'}`);
  if (!cazado || !ns || !limpio) { mal++; console.log('   cayeron: ' + JSON.stringify(r.cae)); }
}
console.log(mal === 0 ? `TODAS LAS MUTACIONES (${MUT.length}) CAZADAS` : `🔴 ${mal} sin cazar`);
process.exit(mal === 0 ? 0 : 1);
