// tests/_inventario-detalle-trabajo.mjs — SCRUM-817
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// TODO LO QUE SE PUEDE HACER EN EL DETALLE DEL TRABAJO, ENUMERADO.
//
// 🔴 POR QUÉ EXISTE. Reordenar una pantalla no puede perder una función por el camino, y este
// proyecto ya estuvo a punto: sacar el selector de fecha de la lista de Trabajos habría borrado
// **la única forma de agendar un trabajo en todo el producto**, y sólo se vio porque alguien lo
// midió antes de ejecutar la decisión.
//
// Un «se ve igual» no sirve como control: lo que hay que conservar no es el aspecto, son las
// ACCIONES. Aquí se cuentan sobre el DOM MONTADO —no sobre el fuente— porque lo que importa es
// lo que el jefe tiene delante, no lo que el fichero contiene.
//
// ⚠️ La identidad de una acción NO es su posición ni su texto visible: es su GANCHO —el
// `data-*`, el `id`, o el par (etiqueta, tipo)—. Si fuera el texto, cambiar un rótulo aprobado
// contaría como perder una función; si fuera la posición, reordenar contaría como perderlas
// todas, y este censo existe justamente para poder reordenar.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { todos } from './_banco-vistas.mjs';

/** Los atributos que identifican una acción, en orden de preferencia. */
const GANCHOS = ['data-abrir-parte', 'data-accion', 'data-testid', 'id', 'name', 'aria-label'];

const INTERACTIVOS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);

/** ¿Cómo se llama esta acción, de forma estable frente a un reorden? */
export function ganchoDe(n) {
  for (const a of GANCHOS) {
    const v = n.getAttribute && n.getAttribute(a);
    if (v) return `${a}=${v}`;
  }
  const tipo = n.getAttribute && n.getAttribute('type');
  const texto = String(n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return `${n.tagName}${tipo ? `[${tipo}]` : ''}${texto ? `:${texto}` : ''}`;
}

/**
 * El inventario de acciones del árbol montado.
 *
 * 🔴 SUELO: si sale vacío LANZA. Cero acciones no es «esta pantalla no hace nada»: es que no se
 * ha montado, y comparar dos ceros daría un verde que sólo dice que no se miró — el defecto que
 * este repo lleva media docena de tickets desterrando.
 */
export function inventario(raizDom) {
  const nodos = todos(raizDom);
  const acciones = nodos
    .filter((n) => INTERACTIVOS.has(String(n.tagName || '').toUpperCase()))
    .map(ganchoDe);
  if (!acciones.length) {
    throw new Error('[inventario] SUELO: CERO acciones en el árbol montado. Eso no es «la pantalla '
      + 'no ofrece nada»: es que no se ha pintado, y un censo vacío comparado con otro vacío da un '
      + 'verde hueco.');
  }
  return acciones.sort();
}

/** Lo que hay en `antes` y ya no está en `despues`. Es lo único que el reorden no puede producir. */
export function perdidas(antes, despues) {
  const hay = new Map();
  for (const d of despues) hay.set(d, (hay.get(d) || 0) + 1);
  const fuera = [];
  for (const a of antes) {
    const n = hay.get(a) || 0;
    if (n > 0) hay.set(a, n - 1);
    else fuera.push(a);
  }
  return fuera;
}
