// SCRUM-1123f · captura los estados de Railway de commits REALES de `main`, con la MISMA forma que
// compone el paso de aviso de `.github/workflows/vigia-despliegue.yml`:
//   {sha, leido:true, estados:[{context, state, description}]}   (o {sha, leido:false})
//   node capturar-estados.mjs <sha> [<sha> …]   → JSON por stdout
import { execFileSync } from 'node:child_process';
const GH = process.env.GH_BIN || 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = process.env.REPO || 'lwislg99/cobroflash-backend';
const filas = [];
for (const corto of process.argv.slice(2)) {
  let sha = corto;
  try { sha = execFileSync('git', ['rev-parse', corto], { encoding: 'utf8' }).trim(); } catch { /* se queda el corto */ }
  try {
    const r = JSON.parse(execFileSync(GH, ['api', `repos/${REPO}/commits/${sha}/status`], { encoding: 'utf8' }));
    filas.push({ sha, leido: true, estados: r.statuses.map(({ context, state, description }) => ({ context, state, description })) });
  } catch {
    filas.push({ sha, leido: false });
  }
}
console.log(JSON.stringify(filas, null, 1));
