// Mutaciones del arreglo de SCRUM-1304. Edición → build → test → edición inversa. Rutas absolutas.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const F = path.join(RAIZ, 'src/lib/invoicing.ts');
const TMP = process.env.MUTAR_TMP || os.tmpdir(); // FUERA del árbol

const MUTACIONES = [
  { id: 'M1 sin cerrojo (la pregunta, fuera de la exclusion)', de: '    await tomarCerrojoDeSerie(tx, ch.merchantId);\n', a: '' },
  { id: 'M2 la pregunta no decide', de: '    if (yaEmitida) return { factura: yaEmitida, nueva: false };', a: '    if (false as boolean) return { factura: yaEmitida!, nueva: false };' },
  { id: 'M3 la pregunta ignora el cobro', de: '      where: { chargeId: ch.id, merchantId: ch.merchantId }, // regla 2: scoped', a: '      where: { merchantId: ch.merchantId }, // regla 2: scoped' },
  { id: 'M4 la entrega que no emite se calla', de: '    console.error(`[invoicing] SCRUM-1304 el cobro ${ch.id} ya tenía la factura ${emision.factura.number}: no se emite otra`);', a: '    void 0;' },
  { id: 'M5 la pregunta ignora el merchant (regla 2)', de: '      where: { chargeId: ch.id, merchantId: ch.merchantId }, // regla 2: scoped', a: '      where: { chargeId: ch.id }, // regla 2: scoped' },
];

const entorno = { ...process.env };
for (const k of ['DATABASE_URL_PROD_RO', 'FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

function construir() {
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'node_modules/typescript/bin/tsc')], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  return r.status;
}
function probar(etiqueta) {
  const tap = path.join(TMP, `mut-${etiqueta}.tap`);
  fs.rmSync(tap, { force: true });
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, 'tests/scrum1304-un-cobro-una-factura.test.mjs'], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  const cuenta = (k) => Number((new RegExp(`^# ${k} (\\d+)`, 'm').exec(texto) || [])[1] ?? NaN);
  const caidos = [...texto.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1].replace(/^SCRUM-1304 · /, '').slice(0, 70));
  return { exit: r.status, tests: cuenta('tests'), pass: cuenta('pass'), fail: cuenta('fail'), caidos };
}

const original = fs.readFileSync(F, 'utf8');
const salida = [];
try {
  const b0 = construir();
  salida.push({ id: 'BASE sin mutar', build: b0, ...probar('base') });
  for (const [i, m] of MUTACIONES.entries()) {
    const veces = original.split(m.de).length - 1;
    if (veces !== 1) { salida.push({ id: m.id, CIEGO: `el texto a mutar aparece ${veces} veces` }); continue; }
    fs.writeFileSync(F, original.replace(m.de, m.a));
    const numstat = execFileSync('git', ['diff', '--numstat', '--', 'src/lib/invoicing.ts'], { cwd: RAIZ, encoding: 'utf8' }).trim();
    const b = construir();
    salida.push({ id: m.id, numstat, build: b, ...(b === 0 ? probar(`m${i + 1}`) : { CIEGO: 'no compila' }) });
    fs.writeFileSync(F, original);
  }
} finally {
  fs.writeFileSync(F, original);
  const b = construir();
  salida.push({ id: 'RESTAURADO', build: b, porcelain: execFileSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8' }), ...probar('final') });
}
fs.writeFileSync(path.join(TMP, 'mutaciones.json'), JSON.stringify(salida, null, 2));
console.log(JSON.stringify(salida, null, 2));
