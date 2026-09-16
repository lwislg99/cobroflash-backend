// scripts/ci-de-la-rama.mjs — SCRUM-618 · LEER EL CI DESDE UNA SESIÓN, SIN CREDENCIALES.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA PREMISA DEL TICKET ERA FALSA, Y ESO ES TODO EL ARREGLO.
//
// SCRUM-618 dice, el 24-ago-2026: «El repositorio es privado, así que tampoco se alcanza por
// web». De ahí salía el resto — las dos vueltas, el fundador copiando logs a mano, y la frase
// que da título al ticket: «un CI que nunca se ha visto rojo no se distingue de uno que no
// vigila nada».
//
// MEDIDO el 15-sep-2026 contra la API pública, sin credenciales de ningún tipo:
//
//     GET /repos/lwislg99/cobroflash-backend   →   "private": false, "visibility": "public"
//
// El repositorio es PÚBLICO. Lo dice además el propio árbol sin que nadie lo relacionara: el
// comentario de SCRUM-836 del 9-sep razona que «hoy la CI cuesta 0 € porque Actions es gratis en
// repositorios públicos» y habla de «el día que el repositorio pase a privado». Las dos
// afirmaciones llevaban tres semanas conviviendo y sólo una podía ser cierta.
//
//   >>> No hacía falta un token, ni un artefacto, ni un procedimiento: hacía falta MIRAR. <<<
//
// ── QUÉ SE PUEDE LEER, MEDIDO ENDPOINT A ENDPOINT (no supuesto) ────────────────────────────
//
//   ✅ los runs y su conclusión global
//   ✅ el veredicto POR JOB —que es lo que pedía el caso de SCRUM-617, no el global—
//   ✅ los tiempos de cada job (`started_at` / `completed_at`): la curva que apunta a la causa
//   ✅ el ENTORNO: `runner_name` y `labels` (ubuntu-latest), y si el runner venía frío
//   ✅ el STEP exacto que falló, con su número
//   ✅ las ANOTACIONES del check: nivel, mensaje y código de salida
//   🔴 los LOGS completos: **403 sin autenticar**. Es el único hueco y va declarado abajo.
//
// ── EL COSTE, TAMBIÉN MEDIDO ───────────────────────────────────────────────────────────────
// API anónima: **60 peticiones/hora** (`/rate_limit`, `limit: 60`). Un diagnóstico completo
// gasta 3–4, así que caben ~15 por hora. No hay credencial que pedir ni que guardar, y por tanto
// tampoco entra en la regla de credenciales que el ticket marcaba como decisión del fundador.
//
// ── POR QUÉ ESTO NO VIVE EN `npm test` ─────────────────────────────────────────────────────
// Hace RED. La tanda no puede depender de que GitHub conteste, igual que `censo:alcanzabilidad`
// vive fuera por hacer `fetch`. La red que SÍ corre siempre es
// `tests/scrum618-leer-el-ci.test.mjs`, que ejercita el LECTOR contra respuestas fijas y no toca
// la red.
//
// ⛔ LO QUE NO HACE, Y ES DELIBERADO: no abre PRs, no escribe, no mergea, no instala `gh` y no
// maneja ninguna credencial. Sólo LEE, que es exactamente lo que el ticket pedía medir.
//
// SALIDAS: 0 = leído, sin rojos · 1 = leído, HAY rojo · 2 = no supe medir (CIEGO).
// ═══════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';

export const SALIDA_OK = 0;
export const SALIDA_ROJO = 1;
export const SALIDA_CIEGO = 2;

const REPO = 'lwislg99/cobroflash-backend';
const API = `https://api.github.com/repos/${REPO}`;

/**
 * 🔴 EL HUECO, DECLARADO Y NO ESCONDIDO: el texto del log NO se puede leer sin autenticar.
 *
 * `GET /actions/jobs/<id>/logs` devuelve **403** anónimo — medido, no supuesto. Lo que sí llega
 * es la ANOTACIÓN del check, que trae el mensaje y el código de salida. Para el caso que abrió
 * este ticket eso habría bastado (`exit code 2` en el meta-guard ES su «CIEGO»), pero no siempre:
 * un `AssertionError` con su diff vive en el log y ahí no llegamos.
 *
 * CÓMO SE CIERRA SIN CREDENCIALES, si algún día molesta: un job que quiera ser diagnosticable
 * desde fuera **emite su veredicto como anotación** (`::error::…` en su salida), que es público.
 * Es la salida (2) que el ticket ya contemplaba —«que el workflow escriba su resultado»— y sale
 * gratis. Queda PROPUESTA, no aplicada: tocar los workflows no es lo que este ticket pedía.
 */
export const LOGS_REQUIEREN_AUTENTICACION = true;

/** La rama actual, para no tener que teclearla. */
export function ramaActual(cwd = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch { return null; }
}

async function traer(url) {
  const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'yaqu-ci-de-la-rama' } });
  if (!r.ok) return { error: `${r.status} ${r.statusText}`, url };
  return { datos: await r.json() };
}

/** Segundos entre dos ISO, o `null` si el job no ha terminado. */
export function duracion(job) {
  if (!job?.started_at || !job?.completed_at) return null;
  return Math.round((Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000);
}

/**
 * El veredicto de un run, a partir de sus jobs. Función PURA: es lo que el test ejercita sin red.
 *
 * `conclusion` puede ser null (en marcha), y eso NO es «verde»: es «todavía no se sabe». Se
 * separan los tres cubos a propósito — mezclar «en marcha» con «bien» es cómo se lee un CI a
 * medias como un CI aprobado.
 */
export function veredictoDeJobs(jobs) {
  const filas = (jobs || []).map((j) => ({
    id: j.id,
    nombre: j.name,
    conclusion: j.conclusion,
    estado: j.status,
    segundos: duracion(j),
    runner: j.runner_name || null,
    etiquetas: (j.labels || []).join(','),
    pasoQueFalla: (j.steps || []).find((s) => s.conclusion === 'failure') || null,
  }));
  return {
    filas,
    rojos: filas.filter((f) => f.conclusion === 'failure'),
    // ⚠️ `f.estado`, no `f.status`: la fila renombra el campo. Con `f.status` el filtro comparaba
    // `undefined !== 'completed'` y daba TODOS los jobs como «en marcha» — un cubo que se llena
    // siempre no separa nada. Lo cazó el control de aquí al lado, que es para lo que está.
    enMarcha: filas.filter((f) => f.estado !== 'completed'),
    verdes: filas.filter((f) => f.conclusion === 'success'),
  };
}

async function principal() {
  const rama = process.argv[2] || ramaActual();
  if (!rama) {
    console.error('🔴 CIEGO · no sé sobre qué rama mirar y `git` no me la ha sabido decir.');
    process.exit(SALIDA_CIEGO);
  }
  console.log(`CI de la rama \`${rama}\` · repositorio PÚBLICO, lectura anónima (sin credenciales)\n`);

  const runs = await traer(`${API}/actions/runs?branch=${encodeURIComponent(rama)}&per_page=20`);
  if (runs.error) {
    console.error(`🔴 CIEGO · no he podido leer los runs: ${runs.error}`);
    console.error('  Si es 404, la rama no está empujada. Si es 403, se ha agotado el límite');
    console.error('  anónimo (60/h): espera al reset en vez de buscar una credencial.');
    process.exit(SALIDA_CIEGO);
  }

  // 🔴 SUELO. Cero runs NO es «el CI está bien»: es que no se ha mirado nada, y las dos cosas se
  // leen igual. Es el mismo suelo que esta casa le exige a todos sus censos.
  const lista = runs.datos.workflow_runs || [];
  if (!lista.length) {
    console.error(`🔴 CIEGO · CERO runs para la rama \`${rama}\`.`);
    console.error('  Vacío y no-medido se leen igual y significan lo contrario: puede que la rama');
    console.error('  no esté empujada, o que su nombre no sea el que CI ve.');
    process.exit(SALIDA_CIEGO);
  }

  let hayRojo = false;
  for (const run of lista.slice(0, 6)) {
    const jobs = await traer(`${API}/actions/runs/${run.id}/jobs`);
    const v = jobs.error ? null : veredictoDeJobs(jobs.datos.jobs);
    const estado = run.conclusion || `(${run.status})`;
    console.log(`── ${run.name} · ${estado} · ${run.created_at}`);
    if (!v) { console.log(`   ⚠️ no he podido leer sus jobs: ${jobs.error}`); continue; }
    for (const f of v.filas) {
      const marca = f.conclusion === 'failure' ? '🔴' : f.conclusion === 'success' ? '✔ ' : '… ';
      console.log(`   ${marca} ${f.nombre}  ${f.segundos == null ? '(en marcha)' : `${f.segundos}s`}`
        + `  [${f.etiquetas}${f.runner ? ` · ${f.runner}` : ''}]`);
      if (f.pasoQueFalla) console.log(`        step ${f.pasoQueFalla.number}: ${f.pasoQueFalla.name}`);
    }
    if (v.rojos.length) {
      hayRojo = true;
      for (const r of v.rojos) {
        if (!r.id) continue;
        // El texto del log es 403, pero la ANOTACIÓN del check sí es pública y trae el mensaje.
        const an = await traer(`${API}/check-runs/${r.id}/annotations`);
        if (an.error) { console.log(`        (sin anotaciones legibles: ${an.error})`); continue; }
        for (const a of an.datos) console.log(`        ${a.annotation_level}: ${a.message}`);
      }
    }
  }
  console.log('\n⚠️ El TEXTO del log no se puede leer sin autenticar (403 anónimo). Lo que hay');
  console.log('   arriba —job, tiempos, entorno, step y anotación— es lo que sí llega.');
  process.exit(hayRojo ? SALIDA_ROJO : SALIDA_OK);
}

// La puerta, con la lección de SCRUM-765: `pathToFileURL(argv[1])`, no comparaciones de cadena.
if (import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] || '').href) {
  await principal();
}
