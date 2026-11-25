// Punta a punta: el driver CURADO (correr + aplicarUna) sobre un guard de navegador REAL, con las dos
// mutaciones que J6 probó fuera del driver (SCRUM-1789c). Desde la raíz del worktree.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = process.cwd();
const mg = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const GUARD = 'scripts/guard-ficha-de-factura.mjs';
const CSS = 'public/dashboard/css/styles.css';
const original = fs.readFileSync(path.join(RAIZ, CSS));
const t0 = Date.now();
const limpia = await mg.correr(GUARD);
console.log(`base: código ${limpia.codigo} · ciego del guard: ${limpia.ciegoDelGuard ?? '(ninguno)'} · movidos ${limpia.movidos.length} · ${Math.round((Date.now() - t0) / 1000)} s`);
const CASOS = [
  { id: 'declarada', espera: 'VIVA', m: { fichero: CSS, de: '.j1-prog { display:flex;', a: '.j1-prog { display:none;', cae: 'la línea de progreso no se ve' } },
  { id: 'inocua', espera: 'MUDA', m: { fichero: CSS, de: '.j1-prog { display:flex;', a: '.j1-prog {  display:flex;', cae: 'la línea de progreso no se ve' } },
];
let malos = 0;
for (const c of CASOS) {
  const t = Date.now();
  const r = await mg.aplicarUna(c.m, GUARD, limpia);
  const v = r.ok ? 'VIVA' : r.mudo ? 'MUDA' : r.ciego ? 'CIEGA' : r.muerto ? 'MUERTA' : '?';
  if (v !== c.espera) malos += 1;
  const por = r.ok ? r.tras.caidos.find((l) => l.includes(c.m.cae)) : String(r.ciego || r.mudo || r.muerto || '').slice(0, 200);
  console.log(`  ${v === c.espera ? '✔' : '✖'} ${c.id} → ${v} (esperado ${c.espera}) · ${Math.round((Date.now() - t) / 1000)} s · ${por}`);
}
const igual = fs.readFileSync(path.join(RAIZ, CSS)).equals(original);
console.log(`${CSS} restaurado byte a byte: ${igual}`);
process.exit(malos || !igual ? 1 : 0);
