// SCRUM-1610 · sonda: ¿un hijo que hace muchos console.log y después process.exit() llega CORTADO al padre?
//
// Imita a los dos hijos de los rojos del 26-oct (`_censo-frontera.mjs` y `meta-guard-mutaciones.mjs
// --solo-censo`): K escrituras de una línea cada una, una línea final «FIN» y process.exit(), sin esperar a
// que stdout se vacíe. El padre cuenta cuántas pasadas NO traen «FIN».
//
//   node sonda-salida-cortada.mjs --n 50 --lineas 190 --bytes 100 [--paralelo 5] [--ocupado-ms 0]
//                                 [--modo tuberia|fichero] [--sembrar 1]
//
// --ocupado-ms  el padre bloquea su bucle de eventos ese tiempo justo después de lanzar cada hijo: es el lector
//               que no lee (en CI, un padre ocupado o una CPU sin turno).
// --sembrar k   el POSITIVO: en k pasadas el hijo se salta «FIN» a propósito. La sonda tiene que contarlas como
//               cortadas; si dice 0 con --sembrar, la sonda está ciega y su 0 no vale.
// Declara su población: plataforma, versión de node, tipo de handle de stdout en el hijo y pasadas.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ESTE = fileURLToPath(import.meta.url);
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };

if (process.argv.includes('--hijo')) {
  const K = Number(arg('lineas', 190)); const B = Number(arg('bytes', 100)); const saltar = arg('saltar', '0') === '1';
  const h = process.stdout._handle;
  console.log('HANDLE ' + (h ? h.constructor.name : 'ninguno'));
  for (let i = 0; i < K; i++) console.log(String(i).padStart(4, '0') + ' ' + 'x'.repeat(Math.max(0, B - 6)));
  if (!saltar) console.log('FIN');
  process.exit(0);
}

const N = Number(arg('n', 50)); const P = Number(arg('paralelo', 1)); const OCUPADO = Number(arg('ocupado-ms', 0));
const MODO = arg('modo', 'tuberia'); const SEMBRAR = Number(arg('sembrar', 0));
const K = arg('lineas', '190'); const B = arg('bytes', '100');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sonda1610-'));

function una(i) {
  const saltar = i < SEMBRAR ? '1' : '0';
  const args = [ESTE, '--hijo', '--lineas', K, '--bytes', B, '--saltar', saltar];
  return new Promise((ok) => {
    if (MODO === 'fichero') {
      const f = path.join(TMP, i + '.txt'); const fd = fs.openSync(f, 'w');
      const h = spawn(process.execPath, args, { stdio: ['ignore', fd, 'ignore'] });
      h.on('close', (codigo) => { fs.closeSync(fd); ok({ i, codigo, salida: fs.readFileSync(f, 'utf8'), saltar }); });
    } else {
      const h = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'ignore'] });
      let salida = ''; h.stdout.on('data', (b) => { salida += b; });
      h.on('close', (codigo) => ok({ i, codigo, salida, saltar }));
    }
    if (OCUPADO > 0) { const fin = Date.now() + OCUPADO; while (Date.now() < fin) { /* lector ocupado */ } }
  });
}

const res = []; let sig = 0;
try {
  await Promise.all(Array.from({ length: P }, async () => { while (sig < N) res.push(await una(sig++)); }));
} finally {
  fs.rmSync(TMP, { recursive: true, force: true }); // SCRUM-864c ③: el temporal se borra también si una pasada lanza
}

const cortadas = res.filter((r) => !/^FIN$/m.test(r.salida));
const sembradas = res.filter((r) => r.saltar === '1');
const cazadas = sembradas.filter((r) => cortadas.includes(r)).length;
const reales = cortadas.filter((r) => r.saltar === '0');
const handle = (res.find((r) => /^HANDLE /m.test(r.salida))?.salida.match(/^HANDLE (.*)$/m) || [])[1] || '¿?';
console.log(`POBLACION: ${res.length} pasadas de ${N} · ${os.platform()} ${os.release()} · node ${process.version} · modo ${MODO} · paralelo ${P} · lector ocupado ${OCUPADO} ms · ${K} líneas de ${B} B · stdout del hijo: ${handle}`);
console.log(`SEMBRADAS ${sembradas.length} · cazadas ${cazadas}` + (sembradas.length && cazadas !== sembradas.length ? '  ← CIEGA: la sonda no ve el corte que ella misma siembra' : ''));
console.log(`CORTADAS (sin sembrar) ${reales.length} de ${res.length - sembradas.length}` + (reales.length ? ' · líneas recibidas: ' + reales.map((r) => r.salida.split('\n').length - 1).join(', ') + ' · códigos: ' + [...new Set(reales.map((r) => r.codigo))].join(',') : ''));
process.exit(sembradas.length && cazadas !== sembradas.length ? 2 : reales.length ? 1 : 0);
