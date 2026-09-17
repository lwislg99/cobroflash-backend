// tests/scrum918-arranque-sin-red.test.mjs — SCRUM-918.
//
// El COMPORTAMIENTO —recargar sin red con el service worker de verdad y el corte de verdad— lo mide
// `scripts/guard-arranque-sin-red.mjs`. Aquí, lo que se puede sin navegador:
//   1. la DECISIÓN (`decidirArranque`): solo «sin red» evita el login; cualquier respuesta, al login;
//   2. la copia local de la sesión: se guarda, se lee, y lo ilegible no inventa una sesión;
//   3. el cableado: `app.js` decide con esa función, la clave se purga al cerrar sesión, y el fichero
//      está en el service worker (sin red, un fichero que hay que ir a buscar no está);
//   4. el guard sigue en la puerta de CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { soloEjecutable } from './_guard-texto.mjs';
import { fueraDeLaTanda } from '../scripts/guards-visuales.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const A = require_(path.join(RAIZ, 'public/dashboard/js/arranqueSinCobertura.js'));
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const sinRed = () => Object.assign(new Error('Failed to fetch'), { sinRed: true });
const conStatus = (s) => Object.assign(new Error('API ' + s), { status: s });
const ME = { merchantId: 7, name: 'QA', userRole: 'tecnico' };

/** Un `localStorage` de mentira con la misma forma: `getItem`/`setItem`. */
function almacen(inicial) {
  const m = new Map(Object.entries(inicial || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}

test('SCRUM-918 · 🔴 sin red NO manda al login: arranca con la copia local', () => {
  assert.deepEqual(A.decidirArranque(sinRed(), ME), { destino: 'sin-cobertura', me: ME });
  // Sin copia, se avisa igual —no hay redirección a una página que sin red no carga—, pero sin app.
  assert.deepEqual(A.decidirArranque(sinRed(), null), { destino: 'sin-cobertura', me: null });
});

test('SCRUM-918 · POSITIVO: cualquier RESPUESTA del servidor sigue yendo al login', () => {
  for (const s of [401, 403, 500, 502]) {
    assert.deepEqual(A.decidirArranque(conStatus(s), ME), { destino: 'login' }, `🔴 un ${s} no manda al login`);
  }
  // Un fallo sin marca no es «sin red» por defecto: ante la duda, lo de siempre.
  assert.deepEqual(A.decidirArranque(new Error('raro'), ME), { destino: 'login' });
  assert.deepEqual(A.decidirArranque(undefined, ME), { destino: 'login' });
});

test('SCRUM-918 · la copia local: se guarda y se lee; lo ilegible no inventa una sesión', () => {
  const a = almacen();
  A.guardarCopiaDeSesion(a, ME);
  assert.deepEqual(A.leerCopiaDeSesion(a), ME);
  assert.equal(A.leerCopiaDeSesion(almacen({ [A.CLAVE_SESION_SIN_COBERTURA]: '{roto' })), null);
  assert.equal(A.leerCopiaDeSesion(almacen({ [A.CLAVE_SESION_SIN_COBERTURA]: '{"name":"sin negocio"}' })), null);
  assert.equal(A.leerCopiaDeSesion(almacen()), null);
  assert.equal(A.leerCopiaDeSesion(null), null);
  // Un almacén que revienta no tumba el arranque.
  assert.doesNotThrow(() => A.guardarCopiaDeSesion({ setItem() { throw new Error('QuotaExceeded'); } }, ME));
  assert.doesNotThrow(() => A.leerCopiaDeSesion({ getItem() { throw new Error('SecurityError'); } }));
});

test('SCRUM-918 · 🔴 app.js decide con `decidirArranque` y guarda la copia en cada arranque con red', () => {
  const app = soloEjecutable(leer('public/dashboard/js/app.js'));
  const init = app.slice(app.indexOf('async function initApp('), app.indexOf('enviarEntornoDeLaApp()'));
  assert.ok(!/catch\s*\{\s*window\.location\.href = '\/login\.html'; return; \}/.test(init),
    '🔴 vuelve el `catch` que manda al login ante cualquier fallo, también sin red');
  assert.match(init, /decidirArranque\(e, leerCopiaDeSesion\(window\.localStorage\)\)/, '🔴 initApp no decide con decidirArranque');
  assert.match(init, /guardarCopiaDeSesion\(window\.localStorage, me\)/, '🔴 initApp no guarda la copia de la sesión');
  assert.match(init, /pintarAvisoSinCobertura\(\)/, '🔴 sin red no se avisa');
});

test('SCRUM-918 · la copia se PURGA al cerrar sesión, y el fichero va en el service worker', () => {
  const almacenLocal = leer('public/dashboard/js/almacenLocal.js');
  assert.match(almacenLocal, /patron: \/\^yaqu_sesion_sin_cobertura\$\/, almacen: 'localStorage', purga: true/,
    '🔴 la copia de la sesión no está registrada para purgarse: tras cerrar sesión, otro vería el negocio de otro');
  assert.ok(new RegExp('^' + A.CLAVE_SESION_SIN_COBERTURA.replace(/_/g, '_') + '$').test('yaqu_sesion_sin_cobertura'));
  assert.ok(leer('public/sw.js').includes("'/dashboard/js/arranqueSinCobertura.js'"), '🔴 el fichero no está en el SHELL del service worker');
  const indice = leer('public/dashboard/index.html');
  assert.ok(indice.indexOf('js/arranqueSinCobertura.js') !== -1 && indice.indexOf('js/arranqueSinCobertura.js') < indice.indexOf('js/app.js"'),
    '🔴 arranqueSinCobertura.js no se carga ANTES que app.js');
});

test('SCRUM-918 · el guard de navegador sigue en la puerta de CI (guards:visuales)', () => {
  assert.ok(fueraDeLaTanda().includes('guard:arranque-sin-red'),
    '🔴 guards:visuales ya no recoge el guard: el comportamiento dejaría de medirse en cada PR');
});
