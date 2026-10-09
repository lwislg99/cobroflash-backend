// tests/scrum917i-el-resumen-vacio-no-se-cuelga.test.mjs — SCRUM-917i
//
// LA FICHA DEL TRABAJO NO CUELGA UNA SECCIÓN SIN NADA DENTRO.
//
// ── LO MEDIDO EN EL PASO 0 (9-oct-2026, yaqu.app, build 85d8d01e, cuenta QA, Trabajo 76) ───
//   El resumen del dinero (`sumSec`) se colgaba SIEMPRE, antes de saber si tenía algo que decir.
//   En un Trabajo sin importe (`totalAceptado` null) no hay franja, y quedaba en pantalla
//   `<div class="detail-section"><div class="detail-summary"></div></div>`: 37 px de relleno y
//   borde, a 1280 y a 390. Lo vio S4 el 7-oct (SCRUM-917, c.18650).
//
// ── POR QUÉ SE MIDE MONTADO ───────────────────────────────────────────────────────────────
//   El defecto no se lee en el fuente: las dos versiones tienen las mismas líneas y sólo cambia
//   bajo qué condición se ejecuta una. Aquí se monta la vista en el banco (el mismo de `scrum651`
//   y `scrum817`) y se mira el árbol. Los 37 px son del navegador y no los mide este fichero: los
//   mide la sonda de la entrega (`docs/master/SCRUM-917.md`, sección 917i).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

const JOB = {
  id: 7, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
  customer: { id: 3, name: 'Bar Paco' }, asignados: [], operario: null,
  albaranes: [], gastos: [], notes: '', quote: { currency: 'EUR' }, direccion: null, invoices: [],
};

async function montarDetalle(job) {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    if (/\/admin\/team/.test(u)) return [];
    if (/\/admin\/merchant/.test(u)) return { name: 'Epipe' };
    if (/\/admin\/partes/.test(u)) return { partes: [] };
    if (/gastos/.test(u)) return [];
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la vista no monta (${r.error && r.error.message}). Una pantalla que no se pinta no tiene secciones vacías: no tiene ninguna.`);
  return r;
}

const clases = (n) => String(n.className || '').split(/\s+/).filter(Boolean);
const CONTROLES = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'IMG', 'SVG'];
/** Una sección dice algo si ella o algún descendiente lleva texto propio, o si tiene un control. */
const diceAlgo = (sec) => todos(sec).some((n) => String(n.textContent || '').trim() !== '' || CONTROLES.includes(n.tagName));
const secciones = (r) => todos(r.contenedor).filter((n) => clases(n).includes('detail-section'));
const resumenes = (r) => todos(r.contenedor).filter((n) => clases(n).includes('detail-summary'));
const franjas = (r) => todos(r.contenedor).filter((n) => clases(n).includes('detail-dinero'));

test('SCRUM-917i · 🔴 un Trabajo sin importe no cuelga el resumen vacío', async () => {
  const sin = await montarDetalle({ ...JOB, totalAceptado: null, totalCobrado: 0 });

  // SUELO: la ficha tiene secciones. Sin esto, «ninguna vacía» pasaría sobre una pantalla en blanco.
  const todas = secciones(sin);
  assert.ok(todas.length >= 3,
    `🔴 SUELO: la ficha montada sólo tiene ${todas.length} secciones. El instrumento no está mirando la ficha del Trabajo.`);

  const vacias = todas.filter((s) => !diceAlgo(s));
  assert.equal(vacias.length, 0,
    `🔴 LA FICHA CUELGA ${vacias.length} SECCIÓN(ES) SIN NADA DENTRO (de ${todas.length}). En el navegador ` +
    'son 37 px de relleno y borde entre «Lo que falta» y «Albaranes». Una sección se cuelga cuando ' +
    'tiene algo que decir, no antes.');

  // Y por su nombre, que es el caso medido: sin franja no hay fila de resumen.
  assert.equal(franjas(sin).length, 0, '🔴 SUELO: este Trabajo no tiene importe y aun así hay franja del dinero: el caso no es el que dice ser.');
  assert.equal(resumenes(sin).length, 0,
    '🔴 el resumen (`detail-summary`) está colgado en un Trabajo sin importe: no tiene nada dentro.');
});

test('SCRUM-917i · ✅ con importe, el resumen sigue colgado, con su franja y en su sitio', async () => {
  // CONTROL POSITIVO: si el resumen no se colgara NUNCA, el test de arriba pasaría igual. Y son
  // dos casos a propósito: 480 € (con eje) y 0 € (SCRUM-651: un aceptado de 0 es un dato que
  // CONSTA, y la franja lo dice). La guarda es «consta», no «es mayor que cero».
  for (const totalAceptado of [480, 0]) {
    const con = await montarDetalle({ ...JOB, totalAceptado, totalCobrado: 0 });
    const res = resumenes(con);
    assert.equal(res.length, 1,
      `🔴 con totalAceptado ${totalAceptado} hay ${res.length} filas de resumen colgadas y tiene que haber UNA: ` +
      'el arreglo se ha llevado el dinero de la ficha.');
    assert.equal(todos(res[0]).filter((n) => clases(n).includes('detail-dinero')).length, 1,
      `🔴 con totalAceptado ${totalAceptado} el resumen está colgado pero sin su franja dentro.`);

    // EN SU SITIO: la sección del resumen va antes que la de «Albaranes», como antes del arreglo.
    const orden = secciones(con);
    const iResumen = orden.findIndex((s) => todos(s).includes(res[0]));
    const iAlbaranes = orden.findIndex((s) => todos(s).some((n) => String(n.textContent || '').trim() === 'Albaranes'));
    assert.ok(iAlbaranes >= 0, '🔴 SUELO: no se encuentra la sección «Albaranes»: no hay contra qué medir el orden.');
    assert.ok(iResumen >= 0 && iResumen < iAlbaranes,
      `🔴 el resumen ya no va antes de «Albaranes» (resumen ${iResumen}, albaranes ${iAlbaranes}): colgarlo más tarde lo ha movido de sitio.`);

    assert.equal(secciones(con).filter((s) => !diceAlgo(s)).length, 0,
      `🔴 con totalAceptado ${totalAceptado} hay alguna sección sin nada dentro.`);
  }
});
