// lista-antes-despues.mjs — SCRUM-1336 · aceptación D: «el recuento de SALEN_A_MANO baja en siete,
// y se enseña el número de antes y el de después».
//
//   node docs/master/evidencias/scrum1336/lista-antes-despues.mjs <sha de antes> [sha de después]
//
// Lee `tests/_salidas-de-guard.mjs` de cada SHA con `git show` (el de después, del árbol de trabajo
// si no se da), lo importa y cuenta. Los seis con la marca y el séptimo se dicen POR SEPARADO.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const [ANTES, DESPUES] = process.argv.slice(2);
if (!ANTES) { console.error('uso: node lista-antes-despues.mjs <sha de antes> [sha de después]'); process.exit(2); }
const TS = pathToFileURL(path.join(RAIZ, 'node_modules', 'typescript', 'lib', 'typescript.js')).href;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1336-lista-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

async function listaDe(sha, etiqueta) {
  let fuente;
  if (sha) {
    const r = spawnSync('git', ['show', sha + ':tests/_salidas-de-guard.mjs'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (r.status !== 0 || !r.stdout) { console.error('🔴 no pude leer la lista de ' + sha); process.exit(2); }
    fuente = r.stdout;
  } else {
    fuente = fs.readFileSync(path.join(RAIZ, 'tests', '_salidas-de-guard.mjs'), 'utf8');
  }
  const f = path.join(tmp, etiqueta + '.mjs');
  fs.writeFileSync(f, fuente.replace("from 'typescript'", "from '" + TS + "'"));
  return (await import(pathToFileURL(f).href)).SALEN_A_MANO;
}

const antes = await listaDe(ANTES, 'antes');
const despues = await listaDe(DESPUES || null, 'despues');
const salidas = (m, claves = [...m.keys()]) => claves.reduce((n, f) => n + m.get(f).salidas, 0);
const conMarca = (m) => [...m].filter(([, d]) => d.pintaElCiegoDeHallazgo).map(([f]) => f);
const retiradas = [...antes.keys()].filter((f) => !despues.has(f));
const seis = retiradas.filter((f) => antes.get(f).pintaElCiegoDeHallazgo);
const aparte = retiradas.filter((f) => !antes.get(f).pintaElCiegoDeHallazgo);

console.log(`ANTES   (${ANTES}): ${antes.size} entradas · ${salidas(antes)} salidas a mano · ${conMarca(antes).length} con la marca \`pintaElCiegoDeHallazgo\``);
console.log(`DESPUÉS (${DESPUES || 'árbol de trabajo'}): ${despues.size} entradas · ${salidas(despues)} salidas a mano · ${conMarca(despues).length} con la marca`);
console.log(`RETIRADAS con la marca (${seis.length}, ${salidas(antes, seis)} salidas): ${seis.join(', ')}`);
console.log(`RETIRADAS sin la marca, aparte (${aparte.length}, ${salidas(antes, aparte)} salidas): ${aparte.join(', ')}`);
console.log(`ENTRAN nuevas (${[...despues.keys()].filter((f) => !antes.has(f)).length}): ${[...despues.keys()].filter((f) => !antes.has(f)).join(', ') || 'ninguna'}`);
console.log(`QUEDAN (${despues.size}): ${[...despues.keys()].join(', ')}`);
