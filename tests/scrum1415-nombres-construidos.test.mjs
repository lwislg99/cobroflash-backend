// tests/scrum1415-nombres-construidos.test.mjs — SCRUM-1415
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL PUNTO CIEGO DE LA SEÑAL POR NOMBRES, CON SU TAMAÑO Y SIN PODER CRECER.
//
// La señal de SCRUM-1339d (`scripts/_senal-de-nombres.mjs`) compara los nombres LITERALES que el
// árbol declara contra los que la tanda registró. Una llamada `test(…)` cuyo nombre se construye
// (una plantilla con sustituciones dentro de un bucle, una concatenación) no tiene literal que
// buscar: si la tanda la pierde, no lo ve nadie. Medido en `exp-1384`: de 55 casos perdidos la
// señal nombró 39, y los otros 16 eran de éstos.
//
// Este guard NO detecta pérdidas (eso es de 1339d). Hace dos cosas con el punto ciego:
//   · lo CUENTA, con el mismo criterio que la señal (`llamadasDeclaradas`, por AST), fichero a
//     fichero, y lo imprime con su población;
//   · lo sujeta con un TRINQUETE de dos mitades contra la lista `DECLARADAS`:
//       ① una llamada de nombre construido que NO está en la lista → ROJO. Un test nuevo se
//          escribe con nombre literal; si sale de una tabla, con `tests/_casos-escritos.mjs`.
//       ② un fichero con MENOS de las que la lista dice → ROJO, pidiendo bajar la cifra. Una
//          bajada que nadie ha apuntado es o un arreglo sin registrar o un censo que ha dejado
//          de ver: las dos cosas se miran, y la lista sólo BAJA a mano.
//
// LO QUE ESTE GUARD NO VE: cuenta SITIOS de llamada, no casos. Una llamada dentro de un bucle
// registra un caso por fila, y cuántas filas hay no se mira aquí.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { llamadasDeclaradas } from '../scripts/_senal-de-nombres.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/**
 * Los 56 ficheros de `DECLARADAS` tienen el MISMO motivo, medido por AST el 2-oct-2026: el bucle
 * que envuelve a cada llamada itera una tabla escrita en el propio fichero. Son convertibles
 * (con `casosEscritos`) y están pendientes: SCRUM-1416.
 */
const PENDIENTE = 'bucle sobre una tabla escrita en el fichero · convertible, pendiente (SCRUM-1416)';

/**
 * `[fichero, llamadas de nombre construido, motivo]`. Una entrada por línea.
 *
 * SÓLO BAJA. Al convertir un fichero se baja su cifra (o se quita la línea) en el mismo PR.
 * Una entrada cuyo nombre dependa de un dato que sólo existe al ejecutar NO lleva `PENDIENTE`:
 * lleva escrito por qué no se puede convertir. Hoy no hay ninguna.
 */
const DECLARADAS = [
  ['scrum1027-atajo-flag-off-sin-documento.test.mjs', 3, PENDIENTE],
  ['scrum1038-leer-el-ticket-gasto.test.mjs', 1, PENDIENTE],
  ['scrum1093h-censo-fecha-sin-zona.test.mjs', 2, PENDIENTE],
  ['scrum1106-respuestas-ia-no-son-del-asesor.test.mjs', 2, PENDIENTE],
  ['scrum1108b-pantalla-garantia.test.mjs', 1, PENDIENTE],
  ['scrum1117-anclas-por-bloque.test.mjs', 1, PENDIENTE],
  ['scrum1153-censo-entorno-prestado.test.mjs', 2, PENDIENTE],
  ['scrum1160-cobrar-ahora-modo-recibo.test.mjs', 4, PENDIENTE],
  ['scrum1164-ocultar-en-receipt-ficha-trabajo.test.mjs', 1, PENDIENTE],
  ['scrum1164-ocultar-en-receipt-inicio-planes.test.mjs', 1, PENDIENTE],
  ['scrum1166-detalle-quote-tiene-numero.test.mjs', 1, PENDIENTE],
  ['scrum1167-irreversible-gana-la-cascada.test.mjs', 1, PENDIENTE],
  ['scrum1168-anio-serie-zona-merchant.test.mjs', 3, PENDIENTE],
  ['scrum1169-linea-tiempo-modo-recibo.test.mjs', 2, PENDIENTE],
  ['scrum1170-seccion-facturas-modo-recibo.test.mjs', 2, PENDIENTE],
  ['scrum1188-plantilla-guarda-el-cobro.test.mjs', 1, PENDIENTE],
  ['scrum1193-mas-acciones-44.test.mjs', 1, PENDIENTE],
  ['scrum1200-sin-respuesta.test.mjs', 2, PENDIENTE],
  ['scrum1213-quoteadmin-tenencia-fail-closed.test.mjs', 2, PENDIENTE],
  ['scrum1216b-pantalla-arranque.test.mjs', 1, PENDIENTE],
  ['scrum1226-firma-no-baja-el-estado.test.mjs', 1, PENDIENTE],
  ['scrum1235-el-correo-que-no-salio.test.mjs', 1, PENDIENTE],
  ['scrum1292-cobro-pagado-no-retrocede.test.mjs', 2, PENDIENTE],
  ['scrum1293-cargador-de-marcadores.test.mjs', 1, PENDIENTE],
  ['scrum1301-bizum-hoy-de-madrugada.test.mjs', 1, PENDIENTE],
  ['scrum1302a-marca-en-la-vista-de-oficina.test.mjs', 1, PENDIENTE],
  ['scrum1302f-envio-sin-telefono.test.mjs', 1, PENDIENTE],
  ['scrum1315-gemelos-estado-dentro-del-where.test.mjs', 5, PENDIENTE],
  ['scrum1323-resumen-vs-detalle-sif1.test.mjs', 1, PENDIENTE],
  ['scrum1344-arnes-de-prueba-con-rol.test.mjs', 1, PENDIENTE],
  ['scrum1354-dueno-de-la-marca.test.mjs', 2, PENDIENTE],
  ['scrum1360-caja-albaran-firma-de-parte.test.mjs', 1, PENDIENTE],
  ['scrum1362-cargador-de-defectos-del-viaje.test.mjs', 1, PENDIENTE],
  ['scrum1388-facturas-recibidas-literales-firmados.test.mjs', 1, PENDIENTE],
  ['scrum176-guard-mensaje.test.mjs', 2, PENDIENTE],
  ['scrum264-copy-que-llega-al-cliente.test.mjs', 4, PENDIENTE],
  ['scrum330-contador-solo-activas.test.mjs', 4, PENDIENTE],
  ['scrum384-min-height-locales.test.mjs', 1, PENDIENTE],
  ['scrum386-hojas-fuera.test.mjs', 2, PENDIENTE],
  ['scrum454-destructivo-sin-comprobacion.test.mjs', 4, PENDIENTE],
  ['scrum522-guards-fuera-de-la-tanda.test.mjs', 1, PENDIENTE],
  ['scrum542-objetivo-tactil.test.mjs', 2, PENDIENTE],
  ['scrum562-arbitro-de-toque.test.mjs', 1, PENDIENTE],
  ['scrum600-un-solo-front-documento.test.mjs', 1, PENDIENTE],
  ['scrum605-atajos-vencimiento.test.mjs', 1, PENDIENTE],
  ['scrum630-default-en-dias.test.mjs', 1, PENDIENTE],
  ['scrum643-zona-del-merchant.test.mjs', 1, PENDIENTE],
  ['scrum785-productos-y-proveedores-descuelgan.test.mjs', 2, PENDIENTE],
  ['scrum809-paywall-tras-cancelar.test.mjs', 2, PENDIENTE],
  ['scrum885-documento-sin-enviar.test.mjs', 1, PENDIENTE],
  ['scrum893-solo-lo-que-puede-cobrar.test.mjs', 1, PENDIENTE],
  ['scrum899d-aviso-de-uso.test.mjs', 1, PENDIENTE],
  ['scrum905-facturar-solo-si-se-puede.test.mjs', 3, PENDIENTE],
  ['scrum910-la-transferencia-que-no-mira.test.mjs', 1, PENDIENTE],
  ['scrum910d-microcopy-recibo-pendiente.test.mjs', 1, PENDIENTE],
  ['scrum931-un-solo-importe-de-plantilla.test.mjs', 4, PENDIENTE],
];

/** El censo de UN árbol: `fuentes` es `[{ fichero, codigo }]`. Puro, para poder fabricarle un rojo. */
function censar(fuentes) {
  const construidas = new Map(); // fichero → líneas de sus llamadas de nombre construido
  let llamadas = 0;
  let literales = 0;
  for (const { fichero, codigo } of fuentes) {
    for (const ll of llamadasDeclaradas(codigo, fichero)) {
      llamadas++;
      if (ll.clase === 'literal') literales++;
      if (ll.clase === 'construido') construidas.set(fichero, [...(construidas.get(fichero) ?? []), ll.linea]);
    }
  }
  return { ficheros: fuentes.length, llamadas, literales, construidas };
}

/** Las dos mitades del trinquete, sobre un censo y una lista. */
function veredicto(censo, declaradas) {
  const lista = new Map(declaradas.map(([fichero, n]) => [fichero, n]));
  const deMas = [];
  for (const [fichero, lineas] of censo.construidas) {
    const tope = lista.get(fichero) ?? 0;
    if (lineas.length > tope) deMas.push(`tests/${fichero}: ${lineas.length} de nombre construido (líneas ${lineas.join(', ')}) y la lista declara ${tope}`);
  }
  const deMenos = [];
  for (const [fichero, n] of lista) {
    const hay = (censo.construidas.get(fichero) ?? []).length;
    if (hay < n) deMenos.push(`tests/${fichero}: la lista declara ${n} y el árbol tiene ${hay}`);
  }
  return { deMas, deMenos };
}

function arbolReal() {
  return fs.readdirSync(AQUI).filter((f) => f.endsWith('.test.mjs')).sort()
    .map((fichero) => ({ fichero, codigo: fs.readFileSync(path.join(AQUI, fichero), 'utf8') }));
}

const B = String.fromCharCode(96); // el acento grave, sin escribir una plantilla dentro de una cadena
const CON_BUCLE = `for (const x of [1, 2]) {\n  test(${B}caso \${x}${B}, () => {});\n}\ntest('suelto', () => {});\n`;

test('SCRUM-1415 · SUELO: el censo VE una llamada de nombre construido, y no llama construido a un literal', () => {
  const c = censar([{ fichero: 'fabricado.test.mjs', codigo: CON_BUCLE }]);
  assert.equal(c.llamadas, 2, 'el fuente fabricado tiene dos llamadas');
  assert.equal(c.literales, 1);
  assert.deepEqual(c.construidas.get('fabricado.test.mjs'), [2], '🔴 CIEGO: el censo no ve la llamada del bucle, en su línea');
  const concatenado = censar([{ fichero: 'c.test.mjs', codigo: "test('a ' + 'b', () => {});\n" }]);
  assert.equal(concatenado.construidas.size, 1, 'una concatenación tampoco es un literal para la señal');
});

test('SCRUM-1415 · 🔴 MITAD ①: una llamada de nombre construido que no está en la lista, cae y dice dónde', () => {
  const c = censar([{ fichero: 'nuevo.test.mjs', codigo: CON_BUCLE }]);
  assert.deepEqual(veredicto(c, []).deMas,
    ['tests/nuevo.test.mjs: 1 de nombre construido (líneas 2) y la lista declara 0']);
  // Y con el fichero YA en la lista, una de más también cae: la lista no es un permiso por fichero.
  const dos = censar([{ fichero: 'nuevo.test.mjs', codigo: CON_BUCLE + CON_BUCLE }]);
  assert.equal(veredicto(dos, [['nuevo.test.mjs', 1, 'x']]).deMas.length, 1);
  assert.deepEqual(veredicto(c, [['nuevo.test.mjs', 1, 'x']]), { deMas: [], deMenos: [] }, 'declarada y exacta, no cae nada');
});

test('SCRUM-1415 · 🔴 MITAD ②: una cifra de la lista por encima del árbol, cae — no baja en silencio', () => {
  const c = censar([{ fichero: 'nuevo.test.mjs', codigo: CON_BUCLE }]);
  assert.deepEqual(veredicto(c, [['nuevo.test.mjs', 2, 'x']]).deMenos,
    ['tests/nuevo.test.mjs: la lista declara 2 y el árbol tiene 1']);
  // Un fichero de la lista que ya no existe (o que el censo ha dejado de leer) es el mismo caso.
  assert.deepEqual(veredicto(c, [['nuevo.test.mjs', 1, 'x'], ['borrado.test.mjs', 3, 'x']]).deMenos,
    ['tests/borrado.test.mjs: la lista declara 3 y el árbol tiene 0']);
});

test('SCRUM-1415 · la lista está bien escrita: sin ficheros repetidos, cifras > 0 y cada entrada con su motivo', () => {
  const nombres = DECLARADAS.map(([f]) => f);
  assert.equal(new Set(nombres).size, nombres.length, 'un fichero aparece dos veces en la lista');
  for (const [fichero, n, motivo] of DECLARADAS) {
    assert.ok(Number.isInteger(n) && n > 0, `${fichero}: la cifra tiene que ser un entero > 0 (con 0, se quita la línea)`);
    assert.ok(typeof motivo === 'string' && motivo.length > 20, `${fichero}: sin motivo`);
  }
});

test('SCRUM-1415 · 🔴 EL ÁRBOL: las llamadas de nombre construido son exactamente las de la lista, ni una más ni una menos', () => {
  const fuentes = arbolReal();
  const c = censar(fuentes);
  const total = [...c.construidas.values()].reduce((a, l) => a + l.length, 0);
  const declarado = DECLARADAS.reduce((a, [, n]) => a + n, 0);
  console.log(`[nombres construidos] ficheros=${c.ficheros} llamadas=${c.llamadas} literales=${c.literales}`
    + ` construidas=${total} en_ficheros=${c.construidas.size} lista=${declarado} en_ficheros=${DECLARADAS.length}`);
  // SUELO: «no pude mirar» no da verde. El árbol tenía 1.207 ficheros y 9.777 llamadas al escribir esto.
  assert.ok(c.ficheros > 1000, `🔴 CIEGO: sólo se han leído ${c.ficheros} ficheros de tests/`);
  assert.ok(c.llamadas > 9000, `🔴 CIEGO: sólo se han visto ${c.llamadas} llamadas test()/it()`);
  const v = veredicto(c, DECLARADAS);
  assert.deepEqual(v.deMas, [],
    '🔴 hay llamadas test() de nombre CONSTRUIDO que no están declaradas. La señal por nombres (SCRUM-1339d) no '
    + 'puede decir que faltan si la tanda las pierde. Escribe el nombre literal; si los casos salen de una '
    + 'tabla, con `casosEscritos` de tests/_casos-escritos.mjs. NO se añaden a la lista: la lista sólo baja.\n  '
    + v.deMas.join('\n  '));
  assert.deepEqual(v.deMenos, [],
    '🔴 la lista declara más llamadas de nombre construido que las que hay. Si las has convertido, baja la cifra '
    + '(o quita la línea) en DECLARADAS, en este mismo PR. Si no has tocado esos ficheros, el censo ha dejado de '
    + 'verlas: eso se mira antes de tocar la lista.\n  ' + v.deMenos.join('\n  '));
  assert.equal(total, declarado);
});
