// tests/scrum1725-lista-operario-sin-cobro.test.mjs — SCRUM-1725 (D1, S4)
//
// LA LISTA DE TRABAJOS NO LE ENSEÑA EL COBRO A QUIEN NO LO VE.
//
// FIRMADO por el fundador en SCRUM-1707 c.21547 (Q1): el operario ve el IMPORTE de sus trabajos,
// «pero SIN la tarjeta "Por cobrar" ni los filtros de cobro del negocio». El servidor (1707) le manda
// vacíos lo cobrado y el estado de cobro; esta lista calcula «lo que falta» en el navegador, así que
// con lo cobrado vacío (→ 0) pintaría que falta el importe entero: una cifra FALSA (medido en
// yaqu.app, SCRUM-1725 ⓪). Se monta la vista REAL en el banco, sin navegador:
//   ① operario: ni «Por cobrar», ni Pendiente/Parcial/Pagado, ni «de X €», ni «por cobrar» en la
//     cabecera de Terminados, ni su salvedad; el importe SÍ, en una línea;
//   ② un rol que no se reconoce cae del lado del operario (lista blanca, fail-closed);
//   ③ CONTROL POSITIVO: el admin lo sigue viendo todo. Sin él, «no aparece» podría ser que la
//     lista dejó de pintarse.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { datosDelCenso } from '../scripts/_datos-del-censo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const clase = (n) => String((n && n.className) || '');
const tiene = (n, c) => new RegExp(`\\b${c}\\b`).test(clase(n));
const texto = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();

/** Un terminado cobrado a medias (100, cobrado 40) y uno en curso con la forma de 1707 (cobrado vacío). */
async function montar(rol) {
  const dc = datosDelCenso();
  dc.enVista('renderJobsView');
  const datos = (url, opts) => {
    const p = new URL(String(url), 'https://yaqu.app').pathname;
    if (p === '/admin/jobs') {
      const base = dc.datos('/admin/jobs')[0];
      return [
        { ...structuredClone(base), id: 201, status: 'terminado', titulo: 'T-terminado', tituloPropio: 'T-terminado',
          importeReferencia: 100, totalCobrado: 40, estadoCobro: 'Parcial' },
        { ...structuredClone(base), id: 202, status: 'en_curso', titulo: 'T-en-curso', tituloPropio: 'T-en-curso',
          importeReferencia: 50, totalCobrado: null, estadoCobro: null },
      ];
    }
    if (p === '/admin/partes') return { partes: [] };
    return dc.datos(url, opts);
  };
  const banco = cargarDashboard(RAIZ, { datos, rol });
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderJobsView');
  assert.equal(r.error, null, `🔴 la lista revienta con rol ${rol}: ${r.error && r.error.message}`);
  const nodos = todos(r.contenedor);
  const filas = nodos.filter((n) => n.tagName === 'TR' && tiene(n, 'jobs-fila'));
  assert.equal(filas.length, 2, `🔴 CIEGO (${rol}): pedí 2 Trabajos y salen ${filas.length} filas`);
  const celdas = nodos.filter((n) => tiene(n, 'cell-amount')).map(texto);
  assert.equal(celdas.length, 2, `🔴 CIEGO (${rol}): ${celdas.length} celdas de importe`);
  return {
    todo: texto(r.contenedor),
    // SCRUM-1725i · el eje de cobro pasó de píldoras (`<button>` «Pendiente · N») a desplegable
    // (`<option>` «Pendiente (N)», el patrón de Albaranes; SCRUM-1725 c.22098). Se cuentan las DOS
    // formas: quien no ve el cobro tiene que tener 0 en cualquiera de ellas, y el admin, las 3.
    filtrosCobro: nodos.filter((n) => (n.tagName === 'BUTTON' || n.tagName === 'OPTION') && /^(Pendiente|Parcial|Pagado)( · | \()/.test(texto(n))).length,
    selectoresDeCobro: nodos.filter((n) => n.tagName === 'SELECT' && tiene(n, 'jobs-filtro-cobro')).length,
    lineasDe: nodos.filter((n) => tiene(n, 'jobs-importe-de')).length,
    salvedad: nodos.filter((n) => tiene(n, 'jobs-grupo-salvedad')).length,
    // SCRUM-1725g · la lista es PLANA: ya no se lee el texto de una cabecera, se CUENTAN las que haya
    // (tienen que ser 0) y se lee, fila a fila y en el orden pintado, la píldora que dice el estado.
    cabecerasDeGrupo: nodos.filter((n) => tiene(n, 'jobs-grupo-titulo')).length,
    pildoras: filas.map((f) => todos(f).filter((n) => tiene(n, 'status-pill')).map(texto).join('+')),
    celdas,
  };
}

// Los dos roles van con su nombre ESCRITO, no construido en un bucle (SCRUM-1415: la señal por nombres
// no puede echar en falta un test cuyo nombre no está en el fuente).
async function sinCobroParaElRol(rol) {
  const m = await montar(rol);
  assert.doesNotMatch(m.todo, /Por cobrar/, '🔴 la tarjeta «Por cobrar» sigue (c.21547 la quita)');
  assert.equal(m.filtrosCobro, 0, `🔴 ${m.filtrosCobro} filtros de cobro (Pendiente/Parcial/Pagado) a la vista`);
  // SCRUM-1725i · y tampoco el desplegable que ahora los lleva, ni su primera opción.
  assert.equal(m.selectoresDeCobro, 0, `🔴 ${m.selectoresDeCobro} desplegable(s) de cobro a la vista de quien no ve el cobro`);
  assert.doesNotMatch(m.todo, /Cobro: todos/, '🔴 «Cobro: todos» a la vista de quien no ve el cobro');
  assert.equal(m.lineasDe, 0, `🔴 ${m.lineasDe} líneas «de X €»: es lo que falta por cobrar, no el importe`);
  // SCRUM-1725g · miraba la cabecera de Terminados, que ya no existe: sobre un texto vacío esta línea
  // pasaría siempre. Mira la lista ENTERA (más estricto, no menos): «por cobrar» no sale en ningún sitio.
  assert.doesNotMatch(m.todo, /por cobrar/i, '🔴 la lista le dice «por cobrar» a quien no ve el cobro');
  // SCRUM-1725g · AQUÍ SE EXIGÍA M1 («✅ Terminados» a secas, c.22052). El requisito cambió: veredicto
  // del fundador (SCRUM-1725 c.22073) + P4 firmada (c.22076) → la lista es plana y no hay cabecera de
  // grupo para NINGÚN rol. Cambio de exigencia AUTORIZADO con nombre en SCRUM-1725 c.22077.
  assert.equal(m.cabecerasDeGrupo, 0, `🔴 la lista vuelve a pintar ${m.cabecerasDeGrupo} cabecera(s) de grupo (c.22073: plana)`);
  assert.equal(m.salvedad, 0, '🔴 la salvedad del total por cobrar sigue');
  assert.ok(m.celdas.some((c) => /100,00/.test(c)) && m.celdas.some((c) => /50,00/.test(c)),
    `🔴 el IMPORTE tiene que verse (c.21547): celdas = ${JSON.stringify(m.celdas)}`);
  assert.ok(!m.celdas.some((c) => /60,00/.test(c)), `🔴 una celda dice lo que FALTA (60), no el importe: ${JSON.stringify(m.celdas)}`);
}

test('SCRUM-1725 ①② · rol «tecnico»: sin «Por cobrar», sin filtros de cobro, sin «de X €»; el importe sí', () => sinCobroParaElRol('tecnico'));
test('SCRUM-1725 ①② · rol «contable»: sin «Por cobrar», sin filtros de cobro, sin «de X €»; el importe sí', () => sinCobroParaElRol('contable'));

test('SCRUM-1725 ③ · CONTROL POSITIVO: el admin sigue viendo «Por cobrar», los filtros y «de X €»', async () => {
  const m = await montar('admin');
  assert.match(m.todo, /Por cobrar/, '🔴 CIEGO: ni el admin ve «Por cobrar»; el test no prueba nada');
  assert.equal(m.filtrosCobro, 3, `🔴 CIEGO: el admin ve ${m.filtrosCobro} filtros de cobro, no 3`);
  // SCRUM-1725i · y los ve en UN desplegable, no en píldoras sueltas (c.22098).
  assert.equal(m.selectoresDeCobro, 1, `🔴 el admin tiene ${m.selectoresDeCobro} desplegable(s) de cobro, no 1`);
  assert.ok(m.lineasDe >= 1, '🔴 CIEGO: el admin no ve ninguna línea «de X €»');
  // SCRUM-1725g · aquí se exigía la cabecera «✅ Terminados — cobra el resto · N · … por cobrar» del
  // admin (c.22077 autoriza el cambio): tampoco él tiene cabecera de grupo. Su cobro sigue en la tarjeta
  // «Por cobrar» y en la línea «de X €», que son las tres comprobaciones de arriba.
  assert.equal(m.cabecerasDeGrupo, 0, `🔴 el admin vuelve a ver ${m.cabecerasDeGrupo} cabecera(s) de grupo (c.22073: plana)`);
  assert.equal(m.salvedad, 0, '🔴 vuelve la salvedad larga de la cabecera de Terminados (P4, c.22076: queda la de la tarjeta)');
});

// ══ SCRUM-1725g · LA LISTA ES PLANA ═══════════════════════════════════════════════════════════════
// Veredicto del fundador (SCRUM-1725 c.22073): «un listado normal como los que tenemos en otros sitios».
// Los dos Trabajos del banco llegan del servidor con el TERMINADO delante y el EN CURSO detrás. La lista:
//   · no pinta ninguna cabecera de grupo, para ningún rol;
//   · los ordena como la cola del día (P2, c.22076): el en curso PRIMERO, el terminado después;
//   · y dice el estado en cada fila, con la etiqueta de `jobStatusMeta` (la píldora de la ficha).
// SUELO: `montar` ya exige las 2 filas; sin ellas, «0 cabeceras» sería cierto por vacío.
test('SCRUM-1725g · la lista es PLANA para los tres roles: sin cabeceras de grupo, en el orden de la cola y con el estado en cada fila', async () => {
  const roles = ['admin', 'tecnico', 'contable'];
  for (const rol of roles) {
    const m = await montar(rol);
    assert.equal(m.cabecerasDeGrupo, 0, `🔴 (${rol}) ${m.cabecerasDeGrupo} cabecera(s) de grupo: la lista no es plana`);
    assert.deepEqual(m.pildoras, ['En curso', 'Terminado'],
      `🔴 (${rol}) las filas dicen ${JSON.stringify(m.pildoras)}: o falta la píldora de estado, o el orden no es el de la cola (en curso antes que terminado)`);
  }
});

// ══ SCRUM-1725i · LOS FILTROS: PESTAÑAS DE ESTADO Y DESPLEGABLE DE COBRO ══════════════════════════
// Decisiones de SCRUM-1725 c.22098 y c.22103 (PR-① de la vuelta 3). El patrón es el de Albaranes:
//   · el ESTADO del trabajo, en pestañas con contador, para TODOS los roles: «Todos» + las cinco
//     etiquetas de `jobStatusMeta`;
//   · el COBRO, en un desplegable de la barra («Cobro: todos», firmado en c.22098), solo para quien lo ve;
//   · los dos se cruzan; los cerrados siguen plegados bajo «Todos» y la pestaña «Cerrado» los enseña.
// Cuatro Trabajos, uno por estado que se mira, cada uno con un importe DISTINTO: la fila se reconoce
// por su importe, no por su posición.
const IMPORTE_DE = { terminado: '100,00', en_curso: '50,00', cerrado: '70,00', agendado: '30,00' };

async function montarFiltros(rol) {
  const dc = datosDelCenso();
  dc.enVista('renderJobsView');
  const datos = (url, opts) => {
    const p = new URL(String(url), 'https://yaqu.app').pathname;
    if (p === '/admin/jobs') {
      const base = dc.datos('/admin/jobs')[0];
      const uno = (id, status, importe, cobrado, estadoCobro) => ({ ...structuredClone(base), id, status,
        titulo: `T-${status}`, tituloPropio: `T-${status}`, importeReferencia: importe, totalCobrado: cobrado, estadoCobro });
      return [
        uno(301, 'terminado', 100, 40, 'Parcial'),
        uno(302, 'en_curso', 50, 0, 'Pendiente'),
        uno(303, 'cerrado', 70, 70, 'Pagado'),
        uno(304, 'agendado', 30, 0, 'Pendiente'),
      ];
    }
    if (p === '/admin/partes') return { partes: [] };
    return dc.datos(url, opts);
  };
  const banco = cargarDashboard(RAIZ, { datos, rol });
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderJobsView');
  assert.equal(r.error, null, `🔴 la lista revienta con rol ${rol}: ${r.error && r.error.message}`);
  const nodos = () => todos(r.contenedor);
  const pestanas = () => nodos().filter((n) => n.tagName === 'BUTTON' && tiene(n, 'data-card-tab'));
  /** Lo que se ve AHORA: se vuelve a leer tras cada pulsación. */
  const leer = () => {
    const filas = nodos().filter((n) => n.tagName === 'TR' && tiene(n, 'jobs-fila'));
    return {
      pestanas: pestanas().map(texto),
      pulsadas: pestanas().filter((b) => b.getAttribute('aria-pressed') === 'true').map(texto),
      // Qué Trabajos hay a la vista, por su importe y ORDENADOS: se comparan como conjunto.
      trabajos: filas.map((f) => {
        const celda = texto(todos(f).find((n) => tiene(n, 'cell-amount')));
        const estado = Object.keys(IMPORTE_DE).find((e) => celda.includes(IMPORTE_DE[e]));
        assert.ok(estado, `🔴 CIEGO: una fila cuyo importe no es de ninguno de los cuatro Trabajos: «${celda}»`);
        return estado;
      }).sort(),
      pildoras: filas.map((f) => todos(f).filter((n) => tiene(n, 'status-pill')).map(texto).join('+')).sort(),
      plegados: nodos().filter((n) => n.tagName === 'TR' && tiene(n, 'jobs-grupo-abrir')).map(texto),
      vacio: nodos().filter((n) => tiene(n, 'jobs-vacio-filtro')).map(texto),
      opcionesDeCobro: nodos().filter((n) => n.tagName === 'OPTION' && n._padre && tiene(n._padre, 'jobs-filtro-cobro')).map(texto),
      pildorasViejas: nodos().filter((n) => n.tagName === 'BUTTON' && / · \d+$/.test(texto(n))).map(texto),
    };
  };
  const pulsarPestana = (rotulo) => {
    const b = pestanas().find((x) => texto(x).startsWith(rotulo + ' '));
    assert.ok(b, `🔴 CIEGO (${rol}): no hay pestaña «${rotulo}»; hay ${JSON.stringify(pestanas().map(texto))}`);
    assert.ok(b.click() >= 1, `🔴 la pestaña «${rotulo}» no tiene quien la escuche`);
  };
  const elegirCobro = (valor) => {
    const sel = nodos().find((n) => n.tagName === 'SELECT' && tiene(n, 'jobs-filtro-cobro'));
    assert.ok(sel, `🔴 CIEGO (${rol}): no hay desplegable de cobro`);
    sel.value = valor;
    assert.ok(sel.disparar('change') >= 1, '🔴 el desplegable de cobro no tiene quien lo escuche');
  };
  return { leer, pulsarPestana, elegirCobro };
}

const PESTANAS = ['Todos 4', 'Sin agendar 0', 'Agendado 1', 'En curso 1', 'Terminado 1', 'Cerrado 1'];

test('SCRUM-1725i ① · pestañas de ESTADO con contador para los tres roles: «Todos» + las cinco de la ficha', async () => {
  const roles = ['admin', 'tecnico', 'contable'];
  for (const rol of roles) {
    const v = (await montarFiltros(rol)).leer();
    assert.deepEqual(v.pestanas, PESTANAS, `🔴 (${rol}) las pestañas de estado no son las firmadas (c.22098), o no cuentan bien`);
    assert.deepEqual(v.pulsadas, ['Todos 4'], `🔴 (${rol}) al entrar tiene que estar pulsada «Todos», y solo ella`);
  }
});

test('SCRUM-1725i ② · cada pestaña enseña SU estado; «Cerrado» enseña los cerrados directos y «Todos» los sigue plegando', async () => {
  const roles = ['admin', 'tecnico'];
  for (const rol of roles) {
    const v = await montarFiltros(rol);
    const alEntrar = v.leer();
    // Bajo «Todos», lo de siempre: los tres vivos a la vista y el cerrado detrás de su botón (P2).
    assert.deepEqual(alEntrar.trabajos, ['agendado', 'en_curso', 'terminado'], `🔴 (${rol}) bajo «Todos» no están los tres trabajos sin cerrar`);
    assert.deepEqual(alEntrar.plegados, ['Ver 1 cerrado'], `🔴 (${rol}) bajo «Todos» el cerrado ya no va plegado tras «Ver 1 cerrado»`);

    v.pulsarPestana('Cerrado');
    let ahora = v.leer();
    assert.deepEqual(ahora.trabajos, ['cerrado'], `🔴 (${rol}) la pestaña «Cerrado» no enseña el cerrado directamente`);
    assert.deepEqual(ahora.pildoras, ['Cerrado'], `🔴 (${rol}) la fila de la pestaña «Cerrado» no dice «Cerrado»`);
    assert.deepEqual(ahora.plegados, [], `🔴 (${rol}) en la pestaña «Cerrado» sigue el botón «Ver N cerrados»: obligaría a pulsar dos veces`);
    assert.deepEqual(ahora.pulsadas, ['Cerrado 1'], `🔴 (${rol}) la pestaña pulsada no es «Cerrado»`);

    v.pulsarPestana('En curso');
    ahora = v.leer();
    assert.deepEqual(ahora.trabajos, ['en_curso'], `🔴 (${rol}) la pestaña «En curso» no enseña solo lo que está en curso`);
    assert.deepEqual(ahora.plegados, [], `🔴 (${rol}) «Ver N cerrados» asoma en una pestaña que no tiene cerrados`);

    // CONTROL NEGATIVO: una pestaña sin trabajos enseña VACÍO y lo dice; las pestañas siguen ahí.
    v.pulsarPestana('Sin agendar');
    ahora = v.leer();
    assert.deepEqual(ahora.trabajos, [], `🔴 (${rol}) «Sin agendar» (0) enseña filas: un filtro que no encuentra nada no puede enseñar la lista`);
    assert.deepEqual(ahora.vacio, ['No hay trabajos con ese filtro.'], `🔴 (${rol}) la pestaña vacía no lo dice`);
    assert.deepEqual(ahora.pestanas, PESTANAS, `🔴 (${rol}) con la lista vacía desaparecen las pestañas: no habría forma de volver`);

    v.pulsarPestana('Todos');
    assert.deepEqual(v.leer(), alEntrar, `🔴 (${rol}) al volver a «Todos» la lista no es la de entrada`);
  }
});

test('SCRUM-1725i ③ · el COBRO es un desplegable («Cobro: todos»), sin píldoras, y se CRUZA con el estado', async () => {
  const v = await montarFiltros('admin');
  const alEntrar = v.leer();
  assert.deepEqual(alEntrar.opcionesDeCobro, ['Cobro: todos (4)', 'Pendiente (2)', 'Parcial (1)', 'Pagado (1)'],
    '🔴 el desplegable de cobro no trae «Cobro: todos» (c.22098) y las tres de siempre, con su cuenta');
  assert.deepEqual(alEntrar.pildorasViejas, [], '🔴 siguen las píldoras de cobro («Pendiente · N»): el eje de cobro va en el desplegable');

  v.elegirCobro('Pendiente');
  assert.deepEqual(v.leer().trabajos, ['agendado', 'en_curso'], '🔴 «Pendiente» no deja los dos trabajos pendientes de cobro');
  // Los contadores de las pestañas son del eje de ESTADO: no se mueven con el de cobro (como en Albaranes).
  assert.deepEqual(v.leer().pestanas, PESTANAS, '🔴 elegir un cobro cambió los contadores de estado');

  v.pulsarPestana('En curso');
  assert.deepEqual(v.leer().trabajos, ['en_curso'], '🔴 estado Y cobro no se cruzan: «En curso» + «Pendiente» tiene que dejar uno');

  v.pulsarPestana('Terminado');
  assert.deepEqual(v.leer().trabajos, [], '🔴 «Terminado» + «Pendiente» no deja ninguno (el terminado está en «Parcial»)');
  assert.deepEqual(v.leer().vacio, ['No hay trabajos con ese filtro.'], '🔴 el cruce vacío no lo dice');

  v.elegirCobro('all');
  assert.deepEqual(v.leer().trabajos, ['terminado'], '🔴 al volver a «Cobro: todos» la pestaña «Terminado» no enseña su trabajo');
});

// Las mutaciones que tumban los casos de arriba (SCRUM-745: las ejecuta `scripts/meta-guard-mutaciones.mjs`).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve una cabecera de grupo al cuerpo de la tabla.
    fichero: 'public/dashboard/js/jobsView.js',
    de: '  vivos.forEach((j) => tbody.appendChild(jobRow(j, container, equipo)));',
    a: "  { const rotulo = document.createElement('tr'); rotulo.className = 'jobs-grupo-titulo'; tbody.appendChild(rotulo); } vivos.forEach((j) => tbody.appendChild(jobRow(j, container, equipo)));",
    cae: 'SCRUM-1725g · la lista es PLANA para los tres roles: sin cabeceras de grupo, en el orden de la cola y con el estado en cada fila',
  },
  {
    // El orden deja de ser el de la cola: los terminados pasan delante de lo que está en curso.
    fichero: 'public/dashboard/js/jobsView.js',
    de: "  const SECUENCIA = ['en_curso', 'hoy', 'semana', 'sin', 'adelante', 'terminado'];",
    a: "  const SECUENCIA = ['terminado', 'en_curso', 'hoy', 'semana', 'sin', 'adelante'];",
    cae: 'SCRUM-1725g · la lista es PLANA para los tres roles: sin cabeceras de grupo, en el orden de la cola y con el estado en cada fila',
  },
  {
    // La fila deja de decir su estado: sin cabeceras, ya no lo diría nadie.
    fichero: 'public/dashboard/js/jobsView.js',
    de: '    pildora.textContent = metaDelEstado.label;',
    a: "    pildora.textContent = '';",
    cae: 'SCRUM-1725g · la lista es PLANA para los tres roles: sin cabeceras de grupo, en el orden de la cola y con el estado en cada fila',
  },
  {
    // Vuelven DOS insignias apiladas en la celda de estado (lo que SCRUM-816 quitó): una fila dice
    // «En curso+Parcial». Es también la mutación que tumba 816 caso 5 y guard-917 B.3: la toma de aquí
    // `docs/master/evidencias/SCRUM-1725/plana-una-pildora-mutacion.mjs`.
    fichero: 'public/dashboard/js/jobsView.js',
    de: '    tdEstado.appendChild(pildora);',
    a: "    tdEstado.appendChild(pildora); { const otra = document.createElement('span'); otra.className = 'status-pill'; otra.textContent = 'Parcial'; tdEstado.appendChild(otra); }",
    cae: 'SCRUM-1725g · la lista es PLANA para los tres roles: sin cabeceras de grupo, en el orden de la cola y con el estado en cada fila',
  },
];
