// tests/scrum1725j-lista-lavado.test.mjs — SCRUM-1725j (el lavado de la lista de Trabajos, S4)
//
// LO QUE EL LAVADO CAMBIA EN EL DOM, SIN NAVEGADOR. Firmado en SCRUM-1725 c.22098 (P3 y P4, por la
// delegación de SCRUM-1656 c.21978) y c.22103; veredicto del fundador en c.22095.
//   ① UNA tarjeta, como Presupuestos, Albaranes y Facturas: la cabecera (con «Nuevo trabajo» dentro),
//     los filtros y la lista cuelgan de UNA `.data-card`; las dos cifras se quedan encima, fuera.
//   ② P3 · sin importe de referencia, la celda dice «Sin importe» y nada más (la frase «no hay
//     presupuesto aceptado» vive en la ficha).
//   ③ P4 · EN CURSO lleva tres controles —«Abrir parte» · «Ver detalle» · «⋯»— y el albarán baja al
//     «⋯», PRIMERO y con su identidad (`data-accion="escalera"`).
//
// Lo que NO fija este fichero, porque no existe sin hoja de estilos: cuánto mide la fila, en qué
// renglón cae cada cosa y si el centro de la fila navega. Eso lo miden, en navegador,
// `docs/master/evidencias/SCRUM-1725/c1725j-medir-filas.mjs` y `c1725j-clic-en-fila.mjs`. Y el orden
// fijo [el paso] · «Ver detalle» · «⋯» lo fija `tests/scrum1739-una-rellena-por-tarjeta.test.mjs`.
//
// Las mismas mutaciones, vistas en rojo ADEMÁS en los dos guards de navegador (guard-917 B.5 y C.2,
// guard:escalera-por-estado ①): `docs/master/evidencias/SCRUM-1725/c1725j-exigencias-mutacion.mjs`.
//
// Monta la vista REAL en el banco, con cuatro Trabajos fabricados sobre el del censo.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { datosDelCenso } from '../scripts/_datos-del-censo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const clase = (n) => String((n && n.className) || '');
const tiene = (n, c) => new RegExp(`(^|\\s)${c}(\\s|$)`).test(clase(n));
const rotulo = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();
const hijosDe = (n) => todos(n).filter((x) => x._padre === n);

// Uno por caso. La clave va en el título propio para encontrar la fila por IDENTIDAD, no por posición.
const CASOS = [
  { clave: 'EN-CURSO', status: 'en_curso' },
  { clave: 'AGENDADO', status: 'agendado' },
  { clave: 'SIN-EJE', status: 'agendado', importeReferencia: null, totalCobrado: 0 },
  { clave: 'CON-EJE', status: 'agendado', importeReferencia: 100, totalCobrado: 40 },
];

async function montar({ rol = 'admin' } = {}) {
  const dc = datosDelCenso();
  dc.enVista('renderJobsView');
  const base = dc.datos('/admin/jobs')[0];
  const trabajos = CASOS.map((c, i) => ({ ...structuredClone(base), id: 201 + i, titulo: c.clave, tituloPropio: c.clave, remaining: { amount: 0, currency: 'EUR' }, ...c }));
  const datos = (url, opts) => (new URL(String(url), 'https://yaqu.app').pathname === '/admin/jobs' ? trabajos : dc.datos(url, opts));
  const banco = cargarDashboard(RAIZ, { datos });
  banco.ctx.renderAppView = () => {};
  banco.ctx.appUserRole = rol;
  banco.ctx.facturaFiscalDisponible = () => true;
  // El «⋯» solo cuelga sus entradas del documento al ABRIRSE (`overflowMenu`, api.js), y abrirlo pide
  // geometría que el banco no tiene. Se apunta en el propio disparador con qué entradas lo crearon:
  // son los MISMOS nodos que el menú colgará, en el mismo orden.
  const original = banco.ctx.overflowMenu;
  assert.equal(typeof original, 'function', '🔴 CIEGO: el banco no carga `overflowMenu` (api.js)');
  let menusCreados = 0;
  banco.ctx.overflowMenu = (entradas, opciones) => {
    menusCreados += 1;
    const disparador = original(entradas, opciones);
    disparador._entradas = entradas;
    return disparador;
  };
  const r = await pintarVista(banco, 'renderJobsView');
  assert.equal(r.error, null, `🔴 la lista revienta: ${r.error && r.error.message}`);
  const nodos = todos(r.contenedor);
  const filas = nodos.filter((n) => n.tagName === 'TR' && tiene(n, 'jobs-fila'));
  assert.equal(filas.length, CASOS.length, `🔴 CIEGO: pedí ${CASOS.length} Trabajos y salen ${filas.length} filas`);
  assert.equal(menusCreados, CASOS.length, `🔴 CIEGO: ${menusCreados} «⋯» creados para ${CASOS.length} filas: el apunte de las entradas no es de fiar`);
  const fila = {};
  for (const c of CASOS) {
    const suyas = filas.filter((f) => todos(f).some((n) => (n._texto || '').trim() === c.clave));
    assert.equal(suyas.length, 1, `🔴 CIEGO: ${suyas.length} filas para «${c.clave}»`);
    fila[c.clave] = suyas[0];
  }
  return { fila, nodos, banco, trabajos };
}

/** Los controles de la celda de acciones, en el ORDEN DEL DOM. */
function controles(tr) {
  const celda = todos(tr).find((n) => tiene(n, 'jobs-celda-acciones'));
  assert.ok(celda, '🔴 CIEGO: la fila no tiene `.jobs-celda-acciones`');
  return todos(celda).filter((n) => n.tagName === 'BUTTON').map((b) => ({ nodo: b, rotulo: rotulo(b), rellena: tiene(b, 'btn-primary') }));
}
/** Las entradas con las que se creó el «⋯» de la fila, en su orden. */
function menuDe(tr) {
  const disparadores = todos(tr).filter((n) => tiene(n, 'overflow-trigger'));
  assert.equal(disparadores.length, 1, `🔴 CIEGO: la fila lleva ${disparadores.length} «⋯»`);
  assert.ok(Array.isArray(disparadores[0]._entradas), '🔴 CIEGO: el «⋯» de la fila no pasó por el apunte de entradas');
  return disparadores[0]._entradas;
}
const esEscalera = (n) => !!(n.dataset && n.dataset.accion === 'escalera');
const lineasDeImporte = (tr) => {
  const celda = todos(tr).find((n) => tiene(n, 'cell-amount'));
  assert.ok(celda, '🔴 CIEGO: la fila no tiene celda de importe');
  return hijosDe(celda).map(rotulo);
};

test('SCRUM-1725j ① · UNA tarjeta: cabecera con «Nuevo trabajo», filtros y lista cuelgan de la misma `.data-card`; las cifras, fuera', async () => {
  const { nodos } = await montar();
  const tarjetas = nodos.filter((n) => tiene(n, 'data-card'));
  assert.equal(tarjetas.length, 1, `🔴 la pantalla lleva ${tarjetas.length} \`.data-card\` (las hermanas llevan UNA)`);
  const [tarjeta] = tarjetas;
  const dentro = new Set(todos(tarjeta));
  const porId = (id) => {
    const suyos = nodos.filter((n) => n.id === id);
    assert.equal(suyos.length, 1, `🔴 CIEGO: ${suyos.length} nodos con id «${id}»`);
    return suyos[0];
  };
  for (const id of ['jobs-nuevo', 'jobs-filter', 'jobs-list']) {
    assert.ok(dentro.has(porId(id)), `🔴 «#${id}» ha quedado FUERA de la tarjeta: vuelve a ser una caja suelta`);
  }
  const cabeceras = hijosDe(tarjeta).filter((n) => tiene(n, 'data-card-header'));
  assert.equal(cabeceras.length, 1, `🔴 la tarjeta lleva ${cabeceras.length} cabeceras`);
  assert.ok(new Set(todos(cabeceras[0])).has(porId('jobs-nuevo')), '🔴 «Nuevo trabajo» no está en la cabecera de la tarjeta, junto al título');
  // Las dos cifras contestan «qué hay hoy» y «cuánto me deben» ANTES de la lista: van encima, fuera.
  assert.ok(!dentro.has(porId('jobs-cifras')), '🔴 las cifras han entrado en la tarjeta');
});

test('SCRUM-1725j ② · P3: sin importe de referencia la celda dice «Sin importe» y NADA MÁS', async () => {
  const { fila } = await montar();
  // CONTROL POSITIVO: con importe la celda lleva DOS líneas. Si diera una, el lector de líneas estaría
  // aplanando la celda y «solo una» de abajo sería cierto por construcción.
  assert.deepEqual(lineasDeImporte(fila['CON-EJE']).length, 2, `🔴 CIEGO: con importe la celda da ${JSON.stringify(lineasDeImporte(fila['CON-EJE']))} (esperaba dos líneas)`);
  assert.deepEqual(lineasDeImporte(fila['SIN-EJE']), ['Sin importe'], '🔴 la celda sin importe no dice solo «Sin importe» (P3, SCRUM-1725 c.22098)');
});

test('SCRUM-1725j ③ · P4: EN CURSO lleva TRES controles y el albarán va PRIMERO en el «⋯», por su identidad', async () => {
  const { fila, banco, trabajos } = await montar();
  const cs = controles(fila['EN-CURSO']);
  assert.deepEqual(cs.map((c) => c.rotulo), ['Abrir parte', 'Ver detalle', '⋯'], '🔴 la fila EN CURSO no lleva exactamente «Abrir parte» · «Ver detalle» · «⋯»');
  assert.ok(cs[0].rellena, '🔴 «Abrir parte» ha dejado de ser la rellena de la fila EN CURSO (N1, SCRUM-1700)');
  assert.deepEqual(todos(fila['EN-CURSO']).filter(esEscalera).map(rotulo), [], '🔴 la acción de la escalera sigue en la fila EN CURSO');

  // El rótulo esperado sale de la ESCALERA, no de este fichero: es el que la ficha pinta en su CTA.
  const paso = banco.ctx.jobNextAction(trabajos.find((j) => j.clave === 'EN-CURSO'), true);
  assert.ok(paso && paso.label, `🔴 CIEGO: la escalera no propone nada para el Trabajo en curso: ${JSON.stringify(paso)}`);
  const menu = menuDe(fila['EN-CURSO']);
  assert.equal(menu.filter(esEscalera).length, 1, `🔴 el «⋯» de EN CURSO lleva ${menu.filter(esEscalera).length} acciones con data-accion="escalera": ${JSON.stringify(menu.map(rotulo))}`);
  assert.ok(esEscalera(menu[0]), `🔴 la acción de la escalera no es la PRIMERA del «⋯»: ${JSON.stringify(menu.map(rotulo))}`);
  assert.equal(rotulo(menu[0]), paso.label, '🔴 la primera entrada del «⋯» no dice lo que propone la escalera');

  // CONTROL: solo baja la de EN CURSO. En un agendado el paso sigue EN LA FILA, con la misma identidad.
  assert.deepEqual(todos(fila.AGENDADO).filter(esEscalera).map(rotulo), ['▶ Empezar'], '🔴 el paso del agendado ya no está en la fila con su identidad');
  assert.equal(menuDe(fila.AGENDADO).filter(esEscalera).length, 0, '🔴 el paso del agendado ha bajado al «⋯»');
});

test('SCRUM-1725j ③ · P4 es para todos los roles: el operario ve la misma fila EN CURSO', async () => {
  const { fila } = await montar({ rol: 'tecnico' });
  assert.deepEqual(controles(fila['EN-CURSO']).map((c) => c.rotulo), ['Abrir parte', 'Ver detalle', '⋯'], '🔴 la fila EN CURSO del operario no lleva tres controles');
  assert.ok(esEscalera(menuDe(fila['EN-CURSO'])[0]), '🔴 el «⋯» del operario no abre con la acción de la escalera');
});

// Las mutaciones que tumban los casos de arriba (SCRUM-745: las ejecuta `scripts/meta-guard-mutaciones.mjs`).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La pantalla vuelve a ser cajas sueltas: la envoltura deja de ser una `.data-card`.
    fichero: 'public/dashboard/js/jobsView.js',
    de: '      <div class="data-card jobs-tarjeta">',
    a: '      <div class="jobs-tarjeta">',
    cae: 'SCRUM-1725j ① · UNA tarjeta: cabecera con «Nuevo trabajo», filtros y lista cuelgan de la misma `.data-card`; las cifras, fuera',
  },
  {
    // Vuelve la segunda frase bajo «Sin importe» (lo que P3 quitó de la lista).
    fichero: 'public/dashboard/js/jobsView.js',
    de: "    linea('jobs-importe-falta jobs-importe-sin', 'Sin importe');",
    a: "    linea('jobs-importe-falta jobs-importe-sin', 'Sin importe'); linea('jobs-importe-de', 'no hay presupuesto aceptado');",
    cae: 'SCRUM-1725j ② · P3: sin importe de referencia la celda dice «Sin importe» y NADA MÁS',
  },
  {
    // El albarán vuelve a la fila EN CURSO: cuatro controles, y el «⋯» sin él.
    fichero: 'public/dashboard/js/jobsView.js',
    de: '  if (escaleraAlMenu) menu.push(escaleraAlMenu);',
    a: '  if (escaleraAlMenu) caja.appendChild(escaleraAlMenu);',
    cae: 'SCRUM-1725j ③ · P4: EN CURSO lleva TRES controles y el albarán va PRIMERO en el «⋯», por su identidad',
  },
  {
    // El albarán sigue en el «⋯», pero al FINAL, detrás de Técnicos y Marcar terminado.
    fichero: 'public/dashboard/js/jobsView.js',
    de: "  const tresPuntos = menu.length && typeof overflowMenu === 'function' ? overflowMenu(menu) : null;",
    a: "  if (escaleraAlMenu) menu.push(menu.shift()); const tresPuntos = menu.length && typeof overflowMenu === 'function' ? overflowMenu(menu) : null;",
    cae: 'SCRUM-1725j ③ · P4: EN CURSO lleva TRES controles y el albarán va PRIMERO en el «⋯», por su identidad',
  },
  {
    // La acción pierde su identidad: quien la busca por `data-accion="escalera"` deja de verla.
    fichero: 'public/dashboard/js/jobsView.js',
    de: "    bSiguiente.dataset.accion = 'escalera';",
    a: "    bSiguiente.dataset.accion = 'paso';",
    cae: 'SCRUM-1725j ③ · P4: EN CURSO lleva TRES controles y el albarán va PRIMERO en el «⋯», por su identidad',
  },
];
