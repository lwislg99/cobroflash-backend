#!/usr/bin/env node
// scripts/censo-cr-en-disco.mjs — SCRUM-570
//
// ¿CUÁNTOS FICHEROS DEL CHECKOUT TIENEN CR EN DISCO Y NO EN EL BLOB?
//
// ── POR QUÉ HACE FALTA SABERLO ───────────────────────────────────────────────────────────────
// El 20-ago-2026 los CR costaron tiempo a las TRES sesiones, con SCRUM-480 y SCRUM-533 ya
// finalizadas: `cerebro-yaqu/SKILL.md` (71), `docs/SIF_SPEC_NOTES.md` (126), `CLAUDE.md` (146,
// tumbó una tanda) y `src/core/flags.ts` (90). Cada sesión sin saber de las otras.
//
// 🔴 Y el modo de fallo es que NO SE VE HASTA QUE MUERDE: el fichero está así desde hace
//    semanas, `git status` lo da por limpio, y el CR sólo aparece cuando alguien lo toca y el
//    guard de SCRUM-533 —que mira EL DISCO— tumba su tanda.
//
// ── 🔴 LO QUE ESTE CENSO CORRIGE DE LA TÉCNICA DE LA CASA ────────────────────────────────────
// Todos los encargos exigen «verifica con `Buffer.compare` contra el blob». Medido aquí: eso
// vale para los ficheros NO normalizados, y NO vale para los normalizados por `.gitattributes`
// —que son la mayoría de este repo—. En un fichero con `eol=lf`, git guarda el blob en LF pase
// lo que pase en disco, así que el blob NO describe cómo estaba el disco antes de tocarlo:
// restaurarlo «revierte» y además normaliza, que es un cambio que nadie pidió.
//
// Con `--tecnica` este script imprime la técnica correcta con sus dos casos.
//
// ── 🔴 POR QUÉ SIGUEN APARECIENDO, MEDIDO (20-ago-2026) — Y NO ES LO QUE PARECE ──────────────
//   · `.gitattributes` declara `eol=lf` para 1.579 ficheros. **1.336 de ellos tienen la copia de
//     trabajo en CRLF**, o sea que contradicen lo que el repo declara.
//   · `core.autocrlf` vale `true`, pero NO viene de este repo ni del usuario: es del sistema
//     (Git para Windows lo instala así). Y no es la causa: `eol=lf` gana en el checkout.
//   · **PROBADO**: un `git checkout-index` de HOY sobre esos mismos ficheros produce **CR=0**.
//
//   Conclusión: la regla FUNCIONA. Lo que pasa es que **git no reescribe retroactivamente la
//   copia de trabajo** cuando cambian los atributos. Los 1.336 son ficheros que llevan en disco
//   desde antes de que la regla les aplicara, y nadie los ha vuelto a sacar del índice.
//
//   Y de ahí sale lo que MÁS importa para decidir: **no hay nada que commitear.** El índice y los
//   blobs ya están en LF —por eso `git status` da el árbol por limpio con 1.355 ficheros con CR
//   en disco—. Esto no es una normalización pendiente: es una copia de trabajo vieja.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ENV = { ...process.env, MSYS_NO_PATHCONV: '1' };
const CR = 13;

/** Cuenta los 0x0D de un buffer. Con BYTES, nunca con `grep`: en Git Bash normaliza al leer. */
export function contarCR(buf) {
  let n = 0;
  for (const b of buf) if (b === CR) n += 1;
  return n;
}

/** Los ficheros seguidos por git, con el oid de su blob en el índice. */
export function ficherosSeguidos(raiz) {
  const salida = execFileSync('git', ['ls-files', '-s', '-z'], { cwd: raiz, encoding: 'utf8', maxBuffer: 6e7, env: ENV });
  const out = [];
  for (const linea of salida.split('\0')) {
    if (!linea) continue;
    const m = /^(\d+) ([0-9a-f]{40}) (\d)\t([\s\S]+)$/.exec(linea);
    if (m) out.push({ modo: m[1], oid: m[2], rel: m[4] });
  }
  return out;
}

/**
 * ¿Normaliza git este fichero? Se le pregunta A GIT (`check-attr`), no se interpreta el
 * `.gitattributes` a mano: el orden de sus reglas decide, y reimplementarlo aquí sería una
 * segunda fuente de verdad que se desincroniza.
 */
export function normalizacionDe(raiz, rutas) {
  if (!rutas.length) return new Map();
  const r = spawnSync('git', ['check-attr', '--stdin', '-z', 'text', 'eol'],
    { cwd: raiz, input: rutas.join('\0') + '\0', encoding: 'utf8', maxBuffer: 2e8, env: ENV });
  const campos = r.stdout.split('\0');
  const out = new Map();
  for (let i = 0; i + 2 < campos.length; i += 3) {
    const [ruta, attr, valor] = [campos[i], campos[i + 1], campos[i + 2]];
    if (!ruta) continue;
    if (!out.has(ruta)) out.set(ruta, {});
    out.get(ruta)[attr] = valor;
  }
  return out;
}

/**
 * El censo. Para cada fichero seguido: CR en DISCO y CR en BLOB, y si git lo normaliza.
 *
 * Las tres clases NO son lo mismo y mezclarlas escondería el problema:
 *   · SOLO_EN_DISCO → el que muerde. El blob está limpio y el disco no.
 *   · EN_LOS_DOS    → el blob lleva CRLF a propósito (`-text`), como la fuente de la AEAT.
 *   · LIMPIO        → ni disco ni blob.
 */
export function censar(raiz) {
  const seguidos = ficherosSeguidos(raiz);
  const attrs = normalizacionDe(raiz, seguidos.map((f) => f.rel));

  const soloEnDisco = [];
  const enLosDos = [];
  let limpios = 0;
  let ausentes = 0;
  let binarios = 0;

  for (const f of seguidos) {
    const abs = path.join(raiz, f.rel);
    if (!fs.existsSync(abs)) { ausentes += 1; continue; }
    const disco = fs.readFileSync(abs);
    // Un NUL en los primeros 8000 bytes es el criterio de git para «binario»: ahí un 0x0D no es
    // un fin de línea y contarlo sería ruido.
    if (disco.subarray(0, 8000).includes(0)) { binarios += 1; continue; }

    const crDisco = contarCR(disco);
    if (crDisco === 0) { limpios += 1; continue; }

    const blob = execFileSync('git', ['cat-file', 'blob', f.oid], { cwd: raiz, encoding: 'buffer', maxBuffer: 6e7, env: ENV });
    const crBlob = contarCR(blob);
    const a = attrs.get(f.rel) || {};
    const ficha = {
      rel: f.rel, crDisco, crBlob,
      // `text` puesto (o `auto` con contenido de texto) + `eol=lf` ⇒ git normaliza al guardar.
      normaliza: a.text === 'set' || a.eol === 'lf',
      eol: a.eol, text: a.text,
      // 🔴 LA PREGUNTA QUE DECIDE LA TÉCNICA: ¿sirve el blob como referencia de «cómo estaba»?
      blobSirveDeReferencia: contarCR(blob) === crDisco,
    };
    if (crBlob === 0) soloEnDisco.push(ficha); else enLosDos.push(ficha);
  }

  return { seguidos: seguidos.length, limpios, binarios, ausentes, soloEnDisco, enLosDos };
}

/**
 * LA TÉCNICA CORRECTA, con sus DOS casos. Vive aquí —no sólo en un documento— para que quien
 * ejecuta un encargo pueda LEERLA con un comando en vez de acordarse de ella.
 */
export const TECNICA = `
🔴 CÓMO SE REVIERTE UN CAMBIO SIN MENTIRSE (SCRUM-570)

  La casa exige «verifica con \`Buffer.compare\` contra el blob». Eso vale para UN caso y NO
  para el otro, y creerlo universal produce un verde falso.

  ── ANTES DE TOCAR, SIEMPRE ────────────────────────────────────────────────────────────────
      const ORIGINAL = fs.readFileSync(F);        // los BYTES de disco, antes de nada
  Esto sirve en los dos casos y no cuesta nada. Si no se guardó, ya no se puede revertir con
  certeza en un fichero normalizado.

  ── CASO A · fichero NO normalizado (\`-text\`, o sin regla) ────────────────────────────────
      Buffer.compare(fs.readFileSync(F), blobDe(F)) === 0
  El blob describe el disco byte a byte, así que sirve de referencia.

  ── CASO B · fichero NORMALIZADO por .gitattributes (\`text eol=lf\`) ───────────────────────
  🔴 EL BLOB NO SIRVE DE REFERENCIA. Git guarda LF pase lo que pase en disco, así que un
     fichero con 90 CR en la copia de trabajo tiene el blob limpio y \`git status\` lo da por
     LIMPIO. Comparar contra el blob diría «hay diferencia» cuando no has cambiado nada, y
     restaurar el blob «revierte» y ADEMÁS normaliza — un cambio que nadie pidió.
      Buffer.compare(fs.readFileSync(F), ORIGINAL) === 0     ← contra los bytes guardados
  Y si lo que se quiere es de verdad quitar el CR, se hace BYTE A BYTE con node y se dice.

  ── Y COMPROBAR EL BLOB NO BASTA ───────────────────────────────────────────────────────────
  El guard de SCRUM-533 mira EL DISCO. Se puede tener el blob con CR: 0 —dos veces— y la
  tanda caída igual. La comprobación no era falsa: era incompleta.

  ¿Cuál es cada fichero?   node scripts/censo-cr-en-disco.mjs --tecnica <fichero>
  ¿Y quitarle el CR?       node scripts/censo-cr-en-disco.mjs --limpiar <fichero>
`;

/**
 * Quita el CR de UN fichero, byte a byte, y sólo si es seguro.
 *
 * ⚠️ AQUÍ el blob SÍ es la referencia correcta, y conviene ver por qué no contradice lo de
 *    arriba: la diferencia no está en el fichero, está en LA INTENCIÓN.
 *      · revertir una edición  → la referencia son los BYTES DE DISCO de partida;
 *      · normalizar a lo que el repo declara → la referencia es EL BLOB, que ya está en LF.
 *
 * 🔴 FUNCIONA TAMBIÉN CON EL FICHERO YA EDITADO, y esto corrige lo que yo mismo había escrito
 *    aquí: se quitan los 0x0D DEL CONTENIDO ACTUAL, así que la edición se CONSERVA. Lo que se
 *    llevaría por delante una edición es restaurar el blob, que es justo lo que NO se hace.
 *    Y es el caso que de verdad ocurre: el CR se descubre cuando ya has tocado el fichero y el
 *    guard de SCRUM-533 te ha tumbado la tanda.
 *
 * La post-condición SIEMPRE disponible es la que no necesita el blob:
 *      Buffer.compare(despues, antesSinCR) === 0
 * y prueba lo único que se afirma: que se han quitado CR y NADA más. Contra el blob sólo se
 * comprueba cuando git ve el fichero limpio — porque entonces sí describe lo que debería haber.
 */
export function limpiar(raiz, rel) {
  const abs = path.join(raiz, rel);
  if (!fs.existsSync(abs)) return { ok: false, motivo: 'no existe ' + rel };

  const antes = fs.readFileSync(abs);
  const cr = contarCR(antes);
  if (cr === 0) return { ok: true, cr: 0, motivo: 'ya estaba limpio: no se ha tocado' };

  // ⚠️ Puede no haber repositorio, o el fichero puede no estar seguido. En los dos casos NO hay
  //    blob con el que contrastar, y eso se DICE — no se finge una comprobación que no se hizo.
  const est = spawnSync('git', ['status', '--porcelain', '--', rel], { cwd: raiz, encoding: 'utf8', env: ENV });
  const hayGit = est.status === 0;
  const seguido = hayGit
    && spawnSync('git', ['ls-files', '--error-unmatch', '--', rel], { cwd: raiz, encoding: 'utf8', env: ENV }).status === 0;
  const editado = hayGit ? est.stdout.trim() : '';

  // Byte a byte: se copian todos MENOS los 0x0D. Nada de `.replace` sobre cadena, que pasaría
  // por una decodificación y reescribiría el fichero entero.
  const salida = Buffer.alloc(antes.length - cr);
  let j = 0;
  for (const b of antes) if (b !== CR) salida[j++] = b;
  fs.writeFileSync(abs, salida);

  const despues = fs.readFileSync(abs);
  const esperado = Buffer.from([...antes].filter((b) => b !== CR));
  if (Buffer.compare(despues, esperado) !== 0) {
    fs.writeFileSync(abs, antes);   // no se deja a medias
    return { ok: false, cr, motivo: 'lo escrito NO es «lo mismo sin CR». Se ha dejado como estaba.' };
  }

  const base = cr + ' CR quitados · Buffer.compare contra «lo mismo sin CR» = 0 · la edición se conserva.';
  if (!seguido) {
    return { ok: true, cr, sinBlob: true,
      motivo: base + ' ⚠️ SIN comprobación contra el blob: '
        + (hayGit ? 'git no sigue este fichero' : 'aquí no hay repositorio') + '.' };
  }
  if (editado) {
    return { ok: true, cr, editado: true,
      motivo: base + ' ⚠️ NO se ha podido comprobar contra el blob: git ve cambios en el fichero '
        + '(«' + editado.slice(0, 40) + '»), así que el blob no describe lo que debería haber.' };
  }
  const oid = spawnSync('git', ['rev-parse', ':' + rel], { cwd: raiz, encoding: 'utf8', env: ENV }).stdout.trim();
  const blob = execFileSync('git', ['cat-file', 'blob', oid], { cwd: raiz, encoding: 'buffer', maxBuffer: 6e7, env: ENV });
  if (Buffer.compare(despues, blob) !== 0) {
    fs.writeFileSync(abs, antes);
    return { ok: false, cr,
      motivo: 'git veía el fichero limpio y quitando el CR NO sale el blob byte a byte: difiere '
        + 'del índice en algo más que fines de línea. Se ha dejado como estaba.' };
  }
  return { ok: true, cr, motivo: cr + ' CR quitados · Buffer.compare contra el blob = 0' };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const raiz = process.cwd();

  if (process.argv.includes('--tecnica')) {
    console.log(TECNICA);
    const f = process.argv[process.argv.indexOf('--tecnica') + 1];
    if (f && !f.startsWith('--')) {
      const a = normalizacionDe(raiz, [f]).get(f) || {};
      const normaliza = a.text === 'set' || a.eol === 'lf';
      console.log('  ' + f + '  →  text=' + (a.text ?? '?') + '  eol=' + (a.eol ?? '?'));
      console.log('  ' + (normaliza
        ? '🔴 NORMALIZADO: CASO B. El blob NO sirve de referencia — guarda los bytes de disco.'
        : '✅ no normalizado: CASO A. El blob sirve de referencia.'));
    }
    process.exit(0);
  }

  if (process.argv.includes('--limpiar')) {
    const f = process.argv[process.argv.indexOf('--limpiar') + 1];
    if (!f) { console.error('🔴 --limpiar necesita un fichero'); process.exit(2); }
    const r = limpiar(raiz, f);
    console.log((r.ok ? '✅ ' : '🔴 ') + f + ': ' + r.motivo);
    process.exit(r.ok ? 0 : 1);
  }

  const r = censar(raiz);
  console.log('ficheros seguidos ......... ' + r.seguidos);
  console.log('   binarios (saltados) .... ' + r.binarios + '   ·   sin fichero en disco: ' + r.ausentes);
  console.log('   sin ningún CR .......... ' + r.limpios);
  console.log('🔴 CR EN DISCO Y NO EN EL BLOB  ' + r.soloEnDisco.length);
  console.log('   CR en los dos (a propósito) . ' + r.enLosDos.length);

  // 🔴 SUELO: un cero aquí se leería como «el checkout está limpio», y hay cuatro medidos hoy
  //    con nombre y número. Si sale cero, es que el censo no supo mirar.
  if (r.soloEnDisco.length === 0) {
    console.error('\n🔴 CIEGO: cero ficheros con CR sólo en disco.');
    console.error('   El 20-ago-2026 se midieron CUATRO con nombre y número (71, 126, 146, 90 CR).');
    console.error('   O el recorrido no está mirando donde cree, o se está leyendo con algo que');
    console.error('   normaliza. Un cero aquí NO es «el checkout está limpio».');
    process.exit(2);
  }

  const conNorma = r.soloEnDisco.filter((f) => f.normaliza);
  console.log('\n   de esos, NORMALIZADOS por .gitattributes: ' + conNorma.length
    + '   ← en éstos `Buffer.compare` contra el blob NO sirve de referencia');
  console.log('\n' + '─'.repeat(78));
  for (const f of r.soloEnDisco.sort((a, b) => b.crDisco - a.crDisco)) {
    console.log('  ' + String(f.crDisco).padStart(5) + ' CR   ' + (f.normaliza ? '[normalizado]' : '[   —       ]') + '  ' + f.rel);
  }
  if (r.enLosDos.length) {
    console.log('\n  CR también en el blob (declarado a propósito):');
    for (const f of r.enLosDos) console.log('  ' + String(f.crDisco).padStart(5) + ' CR   ' + f.rel + '   (text=' + f.text + ')');
  }
  console.log('\n' + TECNICA);
}
