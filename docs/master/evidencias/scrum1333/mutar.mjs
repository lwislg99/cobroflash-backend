// Mutaciones de la guarda del encolado de SCRUM-1333. Edición → build → tests → edición inversa.
// Rutas absolutas. Misma forma que `docs/master/evidencias/scrum1330/mutar.mjs`, con un fichero.
//
//   node docs/master/evidencias/scrum1333/mutar.mjs        (MUTAR_TMP=<carpeta fuera del árbol>)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const ENC = 'src/modules/invoicing/domain/encolarRemision.ts';
const TMP = process.env.MUTAR_TMP || os.tmpdir(); // FUERA del árbol
const TESTS = [
  'tests/scrum1333-una-factura-se-encola-una-vez.test.mjs',
  'tests/scrum1330-una-sellada-no-se-resella.test.mjs',
  'tests/scrum1304-un-cobro-una-factura.test.mjs',
  'tests/scrum1296-emitir-encola.test.mjs',
];

const DECIDE = '      if (yaEnCola > 0) return false;';
const CERROJO = '      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ENCOLADO_LOCK_NS}::int, ${invoice.id}::int)`;';
const DONDE = '        where: { invoiceId: invoice.id, merchantId: invoice.merchantId, tipoOperacion: TIPO_OPERACION_ALTA }, // regla 2: scoped';
const AVISO = '      console.warn(`[verifactu] invoice=${invoice.number} ya tenía su alta en la cola de remisión: no se encola otra`);';
const DEVUELVE = "      return { encolado: false, motivo: 'ya_encolada' };";

const MUTACIONES = [
  { id: 'M1 la pregunta no decide (el defecto entero)', de: DECIDE, a: '      if ((false as boolean) && yaEnCola > 0) return false;' },
  { id: 'M2 la pregunta va SIN cerrojo', de: CERROJO, a: '      // (sin cerrojo)' },
  { id: 'M3 la pregunta ignora la FACTURA', de: DONDE, a: '        where: { merchantId: invoice.merchantId, tipoOperacion: TIPO_OPERACION_ALTA },' },
  { id: 'M4 la pregunta ignora el COMERCIO (regla 2)', de: DONDE, a: '        where: { invoiceId: invoice.id, tipoOperacion: TIPO_OPERACION_ALTA },' },
  { id: 'M5 la pregunta ignora el TIPO de operación', de: DONDE, a: '        where: { invoiceId: invoice.id, merchantId: invoice.merchantId },' },
  { id: 'M6 no encolar se calla', de: AVISO, a: '      // (sin aviso)' },
  { id: 'M7 no encolar se registra como un FALLO', de: DEVUELVE, a: "      throw new Error('ya_encolada');" },
  { id: 'M8 no encola NUNCA', de: DECIDE, a: '      if (yaEnCola >= 0) return false;' },
];

const entorno = { ...process.env };
for (const k of ['DATABASE_URL_PROD_RO', 'FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

function construir() {
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'node_modules/typescript/bin/tsc')], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  return r.status;
}
function probar(etiqueta) {
  const tap = path.join(TMP, `mut1333-${etiqueta}.tap`);
  fs.rmSync(tap, { force: true });
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-concurrency=1', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...TESTS], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  const cuenta = (k) => Number((new RegExp(`^# ${k} (\\d+)`, 'm').exec(texto) || [])[1] ?? NaN);
  const caidos = [...texto.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1].slice(0, 110));
  return { exit: r.status, tests: cuenta('tests'), pass: cuenta('pass'), fail: cuenta('fail'), caidos };
}

const original = fs.readFileSync(path.join(RAIZ, ENC), 'utf8');
const restaurar = () => fs.writeFileSync(path.join(RAIZ, ENC), original);
const salida = [];
try {
  salida.push({ id: 'BASE sin mutar', build: construir(), ...probar('base') });
  for (const [i, m] of MUTACIONES.entries()) {
    const veces = original.split(m.de).length - 1;
    if (veces !== 1) { salida.push({ id: m.id, CIEGO: `el texto a mutar aparece ${veces} veces` }); continue; }
    fs.writeFileSync(path.join(RAIZ, ENC), original.replace(m.de, () => m.a));
    const numstat = execFileSync('git', ['diff', '--numstat', '--', ENC], { cwd: RAIZ, encoding: 'utf8' }).trim().split('\n');
    const b = construir();
    salida.push({ id: m.id, numstat, build: b, ...(b === 0 ? probar(`m${i + 1}`) : { CIEGO: 'no compila' }) });
    restaurar();
  }
} finally {
  restaurar();
  const b = construir();
  salida.push({ id: 'RESTAURADO', build: b, porcelainDeSrc: execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: RAIZ, encoding: 'utf8' }), ...probar('final') });
}
fs.writeFileSync(path.join(TMP, 'mutaciones-1333.json'), JSON.stringify(salida, null, 2));
console.log(JSON.stringify(salida, null, 2));
