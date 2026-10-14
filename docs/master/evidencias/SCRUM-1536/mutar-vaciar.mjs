// Fabrica una copia de barrido.mjs cuyo catalogo solo lleva el centinela de cero:
// el control positivo se queda sin NADA que esperar. Uso: node mutar-vaciar.mjs <origen> <destino>
import fs from 'node:fs';
const [, , origen, destino] = process.argv;
const t = fs.readFileSync(origen, 'utf8');
const ini = t.indexOf('const PALABRAS = {');
const fin = t.indexOf('};', ini);
if (ini < 0 || fin < 0) { console.log('CIEGO: no encuentro el catalogo'); process.exit(2); }
const cuerpo = t.slice(ini, fin + 2);
const centinela = cuerpo.split('\n').find((l) => l.includes('ZZ_CERO'));
if (!centinela) { console.log('CIEGO: no encuentro el centinela'); process.exit(2); }
const nuevo = t.slice(0, ini) + 'const PALABRAS = {\n' + centinela + '\n};' + t.slice(fin + 2);
fs.writeFileSync(destino, nuevo);
console.log('MUTADO', destino, '· lineas antes', t.split('\n').length, '· despues', nuevo.split('\n').length);
