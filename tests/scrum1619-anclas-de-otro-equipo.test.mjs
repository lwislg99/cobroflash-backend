// SCRUM-1619 · Dos ANCLAS DE TEXTO de otro equipo cuelgan de líneas de `scripts/_censo-sin-consumir.mjs` (S0).
//
// `tests/_censo-vocabulario-ofrecido.mjs` (J6, SCRUM-1194d, decisión del fundador en SCRUM-1194 c.21005) lee la
// sonda de 1185 y parchea una COPIA en memoria buscando trozos literales de ella (su array `anclas`). Si una de
// esas líneas cambia, su censo sale CIEGO y su trinquete tumba el obligatorio de todos los PR, a cientos de líneas
// de quien hizo el cambio y sin que su propio fichero se lo diga. Aquí no se toca ni el consumidor ni su algoritmo
// (se LEE, por AST): sólo se hace VISIBLE el acoplamiento, en las dos direcciones.
//   · Cada ancla del consumidor casa UNA vez en la sonda (la condición exacta que él exige), y si no, este test cae
//     nombrando la línea, el consumidor y con quién se cambia.
//   · Cada ancla lleva encima, en su bloque de comentario, un aviso con la marca y la ruta del consumidor: quien
//     edita la línea se lo encuentra sin conocer el fichero del otro equipo.
//   · No queda ningún aviso huérfano: si el consumidor deja de usar un ancla, el aviso se quita (no baja en silencio).
//
// LO QUE NO VE: lo que el parche del consumidor INSERTA y que no es un ancla de texto (hoy, el nombre `routes`
// dentro de `rutasInternas: routes`). Va dicho en el aviso de esa línea; si se renombra, lo caza el trinquete de
// 1194d al importar la copia, no este test. Y depende de que el consumidor llame `anclas` a su lista: si la
// renombra, este test cae como CIEGO (nunca en verde).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(path.join(RAIZ, 'package.json'))('typescript');

export const SONDA = 'scripts/_censo-sin-consumir.mjs';
export const CONSUMIDOR = 'tests/_censo-vocabulario-ofrecido.mjs';
export const MARCA = 'ANCLA DE OTRO EQUIPO';

const esComentario = (l) => /^\s*\/\//.test(l);

/** Las anclas que el consumidor busca en la sonda: el primer literal de cada fila de su array `anclas`. */
export function anclasDelConsumidor(texto) {
  const sf = ts.createSourceFile('consumidor.mjs', texto, ts.ScriptTarget.Latest, true);
  let declaraciones = 0; const anclas = []; const ilegibles = [];
  const walk = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'anclas'
      && n.initializer && ts.isArrayLiteralExpression(n.initializer)) {
      declaraciones++;
      for (const fila of n.initializer.elements) {
        const [a, , q] = ts.isArrayLiteralExpression(fila) ? fila.elements : [];
        if (!a || !ts.isStringLiteralLike(a)) { ilegibles.push(fila.getText(sf).slice(0, 80)); continue; }
        anclas.push({ texto: a.text, rotulo: q && ts.isStringLiteralLike(q) ? q.text : a.text });
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return { declaraciones, anclas, ilegibles };
}

/** Los problemas de la sonda frente a esas anclas: cada uno, una frase que nombra la causa. Vacío = bien. */
export function comprobarAnclas(fuente, anclas) {
  const lineas = fuente.split(/\r?\n/);
  const problemas = []; const lineasConAncla = new Set(); let perdidas = 0;
  for (const a of anclas) {
    const veces = fuente.split(a.texto).length - 1;
    if (veces !== 1) {
      perdidas++;
      problemas.push(`el ancla «${a.rotulo}» (${JSON.stringify(a.texto)}) casa ${veces} veces en ${SONDA}, y ${CONSUMIDOR} `
        + `(J6, SCRUM-1194d) exige exactamente 1: su censo sale CIEGO y cae su trinquete en el obligatorio. `
        + `Deja la línea como estaba, o cámbiala junto con J6 (Jira, dos-equipos.md §5).`);
      continue;
    }
    const linea = fuente.slice(0, fuente.indexOf(a.texto)).split(/\r?\n/).length - 1;
    lineasConAncla.add(linea);
    let i = linea - 1; let avisada = false;
    while (i >= 0 && esComentario(lineas[i])) {
      if (lineas[i].includes(MARCA)) { avisada = lineas.slice(i, linea).join('\n').includes(CONSUMIDOR); break; }
      i--;
    }
    if (!avisada) {
      problemas.push(`la línea ${linea + 1} de ${SONDA} es el ancla «${a.rotulo}» de ${CONSUMIDOR} y no lleva encima `
        + `su aviso (un comentario con «${MARCA}» y la ruta del consumidor): quien la edite no sabrá que tumba el obligatorio.`);
    }
  }
  // Con un ancla perdida no se sabe a qué línea apuntaba su aviso, y llamarlo huérfano mandaría a QUITARLO: la
  // instrucción contraria. El rojo ya está dado arriba, con la que hay que seguir.
  if (perdidas) return problemas;
  lineas.forEach((l, i) => {
    if (!esComentario(l) || !l.includes(MARCA)) return;
    let j = i + 1; while (j < lineas.length && esComentario(lineas[j])) j++;
    if (!lineasConAncla.has(j)) {
      problemas.push(`el aviso de la línea ${i + 1} de ${SONDA} no está encima de ningún ancla que ${CONSUMIDOR} use hoy: `
        + `si el consumidor la dejó, quita el aviso; si la línea se movió, mueve el aviso con ella.`);
    }
  });
  return problemas;
}

test('las anclas del consumidor se leen: población declarada y sin ilegibles (si no, CIEGO, nunca verde)', (t) => {
  const { declaraciones, anclas, ilegibles } = anclasDelConsumidor(fs.readFileSync(path.join(RAIZ, CONSUMIDOR), 'utf8'));
  t.diagnostic(`${CONSUMIDOR}: ${declaraciones} lista(s) \`anclas\` · ${anclas.length} ancla(s): ${anclas.map((a) => a.rotulo).join(' · ')}`);
  assert.equal(declaraciones, 1, `CIEGO: esperaba UNA lista \`anclas\` en ${CONSUMIDOR} y hay ${declaraciones}. Si J6 cambió su forma, este test se adapta a ella; no se borra.`);
  assert.deepEqual(ilegibles, [], `CIEGO: filas de \`anclas\` cuyo primer elemento no es un literal: no sé qué buscan`);
  assert.ok(anclas.length >= 1, `CIEGO: \`anclas\` está vacía en ${CONSUMIDOR}; si de verdad ya no parchea nada, este test y los avisos se retiran a la vez`);
});

test('cada ancla casa UNA vez en la sonda de S0, lleva su aviso encima, y no hay avisos huérfanos', () => {
  const { anclas } = anclasDelConsumidor(fs.readFileSync(path.join(RAIZ, CONSUMIDOR), 'utf8'));
  const problemas = comprobarAnclas(fs.readFileSync(path.join(RAIZ, SONDA), 'utf8'), anclas);
  assert.deepEqual(problemas, [], `\n  · ${problemas.join('\n  · ')}\n`);
});

// SCRUM-846c ③: el instrumento delante de un caso conocido que no es el árbol de verdad.
test('CASO FABRICADO: la comprobación caza las cuatro formas y calla ante la buena', () => {
  const ANCLA = [{ texto: 'hazAlgo(n) });', rotulo: 'hazAlgo' }];
  const aviso = `  // ⚠️ ${MARCA}: ${CONSUMIDOR} copia la línea de abajo.\n`;
  const buena = `function f(n) {\n${aviso}  lista.push({ a: hazAlgo(n) });\n}\n`;
  assert.deepEqual(comprobarAnclas(buena, ANCLA), [], 'NO: con el ancla una vez y su aviso encima, no hay nada que decir');
  assert.deepEqual(comprobarAnclas(buena.replace(/\n/g, '\r\n'), ANCLA), [], 'NO: igual en un fichero CRLF');

  const cambiada = comprobarAnclas(buena.replace('hazAlgo(n) });', 'hazAlgo(n), });'), ANCLA);
  assert.equal(cambiada.length, 1, `SÍ: ancla cambiada → 0 veces, y SIN mandar a quitar su aviso: ${cambiada.join(' | ')}`);
  assert.match(cambiada[0], /casa 0 veces .* exige exactamente 1: su censo sale CIEGO/);
  assert.ok(cambiada[0].includes(CONSUMIDOR), 'al caer nombra al consumidor');

  const doble = comprobarAnclas(`${buena}const g = (n) => hazAlgo(n) });\n`, ANCLA);
  assert.match(doble.join('|'), /casa 2 veces/, 'SÍ: el ancla dos veces');

  const sinAviso = comprobarAnclas(buena.replace(aviso, ''), ANCLA);
  assert.equal(sinAviso.length, 1);
  assert.match(sinAviso[0], /línea 2 .* no lleva encima su aviso/, 'SÍ: ancla sin aviso, con su línea');

  const huerfano = comprobarAnclas(`${aviso}const otra = 1;\n${buena}`, ANCLA);
  assert.equal(huerfano.length, 1);
  assert.match(huerfano[0], /aviso de la línea 1 .* no está encima de ningún ancla/, 'SÍ: aviso huérfano');
});

// Lo que tiene que tumbar este test (meta-guard): cambiar una de las dos líneas de verdad, o quitarle el aviso.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Un cambio inocente en la línea del ancla 1: el consumidor deja de encontrarla.
    fichero: 'scripts/_censo-sin-consumir.mjs',
    de: 'cuerpoLeido: clavesLeidas(n) });',
    a: 'cuerpoLeido: clavesLeidas(n), });',
    cae: 'cada ancla casa UNA vez en la sonda de S0, lleva su aviso encima, y no hay avisos huérfanos',
  },
  {
    // El aviso del ancla 2 pierde la marca: quien edite esa línea ya no se lo encuentra.
    fichero: 'scripts/_censo-sin-consumir.mjs',
    de: '// ⚠️ ANCLA DE OTRO EQUIPO (SCRUM-1619): `tests/_censo-vocabulario-ofrecido.mjs` (J6, SCRUM-1194d) copia la\n',
    a: '// `tests/_censo-vocabulario-ofrecido.mjs` (J6, SCRUM-1194d) copia la\n',
    cae: 'cada ancla casa UNA vez en la sonda de S0, lleva su aviso encima, y no hay avisos huérfanos',
  },
];
