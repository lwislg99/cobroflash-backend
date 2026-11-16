// SCRUM-1698 (T5 de la ③ de SCRUM-1686) · EN EL PARTE FIRMADO, LO QUE NO SE APUNTÓ LO DICE.
//
// Anomalía e de SCRUM-1686: firmar sólo exige alguna línea (`puedeFirmarse`, `parteTrabajo.ts`), así
// que un parte se firma sin horas ni desplazamiento, y una vez firmado el hueco salía «—», que no
// distingue «no se apuntó» de «cero».
//
// Texto FIRMADO: N3 de la tanda N1-N13 de SCRUM-1686 («si firmo», comentario 21470) —
// «Sin apuntar», en el parte firmado, campo de horas o de desplazamiento que se quedó vacío.
//
// Lo que se fija:
//   ① firmado + vacío (null, undefined o '') en entrada, salida, desplazamiento o km → «Sin apuntar»;
//   ② firmado + CERO sigue siendo un número («0», «0 km»): cero es un dato, no un hueco;
//   ③ firmado + valor → el valor, como siempre;
//   ④ el BORRADOR no cambia: allí hay casilla para apuntarlo (no sale «Sin apuntar»);
//   ⑤ el alcance es el de la firma: los datos del parte plegados (obra, técnicos, notas) no lo usan.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE = Object.freeze({
  id: 5, numero: 'PT-2026-005', clienteNombre: 'Cliente de pruebas', jobId: 77,
  fecha: '2026-11-10T08:00:00.000Z', obra: null, referencia: null,
  entrada: '09:10', salida: '11:40', desplazamientos: 1, kilometros: 8,
  tecnicos: [], tipo: null,
  lineas: [{ bloque: 'mano_obra', unds: 1, descripcion: 'Revisión' }],
  notas: null, estado: 'firmado', firmoElCliente: true, firmoElTecnico: false,
  puedeEditarContenido: { ok: false, motivo: 'firmado' }, puedeEditarPrecios: { ok: true, motivo: null },
});
const CAMPOS = ['entrada', 'salida', 'desplazamientos', 'kilometros'];

const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const texto = (n) => todos(n).map((x) => x._texto || '').join('').replace(/\s+/g, ' ').trim();

function pintar(parte) {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  assert.equal(b.ctx.renderParte(c, parte), true, '🔴 SUELO: la vista se negó a pintar');
  const dato = (nombre) => {
    const n = todos(c).find((x) => attr(x, 'data-parte-dato') === nombre);
    return n ? texto(n) : null;
  };
  return { c, dato, todo: texto(c) };
}

test('SCRUM-1698 ① · firmado y vacío → «Sin apuntar», en los cuatro campos y con los tres vacíos', () => {
  for (const vacio of [null, undefined, '']) {
    const { dato } = pintar({ ...BASE, entrada: vacio, salida: vacio, desplazamientos: vacio, kilometros: vacio });
    for (const k of CAMPOS) {
      assert.equal(dato(k), 'Sin apuntar', `🔴 ${k} = ${JSON.stringify(vacio)} en un parte firmado se pinta «${dato(k)}»`);
    }
  }
});

test('SCRUM-1698 ② · firmado y CERO → el número, no «Sin apuntar»', () => {
  const { dato } = pintar({ ...BASE, desplazamientos: 0, kilometros: 0 });
  assert.equal(dato('desplazamientos'), '0');
  assert.equal(dato('kilometros'), '0 km');
});

test('SCRUM-1698 ③ · firmado con valor → el valor de siempre (control)', () => {
  const { dato, todo } = pintar(BASE);
  assert.equal(dato('entrada'), '09:10');
  assert.equal(dato('salida'), '11:40');
  assert.equal(dato('desplazamientos'), '1');
  assert.equal(dato('kilometros'), '8 km');
  assert.ok(!todo.includes('Sin apuntar'), '🔴 sale «Sin apuntar» en un parte con todo apuntado');
});

test('SCRUM-1698 ④ · el BORRADOR no cambia: casilla para apuntar, sin «Sin apuntar»', () => {
  const { todo } = pintar({
    ...BASE, estado: 'borrador', firmoElCliente: false, puedeEditarContenido: { ok: true, motivo: null },
    entrada: null, salida: null, desplazamientos: null, kilometros: null,
  });
  assert.ok(!todo.includes('Sin apuntar'), '🔴 el borrador dice «Sin apuntar»: allí hay casilla, el hueco se rellena');
});

test('SCRUM-1698 ⑤ · alcance de la firma: obra, referencia, técnicos y notas no usan «Sin apuntar»', () => {
  const { dato } = pintar({ ...BASE, obra: null, referencia: null, tecnicos: [], notas: null });
  for (const k of ['obra', 'referencia', 'tecnicos', 'notas']) {
    assert.notEqual(dato(k), 'Sin apuntar', `🔴 ${k} dice «Sin apuntar»: N3 es de horas y desplazamiento`);
  }
});
