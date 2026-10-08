// docs/master/evidencias/scrum1502b/espia.mjs — SCRUM-1502, tramo 2
//
// QUÉ LEE DE VERDAD UN PROCESO, Y SI SALE DE LA MÁQUINA. Se carga con `node --import` DELANTE del
// sujeto, y no toca al sujeto: envuelve las puertas por las que un proceso de node lee un fichero,
// abre una conexión, resuelve un nombre, lanza otro proceso o consulta una variable de entorno.
//
//   ESPIA_SALIDA   fichero JSON donde deja lo visto al acabar el proceso (obligatorio)
//   ESPIA_BLOQUEA  si vale 1, toda salida al exterior LANZA en vez de dejarse pasar
//
// Lo que NO ve, dicho: lo que haga un addon nativo por su cuenta. Los módulos que carga `import`
// SÍ los ve (medido: salen entre los leídos, como URL). Por eso lleva dos sujetos de control
// (`sujetos-de-control.mjs`): uno que no sale y otro que sale por las cinco puertas.
import fs from 'node:fs';
import net from 'node:net';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

const SALIDA = process.env.ESPIA_SALIDA;
const BLOQUEA = process.env.ESPIA_BLOQUEA === '1';
if (!SALIDA) throw new Error('espia: falta ESPIA_SALIDA');

const leidos = new Set();
const listados = new Set();
const exterior = [];
const entorno = new Set();
const escribir = fs.writeFileSync.bind(fs);

const ruta = (p) => {
  try { return path.resolve(typeof p === 'string' ? p : p instanceof URL ? fileURLToPath(p) : String(p)).replace(/\\/g, '/'); } catch { return String(p); }
};
const envolver = (obj, nombre, alVer) => {
  const original = obj[nombre];
  if (typeof original !== 'function') return;
  obj[nombre] = function espiado(...args) { alVer(args); return original.apply(this, args); };
};
const fuera = (puerta) => (args) => {
  const a = args[0];
  const destino = typeof a === 'string' ? a : a?.host || a?.hostname || a?.href || a?.path || '';
  exterior.push(`${puerta} ${String(destino).slice(0, 80)}`);
  if (BLOQUEA) throw new Error(`espia: BLOQUEADA la salida por ${puerta}`);
};

for (const f of ['readFileSync', 'readFile', 'openSync', 'open', 'createReadStream']) envolver(fs, f, (a) => { if (typeof a[0] !== 'number') leidos.add(ruta(a[0])); });
for (const f of ['readFile', 'open']) envolver(fs.promises, f, (a) => leidos.add(ruta(a[0])));
for (const f of ['readdirSync', 'readdir', 'opendirSync']) envolver(fs, f, (a) => listados.add(ruta(a[0])));

envolver(net.Socket.prototype, 'connect', fuera('net.connect'));
for (const f of ['lookup', 'resolve', 'resolve4', 'resolve6']) envolver(dns, f, fuera(`dns.${f}`));
for (const f of ['lookup', 'resolve']) envolver(dns.promises, f, fuera(`dns.promises.${f}`));
for (const m of [[http, 'http'], [https, 'https']]) for (const f of ['request', 'get']) envolver(m[0], f, fuera(`${m[1]}.${f}`));
for (const f of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) envolver(childProcess, f, fuera(`child_process.${f}`));
if (typeof globalThis.fetch === 'function') {
  const original = globalThis.fetch;
  globalThis.fetch = function espiado(...args) { fuera('fetch')(args); return original.apply(this, args); };
}
syncBuiltinESMExports();

// Las variables de entorno que el sujeto CONSULTA por su nombre (no las que existen).
process.env = new Proxy(process.env, {
  get(t, k) { if (typeof k === 'string') entorno.add(k); return t[k]; },
  has(t, k) { if (typeof k === 'string') entorno.add(k); return k in t; },
});

process.on('exit', () => {
  escribir(SALIDA, JSON.stringify({ bloquea: BLOQUEA, leidos: [...leidos].sort(), listados: [...listados].sort(), exterior, entorno: [...entorno].sort() }));
});
