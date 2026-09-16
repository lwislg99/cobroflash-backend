// tests/scrum699-tabla-en-su-carril.test.mjs — SCRUM-699
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA TABLA DE CLIENTES TIENE QUE COLGAR DE SU `.table-scroll`, Y NO DEL `.data-card`.
//
// EL DEFECTO, tal cual estaba: `customersView` metía la tabla en el `.table-scroll` (l. 266) y
// más abajo hacía `outerCard.appendChild(table)` (l. 347). Insertar MUEVE —un nodo está en un
// sitio, no en dos—, así que el envoltorio de scroll se quedaba VACÍO y la tabla acababa fuera.
// Lo destapó SCRUM-697 de pasada, arreglando el banco de vistas para que insertar moviera.
//
// 🔴 POR QUÉ NO ERA COSMÉTICO, Y POR QUÉ EL SÍNTOMA NO ES EL QUE PARECE. Medido en navegador
// (Edge, 9 columnas encendidas, 7 clientes ordinarios) sobre 19 anchos de escritorio:
//
//   · la PÁGINA no desbordaba NUNCA — 0 px en los 19. `html, body { overflow-x: clip }`
//     (styles.css:359) lo impide por diseño, así que buscar «desbordamiento» no encuentra nada.
//   · lo que pasaba es que `.data-card { overflow: hidden }` (styles.css:1819) RECORTABA la
//     tabla, y sin envoltorio no quedaba NINGÚN carril por el que llegar a lo recortado.
//   · a partir de 1196 px de ventana se perdía «📊 Historial»; desde 1024 px hacia abajo, los
//     TRES botones de la fila —Editar, Portal, 📊 Historial— eran inalcanzables con el ratón.
//   · por debajo de 768 px no se notaba: ahí la propia `.table` es `display:block;
//     overflow-x:auto` (styles.css:1762), un arreglo de A6.6 que tapaba la mitad móvil del
//     problema y dejaba la de escritorio sin tapar.
//
// El arreglo es QUITAR la l. 347. No se añade nada: el sitio bueno ya estaba escrito en la 266.
//
// ⚠️ QUÉ VIGILA ESTE FICHERO, Y QUÉ NO. Vigila el DOM que produce la vista y el contrato CSS del
// envoltorio, porque son las DOS mitades: la tabla dentro de un envoltorio que no scrollea no
// arregla nada, y un envoltorio que scrollea sin la tabla dentro tampoco. Lo que NO vigila son
// los píxeles: eso se midió en navegador y vive en `docs/master/SCRUM-699.md`. Aquí no se
// escribe ningún ancho, porque un número de maquetación medido en una máquina no es un contrato.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Las clases de un nodo del banco, como lista. Tolera `className` vacío o ausente. */
const clasesDe = (n) => String((n && n.className) || '').split(/\s+/).filter(Boolean);
const tieneClase = (n, c) => clasesDe(n).includes(c);

/**
 * EL DETECTOR, en una función, para poder autoprobarlo. Sobre un árbol cualquiera devuelve qué
 * `.table-scroll` hay, qué `<table>` hay, y de quién cuelga cada tabla.
 *
 * Se mira por IDENTIDAD DEL PADRE (`parentNode`) y no por «¿hay una tabla dentro del contenedor?»:
 * eso último da verde con la tabla al lado del envoltorio, que es exactamente el defecto.
 */
function carriles(raizArbol) {
  const nodos = todos(raizArbol);
  const envoltorios = nodos.filter((n) => tieneClase(n, 'table-scroll'));
  const tablas = nodos.filter((n) => n.tagName === 'TABLE');
  return {
    nodos: nodos.length,
    envoltorios,
    tablas,
    fuera: tablas.filter((t) => !(t.parentNode && tieneClase(t.parentNode, 'table-scroll'))),
    vacios: envoltorios.filter((e) => (e.hijos || []).length === 0),
  };
}

// ═══ ① EL CONTROL POSITIVO Y EL SUELO, PRIMERO ═══════════════════════════════════════════

test('SCRUM-699 · CONTROL POSITIVO: la vista de clientes se monta, y trae tabla Y envoltorio', async () => {
  // 🔴 Va primero a propósito. «Ninguna tabla fuera de su envoltorio» es VERDAD en un contenedor
  // vacío y también en uno donde el montaje ha reventado. Sin este test, el de abajo no probaría
  // nada: estaría midiendo la nada y llamándolo verde.
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 NO SUPE MIRAR: la vista de clientes ni se monta: ${r.error}`);

  const c = carriles(r.contenedor);
  assert.ok(c.nodos > 20,
    `🔴 SUELO: la vista sólo produce ${c.nodos} nodos. Con tan poco, cualquier recuento de tablas `
    + 'fuera de su carril daría cero por no haber nada que contar.');
  assert.equal(c.tablas.length, 1,
    `🔴 SUELO: esperaba UNA tabla y hay ${c.tablas.length}. Si no hay tabla, el veredicto de abajo `
    + 'no dice nada del producto; si hay dos, este test está mirando otra pantalla.');
  assert.equal(c.envoltorios.length, 1,
    `🔴 SUELO: esperaba UN \`.table-scroll\` y hay ${c.envoltorios.length}. Si el envoltorio `
    + 'desapareciera, «la tabla no está fuera de él» pasaría a ser verdad por no existir ninguno.');
});

// ═══ ② EL DEFECTO ════════════════════════════════════════════════════════════════════════

test('SCRUM-699 · 🔴 la tabla de clientes cuelga de su `.table-scroll`, no del `.data-card`', async () => {
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 NO SUPE MIRAR: la vista no se monta: ${r.error}`);

  const c = carriles(r.contenedor);
  const padres = c.fuera.map((t) => clasesDe(t.parentNode).join('.') || (t.parentNode && t.parentNode.tagName) || '(sin padre)');
  assert.deepEqual(padres, [],
    '🔴 LA TABLA ESTÁ FUERA DE SU CARRIL DE SCROLL. Cuelga de: ' + padres.join(', ') + '.\n'
    + '   Insertar MUEVE: si después de `tableScroll.appendChild(table)` alguien hace\n'
    + '   `outerCard.appendChild(table)`, la tabla se va y el envoltorio queda vacío.\n'
    + '   Lo que cuesta, medido en navegador: `.data-card { overflow: hidden }` recorta la tabla y\n'
    + '   sin envoltorio no queda carril por el que llegar — desde 1196 px de ventana se pierde\n'
    + '   «📊 Historial», y a 1024 px los TRES botones de la fila son inalcanzables con el ratón.\n'
    + '   El sitio bueno ya está escrito en `customersView.js`: no hay que añadir nada, hay que\n'
    + '   NO volver a moverla.');
});

test('SCRUM-699 · el `.table-scroll` de clientes no se queda vacío', async () => {
  // La otra cara de lo mismo, y NO es redundante: la de arriba caería igual si alguien metiera la
  // tabla en un envoltorio NUEVO y dejara el viejo colgando vacío. Un envoltorio vacío es un
  // contrato que no cumple nadie, venga de donde venga.
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 NO SUPE MIRAR: la vista no se monta: ${r.error}`);

  const c = carriles(r.contenedor);
  assert.equal(c.vacios.length, 0,
    `🔴 hay ${c.vacios.length} \`.table-scroll\` sin un solo hijo. Un envoltorio de scroll vacío `
    + 'ocupa 0 px y no se ve, así que nada en pantalla delata que su contenido se fue a otro sitio.');
});

// ═══ ③ LA OTRA MITAD: EL CONTRATO CSS ════════════════════════════════════════════════════

test('SCRUM-699 · `.table-scroll` sigue declarando `overflow-x: auto`', () => {
  // Meter la tabla en un envoltorio que no scrollea no arregla nada: la recortaría igual, sólo
  // que un nivel más adentro. Las dos mitades o ninguna.
  //
  // El patrón tolera atributos y clases de más (SCRUM-553: nada de `>` pegados ni de selectores
  // exactos que dejan de encontrar la regla el día que alguien le añade otra clase al lado).
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  const reglas = [...css.matchAll(/(^|[},])\s*([^{}]*\.table-scroll[^{}]*)\{([^}]*)\}/g)]
    .map((m) => ({ selector: m[2].trim(), cuerpo: m[3] }));

  assert.ok(reglas.length > 0,
    '🔴 NO SUPE MIRAR: no encuentro NINGUNA regla de `.table-scroll` en styles.css. Si se ha '
    + 'renombrado la clase, este control dejó de mirar y su verde no vale nada.');

  const conScroll = reglas.filter((r) => /overflow-x\s*:\s*(auto|scroll)/.test(r.cuerpo));
  assert.ok(conScroll.length > 0,
    '🔴 ninguna regla de `.table-scroll` declara `overflow-x: auto|scroll`, así que el envoltorio '
    + 'ya no es un carril: recortaría la tabla igual que el `.data-card`.\n   Reglas encontradas: '
    + reglas.map((r) => r.selector).join(' · '));
});

// ═══ ④ EL CONTROL NEGATIVO: EL DETECTOR SABE DECIR QUE NO ════════════════════════════════

test('SCRUM-699 · 🔴 CONTROL NEGATIVO: el detector no marca lo que está bien', () => {
  // Sin esto, un detector que devolviera siempre «cero fuera» pasaría los tres tests de arriba y
  // el fichero entero sería un verde que no mira. Se le enseñan los dos árboles y tiene que
  // cambiar de respuesta.
  const banco = cargarDashboard(RAIZ);
  const arbol = (dentro) => {
    const card = banco.mk('div'); card.className = 'data-card';
    const wrap = banco.mk('div'); wrap.className = 'table-scroll';
    const tabla = banco.mk('table'); tabla.className = 'table';
    const barra = banco.mk('div'); barra.className = 'barra';
    card.appendChild(wrap);
    // El caso BUENO lleva hermanos alrededor a propósito: lo que decide es de quién CUELGA la
    // tabla, no si está sola. Un detector que mirase «¿el envoltorio es el último hijo?» o
    // «¿hay algo detrás de la tabla?» daría un falso positivo aquí, y aquí no hay defecto.
    if (dentro) wrap.appendChild(tabla); else card.appendChild(tabla);
    card.appendChild(barra);
    return card;
  };

  const bien = carriles(arbol(true));
  assert.equal(bien.fuera.length, 0, '🔴 el detector marca una tabla que SÍ está en su envoltorio: marca de más.');
  assert.equal(bien.vacios.length, 0, '🔴 el detector da por vacío un envoltorio que tiene la tabla dentro.');

  const mal = carriles(arbol(false));
  assert.equal(mal.fuera.length, 1, '🔴 el detector NO ve una tabla colgada del `.data-card`: no sabe decir que sí.');
  assert.equal(mal.vacios.length, 1, '🔴 el detector NO ve el envoltorio vacío que deja ese movimiento.');
});
