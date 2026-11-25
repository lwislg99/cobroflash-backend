#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1837b · LAS DOS ESQUINAS QUE EL CENSO TÁCTIL NO MIDE — banco de UN SOLO USO (S4)
//
//   ① la pestaña «Partes» de la ficha del Trabajo (`renderJobDetailView`), CON partes dentro;
//   ② la lista de partes de oficina (`renderPartesOficinaView`), y el parte que abre cada fila.
//
// POR QUÉ NO ES UN CAMBIO EN EL CENSO: `scripts/censo-objetivo-tactil-panel.mjs`,
// `scripts/_datos-del-censo.mjs` y `tests/_banco-vistas.mjs` son de S3 (`node scripts/carriles.mjs
// de …`, dos-equipos.md:177, :185 y :169). Este banco los IMPORTA y no los toca: monta las dos
// esquinas con datos de la FORMA DEL SERVIDOR (cada uno con su fichero:línea, abajo) y las mide con
// el mismo árbitro de toque. La puerta permanente en el censo es de S3; qué le falta está en el
// registro (`docs/master/SCRUM-1837.md`, apéndice SCRUM-1837b).
//
// QUÉ DEMUESTRA ANTES DE MEDIR (rojo-primero, cada cosa con su cifra):
//   · con el dato del censo, «Partes» es la pestaña que la ficha abre SOLA y tiene 0 filas: el aviso
//     «pulsarla no cambia nada» es volver al estado de montar, no una pestaña que no abre;
//   · con el dato del censo, la lista de oficina monta 12 nodos (< 20, el suelo del censo).
// Y UN CONTROL POSITIVO: dos vistas que el censo YA mide (`renderJobDetailView` y
// `renderParteDetailView`, con SUS datos) tienen que dar aquí, a 929 y a 390, la MISMA fila que da
// el censo corrido sobre este árbol (`--censo <su salida>`). Si no casan, este banco no mide lo
// mismo que el censo y sus números de las esquinas no valen: sale 2.
//
// El medidor es una COPIA del `MEDIR` del censo (no lo exporta) con un campo más, `dentro`, que dice
// si el elemento cae en la esquina o en el resto de la pantalla. La copia la vigila ese control.
//
// USO:    node docs/master/evidencias/SCRUM-1837/b-esquinas/medir-esquinas.mjs \
//              --censo docs/master/evidencias/SCRUM-1837/b-esquinas/censo-tactil-main-7592c8c14.txt \
//              [--salida <fichero>]
// SALIDAS: 0 medido entero (haya cortos o no: es una MEDICIÓN) · 2 no supe medir.
// Necesita `dist/` (lo pide `tests/_banco-vistas.mjs`). No escribe en el árbol salvo `--salida`.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../../scripts/_navegador.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes, cegueraDeLaFuente } from '../../../../../scripts/_hojas-del-panel.mjs';
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } from '../../../../../scripts/_medidor-de-toque.mjs';
import { serializar } from '../../../../../scripts/_pagina-panel.mjs';
import { cargarDashboard, pintarVista, todos } from '../../../../../tests/_banco-vistas.mjs';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO, IDS } from '../../../../../scripts/_datos-del-censo.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..', '..', '..', '..');
const PUBLIC = path.join(RAIZ, 'public');
const ANCHOS = [390, 929, 1280];
const ANCHOS_DEL_CENSO = [929, 390];
const SUELO_DEL_CENSO = 20; // `if (nodos < 20)` en censo-objetivo-tactil-panel.mjs

const arg = (nombre) => { const i = process.argv.indexOf(nombre); return i >= 0 ? process.argv[i + 1] : null; };
const lineas = [];
const decir = (s = '') => { lineas.push(s); console.log(s); };
let salida = 0;
const noSupe = (s) => { decir('🔴 CIEGO: ' + s); salida = 2; };

// ── los datos, con la forma que da el servidor ────────────────────────────────────────────────
const F = '2026-10-01T09:00:00.000Z';
// `GET /admin/jobs/:id` manda `partes` (src/modules/jobs/app/routes/jobs.routes.ts:689-693 y :819):
// `{ id, numero, fecha, estado }`, lo más nuevo primero. `TRABAJO_DE_MUESTRA` no lleva la clave.
const PARTES_DEL_TRABAJO = [
  { id: 42, numero: 'PT-2026-0042', fecha: F, estado: 'firmado' },
  { id: IDS.parte, numero: 'PT-2026-0041', fecha: F, estado: 'borrador' },
];
// La vista de oficina (partes.routes.ts:208-252): `puedeEditarPrecios` es `{ ok, motivo }`
// (src/modules/jobs/domain/parteTrabajo.ts:419) y `bloque` es `mano_obra` | `materiales` (:59).
const lineaOficina = (id, bloque, unds, descripcion, precioUnitario) => ({
  id, bloque, unds, descripcion, precioUnitario, tipoIva: null,
  importe: precioUnitario === null ? null : Math.round(precioUnitario * unds * 100) / 100,
});
const parteOficina = (id, numero, obra, lins) => ({
  id, jobId: IDS.trabajo, customerId: 5, clienteNombre: 'Ana Ruiz', numero, fecha: F, obra, referencia: null, tipo: null,
  tecnicos: ['Luis'], lineas: lins, notas: null, estado: 'firmado', firmadoAt: F, firmadoPorNombre: 'Ana Ruiz',
  sinValorar: lins.some((l) => l.precioUnitario === null),
  totalBase: lins.reduce((t, l) => t + (l.importe ?? 0), 0),
  puedeEditarContenido: { ok: false, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const PENDIENTES = [
  parteOficina(IDS.parte, 'PT-2026-0041', 'C/ Mayor 1', [
    lineaOficina(1, 'mano_obra', 2, 'Horas de oficial', 35),
    lineaOficina(2, 'materiales', 1, 'Grifo monomando', null),
    lineaOficina(3, 'materiales', 3, 'Latiguillo de 40 cm', null),
  ]),
  parteOficina(42, 'PT-2026-0042', 'Av. del Puerto 20', [lineaOficina(1, 'materiales', 1, 'Termo de 80 l', null)]),
  parteOficina(43, 'PT-2026-0043', 'C/ Colón 8', [lineaOficina(1, 'mano_obra', 1, 'Desplazamiento', null)]),
];

const DC = datosDelCenso();
/** Los datos del censo, con las rutas de `extra` contestadas aquí. Gana la primera que casa. */
const conDatos = (extra) => (url, opts) => {
  const camino = String(url).split('?')[0];
  for (const [re, dato] of extra) if (re.test(camino)) return dato();
  return DC.datos(url, opts);
};

// ── el DOM del banco ──────────────────────────────────────────────────────────────────────────
const es = (x, attr, valor) => typeof x.getAttribute === 'function' && x.getAttribute(attr) === valor;
const pestanasDe = (c) => todos(c).filter((x) => es(x, 'role', 'tab'));
const panelesDe = (c) => todos(c).filter((x) => es(x, 'role', 'tabpanel'));
const rotuloDe = (n) => String(n.textContent || '').replace(/\s+/g, ' ').trim();
const etiquetas = (c, tag) => todos(c).filter((x) => x.tagName === tag);
const ticks = async () => { for (let j = 0; j < 10; j++) await new Promise((ok) => setImmediate(ok)); };
const panelDePartes = (c) => panelesDe(c).find((p) => p.dataset && p.dataset.seccion === 'partes');

async function montar(fn, { datos = null, rol = null, preparar = null } = {}) {
  DC.enVista(fn);
  const banco = cargarDashboard(RAIZ, { datos: datos || DC.datos, ...(rol ? { rol } : {}) });
  const r = await pintarVista(banco, fn, ...(ARGUMENTOS_DEL_CENSO[fn] || []));
  if (r.error) throw new Error(`${fn} no monta: ${r.error.message}`);
  const alMontar = { nodos: todos(r.contenedor).length, html: serializar(r.contenedor) };
  const hechos = preparar ? await preparar(r.contenedor, alMontar) : {};
  return { html: serializar(r.contenedor), nodos: todos(r.contenedor).length, alMontar, hechos };
}

/** La pestaña «Partes» de la ficha: cuál abre sola, y abierta (con el oyente del producto si hace falta). */
const prepararPartes = async (c) => {
  const panel = panelDePartes(c);
  if (!panel) throw new Error('la ficha no tiene panel con data-seccion="partes"');
  const tab = pestanasDe(c).find((t) => t.getAttribute('aria-controls') === panel.id);
  const abiertaAlMontar = rotuloDe(pestanasDe(c).find((t) => es(t, 'aria-selected', 'true')) || { textContent: '(ninguna)' });
  if (!es(tab, 'aria-selected', 'true')) { tab.click(); await ticks(); }
  return {
    abiertaAlMontar, pestanas: pestanasDe(c).map(rotuloDe), panelId: panel.id, panelOculto: !!panel.hidden,
    filas: etiquetas(panel, 'TR').filter((tr) => tr._padre && tr._padre.tagName === 'TBODY').length,
    botonesDelPanel: etiquetas(panel, 'BUTTON').length,
  };
};

/** Lo que hace el censo con la ficha: pulsar cada pestaña no elegida, en orden, y comparar con el montaje. */
const reproducirElAvisoDelCenso = async (c, alMontar) => {
  const base = alMontar.html;
  // Cuál abre SOLA se lee ANTES de pulsar nada: después ya es la última que pulsó este recorrido.
  const abiertaAlMontar = rotuloDe(pestanasDe(c).find((t) => es(t, 'aria-selected', 'true')) || { textContent: '(ninguna)' });
  const vistos = [];
  const avisos = [];
  const iniciales = pestanasDe(c);
  for (const [k, t0] of iniciales.entries()) {
    if (es(t0, 'aria-selected', 'true')) continue;
    const t = pestanasDe(c)[k];
    t.click();
    await ticks();
    const html = serializar(c);
    if (html === base) avisos.push(`«${rotuloDe(t)}»: igual que AL MONTAR`);
    else if (vistos.includes(html)) avisos.push(`«${rotuloDe(t)}»: igual que otra pestaña ya abierta`);
    vistos.push(html);
  }
  return { avisos, ...(await prepararPartes(c)), abiertaAlMontar };
};

const prepararOficina = (abrirFila) => async (c) => {
  const lista = todos(c).find((x) => x.id === 'po-lista' || x._id === 'po-lista');
  const detalle = todos(c).find((x) => x.id === 'po-detalle' || x._id === 'po-detalle');
  if (!lista || !detalle) throw new Error('la lista de oficina no tiene #po-lista o #po-detalle');
  const filas = etiquetas(lista, 'BUTTON');
  if (abrirFila !== null) { filas[abrirFila].click(); await ticks(); }
  return {
    filas: filas.length, abierta: filas.filter((f) => es(f, 'aria-current', 'true')).length,
    casillasDePrecio: etiquetas(detalle, 'INPUT').length, botonesDelDetalle: etiquetas(detalle, 'BUTTON').length,
  };
};

// ═══ ① MONTAR ════════════════════════════════════════════════════════════════════════════════
const conPartes = conDatos([[/^\/admin\/jobs\/\d+$/, () => ({ ...DC.datos('/admin/jobs/' + IDS.trabajo), partes: PARTES_DEL_TRABAJO })]]);
const conPendientes = conDatos([
  [/^\/admin\/partes\/oficina\/pendientes$/, () => ({ firmadosLeidos: PENDIENTES.length, pendientes: PENDIENTES })],
  [/^\/admin\/partes\/\d+\/oficina$/, () => PENDIENTES[0]],
]);

const ESTADOS = [];
const anade = async (clave, rotulo, fn, opciones, dentro) => {
  try { ESTADOS.push({ clave, rotulo, fn, dentro, ...(await montar(fn, opciones)) }); }
  catch (e) { noSupe(`${clave} · ${rotulo}: ${String(e.message).slice(0, 160)}`); }
};
// Los dos CONTROLES: lo que el censo ya mide, montado con SUS datos y sin tocar nada.
await anade('K1', 'CONTROL · ficha del trabajo, dato del censo', 'renderJobDetailView', { preparar: reproducirElAvisoDelCenso }, null);
await anade('K2', 'CONTROL · ficha del parte, dato del censo', 'renderParteDetailView', {}, null);
// ① la pestaña «Partes» con partes, como jefe y como técnico.
await anade('P1', 'ficha · «Partes» con 2 partes (firmado + borrador) · admin', 'renderJobDetailView', { datos: conPartes, preparar: prepararPartes }, 'PANEL');
await anade('P2', 'ficha · «Partes» con 2 partes (firmado + borrador) · técnico', 'renderJobDetailView', { datos: conPartes, rol: 'tecnico', preparar: prepararPartes }, 'PANEL');
// ② la lista de oficina: como la monta el censo, llena, y con un parte abierto.
await anade('O1', 'oficina · lista con 1 pendiente (dato del censo)', 'renderPartesOficinaView', { preparar: prepararOficina(null) }, '#po-lista, #po-detalle');
await anade('O2', 'oficina · lista con 3 pendientes', 'renderPartesOficinaView', { datos: conPendientes, preparar: prepararOficina(null) }, '#po-lista, #po-detalle');
await anade('O3', 'oficina · 3 pendientes y el primero ABIERTO (3 líneas por valorar)', 'renderPartesOficinaView', { datos: conPendientes, preparar: prepararOficina(0) }, '#po-lista, #po-detalle');
for (const e of ESTADOS) if (e.dentro === 'PANEL') e.dentro = '#' + e.hechos.panelId;

const de = (clave) => ESTADOS.find((e) => e.clave === clave);
const exige = (cond, texto) => { decir(`   ${cond ? '✅' : '🔴'} ${texto}`); if (!cond) salida = 2; };

decir('═══ ① ROJO-PRIMERO · lo que el censo ve HOY de cada esquina ═══');
if (de('K1')) {
  const h = de('K1').hechos;
  decir(`ficha del trabajo, dato del censo · pestañas: ${h.pestanas.map((p) => `«${p}»`).join(' · ')}`);
  exige(h.abiertaAlMontar === 'Partes', `la pestaña que la ficha abre SOLA al montar es «${h.abiertaAlMontar}» (se espera «Partes»)`);
  exige(h.avisos.length === 1 && h.avisos[0].startsWith('«Partes»: igual que AL MONTAR'),
    `el aviso del censo, reproducido pulsando las pestañas en su orden: ${h.avisos.join(' | ') || '(ninguno)'}`);
  exige(h.filas === 0, `filas de partes en ese panel: ${h.filas} (se espera 0: el dato de muestra del Trabajo no lleva \`partes\`) · botones del panel: ${h.botonesDelPanel}`);
}
if (de('P1')) {
  const h = de('P1').hechos;
  exige(h.filas === PARTES_DEL_TRABAJO.length && !h.panelOculto,
    `con \`partes\` en el dato (forma de jobs.routes.ts:689-693): ${h.filas} filas, panel ${h.panelOculto ? 'OCULTO' : 'a la vista'}, ${h.botonesDelPanel} botones (abría sola «${h.abiertaAlMontar}»)`);
}
if (de('P2')) {
  const h = de('P2').hechos;
  exige(h.filas === PARTES_DEL_TRABAJO.length && !h.panelOculto, `lo mismo como técnico: ${h.filas} filas, ${h.botonesDelPanel} botones (abría sola «${h.abiertaAlMontar}»)`);
}
if (de('O1')) {
  const e = de('O1');
  exige(e.nodos < SUELO_DEL_CENSO && e.hechos.filas === 1,
    `lista de oficina, dato del censo: ${e.nodos} nodos (< ${SUELO_DEL_CENSO}, el suelo del censo → «NO MEDIDA») · ${e.hechos.filas} fila`);
}
if (de('O2')) {
  const e = de('O2');
  exige(e.nodos >= SUELO_DEL_CENSO && e.hechos.filas === PENDIENTES.length, `con ${PENDIENTES.length} pendientes: ${e.nodos} nodos (≥ ${SUELO_DEL_CENSO}) · ${e.hechos.filas} filas`);
}
if (de('O3')) {
  const h = de('O3').hechos;
  exige(h.abierta === 1 && h.casillasDePrecio === PENDIENTES[0].lineas.length && h.botonesDelDetalle === 1,
    `pulsando la primera fila (el censo sólo sabe abrir pestañas): ${h.abierta} fila marcada, ${h.casillasDePrecio} casillas de precio, ${h.botonesDelDetalle} botón en el parte abierto`);
}

// ═══ ② MEDIR ═════════════════════════════════════════════════════════════════════════════════
// Las tres sondas del censo, con sus mismos textos: corta (12×12), oculta y tapada (caja 40, toque 30).
const SONDA = '<button id="__sonda" style="width:12px;height:12px;padding:0;border:0">.</button>'
  + '<div style="display:none"><button id="__sondaOculta">:</button></div>'
  + '<div style="position:relative;width:120px;height:40px;margin:0">'
  + '<button id="__sondaTapada" style="display:block;box-sizing:border-box;width:120px;height:40px;min-height:0;padding:0;border:0;margin:0">;</button>'
  + '<div style="position:absolute;left:0;top:0;width:120px;height:10px"></div></div>';
const HOJAS = enlacesDelPanel(PUBLIC);
const pagina = (cuerpo) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + HOJAS + '</head><body>' + cuerpo + '</body></html>';
const rutas = new Map();
for (const e of ESTADOS) {
  rutas.set('/' + e.clave, pagina(e.html));
  rutas.set('/' + e.clave + '__sonda', pagina(e.html + SONDA));
}
const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
const srv = http.createServer((rq, res) => {
  const u = rq.url.split('?')[0];
  if (rutas.has(u)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(rutas.get(u)); }
  const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
  if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
  return res.end(fs.readFileSync(d));
});
const PUERTO = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));

// COPIA del `MEDIR` del censo (censo-objetivo-tactil-panel.mjs), más `dentro`. La vigila el control.
const MEDIR = `(async (SEL, MIN, DENTRO) => {
  const nodos = [...document.querySelectorAll(SEL)];
  const medidos = [], ocultos = [], sinCaja = [], noTocables = [];
  const oculto = (el) => {
    if (typeof el.checkVisibility === 'function') return !el.checkVisibility();
    for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).display === 'none') return true;
    return false;
  };
  const nombreDe = (el) => {
    let c = '';
    if (el.className && typeof el.className === 'string') c = el.className.trim().split(/\\s+/).filter(Boolean).join('.');
    return el.tagName + (c ? '.' + c : '');
  };
  for (const [i, el] of nodos.entries()) {
    const r0 = el.getBoundingClientRect();
    const ficha = { i, sel: nombreDe(el), dentro: !!(DENTRO && el.closest(DENTRO)),
      texto: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 34) || '(sin texto)' };
    if (!r0.width || !r0.height) { (oculto(el) ? ocultos : sinCaja).push(ficha); continue; }
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    if (m.error) { noTocables.push({ ...ficha, motivo: m.error }); continue; }
    medidos.push({ ...ficha, caja: m.caja, tocable: m.tocable, cumple: m.tocable >= MIN });
  }
  return { medidos, ocultos, sinCaja, noTocables, total: nodos.length };
})`;
const evalDe = (dentro) => `${FUENTE_MEDIDOR};${MEDIR}(${JSON.stringify(INTERACTIVOS)}, ${MINIMO_TACTIL}, ${JSON.stringify(dentro)})`;

const navegador = await lanzarNavegador(puppeteer, {});
const resultados = [];
const sondasFallidas = [];
const fuentesRotas = [];
const ir = async (page, ruta) => {
  await page.goto(`http://127.0.0.1:${PUERTO}${ruta}`, { waitUntil: 'load' });
  const ceguera = cegueraDeLaFuente(await esperarFuentes(page), ruta);
  if (ceguera) fuentesRotas.push(ceguera);
};
for (const ancho of ANCHOS) {
  for (const e of ESTADOS) {
    const page = await navegador.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    await ir(page, `/${e.clave}__sonda`);
    const rs = await page.evaluate(evalDe(e.dentro));
    const corta = rs.medidos.find((m) => m.sel === 'BUTTON' && m.texto === '.');
    if (!corta || corta.cumple !== false) sondasFallidas.push(`${e.clave} @${ancho} (la sonda corta ${corta ? 'NO sale corta' : 'ni se mide'})`);
    if (!rs.ocultos.some((m) => m.sel === 'BUTTON' && m.texto === ':')) sondasFallidas.push(`${e.clave} @${ancho} (la sonda oculta no sale como oculta)`);
    const tapada = rs.medidos.find((m) => m.sel === 'BUTTON' && m.texto === ';');
    if (!tapada || Math.abs(tapada.caja - 40) > 2 || Math.abs(tapada.tocable - 30) > 2) {
      sondasFallidas.push(`${e.clave} @${ancho} (la sonda tapada sale ${tapada ? `caja ${tapada.caja} · toque ${tapada.tocable}` : 'sin medir'} y no caja 40 · toque 30)`);
    }
    await ir(page, `/${e.clave}`);
    resultados.push({ clave: e.clave, ancho, ...(await page.evaluate(evalDe(e.dentro))) });
    await page.close();
  }
}
await navegador.close();
srv.close();

decir('\n═══ ② LAS SONDAS Y LA FUENTE ═══');
decir(`páginas medidas: ${resultados.length} (${ESTADOS.length} estados × ${ANCHOS.length} anchuras: ${ANCHOS.join(', ')}) · vara: ${MINIMO_TACTIL} px de toque`);
exige(sondasFallidas.length === 0, `las tres sondas (corta, oculta, tapada), en cada página: ${sondasFallidas.length} fallos${sondasFallidas.length ? ' → ' + sondasFallidas.join(' · ') : ''}`);
exige(fuentesRotas.length === 0, `la fuente de la app cargada en cada página: ${fuentesRotas.length} cegueras${fuentesRotas.length ? ' → ' + fuentesRotas.slice(0, 3).join(' · ') : ''}`);

// ═══ ③ EL CONTROL POSITIVO, CONTRA EL CENSO ══════════════════════════════════════════════════
decir('\n═══ ③ CONTROL POSITIVO · lo que el censo YA mide tiene que salir igual aquí ═══');
const rutaCenso = arg('--censo');
const filaDe = (r) => [r.medidos.length, r.medidos.filter((m) => !m.cumple).length, r.ocultos.length, r.sinCaja.length, r.noTocables.length];
if (!rutaCenso || !fs.existsSync(rutaCenso)) {
  noSupe('sin `--censo <salida de censo-objetivo-tactil-panel.mjs sobre este árbol>` no hay con qué comparar: las cifras de abajo no están contrastadas.');
} else {
  const texto = fs.readFileSync(rutaCenso, 'utf8');
  let comparadas = 0;
  for (const e of ESTADOS.filter((x) => x.clave.startsWith('K'))) {
    for (const ancho of ANCHOS_DEL_CENSO) {
      const m = texto.match(new RegExp(`^${e.fn}\\s+${ancho}\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*$`, 'm'));
      const mia = filaDe(resultados.find((r) => r.clave === e.clave && r.ancho === ancho));
      if (!m) { noSupe(`el censo no trae fila de ${e.fn} @${ancho}`); continue; }
      const suya = m.slice(1, 6).map(Number);
      comparadas++;
      exige(suya.join(' ') === mia.join(' '), `${e.fn} @${ancho} · medidos/cortos/ocultos/sinCaja/noTocables · censo ${suya.join('/')} · aquí ${mia.join('/')}`);
    }
  }
  exige(comparadas === 4, `filas comparadas: ${comparadas} de 4 (2 vistas × ${ANCHOS_DEL_CENSO.join(' y ')}; a 1280 el censo no mide: sin contraste)`);
}

// ═══ ④ LAS ESQUINAS ══════════════════════════════════════════════════════════════════════════
const marca = (m) => `caja ${m.caja} · toque ${m.tocable} ${m.cumple ? '✓' : '🔴 CORTO'}`;
const cortosDeLaEsquina = [];
decir('\n═══ ④ LAS ESQUINAS, ELEMENTO A ELEMENTO ═══');
for (const e of ESTADOS) {
  const porAncho = ANCHOS.map((a) => resultados.find((r) => r.clave === e.clave && r.ancho === a));
  decir(`\n── ${e.clave} · ${e.rotulo} · ${e.nodos} nodos`);
  for (const [k, r] of porAncho.entries()) {
    const [med, cor, ocu, sin, noT] = filaDe(r);
    const dentro = r.medidos.filter((m) => m.dentro);
    decir(`   @${ANCHOS[k]}: ${med} medidos · ${cor} cortos · ${ocu} ocultos · ${sin} sin caja · ${noT} no tocables`
      + (e.dentro ? ` · EN LA ESQUINA: ${dentro.length} medidos, ${dentro.filter((m) => !m.cumple).length} cortos` : ''));
    for (const m of r.noTocables.filter((x) => !e.dentro || x.dentro)) decir(`      ⚠️ no tocable${e.dentro ? ' (en la esquina)' : ''}: ${m.sel} «${m.texto}» → ${m.motivo}`);
    for (const m of r.ocultos.filter((x) => e.dentro && x.dentro)) decir(`      ⚠️ OCULTO en la esquina (no medido): ${m.sel} «${m.texto}»`);
    for (const m of r.sinCaja.filter((x) => e.dentro && x.dentro)) decir(`      ⚠️ sin caja en la esquina: ${m.sel} «${m.texto}»`);
  }
  // Cada elemento, una línea con sus tres anchuras: los de la esquina todos, los de fuera sólo los cortos.
  const indices = new Set();
  for (const r of porAncho) for (const m of r.medidos) if (e.dentro ? m.dentro : !m.cumple) indices.add(m.i);
  for (const i of [...indices].sort((a, b) => a - b)) {
    const v = porAncho.map((r) => r.medidos.find((m) => m.i === i));
    const uno = v.find(Boolean);
    decir(`   ${uno.sel} «${uno.texto}»`);
    decir('      ' + v.map((m, k) => `@${ANCHOS[k]}: ${m ? marca(m) : 'sin medir'}`).join(' | '));
    if (e.dentro) for (const [k, m] of v.entries()) if (m && !m.cumple) cortosDeLaEsquina.push(`${e.clave} @${ANCHOS[k]} · ${m.sel} «${m.texto}» · caja ${m.caja} · toque ${m.tocable}`);
  }
  if (e.dentro) {
    const fuera = porAncho.flatMap((r, k) => r.medidos.filter((m) => !m.dentro && !m.cumple).map((m) => `@${ANCHOS[k]} ${m.sel} «${m.texto}» toque ${m.tocable}`));
    decir(`   fuera de la esquina, cortos: ${fuera.length}${fuera.length ? ' → ' + fuera.join(' · ') : ''}`);
  }
}

decir('\n═══ EL NÚMERO ═══');
const medidosEnEsquina = resultados.reduce((t, r) => t + r.medidos.filter((m) => m.dentro).length, 0);
decir(`   mediciones dentro de las dos esquinas (estado × anchura × elemento): ${medidosEnEsquina}`);
decir(`   de ellas, por debajo de ${MINIMO_TACTIL} px: ${cortosDeLaEsquina.length}`);
for (const c of cortosDeLaEsquina) decir('   🔴 ' + c);
if (!medidosEnEsquina) noSupe('cero mediciones dentro de las esquinas: el selector de la esquina no casa con nada, y un cero así no es limpieza.');
decir(`   NO MEDIDO y dicho: la lista de oficina VACÍA (no tiene nada que tocar) · el parte abierto de un parte ya FACTURADO (casillas deshabilitadas, sin botón) · la ficha de un Trabajo CERRADO (la barra de «Partes» va oculta) · los estados de error con «Reintentar».`);
decir(salida ? '\n🔴 SALIDA 2: no supe medir (arriba, cada 🔴).' : '\n✅ SALIDA 0: medido entero; los cortos, si los hay, están listados.');

if (arg('--salida')) fs.writeFileSync(arg('--salida'), lineas.join('\n') + '\n', 'utf8');
process.exitCode = salida;
