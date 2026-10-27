// SCRUM-1405f · J3 · ¿se ha vuelto a saltar `scrum1405c ④` desde que entró SCRUM-1574 (b10c9b6ca)?
//
// Uso: node censo-f.mjs <desdeISO> <dirLogs> <salida.tsv>   (dirLogs FUERA del árbol: SCRUM-824)
//      node censo-f.mjs --controles                         (sólo los controles fabricados)
//      node censo-f.mjs --log <fichero>                     (lee un log suelto)
//
// POBLACIÓN: todos los runs de ci.yml creados desde <desdeISO>, push y pull_request, y de cada uno el
// job obligatorio «build + tests…». Sólo se baja el log de los que acabaron en success o failure; los
// demás se cuentan por su estado (en curso, cancelado, sin el job). Se bajan también los VERDES.
// Reusa la forma de j3n-1405d/censo-4.mjs, pero su `leer` NO sirve aquí (interrogado el 27-oct): busca
// el mensaje de rojo de 1405c («SIGUE perdiendo casos»), que 1405d cambió; no copia el motivo de un
// salto; y un log vacío le sale «ausente», que se lee igual que «el caso no estaba».
//
// Por job: el estado de ④ anclado al INICIO del caso (cicatriz ③: el símbolo puede ir dentro de un
// nombre), el motivo LITERAL si se saltó, el resumen de la tanda (tests = pass+fail+skip+cancel+todo),
// el tamaño del log y «TANDA SIN VEREDICTO». Control POSITIVO en cada log: el caso ③ ALARMA, del mismo
// fichero y anterior a ④, tiene que estar; si no está, el log no vale para decir nada de ④ (CIEGO).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';
const run = promisify(execFile);
// Reintenta: el 27-oct un 502 de GitHub tumbó la primera pasada entera, sin tabla y con salida 1.
const gh = async (args) => {
  for (let i = 1; ; i++) {
    try { return (await run(GH, args, { encoding: 'utf8', maxBuffer: 1 << 28 })).stdout; } catch (e) {
      if (i >= 4) throw e;
      await new Promise((r) => setTimeout(r, 5000 * i));
    }
  }
};

const T = '\\S+Z '; // prefijo de hora del runner
const CUARTO = 'SCRUM-1405c · ④ 🔴 EL ROJO PRIMERO';
const RE_CUARTO = new RegExp(`^(?:${T})?([✔✖﹣]) ${CUARTO}[^\\n]*$`, 'm');
const RE_TERCERO = new RegExp(`^(?:${T})?[✔✖] SCRUM-1405c · ③ 🔴 ALARMA`, 'm');
const RE_LISTAS = /sonda: (\d+) bytes · sin el módulo: (\[[^\]]*\]) · con el módulo: (\[[^\]]*\])/;
// Los motivos de rojo que puede dar ④ (test: líneas 248, 250, 261, 268, 272, 275).
const ROJOS = [
  ['no-pude-sonda', '🔴 NO PUDE MIRAR: la sonda de la tubería nativa no contestó'],
  ['no-pude-token', '🔴 NO PUDE MIRAR: sin el token del script'],
  ['no-pude-codigo', '🔴 NO PUDE MIRAR: una pasada de la cobaya no salió con 0'],
  ['ciego', '🔴 CIEGO: la sonda dejó'],
  ['empeora', '🔴 con el módulo la cobaya pierde MÁS de lo medido'],
];
// Lo que decidirCuarto escribe al saltar (test:212). Lo demás que pueda salir detrás de «# » no lo produce.
const RE_MOTIVO_DC = /^NO MEDIDO: sin el módulo la cobaya no pierde en (\d+) pasadas \(faltan ([\d,]*)\) y la sonda dejó 0 bytes pendientes tras 1 MiB: en este node no hay rojo que ver\. Pasa en Windows \(J3f: 0 de 30 pasadas de cobaya pierden\)\. Se mide en el CI de Linux\.$/;

function resumen(txt) {
  const v = (k) => { const m = new RegExp(`^(?:${T})?ℹ ${k} (\\d+)$`, 'm').exec(txt); return m ? Number(m[1]) : null; };
  const r = { tests: v('tests'), pass: v('pass'), fail: v('fail'), skip: v('skipped'), cancel: v('cancelled'), todo: v('todo') };
  r.suma = r.tests === null ? 'sin-resumen' : (r.pass + r.fail + r.skip + r.cancel + r.todo === r.tests ? 'cuadra' : 'NO-CUADRA');
  return r;
}

/** De un log: el estado de ④ y lo que hace falta para juzgarlo. */
export function leer(txt) {
  const bytes = Buffer.byteLength(txt);
  const r = { bytes, ...resumen(txt), sinVeredicto: /TANDA SIN VEREDICTO/.test(txt), tercero: RE_TERCERO.test(txt) };
  const m = RE_CUARTO.exec(txt);
  const l = RE_LISTAS.exec(txt);
  if (l) { r.sonda = Number(l[1]); r.sin = JSON.parse(l[2]).map((f) => f.faltan); r.con = JSON.parse(l[3]).map((f) => f.faltan); }
  if (!m) { r.estado = r.tercero ? 'AUSENTE-④' : 'CIEGO'; r.motivo = bytes < 100000 ? `log de ${bytes} B` : (r.tercero ? '③ está y ④ no' : 'ni ③ ni ④'); return r; }
  const linea = m[0];
  if (m[1] === '✔') { r.estado = 'corrió-pasa'; r.motivo = ''; return r; }
  if (m[1] === '﹣') {
    const s = / # (.*)$/.exec(linea);
    r.estado = 'saltado'; r.motivo = s ? s[1] : '(sin motivo)';
    r.motivoEsDeDC = RE_MOTIVO_DC.test(r.motivo);
    return r;
  }
  r.estado = 'corrió-cae';
  const hallado = ROJOS.find(([, t]) => txt.includes(t));
  r.motivo = hallado ? hallado[0] : 'rojo-sin-motivo-conocido';
  return r;
}

function controles() {
  const ok = (c, d) => { if (!c) { console.error('🔴 CONTROL FALLA:', d); process.exit(2); } };
  const h = '2026-10-27T13:21:13.3533235Z ';
  const tres = `${h}✔ SCRUM-1405c · ③ 🔴 ALARMA: en ESTE node (30ms)\n`;
  const fila = (f) => JSON.stringify(f.map((x) => ({ codigo: 0, informados: 320 - x, faltan: x })));
  const tanda = `${h}ℹ tests 10\n${h}ℹ pass 8\n${h}ℹ fail 1\n${h}ℹ cancelled 0\n${h}ℹ skipped 1\n${h}ℹ todo 0\n`;
  const relleno = 'x'.repeat(200000) + '\n';
  // ① pasa, con listas
  const a = leer(relleno + tres + `${h}✔ ${CUARTO}: sin el módulo… (2740ms)\n${h}ℹ SCRUM-1405c · sonda: 1048576 bytes · sin el módulo: ${fila([10, 22, 37, 21])} · con el módulo: ${fila([0, 0, 0, 0])}\n` + tanda);
  ok(a.estado === 'corrió-pasa' && a.sin.join() === '10,22,37,21' && a.suma === 'cuadra' && a.tests === 10, 'pasa ' + JSON.stringify(a));
  // ② salto con el motivo literal de decidirCuarto (positivo SEMBRADO: el árbol no tiene ninguno)
  const motivo = 'NO MEDIDO: sin el módulo la cobaya no pierde en 4 pasadas (faltan 0,0,0,0) y la sonda dejó 0 bytes pendientes tras 1 MiB: en este node no hay rojo que ver. Pasa en Windows (J3f: 0 de 30 pasadas de cobaya pierden). Se mide en el CI de Linux.';
  const b = leer(relleno + tres + `${h}﹣ ${CUARTO}: x (2.1ms) # ${motivo}\n` + tanda);
  ok(b.estado === 'saltado' && b.motivo === motivo && b.motivoEsDeDC === true, 'salto DC ' + JSON.stringify(b));
  // ③ salto con el motivo VIEJO (anterior a 1574): saltado, y NO es de decidirCuarto
  const c = leer(relleno + tres + `${h}﹣ ${CUARTO}: x (2.1ms) # esta máquina ya escribe BLOQUEANTE\n` + tanda);
  ok(c.estado === 'saltado' && c.motivoEsDeDC === false, 'salto viejo ' + JSON.stringify(c));
  // ④ cae, por CIEGO de decidirCuarto
  const d = leer(relleno + tres + `${h}✖ ${CUARTO}: x (2ms)\n${h}  🔴 CIEGO: la sonda dejó 983040 bytes pendientes\n` + tanda);
  ok(d.estado === 'corrió-cae' && d.motivo === 'ciego', 'cae ciego ' + JSON.stringify(d));
  // ⑤ la cruz y el guion DENTRO de otro nombre no cuentan (cicatriz ③): ④ ausente con ③ presente
  const e = leer(relleno + tres + `${h}✔ SCRUM-1328 · un «﹣ ${CUARTO}» dentro de un nombre no cuenta (1ms)\n` + tanda);
  ok(e.estado === 'AUSENTE-④', 'nombre ' + JSON.stringify(e));
  // ⑥ log VACÍO → CIEGO, no «corrió» ni «ausente»
  const f = leer('');
  ok(f.estado === 'CIEGO' && f.motivo === 'log de 0 B' && f.suma === 'sin-resumen', 'vacío ' + JSON.stringify(f));
  // ⑦ resumen que no suma
  ok(leer(tanda.replace('pass 8', 'pass 7')).suma === 'NO-CUADRA', 'no cuadra');
  console.log('CONTROLES · 7 de 7 en su sitio (pasa, salto de decidirCuarto, salto viejo, cae, nombre, vacío, no cuadra)');
}

async function main() {
  if (process.argv[2] === '--controles') return controles();
  if (process.argv[2] === '--log') { const t = fs.readFileSync(process.argv[3], 'utf8'); const r = leer(t); delete r.sin; delete r.con; return console.log(JSON.stringify(r)); }
  controles();
  const [, , desde, dir, salida] = process.argv;
  if (!desde || !dir || !salida) throw new Error('uso: censo-f.mjs <desdeISO> <dirLogs> <salida.tsv>');
  fs.mkdirSync(dir, { recursive: true });
  const runs = [];
  for (let page = 1; ; page++) {
    const r = JSON.parse(await gh(['api', `repos/${REPO}/actions/workflows/ci.yml/runs?per_page=100&page=${page}&created=>=${desde}`]));
    runs.push(...r.workflow_runs);
    if (r.workflow_runs.length < 100) { if (runs.length !== r.total_count) console.log(`⚠️ total_count ${r.total_count} ≠ leídos ${runs.length}`); break; }
  }
  const pob = { runs: runs.length, sinObligatorio: 0, enCurso: 0, cancelado: 0, otro: 0, conVeredicto: 0, logNo: 0 };
  const eventos = {};
  for (const r of runs) eventos[r.event] = (eventos[r.event] || 0) + 1;
  const filas = [];
  const cola = runs.map((r) => async () => {
    const base = { run: r.id, cuando: r.created_at, evento: r.event, rama: r.head_branch, sha: r.head_sha };
    let jobs;
    try { jobs = JSON.parse(await gh(['api', `repos/${REPO}/actions/runs/${r.id}/jobs?per_page=100`])).jobs; } catch (e) {
      pob.jobsNo = (pob.jobsNo || 0) + 1; filas.push({ ...base, job: '', ob: '?', estado: 'JOBS-NO-LEÍDOS' }); return;
    }
    const ob = jobs.find((j) => j.name.startsWith('build + tests'));
    if (!ob) { pob.sinObligatorio++; return; }
    if (ob.status !== 'completed') { pob.enCurso++; filas.push({ ...base, job: ob.id, ob: `(${ob.status})`, estado: 'EN-CURSO' }); return; }
    if (ob.conclusion === 'cancelled') { pob.cancelado++; filas.push({ ...base, job: ob.id, ob: 'cancelled', estado: 'CANCELADO' }); return; }
    if (ob.conclusion !== 'success' && ob.conclusion !== 'failure') { pob.otro++; filas.push({ ...base, job: ob.id, ob: ob.conclusion, estado: 'OTRO' }); return; }
    pob.conVeredicto++;
    const f = path.join(dir, `${ob.id}.log`);
    let txt;
    try {
      if (!fs.existsSync(f)) fs.writeFileSync(f, await gh(['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${ob.id}/logs`]));
      txt = fs.readFileSync(f, 'utf8');
    } catch (e) { pob.logNo++; filas.push({ ...base, job: ob.id, ob: ob.conclusion, bytes: 0, estado: 'LOG-NO-BAJADO' }); return; }
    const l = leer(txt);
    filas.push({ ...base, job: ob.id, ob: ob.conclusion, ...l });
    if (l.estado === 'corrió-pasa') fs.unlinkSync(f); // sólo se guardan los logs que no son un ④ en verde
  });
  let i = 0, hechos = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (i < cola.length) { await cola[i++](); if (++hechos % 50 === 0) console.log(`… ${hechos}/${cola.length}`); } }));
  filas.sort((a, b) => a.cuando.localeCompare(b.cuando));
  const col = ['cuando', 'run', 'job', 'evento', 'rama', 'sha', 'ob', 'bytes', 'tests', 'pass', 'fail', 'skip', 'cancel', 'todo', 'suma', 'sinVeredicto', 'tercero', 'estado', 'motivo', 'motivoEsDeDC', 'sonda', 'sin', 'con'];
  const val = (f, k) => (Array.isArray(f[k]) ? f[k].join(',') : (f[k] ?? ''));
  fs.writeFileSync(salida, [col.join('\t'), ...filas.map((f) => col.map((k) => String(val(f, k)).replace(/\t/g, ' ')).join('\t'))].join('\n') + '\n');
  console.log('POBLACIÓN', JSON.stringify(pob));
  console.log('EVENTOS', JSON.stringify(eventos));
  console.log('ventana', runs.at(-1)?.created_at, '→', runs[0]?.created_at);
  const por = {};
  for (const f of filas) por[f.estado] = (por[f.estado] || 0) + 1;
  console.log('ESTADOS', JSON.stringify(por));
}
main().catch((e) => { console.error(e); process.exit(1); });
