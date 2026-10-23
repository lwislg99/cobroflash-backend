// S0 · SCRUM-1554g · Sonda 1: cada fichero de public/ en HEAD contra lo que sirve yaqu.app, byte a byte.
// Uso: node comparar-public.mjs <repo> <salida.json>
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const [repo, salida] = process.argv.slice(2);
const git = (...a) => execFileSync('git', ['-C', repo, ...a], { maxBuffer: 1 << 28 });
const head = git('rev-parse', 'HEAD').toString().trim();
const ficheros = git('ls-files', 'public').toString().split('\n').filter(Boolean);
const sha = (b) => createHash('sha256').update(b).digest('hex');

const filas = [];
let i = 0;
async function uno(f) {
  const local = git('show', `HEAD:${f}`);
  const url = 'https://yaqu.app/' + f.slice('public/'.length).split('/').map(encodeURIComponent).join('/');
  try {
    const r = await fetch(url, { redirect: 'manual', headers: { 'cache-control': 'no-cache' } });
    const buf = Buffer.from(await r.arrayBuffer());
    filas.push({
      f, url, status: r.status, local: local.length, servido: buf.length,
      igual: r.status === 200 && sha(buf) === sha(local),
      cf: r.headers.get('cf-cache-status'), age: r.headers.get('age'), cc: r.headers.get('cache-control'),
      ct: r.headers.get('content-type'), loc: r.headers.get('location'),
    });
  } catch (e) {
    filas.push({ f, url, status: 'ERROR', error: String(e) });
  }
}
async function trabajador() { while (i < ficheros.length) await uno(ficheros[i++]); }
await Promise.all(Array.from({ length: 8 }, trabajador));
filas.sort((a, b) => a.f.localeCompare(b.f));
const igual = filas.filter((x) => x.igual).length;
writeFileSync(salida, JSON.stringify({ head, total: ficheros.length, igual, filas }, null, 1));
console.log(`HEAD ${head} · población ${ficheros.length} ficheros de public/ · idénticos ${igual} · distintos o no 200: ${ficheros.length - igual}`);
