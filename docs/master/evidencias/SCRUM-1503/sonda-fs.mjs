// docs/master/evidencias/SCRUM-1503/sonda-fs.mjs — SCRUM-1503
//
// SONDA DE EJECUCIÓN. Se carga con `--import` DENTRO del proceso del test y apunta, mientras el
// test corre, qué directorios LISTA de verdad y qué procesos lanza. No cambia lo que devuelven
// las llamadas: las envuelve, apunta y delega.
//
// Es la otra mitad de `scripts/_tests-que-cubren.mjs`, que LEE el fuente: aquí la población sale
// de lo que el test hace al ejecutarse, también cuando lo hace a través de un helper.
//
// Deja en `SONDA_SALIDA` una línea JSON por hecho:
//   {t:'testigo'}                       la sonda se cargó en ESTE proceso (sin esto, un cero no vale)
//   {t:'dir', ruta, por, rec}           se listó ese directorio del repositorio; `por` es el primer
//                                       fichero del repositorio en la pila; `rec` si fue recursivo
//   {t:'fuera', n}                      listados fuera del repositorio (sólo se cuentan)
//   {t:'proc', orden}                   proceso lanzado (los hijos que limpian su entorno NO llevan sonda)
import fs from 'node:fs';
import cp from 'node:child_process';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

const SALIDA = process.env.SONDA_SALIDA;
const RAIZ = process.env.SONDA_RAIZ;

if (SALIDA && RAIZ) {
  const anexar = fs.appendFileSync.bind(fs);
  const escribir = (o) => { try { anexar(SALIDA, `${JSON.stringify(o)}\n`); } catch { /* sin sitio donde decirlo */ } };
  const YO = fileURLToPath(import.meta.url);
  const raizNorm = path.resolve(RAIZ);
  escribir({ t: 'testigo', pid: process.pid, argv1: process.argv[1] || '' });

  /** Ruta relativa al repositorio con `/`, o `null` si cae fuera. */
  const relativa = (abs) => {
    const r = path.relative(raizNorm, abs);
    if (r.startsWith('..') || path.isAbsolute(r)) return null;
    return r.split(path.sep).join('/') || '.';
  };
  /** El primer fichero del repositorio que hay en la pila, sin contar esta sonda. */
  const quien = () => {
    const pila = String(new Error('pila').stack || '').split('\n').slice(2);
    for (const linea of pila) {
      const m = /\(?((?:file:\/\/\/)?[A-Za-z]:[\\/][^():]+|\/[^():]+):\d+:\d+\)?\s*$/.exec(linea);
      if (!m) continue;
      let f = m[1];
      try { if (f.startsWith('file:')) f = fileURLToPath(f); } catch { continue; }
      if (path.resolve(f) === YO) continue;
      const rel = relativa(path.resolve(f));
      if (rel) return rel;
    }
    return '(nadie del repositorio en la pila)';
  };
  const aTexto = (d) => {
    if (typeof d === 'string') return d;
    if (d instanceof URL) { try { return fileURLToPath(d); } catch { return null; } }
    if (Buffer.isBuffer(d)) return d.toString();
    return null;
  };

  const vistos = new Set();
  let fuera = 0;
  const apuntarDir = (d, opciones, via) => {
    try {
      const texto = aTexto(d);
      if (texto === null) return;
      const rel = relativa(path.resolve(texto));
      if (rel === null) { fuera += 1; return; }
      const rec = Boolean(opciones && typeof opciones === 'object' && opciones.recursive);
      const por = quien();
      const clave = `${rel}\u0000${por}\u0000${rec}`;
      if (vistos.has(clave)) return;
      vistos.add(clave);
      escribir({ t: 'dir', ruta: rel, por, rec, via });
    } catch { /* la sonda no rompe al sujeto */ }
  };
  const procesos = new Set();
  const apuntarProc = (via, a, b) => {
    try {
      const orden = [aTexto(a) ?? String(a), ...(Array.isArray(b) ? b.map(String) : [])].join(' ').slice(0, 240);
      if (procesos.has(orden)) return;
      procesos.add(orden);
      escribir({ t: 'proc', via, orden, por: quien() });
    } catch { /* idem */ }
  };

  const envolver = (obj, nombre, antes) => {
    const original = obj[nombre];
    if (typeof original !== 'function') return;
    const envuelta = function envuelta(...args) { antes(args); return original.apply(this, args); };
    Object.defineProperty(envuelta, 'name', { value: original.name });
    for (const k of Object.getOwnPropertySymbols(original)) envuelta[k] = original[k]; // util.promisify.custom
    obj[nombre] = envuelta;
  };
  for (const n of ['readdirSync', 'readdir', 'opendirSync', 'opendir']) {
    envolver(fs, n, (a) => apuntarDir(a[0], a[1], n));
    envolver(fs.promises, n, (a) => apuntarDir(a[0], a[1], `promises.${n}`));
  }
  for (const n of ['globSync', 'glob']) {
    // Un glob no dice qué directorio lista: se apunta desde dónde parte (`cwd`, o el del proceso).
    envolver(fs, n, (a) => apuntarDir((a[1] && a[1].cwd) || process.cwd(), { recursive: true }, `${n}(${String(a[0]).slice(0, 60)})`));
    envolver(fs.promises, n, (a) => apuntarDir((a[1] && a[1].cwd) || process.cwd(), { recursive: true }, `promises.${n}(${String(a[0]).slice(0, 60)})`));
  }
  for (const n of ['execSync', 'exec', 'execFileSync', 'execFile', 'spawnSync', 'spawn', 'fork']) {
    envolver(cp, n, (a) => apuntarProc(n, a[0], a[1]));
  }
  syncBuiltinESMExports();
  process.on('exit', () => { if (fuera) escribir({ t: 'fuera', n: fuera }); });
}
