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
    filtrosCobro: nodos.filter((n) => n.tagName === 'BUTTON' && /^(Pendiente|Parcial|Pagado) · /.test(texto(n))).length,
    lineasDe: nodos.filter((n) => tiene(n, 'jobs-importe-de')).length,
    salvedad: nodos.filter((n) => tiene(n, 'jobs-grupo-salvedad')).length,
    cabeceraTerminados: texto(nodos.find((n) => tiene(n, 'jobs-grupo-titulo') && texto(n).includes('Terminados')) || { hijos: [] }),
    celdas,
  };
}

// Los dos roles van con su nombre ESCRITO, no construido en un bucle (SCRUM-1415: la señal por nombres
// no puede echar en falta un test cuyo nombre no está en el fuente).
async function sinCobroParaElRol(rol) {
  const m = await montar(rol);
  assert.doesNotMatch(m.todo, /Por cobrar/, '🔴 la tarjeta «Por cobrar» sigue (c.21547 la quita)');
  assert.equal(m.filtrosCobro, 0, `🔴 ${m.filtrosCobro} filtros de cobro (Pendiente/Parcial/Pagado) a la vista`);
  assert.equal(m.lineasDe, 0, `🔴 ${m.lineasDe} líneas «de X €»: es lo que falta por cobrar, no el importe`);
  assert.doesNotMatch(m.cabeceraTerminados, /por cobrar/, `🔴 la cabecera de Terminados dice «${m.cabeceraTerminados}»`);
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
  assert.ok(m.lineasDe >= 1, '🔴 CIEGO: el admin no ve ninguna línea «de X €»');
  assert.match(m.cabeceraTerminados, /por cobrar/, `🔴 CIEGO: la cabecera de Terminados del admin dice «${m.cabeceraTerminados}»`);
});
