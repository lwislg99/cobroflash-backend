// Censo: cada vez que una sesión EJECUTÓ la puerta y recibió ALTERADO (salida cruda de `salir`),
// con su hora. Población declarada: todos los .jsonl bajo la carpeta dada.
// Control positivo: cuenta también NO-PUDE-MIRAR de la puerta y los ESTADO buenos, para ver que
// el instrumento ve ejecuciones de la puerta y no sólo textos que la citan.
import fs from 'node:fs';
import path from 'node:path';
const raiz = process.argv[2];
const ficheros = [];
(function andar(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) andar(p); else if (e.name.endsWith('.jsonl')) ficheros.push(p);
  }
})(raiz);
const eventos = [];
let lineas = 0;
const textoDe = (c) => typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x.text ?? '').join('\n') : '';
for (const f of ficheros) {
  const usos = new Map();
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!l) continue; lineas++;
    let o; try { o = JSON.parse(l); } catch { continue; }
    const cont = o.message?.content;
    if (!Array.isArray(cont)) continue;
    for (const b of cont) {
      if (b.type === 'tool_use') usos.set(b.id, JSON.stringify(b.input ?? {}));
      if (b.type !== 'tool_result') continue;
      const t = textoDe(b.content);
      const orden = usos.get(b.tool_use_id) ?? '';
      if (!/sesion\.mjs/.test(orden)) continue; // sólo ejecuciones que nombran la puerta
      if (!/yaqu-equipo/i.test(orden)) continue; // de la copia INSTALADA
      let v = null;
      const m = t.match(/"veredicto":"([A-Z-]+)"(?:,"motivo":"([^"]*)")?/);
      if (m) v = m[1];
      if (!v) continue;
      eventos.push({ cuando: o.timestamp, sesion: path.basename(f, '.jsonl').slice(0, 8), v, motivo: (m[2] || '').slice(0, 80) });
    }
  }
}
eventos.sort((a, b) => (a.cuando < b.cuando ? -1 : 1));
const porV = {};
for (const e of eventos) porV[e.v] = (porV[e.v] || 0) + 1;
console.log(JSON.stringify({ poblacion: { ficheros: ficheros.length, lineas }, ejecuciones: eventos.length, porVeredicto: porV }, null, 1));
for (const e of eventos.filter((e) => e.v === 'ALTERADO' || e.v === 'NO-PUDE-MIRAR' || e.v === 'DESDE-UN-ARBOL')) console.log(e.cuando, e.sesion, e.v, e.motivo);
