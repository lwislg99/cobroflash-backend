// tests/scrum1562f-ver-detalle-fuera-de-acciones.test.mjs — SCRUM-1562f (S4, 22-oct-2026)
//
// «VER DETALLE» VIVE EN LA FILA, PERO NO EN `.jobs-acciones`.
//
// `.jobs-acciones` es la acción de la ESCALERA, la que cambia con el estado del Trabajo, y
// `guard:escalera-por-estado` la compara con la del detalle (`.jobs-acciones > button`). SCRUM-1562c
// metió «Ver detalle» dentro y, en un Trabajo CERRADO, la lista «proponía» «Ver detalle» y el
// detalle nada: el guard salió rojo en `main`. Decisión (a) del fundador, SCRUM-1570 c.20161: el
// botón sale de esa caja y el guard no se toca.
//
// Este test pone la misma pregunta DENTRO de la tanda obligatoria, sin navegador: el guard corre
// en un job informativo y su rojo pasó días sin que nadie lo mirase (SCRUM-1570).
//
// 🔵 Y LO QUE NO PUEDE ROMPER: el teclado de SCRUM-1562. Que el botón siga existiendo, sea nativo y
// abra la ficha lo exige `tests/scrum1562d-trabajos-con-teclado.test.mjs`; Tab, Intro y Espacio en
// un navegador de verdad, `docs/master/evidencias/SCRUM-1562/sonda-1562f-teclado.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { datosDelCenso } from '../scripts/_datos-del-censo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const clase = (n) => String((n && n.className) || '');
const tiene = (n, c) => new RegExp(`\\b${c}\\b`).test(clase(n));
const rotulo = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();
const antepasados = (n) => { const r = []; for (let p = n._padre; p; p = p._padre) r.push(p); return r; };

async function filas() {
  const dc = datosDelCenso();
  dc.enVista('renderJobsView');
  const banco = cargarDashboard(RAIZ, { datos: dc.datos });
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderJobsView');
  assert.equal(r.error, null, `🔴 la lista revienta: ${r.error && r.error.message}`);
  const f = r.contenedor ? todos(r.contenedor).filter((n) => n.tagName === 'TR' && tiene(n, 'jobs-fila')) : [];
  assert.equal(f.length, 2, `🔴 CIEGO: el censo trae dos Trabajos y salen ${f.length} filas`);
  return f;
}

test('SCRUM-1562f · SUELO: cada fila tiene su `.jobs-acciones` y su «Ver detalle» (si no, «fuera» sería cierto por vacío)', async () => {
  for (const [i, fila] of (await filas()).entries()) {
    assert.equal(todos(fila).filter((n) => tiene(n, 'jobs-acciones')).length, 1, `🔴 fila ${i}: no hay UNA \`.jobs-acciones\``);
    assert.equal(todos(fila).filter((n) => n.tagName === 'BUTTON' && rotulo(n) === 'Ver detalle').length, 1,
      `🔴 fila ${i}: no hay UN «Ver detalle»`);
  }
});

test('SCRUM-1562f · 🔴 «Ver detalle» NO está dentro de `.jobs-acciones`: no es la acción de la escalera', async () => {
  for (const [i, fila] of (await filas()).entries()) {
    const [b] = todos(fila).filter((n) => n.tagName === 'BUTTON' && rotulo(n) === 'Ver detalle');
    const caja = antepasados(b).find((p) => tiene(p, 'jobs-acciones'));
    assert.equal(caja, undefined,
      `🔴 fila ${i}: «Ver detalle» cuelga de \`.jobs-acciones\`. En un Trabajo cerrado es el único botón de esa caja `
      + 'y la lista propone algo que el detalle no propone (guard:escalera-por-estado).');
  }
});

test('SCRUM-1562f · …pero sigue en la celda de acciones de SU fila, junto a `.jobs-acciones`', async () => {
  for (const [i, fila] of (await filas()).entries()) {
    const [b] = todos(fila).filter((n) => n.tagName === 'BUTTON' && rotulo(n) === 'Ver detalle');
    const arriba = antepasados(b);
    const td = arriba.find((p) => p.tagName === 'TD');
    assert.ok(td && tiene(td, 'cell-actions'), `🔴 fila ${i}: «Ver detalle» está en «${clase(td)}», no en \`td.cell-actions\``);
    assert.ok(arriba.includes(fila), `🔴 fila ${i}: «Ver detalle» no cuelga de su propia fila`);
    const celda = b._padre;
    assert.ok(tiene(celda, 'jobs-celda-acciones'), `🔴 fila ${i}: el padre de «Ver detalle» es «${clase(celda)}»`);
    assert.ok(celda.hijos.some((h) => tiene(h, 'jobs-acciones')),
      `🔴 fila ${i}: \`.jobs-acciones\` ya no es hermana de «Ver detalle»; la celda se ha partido`);
  }
});
