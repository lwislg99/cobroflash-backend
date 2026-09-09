// tests/scrum819-el-menu-deja-rastro.test.mjs — SCRUM-819
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// NAVEGAR POR EL MENÚ NO DEJABA RASTRO. Y ERAN DOS DEFECTOS, NO UNO.
//
// Medido en un navegador de verdad (`npm run guard:rastro-del-menu`), pulsando los 17 destinos:
//
//   ANTES   hash coherente 0/17 · entradas de historial 0 · «atrás» → se sale de la aplicación
//   AHORA   hash coherente 17/17 · entradas de historial 17 · «atrás» → informes → productos → clientes
//
//   ① el manejador del menú llamaba a `renderView` CRUDO, que pinta y no toca la URL;
//   ② el envoltorio usaba `replaceState`, que **no crea entrada de historial**. Arreglar sólo ①
//      habría dejado la URL correcta y el botón de atrás igual de roto.
//
// ── 🔴 POR QUÉ ESTE FICHERO NO NAVEGA, Y EL GUARD SÍ ─────────────────────────────────────
// El banco de vistas no puede contestar esta pregunta, y no por falta de ganas: **navega poniendo
// el hash él mismo**, así que en su mundo hash y vista coinciden por construcción. Medido sobre
// su contexto: `history` NO EXISTE, `dispatchEvent` NO EXISTE y hay **0** `.nav-item[data-view]`
// —el banco carga los SCRIPTS del índice, no su marcado—. No se puede pulsar un menú que no está.
//
// Así que aquí se fija lo que sí es estructural y barato: **las dos formas**, por AST. Lo que
// necesita navegador vive en `guard:rastro-del-menu`, que entra por `guards:visuales`.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = 'public/dashboard/js/app.js';

/** El código de `app.js`, sin comentarios: aquí se nombran las dos formas prohibidas. */
const codigo = () => leerFuente(path.join(RAIZ, APP), { ancla: 'renderAppView' });

// ═══ 🔴 SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-819 · 🔴 SUELO: el menú declara los 17 destinos y el guard los exige', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
  const destinos = [...new Set([...html.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]))];
  assert.equal(destinos.length, 17,
    `🔴 el menú tiene ${destinos.length} destinos y no 17. Si han cambiado, el guard de navegador `
    + 'lleva ese número como suelo y hay que remedirlo — no bajarlo.');

  const guard = fs.readFileSync(path.join(RAIZ, 'scripts/guard-rastro-del-menu.mjs'), 'utf8');
  assert.match(guard, /MINIMO_DESTINOS = 17/,
    '🔴 el guard de navegador ha perdido su suelo. Sin él, «0 incoherencias» sobre tres botones se '
    + 'leería como que todo está bien.');
});

// ═══ 🔴 ① EL MENÚ PASA POR EL ENVOLTORIO ══════════════════════════════════════════════════

test('SCRUM-819 · 🔴 el manejador del menú NO llama a `renderView` crudo', () => {
  const src = codigo();
  // ⚠️ El primer `.nav-item[data-view]` del fichero es el de `setActiveMenu`, que pinta la clase
  // activa y no navega. Se busca el que VA SEGUIDO de un `addEventListener` — el que navega.
  let i = -1;
  for (let k = src.indexOf('.nav-item[data-view]'); k >= 0; k = src.indexOf('.nav-item[data-view]', k + 1)) {
    if (src.slice(k, k + 200).includes('addEventListener')) { i = k; break; }
  }
  assert.ok(i > 0, '🔴 SUELO: no encuentro el manejador de CLICK del menú; lo de abajo no probaría nada');
  // ⚠️ Y SE ACOTA AL `forEach`, no a 400 caracteres a ojo: una ventana fija se comía el
  // `renderView(window.appState.view || 'home')` del arranque — que es LEGÍTIMO, ahí no hay menú
  // que haya pulsado nadie— y el guard salía rojo contra código correcto.
  const fin = src.indexOf('});', i);
  assert.ok(fin > i, '🔴 SUELO: no encuentro el final del manejador');
  const bloque = src.slice(i, fin);

  assert.match(bloque, /renderAppView\(/,
    '🔴 el menú ha vuelto a navegar sin pasar por el envoltorio. `renderView` pinta la vista y NO '
    + 'toca la URL: medido, 0 de 17 destinos dejaban rastro y F5 llevaba a otra pantalla.');
  assert.doesNotMatch(bloque, /[^.\w]renderView\(/,
    '🔴 sigue habiendo una llamada a `renderView` crudo en el manejador del menú.');
});

// ═══ 🔴 ② EL ENVOLTORIO APILA ═════════════════════════════════════════════════════════════

test('SCRUM-819 · 🔴 el envoltorio APILA las vistas que el hash sabe restaurar', () => {
  const src = codigo();
  const i = src.indexOf('window.renderAppView = function');
  assert.ok(i > 0, '🔴 SUELO: no encuentro el envoltorio');
  const bloque = src.slice(i, i + 700);

  assert.match(bloque, /pushState/,
    '🔴 el envoltorio ha vuelto a usar sólo `replaceState`, que no crea entrada de historial: '
    + '17 clics = 0 entradas y «atrás» saca de la aplicación.');
  // 🔴 Y NO APILA TODO: sólo lo que el router sabría volver a pintar. Apilar una vista que no
  // sabe restaurarse daría un «atrás» que cambia la URL y no la pantalla — la incoherencia, del revés.
  //
  // 📌 SCRUM-832 CAMBIÓ LA PREMISA, y por eso este bloque se reescribió. Aquí ponía que las vistas
  // de DETALLE «necesitan un id que el hash no lleva». Ya lo lleva: el hash pasó a ser
  // `#quotes-detail/123`. Así que lo que no se apila ya no son las fichas — es lo DESCONOCIDO.
  // La propiedad no ha cambiado; lo que cambió es cuánto entra dentro de ella.
  assert.match(bloque, /HASH_VIEWS\.includes\(view\)/,
    '🔴 el envoltorio apila vistas que el hash no sabe restaurar, y eso da un «atrás» que cambia '
    + 'la URL sin cambiar la pantalla.');
  assert.match(bloque, /DETALLES\[view\]/,
    '🔴 el envoltorio ha dejado de apilar las FICHAS. Desde SCRUM-832 su hash lleva el id y el '
    + 'router sabe restaurarlas: si no se apilan, abrir un presupuesto vuelve a borrar la lista '
    + 'del historial y el botón atrás vuelve a sacarte de la aplicación.');
  // El destino se compara ENTERO —hash con id incluido—, no sólo la clave de vista: así ir del
  // presupuesto 7 al 9 sí apila (son dos pantallas), y pulsar dos veces el mismo botón no.
  assert.match(bloque, /actual !== \w+/,
    '🔴 se apila navegar al sitio donde ya estás: pulsar dos veces el mismo botón del menú '
    + 'obligaría a dar dos veces atrás.');
});

// ═══ 📌 EL LÍMITE DEL BANCO, FIJADO ═══════════════════════════════════════════════════════

test('SCRUM-819 · 📌 el banco de vistas NO puede contestar esta pregunta, y se dice por qué', async () => {
  // Si algún día el banco gana `history` y marcado del menú, este test cae — y ENTONCES hay que
  // releer si la pregunta se le puede hacer ya. Cae para que alguien lo mire, no para prohibirlo.
  const { cargarDashboard } = await import('./_banco-vistas.mjs');
  const ctx = cargarDashboard(RAIZ).ctx;

  assert.equal(ctx.history, undefined,
    '📌 el banco ya tiene `history`. Releer SCRUM-819: la mitad de «¿deja rastro?» puede que ya se '
    + 'le pueda preguntar — pero «¿sirve el botón de atrás?» sigue siendo del navegador, y un '
    + '`history.back()` de mentira contesta lo que el banco haya decidido, no lo que hace Chrome.');
  assert.equal(ctx.document.querySelectorAll('.nav-item[data-view]').length, 0,
    '📌 el banco ya tiene el menú en su DOM. Releer SCRUM-819.');
});
