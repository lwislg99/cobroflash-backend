// scripts/_pares-del-schema.mjs — SCRUM-461
//
// LAS COLUMNAS QUE DECLARA `prisma/schema.prisma`, DERIVADAS DEL FICHERO Y NO DEL CLIENTE.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE ESTE SEGUNDO CAMINO
//
// `scripts/generar-sql-deriva.mjs` escribe el censo de deriva leyendo
// `require('@prisma/client').Prisma.dmmf.datamodel` — el CLIENTE GENERADO, que vive en
// `node_modules`. El número que escribe es, por tanto, una propiedad **del entorno**, no del árbol:
// el 10-ago el mismo código dio **331** en un worktree con el cliente atrasado, **345** en el
// fichero commiteado y **346** con el cliente al día.
//
// 🔴 Y LO QUE LO CONVIERTE EN DEFECTO: `tests/scrum222-deriva-arranque.test.mjs` comprueba el
// fichero comparándolo contra **ese mismo cliente**. Generador y vigilante beben de la misma
// fuente, así que se dan la razón el uno al otro estando los dos mal.
//
//   «Dos testigos que comparten código son un testigo.» Aquí ni comparten: eran el mismo.
//
// Un censo encogido **deja de mirar** las columnas que le faltan y pasa en verde. El 10-ago se
// evitó porque el fundador vio un número raro; con una columna en vez de quince, nadie lo habría
// notado. Este fichero es el testigo que no comparte fuente: lee el `.prisma` del árbol.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ESTO ES UN PARSER, Y UN PARSER SE EQUIVOCA
//
// No se pretende reimplementar Prisma. Se pretende **discrepar cuando hay que discrepar**, y por
// eso su corrección no se afirma: se COMPRUEBA en cada tanda contra el DMMF del cliente cuando el
// cliente está al día (`tests/scrum461-censo-no-encoge.test.mjs`). Si este parser se equivoca en un
// campo, ese test cae — no pasa desapercibido.
//
// El día que `@prisma/internals` esté instalado, `getDMMF` hace esto mejor y este fichero sobra.
// Hoy no está, y una dependencia nueva la pide el fundador (regla 36).
import fs from 'node:fs';
import { partirAtributos } from './_prisma-procedencia-guard.mjs';

/** El valor de un `@map("x")` / `@@map("x")` dentro de una lista de atributos. */
function valorDeMap(atributos, doble) {
  const marca = doble ? '@@map(' : '@map(';
  for (const a of atributos) {
    // `@@map(` empieza por `@`, así que para el simple hay que descartar el doble explícitamente.
    if (!a.startsWith(marca)) continue;
    if (!doble && a.startsWith('@@')) continue;
    const m = a.match(/^@@?map\(\s*(?:name\s*:\s*)?"([^"]*)"/);
    if (m) return m[1];
  }
  return null;
}

/** El tipo base de un campo: `Foo?` → `Foo`, `Foo[]` → `Foo`. */
function tipoBase(tipo) {
  return String(tipo || '').replace(/\[\]$/, '').replace(/\?$/, '');
}

/**
 * Los pares `[tabla, columna]` que declara un `schema.prisma`.
 *
 * MISMO CRITERIO que `generar-sql-deriva.mjs` y que `src/core/db/schemaDrift.ts`: `dbName ?? name`
 * y **las relaciones fuera** (en el DMMF, `kind === 'object'`). Aquí una relación se reconoce
 * porque su tipo es otro `model`; los `enum` **sí** son columnas y se quedan.
 *
 * @returns {{ pares: [string,string][], modelos: string[], enums: string[], campos: number }}
 */
export function paresDelSchema(texto) {
  const lineas = String(texto)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter(Boolean);

  // ① Primero, QUÉ ES UN MODELO. Hace falta el conjunto entero antes de mirar ningún campo: una
  // relación hacia un modelo declarado más abajo se leería como columna si se hiciera en una
  // sola pasada.
  const modelos = [];
  const enums = [];
  for (const l of lineas) {
    const m = l.match(/^model\s+(\w+)\s*\{/);
    if (m) { modelos.push(m[1]); continue; }
    const e = l.match(/^enum\s+(\w+)\s*\{/);
    if (e) enums.push(e[1]);
  }
  const esModelo = new Set(modelos);

  // ② Y ahora los campos, modelo a modelo.
  const pares = [];
  let campos = 0;
  let dentro = null;      // nombre del modelo actual
  let bloque = [];        // sus líneas de campo
  let tabla = null;

  const cerrar = () => {
    if (!dentro) return;
    const nombreTabla = tabla || dentro;
    for (const { columna } of bloque) pares.push([nombreTabla, columna]);
    dentro = null; bloque = []; tabla = null;
  };

  // El `{` de apertura NO siempre está solo en su línea: `model Persona { id Int @id` es válido, y
  // un parser que descarte el resto de esa línea PIERDE ESE CAMPO — el censo encogería y este
  // testigo no lo vería. Se parte la apertura y se sigue con lo que venga detrás.
  const porLinea = [];
  for (const l of lineas) {
    const abre = l.match(/^(model\s+\w+\s*\{)(.*)$/);
    if (abre) {
      porLinea.push(abre[1]);
      if (abre[2].trim()) porLinea.push(abre[2].trim());
      continue;
    }
    // Y lo mismo con el cierre: `id Int @id }` deja el campo pegado a la llave. Partirlo siempre es
    // seguro — un `}` suelto fuera de un modelo no hace nada.
    const cierra = l.match(/^(.*?\S)\s*\}$/);
    if (cierra) { porLinea.push(cierra[1].trim()); porLinea.push('}'); continue; }
    porLinea.push(l);
  }

  for (const l of porLinea) {
    const abre = l.match(/^model\s+(\w+)\s*\{/);
    if (abre) { cerrar(); dentro = abre[1]; bloque = []; tabla = null; continue; }
    if (!dentro) continue;
    if (l === '}') { cerrar(); continue; }

    const { cabeza, atributos } = partirAtributos(l);

    // Atributo de BLOQUE (`@@map`, `@@index`, `@@unique`): no es una columna.
    if (cabeza === '' || l.startsWith('@@')) {
      const t = valorDeMap(atributos.length ? atributos : [l], true);
      if (t) tabla = t;
      continue;
    }

    const partes = cabeza.split(/\s+/);
    if (partes.length < 2) continue;              // no es `nombre Tipo`
    const [nombre, tipo] = partes;
    if (!/^\w+$/.test(nombre)) continue;

    campos += 1;
    // 🔴 LAS RELACIONES FUERA. No son columnas: en el DMMF son `kind: 'object'`, y aquí se
    // reconocen porque su tipo es otro modelo. Un `enum` NO es relación y se queda.
    if (esModelo.has(tipoBase(tipo))) continue;

    bloque.push({ columna: valorDeMap(atributos, false) || nombre });
  }
  cerrar();

  pares.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  return { pares, modelos, enums, campos };
}

/** Lo mismo, leyendo del disco. */
export function paresDelFichero(ruta) {
  return paresDelSchema(fs.readFileSync(ruta, 'utf8'));
}
