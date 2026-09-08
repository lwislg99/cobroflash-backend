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
import { spawnSync } from 'node:child_process';
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

// ── SCRUM-744 · EL ENVOLTORIO QUE FALTABA, Y POR QUÉ NO ES `node` A SECAS ───────────────────
//
// `node -e "…"` ejecuta su argumento igual que `bash -c "…"`, y no estaba en la lista. Medido
// con el hook real el 4-sep-2026: la invocación que ESTA CASA USA —el CLI de Prisma resuelto por
// `require.resolve('prisma/build/index.js')` y lanzado con `spawnSync`— **pasaba sin saltar**,
// también con `db push` y con `--force-reset` dentro.
//
// 🔴 Y NO SE PUEDE METER `node` EN `ENVOLTORIOS` A SECAS: entonces el argumento entrecomillado de
// CUALQUIER `node script.mjs "…"` se volvería a analizar como línea de comando, y eso reabre
// exactamente el falso positivo que SCRUM-454 midió y cerró —`node medir.mjs "git push --force
// origin main"`—. La diferencia no es el programa: es LA BANDERA. `-e` lleva código; un argumento
// posicional lleva datos.
//
// Por eso esto es un mapa programa → banderas cuyo argumento ES CÓDIGO, y se recursa sólo por ahí.
const BANDERAS_DE_CODIGO = new Map([
  ['node', new Set(['-e', '--eval', '-p', '--print'])],
]);

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
  // 1-bis) SCRUM-744 · Banderas que llevan CÓDIGO (`node -e "…"`).
  //
  // 🔴 EL PAYLOAD VA CON LA MÁSCARA A CERO, y ésa es la decisión del ticket. Dentro de `-e` NO
  // HAY «mención»: todo lo que hay ahí se ejecuta, comillas incluidas — `['db','push']` son
  // comillas de JavaScript, no de un shell, y tratarlas como si escondieran texto inerte es
  // justo lo que dejaba pasar la invocación real. Se recursa ADEMÁS como línea de comando, por
  // si dentro hay un `bash -c` anidado.
  //
  // El precio, medido y declarado: `node -e "console.log('prisma db push')"` queda BLOQUEADO
  // aunque sólo imprima. Es la dirección segura —el guard yerra cerrado— y el rodeo es escribirlo
  // en un fichero, que además es lo que uno hace con cualquier cosa que no sea de usar y tirar.
  for (const a of [...salida]) {
    const banderas = BANDERAS_DE_CODIGO.get(a.programa);
    if (!banderas) continue;
    for (let i = 0; i < a.palabras.length; i++) {
      const t = a.palabras[i].texto;
      const conIgual = t.match(/^(--?[A-Za-z-]+)=([\s\S]*)$/);
      const payload = conIgual && banderas.has(conIgual[1]) ? conIgual[2]
        : (banderas.has(t) && a.palabras[i + 1] ? a.palabras[i + 1].texto : null);
      if (payload == null || payload === '') continue;
      salida.push({
        texto: payload,
        mascara: new Array(payload.length).fill(false), // todo ejecutable: nada es mención
        palabras: [],
        redirecciones: [],
        programa: '',
      });
      salida.push(...acciones(payload, profundidad + 1));
    }
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

// ── SCRUM-454 (b) · LA FAMILIA QUE LA BARRERA NO MIRABA ─────────────────────────────────────
//
// Medido con el hook real el 11-ago-2026: `git checkout --`, `git restore`, `git clean`,
// `git reset --hard` y `>` sobre una ruta existente PASABAN los cinco. Es decir, los cuatro
// trabajos perdidos ese día se perdieron por mecanismos que la barrera no miraba. No faltaba
// una barrera: faltaba ESTA FAMILIA dentro de la que ya existía.
//
// EL DIAGNÓSTICO QUE MANDA, de la sesión que perdió el cuarto: «la comprobación estaba en el
// propio comando y me llegó DESPUÉS de haber escrito — el orden era el error». Eso descarta la
// solución que parece obvia (encadenar `git status &&` delante): el fallo no es que falte la
// comprobación, es que llega tarde. Por eso vive aquí, en un PreToolUse, que es el único sitio
// donde llega antes por construcción y no por disciplina.
//
// EL CRITERIO: **no se bloquea el comando, se bloquea la pérdida.** Cada regla comprueba el
// estado ANTES y solo bloquea si hay algo que perder. Un `>` sobre un fichero nuevo, un
// `git checkout --` con el árbol limpio o un `git restore --staged` no caen — y eso no es un
// detalle: una barrera que bloquea lo legítimo la desactiva entera alguien con prisa, y entonces
// protege menos que ninguna.
//
// JURISDICCIÓN, declarada: lo que git considera suyo y no ignora. Un fichero fuera del repo, o
// uno que el `.gitignore` cubre (`dist/`, salidas de scripts), NO se protege — desde aquí no hay
// forma de distinguir un borrador de un artefacto, y equivocarse por exceso ahí es lo que
// convierte la barrera en ruido.

export const SENTINEL_DESTRUCTIVO_POR_DEFECTO = path.join(AQUI, '..', 'allow-destructivo');

// ── SCRUM-176b · `--force` SE COMPARA POR IDENTIDAD DE BANDERA, NO POR SUBCADENA ─────────────
//
// El patrón viejo era `/(^|[^A-Za-z-])--force(-with-lease)?\b/`. El ancla de la izquierda estaba
// bien; la de la derecha no: `\b` entre la `e` y el guion de `-device` EXISTE, así que
// `--force-device-scale-factor` —calibrado de Chrome, que no borra nada— salía bloqueado igual
// que `git push --force`. Y este guard es el que sostiene AA2: uno que estorba es uno que alguien
// acaba apagando, y ese día se apaga también lo que sí protegía. Es el mismo criterio que ya está
// escrito veinte líneas más abajo para la familia de SCRUM-454.
//
// SE NIEGA POR DEFECTO. Cualquier `--force-loquesea` sigue bloqueada mientras no esté AQUÍ, con
// su motivo. Eximir por lista visible es la única manera de aflojar un guard de seguridad sin
// abrir un agujero que nadie vea: cada línea de esta lista es un agujero, y se ve.
export const FORCE_EXENTAS = new Set([
  '--force-device-scale-factor',    // escala del navegador headless: hace falta para MEDIR (SCRUM-720d)
  '--force-color-profile',          // fija el perfil de color, para que la captura no dependa del monitor
  '--force-prefers-reduced-motion', // mide la pantalla con las animaciones apagadas (AB6)
]);

/**
 * La bandera peligrosa de la familia `--force` que se va a EJECUTAR, o `null`.
 *
 * Compara PALABRAS y no mira comillas, y esto se midió antes de escribirlo:
 *
 *   git push "--force" origin main    →  palabras: [git, push, --force, origin, main]   ← se EJECUTA
 *   git commit -m "…push --force"     →  palabras: [git, commit, -m, MENSAJE]           ← ya no está
 *
 * Es decir: la mención la borra `descontarTexto` ANTES, sustituyendo la carga de texto entera. Las
 * comillas no son la frontera entre mencionar y ejecutar —el shell entrega `"--force"` igual—, y
 * filtrarlas habría abierto justo esa vía de escape. Lo intenté y lo tumbó un test de SCRUM-454
 * que tenía razón.
 */
export function forcePeligrosa(lista) {
  for (const accion of lista) {
    for (const p of accion.palabras) {
      // `--force-device-scale-factor=1` es la MISMA bandera que sin valor: se compara el nombre.
      const bandera = p.texto.split('=')[0];
      if (!bandera.startsWith('--force')) continue;
      if (!FORCE_EXENTAS.has(bandera)) return bandera;
    }
  }
  return null;
}

/**
 * `-f` es `--force` con otro nombre, y el control negativo de SCRUM-176b lo encontró ESCAPANDO:
 * `git push -f origin main` pasaba el guard entero. Agujero preexistente, no abierto aquí.
 *
 * Se mira ACOTADO a `git push`. En `rm -f`, `grep -f` o `npm i -f` esa misma letra significa otras
 * cosas, y bloquearla en general sería fabricar el falso positivo que este ticket viene a quitar.
 */
export function gitPushForzadoCorto(lista) {
  for (const accion of lista) {
    if (accion.programa !== 'git') continue;
    const palabras = accion.palabras.map((p) => p.texto);
    if (!palabras.includes('push')) continue;
    // Identidad, no prefijo: `-f` exacto, o agrupada con otras cortas (`-fu`), nunca `-follow`.
    const corta = palabras.find((t) => /^-[A-Za-z]+$/.test(t) && t.slice(1).includes('f'));
    if (corta) return corta;
  }
  return null;
}

const RUTAS_INERTES = /^(\/dev\/|nul$|con$|\/proc\/)/i;

function correrGit(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.error || typeof r.status !== 'number') return null; // no se pudo preguntar
  return { code: r.status, salida: (r.stdout || '').trim() };
}

const esEnlace = (p) => {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

/**
 * Desde dónde se ejecuta. Un `cd X && …` al principio es la forma normal de trabajar en este
 * repo con cuatro worktrees, y sin esto el guard miraría el árbol equivocado — que es peor que
 * no mirar: diría «limpio» de otro sitio.
 */
export function cwdDelComando(comando, base) {
  for (const a of acciones(comando)) {
    if (a.programa === 'cd' && a.palabras.length >= 2) {
      const destino = a.palabras[1].texto;
      return path.isAbsolute(destino) ? destino : path.resolve(base, destino);
    }
  }
  return base;
}

/** ¿La redirección trunca algo que git considera trabajo? Devuelve la ruta, o null. */
function ficheroQueSePierde(destino, cwd) {
  if (RUTAS_INERTES.test(destino)) return null;
  const abs = path.isAbsolute(destino) ? destino : path.resolve(cwd, destino);
  let st;
  try {
    st = fs.lstatSync(abs);
  } catch {
    return null; // NO EXISTE: es el control negativo, y no puede caer nunca.
  }
  if (!st.isFile()) return null;
  const ig = correrGit(['check-ignore', '-q', '--', abs], cwd);
  if (ig === null || ig.code === 0 || ig.code > 1) return null; // ignorado, o fuera de jurisdicción
  return abs;
}

const flags = (a) => a.palabras.map((p) => p.texto).filter((t) => t.startsWith('-'));
const sinFlags = (a, desde) => a.palabras.slice(desde).map((p) => p.texto).filter((t) => !t.startsWith('-'));

/**
 * Las tres formas de descartar con git, y lo que hay que preguntar ANTES en cada una.
 * Devuelve `null` si el comando no es de esta familia.
 */
function descarteGit(a) {
  if (a.programa !== 'git' || a.palabras.length < 2) return null;
  const sub = a.palabras[1].texto;
  const todas = a.palabras.map((p) => p.texto);

  if (sub === 'checkout') {
    // Cambiar de rama no descarta nada. La forma que descarta es la de rutas: `--` o `.`.
    const corte = todas.indexOf('--');
    if (corte === -1) return todas.includes('.') ? { que: 'git checkout .', rutas: ['.'] } : null;
    return { que: 'git checkout --', rutas: todas.slice(corte + 1) };
  }
  if (sub === 'restore') {
    // `--staged` a secas solo saca del índice: no toca el árbol, no pierde nada.
    const f = flags(a);
    if (f.includes('--staged') && !f.includes('--worktree') && !f.includes('-W')) return null;
    return { que: 'git restore', rutas: sinFlags(a, 2) };
  }
  if (sub === 'reset' && flags(a).some((f) => f === '--hard')) {
    return { que: 'git reset --hard', rutas: [] };
  }
  return null;
}

/**
 * Las reglas 5-7. Devuelve `{motivo}` si hay algo que perder, o `null`.
 * ⚠️ Si algo revienta aquí dentro, el llamante deja pasar: esta familia es cobertura NUEVA, y
 * un fallo mío parando a las cuatro sesiones es peor que volver al estado de ayer.
 */
function perdidaInminente(lista, cwd) {
  for (const a of lista) {
    // 5) Redirección que trunca un fichero existente. El caso del 11-ago: `> SCRUM-447.md`.
    for (const destino of a.redirecciones) {
      const victima = ficheroQueSePierde(destino, cwd);
      if (victima) {
        return {
          motivo:
            `'> ${destino}' TRUNCA un fichero que ya existe y que git no ignora (${victima}).\n`
            + '  El 11-ago-2026 asi se sobrescribio docs/master/SCRUM-447.md entero.\n'
            + "  Si quieres anadir, usa '>>'. Si de verdad quieres reemplazarlo, mira antes que hay dentro\n"
            + '  y crea .claude/allow-destructivo (un solo uso) para el siguiente intento.',
        };
      }
    }

    // 6) Descartar cambios del arbol de trabajo. Solo bloquea si HAY cambios que descartar.
    const descarte = descarteGit(a);
    if (descarte) {
      const args = ['status', '--porcelain', '--untracked-files=no'];
      if (descarte.rutas.length) args.push('--', ...descarte.rutas);
      const estado = correrGit(args, cwd);
      if (estado === null || estado.code !== 0) {
        return {
          motivo:
            `'${descarte.que}' y NO se pudo comprobar el estado del arbol desde ${cwd}.\n`
            + '  "No hay nada que perder" y "no supe mirar" son la misma respuesta con significados\n'
            + '  opuestos, asi que este se trata como el peor.',
        };
      }
      if (estado.salida) {
        return {
          motivo:
            `'${descarte.que}' DESCARTA cambios sin commitear. Esto es lo que se perderia:\n`
            + estado.salida.split('\n').slice(0, 20).map((l) => `      ${l}`).join('\n')
            + '\n  Commitealo, guardalo con `git stash`, o —si de verdad sobra— crea\n'
            + '  .claude/allow-destructivo (un solo uso) y repite. La comprobacion llega ANTES a\n'
            + '  proposito: encadenarla en el mismo comando es justo el orden que fallo.',
        };
      }
    }

    // 6b) `git clean`: lo que se pierde son los NO rastreados, asi que se pregunta en seco.
    if (a.programa === 'git' && a.palabras.length >= 2 && a.palabras[1].texto === 'clean') {
      const seco = ['clean', '-n', '-d'];
      if (flags(a).some((f) => /^-[a-zA-Z]*x/.test(f))) seco.push('-x');
      const previo = correrGit(seco, cwd);
      if (previo === null || previo.code !== 0) {
        return { motivo: `'git clean' y NO se pudo comprobar que borraria desde ${cwd}. Se trata como el peor caso.` };
      }
      if (previo.salida) {
        return {
          motivo:
            'git clean BORRA ficheros no rastreados. Esto es lo que se llevaria:\n'
            + previo.salida.split('\n').slice(0, 20).map((l) => `      ${l}`).join('\n')
            + '\n  Si sobran, crea .claude/allow-destructivo (un solo uso) y repite.',
        };
      }
    }

    // 7) Cadenas de junction (SCRUM-429). `git worktree remove` siguio una y vacio el
    //    node_modules COMPARTIDO, dos veces. La comprobacion previa es igual de barata: mirar
    //    si eso es un enlace o una carpeta de verdad.
    const texto = a.texto;
    const esBorradoDeArbol =
      (a.programa === 'git' && /\bworktree\b[\s\S]*\bremove\b/.test(texto))
      || (a.programa === 'rm' && flags(a).some((f) => /^-[a-zA-Z]*r/i.test(f)))
      || (/\brmdir\b/.test(texto) && /\s\/s\b/i.test(texto));
    if (esBorradoDeArbol) {
      for (const ruta of a.palabras.slice(1).map((p) => p.texto).filter((t) => !t.startsWith('-') && !t.startsWith('/'))) {
        const abs = path.isAbsolute(ruta) ? ruta : path.resolve(cwd, ruta);
        const victima = esEnlace(abs) ? abs : esEnlace(path.join(abs, 'node_modules')) ? path.join(abs, 'node_modules') : null;
        if (victima) {
          return {
            motivo:
              `'${ruta}' contiene un ENLACE (junction): ${victima}.\n`
              + '  Un borrado recursivo lo SIGUE y se lleva el destino, que es compartido. Asi se vacio\n'
              + '  el node_modules comun dos veces (SCRUM-429).\n'
              + `  Quita antes el enlace SIN seguirlo:  cmd /c rmdir "${victima.replace(/\//g, '\\')}"  (sin /s).`,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Las CUATRO reglas de AA2. Los patrones son los mismos que tenía la versión en bash: lo que
 * cambia es el texto sobre el que se aplican, no lo que se considera peligroso.
 */
function reglas(lista, sentinelPath, entorno = {}) {
  const enAlguna = (re) => lista.some((a) => coincide(re, a));

  // ── SCRUM-744 · LA ACCIÓN, NO LA FORMA DE ESCRIBIRLA ──────────────────────────────────────
  //
  // El patrón viejo era `prisma[^"]{0,40}migrate +dev`: exigía los dos verbos SEPARADOS POR
  // ESPACIOS y a menos de 40 caracteres del nombre, y que por medio no hubiera una comilla. Eso
  // no describe la acción: describe UNA MANERA DE TECLEARLA. La casa invoca de otra —
  // `spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push'])`— y
  // ahí los verbos van en un array, con comillas y comas por medio.
  //
  // `subcomando()` tolera lo que separa a los dos verbos (`'db','push'`, `db  push`, `db","push`)
  // y ensancha la distancia hasta el nombre del CLI, porque `require.resolve('prisma/build/…')`
  // ya se come esos 40. Lo que NO se toca es el árbitro de SCRUM-454: sigue haciendo falta que la
  // coincidencia toque al menos un carácter que no venga de dentro de unas comillas, así que
  // `git commit -m "no ejecutes prisma db push"` sigue pasando.
  const subcomando = (a, b) =>
    new RegExp(`\\bprisma\\b[\\s\\S]{0,200}?\\b${a}\\b[^A-Za-z0-9]{0,4}\\b${b}\\b`, 'i');

  // 1) prisma migrate dev — PROHIBIDO siempre (regla 3: Prisma sin TTY)
  if (enAlguna(subcomando('migrate', 'dev'))) {
    return {
      bloqueado: true,
      motivo:
        "'prisma migrate dev' esta prohibido (regla 3). Usa 'prisma migrate diff' (preview) y luego 'db push' autorizado.",
    };
  }

  // 1-bis) SCRUM-744 · LOS DOS QUE NO ESTABAN EN LA LISTA, y el censo era el hallazgo.
  //
  // 🔴 Medido el 4-sep-2026 con el hook real: la lista de subcomandos destructivos de Prisma
  // tenía DOS entradas —`migrate dev` y `db push`— y `npx prisma migrate reset`, que BORRA Y
  // RECREA LA BASE ENTERA, **pasaba**. `migrate reset --force` sí caía, pero por la regla de
  // `--force` (regla 3 de AA2): o sea, por accidente y no porque nadie lo hubiera considerado.
  // Un guard que para el caso peligroso sólo cuando además lleva otra bandera es un guard que no
  // sabe lo que protege.
  //
  // `db execute` ejecuta el SQL que le des CONTRA LA BASE, sin clasificarlo. La casa tiene un
  // camino para eso —`scripts/aplicar-sql-dev.mjs`, que pasa el fichero por
  // `_clasificador-sql.mjs` y RECHAZA POR DEFECTO lo que no reconoce como aditivo— y ese camino
  // sigue funcionando: el hook ve `node scripts/aplicar-sql-dev.mjs …`, no `db execute`. Lo que
  // se bloquea es teclearlo a mano, que es exactamente saltarse el clasificador.
  // ⚠️ CADA ENTRADA SE AÑADE CON SU USO MEDIDO, no con una intuición. Barrido del 4-sep-2026 sobre
  // `package.json`, `scripts/`, `src/` y `.github/`: **ninguno de los cinco lo usa nadie** —y
  // `migrate deploy` aparecía en `preflight-schema-drift.mjs` sólo dentro de un comentario que dice
  // «cero `db push`, cero `migrate deploy`», o sea mención y no uso—. Bloquearlos no le quita el
  // camino a nadie. Los que SÍ tienen camino se quedan fuera a propósito: ver la lista de abajo.
  const DESTRUCTIVOS = [
    ['migrate', 'reset',
      "'prisma migrate reset' BORRA Y RECREA la base entera. No hay flujo en esta casa que lo use: " +
      'los cambios de esquema van por `migrate diff` (preview) + `db push` autorizado.'],
    ['db', 'execute',
      "'prisma db execute' ejecuta el SQL TAL CUAL contra la base, sin clasificarlo. Usa " +
      '`node scripts/aplicar-sql-dev.mjs --file <x.sql>` (ensena y no toca nada) y `--go` para aplicar: ' +
      'ese camino rechaza por defecto lo que no reconoce como aditivo.'],
    ['migrate', 'deploy',
      "'prisma migrate deploy' aplica migraciones a la base, y esta casa NO tiene flujo de " +
      'migraciones: no existe `prisma/migrations` y `migrate dev` esta prohibido (regla 3). ' +
      'Los cambios de esquema van por `db push` autorizado.'],
    ['migrate', 'resolve',
      "'prisma migrate resolve' escribe en la tabla de migraciones de la base para dar por " +
      'aplicada una migracion. Esta casa no usa migraciones (regla 3), asi que esto solo puede ' +
      'dejar la base diciendo algo que no es.'],
    // 🔴 `db seed` ENTRA POR DECISIÓN DEL ASESOR (4-sep-2026), y el motivo se escribe aquí porque
    // es el que hace revisable la decisión: **sembrar contra el destino equivocado ESCRIBE DATOS**,
    // y la confusión de destino es la familia de casi-accidentes de esta casa. Medido:
    // `prisma/seed.ts` hace `upsert` sobre el merchant 1 —nombre, NIF, dirección, plan— con un
    // `new PrismaClient()` a secas, sin comprobar a dónde apunta.
    //
    // El sentinel NO bloquea: confirma. Y confirmar antes de escribir en una base cuesta un
    // segundo. `npm run db:seed` sigue pasando —el hook ve el nombre del script, no el
    // subcomando—: ése es el hueco que mide SCRUM-746, y NO lo cierra esta línea.
    ['db', 'seed',
      "'prisma db seed' ESCRIBE DATOS en la base a la que apunte `DATABASE_URL`, y `prisma/seed.ts` " +
      'no comprueba a donde apunta. Si de verdad quieres sembrar, di contra que base: ' +
      '`DATABASE_URL_DEV=... node scripts/seed-demo.mjs` (ese si comprueba el destino).'],
    ['db', 'pull',
      "'prisma db pull' REESCRIBE `prisma/schema.prisma` con lo que haya en la base, y ese fichero " +
      'es del FUNDADOR. El esquema manda sobre la base, no al reves: si hay diferencia, el preview ' +
      'la ensena (`node scripts/preview-migracion.mjs`).'],
  ];
  for (const [a, b, motivo] of DESTRUCTIVOS) {
    if (enAlguna(subcomando(a, b))) return { bloqueado: true, motivo };
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
  const pideDbPush = enAlguna(subcomando('db', 'push'));
  if (pideDbPush && !fs.existsSync(sentinelPath)) {
    return {
      bloqueado: true,
      motivo:
        "'db push' sin preview confirmado. Ejecuta el preview (migrate diff), ensena el diff al fundador y, con su OK, crea .claude/allow-db-push (un solo uso) antes de reintentar.",
    };
  }

  // 3) --force (git push --force, npm --force, prisma --force...) — POR IDENTIDAD DE BANDERA
  //    desde SCRUM-176b. Ver FORCE_EXENTAS arriba: se niega por defecto y se exime a mano.
  const forzada = forcePeligrosa(lista) || gitPushForzadoCorto(lista);
  if (forzada) {
    return {
      bloqueado: true,
      motivo:
        `'${forzada}' esta prohibido por AA2 ('--force'). Si es imprescindible, pide OK explicito ` +
        'al fundador y que lo ejecute el.',
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
  // 5-7) SCRUM-454. Va después de las cuatro de AA2 a propósito: si un comando cae por `--force`
  // no hace falta preguntarle a git nada, y el mensaje que llega sigue siendo el de siempre.
  let perdida = null;
  try {
    perdida = perdidaInminente(lista, entorno.cwd || process.cwd());
  } catch {
    perdida = null; // cobertura NUEVA: un fallo mío no puede parar a las cuatro sesiones.
  }
  const sentinelDestructivo = entorno.sentinelDestructivo || SENTINEL_DESTRUCTIVO_POR_DEFECTO;
  const autorizado = perdida !== null && fs.existsSync(sentinelDestructivo);
  if (perdida && !autorizado) return { bloqueado: true, motivo: perdida.motivo };

  // Solo aquí se gastan las autorizaciones, y por la misma razón que en la regla 2: un permiso
  // de un solo uso se consume cuando algo se va a ejecutar, no cuando se mira.
  if (pideDbPush) fs.rmSync(sentinelPath, { force: true });
  if (autorizado) fs.rmSync(sentinelDestructivo, { force: true });

  return { bloqueado: false, motivo: '' };
}

/**
 * Decide sobre el JSON crudo del tool call. `sentinelPath` es inyectable para que los tests
 * NUNCA toquen el sentinel de verdad (otra sesión puede estar a mitad de su flujo de db push).
 */
export function evaluar(crudo, sentinelPath = SENTINEL_POR_DEFECTO, opciones = {}) {
  const comando = extraerComando(crudo);
  const entorno = {
    cwd: opciones.cwd ? opciones.cwd : cwdDelComando(comando || '', opciones.base || process.cwd()),
    sentinelDestructivo: opciones.sentinelDestructivo,
  };
  // FAIL-CLOSED: si el JSON no se deja leer, se vuelve al comportamiento antiguo —mirar el
  // blob entero, SIN máscara— en vez de dejar pasar. Ruidoso, pero nunca ciego: un blob de
  // JSON es casi todo comillas, así que aplicarle el criterio de SCRUM-454 lo dejaría ciego
  // justo en el caso en el que no sabemos qué se va a ejecutar.
  if (comando === null) {
    return reglas([{ texto: crudo, mascara: [], palabras: [], redirecciones: [], programa: '' }], sentinelPath, entorno);
  }
  return reglas(acciones(descontarTexto(comando)), sentinelPath, entorno);
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
//
// SCRUM-454 — lo que la familia destructiva NO cubre, y por qué se decidió así:
//   · FUERA DEL REPO. Un `>` sobre un fichero de fuera del árbol de git no se toca: desde aquí
//     no hay forma de distinguir un borrador del fundador de una salida temporal, y bloquear
//     por si acaso en todo el disco es lo que convierte una barrera en ruido. Lo mismo con lo
//     que el `.gitignore` cubre.
//   · EL QUINTO MECANISMO, declarado fuera de alcance a propósito: si el trabajo MERECÍA
//     conservarse. Los cuatro de arriba son mecanismo y se comprueban; ése es criterio, y no
//     lo sabe una máquina. Se protege lo que se puede medir, no lo que haría falta adivinar.
//   · Un editor, un script de Node (`fs.writeFileSync`) o cualquier herramienta que no sea
//     Bash/PowerShell sobrescribe sin pasar por aquí. El hueco es el mismo de siempre y no lo
//     cierra este ticket: lo que se cierra es la vía por la que se perdieron los cuatro.
//
// SCRUM-744 — lo que se CIERRA, y lo que queda abierto después:
//
//   CERRADO: la invocación del CLI de Prisma por su ruta dentro de un `node -e`, que es como
//   esta casa lo lanza en cuatro sitios (`_prisma-sync`, `aplicar-sql-dev`,
//   `preflight-schema-drift` y `preview-migracion`; el runbook es docs/RUNBOOKS.md §R20).
//   Y la lista de subcomandos, que tenía
//   DOS entradas: ahora son siete, censadas contra el `--help` del CLI instalado en
//   `tests/scrum744-el-guard-mira-la-accion.test.mjs`.
//
//   NO cubierto, a sabiendas:
//   · UN SCRIPT DEL REPO que por dentro lance algo destructivo. El hook ve `node scripts/x.mjs`
//     y no lo que ese fichero hace. Es el mismo hueco que ya estaba declarado arriba para
//     `fs.writeFileSync`, y aquí es DELIBERADO: los scripts del árbol pasan por PR, y cerrarlo
//     obligaría a leer ficheros desde el hook. `scripts/aplicar-sql-dev.mjs` vive justo en ese
//     hueco a propósito — es el camino BUENO para el SQL, con su clasificador delante.
//   · `bash scripts/db-push-prod` y `npm run db:seed`: rutas declaradas en `package.json` que
//     llegan al hook como el nombre del script, no como el subcomando. Miden lo mismo que el
//     punto anterior y se dejan igual.
//   · `prisma db seed`, `prisma studio` y `prisma format` NO se bloquean: los dos primeros
//     tienen camino declarado y el tercero sólo reformatea. Los tres están en el censo del test
//     con su motivo, para que la decisión se pueda revisar en vez de deducirse de su ausencia.
//   · OTRAS BANDERAS QUE LLEVAN CÓDIGO. `BANDERAS_DE_CODIGO` sólo cubre `node`. `python -c`,
//     `perl -e`, `ruby -e` o `deno eval` tendrían el mismo agujero; no se añaden porque no
//     aparecen en este repo y cada uno necesita su propio control de falso positivo.
//   · Si algo revienta dentro de la familia nueva, se DEJA PASAR (try/catch en `reglas`). Es
//     cobertura nueva: un fallo mío parando a las cuatro sesiones sería peor que el estado de
//     ayer. Las cuatro reglas de AA2 no llevan esa red — ésas nunca dejan de mirar.
// ─────────────────────────────────────────────────────────────────────────────────────────
