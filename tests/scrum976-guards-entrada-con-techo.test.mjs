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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import os from 'node:os';

import {
  GUARDS, MINIMO, TECHO_MS, PRESUPUESTO_MS, techoEfectivo, cuentasDeLaPasada, lineaDeLaPasada,
  traeResumen, ficherosMuertos, verdesVistos,
} from '../scripts/guards-entrada.mjs';
import { veredictoDe, SALIDA_VERDE, SALIDA_HALLAZGO, SALIDA_NO_SUPE_MEDIR } from '../scripts/_hallazgos-y-ciegos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'guards-entrada.mjs');

// SCRUM-1386 · Las mutaciones van AQUÍ, en el catálogo que el meta-guard corre en CI, y no sólo en
// un banco de evidencias: una mutación que se comprobó una vez y no está declarada no la vuelve a
// correr nadie. Tres devuelven el defecto (un runner o un fichero matado vuelve a ser «hallazgo») y
// tres son el defecto CONTRARIO, que es peor: un hallazgo de verdad que pasa a ciego.
export const MUTACIONES_QUE_ME_TUMBAN = [
  // El defecto vuelve: sin resumen ya no es «no terminó», y un runner matado sale 1.
  { fichero: 'scripts/guards-entrada.mjs',
    de: 'const terminado = !agotado && traeResumen(salida);',
    a: 'const terminado = !agotado;',
    cae: 'SCRUM-1386 ⑦ un runner que acaba SIN su resumen' },
  // El defecto vuelve en el comando: la rama del «no terminó» sólo se abre con el plazo.
  { fichero: 'scripts/guards-entrada.mjs',
    de: 'if (!cuentas.terminado) {',
    a: 'if (agotado) {',
    cae: 'SCRUM-1386 ⑨ el comando de verdad' },
  // El defecto vuelve: un fichero muerto sin una letra cuenta otra vez como hallazgo.
  { fichero: 'scripts/guards-entrada.mjs',
    de: 'ficherosMuertos(salida, opciones).filter((f) => f.callado)',
    a: 'ficherosMuertos(salida, opciones).filter(() => false)',
    cae: 'SCRUM-1386 ⑧ un fichero MUERTO' },
  // 🔴 El contrario: todo fichero muerto es ciego, también el que reventó con su traza.
  { fichero: 'scripts/guards-entrada.mjs',
    de: 'ficherosMuertos(salida, opciones).filter((f) => f.callado)',
    a: 'ficherosMuertos(salida, opciones).filter(() => true)',
    cae: 'SCRUM-1386 ⑧ un fichero MUERTO' },
  // 🔴 El contrario: cualquier test caído se toma por «fichero muerto» y pasa a ciego.
  { fichero: 'scripts/guards-entrada.mjs',
    de: 'const fichero = m && rutas.get(path.resolve(raiz, m[1]));',
    a: 'const fichero = m && m[1];',
    cae: 'SCRUM-1386 ⑧ un fichero MUERTO' },
  // 🔴 El contrario: lo que ya había caído cuando cortaron al runner se pierde.
  { fichero: 'scripts/guards-entrada.mjs',
    de: 'return { hallazgos: vistos.length, ciegos: 1, vistos, terminado, callados: [] };',
    a: 'return { hallazgos: 0, ciegos: 1, vistos, terminado, callados: [] };',
    cae: 'SCRUM-1386 ⑦ un runner que acaba SIN su resumen' },
];

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
function lanzar(extraEnv = {}, { antes = [], opcionesDeNode = null } = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.NODE_TEST_CONTEXT;
  delete env.FORCE_COLOR;
  // SCRUM-1289 · `guards-entrada.mjs` lanza un `node --test`, y con `NODE_OPTIONS` heredado ese
  // hijo se llevaba los reporters del CI: TRUNCABA el `tanda.tap` del padre y escribía el suyo
  // encima. Medido el 29-sep-2026: el TAP de cada tanda, verde o roja, salía casi todo NUL.
  delete env.NODE_OPTIONS;
  const t0 = Date.now();
  // SCRUM-1386 · lo heredado se ha quitado SIEMPRE, arriba (SCRUM-1289 ancla ahí su mutación). Lo que
  // un caso pone a propósito —el `--require` del preload que mata al runner, sin ningún reporter— entra
  // aquí, en una copia, y es lo único que lleva.
  const r = spawnSync(process.execPath, [...antes, SCRIPT], {
    cwd: RAIZ, encoding: 'utf8', env: opcionesDeNode ? { ...env, NODE_OPTIONS: opcionesDeNode } : env,
  });
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
    // SCRUM-1386 · «no terminó» ya no es sólo el plazo: también un runner al que cortan desde fuera.
    const informe = `\`guards:entrada\` no terminó sobre este árbol (plazo de ${TECHO_MS / 1000} s agotado, o runner cortado desde fuera): CIEGO, no rojo.`;
    if (enCI) return { rojo: `PRESUPUESTO: ${informe} En CI esto SÍ es un rojo: o la lista ya no cabe —hay que dejar sitio o subirlo A PROPÓSITO— o al runner lo mataron; su salida dice cuál.`, aviso: null };
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
  // SCRUM-1386 · aquí se exigía que un estado ≠ 0 SIN resumen fuera rojo. Es justo lo que ese ticket
  // cambia: sin resumen el runner no terminó, y eso es un ciego (lo prueba ⑦, con salida real).
  assert.equal(veredictoDe(cuentasDeLaPasada({ agotado: false, status: pasa.status, salida: pasa.entera })).codigo, SALIDA_VERDE,
    '🔴 una pasada limpia dentro de plazo debe seguir saliendo 0');
});

test('SCRUM-1345 ⑥ la línea de la pasada dice población, tiempo y plazo, también con cero', () => {
  assert.equal(lineaDeLaPasada({ guards: 12, ms: 50234, plazoMs: 90000 }), '12 guards · 50.2 s · plazo 90 s');
  assert.equal(lineaDeLaPasada({ guards: 0, ms: 0, plazoMs: 90000 }), '0 guards · 0.0 s · plazo 90 s');
  assert.match(lineaDeLaPasada({ guards: 12, ms: 1, plazoMs: 1 }), RE_LINEA, 'la línea y su lector se han separado');
  assert.equal(PRESUPUESTO_MS, TECHO_MS, '🔴 el presupuesto dejó de derivarse del techo: si es a propósito, que lo diga el PR.');
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-1386 (1-oct-2026) · UN RUNNER AL QUE MATAN NO HA ENCONTRADO NADA
//
// Medido matando al runner de verdad (`docs/master/SCRUM-1386.md`): salía 1 con «solo se ejecutaron
// 0 tests», también con 97 tests en ✔ en su propio stdout. Y con UN proceso por fichero matado,
// «1 hallazgo». El código de salida no lo distingue; el RESUMEN sí: un `node --test` que termina lo
// escribe siempre, y uno al que cortan, nunca.
//   ⑦ runner sin resumen → ciego (2); con un caído ya escrito → rojo (1), nombrado. Salida REAL.
//   ⑧ fichero muerto: callado → ciego; con traza → hallazgo; y un caído de verdad manda. Salida REAL.
//   ⑨ el comando de verdad: su runner no arranca (ENOENT) y su runner se mata a mitad → 2 las dos veces.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Varios cebos fuera del árbol, corridos de verdad por `node --test`. Le pasa a `usar` la salida y dónde corrió. */
function runnerRealSobre(cebos, usar) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1386-'));
  try {
    for (const [nombre, cuerpo] of Object.entries(cebos)) fs.writeFileSync(path.join(dir, nombre), cuerpo);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    delete env.NODE_OPTIONS;
    delete env.FORCE_COLOR;
    const ficheros = Object.keys(cebos);
    const r = spawnSync(process.execPath, ['--test', ...ficheros], { cwd: dir, encoding: 'utf8', env });
    return usar({ status: r.status, salida: r.stdout || '', opciones: { raiz: dir, ficheros } });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const CEBO_LIMPIO = "import test from 'node:test';\ntest('cebo 1386 limpio', () => {});\n";
const CEBO_CAE = "import test from 'node:test';\ntest('cebo 1386 que CAE', () => { throw new Error('caída de cebo'); });\n";
// Sale con 1 sin escribir una letra: lo mismo que deja, visto desde el runner, un proceso matado.
const CEBO_CALLADO = 'process.exit(1);\n';
// Arranca y revienta en su primera línea: node deja la traza.
const CEBO_REVIENTA = "import test from 'node:test';\nthrow new Error('reviento de cebo al cargar');\n";

test('SCRUM-1386 ⑦ un runner que acaba SIN su resumen no terminó: ciego (2); y lo que ya había caído sigue siendo rojo', () => {
  const cae = salidaRealDelRunner('cae.test.mjs', CEBO_LIMPIO + "test('cebo 1386 que CAE', () => { throw new Error('caída de cebo'); });\n");
  const pasa = salidaRealDelRunner('pasa.test.mjs', CEBO_LIMPIO);

  // El lector del resumen distingue las tres cosas (si no, todo lo de abajo se cumpliría por otra causa).
  assert.equal(traeResumen(pasa.entera), true, 'una salida entera del runner trae su resumen');
  assert.equal(traeResumen(pasa.cortada), false, '🔴 una salida cortada antes del resumen «trae resumen»');
  assert.equal(traeResumen(''), false, '🔴 una salida vacía «trae resumen»');
  assert.equal(verdesVistos(pasa.cortada), 1, 'no cuenta el resultado en verde que el runner llegó a escribir');

  // 🔴 EL QUE DECIDE: nadie agotó el plazo, el runner acabó y no dejó resumen → CIEGO, no rojo.
  // El estado da igual, que es lo medido: 1 (taskkill, el kill de node), 4294967295 (Stop-Process),
  // null (una señal en Linux, o un `spawn` que ni arrancó).
  for (const status of [1, 4294967295, null, 0]) {
    for (const salida of ['', pasa.cortada]) {
      const c = cuentasDeLaPasada({ agotado: false, status, salida });
      assert.equal(c.terminado, false, `estado ${status}: sin resumen se dio por terminado`);
      assert.equal(veredictoDe(c).codigo, SALIDA_NO_SUPE_MEDIR,
        `🔴 un runner que acabó con estado ${status} SIN resumen debe salir ciego (2): no terminó, y nadie encontró nada (SCRUM-1386).`);
    }
  }

  // 🔴 LO QUE PROTEGE LO GANADO: si antes de que lo cortaran ya había escrito un caído, es ROJO y lo nombra.
  const mixto = cuentasDeLaPasada({ agotado: false, status: 1, salida: cae.cortada });
  assert.equal(mixto.vistos.length, 1, `debía ver 1 caído en la salida cortada y ve ${mixto.vistos.length}`);
  assert.match(mixto.vistos[0], /cebo 1386 que CAE/, 'el caído que ve no es el del cebo');
  assert.equal(veredictoDe(mixto).codigo, SALIDA_HALLAZGO,
    '🔴 un guard que encontró algo sale CIEGO porque después mataron al runner: el arreglo se ha comido un hallazgo real.');
  assert.equal(veredictoDe(mixto).estado, 'HALLAZGO Y CIEGO');

  // Y el runner que TERMINA con un caído escribe su resumen y sigue saliendo 1, sin ciegos.
  const rojo = cuentasDeLaPasada({ agotado: false, status: cae.status, salida: cae.entera });
  assert.equal(rojo.terminado, true, 'una pasada con resumen no se dio por terminada');
  assert.deepEqual([veredictoDe(rojo).codigo, rojo.hallazgos, rojo.ciegos], [SALIDA_HALLAZGO, 1, 0],
    '🔴 un rojo de verdad, con el runner terminado, ya no es «1 hallazgo · 0 ciegos»');
});

test('SCRUM-1386 ⑧ un fichero MUERTO sin una letra es un ciego; con su traza, un hallazgo; y un test caído manda', () => {
  // Callado: el caído es la RUTA del fichero y no dejó nada escrito → ciego.
  runnerRealSobre({ 'a-limpio.test.mjs': CEBO_LIMPIO, 'b-callado.test.mjs': CEBO_CALLADO }, ({ status, salida, opciones }) => {
    assert.equal(status, 1, 'el cebo callado no hizo salir al runner con 1');
    assert.equal(traeResumen(salida), true, 'CIEGO: el runner no dejó resumen sobre los cebos\n' + salida);
    assert.deepEqual(ficherosMuertos(salida, opciones), [{ fichero: 'b-callado.test.mjs', callado: true }],
      '🔴 no reconoce al fichero que murió sin decir nada\n' + salida);
    const c = cuentasDeLaPasada({ agotado: false, status, salida }, opciones);
    assert.deepEqual([c.hallazgos, c.ciegos, c.callados], [0, 1, ['b-callado.test.mjs']]);
    assert.equal(veredictoDe(c).codigo, SALIDA_NO_SUPE_MEDIR,
      '🔴 un fichero cuyo proceso murió callado cuenta como «1 hallazgo»: nadie ha encontrado nada (SCRUM-1386).');
    // El mismo texto contra una lista que NO lo lleva: un caído que no es un fichero de la lista es un hallazgo.
    const sinEl = { raiz: opciones.raiz, ficheros: ['a-limpio.test.mjs'] };
    assert.deepEqual(ficherosMuertos(salida, sinEl), [], '🔴 da por «fichero muerto» un caído cuya ruta no está en la lista');
    assert.equal(veredictoDe(cuentasDeLaPasada({ agotado: false, status, salida }, sinEl)).codigo, SALIDA_HALLAZGO);
  });

  // 🔴 EL POSITIVO: arrancó y reventó al cargar → deja su traza → es SUYO: hallazgo, no ciego.
  runnerRealSobre({ 'a-limpio.test.mjs': CEBO_LIMPIO, 'b-revienta.test.mjs': CEBO_REVIENTA }, ({ status, salida, opciones }) => {
    assert.match(salida, /reviento de cebo al cargar/, 'CIEGO: la traza del cebo no llegó a la salida del runner\n' + salida);
    assert.deepEqual(ficherosMuertos(salida, opciones), [{ fichero: 'b-revienta.test.mjs', callado: false }],
      '🔴 un fichero que revienta con su traza se lee como «callado»\n' + salida);
    const c = cuentasDeLaPasada({ agotado: false, status, salida }, opciones);
    assert.deepEqual([veredictoDe(c).codigo, c.hallazgos, c.ciegos], [SALIDA_HALLAZGO, 1, 0],
      '🔴 un guard que REVIENTA al cargar sale ciego: quien rompa lo que el guard importa leería «relánzalo».');
  });

  // Un muerto callado JUNTO a un test que cae de verdad: manda el hallazgo, y se dice que falta uno.
  runnerRealSobre({ 'a-limpio.test.mjs': CEBO_LIMPIO, 'b-callado.test.mjs': CEBO_CALLADO, 'c-cae.test.mjs': CEBO_CAE }, ({ status, salida, opciones }) => {
    const c = cuentasDeLaPasada({ agotado: false, status, salida }, opciones);
    assert.deepEqual([c.hallazgos, c.ciegos], [1, 1], 'no separa el test caído del fichero muerto\n' + salida);
    assert.equal(veredictoDe(c).codigo, SALIDA_HALLAZGO, '🔴 un test caído de verdad sale ciego porque además murió otro fichero');
    assert.equal(veredictoDe(c).estado, 'HALLAZGO Y CIEGO');
  });

  // Y sin muertos no cambia nada: un test que cae es 1 hallazgo, 0 ciegos.
  runnerRealSobre({ 'a-limpio.test.mjs': CEBO_LIMPIO, 'c-cae.test.mjs': CEBO_CAE }, ({ status, salida, opciones }) => {
    assert.deepEqual(ficherosMuertos(salida, opciones), [], 'da por muerto un fichero cuyo test cayó');
    const c = cuentasDeLaPasada({ agotado: false, status, salida }, opciones);
    assert.deepEqual([veredictoDe(c).codigo, c.hallazgos, c.ciegos], [SALIDA_HALLAZGO, 1, 0]);
  });
});

// Sin `{ timeout }` propio, a propósito: un plazo de `node:test` que vence sale ROJO, que es la forma
// que este ticket viene a quitar. El comando ya se corta solo a los 90 s, y entonces sale ciego.
test('SCRUM-1386 ⑨ el comando de verdad: si su runner no arranca, o se muere a mitad, sale CIEGO (2) y lo dice',
  () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1386-'));
    try {
      // (a) El runner NO ARRANCA: la puerta lanza un binario que no existe (`spawn` ENOENT).
      const sinBinario = path.join(dir, 'sin-binario.mjs');
      fs.writeFileSync(sinBinario, `process.execPath = ${JSON.stringify(path.join(dir, 'este-node-no-existe'))};\n`);
      const a = lanzar({}, { antes: ['--import', pathToFileURL(sinBinario).href] }).r;
      assert.equal(a.status, SALIDA_NO_SUPE_MEDIR,
        `🔴 con un runner que no arranca el comando debe salir ${SALIDA_NO_SUPE_MEDIR} (salió ${a.status}): no se ha medido nada.\n${a.stderr}`);
      assert.match(a.stderr || '', /no llegó a arrancar \(ENOENT\)/, '🔴 salió 2 y no dice que el runner no arrancó');
      assert.match(a.stderr || '', /0 hallazgos · 1 ciego/, '🔴 el veredicto no dice sus dos cuentas');
      assert.match(a.stdout || '', RE_LINEA, '🔴 sin runner no sale la línea «N guards · T s · plazo P s»');

      // (b) El runner SE MUERE A MITAD. Un preload que sólo actúa en el proceso que reparte (`--test`
      // y no un proceso por fichero): deja su testigo y se mata a los 1,5 s, con los guards corriendo.
      const testigo = path.join(dir, 'testigo.txt');
      const mata = path.join(dir, 'mata-al-runner.cjs');
      fs.writeFileSync(mata, [
        "const esElRunner = process.execArgv.includes('--test') && !process.execArgv.some((a) => a.startsWith('--test-isolation'));",
        'if (esElRunner) {',
        "  setTimeout(() => { require('node:fs').writeFileSync(process.env.SCRUM1386_TESTIGO, 'me mato'); process.kill(process.pid, 'SIGKILL'); }, 1500);",
        '}',
        '',
      ].join('\n'));
      const b = lanzar({ SCRUM1386_TESTIGO: testigo }, { opcionesDeNode: '--require ' + JSON.stringify(mata.split(path.sep).join('/')) }).r;
      assert.ok(fs.existsSync(testigo),
        `🔴 CIEGO: el runner no llegó a matarse (sin testigo): este caso no ha probado nada. Salida ${b.status}.\n${(b.stdout || '').slice(-600)}\n${b.stderr}`);
      assert.equal(b.status, SALIDA_NO_SUPE_MEDIR,
        `🔴 con el runner matado a mitad el comando debe salir ${SALIDA_NO_SUPE_MEDIR} (salió ${b.status}): un 1 es lo que dice un guard que encontró algo.\n${b.stderr}`);
      assert.match(b.stderr || '', /acabó sin escribir su resumen/, '🔴 salió 2 y no dice que el runner no dejó resumen');
      assert.match(b.stderr || '', /0 hallazgos · 1 ciego/, '🔴 el veredicto no dice sus dos cuentas');
      assert.match(b.stdout || '', RE_LINEA, '🔴 con el runner muerto no sale la línea «N guards · T s · plazo P s»');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
