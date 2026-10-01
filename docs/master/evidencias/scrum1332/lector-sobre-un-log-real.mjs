import fs from 'node:fs';
import { lectorDeHuellas, redactar } from './_huella-de-la-caida.mjs';
const crudo = fs.readFileSync(process.argv[2], 'utf8').split('\n');
// El log del job antepone «job<TAB>paso<TAB>marca de tiempo » a cada linea: se quita para dejar la salida de la tanda.
const lineas = crudo.map((l) => l.replace(/^[^\t]*\t[^\t]*\t\S+Z ?/, ''));
const lector = lectorDeHuellas();
lector.texto(lineas.join('\n'));
const informe = lector.fin();
console.log('POBLACION: ' + crudo.length + ' lineas del log · leidas por el lector: ' + informe.lineasLeidas);
console.log(JSON.stringify({ ...informe, ciegosCaidos: informe.ciegosCaidos.length, ciegosSaltados: informe.ciegosSaltados.length }));
process.stdout.write(redactar(informe, 1));
