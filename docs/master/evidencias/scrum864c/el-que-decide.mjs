// docs/master/evidencias/scrum864c/el-que-decide.mjs — SCRUM-864c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE · un test que crea un temporal y FALLA A MITAD
//
//   ¿HOY deja el directorio tirado? ¿Y DESPUÉS del arreglo?
//
// La forma que se reproduce es la REAL, la que tenía `tests/scrum899b-arranque-de-la-tanda.mjs`:
// una FÁBRICA (`banco()`) que crea el temporal y luego hace más cosas —`git init`, copias,
// procesos— antes de devolvérselo a su llamador. El llamador sí tiene un `finally` que limpia,
// pero **todavía no ha entrado en él**: si la fábrica revienta a mitad, ese `finally` no existe.
// Por eso el arreglo no podía ser «pon un finally»: el hueco está ANTES del try.
//
// ── CÓMO SE CUENTA, Y POR QUÉ ASÍ ────────────────────────────────────────────────────────────
//
// 🔴 CADA COBAYA CORRE CON SU PROPIO TMPDIR, dentro del banco. Contar restos en el TMPDIR de
//    verdad sería contar el trabajo de los ~26 worktrees que lo comparten, y este ticket avisa
//    por escrito de que ahí no se toca nada. Con `TEMP`/`TMP`/`TMPDIR` apuntando al banco,
//    `os.tmpdir()` —y con él `temporal()`— crean DENTRO y el recuento es exacto.
//
// 🔴 Y CADA COBAYA ESCRIBE UN TESTIGO DE EJECUCIÓN. Es la lección que SCRUM-864 pagó: su primera
//    versión importaba el helper con una ruta de Windows sin `file://`, la cobaya no llegaba a
//    ejecutarse, y dejaba 0 restos porque no creaba ninguno.
//
//        🔒 Un cero de algo que no corrió se lee igual que un cero de algo que limpia.
//
//    Si falta el testigo, esto ABORTA en vez de publicar un cero que no ha ganado.
//
// ⛔ No borra nada de TMPDIR. Todo lo suyo cuelga de un `temporal()` que se borra solo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const HELPER = pathToFileURL(path.join(RAIZ, 'tests', '_temporal.mjs')).href;

// 🔴 EL BANCO SE LIMPIA SOLO, Y **SIN USAR EL HELPER** — error mío, cazado por la propia medición
// de esta tanda. La primera versión creaba este directorio con `temporal()`, y `mutacion.mjs`
// mutila justo ese mecanismo para comprobar que tiene dientes: durante la mutación el banco se
// quedaba sin limpieza y dejaba su propio resto en TMPDIR. Un banco que prueba la limpieza y no se
// limpia a sí mismo. Con su enganche propio, la mutación del helper ya no le afecta.
const BANCO = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum864c-banco-'));
process.on('exit', () => { try { fs.rmSync(BANCO, { recursive: true, force: true }); } catch { /* ya no está */ } });
const NL = '\n';

/**
 * Una cobaya: un fichero de test de verdad, corrido por el runner de verdad, con su TMPDIR propio.
 *
 * @param {string} nombre     para separar su banco del de las demás.
 * @param {boolean} conHelper `temporal()` (DESPUÉS) o `fs.mkdtempSync` a pelo (HOY).
 * @param {boolean} revienta  si la FÁBRICA falla a mitad, antes de devolver el banco.
 */
function cobaya(nombre, { conHelper, revienta }) {
  const suyo = path.join(BANCO, nombre);
  const tmpdir = path.join(suyo, 'tmp');
  fs.mkdirSync(tmpdir, { recursive: true });
  const testigo = path.join(suyo, 'testigo.txt');
  const guion = path.join(suyo, 'cobaya.test.mjs');

  fs.writeFileSync(guion, [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import fs from 'node:fs';",
    "import os from 'node:os';",
    "import path from 'node:path';",
    conHelper ? `import { temporal } from ${JSON.stringify(HELPER)};` : '',
    `const TESTIGO = ${JSON.stringify(testigo)};`,
    '',
    '// La fábrica: crea el temporal y sigue trabajando antes de devolverlo.',
    'function banco() {',
    conHelper
      ? "  const dir = temporal('cobaya-');"
      : "  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cobaya-'));",
    "  fs.appendFileSync(TESTIGO, 'la fabrica creo el temporal' + '\\n');",
    revienta
      ? "  throw new Error('la fabrica revienta a mitad, como un `git init` que falla');"
      : '',
    '  return { dir, limpiar: () => fs.rmSync(dir, { recursive: true, force: true }) };',
    '}',
    '',
    "test('la cobaya', () => {",
    '  const b = banco();            // ← fuera del try, igual que en scrum899b',
    '  try {',
    "    fs.appendFileSync(TESTIGO, 'el cuerpo del test corrio' + '\\n');",
    '    assert.ok(fs.existsSync(b.dir));',
    '  } finally { b.limpiar(); }',
    '});',
  ].filter(Boolean).join(NL));

  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', guion], {
    encoding: 'utf8',
    // 🔴 El TMPDIR de la cobaya, no el de la casa.
    env: { ...process.env, TEMP: tmpdir, TMP: tmpdir, TMPDIR: tmpdir },
  });

  const testigoTexto = fs.existsSync(testigo) ? fs.readFileSync(testigo, 'utf8') : '';
  return {
    paso: r.status === 0,
    creo: testigoTexto.includes('la fabrica creo el temporal'),
    cuerpo: testigoTexto.includes('el cuerpo del test corrio'),
    restos: fs.readdirSync(tmpdir).length,
  };
}

const di = (s = '') => console.log(s);
const fmt = (c) => `pasa: ${c.paso ? 'sí' : 'NO'} · ¿creó el temporal?: ${c.creo ? 'sí' : '🔴 NO'} `
  + `· deja tirados: ${c.restos}${c.restos ? '  🔴' : '  ✅'}`;

di('═══ SCRUM-864c · EL QUE DECIDE ═══');
di('');
di('🔴 LA FÁBRICA REVIENTA A MITAD (el `finally` del llamador aún no existe)');
const hoyRoto = cobaya('hoy-revienta', { conHelper: false, revienta: true });
const despuesRoto = cobaya('despues-revienta', { conHelper: true, revienta: true });
di('   HOY     (fs.mkdtempSync) : ' + fmt(hoyRoto));
di('   DESPUÉS (temporal())     : ' + fmt(despuesRoto));
di('');
di('✅ POSITIVO · LA FÁBRICA TERMINA BIEN Y EL TEST PASA');
const hoyOk = cobaya('hoy-ok', { conHelper: false, revienta: false });
const despuesOk = cobaya('despues-ok', { conHelper: true, revienta: false });
di('   HOY     (fs.mkdtempSync) : ' + fmt(hoyOk));
di('   DESPUÉS (temporal())     : ' + fmt(despuesOk));
di('');

// ── EL SUELO DEL BANCO ──────────────────────────────────────────────────────────────────────
const todas = { hoyRoto, despuesRoto, hoyOk, despuesOk };
const mudas = Object.entries(todas).filter(([, c]) => !c.creo).map(([n]) => n);
if (mudas.length) {
  di('🔴 BANCO CIEGO: estas cobayas no llegaron a crear su temporal: ' + mudas.join(', '));
  di('   Un cero de algo que no corrió se lee igual que un cero de algo que limpia. No se publica nada.');
  process.exit(3);
}

const veredicto = hoyRoto.restos > 0 && despuesRoto.restos === 0;
di('VEREDICTO: ' + (veredicto
  ? '✅ CIERRA — hoy el reventón deja el directorio; con `temporal()` no queda ninguno.'
  : '🔴 NO CIERRA — revisar: hoy deja ' + hoyRoto.restos + ', después deja ' + despuesRoto.restos));
di('POSITIVO : ' + (hoyOk.paso && despuesOk.paso && hoyOk.restos === 0 && despuesOk.restos === 0
  ? '✅ un test que termina bien sigue pasando y sigue sin dejar nada, con helper y sin él.'
  : '🔴 el camino feliz ha cambiado de comportamiento.'));
process.exit(veredicto ? 0 : 1);
