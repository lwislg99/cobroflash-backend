// docs/master/evidencias/SCRUM-1539/pr-cerrados-sin-mergear.mjs — SCRUM-1539
//
// ¿Se ha borrado ya alguna rama con obra que no está en main? Esto NO lo contesta: da el TECHO.
// Cuenta los PR CERRADOS SIN MERGEAR cuya rama ya no existe en el remoto, y de cada uno mira si su
// última punta está en main. Un PR así puede haberse cerrado a mano, por un borrado deliberado o
// por `ramas-borrables.mjs --ejecutar`: GitHub no dice cuál, así que la causa queda SIN ATRIBUIR.
// Sólo lee: una consulta a `gh`, una lectura del remoto y dos órdenes locales de git por PR.
import { spawnSync } from 'node:child_process';

const corre = (orden, args) => spawnSync(orden, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const LIMITE = 3000;
const gh = corre('gh', ['pr', 'list', '--state', 'closed', '--limit', String(LIMITE),
  '--json', 'number,mergedAt,closedAt,headRefName,headRefOid']);
if (gh.status !== 0) { console.log(`🔴 CIEGO: gh salió ${gh.status}: ${(gh.stderr || '').slice(0, 200)}`); process.exit(3); }
const prs = JSON.parse(gh.stdout);
const ls = corre('git', ['ls-remote', '--heads', 'origin']);
if (ls.status !== 0) { console.log('🔴 CIEGO: ls-remote no contestó'); process.exit(3); }
const vivas = new Set(ls.stdout.split('\n').filter(Boolean).map((l) => l.split(/\s+/)[1].replace('refs/heads/', '')));

const mergeados = prs.filter((p) => p.mergedAt);
const sinMergear = prs.filter((p) => !p.mergedAt);
const sinRama = sinMergear.filter((p) => !vivas.has(p.headRefName));
const cubos = { 'punta EN main': [], 'punta FUERA de main': [], 'punta que no está en este almacén (no se puede mirar)': [] };
for (const p of sinRama) {
  if (corre('git', ['cat-file', '-e', `${p.headRefOid}^{commit}`]).status !== 0) { cubos['punta que no está en este almacén (no se puede mirar)'].push(p); continue; }
  const a = corre('git', ['merge-base', '--is-ancestor', p.headRefOid, 'origin/main']).status;
  cubos[a === 0 ? 'punta EN main' : 'punta FUERA de main'].push(p);
}
const fechas = prs.map((p) => p.closedAt).sort();
console.log(`POBLACION: ${prs.length} PR cerrados (límite pedido ${LIMITE}${prs.length === LIMITE ? ' — 🔴 TOPADO: hay más' : ''}) · del ${fechas[0]} al ${fechas.at(-1)}`);
console.log(`  mergeados: ${mergeados.length} · cerrados SIN mergear: ${sinMergear.length} · de esos, con la rama ya borrada: ${sinRama.length}`);
for (const [k, v] of Object.entries(cubos)) console.log(`  ${k}: ${v.length}`);
console.log(`CONTROL: las tres clases suman ${Object.values(cubos).reduce((s, v) => s + v.length, 0)} de ${sinRama.length} · ramas vivas leídas: ${vivas.size} · control positivo, PR mergeados (tiene que ser > 0): ${mergeados.length}`);
for (const p of cubos['punta FUERA de main'].slice(-25)) console.log(`  #${p.number} · ${p.headRefName} · cerrado ${p.closedAt}`);
