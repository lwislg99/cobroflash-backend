// docs/master/evidencias/SCRUM-1527/s3-reproduce-hoy.mjs — SCRUM-1527d · ¿se sigue colgando el obligatorio?
//
//     node docs/master/evidencias/SCRUM-1527/s3-reproduce-hoy.mjs <desdeISO> <carpetaDeLogs> [corteISO]
//
// QUÉ MIDE. Desde <desdeISO>, todos los jobs «build + tests» de `ci.yml` (con reintentos), la duración
// y el veredicto de su paso «Tests», y en los candidatos (paso «Tests» de 600 s o más, o job
// cancelado tras llegar a ese paso) baja el log y busca «TANDA SIN VEREDICTO». Con [corteISO] parte
// la cuenta en antes / después (p. ej. el merge de #2429, SCRUM-1405c).
// El filtro de duración es el de SCRUM-1527b ①: entre 600 y 900 s no había ninguno.
//
// CONTROL POSITIVO: si la ventana empieza antes del 13-oct 05:07Z, el job 115134364145 (colgado
// conocido, #2350) TIENE que salir. Si no sale, el instrumento no vale y sale 2.
//
// Sale 0 si pudo medir; 2 si algún control falla o alguna consulta no contestó.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [desde, carpeta, corte] = process.argv.slice(2);
if (!desde || !carpeta) { console.error('uso: s3-reproduce-hoy.mjs <desdeISO> <carpetaDeLogs> [corteISO]'); process.exit(2); }
mkdirSync(carpeta, { recursive: true });
const GH = process.platform === 'win32' ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';
const REPO = 'repos/lwislg99/cobroflash-backend';
const api = (ruta) => JSON.parse(execFileSync(GH, ['api', ruta], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }));
const fallos = [];
const RAIZ = join(import.meta.dirname, '..', '..', '..', '..');
const TESTS = readdirSync(join(RAIZ, 'tests')).filter((n) => n.endsWith('.test.mjs')).map((n) => [n, readFileSync(join(RAIZ, 'tests', n), 'utf8')]);
/** El fichero de tests/ que contiene el nombre de ese caso (por los primeros 40 caracteres, que
 *  son literales en el fuente aunque el nombre lleve una plantilla más adelante). */
function ficheroDelCaso(nombre) {
  const trozo = nombre.slice(0, 40);
  const hay = TESTS.filter(([, s]) => s.includes(trozo)).map(([n]) => n);
  return hay.length === 1 ? hay[0] : hay.length ? `${hay.length} ficheros: ${hay.slice(0, 3).join(', ')}` : null;
}

// ① Las ejecuciones de la ventana (paginado hasta agotar). Con --de-cache se reutiliza el
// jobs.json de una pasada anterior en la misma carpeta (la lista es lo lento: un gh api por run).
const DE_CACHE = process.argv.includes('--de-cache') && existsSync(join(carpeta, 'jobs.json'));
const runs = [];
for (let p = 1; p < 50 && !DE_CACHE; p++) {
  const r = api(`${REPO}/actions/workflows/ci.yml/runs?created=%3E%3D${encodeURIComponent(desde)}&per_page=100&page=${p}`);
  runs.push(...r.workflow_runs);
  if (r.workflow_runs.length < 100) { if (runs.length !== r.total_count) fallos.push(`runs: leídos ${runs.length}, GitHub declara ${r.total_count}`); break; }
}

// ② Sus jobs obligatorios, con reintentos.
const jobs = DE_CACHE ? JSON.parse(readFileSync(join(carpeta, 'jobs.json'), 'utf8')).filter((x) => Date.parse(x.creado) >= Date.parse(desde)) : [];
if (DE_CACHE) for (const r of new Set(jobs.map((x) => x.run))) runs.push({ id: r });
for (const run of DE_CACHE ? [] : runs) {
  const j = api(`${REPO}/actions/runs/${run.id}/jobs?filter=all&per_page=100`);
  for (const job of j.jobs) {
    if (!job.name.startsWith('build + tests')) continue;
    const paso = (job.steps ?? []).find((s) => s.name.startsWith('Tests'));
    const dur = paso?.started_at && paso?.completed_at ? (Date.parse(paso.completed_at) - Date.parse(paso.started_at)) / 1000 : null;
    jobs.push({ job: job.id, run: run.id, evento: run.event, rama: run.head_branch, sha: run.head_sha, creado: run.created_at,
      conclusion: job.conclusion, status: job.status, paso: paso?.conclusion ?? null, dur });
  }
}

// ③ Los candidatos, y su log.
const candidatos = jobs.filter((x) => (x.dur !== null && x.dur >= 600) || (x.conclusion === 'cancelled' && x.paso !== null && x.dur !== null && x.dur >= 600));
const POSITIVO = 115134364145;
const enVentana = Date.parse(desde) <= Date.parse('2026-10-13T05:07:16Z');
for (const c of candidatos) {
  const f = join(carpeta, `job${c.job}.log`);
  if (!existsSync(f) || statSync(f).size < 1000) {
    try { writeFileSync(f, execFileSync(GH, ['api', '--allow-escape-sequences', `${REPO}/actions/jobs/${c.job}/logs`], { maxBuffer: 256 * 1024 * 1024 })); } catch { /* se cuenta abajo */ }
  }
  c.bytes = existsSync(f) ? statSync(f).size : 0;
  if (c.bytes < 1000) { fallos.push(`log del job ${c.job}: ${c.bytes} B, no es un log`); c.aviso = null; continue; }
  const t = readFileSync(f, 'utf8');
  c.aviso = /TANDA SIN VEREDICTO/.test(t);
  const m = [...t.matchAll(/✔ .*\((\d+(?:\.\d+)?)ms\)\s*$/gm)];
  c.pasan = m.length;
  // El último caso que llegó lo dice el propio aviso («Lo último que llegó: «✔ <nombre> (Nms)»»), y
  // el fichero se busca por ese NOMBRE entre los tests/*.test.mjs del árbol desde el que se lanza.
  // (La primera versión tomaba el último `scrumNNN` del texto, y daba `scrum402` donde el aviso
  // decía SCRUM-615: un nombre que aparece en el log no es el fichero que entregó.)
  const m2 = t.match(/Lo último que llegó: «[✔✖﹣]\s*(.+?) \(\d+(?:\.\d+)?ms\)/);
  c.ultimoCaso = m2 ? m2[1] : null;
  c.ultimo = c.aviso ? (m2 ? (ficheroDelCaso(m2[1]) ?? 'no encontrado en este árbol') : 'el aviso no dice el caso') : '-';
}
if (enVentana && !candidatos.some((c) => c.job === POSITIVO && c.aviso)) fallos.push(`control positivo: el colgado conocido ${POSITIVO} no sale con su aviso`);

// ④ La salida.
const porConclusion = {};
for (const j of jobs) porConclusion[j.conclusion ?? j.status] = (porConclusion[j.conclusion ?? j.status] ?? 0) + 1;
const tramo = (x) => (corte && Date.parse(x.creado) >= Date.parse(corte) ? 'después' : 'antes');
console.log(`SCRUM-1527d · ¿se sigue colgando? · ventana desde ${desde}${corte ? ` · corte ${corte}` : ''}`);
console.log(`población: ${DE_CACHE ? `${runs.length} ejecuciones CON job obligatorio (de la caché jobs.json; la lista entera de ci.yml no se relee)` : `${runs.length} ejecuciones de ci.yml`} ·${jobs.length} jobs «build + tests» con reintentos · ${Object.entries(porConclusion).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
const llegan = jobs.filter((j) => j.paso !== null);
for (const t of corte ? ['antes', 'después'] : ['antes']) {
  const js = llegan.filter((j) => tramo(j) === t);
  const colg = candidatos.filter((c) => c.aviso && tramo(c) === t);
  console.log(`${corte ? `${t} del corte: ` : ''}${js.length} jobs con paso «Tests» · ${js.filter((j) => j.paso === 'success').length} en success · ${colg.length} con «TANDA SIN VEREDICTO»`);
}
console.log(`candidatos (paso «Tests» de 600 s o más): ${candidatos.length}`);
for (const c of candidatos) console.log(`   job ${c.job} · ${c.creado} · ${c.evento} · ${c.rama} · paso ${c.paso} en ${c.dur} s · ${c.bytes} B · aviso ${c.aviso ? 'SÍ' : 'no'} · pasan ${c.pasan} · lo último que llegó: ${c.ultimoCaso ? `«${c.ultimoCaso.slice(0, 60)}» → ${c.ultimo}` : c.ultimo}`);
console.log(`control positivo (${POSITIVO}): ${enVentana ? (candidatos.some((c) => c.job === POSITIVO && c.aviso) ? 'sale, con su aviso' : 'NO SALE') : 'fuera de la ventana'}`);
const dmax = Math.max(...llegan.filter((j) => j.dur !== null && !candidatos.includes(j)).map((j) => j.dur));
console.log(`el paso «Tests» más largo fuera de los candidatos: ${dmax} s`);
writeFileSync(join(carpeta, 'jobs.json'), JSON.stringify(jobs, null, 1));
if (fallos.length) { console.log('CIEGO:'); for (const f of fallos) console.log(`   · ${f}`); process.exitCode = 2; }
