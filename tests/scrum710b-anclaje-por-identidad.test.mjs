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

/** Cuántos anclajes hay HOY por identidad estable (qué guard ancla a qué fichero). */
function cuentaPorIdentidad(hallados) {
  const m = new Map();
  for (const h of hallados.filter(sinMi)) m.set(h.identidad, (m.get(h.identidad) || 0) + 1);
  return m;
}

// ── 🔴 SCRUM-710 · POR QUÉ LA IDENTIDAD YA NO LLEVA LA LÍNEA DENTRO ─────────────────────
//
// Este trinquete existe para que no PROLIFEREN los anclajes por línea. Con la identidad
// `guard  fichero:línea`, **bloqueaba corregir uno**: pasar de `:133` a `:141` producía a la vez
// un id nuevo («has añadido un anclaje») y un id desaparecido («has arreglado uno, actualiza la
// lista»). Dos rojos por un cambio que no añade nada.
//
// 🔒 Un guard que sólo permite ir a peor no es un trinquete: es un cepo. Y ocurrió de verdad
// —el 4-sep-2026 bloqueó tipar `serializeJobDetail` (SCRUM-717d), que tuvo que revertirse.
//
// **CORREGIR y AÑADIR son dos hechos distintos, y la identidad vieja los sumaba.** Ahora la
// identidad es `guard  fichero` —sin línea, lo único que no se mueve cuando alguien edita por
// encima— y lo que distingue «otro anclaje más al mismo fichero» de «el mismo, corregido» es
// **la CUENTA**. Sin contar, tres identidades con dos anclajes cada una (`scrum390`, `scrum514`,
// `scrum656b`) dejarían colar un anclaje nuevo sin que nadie se enterara.
//
// ⚠️ Y NO SE HA AFLOJADO NADA: añadir sigue siendo rojo, por identidad nueva o por cuenta que
// sube. Lo único que ha dejado de ser rojo es mover un número que ya estaba declarado.

test('SCRUM-710b · 🔴 los anclajes por NÚMERO DE LÍNEA no crecen', () => {
  const cuenta = cuentaPorIdentidad(anclajesPorLinea(RAIZ).hallados);
  const nuevos = [];
  for (const [id, n] of cuenta) {
    const declarados = CONOCIDOS_A.get(id) || 0;
    if (n > declarados) nuevos.push(`${id}  (declarados ${declarados}, hay ${n})`);
  }
  nuevos.sort();

  // Se listan los NUEVOS, no los 33: un rojo con treinta líneas no lo lee nadie.
  assert.deepEqual(nuevos, [],
    '🔴 ANCLAJES POR POSICIÓN NUEVOS:\n    ' + nuevos.join('\n    ')
    + '\n\n  Un número de línea es una POSICIÓN: el día que alguien edite ese fichero por encima, '
    + 'esto caduca y quien lo pague no sabrá por qué. Ánclalo a lo que la cosa ES —el '
    + 'identificador, el literal, el nodo— y deja la línea sólo para el mensaje.'
    + '\n\n  ✅ CORREGIR uno que ya está declarado NO cae aquí: la identidad no lleva la línea '
    + 'dentro. Si te sale este rojo es porque hay uno MÁS, no porque uno se haya movido.');
});

test('SCRUM-710b · 🔴 y la lista no se pudre: lo ARREGLADO se borra en el mismo commit', () => {
  // 🔴 Un trinquete que sólo mira hacia arriba deja que el número caiga sin que nadie actualice
  // la lista, y entonces deja de apretar. Esto es un hecho DISTINTO del de arriba —por eso es
  // otro test—: aquí no se ha añadido nada, se ha quitado y falta anotarlo.
  const cuenta = cuentaPorIdentidad(anclajesPorLinea(RAIZ).hallados);
  const sobran = [];
  for (const [id, n] of CONOCIDOS_A) {
    const hay = cuenta.get(id) || 0;
    if (hay < n) sobran.push(`${id}  (declarados ${n}, hay ${hay})`);
  }
  sobran.sort();
  assert.deepEqual(sobran, [],
    `🔴 se han ARREGLADO ${sobran.length} anclaje(s) (bien) y la lista se ha quedado atrás: `
    + 'baja su cuenta en `CONOCIDOS_A` —o borra la entrada si llega a cero— en el mismo commit, '
    + 'o el trinquete deja de apretar.\n    ' + sobran.join('\n    '));
});

test('SCRUM-710b · 🔴 CORREGIR un anclaje NO cuenta como AÑADIRLO (y añadir sigue cayendo)', () => {
  // El test que fija la respuesta a «¿cómo se corrige un ancla si el trinquete lo impide?».
  // Se hace sobre hallazgos sintéticos: montar el caso real exigiría editar un fichero de otro
  // carril, y lo que se comprueba es la ARITMÉTICA del trinquete, no el árbol.
  const como = (fichero, destino, lineaDestino) => ({
    fichero, destino, lineaDestino, identidad: `${fichero}  ${destino}`,
  });
  const G = 'tests/guardFalso.test.mjs';
  const declarado = new Map([[`${G}  objetivo.js`, 1]]);
  const cuenta = (hs) => {
    const m = new Map();
    for (const h of hs) m.set(h.identidad, (m.get(h.identidad) || 0) + 1);
    return m;
  };
  const nuevosDe = (hs) => [...cuenta(hs)].filter(([id, n]) => n > (declarado.get(id) || 0)).map(([id]) => id);

  // ✅ CORREGIR: mismo guard, mismo destino, OTRA línea → nada nuevo.
  assert.deepEqual(nuevosDe([como(G, 'objetivo.js', 141)]), [],
    '🔴 mover un anclaje ya declarado de la 133 a la 141 sigue contando como uno nuevo: el cepo '
    + 'no está arreglado y corregir un ancla vuelve a ser imposible.');

  // 🔴 AÑADIR OTRO al mismo fichero → cae por la CUENTA. Sin contar, esto pasaría por corregir.
  assert.deepEqual(nuevosDe([como(G, 'objetivo.js', 141), como(G, 'objetivo.js', 200)]),
    [`${G}  objetivo.js`],
    '🔴 se ha colado un anclaje NUEVO al mismo fichero. Soltar la línea de la identidad sin '
    + 'contar cuántos hay cambia un cepo por una fuga.');

  // 🔴 AÑADIR a un fichero NUEVO → cae por la identidad.
  assert.deepEqual(nuevosDe([como(G, 'objetivo.js', 133), como(G, 'otro.js', 12)]),
    [`${G}  otro.js`], '🔴 un anclaje a un fichero no declarado ha dejado de caer');
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
// 🔴 4-sep-2026 · SALEN SIETE, Y NO SE COMENTAN: SE BORRAN (convención del censo de
// SCRUM-402). Eran los de `scrum553`, y eran **los únicos del árbol que se rompían de verdad**:
// medido metiendo UNA línea en blanco arriba de cada fichero anclado y corriendo su guard, de
// los 40 anclajes que había **se rompían exactamente esos 7**; los otros 33 aguantan porque
// citan la posición como DECLARACIÓN y no la recalculan. `scrum553` ahora los identifica por
// fichero + etiqueta + cuántos hay, que es lo que no se mueve.
//
// ⚠️ Y la clasificación «dato vs mensaje» que había aquí no predecía esto: 24 se comparában
// como DATO y sólo 7 se rompían. La deducción decía 24; la medición dice 7. Manda la medición.
//
// 33 hallazgos en 30 identidades: `scrum390`, `scrum514` y `scrum656b` anclan DOS veces al
// mismo fichero. Por eso el valor es una CUENTA y no un `true` — sin ella, añadir un tercero
// a cualquiera de esos tres pasaría por «corregir».
const CONOCIDOS_A = new Map([
  ['scripts/_texto-fuera-del-censo.mjs  scripts/guard-a11y-comparativa.mjs', 1],
  ['tests/_huerfanos-declarados.mjs  public/dashboard/js/cobrosView.js', 1],
  ['tests/_huerfanos-declarados.mjs  public/dashboard/js/jobDetailView.js', 1],
  ['tests/_huerfanos-declarados.mjs  quoteRequests.routes.ts', 1],
  ['tests/_huerfanos-declarados.mjs  teamOverview.service.ts', 1],
  ['tests/scrum128-send-endpoints-fail-closed.test.mjs  quotes.routes.ts', 1],
  ['tests/scrum216-tipo-rectificativa-sin-defecto.test.mjs  YAQU_MASTER.md', 1],
  ['tests/scrum264-copy-que-llega-al-cliente.test.mjs  api.js', 1],
  ['tests/scrum298-modo-visible.test.mjs  emission.service.ts', 1],
  ['tests/scrum298-modo-visible.test.mjs  invoiceNumber.service.ts', 1],
  ['tests/scrum298-modo-visible.test.mjs  invoicesAdmin.routes.ts', 1],
  ['tests/scrum298-modo-visible.test.mjs  verifactu.service.ts', 1],
  ['tests/scrum299-copy-factura-publico.test.mjs  index.html', 1],
  ['tests/scrum302-presupuesto-y-fotos.test.mjs  jobRailBlocks.js', 1],
  ['tests/scrum324-cadena-hasta-el-libro.test.mjs  docs/legal/PREGUNTAS_ASESOR.md', 1],
  ['tests/scrum358-alta-idempotente.test.mjs  invoiceNumber.service.ts', 1],
  ['tests/scrum380-primaria-tactil.test.mjs  jobDetailView.js', 1],
  ['tests/scrum390-puerta-cliente-real.test.mjs  docs/YAQU_MASTER.md', 2],
  ['tests/scrum397-fecha-real-de-cobro.test.mjs  criterioCaja.ts', 1],
  ['tests/scrum403-beneficio-sin-iva.test.mjs  desgloseEmpleado.ts', 1],
  ['tests/scrum447-byte-invisible-en-patrones.test.mjs  falso.mjs', 1],
  ['tests/scrum514-aprobado-y-aplicado.test.mjs  settingsView.js', 2],
  ['tests/scrum519-un-solo-criterio-de-cobro.test.mjs  homeView.js', 1],
  ['tests/scrum519-un-solo-criterio-de-cobro.test.mjs  payInvoice.routes.ts', 1],
  ['tests/scrum519-un-solo-criterio-de-cobro.test.mjs  settingsView.js', 1],
  ['tests/scrum624b-guardado-vs-impreso.test.mjs  schemas.ts', 1],
  ['tests/scrum624c-total-canonico.test.mjs  albaranAFactura.ts', 1],
  ['tests/scrum642-tramos-del-arranque.test.mjs  BrowserLauncher.ts', 1],
  ['tests/scrum656b-clausulas-configuracion.test.mjs  quotes.routes.ts', 2],
  ['tests/scrum656b-clausulas-configuracion.test.mjs  quotesView.js', 1],
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
