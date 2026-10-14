// Fabrica copias de barrido.mjs con la SIEMBRA cambiada. Uso: node mutar-sembrar.mjs <origen> <destino> <centinela|sin-igic>
import fs from 'node:fs';
const [, , origen, destino, modo] = process.argv;
const t = fs.readFileSync(origen, 'utf8');
const ancla = 'Hacienda Foral · TicketBAI · Batuz · IGIC · ';
if (t.split(ancla).length !== 2) { console.log('CIEGO: la siembra no esta una sola vez'); process.exit(2); }
let nuevo;
if (modo === 'centinela') nuevo = t.replace(ancla, ancla + 'qwzxforalinventado · ');
else if (modo === 'sin-igic') nuevo = t.replace(ancla, 'Hacienda Foral · TicketBAI · Batuz · ');
else { console.log('CIEGO: modo desconocido'); process.exit(2); }
if (nuevo === t) { console.log('CIEGO: el parche no caso'); process.exit(2); }
fs.writeFileSync(destino, nuevo);
console.log('MUTADO', modo, '· caracteres antes', t.length, '· despues', nuevo.length);
