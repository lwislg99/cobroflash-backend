#!/usr/bin/env node
// SCRUM-1505 · el criterio PROPUESTO (`enCabecera`, en `censo.mjs`) visto caer y pasar, sin tocar
// `scripts/equipo/ya-esta.mjs` (carril de S5). Las respuestas las da el instrumento real.
//
//   node docs/master/evidencias/scrum1505/prueba-del-criterio.mjs [<sha o ref>]
//
// El caso «ROJO» es FABRICADO y se dice: hoy ningún ticket del árbol sale mal (censo: CAMBIA=0), así
// que el único rojo posible es quitarle a un ticket real lo que lo salva (su registro).
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const { mirar, veredictoDe, YA_ESTA, NO_ESTA } = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'ya-esta.mjs')).href);
const { enCabecera } = await import(pathToFileURL(path.join(AQUI, 'censo.mjs')).href);

const git = (...a) => execFileSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
const sha = git('rev-parse', '--verify', `${process.argv[2] || 'origin/main'}^{commit}`).trim();
const conCabecera = (n, h) => veredictoDe({ ...h, commits: [...h.commits, ...h.commitsAjenos.filter((c) => enCabecera(c.asunto).includes(Number(n)))] });

let fallos = 0; let casos = 0;
const caso = (nombre, visto, esperado) => { casos++; const ok = visto === esperado; if (!ok) fallos++; console.log(`${ok ? 'ok  ' : 'FALLA'}\t${nombre}\tvisto=${visto}\tesperado=${esperado}`); };
console.log(`POBLACION\tmain=${sha}\tcasos=7`);

// El ticket del encargo, tal cual está en el árbol.
const real = (await mirar(1471, { raiz: RAIZ, ref: sha, traer: false })).h;
caso('1471 real · hoy (lo que dice el instrumento, sin tocar nada)', veredictoDe(real).respuesta, YA_ESTA);
caso('1471 real · sus commits propios hoy (el defecto: 0, con 3 entregas en «lo citan»)', `${real.commits.length}/${real.commitsAjenos.length}`, '0/3');

// FABRICADO: el mismo ticket SIN registro ni evidencias. Es el caso que el ticket describe.
const pelado = { ...real, registros: [], evidencias: [] };
caso('1471 FABRICADO sin registro · hoy → ROJO esperado', veredictoDe(pelado).respuesta, NO_ESTA);
caso('1471 FABRICADO sin registro · con la cabecera', conCabecera(1471, pelado).respuesta, YA_ESTA);

// El positivo que puede tumbar el arreglo: uno que de verdad NO está, y al que un commit ajeno CITA.
// SCRUM-1434 es el caso por el que nació `duenoDelAsunto` (SCRUM-1454): «… y el ticket abierto (SCRUM-1434…».
const citado = (await mirar(1434, { raiz: RAIZ, ref: sha, traer: false })).h;
caso('1434 real · lo cita un commit de otro ticket (¿sigue habiendo cita?)', citado.commitsAjenos.length > 0 ? 'con citas' : 'sin citas', 'con citas');
caso('1434 real · con la cabecera sigue sin estar', conCabecera(1434, citado).respuesta, NO_ESTA);

// Y la función sola, sobre los dos asuntos reales que la separan.
caso('enCabecera sobre los dos asuntos', JSON.stringify([
  enCabecera('SCRUM-1470 · SCRUM-1471 · SCRUM-1472: la fecha impresa es la del calendario del negocio'),
  enCabecera('SCRUM-1123c: el censo rescatado y su desmentido viajan juntos; linea A9 y el ticket abierto (SCRUM-1434, solo'),
]), '[[1470,1471,1472],[1123]]');

console.log(`RECUENTO\tcasos=${casos}\tfallos=${fallos}`);
const salida = fallos > 0 ? 1 : casos !== 7 ? 4 : 0;
console.log(`EXIT=${salida}`);
process.exit(salida);
