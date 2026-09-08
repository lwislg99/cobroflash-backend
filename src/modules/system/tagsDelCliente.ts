// src/modules/system/tagsDelCliente.ts — SCRUM-580 (CONT-07)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS ETIQUETAS DEL CONTACTO · LA PARTE QUE DECIDE, SIN BASE Y SIN DOM
//
// El profesional no podía agrupar a sus clientes por nada. En oficios eso es comunidad ·
// administrador · aseguradora · urgencias · moroso. Con 300 clientes, buscar por texto el nombre
// de una comunidad no sustituye a filtrar por «administrador».
//
// ── 🔴 «AUSENTE ≠ VACÍO», Y ES TODO EL DISEÑO DE ESTE FICHERO ───────────────────────────────
// Sin etiquetas se guarda **`null`**, nunca `[]` ni `""`. No es una preferencia de estilo:
//
//   · `null` = «no se declararon etiquetas»
//   · `[]`   = «se miraron y no hay ninguna»
//
// Si se guardara `[]`, un `IS NOT NULL` diría que **ese cliente tiene etiquetas** — y el filtro de
// la lista se construiría sobre esa mentira. Es la misma familia del `resolveTipoDestinatario` que
// costó 16 días de semáforo mintiendo (SCRUM-615): un valor por defecto que borra la diferencia
// entre «no lo sé» y «sé que no hay».
//
// ── POR QUÉ VIVE APARTE Y ES PURO ───────────────────────────────────────────────────────────
// Para poder ejercitar los rojos en `npm test` sin base y sin navegador. El filtro de la lista
// (`public/dashboard/js/filtroClientes.js`) implementa la MISMA decisión en el navegador; que no
// diverjan lo sostiene un test que compara las dos con los mismos casos.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Tope por etiqueta. Una etiqueta no es una nota: si no cabe en la columna, no es una etiqueta. */
export const LARGO_MAXIMO = 40;

/** Tope de etiquetas por cliente. */
export const MAXIMO_POR_CLIENTE = 20;

/**
 * Normaliza lo que llega del formulario a lo que se guarda.
 *
 * `undefined` se respeta y devuelve `undefined`: en una actualización parcial significa «no toques
 * este campo», y confundirlo con «bórralo» sería perder las etiquetas de un cliente al editarle el
 * teléfono. Es la misma regla que ya aplica `normalizarIdentificadores` con `phone`.
 *
 * Todo lo demás que quede vacío —`null`, `[]`, `['', '  ']`— se guarda como **`null`**. Ver arriba.
 *
 * Se recortan los espacios y se quitan los duplicados **sin distinguir mayúsculas**: «Moroso» y
 * «moroso» son la misma etiqueta para un profesional, y guardar las dos partiría su lista en dos
 * grupos que él ve como uno. Se conserva **la primera grafía escrita**, no una versión en
 * minúsculas: la etiqueta es suya y se le enseña como la escribió.
 */
export function normalizarTags(valor: unknown): string[] | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  if (!Array.isArray(valor)) return null;

  const vistas = new Set<string>();
  const fuera: string[] = [];
  for (const bruto of valor) {
    if (typeof bruto !== 'string') continue;
    const limpia = bruto.trim().slice(0, LARGO_MAXIMO);
    if (!limpia) continue;
    const clave = limpia.toLocaleLowerCase('es');
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    fuera.push(limpia);
    if (fuera.length >= MAXIMO_POR_CLIENTE) break;
  }
  return fuera.length ? fuera : null;
}

/**
 * Las etiquetas de un cliente, leídas de la columna JSONB **con suelo**.
 *
 * Lo que no sea una lista de cadenas devuelve `[]`, no revienta: la columna es JSONB y alguien
 * podría meter cualquier cosa por otra vía. Una pantalla que se cae al pintar un cliente es peor
 * que una que enseña ese cliente sin etiquetas.
 */
export function tagsDe(cliente: unknown): string[] {
  const v = (cliente as { tags?: unknown } | null | undefined)?.tags;
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
}

/**
 * ¿Este cliente lleva esta etiqueta? **Sin distinguir mayúsculas ni acentos de espaciado.**
 *
 * 🔴 Y sin `||` ni `??` que hagan «caer» a nadie en un grupo que no eligió: un cliente sin
 * etiquetas no lleva NINGUNA, y eso es correcto. El apaño de «si no tiene, que salga en todas» es
 * exactamente lo que convierte un filtro en un adorno.
 */
export function tieneTag(cliente: unknown, tag: string): boolean {
  const buscada = String(tag ?? '').trim().toLocaleLowerCase('es');
  if (!buscada) return false;
  return tagsDe(cliente).some((t) => t.trim().toLocaleLowerCase('es') === buscada);
}

/**
 * Todas las etiquetas que este merchant YA usa en sus propios clientes, ordenadas.
 *
 * Es la fuente del autocompletado, y **sale de la lista que ya se le ha enviado a esa pantalla**:
 * nunca de otro merchant. Aquí no hay consulta ni `merchantId` que filtrar porque no hace falta —
 * lo que entra es lo que el servidor ya acotó por tenencia (regla 2), y no ampliar el alcance es
 * la forma más segura de no filtrarlo.
 */
export function tagsUsadas(clientes: readonly unknown[] | null | undefined): string[] {
  const vistas = new Map<string, string>();
  for (const c of Array.isArray(clientes) ? clientes : []) {
    for (const t of tagsDe(c)) {
      const clave = t.trim().toLocaleLowerCase('es');
      if (!vistas.has(clave)) vistas.set(clave, t.trim());
    }
  }
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}
