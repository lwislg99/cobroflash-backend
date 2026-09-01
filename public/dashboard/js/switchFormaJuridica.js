// public/dashboard/js/switchFormaJuridica.js — SCRUM-574 (CONT-01)
//
// EL SWITCH «Este contacto es… Empresa | Persona», en UN solo sitio.
//
// ── POR QUÉ RADIOS DE VERDAD Y NO DOS BOTONES CON UNA CLASE «activo» ─────────────────────────
// Un contacto es empresa O persona, NUNCA LAS DOS. Eso es exactamente lo que un grupo de radio
// SIGNIFICA, y significarlo tiene tres consecuencias que un par de `<button>` no da gratis:
//   · el navegador impone la exclusividad — no hay estado que sincronizar a mano;
//   · el teclado funciona solo (flechas dentro del grupo, Tab entra y sale una vez);
//   · un lector de pantalla anuncia «grupo, opción 1 de 2», que es la información entera.
// Se pinta como un control segmentado, pero POR DEBAJO son radios. La forma visual es del
// fundador (toggle, no pestañas: las pestañas comunican coexistencia); la semántica no es
// negociable.
//
// ── EL CASO NULL, QUE ES EL DELICADO ────────────────────────────────────────────────────────
// `contact_kind` es nullable y los 15 clientes que existían al medir el PASO 0 son NULL. NULL
// significa «nadie lo ha declarado», y NO es lo mismo que «es una persona».
//
// 🔴 Por eso, con NULL, NINGUNO de los dos lados aparece marcado. No es un tercer estado inventado
// (regla 27): es la ausencia de valor de una columna que nace nullable a propósito, pintada tal
// cual. Un grupo de radio sin ninguno marcado es un estado NATIVO del control — el mismo que
// tiene cualquier formulario antes de que lo toquen.
//
// La alternativa —caer en un lado por defecto— sería que YaQu DECLARE la forma jurídica de un
// cliente que nadie ha clasificado, y al guardar la ficha por cualquier otro motivo esa
// invención se escribiría en la base. Es el mismo error que `recargoEquivalencia` documenta en
// `schema.prisma`: «un `@default(false)` convertiría a TODOS los clientes de hoy en “declarado
// que NO”, y eso no lo ha dicho nadie».
//
// ── MICROCOPY (regla 30) ────────────────────────────────────────────────────────────────────
// Ni la pregunta ni las dos etiquetas están aprobadas: son del fundador. Salen con el marcador
// oficial `[PENDIENTE microcopy oficial]` MÁS la palabra de trabajo que viene en el ticket, y ese
// «más» es deliberado: `scripts/censo-marcadores.mjs` distingue el rótulo que solo lleva la marca
// —que pinta A CIEGAS, el profesional no sabe qué hace el control— del que lleva marca + texto,
// que al menos se puede leer y juzgar. En un control de dos lados el marcador solo sería
// inservible: los dos lados dirían lo mismo.
(function () {
  'use strict';

  var MARCADOR = '[PENDIENTE microcopy oficial]';

  // Los dos valores que la columna admite. Es la MISMA lista que el `z.enum` del backend
  // (`schemas.ts`), y si divergen el guard de la suite lo dice.
  var VALORES = ['EMPRESA', 'PERSONA'];

  var contador = 0; // ids únicos: los dos modales pueden existir a la vez en el DOM

  /**
   * @param {{valor?: string|null, alCambiar?: Function}} o
   * @returns {{nodo: HTMLElement, leer: Function, escribir: Function}}
   *   `leer()` devuelve 'EMPRESA' | 'PERSONA' | null — null cuando nadie ha declarado nada.
   */
  function switchFormaJuridica(o) {
    var opciones = o || {};
    contador += 1;
    var grupo = 'forma-juridica-' + contador;

    var campo = document.createElement('fieldset');
    campo.className = 'field segmented-field';

    var leyenda = document.createElement('legend');
    leyenda.className = 'segmented-legend';
    // La pregunta que encabeza el control. Pendiente de aprobar (regla 30).
    leyenda.textContent = MARCADOR + ' Este contacto es';
    campo.appendChild(leyenda);

    var grupoEl = document.createElement('div');
    grupoEl.className = 'segmented';

    var radios = {};
    VALORES.forEach(function (valor) {
      var id = grupo + '-' + valor.toLowerCase();

      var etiqueta = document.createElement('label');
      etiqueta.className = 'segmented-option';
      etiqueta.setAttribute('for', id);

      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = grupo;
      radio.id = id;
      radio.value = valor;
      radio.className = 'segmented-input';

      var texto = document.createElement('span');
      texto.className = 'segmented-text';
      // Marca + palabra de trabajo: legible y contable por el censo de marcadores.
      texto.textContent = MARCADOR + ' ' + (valor === 'EMPRESA' ? 'Empresa' : 'Persona');

      etiqueta.appendChild(radio);
      etiqueta.appendChild(texto);
      grupoEl.appendChild(etiqueta);
      radios[valor] = radio;

      radio.addEventListener('change', function () {
        if (typeof opciones.alCambiar === 'function') opciones.alCambiar(leer());
      });
    });

    campo.appendChild(grupoEl);

    function leer() {
      for (var i = 0; i < VALORES.length; i += 1) {
        if (radios[VALORES[i]].checked) return VALORES[i];
      }
      return null; // nadie ha declarado nada, y eso viaja como null hasta la BD
    }

    function escribir(valor) {
      // Cualquier cosa que no sea uno de los dos valores —null, undefined, '' o un texto que
      // alguien metiera por SQL a pelo— deja el control SIN marcar. Fail-closed: es mejor
      // enseñar «no consta» que elegir un lado por el profesional.
      VALORES.forEach(function (v) { radios[v].checked = (v === valor); });
    }

    escribir(opciones.valor);
    return { nodo: campo, leer: leer, escribir: escribir, valores: VALORES.slice(), marcador: MARCADOR };
  }

  /**
   * QUÉ SE VE EN CADA LADO. Vive AQUÍ y no en cada vista a propósito: los dos formularios de
   * cliente ya divergieron una vez —el de la lista tiene «recargo de equivalencia» y le falta
   * «facturación pactada», el de la ficha 360 al revés— porque cada uno se editó por su lado.
   * Con la regla en un solo sitio, esa divergencia no puede repetirse en el switch.
   *
   * 🔴 DOS INVARIANTES QUE NO SE NEGOCIAN:
   *
   * ① ESCONDER NO ES BORRAR. Un campo oculto conserva su valor y se sigue enviando al guardar.
   *    Vaciarlo al cambiar de lado sería perder un dato del profesional por tocar un control de
   *    presentación, y encima sin avisar.
   *
   * ② NUNCA SE ESCONDE UN CAMPO QUE TIENE ALGO ESCRITO. Un dato invisible es un dato que nadie
   *    va a corregir y que sigue viajando a la factura. Si una ficha marcada como Persona tiene
   *    razón social, se ve — y así el profesional puede quitarla si sobra.
   *
   * `lado` null (nadie ha declarado nada) enseña TODO: sin declaración no hay nada que ocultar.
   *
   * ⚠️ EL NIF SE QUEDA EN LOS DOS LADOS, y es una desviación consciente de Holded, que lo quita
   * en Persona. Motivo: en España una persona física TAMBIÉN tiene NIF, y `schema.prisma` deja
   * escrito que el NIF del destinatario es requisito de VeriFactu (hallazgo S1-C). Esconderlo en
   * el lado Persona dejaría a un autónomo sin poder dar el dato que F1 le va a exigir — y el
   * autónomo es justo el cliente que abrió este ticket. Está declarado como decisión abierta en
   * `docs/CONTACTOS_CAMPOS_POR_LADO.md` §4; revertirlo es añadir 'taxId' a SOLO_EMPRESA.
   */
  var SOLO_EMPRESA = ['legalName'];

  /**
   * LA REGLA, SIN DOM. Vive suelta para que la suite pueda probarla de verdad: los tests del panel
   * no levantan navegador, así que una regla enterrada dentro de `aplicarLado` solo podría
   * comprobarse leyendo el fuente — y leer el fuente no ejecuta nada. Aquí se ejecuta.
   * @returns {boolean} si el campo «solo empresa» debe ocultarse.
   */
  function debeEsconder(lado, tieneValor) {
    // Invariante ②: un campo con algo escrito NUNCA se esconde, esté en el lado que esté.
    if (tieneValor) return false;
    // Solo el lado PERSONA esconde. `null` (sin declarar) enseña todo: sin declaración no hay
    // nada que ocultar, y esconder por defecto sería suponer que es una persona.
    return lado === 'PERSONA';
  }

  function aplicarLado(lado, campos) {
    var mapa = campos || {};
    SOLO_EMPRESA.forEach(function (nombre) {
      var envoltorio = mapa[nombre];
      if (!envoltorio) return;
      var entrada = envoltorio.querySelector('input, textarea, select');
      var tieneValor = !!(entrada && String(entrada.value || '').trim() !== '');
      envoltorio.hidden = debeEsconder(lado, tieneValor);
    });
  }

  switchFormaJuridica.MARCADOR = MARCADOR;
  switchFormaJuridica.VALORES = VALORES.slice();
  switchFormaJuridica.aplicarLado = aplicarLado;
  switchFormaJuridica.debeEsconder = debeEsconder;
  switchFormaJuridica.SOLO_EMPRESA = SOLO_EMPRESA.slice();

  // El `typeof window` NO es defensa por si acaso: es lo que permite que la suite CARGUE este
  // fichero y EJECUTE `debeEsconder` de verdad. Sin él, `require()` peta al llegar aquí y la regla
  // solo podría auditarse leyendo el fuente — que no ejecuta nada. `cabeceraModal` no lo lleva
  // porque su test es solo estático; éste ejerce la regla.
  if (typeof window !== 'undefined') window.switchFormaJuridica = switchFormaJuridica;
  if (typeof module !== 'undefined' && module.exports) module.exports = { switchFormaJuridica: switchFormaJuridica, MARCADOR: MARCADOR, VALORES: VALORES, aplicarLado: aplicarLado, debeEsconder: debeEsconder, SOLO_EMPRESA: SOLO_EMPRESA };
})();
