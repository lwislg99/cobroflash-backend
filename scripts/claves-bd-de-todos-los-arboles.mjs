#!/usr/bin/env node
// SCRUM-1423 · LAS CLAVES DE BASE DE DATOS DE TODOS LOS ÁRBOLES, POR DESTINO
//
//   node scripts/claves-bd-de-todos-los-arboles.mjs
//
// POR QUÉ EXISTE. `CLAUDE.md` (regla 3) afirma que ningún árbol de trabajo apunta a producción, y
// llevaba una medición del 10-ago-2026 sobre CUATRO árboles. `comprobar-claves-bd.mjs` solo mira el
// árbol desde el que se lanza, así que la frase no se podía volver a medir. El 2-oct-2026, sobre 314
// árboles, a mano: una cadena apuntaba a producción. Una frase así solo es creíble si lleva fecha, y
// solo lleva fecha de verdad si se puede re-fechar con un comando. Éste es el comando.
//
// 🔴 NO IMPRIME NINGÚN VALOR. Ni entero, ni recortado, ni enmascarado, ni el host. De cada cadena salen
// tres cosas y solo tres: el árbol, el NOMBRE del fichero y el NOMBRE de la variable (regla 9). El
// `mensaje` que devuelve el módulo de decisión lleva el host: aquí NO se usa, solo su `veredicto`.
//
// LA DECISIÓN NO ES DE ESTE SCRIPT. «¿Es producción?» lo contesta `comprobarCredencialDeProduccion`
// de `_clave-vs-destino.mjs` (SCRUM-418), y qué valores son cadenas de conexión, `clavesDeConexion`.
// Aquí solo se recorre y se cuenta.
//
// QUÉ MIRA, Y QUÉ NO — y lo que no mira no es «limpio»:
//   · los árboles que git conoce (`git worktree list`). Una copia que no sea un árbol de git NO se ve;
//   · la RAÍZ de cada árbol, y en ella los ficheros `.env` y `.env.<algo>`. Un fichero con otro nombre,
//     o en una subcarpeta, NO se ve.
//
// FAIL-CLOSED. Un árbol que no se puede abrir, un fichero que no se puede leer y una cadena cuyo
// destino no se puede decidir se cuentan como CIEGOS y se nombran: nunca se suman a «ninguno».
//
// SALIDA (la de `veredictoDe`, la misma de los demás guards): 0 = ninguna cadena apunta a producción
// y se pudo mirar todo · 1 = alguna apunta a producción · 2 = no hubo hallazgo pero algo no se pudo mirar.
//
// ⛔ Si sale 1: NO se arregla, NO se borra y NO se mueve nada. Se para y se le dice al fundador.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clavesDeConexion, comprobarCredencialDeProduccion, OK, PRODUCCION_EN_ARBOL } from './_clave-vs-destino.mjs';
import { veredictoDe } from './_hallazgos-y-ciegos.mjs';

/** Un fichero de entorno, por su nombre: `.env` o `.env.<algo>`. */
export const ES_FICHERO_DE_ENTORNO = /^\.env(\..+)?$/;

/**
 * @param {{ruta:string, ficheros:{nombre:string, env:Record<string,string>|undefined}[]|undefined}[]|undefined} arboles
 *   `ficheros: undefined` = el árbol no se pudo abrir · `env: undefined` = el fichero no se pudo leer.
 * @returns {{codigo:0|1|2, lineas:string[], datos?:object}}
 */
export function medir(arboles, { ahora = Date.now() } = {}) {
  const out = ['CLAVES DE BASE DE DATOS · todos los árboles de trabajo, por destino (no se imprime ningún valor)'];
  if (!Array.isArray(arboles) || arboles.length === 0) {
    const v = veredictoDe({ hallazgos: 0, ciegos: 1 });
    out.push('', '🔴 CIEGO: no se pudo listar ningún árbol de trabajo. Esto NO dice que ninguno apunte a producción.', v.linea);
    return { codigo: v.codigo, lineas: out };
  }
  const produccion = []; const ciegos = []; const nombres = {};
  let sinFichero = 0, conFichero = 0, ficheros = 0, sinCadenas = 0, cadenas = 0, noProduccion = 0;
  for (const a of arboles) {
    if (a.ficheros === undefined) { ciegos.push(`${a.ruta} · el árbol no se pudo abrir`); continue; }
    if (a.ficheros.length === 0) { sinFichero++; continue; }
    conFichero++;
    for (const f of a.ficheros) {
      ficheros++; nombres[f.nombre] = (nombres[f.nombre] || 0) + 1;
      if (f.env === undefined) { ciegos.push(`${a.ruta} · ${f.nombre} · el fichero no se pudo leer`); continue; }
      const con = clavesDeConexion(f.env);
      if (con.length === 0) { sinCadenas++; continue; }
      for (const { clave, valor } of con) {
        cadenas++;
        let veredicto; try { veredicto = comprobarCredencialDeProduccion(clave, valor, a.ruta).veredicto; } catch { veredicto = undefined; }
        if (veredicto === PRODUCCION_EN_ARBOL) produccion.push(`${a.ruta} · ${f.nombre} · ${clave}`);
        else if (veredicto === OK) noProduccion++;
        else ciegos.push(`${a.ruta} · ${f.nombre} · ${clave} · no se pudo decidir su destino`);
      }
    }
  }
  const v = veredictoDe({ hallazgos: produccion, ciegos });
  const fecha = new Date(ahora).toISOString().slice(0, 10);
  out.push(
    '',
    `árboles de trabajo mirados: ${arboles.length} · sin fichero de entorno en su raíz: ${sinFichero} · con alguno: ${conFichero}`,
    `ficheros de entorno: ${ficheros}${ficheros ? ` (${Object.entries(nombres).map(([k, n]) => `${n} ${k}`).join(' · ')})` : ''} · sin ninguna cadena de conexión dentro: ${sinCadenas}`,
    `cadenas de conexión: ${cadenas} · no son producción: ${noProduccion} · APUNTAN A PRODUCCIÓN: ${produccion.length} · sin poder decidir o leer: ${ciegos.length}`,
    '',
    `🔴 APUNTAN A PRODUCCIÓN (${produccion.length}) — árbol · fichero · variable:`,
    ...(produccion.length ? produccion.map((p) => `   · ${p}`) : ['   ninguna']),
    '',
    `NO SE PUDO MIRAR (${ciegos.length}) — no cuentan como «ninguna»:`,
    ...(ciegos.length ? ciegos.map((p) => `   · ${p}`) : ['   nada']),
    '',
    'LÍMITES: solo los árboles que git conoce · solo la RAÍZ de cada uno · solo ficheros `.env` y `.env.<algo>`.',
    '',
    'LA FRASE, FECHADA (para proponer, no para pegar sin leer):',
    v.codigo === 0
      ? `   «Medido el ${fecha} sobre ${arboles.length} árboles de trabajo (${ficheros} ficheros de entorno, ${cadenas} cadenas de conexión): ninguna apunta a producción.»`
      : v.codigo === 1
        ? `   «Medido el ${fecha} sobre ${arboles.length} árboles de trabajo: ${produccion.length} cadena(s) de conexión APUNTAN A PRODUCCIÓN.» ⛔ No se arregla ni se borra nada: se para y se le dice al fundador.`
        : `   NO HAY FRASE: ${ciegos.length} cosa(s) no se pudieron mirar, y «no pude mirar» no es «no hay ninguna».`,
    '',
    v.linea,
  );
  return { codigo: v.codigo, lineas: out, datos: { produccion, ciegos, cadenas, ficheros, noProduccion, sinFichero, conFichero } };
}

/** Los árboles de verdad. Lo que no se puede abrir o leer llega como `undefined`, nunca como vacío. */
export async function leerArboles(raiz) {
  let lista; try { lista = execFileSync('git', ['-C', raiz, 'worktree', 'list', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return undefined; }
  const { parse } = (await import('dotenv')).default;
  return leerRutas(lista.split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9).trim()), parse);
}

export function leerRutas(rutas, parse) {
  return rutas.map((ruta) => {
    let entradas; try { entradas = fs.readdirSync(ruta, { withFileTypes: true }); } catch { return { ruta, ficheros: undefined }; }
    const ficheros = entradas.filter((e) => e.isFile() && ES_FICHERO_DE_ENTORNO.test(e.name)).map((e) => {
      let env; try { env = parse(fs.readFileSync(path.join(ruta, e.name))); } catch { env = undefined; }
      return { nombre: e.name, env };
    });
    return { ruta, ficheros };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const r = medir(await leerArboles(raiz));
  console.log(r.lineas.join('\n'));
  process.exit(r.codigo);
}
