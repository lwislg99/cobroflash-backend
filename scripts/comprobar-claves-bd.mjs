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
  comprobarCredencialDeProduccion, clavesDeConexion,
} from './_clave-vs-destino.mjs';

/**
 * Las que un árbol de trabajo tiene que tener. `DATABASE_URL` (producción) NO vive en un `.env`
 * local — y desde SCRUM-418 eso ya no es sólo una frase en este comentario: lo hace cumplir el
 * barrido por destino del final de `comprobarEsteArbol`.
 */
const OBLIGATORIAS = ['DATABASE_URL_STAGING', 'DATABASE_URL_DEV', 'DATABASE_URL_TESTS'];

/**
 * @param raiz  la raíz del árbol, INYECTABLE. Por defecto se descubre con `raizDeTrabajo`, que
 *   busca un `.git` hacia arriba — y por eso una ruta que no existe en disco no se puede usar
 *   para probar. Poder pasarla es lo que permite ejercitar los rojos de los CUATRO worktrees sin
 *   tener los cuatro delante ni leer un solo `.env` real, que es justo la dimensión en la que
 *   estaba el fallo de SCRUM-383 (misma clave, distinta base según la carpeta).
 */
export function comprobarEsteArbol({ env = process.env, desde = process.cwd(), raiz: raizDada = null } = {}) {
  const raiz = raizDada ?? raizDeTrabajo(desde);
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

  // ── SCRUM-418 · NINGUNA CLAVE DE ESTE ÁRBOL PUEDE APUNTAR A PRODUCCIÓN ──────────────────
  //
  // 🔴 Antes esto se preguntaba SOLO por `DATABASE_URL` y SOLO con `comprobarClaveVsDestino`, y
  // las dos mitades fallaban a la vez:
  //
  //   · por NOMBRE: bastaba llamarla de otra forma para no ser mirada;
  //   · por VEREDICTO: `DATABASE_URL` → producción daba **`cuadra`**, sumaba a `comprobadas` y NO
  //     sumaba fallo. O sea que la credencial más peligrosa de todas salía EN VERDE, mientras que
  //     la misma clave apuntando a staging fallaba. Estaba al revés.
  //
  // Ahora se barren TODAS las cadenas de conexión del entorno, se llamen como se llamen, y se
  // pregunta por su DESTINO. La comprobación de coherencia de arriba se conserva entera: son dos
  // preguntas distintas y ninguna sustituye a la otra.
  const conexiones = clavesDeConexion(env);
  for (const { clave, valor } of conexiones) {
    const r = comprobarCredencialDeProduccion(clave, valor, raiz ?? worktree);
    if (r.veredicto === OK) continue;          // ya se informa del destino arriba; aquí sólo el hallazgo
    fallos++;
    lineas.push(`\n${r.mensaje}\n`);
  }
  if (conexiones.length && !conexiones.some(({ clave }) => clave === 'DATABASE_URL')) {
    lineas.push('  · DATABASE_URL: ausente (correcto en un árbol de trabajo; producción no vive aquí).');
  }

  // 🔴 SUELO. Si no se comprobó NADA, esto no puede terminar en verde: «todas cuadran» y «no
  // había ninguna que mirar» se ven igual en pantalla y significan lo contrario.
  //
  // ⚠️ El suelo mira las DOS cosas, y la segunda se añadió en SCRUM-418: sin `conexiones`, el
  // barrido de producción no ha mirado nada, y un barrido que no mira nada no puede declarar que
  // no hay credencial de producción — declararía la ceguera como limpieza.
  if (comprobadas === 0 || conexiones.length === 0) {
    fallos++;
    lineas.push('  🔴 SUELO: no se leyó ni una sola cadena de conexión. Esto NO es un verde — es que\n' +
      '     no se miró nada (¿`.env` ausente, o `dotenv` sin cargar?). «No hay credencial de\n' +
      '     producción» y «no supe mirar» se ven igual aquí y significan lo contrario.');
  }

  return { worktree, fallos, comprobadas, conexiones: conexiones.length, salida: lineas.join('\n') };
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
  console.log(`\n✅ las ${r.comprobadas} claves de «${r.worktree}» apuntan a donde prometen, y ` +
    `ninguna de las ${r.conexiones} cadenas de conexión de este árbol va a producción.\n`);
}

// Delata el caso de arriba: si alguien invoca este fichero y no se reconoce como CLI, no puede
// terminar en silencio. `pathToFileURL` se importa para esta comprobación y no para otra cosa.
if (!esCli && process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.error('🔴 este fichero se ejecutó como script pero NO se reconoció como CLI (SCRUM-235).');
  process.exit(1);
}
