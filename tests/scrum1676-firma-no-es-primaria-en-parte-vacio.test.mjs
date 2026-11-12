// SCRUM-1676 (PILOTO-1) · Con el parte VACÍO, «Firmar aquí mismo» —irreversible— no es la acción
// principal; con una línea vuelve a serlo. Texto firmado: SCRUM-1656 comentario 21408, entrada 7.
//
// Contra lo PINTADO por la vista real (vm) y contra el CSS real, no contra el fuente de la vista:
//   ① vacío: el botón del cliente lleva la marca de «en espera» y sale «Apunta primero…», no «queda fijo»;
//   ② con una línea: sin marca, y vuelve «Con la primera firma, lo apuntado queda fijo.»;
//   ③ la marca TIENE efecto: la regla del CSS que la lee devuelve el botón al aspecto secundario.
//   ④ «vacío» es la MISMA pregunta que el servidor (`puedeFirmarse`): si el dominio cambia, esto cae.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');
const CSS = path.join(RAIZ, 'public', 'dashboard', 'css', 'styles.css');
const { puedeFirmarse } = await import('../dist/modules/jobs/domain/parteTrabajo.js');

function pintar(parte) {
  const contenedor = { innerHTML: '' };
  const ctx = {
    console, window: null,
    document: { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, innerHTML: '' }) },
    Date, Array, Object, String, Number, JSON, Math,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(JS, 'utf8'), ctx, { filename: 'parteDetailView.js' });
  assert.equal(ctx.renderParte(contenedor, parte), true, '🔴 la vista se negó a pintar');
  assert.ok(contenedor.innerHTML.length > 1500, `🔴 CIEGO: pintó ${contenedor.innerHTML.length} caracteres`);
  return contenedor.innerHTML;
}

const BASE = Object.freeze({
  id: 13, numero: 'PT-2026-013', clienteNombre: 'Cliente de prueba',
  fecha: '2026-11-10T08:00:00.000Z', obra: '', referencia: '',
  entrada: '09:00', salida: '11:00', desplazamientos: 0, kilometros: 0,
  tecnicos: [], tipo: 'averia', lineas: [],
  notas: '', estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const CON_LINEA = { lineas: [{ id: 'l1', bloque: 'mano_obra', unds: 2, descripcion: 'Cambio de grifo' }] };

const APUNTA = 'Apunta primero lo que has hecho: al firmar ya no se puede cambiar.';
const FIJO = 'Con la primera firma, lo apuntado queda fijo.';
const MARCA = 'data-parte-firma-en-espera="1"';

function botonDelCliente(html) {
  const m = html.match(/<button[^>]*data-parte-firmar="1"[^>]*>/);
  assert.ok(m, '🔴 CIEGO: no se pintó el botón de firma del cliente');
  return m[0];
}

test('SCRUM-1676 ① parte vacío (con horas): la firma NO es la principal y se dice qué va antes', () => {
  const html = pintar(BASE);
  assert.ok(botonDelCliente(html).includes(MARCA), '🔴 la firma sigue siendo la acción principal de un parte vacío');
  assert.ok(html.includes(APUNTA), '🔴 falta el texto firmado de qué va antes de firmar');
  assert.ok(!html.includes(FIJO), '🔴 salen los dos avisos de lo mismo');
});

test('SCRUM-1676 ② con una línea, la firma vuelve a ser la siguiente acción', () => {
  const html = pintar({ ...BASE, ...CON_LINEA });
  assert.ok(!botonDelCliente(html).includes(MARCA), '🔴 con una línea la firma sigue apagada');
  assert.ok(!html.includes('data-parte-firma-en-espera'), '🔴 la marca sale en algún botón con el parte lleno');
  assert.ok(html.includes(FIJO), '🔴 con una línea desaparece el aviso de SCRUM-653');
  assert.ok(!html.includes(APUNTA), '🔴 «apunta primero» con el parte ya apuntado');
});

test('SCRUM-1676 ③ la marca TIENE efecto: el CSS la devuelve al aspecto secundario', () => {
  const css = fs.readFileSync(CSS, 'utf8');
  const comun = css.match(/\n\[data-parte-firmar\] \{([^}]*)\}/);
  assert.ok(comun && /background:\s*var\(--brand\)/.test(comun[1]), '🔴 CIEGO: la regla verde de la firma ya no es la que era');
  const regla = css.match(/\n\[data-parte-firmar\]\[data-parte-firma-en-espera\] \{([^}]*)\}/);
  assert.ok(regla, '🔴 nadie lee la marca: el botón sigue verde');
  assert.match(regla[1], /background:\s*var\(--surface\)/, '🔴 la marca no quita el fondo verde');
  assert.match(regla[1], /color:\s*var\(--ink\)/, '🔴 la marca deja el texto blanco sobre fondo claro');
});

test('SCRUM-1676 ④ «vacío» es la pregunta del servidor: cero líneas no se firma, una sí', () => {
  assert.equal(puedeFirmarse([]).ok, false, '🔴 el servidor ya firma un parte sin líneas: la marca mentiría');
  assert.equal(puedeFirmarse(CON_LINEA.lineas).ok, true, '🔴 CIEGO: ni con una línea se firma');
});
