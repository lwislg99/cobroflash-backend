// docs/master/evidencias/scrum864/el-que-decide.mjs — SCRUM-864
//
// 🔴 EL CONTROL QUE DECIDE: un test que crea un temporal y **falla a mitad**.
//    · HOY (con `mkdtempSync` a pelo) → el directorio se queda.
//    · DESPUÉS (con `temporal()`)     → no se queda.
//
// Y el ✅ POSITIVO: un test que termina bien sigue limpiando y sigue pasando.
//
// Se ejecutan tests DE VERDAD, en procesos aparte, con el runner de la casa. No se razona sobre
// el código: se mira el sistema de ficheros antes y después.
//
// ⛔ NO BORRA NADA DE TMPDIR. Trabaja en un directorio propio que crea y destruye él mismo, así
//    que no puede tocar el temporal de otra sesión — que es la cautela del ticket.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from '../../../../tests/_temporal.mjs'; // SCRUM-864 · predica con el ejemplo

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const NODE = process.execPath;

// El banco vive en SU PROPIO TMPDIR, no en el compartido: así lo que cuenta es suyo y nada más.
// Y usa `temporal()`, como todo lo demás: un banco que mide restos y deja el suyo no tendría
// ninguna autoridad para decir nada. Lo cazó su propio censo.
const CAJA = temporal('scrum864-banco-');
const salida = [];
const di = (s = '') => { salida.push(s); console.log(s); };

const PREFIJO = 'scrum864-cobaya-';

// 🔴 `file://`, NO la ruta absoluta. En Windows, `import 'C:/…'` revienta con
// ERR_UNSUPPORTED_ESM_URL_SCHEME — y la primera versión de este banco lo tenía así, con una
// consecuencia que casi publica una mentira: la cobaya de DESPUÉS **no llegaba a ejecutarse**,
// así que dejaba 0 directorios… porque no creaba ninguno. Un cero de un test que no corre se lee
// igual que un cero de un test que limpia. Por eso abajo hay un SUELO DE EJECUCIÓN.
const IMPORT_TEMPORAL = JSON.stringify(pathToFileURL(path.join(RAIZ, 'tests/_temporal.mjs')).href);

/** Un fichero de test que crea un temporal y **revienta** después. Dos versiones. */
const COBAYA = (conHelper, marca) => `
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
${conHelper
    ? `import { temporal } from ${IMPORT_TEMPORAL};`
    : "import os from 'node:os';\nimport path from 'node:path';"}

test('cobaya · crea un temporal y falla a mitad', () => {
  const dir = ${conHelper
    ? `temporal('${PREFIJO}')`
    : `fs.mkdtempSync(path.join(os.tmpdir(), '${PREFIJO}'))`};
  // SUELO DE EJECUCIÓN: deja constancia de que el cuerpo del test SE HA EJECUTADO. Sin esto, un
  // fichero que ni siquiera importa daría «0 restos» y pasaría por arreglado.
  fs.writeFileSync(${JSON.stringify(marca)}, dir);
  assert.equal(1, 2, 'este fallo es EL PUNTO del caso: se rompe antes de limpiar');
  ${conHelper ? '' : 'fs.rmSync(dir, { recursive: true, force: true });'}
});
`;

/** Lo mismo, pero el test TERMINA BIEN: el control positivo. */
const COBAYA_OK = (conHelper, marca) => `
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
${conHelper
    ? `import { temporal } from ${IMPORT_TEMPORAL};`
    : "import os from 'node:os';\nimport path from 'node:path';"}

test('cobaya · crea un temporal y termina bien', () => {
  const dir = ${conHelper
    ? `temporal('${PREFIJO}')`
    : `fs.mkdtempSync(path.join(os.tmpdir(), '${PREFIJO}'))`};
  fs.writeFileSync(${JSON.stringify(marca)}, dir);
  assert.ok(dir, 'el directorio se ha creado');
  ${conHelper ? '' : 'fs.rmSync(dir, { recursive: true, force: true });'}
});
`;

/** Cuenta SÓLO los directorios de esta cobaya. Nunca mira, ni toca, nada más. */
const mios = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith(PREFIJO));

/**
 * Corre una cobaya y devuelve qué dejó. `hazFuente(marca)` recibe la ruta del testigo de
 * ejecución: sin ese testigo, un fichero que ni importa daría «0 restos» y pasaría por arreglado.
 */
function correrCobaya(hazFuente, etiqueta) {
  const antes = new Set(mios());
  const f = path.join(CAJA, 'cobaya.test.mjs');
  const marca = path.join(CAJA, 'ejecutado.txt');
  if (fs.existsSync(marca)) fs.rmSync(marca);
  fs.writeFileSync(f, hazFuente(marca.replace(/\\/g, '/')));
  const r = spawnSync(NODE, ['--test', '--test-force-exit', '--test-reporter=tap', f],
    { cwd: RAIZ, shell: false, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const txt = (r.stdout || '') + (r.stderr || '');
  const paso = /^# fail 0$/m.test(txt);
  const despues = mios().filter((n) => !antes.has(n));
  return { etiqueta, paso, dejados: despues.length, nombres: despues, txt, ejecutado: fs.existsSync(marca) };
}

di('═══ 🔴 EL QUE DECIDE · un test que crea un temporal y FALLA A MITAD ═══');
di('');

const hoy = correrCobaya((m) => COBAYA(false, m), 'HOY · mkdtempSync a pelo');
di('   HOY (mkdtempSync a pelo)');
di('     ¿llegó a EJECUTARSE el cuerpo? .: ' + (hoy.ejecutado ? 'sí' : '🔴 NO'));
di('     ¿el test pasa? ................: ' + (hoy.paso ? 'sí' : 'no — falla a propósito, ése es el caso'));
di('     directorios que deja tirados ..: ' + hoy.dejados + (hoy.dejados ? '  🔴' : ''));

// SUELO: si el caso de HOY no dejara ninguno, no habría defecto que arreglar y todo lo de abajo
// estaría midiendo otra cosa.
if (hoy.dejados === 0) {
  di('');
  di('🔴 CIEGO: el caso de HOY no ha dejado ningún resto, así que este banco NO está reproduciendo');
  di('   el defecto. Sin reproducirlo, un cero en el caso de DESPUÉS no significa «arreglado».');
  fs.rmSync(CAJA, { recursive: true, force: true });
  fs.writeFileSync(path.join(AQUI, 'salida-el-que-decide.txt'), salida.join('\n') + '\n');
  process.exit(3);
}

// Se limpia lo que la cobaya de HOY ha dejado: es basura de este banco, creada por él hace un
// segundo y con su prefijo propio. No es «limpiar TMPDIR».
for (const n of hoy.nombres) fs.rmSync(path.join(os.tmpdir(), n), { recursive: true, force: true });

const despues = correrCobaya((m) => COBAYA(true, m), 'DESPUÉS · con temporal()');
di('');
di('   DESPUÉS (con `temporal()`)');
di('     ¿llegó a EJECUTARSE el cuerpo? .: ' + (despues.ejecutado ? 'sí' : '🔴 NO'));
di('     ¿el test pasa? ................: ' + (despues.paso ? 'sí' : 'no — sigue fallando, y debe'));
di('     directorios que deja tirados ..: ' + despues.dejados + (despues.dejados ? '  🔴' : '  ✅'));
di('');
// 🔴 EL SUELO QUE FALTABA EN LA PRIMERA VERSIÓN. Sin él, un fichero que ni siquiera importa
// —le pasó a este banco con un `import 'C:/…'` sin `file://`— deja 0 restos y se lee como
// «arreglado». Un cero de algo que no corrió no es un cero.
if (!despues.ejecutado) {
  di('🔴 CIEGO: la cobaya de DESPUÉS no llegó a ejecutar su cuerpo, así que su «0 restos» no');
  di('   significa nada. Lo que dijo el runner:');
  for (const l of despues.txt.split('\n').filter((x) => /Error|ERR_|not ok/.test(x)).slice(0, 5)) di('   ' + l.trim().slice(0, 150));
  fs.rmSync(CAJA, { recursive: true, force: true });
  fs.writeFileSync(path.join(AQUI, 'salida-el-que-decide.txt'), salida.join('\n') + '\n');
  process.exit(3);
}
di('   VEREDICTO: ' + (hoy.ejecutado && despues.ejecutado && hoy.dejados > 0 && despues.dejados === 0
  ? '✅ el defecto se reproduce HOY y desaparece DESPUÉS, y los dos cuerpos se ejecutaron.'
  : '🔴 no se sostiene: hoy ' + hoy.dejados + ', después ' + despues.dejados));
di('');
di('   ⚠️ Y el test sigue FALLANDO en los dos casos, que es lo correcto: el arreglo es de higiene,');
di('      no de comportamiento. Si el de después hubiera pasado, habría tapado el fallo.');
di('');

di('═══ ✅ POSITIVO · un test que termina bien sigue limpiando y sigue pasando ═══');
di('');
const okHoy = correrCobaya((m) => COBAYA_OK(false, m), "OK hoy");
const okDespues = correrCobaya((m) => COBAYA_OK(true, m), "OK despues");
di('   HOY     · pasa: ' + okHoy.paso + ' · deja: ' + okHoy.dejados);
di('   DESPUÉS · pasa: ' + okDespues.paso + ' · deja: ' + okDespues.dejados);
di('   VEREDICTO: ' + (okHoy.paso && okDespues.paso && okDespues.dejados === 0
  ? '✅ sigue pasando y sigue sin dejar nada.'
  : '🔴 el camino feliz ha cambiado de comportamiento'));
// Un banco que dice «no pasa» sin enseñar POR QUÉ es medio instrumento: el rojo hay que poder
// leerlo sin volver a ejecutarlo a mano.
if (!okDespues.paso) {
  di('');
  di('   ── lo que dijo el runner ──');
  for (const l of okDespues.txt.split('\n').filter((x) => /error|Error|not ok|ERR_/.test(x)).slice(0, 8)) {
    di('   ' + l.trim().slice(0, 150));
  }
}

for (const n of [...okHoy.nombres, ...okDespues.nombres, ...despues.nombres]) {
  fs.rmSync(path.join(os.tmpdir(), n), { recursive: true, force: true });
}
fs.rmSync(CAJA, { recursive: true, force: true });
fs.writeFileSync(path.join(AQUI, 'salida-el-que-decide.txt'), salida.join('\n') + '\n');
