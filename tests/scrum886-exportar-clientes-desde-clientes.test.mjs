// SCRUM-886 · LA EXPORTACIÓN DE CLIENTES, TAMBIÉN DESDE LA PANTALLA DE CLIENTES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO MEDIDO ANTES DE TOCAR (16-sep-2026, origin/main 7fad9857)
//
// · La exportación es `GET /admin/exports/customers.csv`, montada con `requireRole('admin')`:
//   sólo `userRole === 'admin'`. Un técnico recibe 403.
// · Sólo se enlaza desde Informes (`reportsView.js`, «⬇ Clientes CSV», sin rango de fechas).
// · La lista de Clientes no tiene ninguna entrada.
//
// El GO del fundador cubre SOLO esta entrada: ni ruta nueva, ni formato nuevo, ni más gente que
// pueda exportar. Por eso el test compara la entrada nueva CONTRA la de Informes —mismo rótulo,
// mismo destino— en vez de contra un literal escrito aquí: si alguien cambiara una de las dos,
// dejarían de ser la misma exportación y esto lo dice.
//
// ⚠️ HALLAZGO QUE NO SE ARREGLA AQUÍ: Informes NO se oculta al técnico (`app.js` sólo le oculta
// Planes, Equipo, Descargar datos, Configuración y Gastos), así que hoy él ve «⬇ Clientes CSV»
// allí y la ruta le da 403. El encargo dice que Informes sigue igual; se reporta.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = '/admin/exports/customers.csv';

/** El rótulo tal como se pinta: Informes lo pone con `innerHTML`, sin marcado dentro. */
const rotulo = (n) => String(n._texto || n._html || '').trim();

/** Las entradas a la exportación de clientes que hay en una vista montada. */
const entradas = (r) => todos(r.contenedor).filter((n) => String(n.href || '').split('?')[0] === RUTA);

/** Monta una vista con un rol. EL SUELO: si no llega a montarse, no se ha mirado nada. */
async function montar(vista, rol, senal) {
  const banco = cargarDashboard(RAIZ, { datos: {}, rol });
  // Igual que SCRUM-584: el mini-DOM no trae `form.reset`, y la vista de clientes lo usa.
  const crear = banco.ctx.document.createElement;
  banco.ctx.document.createElement = function (tag) {
    const n = crear.call(this, tag);
    if (String(tag).toLowerCase() === 'form' && typeof n.reset !== 'function') n.reset = function () {};
    return n;
  };
  const r = await pintarVista(banco, vista);
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: \`${vista}\` (${rol}) revienta al montarse: ${r.error && r.error.message}`);
  assert.ok(todos(r.contenedor).some(senal),
    `🔴 NO PUDE MIRAR: \`${vista}\` (${rol}) se montó pero no pinta su cabecera. Lo de abajo no probaría nada.`);
  return r;
}

// Señales de que la cabecera de cada vista está en el DOM (independientes de lo que se prueba).
const cabeceraDeClientes = (n) => rotulo(n) === '⬆ Importar CSV';
const cabeceraDeInformes = (n) => String(n.href || '').startsWith('/admin/exports/invoices.csv');

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ROJO · la lista de Clientes tiene la entrada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-886 · 🔴 el admin tiene en Clientes UNA entrada a la exportación de clientes', async () => {
  const r = await montar('renderCustomersView', 'admin', cabeceraDeClientes);
  const e = entradas(r);
  assert.equal(e.length, 1, `🔴 la lista de Clientes tiene ${e.length} entradas a ${RUTA}; se espera una.`);
  assert.equal(e[0].tagName, 'A', '🔴 la entrada no es un enlace: ya no descarga como la de Informes.');
});

test('SCRUM-886 · 🔴 es la MISMA exportación que la de Informes: mismo rótulo, mismo destino', async () => {
  const informes = entradas(await montar('renderReportsView', 'admin', cabeceraDeInformes));
  const clientes = entradas(await montar('renderCustomersView', 'admin', cabeceraDeClientes));
  assert.equal(informes.length, 1, `🔴 Informes tiene ${informes.length} entradas a ${RUTA}: ya no es lo de hoy.`);
  assert.equal(clientes.length, 1, `🔴 Clientes tiene ${clientes.length} entradas a ${RUTA}.`);
  assert.equal(clientes[0].href, informes[0].href,
    '🔴 los dos sitios apuntan a URLs distintas: el fichero descargado ya no sería el mismo.');
  assert.equal(rotulo(clientes[0]), rotulo(informes[0]),
    '🔴 el rótulo de Clientes no es el literal de Informes. Uno nuevo se propone y se PARA.');
  assert.equal(clientes[0].className, informes[0].className, '🔴 no es el mismo botón que el de Informes.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// POSITIVO · Informes sigue igual
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-886 · la entrada de Informes sigue como estaba', async () => {
  const e = entradas(await montar('renderReportsView', 'admin', cabeceraDeInformes));
  assert.equal(e.length, 1);
  assert.equal(e[0].href, RUTA, '🔴 la entrada de Informes cambió de destino.');
  assert.equal(rotulo(e[0]), '⬇ Clientes CSV', '🔴 el rótulo de Informes cambió.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// NEGATIVO · quien no puede exportar no la ve, y la ruta le sigue diciendo que no
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-886 · un técnico NO ve la entrada en Clientes', async () => {
  const r = await montar('renderCustomersView', 'tecnico', cabeceraDeClientes);
  // 🔴 SE COMPARA UNA CUENTA, NUNCA LOS NODOS. Con `deepEqual(entradas(r), [])` el rojo inyectado
  // no llegó a salir: al fallar, `assert` intenta pintar el nodo del banco —un grafo circular con
  // su padre y su registro— y el proceso murió sin memoria a los 128 s. Parecía un rojo y era un
  // cuelgue.
  const n = entradas(r).length;
  assert.equal(n, 0, `🔴 un técnico ve ${n} entrada(s) a la exportación de clientes: la ruta le daría 403.`);
});

test('SCRUM-886 · la ruta de exportación sigue siendo sólo del admin (403 al técnico)', async () => {
  await import('../dist/app.js'); // registra los montajes
  const { getAdminMounts } = await import('../dist/core/http/adminMounts.js');
  const montaje = getAdminMounts().find((m) => m.prefix === '/admin/exports');
  assert.ok(montaje, '🔴 NO PUDE MIRAR: no encuentro el montaje de /admin/exports.');
  const ruta = montaje.router.stack.find((l) => l.route && l.route.path === '/customers.csv' && l.route.methods.get);
  assert.ok(ruta, '🔴 NO PUDE MIRAR: el montaje ya no tiene GET /customers.csv.');

  const puertas = montaje.gates.filter((g) => g && g.__requiredRole);
  assert.deepEqual(puertas.map((g) => g.__requiredRole), ['admin'], '🔴 cambió quién puede exportar.');

  const pasar = (userRole) => {
    let status = null;
    let siguio = false;
    const res = { status(c) { status = c; return this; }, json() { return this; } };
    puertas[0]({ userRole }, res, () => { siguio = true; });
    return { status, siguio };
  };
  assert.deepEqual(pasar('tecnico'), { status: 403, siguio: false }, '🔴 la ruta deja pasar al técnico.');
  // El control que distingue «dice que no a todos» de «dice que no al que toca».
  assert.deepEqual(pasar('admin'), { status: null, siguio: true }, '🔴 la ruta no deja pasar ni al admin.');
});
