// SCRUM-935 · DES-CENSURAR la distribución del job meta-guard.
// Los cancelados por timeout están censurados a la derecha (murieron a los 600 s sin decir
// cuánto les faltaba). El log imprime UNA LÍNEA POR MUTACIÓN con su hora, y el censo final dice
// cuántas mediciones son en total. Con las dos cosas se proyecta lo que habría durado.
//
// Uso: node analizar-logs.mjs <entrada.json> <carpeta-cache> <max-cancelados>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';

const entrada = process.argv[2];
const cache = process.argv[3];
const maxCancel = Number(process.argv[4] || 20);
fs.mkdirSync(cache, { recursive: true });

const datos = JSON.parse(fs.readFileSync(entrada, 'utf8'));
const conJob = datos.filas.filter((f) => f.seg != null && f.jobId);

const acabados = conJob.filter((f) => f.jobConcl === 'success' || f.jobConcl === 'failure');
const techo = conJob.filter((f) => f.jobConcl === 'cancelled' && f.seg >= 600);
// muestra repartida por toda la ventana, no los N primeros
const paso = Math.max(1, Math.floor(techo.length / maxCancel));
const muestraTecho = techo.filter((_, i) => i % paso === 0).slice(0, maxCancel);

const elegidos = [...acabados, ...muestraTecho];
console.log(`POBLACIÓN · runs con job medible ${conJob.length} · acabados (success/failure) ${acabados.length} · cancelados EN EL TECHO (≥600 s) ${techo.length}`);
console.log(`MUESTRA que se baja: ${elegidos.length} logs (${acabados.length} acabados + ${muestraTecho.length} del techo, 1 de cada ${paso})`);

function log(f) {
  const fichero = path.join(cache, `job-${f.jobId}.txt`);
  if (fs.existsSync(fichero) && fs.statSync(fichero).size > 0) return fs.readFileSync(fichero, 'utf8');
  const txt = execFileSync(GH, ['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${f.jobId}/logs`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  fs.writeFileSync(fichero, txt);
  return txt;
}

const RES = /^(\S+Z) {2,}[✔✘]\s/u;
const CENSO = /árbol VIGILADO durante las (\d+) mediciones/;
const ARRANQUE = /Run npm run meta:mutaciones/;

const filas = [];
let ciegos = 0;
for (const f of elegidos) {
  let txt;
  try { txt = log(f); } catch (e) { ciegos++; filas.push({ ...f, ciego: 'no pude bajar el log' }); continue; }
  const lineas = txt.split(/\r?\n/);
  let tArranque = null, tPrimera = null, tUltima = null, hechas = 0, total = null;
  for (const l of lineas) {
    if (tArranque == null && ARRANQUE.test(l)) {
      const m = l.match(/^(\S+Z)/); if (m) tArranque = Date.parse(m[1]);
    }
    const r = l.match(RES);
    if (r) { const t = Date.parse(r[1]); if (tPrimera == null) tPrimera = t; tUltima = t; hechas++; continue; }
    const c = l.match(CENSO);
    if (c) total = Number(c[1]);
  }
  if (!hechas) { ciegos++; filas.push({ ...f, ciego: 'ninguna línea de mutación en el log' }); continue; }
  const faseSeg = (tUltima - tPrimera) / 1000;
  const ritmo = hechas > 1 ? faseSeg / (hechas - 1) : null;
  const previo = tArranque != null ? (tPrimera - tArranque) / 1000 : null;
  filas.push({
    run: f.run, rama: f.rama, evento: f.evento, creado: f.creado, concl: f.jobConcl,
    seg: f.seg, hechas, total, ritmo, faseSeg, previo,
  });
}

const fmt = (s) => s == null ? '     —' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const acabadasOK = filas.filter((f) => !f.ciego && f.total != null);
console.log(`\nCIEGOS: ${ciegos} de ${elegidos.length}`);

console.log('\n① PASADAS QUE LLEGARON AL FINAL (duración REAL, sin censurar)');
console.log('  dur.job  mutaciones  s/mutación  rama · run');
for (const f of acabadasOK.sort((a, b) => a.seg - b.seg)) {
  console.log(`  ${fmt(f.seg).padStart(7)}  ${String(f.hechas).padStart(4)}/${String(f.total).padEnd(4)}  ${f.ritmo.toFixed(2).padStart(9)}  ${f.rama} · ${f.run} · ${f.creado.slice(0, 16)} · ${f.concl}`);
}

const cortadas = filas.filter((f) => !f.ciego && f.total == null);
console.log('\n② PASADAS CORTADAS POR EL TECHO — proyección de lo que habrían durado');
console.log('  (proyección = tiempo antes de la 1ª mutación + TOTAL × s/mutación de esa misma pasada)');
console.log('  dur.job  hechas  s/mutación  proyectado  rama · run');
const NREF = Math.max(...acabadasOK.map((f) => f.total));
const proyecciones = [];
for (const f of cortadas.sort((a, b) => a.creado.localeCompare(b.creado))) {
  const proy = f.ritmo != null ? (f.previo ?? 0) + NREF * f.ritmo + (f.seg - (f.previo ?? 0) - f.faseSeg) : null;
  if (proy != null) proyecciones.push(proy);
  console.log(`  ${fmt(f.seg).padStart(7)}  ${String(f.hechas).padStart(6)}  ${(f.ritmo ?? 0).toFixed(2).padStart(9)}  ${fmt(proy).padStart(10)}  ${f.rama} · ${f.run} · ${f.creado.slice(0, 16)}`);
}
console.log(`  (TOTAL de referencia usado para proyectar: ${NREF} mutaciones, el censo de las pasadas que sí acabaron)`);

if (proyecciones.length) {
  const v = [...proyecciones].sort((a, b) => a - b);
  console.log(`\n③ DISTRIBUCIÓN COMPLETA (reales + proyectadas), n=${acabadasOK.length + v.length}`);
  const todas = [...acabadasOK.map((f) => f.seg), ...v].sort((a, b) => a - b);
  const q = (p) => todas[Math.min(todas.length - 1, Math.floor(p * todas.length))];
  console.log(`  mín ${fmt(todas[0])} · p50 ${fmt(q(0.5))} · p90 ${fmt(q(0.9))} · p95 ${fmt(q(0.95))} · máx ${fmt(todas[todas.length - 1])}`);
  const ritmos = [...acabadasOK, ...cortadas].filter((f) => f.ritmo).map((f) => f.ritmo).sort((a, b) => a - b);
  console.log(`  s/mutación: mín ${ritmos[0].toFixed(2)} · p50 ${ritmos[Math.floor(ritmos.length / 2)].toFixed(2)} · máx ${ritmos[ritmos.length - 1].toFixed(2)} (n=${ritmos.length})`);
  console.log(`  ⇒ el runner más lento tarda un ${((ritmos[ritmos.length - 1] / ritmos[0] - 1) * 100).toFixed(0)} % más que el más rápido por la MISMA población de mutaciones`);
  console.log(`  ⇒ cada mutación declarada nueva cuesta ~${ritmos[Math.floor(ritmos.length / 2)].toFixed(1)} s a TODOS los PR, para siempre`);
}
console.log('EXIT=0');
