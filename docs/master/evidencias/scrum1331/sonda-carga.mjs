// sonda-carga.mjs — SCRUM-1331 · QUÉ LLAMA A ALGO DE FUERA un fichero de test, y CUÁNDO.
//
// Se carga con `node --import <esto> --test …`: el runner lo propaga a cada proceso HIJO (uno por
// fichero). NO bloquea nada: ANOTA. Cada proceso deja una línea `arranque` (el testigo de A21: un
// fichero sin línea de arranque no fue observado) y una línea por cada proceso hijo, `fetch` o
// conexión que haga, con la FASE deducida de la pila: `carga` si no hay ningún marco del runner
// ejecutando un test, `test` si lo hay.
import cp from 'node:child_process';
import net from 'node:net';
import dns from 'node:dns';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { basename } from 'node:path';

const LOG = process.env.YAQU_SONDA_LOG;
const yo = basename(process.argv[1] || '(sin argv1)');
const esFicheroDeTest = /\.test\.mjs$/.test(yo);

function anota(o) {
  if (!LOG) return;
  try { appendFileSync(LOG, JSON.stringify({ f: yo, pid: process.pid, ...o }) + '\n'); } catch { /* la sonda no rompe al sujeto */ }
}

function fase() {
  const pila = String(new Error().stack || '');
  // Un test en ejecución deja marcos de `node:internal/test_runner/test` con `run`/`runInAsyncScope`.
  return /test_runner\/test:\d+:\d+\)?\s*$/m.test(pila) && /Test\.run|runInAsyncScope/.test(pila) ? 'test' : 'carga';
}

const RED_GIT = new Set(['ls-remote', 'fetch', 'pull', 'push', 'clone']);
function esRed(orden, args) {
  const o = basename(String(orden || '')).toLowerCase().replace(/\.(exe|cmd|bat)$/, '');
  const a = (args || []).map(String);
  if (o === 'git') {
    const verbo = a.find((x) => !x.startsWith('-') && !/^[a-z.]+=/.test(x));
    // `git -C dir verbo`: el primero sin guion puede ser el directorio de -C.
    const i = a.indexOf('-C');
    const v = i >= 0 ? a.slice(i + 2).find((x) => !x.startsWith('-')) : verbo;
    return RED_GIT.has(v) ? `git ${v}` : null;
  }
  if (['gh', 'curl', 'wget', 'npx', 'ssh'].includes(o)) return o;
  return null;
}

if (esFicheroDeTest) {
  anota({ k: 'arranque' });

  for (const nombre of ['execFileSync', 'spawnSync', 'execSync', 'spawn', 'execFile', 'exec', 'fork']) {
    const original = cp[nombre];
    cp[nombre] = function sondeada(orden, ...resto) {
      const args = Array.isArray(resto[0]) ? resto[0] : [];
      const texto = nombre === 'execSync' || nombre === 'exec' ? String(orden) : null;
      let red = esRed(orden, args);
      if (texto && /\bgit\s+(ls-remote|fetch|pull|push|clone)\b|\b(gh|curl|npx)\s/.test(texto)) red = 'shell';
      anota({ k: 'hijo', via: nombre, fase: fase(), orden: basename(String(orden)).slice(0, 60), args: args.slice(0, 5).map((x) => String(x).slice(0, 60)), red });
      return original.call(this, orden, ...resto);
    };
  }
  syncBuiltinESMExports();

  const local = (h) => !h || /^(localhost|127\.|::1|\[::1\]|0\.0\.0\.0)/.test(String(h));
  if (typeof globalThis.fetch === 'function') {
    const f0 = globalThis.fetch;
    globalThis.fetch = function fetchSondeado(url, ...r) {
      let h = '';
      try { h = new URL(typeof url === 'string' ? url : url.url ?? String(url)).hostname; } catch { h = '(url ilegible)'; }
      anota({ k: 'fetch', fase: fase(), host: h, red: local(h) ? null : `fetch ${h}` });
      return f0.call(this, url, ...r);
    };
  }
  const c0 = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function conectaSondeado(...a) {
    const o = a[0] && typeof a[0] === 'object' ? (Array.isArray(a[0]) ? a[0][0] : a[0]) : { port: a[0], host: a[1] };
    const h = o && (o.host || o.path || '');
    if (!(o && o.path) && !local(h)) anota({ k: 'socket', fase: fase(), host: String(h), red: `socket ${h}` });
    return c0.apply(this, a);
  };
  const l0 = dns.lookup;
  dns.lookup = function lookupSondeado(h, ...r) {
    if (!local(h)) anota({ k: 'dns', fase: fase(), host: String(h), red: `dns ${h}` });
    return l0.call(this, h, ...r);
  };
  syncBuiltinESMExports();
}
