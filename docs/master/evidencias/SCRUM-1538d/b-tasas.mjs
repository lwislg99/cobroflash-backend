#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1538d/b-tasas.mjs — SCRUM-1538d · SÓLO LECTURA (ficheros locales + git local).
//
// Dos preguntas que `a-cabeceras.mjs` deja abiertas:
//   ① ¿«0 desde el corte» es un cambio, o cabe en el azar? Tasa de colgadas ANTES del corte sobre TODA la
//      población del listado (6-oct → corte), y la racha más larga SIN colgadas que ya hubo antes del corte,
//      medida en jobs. Si después del corte hay más jobs limpios seguidos que en cualquier racha anterior, el
//      silencio no lo explica el azar con la tasa de antes.
//   ② ¿Qué entró en main entre la última base que colgó y las primeras bases limpias? Los commits de primer
//      padre de main desde la base de la última colgada de la TANDA (la más vieja de las dos), con la hora y
//      los ficheros que tocan entre los sitios candidatos.
//
//   node b-tasas.mjs <carpeta del listado, con a-jobs-con-cabecera.tsv> [--sin-siembra]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [carpeta, ...banderas] = process.argv.slice(2);
if (!carpeta) { console.error('uso: node b-tasas.mjs <carpeta> [--sin-siembra]'); process.exit(2); }
const CORTE = '2026-10-14T09:00:00Z';
const TECHO_TRINQUETE = 2400;
const TANDA_COLGADA = new Set(['112435237313', '112906403918', '113216097886', '115064831385', '115068271610',
  '115134364145', '115290677611', '115305001172', '115728094402', '115735116377']);
const p = (s) => console.log(s);

// racha más larga de LIMPIAS seguidas en una lista ordenada de estados
export function rachaMaxima(estados) { let m = 0; let c = 0; for (const e of estados) { if (e === 'LIMPIA') { c++; if (c > m) m = c; } else c = 0; } return m; }
const siembras = [
  ['racha fabricada', () => rachaMaxima(['LIMPIA', 'COLGADA', 'LIMPIA', 'LIMPIA', 'LIMPIA', 'COLGADA', 'LIMPIA']) === 3],
  ['sin limpias, racha 0', () => rachaMaxima(['COLGADA', 'COLGADA']) === 0],
];
let ok = 0;
for (const [n, f] of siembras) { const b = !banderas.includes('--sin-siembra') && f(); p(`SIEMBRA ${b ? 'OK  ' : 'FALLA'} ${n}`); if (b) ok++; }
if (ok !== siembras.length) { p(`CIEGO · siembra ${ok} de ${siembras.length}`); process.exit(4); }

// ── ① población entera: jobs pedidos (runs no limpios) + 1 job por familia de cada run limpio ─────────
const runs = JSON.parse(fs.readFileSync(path.join(carpeta, 'e-runs.json'), 'utf8'));
const tsv = fs.readFileSync(path.join(carpeta, 'e-jobs.tsv'), 'utf8').trim().split('\n');
const cab = tsv[0].split('\t');
const jobs = tsv.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v])));
const familia = (n) => (n.startsWith('trinquete') ? 'trinquete' : n.startsWith('build + tests') ? 'tanda' : null);
const estado = (j) => {
  const f = familia(j.nombre);
  if (j.status !== 'completed') return null;
  if (f === 'trinquete') return j.conclusion === 'cancelled' ? (Number(j.segundos) >= TECHO_TRINQUETE ? 'COLGADA' : null) : ['success', 'failure'].includes(j.conclusion) ? 'LIMPIA' : null;
  if (f === 'tanda') return TANDA_COLGADA.has(j.job) ? 'COLGADA' : ['success', 'failure'].includes(j.conclusion) ? 'LIMPIA' : null;
  return null;
};
const limpios = runs.filter((r) => r.status === 'completed' && r.conclusion === 'success' && r.intento === 1);
// un run limpio aporta un job verde de cada familia (los 6 jobs del CI salen en success); se ordena por la hora del run
const filas = [];
for (const j of jobs) { const e = estado(j); const f = familia(j.nombre); if (e && f) filas.push({ f, e, t: j.creado }); }
for (const r of limpios) for (const f of ['trinquete', 'tanda']) filas.push({ f, e: 'LIMPIA', t: r.creado, limpio: true });

p(`POBLACIÓN · runs ${runs.length} · limpios (1 job por familia, sin pedir) ${limpios.length} · jobs pedidos ${jobs.length}`);
for (const f of ['trinquete', 'tanda']) {
  const F = filas.filter((x) => x.f === f).sort((a, b) => a.t.localeCompare(b.t));
  const antes = F.filter((x) => x.t < CORTE); const tras = F.filter((x) => x.t >= CORTE);
  const cA = antes.filter((x) => x.e === 'COLGADA').length; const cT = tras.filter((x) => x.e === 'COLGADA').length;
  const tasa = cA / antes.length;
  const prob = Math.pow(1 - tasa, tras.length);
  p(`\n══ ${f.toUpperCase()} · ${F.length} jobs con veredicto o colgados`);
  p(`  antes del corte: ${cA} colgadas de ${antes.length} (${(100 * tasa).toFixed(1)} %) · después: ${cT} de ${tras.length}`);
  p(`  si la tasa de antes siguiera, la probabilidad de ver 0 en ${tras.length} es ${prob.toExponential(1)}`);
  // la tasa no es una: 6-9 oct y 13-oct → corte (del 10 al 12 no hay CI). Se repite con la MÁS BAJA, que es la que menos dice
  const tramo = antes.filter((x) => x.t >= '2026-10-13T00:00:00Z');
  const cR = tramo.filter((x) => x.e === 'COLGADA').length; const tR = cR / tramo.length;
  p(`  sólo 13-oct → corte: ${cR} de ${tramo.length} (${(100 * tR).toFixed(1)} %) · con esa tasa, ver 0 en ${tras.length} tiene probabilidad ${Math.pow(1 - tR, tras.length).toExponential(1)}`);
  p(`  racha más larga SIN colgada antes del corte: ${rachaMaxima(antes.map((x) => x.e))} jobs · después del corte: ${rachaMaxima(tras.map((x) => x.e))}`);
  // rachas antes del corte, con fechas, para ver la pausa del 8 al 13-oct
  let ini = null; let n = 0; const rachas = [];
  for (const x of antes) { if (x.e === 'LIMPIA') { if (!n) ini = x.t; n++; } else { if (n) rachas.push([n, ini, x.t]); n = 0; } }
  if (n) rachas.push([n, ini, CORTE + ' (corte)']);
  for (const [k, a, b] of rachas.sort((x, y) => y[0] - x[0]).slice(0, 3)) p(`    racha de ${k} limpias · de ${a} hasta la colgada de ${b}`);
  // por día
  const dia = {};
  for (const x of F) { const d = x.t.slice(0, 10); dia[d] ??= [0, 0]; dia[d][0]++; if (x.e === 'COLGADA') dia[d][1]++; }
  p('  por día (jobs · colgadas): ' + Object.entries(dia).map(([d, [a, b]]) => `${d.slice(5)} ${a}·${b}`).join(' | '));
}

// ── ② qué entró en main desde la base de la última colgada de la tanda ─────────────────────────────
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
const CANDIDATOS = [/^\.github\//, /^package(-lock)?\.json$/, /^scripts\/(tanda|trinquete|_tanda|_trinquete)/, /^tests\/scrum44[67]-/, /^tests\/scrum61[56]-/, /^tests\/scrum813-/, /^tests\/_/, /^scripts\/_/, /^\.nvmrc$/, /^\.node-version$/];
const DESDE_BASE = '6c5b3ad61';   // base de la última colgada de la tanda (a-salida.txt)
const BASE_TRINQ = 'ebe2b932c';   // base de la última colgada del trinquete
const lista = git('rev-list', '--first-parent', '--reverse', `${DESDE_BASE}..origin/main`, '--since=2026-10-14T00:00:00Z', '--until=2026-10-14T16:00:00Z').split('\n').filter(Boolean);
p(`\n② main de primer padre DESPUÉS de ${DESDE_BASE} (última base colgada de la tanda) y hasta las 16:00Z del 14-oct: ${lista.length} commits`);
p(`   (· = ninguno de sus ficheros está entre los candidatos; ⇒ = ésta es la base de la última colgada del trinquete)`);
for (const s of lista) {
  const [h, fecha, ...asunto] = git('show', '-s', '--format=%h%x09%cI%x09%s', s).split('\t');
  const fic = git('diff', '--name-only', `${s}^1`, s).split('\n').filter(Boolean);
  const cand = fic.filter((f) => CANDIDATOS.some((re) => re.test(f)));
  p(`${s.startsWith(git('rev-parse', BASE_TRINQ)) ? '⇒' : ' '} ${h} ${fecha} · ${asunto.join(' ').slice(0, 60)} · ${fic.length} ficheros${cand.length ? ' · CANDIDATOS: ' + cand.join(', ') : ' ·'}`);
}
p('\nEXIT=0');
