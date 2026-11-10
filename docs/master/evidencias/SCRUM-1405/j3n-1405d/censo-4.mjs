// SCRUM-1405d · J3 · cuánto pierde HOY la cobaya de `scrum1405c ④` con el módulo, en el CI de Linux.
//
// Uso: node censo-4.mjs <desdeISO> <dirLogs> [<salida.tsv>]   (dirLogs FUERA del árbol: SCRUM-824)
//      node censo-4.mjs --controles                           (sólo los controles fabricados)
//
// POBLACIÓN: todos los runs de ci.yml creados desde <desdeISO> (por defecto, el merge de #2429), con
// el job obligatorio «build + tests…» en success O failure. A diferencia de SCRUM-1428/ci-rojos.mjs,
// baja también los VERDES: contar sólo los rojos es contar sólo las pasadas que perdieron.
// De cada log saca las dos listas que el caso ④ imprime —en su diagnóstico si pasa, en su mensaje si
// cae—: «sin el módulo: [...] · con el módulo: [...]», 4 pasadas por brazo, `faltan` de 320.
// Un job sin esa línea es CIEGO para la medición (y se dice por qué: saltado, ausente, log corto).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';
const run = promisify(execFile);
const gh = async (args) => (await run(GH, args, { encoding: 'utf8', maxBuffer: 1 << 28 })).stdout;

const RE = /sin el módulo: (\[[^\]]*\]) · con el módulo: (\[[^\]]*\])/;

/** De un log, la medición de ④ o el motivo por el que no la hay. */
export function leer(txt) {
  const m = RE.exec(txt);
  if (m) {
    const sin = JSON.parse(m[1]), con = JSON.parse(m[2]);
    const cayo = /con el módulo la cobaya SIGUE perdiendo casos/.test(txt) ? 'cae' : (/CIEGO: sin el módulo la cobaya NO pierde/.test(txt) ? 'ciego4' : 'pasa');
    return { estado: cayo, sin: sin.map((f) => f.faltan), con: con.map((f) => f.faltan), codigos: [...sin, ...con].map((f) => f.codigo) };
  }
  if (/SCRUM-1405c · ④[^\n]*# SKIP|﹣ SCRUM-1405c · ④/.test(txt)) return { estado: 'saltado' };
  if (/SCRUM-1405c · ④/.test(txt)) return { estado: 'sin-lista' };
  return { estado: 'ausente' };
}

function controles() {
  const ok = (c, d) => { if (!c) { console.error('🔴 CONTROL FALLA:', d); process.exit(2); } };
  const fila = (f) => JSON.stringify(f.map((x) => ({ codigo: 0, informados: 320 - x, faltan: x })));
  // ① positivo sembrado, caso que pasa (diagnóstico del spec con prefijo de hora del runner)
  const a = leer(`2026-10-20T10:00:00.1Z ℹ SCRUM-1405c · sin el módulo: ${fila([14, 10, 27, 31])} · con el módulo: ${fila([0, 0, 0, 0])}\n`);
  ok(a.estado === 'pasa' && a.sin.join() === '14,10,27,31' && a.con.join() === '0,0,0,0', 'positivo pasa ' + JSON.stringify(a));
  // ② positivo sembrado, caso que cae
  const b = leer(`x 🔴 con el módulo la cobaya SIGUE perdiendo casos: la salida C no basta. sin el módulo: ${fila([5, 6, 7, 8])} · con el módulo: ${fila([0, 13, 0, 0])}\n`);
  ok(b.estado === 'cae' && b.con.join() === '0,13,0,0', 'positivo cae ' + JSON.stringify(b));
  // ③ ciego: el caso nombrado sin lista; y un log sin el caso
  ok(leer('✔ SCRUM-1405c · ④ 🔴 EL ROJO PRIMERO (3ms)\n').estado === 'sin-lista', 'sin-lista');
  ok(leer('ℹ tests 11982\n').estado === 'ausente', 'ausente');
  console.log('CONTROLES · 4 de 4 en su sitio (pasa, cae, sin-lista, ausente)');
}

async function main() {
  if (process.argv[2] === '--controles') return controles();
  if (process.argv[2] === '--log') { const t = fs.readFileSync(process.argv[3], 'utf8'); return console.log(Buffer.byteLength(t), JSON.stringify(leer(t))); }
  controles();
  const [, , desde = '2026-10-14T07:48:00Z', dir, salida] = process.argv;
  if (!dir) throw new Error('falta <dirLogs>');
  fs.mkdirSync(dir, { recursive: true });
  const runs = [];
  for (let page = 1; ; page++) {
    const r = JSON.parse(await gh(['api', `repos/${REPO}/actions/workflows/ci.yml/runs?per_page=100&page=${page}&created=>=${desde}`]));
    runs.push(...r.workflow_runs);
    if (r.workflow_runs.length < 100) { if (runs.length !== r.total_count) console.log(`⚠️ total_count ${r.total_count} ≠ leídos ${runs.length}`); break; }
  }
  const pob = { runs: runs.length, sinObligatorio: 0, enCurso: 0, cancelado: 0, otro: 0, medibles: 0, logNo: 0 };
  const filas = [];
  const cola = [];
  for (const r of runs) {
    cola.push(async () => {
      const jobs = JSON.parse(await gh(['api', `repos/${REPO}/actions/runs/${r.id}/jobs?per_page=100`])).jobs;
      const ob = jobs.find((j) => j.name.startsWith('build + tests'));
      if (!ob) { pob.sinObligatorio++; return; }
      if (ob.status !== 'completed') { pob.enCurso++; return; }
      if (ob.conclusion === 'cancelled') { pob.cancelado++; return; }
      if (ob.conclusion !== 'success' && ob.conclusion !== 'failure') { pob.otro++; return; }
      pob.medibles++;
      const f = path.join(dir, `${ob.id}.log`);
      let txt;
      try {
        if (!fs.existsSync(f)) fs.writeFileSync(f, await gh(['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${ob.id}/logs`]));
        txt = fs.readFileSync(f, 'utf8');
      } catch (e) { pob.logNo++; filas.push({ run: r.id, job: ob.id, cuando: r.created_at, evento: r.event, rama: r.head_branch, sha: r.head_sha, ob: ob.conclusion, bytes: 0, estado: 'LOG-NO-BAJADO' }); return; }
      filas.push({ run: r.id, job: ob.id, cuando: r.created_at, evento: r.event, rama: r.head_branch, sha: r.head_sha, ob: ob.conclusion, bytes: Buffer.byteLength(txt), ...leer(txt) });
    });
  }
  let i = 0, hechos = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (i < cola.length) { await cola[i++](); if (++hechos % 50 === 0) console.log(`… ${hechos}/${cola.length}`); } }));
  filas.sort((a, b) => a.cuando.localeCompare(b.cuando));
  const tsv = ['cuando\trun\tjob\tevento\trama\tsha\tobligatorio\tbytes\testado\tsin\tcon',
    ...filas.map((f) => [f.cuando, f.run, f.job, f.evento, f.rama, f.sha, f.ob, f.bytes, f.estado, (f.sin || []).join(','), (f.con || []).join(',')].join('\t'))].join('\n') + '\n';
  if (salida) fs.writeFileSync(salida, tsv);
  console.log('POBLACIÓN', JSON.stringify(pob));
  console.log('ventana', runs.at(-1)?.created_at, '→', runs[0]?.created_at);
  const por = {};
  for (const f of filas) por[f.estado] = (por[f.estado] || 0) + 1;
  console.log('ESTADOS', JSON.stringify(por));
}
main().catch((e) => { console.error(e); process.exit(1); });
