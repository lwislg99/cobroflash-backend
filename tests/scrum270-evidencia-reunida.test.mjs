// SCRUM-270 · LA EVIDENCIA QUE YA SE TIENE EN LA MANO SE REPORTA, NO SE TIRA.
//
// Sin BD, sin turno, sin red: la pieza es pura y las respuestas se doblan. Un arnés que solo se
// pudiera ejercitar levantando staging no serviría para lo que este ticket cierra — que es
// justamente no gastar turnos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { observarRespuesta, exigirTodas, tablaDeEvidencia } from './_evidencia.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Una respuesta de mentira con el cuerpo que de verdad devuelve cada capa. */
const respuesta = (status, cuerpo) => ({ status, text: async () => cuerpo });

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CORAZÓN · falla la primera y las otras TRES siguen apareciendo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-270 · falla la 1ª de 4 y el mensaje trae LAS CUATRO', async () => {
  const obs = [
    await observarRespuesta('enviar-whatsapp', respuesta(404, '{"error":"not_found"}')),
    await observarRespuesta('enviar-para-firmar', respuesta(200, '{"ok":true}')),
    await observarRespuesta('quotes send-whatsapp', respuesta(200, '{"ok":true}')),
    await observarRespuesta('quote/create', respuesta(200, '{"ok":true}')),
  ];

  let mensaje = null;
  try {
    exigirTodas(obs, (o) => (o.status === 200 ? null : `esperaba 200 y fue ${o.status}`), 'con plan vigente las 4 deben pasar');
  } catch (e) { mensaje = e.message; }

  assert.ok(mensaje, '🔴 no falló: entonces no está comprobando nada');
  // Lo que el ticket dice que decide el caso: ¿falló SOLO una, o las cuatro?
  assert.match(mensaje, /FALLAN 1 de 4/, '🔴 no dice CUÁNTAS fallaron, que es lo que separa los dos diagnósticos');
  for (const n of ['enviar-whatsapp', 'enviar-para-firmar', 'quotes send-whatsapp', 'quote/create']) {
    assert.ok(
      mensaje.includes(n),
      `🔴 «${n}» NO aparece en el fallo. La corrida ya la tenía medida y se ha tirado: es el ` +
        'defecto entero de este ticket, y cuesta otra tanda de ~40 min descubrirlo.',
    );
  }
});

test('SCRUM-270 · fallan las 4 y también se ven las 4 (el otro diagnóstico)', async () => {
  const obs = await Promise.all([
    observarRespuesta('a', respuesta(403, '{"error":"trial_expired"}')),
    observarRespuesta('b', respuesta(403, '{"error":"trial_expired"}')),
    observarRespuesta('c', respuesta(403, '{"error":"trial_expired"}')),
    observarRespuesta('d', respuesta(403, '{"error":"trial_expired"}')),
  ]);
  let mensaje = null;
  try {
    exigirTodas(obs, (o) => (o.status === 200 ? null : `fue ${o.status}`), 'deben pasar');
  } catch (e) { mensaje = e.message; }
  assert.match(mensaje, /FALLAN 4 de 4/,
    '🔴 «fallan las 4» apunta a algo compartido (sesión, tenencia, la fila del merchant) y ' +
    '«falla 1» a la cadena de esa ruta. Si el mensaje no lo distingue, hay que volver a correr.');
});

test('SCRUM-270 · si todas están bien, no molesta', () => {
  const obs = [{ nombre: 'x', status: 200 }, { nombre: 'y', status: 200 }];
  assert.doesNotThrow(() => exigirTodas(obs, (o) => (o.status === 200 ? null : 'no'), 'ok'));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CUERPO · el dato que distingue tres capas y que hoy no se leía
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-270 · el cuerpo se lee, y distingue de qué capa vino el 404', async () => {
  // Medido en el ticket: handler → JSON; requireInternalSecret → texto plano; Express → HTML.
  // Con el estado solo, los tres son «404» y hay que discutir cuál fue.
  const capas = [
    ['handler', '{"error":"not_found"}', /\{"error":"not_found"\}/],
    ['secreto interno', 'Not found', /Not found/],
    ['express sin ruta', '<!DOCTYPE html><html>…', /DOCTYPE html/i],
  ];
  for (const [nombre, cuerpo, patron] of capas) {
    const o = await observarRespuesta(nombre, respuesta(404, cuerpo));
    assert.match(o.cuerpo, patron, `🔴 el cuerpo de «${nombre}» no llega al diagnóstico`);
  }
});

test('SCRUM-270 · un cuerpo ilegible se ANOTA, no tumba el test con otra excepción', async () => {
  // Si leer el cuerpo lanzara, el rojo sería el de la lectura y no el del fallo real: se habría
  // cambiado un diagnóstico mudo por uno equivocado, que es peor.
  const o = await observarRespuesta('rota', { status: 500, text: async () => { throw new Error('socket hang up'); } });
  assert.equal(o.status, 500);
  assert.match(o.cuerpo, /ILEGIBLE.*socket hang up/);
});

test('SCRUM-270 · una comprobación que LANZA no vuelve a esconder a las demás', async () => {
  const obs = [{ nombre: 'a', status: 200 }, { nombre: 'b', status: 500 }];
  let mensaje = null;
  try {
    exigirTodas(obs, (o) => { if (o.nombre === 'a') throw new Error('predicado roto'); return o.status === 200 ? null : 'fue ' + o.status; }, 'x');
  } catch (e) { mensaje = e.message; }
  assert.match(mensaje, /a: la comprobación lanzó/);
  assert.match(mensaje, /b: fue 500/, '🔴 el predicado roto se ha llevado por delante la evidencia de «b»');
});

test('SCRUM-270 · sin observaciones NO pasa en silencio', () => {
  // Un `exigirTodas([])` que devolviera «todo bien» sería un verde hueco con forma de comprobación.
  assert.throws(() => exigirTodas([], () => null, 'x'), /no se está comprobando nada/);
});

test('SCRUM-270 · la tabla marca cuáles fallaron, sin esconder las que pasaron', () => {
  const t = tablaDeEvidencia(
    [{ nombre: 'uno', status: 404, cuerpo: 'x' }, { nombre: 'dos', status: 200, cuerpo: 'y' }],
    new Set(['uno']),
  );
  assert.match(t, /✗ uno: 404/);
  assert.match(t, /· dos: 200/, '🔴 las que pasaron también son evidencia: dicen que el fallo NO es general');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS CASOS DEL TICKET · que de verdad usen la pieza
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-270 · scrum127 comprueba las 4 juntas y lee el cuerpo', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'tests', 'scrum127-paywall-bloquea.test.mjs'), 'utf8');
  assert.match(src, /from '\.\/_evidencia\.mjs'/, '🔴 scrum127 no usa la pieza común');
  assert.match(src, /observarRespuesta\(/, '🔴 scrum127 sigue sin leer el cuerpo de las respuestas');
  assert.match(src, /exigirTodas\(/, '🔴 scrum127 sigue asserteando de una en una');

  // Y que no quede el bucle viejo: `assert` DENTRO de un for sobre las cuatro respuestas es
  // exactamente morir en la primera.
  assert.doesNotMatch(
    src, /for \(const \[nombre, res\] of \[[\s\S]{0,400}?assert\.equal\(res\.status/,
    '🔴 sigue el bucle que assertea dentro: la 2ª, 3ª y 4ª no llegan a imprimirse',
  );
});

test('SCRUM-270 · tenancy-permisos reporta «no veo lo mío» y «veo lo ajeno» a la vez', () => {
  // Son diagnósticos OPUESTOS y hoy el segundo no llega a ejecutarse si cae el primero. El de
  // «no veo lo mío» ya lo instrumentó SCRUM-259 con sus tres estados y NO se reescribe aquí:
  // esto añade lo que faltaba, que las dos preguntas se respondan en la misma corrida.
  const src = fs.readFileSync(path.join(RAIZ, 'tests', 'tenancy-permisos.test.mjs'), 'utf8');
  assert.match(src, /from '\.\/_evidencia\.mjs'/, '🔴 tenancy-permisos no usa la pieza común');
  assert.match(src, /diagnosticarAusencia/, '🔴 se ha perdido el diagnóstico de tres estados de SCRUM-259');
});
