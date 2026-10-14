// Fabrica copias de barrido.mjs con la SIEMBRA cambiada. Uso: node mutar-sembrar.mjs <origen> <destino> <centinela|sin-igic>
//
// SIN LISTA PROPIA (SCRUM-1387). Qué se cambia lo declara el test del ticket en sus
// MUTACIONES_QUE_ME_TUMBAN, y aquí se lee con el lector del meta-guard (por AST, sin ejecutar el test):
// la declaración cuyo `modo` es el que se pide. La red de la casa es `npm run meta:mutaciones`, que
// aplica esas mismas declaraciones sobre barrido.mjs EN SU SITIO; esto fabrica una COPIA para verla correr.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const TEST = 'tests/scrum1536b-los-tres-estados-de-los-guiones.test.mjs';
const BARRIDO = 'docs/master/evidencias/SCRUM-1536/barrido.mjs';
const MODOS = ['centinela', 'sin-igic'];

const [, , origen, destino, modo] = process.argv;
const ciego = (por) => { console.log('CIEGO: ' + por); process.exit(2); };
if (!MODOS.includes(modo)) ciego(`modo desconocido «${modo}»; este guion sabe ${MODOS.join(' y ')}`);
const suyas = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, TEST), 'utf8'), TEST)
  .filter((m) => m.fichero === BARRIDO && m.modo === modo);
if (suyas.length !== 1) ciego(`${TEST} declara ${suyas.length} mutaciones de modo «${modo}», no 1`);
const [m] = suyas;
const t = fs.readFileSync(origen, 'utf8');
const veces = t.split(m.de).length - 1;
if (veces !== 1) ciego(`el texto a cambiar aparece ${veces} veces en ${origen}, no 1`);
const nuevo = t.replace(m.de, m.a);
if (nuevo === t) ciego('el parche no caso');
fs.writeFileSync(destino, nuevo);
console.log('MUTADO', modo, '· caracteres antes', t.length, '· despues', nuevo.length);
