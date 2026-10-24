// Foto de un uso (SCRUM-1502h): congeladas() y porNivel() del guard, por su propio camino.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [raiz, salida] = process.argv.slice(2);
const g = await import(pathToFileURL(path.join(raiz, 'tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs')).href);
const foto = { congeladas: g.congeladas(), porNivel: g.porNivel(), SIN_RESPALDO: g.SIN_RESPALDO };
fs.writeFileSync(salida, JSON.stringify(foto, null, 1));
console.error(`FOTO congeladas=${foto.congeladas.length} porNivel=${JSON.stringify(foto.porNivel)}`);
