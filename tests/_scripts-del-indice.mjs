// tests/_scripts-del-indice.mjs — SCRUM-670 · UNA SOLA FUENTE PARA «QUÉ SCRIPTS CARGA EL ÍNDICE».
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE: TRES REGEX QUE COINCIDÍAN POR CASUALIDAD
//
// El mismo `public/dashboard/index.html` lo leían tres extractores distintos, cada uno con su
// idea de qué es «un script»:
//
//   dashboard-colision-declaraciones.test.mjs  /<script src="\.\/js\/([^"]+)"><\/script>/g
//   _banco-vistas.mjs                          /<script src="\.\/([^"]+)"><\/script>/g
//   scrum274-shell-alineado.test.mjs           /<script[^>]+src\s*=\s*"([^"]+)"/gi
//
// Los dos primeros exigen que el `src` sea LO PRIMERO y que `</script>` vaya PEGADO. El tercero
// admite atributos y no mira el cierre. Sobre el índice de hoy los tres dan 71 y parece que la
// pregunta está contestada. **Coinciden por casualidad: hoy todas las etiquetas están escritas
// igual.** Medido con un caso real —una etiqueta con `defer`, escrita como la escribiría
// cualquiera— la respuesta se parte:
//
//     <script src="./js/pruebaDefer.js" defer></script>
//
//     71  dashboard-colision   ← NO lo ve
//     71  _banco-vistas        ← NO lo ve
//     72  scrum274-shell       ← sí
//     72  scrum274-huella      ← sí
//
// Y lo que se rompe no es un número: el guard de colisiones dejaría de parsear ese fichero —«cero
// colisiones» sin haberlo mirado— mientras el del service worker sí lo exige en el precache.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 Y LA RESPUESTA NO ES UNA CUARTA REGEX MÁS LISTA
//
// Si tres expresiones regulares sobre el mismo fichero divergen, el arreglo no es escribir la
// definitiva: es **dejar de leer HTML con expresiones regulares**. Aquí hay un RECORRIDO de
// caracteres — un tokenizador mínimo de la etiqueta `<script>` — que trata como estructura lo que
// es estructura:
//
//   · el `src` puede ir en cualquier posición entre los atributos;
//   · el valor puede llevar comillas dobles, simples o ninguna;
//   · la etiqueta puede estar partida en varias líneas;
//   · `defer`, `async`, `type` y cualquier atributo suelto no estorban;
//   · no hace falta que `</script>` vaya pegado, ni que exista.
//
// Ninguna de esas cinco cosas es un caso especial que haya que acordarse de añadir: salen de leer
// la etiqueta como lo que es.

/** Una etiqueta `<script>` del documento. `src` es `null` si es un script en línea. */
export function etiquetasScript(html) {
  const s = typeof html === 'string' ? html : '';
  const out = [];
  let i = 0;

  while (i < s.length) {
    const abre = s.toLowerCase().indexOf('<script', i);
    if (abre === -1) break;
    // `<scriptable>` no es un script: detrás de `<script` tiene que venir un separador o el cierre.
    const siguiente = s[abre + 7];
    if (siguiente !== undefined && !/[\s/>]/.test(siguiente)) { i = abre + 7; continue; }

    let j = abre + 7;
    const atributos = {};
    while (j < s.length && s[j] !== '>') {
      // Espacios (incluidos saltos de línea: una etiqueta partida en dos líneas es la misma).
      if (/\s/.test(s[j]) || s[j] === '/') { j += 1; continue; }
      // Nombre del atributo.
      let k = j;
      while (k < s.length && !/[\s=>/]/.test(s[k])) k += 1;
      const nombre = s.slice(j, k).toLowerCase();
      j = k;
      while (j < s.length && /\s/.test(s[j])) j += 1;
      if (s[j] !== '=') { if (nombre) atributos[nombre] = true; continue; } // atributo sin valor
      j += 1;
      while (j < s.length && /\s/.test(s[j])) j += 1;
      let valor = '';
      if (s[j] === '"' || s[j] === "'") {
        const comilla = s[j];
        const fin = s.indexOf(comilla, j + 1);
        if (fin === -1) { j = s.length; break; }
        valor = s.slice(j + 1, fin);
        j = fin + 1;
      } else {
        let m = j;
        while (m < s.length && !/[\s>]/.test(s[m])) m += 1;
        valor = s.slice(j, m);
        j = m;
      }
      if (nombre) atributos[nombre] = valor;
    }
    out.push({ src: typeof atributos.src === 'string' ? atributos.src : null, atributos });
    i = j + 1;
  }
  return out;
}

/** Los `src` del documento, tal cual están escritos. Los scripts en línea no cuentan. */
export function srcsDelIndice(html) {
  return etiquetasScript(html).map((e) => e.src).filter((x) => typeof x === 'string' && x !== '');
}

/** Solo los LOCALES: fuera `https://…`, `//cdn…` y cualquier absoluta con esquema. */
export function srcsLocales(html) {
  return srcsDelIndice(html).filter((s) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(s));
}

/**
 * El nombre a secas de los scripts de `./js/` — la población que comparten los guards del
 * dashboard. `./js/api.js` → `api.js`.
 */
export function nombresDelDashboard(html) {
  return srcsLocales(html)
    .filter((s) => /(^|\/)js\//.test(s))
    .map((s) => s.replace(/^.*\/js\//, ''));
}

/**
 * ⚠️ SUELO DE CEGUERA, y va en la fuente para que ningún consumidor tenga que acordarse.
 *
 * Un CERO aquí no significa «este documento no carga scripts»: significa que no se supo leerlo —
 * cambió el formato, el fichero no está, se leyó vacío—. Y los dos guards que dependen de esta
 * población afirman cosas de la forma «ninguno falla» / «cero colisiones», que con la lista vacía
 * salen en verde sin haber mirado nada.
 */
export function scriptsDelIndiceOFalla(html, deDonde = 'el índice') {
  const nombres = nombresDelDashboard(html);
  if (nombres.length === 0) {
    throw new Error(
      `🔴 CIEGO: cero <script src> leídos de ${deDonde}.\n`
      + '  Un cero NO es «no hay scripts»: es «no supe leerlo». Todo lo que se afirme sobre esta\n'
      + '  población —«cero colisiones», «ninguna vista falla»— saldría en verde sin haber mirado.',
    );
  }
  return nombres;
}
