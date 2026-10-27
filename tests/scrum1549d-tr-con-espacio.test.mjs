// tests/scrum1549d-tr-con-espacio.test.mjs — SCRUM-1549d · la tarea programada ejecuta arranque.cmd
// ENTERO aunque la ruta lleve un espacio
//
// El defecto, medido en la máquina de Javier (SCRUM-1549 c.20760, 24-oct-2026): las tres tareas
// `yaqu-equipo-jv-*` quedaron guardadas con Command `C:\Users\Javier` y Arguments
// `Pereira\…\arranque.cmd`, y cada tanda murió con 0x80070002. `instalar.mjs` imprimía
// `/tr "<ruta>"`: Git Bash se come esas comillas y schtasks parte lo que recibe por el primer espacio.
// Con la ruta de la guía de Luis (`C:\Users\Admin\…`) no se nota, así que todo control va con ESPACIO.
//
// Cómo se mide aquí, sin crear ninguna tarea:
//   1 · la orden que imprime el instalador se pasa por un bash DE VERDAD, con `schtasks` cambiado por
//       una función que escribe sus argumentos: así se ve el /tr que recibiría schtasks;
//   2 · ese /tr se parte como lo partió schtasks en la máquina de Javier (sin comillas, por el primer
//       espacio; con comillas, hasta la de cierre) y sale el XML de la acción;
//   3 · ese XML lo juzga `juzgarAccionTarea`, la misma función que corre `comprobar-instalacion.mjs`.
// Lo que NO mide: el Programador de tareas real. El paso 2 es un MODELO: su mitad sin comillas la fija la
// tabla medida de Javier; su mitad CON comillas no la ha medido nadie en esta máquina (crear una tarea no
// es de una sesión). La primera tarea que se cree con la orden nueva se comprueba con
// `comprobar-instalacion.mjs`, que lee su XML de verdad.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const instalar = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'instalar.mjs')).href);
const comprobar = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'comprobar-instalacion.mjs')).href);

const CON_ESPACIO = 'C:/Users/Javier Pereira/AppData/Local/yaqu-equipo';
const CON_APOSTROFO = "C:/Users/Ana O'Neil/AppData/Local/yaqu-equipo";
const SIN_ESPACIO = 'C:/Users/Admin/AppData/Local/yaqu-equipo';

/** Los argumentos que recibiría schtasks si la orden se pega en bash. */
function argumentosEnBash(orden) {
  const r = spawnSync('bash', ['-c', `schtasks() { printf '%s\\0' "$@"; }; ${orden}`], { encoding: 'utf8' });
  assert.equal(r.status, 0, `bash no corrió la orden (${r.error?.code || r.stderr}): sin bash no hay medida`);
  return r.stdout.split('\0').slice(0, -1);
}

function trDe(orden) {
  const args = argumentosEnBash(orden);
  const i = args.indexOf('/tr');
  assert.ok(i >= 0 && i + 1 < args.length, `la orden no lleva /tr: ${JSON.stringify(args)}`);
  assert.equal(args.length, i + 2, `el /tr no es el último argumento, o se partió en bash: ${JSON.stringify(args)}`);
  return args[i + 1];
}

/** MODELO de cómo guarda schtasks el /tr (ver cabecera), como el XML de `/query /xml`. */
function xmlDeLaAccion(tr) {
  let command; let argumentos;
  if (tr.startsWith('"') && tr.indexOf('"', 1) > 0) {
    const fin = tr.indexOf('"', 1);
    command = tr.slice(0, fin + 1);
    argumentos = tr.slice(fin + 1).trim();
  } else {
    const sp = tr.indexOf(' ');
    command = sp < 0 ? tr : tr.slice(0, sp);
    argumentos = sp < 0 ? '' : tr.slice(sp + 1).trim();
  }
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<Actions Context="Author">\n<Exec>\n<Command>${esc(command)}</Command>\n`
    + (argumentos ? `<Arguments>${esc(argumentos)}</Arguments>\n` : '') + '</Exec>\n</Actions>';
}

/** La orden tal como la imprimía `instalar.mjs` hasta SCRUM-1549d: el control que tiene que CAER. */
function ordenVieja(destino) {
  return `MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-jv-0825 /st 08:25 /tr "${instalar.rutaArranqueCmd(destino)}"`;
}

function juicio(orden, destino) {
  return comprobar.juzgarAccionTarea({ xml: xmlDeLaAccion(trDe(orden)), esperado: instalar.rutaArranqueCmd(destino) });
}

test('🔴 CONTROL: la orden vieja, con una ruta con ESPACIO, deja una tarea que no ejecuta arranque.cmd', () => {
  const tr = trDe(ordenVieja(CON_ESPACIO));
  assert.equal(tr, 'C:\\Users\\Javier Pereira\\AppData\\Local\\yaqu-equipo\\arranque.cmd', 'bash se come las comillas de fuera');
  assert.match(xmlDeLaAccion(tr), /<Command>C:\\Users\\Javier<\/Command>/, 'la partición medida en la máquina de Javier');
  const [veredicto, detalle] = juicio(ordenVieja(CON_ESPACIO), CON_ESPACIO);
  assert.equal(veredicto, 'FALLA', detalle);
  // Y sin espacio no se nota: por eso el defecto vivió en main con la ruta de la guía de Luis.
  assert.equal(juicio(ordenVieja(SIN_ESPACIO), SIN_ESPACIO)[0], 'OK');
});

for (const [nombre, destino] of [['con espacio', CON_ESPACIO], ['con espacio y apóstrofo', CON_APOSTROFO], ['sin espacio', SIN_ESPACIO]]) {
  test(`🔴 la orden de hoy, ruta ${nombre}: schtasks recibe la ruta ENTERA entre comillas y la tarea ejecuta arranque.cmd`, () => {
    const [orden] = instalar.ordenesSchtasks({ destino, tandas: ['08:25'], prefijo: 'jv-' });
    const tr = trDe(orden);
    assert.equal(tr, `"${instalar.rutaArranqueCmd(destino)}"`);
    const [veredicto, detalle] = juicio(orden, destino);
    assert.equal(veredicto, 'OK', detalle);
  });
}

test('🔴 una orden por tanda, y todas con el /tr entrecomillado', () => {
  const ordenes = instalar.ordenesSchtasks({ destino: CON_ESPACIO, tandas: ['08:25', '13:30', '18:35'], prefijo: 'jv-' });
  assert.equal(ordenes.length, 3);
  for (const o of ordenes) assert.equal(juicio(o, CON_ESPACIO)[0], 'OK', o);
});

// ── juzgarAccionTarea con los XML MEDIDOS ───────────────────────────────────────────────────────

test('juzgarAccionTarea: la tarea de Javier tal como la midió jv-j3bb → FALLA, nombrando lo que ejecuta', () => {
  const xml = '<Exec>\r\r\n<Command>C:\\Users\\Javier</Command>\r\r\n'
    + '<Arguments>Pereira\\AppData\\Local\\yaqu-equipo\\arranque.cmd</Arguments>\r\r\n</Exec>';
  const [veredicto, detalle] = comprobar.juzgarAccionTarea({ xml, esperado: instalar.rutaArranqueCmd(CON_ESPACIO) });
  assert.equal(veredicto, 'FALLA');
  assert.match(detalle, /C:\\Users\\Javier/);
  assert.match(detalle, /Pereira/);
});

test('juzgarAccionTarea: la tarea de la máquina de Luis tal como la da `schtasks /query /xml` (27-oct) → OK', () => {
  const xml = '<Actions Context="Author">\r\r\n    <Exec>\r\r\n      '
    + '<Command>C:\\Users\\Admin\\AppData\\Local\\yaqu-equipo\\arranque.cmd</Command>\r\r\n    </Exec>\r\r\n  </Actions>';
  assert.deepEqual(comprobar.juzgarAccionTarea({ xml, esperado: instalar.rutaArranqueCmd(SIN_ESPACIO) })[0], 'OK');
});

test('juzgarAccionTarea: otro .cmd, argumentos de más, o sin acción → nunca OK', () => {
  const esperado = instalar.rutaArranqueCmd(SIN_ESPACIO);
  assert.equal(comprobar.juzgarAccionTarea({ xml: '<Exec><Command>C:\\otro\\arranque.cmd</Command></Exec>', esperado })[0], 'FALLA');
  assert.equal(comprobar.juzgarAccionTarea({ xml: `<Exec><Command>${esperado}</Command><Arguments>x</Arguments></Exec>`, esperado })[0], 'FALLA');
  assert.equal(comprobar.juzgarAccionTarea({ xml: '', esperado })[0], 'NO-PUDE-MIRAR');
  assert.equal(comprobar.juzgarAccionTarea({ xml: '<Exec></Exec>', esperado })[0], 'NO-PUDE-MIRAR');
});
