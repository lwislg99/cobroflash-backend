// tests/scrum284-asignacion-submenus.test.mjs — SCRUM-284 (B1), guard estructural, sin gate.
//
// NINGÚN CAMPO SE QUEDA SIN SITIO EN SILENCIO.
//
// El censo dice QUÉ hay; esto dice DÓNDE va. Un campo que no esté ni asignado ni declarado
// como pendiente de decisión del fundador cae en ROJO — que es el fallo mudo del ticket
// convertido en un fallo ruidoso.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarConfiguracion } from './_censo-configuracion.mjs';
import {
  ASIGNACION, PENDIENTES_DE_DECISION, ASUNTOS_DEL_TICKET, PENDIENTE, revisarAsignacion,
} from './_asignacion-submenus.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/settingsView.js');

const CENSO = censarConfiguracion(fs.readFileSync(VISTA, 'utf8'), 'settingsView.js');
const CLAVES = CENSO.campos.map((c) => c.clave);
const REVISION = revisarAsignacion(CLAVES);

// ── EL GUARD DEL TICKET ──────────────────────────────────────────────────────
test('SCRUM-284 · ningún campo de Configuración se queda sin sitio', () => {
  assert.deepEqual(REVISION.sinSitio, [],
    '🔴 estos campos no están asignados a ningún submenú NI declarados como pendientes de ' +
    'decisión del fundador. Un ajuste sin sitio desaparece en la reorganización y nadie lo ' +
    'nota hasta que va a cambiarlo:\n   · ' + REVISION.sinSitio.join('\n   · '));
});

// ── SUELO ────────────────────────────────────────────────────────────────────
// Sin esto, un censo vacío daría «0 sin sitio» — verde por no ver nada, que es lo contrario
// de lo que el guard promete. Es la lección de hoy: «0 huérfanos» y «no supe mirar» son el
// mismo número.
test('SCRUM-284 · SUELO: el guard tenía campos que revisar', () => {
  assert.ok(CLAVES.length >= 25,
    `🔴 el censo devolvió ${CLAVES.length} campos (esperados ≥25): el guard de asignación ` +
    'estaría dando verde sobre una lista vacía.');
  assert.ok(REVISION.asignados >= 19,
    `🔴 solo ${REVISION.asignados} campos asignados: la tabla de asignación se ha quedado corta.`);
});

test('SCRUM-284 · SUELO: toda clave asignada existe de verdad en el censo', () => {
  // El reverso: una asignación a un campo que ya no existe deja el mapa mintiendo.
  const fantasmas = Object.keys(ASIGNACION).filter((c) => !CLAVES.includes(c));
  assert.deepEqual(fantasmas, [],
    '🔴 estas claves están asignadas a un submenú pero YA NO existen en la pantalla: el mapa ' +
    'describe una Configuración que no es la de hoy.');
});

// ── MICROCOPY SIN APROBAR ────────────────────────────────────────────────────
test('SCRUM-284 · todo rótulo visible lleva su marcador de microcopy pendiente', () => {
  const rotulo = PENDIENTE('Datos de empresa');
  assert.match(rotulo, /^\[PENDIENTE microcopy oficial\] /,
    'los nombres de grupos y submenús NO están aprobados (regla 30): ninguno puede salir sin marcador');
  // Y las claves internas no son rótulos: no deben parecer texto de usuario.
  const conMayusculaOAcento = REVISION.submenus.filter((s) => /[A-ZÁÉÍÓÚÑ ]/.test(s));
  assert.deepEqual(conMayusculaOAcento, [],
    '🔴 estas claves de submenú parecen microcopy en vez de identificadores internos: ' +
    'un rótulo sin aprobar no puede colarse como clave.');
});

// ── CONTROL CRUZADO CONTRA LA LISTA HUMANA ───────────────────────────────────
// Lección propia de hoy: el censo derivado se dejó tres campos fuera con los suelos en verde,
// y lo destapó contrastarlo con la lista del ticket. La lista no es censo — pero es la otra
// mitad del control. Este test REPORTA la diferencia; no la convierte en rojo, porque la
// decisión es del fundador.
test('SCRUM-284 · contraste con la lista del ticket (reporta, no bloquea)', () => {
  const pendientes = Object.keys(PENDIENTES_DE_DECISION);
  console.log(
    `\n🔀 SCRUM-284 · contraste censo ↔ lista del ticket\n` +
    `   asuntos que enumera el ticket: ${ASUNTOS_DEL_TICKET.length}\n` +
    `   submenús que usa la asignación: ${REVISION.submenus.length} → ${REVISION.submenus.join(', ')}\n` +
    `   campos asignados: ${REVISION.asignados} · pendientes de decisión: ${REVISION.pendientes}\n` +
    `   SIN SITIO (rojo si >0): ${REVISION.sinSitio.length}\n` +
    `   huérfanos que la lista del ticket NO menciona:\n` +
    pendientes.map((p) => `     · ${p}`).join('\n') + '\n',
  );
  assert.ok(pendientes.length > 0, 'el contraste tiene que enumerar algo o no está contrastando');
});

// ── CONTROL NEGATIVO ─────────────────────────────────────────────────────────
test('SCRUM-284 · NEGATIVO: un campo declarado pendiente NO cuenta como sin sitio', () => {
  // Si los pendientes contasen como huérfanos, el guard estaría en rojo permanente esperando
  // al fundador — y un guard en rojo permanente se acaba desactivando.
  const r = revisarAsignacion(['approvalThreshold', 'clabe']);
  assert.deepEqual(r.sinSitio, [],
    'los pendientes están declarados con su motivo: son conocidos, no perdidos');
  assert.equal(r.pendientes, 2);
});

test('SCRUM-284 · NEGATIVO: un campo desconocido SÍ cae', () => {
  const r = revisarAsignacion(['campoQueNadieHaColocado']);
  assert.deepEqual(r.sinSitio, ['campoQueNadieHaColocado'],
    'un campo nuevo que nadie coloque tiene que caer: es el fallo mudo del ticket');
});
