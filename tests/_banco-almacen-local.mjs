// tests/_banco-almacen-local.mjs — SCRUM-455 (H1 · fase 1)
//
// EL BANCO DEL ALMACÉN LOCAL: monta el dashboard como lo monta el navegador y le pone un
// IndexedDB de verdad.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ESTO SIGUE SIENDO UN DOBLE, Y CONVIENE TENERLO ESCRITO
//
// `fake-indexeddb` implementa el estándar y pasa los web-platform-tests, así que lo que se
// demuestra aquí es que **NUESTRO código usa IndexedDB según el estándar**. NO se demuestra que un
// iPhone se comporte así. NO quedan cubiertos, y son reales:
//
//   · el desalojo de WebKit a los 7 días sin abrir la aplicación (H5);
//   · la cuota agotada en un móvil de verdad;
//   · la navegación privada de Safari, donde IndexedDB puede estar y fallar de otra manera.
//
// Eso es H7 y la matriz humana de `docs/QA_MASTER.md`.
//
// 🔴 Y NO SE ESCRIBIÓ UN DOBLE DE IndexedDB A MANO, a propósito: la Cache API se pudo doblar
// porque cabe en la cabeza; IndexedDB no. El suelo de este ticket es «no digas que guardaste hasta
// que la transacción confirme», que es justo lo que un doble casero confirmaría siempre, porque es
// lo fácil de escribir.
import fs from 'node:fs';
import path from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { cargarDashboard } from './_banco-vistas.mjs';

export const FICHERO_ALMACEN = 'public/dashboard/js/almacenLocal.js';

/**
 * Un `CacheStorage` de mentira con lo único que el purgado usa: `keys` y `delete`.
 *
 * Guarda los nombres tal cual para poder comprobar CUÁLES se borraron — el control negativo del
 * purgado es precisamente que borre los nuestros por su nombre y no arrase con todo.
 */
export function cacheStorageFalsa(nombresIniciales = []) {
  const nombres = new Set(nombresIniciales);
  return {
    _nombres: nombres,
    async keys() { return [...nombres]; },
    async delete(n) { return nombres.delete(n); },
    async open(n) { nombres.add(n); return { async put() {}, async match() { return undefined; } }; },
  };
}

/**
 * Monta el dashboard entero —los mismos scripts que carga el navegador, en el mismo orden— y le
 * inyecta un IndexedDB aislado.
 *
 * Se monta el dashboard COMPLETO y no sólo `almacenLocal.js` porque el logout vive en `app.js`:
 * ejercitar el purgado de verdad exige que las dos piezas estén en el mismo sitio, igual que en el
 * navegador.
 *
 * @param opciones.sinIndexedDB   no se inyecta `indexedDB` (Safari en navegación privada)
 * @param opciones.sinCaches      no se inyecta `caches`
 * @param opciones.caches         nombres de caché ya existentes
 * @param opciones.indexedDB      un `indexedDB` propio (para el escenario de la transacción que aborta)
 */
export function montarAlmacen(raiz, opciones = {}) {
  const b = cargarDashboard(raiz, opciones.dashboard || {});

  // El módulo consulta `indexedDB` y `caches` EN TIEMPO DE EJECUCIÓN, así que inyectarlos después
  // de cargar es fiel: es el mismo orden que en un navegador donde el script se evalúa antes de
  // que nadie llame a nada.
  if (!opciones.sinIndexedDB) b.ctx.indexedDB = opciones.indexedDB || new IDBFactory();
  else delete b.ctx.indexedDB;

  if (!opciones.sinCaches) b.ctx.caches = cacheStorageFalsa(opciones.caches || []);
  else delete b.ctx.caches;

  return b;
}

/**
 * 🔴 EL SUELO DEL BANCO: ¿se cargó el fichero del almacén y publicó su superficie?
 *
 * «Guardó bien» y «no supe montarlo» son el mismo verde si nadie mira. Devuelve el motivo por el
 * que el banco estaría CIEGO, o `null` si ve.
 */
export function porQueEstariaCiego(b, raiz) {
  const rel = 'js/almacenLocal.js';
  if (!b.scripts.includes(rel)) {
    return `«${rel}» NO está entre los <script src> de dashboard/index.html: el navegador nunca lo ` +
      'cargaría y este banco tampoco. Nada de lo que mide este fichero estaría ocurriendo.';
  }
  const fallo = b.fallos.find((f) => f.fichero === rel);
  if (fallo) return `«${rel}» falló al cargar (${fallo.error}) ${fallo.sitio || ''}`.trim();

  if (!fs.existsSync(path.join(raiz, FICHERO_ALMACEN))) return `no existe ${FICHERO_ALMACEN}`;

  for (const n of ['purgarDatosLocales', 'guardarFirmaPendiente', 'leerFirmasPendientes',
    'guardarAlbaranPrecargado', 'leerAlbaranesPrecargados', 'abrirAlmacen', 'tramosQueFaltan']) {
    if (typeof b.ctx[n] !== 'function') return `el almacén no publica \`${n}\` en \`window\``;
  }
  for (const c of ['GUARDADO', 'NO_DISPONIBLE', 'FALLO']) {
    if (typeof b.ctx[c] !== 'string') return `falta la constante \`${c}\``;
  }
  return null;
}

/**
 * Un `indexedDB` en el que **la operación tiene éxito y la transacción NO confirma**.
 *
 * Es el escenario exacto que este ticket existe para impedir, y no se puede provocar desde fuera:
 * envuelve un IndexedDB real y, en cuanto una escritura dispara su `success`, aborta la
 * transacción. El `success` de la petición llega igual —se registra con `addEventListener`, así
 * que no compite con el `onsuccess` que asigne el código— y la transacción acaba en `abort`.
 *
 * Un código que resolviera en `peticion.onsuccess` diría GUARDADO. Uno que espere a
 * `tx.oncomplete`, no. Ésa es toda la diferencia entre el producto que funciona en una obra y el
 * que le miente a un fontanero.
 *
 * `testigo` deja constancia de que el escenario OCURRIÓ, para que el test no pueda pasar por no
 * haberse dado.
 */
export function indexedDBQueAbortaTrasEscribir() {
  const real = new IDBFactory();
  const testigo = { escriturasConExito: 0, transaccionesAbortadas: 0, abortsConfirmados: 0 };

  return {
    _testigo: testigo,
    open(nombre, version) {
      const peticion = real.open(nombre, version);
      const envolver = (bd) => ({
        objectStoreNames: bd.objectStoreNames,
        close: () => bd.close(),
        transaction(almacenes, modo) {
          const tx = bd.transaction(almacenes, modo);
          tx.addEventListener('abort', () => { testigo.abortsConfirmados += 1; });
          return {
            get error() { return tx.error; },
            set oncomplete(f) { tx.oncomplete = f; },
            set onabort(f) { tx.onabort = f; },
            set onerror(f) { tx.onerror = f; },
            abort: () => tx.abort(),
            objectStore(n) {
              const store = tx.objectStore(n);
              return {
                put(v) {
                  const p = store.put(v);
                  p.addEventListener('success', () => {
                    testigo.escriturasConExito += 1;
                    // La operación fue bien; la transacción, no. Justo aquí se separan los dos.
                    //
                    // 🔴 El contador va AQUÍ y no en el evento `abort`, y la diferencia importa:
                    // el evento llega un tick después, y un código que resolviera en
                    // `peticion.onsuccess` ya habría devuelto para entonces. Contándolo allí, el
                    // test caía diciendo «el escenario no ocurrió» —el motivo equivocado— en vez
                    // de «se está dando por guardado algo sin confirmar».
                    try { tx.abort(); testigo.transaccionesAbortadas += 1; } catch (_e) { /* ya terminada */ }
                  });
                  return p;
                },
                getAll: (...a) => store.getAll(...a),
                clear: (...a) => store.clear(...a),
                get: (...a) => store.get(...a),
              };
            },
          };
        },
      });

      // 🔴 NO se puede decidir por `readyState`: durante `onupgradeneeded` ya vale `'done'`, así
      // que el envoltorio —que no tiene `createObjectStore`— sustituiría a la base justo donde se
      // crean los almacenes, y el upgrade abortaría. Bandera explícita.
      let yaAbierta = false;
      let envuelta = null;

      const proxy = {
        set onupgradeneeded(f) {
          peticion.onupgradeneeded = (ev) => f.call(proxy, ev);
        },
        set onsuccess(f) { peticion.onsuccess = () => { yaAbierta = true; f.call(proxy); }; },
        set onerror(f) { peticion.onerror = () => f.call(proxy); },
        set onblocked(f) { peticion.onblocked = () => f.call(proxy); },
        get error() { return peticion.error; },
        get result() {
          if (!yaAbierta) return peticion.result; // en el upgrade hace falta la base REAL
          if (!envuelta) envuelta = envolver(peticion.result);
          return envuelta;
        },
      };
      return proxy;
    },
  };
}
