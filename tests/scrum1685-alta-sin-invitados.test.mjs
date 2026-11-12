// tests/scrum1685-alta-sin-invitados.test.mjs — SCRUM-1685, tramo a
//
// La puerta de alta con invitación (`REGISTRATION_INVITED_EMAILS`) es FAIL-CLOSED: sin la variable,
// `POST /auth/register` contesta lo mismo que desde SCRUM-1515, byte a byte, para TODOS. Este fichero
// mide la variable AUSENTE en su propio proceso (`node --test` corre cada fichero aparte y la
// configuración se lee al importar `dist/`). La lista con correos la mide
// `scrum1685-alta-con-invitacion.test.mjs`.
//
// No necesita base: con la puerta cerrada la ruta no llega a la base. Si la tocara, aquí no hay
// ninguna que tocar (se quita `DATABASE_URL`) y el 409 se convertiría en otra cosa.
import './_staging-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// Antes de cargar `dist/`: la configuración se lee al importar.
delete process.env.REGISTRATION_INVITED_EMAILS;
delete process.env.DATABASE_URL;
process.env.DISABLE_CRONS = 'true';

// El literal firmado (SCRUM-1515 c.18971). Copiado de Jira, no de la ruta.
const FRASE_FIRMADA = 'Ahora mismo no estamos aceptando altas nuevas. Si quieres probar YaQu, escríbenos y te damos acceso.';
const CUERPO_CERRADA = JSON.stringify({ error: 'registration_closed', message: FRASE_FIRMADA });

function pedir(puerto, cuerpo) {
  return new Promise((resolve, reject) => {
    const datos = Buffer.from(JSON.stringify(cuerpo));
    const req = http.request({ host: '127.0.0.1', port: puerto, path: '/auth/register', method: 'POST', agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': datos.length } },
    (res) => { let d = ''; res.setEncoding('utf8'); res.on('data', (t) => { d += t; }); res.on('end', () => resolve({ status: res.statusCode, texto: d })); });
    req.on('error', reject);
    req.end(datos);
  });
}

test('SCRUM-1685 · sin REGISTRATION_INVITED_EMAILS la ruta de alta sigue CERRADA para todos, byte a byte', async () => {
  const { config } = await import('../dist/core/config/env.js');
  assert.ok(Array.isArray(config.REGISTRATION_INVITED_EMAILS),
    '🔴 CIEGO: la configuración no expone REGISTRATION_INVITED_EMAILS como lista');
  assert.deepEqual(config.REGISTRATION_INVITED_EMAILS, [], '🔴 sin la variable, la lista de invitados no está vacía');

  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    const puerto = server.address().port;
    // Un cuerpo PERFECTO (el que dejaría pasar la lista), uno vacío y basura: la misma respuesta.
    const perfecto = { name: 'Reformas 1685', email: 'invitado-1685@test.local', country: 'ES', provincia: 'Madrid',
      'domicilio-foral': 'no', 'domicilio-canarias': 'no' };
    for (const cuerpo of [perfecto, {}, { email: 'x@y.es' }, { name: 'sin arroba', email: 'nada' }]) {
      const r = await pedir(puerto, cuerpo);
      assert.equal(r.status, 409, `🔴 sin invitados la ruta tiene que dar 409 y dio ${r.status} ${r.texto.slice(0, 120)}`);
      assert.equal(r.texto, CUERPO_CERRADA, '🔴 sin invitados la ruta no contesta la frase firmada byte a byte');
    }
    // …y las veces que haga falta: sin un 429 que cambie la frase.
    for (let i = 0; i < 7; i++) assert.equal((await pedir(puerto, perfecto)).texto, CUERPO_CERRADA, `🔴 a la ${i + 2}.ª vez ya no contesta lo mismo`);
  } finally {
    server.close();
  }
});

test('SCRUM-1685 · una lista sólo de comas y espacios cuenta como VACÍA', async () => {
  const { listaDeCorreos } = await import('../dist/core/config/env.js');
  assert.equal(typeof listaDeCorreos, 'function', '🔴 CIEGO: env.ts no exporta listaDeCorreos');
  assert.deepEqual(listaDeCorreos(' , ,  ,'), []);
  assert.deepEqual(listaDeCorreos(undefined), []);
  assert.deepEqual(listaDeCorreos(''), []);
  // Control positivo: la misma función SÍ devuelve correos cuando los hay, normalizados.
  assert.deepEqual(listaDeCorreos('  Uno@Test.Local , ,dos@x.es '), ['uno@test.local', 'dos@x.es']);
});
