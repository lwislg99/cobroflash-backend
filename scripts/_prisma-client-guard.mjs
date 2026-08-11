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
// Y es fácil de provocar sin querer. La causa de siempre es que `schema.prisma` viaja con la rama y
// el cliente generado no. Hay una segunda que DEPENDE DEL MONTAJE: si `node_modules` es un enlace
// al de otro worktree, quien regenera regenera para todos (incidente #11, `docs/ERRORES_ASESOR.md`).
//
// ⚠️ SCRUM-461 · esto ANTES se afirmaba como un hecho —«se comparte por JUNCTION entre todos»—. Se
// midió el 10-ago con `fs.realpathSync` sobre los cuatro worktrees vivos: **ninguno lo era**, los
// cuatro son directorios propios. No comprobarlo ya costó una decisión equivocada en cada dirección
// (se desaconsejó un `npm install` por un riesgo que no existía; y una sesión estuvo a punto de no
// arreglar cuatro `ERR_MODULE_NOT_FOUND` por respetar una restricción que no aplicaba).
//
// ⚠️ SCRUM-351 · Y NO SE SUSTITUYE POR LA AFIRMACIÓN CONTRARIA. «Son independientes» vuelve a ser
// una premisa falsa en cuanto alguien recree un worktree, cambie de máquina o instale de otra
// forma — que es exactamente cómo llegamos aquí. La respuesta se DERIVA cada vez, y cubre los tres
// montajes de una sola pasada (propio · enlazado · sin `node_modules`, que resuelve hacia arriba
// sin dejar ningún enlace que inspeccionar):
//     npm run topologia
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
// LO QUE ESTO **NO** MIRA, y conviene saberlo antes de leer un verde:
//   · El TIPO del campo, su opcionalidad y su `@default`. Dos schemas con las mismas columnas y
//     distinto tipo (`String` ↔ `Int`) dan verde aquí, y el cliente revienta al deserializar. No
//     entra porque es otra propiedad —la base RESPONDE, y es el cliente quien rechaza— y porque
//     parsear defaults y tipos nativos del texto es frágil. Declarado, no descubierto en un rojo.
//   · `@default` y `@db.<nativo>`, por lo mismo.
//
// LO QUE ESTO NO HACE: no compara contra la BASE, solo contra `schema.prisma`. Si la base y el
// schema divergen (un `db push` pendiente), esto no lo ve — para eso está
// `scripts/preflight-schema-drift.mjs`. Y no arregla ninguna de las dos causas de fondo —el cambio
// de rama (A) y un `node_modules` compartido (B), *si* lo está—: convierte media hora tirada en un
// aborto de dos segundos.
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
 * Quita el comentario `//` de una línea SIN romper las cadenas entrecomilladas.
 *
 * Hace falta porque el parser buscaba `@map("...")` en la línea ENTERA, comentario incluido: una
 * nota como `slug String? // antes era @map("slug_url")` hacía que el guard se inventara la
 * columna `slug_url` y diera ROJO sobre un árbol sano — y encima irreparable, porque el remedio
 * que imprime («regenera el cliente») produce exactamente el mismo cliente. Es la trampa de
 * autorreferencia de siempre: leer el código sin quitar los comentarios (SCRUM-176/168/3/193).
 *
 * Y no vale un `split('//')`: en este schema hay 44 líneas con el `@map` DETRÁS de un `@default`,
 * así que el día que un default lleve una URL (`@default("https://…")`) un corte ingenuo se
 * comería el `@map` y cambiaríamos un falso rojo por otro.
 */
export function sinComentario(linea) {
  let dentro = null;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (dentro) {
      if (c === dentro) dentro = null;
    } else if (c === '"' || c === "'") {
      dentro = c;
    } else if (c === '/' && linea[i + 1] === '/') {
      return linea.slice(0, i);
    }
  }
  return linea;
}

/**
 * Modelos, TABLA y COLUMNAS escalares declaradas en el schema, parseados del texto.
 *
 * Se lee el fichero y no el DMMF del propio Prisma a propósito: el DMMF sale de la última
 * generación, o sea del artefacto que precisamente estamos poniendo en duda. Preguntarle al
 * sospechoso no sirve.
 *
 * LA TABLA cuenta tanto como las columnas: el `FROM` está en toda lectura igual que la lista de
 * columnas, y los 24 modelos de este schema llevan `@@map`. Un cliente que lea de otra tabla
 * falla con 42P01 en el 100% de las lecturas del modelo — el mismo desastre que las columnas.
 *
 * @returns {Map<string, {tabla: string, campos: Map<string, string>}>}
 */
export function modelosDelSchema(textoSchema) {
  const bloques = [...textoSchema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  // PRIMERA PASADA: los nombres de modelo. Hacen falta ANTES de clasificar campos, porque la
  // regla de «esto es una relación» es justamente «su tipo es uno de estos nombres».
  const nombresDeModelo = new Set(bloques.map((m) => m[1]));

  const out = new Map();
  for (const m of bloques) {
    // `@@ignore`: Prisma NO genera ese modelo. Compararlo daría un rojo permanente que ningún
    // `prisma generate` puede curar. Hoy el schema no usa ninguno; se contempla porque es la
    // salida estándar de una introspección y el rojo sería irreparable.
    if (/@@ignore\b/.test(m[2])) continue;

    const campos = new Map();
    let tabla = m[1]; // sin @@map, Prisma usa el nombre del modelo tal cual
    for (const cruda of m[2].split('\n')) {
      const t = sinComentario(cruda).trim();
      if (!t) continue;
      if (t.startsWith('@@')) {
        const mapTabla = t.match(/@@map\("([^"]+)"\)/);
        if (mapTabla) tabla = mapTabla[1];
        continue;
      }
      const campo = t.match(/^(\w+)\s+(\w+)/);
      if (!campo) continue;
      const [, nombre, tipo] = campo;
      // ESTRUCTURAL: relación ⇔ el tipo nombra un modelo de este schema. Sin lista de tipos.
      if (nombresDeModelo.has(tipo)) continue;
      if (/@ignore\b/.test(t)) continue; // el campo no llega al cliente: mismo motivo que @@ignore
      // La COLUMNA es lo que la base entiende. `@map` manda sobre el nombre del campo.
      const map = t.match(/@map\("([^"]+)"\)/);
      campos.set(nombre, map ? map[1] : nombre);
    }
    out.set(m[1], { tabla, campos });
  }
  return out;
}

/**
 * Campos del cliente generado, sacados de su DMMF. `rutaCliente` permite apuntar a OTRO cliente
 * —un directorio generado aparte—, que es como se prueba este guard en rojo sin tocar ningún
 * `node_modules` de verdad: ni el propio, ni el de otro worktree si resultara estar compartido.
 *
 * @returns {Promise<Map<string, Map<string, string>>>} modelo → (campo → columna)
 */
export async function modelosDelCliente(rutaCliente) {
  // ⚠️ SCRUM-429 · SI EL CLIENTE NO SE PUEDE CARGAR, SE DEVUELVE VACÍO — NO SE LANZA.
  //
  // Antes, un cliente ausente o ilegible reventaba con el error de ESM crudo
  // («Cannot find module …», o el de rutas de Windows sin `file://`). Eso es un stack, no un
  // diagnóstico: quien lo ve no sabe si el guard ha encontrado un problema o si el guard ES el
  // problema.
  //
  // Devolviendo vacío cae en el suelo que ya existe (`sinDatos`), que **falla cerrado** y explica
  // que no se pudo comparar. Es la diferencia entre «no supe mirar» y «está mal», que es
  // exactamente lo que este guard existe para no confundir.
  let mod;
  try {
    mod = await import(rutaCliente || '@prisma/client');
  } catch {
    return new Map();
  }
  const modelos = mod.Prisma?.dmmf?.datamodel?.models || [];
  return new Map(modelos.map((m) => [
    m.name,
    {
      // `m.dbName` es el nombre físico de la TABLA. Estaba cargado en memoria y se tiraba: los
      // 24 modelos de este schema lo traen, así que el 100% de las tablas quedaba sin vigilar.
      tabla: m.dbName || m.name,
      // `kind: 'object'` son las RELACIONES: no son columnas y no viajan en el SELECT por defecto.
      // Todo lo demás (scalar y enum) sí. Filtrar por «!== object» y no por una lista de kinds es
      // lo mismo que hace la regla estructural del lado del schema: no enumera lo que acepta.
      campos: new Map(m.fields.filter((f) => f.kind !== 'object').map((f) => [f.name, f.dbName || f.name])),
    },
  ]));
}

/**
 * Primera divergencia entre lo declarado y lo generado, o `null` si cuadran. Mira en LOS DOS
 * SENTIDOS: lo que falta en el cliente y lo que sobra.
 */
export function primeraDiscrepancia(delSchema, delCliente) {
  for (const [modelo, { tabla, campos }] of delSchema) {
    const enCliente = delCliente.get(modelo);
    if (!enCliente) return { direccion: 'falta', tipo: 'modelo', modelo };
    // LA TABLA PRIMERO: si el `FROM` no coincide, da igual lo que pase con las columnas —
    // ninguna lectura del modelo llega a ejecutarse.
    if (enCliente.tabla !== tabla) {
      return { direccion: 'tabla', tipo: 'modelo', modelo, tabla, tablaCliente: enCliente.tabla };
    }
    for (const [campo, columna] of campos) {
      const enClienteCol = enCliente.campos.get(campo);
      if (enClienteCol === undefined) return { direccion: 'falta', tipo: 'campo', modelo, campo, columna };
      // Mismo campo, DISTINTA columna: el cliente pedirá un nombre que la base no conoce. Esto
      // es invisible si se comparan nombres de campo, que es lo que se hacía hasta SCRUM-235.
      if (enClienteCol !== columna) {
        return { direccion: 'columna', tipo: 'campo', modelo, campo, columna, columnaCliente: enClienteCol };
      }
    }
  }
  // LA VUELTA (SCRUM-235): lo que el cliente tiene de MÁS. Es lo que mata las lecturas.
  for (const [modelo, { campos }] of delCliente) {
    const enSchema = delSchema.get(modelo);
    if (!enSchema) return { direccion: 'sobra', tipo: 'modelo', modelo };
    for (const [campo, columna] of campos) {
      if (!enSchema.campos.has(campo)) return { direccion: 'sobra', tipo: 'campo', modelo, campo, columna };
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
    tabla: [
      `   el modelo "${d.modelo}" apunta a TABLAS distintas:`,
      `     schema.prisma → "${d.tabla}"     ·     cliente → "${d.tablaCliente}"`,
      '',
      '   El `FROM` está en TODA lectura igual que la lista de columnas: el cliente consultará una',
      '   tabla que la base no tiene y fallará el 100% de las lecturas de este modelo.',
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
    '   El cliente ESTÁ generado — no falta: es de OTRO schema. Y hay DOS causas distintas, que',
    '   piden mirar en sitios distintos. Este mensaje solo nombraba la primera, y eso llevó a',
    '   diagnosticar mal una caída (SCRUM-429, 10-ago-2026):',
    '',
    '     (A) TU PROPIO CAMBIO DE RAMA. `prisma/schema.prisma` viaja con la rama y el cliente',
    '         generado NO. Cambias de rama o mergeas main, el schema gana una columna, y el',
    '         cliente que tenías se queda viejo sin que nadie más haya tocado nada.',
    '         Compruébalo:  git log -1 --format=%h -- prisma/schema.prisma',
    '',
    '     (B) OTRO WORKTREE, si tu `node_modules` acaba siendo el mismo que el suyo — por un',
    '         enlace (junction o symlink), o porque no tengas ninguno propio y Node resuelva el',
    '         del padre. Entonces el cliente es de todos y quien regenera último manda.',
    '         Compruébalo:  npm run topologia',
    '         (el `(Get-Item node_modules).LinkType` de antes solo ve el enlace: cuando no hay',
    '          `node_modules` que inspeccionar sale vacío y eso NO significa que sea tuyo.)',
    '',
    '   Arreglo, en los dos casos:  npm run prisma:generate   (desde ESTE worktree)',
    '',
    '   ⚠️ Y si es (B), regenerar ARREGLA EL TUYO Y ROMPE EL DE LOS DEMÁS: avisa antes.',
    '      SCRUM-351: esto ANTES se daba por hecho, y de darlo por hecho salió la restricción',
    '      «no regeneres» que en los cuatro worktrees de hoy NO aplica. Míralo, no lo supongas —',
    '      ni en un sentido ni en el otro. `npm run topologia` nombra con quién compartes, si',
    '      compartes, y dice NO SUPE MIRAR cuando no ha podido leerlo.',
    '',
  ].join('\n');
}

/**
 * SUELO contra el VERDE HUECO. Dos conjuntos vacíos **son iguales**, así que un schema del que no
 * se extrae ningún modelo (fichero movido, truncado, regex rota) frente a un cliente sin DMMF
 * daría `null` — o sea ✔ — sin haber comparado un solo modelo. En un guard de integridad ese es
 * el peor resultado posible, y no es hipotético: es la misma forma que el suelo de la huella de
 * SCRUM-239 y el de los escáneres de SCRUM-233.
 *
 * No lleva número mágico: **cero modelos no es un repo, es un fallo de lectura.**
 */
function sinDatos(delSchema, delCliente) {
  if (delSchema.size === 0) return 'no se ha extraído NINGÚN modelo de schema.prisma';
  if (delCliente.size === 0) return 'el cliente de Prisma no declara NINGÚN modelo (¿sin generar?)';
  return null;
}

/** Devuelve `{ ok }` o `{ ok:false, mensaje }`. No imprime ni sale: eso lo decide el llamador. */
export async function comprobarCliente({ schemaPath, rutaCliente } = {}) {
  const texto = fs.readFileSync(schemaPath || path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
  const delSchema = modelosDelSchema(texto);
  const delCliente = await modelosDelCliente(rutaCliente);

  const vacio = sinDatos(delSchema, delCliente);
  if (vacio) {
    return {
      ok: false,
      mensaje: [
        '',
        '🔴 NO SE PUEDE COMPARAR EL CLIENTE DE PRISMA CON schema.prisma',
        '',
        `   ${vacio}.`,
        '',
        '   Esto NO es «todo bien»: sin datos que comparar, un verde no significaría nada — dos',
        '   conjuntos vacíos son iguales. Falla cerrado a propósito.',
        '',
        '   Mira que `prisma/schema.prisma` esté donde debe y que el cliente esté generado:',
        '     npx prisma generate   (desde ESTE worktree)',
        '',
      ].join('\n'),
    };
  }

  const d = primeraDiscrepancia(delSchema, delCliente);
  return d ? { ok: false, mensaje: mensaje(d) } : { ok: true };
}

// Uso directo:  node scripts/_prisma-client-guard.mjs [rutaClienteAlternativo]
/**
 * ¿Se está ejecutando este fichero COMO SCRIPT (y no importado)?
 *
 * ⚠️ NO se comparan `import.meta.url` y `argv[1]` por texto: la URL viene PERCENT-ENCODEADA y el
 * argv no, así que en cualquier ruta con un espacio o un acento —`OneDrive - Empresa`, `Mi
 * unidad`, `Documentos compartidos`— la comparación daba `false` y este fichero se convertía en
 * un **NO-OP SILENCIOSO con exit 0**: el `pretest` de las tres tandas «pasaba» sin haber
 * comparado nada, sin imprimir una línea.
 *
 * Un guard que no mide nada y sale verde es peor que no tenerlo, así que esto se exporta para
 * poder probarlo: el test lo ejercita con una ruta con espacio, que es donde se rompía.
 */
export function esInvocacionDirecta(metaUrl, argv1) {
  if (!argv1) return false;
  try {
    return fileURLToPath(metaUrl) === path.resolve(argv1);
  } catch {
    return false;
  }
}

const invocadoDirecto = esInvocacionDirecta(import.meta.url, process.argv[1]);
if (invocadoDirecto) {
  const r = await comprobarCliente({ rutaCliente: process.argv[2] });
  if (!r.ok) {
    console.error(r.mensaje);
    process.exit(1); // salida inmediata: nada de seguir compilando sobre un cliente que no es
  }
  console.log('✔ el cliente de Prisma coincide con schema.prisma (columnas, en los dos sentidos)');
}
