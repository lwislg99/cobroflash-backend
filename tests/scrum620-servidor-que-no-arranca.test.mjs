// tests/scrum620-servidor-que-no-arranca.test.mjs — SCRUM-620
//
// «NO PUDE LEVANTAR MI SERVIDOR» CONTADO COMO «HE ENCONTRADO UN DEFECTO».
//
// El caso real (SCRUM-617): `guard-vias-de-cobro` cayó en 0,3 s con EADDRINUSE —sockets en
// TIME_WAIT de la pasada ANTERIOR DEL PROPIO GUARD— y la puerta lo pintó `rojo(1)`, que es el
// código de «he encontrado un defecto». Lo cazó que el tiempo no cuadraba, NO un mecanismo.
//
// 🔴 POR QUÉ ESTE FICHERO EXISTE Y NO BASTA CON HABERLO PROBADO A MANO: el commit siguiente pasa
// los guards a PUERTO EFÍMERO, y con eso la colisión deja de ocurrir. Sin este test, el código 4
// quedaría escrito y NUNCA MÁS EJERCITADO — que es exactamente el defecto que este ticket
// persigue, cometido al arreglarlo. Aquí la colisión se PROVOCA a propósito, así que se sigue
// ejercitando aunque en la vida real ya no pase.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { levantarServidor, SALIDA_SIN_SERVIDOR } from '../scripts/_servidor.mjs';
import { SALIDA_NO_ENCONTRADO, SALIDA_NO_ARRANCA } from '../scripts/_navegador.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('SCRUM-620 · los CUATRO diagnósticos tienen códigos distintos', () => {
  // Si dos se igualan, vuelven a ser el mismo hecho para quien lee el registro.
  const codigos = { midio: 0, defecto: 1, noEncontrado: SALIDA_NO_ENCONTRADO, noArranca: SALIDA_NO_ARRANCA, sinServidor: SALIDA_SIN_SERVIDOR };
  const vistos = new Set(Object.values(codigos));
  assert.equal(vistos.size, Object.keys(codigos).length,
    `🔴 dos diagnósticos comparten código: ${JSON.stringify(codigos)}\n`
    + '  El 4 NO reusa el 3 a propósito: el fallo del navegador y el del servidor se parecen, y\n'
    + '  que se parezcan es justo lo que hay que impedir que se confunda.');
  assert.equal(SALIDA_SIN_SERVIDOR, 4, '🔴 el código del servidor ha dejado de ser 4.');
});

test('SCRUM-620 · devuelve el puerto REAL, que con 0 no es el que pediste', async () => {
  const srv = http.createServer((_q, r) => r.end('ok'));
  const puerto = await levantarServidor(srv, 0, '127.0.0.1');
  try {
    assert.equal(typeof puerto, 'number');
    assert.ok(puerto > 0, `🔴 con puerto 0 tiene que devolver el que dio el sistema, devolvió ${puerto}`);
    assert.equal(puerto, srv.address().port, '🔴 el puerto devuelto no es el que está escuchando.');
  } finally { srv.close(); }
});

test('SCRUM-620 · 🔴 el puerto OCUPADO para con 4, no con 1', async (t) => {
  // Se ata COMO ATAN LOS GUARDS —sin host, o sea `::`— y no a 127.0.0.1. Ésa es la lección del
  // informe: ocupando sólo 127.0.0.1, el guard ata igual en `::` y lo que sale es OTRA cosa. Un
  // experimento que da el código correcto por el motivo equivocado no prueba nada.
  const okupa = http.createServer((_q, r) => r.end('okupa'));
  await new Promise((ok, err) => { okupa.once('error', err); okupa.listen(0, ok); });
  const puerto = okupa.address().port;

  try {
    const hijo = spawnSync(process.execPath, ['-e',
      `import('./scripts/_servidor.mjs').then(async (m) => {
         const http = await import('node:http');
         const srv = http.createServer((q, r) => r.end(''));
         await m.levantarServidor(srv, ${puerto});
         console.log('HA SEGUIDO');
       })`,
    ], { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });

    assert.equal(hijo.status, SALIDA_SIN_SERVIDOR,
      `🔴 con el puerto ocupado salió con ${hijo.status} y no con ${SALIDA_SIN_SERVIDOR}.\n`
      + '  Si salió con 1, el fallo de arranque del servidor se está contando como «he encontrado\n'
      + `  un defecto» — el defecto de SCRUM-617. Lo que dijo: ${(hijo.stderr || '').trim().slice(0, 300)}`);
    assert.ok(!(hijo.stdout || '').includes('HA SEGUIDO'),
      '🔴 siguió adelante sin servidor: mediría sobre nada y su verde no significaría nada.');
    assert.match(hijo.stderr || '', /NO PUDE LEVANTAR MI SERVIDOR/,
      '🔴 para, pero sin decir por qué.');
    assert.match(hijo.stderr || '', /EADDRINUSE/,
      '🔴 no nombra la causa real; quien lea el log tendría que adivinarla.');
  } finally { okupa.close(); }
});

test('SCRUM-620 · ✅ POSITIVO: con el puerto libre sigue adelante y no para', async () => {
  // Sin esto, «para cuando debe» y «para siempre» dan el mismo verde — y lo segundo dejaría los
  // nueve guards sin correr, que es peor que el defecto que se arregla.
  const hijo = spawnSync(process.execPath, ['-e',
    `import('./scripts/_servidor.mjs').then(async (m) => {
       const http = await import('node:http');
       const srv = http.createServer((q, r) => r.end(''));
       const p = await m.levantarServidor(srv, 0, '127.0.0.1');
       console.log('HA SEGUIDO ' + (p > 0));
       srv.close();
     })`,
  ], { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });

  assert.equal(hijo.status, 0, `🔴 con el puerto libre salió con ${hijo.status}: ${(hijo.stderr || '').slice(0, 200)}`);
  assert.match(hijo.stdout || '', /HA SEGUIDO true/,
    '🔴 no siguió, o no devolvió un puerto útil.');
});
