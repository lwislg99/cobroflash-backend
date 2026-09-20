// SCRUM-970 · ¿de verdad la CIFRA entra mal sin conflicto mientras los COMENTARIOS sí chocan?
//
//   node docs/master/evidencias/scrum970/colision-del-contador.mjs [--fichero <ruta>]
//
// No se razona sobre git: se EJECUTA git. Se fabrican dos ramas —cada una añade SU guard, como
// hicieron 888 y 904, o 915d y 947— y se hace el merge de tres vías de verdad con `git merge-file`,
// que es el mismo motor que resuelve un merge normal.
//
// Lo que se mira, y son dos preguntas distintas:
//   ① ¿sale marca de conflicto? (o sea: ¿se entera alguien?)
//   ② ¿qué número queda? La verdad son 32 (30 + 1 + 1). Cualquier otra cosa es una cifra que
//      entró mal.
//
// Un resultado con conflicto Y número correcto no existe aquí: el objetivo es que el conflicto
// caiga DONDE está la cifra, no al lado.
//
// Sólo escribe en el temporal del SISTEMA (SCRUM-824) y no toca el repositorio.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 ? process.argv[i + 1] : null; };
const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const FICHERO = arg('fichero') || path.join(RAIZ, 'tests', 'scrum522-guards-fuera-de-la-tanda.test.mjs');

const base = fs.readFileSync(FICHERO, 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum970-'));

/** La forma VIEJA: una cifra a mano en el `assert`, y comentarios encima. */
function ramaVieja(txt, ticket, guard) {
  const cifra = txt.match(/assert\.equal\(fuera\.length, (\d+),/);
  if (!cifra) return null;
  const n = Number(cifra[1]);
  return txt
    // cada rama añade SU comentario justo antes del assert, como manda el fichero
    .replace(/(\n  assert\.equal\(fuera\.length, )/,
      `\n  // ${ticket} · entra \`${guard}\`. Su motivo propio, distinto del de los demás.$1`)
    // …y sube el contador, cada una por su guard: LAS DOS ESCRIBEN EL MISMO NÚMERO
    .replace(`assert.equal(fuera.length, ${n},`, `assert.equal(fuera.length, ${n + 1},`)
    .replace(`~~${n - 1}~~ ${n} →`, `~~${n - 1}~~ ~~${n}~~ ${n + 1} →`);
}

/** La forma NUEVA: la cifra se deriva de una lista declarada, un guard por línea. */
function ramaNueva(txt, ticket, guard) {
  const marca = '];\n';
  const i = txt.indexOf(marca);
  if (i === -1) return null;
  return txt.slice(0, i) + `  // ${ticket} · su motivo propio.\n  '${guard}',\n` + txt.slice(i);
}

function mergear(nombre, base, a, b) {
  const fa = path.join(tmp, `${nombre}-a`), fb = path.join(tmp, `${nombre}-b`), fo = path.join(tmp, `${nombre}-o`);
  fs.writeFileSync(fa, a); fs.writeFileSync(fb, b); fs.writeFileSync(fo, base);
  const r = spawnSync('git', ['merge-file', '-p', '-L', 'rama-A', '-L', 'base', '-L', 'rama-B', fa, fo, fb],
    { encoding: 'utf8', maxBuffer: 32e6 });
  return { salida: r.stdout || '', conflictos: r.status === null ? null : r.status };
}

function informe(titulo, base, a, b, leerCifra, verdad) {
  console.log(`\n═══ ${titulo} ═══`);
  if (!a || !b) { console.log('   🔴 NO PUDE MIRAR: no encontré dónde fabricar las dos ramas.'); return 2; }
  const { salida, conflictos } = mergear(titulo.replace(/\W+/g, '-'), base, a, b);
  if (conflictos === null) { console.log('   🔴 NO PUDE MIRAR: `git merge-file` no llegó a correr.'); return 2; }
  const hayMarca = /^<{7} /m.test(salida);
  const cifra = leerCifra(salida);
  console.log(`   ① ¿marca de conflicto?  ${hayMarca ? 'SÍ' : '🔴 NO'}  (git dice ${conflictos} conflicto(s))`);
  console.log(`   ② cifra tras el merge:  ${cifra === null ? '(no hay cifra escrita: se deriva)' : cifra}` +
    `   · la verdad son ${verdad}`);
  const cifraMal = cifra !== null && cifra !== verdad;
  console.log(`   ⇒ ${cifraMal ? '🔴 LA CIFRA ENTRÓ MAL' : '✅ ninguna cifra pudo entrar mal'}` +
    (cifraMal && hayMarca ? ' — y el conflicto de al lado TAPA que entró mal.' : ''));
  return cifraMal ? 1 : 0;
}

const cifraDelAssert = (t) => { const m = t.match(/assert\.equal\(fuera\.length, (\d+),/); return m ? Number(m[1]) : null; };
const hoy = cifraDelAssert(base);
if (hoy === null) console.log('AVISO: el fichero ya no lleva cifra a mano en el assert (¿arreglado?).');
console.log(`POBLACIÓN · fichero ${path.relative(RAIZ, FICHERO)} · cifra escrita hoy: ${hoy ?? '(ninguna)'}`);

let peor = 0;
if (hoy !== null) {
  peor = Math.max(peor, informe('FORMA VIEJA · la cifra a mano en el assert',
    base, ramaVieja(base, 'SCRUM-AAA', 'guard:uno-nuevo'), ramaVieja(base, 'SCRUM-BBB', 'guard:otro-nuevo'),
    cifraDelAssert, hoy + 2));
}
// La forma nueva se mide sobre el fichero de la LISTA declarada, si existe.
const LISTA = path.join(RAIZ, 'tests', '_guards-de-navegador-declarados.mjs');
if (fs.existsSync(LISTA)) {
  const b2 = fs.readFileSync(LISTA, 'utf8');
  const n = (b2.match(/^\s*'guard:/gm) || []).length;
  console.log(`\nPOBLACIÓN · ${path.relative(RAIZ, LISTA)} · ${n} guards declarados, uno por línea`);
  peor = Math.max(peor, informe('FORMA NUEVA · la cifra derivada de la lista declarada',
    b2, ramaNueva(b2, 'SCRUM-AAA', 'guard:uno-nuevo'), ramaNueva(b2, 'SCRUM-BBB', 'guard:otro-nuevo'),
    () => null, n + 2));
} else {
  console.log(`\n(todavía no existe ${path.relative(RAIZ, LISTA)}: sólo se mide la forma vieja)`);
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(peor);
