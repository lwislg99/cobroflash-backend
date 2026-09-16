// tests/scrum846c-trinquete-instrumentos-con-caso.test.mjs — SCRUM-846c (anexo de SCRUM-846)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// NINGÚN INSTRUMENTO DE MEDICIÓN SIN UN CASO CONOCIDO DELANTE.
//
// SCRUM-846 dejó el censo en 0 el 15-sep-2026 (PR #1285). Un cero sin mecanismo se degrada solo: cada
// día entran instrumentos nuevos. Esto es el mecanismo: corre el censo en la tanda y CAE si alguna
// función exportada que produce una medida no recibe nunca una entrada fabricada.
//
//     🔒 «Un cero sin ningún caso conocido delante no se puede juzgar.»
//
// ⚠️ ESTE TEST PUEDE PARAR EL PR DE CUALQUIER CARRIL: «build + tests» es el único check obligatorio de
// `main`. Por eso su mensaje explica el arreglo entero sin que haga falta preguntar a nadie, y por eso
// dice lo que NO ve: un trinquete que calla sus límites se lee como cobertura total.
//
// ── LOS CONTROLES ────────────────────────────────────────────────────────────────────────────
//   ① SUELO .............. el censo reconoce tres casos que se sabe que existen, y su control negativo
//                          sembrado distingue lo fabricado de lo leído. Si no, está CIEGO y ③ no vale.
//   ② 🔴 POR MECANISMO ... sobre un árbol FABRICADO: un instrumento sin caso sale acusado con su fichero
//                          y su función, y el mensaje dice cómo arreglarlo; con su caso, deja de salir.
//   ③ 🔴 EL TRINQUETE .... sobre el árbol de verdad: cero instrumentos sin caso, salvo EXCEPCIONES.
//   ④ LAS EXCEPCIONES .... cada una con su causa, y cada una siguiendo sin caso: una que ya lo tiene sobra.
//
// El censo es el MISMO módulo que se corre a mano (`censoDeInstrumentos`): un trinquete que midiera
// por otro camino no probaría el camino que importa. Coste medido en la tanda y rojo visto con un
// instrumento real inyectado: docs/master/SCRUM-846.md, apéndice de SCRUM-846c.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  censoDeInstrumentos, sueloDelCenso, controlNegativoSembrado, VERBOS, CARPETAS,
} from '../scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs';

const NL = String.fromCharCode(10);
const YO = 'tests/scrum846c-trinquete-instrumentos-con-caso.test.mjs';

/**
 * EXCEPCIONES: instrumentos que NO PUEDEN tener un caso fabricado POR DISEÑO.
 *
 * Clave: el fichero del módulo (`tests/_censo-algo.mjs`). Valor: la causa, en una frase que convenza
 * a quien la lea sin contexto. «No me dio tiempo» no es una causa: es un fallo con otro nombre.
 * Hoy son CERO. Añadir una obliga a cambiar también EXCEPCIONES_DECLARADAS, así que se ve dos veces
 * en el diff del PR.
 */
const EXCEPCIONES = Object.freeze({});
const EXCEPCIONES_DECLARADAS = 0;

/** El 15-sep-2026 el censo veía 99 módulos de medición. Uno que ve muchos menos no ha mirado. */
const SUELO_MODULOS = 80;

const creados = [];
/** Un árbol de mentira en un directorio temporal. Se borran todos al acabar el fichero. */
function arbolDeMentira(ficheros) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum846c-'));
  creados.push(raiz);
  for (const [rel, texto] of Object.entries(ficheros)) {
    const abs = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, texto);
  }
  return raiz;
}
after(() => { for (const r of creados) fs.rmSync(r, { recursive: true, force: true }); });

const VERBOS_LEGIBLES = VERBOS.source.slice(2, -1).split('|').join(', ');

const LIMITES = [
  '  LO QUE ESTE TRINQUETE NO VE — un verde aquí NO es cobertura total:',
  '    · Sólo funciones declaradas `export function` en ' + CARPETAS.map((c) => c + '/*.mjs').join(' y ')
    + ', sin subcarpetas,',
  '      y cuyo nombre empieza por un verbo de medida. `export const f = () => …`, otros nombres y los',
  '      scripts que miden sin exportar nada quedan fuera.',
  "    · Sólo mira el PRIMER argumento de cada llamada: `detector('x.ts', leerDeVerdad())` saldría con caso.",
  '    · La unidad es el MÓDULO: basta un caso en una función hermana que lo llame o a la que llame.',
  '    · El criterio de «fabricado» se calibró a mano sólo donde un criterio laxo y uno estricto',
  '      discrepaban; donde coinciden, pueden equivocarse juntos.',
  '    · Un caso demuestra que el instrumento VE su entrada fabricada, no que su cifra sobre el árbol de',
  '      verdad sea la correcta.',
  '  Medir a mano: node scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs',
];

/** Lo que lee quien rompe el trinquete. Tiene que bastar para arreglarlo sin preguntar a nadie. */
function mensajeDelTrinquete(sin) {
  return [
    '',
    `🔴 HAY ${sin.length} INSTRUMENTO(S) DE MEDICIÓN SIN UN CASO CONOCIDO DELANTE:`,
    '',
    ...sin.map((m) => `      ${m.fichero}  ::  ${m.funciones.join(', ')}`),
    '',
    '  QUÉ SIGNIFICA',
    `    Esa función produce una medida —su nombre empieza por uno de: ${VERBOS_LEGIBLES}— pero ningún`,
    '    fichero de scripts/ ni de tests/ la llama nunca con una entrada FABRICADA. Sólo lee el árbol de',
    '    verdad, así que su cero no distingue «no hay nada» de «el detector está roto».',
    '',
    '  CÓMO SE ARREGLA (no hace falta preguntar a nadie)',
    '    En un test de tests/, llama a la función con una entrada que escribas tú y cuya respuesta sepas,',
    '    en los DOS sentidos:',
    '      · un caso que TIENE que dar SÍ (la entrada lleva dentro lo que el instrumento busca);',
    '      · un caso que TIENE que dar NO (la misma entrada sin eso).',
    '    Por ejemplo, para un censo que recibe una raíz:',
    "      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));",
    "      fs.mkdirSync(path.join(dir, 'src'));",
    "      fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'código CON lo que se busca');",
    '      assert.equal(tuFuncion(dir).length, 1);   // SÍ: lo ve',
    "      fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'código SIN lo que se busca');",
    '      assert.equal(tuFuncion(dir).length, 0);   // NO: no acusa',
    '    Cuenta como entrada fabricada, en el PRIMER argumento: un literal (cadena, array, objeto); un árbol',
    '    temporal (fs.mkdtempSync, o una función del mismo fichero que lo crea); una mutación',
    "    `texto.replace('literal', 'literal')` sobre lo leído; o una variable o un envoltorio que acabe en eso.",
    '    NO cuenta pasarle RAIZ, process.cwd() ni nada leído del árbol de verdad.',
    '    Si la función no admite otra raíz, añádele ese parámetro con la de siempre por defecto.',
    '    Ejemplos vivos, uno por instrumento: tests/scrum846b-siembras-a-los-quince.test.mjs.',
    '    Y rómpela a propósito una vez para ver caer tu caso: uno que no has visto fallar no cuenta.',
    '',
    '  SI DE VERDAD NO PUEDE TENER CASO POR DISEÑO',
    `    Añade el fichero a EXCEPCIONES en ${YO}, con la causa al lado, y sube EXCEPCIONES_DECLARADAS.`,
    '    Una excepción sin causa convierte un fallo en una característica.',
    '',
    ...LIMITES,
  ].join(NL);
}

const CENSO = censoDeInstrumentos();

// ═══ ① SUELO ═════════════════════════════════════════════════════════════════════════════════

test('SCRUM-846c · ① SUELO: el censo ve los casos que se sabe que existen, y su criterio distingue lo fabricado de lo leído', () => {
  assert.ok(CENSO.modulos >= SUELO_MODULOS,
    `🔴 CIEGO: sólo ${CENSO.modulos} módulos de medición censados, y el 15-sep-2026 eran 99. El censo no está `
    + `leyendo ${CARPETAS.join(' ni ')}: su cero del test ③ no significaría nada.`);
  assert.deepEqual(sueloDelCenso(CENSO).filter((s) => s.estado !== 'CON').map((s) => `${s.nombre}: ${s.estado}`), [],
    '🔴 CIEGO: el censo no reconoce casos fabricados que se sabe que existen. Mientras esto no esté verde, '
    + 'un «cero sin caso» del test ③ no significa nada.');
  assert.deepEqual(
    controlNegativoSembrado().filter((c) => !c.ok).map((c) => `${c.texto} (espera ${c.esperado}, dice ${c.dice})`), [],
    '🔴 DESCALIBRADO: el criterio de «entrada fabricada» se ha movido y ya no distingue lo que su control '
    + 'negativo sembrado exige. Se arregla el criterio del censo, no la siembra.');
});

// ═══ ② POR MECANISMO ═════════════════════════════════════════════════════════════════════════

test('SCRUM-846c · 🔴 ② POR MECANISMO: un instrumento sin caso sale acusado con fichero, función y arreglo; con su caso deja de salir', () => {
  const instrumento = [
    "import fs from 'node:fs';",
    'export function censarTrampa(raiz) { return fs.readdirSync(raiz).length; }',
    'export function ayudante(t) { return t; }',
  ].join(NL);

  const sinCaso = censoDeInstrumentos(arbolDeMentira({
    'tests/_censo-trampa.mjs': instrumento,
    'tests/trampa.test.mjs': "import { censarTrampa } from './_censo-trampa.mjs'; censarTrampa(process.cwd());",
  }));
  assert.deepEqual(sinCaso.sin.map((m) => [m.fichero, m.funciones]), [['tests/_censo-trampa.mjs', ['censarTrampa']]],
    '🔴 un instrumento que sólo recibe process.cwd() no sale acusado: el trinquete ③ estaría verde siempre.');

  const texto = mensajeDelTrinquete(sinCaso.sin);
  for (const debe of ['tests/_censo-trampa.mjs', 'censarTrampa', 'TIENE que dar SÍ', 'TIENE que dar NO', 'EXCEPCIONES', 'NO VE']) {
    assert.ok(texto.includes(debe), `🔴 el mensaje del trinquete no dice «${debe}»: quien lo lea no sabrá arreglarlo solo.`);
  }

  const conCaso = censoDeInstrumentos(arbolDeMentira({
    'tests/_censo-trampa.mjs': instrumento,
    'tests/trampa.test.mjs': "import fs from 'node:fs'; import { censarTrampa } from './_censo-trampa.mjs'; censarTrampa(fs.mkdtempSync('trampa-'));",
  }));
  assert.deepEqual(conCaso.sin, [],
    '🔴 con un árbol temporal delante sigue saliendo acusado: el trinquete no se podría arreglar como dice su mensaje.');

  assert.ok(![...CENSO.con, ...CENSO.sin].some((m) => m.fichero === YO),
    '🔴 el censo cuenta como instrumento un `export function` escrito DENTRO de una cadena de este fichero: '
    + 'está contando texto, no declaraciones.');
});

// ═══ ③ EL TRINQUETE ══════════════════════════════════════════════════════════════════════════

test('SCRUM-846c · 🔴 ③ TRINQUETE: ningún instrumento de medición sin un caso conocido delante', () => {
  const sin = CENSO.sin.filter((m) => !Object.hasOwn(EXCEPCIONES, m.fichero));
  assert.deepEqual(sin.map((m) => `${m.fichero} :: ${m.funciones.join(', ')}`), [], mensajeDelTrinquete(sin));
});

// ═══ ④ LAS EXCEPCIONES ═══════════════════════════════════════════════════════════════════════

test('SCRUM-846c · ④ EXCEPCIONES: cada una con su causa y todavía necesaria, y su número declarado cuadra', () => {
  const entradas = Object.entries(EXCEPCIONES);
  assert.equal(entradas.length, EXCEPCIONES_DECLARADAS,
    `🔴 EXCEPCIONES tiene ${entradas.length} y se declararon ${EXCEPCIONES_DECLARADAS}. Añadir una excepción es una `
    + 'decisión: se cambian las dos cosas a la vez, a la vista del PR.');
  for (const [fichero, causa] of entradas) {
    assert.ok(typeof causa === 'string' && causa.trim().length >= 30,
      `🔴 la excepción de ${fichero} no explica su causa. Una excepción sin causa convierte un fallo en una característica.`);
    assert.ok(CENSO.sin.some((m) => m.fichero === fichero),
      `🔴 ${fichero} está en EXCEPCIONES pero ya tiene caso, o ya no existe: sobra. Quítala y baja EXCEPCIONES_DECLARADAS.`);
  }
});
