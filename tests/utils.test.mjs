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

test('parseNumericId: tolera URLs sucias del botón de WhatsApp', () => {
  assert.equal(U.parseNumericId('23'), 23);             // limpio
  assert.equal(U.parseNumericId('{{1}}23'), 23);        // placeholder sin sustituir (¡no 123!)
  assert.equal(U.parseNumericId('{{2}}107'), 107);      // otro índice de placeholder
  assert.equal(U.parseNumericId('/pay/quote/{{1}}23'.split('/').pop()), 23);
  assert.equal(U.parseNumericId(' 23 '), 23);           // espacios
  assert.equal(U.parseNumericId(23), 23);               // ya numérico
  assert.ok(Number.isNaN(U.parseNumericId('{{1}}')), 'solo placeholder → NaN');
  assert.ok(Number.isNaN(U.parseNumericId('abc')), 'sin dígitos → NaN');
  assert.ok(Number.isNaN(U.parseNumericId('')), 'vacío → NaN');
  assert.ok(Number.isNaN(U.parseNumericId(null)), 'null → NaN');
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
