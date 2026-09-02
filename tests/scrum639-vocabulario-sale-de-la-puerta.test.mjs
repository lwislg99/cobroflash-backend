// tests/scrum639-vocabulario-sale-de-la-puerta.test.mjs — SCRUM-639
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// «NO LLEGUÉ A MEDIR» Y «MEDÍ Y HAY DEFECTOS» TENÍAN LA MISMA PUERTA.
//
// Literal del runner:
//
//     ✖ guard:contraste   30.1 s   arranque 30.0 s   NO ARRANCA
//     🔴 NO PUDE ARRANCARLO: el navegador ESTÁ y no levanta.
//     Error: Process completed with exit code 1.
//
// El guard EXPLICA en su texto que eso no es el caso 1, y el proceso sale con 1. Desde GitHub
// Actions —que es desde donde se mira— «el navegador no levantó» era indistinguible de «hay un
// defecto de contraste real». Costó dos días tratando tres PR como sospechosas.
//
// Es la familia de SCRUM-620 («EADDRINUSE sale por la misma puerta que rojo(1)») una capa más
// arriba: se arregló el hijo y el padre seguía colapsando.
//
// ⚠️ POR QUÉ ESTE TEST MIDE SOBRE LA FUNCIÓN PURA Y NO LANZANDO LA PUERTA: lanzarla son nueve
// navegadores y ~90 s, y un control que cuesta eso no lo ejercita nadie — que es exactamente
// cómo el defecto llegó a producción. La reproducción de punta a punta, con navegador real y
// defecto real, está medida y escrita en `docs/master/SCRUM-639.md`.
//
// ⚠️ Y MIDE LAS DOS DIRECCIONES. Con una sola no se demuestra nada: una puerta que sacara SIEMPRE
// 3 pasaría la dirección B, y la de antes —que sacaba siempre 1— pasaba la A. Lo que prueba el
// arreglo no es ninguno de los dos códigos por separado, sino que SEAN DISTINTOS.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { veredicto, llegoAMedir, anuncio, VOCABULARIO } from '../scripts/guards-visuales.mjs';
import { SALIDA_NO_ENCONTRADO, SALIDA_NO_ARRANCA } from '../scripts/_navegador.mjs';
import { SALIDA_SIN_SERVIDOR } from '../scripts/_servidor.mjs';

/** Una fila como la que arma la puerta tras correr un guard. */
const fila = (g, estado, codigo) => ({ g, estado, codigo });

const VERDE = fila('guard:verde', 'verde', 0);

test('SCRUM-639 · DIRECCIÓN A · midió y encontró defectos → sale por la puerta 1', () => {
  const v = veredicto([VERDE, fila('guard:contraste', 'rojo(1)', 1)]);
  assert.equal(v.codigo, 1);
  assert.equal(v.midio, true);
  assert.match(v.titulo, /DEFECTOS/);
  assert.match(v.detalle, /guard:contraste/);
});

test('SCRUM-639 · DIRECCIÓN B · el navegador está y no levanta → NO sale por la puerta 1', () => {
  const v = veredicto([
    fila('guard:contraste', 'NO ARRANCA', SALIDA_NO_ARRANCA),
    fila('guard:caja-avisos', 'NO ARRANCA', SALIDA_NO_ARRANCA),
  ]);
  assert.equal(v.codigo, SALIDA_NO_ARRANCA);
  assert.equal(v.midio, false);
  assert.match(v.titulo, /NO MEDIDO/);
  assert.match(v.detalle, /no se ha comprobado nada/);
});

test('SCRUM-639 · 🔴 EL CONTROL: las dos direcciones NO comparten código', () => {
  const a = veredicto([fila('guard:contraste', 'rojo(1)', 1)]);
  const b = veredicto([fila('guard:contraste', 'NO ARRANCA', SALIDA_NO_ARRANCA)]);

  assert.notEqual(a.codigo, b.codigo,
    '🔴 un defecto real y un navegador que no levanta vuelven a salir por la misma puerta: el\n'
    + '  arreglo no ha hecho nada. Es el defecto entero de este ticket.');

  // Y que se vean SIN abrir el log: la anotación de Actions tampoco puede decir lo mismo.
  assert.notEqual(anuncio(a).anotacion, anuncio(b).anotacion);
  assert.match(anuncio(a).anotacion, /^::error title=/);
  assert.match(anuncio(b).anotacion, /^::error title=/);
});

test('SCRUM-639 · cada ceguera conserva SU código: 2 no es 3 y 3 no es 4', () => {
  const dos = veredicto([fila('g', 'CIEGO', SALIDA_NO_ENCONTRADO)]);
  const tres = veredicto([fila('g', 'NO ARRANCA', SALIDA_NO_ARRANCA)]);
  const cuatro = veredicto([fila('g', 'SIN SERVIDOR', SALIDA_SIN_SERVIDOR)]);

  assert.equal(dos.codigo, SALIDA_NO_ENCONTRADO);
  assert.equal(tres.codigo, SALIDA_NO_ARRANCA);
  assert.equal(cuatro.codigo, SALIDA_SIN_SERVIDOR);
  assert.equal(new Set([dos.codigo, tres.codigo, cuatro.codigo]).size, 3,
    'si dos cegueras comparten código, el diagnóstico vuelve a ser el mismo y esto no vale.');
});

test('SCRUM-639 · un DEFECTO manda sobre una ceguera — y la cobertura parcial se DICE', () => {
  const v = veredicto([
    fila('guard:contraste', 'rojo(1)', 1),
    fila('guard:a11y-landing', 'NO ARRANCA', SALIDA_NO_ARRANCA),
  ]);

  // Sale 1 a propósito: un defecto no se puede relanzar hasta que desaparezca. Si esto saliera 3,
  // el job se leería como infraestructura, alguien lo relanzaría y el defecto acabaría mergeando.
  assert.equal(v.codigo, 1);
  assert.equal(v.ciegos, 1);
  assert.match(v.detalle, /NO es la lista completa de defectos/,
    '🔴 sale 1 y NO avisa de que un guard no midió: se está anunciando una cobertura que no hubo.');
});

test('SCRUM-639 · cegueras que no coinciden → el 2 genérico, y lo dice', () => {
  const v = veredicto([
    fila('a', 'CIEGO', SALIDA_NO_ENCONTRADO),
    fila('b', 'NO ARRANCA', SALIDA_NO_ARRANCA),
  ]);
  assert.equal(v.codigo, SALIDA_NO_ENCONTRADO);
  assert.equal(v.midio, false);
  assert.match(v.detalle, /no coinciden/);
});

test('SCRUM-639 · el TOPE tampoco midió, aunque no traiga código', () => {
  const v = veredicto([fila('guard:lento', 'TOPE', null)]);
  assert.equal(v.midio, false);
  assert.equal(v.codigo, SALIDA_NO_ENCONTRADO);
  assert.notEqual(v.codigo, 1, 'un guard cortado por el tope no ha encontrado ningún defecto.');
});

test('SCRUM-639 · un código DESCONOCIDO cuenta como defecto, no como ceguera', () => {
  // Fail-closed en la dirección que importa. Las dos equivocaciones no cuestan lo mismo: leer una
  // ceguera como defecto hace perder tiempo; leer un defecto como ceguera lo relanza hasta que
  // desaparece y lo mergea.
  assert.equal(llegoAMedir(77), true);
  assert.equal(veredicto([fila('g', 'rojo(77)', 77)]).codigo, 1);
});

test('SCRUM-639 · CONTROL NEGATIVO: todo verde sigue saliendo 0 y sin ruido', () => {
  const v = veredicto([VERDE, fila('guard:otro', 'verde', 0)]);
  assert.equal(v.codigo, 0);
  assert.equal(v.defectos, 0);
  assert.equal(v.ciegos, 0);
});

test('SCRUM-639 · SUELO: el vocabulario no puede tener dos códigos que signifiquen lo mismo', () => {
  const codigos = [...VOCABULARIO.keys()];
  assert.equal(new Set(codigos).size, codigos.length);
  assert.ok(codigos.length >= 5, 'faltan desenlaces en el vocabulario: 0, 1, 2, 3 y 4.');
  // Y que la distinción que sostiene todo esto siga en pie.
  assert.equal(VOCABULARIO.get(1).midio, true);
  assert.equal(VOCABULARIO.get(SALIDA_NO_ARRANCA).midio, false);
});
