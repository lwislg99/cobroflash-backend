// Aplica la mutación nº 2 declarada en scrum859. Los literales se COMPRUEBAN contra la declaración
// (no se importa el test: importarlo registraría y correría sus tests).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const RAIZ = process.argv[2];
const DE = '    const id = identidadDeEntrada(e.tituloCompleto);';
const A = '    const id = String(vistos.size); // vuelta a la clave POSICIONAL, a proposito';
const decl = readFileSync(path.join(RAIZ, 'tests', 'scrum859-identidad-y-motivo-cerrado.test.mjs'), 'utf8');
if (!decl.includes(`de: ${JSON.stringify(DE)}`.replace(/^de: "/, 'de: "')) && !decl.includes(DE)) { console.log('CIEGO: la declaración ya no lleva ese «de»'); process.exit(2); }
if (!decl.includes(A)) { console.log('CIEGO: la declaración ya no lleva ese «a»'); process.exit(2); }
const f = path.join(RAIZ, 'tests', 'scrum267-ancla-de-medicion.test.mjs');
const t = readFileSync(f, 'utf8');
const veces = t.split(DE).length - 1;
if (veces !== 1) { console.log(`CIEGO: el ancla aparece ${veces} veces en scrum267`); process.exit(2); }
writeFileSync(f, t.replace(DE, A));
console.log('MUTANTE 2 puesto en tests/scrum267-ancla-de-medicion.test.mjs');
