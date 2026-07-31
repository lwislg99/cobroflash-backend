// scripts/_prisma-client-guard.mjs — SCRUM-190, criterio reescrito en SCRUM-235
//
// ⚠️ COINCIDENCIA, NO PRESENCIA. Comprobar que el cliente de Prisma "existe" no vale para nada:
// el fallo que muerde es un cliente que SÍ está, recién generado y flamante, pero **desde otro
// `schema.prisma`**. Eso da verde y luego revienta en sitios que no parecen relacionados.
//
// Pasó el 27-jul-2026: se regeneró el cliente desde el repo principal, que estaba en otra rama con
// un schema más viejo, y `tsc` empezó a fallar por `decisionToken` y por una relación que "no
// existía". El cliente estaba ahí. Un guard de presencia habría dicho que todo bien.
//
// Y es fácil de provocar sin querer, porque `node_modules` se comparte por JUNCTION entre todos
// los worktrees: quien regenera, regenera para todos (incidente #11 de `docs/ERRORES_ASESOR.md`).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-235 · POR QUÉ EL CRITERIO ANTERIOR DABA FALSO VERDE
//
// La cabecera de este fichero decía dos cosas, y las dos eran el defecto:
//
//   «Al revés no: un cliente con cosas de MÁS […] molesto pero inofensivo»
//   «Falla lo que rompe el build.»
//
// La segunda es la que mandaba, y por eso la primera parecía razonable: el criterio apuntaba al
// COMPILADO —`tsc` se queja de lo que FALTA— cuando el fallo caro vive en la CONSULTA, y la base
// se queja de lo que SOBRA. Prisma selecciona todos los escalares por defecto, así que un campo
// de más en el cliente mete esa columna en **toda** lectura del modelo, y la base la rechaza.
//
// Lo pagó la tanda del 29-jul-2026: `npx prisma generate` de una sesión, a mitad de la tanda de
// otra, dejó un cliente que pedía `vf_estado` contra una staging que no tenía esa columna.
// 6 tests muertos, 27 minutos, y este guard EN VERDE todo el rato.
//
// Es la misma forma que SCRUM-239 (el criterio miraba el commit y el fallo vivía en el árbol de
// trabajo): **el medidor mira un sitio y el defecto vive en otro, y el verde no lo distingue.**
//
// EL CRITERIO DE AHORA, y es el que corresponde a la propiedad de verdad —«toda lectura que el
// cliente emita tiene que poder responderla la base»—:
//
//   Por cada modelo, el conjunto de COLUMNAS escalares del cliente y el del schema tienen que ser
//   IGUALES. En los DOS sentidos, porque cada sentido rompe una cosa distinta:
//     · falta en el cliente → el cliente es viejo: `tsc` y las escrituras romperán.
//     · SOBRA en el cliente → el cliente es nuevo: toda LECTURA de ese modelo pedirá una columna
//       que la base no tiene. Este es el que estaba abierto.
//
// COLUMNAS, NO NOMBRES DE CAMPO. La base responde por nombre de columna, y en este schema hay
// **189 campos escalares cuyo `@map` difiere del nombre del campo** (`Invoice.vfEstado` es la
// columna `vf_estado`). Comparar nombres de campo dejaba fuera un cliente generado desde un schema
// que solo cambiara un `@map`: verde aquí, columna inexistente allí. El DMMF ya trae `dbName`.
//
// Y QUÉ ES UN ESCALAR se decide por ESTRUCTURA, no por una lista de tipos a mano: **un campo es
// una relación si y solo si su tipo nombra un modelo declarado en este mismo schema**; todo lo
// demás (escalares y enums) viaja en el SELECT. La lista literal de nueve tipos que había aquí
// dejaba los enums fuera del lado del schema —invisibles incluso en la dirección que el guard sí
// decía cubrir— y era otra lista que envejece, la familia que mató SCRUM-199.
//
// LO QUE ESTO NO HACE: no compara contra la BASE, solo contra `schema.prisma`. Si la base y el
// schema divergen (un `db push` pendiente), esto no lo ve — para eso está
// `scripts/preflight-schema-drift.mjs`. Y no arregla la causa de fondo, el `node_modules`
// compartido: convierte media hora tirada en un aborto de dos segundos.
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// MENSAJE ÚNICO Y SALIDA INMEDIATA: se informa de la PRIMERA diferencia y se para. Veinte
// diferencias son la misma causa contada veinte veces (el cliente es de otro schema) y quien lo
// lea a las once de la noche necesita saber qué hacer, no un inventario. Lo que sí cambia es que
// el mensaje dice **en qué dirección** va la diferencia, porque el remedio se lee distinto.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Modelos y COLUMNAS escalares declaradas en el schema, parseados del texto.
 *
 * Se lee el fichero y no el DMMF del propio Prisma a propósito: el DMMF sale de la última
 * generación, o sea del artefacto que precisamente estamos poniendo en duda. Preguntarle al
 * sospechoso no sirve.
 *
 * @returns {Map<string, Map<string, string>>} modelo → (campo → columna)
 */
export function modelosDelSchema(textoSchema) {
  const bloques = [...textoSchema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  // PRIMERA PASADA: los nombres de modelo. Hacen falta ANTES de clasificar campos, porque la
  // regla de «esto es una relación» es justamente «su tipo es uno de estos nombres».
  const nombresDeModelo = new Set(bloques.map((m) => m[1]));

  const out = new Map();
  for (const m of bloques) {
    const campos = new Map();
    for (const linea of m[2].split('\n')) {
      const t = linea.trim();
      if (!t || t.startsWith('//') || t.startsWith('@@') || t.startsWith('///')) continue;
      const campo = t.match(/^(\w+)\s+(\w+)/);
      if (!campo) continue;
      const [, nombre, tipo] = campo;
      // ESTRUCTURAL: relación ⇔ el tipo nombra un modelo de este schema. Sin lista de tipos.
      if (nombresDeModelo.has(tipo)) continue;
      // La COLUMNA es lo que la base entiende. `@map` manda sobre el nombre del campo.
      const map = t.match(/@map\("([^"]+)"\)/);
      campos.set(nombre, map ? map[1] : nombre);
    }
    out.set(m[1], campos);
  }
  return out;
}

/**
 * Campos del cliente generado, sacados de su DMMF. `rutaCliente` permite apuntar a OTRO cliente
 * —un directorio generado aparte—, que es como se prueba este guard en rojo sin tocar el
 * `node_modules` que comparten todos los worktrees.
 *
 * @returns {Promise<Map<string, Map<string, string>>>} modelo → (campo → columna)
 */
export async function modelosDelCliente(rutaCliente) {
  const mod = await import(rutaCliente || '@prisma/client');
  const modelos = mod.Prisma?.dmmf?.datamodel?.models || [];
  return new Map(modelos.map((m) => [
    m.name,
    // `kind: 'object'` son las RELACIONES: no son columnas y no viajan en el SELECT por defecto.
    // Todo lo demás (scalar y enum) sí. Filtrar por «!== object» y no por una lista de kinds es
    // lo mismo que hace la regla estructural del lado del schema: no enumera lo que acepta.
    new Map(m.fields.filter((f) => f.kind !== 'object').map((f) => [f.name, f.dbName || f.name])),
  ]));
}

/**
 * Primera divergencia entre lo declarado y lo generado, o `null` si cuadran. Mira en LOS DOS
 * SENTIDOS: lo que falta en el cliente y lo que sobra.
 */
export function primeraDiscrepancia(delSchema, delCliente) {
  for (const [modelo, campos] of delSchema) {
    const enCliente = delCliente.get(modelo);
    if (!enCliente) return { direccion: 'falta', tipo: 'modelo', modelo };
    for (const [campo, columna] of campos) {
      const enClienteCol = enCliente.get(campo);
      if (enClienteCol === undefined) return { direccion: 'falta', tipo: 'campo', modelo, campo, columna };
      // Mismo campo, DISTINTA columna: el cliente pedirá un nombre que la base no conoce. Esto
      // es invisible si se comparan nombres de campo, que es lo que se hacía hasta SCRUM-235.
      if (enClienteCol !== columna) {
        return { direccion: 'columna', tipo: 'campo', modelo, campo, columna, columnaCliente: enClienteCol };
      }
    }
  }
  // LA VUELTA (SCRUM-235): lo que el cliente tiene de MÁS. Es lo que mata las lecturas.
  for (const [modelo, campos] of delCliente) {
    const enSchema = delSchema.get(modelo);
    if (!enSchema) return { direccion: 'sobra', tipo: 'modelo', modelo };
    for (const [campo, columna] of campos) {
      if (!enSchema.has(campo)) return { direccion: 'sobra', tipo: 'campo', modelo, campo, columna };
    }
  }
  return null;
}

export function mensaje(d) {
  const qué = d.tipo === 'modelo' ? `el modelo "${d.modelo}"` : `el campo "${d.modelo}.${d.campo}"`;

  // UN diagnóstico por dirección: el hecho es el mismo (el cliente no es de este schema) pero lo
  // que va a romper —y por tanto lo que la persona va a ver— es distinto.
  const porDireccion = {
    falta: [
      `   ${qué} está en schema.prisma y NO en el cliente generado.`,
      '',
      '   El cliente va POR DETRÁS del schema: `tsc` fallará por campos que "no existen" y las',
      '   escrituras que usen ese campo no compilarán.',
    ],
    sobra: [
      `   ${qué} está en el cliente generado y NO en schema.prisma.`,
      '',
      '   El cliente va POR DELANTE del schema, y esto NO es inofensivo (lo fue hasta SCRUM-235):',
      '   Prisma selecciona todos los escalares por defecto, así que TODA LECTURA de ese modelo',
      `   pedirá la columna "${d.columna ?? d.modelo}" y la base la rechazará. Es lo que mató la`,
      '   tanda del 29-jul-2026: 6 tests y 27 minutos, con este guard en verde.',
    ],
    columna: [
      `   ${qué} existe en los dos, pero apunta a COLUMNAS distintas:`,
      `     schema.prisma → "${d.columna}"     ·     cliente → "${d.columnaCliente}"`,
      '',
      '   La base responde por nombre de columna, no por nombre de campo. El cliente pedirá una',
      '   columna que no existe en cuanto lea ese modelo.',
    ],
  }[d.direccion];

  return [
    '',
    '🔴 EL CLIENTE DE PRISMA NO CORRESPONDE A schema.prisma',
    '',
    ...porDireccion,
    '',
    '   El cliente ESTÁ generado — no falta: es de OTRO schema. Suele pasar al regenerarlo desde',
    '   un worktree que está en otra rama, y como `node_modules` se comparte por junction, afecta',
    '   a todas las sesiones a la vez.',
    '',
    '   Arreglo:  npx prisma generate   (desde ESTE worktree)',
    '',
  ].join('\n');
}

/** Devuelve `{ ok }` o `{ ok:false, mensaje }`. No imprime ni sale: eso lo decide el llamador. */
export async function comprobarCliente({ schemaPath, rutaCliente } = {}) {
  const texto = fs.readFileSync(schemaPath || path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
  const d = primeraDiscrepancia(modelosDelSchema(texto), await modelosDelCliente(rutaCliente));
  return d ? { ok: false, mensaje: mensaje(d) } : { ok: true };
}

// Uso directo:  node scripts/_prisma-client-guard.mjs [rutaClienteAlternativo]
const invocadoDirecto = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(path.sep).join('/'));
if (invocadoDirecto) {
  const r = await comprobarCliente({ rutaCliente: process.argv[2] });
  if (!r.ok) {
    console.error(r.mensaje);
    process.exit(1); // salida inmediata: nada de seguir compilando sobre un cliente que no es
  }
  console.log('✔ el cliente de Prisma coincide con schema.prisma (columnas, en los dos sentidos)');
}
