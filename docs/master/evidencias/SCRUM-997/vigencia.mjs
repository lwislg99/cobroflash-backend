// SCRUM-997c · S0 · ¿qué línea de `limites-del-fundador.md` sostiene la firma delegada de microcopy?
// uso: node vigencia.mjs <raíz del worktree> <carpeta temporal FUERA del árbol>
// Sólo lee el árbol. Escribe dos copias recortadas del fichero en la carpeta temporal y le pregunta
// al oráculo (`delegacionVigente`, de tests/_microcopy-aprobada.mjs) por cada una.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2] || !process.argv[3]) { console.error('faltan la raíz y la carpeta temporal'); process.exit(2); }
const raiz = path.resolve(process.argv[2]);
const tmp = path.resolve(process.argv[3]);
const { delegacionVigente } = await import(pathToFileURL(path.join(raiz, 'tests/_microcopy-aprobada.mjs')).href);

const lineas = fs.readFileSync(path.join(raiz, 'docs/equipo/limites-del-fundador.md'), 'utf8').split(/\r?\n/);
const abrenLaDeJavier = lineas.filter((l) => /Javier, 2[25]-sep-2026/.test(l)).length;
const sinJavier = lineas.filter((l) => !/Javier/.test(l));
const sinLuis = lineas.filter((l) => !/Los textos de microcopy que haya que aprobar los aprueba el orquestador/.test(l));
fs.writeFileSync(path.join(tmp, 'lim-sin-javier.md'), sinJavier.join('\n'));
fs.writeFileSync(path.join(tmp, 'lim-sin-luis.md'), sinLuis.join('\n'));

console.log(`POBLACION: ${lineas.length} líneas del fichero real · abren una delegación de Javier: ${abrenLaDeJavier} (se esperan 2)`);
console.log(`QUITADAS: ${lineas.length - sinJavier.length} líneas que nombran a Javier · ${lineas.length - sinLuis.length} con la viñeta de Luis (se espera 1)`);
const real = delegacionVigente();
const a = delegacionVigente({ limites: path.join(tmp, 'lim-sin-javier.md') });
const b = delegacionVigente({ limites: path.join(tmp, 'lim-sin-luis.md') });
console.log(`delegacionVigente · fichero real: ${real} · sin ninguna línea que nombre a Javier: ${a} · sin la viñeta de Luis: ${b}`);
// El control es la tercera: si quitar la viñeta de Luis no la apagara, la sonda no estaría mirando nada.
let exit = 1;
if (real === true && b === false && abrenLaDeJavier === 2 && lineas.length - sinLuis.length === 1) exit = 0;
console.log(`EXIT=${exit}`);
process.exit(exit);
