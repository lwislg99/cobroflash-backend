// Traza de lecturas para un proceso hijo de node:test. Se carga con `--import=<url>`.
// Apunta: cada ruta que pasa por `fs` (sync, callback y promesas), cada módulo que se carga
// (incluido el `import` de un `.mjs` bajo docs/) y cada subproceso. Lo escribe al salir en
// `$TRAZA_DIR/<pid>.json`. No cambia ningún comportamiento: llama al original con los mismos
// argumentos y devuelve lo mismo.
import fs from 'node:fs';
import cp from 'node:child_process';
import mod from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = process.env.TRAZA_DIR;
if (DIR) {
  const rutas = new Map(); // ruta absoluta → Set(op)
  const procesos = [];
  const cargados = new Set();
  const apunta = (p, op) => {
    try {
      let s = p;
      if (s instanceof URL) s = fileURLToPath(s);
      else if (Buffer.isBuffer(s)) s = s.toString();
      else if (typeof s === 'string' && s.startsWith('file:')) s = fileURLToPath(s);
      if (typeof s !== 'string' || !s) return;
      const abs = path.resolve(s);
      if (!rutas.has(abs)) rutas.set(abs, new Set());
      rutas.get(abs).add(op);
    } catch { /* una ruta que no se entiende no tumba al test */ }
  };
  const envolver = (obj, nombre, prefijo) => {
    const orig = obj[nombre];
    if (typeof orig !== 'function' || orig.__trazado) return;
    const w = function (...args) {
      apunta(args[0], prefijo + nombre);
      if (/^(cp|copyFile|rename|link|symlink)/.test(nombre)) apunta(args[1], prefijo + nombre + ':2');
      return orig.apply(this, args);
    };
    Object.defineProperties(w, Object.getOwnPropertyDescriptors(orig));
    Object.defineProperty(w, '__trazado', { value: true });
    try { obj[nombre] = w; } catch { /* propiedad de sólo lectura: se queda sin trazar */ }
  };
  const NO_RUTA = new Set(['close', 'closeSync', 'read', 'readSync', 'write', 'writeSync', 'fstat',
    'fstatSync', 'fsync', 'fsyncSync', 'ftruncate', 'ftruncateSync', 'futimes', 'futimesSync',
    'fchmod', 'fchmodSync', 'fchown', 'fchownSync', 'fdatasync', 'fdatasyncSync', 'readv', 'readvSync',
    'writev', 'writevSync', 'Stats', 'Dirent', 'Dir', 'ReadStream', 'WriteStream', 'FileReadStream',
    'FileWriteStream', 'openAsBlob']);
  for (const k of Object.keys(fs)) if (!NO_RUTA.has(k) && !/^[A-Z_]/.test(k)) envolver(fs, k, '');
  for (const k of Object.keys(fs.promises)) if (!/^[A-Z_]/.test(k)) envolver(fs.promises, k, 'p.');
  for (const k of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
    const orig = cp[k];
    const w = function (...args) {
      const lista = Array.isArray(args[1]) ? args[1].map(String) : [];
      const op = (Array.isArray(args[1]) ? args[2] : args[1]) || {};
      const env = op && typeof op === 'object' ? (op.env || process.env) : process.env;
      procesos.push({ op: k, cmd: String(args[0]).slice(0, 400), args: lista,
        cwd: path.resolve((op && op.cwd instanceof URL) ? fileURLToPath(op.cwd) : String((op && op.cwd) || process.cwd())),
        gitDir: env.GIT_DIR || null, gitWorkTree: env.GIT_WORK_TREE || null });
      return orig.apply(this, args);
    };
    Object.defineProperties(w, Object.getOwnPropertyDescriptors(orig));
    cp[k] = w;
  }
  // ③ · ¿llama este proceso a algo cuyo resultado depende de la zona de la máquina?
  const zona = {};
  if (process.env.TRAZA_ZONA) {
    const LOCALES = ['getFullYear', 'getMonth', 'getDate', 'getDay', 'getHours', 'getMinutes',
      'getTimezoneOffset', 'toString', 'toDateString', 'toTimeString', 'toLocaleString',
      'toLocaleDateString', 'toLocaleTimeString', 'setFullYear', 'setMonth', 'setDate', 'setHours'];
    for (const k of LOCALES) {
      const orig = Date.prototype[k];
      Date.prototype[k] = function (...a) { zona[k] = (zona[k] || 0) + 1; return orig.apply(this, a); };
    }
    const DTF = Intl.DateTimeFormat;
    const W = function (loc, op) {
      if (!op || !op.timeZone) zona['Intl.DateTimeFormat sin timeZone'] = (zona['Intl.DateTimeFormat sin timeZone'] || 0) + 1;
      return new.target ? new DTF(loc, op) : DTF(loc, op);
    };
    Object.defineProperties(W, Object.getOwnPropertyDescriptors(DTF));
    Intl.DateTimeFormat = W;
    const localStr = (s) => typeof s === 'string' && !/(Z|[+-]\d\d:?\d\d)$/i.test(s.trim()) && !/^\d{4}-\d\d(-\d\d)?$/.test(s.trim());
    globalThis.Date = new Proxy(Date, {
      construct(t, args, nt) {
        if (args.length >= 2) zona['new Date(y,m,…)'] = (zona['new Date(y,m,…)'] || 0) + 1;
        else if (localStr(args[0])) zona['new Date(texto local)'] = (zona['new Date(texto local)'] || 0) + 1;
        return Reflect.construct(t, args, nt);
      },
    });
    const parse = Date.parse;
    Date.parse = function (s) {
      if (typeof s === 'string' && !/(Z|[+-]\d\d:?\d\d)$/.test(s.trim()) && !/^\d{4}-\d\d-\d\d$/.test(s.trim())) zona['Date.parse local'] = (zona['Date.parse local'] || 0) + 1;
      return parse.call(this, s);
    };
  }
  mod.syncBuiltinESMExports();
  if (typeof mod.registerHooks === 'function') {
    mod.registerHooks({
      load(url, context, nextLoad) {
        if (url.startsWith('file:')) cargados.add(fileURLToPath(url));
        return nextLoad(url, context);
      },
    });
  } else cargados.add('!!sin-registerHooks');
  process.on('exit', () => {
    const fuera = {
      pid: process.pid, ppid: process.ppid, argv: process.argv.slice(1),
      rutas: [...rutas].map(([r, ops]) => [r, [...ops]]),
      procesos, cargados: [...cargados], zona,
    };
    try { fs.mkdirSync(DIR, { recursive: true }); } catch {}
    // writeFileSync ya está envuelto, pero el apunte no importa aquí
    fs.writeFileSync(path.join(DIR, `${process.pid}-${Date.now()}.json`), JSON.stringify(fuera));
  });
}
