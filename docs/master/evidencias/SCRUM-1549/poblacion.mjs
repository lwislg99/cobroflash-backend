// SCRUM-1549 · población del cerrojo de identidad. Sólo LEE ~/.claude/jobs y los jsonl.
// Uso: node docs/master/evidencias/SCRUM-1549/poblacion.mjs "$PWD" [filas.json]  (filas.json FUERA del árbol)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const REPO = process.argv[2];
const { puestoDeNombre } = await import(pathToFileURL(path.join(REPO, 'scripts/_carriles.mjs')).href);
const { identidad } = await import(pathToFileURL(path.join(REPO, '.claude/hooks/carril.mjs')).href);

const dir = path.join(os.homedir(), '.claude', 'jobs');
const MAX = 4 * 1024 * 1024;

function forma(n) {
  if (!n) return 'sin-nombre';
  const x = n.trim().toLowerCase();
  if (/^(puesto-j[1-6]|j[1-6]-[a-z0-9-]+)$/.test(x)) return 'jN-…';
  if (/^jv-j[1-6][a-z0-9-]*$/.test(x)) return 'jv-jN…';
  if (/^jv-/.test(x)) return 'jv-otro';
  if (/^(sesion-[0-5]|s[0-5]-[a-z0-9-]+)$/.test(x)) return 'sesion-N/sN-…';
  if (/^orquestador(-[a-z0-9-]+)?$/.test(x)) return 'orquestador';
  if (/^[0-9a-f]{8}$/.test(x)) return 'id-de-trabajo';
  return 'otra';
}

function leerCabeza(f) {
  const fd = fs.openSync(f, 'r');
  try {
    const b = Buffer.alloc(Math.min(MAX, fs.fstatSync(fd).size));
    fs.readSync(fd, b, 0, b.length, 0);
    return b.toString('utf8');
  } finally { fs.closeSync(fd); }
}

function veredictoHook(t) {
  const i = t.indexOf('IDENTIDAD (hook de inicio');
  if (i < 0) return 'sin-hook';
  const s = t.slice(i, i + 400);
  if (s.includes('SIN IDENTIDAD')) return 'SIN-IDENTIDAD';
  if (s.includes('DISCREPANCIA')) return 'DISCREPANCIA';
  if (s.includes('roto')) return 'ROTO';
  const m = /eres (?:el puesto ([A-Z0-9]+)|el (ORQUESTADOR)) — ([^.\\]*)/.exec(s);
  if (!m) return 'otro:' + s.slice(0, 80);
  const via = m[3].startsWith('carpeta y nombre') ? 'carpeta+nombre' : m[3].startsWith('por tu carpeta') ? 'carpeta' : m[3].startsWith('por tu nombre') ? 'nombre' : m[3];
  return `OK:${m[1] ?? 'ORQ'}:${via}`;
}

const filas = [];
let sinEstado = 0, ilegibles = 0;
for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const ruta = path.join(dir, e.name, 'state.json');
  if (!fs.existsSync(ruta)) { sinEstado++; continue; }
  let s; try { s = JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '')); } catch { ilegibles++; continue; }
  const flags = s.respawnFlags || [];
  const i = flags.indexOf('-n');
  const nombreN = i >= 0 ? flags[i + 1] : null;
  const nombre = s.name || nombreN || null;
  let hook = 'sin-transcript', cwd = null;
  const tp = s.linkScanPath;
  if (tp && fs.existsSync(tp)) {
    const t = leerCabeza(tp);
    hook = veredictoHook(t);
    const m = /"cwd":"((?:[^"\\]|\\.)*)"/.exec(t);
    if (m) cwd = JSON.parse('"' + m[1] + '"');
  }
  const soloNombre = puestoDeNombre(nombre, null);
  let hoy = 'cwd-desconocido';
  if (cwd) {
    if (!fs.existsSync(cwd)) hoy = 'cwd-borrado';
    else { const id = identidad({ proyecto: cwd, transcript: null, nombre }); hoy = id.carpetaRota ? 'ROTO' : id.discrepa ? 'DISCREPANCIA' : id.puesto ? `OK:${id.puesto}:${id.carpeta ? 'mesa' : 'nombre'}` : 'SIN-IDENTIDAD'; }
  }
  filas.push({ id: e.name, nombre, nombreN, forma: forma(nombre), creado: s.createdAt, estado: s.state, hook, soloNombre, hoy, cwd });
}

const cuenta = (k) => filas.reduce((a, f) => { const v = typeof k === 'function' ? k(f) : f[k]; a[v] = (a[v] || 0) + 1; return a; }, {});
console.log('POBLACION', filas.length, 'trabajos con state.json legible ·', sinEstado, 'sin state.json ·', ilegibles, 'ilegibles');
console.log('fechas', filas.map((f) => f.creado).filter(Boolean).sort()[0], '→', filas.map((f) => f.creado).filter(Boolean).sort().at(-1));
console.log('\nFORMA', cuenta('forma'));
console.log('\nFORMA × pasa-solo-por-nombre', cuenta((f) => `${f.forma} → ${f.soloNombre ? 'pasa' : 'CAE'}`));
console.log('\nHOOK al arrancar (lo que dijo identidad.mjs)', cuenta('hook'));
console.log('\nFORMA × HOOK', cuenta((f) => `${f.forma} | ${f.hook.replace(/^OK:[A-Z0-9]+:/, 'OK:')}`));
console.log('\nHOY (mesa actual en su cwd)', cuenta('hoy'));
const conHook = filas.filter((f) => f.hook !== 'sin-hook' && f.hook !== 'sin-transcript');
console.log('\nCON HOOK', conHook.length, '· caerían (SIN-IDENTIDAD|ROTO):', conHook.filter((f) => /^(SIN-IDENTIDAD|ROTO)$/.test(f.hook)).length);
const d24 = Date.now() - 24 * 3600e3;
const hoyF = filas.filter((f) => Date.parse(f.creado) > d24);
console.log('\nULTIMAS 24h', hoyF.length, cuenta.call(null, (f) => (Date.parse(f.creado) > d24 ? `${f.forma} | ${f.hook}` : '_fuera')));
console.log('\nNOMBRES no-jv/no-jN', [...new Set(filas.filter((f) => !/^(jv-jN…|jN-…)$/.test(f.forma)).map((f) => f.nombre))].join(', '));
console.log('\nCAEN con hook (detalle)');
for (const f of conHook.filter((f) => /^(SIN-IDENTIDAD|ROTO)$/.test(f.hook)).sort((a, b) => String(a.creado).localeCompare(String(b.creado)))) console.log(' ', f.creado, f.id, f.nombre, f.estado, f.hook, (f.cwd || '').replace(/.*worktrees[\\/]/, 'wt/'));
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(filas, null, 1));
