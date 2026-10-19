// scripts/_trinquete-de-zona-hijo.mjs — SCRUM-813 · UNA pasada de la tanda, en LA ZONA QUE HEREDA.
//
//   node scripts/_trinquete-de-zona-hijo.mjs <ficheros.json> <medida.json> <raiz>
//
// Este proceso NO elige zona: la recibe en `TZ` de quien lo lanza, y la primera cosa que escribe
// es cuál ha visto de verdad (`zonaVista`). Quien lo llama compara — así una `TZ` que no llega no
// se convierte en un censo de ceros, se convierte en un CIEGO.
//
// ── POR QUÉ `run()` Y NO UN REPORTER ────────────────────────────────────────────────────────
// SCRUM-745 ya pagó esta lección en `meta-guard-mutaciones.mjs`: leer `✔`/`✖` del reporter `spec`
// deja al instrumento colgando de una constante que cualquiera puede cambiar en otro fichero.
// `run()` entrega `test:pass` / `test:fail` como DATOS, con el nombre y el fichero dentro. Sin
// reporter no hay glifo que se pueda mover.
//
// ⚠️ EL FLUJO HAY QUE CONSUMIRLO. Suscribirse y no iterarlo devuelve CERO eventos y estado 0 — un
// «no hay» indistinguible de un «no supe mirar». Por eso el bucle `for await`, y por eso quien
// llama exige que la medida traiga pruebas.
//
// ── SCRUM-1494 · UN FICHERO QUE NO ACABA NO SE COME EL TECHO DEL JOB ──────────────────────────
// El 6-oct ocho jobs de zona murieron a los 45 min sin decir qué fichero se colgaba. Medido con
// cuelgues sembrados (`docs/master/evidencias/SCRUM-1494/banco-cuelgue-sembrado.mjs`):
//   · `timeout` en `run()` es POR TEST: corta un test que no acaba, y no corta un fichero que se
//     cuelga AL CARGAR (un `await` de nivel superior, un import que no vuelve).
//   · `signal` de pared corta los dos, y el fichero sale con su nombre (`testAborted`).
// Lo cortado se apunta como `cortada`, NO como `fail`: un fichero cortado en una zona y verde en la
// otra sería un pasa↔cae, o sea una acusación de zona sin dato. El comparador lo trata como lo que
// es, «no pude comparar» (`CORTADA` en `_trinquete-de-zona.mjs`).
//
//   node scripts/_trinquete-de-zona-hijo.mjs <ficheros.json> <medida.json> <raiz> [limiteTestMs] [paredMs]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from 'node:test';

const [, , listaJson, destino, raiz, limiteArg, paredArg] = process.argv;

const ficheros = JSON.parse(fs.readFileSync(listaJson, 'utf8'));

/**
 * 🔴 LOS TOPES, Y POR QUÉ ESTOS. Medido el 15-oct-2026 en las 4 últimas corridas verdes de `main`:
 * una pasada de la tanda (1.338 ficheros) tarda 346-559 s, y el job tiene 45 min de techo.
 *
 *   · por test, 5 min — ningún test legítimo se le acerca; corta pronto al que se cuelga DENTRO.
 *   · de pared, 15 min para la tanda — 1,6 veces la pasada más lenta medida. Si el runner se
 *     vuelve más lento y una pasada normal llega a ~12 min, hay que subirlo: una pasada cortada
 *     ENTERA no acusa a nadie, pero deja a la tanda sin comparar.
 *   · y 2 min por fichero cuando son pocos: la repesca mide a SOLAS cada fichero sospechoso, y un
 *     fichero cortado en la tanda lo es. Con la pared de la tanda, un solo cuelgue costaría
 *     4 × 15 min y no cabría en el techo; así cuesta 2 × 15 + 2 × 2 min.
 * Los dos se pueden pasar por argumento para que el test 813 siembre cuelgues de segundos.
 */
const LIMITE_TEST_MS = Number(limiteArg) || 5 * 60_000;
const PARED_MS = Number(paredArg) || Math.min(15 * 60_000, 2 * 60_000 * ficheros.length);

/** No es un veredicto: el mismo literal que `CORTADA` en `_trinquete-de-zona.mjs`. */
const CORTADA = 'cortada';
/** Los `failureType` de `run()` que dicen «se cortó», no «cayó». Medidos en SCRUM-1494. */
const CORTES = new Set(['testTimeoutFailure', 'testAborted', 'cancelledByParent']);

/**
 * Peor gana: un fichero que registra dos veces el mismo nombre no puede salir mejor de lo que es.
 * Una caída de verdad pesa más que un corte: es un dato, y el corte es la falta de uno.
 */
const PESO = { fail: 4, [CORTADA]: 3, skip: 2, pass: 1 };

const veredictos = new Map();
const anotar = (fichero, nombre, v) => {
  const rel = fichero && path.isAbsolute(fichero) ? path.relative(raiz, fichero) : (fichero || '?');
  const clave = `${rel.split(path.sep).join('/')}::${nombre}`;
  const antes = veredictos.get(clave);
  if (!antes || PESO[v] > PESO[antes]) veredictos.set(clave, v);
};

/**
 * 🔴 EL PADRE DE UN CORTADO NO «CAE». Medido: un test cortado dentro de un `describe` deja al
 * `describe` con `failureType: 'subtestsFailed'`, como si un hijo hubiera caído de verdad. Sin
 * esto, el corte volvería a ser una acusación por la puerta del padre. Los hijos llegan ANTES que
 * su padre y con un nivel más (`nesting`), así que se lleva, por fichero y nivel, qué ha habido
 * debajo: si alguno cayó de verdad, el padre cae; si sólo hubo cortes, el padre está cortado.
 */
const debajo = new Map();
const resolver = (ev) => {
  const nivel = ev.data.nesting ?? 0;
  if (!debajo.has(ev.data.file)) debajo.set(ev.data.file, []);
  const pila = debajo.get(ev.data.file);
  const hijos = pila[nivel + 1];
  pila.length = nivel + 1;
  let v;
  if (ev.type === 'test:pass') v = ev.data.skip || ev.data.todo ? 'skip' : 'pass';
  else {
    const tipo = ev.data.details?.error?.failureType;
    if (CORTES.has(tipo)) v = CORTADA;
    else if (tipo === 'subtestsFailed' && hijos?.corte && !hijos.real) v = CORTADA;
    else v = 'fail';
  }
  pila[nivel] ??= { real: false, corte: false };
  if (v === 'fail') pila[nivel].real = true;
  else if (v === CORTADA) pila[nivel].corte = true;
  return v;
};

/**
 * 🔴 LA CONCURRENCIA SE ESCRIBE, NO SE HEREDA — y esto está MEDIDO, no supuesto.
 *
 * Sin esta línea, una pasada de 718 ficheros llevaba **más de 30 minutos** y `Win32_Process`
 * enseñaba **dos** procesos de test vivos, no once: `run()` NO toma por defecto la concurrencia
 * que sí toma `node --test` en la línea de órdenes. Con dos pasadas, eso convierte un instrumento
 * de PR en uno que nadie va a esperar — y un instrumento que nadie espera se apaga.
 *
 * `availableParallelism() - 1` es exactamente lo que usa `npm test`: se deja un núcleo para que la
 * máquina siga respondiendo. Y se fija a un número en vez de a `true` para que las dos pasadas
 * midan con el MISMO reparto pase lo que pase en el entorno: si una zona corriera con más
 * paralelismo que la otra, la diferencia de veredicto podría venir de ahí y no del huso.
 */
const CONCURRENCIA = Math.max(1, os.availableParallelism() - 1);

const pared = AbortSignal.timeout(PARED_MS);
const flujo = run({
  files: ficheros, cwd: raiz, forceExit: true, concurrency: CONCURRENCIA,
  timeout: LIMITE_TEST_MS, signal: pared,
});

for await (const ev of flujo) {
  // 🔴 Un fichero que MUERE AL CARGAR emite UN solo `test:fail` y su `name` es la RUTA del
  // fichero (medido en SCRUM-784). Entra como una clave más, y eso es lo correcto aquí: si un
  // fichero muere en una zona y vive en la otra, ESO es una dependencia de zona de las gordas.
  // El que se CUELGA al cargar llega igual, por la pared, pero como `cortada` (SCRUM-1494).
  if (ev.type === 'test:pass' || ev.type === 'test:fail') anotar(ev.data.file, ev.data.name, resolver(ev));
}

fs.writeFileSync(destino, JSON.stringify({
  zonaVista: Intl.DateTimeFormat().resolvedOptions().timeZone,
  tz: process.env.TZ ?? null,
  concurrencia: CONCURRENCIA,
  ficheros: ficheros.length,
  topes: { limiteTestMs: LIMITE_TEST_MS, paredMs: PARED_MS, saltoLaPared: pared.aborted },
  veredictos: [...veredictos],
}));
