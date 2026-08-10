// scripts/_prisma-procedencia-guard.mjs — SCRUM-252
//
// ¿ESTE CLIENTE SALIÓ DE **ESTE** `schema.prisma`?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO Y NO «AMPLIAR EL GUARD DE SCRUM-235 A LOS TIPOS»
//
// `_prisma-client-guard.mjs` compara el conjunto de nombres de COLUMNA en los dos sentidos, y
// **lo declara**: no mira tipo, opcionalidad, `@default` ni `@db.<nativo>`. El hueco es real y
// está medido: con un `id Int` → `String` inyectado —ningún nombre cambia— aquel guard sale
// **VERDE**. Es el caso de `55fd152` (23-sep-2025, migración `20250921193122_ids_autoincrement`),
// donde NUEVE campos cambiaron de `String` a `Int` sin que cambiara un solo nombre.
//
// El arreglo obvio era ampliar aquel parser de texto para comparar tipo y opcionalidad. Cubre
// menos y cuesta más: cada propiedad nueva pide una regex nueva, y quedan fuera `@default`,
// `@db.<nativo>`, relaciones, índices y `@@map`.
//
// LA PREGUNTA DE RAÍZ ES OTRA, y se puede responder entera: **el cliente generado guarda una
// copia del schema del que salió** (`node_modules/.prisma/client/schema.prisma`). Comparar los
// dos textos trae de golpe tipo, opcionalidad, `@default`, `@db.<nativo>`, relaciones, índices
// y `@@map`, sin parsear nada.
//
// SON DOS PROPIEDADES DISTINTAS Y HACEN FALTA LAS DOS — por eso esto se AÑADE y no sustituye:
//   · SCRUM-235 verifica **lo que el cliente va a emitir** (su DMMF). Verdad de EJECUCIÓN.
//   · Esto verifica la **PROCEDENCIA**: que el cliente salió de este texto exacto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🚨 EL SUELO, Y ES LO PRIMERO PORQUE ES INNEGOCIABLE
//
// `node_modules/.prisma/client/schema.prisma` es **detalle interno de Prisma, no API
// documentada**. Puede desaparecer o mudarse en cualquier versión. Si eso pasa, este guard se
// pone **ROJO, jamás verde**: un guard que se queda ciego en silencio es peor que no tenerlo,
// porque sigue firmando un verde que ya no significa nada.
//
// Hay un segundo suelo, menos obvio y del mismo tipo: si la NORMALIZACIÓN se comiera el texto
// (una regex de más y todo queda en cadena vacía), dos schemas cualesquiera saldrían iguales y
// esto diría verde para siempre. Por eso se exige que lo normalizado conserve tamaño.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS CUATRO NORMALIZACIONES, Y EL PORQUÉ DE CADA UNA
//
// La copia del cliente **no es byte a byte**: Prisma la guarda FORMATEADA. Medido sobre el
// schema real (40.227 bytes en el repo, 39.270 en el cliente), lo que las separa es solo esto:
//
//   ① FIN DE LÍNEA (`\r\n` → `\n`). El repo está en Windows y `.gitattributes` puede entregar
//      CRLF; lo que escribe Prisma es LF. Es diferencia de plataforma, no de schema.
//   ② ESPACIOS. El formateador ALINEA los campos en columnas y el repo no siempre. Es la mayor
//      parte de esos 957 bytes de diferencia, y no cambia ni un tipo.
//   ③ COMENTARIOS (`//…`). Se recortan A PROPÓSITO, y no es solo cosmética: sin esto, cambiar un
//      comentario del schema pondría en rojo la suite de TODOS los worktrees —comparten
//      `node_modules` por junction— por algo que no altera el cliente ni una coma. Un guard que
//      grita sobre un árbol sano se desactiva en una tarde.
//      Comprobado que es seguro CONTÁNDOLO, no razonándolo: el schema tiene **273 cadenas
//      entrecomilladas y NINGUNA contiene `//`**, así que recortar no puede partir un valor.
//   ④ ORDEN DE LOS ATRIBUTOS. El formateador los canonicaliza: `@db.Text @map("x")` en el repo
//      sale como `@map("x") @db.Text` en la copia. Es el ÚNICO reordenamiento que hace, medido:
//      con las otras tres normalizaciones quedaban 6 líneas distintas, y las 6 eran esto.
//
// Ninguna de las cuatro puede esconder un cambio de tipo, de opcionalidad o de atributo: todas
// operan sobre la PRESENTACIÓN. Si algún día el formateador canonicaliza algo más, el control
// «árbol sano → verde» de `tests/scrum252-procedencia-cliente.test.mjs` lo caza en `npm test`,
// que es donde tiene que cazarse y no en la noche de alguien.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Parte una línea en CABEZA (nombre y tipo del campo) y sus atributos `@…`.
 *
 * ⚠️ POR QUÉ ESTO ES UN ESCÁNER Y NO UNA REGEX, que es como estaba escrito primero:
 * `/@[\w.]+(\([^)]*\))?/g` corta en el PRIMER `)`, así que `@default(autoincrement())` salía
 * como `@default(autoincrement()` — y, como la línea se reconstruye a partir de los trozos
 * reconocidos, **todo lo que quedaba fuera se perdía en silencio**. Un texto que se descarta sin
 * avisar es exactamente donde se esconde una diferencia. Lo cazó el rojo de `55fd152` al exigir
 * la línea EXACTA en el mensaje; con un `assert` de «cae» a secas habría pasado desapercibido.
 *
 * El escáner respeta paréntesis ANIDADOS y comillas, y trata `@@` (atributos de bloque) como un
 * solo arranque.
 */
export function partirAtributos(linea) {
  const atributos = [];
  let inicio = -1, profundidad = 0, comilla = null;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (comilla) { if (c === comilla && linea[i - 1] !== '\\') comilla = null; continue; }
    if (c === '"' || c === "'") { comilla = c; continue; }
    if (c === '(') { profundidad++; continue; }
    if (c === ')') { profundidad--; continue; }
    if (c === '@' && profundidad === 0 && linea[i - 1] !== '@') {
      if (inicio !== -1) atributos.push(linea.slice(inicio, i).trim());
      inicio = i;
    }
  }
  if (inicio === -1) return { cabeza: linea, atributos: [], desde: -1 };
  atributos.push(linea.slice(inicio).trim());
  const desde = linea.indexOf(atributos[0].slice(0, 2) === '@@' ? '@@' : '@');
  return { cabeza: linea.slice(0, desde).trim(), atributos, desde };
}

/**
 * Las cuatro normalizaciones, en orden. PURA para poder probar cada una por separado: una
 * normalización que nadie ha visto actuar es una regex que alguien borrará por parecer de más.
 */
export function normalizarSchema(texto) {
  return String(texto)
    .replace(/\r\n/g, '\n')                                   // ① fin de línea
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim().replace(/\s+/g, ' ')) // ③ comentarios · ② espacios
    .filter((l) => l !== '')
    .map((l) => {
      // ④ orden de atributos. La CABEZA no se toca: si se tocara, un cambio de TIPO se perdería,
      // que es justo lo que este guard viene a ver.
      const { cabeza, atributos } = partirAtributos(l);
      if (atributos.length === 0) return l;
      // `.trim()`: en un atributo de BLOQUE (`@@map`, `@@index`) la cabeza está vacía, y sin esto
      // la línea saldría con un espacio delante — inofensivo para comparar (los dos lados lo
      // llevarían), pero el mensaje del rojo es la mitad del valor de un guard.
      return `${cabeza} ${atributos.sort().join(' ')}`.trim();
    })
    .join('\n');
}

/**
 * Dónde guardó Prisma la copia del schema. Se resuelve por el MISMO camino que usa la app para
 * cargar el cliente (`require.resolve('.prisma/client')`) y no por una ruta escrita a mano: con
 * `node_modules` compartido por junction entre ~79 worktrees, la ruta literal y el módulo que se
 * carga de verdad pueden no ser el mismo sitio. Se compara contra el cliente que se USA.
 *
 * @returns {{ ok: true, ruta: string } | { ok: false, motivo: string }}
 */
export function rutaSchemaDelCliente(desde = RAIZ) {
  let dirCliente;
  try {
    const require = createRequire(path.join(desde, 'x.js'));
    dirCliente = path.dirname(require.resolve('.prisma/client'));
  } catch (err) {
    return {
      ok: false,
      motivo: `no se pudo resolver el cliente generado (.prisma/client): ${err.code || err.message}`,
    };
  }
  const ruta = path.join(dirCliente, 'schema.prisma');
  if (!fs.existsSync(ruta)) {
    return {
      ok: false,
      motivo:
        `el cliente generado NO trae su copia del schema (${ruta}). Es un detalle interno de ` +
        `Prisma y puede haber cambiado de sitio en esta versión: hay que localizarla de nuevo y ` +
        `arreglar este guard. NO se da por bueno el cliente.`,
    };
  }
  return { ok: true, ruta };
}

/** Tamaño mínimo que tiene que conservar lo normalizado. Ver el segundo suelo de la cabecera. */
const SUELO_LINEAS = 100;

/**
 * ¿El cliente que se carga salió de este `schema.prisma`?
 *
 * @returns {{ ok: true, lineas: number } | { ok: false, motivo: string, soloRepo?: string[], soloCliente?: string[] }}
 */
export function comprobarProcedencia(opts = {}) {
  const schemaPath = opts.schemaPath ?? path.join(RAIZ, 'prisma', 'schema.prisma');
  let textoRepo;
  try {
    textoRepo = fs.readFileSync(schemaPath, 'utf8');
  } catch (err) {
    return { ok: false, motivo: `no se pudo leer ${schemaPath}: ${err.code || err.message}` };
  }

  let rutaCliente = opts.clienteSchemaPath;
  if (!rutaCliente) {
    const r = rutaSchemaDelCliente(opts.desde);
    if (!r.ok) return { ok: false, motivo: r.motivo }; // SUELO: ciego ⇒ ROJO
    rutaCliente = r.ruta;
  }
  let textoCliente;
  try {
    textoCliente = fs.readFileSync(rutaCliente, 'utf8');
  } catch (err) {
    return { ok: false, motivo: `no se pudo leer la copia del cliente (${rutaCliente}): ${err.code || err.message}` };
  }

  const a = normalizarSchema(textoRepo);
  const b = normalizarSchema(textoCliente);

  // SUELO 2: si la normalización se comiera el texto, cualquier par saldría igual.
  const lineasA = a === '' ? 0 : a.split('\n').length;
  const lineasB = b === '' ? 0 : b.split('\n').length;
  if (lineasA < SUELO_LINEAS || lineasB < SUELO_LINEAS) {
    return {
      ok: false,
      motivo:
        `la normalización dejó ${lineasA} línea(s) del schema y ${lineasB} de la copia del ` +
        `cliente, por debajo del suelo de ${SUELO_LINEAS}. Con el texto vaciado, dos schemas ` +
        `cualesquiera saldrían iguales: esto es un fallo del guard, no un verde.`,
    };
  }

  if (a === b) return { ok: true, lineas: lineasA };

  const la = a.split('\n'), lb = b.split('\n');
  const enCliente = new Set(lb), enRepo = new Set(la);
  return {
    ok: false,
    motivo: 'el cliente generado NO salió de este schema.prisma',
    soloRepo: la.filter((l) => !enCliente.has(l)).slice(0, 5),
    soloCliente: lb.filter((l) => !enRepo.has(l)).slice(0, 5),
  };
}

/**
 * Mensaje único y accionable. Mismo criterio que el guard de SCRUM-235: quien lo lea a las once
 * de la noche necesita saber QUÉ HACER, no un inventario — por eso se muestran cinco líneas de
 * cada lado y no las que haya.
 */
export function mensaje(r) {
  if (r.ok) return '';
  const partes = [`🔴 PROCEDENCIA DEL CLIENTE DE PRISMA: ${r.motivo}.`];
  if (r.soloRepo?.length) {
    partes.push(`   en schema.prisma y NO en el cliente:\n${r.soloRepo.map((l) => `     + ${l}`).join('\n')}`);
  }
  if (r.soloCliente?.length) {
    partes.push(`   en el cliente y NO en schema.prisma:\n${r.soloCliente.map((l) => `     - ${l}`).join('\n')}`);
  }
  // 🔴 SCRUM-461 · ESTE AVISO AFIRMABA UN MONTAJE QUE YA NO EXISTE.
  //
  // Decía: «`node_modules` se comparte por JUNCTION entre worktrees — regenerar afecta a todos».
  // Medido el 10-ago con `fs.realpathSync` sobre los cuatro worktrees vivos: **los cuatro son
  // directorios REALES E INDEPENDIENTES**. No hay junction.
  //
  // No es un detalle de redacción: sobre ese aviso se desaconsejó un `npm install` por miedo a
  // romper la tanda de otras dos sesiones, y el miedo era infundado. Un aviso que describe un
  // montaje anterior hace tomar decisiones equivocadas con toda la confianza.
  //
  // Ya no se AFIRMA el montaje: se dice cómo comprobarlo, que es cierto con junction y sin él.
  partes.push(
    '   Remedio: `npx prisma generate`. (En Windows, si el DLL queda bloqueado, matar node antes.)\n' +
    '   ¿Afecta a otros worktrees? Depende de si tu `node_modules` es propio o un enlace:\n' +
    '     node -e "console.log(require(\'fs\').lstatSync(\'node_modules\').isSymbolicLink())"\n' +
    '   `false` = es tuyo, regenerar no toca a nadie. `true` = es compartido, y entonces sí.',
  );
  return partes.join('\n');
}

export function esInvocacionDirecta(metaUrl, argv1) {
  if (!argv1) return false;
  try {
    return fileURLToPath(metaUrl) === path.resolve(argv1);
  } catch {
    return false;
  }
}

if (esInvocacionDirecta(import.meta.url, process.argv[1])) {
  const r = comprobarProcedencia();
  if (!r.ok) {
    console.error(mensaje(r));
    process.exit(1);
  }
  console.log(`✔ el cliente de Prisma salió de este schema.prisma (${r.lineas} líneas comparadas)`);
}
