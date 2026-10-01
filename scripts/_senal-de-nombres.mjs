// scripts/_senal-de-nombres.mjs — SCRUM-1339d
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA SEÑAL POR NOMBRES: «todo test que el árbol DECLARA con nombre literal aparece en el TAP».
//
// El check obligatorio pierde casos y sale verde (SCRUM-1339: medido en 630 jobs). Lo que hoy
// compara el recuento —el suelo de SCRUM-672— no puede verlo: mira un NÚMERO con holgura, y un
// bloque de 31 casos que desaparece cabe dentro. Esto compara CONJUNTOS: los nombres que el
// árbol declara contra los que la tanda registró, y dice QUÉ falta, en qué fichero y en qué
// líneas.
//
// ESTE MÓDULO ES PURO: recibe textos y devuelve datos. No lee disco, no llama a `git` ni a `gh`,
// no mira el entorno y no decide ningún código de salida. Quien lee ficheros es el CLI
// (`scripts/senal-de-nombres.mjs`), y es ese reparto el que permite ejercitar el rojo con un TAP
// fabricado, sin correr la tanda dentro de la tanda.
//
// 🔴 QUIÉN DECLARA TESTS NO SE DECIDE AQUÍ. El criterio es el del censo de SCRUM-708
// (`tests/_poblacion-de-tests.mjs`): llamadas `test(…)` / `it(…)` por identificador. Ese censo
// da CUÁNTAS hay y no cómo se llaman, así que el recorrido de aquí saca los nombres — y
// `declaradosDelArbol` ATA su recuento al del censo, fichero a fichero. Si un día discrepan, la
// señal lo dice y no mide: dos censos que se separan en silencio es lo que costó SCRUM-1259.
//
// ── LO QUE ESTA SEÑAL NO VE, y por eso va CONTADO en cada salida, no sólo escrito aquí ──────
//   · NOMBRES CONSTRUIDOS: `test(`caso ${x}`, …)` dentro de un bucle, o un nombre que llega en
//     una variable. No hay literal que buscar en el TAP, así que esas llamadas NO se comparan.
//     Si se pierden, esto no lo ve. Salen como «no comparables», con su número.
//   · SIN NOMBRE: `test('', …)` y `test(() => {})` se registran como `<anonymous>`.
//   · EL MISMO NOMBRE DOS VECES (en un fichero o en dos): se compara por MULTIPLICIDAD — si el
//     árbol lo declara dos veces, el TAP tiene que traerlo dos. Pero el TAP no dice de qué
//     fichero viene cada línea: si llega una de dos, se sabe que FALTA una y no CUÁL. Eso sale
//     como «dudoso», contado aparte, y nunca se le cuelga a un fichero a ojo.
//   · UN TAP QUE NO ESTÁ ENTERO (bytes NUL, sin resumen, dos resúmenes) no se mide: lo que sale
//     de un proceso matado no se cuenta. Se dice que no se pudo medir, y por qué.
// ═════════════════════════════════════════════════════════════════════════════════════════
import ts from 'typescript';
import { testsDeclarados } from '../tests/_poblacion-de-tests.mjs';

/** Versión del formato de la línea de registro. Si cambia el formato, cambia esto. */
export const VERSION = 1;
export const TITULO = 'señal de nombres';

/** Lo decidido en SCRUM-1339 c.17935: la señal AVISA, y se vuelve a decidir con estos tres datos. */
export const UMBRAL_DE_BLOQUEO = 0.05;
export const VENTANA_DE_RUNS = 50;
export const FECHA_TOPE = '2026-10-15';

/** GitHub enseña como mucho diez anotaciones de cada tipo por paso: el resto se pierde sin avisar. */
export const MAX_ANOTACIONES = 10;

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const NUL = String.fromCharCode(0);

/**
 * El nombre tal como lo ESCRIBE el reporter TAP de node.
 *
 * 🔴 Se escapa lo declarado; NO se des-escapa lo registrado, y está medido por qué (banco de
 * `docs/master/evidencias/SCRUM-1339/d-banco-de-nombres.test.mjs`, node 24): el reporter cambia
 * primero los caracteres de control y DESPUÉS dobla la barra, así que un tabulador real sale
 * como barra-barra-t — lo mismo que saldría de una barra seguida de una «t». La vuelta atrás es
 * ambigua; la ida no.
 */
export function escaparComoTap(nombre) {
  const CONTROLES = [[8, 'b'], [12, 'f'], [9, 't'], [10, 'n'], [13, 'r'], [11, 'v']];
  let s = String(nombre);
  for (const [codigo, letra] of CONTROLES) s = s.split(String.fromCharCode(codigo)).join('\\' + letra);
  s = s.split('\\').join('\\\\');
  return s.split('#').join('\\#');
}

/**
 * Las llamadas `test(…)` / `it(…)` de UN fuente, en el orden del fuente, con su línea.
 *
 * `clase`: 'literal' (cadena o plantilla sin sustituciones, no vacía) · 'sin-nombre' (cadena
 * vacía, o el primer argumento es la función) · 'construido' (cualquier otra cosa).
 */
export function llamadasDeclaradas(codigo, fichero = 'x.mjs') {
  const sf = ts.createSourceFile(fichero, String(codigo ?? ''), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const lineaDe = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const llamadas = [];
  (function recorrer(x) {
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && ['test', 'it'].includes(x.expression.text)) {
      const a = x.arguments[0];
      let clase = 'construido';
      let nombre = null;
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) {
        if (a.text === '') clase = 'sin-nombre';
        else { clase = 'literal'; nombre = a.text; }
      } else if (!a || ts.isArrowFunction(a) || ts.isFunctionExpression(a)) {
        clase = 'sin-nombre';
      }
      llamadas.push({
        posicion: llamadas.length + 1, clase, nombre,
        linea: lineaDe(x.getStart(sf)), lineaFin: lineaDe(x.getEnd()),
      });
    }
    ts.forEachChild(x, recorrer);
  })(sf);
  return llamadas;
}

/**
 * Lo que DECLARA un árbol: `fuentes` es `[{ fichero, codigo }]`, uno por `tests/*.test.mjs`.
 *
 * El `control` ata el recuento de aquí al del censo de SCRUM-708, fichero a fichero.
 */
export function declaradosDelArbol(fuentes) {
  const ficheros = [];
  const discrepan = [];
  let llamadas = 0;
  let censo = 0;
  for (const { fichero, codigo } of [...fuentes].sort((a, b) => (a.fichero < b.fichero ? -1 : a.fichero > b.fichero ? 1 : 0))) {
    const ll = llamadasDeclaradas(codigo, fichero);
    const segunElCenso = testsDeclarados(codigo, fichero);
    if (ll.length !== segunElCenso) discrepan.push(`${fichero}: aquí ${ll.length}, el censo ${segunElCenso}`);
    llamadas += ll.length;
    censo += segunElCenso;
    ficheros.push({ fichero, llamadas: ll });
  }
  return { ficheros, llamadas, control: { censo, coincide: discrepan.length === 0 && llamadas === censo, discrepan } };
}

/**
 * Lee un TAP de `node --test`. Devuelve cuántas veces se registró cada nombre (tal como está
 * escrito en el TAP, sin la directiva `# SKIP` / `# TODO`), y si el TAP está ENTERO.
 *
 * Las SUITES (`describe`) no cuentan como registro de un test: el bloque de diagnóstico de cada
 * línea trae `type: 'suite'` o `type: 'test'`, y sin eso un `describe('x')` taparía la pérdida
 * de un `test('x')`.
 */
export function leerTap(texto) {
  const crudo = String(texto ?? '');
  let nul = 0;
  for (let i = crudo.indexOf(NUL); i !== -1; i = crudo.indexOf(NUL, i + 1)) nul++;
  const lineas = crudo.split(NL).map((l) => (l.endsWith(CR) ? l.slice(0, -1) : l));
  const nombres = new Map();
  const entradasDeFichero = [];
  let lineasDeTest = 0;
  let lineasDeSuite = 0;
  const TOPE_DEL_BLOQUE = 400;
  for (let i = 0; i < lineas.length; i++) {
    const m = /^( *)(not )?ok \d+ - (.*)$/.exec(lineas[i]);
    if (!m) continue;
    let tipo = null;
    if ((lineas[i + 1] ?? '').trim() === '---') {
      for (let j = i + 2; j < lineas.length && j < i + TOPE_DEL_BLOQUE; j++) {
        const t = lineas[j].trim();
        if (t === '...') break;
        const mt = /^type: '([a-z]+)'$/.exec(t);
        if (mt) { tipo = mt[1]; break; }
      }
    }
    if (tipo === 'suite') { lineasDeSuite++; continue; }
    lineasDeTest++;
    // El `#` de un nombre va escapado (`\#`); uno precedido de espacio abre la directiva.
    const nombre = m[3].replace(/ # (?:SKIP|TODO)(?: .*)?$/, '');
    nombres.set(nombre, (nombres.get(nombre) ?? 0) + 1);
    if (m[1] === '' && /\.test\.mjs$/.test(nombre)) {
      entradasDeFichero.push({ fichero: nombre.split(/[\\/]/).pop(), caida: Boolean(m[2]) });
    }
  }
  const cifras = (clave) => lineas.filter((l) => new RegExp(`^# ${clave} \\d+\\s*$`).test(l)).map((l) => Number(/\d+/.exec(l)[0]));
  const resumenes = cifras('tests');
  const ultima = (clave) => { const c = cifras(clave); return c.length ? c.at(-1) : null; };
  const tests = resumenes.length ? resumenes.at(-1) : null;
  let motivo = null;
  if (crudo.length === 0) motivo = 'el TAP está vacío';
  else if (nul > 0) motivo = `el TAP lleva ${nul} bytes NUL`;
  else if (resumenes.length === 0) motivo = 'el TAP no tiene resumen (`# tests N`): la tanda no llegó al final';
  else if (resumenes.length > 1) motivo = `el TAP tiene ${resumenes.length} resúmenes: hay otro \`node --test\` escribiendo en él`;
  else if (lineasDeTest !== tests) motivo = `el TAP tiene ${lineasDeTest} líneas de test y su resumen dice ${tests}`;
  return {
    bytes: crudo.length, nul, resumenes: resumenes.length, tests, suites: ultima('suites'),
    pass: ultima('pass'), fail: ultima('fail'), cancelled: ultima('cancelled'), skipped: ultima('skipped'),
    lineasDeTest, lineasDeSuite, nombres, entradasDeFichero, entero: motivo === null, motivo,
  };
}

/** 'entero' · 'cola' · 'cabeza' · 'medio', sobre los estados P(resente) A(usente) D(udoso) N(o comparable). */
function formaDe(estados) {
  const primeroA = estados.indexOf('A');
  const ultimoA = estados.lastIndexOf('A');
  if (!estados.includes('P')) return 'entero';
  if (!estados.slice(primeroA).includes('P')) return 'cola';
  if (!estados.slice(0, ultimoA + 1).includes('P')) return 'cabeza';
  return 'medio';
}

/**
 * Tramos seguidos de ausentes: uno Presente en medio los parte; un Dudoso o No comparable, no.
 *
 * `noComparablesJunto`: las llamadas de nombre construido que quedan en el mismo hueco (entre el
 * Presente de antes y el de después). Medido en SCRUM-1339d sobre dos jobs del mismo árbol: a
 * `scrum524b` le faltaban 26 casos y esta señal nombró 3, porque los otros 23 salen de UNA
 * llamada dentro de un bucle. Lo que se nombra es un SUELO, y el tramo lo dice.
 */
function tramosDe(llamadas, estados) {
  const tramos = [];
  let inicio = 0; // primera llamada del hueco en curso (la siguiente al último Presente)
  const cerrar = (fin) => { // el hueco es [inicio, fin)
    const hueco = estados.slice(inicio, fin);
    if (hueco.includes('A')) {
      const desde = inicio + hueco.indexOf('A');
      const hasta = inicio + hueco.lastIndexOf('A');
      tramos.push({
        desde: desde + 1, hasta: hasta + 1, lineaDesde: llamadas[desde].linea, lineaHasta: llamadas[hasta].lineaFin,
        ausentes: hueco.filter((e) => e === 'A').length,
        noComparablesJunto: hueco.filter((e) => e === 'N').length,
      });
    }
    inicio = fin + 1;
  };
  estados.forEach((e, i) => { if (e === 'P') cerrar(i); });
  cerrar(estados.length);
  return tramos;
}

/**
 * LA SEÑAL. `fuentes`: `[{ fichero, codigo }]` del árbol que la tanda probó. `tap`: su texto.
 *
 * `medible` es falso si el TAP no está entero o si el recuento de aquí no casa con el del censo:
 * en los dos casos `ausentes` vale `null`, no 0. Un cero que no se pudo medir no es un cero.
 */
export function senalDeNombres({ fuentes, tap, censoDelArbol = null }) {
  const d = declaradosDelArbol(fuentes ?? []);
  const t = leerTap(tap);
  // El CLI pasa aquí `testsDeclaradosEn(raiz)`: el censo leyendo el disco por SU camino. Ata la
  // lista de ficheros que se me dio —no sólo cada fichero— a la que el censo ve.
  if (censoDelArbol !== null && censoDelArbol !== d.llamadas) {
    d.control.coincide = false;
    d.control.discrepan.push(`el árbol entero: aquí ${d.llamadas}, testsDeclaradosEn(raiz) ${censoDelArbol}`);
    d.control.censo = censoDelArbol;
  }

  // nombre escapado → dónde se declara
  const declarado = new Map();
  let literales = 0;
  let construidos = 0;
  let sinNombre = 0;
  const ficherosConNoComparables = new Set();
  for (const f of d.ficheros) {
    for (const ll of f.llamadas) {
      if (ll.clase !== 'literal') {
        if (ll.clase === 'construido') construidos++; else sinNombre++;
        ficherosConNoComparables.add(f.fichero);
        continue;
      }
      literales++;
      const clave = escaparComoTap(ll.nombre);
      if (!declarado.has(clave)) declarado.set(clave, []);
      declarado.get(clave).push({ fichero: f.fichero, posicion: ll.posicion });
    }
  }
  const repetidos = [...declarado.values()].filter((v) => v.length > 1);
  const poblacion = {
    ficheros: d.ficheros.length, llamadas: d.llamadas, literales, nombresDistintos: declarado.size,
    construidos, sinNombre, noComparables: construidos + sinNombre,
    ficherosConNoComparables: ficherosConNoComparables.size,
    nombresRepetidos: repetidos.length,
    nombresRepetidosEntreFicheros: repetidos.filter((v) => new Set(v.map((x) => x.fichero)).size > 1).length,
  };
  const { nombres: registrados, ...resumenDelTap } = t;
  resumenDelTap.nombresDistintos = registrados.size;

  let motivo = null;
  if (d.ficheros.length === 0 || d.llamadas === 0) motivo = 'el árbol no declara ningún test: no se leyó `tests/*.test.mjs`';
  else if (!d.control.coincide) motivo = `mi recuento de llamadas (${d.llamadas}) no casa con el del censo de SCRUM-708 (${d.control.censo}): ${d.control.discrepan.slice(0, 3).join(' · ')}`;
  else if (!t.entero) motivo = t.motivo;
  if (motivo) {
    return { medible: false, motivo, poblacion, control: d.control, tap: resumenDelTap, ausentes: null, dudosos: null, bloques: [], dudas: [] };
  }

  // estado de cada aparición declarada
  const estadoDe = new Map(); // `${fichero}\n${posicion}` → 'A' | 'D'  (lo que no está es 'P')
  const dudas = [];
  let dudosos = 0;
  for (const [clave, sitios] of declarado) {
    const registrado = registrados.get(clave) ?? 0;
    if (registrado >= sitios.length) continue;
    if (registrado === 0) { for (const s of sitios) estadoDe.set(s.fichero + NL + s.posicion, 'A'); continue; }
    // llegan algunas de las declaradas: falta alguna y el TAP no dice cuál
    for (const s of sitios) estadoDe.set(s.fichero + NL + s.posicion, 'D');
    dudosos += sitios.length - registrado;
    dudas.push({ nombre: clave, declarado: sitios.length, registrado, faltan: sitios.length - registrado, ficheros: [...new Set(sitios.map((s) => s.fichero))] });
  }

  const bloques = [];
  let ausentes = 0;
  for (const f of d.ficheros) {
    const estados = f.llamadas.map((ll) => (ll.clase !== 'literal' ? 'N' : estadoDe.get(f.fichero + NL + ll.posicion) ?? 'P'));
    const faltan = estados.filter((e) => e === 'A').length;
    if (!faltan) continue;
    ausentes += faltan;
    bloques.push({
      fichero: f.fichero, llamadas: f.llamadas.length, literales: estados.filter((e) => e !== 'N').length, faltan,
      forma: formaDe(estados), tramos: tramosDe(f.llamadas, estados),
      conEntradaDeFichero: t.entradasDeFichero.some((e) => e.fichero === f.fichero.split(/[\\/]/).pop()),
    });
  }
  return { medible: true, motivo: null, poblacion, control: d.control, tap: resumenDelTap, ausentes, dudosos, bloques, dudas };
}

// ── lo que se imprime ─────────────────────────────────────────────────────────────────────

const rango = (a, b) => (a === b ? String(a) : `${a}–${b}`);

/** Una línea por fichero, con el rango de LÍNEAS dentro del texto (c.17961: no depende de `file=`). */
export function describirBloque(b) {
  const tramos = b.tramos.map((t) => `posiciones ${rango(t.desde, t.hasta)} · líneas ${rango(t.lineaDesde, t.lineaHasta)}`).join(' ; ');
  const junto = b.tramos.reduce((a, t) => a + t.noComparablesJunto, 0);
  return `tests/${b.fichero.split(/[\\/]/).pop()} · faltan ${junto ? 'AL MENOS ' : ''}${b.faltan} de ${b.llamadas} (${b.forma}) · ${tramos}`
    + (junto ? ` · en el mismo hueco hay ${junto} llamada(s) de nombre construido: pueden faltar más casos y esta señal no los ve` : '')
    + (b.conEntradaDeFichero ? ' · el fichero sale en el TAP como UNA línea: corrió y no informó de sus casos' : '');
}

/**
 * LA LÍNEA DE REGISTRO: sale SIEMPRE, también con 0 y también cuando no se pudo medir, con su
 * población al lado. Es lo que lee `registroDesdeLinea` desde fuera, para la tasa.
 */
export function lineaDeRegistro(r) {
  const p = r.poblacion;
  const t = r.tap;
  const n = (v) => (v === null || v === undefined ? '?' : String(v));
  return `[${TITULO} v${VERSION}] medible=${r.medible ? 'si' : 'no'}`
    + ` ausentes=${n(r.ausentes)} ficheros_con_ausentes=${r.medible ? r.bloques.length : '?'} dudosos=${n(r.dudosos)}`
    + ` declarados=${p.llamadas} literales=${p.literales} no_comparables=${p.noComparables}`
    + ` ficheros=${p.ficheros} tap_tests=${n(t.tests)} tap_fail=${n(t.fail)}`;
}

/** La vuelta: de una línea de registro a un registro. `null` si la línea no es una de éstas. */
export function registroDesdeLinea(texto) {
  const m = new RegExp(`\\[${TITULO} v(\\d+)\\] (.*)$`, 'm').exec(String(texto ?? ''));
  if (!m) return null;
  const campos = Object.fromEntries(m[2].trim().split(/\s+/).map((par) => par.split('=')).filter((par) => par.length === 2));
  const num = (v) => (v === undefined || v === '?' ? null : Number(v));
  return {
    version: Number(m[1]), medible: campos.medible === 'si',
    ausentes: num(campos.ausentes), ficherosConAusentes: num(campos.ficheros_con_ausentes), dudosos: num(campos.dudosos),
    declarados: num(campos.declarados), literales: num(campos.literales), noComparables: num(campos.no_comparables),
    ficheros: num(campos.ficheros), tapTests: num(campos.tap_tests), tapFail: num(campos.tap_fail),
  };
}

/** El informe entero, para el log. La primera línea es la de registro. */
export function informe(r) {
  const p = r.poblacion;
  const L = [lineaDeRegistro(r)];
  L.push(`  POBLACIÓN: ${p.ficheros} ficheros de tests/ · ${p.llamadas} llamadas test()/it()`
    + ` (censo de SCRUM-708: ${r.control.censo}${r.control.coincide ? ', coincide' : ', NO COINCIDE'})`
    + ` · ${p.literales} con nombre literal (${p.nombresDistintos} distintos)`);
  L.push(`  PUNTO CIEGO: ${p.noComparables} llamadas NO se comparan`
    + ` (${p.construidos} con el nombre construido, ${p.sinNombre} sin nombre) en ${p.ficherosConNoComparables} ficheros.`
    + ' Si se pierden, esta señal no lo ve.');
  L.push(`  REPETIDOS: ${p.nombresRepetidos} nombres declarados más de una vez`
    + ` (${p.nombresRepetidosEntreFicheros} en más de un fichero): se comparan por multiplicidad.`);
  L.push(`  TAP: ${r.tap.bytes} caracteres · ${r.tap.lineasDeTest} líneas de test · ${r.tap.lineasDeSuite} de suite`
    + ` · resumen: tests ${r.tap.tests ?? '?'} · fail ${r.tap.fail ?? '?'} · ${r.tap.entero ? 'entero' : 'NO ENTERO'}`);
  if (!r.medible) {
    L.push(`  ⚠️ NO PUDE MEDIR: ${r.motivo}.`);
    L.push('     Esto NO es «no falta nada»: es que no se ha podido comprobar.');
    return L.join(NL);
  }
  if (r.ausentes === 0 && r.dudosos === 0) {
    L.push(`  ✅ Los ${p.literales} nombres literales que el árbol declara están en el TAP.`);
    return L.join(NL);
  }
  if (r.ausentes > 0) {
    L.push(`  🔴 FALTAN AL MENOS ${r.ausentes} casos declarados, en ${r.bloques.length} fichero(s). La tanda no informó de ellos:`);
    for (const b of r.bloques) L.push('     ' + describirBloque(b));
  }
  if (r.dudosos > 0) {
    L.push(`  🟠 DUDOSOS: faltan ${r.dudosos} apariciones de ${r.dudas.length} nombre(s) repetido(s), y el TAP no dice de qué fichero:`);
    for (const x of r.dudas) L.push(`     «${x.nombre}» · declarado ${x.declarado}, registrado ${x.registrado} · ${x.ficheros.join(', ')}`);
  }
  return L.join(NL);
}

const escaparDato = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escaparPropiedad = (s) => escaparDato(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

/**
 * Los comandos de workflow (`::notice` / `::warning`) que anotan el run. Sólo texto: los imprime
 * el CLI por stdout, sin token ni API (medido en c.17961).
 *
 *   · UNA `::notice` SIEMPRE, también con 0, con el estado en el título y la línea de registro
 *     en el cuerpo: es de donde sale la tasa, y un registro con huecos da una tasa optimista.
 *   · UNA `::warning` por fichero con ausentes, con el rango de líneas EN EL TEXTO.
 *   · Un run completo no lleva NINGUNA `::warning`.
 *
 * Con más ficheros que `max - 1`, la última anotación dice cuántos se quedan fuera.
 */
export function comandosDeAnotacion(r, max = MAX_ANOTACIONES) {
  // El TÍTULO lleva el estado: quien repasa cincuenta runs descarta los ceros sin abrir ninguno.
  const estado = !r.medible ? 'NO PUDE MEDIR'
    : r.ausentes > 0 ? `FALTAN al menos ${r.ausentes} en ${r.bloques.length} fichero(s)`
      : r.dudosos > 0 ? `${r.dudosos} DUDOSO(S)`
        : 'completo · 0 ausentes';
  const comandos = ['::notice title=' + escaparPropiedad(`${TITULO} · ${estado}`) + '::' + escaparDato(lineaDeRegistro(r))];
  const aviso = (titulo, cuerpo) => comandos.push('::warning title=' + escaparPropiedad(titulo) + '::' + escaparDato(cuerpo));
  if (!r.medible) {
    aviso(`${TITULO} · NO PUDE MEDIR`, `${r.motivo}. Esto NO es «no falta nada»: es que no se ha podido comprobar.`);
    return comandos;
  }
  const filas = r.bloques.map((b) => [`${TITULO} · faltan casos`, describirBloque(b) + '. La tanda no informó de ellos y salió igual.']);
  if (r.dudosos > 0) {
    filas.push([`${TITULO} · dudosos`, `faltan ${r.dudosos} apariciones de ${r.dudas.length} nombre(s) repetido(s): `
      + r.dudas.map((x) => `«${x.nombre}» (${x.ficheros.join(', ')})`).join(' ; ')]);
  }
  const caben = Math.max(1, max - 1);
  if (filas.length <= caben) { for (const [t, c] of filas) aviso(t, c); return comandos; }
  for (const [t, c] of filas.slice(0, caben - 1)) aviso(t, c);
  aviso(`${TITULO} · y ${filas.length - (caben - 1)} más`, 'no caben en las anotaciones; están todas en el log del paso.');
  return comandos;
}

/**
 * LA TASA, sobre registros (uno por run). Pura: de dónde salen los registros es cosa de quien
 * la llama — se calcula FUERA del job, con `gh` (c.17954).
 *
 * Un run sin registro o con `medible: false` NO cuenta como limpio: va a `sinMedir`, y la tasa
 * se da sobre los MEDIDOS, con las tres cifras al lado. `tasa` es `null` si no hay ninguno.
 */
export function tasaDeRegistros(registros) {
  const todos = [...(registros ?? [])];
  const medidos = todos.filter((r) => r && r.medible === true && Number.isFinite(r.ausentes));
  const conAusentes = medidos.filter((r) => r.ausentes > 0);
  const tasa = medidos.length ? conAusentes.length / medidos.length : null;
  const ventanaCompleta = medidos.length >= VENTANA_DE_RUNS;
  return {
    poblacion: todos.length, medidos: medidos.length, sinMedir: todos.length - medidos.length,
    conAusentes: conAusentes.length, tasa, ventanaCompleta,
    bajoElUmbral: tasa === null || !ventanaCompleta ? null : tasa < UMBRAL_DE_BLOQUEO,
  };
}

/** La línea de la tasa: sale SIEMPRE, con su población, también con 0 y también sin medidos. */
export function lineaDeTasa(t) {
  const pct = t.tasa === null ? 'sin tasa' : `${(100 * t.tasa).toFixed(1)} %`;
  const umbral = `${(100 * UMBRAL_DE_BLOQUEO).toFixed(0)} %`;
  const veredicto = t.bajoElUmbral === null
    ? `NO SE PUEDE DECIR si está por debajo del ${umbral}: hacen falta ${VENTANA_DE_RUNS} runs medidos y hay ${t.medidos}`
    : t.bajoElUmbral ? `por DEBAJO del ${umbral} sobre ${t.medidos} runs medidos` : `por ENCIMA del ${umbral} sobre ${t.medidos} runs medidos`;
  return `[${TITULO} · tasa] ${t.conAusentes} de ${t.medidos} runs medidos con nombres ausentes (${pct})`
    + ` · población ${t.poblacion} runs · sin medir ${t.sinMedir} · ${veredicto} · tope ${FECHA_TOPE} (SCRUM-1339 c.17935)`;
}
