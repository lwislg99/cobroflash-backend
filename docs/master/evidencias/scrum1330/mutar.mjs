// Mutaciones de las dos guardas de SCRUM-1330. Edición → build → tests → edición inversa.
// Rutas absolutas. Misma forma que `docs/master/evidencias/scrum1304/mutar.mjs`, con dos ficheros.
//
//   node docs/master/evidencias/scrum1330/mutar.mjs        (MUTAR_TMP=<carpeta fuera del árbol>)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const INV = 'src/lib/invoicing.ts';
const VF = 'src/modules/invoicing/domain/verifactu.service.ts';
const TMP = process.env.MUTAR_TMP || os.tmpdir(); // FUERA del árbol
const TESTS = ['tests/scrum1330-una-sellada-no-se-resella.test.mjs', 'tests/scrum1304-un-cobro-una-factura.test.mjs'];

const A = { f: INV, de: '    if (inv.vfEstado !== SELLADO_HECHO) {', a: '    if (true as boolean) {' };
const B = { f: VF, de: '    if (yaSellada?.vfHash) {', a: '    if ((false as boolean) && yaSellada?.vfHash) {' };
const DEVUELVE = "      return { vfHash: yaSellada.vfHash, prevHash: yaSellada.vfPrevHash ?? '', qrUrl: yaSellada.qrData, conservada: true };";

const MUTACIONES = [
  { id: 'MA la guarda del punto de llamada no decide (B sigue puesta)', cambios: [A] },
  { id: 'MB la guarda de dentro del cerrojo no decide (A sigue puesta)', cambios: [B] },
  { id: 'MAB ninguna de las dos decide (el defecto entero)', cambios: [A, B] },
  { id: 'MB-lanza la guarda de dentro LANZA en vez de devolver el sello persistido', cambios: [{ f: VF, de: DEVUELVE, a: "      throw new Error('verifactu_ya_sellada');" }] },
  { id: 'MB-anterior la guarda de dentro devuelve como anterior la PROPIA huella', cambios: [{ f: VF, de: DEVUELVE, a: DEVUELVE.replace("yaSellada.vfPrevHash ?? ''", 'yaSellada.vfHash') }] },
  { id: 'MB-calla lo conservado se anuncia como un sellado', cambios: [{ f: VF, de: '  if (sellado.conservada) {', a: '  if ((false as boolean) && sellado.conservada) {' }] },
];

const entorno = { ...process.env };
for (const k of ['DATABASE_URL_PROD_RO', 'FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

function construir() {
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'node_modules/typescript/bin/tsc')], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  return r.status;
}
function probar(etiqueta) {
  const tap = path.join(TMP, `mut1330-${etiqueta}.tap`);
  fs.rmSync(tap, { force: true });
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-concurrency=1', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...TESTS], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  const cuenta = (k) => Number((new RegExp(`^# ${k} (\\d+)`, 'm').exec(texto) || [])[1] ?? NaN);
  const caidos = [...texto.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1].slice(0, 110));
  return { exit: r.status, tests: cuenta('tests'), pass: cuenta('pass'), fail: cuenta('fail'), caidos };
}

const originales = Object.fromEntries([INV, VF].map((f) => [f, fs.readFileSync(path.join(RAIZ, f), 'utf8')]));
const restaurar = () => { for (const [f, t] of Object.entries(originales)) fs.writeFileSync(path.join(RAIZ, f), t); };
const salida = [];
try {
  salida.push({ id: 'BASE sin mutar', build: construir(), ...probar('base') });
  for (const [i, m] of MUTACIONES.entries()) {
    const ciego = m.cambios.map((c) => originales[c.f].split(c.de).length - 1).find((n) => n !== 1);
    if (ciego !== undefined) { salida.push({ id: m.id, CIEGO: `un texto a mutar aparece ${ciego} veces` }); continue; }
    const textos = { ...originales };
    for (const c of m.cambios) textos[c.f] = textos[c.f].replace(c.de, c.a);
    for (const [f, t] of Object.entries(textos)) fs.writeFileSync(path.join(RAIZ, f), t);
    const numstat = execFileSync('git', ['diff', '--numstat', '--', INV, VF], { cwd: RAIZ, encoding: 'utf8' }).trim().split('\n');
    const b = construir();
    salida.push({ id: m.id, numstat, build: b, ...(b === 0 ? probar(`m${i + 1}`) : { CIEGO: 'no compila' }) });
    restaurar();
  }
} finally {
  restaurar();
  const b = construir();
  salida.push({ id: 'RESTAURADO', build: b, porcelainDeSrc: execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: RAIZ, encoding: 'utf8' }), ...probar('final') });
}
fs.writeFileSync(path.join(TMP, 'mutaciones-1330.json'), JSON.stringify(salida, null, 2));
console.log(JSON.stringify(salida, null, 2));
