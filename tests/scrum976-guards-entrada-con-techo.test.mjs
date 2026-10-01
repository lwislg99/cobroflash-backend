// tests/scrum976-guards-entrada-con-techo.test.mjs — SCRUM-976
//
// `guards:entrada` DEBE COMPROBAR LO QUE CAE EN CI, Y DEBE SEGUIR TARDANDO SEGUNDOS.
//
// ── EL DEFECTO, MEDIDO ──────────────────────────────────────────────────────────────────────
// El 20-sep-2026 el #1541 cayó en CI por `tests/scrum237-negacion-respaldada.test.mjs` (una negación
// sin respaldo en `scrum320-que-falta-para-cobrar:418`). Reproducido en un worktree en ESE commit,
// sin `dist` y sin base:
//
//     node --test tests/scrum237-negacion-respaldada.test.mjs   → tests 8 · pass 7 · fail 1
//     node scripts/guards-entrada.mjs                            → «4 guards de entrada en verde»  EXIT 0
//
// El mismo commit daba ROJO en CI y VERDE en el comando que dice «lo que puede poner un PR en rojo,
// se mira antes de empujar». La lista no lo incluía. Un censo cuya población crece sola —la suite
// entera— no puede quedarse fuera de quien se corre «para no enterarte por el PR».
//
// ── LA DECISIÓN, Y SU LÍMITE ────────────────────────────────────────────────────────────────
// Criterio tal cual (todo lo que pasa sin `dist` ni base): 313 ficheros, ~14 minutos. No cabe. Entran
// SEIS (237, 258, 514, 522, 548, 723) y el comando entero tiene un TECHO de 90 s. Un techo que solo
// vive en un comentario es una frase: aquí lo cumple el propio comando (plazo del `spawnSync`) y lo
// vigila este fichero lanzándolo de verdad.
//
// ── LAS DOS MITADES ─────────────────────────────────────────────────────────────────────────
//   ① «no baja en silencio»: los once están, por NOMBRE (se compara el conjunto, no una cuenta), y
//      el suelo no es menor que ellos. Quitar uno «porque molestaba» hace caer esto.
//   ② el techo: fijado, y solo BAJABLE desde el entorno.
//   ③ mitad NEGATIVA: con un plazo de 1 ms el comando NO sale 0 y dice por qué. Sin esto, el techo podría
//      no hacer nada nunca y este fichero seguiría verde (un control que no se vio fallar).
//   ④ mitad POSITIVA: el comando de verdad, sobre el árbol de verdad, sale 0, cabe en el techo y
//      ejecutó los guards que dice (no «0 tests, 0 fallos»).
//
// ── 🔴 SCRUM-1345 (1-oct-2026) · PASARSE DEL PLAZO NO ES UN ROJO: ES UN CIEGO ─────────────────────
// Hasta hoy ③ exigía salida 1 al agotar el plazo: el mismo código que «un guard encontró algo». Y el
// tiempo lo decide la máquina (597 pasadas en CI: máximo 15,4 s; en la máquina de trabajo, el mismo
// árbol, de 10 s a más de 90 según los núcleos libres). Lo que cambia, y lo que NO:
//   ③ el plazo agotado sale 2 («no terminé; no sé nada de tus guards»). Sigue sin ser un 0.
//   ④ el PRESUPUESTO se juzga EN CI: allí pasarse sigue siendo ROJO, igual que antes. En local, un
//      plazo agotado se DICE (diagnóstico) y no tumba la tanda; un guard en rojo la sigue tumbando.
//   ⑤ lo que protege lo ganado: un test que YA había caído cuando se cortó sigue dando salida 1.
//   ⑥ la línea «N guards · T s · plazo P s», que sale siempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import os from 'node:os';

import {
  GUARDS, MINIMO, TECHO_MS, PRESUPUESTO_MS, techoEfectivo, cuentasDeLaPasada, lineaDeLaPasada,
} from '../scripts/guards-entrada.mjs';
import { veredictoDe, SALIDA_VERDE, SALIDA_HALLAZGO, SALIDA_NO_SUPE_MEDIR } from '../scripts/_hallazgos-y-ciegos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'guards-entrada.mjs');

// Los cinco de antes y los seis de SCRUM-976. Es la lista por la que se decidió, escrita a
// propósito: añadir un duodécimo NO toca esto; quitar uno sí.
const LOS_ONCE = [
  'tests/scrum273-registro-por-fichero.test.mjs',
  'tests/scrum267-ancla-de-medicion.test.mjs',
  'tests/scrum391-guards-declarados-presentes.test.mjs',
  'tests/scrum242-scripts-no-prometen-documentos.test.mjs',
  'tests/public-js-parsea.test.mjs',
  'tests/scrum237-negacion-respaldada.test.mjs',
  'tests/scrum258-nota-por-sesion.test.mjs',
  'tests/scrum514-aprobado-y-aplicado.test.mjs',
  'tests/scrum522-guards-fuera-de-la-tanda.test.mjs',
  'tests/scrum548-peaje-package-json.test.mjs',
  'tests/scrum723-guard-contra-su-base.test.mjs',
];

/**
 * El comando de verdad, en un proceso hijo. ⚠️ `NODE_TEST_CONTEXT` se hereda y cambia el reporter del
 * hijo a uno serializado que no escribe nada por stdout (medido en SCRUM-928): sin quitarlo, este
 * test leería una salida VACÍA. Y `FORCE_COLOR` fuera, que no es lo que se mide aquí.
 */
function lanzar(extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.NODE_TEST_CONTEXT;
  delete env.FORCE_COLOR;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: RAIZ, encoding: 'utf8', env });
  return { r, ms: Date.now() - t0 };
}

test('SCRUM-976 ① están los once, por nombre, y el suelo no baja de ellos', () => {
  const nombres = GUARDS.map((g) => g.fichero);
  assert.equal(new Set(nombres).size, nombres.length, '🔴 hay un guard repetido en la lista');
  const faltan = LOS_ONCE.filter((f) => !nombres.includes(f));
  assert.deepEqual(faltan, [],
    '🔴 `guards:entrada` ha perdido un guard que se decidió que llevara: ' + faltan.join(', '));
  assert.ok(MINIMO >= LOS_ONCE.length,
    `🔴 el suelo (${MINIMO}) bajó de los ${LOS_ONCE.length} decididos: quitar una línea ya no haría saltar nada.`);
  assert.ok(GUARDS.length >= MINIMO, '🔴 la lista es menor que su propio suelo');
  for (const g of GUARDS) {
    assert.ok(fs.existsSync(path.join(RAIZ, g.fichero)), `🔴 ${g.fichero} no existe`);
    assert.ok(g.porque && g.porque.length > 20, `🔴 ${g.fichero} no dice POR QUÉ está en la lista`);
  }
});

test('SCRUM-976 ② el techo está fijado en 90 s y desde el entorno solo se puede BAJAR', () => {
  assert.equal(TECHO_MS, 90000,
    '🔴 el techo cambió: si es a propósito, que este número lo diga en el mismo PR que lo explica.');
  assert.equal(techoEfectivo(undefined), TECHO_MS, 'sin petición vale el techo');
  assert.equal(techoEfectivo('5000'), 5000, 'un plazo menor se respeta (así se prueba la mitad negativa)');
  assert.equal(techoEfectivo('999999999'), TECHO_MS, '🔴 el entorno NO puede subir el techo');
  for (const malo of ['', 'abc', '0', '-5', 'NaN', 'Infinity']) {
    assert.equal(techoEfectivo(malo), TECHO_MS, `«${malo}» no es un plazo: vale el techo, no «sin plazo»`);
  }
});

/** La línea que el comando imprime SIEMPRE (SCRUM-1345 ⑥), tal como sale por stdout. */
const RE_LINEA = /^(\d+) guards · (\d+\.\d) s · plazo ([\d.]+) s$/m;

test('SCRUM-976 ③ mitad NEGATIVA: con un plazo de 1 ms el comando sale CIEGO (2), no rojo, y dice que no terminó', () => {
  const { r } = lanzar({ GUARDS_ENTRADA_TECHO_MS: '1' });
  assert.equal(r.status, SALIDA_NO_SUPE_MEDIR,
    `🔴 con el plazo agotado y sin nada caído el comando debe salir ${SALIDA_NO_SUPE_MEDIR} (salió ${r.status}): `
    + 'un 0 sería un verde sobre nada, y un 1 es lo que dice un guard que encontró algo (SCRUM-1345).');
  assert.match(r.stderr || '', /no terminé; no sé nada de tus guards/,
    '🔴 salió 2, pero NO dice que es por el plazo: un ciego por otra causa no prueba que el plazo funcione.');
  assert.match(r.stderr || '', /0 hallazgos · 1 ciego/, '🔴 el veredicto no dice sus dos cuentas (SCRUM-1320)');
  assert.doesNotMatch(r.stdout || '', /guards de entrada en verde/, '🔴 dijo «verde» con el plazo agotado');
  const m = RE_LINEA.exec(r.stdout || '');
  assert.ok(m, '🔴 con el plazo agotado no sale la línea «N guards · T s · plazo P s»');
  assert.equal(Number(m[1]), GUARDS.length, 'la línea no dice cuántos guards lanzó');
  assert.equal(Number(m[3]), 0.001, 'la línea no dice el plazo que se aplicó de verdad (1 ms)');
});

// ── SCRUM-1345 · DÓNDE SE JUZGA EL PRESUPUESTO, y cómo se lee la señal ───────────────────────────
// Este fichero lee UNA señal del entorno, `CI`, y está declarada en el tope de `scrum702`. Se lee
// por PRESENCIA, no por verdad: con que la variable EXISTA —valga `true`, `1`, `0`, `false` o la
// cadena vacía— se juzga. Sólo su AUSENCIA es «local». La duda cae del lado estricto: un CI que se
// anuncie raro sigue juzgando; lo que no puede pasar es que deje de hacerlo sin que nadie lo vea.
function seJuzgaElPresupuesto(valorDeCI) {
  return valorDeCI !== undefined;
}

const RE_NO_TERMINO = /no terminé; no sé nada de tus guards/;

/**
 * La sentencia del caso ④ sobre una pasada del comando. PURA, para poder darle las dos mitades
 * —la de CI y la local— sin estar en los dos sitios: `rojo` es el motivo por el que el caso cae
 * (o `null`), y `aviso`, lo que se dice sin tumbar nada (o `null`).
 *
 * En CI es EXACTAMENTE tan estricta como antes de SCRUM-1345: cualquier salida distinta de 0 cae
 * —el ciego también— y pasarse del presupuesto cae. En local, lo único que deja de tumbar la tanda
 * es el tiempo: un plazo agotado sin nada caído, o un verde que tardó de más. Un guard en rojo cae
 * en los dos sitios.
 */
function sentenciaDelPositivo({ status, stdout, stderr, ms, enCI }) {
  const avisos = [];
  if (status === SALIDA_NO_SUPE_MEDIR && RE_NO_TERMINO.test(stderr)) {
    const informe = `\`guards:entrada\` no terminó en su plazo (${TECHO_MS / 1000} s) sobre este árbol: CIEGO, no rojo.`;
    if (enCI) return { rojo: `PRESUPUESTO: ${informe} En CI esto SÍ es un rojo: la lista ya no cabe. Hay que dejar sitio o subirlo A PROPÓSITO.`, aviso: null };
    return { rojo: null, aviso: `⬜ ${informe} No se ha juzgado nada de la lista; relánzalo con la máquina tranquila.` };
  }
  if (status !== 0) return { rojo: `\`guards:entrada\` salió ${status} sobre este árbol.`, aviso: null };
  if (ms >= PRESUPUESTO_MS) {
    const informe = `tardó ${ms} ms y el presupuesto son ${PRESUPUESTO_MS}`;
    if (enCI) return { rojo: `PRESUPUESTO: ${informe}: hay que dejar sitio o subirlo A PROPÓSITO.`, aviso: null };
    avisos.push(`⬜ ${informe}; aquí el tiempo lo decide la máquina y no se juzga.`);
  }
  if (!new RegExp(`✓ ${GUARDS.length} guards de entrada en verde \\(\\d+ tests`).test(stdout)) {
    return { rojo: 'no dice haber corrido los guards de la lista: un verde sin población es una frase.', aviso: null };
  }
  // El recuento de tests ejecutados: al menos tantos como ficheros (cada uno lleva ≥ 1).
  const n = Number(/en verde \((\d+) tests/.exec(stdout)?.[1]);
  if (!(n >= GUARDS.length)) return { rojo: `se ejecutaron ${n} tests entre ${GUARDS.length} ficheros`, aviso: null };
  const m = RE_LINEA.exec(stdout);
  if (!m) return { rojo: 'en verde no sale la línea «N guards · T s · plazo P s»: tiene que salir SIEMPRE, también con cero.', aviso: null };
  if (Number(m[1]) !== GUARDS.length) return { rojo: 'la línea no dice cuántos guards corrieron', aviso: null };
  if (Number(m[3]) !== TECHO_MS / 1000) return { rojo: 'la línea no dice el plazo', aviso: null };
  return { rojo: null, aviso: avisos.length ? avisos.join(' ') : null };
}

test('SCRUM-976 ④ mitad POSITIVA: el comando de verdad sale 0 y ejecutó los guards; el presupuesto se juzga en CI',
  { timeout: 120000 }, (t) => {
    const enCI = seJuzgaElPresupuesto(process.env.CI);
    const { r, ms } = lanzar();
    // Se DICE siempre, también cuando juzga: si la línea sólo saliera en local, que faltara no
    // distinguiría «estoy en CI» de «alguien la quitó».
    t.diagnostic(`presupuesto de ${PRESUPUESTO_MS / 1000} s juzgado: ${enCI ? 'SÍ (CI)' : 'NO (local: el tiempo lo decide la máquina)'} · tardó ${(ms / 1000).toFixed(1)} s`);
    const s = sentenciaDelPositivo({ status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', ms, enCI });
    if (s.aviso) t.diagnostic(s.aviso);
    assert.equal(s.rojo, null, `🔴 ${s.rojo}\n${(r.stdout || '').slice(-1500)}\n${(r.stderr || '').slice(-1500)}`);
    // El positivo que respalda la negación de ③ (allí NO puede decir «verde»): cuando sale 0, lo dice.
    if (r.status === 0) {
      assert.match(r.stdout || '', /guards de entrada en verde/, '🔴 salió 0 y no dice «verde»');
    }
  });

test('SCRUM-1345 ④bis la señal `CI` se lee por PRESENCIA: sólo su ausencia es «local»', () => {
  assert.equal(seJuzgaElPresupuesto(undefined), false, 'sin la variable es local: no se juzga');
  for (const valor of ['true', '1', '0', 'false', '']) {
    assert.equal(seJuzgaElPresupuesto(valor), true,
      `🔴 con CI=«${valor}» el presupuesto dejaría de juzgarse: un CI que se anuncia raro perdería la red sin que nadie lo vea.`);
  }
});

test('SCRUM-1345 ④ter en CI el caso ④ es tan estricto como antes; en local sólo el TIEMPO deja de tumbar', () => {
  const VERDE = `✓ ${GUARDS.length} guards de entrada en verde (122 tests, 9.3 s de 90). La entrada puede empujarse.\n`
    + `${lineaDeLaPasada({ guards: GUARDS.length, ms: 9300, plazoMs: TECHO_MS })}\n`;
  const CIEGO = { status: SALIDA_NO_SUPE_MEDIR, stdout: '', stderr: '⬜ CIEGO — no terminé; no sé nada de tus guards.', ms: 90100 };
  const limpio = { status: 0, stdout: VERDE, stderr: '', ms: 9300 };

  // El control de los controles: la pasada limpia de cebo pasa en los dos sitios (si no, todo lo de
  // abajo «caería» por el cebo y no por lo que dice probar).
  assert.deepEqual(sentenciaDelPositivo({ ...limpio, enCI: true }), { rojo: null, aviso: null });
  assert.deepEqual(sentenciaDelPositivo({ ...limpio, enCI: false }), { rojo: null, aviso: null });

  // 🔴 LA RED: en CI un plazo agotado SIGUE siendo rojo, y pasarse del presupuesto también.
  assert.match(String(sentenciaDelPositivo({ ...CIEGO, enCI: true }).rojo), /PRESUPUESTO/,
    '🔴 en CI un plazo agotado ha dejado de ser rojo: se ha perdido la red entera por arreglar su borde.');
  assert.match(String(sentenciaDelPositivo({ ...limpio, ms: TECHO_MS, enCI: true }).rojo), /PRESUPUESTO/,
    '🔴 en CI ya no cae una pasada que tarda lo que el presupuesto');

  // En local, ese mismo plazo agotado NO tumba el caso, y se dice.
  const local = sentenciaDelPositivo({ ...CIEGO, enCI: false });
  assert.equal(local.rojo, null, '🔴 en local un plazo agotado sin nada caído vuelve a tumbar la tanda (SCRUM-1345)');
  assert.match(String(local.aviso), /CIEGO, no rojo/, 'en local el plazo agotado se calla en vez de decirse');
  const lento = sentenciaDelPositivo({ ...limpio, ms: TECHO_MS, enCI: false });
  assert.equal(lento.rojo, null);
  assert.match(String(lento.aviso), /no se juzga/, 'en local un verde que tardó de más se calla');

  // 🔴 Y LO QUE NO SE RELAJA EN NINGÚN SITIO: un guard en rojo, un ciego que no es el del plazo, y
  // un «verde» sin población.
  for (const enCI of [true, false]) {
    const donde = enCI ? 'CI' : 'local';
    assert.match(String(sentenciaDelPositivo({ status: 1, stdout: '', stderr: '🔴 Algún guard de entrada está en rojo.', ms: 9300, enCI }).rojo),
      /salió 1/, `🔴 en ${donde} un guard en rojo ya no tumba el caso`);
    assert.match(String(sentenciaDelPositivo({ status: SALIDA_NO_SUPE_MEDIR, stdout: '', stderr: 'otra cosa', ms: 9300, enCI }).rojo),
      /salió 2/, `🔴 en ${donde} un 2 que NO es el del plazo pasa por ciego de plazo`);
    assert.match(String(sentenciaDelPositivo({ status: 0, stdout: '', stderr: '', ms: 9300, enCI }).rojo),
      /sin población/, `🔴 en ${donde} un 0 que no dice qué corrió pasa por verde`);
  }
});

// ── SCRUM-1345 ⑤ · LO QUE PROTEGE LO GANADO ──────────────────────────────────────────────────────
// Convertir el plazo en ciego tiene un modo de romperse que es peor que el defecto: que un guard que
// SÍ encontró algo acabe saliendo «ciego» porque además se agotó el plazo. Aquí se prueba con la
// salida REAL del runner de node —no con un texto escrito a mano, que envejece con la versión—: dos
// cebos fuera del árbol, corridos hasta el final (sin reloj: no hay sorteo), y su salida recortada
// justo antes del resumen, que es lo que queda cuando al runner se le corta a mitad.
function salidaRealDelRunner(nombre, cuerpo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1345-'));
  try {
    fs.writeFileSync(path.join(dir, nombre), cuerpo);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    delete env.NODE_OPTIONS;
    delete env.FORCE_COLOR;
    const r = spawnSync(process.execPath, ['--test', nombre], { cwd: dir, encoding: 'utf8', env });
    const salida = r.stdout || '';
    const fin = salida.search(/^[^\n]*\btests\s+\d+\s*$/m);
    assert.ok(fin > 0, `🔴 CIEGO: el runner no dejó resumen al correr el cebo ${nombre} (estado ${r.status}).\n${salida}\n${r.stderr || ''}`);
    return { status: r.status, entera: salida, cortada: salida.slice(0, fin) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('SCRUM-1345 ⑤ un test que YA había caído sigue siendo ROJO aunque se agote el plazo; sin caídos, CIEGO; y el verde, 0', () => {
  const CAE = "import test from 'node:test';\n"
    + "test('cebo 1345 que pasa', () => {});\n"
    + "test('cebo 1345 que CAE', () => { throw new Error('caída de cebo'); });\n";
  const PASA = "import test from 'node:test';\ntest('cebo 1345 limpio', () => {});\n";
  const cae = salidaRealDelRunner('cae.test.mjs', CAE);
  const pasa = salidaRealDelRunner('pasa.test.mjs', PASA);

  // Los cebos hicieron lo que dicen (si no, lo de abajo se cumpliría sobre el vacío).
  assert.equal(cae.status, 1, 'el cebo que cae no salió 1');
  assert.equal(pasa.status, 0, 'el cebo limpio no salió 0');
  assert.match(cae.cortada, /cebo 1345 que CAE/, 'la salida recortada del cebo no nombra el test caído');
  assert.match(pasa.cortada, /cebo 1345 limpio/, 'la salida recortada del cebo limpio no nombra su test');

  // 🔴 EL QUE DECIDE: plazo agotado CON un caído a la vista → rojo, y dice que la lista no es completa.
  const mixto = cuentasDeLaPasada({ agotado: true, status: null, salida: cae.cortada });
  assert.equal(mixto.vistos.length, 1, `🔴 debía ver 1 test caído en la salida cortada y ve ${mixto.vistos.length}: ${mixto.vistos.join(' | ')}`);
  assert.match(mixto.vistos[0], /cebo 1345 que CAE/, 'el caído que ve no es el del cebo');
  const vMixto = veredictoDe(mixto);
  assert.equal(vMixto.codigo, SALIDA_HALLAZGO,
    '🔴 un guard que encontró algo sale CIEGO porque además se agotó el plazo: el arreglo de SCRUM-1345 se ha comido un hallazgo real.');
  assert.equal(vMixto.estado, 'HALLAZGO Y CIEGO');

  // Plazo agotado y nada caído → ciego: ni verde ni rojo.
  const vCiego = veredictoDe(cuentasDeLaPasada({ agotado: true, status: null, salida: pasa.cortada }));
  assert.equal(vCiego.codigo, SALIDA_NO_SUPE_MEDIR, '🔴 un plazo agotado sin caídos debe salir ciego (2)');
  assert.equal(veredictoDe(cuentasDeLaPasada({ agotado: true, status: null, salida: '' })).codigo, SALIDA_NO_SUPE_MEDIR,
    '🔴 un runner cortado antes de decir nada debe salir ciego (2), no verde');

  // Dentro de plazo no cambia nada: el rojo es rojo y el verde es 0.
  const vRojo = veredictoDe(cuentasDeLaPasada({ agotado: false, status: cae.status, salida: cae.entera }));
  assert.equal(vRojo.codigo, SALIDA_HALLAZGO, '🔴 una pasada que terminó con un test caído debe salir 1');
  assert.equal(vRojo.hallazgos, 1, 'el rojo no cuenta los caídos que dice el resumen del runner');
  assert.equal(veredictoDe(cuentasDeLaPasada({ agotado: false, status: 7, salida: '' })).codigo, SALIDA_HALLAZGO,
    '🔴 un runner que terminó con estado distinto de 0 es rojo aunque no deje resumen');
  assert.equal(veredictoDe(cuentasDeLaPasada({ agotado: false, status: pasa.status, salida: pasa.entera })).codigo, SALIDA_VERDE,
    '🔴 una pasada limpia dentro de plazo debe seguir saliendo 0');
});

test('SCRUM-1345 ⑥ la línea de la pasada dice población, tiempo y plazo, también con cero', () => {
  assert.equal(lineaDeLaPasada({ guards: 12, ms: 50234, plazoMs: 90000 }), '12 guards · 50.2 s · plazo 90 s');
  assert.equal(lineaDeLaPasada({ guards: 0, ms: 0, plazoMs: 90000 }), '0 guards · 0.0 s · plazo 90 s');
  assert.match(lineaDeLaPasada({ guards: 12, ms: 1, plazoMs: 1 }), RE_LINEA, 'la línea y su lector se han separado');
  assert.equal(PRESUPUESTO_MS, TECHO_MS, '🔴 el presupuesto dejó de derivarse del techo: si es a propósito, que lo diga el PR.');
});
