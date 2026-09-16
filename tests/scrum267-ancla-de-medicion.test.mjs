// SCRUM-267 · UNA ENTRADA DEL REGISTRO DECLARA CONTRA QUÉ `main` SE MIDIÓ, Y A QUÉ HORA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS INCIDENTES QUE LO ORIGINAN, el mismo día
//
//   · Javier **paró** ante una contradicción entre Jira y el máster: uno decía «hecho y en main»
//     y el otro «por hacer». Hizo lo correcto —no avanzar sobre una afirmación que no podía
//     comprobar— pero no tenía forma de saber cuál de los dos estaba desactualizado.
//   · Una medición **CORRECTA** de otra sesión caducó **en una hora**, porque `main` se movió
//     tres veces mientras trabajaba. El dato no estaba mal: estaba viejo, y nada en el texto lo
//     decía.
//
// El segundo es el que define el diseño. **El problema no es medir mal: es que una medición buena
// no lleva fecha de caducidad encima.** Con cuatro sesiones mergeando, `main` cambia varias veces
// por hora — este mismo ticket vio la base moverse entre el `fetch` y el `worktree add`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EL ANCLA VA EN EL ENCABEZADO Y NO JUNTO A LA AFIRMACIÓN
//
// La alternativa era detectar la afirmación —buscar «está en main», «mergeado», «ya entró»— y
// exigir un ancla cerca. Se descartó por dos motivos, los dos medidos en este repo:
//
//   ① Sería un **guard de TEXTO**, y un guard de texto se caza a sí mismo: el fichero que explica
//      la prohibición contiene las frases que persigue. Ha mordido cinco veces
//      (SCRUM-176/168/3/193 y el propio 254).
//   ② Y se **esquiva reformulando**. Una regla que depende de cómo escribas la frase no es una
//      regla.
//
// Exigirlo en TODAS las entradas es estructural: la comprobación es «¿el encabezado tiene este
// campo?», no «¿la prosa afirma algo?». Y no es burocracia añadida — **toda entrada se produce
// contra algún `main`**, así que declarar la base siempre significa algo. Lo que cambia es que
// deja de ser costumbre y pasa a ser mecanismo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SHA DE 40 Y HORA CON HUSO, y las dos exigencias tienen su incidente detrás
//
//   · **40 hex, no abreviado.** `1bb0b5e` aparece en tres ramas distintas de este repo esta misma
//     semana: un sha corto identifica un commit igual de mal que un número de PR identifica un
//     ticket (R12). Si el ancla no distingue, no ancla.
//   · **Fecha Y HORA con huso.** Sin hora, el ancla no distingue «medido hace cinco minutos» de
//     «medido esta mañana» — que es exactamente la diferencia que costó la vuelta. ISO-8601 con
//     desplazamiento para que no dependa de dónde esté quien lo lee.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE GUARD NO VIVE DENTRO DEL DE SCRUM-273
//
// Responden preguntas distintas: 273 vigila **dónde** se escribe el registro; éste, **qué lleva
// dentro** cada entrada. Un rojo de «falta el ancla» aterrizando en un fichero llamado
// *registro-por-fichero* obliga a quien lo lee a averiguar cuál de las dos reglas rompió;
// separados, el nombre del test es el diagnóstico.
//
// Y la razón que decide: 273 guarda un **censo congelado** de las entradas que quedaron en el
// máster. Colgarle una propiedad nueva haría que ese fichero cambiase por motivos que no tienen
// que ver con el censo — **la misma mezcla de lo estable con lo que cambia a menudo que causó
// SCRUM-273**, repetida dentro del propio arreglo.
//
// ⚠️ COSTE ACEPTADO Y DICHO: dos ficheros recorren `docs/master/`. Si ese directorio se mueve,
// hay dos sitios que tocar. Extraer un helper compartido para seis líneas sería un tercer fichero
// y no compensa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_REGISTRO = path.join(RAIZ, 'docs', 'master');
const README = path.join(DIR_REGISTRO, 'README.md');

/**
 * El ancla: `**Medido contra:** \`origin/main\` = \`<40 hex>\` · <ISO-8601 con huso>`
 *
 * Anclado al principio de línea y con los dos campos OBLIGATORIOS. El huso admite `Z` o `±HH:MM`
 * porque las dos formas son ISO-8601 válidas y no ambiguas.
 */
// 🔴 SCRUM-859 · DOS ENSANCHES MEDIDOS, y ninguno baja el listón: lo que se exige —sha de 40 e
// instante con huso— es EXACTAMENTE lo mismo. Lo que cambia es dónde se acepta que esté escrito.
//
//   ① el ancla no tiene por qué abrir la línea. Dos entradas la llevan detrás de `**Fecha:** · `:
//      SCRUM-296:93 y SCRUM-297:126.
//   ② el instante puede ir en la línea SIGUIENTE. Esas mismas dos parten el ancla en dos líneas.
//   ③ entre el sha y el `· <instante>` puede haber un inciso. Cuatro entradas lo llevan:
//      SCRUM-674 `(ya mergeado en la rama)`, SCRUM-728 y SCRUM-814 ×2 `(mezclado dentro de la
//      rama, AA2)`. Dice CÓMO llegó ese main a la rama, que es información del ancla.
//
// Dos no es una errata y cuatro menos: un caso suelto es un descuido, varios son un formato.
//
// ⚠️ NO SE BAJA EL LISTÓN: se sigue exigiendo el sha de 40 Y el instante con huso. Lo único que
// cambia es dónde se acepta que estén escritos. Y el FINAL DE LÍNEA se conserva: sin él, el `·`
// podría casar con cualquier cosa más adelante del fichero.
// El hueco entre el sha y el `· <instante>` va ACOTADO a 160 caracteres y es PEREZOSO: acotado
// para que no pueda irse a buscar un instante tres párrafos más abajo —el defecto que SCRUM-516
// midió y que costó cuatro guards en verde sobre un sha de 7—, y perezoso para que, cuando el
// inciso lleva su propio `·` (SCRUM-358), siga encontrando el que de verdad precede al instante.
//
//   ④ y detrás del instante puede ir un INCISO ENTRE PARÉNTESIS que explica cómo se ancló
//      («(anclado con `git ls-remote`; main se movió cuatro veces…)»). Lo llevan SCRUM-296 y
//      297. Se acepta sólo si abre paréntesis: cualquier otra cosa detrás del instante sigue
//      rompiendo el ancla, que es lo que impide que el `$` deje de servir para nada.
const RE_ANCLA = /\*\*Medido contra:\*\*\s+`origin\/main`\s*=\s*`([0-9a-f]{40})`[\s\S]{0,160}?·\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2}))(?:\s*\(.*)?\s*$/m;

/** Las entradas del registro (no el README, que no es una entrada). */
function entradas() {
  if (!fs.existsSync(DIR_REGISTRO)) return [];
  return fs.readdirSync(DIR_REGISTRO)
    .filter((f) => /^SCRUM-\d+\.md$/.test(f))
    .map((f) => ({ nombre: f, texto: fs.readFileSync(path.join(DIR_REGISTRO, f), 'utf8') }));
}

// ── EL TROCEADOR (SCRUM-516) ─────────────────────────────────────────────────────────────
//
// 🔴 POR QUÉ ESTE GUARD PASA A MIRAR ENTRADA POR ENTRADA, Y NO EL FICHERO.
//
// Hasta el 17-ago-2026 este guard leía el fichero ENTERO y `RE_ANCLA` lleva `/m`: bastaba con que
// UNA línea en cualquier parte llevara un ancla buena. Medido rompiendo un verde a propósito: una
// sesión abrevió su sha a 7 caracteres y **los cuatro guards seguían dando 17/17**, porque las
// anclas de las dos entradas anteriores del mismo fichero ya lo satisfacían.
//
//   >>> Un ancla mal escrita en un apéndice no la veía nadie. <<<
//
// Y lo grave es la INTERACCIÓN, no este guard suelto: SCRUM-273 obliga a un fichero por ticket, así
// que un registro nuevo sobre un ticket viejo **va como apéndice al final** — justo donde este
// guard era ciego. El que obliga a un nombre correcto conducía el trabajo al punto ciego del otro.
// Ninguno estaba mal por separado; juntos abrían el hueco.
//
// ── EL DELIMITADOR, MEDIDO ANTES DE APOYARSE EN ÉL ───────────────────────────────────────
//
// El candidato propuesto era `---` + `# SCRUM-<n> · …`. **Medido sobre los 226 ficheros reales, NO
// es estable**, y por eso NO se usa tal cual:
//
//   · `---` delante del apéndice: **7 apéndices no lo llevan** (SCRUM-244, 328 ×3, 406, 420, 447).
//     Exigirlo daría 7 rojos que no son fallos de ancla. **No se exige.**
//   · el `·` del título: **8 encabezados usan otra cosa** — `# SCRUM-374` a secas, `# SCRUM-415 —
//     …`, `# SCRUM-16 / 142 · …`. **No se exige.**
//   · el número del encabezado ≠ el del fichero: **1 caso real** (`SCRUM-441.md:420` encabeza
//     `# SCRUM-496`). Es asunto del guard de nombres (273), no de éste. **No se exige.**
//
// Lo que SÍ resultó estable es `^# SCRUM-<n>` como principio de entrada: lo llevan los 226
// ficheros y las 317 entradas. **Con una trampa real y medida:** `SCRUM-480.md` tiene dos `#
// SCRUM-` DENTRO de un bloque cercado ``` — troceando por texto plano inventaría dos entradas
// fantasma. Por eso el troceador lleva la cuenta de los cercados y los salta.
//
// El delimitador es, por tanto, **`^# SCRUM-\d+` fuera de bloque cercado**, y nada más.
//
// ── SCRUM-532 · Y ESE «NADA MÁS» ERA EL HUECO SIGUIENTE ──────────────────────────────────
//
// 🔴 DEMOSTRADO EN EJECUCIÓN EL 8-sep-2026, escribiendo el apéndice de `SCRUM-825.md`: la sesión
// obtuvo 21/21 en verde, **no se lo creyó**, rompió su ancla a propósito —sha abreviado, sin
// hora— y el guard **siguió en verde**. El mecanismo es el de arriba con otra ropa: los apéndices
// se encabezaban `# APÉNDICE`, que NO casa `^# SCRUM-\d+`, así que el fichero entero seguía
// contando como UNA entrada y le bastaba el ancla de la línea 3 —de otra medición, de otro
// trabajo— para dar por buenas todas las de abajo.
//
//   >>> SCRUM-516 cerró el hueco para los apéndices `# SCRUM-<n>`, no para los `# APÉNDICE`. <<<
//
// De las CINCO anclas de `SCRUM-825.md`, el guard sólo miraba DOS. Las tres de abajo son válidas
// **por el cuidado de quien las escribió, no por mecanismo** — que es justo lo que un guard existe
// para no depender.
//
// ── LO QUE SE MIDIÓ ANTES DE ELEGIR EL DELIMITADOR NUEVO (15-sep-2026) ───────────────────
//
// Sobre los **479 ficheros** de `docs/master/` (eran 226 cuando se escribió lo de arriba), contando
// sólo encabezados de nivel 1 fuera de bloque cercado:
//
//   · **849 encabezados `^# ` en total.** El troceador veía **634**; **215 le eran invisibles**.
//   · De esos 215, **62 se anuncian como APÉNDICE** y **153 son secciones INTERNAS de una entrada**
//     (`# PUNTO 1`, `# TRAMO 2`, `# FASE C`, `# LA TABLA`…).
//
// 🔴 POR QUÉ NO SE CORTA POR CUALQUIER `^# `, que era el candidato obvio: esas 153 secciones no son
// mediciones aparte, y exigirles ancla propia daría **153 rojos que no son fallos de ancla**.
// Es el mismo error que ya se midió con `---`, cometido otra vez y en mayor escala.
//
// El delimitador pasa a ser, por tanto, **`^# SCRUM-\d+` o `^# …APÉNDICE…`, fuera de cercado**.
// Medido el 15-sep-2026: **634 → 696 entradas (+62)**, y **29 apéndices que pasaban quedan acusados** — los que
// llevaban el ancla tapada por la de arriba. Las 27 exentas conservan su clave `fichero#índice`.
//
// ── ⚠️ EL RESIDUO, DECLARADO: ESTO NO CIERRA EL HUECO DEL TODO ───────────────────────────
//
// Con el delimitador nuevo quedan **40 trozos que siguen escondiendo más de una medición** (eran
// 69), y **26 líneas `**Medido contra:**` mal escritas** que ningún trozo acusa porque las tapa un
// ancla buena del mismo trozo. Un delimitador, por bien elegido que esté, sólo ve lo que alguien
// se acordó de encabezar.
//
// 🔴 Y LA VÍA QUE PARECÍA CERRARLO NO VALE, medido, no supuesto: «que TODAS las líneas `Medido
// contra` de un trozo sean válidas» **acusaría a `docs/master/SCRUM-267.md:25`**, que no es un
// ancla sino **la plantilla del formato** (`` `<sha de 40>` · <ISO-8601 con huso> ``). El documento
// que explica la regla contiene la regla: es SCRUM-349 exacto, un guard de texto cazándose a sí
// mismo. Va reportado como hallazgo de otro carril, con su número, y NO se implementa aquí.

/** ¿Qué líneas caen dentro de un bloque cercado ``` o ~~~? */
function lineasEnCodigo(lineas) {
  const dentro = new Array(lineas.length).fill(false);
  let abierto = false;
  for (let i = 0; i < lineas.length; i++) {
    if (/^\s*(```|~~~)/.test(lineas[i])) { abierto = !abierto; dentro[i] = true; continue; }
    dentro[i] = abierto;
  }
  return dentro;
}

/**
 * ¿Esta línea EMPIEZA una entrada del registro?
 *
 * Las dos formas están MEDIDAS sobre el árbol real (ver el bloque de arriba), no elegidas a ojo:
 *
 *   · `# SCRUM-<n>` — el encabezado canónico, el que llevan los 479 ficheros.
 *   · `# …APÉNDICE…` — la forma que SCRUM-273 empuja a escribir cuando el registro nuevo va sobre
 *     un ticket viejo, y que el troceador no veía. Se acepta con y sin tilde, con emoji delante y
 *     con numeral detrás (`# 📎 APÉNDICE · …`, `# APÉNDICE 2 · …`, `# Apéndice · …`): las cuatro
 *     variantes existen en `docs/master/` y las cuatro son la misma cosa.
 *
 * ⚠️ Y NO MÁS QUE ESAS DOS. Cortar por cualquier `^# ` daría 153 rojos sobre secciones internas
 * (`# PUNTO 1`, `# TRAMO 2`) que no son mediciones aparte.
 */
export function esEncabezadoDeEntrada(linea) {
  return /^# SCRUM-\d+/.test(linea) || /^#\s+.*AP[ÉE]NDICE/i.test(linea);
}

/**
 * Trocea el texto de un fichero de registro en sus ENTRADAS.
 *
 * La primera empieza en la línea 0 —no en su encabezado— para que **nada quede fuera de alguna
 * entrada**: si un fichero llevara preámbulo antes del primer `#`, trocear desde el encabezado lo
 * dejaría sin vigilar, que es el defecto que este ticket viene a cerrar, en pequeño.
 *
 * Devuelve `[]` si no encuentra ningún encabezado. Ese caso lo trata el SUELO como CEGUERA, nunca
 * como «no hay entradas sin ancla».
 */
export function trocearEntradas(texto) {
  const lineas = texto.split('\n');
  const enCodigo = lineasEnCodigo(lineas);

  // ═══ 🔴 SCRUM-859 · EL CRITERIO DERIVADO, Y POR QUÉ NO ES UNA FORMA MÁS ═══════════════════
  //
  // Hasta aquí la pregunta era «¿cómo se TITULA esta sección?», y la respuesta era una lista:
  // `# SCRUM-<n>`, luego `APÉNDICE` (SCRUM-532). Una lista sólo ve las formas que alguien se
  // acordó de añadir, así que el hueco se reabre con cada forma nueva que nadie ha nombrado
  // todavía — y había SEIS más en el árbol: `# TRAMO 2`, `# FASE B`, `# ═══ SEGUNDA ENTREGA`,
  // `# 10-ago-2026 · …`, `# ✅ PASO ③`, `# SESIÓN 4`.
  //
  // La pregunta correcta no es cómo se titula, sino **qué declara**: una sección que trae su
  // propia ancla `**Medido contra:**` ES una medición aparte, se llame como se llame. Eso es
  // derivado del contenido y no caduca cuando alguien invente el séptimo título.
  //
  // ⚠️ Y NO se traga las secciones internas: medido el 15-sep-2026 sobre `docs/master/`, de los
  // 153 encabezados invisibles sólo **59** llevan ancla. Los otros **94** —`# PUNTO 1`,
  // `# TRAMO 2` sin medición, `# Qué se construyó`— siguen invisibles, que es justo lo que
  // impide que esto parta por cualquier sección de 496 ficheros. Un guard demasiado amplio
  // acaba relajado.
  const traeAnclaPropia = (i) => {
    let fin = lineas.length;
    for (let j = i + 1; j < lineas.length; j++) {
      if (!enCodigo[j] && /^# /.test(lineas[j])) { fin = j; break; }
    }
    return /\*\*Medido contra:\*\*/.test(lineas.slice(i, fin).join('\n'));
  };

  // 🔴 Y UN CORTE NO PUEDE DEJAR HUÉRFANO LO QUE CIERRA.
  //
  // Medido: `SCRUM-242.md` abre con `# SCRUM-242 · Recuperabilidad` y el ancla vive en el
  // encabezado SIGUIENTE (`# 🔴 HOY NO PODRÍAMOS…`). Lo mismo en `SCRUM-356` y `SCRUM-358`, con
  // un preámbulo en medio («Este fichero tiene TRES entradas»). Cortar ahí partía el título de
  // su propio cuerpo y dejaba una «entrada» sin ancla que antes sí la tenía — tres regresiones
  // que este ticket no venía a causar.
  //
  // La regla se deriva del principio que el troceador ya declaraba —que nada quede fuera de
  // alguna entrada—: el corte por ancla propia sólo se aplica si el trozo que se está cerrando
  // YA trae la suya. Si no, el encabezado era un título y lo de abajo es su cuerpo. No es un
  // caso especial: un `# SCRUM-<n>` o un APÉNDICE siguen cortando siempre, tengan o no ancla.
  const cortes = [];
  let acumulaDesde = 0;
  for (let i = 0; i < lineas.length; i++) {
    if (enCodigo[i] || !/^# /.test(lineas[i])) continue;
    const canonico = esEncabezadoDeEntrada(lineas[i]);
    const anclaDelTrozoAbierto = /\*\*Medido contra:\*\*/.test(lineas.slice(acumulaDesde, i).join('\n'));
    if (canonico || (traeAnclaPropia(i) && (cortes.length === 0 ? false : anclaDelTrozoAbierto))) {
      cortes.push(i);
      acumulaDesde = i;
    }
  }
  if (!cortes.length) return [];
  return cortes.map((ini, k) => {
    const desde = k === 0 ? 0 : ini;
    const hasta = k + 1 < cortes.length ? cortes[k + 1] : lineas.length;
    return {
      indice: k + 1,                       // 1-based: los apéndices se añaden AL FINAL, así que no corre
      linea: ini + 1,                      // 1-based, para el mensaje de error
      titulo: lineas[ini].slice(0, 80),
      // 🔴 SCRUM-859 · el de arriba va RECORTADO A 80 para que quepa en los mensajes, y por eso
      // NO puede ser la identidad: dos entradas que coincidan en los primeros 80 caracteres
      // compartirían clave, y una taparía a la otra. La identidad usa la línea entera.
      tituloCompleto: lineas[ini],
      cuerpo: lineas.slice(desde, hasta).join('\n'),
    };
  });
}

/** Todas las entradas del registro, con su fichero. La unidad que vigila este guard. */
/**
 * 🔴 SCRUM-859 · LA CLAVE DE UNA ENTRADA ES SU TÍTULO, NO SU POSICIÓN.
 *
 * Hasta aquí era `fichero#<ordinal>`. Eso se rompe entero en cuanto entra una entrada nueva por
 * delante: SCRUM-859 hizo visibles 59 secciones que el troceador no veía, y **las 55 claves de
 * la lista de exentas se desplazaron a la vez**, tirando cuatro tests del propio guard. No es la
 * primera vez —es la sexta que esta casa se come lo mismo—, y por eso lo dice su canon:
 *
 *   🔒 Referenciar por posición caduca. Referenciar por identidad no.
 *
 * El título es lo único de una entrada que no se mueve al insertar algo delante.
 *
 * ⚠️ Y NO ES ÚNICO SIEMPRE: medido el 15-sep-2026 sobre `docs/master/`, `SCRUM-300.md` repite
 * dos títulos. Repetir el título no puede hacer que dos entradas compartan clave —una taparía a
 * la otra y la lista encogería en silencio—, así que la repetición se desempata con `~2`, `~3`…
 * en el orden en que aparecen DENTRO de su fichero. Sigue siendo estable ante una inserción en
 * otro sitio, que es lo que se rompía.
 */
export function identidadDeEntrada(titulo) {
  return String(titulo).replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim();
}

function entradasTroceadas() {
  return entradas().flatMap((f) => {
    const vistos = new Map();
    return trocearEntradas(f.texto).map((e) => {
      const id = identidadDeEntrada(e.tituloCompleto);
      const n = (vistos.get(id) || 0) + 1;
      vistos.set(id, n);
      return { ...e, fichero: f.nombre, clave: `${f.nombre}#${id}${n > 1 ? `~${n}` : ''}` };
    });
  });
}

/** Devuelve el motivo por el que un texto NO lleva ancla válida, o `null` si la lleva. */
export function motivoSinAncla(texto) {
  // SCRUM-859 · sin `^`: el ancla puede ir detrás de `**Fecha:** … ·`, y va así en dos entradas
  // del árbol. Lo que se exige debajo no cambia.
  if (!/\*\*Medido contra:\*\*/.test(texto)) return 'no declara «Medido contra»';
  const m = RE_ANCLA.exec(texto);
  if (!m) {
    // Diagnóstico útil: distinguir el sha corto de la hora ausente ahorra el viaje de vuelta.
    const linea = (/^.*\*\*Medido contra:\*\*.*$/m.exec(texto) || [''])[0];
    if (/`[0-9a-f]{7,39}`/.test(linea)) return 'el sha está ABREVIADO (hacen falta las 40 posiciones)';
    if (!/\d{2}:\d{2}/.test(linea)) return 'falta la HORA (la fecha sola no dice si caducó)';
    return `el ancla no tiene la forma esperada: ${JSON.stringify(linea)}`;
  }
  return null;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-267 · ① el validador reconoce un ancla buena y las tres formas de mala', () => {
  const bueno = '**Medido contra:** `origin/main` = `745955bae433854c960ccf276cce755a8b61bd6d` · 2026-08-03T18:20:00+02:00';
  assert.equal(motivoSinAncla(`# X\n\n${bueno}\n`), null, '🔴 no reconoce un ancla correcta');

  // Y con `Z`, que también es ISO válido.
  assert.equal(motivoSinAncla('**Medido contra:** `origin/main` = `745955bae433854c960ccf276cce755a8b61bd6d` · 2026-08-03T16:20:00Z'),
    null, '🔴 rechaza el huso en Z, que es ISO-8601 igual de válido');

  assert.match(motivoSinAncla('# X\n\nsin nada\n'), /no declara/,
    '🔴 no detecta la ausencia del campo');
  assert.match(motivoSinAncla('**Medido contra:** `origin/main` = `745955b` · 2026-08-03T18:20:00+02:00'), /ABREVIADO/,
    '🔴 acepta un sha corto. `1bb0b5e` aparece en tres ramas distintas de este repo: si el ancla ' +
    'no distingue commits, no ancla nada.');
  assert.match(motivoSinAncla('**Medido contra:** `origin/main` = `745955bae433854c960ccf276cce755a8b61bd6d` · 2026-08-03'), /HORA/,
    '🔴 acepta una fecha sin hora. El incidente que originó el ticket fue una medición CORRECTA ' +
    'que caducó en una hora: sin hora, el ancla no distingue eso de una recién hecha.');
});

test('SCRUM-267 · ② el barrido encuentra entradas de verdad', () => {
  // Sin esto, el guard de abajo pasaría en verde con el directorio vacío o renombrado: cero
  // entradas sin ancla y cero entradas es la misma respuesta.
  const e = entradas();
  assert.ok(e.length > 0,
    '🔴 no se ha encontrado NINGUNA entrada en docs/master/. El verde del guard de abajo no ' +
    'significaría «todas llevan ancla», sino «no se miró». Revisa que el directorio existe y que ' +
    'los ficheros siguen `SCRUM-<n>.md`.');
});

// ── EL CENSO HEREDADO ────────────────────────────────────────────────────────────────────
//
// Entradas que YA existían en `docs/master/` cuando este guard entró, escritas cuando el formato
// declarado en el README **todavía no incluía el campo**. Quien las escribió hizo lo correcto
// según la documentación vigente: exigirles una regla que no estaba escrita sería castigar a
// quien siguió el README.
//
// ⚠️ ESTO NO ES UNA ALLOWLIST, y la distinción es exactamente la que separa un censo que se
// cierra de uno que crece:
//
//   ① **NO PUEDE CRECER.** Cualquier fichero de `docs/master/` que no esté aquí necesita ancla o
//      es rojo. El conjunto queda CERRADO en el mismo commit que lo crea — no hay forma de
//      añadirse a él después, porque añadirse es editar este fichero y eso se ve en el diff.
//   ② **SI EL NÚMERO BAJA, TAMBIÉN FALLA.** Igual que el ratchet de SCRUM-243 y el censo de
//      SCRUM-273: cuando alguien le ponga su ancla a una de éstas, el guard le obliga a
//      actualizar el número, y la mejora queda ANOTADA en vez de pasar desapercibida.
//
// El motivo es uno solo y es verdadero para las tres: no es una excepción concedida, es una fecha.
//
// NO SE VAN A RELLENAR, y es decisión del fundador con su razón escrita: el ancla sirve para saber
// si una afirmación sobre `main` ha caducado, y **nadie relee la entrada de un ticket ya cerrado
// para decidir nada**. Su valor es PROSPECTIVO. Hacer que tres sesiones paren para reconstruir
// mediciones que nadie va a consultar sería coste sin beneficio — y reconstruirlas sería
// inventarlas, que es peor que no tenerlas.
// SCRUM-244 SALIO del censo el 10-ago-2026: su seccion 1(b) trae el campo `Medido contra:`, asi
// que el fichero ya tiene ancla y el guard lo canto solo. Quedan DOS. Este apunte es el requisito
// del propio guard: si bajar fuese silencioso, el censo declararia tres excepciones habiendo dos.
// ── SCRUM-516 · LAS EXENTAS, POR LISTA NOMINAL Y CERRADA ─────────────────────────────────
//
// 🔴 ESTO NO ES BAJAR EL LISTÓN: **`RE_ANCLA` no se ha tocado.** Lo que cambia es la UNIDAD que se
// mira (entrada, no fichero). Al mirar por entrada aparecieron 31 entradas que el guard nunca había
// mirado — no son regresiones nuevas, son las que llevaban ahí desde siempre tapadas por el ancla
// buena de la primera entrada de su fichero.
//
// Medido el 19-ago-2026 contra `origin/main` = `d59d5cd97546e394bdb027dea59c9cb6ba1f587b`:
// 226 ficheros · 317 entradas · 286 con ancla · 31 sin ella. **El fundador decidió qué hacer con
// esas 31, y la decisión se aplicó: 4 arregladas, 27 exentas.**
//
// ── EL PRINCIPIO QUE DECIDE, y va en las dos direcciones ─────────────────────────────────
//
//   **Un ancla que nadie midió NO SE ESCRIBE NUNCA.** Reconstruir contra qué `main` se midió algo
//   hace meses es FABRICAR una medición — justo lo que este guard existe para impedir. Vaciar la
//   lista inventando anclas sería usar la barrera para producir el daño que previene.
//
//   Y su reverso, para que no sea la salida fácil: **lo que SÍ se puede recuperar sin inventar, SE
//   RECUPERA.** Eximir un dato que existe y sólo está mal escrito no es prudencia, es pereza con
//   coartada.
//
// ── LAS 4 QUE SE ARREGLARON (ya no están en esta lista) ──────────────────────────────────
//
//   · `397#4` y `397#5` — la fecha iba entre backticks. El dato estaba completo y sobraban dos
//     caracteres: se quitaron. No se tocó ni el sha ni la hora.
//   · `290#2` (`22d8e84`) y `447#2` (`8a57b9cd`) — sha abreviado, EXPANDIDO. Completar un prefijo
//     no inventa nada, pero sólo vale si resuelve a un commit real y único, así que se comprobó
//     antes: `git rev-parse --disambiguate` devuelve **1 solo objeto** para cada uno, `cat-file -t`
//     dice **commit**, y los dos son **ancestros de `origin/main`** — que es justo lo que el ancla
//     afirmaba. Si alguno hubiera salido ambiguo o inexistente, se habría quedado exento.
//
// ── POR QUÉ LAS 27 RESTANTES NO SE PUEDEN ARREGLAR ──────────────────────────────────────
//
//   · **23 no declaran «Medido contra» en absoluto.** El dato NO EXISTE; no está mal escrito.
//     Escribirlo ahora sería inventarlo.
//   · **4 lo declaran SIN HORA** (`268#2`, `273#2`, `406#2`, `409#2`). La fecha está, la hora no se
//     tomó. ⚠️ **La hora del commit que las escribió NO es la hora de la medición** — usarla sería
//     inventar con apariencia de precisión, que es la peor de las dos formas de inventar.
//
// ── CÓMO SE EXIME, y esto es lo que decide si el arreglo dura ────────────────────────────
//
//   ⛔ NO por umbral. NO por fecha de corte. NO por una regla «las anteriores a X pasan». Un umbral
//      es un trinquete calibrado al número cómodo, y autoriza la copia número 28.
//   ✅ Por LISTA EXPLÍCITA, entrada a entrada, con `fichero#índice` y motivo.
//
//   🔴 Y LA PROPIEDAD QUE LA CONVIERTE EN TRINQUETE DE VERDAD: **esta lista NO PUEDE CRECER.** Hay
//   un test (`las exentas son EXACTAMENTE éstas`) que falla si aparece una entrada sin ancla que no
//   esté aquí. Añadir una sólo se puede haciendo editar este objeto, y eso se ve en el diff — que
//   es exactamente la diferencia entre un censo que se cierra y una allowlist que crece sola.
const SIN_DATO = 'no declara «Medido contra» — el dato NO EXISTE, no está mal escrito: escribirlo ahora sería inventarlo';
const SIN_HORA = 'declara la fecha pero NO la hora, y la hora no se tomó — la del commit que la escribió no es la de la medición';
const ANTERIOR_AL_GUARD = 'anterior a SCRUM-267 — el formato existía sin el campo';

const HEREDADAS_SIN_ANCLA = {
  'SCRUM-231.md#SCRUM-231 · CACHE-EDGE-1: la cabecera que no salía del repo era de Cloudflare': ANTERIOR_AL_GUARD,
  'SCRUM-264.md#SCRUM-264 · MICROCOPY-SIN-LINEAS: los dos textos aprobados, y el copy que no llegaba a la pantalla': ANTERIOR_AL_GUARD,

  // Sin «Medido contra» (23 con las dos de arriba incluidas más abajo por fichero)
  'SCRUM-242.md#SCRUM-242 · segunda entrega: EL RUNBOOK, ESCRITO Y **PROBADO**': SIN_DATO,
  'SCRUM-242.md#SCRUM-242 · tercera entrega: ③ QUÉ DISPARA EL VOLCADO — **medición y propuesta**': SIN_DATO,
  'SCRUM-242.md#SCRUM-242 · cuarta entrega: ① EL BASE64 — el techo pasa de **8 fotos a 76**': SIN_DATO,
  'SCRUM-244.md#SCRUM-244 · RGPD: el borrado ya no revienta a mitad — y el resto queda a dictamen': SIN_DATO,
  'SCRUM-244.md#SCRUM-244 · punto 3 (parte 1 de 2): EL REGISTRO de que se ejerció el derecho': SIN_DATO,
  'SCRUM-244.md#SCRUM-244 · punto 2: LA COBERTURA — «dame TODO lo mío», derivado y no enumerado': SIN_DATO,
  'SCRUM-244.md#SCRUM-244 · punto 3: LA PUERTA — el profesional ejerce el derecho desde su cuenta': SIN_DATO,
  'SCRUM-244.md#SCRUM-244 · la descarga de portabilidad, EN EL MENÚ (donde se puede pulsar)': SIN_DATO,
  'SCRUM-244.md#SCRUM-244 · los textos aprobados sustituyen a los marcadores (paso 3 CERRADO)': SIN_DATO,
  'SCRUM-328.md#SCRUM-328 · F1 FASE 2 · CONTRASTE: lo que la landing PROMETE contra lo que el producto HACE': SIN_DATO,
  'SCRUM-328.md#SCRUM-328 · F1 fase 1 · INVENTARIO MEDIDO de lo que el producto hace HOY': SIN_DATO,
  'SCRUM-328.md#SCRUM-328 · F1 · EL AVISO DEL FALLO MUDO DE BIZUM': SIN_DATO,
  'SCRUM-328.md#SCRUM-328 · F1 · ¿SE PUEDE ENCENDER `BIZUM_MANUAL_ENABLED` HOY?': SIN_DATO,
  'SCRUM-397.md#SCRUM-397 · B · el código — ALCANCE MEDIDO, **no construido**. Y por qué paro.': SIN_DATO,
  'SCRUM-397.md#SCRUM-397 · B · el código — ENTREGADO': SIN_DATO,
  'SCRUM-445.md#SCRUM-445 · segunda entrega: las dos consultas (sin ejecutar) y el vínculo escrito': SIN_DATO,
  'SCRUM-446.md#SCRUM-446 · segunda entrega: el constructor, y una QUINTA diferencia — paro otra vez': SIN_DATO,
  'SCRUM-446.md#SCRUM-446 · tercera entrega: las 7 imperativas migradas · 17 pendientes': SIN_DATO,
  'SCRUM-467.md#SCRUM-467 · CERRADO · los tres construidos': SIN_DATO,
  'SCRUM-485.md#SCRUM-485 · SEGUNDA ENTREGA · la retirada que PARO, y el primer paso sobre los 189': SIN_DATO,

  // Con fecha pero sin hora
  'SCRUM-268.md#SCRUM-268 · Punto 3 — un guard: nadie espera el turno en un bucle y lo toma': SIN_HORA,
  'SCRUM-273.md#SCRUM-273 (parte 2) · el mensaje del guard enuncia LA ALTERNATIVA': SIN_HORA,
  'SCRUM-406.md#SCRUM-406 (parte 2) · un canal prometido existe, y un «escríbenos» tiene destino': SIN_HORA,
  'SCRUM-409.md#SCRUM-409 (fase 5) · Las tres ramas pesadas, leídas una a una': SIN_HORA,
};

// ── SCRUM-532 · EL SEGUNDO CENSO, Y VA APARTE A PROPÓSITO ────────────────────────────────
//
// Al ensanchar el delimitador para que vea los `# APÉNDICE`, **28 entradas que llevaban ahí desde
// siempre quedaron a la vista por primera vez** (15-sep-2026). No son regresiones: son las que el
// troceador viejo metía dentro de la entrada de arriba, cuya ancla buena las tapaba. Es palabra por
// palabra lo que pasó el 19-ago-2026 con las 31 de SCRUM-516, un delimitador más abajo.
//
// 🔴 POR QUÉ NO SE AÑADEN A `HEREDADAS_SIN_ANCLA` Y ESTO NO ES UN TECNICISMO:
//
//   Aquella lista está CERRADA por decisión del fundador del 19-ago-2026 y su propiedad declarada
//   es que **no puede crecer**. Engordarla de 27 a 55 borraría esa propiedad — y el día que alguien
//   quiera saber si el trinquete aguantó, el número no se lo podrá decir. **Un censo cerrado que se
//   reabre deja de ser un censo cerrado, aunque el motivo sea bueno.**
//
//   Separados, cada uno conserva su número, su fecha y su causa: 27 por la unidad de SCRUM-516,
//   28 por el delimitador de SCRUM-532. Y los dos llevan el mismo trinquete: ni crecen, ni bajan
//   en silencio.
//
// ⚠️ ESTA LISTA ESTÁ PENDIENTE DE LA FIRMA DEL FUNDADOR, igual que lo estuvieron las 27. La sesión
// mide y propone; eximir lo decide él. Lo que NO estaba en su mano es no verlas: hasta hoy el guard
// ni las miraba.
//
// ── EL TRIAJE, ENTRADA A ENTRADA (y una SÍ se pudo recuperar) ────────────────────────────
//
//   ✅ `SCRUM-814.md#2` **NO ESTÁ AQUÍ porque se ARREGLÓ**: traía sha de 40, fecha, hora y huso
//      completos, y sólo el formato no era ISO (`2026-09-07 21:34:56 +0100`). Se reescribió a
//      `2026-09-07T21:34:56+01:00` — ni un dato inventado, dos caracteres movidos. Comprobado
//      antes: el sha existe, `cat-file -t` dice commit y es ancestro de `origin/main`. Es el mismo
//      criterio que sacó a `397#4/#5` de la otra lista.
//
//   Las 28 que quedan NO son recuperables, y cada clase por un motivo distinto:
//
//   · **14 no declaran «Medido contra»** — el dato no existe. Escribirlo hoy sería inventarlo.
//   · **6 traen el sha ABREVIADO** — y **a las seis les falta además la HORA**, así que expandir el
//     prefijo no las salvaría: quedaría un ancla a medias. Se comprobó antes de eximirlas.
//   · **6 declaran la fecha SIN la hora** — misma razón que las 4 de la lista de arriba.
//   · **2 declaran OTRA BASE a propósito** (`630#2` mide contra «esta misma rama», `821#2` contra el
//     `merge-base` y lo dice). 🔴 Reescribirlas como `origin/main` sería **falsear una medición que
//     su autor hizo bien y anotó con precisión**: el ancla pasaría a afirmar algo que nadie midió.
//     Ésta es la peor de las reparaciones posibles y por eso se nombra aparte.
const SIN_HORA_Y_SHA_CORTO = 'sha ABREVIADO y además SIN HORA — expandir el prefijo dejaría el ancla a medias, y la hora no se tomó';
const OTRA_BASE = 'declara a propósito una base distinta de `origin/main`, y lo dice — reescribirla como `origin/main` sería falsear una medición bien hecha';

const TAPADAS_POR_EL_TROCEADOR = {
  // No declaran «Medido contra» (14)
  'SCRUM-582.md#APÉNDICE · 6-sep-2026 — EL MECANISMO YA ESTABA. LO QUE FALTABA ERAN LAS MEDIDAS': SIN_DATO,
  'SCRUM-586.md#APÉNDICE 2 · 6-sep-2026 — ✅ MICROCOPY FIRMADA POR EL ASESOR, Y EL MARCADOR RETIRADO': SIN_DATO,
  'SCRUM-590.md#APÉNDICE · 7-sep-2026 — LA CONSTRUCCIÓN': SIN_DATO,
  'SCRUM-615.md#APÉNDICE · 24-ago-2026 · EJECUTADAS LAS SALIDAS D y C': SIN_DATO,
  'SCRUM-638.md#APÉNDICE · 1-sep-2026 · EL CÓDIGO DEL RUNNER **NO SE PUEDE LEER DESDE AQUÍ**': SIN_DATO,
  'SCRUM-728.md#APÉNDICE · 8-sep-2026 · SCRUM-728d (2) · LA MEDICIÓN, EN LOOPBACK': SIN_DATO,
  'SCRUM-745.md#APÉNDICE · SCRUM-745 (adopción) · Que ningún guard del censo pueda estar mudo sin que se vea': SIN_DATO,
  'SCRUM-748.md#APÉNDICE · SCRUM-748 (2/2) · El guard nunca estuvo mudo. Lo estaba el rótulo.': SIN_DATO,
  'SCRUM-804.md#APÉNDICE · 8-sep-2026 · La dimensión que le faltaba al censo: EN MAIN, EN RAMA VIVA, SIN RASTRO': SIN_DATO,
  'SCRUM-804.md#APÉNDICE · 8-sep-2026 · SCRUM-804b · El caso INVERSO: trabajo vivo sobre tickets CERRADOS': SIN_DATO,
  'SCRUM-804.md#APÉNDICE · 8-sep-2026 · SCRUM-804b (2ª parte) · La comparación por CONTENIDO': SIN_DATO,
  'SCRUM-816.md#APÉNDICE · 8-sep-2026 · CERTIFICACIÓN POR UNA SEGUNDA SESIÓN, y un flaky cerrado': SIN_DATO,
  'SCRUM-824.md#📎 APÉNDICE · SCRUM-824b': SIN_DATO,

  // Sha abreviado Y sin hora (6)
  'SCRUM-600.md#APÉNDICE · 8-sep-2026 · DOC-10 CODIFICADO — la factura suelta usa la página del presupuesto': SIN_HORA_Y_SHA_CORTO,
  'SCRUM-630.md#APÉNDICE · 8-sep-2026 — CERTIFICACIÓN Y CIERRE, tres semanas después': SIN_HORA_Y_SHA_CORTO,
  'SCRUM-631.md#APÉNDICE · S2 (5-sep-2026) — EL CALLEJÓN PROVOCADO, Y UNA AFIRMACIÓN MÍA QUE LA MEDICIÓN TUMBA': SIN_HORA_Y_SHA_CORTO,
  'SCRUM-631.md#APÉNDICE 2 · S2 (5-sep-2026) — LA OPCIÓN B, CON SU VIGILANTE': SIN_HORA_Y_SHA_CORTO,
  'SCRUM-728.md#APÉNDICE · 8-sep-2026 · SCRUM-728d · LA FACTURA NO HACE CINCO VIAJES': SIN_HORA_Y_SHA_CORTO,
  'SCRUM-762.md#APÉNDICE (7-sep-2026) · el control ya no vive en una sesión: vive en la tanda': SIN_HORA_Y_SHA_CORTO,

  // Con fecha pero sin hora (6)
  'SCRUM-474.md#APÉNDICE · SCRUM-474 (2) · el LECTOR: el filtro deja de partir las tarjetas': SIN_HORA,
  'SCRUM-578.md#APÉNDICE · 24-ago-2026 · ENTREGADOS (a) (b) (c) (d)': SIN_HORA,
  'SCRUM-586.md#APÉNDICE · 6-sep-2026 — SE CONSTRUYE LA MITAD QUE NO DEPENDE DEL ESQUEMA': SIN_HORA,
  'SCRUM-600.md#APÉNDICE · 8-sep-2026 · SCRUM-600c · ¿CUÁNTO FALTA? LAS DOS PANTALLAS COMO CONJUNTOS': SIN_HORA,
  'SCRUM-600.md#APÉNDICE · 8-sep-2026 · SCRUM-600d · EL ENVÍO, QUE FALTABA POR UN `return`': SIN_HORA,
  'SCRUM-600.md#APÉNDICE · 8-sep-2026 · SCRUM-600e · «3. CONDICIONES»: EL REPARTO ERA OTRO': SIN_HORA,

  // Miden contra otra base, y lo dicen (2)
  'SCRUM-630.md#APÉNDICE · SCRUM-630 (2/2) — el test medía la máquina, no el defecto': OTRA_BASE,
  'SCRUM-821.md#APÉNDICE · 8-sep-2026 — EL ✅ POSITIVO QUE FALTABA: las que ya se fotografiaban, por HASH DE IMAGEN': OTRA_BASE,
};

/**
 * Las exentas, las de los DOS censos. Se unen para preguntar «¿está exenta?» y NUNCA para contarlas:
 * cada censo declara su propio número y cada uno cae por su lado.
 */
// 🔴 SCRUM-859 · EL MOTIVO QUE SE CIERRA SOLO
//
// Estas cinco NO están exentas porque les falte la hora: están exentas porque **el troceador
// nunca las vio**. Eran secciones internas para el guard —`# 11-ago-2026 · …`, `# FASE B …`—
// así que nadie pudo pedirles nunca su hora. SCRUM-859 las hace visibles, y su hora no está en
// ninguna parte: escribirla ahora sería fabricar una medición, que es justo lo que este guard
// existe para impedir.
//
// 🔴 Y EL MOTIVO ES UN CONJUNTO CERRADO, vigilado por el guard y no por la memoria de nadie:
// **un SEXTO uso de `INVISIBLE_HASTA_859` lo tumba** (ver `TOPE_INVISIBLE_HASTA_859` abajo).
// Después de SCRUM-859 ya nada es invisible hasta SCRUM-859, así que nada escrito a partir de
// hoy puede alegar este motivo. Un límite declarado y no cerrado deja de ser advertencia y pasa
// a ser permiso.
const INVISIBLE_HASTA_859 = 'el troceador NUNCA la vio (era sección interna hasta SCRUM-859), '
  + 'así que nadie pudo pedirle la hora — y la hora no se tomó: escribirla ahora sería inventarla';

/** Cerrado a las CINCO que había el 15-sep-2026. Un sexto uso tumba el guard. */
const TOPE_INVISIBLE_HASTA_859 = 5;

const LAS_INVISIBLES_HASTA_859 = {
  'SCRUM-358.md#11-ago-2026 · EL ALTA DE ALBARÁN, IDEMPOTENTE (mitad de SERVIDOR)': INVISIBLE_HASTA_859,
  'SCRUM-655.md#FASE B (2-sep-2026) · `revision.ts` YA TIENE LLAMADOR — y era el último': INVISIBLE_HASTA_859,
  'SCRUM-728.md#FASE D · 8-sep-2026 · LO QUE VE EL SEXTO PROFESIONAL': INVISIBLE_HASTA_859,
  'SCRUM-814.md#7-sep-2026 · EL ARREGLO — camino B, y lo que se llevó por delante': INVISIBLE_HASTA_859,
  'SCRUM-814.md#8-sep-2026 · LOS OTROS DOS CAMINOS — y lo que cedí al mezclar': INVISIBLE_HASTA_859,
};

const EXENTAS = { ...HEREDADAS_SIN_ANCLA, ...TAPADAS_POR_EL_TROCEADOR, ...LAS_INVISIBLES_HASTA_859 };

// 🔴 SUELO DE LA UNIÓN: dos censos que compartieran una clave se taparían el uno al otro y la suma
// de los números declarados dejaría de cuadrar con el total, en silencio.
{
  const tres = [HEREDADAS_SIN_ANCLA, TAPADAS_POR_EL_TROCEADOR, LAS_INVISIBLES_HASTA_859];
  const repetidas = tres.flatMap((a, i) => Object.keys(a).filter((k) => tres.some((b, j) => j !== i && k in b)));
  if (repetidas.length) throw new Error(`🔴 los dos censos nombran la misma entrada: ${repetidas.join(', ')}`);
}

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-267 · toda entrada NUEVA del registro declara contra qué main se midió, y cuándo', () => {
  // SCRUM-516: se recorre ENTRADA POR ENTRADA. Antes se leía el fichero entero y, con `/m`, un
  // ancla buena en la primera entrada tapaba una rota en el apéndice — el hueco por el que se
  // coló un sha de 7 caracteres el 17-ago-2026 con los cuatro guards en 17/17.
  const sinAncla = entradasTroceadas()
    .map((e) => ({ clave: e.clave, linea: e.linea, titulo: e.titulo, motivo: motivoSinAncla(e.cuerpo) }))
    .filter((e) => e.motivo && !(e.clave in EXENTAS))
    .map((e) => `${e.clave} (línea ${e.linea}) — ${e.motivo}\n        ${e.titulo}`);

  assert.deepEqual(sinAncla, [],
    '🔴 HAY ENTRADAS DEL REGISTRO SIN ANCLA DE MEDICIÓN:\n    ' + sinAncla.join('\n    ') +
    '\n\n  Una entrada que afirma algo sobre el estado del repo sin decir contra qué `main` lo\n' +
    '  comprobó no se puede verificar después: quien la lee no sabe si sigue siendo cierta.\n\n' +
    '  Pasó dos veces el mismo día. Javier PARÓ ante una contradicción entre Jira y el máster sin\n' +
    '  forma de saber cuál estaba viejo; y una medición CORRECTA caducó en una hora porque `main`\n' +
    '  se movió tres veces. El problema no es medir mal: es que una medición buena no lleva su\n' +
    '  fecha de caducidad encima.\n\n' +
    '  Añade al encabezado, con el sha COMPLETO (40) y hora con huso:\n' +
    '    **Medido contra:** `origin/main` = `<sha40>` · <ISO-8601>\n\n' +
    '  El sha corto no vale: `1bb0b5e` aparece en tres ramas distintas de este repo esta semana.\n\n  Y NO ES EL UNICO que vigila una entrada del registro: son CUATRO, y cada sesion los ha\n  ido descubriendo EN ROJO despues de empujar. Compruebalos todos antes con\n  `npm run guards:entrada` (segundos: no compila ni toca la base).');
});

// ── SCRUM-516 · EL CONTROL QUE DECIDE ────────────────────────────────────────────────────

test('SCRUM-267 · 🔴 un APÉNDICE con el ancla rota cae, aunque las entradas previas estén bien', () => {
  // ÉSTE es el caso que el 17-ago-2026 pasaba en verde, y es el motivo entero de SCRUM-516.
  // Se construye el fichero sintético con la MISMA forma que produce SCRUM-273: primera entrada
  // impecable, apéndice al final separado por `---`, y en el apéndice el sha ABREVIADO.
  const buena = '`origin/main` = `745955bae433854c960ccf276cce755a8b61bd6d` · 2026-08-03T18:20:00+02:00';
  const fichero = [
    '# SCRUM-999 · la primera entrada, impecable', '',
    `**Medido contra:** ${buena}`, '', 'cuerpo.', '',
    '---', '',
    '# SCRUM-999 · el apéndice, con el sha ABREVIADO', '',
    '**Medido contra:** `origin/main` = `745955b` · 2026-08-03T18:20:00+02:00', '', 'cuerpo.',
  ].join('\n');

  // (a) Como lo miraba el guard viejo —el fichero entero— el apéndice roto NO se ve.
  assert.equal(motivoSinAncla(fichero), null,
    '🔴 la premisa de SCRUM-516 ha dejado de ser cierta: el fichero entero ya NO pasa. Si el '
    + 'defecto se arregló por otra vía, este control sobra y hay que rehacerlo, no relajarlo.');

  // (b) Troceado por entradas, el apéndice cae Y SE DICE CUÁL.
  const trozos = trocearEntradas(fichero);
  assert.equal(trozos.length, 2, '🔴 el troceador no ve las dos entradas del fichero sintético.');
  assert.equal(motivoSinAncla(trozos[0].cuerpo), null, '🔴 acusa a la primera entrada, que está bien.');
  assert.match(motivoSinAncla(trozos[1].cuerpo), /ABREVIADO/,
    '🔴 EL APÉNDICE CON EL ANCLA ROTA SIGUE PASANDO.\n\n'
    + '  Es exactamente lo que se midió el 17-ago-2026: un sha de 7 caracteres en la tercera\n'
    + '  entrada de un fichero, y los cuatro guards en 17/17. Sin este control, SCRUM-516 no\n'
    + '  ha arreglado nada.');
});

test('SCRUM-267 · 🔴 SUELO: el troceador VE entradas, y sabe saltar los bloques cercados', () => {
  // ① Que troceando el repo real salgan entradas. Cero entradas y cero entradas sin ancla son la
  //    misma respuesta, y una de las dos es ceguera.
  const todas = entradasTroceadas();
  assert.ok(todas.length > 0,
    '🔴 el troceo del registro ha devuelto CERO entradas. El verde del guard de arriba no diría '
    + '«todas llevan ancla», diría «no se supo mirar». Un cero aquí es ceguera, no salud.');
  assert.ok(todas.length >= entradas().length,
    `🔴 hay ${todas.length} entradas para ${entradas().length} ficheros: el troceador está `
    + 'perdiendo ficheros enteros. Cada fichero aporta AL MENOS una entrada.');

  // ② Que no invente: un `# SCRUM-` dentro de un bloque cercado NO es una entrada. Hay dos casos
  //    reales en `SCRUM-480.md`, así que esto no es una hipótesis de laboratorio.
  const conCercado = ['# SCRUM-1 · de verdad', '', '**Medido contra:** `origin/main` = '
    + '`745955bae433854c960ccf276cce755a8b61bd6d` · 2026-08-03T18:20:00+02:00', '',
    '```', '# SCRUM-2 · esto es un EJEMPLO dentro de un bloque, no una entrada', '```', ''].join('\n');
  assert.equal(trocearEntradas(conCercado).length, 1,
    '🔴 el troceador cuenta como entrada un `# SCRUM-` que vive DENTRO de un bloque cercado. '
    + 'Inventaría entradas fantasma —sin ancla, porque no son entradas— y el guard acusaría a '
    + 'quien pegó un ejemplo en su registro.');

  // ③ Que sepa decir que NO ve nada, en vez de devolver algo.
  assert.deepEqual(trocearEntradas('sin ningun encabezado\n'), [],
    '🔴 el troceador devuelve entradas donde no hay encabezado. Si se inventa una, el guard mide '
    + 'un trozo que nadie escribió.');
});

test('SCRUM-267 · 🔴 LAS EXENTAS SON EXACTAMENTE ÉSTAS: la lista no puede crecer', () => {
  // 🔴 EL TRINQUETE. Sin esto, la lista de exentas es una allowlist: la entrada 28 se añade sola
  // el día que alguien escriba un apéndice sin ancla y le moleste el rojo.
  //
  // La decisión del fundador (19-ago-2026) fue eximir 27 POR LISTA NOMINAL, no por umbral ni por
  // fecha de corte: «un umbral es un trinquete calibrado al número cómodo, y autoriza la copia
  // número 28». Este test es lo que hace que esa decisión signifique algo — para meter una entrada
  // más hay que EDITAR `HEREDADAS_SIN_ANCLA`, y eso se ve en el diff.
  const sinAncla = entradasTroceadas().filter((e) => motivoSinAncla(e.cuerpo)).map((e) => e.clave);
  const exentas = Object.keys(EXENTAS);

  const nuevas = sinAncla.filter((c) => !exentas.includes(c));
  assert.deepEqual(nuevas, [],
    '🔴 HAY ENTRADAS SIN ANCLA QUE NO ESTÁN EN LA LISTA DE EXENTAS:\n    ' + nuevas.join('\n    ') +
    '\n\n  La lista de exentas está CERRADA desde el 19-ago-2026. No se amplía: se arregla la\n' +
    '  entrada nueva poniéndole su ancla, que para una entrada NUEVA siempre se puede porque\n' +
    '  la mides tú al escribirla.\n\n' +
    '  Y no vale «es igual que las otras 27»: aquéllas están exentas porque su dato NO EXISTE y\n' +
    '  reconstruirlo sería inventarlo. La tuya no tiene ese problema — todavía no la has medido.');

  // Y al revés: una exenta que ya no lo necesita tiene que salir, o el censo miente sobre sí mismo.
  const sobran = exentas.filter((c) => !sinAncla.includes(c));
  assert.deepEqual(sobran, [],
    '🔴 LA LISTA DE EXENTAS NOMBRA ENTRADAS QUE YA NO LO NECESITAN:\n    ' + sobran.join('\n    ') +
    '\n\n  O tienen ya su ancla, o han dejado de existir. En los dos casos hay que quitarlas de\n' +
    '  `HEREDADAS_SIN_ANCLA`: un censo que se describe a sí mismo mal deja de medir nada, y el\n' +
    '  número que declara —27— dejaría de ser comprobable.');
});

test('SCRUM-267 · 🔴 los números CUADRAN: con ancla + sin ancla + eximidas = el total', () => {
  // Un censo cuyas partes no suman no es un censo. Si el troceador perdiera entradas por el
  // camino, los tres números seguirían siendo plausibles por separado.
  const todas = entradasTroceadas();
  const conAncla = todas.filter((e) => !motivoSinAncla(e.cuerpo));
  const sinAncla = todas.filter((e) => motivoSinAncla(e.cuerpo));
  const eximidas = sinAncla.filter((e) => e.clave in EXENTAS);
  const acusadas = sinAncla.filter((e) => !(e.clave in EXENTAS));

  assert.equal(conAncla.length + sinAncla.length, todas.length,
    '🔴 «con ancla» + «sin ancla» no suman el total troceado.');
  assert.equal(eximidas.length + acusadas.length, sinAncla.length,
    '🔴 «eximidas» + «acusadas» no suman las que no llevan ancla.');
  assert.equal(acusadas.length, 0,
    `🔴 quedan ${acusadas.length} entradas acusadas y el guard de arriba debería haberlas cazado.`);

  // 🔴 LOS NÚMEROS DECLARADOS, COMPROBADOS — no derivados por resta, y CADA CENSO POR SEPARADO.
  //
  // Comprobar sólo la suma (55) dejaría pasar «he perdido una del primero y he ganado una del
  // segundo», que es justo la clase de compensación silenciosa que un censo existe para impedir.
  // Cada lista responde por su número y cae por su lado:
  //
  //   · 26 · SCRUM-516, 19-ago-2026 — al mirar por ENTRADA en vez de por fichero (4 arregladas).
  //          SCRUM-859 baja una más: `SCRUM-313#SEGUNDA ENTREGA` YA tiene su ancla — la
  //          reconoce el formato aprendido hoy. Que el censo baje por una MEJORA es lo que
  //          este guard pide que se anote.
  //   · 27 · SCRUM-532 — ídem: `SCRUM-745#APÉNDICE · FASE B` sale por la misma razón.
  //   ·  5 · SCRUM-859 — las que el troceador NUNCA vio. Motivo CERRADO: un sexto uso cae.
  //   · 28 · SCRUM-532, 15-sep-2026 — al ver los `# APÉNDICE` que el delimitador no veía
  //          (1 arreglada: `SCRUM-814.md#2`, cuyo dato estaba completo y sólo mal formateado).
  const porCenso = (censo) => eximidas.filter((e) => e.clave in censo).length;
  assert.equal(porCenso(HEREDADAS_SIN_ANCLA), 26,
    `🔴 el censo de SCRUM-516 declara 26 exentas y se han medido ${porCenso(HEREDADAS_SIN_ANCLA)}.\n\n`
    + '  Si has ARREGLADO una entrada, enhorabuena: bájalo aquí y quítala de '
    + '`HEREDADAS_SIN_ANCLA`.\n  Si has AÑADIDO una, no es el sitio — una entrada nueva se mide '
    + 'al escribirla.');
  assert.equal(porCenso(TAPADAS_POR_EL_TROCEADOR), 27,
    `🔴 el censo de SCRUM-532 declara 27 exentas y se han medido ${porCenso(TAPADAS_POR_EL_TROCEADOR)}.\n\n`
    + '  Son las que el troceador viejo metía dentro de la entrada de arriba. Si has arreglado '
    + 'una,\n  bájalo aquí y quítala de `TAPADAS_POR_EL_TROCEADOR`.');
    assert.equal(porCenso(LAS_INVISIBLES_HASTA_859), TOPE_INVISIBLE_HASTA_859,
    `🔴 ${porCenso(LAS_INVISIBLES_HASTA_859)} entradas alegan INVISIBLE_HASTA_859 y el motivo `
    + `está CERRADO en ${TOPE_INVISIBLE_HASTA_859}. Después de SCRUM-859 ya nada es invisible `
    + 'hasta SCRUM-859: lo que se escriba a partir de hoy lleva su ancla entera o no entra. Un '
    + 'límite declarado y no cerrado deja de ser advertencia y pasa a ser permiso.');
  assert.equal(eximidas.length, 58,
    `🔴 los TRES censos suman 58 y se han medido ${eximidas.length}: alguna clave está en los dos, `
    + 'o en ninguno.');
  assert.equal(conAncla.length + eximidas.length, todas.length,
    '🔴 «con ancla» + «exentas» no suman el total de entradas troceadas. O el troceador pierde '
    + 'entradas, o hay una acusada suelta que nadie está viendo.');
});

test('SCRUM-267 · el censo heredado no crece, y si BAJA hay que anotarlo', () => {
  const porClave = new Map(entradasTroceadas().map((e) => [e.clave, e]));

  // (a) Ninguna del censo puede haber desaparecido sin que se note: si alguien borra la entrada
  //     en vez de ponerle el ancla, el censo se quedaria describiendo un fichero que no existe.
  const fantasmas = Object.keys(EXENTAS).filter((n) => !porClave.has(n));
  assert.deepEqual(fantasmas, [],
    '🔴 el censo nombra entradas que ya no existen en docs/master/:\n    ' + fantasmas.join('\n    ') +
    '\n\n  Un censo que describe ficheros ausentes deja de medir nada. Quítalas de aquí.');

  // (b) Y si alguna YA tiene su ancla, el número tiene que bajar en el censo. Sin esto, la mejora
  //     pasaría desapercibida y el censo seguiría diciendo que hay tres cuando quedan dos.
  const yaConAncla = Object.keys(EXENTAS)
    .filter((n) => porClave.has(n) && !motivoSinAncla(porClave.get(n).cuerpo));

  assert.deepEqual(yaConAncla, [],
    '🔴 ESTAS ENTRADAS DEL CENSO YA TIENEN SU ANCLA:\n    ' + yaConAncla.join('\n    ') +
    '\n\n  Buena noticia, y el censo tiene que reflejarla: quítalas de `HEREDADAS_SIN_ANCLA`.\n\n' +
    '  Que el guard falle por una MEJORA es deliberado, y es la propiedad que separa este censo\n' +
    '  de una allowlist: si bajar fuese silencioso, el censo seguiría declarando tres excepciones\n' +
    '  cuando quedan dos, y nadie sabría nunca cuándo se vació del todo.');
});

// ── SCRUM-532 · EL CONTROL QUE DECIDE: ROMPER UN ANCLA DE VERDAD Y EXIGIR QUE CAIGA ──────
//
// 🔴 **Un guard que no se prueba rompiéndolo es una promesa, no una medición.** Los controles de
// SCRUM-516 usan un fichero SINTÉTICO, y un fichero sintético demuestra que el troceador sabe
// trocear lo que el autor del test imaginó. Éste usa el fichero REAL en el que el defecto se
// demostró —`SCRUM-825.md`, 8-sep-2026— y va en las tres direcciones que hacen falta:
//
//   ① POSITIVO · sin tocar nada, el fichero real sale LIMPIO. Sin esto, «valida por entrada» y
//      «falla siempre» dan el mismo rojo, y el ② no distinguiría uno de otro.
//   ② ROJO · se le rompe el ancla AL ÚLTIMO apéndice y el guard tiene que acusar **esa** entrada,
//      nombrándola. No basta con que haya rojo: un rojo que señala otra línea manda a quien lo lee
//      al sitio equivocado.
//   ③ EL ANTES · ese mismo texto roto, con el delimitador VIEJO, **pasaba**. Es lo que acredita
//      que el veredicto lo cambia el arreglo y no otra cosa del árbol.
//
// ⚠️ NO SE TOCA EL DISCO. La mutación es en memoria: un instrumento que muta el árbol se deja el
// árbol mutado el día que un aserto falla antes del `finally` (SCRUM-808).
//
// ⚠️ Y SE ROMPE POR LA ESTRUCTURA, NO POR TEXTO: la entrada a romper se localiza troceando y
// aplicando `RE_ANCLA` —las mismas funciones que vigila el guard—, nunca buscando una cadena a
// ojo. Este fichero contiene, en sus propios comentarios y ejemplos, las formas que persigue: un
// control que trabajara por coincidencia de texto se cazaría a sí mismo (SCRUM-349).
const CASO_REAL = 'SCRUM-825.md';

test('SCRUM-267 · 🔴 EL CONTROL QUE DECIDE: se rompe el ancla de un `# APÉNDICE` real y el guard CAE', () => {
  const texto = fs.readFileSync(path.join(DIR_REGISTRO, CASO_REAL), 'utf8');

  // ── ① CONTROL POSITIVO ────────────────────────────────────────────────────────────────
  const trozos = trocearEntradas(texto);
  assert.ok(trozos.length >= 4,
    `🔴 ${CASO_REAL} se trocea en ${trozos.length} entradas y el caso medido el 8-sep-2026 tenía `
    + 'CINCO anclas. Si el fichero cambió de forma, este control mide otra cosa: hay que rehacerlo '
    + 'sobre el fichero que hoy tenga apéndices, no borrarlo.');
  const apendices = trozos.filter((e) => !/^# SCRUM-\d+/.test(e.titulo));
  assert.ok(apendices.length > 0,
    `🔴 ${CASO_REAL} ya no tiene ningún apéndice encabezado \`# APÉNDICE\`, que es la forma que el `
    + 'troceador viejo no veía. Sin uno real, el ② de abajo no prueba nada.');
  assert.deepEqual(trozos.filter((e) => motivoSinAncla(e.cuerpo)).map((e) => e.titulo), [],
    `🔴 ${CASO_REAL} tiene entradas sin ancla ANTES de romper nada. El rojo del ② no significaría `
    + '«lo he roto yo»: ya estaba roto, y el control no distinguiría una cosa de la otra.');

  // ── ② EL ROJO ─────────────────────────────────────────────────────────────────────────
  // Se abrevia el sha del ÚLTIMO apéndice a 7 posiciones: exactamente lo que hizo la sesión el
  // 8-sep-2026 para demostrar que el guard no lo veía.
  const victima = apendices[apendices.length - 1];
  const anclaOriginal = RE_ANCLA.exec(victima.cuerpo);
  assert.ok(anclaOriginal, `🔴 el último apéndice de ${CASO_REAL} no tiene ancla que romper.`);
  const roto = texto.replace(anclaOriginal[0],
    anclaOriginal[0].replace(`\`${anclaOriginal[1]}\``, `\`${anclaOriginal[1].slice(0, 7)}\``));
  assert.notEqual(roto, texto, '🔴 la mutación no ha cambiado el texto: no se ha roto nada.');

  const acusadas = trocearEntradas(roto)
    .filter((e) => motivoSinAncla(e.cuerpo))
    .map((e) => ({ titulo: e.titulo, motivo: motivoSinAncla(e.cuerpo) }));

  assert.equal(acusadas.length, 1,
    `🔴 se ha roto UNA ancla y el guard acusa a ${acusadas.length} entradas: `
    + JSON.stringify(acusadas.map((a) => a.titulo)));
  assert.equal(acusadas[0].titulo, victima.titulo,
    `🔴 EL GUARD ACUSA A OTRA ENTRADA.\n\n  Rota: ${victima.titulo}\n  Acusada: ${acusadas[0].titulo}\n\n`
    + '  Un rojo que señala la entrada equivocada manda a quien lo lee a arreglar un ancla que '
    + 'estaba bien.');
  assert.match(acusadas[0].motivo, /ABREVIADO/,
    '🔴 el guard cae, pero no por el motivo que se ha provocado. Si el diagnóstico no coincide con '
    + 'la avería, el mensaje no sirve para arreglarla.');

  // ── ③ EL ANTES: con el delimitador VIEJO esto PASABA ──────────────────────────────────
  // Ésta es la prueba de que el arreglo es la causa del ② y no una casualidad del fichero.
  const lineas = roto.split('\n');
  const cortesViejos = lineas.map((l, i) => ({ l, i })).filter(({ l }) => /^# SCRUM-\d+/.test(l));
  const trozoViejo = lineas.slice(cortesViejos[cortesViejos.length - 1].i).join('\n');
  assert.equal(motivoSinAncla(trozoViejo), null,
    '🔴 LA PREMISA DE SCRUM-532 HA DEJADO DE SER CIERTA: con el delimitador VIEJO, el apéndice de '
    + 'sha abreviado YA saldría rojo.\n\n  Eso significa que el hueco se cerró por otra vía y este '
    + 'control está midiendo otra cosa. Hay que REHACERLO, no relajarlo.');
});

test('SCRUM-267 · el formato declarado en el README incluye el ancla', () => {
  // Un formato documentado que NO menciona lo que el guard exige es una trampa para el
  // siguiente: escribe su entrada siguiendo el README, y la suite le dice que está mal.
  const readme = fs.readFileSync(README, 'utf8');
  assert.match(readme, /\*\*Medido contra:\*\*/,
    '🔴 el README de docs/master/ describe el formato de una entrada y NO incluye el ancla que ' +
    'este guard exige. Quien lo siga al pie de la letra escribirá una entrada que sale roja — y ' +
    'la culpa será del formato, no suya.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-649 · QUE EL SHA TENGA FORMA DE SHA NO ES QUE EL COMMIT EXISTA
//
// `RE_ANCLA` comprueba la FORMA: 40 hexadecimales. Un ancla inventada —o con una errata de un
// carácter— tiene exactamente esa forma y pasaba en VERDE. Medido el 15-sep-2026 cambiando un
// dígito de un ancla real de `SCRUM-16.md:3`: el guard daba **0 rojos** sobre un ancla que no
// apunta a ningún sitio. Un ancla así no es un ancla: es una medición que nadie puede reproducir.
//
// Es el último agujero del sistema de anclas: SCRUM-516 arregló la unidad, SCRUM-532 el
// delimitador, SCRUM-859 el criterio y la identidad — y todo eso validaba anclas que podían no
// apuntar a nada.
//
// ── CÓMO SE RESUELVE, Y CONTRA QUÉ ──────────────────────────────────────────────────────
//
// Con `git cat-file --batch-check` sobre ESTE clon, en UNA sola llamada para los ~390 shas.
// Y con su control delante, porque una sonda que dijera «existe» a todo daría verde sobre
// cualquier cosa: se le pasan `HEAD` (tiene que salir `commit`) y un sha inventado (tiene que
// salir `missing`). Si el control no pasa, esto NO afirma nada: se declara CIEGO.
//
// ⚠️ Y EN UN CLON SUPERFICIAL NO SE PUEDE COMPROBAR. Ahí faltarían los objetos antiguos y
// caerían anclas BUENAS a cientos — el rojo intermitente que acaba con alguien apagando el
// guard. Se detecta y se dice, en vez de medir mal. (CI clona con `fetch-depth: 0` desde
// SCRUM-388, justo por esto.)
//
// ── «NO LO ENCUENTRO» Y «NO EXISTE» NO SON LO MISMO ─────────────────────────────────────
//
// Un commit puede faltar en un clon y estar en `origin` — una rama autoborrada, un objeto no
// alcanzable localmente. Por eso lo que este guard exige es **resolver en el clon donde corre**,
// y lo que NO resuelve se lista abajo con su veredicto de la segunda sonda, no se acusa a ciegas.
//
// Censo del 15-sep-2026: **511 ficheros · 800 líneas «Medido contra» · 790 con sha de 40 ·
// 389 shas distintos · 388 resuelven en el clon · 1 no**, y ése tampoco existe en `origin`
// (la API contesta 422 donde para uno real contesta 200).
const SHA_NO_RESUELVE = 'el sha tiene forma válida pero NO existe: ni en el clon ni en origin — '
  + 'la medición que declara no se puede reproducir. Se LISTA, no se corrige (regla 9): sólo '
  + 'quien la escribió sabe contra qué midió, y ponerle otro sha sería inventar una medición';

/**
 * 🔴 CERRADO EN UNA. Igual que `INVISIBLE_HASTA_859`: un límite declarado y no cerrado deja de
 * ser advertencia y pasa a ser permiso. Si aparece una segunda, el guard cae — y entonces se
 * decide, no se añade una línea más.
 */
const TOPE_SHA_NO_RESUELVE = 1;

const ANCLAS_QUE_NO_RESUELVEN = {
  'SCRUM-652.md#SCRUM-652 · T3 fase B — el parte de trabajo, construido hasta la puerta del esquema': SHA_NO_RESUELVE,
};

/** ¿Este clon puede contestar por la existencia de un commit? Con su control. */
export function sondaDeExistencia(correr) {
  const superficial = String(correr(['rev-parse', '--is-shallow-repository'])).trim() === 'true';
  if (superficial) return { vale: false, motivo: 'el clon es SUPERFICIAL: le faltan objetos antiguos y caerían anclas buenas' };
  const cabeza = String(correr(['rev-parse', 'HEAD'])).trim();
  const inventado = '0'.repeat(39) + '1';
  const salida = String(correr(['cat-file', '--batch-check'], cabeza + '\n' + inventado + '\n'));
  const filas = salida.trim().split('\n');
  if (!/\bcommit\b/.test(filas[0] || '')) return { vale: false, motivo: 'la sonda no reconoce ni su propio HEAD' };
  if (!/\bmissing\b/.test(filas[1] || '')) return { vale: false, motivo: 'la sonda dice que un sha INVENTADO existe' };
  return { vale: true, motivo: 'control OK: HEAD resuelve y un sha inventado no' };
}

test('SCRUM-649 · 🔴 SUELO: la sonda de existencia pasa su control antes de afirmar nada', () => {
  const s = sondaDeExistencia((args, input) =>
    execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', input, stdio: 'pipe' }));
  assert.equal(s.vale, true,
    `🔴 no se puede comprobar la existencia de los commits: ${s.motivo}.\n`
    + '  Esto NO es «las anclas están bien»: es que no se ha mirado. Si el clon es superficial, '
    + 'clona con `fetch-depth: 0` (CI ya lo hace desde SCRUM-388).');
});

test('SCRUM-649 · 🔴 TODO ancla apunta a un commit que EXISTE', () => {
  const s = sondaDeExistencia((args, input) =>
    execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', input, stdio: 'pipe' }));
  assert.equal(s.vale, true, `🔴 CIEGO: ${s.motivo}`);

  const conAncla = entradasTroceadas()
    .map((e) => ({ ...e, sha: (RE_ANCLA.exec(e.cuerpo) || [])[1] }))
    .filter((e) => e.sha);

  // SUELO: si no hay anclas que mirar, un cero de aquí no significa «todas buenas».
  assert.ok(conAncla.length > 300,
    `🔴 CIEGO: sólo ${conAncla.length} entradas con ancla. Un cero sobre eso no dice nada.`);

  const shas = [...new Set(conAncla.map((e) => e.sha))];
  const salida = execFileSync('git', ['cat-file', '--batch-check'],
    { cwd: RAIZ, encoding: 'utf8', input: shas.join('\n') + '\n', stdio: 'pipe' });
  const vivo = new Set(salida.trim().split('\n')
    .filter((l) => /\bcommit\b/.test(l)).map((l) => l.split(' ')[0]));

  const muertas = conAncla
    .filter((e) => !vivo.has(e.sha) && !(e.clave in ANCLAS_QUE_NO_RESUELVEN))
    .map((e) => `${e.fichero}:${e.linea} — \`${e.sha}\` no resuelve\n        ${e.titulo}`);

  assert.deepEqual(muertas, [],
    `🔴 HAY ANCLAS QUE NO APUNTAN A NINGÚN COMMIT (sobre ${shas.length} shas distintos de `
    + `${conAncla.length} entradas):\n    ${muertas.join('\n    ')}\n\n`
    + '  Tener FORMA de sha no es existir. Una medición anclada a un commit que no está no se '
    + 'puede reproducir.\n  Si el commit existe en `origin` y no aquí, el clon está incompleto: '
    + 'eso se arregla clonando entero, no\n  añadiéndola a la lista.');
});

test('SCRUM-649 · 🔴 la lista de anclas que no resuelven está CERRADA en una', () => {
  const n = Object.keys(ANCLAS_QUE_NO_RESUELVEN).length;
  assert.equal(n, TOPE_SHA_NO_RESUELVE,
    `🔴 hay ${n} anclas declaradas como «no resuelve» y el tope es ${TOPE_SHA_NO_RESUELVE}:\n    `
    + Object.keys(ANCLAS_QUE_NO_RESUELVEN).join('\n    ')
    + '\n\n  Una segunda no se añade: se decide. Un límite declarado y no cerrado deja de ser '
    + 'advertencia\n  y pasa a ser permiso.');
});

test('SCRUM-649 · ✅ y la que está listada EXISTE como entrada y sigue sin resolver', () => {
  // Las dos direcciones: que la excepción no se quede huérfana (apuntando a nada) y que no
  // sobre (el sha podría haber aparecido, y entonces hay que quitarla).
  const porClave = new Map(entradasTroceadas().map((e) => [e.clave, e]));
  for (const clave of Object.keys(ANCLAS_QUE_NO_RESUELVEN)) {
    const e = porClave.get(clave);
    assert.ok(e, `🔴 la lista nombra una entrada que ya no existe: ${clave}`);
    const sha = (RE_ANCLA.exec(e.cuerpo) || [])[1];
    assert.ok(sha, `🔴 ${clave} ya no tiene ancla con sha: la excepción sobra.`);
    const salida = execFileSync('git', ['cat-file', '--batch-check'],
      { cwd: RAIZ, encoding: 'utf8', input: sha + '\n', stdio: 'pipe' });
    assert.match(salida, /missing/,
      `🔴 el sha de ${clave} YA resuelve: quítala de la lista y baja el tope.`);
  }
});
