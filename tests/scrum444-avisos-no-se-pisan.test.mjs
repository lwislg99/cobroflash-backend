// tests/scrum444-avisos-no-se-pisan.test.mjs — SCRUM-444
//
// LLEGA UN SEGUNDO AVISO Y EL PRIMERO DESAPARECE.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, Y POR QUÉ SALE AHORA
//
// `showToast` empezaba con `getElementById('yaqu-toast')?.remove()`: **cada aviso borraba al
// anterior**. Llevaba ahí desde siempre y era invisible porque la ventana de colisión eran 5 s.
//
// SCRUM-443 alargó los errores hasta 15 s —correcto y medido— y con ello **multiplicó la ventana**.
// No es motivo para revertirlo: arreglar la duración destapó el defecto de al lado.
//
// El caso peor es un ÉXITO borrando un ERROR: un «guardado» de 3 s tapando un fallo que el
// profesional estaba leyendo. Con 30 avisos `ok` en el árbol frente a 12 `error`, no es raro.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA FORMA SALE DE LA MEDICIÓN, Y SON DOS REGLAS, NO UNA
//
//   · MENSAJES DISTINTOS → se apilan. Ninguno se pierde.
//   · EL MISMO MENSAJE otra vez → NO se apila: se le reinicia el reloj.
//
// Lo segundo no es una optimización. Medido: «No se pudieron guardar las notas» está en DOS
// sitios (`jobsView.js:383` y `jobDetailView.js:2593`) y se dispara al perder el foco, así que
// reintentar y volver a fallar produce **el mismo texto otra vez**. Dos copias idénticas apiladas
// ocupan el doble y no dicen nada nuevo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(RAIZ, 'public/dashboard/js/api.js');

/** Un banco nuevo por caso: los avisos son estado global y se pisarían entre tests. */
function banco() {
  const b = cargarDashboard(RAIZ);
  return {
    ctx: b.ctx,
    avisos: () => {
      const pila = b.ctx.document.getElementById('yaqu-toasts');
      return pila ? pila.hijos.map((n) => ({ msg: n.dataset.msg, kind: n.dataset.kind })) : [];
    },
  };
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-444 · 🔴 SUELO: el banco pinta avisos de verdad, o esto no mide nada', () => {
  const b = banco();
  assert.equal(b.avisos().length, 0, '🔴 la pila nace con avisos: el banco arrastra estado.');
  b.ctx.showToast('uno', 'error');
  assert.equal(b.avisos().length, 1,
    '🔴 tras pedir un aviso no hay ninguno en la pila. El banco no está pintando, así que ' +
    '«no se pierde ninguno» sería un verde sobre cero avisos.');
});

// ── EL TEST DEL TICKET ───────────────────────────────────────────────────────────────────

test('SCRUM-444 · ✅ dos errores seguidos: LOS DOS se pueden leer', () => {
  const b = banco();
  b.ctx.showToast('Primer error muy largo que el profesional está leyendo con calma', 'error');
  // El segundo llega MIENTRAS el primero sigue vivo. Es el caso del ticket.
  b.ctx.showToast('Segundo error, distinto del primero', 'error');

  const a = b.avisos();
  assert.equal(a.length, 2,
    `🔴 EL PRIMER ERROR HA DESAPARECIDO al llegar el segundo. Quedan ${a.length}: ` +
    `${JSON.stringify(a.map((x) => x.msg))}.\n\n` +
    '   El profesional se queda con la mitad de lo que ha pasado y sin forma de recuperarla.');
  assert.match(a[0].msg, /^Primer error/, '🔴 el primero ya no es el que estaba.');
  assert.match(a[1].msg, /^Segundo error/, '🔴 el segundo no ha llegado.');
});

test('SCRUM-444 · 🔴 EL CASO PEOR: un ÉXITO no borra un ERROR que se está leyendo', () => {
  const b = banco();
  b.ctx.showToast('No se pudo emitir la factura', 'error');
  b.ctx.showToast('Guardado');   // `ok`, 3 s, y hasta hoy se llevaba por delante el error

  const a = b.avisos();
  assert.equal(a.length, 2,
    '🔴 UN «GUARDADO» HA BORRADO UN ERROR. Es el caso peor: el aviso más trivial del producto ' +
    'tapando el único que el profesional necesitaba leer.');
  assert.ok(a.some((x) => x.kind === 'error' && /No se pudo emitir/.test(x.msg)),
    '🔴 el error ya no está en la pila.');
});

// ── LA SEGUNDA REGLA, QUE SALE DE LA MEDICIÓN ────────────────────────────────────────────

test('SCRUM-444 · el MISMO aviso repetido NO se apila: se refresca', () => {
  const b = banco();
  // El caso medido: guardar notas falla, el profesional reintenta y vuelve a fallar.
  for (let i = 0; i < 4; i++) b.ctx.showToast('No se pudieron guardar las notas', 'error');

  const a = b.avisos();
  assert.equal(a.length, 1,
    `🔴 el mismo mensaje se ha apilado ${a.length} veces. Cuatro copias idénticas ocupan cuatro ` +
    'veces el sitio y no dicen nada nuevo — y tapan los avisos que sí son distintos.');
  assert.equal(a[0].msg, 'No se pudieron guardar las notas');
});

test('SCRUM-444 · mismo texto pero DISTINTO tipo son dos avisos distintos', () => {
  const b = banco();
  b.ctx.showToast('Sincronizado', 'ok');
  b.ctx.showToast('Sincronizado', 'error');
  assert.equal(b.avisos().length, 2,
    '🔴 se han fundido un éxito y un error con el mismo texto. Dicen cosas opuestas: colapsarlos ' +
    'convierte un fallo en un «todo bien».');
});

// ── EL NEGATIVO ──────────────────────────────────────────────────────────────────────────

test('SCRUM-444 · CONTROL NEGATIVO: un solo aviso se comporta como siempre', () => {
  const b = banco();
  b.ctx.showToast('Guardado');
  const a = b.avisos();
  assert.equal(a.length, 1, '🔴 un solo aviso ya no produce exactamente un aviso.');
  assert.equal(a[0].kind, 'ok');
  // Y su duración es la de siempre: este ticket no toca lo calibrado en SCRUM-443.
  assert.equal(b.ctx.duracionToast('Guardado', 'ok'), 3000,
    '🔴 ha cambiado la duración de un éxito. SCRUM-444 apila; NO recalibra 443.');
  assert.equal(b.ctx.duracionToast('Error', 'error'), 5000,
    '🔴 ha cambiado el suelo de los errores.');
});

// ── EL TOPE, DECLARADO ───────────────────────────────────────────────────────────────────

test('SCRUM-444 · con demasiados a la vez se retira el MÁS ANTIGUO, y se declara', () => {
  const b = banco();
  for (let i = 1; i <= 6; i++) b.ctx.showToast(`Aviso número ${i}`, 'error');
  const a = b.avisos();
  assert.equal(a.length, 4,
    `🔴 hay ${a.length} avisos a la vez. Con más de cuatro no hay nada que leer: hay una pared.`);
  assert.match(a[0].msg, /número 3/, '🔴 no se está retirando el más antiguo.');
  assert.match(a[3].msg, /número 6/, '🔴 el más nuevo no está.');
});

// ── QUE EL MECANISMO SEA EL QUE SE DICE ──────────────────────────────────────────────────

test('SCRUM-444 · 🔴 ya no hay un `remove()` incondicional al entrar', () => {
  const src = fs.readFileSync(API, 'utf8');
  assert.doesNotMatch(src, /function showToast\([^)]*\)\s*\{\s*\r?\n\s*document\.getElementById\('yaqu-toast'\)\?\.remove\(\);/,
    '🔴 ha vuelto el borrado incondicional al principio de `showToast`: cada aviso se lleva por ' +
    'delante al anterior, que es el defecto entero de este ticket.');
});

test('SCRUM-444 · el reloj se programa en UN SOLO sitio', () => {
  // Si el aviso repetido se reprogramara por su cuenta, acabaría con otra duración que el original
  // y nadie se enteraría. Refrescar y estrenar tienen que pasar por la misma función.
  const src = fs.readFileSync(API, 'utf8');
  const llamadas = [...src.matchAll(/setTimeout\(\(\) => toast\.remove\(\)/g)].length;
  assert.equal(llamadas, 1,
    `🔴 el cierre se programa en ${llamadas} sitios. Uno de ellos acabará divergiendo del otro.`);
  assert.match(src, /function programarCierre\(toast, msg, kind\)/,
    '🔴 no existe `programarCierre`: refrescar un aviso repetido ya no comparte camino con estrenarlo.');
});
