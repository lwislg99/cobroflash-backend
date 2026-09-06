// tests/scrum738-el-tablero-contra-el-arbol.test.mjs — SCRUM-738
//
// Sin gate: lee git y el árbol. Ni BD, ni red externa, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TABLERO REFLEJA UNA INTENCIÓN Y SE LEE COMO SI REFLEJARA HECHOS
//
// En un solo día se encargaron diez tickets ya mergeados. Cuatro sesiones pararon a decirlo, una
// vuelta cada una. El coste no son las vueltas: es que **la parada depende de que alguien se dé
// cuenta**, y eso no es un mecanismo.
//
// ⛔ EL CENSO PROPONE, NUNCA ACTÚA. No cierra tickets y no toca el tablero.
//
// ── 🔴 EL MOTOR YA EXISTÍA, Y MI PASO 0 SE EQUIVOCÓ ─────────────────────────────────────────
// `tests/_censo-tickets.mjs` (SCRUM-388) contesta desde agosto «¿qué hay en `main` de un ticket?»
// con las mismas tres fuentes. Llegué a escribir un motor entero antes de encontrarlo —lo busqué
// en `scripts/censo-*` y no miré en `tests/`— y se retiró ENTERO: la misma regla implementada dos
// veces es cómo una de las dos se queda atrás.
//
// Lo que este ticket añade es SUPERFICIE (enumerar y presentar) y UN ARREGLO DENTRO DEL MOTOR:
// el discriminador de NÚMERO COMPARTIDO.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ejecutableDe } from './_guard-texto.mjs';
import { censarTicket, numeroDelTituloDeEntrada } from './_censo-tickets.mjs';
import { numeroDeRama, numeroDeEntrada, numerosDelArbol, poblacionDe } from '../scripts/censo-tablero-vs-arbol.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

// ═══ ① POR IDENTIDAD: EL SUBSTRING QUE ESTE TICKET PROHÍBE ═══════════════════════════════

test('SCRUM-738 · 🔴 «72» NO casa con 720, 727 ni 1727 — se compara el NÚMERO', () => {
  assert.equal(numeroDeRama('scrum-72-lo-que-sea'), 72);
  assert.equal(numeroDeRama('scrum-720-marcadores'), 720);
  assert.equal(numeroDeRama('scrum-727-constancia'), 727);
  assert.equal(numeroDeRama('scrum-1727-inventado'), 1727);
  assert.equal(new Set([72, 720, 727, 1727].map((n) => numeroDeRama(`scrum-${n}-x`))).size, 4,
    '🔴 dos de los cuatro números colapsan: el censo propondría cerrar el que no es.');

  // El delimitador es obligatorio: sin él, `scrum-72` casaría con el principio de `scrum-727-x`.
  assert.equal(numeroDeRama('scrum-72'), null, '🔴 una rama sin sufijo se está aceptando');
  assert.equal(numeroDeRama('feature/scrum-72-x'), null, '🔴 no está anclado al principio');
  // La letra de fase pertenece al MISMO ticket.
  assert.equal(numeroDeRama('scrum-684b-albaran-sin-presupuesto'), 684);

  assert.equal(numeroDeEntrada('SCRUM-714.md'), 714);
  assert.equal(numeroDeEntrada('SCRUM-71.md'), 71, '🔴 71 y 714 se están confundiendo');
  assert.equal(numeroDeEntrada('LEEME.md'), null);
});

// ═══ ② EL NÚMERO COMPARTIDO — el arreglo que va DENTRO del motor ═════════════════════════

test('SCRUM-738 · 🔴 el TÍTULO de la entrada se lee, no el nombre del fichero', () => {
  // El fichero real lleva un aviso en blockquote ANTES del título, así que se recorren las líneas.
  assert.equal(numeroDelTituloDeEntrada('---\n\n> aviso\n# SCRUM-683 (cableado) · el dictado'), 683);
  assert.equal(numeroDelTituloDeEntrada('# SCRUM-738 · x'), 738);
  // «No lo sé» NO es «es de otro»: sin título no se acusa de colisión.
  assert.equal(numeroDelTituloDeEntrada('sin ningún título'), null);
});

test('SCRUM-738 · 🔴 SCRUM-684 NO se da por hecho: su entrada está titulada para OTRO', () => {
  // 🔴 EL FALSO POSITIVO QUE ABRIÓ ESTE ARREGLO. `censarTicket(684)` daba **ENTERO**, y 684 NO está
  // hecho —hay una sesión en su FASE B—. `docs/master/SCRUM-684.md` existe y su primer título dice
  // `# SCRUM-683`: dos sesiones se inventaron el mismo número, y dentro hay trabajo de SCRUM-703 y
  // de SCRUM-683. Con el número compartido ni sus ramas ni sus commits son atribuibles.
  const doc = path.join(RAIZ, 'docs/master/SCRUM-684.md');
  assert.ok(fs.existsSync(doc),
    '🔴 GUARD CIEGO: ya no existe `docs/master/SCRUM-684.md`, así que este control no está mirando '
    + 'el caso que cree. Si el fichero se movió —estaba previsto—, este test se retira con él.');
  assert.equal(numeroDelTituloDeEntrada(fs.readFileSync(doc, 'utf8')), 683,
    '🔴 el fichero ya no está titulado para SCRUM-683: el caso ha cambiado y hay que remedirlo.');

  const r = censarTicket(684, { raiz: RAIZ });
  assert.equal(r.veredicto, 'NO_MEDIBLE',
    `🔴 SCRUM-684 sale como «${r.veredicto}» y su entrada es de otro ticket. Proponer cerrar algo `
    + 'no hecho es el peor resultado que puede dar este censo — peor que no tenerlo.');
  assert.equal(r.colision.tituladoPara, 683);
  assert.match(r.porque, /NÚMERO COMPARTIDO/);
});

test('SCRUM-738 · ✅ CONTROL NEGATIVO: una entrada PROPIA no se acusa de nada', () => {
  // Sin esto, un discriminador que marcara TODO parecería que funciona. Y me pasó: comparaba un
  // número contra la cadena `n` del motor, así que `714 !== '714'` era cierto y los 444 tickets
  // salían con colisión. Falló hacia el lado seguro y aun así dejaba el censo inservible.
  for (const n of [695, 714, 738]) {
    const r = censarTicket(n, { raiz: RAIZ });
    assert.equal(r.colision, null,
      `🔴 SCRUM-${n} se está acusando de número compartido y su entrada es suya.`);
    assert.notEqual(r.veredicto, 'NO_MEDIBLE');
  }
});

// ═══ ③ EL SUELO ══════════════════════════════════════════════════════════════════════════

test('SCRUM-738 · 🔴 SUELO: si el censo devuelve CERO, esto falla', () => {
  const { numeros, refs, entradas } = numerosDelArbol(RAIZ);
  assert.ok(numeros.length > 0,
    '🔴 CENSO VACÍO: cero tickets. NO significa «el tablero está al día»: significa que el '
    + 'derivador no ha visto ni ramas ni entradas de máster, y todo lo que se dijera después '
    + 'sería cierto sobre la nada.');
  assert.ok(refs > 10 && entradas > 10,
    `🔴 SUELO: ${refs} ramas y ${entradas} entradas. Con tan pocas, el censo no está mirando el '
    + 'repositorio que cree.`);
  assert.ok(numeros.length >= 4,
    `🔴 sólo ${numeros.length} tickets censados, y el encargo dice que hoy hay al menos cuatro `
    + 'con desfase. Un censo que no llega a cuatro no está midiendo.');
});

// ═══ ④ PROPONE, NUNCA ACTÚA ══════════════════════════════════════════════════════════════

test('SCRUM-738 · 🔴 la salida PROPONE y no actúa — nada de cerrar, nada de tablero', () => {
  // Sobre el CÓDIGO EJECUTABLE, no sobre la prosa: la primera versión miraba el fichero entero y
  // se puso roja porque mis COMENTARIOS nombran el tablero para explicar que no se toca.
  const rel = 'scripts/censo-tablero-vs-arbol.mjs';
  const codigo = ejecutableDe(fs.readFileSync(path.join(RAIZ, rel), 'utf8'),
    { donde: rel, ancla: 'censar' });
  assert.equal(/writeFileSync|appendFileSync|fetch\(|https?:\/\/[a-z]/i.test(codigo), false,
    `🔴 «${rel}» escribe o sale a la red. Este censo IMPRIME y nada más: propone, no actúa.`);

  // 🔴 SE PROHÍBE LA ACCIÓN, NO LA PALABRA — y esto también me cazó: saltaba por el literal donde
  // el censo DECLARA lo que no mide, que es justo lo que el ticket pide que diga. Prohibir la
  // palabra habría obligado a borrar la declaración para pasar el guard.
  const sinCadenas = codigo.replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, "''");
  assert.equal(/\bjira\w*\s*\(|atlassian/i.test(sinCadenas), false,
    `🔴 «${rel}» LLAMA al tablero desde el código. Declararlo en un texto está bien; invocarlo no.`);

  const fuente = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  assert.match(fuente, /PROPUESTA/, '🔴 la salida ha dejado de llamarse propuesta.');

  // 🔴 SE COMPRUEBA EL DATO, NO LA PROSA — y este hueco lo destapó el rojo, no la lectura. La
  // primera versión buscaba «NO mide» EN EL FUENTE, y esa cadena vive también en el `console.log`
  // de la cabecera: vaciando el valor declarado (`noMide: 'nada'`) el guard seguía VERDE. Un guard
  // que mira la frase en vez del valor aprueba un censo que ya no declara nada.
  const p = poblacionDe(RAIZ);
  assert.match(p.noMide, /TABLERO/i,
    '🔴 el censo ha dejado de DECLARAR que no lee el tablero. Sin esa declaración su propuesta se '
    + 'lee como un veredicto sobre Jira, que es justo lo que no es.');
  assert.match(p.motor, /_censo-tickets/,
    '🔴 el censo ha dejado de declarar de quién es el motor.');
});

test('SCRUM-738 · 🔴 esta pieza es SUPERFICIE: el motor sigue siendo el de SCRUM-388', () => {
  // Un trinquete contra mi propio error: si alguien vuelve a escribir aquí la lógica de las tres
  // fuentes, habrá dos motores y uno se quedará atrás. Esta pieza enumera y presenta; el veredicto
  // lo da `censarTicket`.
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts/censo-tablero-vs-arbol.mjs'), 'utf8');
  assert.match(fuente, /from '\.\.\/tests\/_censo-tickets\.mjs'/,
    '🔴 ha dejado de usar el motor de SCRUM-388: se está reimplementando el censo.');
  const codigo = ejecutableDe(fuente, { donde: 'el censo', ancla: 'censarTicket' });
  assert.equal(/veredicto\s*=\s*['"]/.test(codigo), false,
    '🔴 aquí se está calculando un veredicto propio. El veredicto es del motor.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-745 (adopción) · LAS MUTACIONES DE ESTE GUARD
//
// 🔴 ESTE HUECO ESTABA DECLARADO Y ABIERTO A PROPÓSITO. Sin declaración, el meta-guard no
// ejercitaba este fichero: su rojo dependía de que alguien se acordara de inyectar el defecto a
// mano en un scratchpad — que es LITERALMENTE el defecto que SCRUM-745 vino a quitar. Un guard
// cuya prueba depende de que alguien se acuerde no es un mecanismo.
//
// Son dos porque el ticket son dos piezas separables: la SUPERFICIE que enumera (`numeroDeRama`)
// y el ARREGLO DENTRO DEL MOTOR (el número compartido). Cada una puede quedarse muda sola.
//
// ⚠️ LAS DOS ANCLAS VAN SIN BARRAS INVERTIDAS, y no es estética: en SCRUM-748 un ancla que
// llevaba `\s` perdió la barra camino del fichero y no casaba con nada. El meta-guard lo dijo
// —CIEGO, «la declaración caducó»—, pero el ancla que no se puede escribir bien es un ancla que
// caduca sola. La primera muta la FIRMA de la función y mete el defecto detrás; la segunda apaga
// el título leído, que es una línea sin ninguna barra.
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① EL SUBSTRING QUE ESTE TICKET PROHÍBE, reconstruido: se quita el delimitador obligatorio.
    // `scrum-72` vuelve a dar 72 en vez de `null`, o sea que «72» vuelve a casar con el principio
    // de `scrum-727-x`. Con eso el censo propondría cerrar el ticket que no es — el peor resultado
    // que puede dar, peor que no tenerlo.
    fichero: 'scripts/censo-tablero-vs-arbol.mjs',
    de: 'export function numeroDeRama(nombre) {',
    a: 'export function numeroDeRama(nombre) {\n  const mm = /^scrum-0*([0-9]+)/.exec(String(nombre ??0).trim()); return mm ? Number(mm[1]) : null;',
    cae: '«72» NO casa con 720, 727 ni 1727 — se compara el NÚMERO',
  },
  {
    // ② EL FALSO POSITIVO QUE ABRIÓ EL ARREGLO: sin el título leído, el discriminador de número
    // compartido se apaga entero y `docs/master/SCRUM-684.md` vuelve a contar como fuente propia
    // aunque esté titulado para SCRUM-683. `censarTicket(684)` volvería a decir ENTERO sobre un
    // ticket que NO está hecho.
    //
    // La colisión se calcula con un ternario, así que apagar el título la deja en `null` limpio y
    // el CONTROL NEGATIVO de al lado sigue verde: cae este caso y sólo este.
    fichero: 'tests/_censo-tickets.mjs',
    de: '  const tituloDelDoc = doc ? numeroDelTituloDeEntrada(doc) : null;',
    a: '  const tituloDelDoc = null;',
    cae: 'SCRUM-684 NO se da por hecho: su entrada está titulada para OTRO',
  },
];
