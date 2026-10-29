// docs/master/evidencias/SCRUM-1527/1527e/cancelados.mjs — SCRUM-1527e · ¿se esconde un cuelgue en un job CANCELADO?
//
//     node docs/master/evidencias/SCRUM-1527/1527e/cancelados.mjs <jobs.json> <carpetaDeLogs> <desdeISO> [minSeg=300]
//
// EL HUECO QUE CIERRA. El filtro de 1527b/1527d sólo ve un cuelgue si el paso «Tests» llega a 900 s
// (el vigía avisa a los 15 min de silencio). Un cuelgue en un job que un push posterior CANCELA antes
// de eso no lleva aviso ni llega a 900 s: es invisible para ese filtro. Aquí se leen esos jobs: los
// creados desde <desdeISO>, cancelados, con el paso «Tests» empezado y de <minSeg> s o más.
//
// QUÉ MIDE. En el log, la hora de cada línea de caso (las que empiezan por ✔ o ✖ tras el sello de
// hora) y la de la línea de cancelación del runner. Da dos cifras por job:
//   · `cola`: segundos entre el último caso y la cancelación. Un cuelgue la deja larga; una tanda que
//     escribía hasta que la cortaron, corta.
//   · `hueco`: el silencio más largo entre dos casos seguidos dentro de la tanda.
// CONTROL: las dos cifras sobre los jobs de la MISMA lista que acabaron en `success` con paso de
// 600 s o más (tandas enteras): su `hueco` máximo es el silencio sano de hoy. Si no hay ninguno de
// control, o algún log no baja, sale 2.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [lista, carpeta, desde, minArg] = process.argv.slice(2);
if (!lista || !carpeta || !desde) { console.error('uso: cancelados.mjs <jobs.json> <carpetaDeLogs> <desdeISO> [minSeg]'); process.exit(2); }
const MIN = Number(minArg ?? 300);
mkdirSync(carpeta, { recursive: true });
const GH = process.platform === 'win32' ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';
const jobs = JSON.parse(readFileSync(lista, 'utf8')).filter((x) => Date.parse(x.creado) >= Date.parse(desde));
const fallos = [];

function bajar(job) {
  const f = join(carpeta, `job${job}.log`);
  for (let i = 1; i <= 4 && (!existsSync(f) || statSync(f).size < 1000); i++) {
    try { writeFileSync(f, execFileSync(GH, ['api', '--allow-escape-sequences', `repos/lwislg99/cobroflash-backend/actions/jobs/${job}/logs`], { maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })); } catch { /* reintento */ }
  }
  const b = existsSync(f) ? statSync(f).size : 0;
  if (b < 1000) { fallos.push(`log del job ${job}: ${b} B, no es un log`); return null; }
  return readFileSync(f, 'utf8');
}

const SELLO = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+Z) /;
function medir(texto) {
  const casos = [];
  let cancelado = null;
  for (const l of texto.split('\n')) {
    const m = l.match(SELLO);
    if (!m) continue;
    const resto = l.slice(m[0].length).replace(/\u001B\[[0-9;?]*[ -\/]*[@-~]/g, '');
    if (/^\s*[✔✖] /.test(resto)) casos.push(Date.parse(m[1]));
    if (cancelado === null && /##\[error\]The operation was canceled/.test(resto)) cancelado = Date.parse(m[1]);
  }
  let hueco = 0;
  for (let i = 1; i < casos.length; i++) hueco = Math.max(hueco, casos[i] - casos[i - 1]);
  return {
    casos: casos.length,
    hueco: Math.round(hueco / 1000),
    cola: cancelado !== null && casos.length ? Math.round((cancelado - casos.at(-1)) / 1000) : null,
    aviso: /TANDA SIN VEREDICTO/.test(texto),
  };
}

// Un job cancelado cuyo paso «Tests» acabó en `success` terminó su tanda: no puede esconder un
// cuelgue. (La primera pasada lo metía, y lo cazó la línea CIEGO de abajo: un job sin cancelación.)
const sujetos = jobs.filter((x) => x.conclusion === 'cancelled' && x.paso !== null && x.paso !== 'success' && x.dur !== null && x.dur >= MIN);
const control = jobs.filter((x) => x.conclusion === 'success' && x.paso === 'success' && x.dur !== null && x.dur >= 600);
console.log(`SCRUM-1527e · cancelados con paso «Tests» de ${MIN} s o más, creados desde ${desde}: ${sujetos.length} · control (success, paso de 600 s o más): ${control.length}`);
if (!control.length) fallos.push('sin jobs de control: no hay silencio sano con el que comparar');

let huecoSano = 0;
for (const c of control) {
  const t = bajar(c.job);
  if (!t) continue;
  const m = medir(t);
  huecoSano = Math.max(huecoSano, m.hueco);
}
console.log(`control: el silencio más largo entre dos casos en ${control.length} tandas enteras es de ${huecoSano} s`);

for (const s of sujetos.sort((a, b) => b.dur - a.dur)) {
  const t = bajar(s.job);
  if (!t) continue;
  const m = medir(t);
  if (m.cola === null) fallos.push(`job ${s.job}: sin línea de cancelación o sin casos; no se puede leer su cola`);
  const marca = m.cola !== null && m.cola > huecoSano ? '  ← cola MÁS LARGA que cualquier silencio sano' : '';
  console.log(`   job ${s.job} · ${s.creado} · paso ${s.dur} s · casos ${m.casos} · hueco máx ${m.hueco} s · cola hasta la cancelación ${m.cola ?? '?'} s · aviso ${m.aviso ? 'SÍ' : 'no'}${marca}`);
}
if (fallos.length) { console.log('CIEGO:'); for (const f of fallos) console.log(`   · ${f}`); process.exitCode = 2; }
