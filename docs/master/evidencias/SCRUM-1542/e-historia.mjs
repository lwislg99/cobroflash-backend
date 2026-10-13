// e-historia.mjs — la historia entera del vigia programado, los Issues de aviso, y su cadencia.
import fs from 'node:fs';
// `gh api --paginate` pega un documento JSON detras de otro: se parten contando llaves fuera de cadenas.
function documentos(txt) {
  const out = []; let prof = 0; let ini = -1; let enCad = false; let esc = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (enCad) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') enCad = false; continue; }
    if (c === '"') { enCad = true; continue; }
    if (c === '{' || c === '[') { if (prof === 0) ini = i; prof++; } else if (c === '}' || c === ']') { prof--; if (prof === 0) out.push(JSON.parse(txt.slice(ini, i + 1))); }
  }
  return out;
}
const pags = documentos(fs.readFileSync('prog-todos.json', 'utf8'));
const runs = pags.flatMap((p) => p.workflow_runs);
console.log(`PROGRAMADO: paginas=${pags.length} declarados=${pags[0].total_count} traidos=${runs.length} del ${runs.at(-1).created_at} al ${runs[0].created_at}`);
const por = {}; for (const r of runs) { const k = r.event + '/' + (r.conclusion || r.status); por[k] = (por[k] || 0) + 1; }
console.log('  por evento/conclusion:', JSON.stringify(por));
const rojos = runs.filter((r) => r.conclusion === 'failure');
const porDia = {}; for (const r of rojos) { const d = r.created_at.slice(0, 10); porDia[d] = (porDia[d] || 0) + 1; }
console.log('  failure por dia:', JSON.stringify(porDia));
console.log('  ultimo failure:', rojos[0] && rojos[0].created_at, rojos[0] && rojos[0].id, '| primero:', rojos.at(-1) && rojos.at(-1).created_at);
fs.writeFileSync('prog-rojos.json', JSON.stringify(rojos.map((r) => ({ id: r.id, creado: r.created_at, evento: r.event, sha: r.head_sha }))));
// cadencia de los `schedule` desde el 6-oct
const sch = runs.filter((r) => r.event === 'schedule' && r.created_at >= '2026-10-06').map((r) => Date.parse(r.created_at)).sort((a, b) => a - b);
const huecos = sch.slice(1).map((t, i) => (t - sch[i]) / 3600000).sort((a, b) => a - b);
console.log(`  CADENCIA desde 6-oct: ejecuciones schedule=${sch.length} (el cron pide 12 al dia) | hueco entre dos: min=${huecos[0].toFixed(1)} h mediana=${huecos[Math.floor(huecos.length / 2)].toFixed(1)} h max=${huecos.at(-1).toFixed(1)} h | huecos de mas de 6 h: ${huecos.filter((h) => h > 6).length} de ${huecos.length}`);
// cadencia de toda la historia
const schT = runs.filter((r) => r.event === 'schedule').map((r) => Date.parse(r.created_at)).sort((a, b) => a - b);
const dias = (schT.at(-1) - schT[0]) / 86400000;
console.log(`  CADENCIA historia: ${schT.length} en ${dias.toFixed(1)} dias = ${(schT.length / dias).toFixed(1)} al dia`);

const iss = documentos(fs.readFileSync('issues.json', 'utf8')).flat();
const MARCA = '<!-- vigia-despliegue:produccion-congelada -->';
const soloIssues = iss.filter((i) => !i.pull_request);
const conMarca = iss.filter((i) => String(i.body || '').includes(MARCA));
const porTitulo = soloIssues.filter((i) => /congelada|vig[ií]a del despliegue/i.test(i.title));
console.log(`ISSUES: filas=${iss.length} (issues=${soloIssues.length}, PR=${iss.length - soloIssues.length}) con-la-marca=${conMarca.length} por-titulo=${porTitulo.length}`);
console.log('  CONTROL POSITIVO (issues cualesquiera, tiene que ser >0):', soloIssues.length, '| CONTROL CERO (marca al reves):', iss.filter((i) => String(i.body || '').includes(MARCA.split('').reverse().join(''))).length);
for (const i of [...new Set([...conMarca, ...porTitulo])]) console.log('  #' + i.number, i.state, i.created_at, 'cerrado=' + i.closed_at, 'coment=' + i.comments, i.user.login, '|', i.title, i.pull_request ? '(PR)' : '');
