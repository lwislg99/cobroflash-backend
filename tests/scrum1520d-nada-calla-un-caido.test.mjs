// tests/scrum1520d-nada-calla-un-caido.test.mjs — SCRUM-1520d · 🔴 un caso que CAE no puede salir en verde
//
// SCRUM-1520 preguntó si un obligatorio en VERDE puede esconder un test que cae. Por la cola perdida
// del informe, NO (SCRUM-1520 ②: el código de salida del hijo lo sostiene; y desde el 14-oct la
// tubería es bloqueante, SCRUM-1405c). Pero hay dos formas que SÍ: medidas con la cadena de hoy en
// `docs/master/evidencias/SCRUM-1520/d-tres-siembras.mjs` (salida 0 con un caso que cae):
//   · el proceso del fichero se va con `process.exit(0)` a mitad: lo de detrás no corre;
//   · el caso está marcado `todo` (`{ todo }`, `test.todo(…)`, `t.todo()`): si cae, sale como TODO.
// El 14-oct el árbol las usa CERO veces en el proceso de un test (censo por AST:
// `docs/master/evidencias/SCRUM-1520/d-la-ruta-que-calla.mjs`). Este guard hace que siga siendo cero.
//
// Población: todos los `tests/*.test.mjs` (los que corre la tanda), sus ayudantes de `tests/` y lo
// que importan fuera de `tests/` por rutas relativas. Qué NO cubre, en `puedeCallar()` del ayudante.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CERO, SIEMBRA, censar, censoDelArbol, deLaTanda, puedeCallar } from './_la-ruta-que-calla.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let censo;
before(() => { censo = censoDelArbol(RAIZ); });

test('SCRUM-1520d · el censo VE cada forma sembrada, y no ve una cadena, una plantilla, un comentario, un exit(1) ni un método propio que se llama todo', () => {
  assert.ok(SIEMBRA.length >= 9, `🔴 la siembra se ha quedado en ${SIEMBRA.length}: sin positivos, un cero no dice nada`);
  for (const [forma, src] of SIEMBRA) {
    const h = censar('siembra.mjs', src);
    assert.deepEqual(h.map((x) => x.forma), [forma], `🔴 el censo no ve «${forma}» en: ${src}`);
  }
  assert.ok(CERO.length >= 5);
  for (const src of CERO) assert.deepEqual(censar('cero.mjs', src).map((x) => x.forma), [], `🔴 el censo ve lo que no es una llamada: ${src}`);
});

test('SCRUM-1520d · la población es la de la tanda: todos los tests/*.test.mjs, y lo que importan fuera de tests/', () => {
  // Contados por otra vía (readdir plano) que el recorrido del censo.
  const deLaCarpeta = readdirSync(join(RAIZ, 'tests')).filter((n) => n.endsWith('.test.mjs')).length;
  const enElCenso = censo.todos.filter(deLaTanda).length;
  assert.ok(deLaCarpeta > 0, '🔴 no hay ningún tests/*.test.mjs: el censo no ha mirado nada');
  assert.equal(enElCenso, deLaCarpeta, `🔴 el censo mira ${enElCenso} ficheros de la tanda y la carpeta tiene ${deLaCarpeta}`);
  assert.ok(censo.fuera.length > 0, '🔴 no ha seguido ningún import fuera de tests/: scripts/ queda sin mirar');
  // Que sepa distinguir lo que corre al lanzar de lo que corre al importar: el árbol tiene de los dos.
  const donde = new Set(censo.hallazgos.map((h) => h.donde.split(' (')[0].split(' · ')[0]));
  assert.ok([...donde].some((d) => d.startsWith('en el bloque de programa')), '🔴 no encuentra NINGÚN bloque de programa: el reconocedor se ha roto');
  assert.ok(censo.hallazgos.some((h) => h.donde.endsWith('EXPORTADA')), '🔴 no encuentra NINGUNA función exportada con exit: el reconocedor se ha roto');
});

test('SCRUM-1520d · 🔴 NINGÚN caso que cae puede salir en verde: ni process.exit(0) ni todo en el proceso de un test de la tanda', () => {
  const callan = censo.hallazgos.filter((h) => puedeCallar(h, censo.importadores));
  assert.deepEqual(callan.map((h) => `${h.fichero}:${h.linea} · ${h.forma} · ${h.donde}`), [],
    '🔴 Esto deja que un caso que CAE salga en VERDE en el obligatorio (medido: '
    + 'docs/master/evidencias/SCRUM-1520/d-tres-siembras.mjs):\n'
    + '   · process.exit(0) o exit() en el proceso del test: los casos de detrás NO CORREN y la tanda sale 0;\n'
    + '   · todo (opción, test.todo o t.todo()): si el caso cae, se informa como TODO y la tanda sale 0.\n'
    + 'Si un caso todavía no puede pasar, que se SALTE con su motivo (`skip: \'por qué\'`): un salto se '
    + 'cuenta y se declara (SCRUM-419); un todo que cae no lo ve nadie. Si el exit es de un guion, que vaya '
    + 'en su bloque de programa (`if (esPrincipal) { … }`), que no corre al importarlo.');
});
