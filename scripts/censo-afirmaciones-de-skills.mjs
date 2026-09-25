// scripts/censo-afirmaciones-de-skills.mjs — SCRUM-939
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UNA SKILL DECLARADA OBLIGATORIA CONTIENE UN DATO FALSO
//
// `cerebro-yaqu` —que se carga SIEMPRE— «corrigió» a una sesión diciendo que `gh` está en
// `C:\Program Files\GitHub CLI\gh.exe`. No existe. Una skill obligatoria no es documentación: es
// una instrucción que se ejecuta sin que nadie la revise, y un dato falso ahí se propaga a cada
// sesión que la carga.
//
// Esto CUENTA Y LISTA. ⛔ NO corrige ninguna skill: su contenido es gobierno (S0), y algunas
// obligan sobre materia fiscal o microcopy.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// ① QUÉ ES «OBLIGATORIA» — el léxico se DERIVA, no se escribe aquí
//
// El censo de anoche contó `obligatori*` y se le escaparon las que obligan diciendo «SIEMPRE».
// Así que aquí se prueban los marcadores contra el corpus y se declara cuáles atan de verdad:
//
//   · `obligatori*`  → yaqu-premium-ui, yaqu-verifactu-sif
//   · `siempre`      → cerebro-yaqu («Usar SIEMPRE al arrancar»), verifactu («Úsala SIEMPRE que»)
//
// ⚠️ Y SE MIRA SÓLO LA DESCRIPCIÓN DEL FRONTMATTER, no el cuerpo. `yaqu-wa-templates` dice
// «leer SIEMPRE antes de dictar nada» EN SU CUERPO: eso obliga a quien ya abrió la skill, no
// obliga a abrirla. Contarla habría dado 5 donde hay 4 — el mismo inflado del denominador que
// este censo evita en las afirmaciones.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// ② QUÉ ES «COMPROBABLE» — que el árbol o la máquina puedan decir sí o no
//
// Se extraen SÓLO tokens que tienen dueño verificable:
//
//   RUTA      un fichero o directorio del repo           → ¿existe?
//   COMANDO   `npm run <x>`                              → ¿está en package.json?
//   REGLA     `regla <n>` del máster                     → ¿existe esa regla?
//
// 🔴 LO NO COMPROBABLE NO CUENTA COMO CIERTO: cuenta del lado malo, y se dice.
//
// 🔴 Y UNA FRASE DE CRITERIO NO ENTRA EN EL DENOMINADOR. «Prefiere lo simple» no es verificable
// ni falsable: meterla llenaría el denominador de lo que no se decide y haría bajar el porcentaje
// de falsas sin que nada mejore. El extractor la deja fuera POR CONSTRUCCIÓN —no contiene ningún
// token con dueño— y hay un control que lo comprueba.
//
// SUELO: si falta cualquiera de las CUATRO obligatorias conocidas = CIEGO, salida 2.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-939b · ESTO YA NO SÓLO MIDE: ALIMENTA UN TRINQUETE
//
// `tests/scrum939b-trinquete-de-las-skills.test.mjs` corre `censar()` en cada tanda y cae si
// aparece una falsa que no está declarada, o si una declarada deja de salir sin que nadie baje el
// censo. El trinquete SÓLO BAJA. Este script sigue siendo el censo que se corre a mano; el
// trinquete mide por el MISMO camino (`censar`), no por otro.
//
// 🔴 EL ÁRBOL ES EL ÍNDICE DE GIT, NO EL DISCO. «Este fichero existe» se comprueba contra
// `git ls-files`: un fichero sin añadir existe en MI disco pero no en el repo, y daría CIERTA aquí
// y FALSA en CI. Medido al cambiarlo (18-sep-2026, 34 afirmaciones RUTA): cero veredictos distintos
// entre el recorrido de disco de la fase a y el índice. Las skills que se LEEN, en cambio, salen
// del directorio que se le pase: es lo que deja al trinquete sembrar en una COPIA.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR = path.join(RAIZ, '.claude', 'skills');

/**
 * 🔴 EL SUELO DE CEGUERA. Las cuatro que el léxico encontró el 17-sep-2026. Si falta UNA, el
 * barrido no mira lo que dice mirar: o el léxico dejó de verla o alguien cambió su descripción, y
 * en los dos casos un «0 falsas» sería «no he mirado». Una QUINTA no ciega nada: entra sola y sus
 * falsas cuentan.
 */
export const OBLIGATORIAS_CONOCIDAS = Object.freeze(['cerebro-yaqu', 'verifactu', 'yaqu-premium-ui', 'yaqu-verifactu-sif']);

// ── ① Las obligatorias, derivadas del frontmatter ────────────────────────────────────────────

/** La `description:` del frontmatter YAML, sin el cuerpo. */
export function descripcionDe(fuente) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fuente);
  if (!m) return '';
  const fm = m[1];
  const d = /^description:\s*([\s\S]*?)(?=\n[a-z][a-z-]*:|$)/m.exec(fm);
  return d ? d[1].replace(/\s+/g, ' ').trim() : '';
}

/** ¿Obliga a cargarse? Se mira SÓLO la descripción. */
export function obliga(descripcion) {
  const d = descripcion.toLowerCase();
  if (/obligatori/.test(d)) return 'obligatoria';
  if (/siempre/.test(d)) return 'siempre';
  return null;
}

// ── ② Las afirmaciones comprobables ──────────────────────────────────────────────────────────

const EXT = /\.(md|ts|mjs|js|json|css|html|sql|prisma|xsd|txt|png|zip|exe)$/i;

/**
 * Extrae de una línea los tokens con dueño verificable. Devuelve [] si la línea es prosa,
 * criterio o estilo — y ESO es lo que mantiene el denominador honesto.
 */
export function afirmacionesDe(linea) {
  const out = [];
  // Sólo lo que va entre comillas invertidas: el resto es redacción.
  for (const m of linea.matchAll(/`([^`]+)`/g)) {
    const t = m[1].trim();
    if (/^npm run [a-z0-9:_-]+$/i.test(t)) { out.push({ tipo: 'COMANDO', valor: t.replace(/^npm run /i, '') }); continue; }
    if (/^[A-Za-z]:\\/.test(t) || /^"[A-Za-z]:\\/.test(t)) { out.push({ tipo: 'RUTA_ABS', valor: t.replace(/^"|"$/g, '') }); continue; }
    if (EXT.test(t) || /^(docs|src|scripts|public|tests|prisma|\.claude|\.github)\//.test(t)) {
      out.push({ tipo: 'RUTA', valor: t.split(/[\s(]/)[0] }); continue;
    }
  }
  for (const m of linea.matchAll(/\bregla\s+(\d+)\b/gi)) out.push({ tipo: 'REGLA', valor: m[1] });
  return out;
}

// ── Verificación ─────────────────────────────────────────────────────────────────────────────

let SCRIPTS = {};
try { SCRIPTS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts || {}; } catch { /* suelo abajo */ }

let MASTER = '';
try { MASTER = fs.readFileSync(path.join(RAIZ, 'docs', 'YAQU_MASTER.md'), 'utf8'); } catch { /* suelo abajo */ }

// ⚠️ AQUÍ VIVÍA UN `enElPath()` QUE RESOLVÍA BINARIOS CON `where`/`which`, Y SE HA RETIRADO.
//
// Nunca llegó a llamarse: la ruta de `gh` se verifica como RUTA_ABS contra el disco, que es más
// directo y no depende del `PATH` de quien corra el censo. Dejarlo tenía dos costes, y los dos son
// de este mismo ticket:
//
//   · leía `process.platform`, y `scrum702` me cazó por subir a 18 el tope de 17 ficheros que
//     dependen del entorno — el arreglo va en mi código, nunca en su tope;
//   · y la cabecera prometía un verificador de BINARIO que el código no tenía. Una cabecera que
//     promete lo que no hace es EXACTAMENTE el defecto que este censo mide.

/**
 * El árbol del repo, del ÍNDICE de git: ficheros, directorios que los contienen, y un índice por
 * nombre. El índice por nombre hace falta porque una skill cita `verifactu.service.ts` sin su
 * carpeta, y eso NO afirma «está en la raíz»: afirma «este fichero existe».
 *
 * Sin git, o con el índice vacío, devuelve `ficheros.size === 0` y `censar()` se declara CIEGO: un
 * árbol vacío haría FALSA cada ruta, y eso no es verificar: es acusar.
 */
const ARBOLES = new Map();
export function arbolDe(raiz = RAIZ) {
  if (ARBOLES.has(raiz)) return ARBOLES.get(raiz);
  let lista = [];
  try {
    lista = execFileSync('git', ['ls-files', '-z'], { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 28 })
      .split('\0').filter(Boolean);
  } catch { /* suelo en censar() */ }
  const ficheros = new Set(lista);
  const dirs = new Set();
  const porNombre = new Map();
  for (const f of lista) {
    const partes = f.split('/');
    for (let i = 1; i < partes.length; i++) dirs.add(partes.slice(0, i).join('/'));
    const nombre = partes[partes.length - 1];
    if (!porNombre.has(nombre)) porNombre.set(nombre, []);
    porNombre.get(nombre).push(f);
  }
  const arbol = { ficheros, dirs, porNombre };
  ARBOLES.set(raiz, arbol);
  return arbol;
}

/**
 * 🔴 ESTE CENSO NO LEE NEGACIONES, y lo dice en vez de acusar.
 *
 * `yaqu-verifactu-sif:88` afirma que cierto documento de evidencias **NO existe** — y tiene razón.
 *
 * ⚠️ Su ruta NO se escribe aquí, y el motivo es de este mismo ticket: la primera versión de este
 * comentario la citaba entera y `scrum242-scripts-no-prometen-documentos` me cazó — un script no
 * puede nombrar un documento que no está en el árbol, ni siquiera para decir que no está. Escribí
 * el defecto que venía a medir. La ruta se lee en la línea 88 de esa skill, que es su dueña.
 * Mi extractor veía la ruta, comprobaba que no está y la marcaba FALSA: la skill acertaba y el
 * instrumento la acusaba. Una afirmación NEGADA necesita leer la polaridad de la frase, y eso ya
 * no es «el árbol dice sí o no»: es interpretar castellano.
 *
 * Así que cuando la línea niega, va a NO COMPROBABLE —del lado malo— en vez de a FALSA. Contarla
 * como cierta sería fiarse de una lectura que este censo no hace.
 */
const NIEGA = /\bno existe\b|\bno hay\b|\bNO CONSTRUIDO\b|\bno está\b|\bya no\b/i;

/**
 * `disco` existe para que las dos mitades de RUTA_ABS se puedan ejercitar en CUALQUIER máquina
 * (SCRUM-1113): los controles le pasan una plataforma y un `existe` fijos. El censo de verdad no
 * pasa nada y usa los del proceso.
 */
export function verificar(a, linea = '', arbol = arbolDe(RAIZ), disco = {}) {
  const { plataforma = process.platform, existe = fs.existsSync } = disco;
  if (NIEGA.test(linea)) {
    return { veredicto: 'NO COMPROBABLE', evidencia: 'la línea NIEGA, y este censo no lee polaridad' };
  }
  if (a.tipo === 'RUTA') {
    // 🔴 UNA PLANTILLA NO ES UNA AFIRMACIÓN. `docs/master/SCRUM-<n>.md` describe una FORMA, no
    // dice que exista un fichero llamado así. Meterla como falsa fue el primer inflado de este
    // censo: 20 «falsas» de las que 19 lo eran por cómo yo extraía, no por lo que la skill dice.
    if (/[<>{}*]/.test(a.valor)) {
      return { veredicto: 'NO COMPROBABLE', evidencia: 'es una plantilla con hueco, no una ruta concreta' };
    }
    // Con carpeta: la ruta se afirma entera (fichero o directorio). Sin carpeta: se afirma que el
    // fichero EXISTE.
    if (a.valor.includes('/')) {
      const rel = a.valor.replace(/\/+$/, '');
      const ok = arbol.ficheros.has(rel) || arbol.dirs.has(rel);
      return { veredicto: ok ? 'CIERTA' : 'FALSA', evidencia: ok ? 'existe en el árbol' : 'no existe en el árbol' };
    }
    const donde = arbol.porNombre.get(a.valor);
    return donde
      ? { veredicto: 'CIERTA', evidencia: `existe: ${donde[0]}${donde.length > 1 ? ` (+${donde.length - 1})` : ''}` }
      : { veredicto: 'FALSA', evidencia: 'no existe ningún fichero con ese nombre en el árbol' };
  }
  if (a.tipo === 'RUTA_ABS') {
    // ⚠️ EL DISCO ES EL DE QUIEN CORRE ESTO, y se declara en vez de disimularlo (SCRUM-939b).
    //
    // SCRUM-1113 · UNA RUTA DE WINDOWS, EN UN DISCO QUE NO ES WINDOWS, NO SE PUEDE JUZGAR.
    // En CI (ubuntu) una ruta `C:\…` no existe POR CONSTRUCCIÓN, así que `existsSync` la daba
    // FALSA fuera cual fuera la verdad. Y en Windows el veredicto dependía de lo instalado: la de
    // `gh` era FALSA hasta el 18-sep-2026, cuando Javier instaló `gh`, y desde entonces sale
    // CIERTA en esa máquina. La «falsa declarada» dejó de ser falsa porque cambió el mundo, no el
    // código, y el trinquete cayó sólo en las máquinas Windows con `gh`.
    //
    // Decidido (opción ii del ticket): se LEE la plataforma. En Windows, el disco manda (CIERTA o
    // FALSA); fuera de Windows, una ruta `X:\` sale NO COMPROBABLE —del lado malo, y dicho—.
    // Cuesta un fichero más en el tope de `scrum702` (ficheros que leen el entorno), y se sube
    // allí A PROPÓSITO y con este motivo. Sí, el veredicto es distinto en cada sitio: por eso es NO
    // COMPROBABLE y no CIERTA, y es más honesto que un FALSA que en Linux salía por construcción.
    if (/^[A-Za-z]:\\/.test(a.valor) && plataforma !== 'win32') {
      return { veredicto: 'NO COMPROBABLE', evidencia: `ruta de Windows y este disco es ${plataforma}` };
    }
    const ok = existe(a.valor);
    return { veredicto: ok ? 'CIERTA' : 'FALSA', evidencia: ok ? 'existe en el disco' : 'NO existe en el disco' };
  }
  if (a.tipo === 'COMANDO') {
    const ok = Object.prototype.hasOwnProperty.call(SCRIPTS, a.valor);
    return { veredicto: ok ? 'CIERTA' : 'FALSA', evidencia: ok ? 'está en package.json' : 'NO está en package.json' };
  }
  if (a.tipo === 'REGLA') {
    const ok = new RegExp(`(^|\\n)\\s*\\*?\\*?${a.valor}[.)]`, 'm').test(MASTER) || new RegExp(`regla\\s+${a.valor}\\b`, 'i').test(MASTER);
    return { veredicto: ok ? 'CIERTA' : 'NO COMPROBABLE', evidencia: ok ? 'el máster la nombra' : 'no se localiza en el máster' };
  }
  return { veredicto: 'NO COMPROBABLE', evidencia: 'tipo sin verificador' };
}

// ── Barrido ──────────────────────────────────────────────────────────────────────────────────

/**
 * EL CENSO, como función: la corre el script a mano y la corre el trinquete de la tanda, por el
 * mismo camino. `dirSkills` es de dónde se LEEN las skills —el trinquete le pasa una COPIA para
 * sembrar, nunca el original—; `raiz` es el árbol contra el que se VERIFICA.
 *
 * Devuelve la población entera, no sólo el resultado: carpetas, obligatorias, líneas, filas. Y
 * `ciego` con el motivo si no ha podido mirar — entonces `filas` no dice nada y nadie debe leerlas.
 */
export function censar({ dirSkills = DIR, raiz = RAIZ } = {}) {
  let carpetas = [];
  try { carpetas = fs.readdirSync(dirSkills, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { /* suelo */ }

  const obligatorias = [];
  for (const nombre of carpetas) {
    const f = path.join(dirSkills, nombre, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const fuente = fs.readFileSync(f, 'utf8');
    const por = obliga(descripcionDe(fuente));
    if (por) obligatorias.push({ nombre, fuente, por });
  }

  const vacio = { carpetas: carpetas.length, obligatorias: obligatorias.map(({ nombre, por }) => ({ nombre, por })), lineasTotales: 0, lineasConAfirmacion: 0, filas: [] };
  const faltan = OBLIGATORIAS_CONOCIDAS.filter((n) => !obligatorias.some((s) => s.nombre === n));
  if (faltan.length) {
    return { ...vacio, ciego: `faltan ${faltan.length} de las ${OBLIGATORIAS_CONOCIDAS.length} obligatorias conocidas (${faltan.join(', ')}) sobre ${carpetas.length} carpetas: el barrido no mira lo que dice mirar` };
  }
  if (!Object.keys(SCRIPTS).length || !MASTER) {
    return { ...vacio, ciego: 'sin `package.json#scripts` o sin el máster no se puede verificar nada' };
  }
  const arbol = arbolDe(raiz);
  if (!arbol.ficheros.size) {
    return { ...vacio, ciego: '`git ls-files` no devuelve nada: sin árbol, cada ruta saldría FALSA' };
  }

  const filas = [];
  let lineasTotales = 0;
  let lineasConAfirmacion = 0;
  for (const s of obligatorias) {
    const lineas = s.fuente.split(/\r?\n/);
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (!l.trim() || /^#{1,6}\s/.test(l) || /^---$/.test(l)) continue;
      lineasTotales++;
      const afs = afirmacionesDe(l);
      if (!afs.length) continue;
      lineasConAfirmacion++;
      for (const a of afs) filas.push({ skill: s.nombre, linea: i + 1, ...a, ...verificar(a, l, arbol) });
    }
  }
  if (!filas.length) {
    return { ...vacio, lineasTotales, ciego: `${lineasTotales} líneas leídas y ninguna afirmación extraída: el extractor no ve` };
  }
  return { ...vacio, lineasTotales, lineasConAfirmacion, filas, ciego: null };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const censo = censar();
  if (censo.ciego) {
    console.error(`🔴 CIEGO: ${censo.ciego}.`);
    process.exit(2);
  }
  const { carpetas, obligatorias, lineasTotales, lineasConAfirmacion, filas } = censo;

  const ciertas = filas.filter((f) => f.veredicto === 'CIERTA');
  const falsas = filas.filter((f) => f.veredicto === 'FALSA');
  const nc = filas.filter((f) => f.veredicto === 'NO COMPROBABLE');
  const pct = (n, d) => (d ? `${Math.round((n / d) * 100)} %` : '—');

  console.log('SCRUM-939 · AFIRMACIONES DE LAS SKILLS OBLIGATORIAS\n');
  const fallosControl = controles();
  console.log('── CONTROLES (en cada ejecución) ──');
  if (fallosControl.length) {
    console.log('🔴 FALLIDOS:');
    for (const f of fallosControl) console.log(`   ${f}`);
  } else {
    console.log('✅ POSITIVO: la ruta de `gh` sale FALSA por el EJE de la ruta, no por mencionar «gh»');
    console.log('✅ NEGATIVO: una afirmación cierta sale CIERTA (no acusa a todo)');
    console.log('✅ SEGUNDO NEGATIVO: tres frases de criterio NO entran en el denominador');
  }
  console.log('');
  console.log('── ① LAS OBLIGATORIAS (léxico derivado del corpus) ──');
  console.log(`carpetas de skill examinadas ......... ${carpetas}`);
  console.log(`OBLIGATORIAS ......................... ${obligatorias.length}`);
  for (const s of obligatorias) console.log(`   · ${s.nombre.padEnd(20)} (obliga por «${s.por}»)`);
  console.log('');
  console.log('── ② LAS DOS CIFRAS ──');
  console.log(`líneas con contenido en las 4 ........ ${lineasTotales}`);
  console.log(`de ellas CON afirmación comprobable .. ${lineasConAfirmacion}   ${pct(lineasConAfirmacion, lineasTotales)}`);
  console.log(`líneas SIN nada comprobable .......... ${lineasTotales - lineasConAfirmacion}   ${pct(lineasTotales - lineasConAfirmacion, lineasTotales)}  ← del lado malo`);
  console.log('');
  console.log(`afirmaciones comprobables extraídas .. ${filas.length}`);
  console.log(`   CIERTAS ........................... ${ciertas.length}   ${pct(ciertas.length, filas.length)}`);
  console.log(`   🔴 FALSAS ......................... ${falsas.length}   ${pct(falsas.length, filas.length)}`);
  console.log(`   NO COMPROBABLES ................... ${nc.length}   ${pct(nc.length, filas.length)}  ← del lado malo`);
  console.log('');
  console.log('── 🔴 LAS FALSAS, UNA A UNA ──');
  for (const f of falsas) console.log(`  ${f.skill}:${f.linea}  [${f.tipo}]  ${f.valor}\n      → ${f.evidencia}`);
  if (nc.length) {
    console.log('');
    console.log('── NO COMPROBABLES ──');
    for (const f of nc) console.log(`  ${f.skill}:${f.linea}  [${f.tipo}]  ${f.valor} → ${f.evidencia}`);
  }

  if (fallosControl.length) process.exit(2);
  process.exit(falsas.length ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LOS CONTROLES, que corren en CADA ejecución (no se confía en que se corrieran una vez)
// ═════════════════════════════════════════════════════════════════════════════════════════════

export function controles() {
  const fallos = [];

  // 🔴 POSITIVO · la ruta de `gh` se juzga POR EL EJE CORRECTO: por el disco, no porque la línea
  // mencione `gh`. SCRUM-1113: antes exigía FALSA contra el disco REAL, y en una máquina con `gh`
  // instalado caía con razón. Ahora el disco se fija, y se prueban las dos mitades en cualquier
  // máquina: sin el fichero sale FALSA, con él sale CIERTA, y fuera de Windows NO COMPROBABLE.
  // La barra invertida va DOBLE: en un literal de JS `\P` es una `P` y el control se caía solo,
  // diciendo que no extraía la ruta cuando lo que pasaba es que la ruta no tenía barras.
  const gh = afirmacionesDe('- `gh` está instalado FUERA del PATH (`"C:\\Program Files\\GitHub CLI\\gh.exe"`).');
  const rutaGh = gh.find((a) => a.tipo === 'RUTA_ABS');
  if (!rutaGh) fallos.push('POSITIVO: no se extrae la RUTA_ABS de gh (se estaría cazando por mencionar «gh», que es el eje equivocado)');
  else {
    const casos = [
      [{ plataforma: 'win32', existe: () => false }, 'FALSA', 'en Windows y sin el fichero'],
      [{ plataforma: 'win32', existe: () => true }, 'CIERTA', 'en Windows y con el fichero'],
      [{ plataforma: 'linux', existe: () => true }, 'NO COMPROBABLE', 'en Linux, aunque «exista»'],
    ];
    for (const [disco, espera, donde] of casos) {
      const v = verificar(rutaGh, '', undefined, disco);
      if (v.veredicto !== espera) fallos.push(`POSITIVO: la ruta de gh sale ${v.veredicto} ${donde}; se esperaba ${espera}`);
    }
  }

  // 🔴 POSITIVO SOBRE EL DISCO REAL · una ruta de Windows INVENTADA sale FALSA en Windows. Si
  // saliera otra cosa, SCRUM-1113 habría apagado el detector en vez de afinarlo. Fuera de Windows
  // tiene que salir NO COMPROBABLE: nunca CIERTA.
  const inventada = { tipo: 'RUTA_ABS', valor: 'C:\\yaqu-scrum1113-no-existe\\cebo.exe' };
  for (const [plataforma, espera] of [['win32', 'FALSA'], ['linux', 'NO COMPROBABLE']]) {
    const v = verificar(inventada, '', undefined, { plataforma });
    if (v.veredicto !== espera) fallos.push(`POSITIVO: una ruta inventada sale ${v.veredicto} en ${plataforma}; se esperaba ${espera}`);
  }

  // ✅ NEGATIVO · una afirmación CIERTA sale CIERTA. Un instrumento que marca todo falso no
  // verifica: acusa.
  const ok = afirmacionesDe('Lee `docs/YAQU_MASTER.md` y corre `npm run build`.');
  if (ok.length !== 2) fallos.push(`NEGATIVO: se esperaban 2 afirmaciones de una línea cierta y salen ${ok.length}`);
  for (const a of ok) {
    const v = verificar(a, '');
    if (v.veredicto !== 'CIERTA') fallos.push(`NEGATIVO: «${a.valor}» sale ${v.veredicto} y es cierta`);
  }

  // 🔴 SEGUNDO NEGATIVO · una frase de CRITERIO no entra en el denominador. Si entrara, el
  // denominador se llenaría de lo que no se decide y el porcentaje de falsas bajaría solo.
  for (const frase of [
    'Prefiere lo simple sobre lo complejo.',
    'Cuando dudes, para y pregunta al fundador.',
    'El microcopy se propone y se para.',
  ]) {
    const a = afirmacionesDe(frase);
    if (a.length) fallos.push(`SEGUNDO NEGATIVO: una frase de criterio entra en el censo → «${frase}» dio ${JSON.stringify(a)}`);
  }

  return fallos;
}
