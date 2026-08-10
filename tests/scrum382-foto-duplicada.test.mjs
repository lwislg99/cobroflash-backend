// SCRUM-382 · LA MISMA FOTO SUBIDA DOS VECES NO SE GUARDA DOS VECES.
//
// El defecto: `POST /admin/albaranes/:id/fotos` creaba el adjunto sin mirar si esos bytes ya
// estaban. En obra se sube dos veces con facilidad y la copia se quedaba PARA SIEMPRE: ocupaba
// una de las diez plazas, salía repetida en el PDF y en el paquete de evidencias de A7.
//
// ⚠️ `computeAlbaranContentHash` NO sirve para esto y hay un test que lo deja escrito: sella el
// CONTENIDO DEL DOCUMENTO, no los bytes de un fichero. Reutilizarlo habría atado el dedupe de
// adjuntos al sellado de la firma.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fotoYaSubida, huellaDeBytes } from '../dist/modules/jobs/domain/fotoDuplicada.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// SUELO EN LOS DATOS: bytes de verdad, distintos entre sí y con alguno del MISMO tamaño — que es
// donde un dedupe por longitud daría un falso positivo.
const FOTO_A = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6, 7, 8]);
const FOTO_B = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 9, 9, 9, 9, 9, 9, 9]); // MISMO tamaño, otro contenido
const FOTO_C = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1]);                       // otro tamaño

test('SCRUM-382 · SUELO: los fixtures son bytes reales y hay dos del MISMO tamaño', () => {
  // Sin este suelo, el caso que de verdad importa —igual longitud, distinto contenido— no se
  // ejercita y un dedupe por tamaño pasaría en verde borrando fotos buenas.
  assert.equal(FOTO_A.length, FOTO_B.length, 'A y B tienen que medir lo mismo');
  assert.notDeepEqual(FOTO_A, FOTO_B, 'y ser distintas');
  assert.notEqual(FOTO_C.length, FOTO_A.length);
});

test('SCRUM-382 · la misma foto se reconoce y devuelve el id de la que YA está', () => {
  const existentes = [{ id: 11, data: FOTO_A }, { id: 12, data: FOTO_C }];
  assert.equal(fotoYaSubida(FOTO_A, existentes), 11);
});

test('SCRUM-382 · 🔴 dos fotos del MISMO TAMAÑO y distinto contenido NO son la misma', () => {
  // El falso positivo que borraría una foto buena. Es el caso que justifica comparar el hash y
  // no solo la longitud.
  const existentes = [{ id: 11, data: FOTO_A }];
  assert.equal(fotoYaSubida(FOTO_B, existentes), null);
});

test('SCRUM-382 · CONTROL POSITIVO: una foto nueva se comporta como siempre', () => {
  assert.equal(fotoYaSubida(FOTO_C, [{ id: 11, data: FOTO_A }, { id: 12, data: FOTO_B }]), null);
  assert.equal(fotoYaSubida(FOTO_A, []), null, 'sin fotos previas nunca hay duplicado');
});

test('SCRUM-382 · una fila SIN bytes no se trata como duplicado', () => {
  // «No tengo los bytes» y «los bytes son otros» no son lo mismo. Confundirlos haría que una
  // fila con `data` nulo se comiera cualquier foto nueva.
  assert.equal(fotoYaSubida(FOTO_A, [{ id: 9, data: null }]), null);
});

test('SCRUM-382 · la huella es SHA-256 hex y solo depende de los bytes', () => {
  assert.match(huellaDeBytes(FOTO_A), /^[0-9a-f]{64}$/);
  assert.equal(huellaDeBytes(FOTO_A), huellaDeBytes(Buffer.from(FOTO_A)));
  assert.notEqual(huellaDeBytes(FOTO_A), huellaDeBytes(FOTO_B));
});

// ── El acoplamiento que NO se hizo, vigilado ────────────────────────────────

test('SCRUM-382 · el dedupe NO usa el hash del SELLO de la firma', () => {
  // Son dos cosas distintas con la palabra «hash» en medio. Atarlas habría metido el dedupe de
  // adjuntos dentro del camino de emisión (regla 38).
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/domain/fotoDuplicada.ts'), 'utf8');
  const sinComentarios = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!sinComentarios.includes('computeAlbaranContentHash'),
    '🔴 el dedupe de fotos está usando el sellador del albarán: son cosas distintas');
  assert.ok(!/^import /m.test(sinComentarios.replace(/import crypto[^\n]*\n/, '')),
    '🔴 el módulo ha dejado de ser aislado: solo debería depender de `crypto`');
  // Respaldo de la negación (SCRUM-237): el nombre prohibido existe en la casa.
  const sellador = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/domain/albaran.service.ts'), 'utf8');
  assert.match(sellador, /computeAlbaranContentHash/, 'suelo: el nombre tiene que existir');
});

test('SCRUM-382 · la ruta responde IDEMPOTENTE y no crea fila', () => {
  // Guard estructural: la ruta es de servidor y no se puede importar aquí sin base. Se comprueba
  // la FORMA del arreglo — que el duplicado devuelva `already` y NO llame a `create`.
  const rutas = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/albaranes.routes.ts'), 'utf8');
  const bloque = rutas.slice(rutas.indexOf("router.post('/:id/fotos'"), rutas.indexOf("router.get('/:id/fotos'"));
  assert.ok(bloque.length > 200, 'suelo: no he encontrado el handler de subida');
  assert.match(bloque, /fotoYaSubida\(/, '🔴 la ruta no consulta el dedupe');
  const iDup = bloque.indexOf('fotoYaSubida(');
  const iCreate = bloque.indexOf('attachment.create');
  assert.ok(iDup < iCreate, '🔴 el dedupe se consulta DESPUÉS de crear: no evita nada');
  assert.match(bloque, /already: true/, '🔴 el duplicado no responde como idempotente');
});
