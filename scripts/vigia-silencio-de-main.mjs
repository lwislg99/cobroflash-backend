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
//   node scripts/vigia-silencio-de-main.mjs --commit <sha40> [--json f]   SCRUM-1393c: ESE commit
//   node scripts/vigia-silencio-de-main.mjs --commits <fichero> [--json f]   un sha por línea
//   node scripts/vigia-silencio-de-main.mjs --desde-de-la-red      desde cuándo mira la red diaria
// SALIDAS: 0 = leído, nada que avisar · 1 = leído, HAY aviso · 2 = no supe medir (CIEGO).
// En el modo por commit, un commit CIEGO (nadie lo probó) es un AVISO y sale 1, no 2: el 2 queda
// para cuando el que no supo mirar es el vigía. Quien lo llame avisa TAMBIÉN con el 2.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUTAS_GH } from './equipo/ancla.mjs';
import { checksObligatoriosDeReglas } from './vigia-atascados.mjs';
// De `-linea`, no de `_senal-de-nombres.mjs`: aquél importa `typescript`, y el workflow del vigía no
// instala paquetes (SCRUM-1324c; lo ata tests/scrum1324c-el-vigia-carga-sin-paquetes.test.mjs).
import { registroDesdeLinea, TITULO as TITULO_DE_LA_SENAL } from './_senal-de-nombres-linea.mjs';

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

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1393c · EL MODO POR COMMIT: ¿ESTE commit de `main` está probado?
//
// Lo de arriba avisa por RACHAS (5 rojos, 22 runs sin ejecutar): un único commit cuyo CI se
// canceló con 0 jobs no llega nunca a un umbral, y sirvió en producción sin verificar (cae4c5cc,
// 1-oct). Esto juzga un commit con su propio run del CI. El fundador fijó en SCRUM-1393 c.20144
// (C) un workflow al acabar cada CI de `main` y (B) uno diario de red; los dos llaman aquí, y el
// workflow lo escribe S5 (su carril). Lo que más urge es el CIEGO, no el rojo.
//
//   VERDE      el run acabó en success y CADA job declarado del CI corrió y salió success
//   ROJO       algún job salió failure (obligatorio o no: el que no bloquea es el que nadie ve)
//   CIEGO      no hubo run · run con 0 jobs · job cancelado, saltado, con timeout o ausente ·
//              run sin acabar más allá del tope (colgado o en cola) · conclusión que contradice
//              a sus jobs. «Nadie ha probado este commit», que NO es verde.
//   CORRIENDO  run sin acabar dentro del tope: ni verde ni rojo, y no avisa (se declara).
//   SIN-LEER   GitHub no contestó por ese commit: no se sabe, y tampoco es verde.
//
// El TOPE de un run sin acabar no se elige: es la suma de los `timeout-minutes` de `ci.yml`
// (`topeDeCorridaDelCI`), lo más que puede durar aunque sus jobs corrieran uno detrás de otro.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** La causa de un CIEGO que se puede absolver (SCRUM-1393e): run cancelado con 0 jobs. */
export const CAUSA_SUSTITUIDO = 'sustituido';

// SCRUM-1339r · EL CIEGO DEL META-GUARD (decisión del fundador del 22-oct, SCRUM-1339 c.20219, 2b).
// El meta-guard sale con 2 cuando no supo juzgar algún guard, y GitHub lo pinta `failure`: aquí era
// un ROJO, y un verde posterior lo absolvía. Y cortado a sus 30 min (128 veces desde el 15-oct,
// SCRUM-1538/935c) sale `cancelled` sin llegar a su resumen. Las dos cosas son «nadie sabe si los
// guards caen cuando deben»: CIEGO, con su causa, que NO se absuelve, y que manda aunque otro job
// del mismo run esté en rojo (ese rojo va nombrado en el motivo). El 2 se lee de la anotación que
// GitHub deja al paso que cae («Process completed with exit code 2.»), y SÓLO si el paso que cae
// es el de las mutaciones: un `npm run build` que cae también puede salir con 2 (`tsc`).

/** La causa de un CIEGO del meta-guard: cortado, cancelado o salido con su 2. No se absuelve. */
export const CAUSA_META_GUARD = 'meta-guard';
/** El job y su paso, por IDENTIDAD; el test los busca en `ci.yml`. */
export const JOB_META_GUARD = 'meta-guard · los guards caen cuando deben';
export const PASO_DEL_META_GUARD = 'Cada guard cae con la mutación que declara';
/** «No supe juzgar»: `SALIDA_CIEGO` de `scripts/meta-guard-mutaciones.mjs` (el test ata las dos). */
export const SALIDA_CIEGO_DEL_META_GUARD = 2;

/** El código de salida que GitHub anota al paso que cae, PURO. `null` si no hay exactamente uno. */
export function codigoDeSalidaDeAnotaciones(anotaciones) {
  const codigos = (Array.isArray(anotaciones) ? anotaciones : [])
    .filter((a) => a?.annotation_level === 'failure')
    .map((a) => /^Process completed with exit code (\d+)\.$/.exec(String(a.message ?? '').trim()))
    .filter(Boolean).map((m) => Number(m[1]));
  return codigos.length === 1 ? codigos[0] : null;
}

/** Por qué el meta-guard de este run es CIEGO, o `null` si no lo es. PURO. */
export function ciegoDelMetaGuard(jobs) {
  const j = (Array.isArray(jobs) ? jobs : []).find((x) => x.name === JOB_META_GUARD);
  if (!j || j.status !== 'completed') return null;
  // Cancelado él SOLO: si se canceló el run entero (todos sus jobs), el CIEGO es del run, no suyo (1393e).
  const propio = jobs.some((x) => x.name !== JOB_META_GUARD && x.status === 'completed' && x.conclusion !== 'cancelled');
  if (j.conclusion === 'cancelled' || j.conclusion === 'timed_out') return propio ? `cortado o cancelado («${j.conclusion}»): no llegó a su resumen` : null;
  if (j.conclusion !== 'failure') return null;
  const caidos = (j.steps ?? []).filter((s) => s.conclusion === 'failure').map((s) => s.name);
  if (caidos.length !== 1 || caidos[0] !== PASO_DEL_META_GUARD) return null;
  return j.codigoDeSalida === SALIDA_CIEGO_DEL_META_GUARD
    ? `salió con ${SALIDA_CIEGO_DEL_META_GUARD} en «${PASO_DEL_META_GUARD}»: no supo juzgar algún guard`
    : null;
}

// SCRUM-1339u · EL CIEGO DE LA SEÑAL DE NOMBRES (decisión del fundador del 22-oct, SCRUM-1339 c.20240, «a»).
// `scripts/senal-de-nombres.mjs` sale 0 cuando NO PUEDE MEDIR (c.17954): el job sigue verde, y nadie
// sabe si el TAP traía todos los casos. Se lee por el DATO que deja en las anotaciones del job
// «build + tests», no por el texto del log: su `::notice` lleva SIEMPRE la línea de registro
// (`[señal de nombres v1] medible=…`, que se lee con `registroDesdeLinea`, la de la casa), y cuando el
// guion revienta antes de llegar ahí deja un `::warning` titulado «señal de nombres · NO PUDE MEDIR».
// Sin ninguna de las dos, el paso no corrió o el guion no está: tampoco midió. Como el del meta-guard,
// este CIEGO manda aunque otro job esté en rojo (va nombrado) y NO se absuelve.

/** La causa de un CIEGO de la señal de nombres: no midió. No se absuelve. */
export const CAUSA_SENAL = 'señal de nombres';
/** El job donde corre la señal, por IDENTIDAD; el test lo busca en `ci.yml`. */
export const JOB_DE_LA_SENAL = 'build + tests (con banco desechable)';

/**
 * Qué dice la señal en las anotaciones de su job, PURO. `null` = no se pudieron leer.
 * → `{ estado: 'midio', ausentes }` · `{ estado: 'no-pudo', motivo }` · `{ estado: 'sin-registro' }` · `null`
 */
export function lecturaDeLaSenal(anotaciones) {
  if (!Array.isArray(anotaciones)) return null;
  const titulo = (a) => String(a?.title ?? '');
  const aviso = anotaciones.find((a) => a?.annotation_level === 'warning' && titulo(a) === `${TITULO_DE_LA_SENAL} · NO PUDE MEDIR`);
  const registros = anotaciones.filter((a) => a?.annotation_level === 'notice' && titulo(a).startsWith(`${TITULO_DE_LA_SENAL} · `))
    .map((a) => registroDesdeLinea(a.message)).filter(Boolean);
  if (aviso || registros.some((r) => !r.medible)) return { estado: 'no-pudo', motivo: aviso ? String(aviso.message ?? '').split('\n')[0] : 'medible=no en su línea de registro' };
  if (registros.length !== 1) return { estado: 'sin-registro', registros: registros.length };
  return { estado: 'midio', ausentes: registros[0].ausentes };
}

/** Por qué la señal de este run es CIEGO, o `null` si midió (o no se intentó leer: `senal` sin definir). PURO. */
export function ciegoDeLaSenal(jobs) {
  const j = (Array.isArray(jobs) ? jobs : []).find((x) => x.name === JOB_DE_LA_SENAL);
  // Un job cancelado o sin acabar ya es CIEGO por su cuenta («sin probar» o el run entero): no se duplica.
  if (!j || j.status !== 'completed' || !['success', 'failure'].includes(j.conclusion) || j.senal === undefined) return null;
  if (j.senal === null) return 'no se pudieron leer las anotaciones de su job: no se sabe si midió';
  if (j.senal.estado === 'no-pudo') return `NO PUDO MEDIR: ${j.senal.motivo}`;
  if (j.senal.estado === 'sin-registro') return `su job no dejó una línea de registro (deja ${j.senal.registros}): el paso no corrió o el guion no está`;
  return null;
}

/** Los jobs del workflow CI que se exigen en cada commit de `main`: los de `JOBS_DE_MAIN`. */
export const JOBS_DEL_CI = JOBS_DE_MAIN.filter((j) => j.workflow === 'CI').map((j) => j.job);

/** Lo más que puede durar un run del CI, en minutos: la suma de sus `timeout-minutes`. `null` si no hay ninguno. */
export function topeDeCorridaDelCI(textoCiYml) {
  const minutos = [...String(textoCiYml).matchAll(/^\s+timeout-minutes:\s*(\d+)\s*$/gm)].map((m) => Number(m[1]));
  return minutos.length ? minutos.reduce((a, b) => a + b, 0) : null;
}

/**
 * EL VEREDICTO DE UN COMMIT. Función PURA.
 *
 * @param {object}      e
 * @param {string}      e.sha        el commit de `main`
 * @param {object|null} e.run        el run del CI por `push` de ese commit (`status`, `conclusion`,
 *                                   `created_at`, `html_url`) o `null` si no hay ninguno
 * @param {object[]|null} e.jobs     sus jobs (`name`, `status`, `conclusion`); `null` = no se leyeron
 * @param {string}      e.ahora      ISO
 * @param {number|null} e.topeMin    `topeDeCorridaDelCI`; `null` = no se sabe, y un run sin acabar es SIN-LEER
 * @returns {{ sha: string, estado: string, motivo: string, url: string|null, jobs: object[] }}
 */
export function veredictoDeCommit({ sha, run, jobs, ahora, topeMin, declarados = JOBS_DEL_CI }) {
  const r = (estado, motivo, lista = [], causa = null) => ({ sha, estado, motivo, url: run?.html_url ?? null, jobs: lista, causa });
  // SCRUM-1393f: `sinRun` es el dato («GitHub no tiene run de este commit»); si fue por sustitución
  // en la cola lo decide la línea (`sinRunPorSustitucion`), no este veredicto, que no ve vecinos.
  if (!run) return { ...r('CIEGO', 'ningún run del CI por push para este commit: no corrió'), sinRun: true };
  if (run.status !== 'completed') {
    const min = Math.round((Date.parse(ahora) - Date.parse(run.created_at)) / 60000);
    if (topeMin == null) return r('SIN-LEER', `run «${run.status}» desde hace ${min} min y no se sabe el tope del CI`);
    return min > topeMin
      ? r('CIEGO', `run «${run.status}» desde hace ${min} min, más que el tope del CI (${topeMin} min): colgado o en cola`)
      : r('CORRIENDO', `run «${run.status}» desde hace ${min} min (tope ${topeMin} min): aún sin veredicto`);
  }
  if (!Array.isArray(jobs)) return r('SIN-LEER', `run «${run.conclusion}», pero no se pudieron leer sus jobs`);
  // SCRUM-1393e: «cancelled» con 0 jobs es el run que GitHub cancela al llegar el siguiente commit
  // (sustitución). Es el ÚNICO CIEGO que un verde posterior que lo contiene puede absolver, y se
  // marca por el dato (`causa`), no por el texto del motivo.
  if (jobs.length === 0) return r('CIEGO', `run «${run.conclusion}» con 0 jobs`, [], run.conclusion === 'cancelled' ? CAUSA_SUSTITUIDO : null);

  const rojos = jobs.filter((j) => j.conclusion === 'failure');
  const delMetaGuard = ciegoDelMetaGuard(jobs);
  // SCRUM-1339u: el CIEGO de la señal se nombra también junto al del meta-guard; la causa es la del primero.
  const deLaSenal = ciegoDeLaSenal(jobs);
  const yLaSenal = deLaSenal ? ` · CIEGO de la señal de nombres: ${deLaSenal}` : '';
  if (delMetaGuard) {
    const otros = rojos.filter((j) => j.name !== JOB_META_GUARD);
    const ademas = otros.length ? ` · además en rojo: ${otros.map((j) => `«${j.name}»`).join(', ')}` : '';
    return r('CIEGO', `CIEGO del meta-guard: ${delMetaGuard}${yLaSenal}${ademas}`, jobs.filter((j) => j.name === JOB_META_GUARD || j.conclusion === 'failure'), CAUSA_META_GUARD);
  }
  if (deLaSenal) {
    const ademas = rojos.length ? ` · además en rojo: ${rojos.map((j) => `«${j.name}»`).join(', ')}` : '';
    return r('CIEGO', `CIEGO de la señal de nombres: ${deLaSenal}${ademas}`, jobs.filter((j) => j.name === JOB_DE_LA_SENAL || j.conclusion === 'failure'), CAUSA_SENAL);
  }
  // Un meta-guard en `failure` cuyo código no se pudo LEER (`null`; `undefined` = no se intentó) puede
  // ser su 2: sigue ROJO, que avisa, pero lo dice.
  const sinCodigo = rojos.some((j) => j.name === JOB_META_GUARD && j.codigoDeSalida === null)
    ? ' · el código de salida del meta-guard no se pudo leer: puede ser su CIEGO (2)' : '';
  if (rojos.length) return r('ROJO', `en rojo: ${rojos.map((j) => `«${j.name}»`).join(', ')}${sinCodigo}`, rojos);

  const noCorrieron = jobs.filter((j) => j.status !== 'completed' || j.conclusion !== 'success');
  const nombres = new Set(jobs.map((j) => j.name));
  const ausentes = declarados.filter((n) => !nombres.has(n));
  if (noCorrieron.length || ausentes.length) {
    const partes = [
      ...noCorrieron.map((j) => `«${j.name}» ${j.status === 'completed' ? j.conclusion : j.status}`),
      ...ausentes.map((n) => `«${n}» ausente`),
    ];
    return r('CIEGO', `sin probar: ${partes.join(', ')}`, noCorrieron);
  }
  if (run.conclusion !== 'success') return r('CIEGO', `run «${run.conclusion}» con todos sus jobs en success: no cuadra`);
  return r('VERDE', `${jobs.length} jobs en success`);
}

/** La salida de un lote: 1 si hay ROJO o CIEGO (avisar), 2 si no lo hay pero algo no se leyó, 0 si no. */
export function salidaDeCommits(veredictos) {
  if (veredictos.some((v) => v.estado === 'ROJO' || v.estado === 'CIEGO')) return SALIDA_AVISO;
  if (veredictos.length === 0 || veredictos.some((v) => v.estado === 'SIN-LEER')) return SALIDA_CIEGO;
  return SALIDA_OK;
}

/**
 * EL SUELO DEL MODO POR COMMIT: cebos FABRICADOS aquí, uno por estado y dos de CIEGO (el que
 * no corrió y el cancelado con 0 jobs, que son los dos que pasaron el 1-oct), más los dos del
 * meta-guard (SCRUM-1339r: su 2 es CIEGO, su 1 es ROJO) y los dos de la señal de nombres
 * (SCRUM-1339u: no pudo medir es CIEGO, midió 0 es VERDE). `juez` se puede
 * cambiar para comprobar que un juez ciego NO pasa el suelo.
 */
export function sueloPorCommit(juez = veredictoDeCommit) {
  const ahora = '2026-01-01T12:00:00Z';
  const job = (name, conclusion) => ({ name, status: 'completed', conclusion });
  const todos = (c) => JOBS_DEL_CI.map((n) => job(n, c));
  const run = (status, conclusion, creado = '2026-01-01T11:50:00Z') => ({ status, conclusion, created_at: creado, html_url: null });
  const metaGuard = (codigo, otros = []) => [
    ...todos('success').filter((j) => j.name !== JOB_META_GUARD && !otros.some((o) => o.name === j.name)), ...otros,
    { ...job(JOB_META_GUARD, 'failure'), steps: [{ name: PASO_DEL_META_GUARD, conclusion: 'failure' }], codigoDeSalida: codigo },
  ];
  const senal = (lectura, otros = []) => [
    ...todos('success').filter((j) => j.name !== JOB_DE_LA_SENAL && !otros.some((o) => o.name === j.name)), ...otros,
    { ...job(JOB_DE_LA_SENAL, 'success'), senal: lectura },
  ];
  const cebos = [
    { sha: 'cebo-verde', run: run('completed', 'success'), jobs: todos('success'), esperado: 'VERDE' },
    { sha: 'cebo-rojo', run: run('completed', 'failure'), jobs: [...todos('success').slice(1), job(JOBS_DEL_CI[0], 'failure')], esperado: 'ROJO' },
    { sha: 'cebo-cancelado', run: run('completed', 'cancelled'), jobs: [], esperado: 'CIEGO' },
    { sha: 'cebo-sin-run', run: null, jobs: null, esperado: 'CIEGO' },
    { sha: 'cebo-colgado', run: run('in_progress', null, '2026-01-01T06:00:00Z'), jobs: null, esperado: 'CIEGO' },
    { sha: 'cebo-corriendo', run: run('in_progress', null), jobs: null, esperado: 'CORRIENDO' },
    // SCRUM-1339r: el meta-guard con su 2, con otro job en rojo al lado (lo que dio `main` el 19-21 oct),
    // es CIEGO; con su 1 (un guard MUDO) es ROJO.
    { sha: 'cebo-meta-guard-2', run: run('completed', 'failure'), jobs: metaGuard(2, [job(JOBS_DEL_CI[1], 'failure')]), esperado: 'CIEGO' },
    { sha: 'cebo-meta-guard-1', run: run('completed', 'failure'), jobs: metaGuard(1), esperado: 'ROJO' },
    // SCRUM-1339u: la señal que no pudo medir es CIEGO, también con otro job en rojo; la que midió 0, VERDE.
    { sha: 'cebo-senal-no-pudo', run: run('completed', 'failure'), jobs: senal({ estado: 'no-pudo', motivo: 'cebo' }, [job(JOBS_DEL_CI[1], 'failure')]), esperado: 'CIEGO' },
    { sha: 'cebo-senal-midio', run: run('completed', 'success'), jobs: senal({ estado: 'midio', ausentes: 0 }), esperado: 'VERDE' },
  ];
  const estado = Object.fromEntries(cebos.map((c) => [c.sha, juez({ ...c, ahora, topeMin: 130 }).estado]));
  const ok = cebos.every((c) => estado[c.sha] === c.esperado);
  return { ok, estado, detalle: `suelo por commit: ${ok ? 'reconoce' : 'NO reconoce'} sus ${cebos.length} cebos (${JSON.stringify(estado)})` };
}

/** El informe del modo por commit: primera línea la POBLACIÓN, la de recuento SIEMPRE, última el `EXIT=`. */
export function informeDeCommits(veredictos, { ahora, origen }) {
  const n = (e) => veredictos.filter((v) => v.estado === e).length;
  const l = [`POBLACION commits=${veredictos.length} · medido ${ahora} · ${origen}`];
  for (const v of veredictos) l.push(`${v.estado.padEnd(10)} ${v.sha.slice(0, 12)} · ${v.motivo}${v.url ? ` · ${v.url}` : ''}`);
  l.push(`${veredictos.length} commits mirados · ${n('ROJO')} rojos · ${n('CIEGO')} ciegos (sin verificar) · ${n('CORRIENDO')} corriendo · ${n('SIN-LEER')} sin leer · ${n('VERDE')} verdes`);
  l.push(`EXIT=${salidaDeCommits(veredictos)}`);
  return l.join('\n');
}

/** La marca de un aviso: una por commit y estado, para que el cron diario no repita lo que (C) ya dijo. */
export const marcaDeAviso = (v) => `<!-- vigia-de-main:${v.sha}:${v.estado} -->`;

/**
 * EL CUERPO DEL AVISO (SCRUM-1393c), PURO: lo que `.github/workflows/vigia-de-main.yml` comenta en
 * su Issue. Sólo los ROJO, CIEGO y SIN-LEER que aún no tienen su marca en `previos` (el texto de
 * los comentarios ya publicados). `''` = nada nuevo que decir. Sin la mención que despierta a
 * Claude: este aviso es para una persona (el mismo invariante que `vigia-atascados`).
 */
export function cuerpoDelAviso({ veredictos, ahora, origen, urlDelRun, callados = new Set() }, previos = '') {
  // `callados` (SCRUM-1393e): los CIEGO «sustituido» absueltos o en espera; no se avisan.
  const nuevos = veredictos.filter((v) => ['ROJO', 'CIEGO', 'SIN-LEER'].includes(v.estado) && !callados.has(v.sha) && !String(previos).includes(marcaDeAviso(v)));
  if (!nuevos.length) return '';
  const l = [`**Vigía de main** · ${ahora} · ${origen}`, '', informeDeCommits(veredictos, { ahora, origen }).split('\n').at(-2), ''];
  for (const v of nuevos) l.push(`- **${v.estado}** \`${v.sha.slice(0, 12)}\` — ${v.motivo}${v.url ? ` · [run](${v.url})` : ''} ${marcaDeAviso(v)}`);
  l.push('', 'CIEGO = nadie ha probado ese commit en `main`; NO es verde. ROJO = un job cayó, bloquee o no.', `Pasada: ${urlDelRun}`);
  const cuerpo = l.join('\n');
  if (/@claude/i.test(cuerpo)) throw new Error('el aviso del vigía de main contiene la mención que despierta a Claude');
  return cuerpo;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1393d · CUÁNDO SE CIERRA EL ISSUE, Y CUÁNDO SE REABRE
//
// Se cierra cuando la pasada juzga la PUNTA de `main` VERDE, sin un CIEGO ni un SIN-LEER en la
// pasada, y sin un CIEGO pendiente en el Issue. Pendiente = un commit cuya ÚLTIMA marca desde el
// último cierre es CIEGO o SIN-LEER, y que esta pasada no ha juzgado VERDE o ROJO. Un CIEGO no lo
// absuelve un verde POSTERIOR (decisión del orquestador, sin «lectura generosa»): nadie probó ese
// commit, y se sirvió igual. Un ROJO sí: un rojo se arregla con otro commit, y ése es el verde.
// Si después vuelve un ROJO o un CIEGO con el Issue cerrado, se REABRE el mismo (no otro).
//
// SCRUM-1393e · LA ÚNICA EXCEPCIÓN (decisión del fundador del 21-oct, opción (a)): un CIEGO con
// `causa` «sustituido» (run cancelado con 0 jobs) se ABSUELVE si en la pasada hay un VERDE que lo
// CONTIENE: un descendiente suyo en la línea de primer padre de la punta (`linea`, la lista de
// `git rev-list --first-parent <punta>` que da el workflow; el motor no lee git). El cierre los
// lista como «no verificados, absueltos por el verde de <sha>». Si no hay verde que lo contenga
// pero sí un descendiente CORRIENDO, ESPERA: ni avisa ni reabre (orden del orquestador del 21-oct).
// Sin `linea` no se absuelve nada. Cualquier otro CIEGO sigue como arriba.
//
// SCRUM-1393f · Y EL «SIN RUN» POR SUSTITUCIÓN EN LA COLA (decisión del fundador del 21-oct, «2-A»):
// en `main` el CI no cancela el run en curso (`ci.yml`, `cancel-in-progress`), y el commit nuevo
// sustituye al que espera en la cola, que se queda SIN NINGÚN run. Se absuelve igual que el
// «sustituido», pero sólo si su SUCESOR inmediato en la línea TIENE run (`conRun`): eso es lo que lo
// separa de un «GitHub no disparó», donde el sucesor tampoco lo tiene. Que ese run sea posterior al
// commit no se mira aparte: el sucesor tiene a este por padre, y su run nace de su push.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** SCRUM-1393f · el veredicto viene de un run del CI que existe: los CIEGO con run son el «sustituido» y (SCRUM-1339r) el del meta-guard. */
export const conRun = (v) => !!v && (['VERDE', 'ROJO', 'CORRIENDO'].includes(v.estado) || (v.estado === 'CIEGO' && [CAUSA_SUSTITUIDO, CAUSA_META_GUARD, CAUSA_SENAL].includes(v.causa)));

/** SCRUM-1393f · el CIEGO `sinRun` cuyo sucesor inmediato en `linea` (la punta primero) tiene run. PURO. */
export function sinRunPorSustitucion(v, veredictos, linea) {
  if (!v?.sinRun || v.estado !== 'CIEGO' || !Array.isArray(linea)) return false;
  const p = linea.indexOf(v.sha);
  return p > 0 && conRun(veredictos.find((w) => w.sha === linea[p - 1]));
}

/**
 * Qué CIEGO «sustituido» de la pasada se absuelve y cuál espera, PURO. Un commit que no está en
 * `linea` no contiene ni es contenido por nada. Devuelve `{ absueltos: Map<sha, sha del verde>,
 * enEspera: Set<sha> }`; el verde que absuelve es el MÁS CERCANO de los que lo contienen.
 */
export function absolucionDeSustituidos(veredictos, linea = null) {
  const absueltos = new Map();
  const enEspera = new Set();
  if (!Array.isArray(linea) || !linea.length) return { absueltos, enEspera };
  const pos = new Map(linea.map((s, i) => [s, i]));
  const enLinea = (e) => veredictos.filter((v) => v.estado === e && pos.has(v.sha));
  const verdes = enLinea('VERDE');
  const corriendo = enLinea('CORRIENDO');
  for (const v of veredictos) {
    if (v.estado !== 'CIEGO' || !pos.has(v.sha)) continue;
    // SCRUM-1393f (orden del orquestador del 21-oct, sin reloj): un «sin run» sin NINGÚN posterior
    // de la línea con run (la punta incluida) aún no se juzga: el run puede llegar tarde. ESPERA.
    if (v.sinRun && !veredictos.some((w) => pos.has(w.sha) && pos.get(w.sha) < pos.get(v.sha) && conRun(w))) { enEspera.add(v.sha); continue; }
    if (v.causa !== CAUSA_SUSTITUIDO && !sinRunPorSustitucion(v, veredictos, linea)) continue;
    const p = pos.get(v.sha);
    const contenedores = verdes.filter((w) => pos.get(w.sha) < p).sort((a, b) => pos.get(b.sha) - pos.get(a.sha));
    if (contenedores.length) absueltos.set(v.sha, contenedores[0].sha);
    else if (corriendo.some((w) => pos.get(w.sha) < p)) enEspera.add(v.sha);
  }
  return { absueltos, enEspera };
}

/** La marca de un cierre: los pendientes se cuentan desde la última. */
export const marcaDeCierre = (sha) => `<!-- vigia-de-main:cerrado:${sha} -->`;

/** Los commits que el Issue tiene pendientes (CIEGO o SIN-LEER en su última marca desde el último cierre). */
export function pendientesDelIssue(previos = '') {
  const texto = String(previos);
  const corte = texto.lastIndexOf('<!-- vigia-de-main:cerrado:');
  const ultima = new Map();
  for (const m of texto.slice(corte === -1 ? 0 : corte).matchAll(/<!-- vigia-de-main:([^:\s]+):([A-Z-]+) -->/g)) {
    if (m[1] !== 'cerrado') ultima.set(m[1], m[2]);
  }
  return [...ultima].filter(([, estado]) => estado === 'CIEGO' || estado === 'SIN-LEER').map(([sha]) => sha);
}

/**
 * QUÉ HACER CON EL ISSUE, PURO. `estado` es el del Issue del vigía: 'abierto', 'cerrado' o
 * 'ninguno'. Devuelve `{ pasos, cuerpo, motivo }`; `pasos` es una lista de 'crear', 'reabrir',
 * 'comentar' y 'cerrar', en ese orden de ejecución, y vacía si no hay nada que hacer.
 */
export function accionDelIssue({ veredictos, ahora, origen, urlDelRun, punta, linea = null }, { previos = '', estado = 'ninguno' } = {}) {
  const { absueltos, enEspera } = absolucionDeSustituidos(veredictos, linea);
  // `contexto` (SCRUM-1393e): la punta juzgada sólo para decidir; no se avisa por ella aquí.
  const callados = new Set([...absueltos.keys(), ...enEspera, ...veredictos.filter((v) => v.contexto).map((v) => v.sha)]);
  const aviso = cuerpoDelAviso({ veredictos, ahora, origen, urlDelRun, callados }, previos);
  const deLaPunta = veredictos.find((v) => v.sha === punta);
  const juzgados = new Set(veredictos.filter((v) => v.estado === 'VERDE' || v.estado === 'ROJO').map((v) => v.sha));
  const pendientes = pendientesDelIssue(`${previos}\n${aviso}`).filter((s) => !juzgados.has(s) && !callados.has(s));
  const ciegos = veredictos.filter((v) => (v.estado === 'CIEGO' || v.estado === 'SIN-LEER') && !callados.has(v.sha));
  const espera = (enEspera.size ? ` · ${enEspera.size} CIEGO «sustituido» en espera de su sustituto: ${[...enEspera].map((s) => s.slice(0, 12)).join(', ')}` : '')
    + (absueltos.size ? ` · ${absueltos.size} CIEGO «sustituido» absuelto(s): ${[...absueltos].map(([s, por]) => `${s.slice(0, 12)} por ${por.slice(0, 12)}`).join(', ')}` : '');
  let motivo = null;
  if (!punta) motivo = 'no sé cuál es la punta de main';
  else if (!deLaPunta) motivo = `la punta ${punta.slice(0, 12)} no está en esta pasada`;
  else if (deLaPunta.estado !== 'VERDE') motivo = `la punta ${punta.slice(0, 12)} sale ${deLaPunta.estado}`;
  else if (ciegos.length) motivo = `${ciegos.length} commit(s) CIEGO o SIN-LEER en esta pasada`;
  else if (pendientes.length) motivo = `${pendientes.length} CIEGO pendiente(s) en el Issue: ${pendientes.map((s) => s.slice(0, 12)).join(', ')}`;
  else if (enEspera.size) motivo = 'hay CIEGO «sustituido» en espera';

  if (!motivo) {
    if (estado !== 'abierto') return { pasos: [], cuerpo: '', motivo: 'main verificado y ningún Issue abierto: nada que decir' };
    const recuento = informeDeCommits(veredictos, { ahora, origen }).split('\n').at(-2);
    const sinRun = new Set(veredictos.filter((v) => v.sinRun).map((v) => v.sha));
    const lista = [...absueltos].map(([s, por]) => `- \`${s.slice(0, 12)}\` — no verificado, absuelto por el verde de \`${por.slice(0, 12)}\`${sinRun.has(s) ? ' · SIN run: el siguiente commit le quitó el sitio en la cola' : ''}`);
    const cierre = [
      `**Vigía de main · CERRADO** · ${ahora} · ${origen}`, '',
      `La punta de \`main\`, \`${punta.slice(0, 12)}\`, sale **VERDE** (${deLaPunta.motivo}), sin ningún CIEGO pendiente.`,
      ...(lista.length ? ['', `${lista.length} CIEGO «sustituido» (run cancelado con 0 jobs, o sin run porque el siguiente le quitó el sitio en la cola) no verificados, absueltos por el verde de un commit posterior que los contiene:`, ...lista, ''] : []),
      `Población de esta pasada: ${recuento}.`, `Pasada: ${urlDelRun} ${marcaDeCierre(punta)}`,
    ].join('\n');
    const cuerpo = aviso ? `${aviso}\n\n---\n\n${cierre}` : cierre;
    if (/@claude/i.test(cuerpo)) throw new Error('el cierre del vigía de main contiene la mención que despierta a Claude');
    return { pasos: ['comentar', 'cerrar'], cuerpo, motivo: `se cierra: punta ${punta.slice(0, 12)} VERDE${absueltos.size ? ` · ${absueltos.size} absuelto(s)` : ''}` };
  }
  if (!aviso) return { pasos: [], cuerpo: '', motivo: `sin nada nuevo que avisar; no se cierra: ${motivo}${espera}` };
  const pasos = { ninguno: ['crear'], cerrado: ['reabrir', 'comentar'], abierto: ['comentar'] }[estado];
  if (!pasos) throw new Error(`estado del Issue desconocido: «${estado}»`);
  return { pasos, cuerpo: aviso, motivo: `se avisa; no se cierra: ${motivo}${espera}` };
}

// ── LA LECTURA DE GITHUB (sólo aquí hay red) ─────────────────────────────────────────────────
// Qué `gh` se usa NO se decide mirando en qué máquina corre: se prueban en orden los de `RUTAS_GH`
// (los mismos del ancla, SCRUM-360), aquí y en CI. Uno que no existe (ENOENT) deja paso al
// siguiente; uno que existe y falla NO: eso ya es un fallo de verdad y no se tapa reintentando.
let ghQueResponde = null;
const gh = (ruta) => new Promise((ok, ko) => {
  const probar = (binarios) => {
    const [binario, ...resto] = binarios;
    execFile(binario, ['api', ruta], { maxBuffer: 64 * 1024 * 1024 }, (e, salida) => {
      if (e && e.code === 'ENOENT' && resto.length) return probar(resto);
      if (e) return ko(new Error(`gh api ${ruta}: ${String(e.message).split('\n')[0].slice(0, 160)}`));
      ghQueResponde = binario;
      try { ok(JSON.parse(salida)); } catch { ko(new Error(`gh api ${ruta}: respuesta que no es JSON`)); }
    });
  };
  probar(ghQueResponde ? [ghQueResponde] : [...(process.env.GH_BIN ? [process.env.GH_BIN] : []), ...RUTAS_GH]);
});

const ESTADO_DE = { success: 'success', failure: 'failure', cancelled: 'cancelled', skipped: 'skipped' };

async function leerDeGitHub(jobs) {
  // La lista de obligatorios la lee el ÚNICO lector de la casa (el del vigía de atascados, que
  // `scrum853` protege): devuelve `null` si no pudo leerla, y con `null` `veredicto` sale CIEGO.
  const obligatorios = checksObligatoriosDeReglas(await gh(`repos/${REPO}/rules/branches/main`));
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

// SCRUM-1393c · la lectura del modo por commit. El run es el último del CI por `push` de ESE sha
// en `main`; sus jobs, el último intento. Un fallo de la API deja ese commit en SIN-LEER.
async function leerCommitDeGitHub(sha, idDelCI) {
  const pagina = await gh(`repos/${REPO}/actions/workflows/${idDelCI}/runs?head_sha=${sha}&event=push&branch=main&per_page=20`);
  const run = [...pagina.workflow_runs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  if (!run || run.status !== 'completed') return { run, jobs: null };
  const jobs = (await gh(`repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100&filter=latest`)).jobs;
  // SCRUM-1339r: el 2 del meta-guard sólo está en la anotación del paso que cae (pide `checks: read`).
  // Si no se puede leer, `null`: el veredicto sigue ROJO y lo dice; no se calla ni pasa a verde.
  for (const j of jobs) {
    if (j.name !== JOB_META_GUARD || j.conclusion !== 'failure') continue;
    try { j.codigoDeSalida = codigoDeSalidaDeAnotaciones(await gh(`repos/${REPO}/check-runs/${j.id}/annotations?per_page=100`)); } catch { j.codigoDeSalida = null; }
  }
  // SCRUM-1339u: lo que midió la señal de nombres está en las anotaciones de su job (la misma `checks: read`).
  // Si no se pueden leer, `null`: CIEGO de la señal, que lo dice; no pasa a verde.
  for (const j of jobs) {
    if (j.name !== JOB_DE_LA_SENAL || j.status !== 'completed' || !['success', 'failure'].includes(j.conclusion)) continue;
    try { j.senal = lecturaDeLaSenal(await gh(`repos/${REPO}/check-runs/${j.id}/annotations?per_page=100`)); } catch { j.senal = null; }
  }
  return { run, jobs };
}

/**
 * Desde cuándo mira la red diaria: las 24 h del cron MÁS el retraso de cron medido
 * (`UMBRAL_HORAS_DE_CRON`), para que un cron que llega tarde no deje commits sin mirar.
 */
export const desdeDeLaRed = (ahora = new Date()) => new Date(ahora.getTime() - (24 + UMBRAL_HORAS_DE_CRON) * 3600000).toISOString();

/**
 * SCRUM-1393e · desde cada VERDE o CORRIENDO de `veredictos` que esté en `linea`, baja por sus
 * padres juzgando (`juzgar(sha)` → veredicto, que además lo añade a `veredictos`) mientras salgan
 * CIEGO «sustituido», y para en el primero que no lo sea. Un commit ya juzgado no se vuelve a pedir.
 * SCRUM-1393f: también sigue por un CIEGO `sinRun` si el que acaba de juzgar (su sucesor) tiene run.
 */
export async function bajarPorSustituidos(veredictos, linea, juzgar) {
  const yaJuzgado = (sha) => veredictos.find((v) => v.sha === sha);
  for (const desde of veredictos.filter((v) => v.estado === 'VERDE' || v.estado === 'CORRIENDO').map((v) => v.sha)) {
    let sucesor = yaJuzgado(desde);
    for (let i = linea.indexOf(desde) + 1; i > 0 && i < linea.length; i += 1) {
      const v = yaJuzgado(linea[i]) ?? await juzgar(linea[i]);
      if (v.estado !== 'CIEGO') break;
      if (v.causa !== CAUSA_SUSTITUIDO && !(v.sinRun && conRun(sucesor))) break;
      sucesor = v;
    }
  }
}

/**
 * SCRUM-1393f · un CIEGO `sinRun` de la pasada (p. ej. un pendiente del Issue) cuyo sucesor en `linea`
 * no está juzgado: se juzga el sucesor, como CONTEXTO (decide, pero no se avisa por él), porque sin
 * él no se sabe si lo sustituyeron en la cola. Un commit fuera de la línea, o la punta, no tiene.
 */
export async function juzgarSucesoresDeSinRun(veredictos, linea, juzgar) {
  for (const v of veredictos.filter((x) => x.sinRun && x.estado === 'CIEGO')) {
    const p = linea.indexOf(v.sha);
    if (p > 0 && !veredictos.some((w) => w.sha === linea[p - 1])) (await juzgar(linea[p - 1])).contexto = true;
  }
}

async function modoPorCommit(args, opcion) {
  const suelo = sueloPorCommit();
  console.log(suelo.detalle);
  const ciego = (motivo) => { console.log(`POBLACION commits=0 · ${motivo}`); console.log(`CIEGO — ${motivo}`); console.log(`EXIT=${SALIDA_CIEGO}`); return SALIDA_CIEGO; };
  if (!suelo.ok) return ciego('el vigía no reconoce sus cebos: esta pasada no puede afirmar nada');

  let topeMin = null;
  try { topeMin = topeDeCorridaDelCI(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows', 'ci.yml'), 'utf8')); } catch { /* queda null: un run sin acabar sale SIN-LEER */ }

  // `--commit <sha>`: el (C), un commit. `--commits <fichero>`: el (B), un sha por línea. La lista
  // la saca quien llama (`git log --first-parent --since=<desdeDeLaRed>`): este motor no lee git.
  let shas;
  let origen;
  if (args.includes('--commit')) {
    shas = [opcion('--commit')];
    origen = `GitHub ${REPO} · un commit`;
  } else {
    try { shas = readFileSync(opcion('--commits'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean); } catch (e) { return ciego(`no pude leer la lista de commits: ${e.message}`); }
    origen = `GitHub ${REPO} · ${shas.length} commits de ${opcion('--commits')}`;
  }
  const malo = shas.find((s) => !/^[0-9a-f]{40}$/.test(s ?? ''));
  if (malo !== undefined) return ciego(`cada commit va con su sha COMPLETO (40 hex); llegó «${malo}»`);

  let idDelCI;
  try {
    idDelCI = (await gh(`repos/${REPO}/actions/workflows?per_page=100`)).workflows.find((w) => w.name === 'CI')?.id;
  } catch (e) { return ciego(e.message); }
  if (!idDelCI) return ciego('no encuentro el workflow «CI»');

  const ahora = new Date().toISOString();
  const veredictos = [];
  const juzgar = async (sha) => {
    try {
      veredictos.push(veredictoDeCommit({ sha, ...(await leerCommitDeGitHub(sha, idDelCI)), ahora, topeMin }));
    } catch (e) {
      veredictos.push({ sha, estado: 'SIN-LEER', motivo: e.message, url: null, jobs: [], causa: null });
    }
    return veredictos.at(-1);
  };
  for (const sha of [...new Set(shas)]) await juzgar(sha);
  // SCRUM-1393e · `--contexto <sha>`: la punta, juzgada para decidir el cierre y la espera, pero sin
  // aviso propio si no venía en la lista (la juzga su propio CI, y la red diaria). Medido el 21-oct:
  // un merge de las 13:56:26Z seguía SIN run del CI a las 14:04Z; avisarlo sería un CIEGO falso.
  const contexto = opcion('--contexto');
  if (contexto && !veredictos.some((v) => v.sha === contexto)) {
    if (!/^[0-9a-f]{40}$/.test(contexto)) return ciego(`el contexto va con su sha COMPLETO (40 hex); llegó «${contexto}»`);
    (await juzgar(contexto)).contexto = true;
  }

  // SCRUM-1393e: desde cada VERDE o CORRIENDO que esté en la `linea`, se baja por sus padres
  // juzgando mientras salgan CIEGO «sustituido»: son los commits a los que ese run sustituyó, y
  // sin juzgarlos el cierre no podría listarlos. Para en el primero que no lo sea.
  let linea = null;
  if (opcion('--linea')) {
    try { linea = readFileSync(opcion('--linea'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean); } catch (e) { return ciego(`no pude leer la línea de primer padre: ${e.message}`); }
    await bajarPorSustituidos(veredictos, linea, juzgar);
    await juzgarSucesoresDeSinRun(veredictos, linea, juzgar);
    origen += ` · línea de primer padre de ${linea.length} commits`;
  }
  console.log(informeDeCommits(veredictos, { ahora, origen }));
  const json = opcion('--json');
  if (json) writeFileSync(json, JSON.stringify({ ahora, origen, salida: salidaDeCommits(veredictos), veredictos }, null, 2));
  return salidaDeCommits(veredictos);
}

async function principal() {
  const args = process.argv.slice(2);
  const opcion = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
  if (args.includes('--desde-de-la-red')) { console.log(desdeDeLaRed()); return SALIDA_OK; }
  // SCRUM-1393e · `--pendientes <fichero>`: los commits que el Issue tiene pendientes, uno por línea,
  // para que el workflow los vuelva a juzgar con el dato de GitHub (sus marcas no llevan la causa).
  if (args.includes('--pendientes')) {
    for (const sha of pendientesDelIssue(readFileSync(opcion('--pendientes'), 'utf8'))) console.log(sha);
    return SALIDA_OK;
  }
  // SCRUM-1393d · `--accion-del-issue <vigia.json> --punta <sha> --estado-issue <abierto|cerrado|ninguno>
  // --previos <fichero> --cuerpo <fichero>`: escribe el cuerpo y dice los pasos en `PASOS=`. Sin red.
  if (args.includes('--accion-del-issue')) {
    const j = JSON.parse(readFileSync(opcion('--accion-del-issue'), 'utf8'));
    const previos = opcion('--previos') ? readFileSync(opcion('--previos'), 'utf8') : '';
    // SCRUM-1393e: `--linea <fichero>` (un sha por línea, de `git rev-list --first-parent <punta>`).
    const linea = opcion('--linea') ? readFileSync(opcion('--linea'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : null;
    const a = accionDelIssue({ ...j, urlDelRun: process.env.URL_RUN ?? null, punta: opcion('--punta'), linea }, { previos, estado: opcion('--estado-issue') });
    writeFileSync(opcion('--cuerpo'), a.cuerpo);
    console.log(a.motivo);
    console.log(`PASOS=${a.pasos.join(',')}`);
    return SALIDA_OK;
  }
  if (args.includes('--commit') || args.includes('--commits')) return modoPorCommit(args, opcion);

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
    origen = `GitHub ${REPO} · obligatorios: ${leido.obligatorios ? leido.obligatorios.join(', ') : '(no leídos)'} · main en ${leido.commits[0]}`;
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
