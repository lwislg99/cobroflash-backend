// public/dashboard/js/switchTipoArticulo.js — SCRUM-609 (CAT-01)
//
// EL SWITCH «Esto es… Producto | Servicio», en UN solo sitio.
//
// El catálogo pasa a ser de productos Y servicios, y el switch CAMBIA LOS CAMPOS:
//
//     PRODUCTO  →  Nombre · Coste · Margen % · Precio · Proveedor · Descripción
//     SERVICIO  →  Nombre · Precio · Descripción
//
// 🔴 NO ES UNA ETIQUETA QUE SE GUARDA: OCULTA CAMPOS. Un servicio no tiene coste, ni margen, ni
// proveedor. Es exactamente el patrón de `switchFormaJuridica` (CONT-01), y por eso este fichero
// es su espejo: la forma, las invariantes y hasta el porqué de los radios son los suyos.
//
// ── POR QUÉ RADIOS Y NO DOS BOTONES CON UNA CLASE «activo» ──────────────────────────────────
// Un artículo es producto O servicio, NUNCA LAS DOS. Eso es lo que un grupo de radio SIGNIFICA:
// el navegador impone la exclusividad, el teclado funciona solo y un lector de pantalla anuncia
// «grupo, opción 1 de 2». Se pinta como control segmentado; por debajo son radios.
//
// ── EL CASO NULL ───────────────────────────────────────────────────────────────────────────
// `item_kind` es nullable. NULL significa «nadie lo ha declarado», y NO es lo mismo que «es un
// producto». Con NULL, NINGUNO de los dos lados aparece marcado: no es un tercer estado inventado
// (regla 27), es la ausencia de valor de una columna nullable, pintada tal cual.
//
// ⚠️ Y hoy NULL casi no se ve, porque el backfill de este mismo ticket puso PRODUCTO en todas las
// filas existentes. Se sostiene igual: las filas NUEVAS nacen NULL si nadie toca el switch.
//
// ── MICROCOPY · APROBADO (SCRUM-667, 2-sep-2026) ───────────────────────────────────────────
// Los tres textos —«Esto es», «Producto», «Servicio»— los aprobó el fundador TAL CUAL estaban
// escritos. Se retira SÓLO el prefijo `[PENDIENTE microcopy oficial]`: el texto no se toca, ni se
// abrevia, ni se reordena, ni se le añade puntuación (regla 30 — es copy del fundador desde ahora).
//
// 🔴 POR QUÉ SE RETIRAN HOY Y NO CUANDO TOQUE. Producción llevaba nueve días sin desplegar por una
// deriva de esquema; se arregló, y con ella desapareció el hueco entre mergear y desplegar que
// hacía inofensivo un marcador. Estos tres se estaban leyendo en la PRIMERA PANTALLA del catálogo,
// en producción. Un marcador dejó de ser una nota para el equipo el día que sale a producción con
// el merge.
(function () {
  'use strict';

  // Los dos valores que la columna admite. Es la MISMA lista que el `z.enum` del backend
  // (`schemas.ts`, `ITEM_KIND`), y si divergen el guard de la suite lo dice.
  var VALORES = ['PRODUCTO', 'SERVICIO'];

  var ETIQUETA = { PRODUCTO: 'Producto', SERVICIO: 'Servicio' };

  var contador = 0; // ids únicos: los dos formularios pueden existir a la vez en el DOM

  /**
   * @param {{valor?: string|null, alCambiar?: Function}} o
   * @returns {{nodo: HTMLElement, leer: Function, escribir: Function}}
   *   `leer()` devuelve 'PRODUCTO' | 'SERVICIO' | null — null cuando nadie ha declarado nada.
   */
  function switchTipoArticulo(o) {
    var opciones = o || {};
    contador += 1;
    var grupo = 'tipo-articulo-' + contador;

    var campo = document.createElement('fieldset');
    campo.className = 'field segmented-field';

    var leyenda = document.createElement('legend');
    leyenda.className = 'segmented-legend';
    leyenda.textContent = 'Esto es';
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
      texto.textContent = ETIQUETA[valor];

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
      // alguien metiera por SQL a pelo— deja el control SIN marcar. Fail-closed: mejor enseñar
      // «no consta» que elegir un lado por el profesional.
      VALORES.forEach(function (v) { radios[v].checked = (v === valor); });
    }

    escribir(opciones.valor);
    return { nodo: campo, leer: leer, escribir: escribir, valores: VALORES.slice() };
  }

  /**
   * QUÉ SE VE EN CADA LADO. Vive AQUÍ y no en cada formulario a propósito: el alta y la edición
   * del catálogo son DOS formularios distintos en el mismo fichero, y ya divergieron una vez
   * (el IVA salió de uno antes que del otro). Con la regla en un solo sitio no puede repetirse.
   *
   * 🔴 LAS DOS INVARIANTES SON LAS DE CONT-01, Y NO SE NEGOCIAN:
   *
   * ① ESCONDER NO ES BORRAR. Un campo oculto conserva su valor y se sigue enviando al guardar.
   *    Vaciarlo al cambiar de lado sería perder un dato del profesional por tocar un control de
   *    presentación, y encima sin avisar.
   *
   * ② NUNCA SE ESCONDE UN CAMPO QUE TIENE ALGO ESCRITO. Un dato invisible es un dato que nadie
   *    va a corregir y que sigue viajando. Si un artículo marcado como Servicio tiene coste, se
   *    VE — y así el profesional puede quitarlo si sobra.
   *
   * ⚠️ ② ES LA RESPUESTA AL CASO «un servicio con coste», y no hace falta inventarla: ya estaba
   * decidida en CONT-01 con su motivo. No se borra el coste y no se conserva oculto: se conserva
   * VISIBLE, que es la única de las tres opciones en la que el profesional puede enterarse.
   *
   * `lado` null (nadie ha declarado nada) enseña TODO: sin declaración no hay nada que ocultar.
   */
  var SOLO_PRODUCTO = ['cost', 'margen', 'providerId'];

  /**
   * LA REGLA, SIN DOM. Vive suelta para que la suite pueda EJECUTARLA: los tests del panel no
   * levantan navegador, así que una regla enterrada dentro de `aplicarLado` sólo podría
   * comprobarse leyendo el fuente — y leer el fuente no ejecuta nada.
   * @returns {boolean} si el campo «solo producto» debe ocultarse.
   */
  function debeEsconder(lado, tieneValor) {
    // Invariante ②: un campo con algo escrito NUNCA se esconde, esté en el lado que esté.
    if (tieneValor) return false;
    // Sólo el lado SERVICIO esconde. `null` (sin declarar) enseña todo.
    return lado === 'SERVICIO';
  }

  function aplicarLado(lado, campos) {
    var mapa = campos || {};
    SOLO_PRODUCTO.forEach(function (nombre) {
      var envoltorio = mapa[nombre];
      if (!envoltorio) return;
      var entrada = envoltorio.querySelector('input, textarea, select');
      var tieneValor = !!(entrada && String(entrada.value || '').trim() !== '');
      envoltorio.hidden = debeEsconder(lado, tieneValor);
    });
  }

  switchTipoArticulo.VALORES = VALORES.slice();
  switchTipoArticulo.aplicarLado = aplicarLado;
  switchTipoArticulo.debeEsconder = debeEsconder;
  switchTipoArticulo.SOLO_PRODUCTO = SOLO_PRODUCTO.slice();

  // El `typeof window` NO es defensa por si acaso: es lo que permite que la suite CARGUE este
  // fichero y EJECUTE `debeEsconder` de verdad. Sin él, cargarlo fuera del navegador peta aquí y
  // la regla sólo podría auditarse leyendo el fuente — que no ejecuta nada.
  if (typeof window !== 'undefined') window.switchTipoArticulo = switchTipoArticulo;
  if (typeof module !== 'undefined' && module.exports) module.exports = switchTipoArticulo;
}());
