#!/usr/bin/env node
// docs/master/evidencias/scrum1402/mutar.mjs — SCRUM-1402 · segunda sonda de las mutaciones declaradas.
//
// La red de la casa es `npm run meta:mutaciones` (la corre el CI). Esto es la sonda LOCAL del ticket:
// lee las `MUTACIONES_QUE_ME_TUMBAN` del test, y para cada una aplica, emite `dist/`, corre el test,
// exige ver ROJO el caso nombrado, restaura y comprueba los bytes. Primero la BASE sin mutar.
//
//   node docs/master/evidencias/scrum1402/mutar.mjs <ruta ABSOLUTA a typescript/bin/tsc>
//
// Salidas: 0 todas vivas · 1 alguna muda · 2 ciego (base roja, `de` que no casa una vez, sin TAP)
// · 3 no se pudo restaurar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TEST = 'tests/scrum1402-plan-inexistente-no-se-escribe.test.mjs';
const TSC = process.argv[2];
if (!TSC || !fs.existsSync(TSC)) { console.error('CIEGO: falta la ruta a tsc'); process.exit(2); }

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const TAP = path.join(os.tmpdir(), `scrum1402-mutar-${process.pid}.tap`);

/** El entorno del sujeto, a mano: sin el contexto de `node --test` ni el color del chat (SCRUM-1308). */
function entornoLimpio() {
  const e = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete e[k];
  return e;
}

function emitir() {
  const r = spawnSync(process.execPath, [TSC, '--noCheck'], { cwd: RAIZ, encoding: 'utf8', env: entornoLimpio() });
  return r.status;
}

/** Corre el test y devuelve { ok: Set de nombres, mal: Set de nombres } leídos del TAP. */
function correr() {
  fs.rmSync(TAP, { force: true });
  spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-reporter-destination=${TAP}`, TEST],
    { cwd: RAIZ, encoding: 'utf8', env: entornoLimpio() });
  if (!fs.existsSync(TAP)) return null;
  const ok = new Set();
  const mal = new Set();
  for (const l of fs.readFileSync(TAP, 'utf8').split(/\r?\n/)) {
    const m = /^(not ok|ok) \d+ - (.*)$/.exec(l);
    if (m) (m[1] === 'ok' ? ok : mal).add(m[2]);
  }
  return { ok, mal };
}

// La declaración se IMPORTA en un hijo (importarla aquí ejecutaría los tests en este proceso).
const leer = spawnSync(process.execPath, ['--input-type=module', '-e',
  `const m = await import(${JSON.stringify(pathToFileURL(path.join(RAIZ, TEST)).href)}); `
  + 'process.stdout.write("\\n@@MUT@@" + JSON.stringify(m.MUTACIONES_QUE_ME_TUMBAN));process.exit(0);'],
  { cwd: RAIZ, encoding: 'utf8', env: entornoLimpio() });
const MUT = JSON.parse(String(leer.stdout).split('@@MUT@@').pop());
console.log(`POBLACION: ${MUT.length} mutaciones declaradas en ${TEST}`);

if (emitir() !== 0) { console.error('CIEGO: dist/ no se emite sobre el código sin mutar'); process.exit(2); }
const base = correr();
if (!base || base.mal.size || base.ok.size === 0) {
  console.error(`CIEGO: la BASE sin mutar no está verde (${base ? `${base.ok.size} ok, ${base.mal.size} mal` : 'sin TAP'})`);
  process.exit(2);
}
console.log(`BASE sin mutar: ${base.ok.size} casos, 0 caen`);

let vivas = 0;
let mudas = 0;
let ciegas = 0;
for (const [i, mut] of MUT.entries()) {
  const f = path.join(RAIZ, mut.fichero);
  const original = fs.readFileSync(f);
  const texto = original.toString('utf8');
  const veces = texto.split(mut.de).length - 1;
  const enBase = [...base.ok].filter((n) => n.includes(mut.cae));
  let veredicto;
  if (veces !== 1) veredicto = `CIEGA: «de» casa ${veces} veces`;
  else if (enBase.length !== 1) veredicto = `CIEGA: «cae» nombra ${enBase.length} casos verdes en la base`;
  else {
    try {
      fs.writeFileSync(f, texto.replace(mut.de, mut.a));
      const cambio = sha(fs.readFileSync(f)) !== sha(original);
      const emitido = emitir();
      const tras = correr();
      if (!cambio) veredicto = 'CIEGA: la mutación no cambió el fichero';
      else if (emitido !== 0) veredicto = `CIEGA: dist/ no se emite con la mutación (${emitido})`;
      else if (!tras) veredicto = 'CIEGA: sin TAP';
      else if ([...tras.mal].some((n) => n.includes(mut.cae))) veredicto = `VIVA (caen ${tras.mal.size} de ${tras.mal.size + tras.ok.size})`;
      else veredicto = `MUDA: el caso nombrado no cae (caen ${tras.mal.size})`;
    } finally {
      fs.writeFileSync(f, original);
      if (sha(fs.readFileSync(f)) !== sha(original)) { console.error(`NO RESTAURADO: ${mut.fichero}`); process.exit(3); }
    }
  }
  if (veredicto.startsWith('VIVA')) vivas += 1; else if (veredicto.startsWith('MUDA')) mudas += 1; else ciegas += 1;
  console.log(`${i + 1}. ${veredicto} · «${mut.cae}» · a: ${JSON.stringify(mut.a.slice(0, 70))}`);
}
const fin = emitir();
fs.rmSync(TAP, { force: true });
console.log(`RESULTADO: ${vivas} vivas · ${mudas} mudas · ${ciegas} ciegas, de ${MUT.length} · dist/ re-emitido sin mutar (${fin})`);
const salida = fin !== 0 || ciegas ? 2 : mudas ? 1 : 0;
console.log(`EXIT=${salida}`);
process.exit(salida);
