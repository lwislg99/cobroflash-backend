// tests/scrum1249-descarga-recibidas-alcanzable.test.mjs — SCRUM-1249
//
// `GET /admin/libros/recibidas.csv` (SCRUM-426) estaba construida en el servidor y NINGUNA pantalla
// la pedía (censo de SCRUM-1195, veredicto (a) DEFECTO). Y existían las dos pantallas que podían
// ofrecerla: «Exportar», que ya ofrece las emitidas, y «Facturas recibidas» (SCRUM-1040).
//
// Se mide PULSANDO, no leyendo: se montan las dos pantallas en el banco del panel, se pulsa CADA
// control que tenga un oyente de `click`, y se anota cada URL que sale por la red. Un `grep` no
// distingue una llamada de un comentario que la nombra — el censo de 1195 contó cinco
// «consumidores» de otra ruta y eran comentarios.
//
// CONTROL POSITIVO: con el mismo instrumento, `expedidas.csv` SÍ tiene que salir (la pide «Exportar»
// desde SCRUM-325). Sin él, un pulsador que no pulsa nada daría el mismo «no sale» que el defecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const RECIBIDAS_VACIO = { filas: [], miradas: 0, avisos: [], desde: null, hasta: null };

/** Monta una pantalla, pulsa todo lo pulsable y devuelve las URL pedidas y cuántos controles pulsó. */
async function pulsarTodo(nombreFn, { antesDePulsar } = {}) {
  const pedidas = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => {
      if (/\/admin\/libros\/recibidas\.json\?/.test(String(url))) return RECIBIDAS_VACIO;
      return {};
    },
  });
  // ⚠️ El `fetch` del banco solo llama a `datos` cuando alguien lee `.json()`, y una DESCARGA
  // (`descargarBinario`) nunca lo lee: sin este envoltorio, el pulsador no veía ninguna descarga y
  // el control positivo salió CIEGO en la primera pasada (confesado en docs/master/SCRUM-1249.md).
  const fetchDelBanco = banco.ctx.fetch;
  banco.ctx.fetch = (url, opts) => { pedidas.push(String(url)); return fetchDelBanco(url, opts); };
  const r = await pintarVista(banco, nombreFn);
  assert.equal(r.error, null, `${nombreFn} no se montó: ${r.error && r.error.message}`);
  if (antesDePulsar) antesDePulsar(banco);
  const alMontar = pedidas.length;
  let pulsados = 0;
  for (const n of todos(r.contenedor)) {
    if (!(n._oyentes && (n._oyentes.click || []).length)) continue;
    n.disabled = false;
    pulsados += n.disparar('click');
    for (let i = 0; i < 10; i++) await new Promise((res) => setImmediate(res));
  }
  return { pedidas, alMontar, pulsados, banco };
}

const LA_DESCARGA = /^\/admin\/libros\/recibidas\.csv\?/;

test('SCRUM-1249 · CONTROL POSITIVO: el mismo pulsador SÍ encuentra la descarga de emitidas en «Exportar»', async () => {
  const { pedidas, pulsados } = await pulsarTodo('renderExportView');
  assert.ok(pulsados > 0, 'CIEGO: no se pulsó ningún control de «Exportar»');
  assert.ok(pedidas.some((u) => /^\/admin\/libros\/expedidas\.csv\?/.test(u)),
    `CIEGO: el pulsador no ve la descarga que SÍ existe. Pulsados ${pulsados}; pedidas: ${pedidas.join(' · ')}`);
});

test('SCRUM-1249 · 🔴 «Facturas recibidas» ofrece la descarga del libro, con el periodo ELEGIDO en pantalla', async () => {
  const { pedidas, alMontar, pulsados } = await pulsarTodo('renderFacturasRecibidasView', {
    antesDePulsar: (banco) => {
      banco.ctx.document.getElementById('facturas-recibidas-anio').value = '2025';
      banco.ctx.document.getElementById('facturas-recibidas-trimestre').value = '2';
    },
  });
  assert.ok(alMontar > 0, 'CIEGO: la pantalla no pidió nada al montarse (ni su propio libro)');
  assert.ok(pulsados > 0, 'CIEGO: no se pulsó ningún control de «Facturas recibidas»');
  const descargas = pedidas.filter((u) => LA_DESCARGA.test(u));
  assert.ok(descargas.length > 0,
    `🔴 ningún control de «Facturas recibidas» pide ${LA_DESCARGA}. Pulsados ${pulsados}; pedidas: ${pedidas.join(' · ')}`);
  // El fichero tiene que ser del periodo que el profesional está MIRANDO, no el del reloj: un
  // libro que dice ser de un trimestre y trae otro es lo que no se puede entregar (SCRUM-325).
  for (const u of descargas) {
    const qs = new URLSearchParams(u.split('?')[1]);
    assert.equal(qs.get('año'), '2025', u);
    assert.equal(qs.get('trimestre'), '2', u);
  }
});
