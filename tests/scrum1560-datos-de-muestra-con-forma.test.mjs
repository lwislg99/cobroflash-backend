// tests/scrum1560-datos-de-muestra-con-forma.test.mjs — SCRUM-1560
//
// El censo táctil monta cada vista del banco con datos de muestra. Medido el 16-oct-2026 sobre
// `ce054fb4`: 28 rutas recibían un `[]` de relleno (varias son OBJETO en el servidor), seis el dato de OTRA ruta y cinco vistas de detalle
// se montaban sin id: el banco pintaba pantallas que el producto no alcanza («undefined» en
// Referidos, en Inicio, en Exportar…). Aquí se fija:
//   · el comprobador de forma SABE fallar (forma mala → cae) y sabe absolver (forma buena → pasa);
//   · las respuestas VIEJAS del censo, con su forma, caen contra el contrato del servidor;
//   · cada ruta recibe SU dato (su ejemplo casa con su contrato, no con el de otra);
//   · ninguna vista pide una ruta sin contrato, y ninguna pinta «undefined» ni «NaN»;
//   · y (SCRUM-1560g) cada vista PINTA algo, y cada panel de Configuración también salvo los declarados.
// Sin BD ni red: lee ficheros y monta el banco en memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRATOS, comprobarForma, contratoDe, datosDelCenso, ARGUMENTOS_DEL_CENSO, IDS,
  parametrosDe, avisoDeVistaSinPedir, avisoDeRutaSinContrato,
} from '../scripts/_datos-del-censo.mjs';
import { serializar, CLIENTES_DE_MUESTRA, TRABAJO_DE_MUESTRA } from '../scripts/_pagina-panel.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const de = (ruta) => {
  const c = contratoDe(ruta);
  assert.ok(c, `🔴 sin contrato para ${ruta}`);
  return c;
};

test('CONTROL · el comprobador cae con la forma mala y pasa con la buena, en sus cuatro reglas', () => {
  const obj = { ejemplo: '/x', forma: 'objeto', claves: ['a', 'b'] };
  const arr = { ejemplo: '/y', forma: 'array', elemento: ['id'] };
  assert.deepEqual(comprobarForma(obj, { a: 1, b: null }), [], 'objeto con sus claves (null vale: es un valor)');
  assert.deepEqual(comprobarForma(arr, [{ id: 1 }, { id: 2 }]), [], 'array con sus elementos');
  assert.deepEqual(comprobarForma(arr, []), [], 'un array VACÍO es una forma del servidor');
  assert.equal(comprobarForma(obj, []).length, 1, 'array donde el servidor da objeto');
  assert.equal(comprobarForma(arr, {}).length, 1, 'objeto donde el servidor da array');
  assert.equal(comprobarForma(obj, null).length, 1, 'null donde el servidor da objeto');
  assert.equal(comprobarForma(obj, { a: 1 }).length, 1, 'falta una clave');
  assert.equal(comprobarForma(arr, [{ id: 1 }, 'x']).length, 1, 'un elemento que no es objeto');
  assert.equal(comprobarForma(arr, [{ nombre: 'x' }]).length, 1, 'un elemento sin su clave');
  const sobre = { ejemplo: '/z', forma: 'objeto', claves: ['ok', 'items'], elementosDe: { items: ['concepto'] } };
  assert.deepEqual(comprobarForma(sobre, { ok: true, items: [{ concepto: 'a' }] }), [], 'lista anidada con sus elementos');
  assert.equal(comprobarForma(sobre, { ok: true, items: [{ id: 1 }] }).length, 1, 'lista anidada con el elemento de OTRA ruta');
  assert.equal(comprobarForma(sobre, { ok: true, items: {} }).length, 1, 'lista anidada que no es array');
});

test('🔴 EL ROJO DE ANTES: lo que servía el censo viejo cae contra el contrato del servidor', () => {
  // Las respuestas que daba `DATOS` hasta SCRUM-1560, ruta por ruta, tal cual.
  const viejo = [
    ['/admin/referral', []],
    ['/admin/connect/status', []],
    ['/admin/metrics/home', []],
    ['/admin/reports/pl', []],
    ['/admin/expenses/summary', []],
    ['/admin/exports/datos.zip/info', []],
    ['/admin/albaranes', []],
    ['/admin/partes/oficina/pendientes', []],
    ['/admin/customers/1/historial', CLIENTES_DE_MUESTRA],
    ['/admin/customers/1/whatsapp', CLIENTES_DE_MUESTRA],
    ['/admin/jobs/1/gastos', TRABAJO_DE_MUESTRA],
    ['/admin/albaranes/31/fotos', { id: 1, estado: 'borrador', lines: [], items: [] }],
    ['/admin/albaranes/pendientes-facturar', { id: 1, estado: 'borrador', lines: [], items: [] }],
    ['/admin/albaranes/31', { id: 1, estado: 'borrador', lines: [], items: [] }],
    ['/admin/products/frequent-concepts', { ok: true, items: [{ id: 1, name: 'Grifo' }] }],
    ['/admin/billing/plans', { plans: [], currentPlan: null, founding: null }],
  ];
  const absueltos = viejo.filter(([r, v]) => comprobarForma(de(r), v).length === 0).map(([r]) => r);
  assert.deepEqual(absueltos, [], `🔴 el contrato absuelve una respuesta que el servidor no da: ${absueltos.join(', ')}`);
});

test('🔴 SCRUM-1560d · los tres fixtures COMPARTIDOS de antes caen contra su contrato del servidor', () => {
  // Tal como estaban en `_pagina-panel.mjs` hasta SCRUM-1560d (recortados a lo que decide).
  const clienteViejo = { id: 1, name: 'x', phone: '34000000001', email: 'a@b.es', notes: '', tags: [], createdAt: '2026-01-15T10:00:00Z' };
  const viejo = [
    ['/admin/customers', [clienteViejo]],
    ['/admin/customers/1/detail', { customer: clienteViejo, quotes: [{ id: 11, quoteNumber: 'P', status: 'accepted', total: 1, currency: 'EUR', createdAt: 'x' }],
      invoices: [{ id: 21, number: 'F', status: 'paid', total: 1, currency: 'EUR', createdAt: 'x', pdfUrl: '/x.pdf' }], stats: {}, events: [] }],
    ['/admin/jobs/1', { id: 1, title: 'Reforma de baño', status: 'en_curso', customer: { id: 5 }, albaranes: [], invoices: [] }],
  ];
  const absueltos = viejo.filter(([r, v]) => comprobarForma(de(r), v).length === 0).map(([r]) => r);
  assert.deepEqual(absueltos, [], `🔴 el contrato absuelve un fixture que el servidor no da: ${absueltos.join(', ')}`);
  // Y los de ahora no traen lo que el servidor NUNCA manda: `title` en el Trabajo ni `tags: []`.
  assert.ok(!('title' in TRABAJO_DE_MUESTRA), 'el Trabajo de muestra vuelve a llevar `title`');
  const vacias = CLIENTES_DE_MUESTRA.filter((c) => Array.isArray(c.tags) && c.tags.length === 0).map((c) => c.name);
  assert.deepEqual(vacias, [], 'clientes con `tags: []`, que `normalizarTags` convierte en null');
});

// SCRUM-1560e · lo que el censo dice cuando NO puede medir una vista. Con funciones y rutas de
// mentira a propósito: este test va en la tanda obligatoria y no puede caer por una vista de otro
// equipo (decisión del orquestador, 17-oct). El aviso sobre las vistas reales lo da el censo, que informa.
test('SCRUM-1560e · cuenta las peticiones POR VISTA: la que no pide nada sale con cero, no ausente de todo', () => {
  const dc = datosDelCenso();
  dc.enVista('renderPideView'); dc.datos('/admin/quotes'); dc.datos('/admin/quotes/11');
  dc.enVista('renderMudaView');
  assert.equal(dc.pedidasDe('renderPideView'), 2);
  assert.equal(dc.pedidasDe('renderMudaView'), 0);
});

test('SCRUM-1560e · los parámetros de una vista, sin el contenedor ni los valores por defecto', () => {
  assert.deepEqual(parametrosDe(async function renderX(container, expenseId) {}), ['expenseId']);
  assert.deepEqual(parametrosDe(function renderY(contenedor, parteId, opciones = {}, yaTraido) {}), ['parteId', 'opciones', 'yaTraido']);
  assert.deepEqual(parametrosDe(function renderZ(container) {}), []);
});

test('SCRUM-1560e · 🔴 el aviso dice QUÉ añadir y DÓNDE, con la vista y el fichero por su nombre', () => {
  const v = avisoDeVistaSinPedir('renderFichaView', ['fichaId'], 1);
  for (const debe of ['renderFichaView', 'scripts/_datos-del-censo.mjs', 'ARGUMENTOS_DEL_CENSO', '`renderFichaView: [<fichaId>],`']) {
    assert.ok(v.includes(debe), `al aviso de vista sin pedir le falta ${debe}:\n${v}`);
  }
  const r = avisoDeRutaSinContrato('/admin/fichas/:n/notas', new Set(['renderFichaView']));
  for (const debe of ['/admin/fichas/:n/notas ← renderFichaView', 'scripts/_datos-del-censo.mjs', 'CONTRATOS', "ejemplo: '/admin/fichas/1/notas'"]) {
    assert.ok(r.includes(debe), `al aviso de ruta sin contrato le falta ${debe}:\n${r}`);
  }
  // La regex que propone se puede pegar tal cual: casa con su ejemplo y no con la ruta de al lado.
  const regex = new RegExp(r.match(/ruta: \/(.+?)\/, ejemplo/)[1]);
  assert.ok(regex.test('/admin/fichas/1/notas'), `la regex propuesta ${regex} no casa con su ejemplo`);
  assert.ok(!regex.test('/admin/fichas/1/notas/2'), `la regex propuesta ${regex} se come una ruta más larga`);
  assert.ok(!regex.test('/admin/fichas/1/2/notas'), `la regex propuesta ${regex} deja pasar dos tramos donde va un id`);
  assert.ok(!regex.test('/admin/fichas/abc/notas'), `la regex propuesta ${regex} acepta un id que no es número`);
});

test('SCRUM-1560e · el censo usa los avisos, separa «no pidió nada» y pone los NOMBRES en la línea del resumen', () => {
  const fuente = soloCodigo(fs.readFileSync(path.join(RAIZ, 'scripts/censo-objetivo-tactil-panel.mjs'), 'utf8'), 'censo-objetivo-tactil-panel.mjs');
  assert.match(fuente, /DC\.pedidasDe\(fn\)/, 'el censo ya no mira cuántas peticiones hizo la vista');
  assert.match(fuente, /avisoDeVistaSinPedir\(/, 'el censo ya no redacta el aviso de vista sin pedir');
  assert.match(fuente, /avisoDeRutaSinContrato\(/, 'el censo ya no redacta el aviso de ruta sin contrato');
  assert.match(fuente, /vistas que publica el banco:[^\n]*nombresNoMedidas/, 'la línea que copia el CI ya no lleva los nombres');
});

test('cada contrato: su dato cumple, su ejemplo casa con ÉL (no con el de otra ruta) y su fuente existe', () => {
  assert.ok(CONTRATOS.length >= 45, `sólo ${CONTRATOS.length} contratos: se perdieron rutas`);
  const fallos = [];
  for (const c of CONTRATOS) {
    fallos.push(...comprobarForma(c, c.dato()));
    if (contratoDe(c.ejemplo) !== c) fallos.push(`${c.ejemplo} lo contesta ${contratoDe(c.ejemplo)?.ejemplo ?? 'nadie'}`);
    const fichero = c.fuente.split(' ')[0];
    if (!fs.existsSync(path.join(RAIZ, fichero))) { fallos.push(`${c.ejemplo}: la fuente ${fichero} no existe`); continue; }
    // Anclado por IDENTIDAD: el literal de la ruta tiene que seguir en su router.
    if (fichero.startsWith('src/')) {
      if (!c.get) fallos.push(`${c.ejemplo}: fuente del servidor sin \`get\``);
      else if (!new RegExp(`\\.get\\(\\s*['"]${c.get.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(fs.readFileSync(path.join(RAIZ, fichero), 'utf8'))) {
        fallos.push(`${c.ejemplo}: ${fichero} ya no tiene \`.get('${c.get}'\``);
      }
    }
  }
  const delServidor = CONTRATOS.filter((c) => c.fuente.startsWith('src/')).length;
  assert.ok(delServidor >= 40, `sólo ${delServidor} contratos citan el servidor`);
  assert.deepEqual(fallos, []);
});

test('las seis rutas que recibían el dato de OTRA tienen ahora el suyo', () => {
  const pares = [
    ['/admin/customers/7/historial', '/admin/customers'],
    ['/admin/customers/7/whatsapp', '/admin/customers'],
    ['/admin/jobs/7/gastos', '/admin/jobs/1'],
    ['/admin/albaranes/7/fotos', '/admin/albaranes/31'],
    ['/admin/albaranes/pendientes-facturar', '/admin/albaranes/31'],
    ['/admin/products/frequent-concepts', '/admin/products'],
  ];
  for (const [pedida, ajena] of pares) assert.notEqual(de(pedida), de(ajena), `${pedida} sigue recibiendo el dato de ${ajena}`);
  // Con consulta y con URL entera (el detalle de factura pide por `fetch` con origen).
  assert.equal(de('/admin/quotes?status=sent').ejemplo, '/admin/quotes');
  assert.equal(de('https://yaqu.app/admin/invoices/21').ejemplo, '/admin/invoices/21');
});

test('las seis vistas de detalle se montan con el id de su dato, no con NaN ni undefined', () => {
  const esperado = {
    renderJobDetailView: IDS.trabajo, renderQuoteDetailView: IDS.presupuesto, renderInvoiceDetailView: IDS.factura,
    renderAlbaranDetailView: IDS.albaran, renderParteDetailView: IDS.parte,
    // SCRUM-1560c · la sexta, la ficha del gasto (SCRUM-1156c): sin id no pide nada y no se medía.
    renderExpenseDetailView: IDS.gasto,
  };
  for (const [fn, id] of Object.entries(esperado)) {
    assert.deepEqual(ARGUMENTOS_DEL_CENSO[fn], [id], fn);
    assert.ok(Number.isInteger(id), `${fn}: ${id}`);
  }
  assert.equal(de(`/admin/jobs/${IDS.trabajo}`).dato().id, IDS.trabajo);
  assert.equal(de(`/admin/albaranes/${IDS.albaran}`).dato().id, IDS.albaran);
  assert.equal(de(`/admin/partes/${IDS.parte}`).dato().id, IDS.parte);
  assert.equal(de(`/admin/quotes/${IDS.presupuesto}`).dato().id, IDS.presupuesto);
  assert.equal(de(`/admin/invoices/${IDS.factura}`).dato().id, IDS.factura);
  assert.equal(de(`/admin/expenses/${IDS.gasto}`).dato().item.id, IDS.gasto);
});

test('el censo usa ESTOS datos y estos argumentos, no un relleno propio (código sin comentarios)', () => {
  const fuente = soloCodigo(fs.readFileSync(path.join(RAIZ, 'scripts/censo-objetivo-tactil-panel.mjs'), 'utf8'), 'censo-objetivo-tactil-panel.mjs');
  assert.match(fuente, /=\s*datosDelCenso\(\)/, 'el censo ya no llama a datosDelCenso()');
  assert.match(fuente, /ARGUMENTOS_DEL_CENSO\[fn\]/, 'el censo ya no monta las vistas con ARGUMENTOS_DEL_CENSO');
  assert.doesNotMatch(fuente, /return\s*\[\s*\]\s*;/, 'ha vuelto un `return []` de relleno al censo');
  assert.match(fuente, /DC\.sinContrato\.size\)\s*\{\s*noSupe\(/, 'una ruta sin contrato ya no hace salir al censo con 2');
});

// SCRUM-1560g · LOS PANELES DE CONFIGURACIÓN QUE CON ESTOS DATOS NO PUEDEN PINTAR, ESCRITOS.
//
// «Ninguna pinta undefined» lo cumple también una pantalla que no pinta NADA: medido por mutación
// en SCRUM-1560f (`docs/master/evidencias/SCRUM-1560f/c-mutar.mjs`), este caso seguía 12/12 en verde
// con Trabajos, Configuración o Cobros vaciadas. Ahora cada vista tiene que pintar algo, y cada panel
// de Configuración también, salvo éstos, que con el banco de hoy NO PUEDEN: no es que estén limpios,
// es que nadie los ha visto. Si uno empieza a pintar, su línea caduca y el caso cae hasta que se quite.
const PANELES_SIN_PINTAR_DECLARADOS = Object.freeze({
  // 23-oct-2026 · el `/admin/merchant` de muestra es `{ id, name }` (su contrato dice «claves completas
  // SIN medir») y `settingsView.js` corta con `if (m.slug === undefined) return`: el banco pinta el
  // perfil reducido del Operario, no el del dueño. Lo cierra completar ese contrato (la (a) de
  // SCRUM-1560f), que mueve lo que miden los 14 consumidores de estos datos: sin decidir.
  publica: 'el merchant de muestra no trae `slug`',
  // 23-oct-2026 · el panel sólo pinta `if (window.appModoEmision)`, y ese global lo pone `app.js` desde
  // `/auth/me` al arrancar, cosa que el banco no hace: el modo vale «no se sabe» y el producto, a
  // propósito, no enseña ninguno. Completar el merchant NO lo arregla: hace falta que el banco dé la sesión.
  cumplimiento: 'el banco no pone `window.appModoEmision` (lo da `/auth/me` al arrancar)',
});

test('🔴 en el banco: ninguna vista pide una ruta sin contrato, ni con NaN/undefined, ni pinta «undefined»', async () => {
  const dc = datosDelCenso();
  const b0 = cargarDashboard(RAIZ);
  const vistas = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b0.ctx[k] === 'function').sort();
  // Suelo: con cero vistas o cero rutas, los «ninguna» de abajo no dirían nada.
  assert.ok(vistas.length >= 25, `sólo ${vistas.length} vistas en el banco`);
  const pintan = [];
  const vacias = [];
  let paneles = null;
  for (const fn of vistas) {
    dc.enVista(fn);
    const r = await pintarVista(cargarDashboard(RAIZ, { datos: dc.datos }), fn, ...(ARGUMENTOS_DEL_CENSO[fn] || []));
    assert.ok(!r.error, `${fn} no monta: ${r.error && r.error.message}`);
    const n = (serializar(r.contenedor).match(/\bundefined\b|\bNaN\b/g) || []).length;
    if (n) pintan.push(`${fn} ×${n}`);
    const nodos = todos(r.contenedor).slice(1);
    if (!nodos.length) vacias.push(fn);
    if (fn === 'renderSettingsView') {
      paneles = nodos.filter((p) => p.dataset && p.dataset.submenu && p.tagName !== 'BUTTON')
        .map((p) => ({ panel: p.dataset.submenu, nodos: todos(p).length - 1 }));
    }
  }
  // «Ninguna pinta undefined» no dice nada de una vista que no pintó: se exige que pinte.
  assert.deepEqual(vacias, [], 'vistas que no pintan NADA con los datos del censo: su «ningún undefined» es por vacío');
  assert.ok(paneles && paneles.length >= 5,
    `🔴 CIEGO: Configuración da ${paneles ? paneles.length : 'ningún'} panel(es) con \`data-submenu\` y tiene nueve; no sé qué pinta cada uno`);
  const sinDeclarar = paneles.filter((p) => !p.nodos && !(p.panel in PANELES_SIN_PINTAR_DECLARADOS)).map((p) => p.panel);
  assert.deepEqual(sinDeclarar, [], 'paneles de Configuración que no pintan NADA y no están en PANELES_SIN_PINTAR_DECLARADOS');
  const caducadas = Object.keys(PANELES_SIN_PINTAR_DECLARADOS).filter((k) => !paneles.some((p) => p.panel === k && !p.nodos));
  assert.deepEqual(caducadas, [], 'declarados sin pintar que YA pintan (o ya no existen): quita su línea de PANELES_SIN_PINTAR_DECLARADOS');
  assert.ok(dc.servidas.size >= 40, `sólo ${dc.servidas.size} rutas servidas: el banco ya no pide por aquí`);
  assert.deepEqual([...dc.sinContrato.keys()], [], 'rutas pedidas SIN contrato (reciben null)');
  const rotas = [...dc.servidas.keys()].filter((k) => /NaN|undefined|null/.test(k));
  assert.deepEqual(rotas, [], 'rutas pedidas con un id que no existe');
  assert.deepEqual(pintan, [], 'vistas que pintan «undefined» o «NaN» con los datos del censo');
});
