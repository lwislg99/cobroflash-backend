import fs from 'node:fs';
const SP = process.argv[2];
const j = JSON.parse(fs.readFileSync(SP + '/runs1.json', 'utf8'));
const runs = j.workflow_runs;
console.log('total_count declarado por la API:', j.total_count);
console.log('runs traidos en esta pagina:', runs.length);
const MERGE_866 = '2026-09-17T08:35:37Z';
const MERGE_908 = '2026-09-17T14:20:05Z';
const desde = (t) => runs.filter((r) => r.created_at >= t);
for (const [nombre, t] of [['DESDE merge 866 (08:35:37Z)', MERGE_866], ['DESDE merge 908 (14:20:05Z)', MERGE_908]]) {
  const pop = desde(t);
  const por = {};
  for (const r of pop) {
    const k = r.status === 'completed' ? r.conclusion : 'EN CURSO (' + r.status + ')';
    por[k] = (por[k] || 0) + 1;
  }
  console.log('\n== ' + nombre + ' == N=' + pop.length);
  for (const [k, v] of Object.entries(por).sort((a, b) => b[1] - a[1])) console.log('   ' + k.padEnd(22) + v);
  const fallos = pop.filter((r) => r.conclusion === 'failure');
  console.log('   -- los ' + fallos.length + ' failure:');
  for (const r of fallos) console.log('      ' + r.id + '  ' + r.created_at + '  head ' + r.head_sha.slice(0, 8) + '  ' + (r.head_branch || '').slice(0, 42));
}
const mas_viejo = runs[runs.length - 1];
console.log('\nel mas viejo de la pagina:', mas_viejo.created_at, '(si es > 08:35:37Z, la pagina NO cubre la ventana entera)');
