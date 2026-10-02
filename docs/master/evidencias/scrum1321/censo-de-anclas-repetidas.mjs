// Censo de anclas `de` que aparecen MÁS DE UNA VEZ en el fichero que dicen mutar.
// Uso: node censo-anclas.mjs <raiz del repo>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.argv[2];
const M = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const censo = M.censoDeDeclaraciones(path.join(RAIZ, 'tests'));
let total = 0;
let ausentes = 0;
const ambiguas = [];
for (const { guard, mutaciones } of censo) {
  for (const mut of mutaciones) {
    total += 1;
    const abs = path.join(RAIZ, mut.fichero);
    if (!fs.existsSync(abs)) { ausentes += 1; continue; }
    const texto = fs.readFileSync(abs, 'utf8');
    const veces = texto.split(mut.de).length - 1;
    if (veces === 0) { ausentes += 1; continue; }
    if (veces > 1) {
      const lineas = [];
      let i = -1;
      while ((i = texto.indexOf(mut.de, i + 1)) !== -1) lineas.push(texto.slice(0, i).split('\n').length);
      const mismoFichero = path.basename(mut.fichero) === guard;
      ambiguas.push({ guard, fichero: mut.fichero, cae: mut.cae.slice(0, 70), veces, lineas, mismoFichero, de: mut.de.slice(0, 80) });
    }
  }
}
console.log(`POBLACION declaraciones=${total} · guards=${censo.length} · ancla ausente=${ausentes} · AMBIGUAS=${ambiguas.length}`);
for (const a of ambiguas) {
  console.log(`\n· ${a.guard} → ${a.fichero}${a.mismoFichero ? '  [SE MUTA A SÍ MISMO]' : ''}\n    cae: ${a.cae}\n    veces ${a.veces} · líneas ${a.lineas.join(', ')}\n    de: ${JSON.stringify(a.de)}`);
}
