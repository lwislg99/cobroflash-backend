// src/modules/billing/domain/metodoDeCobro.ts — SCRUM-474 / SCRUM-473
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// `Charge.method` HACÍA DOS TRABAJOS, Y POR ESO EL CONJUNTO CERRADO NO SE PODÍA EXIGIR
//
// Censo del 11-ago-2026: **9 puntos de escritura**, y entre ellos dos etiquetas para la tarjeta
// que no son sinónimos —`card` es la PREFERENCIA que elige el profesional al crear el cobro
// (`charges.routes.ts:37`) y `card:stripe` es el HECHO consumado que escribe la pasarela—. Más
// `bank` y `mp`, que no están en `PAID_VIA` y no aparecen en los datos de producción **porque
// viven en el árbol y todavía no se han ejercido**.
//
// ⚠️ El AST solo veía 2 de los 9: los otros 7 escriben dentro de objetos anidados. Un guard
// calibrado con ese primer censo habría cubierto el 22 % de los escritores.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA FORMA, decidida por el fundador (11-ago-2026)
//
//     <metodo>            ó   <metodo>:<pasarela>
//
// con `<metodo>` **obligatoriamente en `PAID_VIA`**. Así el conjunto cerrado (regla 22) se vuelve
// exigible **sin columna nueva y sin perder la pasarela**: `card:stripe` pasa porque `card` está
// en el conjunto, y la pasarela —que hoy solo vive en esa etiqueta— no se destruye.
//
// 🔴 SE CONSUME `PAID_VIA`, NO UNA COPIA. Una segunda lista es exactamente cómo esto vuelve a
// pasar dentro de tres meses — y sería el defecto que este ticket denuncia, cometido en su arreglo.
import { PAID_VIA, type PaidVia } from './paidVia';

/** El valor que se guarda cuando NO consta cómo entró el dinero. Se declara, no se adivina. */
export const METODO_DESCONOCIDO = 'desconocido';

export interface MetodoPartido {
  metodo: string;
  pasarela: string | null;
}

/** Parte `card:stripe` en sus dos mitades. No juzga: solo separa. */
export function partirMetodo(valor: unknown): MetodoPartido | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim().toLowerCase();
  if (limpio === '') return null;
  const i = limpio.indexOf(':');
  if (i === -1) return { metodo: limpio, pasarela: null };
  const metodo = limpio.slice(0, i);
  const pasarela = limpio.slice(i + 1);
  if (metodo === '' || pasarela === '') return null;
  return { metodo, pasarela };
}

/**
 * ¿Es un valor válido para `Charge.method`?
 *
 * El método tiene que estar en `PAID_VIA` —importado, no copiado—; la pasarela es libre porque no
 * hay un conjunto cerrado de pasarelas y **inventarlo cerraría la puerta a la siguiente**.
 */
export function esMetodoValido(valor: unknown): boolean {
  const p = partirMetodo(valor);
  if (!p) return false;
  return (PAID_VIA as readonly string[]).includes(p.metodo);
}

/**
 * El método NORMALIZADO para agrupar al leer: `card:stripe` y `card` caen en el mismo cubo.
 *
 * Esto es lo que arregla el defecto que el profesional ve HOY —el filtro de Cobros parte las
 * tarjetas en dos— **sin tocar un solo dato**. Los 38 de 51 cobros repartidos en dos etiquetas
 * pasan a contarse juntos.
 *
 * Devuelve `null` para lo que no se puede clasificar: eso alimenta el cubo «Método no registrado»
 * de SCRUM-285, que dice la verdad — «no consta» — en vez de «otro», que afirmaría que hubo un
 * método distinto.
 */
export function metodoParaAgrupar(valor: unknown): PaidVia | null {
  const p = partirMetodo(valor);
  if (!p) return null;
  return (PAID_VIA as readonly string[]).includes(p.metodo) ? (p.metodo as PaidVia) : null;
}

/**
 * Traduce el `payment_type_id` de MercadoPago a nuestro vocabulario.
 *
 * ⚠️ `mercadopago.ts` guardaba ese campo **CRUDO** cuando venía, así que por ahí podía entrar
 * cualquier valor de MP que no es de `PAID_VIA` — el escritor con más fuga de los nueve. Lo que no
 * se reconoce NO se inventa: se declara desconocido, igual que hace `paidViaDesdeStripe`.
 */
export function metodoDesdeMercadoPago(tipo: string | null | undefined): string {
  switch ((tipo || '').toLowerCase().trim()) {
    case 'credit_card':
    case 'debit_card':
    case 'prepaid_card':
      return 'card:mercadopago';
    case 'bank_transfer':
      return 'transfer:mercadopago';
    case 'ticket':
    case 'atm':
      return 'cash:mercadopago';
    default:
      // Incluye el caso en que MP no manda `payment_type_id`: «no consta el tipo», y así se guarda.
      return METODO_DESCONOCIDO;
  }
}
