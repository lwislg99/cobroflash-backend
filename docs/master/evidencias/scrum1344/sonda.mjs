// docs/master/evidencias/scrum1344/sonda.mjs — SCRUM-1344
//
// SONDA DE EJECUCIÓN. Se carga con `node --import` delante de UN fichero de test y apunta con qué
// `req` llega cada llamada a cada ruta de un router de `dist/`. No modifica `dist/` ni el test.
//
// En el proceso del laboratorio, y solo ahí, envuelve tres cosas de la librería `router`:
//   · `Router.prototype.handle`  → por qué routers entra cada `req`;
//   · `Route.prototype.dispatch` → qué ruta lo atiende cuando llega POR el router;
//   · el registro de handlers (`route.get/post/…`) → cada handler queda detrás de un Proxy que
//     apunta la llamada. Así se ve también al arnés que SACA el handler de `route.stack` y lo llama
//     a mano: ése no pasa ni por `handle` ni por `dispatch`, y es la forma más común (medido).
//
// Lo que NO ve, dicho: un test que se salta (`skip`) no llama a nada, y un handler que no se
// registró con `router.METHOD` (un `app.get` suelto de `app.ts`) no tiene `Route` de un router.
//
// La lanza `correr-sonda.mjs`, que es quien comprueba que con la sonda puesta el fichero da los
// MISMOS recuentos que sin ella (un laboratorio que cambia al sujeto no mide al sujeto).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.env.SONDA_RAIZ;
const salida = process.env.SONDA_SALIDA;
const require = createRequire(path.join(raiz, 'package.json'));
const Router = require('router');
const Route = require('router/lib/route');
const { METHODS } = require('node:http');

const distAbs = path.join(raiz, 'dist') + path.sep;
const cadena = new WeakMap();      // req → routers por los que ha entrado, en orden
const despachadas = new WeakMap(); // req → Set(rutas que lo han atendido por dispatch)
const ficheroDe = new WeakMap();   // route → fichero de dist/ que la registró
const eventos = [];
const rolDe = (h) => (h && h.__requiredRole) || null;
const esObjeto = (x) => x !== null && typeof x === 'object';
const forma = (req) => ({
  tieneMerchant: esObjeto(req) && req.merchantId !== undefined && req.merchantId !== null,
  rol: esObjeto(req) && req.userRole !== undefined ? String(req.userRole) : null,
});

/** El fichero de `dist/` desde el que se está registrando la ruta: el primer marco de la pila que cae en `dist/`. */
function quienRegistra() {
  const pila = String(new Error().stack || '').split('\n');
  for (const marco of pila) {
    const i = marco.indexOf(distAbs);
    if (i < 0) continue;
    const resto = marco.slice(i).replace(/:\d+:\d+\)?\s*$/, '');
    return path.relative(raiz, resto).replace(/\\/g, '/');
  }
  return null;
}

const handleOriginal = Router.prototype.handle;
Router.prototype.handle = function handleSondeado(req) {
  if (esObjeto(req)) cadena.set(req, [...(cadena.get(req) || []), this]);
  return handleOriginal.apply(this, arguments);
};

const dispatchOriginal = Route.prototype.dispatch;
Route.prototype.dispatch = function dispatchSondeado(req) {
  if (esObjeto(req)) {
    if (!despachadas.has(req)) despachadas.set(req, new Set());
    despachadas.get(req).add(this);
  }
  eventos.push({
    via: 'router', route: this, metodo: esObjeto(req) ? req.method : null,
    rolDeLaRuta: this.stack.map((l) => rolDe(l.handle)).find(Boolean) || null, gatesSaltados: [], ...forma(req),
  });
  return dispatchOriginal.apply(this, arguments);
};

for (const nombre of [...METHODS.map((m) => m.toLowerCase()), 'all']) {
  const original = Route.prototype[nombre];
  if (typeof original !== 'function') continue;
  Route.prototype[nombre] = function registroSondeado(...handlers) {
    const route = this;
    if (!ficheroDe.has(route)) ficheroDe.set(route, quienRegistra());
    const envolver = (fn) => {
      if (typeof fn !== 'function') return fn;
      const proxy = new Proxy(fn, {
        apply(objetivo, esteArg, args) {
          const req = args[0];
          const porDispatch = esObjeto(req) && despachadas.has(req) && despachadas.get(req).has(route);
          if (!porDispatch) {
            const i = route.stack.findIndex((l) => l.handle === proxy);
            eventos.push({
              via: 'directo', route, metodo: nombre.toUpperCase(),
              rolDeLaRuta: route.stack.map((l) => rolDe(l.handle)).find(Boolean) || null,
              gatesSaltados: route.stack.slice(0, Math.max(i, 0)).map((l) => rolDe(l.handle)).filter(Boolean),
              ...forma(req),
            });
          }
          return Reflect.apply(objetivo, esteArg, args);
        },
      });
      return proxy;
    };
    return original.apply(this, handlers.flat(Infinity).map(envolver));
  };
}

process.on('exit', (codigo) => {
  const filas = eventos.map(({ route, ...resto }) => ({ ...resto, ruta: route.path, router: ficheroDe.get(route) || null }));
  // TESTIGO de ejecución (A21): el fichero se escribe SIEMPRE, también con cero eventos.
  fs.writeFileSync(salida, JSON.stringify({ testigo: 'sonda-cargada', codigo, eventos: filas }));
});
