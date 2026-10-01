// scripts/equipo/intermitente-1281.mjs — ¿el rojo de `build + tests` es SOLO el intermitente de SCRUM-1281?
//
//   node scripts/equipo/intermitente-1281.mjs --log job.log --job job.json
//     job.log  → el log del job `build + tests` (GET /actions/jobs/{id}/logs)
//     job.json → el job (GET /actions/jobs/{id}), para saber QUÉ PASOS cayeron
//
// POR QUÉ: el único check obligatorio cae a veces por una avería que no es del código del PR: git
// pierde un fichero bajo `.git/objects` mientras monta o clona la fixture de censos (SCRUM-1281; 4
// veces del 24 al 29-sep, en scrum775 ×2, scrum753 y scrum388). La decisión del equipo de Javier es
// que un relanzamiento exige leer el log antes. Esto lo lee la máquina y deja el veredicto escrito,
// para que «¿era el intermitente?» sea un dato y no un juicio.
//
// VEREDICTOS (primera línea de la salida; la segunda es el motivo en una frase):
//   INTERMITENTE (0) — el único paso caído es el de los tests y TODOS los tests caídos traen la firma.
//   NO-ES-EL-INTERMITENTE (1) — hay al menos un fallo sin la firma, o cayó otro paso. Rojo de verdad.
//   CIEGO (2) — no hay log, no hay pasos, o no se encuentra la lista de fallos: no se sabe.
// 🔴 Nunca sale INTERMITENTE por defecto. Un rojo mixto (el 25-sep: scrum775 con la firma y scrum804b
//    con un fallo real en el mismo job) es NO-ES-EL-INTERMITENTE: relanzarlo colaría el rojo de verdad.
//
// LA FIRMA, en dos formas:
//   · el marcador que emite la fixture desde SCRUM-1281 (lo mantiene S3 en `tests/_censo-fixture.mjs`,
//     exportado como FIRMA_1281): una línea que empieza por `[SCRUM-1281-FIRMA]`;
//   · y, para los logs de antes de ese marcador, el texto crudo de git que salió en los cuatro casos:
//     «failed to copy file to '…/.git/objects/…': No such file or directory» o
//     «unable to create temporary file: No such file or directory» seguido de «failed to write … object».

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SALIDA = { INTERMITENTE: 0, NO_ES: 1, CIEGO: 2 };
export const MARCADOR = '[SCRUM-1281-FIRMA]';
/** El paso de `ci.yml` que corre la tanda. Si cae cualquier otro, no es (solo) el intermitente. */
export const PASO_DE_LA_TANDA = 'Tests (incluidos los de banco desechable)';

const FIRMA_CRUDA = [
  /failed to copy file to '[^']*\/\.git\/objects\/[^']*': No such file or directory/,
  /unable to create temporary file: No such file or directory[\s\S]{0,300}?failed to write (?:commit )?object/,
];

export function traeLaFirma(texto) {
  const t = String(texto ?? '');
  return t.includes(MARCADOR) || FIRMA_CRUDA.some((re) => re.test(t));
}

/** Quita el sello de hora que GitHub antepone a cada línea del log. */
const sinSello = (l) => l.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z ?/, '');

/**
 * Los fallos de la sección «✖ failing tests:» del reporter `spec`, cada uno con su texto.
 * Devuelve null si la sección no está (no es lo mismo que «no hay fallos»).
 */
export function fallosDeLaTanda(lineas) {
  let ini = -1;
  for (let i = lineas.length - 1; i >= 0; i--) if (lineas[i].startsWith('✖ failing tests:')) { ini = i; break; }
  if (ini === -1) return null;
  const fallos = [];
  for (let i = ini + 1; i < lineas.length; i++) {
    const l = lineas[i];
    if (l.startsWith('##[')) break;
    const m = /^test at (tests\/[^:]+):\d+:\d+/.exec(l);
    if (m) { fallos.push({ fichero: m[1], texto: [] }); continue; }
    if (fallos.length) fallos.at(-1).texto.push(l);
  }
  return fallos.map((f) => ({ ...f, texto: f.texto.join('\n') }));
}

/**
 * Un fichero que cae A NIVEL DE PROCESO solo dice «'test failed'» en la sección de fallos: su error
 * salió antes, como stderr, justo encima de la línea `✖ <fichero> (…ms)`. Se toma ese bloque, hasta
 * el resultado anterior (`✔ …` / `✖ …`), y solo cuenta si su pila nombra ESE fichero.
 */
export function stderrDelFichero(lineas, fichero, hasta = lineas.length) {
  const j = lineas.findIndex((l, k) => k < hasta && l.startsWith(`✖ ${fichero} (`));
  if (j === -1) return '';
  let i = j - 1;
  while (i >= 0 && j - i < 400 && !/^[✔✖﹣] /.test(lineas[i])) i--;
  const bloque = lineas.slice(i + 1, j).join('\n');
  return bloque.includes(fichero) ? bloque : '';
}

export function clasificar({ log, job }) {
  if (!log || !String(log).trim()) return { codigo: SALIDA.CIEGO, veredicto: 'CIEGO', motivo: 'no hay log del job' };
  const pasos = Array.isArray(job?.steps) ? job.steps : null;
  if (!pasos || pasos.length === 0) return { codigo: SALIDA.CIEGO, veredicto: 'CIEGO', motivo: 'no hay pasos del job: no sé qué cayó' };
  const caidos = pasos.filter((p) => p.conclusion === 'failure').map((p) => p.name);
  if (caidos.length === 0) return { codigo: SALIDA.CIEGO, veredicto: 'CIEGO', motivo: 'el job no tiene ningún paso en failure' };
  const otros = caidos.filter((n) => n !== PASO_DE_LA_TANDA);
  if (otros.length) {
    return { codigo: SALIDA.NO_ES, veredicto: 'NO-ES-EL-INTERMITENTE', motivo: `cayó otro paso además de la tanda: ${otros.join(', ')}` };
  }
  const lineas = String(log).split(/\r?\n/).map(sinSello);
  const fallos = fallosDeLaTanda(lineas);
  if (!fallos) return { codigo: SALIDA.CIEGO, veredicto: 'CIEGO', motivo: 'el paso de la tanda cayó pero no encuentro «✖ failing tests:» en el log' };
  if (fallos.length === 0) return { codigo: SALIDA.CIEGO, veredicto: 'CIEGO', motivo: 'la lista de fallos está vacía' };
  const inicioSeccion = lineas.findLastIndex((l) => l.startsWith('✖ failing tests:'));
  const detalle = fallos.map((f) => ({
    fichero: f.fichero,
    firma: traeLaFirma(f.texto) || traeLaFirma(stderrDelFichero(lineas, f.fichero, inicioSeccion)),
  }));
  const sin = detalle.filter((d) => !d.firma);
  const lista = [...new Set(detalle.map((d) => d.fichero))].join(', ');
  if (sin.length === 0) {
    return { codigo: SALIDA.INTERMITENTE, veredicto: 'INTERMITENTE', detalle,
      motivo: `los ${detalle.length} fallo(s) de la tanda traen la firma de SCRUM-1281 (${lista}) y no cayó ningún otro paso` };
  }
  return { codigo: SALIDA.NO_ES, veredicto: 'NO-ES-EL-INTERMITENTE', detalle,
    motivo: `${sin.length} de ${detalle.length} fallo(s) SIN la firma: ${[...new Set(sin.map((d) => d.fichero))].join(', ')}` };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// MODO CI — lo llama `avisador-rojo.yml` cuando el CI de un commit termina en failure:
//   node scripts/equipo/intermitente-1281.mjs ci
// Lee el job `build + tests` de ESA corrida y ESE intento, lo clasifica, y en cada PR ABIERTO de ese
// commit pone o quita la etiqueta y deja UN comentario por commit. Sin `@claude`: esto informa, no
// despierta a nadie (el despertar es del paso «Avisar a la sesión», que no se toca).
// No falla nunca el job: el veredicto va a los outputs del paso, al resumen y a una anotación.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
export const ETIQUETA = 'intermitente-1281';
export const PREFIJO_JOB_OBLIGATORIO = 'build + tests';
export const marcaDelComentario = (sha) => `<!-- intermitente-1281:${String(sha).slice(0, 12)} -->`;

export function cuerpoDelComentario({ sha, motivo, urlRun }) {
  return [
    marcaDelComentario(sha),
    `**El rojo de \`build + tests\` en \`${String(sha).slice(0, 7)}\` es SOLO el intermitente de SCRUM-1281**: ${motivo}.`,
    '',
    'No lo ha causado el código de este PR: git perdió un fichero bajo `.git/objects` en la fixture de censos. Se puede relanzar el job. Este comentario es el log ya leído (decisión del 29-sep-2026: un relanzamiento exige leer el log antes). Si el siguiente rojo trae otra firma, ya no es esto, y la etiqueta se quita sola.',
    '',
    `Run: ${urlRun}`,
  ].join('\n');
}

export async function enCI({ env = process.env, fetchFn = fetch } = {}) {
  const { GH_TOKEN, REPO, RUN_ID, INTENTO, SHA, URL_RUN } = env;
  const H = { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' };
  const api = (ruta, init = {}) => fetchFn(`https://api.github.com/${ruta}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const res = { veredicto: 'CIEGO', motivo: '', prs: [], acciones: [] };
  if (!GH_TOKEN || !REPO || !RUN_ID || !SHA) { res.motivo = 'faltan variables (GH_TOKEN/REPO/RUN_ID/SHA)'; return res; }

  const rj = await api(`repos/${REPO}/actions/runs/${RUN_ID}/attempts/${INTENTO || 1}/jobs?per_page=100`).catch(() => null);
  if (!rj?.ok) { res.motivo = `no pude leer los jobs de la corrida (${rj?.status ?? 'red'})`; return res; }
  const job = ((await rj.json()).jobs ?? []).find((j) => String(j.name).startsWith(PREFIJO_JOB_OBLIGATORIO));
  if (!job) { res.motivo = `la corrida no tiene job «${PREFIJO_JOB_OBLIGATORIO}…»`; return res; }
  if (job.conclusion !== 'failure') {
    res.veredicto = 'NO-APLICA';
    res.motivo = `el check obligatorio no cayó (${job.conclusion}); el rojo es de un informativo`;
    return res;
  }
  const rl = await api(`repos/${REPO}/actions/jobs/${job.id}/logs`).catch(() => null);
  const log = rl?.ok ? await rl.text() : '';
  const c = clasificar({ log, job });
  res.veredicto = c.veredicto; res.motivo = c.motivo;
  if (c.veredicto === 'CIEGO') return res; // sin veredicto no se toca ninguna etiqueta

  const rp = await api(`repos/${REPO}/commits/${SHA}/pulls`).catch(() => null);
  if (!rp?.ok) { res.acciones.push(`no pude leer los PR del commit (${rp?.status ?? 'red'}): no se etiqueta nada`); return res; }
  res.prs = (await rp.json()).filter((p) => p.state === 'open').map((p) => p.number);

  for (const pr of res.prs) {
    if (c.veredicto === 'INTERMITENTE') {
      await api(`repos/${REPO}/labels`, { method: 'POST', body: JSON.stringify({ name: ETIQUETA, color: 'fbca04',
        description: 'El último rojo de build + tests fue SOLO el intermitente de SCRUM-1281' }) }).catch(() => null); // 422 si ya existe
      const re = await api(`repos/${REPO}/issues/${pr}/labels`, { method: 'POST', body: JSON.stringify({ labels: [ETIQUETA] }) }).catch(() => null);
      res.acciones.push(`#${pr}: etiqueta ${re?.ok ? 'puesta' : `NO puesta (${re?.status ?? 'red'})`}`);
      const marca = marcaDelComentario(SHA);
      const rc = await api(`repos/${REPO}/issues/${pr}/comments?per_page=100`).catch(() => null);
      if (!rc?.ok) { res.acciones.push(`#${pr}: no pude leer los comentarios, así que no comento (evito duplicar)`); continue; }
      if ((await rc.json()).some((k) => String(k.body).includes(marca))) { res.acciones.push(`#${pr}: ya comentado para este commit`); continue; }
      const cuerpo = cuerpoDelComentario({ sha: SHA, motivo: c.motivo, urlRun: URL_RUN });
      const rn = await api(`repos/${REPO}/issues/${pr}/comments`, { method: 'POST', body: JSON.stringify({ body: cuerpo }) }).catch(() => null);
      res.acciones.push(`#${pr}: comentario ${rn?.ok ? 'publicado' : `NO publicado (${rn?.status ?? 'red'})`}`);
    } else {
      const rd = await api(`repos/${REPO}/issues/${pr}/labels/${ETIQUETA}`, { method: 'DELETE' }).catch(() => null);
      res.acciones.push(`#${pr}: etiqueta ${rd?.ok ? 'quitada' : 'no estaba'}`);
    }
  }
  return res;
}

function argumento(nombre) {
  const k = process.argv.indexOf(`--${nombre}`);
  return k > -1 ? process.argv[k + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'ci') {
  const r = await enCI();
  const linea = `- **${r.veredicto}** — ${r.motivo}${r.prs.length ? ` · PR abiertos: ${r.prs.map((n) => `#${n}`).join(', ')}` : ' · sin PR abierto: el veredicto queda solo aquí'}`;
  const escribir = (f, t) => { try { if (f) fs.appendFileSync(f, t); } catch { /* sin fichero no hay dónde */ } };
  escribir(process.env.GITHUB_OUTPUT, `veredicto=${r.veredicto}\n`);
  escribir(process.env.GITHUB_STEP_SUMMARY, `### ¿Es el intermitente de SCRUM-1281?\n${linea}\n${r.acciones.map((a) => `  - ${a}`).join('\n')}\n`);
  console.log(linea); for (const a of r.acciones) console.log(`  ${a}`);
  const nivel = r.veredicto === 'INTERMITENTE' ? 'notice' : r.veredicto === 'CIEGO' ? 'warning' : null;
  if (nivel) console.log(`::${nivel} title=SCRUM-1281 · ${r.veredicto}::${r.motivo.replace(/\n/g, ' ')}`);
  process.exit(0);
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Sin BOM: un fichero escrito con `>` en PowerShell 5.1 lo lleva, y JSON.parse lo rechaza.
  const leer = (f) => { try { return f ? fs.readFileSync(f, 'utf8').replace(/^﻿/, '') : ''; } catch { return ''; } };
  let job = null;
  try { job = JSON.parse(leer(argumento('job'))); } catch { job = null; }
  const r = clasificar({ log: leer(argumento('log')), job });
  console.log(r.veredicto);
  console.log(r.motivo);
  process.exit(r.codigo);
}
