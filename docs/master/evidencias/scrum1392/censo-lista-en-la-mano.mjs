// censo-lista-en-la-mano.mjs — SCRUM-1392 · ① QUIÉN LLEVA LA LISTA EN LA MANO.
//
//   node docs/master/evidencias/scrum1392/censo-lista-en-la-mano.mjs
//
// Población: todo `.mjs` de `scripts/` y de `tests/`. De cada uno: si importa la pieza, cuántas veces
// llama a `recorrerCasos` y, de cada llamada, las listas que nacen dentro del caso, reciben apuntes y
// se devuelven; y qué hay DESPUÉS del primer apunte que pueda lanzar (`await`, `throw`, llamadas).
// El motor es `tests/_lista-en-la-mano.mjs`, el mismo que usa el test del obligatorio.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censoDeFuente, LIMITES_DEL_CENSO } from '../../../../tests/_lista-en-la-mano.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

// ── LOS CONTROLES, antes que el número ─────────────────────────────────────────────────────────
const CABEZA = "import { recorrerCasos as rc } from './_hallazgos-y-ciegos.mjs';\n";
const CONTROLES = [
  { nombre: 'lista en la mano y un await detrás', espera: [1, 1],
    fuente: CABEZA + 'await rc(C, async (c) => { const suyos = []; suyos.push(c); await pagina.cerrar(); return { hallazgos: suyos, ciegos: [] }; });' },
  { nombre: 'lista en la mano y nada detrás', espera: [1, 0],
    fuente: CABEZA + 'await rc(C, async (c) => { const suyos = []; await pagina.ir(); suyos.push(c); return { hallazgos: suyos, ciegos: [] }; });' },
  { nombre: 'lista del módulo (CERO)', espera: [0, 0],
    fuente: CABEZA + 'const hallazgos = [];\nawait rc(C, async (c) => { hallazgos.push(c); await pagina.cerrar(); return { hallazgos: [], ciegos: [] }; });' },
  { nombre: 'la lista que entrega la pieza (CERO)', espera: [0, 0],
    fuente: CABEZA + 'await rc(C, async (c, suyas) => { suyas.hallazgos.push(c); await pagina.cerrar(); return suyas; });' },
  { nombre: 'sólo nombrado en un comentario (CERO llamadas)', espera: [0, 0], llamadas: 0,
    fuente: '// await recorrerCasos(C, async (c) => { const suyos = []; suyos.push(c); return { hallazgos: suyos }; });\nconst x = 1;' },
];
let controlesBien = 0;
for (const c of CONTROLES) {
  const censo = censoDeFuente(c.fuente);
  const listas = censo.llamadas.flatMap((l) => l.enLaMano);
  const visto = [listas.length, listas.reduce((n, l) => n + l.awaitsDespues.length, 0)];
  const bien = visto[0] === c.espera[0] && visto[1] === c.espera[1] && censo.llamadas.length === (c.llamadas === undefined ? 1 : c.llamadas);
  if (bien) controlesBien += 1;
  console.log(`control · ${c.nombre}: listas ${visto[0]} · awaits detrás ${visto[1]} · llamadas ${censo.llamadas.length} → ${bien ? 'como se esperaba' : 'NO CUADRA'}`);
}
if (controlesBien !== CONTROLES.length) {
  console.log(`CIEGO: ${CONTROLES.length - controlesBien} de ${CONTROLES.length} controles no cuadran. El número de abajo no valdría: no se da.`);
  console.log('EXIT=2');
  process.exit(2);
}

// ── LA POBLACIÓN ───────────────────────────────────────────────────────────────────────────────
const ficheros = [];
for (const dir of ['scripts', 'tests']) {
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (e.name !== 'node_modules') andar(path.join(d, e.name)); continue; }
      if (e.name.endsWith('.mjs')) ficheros.push(path.join(d, e.name));
    }
  };
  andar(path.join(RAIZ, dir));
}
let importan = 0;
let llamadas = 0;
let sinLeer = 0;
const conLista = [];
const filas = [];
for (const f of ficheros.sort()) {
  const rel = path.relative(RAIZ, f).split(path.sep).join('/');
  const censo = censoDeFuente(fs.readFileSync(f, 'utf8'), rel);
  if (censo.importaLaPieza) importan += 1;
  if (!censo.llamadas.length) continue;
  // Los tests llaman a la pieza con jueces de mentira: se cuentan aparte, no son guards.
  const esGuard = rel.startsWith('scripts/');
  for (const ll of censo.llamadas) {
    if (esGuard) llamadas += 1;
    if (esGuard && !ll.resuelta) sinLeer += 1;
    const deHallazgos = ll.enLaMano.filter((l) => l.papel !== 'ciegos');
    filas.push({ rel, esGuard, ll, deHallazgos });
    if (esGuard && deHallazgos.length) conLista.push({ rel, ll, deHallazgos });
  }
}

console.log('');
console.log(`POBLACIÓN: ${ficheros.length} ficheros .mjs de scripts/ y tests/ · ${importan} importan la pieza · ${llamadas} llamadas a recorrerCasos en ${new Set(filas.filter((x) => x.esGuard).map((x) => x.rel)).size} guards de scripts/ · ${sinLeer} sin poder leer su caso`);
for (const x of filas.filter((q) => q.esGuard)) {
  const que = !x.ll.resuelta ? 'NO SUPE LEER EL CASO'
    : (x.deHallazgos.length ? x.deHallazgos.map((l) => `«${l.lista}» (${l.papel}) nace L${l.lineaDondeNace}, 1er apunte L${l.primerApunte}, ${l.apuntes} apuntes · detrás: ${l.awaitsDespues.length} await, ${l.lanzamientosDespues.length} throw, llamadas [${l.llamadasDespues.join(', ')}]`).join(' ; ')
      : 'ninguna lista de hallazgos en la mano');
  console.log(`  ${x.rel}:${x.ll.linea} · caso con ${x.ll.parametros} parámetro(s) · ${que}`);
}
const enTests = filas.filter((q) => !q.esGuard);
console.log(`  (aparte: ${enTests.length} llamadas en ${new Set(enTests.map((x) => x.rel)).size} ficheros de tests/, con jueces de mentira)`);

const conAwait = conLista.filter((x) => x.deHallazgos.some((l) => l.awaitsDespues.length || l.lanzamientosDespues.length));
console.log('');
console.log(`RESULTADO: ${conLista.length} recorridos de ${llamadas} llevan una lista de hallazgos en la mano · ${conAwait.length} de ésos tienen un await o un throw después del primer apunte`);
console.log('LO QUE ESTE CENSO NO VE: ' + LIMITES_DEL_CENSO.join(' · '));
const codigo = sinLeer > 0 || llamadas === 0 ? 2 : 0;
console.log('EXIT=' + codigo);
process.exitCode = codigo;
