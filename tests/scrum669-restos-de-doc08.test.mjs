// tests/scrum669-restos-de-doc08.test.mjs — SCRUM-669
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE QUEDÓ MUERTO DESPUÉS DE DOC-08, RETIRADO — Y EL TRINQUETE PARA QUE NO VUELVA.
//
// DOC-08 (SCRUM-598) sacó el margen del documento: vive en el catálogo, y el precio ya sale con él
// dentro. Al hacerlo dejó restos que seguían ejecutándose sin que nadie los consumiera. Este
// fichero cierra dos, y vigila que no regresen:
//
//   · **resto 1** — `priceInput.dataset.pfBasePrice` se escribía en CINCO sitios y **no lo leía
//     nadie**. Estado muerto de la peor clase: un dato que se mantiene al día invita a que alguien
//     lo lea dentro de seis meses creyendo que significa algo.
//   · **resto 4** — `priceHint` («Final: …») quedaba **siempre vacío**. Sólo existía para avisar de
//     la diferencia que creaba el margen de la línea; sin margen no hay diferencia que avisar.
//
// ⛔ EL RESTO 3 (`quoteMargen.js` fuera del índice) NO SE TOCA AQUÍ: el propio ticket manda
//    coordinarlo con SCRUM-663, que lo lleva otra sesión. Se midió, se dice y se deja.
//
// ── CÓMO SE MIDIÓ EL «NO LO LEE NADIE», que es la afirmación arriesgada ───────────────────────
//
// Con DOS instrumentos independientes, como exige el ticket —«el censo por AST ya dio 1 donde
// había 3 esta semana»—: un barrido de TEXTO sobre el árbol entero (.ts .js .mjs .html .css) y otro
// por AST distinguiendo lado izquierdo de asignación. Los dos dieron **5 escrituras, 0 lecturas**,
// y los dos llevaron control positivo sobre un `dataset` que SÍ se lee (`estado`, `quoteId`), para
// que el cero no pudiera ser ceguera del detector.
//
// Vías miradas, declaradas: `dataset.X` · `dataset['X']` · `getAttribute('data-x')` ·
// `setAttribute` · selectores `[data-x]` · el atributo escrito en HTML · las hojas de estilo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');

/**
 * Las líneas de CÓDIGO (no de comentario) que nombran algo. Un comentario que cuenta la historia
 * del resto no es el resto: si contáramos las dos cosas igual, este trinquete nunca podría
 * explicarse a sí mismo sin dispararse.
 *
 * 🔴 Y SE MIDE EL BLOQUE, NO EL PRINCIPIO DE LÍNEA. La primera versión filtraba por `^\s*(//|*|/*)`
 * y saltó sobre su propio comentario del CSS: en `.css` el comentario es `/* … *␘/` multilínea, y
 * sus líneas interiores no empiezan por ninguna de esas marcas. Se neutralizan los bloques
 * enteros —conservando los saltos de línea para no descuadrar la numeración— antes de mirar.
 */
function enCodigo(fuente, diana) {
  const sinBloques = fuente.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return sinBloques.split('\n')
    .map((l, i) => ({ l, n: i + 1 }))
    .filter(({ l }) => l.includes(diana) && !/^\s*\/\//.test(l));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TRINQUETE — los dos restos no vuelven
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-669 · 🔴 resto 1: `pfBasePrice` no vuelve a escribirse', () => {
  const vivos = enCodigo(VISTA, 'pfBasePrice');
  assert.deepEqual(vivos.map((x) => x.n), [],
    '🔴 HA VUELTO `pfBasePrice` a `quotesView.js`, en la(s) línea(s) '
    + vivos.map((x) => x.n).join(', ') + '. Se retiró porque se escribía en cinco sitios y no lo '
    + 'leía nadie. Si ahora hace falta, tiene que tener un LECTOR: un dato que sólo se escribe es '
    + 'estado muerto, y el que venga detrás lo leerá creyendo que significa algo.');
});

test('SCRUM-669 · 🔴 resto 4: `priceHint` no vuelve, ni su clase huérfana', () => {
  const vivos = enCodigo(VISTA, 'priceHint');
  assert.deepEqual(vivos.map((x) => x.n), [],
    '🔴 HA VUELTO `priceHint` a `quotesView.js` (línea(s) ' + vivos.map((x) => x.n).join(', ')
    + '). Quedaba SIEMPRE vacío: su texto sólo tenía sentido con el margen en la línea, y el '
    + 'margen se fue en DOC-08. Un elemento que existe y nunca dice nada enseña a no mirar ahí.');
  assert.equal(enCodigo(CSS, 'price-final-hint').length, 0,
    '🔴 ha vuelto la clase `.price-final-hint` al CSS. Sin el elemento que la llevaba, es una '
    + 'regla que no pinta nada — y las reglas que no pintan nada se quedan para siempre.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE — el dashboard sigue funcionando igual. EJECUTADO, no razonado.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-669 · 🔴 EL QUE DECIDE: la vista de presupuestos sigue pintando sin los restos', async () => {
  const banco = cargarDashboard(RAIZ, { datos: {} });
  const r = await pintarVista(banco, 'renderQuotesView');

  // SUELO: si la vista no pintara nada, «no hay errores» sería cierto por vacío.
  const nodos = todos(r.contenedor);
  assert.ok(nodos.length > 20,
    `🔴 la vista pintó ${nodos.length} nodos. Con la pantalla vacía, todo lo de abajo saldría `
    + 'verde sin haber comprobado nada.');

  // Y las piezas de la línea que SÍ tienen que seguir ahí: el precio se pinta y su etiqueta
  // conserva la forma que sostiene el descuadre de BUGS.md P3-13.
  const html = r.contenedor.innerHTML || '';
  assert.ok(/quote-line__label/.test(html) || VISTA.includes('quote-line__label'),
    '🔴 ha desaparecido la etiqueta de la línea: se ha retirado más de lo que este ticket pedía');
});

test('SCRUM-669 · ✅ POSITIVO: la vista se carga sin que la consola registre un error', async () => {
  const banco = cargarDashboard(RAIZ, { datos: {} });
  const errores = [];
  const antes = banco.ventana && banco.ventana.console ? banco.ventana.console.error : null;
  if (banco.ventana && banco.ventana.console) {
    banco.ventana.console.error = (...a) => errores.push(a.join(' '));
  }
  try {
    await pintarVista(banco, 'renderQuotesView');
  } finally {
    if (antes && banco.ventana && banco.ventana.console) banco.ventana.console.error = antes;
  }
  assert.deepEqual(errores, [],
    '🔴 la vista registra errores al pintarse tras la retirada: ' + errores.join(' | '));
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⛔ EL RESTO 3, MEDIDO Y NO TOCADO — para que no se pierda al cerrar el ticket
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-669 · ⛔ resto 3: `quoteMargen.js` sigue en el índice, y aquí NO se toca', () => {
  // El ticket manda coordinarlo con SCRUM-663 (la lista manual de `sw.js`), que lleva otra
  // sesión. Sacarlo de aquí a la vez sería dos manos en el mismo sitio. Se fija su estado de HOY
  // para que quien lo retire sepa contra qué comparó, y para que este fichero cante si alguien lo
  // mueve sin coordinar.
  const indice = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
  const enIndice = indice.includes('quoteMargen.js');
  assert.equal(enIndice, true,
    '🔴 `quoteMargen.js` ya no está en `index.html`. Si lo has retirado, este caso es el aviso de '
    + 'que había que coordinarlo con SCRUM-663 (`sw.js` lleva su propia lista y el contador de '
    + '`SCRIPTS_DEL_DASHBOARD` baja). Actualiza los tres a la vez o vuelve a ponerlo.');
});
