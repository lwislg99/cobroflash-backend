// docs/master/evidencias/scrum1502e/sincitas.mjs — SCRUM-1502e, punto ③.
// Uso: node sincitas.mjs <worktree desechable fijado a origin/main>  (con node_modules al alcance)
// NO se corre en un árbol de trabajo: muta tests/_respaldo-de-firma.mjs y crea una cobaya en
// docs/master; las restaura en `finally` y lo comprueba al final («árbol restaurado: true»).
// Mide el efecto de leer las fuentes con sinCitas() en indiceDeFuentes, sin tocar el árbol de nadie.
// Casos: base · mut · base+semilla[[cita]] · mut+semilla[[cita]] · mut+semilla a pelo.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const W = path.resolve(process.argv[2]);
const RES = path.join(W, 'tests/_respaldo-de-firma.mjs');
const COB = path.join(W, 'docs/master/zz-cobaya-1502e.md');
const ORIG = fs.readFileSync(RES, 'utf8');
const VIEJA = "    const texto = fs.readFileSync(path.join(raiz, ruta), 'utf8');";
if (!ORIG.includes(VIEJA)) { console.log('CIEGO: no encuentro la línea a mutar'); process.exit(2); }
const MUT = ORIG.replace(VIEJA, "    const texto = sinCitas(fs.readFileSync(path.join(raiz, ruta), 'utf8'));")
  .replace("import path from 'node:path';", "import path from 'node:path';\nimport { sinCitas } from './_cita-declarada.mjs';");

function medir(nombre) {
  const out = path.join(W, '..', `r-${nombre}.json`);
  try { fs.rmSync(out); } catch {}
  try {
    execFileSync(process.execPath, ['docs/master/evidencias/scrum1502/lista.mjs', out], { cwd: W, stdio: 'ignore' });
  } catch (e) { /* el guard puede caer por el número: la salida JSON se escribe igual */ }
  if (!fs.existsSync(out)) return { nombre, ciego: true };
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  return { nombre, congeladas: j.filas.map((f) => f.donde), porNivel: j.porNivel, filas: j.filas };
}

const r = {};
try {
  r.base = medir('base');
  if (r.base.ciego) throw new Error('base CIEGA');
  const victima = r.base.filas.find((f) => f.prosa && f.prosa.length);
  if (!victima) throw new Error('ninguna congelada con prosa distintiva: no hay semilla');
  const frase = victima.prosa[0];
  // La atribución de la cobaya se compone al correr: escrita entera, este fichero vive en
  // docs/master y el propio censo lo leería como un documento que atribuye.
  const atribucion = ['Aprobado', 'por el', 'fundador.'].join(' ');
  const doc = (t) => `# Cobaya SCRUM-1502e\n\n${atribucion}\n\n${t}\n`;
  fs.writeFileSync(RES, MUT); r.mut = medir('mut');
  fs.writeFileSync(COB, doc(`[[cita]]«${frase}»[[/cita]]`)); r.mutCita = medir('mutCita');
  fs.writeFileSync(COB, doc(`«${frase}»`)); r.mutPelo = medir('mutPelo');
  fs.writeFileSync(RES, ORIG);
  fs.writeFileSync(COB, doc(`[[cita]]«${frase}»[[/cita]]`)); r.baseCita = medir('baseCita');
  r.victima = victima.donde;
} finally {
  fs.writeFileSync(RES, ORIG);
  try { fs.rmSync(COB); } catch {}
}
const base = new Set(r.base.congeladas);
for (const k of ['base', 'mut', 'baseCita', 'mutCita', 'mutPelo']) {
  const x = r[k];
  if (x.ciego) { console.log(k, 'CIEGO'); continue; }
  const s = new Set(x.congeladas);
  const salen = [...base].filter((d) => !s.has(d));
  const entran = [...s].filter((d) => !base.has(d));
  console.log(`${k.padEnd(9)} sin-respaldo=${x.congeladas.length} porNivel=${JSON.stringify(x.porNivel)} salen=${JSON.stringify(salen)} entran=${JSON.stringify(entran)}`);
}
console.log('semilla:', r.victima);
console.log('árbol restaurado:', fs.readFileSync(RES, 'utf8') === ORIG && !fs.existsSync(COB));
