// tests/scrum700-filtros-de-comentario.test.mjs — SCRUM-700
//
// LA VÍCTIMA: la violación que nadie ve porque el guard que la vigilaba se quedó ciego.
//
// 94 ficheros de `tests/` filtran comentarios por su cuenta, cada uno con su regex. **31 cortan
// dentro de una cadena**: en cuanto la línea lleva un `https://`, todo lo que venga detrás
// desaparece del texto que el guard mira, y el guard aprueba lo que ya no puede ver. Otros 47 sólo
// encogen —dejan el comentario dentro— y eso es ruido, no silencio: se ve y se corrige.
//
// EL SITIO ÚNICO que debería decidirlo ya existe: `soloEjecutable`. Este fichero hace dos cosas:
// congela el censo con un trinquete, y **ata la corrección del helper contra el HECHO**.
//
// ⚠️ POR QUÉ CONTRA EL HECHO Y NO CONTRA LOS FILTROS QUE SUSTITUYE: si el helper tuviera el mismo
// defecto, los 94 coincidirían con él EN EL ERROR y la comparación diría «de acuerdo». Se comprueba
// con sondas construidas desde el comportamiento que se quiere, no desde lo que hacen los otros.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR_TESTS = path.join(RAIZ, 'tests');

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL HELPER, CONTRA EL HECHO
// ═══════════════════════════════════════════════════════════════════════════════════════════

const SONDAS = Object.freeze([
  ['una URL dentro de una cadena no parte la línea',
    "const u = 'https://yaqu.app/x'; const VIVO = 1;", 'VIVO', true],
  ['🔴 el comentario AL FINAL de una línea con código se va',
    'const x = 1; // aqui PALABRA', 'PALABRA', false],
  ['una línea entera comentada se va',
    '// const OCULTO = 1;', 'OCULTO', false],
  ['un bloque /* */ multilínea se va',
    'const a = 1;\n/* const DENTRO = 2;\n   sigue */\nconst b = 3;', 'DENTRO', false],
  ['un // dentro de comillas dobles no es comentario',
    'const s = "a // b"; const DESPUES = 1;', 'DESPUES', true],
  ['un // dentro de una plantilla no es comentario',
    'const s = `a // b`; const TRAS_PLANTILLA = 1;', 'TRAS_PLANTILLA', true],
  ['una barra de división no es comentario',
    'const r = a / b; const DIVIDIDO = 1;', 'DIVIDIDO', true],
  ['una regex que acaba en \\/ no se confunde con //',
    'const re = /https:\\/\\//; const TRAS_REGEX = 1;', 'TRAS_REGEX', true],
  ['un /* dentro de una cadena no abre bloque',
    'const s = "/* no soy bloque */"; const TRAS_FALSO = 1;', 'TRAS_FALSO', true],
]);

test('SCRUM-700 · 🔴 `soloEjecutable` es correcto CONTRA EL HECHO, sonda a sonda', () => {
  const fallos = [];
  for (const [nombre, entrada, aguja, debeSobrevivir] of SONDAS) {
    const salida = soloEjecutable(entrada);
    const sobrevive = salida.includes(aguja);
    if (sobrevive !== debeSobrevivir) {
      fallos.push(`${nombre}\n        entrada: ${JSON.stringify(entrada)}\n        salida : ${JSON.stringify(salida)}`);
    }
  }
  assert.deepEqual(fallos, [],
    '🔴 EL SITIO ÚNICO SE HA ROTO, y de él cuelgan decenas de guards:\n    ' + fallos.join('\n    '));
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO QUE IMPORTA — un filtro de los 31, corrido sobre código de verdad
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** El filtro peligroso, tal cual está escrito hoy en 31 ficheros de `tests/`. */
const FILTRO_PELIGROSO = (fuente) => fuente.replace(/\/\/[^\n]*/g, '');

test('SCRUM-700 · 🔴 el filtro de los 31 CIEGA una violación real; el helper la ve', () => {
  // No es de laboratorio: así se escribe en este árbol. `//` va dentro de una cadena y la
  // violación que el guard busca viene DETRÁS, en la misma línea.
  const codigo = "const BASE = 'https://ejemplo.invalid/v21.0'; elemento.innerHTML = peligro;";
  const PROHIBIDO = 'innerHTML';

  const conFiltroViejo = FILTRO_PELIGROSO(codigo);
  assert.ok(!conFiltroViejo.includes(PROHIBIDO),
    '🔴 el caso NO discrimina: con el filtro peligroso la violación tenía que DESAPARECER, y sigue '
    + `ahí. Sin eso, esta prueba pasaría con los dos mecanismos y no probaría ninguno. Salió: ${conFiltroViejo}`);

  const conHelper = soloEjecutable(codigo);
  assert.ok(conHelper.includes(PROHIBIDO),
    '🔴 el helper también se ha comido la violación. Entonces migrar no arregla nada: sería cambiar '
    + `un ciego por otro. Salió: ${conHelper}`);

  // Y la URL sobrevive entera, que es lo que dice que no cortó dentro de la cadena.
  assert.ok(conHelper.includes('ejemplo.invalid'), `🔴 el helper partió la URL: ${conHelper}`);
});

test('SCRUM-700 · ✅ CONTROL NEGATIVO: un comentario de verdad SÍ se sigue quitando', () => {
  // Migrar 94 filtros y quedarse con guards que ya no muerden sería cambiar ruido por silencio.
  // El caso que este fichero existe para cerrar: el literal prohibido escrito en la prosa que
  // explica la prohibición.
  const codigo = 'const a = 1; // aquí NO se puede usar innerHTML, y por eso está escrito\nconst b = 2;';
  const limpio = soloEjecutable(codigo);

  // 🔴 EL HERMANO DEL TOKEN, que es lo que convierte la negación de abajo en un dato (SCRUM-237):
  // el MISMO token, escrito en CÓDIGO en vez de en el comentario, tiene que sobrevivir. Sin esto,
  // una salida vacía aprobaría la negación para siempre y nadie lo notaría.
  const conElTokenVivo = soloEjecutable('elemento.innerHTML = x; // y aquí innerHTML explicado');
  assert.ok(conElTokenVivo.includes('innerHTML'),
    `🔴 el filtro se come el token AUNQUE ESTÉ EN CÓDIGO: la negación de abajo sería un verde `
    + `permanente, no una comprobación. Salió: ${conElTokenVivo}`);
  assert.equal((conElTokenVivo.match(/innerHTML/g) || []).length, 1,
    `🔴 tenía que quedar UNA aparición —la del código— y no la del comentario: ${conElTokenVivo}`);

  assert.ok(!limpio.includes('innerHTML'),
    `🔴 el comentario que EXPLICA la prohibición sigue dentro: el guard se cazará a sí mismo. ${limpio}`);
  assert.ok(limpio.includes('const a = 1;') && limpio.includes('const b = 2;'),
    `🔴 se ha llevado por delante código vivo: ${limpio}`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO, CON TRINQUETE
// ═══════════════════════════════════════════════════════════════════════════════════════════

const SONDA_CIEGA = "const u = 'https://yaqu.app/x'; const VIVO_UNO = 1;";
const RE_LITERAL = /\.replace\(\s*(\/(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\\\n])+\/[gimsuy]*)/g;

/** Los ficheros de `tests/` con filtro propio, clasificados EJECUTANDO sus regex. */
// 🔴 ESTE FICHERO SE EXCLUYE, Y LA EXCEPCIÓN VA DECLARADA, NO ESCONDIDA: lleva el filtro
// peligroso escrito A PROPÓSITO —en `FILTRO_PELIGROSO`— para demostrar que ciega. Sin esta
// línea el censo se cuenta a sí mismo y da 32 en vez de 31. Es la trampa de autorreferencia de
// siempre: el guard se caza en el ejemplo que explica lo que prohíbe.
const EXCLUIDOS = new Set(['scrum700-filtros-de-comentario.test.mjs']);

function censo() {
  const out = { conPropio: [], ciegan: [], usanHelper: [] };
  for (const nombre of fs.readdirSync(DIR_TESTS).filter((n) => /\.(mjs|js)$/.test(n))) {
    if (EXCLUIDOS.has(nombre)) continue;
    const rel = 'tests/' + nombre;
    const fuente = fs.readFileSync(path.join(DIR_TESTS, nombre), 'utf8');
    if (/soloEjecutable/.test(fuente)) out.usanHelper.push(rel);

    const propias = [];
    for (const m of fuente.matchAll(RE_LITERAL)) {
      const literal = m[1];
      const corte = literal.lastIndexOf('/');
      const cuerpo = literal.slice(1, corte);
      if (!/\\\/\\\/|\\\/\\\*/.test(cuerpo)) continue;
      try { propias.push(new RegExp(cuerpo, literal.slice(corte + 1))); } catch { /* ignora */ }
    }
    if (propias.length === 0) continue;
    out.conPropio.push(rel);

    const tras = propias.reduce((t, re) => { try { return t.replace(re, ''); } catch { return t; } }, SONDA_CIEGA);
    if (!tras.includes('VIVO_UNO')) out.ciegan.push(rel);
  }
  return out;
}

// Medido el 4-sep-2026. El trinquete APRIETA: si baja, se anota; si sube, cae.
const CIEGAN_HOY = 31;
const CON_PROPIO_HOY = 91;

test('SCRUM-700 · 🔴 SUELO: el censo VE filtros propios, y un cero se declara ciego', () => {
  const c = censo();
  assert.ok(c.conPropio.length >= 40,
    `🔴 CIEGO: sólo ${c.conPropio.length} ficheros con filtro propio, y hay decenas. Con el barrido `
    + 'a medias, «ninguno ciega» no significaría nada.');
  assert.ok(c.usanHelper.length >= 30,
    `🔴 CIEGO: sólo ${c.usanHelper.length} ficheros usan el helper y hay 34 migrados (SCRUM-694). `
    + 'Si el barrido no encuentra los que YA conocemos, está roto.');
});

test('SCRUM-700 · 🔴 el número de filtros que CIEGAN CÓDIGO no sube', () => {
  const c = censo();
  assert.ok(c.ciegan.length <= CIEGAN_HOY,
    `🔴 HAN APARECIDO FILTROS NUEVOS QUE CIEGAN CÓDIGO: ${c.ciegan.length} (el censo decía ${CIEGAN_HOY}).\n`
    + '    Un filtro que corta en cualquier `//` deja al guard sin ver lo que hay tras una URL.\n'
    + `    Se usa \`soloEjecutable\` de tests/_guard-texto.mjs.\n    ${c.ciegan.join('\n    ')}`);

  if (c.ciegan.length < CIEGAN_HOY) {
    assert.fail(
      `✅ han bajado, que es la dirección buena: ${c.ciegan.length} < ${CIEGAN_HOY}.\n`
      + '    Baja `CIEGAN_HOY` en este mismo commit y anota cuáles se migraron. Un trinquete que '
      + 'sólo sabe subir deja de significar algo el día que algo se arregla.');
  }
  assert.ok(c.conPropio.length <= CON_PROPIO_HOY,
    `🔴 más ficheros con filtro propio: ${c.conPropio.length} > ${CON_PROPIO_HOY}. El sitio único es `
    + '`soloEjecutable`; estrenar otro filtro lo vuelve a partir en dos.');
});
