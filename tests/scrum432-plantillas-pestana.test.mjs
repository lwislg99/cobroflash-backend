// tests/scrum432-plantillas-pestana.test.mjs — SCRUM-432
//
// `PLANTILLAS` ES UNA PESTAÑA DE PRESUPUESTOS, Y HACE LO MISMO QUE HACÍA LA ENTRADA DE LA BARRA.
//
// ── POR QUÉ SALE DE LA BARRA ────────────────────────────────────────────────────────────────
// Las entradas de VENTA son **estados por los que pasa el dinero** — presupuesto, albarán,
// factura—, y `templates` nunca fue uno: **no hay ningún trabajo «en plantillas»**. Era una
// herramienta del paso 1, y su sitio es donde se usa.
//
// ── LAS DOS MITADES VAN JUNTAS, Y ESO ES LO QUE VIGILA ESTE FICHERO ─────────────────────────
// Entre «quitar la entrada» y «construir la pestaña» hay un estado en el que la vista **no es
// alcanzable desde ningún sitio**, y ese estado no puede llegar a `main`. El control positivo —que
// `templates` siga teniendo camino— vive además en `scrum433-dispatch-sin-camino`, derivado y desde
// fuera. Aquí se comprueba lo que aquél no puede ver: que la pestaña **hace lo mismo** que hacía la
// entrada, y que `#templates` no se ha quedado muerto.
//
// Sin gate: lee los ficheros. Vanilla, sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (p) => {
  try {
    return fs.readFileSync(path.join(RAIZ, p), 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}). «Está» y «no supe mirar» son el mismo verde.`);
  }
};

test('SCRUM-432 · SUELO: se está leyendo la pantalla de Presupuestos de verdad', () => {
  const s = leer('public/dashboard/js/quotesListView.js');
  assert.ok(s.length > 8000, `🔴 el fichero tiene ${s.length} caracteres: no es la pantalla de Presupuestos`);
  assert.match(s, /function renderQuotesListView/, '🔴 esto no es el listado de presupuestos');
});

test('SCRUM-432 · las dos pestañas existen con su microcopy APROBADA, literal', () => {
  // Regla 30: «Historial» y «Plantillas» salen del diseño de B y están aprobadas. No se
  // parafrasean: son el vocabulario con el que el profesional va a pensar la pantalla.
  const s = leer('public/dashboard/js/quotesListView.js');
  for (const rotulo of ['Historial', 'Plantillas']) {
    assert.ok(
      new RegExp(`rotulo:\\s*'${rotulo}'`).test(s),
      `🔴 falta la pestaña «${rotulo}» o su rótulo se ha cambiado. La microcopy está aprobada y no `
      + 'se reescribe (regla 30).');
  }
});

test('SCRUM-432 · la pestaña hace LO MISMO que hacía la entrada de la barra', () => {
  // 🔴 EL TEST DEL TICKET. «Mover» no es «rehacer»: si la pestaña pintara otra cosa, no habríamos
  // movido Plantillas — habríamos construido una pantalla nueva y perdido la vieja.
  const s = leer('public/dashboard/js/quotesListView.js');
  assert.match(s, /renderTemplatesView\(cuerpo\)/,
    '🔴 la pestaña `Plantillas` no llama a `renderTemplatesView`: está pintando otra cosa. El mismo '
    + 'dato y la misma acción que antes, o esto no es un movimiento.');
  assert.match(s, /renderQuotesListView\(cuerpo\)/,
    '🔴 la pestaña `Historial` no pinta el listado de presupuestos que ya existía');
});

test('SCRUM-432 · `#templates` sigue navegando y abre Presupuestos en su pestaña', () => {
  // Hay marcadores vivos apuntando a `#templates`. Caer donde el usuario venía buscando es mejor
  // que un 404 — mismo criterio que SCRUM-136 usó con `operarios`, y ser coherentes con esa
  // decisión vale más que ahorrarse un `case`.
  const app = leer('public/dashboard/js/app.js');
  assert.match(app, /case 'templates':/,
    '🔴 se ha borrado el `case \'templates\'`: `#templates` pasa a 404 y los marcadores vivos se '
    + 'rompen. La entrada sale de la barra; la RUTA se queda.');
  assert.match(app, /renderPresupuestos\(viewContainer, 'plantillas'\)/,
    '🔴 `#templates` ya no abre Presupuestos con la pestaña Plantillas activa');
  assert.match(app, /renderPresupuestos\(viewContainer, 'historial'\)/,
    '🔴 `quotes-list` ya no abre Presupuestos con la pestaña Historial activa');
});

test('SCRUM-432 · entrar por `#templates` deja el menú marcando Presupuestos', () => {
  // Sin esto, entrar por el marcador dejaría la barra sin nada encendido y al profesional sin saber
  // en qué sección está. El defecto no da error: solo desorienta, que es peor de detectar.
  const app = leer('public/dashboard/js/app.js');
  assert.match(app, /view === 'templates' \? 'quotes-list'/,
    '🔴 `templates` no se traduce a `quotes-list` en el menú activo: la barra se queda apagada');
});

test('SCRUM-432 · la entrada de la barra ya no está, y no queda enlace roto', () => {
  const html = leer('public/dashboard/index.html');
  assert.ok(!/data-view="templates"/.test(html),
    '🔴 `Plantillas` sigue siendo entrada de la barra: el movimiento no está hecho.');
  // El otro lado del mismo hecho, y hace falta: sin él, borrar la barra entera pasaría este test.
  assert.match(html, /data-view="quotes-list"/,
    '🔴 tampoco está `Presupuestos`: no se ha movido una entrada, se ha perdido la sección');
});

test('SCRUM-432 · el componente de pestañas usa el lenguaje visual que YA existía', () => {
  // Componente nuevo (`.tabs` no estaba en el inventario AB3) y se declara en la entrada de máster.
  // Lo que NO puede traer es lenguaje visual nuevo: un color o un radio inventados aquí serían un
  // rediseño encubierto entrando por una pestaña.
  const css = leer('public/dashboard/css/styles.css');
  const i = css.indexOf('/* ── Pestañas de sección — SCRUM-432');
  assert.ok(i > 0, '🔴 no se encuentra el bloque del componente `.tabs`');
  const bloque = css.slice(i);
  const hex = [...bloque.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  assert.deepEqual(hex, [],
    '🔴 el componente trae colores literales: ' + hex.join(', ')
    + '\n\n  Los colores salen de los tokens (DESIGN.md es la única fuente). Un hex aquí es lenguaje\n'
    + '  visual nuevo, y eso es rediseño encubierto.');
  assert.match(bloque, /var\(--green-600\)/, '🔴 el activo no usa el verde de marca de los tokens');
  assert.match(bloque, /var\(--neutral-200\)/, '🔴 la línea del grupo no sale de los tokens');
});
