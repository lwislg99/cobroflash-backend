// tests/scrum1354-dueno-de-la-marca.test.mjs — SCRUM-1354
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UNA PÉRDIDA REAL DE FIRMAS PODÍA NO AVISARSE: DEPENDÍA DE QUIÉN LLEGARA ANTES AL ARRANCAR
//
// `app.js` lanza sin `await` el drenado y el detector de desalojo. La marca `yaqu_hubo_cola` es la
// única prueba de que hubo cola, y el drenado la borraba al encontrar la cola YA vacía —o sea, sin
// haber drenado nada—. Si llegaba antes que el detector, un desalojo real salía `SIN_PERDIDA`.
// En Chromium gana el detector (10/10 contra yaqu.app, 1-oct-2026); en el banco, con `persist()`
// tardando ≥5 ms, gana el drenado. Safari no está medido, y no hace falta: aquí se FUERZAN LOS DOS
// ÓRDENES y el resultado tiene que ser el mismo.
//
// La regla: el drenado sólo retira la marca si vació una cola que TENÍA algo; el detector del
// arranque espera a los drenados en vuelo, y es él quien consume la marca al avisar.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';
import { redNormal, falloDelServidor } from './_banco-red.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CUERPO = Object.freeze({ signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'Aurora Benítez' });

function localStorageFalso() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
const espera = (ms) => new Promise((r) => { const t = setTimeout(r, ms); if (t.unref) t.unref(); });

/** Monta con la red pedida y un `persist()` que tarda `msPersist` (el mando de la carrera). */
function montar(red, msPersist = 0) {
  const b = montarAlmacen(RAIZ, { dashboard: { red } });
  b.ctx.PLAZO_RED_MS = 60;
  b.ctx.localStorage = localStorageFalso();
  b.ctx.navigator = {
    ...b.ctx.navigator,
    storage: { persist: async () => { if (msPersist) await espera(msPersist); return true; }, persisted: async () => true },
  };
  return b;
}
const cuantas = async (b) => ((await b.ctx.leerFirmasPendientes()).firmas || []).length;

/** El arranque como lo hace `app.js`: los dos lanzados seguidos, sin `await` entre ellos. */
async function arrancarComoLaApp(b) {
  const drenado = b.ctx.drenarAlAbrir();
  const medida = b.ctx.resistenciaAlArrancar();
  const [, r] = await Promise.all([drenado, medida]);
  return r;
}

test('SCRUM-1354 · 🔴 SUELO: el banco monta cola, marca, drenado y detector, o se declara CIEGO', async () => {
  const b = montar(redNormal({ estado: 'firmado' }));
  assert.equal(porQueEstariaCiego(b, RAIZ), null, '🔴 BANCO CIEGO (almacén)');
  for (const n of ['drenarAlAbrir', 'resistenciaAlArrancar', 'marcarQueHuboCola', 'huboColaAlgunaVez', 'encolarFirma']) {
    assert.equal(typeof b.ctx[n], 'function', `🔴 CIEGO: no está \`${n}\`.`);
  }
  // La marca del banco guarda de verdad, o todo lo de abajo mediría un `localStorage` mudo.
  assert.equal(b.ctx.huboColaAlgunaVez(), false);
  b.ctx.marcarQueHuboCola();
  assert.equal(b.ctx.huboColaAlgunaVez(), true, '🔴 CIEGO: la marca no se guarda en este banco.');
});

// ── ① LA PÉRDIDA REAL SE AVISA EN LOS DOS ÓRDENES ──────────────────────────────────────────

test('SCRUM-1354 · 🔴 desalojo real, el DRENADO TERMINA ANTES que el detector → avisa igual', async () => {
  const b = montar(redNormal({ estado: 'firmado' }));
  b.ctx.marcarQueHuboCola();                 // hubo cola…
  assert.equal(await cuantas(b), 0);         // …y el almacén está vacío: el navegador se la llevó
  await b.ctx.drenarAlAbrir();               // el drenado llega primero, entero
  const r = await b.ctx.resistenciaAlArrancar();
  assert.equal(r.desalojo.estado, b.ctx.POSIBLE_PERDIDA,
    '🔴 UNA PÉRDIDA REAL SE CALLA: el drenado encontró la cola ya vacía, borró la marca, y el ' +
    'detector contestó SIN_PERDIDA. El profesional ha perdido una firma y nadie se lo dice.');
});

test('SCRUM-1354 · 🔴 desalojo real, el DETECTOR va antes que el drenado → avisa', async () => {
  const b = montar(redNormal({ estado: 'firmado' }));
  b.ctx.marcarQueHuboCola();
  const r = await b.ctx.resistenciaAlArrancar();
  await b.ctx.drenarAlAbrir();
  assert.equal(r.desalojo.estado, b.ctx.POSIBLE_PERDIDA);
});

for (const ms of [0, 5, 40]) {
  test(`SCRUM-1354 · 🔴 desalojo real, lanzados como en app.js con persist() a ${ms} ms → avisa`, async () => {
    const b = montar(redNormal({ estado: 'firmado' }), ms);
    b.ctx.marcarQueHuboCola();
    const r = await arrancarComoLaApp(b);
    assert.equal(r.desalojo.estado, b.ctx.POSIBLE_PERDIDA,
      `🔴 con persist() a ${ms} ms el resultado cambia: el aviso depende de la carrera.`);
  });
}

// ── ② UNA VEZ ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-1354 · 🔴 el aviso sale UNA vez: el arranque siguiente, sin cola nueva, no lo repite', async () => {
  const b = montar(redNormal({ estado: 'firmado' }));
  b.ctx.marcarQueHuboCola();
  assert.equal((await arrancarComoLaApp(b)).desalojo.estado, b.ctx.POSIBLE_PERDIDA);
  assert.equal(b.ctx.huboColaAlgunaVez(), false,
    '🔴 nadie consume la marca: el aviso saldría en CADA arranque para siempre.');
  assert.equal((await arrancarComoLaApp(b)).desalojo.estado, b.ctx.SIN_PERDIDA);
});

// ── ③ COLA CON FIRMAS + RED: SE SUBEN Y NO HAY AVISO, EN LOS DOS ÓRDENES ───────────────────

for (const ms of [0, 5, 40]) {
  test(`SCRUM-1354 · ✅ cola con firmas y red, persist() a ${ms} ms → se suben, sin aviso y sin marca`, async () => {
    const b = montar(redNormal({ estado: 'firmado' }), ms);
    await b.ctx.encolarFirma(42, CUERPO);
    await b.ctx.encolarFirma(43, CUERPO);
    assert.equal(await cuantas(b), 2, '🔴 CIEGO: las firmas no entraron en la cola.');
    const r = await arrancarComoLaApp(b);
    assert.equal(await cuantas(b), 0, '🔴 CIEGO: el drenado no subió las firmas; el caso no se montó.');
    assert.equal(r.desalojo.estado, b.ctx.SIN_PERDIDA,
      '🔴 AVISO FALSO: el drenado vació la cola subiéndolo todo y el detector lo lee como pérdida.');
    assert.equal(b.ctx.huboColaAlgunaVez(), false,
      '🔴 el drenado vació una cola que tenía firmas y no retiró la marca: el arranque siguiente avisará en falso.');
  });
}

// ── ④ COLA CON FIRMAS + SIN RED ────────────────────────────────────────────────────────────

test('SCRUM-1354 · ✅ cola con firmas y el servidor caído → se quedan, sin aviso y con la marca intacta', async () => {
  const b = montar(falloDelServidor(500, { error: 'internal_error' }));
  await b.ctx.encolarFirma(42, CUERPO);
  const r = await arrancarComoLaApp(b);
  assert.equal(await cuantas(b), 1, '🔴 UNA FIRMA SE HA PERDIDO.');
  assert.equal(r.desalojo.estado, b.ctx.SIN_PERDIDA);
  assert.equal(b.ctx.huboColaAlgunaVez(), true, '🔴 se retira la marca con una firma todavía en la cola.');
});

// ── ⑤ CONTROL POSITIVO ─────────────────────────────────────────────────────────────────────

test('SCRUM-1354 · ✅ CONTROL: sin marca y sin cola → SIN_PERDIDA (quien nunca tuvo cola no ve avisos)', async () => {
  const b = montar(redNormal({ estado: 'firmado' }));
  assert.equal((await arrancarComoLaApp(b)).desalojo.estado, b.ctx.SIN_PERDIDA);
});

test('SCRUM-1354 · ✅ el detector a solas NO consume: `detectarDesalojo` sigue siendo una pregunta', async () => {
  // Quien consume es el arranque. Si lo hiciera `detectarDesalojo`, preguntar dos veces cambiaría
  // la respuesta, y hay vistas y tests que preguntan.
  const b = montar(redNormal({ estado: 'firmado' }));
  b.ctx.marcarQueHuboCola();
  assert.equal((await b.ctx.detectarDesalojo()).estado, b.ctx.POSIBLE_PERDIDA);
  assert.equal((await b.ctx.detectarDesalojo()).estado, b.ctx.POSIBLE_PERDIDA);
});
