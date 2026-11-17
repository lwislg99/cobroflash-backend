// tests/scrum1707b-lista-albaranes-sin-importe-operario.test.mjs — SCRUM-1707 (apéndice S2, PILOTO-1)
//
// Sin gate: monta la lista en el banco y lee styles.css. Ni BD, ni red, ni navegador.
//
// Medido por S4 el 16-nov-2026 (SCRUM-1707 c.21939): desde #3153 el servidor manda `total: null` en
// cada fila del listado al operario (`filaDeAlbaranParaElRol`, firma c.21547 Q2), y la lista le
// pintaba la columna «Importe» con «—» en TODAS las filas: una columna que para su rol nunca lleva
// dato. Aquí se fija que, para quien no ve precios, la columna NO EXISTE —ni cabecera ni celda— y
// que el admin la conserva (control positivo).
//
// La respuesta del banco pasa por la MISMA proyección que el servidor (`filaDeAlbaranParaElRol` del
// dist), y la decisión de la pantalla se compara con la del servidor (`seesOnlyOwnJobs`) rol a rol:
// dos sitios respondiendo la misma pregunta es como acaban diciendo cosas distintas (SCRUM-597).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';
import { ALBARAN_ESTADOS } from '../dist/modules/jobs/domain/albaran.service.js';
import { filaDeAlbaranParaElRol } from '../dist/modules/jobs/domain/albaranParaElRol.js';
import { seesOnlyOwnJobs } from '../dist/core/http/roleCapabilities.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = soloCodigo(fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8'), 'styles.css');

const fila = (extra) => ({ emisionAt: '2026-11-10T10:00:00Z', fecha: '2026-11-10T10:00:00Z', cliente: 'Ana Ruiz',
  trabajo: 'Cambio de grifo', jobId: 1, quote: null, estadoFacturacion: 'sin_facturar', ...extra });
const FILAS = [
  fila({ id: 1, numero: 'AB260006', estado: 'emitido', modoValoracion: 'VALORADO', total: 242.36 }),
  fila({ id: 2, numero: 'AB260005', estado: 'emitido', modoValoracion: 'SIN_VALORAR', total: null }),
];

function red(rol) {
  const datos = {
    filas: FILAS.map((f) => filaDeAlbaranParaElRol(f, rol)),
    ejes: { estado: [...ALBARAN_ESTADOS], cobro: ['sin_facturar', 'parcial', 'facturado'] },
    contadores: { total: 2, porEstado: { emitido: 2 }, porCobro: { sin_facturar: 2 } },
  };
  const resp = (data) => ({
    ok: true, status: 200, statusText: '200', headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => (/\/admin\/albaranes(\?|$)/.test(String(url)) ? resp(datos) : resp({})),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}
const conClase = (n, c) => typeof n.className === 'string' && n.className.split(' ').includes(c);
const texto = (n) => String(n.textContent == null ? '' : n.textContent).replace(/[  ]/g, ' ').trim();

async function tablaPara(rol) {
  const banco = cargarDashboard(RAIZ, { red: red(rol), rol });
  banco.ctx.appModoEmision = 'fiscal';
  const v = await pintarVista(banco, 'renderAlbaranesView');
  assert.ok(!v.error, `🔴 SUELO (${rol}): la lista no se pinta: ${v.error && v.error.message}`);
  await new Promise((r) => setTimeout(r, 40));
  const nodos = todos(v.contenedor);
  const trs = nodos.filter((n) => n.tagName === 'TR' && n.hijos.some((h) => conClase(h, 'cell-id')));
  assert.equal(trs.length, 2, `🔴 SUELO (${rol}): esperaba 2 filas y veo ${trs.length}; lo de abajo no probaría nada`);
  // La cabecera se escribe con innerHTML: el banco la guarda como texto del <thead>.
  const thead = nodos.find((n) => n.tagName === 'THEAD');
  assert.ok(thead, `🔴 SUELO (${rol}): no encuentro el <thead>`);
  const cabecera = String(thead.innerHTML || '');
  const ths = (cabecera.match(/<th[\s>]/g) || []).length;
  assert.ok(ths >= 7, `🔴 SUELO (${rol}): leo ${ths} cabeceras; no estoy leyendo la cabecera`);
  return { trs, cabecera, ths };
}

const ROLES = ['admin', 'tecnico', 'operario', 'comercial'];

test('SCRUM-1707 · ADMIN (control positivo): la columna «Importe» sigue, con su cabecera y su dato', async () => {
  const { trs, cabecera, ths } = await tablaPara('admin');
  assert.match(cabecera, />Importe</, '🔴 el admin perdió la cabecera «Importe»');
  assert.equal(ths, 8, `🔴 el admin debería tener 8 columnas y tiene ${ths}`);
  const celdas = trs.map((tr) => tr.hijos.find((h) => conClase(h, 'cell-amount')));
  assert.ok(celdas.every(Boolean), '🔴 al admin le falta la celda `cell-amount` en alguna fila');
  assert.deepEqual(celdas.map(texto), ['242,36 €', '—'], '🔴 el admin no ve el importe que manda el servidor');
  for (const tr of trs) assert.equal(tr.hijos.length, ths, '🔴 admin: celdas por fila ≠ cabeceras');
});

for (const rol of ROLES.filter((r) => r !== 'admin')) {
  test(`SCRUM-1707 · «${rol}» (sin precios): la columna «Importe» NO existe — ni cabecera ni celda`, async () => {
    const { trs, cabecera, ths } = await tablaPara(rol);
    assert.doesNotMatch(cabecera, />Importe</, `🔴 a «${rol}» se le pinta la cabecera «Importe», y el servidor no le manda ni un importe`);
    assert.equal(ths, 7, `🔴 «${rol}» debería tener 7 columnas y tiene ${ths}`);
    for (const tr of trs) {
      assert.ok(!tr.hijos.some((h) => conClase(h, 'cell-amount')), `🔴 a «${rol}» le sale la celda \`cell-amount\` (el «—» de cada fila)`);
      assert.equal(tr.hijos.length, ths, `🔴 «${rol}»: celdas por fila ≠ cabeceras, la tabla se descuadra`);
    }
    // El resto de la fila se queda: lo único que se va es el importe.
    assert.match(cabecera, />Estado</, `🔴 a «${rol}» se le fue también «Estado»`);
  });
}

test('SCRUM-1707 · la pantalla responde lo MISMO que el servidor: sin columna ⇔ `seesOnlyOwnJobs`', async () => {
  // `owner` NO entra: es un pseudo-rol de los serializadores de métricas; `requireAuth` lo normaliza a
  // 'admin' y el panel nunca lo recibe como `appUserRole`.
  for (const rol of ROLES) {
    const { cabecera } = await tablaPara(rol);
    const pinta = />Importe</.test(cabecera);
    assert.equal(pinta, !seesOnlyOwnJobs(rol),
      `🔴 «${rol}»: la pantalla ${pinta ? 'pinta' : 'quita'} la columna y el servidor ${seesOnlyOwnJobs(rol) ? 'NO' : 'SÍ'} le manda el importe`);
  }
});

test('SCRUM-1707 · la alineación de la cabecera «Importe» no va por POSICIÓN', () => {
  // Sin la columna, la 6.ª cabecera es «Estado»: un `th:nth-child(6)` la alinearía a la derecha.
  assert.ok(!/\.table--albaranes th:nth-child\(6\)/.test(CSS),
    '🔴 la cabecera del importe se alinea con `th:nth-child(6)`: sin la columna, alinea «Estado»');
  assert.match(CSS, /\.table--albaranes th\.col-importe/, '🔴 NO PUDE MIRAR: no encuentro la regla de la cabecera `th.col-importe`');
});
