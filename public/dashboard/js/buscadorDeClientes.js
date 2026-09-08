// public/dashboard/js/buscadorDeClientes.js — SCRUM-713
//
// BUSCAR AL CLIENTE EN EL DOCUMENTO. Sólo la DECISIÓN, sin DOM: así se puede probar en `npm test`
// sin navegador, que es lo que hace falta porque los nueve guards de navegador NO cubren el
// dashboard (SCRUM-628). Es la misma forma que `filtroClientes.js` y `tiposDeIva.js`.
//
// ── 🔴 AQUÍ NO NACE UN BUSCADOR NUEVO. SE JUNTAN DOS QUE YA ESTABAN ─────────────────────────
// El PASO 0 del ticket censó SEIS buscadores en la casa. Este fichero no es el séptimo: es el
// pegamento entre dos de ellos, y cada mitad viene con su procedencia.
//
//   ① LA INTERACCIÓN es la de `nuevaFacturaModal.js` (SCRUM-446): un `<input type="search">`
//      encima y el `<select>` de siempre debajo, que se repinta con lo que queda. Se eligió ése
//      —y no el `pf-autocomplete` de `quotesView.js`— porque es el único que resuelve LA MISMA
//      pregunta (elegir un cliente en un documento) con LA MISMA forma de control. El otro
//      autocompleta PRODUCTOS: traerlo aquí obligaría a cambiar el `<select>` por un `<input>`,
//      y con él se irían los doce sitios que leen `fieldCustomer.select.value` y el
//      «+ Nuevo cliente» que SCRUM-591 colocó como `<option>`.
//
//      ⚠️ `nuevaFacturaModal.js` es camino de emisión (regla 38). Se ha COPIADO el patrón; el
//      fichero no se toca, y un test lo comprueba: reutilizar no puede romper el origen.
//
//   ② LA REGLA DE COMPARACIÓN es la de `filtrarAlbaranes`
//      (`src/modules/jobs/domain/albaranesListado.ts`), que ya busca por nombre de cliente y lo
//      dejó escrito: «Sin acentos ni mayúsculas: se escribe con prisa». Es exactamente el caso
//      del ticket — «Fincas García SL» y «FINCAS GARCIA, S.L.» son el mismo negocio escrito por
//      dos personas distintas, y quien busca no sabe cuál de las dos tecleó el que dio de alta.
//
// ── 🔴 POR QUÉ SE FILTRA AQUÍ Y NO SE LE PIDE AL SERVIDOR, QUE ES LO QUE HACE EL ORIGEN ─────
// El origen va a `GET /admin/customers?search=` en cada pulsación. Aquí NO, y no es una
// preferencia: está medido.
//
//   · `quotesView.js` YA CARGA LA LISTA ENTERA al abrir (`getCustomers("")`), y `customersList` es
//     FUENTE DE VERDAD para la vista previa, la dirección de obra (SCRUM-602), el descuento
//     pactado (SCRUM-587) y las formas de pago (SCRUM-586) — todos buscan al cliente POR ID en esa
//     lista. Recargarla con el subconjunto de una búsqueda haría desaparecer de ahí al cliente ya
//     seleccionado, y la vista previa se quedaría sin nombre mientras el `<select>` sigue
//     enseñándolo. Un fallo silencioso, con la tanda en verde.
//   · Y un viaje a la red por pulsación, en la pantalla que el máster quiere resuelta en 30
//     segundos, es pedir lo que ya tienes en la mano.
//
// Filtrar en el navegador la lista que el servidor mandó tampoco se inventa aquí: es lo que hace
// `albaranesView.js` con la suya.
//
// ── MICROCOPY · REGLA 30: NI UN LITERAL ESTRENADO ───────────────────────────────────────────
// Los tres textos de abajo YA ESTÁN EN PANTALLA hoy, en `customersView.js`, para estas mismas tres
// situaciones y sobre estos mismos clientes. No se ha redactado ninguno: un test los ancla contra
// ese fichero y cae si alguno deja de existir allí.
(function () {
  'use strict';

  /**
   * 🔴 LOS CAMPOS SON LOS DEL SERVIDOR, Y NO UNO MÁS.
   *
   * Son exactamente los cuatro del `OR` de `listCustomers` (`src/modules/system/customerAdmin.ts`).
   * Que coincidan no es limpieza: es que el MISMO texto tecleado tiene que dar el MISMO resultado
   * en el presupuesto, en la lista de clientes y en el modal de la factura. Tres pantallas que
   * responden distinto a la misma pregunta es cómo el profesional aprende a no fiarse del buscador.
   *
   * ⛔ `taxId` NO ESTÁ, y es deliberado. El servidor no lo busca y el placeholder aprobado —que
   * enumera lo que se puede buscar— no lo nombra. Añadirlo aquí dejaría mintiendo al texto y
   * partiría en dos el comportamiento. Si hace falta, se amplía en `listCustomers` Y en el texto:
   * las dos cosas, y el texto es del fundador (regla 30).
   */
  var CAMPOS = ['name', 'phone', 'email', 'internalRef'];

  /**
   * LOS TRES TEXTOS, en un solo sitio y con su procedencia.
   *
   * · `placeholder` — `customersView.js:125`. ✅ APROBADO por el asesor el 2-sep-2026. Y viene con
   *   una condición escrita allí que hereda este fichero: «el placeholder DICE LO QUE EL BUSCADOR
   *   HACE». Por eso `CAMPOS` son cuatro y no otros: el texto promete nombre, teléfono, email y
   *   referencia. Cambiar uno obliga a cambiar el otro.
   * · `sinResultados` — `customersView.js:567`, el vacío de una búsqueda que no encuentra a nadie.
   * · `sinNinguno` — `customersView.js:567`, el vacío de un merchant que aún no tiene clientes.
   *
   * Viven aquí y no sueltos en cada `textContent` de `quotesView.js` por lo mismo que los de
   * `filtroClientes.js`: un literal repartido deriva sin que nada chille.
   */
  var TEXTOS = {
    placeholder: 'Buscar por nombre, teléfono, email o referencia…',
    sinResultados: 'Sin resultados para tu búsqueda',
    sinNinguno: 'Añade a tu primer cliente',
  };

  /**
   * 🔴 COPIA DECLARADA de `normalizar` en `src/modules/jobs/domain/albaranesListado.ts`.
   *
   * Es una copia INEVITABLE: el front es vanilla sin bundler (regla 4) y no puede importar de
   * `src/`. Que no diverja no lo sostiene este comentario — lo sostiene un test que EJERCITA LAS
   * DOS con las mismas parejas de «guardado» y «tecleado». Es la misma solución que `tagsDe` en
   * `filtroClientes.js`, y por el mismo motivo.
   *
   * El rango de marcas diacríticas combinantes va ESCAPADO en la cadena, no como caracteres
   * literales: un acento suelto entre corchetes es invisible al revisar un diff. (Va tal cual del
   * original; copiar la decisión y perder su motivo es cómo la copia empieza a envejecer.)
   *
   * 📌 CONSECUENCIA ASUMIDA: esto trata la «ñ» como «n», así que «munoz» encuentra a «Muñoz». Es lo
   * que hace el original, y para BUSCAR es lo prudente — encontrar de más se corrige mirando; no
   * encontrar es el defecto que este ticket viene a cerrar. Ojo: NO es la regla de `ordenar()` en
   * `filtroClientes.js`, que usa `localeCompare` con `sensitivity: 'base'` y ahí sí distingue ñ de
   * n (medido). Son dos preguntas distintas —buscar y ordenar— y cada una conserva su regla.
   */
  function normalizar(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD')
      .replace(new RegExp('[\u0300-\u036f]', 'g'), '')
      .trim();
  }

  /**
   * ¿Casa este cliente con lo tecleado? Se normalizan LOS DOS LADOS.
   *
   * Normalizar sólo el dato guardado dejaría fuera al que teclea «garcía» buscando a «GARCIA», que
   * es la mitad del caso del ticket. Se comprueba con un test por cada lado.
   */
  function coincide(cliente, consulta) {
    var q = normalizar(consulta);
    if (q === '') return true;
    if (!cliente) return false;
    for (var i = 0; i < CAMPOS.length; i++) {
      if (normalizar(cliente[CAMPOS[i]]).indexOf(q) >= 0) return true;
    }
    return false;
  }

  /**
   * Los clientes que la búsqueda deja ver.
   *
   * 🔴 EL YA SELECCIONADO NO SE CAE NUNCA, aunque no case. Filtrar una lista no puede
   * DESELECCIONAR lo que el profesional ya eligió: si su `<option>` desapareciera, el `<select>`
   * se quedaría con un `value` que no puede mostrar y el documento perdería al cliente por el
   * simple hecho de teclear. Conserva SU POSICIÓN en la lista: no se saca al principio ni al final.
   *
   * `idSeleccionado` es opcional: quien llame con dos argumentos filtra a secas.
   *
   * Devuelve una LISTA NUEVA. La de entrada es `customersList`, que es fuente de verdad para media
   * vista: mutarla aquí escondería clientes del resto de la pantalla.
   */
  function filtrar(clientes, consulta, idSeleccionado) {
    var lista = Array.isArray(clientes) ? clientes : [];
    var q = normalizar(consulta);
    if (q === '') return lista.slice();
    var elegido = String(idSeleccionado == null ? '' : idSeleccionado);
    return lista.filter(function (c) {
      if (elegido !== '' && c && String(c.id) === elegido) return true;
      return coincide(c, consulta);
    });
  }

  var api = {
    CAMPOS: CAMPOS,
    TEXTOS: TEXTOS,
    normalizar: normalizar,
    coincide: coincide,
    filtrar: filtrar,
  };

  if (typeof window !== 'undefined') window.buscadorDeClientes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
