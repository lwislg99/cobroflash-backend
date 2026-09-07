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
   * SCRUM-576 (CONT-03) · EL LADO PERSONA GANA SU PRIMER CAMPO.
   *
   * Hasta hoy el lado Persona sólo PERDÍA campos —lo dejó escrito
   * `docs/CONTACTOS_CAMPOS_POR_LADO.md` §3.3: «Hoy el lado Persona no gana ningún campo… el campo
   * que lo llenaría es de CONT-03. Se dice para que nadie lea el hueco como un olvido». Éste es
   * ese campo.
   *
   * 🔴 LA DIRECCIÓN ES LA DE HOLDED, Y ES LO QUE IMPIDE LA CONTRADICCIÓN: la ficha de PERSONA
   * declara a qué empresa pertenece; la de EMPRESA no declara sus personas. Un solo sitio donde
   * se escribe el vínculo. Con dos, uno podría decir lo contrario que el otro y nada diría cuál
   * manda.
   */
  var SOLO_PERSONA = ['companyId'];

  /**
   * LA REGLA, SIN DOM. Vive suelta para que la suite pueda probarla de verdad: los tests del panel
   * no levantan navegador, así que una regla enterrada dentro de `aplicarLado` solo podría
   * comprobarse leyendo el fuente — y leer el fuente no ejecuta nada. Aquí se ejecuta.
   *
   * SCRUM-576 · Y ES LA REGLA GENERAL: ¿se esconde un campo que pertenece a `ladoDelCampo` cuando
   * el contacto está declarado como `ladoDeclarado`? Hasta CONT-03 sólo había un grupo —los
   * campos de Empresa—, así que la pregunta no necesitaba decir de quién era el campo.
   *
   * @returns {boolean} si ese campo debe ocultarse.
   *
   * 🔴 LOS TRES ARGUMENTOS SON OBLIGATORIOS Y NO HAY NINGUNA CAÍDA POR DEFECTO — ni `||`, ni un
   * valor supuesto. La primera versión de esto llevaba un `ladoDelCampo || 'EMPRESA'` y **el
   * guard de SCRUM-574 la tumbó**, con razón: ese guard prohíbe el patrón en los tres ficheros
   * del switch porque una caída por defecto es como «sin declarar» se convierte en una
   * declaración. Que aquí el default fuera inofensivo no lo hace distinguible en el diff — y un
   * guard que hay que leer con excepciones en la cabeza deja de ser un guard. Se quitó el
   * default, no se tocó el guard.
   *
   * Es simétrica a propósito: la razón social desaparece en Persona y el selector de empresa
   * desaparece en Empresa, con la MISMA regla. Dos reglas paralelas es exactamente como los dos
   * formularios de cliente divergieron una vez.
   */
  function debeEsconderDelLado(ladoDeclarado, ladoDelCampo, tieneValor) {
    // Invariante ②: un campo con algo escrito NUNCA se esconde, esté en el lado que esté.
    if (tieneValor) return false;
    // Un propietario que no es uno de los dos lados no manda esconder nada: fail-open.
    if (VALORES.indexOf(ladoDelCampo) === -1) return false;
    // Sin declarar (`null`) enseña TODO — sin declaración no hay nada que ocultar, y esconder por
    // defecto sería suponer un lado. Lo mismo para cualquier valor fuera de la lista: minúsculas,
    // un 'AUTONOMO' futuro, algo metido por SQL a pelo.
    if (VALORES.indexOf(ladoDeclarado) === -1) return false;
    return ladoDeclarado !== ladoDelCampo;
  }

  /**
   * EL CASO PARTICULAR DE SCRUM-574: los campos que son SÓLO DE EMPRESA.
   *
   * Se conserva con su firma de dos argumentos porque es un contrato ESCRITO —once aserciones en
   * `tests/scrum574-switch-forma-juridica.test.mjs` la llaman así— y generalizar no es motivo
   * para cambiar lo que ya estaba probado. El `'EMPRESA'` de aquí es un argumento explícito de
   * esta función concreta, no un valor al que se cae cuando falta algo.
   */
  function debeEsconder(lado, tieneValor) {
    return debeEsconderDelLado(lado, 'EMPRESA', tieneValor);
  }

  function aplicarGrupo(nombres, ladoDelCampo, lado, mapa) {
    nombres.forEach(function (nombre) {
      var envoltorio = mapa[nombre];
      // Un formulario que no tiene ese campo no es un error: los dos modales no son idénticos.
      if (!envoltorio) return;
      var entrada = envoltorio.querySelector('input, textarea, select');
      var tieneValor = !!(entrada && String(entrada.value || '').trim() !== '');
      envoltorio.hidden = debeEsconderDelLado(lado, ladoDelCampo, tieneValor);
    });
  }

  function aplicarLado(lado, campos) {
    var mapa = campos || {};
    // SCRUM-576: los DOS grupos, con la misma regla y en el mismo sitio. Que el lado Persona
    // gane un campo no puede abrir una segunda regla en otro fichero.
    aplicarGrupo(SOLO_EMPRESA, 'EMPRESA', lado, mapa);
    aplicarGrupo(SOLO_PERSONA, 'PERSONA', lado, mapa);
  }

  /**
   * SCRUM-576 (CONT-03) · QUÉ CONTACTOS PUEDE ELEGIR UNA PERSONA COMO SU EMPRESA. PURA.
   *
   * 🔴 SÓLO LOS DECLARADOS `EMPRESA`, y los 12 clientes en `NULL` que hay en desarrollo NO
   * entran. No es un descuido: ofrecerlos sería DEDUCIR que un contacto sin clasificar es una
   * empresa, y deducir la forma jurídica de otra cosa está prohibido por el fundador
   * (24-ago-2026). Que la lista salga corta es información verdadera; llenarla adivinando no.
   *
   * ⚠️ EL PROPIO CLIENTE SE EXCLUYE. «Esta empresa pertenece a sí misma» no significa nada, y sin
   * esta línea el desplegable lo ofrecería en cuanto alguien editara una ficha ya marcada como
   * empresa. El servidor lo rechaza igual (`examinarVinculoDeEmpresa`): esto evita ofrecer lo
   * que allí va a fallar, no sustituye a aquello.
   *
   * Ordena por nombre —`localeCompare` con 'es', que es quien sabe que la Ñ va tras la N— porque
   * un desplegable en orden de creación es un desplegable que se lee entero cada vez.
   */
  function empresasElegibles(clientes, excluirId) {
    var lista = Array.isArray(clientes) ? clientes : [];
    return lista
      .filter(function (c) {
        if (!c || c.contactKind !== 'EMPRESA') return false;
        return !(excluirId !== null && excluirId !== undefined && c.id === excluirId);
      })
      .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'es'); });
  }

  /**
   * EL CAMPO «Empresa» DEL LADO PERSONA. Vive AQUÍ, junto al switch, y no en cada formulario.
   *
   * Es la misma decisión que `aplicarLado`, por el mismo motivo medido: los dos modales de
   * cliente **ya divergieron una vez** —el de la lista tiene recargo de equivalencia y le falta
   * facturación pactada, el de la ficha 360 al revés— porque cada uno se editó por su lado
   * (`docs/CONTACTOS_CAMPOS_POR_LADO.md` §2). Un campo construido dos veces diverge dos veces.
   *
   * ── MICROCOPY (regla 30) ──────────────────────────────────────────────────────────────────
   * Ni el rótulo ni la opción de «ninguna» están aprobados: son del fundador. Salen del MISMO
   * `MARCADOR` que ya usa el switch, no de un literal nuevo, y eso tiene una consecuencia
   * medible: el trinquete de SCRUM-402 cuenta marcadores EN LITERALES por AST, así que
   * `switchFormaJuridica.js` **sigue contando 1** — el fichero entero se apaga el día que el
   * fundador firme, desde una sola constante.
   *
   * @param {{valor?: number|null, clientes?: Array, excluirId?: number|null}} o
   * @returns {{nodo: HTMLElement, leer: Function, escribir: Function, refrescar: Function}}
   *   `leer()` devuelve un número o `null` — null cuando no pertenece a ninguna empresa.
   */
  function selectorDeEmpresa(o) {
    var opciones = o || {};

    var campo = document.createElement('div');
    campo.className = 'field';

    var etiqueta = document.createElement('label');
    etiqueta.textContent = MARCADOR + ' Empresa';
    campo.appendChild(etiqueta);

    var select = document.createElement('select');
    select.className = 'input';
    // `name` para que `aplicarLado` y los tests lo encuentren por el nombre del campo, que es el
    // mismo que viaja al servidor.
    select.name = 'companyId';
    campo.appendChild(select);

    function refrescar(clientes, excluirId) {
      var elegido = leer();
      select.innerHTML = '';

      // La opción vacía SIEMPRE, y es la primera: el campo es OPCIONAL y tiene que poder volver a
      // «ninguna» después de haber elegido una. Sin ella, elegir sería irreversible — el mismo
      // defecto que SCRUM-579 documentó con el país.
      var ninguna = document.createElement('option');
      ninguna.value = '';
      ninguna.textContent = MARCADOR + ' Sin empresa';
      select.appendChild(ninguna);

      empresasElegibles(clientes, excluirId).forEach(function (c) {
        var op = document.createElement('option');
        op.value = String(c.id);
        op.textContent = c.name || String(c.id);
        select.appendChild(op);
      });

      // Se recupera lo que había: refrescar la lista no puede desvincular a nadie por su cuenta.
      escribir(elegido);
    }

    function leer() {
      var v = String(select.value || '').trim();
      if (v === '') return null; // no pertenece a ninguna empresa, y eso viaja como null
      var n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    }

    function escribir(valor) {
      // 🔴 SI EL VALOR NO ESTÁ EN LA LISTA, NO SE PIERDE: se añade una opción para él. El caso es
      // real — una empresa vinculada hace meses cuya ficha alguien pasó a «Persona» ya no sale de
      // `empresasElegibles`. Dejar el select en blanco enseñaría «sin empresa» a un cliente que SÍ
      // tiene una, y el siguiente guardado escribiría esa mentira en la base.
      var v = (valor === null || valor === undefined || valor === '') ? '' : String(valor);
      if (v !== '' && !select.querySelector('option[value="' + v + '"]')) {
        var huerfana = document.createElement('option');
        huerfana.value = v;
        // Sin nombre que enseñar no se inventa uno: se enseña el id, que es lo único cierto.
        huerfana.textContent = v;
        select.appendChild(huerfana);
      }
      select.value = v;
    }

    refrescar(opciones.clientes, opciones.excluirId);
    escribir(opciones.valor);
    return { nodo: campo, leer: leer, escribir: escribir, refrescar: refrescar };
  }

  switchFormaJuridica.MARCADOR = MARCADOR;
  switchFormaJuridica.VALORES = VALORES.slice();
  switchFormaJuridica.aplicarLado = aplicarLado;
  switchFormaJuridica.debeEsconder = debeEsconder;
  switchFormaJuridica.debeEsconderDelLado = debeEsconderDelLado;
  switchFormaJuridica.SOLO_EMPRESA = SOLO_EMPRESA.slice();

  // El `typeof window` NO es defensa por si acaso: es lo que permite que la suite CARGUE este
  // fichero y EJECUTE `debeEsconder` de verdad. Sin él, `require()` peta al llegar aquí y la regla
  // solo podría auditarse leyendo el fuente — que no ejecuta nada. `cabeceraModal` no lo lleva
  // porque su test es solo estático; éste ejerce la regla.
  switchFormaJuridica.SOLO_PERSONA = SOLO_PERSONA.slice();
  switchFormaJuridica.empresasElegibles = empresasElegibles;
  switchFormaJuridica.selectorDeEmpresa = selectorDeEmpresa;

  if (typeof window !== 'undefined') window.switchFormaJuridica = switchFormaJuridica;
  if (typeof module !== 'undefined' && module.exports) module.exports = { switchFormaJuridica: switchFormaJuridica, MARCADOR: MARCADOR, VALORES: VALORES, aplicarLado: aplicarLado, debeEsconder: debeEsconder, debeEsconderDelLado: debeEsconderDelLado, SOLO_EMPRESA: SOLO_EMPRESA, SOLO_PERSONA: SOLO_PERSONA, empresasElegibles: empresasElegibles, selectorDeEmpresa: selectorDeEmpresa };
})();
