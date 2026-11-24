#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1801 ① · ¿TIENE NÚMERO PARA EL CENSO LA RAMA DESDE LA QUE VAS A EMPUJAR?
//
// Medido el 24-nov-2026 (~02:00–02:50Z): la rama `scrum-1787aa-pdf-factura-filas-restantes` (dos
// letras de tramo) puso en ROJO el obligatorio de TODOS los PR y de main durante ~40 min.
// `numeroDeRama` (scripts/_numero-de-rama.mjs) admite UNA letra de tramo, así que la rama salió sin
// número; y `tests/scrum804-la-rama-viva.test.mjs` cruza las refs de `origin` que empiezan por
// `scrum-<dígito>` con las que el censo ve, y ésa no la veía. Nadie avisó antes de empujar.
//
// Este guard NO toca ninguno de los dos (regla 41): IMPORTA `numeroDeRama` —no la copia: A10, «Dos
// anclas para la misma comprobación…»— y la pregunta en la puerta, con la rama actual.
//
// 🔴 POBLACIÓN QUE PONE EN ROJO: sólo los nombres que scrum804 cruza (`/^scrum-\d/i`, su filtro de
// `soloEnGit`) y a los que `numeroDeRama` no les da número. Medido el 24-nov sobre `git ls-remote`:
// 68 de las 191 ramas del remoto (sin `main`) no tienen número —54 son `claude/pr-*`, que crea el
// workflow `@claude`— y scrum804 sigue verde con ellas. Poner rojo a TODA rama sin número tumbaría
// esas PR sin que nada estuviera roto. El filtro está escrito dos veces (aquí y en scrum804) porque
// scrum804 no lo exporta y no se toca; `tests/scrum1801-guard-rama-con-numero.test.mjs` lee el
// fuente de scrum804 y cae si su filtro cambia, para que las dos copias no diverjan en silencio.
//
// SALIDAS: 0 verde · 1 ROJO (rama de ticket sin número) · 2 CIEGO (no sé qué rama es).
// Siempre imprime su población: «1 rama mirada: <nombre>». Un guard que calla no es un guard.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';
import { numeroDeRama } from './_numero-de-rama.mjs';
import { agruparRamas } from './_censo-reparto.mjs';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';

export const SALIDA_VERDE = 0;
export const SALIDA_ROJO = 1;
export const SALIDA_CIEGO = 2;

/** El filtro de `soloEnGit` de tests/scrum804-la-rama-viva.test.mjs (ver la cabecera). */
export const FILTRO_DE_SCRUM804 = /^scrum-\d/i;

/**
 * La rama actual y de dónde salió. En CI de un PR, `GITHUB_HEAD_REF` (el checkout es un merge en
 * HEAD suelto); en un push de CI, `GITHUB_REF_NAME`; fuera de CI, git. `null` si no se sabe.
 */
export function ramaActual({ env = process.env, cwd = process.cwd() } = {}) {
  if (env.GITHUB_HEAD_REF) return { nombre: env.GITHUB_HEAD_REF, origen: 'GITHUB_HEAD_REF' };
  if (env.GITHUB_REF_NAME && env.GITHUB_REF_TYPE !== 'tag') {
    return { nombre: env.GITHUB_REF_NAME, origen: 'GITHUB_REF_NAME' };
  }
  // `symbolic-ref -q` falla con la cabeza suelta (y fuera de git): entonces no hay rama, y es CIEGO.
  try {
    const nombre = execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return { nombre: nombre || null, origen: 'git symbolic-ref' };
  } catch {
    return { nombre: null, origen: 'git symbolic-ref (sin rama: cabeza suelta o fuera de git)' };
  }
}

/** El veredicto sobre UN nombre. Puro: lo prueba el test sin crear ramas. */
export function veredicto(nombre) {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) {
    return { salida: SALIDA_CIEGO, texto: 'CIEGO: no sé en qué rama estoy. No digo verde.' };
  }
  // Lo que el censo excluye lo decide el censo (`agruparRamas`), no una lista copiada aquí.
  if (agruparRamas([limpio]).total === 0) {
    return { salida: SALIDA_VERDE, texto: 'verde: el censo no la cuenta (agruparRamas la excluye).' };
  }
  const n = numeroDeRama(limpio);
  if (n !== null) return { salida: SALIDA_VERDE, texto: `verde: el censo la cuenta como SCRUM-${n}.` };
  if (!FILTRO_DE_SCRUM804.test(limpio)) {
    return {
      salida: SALIDA_VERDE,
      texto: 'verde: no tiene número, pero no empieza por `scrum-<dígito>`: el censo la deja en '
        + '`sinNumero` y scrum804 no la cruza.',
    };
  }
  return {
    salida: SALIDA_ROJO,
    texto: `ROJO: tu rama \`${limpio}\` no tiene número para el censo (scripts/_numero-de-rama.mjs): `
      + 'scrum804 caerá en TODOS los PR. A la 27ª pieza de un ticket, ticket hijo.',
  };
}

if (ejecutadoDirectamente(import.meta.url)) {
  const { nombre, origen } = ramaActual();
  const v = veredicto(nombre);
  const linea = `guard-rama-con-numero · 1 rama mirada: ${nombre ?? '(ninguna)'} (de ${origen}) · ${v.texto}`;
  if (v.salida === SALIDA_VERDE) console.log(linea); else console.error(linea);
  process.exit(v.salida);
}
