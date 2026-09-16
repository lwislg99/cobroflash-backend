// tests/_desfase-node-modules.mjs — SCRUM-471
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// «MAIN ESTÁ ROJA» — y no lo estaba
//
// DOS sesiones distintas reportaron cinco rojos de la cola offline como un fallo del producto, y
// se abrió un ticket sobre un defecto que no existía. Los cinco eran lo mismo: un `node_modules`
// instalado ANTES de que main estrenara `fake-indexeddb` (SCRUM-455). El código estaba bien; lo
// que faltaba era una dependencia, y **lo que falta no se ve mirando el código**.
//
// Cinco fallos de tests no dicen «te falta un paquete». Este fichero sí.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// NO SE COMPARAN HASHES DE FICHERO, y esto importa
//
// `node_modules/.package-lock.json` y `package-lock.json` tienen formatos distintos: su hash
// SIEMPRE difiere. Compararlos daría «desfasado» en el 100 % de los árboles y parecería una
// medición. Se compara lo que de verdad decide: **qué versión pide el lock y qué versión hay
// instalada**, leyendo el `package.json` de cada paquete.
import fs from 'node:fs';
import path from 'node:path';

/** Las dependencias DIRECTAS con la versión que el lock resuelve para cada una. */
export function exigidasPorElLock(raiz) {
  const fLock = path.join(raiz, 'package-lock.json');
  const fPkg = path.join(raiz, 'package.json');
  if (!fs.existsSync(fLock) || !fs.existsSync(fPkg)) return null;   // ← el suelo lo trata arriba

  const lock = JSON.parse(fs.readFileSync(fLock, 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(fPkg, 'utf8'));
  const directas = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  const out = new Map();
  for (const nombre of Object.keys(directas)) {
    const entrada = lock.packages?.[`node_modules/${nombre}`];
    if (entrada?.version) out.set(nombre, entrada.version);
  }
  return out;
}

/** Qué hay instalado de verdad, leyendo el `package.json` de cada paquete. */
export function instalado(raiz, nombre) {
  try {
    return JSON.parse(fs.readFileSync(path.join(raiz, 'node_modules', ...nombre.split('/'), 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

/**
 * El diagnóstico de UN árbol.
 *
 * @returns {{ciego:string}|{faltan:string[], distintas:{nombre:string,tengo:string,pide:string}[], miradas:number}}
 */
export function diagnosticar(raiz) {
  if (!fs.existsSync(path.join(raiz, 'node_modules'))) {
    return { ciego: 'no hay `node_modules` en este árbol: no hay nada que comparar' };
  }
  const exigidas = exigidasPorElLock(raiz);
  if (exigidas === null) return { ciego: 'no se encuentra `package-lock.json` o `package.json`' };
  if (exigidas.size === 0) {
    return { ciego: 'el lock no declara ni una dependencia directa: o está vacío o no se supo leer' };
  }

  const faltan = [];
  const distintas = [];
  for (const [nombre, pide] of exigidas) {
    const tengo = instalado(raiz, nombre);
    if (tengo === null) faltan.push(nombre);
    else if (tengo !== pide) distintas.push({ nombre, tengo, pide });
  }
  return { faltan, distintas, miradas: exigidas.size };
}

/** El aviso, con las palabras que hacían falta. `null` si el árbol está al día. */
export function avisoDeDesfase(raiz) {
  const d = diagnosticar(raiz);
  if (d.ciego) {
    return `🔴 NO SE PUEDE COMPROBAR SI TU \`node_modules\` ESTÁ AL DÍA: ${d.ciego}.\n\n` +
      '  Un árbol sin nada que comparar y uno correcto NO pueden dar el mismo verde: el primero\n' +
      '  te deja corriendo tests contra dependencias que no sabes cuáles son.';
  }
  if (!d.faltan.length && !d.distintas.length) return null;   // ← nace VERDE en un árbol al día

  const trozos = [];
  if (d.faltan.length) trozos.push(`falta ${d.faltan.map((n) => `\`${n}\``).join(', ')}`);
  for (const x of d.distintas.slice(0, 5)) trozos.push(`\`${x.nombre}\` está en ${x.tengo} y el lock pide ${x.pide}`);

  return `🔴 TU \`node_modules\` ES ANTERIOR A ESTE \`package-lock.json\`: ${trozos.join(' · ')}.\n\n` +
    '  Esto NO es un fallo del código ni de `main`. Dos sesiones reportaron cinco rojos de la cola\n' +
    '  offline como «main está roja» y se abrió un ticket sobre un defecto que no existía: eran\n' +
    '  cinco tests fallando por una dependencia ausente. Lo que falta no se ve mirando el código.\n\n' +
    '  Arréglalo con `npm ci` en TU árbol. Medido con un junction de juguete el 11-ago-2026:\n' +
    '  borrar `node_modules` cuando es un junction **retira el enlace y deja el destino intacto**,\n' +
    '  así que `npm ci` en un árbol enlazado NO arrasa el compartido — te saca de él.\n\n' +
    '  ⚠️ Lo que sí lo arrasa es `rmdir /s` sobre el junction. Sin `/s` quita el enlace; con `/s`\n' +
    '  borra el destino compartido. Ya pasó dos veces en este proyecto.';
}
