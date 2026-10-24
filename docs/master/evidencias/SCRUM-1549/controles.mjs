// Controles de puestoDeNombre e identidad() con mesas fabricadas en carpetas temporales. Sólo escribe en tmp.
// Uso: node docs/master/evidencias/SCRUM-1549/controles.mjs "$PWD" <carpeta temporal FUERA del árbol>
// ⚠️ La carpeta temporal NO puede estar dentro del repo: identidad() leería una mesa de verdad.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [REPO, TMP] = process.argv.slice(2);
const { puestoDeNombre } = await import(pathToFileURL(path.join(REPO, 'scripts/_carriles.mjs')).href);
const { identidad } = await import(pathToFileURL(path.join(REPO, '.claude/hooks/carril.mjs')).href);

const M = { puesto: 'J4', nombre: 'jv-j4g' };
console.log('— puestoDeNombre (la función sola)');
for (const [n, m] of [['jv-j4g', M], ['jv-j4g', null], ['jv-j9z', M], ['JV-J4G', M], ['jv-j4g ', M]]) console.log(`  puestoDeNombre(${JSON.stringify(n)}, ${JSON.stringify(m)}) → ${puestoDeNombre(n, m)}`);

console.log('— forma de nombre de Luis y otras, sin mesa');
for (const n of ['sesion-0', 'sesion-1', 'sesion-5', 'sesion-6', 's1-14oct', 's5-29c', 's3-14oct-a', 'S2-x', 'orquestador', 'orquestador-luis', 'cobroflash-backend-57', 'cobroflash-backend-2e', 'j4-1346', 'puesto-j4', 'jv-j4g', 'j7-x', null]) console.log(`  ${JSON.stringify(n)} → ${puestoDeNombre(n, null)}`);

let k = 0;
function mesa(contenido) {
  const d = path.join(TMP, `mesa-${++k}`);
  fs.mkdirSync(d, { recursive: true });
  if (contenido !== undefined) fs.writeFileSync(path.join(d, '.yaqu-puesto.json'), typeof contenido === 'string' ? contenido : JSON.stringify(contenido));
  return d;
}
const veredicto = (id) => (id.discrepa ? 'PARA (discrepancia)' : id.carpetaRota || !id.puesto ? 'CAE con --exigir' : `pasa como ${id.puesto}`);
console.log('— identidad() de carril.mjs: lo que decide la cerradura (puesto = carpeta ?? porNombre)');
const casos = [
  ['mesa J4/jv-j4g, nombre jv-j4g', { puesto: 'J4', nombre: 'jv-j4g' }, 'jv-j4g'],
  ['mesa J4/jv-j4g, nombre jv-j9z', { puesto: 'J4', nombre: 'jv-j4g' }, 'jv-j9z'],
  ['mesa J4/jv-j4g, sin nombre', { puesto: 'J4', nombre: 'jv-j4g' }, null],
  ['mesa J4/jv-j4g, nombre j3-x', { puesto: 'J4', nombre: 'jv-j4g' }, 'j3-x'],
  ['mesa J4/jv-j4g, nombre sesion-1', { puesto: 'J4', nombre: 'jv-j4g' }, 'sesion-1'],
  ['mesa J4/jv-j4g, nombre s2-x', { puesto: 'J4', nombre: 'jv-j4g' }, 's2-x'],
  ['mesa J4 SIN campo nombre, nombre cualquiera', { puesto: 'J4' }, 'lo-que-sea'],
  ['mesa J4/nombre «cualquiera», nombre jv-j9z', { puesto: 'J4', nombre: 'cualquiera' }, 'jv-j9z'],
  ['mesa ORQ, nombre cobroflash-backend-2e', { puesto: 'ORQ', nombre: 'cobroflash-backend-2e' }, 'cobroflash-backend-2e'],
  ['mesa J9 (no válido)', { puesto: 'J9', nombre: 'x' }, 'x'],
  ['mesa JSON roto', '{puesto', 'x'],
  ['sin mesa, nombre jv-j4g', undefined, 'jv-j4g'],
  ['sin mesa, nombre sesion-3', undefined, 'sesion-3'],
  ['sin mesa, nombre s5-29c', undefined, 's5-29c'],
  ['sin mesa, nombre cobroflash-backend-57', undefined, 'cobroflash-backend-57'],
  ['sin mesa, nombre orquestador', undefined, 'orquestador'],
];
for (const [t, c, n] of casos) {
  const id = identidad({ proyecto: mesa(c), transcript: null, nombre: n });
  console.log(`  ${t} → carpeta ${id.carpeta} · porNombre ${id.porNombre} · ${veredicto(id)}${id.carpetaRota ? ` (${id.carpetaRota})` : ''}`);
}
