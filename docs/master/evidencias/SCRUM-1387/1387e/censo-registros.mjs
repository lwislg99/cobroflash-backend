#!/usr/bin/env node
// SCRUM-1387e · ¿Qué fracción de los tests repite de verdad el CI, y qué afirman los registros
// que hablan de mutaciones frente a lo que el árbol permite comprobar?
//
// Reconstrucción de S3, NO el instrumento de J6i del 1-oct (`~/yaqu-censos/j6i-1oct/`, que nunca
// entró en git). Mismas clases (A, B, C1, C2, C3); el criterio de cada una va escrito abajo. Para
// saber si la reconstrucción mide lo mismo, se corre también sobre el árbol del 1-oct (`--raiz`)
// y se coteja con las cifras publicadas en la descripción del ticket.
//
// Uso:
//   node censo-registros.mjs [--raiz <dir con docs/master y tests>] [--log <log del job meta-guard>]
//                            [--lista <fichero de salida con una fila por registro>]
// Salida: 0 medido · 2 CIEGO (población vacía o control positivo fuera de su clase).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(AQUI, '../../../../..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const RAIZ = path.resolve(arg('--raiz') ?? REPO);
const LOG = arg('--log');
const LISTA = arg('--lista');
const ciego = (m) => { console.log(`CIEGO · ${m}`); process.exit(2); };

// El catálogo se lee con el MISMO lector del meta-guard del árbol actual (no con una copia).
const { censoConPoblacion } = await import(pathToFileURL(path.join(REPO, 'scripts/meta-guard-mutaciones.mjs')).href);
const DIR_TESTS = path.join(RAIZ, 'tests');
const DIR_MASTER = path.join(RAIZ, 'docs/master');
const DIR_EVID = path.join(DIR_MASTER, 'evidencias');
const cat = censoConPoblacion(DIR_TESTS);
const declaradasPor = new Map(cat.censo.filter((c) => c.mutaciones.length).map((c) => [c.guard, c.mutaciones.length]));
const testsDelArbol = fs.readdirSync(DIR_TESTS).filter((x) => x.endsWith('.test.mjs'));
if (!testsDelArbol.length || !declaradasPor.size) ciego(`tests ${testsDelArbol.length}, declarantes ${declaradasPor.size}`);

// ── ① Lo que el CI repite DE VERDAD: el corte deja guards sin juzgar (SCRUM-935d/1620). ──────────
// Del log se lee la lista «SIN JUZGAR N, en K guard(s):» y cada «· fichero (n)». Un guard con n igual
// a sus declaradas no tiene NINGUNA juzgada; con n menor, juzgada a medias.
let ci = null;
if (LOG) {
  const t = fs.readFileSync(LOG, 'utf8').split(/\r?\n/).map((l) => l.replace(/^\S+Z /, ''));
  const i = t.findIndex((l) => /Juzgadas \d+ de \d+ mutaciones\. SIN JUZGAR \d+, en \d+ guard/.test(l));
  if (i < 0) ciego('el log no trae la lista de lo SIN JUZGAR (¿sin corte, o no es el log del meta-guard?)');
  const [, juz, tot, sin, k] = t[i].match(/Juzgadas (\d+) de (\d+) mutaciones\. SIN JUZGAR (\d+), en (\d+)/).map(Number);
  const pend = new Map();
  for (const l of t.slice(i + 1)) { const m = l.match(/^\s+· (\S+\.test\.mjs) \((\d+)\)$/); if (!m) break; pend.set(m[1], Number(m[2])); }
  const sumaPend = [...pend.values()].reduce((a, b) => a + b, 0);
  if (pend.size !== k || sumaPend !== sin) ciego(`lista del corte: ${pend.size} guards / ${sumaPend} mutaciones, el rótulo dice ${k} / ${sin}`);
  let nada = 0, medias = 0, desconocidos = 0;
  for (const [g, n] of pend) {
    const d = declaradasPor.get(g);
    if (d == null) desconocidos += 1; else if (n >= d) nada += 1; else medias += 1;
  }
  ci = { juz, tot, sin, k, nada, medias, desconocidos, conAlguna: declaradasPor.size - nada, pend };
}

// ── ② Los registros que AFIRMAN mutaciones, por clase ───────────────────────────────────────────
// Registro = docs/master/SCRUM-<n><sufijo>.md; se agrupa por el número (1387, 1387b… → 1387).
// «Afirma» = el texto nombra mutación/mutante/mutado (palabra entera, sin distinguir mayúsculas).
// Test PROPIO de n = tests/scrum<n><letras>-….test.mjs (o `scrum<n>.test.mjs`).
// Test NOMBRADO = cualquier `<x>.test.mjs` citado en el texto del registro.
// `--estricto`: sólo cuenta el registro que da un VEREDICTO de mutación (viva/cae/muerta a menos de
// 80 caracteres de «mutación»). Ningún criterio reproduce los 299 de J6i (409 ancho, 185 estricto
// sobre su árbol): se dan los dos, y lo que se compara entre ellos es la PROPORCIÓN fuera.
const AFIRMA = /\bmuta(ci[oó]n|ciones|nte|ntes|do|da|dos|das|r)\b/i;
const AFIRMA_REGISTRO = process.argv.includes('--estricto')
  ? /mutaci[oó]n(es)?[^\n]{0,80}\b(viva|vivas|cae|caen|muerta|muertas)\b/i
  : AFIRMA;
const registros = new Map();
for (const f of fs.readdirSync(DIR_MASTER)) {
  const m = f.match(/^SCRUM-0*(\d+)[a-z0-9-]*\.md$/i);
  if (!m) continue;
  const n = m[1];
  const r = registros.get(n) ?? { n, ficheros: [], texto: '' };
  r.ficheros.push(f); r.texto += fs.readFileSync(path.join(DIR_MASTER, f), 'utf8') + '\n';
  registros.set(n, r);
}
if (!registros.size) ciego('0 registros en docs/master');

// Dos raíces de evidencias conviven en el árbol: `docs/master/evidencias/` y `docs/evidencias/`
// (la segunda la cazó la muestra a mano: SCRUM-1388 vive allí y salía «texto»).
const RAICES_EVID = [DIR_EVID, path.join(RAIZ, 'docs/evidencias')].filter((d) => fs.existsSync(d));
function evidenciasDe(n) {
  const re = new RegExp(`^(SCRUM-|scrum)0*${n}(?![0-9])`, 'i');
  const out = [];
  const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, e.name); e.isDirectory() ? walk(q) : out.push(q); } };
  for (const raiz of RAICES_EVID) {
    for (const d of fs.readdirSync(raiz).filter((x) => re.test(x))) {
      const abs = path.join(raiz, d);
      if (fs.statSync(abs).isDirectory()) walk(abs); else out.push(abs);
    }
  }
  return out;
}
// Lo que el árbol permite comprobar de una afirmación FUERA del catálogo:
//  guion  → hay en git un .mjs de evidencias que muta (`replace(` sobre fuente + menciona mutación):
//           se puede volver a correr a mano, pero nadie lo repite.
//  salida → sólo salidas guardadas (.txt/.json) que hablan de mutaciones: un acta, no un instrumento.
//  texto  → nada en evidencias: la afirmación vive sólo en el párrafo.
function comprobable(n) {
  const fs_ = evidenciasDe(n);
  const guion = fs_.filter((f) => /\.m?js$/.test(f)).some((f) => { const c = fs.readFileSync(f, 'utf8'); return AFIRMA.test(c) && /\.replace\(|writeFileSync|aplicarUna/.test(c); });
  if (guion) return 'guion';
  const salida = fs_.filter((f) => /\.(txt|json|tsv|md)$/.test(f)).some((f) => AFIRMA.test(fs.readFileSync(f, 'utf8')));
  return salida ? 'salida' : 'texto';
}

const filas = [];
for (const r of registros.values()) {
  if (!AFIRMA_REGISTRO.test(r.texto)) continue;
  const reProp = new RegExp(`^scrum0*${r.n}(?:[a-z]+)?(?:-|\\.test\\.mjs$)`, 'i');
  const propios = testsDelArbol.filter((x) => reProp.test(x));
  const nombrados = [...new Set(r.texto.match(/[\w.-]+\.test\.mjs/g) ?? [])].filter((x) => !propios.includes(x));
  let clase;
  if (propios.length) clase = propios.some((x) => declaradasPor.has(x)) ? 'A' : 'B';
  else if (nombrados.length) clase = nombrados.some((x) => declaradasPor.has(x)) ? 'C1' : 'C2';
  else clase = 'C3';
  // Para A: ¿alguno de sus tests en el catálogo tiene hoy AL MENOS una mutación juzgada en el CI?
  let juzgadaEnCI = null;
  if (clase === 'A' && ci) juzgadaEnCI = propios.filter((x) => declaradasPor.has(x)).some((x) => !(ci.pend.has(x) && ci.pend.get(x) >= declaradasPor.get(x)));
  filas.push({ n: r.n, clase, propios: propios.length, comprobable: clase === 'A' || clase === 'C1' ? '-' : comprobable(r.n), juzgadaEnCI });
}

// Control positivo: 1387 tiene su test en el catálogo (1387d declaró 4). Si el instrumento no lo ve
// como A, no sabe leer el catálogo o los nombres, y su cuenta no vale. Sólo en el árbol de hoy.
const c1387 = filas.find((f) => f.n === '1387');
if (!arg('--raiz') && c1387?.clase !== 'A') ciego(`control positivo: SCRUM-1387 sale ${c1387?.clase ?? 'ausente'}, debía ser A`);

const por = (k, v) => filas.filter((f) => f[k] === v).length;
const fuera = filas.filter((f) => ['B', 'C2', 'C3'].includes(f.clase));
console.log(`raíz ${path.relative(REPO, RAIZ) || '.'} · tests ${testsDelArbol.length} · declarantes ${declaradasPor.size} (${Math.round((100 * declaradasPor.size) / testsDelArbol.length)} %) · declaraciones ${[...declaradasPor.values()].reduce((a, b) => a + b, 0)}`);
if (ci) {
  console.log(`CI · juzgadas ${ci.juz} de ${ci.tot} · SIN JUZGAR ${ci.sin} en ${ci.k} guards: ${ci.nada} sin NINGUNA juzgada, ${ci.medias} a medias, ${ci.desconocidos} fuera del catálogo de este árbol`);
  console.log(`CI · ficheros con al menos una mutación repetida: ${ci.conAlguna} de ${testsDelArbol.length} (${((100 * ci.conAlguna) / testsDelArbol.length).toFixed(1)} %)`);
}
console.log(`registros ${registros.size} · afirman mutaciones ${filas.length} (criterio ${process.argv.includes('--estricto') ? 'estricto: con veredicto' : 'ancho: las nombra'})`);
console.log(`  A ${por('clase', 'A')} · B ${por('clase', 'B')} · C1 ${por('clase', 'C1')} · C2 ${por('clase', 'C2')} · C3 ${por('clase', 'C3')} · fuera (B+C2+C3) ${fuera.length}`);
console.log(`  fuera, por lo que el árbol permite comprobar: guion ${fuera.filter((f) => f.comprobable === 'guion').length} · salida ${fuera.filter((f) => f.comprobable === 'salida').length} · texto ${fuera.filter((f) => f.comprobable === 'texto').length}`);
if (ci) console.log(`  A con algún test juzgado en el CI de ese log: ${filas.filter((f) => f.juzgadaEnCI === true).length} de ${por('clase', 'A')}`);
if (LISTA) fs.writeFileSync(LISTA, filas.map((f) => [f.n, f.clase, f.propios, f.comprobable, f.juzgadaEnCI ?? '-'].join('\t')).join('\n') + '\n');
