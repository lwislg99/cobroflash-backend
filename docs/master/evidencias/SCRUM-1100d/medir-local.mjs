// Medición S3 6-oct · en ESTA máquina (Windows: la tubería del hijo es bloqueante, no se pierde nada),
// ¿qué trae la pasada MUTADA de cada declaración que en CI salió CIEGA o MUERTA?
// Uso: node medir-local.mjs <raiz> <salida.json> <guard.test.mjs> [guard2 …]
// Aplica la mutación como `aplicarUna` (primera ocurrencia), SÓLO sobre ficheros que no se compilan,
// y la devuelve en un `finally`, comprobando los bytes.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { run } from 'node:test';
import { pathToFileURL } from 'node:url';

const [RAIZ, SALIDA, ...GUARDS] = process.argv.slice(2);
const M = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const F = await import(pathToFileURL(path.join(RAIZ, 'scripts/frontera-dist.mjs')).href);

async function eventos(guard) {
  const ev = [];
  const flujo = run({ files: [path.join(RAIZ, 'tests', guard)], cwd: RAIZ, forceExit: true, timeout: 300000 });
  for await (const e of flujo) {
    if (e.type === 'test:pass') ev.push({ t: e.data.skip ? 's' : 'p', n: e.data.name });
    else if (e.type === 'test:fail') ev.push({ t: 'c', n: e.data.name });
  }
  return ev;
}
// Lo que el hijo escribe hacia el padre: el mismo canal que usa `run()` (NODE_TEST_CONTEXT=child-v8).
function bytesDelHijo(guard) {
  return new Promise((ok) => {
    const h = spawn(process.execPath, ['--test-force-exit', path.join(RAIZ, 'tests', guard)],
      { cwd: RAIZ, env: { ...process.env, NODE_TEST_CONTEXT: 'child-v8' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = 0; let err = 0;
    h.stdout.on('data', (d) => { out += d.length; });
    h.stderr.on('data', (d) => { err += d.length; });
    h.on('close', (code) => ok({ out, err, code }));
  });
}
const cuenta = (ev) => `${ev.filter((x) => x.t === 'p').length}p+${ev.filter((x) => x.t === 'c').length}c+${ev.filter((x) => x.t === 's').length}s`;

const todo = [];
for (const guard of GUARDS) {
  const fuente = fs.readFileSync(path.join(RAIZ, 'tests', guard), 'utf8');
  const muts = M.mutacionesDeclaradas(fuente, guard);
  const limpia = await eventos(guard);
  const bLimpia = await bytesDelHijo(guard);
  console.log(`\n══ ${guard} · ${muts.length} mutación(es) · LIMPIA ${cuenta(limpia)} (${limpia.length} eventos) · hijo escribe ${bLimpia.out} B (salida ${bLimpia.code})`);
  const fila = { guard, limpia: cuenta(limpia), nLimpia: limpia.length, bytesLimpia: bLimpia.out, muts: [] };
  let k = 0;
  for (const mut of muts) {
    k += 1;
    const abs = path.join(RAIZ, mut.fichero);
    const r = { n: k, fichero: mut.fichero, cae: mut.cae };
    if (F.destinoEnDist(mut.fichero, RAIZ)) { r.estado = 'NO-MEDIDA (se compila a dist)'; fila.muts.push(r); console.log(`  [${k}] ${r.estado} · ${mut.fichero}`); continue; }
    if (!fs.existsSync(abs)) { r.estado = 'NO-MEDIDA (no existe el fichero)'; fila.muts.push(r); console.log(`  [${k}] ${r.estado}`); continue; }
    const ORIGINAL = fs.readFileSync(abs); const texto = ORIGINAL.toString('utf8');
    if (!texto.includes(mut.de)) { r.estado = 'NO-MEDIDA (el ancla no está)'; fila.muts.push(r); console.log(`  [${k}] ${r.estado}`); continue; }
    let ev; let b;
    try {
      fs.writeFileSync(abs, texto.replace(mut.de, mut.a));
      ev = await eventos(guard);
      b = await bytesDelHijo(guard);
    } finally {
      fs.writeFileSync(abs, ORIGINAL);
      if (Buffer.compare(fs.readFileSync(abs), ORIGINAL) !== 0) { console.error(`🔴 NO RESTAURADO ${abs}`); process.exit(3); }
    }
    const idx = ev.findIndex((x) => x.n.includes(mut.cae));
    r.estado = 'MEDIDA'; r.mutada = cuenta(ev); r.nMutada = ev.length; r.bytes = b.out; r.salidaHijo = b.code;
    r.declarado = idx < 0 ? 'NO-APARECE' : ev[idx].t === 'c' ? 'CAE' : ev[idx].t === 'p' ? 'PASA' : 'SALTADO';
    r.posicion = idx < 0 ? null : idx + 1;
    r.ficheroComoCaido = ev.some((x) => x.t === 'c' && /\.test\.mjs$/.test(x.n) && x.n.includes(path.sep));
    r.orden = ev.map((x) => x.t).join('');
    r.nombres = ev.map((x) => x.n);
    r.faltanRespectoALimpia = limpia.map((x) => x.n).filter((n) => !ev.some((y) => y.n === n)).length;
    fila.muts.push(r);
    console.log(`  [${k}] MUTADA ${r.mutada} (${r.nMutada} ev.) · declarado: ${r.declarado} en la posición ${r.posicion}/${r.nMutada} · hijo escribe ${r.bytes} B · faltan respecto a la limpia ${r.faltanRespectoALimpia} · «${mut.cae.slice(0, 60)}»`);
    console.log(`       orden: ${r.orden}`);
  }
  todo.push(fila);
}
fs.writeFileSync(SALIDA, JSON.stringify(todo, null, 1));
console.log('\nEXIT=0');
process.exit(0);
