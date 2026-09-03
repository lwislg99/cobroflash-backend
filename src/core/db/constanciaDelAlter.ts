// src/core/db/constanciaDelAlter.ts — SCRUM-687
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA CONSTANCIA DE QUE EL `ALTER` ESTÁ APLICADO · Y QUIEN LA DA ES PRODUCCIÓN
//
// ── LA VÍCTIMA, que no es hipotética ────────────────────────────────────────────────────────
// Producción estuvo NUEVE DÍAS sin desplegar. Tres veces se mergeó el esquema (paso ③) sin haber
// aplicado el `ALTER` en las bases (paso ②), y `schemaDrift` se negó a arrancar —correctamente—.
// Nadie lo vio: un healthcheck fallido deja vivo el despliegue anterior, así que el síntoma es
// «no cambia nada». Durante nueve días, todo lo que el equipo mergeó no llegó a ningún fontanero.
//
// El vigía de SCRUM-677 mira que producción no se quede por detrás de `main`. Esto mira la otra
// mitad, la que lo CAUSÓ: el `ALTER` que nadie aplicó, y lo mira ANTES de mergear.
//
// ── 🔴 POR QUÉ LA EVIDENCIA LA DA PRODUCCIÓN Y NO EL AUTOR DEL PR ───────────────────────────
// Las otras salidas que se estudiaron eran todas autocertificación: un fichero de constancia lo
// escribe el mismo PR que hace el cambio, y `deriva-prod.sql` se GENERA DESDE EL ESQUEMA — o sea
// que preguntarle si el `ALTER` está aplicado es consultar justo el valor que el defecto
// falsifica. Cero evidencia.
//
// Aquí CI manda el conjunto ESPERADO y producción contesta **qué falta**. La respuesta la produce
// el catálogo de la base, leído EN LA PETICIÓN. Nunca un fichero del repo: si el vigía leyera el
// estado de producción desde algo que viaja en el repo, repetiría un nivel más abajo el problema
// que viene a resolver.
//
// ── LO QUE **NO** SE PUBLICA, y es lo que hace tolerable la superficie nueva ────────────────
// No sale la lista real de tablas y columnas. Sólo **el espejo de lo que le mandan**: de las
// columnas enviadas, cuáles no están. Quien pregunta no se lleva nada que no trajera ya.
//
// 🕳️ El agujero que queda, declarado: se puede ENUMERAR SONDEANDO, preguntando de una en una. Es
// más lento y mucho más ruidoso que un volcado, y ahora además exige el secreto. No se tapa aquí.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Una columna esperada, tal como la manda CI: `tabla.columna`.
 *
 * Se usa la forma PLANA —una cadena— y no un objeto, a propósito: es la misma clave con la que
 * `schemaDrift` compara (`${tabla}.${columna}`), así que las dos mitades del problema hablan el
 * mismo idioma y nadie tiene que traducir en el medio.
 */
export type ColumnaEsperada = string;

/** El límite de columnas que se aceptan en una petición. */
export const TOPE_ESPERADAS = 5000;

export type Constancia =
  | { ok: true; faltan: string[]; comparadas: number }
  | { ok: false; motivo: string; comparadas: 0 };

/**
 * 🔴 LA CONSULTA. Es una COPIA DECLARADA de la de `src/core/db/schemaDrift.ts`, y la copia está
 * forzada: ese fichero no la exporta y **no se puede tocar** (es el arranque, y hoy fue lo único
 * que funcionó). Duplicarla es el precio; que no diverja lo sostiene un trinquete —
 * `tests/scrum687-constancia-del-alter.test.mjs` compara las dos cadenas y cae si dejan de ser
 * la misma. Sin ese trinquete, esta constancia podría mirar un esquema distinto del que mira el
 * arranque y las dos darían verdes que no significan lo mismo.
 */
export const CONSULTA_COLUMNAS = `
  SELECT table_name AS tabla, column_name AS columna
  FROM information_schema.columns
  WHERE table_schema = current_schema()
`;

/**
 * El veredicto. **PURO**: entran las esperadas y las reales, sale qué falta.
 *
 * Separarlo de la base es lo que permite ejercitar los tres controles obligatorios —positivo,
 * suelo y negativo— en milisegundos y sin producción delante. Un guard que sólo se pudiera probar
 * contra producción es un guard que no ejercita nadie.
 *
 * @param esperadas  lo que CI dice que el código va a nombrar
 * @param reales     lo que el catálogo devolvió, en la MISMA forma `tabla.columna`
 */
export function compararConstancia(
  esperadas: readonly unknown[] | null | undefined,
  reales: readonly string[] | null | undefined,
): Constancia {
  // ── 🔴 EL SUELO, Y VA PRIMERO ───────────────────────────────────────────────────────────
  // Un conjunto vacío NO puede dar «no falta nada». «No hay columnas que falten» y «no me han
  // preguntado por ninguna» son el mismo `faltan: []` con significados opuestos, y el segundo
  // disfrazado del primero es exactamente cómo se pierde una semana.
  if (!Array.isArray(esperadas) || esperadas.length === 0) {
    return {
      ok: false, comparadas: 0,
      motivo: 'no se envió NINGUNA columna esperada. Un «no falta nada» sobre cero comparaciones '
        + 'no es una comprobación: es una pregunta que no se hizo.',
    };
  }
  if (esperadas.length > TOPE_ESPERADAS) {
    return {
      ok: false, comparadas: 0,
      motivo: `se enviaron ${esperadas.length} columnas y el tope es ${TOPE_ESPERADAS}.`,
    };
  }

  // Cada entrada tiene que ser `tabla.columna`. Lo que no se sabe leer se RECHAZA: dar por buena
  // una entrada ilegible la contaría como «comparada» sin haberla mirado.
  const limpias: string[] = [];
  for (const e of esperadas) {
    if (typeof e !== 'string') {
      return { ok: false, comparadas: 0, motivo: 'hay entradas que no son cadenas `tabla.columna`.' };
    }
    const v = e.trim();
    if (!/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(v)) {
      return { ok: false, comparadas: 0, motivo: `«${v.slice(0, 60)}» no tiene la forma \`tabla.columna\`.` };
    }
    limpias.push(v);
  }

  // ── Y EL SUELO DEL OTRO LADO: si el catálogo no devolvió nada, no se puede afirmar nada ──
  // Es el mismo criterio que `schemaDrift`: con cero columnas reales, o la conexión apunta a otro
  // esquema o no se pudo leer. En ninguno de los dos casos «faltan todas» sería cierto.
  if (!Array.isArray(reales) || reales.length === 0) {
    return {
      ok: false, comparadas: 0,
      motivo: 'el catálogo no devolvió NINGUNA columna. O la conexión apunta a un esquema que no '
        + 'es el de la app, o no se pudo leer `information_schema`. No es «faltan todas».',
    };
  }

  const real = new Set(reales);
  // Se deduplica lo enviado: si CI manda dos veces la misma columna, `comparadas` tiene que ser
  // el número de columnas DISTINTAS miradas, no el de líneas del cuerpo.
  const unicas = [...new Set(limpias)];
  const faltan = unicas.filter((c) => !real.has(c)).sort();
  return { ok: true, faltan, comparadas: unicas.length };
}

/**
 * El mensaje que se lee en el PR. **OBSERVA, NO AFIRMA.**
 *
 * «el esquema está aplicado» es una afirmación en presente sobre el mecanismo que no dice nada
 * sobre si lo está — nos ha mordido dos veces esta semana. Lo que se escribe son las lecturas:
 * cuántas se preguntaron, cuántas faltan y CUÁLES.
 */
export function mensajeDeConstancia(c: Constancia): string {
  if (!c.ok) return `⚠️ NO PUDE COMPARAR: ${c.motivo}`;
  if (c.faltan.length === 0) {
    return `producción responde que no le falta ninguna de las ${c.comparadas} columnas preguntadas`;
  }
  // Se nombran TODAS, no una muestra: quien lee esto tiene que poder escribir el `ALTER` sin
  // volver a preguntar. Con un tope alto, porque una lista larga sigue siendo más útil que un
  // «y 37 más» que obliga a otra vuelta.
  const lista = c.faltan.slice(0, 100).join(', ');
  const resto = c.faltan.length > 100 ? ` … y ${c.faltan.length - 100} más` : '';
  return `producción no tiene ${c.faltan.length} de las ${c.comparadas} columnas preguntadas: ${lista}${resto}`;
}
