#!/usr/bin/env node
// SCRUM-935d · b-bajar-y-leer.mjs — SÓLO LECTURA (gh api, GET).
//
// ¿QUÉ TAPABA EL CORTE? Para cada job del meta-guard de a-jobs.tsv baja su log y lee las líneas de
// veredicto que el instrumento imprime en vivo, UNA por mutación:
//     «  ✔ <guard> · <cae>»  «  ✖ <guard> · MUDO»  «  ? <guard> · CIEGO»  «  ☠ <guard> · FICHERO MUERTO»
// y si llegó la línea de resumen «vivas N · mudas N · ciegas N · ficheros muertos N».
//
// Un job CORTADO no imprime el resumen ni sale con código: lo que juzgó antes del corte —incluida
// cualquier MUDA— se queda en un log que nadie lee, bajo un `cancelled`.
//
// La POBLACIÓN de cada corte (cuántas mutaciones tenía que juzgar) NO está en su log. Se toma del job
// COMPLETO (con resumen) más cercano en el tiempo, y se declara: es una aproximación de ±unas pocas.
//
// Controles sembrados al arrancar (A3): un log fabricado con 3 veredictos y sin resumen sale CORTADO
// con 3; uno con resumen sale COMPLETO; uno vacío sale CIEGO. Si un control falla, no se lee nada.
//
//   node b-bajar-y-leer.mjs <carpeta con a-jobs.tsv>
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const [carpeta] = process.argv.slice(2);
if (!carpeta) { console.error('uso: node b-bajar-y-leer.mjs <carpeta>'); process.exit(2); }
const REPO = 'lwislg99/cobroflash-backend';
const GH = process.env.GH || 'gh';
const ESC = /\x1b\[[0-9;]*[A-Za-z]/g;
const VEREDICTO = /^ {2}(✔|✖|\?|☠) (\S+\.test\.mjs) · (.*)$/;
const RESUMEN = /^vivas (\d+) · mudas (\d+) · ciegas (\d+) · ficheros muertos (\d+)/;

export function leer(texto) {
  if (!texto || texto.length < 200) return { estado: 'CIEGO', veredictos: [] };
  const veredictos = [];
  let resumen = null;
  for (const cruda of texto.split(/\r?\n/)) {
    const l = cruda.replace(ESC, '').replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, '');
    const m = VEREDICTO.exec(l);
    if (m) veredictos.push({ signo: m[1], guard: m[2], resto: m[3] });
    const r = RESUMEN.exec(l);
    if (r) resumen = { vivas: +r[1], mudas: +r[2], ciegas: +r[3], muertos: +r[4] };
  }
  return { estado: resumen ? 'COMPLETO' : 'CORTADO', veredictos, resumen };
}

// ── controles sembrados ──
const T = (s) => `2026-10-20T10:00:00.0000000Z ${s}`;
const relleno = T('x'.repeat(250));
const c1 = leer([relleno, T('  ✔ scrum1-a.test.mjs · cae uno'), T('  ✖ scrum2-b.test.mjs · MUDO'), T('  ? scrum3-c.test.mjs · CIEGO')].join('\n'));
const c2 = leer([relleno, T('  ✔ scrum1-a.test.mjs · cae'), T('vivas 1 · mudas 0 · ciegas 0 · ficheros muertos 0')].join('\n'));
const c3 = leer('');
const controles = [
  ['cortado con 3', c1.estado === 'CORTADO' && c1.veredictos.length === 3 && c1.veredictos[1].signo === '✖'],
  ['completo', c2.estado === 'COMPLETO' && c2.resumen.vivas === 1],
  ['vacío es ciego', c3.estado === 'CIEGO'],
];
for (const [n, ok] of controles) console.log(`control ${ok ? 'OK ' : 'FALLA'} · ${n}`);
if (controles.some(([, ok]) => !ok)) process.exit(2);

const L = fs.readFileSync(path.join(carpeta, 'a-jobs.tsv'), 'utf8').trim().split('\n');
const cab = L[0].split('\t');
const jobs = L.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v])))
  .filter((j) => ['cancelled', 'success', 'failure'].includes(j.conclusion) && Number(j.paso_s) > 0);
const dir = path.join(carpeta, 'logs');
fs.mkdirSync(dir, { recursive: true });
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR;
const bajar = (id) => new Promise((ok) => {
  const destino = path.join(dir, `${id}.log`);
  if (fs.existsSync(destino) && fs.statSync(destino).size >= 200) return ok(fs.readFileSync(destino, 'utf8'));
  // `--allow-escape-sequences`: sin él gh se niega a escribir el log (lleva ANSI) y sale 1 con stdout vacío.
  execFile(GH, ['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${id}/logs`], { env, encoding: 'buffer', maxBuffer: 1024 * 1024 * 128 }, (e, out) => {
    if (e) return ok('');
    fs.writeFileSync(destino, out); ok(out.toString('utf8'));
  });
});
const leidos = [];
for (let i = 0; i < jobs.length; i += 6) {
  const lote = jobs.slice(i, i + 6);
  const textos = await Promise.all(lote.map((j) => bajar(j.job)));
  lote.forEach((j, k) => leidos.push({ ...j, ...leer(textos[k]) }));
}
const completos = leidos.filter((x) => x.estado === 'COMPLETO').sort((a, b) => Date.parse(a.creado) - Date.parse(b.creado));
const poblacionDe = (x) => {
  let mejor = null;
  for (const c of completos) if (!mejor || Math.abs(Date.parse(c.creado) - Date.parse(x.creado)) < Math.abs(Date.parse(mejor.creado) - Date.parse(x.creado))) mejor = c;
  return mejor;
};
const filas = [];
for (const x of leidos) {
  const ref = x.estado === 'CORTADO' ? poblacionDe(x) : null;
  const total = x.estado === 'COMPLETO' ? x.veredictos.length : ref ? ref.veredictos.length : null;
  const vistosGuards = new Set(x.veredictos.map((v) => v.guard));
  const guardsRef = ref ? [...new Set(ref.veredictos.map((v) => v.guard))] : [];
  filas.push({
    job: x.job, run: x.run, evento: x.evento, rama: x.rama, creado: x.creado, conclusion: x.conclusion,
    estado: x.estado, juzgadas: x.veredictos.length, total_aprox: total ?? '',
    sin_juzgar: total != null && x.estado === 'CORTADO' ? Math.max(0, total - x.veredictos.length) : '',
    guards_juzgados: vistosGuards.size,
    guards_sin_juzgar: x.estado === 'CORTADO' && ref ? guardsRef.filter((g) => !vistosGuards.has(g)).length : '',
    mudas: x.veredictos.filter((v) => v.signo === '✖').length,
    ciegas: x.veredictos.filter((v) => v.signo === '?').length,
    muertos: x.veredictos.filter((v) => v.signo === '☠').length,
    ultimo_guard: x.veredictos.at(-1)?.guard || '',
    ref_job: ref?.job || '',
    mudos_nombres: x.veredictos.filter((v) => v.signo === '✖').map((v) => v.guard).join(','),
    ciegos_nombres: x.veredictos.filter((v) => v.signo === '?').map((v) => v.guard).join(','),
  });
}
const c = Object.keys(filas[0]);
fs.writeFileSync(path.join(carpeta, 'b-jobs-leidos.tsv'), [c.join('\t'), ...filas.map((f) => c.map((k) => f[k]).join('\t'))].join('\n') + '\n');
const cuenta = (p) => filas.filter(p).length;
console.log(`POBLACIÓN · jobs con paso de mutación ${jobs.length} · leídos COMPLETO ${cuenta((f) => f.estado === 'COMPLETO')} · CORTADO ${cuenta((f) => f.estado === 'CORTADO')} · CIEGO (log no bajado/vacío) ${cuenta((f) => f.estado === 'CIEGO')}`);
process.exit(0);
