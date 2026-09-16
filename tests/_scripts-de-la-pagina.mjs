// tests/_scripts-de-la-pagina.mjs — SCRUM-670 · UN SOLO extractor de los `<script>` de una página.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL AGUJERO QUE TAPA
//
// SCRUM-662 unificó la LISTA de scripts del dashboard —quiénes son— y ahí acabó una clase entera
// de conflictos de merge. Pero dejó intacto lo de debajo: **SEIS regex distintas leyendo el mismo
// `index.html`**, cada una con su idea de qué es un `<script>`. Mientras haya seis lecturas, la
// lista de uno no es la lista de otro y el problema sólo cambia de forma.
//
// 🔴 LA TABLA QUE LO DECIDIÓ (medida el 2-sep-2026 sobre `main` = 45a2474c, antes de escribir una
// línea de esto). Cada columna es un extractor de los que había; cada fila, una forma de
// `<script>` que el navegador acepta sin rechistar:
//
//   forma                       banco  colisión  shell  huella  scrum301  carga-pág   DEBE SER
//   ─────────────────────────────────────────────────────────────────────────────────────────
//   normal                        1       1        1      1        1         1           1
//   `defer`                       0       0        1      1        1         1           1
//   `defer` delante del `src`     0       0        1      1        1         1           1
//   un atributo de más            0       0        1      1        1         1           1
//   espacio antes del `>`         0       0        1      1        1         1           1
//   partida en dos líneas         0       0        1      1        1         1           1
//   comillas simples              0       0        0      1        1         1           1
//   `type="module"`               0       0        1      1        1         1        aparte
//   remoto (`https://…`)          0       0        1      1        1         1        aparte
//   COMENTADO (no se carga)       1       1        1      1        0         0           0
//   inline (sin `src`)            0       0        0      0        0         0           0
//
// Las dos filas que hacen daño, y en direcciones OPUESTAS:
//
//   · `defer` y compañía → el banco de vistas y el guard de colisiones ven **0**. Esa vista deja
//     de cargarse y de vigilarse **en silencio**, mientras el guard del shell la ve y la exige en
//     `sw.js`. No es hipótesis: SCRUM-559 midió que `defer` en UNO solo dejaba 16/16 en verde con
//     ese fichero fuera de toda vigilancia. Aquel ticket arregló el síntoma —umbral por recuento
//     exacto—; la causa es esta regex.
//   · COMENTADO → cuatro de los seis lo cuentan. Un `<script>` dentro de `<!-- -->` **no lo carga
//     el navegador**: el banco intentaría ejecutar un fichero que nadie carga y el guard del shell
//     lo exigiría en el precache. La divergencia va hacia el otro lado y nadie la miraba.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE MÓDULO NO HACE
//
// **No decide la población del dashboard.** Eso es `SCRIPTS_DEL_DASHBOARD` (SCRUM-662) y sigue
// siendo una decisión explícita escrita a mano. Esto sólo contesta «qué `<script>` hay en este
// marcado», que es la pregunta que seis sitios respondían distinto.
//
// **No adivina.** Una apertura que menciona `src` y de la que no se sabe sacar una ruta NO se
// cuenta de menos y se calla: sale en `ilegibles`, y el guard que la reciba cae nombrándola. Es la
// doctrina que este repo lleva tickets desterrando (SCRUM-451, 444, 634, 666): **lo que no se sabe
// leer se declara, no se contesta**. Un cero unánime es el resultado más convincente y más falso
// que puede dar este sistema.
//
// Sin dependencias nuevas (regla 36): sólo expresiones regulares.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * El marcado sin comentarios HTML. Un `<script>` comentado NO lo carga el navegador.
 *
 * Se exporta porque quien reordene o reescriba marcado tiene que poder usar EL MISMO criterio: si
 * un consumidor decide por su cuenta qué es un comentario, vuelve a haber dos opiniones — que es
 * el defecto entero de este ticket, sólo que una capa más abajo.
 */
export const sinComentarios = (html) => String(html).replace(/<!--[\s\S]*?-->/g, '');

/** La etiqueta de apertura de un `<script>`, con todos sus atributos (puede ocupar varias líneas). */
const APERTURA = /<script\b([^>]*)>/gi;

/**
 * El valor de `src`: entre comillas dobles, simples, o SIN comillas (`src=./js/x.js`), que es
 * HTML válido y que ninguno de los seis extractores anteriores sabía leer.
 */
const SRC = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/i;

/** ¿La apertura MENCIONA `src` aunque no se le pueda sacar valor? Separa «no tiene» de «no sé leer». */
const MENCIONA_SRC = /\bsrc\b/i;

/**
 * SCRUM-676 · El MISMO lector de valores, para los atributos que necesitan las hojas.
 *
 * `src` era un caso particular de esta pregunta. Escribir un segundo lector para `href` habría
 * sido volver a tener dos opiniones sobre qué es «el valor de un atributo» — el defecto que este
 * módulo existe para no repetir, una capa más abajo.
 */
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/i;
const REL = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/i;
const valorDe = (m) => (m ? (m[1] ?? m[2] ?? m[3]) : null);

/** La etiqueta de apertura de un `<link>`. Como la de `<script>`, puede ocupar varias líneas. */
const APERTURA_LINK = /<link\b([^>]*)>/gi;

/** ¿Remota? El MISMO criterio que para los `<script>`: esquema o `//`. */
const ES_REMOTA = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Los `<script>` de un marcado, clasificados. PURA sobre el HTML que recibe: no lee disco, para
 * que sus controles se ejerciten con corpus sintéticos. Un extractor que sólo sabe mirar el índice
 * real no puede demostrar que ve las formas que hoy no están — y son justo las que hacen daño.
 *
 * @returns {{
 *   clasicos: string[],   // `src` LOCAL sin `type=module`, EN ORDEN. La población de verdad.
 *   modulos: string[],    // `type="module"`: NO comparten ámbito global — el guard de colisiones
 *                         //   no debe mirarlos, o acusaría en falso.
 *   remotos: string[],    // `https://…`, `//…`: ni se cargan en el banco ni se precachean.
 *   aplazados: string[],  // `defer`/`async`: el navegador NO los ejecuta en el orden del documento.
 *   inline: number,       // `<script>` sin `src`.
 *   ilegibles: string[],  // aperturas con `src` que no se sabe leer → CEGUERA declarada.
 * }}
 */
export function scriptsDeLaPagina(html) {
  const clasicos = [];
  const modulos = [];
  const remotos = [];
  const aplazados = [];
  const ilegibles = [];
  let inline = 0;

  for (const m of sinComentarios(html).matchAll(APERTURA)) {
    const attrs = m[1] || '';
    const s = SRC.exec(attrs);
    const src = s ? (s[1] ?? s[2] ?? s[3]) : null;

    if (!src) {
      // Sin `src` legible. Dos casos MUY distintos, y confundirlos es el defecto:
      //   · no menciona `src`  → es un `<script>` inline. Correcto, no es población.
      //   · lo menciona        → hay algo que no sé leer. Se DECLARA; no se cuenta de menos.
      if (MENCIONA_SRC.test(attrs)) ilegibles.push(m[0].replace(/\s+/g, ' ').trim());
      else inline++;
      continue;
    }

    const esModulo = /\btype\s*=\s*(?:"|')?module\b/i.test(attrs);
    const esRemoto = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src);

    if (esRemoto) remotos.push(src);
    else if (esModulo) modulos.push(src);
    else clasicos.push(src);

    if (!esRemoto && /\b(?:defer|async)\b/i.test(attrs)) aplazados.push(src);
  }

  return { clasicos, modulos, remotos, aplazados, inline, ilegibles };
}

/**
 * La ruta del `src` relativa a `public/dashboard` (`./js/api.js` → `js/api.js`), que es la forma
 * con la que el banco abre el fichero. Acepta también la URL servida (`/dashboard/js/api.js`).
 */
export function rutaDelDashboard(src) {
  return String(src).replace(/^\.\//, '').replace(/^\/dashboard\//, '');
}

/**
 * Lo que un guard tiene que gritar antes de dar un veredicto, o `null` si puede seguir.
 *
 * Junta los dos modos de callar que este módulo existe para impedir:
 *   · **CEGUERA**: no ve población donde tiene que haberla — «no hay defecto» y «no supe mirar»
 *     son el mismo número con significados opuestos.
 *   · **ILEGIBLE**: ve algo con `src` y no sabe leerlo — un total menor y ni una palabra.
 *
 * @param minimo  suelo de población. Se exige un MÍNIMO holgado y no el total exacto: el total
 *                exacto ya lo impone `SCRIPTS_DEL_DASHBOARD` (SCRUM-662), y repetirlo aquí sería
 *                volver a tener dos sitios que pueden divergir.
 */
export function cegueraDelExtractor(res, minimo, donde = 'esta página') {
  if (res.ilegibles.length) {
    return '🔴 EL EXTRACTOR NO SABE LEER ESTAS ETIQUETAS, y llevan `src`:\n    '
      + res.ilegibles.join('\n    ')
      + `\n\n  No se cuentan de menos y no se callan: si esa forma es legítima, enséñasela a\n`
      + '  `scriptsDeLaPagina` en `tests/_scripts-de-la-pagina.mjs` — que es el ÚNICO sitio donde\n'
      + '  se lee un `<script>`, para que no vuelva a haber seis opiniones sobre qué es uno.';
  }
  if (res.clasicos.length < minimo) {
    return `🔴 EXTRACTOR CIEGO: veo ${res.clasicos.length} <script src> locales en ${donde} y hay `
      + `al menos ${minimo}.\n\n  Si el marcado cambió de forma, todo lo que se afirme debajo `
      + 'sería cierto sobre un conjunto vacío — un verde peor que un rojo. Y ojo: unas comillas\n'
      + '  simples producían exactamente este cero en tres extractores A LA VEZ, así que un cero\n'
      + '  unánime no es una confirmación: es el síntoma.';
  }
  return null;
}

/**
 * SCRUM-676 · Las HOJAS DE ESTILO de un marcado, clasificadas. PURA, como su hermana.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 POR QUÉ NO DERIVA DE `scriptsDeLaPagina`, Y POR QUÉ SÍ VIVE EN ESTE FICHERO
 *
 * Se midió antes de decidir la forma. `scriptsDeLaPagina` clasifica por `type=module` y por
 * `defer`/`async`, que no existen en un `<link>`; y una hoja se decide por `rel`, que no existe
 * en un `<script>`. Reusar aquella función habría sido meter dos poblaciones distintas en una.
 *
 * Lo que SÍ se reusa es todo lo demás, que es donde estaban los defectos: `sinComentarios`, el
 * lector de valores de atributo (comillas dobles, simples o SIN comillas) y la doctrina de
 * `ilegibles`. Por eso vive aquí: sigue habiendo UN solo sitio donde se lee una etiqueta.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 LO QUE SE MIDIÓ, Y NO ES UNA MANÍA (SCRUM-676, 2-sep-2026)
 *
 * Había TRES lecturas de `<link>` en el repo y sobre `dashboard/index.html` las tres daban lo
 * mismo: `/tokens.css` y `./css/styles.css`. **Ese acuerdo no valía nada.** Sobre las formas que
 * hoy no están en el índice, las tres fallaban, y cada una por su lado:
 *
 *   · comillas SIMPLES     → `_banco-vistas` y el SELLADO de producción devolvían CERO.
 *   · `<link>` COMENTADA   → `_banco-vistas` y el SELLADO la contaban como real.
 *   · `?v=` en el href     → `recursosDe` devolvía CERO: exigía que el href ACABARA en `.css`.
 *   · `href` antes de `rel` → `_banco-vistas` no la veía, y el índice real TIENE una así.
 *   · `rel="preload"`      → `recursosDe` la contaba como hoja cargada, y no lo es.
 *
 * @returns {{
 *   locales: string[],   // `rel` incluye `stylesheet` y el href es del árbol. La población.
 *   remotas: string[],   // `rel=stylesheet` con esquema o `//` (las fuentes de Google).
 *   otras: {rel: string|null, href: string}[],  // `icon`, `manifest`, `preconnect`, `preload`…
 *   ilegibles: string[], // menciona `href` o `rel` y no se sabe leer → CEGUERA declarada.
 * }}
 */
export function hojasDeLaPagina(html) {
  const locales = [];
  const remotas = [];
  const otras = [];
  const ilegibles = [];

  for (const m of sinComentarios(html).matchAll(APERTURA_LINK)) {
    const attrs = m[1] || '';
    const crudo = () => m[0].replace(/\s+/g, ' ').trim();
    const href = valorDe(HREF.exec(attrs));

    if (href === null) {
      // Un `<link>` sin `href` no le pide nada al navegador; uno que lo MENCIONA y no se deja
      // leer es otra cosa muy distinta, y confundirlas es el defecto (la doctrina de `src`).
      if (/\bhref\b/i.test(attrs)) ilegibles.push(crudo());
      continue;
    }

    const rel = valorDe(REL.exec(attrs));
    if (rel === null && /\brel\b/i.test(attrs)) {
      // Menciona `rel` y no se sabe leer: no se puede clasificar. Meterla en `otras` sería
      // decidir que NO es una hoja sin haberlo leído — un verde por la puerta de atrás.
      ilegibles.push(crudo());
      continue;
    }

    // `rel` es una LISTA de fichas: `rel="preload stylesheet"` es HTML legal.
    if (!(rel || '').toLowerCase().split(/\s+/).includes('stylesheet')) {
      otras.push({ rel, href });
      continue;
    }
    if (ES_REMOTA.test(href)) remotas.push(href);
    else locales.push(href);
  }

  return { locales, remotas, otras, ilegibles };
}

/**
 * SCRUM-676 · Lo que un guard de HOJAS tiene que gritar antes de dar un veredicto, o `null`.
 *
 * Hermana de `cegueraDelExtractor`, y NO se fusionó con ella a propósito: aquélla la consumen
 * tres guards que afirman sobre su texto, y cambiarle el mensaje para ahorrar diez líneas habría
 * movido tres guards ajenos en un ticket que no va de eso. La copia va ATADA: `scrum676`
 * comprueba que las dos existen y que cada una nombra su propia población.
 */
export function cegueraDeLasHojas(res, minimo, donde = 'esta página') {
  if (res.ilegibles.length) {
    return '🔴 EL EXTRACTOR NO SABE LEER ESTAS ETIQUETAS `<link>`:\n    '
      + res.ilegibles.join('\n    ')
      + '\n\n  No se cuentan de menos y no se callan: si esa forma es legítima, enséñasela a\n'
      + '  `hojasDeLaPagina` en `tests/_scripts-de-la-pagina.mjs` — que es el ÚNICO sitio donde se\n'
      + '  lee un `<link>`, para que no vuelva a haber tres opiniones sobre qué es una hoja.';
  }
  if (res.locales.length < minimo) {
    return `🔴 EXTRACTOR CIEGO: veo ${res.locales.length} hojas LOCALES en ${donde} y hay al menos `
      + `${minimo}.\n\n  Cero hojas no es «esta página no tiene estilos»: es «no supe leer el `
      + 'marcado», y son\n  el mismo número con significados opuestos. Está medido que pasa: unas '
      + 'comillas simples\n  producían exactamente este cero en DOS de las tres lecturas que había '
      + 'antes de SCRUM-676.';
  }
  return null;
}
