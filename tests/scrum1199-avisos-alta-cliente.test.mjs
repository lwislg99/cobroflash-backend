// tests/scrum1199-avisos-alta-cliente.test.mjs — SCRUM-1199 (hermano de SCRUM-1161)
//
// LO QUE VE EL PROFESIONAL CUANDO EL ALTA DE CLIENTE FALLA — con los cuatro textos firmados.
//
// El viaje se recorre ENTERO y ejecutado:
//   ① la RUTA real (`customersAdmin.routes.ts`, montada en Express y llamada por `node:http`)
//      produce su 400 de verdad;
//   ② ese cuerpo, tal cual, se le sirve al MODAL real como respuesta de su `fetch`;
//   ③ se lee el aviso que quedó PINTADO en la pantalla.
//
// 🔴 Por qué ① no se puede sustituir por un cuerpo escrito a mano: la primera medición de este
// ticket dio `{"error":"validation_error"}` SIN `details` — con Zod 4, `err.errors` es
// `undefined` y la clave desaparecía. Un fixture escrito a mano habría traído `details` y el test
// habría pasado en verde sobre una pantalla que en producción seguía pintando el genérico.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { constaAprobado } from './_microcopy-aprobada.mjs';

const requiere = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Los CUATRO literales firmados (SCRUM-1199, comentario 17321). Se comparan con `===`.
const TELEFONO_CORTO = 'Revisa el teléfono: le faltan cifras.';
const MOVIL_CORTO = 'Revisa el móvil: le faltan cifras.';
const EMAIL_INVALIDO = 'Revisa el email: no parece una dirección válida.';
const GENERICO = 'No se ha podido guardar el cliente. Revisa los datos e inténtalo de nuevo.';

/** ① Llama a la RUTA REAL y devuelve su status y su cuerpo, sin tocarlos. */
async function respuestaDeLaRuta(metodo, ruta, cuerpo) {
  const express = requiere(path.join(RAIZ, 'node_modules/express'));
  const router = requiere(path.join(RAIZ, 'dist/modules/system/app/routes/customersAdmin.routes.js')).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.merchantId = 1; req.userRole = 'admin'; next(); });
  app.use('/admin/customers', router);
  const srv = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  try {
    return await new Promise((ok, ko) => {
      const datos = JSON.stringify(cuerpo);
      const pet = http.request({
        host: '127.0.0.1', port: srv.address().port, path: ruta, method: metodo,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(datos) },
      }, (res) => {
        let b = '';
        res.on('data', (c) => { b += c; });
        res.on('end', () => ok({ status: res.statusCode, cuerpo: JSON.parse(b) }));
      });
      pet.on('error', ko);
      pet.end(datos);
    });
  } finally {
    await new Promise((ok) => srv.close(ok));
  }
}

/** ②③ Monta el modal real, le hace responder `respuesta` al guardar y devuelve lo que se pintó. */
async function avisoPintado(respuesta, { email = '', fijo = '', movil = '' } = {}) {
  const banco = cargarDashboard(RAIZ, {
    red: {
      navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
      fetch: async (url, opts) => {
        const alta = /\/admin\/customers$/.test(String(url)) && opts && opts.method === 'POST';
        const r = alta ? respuesta : { status: 200, cuerpo: [] };
        return {
          ok: r.status < 400, status: r.status, statusText: '',
          headers: { get: () => 'application/json' },
          json: async () => r.cuerpo, text: async () => JSON.stringify(r.cuerpo),
        };
      },
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `la vista de Clientes no montó: ${r.error && r.error.message}`);

  banco.ctx.altaClienteModal.abrirNuevo({});
  const nodos = todos(banco.ctx.document.body);
  const control = (nombre) => nodos.filter((n) => n.name === nombre)[0];
  control('name').value = 'Fontanería Ejemplo';
  control('email').value = email;
  control('phone').value = fijo;
  control('mobile').value = movil;

  const formularios = nodos.filter((n) => n.tagName === 'FORM' && (n._oyentes.submit || []).length);
  assert.equal(formularios.length, 1, '🔴 CIEGO: no encuentro el formulario del modal con su oyente de Guardar');
  formularios[0].disparar('submit');
  for (let i = 0; i < 20; i++) await new Promise((res) => setImmediate(res));

  return todos(banco.ctx.document.body).map((n) => n.textContent || '').join(' | ');
}

test('SCRUM-1199 · los cuatro literales constan FIRMADOS en docs/microcopy', () => {
  for (const t of [TELEFONO_CORTO, MOVIL_CORTO, EMAIL_INVALIDO, GENERICO]) {
    assert.ok(constaAprobado(t).length > 0, `🔴 «${t}» no consta aprobado: no se pinta un texto sin firma (regla 39)`);
  }
});

test('SCRUM-1199 · 🔴 la ruta REAL trae el campo y el código en `details` (sin esto, todo cae al genérico)', async () => {
  for (const [campo, valor, codigo] of [['phone', '341', 'too_small'], ['mobile', '341', 'too_small'], ['email', 'x', 'invalid_format']]) {
    const r = await respuestaDeLaRuta('POST', '/admin/customers', { name: 'A', [campo]: valor });
    assert.equal(r.status, 400);
    assert.ok(Array.isArray(r.cuerpo.details),
      `🔴 el 400 no trae \`details\` (${JSON.stringify(r.cuerpo)}): ¿vuelve a mandar \`err.errors\`, que en Zod 4 no existe?`);
    assert.deepEqual([r.cuerpo.details[0].path, r.cuerpo.details[0].code], [[campo], codigo]);
  }
  // Y el PUT, que comparte el aviso del mismo modal.
  const put = await respuestaDeLaRuta('PUT', '/admin/customers/5', { phone: '341' });
  assert.deepEqual(put.cuerpo.details?.[0]?.path, ['phone'], `el PUT no trae el campo: ${JSON.stringify(put.cuerpo)}`);
});

test('SCRUM-1199 · 🔴 EL QUE DECIDE: cada 400 real pinta SU texto, y ninguno el código en crudo', async () => {
  const casos = [
    [{ name: 'A', phone: '341' }, TELEFONO_CORTO],
    [{ name: 'A', mobile: '341' }, MOVIL_CORTO],
    [{ name: 'A', email: 'x' }, EMAIL_INVALIDO],
  ];
  for (const [cuerpo, esperado] of casos) {
    const pintado = await avisoPintado(await respuestaDeLaRuta('POST', '/admin/customers', cuerpo), { fijo: '600000000' });
    assert.ok(pintado.includes(esperado), `🔴 con ${JSON.stringify(cuerpo)} no se pinta «${esperado}». Pantalla: ${pintado.slice(0, 300)}`);
    assert.ok(!pintado.includes('validation_error'), `🔴 el código en crudo sigue en pantalla con ${JSON.stringify(cuerpo)}`);
    // Y el teléfono NO se confunde con el móvil: son dos cajas en la misma pantalla (SCRUM-590).
    const otro = esperado === TELEFONO_CORTO ? MOVIL_CORTO : esperado === MOVIL_CORTO ? TELEFONO_CORTO : null;
    if (otro) assert.ok(!pintado.includes(otro), `🔴 se manda a mirar la caja equivocada con ${JSON.stringify(cuerpo)}`);
  }
});

test('SCRUM-1199 · el genérico es el SUELO: sustituye al crudo, sin tragarse un mensaje humano', async () => {
  // Un 400 que no es de campo (el vínculo de empresa, SCRUM-576) → hoy salía en crudo → genérico.
  const empresa = await avisoPintado({ status: 400, cuerpo: { error: 'empresa_no_valida' } }, { fijo: '600000000' });
  assert.ok(empresa.includes(GENERICO), `🔴 empresa_no_valida no pinta el genérico: ${empresa.slice(0, 300)}`);
  assert.ok(!empresa.includes('empresa_no_valida'), '🔴 el código en crudo sigue en pantalla');

  // Un mensaje humano del servidor GANA: el genérico no lo tapa.
  const humano = 'Mensaje propio del servidor.';
  const conMensaje = await avisoPintado({ status: 409, cuerpo: { error: 'algo', message: humano } }, { fijo: '600000000' });
  assert.ok(conMensaje.includes(humano), `🔴 el genérico se ha tragado un mensaje específico: ${conMensaje.slice(0, 300)}`);
  assert.ok(!conMensaje.includes(GENERICO));
});
