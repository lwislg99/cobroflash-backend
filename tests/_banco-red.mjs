// tests/_banco-red.mjs — SCRUM-362 (H7) · poner el producto SIN COBERTURA, de verdad
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO DEL BLOQUE H
//
// Sin una forma real de reproducir la falta de cobertura, cualquier cosa que se construya en H1,
// H2, H3 o H5 sale **VERDE SIN SIGNIFICAR NADA**. Este fichero no documenta cómo probarlo a mano:
// es lo que un test usa para poner el producto en cada escenario y mirar qué hace.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL TOGGLE «OFFLINE» DE DEVTOOLS NO VALE, y por eso hay tres escenarios y no uno
//
// Corta limpio, y **la obra no corta limpio**. Los tres que sí pasan en una obra son distintos
// entre sí, y un producto puede aguantar uno y caerse con otro:
//
//   1. PORTAL CAUTIVO — la wifi de cortesía responde `200` con el HTML de su pantalla de acceso.
//      Hay red, hay respuesta, y no es tuya. Ya mordió una vez: `api.js` entregaba esa pantalla
//      como si fuera el fichero del profesional (SCRUM-405).
//   2. ACEPTA Y NO ENTREGA — la petición sale y no vuelve. **`navigator.onLine` dice que hay red**,
//      porque una LAN sin salida cuenta como estar conectado. Medido en SCRUM-356: `onLine` tiene
//      CERO usos en el árbol, y esto es exactamente por qué.
//   3. CORTE A MEDIA SUBIDA — la petición sale, el servidor puede haberla recibido, y el cliente
//      muere sin saberlo. Lo que estaba a medias **no puede quedar en un estado que parezca
//      terminado**.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NO ES UN BANCO NUEVO
//
// `_banco-vistas.mjs` ya monta el dashboard como el navegador, ya sirve `fetch` con fixture y ya
// dispara oyentes. Lo único que no tenía es **control de la red**: su `fetch` responde siempre
// `200` con JSON y su `navigator.onLine` está fijo a `true`. Esto es esa capa que faltaba, y se
// enchufa en el banco de siempre por `cargarDashboard(raiz, { red })`. Sin dependencias nuevas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 CADA ESCENARIO LLEVA REGISTRO, Y ESO ES EL SUELO
//
// «El producto aguanta sin cobertura» y «no supe cortar la red» dan el mismo verde y significan lo
// contrario. Por eso cada escenario **cuenta las peticiones que le llegan**: si el producto no
// pidió nada, el escenario **no se ha ejercido** y el test tiene que declararse ciego en vez de
// dar por buena una pantalla que nunca llegó a intentarlo.

/** El HTML que devuelve un portal cautivo: su pantalla de acceso, con `200`. */
const HTML_DEL_PORTAL = '<!doctype html><html><head><title>Acceso Wi-Fi</title></head>'
  + '<body><form><h1>Conéctate a la red</h1><input name="usuario"><button>Entrar</button></form>'
  + '</body></html>';

/** Base común: el registro, y un `navigator` que puede mentir como miente el de verdad. */
function base({ onLine }) {
  const reg = { peticiones: [], colgadas: 0, resueltas: 0, fallidas: 0 };
  return {
    reg,
    navigator: {
      userAgent: 'banco', language: 'es-ES', onLine,
      serviceWorker: { register: async () => ({}) },
    },
    /** ¿Se ha ejercido de verdad este escenario? Si nadie pidió nada, no se ha cortado nada. */
    seEjercio: () => reg.peticiones.length > 0,
    describir: () => `${reg.peticiones.length} petición(es) · ${reg.resueltas} resueltas · `
      + `${reg.fallidas} fallidas · ${reg.colgadas} colgadas`,
  };
}

/**
 * CONTROL POSITIVO — red normal. **Es el test que hace que los otros tres signifiquen algo:** un
 * banco que falla siempre no prueba nada, solo que está roto.
 */
export function redNormal(datos = {}) {
  const b = base({ onLine: true });
  return {
    ...b,
    nombre: 'red normal',
    fetch: async (url, opts) => {
      b.reg.peticiones.push({ url: String(url), opts });
      b.reg.resueltas++;
      return {
        ok: true, status: 200,
        headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => (typeof datos === 'function' ? datos(String(url), opts) : datos),
        text: async () => JSON.stringify(datos),
        blob: async () => ({ size: 1 }),
      };
    },
  };
}

/**
 * ① PORTAL CAUTIVO — `200` con el HTML de la pantalla de acceso del router.
 *
 * Lo peor de este escenario no es que falle: es que **parece que ha ido bien**. `res.ok` es `true`,
 * hay cuerpo, y `navigator.onLine` también dice que sí. Quien solo mire `res.ok` se traga la
 * pantalla del bar.
 */
export function portalCautivo() {
  const b = base({ onLine: true });
  return {
    ...b,
    nombre: 'portal cautivo',
    fetch: async (url, opts) => {
      b.reg.peticiones.push({ url: String(url), opts });
      b.reg.resueltas++;
      return {
        ok: true, status: 200,
        headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
        // Pedirle `json()` a la pantalla de un router es lo que pasa de verdad: revienta al parsear.
        json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); },
        text: async () => HTML_DEL_PORTAL,
        blob: async () => ({ size: HTML_DEL_PORTAL.length }),
      };
    },
  };
}

/**
 * ② ACEPTA Y NO ENTREGA — la petición sale y NO VUELVE, con `onLine` diciendo que hay red.
 *
 * La promesa se queda pendiente para siempre, que es lo que hace el móvil en una obra con una barra
 * de cobertura: no rechaza, se queda esperando. Un test que la espere se colgaría, así que el
 * escenario **registra la petición y devuelve una promesa que nunca resuelve** — quien lo use tiene
 * que comprobar el estado de la pantalla MIENTRAS la petición sigue en el aire.
 */
export function aceptaYNoEntrega() {
  const b = base({ onLine: true }); // 🔴 `onLine` MIENTE aquí, y ése es medio escenario
  return {
    ...b,
    nombre: 'acepta y no entrega',
    fetch: (url, opts) => {
      b.reg.peticiones.push({ url: String(url), opts });
      b.reg.colgadas++;
      return new Promise(() => {}); // nunca resuelve ni rechaza
    },
  };
}

/**
 * ③ CORTE A MEDIA SUBIDA — la petición SALE y el cliente muere sin saber si llegó.
 *
 * Se modela como lo que el navegador entrega: un `TypeError: Failed to fetch` **después** de haber
 * enviado. La diferencia con «no hay red» es la que importa para H: aquí **el servidor pudo haberlo
 * recibido**, así que el producto no puede dar por hecho ni que se guardó ni que se perdió — y lo
 * que quedara a medias no puede parecer terminado.
 *
 * El registro guarda lo enviado (`opts.body`) para que un test pueda comprobar QUÉ se estaba
 * subiendo cuando se cortó.
 */
export function corteAMediaSubida() {
  const b = base({ onLine: true });
  return {
    ...b,
    nombre: 'corte a media subida',
    fetch: async (url, opts) => {
      b.reg.peticiones.push({ url: String(url), opts, cuerpo: opts && opts.body });
      b.reg.fallidas++;
      // Exactamente lo que lanza el navegador: sin `status`, sin cuerpo, y sin decir si llegó.
      throw new TypeError('Failed to fetch');
    },
  };
}

/**
 * LLEGA TARDE — la red va lenta pero **acaba entregando**, y lo hace después del plazo.
 *
 * Es distinto de «acepta y no entrega»: aquí sí vuelve. Hace falta para el caso que decide en
 * SCRUM-448 —**el dato gana al mensaje**— y para cualquier cosa de H que tenga que distinguir
 * «tardó» de «no llegó», que son dos cosas y se parecen mucho desde fuera.
 */
export function llegaTarde(ms, datos = {}) {
  const b = base({ onLine: true });
  return {
    ...b,
    nombre: `llega tarde (${ms} ms)`,
    fetch: async (url, opts) => {
      b.reg.peticiones.push({ url: String(url), opts });
      await new Promise((res) => setTimeout(res, ms));
      b.reg.resueltas++;
      return {
        ok: true, status: 200,
        headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => datos,
        text: async () => JSON.stringify(datos),
        blob: async () => ({ size: 1 }),
      };
    },
  };
}

/** Los cuatro, para recorrerlos en un test sin escribirlos a mano. */
export const ESCENARIOS = { redNormal, portalCautivo, aceptaYNoEntrega, corteAMediaSubida };

export { HTML_DEL_PORTAL };
