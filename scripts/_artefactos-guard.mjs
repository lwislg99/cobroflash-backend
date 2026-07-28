// scripts/_artefactos-guard.mjs — SCRUM-182
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ PASÓ, Y EN QUÉ SE EQUIVOCABA EL DIAGNÓSTICO
//
// Una tanda de ~10,8 min (SCRUM-159, 27-jul-2026) terminó con dos rojos que NO reproducen
// contra el árbol actual: un `/pay/card` que esperaba 404 y recibió 501 (el comportamiento
// ANTERIOR a SCRUM-119, con el arreglo ya en el HEAD de la rama y el `dist` de ahora ya
// 404-first), y un stacktrace apuntando a una línea que en el fichero actual es otra cosa.
// Los dos dicen lo mismo: la tanda se ejecutó contra un árbol distinto del que hay ahora.
//
// El ticket sospechaba de un `dist` COMPARTIDO por junction entre worktrees. **Se midió y no
// es así**: de los 24 worktrees vivos, ninguno tiene `dist` como junction — todos lo tienen
// propio. Lo que sí se comparte es `node_modules`, y por DOS mecanismos distintos, lo que
// hace la superficie mayor de lo que decía el ticket:
//   · junction explícito (wt-scrum-114, wt-scrum-162, wt-scrum-178 → node_modules del repo);
//   · resolución hacia arriba de Node: los worktrees bajo `.claude/worktrees/` viven DENTRO
//     del repo y ni siquiera tienen `node_modules`; resuelven el del padre sin que haya
//     ningún enlace que lo delate. Este segundo es peor justo porque no se ve.
//
// Y el solapamiento NO necesita worktrees para ocurrir: `npm test` es `build && node --test`,
// así que dos tandas en el MISMO árbol ya se pisan el `dist` la una a la otra.
//
// POR ESO EL MECANISMO NO MIRA "QUIÉN COMPARTE QUÉ", SINO EL EFECTO
//
// Cualquier cadena de causas (junction, resolución del padre, dos tandas en el mismo árbol,
// un `prisma generate` de otra sesión) acaba en el mismo hecho observable: **los artefactos
// que la tanda estaba leyendo cambiaron mientras corría**. Se toma una huella antes y otra
// después; si difieren, el resultado de la tanda no es evidencia de nada y se dice así.
//
// Es lo que pedía el propio ticket: «un rojo que dice "el árbol cambió mientras corría" vale
// mil veces más que uno que dice "esperaba 404"». Y es la parte que R6 no cubre: R6 serializa
// la BD, no las compilaciones.
// ─────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

/** Huella de un directorio: cuántos ficheros y cuál es el mtime más reciente. */
export function huellaDe(dir) {
  if (!fs.existsSync(dir)) return { existe: false, ficheros: 0, mtimeMax: 0 };
  let ficheros = 0;
  let mtimeMax = 0;
  const pila = [dir];
  while (pila.length) {
    let entradas;
    try {
      entradas = fs.readdirSync(pila.pop(), { withFileTypes: true });
    } catch {
      continue; // una carpeta que desaparece a mitad del barrido ES la señal, no un error
    }
    for (const e of entradas) {
      const full = path.join(e.parentPath ?? e.path, e.name);
      if (e.isDirectory()) {
        pila.push(full);
        continue;
      }
      try {
        const st = fs.statSync(full);
        ficheros += 1;
        if (st.mtimeMs > mtimeMax) mtimeMax = st.mtimeMs;
      } catch {
        /* idem */
      }
    }
  }
  return { existe: true, ficheros, mtimeMax };
}

/**
 * Dónde vive REALMENTE el cliente de Prisma. No se construye la ruta a mano
 * (`raiz/node_modules/...`) a propósito: en los worktrees de `.claude/worktrees/` esa carpeta
 * NO EXISTE y Node resuelve la del padre. Construirla a mano daría "no existe" en los dos
 * lados de la comparación y el guard no vería nunca un cambio — verde permanente, que es la
 * peor forma de fallar para un guard. `require.resolve` responde con la ruta de verdad.
 */
export function rutaClientePrisma(raiz) {
  try {
    const req = createRequire(path.join(raiz, 'package.json'));
    return path.dirname(req.resolve('@prisma/client'));
  } catch {
    return null;
  }
}

export function huellaArtefactos(raiz) {
  const prisma = rutaClientePrisma(raiz);
  return {
    dist: huellaDe(path.join(raiz, 'dist')),
    tests: huellaDe(path.join(raiz, 'tests')),
    prisma: prisma ? huellaDe(prisma) : { existe: false, ficheros: 0, mtimeMax: 0, noResuelto: true },
  };
}

/** Devuelve la lista de artefactos que cambiaron. Vacía = la tanda leyó un árbol quieto. */
export function compararHuellas(antes, despues) {
  const cambios = [];
  for (const clave of Object.keys(antes)) {
    const a = antes[clave];
    const d = despues[clave];
    if (!d) continue;
    if (a.existe !== d.existe) {
      cambios.push(`${clave}: ${a.existe ? 'existía y ha desaparecido' : 'no existía y ha aparecido'}`);
      continue;
    }
    if (a.ficheros !== d.ficheros) {
      cambios.push(`${clave}: ${a.ficheros} → ${d.ficheros} ficheros`);
    }
    if (a.mtimeMax !== d.mtimeMax) {
      cambios.push(
        `${clave}: reescrito (mtime más reciente ${new Date(a.mtimeMax).toISOString()} → ` +
          `${new Date(d.mtimeMax).toISOString()})`,
      );
    }
  }
  return cambios;
}

export const CODIGO_SALIDA_ARBOL_MOVIDO = 4;

export function mensajeArbolMovido(cambios) {
  return (
    '\n❌ SCRUM-182: EL ÁRBOL CAMBIÓ MIENTRAS LA TANDA CORRÍA.\n' +
    cambios.map((c) => `   · ${c}\n`).join('') +
    '\n   Los resultados de arriba NO son evidencia de nada — ni el verde ni el rojo. La tanda\n' +
    '   ha leído artefactos que otra cosa reescribió a mitad, y eso produce fallos plausibles\n' +
    '   que mandan a investigar código que está bien (el caso de SCRUM-159: "esperaba 404,\n' +
    '   recibí 501" sobre un arreglo que ya estaba en el árbol).\n\n' +
    '   Causas habituales, en orden de probabilidad:\n' +
    '     1. otra tanda o un `npm run build` en ESTE mismo árbol (npm test compila antes de correr);\n' +
    '     2. un `npx prisma generate` en otro worktree: node_modules se comparte por junction Y\n' +
    '        por resolución hacia arriba en los worktrees de .claude/worktrees/;\n' +
    '     3. una edición de tests/ a mitad de la tanda.\n\n' +
    '   R6 («un solo trabajo contra staging a la vez») serializa la BD, NO las compilaciones.\n' +
    '   Espera a tener el árbol para ti y vuelve a lanzarla entera.\n'
  );
}
