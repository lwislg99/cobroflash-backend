#!/usr/bin/env node
// SCRUM-1419 · ¿cuánta de la cola la causan las tandas que se cancelan a media ejecución?
//
//   node docs/master/evidencias/SCRUM-1419/ocupacion.mjs bajar   <desde ISO> <hasta ISO> <cache.jsonl>
//   node docs/master/evidencias/SCRUM-1419/ocupacion.mjs analizar <desde ISO> <hasta ISO> <cache.jsonl> [--tsv <fichero>]
//
// SÓLO LEE. `bajar` pide los jobs de TODAS las corridas del repositorio en la ventana (todos los
// workflows, todos los eventos y todos los intentos: cualquiera ocupa un ejecutor) y los guarda en un
// fichero, una corrida por línea. Para a los siete minutos y dice cuántas faltan; se relanza y sigue.
// `analizar` se NIEGA si falta alguna corrida de la ventana: una ocupación a medias parece holgura.
//
// Qué se mide, minuto a minuto:
//   · OCUPACIÓN: cuántos jobs estaban ejecutando (de su primer paso a su fin).
//   · De ellos, cuántos eran de una corrida que acabó CANCELADA: ejecutor ocupado en una tanda tirada.
//   · EN COLA: cuántos jobs estaban creados y sin ejecutor.
// Lo que NO puede decir: qué habría pasado sin las canceladas. Da la parte de la ocupación que era
// de tandas tiradas mientras había cola; cuánto habría bajado la cola es una cuenta, no una medida.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const REPO = 'lwislg99/cobroflash-backend';
const GH = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe') ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';
const gh = (ruta) => JSON.parse(execFileSync(GH, ['api', ruta], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60000 }).replace(/^\uFEFF/, ''));
const noPude = (que) => { console.log(`🔴 NO PUDE MEDIR: ${que}`); process.exit(2); };
const MIN = 60000;

function listar(desde, hasta) {
  // La API no pagina más allá de 1.000 resultados por consulta: la ventana se parte por horas.
  const corridas = new Map();
  for (let t = Date.parse(desde); t < Date.parse(hasta); t += 3600e3) {
    const a = new Date(t).toISOString().slice(0, 19) + 'Z';
    const b = new Date(Math.min(t + 3600e3 - 1000, Date.parse(hasta))).toISOString().slice(0, 19) + 'Z';
    let total = null; let llegaron = 0;
    for (let pagina = 1; pagina <= 10; pagina++) {
      let j; try { j = gh(`repos/${REPO}/actions/runs?created=${encodeURIComponent(`${a}..${b}`)}&per_page=100&page=${pagina}`); } catch (e) { noPude(`la lista de ${a} no llegó: ${String(e.message).split('\n')[0]}`); }
      total = j.total_count; llegaron += j.workflow_runs.length;
      for (const c of j.workflow_runs) corridas.set(c.id, c);
      if (j.workflow_runs.length < 100) break;
    }
    if (llegaron !== total) noPude(`la hora ${a} declara ${total} corridas y llegaron ${llegaron}`);
  }
  return [...corridas.values()];
}

const leerCache = (ruta) => new Map(fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8').split('\n').filter(Boolean).map((l) => { const o = JSON.parse(l); return [o.id, o]; }) : []);

/** Pura. Los tramos [inicio, fin] de ejecución y de cola de cada job, con si su corrida acabó cancelada. */
export function tramos(filas) {
  const out = [];
  for (const f of filas) {
    for (const j of f.jobs) {
      const creado = Date.parse(j.created_at);
      const pasos = (j.steps || []).filter((p) => p.started_at).map((p) => Date.parse(p.started_at)).sort((a, b) => a - b);
      const fin = Date.parse(j.completed_at);
      const inicio = pasos.length ? pasos[0] : NaN;
      if (Number.isFinite(inicio) && Number.isFinite(fin) && fin > inicio) out.push({ tipo: 'ejecuta', a: inicio, b: fin, tirada: f.conclusion === 'cancelled', workflow: f.workflow, job: j.name });
      // En cola: de creado a su primer paso; si nunca tuvo pasos, de creado a su fin (murió esperando).
      const finCola = Number.isFinite(inicio) ? inicio : fin;
      if (Number.isFinite(creado) && Number.isFinite(finCola) && finCola - creado > 15000) out.push({ tipo: 'cola', a: creado, b: finCola, tirada: f.conclusion === 'cancelled', workflow: f.workflow });
    }
  }
  return out;
}

/** Pura. Minuto a minuto entre `desde` y `hasta`: ejecutando, de ellos tirados, y en cola. */
export function porMinuto(ts, desde, hasta) {
  const n = Math.ceil((hasta - desde) / MIN);
  const ej = new Float64Array(n); const tir = new Float64Array(n); const cola = new Float64Array(n);
  for (const t of ts) {
    const i0 = Math.max(0, Math.floor((t.a - desde) / MIN)); const i1 = Math.min(n - 1, Math.floor((t.b - desde) / MIN));
    for (let i = i0; i <= i1; i++) {
      // Fracción del minuto i que el tramo ocupa: la suma da jobs-minuto, no un recuento de solapes.
      const m0 = desde + i * MIN; const parte = (Math.min(t.b, m0 + MIN) - Math.max(t.a, m0)) / MIN;
      if (parte <= 0) continue;
      if (t.tipo === 'cola') cola[i] += parte; else { ej[i] += parte; if (t.tirada) tir[i] += parte; }
    }
  }
  return { ej, tir, cola, n };
}

const [orden, desde, hasta, cache, ...resto] = process.argv.slice(2);
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('SCRUM-1419/ocupacion.mjs')) {
  if (!/^(bajar|analizar)$/.test(orden || '') || !Number.isFinite(Date.parse(desde)) || !Number.isFinite(Date.parse(hasta)) || !cache) noPude('uso: ocupacion.mjs bajar|analizar <desde ISO> <hasta ISO> <cache.jsonl> [--tsv <fichero>]');
  const corridas = listar(desde, hasta);
  if (corridas.length === 0) noPude('la ventana no tiene NINGUNA corrida');
  const hechas = leerCache(cache);
  const faltan = corridas.filter((c) => !hechas.has(c.id));

  if (orden === 'bajar') {
    const t0 = Date.now(); let n = 0;
    for (const c of faltan) {
      if (Date.now() - t0 > 7 * MIN) break;
      let jobs = null;
      for (let intento = 0; intento < 2 && !jobs; intento++) {
        try {
          const todos = []; let total = null;
          for (let p = 1; p <= 5; p++) { const j = gh(`repos/${REPO}/actions/runs/${c.id}/jobs?per_page=100&filter=all&page=${p}`); total = j.total_count; todos.push(...j.jobs); if (j.jobs.length < 100) break; }
          if (todos.length === total) jobs = todos;
        } catch { jobs = null; }
      }
      if (!jobs) noPude(`no se pudieron leer enteros los jobs de la corrida ${c.id} (guardadas ${n} en esta pasada)`);
      fs.appendFileSync(cache, `${JSON.stringify({ id: c.id, workflow: c.name, event: c.event, rama: c.head_branch, status: c.status, conclusion: c.conclusion, creada: c.created_at, jobs: jobs.map((j) => ({ name: j.name, created_at: j.created_at, started_at: j.started_at, completed_at: j.completed_at, conclusion: j.conclusion, steps: (j.steps || []).slice(0, 1).map((s) => ({ started_at: s.started_at })) })) })}\n`);
      n++;
    }
    console.log(`BAJAR · ventana ${desde} → ${hasta} · ${corridas.length} corridas · ya estaban ${hechas.size} · guardadas ahora ${n} · FALTAN ${faltan.length - n}`);
    process.exit(faltan.length - n > 0 ? 1 : 0);
  }

  if (faltan.length > 0) noPude(`faltan los jobs de ${faltan.length} de ${corridas.length} corridas: relanza «bajar». Una ocupación a medias parecería holgura.`);
  const iTsv = resto.indexOf('--tsv'); const tsv = iTsv >= 0 ? resto[iTsv + 1] : null;
  const filas = corridas.map((c) => hechas.get(c.id));
  const D = Date.parse(desde); const H = Date.parse(hasta);
  const ts = tramos(filas);
  const { ej, tir, cola, n } = porMinuto(ts, D, H);
  const suma = (a, i0 = 0, i1 = n) => { let s = 0; for (let i = i0; i < i1; i++) s += a[i]; return s; };
  const porWf = {};
  for (const f of filas) porWf[f.workflow] = (porWf[f.workflow] || 0) + 1;
  const pico = Math.max(...ej); const picoCola = Math.max(...cola);
  console.log(`OCUPACIÓN DE EJECUTORES · todo el repositorio · ventana ${desde} → ${hasta}`);
  console.log(`POBLACIÓN: ${corridas.length} corridas (${Object.entries(porWf).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' · ')}) · ${filas.reduce((s, f) => s + f.jobs.length, 0)} jobs · ${filas.filter((f) => f.conclusion === 'cancelled').length} corridas canceladas`);
  console.log(`\nJOBS-HORA EJECUTANDO: ${(suma(ej) / 60).toFixed(1)} h · de ellas, en corridas que acabaron CANCELADAS: ${(suma(tir) / 60).toFixed(1)} h (${(100 * suma(tir) / suma(ej)).toFixed(0)} %)`);
  console.log(`JOBS-HORA EN COLA (creados y sin ejecutor): ${(suma(cola) / 60).toFixed(1)} h`);
  console.log(`PICO de jobs ejecutando a la vez (media de un minuto): ${pico.toFixed(1)} · PICO de jobs en cola: ${picoCola.toFixed(1)}`);
  // ¿Hay un techo? Cuántos minutos se pasó cerca del pico, y cuánta cola había en ellos.
  const histo = {};
  for (let i = 0; i < n; i++) { const k = Math.round(ej[i]); (histo[k] ||= { min: 0, cola: 0 }); histo[k].min++; histo[k].cola += cola[i]; }
  console.log('\nMINUTOS POR NIVEL DE OCUPACIÓN (jobs ejecutando, redondeado) · minutos · cola media en esos minutos:');
  for (const k of Object.keys(histo).map(Number).sort((a, b) => a - b)) console.log(`   ${String(k).padStart(3)} jobs · ${String(histo[k].min).padStart(5)} min · cola media ${(histo[k].cola / histo[k].min).toFixed(1)}`);
  // Con cola: minutos en que había al menos un job esperando. ¿Qué parte de los ejecutores ocupaban tandas tiradas?
  let mCola = 0; let ejC = 0; let tirC = 0; let colaC = 0;
  for (let i = 0; i < n; i++) if (cola[i] >= 1) { mCola++; ejC += ej[i]; tirC += tir[i]; colaC += cola[i]; }
  console.log(`\nMINUTOS CON COLA (≥ 1 job esperando): ${mCola} de ${n}`);
  if (mCola) console.log(`   en ellos: ${(ejC / mCola).toFixed(1)} jobs ejecutando de media · ${(tirC / mCola).toFixed(1)} eran de corridas que acabaron canceladas (${(100 * tirC / ejC).toFixed(0)} % de la ocupación) · ${(colaC / mCola).toFixed(1)} esperando`);
  // Quién ocupa los ejecutores mientras hay cola: jobs-minuto por workflow y job, sólo en esos minutos.
  const conCola = new Uint8Array(n); for (let i = 0; i < n; i++) conCola[i] = cola[i] >= 1 ? 1 : 0;
  const quien = {};
  for (const t of ts) {
    if (t.tipo !== 'ejecuta') continue;
    const i0 = Math.max(0, Math.floor((t.a - D) / MIN)); const i1 = Math.min(n - 1, Math.floor((t.b - D) / MIN));
    for (let i = i0; i <= i1; i++) {
      if (!conCola[i]) continue;
      const m0 = D + i * MIN; const parte = (Math.min(t.b, m0 + MIN) - Math.max(t.a, m0)) / MIN;
      if (parte > 0) { const k = `${t.workflow} · ${t.job}`; (quien[k] ||= { total: 0, tirado: 0 }); quien[k].total += parte; if (t.tirada) quien[k].tirado += parte; }
    }
  }
  console.log('\nQUIÉN OCUPA LOS EJECUTORES EN LOS MINUTOS CON COLA · jobs-min · % de la ocupación · de ellos en corridas canceladas:');
  for (const [k, v] of Object.entries(quien).sort((a, b) => b[1].total - a[1].total).slice(0, 14)) console.log(`   ${v.total.toFixed(0).padStart(5)} · ${(100 * v.total / ejC).toFixed(0).padStart(3)} % · ${v.tirado.toFixed(0).padStart(4)} tirados · ${k}`);

  console.log('\nPOR HORA (UTC) · jobs-min ejecutando · de ellos tirados · % · jobs-min en cola · pico ejecutando:');
  const lineas = [];
  for (let h = 0; h * 60 < n; h++) {
    const i0 = h * 60; const i1 = Math.min(n, i0 + 60);
    const e = suma(ej, i0, i1); const t = suma(tir, i0, i1); const c = suma(cola, i0, i1);
    let p = 0; for (let i = i0; i < i1; i++) p = Math.max(p, ej[i]);
    const hora = new Date(D + i0 * MIN).toISOString().slice(0, 13);
    lineas.push([hora, e.toFixed(0), t.toFixed(0), e ? (100 * t / e).toFixed(0) : '0', c.toFixed(0), p.toFixed(1)]);
    console.log(`   ${hora}h · ${e.toFixed(0).padStart(5)} · ${t.toFixed(0).padStart(5)} · ${(e ? (100 * t / e).toFixed(0) : '0').padStart(3)} % · ${c.toFixed(0).padStart(5)} · ${p.toFixed(1).padStart(5)}`);
  }
  if (tsv) { fs.writeFileSync(tsv, `hora\tjobs_min_ejecutando\tjobs_min_tirados\tpct_tirado\tjobs_min_en_cola\tpico_ejecutando\n${lineas.map((l) => l.join('\t')).join('\n')}\n`); console.log(`\nfilas escritas en ${tsv}: ${lineas.length}`); }
}
