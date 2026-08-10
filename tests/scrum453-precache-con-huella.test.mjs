// tests/scrum453-precache-con-huella.test.mjs — SCRUM-453
//
// ¿SIRVE DE ALGO EL PRECACHE SI EL HTML PIDE LOS SCRIPTS CON HUELLA?
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CIRCUITO COMPLETO, MEDIDO
//
//   1. `dashboard/index.html` en disco pide `./js/api.js` — DESNUDO (51 scripts, 0 con query).
//   2. El servidor lo reescribe al servirlo: `sellarReferencias` añade `?v=<huella>`
//      (`core/http/huellaEstaticos.ts`, montado en `app.ts`).
//   3. El navegador, por tanto, pide `/dashboard/js/api.js?v=<huella>`.
//   4. El SHELL del service worker precachea la ruta PELADA: `/dashboard/js/api.js`.
//   5. Sin cobertura, `caches.match(request, { ignoreSearch: true })` las hace casar.
//
// **La query ENTRA en la clave de la Cache API.** Sin el paso 5, ni uno de los 51 scripts casaría
// con lo precacheado: el precache estaría lleno y sería peso muerto, y el profesional sin
// cobertura no abriría el dashboard. Todo el bloque H se apoya en ese `ignoreSearch`.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 POR QUÉ ESTE GUARD EJERCITA EN VEZ DE LEER
//
// Un `assert.match(codigo, /ignoreSearch/)` pasaría con la palabra escrita en un comentario, o con
// la opción pasada a la llamada equivocada. Aquí se **carga `sw.js` de verdad**, se dispara su
// manejador de `fetch` con la red caída y se mira qué responde. «El manejador normaliza» leído no
// es «el manejador normaliza» ejercitado, y la diferencia decide si el producto abre en una obra.
//
// ⚠️ Y EL DOBLE DE `caches` TIENE QUE SER FIEL, o el test miente en la dirección cómoda: si su
// `match` ignorase la query SIEMPRE, pasaría aunque el service worker dejara de pedir
// `ignoreSearch`. Por eso el doble respeta el flag, y hay un test que lo comprueba ANTES de fiarse
// de él — es la lección del banco de vistas (SCRUM-417): un banco infiel no mide de menos, mide
// otra cosa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW = path.join(RAIZ, 'public', 'sw.js');

/**
 * Un `Cache` de mentira que respeta `ignoreSearch` **de verdad**.
 *
 * Sin el flag compara la URL entera —query incluida—, que es lo que hace la Cache API real. Con
 * él compara sólo el `pathname`.
 */
function cacheFalsa(rutasPrecacheadas) {
  const guardado = new Map(rutasPrecacheadas.map((r) => [r, `contenido de ${r}`]));
  return {
    _guardado: guardado,
    async match(req, opciones = {}) {
      const url = new URL(typeof req === 'string' ? req : req.url);
      if (opciones.ignoreSearch) {
        const hit = [...guardado.keys()].find((r) => new URL(r, url.origin).pathname === url.pathname);
        return hit ? { cuerpo: guardado.get(hit), de: hit } : undefined;
      }
      const clave = url.pathname + url.search;
      return guardado.has(clave) ? { cuerpo: guardado.get(clave), de: clave } : undefined;
    },
    async put() {},
  };
}

/**
 * Carga `public/sw.js` en un contexto de mentira y devuelve lo que responde su manejador de
 * `fetch` para una URL, con la RED CAÍDA (que es el único camino donde la caché importa).
 */
function responderSinRed(urlPedida, rutasPrecacheadas) {
  const cache = cacheFalsa(rutasPrecacheadas);
  const oyentes = {};
  let respuesta;

  const ctx = {
    self: {
      addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
      location: { origin: 'https://yaqu.app' },
      skipWaiting: () => {},
      clients: { claim: () => {} },
    },
    caches: {
      open: async () => cache,
      match: (req, opts) => cache.match(req, opts),
      keys: async () => [],
      delete: async () => true,
    },
    // La red falla: es el escenario del sótano.
    fetch: async () => { throw new Error('sin red'); },
    Response: { error: () => ({ error: true }) },
    URL,
    console,
  };
  ctx.self.caches = ctx.caches;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SW, 'utf8'), ctx, { filename: 'sw.js' });

  assert.ok(oyentes.fetch, '🔴 CIEGO: `sw.js` no registró ningún manejador de `fetch`.');
  oyentes.fetch({
    request: { url: urlPedida, method: 'GET' },
    respondWith: (p) => { respuesta = p; },
  });
  return respuesta;
}

const PRECACHEADAS = ['/dashboard/js/api.js', '/dashboard/css/styles.css'];

// ── SUELO: el doble tiene que distinguir, o no vale como banco ───────────────────────────

test('SCRUM-453 · 🔴 SUELO: el doble de `caches` RESPETA `ignoreSearch`, no lo finge', () => {
  const c = cacheFalsa(PRECACHEADAS);
  return Promise.all([
    // Sin el flag, la query hace que NO case — igual que la Cache API real.
    c.match({ url: 'https://yaqu.app/dashboard/js/api.js?v=abc123' }).then((r) => {
      assert.equal(r, undefined,
        '🔴 el doble casa SIN `ignoreSearch`: entonces este banco pasaría aunque el service worker ' +
        'dejara de normalizar, y su verde no significaría nada.');
    }),
    // Con el flag, sí.
    c.match({ url: 'https://yaqu.app/dashboard/js/api.js?v=abc123' }, { ignoreSearch: true }).then((r) => {
      assert.ok(r, '🔴 el doble no casa NI con `ignoreSearch`: no sabe hacer lo que dice.');
    }),
  ]);
});

test('SCRUM-453 · 🔴 SUELO: `sw.js` se carga y registra su manejador de `fetch`', async () => {
  const r = await responderSinRed('https://yaqu.app/dashboard/js/api.js', PRECACHEADAS);
  assert.ok(r, '🔴 el manejador no respondió nada: sin eso, todo lo de abajo mediría el vacío.');
});

// ── EL POSITIVO: LA PREGUNTA DEL TICKET ─────────────────────────────────────────────────

test('SCRUM-453 · ✅ sin red, un script pedido CON HUELLA se sirve del precache PELADO', async () => {
  // La pregunta entera del ticket, ejercitada: el navegador pide `?v=<huella>`, el SHELL guardó la
  // ruta desnuda, y sin cobertura tiene que casar.
  const r = await responderSinRed('https://yaqu.app/dashboard/js/api.js?v=9f2c1a', PRECACHEADAS);
  assert.ok(r && !r.error,
    '🔴 EL PRECACHE NO SIRVE UN SCRIPT PEDIDO CON HUELLA. El HTML pide `?v=<huella>` (lo inyecta ' +
    '`sellarReferencias` al servir) y el SHELL guarda la ruta pelada: sin normalizar la query no ' +
    'casa NINGUNO de los 51 scripts. El precache estaría lleno y sería peso muerto, y el ' +
    'profesional sin cobertura no abriría el dashboard.');
  assert.equal(r.de, '/dashboard/js/api.js',
    '🔴 casó con otra entrada distinta de la pelada que se precacheó.');
});

test('SCRUM-453 · ✅ y sin huella también, que es como se pide desde el propio service worker', async () => {
  const r = await responderSinRed('https://yaqu.app/dashboard/css/styles.css', PRECACHEADAS);
  assert.ok(r && !r.error, '🔴 una petición sin query dejó de servirse del precache.');
});

// ── CONTROL NEGATIVO ─────────────────────────────────────────────────────────────────────

test('SCRUM-453 · CONTROL NEGATIVO: lo que NO está precacheado no se inventa', async () => {
  // `ignoreSearch` afloja la comparación de la query, no la de la ruta. Si sirviera cualquier cosa,
  // el guard de arriba pasaría por el motivo equivocado.
  const r = await responderSinRed('https://yaqu.app/dashboard/js/no-precacheado.js?v=1', PRECACHEADAS);
  assert.ok(r && r.error,
    '🔴 se está sirviendo del precache una ruta que NUNCA se precacheó: `ignoreSearch` estaría ' +
    'aflojando la ruta y no sólo la query.');
});

test('SCRUM-453 · CONTROL NEGATIVO: las rutas de API van a red y NO tocan la caché', async () => {
  // Con la red caída, `/admin/…` tiene que fallar y no servir nada viejo: el poll de versión y las
  // respuestas autenticadas no se cachean (`sw.js`), y eso no puede cambiar por este guard.
  // Sin `await` al recoger: la promesa se rechaza, y desenvolverla aquí la lanzaría en el test en
  // vez de dejar que `assert.rejects` la examine.
  const r = responderSinRed('https://yaqu.app/admin/me', PRECACHEADAS);
  await assert.rejects(r,
    '🔴 una ruta de API ha devuelto algo con la red caída: estaría sirviéndose de la caché.');
});
