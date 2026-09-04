// tests/_asignacion-bloques-presupuesto.mjs — SCRUM-286 (B3): en qué bloque vive cada campo.
//
// ── EL FALLO MUDO DE ESTE TICKET, Y POR QUÉ HACEN FALTA DOS CENSOS ────────────
// «Un campo que se pierde al reordenar es el fallo mudo de esta tarea» — y no se ve mirando la
// pantalla, se paga en el ENVÍO. Pero mirar sólo el envío tampoco basta: un campo puede seguir
// viajando y haberse quedado en el bloque equivocado, o haberse caído del formulario mientras
// otro sitio lo sigue mandando.
//
// Por eso esto es la JUNTA de las dos poblaciones que ya están medidas:
//
//   · `_censo-nuevo-presupuesto.mjs`   → qué se ENVÍA   (SCRUM-286, ya en main)
//   · `_orden-pintado-presupuesto.mjs` → qué se PINTA y EN QUÉ ORDEN
//
// Ninguna de las dos sola habría cazado el reordenado de este ticket. Juntas, sí.
//
// ── LA ASIGNACIÓN ES DECISIÓN HUMANA, NO CENSO ───────────────────────────────
// Lo de abajo NO se deriva: es la decisión del asesor sobre los cuatro bloques. Va escrita aquí,
// entera, para que el guard pueda contrastarla contra el árbol real en los DOS sentidos:
// un campo asignado que ya no existe miente igual que uno que existe y nadie colocó.
import { censarEnvioPresupuesto } from './_censo-nuevo-presupuesto.mjs';
import { derivarOrdenDePintado, mapaDeBloques } from './_orden-pintado-presupuesto.mjs';

/** Rótulo pendiente de aprobación (regla 30). Mismo marcador que SCRUM-244/283/284. */
export const MARCA_MICROCOPY = '[PENDIENTE microcopy oficial]';

/**
 * Los CUATRO bloques, en el orden de la decisión humana: a quién · qué · cómo se paga · cómo
 * se envía. La variable es el contrato con el código; el borrador del título es microcopy.
 */
export const BLOQUES_EN_ORDEN = [
  { variable: 'blockClient', borrador: '1. Cliente' },
  { variable: 'blockLines', borrador: '2. Líneas' },
  { variable: 'blockConditions', borrador: '3. Condiciones' },
  { variable: 'blockDelivery', borrador: '4. Envío' },
];

/**
 * Campo del ENVÍO → control que lo gobierna en pantalla → bloque donde vive.
 *
 * ⚠️ «Notas» NO ESTÁ, y su ausencia es un resultado medido, no un olvido: el segundo comentario
 * de SCRUM-286 midió las tres formas posibles en `quotesView.js` (0 `createElement("textarea")`,
 * 0 `<textarea` en plantilla, 0 `contenteditable`) con control positivo. No hay control que
 * reordenar. B3 se cierra en CUATRO bloques por decisión del asesor; si «Notas» debe existir,
 * es otro ticket porque toca el modelo.
 */
export const CAMPO_A_BLOQUE = {
  customer_id: { control: 'fieldCustomer', bloque: 'blockClient' },
  lines: { control: 'linesBody', bloque: 'blockLines' },
  paymentTerms: { control: 'fieldPaymentTerms', bloque: 'blockConditions' },
  customBillingPlan: { control: 'stagesWrapper', bloque: 'blockConditions' },
  validUntil: { control: 'validWrapper', bloque: 'blockConditions' },
  payMethods: { control: 'payMethodsWrapper', bloque: 'blockDelivery' },
  docFields: { control: 'docFieldsWrapper', bloque: 'blockDelivery' },
  // SCRUM-656 (T7) · CÓMO se presenta el IVA en ESTE presupuesto. Va al bloque de LÍNEAS, junto
  // al «IVA por defecto», porque es su misma familia: los dos deciden qué impuesto enseña el
  // documento. En «Condiciones» quedaría al lado del plan de cobro, que es OTRA conversación.
  ivaModo: { control: 'fieldIvaModo', bloque: 'blockLines' },
  // SCRUM-594 (DOC-04) · el descuento GLOBAL, en euros. Va al bloque de TOTALES y no al de
  // Líneas: no es un ajuste de una línea, es una rebaja sobre el conjunto —se negocia a bulto—,
  // y su efecto se lee justo donde se pinta, entre la suma y la base imponible. El `Dto. %` de
  // cada línea sí vive en Líneas, dentro de la hoja de ajustes de su fila.
  discountGlobalAmount: { control: 'dtoGlobalWrap', bloque: 'blockTotals' },
  // SCRUM-602 (DOC-12) · la dirección de la OBRA. Va al bloque del CLIENTE y no a «4. Envío»,
  // que en esta pantalla significa el envío del DOCUMENTO por WhatsApp o correo: dos cosas
  // distintas con el mismo nombre en la misma pantalla es cómo se aprende mal un producto.
  // Son DOS claves porque son dos datos —el modo y el texto— y el texto sólo existe con
  // «Personalizada»; el control que gobierna cada una es distinto, así que se listan las dos.
  shippingAddressMode: { control: 'fieldDireccionObra', bloque: 'blockClient' },
  shippingAddress: { control: 'direccionObraWrap', bloque: 'blockClient' },
};

/**
 * VIAJAN SIN PINTARSE — contexto, no ajustes del profesional.
 *
 * El censo del envío los encontró y NO caben en ningún bloque. No es un defecto: son valores que
 * el pro no controla ni debe controlar. Constan aquí para que nadie los busque en la pantalla, y
 * para que el guard no los cuente como «campos sin sitio».
 */
export const VIAJAN_SIN_PINTARSE = ['merchant_id', 'currency', 'created_via'];

/** Campos por línea. Viven todos dentro del bloque de Líneas, en las filas que crea `addLine`. */
export const CAMPOS_DE_LINEA = ['concept', 'qty', 'price', 'tax'];

/**
 * Revisa la fuente entera y devuelve QUÉ está mal, NOMBRADO.
 *
 * Es puro: recibe el texto, así que el test puede pasarle una fuente MUTILADA a propósito y
 * comprobar que el rojo sale nombrando el campo. Un guard que sólo se ha visto en verde no se
 * ha probado.
 */
export function revisarAsignacionDeBloques(fuente, ruta = 'quotesView.js') {
  const envio = censarEnvioPresupuesto(fuente, ruta);
  const pintado = derivarOrdenDePintado(fuente, ruta);
  const bloqueDe = mapaDeBloques(pintado.orden);

  const clavesDeEnvio = envio.envio.map((c) => c.clave);
  const bloquesDelFormulario = pintado.orden.filter((n) => n.esBloque).map((n) => n.nombre);

  // ① Campos que la asignación espera y YA NO VIAJAN: el fallo mudo, nombrado.
  const dejaronDeViajar = Object.keys(CAMPO_A_BLOQUE).filter((k) => !clavesDeEnvio.includes(k));

  // ② Campos que viajan pero cuyo CONTROL ya no está pintado en ningún bloque.
  const sinControlEnPantalla = Object.entries(CAMPO_A_BLOQUE)
    .filter(([k]) => clavesDeEnvio.includes(k))
    .filter(([, v]) => !bloqueDe.has(v.control))
    .map(([k, v]) => `${k} (control \`${v.control}\`)`);

  // ③ Controles que están pintados pero en el bloque EQUIVOCADO.
  const enElBloqueEquivocado = Object.entries(CAMPO_A_BLOQUE)
    .filter(([, v]) => bloqueDe.has(v.control) && bloqueDe.get(v.control) !== v.bloque)
    .map(([k, v]) => `${k}: \`${v.control}\` está en \`${bloqueDe.get(v.control)}\`, se esperaba \`${v.bloque}\``);

  // ④ Campos que viajan y NADIE ha colocado. La lección de SCRUM-284: un campo nuevo que nadie
  //    asigna tiene que salir en ROJO, no pasar en silencio por no estar en ninguna lista.
  const colocados = new Set([...Object.keys(CAMPO_A_BLOQUE), ...VIAJAN_SIN_PINTARSE]);
  const sinSitio = clavesDeEnvio.filter((k) => !colocados.has(k));

  // ⑤ Campos asignados a un bloque que ya no existe.
  const bloquesFantasma = [...new Set(Object.values(CAMPO_A_BLOQUE).map((v) => v.bloque))]
    .filter((b) => !bloquesDelFormulario.includes(b));

  return {
    // SCRUM-587 · lo que el censo NO supo resolver viaja hasta arriba. Si se quedara dentro,
    // «no encuentro campos sin colocar» y «no pude leer parte del objeto» serían el mismo verde.
    opacos: envio.opacos || [],
    envio, pintado, bloqueDe, clavesDeEnvio, bloquesDelFormulario,
    dejaronDeViajar, sinControlEnPantalla, enElBloqueEquivocado, sinSitio, bloquesFantasma,
  };
}
