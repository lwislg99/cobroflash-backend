// docs/master/evidencias/SCRUM-1566/d-contar-887.mjs — SCRUM-1566 tramo (d), S1, 29-oct-2026
//
// Cuenta, sin aserciones, los «no cobran lo firmado» de scrum887 y scrum887b con la sonda D apagada
// (0), en la variante 1 y en la 2. Copia los dos tests a una carpeta EFÍMERA dentro del árbol (la
// copia importa `typescript` y tiene que resolverlo desde ahí), cambia sus dos `assert.ok` de techo
// por un `console.log` y la BORRA al salir. Los tests del repositorio no se tocan.
//
//   node docs/master/evidencias/SCRUM-1566/d-contar-887.mjs <árbol con dist/>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const arbol = path.resolve(process.argv[2] || '.');
const sonda = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sonda-d.cjs');
const efimera = path.join(arbol, 'tmp-sonda-1566d');
const salida = [];
try {
  fs.mkdirSync(efimera, { recursive: true });
  for (const f of ['scrum887-el-cobro-es-lo-firmado.test.mjs', 'scrum887b-descuento-global.test.mjs']) {
    let src = fs.readFileSync(path.join(arbol, 'tests', f), 'utf8');
    src = src.replace(/const RAIZ = [^\n]+/, `const RAIZ = ${JSON.stringify(arbol)};`);
    src = src.replace(/assert\.ok\(distintos <= (TECHO_DISTINTOS(?:_B)?)\[(\w+)\],/g,
      (m, techo, k) => `console.log('CUENTA', ${JSON.stringify(f)}, ${k}, distintos, 'techo', ${techo}[${k}]); assert.ok(true,`);
    if (!src.includes('CUENTA') || !src.includes(JSON.stringify(arbol))) throw new Error(`CIEGO: no reescribí ${f}`);
    const copia = path.join(efimera, 'copia-' + f);
    fs.writeFileSync(copia, src);
    for (const d of ['0', '1', '2']) {
      let out = '';
      try {
        out = execFileSync(process.execPath, ['--require', sonda, '--test', '--test-reporter=spec', copia],
          { cwd: arbol, env: { ...process.env, SONDA_D: d }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) { out = String(e.stdout || ''); }
      const filas = out.split('\n').filter((l) => l.includes('CUENTA'));
      if (filas.length === 0) throw new Error(`CIEGO: ${f} con SONDA_D=${d} no imprimió ninguna CUENTA`);
      for (const l of filas) salida.push(`D=${d} ${l.trim()}`);
    }
  }
} finally {
  fs.rmSync(efimera, { recursive: true, force: true });
}
console.log(salida.join('\n'));
