// S0, 6-oct-2026 · ¿Qué habría hecho el candado de carril (#2001, ya en main) con las ediciones que el
// equipo hizo DE VERDAD un día dado? Y: ¿en cuántas sesiones corre? Sólo lectura.
// Repite la decisión del hook (.claude/hooks/carril.mjs) con sus mismas funciones (scripts/_carriles.mjs)
// sobre cada Edit/Write/MultiEdit/NotebookEdit de los jsonl de las sesiones de fondo de ese día.
// LÍMITES: no ve escrituras por Bash/PowerShell (el hook tampoco) · sólo sesiones con state.json en
// ~/.claude/jobs · el nombre sale de `-n` de respawnFlags, no del transcript.
// Uso: node repeticion-del-candado.mjs <árbol con main dentro> <día UTC>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [arbol, dia] = process.argv.slice(2);
const { reglaDe, excepcionPara, puestoDeNombre, FUENTE } = await import(pathToFileURL(path.join(arbol, 'scripts/_carriles.mjs')).href);
const mapa = JSON.parse(fs.readFileSync(path.join(arbol, '.claude/carriles.json'), 'utf8'));
const desde = Date.parse(`${dia}T00:00:00Z`), hasta = desde + 86400000;
const EDICION = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const jobs = path.join(os.homedir(), '.claude', 'jobs');

const raizDe = (() => {
  const memo = new Map();
  return (fichero) => {
    let d = path.dirname(path.resolve(fichero));
    const pila = [];
    for (;;) {
      if (memo.has(d)) { const r = memo.get(d); for (const p of pila) memo.set(p, r); return r; }
      pila.push(d);
      if (fs.existsSync(path.join(d, '.git'))) { for (const p of pila) memo.set(p, d); return d; }
      const arriba = path.dirname(d);
      if (arriba === d) { for (const p of pila) memo.set(p, null); return null; }
      d = arriba;
    }
  };
})();
const llevaElHook = (cwd) => {
  try { return /hooks[\\/]carril\.mjs/.test(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8')); } catch { return null; }
};

const sesiones = []; let sinEstado = 0;
for (const id of fs.readdirSync(jobs)) {
  let st; try { st = JSON.parse(fs.readFileSync(path.join(jobs, id, 'state.json'), 'utf8')); } catch { sinEstado++; continue; }
  if (!st.linkScanPath) continue;
  let m; try { m = fs.statSync(st.linkScanPath).mtimeMs; } catch { continue; }
  if (m < desde) continue;
  const flags = st.respawnFlags || []; const i = flags.indexOf('-n');
  sesiones.push({ id, nombre: i >= 0 ? flags[i + 1] : null, cwd: st.cwd || null, jsonl: st.linkScanPath, estado: st.state });
}

const filas = []; let ilegibles = 0;
for (const s of sesiones) {
  let t; try { t = fs.readFileSync(s.jsonl, 'utf8'); } catch { ilegibles++; continue; }
  const vistos = new Set(); const ediciones = [];
  let turnosHoy = 0;
  for (const l of t.split('\n')) {
    if (!l.includes('"tool_use"') && !l.includes('"usage"')) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (!o || o.type !== 'assistant' || !o.message) continue;
    const cuando = Date.parse(o.timestamp || '');
    if (!(cuando >= desde && cuando < hasta)) continue;
    turnosHoy++;
    for (const c of Array.isArray(o.message.content) ? o.message.content : []) {
      if (c.type !== 'tool_use' || !EDICION.has(c.name) || vistos.has(c.id)) continue;
      vistos.add(c.id);
      const f = c.input && (c.input.file_path ?? c.input.notebook_path);
      if (f) ediciones.push(f);
    }
  }
  if (turnosHoy === 0) continue;
  const puesto = puestoDeNombre(s.nombre, null);
  const fila = { ...s, puesto, hook: s.cwd ? llevaElHook(s.cwd) : null, ediciones: ediciones.length, fuera: 0, pasa: 0, bloquea: [], excepcion: 0 };
  for (const f of ediciones) {
    const raiz = raizDe(f);
    if (!raiz || !fs.existsSync(path.join(raiz, FUENTE))) { fila.fuera++; continue; }
    const rel = path.relative(raiz, path.resolve(f)).split(path.sep).join('/');
    if (!puesto || puesto === 'ORQ') { fila.pasa++; continue; }
    const r = reglaDe(rel, mapa);
    if (!r || !r.puesto || r.tipo === 'contenedor' || r.puesto === puesto) { fila.pasa++; continue; }
    if (excepcionPara(rel, puesto, mapa)) { fila.excepcion++; fila.pasa++; continue; }
    fila.bloquea.push(`${rel} → de ${r.puesto} (${r.patron})`);
  }
  filas.push(fila);
}

console.log(`POBLACIÓN · ${sesiones.length} sesiones de fondo con jsonl tocado desde ${dia}T00:00Z · ${sinEstado} carpetas de jobs sin state.json legible · ${ilegibles} jsonl ilegibles · ${filas.length} con algún turno ese día`);
const conHook = filas.filter((f) => f.hook === true).length, sinHook = filas.filter((f) => f.hook === false).length, nose = filas.filter((f) => f.hook === null).length;
console.log(`¿CORRE EL CANDADO? carpeta de arranque con el hook en .claude/settings.json: ${conHook} · sin él: ${sinHook} · no pude mirar: ${nose}`);
const porCwd = new Map();
for (const f of filas) { const k = `${f.cwd} [hook=${f.hook}]`; porCwd.set(k, (porCwd.get(k) || 0) + 1); }
for (const [k, n] of [...porCwd].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)} · ${k}`);
const conPuesto = filas.filter((f) => f.puesto && f.puesto !== 'ORQ');
console.log(`IDENTIDAD por nombre: con puesto ${conPuesto.length} · ORQ ${filas.filter((f) => f.puesto === 'ORQ').length} · sin puesto ${filas.filter((f) => !f.puesto).length}`);
const tot = (k) => conPuesto.reduce((a, f) => a + (k === 'bloquea' ? f.bloquea.length : f[k]), 0);
console.log(`EDICIONES de sesiones con puesto: ${tot('ediciones')} · fuera del repo ${tot('fuera')} · PASARÍAN ${tot('pasa')} (por excepción §3.4: ${tot('excepcion')}) · BLOQUEARÍA ${tot('bloquea')}`);
for (const f of filas.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))) {
  console.log(`   ${String(f.nombre).padEnd(26)} ${String(f.puesto).padEnd(4)} · ${String(f.ediciones).padStart(4)} ediciones · fuera ${String(f.fuera).padStart(3)} · pasa ${String(f.pasa).padStart(4)} · bloquea ${String(f.bloquea.length).padStart(3)}`);
  const cuenta = new Map(); for (const b of f.bloquea) cuenta.set(b, (cuenta.get(b) || 0) + 1);
  for (const [b, n] of cuenta) console.log(`        ✗ ×${n} ${b}`);
}
console.log('EXIT=0');
