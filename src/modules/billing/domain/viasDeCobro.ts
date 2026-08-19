// src/modules/billing/domain/viasDeCobro.ts — SCRUM-519 (F1).
//
// UN SOLO SITIO QUE CONTESTA «¿POR DÓNDE PUEDE COBRAR ESTE PROFESIONAL?».
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA, medido el 19-ago-2026
//
// Tres sitios contestaban esa pregunta, y no todos igual:
//
//   `settingsView.js:990`   tarjeta «Tu cuenta, lista para cobrar»  →  `!!(m.iban || m.bizumPhone)`
//   `homeView.js:309`       checklist «Configura cómo cobras»       →  `!!(m.iban || m.bizumPhone)`
//   `avisoBizumSinTelefono` aviso «te falta el móvil»               →  `bizumPhone || whatsappPhone`
//
// Y el que tenía razón era el tercero: **`whatsappPhone` SÍ vale como móvil de Bizum**. No es una
// opinión, es lo que hace el producto cuando el cliente va a pagar —
// `payInvoice.routes.ts:69` (`m?.bizumPhone || m?.whatsappPhone || null`) y
// `payBizum.routes.ts:145` (`m?.bizumPhone || m?.whatsappPhone`).
//
// Consecuencia doble, y las dos son errores que ve el profesional:
//   · sólo IBAN          → las dos pantallas dicen ✅ y el cobro por Bizum está bloqueado.
//   · sólo whatsappPhone → puede cobrar por Bizum de verdad, y las dos pantallas no lo cuentan.
//
// Censo del 19-ago-2026 sobre las dos bases accesibles desde una sesión (producción NO lo es, y
// por eso no está aquí): 13 merchants, de los que **3 están en el segundo caso** — pueden cobrar
// y la pantalla les dice que no. No es cosmética.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTO NO ES UN GUARD QUE VIGILE TRES COPIAS
//
// Cuando dos cosas tienen que cuadrar, la primera opción no es vigilarlas: es que sólo haya una.
// Un guard sobre una duplicación **acepta la duplicación y la paga dos veces** — cada cambio hay
// que hacerlo en los tres sitios y además mantener el guard que lo comprueba. Aquí el criterio
// pasa a existir UNA vez, en el servidor, y las pantallas lo RECIBEN. Es el mismo patrón que ya
// usan `publicProfileEnabled` (`app.ts`, «para que Configuración pinte activa/aún no activa sin
// duplicar la lógica») y `bizumSinTelefono`.
//
// 🔴 Y POR QUÉ EL CRITERIO DE BIZUM SE **PREGUNTA** A `decidirAvisoBizum` EN VEZ DE REESCRIBIRLO
// AQUÍ, que era lo cómodo: reescribirlo sería crear la CUARTA copia dentro del mismo commit que
// viene a quitar las copias. El dominio del aviso ya sabe leer un teléfono —incluido el caso que
// más importa, el ilegible— y esa regla se consulta, no se replica.
import { decidirAvisoBizum } from './avisoBizumSinTelefono';

export type EntradaVias = {
  iban: unknown;
  bizumPhone: unknown;
  whatsappPhone: unknown;
  connectStatus: unknown;
  /** ¿Está encendido el Bizum manual PARA ESTE merchant? Lo resuelve `isFlagEnabled` fuera. */
  flagBizum: unknown;
};

export type ViasDeCobro = {
  /** IBAN puesto: el cliente puede transferir. */
  transferencia: boolean;
  /** Bizum manual disponible de verdad. `null` = el teléfono no se pudo leer. */
  bizum: boolean | null;
  /** Stripe Connect activo: el cliente puede pagar con tarjeta. */
  tarjeta: boolean;
  /**
   * ¿Hay ALGUNA vía manual? Es exactamente lo que declara la etiqueta de la fila que lo pinta,
   * «Cobro por transferencia o Bizum» — ni más ni menos.
   *
   * ⚠️ ESTO NO ES «listo para cobrar», Y LA DISTINCIÓN ES EL MOTIVO DE QUE ESTE CAMPO SE LLAME
   * ASÍ. Qué significa que una cuenta esté lista —si basta cualquier vía, si tiene que ser la que
   * el producto usa por defecto, si Stripe cuenta cuando se active— es una decisión de producto
   * que NO se toma en este fichero y que sigue abierta. Cuando se tome, se cambia AQUÍ, en una
   * línea, y las tres pantallas la siguen. Eso es lo único que este módulo viene a garantizar.
   */
  cobroManual: boolean;
};

/**
 * 🔴 EL CASO ILEGIBLE CAE DEL LADO SEGURO, y es deliberado. Si el teléfono no se puede leer,
 * `bizum` sale `null` y **no cuenta** para `cobroManual`. Degradarlo a «sí tiene» sería afirmarle
 * al profesional que puede cobrar por una vía que quizá no funciona — el mismo fallo mudo que
 * `avisoBizumSinTelefono` existe para impedir, reproducido una pantalla más arriba.
 */
export function viasDeCobro(entrada: EntradaVias): ViasDeCobro {
  const transferencia = typeof entrada.iban === 'string' && entrada.iban.trim().length > 0;

  // Se pregunta con `flagBizum: true` A PROPÓSITO: así la respuesta habla SOLO de los teléfonos.
  // Con el flag real, un Bizum apagado devolvería `no_aplica` —«no hay nada que avisar»— y aquí
  // eso se leería como «tiene teléfono», que es lo contrario. El flag se aplica después, aparte.
  const veredicto = decidirAvisoBizum({
    flagBizum: true,
    bizumPhone: entrada.bizumPhone,
    whatsappPhone: entrada.whatsappPhone,
  });
  const hayTelefono = veredicto === 'no_se_pudo_leer' ? null : veredicto === 'no_aplica';
  const bizum = entrada.flagBizum === true ? hayTelefono : false;

  const tarjeta = String(entrada.connectStatus || 'none') === 'active';

  return { transferencia, bizum, tarjeta, cobroManual: transferencia || bizum === true };
}
