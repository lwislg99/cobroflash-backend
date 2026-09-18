// tests/scrum938-la-lista-como-fixture.test.mjs — SCRUM-938
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA RED DEL CENSO: que siga VIENDO lo que promete ver.
//
// El censo entero (`npm run censo:lista-fixture --decidir`) corre una copia por candidato y
// cuesta minutos, así que vive fuera de `npm test`. Esto comprueba en segundos que el aparato
// que lo mira sigue viendo, con el mismo camino y sin barrer el árbol.
//
// ⛔ Lo que este fichero NO hace: censar. Su verde no dice que no haya tests atados a una lista
// real — eso sólo lo dice la pasada completa. Dice que el detector distingue.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import {
  clasificar, elementosDeLaLista, importaDe, usoDeLaLista,
} from '../scripts/censo-lista-como-fixture.mjs';

// 🔴 MUTACIONES_QUE_ME_TUMBAN · SCRUM-745.
//
// ⚠️ ESTAS DOS NACIERON CADUCADAS, Y ES EL MISMO ERROR QUE ARREGLÉ ESTA MAÑANA EN SCRUM-813.
//
// Las declaré citando el texto que el censo tenía **mientras lo estaba escribiendo**, y después
// cambié las dos líneas: el emparejamiento pasó de `txt.includes(...)` a `importaDe(...)` y el
// umbral de `>= 3` a `>= MINIMO_ELEMENTO`. Las mutaciones quedaron apuntando a texto inexistente,
// o sea MUDAS — `meta:mutaciones` no podía aplicarlas y nadie comprobaba estos dos ejes. Lo cazó
// `scrum836` en la tanda, no yo, **teniendo el verificador de anclas escrito desde esta mañana y
// sin haberlo pasado por mi propio fichero nuevo**.
//
//     🔒 Una mutación se declara CUANDO el código ya está quieto, no mientras se escribe.
//
// Reancladas al texto de hoy, y comprobadas con el mismo lector por AST antes de commitear.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/censo-lista-como-fixture.mjs',
    // 🔴 ANCLADA AL VEREDICTO DE `importaDe`, NO A SU LLAMADA — y el porqué es el aprendizaje.
    //
    // Primero la anclé a `if (importaDe(txt, modulo, l.nombre)) consumidores.add(t);`, dentro de
    // `censar()`. **Salió MUDA**: exit 0, cero casos caídos. El caso ④ prueba `importaDe` SUELTA,
    // y la mutación tocaba su llamada en un camino que ese caso no ejercita — probé la unidad
    // creyendo probar la integración, que es la familia de fallo de mi propia ficha.
    //
    // Se ancla a lo que el caso SÍ mide: el veredicto de la función. `return true` hace que
    // cualquier fichero cuente como consumidor, que es exactamente el defecto de acusar por
    // mención. ⚠️ Queda declarado que NADIE vigila hoy la llamada dentro de `censar()`: haría
    // falta un caso que ejercite el emparejamiento sobre un árbol de prueba, y eso es otra tanda.
    //
    //     🔒 Una mutación que no tumba nada no prueba que el guard sea débil: prueba que el caso
    //        y la mutación miran puertas distintas.
    de: '  return hay;',
    a: '  return true;',
    cae: 'el consumidor se resuelve por IMPORT, no por mencionar el nombre',
  },
  {
    fichero: 'scripts/censo-lista-como-fixture.mjs',
    de: '    if (t.length >= MINIMO_ELEMENTO && t.length < TOPE_ELEMENTO) out.add(n.text);',
    a: '    if (t.length >= MINIMO_ELEMENTO) out.add(n.text);',
    cae: 'un MOTIVO en prosa no es un elemento de la lista',
  },
];

const M = 'scripts/_trinquete-de-zona.mjs';
const T = 'tests/scrum813-trinquete-de-zona.test.mjs';
const deGit = (sha, ruta) =>
  execFileSync('git', ['show', `${sha}:${ruta}`], { encoding: 'utf8', maxBuffer: 1 << 24 });

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-938 · SUELO: el lector encuentra la lista y extrae sus elementos', () => {
  const { encontrada, elementos } = elementosDeLaLista(
    "export const L = Object.freeze([Object.freeze({ ruta: 'scrum659/', porque: 'x' })]);", 'L');
  assert.equal(encontrada, true, '🔴 CIEGO: no encuentra una lista que está delante.');
  assert.ok(elementos.includes('scrum659/'), '🔴 CIEGO: no extrae los elementos, así que la forma ③ no puede verse.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 EL CONTROL POSITIVO — mis seis casos de SCRUM-813, Y POR EL EJE CORRECTO
//
// Se leen de git (`2b317011`, antes del arreglo) porque hoy ya están arreglados en `main`: un
// control positivo sobre el código de hoy saldría limpio y no probaría nada.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-938 · 🔴 ② el defecto de SCRUM-813 se caza, y POR EL FLUJO no por la mención', () => {
  const modulo = deGit('2b317011', M);
  const testViejo = deGit('2b317011', T);

  const { encontrada, elementos } = elementosDeLaLista(modulo, 'ESCRITURAS_DE_LA_TANDA');
  assert.equal(encontrada, true, '🔴 CIEGO: no se lee la lista de la versión vieja.');
  assert.ok(elementos.includes('scrum659/'),
    '🔴 CIEGO: `scrum659/` era el único elemento; sin él no hay nada que cazar.');

  const uso = usoDeLaLista(testViejo, 'ESCRITURAS_DE_LA_TANDA', elementos);
  assert.notEqual(clasificar(uso), 'LIMPIO',
    '🔴 EL CENSO NO VE EL DEFECTO QUE LO ORIGINÓ. Seis casos de SCRUM-813 usaban `scrum659/` '
    + 'como fixture y cayeron de golpe al retirar la excepción.');

  // 🔴 Y POR EL EJE CORRECTO: la prueba nombra el LITERAL que sale de la lista, no el fichero.
  assert.ok(uso.formas.some((f) => f.startsWith('③')),
    '🔴 lo caza, pero no por el flujo. El eje tiene que ser «este literal es un elemento de la '
    + 'lista», no «este fichero menciona una lista».');
  assert.ok(uso.pruebas.some((p) => p.includes('"scrum659/"')),
    `🔴 la prueba no nombra el literal copiado. Sin el «cuál», nadie puede accionarlo: ${JSON.stringify(uso.pruebas)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ ✅ EL CONTROL NEGATIVO — un trinquete de clase (c) sale LIMPIO
//
// Es el que tenía que salir verde. Si el censo acusa a los trinquetes de contenido, marcará
// media casa y se desactivará en una semana — que es la otra forma de no tener censo.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-938 · ✅ ③ un trinquete que mide el contenido A PROPÓSITO sale LIMPIO', () => {
  const trinquete = `
    import { LISTA } from '../scripts/x.mjs';
    test('la lista es EXACTAMENTE ésta', () => {
      assert.deepEqual(LISTA.map((e) => e.ruta), ['a/', 'b/']);
      for (const e of LISTA) assert.ok(e.porque);
    });`;
  const uso = usoDeLaLista(trinquete, 'LISTA', ['a/', 'b/']);

  // ⚠️ Se exige LIMPIO, no una etiqueta concreta — y la primera versión de este caso pedía
  // literalmente `'LIMPIO (c · trinquete de contenido)'`, o sea que fallaba mientras el censo
  // acertaba: un trinquete puro no produce ninguna «forma», así que sale LIMPIO a secas y nunca
  // llega a la rama que pone la etiqueta (c). Lo que decide es **que no se acuse**; la etiqueta
  // sólo sirve para explicar por qué, cuando además hay algún uso.
  assert.ok(clasificar(uso).startsWith('LIMPIO'),
    '🔴 ACUSA A UN TRINQUETE DE CONTENIDO. Un test que declara que mide la lista NO es este '
    + `defecto, y acusarlo marca todos los trinquetes de la casa: ${clasificar(uso)}`);
  assert.ok(uso.assertsSobreLaLista > 0,
    '🔴 y no lo ve como lo que es: si no cuenta los asserts SOBRE la lista, no puede distinguir '
    + 'un trinquete de un fixture — los dos se le parecerían.');
});

test('SCRUM-938 · ✅ ③bis un fixture FABRICADO no se denuncia, aunque el fichero cite la lista', () => {
  // El caso arreglado: la lista real está a cero y el fixture es sintético. No puede salir.
  const arreglado = `
    import { LISTA } from '../scripts/x.mjs';
    const PROPIA = [{ ruta: 'fixture-de-prueba/' }];
    test('el amparo funciona', () => { assert.equal(f(m(['fixture-de-prueba/']), PROPIA).length, 0); });`;
  const uso = usoDeLaLista(arreglado, 'LISTA', ['a/', 'b/']);
  assert.equal(clasificar(uso), 'LIMPIO',
    '🔴 denuncia un fixture fabricado: entonces castiga precisamente el arreglo que este ticket propone.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ EL EJE, AISLADO — mencionar no es consumir
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-938 · 🔴 ④ el consumidor se resuelve por IMPORT, no por mencionar el nombre', () => {
  // Medido el 17-sep-2026: la primera versión emparejaba por mención y acusaba a 118 de 833,
  // cruzando listas de un guard con tests de otro porque `EXCEPCIONES` es un nombre genérico.
  const menciona = `
    // este comentario habla de EXCEPCIONES del guard de otro fichero
    const s = 'EXCEPCIONES';`;
  assert.equal(importaDe(menciona, 'otro-modulo', 'EXCEPCIONES'), false,
    '🔴 cuenta como consumidor un fichero que sólo MENCIONA el nombre. Un nombre repetido no es '
    + 'una referencia, y así se acusa al 14 % de la casa.');

  const importa = "import { EXCEPCIONES } from '../scripts/otro-modulo.mjs';";
  assert.equal(importaDe(importa, 'otro-modulo', 'EXCEPCIONES'), true,
    '🔴 NO ve un import de verdad: el censo se quedaría ciego sobre los consumidores reales.');

  // Y el import dinámico con desestructuración, que es como esta casa carga `dist/`.
  const dinamico = "const { EXCEPCIONES } = await import(DIST + 'otro-modulo.js');";
  assert.equal(importaDe(dinamico, 'otro-modulo', 'EXCEPCIONES'), true,
    '🔴 no ve el import dinámico: se perdería la mitad de los consumidores de esta casa.');
});

test('SCRUM-938 · 🔴 ④bis un MOTIVO en prosa no es un elemento de la lista', () => {
  // Sin este corte, la prosa de `porque:` entra como «elemento» y cualquier test que cite la
  // misma frase sale acusado por la forma ③ — acusar por el texto, que es el error perseguido.
  const conMotivo = `export const L = [{ ruta: 'a/', porque: `
    + `'fixture de PDF. El finally borra el FICHERO de dentro, no el DIRECTORIO, asi que este persiste.' }];`;
  const { elementos } = elementosDeLaLista(conMotivo, 'L');
  assert.ok(elementos.includes('a/'), '🔴 CIEGO: no extrae el elemento legítimo.');
  assert.ok(!elementos.some((e) => e.length >= 60),
    `🔴 la prosa del motivo entró como elemento: ${JSON.stringify(elementos.filter((e) => e.length >= 60))}`);
});
