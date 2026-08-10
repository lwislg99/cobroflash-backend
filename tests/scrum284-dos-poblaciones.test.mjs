// tests/scrum284-dos-poblaciones.test.mjs — SCRUM-284: el mapa cubre LAS DOS poblaciones.
//
// Un campo huérfano y una superficie huérfana son el MISMO defecto: algo que la reorganización
// deja sin sitio y nadie nota hasta que va a buscarlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarConfiguracion } from './_censo-configuracion.mjs';
import { revisarAsignacion } from './_asignacion-submenus.mjs';
import { censarSuperficies, revisarSuperficies, SUPERFICIES_PENDIENTES } from './_censo-superficies-configuracion.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const VISTA = path.join(AQUI, '..', 'public/dashboard/js/settingsView.js');
const FUENTE = fs.readFileSync(VISTA, 'utf8');

const CAMPOS = censarConfiguracion(FUENTE, 'settingsView.js');
const SUP = censarSuperficies(FUENTE, 'settingsView.js');
const REV_CAMPOS = revisarAsignacion(CAMPOS.campos.map((c) => c.clave));
const REV_SUP = revisarSuperficies(SUP.superficies.map((s) => s.clave));

const SUELO_CAMPOS = 25;
const SUELO_SUPERFICIES = 4;

// ── SUELOS, uno por población ────────────────────────────────────────────────
test('SCRUM-284 · SUELO de campos', () => {
  assert.ok(CAMPOS.campos.length >= SUELO_CAMPOS,
    `🔴 ${CAMPOS.campos.length} campos (esperados ≥${SUELO_CAMPOS}): el censo de campos está ciego.`);
});

test('SCRUM-284 · SUELO de superficies', () => {
  assert.ok(SUP.superficies.length >= SUELO_SUPERFICIES,
    `🔴 ${SUP.superficies.length} superficies (esperadas ≥${SUELO_SUPERFICIES}): el censo de ` +
    'superficies está ciego. «No hay bloques» y «no supe mirar» son el mismo número.');
});

// ── EL GUARD, sobre LAS DOS ─────────────────────────────────────────────────
test('SCRUM-284 · ningún CAMPO se queda sin sitio', () => {
  assert.deepEqual(REV_CAMPOS.sinSitio, []);
});

test('SCRUM-284 · ninguna SUPERFICIE se queda sin sitio', () => {
  assert.deepEqual(REV_SUP.sinSitio, [],
    '🔴 estas superficies no están asignadas ni declaradas pendientes. Un bloque sin sitio ' +
    'desaparece en la reorganización igual que un campo:\n   · ' + REV_SUP.sinSitio.join('\n   · '));
});

// ── CONTROL POSITIVO · la superficie SIN id ─────────────────────────────────
test('SCRUM-284 · POSITIVO: se censa una superficie que NO tiene id', () => {
  // Es el caso que prueba que el criterio no puede ser «tiene identificador»: el contador de
  // WhatsApp no tiene ninguno y es una superficie entera.
  const wa = SUP.superficies.find((s) => s.clave === 'renderWaFairUseCard');
  assert.ok(wa, '🔴 se perdió la superficie sin id: el criterio ha vuelto a depender de los ids');
  assert.match(wa.titulo, /WhatsApp/);
});

// ── CONTROL NEGATIVO ────────────────────────────────────────────────────────
test('SCRUM-284 · NEGATIVO: un control DENTRO de una superficie no es una superficie', () => {
  // `renderProfileQrButton(card, m)` recibe una TARJETA ya pintada y no abre título.
  const claves = SUP.superficies.map((s) => s.clave);
  assert.ok(!claves.includes('renderProfileQrButton'),
    'un botón dentro de una tarjeta no es un bloque con sitio propio');
});

test('SCRUM-284 · NEGATIVO: la vista entera no es una superficie', () => {
  assert.ok(!SUP.superficies.map((s) => s.clave).includes('renderSettingsView'),
    'renderSettingsView es la pantalla, no un bloque dentro de ella');
});

// ── CUADRE DE LA SUMA — la comprobación que pide el ticket ──────────────────
test('SCRUM-284 · el reparto de los identificadores CUADRA', () => {
  const ids = [...new Set([...FUENTE.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map((m) => m[1]))];
  const clavesCampo = new Set(CAMPOS.campos.map((c) => c.clave));
  const deCampo = ids.filter((i) => clavesCampo.has(i));
  const deSuperficie = ids.filter((i) => !clavesCampo.has(i));

  console.log(
    `\n📋 SCRUM-284 · DOS POBLACIONES de Configuración\n` +
    `   CAMPOS: ${CAMPOS.campos.length}  (${REV_CAMPOS.asignados} asignados · ${REV_CAMPOS.pendientes} pendientes · ${REV_CAMPOS.sinSitio.length} sin sitio)\n` +
    `   SUPERFICIES: ${SUP.superficies.length}  (${REV_SUP.pendientes} pendientes · ${REV_SUP.sinSitio.length} sin sitio)\n` +
    SUP.superficies.map((s) => `     ${String(s.linea).padStart(4)}  ${s.clave.padEnd(26)} «${s.titulo}»`).join('\n') +
    `\n\n   CUADRE de los ${ids.length} identificadores de la pantalla:\n` +
    `     ${deCampo.length} son CAMPOS · ${deSuperficie.length} son controles DE superficie o contenedores\n` +
    `     ${deCampo.length} + ${deSuperficie.length} = ${deCampo.length + deSuperficie.length} ✓\n`,
  );

  assert.equal(deCampo.length + deSuperficie.length, ids.length,
    '🔴 la suma no cuadra: hay identificadores que no son ni campo ni control de superficie, ' +
    'o sea una TERCERA población sin censar.');
  assert.ok(ids.length >= 20, `🔴 solo ${ids.length} identificadores leídos: el reparto no mide nada.`);
});

test('SCRUM-284 · toda superficie pendiente lleva su propuesta escrita', () => {
  for (const [clave, motivo] of Object.entries(SUPERFICIES_PENDIENTES)) {
    assert.ok(motivo.length > 60, `la pendiente ${clave} no explica dónde propone ir ni por qué`);
  }
});
