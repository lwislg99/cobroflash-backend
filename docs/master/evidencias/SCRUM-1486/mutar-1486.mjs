// El ROJO de `tests/scrum1486-insertbefore-del-banco.test.mjs`, antes de empujar. Tres medidas:
//   ① BASE sin mutar ....... tiene que estar verde, o nada de lo de abajo vale.
//   ② EL BANCO DE ANTES .... `tests/_banco-vistas.mjs` tal como está en la ref dada, ENTERO.
//   ③ CADA MUTACIÓN ........ las que el propio test declara, leídas con el lector del meta-guard
//                            (si aquí salen «incompletas», el job del CI tampoco las vería).
// Cada escritura lleva su `git diff --numstat` al lado: un rojo que no se aplicó se lee igual que
// un verde. Se restaura por BYTES y se comprueba. El oficial es `npm run meta:mutaciones`.
//   node mutar-1486.mjs <raíz del worktree> <ref del banco de antes, p. ej. origin/main>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2]);
const REF = process.argv[3];
const REL_TEST = 'tests/scrum1486-insertbefore-del-banco.test.mjs';
const REL_BANCO = 'tests/_banco-vistas.mjs';
const TEST = path.join(RAIZ, REL_TEST);
const BANCO = path.join(RAIZ, REL_BANCO);
const env = { ...process.env }; delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const git = (...a) => execFileSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8' });
const fin = (codigo, porque) => { if (porque) console.log(porque); console.log(`EXIT=${codigo}`); process.exit(codigo); };

console.log(`CABECERA · HEAD ${git('rev-parse', 'HEAD').trim()} · banco de antes: ${REF} = ${git('rev-parse', REF).trim()} · node ${process.version}`);
const sucio = git('status', '--porcelain').trim();
if (sucio) fin(2, `🔴 el árbol NO está limpio: no muto encima de trabajo sin comitear\n${sucio}`);

const correr = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: RAIZ, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const lineas = (r.stdout || '').split('\n');
  const caidos = lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, '').trim());
  const total = Number((lineas.find((l) => /^# tests /.test(l)) || '').replace(/\D/g, '')) || 0;
  return { status: r.status, caidos, total };
};
const numstat = () => git('diff', '--numstat', '--', REL_BANCO).trim().replace(/\s+/g, ' ') || '🔴 VACÍO';

const { lecturaDeDeclaraciones } = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const { buenas: M, incompletas } = lecturaDeDeclaraciones(fs.readFileSync(TEST, 'utf8'), REL_TEST);
console.log(`POBLACION · ${M.length} mutaciones declaradas y legibles · ${incompletas.length} incompletas`);
if (!M.length || incompletas.length) fin(2, '🔴 el lector del meta-guard no ve bien las declaraciones: no hay nada que medir');

const base = correr();
console.log(`① BASE sin mutar · exit ${base.status} · ${base.total} pruebas · caídas ${base.caidos.length}`);
if (base.status !== 0 || !base.total) fin(2, '🔴 la BASE no está verde: no se muta nada');

const original = fs.readFileSync(BANCO);
let mal = 0;
const restaurar = () => { fs.writeFileSync(BANCO, original); return fs.readFileSync(BANCO).equals(original); };

// ② el banco de antes, entero
{
  let viejo = execFileSync('git', ['-C', RAIZ, 'show', `${REF}:${REL_BANCO}`]);
  // Mismos finales de línea que la copia de trabajo, o el numstat contaría el fichero entero.
  if (original.includes('\r\n') && !viejo.includes('\r\n')) viejo = Buffer.from(viejo.toString('utf8').replace(/\n/g, '\r\n'));
  let r; let ns;
  try { fs.writeFileSync(BANCO, viejo); ns = numstat(); r = correr(); } finally { if (!restaurar()) { mal++; console.log('🔴 NO RESTAURADO'); } }
  console.log(`② EL BANCO DE ANTES, ENTERO · numstat «${ns}» · exit ${r.status} · ${r.total} pruebas · caen ${r.caidos.length} de ${base.total}`);
  for (const c of r.caidos) console.log(`     CAE · ${c.slice(0, 100)}`);
  if (r.caidos.length !== base.total || !r.total) { mal++; console.log('     🔴 algún caso nuevo NO cae con el banco de antes'); }
}

// ③ cada mutación declarada
console.log('③ CADA MUTACIÓN DECLARADA');
const casosTumbados = new Set();
for (const [i, m] of M.entries()) {
  const f = path.join(RAIZ, m.fichero);
  const texto = fs.readFileSync(f, 'utf8');
  const veces = texto.split(m.de).length - 1;
  let fila;
  if (m.fichero !== REL_BANCO) { fila = `🔴 muta ${m.fichero}, y esta réplica sólo sabe restaurar el banco`; mal++; }
  else if (veces !== 1) { fila = `🔴 ANCLA: «de» casa ${veces} veces (tiene que ser 1)`; mal++; }
  else {
    let r; let ns;
    try { fs.writeFileSync(f, texto.replace(m.de, m.a)); ns = numstat(); r = correr(); } finally { if (!restaurar()) { mal++; console.log('🔴 NO RESTAURADO'); } }
    const suyo = r.caidos.find((c) => c.includes(m.cae));
    if (suyo) casosTumbados.add(suyo);
    fila = `numstat «${ns}» · exit ${r.status} · ${r.total} pruebas · cae lo suyo: ${suyo ? 'SÍ' : '🔴 NO'} · caídas ${r.caidos.length}`;
    if (!suyo || !r.total || ns.startsWith('🔴')) mal++;
  }
  console.log(`  ${String(i + 1).padStart(2)} · «${m.a.trim().slice(0, 44)}» → ${m.cae}\n        ${fila}`);
}
console.log(`CASOS DISTINTOS con alguna mutación que los tumba: ${casosTumbados.size} de ${base.total}`);
if (casosTumbados.size !== base.total) { mal++; console.log('🔴 hay casos sin ninguna mutación declarada'); }

const final = correr();
const limpio = git('status', '--porcelain').trim() === '';
console.log(`FINAL restaurado · exit ${final.status} · ${final.total} pruebas · caídas ${final.caidos.length} · árbol ${limpio ? 'limpio' : '🔴 SUCIO'}`);
console.log(`RESUMEN · ${M.length} mutaciones · fallos de la réplica: ${mal}`);
fin(mal || final.status || !limpio ? 1 : 0);
