// scripts/_prisma-client-guard.mjs — SCRUM-190
//
// ⚠️ COINCIDENCIA, NO PRESENCIA. Comprobar que el cliente de Prisma "existe" no vale para nada:
// el fallo que muerde es un cliente que SÍ está, recién generado y flamante, pero **desde otro
// `schema.prisma`**. Eso da verde y luego revienta el build en sitios que no parecen
// relacionados.
//
// Pasó el 27-jul-2026: regeneré el cliente desde el repo principal, que estaba en otra rama con
// un schema más viejo, y `tsc` empezó a fallar por `decisionToken` y por una relación que "no
// existía". El cliente estaba ahí. Un guard de presencia habría dicho que todo bien.
//
// Y es fácil de provocar sin querer, porque `node_modules` se comparte por JUNCTION entre todos
// los worktrees: quien regenera, regenera para todos (incidente #11 de `docs/ERRORES_ASESOR.md`).
//
// QUÉ COMPRUEBA: que cada modelo y cada campo escalar declarado en `schema.prisma` esté también
// en el cliente generado (su DMMF). Al revés no: un cliente con cosas de MÁS es el caso normal
// cuando alguien acaba de quitar un campo del schema y aún no ha regenerado — molesto pero
// inofensivo, y hacerlo fallar convertiría el guard en ruido. Falla lo que rompe el build.
//
// MENSAJE ÚNICO Y SALIDA INMEDIATA: se informa de la PRIMERA diferencia y se para. Veinte
// diferencias son la misma causa contada veinte veces (el cliente es de otro schema) y quien lo
// lea a las once de la noche necesita saber qué hacer, no un inventario.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Modelos y campos ESCALARES declarados en el schema, parseados del texto.
 *
 * Se lee el fichero y no el DMMF del propio Prisma a propósito: el DMMF sale de la última
 * generación, o sea del artefacto que precisamente estamos poniendo en duda. Preguntarle al
 * sospechoso no sirve.
 */
export function modelosDelSchema(textoSchema) {
  const out = new Map();
  const bloques = textoSchema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm);
  for (const m of bloques) {
    const campos = [];
    for (const linea of m[2].split('\n')) {
      const t = linea.trim();
      if (!t || t.startsWith('//') || t.startsWith('@@') || t.startsWith('///')) continue;
      const campo = t.match(/^(\w+)\s+(\w+)/);
      if (!campo) continue;
      const tipo = campo[2];
      // Las RELACIONES no viajan igual en el DMMF escalar; el guard mira campos propios, que es
      // lo que rompe `tsc` cuando el cliente va desfasado.
      if (/^[A-Z]/.test(tipo) && !['String', 'Int', 'Boolean', 'DateTime', 'Float', 'Decimal', 'Json', 'BigInt', 'Bytes'].includes(tipo)) continue;
      campos.push(campo[1]);
    }
    out.set(m[1], campos);
  }
  return out;
}

/** Primera discrepancia entre lo declarado y lo generado, o `null` si todo cuadra. */
export function primeraDiscrepancia(delSchema, delCliente) {
  for (const [modelo, campos] of delSchema) {
    const enCliente = delCliente.get(modelo);
    if (!enCliente) return { tipo: 'modelo', modelo };
    for (const campo of campos) {
      if (!enCliente.includes(campo)) return { tipo: 'campo', modelo, campo };
    }
  }
  return null;
}

export function mensaje(d) {
  const qué = d.tipo === 'modelo'
    ? `el modelo "${d.modelo}" no existe en el cliente generado`
    : `el campo "${d.modelo}.${d.campo}" no existe en el cliente generado`;
  return [
    '',
    '🔴 EL CLIENTE DE PRISMA NO CORRESPONDE A schema.prisma',
    '',
    `   ${qué}.`,
    '',
    '   El cliente ESTÁ generado — no falta: es de OTRO schema. Suele pasar al regenerarlo desde',
    '   un worktree que está en otra rama, y como `node_modules` se comparte por junction, afecta',
    '   a todas las sesiones a la vez.',
    '',
    '   Arreglo:  npx prisma generate   (desde ESTE worktree)',
    '',
  ].join('\n');
}

/** Campos del cliente generado, sacados de su DMMF. `rutaCliente` permite apuntar a otro. */
async function modelosDelCliente(rutaCliente) {
  const mod = await import(rutaCliente || '@prisma/client');
  const modelos = mod.Prisma?.dmmf?.datamodel?.models || [];
  return new Map(modelos.map((m) => [m.name, m.fields.map((f) => f.name)]));
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
  console.log('✔ el cliente de Prisma coincide con schema.prisma');
}
