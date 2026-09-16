// scripts/_preflight-migracion.mjs — SCRUM-395
//
// ¿ESTOY EN LA RAMA QUE CREO?
//
// El 7-ago-2026 una sesión generó un diff de migración creyendo estar en `scrum-300-c5-fusion-
// rebasada` y el worktree estaba en `scrum-298-interruptor-verifactu`: otra sesión lo había
// movido mientras trabajaba. `prisma migrate diff` no mide el trabajo de nadie — mide **lo que
// hay checkouteado AHORA**, y propuso borrar cuatro columnas.
//
// Nada comparaba esas dos cosas. Esto las compara.
//
// ⚠️ LO QUE ESTO **NO** ES: no es propiedad del worktree. No sabe de quién es la rama ni tiene
// forma de saberlo (ver el descope en `docs/master/SCRUM-395.md`). Comprueba una sola cosa: que
// la rama que declaras es la que hay. Si otra sesión te mueve el árbol, esto lo DELATA — no lo
// impide.
import { execFileSync } from 'node:child_process';

export const COINCIDE = 'coincide';
export const NO_COINCIDE = 'no_coincide';
export const NO_PUDE_LEER = 'no_pude_leer';

/**
 * Compara PURA: no toca git. Así su rojo se ejercita sin preparar un repo.
 */
export function compararRama(ramaEsperada, ramaReal, { worktree = null } = {}) {
  const esperada = String(ramaEsperada ?? '').trim();
  const real = String(ramaReal ?? '').trim();

  if (!esperada) {
    return {
      veredicto: NO_PUDE_LEER,
      mensaje:
        '🔴 NO SE DECLARÓ NINGUNA RAMA ESPERADA.\n\n' +
        '  Este preflight compara lo que CREES con lo que HAY. Sin la primera mitad no compara\n' +
        '  nada, y un preflight que no compara nada no puede terminar en verde.',
    };
  }
  if (!real) {
    return {
      veredicto: NO_PUDE_LEER,
      mensaje:
        `🔴 NO SE PUDO LEER LA RAMA REAL DEL ÁRBOL${worktree ? ` (${worktree})` : ''}.\n\n` +
        `  Declarabas: ${esperada}\n` +
        '  Encontrada: NO SE SABE\n\n' +
        '  No se sigue. «No pude comprobarlo» no es «coincide»: si se dejara pasar, la migración\n' +
        '  se generaría contra un schema que nadie ha identificado.',
    };
  }
  if (esperada === real) {
    return { veredicto: COINCIDE, mensaje: `[preflight] rama declarada y real coinciden: ${real}` };
  }
  return {
    veredicto: NO_COINCIDE,
    mensaje:
      '🔴 EL ÁRBOL NO ESTÁ EN LA RAMA QUE DECLARAS.\n\n' +
      `  Worktree:   ${worktree || '(sin identificar)'}\n` +
      `  Declarabas: ${esperada}\n` +
      `  Encontrada: ${real}\n\n` +
      '  NO se genera ni se aplica nada. `prisma migrate diff` deriva el SQL del `schema.prisma`\n' +
      '  QUE HAY EN EL ÁRBOL: contra otra rama, el diff propone DEJAR LA BASE COMO ESA OTRA RAMA\n' +
      '  — es decir, BORRAR lo que tu rama añade. Pasó el 7-ago-2026 con las cuatro columnas de\n' +
      '  C5 (SCRUM-395), y lo único que lo paró fue que alguien leyera el SQL.\n\n' +
      '  Qué hacer: vuelve a tu rama, o cambia lo que declaras si de verdad querías ésta. Lo que\n' +
      '  NO se hace es seguir: el SQL que salga de aquí no es el de tu trabajo.',
  };
}

/** Lee la rama real del árbol. Devuelve `null` si no se puede (detached, no es repo, git ausente). */
export function ramaRealDe(cwd = process.cwd()) {
  try {
    const r = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    // En HEAD separado devuelve «HEAD», que no es un nombre de rama: no vale como coincidencia.
    return r && r !== 'HEAD' ? r : null;
  } catch { return null; }
}

/** El enganche: lee el árbol y compara. */
export function preflightRama(ramaEsperada, { cwd = process.cwd(), worktree = null } = {}) {
  return compararRama(ramaEsperada, ramaRealDe(cwd), { worktree: worktree ?? cwd.split(/[\\/]/).pop() });
}
