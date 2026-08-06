// scripts/_inyectar-386.mjs — herramienta de un solo uso: inyecta una regresión concreta.
// Los rangos salen del AST (exactos) en vez de buscar la llave de cierre con un `while`, que es
// lo que se colgó: si nunca casa, corre hasta el infinito y el rojo no llega a ejecutarse —
// y un rojo que no corre no demuestra nada.
import fs from 'node:fs';
import ts from 'typescript';

const F = 'public/dashboard/js/jobDetailView.js';
const cual = process.argv[2];
let src = fs.readFileSync(F, 'utf8');

function rango(nombre) {
  const sf = ts.createSourceFile(F, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  let fn = null;
  const v = (n) => { if (ts.isFunctionDeclaration(n) && n.name?.text === nombre) { fn = n; return; } ts.forEachChild(n, v); };
  v(sf);
  if (!fn) { console.error(`🔴 no encuentro ${nombre}`); process.exit(9); }
  return [sf.getLineAndCharacterOfPosition(fn.getStart()).line, sf.getLineAndCharacterOfPosition(fn.getEnd()).line];
}

if (cual === 'anidar') {
  const [a, b] = rango('openFacturarParcialSheet');
  const l = src.split('\n');
  const cuerpo = l.splice(a, b - a + 1).map((x) => '  ' + x);
  const k = l.findIndex((x) => x.includes('const editBtn = () => mkBtn'));
  if (k < 0) { console.error('🔴 no encuentro dónde anidarla'); process.exit(9); }
  l.splice(k, 0, ...cuerpo);
  src = l.join('\n');
} else if (cual === 'ruta') {
  if (!src.includes('/facturar-parcial`, {')) { console.error('🔴 ancla de la ruta no encontrada'); process.exit(9); }
  src = src.replace('/facturar-parcial`, {', '/facturar-parcial-v2`, {');
} else if (cual === 'contexto') {
  const a = 'openFacturarParcialSheet(alb, { refresh, setStatus })';
  if (!src.includes(a)) { console.error('🔴 ancla del llamador no encontrada'); process.exit(9); }
  src = src.replace(a, 'openFacturarParcialSheet(alb)');
} else {
  console.error('uso: anidar | ruta | contexto');
  process.exit(9);
}

fs.writeFileSync(F, src);
console.log(`inyectada: ${cual}`);
