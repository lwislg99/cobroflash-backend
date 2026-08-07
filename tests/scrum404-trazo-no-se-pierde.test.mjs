// tests/scrum404-trazo-no-se-pierde.test.mjs — SCRUM-404
//
// PRIMERO SE CONFIRMA QUE EL TRABAJO ESTÁ A SALVO, DESPUÉS SE CIERRA LA PANTALLA.
//
// H0 (SCRUM-355) midió que `signaturePad.js` hacía `close(); onConfirm(...)`: el modal se cerraba
// ANTES de enviar, así que un envío fallido dejaba el trazo en ninguna parte y había que pedirle
// al cliente que firmara otra vez, delante de él.
//
// ⚠️ ESTO NO ES EL BLOQUE H: el trazo vive solo EN MEMORIA mientras la pantalla está abierta.
// Persistirlo es decisión de H5 y arrastra consecuencias de privacidad que aquí no se valoran.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const PAD = 'public/dashboard/js/signaturePad.js';
const VISTA = 'public/dashboard/js/albaranDetailView.js';

/** Extrae una función declarada por su nombre y la devuelve VIVA, sin ejecutar el resto. */
function extraerFuncion(rel, nombre) {
  const src = leer(rel);
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let texto = null;
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === nombre) texto = n.getText(sf);
    if (!texto) n.forEachChild(visitar);
  };
  visitar(sf);
  // 🔴 SUELO: si no se encuentra, el test FALLA en vez de aprobar por no haber mirado.
  assert.ok(texto, `🔴 no se encontró la función «${nombre}» en ${rel}. Si se renombró, actualiza ` +
    'este test EN EL MISMO commit: un extractor que no encuentra su objeto no puede pasar.');
  // eslint-disable-next-line no-new-func
  return new Function(`${texto}; return ${nombre};`)();
}

// ── R4 · ROJO POR EL MECANISMO: el orden close/onConfirm ─────────────────────────────────

test('SCRUM-404 · 🔴 `close()` NO puede ir antes de `onConfirm`: cerrar es lo ÚLTIMO', () => {
  const src = leer(PAD);
  const sf = ts.createSourceFile(PAD, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  // Se busca el manejador del botón de confirmar y se miran las posiciones RELATIVAS de las dos
  // llamadas dentro de él. Por AST y no por texto: un comentario que mencione `close()` no cuenta.
  let manejador = null;
  const visitar = (n) => {
    if (ts.isCallExpression(n) && n.expression.getText(sf).endsWith('addEventListener')) {
      const [ev, fn] = n.arguments;
      if (ev && ts.isStringLiteral(ev) && ev.text === 'click' && fn && src.slice(n.pos, n.end).includes('onConfirm')) manejador = fn;
    }
    if (!manejador) n.forEachChild(visitar);
  };
  visitar(sf);
  assert.ok(manejador, '🔴 no se encontró el manejador del botón que llama a `onConfirm`. Si se ' +
    'reescribió, actualiza este test: sin manejador no hay nada que comprobar.');

  const posiciones = { close: [], onConfirm: [] };
  const recorrer = (n) => {
    if (ts.isCallExpression(n)) {
      const q = n.expression.getText(sf);
      if (q === 'close') posiciones.close.push(n.getStart(sf));
      if (q === 'onConfirm') posiciones.onConfirm.push(n.getStart(sf));
    }
    n.forEachChild(recorrer);
  };
  recorrer(manejador);

  assert.ok(posiciones.onConfirm.length > 0, '🔴 el manejador ya no llama a `onConfirm`');
  assert.ok(posiciones.close.length > 0, '🔴 el manejador no cierra nunca: el modal se quedaría abierto tras un envío bueno');
  assert.ok(
    Math.min(...posiciones.close) > Math.max(...posiciones.onConfirm),
    '🔴 `close()` VUELVE A IR ANTES DE `onConfirm`. Es exactamente el defecto de SCRUM-404: el ' +
    'modal se cierra antes de que la firma llegue a ningún sitio, y si el envío falla hay que ' +
    'pedirle al cliente que firme OTRA VEZ delante de él. Cerrar es lo último, nunca lo primero.',
  );
});

test('SCRUM-404 · el manejador ESPERA al llamador (si no, cerrar «después» no significa nada)', () => {
  const src = leer(PAD);
  assert.match(src, /await\s+onConfirm\(/,
    '🔴 no se espera a `onConfirm`. Sin `await`, `close()` corre inmediatamente después de LANZAR ' +
    'el envío, no de que termine: el orden en el código sería correcto y el comportamiento el viejo.');
});

// ── R3 · LOS DOS MENSAJES ────────────────────────────────────────────────────────────────

test('SCRUM-404 · 🔴 sin red y rechazo del servidor dicen COSAS DISTINTAS', () => {
  const mensaje = extraerFuncion(VISTA, 'mensajeDeFalloAlFirmar');

  const sinRed = mensaje(Object.assign(new Error('Failed to fetch'), { sinRed: true }));
  const rechazo = mensaje(Object.assign(new Error('409'), { data: { message: 'Este albarán ya está firmado' } }));

  assert.notEqual(sinRed, rechazo,
    '🔴 LOS DOS CASOS DICEN LO MISMO. «Sin conexión» y «el servidor la rechazó» piden acciones ' +
    'OPUESTAS al profesional —esperar, o dejar de intentarlo y mirar qué pasa—, así que un ' +
    'mensaje único le hace probar diez veces algo que no va a funcionar, o rendirse cuando ' +
    'bastaba con esperar.');

  assert.match(sinRed, /sin conexión/i, '🔴 el mensaje de red no nombra la falta de conexión');
  assert.match(rechazo, /rechazada/i, '🔴 el mensaje de rechazo no dice que la rechazaron');
  // Y el detalle del servidor viaja, porque es lo que dice QUÉ pasó.
  assert.match(rechazo, /Este albarán ya está firmado/,
    '🔴 se pierde el motivo que da el servidor: sin él, «rechazada» no dice nada accionable');

  // Microcopy SIN APROBAR (regla 30): los dos van con marcador hasta que el fundador los fije.
  for (const m of [sinRed, rechazo]) {
    assert.match(m, /\[PENDIENTE microcopy oficial/,
      '🔴 se ha escrito microcopy definitivo sin aprobación del fundador (regla 30)');
  }
});

test('SCRUM-404 · `api.js` MARCA el fallo de red sin cambiar el mensaje de los demás', () => {
  const src = leer('public/dashboard/js/api.js');
  assert.match(src, /try\s*\{[\s\S]{0,120}await fetch\(/,
    '🔴 el `fetch` vuelve a estar sin envolver: un fallo de red no se puede distinguir de nada');
  assert.match(src, /sinRed\s*=\s*true/, '🔴 no se marca `sinRed`');
  assert.match(src, /errRed\s*&&\s*errRed\.message/,
    '🔴 se ha perdido el mensaje original. Los demás llamadores deben seguir viendo lo que veían: ' +
    'esta marca AÑADE información, no la sustituye.');
});

// ── R5 · SUELO: un trazo que no es un trazo no se envía ──────────────────────────────────

test('SCRUM-404 · 🔴 SUELO: `toDataURL` sin imagen NO se manda como firma', () => {
  const esTrazoUtil = extraerFuncion(PAD, 'esTrazoUtil');

  for (const malo of ['data:,', '', null, undefined, 'data:image/png;base64,', 'no soy un dataURI',
    'data:image/jpeg;base64,' + 'x'.repeat(400),
    // PNG de 1×1 transparente: es un dataURI válido y NO es una firma.
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==']) {
    assert.equal(esTrazoUtil(malo), false,
      `🔴 aceptó como firma: ${JSON.stringify(String(malo).slice(0, 40))}. Una firma vacía guardada ` +
      'como buena es peor que un error: queda un albarán «firmado» con un trazo que no existe, y ' +
      'nadie lo mira hasta el día que hace falta como prueba.');
  }
  // CONTROL POSITIVO: una firma de verdad pasa. Si no, el suelo bloquearía todo.
  assert.equal(esTrazoUtil('data:image/png;base64,' + 'A'.repeat(400)), true,
    '🔴 rechaza también una firma buena: el suelo no puede impedir firmar');
});
