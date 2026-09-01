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
 */
export const MARCA_ARRANQUE = '⟦arranque⟧';

/**
 * Arranca el navegador, o PARA con el código que corresponde.
 *
 * `puppeteer` se recibe en vez de importarse: este módulo lo usan guards que ya lo tienen
 * cargado, y así se puede ejercitar el desenlace de «no arranca» con un doble, sin navegador.
 */
export async function lanzarNavegador(puppeteer, opciones = {}) {
  const ruta = rutaDelNavegador(); // sale con 2 si no hay ninguno
  const args = [...(opciones.args || []), ...argsDeAislamiento()];
  const tope = topeDeArranque();
  const t0 = Date.now();
  try {
    const nav = await puppeteer.launch({ ...opciones, executablePath: ruta, args, timeout: tope });
    console.error(`${MARCA_ARRANQUE} ${((Date.now() - t0) / 1000).toFixed(1)}`);
    return nav;
  } catch (e) {
    const s = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`${MARCA_ARRANQUE} ${s}`);
    console.error('🔴 NO PUDE ARRANCARLO: el navegador ESTÁ y no levanta.');
    console.error('   binario: ' + ruta);
    console.error(`   tardó ${s} s antes de rendirse, con un tope de ${tope} ms.`);
    console.error('   Esto NO es «no lo encuentro» (eso sale con ' + SALIDA_NO_ENCONTRADO
      + ') ni «he encontrado defectos» (eso sale con 1): el guard');
    console.error('   no ha llegado a medir nada, así que su silencio no significa que esté todo bien.');
    console.error('   Detalle: ' + (e && e.message ? e.message : e));
    process.exit(SALIDA_NO_ARRANCA);
  }
}
