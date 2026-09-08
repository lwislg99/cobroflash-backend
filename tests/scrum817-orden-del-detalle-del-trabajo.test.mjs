// tests/scrum817-orden-del-detalle-del-trabajo.test.mjs — SCRUM-817
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UNA PANTALLA SE ORDENA POR LO QUE SE HACE EN ELLA, NO POR CÓMO ESTÁN GUARDADOS LOS CAMPOS.
//
// «Quién ejecuta este trabajo» era el ÚLTIMO bloque, dentro de «Datos» y detrás de las notas
// internas — debajo del NOMBRE del trabajo, que se escribe una vez y no se vuelve a mirar. Es la
// decisión que el jefe toma cada mañana. Sube a lo primero.
//
// 🔴 EL CONTROL QUE DECIDE SI UN REORDEN ES CORRECTO NO ES EL ASPECTO: SON LAS ACCIONES.
// Este proyecto ya estuvo a punto de pagarlo — sacar el selector de fecha de la lista de Trabajos
// habría borrado **la única forma de agendar un trabajo en todo el producto**, y sólo se vio
// porque alguien lo midió antes de ejecutar la decisión. Aquí se cuenta el inventario de acciones
// sobre el DOM MONTADO y se exige que no pierda ninguna.
//
// Medido al reordenar: **18 acciones antes y las mismas 18 después**, y los nodos pasan de 128 a
// 129 — el `div` de la sección nueva y nada más.
//
// ── ⛔ CERO RÓTULOS NUEVOS ───────────────────────────────────────────────────────────────
// El título del bloque que sube ya existía: lo pinta `construirSelectorAsignados`
// (`jobAsignados.js`, `titulo: 'Quién ejecuta este trabajo'`). Aquí sólo se le ha dado sección
// propia. No se ha inventado ni una palabra.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { inventario, perdidas } from './_inventario-detalle-trabajo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const EQUIPO = [{ id: 1, name: 'Javier P.' }, { id: 2, name: 'Javier Pereira' }];
const JOB = {
  id: 7, status: 'in_progress', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
  customer: { id: 3, name: 'IES Ramón y Cajal' }, asignados: [EQUIPO[0]], operario: null,
  albaranes: [], gastos: [], notes: 'una nota', quote: { currency: 'EUR' },
  direccion: 'C/ Mayor 1', totalAceptado: 480, totalCobrado: 0,
};
/** SUELO del encargo: sin albaranes, sin gastos, sin técnicos y sin dirección. */
const JOB_VACIO = {
  id: 8, status: 'in_progress', createdAt: '2026-09-01T09:00:00Z', titulo: '',
  customer: { id: 3, name: 'IES' }, asignados: [], operario: null,
  albaranes: [], gastos: [], notes: '', quote: { currency: 'EUR' }, direccion: null,
};

async function montar(job, equipo) {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    if (/\/admin\/team/.test(u)) return equipo;
    if (/\/admin\/merchant/.test(u)) return { name: 'Epipe' };
    if (/\/admin\/partes/.test(u)) return { partes: [] };
    if (/gastos/.test(u)) return [];
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la vista no monta (${r.error && r.error.message})`);
  return r;
}

/**
 * Dónde cae cada bloque en el árbol. El del selector se busca por su CLASE y no por un `h3`:
 * su título es un `div`, y buscarlo como encabezado lo habría dado por ausente — medido.
 */
const HITOS = [
  ['quién ejecuta', (n) => String(n.className || '').includes('job-asignados-titulo')],
  ['albaranes', (n) => String(n.textContent || '').trim() === 'Albaranes'],
  ['el trabajo · tipo', (n) => String(n.textContent || '').trim() === 'Tipo de trabajo'],
  ['el trabajo · datos', (n) => String(n.textContent || '').trim() === 'Datos'],
  ['notas internas', (n) => String(n.textContent || '').trim() === 'Notas internas'],
  ['gastos', (n) => String(n.textContent || '').trim() === 'Gastos de este trabajo'],
];

// ═══ 🔴 EL ORDEN ══════════════════════════════════════════════════════════════════════════

test('SCRUM-817 · 🔴 «quién ejecuta» va PRIMERO, y el resto en su orden', async () => {
  const r = await montar(JOB, EQUIPO);
  const nodos = todos(r.contenedor);

  const posiciones = HITOS.map(([nombre, casa]) => ({ nombre, i: nodos.findIndex(casa) }));
  const perdidos = posiciones.filter((p) => p.i < 0).map((p) => p.nombre);
  assert.deepEqual(perdidos, [],
    `🔴 SUELO: no encuentro ${perdidos.length} bloque(s) en el árbol montado. Sin ellos, «están en `
    + 'orden» significaría «no los he visto».');

  assert.deepEqual(posiciones.slice().sort((a, b) => a.i - b.i).map((p) => p.nombre),
    HITOS.map(([n]) => n),
    '🔴 el orden de la pantalla no es el decidido. «Quién ejecuta» es la decisión que el jefe toma '
    + 'cada mañana y tiene que ir la primera, no debajo del nombre del trabajo.');
});

// ═══ 🔴 EL CONTROL QUE DECIDE: NINGUNA FUNCIÓN PERDIDA ════════════════════════════════════

test('SCRUM-817 · 🔴 el reorden no pierde NI UNA acción', async () => {
  const r = await montar(JOB, EQUIPO);
  const hoy = inventario(r.contenedor);

  // Las 18 de la medición previa al reorden, una por una. No es un número: es la lista, porque un
  // número deja pasar «he perdido una y he ganado otra».
  const ANTES = [
    'A:Abrir en mapa',
    'BUTTON', 'BUTTON',
    'BUTTON:+ Nuevo albarán', 'BUTTON:+ Nuevo albarán',
    'BUTTON:Cambiar', 'BUTTON:Cancelar',
    'BUTTON:Consolidar seleccionados',
    'BUTTON:Facturar el trabajo',
    'BUTTON:Trabajos',
    'BUTTON:🧾 Consolidar en factura',
    'INPUT', 'INPUT', 'INPUT',
    'TEXTAREA',
    'aria-label=Javier P.', 'aria-label=Javier Pereira',
    'data-abrir-parte=1',
  ].sort();

  assert.deepEqual(perdidas(ANTES, hoy), [],
    '🔴 EL REORDEN HA PERDIDO UNA FUNCIÓN. Reordenar no puede quitar nada: si un control ya no '
    + 'está, se ha borrado una manera de hacer algo y puede ser la única que había.');
});

// ═══ 🔴 EL SUELO DEL ENCARGO: UN TRABAJO SIN NADA ═════════════════════════════════════════

test('SCRUM-817 · 🔴 sin albaranes, sin gastos, sin técnicos y sin dirección: nada en blanco', async () => {
  const r = await montar(JOB_VACIO, []);
  const nodos = todos(r.contenedor);
  const texto = nodos.map((n) => String(n.textContent || '')).join(' ');

  assert.ok(r.nodos > 40,
    `🔴 con el trabajo vacío sólo se pintan ${r.nodos} nodos: la pantalla se está quedando en `
    + 'blanco en vez de decir que no hay nada.');

  // 🔴 Cero marcadores en el DOM. `jobAsignados.js` DECLARA uno (`MARCA_ASIGNADOS`) pero sólo lo
  // exporta — nunca lo pinta. Se comprueba sobre el árbol, que es donde importa.
  const marcadores = (texto.match(/\[PENDIENTE microcopy oficial\]/g) || []).length;
  assert.equal(marcadores, 0,
    `🔴 ${marcadores} marcador(es) «[PENDIENTE microcopy oficial]» a la vista del profesional.`);

  // Y los bloques siguen ahí diciendo lo suyo, no desaparecidos.
  for (const [nombre, casa] of HITOS) {
    if (nombre === 'quién ejecuta') continue; // sin equipo, el selector se declara y no se pinta
    assert.ok(nodos.some(casa), `🔴 el bloque «${nombre}» desaparece con el trabajo vacío`);
  }
});

// ═══ 📌 LA PREMISA QUE NO SE PUEDE MOVER ══════════════════════════════════════════════════

test('SCRUM-817 · 📌 la casilla de precios sigue pegada a «+ Nuevo albarán»', async () => {
  // 🔴 «Incluir precios en el parte» NO gobierna el parte de trabajo: gobierna el `modoValoracion`
  // del ALBARÁN, y se lee EN EL INSTANTE de pulsar «+ Nuevo albarán». La palabra «parte» ahí es
  // herencia de cuando el albarán era lo único que había.
  //
  // Separarla de ese botón cambia lo que parece significar, y llevarla al bloque del parte la
  // ataría a un documento que no gobierna. Este test existe para que el reorden de la sesión 4
  // no se la lleve por el nombre.
  const fs = await import('node:fs');
  const { leerFuente } = await import('./_guard-texto.mjs');
  const src = leerFuente(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'),
    { ancla: 'valoradoCheck' });

  const iBoton = src.indexOf('newAlbRow.appendChild(newAlbBtn)');
  const iCasilla = src.indexOf('newAlbRow.appendChild(valoradoLabel)');
  assert.ok(iBoton >= 0 && iCasilla >= 0,
    '🔴 SUELO: no encuentro el botón o la casilla en la misma barra. Si se han movido, hay que '
    + 'releer POR QUÉ estaban juntos antes de dar por bueno el sitio nuevo.');
  assert.ok(iCasilla > iBoton,
    '🔴 la casilla se ha separado de «+ Nuevo albarán». Su valor se lee al crear el albarán: '
    + 'lejos de ese botón deja de leerse como el modo del albarán que se va a crear.');
  assert.ok(fs.existsSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js')));
});
