// tests/_where-como-prisma.mjs — SCRUM-1315
//
// ¿CASA UNA FILA CON UN `where`? COMO PRISMA, O LANZA SI NO SABE.
//
// Es el evaluador que `tests/scrum1303-estado-dentro-del-where.test.mjs` lleva dentro, sacado a un
// módulo cuando lo necesitó un segundo fichero. Un doble de la base que ignora parte del `where`
// no mide de menos: mide OTRA COSA. Con uno que mirase sólo el `id`, un arreglo que metiera el
// estado en el `where` daría exactamente el mismo resultado que no haberlo metido (SCRUM-1292,
// donde el doble ignoraba el `id`).
//
// 🔴 SU LÍMITE, DICHO: sabe igualdad, `OR`, y los operadores `not`, `in` y `notIn` sobre valores
// escalares. Cualquier otro operador —`contains`, `gt`, `AND`, un `not` con objeto dentro— LANZA.
// No se le enseña «por si acaso»: se le enseña cuando el código de producción lo use, y con su caso
// en el suelo del test que lo necesite.
//
// ⚠️ `scrum1303` sigue llevando su copia: es de otro carril y no se toca desde este ticket. Si se
// migra a éste, que sea en su propio cambio.

/** ¿Casa la fila con este `where`? Lanza con un operador que no conozca. */
export function casa(fila, where = {}) {
  return Object.entries(where).every(([k, v]) => {
    if (v === undefined) return true;
    if (k === 'OR') return v.some((w) => casa(fila, w));
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      return Object.entries(v).every(([op, x]) => {
        if (op === 'not' && (x === null || typeof x !== 'object')) return fila[k] !== x;
        if (op === 'in' && Array.isArray(x)) return x.includes(fila[k]);
        if (op === 'notIn' && Array.isArray(x)) return !x.includes(fila[k]);
        throw new Error(`🔴 EL DOBLE NO SABE EVALUAR \`${k}: { ${op} }\`. Enséñaselo; no lo des por bueno.`);
      });
    }
    return fila[k] === v;
  });
}

/** El error que da Prisma cuando un `update` no encuentra la fila de su `where`. */
export function filaNoEncontrada() {
  const e = new Error('Record to update not found.');
  e.code = 'P2025';
  return e;
}
