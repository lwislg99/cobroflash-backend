// rojo-1317.mjs — SCRUM-1340 ③: la primera versión REAL de docs/master/SCRUM-1317.md
// (commit 56792052) pasada por el guard tal cual está. Uso: node rojo-1317.mjs <raiz> <v1.md>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , RAIZ, V1] = process.argv;
const m267 = await import(pathToFileURL(path.join(RAIZ, 'tests/scrum267-ancla-de-medicion.test.mjs')).href);
const m811 = await import(pathToFileURL(path.join(RAIZ, 'tests/scrum811c-skill-ui-declarada.test.mjs')).href);

const texto = fs.readFileSync(V1, 'utf8');
const entradas = m267.entradasConClave('SCRUM-1317.md', texto);
const decir = (k, v) => console.log('ROJO-1317 ' + k + ' = ' + JSON.stringify(v));

decir('bytes del texto', texto.length);
decir('entradas troceadas', entradas.length);
for (const e of entradas) {
  decir('entrada', {
    clave: e.clave.slice(0, 70),
    nombraRutaPublic: m811.tocaPublic(e.cuerpo),
    fecha: m811.fechaDeEntrada(e.cuerpo),
    declara: m811.declaraSkillUi(e.cuerpo),
  });
}
decir('SIN DECLARAR segun el guard (v1 real)', m811.entradasSinDeclarar(entradas).length);

// CONTROL POSITIVO: el MISMO texto con las dos cosas que le faltan → el guard tiene que acusarlo.
const conDatos = texto
  .replace('`homeView.js`', '`public/dashboard/js/homeView.js`')
  .replace('1-oct-2026 · **J4c**', '**Fecha:** 1-oct-2026 · **J4c**');
decir('el control cambio el texto', conDatos !== texto);
const e2 = m267.entradasConClave('SCRUM-1317.md', conDatos);
decir('control: nombraRutaPublic/fecha', e2.map((e) => [m811.tocaPublic(e.cuerpo), m811.fechaDeEntrada(e.cuerpo)]));
decir('SIN DECLARAR segun el guard (v1 + ruta con prefijo + Fecha)', m811.entradasSinDeclarar(e2).length);
// y cada mitad por separado
const soloRuta = texto.replace('`homeView.js`', '`public/dashboard/js/homeView.js`');
const soloFecha = texto.replace('1-oct-2026 · **J4c**', '**Fecha:** 1-oct-2026 · **J4c**');
decir('SIN DECLARAR (solo ruta con prefijo, sin Fecha)', m811.entradasSinDeclarar(m267.entradasConClave('SCRUM-1317.md', soloRuta)).length);
decir('SIN DECLARAR (solo Fecha, sin prefijo)', m811.entradasSinDeclarar(m267.entradasConClave('SCRUM-1317.md', soloFecha)).length);
console.log('ROJO-1317 EXIT=0');
