// tests/scrum1228b-permisos-no-reintentan.test.mjs — SCRUM-1228 (arreglo, GO del fundador en el
// comentario 17407 del ticket) · SIF-1 · S1-D.
//
// El 302 que la AEAT devuelve SIN CERTIFICADO salía `sin_respuesta` («no sabemos si llegó») y la
// cola lo reintentaba 4 veces en 15 minutos antes de avisar a nadie. Reintentar sólo sirve cuando
// el que reintenta puede tener suerte; con un problema de permisos no la hay (criterio del
// orquestador, SCRUM-1228 comentario 17365 y `docs/master/SCRUM-1228.md` §⑤bis).
//
// 🔴 LO QUE SE VIGILA, en las dos direcciones:
//   ① una respuesta NO SOAP con 302, 401 o 403 sale `sin_permiso` y la cola la para AL PRIMER
//     intento, con una persona avisada. El 302 es el REAL: sus 153 bytes, comprobados por sha256
//     contra la captura de `docs/master/SCRUM-1228.md` ①.
//   ② EL POSITIVO: un corte de red DE VERDAD (reset, timeout) y los 502/503 SIGUEN reintentando
//     como hoy. Un arreglo que parara también eso sería peor que el defecto.
//   ③ Lo SIN DETERMINAR (500 y 200 con HTML) sigue como hoy, a propósito y declarado.
//   ④ Un SOAP `Fault` con 403 sigue siendo `rechazado`: el `Fault` manda sobre el código HTTP.
//
// Servidor falso en loopback (`node:net`/`node:http`, nunca `fetch`). Sin certificado, sin AEAT.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = require(path.join(RAIZ, 'dist/modules/fiscal/verifactu/sif.client.js'));
const cola = require(path.join(RAIZ, 'dist/modules/fiscal/verifactu/sif.cola.js'));

/** La respuesta REAL de prewww1.aeat.es sin certificado (SCRUM-1228 ①), byte a byte. */
const REAL_302 = Buffer.from(
  'HTTP/1.0 302 Moved Temporarily\r\n'
  + 'Location: https://sede.agenciatributaria.gob.es/Sede/errores/erro4033.html\r\n'
  + 'Connection: Keep-Alive\r\n'
  + 'Content-Length: 0\r\n'
  + '\r\n');
const SHA_REAL_302 = 'eb57d30758bca8ec5798a817b5e823bfe1b090b36cc4a8f3556b62876034bd82';

const REG = { idEmisorFactura: 'B00000000', numSerieFactura: 'F260001', fechaExpedicionFactura: '28-09-2026', tipoOperacion: 'Alta' };
const FAULT = '<?xml version="1.0"?><env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>'
  + '<env:Fault><faultcode>env:Client</faultcode><faultstring>Codigo[4112].El titular del certificado debe ser Obligado Emision</faultstring></env:Fault>'
  + '</env:Body></env:Envelope>';
const HTML = '<html><body><h1>Error</h1></body></html>';

const servidores = [];
after(() => { for (const s of servidores) s.close(); });

/** TCP en loopback que, al recibir el sobre, escribe `bytes` tal cual y cierra. */
async function crudo(bytes) {
  const s = net.createServer((sock) => { sock.once('data', () => sock.end(bytes)); sock.on('error', () => {}); });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  servidores.push(s);
  return `http://127.0.0.1:${s.address().port}/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP`;
}

/** HTTP en loopback: `manejar(req, res, socket)` tras leer el sobre entero. */
async function servidor(manejar) {
  const s = http.createServer((req, res) => {
    req.on('data', () => {});
    req.on('end', () => manejar(req, res, req.socket));
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  servidores.push(s);
  return `http://127.0.0.1:${s.address().port}/wlpl/falso/VerifactuSOAP`;
}

const responder = (status, body, tipo = 'text/html') => (_q, res) => { res.writeHead(status, { 'Content-Type': tipo }); res.end(body); };

const enviar = (url) => cli.enviarSobre({
  endpoint: url, cuerpoSoap: '<sonda/>', envioId: 'scrum1228b', traza: () => {},
  timeouts: { esperarRespuestaMs: 400 },
});

/** Pasa el MISMO resultado por la cola encadenando intentos, como la sonda de SCRUM-1228 ⑥. */
function recorrerCola(resultado) {
  const estados = [];
  let previos = 0;
  let ultima = null;
  for (let i = 0; i <= cola.MAX_INTENTOS; i++) {
    ultima = cola.decidirTrasEnvio([{ registro: REG, intentosPrevios: previos }], resultado).registros[0];
    estados.push(ultima.estado);
    if (ultima.estado !== 'pending') break;
    previos = ultima.intentos;
  }
  return { estados, ultima };
}

const REINTENTA_COMO_HOY = ['pending', 'pending', 'pending', 'pending', 'manual_review'];

// ═══════════════════════════════════════════════ ① permisos: no se reintenta

test('SCRUM-1228 · el fixture ES la respuesta real: 153 bytes y el sha256 de la captura', () => {
  assert.equal(REAL_302.length, 153);
  assert.equal(crypto.createHash('sha256').update(REAL_302).digest('hex'), SHA_REAL_302);
});

test('SCRUM-1228 · 🔴 el 302 REAL sin certificado sale sin_permiso, no sin_respuesta', async () => {
  const r = await enviar(await crudo(REAL_302));
  assert.equal(r.tipo, 'sin_permiso', JSON.stringify(r));
  assert.equal(r.httpStatus, 302);
  assert.equal(r.etapa, 'interpretar');
  assert.equal(r.motivo, 'http_302:no_es_xml');
});

test('SCRUM-1228 · 🔴 con el 302 REAL la cola para al PRIMER intento y avisa a una persona', async () => {
  const r = await enviar(await crudo(REAL_302));
  const { estados, ultima } = recorrerCola(r);
  assert.deepEqual(estados, ['manual_review'], 'ni un reintento: no hay suerte que tener');
  assert.equal(ultima.intentos, 1);
  assert.equal(ultima.requierePersona, true);
  assert.equal(ultima.reintentarEnS, null);
  assert.equal(ultima.subsanar, false, 'el registro no tiene nada mal: no hay nada que subsanar');
  assert.equal(ultima.lastError, 'sin_permiso:interpretar:http_302:no_es_xml');
});

test('SCRUM-1228 · 401 y 403 sin sobre SOAP → sin_permiso y manual_review al primer intento', async () => {
  for (const [status, cuerpo, motivo] of [
    [401, '', 'http_401:no_es_xml'],
    [403, HTML, 'http_403:sin_sobre_soap'],
  ]) {
    const r = await enviar(await servidor(responder(status, cuerpo)));
    assert.equal(r.tipo, 'sin_permiso', `${status}: ${JSON.stringify(r)}`);
    assert.equal(r.motivo, motivo);
    assert.deepEqual(recorrerCola(r).estados, ['manual_review'], String(status));
  }
});

// ═══════════════════════════════════════════════ ② EL POSITIVO: la red sigue reintentando

test('SCRUM-1228 · ✅ POSITIVO: un corte de red de verdad (reset) SIGUE reintentando como hoy', async () => {
  const r = await enviar(await servidor((_q, _r, sock) => sock.destroy()));
  assert.equal(r.tipo, 'sin_respuesta', JSON.stringify(r));
  assert.deepEqual(recorrerCola(r).estados, REINTENTA_COMO_HOY);
});

test('SCRUM-1228 · ✅ POSITIVO: la AEAT que no contesta (timeout) SIGUE reintentando como hoy', async () => {
  const r = await enviar(await servidor(() => { /* no contesta */ }));
  assert.equal(r.tipo, 'sin_respuesta', JSON.stringify(r));
  assert.match(r.motivo, /^timeout_/);
  assert.deepEqual(recorrerCola(r).estados, REINTENTA_COMO_HOY);
});

test('SCRUM-1228 · ✅ POSITIVO: 502 y 503 (el servidor o el proxy fallaron) SIGUEN reintentando', async () => {
  for (const [status, cuerpo] of [[502, HTML], [503, '']]) {
    const r = await enviar(await servidor(responder(status, cuerpo)));
    assert.equal(r.tipo, 'sin_respuesta', `${status}: ${JSON.stringify(r)}`);
    assert.deepEqual(recorrerCola(r).estados, REINTENTA_COMO_HOY, String(status));
  }
});

// ═══════════════════════════════════════════════ ③ SIN DETERMINAR: como hoy, declarado

test('SCRUM-1228 · 500 y 200 con HTML quedan SIN DETERMINAR: como hoy, reintentan', async () => {
  for (const status of [500, 200]) {
    const r = await enviar(await servidor(responder(status, HTML)));
    assert.equal(r.tipo, 'sin_respuesta', `${status}: ${JSON.stringify(r)}`);
    assert.deepEqual(recorrerCola(r).estados, REINTENTA_COMO_HOY, String(status));
  }
});

// ═══════════════════════════════════════════════ ④ el Fault manda sobre el código HTTP

test('SCRUM-1228 · un SOAP Fault con 403 sigue siendo rechazado (el Fault se lee antes que el status)', async () => {
  const r = await enviar(await servidor(responder(403, FAULT, 'text/xml')));
  assert.equal(r.tipo, 'rechazado', JSON.stringify(r));
  assert.equal(r.porque, 'soap_fault');
  assert.deepEqual(recorrerCola(r).estados, ['rejected']);
});
