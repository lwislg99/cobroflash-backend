// tests/scrum710b-anclaje-por-identidad.test.mjs — SCRUM-710 (segunda fase)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// «Referenciar por POSICIÓN caduca. Referenciar por IDENTIDAD no.»
//
// SCRUM-710 cerró una cara de esto —`constaAprobado` comparaba por subcadena y pasó a comparar
// unidades delimitadas por identidad—. Quedaban DOS caras más, las dos medidas el 3-sep-2026:
//
//   (a) ANCLAR POR NÚMERO DE LÍNEA. El censo de SCRUM-622 guardaba su excepción como
//       `invoicesView.js:520  <expresión>` y comparaba esa cadena ENTERA. Doce líneas añadidas
//       por encima en SCRUM-599 la movieron a la 532: el guard cayó SIN QUE CAMBIARA NADA DE LO
//       QUE VIGILA, se re-ancló a mano, y el defecto de forma seguía ahí. **Ya está arreglado**
//       —el censo separa `id` de `linea`— y este fichero impide que vuelva.
//
//   (b) LÍNEAS BASE QUE COMPARTEN LÍNEA FÍSICA. Pares `['loQueSea', 123]` en la misma línea: dos
//       tickets suben números distintos y git marca conflicto sobre la línea entera. Siete
//       conflictos semánticos en un día, los siete resueltos sumando — y la resolución correcta
//       sólo se descubre probando las tres variantes.
//
// 🔴 EL CENSO VA POR AST, NUNCA POR SUBCADENA. En una semana comparar por nombre mordió cuatro
// veces: `data-view="parte` cazando `partes-oficina`, `MARCADOR_MICROCOPY` dentro de
// `PV_MARCADOR_MICROCOPY`, `defaultVat` que no contiene `vat`, y `round2(n)` sin nombre de dinero.
// Con AST, además, el comentario que explica la prohibición no se cuenta a sí mismo.
//
// ⚠️ LO QUE ESTE FICHERO NO HACE: arreglar los 41. Es un TRINQUETE de no-crecimiento, no una
// campaña. Cambiar la forma de las líneas base toca ficheros que otras sesiones están editando
// ahora mismo, así que la propuesta va escrita en la entrada de máster y la ejecución es otra
// tanda (lo pidió así el encargo).
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { anclajesPorLinea, lineasBaseCompartidas } from './_censo-por-posicion.mjs';

/**
 * 🔴 EL CENSO SE CAZABA A SI MISMO, y no es un caso raro: es la naturaleza de un censo
 * DECLARADO. La lista `CONOCIDOS_A` de abajo CONTIENE, por necesidad, las mismas citas
 * `fichero:linea` que vigila — son literales de cadena y el AST las ve como lo que son.
 *
 * Se excluye SOLO este fichero, y el aserto de abajo comprueba que no se excluye ningun otro:
 * una exclusion que crece deja de ser una excepcion y pasa a ser una lista blanca.
 */
const YO = 'tests/scrum710b-anclaje-por-identidad.test.mjs';
const sinMi = (h) => h.fichero !== YO;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ═══ ① SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-710b · SUELO: los dos censos VEN el árbol, y ninguno devuelve cero', () => {
  const a = anclajesPorLinea(RAIZ);
  const b = lineasBaseCompartidas(RAIZ);

  assert.ok(a.leidos > 300,
    `🔴 CIEGO: sólo he leído ${a.leidos} ficheros de \`tests/\` y \`scripts/\`. Un barrido que no `
    + 'encuentra árbol devuelve un cero que se lee como «no hay ninguno».');

  // 🔴 Y EL SUELO DE VERDAD, el que pidió el encargo: si CUALQUIERA de las dos formas devolviera
  // cero, es que el detector dejó de ver — no que el repo se haya limpiado solo. Este defecto no
  // viene solo: aparecieron dos familias en un día.
  assert.ok(a.hallados.length > 0,
    '🔴 CERO anclajes por número de línea. O alguien los ha arreglado TODOS —y entonces esta '
    + 'entrada se retira a mano diciéndolo— o el detector ha dejado de reconocer la forma.');
  assert.ok(b.hallados.length > 0,
    '🔴 CERO líneas base compartiendo línea. Mismo aviso: un cero aquí es una noticia que hay que '
    + 'escribir, no un verde.');
});

test('SCRUM-710b · SUELO: el detector distingue lo que es de lo que se le parece', () => {
  // Sin esto, un detector que dijera «sí» a todo pasaría los censos de abajo.
  const a = anclajesPorLinea(RAIZ);
  const ids = a.hallados.filter(sinMi).map((h) => h.id);
  assert.ok(ids.some((i) => /:\d+/.test(i)),
    '🔴 ningún hallazgo lleva un `fichero:línea`: el detector no está reconociendo la forma.');
  // Y NO se cuenta a sí mismo: este fichero explica la prohibición en sus comentarios, y un
  // censo de texto se cazaría aquí mismo.
  assert.equal(ids.some((i) => i.startsWith('tests/scrum710b-')), false,
    '🔴 el censo se ha cazado a sí mismo en un comentario: está mirando texto y no AST.');
});

// ═══ ② EL ARREGLO DE (a), FIJADO ═════════════════════════════════════════════════════════

test('SCRUM-710b · 🔴 el censo de SCRUM-622 ya NO ancla por número de línea', () => {
  // Ésta es la regresión que se impide: que alguien vuelva a meter la POSICIÓN en el dato que
  // se compara. El fichero puede seguir CITANDO líneas en su prosa —eso no tumba nada—; lo que
  // no puede es compararlas.
  const src = fs.readFileSync(
    path.join(RAIZ, 'tests/scrum622-desconocido-no-es-verde.test.mjs'), 'utf8');
  const bloque = src.slice(src.indexOf('EL CENSO: queda UNA red benigna'));
  const comparacion = bloque.slice(0, bloque.indexOf('});'));

  assert.match(comparacion, /encontradas\.map\(\(h\) => h\.id\)/,
    '🔴 el censo de 622 ha vuelto a comparar la cadena entera en vez de la identidad.');
  assert.equal(/invoicesView\.js:\d+/.test(comparacion), false,
    '🔴 ha vuelto un número de línea A LA COMPARACIÓN de SCRUM-622. Doce líneas añadidas por '
    + 'encima lo tumbarán otra vez sin que cambie nada de lo que vigila — pasó el 3-sep y costó '
    + 'una vuelta de sesión. La línea puede ir en el MENSAJE; en el dato que se compara, no.');

  // Y el censo de este fichero tiene que estar de acuerdo: 622 ya no sale entre los anclajes.
  const a = anclajesPorLinea(RAIZ);
  assert.equal(a.hallados.some((h) => h.fichero.includes('scrum622')), false,
    '🔴 el censo sigue viendo un anclaje por línea en `scrum622`: el arreglo no está completo.');
});

// ═══ ③ EL TRINQUETE: NO CRECEN ═══════════════════════════════════════════════════════════

test('SCRUM-710b · 🔴 los anclajes por NÚMERO DE LÍNEA no crecen', () => {
  const { hallados } = anclajesPorLinea(RAIZ);
  const nuevos = hallados.filter(sinMi).map((h) => h.id).filter((i) => !CONOCIDOS_A.has(i));

  // Se listan los NUEVOS, no los 41: un rojo con cuarenta líneas no lo lee nadie.
  assert.deepEqual(nuevos, [],
    '🔴 ANCLAJES POR POSICIÓN NUEVOS:\n    ' + nuevos.join('\n    ')
    + '\n\n  Un número de línea es una POSICIÓN: el día que alguien edite ese fichero por encima, '
    + 'esto caduca y quien lo pague no sabrá por qué. Ánclalo a lo que la cosa ES —el '
    + 'identificador, el literal, el nodo— y deja la línea sólo para el mensaje.');

  // 🔴 Y SI BAJA, TAMBIÉN SE DICE. Un trinquete que sólo mira hacia arriba deja que el número
  // caiga sin que nadie actualice la lista, y entonces deja de apretar.
  const idsHoy = new Set(hallados.filter(sinMi).map((h) => h.id));
  const arreglados = [...CONOCIDOS_A].filter((i) => !idsHoy.has(i));
  assert.deepEqual(arreglados, [],
    `🔴 se han ARREGLADO ${arreglados.length} anclajes (bien) y la lista se ha quedado atrás: `
    + 'bórralos de `CONOCIDOS_A` en el mismo commit, o el trinquete deja de apretar.\n    '
    + arreglados.join('\n    '));
});

test('SCRUM-710b · 🔴 las líneas base que comparten línea no crecen', () => {
  const { hallados } = lineasBaseCompartidas(RAIZ);
  const ficheros = [...new Set(hallados.map((h) => h.fichero))].sort();
  assert.deepEqual(ficheros, CONOCIDOS_B,
    '🔴 ha cambiado el conjunto de ficheros con líneas base que comparten línea física.\n'
    + '  Si hay uno NUEVO: dos tickets que suban números distintos de esa línea chocarán, y el '
    + 'conflicto no dirá que son cambios independientes. Escribe un elemento por línea.\n'
    + '  Si falta uno: se ha arreglado — bórralo de `CONOCIDOS_B` en el mismo commit.');
});

// ═══ ④ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-710b · CONTROL NEGATIVO: una cita en PROSA no es un anclaje', () => {
  // El censo mira LITERALES, no comentarios. Un comentario que dice «ver foo.js:12» envejece,
  // pero no tumba nada porque nadie compara contra él — y contarlo llenaría el censo de ruido
  // hasta que alguien lo apagara.
  const a = anclajesPorLinea(RAIZ);
  const enComentario = a.hallados.filter(sinMi).filter((h) => {
    const src = fs.readFileSync(path.join(RAIZ, h.fichero), 'utf8').split('\n');
    return /^\s*(\/\/|\*)/.test(src[h.linea - 1] || '');
  });
  assert.deepEqual(enComentario, [],
    `🔴 el censo ha contado ${enComentario.length} citas que están en un COMENTARIO: está mirando `
    + 'texto y no AST, y es exactamente el defecto que este fichero dice evitar.');
});

test('SCRUM-710b · CONTROL NEGATIVO: un array con un elemento por línea NO entra', () => {
  // Lo que NO debe caer: la forma correcta. Si entrara, el censo estaría pidiendo justo lo que
  // recomienda, y nadie podría arreglar nada.
  const b = lineasBaseCompartidas(RAIZ);
  for (const h of b.hallados) {
    assert.ok(h.lineasCompartidas > 0,
      `🔴 «${h.fichero}» ha entrado sin tener ningún par compartiendo línea: el detector está `
      + 'contando arrays bien escritos.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO DECLARADO · medido el 4-sep-2026 sobre 817 ficheros de `tests/` y `scripts/`.
//
// (a) 40 anclajes por número de línea (eran 41; SCRUM-514 retiró uno el 4-sep). De ellos, la
//     mayoría aparecen como DATO y el resto dentro del mensaje de un `assert` — los del mensaje
//     envejecen pero no tumban nada, porque nadie compara
//     contra ellos. ⚠️ Esa clasificación es ORIENTATIVA y no se usa para decidir: es frágil
//     (la prosa dentro de un campo `motivo:` sale como «dato»), y colgar un trinquete de un
//     criterio frágil es cómo se acaba apagando. Lo que se vigila es el TOTAL.
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ 40 HALLAZGOS, 39 IDENTIDADES, y no falta ninguno: `scrum390` cita `YAQU_MASTER.md:1472`
// DOS veces en el mismo fichero, y la identidad de las dos es la misma. El Set las colapsa a
// propósito — lo que se vigila es QUÉ posiciones se fijan, no cuántas veces se escriben. Se
// declara aquí porque ver «39» al lado de un censo que dice «40» invita a pensar que se perdió
// una, y perseguir eso cuesta una vuelta.
const CONOCIDOS_A = new Set([
  'tests/scrum128-send-endpoints-fail-closed.test.mjs  quotes.routes.ts:568',
  'tests/scrum216-tipo-rectificativa-sin-defecto.test.mjs  YAQU_MASTER.md:1328',
  'tests/scrum264-copy-que-llega-al-cliente.test.mjs  api.js:35',
  'tests/scrum298-modo-visible.test.mjs  invoicesAdmin.routes.ts:68',
  'tests/scrum298-modo-visible.test.mjs  emission.service.ts:12',
  'tests/scrum298-modo-visible.test.mjs  verifactu.service.ts:333',
  'tests/scrum298-modo-visible.test.mjs  invoiceNumber.service.ts:214',
  'tests/scrum299-copy-factura-publico.test.mjs  index.html:380',
  'tests/scrum302-presupuesto-y-fotos.test.mjs  jobRailBlocks.js:77',
  'tests/scrum324-cadena-hasta-el-libro.test.mjs  docs/legal/PREGUNTAS_ASESOR.md:539',
  'tests/scrum358-alta-idempotente.test.mjs  invoiceNumber.service.ts:115',
  'tests/scrum380-primaria-tactil.test.mjs  jobDetailView.js:63',
  'tests/scrum390-puerta-cliente-real.test.mjs  docs/YAQU_MASTER.md:1472',
  'tests/scrum397-fecha-real-de-cobro.test.mjs  criterioCaja.ts:12',
  'tests/scrum403-beneficio-sin-iva.test.mjs  desgloseEmpleado.ts:118',
  'tests/scrum447-byte-invisible-en-patrones.test.mjs  falso.mjs:2',
  'tests/scrum514-aprobado-y-aplicado.test.mjs  settingsView.js:213',
  // 🔴 4-sep-2026 · SALE DE LA LISTA: la entrada se BORRA, no se pone a cero ni se comenta
  // (convención del censo de SCRUM-402, precedente SCRUM-424/405). La retiró SCRUM-514 al
  // decidirse la grafía de «Nueva factura»: su excepción de APARCADOS se borró y con ella la
  // cita a `invoicesView.js:172`. Se re-midió sobre el árbol YA MEZCLADO antes de bajar
  // cifra — contar antes de mezclar caducó dos veces el mismo día.
  'tests/scrum514-aprobado-y-aplicado.test.mjs  settingsView.js:219',
  'tests/scrum519-un-solo-criterio-de-cobro.test.mjs  payInvoice.routes.ts:69',
  'tests/scrum519-un-solo-criterio-de-cobro.test.mjs  settingsView.js:990',
  'tests/scrum519-un-solo-criterio-de-cobro.test.mjs  homeView.js:309',
  'tests/scrum553-etiquetas-pegadas.test.mjs  tests/scrum331-heroe.test.mjs:163',
  'tests/scrum553-etiquetas-pegadas.test.mjs  tests/scrum331-heroe.test.mjs:164',
  'tests/scrum553-etiquetas-pegadas.test.mjs  tests/scrum541-comparativa-a11y.test.mjs:82',
  'tests/scrum553-etiquetas-pegadas.test.mjs  tests/_barra-lateral.mjs:77',
  'tests/scrum553-etiquetas-pegadas.test.mjs  tests/scrum264-copy-que-llega-al-cliente.test.mjs:74',
  'tests/scrum553-etiquetas-pegadas.test.mjs  tests/scrum363-eje-de-cobro.test.mjs:133',
  'tests/scrum553-etiquetas-pegadas.test.mjs  tests/scrum551-anclas-bloque-f.test.mjs:152',
  'tests/scrum624b-guardado-vs-impreso.test.mjs  schemas.ts:16',
  'tests/scrum624c-total-canonico.test.mjs  albaranAFactura.ts:274',
  'tests/scrum642-tramos-del-arranque.test.mjs  BrowserLauncher.ts:363',
  'tests/scrum656b-clausulas-configuracion.test.mjs  quotes.routes.ts:215',
  'tests/scrum656b-clausulas-configuracion.test.mjs  quotesView.js:3294',
  'tests/scrum656b-clausulas-configuracion.test.mjs  quotes.routes.ts:213',
  'tests/_huerfanos-declarados.mjs  public/dashboard/js/cobrosView.js:117',
  'tests/_huerfanos-declarados.mjs  public/dashboard/js/jobDetailView.js:803',
  'tests/_huerfanos-declarados.mjs  quoteRequests.routes.ts:25',
  'tests/_huerfanos-declarados.mjs  teamOverview.service.ts:58',
  'scripts/_texto-fuera-del-censo.mjs  scripts/guard-a11y-comparativa.mjs:183',
]);

// (b) TRES arrays de pares `[texto, número]` con dos o más pares en la misma línea física.
//     Sólo UNO es una línea base de las que chocan —`scrum698`, el caso del encargo—; los otros
//     dos son datos de prueba de formateo. Se vigilan los tres porque la FORMA es la misma y el
//     conflicto lo causa la forma, no la intención.
const CONOCIDOS_B = [
  'tests/scrum229-margen-en-pie.test.mjs',
  'tests/scrum488-un-solo-vocabulario.test.mjs',
  'tests/scrum698-vistas-que-no-se-miden.test.mjs',
];
