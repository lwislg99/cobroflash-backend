// Censo SCRUM-976: cada tests/*.test.mjs, corrido SIN dist y SIN base, con su tiempo y su recuento.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const RAIZ = process.argv[2];
const SALIDA = process.argv[3];
const ANSI = /\u001B\[[0-9;]*[A-Za-z]/g;
const ficheros = fs.readdirSync(path.join(RAIZ, 'tests')).filter((f) => f.endsWith('.test.mjs')).sort();

const env = { ...process.env };
delete env.FORCE_COLOR; delete env.NODE_TEST_CONTEXT; delete env.DATABASE_URL; delete env.DIRECT_URL;
env.NO_COLOR = '1';

function estatico(src) {
  return {
    dist: /(['"`\/])dist\//.test(src) || /\.\.\/dist/.test(src),
    base: /prisma|DATABASE_URL|\bpg\b|postgres/i.test(src),
    nav: /puppeteer|playwright|chrome-headless|msedge/i.test(src),
    proc: /spawnSync|execSync|execFileSync|child_process/.test(src),
  };
}

function correr(f) {
  return new Promise((res) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, ['--test', '--test-force-exit', path.join('tests', f)], { cwd: RAIZ, env });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => p.kill(), 120000);
    p.on('close', (code) => {
      clearTimeout(timer);
      const l = out.replace(ANSI, '');
      const n = (k) => { const m = new RegExp('^[^\\n]*\\b' + k + '\\s+(\\d+)\\s*$', 'm').exec(l); return m ? Number(m[1]) : null; };
      res({ f, code, ms: Date.now() - t0, tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped'), todo: n('todo') });
    });
  });
}

const resultados = [];
let i = 0;
async function hilo() {
  while (i < ficheros.length) {
    const f = ficheros[i++];
    const src = fs.readFileSync(path.join(RAIZ, 'tests', f), 'utf8');
    const r = await correr(f);
    resultados.push({ ...r, ...estatico(src), bytes: src.length });
  }
}
await Promise.all(Array.from({ length: 4 }, hilo));
resultados.sort((a, b) => a.f.localeCompare(b.f));
fs.writeFileSync(SALIDA, JSON.stringify(resultados, null, 1));
console.log('ficheros', resultados.length);
