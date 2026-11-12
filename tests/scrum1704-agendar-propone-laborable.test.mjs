// SCRUM-1704 · «Agendar» abre con una fecha PROPUESTA: el siguiente día laborable a las 9:00, hora
// local (decisión del orquestador, SCRUM-1704 c.21502). Al reagendar manda la fecha guardada.
// Proponer no es guardar: nada se escribe hasta pulsar «Agendar».
//
// QUÉ MIDE ESTO: EJECUTA `jobAgendar.js` en el banco de vistas (`_banco-vistas.mjs`): la función
// pura con fechas fijas (de lunes a domingo y en los cambios de mes y de año), y el modal entero,
// leyendo el `value` del `datetime-local` y lo que llega al `patch` de quien llama.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const banco = () => {
  const b = cargarDashboard(RAIZ);
  assert.equal(typeof b.ctx.propuestaDeAgenda, 'function', '🔴 NO PUDE MIRAR: jobAgendar.js no publica propuestaDeAgenda');
  assert.equal(typeof b.ctx.abrirAgendarTrabajo, 'function', '🔴 NO PUDE MIRAR: el banco no carga jobAgendar.js');
  return b;
};

// Fechas LOCALES (año, mes 0-11, día, hora): la propuesta se arma con campos locales y así se mide.
const propuesta = (...campos) => banco().ctx.propuestaDeAgenda(new Date(...campos));

test('1704 · propuesta: lunes 9-nov-2026 08:00 → martes a las 9:00', () => {
  assert.equal(propuesta(2026, 10, 9, 8), '2026-11-10T09:00');
});
test('1704 · propuesta: miércoles 11-nov-2026 17:40 → jueves', () => {
  assert.equal(propuesta(2026, 10, 11, 17, 40), '2026-11-12T09:00');
});
test('1704 · propuesta: jueves 12-nov-2026 23:59 → viernes', () => {
  assert.equal(propuesta(2026, 10, 12, 23, 59), '2026-11-13T09:00');
});
test('1704 · propuesta: viernes 13-nov-2026 → lunes', () => {
  assert.equal(propuesta(2026, 10, 13, 10), '2026-11-16T09:00');
});
test('1704 · propuesta: sábado 14-nov-2026 → lunes', () => {
  assert.equal(propuesta(2026, 10, 14, 12), '2026-11-16T09:00');
});
test('1704 · propuesta: domingo 15-nov-2026 → lunes', () => {
  assert.equal(propuesta(2026, 10, 15, 12), '2026-11-16T09:00');
});
test('1704 · propuesta: viernes 31-dic-2027 → lunes 3-ene-2028 (cambia mes y año)', () => {
  assert.equal(propuesta(2027, 11, 31, 9), '2028-01-03T09:00');
});
test('1704 · propuesta: lunes 28-feb-2028 → martes 29-feb (bisiesto)', () => {
  assert.equal(propuesta(2028, 1, 28, 9), '2028-02-29T09:00');
});

function abrir(job) {
  const b = banco();
  const patches = [];
  b.ctx.abrirAgendarTrabajo(job, (cuerpo, msg) => patches.push({ cuerpo, msg }));
  const nodos = todos(b.ctx.document.body);
  const campo = nodos.find((n) => n._id === 'jobs-agendar-fecha');
  assert.ok(campo, '🔴 NO PUDE MIRAR: el modal no pinta #jobs-agendar-fecha');
  const boton = (texto) => nodos.find((n) => n.tagName === 'BUTTON' && String(n.textContent).trim() === texto);
  return { b, campo, boton, patches };
}

test('1704 · «Agendar» sin fecha guardada abre con la propuesta de hoy', () => {
  const { b, campo } = abrir({ id: 1, status: 'pendiente_agendar', scheduledAt: null });
  assert.equal(campo.value, b.ctx.propuestaDeAgenda(new Date()));
  assert.match(campo.value, /^\d{4}-\d{2}-\d{2}T09:00$/);
});

test('1704 · «Reagendar» abre con la fecha GUARDADA, no con la propuesta', () => {
  const guardada = new Date(2026, 11, 3, 16, 30); // jueves 3-dic-2026 16:30 local
  const { campo } = abrir({ id: 1, status: 'agendado', scheduledAt: guardada.toISOString() });
  assert.equal(campo.value, '2026-12-03T16:30');
});

test('1704 · proponer no es guardar: abrir y cancelar no escribe nada', () => {
  const { boton, patches } = abrir({ id: 1, status: 'pendiente_agendar', scheduledAt: null });
  assert.equal(patches.length, 0, 'abrir el modal ya escribe');
  const cancelar = boton('Cancelar');
  assert.ok(cancelar, '🔴 NO PUDE MIRAR: no encuentro «Cancelar» en el modal');
  cancelar.click();
  assert.equal(patches.length, 0, 'cancelar escribe la fecha propuesta');
});

test('1704 · pulsar «Agendar» manda la propuesta como `scheduledAt`', () => {
  const { campo, boton, patches } = abrir({ id: 1, status: 'pendiente_agendar', scheduledAt: null });
  boton('Agendar').click();
  assert.equal(patches.length, 1);
  assert.equal(patches[0].cuerpo.status, 'agendado');
  assert.equal(patches[0].cuerpo.scheduledAt, new Date(campo.value).toISOString());
});
