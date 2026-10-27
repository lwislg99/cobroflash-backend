// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1524 · LOS NÚMEROS QUE DECIDEN ENTRE IMPEDIR, AVISAR O EXIGIR TOCAR LA CITA EN EL MISMO PR.
//
// Tres preguntas, las tres con su población:
//   ① ¿Cada cuánto toca un PR un fichero citado desde `docs/legal/`?  (lo que costaría un guard
//      que saltara al MOVERSE una línea citada)
//   ② ¿Cada cuánto se BORRA o se renombra uno?                        (lo que costaría uno que
//      saltara sólo al DESAPARECER el fichero)
//   ③ ¿Qué coordenadas escritas en `docs/legal/` NO ve el extractor de la casa?
// Sólo lee. Uso: node numeros-para-decidir.mjs [ref]   (por defecto origin/main)
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { analizar, coordenadasDe, POBLACION } from '../../../../scripts/_anclas-con-testigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const REF = process.argv[2] || 'origin/main';
const git = (...a) => execFileSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }).trimEnd();
const lineasDe = (s) => s.split('\n').filter(Boolean);

const lista = lineasDe(git('ls-tree', '-r', '--name-only', 'HEAD'));
const R = analizar(RAIZ);
const resolver = (ruta) => lista.filter((f) => f === ruta || f.endsWith('/' + ruta));
const citados = new Set();
let sinResolver = 0;
for (const c of R.juzgadas) { const f = resolver(c.ruta); if (f.length === 1) citados.add(f[0]); else sinResolver += 1; }
const F = [...citados].sort();
const sinMaster = F.filter((f) => f !== 'docs/YAQU_MASTER.md' && !f.startsWith('docs/legal/'));

console.log(`${REF} = ${git('rev-parse', '--short=9', REF)} · HEAD = ${git('rev-parse', '--short=9', 'HEAD')}`);
console.log(`Ficheros citados desde ${POBLACION}/ que resuelven a UNO: ${F.length} (coordenadas que no: ${sinResolver})`);
console.log(`   de ellos, fuera de docs/legal/ y sin contar el máster: ${sinMaster.length}`);

// ── ① PR que tocan un fichero citado ────────────────────────────────────────────────────────
for (const dias of [7, 30]) {
  const prs = lineasDe(git('log', '--first-parent', '--merges', `--since=${dias}.days`, '--format=%H', REF));
  const tocan = (conj) => prs.filter((sha) => {
    const cambiados = lineasDe(git('diff', '--name-only', `${sha}^1`, sha));
    return cambiados.some((f) => conj.has(f));
  }).length;
  const a = tocan(citados);
  const b = tocan(new Set(sinMaster));
  console.log(`\n① Últimos ${dias} días · ${prs.length} PR mergeados en ${REF}`);
  console.log(`   tocan algún fichero citado:                              ${a}  (${prs.length ? Math.round(100 * a / prs.length) : 0} %)`);
  console.log(`   ídem sin contar el máster ni los propios docs/legal:     ${b}  (${prs.length ? Math.round(100 * b / prs.length) : 0} %)`);
}

// ── ② Borrados y renombrados de ficheros que ALGUNA VEZ se citaron ──────────────────────────
// Población: toda ruta citada en CUALQUIER versión de cualquier documento, no sólo en la de hoy.
const alguna = new Set();
let versiones = 0;
for (const doc of R.ficheros) {
  for (const sha of lineasDe(git('log', '--format=%H', '--', doc))) {
    versiones += 1;
    let t; try { t = git('show', `${sha}:${doc}`); } catch { continue; }
    for (const c of coordenadasDe(t)) alguna.add(c.ruta);
  }
}
const primero = git('log', '--reverse', '--format=%H %cs', '--', POBLACION).split('\n')[0];
const [sha0, fecha0] = primero.split(' ');
const idos = lineasDe(git('log', '--diff-filter=DR', '--name-status', '--format=', `${sha0}..${REF}`))
  .map((l) => l.split('\t')).filter((p) => p.length >= 2).map((p) => ({ tipo: p[0][0], ruta: p[1] }));
const citadosIdos = idos.filter((x) => [...alguna].some((r) => x.ruta === r || x.ruta.endsWith('/' + r)));
console.log(`\n② Desde el primer commit de ${POBLACION}/ (${sha0.slice(0, 9)}, ${fecha0}) hasta ${REF}:`);
console.log(`   ${versiones} versiones de documento leídas · ${alguna.size} rutas citadas alguna vez`);
console.log(`   ficheros borrados o renombrados en todo el repositorio: ${idos.length}`);
console.log(`   de ellos, citados alguna vez desde ${POBLACION}/:           ${citadosIdos.length}`);
for (const x of citadosIdos) console.log(`      · ${x.tipo === 'D' ? 'BORRADO' : 'RENOMBRADO'} ${x.ruta}`);

// ── ③ Lo que el extractor de la casa no ve ──────────────────────────────────────────────────
// Un patrón más ancho a propósito: cualquier `algo.ext:NN`, con o sin acentos graves, cualquier
// extensión. No es un criterio mejor: es un control de cuánto queda fuera del de la casa.
const ANCHO = /([\w./-]+\.[A-Za-z]{1,8}):(\d+)(?:-(\d+))?/g;
let ancho = 0; let casa = 0; const fuera = {};
for (const doc of R.ficheros) {
  const txt = fs.readFileSync(path.join(RAIZ, doc), 'utf8');
  const suyas = new Set(coordenadasDe(txt).map((c) => `${c.ruta}:${c.a}`));
  casa += coordenadasDe(txt).filter((c) => !c.tachada).length;
  for (const m of txt.matchAll(ANCHO)) {
    ancho += 1;
    if (suyas.has(`${m[1]}:${m[2]}`)) continue;
    const ext = m[1].split('.').pop();
    (fuera[ext] ||= []).push(`${doc.slice(POBLACION.length + 1)} → ${m[0]}`);
  }
}
console.log(`\n③ Patrón ancho: ${ancho} apariciones de «fichero.ext:NN» en ${R.ficheros.length} documentos · la casa ve ${casa} vivas`);
const n = Object.values(fuera).reduce((s, v) => s + v.length, 0);
console.log(`   apariciones que NO están entre las coordenadas de la casa: ${n}`);
for (const [ext, v] of Object.entries(fuera).sort((x, y) => y[1].length - x[1].length)) console.log(`      .${ext.padEnd(8)} ${String(v.length).padStart(3)}   p. ej. ${v[0].slice(0, 110)}`);
const sub = lista.filter((f) => f.startsWith(POBLACION + '/') && f.slice(POBLACION.length + 1).includes('/'));
console.log(`   ficheros en subcarpetas de ${POBLACION}/ que el censo no recorre: ${sub.length} (${sub.filter((f) => f.endsWith('.md')).length} son .md)`);
