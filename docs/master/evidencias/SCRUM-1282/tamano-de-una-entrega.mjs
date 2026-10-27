// S0, 6-oct-2026 · Para el SEGUNDO número de la A19 (relevo a mitad de una entrega):
//  (1) cuánto contexto consume una entrega: del arranque al primer push, y de un push al siguiente;
//  (2) con la norma «se releva al entregar por encima de T», a qué ocupación se habría relevado cada
//      sesión: la del PRIMER push dado por encima de T;
//  (3) las que cruzan T y no vuelven a empujar: dónde acaban.
// Misma lectura y mismos límites que umbral-y-entregas.mjs («entrega» = `git push`).
// Uso: node tamano-de-una-entrega.mjs <día UTC> <T>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dia = process.argv[2]; const T = Number(process.argv[3]);
const desde = Date.parse(`${dia}T00:00:00Z`), hasta = desde + 86400000;
const jobs = path.join(os.homedir(), '.claude', 'jobs');
const ES_PUSH = /\bgit\b(?:\s+-C\s+\S+)?[^|;&\n]*\bpush\b/;
const filas = [];
for (const id of fs.readdirSync(jobs)) {
  let st; try { st = JSON.parse(fs.readFileSync(path.join(jobs, id, 'state.json'), 'utf8')); } catch { continue; }
  if (!st.linkScanPath) continue;
  let t; try { if (fs.statSync(st.linkScanPath).mtimeMs < desde) continue; t = fs.readFileSync(st.linkScanPath, 'utf8'); } catch { continue; }
  const flags = st.respawnFlags || []; const i = flags.indexOf('-n');
  const usoVisto = new Set(), pushVisto = new Set(); const ocups = []; const enPush = []; let actual = 0;
  for (const l of t.split('\n')) {
    if (!l.includes('"assistant"')) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (!o || o.type !== 'assistant' || !o.message) continue;
    const cuando = Date.parse(o.timestamp || ''); if (!(cuando >= desde && cuando < hasta)) continue;
    const u = o.message.usage; const mid = o.message.id;
    if (u && !(mid && usoVisto.has(mid))) { const oc = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); if (oc > 0) { if (mid) usoVisto.add(mid); actual = oc; ocups.push(oc); } }
    for (const c of Array.isArray(o.message.content) ? o.message.content : []) {
      if (c.type !== 'tool_use' || !/^(Bash|PowerShell)$/.test(c.name) || pushVisto.has(c.id)) continue;
      const cmd = String(c.input && c.input.command || ''); if (!ES_PUSH.test(cmd) || /--dry-run/.test(cmd)) continue;
      pushVisto.add(c.id); if (actual) enPush.push(actual);
    }
  }
  if (ocups.length) filas.push({ nombre: i >= 0 ? flags[i + 1] : id, estado: st.state, primero: ocups[0], ultimo: ocups[ocups.length - 1], max: Math.max(...ocups), enPush });
}
const k = (n) => `${Math.round(n / 1000)}k`;
const orden = (a) => [...a].sort((x, y) => x - y);
const pct = (a, p) => { const b = orden(a); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1) + 0.5))]; };
const res = (a) => (a.length ? `n=${a.length} · mín ${k(Math.min(...a))} · mediana ${k(pct(a, 0.5))} · p90 ${k(pct(a, 0.9))} · máx ${k(Math.max(...a))}` : 'n=0');
const primera = [], siguientes = [];
for (const f of filas) {
  // dos pushes en el mismo turno o casi (menos de 5k de diferencia) son el mismo empujón repetido: se cuentan una vez
  const p = []; for (const x of f.enPush) if (!p.length || x - p[p.length - 1] >= 5000) p.push(x);
  f.p = p;
  if (p.length) primera.push(p[0] - f.primero);
  for (let j = 1; j < p.length; j++) siguientes.push(p[j] - p[j - 1]);
}
console.log(`POBLACIÓN · ${filas.length} sesiones con turnos el ${dia} · ${filas.filter((f) => f.p.length).length} con algún push · ${filas.reduce((a, f) => a + f.p.length, 0)} empujones distintos (los separados por menos de 5k cuentan como uno)`);
console.log(`(1) CONTEXTO QUE CONSUME UNA ENTREGA · del arranque al primer push: ${res(primera)}`);
console.log(`                                     · de un push al siguiente:    ${res(siguientes)}`);
const relevo = filas.map((f) => ({ f, x: f.p.find((v) => v > T) })).filter((r) => r.x);
console.log(`(2) CON «SE RELEVA AL ENTREGAR POR ENCIMA DE ${k(T)}» se habrían relevado ${relevo.length} sesiones, a: ${res(relevo.map((r) => r.x))}`);
console.log('    ' + orden(relevo.map((r) => r.x)).map(k).join(' · '));
const colgadas = filas.filter((f) => f.max > T && !f.p.some((v) => v > T));
console.log(`(3) CRUZAN ${k(T)} Y NO VUELVEN A EMPUJAR: ${colgadas.length} · acaban en: ${colgadas.map((f) => `${f.nombre} ${k(f.ultimo)} [${f.estado}]`).join(' · ')}`);
const seguirian = relevo.filter((r) => r.f.max > r.x + 5000);
console.log(`(4) De las ${relevo.length} de (2), SIGUIERON trabajando después de ese push ${seguirian.length}; lo que crecieron después: ${res(seguirian.map((r) => r.f.max - r.x))}`);
console.log('EXIT=0');
