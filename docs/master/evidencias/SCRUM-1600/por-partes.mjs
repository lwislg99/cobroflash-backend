// Por partes: repite los pasos de scrum1571b/c en su orden y anota rss y maxRSS tras cada uno.
// Uso: node por-partes.mjs <ruta absoluta del censo> [b|c]
import { pathToFileURL } from 'node:url';
import os from 'node:os';
const [, , censoRuta] = process.argv;
const MB = (b) => Math.round(b / 1048576);
const anota = (paso, extra = '') => console.log(`${paso.padEnd(34)} rss ${String(MB(process.memoryUsage().rss)).padStart(5)} MB · pico ${String(Math.round(process.resourceUsage().maxRSS / 1024)).padStart(5)} MB · heap ${MB(process.memoryUsage().heapUsed)} MB ${extra}`);
console.log(`libre al empezar: ${MB(os.freemem())} MB · ${new Date().toISOString()} (reloj local)`);
anota('arranque');
const { censar } = await import(pathToFileURL(censoRuta).href);
anota('importar el censo (typescript)');
let t = Date.now();
const con = censar({ semilla: true });
anota('censar({semilla:true})', `${Date.now() - t} ms · ${con.ficheros} ficheros`);
t = Date.now();
const sin = censar({ semilla: false });
anota('censar({semilla:false})', `${Date.now() - t} ms · ${sin.ficheros} ficheros`);
if (globalThis.gc) { gc(); anota('tras gc()'); }
