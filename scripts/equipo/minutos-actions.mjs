// scripts/equipo/minutos-actions.mjs — SCRUM-1284 · cuántos minutos FACTURABLES gasta Actions, y en qué
//
//   node scripts/equipo/minutos-actions.mjs --desde 2026-09-22 --hasta 2026-09-28 [--precio 0.006] [--json f.json]
//
// POR QUÉ: el fundador quiere pasar el repositorio a privado, y en privado GitHub cobra los minutos de
// Actions. La primera estimación (29-sep-2026) salió 3,7 veces por debajo: tomaba la duración de la
// CORRIDA, y GitHub factura cada JOB por separado, redondeado al minuto hacia arriba. El CI lanza seis
// jobs en paralelo, así que una corrida de 10 min de reloj son ~45 min de factura. Este guion mide lo
// que se paga, no lo que se tarda, y se vuelve a correr cada vez que se toque un workflow.
//
// QUÉ CUENTA COMO MINUTO (la regla de facturación de GitHub, y la única que aplica aquí):
//   · cada job con `started_at` y `completed_at` → ceil(segundos / 60), mínimo 1;
//   · un job `skipped` NO arranca runner y NO se paga (el avisador de rojo sale así en 6 de cada 10);
//   · los intentos anteriores de una corrida relanzada SÍ se pagaron: se suman.
//
// LA CONDICIÓN QUE NO SE NEGOCIA: sale VERDE (0) solo si ha leído TODAS las corridas que la API declara
// para cada día y los jobs de cada una. La API corta en 1.000 resultados por búsqueda —por eso se
// pregunta día a día— y si aun así un día viene truncado, o falla la lectura de jobs de una sola corrida,
// sale NO_PUDE_MIRAR (2) diciendo cuántas faltan. Un total de minutos sobre una población incompleta
// parece un ahorro y no lo es.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SALIDA = { VERDE: 0, NO_PUDE_MIRAR: 2 };
const REPO_POR_DEFECTO = 'lwislg99/cobroflash-backend';
const GH_WINDOWS = 'C:\\Program Files\\GitHub CLI\\gh.exe';

/** Minutos que GitHub factura por UN job. `skipped` o sin marcas de tiempo = 0. */
export function minutosDeJob(job) {
  if (!job || job.conclusion === 'skipped' || !job.started_at || !job.completed_at) return 0;
  const s = (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000;
  if (!Number.isFinite(s)) return 0;
  return Math.ceil(Math.max(1, s) / 60);
}

/**
 * Agrega corridas ya leídas: `[{ name, event, jobs: [...], intentosPrevios: [[...jobs]] }]`.
 * Devuelve totales por flujo y, dentro de cada flujo, por job.
 */
export function resumir(corridas) {
  const porFlujo = new Map();
  let total = 0;
  for (const c of corridas) {
    const f = porFlujo.get(c.name) ?? { corridas: 0, minutos: 0, conMinutos: 0, porJob: new Map() };
    const jobs = [...(c.jobs ?? []), ...(c.intentosPrevios ?? []).flat()];
    let m = 0;
    for (const j of jobs) {
      const mj = minutosDeJob(j);
      m += mj;
      if (mj > 0) f.porJob.set(j.name, (f.porJob.get(j.name) ?? 0) + mj);
    }
    f.corridas++; f.minutos += m; if (m > 0) f.conMinutos++;
    porFlujo.set(c.name, f);
    total += m;
  }
  return { total, corridas: corridas.length, porFlujo };
}

/** VERDE solo con la población entera leída. */
export function veredicto({ declaradas, leidas, jobsSinLeer }) {
  const motivos = [];
  if (!(declaradas > 0)) motivos.push('la API no declaró ninguna corrida en el periodo');
  if (leidas < declaradas) motivos.push(`faltan ${declaradas - leidas} de ${declaradas} corridas (truncado)`);
  if (jobsSinLeer > 0) motivos.push(`${jobsSinLeer} corrida(s) sin sus jobs`);
  return motivos.length ? { codigo: SALIDA.NO_PUDE_MIRAR, motivos } : { codigo: SALIDA.VERDE, motivos };
}

function token() {
  const gh = process.env.GH_BIN || (process.platform === 'win32' && fs.existsSync(GH_WINDOWS) ? GH_WINDOWS : 'gh');
  return execFileSync(gh, ['auth', 'token']).toString().trim();
}

async function medir({ repo, desde, hasta, concurrencia = 12 }) {
  const H = { Authorization: `Bearer ${token()}`, Accept: 'application/vnd.github+json' };
  const api = async (p) => {
    for (let i = 0; ; i++) {
      const r = await fetch(`https://api.github.com/${p}`, { headers: H });
      if (r.ok) return r.json();
      if (i === 3) throw new Error(`${r.status} ${p}`);
      await new Promise((s) => setTimeout(s, 2000 * (i + 1)));
    }
  };
  const corridas = [];
  let declaradas = 0;
  for (let d = new Date(`${desde}T00:00:00Z`); d <= new Date(`${hasta}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) {
    const dia = d.toISOString().slice(0, 10);
    for (let page = 1; page <= 10; page++) {
      const j = await api(`repos/${repo}/actions/runs?created=${dia}&per_page=100&page=${page}`);
      if (page === 1) declaradas += j.total_count;
      corridas.push(...j.workflow_runs);
      if (j.workflow_runs.length < 100) break;
    }
  }
  let i = 0; let jobsSinLeer = 0;
  const trabajador = async () => {
    while (i < corridas.length) {
      const c = corridas[i++];
      try {
        c.jobs = (await api(`repos/${repo}/actions/runs/${c.id}/attempts/${c.run_attempt}/jobs?per_page=100`)).jobs;
        c.intentosPrevios = [];
        for (let a = 1; a < c.run_attempt; a++) {
          c.intentosPrevios.push((await api(`repos/${repo}/actions/runs/${c.id}/attempts/${a}/jobs?per_page=100`)).jobs);
        }
      } catch { jobsSinLeer++; c.jobs = []; }
    }
  };
  await Promise.all(Array.from({ length: concurrencia }, trabajador));
  return { corridas, declaradas, jobsSinLeer };
}

function argumento(nombre, porDefecto) {
  const k = process.argv.indexOf(`--${nombre}`);
  return k > -1 ? process.argv[k + 1] : porDefecto;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const desde = argumento('desde'); const hasta = argumento('hasta');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(hasta ?? '')) {
    console.error('uso: --desde AAAA-MM-DD --hasta AAAA-MM-DD [--precio 0.006] [--repo o/r] [--json fichero]');
    process.exit(SALIDA.NO_PUDE_MIRAR);
  }
  const precio = Number(argumento('precio', '0.006'));
  const { corridas, declaradas, jobsSinLeer } = await medir({ repo: argumento('repo', REPO_POR_DEFECTO), desde, hasta });
  const r = resumir(corridas);
  const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1;
  console.log(`Población: ${corridas.length} corridas leídas de ${declaradas} declaradas por la API · ${desde} → ${hasta} (${dias} días, UTC)`);
  console.log(`Minutos facturables: ${r.total} · al mes (×30/${dias}): ${Math.round(r.total * 30 / dias)} · a ${precio} $/min: ${Math.round(r.total * 30 / dias * precio)} $/mes (sin descontar los gratuitos del plan)`);
  for (const [nombre, f] of [...r.porFlujo].sort((a, b) => b[1].minutos - a[1].minutos)) {
    console.log(`  ${nombre.padEnd(34)} ${String(f.corridas).padStart(5)} corridas · ${String(f.minutos).padStart(6)} min · ${f.conMinutos} con runner`);
    if (f.porJob.size > 1) for (const [j, m] of [...f.porJob].sort((a, b) => b[1] - a[1])) console.log(`      ${j.padEnd(56)} ${m}`);
  }
  const json = argumento('json');
  if (json) fs.writeFileSync(json, JSON.stringify(corridas.map((c) => ({ id: c.id, name: c.name, event: c.event, sha: c.head_sha, branch: c.head_branch, created: c.created_at, conclusion: c.conclusion, attempt: c.run_attempt, jobs: (c.jobs ?? []).map((j) => ({ name: j.name, conclusion: j.conclusion, minutos: minutosDeJob(j) })) }))));
  const v = veredicto({ declaradas, leidas: corridas.length, jobsSinLeer });
  if (v.codigo !== SALIDA.VERDE) console.error(`🔴 NO PUDE MIRAR: ${v.motivos.join(' · ')}. Los totales de arriba son de una población INCOMPLETA.`);
  process.exit(v.codigo);
}
