// tests/scrum1602-paquete-del-trimestre.test.mjs — SCRUM-1602
//
// LA TARJETA «PAQUETE DEL TRIMESTRE» DE DESCARGAR DATOS SE PUEDE ALCANZAR, Y SÓLO EN MODO FISCAL.
//
// `GET /admin/evidencias.zip?year=&quarter=` (J1, SCRUM-297) existía y ninguna pantalla lo ofrecía.
// Decisiones y textos: SCRUM-1251 comentario 20675. Aquí se mide POR EFECTO, en el banco de vistas
// (`_banco-vistas.mjs`): la vista se pinta con cada modo, se pulsa el botón de verdad y se mira qué
// se pidió, qué cabecera se leyó y qué quedó escrito en la tarjeta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/exportView.js');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La tarjeta se pinta en todos los modos: un claim fiscal visible antes de SIF-1.
    fichero: 'public/dashboard/js/exportView.js',
    de: "const conPaquete = window.appModoEmision === 'fiscal';",
    a: 'const conPaquete = true;',
    cae: 'SCRUM-1602 · fuera de `fiscal` la tarjeta NO EXISTE (receipt, demo, desconocido)',
  },
  {
    // Sin cabecera, `Number(null)` es 0 y la tarjeta diría «no hay facturas» sin haberlo mirado.
    fichero: 'public/dashboard/js/exportView.js',
    de: 'const filas = crudo === null ? NaN : Number(crudo);',
    a: 'const filas = Number(crudo);',
    cae: 'SCRUM-1602 · sin `X-Yaqu-Filas` NO se afirma el vacío',
  },
  {
    // El mismo hueco, en la tarjeta vecina (arreglado de paso).
    fichero: 'public/dashboard/js/exportView.js',
    de: 'const filas = crudoLibro === null ? NaN : Number(crudoLibro);',
    a: 'const filas = Number(crudoLibro);',
    cae: 'SCRUM-1602 · de paso: «Facturas emitidas» tampoco afirma el vacío sin `X-Yaqu-Filas`',
  },
  {
    // Los parámetros de emitidas (`año`/`trimestre`): la ruta los ignora y da el trimestre EN CURSO.
    fichero: 'public/dashboard/js/exportView.js',
    de: 'const qs = new URLSearchParams({ year: inpAnio.value, quarter: selTri.value });',
    a: "const qs = new URLSearchParams({ 'año': inpAnio.value, trimestre: selTri.value });",
    cae: 'SCRUM-1602 · ① se ALCANZA: el botón pide el ZIP del año y trimestre elegidos y avisa al acabar',
  },
];

// Los ocho textos firmados (SCRUM-1251 comentario 20675), tal cual.
const T1 = 'Paquete del trimestre';
const T2 = 'Un ZIP con las facturas del trimestre, el resumen de IVA y la comprobación de los albaranes firmados, para tu asesor.';
const T3 = 'Dentro va un índice que marca, factura por factura, lo que falta o no cuadra.';
const T4 = 'Descargar ZIP';
const T5 = 'Preparando la descarga…';
const T6 = 'Descarga lista.';
const T7 = 'No hemos podido preparar la descarga. Inténtalo otra vez.';
const VACIO = 'No hay facturas en este periodo.';

const PROHIBIDAS = ['VeriFactu', 'Hacienda', 'AEAT', 'libro registro', 'modelo 303', 'cumplimiento', 'demuestra', 'inspección'];

/**
 * Un `fetch` que contesta el ZIP con las cabeceras que se le den, y JSON a todo lo demás (el
 * recuento de la tarjeta de arriba lo pide al pintarse). Apunta cada URL y el rótulo del botón en
 * el momento de la petición, que es cuando se ve «Preparando…».
 */
function redDelZip({ status = 200, tipo = 'application/zip', filas } = {}, banco) {
  const pedidas = [];
  const fetch = async (url) => {
    const u = String(url);
    if (!u.startsWith('/admin/evidencias.zip')) {
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}), text: async () => '' };
    }
    pedidas.push({ url: u, rotulo: banco.ref?.reg.porId.get('btn-paquete-trimestre')?.textContent });
    const cab = {
      'content-type': tipo,
      'content-disposition': 'attachment; filename="evidencias-1-2026-T3.zip"',
    };
    if (filas !== undefined) cab['x-yaqu-filas'] = String(filas);
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k) => (cab[String(k).toLowerCase()] ?? null) },
      blob: async () => new Blob(['PK']),
      json: async () => ({ error: 'internal_error' }),
      text: async () => '',
    };
  };
  return { fetch, pedidas };
}

/** Monta Descargar datos con un modo de emisión y devuelve el banco, la red y los toasts. */
async function montar(modo, respuesta) {
  const ref = {};
  const red = redDelZip(respuesta, ref);
  const banco = cargarDashboard(RAIZ, { red: { fetch: red.fetch } });
  ref.ref = banco;
  banco.ctx.appModoEmision = modo;
  const toasts = [];
  banco.ctx.showToast = (m, t) => { toasts.push({ m: String(m), t }); };
  const r = await pintarVista(banco, 'renderExportView');
  return { banco, r, red, toasts, el: (id) => banco.reg.porId.get(id) };
}

/** Pulsa y espera a que el botón vuelva a estar disponible (el `finally` del manejador). */
async function pulsar(el) {
  const btn = el('btn-paquete-trimestre');
  btn.click();
  for (let i = 0; i < 50 && btn.disabled; i++) await new Promise((r) => setTimeout(r, 0));
  assert.equal(btn.disabled, false, 'el manejador no terminó: el botón sigue deshabilitado');
}

// ═══ SUELO ═══════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1602 · SUELO: Descargar datos se pinta y la tarjeta vecina («Facturas emitidas») está', async () => {
  const { r, el } = await montar('fiscal', { filas: 2 });
  assert.equal(r.error, null, `🔴 la vista revienta al abrirse: ${r.error && r.error.message}`);
  assert.deepEqual(r.idsNoResueltos, [], '🔴 la vista busca ids que su marcado no declara');
  for (const id of ['libro-emitidas-card', 'libro-anio', 'libro-trimestre']) {
    assert.ok(el(id), `🔴 BANCO CIEGO: no veo \`#${id}\`; sin el selector de emitidas no hay periodo que leer`);
  }
});

// ═══ ① QUIÉN LA VE ═══════════════════════════════════════════════════════════════════════════

test('SCRUM-1602 · en modo `fiscal` la tarjeta EXISTE, con su título, sus dos textos y su botón', async () => {
  const { el } = await montar('fiscal', { filas: 2 });
  const card = el('paquete-trimestre-card');
  assert.ok(card, '🔴 en modo fiscal no se pinta la tarjeta: la ruta sigue sin pantalla que la ofrezca');
  assert.ok(el('btn-paquete-trimestre'), '🔴 la tarjeta está pero sin botón');
  assert.equal(el('btn-paquete-trimestre').textContent, T4);
  // El mini-DOM no agrega `textContent` (`_banco-vistas.mjs`, punto 4): los textos se miran en el
  // marcado de la tarjeta, que es lo que se asigna con `innerHTML`.
  const marcado = /const TARJETA_PAQUETE_TRIMESTRE = `([\s\S]*?)`;/.exec(fs.readFileSync(VISTA, 'utf8'));
  assert.ok(marcado, '🔴 CIEGO: no encuentro el marcado de la tarjeta');
  for (const t of [T1, T2, T3, T4]) {
    assert.ok(marcado[1].includes(t), `🔴 falta el texto firmado «${t}» en la tarjeta`);
  }
});

test('SCRUM-1602 · fuera de `fiscal` la tarjeta NO EXISTE (receipt, demo, desconocido)', async () => {
  for (const modo of ['receipt', 'demo', null, undefined, 'FISCAL']) {
    const { r, el } = await montar(modo, { filas: 2 });
    assert.equal(r.error, null, `🔴 con modo ${String(modo)} la vista revienta: ${r.error && r.error.message}`);
    assert.equal(el('paquete-trimestre-card'), undefined,
      `🔴 con modo ${String(modo)} se pinta «${T1}»: dentro del ZIP los ficheros llevan nombres fiscales, ` +
      'y antes de SIF-1 eso es un claim (reglas 7/17/24). Sólo `fiscal` (SCRUM-1251 c.20675, P2).');
    assert.equal(el('btn-paquete-trimestre'), undefined);
    // Y lo demás de la pantalla sigue: ocultar la tarjeta no puede romper la vecina.
    assert.ok(el('btn-libro-emitidas'), `🔴 con modo ${String(modo)} desaparece también «Facturas emitidas»`);
  }
});

// ═══ ② SE ALCANZA ════════════════════════════════════════════════════════════════════════════

test('SCRUM-1602 · ① se ALCANZA: el botón pide el ZIP del año y trimestre elegidos y avisa al acabar', async () => {
  const { el, red, toasts } = await montar('fiscal', { filas: 2 });
  el('libro-anio').value = '2025';
  el('libro-trimestre').value = '3';
  await pulsar(el);
  assert.deepEqual(red.pedidas.map((p) => p.url), ['/admin/evidencias.zip?year=2025&quarter=3'],
    '🔴 no se pidió el ZIP del periodo elegido. La ruta lee `year` y `quarter`; con otros nombres da ' +
    'el trimestre EN CURSO sin avisar.');
  assert.equal(red.pedidas[0].rotulo, T5, '🔴 mientras prepara, el botón no dice «Preparando la descarga…»');
  assert.equal(el('paquete-trimestre-info').textContent, T6);
  assert.equal(el('btn-paquete-trimestre').textContent, T4, '🔴 el botón no recupera su rótulo');
  assert.deepEqual(toasts, [], '🔴 una descarga buena no debe sacar ningún aviso de error');
});

test('SCRUM-1602 · un trimestre vacío (`X-Yaqu-Filas: 0`) se DICE', async () => {
  const { el } = await montar('fiscal', { filas: 0 });
  await pulsar(el);
  assert.equal(el('paquete-trimestre-info').textContent, VACIO);
});

test('SCRUM-1602 · sin `X-Yaqu-Filas` NO se afirma el vacío', async () => {
  const { el, red } = await montar('fiscal', {});
  await pulsar(el);
  assert.equal(red.pedidas.length, 1, 'suelo: la descarga se pidió');
  assert.equal(el('paquete-trimestre-info').textContent, T6,
    '🔴 sin cabecera la tarjeta dice que no hay facturas: «no pude mirar» y «no hay nada» salen iguales.');
});

test('SCRUM-1602 · de paso: «Facturas emitidas» tampoco afirma el vacío sin `X-Yaqu-Filas`', async () => {
  // La tarjeta vecina tenía el mismo hueco. Su fetch se sirve aparte: es otra ruta y es un CSV.
  for (const [filas, espera] of [[undefined, T6], ['0', VACIO], ['3', T6]]) {
    const pedidas = [];
    const banco = cargarDashboard(RAIZ, { red: { fetch: async (url) => {
      const u = String(url);
      if (!u.startsWith('/admin/libros/expedidas.csv')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}), text: async () => '' };
      }
      pedidas.push(u);
      const cab = { 'content-type': 'text/csv; charset=utf-8' };
      if (filas !== undefined) cab['x-yaqu-filas'] = filas;
      return { ok: true, status: 200, headers: { get: (k) => (cab[String(k).toLowerCase()] ?? null) }, blob: async () => new Blob(['x']) };
    } } });
    banco.ctx.showToast = () => {};
    await pintarVista(banco, 'renderExportView');
    const btn = banco.reg.porId.get('btn-libro-emitidas');
    btn.click();
    for (let i = 0; i < 50 && btn.disabled; i++) await new Promise((r) => setTimeout(r, 0));
    assert.equal(pedidas.length, 1, 'suelo: se pidió el CSV de emitidas');
    assert.equal(banco.reg.porId.get('libro-emitidas-info').textContent, espera,
      `🔴 con X-Yaqu-Filas=${String(filas)} la tarjeta de emitidas no dice «${espera}»`);
  }
});

test('SCRUM-1602 · un fallo del servidor y una respuesta que no es ZIP dan el texto firmado de error', async () => {
  for (const respuesta of [{ status: 500 }, { tipo: 'text/html; charset=utf-8', filas: 2 }]) {
    const { el, toasts } = await montar('fiscal', respuesta);
    await pulsar(el);
    assert.deepEqual(toasts, [{ m: T7, t: 'error' }], `🔴 con ${JSON.stringify(respuesta)} el aviso no es T7`);
    assert.equal(el('paquete-trimestre-info').textContent, '', '🔴 tras un fallo la tarjeta dice que la descarga está lista');
    assert.equal(el('btn-paquete-trimestre').textContent, T4);
  }
});

// ═══ ③ LOS TEXTOS: SÓLO LOS FIRMADOS ═════════════════════════════════════════════════════════

test('SCRUM-1602 · la tarjeta no lleva ninguna palabra vetada (c.20672 §3)', () => {
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const m = /const TARJETA_PAQUETE_TRIMESTRE = `([\s\S]*?)`;/.exec(fuente);
  assert.ok(m, '🔴 CIEGO: no encuentro el marcado de la tarjeta');
  assert.ok(m[1].includes(T1), 'suelo: el marcado leído es el de la tarjeta');
  for (const p of PROHIBIDAS) {
    assert.ok(!m[1].toLowerCase().includes(p.toLowerCase()), `🔴 la tarjeta dice «${p}»: claim fiscal antes de SIF-1`);
  }
  // Control positivo del detector: el aviso de la tarjeta de arriba sí lleva una (y es anterior).
  assert.ok(fuente.toLowerCase().includes('verifactu'), 'CIEGO: el detector no ve una palabra que sabemos que está');
});
