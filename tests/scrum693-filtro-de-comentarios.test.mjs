// tests/scrum693-filtro-de-comentarios.test.mjs — SCRUM-693
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL FILTRO DE COMENTARIOS, Y LA PREGUNTA QUE DE VERDAD HACE CADA GUARD.
//
// LA VÍCTIMA no es un profesional: es la siguiente sesión. `scrum578` prohíbe la cadena del
// rótulo viejo del teléfono en la vista —bien—, pero su filtro saltaba las líneas `//` y NO los
// bloques `/* */`. Así que DOCUMENTAR por qué se retiró ese texto hacía caer el guard, y eso
// empuja a escribir comentarios vagos —«aquel texto», «el rótulo antiguo»— justo donde hace falta
// precisión para que nadie lo reintroduzca.
//
// 🔴 EL CONTROL QUE DECIDE ESTE TICKET, y va el primero a propósito: **la cadena prohibida EN
// CÓDIGO REAL tiene que seguir tumbando el guard.** Si tras el arreglo ya no salta nunca, se
// habría cambiado un falso positivo por un GUARD MUERTO, que es peor: el falso positivo se ve y
// molesta; el guard muerto da verde para siempre y nadie se entera.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloCodigo, literalesDe, algunLiteralContiene } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** La cadena que `scrum578` prohíbe. Se construye por trozos para no escribirla aquí entera. */
const PROHIBIDA = ['E.164', 'sin', '+'].join(' ');

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · si el filtro no ve nada, «no hay comentarios» y «no supe mirar» dan lo mismo
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-693 · SUELO: el filtro CONSERVA el código y QUITA los comentarios', () => {
  const fuente = [
    '// un comentario de línea',
    'const a = 1;',
    '/* un bloque',
    '   de dos líneas */',
    'const b = 2;',
  ].join('\n');
  const limpio = soloCodigo(fuente);

  assert.ok(limpio.includes('const a = 1;'), '🔴 el filtro se ha comido el código.');
  assert.ok(limpio.includes('const b = 2;'), '🔴 el filtro se ha comido el código de después del bloque.');
  assert.equal(/un comentario de línea/.test(limpio), false, '🔴 no ha quitado el comentario de línea.');
  assert.equal(/un bloque/.test(limpio), false, '🔴 no ha quitado el comentario de bloque.');

  // 🔴 Y NO ENCOGE: los guards que lo usan hacen `slice` por `indexOf` y cuentan líneas. Si el
  // texto se acortara, esos índices apuntarían a otro sitio y el guard mediría un trozo ajeno.
  assert.equal(limpio.length, fuente.length,
    '🔴 el filtro ha CAMBIADO LA LONGITUD: los `slice(indexOf(...))` de sus consumidores dejarían '
    + 'de acotar el bloque que creen.');
  assert.equal(limpio.split('\n').length, fuente.split('\n').length,
    '🔴 el filtro ha cambiado el número de líneas.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL POSITIVO OBLIGATORIO — el que separa un arreglo de un guard muerto
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-693 · 🔴 LA CADENA PROHIBIDA EN CÓDIGO REAL SIGUE VIÉNDOSE', () => {
  // Si esto diera `false`, el arreglo habría apagado el guard en vez de afinarlo.
  const codigo = `const rotulo = "Teléfono (${PROHIBIDA})";`;
  assert.ok(soloCodigo(codigo).includes(PROHIBIDA),
    '🔴 GUARD MUERTO: el filtro se ha llevado por delante la cadena prohibida escrita en CÓDIGO. '
    + 'Un falso positivo molesta; un guard que ya no salta nunca da verde para siempre.');
  assert.ok(algunLiteralContiene(codigo, PROHIBIDA),
    '🔴 el detector por literales tampoco la ve: entonces no vigila nada.');
});

test('SCRUM-693 · ✅ la misma cadena dentro de un `/** */` NO la ve', () => {
  // Es el arreglo: documentar por qué se retiró aquel rótulo deja de hacer saltar el guard.
  const doc = `/**\n * El rótulo viejo («Teléfono (${PROHIBIDA})») pedía un formato que ya no se pide.\n */\nconst rotulo = "Teléfono";`;
  assert.equal(soloCodigo(doc).includes(PROHIBIDA), false,
    '🔴 sigue viendo la cadena dentro de un comentario de BLOQUE: el filtro no está arreglado.');
  assert.equal(algunLiteralContiene(doc, PROHIBIDA), false,
    '🔴 el detector por literales cuenta un texto que vive en un comentario.');
  // Y no se ha llevado el código de al lado.
  assert.ok(soloCodigo(doc).includes('const rotulo = "Teléfono";'), '🔴 se ha comido el código.');
});

test('SCRUM-693 · ✅ y dentro de un `//` tampoco — que ya funcionaba, y no se rompe', () => {
  const linea = `// el rótulo viejo decía «${PROHIBIDA}» y se retiró\nconst rotulo = "Teléfono";`;
  assert.equal(soloCodigo(linea).includes(PROHIBIDA), false, '🔴 ha dejado de quitar los `//`.');
  assert.ok(soloCodigo(linea).includes('const rotulo'), '🔴 se ha comido el código.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LOS DOS CASOS QUE ROMPEN UN REGEX INGENUO, en los dos sentidos
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-693 · 🔴 un `//` DENTRO DE UNA CADENA no convierte el resto en comentario', () => {
  // Un regex que corte en `//` se come media línea de CÓDIGO REAL, y el guard deja de ver lo que
  // vigila sin que nadie lo note. Es el sentido que más daño hace: produce VERDES.
  const codigo = `const u = "http://ejemplo.com/${PROHIBIDA}";\nconst b = 2;`;
  const limpio = soloCodigo(codigo);
  assert.ok(limpio.includes(PROHIBIDA),
    '🔴 el filtro ha tratado el `//` de una URL como si abriera un comentario y se ha comido '
    + 'código de verdad. Un regex ingenuo falla justo aquí.');
  assert.ok(limpio.includes('const b = 2;'), '🔴 se ha comido la línea siguiente.');

  // Y por literales: la URL ES un literal, así que sí cuenta como «texto que existe en el código».
  assert.ok(algunLiteralContiene(codigo, PROHIBIDA),
    '🔴 el detector por literales no ve un texto que está en una cadena de verdad.');
});

test('SCRUM-693 · 🔴 una CADENA dentro de un COMENTARIO no cuenta como código', () => {
  // El sentido contrario: un filtro por líneas que sólo mire `//` conserva esto, y el guard salta
  // por su propia documentación. Es el falso positivo que motiva el ticket.
  const codigo = `/* antes ponía "${PROHIBIDA}" aquí, y se quitó */\nconst a = 1;`;
  assert.equal(soloCodigo(codigo).includes(PROHIBIDA), false,
    '🔴 conserva una cadena que vive DENTRO de un comentario.');
  assert.equal(algunLiteralContiene(codigo, PROHIBIDA), false,
    '🔴 el detector por literales cuenta una cadena que está dentro de un comentario: para el AST '
    + 'ese texto no es un literal, así que si lo ve es que no está mirando el árbol.');
});

test('SCRUM-693 · 🔴 el caso mixto: comentario y código en la MISMA línea', () => {
  // El filtro viejo trataba esto con un segundo `replace` sobre el final de línea, y ahí es donde
  // se juntan los dos errores: hay que quitar el comentario SIN tocar la cadena de al lado.
  const codigo = `const u = "http://x.com"; // el rótulo «${PROHIBIDA}» se retiró`;
  const limpio = soloCodigo(codigo);
  assert.ok(limpio.includes('const u = "http://x.com";'),
    '🔴 se ha llevado por delante el código que había ANTES del comentario.');
  assert.equal(limpio.includes(PROHIBIDA), false,
    '🔴 ha conservado el comentario del final de línea.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PREGUNTA QUE HACE CADA GUARD · «¿se pinta?» no es «¿aparece en el fichero?»
// ═════════════════════════════════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-696 · LAS PLANTILLAS INTERPOLADAS — EL AGUJERO QUE ESTE CORPUS NO TENÍA
//
// Este fichero estaba VERDE sobre un mecanismo roto, y el motivo es exactamente que ni uno de
// sus casos llevaba un `${}` dentro de una plantilla. Sin eso, el scanner nunca llegaba a la
// situación en la que se desincroniza, así que la suite medía un `soloCodigo()` que en el árbol
// real fallaba en 783 de 1.111 ficheros. Un corpus que no contiene la forma que rompe no está
// dando un verde: está diciendo que no la miró.
//
// Los casos van EN LAS DOS DIRECCIONES a propósito. Con sólo la primera, un filtro que blanquee
// el fichero entero pasaría; con sólo la segunda, uno que no blanquee nada.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-696 · 🔴 tras una plantilla INTERPOLADA se siguen quitando los comentarios', () => {
  // Dirección ①: el falso positivo. El scanner leía la comilla invertida de cierre como la
  // APERTURA de otra plantilla y se quedaba dentro de ella hasta el final del fichero, así que
  // todos los comentarios de después sobrevivían y el guard saltaba por su documentación.
  const codigo = 'const t = `hola ${x} adios`;\n// ' + PROHIBIDA + '\nconst b = 2;';
  const limpio = soloCodigo(codigo);

  assert.equal(limpio.includes(PROHIBIDA), false,
    '🔴 el comentario de después de una plantilla interpolada NO se ha quitado: el scanner se '
    + 'quedó dentro de la plantilla. Es el defecto que hacía saltar a los guards por su propio '
    + 'comentario, y el corpus no lo veía porque no tenía ni un `${}`.');
  assert.ok(limpio.includes('const b = 2;'), '🔴 se ha comido el código de después.');
  assert.equal(limpio.length, codigo.length, '🔴 ha cambiado la longitud.');
});

test('SCRUM-696 · 🔴 un `//` DENTRO de una plantilla no se come el código — el daño CARO', () => {
  // Dirección ②: la ceguera. Medido en el árbol el 2-sep-2026: 60 ficheros perdían código real
  // por esto, y siempre con la misma forma —una URL dentro de una plantilla—, que es de lo más
  // corriente que hay: `https://wa.me/${tel}`, `file://${argv[1]}`, `http://127.0.0.1:${PUERTO}`.
  // 🔴 EL `//` VA DESPUÉS DE LA INTERPOLACIÓN, Y NO ES UN DETALLE: puesto antes queda dentro
  // del `TemplateHead` —el token ``https://…${``—, que el scanner lee de una pieza y protege sin
  // querer. Así lo escribí la primera vez, y lo cazó la mutación: el test pasaba igual con el
  // arreglo que sin él. Un test que no puede fallar no es cobertura, es decoración.
  const codigo = 'const u = `${id} ver https://yaqu.app/' + PROHIBIDA + '`;\nconst b = 2;';
  const limpio = soloCodigo(codigo);

  assert.ok(limpio.includes(PROHIBIDA),
    '🔴 el `//` de una URL DENTRO de una plantilla se ha tratado como comentario y se ha comido '
    + 'código real. Éste es el sentido que produce VERDES: el guard deja de vigilar un trozo del '
    + 'fichero y nadie se entera.');
  assert.ok(limpio.includes('const b = 2;'), '🔴 se ha llevado por delante la línea siguiente.');
});

test('SCRUM-696 · 🔴 plantillas ANIDADAS: donde una pila mal hecha se vuelve a desincronizar', () => {
  // No basta con releer el `}` de la interpolación: hay que saber CUÁL cierra qué. Los tres casos
  // que rompen una pila ingenua, y los tres tienen la misma prueba —que el comentario de después
  // desaparezca—, porque desincronizarse significa exactamente dejar de verlo.
  const formas = [
    ['plantilla dentro de plantilla', 'const t = `a ${`b ${c}`} d`;'],
    ['objeto en la interpolación',    'const t = `a ${ {b: 1} } c`;'],
    ['bloque de función dentro',      'const t = `a ${xs.map((x) => { return x; })} b`;'],
  ];
  for (const [que, cabecera] of formas) {
    const codigo = cabecera + '\n// ' + PROHIBIDA + '\nconst b = 2;';
    const limpio = soloCodigo(codigo);
    assert.equal(limpio.includes(PROHIBIDA), false,
      `🔴 con ${que} el filtro se desincroniza y deja pasar el comentario de después.`);
    assert.ok(limpio.includes('const b = 2;'), `🔴 con ${que} se ha comido el código.`);
    assert.equal(limpio.length, codigo.length, `🔴 con ${que} ha cambiado la longitud.`);
  }
});

test('SCRUM-696 · 🔴 una EXPRESIÓN REGULAR tampoco puede comerse la línea', () => {
  // `scan()` no devuelve un regex por su cuenta: ante `/` da una DIVISIÓN, y sin pedirle que
  // relea el token, el cuerpo del regex se tokeniza como código. Basta con que dentro queden
  // dos barras pegadas para que crea que ahí empieza un comentario de línea.
  //
  // 🔴 EL CASO NO ES INVENTADO: es `src/core/validation/schemas.ts:300` letra por letra. Allí
  // el `!/^https?:\\/\\//i` se llevaba por delante el resto de la línea, que es justo donde vive
  // la plantilla que construye la URL. Lo encontró el CENSO DEL ÁRBOL después de arreglar las
  // plantillas, y baja aquí porque un caso mínimo se lee y un censo sólo se cree.
  const codigo = [
  // 🔴 TODO EN UNA LÍNEA, COMO EN EL SITIO REAL. Partirlo en dos hacía el test incapaz de
  // fallar: el defecto se come hasta el FIN DE LÍNEA, así que con la cadena prohibida en la
  // línea de abajo sobrevivía igual con el arreglo que sin él. Lo cazó la mutación, y es la
  // segunda vez en este ticket — el mismo error que en el caso de la plantilla.
    'const f = (v) => (!/^https?:\\/\\//i.test(v) ? `https://x/${v}` : ' + JSON.stringify(PROHIBIDA) + ');',
    'const b = 2;',
  ].join('\n');
  const limpio = soloCodigo(codigo);

  assert.ok(limpio.includes(PROHIBIDA),
    '🔴 el filtro ha leído las dos barras del REGEX como un comentario y se ha comido el resto '
    + 'de la línea. Es la misma ceguera que la de las plantillas, en otro literal.');
  assert.ok(limpio.includes('const b = 2;'), '🔴 se ha comido la línea siguiente.');
  assert.equal(limpio.length, codigo.length, '🔴 ha cambiado la longitud.');
});

test('SCRUM-693 · `literalesDe` distingue lo que se PINTA de lo que sólo se ESCRIBE', () => {
  const codigo = [
    'const rotulo = "Teléfono";',
    'const plantilla = `Hola ${nombre}, tu cliente`;',
    '// esto es un comentario y no se pinta',
    'const n = 42;',
  ].join('\n');
  const textos = literalesDe(codigo);

  // SUELO: si no ve ni un literal, cualquier «no está» de abajo sería «no supe mirar».
  assert.ok(textos.length >= 3, `🔴 ESCÁNER CIEGO: sólo veo ${textos.length} literales.`);
  assert.ok(textos.includes('Teléfono'), '🔴 no ve una cadena normal.');
  assert.ok(textos.some((t) => t.includes('Hola ')), '🔴 no ve el trozo de una plantilla.');
  assert.equal(textos.some((t) => t.includes('esto es un comentario')), false,
    '🔴 cuenta un comentario como literal.');
  // Un número no es un literal de texto: no se pinta como cadena.
  assert.equal(textos.includes('42'), false, '🔴 cuenta un número como literal de texto.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONSUMIDOR REAL · mencionar no es hacer
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-693 · `scrum578` USA el filtro nuevo — que exista no prueba que nadie lo llame', () => {
  const guard = fs.readFileSync(path.join(RAIZ, 'tests/scrum578-formulario-duplicados.test.mjs'), 'utf8');
  assert.match(guard, /from '\.\/_solo-codigo\.mjs'/,
    '🔴 `scrum578` no importa el filtro nuevo: seguiría con el suyo a medias y este ticket no '
    + 'habría arreglado nada donde dolía.');
  assert.match(guard, /soloCodigo\(/,
    '🔴 lo importa y no lo llama.');
  // Y el filtro viejo YA NO ESTÁ: si conviviesen, alguien seguiría usando el roto.
  assert.equal(/\.filter\(\(l\) => !l\.trimStart\(\)\.startsWith\('\/\/'\)\)/.test(guard), false,
    '🔴 el filtro por líneas sigue en `scrum578`: dos filtros para lo mismo, y uno está roto.');
});

test('SCRUM-693 · 🔴 CONTROL NEGATIVO: la prohibición NO se ha relajado', () => {
  // El ticket afina el instrumento; no levanta el veto. Si la cadena volviera al código de la
  // vista, `scrum578` tiene que seguir cayendo — y aquí se comprueba sobre el fichero REAL.
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/customersView.js'), 'utf8');
  assert.equal(algunLiteralContiene(vista, PROHIBIDA), false,
    '🔴 la cadena prohibida ha vuelto a un literal de la vista.');

  // Y el veto sigue escrito en el guard, no se ha borrado de paso.
  const guard = fs.readFileSync(path.join(RAIZ, 'tests/scrum578-formulario-duplicados.test.mjs'), 'utf8');
  assert.match(guard, /E\.164/,
    '🔴 la prohibición ha desaparecido de `scrum578`: afinar el filtro no es levantar el veto.');
});
