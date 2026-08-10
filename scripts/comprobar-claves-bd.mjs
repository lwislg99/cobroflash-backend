#!/usr/bin/env node
// scripts/comprobar-claves-bd.mjs — SCRUM-383 · el guard, ejecutable en UN worktree.
//
// Comprueba que las claves de base de este árbol apuntan a donde su nombre promete, según
// `DESTINOS_ESPERADOS`. La lógica vive en `_clave-vs-destino.mjs`, que es PURA (no lee entorno
// ni se conecta); este fichero es la única parte que toca el `.env`, y por eso está separado:
// así el rojo de la comparación se puede ejercitar sin base de datos ni ficheros.
//
// ⚠️ NO IMPRIME NUNCA LA URL, NI EL USUARIO, NI LA CONTRASEÑA. Todo sale por `describirBD` /
// `parseBDSegura`: solo host y base (regla 9, motivo de SCRUM-226).
//
// POR QUÉ HAY QUE CORRERLO EN LOS CUATRO ÁRBOLES: el defecto que cierra este ticket era que un
// mismo nombre de clave significaba bases distintas SEGÚN LA CARPETA. Un verde en un worktree no
// dice nada de los otros tres — es literalmente la dimensión en la que estaba el fallo.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import 'dotenv/config';
import { raizDeTrabajo } from './_identidad-sesion.mjs';
import {
  DESTINOS_ESPERADOS, OK, comprobarClaveVsDestino, nombreDeWorktree,
} from './_clave-vs-destino.mjs';

/** Las que un árbol de trabajo tiene que tener. `DATABASE_URL` (producción) NO vive en un .env local. */
const OBLIGATORIAS = ['DATABASE_URL_STAGING', 'DATABASE_URL_DEV', 'DATABASE_URL_TESTS'];

export function comprobarEsteArbol({ env = process.env, desde = process.cwd() } = {}) {
  const raiz = raizDeTrabajo(desde);
  const worktree = nombreDeWorktree(raiz) ?? '(no se pudo identificar)';
  const lineas = [`\n[claves de base] worktree: ${worktree}`];
  let fallos = 0;
  let comprobadas = 0;

  for (const clave of OBLIGATORIAS) {
    const valor = env[clave];
    if (!valor) {
      fallos++;
      lineas.push(`  🔴 ${clave}: AUSENTE del entorno de este árbol. Las tres son obligatorias:\n` +
        '     sin ellas, quien lea una clave que no está se lleva `undefined` y el fallo aparece\n' +
        '     más tarde y más lejos, donde ya no se parece a esto.');
      continue;
    }
    comprobadas++;
    const r = comprobarClaveVsDestino(clave, valor, raiz ?? worktree);
    if (r.veredicto === OK) lineas.push(`  ${r.mensaje}`);
    else { fallos++; lineas.push(`\n${r.mensaje}\n`); }
  }

  // Si está presente, se comprueba también la de producción. No es obligatoria en un worktree.
  if (env.DATABASE_URL) {
    const r = comprobarClaveVsDestino('DATABASE_URL', env.DATABASE_URL, raiz ?? worktree);
    comprobadas++;
    if (r.veredicto === OK) lineas.push(`  ${r.mensaje}`);
    else { fallos++; lineas.push(`\n${r.mensaje}\n`); }
  } else {
    lineas.push('  · DATABASE_URL: ausente (normal en un árbol de trabajo; producción no vive aquí).');
  }

  // 🔴 SUELO. Si no se comprobó NADA, esto no puede terminar en verde: «todas cuadran» y «no
  // había ninguna que mirar» se ven igual en pantalla y significan lo contrario.
  if (comprobadas === 0) {
    fallos++;
    lineas.push('  🔴 SUELO: no se comprobó ni una sola clave. Esto NO es un verde — es que no se\n' +
      '     leyó nada (¿`.env` ausente, o `dotenv` sin cargar?). Un guard que no mira, no vale.');
  }

  return { worktree, fallos, comprobadas, salida: lineas.join('\n') };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
// ⚠️ `fileURLToPath`, NUNCA comparar `import.meta.url` con `argv[1]` a pelo: la ruta de este repo
// lleva un espacio («Javier Pereira») y `import.meta.url` lo entrega percent-encodeado mientras
// que `argv[1]` no. Comparadas crudas nunca coinciden, y el guard se vuelve un NO-OP silencioso
// con exit 0 — el defecto exacto de SCRUM-235.
const esCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (esCli) {
  const r = comprobarEsteArbol();
  console.log(r.salida);
  if (r.fallos > 0) {
    console.error(`\n❌ ${r.fallos} problema(s) de claves en «${r.worktree}». No se sigue.\n`);
    process.exit(1);
  }
  console.log(`\n✅ las ${r.comprobadas} claves de «${r.worktree}» apuntan a donde prometen.\n`);
}

// Delata el caso de arriba: si alguien invoca este fichero y no se reconoce como CLI, no puede
// terminar en silencio. `pathToFileURL` se importa para esta comprobación y no para otra cosa.
if (!esCli && process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.error('🔴 este fichero se ejecutó como script pero NO se reconoció como CLI (SCRUM-235).');
  process.exit(1);
}
