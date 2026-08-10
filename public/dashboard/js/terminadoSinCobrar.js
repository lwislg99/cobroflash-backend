// public/dashboard/js/terminadoSinCobrar.js — SCRUM-428
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// «TERMINADO Y SIN COBRAR» — el cruce que el producto no sabía nombrar
//
// Los dos ejes existían por separado desde hace tiempo y **no se cruzaban en ninguna parte**:
//
//   · el estado del Trabajo   → `job.status === 'terminado'`      (`job.service.ts:9`)
//   · el semáforo de cobro    → `job.estadoCobro`                 (`job.service.ts:333`)
//
// Los dos VIAJAN YA en cada fila de `GET /admin/jobs` (`jobs.routes.ts:263` y `:272`), junto con
// `totalCobrado` e `importeReferencia`. Lo que no existía era la pregunta: en `src/` el literal
// `'terminado'` aparece 5 veces y **ninguna es una consulta**. Por eso este fichero no calcula
// dinero nuevo — sólo cruza lo que ya está servido.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 «NO SE SABE» NO ES «CERO», Y NO SE SUMA
//
// Un Trabajo terminado puede no tener eje de cobro: sin importe aceptado ni facturado,
// `estadoCobro` vale `null` a propósito —«no pintar nada es verdad; pintar Parcial no lo es»
// (`job.service.ts:326-331`)—. Ese Trabajo **no entra en el importe ni en el recuento**: se
// cuenta aparte, en `sinImporte`.
//
// Meterlo como 0 € haría parecer que no debe nada; tomar su `totalCobrado` como referencia haría
// parecer que está pagado. Las dos mienten, y en direcciones opuestas. Es la misma decisión que
// el fundador fijó para los gastos sin base imponible: se EXCLUYE y SE DICE.

/**
 * Número seguro. Un importe ilegible es `null` —desconocido—, nunca 0.
 *
 * ⚠️ Se llama `importeODesconocido` y no `num` porque `num` YA es una global de
 * `jobCobroHuecos.js:25`: estos ficheros se cargan como <script> clásicos y comparten el nivel
 * superior, así que redeclararlo es SyntaxError EN PARSEO — este fichero no se ejecutaría entero
 * y la pantalla desaparecería sin un 500 ni una línea de log. Lo cazó el guard de colisión.
 *
 * 🔴 El `null` y la cadena vacía se descartan ANTES de `Number()`: `Number(null)` y `Number('')`
 * valen **0**, que es finito, así que la comprobación de abajo los habría dado por buenos y un
 * importe ausente habría entrado en la suma como «no debe nada». Lo cazó el test de este ticket.
 */
function importeODesconocido(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Los estados de cobro que significan «queda dinero por cobrar».
 *
 * `Parcial` entra: un Trabajo cobrado a medias tiene dinero pendiente igual que uno sin cobrar
 * nada, y dejarlo fuera escondería justo los que ya empezaron a pagarse y se quedaron a mitad —
 * que son los que más se olvidan. `Pagado` no entra, y `null` tampoco (no se sabe).
 */
const ESTADOS_CON_DEUDA = ['Pendiente', 'Parcial'];

/** ¿Este Trabajo está terminado y con dinero pendiente? */
function esTerminadoSinCobrar(job) {
  if (!job || job.status !== 'terminado') return false;
  return ESTADOS_CON_DEUDA.indexOf(job.estadoCobro) !== -1;
}

/**
 * Cuánto falta por cobrar de UN Trabajo, o `null` si no se puede saber.
 *
 * ⚠️ `null` cuando no hay eje (`importeReferencia`): sin referencia no hay resta posible, y
 * devolver 0 sería afirmar que no debe nada.
 */
function faltaPorCobrarDe(job) {
  const referencia = importeODesconocido(job && job.importeReferencia);
  if (referencia === null) return null;
  const cobrado = importeODesconocido(job && job.totalCobrado) || 0;
  return Math.max(0, referencia - cobrado);
}

/**
 * El resumen de la lista. Devuelve SIEMPRE las tres cifras, y la tercera es la que impide que
 * las dos primeras se lean como si lo contaran todo.
 *
 * @returns {{cuantos:number, importe:number, sinImporte:number}}
 *   · `cuantos`    Trabajos terminados con dinero pendiente y con importe conocido
 *   · `importe`    la suma de lo que falta por cobrar de ésos
 *   · `sinImporte` terminados de los que NO se sabe cuánto falta (sin eje de cobro)
 */
function resumenTerminadoSinCobrar(jobs) {
  const lista = Array.isArray(jobs) ? jobs : [];
  let cuantos = 0;
  let importe = 0;
  let sinImporte = 0;

  for (const j of lista) {
    if (!j || j.status !== 'terminado') continue;
    if (j.estadoCobro == null) { sinImporte++; continue; }
    if (!esTerminadoSinCobrar(j)) continue;
    const falta = faltaPorCobrarDe(j);
    // Terminado, con deuda declarada, y sin importe legible: tampoco se inventa.
    if (falta === null) { sinImporte++; continue; }
    cuantos++;
    importe += falta;
  }

  return { cuantos, importe, sinImporte };
}

if (typeof window !== 'undefined') {
  window.esTerminadoSinCobrar = esTerminadoSinCobrar;
  window.faltaPorCobrarDe = faltaPorCobrarDe;
  window.resumenTerminadoSinCobrar = resumenTerminadoSinCobrar;
  window.ESTADOS_CON_DEUDA = ESTADOS_CON_DEUDA;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { esTerminadoSinCobrar, faltaPorCobrarDe, resumenTerminadoSinCobrar, ESTADOS_CON_DEUDA };
}
