// S0, 6-oct-2026 · ¿Se sostiene un umbral de relevo T «al terminar una entrega»?
// Para cada sesión de fondo con algún turno ese día (UTC): cuándo cruza T, cuántos `git push` había dado
// ANTES de cruzarlo, cuántos da DESPUÉS (ahí es donde la norma «al entregar» puede saltar), y dónde acaba.
// Ocupación de un turno = input + cache_read + cache_creation (A19). Sólo lectura.
// «Entrega» aquí = una orden de terminal con `git push` (sin --dry-run). Es un sustituto: un push no es
// una entrega verificada, y una entrega sin push (un informe en Jira) no se ve.
// Uso: node umbral-y-entregas.mjs <día UTC> [umbrales separados por coma]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dia = process.argv[2];
const UMBRALES = (process.argv[3] || '200000,300000,400000,500000').split(',').map(Number);
const desde = Date.parse(`${dia}T00:00:00Z`), hasta = desde + 86400000;
const jobs = path.join(os.homedir(), '.claude', 'jobs');
const ES_PUSH = /\bgit\b(?:\s+-C\s+\S+)?[^|;&\n]*\bpush\b/;
const sesiones = [];
for (const id of fs.readdirSync(jobs)) {
  let st; try { st = JSON.parse(fs.readFileSync(path.join(jobs, id, 'state.json'), 'utf8')); } catch { continue; }
  if (!st.linkScanPath) continue;
  let m; try { m = fs.statSync(st.linkScanPath).mtimeMs; } catch { continue; }
  if (m < desde) continue;
  const flags = st.respawnFlags || []; const i = flags.indexOf('-n');
  sesiones.push({ nombre: i >= 0 ? flags[i + 1] : `(${id})`, estado: st.state, jsonl: st.linkScanPath });
}
const filas = [];
for (const s of sesiones) {
  let t; try { t = fs.readFileSync(s.jsonl, 'utf8'); } catch { continue; }
  const usoVisto = new Set(), pushVisto = new Set();
  const turnos = []; // { ocup, pushes }
  let actual = null, veniaDeAntes = false;
  for (const l of t.split('\n')) {
    if (!l.includes('"assistant"')) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (!o || o.type !== 'assistant' || !o.message) continue;
    const cuando = Date.parse(o.timestamp || '');
    if (!(cuando >= desde && cuando < hasta)) { if (cuando < desde) veniaDeAntes = true; continue; }
    const u = o.message.usage; const id = o.message.id;
    if (u && !(id && usoVisto.has(id))) {
      const ocup = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      if (ocup > 0) { if (id) usoVisto.add(id); actual = { ocup, pushes: 0 }; turnos.push(actual); }
    }
    for (const c of Array.isArray(o.message.content) ? o.message.content : []) {
      if (c.type !== 'tool_use' || !/^(Bash|PowerShell)$/.test(c.name) || pushVisto.has(c.id)) continue;
      const cmd = String(c.input && c.input.command || '');
      if (!ES_PUSH.test(cmd) || /--dry-run/.test(cmd)) continue;
      pushVisto.add(c.id); if (actual) actual.pushes++;
    }
  }
  if (!turnos.length) continue;
  const f = { ...s, veniaDeAntes, turnos: turnos.length, primero: turnos[0].ocup, max: Math.max(...turnos.map((x) => x.ocup)), ultimo: turnos[turnos.length - 1].ocup, pushes: turnos.reduce((a, x) => a + x.pushes, 0), por: {} };
  const iPrimerPush = turnos.findIndex((x) => x.pushes > 0);
  f.ocupPrimerPush = iPrimerPush >= 0 ? turnos[iPrimerPush].ocup : null;
  let iUltimoPush = -1; turnos.forEach((x, i) => { if (x.pushes > 0) iUltimoPush = i; });
  f.ocupUltimoPush = iUltimoPush >= 0 ? turnos[iUltimoPush].ocup : null;
  for (const T of UMBRALES) {
    const i = turnos.findIndex((x) => x.ocup > T);
    f.por[T] = i < 0 ? null : { turno: i + 1, antes: turnos.slice(0, i).reduce((a, x) => a + x.pushes, 0), despues: turnos.slice(i).reduce((a, x) => a + x.pushes, 0) };
  }
  filas.push(f);
}
const k = (n) => (n == null ? '—' : `${Math.round(n / 1000)}k`);
const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.floor((b.length - 1) / 2)]; };
const rango = (a) => (a.length ? `mín ${k(Math.min(...a))} · mediana ${k(med(a))} · máx ${k(Math.max(...a))}` : 'sin datos');
console.log(`POBLACIÓN · ${sesiones.length} sesiones de fondo con jsonl tocado desde ${dia}T00:00Z · ${filas.length} con algún turno ese día · vienen de un día anterior ${filas.filter((f) => f.veniaDeAntes).length}`);
console.log(`ESTADO al medir: ${['working', 'done', 'blocked'].map((e) => `${e} ${filas.filter((f) => f.estado === e).length}`).join(' · ')} · otro ${filas.filter((f) => !['working', 'done', 'blocked'].includes(f.estado)).length}`);
const conPush = filas.filter((f) => f.pushes > 0);
console.log(`ENTREGAS (git push): ${conPush.length} de ${filas.length} sesiones dieron alguno · total ${filas.reduce((a, f) => a + f.pushes, 0)} · ocupación en el PRIMER push: ${rango(conPush.map((f) => f.ocupPrimerPush))} · en el ÚLTIMO: ${rango(conPush.map((f) => f.ocupUltimoPush))}`);
for (const T of UMBRALES) {
  const cruzan = filas.filter((f) => f.por[T]);
  const yaEntrego = cruzan.filter((f) => f.por[T].antes > 0).length;
  const salta = cruzan.filter((f) => f.por[T].despues > 0).length;
  const primerPushDebajo = conPush.filter((f) => f.ocupPrimerPush <= T).length;
  console.log(`UMBRAL ${k(T)} · lo cruzan ${cruzan.length} de ${filas.length} · al cruzarlo YA habían empujado ${yaEntrego} de ${cruzan.length} · empujan DESPUÉS de cruzarlo (la norma «al entregar» puede saltar) ${salta} de ${cruzan.length} · cruzan y NO vuelven a empujar ${cruzan.length - salta} · primer push por debajo del umbral ${primerPushDebajo} de ${conPush.length}`);
}
const acabadas = filas.filter((f) => f.estado !== 'working');
for (const e of ['done', 'blocked']) console.log(`DÓNDE ACABAN las «${e}» (último turno): n=${acabadas.filter((f) => f.estado === e).length} · ${rango(acabadas.filter((f) => f.estado === e).map((f) => f.ultimo))}`);
const tramos = [[0, 200000], [200000, 300000], [300000, 400000], [400000, 500000], [500000, 800000], [800000, Infinity]];
console.log('REPARTO del ÚLTIMO turno de las acabadas: ' + tramos.map(([a, b]) => `${k(a)}-${b === Infinity ? '∞' : k(b)} ${acabadas.filter((f) => f.ultimo > a && f.ultimo <= b).length}`).join(' · '));
console.log('REPARTO del MÁXIMO de todas:             ' + tramos.map(([a, b]) => `${k(a)}-${b === Infinity ? '∞' : k(b)} ${filas.filter((f) => f.max > a && f.max <= b).length}`).join(' · '));
for (const f of filas.sort((a, b) => b.max - a.max)) {
  console.log(`   ${String(f.nombre).padEnd(12)} ${String(f.estado).padEnd(8)} máx ${k(f.max).padStart(5)} · último ${k(f.ultimo).padStart(5)} · ${String(f.turnos).padStart(4)} turnos · ${String(f.pushes).padStart(2)} push · 1.er push a ${k(f.ocupPrimerPush).padStart(5)} · último push a ${k(f.ocupUltimoPush).padStart(5)} · ` + UMBRALES.map((T) => `${k(T)}:${f.por[T] ? `${f.por[T].antes}/${f.por[T].despues}` : '—'}`).join(' '));
}
console.log('   (por umbral: pushes antes de cruzarlo / pushes después)');
console.log('EXIT=0');
