// Huella de la salida completa del censo (con y sin semilla), en el orden de los tests.
// Uso: node huella.mjs <ruta absoluta del censo> <fichero de salida .json>
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';
const [, , censoRuta, salida] = process.argv;
const { censar } = await import(pathToFileURL(censoRuta).href);
const con = censar({ semilla: true });
const sin = censar({ semilla: false });
const texto = JSON.stringify({ con, sin }, null, 1);
fs.writeFileSync(salida, texto);
const h = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 12);
console.log(`bytes ${Buffer.byteLength(texto)} · sha256 ${crypto.createHash('sha256').update(texto).digest('hex')}`);
console.log(`con: ficheros ${con.ficheros} rutas ${con.rutas.length} conId ${con.conId.length} conEscritura ${con.conEscritura.length} sospechosas ${con.sospechosas.length} semillaVista ${con.semillaVista} · lectura rutas ${con.lectura.rutas.length} conLectura ${con.lectura.conLectura.length} sospechosas ${con.lectura.sospechosas.length} semillaVista ${con.lectura.semillaVista} limpiaCallada ${con.lectura.semillaLimpiaCallada} · ${h(con)}`);
console.log(`sin: ficheros ${sin.ficheros} rutas ${sin.rutas.length} conId ${sin.conId.length} conEscritura ${sin.conEscritura.length} sospechosas ${sin.sospechosas.length} semillaVista ${sin.semillaVista} · lectura rutas ${sin.lectura.rutas.length} conLectura ${sin.lectura.conLectura.length} sospechosas ${sin.lectura.sospechosas.length} semillaVista ${sin.lectura.semillaVista} · ${h(sin)}`);
