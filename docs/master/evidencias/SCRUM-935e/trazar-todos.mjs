// Corre UNA vez cada guard declarante (su línea base, como `correr` del meta-guard) con la traza puesta.
//   node trazar-todos.mjs <raiz> <dirSalida> [filtro]
import fs from 'node:fs';
import path from 'node:path';
import { run } from 'node:test';
import { pathToFileURL } from 'node:url';

const [raiz, salida, filtro] = process.argv.slice(2);
const porGuard = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'porguard.json'), 'utf8'));
const TUBERIA = pathToFileURL(path.join(raiz, 'scripts', 'tuberia-bloqueante.mjs')).href;
const TRAZA = pathToFileURL(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'traza-lecturas.mjs')).href;
const tiempos = {};
const elegidos = filtro?.startsWith('@') ? new Set(JSON.parse(fs.readFileSync(filtro.slice(1), 'utf8'))) : null;
const lista = porGuard.filter((g) => (elegidos ? elegidos.has(g.guard) : (!filtro || g.guard.includes(filtro))));
let i = 0;
for (const { guard, n } of lista) {
  i += 1;
  const dir = path.join(salida, guard);
  fs.rmSync(dir, { recursive: true, force: true });
  process.env.TRAZA_DIR = dir;
  const t0 = Date.now();
  let pasados = 0; let caidos = 0; let saltados = 0;
  const flujo = run({
    files: [path.join(raiz, 'tests', guard)], cwd: raiz, forceExit: true,
    execArgv: [`--import=${TUBERIA}`, `--import=${TRAZA}`], timeout: 300000,
  });
  for await (const ev of flujo) {
    if (ev.type === 'test:pass') { if (ev.data.skip) saltados += 1; else pasados += 1; }
    else if (ev.type === 'test:fail') caidos += 1;
  }
  const ms = Date.now() - t0;
  const trazas = fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
  tiempos[guard] = { ms, n, pasados, caidos, saltados, trazas };
  console.log(`${String(i).padStart(3)}/${lista.length} ${guard.padEnd(60)} ${(ms / 1000).toFixed(1).padStart(6)} s · ${pasados}✔ ${caidos}✖ ${saltados}s · trazas ${trazas}`);
}
delete process.env.TRAZA_DIR;
const previo = fs.existsSync(path.join(salida, '_tiempos.json')) ? JSON.parse(fs.readFileSync(path.join(salida, '_tiempos.json'), 'utf8')) : {};
fs.writeFileSync(path.join(salida, '_tiempos.json'), JSON.stringify({ ...previo, ...tiempos }, null, 1));
