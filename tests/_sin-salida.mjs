// tests/_sin-salida.mjs — SCRUM-876f
// EL HECHO, NO LA BANDERA: ¿este proceso ha INTENTADO abrir una conexión hacia fuera?
//
// `WHATSAPP_DRY_RUN=1` es lo que creemos que impide un envío a Meta. Que no se abra ni un socket
// hacia fuera es lo que pasa de verdad. Este módulo mira lo segundo, y por debajo de todo lo que
// puede hablar con Meta: `axios` (http/https) y `fetch` (undici) acaban los dos en
// `net.Socket.prototype.connect`, antes de resolver el nombre. Se corta AHÍ.
//
//   · Loopback y tuberías pasan sin apuntarse: la app que levanta el test, su `fetch` contra ella
//     y el Postgres del banco son de esta máquina.
//   · Todo lo demás se APUNTA (host y puerto, nunca cabeceras ni cuerpo) y se CORTA: el socket se
//     destruye con un error. No sale ni la consulta de DNS.
//
// 🔴 EL LÍMITE, dicho: el cliente de Prisma no pasa por aquí (su motor es nativo y abre sus
// propios sockets). Para lo que se usa —un test cuyo destino es el banco de loopback— no importa;
// quien lo instale con una base remota no verá esa conexión, ni la cortará.
//
// Un cero de esta lista no vale nada sin `controlPositivo()` delante: es lo que demuestra que el
// corte VE un POST de axios y un fetch. Sin él, «0 intentos» es lo que diría un corte que no se
// instaló.
//
// No es `*.test.mjs` → `node --test` no lo ejecuta como test.
import net from 'node:net';
import { createRequire } from 'node:module';

const requiere = createRequire(import.meta.url);
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/** Host reservado (RFC 2606): no resuelve nunca. Si el corte fallara, el control tampoco llega a nadie. */
export const HOST_DE_CONTROL = 'control-876f.invalid';

/** `socket.connect` se llama como (opciones[, cb]), (puerto[, host][, cb]), (ruta[, cb]) o, desde
 *  dentro de node, con UN array ya normalizado `[opciones, cb]`. */
function destinoDe(args) {
  const a = Array.isArray(args[0]) ? args[0] : args;
  const primero = a[0];
  if (primero && typeof primero === 'object') {
    return primero.path ? { tuberia: true } : { host: primero.host || 'localhost', port: primero.port };
  }
  if (typeof primero === 'string' && !/^\d+$/.test(primero)) return { tuberia: true };
  return { host: typeof a[1] === 'string' ? a[1] : 'localhost', port: primero };
}

/**
 * Corta toda conexión que no sea de esta máquina y apunta cada intento.
 * Devuelve `{ intentos, ajenos(), controlPositivo(), restaurar() }`.
 */
export function cortarSalida() {
  const original = net.Socket.prototype.connect;
  const intentos = [];
  let controlado = false;

  net.Socket.prototype.connect = function conectarVigilado(...args) {
    const d = destinoDe(args);
    if (d.tuberia || LOOPBACK.has(String(d.host).toLowerCase())) return original.apply(this, args);
    const host = String(d.host);
    intentos.push({ host, port: Number(d.port) || null });
    process.nextTick(() => this.destroy(new Error(`SCRUM-876f: salida cortada hacia ${host}`)));
    return this;
  };

  return {
    intentos,
    /** Los intentos que NO son del control: lo que el código bajo prueba quiso sacar. */
    ajenos: () => intentos.filter((i) => i.host !== HOST_DE_CONTROL),
    get controlado() { return controlado; },
    /**
     * Un POST de axios y un fetch a un host que no existe. Los dos tienen que verse Y cortarse.
     * Lanza si el corte está ciego a cualquiera de los dos caminos.
     */
    async controlPositivo() {
      const axios = requiere('axios');
      const antes = intentos.length;
      const fallos = [];
      await axios.post(`https://${HOST_DE_CONTROL}/v21.0/0/messages`, {}, { timeout: 5000 })
        .then(() => fallos.push('el POST de axios CONTESTÓ'), () => {});
      const trasAxios = intentos.length;
      await fetch(`https://${HOST_DE_CONTROL}/v21.0/0/media`, { method: 'POST', body: 'x' })
        .then(() => fallos.push('el fetch CONTESTÓ'), () => {});
      const trasFetch = intentos.length;
      if (trasAxios - antes < 1) fallos.push('el corte NO vio el POST de axios');
      if (trasFetch - trasAxios < 1) fallos.push('el corte NO vio el fetch');
      const vistos = intentos.slice(antes);
      if (vistos.some((i) => i.host !== HOST_DE_CONTROL || i.port !== 443)) {
        fallos.push(`el corte apuntó otro destino: ${JSON.stringify(vistos)}`);
      }
      if (fallos.length) {
        throw new Error(`🔴 CIEGO: el corte de salida no sirve — ${fallos.join(' · ')}. Un «0 intentos» suyo no dice nada.`);
      }
      controlado = true;
      return vistos.length;
    },
    restaurar() { net.Socket.prototype.connect = original; },
  };
}
