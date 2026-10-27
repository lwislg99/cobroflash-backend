#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1538/d-cabos.mjs — SCRUM-1538 · SÓLO LECTURA. No hace red.
//
// Los cabos que `c-clasificar.mjs` deja sueltos, cada uno con su número al lado:
//   ① ¿de dónde sale «19 de 56»? Se reproduce sobre c-ejecuciones.tsv con la ventana de quien lo midió.
//   ② el rojo de SCRUM-1378: ¿la aserción que cayó sigue IGUAL en la punta de main?
//   ③ el trinquete colgado: ¿el mismo blob del instrumento acaba entero en otra ejecución? ¿se tocó después?
//   ④ los «failure» de fuera de la lista (Claude Code): qué línea de error trae cada log.
//   ⑤ el vigía del despliegue, ejecución a ejecución, desde el último que no dice «al-dia».
//
//   node d-cabos.mjs <carpeta con a-poblacion.json, c-ejecuciones.tsv y logs/>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [carpeta] = process.argv.slice(2);
if (!carpeta) { console.error('uso: node d-cabos.mjs <carpeta>'); process.exit(2); }
const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const git = (...a) => { try { return execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1024 * 1024 * 64 }).trimEnd(); } catch { return null; } };
const p = JSON.parse(fs.readFileSync(path.join(carpeta, 'a-poblacion.json'), 'utf8'));
const [cab, ...filas] = fs.readFileSync(path.join(carpeta, 'c-ejecuciones.tsv'), 'utf8').split('\n').filter(Boolean);
const k = cab.split('\t');
const E = filas.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [k[i], v])));
console.log(`POBLACIÓN: ${E.length} ejecuciones de c-ejecuciones.tsv · ventana ${p.desde} → ${p.hasta}`);
if (!E.length) { console.log('CIEGO: sin filas'); console.log('EXIT=3'); process.exit(3); }
const ESC = /\x1b\[[0-9;]*[A-Za-z]/g;
const texto = (id) => fs.readFileSync(path.join(carpeta, 'logs', `${id}.log`), 'utf8').split(/\r?\n/).map((l) => l.slice(29).replace(ESC, ''));

// ① «19 de 56» ─────────────────────────────────────────────────────────────────────────────
// c.19236 (SCRUM-1339, tramo 1339p) lo da para «ese job [el meta-guard]… en 19 de 56 ejecuciones de
// main», con la población creada hasta las 06:20Z del 13-oct. Aquí: mismo job, mismo corte.
const meta = E.filter((e) => e.job.startsWith('meta-guard') && e.evento === 'push');
const hasta = '2026-10-13T06:20:00Z';
const viejas = meta.filter((e) => e.creado <= hasta && e.github.startsWith('completed/') && !e.github.endsWith('cancelled'));
console.log(`\n① «19 de 56» · ejecuciones del meta-guard en push a main creadas hasta ${hasta}, acabadas: ${viejas.length} · en failure según GitHub: ${viejas.filter((e) => e.github === 'completed/failure').length} · de ésas, ROJO (alguna muda): ${viejas.filter((e) => e.estado === 'ROJO').length} · CIEGO (cola perdida): ${viejas.filter((e) => e.estado === 'CIEGO').length}`);
console.log(`   la misma cuenta con la ventana entera de este censo: ${meta.filter((e) => e.github === 'completed/failure').length} de ${meta.filter((e) => e.github.startsWith('completed/')).length}`);
console.log(`   control de cero derivado: las mismas condiciones sobre un job de nombre invertido → ${E.filter((e) => e.job.startsWith([...'meta-guard'].reverse().join(''))).length}`);

// ② SCRUM-1378 ────────────────────────────────────────────────────────────────────────────
const F = 'tests/scrum1350-latido.test.mjs';
const cuerpo = (sha) => {
  const t = git('show', `${sha}:${F}`); if (t === null) return null;
  const L = t.split(/\r?\n/); const i = L.findIndex((l) => l.startsWith("test('SCRUM-1378 · `leerTrabajos` no saca PR de `children`"));
  if (i < 0) return null; const j = L.findIndex((l, n) => n > i && l === '});');
  return L.slice(i, j + 1).join('\n');
};
const rojo1378 = E.find((e) => e.estado === 'ROJO' && e.motivo.includes('SCRUM-1378'));
if (rojo1378) {
  const a = cuerpo(rojo1378.sha); const b = cuerpo(p.punta);
  const h = (s) => (s === null ? 'NO LEÍDO' : crypto.createHash('sha256').update(s).digest('hex').slice(0, 12));
  const dice = texto(rojo1378.job_id).find((l) => l.includes('"actualizado":')) ?? '';
  const numero = /"actualizado":([\d.]+)/.exec(dice)?.[1] ?? '';
  console.log(`\n② SCRUM-1378 · job ${rojo1378.job_id} · el test en el commit del rojo: ${a?.split('\n').length} líneas, sha256 ${h(a)} · en la punta de main: ${b?.split('\n').length} líneas, sha256 ${h(b)} → ${a !== null && a === b ? 'IDÉNTICO: no hay arreglo en main' : 'DISTINTO o no leído'}`);
  console.log(`   la aserción es doesNotMatch(/1681/) sobre la fila entera; el valor que la hizo caer: actualizado=${numero} → ¿contiene «1681»? ${numero.includes('1681') ? 'SÍ, dentro de la marca de tiempo' : 'no'} · ¿y fuera de ese número? ${dice.replace(numero, '').includes('1681') ? 'sí' : 'NO'}`);
  console.log(`   control: el mismo test en un commit donde PASA trae la misma aserción: ${cuerpo(p.commits.at(-1).sha)?.includes('doesNotMatch(JSON.stringify(s), /1681/)') ? 'sí' : 'no leído'}`);
} else console.log('\n② SCRUM-1378 · no hay ese rojo en la población');

// ③ el trinquete colgado ──────────────────────────────────────────────────────────────────
const G = 'scripts/trinquete-de-zona.mjs';
const trin = E.filter((e) => e.job.startsWith('trinquete'));
const blob = (sha) => git('rev-parse', '--verify', '--quiet', `${sha}:${G}`);
const colg = trin.filter((e) => e.estado === 'COLGADA');
console.log(`\n③ TRINQUETE · ${trin.length} ejecuciones · COLGADA ${colg.length} · VERDE ${trin.filter((e) => e.estado === 'VERDE').length}`);
for (const e of colg) {
  const mismos = trin.filter((o) => o.job_id !== e.job_id && blob(o.sha) === blob(e.sha));
  console.log(`   job ${e.job_id} · ${e.creado} · ${e.sha.slice(0, 9)} · blob de ${G} ${blob(e.sha)?.slice(0, 9)} → con ese mismo blob: ${mismos.length} otras ejecuciones, VERDE ${mismos.filter((o) => o.estado === 'VERDE').length}, COLGADA ${mismos.filter((o) => o.estado === 'COLGADA').length}`);
}
if (colg.length) {
  const ult = colg.map((e) => e.creado).sort().at(-1); const shaUlt = colg.find((e) => e.creado === ult).sha;
  const despues = trin.filter((e) => e.creado > ult);
  console.log(`   la última colgada es del ${ult}; después: ${despues.length} ejecuciones, VERDE ${despues.filter((e) => e.estado === 'VERDE').length}, COLGADA ${despues.filter((e) => e.estado === 'COLGADA').length}`);
  for (const f of [G, '.github/workflows/ci.yml', 'scripts/tanda-con-veredicto.mjs']) {
    const cs = git('log', '--format=%h %cI %s', `${shaUlt}..${p.punta}`, '--', f)?.split('\n').filter(Boolean) ?? [];
    console.log(`   commits de main que tocan ${f} después de la última colgada: ${cs.length}${cs.slice(0, 6).map((c) => '\n      ' + c.slice(0, 150)).join('')}`);
  }
}

// ④ fuera de la lista ─────────────────────────────────────────────────────────────────────
const fuera = E.filter((e) => e.workflow === 'Claude Code' && e.github === 'completed/failure');
console.log(`\n④ CLAUDE CODE en failure: ${fuera.length} (workflow reactivo: lo dispara un comentario, no un commit de main)`);
for (const e of fuera) {
  const T = texto(e.job_id);
  const err = T.filter((l) => l.startsWith('##[error]')).map((l) => l.slice(9, 150));
  console.log(`   job ${e.job_id} · ${e.creado} · ${e.bytes_del_log} B · ${err.join(' ¦ ') || '(sin línea ##[error])'}`);
}

// ⑤ el vigía del despliegue ───────────────────────────────────────────────────────────────
const vig = E.filter((e) => e.job.startsWith('vigía del despliegue')).sort((a, b) => a.creado.localeCompare(b.creado));
const noAlDia = vig.map((e, i) => ({ e, i })).filter((x) => !x.e.motivo.startsWith('al-dia'));
console.log(`\n⑤ VIGÍA DEL DESPLIEGUE (informativo) · ${vig.length} ejecuciones · no dicen «al-dia»: ${noAlDia.length}`);
for (const { e, i } of noAlDia) {
  console.log(`   ${e.creado} · job ${e.job_id} · ${e.estado} · ${e.motivo}`);
  for (const s of vig.slice(i + 1, i + 3)) console.log(`      la siguiente: ${s.creado} · ${s.estado} · ${s.motivo}`);
  if (i === vig.length - 1) console.log('      (es la última de la ventana: no hay siguiente)');
}
console.log('EXIT=0');
