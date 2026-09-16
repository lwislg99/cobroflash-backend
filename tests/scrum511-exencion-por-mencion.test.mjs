// tests/scrum511-exencion-por-mencion.test.mjs — SCRUM-511
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ¿CUÁNTOS OTROS GUARDS EXIMEN POR MENCIONAR LA SEÑAL EN VEZ DE POR USARLA?
//
// SCRUM-510 midió que la exención de SCRUM-409 libraba ficheros por MENCIONAR la señal, aunque la
// mención viviera en un comentario. Tres ficheros tenían la exención **gracias al comentario que
// advertía del defecto**.
//
//   >>> Explicar un riesgo puede comprarte la exención de vigilarlo. <<<
//
// ⛔ ESTE FICHERO NO ARREGLA NINGÚN GUARD. Mide y reporta: endurecer produce rojos en ficheros
// ajenos y eso va uno a uno, con su clasificación (regla 9 y el propio ticket).
//
// ⚠️ SCRUM-349 vive aquí dentro: esta cabecera contiene las palabras que el censo persigue. Por
// eso el instrumento A clasifica por AST, que no ve comentarios por construcción.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { censar, porAst, porTexto, mecanismoDelFichero, CLASES } from '../scripts/_exenciones-de-guards.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(import.meta.url)('typescript');

// ═══ ① EL CONTROL QUE DECIDE · los DOS criterios, sobre el caso real ════════════════════════
//
// `scrum409` conserva los dos a propósito: `loMenciona` (el VIEJO, por texto) y `pruebaElDemo`
// (el NUEVO, por AST). Aquí se reproducen mínimamente —importar aquel fichero ejecutaría sus
// tests— y se les da el MISMO fichero: uno que no usa el demo, con la señal sólo en un comentario.

const SENALES = ['isDemoMerchant', 'DEMO_MERCHANT_ID', 'DEMO_SAFE_NUMBERS', 'demoMerchant'];

/** El criterio VIEJO: basta que el nombre aparezca en el texto, comentarios incluidos. */
const criterioViejo = (texto) => SENALES.some((s) => texto.includes(s));

/** El criterio NUEVO: el nombre tiene que aparecer como IDENTIFICADOR en el árbol sintáctico. */
function criterioNuevo(texto, nombre = 'x.mjs') {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let usa = false;
  (function rec(n) {
    if (usa) return;
    if (ts.isIdentifier(n) && SENALES.includes(n.text)) { usa = true; return; }
    ts.forEachChild(n, rec);
  }(sf));
  return usa;
}

test('SCRUM-511 · 🔴 EL QUE DECIDE: la señal escrita en un COMENTARIO compraba la exención', () => {
  // El fichero NO usa el demo. Sólo lo NOMBRA, y encima para advertir del riesgo — que es
  // exactamente lo que hacían los tres ficheros de SCRUM-510.
  const soloMencion = [
    '// OJO: este fixture NO pasa por isDemoMerchant, así que el merchant va explícito.',
    'const merchantId = 77;',
    'export const fixture = { merchantId };',
  ].join('\n');

  assert.equal(criterioViejo(soloMencion), true,
    '🔴 la premisa de SCRUM-510 ha dejado de ser cierta: el criterio VIEJO ya no eximiría por '
    + 'mención. Si el hueco se cerró por otra vía, este control mide otra cosa y hay que rehacerlo.');
  assert.equal(criterioNuevo(soloMencion), false,
    '🔴 EL CRITERIO NUEVO SIGUE COMPRANDO LA EXENCIÓN CON UN COMENTARIO.\n\n'
    + '  Es el defecto entero: el fichero que más razones tiene para nombrar la señal —porque\n'
    + '  documenta el riesgo— es el que se queda sin vigilar.');
});

test('SCRUM-511 · ✅ POSITIVO: el USO legítimo SIGUE eximiendo, con los dos criterios', () => {
  // 🔴 Sin esto, «el nuevo no exime por comentario» y «el nuevo no exime nunca» dan el mismo
  // resultado — y lo segundo sería haber roto la exención en vez de haberla afinado.
  const usoReal = [
    "import { isDemoMerchant } from '../src/core/demo.js';",
    'export const fixture = { merchantId: isDemoMerchant(1) ? 1 : 77 };',
  ].join('\n');
  assert.equal(criterioNuevo(usoReal), true,
    '🔴 un fichero que USA de verdad la señal ha dejado de quedar exento. El arreglo estaría '
    + 'marcando código correcto, y lo relajarían con razón.');
  assert.equal(criterioViejo(usoReal), true, '🔴 y el viejo tampoco lo ve: el banco no vale.');
});

test('SCRUM-511 · 🔴 MUTACIÓN: devolver la exención por mención reproduce el hueco', () => {
  // La mutación es sustituir el criterio nuevo por el viejo. Se comprueba que ENTRA —que los dos
  // dan resultados DISTINTOS sobre el mismo fichero—, porque una mutación que no cambia nada y
  // una cobertura que no existe dan exactamente la misma salida.
  const soloMencion = '// nada que ver con DEMO_MERCHANT_ID\nexport const x = 1;\n';
  const conMutacion = criterioViejo;          // ← el hueco, reabierto a propósito
  const sinMutacion = criterioNuevo;

  assert.notEqual(conMutacion(soloMencion), sinMutacion(soloMencion),
    '🔴 LA MUTACIÓN NO ENTRA: los dos criterios dan lo mismo sobre el fichero de prueba, así que '
    + 'este control no está midiendo la diferencia entre ellos.');
  assert.equal(conMutacion(soloMencion), true, '🔴 con la mutación el hueco no reaparece.');
  assert.equal(sinMutacion(soloMencion), false, '🔴 sin la mutación el hueco sigue abierto.');
});

// ═══ ② EL CENSO · autoprueba, suelo y las categorías que suman ═══════════════════════════════

test('SCRUM-511 · AUTOPRUEBA: distingue una exención por AST de una por `includes`', () => {
  const porUso = 'function exentoPorUso(texto, n) { const sf = ts.createSourceFile(n, texto); return forEachChild(sf); }';
  const porMencion = 'function exentoPorTexto(texto) { return texto.includes("SEÑAL"); }';
  assert.equal(porAst(porUso)[0].clase, CLASES.USO, '🔴 no reconoce una exención que mira el AST.');
  assert.equal(porAst(porMencion)[0].clase, CLASES.MENCION,
    '🔴 no reconoce una exención que decide por subcadena sobre el texto.');

  // Y el instrumento de TEXTO, que es el ingenuo, ve la línea en los dos casos: por eso no vale
  // solo, y por eso está — para discrepar.
  assert.equal(porTexto(porMencion).length, 1, '🔴 el instrumento de texto no ve ni el caso obvio.');
});

test('SCRUM-511 · 🔴 SUELO: el censo VE el mecanismo de SCRUM-409, el control positivo del ticket', () => {
  const c = censar(RAIZ);
  assert.ok(c.ficheros > 100,
    `🔴 la población es de ${c.ficheros} ficheros: el censo no está recorriendo el árbol.`);

  const s409 = c.porMecanismo.find((m) => m.fichero.includes('scrum409-fixtures'));
  assert.ok(s409, '🔴 CIEGO: el censo no ve el fichero de SCRUM-409, que es su control positivo.');
  assert.equal(s409.lee, true, '🔴 no detecta que SCRUM-409 lee ficheros del árbol.');
  assert.equal(s409.miraElCodigo, true,
    '🔴 no detecta que SCRUM-409 tokeniza. Está CORREGIDO desde SCRUM-510: si el censo lo diera '
    + 'hoy por «decide sobre texto crudo», estaría acusando a un guard ya arreglado.');
  assert.equal(s409.porMencion, false,
    '🔴 el censo acusa a SCRUM-409, que es justo el que ya se arregló. Control positivo fallido.');
});

test('SCRUM-511 · 🔴 las categorías SUMAN el total, y el cero se sabe leer', () => {
  const c = censar(RAIZ);
  assert.equal(c.uso.length + c.lista.length + c.mencion.length + c.indeterminado.length,
    c.declaraciones.length,
    '🔴 las cuatro clases no suman las declaraciones halladas: el censo pierde entradas.');
  assert.ok(c.declaraciones.length > 0,
    '🔴 CIEGO: cero declaraciones de exención en todo el árbol. Vacío y no-medido se leen igual.');
});

// ═══ ③ 🔴 EL LÍMITE DEL INSTRUMENTO, MEDIDO Y ATADO ══════════════════════════════════════════

test('SCRUM-511 · 🔴 el criterio por NOMBRE es CIEGO, y se demuestra con el control positivo', () => {
  // ÉSTE es el hallazgo que decide cómo se lee el censo. El instrumento A busca declaraciones
  // cuyo NOMBRE delate exención (`exento`, `excluido`, `permitido`…). En SCRUM-409 —el caso que
  // ORIGINA el ticket— el mecanismo se llama `usaElMecanismoDelDemo`, `pruebaElDemo` y
  // `loMenciona`: ninguno contiene esas palabras.
  //
  //   >>> Un censo que sólo ve lo que está bien nombrado mide la nomenclatura, no el código. <<<
  //
  // Por eso el veredicto NO sale del reparto por nombre, y por eso su `MENCION: 0` no puede
  // leerse como «no hay exenciones por mención». Esto queda ATADO: si alguien hace que el
  // criterio por nombre empiece a ver 409, este test cae y le obliga a releer la conclusión.
  const fuente409 = createRequire(import.meta.url)('node:fs')
    .readFileSync(path.join(RAIZ, 'tests', 'scrum409-fixtures-sin-merchant-demo.test.mjs'), 'utf8');

  assert.deepEqual(porAst(fuente409, 'scrum409.test.mjs'), [],
    '🔴 el criterio por NOMBRE ya SÍ ve el mecanismo de SCRUM-409.\n\n'
    + '  Buena noticia, y hay que releer el censo: hasta hoy su cero significaba «cero entre los\n'
    + '  que se llaman así», no «cero en el árbol». Si esto ha cambiado, el reparto por nombre\n'
    + '  pasa a ser un veredicto y deja de necesitar el cruce con el mecanismo.');

  // Y el mecanismo sí lo ve, que es lo que hace útil al instrumento B.
  assert.equal(mecanismoDelFichero(fuente409).lee, true,
    '🔴 tampoco el instrumento por MECANISMO ve SCRUM-409: entonces el censo está ciego entero.');
});
