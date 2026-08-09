// tests/scrum338-carga-de-catalogo-no-muda.test.mjs — SCRUM-338 · la carga del catálogo deja de callar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE QUEDABA VIVO, MEDIDO ANTES DE CONSTRUIR
//
// El título del ticket decía «sin oficio PARA SIEMPRE y no puede cargar el catálogo — callejón sin
// salida». Medido contra main, de eso ya no queda casi nada:
//
//   · **La salida EXISTE** (SCRUM-364): `productsView.js` ofrece el botón, y si el merchant no
//     tiene oficio `cargarCatalogoDeGremio` cae en `trade_required` y **pregunta el oficio**
//     (`pedirOficio`) en vez de fallar. Ya no es un callejón.
//   · **El mensaje engañoso** («No se pudo cargar el catálogo» cuando el servidor protegía lo que
//     ya había) lo arregló SCRUM-313, y su entrada lo documenta.
//
// Quedaba UNA cosa, y es la que este fichero vigila: **el `catch` vacío del wizard**. Si la carga
// fallaba durante el onboarding, el profesional terminaba **creyendo que tenía catálogo**, y la
// lista vacía que veía después era indistinguible de «mi gremio no tiene catálogo predefinido».
// `lifecycle.service.ts` lo tenía escrito como el cuarto motivo, «el que FALLA EN SILENCIO».
//
// ⚠️ NO BLOQUEAR SIGUE SIENDO CORRECTO. Un catálogo que no carga no puede impedir empezar a
// trabajar. Lo que se arregla no es el flujo: es el silencio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/onboardingView.js');
const PRODUCTOS = path.join(RAIZ, 'public/dashboard/js/productsView.js');

function fuente(p) {
  assert.ok(fs.existsSync(p), `🔴 no existe ${path.relative(RAIZ, p)}: el guard no puede mirar, y FALLA.`);
  return fs.readFileSync(p, 'utf8');
}

/** El `save` del paso del catálogo, ejecutado con un `apiRequest` que revienta. */
function correrPasoConFallo() {
  const codigo = fuente(VISTA);
  const avisos = [];
  const estado = {};
  const ctx = {
    document: { getElementById: () => ({ checked: true }), createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }), body: { appendChild() {} } },
    window: {},
    showToast: (msg, tono) => avisos.push({ msg, tono }),
    apiRequest: async () => { throw new Error('boom'); },
    console, Date, Array, Object, JSON, Number, String, Boolean, setTimeout,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx, { filename: 'onboardingView.js' });
  return { avisos, estado, ctx };
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-338 · SUELO: el fichero del wizard se lee y tiene el paso del catálogo', () => {
  const s = fuente(VISTA);
  assert.match(s, /load-catalog/,
    '🔴 el wizard ya no llama a `load-catalog`: este guard vigila un paso que no existe, y su ' +
    'verde no significaría nada.');
});

// ── LO QUE SE ARREGLA ────────────────────────────────────────────────────────────────────────

test('SCRUM-338 · 🔴 el `catch` de la carga YA NO ES MUDO', () => {
  const s = fuente(VISTA);
  // El catch vacío original, literal. Si vuelve, este test cae.
  assert.doesNotMatch(s, /catch \(_\) \{ \/\* no bloquear el onboarding por esto \*\/ \}/,
    '🔴 ha vuelto el `catch` vacío: el profesional termina el wizard creyendo que tiene catálogo, ' +
    'y la lista vacía que ve después es indistinguible de «mi gremio no tiene catálogo».');
  assert.match(s, /state\.catalogFallo = true/,
    '🔴 el fallo no se marca en el estado: no queda rastro ni para él ni para nosotros.');
  // ⚠️ Y NO se pinta: el aviso es microcopy nueva (regla 30) y el guard de SCRUM-402 caza un
  // `[PENDIENTE …]` que pueda acabar en la pantalla de un profesional. Lo que se arregla hoy es
  // que el fallo DEJE DE PERDERSE; decirlo es una línea el día que haya texto aprobado.
  assert.doesNotMatch(s, /\[PENDIENTE microcopy oficial\][^']*catálogo/i,
    '🔴 se está pintando un marcador al profesional. Si el texto ya está aprobado, escríbelo; si ' +
    'no, esta superficie todavía no se pinta.');
});

test('SCRUM-338 · pero SIGUE SIN BLOQUEAR el onboarding', () => {
  const s = fuente(VISTA);
  // El `save` del paso no puede propagar el error: el catch tiene que seguir tragándoselo.
  const i = s.indexOf("apiRequest('/admin/products/load-catalog'");
  assert.ok(i > 0, '🔴 no encuentro la llamada al catálogo.');
  const bloque = s.slice(i, i + 1800);
  assert.match(bloque, /catch \(_\) \{/,
    '🔴 la carga del catálogo ha dejado de ir dentro de un `catch`: un catálogo que no carga NO ' +
    'puede impedir empezar a trabajar. Lo que se arregló fue el silencio, no el flujo.');
  assert.doesNotMatch(bloque, /throw\s|reject\(/,
    '🔴 el paso ahora propaga el error y bloquea el onboarding.');
});

test('SCRUM-338 · el fallo se GUARDA aunque todavía no se cuente', () => {
  // La mitad que sí se puede entregar sin decidir copy: el dato existe. Sin él, el día que haya
  // texto aprobado habría que volver a averiguar que hubo un fallo — y ya no se puede.
  const s = fuente(VISTA);
  // Se ancla al CATCH, no a la llamada: entre las dos hay ahora un bloque de comentario largo y
  // una ventana de N caracteres es otra vez un guard atado a la posición (SCRUM-353).
  const iCatch = s.indexOf('} catch (_) {');
  const iMarca = s.indexOf('state.catalogFallo = true');
  assert.ok(iCatch > 0, '🔴 no encuentro el `catch` de la carga del catálogo.');
  // Sin ventana de caracteres: se comprueba el HECHO —la marca existe y está DENTRO del catch,
  // es decir, después de él— en vez de «a menos de N caracteres», que es otra vez un guard atado
  // a la posición (la familia de SCRUM-353).
  assert.ok(iMarca > iCatch,
    '🔴 el fallo vuelve a perderse, o se marca fuera del `catch`. Que no se cuente todavía es una ' +
    'decisión de copy; que no se SEPA es el defecto.');
});

// ── LA SALIDA QUE YA EXISTÍA, Y QUE ESTE AVISO SEÑALA ────────────────────────────────────────

test('SCRUM-338 · la salida de SCRUM-364 sigue en pie: sin oficio, se PREGUNTA', () => {
  // Sin esto, el aviso mandaría a Productos a alguien que volvería a chocarse. El guard ata las
  // dos mitades: el mensaje y el sitio al que manda.
  const s = fuente(PRODUCTOS);
  assert.match(s, /e\.code === 'trade_required'/,
    '🔴 el botón de Productos ya no distingue `trade_required`: quien no tenga oficio volvería a ' +
    'ver «no se pudo, inténtalo de nuevo» — la pared que SCRUM-364 quitó.');
  assert.match(s, /pedirOficio\(/,
    '🔴 ya no se ofrece elegir el oficio: el callejón sin salida vuelve, y el aviso del wizard ' +
    'estaría mandando ahí.');
});
