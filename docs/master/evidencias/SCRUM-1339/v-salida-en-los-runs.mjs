// SCRUM-1339v · ¿Qué obligatorio reciente habría caído si la señal saliera 2 al NO PODER MEDIR? Sólo lectura.
// Sonda propia, sin el vigía de 1339u (no está en main): lee las ANOTACIONES del job «build + tests»
// de los últimos N runs del CI acabados y deduce la salida que habría dado el guion nuevo, por DOS
// caminos independientes:
//   · título  — «NO PUDE MEDIR» → 2 · «FALTAN…» → 1 · «completo · 0 ausentes» → 0
//   · línea   — `[señal de nombres v1] medible=no` → 2 · `medible=si ausentes=K` → K>0 ? 1 : 0
// Control POSITIVO sembrado: el job 110501932336 (run 36901626137, control ④ de 1339d) se lee igual
// y TIENE que salir 2 por los dos caminos; si no, la sonda es ciega y su cero no vale.
//   uso: node v-salida-en-los-runs.mjs <N> > v-salida-en-los-runs.txt
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ej = promisify(execFile);
const GH = 'C:/Program Files/GitHub CLI/gh.exe';
const REPO = 'repos/lwislg99/cobroflash-backend';
// El nombre ENTERO, el de `ci.yml` línea 43 en c1e874b36. La primera pasada usaba «build + tests» y
// dio 400 de 400 «sin-job»: un prefijo no es un nombre. Por eso abajo, cero jobs encontrados es CIEGO.
const JOB = 'build + tests (con banco desechable)';
const N = Number(process.argv[2] ?? 250);
const gh = async (ruta) => JSON.parse((await ej(GH, ['api', ruta], { maxBuffer: 64 << 20 })).stdout);

// Cada sonda da el CONJUNTO de salidas que ve, no la última: el job del control corrió el guion TRES
// veces (era el banco del ④) y mezcla «no pudo» con «faltan». En un run normal el paso corre una vez,
// así que más de una salida es una `mezcla` y se dice, no se elige.
function salidaDe(anot) {
  const s = (anot ?? []).filter((a) => String(a.title ?? '').startsWith('señal de nombres'));
  const porTitulo = new Set();
  for (const a of s) {
    const t = String(a.title);
    if (t.includes('NO PUDE MEDIR')) porTitulo.add(2);
    else if (t.includes('FALTAN')) porTitulo.add(1);
    else if (t.includes('completo · 0 ausentes')) porTitulo.add(0);
  }
  const porLinea = new Set();
  for (const a of s) {
    const m = String(a.message ?? '').match(/\[señal de nombres v1\] medible=(si|no)(?: ausentes=(\d+))?/);
    if (m) porLinea.add(m[1] === 'no' ? 2 : (Number(m[2]) > 0 ? 1 : 0));
  }
  const txt = (c) => [...c].sort().join('+') || '-';
  return { porTitulo: txt(porTitulo), porLinea: txt(porLinea), n: s.length };
}

// el control, primero: si las dos sondas no ven el 2, no se mira nada más
const control = salidaDe(await gh(`${REPO}/check-runs/110501932336/annotations?per_page=100`));
console.log(`CONTROL job 110501932336: titulo=${control.porTitulo} linea=${control.porLinea} anotaciones_senal=${control.n}`);
if (!control.porTitulo.includes('2') || !control.porLinea.includes('2')) { console.log('CIEGO: el control positivo no ve el 2'); process.exit(2); }

const wf = (await gh(`${REPO}/actions/workflows?per_page=100`)).workflows.find((w) => w.name === 'CI');
const runs = [];
for (let p = 1; runs.length < N; p++) {
  const pag = (await gh(`${REPO}/actions/workflows/${wf.id}/runs?per_page=100&page=${p}`)).workflow_runs;
  if (!pag.length) break;
  runs.push(...pag.filter((r) => r.status === 'completed'));
}
const filas = [];
const cola = runs.slice(0, N);
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let r = cola.shift(); r; r = cola.shift()) {
    const f = { run: r.id, ev: r.event, rama: r.head_branch, creado: r.created_at };
    try {
      const j = (await gh(`${REPO}/actions/runs/${r.id}/jobs?per_page=100&filter=latest`)).jobs.find((x) => x.name === JOB);
      if (!j) { filas.push({ ...f, clase: 'sin-job' }); continue; }
      f.job = j.id; f.concl = j.conclusion;
      if (!['success', 'failure'].includes(j.conclusion)) { filas.push({ ...f, clase: `job-${j.conclusion}` }); continue; }
      const s = salidaDe(await gh(`${REPO}/check-runs/${j.id}/annotations?per_page=100`));
      const clase = s.porTitulo === '-' && s.porLinea === '-' ? 'sin-anotacion'
        : s.porLinea.includes('+') ? `mezcla-${s.porLinea}` : `saldria-${s.porLinea === '-' ? s.porTitulo : s.porLinea}`;
      filas.push({ ...f, clase, ...s, discrepa: s.porTitulo !== s.porLinea });
    } catch (e) { filas.push({ ...f, clase: `CIEGO-lectura: ${String(e.message).split('\n')[0]}` }); }
  }
}));
filas.sort((a, b) => b.creado.localeCompare(a.creado));
for (const f of filas) console.log(JSON.stringify(f));
const por = {};
for (const f of filas) por[f.clase] = (por[f.clase] ?? 0) + 1;
console.log(`POBLACION runs=${filas.length} (pedidos ${N}) · de ${filas.at(-1)?.creado} a ${filas[0]?.creado}`);
console.log(`CLASES ${Object.entries(por).map(([k, v]) => `${k}=${v}`).join(' · ')} · suma=${Object.values(por).reduce((a, b) => a + b, 0)}`);
console.log(`DOS SONDAS discrepan=${filas.filter((f) => f.discrepa).length}`);
const caerian = filas.filter((f) => (f.clase === 'saldria-2' || f.clase === 'sin-anotacion') && f.concl === 'success');
console.log(`CAERIAN (verde hoy y saldria 2, o sin anotación de la señal) = ${caerian.length}${caerian.length ? ' · ' + caerian.map((f) => f.run).join(',') : ''}`);
const conJob = filas.filter((f) => f.job).length;
if (!conJob) { console.log('CIEGO: ningún run tiene el job; el cero de arriba no vale'); process.exit(2); }
console.log(`con el job ${conJob} · midieron ${filas.filter((f) => /^saldria-[01]$/.test(f.clase)).length}`);
