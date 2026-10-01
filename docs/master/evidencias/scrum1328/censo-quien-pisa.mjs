// censo-quien-pisa.mjs — SCRUM-1328 · QUIEN PISA EL TAP, POR EJECUCION, fichero a fichero.
//
// Uso (desde la raiz del repo):
//     node <ruta>/censo-quien-pisa.mjs <lista.txt> <salida.jsonl>
//
// Por cada fichero de test de la lista lanza, DE UNO EN UNO (nunca dos a la vez):
//     node --test --test-force-exit <fichero>
// con los reporters puestos donde los pone `ci.yml` en main: en NODE_OPTIONS, `spec` a stdout y `tap`
// a un fichero CANARIO fuera del arbol. Y lo mira con DOS sondas independientes:
//
//   SONDA DE PROCESOS (la que decide) — `sonda-proceso.mjs`, cargada con `--import` en todo node que
//   herede el entorno. Un proceso que NO es la raiz, sin NODE_TEST_CONTEXT, con el destino heredado
//   y que usa node:test (`--test` o el arnes cargado) es un INTRUSO: abre el destino truncandolo.
//       PISA    : hay al menos un intruso (se nombra)
//       limpio  : la raiz se vio y no hay intrusos
//       CIEGA   : la sonda no vio ni a la raiz -> no se sabe
//
//   SONDA DE BYTES (la segunda opinion) — el canario, byte a byte.
//       ENTERO  : una cabecera TAP en el byte 0, cero NUL, un solo recuento, casos 1..N seguidos y el
//                 mismo N que la consola del padre.
//       PISADO  : algo de eso falla.
//   🔴 LIMITE MEDIDO de la sonda de bytes: con UN solo fichero el padre lleva escritos 15 bytes cuando
//   el hijo trunca; si lo que el padre escribe despues es mas largo que lo del hijo, lo tapa entero y
//   el canario queda ENTERO habiendo sido pisado. Por eso no decide. (En la tanda de verdad el padre
//   lleva megas escritos y el hueco queda en NUL.)
//
// Solo LEE el arbol. El entorno del sujeto se construye a mano (A21).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CSI = /\x1B\[[0-9;?]*[ -\/]*[@-~]/g;

export function veredictoDelTap(b, testsDeConsola) {
  if (!b) return { veredicto: 'SIN_TAP', motivos: ['no hay fichero'] };
  const motivos = [];
  let nul = 0;
  for (let i = 0; i < b.length; i++) if (b[i] === 0) nul++;
  if (nul) motivos.push(`${nul} bytes NUL de ${b.length}`);
  const s = b.toString('utf8');
  const cab = [...s.matchAll(/^TAP version \d+/gm)].map((m) => m.index);
  if (cab.length !== 1 || cab[0] !== 0) motivos.push(`cabeceras TAP en [${cab.join(',')}] (se espera una, en 0)`);
  const rec = [...s.matchAll(/^# tests (\d+)/gm)].map((m) => Number(m[1]));
  if (rec.length !== 1) motivos.push(`${rec.length} recuentos «# tests» [${rec.join(',')}] (se espera uno)`);
  const casos = [...s.matchAll(/^(?:not ok|ok) (\d+)/gm)].map((m) => Number(m[1]));
  const seguidos = casos.every((n, i) => n === i + 1);
  if (!seguidos) motivos.push(`los casos de nivel superior no van 1..N seguidos (primero ${casos[0]}, ultimo ${casos.at(-1)}, hay ${casos.length})`);
  if (testsDeConsola !== null && rec.length === 1 && seguidos && rec[0] !== testsDeConsola) {
    motivos.push(`el TAP dice tests ${rec[0]} y la consola del padre dijo ${testsDeConsola}`);
  }
  const primerCaso = (s.match(/^(?:not ok|ok) 1 - (.*)$/m) || [null, null])[1];
  return {
    veredicto: motivos.length ? 'PISADO' : 'ENTERO', motivos, bytes: b.length, nul,
    recuentos: rec, casos: casos.length, primerCaso: primerCaso ? primerCaso.slice(0, 120) : null,
  };
}

/** De las lineas de la sonda: la raiz y los intrusos. `fichero` es el que se le paso a `node --test`. */
export function leerSonda(lineas, pidRaiz) {
  const porPid = new Map();
  for (const l of lineas) {
    const p = porPid.get(l.pid) || { usaTest: false };
    porPid.set(l.pid, { ...p, ...l, usaTest: p.usaTest || l.arnes === true || (l.execArgv || []).includes('--test') });
  }
  // 🔴 MEDIDO: el corredor `node --test` NO carga el `--import` (solo sus hijos). La raiz no se ve
  // nunca; se la reconoce por sus hijos: un proceso con marca de hijo cuyo padre es `pidRaiz`.
  const todos = [...porPid.values()];
  const raizVista = todos.some((p) => p.ppid === pidRaiz && p.ctx !== null);
  // (A) un script que usa node:test sin `--test`, sin marca y con el destino heredado.
  const sueltos = todos
    .filter((p) => p.pid !== pidRaiz && p.ctx === null && p.destinoHeredado && p.usaTest)
    .map((p) => `[script con node:test] ${[...p.execArgv, ...p.argv].join(' ')}`);
  // (B) OTRO corredor `node --test`: tampoco carga la sonda, se le ve por sus hijos — procesos con
  //     marca de hijo cuyo padre NO es la raiz. Si tiene hijos es que corrio sin marca (con ella se
  //     niega: «run() is being called recursively»), y el destino lo heredan de el.
  const anidados = new Map();
  for (const p of todos) {
    // `!porPid.has(p.ppid)`: si el padre SI apunto en la sonda, no es un corredor (el corredor no la
    // carga): es un script que lanzo a otro dejandole la marca, y ese no abre el destino (control
    // «contexto» del laboratorio). ⚠️ Queda un falso positivo posible, declarado: un script con marca
    // lanzado a traves de una shell (el padre es la shell, que tampoco apunta). Por eso cada (B) se
    // confirma leyendo el fichero.
    // `p.usaTest`: MEDIDO en la pasada de 76 — seis ficheros salieron PISA por scripts corrientes
    // (un `gh` de mentira, una puerta) lanzados por `bash` con la marca heredada: no cargan node:test
    // y no abren nada. Un hijo de verdad de un corredor carga el arnes. Lo que se pierde, declarado:
    // un hijo al que matan antes de salir no deja linea de salida y no cuenta.
    if (p.ctx !== null && p.ppid !== pidRaiz && !porPid.has(p.ppid) && p.destinoHeredado && p.usaTest) {
      if (!anidados.has(p.ppid)) anidados.set(p.ppid, `[otro node --test] hijo: ${p.argv.join(' ')}`);
    }
  }
  const intrusos = [...sueltos, ...anidados.values()];
  return { procesos: porPid.size, raizVista, intrusos: [...new Set(intrusos)], nIntrusos: intrusos.length };
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const [lista, salida] = process.argv.slice(2);
  if (!lista || !salida) { console.error('uso: censo-quien-pisa.mjs <lista.txt> <salida.jsonl>'); process.exit(2); }
  const tmp = os.tmpdir();
  const canario = path.join(tmp, `yaqu-1328-canario-${process.pid}.tap`);
  const sonda = path.join(tmp, 'yaqu-1328-sonda-proceso.mjs');
  const logSonda = path.join(tmp, `yaqu-1328-sonda-${process.pid}.jsonl`);
  fs.copyFileSync(new URL('./sonda-proceso.mjs', import.meta.url), sonda);
  const barras = (p) => p.split(path.sep).join('/');
  if (/\s/.test(sonda) || /\s/.test(canario)) { console.error(`CIEGO: la ruta temporal lleva espacios y NODE_OPTIONS la partiria: ${tmp}`); process.exit(3); }
  const ficheros = fs.readFileSync(lista, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const PLAZO_MS = Number(process.env.PLAZO_MS) || 240_000;

  const base = { ...process.env };
  delete base.FORCE_COLOR;
  delete base.NODE_TEST_CONTEXT;
  base.SONDA_1328_LOG = logSonda;
  base.NODE_OPTIONS = `--import=file:///${barras(sonda)} --test-reporter=spec --test-reporter-destination=stdout --test-reporter=tap --test-reporter-destination=${barras(canario)}`;

  fs.writeFileSync(salida, '');
  console.log(`POBLACION ficheros=${ficheros.length} node=${process.version} canario=${canario}`);
  const cuenta = {};
  for (const f of ficheros) {
    fs.rmSync(canario, { force: true });
    fs.rmSync(logSonda, { force: true });
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ['--test', '--test-force-exit', f], { encoding: 'utf8', env: base, timeout: PLAZO_MS, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    const ms = Date.now() - t0;
    const consola = (r.stdout || '').replace(CSI, '');
    const num = (k) => { const m = consola.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm')); return m ? Number(m[1]) : null; };
    const v = veredictoDelTap(fs.existsSync(canario) ? fs.readFileSync(canario) : null, num('tests'));
    const lineas = fs.existsSync(logSonda) ? fs.readFileSync(logSonda, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    const s = leerSonda(lineas, r.pid);
    const sondaDice = !s.raizVista ? 'CIEGA' : (s.nIntrusos ? 'PISA' : 'limpio');
    const fila = { fichero: f, sonda: sondaDice, ...s, bytes_: v, ms, salida: r.status, senal: r.signal, plazo: r.error?.code === 'ETIMEDOUT', consola: { tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped') } };
    fs.appendFileSync(salida, JSON.stringify(fila) + '\n');
    const clave = `${sondaDice}/${v.veredicto}`;
    cuenta[clave] = (cuenta[clave] || 0) + 1;
    let linea = `${sondaDice.padEnd(7)} x${String(s.nIntrusos).padEnd(2)} proc=${String(s.procesos).padStart(3)} bytes=${v.veredicto.padEnd(7)} ${String(ms).padStart(6)} ms salida=${r.status} tests=${fila.consola.tests} fail=${fila.consola.fail}  ${f}`;
    for (const i of s.intrusos.slice(0, 4)) linea += `\n            intruso: ${i}`;
    if (v.veredicto !== 'ENTERO') linea += `\n            bytes: quedo «${v.primerCaso}» · ${v.motivos.join(' · ')}`;
    console.log(linea);
  }
  fs.rmSync(canario, { force: true });
  fs.rmSync(logSonda, { force: true });
  console.log(`RESUMEN (sonda/bytes) ${JSON.stringify(cuenta)} sobre ${ficheros.length}`);
  console.log('EXIT=0');
}
