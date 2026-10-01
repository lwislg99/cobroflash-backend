import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = path.resolve(process.argv[2]);
const { portadoresDelFlag } = await import(pathToFileURL(path.join(RAIZ, 'tests/_censo-copy-vs-flag.mjs')).href);
const r = portadoresDelFlag(RAIZ);
const p = r.portadores;
const claves = p instanceof Map ? [...p.keys()] : p instanceof Set ? [...p] : Object.keys(p);
console.log(`POBLACION · ficheros ${r.ficheros} · definiciones ${r.definiciones} · vueltas ${r.vueltas} · cables back→front ${r.cables instanceof Map || r.cables instanceof Set ? r.cables.size : JSON.stringify(r.cables).slice(0, 80)}`);
console.log(`PORTADORES: ${claves.length}`);
const porFichero = new Map();
for (const c of claves) { const [f, n] = String(c).includes('::') ? String(c).split('::') : ['(sin fichero)', c]; if (!porFichero.has(f)) porFichero.set(f, []); porFichero.get(f).push(n); }
for (const [f, ns] of [...porFichero].sort()) console.log(`   ${f} (${ns.length}): ${ns.join(', ').slice(0, 300)}`);
