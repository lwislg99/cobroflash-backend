// Sonda de SCRUM-1506 (solo lectura): ejecuta puestoDeNombre e identidad() del hook de carril de un árbol.
// Uso: node sonda1506.mjs <raíz del árbol>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arbol = path.resolve(process.argv[2]);
const c = await import(pathToFileURL(path.join(arbol, 'scripts/_carriles.mjs')).href);
const h = await import(pathToFileURL(path.join(arbol, '.claude/hooks/carril.mjs')).href);

const NOMBRES = ['jv-j1', 'jv-j2', 'jv-j3', 'jv-j4', 'jv-j5', 'jv-j6', 'j6-x', 'puesto-j6',
  'sesion-0', 'sesion-1', 'sesion-5', 's5-15oct', 'orquestador', 'cobroflash-backend-90', 'cobroflash-backend-57', ''];
console.log(`POBLACION=${NOMBRES.length} nombres · árbol=${arbol}`);
for (const n of NOMBRES) console.log(`puestoDeNombre(${JSON.stringify(n)}) = ${JSON.stringify(c.puestoDeNombre(n, null))}`);

// identidad() con y sin mesa (.yaqu-puesto.json), en carpetas temporales FUERA del árbol.
const casos = [
  { nombre: 'jv-j6', mesa: null },
  { nombre: 'jv-j6', mesa: { puesto: 'J6', nombre: 'jv-j6' } },
  { nombre: 'jv-j6', mesa: { puesto: 'J6' } },
  { nombre: 'sesion-5', mesa: null },
  { nombre: 'sesion-5', mesa: { puesto: 'S5', nombre: 'sesion-5' } },
];
for (const k of casos) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sonda1506-'));
  try {
    if (k.mesa) fs.writeFileSync(path.join(dir, '.yaqu-puesto.json'), JSON.stringify(k.mesa));
    const id = h.identidad({ proyecto: dir, transcript: null, nombre: k.nombre });
    console.log(`identidad(nombre=${k.nombre}, mesa=${JSON.stringify(k.mesa)}) → puesto=${JSON.stringify(id.puesto)} porNombre=${JSON.stringify(id.porNombre)} carpeta=${JSON.stringify(id.carpeta)} discrepa=${id.discrepa}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
console.log('EXIT=0');
