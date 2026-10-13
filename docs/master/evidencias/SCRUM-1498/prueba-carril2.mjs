// prueba-carril2.mjs — por que sale 0: que puesto ve, y que regla le toca a cada ruta. Solo lectura.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const W = 'C:\\Users\\Javier Pereira\\cobroflash-backend\\.claude\\worktrees\\j3-censo-tablero-07oct';
const T = 'C:\\Users\\Javier Pereira\\.claude\\projects\\C--Users-Javier-Pereira-cobroflash-backend--claude-worktrees-j3-censo-tablero-07oct\\cc648ac4-e326-4329-941f-d9c2659596c3.jsonl';
const c = await import(pathToFileURL(path.join(W, 'scripts', '_carriles.mjs')).href);
const nombre = c.nombreDelTranscript(fs.readFileSync(T, 'utf8'));
console.log(`nombre leido del transcript: ${JSON.stringify(nombre)} -> puesto ${JSON.stringify(c.puestoDeNombre(nombre, null))}`);
for (const n of ['jv-j3', 'jv-j3b', 'J3', 'sesion-3', 'cobroflash-backend-90']) console.log(`   puestoDeNombre(${JSON.stringify(n)}) = ${JSON.stringify(c.puestoDeNombre(n, null))}`);
const mapa = JSON.parse(fs.readFileSync(path.join(W, '.claude', 'carriles.json'), 'utf8'));
console.log(`mapa: claves ${Object.keys(mapa).join(',')} · reglas ${Array.isArray(mapa.reglas) ? mapa.reglas.length : '?'} · git head del worktree ${spawnSync('git', ['-C', W, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()}`);
const rutas = ['scripts/equipo/tabla-ya-esta.mjs', 'scripts/equipo/ya-esta.mjs', 'scripts/equipo/sesion.mjs', '.github/workflows/ci.yml', 'docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs', 'src/modules/invoicing/pdf.service.ts'];
for (const r of rutas) { const x = c.reglaDe(r, mapa); console.log(`   reglaDe(${r}) = ${x ? JSON.stringify({ puesto: x.puesto, tipo: x.tipo, patron: x.patron, linea: x.linea, dueno: x.dueno }) : 'null'} · excepcion para J3: ${JSON.stringify(c.excepcionPara(r, 'J3', mapa) ?? null)}`); }
// Y el hook entero, con cada ruta, como lo llamaria el arnes.
for (const r of rutas) {
  const entrada = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: path.join(W, ...r.split('/')) }, transcript_path: T, cwd: W });
  const h = spawnSync('node', ['.claude/hooks/carril.mjs'], { cwd: W, input: entrada, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: 'C:\\Users\\Javier Pereira\\cobroflash-jv3' } });
  console.log(`   HOOK ${r} -> salida ${h.status} ${String(h.stderr).split('\n')[0].slice(0, 110)}`);
}
