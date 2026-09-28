// tests/scrum1161-alta-sin-correo.test.mjs — SCRUM-1161 (cierra P1-CONT-19b de docs/BUGS.md)
//
// DAR DE ALTA UN CLIENTE SIN CORREO, O SIN TELÉFONO, DESDE LA PANTALLA DE VERDAD.
//
// El modal mandaba `email: ""` y `phone: ""` con el campo vacío, y `customerCreateSchema` los
// declara `.optional()`: acepta la clave AUSENTE y rechaza la cadena vacía. Resultado en
// producción: «Error guardando cliente: API 400: validation_error» — y el fontanero casi nunca
// tiene el correo de su cliente.
//
// 🔴 El servidor NO exige ninguno de los dos (medido en el PASO 0 ejecutando el esquema). Por eso
// el arreglo es el payload y no el esquema: aquí se prueba el viaje entero, pantalla → cable →
// puerta REAL, porque probar sólo el payload es lo que dejó esto meses sin ver (BUGS.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { moduloDeDist } from './_envio-doblado.mjs';
import { tramoNacionalDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIJO_NACIONAL = tramoNacionalDePrueba(11610001); // rango imposible (SCRUM-262)

/** Monta el modal REAL, escribe lo que se le diga, pulsa Guardar y devuelve el payload del cable. */
async function guardarDesdeLaPantalla({ email = '', fijo = '' }) {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opciones) => {
      peticiones.push({ url: String(url || ''), opciones });
      return url && /\/admin\/customers$/.test(String(url)) ? { id: 1, name: 'Cliente' } : [];
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `la vista de Clientes no montó: ${r.error && r.error.message}`);

  banco.ctx.altaClienteModal.abrirNuevo({});
  const nodos = todos(banco.ctx.document.body);
  const control = (nombre) => {
    const encontrados = nodos.filter((n) => n.name === nombre);
    assert.equal(encontrados.length, 1, `🔴 CIEGO: esperaba UN control \`${nombre}\` y hay ${encontrados.length}`);
    return encontrados[0];
  };
  control('name').value = 'Fontanería Ejemplo';
  control('email').value = email;
  control('phone').value = fijo;
  control('mobile').value = '';

  const formularios = nodos.filter((n) => n.tagName === 'FORM' && (n._oyentes.submit || []).length);
  assert.equal(formularios.length, 1, '🔴 CIEGO: no encuentro el formulario del modal con su oyente de Guardar');
  formularios[0].disparar('submit');
  for (let i = 0; i < 20; i++) await new Promise((res) => setImmediate(res));

  const alta = peticiones.find((p) => /\/admin\/customers$/.test(p.url) && p.opciones?.method === 'POST');
  assert.ok(alta, `🔴 pulsar Guardar no produjo un alta. Peticiones: ${JSON.stringify(peticiones.map((p) => p.url))}`);
  return JSON.parse(alta.opciones.body);
}

const puerta = () => moduloDeDist('../dist/core/validation/schemas.js').customerCreateSchema;

function pasaLaPuerta(payload) {
  const r = puerta().safeParse(payload);
  return r.success ? null : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

test('SCRUM-1161 · 🔴 control: la puerta SÍ distingue — el payload de antes (`""`) se rechaza', () => {
  // Sin esto, un «acepta» abajo podría ser un esquema que lo acepta todo.
  assert.ok(pasaLaPuerta({ name: 'X', email: '', phone: '' }), 'la puerta acepta `""`: los casos de abajo no medirían nada');
  assert.ok(pasaLaPuerta({ name: 'X', email: 'no-es-un-correo' }), 'un correo mal escrito debe seguir rechazándose');
});

test('SCRUM-1161 · 🔴 EL QUE DECIDE: nombre + teléfono, SIN correo, se guarda desde la pantalla', async () => {
  const payload = await guardarDesdeLaPantalla({ fijo: FIJO_NACIONAL });
  assert.ok(!('email' in payload), `🔴 el correo vacío viaja: ${JSON.stringify(payload.email)}`);
  assert.ok(payload.phone, 'control: el teléfono tecleado sí debe viajar');
  assert.equal(pasaLaPuerta(payload), null, `🔴 la puerta rechaza el alta: ${pasaLaPuerta(payload)}`);
});

test('SCRUM-1161 · nombre + correo, SIN teléfono, se guarda desde la pantalla', async () => {
  const payload = await guardarDesdeLaPantalla({ email: 'cliente@ejemplo.test' });
  assert.ok(!('phone' in payload), `🔴 el teléfono vacío viaja: ${JSON.stringify(payload.phone)}`);
  assert.equal(payload.email, 'cliente@ejemplo.test');
  assert.equal(pasaLaPuerta(payload), null, `🔴 la puerta rechaza el alta: ${pasaLaPuerta(payload)}`);
});

test('SCRUM-1161 · un correo mal escrito sigue llegando a la puerta (no se traga en el navegador)', async () => {
  // El arreglo es «vacío no viaja», NO «lo que no valga no viaja»: eso borraría en silencio lo que
  // el profesional escribió. Lo mal escrito llega y la puerta lo para.
  const payload = await guardarDesdeLaPantalla({ email: 'juan-arroba-gmail', fijo: FIJO_NACIONAL });
  assert.equal(payload.email, 'juan-arroba-gmail');
  assert.ok(pasaLaPuerta(payload));
});
