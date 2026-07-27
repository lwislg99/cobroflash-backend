#!/usr/bin/env node
// guard-dangerous — hook PreToolUse (master Parte AA2, reglas 3 y AA1.8).
// Bloquea: `prisma migrate dev` · `db push` sin preview confirmado · `--force` · `rm -rf`
// fuera del workspace. Recibe por stdin el JSON del tool call; salir con código 2 bloquea
// la ejecución y el mensaje de stderr vuelve a Claude.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-176 — POR QUÉ ESTO YA NO ES UN `grep` SOBRE EL JSON ENTERO
//
// La versión anterior hacía `grep` sobre TODO el blob de stdin. Eso casa con cualquier sitio
// donde aparezca el literal, no solo con lo que se va a ejecutar. Dos falsos positivos
// reproducidos el 27-jul-2026, los dos con el comando real siendo inofensivo:
//
//   1. `git commit -m "...nunca se ejecuta prisma db push a mano"` → BLOQUEADO por el TEXTO
//      del mensaje. Reescribiendo el mensaje, el mismo commit pasaba.
//   2. `git log --oneline -5` con description "Revisar el commit que usaba git push --force"
//      → BLOQUEADO por el campo `description`, que es prosa que Claude escribe para la UI y
//      que NO SE EJECUTA NUNCA.
//
// La propiedad, que es lo que hay que corregir y no los dos casos: un guard que inspecciona
// TEXTO en vez de la ACCIÓN falla justo en los documentos que describen la acción peligrosa.
// Cuanto mejor documentas la regla, más te bloquea el guard que la defiende.
//
// Y el daño no es el minuto perdido: un guard ruidoso empuja a `--no-verify`, y `--no-verify`
// no desactiva el falso positivo — desactiva el guard ENTERO, verdaderos positivos incluidos.
//
// EL CRITERIO: se mira solo `tool_input.command` (lo que se ejecuta), y de ahí se descuentan
// las regiones que son CARGA DE TEXTO y no invocación: cuerpos de heredoc, here-strings de
// PowerShell y el argumento de `-m`/`--message`. Todo lo demás se sigue mirando igual — un
// `bash -c "npx prisma db push"` lleva el comando entre comillas y sigue bloqueado, porque
// `-c` no es un flag de mensaje.
//
// LO QUE SE SIGUE SIN CUBRIR — ver la lista completa al final del fichero (HUECOS).
// ─────────────────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const SENTINEL_POR_DEFECTO = path.join(AQUI, '..', 'allow-db-push');

// Marcas de sustitución/expansión de shell. Si aparecen dentro de una región que íbamos a
// descontar por ser "texto", la región DEJA de ser inerte: `git commit -m "$(npx prisma db
// push)"` ejecuta de verdad. En la duda, no se descuenta (y por tanto se sigue mirando).
const SUSTITUCION = /\$\(|`|\$\{/;

const inerte = (texto) => !SUSTITUCION.test(texto);

/**
 * Saca el comando que se va a ejecutar del JSON del tool call.
 * Devuelve `null` si no se puede extraer con certeza — el llamante debe entonces caer al
 * comportamiento antiguo (mirar el blob crudo): ruidoso, pero cerrado.
 */
export function extraerComando(crudo) {
  let json;
  try {
    json = JSON.parse(crudo);
  } catch {
    return null;
  }
  const cmd = json?.tool_input?.command;
  return typeof cmd === 'string' ? cmd : null;
}

/**
 * Descuenta del comando las regiones que son carga de texto y no invocación.
 * El orden importa: primero los bloques (heredoc, here-string), que pueden contener a su vez
 * comillas y flags, y solo después el argumento de `-m`.
 */
export function descontarTexto(comando) {
  let s = comando;

  // 1) Cuerpos de heredoc de bash: `<<EOF … EOF`, `<<'EOF' … EOF`, `<<-EOF … EOF`.
  //    Con delimitador ENTRECOMILLADO (`<<'EOF'`) el shell no expande nada: inerte siempre.
  //    Sin comillas, el shell SÍ expande → solo se descuenta si no hay sustitución dentro.
  s = s.replace(
    /<<-?[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g,
    (bloque, comilla) => (comilla || inerte(bloque) ? ' <<TEXTO ' : bloque),
  );

  // 2) Here-strings de PowerShell. `@'…'@` es literal (inerte por definición del lenguaje);
  //    `@"…"@` interpola → mismo criterio que el heredoc sin comillas.
  s = s.replace(/@'[\s\S]*?'@/g, " <TEXTO> ");
  s = s.replace(/@"[\s\S]*?"@/g, (bloque) => (inerte(bloque) ? ' <TEXTO> ' : bloque));

  // 3) Argumento de los flags de MENSAJE. Es la excepción estrecha a propósito: se descuenta
  //    el argumento de `-m`/`--message` (que es prosa para un humano), NO todo lo que vaya
  //    entre comillas — por eso `bash -c "…"` no entra aquí y sigue vigilado.
  s = s.replace(
    /(^|\s)(--message|-am|-ma|-m)(?:=|[ \t]+)("(?:[^"\\]|\\.)*"|'[^']*'|\S+)/g,
    (todo, previo, flag, arg) => (inerte(arg) ? `${previo}${flag} <MENSAJE>` : todo),
  );

  return s;
}

/**
 * Las CUATRO reglas de AA2. Los patrones son los mismos que tenía la versión en bash: lo que
 * cambia es el texto sobre el que se aplican, no lo que se considera peligroso.
 */
function reglas(objetivo, sentinelPath) {
  // 1) prisma migrate dev — PROHIBIDO siempre (regla 3: Prisma sin TTY)
  if (/prisma[^"]{0,40}migrate +dev/.test(objetivo)) {
    return {
      bloqueado: true,
      motivo:
        "'prisma migrate dev' esta prohibido (regla 3). Usa 'prisma migrate diff' (preview) y luego 'db push' autorizado.",
    };
  }

  // 2) db push sin preview confirmado — exige sentinel de un solo uso.
  //    Flujo: migrate diff -> ensenar diff al fundador -> con su OK crear .claude/allow-db-push
  //    (touch) -> el siguiente db push pasa y consume el sentinel.
  if (/prisma[^"]{0,40}db +push/.test(objetivo)) {
    if (fs.existsSync(sentinelPath)) {
      fs.rmSync(sentinelPath, { force: true });
    } else {
      return {
        bloqueado: true,
        motivo:
          "'db push' sin preview confirmado. Ejecuta el preview (migrate diff), ensena el diff al fundador y, con su OK, crea .claude/allow-db-push (un solo uso) antes de reintentar.",
      };
    }
  }

  // 3) --force (git push --force, npm --force, prisma --force...)
  if (/(^|[^A-Za-z-])--force(-with-lease)?\b/.test(objetivo)) {
    return {
      bloqueado: true,
      motivo:
        "'--force' esta prohibido por AA2. Si es imprescindible, pide OK explicito al fundador y que lo ejecute el.",
    };
  }

  // 4) rm -rf fuera del workspace (ruta absoluta, unidad o ~). Relativo dentro del repo se permite.
  if (/rm +-[a-zA-Z]*[rR][a-zA-Z]*[fF][a-zA-Z]* +("?(\/|~|[A-Za-z]:))/.test(objetivo)) {
    return {
      bloqueado: true,
      motivo:
        "'rm -rf' con ruta absoluta fuera del workspace esta prohibido (AA2). Usa rutas relativas dentro del repo.",
    };
  }

  return { bloqueado: false, motivo: '' };
}

/**
 * Decide sobre el JSON crudo del tool call. `sentinelPath` es inyectable para que los tests
 * NUNCA toquen el sentinel de verdad (otra sesión puede estar a mitad de su flujo de db push).
 */
export function evaluar(crudo, sentinelPath = SENTINEL_POR_DEFECTO) {
  const comando = extraerComando(crudo);
  // FAIL-CLOSED: si el JSON no se deja leer, se vuelve al comportamiento antiguo —mirar el
  // blob entero— en vez de dejar pasar. Ruidoso, pero nunca ciego.
  const objetivo = comando === null ? crudo : descontarTexto(comando);
  return reglas(objetivo, sentinelPath);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
const invocadoDirectamente =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invocadoDirectamente) {
  const crudo = fs.readFileSync(0, 'utf8');
  const { bloqueado, motivo } = evaluar(crudo);
  if (bloqueado) {
    process.stderr.write(`guard-dangerous BLOQUEADO: ${motivo}\n`);
    process.exit(2);
  }
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// HUECOS — qué clase de entrada sigue SIN cubrir (DoD de SCRUM-176, punto 3)
//
// Cubierto y bloqueado (verificado en rojo en tests/scrum176-guard-mensaje.test.mjs):
//   · la invocación directa, con o sin comillas alrededor (`bash -c "npx prisma db push"`)
//   · sustitución de comando dentro del argumento de `-m` (`-m "$(npx prisma db push)"`)
//   · JSON ilegible → se mira el blob crudo, como antes
//
// NO cubierto, a sabiendas:
//   · OFUSCACIÓN. Variables (`P=push; npx prisma db $P`), concatenación, `eval`, base64.
//     Nunca estuvo cubierto —tampoco por el grep anterior— y no se puede resolver mirando
//     texto: haría falta interceptar la ejecución, no el string.
//   · Un SHELL alimentado por heredoc (`bash <<EOF … EOF`) o por here-string: el cuerpo se
//     descuenta por ser texto y ahí sí se escaparía una invocación real. Se acepta porque el
//     patrón no aparece en este repo y cerrarlo exigiría saber qué programa consume el
//     heredoc; queda escrito para que no sorprenda.
//   · Mensaje de commit pasado por FICHERO (`git commit -F mensaje.txt`): su contenido no
//     llega nunca al hook, así que ni bloquea ni protege. Es un hueco simétrico y benigno.
//   · Herramientas que NO son Bash/PowerShell: el hook está matcheado solo a esas dos en
//     .claude/settings.json. Un `db push` lanzado por otra vía no pasa por aquí.
// ─────────────────────────────────────────────────────────────────────────────────────────
