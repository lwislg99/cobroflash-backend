// SCRUM-1506 · re-medida 2-nov (S5). EJECUTA el hook real de un árbol como proceso, con stdin de PreToolUse,
// transcript sembrado con el nombre y carpeta de arranque (con o sin mesa) en temporales FUERA del árbol.
// Uso: node sonda1506b.mjs <raíz del árbol>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const arbol = path.resolve(process.argv[2]);
const hook = path.join(arbol, '.claude/hooks/carril.mjs');
const c = await import(pathToFileURL(path.join(arbol, 'scripts/_carriles.mjs')).href);
const mapa = JSON.parse(fs.readFileSync(path.join(arbol, '.claude/carriles.json'), 'utf8'));

// ficheros con dueño, sacados del MAPA (no supuestos)
const FICHEROS = ['src/core/cron/cron.ts', 'scripts/equipo/latido.mjs', 'public/dashboard.html'];
for (const f of FICHEROS) { const r = c.reglaDe(f, mapa); console.log(`dueño(${f}) = ${r?.puesto ?? null} (${r?.tipo ?? '-'})`); }

const casos = [];
for (const nombre of ['sesion-5', 's5-2nov', 'sesion-1', 'sesion-2', 'jv-j1', 'jv-j6', 'j6-x', null])
  for (const mesa of [null]) for (const f of FICHEROS) casos.push({ nombre, mesa, f });
casos.push({ nombre: 'jv-j6', mesa: { puesto: 'J6', nombre: 'jv-j6' }, f: 'src/core/cron/cron.ts' });
casos.push({ nombre: 'sesion-5', mesa: { puesto: 'S5', nombre: 'sesion-5' }, f: 'src/core/cron/cron.ts' });

let n = 0;
for (const k of casos) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sonda1506b-'));
  try {
    const tr = path.join(dir, 't.jsonl');
    fs.writeFileSync(tr, k.nombre ? JSON.stringify({ type: 'agent-name', agentName: k.nombre, sessionId: 'x' }) + '\n' : '');
    if (k.mesa) fs.writeFileSync(path.join(dir, '.yaqu-puesto.json'), JSON.stringify(k.mesa));
    const stdin = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: path.join(arbol, k.f) }, transcript_path: tr, cwd: dir });
    const r = spawnSync(process.execPath, [hook], { input: stdin, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
    n++;
    const dueno = c.reglaDe(k.f, mapa)?.puesto ?? null;
    console.log(`${String(k.nombre).padEnd(9)} mesa=${k.mesa ? k.mesa.puesto : '-'}  ${k.f.padEnd(26)} dueño=${dueno}  → exit ${r.status}${r.status === 2 ? ' PARA' : r.status === 0 ? ' deja' : ' ??'}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
console.log(`POBLACION=${n} casos`);
