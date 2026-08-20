// scripts/censo-guards-navegador.mjs — SCRUM-546 · cuántos guards de navegador hay y qué cuestan.
//
//   node scripts/censo-guards-navegador.mjs            (censo + tiempos)
//   node scripts/censo-guards-navegador.mjs --solo-censo   (sin ejecutarlos)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
//
// La casa tiene varios guards que levantan navegador FUERA de `npm test`, precisamente porque
// cuestan. SCRUM-522 discute si eso escala — y esa discusión se estaba teniendo **sin el número**:
// nadie sabía cuánto cuestan juntos. Aquí se mide, en vez de estimarse.
//
// Y hay un segundo motivo, que es el que lo destapó: SCRUM-546 encontró **dos guards escritos con
// dos días de diferencia que levantan navegador sobre la misma página**. Sin un censo, el tercero
// se escribe igual.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA AUTORIDAD ES `package.json`, NO EL DIRECTORIO
//
// El censo sale de los scripts `guard:*` declarados, porque **lo que existe es lo que alguien
// puede ejecutar**. Un fichero en `scripts/` que nadie declara no es un guard: es código.
//
// 🔴 SUELO: si algún `guard:*` declarado NO tiene su fichero en el disco, el censo **falla
// declarándose ciego** en vez de dar un total más bajo. Un total que no cuadra con lo declarado se
// lee como «cuestan poco», que es justo la conclusión contraria a la verdad.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOLO_CENSO = process.argv.includes('--solo-censo');
const TOPE_MS = 240000;

const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};

/** Un guard es «de navegador» si su propia documentación dice que levanta uno. */
function esDeNavegador(nombre) {
  const doc = String(scripts['//' + nombre] || '');
  return /puppeteer|navegador/i.test(doc);
}

/** El fichero que ejecuta, extraído del comando declarado. */
function ficheroDe(nombre) {
  const m = String(scripts[nombre] || '').match(/scripts\/[A-Za-z0-9._-]+\.mjs/);
  return m ? m[0] : null;
}

const declarados = Object.keys(scripts).filter((k) => k.startsWith('guard:'));
const navegador = declarados.filter(esDeNavegador);

console.log('censo de guards de NAVEGADOR — SCRUM-546 (el número que le falta a SCRUM-522)\n');
console.log('scripts `guard:*` declarados en package.json : ' + declarados.length);
console.log('de ellos, de navegador                       : ' + navegador.length);

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
const sinFichero = navegador.filter((g) => { const f = ficheroDe(g); return !f || !fs.existsSync(path.join(RAIZ, f)); });
if (navegador.length === 0) {
  console.error('\n🔴 CIEGO: cero guards de navegador. O se han retirado todos —y entonces esto sobra—');
  console.error('   o el detector dejó de reconocerlos. No se afirma un total sobre una lista vacía.');
  process.exit(2);
}
if (sinFichero.length) {
  console.error('\n🔴 CIEGO: hay guards declarados SIN fichero en el disco: ' + sinFichero.join(', '));
  console.error('   Un total calculado sobre menos guards de los declarados se lee como «cuestan poco».');
  process.exit(2);
}

console.log('');
for (const g of navegador) console.log('   ' + g.padEnd(26) + ficheroDe(g));

if (SOLO_CENSO) { console.log('\n(--solo-censo: no se ejecuta ninguno)'); process.exit(0); }

// ── EL COSTE, medido ─────────────────────────────────────────────────────────────────────────
console.log('\nejecutando uno a uno (tope ' + (TOPE_MS / 1000) + ' s cada uno)…\n');
let total = 0;
const filas = [];
for (const g of navegador) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [ficheroDe(g)], { cwd: RAIZ, timeout: TOPE_MS, encoding: 'utf8' });
  const ms = Date.now() - t0;
  total += ms;
  const estado = r.error && r.error.code === 'ETIMEDOUT' ? 'TOPE' : (r.status === 0 ? 'verde' : (r.status === 2 ? 'CIEGO' : 'rojo(' + r.status + ')'));
  filas.push({ g, s: Math.round(ms / 100) / 10, estado });
  console.log('   ' + g.padEnd(26) + String(Math.round(ms / 100) / 10).padStart(6) + ' s   ' + estado);
}

console.log('\n── TOTAL ──────────────────────────────────────────────');
console.log('   ' + navegador.length + ' guards de navegador · ' + Math.round(total / 100) / 10 + ' s en serie');
const verdes = filas.filter((f) => f.estado === 'verde').length;
console.log('   verdes: ' + verdes + ' · no verdes: ' + (filas.length - verdes)
  + (filas.length - verdes ? ' (' + filas.filter((f) => f.estado !== 'verde').map((f) => f.g + '=' + f.estado).join(', ') + ')' : ''));
console.log('\n⚠️ Un «rojo» o un «CIEGO» aquí NO es necesariamente el coste: varios de estos guards');
console.log('   necesitan la app levantada o una sesión. El número que vale para SCRUM-522 es el');
console.log('   TIEMPO, que se paga igual acierten o no.');
