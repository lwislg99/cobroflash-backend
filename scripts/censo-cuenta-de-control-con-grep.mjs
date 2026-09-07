#!/usr/bin/env node
// scripts/censo-cuenta-de-control-con-grep.mjs — SCRUM-766
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ INSTRUMENTOS DE LA CASA CUENTAN CARACTERES DE CONTROL CON `grep` EN ESTE ENTORNO?
//
// 🔴 EL DEFECTO TIENE DOS CARAS Y LA CASA SOLO TENÍA ANOTADA UNA. Medido el 7-sep-2026 en este
//    Git Bash (GNU grep 3.0, bash de MSYS), sobre un fichero FABRICADO con respuesta conocida —
//    50 líneas, EXACTAMENTE 3 con CR:
//
//      instrumento                            3cr.txt   lf.txt    verdad
//      ─────────────────────────────────────  ───────   ──────    ──────
//      node, contando el byte 0x0D                  3        0    ✅ 3 y 0
//      grep -c $'\r' F        (directo)             0        0    🔴 FALSO NEGATIVO
//      grep -Uc $'\r' F       (directo, -U)         3        0    ✅
//      n=$(grep -c  $'\r' F)  (en sustitución)     50       50    🔴 FALSO POSITIVO = wc -l
//      n=$(grep -Uc $'\r' F)  (en sustitución)     50       50    🔴 FALSO POSITIVO = wc -l
//      wc -l F                                     50       50
//
// ── LAS DOS CARAS, Y POR QUÉ SON MECANISMOS DISTINTOS ───────────────────────────────────────
//
//   CARA A · LA LECTURA (falso negativo, ya anotada en scrum480-fin-de-linea.test.mjs).
//   GNU grep abre el fichero en modo texto y QUITA el CR antes de casar, así que el patrón no
//   encuentra lo que sí está. `-U` lo desactiva y acierta.
//
//   CARA B · EL PATRÓN (falso positivo del 100 %, ES LO QUE ABRE ESTE TICKET). Dentro de una
//   sustitución de órdenes `$( )`, el bash de MSYS se come el byte CR del texto de la orden, así
//   que `$'\r'` llega a grep como CADENA VACÍA. Un patrón vacío casa con TODAS las líneas y `-c`
//   devuelve EXACTAMENTE `wc -l`. Medido aparte, sin ambigüedad posible:
//
//        len($'\r') FUERA de $()  = 1        ← el patrón existe
//        len($'\r') DENTRO de $() = 0        ← el patrón ha desaparecido
//        len($'\t') DENTRO de $() = 1        ← al TAB no le pasa: es el CR, no la sustitución
//
//   Y `-U` NO salva la cara B: arregla la lectura, y aquí lo que falta es el patrón.
//
// 🔴 POR QUÉ LA CARA B ES LA CARA CARA. `wc -l` y «ficheros con CR» son números del mismo orden
//    de magnitud sobre el mismo árbol. Nada en la salida delata la sustitución: sale un número
//    grande, plausible, con la forma correcta. Contra un valor ilegible se programa una barrera;
//    contra uno plausible no hay síntoma. Y la cara B es la que sale al escribir un censo, porque
//    `n=$(...)` es LA forma de capturar un recuento en shell.
//
// 🔴 Y LA IRONÍA, QUE ES EXACTA: la herramienta con la que se iba a vigilar el CR transforma lo
//    que escribes, y su resultado se lee igual de bien. Es el mismo defecto que persigue, aplicado
//    a sí misma.
//
//    ⚠️ EL ENUNCIADO DE ESTE TICKET LO ATRIBUÍA A «la regla 18 de la casa», con el CR como primera
//    de sus cinco caras. NO SE HA PODIDO VERIFICAR y por eso no se cita: buscada en
//    `docs/YAQU_MASTER.md`, en `docs/QA/SUITE_REGRESION.md` y en `CLAUDE.md`, no aparece ninguna
//    regla con ese contenido. Lo único numerado 18 es un paso de escenario en SUITE_REGRESION.md
//    y, en la numeración de reglas duras de CLAUDE.md, Stripe Connect. La IDEA es cierta y está
//    medida aquí abajo; la CITA no, y una cita falsamente precisa gasta más confianza que una
//    vaga — que es justo lo que dice el guard de SCRUM-189, el que cazó esta línea.
//
// ── QUÉ CUENTA ESTE CENSO ───────────────────────────────────────────────────────────────────
// Todos los ficheros de texto rastreados por git. Se busca `grep`/`rg`/`findstr` cuyo PATRÓN sea
// un carácter de control (CR, LF, TAB, NUL, `[[:cntrl:]]`, `\x0d`, `\015`). Se clasifica en:
//
//   · INSTRUMENTO → línea ejecutable. Cuenta de verdad, y es lo que hay que retirar.
//   · RECETA      → documentación o comentario que MANDA hacerlo. Un runbook que prescribe el
//                   idioma malo es un instrumento con más alcance que un script: lo ejecuta
//                   cualquiera, y no aparece en ningún censo de código.
//   · AVISO       → un comentario que documenta el defecto. Ése hay que CONSERVARLO.
//
// La diferencia importa: retirar un AVISO deja el árbol sin memoria del defecto, y es justo el
// «número retirado en silencio que vuelve».
//
// SALIDAS: 0 sin instrumentos ni recetas · 1 hay alguno · 2 no supe medir (ciego).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const SALIDA_HALLAZGO = 1;
export const SALIDA_CIEGO = 2;

const CR = 13;

/**
 * EL INSTRUMENTO CORRECTO, y el único de este fichero que emite un número sobre bytes.
 * Recibe bytes, devuelve un número. Sin decodificar, sin `grep`, sin `split`.
 */
export function contarCR(buf) {
  let n = 0;
  for (const b of buf) if (b === CR) n += 1;
  return n;
}

/**
 * EL FICHERO DE RESPUESTA CONOCIDA. `lineas` líneas, `conCR` de ellas terminadas en CRLF.
 *
 * 🔴 Se fabrica, no se busca uno del árbol: un instrumento no está verificado hasta que se le
 *    enseña un caso cuya respuesta se sabe DE ANTEMANO. Sobre un fichero del árbol la respuesta
 *    sale del propio instrumento que se quiere juzgar, que es no juzgar nada.
 */
export function fabricarControl({ lineas = 50, conCR = 3 } = {}) {
  // Las líneas con CR se reparten, no se ponen al principio: un instrumento que sólo mire la
  // cabecera del fichero acertaría con las tres primeras y fallaría con éstas.
  const cada = Math.floor(lineas / (conCR + 1));
  const partes = [];
  let puestos = 0;
  for (let i = 1; i <= lineas; i += 1) {
    const tocaCR = puestos < conCR && i % cada === 0;
    if (tocaCR) puestos += 1;
    partes.push('linea ' + i + (tocaCR ? '\r\n' : '\n'));
  }
  return { bytes: Buffer.from(partes.join(''), 'latin1'), lineas, conCR: puestos };
}

// ── EL DETECTOR ─────────────────────────────────────────────────────────────────────────────

/**
 * Un patrón de `grep` que es un carácter de control. NO se buscan las secuencias sueltas por el
 * árbol: `\r` aparece en mil cadenas de JavaScript legítimas y un censo que las contara todas
 * sería ruido. Se exige la FORMA COMPLETA: una invocación de grep con ese patrón.
 */
const HERRAMIENTAS = 'grep|egrep|fgrep|rg|findstr';
const CONTROL = String.raw`\$'\\[rnt0]'|\[\[:cntrl:\]\]|\\x0[dD]|\\015|\\0?12\b`;
export const RE_CUENTA_DE_CONTROL = new RegExp(
  String.raw`\b(?:${HERRAMIENTAS})\b[^\n;|&)]{0,40}?(?:${CONTROL})`, 'g',
);

/**
 * ¿La ocurrencia está DENTRO de una sustitución de órdenes? Ésa es la cara del `wc -l`.
 *
 * 🔴 `contarComillas` NO es un adorno. En una línea de código, `` ` `` abre una sustitución; en un
 *    COMENTARIO es comilla de markdown, y casi todos los avisos de la casa citan el idioma malo
 *    entre comillas. Contándolas ahí, el propio aviso de `scrum480-fin-de-linea.test.mjs:132`
 *    salía marcado «[EN $( ) → wc -l]», que es una afirmación sobre el MECANISMO y era falsa.
 *    Un censo que se equivoca en el porqué se lee igual de bien que uno que acierta.
 */
export function enSustitucion(linea, indice, { contarComillas = true } = {}) {
  const antes = linea.slice(0, indice);
  const abiertas = (antes.match(/\$\(/g) || []).length - (antes.match(/\)/g) || []).length;
  if (abiertas > 0) return true;
  return contarComillas && (antes.match(/`/g) || []).length % 2 === 1;
}

/**
 * ¿Es una línea EJECUTABLE, o un comentario?
 *
 * 🔴 Deliberadamente CONSERVADOR: ante la duda se clasifica como ejecutable. Un censo de
 *    instrumentos rotos que se equivoca hacia «era sólo un comentario» produce exactamente el
 *    cero tranquilizador que este ticket viene a impedir.
 */
export function esComentario(linea) {
  const t = linea.trimStart();
  return t.startsWith('//') || t.startsWith('#') || t.startsWith('*') || t.startsWith('<!--');
}

/**
 * Un comentario que DOCUMENTA el defecto, y no lo prescribe. Se reconoce por la vecindad de una
 * palabra de advertencia. Conservarlos es el objetivo: son la memoria del árbol.
 */
const AVISO = /falso\s+(negativo|positivo)|NORMALIZA|nunca con|jamás con|jamas con|NO se usa|no se puede contar|MIENTE|defecto|aviso de instrumento/i;

/**
 * Los ficheros de este propio ticket. Contienen el idioma malo A PROPÓSITO —es el control
 * positivo y la documentación del defecto— y sin excluirlos el censo se caza a sí mismo para
 * siempre. La exclusión es NOMINAL y el test comprueba que sin ella el número cambia: así ampara
 * algo real y nada más.
 */
export const AUTORREFERENCIA = [
  'scripts/censo-cuenta-de-control-con-grep.mjs',
  'tests/scrum766-el-grep-que-cuenta-lineas.test.mjs',
  'docs/master/SCRUM-766.md',
];

/**
 * Un filtro previo BARATO. Sin él, el cuantificador perezoso de `RE_CUENTA_DE_CONTROL` se aplica
 * a cada línea de cada fichero (~medio millón) en vez de sólo donde hay una herramienta nombrada.
 *
 * ⚠️ NO se escribe aquí cuánto ahorra, y no es pereza: SCRUM-790 lo prohíbe con motivo. Medido el
 *    7-sep-2026 en esta máquina, **sólo leer** los 2.384 ficheros (61,5 MB) costó 5,7 s, 7,0 s y
 *    10,3 s en tres pasadas seguidas sin tocar una línea. El censo es I/O y la dispersión de la
 *    máquina es mayor que lo que cualquier filtro pueda ahorrar, así que dos totales no se
 *    comparan. Este filtro se justifica por lo que HACE, no por un número que caduca.
 *
 * ⚠️ Es un filtro de VELOCIDAD, no de criterio: sólo puede quitar líneas que la expresión
 *    tampoco habría casado, porque la expresión EXIGE ese mismo nombre. El test lo comprueba
 *    contra el cebo — si algún día el filtro se adelanta al criterio, deja de encontrar el
 *    idioma malo y ese cero no se distinguiría de un árbol limpio.
 *
 * 🔴 LA PRIMERA VERSIÓN DE ESTE FILTRO ERA MÁS ESTRECHA QUE EL CRITERIO, y su comentario decía
 *    justo lo contrario. Preguntaba por `'rg '` CON ESPACIO mientras la expresión pide `\brg\b`,
 *    así que un `rg` seguido de tabulador o de comilla se saltaba sin que nada lo dijera.
 *
 * Son DOS condiciones, y las dos son superconjuntos demostrables de lo que exige el criterio:
 *   ① el nombre de la herramienta, como SUBCADENA (más ancho que el `\b…\b` del criterio);
 *   ② una marca de carácter de control. Cada alternativa de `CONTROL` contiene por construcción
 *      una de estas cinco, así que ninguna línea que el criterio cazaría se cae aquí:
 *        `$'\r'` → `$'`   ·   `[[:cntrl:]]` → `[[:cntrl:`   ·   `\x0d` → `\x0`
 *        `\015`  → `\0`   ·   `\012` y `\12` → `\0` o `\1`
 * La segunda condición es la que hace trabajo: sin ella, el nombre `rg` deja pasar por la
 * expresión cara cada línea que diga «large», «org» o «cargo». El test comprueba las cinco formas,
 * porque un filtro que se adelanta al criterio devuelve el MISMO cero que un árbol limpio.
 */
export const MARCAS_DE_CONTROL = Object.freeze(["$'", '[[:cntrl:', '\\x0', '\\0', '\\1']);
/** Las dos listas se derivan UNA vez. Partirlas por línea costaba ~12 s de censo en asignaciones. */
const NOMBRES = Object.freeze(HERRAMIENTAS.split('|'));
export function puedeContener(linea) {
  let hay = false;
  for (let i = 0; i < NOMBRES.length; i += 1) if (linea.includes(NOMBRES[i])) { hay = true; break; }
  if (!hay) return false;
  for (let i = 0; i < MARCAS_DE_CONTROL.length; i += 1) {
    if (linea.includes(MARCAS_DE_CONTROL[i])) return true;
  }
  return false;
}

/** Clasifica UN texto. Puro: recibe contenido y ruta, devuelve hallazgos. */
export function hallazgosEn(contenido, rel) {
  const out = [];
  const lineas = contenido.split(/\r?\n/);
  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i];
    if (!puedeContener(linea)) continue;
    RE_CUENTA_DE_CONTROL.lastIndex = 0;
    let m;
    while ((m = RE_CUENTA_DE_CONTROL.exec(linea)) !== null) {
      const comentario = esComentario(linea);
      const documenta = AVISO.test(linea);
      out.push({
        fichero: rel,
        linea: i + 1,
        texto: m[0].trim().slice(0, 70),
        sustitucion: enSustitucion(linea, m.index, { contarComillas: !comentario }),
        clase: !comentario ? 'INSTRUMENTO' : documenta ? 'AVISO' : 'RECETA',
      });
    }
  }
  return out;
}

/** El censo. Sobre los ficheros de TEXTO rastreados por git — nunca sobre el disco entero. */
export function censar(raiz, { incluirAutorreferencia = false } = {}) {
  let rutas;
  try {
    rutas = execFileSync('git', ['ls-files', '-z'], {
      cwd: raiz, encoding: 'utf8', maxBuffer: 2.5e8,
    }).split('\0').filter(Boolean);
  } catch (e) {
    throw new Error('🔴 CIEGO: `git ls-files` falló — ' + e.message);
  }
  if (rutas.length === 0) throw new Error('🔴 CIEGO: `git ls-files` no devolvió ningún fichero');

  const hallazgos = [];
  let leidos = 0;
  let binarios = 0;
  for (const rel of rutas) {
    if (!incluirAutorreferencia && AUTORREFERENCIA.includes(rel)) continue;
    let buf;
    try { buf = fs.readFileSync(path.join(raiz, rel)); } catch { continue; }
    if (buf.indexOf(0) !== -1) { binarios += 1; continue; }
    leidos += 1;
    hallazgos.push(...hallazgosEn(buf.toString('utf8'), rel));
  }
  return {
    poblacion: rutas.length,
    leidos,
    binarios,
    hallazgos,
    instrumentos: hallazgos.filter((h) => h.clase === 'INSTRUMENTO'),
    recetas: hallazgos.filter((h) => h.clase === 'RECETA'),
    avisos: hallazgos.filter((h) => h.clase === 'AVISO'),
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const raiz = process.cwd();
  let r;
  try {
    r = censar(raiz);
  } catch (e) {
    console.error(e.message);
    process.exit(SALIDA_CIEGO);
  }

  // 🔴 SUELO. «Cero instrumentos rotos» y «no supe leer el árbol» dan el mismo cero, y el segundo
  //    no es hipotético: basta con que `git ls-files` conteste desde un worktree a medio hacer.
  if (r.leidos < 500) {
    console.error('🔴 CIEGO: sólo he leído ' + r.leidos + ' ficheros de texto (de ' + r.poblacion
      + ' rastreados). Un cero de hallazgos aquí NO significa «el árbol está limpio».');
    process.exit(SALIDA_CIEGO);
  }

  // 🔴 CONTROL POSITIVO, OBLIGATORIO, Y EJECUTADO SIEMPRE — no sólo cuando el censo da cero. Un
  //    detector que no sabe cambiar de respuesta no ha medido: ha dicho que no.
  const cebo = [
    'n=$(grep -c $\'\\r\' "$f")',                 // la cara B, la del wc -l
    'grep -c $\'\\r\' fichero.txt',               // la cara A, la del falso negativo
    'grep -c "TODO" fichero.txt',                 // benigno: NO se debe marcar
  ].join('\n');
  const pillados = hallazgosEn(cebo, '<control>');
  if (pillados.length !== 2 || !pillados[0].sustitucion || pillados[1].sustitucion) {
    console.error('🔴 CIEGO: el control positivo no sale como debe. Esperados 2 hallazgos (el '
      + 'primero en sustitución, el segundo no) y han salido ' + pillados.length + '. El detector '
      + 'no puede juzgar el árbol si no reconoce el defecto que ya sabemos que existe.');
    process.exit(SALIDA_CIEGO);
  }

  console.log('ficheros de texto leídos ......... ' + r.leidos + '   (de ' + r.poblacion
    + ' rastreados; ' + r.binarios + ' binarios)');
  console.log('control positivo ................. ✅ el detector caza las dos caras del cebo');
  console.log('🔴 INSTRUMENTOS que cuentan control con grep  ' + r.instrumentos.length);
  console.log('🔴 RECETAS que mandan hacerlo (docs, notas) .. ' + r.recetas.length);
  console.log('✅ AVISOS que documentan el defecto (se dejan) ' + r.avisos.length);

  for (const grupo of [['INSTRUMENTO', r.instrumentos], ['RECETA', r.recetas], ['AVISO', r.avisos]]) {
    if (!grupo[1].length) continue;
    console.log('\n── ' + grupo[0] + ' ' + '─'.repeat(70 - grupo[0].length));
    for (const h of grupo[1]) {
      console.log('   ' + h.fichero + ':' + h.linea + (h.sustitucion ? '  [EN $( ) → wc -l]' : '')
        + '\n        ' + h.texto);
    }
  }

  const malos = r.instrumentos.length + r.recetas.length;
  if (malos > 0) {
    console.log('\n🔴 ' + malos + ' sitio(s) cuentan caracteres de control con grep en este entorno.');
    console.log('   La forma correcta es node sobre bytes:  for (const b of buf) if (b === 13) n += 1;');
    process.exit(SALIDA_HALLAZGO);
  }
  console.log('\n✅ Ningún instrumento ni receta cuenta caracteres de control con grep.');
}
