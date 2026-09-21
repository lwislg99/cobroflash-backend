// SCRUM-963 · ¿cuánta holgura le queda a la ÚNICA puerta real, «build + tests»?
// Su techo es `timeout-minutes: 10`, el mismo tipo de techo fijo que SCRUM-935 acaba de demostrar
// que se cruza solo. Si vamos a apoyarnos en esa puerta, hay que saber a cuánto pasa del techo.
// Sólo lee la API. Declara población y distingue «no pude mirar» de «no hay».
import { spawnSync } from 'node:child_process';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';
const PUERTA = 'build + tests (con banco desechable)';
const TECHO_MIN = 10;

const gh = (args) => spawnSync(GH, args, { encoding: 'utf8', maxBuffer: 32e6 });

const r = gh(['api', `repos/${REPO}/actions/workflows/ci.yml/runs?per_page=100`,
  '--jq', '.workflow_runs[] | [.id, .event, .created_at] | @tsv']);
if (r.status !== 0) { console.error('🔴 NO PUDE MIRAR: ' + r.stderr); process.exit(2); }
const runs = String(r.stdout).split('\n').map((s) => s.trim()).filter(Boolean).map((l) => l.split('\t'));

const durs = [];
let ciegos = 0, sinPuerta = 0;
for (const [id, evento] of runs) {
  const j = gh(['api', `repos/${REPO}/actions/runs/${id}/jobs`,
    '--jq', `.jobs[] | select(.name == "${PUERTA}") | [.conclusion, .started_at, .completed_at] | @tsv`]);
  if (j.status !== 0) { ciegos++; continue; }
  const l = String(j.stdout).trim();
  if (!l) { sinPuerta++; continue; }
  const [conclusion, ini, fin] = l.split('\t');
  if (!ini || !fin) { sinPuerta++; continue; }
  durs.push({ id, evento, conclusion, seg: (Date.parse(fin) - Date.parse(ini)) / 1000 });
}

const ord = durs.map((d) => d.seg).sort((a, b) => a - b);
const pct = (p) => ord.length ? ord[Math.min(ord.length - 1, Math.floor(ord.length * p))] : NaN;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

console.log(`POBLACIÓN · ${runs.length} runs de ci.yml mirados · ${durs.length} con la puerta medida · ` +
  `${sinPuerta} sin ese job · ${ciegos} NO PUDE MIRAR`);
console.log(`duración de «${PUERTA}» (techo ${TECHO_MIN} min):`);
console.log(`   p50 ${mmss(pct(0.5))} · p95 ${mmss(pct(0.95))} · máx ${mmss(ord[ord.length - 1] ?? NaN)}`);
const cerca = durs.filter((d) => d.seg > TECHO_MIN * 60 * 0.8);
console.log(`   por encima del 80 % del techo (8 min): ${cerca.length} de ${durs.length}`);
for (const d of cerca.sort((a, b) => b.seg - a.seg).slice(0, 8)) console.log(`      ${d.id} · ${d.evento} · ${mmss(d.seg)} · ${d.conclusion}`);
const conteo = {};
for (const d of durs) conteo[d.conclusion] = (conteo[d.conclusion] || 0) + 1;
console.log('   conclusiones: ' + Object.entries(conteo).map(([k, v]) => `${k} ${v}`).join(' · '));
