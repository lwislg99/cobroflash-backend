// SCRUM-1509j · aplica cada mutación que declara el test (MUTACIONES_QUE_ME_TUMBAN), recompila
// `dist` con `tsc --noCheck`, corre el test y exige que caiga el caso que la declara. Restaura
// el fuente en un `finally` y lo comprueba byte a byte. Base sin mutar primero: tiene que salir
// verde, o no se mide nada.
//
// Uso (desde la raíz del árbol): node docs/master/evidencias/SCRUM-1509j/mutar.mjs <ruta a tsc.js>
// Salidas: 0 todas cazadas · 1 alguna muda · 2 ciego (base roja, sustitución que no casa, tsc roto)
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const TEST = 'tests/scrum1509j-recordatorio-de-facturas-no-reenvia.test.mjs';
const tsc = process.argv[2];
if (!tsc || !fs.existsSync(tsc)) { console.log('CIEGO: falta la ruta a tsc.js'); process.exit(2); }
const { MUTACIONES_QUE_ME_TUMBAN: M } = leerDeclaracion();

function leerDeclaracion() {
  // Se lee el texto, no se importa: importar ejecutaría los tests.
  const src = fs.readFileSync(TEST, 'utf8');
  const i = src.indexOf('export const MUTACIONES_QUE_ME_TUMBAN');
  if (i < 0) { console.log('CIEGO: el test no declara mutaciones'); process.exit(2); }
  const lista = Function(`return ${src.slice(src.indexOf('[', i), src.lastIndexOf('];') + 1)}`)();
  return { MUTACIONES_QUE_ME_TUMBAN: lista };
}

function compilar() {
  const r = spawnSync(process.execPath, [tsc, '--noCheck', '-p', '.'], { encoding: 'utf8' });
  if (r.status !== 0) { console.log('CIEGO: tsc salió ' + r.status + '\n' + (r.stdout + r.stderr).slice(0, 800)); process.exit(2); }
}
function correr() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS; delete env.FORCE_COLOR;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { encoding: 'utf8', env });
  const caen = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  const pasan = [...r.stdout.matchAll(/^ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { caen, pasan, total: caen.length + pasan.length };
}

compilar();
const base = correr();
console.log(`BASE sin mutar: ${base.pasan.length} pasan · ${base.caen.length} caen · de ${base.total}`);
if (base.total === 0 || base.caen.length) { console.log('CIEGO: la base no está verde'); process.exit(2); }

let mudas = 0;
for (const m of M) {
  const original = fs.readFileSync(m.fichero);
  const texto = original.toString('utf8');
  const veces = texto.split(m.de).length - 1;
  if (veces !== 1) { console.log(`CIEGO: «${m.de}» casa ${veces} veces en ${m.fichero}`); process.exit(2); }
  try {
    fs.writeFileSync(m.fichero, texto.replace(m.de, m.a));
    compilar();
    const r = correr();
    const cazada = r.caen.some((n) => n.includes(m.cae));
    if (!cazada) mudas += 1;
    console.log(`${cazada ? 'CAZADA' : 'MUDA  '} · ${m.de} → ${m.a} · caen ${r.caen.length} de ${r.total}: ${r.caen.map((n) => n.slice(0, 40)).join(' | ')}`);
  } finally {
    fs.writeFileSync(m.fichero, original);
    if (!fs.readFileSync(m.fichero).equals(original)) { console.log('NO RESTAURADO: ' + m.fichero); process.exit(3); }
  }
}
compilar();
const fin = correr();
console.log(`FINAL restaurado: ${fin.pasan.length} pasan · ${fin.caen.length} caen · de ${fin.total}`);
process.exit(mudas ? 1 : (fin.caen.length ? 2 : 0));
