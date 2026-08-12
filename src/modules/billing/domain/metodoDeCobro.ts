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

/** La clave del cubo de «no consta». Un valor sin clasificar cae aquí, y NO desaparece. */
export const CUBO_SIN_METODO = 'sin-metodo';

/**
 * Los RÓTULOS aprobados por el asesor el 10-ago-2026 (regla 30). No se reescriben aquí.
 *
 * `bizum_auto` y `bizum_manual` comparten el rótulo «Bizum» a propósito: la distinción es NUESTRA
 * —confirmado por la pasarela frente a dicho por el profesional— y el diseño nombra cuatro métodos
 * porque el profesional piensa en cuatro. La distinción no se pierde: se lee en la fila.
 */
const ROTULOS: Readonly<Record<string, string>> = Object.freeze({
  card: 'tarjeta',
  bizum_auto: 'Bizum',
  bizum_manual: 'Bizum',
  transfer: 'transferencia',
  cash: 'efectivo',
});

export interface CuboDeMetodo {
  clave: string;
  rotulo: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * LAS OPCIONES DEL FILTRO, DERIVADAS DE `PAID_VIA` — SCRUM-474 fase 2
 *
 * Vive aquí y no en la vista por dos motivos que ya costaron un ticket:
 *
 *  ① `cobrosView.js` tenía una lista escrita a mano (`COBROS_METODOS`) que decidía qué valor cae
 *     en qué cubo. Eso es el conjunto cerrado de la regla 22 **duplicado en el front**, donde no lo
 *     vigila nadie — y el front no puede decidir nada fiscal.
 *
 *  ② Las cuatro opciones salen SIEMPRE, haya o no cobros de cada una. Derivarlas de los datos le
 *     quitaría el filtro de Bizum a quien todavía no ha cobrado por Bizum, y entonces no podría
 *     distinguir **«no tengo»** de **«no existe la opción»**.
 *
 * `sin-metodo` va SIEMPRE y el último: un cobro cuyo método no consta no puede desaparecer de una
 * pantalla de dinero. Su rótulo no es «Otro» —«otro» AFIRMA que hubo un método distinto— sino
 * «Método no registrado», que es lo que de verdad pasa.
 */
/**
 * 🔴 EL ORDEN ES PARTE DE LO APROBADO, y no es el de `PAID_VIA`.
 *
 * El diseño §B4 los nombra «Bizum · tarjeta · transferencia · efectivo» y así los aprobó el asesor;
 * `PAID_VIA` empieza por `card` porque su orden responde a otra cosa —el vocabulario fiscal— y no
 * a cómo se le enseñan al profesional. Derivar el orden de ahí cambiaba la barra de filtros sin que
 * nadie lo hubiera decidido, y lo cazó el test de SCRUM-285 que compara la lista carácter a carácter.
 *
 * La PERTENENCIA sigue derivándose de `PAID_VIA`: esto solo dice en qué orden se pintan. Un valor
 * del conjunto que no esté aquí no desaparece — se queda sin sitio en la barra y eso salta abajo.
 */
const ORDEN_APROBADO = ['bizum_auto', 'bizum_manual', 'card', 'transfer', 'cash'] as const;

export function cubosDeMetodo(rotuloSinMetodo: string): CuboDeMetodo[] {
  const vistos = new Set<string>();
  const out: CuboDeMetodo[] = [];
  // Se recorre el orden aprobado, pero solo entran los que el conjunto cerrado reconoce: si alguien
  // quita un valor de `PAID_VIA`, su filtro desaparece de la barra en vez de quedarse huérfano.
  const enOrden = ORDEN_APROBADO.filter((v) => (PAID_VIA as readonly string[]).includes(v));
  // Y si `PAID_VIA` estrena un valor que nadie ha ordenado, va al final: no se pierde en silencio.
  const sinOrdenar = (PAID_VIA as readonly string[]).filter((v) => !(ORDEN_APROBADO as readonly string[]).includes(v));
  for (const via of [...enOrden, ...sinOrdenar]) {
    const rotulo = ROTULOS[via];
    if (!rotulo || vistos.has(rotulo)) continue;   // «Bizum» sale una vez, no dos
    vistos.add(rotulo);
    out.push({ clave: via === 'bizum_auto' || via === 'bizum_manual' ? 'bizum' : via, rotulo });
  }
  out.push({ clave: CUBO_SIN_METODO, rotulo: rotuloSinMetodo });
  return out;
}

/**
 * A qué cubo cae un cobro, y con qué texto se pinta su celda.
 *
 * 🔴 SCRUM-481 · LA COLUMNA Y EL FILTRO HABLABAN DOS IDIOMAS. La celda enseñaba el valor CRUDO
 * —«card:stripe»— mientras el filtro de al lado decía «tarjeta»: el profesional pulsaba «tarjeta»
 * y le salían filas que ponían `card`. Enseñarle el valor de la columna de la base de datos no es
 * un rótulo que falta: es hablarle en el idioma de la tabla.
 *
 * El texto aprobado es «tarjeta · Stripe» cuando hay pasarela y «tarjeta» a secas cuando no. **No
 * se pierde ningún dato que hoy exista**, y la asimetría es informativa: ver «· Stripe» en unas
 * filas y no en otras dice de un vistazo cuáles entraron por ahí.
 */
export function cuboYEtiqueta(valor: unknown, rotuloSinMetodo: string): { cubo: string; etiqueta: string } {
  const agrupado = metodoParaAgrupar(valor);
  if (!agrupado) return { cubo: CUBO_SIN_METODO, etiqueta: rotuloSinMetodo };

  const clave = agrupado === 'bizum_auto' || agrupado === 'bizum_manual' ? 'bizum' : agrupado;
  const rotulo = ROTULOS[agrupado];
  const pasarela = partirMetodo(valor)?.pasarela ?? null;
  // La pasarela se enseña con su inicial en mayúscula: es un nombre propio («Stripe»), no una
  // etiqueta interna. El valor guardado NO se toca — esto es solo cómo se pinta.
  const bonita = pasarela ? pasarela.charAt(0).toUpperCase() + pasarela.slice(1) : null;
  return { cubo: clave, etiqueta: bonita ? `${rotulo} · ${bonita}` : rotulo };
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
