// docs/master/evidencias/SCRUM-1339/k-medir.mjs — SCRUM-1339k · LA COLA EN BYTES, Y EL MODELO
//
//   node k-medir.mjs bytes <raíz> <carpeta de FUERA del árbol> <test.mjs> <nº de mutación>
//       El canal hijo→padre de esa mutación, mensaje a mensaje: cuánto viaja detrás de cada
//       veredicto, en cuántas escrituras, y cuántas veces nombra la ruta de ESTA máquina.
//   node k-medir.mjs mapa <raíz> <carpeta de FUERA> <test.mjs> <config;config;…>
//       El instrumento DE LA CASA (`correr` y `aplicarUna`, sin copiar su lógica) con
//       `k-sonda-nucleo.mjs` cargada en el hijo. Cada config es `CLAVE=valor,CLAVE=valor`
//       (K_MARCA, K_CAP, K_RITMO, K_ATASCO, K_SUELTA, K_TRAS_GORDO). ⚠️ El núcleo es FABRICADO: ver la sonda.
//
// ⚠️ MUTA el árbol (`aplicarUna` restaura en su `finally`; en `bytes` se restaura aquí). Al
// acabar se comprueban por sha256 los ficheros mutados. No lanzar con otra cosa en el mismo árbol.
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const [MODO, RAIZ, FUERA, TEST, ARG] = process.argv.slice(2);
if (!['bytes', 'mapa'].includes(MODO) || !RAIZ || !FUERA || !TEST || !ARG) { console.error('uso: ver la cabecera'); process.exit(2); }
fs.mkdirSync(FUERA, { recursive: true });
const SONDA = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'k-sonda-nucleo.mjs')).href;
const M = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
const fuente = fs.readFileSync(path.join(RAIZ, 'tests', TEST), 'utf8');
const muts = M.mutacionesDeclaradas(fuente, TEST);
const antes = new Map(muts.map((m) => [m.fichero, sha(fs.readFileSync(path.join(RAIZ, m.fichero)))]));
console.log(`node ${process.version} ${process.platform} · ${TEST} · ${muts.length} mutaciones declaradas · modo ${MODO}`);

/** El mismo troceo que `j-medir.mjs` (canal `child-v8`): [ff 0f][tamaño, 4 B BE][valor con su cabecera]. */
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
const veces = (buf, texto) => {
  let n = 0;
  for (const cod of ['latin1', 'utf16le']) { const aguja = Buffer.from(texto, cod); let i = -1; while ((i = buf.indexOf(aguja, i + 1)) !== -1) n += 1; }
  return n;
};
function hijo(env) {
  return new Promise((ok) => {
    const h = spawn(process.execPath, ['--test-force-exit', path.join(RAIZ, 'tests', TEST)], { cwd: RAIZ, env: { ...process.env, NODE_TEST_CONTEXT: 'child-v8', NODE_OPTIONS: `--import ${SONDA}`, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const trozos = [];
    h.stdout.on('data', (d) => trozos.push(d));
    h.stderr.resume();
    h.on('close', (codigo) => ok({ buf: Buffer.concat(trozos), codigo }));
  });
}
const ultima = (f) => { const l = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean) : []; return l.map((x) => JSON.parse(x)); };

if (MODO === 'bytes') {
  const mut = muts[Number(ARG) - 1];
  const abs = path.join(RAIZ, mut.fichero);
  const ORIGINAL = fs.readFileSync(abs);
  const testigo = path.join(FUERA, `k-bytes-mut${ARG}-${Date.now()}.jsonl`);
  let r;
  try {
    fs.writeFileSync(abs, ORIGINAL.toString('utf8').replace(mut.de, mut.a));
    r = await hijo({ K_TESTIGO: testigo });
  } finally {
    fs.writeFileSync(abs, ORIGINAL);
    if (Buffer.compare(fs.readFileSync(abs), ORIGINAL) !== 0) { console.error(`🔴 NO RESTAURADO ${abs}`); process.exit(3); }
  }
  const { ev, resto } = trocear(r.buf);
  const ver = ev.filter((e) => (e.tipo === 'test:pass' || e.tipo === 'test:fail') && e.nesting === 0);
  console.log(`MUTACIÓN ${ARG} · cae: «${mut.cae}» · el hijo salió con ${r.codigo}`);
  console.log(`POBLACIÓN: ${r.buf.length} B hacia el padre · ${ev.length} mensajes enteros · ${resto} B de resto · veredictos de primer nivel ${ver.length} · ilegibles ${ev.filter((e) => e.tipo === '(ilegible)').length}`);
  const t = ultima(testigo)[0];
  console.log(`ESCRITURAS del hijo a su salida (sonda): ${t?.escrituras} · bytes pedidos ${t?.pedidos} · ¿una escritura por mensaje, con los mismos tamaños? ${t && t.traza.length === ev.length && t.traza.every((x, i) => x[0] === ev[i].bytes) ? 'sí' : 'NO'}`);
  console.log('\nLos veredictos, y cuánto viaja DETRÁS de cada uno:');
  ver.forEach((e, k) => console.log(`  ${String(k + 1).padStart(2)} ${e.tipo === 'test:pass' ? 'pasa' : 'CAE '} · ${String(e.bytes).padStart(7)} B · detrás ${String(r.buf.length - e.desde - e.bytes).padStart(8)} B · «${String(e.nombre).slice(0, 50)}»${e.nombre?.includes(mut.cae) ? '  ← EL DECLARADO' : ''}`));
  // El último mensaje que por sí solo llega a la marca de agua de Linux: a partir de él, la cola.
  const MARCA = 65536;
  const iGordo = ev.findLastIndex((e) => e.bytes >= MARCA);
  const cola = ev.slice(iGordo + 1);
  const bytesCola = cola.reduce((s, e) => s + e.bytes, 0);
  console.log(`\nÚLTIMO mensaje de ${MARCA} B o más: el nº ${iGordo + 1} de ${ev.length} (${ev[iGordo]?.tipo}, ${ev[iGordo]?.bytes} B, «${String(ev[iGordo]?.nombre).slice(0, 40)}»)`);
  console.log(`DETRÁS de él: ${cola.length} mensajes · ${bytesCola} B · ${bytesCola - MARCA >= 0 ? 'sobran' : 'faltan'} ${Math.abs(bytesCola - MARCA)} B respecto a ${MARCA}`);
  let ac = 0;
  for (const e of cola) {
    ac += e.bytes;
    const idx = ev.indexOf(e);
    console.log(`   +${String(ac).padStart(6)} B · ${String(e.bytes).padStart(6)} B · ${e.tipo.padEnd(15)} · vuelta del bucle ${t?.traza[idx]?.[3]} · «${String(e.nombre ?? '').slice(0, 44)}»${ac - e.bytes < MARCA && ac >= MARCA ? '   ← AQUÍ SE CRUZAN LOS 65.536' : ''}`);
  }
  // Cuánto de esa cola depende de la máquina: la ruta del árbol viaja dentro de los mensajes.
  const raizWin = path.resolve(RAIZ);
  const formas = [raizWin, raizWin.replace(/\\/g, '/'), pathToFileURL(raizWin).href.replace(/^file:\/\/\//, '')];
  const colaBuf = r.buf.subarray(cola[0]?.desde ?? r.buf.length);
  console.log(`\nLA RUTA DE ESTA MÁQUINA dentro del canal (control positivo: «${path.basename(TEST)}» sale ${veces(r.buf, path.basename(TEST))} veces en todo el canal):`);
  let deltaCola = 0;
  const RUNNER = '/home/runner/work/cobroflash-backend/cobroflash-backend';
  for (const f of [...new Set(formas)]) {
    const enTodo = veces(r.buf, f); const enCola = veces(colaBuf, f);
    console.log(`   «${f}» (${f.length} caracteres): ${enTodo} veces en todo el canal · ${enCola} en la cola`);
    deltaCola += enCola * (RUNNER.length - f.length);
  }
  console.log(`   control de cero: «${raizWin}-no-existe» sale ${veces(r.buf, raizWin + '-no-existe')} veces`);
  console.log(`   con la ruta habitual de un runner («${RUNNER}», ${RUNNER.length} caracteres, SUPUESTA, no leída de ningún log) la cola cambiaría en unos ${deltaCola} B (contando 1 B por carácter): ${bytesCola} → ~${bytesCola + deltaCola}`);
  fs.writeFileSync(path.join(FUERA, `k-canal-mut${ARG}.bin`), r.buf);
} else {
  process.env.NODE_OPTIONS = `--import ${SONDA}`;
  const clase = (r) => (r.ok ? 'VIVA' : r.ciego ? 'CIEGO' : r.muerto ? 'FICHERO MUERTO' : r.mudo ? 'MUDA' : '(sin clasificar)');
  const CLAVES = ['K_MODELO', 'K_MARCA', 'K_CAP', 'K_RITMO', 'K_ATASCO', 'K_SUELTA', 'K_TRAS_GORDO', 'K_TESTIGO'];
  let n = 0;
  for (const config of ARG.split(';').map((c) => c.trim()).filter(Boolean)) {
    n += 1;
    for (const k of CLAVES) delete process.env[k];
    const sinModelo = config === 'SIN';
    if (!sinModelo) { process.env.K_MODELO = '1'; for (const par of config.split(',')) { const [k, v] = par.split('='); if (!CLAVES.includes(k)) { console.error(`🔴 clave desconocida ${k}`); process.exit(2); } process.env[k] = v; } }
    const testigo = path.join(FUERA, `k-mapa-${process.pid}-${n}.jsonl`);
    process.env.K_TESTIGO = testigo;
    const limpia = await M.correr(TEST);
    console.log(`\n══ ${sinModelo ? 'SIN MODELO (control: la salida de la plataforma)' : config} · LIMPIA ${limpia.pasados.length} pasados · ${limpia.caidos.length} caídos`);
    let k = 0;
    for (const mut of muts) {
      k += 1;
      const desde = ultima(testigo).length;
      const r = await M.aplicarUna(mut, TEST, limpia);
      const filas = ultima(testigo).slice(desde);
      const texto = String(r.ciego || r.muerto || r.mudo || '');
      const rec = /Recuento: (\d+ pasados · \d+ caídos · \d+ saltados)/.exec(texto)?.[1];
      const faltan = /FALTAN (\d+ de los \d+)/.exec(texto)?.[1];
      const causa = !texto ? '' : /NO APARECE en la pasada mutada/.test(texto) ? ' · NO APARECE en la mutada' : ' · (otra causa: ' + texto.replace(/\s+/g, ' ').slice(0, 100) + ')';
      const s = filas.map((f) => `pedidos ${f.pedidos} · perdidos ${f.perdidos} · pausas ${f.pausas} · atascos ${f.atascos} · escrituras que no cupieron ${f.traza.filter((x) => x[2] === 0).length} de ${f.escrituras}`).join(' ‖ ');
      console.log(`   mutación ${k} → ${clase(r)}${causa}${rec ? ' · mutada: ' + rec : ''}${faltan ? ' · faltan ' + faltan : ''}\n        hijo(s) ${filas.length}: ${s || '🔴 SIN TESTIGO'}`);
    }
  }
  for (const k of CLAVES) delete process.env[k];
}
let sucio = 0;
for (const [f, h] of antes) if (sha(fs.readFileSync(path.join(RAIZ, f))) !== h) { sucio += 1; console.log(`🔴 ${f} NO está como estaba`); }
console.log(`\nÁRBOL: ${antes.size} fichero(s) mutados comprobados por sha256 · distintos de antes: ${sucio}`);
console.log(`EXIT=${sucio ? 3 : 0}`);
process.exit(sucio ? 3 : 0);
