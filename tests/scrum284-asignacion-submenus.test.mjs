// tests/scrum284-asignacion-submenus.test.mjs — SCRUM-284 (B1), guard estructural, sin gate.
//
// NINGÚN CAMPO SE QUEDA SIN SITIO — Y NINGÚN SITIO SE QUEDA SIN CAMPOS EN SILENCIO.
//
// El censo dice QUÉ hay; el mapa dice DÓNDE va. Este guard mira las DOS direcciones. La primera
// versión solo miraba una, y por eso estuvo verde mientras seis de sus once destinos no existían
// como submenú y cinco de los diez submenús no tenían un solo campo. Ver la cabecera de
// `_asignacion-submenus.mjs` para los cuatro sentidos y su porqué.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarConfiguracion } from './_censo-configuracion.mjs';
import {
  SUBMENUS, ASIGNACION, PENDIENTES_DE_DECISION, FUERA_DE_CONFIGURACION, VACIOS_DECLARADOS,
  ASUNTOS_DEL_TICKET, PENDIENTE, revisarAsignacion,
} from './_asignacion-submenus.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/settingsView.js');

const CENSO = censarConfiguracion(fs.readFileSync(VISTA, 'utf8'), 'settingsView.js');
const CLAVES = CENSO.campos.map((c) => c.clave);
const REVISION = revisarAsignacion(CLAVES);

// ── SUELO ────────────────────────────────────────────────────────────────────
// Va PRIMERO a propósito: sin campos que revisar, TODO lo de abajo pasa en vacío. «0 huérfanos» y
// «no supe mirar» son el mismo número y significan lo contrario.
test('SCRUM-284 · SUELO: el guard tenía campos y submenús que revisar', () => {
  assert.ok(CLAVES.length >= 25,
    `🔴 el censo devolvió ${CLAVES.length} campos (esperados ≥25): el guard estaría dando verde ` +
    'sobre una lista vacía.');
  assert.equal(SUBMENUS.length, 10,
    `🔴 la lista de submenús tiene ${SUBMENUS.length} entradas y el ticket cierra en diez. Si el ` +
    'conjunto cambia, es una decisión de estructura y se anota; no se mueve de refilón.');
  assert.ok(REVISION.asignados >= 22,
    `🔴 solo ${REVISION.asignados} campos asignados: la tabla de asignación se ha quedado corta.`);
});

// ── ① CAMPO SIN SITIO (el guard original) ────────────────────────────────────
test('SCRUM-284 · ① ningún campo de Configuración se queda sin sitio', () => {
  assert.deepEqual(REVISION.sinSitio, [],
    '🔴 estos campos no están asignados a un submenú, ni declarados pendientes de decisión, ni ' +
    'declarados fuera de Configuración. Un ajuste sin sitio desaparece en la reorganización y ' +
    'nadie lo nota hasta que va a cambiarlo:\n   · ' + REVISION.sinSitio.join('\n   · '));
});

// ── ② DESTINO QUE NO EXISTE (el agujero que cierra este incremento) ──────────
test('SCRUM-284 · ② ninguna asignación apunta a un submenú que no existe', () => {
  assert.deepEqual(REVISION.destinosInexistentes, [],
    '🔴 estas asignaciones mandan un campo a un sitio que NO es uno de los diez submenús. Es el ' +
    'defecto que este incremento cierra: antes los destinos se derivaban de los propios valores ' +
    'del mapa, así que un destino inventado se auto-declaraba válido con solo escribirlo, y seis ' +
    'de los once lo estaban:\n   · ' + REVISION.destinosInexistentes.join('\n   · '));
});

// ── ③ SUBMENÚ SIN CAMPOS ─────────────────────────────────────────────────────
test('SCRUM-284 · ③ ningún submenú se queda sin campos salvo que esté declarado vacío', () => {
  assert.deepEqual(REVISION.submenusVacios, [],
    '🔴 estos submenús existirían en el menú y no llevarían a nada. Un menú que lleva a una página ' +
    'vacía es peor que no tener el menú. Si el hueco es a propósito, va a `VACIOS_DECLARADOS` con ' +
    'su motivo escrito:\n   · ' + REVISION.submenusVacios.join('\n   · '));
});

// ── ④ EL TRINQUETE EN EL OTRO SENTIDO ────────────────────────────────────────
test('SCRUM-284 · ④ un vacío declarado que YA tiene campos obliga a anotarlo', () => {
  assert.deepEqual(REVISION.vaciosQueYaNoLoEstan, [],
    '🔴 ESTOS SUBMENÚS YA NO ESTÁN VACÍOS y siguen declarados como hueco:\n   · ' +
    REVISION.vaciosQueYaNoLoEstan.join('\n   · ') +
    '\n\n  Buena noticia, y el mapa tiene que reflejarla: quítalos de `VACIOS_DECLARADOS`.\n' +
    '  Que el guard falle por una MEJORA es deliberado. Si saldar la deuda fuese silencioso, la ' +
    'lista seguiría declarando huecos que ya no existen y nadie sabría cuándo se vació del todo — ' +
    'que es exactamente cómo una deuda declarada se convierte en excepción permanente (SCRUM-299).');
});

// ── SUELOS DEL MAPA ──────────────────────────────────────────────────────────
test('SCRUM-284 · SUELO: toda clave asignada existe de verdad en el censo', () => {
  // El reverso: una asignación a un campo que ya no existe deja el mapa mintiendo.
  const fantasmas = [...Object.keys(ASIGNACION), ...Object.keys(FUERA_DE_CONFIGURACION),
    ...Object.keys(PENDIENTES_DE_DECISION)].filter((c) => !CLAVES.includes(c));
  assert.deepEqual(fantasmas, [],
    '🔴 estas claves están en el mapa pero YA NO existen en la pantalla: el mapa describe una ' +
    'Configuración que no es la de hoy:\n   · ' + fantasmas.join('\n   · '));
});

test('SCRUM-284 · SUELO: las tres categorías son EXCLUYENTES', () => {
  // Un campo a la vez asignado y «fuera» dejaría el mapa diciendo dos cosas, y cuál gana
  // dependería del orden de los `if`. Ese es el tipo de ambigüedad que no avisa: elige sola.
  const dobles = CLAVES.filter((c) =>
    [c in ASIGNACION, c in FUERA_DE_CONFIGURACION, c in PENDIENTES_DE_DECISION].filter(Boolean).length > 1);
  assert.deepEqual(dobles, [],
    '🔴 estos campos están en más de una categoría del mapa a la vez:\n   · ' + dobles.join('\n   · '));
});

// ── MICROCOPY SIN APROBAR ────────────────────────────────────────────────────
test('SCRUM-284 · todo rótulo visible lleva su marcador de microcopy pendiente', () => {
  const rotulo = PENDIENTE('Datos de empresa');
  assert.match(rotulo, /^\[PENDIENTE microcopy oficial\] /,
    'los nombres de grupos y submenús NO están aprobados (regla 30): ninguno puede salir sin marcador');
  // Y las claves internas no son rótulos: no deben parecer texto de usuario.
  const conMayusculaOAcento = SUBMENUS.filter((s) => /[A-ZÁÉÍÓÚÑ ]/.test(s));
  assert.deepEqual(conMayusculaOAcento, [],
    '🔴 estas claves de submenú parecen microcopy en vez de identificadores internos: ' +
    'un rótulo sin aprobar no puede colarse como clave.');
});

// ── CONTROL CRUZADO CONTRA LA LISTA HUMANA ───────────────────────────────────
test('SCRUM-284 · contraste con la lista del ticket (reporta, no bloquea)', () => {
  console.log(
    `\n🔀 SCRUM-284 · contraste censo ↔ lista del ticket\n` +
    `   asuntos que enumera el ticket: ${ASUNTOS_DEL_TICKET.length}\n` +
    `   submenús declarados: ${SUBMENUS.length} → ${SUBMENUS.join(', ')}\n` +
    `   campos asignados: ${REVISION.asignados} · pendientes: ${REVISION.pendientes} · fuera: ${REVISION.fuera}\n` +
    `   reparto por submenú:\n` +
    SUBMENUS.map((s) => {
      const n = REVISION.porSubmenu[s].length;
      const nota = n === 0 ? `VACÍO DECLARADO — ${VACIOS_DECLARADOS[s] ? 'con motivo' : '⚠️ SIN MOTIVO'}` : REVISION.porSubmenu[s].join(', ');
      return `     · ${s.padEnd(13)} ${String(n).padStart(2)} → ${nota}`;
    }).join('\n') + '\n',
  );
  assert.equal(REVISION.asignados + REVISION.pendientes + REVISION.fuera, CLAVES.length,
    '🔴 las tres categorías no suman el censo entero: hay campos que el contraste no está mirando.');
});

// ── CONTROLES NEGATIVOS ──────────────────────────────────────────────────────
test('SCRUM-284 · NEGATIVO: un campo declarado pendiente o fuera NO cuenta como sin sitio', () => {
  // Si contasen como huérfanos, el guard estaría en rojo permanente esperando al fundador — y un
  // guard en rojo permanente se acaba desactivando.
  const r = revisarAsignacion(['googleReviewUrl', 'ref-link']);
  assert.deepEqual(r.sinSitio, [], 'están declarados con su motivo: son conocidos, no perdidos');
  assert.equal(r.pendientes, 1);
  assert.equal(r.fuera, 1);
});

test('SCRUM-284 · NEGATIVO: un campo desconocido SÍ cae', () => {
  const r = revisarAsignacion(['campoQueNadieHaColocado']);
  assert.deepEqual(r.sinSitio, ['campoQueNadieHaColocado'],
    'un campo nuevo que nadie coloque tiene que caer: es el fallo mudo del ticket');
});

test('SCRUM-284 · NEGATIVO: con el censo entero, ningún submenú REAL queda vacío por accidente', () => {
  // El complemento del ③: comprobar que los siete que NO están declarados vacíos tienen campos de
  // verdad. Sin esto, ③ podría estar verde porque TODOS estuvieran declarados vacíos.
  const conCampos = SUBMENUS.filter((s) => REVISION.porSubmenu[s].length > 0);
  assert.equal(conCampos.length, SUBMENUS.length - Object.keys(VACIOS_DECLARADOS).length,
    `🔴 el reparto no cuadra: ${conCampos.length} submenús con campos + ` +
    `${Object.keys(VACIOS_DECLARADOS).length} declarados vacíos ≠ ${SUBMENUS.length}.`);
  assert.ok(conCampos.length >= 7,
    `🔴 solo ${conCampos.length} submenús tienen campos: si casi todos estuvieran declarados ` +
    'vacíos, el guard ③ estaría verde sin significar nada.');
});
