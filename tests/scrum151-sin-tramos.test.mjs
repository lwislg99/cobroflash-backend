import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { motivoSinTramo } from '../dist/modules/quotes/domain/billingPlan.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = fs.readFileSync(path.join(raiz, 'public', 'dashboard', 'js', 'api.js'), 'utf8');
const detalle = fs.readFileSync(path.join(raiz, 'public', 'dashboard', 'js', 'quotesDetailView.js'), 'utf8');
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

/**
 * SCRUM-151 — el rechazo se EXPLICA, y con código propio.
 *
 * Decisión del fundador (27-jul-2026): un Trabajo MANUAL/SIN_CONDICIONES **sí debe poder
 * facturarse** desde YaQu; "manual" es "yo pacto CUÁNDO cobro", no "yo facturo fuera". La vía
 * de emisión manual NO se construye aquí (zona fiscal). Esto es la mitad de UI.
 */

test('SCRUM-151: dos causas, dos CÓDIGOS — no solo dos textos', () => {
  // Un único código para dos causas obliga a cualquier consumidor (UI, soporte, un log) a leer
  // el texto para saber qué pasó. El texto es justo lo que no se debe parsear.
  const vacio = motivoSinTramo([]);
  const agotado = motivoSinTramo([{ label: '50%' }, { label: '50%' }]);

  assert.equal(vacio.error, 'no_billing_plan');
  assert.equal(agotado.error, 'no_more_invoices_for_payment_terms');
  assert.notEqual(vacio.error, agotado.error, 'las dos causas no pueden compartir código');
});

test('SCRUM-151: el mensaje del plan VACÍO no dice "no disponible"', () => {
  // "No disponible para estas condiciones de pago" suena a "con MANUAL aquí no se factura",
  // que es exactamente la lectura que el fundador descartó. El texto tiene que hablar de
  // TRAMOS, que es lo que de verdad falta.
  const { message } = motivoSinTramo([]);
  assert.match(message, /tramos automáticos/, 'debe explicar que lo que no hay son TRAMOS');
  assert.doesNotMatch(message, /no disponible/i, 'no puede sonar a "aquí no se factura": el fundador decidió que MANUAL sí debe poder facturarse');
});

test('SCRUM-151: el mensaje del plan AGOTADO no habla de condiciones de pago', () => {
  const { message } = motivoSinTramo([{ label: '100%' }]);
  assert.match(message, /Ya se han emitido todas las facturas/);
  assert.doesNotMatch(message, /condiciones/i, 'el plan agotado no tiene nada que ver con las condiciones: se emitió todo lo pactado');
});

test('SCRUM-151: ningún mensaje promete la vía de emisión manual, que aún no existe', () => {
  // La vía manual está decidida pero NO construida (zona fiscal, SCRUM-20/173 en vuelo).
  // Un texto que la prometa es una UI que miente, que es el problema que este ticket arregla.
  for (const plan of [[], [{ label: 'x' }]]) {
    const { message } = motivoSinTramo(plan);
    assert.doesNotMatch(message, /a mano|manualmente|próximamente|pronto/i, `el mensaje promete algo que no existe: "${message}"`);
  }
});

test('SCRUM-151: apiRequest prefiere el mensaje humano al código técnico', () => {
  // EL ARREGLO GENÉRICO. Esto componía siempre `API 409: <codigo>`, así que CUALQUIER endpoint
  // sin `message` acababa enseñándole un identificador interno al usuario.
  const codigo = sinComentarios(api);
  assert.match(
    codigo,
    /new Error\(\s*data\?\.message\s*\|\|/,
    'apiRequest vuelve a componer el error con el código técnico por delante del mensaje humano'
  );
  assert.match(codigo, /err\.code\s*=/, 'se pierde err.code: ramificar por código es lo correcto, y hay que dejarlo disponible');
});

test('SCRUM-151: el botón de factura pinta el mensaje del servidor, no el código', () => {
  const codigo = sinComentarios(detalle);
  assert.match(
    codigo,
    /setStatus\('error',\s*data\.message\s*\|\|/,
    'vuelve "Error generando factura: no_more_invoices_for_payment_terms" en pantalla'
  );
});

test('SCRUM-151: el texto falso no vuelve a ninguna de las dos ramas del botón', () => {
  // Estaba en DOS sitios y por motivos distintos: el de MANUAL (motivo real: no hay tramos) y
  // el de plan custom sin aceptar (motivo real: falta aceptar el presupuesto). Ninguno de los
  // dos era "las condiciones de pago".
  const codigo = sinComentarios(detalle);
  assert.doesNotMatch(
    codigo,
    /No disponible para estas condiciones de pago/,
    'vuelve el texto que el fundador declaró falso al decidir que MANUAL sí debe poder facturarse'
  );
  assert.match(codigo, /Estas condiciones no generan tramos automáticos/, 'falta el texto aprobado para MANUAL/SIN_CONDICIONES');
  assert.match(codigo, /Solo disponible tras aceptar el presupuesto/, 'falta el motivo real del plan custom sin aceptar');
});
