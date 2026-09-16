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
  // Trinquete, no umbral cómodo: hoy hay 20 sin cubrir y el número sólo puede BAJAR. Si sube,
  // alguien ha añadido una vista sin guard y el rojo se lo dice con su nombre.
  //
  // ⚠️ Y si BAJA también cae, a propósito: obliga a anotar la mejora en vez de dejar que pase
  // desapercibida — es el mismo trinquete que el censo de anclas de SCRUM-267.
  const c = cobertura(RAIZ);
  const SIN_CUBRIR_HOY = 20;
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

test('SCRUM-628 · el censo sigue señalando la vista que este fichero cubre', () => {
  // Si mañana otra vista pasa a ser la más grande sin cubrir, esto cae y avisa de que la elección
  // se tomó con un árbol distinto — en vez de quedarse apuntando a una decisión caducada.
  const mas = laQueMasPesaSinCubrir(cobertura(RAIZ));
  assert.equal(mas?.vista, 'jobDetailView.js',
    `🔴 la vista más grande sin cubrir ya no es \`jobDetailView.js\`, es \`${mas?.vista}\`. La `
    + 'elección de abajo se tomó sobre otro árbol: hay que rehacer el criterio, no reescribir el '
    + 'nombre a mano.');
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
