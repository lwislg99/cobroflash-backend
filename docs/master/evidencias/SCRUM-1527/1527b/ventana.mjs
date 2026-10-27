// SCRUM-1527b · la VENTANA del cuelgue, en bucle: scrum419 + los ficheros 438..458 por orden,
// con la misma orden que la tanda (node --test --test-force-exit) y concurrencia fija.
// uso: node ventana.mjs <raiz del arbol> <pasadas> <concurrencia> <salida.log>
// Si una pasada no acaba en TOPE_S, ANTES de matar se apunta que procesos node siguen vivos.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [raiz, pasadasTxt = '100', conc = '3', salida] = process.argv.slice(2);
const TOPE_S = 120;
const todos = fs.readdirSync(path.join(raiz, 'tests')).filter((f) => f.endsWith('.test.mjs')).sort();
const desde = todos.indexOf('scrum438-atestiguar.test.mjs');
const hasta = todos.indexOf('scrum458-paquete-de-precarga.test.mjs');
const ficheros = ['scrum419-ci-declara-lo-que-no-corre.test.mjs', ...todos.slice(desde, hasta + 1)].map((f) => 'tests/' + f);
const env = { ...process.env };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR', 'NODE_TEST_WORKER_ID']) delete env[k];
const log = (s) => { fs.appendFileSync(salida, s + '\n'); };
log(`POBLACION ficheros=${ficheros.length} pasadas=${pasadasTxt} concurrencia=${conc} node=${process.version} plataforma=${process.platform} tope=${TOPE_S}s`);
if (desde < 0 || hasta < 0 || ficheros.length < 15) { log('CIEGO: no encuentro la ventana'); process.exit(2); }

let completas = 0, colgadas = 0, rojas = 0, maxMs = 0;
for (let p = 1; p <= Number(pasadasTxt); p++) {
  const t0 = Date.now();
  const r = await new Promise((res) => {
    const h = spawn(process.execPath, ['--test', '--test-force-exit', `--test-concurrency=${conc}`, '--test-reporter=tap', ...ficheros], { cwd: raiz, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    h.stdout.on('data', (d) => { out += d; });
    h.stderr.on('data', (d) => { out += d; });
    const reloj = setTimeout(() => {
      // ANTES de matar: quien sigue vivo
      const ps = spawnSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,ParentProcessId,CreationDate,UserModeTime,KernelModeTime,CommandLine | Format-List"], { encoding: 'utf8' });
      log(`COLGADA pasada=${p} pid=${h.pid}\n--- vivos ---\n${ps.stdout}\n--- ultimas lineas ---\n${out.split('\n').slice(-12).join('\n')}`);
      spawnSync('taskkill', ['/PID', String(h.pid), '/T', '/F'], { stdio: 'ignore' });
      res({ colgada: true });
    }, TOPE_S * 1000);
    h.on('close', (code) => { clearTimeout(reloj); res({ code, out }); });
  });
  const ms = Date.now() - t0;
  if (r.colgada) { colgadas++; continue; }
  const m = /# tests (\d+)[\s\S]*# pass (\d+)[\s\S]*# fail (\d+)/.exec(r.out) || [];
  if (r.code === 0) completas++; else { rojas++; log(`ROJA pasada=${p} code=${r.code} tests=${m[1]} fail=${m[3]}`); }
  if (ms > maxMs) maxMs = ms;
  if (p === 1 || p % 10 === 0) log(`pasada=${p} ms=${ms} code=${r.code} tests=${m[1]} pass=${m[2]} fail=${m[3]} | acumulado completas=${completas} colgadas=${colgadas} rojas=${rojas} maxMs=${maxMs}`);
}
log(`FIN completas=${completas} colgadas=${colgadas} rojas=${rojas} maxMs=${maxMs}`);
log('EXIT=0');
