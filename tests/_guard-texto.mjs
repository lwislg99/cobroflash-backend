// tests/_guard-texto.mjs — helper compartido para GUARDS QUE MIRAN TEXTO.
import fs from 'node:fs'; // SCRUM-193: `leerFuente` LEE, no solo filtra
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE (decisión del fundador, 28-jul-2026)
//
// Un guard que busca un literal en un fichero se caza a sí mismo, porque el sitio natural
// donde se escribe ese literal es **el comentario que explica por qué está prohibido**. Pasó
// TRES VECES en una sola sesión, cada una en un ticket distinto:
//
//   · SCRUM-176 — el hook bloqueaba `git commit -m "…nunca ejecutes db push…"`. El guard
//     miraba el JSON entero del tool call, así que casaba la prosa del mensaje.
//   · SCRUM-168 — el test que impedía que volviera `--depth=0` salió rojo contra la CABECERA
//     del propio workflow, donde ese literal aparece para explicar que no se use.
//   · SCRUM-3 — el assert de «el selector no le habla al pagador del fee» casó el «0,9 %» de
//     un comentario que explicaba la decisión del fundador.
//
// La conclusión, y no es casualidad: **escribir el porqué al lado del guard hace que el guard
// se cace a sí mismo.** Cuanto mejor documentas la regla, más te bloquea el mecanismo que la
// defiende — que es literalmente el enunciado de SCRUM-176, repetido a otra escala.
//
// LA REGLA, desde hoy: **un guard de texto mira LÍNEAS EJECUTABLES por defecto, no el
// fichero.** Si de verdad hace falta mirar también los comentarios, se dice en el test y se
// justifica ahí mismo — es la excepción, no el punto de partida.
//
// Y cuando lo que se protege es lo que LEE UN HUMANO (una etiqueta, un microcopy), mejor aún:
// mira los literales que se renderizan, no el fuente. Ver `TEXTOS_AL_CLIENTE` en
// tests/scrum3b-selector-bizum.test.mjs como ejemplo.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el fuente sin comentarios. Cubre las tres formas que usa este repo: `//` (JS/TS),
 * `#` (YAML/shell) y los bloques `/* … *\/` (JSDoc y cabeceras largas).
 *
 * ── SCRUM-700 · QUÉ CAMBIÓ, Y POR QUÉ LA DOCUMENTACIÓN DE ANTES ERA PEOR QUE EL CÓDIGO ──────
 *
 * Aquí ponía «no distingue un `//` dentro de un string de un comentario de verdad», y **eso
 * describía un riesgo que esta función no tenía**: sólo borraba líneas ENTERAS que empezaban por
 * `//`, así que jamás cortaba dentro de una cadena. Lo que sí tenía —y no estaba escrito— era el
 * hueco contrario: **un comentario al final de una línea con código SOBREVIVÍA**. Medido con una
 * sonda: `const x = 1; // PALABRA` salía con la PALABRA dentro. Y ése es justo el caso que este
 * fichero existe para cerrar, porque el sitio natural donde se escribe el literal prohibido es
 * el comentario que explica la prohibición — mordió cuatro veces.
 *
 * Ahora se recorre el fuente **carácter a carácter**, llevando la cuenta de si estamos dentro de
 * una cadena (`'`, `"`, `` ` ``) o de un bloque. Un `//` sólo abre comentario **fuera** de una
 * cadena, así que `'https://yaqu.app'` deja de partirse por la mitad y el comentario final sí se
 * va. Nada de ventanas: se lee el documento entero.
 *
 * LO QUE SIGUE SIN CUBRIR, dicho aquí en vez de descubrirse en un rojo raro: un `//` **sin
 * escapar dentro de un literal de expresión regular**. En este repo no aparece —las regex
 * escriben `\/\/`— y distinguir una regex de una división pide un parser de verdad. Y ojo con
 * ese parser: `ts.createScanner` a pelo NO sirve, medido en SCRUM-700 — ve 148 de los 352
 * comentarios de `src/app.ts` porque sin contexto no sabe si un `/` abre regex o divide.
 */
export function soloEjecutable(fuente, { almohadillaEsComentario = true } = {}) {
  const n = fuente.length;
  let out = '';
  let i = 0;
  let comilla = null;      // `'`, `"` o `` ` `` mientras estemos dentro de una cadena
  let inicioDeLinea = true; // para saber si el `#` abre comentario de línea entera

  while (i < n) {
    const c = fuente[i];
    const d = fuente[i + 1];

    if (comilla) {
      out += c;
      if (c === '\\') { if (i + 1 < n) out += fuente[i + 1]; i += 2; continue; }
      if (c === comilla) comilla = null;
      if (c === '\n') { comilla = null; inicioDeLinea = true; } // una cadena no cruza de línea
      i += 1;
      continue;
    }

    if (c === '/' && d === '*') {
      const fin = fuente.indexOf('*/', i + 2);
      i = fin < 0 ? n : fin + 2;   // sin cerrar: comenta hasta el final, como hace el motor
      continue;
    }
    // Un `/` ESCAPADO no abre comentario. Sin esto, un literal de regex que acaba en `\/` —como
    // `/https:\/\//`— junta su última barra escapada con la de cierre y parece un `//`. Medido:
    // era el único de las nueve sondas que fallaba.
    if (c === '/' && d === '/' && fuente[i - 1] !== '\\') {
      while (i < n && fuente[i] !== '\n') i += 1;
      continue;                     // el `\n` se copia en la vuelta siguiente
    }
    if (c === '#' && almohadillaEsComentario && inicioDeLinea) {
      while (i < n && fuente[i] !== '\n') i += 1;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') comilla = c;
    if (c === '\n') inicioDeLinea = true;
    else if (!/\s/.test(c)) inicioDeLinea = false;

    out += c;
    i += 1;
  }

  // Las líneas que sólo tenían un comentario quedan vacías: se quitan, como hacía antes.
  return out.split('\n').filter((l, k, todas) => l.trim() !== '' || k === todas.length - 1).join('\n');
}

/**
 * SCRUM-193b · ¿la almohadilla es un comentario en ESTE tipo de fichero?
 *
 * Solo en YAML y shell. En los demás significa otra cosa y borrar esas líneas destruye
 * justo lo que el guard viene a mirar:
 *   · CSS  → `#loquesea` es un SELECTOR DE ID. Filtrar se lleva por delante cada regla anclada
 *            a un id, y el guard acaba buscando en una hoja de estilos a la que le faltan reglas.
 *   · JS/TS→ `#campo` son campos privados de clase.
 *   · MD   → `#` es un encabezado (por eso `leerFuente` ni siquiera acepta Markdown).
 *
 * Se descubrió retrofitando los guards de SCRUM-139, que leen `styles.css`: el mismo fallo que
 * el del Markdown, una capa más abajo. La lección se repite — un filtro de texto que no sabe
 * qué está leyendo borra cosas que no son comentarios.
 */
export function almohadillaComenta(ruta) {
  return /\.(ya?ml|sh|bash|env|conf|toml|ini)$/i.test(ruta);
}

/**
 * SCRUM-719 · EL CÓDIGO DE UN FUENTE, **CON LA GARANTÍA DE QUE SE HA MIRADO ALGO**.
 *
 * ── EL DEFECTO, MEDIDO EL 4-sep-2026 ────────────────────────────────────────────────────
 * De los 77 guards que llaman a este filtro, **17 seguían en VERDE con el filtro devolviendo la
 * cadena vacía**. Su forma es siempre la misma:
 *
 *     const codigo = soloEjecutable(texto);
 *     assert.doesNotMatch(codigo, /LO_PROHIBIDO/);   // ← con `codigo === ''` pasa siempre
 *
 * Una negación sobre un texto vacío es verdadera y no dice nada. Eso es SCRUM-237 exactamente, y
 * —lo mejor del hallazgo— **`scrum237-negacion-respaldada` era uno de los diecisiete**: el guard
 * que exige respaldar negaciones no respaldaba la suya.
 *
 * 🔴 Y LO QUE HACE FALTA ENTENDER PARA ARREGLARLO BIEN: **casi todos tenían suelo ya**, y todos
 * lo tenían apuntando UN PASO ANTES de la ceguera. Comprobaban «he leído el fichero»
 * (`SELLADOR.length > 2000`), «he encontrado el bloque» (el `assert.ok(bloque)` por AST de
 * `scrum394`), «el nombre prohibido existe en la casa» (`scrum382`, `scrum293`, `scrumD1`) o
 * incluso «he mirado 3.000 líneas» (`scrum372`). Ninguno comprobaba lo único que importa:
 * **que el texto que se registró tenga sustancia**. El suelo estaba en la puerta de al lado.
 *
 * ── QUÉ ES EL ANCLA, Y POR QUÉ NO ES UN NÚMERO A MANO ───────────────────────────────────
 * El ancla es algo que el guard YA depende de que exista: el símbolo que importa, la función que
 * la ruta llama, el marcador que el censo busca. Si desaparece, el guard estaba mirando otro
 * fichero **y quiere enterarse**. No hay ningún número que mantener: si el ancla se renombra, el
 * rojo dice el nombre viejo y el arreglo es de una línea.
 *
 * Es deliberadamente lo contrario del umbral con holgura de SCRUM-559: un `>= N` con margen sólo
 * detecta la ceguera TOTAL y deja pasar la parcial. Un ancla es binaria y no tiene margen.
 *
 * ⚠️ NO se aceptan anclas vacías ni `ancla` ausente: sin ancla esto sería `soloEjecutable` con
 * pasos de más. Que llamarlo obligue a decir QUÉ tiene que sobrevivir es el mecanismo, no un
 * requisito de forma.
 */
export function ejecutableDe(fuente, { ancla, donde, almohadillaEsComentario = true, sinAncla = false } = {}) {
  if (!ancla && !sinAncla) {
    throw new Error('ejecutableDe: falta `ancla`. Sin decir qué tiene que sobrevivir al filtro, '
      + 'esto no da ningún suelo: usa `soloEjecutable` y asume la ceguera, o elige un ancla.');
  }
  const codigo = soloEjecutable(String(fuente ?? ''), { almohadillaEsComentario });
  const anclas = ancla == null ? [] : (Array.isArray(ancla) ? ancla : [ancla]);
  const faltan = anclas.filter((a) => !codigo.includes(a));
  if (faltan.length) {
    throw new Error(
      `🔴 ESCÁNER CIEGO${donde ? ` en ${donde}` : ''}: tras filtrar comentarios, el código NO `
      + `contiene ${faltan.map((a) => `\`${a}\``).join(', ')}.\n`
      + `   Se registraron ${codigo.trim().length} caracteres de código sobre ${String(fuente ?? '').length} de fuente.\n`
      + '   Lo que venga después es una NEGACIÓN SOBRE UN TEXTO QUE NO ES EL QUE CREES, y una\n'
      + '   negación sobre la nada siempre es cierta. O el fichero se movió, o el recorte no\n'
      + '   encontró sus extremos, o el ancla se renombró: las tres se arreglan aquí, no bajando\n'
      + '   la exigencia.',
    );
  }
  return codigo;
}

/**
 * SCRUM-719 · Para los guards que barren MUCHOS textos, donde no hay un ancla común.
 *
 * Devuelve el código de cada uno y **cuenta cuántos traían sustancia**. El suelo no es un número
 * escrito a mano: es que **todos** los textos que se leyeron tengan código, porque un fichero de
 * `public/` o de `src/` que se queda en cero tras filtrar comentarios no existe en este repo —
 * y si algún día existe, lo que hay que hacer es sacarlo del barrido, no bajar el listón.
 *
 * 🔴 POR QUÉ NO VALE «he mirado N líneas», que es lo que tenía `scrum372`: ese contador sube
 * igual con el filtro roto, porque cuenta lo que ENTRA y la ceguera pasa a la SALIDA. Aquí se
 * cuenta lo que sale.
 */
export function ejecutablesDe(entradas, { donde } = {}) {
  const items = [...entradas];
  if (!items.length) {
    throw new Error(`🔴 ESCÁNER CIEGO${donde ? ` en ${donde}` : ''}: el barrido no ha encontrado `
      + 'ni un fichero que mirar. Cero elementos no es «no hay ninguno que incumpla»: es que no '
      + 'se ha mirado, y devolverlo como limpieza sería el verde falso que este helper existe '
      + 'para impedir.');
  }
  const salida = items.map(({ nombre, texto, almohadillaEsComentario = true }) => ({
    nombre,
    codigo: soloEjecutable(String(texto ?? ''), { almohadillaEsComentario }),
  }));
  const vacios = salida.filter((s) => !s.codigo.trim()).map((s) => s.nombre);
  if (vacios.length) {
    throw new Error(`🔴 ESCÁNER CIEGO${donde ? ` en ${donde}` : ''}: ${vacios.length} de `
      + `${items.length} textos se han quedado SIN CÓDIGO tras filtrar comentarios:\n`
      + `   ${vacios.slice(0, 8).join(', ')}${vacios.length > 8 ? '…' : ''}\n`
      + '   Sobre ésos, cualquier negación que venga después es cierta por vacía.');
  }
  return salida;
}

/**
 * SCRUM-193 · LEER UN FICHERO YA FILTRADO. **Este es el camino por defecto.**
 *
 * POR QUÉ HIZO FALTA, aunque la regla y `soloEjecutable` ya existían: mordió una CUARTA vez
 * después de escribirlas. Que una regla exista no basta si no es el camino corto — mientras
 * `fs.readFileSync` sea lo primero que uno teclea, el filtrado depende de acordarse, y
 * acordarse falla. Aquí se invierte la comodidad: leer devuelve YA filtrado, y quedarse con
 * los comentarios exige pedirlo (`{ conComentarios: true }`) y justificarlo donde se pide.
 *
 * No añade capacidad —hace lo mismo que `readFileSync` + `soloEjecutable`—; lo que cambia es
 * cuál de las dos cosas es la fácil de escribir.
 */
export function leerFuente(ruta, { conComentarios = false, ancla = null } = {}) {
  // ⚠️ MARKDOWN NO. En .md el # es un ENCABEZADO, no un comentario: filtrar se comeria la
  // mitad del documento y el guard pasaria a mirar un texto que no existe — verde falso del
  // peor tipo. Se para en vez de adivinar; para leer un .md se pide explicitamente.
  if (/\.(md|markdown)$/i.test(ruta) && !conComentarios) {
    throw new Error(
      `leerFuente: ${ruta} es Markdown y ahi el # es un encabezado, no un comentario. ` +
      "Usa leerFuente(ruta, { conComentarios: true }) — en un .md no hay codigo que separar.",
    );
  }
  const texto = fs.readFileSync(ruta, 'utf8');
  if (conComentarios) return texto;
  // SCRUM-719 · el `ancla` es opcional aqui y OBLIGATORIO en `ejecutableDe`, a proposito: este
  // camino tambien lo usan tests que EXIGEN algo, y a esos el filtro no puede cegarlos —una
  // afirmacion positiva sobre la nada FALLA sola—. Quien PROHIBE algo si necesita el suelo.
  return ejecutableDe(texto, {
    ancla: ancla || undefined,
    donde: ruta,
    almohadillaEsComentario: almohadillaComenta(ruta),
    sinAncla: !ancla,
  });
}

/**
 * Los literales de cadena que aparecen en el fuente — útil cuando lo que se vigila es lo que
 * acaba en pantalla y no el código que lo rodea.
 */
export function literalesDeCadena(fuente) {
  return [...soloEjecutable(fuente).matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)]
    .map((m) => m[1] ?? m[2])
    .filter(Boolean);
}
