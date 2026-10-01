// scripts/vigia-silencio-de-main.mjs — SCRUM-1324 · NADIE VIGILA EL SILENCIO, SÓLO EL ROJO.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// QUÉ HACE: lee los runs de `main` y dice, job por job, si alguno lleva demasiado tiempo en ROJO
// o demasiado tiempo SIN EJECUTARSE. Sólo LEE. No hace obligatorio ningún check, no toca ningún
// workflow, no comenta, no reintenta y no arregla.
//
// POR QUÉ EXISTE, medido el 1-oct-2026 sobre 1.084 runs de `main` (20-sep → 1-oct):
//
//   · «meta-guard» llevaba 31 runs seguidos en rojo en `main` (37,8 h) y «guards de navegador» 35
//     (47,5 h). Ninguno bloquea: el único check obligatorio es «build + tests». Un rojo que no
//     bloquea no lo encuentra nadie, porque hay que ir a buscarlo. En 11 días hubo 7 rachas de 9
//     runs o más en jobs no obligatorios, y ninguna avisó.
//   · Y EL SILENCIO ES LO NORMAL: de 488 runs de CI en `main`, 232 no ejecutaron ningún job
//     (GitHub sustituye el run que espera; SCRUM-935b). Cada job corre en el 33-52 % de los
//     commits. Por eso «no hay rojo» no se puede leer como «está verde»: hay que contar también
//     lo que no llegó a correr.
//
// ── LAS DOS UNIDADES, Y POR QUÉ SON DOS ────────────────────────────────────────────────────
// Un job que corre en cada `push` a `main` se mide en RUNS. Uno que corre por `schedule` se mide
// en HORAS: un cron da 4-5 runs al día, y «5 seguidos» ahí es un día entero. Un instrumento con
// dos unidades porque mide dos cosas es correcto; uno con una unidad forzada es el que miente.
//
//   job de PUSH   ROJO-SOSTENIDO  ≥ UMBRAL_ROJOS_SEGUIDOS ejecuciones seguidas en failure
//                 SILENCIO        ≥ UMBRAL_RUNS_SIN_EJECUTAR runs seguidos sin ejecutarse
//                                 (cancelado, saltado, ausente del run, o `main` avanzando sin run)
//   job de CRON   SILENCIO        > UMBRAL_HORAS_DE_CRON desde su último run (el cron no llega)
//                 ROJO-SOSTENIDO  > UMBRAL_HORAS_DE_CRON desde su último verde, con 2 rojos o más
//                                 (uno solo no: un cron que falla una vez y se recupera pasa 10 h
//                                 sin verde sólo por lo lento que es — medido el 30-sep)
//
// ── LOS TRES UMBRALES NO ESTÁN ELEGIDOS: SALEN DEL CENSO ───────────────────────────────────
// `tests/scrum1324-nadie-vigila-el-silencio.test.mjs` los RECALCULA del historial real
// (`tests/fixtures/scrum1324-historial-main.jsonl`) con las funciones `umbral…` de aquí abajo, y
// cae si la constante y el dato dejan de coincidir. Cambiar un umbral es cambiar el censo.
//
// ── LO QUE NO VE, DECLARADO ────────────────────────────────────────────────────────────────
//   · Los runs de los PR. Mide `main`. El PR que rompió el meta-guard (#1951) ya lo decía en su
//     propio check, 2 de 2: eso es otro defecto (un aviso que no obliga) y no lo cubre esto.
//   · Los workflows REACTIVOS (`workflow_run`, `issue_comment`): «Avisador de PR en rojo» y
//     «Claude Code». Saltarse es su estado normal (el avisador se salta con cada CI verde), así
//     que contar sus runs sin ejecutar sería ruido. Quedan fuera, a propósito.
//   · Un job NUEVO que no esté en `JOBS_DE_MAIN` no se vigila: sale como SIN-DECLARAR, que avisa
//     de que la lista se quedó corta. La lista es declarada a propósito: derivada de los runs
//     recientes, un job desaparecido dejaría de echarse de menos al salir de la ventana.
//   · MUDO por dentro: un job que termina en success sin haber comprobado nada. Aquí sólo se lee
//     la conclusión del job.
//
// ⛔ HACE RED (`gh api`), así que NO vive en `npm test`: la tanda no puede depender de que GitHub
// conteste. La red que sí corre siempre es su test, que ejercita `veredicto` contra el historial
// real sin tocar la red.
//
// USO
//   node scripts/vigia-silencio-de-main.mjs                      lee GitHub (≈ 270 peticiones)
//   node scripts/vigia-silencio-de-main.mjs --historial <jsonl> --ahora <ISO>
//                                                                reproduce sobre un historial guardado
// SALIDAS: 0 = leído, nada que avisar · 1 = leído, HAY aviso · 2 = no supe medir (CIEGO).
// ═══════════════════════════════════════════════════════════════════════════════════════════
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SALIDA_OK = 0;
export const SALIDA_AVISO = 1;
export const SALIDA_CIEGO = 2;

const REPO = 'lwislg99/cobroflash-backend';

/** Ejecuciones seguidas en failure, en un job de push, a partir de las cuales se avisa. */
export const UMBRAL_ROJOS_SEGUIDOS = 5;
/** Runs seguidos sin ejecutarse, en un job de push, a partir de los cuales se avisa. */
export const UMBRAL_RUNS_SIN_EJECUTAR = 22;
/** Horas que un job de cron puede pasar sin run (silencio) o sin verde (rojo) antes de avisar. */
export const UMBRAL_HORAS_DE_CRON = 10;
/**
 * Rojos seguidos que necesita un cron para avisar por ROJO. No es un umbral afinado: es el control
 * positivo del ticket («uno que falla una vez y se recupera no avisa») aplicado a un job lento.
 */
export const MINIMO_ROJOS_DE_CRON = 2;
/** Tolerancia con la que se deriva `UMBRAL_ROJOS_SEGUIDOS`: avisos por puro azar al mes, por job. */
export const AVISOS_FALSOS_AL_MES = 1;

/**
 * Los jobs que hablan del estado de `main`, por IDENTIDAD (workflow + nombre del job), con su
 * unidad. Es el censo del 1-oct-2026: 9 jobs en 4 workflows. El test comprueba que este conjunto
 * es EXACTAMENTE el que aparece en el historial real — ni uno de más ni uno de menos.
 */
export const JOBS_DE_MAIN = [
  { workflow: 'CI', job: 'build + tests (con banco desechable)', unidad: 'runs' },
  { workflow: 'CI', job: 'guards de navegador (fuera de la tanda)', unidad: 'runs' },
  { workflow: 'CI', job: 'meta-guard · los guards caen cuando deben', unidad: 'runs' },
  { workflow: 'CI', job: 'trinquete · ningún test nuevo mide la zona de la máquina', unidad: 'runs' },
  { workflow: 'CI', job: 'vigía del despliegue (informativo)', unidad: 'runs' },
  { workflow: 'CI', job: 'constancia del ALTER (informativo)', unidad: 'runs' },
  { workflow: 'Conflicto de registro', job: 'resolver', unidad: 'runs' },
  { workflow: 'Vigía de PR atascados', job: 'vigilar', unidad: 'horas' },
  { workflow: 'Vigía del despliegue', job: 'vigia', unidad: 'horas' },
];

const EJECUTO = new Set(['success', 'failure']);
const PENDIENTE = new Set(['pendiente', 'sin-leer']);
const horasEntre = (a, b) => (Date.parse(b) - Date.parse(a)) / 3600000;
const clave = (workflow, job) => `${workflow} / ${job}`;

/**
 * Lee el historial reducido (el formato de `docs/master/evidencias/SCRUM-1324/reducir.mjs`) y lo
 * devuelve como lista de runs `{ workflow, evento, creado, sha, jobs: { nombre: estado } }`, del
 * más viejo al más nuevo. Un job AUSENTE del run no aparece en `jobs`.
 */
export function leerHistorial(texto) {
  const lineas = String(texto).split(/\r?\n/).filter(Boolean);
  const cabecera = JSON.parse(lineas[0]);
  const runs = lineas.slice(1).map((l) => {
    const [w, evento, creado, sha, letras] = JSON.parse(l);
    const wf = cabecera.workflows[w];
    const jobs = {};
    wf.jobs.forEach((nombre, i) => {
      const estado = cabecera.codigos[letras[i]];
      if (!estado) throw new Error(`letra que no conozco en el historial: «${letras[i]}»`);
      if (estado !== 'ausente') jobs[nombre] = estado;
    });
    return { workflow: wf.nombre, evento, creado, sha, jobs };
  });
  runs.sort((a, b) => a.creado.localeCompare(b.creado));
  return { tomada: cabecera.tomada, desde: cabecera.desde, runs };
}

/** La serie de un job: por cada run de su workflow, del más viejo al más nuevo, qué le pasó. */
export function serieDe(runs, workflow, job) {
  return runs
    .filter((r) => r.workflow === workflow)
    .map((r) => ({ creado: r.creado, sha: r.sha, estado: r.jobs[job] ?? 'ausente' }));
}

/**
 * Las rachas de failure de una serie, contando sólo las EJECUCIONES (un run en que el job no
 * corrió ni rompe la racha ni la alarga). `viva` = la racha llega hasta la última ejecución.
 */
export function rachasRojas(serie) {
  const rachas = [];
  let actual = null;
  for (const s of serie) {
    if (!EJECUTO.has(s.estado)) continue;
    if (s.estado === 'failure') {
      if (!actual) actual = { tamano: 0, desde: s.creado, hasta: s.creado, hitos: [] };
      actual.tamano++;
      actual.hasta = s.creado;
      actual.hitos.push(s.creado);
    } else if (actual) { rachas.push({ ...actual, viva: false }); actual = null; }
  }
  if (actual) rachas.push({ ...actual, viva: true });
  return rachas;
}

/** Los huecos de una serie: cuántos runs seguidos pasó el job sin ejecutarse, cada vez. */
export function huecosSinEjecutar(serie) {
  const huecos = [];
  let n = 0;
  for (const s of serie) {
    if (PENDIENTE.has(s.estado)) continue;
    if (EJECUTO.has(s.estado)) { if (n) huecos.push(n); n = 0; } else n++;
  }
  return { cerrados: huecos, vivo: n };
}

/**
 * EL UMBRAL DE ROJOS, DERIVADO. Para cada job de push: su tasa de fallo `p` FUERA de las rachas de
 * N o más (lo que falla «porque sí»), y cuántas rachas de N saldrían por puro azar en 30 días a su
 * ritmo de ejecuciones: `ejecuciones30d · (1 − p) · p^N`. El umbral es el menor N con el que el
 * PEOR job queda por debajo de `AVISOS_FALSOS_AL_MES`.
 *
 * Con el historial del 1-oct-2026 el peor es el meta-guard: 41 rojos de 159 fuera de su racha
 * larga (25,8 %, la pérdida de eventos de SCRUM-908) → N=4 daría 1,8 avisos falsos al mes y N=5,
 * 0,46. Sale 5. El día que SCRUM-908 se arregle, este número BAJA solo al regenerar el historial.
 */
export function umbralDeRojos(runs, jobs = JOBS_DE_MAIN, tolerancia = AVISOS_FALSOS_AL_MES) {
  const deRuns = jobs.filter((j) => j.unidad === 'runs');
  const dias = runs.length ? horasEntre(runs[0].creado, runs.at(-1).creado) / 24 : 0;
  const detalle = [];
  // Desde 2: con N=1 se avisaría de cada rojo, y un job que falla una vez y se recupera NO avisa.
  for (let N = 2; N <= 50; N++) {
    let peor = { esperadas: 0 };
    for (const j of deRuns) {
      const serie = serieDe(runs, j.workflow, j.job).filter((s) => EJECUTO.has(s.estado));
      const enLargas = rachasRojas(serie).filter((r) => r.tamano >= N).reduce((a, r) => a + r.tamano, 0);
      const fuera = serie.length - enLargas;
      const rojos = serie.filter((s) => s.estado === 'failure').length - enLargas;
      const p = fuera > 0 ? rojos / fuera : 0;
      const esperadas = dias > 0 ? (serie.length / dias) * 30 * (1 - p) * p ** N : 0;
      if (esperadas >= peor.esperadas) peor = { job: clave(j.workflow, j.job), p, rojos, fuera, esperadas };
    }
    detalle.push({ N, ...peor });
    if (peor.esperadas < tolerancia) return { umbral: N, detalle };
  }
  return { umbral: null, detalle };
}

/** EL UMBRAL DEL SILENCIO EN RUNS, DERIVADO: el hueco más largo visto en operación normal, más uno. */
export function umbralDeRunsSinEjecutar(runs, jobs = JOBS_DE_MAIN) {
  let maximo = { hueco: 0 };
  for (const j of jobs.filter((x) => x.unidad === 'runs')) {
    const { cerrados, vivo } = huecosSinEjecutar(serieDe(runs, j.workflow, j.job));
    const hueco = Math.max(0, vivo, ...cerrados);
    if (hueco > maximo.hueco) maximo = { hueco, job: clave(j.workflow, j.job) };
  }
  return { umbral: maximo.hueco + 1, ...maximo };
}

/**
 * EL UMBRAL DE HORAS, DERIVADO: el mayor hueco entre dos runs seguidos de un cron, redondeado
 * hacia arriba. GitHub no garantiza la puntualidad de `schedule` y aquí se mide cuánto: los dos
 * cron (cada 3 h y cada 2 h) dieron 51 runs de 87 y 55 de 132 esperados, con un hueco de 9,8 h.
 */
export function umbralDeHorasDeCron(runs, jobs = JOBS_DE_MAIN) {
  let maximo = { horas: 0 };
  for (const j of jobs.filter((x) => x.unidad === 'horas')) {
    const serie = serieDe(runs, j.workflow, j.job);
    for (let i = 1; i < serie.length; i++) {
      const horas = horasEntre(serie[i - 1].creado, serie[i].creado);
      if (horas > maximo.horas) maximo = { horas, job: clave(j.workflow, j.job), desde: serie[i - 1].creado };
    }
  }
  return { umbral: Math.ceil(maximo.horas), ...maximo };
}

/**
 * EL VEREDICTO. Función PURA: es lo que el test ejercita sin red.
 *
 * @param {object}   e
 * @param {object[]} e.runs           los runs de `main`, del más viejo al más nuevo
 * @param {string}   e.ahora          ISO; el instante en que se mide
 * @param {string[]|null} e.obligatorios  los checks obligatorios de `main`; `null` = no se pudo leer
 * @param {string[]|null} [e.commitsDeMain]  shas (8) de `main`, del más nuevo al más viejo; `null` =
 *                                    no se sabe, y entonces un workflow que deja de dar runs NO se ve
 * @returns {{ filas: object[], avisos: object[], sinDeclarar: string[], ciego: string|null }}
 */
export function veredicto({ runs, ahora, obligatorios, commitsDeMain = null, jobs = JOBS_DE_MAIN, umbrales = {} }) {
  const U = {
    rojos: umbrales.rojos ?? UMBRAL_ROJOS_SEGUIDOS,
    runs: umbrales.runs ?? UMBRAL_RUNS_SIN_EJECUTAR,
    horas: umbrales.horas ?? UMBRAL_HORAS_DE_CRON,
  };
  if (!Array.isArray(obligatorios)) {
    return { filas: [], avisos: [], sinDeclarar: [], ciego: 'no se pudo leer la lista de checks obligatorios de main' };
  }
  const vistos = runs.filter((r) => r.creado <= ahora);
  if (vistos.length === 0) {
    return { filas: [], avisos: [], sinDeclarar: [], ciego: 'ningún run de main en la ventana: no hay nada que medir' };
  }

  const filas = jobs.map((j) => {
    const serie = serieDe(vistos, j.workflow, j.job);
    const ejecuciones = serie.filter((s) => EJECUTO.has(s.estado));
    const ultima = ejecuciones.at(-1) ?? null;
    const ultimoVerde = [...ejecuciones].reverse().find((s) => s.estado === 'success') ?? null;
    const racha = rachasRojas(serie).find((r) => r.viva) ?? null;
    const fila = {
      workflow: j.workflow, job: j.job, unidad: j.unidad,
      obligatorio: obligatorios.includes(j.job),
      runs: serie.length, ejecuciones: ejecuciones.length,
      ultima: ultima ? `${ultima.estado} · ${ultima.sha} · ${ultima.creado}` : 'nunca en la ventana',
      rojosSeguidos: racha ? racha.tamano : 0,
      estado: 'VERDE', motivo: '',
    };

    if (j.unidad === 'runs') {
      // El silencio se cuenta en runs… y en commits de main que no tienen run de este workflow:
      // si sólo se miran los runs que existen, un workflow que deja de dispararse no se ve.
      const sinRun = commitsSinRun(vistos, j.workflow, commitsDeMain);
      fila.sinEjecutar = huecosSinEjecutar(serie).vivo + (sinRun ?? 0);
      fila.commitsSinRun = sinRun;
      if (fila.sinEjecutar >= U.runs) {
        fila.estado = 'SILENCIO';
        fila.motivo = `${fila.sinEjecutar} runs seguidos de main sin ejecutarse (umbral ${U.runs})`;
      } else if (fila.rojosSeguidos >= U.rojos) {
        fila.estado = 'ROJO-SOSTENIDO';
        fila.motivo = `${fila.rojosSeguidos} ejecuciones seguidas en rojo desde ${racha.desde} (umbral ${U.rojos})`;
      } else if (fila.rojosSeguidos > 0) {
        fila.estado = 'ROJO-RECIENTE';
        fila.motivo = `${fila.rojosSeguidos} en rojo, por debajo del umbral ${U.rojos}: no avisa`;
      }
    } else {
      // Cron: dos preguntas en horas. ¿Cuánto hace del último RUN? (el cron que no llega, o el
      // workflow que desaparece) y ¿cuánto hace del último VERDE? (el que llega y falla). Sin run
      // o sin verde en la ventana, se cuenta desde su principio.
      const h1 = (x) => Math.round(x * 10) / 10;
      fila.horasSinRun = h1(horasEntre(serie.length ? serie.at(-1).creado : vistos[0].creado, ahora));
      fila.horasSinVerde = h1(horasEntre(ultimoVerde ? ultimoVerde.creado : vistos[0].creado, ahora));
      if (fila.horasSinRun > U.horas) {
        fila.estado = 'SILENCIO';
        fila.motivo = `${fila.horasSinRun} h sin un solo run${serie.length ? '' : ' (ninguno en la ventana)'} (umbral ${U.horas} h)`;
      } else if (fila.rojosSeguidos >= MINIMO_ROJOS_DE_CRON && fila.horasSinVerde > U.horas) {
        fila.estado = 'ROJO-SOSTENIDO';
        fila.motivo = `${fila.rojosSeguidos} rojos seguidos y ${fila.horasSinVerde} h sin un verde (umbral ${U.horas} h)`;
      } else if (fila.rojosSeguidos > 0) {
        fila.estado = 'ROJO-RECIENTE';
        fila.motivo = `${fila.rojosSeguidos} en rojo, ${fila.horasSinVerde} h sin verde: no avisa`;
      }
    }
    return fila;
  });

  // Un check obligatorio en rojo ya para la cola: su rojo no es de este instrumento. Su SILENCIO sí.
  const avisos = filas.filter((f) => f.estado === 'SILENCIO' || (f.estado === 'ROJO-SOSTENIDO' && !f.obligatorio));

  const declarados = new Set(jobs.map((j) => clave(j.workflow, j.job)));
  const workflows = new Set(jobs.map((j) => j.workflow));
  const sinDeclarar = [...new Set(vistos
    .filter((r) => workflows.has(r.workflow))
    .flatMap((r) => Object.keys(r.jobs).map((n) => clave(r.workflow, n))))]
    .filter((k) => !declarados.has(k)).sort();

  return { filas, avisos, sinDeclarar, ciego: null };
}

/**
 * Cuántos commits de `main` son MÁS NUEVOS que el último run del workflow. `null` si no se sabe
 * (no se pasó la lista, o el commit del último run ya no está en ella: entonces no se inventa).
 */
export function commitsSinRun(runs, workflow, commitsDeMain) {
  if (!Array.isArray(commitsDeMain) || commitsDeMain.length === 0) return null;
  const ultimo = runs.filter((r) => r.workflow === workflow).at(-1);
  if (!ultimo) return commitsDeMain.length;
  const i = commitsDeMain.indexOf(ultimo.sha);
  return i === -1 ? null : i;
}

/**
 * EL SUELO: antes de afirmar nada, el instrumento comprueba que reconoce sus cebos. Si no, un
 * «nada que avisar» suyo no significa «está limpio»: significa «no sé mirar».
 */
export function sueloDelVigia() {
  const t = (i) => new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString();
  const jobs = [
    { workflow: 'W', job: 'rojo', unidad: 'runs' },
    { workflow: 'W', job: 'mudo', unidad: 'runs' },
    { workflow: 'W', job: 'sano', unidad: 'runs' },
    { workflow: 'C', job: 'cron', unidad: 'horas' },
  ];
  const runs = [];
  for (let i = 0; i < UMBRAL_RUNS_SIN_EJECUTAR + 1; i++) {
    runs.push({
      workflow: 'W', evento: 'push', creado: t(i), sha: `c${i}`,
      jobs: {
        rojo: i === 0 ? 'success' : 'failure',
        sano: 'success',
        ...(i === 0 ? { mudo: 'success' } : {}),
      },
    });
  }
  runs.push({ workflow: 'C', evento: 'schedule', creado: t(0), sha: 'c0', jobs: { cron: 'success' } });
  const ahora = new Date(Date.parse(t(0)) + (UMBRAL_HORAS_DE_CRON + 1) * 3600000).toISOString();
  const v = veredicto({ runs, ahora, obligatorios: [], jobs });
  const estado = Object.fromEntries(v.filas.map((f) => [f.job, f.estado]));
  const esperado = { rojo: 'ROJO-SOSTENIDO', mudo: 'SILENCIO', sano: 'VERDE', cron: 'SILENCIO' };
  const ok = Object.keys(esperado).every((k) => estado[k] === esperado[k]);
  return { ok, estado, esperado, detalle: `suelo del vigía: ${ok ? 'reconoce' : 'NO reconoce'} sus cuatro cebos (${JSON.stringify(estado)})` };
}

/** El informe en texto: primera línea la POBLACIÓN, última el `EXIT=` (A21). */
export function informe(v, { ahora, origen, poblacion }) {
  const l = [];
  l.push(`POBLACION ${poblacion} · medido ${ahora} · ${origen}`);
  if (v.ciego) { l.push(`CIEGO — ${v.ciego}`); l.push(`EXIT=${SALIDA_CIEGO}`); return l.join('\n'); }
  l.push(`umbrales: ${UMBRAL_ROJOS_SEGUIDOS} rojos seguidos · ${UMBRAL_RUNS_SIN_EJECUTAR} runs sin ejecutar · ${UMBRAL_HORAS_DE_CRON} h de cron sin run o sin verde`);
  for (const f of v.filas) {
    const medida = f.unidad === 'runs'
      ? `${f.rojosSeguidos} rojos seg. · ${f.sinEjecutar} sin ejecutar${f.commitsSinRun === null ? ' (commits de main: no leídos)' : ''}`
      : `${f.rojosSeguidos} rojos seg. · ${f.horasSinRun} h sin run · ${f.horasSinVerde} h sin verde`;
    l.push(`${f.estado.padEnd(14)} ${f.obligatorio ? 'OBLIG. ' : 'no obl.'} ${clave(f.workflow, f.job)}`);
    l.push(`               ${f.ejecuciones} ejecuciones de ${f.runs} runs · ${medida} · última: ${f.ultima}${f.motivo ? `\n               → ${f.motivo}` : ''}`);
  }
  for (const k of v.sinDeclarar) l.push(`SIN-DECLARAR   ${k} — corre en main y no está en JOBS_DE_MAIN: nadie lo vigila`);
  l.push(v.avisos.length
    ? `AVISO: ${v.avisos.length} de ${v.filas.length} jobs — ${v.avisos.map((f) => `${f.estado} «${f.job}»`).join(' · ')}`
    : `sin avisos: ${v.filas.length} jobs mirados, ninguno en rojo sostenido ni en silencio`);
  l.push(`EXIT=${v.avisos.length || v.sinDeclarar.length ? SALIDA_AVISO : SALIDA_OK}`);
  return l.join('\n');
}

// ── LA LECTURA DE GITHUB (sólo aquí hay red) ─────────────────────────────────────────────────
const GH_FUERA_DEL_PATH = 'C:/Program Files/GitHub CLI/gh.exe';
const gh = (ruta) => new Promise((ok, ko) => {
  const binario = process.env.GH_BIN || (process.platform === 'win32' && existsSync(GH_FUERA_DEL_PATH) ? GH_FUERA_DEL_PATH : 'gh');
  execFile(binario, ['api', ruta], { maxBuffer: 64 * 1024 * 1024 }, (e, salida) => {
    if (e) return ko(new Error(`gh api ${ruta}: ${String(e.message).split('\n')[0].slice(0, 160)}`));
    try { ok(JSON.parse(salida)); } catch { ko(new Error(`gh api ${ruta}: respuesta que no es JSON`)); }
  });
});

const ESTADO_DE = { success: 'success', failure: 'failure', cancelled: 'cancelled', skipped: 'skipped' };

async function leerDeGitHub(jobs) {
  const reglas = await gh(`repos/${REPO}/rules/branches/main`);
  const obligatorios = reglas
    .filter((r) => r.type === 'required_status_checks')
    .flatMap((r) => r.parameters.required_status_checks.map((c) => c.context));
  const commits = (await gh(`repos/${REPO}/commits?sha=main&per_page=100`)).map((c) => c.sha.slice(0, 8));
  const lista = (await gh(`repos/${REPO}/actions/workflows?per_page=100`)).workflows;
  const runs = [];
  const sinLeer = [];
  for (const nombre of new Set(jobs.map((j) => j.workflow))) {
    const wf = lista.find((w) => w.name === nombre);
    if (!wf) continue; // el workflow ya no existe: sus jobs saldrán en SILENCIO, que es la verdad
    const deCron = jobs.some((j) => j.workflow === nombre && j.unidad === 'horas');
    const pagina = await gh(`repos/${REPO}/actions/workflows/${wf.id}/runs?branch=main&per_page=${deCron ? 30 : 100}`);
    const propios = pagina.workflow_runs.filter((r) => ['push', 'schedule', 'workflow_dispatch'].includes(r.event));
    const cola = [...propios];
    await Promise.all(Array.from({ length: 8 }, async () => {
      for (let r = cola.shift(); r; r = cola.shift()) {
        const run = { workflow: nombre, evento: r.event, creado: r.created_at, sha: r.head_sha.slice(0, 8), jobs: {} };
        try {
          const j = await gh(`repos/${REPO}/actions/runs/${r.id}/jobs?per_page=100&filter=latest`);
          for (const x of j.jobs) run.jobs[x.name] = x.status === 'completed' ? (ESTADO_DE[x.conclusion] ?? 'cancelled') : 'pendiente';
        } catch (e) {
          sinLeer.push(`${nombre} · run ${r.id}: ${e.message}`);
          for (const d of jobs.filter((x) => x.workflow === nombre)) run.jobs[d.job] = 'sin-leer';
        }
        runs.push(run);
      }
    }));
  }
  runs.sort((a, b) => a.creado.localeCompare(b.creado));
  return { runs, obligatorios, commits, sinLeer };
}

async function principal() {
  const args = process.argv.slice(2);
  const opcion = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };

  const suelo = sueloDelVigia();
  console.log(suelo.detalle);
  if (!suelo.ok) {
    console.log('CIEGO — el vigía no reconoce sus cebos: esta pasada no puede afirmar nada.');
    console.log(`EXIT=${SALIDA_CIEGO}`);
    return SALIDA_CIEGO;
  }

  const fichero = opcion('--historial');
  let v; let ahora; let origen; let poblacion;
  if (fichero) {
    // Un historial guardado no trae la lista de obligatorios ni los commits: la primera se pasa
    // con `--obligatorio` (repetible) y los segundos no se inventan.
    const h = leerHistorial(readFileSync(fichero, 'utf8'));
    ahora = opcion('--ahora') || h.tomada;
    const obligatorios = args.flatMap((a, i) => (a === '--obligatorio' ? [args[i + 1]] : []));
    v = veredicto({ runs: h.runs, ahora, obligatorios });
    origen = `historial ${fichero} (tomado ${h.tomada})`;
    poblacion = `runs=${h.runs.filter((r) => r.creado <= ahora).length} de ${h.runs.length}`;
  } else {
    let leido;
    try { leido = await leerDeGitHub(JOBS_DE_MAIN); } catch (e) {
      console.log(`POBLACION runs=0 · no se pudo leer GitHub`);
      console.log(`CIEGO — ${e.message}`);
      console.log(`EXIT=${SALIDA_CIEGO}`);
      return SALIDA_CIEGO;
    }
    ahora = new Date().toISOString();
    v = veredicto({ runs: leido.runs, ahora, obligatorios: leido.obligatorios, commitsDeMain: leido.commits });
    origen = `GitHub ${REPO} · obligatorios: ${leido.obligatorios.join(', ') || '(ninguno)'} · main en ${leido.commits[0]}`;
    poblacion = `runs=${leido.runs.length} · jobs sin leer=${leido.sinLeer.length}`;
    for (const s of leido.sinLeer) console.log(`  sin leer: ${s}`);
  }
  console.log(informe(v, { ahora, origen, poblacion }));
  if (v.ciego) return SALIDA_CIEGO;
  return v.avisos.length || v.sinDeclarar.length ? SALIDA_AVISO : SALIDA_OK;
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  process.exitCode = await principal();
}
