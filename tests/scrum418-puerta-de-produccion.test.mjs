// tests/scrum418-puerta-de-produccion.test.mjs — SCRUM-418
//
// ⚠️ NI UNA CADENA DE CONEXIÓN REAL EN ESTE FICHERO. Los casos usan hosts inventados con la MISMA
// FORMA que los de verdad (el fragmento que distingue, y nada más): no hay usuario, ni clave, ni
// puerto real, ni nombre de proyecto. Lo que se prueba es la decisión, no la credencial.
import test from 'node:test';
import assert from 'node:assert/strict';

const { evaluarPuerta, hostDe, exigirDestinoDeclarado, HOST_DE_PRODUCCION, VARIABLE_DE_PRODUCCION } =
  await import('../dist/core/db/puertaDeProduccion.js');

const urlCon = (host) => `postgresql://u:p@${host}:5432/basedeejemplo`;
const PROD    = urlCon('autorack.ejemplo.invalid');
const STAGING = urlCon('acela.ejemplo.invalid');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-418 · SUELO: si el host no se puede leer, NO se conecta y se dice', () => {
  for (const basura of [undefined, null, '', '   ', 'no-es-una-url', 42, {}]) {
    const v = evaluarPuerta(basura, {});
    assert.equal(v.abre, false,
      `🔴 con «${String(basura)}» la puerta ABRE. «Apunta bien» y «no supe mirar» no pueden dar el ` +
      'mismo verde: el segundo te deja escribiendo en producción creyendo que estás en local.');
    assert.equal(v.motivo, 'host_ilegible');
    assert.match(v.mensaje, /NO SE PUEDE LEER EL HOST/);
  }
  // Control positivo del lector: con una URL buena SÍ saca el host.
  assert.equal(hostDe(STAGING), 'acela.ejemplo.invalid',
    '🔴 el lector de host no funciona ni con una URL válida: el suelo de arriba no probaría nada.');
});

// ── EL ROJO POR EL MECANISMO ─────────────────────────────────────────────────────────────────

test('SCRUM-418 · 🔴 producción SIN la variable declarada: no conecta, y NOMBRA el host', () => {
  const v = evaluarPuerta(PROD, {});   // entorno limpio: nadie ha declarado nada

  assert.equal(v.abre, false,
    '🔴 se abre una conexión a producción sin que nadie lo haya declarado. Once `.env` de árboles ' +
    'de trabajo apuntaban ahí el 11-ago-2026, uno el checkout principal.');
  assert.equal(v.motivo, 'produccion_sin_declarar');

  // Que NOMBRE el host y la variable: un «error de conexión» genérico manda a quien lo lee a
  // buscar un problema de red que no existe.
  assert.match(v.mensaje, /autorack\.ejemplo\.invalid/,
    '🔴 el mensaje no dice a QUÉ host iba. Sin el host, el aviso obliga a adivinar.');
  assert.match(v.mensaje, new RegExp(VARIABLE_DE_PRODUCCION),
    '🔴 el mensaje no dice QUÉ variable falta: sabe que algo va mal y no dice cómo arreglarlo.');
  assert.doesNotMatch(v.mensaje, /u:p@/,
    '🔴 el mensaje está filtrando la cadena de conexión. Una credencial se protege impidiendo que ' +
    'el error la saque, no redactando el mensaje después.');
});

test('SCRUM-418 · CONTROL POSITIVO: con la variable puesta, producción conecta igual que hoy', () => {
  const v = evaluarPuerta(PROD, { [VARIABLE_DE_PRODUCCION]: '1' });
  assert.equal(v.abre, true,
    '🔴 producción ha dejado de poder conectar CON la variable puesta. Esta puerta protege de un ' +
    'accidente, no apaga el producto.');
  assert.equal(v.destino, 'produccion');
});

test('SCRUM-418 · CONTROL POSITIVO 2: staging conecta SIN ninguna variable', () => {
  const v = evaluarPuerta(STAGING, {});
  assert.equal(v.abre, true,
    '🔴 staging necesita ahora una variable que no necesitaba: la puerta estaría estorbando donde ' +
    'no hay riesgo, que es como acaban desactivándose.');
  assert.equal(v.destino, 'otro');
  // Y el local, igual.
  assert.equal(evaluarPuerta(urlCon('127.0.0.1'), {}).abre, true);
});

// ── LO QUE NO PUEDE DECIDIR LA PUERTA ────────────────────────────────────────────────────────

test('SCRUM-418 · 🔴 el NOMBRE de la base no decide: «railway» es prod Y staging', () => {
  // `current_database()` devuelve «railway» en las dos, y el entorno de Railway donde vive staging
  // se llama «production». Si la puerta mirase el nombre, se equivocaría en las dos direcciones.
  const prodLlamadaRailway    = urlCon('autorack.ejemplo.invalid');
  const stagingLlamadaRailway = urlCon('acela.ejemplo.invalid');
  assert.equal(evaluarPuerta(prodLlamadaRailway, {}).abre, false,
    '🔴 producción pasa: la puerta está mirando algo que no es el host.');
  assert.equal(evaluarPuerta(stagingLlamadaRailway, {}).abre, true,
    '🔴 staging NO pasa: la puerta está decidiendo por el nombre de la base, que es el mismo en las dos.');

  // Y el fragmento que decide es el del host, declarado y no adivinado.
  assert.equal(HOST_DE_PRODUCCION, 'autorack');
});

test('SCRUM-418 · `exigirDestinoDeclarado` LANZA, que es lo que impide construir el cliente', () => {
  assert.throws(() => exigirDestinoDeclarado(PROD, {}), /YAQU_DESTINO_PRODUCCION/,
    '🔴 no lanza: entonces `prisma.ts` seguiría construyendo el cliente y la puerta sería un cartel.');
  assert.doesNotThrow(() => exigirDestinoDeclarado(STAGING, {}));
  assert.doesNotThrow(() => exigirDestinoDeclarado(PROD, { [VARIABLE_DE_PRODUCCION]: '1' }));
});

test('SCRUM-418 · la puerta se llama ANTES de construir el cliente, no después', () => {
  // Si se llamara después, el cliente ya existiría y bastaría con que alguien lo importara.
  const fuente = fs.readFileSync(new URL('../src/core/db/prisma.ts', import.meta.url), 'utf8');
  const iPuerta = fuente.indexOf('exigirDestinoDeclarado()');
  const iCliente = fuente.indexOf('new PrismaClient');
  assert.ok(iPuerta > 0, '🔴 `prisma.ts` ya no llama a la puerta: no hay guard.');
  assert.ok(iPuerta < iCliente,
    '🔴 la puerta se llama DESPUÉS de construir el cliente. Entonces no impide nada: el cliente ya ' +
    'está hecho y cualquiera que lo importe conecta.');
});

import fs from 'node:fs';
