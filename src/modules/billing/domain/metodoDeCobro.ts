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
 * El rótulo de ese cubo, APROBADO por el asesor el 10-ago-2026 (regla 30).
 *
 * NO es «Otro»: «otro» AFIRMA que hubo un método distinto, y aquí no consta ninguno. Vive UNA vez
 * —lo consumen el arranque y el servicio— porque dos copias de un texto es cómo dos pantallas
 * acaban llamando cosas distintas a lo mismo.
 */
export const ROTULO_SIN_METODO = 'Método no registrado';

export interface CuboDeMetodo {
  clave: string;
  rotulo: string;
  /** En qué posición se pinta en la barra de filtros. Es propiedad DEL CUBO, no del método. */
  orden: number;
}

/** Una entrada de la tabla: el cubo al que cae el método, más lo que solo sabe el método. */
interface EntradaDeMetodo extends CuboDeMetodo {
  /**
   * ¿Puede una PERSONA declarar este método al marcar una factura cobrada a mano?
   *
   * No todos: `bizum_auto` significa **confirmado por la pasarela**, y nadie puede afirmarlo a
   * mano — hacerlo inventaría una cadena de evidencia que no existe. El Bizum que teclea el
   * profesional es `bizum_manual`, que es otra cosa y por eso son dos valores y no uno.
   *
   * Está aquí, en la tabla tipada contra `PAID_VIA`, y no en una lista aparte: si el conjunto
   * estrena un método, **esto no compila** hasta que alguien diga si se puede declarar a mano.
   */
  declarableAMano: boolean;
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
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * EN QUÉ CUBO CAE CADA MÉTODO — y ahí dentro, su rótulo y su orden.
 *
 * 🔴 ESTO NO ES UNA SEGUNDA LISTA DE `PAID_VIA`. Es una TABLA INDEXADA POR ÉL: `Record<PaidVia,…>`
 * está tipado contra el conjunto, así que si `PAID_VIA` estrena un valor **esto no compila** hasta
 * que alguien diga en qué cubo cae y en qué orden se pinta. La pertenencia se sigue resolviendo
 * contra `PAID_VIA` —lo que el guard de SCRUM-473 protege—; aquí solo vive lo que el conjunto NO
 * sabe: cómo se le enseña al profesional. Un `as const` con los mismos valores sí habría sido la
 * copia, porque nada lo ataría al original.
 *
 * **El orden es propiedad del CUBO, no del método**, y no es el de `PAID_VIA`: el diseño §B4 los
 * nombra «Bizum · tarjeta · transferencia · efectivo» y así los aprobó el asesor (regla 30), mientras
 * que `PAID_VIA` empieza por `card` porque su orden responde al vocabulario fiscal. Derivar el orden
 * de ahí cambiaba la barra sin que nadie lo hubiera decidido, y lo cazó el test de SCRUM-285 que
 * compara la lista carácter a carácter.
 *
 * Los dos Bizum comparten cubo, rótulo y orden a propósito: la distinción —confirmado por la
 * pasarela frente a dicho por el profesional— es NUESTRA, y el diseño nombra cuatro métodos porque
 * el profesional piensa en cuatro. La distinción no se pierde: se lee en la fila.
 */
const CUBO_DE: Readonly<Record<PaidVia, EntradaDeMetodo>> = Object.freeze({
  // `bizum_auto` NO se puede declarar a mano: significa «lo confirmó la pasarela».
  bizum_auto:   { clave: 'bizum',    rotulo: 'Bizum',         orden: 1, declarableAMano: false },
  bizum_manual: { clave: 'bizum',    rotulo: 'Bizum',         orden: 1, declarableAMano: true },
  card:         { clave: 'card',     rotulo: 'tarjeta',       orden: 2, declarableAMano: true },
  transfer:     { clave: 'transfer', rotulo: 'transferencia', orden: 3, declarableAMano: true },
  cash:         { clave: 'cash',     rotulo: 'efectivo',      orden: 4, declarableAMano: true },
});

export function cubosDeMetodo(rotuloSinMetodo: string): CuboDeMetodo[] {
  // Se recorre `PAID_VIA` —el conjunto manda quién existe— y cada valor trae su cubo de la tabla.
  // Dos métodos que caen en el mismo cubo lo pintan UNA vez: «Bizum» sale una, no dos.
  const porClave = new Map<string, CuboDeMetodo>();
  for (const via of PAID_VIA) {
    const cubo = CUBO_DE[via];
    if (cubo && !porClave.has(cubo.clave)) porClave.set(cubo.clave, cubo);
  }
  const out = [...porClave.values()].sort((a, b) => a.orden - b.orden);
  // `sin-metodo` va SIEMPRE y el ÚLTIMO: un cobro cuyo método no consta no puede desaparecer de una
  // pantalla de dinero. No sale de la tabla porque no es un método — es la ausencia de uno.
  out.push({ clave: CUBO_SIN_METODO, rotulo: rotuloSinMetodo, orden: out.length + 1 });
  return out;
}

/**
 * EN QUÉ CUBO CAE UN COBRO — la clave, y solo la clave.
 *
 * Es lo que necesita el filtro: `card` y `card:stripe` devuelven `'card'`, y por eso pulsar
 * «tarjeta» los trae a los dos. Lo que no se pueda clasificar cae en `sin-metodo` y NO desaparece
 * de la pantalla.
 *
 * ⚠️ NO devuelve el texto de la celda. Cómo se PINTA el método —traducir «card:stripe» a algo que
 * el profesional entienda— es SCRUM-481 y va por otro carril (regla 9): dos ramas escribiendo el
 * mismo rótulo es exactamente la divergencia que este fichero existe para impedir.
 */
export function cuboDeCobro(valor: unknown): string {
  const agrupado = metodoParaAgrupar(valor);
  if (!agrupado) return CUBO_SIN_METODO;
  return CUBO_DE[agrupado]?.clave ?? CUBO_SIN_METODO;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * SCRUM-491 · LO QUE UNA FACTURA MARCADA A MANO DICE QUE FUE SU MÉTODO — al LEERLA
 *
 * `campoPaidViaAlMarcar` decide qué se ESCRIBE en `invoices.paid_via`; esto decide qué se LEE.
 * Son las dos mitades del mismo dato y viven juntas a propósito: **las DOS pantallas que enseñan
 * cobros tienen que leerlo igual**, y dos normalizaciones parecidas en dos ficheros es exactamente
 * cómo dos pantallas acaban contando cosas distintas del mismo cobro.
 *
 * 🔴 UNA CADENA VACÍA NO ES UN MÉTODO: es la misma ausencia que `null`, escrita de otra forma. Se
 * unifican aquí y no en cada llamador, porque **dos maneras de decir «no consta» divergen en
 * cuanto alguien filtre por una de ellas**. `?? null` NO basta: `??` solo cubre `null` y
 * `undefined`, y deja pasar el `''`.
 *
 * ⚠️ NO VALIDA contra `PAID_VIA`, y es deliberado. Quien valida al escribir es `metodoDeclarado`
 * (arriba, privado): al leer, un valor que el conjunto ya no reconozca **tiene que llegar a la
 * pantalla diciéndose** —para eso está «⚠️ Método no reconocido (…)» de SCRUM-398— y no
 * desaparecer en un `null` que lo convertiría en «no consta». Son dos afirmaciones distintas y
 * tragarse una es perder el rastro del dato raro justo cuando hace falta.
 *
 * 🔸 Semántica IDÉNTICA a la de `metodoDeclarado` de `cobros.service.ts` en la rama
 * `scrum-441-cobros-leen-paid-via` (`c2e540d3`), a propósito: mientras esa rama no entre, las dos
 * pantallas hacen lo mismo aunque por dos sitios; cuando entre, Cobros consume ÉSTA y la copia
 * desaparece en una línea.
 */
export function metodoDeclaradoEnFactura(paidVia: unknown): string | null {
  return typeof paidVia === 'string' && paidVia.trim() !== '' ? paidVia : null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * SCRUM-441 · LO QUE EL PROFESIONAL DECLARA AL MARCAR UNA FACTURA COBRADA A MANO
 *
 * Vale lo que cumple la forma `<metodo>[:<pasarela>]` con el método en `PAID_VIA` (regla 22), y
 * además el desconocido DECLARADO — que no es lo mismo que `null`: `null` es «nadie dijo nada» y
 * `desconocido` es «se preguntó y no consta». La diferencia importa en una pantalla de dinero.
 *
 * NO SE EXPORTA a proposito: su superficie publica es `campoPaidViaAlMarcar`, que es lo que de
 * verdad decide que se escribe. Exportarla ademas anadia una puerta que nadie de fuera usa —lo cazo
 * el guard de SCRUM-411— y hacia que su test midiera un ayudante interno en vez del contrato.
 *
 * Cualquier otra cosa devuelve `null` y **la columna no se toca**. Fallar cerrado: escribir un
 * método inventado es peor que no escribir ninguno, porque el segundo se ve y el primero no.
 */
function metodoDeclarado(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim().toLowerCase();
  if (limpio === '') return null;
  if (limpio === METODO_DESCONOCIDO) return limpio;
  return esMetodoValido(limpio) ? limpio : null;
}

/** Una opción del selector: el valor que se guarda y el texto que lee el profesional. */
export interface OpcionDeMetodo {
  valor: string;
  rotulo: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * LO QUE EL PROFESIONAL PUEDE ELEGIR al marcar una factura cobrada a mano — SCRUM-441
 *
 * Se DERIVA recorriendo `PAID_VIA`, igual que la barra de filtros: el front no tiene ni puede
 * tener su propia lista de métodos. Esa duplicación es el defecto que SCRUM-474 arrancó de
 * `cobrosView.js`, y volver a plantarla aquí sería cometerlo en el arreglo del ticket siguiente.
 *
 * Salen **cuatro**, no cinco: los dos Bizum comparten rótulo y solo `bizum_manual` es declarable
 * por una persona, así que el profesional ve «Bizum» una vez y lo que se guarda es el valor que
 * dice la verdad — que lo confirmó él, no la pasarela.
 *
 * ⚠️ Aquí NO va «sin especificar». Esa opción existe en la pantalla y **no escribe nada**: no es
 * un método, es la ausencia de uno. Meterla en esta lista la convertiría en un valor guardable.
 */
export function opcionesDeMetodoDeclarable(): OpcionDeMetodo[] {
  const porRotulo = new Map<string, OpcionDeMetodo & { orden: number }>();
  for (const via of PAID_VIA) {
    const e = CUBO_DE[via];
    if (!e || !e.declarableAMano) continue;
    if (porRotulo.has(e.rotulo)) continue;
    porRotulo.set(e.rotulo, { valor: via, rotulo: e.rotulo, orden: e.orden });
  }
  return [...porRotulo.values()]
    .sort((a, b) => a.orden - b.orden)
    .map(({ valor, rotulo }) => ({ valor, rotulo }));
}

/**
 * QUÉ SE ESCRIBE EN `invoices.paid_via` al cambiar el estado de una factura. Función PURA: se puede
 * probar entera sin base de datos, que es la única forma de que el control negativo signifique algo.
 *
 * Tres casos, y el de en medio es el que protege lo que ya funcionaba:
 *
 *  · `paid` **con** método declarado → se escribe.
 *  · `paid` **sin** método (o con uno que el conjunto cerrado no reconoce) → `{}`, o sea **no se
 *    toca la columna**. Marcar cobrada sin indicar método sigue funcionando exactamente igual que
 *    antes de que esta columna existiera.
 *  · `pending` (deshacer el pago) → `null`. Si ya no está cobrada, «cómo se cobró» dejó de ser
 *    cierto. No es política nueva: es la que ya tenía `paidAt`, aplicada al campo que la acompaña.
 *
 * 🔴 Lo que NUNCA hace: mirar `Charge`. El valor sale de lo que el profesional dice EN ESE MOMENTO,
 * y las filas históricas no se tocan (ver `tests/scrum441-paidvia-sin-copia.test.mjs`).
 */
export function campoPaidViaAlMarcar(status: string, declarado: unknown): { paidVia?: string | null } {
  if (status === 'pending') return { paidVia: null };
  if (status !== 'paid') return {};
  const v = metodoDeclarado(declarado);
  return v ? { paidVia: v } : {};
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

/**
 * SCRUM-486 · La PREFERENCIA con la que se crea un cobro → el vocabulario que se guarda.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * SON DOS VOCABULARIOS DISTINTOS, Y ÉSTA ES LA FRONTERA
 *
 * Lo que llega en `method_preference` es `bank | card | mp` (`schemas.ts`), un vocabulario de
 * ENTRADA. Lo que se guarda en `Charge.method` es `PAID_VIA`. La traducción existía **en línea y a
 * medias** en `charges.routes.ts`: hacía `bank → transfer` y `card → card`, y dejaba `mp → mp`
 * pasar sin traducir. Un traductor al que le falta una regla no se ve: parece que no traduce ese
 * caso porque no hace falta.
 *
 * 🔴 `mp` NO SE TRADUCE A NINGÚN MÉTODO, y ésa es la decisión (fundador, 12-ago-2026):
 * **MercadoPago es una PASARELA, no un método**, y al CREAR el cobro nadie sabe todavía con qué
 * pagará el cliente — puede acabar pagando con tarjeta, con transferencia o en efectivo en un
 * kiosco. Traducirlo a `card` sería inventar el dato más probable, que es exactamente lo que la
 * regla 22 prohíbe. Se declara que no consta.
 *
 * ⚠️ Y el desconocido declarado **es un valor, no un hueco**: cabe en `Charge.method` tal como
 * está (`String`, NOT NULL) y `esMetodoValido` lo devuelve `false` a propósito. Un `mp` inventado
 * y un `desconocido` declarado están los dos fuera de `PAID_VIA` y son lo contrario: uno afirma un
 * método que nadie ha visto, el otro dice que no se sabe.
 *
 * ⚠️ El caso por defecto sigue siendo `transfer` y NO se toca (SCRUM-474): `bank` era el valor por
 * defecto del contrato de entrada y su equivalente en el conjunto cerrado es la transferencia.
 */
export function metodoDesdePreferencia(preferencia: string | null | undefined): string {
  switch ((preferencia || '').toLowerCase().trim()) {
    case 'card':
      return 'card';
    case 'mp':
      return METODO_DESCONOCIDO;
    default:
      return 'transfer';
  }
}
