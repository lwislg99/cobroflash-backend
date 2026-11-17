// SCRUM-1746 · EL CAMPO «DESPLAZAMIENTO» DEL PARTE DICE SU UNIDAD: «Desplazamientos (nº de viajes)».
//
// Medido en yaqu.app el 16-nov-2026 (recorrido H6 de SCRUM-1686, fila 18): la casilla guarda el NÚMERO
// DE VIAJES (`ParteTrabajo.desplazamientos`, un entero) y su rótulo no lo decía — quien la rellenó
// escribió «20» creyendo que eran kilómetros, con «Kilómetros» justo al lado.
//
// FIRMA: el fundador, el 17-nov-2026; consta en la descripción de SCRUM-1746 y en
// `docs/microcopy/2026-11-17-SCRUM-1746-desplazamientos-numero-de-viajes.md`.
//
// SOLO EL RÓTULO. Lo que se fija aquí:
//   ① el literal firmado, letra a letra;
//   ② se pinta en la hoja del parte en sus DOS estados (borrador, con casilla; firmado, con dato), una
//      vez, junto a «Kilómetros», y el rótulo viejo a secas ya no sale;
//   ③ ningún otro texto cambia: los tres avisos de la misma casilla tienen firma propia (SCRUM-1491 y
//      SCRUM-1492) y siguen diciendo lo que decían;
//   ④ la firma tiene su ficha en `docs/microcopy/`, con el literal y la línea de aprobación.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRMADO = 'Desplazamientos (nº de viajes)';
const FICHA = path.join(RAIZ, 'docs', 'microcopy', '2026-11-17-SCRUM-1746-desplazamientos-numero-de-viajes.md');

const BASE = Object.freeze({
  id: 23, numero: 'PT-2026-015', clienteNombre: 'Cliente de pruebas', jobId: 84,
  fecha: '2026-11-16T08:00:00.000Z', obra: null, referencia: null,
  entrada: '09:10', salida: '11:40', desplazamientos: 2, kilometros: 8,
  tecnicos: [], tipo: null,
  lineas: [{ bloque: 'mano_obra', unds: 1, descripcion: 'Revisión' }],
  notas: null,
});
const BORRADOR = Object.freeze({
  ...BASE, estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const YA_FIRMADO = Object.freeze({
  ...BASE, estado: 'firmado', firmoElCliente: true, firmoElTecnico: true,
  puedeEditarContenido: { ok: false, motivo: 'firmado' }, puedeEditarPrecios: { ok: true, motivo: null },
});

const conClase = (n, clase) => String(n.className || '').split(/\s+/).includes(clase);
const texto = (n) => todos(n).map((x) => x._texto || '').join('').replace(/\s+/g, ' ').trim();

/**
 * Los rótulos del par «desplazamientos · kilómetros», en el orden en que se pintan. La hoja tiene DOS
 * `parte-horas-par` (el otro es entrada · salida): el nuestro es el que lleva dentro el campo, que en
 * borrador es una casilla (`data-parte-campo`) y en firmado un dato (`data-parte-dato`).
 */
function rotulosDelPar(parte, marca) {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  assert.equal(b.ctx.renderParte(c, parte), true, '🔴 SUELO: la vista se negó a pintar el parte');
  const esElCampo = (n) => !!n.getAttribute && n.getAttribute(marca) === 'desplazamientos';
  const pares = todos(c).filter((n) => conClase(n, 'parte-horas-par') && todos(n).some(esElCampo));
  assert.equal(pares.length, 1, `🔴 SUELO: no hay UN par con [${marca}="desplazamientos"] dentro (¿se renombró \`parte-horas-par\`?)`);
  const todosLosRotulos = todos(c).filter((n) => conClase(n, 'parte-campo-rotulo')).map(texto);
  return { delPar: todos(pares[0]).filter((n) => conClase(n, 'parte-campo-rotulo')).map(texto), todosLosRotulos, c };
}

test('SCRUM-1746 ① el rótulo es el firmado, literal', () => {
  const b = cargarDashboard(RAIZ);
  assert.equal(b.ctx.PARTE_TEXTOS.desplazamiento, FIRMADO);
});

// `marca` es el SUELO del estado: la casilla en borrador, el dato en firmado. Si la hoja pintara el
// otro, `rotulosDelPar` no encuentra el par y cae ahí, no en un verde sobre el estado equivocado.
function elRotuloSePinta(parte, marca) {
  const { delPar, todosLosRotulos } = rotulosDelPar(parte, marca);
  assert.deepEqual(delPar, [FIRMADO, 'Kilómetros']);
  assert.equal(todosLosRotulos.filter((t) => t === FIRMADO).length, 1, 'el rótulo firmado sale una sola vez en la hoja');
  assert.equal(todosLosRotulos.filter((t) => t === 'Desplazamiento').length, 0, '🔴 el rótulo viejo, sin unidad, sigue pintado');
}

// Dos tests de nombre LITERAL, no un bucle con el nombre construido (SCRUM-1415).
test('SCRUM-1746 ② el parte en BORRADOR pinta el rótulo firmado junto a «Kilómetros», una vez', () => {
  elRotuloSePinta(BORRADOR, 'data-parte-campo');
});

test('SCRUM-1746 ② el parte FIRMADO pinta el rótulo firmado junto a «Kilómetros», una vez', () => {
  elRotuloSePinta(YA_FIRMADO, 'data-parte-dato');
});

test('SCRUM-1746 ③ solo el rótulo: los tres avisos de la casilla (firmas de SCRUM-1491 y SCRUM-1492) no cambian', () => {
  const T = cargarDashboard(RAIZ).ctx.PARTE_TEXTOS;
  assert.equal(T.desplazamientoEsEntero, 'No se ha guardado. Desplazamiento es un número entero, como 1 o 2 — no el tiempo de viaje');
  assert.equal(T.desplazamientoEsCeroOMas, 'No se ha guardado. Desplazamiento es 0 o más');
  assert.equal(T.desplazamientoDemasiadoGrande, 'No se ha guardado. Ese número es demasiado grande para Desplazamiento');
  assert.equal(T.kilometros, 'Kilómetros', 'el vecino tampoco');
});

test('SCRUM-1746 ④ la firma tiene su ficha, con el literal y la línea de aprobación', () => {
  assert.ok(fs.existsSync(FICHA), '🔴 falta la ficha de la firma en docs/microcopy/');
  const lineas = fs.readFileSync(FICHA, 'utf8').split(/\r?\n/);
  assert.ok(lineas.includes('> ' + FIRMADO), '🔴 la ficha no cita el literal firmado tal cual, en su propia línea de cita');
  assert.ok(
    lineas.some((l) => l.startsWith('**Aprobado por el fundador** el 17-nov-2026, en **SCRUM-1746**')),
    '🔴 la ficha no lleva la línea de firma (docs/microcopy/README.md, punto 3), fuera de cita',
  );
});
