// Tests de utilidades críticas (core/utils). Runner integrado de Node (node --test).
// Se ejecutan contra el build (dist/), por eso el script de test compila primero.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as U from '../dist/core/utils/utils.js';

test('normalizePhone: vacío / inválido → ""', () => {
  assert.equal(U.normalizePhone(''), '');
  assert.equal(U.normalizePhone(null), '');
  assert.equal(U.normalizePhone(undefined), '');
  assert.equal(U.normalizePhone('123'), '');      // < 8 dígitos
  assert.equal(U.normalizePhone('abc'), '');
  assert.equal(U.normalizePhone('1234567890123456'), ''); // > 15 dígitos
});

test('normalizePhone: limpia separadores, +, y 00', () => {
  assert.equal(U.normalizePhone('+34 600 111 222'), '34600111222');
  assert.equal(U.normalizePhone('0034600111222'), '34600111222');
  assert.equal(U.normalizePhone('(600) 111-222'), '600111222');
  assert.equal(U.normalizePhone('34600111222'), '34600111222');
  assert.equal(U.normalizePhone('  600 11 22 33 '), '600112233');
});

test('calcTotal: suma, IVA y redondeo a 2 decimales', () => {
  assert.equal(U.calcTotal([{ concept: 'a', qty: 2, price: 10 }]), 20);
  assert.equal(U.calcTotal([{ concept: 'a', qty: 1, price: 100, tax: 0.21 }]), 121);
  assert.equal(U.calcTotal([{ concept: 'a', qty: 3, price: 9.99 }]), 29.97);
  assert.equal(U.calcTotal([{ concept: 'a', qty: 1, price: 0.1, tax: 0.2 }]), 0.12);
  assert.equal(U.calcTotal([]), 0);
  // varias líneas con y sin IVA
  assert.equal(
    U.calcTotal([
      { concept: 'mano', qty: 4, price: 45 },          // 180
      { concept: 'mat', qty: 1, price: 100, tax: 0.21 }, // 121
    ]),
    301,
  );
});

test('makeReference: formato CF-YYYYMMDD-XXXX y único', () => {
  const r1 = U.makeReference();
  assert.match(r1, /^CF-\d{8}-[A-Z0-9]{1,6}$/);
  const r2 = U.makeReference();
  assert.notEqual(r1, r2); // parte aleatoria distinta
});

// SCRUM-1213: aquí se probaba `parseNumericId`, retirada (sin llamador desde SCRUM-95). La que
// SÍ sirve cada enlace del cliente es `parseToken`, que no tenía test: se prueba la misma regla.
test('parseToken: tolera URLs sucias del botón de WhatsApp', () => {
  const t = 'ab12'.repeat(8);                              // 32 hex, como randomBytes(16)
  assert.equal(U.parseToken(t), t);                        // limpio
  assert.equal(U.parseToken('{{1}}' + t), t);              // placeholder sin sustituir (¡sin su 1!)
  assert.equal(U.parseToken(('/pay/quote/{{1}}' + t).split('/').pop()), t);
  assert.equal(U.parseToken(' ' + t.toUpperCase() + ' '), t); // espacios y mayúsculas
  assert.equal(U.parseToken('{{1}}'), '', 'solo placeholder → vacío');
  assert.equal(U.parseToken('zzz'), '', 'sin hex → vacío');
  assert.equal(U.parseToken(null), '', 'null → vacío');
});

test('esc: escapa HTML peligroso y tolera null/number', () => {
  assert.equal(U.esc('<b>"x"&\'</b>'), '&lt;b&gt;&quot;x&quot;&amp;&#39;&lt;/b&gt;');
  assert.equal(U.esc(null), '');
  assert.equal(U.esc(undefined), '');
  assert.equal(U.esc(42), '42');
  assert.equal(U.esc('sin nada'), 'sin nada');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MUTACIÓN QUE ME TUMBA (SCRUM-745) — Y POR QUÉ ESTE FICHERO EN CONCRETO
//
// 🔴 ES EL PRIMER CASO DEL ÁRBOL EN QUE LA MUTACIÓN TOCA UN FUENTE COMPILADO Y EL TEST MIDE
// `dist/`. Este fichero importa `../dist/core/utils/utils.js` en la línea 5, arriba del todo: no
// lee el `.ts`, ejecuta lo que salió del compilador.
//
// Hasta ahora las declaraciones sobre TypeScript del árbol comprobaban el FUENTE (leían el `.ts`
// y buscaban una forma en él), así que la frontera `src/` ↔ `dist/` no las tocaba. Ésta sí, y por
// eso existe: mide el mecanismo de SCRUM-763 —emitir el `.js` al mutar y devolver LOS DOS— con un
// caso en el que, sin ese mecanismo, la mutación no llegaría al código que se ejecuta.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // `esc` deja de escapar `<`. Si `dist/` no recibe la mutación, este test sigue VERDE sobre un
    // fuente que ya no escapa: el guard parecería mudo y no lo sería.
    fichero: 'src/core/utils/utils.ts',
    de: "'<':'&lt;'",
    a: "'<':'&LT;'",
    cae: 'esc: escapa HTML peligroso y tolera null/number',
  },
];
