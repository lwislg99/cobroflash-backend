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
// SCRUM-454 (a) — LAS TRES EXCEPCIONES DE SCRUM-176 ERAN TRES FORMAS, NO EL HECHO
//
// SCRUM-176 dejó de mirar el blob entero y pasó a descontar heredoc, here-string y `-m`. Son
// tres FORMAS concretas de escribir texto. El hecho —«el literal está dentro de un argumento,
// no es lo que se invoca»— tiene infinitas formas más, y tres de ellas se midieron bloqueando
// el 11-ago-2026 con el hook real:
//
//   · `node medir.mjs "git push --force origin main"`      ← medir el propio guard
//   · `node hook.mjs '{"tool_input":{"command":"…db push"}}'` ← probar el propio guard
//   · `grep -n "rm -rf /" docs/RUNBOOKS.md`                 ← BUSCAR LA REGLA EN EL RUNBOOK
//
// El tercero es el que define el problema: **la barrera impide leer la documentación de la
// barrera**. Y es peor que un incordio — es un prerrequisito de SCRUM-454: cada patrón nuevo
// que se añada multiplica los sitios donde verificarla queda bloqueado, y lo que se abandona
// entonces no es el patrón nuevo, es la verificación entera.
//
// EL CRITERIO NUEVO, que sí es el hecho: **una coincidencia solo cuenta si toca al menos un
// carácter que NO venía de dentro de unas comillas.** La línea se tokeniza como la tokenizaría
// un shell y se lleva una máscara de «esto venía entrecomillado»; los cuatro patrones son los
// mismos de siempre y se aplican al mismo texto de siempre — lo único que cambia es que un
// acierto enteramente dentro de un argumento entrecomillado ya no cuenta.
//
// Y NO abre un agujero, porque el argumento entrecomillado que SÍ se ejecuta se sigue mirando,
// por dos caminos que son mecanismo y no lista:
//   · ENVOLTORIOS (`bash -c "…"`, `cmd /c "…"`, `eval`): su argumento se vuelve a analizar
//     como línea de comando (recursión), así que `bash -c "npx prisma db push"` sigue cayendo.
//   · SUSTITUCIÓN (`$(…)`, backticks): se extrae de la línea ORIGINAL y se analiza aparte, así
//     que `git commit -m "$(npx prisma db push)"` sigue cayendo.
// Los dos casos son exactamente los que SCRUM-176 puso en verde, y siguen en verde por
// construcción, no por suerte.
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

// ── SCRUM-454 · TOKENIZADO: separar lo que se INVOCA de lo que se ARRASTRA como argumento ──

/** Programas cuyo argumento entrecomillado ES una línea de comando y se vuelve a analizar. */
// Ampliar esta lista solo puede hacer que el guard bloquee MÁS, nunca menos: por eso se puede
// ampliar sin ceremonia. Es lo contrario de una lista blanca.
const ENVOLTORIOS = new Set(['bash', 'sh', 'zsh', 'dash', 'cmd', 'cmd.exe', 'powershell', 'powershell.exe', 'pwsh', 'eval']);

const SEPARADORES = new Set([';', '|', '&', '&&', '||', '\n']);
/** Redirecciones que TRUNCAN el destino. `>>` (añadir) y `>&` (duplicar descriptor) no. */
const TRUNCANTES = new Set(['>', '>|', '&>']);

/**
 * Parte una línea en tokens como lo haría un shell, guardando por cada carácter si venía de
 * dentro de unas comillas. Esa máscara es todo el mecanismo: sin ella no hay forma de
 * distinguir ejecutar de mencionar.
 */
export function tokenizar(linea) {
  const tokens = [];
  let palabra = null;
  const cerrar = () => {
    if (palabra) tokens.push(palabra);
    palabra = null;
  };
  const anadir = (texto, entrecomillado) => {
    if (!palabra) palabra = { texto: '', mascara: [], entrecomillado: false };
    palabra.texto += texto;
    for (let k = 0; k < texto.length; k++) palabra.mascara.push(entrecomillado);
    if (entrecomillado) palabra.entrecomillado = true;
  };
  // Un descriptor pegado a la redirección (`2>`) es parte del operador, no una palabra suelta.
  const soltarDescriptor = () => {
    if (palabra && /^\d+$/.test(palabra.texto)) palabra = null;
    else cerrar();
  };

  let i = 0;
  while (i < linea.length) {
    const c = linea[i];
    if (c === '\\' && i + 1 < linea.length) { anadir(linea[i + 1], false); i += 2; continue; }
    if (c === '"' || c === "'") {
      const fin = linea.indexOf(c, i + 1);
      const corte = fin === -1 ? linea.length : fin;
      anadir(linea.slice(i + 1, corte), true);
      i = corte + 1;
      continue;
    }
    if (c === '\n') { cerrar(); tokens.push({ operador: '\n' }); i++; continue; }
    // Un comentario no se ejecuta. Solo cuenta si abre palabra (`x #y` es comentario, `a#b` no).
    if (c === '#' && !palabra) { const fin = linea.indexOf('\n', i); i = fin === -1 ? linea.length : fin; continue; }
    if (/\s/.test(c)) { cerrar(); i++; continue; }

    const dos = linea.slice(i, i + 2);
    if (dos === '&&' || dos === '||') { cerrar(); tokens.push({ operador: dos }); i += 2; continue; }
    if (dos === '&>') { cerrar(); tokens.push({ operador: dos }); i += 2; continue; }
    if (dos === '>&') {
      // Duplicar descriptor (`2>&1`): ni trunca nada ni deja un `1` suelto haciendo de argumento.
      soltarDescriptor();
      tokens.push({ operador: dos });
      i += 2;
      while (i < linea.length && /[\d-]/.test(linea[i])) i++;
      continue;
    }
    if (dos === '>>' || dos === '>|') { soltarDescriptor(); tokens.push({ operador: dos }); i += 2; continue; }
    if (c === '>') { soltarDescriptor(); tokens.push({ operador: '>' }); i++; continue; }
    if (c === '<') { cerrar(); tokens.push({ operador: '<' }); i++; continue; }
    if (c === ';' || c === '|' || c === '&') { cerrar(); tokens.push({ operador: c }); i++; continue; }

    anadir(c, false);
    i++;
  }
  cerrar();
  return tokens;
}

/** Reconstruye una acción (un comando simple) a partir de sus tokens. */
function construir(tokens) {
  const palabras = [];
  const redirecciones = [];
  let texto = '';
  let mascara = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.operador) {
      const destino = tokens[i + 1];
      if (TRUNCANTES.has(t.operador) && destino && !destino.operador) redirecciones.push(destino.texto);
      continue;
    }
    if (texto.length) { texto += ' '; mascara.push(false); }
    texto += t.texto;
    mascara = mascara.concat(t.mascara);
    palabras.push(t);
  }
  // El programa: la primera palabra que no sea una asignación de entorno (`VAR=x cmd`).
  const util = palabras.filter((p) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(p.texto));
  const programa = util.length ? path.basename(util[0].texto).toLowerCase() : '';
  return { texto, mascara, palabras: util, redirecciones, programa };
}

/**
 * Todas las acciones que una línea llega a EJECUTAR: cada comando simple, más lo que se
 * ejecuta dentro de un envoltorio o de una sustitución de comando.
 */
export function acciones(comando, profundidad = 0) {
  const salida = [];
  if (profundidad > 3) return salida; // cota: una línea no se anida sola hasta el infinito
  let actual = [];
  const cerrar = () => {
    if (actual.length) salida.push(construir(actual));
    actual = [];
  };
  for (const t of tokenizar(comando)) {
    if (t.operador && SEPARADORES.has(t.operador)) cerrar();
    else actual.push(t);
  }
  cerrar();

  // 1) Envoltorios: su argumento entrecomillado es una línea de comando de verdad.
  for (const a of [...salida]) {
    if (!ENVOLTORIOS.has(a.programa)) continue;
    for (const p of a.palabras) if (p.entrecomillado) salida.push(...acciones(p.texto, profundidad + 1));
  }
  // 2) Sustitución de comando: se ejecuta esté donde esté, también dentro de comillas.
  for (const m of comando.matchAll(/\$\(([\s\S]*?)\)|`([\s\S]*?)`/g)) {
    salida.push(...acciones(m[1] ?? m[2] ?? '', profundidad + 1));
  }
  return salida;
}

/**
 * ¿El patrón acierta sobre ALGO QUE SE INVOCA? Un acierto que cae entero dentro de un argumento
 * entrecomillado no cuenta: eso es mencionar, no ejecutar.
 */
export function coincide(re, accion) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  for (const m of accion.texto.matchAll(g)) {
    for (let k = m.index; k < m.index + m[0].length; k++) {
      if (!accion.mascara[k]) return true;
    }
  }
  return false;
}

/**
 * Las CUATRO reglas de AA2. Los patrones son los mismos que tenía la versión en bash: lo que
 * cambia es el texto sobre el que se aplican, no lo que se considera peligroso.
 */
function reglas(lista, sentinelPath) {
  const enAlguna = (re) => lista.some((a) => coincide(re, a));

  // 1) prisma migrate dev — PROHIBIDO siempre (regla 3: Prisma sin TTY)
  if (enAlguna(/prisma[^"]{0,40}migrate +dev/)) {
    return {
      bloqueado: true,
      motivo:
        "'prisma migrate dev' esta prohibido (regla 3). Usa 'prisma migrate diff' (preview) y luego 'db push' autorizado.",
    };
  }

  // 2) db push sin preview confirmado — exige sentinel de un solo uso.
  //    Flujo: migrate diff -> ensenar diff al fundador -> con su OK crear .claude/allow-db-push
  //    (touch) -> el siguiente db push pasa y consume el sentinel.
  //
  //    SE COMPRUEBA AQUÍ, PERO NO SE CONSUME AQUÍ (ver el final de la función). Consumirlo en
  //    este punto quemaba la autorización de un solo uso aunque el comando acabara BLOQUEADO
  //    por otra regla: `npx prisma db push --force-reset` con el sentinel puesto salía
  //    bloqueado por `--force` y el sentinel ya estaba borrado. El fundador había dado un OK
  //    que no ejecutó nada y tenía que volver a darlo — o peor, creerse que lo había gastado.
  //    Es un fallo PREEXISTENTE (venía de la versión en bash, con el mismo orden) que la
  //    portación a .mjs conservó tal cual; lo encontró la sesión 1 comparando implementaciones.
  const pideDbPush = enAlguna(/prisma[^"]{0,40}db +push/);
  if (pideDbPush && !fs.existsSync(sentinelPath)) {
    return {
      bloqueado: true,
      motivo:
        "'db push' sin preview confirmado. Ejecuta el preview (migrate diff), ensena el diff al fundador y, con su OK, crea .claude/allow-db-push (un solo uso) antes de reintentar.",
    };
  }

  // 3) --force (git push --force, npm --force, prisma --force...)
  if (enAlguna(/(^|[^A-Za-z-])--force(-with-lease)?\b/)) {
    return {
      bloqueado: true,
      motivo:
        "'--force' esta prohibido por AA2. Si es imprescindible, pide OK explicito al fundador y que lo ejecute el.",
    };
  }

  // 4) rm -rf fuera del workspace (ruta absoluta, unidad o ~). Relativo dentro del repo se permite.
  if (enAlguna(/rm +-[a-zA-Z]*[rR][a-zA-Z]*[fF][a-zA-Z]* +("?(\/|~|[A-Za-z]:))/)) {
    return {
      bloqueado: true,
      motivo:
        "'rm -rf' con ruta absoluta fuera del workspace esta prohibido (AA2). Usa rutas relativas dentro del repo.",
    };
  }

  // Aquí ya no bloquea NADA. Solo ahora se gasta la autorización, y solo si se pidió un
  // `db push`: una autorización de un solo uso se consume cuando algo se va a ejecutar, no
  // cuando se mira. El orden es la regla entera — comprobar arriba, consumir abajo.
  //
  // Residuo conocido, escrito para que no sorprenda: que el hook deje pasar no garantiza que
  // el comando llegue a correr (el usuario aún puede denegarlo en el prompt de permisos). En
  // ese caso el sentinel sí se habrá gastado. Es el comportamiento de siempre y no se toca
  // aquí: desde el hook no hay forma de saber qué pasa después.
  if (pideDbPush) fs.rmSync(sentinelPath, { force: true });

  return { bloqueado: false, motivo: '' };
}

/**
 * Decide sobre el JSON crudo del tool call. `sentinelPath` es inyectable para que los tests
 * NUNCA toquen el sentinel de verdad (otra sesión puede estar a mitad de su flujo de db push).
 */
export function evaluar(crudo, sentinelPath = SENTINEL_POR_DEFECTO) {
  const comando = extraerComando(crudo);
  // FAIL-CLOSED: si el JSON no se deja leer, se vuelve al comportamiento antiguo —mirar el
  // blob entero, SIN máscara— en vez de dejar pasar. Ruidoso, pero nunca ciego: un blob de
  // JSON es casi todo comillas, así que aplicarle el criterio de SCRUM-454 lo dejaría ciego
  // justo en el caso en el que no sabemos qué se va a ejecutar.
  if (comando === null) return reglas([{ texto: crudo, mascara: [], palabras: [], redirecciones: [], programa: '' }], sentinelPath);
  return reglas(acciones(descontarTexto(comando)), sentinelPath);
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
