// docs/master/evidencias/SCRUM-1339/k-replica.mjs — SCRUM-1339k · LA COLA, ÁRBOL POR ÁRBOL Y CON
// LA LONGITUD DE RUTA DEL RUNNER
//
// La cola del informe lleva dentro la ruta del árbol (26 mensajes) y la lista de `docs/master`.
// Así que no vale medirla en mi árbol: hay que medirla en el árbol de cada PR y en una carpeta cuya
// ruta tenga los mismos caracteres que la del runner (leída del log de #2240:
// `/home/runner/work/cobroflash-backend/cobroflash-backend`).
//
//   node k-replica.mjs <raíz del repo> <carpeta de FUERA del árbol> <datos-pr.json> [sha extra,…]
//
// Por cada PR saca de git (sin tocar el árbol de trabajo) los dos tests y `docs/master/*.md` del
// commit de merge, los deja en la réplica, aplica allí la mutación 2 que declara `scrum859` y lanza
// el hijo como lo lanza el corredor (`--test-force-exit`, canal `child-v8`).
// No toca el árbol: la réplica vive fuera y se pisa en cada vuelta.
// ⚠️ La réplica no tiene `.git`: los tests de `scrum267` que preguntan a git caen de otra manera.
// Van ANTES del mensaje gordo; el control es la réplica del propio HEAD contra la medida en el árbol.
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const [RAIZ, FUERA, DATOS, extra = ''] = process.argv.slice(2);
if (!RAIZ || !FUERA || !DATOS) { console.error('uso: ver la cabecera'); process.exit(2); }
const RUNNER = '/home/runner/work/cobroflash-backend/cobroflash-backend';
const MARCA = 65536;
const CIEGAS = new Set([2240, 2247, 2251, 2259, 2261, 2277, 2281, 2290]); // de `j-salida-logs.txt`
const TESTS = ['tests/scrum267-ancla-de-medicion.test.mjs', 'tests/scrum859-identidad-y-motivo-cerrado.test.mjs'];
const M = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);

// La réplica: una ruta con EXACTAMENTE los caracteres de la del runner.
const base = path.resolve(FUERA);
const LARGO = Number(process.env.K_LARGO || RUNNER.length); // K_LARGO: otra longitud de ruta, para el control por pares
const falta = LARGO - base.length - 1;
if (falta < 1) { console.error(`🔴 la carpeta de fuera ya mide ${base.length}: no cabe una réplica de ${LARGO}`); process.exit(2); }
const REPLICA = path.join(base, 'r'.repeat(falta));
// 🔴 Dos pasadas a la vez en la MISMA réplica se pisan (me pasó: 27 PR con EPERM y uno con ENOENT).
if (fs.existsSync(REPLICA)) { console.log(`🔴 CIEGO: «${REPLICA}» ya existe: otra pasada la está usando, o una anterior murió. Si no hay ninguna viva, bórrala a mano.`); console.log('EXIT=4'); process.exit(4); }
const urlDeMas =pathToFileURL(REPLICA).href.length - (7 + LARGO); // «C:/» y «%20»
console.log(`node ${process.version} ${process.platform} · réplica: «${REPLICA}» (${REPLICA.length} caracteres; la del runner, ${RUNNER.length}) · su forma URL mide ${urlDeMas} más que la del runner · FORCE_COLOR=${process.env.FORCE_COLOR ?? "(sin poner)"}`);

const git = (...a) => execFileSync('git', a, { cwd: RAIZ, maxBuffer: 1 << 28 });
function montar(sha) {
  fs.rmSync(REPLICA, { recursive: true, force: true });
  const lista = git('ls-tree', '-r', '--name-only', sha, '--', 'docs/master', ...TESTS).toString().split('\n')
    .filter((f) => TESTS.includes(f) || /^docs\/master\/[^/]+$/.test(f));
  // Un solo `git cat-file --batch` para todos: uno por fichero eran 1.060 procesos por commit.
  const salida = execFileSync('git', ['cat-file', '--batch'], { cwd: RAIZ, maxBuffer: 1 << 28, input: lista.map((f) => `${sha}:${f}`).join('\n') + '\n' });
  let i = 0;
  for (const f of lista) {
    const fin = salida.indexOf(0x0A, i);
    const [, tipo, tam] = salida.subarray(i, fin).toString().split(' ');
    if (tipo !== 'blob') throw new Error(`git no devolvió un blob para ${f}: «${salida.subarray(i, fin)}»`);
    const dst = path.join(REPLICA, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, salida.subarray(fin + 1, fin + 1 + Number(tam)));
    i = fin + 1 + Number(tam) + 1;
  }
  if (i !== salida.length) throw new Error(`sobran ${salida.length - i} B en la salida de git`);
  return lista.length;
}
function trocear(buf) {
  const ev = []; let i = 0;
  while (i + 6 <= buf.length) {
    if (buf[i] !== 0xFF || buf[i + 1] !== 0x0F) break;
    const n = buf.readUInt32BE(i + 2);
    if (i + 6 + n > buf.length) break;
    let item = null;
    try { item = v8.deserialize(buf.subarray(i + 6, i + 6 + n)); } catch { /* ilegible */ }
    ev.push({ desde: i, bytes: 6 + n, tipo: item?.type ?? '(ilegible)', nombre: item?.data?.name ?? null, nesting: item?.data?.nesting ?? null });
    i += 6 + n;
  }
  return { ev, resto: buf.length - i };
}
const veces = (buf, texto) => { let n = 0; for (const c of ['latin1', 'utf16le']) { const a = Buffer.from(texto, c); let i = -1; while ((i = buf.indexOf(a, i + 1)) !== -1) n += 1; } return n; };
const SONDA = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'k-sonda-nucleo.mjs')).href;
const MODELO = process.env.K_MODELO === '1';
function hijo(conModelo = false, testigo = null) {
  return new Promise((ok) => {
    const env = { ...process.env, NODE_TEST_CONTEXT: 'child-v8' };
    delete env.NODE_OPTIONS;
    if (conModelo) { env.NODE_OPTIONS = '--import ' + SONDA; env.K_TESTIGO = testigo; } else for (const k of Object.keys(env)) if (k.startsWith('K_')) delete env[k];
    const h = spawn(process.execPath, ['--test-force-exit', path.join(REPLICA, TESTS[1])], { cwd: REPLICA, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const t = [];
    h.stdout.on('data', (d) => t.push(d)); h.stderr.resume();
    h.on('close', (codigo) => ok({ buf: Buffer.concat(t), codigo }));
  });
}
async function medir(sha, nMut = 2) {
  const ficheros = montar(sha);
  const muts = M.mutacionesDeclaradas(fs.readFileSync(path.join(REPLICA, TESTS[1]), 'utf8'), path.basename(TESTS[1]));
  const mut = muts[nMut - 1];
  const abs = path.join(REPLICA, mut.fichero);
  const antes = fs.readFileSync(abs, 'utf8');
  const despues = antes.replace(mut.de, mut.a);
  if (despues === antes) return { error: 'la mutación no cambió nada' };
  fs.writeFileSync(abs, despues);
  const r = await hijo();
  const { ev, resto } = trocear(r.buf);
  const ver = ev.filter((e) => (e.tipo === 'test:pass' || e.tipo === 'test:fail') && e.nesting === 0);
  const iGordo = ev.findLastIndex((e) => e.bytes >= MARCA);
  const cola = ev.slice(iGordo + 1);
  const bytesCola = cola.reduce((s, e) => s + e.bytes, 0);
  const dec = ver.find((e) => e.nombre?.includes(mut.cae));
  const colaBuf = r.buf.subarray(cola[0]?.desde ?? r.buf.length);
  const urls = veces(colaBuf, pathToFileURL(REPLICA).href);
  let modelo = null;
  if (MODELO) {
    // La MISMA réplica, otra vez, ahora con el núcleo fabricado de `k-sonda-nucleo.mjs` en el hijo.
    const testigo = path.join(base, 'k-replica-testigo-' + process.pid + '-' + Date.now() + '.jsonl');
    const m = await hijo(true, testigo);
    const t = JSON.parse(fs.readFileSync(testigo, 'utf8').trim().split('\n').at(-1));
    const lleg = trocear(m.buf).ev.filter((e) => (e.tipo === 'test:pass' || e.tipo === 'test:fail') && e.nesting === 0);
    modelo = { llegan: lleg.length, caenLlegados: lleg.filter((e) => e.tipo === 'test:fail').length, declarado: lleg.some((e) => e.nombre?.includes(mut.cae)) ? 'LLEGA' : 'NO LLEGA', perdidos: t.perdidos, pausas: t.pausas, atascos: t.atascos, marca: t.marca };
    fs.rmSync(testigo, { force: true });
  }
  return {
    modelo, ficheros, registros: fs.readdirSync(path.join(REPLICA, 'docs/master')).filter((x) => /^SCRUM-\d+\.md$/.test(x)).length,
    total: r.buf.length, mensajes: ev.length, resto, veredictos: ver.length, caen: ver.filter((e) => e.tipo === 'test:fail').length,
    gordo: ev[iGordo] ? `${ev[iGordo].tipo} ${ev[iGordo].bytes}` : '-', enCola: cola.length, cola: bytesCola,
    colaRunner: bytesCola - urls * urlDeMas, urls,
    tipoDec: dec?.tipo ?? 'NO APARECE', bytesDec: dec?.bytes ?? 0, detrasDec: dec ? r.buf.length - dec.desde - dec.bytes : -1,
    rutas: veces(colaBuf, REPLICA),
  };
}

// K_DESDE=<nº de PR>: sólo los PR de ese número en adelante (para retomar una pasada cortada).
const prs = DATOS === '-' ? [] : JSON.parse(fs.readFileSync(DATOS, 'utf8')).prs.filter((p) => p.n >= Number(process.env.K_DESDE || 0) && p.n <= Number(process.env.K_HASTA || Infinity));
const filas = [...extra.split(',').filter(Boolean).map((s) => ({ n: 0, rot: s, sha: s })), ...prs.map((p) => ({ n: p.n, rot: '#' + p.n, sha: p.merge, mergeado: p.mergeado }))];
console.log(`POBLACIÓN: ${prs.length} PR en ${path.basename(DATOS)} · ${filas.length - prs.length} commit(s) extra · mutación 2 de scrum859 · marca ${MARCA}`);
console.log(['quien', 'commit', 'ci', 'registros', 'bytes_total', 'veredictos', 'caen', 'ultimo_gordo', 'mensajes_cola', 'cola_replica', 'cola_runner', 'respecto_marca', 'declarado', 'detras_declarado', 'rutas_en_cola'].join('\t'));
const res = [];
for (const f of filas) {
  let m;
  try { m = await medir(f.sha); } catch (e) { m = { error: e.message.split('\n')[0] }; }
  if (m.error) { console.log(`${f.rot}\t${f.sha.slice(0, 10)}\t-\t🔴 ${m.error}`); res.push({ ...f, error: m.error }); continue; }
  const ci = f.n ? (CIEGAS.has(f.n) ? 'CIEGO' : 'viva') : '-';
  res.push({ ...f, ...m, ci });
  console.log([f.rot, f.sha.slice(0, 10), ci, m.registros, m.total, m.veredictos, m.caen, m.gordo, m.enCola, m.cola, m.colaRunner, m.colaRunner - MARCA, m.tipoDec, m.detrasDec, m.rutas].join('\t'));
  if (m.modelo) console.log(`      CON EL MODELO (marca ${m.modelo.marca}): veredictos que llegan ${m.modelo.llegan} de ${m.veredictos} · caídos que llegan ${m.modelo.caenLlegados} · el declarado ${m.modelo.declarado} · perdidos ${m.modelo.perdidos} B · pausas ${m.modelo.pausas} · atascos ${m.modelo.atascos}`);
}
const ok = res.filter((x) => !x.error && x.n);
const bajo = (l) => l.filter((x) => x.colaRunner < MARCA).length;
const ci = ok.filter((x) => x.ci === 'CIEGO'); const vi = ok.filter((x) => x.ci === 'viva');
const rango = (l) => (l.length ? `${Math.min(...l.map((x) => x.colaRunner))}–${Math.max(...l.map((x) => x.colaRunner))}` : '-');
console.log(`\nMEDIDOS ${ok.length} de ${prs.length} · con error ${res.filter((x) => x.error).length} · con 20 veredictos ${ok.filter((x) => x.veredictos === 20).length} · con el declarado caído ${ok.filter((x) => x.tipoDec === 'test:fail').length}`);
console.log(`COLA (estimada para el runner): ciegas en CI ${ci.length} → rango ${rango(ci)} · por debajo de ${MARCA}: ${bajo(ci)} | vivas en CI ${vi.length} → rango ${rango(vi)} · por debajo de ${MARCA}: ${bajo(vi)}`);
console.log(`valores distintos de la cola: ${[...new Set(ok.map((x) => x.colaRunner))].sort((a, b) => a - b).join(' ')}`);
fs.rmSync(REPLICA, { recursive: true, force: true });
console.log('EXIT=0');
