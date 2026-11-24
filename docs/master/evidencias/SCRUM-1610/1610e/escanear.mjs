// Fase 2: descarga el log de cada job de tareas.json (en memoria, no se guarda) y busca las firmas.
// Reanudable: lo ya escrito en resultado.tsv no se repite. Uso: node escanear.mjs [jobId ...]  (con ids: solo esos, modo control)
import { spawn } from 'node:child_process';
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
const D = 'C:/Users/Public/tmp-jv-j6fl/scan/';
const FIRMAS = [
  // Real = la firma, FUERA de las lineas del autotest de SCRUM-1610b ([cortada ×N] y «la sonda»), que se imprimen en cada tanda.
  ['S_NEW_corte', /^(?!.*\[cortada ×\d\]).*cortes \d+: intento \d+ \(\d+ B \/ \d+ l/],
  ['S_NEW_ciego', /^(?!.*la sonda)(?!.*SCRUM-1610b).*CIEGO · salida cortada/],
  ['AUTOTEST_1610b_visible', /\[cortada ×1\] · cortes 1: intento 1 \(\d+ B \/ \d+ l.* → el relanzamiento llegó entero/],
  ['S_OLD_testat', /test at tests\/(scrum1516c-frontera-en-el-obligatorio|scrum765-la-puerta-y-el-suelo)\.test\.mjs/],
  ['S_OLD_sembrados', /su línea de controles SEMBRADOS no dice true/],
  ['S_OLD_poblacion', /población ¿\?/],
  ['CERO_cortes0', /cortes 0:/],
];
const MARCA_TANDA = /SCRUM-1516c · /; // el test de 1516c se ejecuto en este log (poblacion)
const HDR = 'pop\trun\tattempt\tlastAttempt\trunConclusion\tjob\tjobName\tjobConclusion\tcreatedAt\tbranch\tbytes\tciego\tcorre1516c\t' + FIRMAS.map(f => f[0]).join('\t') + '\n';
const tsv = D + 'resultado.tsv';
if (!existsSync(tsv)) writeFileSync(tsv, HDR);
const hecho = new Set(readFileSync(tsv, 'utf8').split('\n').slice(1).filter(Boolean).map(l => l.split('\t')[5]));
let tareas = JSON.parse(readFileSync(D + 'tareas.json', 'utf8')).tasks;
const ids = process.argv.slice(2);
if (ids.length) tareas = ids.map(id => ({ pop: 'CTRL', run: '', attempt: '', lastAttempt: '', runConclusion: '', job: id, jobName: '', jobConclusion: '', createdAt: '', branch: '' }));
else tareas = tareas.filter(t => !hecho.has(String(t.job)));
console.error('pendientes', tareas.length);
function bajar(job) {
  return new Promise((res) => {
    const p = spawn('gh', ['api', '--allow-escape-sequences', `repos/lwislg99/cobroflash-backend/actions/jobs/${job}/logs`]);
    const chunks = []; let err = '';
    p.stdout.on('data', c => chunks.push(c)); p.stderr.on('data', c => err += c);
    p.on('close', code => res({ buf: Buffer.concat(chunks), code, err }));
  });
}
const t0 = Date.now(); let i = 0, n = 0;
async function worker() {
  while (i < tareas.length && Date.now() - t0 < 470000) {
    const t = tareas[i++];
    const { buf, code, err } = await bajar(t.job);
    const txt = buf.toString('utf8');
    const lineas = txt.split('\n');
    const cuentas = FIRMAS.map(() => 0);
    for (const l of lineas) FIRMAS.forEach(([k, re], x) => {
      if (re.test(l)) {
        cuentas[x]++;
        if (k !== 'AUTOTEST_1610b_visible' && (k !== 'S_OLD_poblacion' || cuentas[x] <= 2)) appendFileSync(D + 'hits.jsonl', JSON.stringify({ firma: k, run: t.run, job: t.job, attempt: t.attempt, lastAttempt: t.lastAttempt, runConclusion: t.runConclusion, jobName: t.jobName, createdAt: t.createdAt, branch: t.branch, linea: l.trim().slice(0, 300) }) + '\n');
      }
    });
    const ciego = buf.length < 100000 ? (code ? 'ERR:' + err.trim().slice(0, 60) : 'PEQUENO') : '';
    const fila = [t.pop, t.run, t.attempt, t.lastAttempt, t.runConclusion, t.job, t.jobName, t.jobConclusion, t.createdAt, t.branch, buf.length, ciego, MARCA_TANDA.test(txt) ? 1 : 0, ...cuentas].join('\t') + '\n';
    if (ids.length) process.stdout.write(fila); else appendFileSync(tsv, fila);
    n++;
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.error('escaneados esta tanda', n, 'quedan', tareas.length - n, 'seg', Math.round((Date.now() - t0) / 1000));
