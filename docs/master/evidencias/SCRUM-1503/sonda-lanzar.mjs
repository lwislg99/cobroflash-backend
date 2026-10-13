// docs/master/evidencias/SCRUM-1503/sonda-lanzar.mjs — SCRUM-1503
//
// Corre tests UNO A UNO, cada uno en su proceso y con `sonda-fs.mjs` cargada dentro, y deja por
// test un `.jsonl` (lo que listó) y un `.fin.json` (cómo acabó). Es REANUDABLE: un test que ya
// tiene su `.fin.json` no se repite, así que se lanza por tramos cortos y en primer plano.
//
//     node docs/master/evidencias/SCRUM-1503/sonda-lanzar.mjs \
//          --montones <montones.json> --cual CANDIDATO --salida <dir FUERA del árbol> \
//          [--cada 7] [--concurrencia 2] [--minutos 8] [--techo-s 120]
//
// `--cada N` toma uno de cada N (muestra fija, no al azar: se puede repetir).
// El entorno del sujeto se construye a mano (A21): sin FORCE_COLOR, sin NODE_TEST_CONTEXT, y con
// el NODE_OPTIONS de la sonda, que es lo único que se le añade.
//
// SALIDAS: 0 todos los pedidos tienen `.fin.json` · 3 quedan por correr (vuelve a lanzarme) · 2 mal llamado.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const arg = (n, def) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const montonesRuta = arg('montones');
const cual = arg('cual');
const salidaDir = arg('salida');
const cada = Number(arg('cada', '1'));
const concurrencia = Math.min(3, Math.max(1, Number(arg('concurrencia', '2'))));
const minutos = Number(arg('minutos', '8'));
const techoS = Number(arg('techo-s', '120'));
if (!montonesRuta || !cual || !salidaDir) { console.error('faltan --montones, --cual o --salida'); process.exit(2); }
if (!path.relative(RAIZ, path.resolve(salidaDir)).startsWith('..')) { console.error('--salida tiene que caer FUERA del arbol'); process.exit(2); }

const montones = JSON.parse(fs.readFileSync(montonesRuta, 'utf8'));
const lista = (montones[cual] || []).slice().sort().filter((_, i) => i % cada === 0);
if (!lista.length) { console.error(`el monton «${cual}» esta vacio o no existe`); process.exit(2); }
fs.mkdirSync(salidaDir, { recursive: true });

const nombreDe = (t) => path.basename(t).replace(/\.test\.mjs$/, '');
const finDe = (t) => path.join(salidaDir, `${nombreDe(t)}.fin.json`);
const pendientes = lista.filter((t) => !fs.existsSync(finDe(t)));
console.log(`POBLACION: ${lista.length} tests pedidos de «${cual}» (uno de cada ${cada}) · ya hechos: ${lista.length - pendientes.length} · por correr: ${pendientes.length} · ${concurrencia} a la vez · techo ${techoS} s por test · corte a los ${minutos} min`);

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
entorno.NODE_OPTIONS = `--import=${pathToFileURL(path.join(AQUI, 'sonda-fs.mjs')).href}`;
entorno.SONDA_RAIZ = RAIZ;

const t0 = Date.now();
let hechos = 0;
let colgados = 0;
const uno = (t) => new Promise((resolve) => {
  const nombre = nombreDe(t);
  const jsonl = path.join(salidaDir, `${nombre}.jsonl`);
  const tap = path.join(salidaDir, `${nombre}.tap`);
  for (const f of [jsonl, tap]) fs.rmSync(f, { force: true });
  const inicio = Date.now();
  const hijo = spawn(process.execPath, [
    '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, t,
  ], { cwd: RAIZ, env: { ...entorno, SONDA_SALIDA: jsonl }, stdio: 'ignore', windowsHide: true });
  let colgado = false;
  const reloj = setTimeout(() => { colgado = true; hijo.kill(); }, techoS * 1000);
  hijo.on('close', (codigo, senal) => {
    clearTimeout(reloj);
    let texto = '';
    try { texto = fs.readFileSync(tap, 'utf8'); } catch { texto = ''; }
    const n = (clave) => { const m = new RegExp(`^# ${clave} (\\d+)$`, 'm').exec(texto); return m ? Number(m[1]) : null; };
    fs.rmSync(tap, { force: true });
    fs.writeFileSync(finDe(t), JSON.stringify({
      test: t, codigo, senal, colgado, ms: Date.now() - inicio,
      tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped'),
    }));
    hechos += 1;
    if (colgado) colgados += 1;
    resolve();
  });
});

const cola = pendientes.slice();
const obrero = async () => {
  while (cola.length && Date.now() - t0 < minutos * 60_000) await uno(cola.shift());
};
await Promise.all(Array.from({ length: concurrencia }, obrero));

const quedan = lista.filter((t) => !fs.existsSync(finDe(t))).length;
console.log(`HECHOS en esta pasada: ${hechos} (${colgados} cortados por el techo) · ${Math.round((Date.now() - t0) / 1000)} s · QUEDAN: ${quedan} de ${lista.length}`);
const salida = quedan ? 3 : 0;
console.log(`EXIT=${salida}`);
process.exit(salida);
