// docs/master/evidencias/scrum1342/mutar.mjs — SCRUM-1342
//
// SEGUNDA SONDA de las mutaciones que declara `tests/scrum1342-plan-desconocido-no-calla.test.mjs`.
// La primera es la de la casa (`npm run meta:mutaciones`, que corre TODAS las del árbol y la
// ejecuta el CI). Ésta corre SOLO las de ese fichero, con otro camino: no usa `correr` ni
// `aplicarUna` del meta-guard —pilotarlos desde fuera se salta su vigilancia del árbol—, solo su
// lector de declaraciones, que es una función pura sobre el AST.
//
//     node docs/master/evidencias/scrum1342/mutar.mjs
//
// Por cada mutación: exige que el ancla esté EXACTAMENTE una vez, escribe el fuente mutado, emite
// su `.js` a `dist/` (los tests corren contra `dist/`), corre el fichero de test con TAP a un
// temporal FUERA del árbol, y restaura fuente y `dist` comprobando sha256. Antes de nada corre la
// BASE sin mutar: si el test nombrado no está en verde ahí, no hay nada que juzgar (CIEGO).
//
// Salidas: 0 todas vivas · 1 alguna muda · 2 alguna ciega o base rota · 3 no pude restaurar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const GUARD = 'tests/scrum1342-plan-desconocido-no-calla.test.mjs';
const requiere = createRequire(import.meta.url);
const ts = requiere(path.join(RAIZ, 'node_modules', 'typescript'));

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const veces = (texto, ancla) => texto.split(ancla).length - 1;

function opcionesDeCompilacion() {
  const leido = ts.readConfigFile(path.join(RAIZ, 'tsconfig.json'), ts.sys.readFile);
  if (leido.error) throw new Error('CIEGO: no pude leer tsconfig.json');
  return ts.convertCompilerOptionsFromJson(leido.config.compilerOptions || {}, RAIZ).options;
}

/** Corre el fichero de test y devuelve { nombre → 'ok' | 'not ok' } de sus tests de primer nivel. */
function correr() {
  const tap = path.join(os.tmpdir(), `scrum1342-mutar-${process.pid}.tap`);
  fs.rmSync(tap, { force: true });
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
  const r = spawnSync(process.execPath,
    ['--test', '--test-reporter=tap', `--test-reporter-destination=${tap}`, GUARD],
    { cwd: RAIZ, env, encoding: 'utf8' });
  const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  fs.rmSync(tap, { force: true });
  const tests = new Map();
  for (const l of texto.split(/\r?\n/)) {
    const mm = /^(not ok|ok) \d+ - (.*)$/.exec(l);
    if (mm) tests.set(mm[2], mm[1]);
  }
  return { salida: r.status, tests };
}

const estadoDe = (corrida, cae) => [...corrida.tests].filter(([n]) => n.includes(cae));

const codigo = fs.readFileSync(path.join(RAIZ, GUARD), 'utf8');
const mutaciones = mutacionesDeclaradas(codigo, GUARD);
console.log(`POBLACION: ${mutaciones.length} mutaciones declaradas en ${GUARD}`);
if (!mutaciones.length) { console.log('CIEGO: cero declaraciones leídas'); console.log('EXIT=2'); process.exit(2); }

const base = correr();
const enBase = [...base.tests.values()];
console.log(`BASE sin mutar: ${enBase.length} tests · ${enBase.filter((v) => v === 'ok').length} ok · `
  + `${enBase.filter((v) => v === 'not ok').length} not ok · salida ${base.salida}`);
if (base.salida !== 0 || !enBase.length) { console.log('CIEGO: la base no está en verde'); console.log('EXIT=2'); process.exit(2); }

const opciones = opcionesDeCompilacion();
let vivas = 0; let mudas = 0; let ciegas = 0;

for (const [i, mut] of mutaciones.entries()) {
  const rotulo = `${i + 1}/${mutaciones.length} · ${mut.fichero} · «${mut.cae}»`;
  const abs = path.join(RAIZ, mut.fichero);
  const ORIGINAL = fs.readFileSync(abs);
  const fuente = ORIGINAL.toString('utf8');
  const enLaBase = estadoDe(base, mut.cae);
  if (veces(fuente, mut.de) !== 1) { ciegas += 1; console.log(`? CIEGA ${rotulo} — el ancla está ${veces(fuente, mut.de)} veces`); continue; }
  if (!enLaBase.length || enLaBase.some(([, v]) => v !== 'ok')) { ciegas += 1; console.log(`? CIEGA ${rotulo} — en la base ese nombre casa con ${enLaBase.length} tests en verde`); continue; }

  const mutado = fuente.replace(mut.de, () => mut.a);
  const esTs = mut.fichero.startsWith('src/') && mut.fichero.endsWith('.ts');
  const absDist = esTs ? path.join(RAIZ, 'dist', mut.fichero.slice('src/'.length).replace(/\.ts$/, '.js')) : null;
  const ORIGINAL_DIST = absDist ? fs.readFileSync(absDist) : null;
  let tras;
  try {
    fs.writeFileSync(abs, mutado);
    if (absDist) fs.writeFileSync(absDist, ts.transpileModule(mutado, { compilerOptions: opciones, fileName: abs }).outputText);
    const aplicada = sha(fs.readFileSync(abs)) !== sha(ORIGINAL) && (!absDist || sha(fs.readFileSync(absDist)) !== sha(ORIGINAL_DIST));
    if (!aplicada) { ciegas += 1; console.log(`? CIEGA ${rotulo} — la mutación no cambió los bytes`); continue; }
    tras = correr();
  } finally {
    fs.writeFileSync(abs, ORIGINAL);
    if (absDist) fs.writeFileSync(absDist, ORIGINAL_DIST);
    const devuelto = sha(fs.readFileSync(abs)) === sha(ORIGINAL) && (!absDist || sha(fs.readFileSync(absDist)) === sha(ORIGINAL_DIST));
    if (!devuelto) { console.log(`🔴🔴 NO PUDE RESTAURAR ${mut.fichero}. MÍRALO A MANO.`); console.log('EXIT=3'); process.exit(3); }
  }
  const despues = estadoDe(tras, mut.cae);
  const caidos = [...tras.tests].filter(([, v]) => v === 'not ok').length;
  if (!despues.length) { ciegas += 1; console.log(`? CIEGA ${rotulo} — mutado, el test nombrado no aparece (${tras.tests.size} tests reportados): el fichero murió`); }
  else if (despues.some(([, v]) => v === 'not ok')) { vivas += 1; console.log(`✔ VIVA  ${rotulo} — caen ${caidos} de ${tras.tests.size}`); }
  else { mudas += 1; console.log(`✖ MUDA  ${rotulo} — ${tras.tests.size} tests, ${caidos} caídos, y el nombrado sigue en verde`); }
}

const final = correr();
const okFinal = [...final.tests.values()].filter((v) => v === 'ok').length;
console.log(`DESPUÉS de restaurar: ${final.tests.size} tests · ${okFinal} ok · salida ${final.salida}`);
console.log(`vivas ${vivas} · mudas ${mudas} · ciegas ${ciegas} · de ${mutaciones.length}`);
const salida = (final.salida !== 0 || ciegas) ? 2 : mudas ? 1 : 0;
console.log(`EXIT=${salida}`);
process.exit(salida);
