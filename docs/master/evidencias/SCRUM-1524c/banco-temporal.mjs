// Banco: ¿se queda el directorio temporal cuando el guion REVIENTA a mitad de los controles?
// Fabrica dos copias del guion real (la del primer empujon, por sha, y la del arbol), les siembra un `throw` justo antes
// de juzgar, las corre y cuenta los `scrum1524c-*` que quedan en TMPDIR.
//   node banco.mjs <raiz del arbol> <dir de trabajo fuera del arbol>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [raiz, trabajo] = process.argv.slice(2);
// El ANTES va por sha y no por HEAD: en cuanto el arreglo se comitea, HEAD ya es el DESPUES.
const ANTES_SHA = '90365e6574d4e9787754f00516c555e81a5c0603';
const RUTA = 'docs/master/evidencias/SCRUM-1524c/leer.mjs';
const tabla = pathToFileURL(path.join(raiz, 'docs/master/evidencias/SCRUM-1524c/tabla.mjs')).href;
const restos = () => new Set(fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('scrum1524c-')));
const entorno = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR };

const versiones = {
  ANTES: execFileSync('git', ['show', ANTES_SHA + ':' + RUTA], { cwd: raiz, encoding: 'utf8' }),
  DESPUES: fs.readFileSync(path.join(raiz, RUTA), 'utf8'),
};
let mal = 0;
for (const [nombre, fuente] of Object.entries(versiones)) {
  for (const sembrar of [true, false]) {
    let f = fuente.replace("'./tabla.mjs'", JSON.stringify(tabla));
    if (!f.includes(tabla)) { console.log('CIEGO · no pude redirigir el import de la tabla en ' + nombre); process.exit(2); }
    if (sembrar) {
      const ancla = /^(\s*)(const )?rotasVistas = ROTAS\.filter/m;
      if (!ancla.test(f)) { console.log('CIEGO · no encuentro donde sembrar el throw en ' + nombre); process.exit(2); }
      f = f.replace(ancla, (todo, sangria) => sangria + "throw new Error('SEMBRADO');\n" + todo);
      if (!f.includes("throw new Error('SEMBRADO')")) { console.log('CIEGO · el throw no entro en ' + nombre); process.exit(2); }
    }
    const copia = path.join(trabajo, 'leer-' + nombre + (sembrar ? '-throw' : '-sano') + '.mjs');
    fs.writeFileSync(copia, f);
    const antes = restos();
    const r = spawnSync(process.execPath, [copia], { cwd: raiz, encoding: 'utf8', env: entorno });
    const nuevos = [...restos()].filter((n) => !antes.has(n));
    const revento = /SEMBRADO/.test(r.stderr || '');
    const poblacion = /^POBLACION/m.test(r.stdout || '');
    console.log(nombre.padEnd(8) + (sembrar ? 'con throw ' : 'sano      ') + '· salida ' + r.status + ' · revento=' + revento + ' · imprimio POBLACION=' + poblacion + ' · restos nuevos en TMPDIR: ' + nuevos.length);
    // testigo de ejecucion: con throw tiene que reventar; sano tiene que imprimir su poblacion
    if (sembrar !== revento || sembrar === poblacion) { console.log('CIEGO · el sujeto no hizo lo que se le sembro'); process.exit(2); }
    const espera = nombre === 'ANTES' && sembrar ? 1 : 0;
    if (nuevos.length !== espera) { mal++; console.log('  NO ES LO ESPERADO (' + espera + ')'); }
    for (const n of nuevos) fs.rmSync(path.join(os.tmpdir(), n), { recursive: true, force: true });
  }
}
console.log('EXIT=' + (mal ? 1 : 0));
process.exit(mal ? 1 : 0);
