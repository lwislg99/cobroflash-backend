// Control de la repetición: para UNA familia de sesiones (prefijo del nombre), qué ficheros del repo
// editaron ese día, de quién dice el mapa que son, y qué decide el candado. Con `--como <puesto>` se
// repite la MISMA lista como si la hubiera editado otro puesto (control positivo: tiene que bloquear).
// Uso: node repeticion-detalle.mjs <árbol> <día UTC> <prefijo> [--como S2]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [arbol, dia, prefijo] = process.argv.slice(2);
const como = process.argv.includes('--como') ? process.argv[process.argv.indexOf('--como') + 1] : null;
const { reglaDe, excepcionPara, puestoDeNombre, FUENTE } = await import(pathToFileURL(path.join(arbol, 'scripts/_carriles.mjs')).href);
const mapa = JSON.parse(fs.readFileSync(path.join(arbol, '.claude/carriles.json'), 'utf8'));
const desde = Date.parse(`${dia}T00:00:00Z`), hasta = desde + 86400000;
const EDICION = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const jobs = path.join(os.homedir(), '.claude', 'jobs');
const raizDe = (f) => { let d = path.dirname(path.resolve(f)); for (;;) { if (fs.existsSync(path.join(d, '.git'))) return d; const a = path.dirname(d); if (a === d) return null; d = a; } };
const cuenta = new Map(); let sesiones = 0, fuera = 0;
const fueraMuestra = new Map();
for (const id of fs.readdirSync(jobs)) {
  let st; try { st = JSON.parse(fs.readFileSync(path.join(jobs, id, 'state.json'), 'utf8')); } catch { continue; }
  const flags = st.respawnFlags || []; const i = flags.indexOf('-n'); const nombre = i >= 0 ? flags[i + 1] : '';
  if (!st.linkScanPath || !String(nombre).startsWith(prefijo)) continue;
  let t; try { if (fs.statSync(st.linkScanPath).mtimeMs < desde) continue; t = fs.readFileSync(st.linkScanPath, 'utf8'); } catch { continue; }
  sesiones++;
  const puesto = como || puestoDeNombre(nombre, null);
  const vistos = new Set();
  for (const l of t.split('\n')) {
    if (!l.includes('"tool_use"')) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (!o || o.type !== 'assistant' || !o.message) continue;
    const cuando = Date.parse(o.timestamp || ''); if (!(cuando >= desde && cuando < hasta)) continue;
    for (const c of Array.isArray(o.message.content) ? o.message.content : []) {
      if (c.type !== 'tool_use' || !EDICION.has(c.name) || vistos.has(c.id)) continue; vistos.add(c.id);
      const f = c.input && (c.input.file_path ?? c.input.notebook_path); if (!f) continue;
      const raiz = raizDe(f);
      if (!raiz || !fs.existsSync(path.join(raiz, FUENTE))) { fuera++; const k = path.dirname(path.resolve(f)).slice(0, 60); fueraMuestra.set(k, (fueraMuestra.get(k) || 0) + 1); continue; }
      const rel = path.relative(raiz, path.resolve(f)).split(path.sep).join('/');
      const r = reglaDe(rel, mapa);
      let dec;
      if (!r) dec = 'PASA (sin regla)'; else if (!r.puesto) dec = `PASA (dueño sin puesto: «${r.dueno}»)`; else if (r.tipo === 'contenedor') dec = `PASA (contenedor de ${r.puesto})`;
      else if (r.puesto === puesto) dec = 'PASA (suyo)'; else if (excepcionPara(rel, puesto, mapa)) dec = 'PASA (excepción §3.4)'; else dec = `BLOQUEA (de ${r.puesto}, ${r.patron})`;
      const k = `${dec} · ${rel}`; cuenta.set(k, (cuenta.get(k) || 0) + 1);
    }
  }
}
console.log(`POBLACIÓN · ${sesiones} sesiones «${prefijo}*» · ${[...cuenta.values()].reduce((a, b) => a + b, 0)} ediciones dentro del repo en ${cuenta.size} ficheros · ${fuera} fuera${como ? ` · REPETIDO COMO ${como}` : ''}`);
const porDec = new Map(); for (const [k, n] of cuenta) { const d = k.split(' · ')[0].replace(/\(.*/, '').trim(); porDec.set(d, (porDec.get(d) || 0) + n); }
console.log('RESUMEN · ' + [...porDec].map(([d, n]) => `${d} ${n}`).join(' · '));
for (const [k, n] of [...cuenta].sort()) console.log(`   ×${String(n).padStart(2)} ${k}`);
console.log('FUERA (carpeta, recortada a 60) · ' + [...fueraMuestra].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${n}× ${k}`).join(' | '));
console.log('EXIT=0');
