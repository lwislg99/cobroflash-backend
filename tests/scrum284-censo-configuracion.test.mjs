// tests/scrum284-censo-configuracion.test.mjs — SCRUM-284 (B1), guard estructural, sin gate.
//
// NINGÚN AJUSTE DESAPARECE SIN QUE ALGO SE PONGA ROJO.
//
// B1 trocea Configuración en nueve submenús. El propio ticket nombra su fallo mudo: «un ajuste
// que desaparece en una reorganización es el fallo mudo de este ticket. Nadie lo nota hasta que
// alguien va a cambiar su IBAN y no lo encuentra».
//
// Este fichero NO asigna campos a submenús — eso espera a que el fundador confirme el orden de
// B1. Solo enumera lo que HAY, derivándolo del árbol, y falla si deja de encontrarlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarConfiguracion, columnasDeMerchant } from './_censo-configuracion.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/settingsView.js');
const SCHEMA = path.join(RAIZ, 'prisma/schema.prisma');

const CENSO = censarConfiguracion(fs.readFileSync(VISTA, 'utf8'), 'settingsView.js');
const COLUMNAS = new Set(columnasDeMerchant(fs.readFileSync(SCHEMA, 'utf8')));

// ── SUELOS, medidos HOY sobre `main` ─────────────────────────────────────────
// No son cifras de gusto: son lo que hay, fijado. Quitar un campo baja el conteo y esto cae —
// que es exactamente el rojo que pide el ticket. Si mañana se AÑADE un campo, estos números
// suben con él y el suelo se actualiza a conciencia, no por inercia.
const SUELO_CREATEFIELD = 13;
const SUELO_TOGGLE = 3;   // los avisos por email — la CUARTA forma, que el censo perdía
const SUELO_SELECT = 1;
const SUELO_PLANTILLA = 5;

test('SCRUM-284 · SUELO: el censo encuentra los campos del formulario principal', () => {
  const n = CENSO.porOrigen.createField || 0;
  assert.ok(n >= SUELO_CREATEFIELD,
    `🔴 el censo solo vio ${n} campos vía createField (esperados ≥${SUELO_CREATEFIELD}). ` +
    'O ha desaparecido un ajuste de Configuración, o el detector dejó de reconocerlos. ' +
    'Las dos cosas son rojo: «0 campos» y «no supe mirar» son el mismo número.');
});

test('SCRUM-284 · SUELO: el censo ve las CUATRO formas de declarar un campo', () => {
  assert.ok((CENSO.porOrigen.createToggle || 0) >= SUELO_TOGGLE,
    `🔴 solo ${CENSO.porOrigen.createToggle || 0} avisos por email (esperados ≥${SUELO_TOGGLE}). ` +
    'Es la forma que el censo perdía en su primera versión: se declaran con `createToggle`, no ' +
    'con `createField`, y no aparecían por ninguna parte estando la pantalla intacta.');
  assert.ok((CENSO.porOrigen.select || 0) >= SUELO_SELECT,
    `🔴 no se vio ningún campo declarado como select a mano (país). Una lista basada solo en ` +
    '`createField` lo perdería, y por eso el suelo lo exige aparte.');
  assert.ok((CENSO.porOrigen.plantilla || 0) >= SUELO_PLANTILLA,
    `🔴 solo ${CENSO.porOrigen.plantilla || 0} campos en plantillas HTML (esperados ` +
    `≥${SUELO_PLANTILLA}): página pública, color de marca e invita-y-gana viven ahí.`);
});

test('SCRUM-284 · SUELO: el censo lee de verdad el fichero', () => {
  assert.ok(CENSO.campos.length >= SUELO_CREATEFIELD + SUELO_TOGGLE + SUELO_SELECT + SUELO_PLANTILLA,
    `🔴 censo total de ${CENSO.campos.length} campos: por debajo de la suma de los tres suelos.`);
  assert.ok(CENSO.campos.every((c) => Number.isInteger(c.linea) && c.linea > 0),
    '🔴 hay campos sin línea: el censo no está leyendo posiciones reales del árbol.');
});

// ── EL CRUCE QUE CAZA UN RENOMBRADO ──────────────────────────────────────────
// Un conteo solo ve desapariciones. Si alguien RENOMBRA `iban` a `ibanCuenta` el conteo no se
// mueve y el ajuste queda escribiendo en una columna que no existe. El cruce contra el modelo
// —derivado del schema, no una lista— lo caza.
test('SCRUM-284 · toda clave del formulario principal existe en el modelo Merchant', () => {
  const huerfanas = CENSO.campos
    .filter((c) => c.origen === 'createField' && !COLUMNAS.has(c.clave))
    .map((c) => `${c.clave} (línea ${c.linea})`);
  assert.deepEqual(huerfanas, [],
    '🔴 estas claves de Configuración no son columnas de `Merchant`: un renombrado dejaría el ' +
    'ajuste escribiendo en el vacío.');
});

test('SCRUM-284 · SUELO del cruce: el modelo Merchant se leyó de verdad', () => {
  // Sin esto, un schema ilegible daría un conjunto vacío y el cruce de arriba pasaría en verde
  // por no tener nada contra qué comparar.
  assert.ok(COLUMNAS.size >= 20,
    `🔴 solo ${COLUMNAS.size} columnas leídas de Merchant: el parseo del schema está roto y el ` +
    'cruce de claves no está comprobando nada.');
});

// ── CONTROL NEGATIVO ─────────────────────────────────────────────────────────
test('SCRUM-284 · NEGATIVO: un control que no es un ajuste no entra en el censo', () => {
  // Un botón, un div o un enlace no son campos de Configuración. Si el censo los contase,
  // el número dejaría de significar «ajustes» y el suelo no protegería nada.
  const fuente = `
    const x = \`<button id="pp-save" class="btn">Guardar</button>
                <div id="qr-img"></div>
                <a id="ref-copy" href="#">Copiar</a>\`;
  `;
  assert.deepEqual(censarConfiguracion(fuente, 'falso.js').campos, [],
    'botones, divs y enlaces no son ajustes: contarlos inflaría el censo y lo volvería inútil');
});

test('SCRUM-284 · NEGATIVO: el helper createField en sí no se cuenta como campo', () => {
  const fuente = `function createField(labelText, name, type = "text", required = false) { return {}; }`;
  assert.deepEqual(censarConfiguracion(fuente, 'falso.js').campos, [],
    'la DECLARACIÓN del helper no es un campo; solo lo son sus llamadas');
});

// ── LA SALIDA, para el fundador ──────────────────────────────────────────────
test('SCRUM-284 · el censo, impreso (es el entregable de esta tarea)', () => {
  const lineas = CENSO.campos.map(
    (c) => `  ${String(c.linea).padStart(3)}  ${c.origen.padEnd(11)} ${c.clave.padEnd(22)} ${c.obligatorio ? '(obligatorio) ' : ''}${c.etiqueta}`,
  );
  console.log(
    `\n📋 SCRUM-284 · censo de Configuración — ${CENSO.campos.length} campos ` +
    `(${JSON.stringify(CENSO.porOrigen)})\n` + lineas.join('\n') + '\n',
  );
  assert.ok(CENSO.campos.length > 0);
});
