#!/usr/bin/env node
// scripts/frontera-dist.mjs — SCRUM-763
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// RESTAURAR EL FUENTE NO ES RESTAURAR EL ÁRBOL.
//
// La casa verifica sus restauraciones por BYTES DEL FUENTE —`Buffer.compare(disco, ORIGINAL)`,
// SCRUM-570— y es el método correcto. **Pero es incompleto en cuanto hay compilación**, porque
// el árbol que ejecutan los tests no es el fuente: es `dist/`, y `dist/` no lo toca ninguna
// restauración del fuente.
//
// ── EL CASO, REPRODUCIDO EL 6-sep-2026 SOBRE `src/core/utils/utils.ts` ──────────────────────
//   0. `node --test tests/utils.test.mjs` .................... exit 0   (verde)
//   1. muto el `.ts` ('&lt;' → '&LT;')
//   2. `npm run build` ....................................... exit 0
//   3. tests ................................................. exit 1   (rojo: dist lleva la mutación)
//   4. restauro el FUENTE · `Buffer.compare(fuente, ORIGINAL)`  **= 0**  ← «restauración verificada»
//   5. 🔴 SIN RECOMPILAR, vuelvo a medir ..................... exit 1   ← EL DEFECTO
//      `Buffer.compare(dist, ORIGINAL_dist)` = -1 (dist SIGUE mutado)
//   6. control positivo: recompilo ........................... exit 0, y dist vuelve a cuadrar
//
// El paso 4 da VERDE sobre un árbol que sigue mutado. La comprobación no miente sobre lo que
// mide —el fuente **está** restaurado—: miente sobre lo que se cree que mide.
//
// ── LA OTRA DIRECCIÓN, TAMBIÉN MEDIDA AQUÍ EL 6-sep ─────────────────────────────────────────
// `noEmitOnError` está DESACTIVADO en `tsconfig.json`. Metiendo un TS2353 a propósito:
// **`npm run build` sale con exit 2 y AUN ASÍ escribe `dist/`** (la sonda aparece dos veces en
// el `.js` emitido). O sea que un `dist/` puede reflejar un fuente que no compila, y el único
// aviso es el código de salida del build — que es fácil de perder detrás de un `| tail`.
//
// ⚠️ HUECO DECLARADO: este instrumento contesta «¿`dist/` corresponde al fuente?», NO «¿el
// fuente compila?». Lo segundo lo contesta el exit code de `npm run build`, y aquí no se imita.
//
// ── POR QUÉ SE COMPARA TRANSPILANDO, Y NO POR MARCA DE TIEMPO ───────────────────────────────
// Medido antes de elegir la forma (regla: mídelo, no lo predigas), sobre los 269 `.ts` de `src`:
//
//     ts.transpileModule(fuente, opciones del tsconfig del proyecto)  vs  el `.js` de `dist/`
//     IGUALES byte a byte : 269 / 269      ·      DISTINTOS : 0      ·      1,7 s los 269
//
// O sea ~6 ms por fichero, exacto, y **derivado del propio compilador y del propio tsconfig**:
// no hay un segundo criterio que pueda divergir del build (escalón 2 del escalón de instrumentos,
// no el 3). Una marca de tiempo habría sido más barata y menos cierta: `touch` la engaña, y un
// reloj que va hacia atrás la vuelve loca.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SALIDA_DESAJUSTE = 1;
export const SALIDA_CIEGO = 2;

let _cfg = null;
/** Las opciones REALES del proyecto, leídas de su `tsconfig.json`. Nada hardcodeado. */
export function opcionesDelProyecto(raiz = RAIZ) {
  if (_cfg && _cfg.raiz === raiz) return _cfg;
  const fichero = path.join(raiz, 'tsconfig.json');
  const leido = ts.readConfigFile(fichero, ts.sys.readFile);
  if (leido.error) throw new Error(`no pude leer ${fichero}`);
  const par = ts.parseJsonConfigFileContent(leido.config, ts.sys, raiz);
  const opciones = par.options;
  const dirFuente = opciones.rootDir || path.join(raiz, 'src');
  const dirSalida = opciones.outDir || path.join(raiz, 'dist');
  _cfg = { raiz, opciones, dirFuente, dirSalida };
  return _cfg;
}

const aBarras = (p) => p.split(path.sep).join('/');

/**
 * ¿Este fichero del árbol se COMPILA a `dist/`? Devuelve la ruta relativa de su `.js`, o `null`
 * si no se compila (un `.mjs`, un `.js` de `public/`, un `.d.ts`…).
 *
 * 🔴 `null` NO es un fallo: es la respuesta correcta para la mayoría del árbol, y es lo que
 * mantiene el CONTRASTE que pide SCRUM-763 — una mutación sobre `.mjs` no paga ni un milisegundo
 * de compilación, porque para ella no hay nada que compilar.
 */
export function destinoEnDist(relativa, raiz = RAIZ) {
  const { dirFuente, dirSalida } = opcionesDelProyecto(raiz);
  const rel = aBarras(relativa);
  if (!rel.endsWith('.ts') || rel.endsWith('.d.ts')) return null;
  const abs = path.resolve(raiz, relativa);
  const dentro = path.relative(dirFuente, abs);
  if (dentro.startsWith('..') || path.isAbsolute(dentro)) return null; // fuera de rootDir
  return aBarras(path.relative(raiz, path.join(dirSalida, dentro))).replace(/\.ts$/, '.js');
}

/** El `.js` que ESTE texto fuente produce hoy, con el compilador y las opciones del proyecto. */
export function emitirDesdeFuente(rutaAbs, texto, raiz = RAIZ) {
  const { opciones } = opcionesDelProyecto(raiz);
  return ts.transpileModule(texto, { compilerOptions: opciones, fileName: rutaAbs }).outputText;
}

/**
 * ¿El `dist/` de este fuente corresponde a lo que el fuente dice hoy?
 *
 * Estados: `no-aplica` (no se compila) · `sin-dist` (falta el `.js`: hay que compilar) ·
 * `corresponde` · `no-corresponde` (🔴 el árbol ejecutable NO es el fuente).
 */
export function correspondencia(relativa, raiz = RAIZ, textoFuente = null) {
  const destino = destinoEnDist(relativa, raiz);
  if (!destino) return { estado: 'no-aplica', fuente: aBarras(relativa), destino: null };
  const absFuente = path.resolve(raiz, relativa);
  const absDestino = path.resolve(raiz, destino);
  if (!fs.existsSync(absDestino)) return { estado: 'sin-dist', fuente: aBarras(relativa), destino };
  const texto = textoFuente ?? fs.readFileSync(absFuente, 'utf8');
  const emitido = Buffer.from(emitirDesdeFuente(absFuente, texto, raiz), 'utf8');
  const enDisco = fs.readFileSync(absDestino);
  return {
    estado: Buffer.compare(emitido, enDisco) === 0 ? 'corresponde' : 'no-corresponde',
    fuente: aBarras(relativa),
    destino,
  };
}

function listarTs(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listarTs(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Censo de TODA la frontera `src/` ↔ `dist/`. Lleva su población, que es lo que hace legible un cero. */
export function censoDeLaFrontera(raiz = RAIZ) {
  const { dirFuente } = opcionesDelProyecto(raiz);
  const corresponden = [];
  const noCorresponden = [];
  const sinDist = [];
  for (const abs of listarTs(dirFuente)) {
    const r = correspondencia(path.relative(raiz, abs), raiz);
    if (r.estado === 'corresponde') corresponden.push(r);
    else if (r.estado === 'no-corresponde') noCorresponden.push(r);
    else if (r.estado === 'sin-dist') sinDist.push(r);
  }
  return {
    poblacion: corresponden.length + noCorresponden.length + sinDist.length,
    corresponden, noCorresponden, sinDist,
  };
}

if (ejecutadoDirectamente(import.meta.url)) {
  const t0 = Date.now();
  const c = censoDeLaFrontera();
  const seg = ((Date.now() - t0) / 1000).toFixed(1);

  // 🔴 CERO SOBRE POBLACIÓN VACÍA NO ES UN CERO. Sin ficheros que mirar, «no hay desajustes» y
  // «no supe mirar» se escriben igual, así que aquí se separan por construcción.
  if (c.poblacion === 0) {
    console.error('🔴 CIEGO: no he encontrado ni un `.ts` bajo el `rootDir` del proyecto. '
      + 'No he medido nada, así que no puedo decir que no haya desajustes.');
    process.exit(SALIDA_CIEGO);
  }

  console.log(`frontera src/ ↔ dist/ · población ${c.poblacion} ficheros · ${seg} s`);
  console.log(`  corresponden      ${c.corresponden.length}`);
  console.log(`  NO corresponden   ${c.noCorresponden.length}`);
  console.log(`  sin .js en dist   ${c.sinDist.length}`);

  if (c.sinDist.length) {
    console.error('\n🔴 SIN COMPILAR — estos fuentes no tienen su `.js`:\n  · '
      + c.sinDist.map((r) => r.fuente).join('\n  · '));
  }
  if (c.noCorresponden.length) {
    console.error('\n🔴 EL ÁRBOL EJECUTABLE NO ES EL FUENTE. `dist/` no refleja lo que dicen:\n  · '
      + c.noCorresponden.map((r) => `${r.fuente}  →  ${r.destino}`).join('\n  · ')
      + '\n\nCualquier medición hecha sobre este árbol mide un código que NO es el que hay '
      + 'escrito. Recompila (`npm run build`) antes de creerte un verde o un rojo.');
  }
  if (c.sinDist.length || c.noCorresponden.length) process.exit(SALIDA_DESAJUSTE);
}
