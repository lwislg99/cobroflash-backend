// tests/scrum1016-cabecera-fiscal.test.mjs — SCRUM-1016 · el `<head>` no lo auditaba nada.
//
// Hallazgo de J4 (comentario de Jira 16432, 22-sep-2026): `<title>`, `og:title` y `twitter:title`
// CIRCULAN SUELTOS —pestaña del navegador, resultado de Google, previsualización de WhatsApp o
// Twitter— y nunca arrastran el subtítulo que los acota. `scrum331-heroe.test.mjs` auditaba
// `bloqueHeroe()`/`bloquePropuesta()` y JAMÁS el `<head>`: un claim fiscal sin matiz en esos tres
// campos se habría publicado sin que nada saltara. Aquí NO existe «matiz en el mismo bloque»
// (regla 26, condición (b)): un campo de ~60 caracteres no tiene sitio para llevarlo pegado sin
// reventar el límite. La única vía verde es una lista CERRADA de literales firmados, carácter a
// carácter — nunca un patrón (PR #1668 §5B, especificación de J4).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditarCabecera, FISCAL_RE, LITERALES_CABECERA_FIRMADOS } from '../scripts/_cifras-heroe.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');

test('SCRUM-1016 · 🔴 SUELO: si el extractor no lee los tres campos del <head>, se declara CIEGO', () => {
  const r = auditarCabecera('<html><head><title>sin los otros dos</title></head></html>');
  assert.equal(r.ciego, true,
    '🔴 con solo <title> (faltan og:title y twitter:title) ha contestado como si hubiera mirado ' +
    'los tres: «no hay problemas» y «el extractor no encontró los campos» son consecuencias ' +
    'opuestas de la misma lista vacía.');
});

test('SCRUM-1016 · los tres campos del <head> real de public/index.html se leen', () => {
  const r = auditarCabecera(html);
  assert.equal(r.ciego, false, '🔴 no sabe leer el <head> real: ' + r.motivo);
  assert.ok(r.campos.title && r.campos['og:title'] && r.campos['twitter:title'],
    '🔴 alguno de los tres campos salió vacío');
});

test('SCRUM-1016 · 🔴 regla 26 (c): fiscalidad en <title>/og:title/twitter:title SOLO si el valor ' +
  'es, carácter a carácter, uno de los literales firmados', () => {
  const r = auditarCabecera(html);
  assert.deepEqual(r.problemas, [],
    '🔴 hay fiscalidad SIN FIRMA en el <head>: ' + JSON.stringify(r.problemas) +
    '\n   Un campo de ~60 caracteres no puede llevar el matiz pegado (regla 26, condición (b)): ' +
    'la única vía verde es que el valor entero sea uno de `LITERALES_CABECERA_FIRMADOS`, con su ' +
    'comentario de Jira. Ninguna excepción de patrón — así se decidió precisamente porque un ' +
    'patrón de matiz en un campo tan corto es fácil de burlar sin darse cuenta.');
});

test('SCRUM-1016 · 🔴 VERIFICADO EN ROJO: el literal que llevaba esta misma rama antes del ' +
  'comentario 16513 SÍ cae', () => {
  // "YaQu — Del presupuesto a la firma, tu factura VeriFactu sin cambiar de precio" — el que
  // aplicó SCRUM-1016e antes de que Javier firmara el literal corto (comentario 16513). Cita
  // fiscalidad y NO está en la lista cerrada: si esto no cae, el guard no está mirando nada.
  const viejo = 'YaQu — Del presupuesto a la firma, tu factura VeriFactu sin cambiar de precio';
  assert.ok(FISCAL_RE.test(viejo), '🔴 fixture mal elegido: ni siquiera dispara la detección de fiscalidad');
  assert.ok(!LITERALES_CABECERA_FIRMADOS.some((l) => l.literal === viejo),
    '🔴 fixture mal elegido: el literal viejo SÍ está en la lista firmada');

  const sintetico = '<html><head><title>' + viejo + '</title>' +
    '<meta property="og:title" content="' + viejo + '"/>' +
    '<meta name="twitter:title" content="' + viejo + '"/></head></html>';
  const r = auditarCabecera(sintetico);
  assert.equal(r.ciego, false);
  assert.equal(r.problemas.length, 3,
    '🔴 el literal viejo (sin firma de cabecera) no ha caído en los tres campos: ' +
    JSON.stringify(r.problemas));
});

test('SCRUM-1016 · un literal sin ninguna mención fiscal no necesita estar en la lista firmada', () => {
  const neutro = 'YaQu — cualquier titular sin mención fiscal';
  assert.ok(!FISCAL_RE.test(neutro), '🔴 fixture mal elegido: dispara la detección de fiscalidad');
  const sintetico = '<html><head><title>' + neutro + '</title>' +
    '<meta property="og:title" content="' + neutro + '"/>' +
    '<meta name="twitter:title" content="' + neutro + '"/></head></html>';
  assert.deepEqual(auditarCabecera(sintetico).problemas, []);
});

test('SCRUM-1016 · el literal firmado de hoy (comentario 16513) pasa los tres campos', () => {
  const firmado = LITERALES_CABECERA_FIRMADOS[0].literal;
  assert.equal(firmado.length, 59,
    '🔴 el literal firmado ya no mide 59 caracteres — el comentario 16513 lo firmó con esa medida ' +
    'exacta (el conjunto entero cabe en ~60 caracteres sin depender de dónde recorte cada ' +
    'plataforma). Si cambió, hace falta una firma nueva, no ajustar este número.');
  const sintetico = '<html><head><title>' + firmado + '</title>' +
    '<meta property="og:title" content="' + firmado + '"/>' +
    '<meta name="twitter:title" content="' + firmado + '"/></head></html>';
  assert.deepEqual(auditarCabecera(sintetico).problemas, []);
});
