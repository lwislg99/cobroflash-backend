#!/usr/bin/env node
// scripts/arbol-mio.mjs — SCRUM-774 · PASO 0: ¿el árbol donde estoy es el mío?
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// «Que una sesión pueda saber, ANTES de escribir, si el árbol es suyo.» (SCRUM-774, punto 2)
//
// El 6-sep-2026 dos sesiones trabajaron el mismo worktree (`cobroflash-b3`) sin que ninguna de
// las dos hiciera nada prohibido: una tenía SCRUM-586 a medias, la otra hizo `checkout -b
// scrum-760` + `reset --hard` sobre ESE MISMO árbol. El trabajo de la primera desapareció sin un
// error, sin un conflicto, sin un rojo — su rama sencillamente no se había movido.
//
// Este script no evita eso (eso lo hace la ampliación de `.claude/hooks/guard-dangerous.mjs`,
// misma entrega): CONSTATA, antes de tocar código, en qué worktree y en qué rama está esta
// sesión, y si esa rama es la del ticket que va a trabajar. Sólo LECTURA.
//
// Uso:
//   node scripts/arbol-mio.mjs 774      # exit 1 si la rama actual NO es de SCRUM-774
//   node scripts/arbol-mio.mjs          # informativo: imprime dónde está, exit 0 siempre
import { execFileSync } from 'node:child_process';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs'; // SCRUM-765: nunca comparar a mano

/** ¿La rama `rama` es de ese `ticket`? Puro: sin tocar disco ni red. */
export function veredictoArbol(rama, ticket) {
  if (!ticket) return { veredicto: 'INFORMATIVO' };
  if (!rama) return { veredicto: 'CIEGO', motivo: 'HEAD desacoplado: no hay rama que comparar.' };
  const patron = new RegExp(`^scrum-0*${ticket}[a-z]?-`);
  if (patron.test(rama)) return { veredicto: 'MIO' };
  return {
    veredicto: 'NO-MIO',
    motivo: `la rama actual («${rama}») no empieza por scrum-${ticket}(letra opcional)- — `
      + 'no es la de este ticket. Antes de escribir: ¿es tuyo este árbol, o lo dejó otra sesión '
      + 'a medias? Si es ajeno, PARA y avisa; no hagas `checkout -b`/`reset --hard` aquí.',
  };
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/** Lo que ve esta sesión ahora mismo: worktree, rama, y el veredicto si se le da un ticket. */
export function arbolMio(cwd, ticket) {
  const raiz = git(['rev-parse', '--show-toplevel'], cwd);
  if (raiz === null) return { veredicto: 'CIEGO', motivo: 'no es un árbol git (o no se pudo leer).' };
  const rama = git(['branch', '--show-current'], cwd);
  return { arbol: raiz, rama: rama || null, ...veredictoArbol(rama, ticket) };
}

if (ejecutadoDirectamente(import.meta.url)) {
  const r = arbolMio(process.cwd(), process.argv[2]);
  process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  process.exit(r.veredicto === 'NO-MIO' || r.veredicto === 'CIEGO' ? 1 : 0);
}
