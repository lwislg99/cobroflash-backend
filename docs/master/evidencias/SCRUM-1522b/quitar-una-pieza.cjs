// Quita UNA pieza del arreglo cada vez, recompila y mira que casos caen. Uso: node mutar.cjs <raiz> <tsc>
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ = process.argv[2];
const TSC = process.argv[3];
const SRC = path.join(RAIZ, 'src/modules/messaging/domain/whatsappLog.service.ts');
const TESTS = ['tests/scrum1522b-el-panel-cuenta-lo-mismo.test.mjs', 'tests/scrum1093h-censo-fecha-sin-zona.test.mjs'];
const original = fs.readFileSync(SRC, 'utf8');

const MUTACIONES = [
  ['BASE (sin mutar)', null, null],
  ['M1 · las metricas vuelven a ignorar la zona del comercio', 'const zona = zonaDelMerchant(comercio);\n    const monthStart', "const zona = 'UTC';\n    const monthStart"],
  ['M2 · Hoy vuelve a contar todas las filas del dia', 'templateToday: await prisma.whatsAppMessage.count({ where: plantillasDeHoy(merchantId, zona, now) }),', 'templateToday: rows.filter((r) => r.createdAt >= dayStart).length,'],
  ['M3 · el mes vuelve al reloj del proceso', 'const monthStart = inicioDelDiaEn(`${mesNaturalEn(now, zona)}-01`, zona);', 'const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);'],
  ['M4 · el filtro comun deja de excluir las rechazadas', "    OR: [{ waMessageId: { not: null } }, { status: 'queued' }],\n  };", '  };'],
];

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

function correr() {
  const b = spawnSync(process.execPath, [TSC, '--noCheck'], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  if (b.status !== 0) return { build: b.status };
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...TESTS], { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: 1 << 26 });
  const lineas = r.stdout.split(/\r?\n/);
  const caen = lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''));
  const pasan = lineas.filter((l) => /^ok \d+ - /.test(l)).length;
  const total = Number((lineas.find((l) => /^# tests /.test(l)) || '').slice(8));
  return { build: 0, salida: r.status, total, pasan, caen };
}

console.log('POBLACION: ' + MUTACIONES.length + ' pasadas (1 base + ' + (MUTACIONES.length - 1) + ' mutaciones) · ' + TESTS.join(' + '));
let ciego = false;
try {
  for (const [nombre, de, a] of MUTACIONES) {
    let aplicada = 'n/a';
    if (de) {
      if (original.split(de).length !== 2) { console.log(nombre + ' → CIEGO: el texto a mutar no aparece exactamente una vez'); ciego = true; continue; }
      fs.writeFileSync(SRC, original.replace(de, a));
      aplicada = String(fs.readFileSync(SRC, 'utf8') !== original);
    }
    const r = correr();
    fs.writeFileSync(SRC, original);
    if (r.build !== 0 || !r.total || r.pasan + r.caen.length !== r.total) { console.log(nombre + ' → CIEGO: ' + JSON.stringify(r)); ciego = true; continue; }
    console.log(nombre + ' · mutacion aplicada: ' + aplicada + ' → ' + r.total + ' casos · pasan ' + r.pasan + ' · caen ' + r.caen.length);
    for (const c of r.caen) console.log('    cae: ' + c);
  }
} finally {
  fs.writeFileSync(SRC, original);
  const b = spawnSync(process.execPath, [TSC, '--noCheck'], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  console.log('RESTAURADO: fuente igual al original=' + (fs.readFileSync(SRC, 'utf8') === original) + ' · dist recompilado, salida ' + b.status);
}
console.log('EXIT=' + (ciego ? 2 : 0));
process.exit(ciego ? 2 : 0);
