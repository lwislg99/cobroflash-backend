// scripts/_navegador.mjs — SCRUM-522
//
// DÓNDE ESTÁ EL NAVEGADOR, para que los guards puedan correr en CI y no sólo en el portátil.
//
// ── POR QUÉ HACÍA FALTA ──────────────────────────────────────────────────────────────────────
// Los nueve guards de navegador llevaban la MISMA línea, byte a byte:
//
//     const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/…/msedge.exe';
//
// Una ruta de Windows como valor por defecto. En el runner de CI —Ubuntu— eso no existe, así que
// los nueve figuraban como cobertura y no podían ejecutarse donde de verdad hacía falta.
//
// ── LO QUE ESTO NO HACE ──────────────────────────────────────────────────────────────────────
// 🔴 NO relaja nada, y ésa es la diferencia entre resolver y esconder: si no encuentra ningún
//    navegador, NO devuelve una ruta plausible ni deja que el guard siga. Cada guard conserva su
//    propia comprobación de ceguera, y aquí, si no hay ninguno, se falla NOMBRANDO los sitios en
//    los que se ha mirado.
// 🔴 Y si `EDGE_PATH` está puesta pero apunta a algo que no existe, NO se cae hacia atrás a un
//    candidato. Alguien la puso a propósito: taparlo con otro navegador es medir en un sitio
//    distinto del que se pidió, y el informe diría lo que no es.
//
// ── EL ORDEN DE LOS CANDIDATOS ES DELIBERADO ─────────────────────────────────────────────────
// Edge primero, porque es sobre el que se midió todo lo que hay escrito en la casa. Chrome y
// Chromium después: comparten motor, así que un veredicto suyo vale, pero conviene saber cuál
// contestó — por eso `rutaDelNavegador` devuelve también QUIÉN es.
// Comprobado el 20-ago-2026 en la documentación de la imagen `ubuntu-latest`: trae Edge, Chrome
// y Chromium preinstalados.
import fs from 'node:fs';

/** Dónde se mira, en orden. Cada entrada dice de quién es, para poder decirlo en el informe. */
export const CANDIDATOS = [
  { quien: 'Edge (Windows)', ruta: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' },
  { quien: 'Edge (Windows, 64)', ruta: 'C:/Program Files/Microsoft/Edge/Application/msedge.exe' },
  { quien: 'Edge (Linux)', ruta: '/usr/bin/microsoft-edge' },
  { quien: 'Edge (Linux, stable)', ruta: '/usr/bin/microsoft-edge-stable' },
  { quien: 'Edge (macOS)', ruta: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
  { quien: 'Chrome (Linux)', ruta: '/usr/bin/google-chrome' },
  { quien: 'Chrome (Linux, stable)', ruta: '/usr/bin/google-chrome-stable' },
  { quien: 'Chromium (Linux)', ruta: '/usr/bin/chromium' },
  { quien: 'Chromium (Linux, browser)', ruta: '/usr/bin/chromium-browser' },
];

/**
 * Resuelve el ejecutable. Devuelve `{ ok, ruta, quien, motivo }` — no lanza, para que quien
 * llama decida cómo cantarlo.
 *
 * `existe` se inyecta para poder probar la decisión sin depender de qué haya instalado en la
 * máquina que corre los tests: sin eso, este resolutor sólo se ejercitaría en un sistema
 * operativo y las otras ramas no las miraría nadie.
 */
export function resolverNavegador(env = process.env, existe = fs.existsSync) {
  const pedido = env.EDGE_PATH;
  if (pedido) {
    return existe(pedido)
      ? { ok: true, ruta: pedido, quien: 'EDGE_PATH' }
      : { ok: false, motivo: 'EDGE_PATH apunta a `' + pedido + '` y ahí no hay nada. No se busca otro: '
          + 'si alguien la puso, medir en otro navegador sería medir otra cosa.' };
  }
  for (const c of CANDIDATOS) if (existe(c.ruta)) return { ok: true, ruta: c.ruta, quien: c.quien };
  return {
    ok: false,
    motivo: 'no hay navegador en ninguno de los ' + CANDIDATOS.length + ' sitios conocidos:\n'
      + CANDIDATOS.map((c) => '        · ' + c.ruta + '   (' + c.quien + ')').join('\n')
      + '\n      Pon `EDGE_PATH` apuntando al tuyo.',
  };
}

/**
 * La ruta, o se para. Es lo que usan los guards: un guard que no encuentra navegador NO puede
 * seguir y NO puede pasar — «no hay defectos» y «no supe mirar» son el mismo verde.
 */
export function rutaDelNavegador() {
  const r = resolverNavegador();
  if (r.ok) return r.ruta;
  console.error('🔴 NO SUPE MIRAR: ' + r.motivo);
  process.exit(SALIDA_NO_ENCONTRADO);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-522 (24-ago-2026) · «ENCONTRAR EL NAVEGADOR» Y «PODER ARRANCARLO» SON DOS COSAS
//
// El primer arreglo de este ticket resolvió LA RUTA, y el runner de CI siguió en rojo: encuentra
// Edge, lo lanza, y MUERE DESPUÉS — en el sandbox SUID de Chromium. O sea que el módulo cubría el
// paso anterior al que hacía falta.
//
// Y el diagnóstico se perdía por el camino: `guard-contraste` salía con **1** cuando no podía
// arrancar, que es el MISMO código con el que sale cuando encuentra defectos de contraste de
// verdad. La puerta lo pintaba como `rojo(1)`, indistinguible de un hallazgo real. Encima su
// mensaje aconsejaba «ajusta EDGE_PATH», que es el consejo del problema ANTERIOR: la ruta estaba
// bien. Por eso aquí hay TRES desenlaces con TRES códigos, y no dos:
//
//     0 · midió
//     2 · NO SUPE MIRAR — no hay navegador en ningún sitio conocido
//     3 · NO PUDE ARRANCARLO — lo hay, y no levanta
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** No hay navegador donde mirar. */
export const SALIDA_NO_ENCONTRADO = 2;
/** Lo hay, y no arranca. Distinto de 2 y distinto de «he encontrado defectos» (1). */
export const SALIDA_NO_ARRANCA = 3;

/**
 * Los argumentos de AISLAMIENTO, y sólo en CI.
 *
 * 🔴 NUNCA POR DEFECTO NI EN LOCAL. `--no-sandbox` relaja el aislamiento del navegador, y puesto
 * de forma global es un cambio que nadie pidió y que no se nota. Aquí va condicionado a `CI`,
 * que GitHub Actions pone siempre, y el motivo es del ENTORNO, no de la medición:
 *
 *   · en el runner, el helper SUID de Chromium viene sin `root:root` + `4755` y el navegador
 *     ABORTA a propósito antes de arrancar sin aislamiento — es el fallo exacto que trajo este
 *     ticket de vuelta;
 *   · lo que estos guards cargan son NUESTRAS páginas estáticas servidas desde el propio
 *     proceso, en una máquina efímera que se destruye al terminar el job. El sandbox protege
 *     de contenido web ajeno, y aquí no hay ninguno;
 *   · y no toca NADA de lo que se mide: contraste, maquetado y árbol de accesibilidad son
 *     idénticos con sandbox y sin él.
 *
 * La alternativa era `chown root:root` + `chmod 4755` sobre el helper en el workflow, que es lo
 * que pide el propio error. Se descartó con motivo: esa ruta es de Edge, y `resolverNavegador`
 * puede contestar Chrome o Chromium según lo que traiga la imagen — el `chmod` quedaría
 * apuntando a un binario que no es el que se usa, y **no fallaría: no haría nada**. Un arreglo
 * que se apaga solo cuando cambia la imagen es el defecto que este ticket persigue.
 */
export function argsDeAislamiento(env = process.env) {
  return env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-617 (2ª vuelta) · EL TOPE DE ARRANQUE, Y POR QUÉ VIVE AQUÍ Y NO EN UN GUARD
//
// En el runner, `guard-contraste` murió con «Timed out after 30000 ms while waiting for the WS
// endpoint URL to appear in stdout». Los 30 000 ms no los pusimos nosotros: es el DEFECTO de
// puppeteer. Ponerlo aquí no lo sube — lo hace VISIBLE y ajustable desde un solo sitio.
//
// 🛑 EL VALOR POR DEFECTO NO CAMBIA (30 000). Subir el número «a ver si cuela» sería comprar el
// verde sin saber por qué; y si la causa resulta ser el arranque en frío, el arreglo honesto es
// declararlo, no agrandar el tope en silencio. Se sube por entorno SÓLO PARA MEDIR.
//
// ⚠️ Y NO HAY REINTENTOS, ni los va a haber: un guard que reintenta hasta que le sale bien es un
// guard que ya no puede decir que algo está roto.
// ─────────────────────────────────────────────────────────────────────────────────────────────
export const TOPE_ARRANQUE_POR_DEFECTO = 30_000;

/** El tope efectivo. `NAVEGADOR_TIMEOUT_MS` lo sube SOLO para medir; por defecto, el de siempre. */
export function topeDeArranque(env = process.env) {
  const n = Number(env.NAVEGADOR_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : TOPE_ARRANQUE_POR_DEFECTO;
}

/**
 * Marca que la PUERTA lee para poder enseñar el tiempo de ARRANQUE de los nueve, no sólo del que
 * falla. Hacía falta: el total de cada guard mezcla arrancar y comprobar, y con un solo número no
 * se puede saber cuál de las dos cosas se disparó. La marca va a stderr para no ensuciar ninguna
 * salida que alguien pudiera estar parseando.
 *
 * 🔴 EL FORMATO EMPIEZA POR «⟦arranque⟧ <número>» Y ESO NO ES ESTÉTICA. `guards-visuales.mjs` lo
 * extrae con `new RegExp(MARCA_ARRANQUE + ' ([0-9.]+)')`. Si el total deja de ir pegado a la
 * marca, la puerta no falla: se queda sin número y pinta «(arranque: ?)» para los nueve. Lo que
 * venga DESPUÉS del total es libre; lo de antes, no.
 */
export const MARCA_ARRANQUE = '⟦arranque⟧';

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-642 · LA MARCA REPETÍA, UN NIVEL MÁS ABAJO, EL PROBLEMA QUE VINO A RESOLVER
//
// La marca nació (arriba) para separar «arrancar» de «comprobar», porque un solo número para dos
// cosas no dice cuál se disparó. Pero «arrancar» TAMPOCO es una cosa: medido en el fuente de
// puppeteer 25.3.0 (`node_modules/puppeteer-core/src/node/BrowserLauncher.ts`), `launch()` son
// CINCO tramos, y el tope NO es un vigilante sobre el conjunto — es un presupuesto POR FASE que
// se gasta DOS VECES, sobre PARTE del recorrido:
//
//     computeLaunchArguments (:135) ......................... ❌ sin presupuesto
//     launch({...}) — arrancar el proceso (:164) ............ ❌ sin presupuesto
//     waitForLineOutput(…, opts.timeout) (:382) ............. ✅ presupuesto ENTERO
//     WebSocketTransport + Connection + Browser (:386-393) .. ❌ sin presupuesto
//     waitForPageTarget → waitForTarget (:291, :362) ........ ✅ OTRO presupuesto entero
//
// De ahí que un arranque de 39,2 s sobreviviera a un tope de 30 s sin que nada estuviera roto:
// ningún tramo vigilado pasó de 30. No era un defecto del tope; era aritmética que el número
// único no dejaba ver.
//
// ── POR QUÉ SE PARTE EN DOS Y NO EN CINCO ────────────────────────────────────────────────────
// Porque partirlo en cinco exige llamar a `@puppeteer/browsers` y a `puppeteer.connect()` por
// separado, o sea REIMPLEMENTAR `launch()`: perfil temporal, limpieza, viewport, manejo de
// señales. Y entonces lo que se mediría sería NUESTRO arranque, no el de puppeteer — números
// incomparables con las muestras ya tomadas, que es justo lo contrario de lo que hace falta.
// El corte de aquí usa SÓLO opciones documentadas y ejecuta lo mismo en el mismo orden:
// `waitForInitialPage: false` + la misma espera que puppeteer hace en :291, con el mismo tope y
// cerrando igual si falla (:363).
//
// 🕳️ HUECO DECLARADO, y se dice en vez de disimularlo: dentro de `proceso+ws` siguen juntas la
// fase 1 PRESUPUESTADA y los tramos sin presupuesto que la rodean. Medido con `timeout: 1`, el
// trozo previo (argumentos + spawn) costó 0,03 s en local el 2-sep-2026 — o sea que ahí dentro
// manda la espera del WS endpoint. En el runner ese reparto NO está medido.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Arrancar el proceso y esperar a que anuncie el WS endpoint. Contiene la fase 1 con tope. */
const TRAMO_PROCESO = 'proceso+ws';
/** La espera de la primera página: `waitForTarget`, la fase 2, con su PROPIO tope entero. */
const TRAMO_PAGINA = 'primera-página';

const seg = (ms) => (ms / 1000).toFixed(1);

/**
 * Arranca el navegador, o PARA con el código que corresponde.
 *
 * `puppeteer` se recibe en vez de importarse: este módulo lo usan guards que ya lo tienen
 * cargado, y así se puede ejercitar el desenlace de «no arranca» con un doble, sin navegador.
 */
/**
 * 🔴 SCRUM-673 · CUANTAS VECES SE INTENTA ARRANCAR ANTES DE DAR UN VEREDICTO.
 *
 * TRES, y el numero sale de lo MEDIDO, no de una corazonada. El mismo guard, el mismo binario y la
 * misma maquina arrancaron en 0,3 s, en 12,9 s y en 38,2 s en tiradas distintas. Eso no es el
 * navegador: es la carga del runner. Un tope fijo por debajo de 38,2 convierte una maquina cargada
 * en un veredicto, y subirlo a 60.000 es cambiar un numero por otro y esperar que el runner no
 * vuelva a ir lento — la cura que SCRUM-520 ya rechazo.
 *
 * Lo que cambia aqui no es el tope: es que UN ARRANQUE LENTO YA NO PRODUCE VEREDICTO. Solo lo
 * produce que TODOS los intentos fallen, y entonces el veredicto es rojo diciendo NO MEDIDO.
 */
export const INTENTOS_DE_ARRANQUE = 3;

/**
 * El tope de CADA intento, creciente. El primero con el tope de siempre —para no alargar la tanda
 * feliz, que es la mayoria—, y los siguientes con mas margen: la evidencia dice que cuando el
 * runner va cargado no va «un poco» mas lento, va MUCHO mas lento (0,3 → 38,2 s es x127).
 *
 * Con 30 s de base la escalera cubre 30/60/90 s, o sea muy por encima del 38,2 que la propia
 * maquina demostro sano. Y el peor caso esta ACOTADO: si nada arranca, se para en 180 s y se dice.
 */
export function topeDelIntento(n, base = topeDeArranque()) {
  return base * n;
}

export async function lanzarNavegador(puppeteer, opciones = {}) {
  const ruta = rutaDelNavegador(); // sale con 2 si no hay ninguno
  const args = [...(opciones.args || []), ...argsDeAislamiento()];
  const base = topeDeArranque();

  /**
   * 🔴 UNA MEDIDA CORTADA NO SE IMPRIME COMO UNA COMPLETA.
   *
   * Un 30,0 que significa «hasta aquí miré» y un 19,6 que significa «esto tardó» no son el mismo
   * tipo de número, y con la misma forma acaban en la misma columna de una tabla. La línea dice
   * CUÁL de los dos es y en QUÉ tramo se cortó, para que no haya que acordarse.
   *
   * SCRUM-673 · esto YA NO SALE DEL PROCESO. Un intento cortado emite su marca y devuelve `null`:
   * quien decide si hay veredicto es `lanzarNavegador`, cuando se acaban los intentos. Ésa es toda
   * la diferencia — antes, el primer arranque lento ERA el veredicto.
   */
  const marcaCortada = (t0, tope, tramo, desglose) => {
    console.error(`${MARCA_ARRANQUE} ${seg(Date.now() - t0)} s CORTADA EN «${tramo}» · ${desglose}`);
    return null;
  };

  /** UN intento: arranca el proceso y espera la primera página, cada uno con el tope de su turno. */
  const intentar = async (n) => {
    const tope = topeDelIntento(n, base);
    const t0 = Date.now();
    let nav;
    try {
      // `waitForInitialPage: false` NO se salta la espera de la página: la saca de aquí para poder
      // cronometrarla aparte, y se hace justo debajo con el mismo tope. Va después del spread para
      // que ningún guard pueda desactivarla sin querer.
      nav = await puppeteer.launch({
        ...opciones, executablePath: ruta, args, timeout: tope, waitForInitialPage: false,
      });
    } catch (e) {
      return marcaCortada(t0, tope, TRAMO_PROCESO,
        `${TRAMO_PROCESO} ≥${seg(Date.now() - t0)} s · ${TRAMO_PAGINA} SIN MEDIR`);
    }
    const tProceso = Date.now() - t0;

    try {
      await nav.waitForTarget((t) => t.type() === 'page', { timeout: tope });
    } catch (e) {
      // Cerrar aquí no es cortesía: es lo que hace `waitForPageTarget` (BrowserLauncher.ts:363).
      // Sin esto quedaría un navegador vivo por cada intento que muriese esperando la página.
      await nav.close().catch(() => {});
      return marcaCortada(t0, tope, TRAMO_PAGINA,
        `${TRAMO_PROCESO} ${seg(tProceso)} s · ${TRAMO_PAGINA} ≥${seg(Date.now() - t0 - tProceso)} s`);
    }
    const tPagina = Date.now() - t0 - tProceso;

    console.error(`${MARCA_ARRANQUE} ${seg(tProceso + tPagina)} s COMPLETA`
      + ` · ${TRAMO_PROCESO} ${seg(tProceso)} s · ${TRAMO_PAGINA} ${seg(tPagina)} s`);
    return nav;
  };

  for (let n = 1; n <= INTENTOS_DE_ARRANQUE; n += 1) {
    const nav = await intentar(n);
    if (nav) return nav;
  }

  // 🔴 AQUÍ, Y SOLO AQUÍ, HAY VEREDICTO. Todos los intentos fallaron, así que ya no es «el runner
  // iba lento»: es que el navegador ESTÁ y no levanta. Y el rojo dice NO MEDIDO, que es lo único
  // honesto — el guard no ha comprobado nada, así que su silencio no significa que esté todo bien.
  console.error(`🔴 NO PUDE ARRANCARLO en ${INTENTOS_DE_ARRANQUE} intentos: el navegador ESTÁ y no levanta.`);
  console.error('   binario: ' + ruta);
  console.error(`   topes aplicados, en orden: ${Array.from({ length: INTENTOS_DE_ARRANQUE },
    (_, i) => topeDelIntento(i + 1, base) + ' ms').join(' · ')}`);
  // ⚠️ Esta frase la comprueba el guard de SCRUM-642 por su TEXTO, y es de otro carril: se
  // conserva LITERAL. Decía lo mismo cuando vivía en `cortada()`, antes de que hubiera intentos.
  console.error('   Cada número de arriba es el tope de su turno. NO es lo que tardó: es hasta dónde se miró.');
  console.error('   Lo que habría tardado de verdad no lo sabe nadie, porque se dejó de mirar.');
  console.error('   🔴 ESTO ES **NO MEDIDO**, no «no hay defectos». Esto NO es «no lo encuentro»');
  console.error('   (eso sale con ' + SALIDA_NO_ENCONTRADO + ') ni «he encontrado defectos» (eso sale con 1).');
  console.error('   Si se repite en tandas seguidas, el runner no da para arrancar un navegador y');
  console.error('   subir el tope solo mueve el problema: mídelo antes de tocar el número.');
  process.exit(SALIDA_NO_ARRANCA);
}
