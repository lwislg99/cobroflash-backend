// tests/scrum719-el-suelo-de-los-doce.test.mjs — SCRUM-719
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// TRECE GUARDS AFIRMABAN NEGACIONES SIN RESPALDO: PASABAN IGUAL SOBRE UN FICHERO VACÍO.
//
//     const codigo = soloEjecutable(texto);
//     assert.doesNotMatch(codigo, /LO_PROHIBIDO/);   // ← con `codigo === ''` pasa siempre
//
// Medido el 4-sep-2026 rompiendo el filtro (`npm run censo:mudez`): de los **73 guards que lo
// llaman de verdad**, 60 se ponían rojos y **13 seguían en verde mirando la nada**.
//
// 🔴 Y LO QUE HAY QUE ENTENDER PARA ARREGLARLO BIEN: **casi todos tenían suelo ya**, y todos lo
// tenían apuntando UN PASO ANTES de la ceguera:
//
//   · `scrum374`  «he leído el sellador»            → `SELLADOR.length > 2000`, sobre el CRUDO
//   · `scrum394`  «he encontrado la rama»           → `assert.ok(bloque)`, ANTES de filtrar
//   · `scrum382`  «el nombre prohibido existe»      → sí, pero en OTRO fichero
//   · `scrum293`  ídem · `scrumD1` ídem · `scrum549` los marcadores, sobre el texto CRUDO
//   · `scrum372`  «he mirado 3.000 líneas»          → cuenta lo que ENTRA, no lo que sale
//
// Ninguno comprobaba lo único que respalda la negación: **que el texto registrado tenga
// sustancia**. El suelo estaba en la puerta de al lado.
//
// ── EL ARREGLO: UN ANCLA, NO UN NÚMERO ───────────────────────────────────────────────────
// El ancla es algo de lo que el guard YA depende: el símbolo que importa, la función que la
// pantalla publica, el marcador que el censo busca. Si desaparece, el guard estaba mirando otro
// fichero **y quiere enterarse**. No hay ningún número que mantener a mano — que es el defecto
// de SCRUM-402, donde un umbral escrito a mano nace para desactivarse.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejecutableDe, ejecutablesDe, leerFuente } from './_guard-texto.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * LOS TRECE, CON LO QUE LES DA EL SUELO. La columna de la derecha no es decorativa: es lo que
 * este trinquete exige que siga estando, y es distinta según qué afirme cada guard.
 *
 * · Los once primeros hacen UNA negación sobre UN texto → un ANCLA que tiene que sobrevivir.
 * · `scrum372` y `scrum458` BARREN muchos textos, donde no hay ancla común → el suelo es un
 *   RECUENTO DE LO FILTRADO, que es lo que su contador viejo no miraba.
 */
const LOS_TRECE = Object.freeze([
  ['scrum149-sin-lineas-no-sella', "ancla: 'listQuotesAdmin'"],
  ['scrum199-fuente-unica-hijos', "ancla: '_evidencia-tanda'"],
  ['scrum293-retencion-irpf', "ancla: 'TIPOS_RETENCION'"],
  ['scrum317-trabajo-por-su-nombre', "ancla: 'renderJobDetailView'"],
  ['scrum347-origen-de-la-factura', "ancla: 'allocateInvoiceNumber'"],
  ['scrum370-gastos-del-trabajo', "ancla: 'Gastos de este trabajo'"],
  ['scrum382-foto-duplicada', "ancla: 'huellaDeBytes'"],
  ['scrum394-plan-mudo', "ancla: 'skipped.push'"],
  ['scrum448-cobros-estado-de-carga', "ancla: 'renderCobrosView'"],
  ['scrum549-nada-publicable-sin-marcar', 'ancla: [...MARCADORES]'],
  ['scrumD1-puerta-serie', "'renderPuertaSerie'"],
  ['scrum372-un-dato-un-nombre', 'lineasConCodigo'],
  ['scrum458-paquete-de-precarga', 'sinCodigo'],
]);

// ═══ 🔴 EL TRINQUETE ══════════════════════════════════════════════════════════════════════

test('SCRUM-719 · 🔴 SUELO: los trece ficheros existen y se leen', () => {
  for (const [g] of LOS_TRECE) {
    const p = path.join(RAIZ, 'tests', `${g}.test.mjs`);
    assert.ok(fs.existsSync(p), `🔴 \`${g}\` ya no existe. Si se renombró, este trinquete está `
      + 'vigilando un fichero que no está y su verde no vale nada.');
    assert.ok(fs.readFileSync(p, 'utf8').length > 500, `🔴 \`${g}\` está casi vacío`);
  }
  assert.equal(LOS_TRECE.length, 13, '🔴 la lista ha cambiado de tamaño sin decir por qué');
});

test('SCRUM-719 · 🔴 los trece conservan su suelo', () => {
  // Se mira el CÓDIGO, no la prosa: el sitio natural donde se escribe «ancla» es el comentario
  // que explica el ancla. Un trinquete de texto que no filtre se cree su propia documentación
  // — la autorreferencia que este repo lleva media docena de tickets pagando (SCRUM-694).
  const sinSuelo = [];
  for (const [g, marca] of LOS_TRECE) {
    const codigo = soloCodigo(fs.readFileSync(path.join(RAIZ, 'tests', `${g}.test.mjs`), 'utf8'), g);
    if (!codigo.includes(marca)) sinSuelo.push(`${g} (falta \`${marca}\`)`);
  }
  assert.deepEqual(sinSuelo, [],
    `🔴 ${sinSuelo.length} de los trece han perdido su suelo:\n    ${sinSuelo.join('\n    ')}\n`
    + '  Sin él vuelven a afirmar una negación sobre un texto que puede estar vacío, y su verde\n'
    + '  deja de significar «no lo encuentro» para significar «no he mirado».\n'
    + '  Comprobación completa, que no depende de esta lista: `npm run censo:mudez`.');
});

// ═══ 🔴 EL ROJO, Y QUE CAE CON EL MECANISMO VIEJO ═════════════════════════════════════════

test('SCRUM-719 · 🔴 EL ROJO: sobre la nada, `ejecutableDe` NO devuelve; se declara ciego', () => {
  assert.throws(() => ejecutableDe('', { ancla: 'loQueSea', donde: 'vacío' }), /ESCÁNER CIEGO/,
    '🔴 sobre la cadena vacía tiene que LANZAR. Devolverla es lo que dejaba pasar a los trece.');

  // 🔴 Y CAE CON EL MECANISMO VIEJO, en una línea: sobre ese mismo texto vacío, la forma que
  // usaban los trece es CIERTA. No es que fallara el filtro — es que la pregunta era otra.
  //
  // ⚠️ Y ESTO SE ESCRIBE COMO AFIRMACIÓN POSITIVA SOBRE LA REGEX, no como `doesNotMatch('')`,
  // porque `scrum237` cazó esa primera versión Y TENÍA RAZÓN: era, literal, una negación sin
  // respaldo — el defecto que este fichero viene a cerrar, cometido en su propia demostración.
  // Lo que se afirma es idéntico; lo que cambia es que ahora se afirma algo, en vez de no
  // encontrar nada. No se ha tocado `scrum237`: se ha arreglado la frase.
  assert.equal(/LO_PROHIBIDO/.test(''), false,
    '📌 la prohibición de los trece, aplicada a la nada, daba «limpio»');
});

test('SCRUM-719 · 🔴 un ancla que NO sobrevive al filtro se declara ciega', () => {
  // El caso real: el fichero existe y tiene texto, pero es todo comentarios — o el recorte se
  // quedó con el trozo equivocado. La negación de después sería cierta por vacía.
  assert.throws(() => ejecutableDe('// listQuotesAdmin vive aquí\n', { ancla: 'listQuotesAdmin' }),
    /ESCÁNER CIEGO/,
    '🔴 el ancla estaba SOLO en un comentario y se ha dado por buena: es la autorreferencia justa');

  // Y sin ancla no se puede llamar: obligar a decir qué debe sobrevivir ES el mecanismo.
  assert.throws(() => ejecutableDe('const a = 1;', {}), /falta `ancla`/);
});

// ═══ ✅ CONTROL NEGATIVO — población pequeña PERO REAL sigue en verde ══════════════════════

test('SCRUM-719 · ✅ CONTROL NEGATIVO: un fuente MINÚSCULO pero real pasa', () => {
  // 🔴 EL RIESGO DE UN SUELO ES ÉSTE: que exija tamaño. Un ancla no lo hace —es binaria— y aquí
  // se comprueba, porque un guard que se pusiera rojo ante un módulo de una línea empujaría a
  // bajarle el listón, y un listón bajado es un guard apagado.
  const minusculo = "export const huellaDeBytes = (b) => b;\n";
  assert.equal(ejecutableDe(minusculo, { ancla: 'huellaDeBytes' }).includes('huellaDeBytes'), true,
    '🔴 un módulo de UNA línea, real y con su ancla, se está declarando ciego');

  // Y con comentarios alrededor: lo que se va es la prosa, no el código.
  const conProsa = `/** explica huellaDeBytes largamente */\n${minusculo}// y una coletilla\n`;
  assert.ok(ejecutableDe(conProsa, { ancla: 'huellaDeBytes' }).includes('huellaDeBytes'));
});

test('SCRUM-719 · ✅ CONTROL NEGATIVO: una ENTRADA vacía no es una SALIDA vaciada', () => {
  // Medido, y por eso está escrito: `src/` tiene SIETE ficheros `.ts` de CERO BYTES
  // (`src/api/routes.ts`, `src/core/http/types.ts`, cinco más). El primer suelo que escribí para
  // `scrum458` los marcaba a los siete y ponía el guard rojo sobre un hecho que no es su defecto.
  //
  // Son dos cosas distintas: un fichero vacío EN DISCO no deja hueca ninguna negación —no hay
  // nada que prohibir en él—; uno VACIADO POR EL FILTRO sí. El suelo compara entrada y salida.
  const vacios = ['src/api/routes.ts', 'src/core/http/types.ts']
    .filter((r) => fs.readFileSync(path.join(RAIZ, r), 'utf8').trim() === '');
  assert.equal(vacios.length, 2,
    '🔴 SUELO DEL CONTROL: esos dos ficheros ya no están vacíos, así que este control no está '
    + 'probando lo que dice. Reelígelos midiendo, no a ojo.');

  assert.deepEqual(ejecutablesDe([{ nombre: 'a.ts', texto: 'const a = 1;' }], { donde: 'control' })
    .map((x) => x.nombre), ['a.ts'], '🔴 un texto real de una línea se está rechazando');

  assert.throws(() => ejecutablesDe([{ nombre: 'b.ts', texto: '// sólo prosa\n' }], { donde: 'control' }),
    /SIN CÓDIGO/, '🔴 un texto que el filtro VACÍA tiene que declararse ciego');

  assert.throws(() => ejecutablesDe([], { donde: 'control' }), /ESCÁNER CIEGO/,
    '🔴 cero elementos no es «ninguno incumple»: es que no se ha mirado');
});

// ═══ 📌 EL CENSO, QUE ES LO QUE NO DEPENDE DE ESTA LISTA ══════════════════════════════════

test('SCRUM-719 · 📌 el censo de mudez NO puede quedarse ciego por su propia lista de nombres', () => {
  // 🔴 ESTO PASÓ DE VERDAD, y por eso es un test y no un comentario. Al migrar los trece, nueve
  // pasaron de importar `soloEjecutable` a importar `ejecutableDe` — y el censo, que buscaba el
  // nombre VIEJO, dejó de verlos: la población cayó de 82 a 73 y el veredicto pasó a «0 mudos»
  // EN PARTE POR NO MIRAR. El mismo defecto que el censo persigue, dentro del censo, causado por
  // su propio arreglo. Lo cazó que los candidatos bajaran exactamente en 9.
  const censo = soloCodigo(fs.readFileSync(path.join(RAIZ, 'scripts', 'censo-mudez.mjs'), 'utf8'), 'c.mjs');
  for (const nombre of ['soloEjecutable', 'ejecutableDe', 'ejecutablesDe', 'leerFuente']) {
    assert.ok(new RegExp(`\\|${nombre}\\||/${nombre}\\||\\|${nombre}/`).test(censo),
      `🔴 el censo no busca \`${nombre}\` en su población. Todo guard que lo use quedaría fuera `
      + 'del recuento, y el censo informaría «0 mudos» sin haberlos mirado.');
  }
  assert.match(censo, /NO APLICA/,
    '🔴 el censo ha perdido la puerta «NO APLICA», que es la que distingue un guard mudo de uno '
    + 'que nunca llamó al filtro. Sin ella vuelve a haber que separarlos a mano.');
});

test('SCRUM-719 · 📌 `leerFuente` sigue siendo el camino corto, y ahora admite ancla', () => {
  // El ancla es OPCIONAL aquí a propósito: por este camino también pasan tests que EXIGEN algo,
  // y a ésos el filtro no puede cegarlos —una afirmación positiva sobre la nada falla sola—.
  // Quien PROHÍBE es quien necesita el suelo, y ahora puede pedirlo sin cambiar de función.
  const propio = path.join(RAIZ, 'tests', '_guard-texto.mjs');
  assert.ok(leerFuente(propio).includes('soloEjecutable'), '🔴 `leerFuente` sin ancla ha dejado de leer');
  assert.ok(leerFuente(propio, { ancla: 'export function soloEjecutable' }).length > 1000);
  assert.throws(() => leerFuente(propio, { ancla: 'NoExisteEsteSimbolo719' }), /ESCÁNER CIEGO/,
    '🔴 `leerFuente` acepta un ancla que no está: entonces no es un suelo');
});
