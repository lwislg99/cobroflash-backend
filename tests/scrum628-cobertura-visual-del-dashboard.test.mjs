// tests/scrum628-cobertura-visual-del-dashboard.test.mjs — SCRUM-628
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL VERDE DE LOS GUARDS VISUALES NO DECÍA SOBRE QUÉ PANTALLAS MIRABA.
//
// Medido el 16-sep-2026: **20 ficheros de guard `guard:*`** y **27 vistas del dashboard**. De esas
// 27, **7 las nombra algún guard y 20 no las mira nadie** — entre ellas la de 3.002 líneas.
//
//   >>> Un guard que termina sin hallazgos y no dice sobre qué miró es indistinguible de uno
//   >>> que no miró nada. <<<
//
// ⚠️ EL ENUNCIADO DEL TICKET, MATIZADO: «el dashboard entero no tiene ninguno» no es exacto — 10
// de los 20 tocan alguna ruta del dashboard. Pero casi siempre cargando su `styles.css` dentro de
// una página SINTÉTICA, que ejercita el CSS y no la vista. Por eso la unidad aquí es la VISTA.
//
// ── LO QUE ESTE FICHERO ENTREGA, y lo que NO ───────────────────────────────────────────────
//   ✅ que el verde DECLARE su población (el entregable principal del ticket)
//   ✅ UNA vista cubierta, elegida por criterio escrito y medible, como prueba de que el camino
//      funciona
//   ⛔ NO las 27. Construirlas en una tanda sería adivinar cuáles importan.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cobertura, lineaDePoblacion, laQueMasPesaSinCubrir, vistasDelDashboard } from '../scripts/_cobertura-visual.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ═══ ① EL ENTREGABLE: QUE EL VERDE LO DIGA ══════════════════════════════════════════════════

test('SCRUM-628 · 🔴 el verde DECLARA su población: cuántas vistas hay y cuántas no mira nadie', (t) => {
  const c = cobertura(RAIZ);

  // 🔴 SUELO. Cero vistas y «todo cubierto» se leen igual, y una de las dos es ceguera.
  assert.ok(c.vistas > 0,
    '🔴 CIEGO: no se ha encontrado NINGUNA vista del dashboard. El veredicto de abajo no diría '
    + '«está cubierto», diría «no se supo mirar».');
  assert.ok(c.guards > 0,
    '🔴 CIEGO: cero guards `guard:*` declarados en package.json. Sin población de guards, la '
    + 'cobertura no significa nada.');

  // ÉSTE es el entregable: la salida dice sobre qué miró, pase lo que pase.
  t.diagnostic(lineaDePoblacion(c));
  const mas = laQueMasPesaSinCubrir(c);
  if (mas) t.diagnostic(`la más grande sin cubrir: ${mas.vista} (${mas.lineas} líneas)`);

  // Y las partes SUMAN: si el censo perdiera vistas por el camino, los tres números seguirían
  // siendo plausibles por separado.
  assert.equal(c.cubiertas.length + c.sinCubrir.length, c.vistas,
    '🔴 «cubiertas» + «sin cubrir» no suman el total de vistas: el censo se deja pantallas.');
});

test('SCRUM-628 · 🔴 la cobertura visual del dashboard NO ha empeorado', () => {
  // Trinquete, no umbral cómodo: el número sólo puede BAJAR. Si sube, alguien ha añadido una
  // vista sin cubrir y el rojo se lo dice con su nombre.
  //
  // ⚠️ Y si BAJA también cae, a propósito: obliga a anotar la mejora en vez de dejar que pase
  // desapercibida — es el mismo trinquete que el censo de anclas de SCRUM-267. Hoy ha bajado dos
  // veces y las dos están anotadas abajo.
  //
  // ── 🔴 DE 20 A 6, Y LA MITAD DE LA BAJADA ES UNA CORRECCIÓN, NO UNA MEJORA ────────────────
  //
  // SCRUM-628 declaró **20 sin cubrir** el 16-sep-2026. **Ese número estaba inflado**, y el
  // defecto estaba en el propio censo: contaba como cubierta una vista sólo si un `guard:*`
  // NOMBRABA su fichero, y no veía los tests de la tanda que la MONTAN con `pintarVista`.
  //
  // Se notó porque, al medir esta fase, `jobDetailView.js` —la vista que aquella entrega acababa
  // de cubrir— **seguía apareciendo como sin cubrir**. Un censo que no ve la cobertura que se le
  // acaba de añadir no mide la cobertura: su trinquete se habría quedado clavado en 20
  // pareciendo estable.
  //
  //   >>> Arreglado el censo, las sin cubrir eran 11, no 20: había NUEVE vistas que ya
  //   >>> ejercitaban tests anteriores y nadie las estaba contando. <<<
  //
  // Y de esas 11 se cubren CINCO en esta fase (la tabla de abajo), por el criterio derivado.
  const c = cobertura(RAIZ);
  const SIN_CUBRIR_HOY = 6;
  assert.equal(c.sinCubrir.length, SIN_CUBRIR_HOY,
    `🔴 LA COBERTURA VISUAL HA CAMBIADO: ${c.sinCubrir.length} vistas sin cubrir, y el censo `
    + `declara ${SIN_CUBRIR_HOY}.\n\n    ${lineaDePoblacion(c)}\n\n`
    + `  sin cubrir: ${c.sinCubrir.map((f) => f.vista).join(', ')}\n\n`
    + '  Si has AÑADIDO una vista, o le pones un guard o bajas este número a propósito.\n'
    + '  Si has CUBIERTO una, enhorabuena: bájalo aquí para que la mejora quede anotada.');
});

// ═══ ② LA VISTA CUBIERTA · elegida por el censo, no por intuición ═══════════════════════════
//
// `jobDetailView.js` — **3.002 líneas, la más grande de las 20 que hoy no mira nadie**, y es el
// detalle del Trabajo: la pantalla donde el profesional pasa el día. El criterio (tamaño, entre
// las enlazadas por el índice) vive en `laQueMasPesaSinCubrir` y se puede volver a ejecutar.

test('SCRUM-628 · las vistas YA cubiertas no vuelven a la lista de pendientes', () => {
  // La versión anterior anclaba a un NOMBRE fijo (`jobDetailView.js`) y cayó en cuanto esa vista
  // quedó cubierta — hizo su trabajo: avisó de que la elección se había tomado sobre otro árbol.
  // Pero anclar al nombre de la candidata obliga a reescribirlo cada fase, y eso es exactamente
  // el defecto de SCRUM-663: un valor que alguien tiene que actualizar a mano.
  //
  // Lo que se ata ahora es la propiedad que de verdad importa y no caduca: **lo cubierto sigue
  // cubierto**. Cuál es la siguiente candidata lo dice el censo, y va al diagnóstico, no a un
  // aserto.
  const c = cobertura(RAIZ);
  const sinCubrir = new Set(c.sinCubrir.map((f) => f.vista));
  const regresiones = ['jobDetailView.js', ...VISTAS_DE_LA_FASE_B.map((v) => v.vista)]
    .filter((v) => sinCubrir.has(v));
  assert.deepEqual(regresiones, [],
    `🔴 VISTAS QUE YA ESTABAN CUBIERTAS Y HAN VUELTO A PENDIENTES: ${regresiones.join(', ')}\n\n`
    + '  O se ha borrado el test que las montaba, o el censo ha dejado de reconocerlo. Las dos\n'
    + '  cosas se leen igual desde fuera y las dos dejan la pantalla sin vigilar.');
});

test('SCRUM-628 · 🔴 EL QUE DECIDE: el detalle del Trabajo SE MONTA, y pinta su contenedor', async () => {
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderJobDetailView');

  assert.equal(r.error, null,
    `🔴 LA VISTA DEL DETALLE DE TRABAJO NO SE MONTA: ${r.error}\n\n`
    + '  Son 3.002 líneas y hasta hoy ningún guard la abría: si reventase al abrirse, el\n'
    + '  profesional se encontraría la pantalla en blanco y la tanda seguiría en verde.');
  assert.ok(r.contenedor, '🔴 la vista se monta pero no deja contenedor: no ha pintado nada.');

  // 🔴 POR IDENTIDAD, NO POR SUBCADENA. `includes('btn-primary')` casaría también
  // `btn-primary btn-sm`, y entonces el guard pasaría por una razón distinta de la que cree.
  // Se cuentan NODOS del árbol pintado, que es lo que el navegador construye de verdad.
  const nodos = todos(r.contenedor);
  assert.ok(nodos.length > 1,
    `🔴 la vista pinta ${nodos.length} nodo(s). Un contenedor vacío y una vista rota se ven `
    + 'igual desde fuera, y por eso esto cuenta nodos en vez de mirar el HTML como texto.');
});

// ═══ ②b FASE b · LAS CINCO SIGUIENTES, por el mismo criterio derivado ════════════════════════
//
// Salen de `laQueMasPesaSinCubrir()` aplicado en cascada, no de intuición: son las cinco mayores
// de las que quedaban tras arreglar el censo. Cuántas se cubren en una tanda es decisión de coste
// —todas montan y el coste marginal es una fila más en esta tabla—; CUÁLES no lo es.
const VISTAS_DE_LA_FASE_B = Object.freeze([
  { vista: 'homeView.js', render: 'renderHomeView', lineas: 1381 },
  { vista: 'quotesDetailView.js', render: 'renderQuoteDetailView', lineas: 1342 },
  { vista: 'productsView.js', render: 'renderProductsView', lineas: 1176 },
  { vista: 'jobsView.js', render: 'renderJobsView', lineas: 982 },
  { vista: 'invoicesView.js', render: 'renderInvoicesView', lineas: 919 },
]);

/**
 * Monta una vista y exige que pinte. Se le pasa el resultado YA obtenido, no el nombre: la llamada
 * a `pintarVista` va escrita con el LITERAL en cada test, y eso es deliberado —
 * `rendersEjercitados` sólo cuenta esa forma, porque es la única que puede comprobar sin adivinar.
 */
function exigeQueMonte(r, vista, lineas) {
  assert.equal(r.error, null,
    `🔴 ${vista} NO SE MONTA: ${r.error}\n\n`
    + `  Son ${lineas} líneas y hasta esta fase ningún guard ni test la abría: si reventase al\n`
    + '  entrar, el profesional se encontraría la pantalla en blanco y la tanda seguiría verde.');
  assert.ok(r.contenedor, `🔴 ${vista} se monta pero no deja contenedor: no ha pintado nada.`);
  // 🔴 POR IDENTIDAD, NO POR SUBCADENA: se cuentan NODOS del árbol pintado. `includes` sobre el
  // HTML aprobaría por una razón distinta de la que cree — es lo que pasó con `btn-primary`,
  // que casaba también `btn-primary btn-sm`.
  assert.ok(todos(r.contenedor).length > 1,
    `🔴 ${vista} pinta ${todos(r.contenedor).length} nodo(s). Un contenedor vacío y una vista `
    + 'rota se ven igual desde fuera, y por eso esto cuenta nodos y no texto.');
}

test('SCRUM-628b · 🔴 homeView.js SE MONTA y pinta su contenedor', async () => {
  exigeQueMonte(await pintarVista(cargarDashboard(RAIZ), 'renderHomeView'), 'homeView.js', 1381);
});

test('SCRUM-628b · 🔴 quotesDetailView.js SE MONTA y pinta su contenedor', async () => {
  exigeQueMonte(await pintarVista(cargarDashboard(RAIZ), 'renderQuoteDetailView'), 'quotesDetailView.js', 1342);
});

test('SCRUM-628b · 🔴 productsView.js SE MONTA y pinta su contenedor', async () => {
  exigeQueMonte(await pintarVista(cargarDashboard(RAIZ), 'renderProductsView'), 'productsView.js', 1176);
});

test('SCRUM-628b · 🔴 jobsView.js SE MONTA y pinta su contenedor', async () => {
  exigeQueMonte(await pintarVista(cargarDashboard(RAIZ), 'renderJobsView'), 'jobsView.js', 982);
});

test('SCRUM-628b · 🔴 invoicesView.js SE MONTA y pinta su contenedor', async () => {
  exigeQueMonte(await pintarVista(cargarDashboard(RAIZ), 'renderInvoicesView'), 'invoicesView.js', 919);
});

test('SCRUM-628b · el censo RECONOCE como cubiertas las cinco de esta fase', () => {
  // Sin esto, los tests de arriba podrían pasar y el censo seguir contándolas como sin cubrir —
  // que es exactamente el defecto que tenía el censo de SCRUM-628 con `jobDetailView.js`.
  const c = cobertura(RAIZ);
  const sinCubrir = new Set(c.sinCubrir.map((f) => f.vista));
  const invisibles = VISTAS_DE_LA_FASE_B.map((v) => v.vista).filter((v) => sinCubrir.has(v));
  assert.deepEqual(invisibles, [],
    `🔴 EL CENSO NO VE LA COBERTURA QUE ACABA DE AÑADIRSE: ${invisibles.join(', ')}\n\n`
    + '  Un censo que no reconoce la cobertura nueva deja su trinquete clavado, pareciendo\n'
    + '  estable. Es el defecto que tenía el de SCRUM-628 y por el que aquel 20 estaba inflado.');
});

// ═══ ③ CONTROL POSITIVO · los guards existentes siguen cazando lo suyo ═══════════════════════

test('SCRUM-628 · ✅ POSITIVO: el banco SIGUE montando las vistas que ya se vigilaban', async () => {
  // Si el banco se rompiera, el test de arriba pasaría a medir el banco en vez de la vista — y
  // «la vista está bien» y «el banco no monta nada» darían el mismo verde. Se comprueba con dos
  // vistas que YA estaban cubiertas antes de este ticket: si éstas caen, el problema no es la
  // pantalla nueva.
  for (const [vista, render] of [['customersView.js', 'renderCustomersView'], ['quotesView.js', 'renderQuotesView']]) {
    const banco = cargarDashboard(RAIZ);
    const r = await pintarVista(banco, render);
    assert.equal(r.error, null, `🔴 ${vista} ha dejado de montarse: ${r.error}. El banco está roto, `
      + 'y entonces lo que mide el control de arriba no es la vista nueva.');
  }
});

test('SCRUM-628 · 🔴 SUELO: el censo VE las vistas del árbol real', () => {
  const v = vistasDelDashboard(RAIZ);
  assert.ok(v.length >= 20,
    `🔴 el censo ve ${v.length} vistas y el dashboard tiene decenas. Si esto devuelve poco, la `
    + 'cobertura de arriba se calcula sobre una población que no es la real.');
  assert.ok(v.includes('jobDetailView.js'),
    '🔴 el censo no ve la vista que este fichero cubre: entonces no está mirando donde cree.');
});
