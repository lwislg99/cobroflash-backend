// Réplica local de `npm run meta:mutaciones` para UN test: aplica cada mutación que el test declara
// (MUTACIONES_QUE_ME_TUMBAN), corre el test y comprueba que cae EL CASO que la mutación nombra.
// Uso, desde la raíz del árbol:  node <ruta>/replica-mutaciones.mjs tests/<fichero>.test.mjs
// Primero la BASE sin mutar: si ya cae algo, se declara y no se sigue.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();
const rel = process.argv[2];
if (!rel) { console.error('uso: replica-mutaciones.mjs tests/<fichero>.test.mjs'); process.exit(2); }
const { MUTACIONES_QUE_ME_TUMBAN: MUTS } = await import(pathToFileURL(path.join(RAIZ, rel)).href + '?leer');
if (!Array.isArray(MUTS) || !MUTS.length) { console.error('🔴 CIEGO: el test no declara mutaciones'); process.exit(2); }

const entorno = { ...process.env };
for (const v of ['FORCE_COLOR', 'NODE_OPTIONS', 'LIBRO_PG_URL', 'QA_DB_TEST', 'A55_DB_TEST', 'BOT_SUITE_TEST']) delete entorno[v];

function correr() {
  const tap = path.join(os.tmpdir(), `replica-${process.pid}-${Date.now()}.tap`);
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-reporter-destination=${tap}`, rel], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const lineas = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8').split(/\r?\n/) : [];
  if (fs.existsSync(tap)) fs.unlinkSync(tap);
  const casos = lineas.filter((l) => /^(not ok|ok) \d+ - /.test(l));
  return { salida: r.status, casos, caidos: casos.filter((l) => l.startsWith('not ok')) };
}

const base = correr();
console.log(`POBLACION · ${MUTS.length} mutación(es) declaradas en ${rel} · BASE sin mutar: ${base.casos.length} casos, ${base.caidos.length} caídos, salida ${base.salida}`);
if (!base.casos.length || base.caidos.length || base.salida !== 0) { console.error('🔴 la BASE no está verde o no produjo casos: no se muta nada'); process.exit(1); }

let mal = 0;
for (const [i, m] of MUTS.entries()) {
  const f = path.join(RAIZ, m.fichero);
  const original = fs.readFileSync(f, 'utf8');
  const veces = original.split(m.de).length - 1;
  if (veces !== 1) { console.log(`✖ ${i + 1} · «de» casa ${veces} veces en ${m.fichero} (tiene que ser 1)`); mal++; continue; }
  let r;
  try {
    fs.writeFileSync(f, original.replace(m.de, m.a));
    r = correr();
  } finally {
    fs.writeFileSync(f, original);
  }
  const cayoElSuyo = r.caidos.some((l) => l.includes(m.cae));
  const marca = cayoElSuyo ? '✔' : '✖';
  if (!cayoElSuyo) mal++;
  console.log(`${marca} ${i + 1} · ${m.de.slice(0, 60)} → ${m.a} · caen ${r.caidos.length} de ${r.casos.length} · el suyo («${m.cae}»): ${cayoElSuyo ? 'CAE' : 'NO CAE'}`);
}
const despues = correr();
console.log(`RESTAURADO · tras la última: ${despues.casos.length} casos, ${despues.caidos.length} caídos`);
console.log(`EXIT=${mal || despues.caidos.length ? 1 : 0}`);
process.exit(mal || despues.caidos.length ? 1 : 0);
