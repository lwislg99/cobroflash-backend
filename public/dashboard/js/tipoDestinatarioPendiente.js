// public/dashboard/js/tipoDestinatarioPendiente.js — SCRUM-615 (salidas D y C)
//
// PEDIR EL TIPO DE DESTINATARIO EN EL MOMENTO EN QUE IMPORTA, Y AVISAR MIENTRAS NO ESTÉ.
//
// ── QUÉ PROBLEMA CIERRA ──────────────────────────────────────────────────────────────────────
//
// `Customer.tipoDestinatario` fija el plazo legal de la recapitulativa (art. 13.2 RD 1619/2012) y
// está en NULL en el 100 % de las filas medidas (15 de 15). Con NULL, `resolveTipoDestinatario`
// aplica `PARTICULAR` — el plazo MÁS CORTO, que es el lado prudente. Pero eso significa que a un
// cliente que de verdad sea EMPRESARIO se le pinta «PLAZO VENCIDO» durante 16 días sobre un plazo
// legal que NO ha vencido (medido en `tests/scrum615-plazo-con-null.test.mjs`).
//
// ── POR QUÉ AQUÍ Y NO EN EL ALTA ─────────────────────────────────────────────────────────────
//
// La bandeja es el ÚNICO sitio donde este dato cambia algo. Preguntarlo en el alta le pide al
// profesional que declare un régimen fiscal cuando solo quiere apuntar un nombre y un teléfono, y
// SCRUM-69 ya decidió el 23-jul-2026 que aquí no hay banner ni prompt forzado. Esto no fuerza
// nada: el cliente ya está delante del plazo, y la pregunta va al lado del número al que afecta.
//
// Y hoy sale barato porque hay CERO clientes en la bandeja (medido, staging y dev): no hay cola
// acumulada que resolver.
//
// ── LO QUE NO HACE, Y ES DELIBERADO ──────────────────────────────────────────────────────────
//
// 🔴 NO toca `resolveTipoDestinatario`. Esa línea SE QUEDA: es la red que sigue dando el plazo
// corto mientras nadie conteste. Este módulo la VACÍA DE CASOS, no la borra. Quitarla sería la
// salida A, que abre un estado nuevo del semáforo y exige antes arreglar el
// `|| SEMAFORO_META.verde` de `invoicesView.js:520` — sin eso, dejar de aplicar el implícito no
// deja de mentir: **miente en verde**. Anotado y fuera de este encargo (SCRUM-622).
//
// 🔴 NO introduce ningún estado ni flag nuevo (regla 27). `null` no es un estado inventado: es la
// ausencia de valor de una columna que nace nullable a propósito.
//
// ── MICROCOPY (regla 30) ─────────────────────────────────────────────────────────────────────
//
// LOS CUATRO TEXTOS DEL CAMPO SE REUTILIZAN VERBATIM de los dos formularios de cliente. Eso es
// deliberado y es lo que pedía el censo de ranuras: **no se añade ninguna decisión de copy**, se
// hace que las cuatro que ya existían sirvan a un TERCER sitio. Cambiarlos aquí crearía una
// quinta versión del mismo rótulo en el árbol, que es el defecto de «dos listas a mano».
//
// EL AVISO (salida C) SÍ ES UNA RANURA NUEVA, y sale con el marcador OFICIAL del repo y SIN texto
// de trabajo detrás. Las dos cosas a propósito:
//
//   · `[PENDIENTE microcopy oficial]` y no `[copy: fundador]`, porque `scripts/censo-marcadores.mjs`
//     cuenta por el prefijo `[PENDIENTE`: un marcador que ese censo no ve es un censo ciego, y eso
//     es peor que no marcarlo.
//   · SIN palabra de trabajo, al revés que en SCRUM-574. Allí el copy era ACCESORIO al ticket;
//     aquí el copy ES EL TICKET — es lo que el profesional lee para decidir qué contestar sobre un
//     plazo legal. Un texto mío «provisional» aquí es exactamente lo que la regla 30 prohíbe.
(function () {
  'use strict';

  var MARCADOR = '[PENDIENTE microcopy oficial]';

  // ⚠️ LOS CUATRO TEXTOS EXISTENTES. Copiados letra a letra de `customersView.js:167-174` y
  // `customerDetailView.js:312-316`. Si algún día el fundador los aprueba de nuevo, se cambian en
  // los tres sitios a la vez — y el censo de SCRUM-615 dice cuáles son.
  var ETIQUETA = 'Tipo de cliente';
  var OPCIONES = [
    { valor: '', texto: 'Sin clasificar' },
    { valor: 'PARTICULAR', texto: 'Particular' },
    { valor: 'EMPRESARIO', texto: 'Empresa / profesional' },
  ];

  var DECLARABLES = ['PARTICULAR', 'EMPRESARIO'];

  /**
   * ¿Hay que pedirle el dato a este cliente? LA REGLA, SIN DOM — vive suelta para que la suite
   * pueda EJECUTARLA, no solo leer el fuente.
   *
   * Se mira `tipoDestinatarioDeclarado` y NUNCA `tipoDestinatario`: aquél es el crudo y éste el
   * resuelto, que con NULL ya vale `PARTICULAR`. Mirar el resuelto haría que no se preguntara
   * nunca — el mecanismo entero quedaría muerto sin que nada lo dijera.
   *
   * Fail-safe hacia PREGUNTAR: cualquier valor que no sea uno de los dos declarables cuenta como
   * «no consta». Preguntar de más molesta; callar de más deja un plazo legal apoyado en una
   * suposición.
   */
  function debePedirlo(cliente) {
    var d = cliente && cliente.tipoDestinatarioDeclarado;
    return DECLARABLES.indexOf(d) === -1;
  }

  /**
   * El bloque que se inserta en la tarjeta de la bandeja: el aviso (C) y la pregunta (D).
   * Devuelve `null` cuando el dato YA está — es el sentido negativo, y es tan importante como el
   * positivo: si esto devolviera un nodo siempre, el aviso saldría también a quien ya contestó.
   *
   * @param {{cliente: object, alElegir?: Function, doc?: Document}} o
   * @returns {HTMLElement|null}
   */
  function bloqueTipoDestinatario(o) {
    var opciones = o || {};
    var cliente = opciones.cliente;
    if (!debePedirlo(cliente)) return null;

    var d = opciones.doc || (typeof document !== 'undefined' ? document : null);
    if (!d) return null;

    var caja = d.createElement('div');
    caja.className = 'tipo-destinatario-pendiente';

    // ── C · EL AVISO ──────────────────────────────────────────────────────────────────────
    // Marcador solo. No se escribe el texto: es del fundador y es el objeto del ticket.
    var aviso = d.createElement('div');
    aviso.className = 'tipo-destinatario-aviso';
    aviso.textContent = MARCADOR;
    caja.appendChild(aviso);

    // ── D · LA PREGUNTA ───────────────────────────────────────────────────────────────────
    var fila = d.createElement('div');
    fila.className = 'field tipo-destinatario-campo';

    var etiqueta = d.createElement('label');
    etiqueta.textContent = ETIQUETA; // texto EXISTENTE, reutilizado
    fila.appendChild(etiqueta);

    var select = d.createElement('select');
    select.className = 'input';
    select.name = 'tipoDestinatario';
    for (var i = 0; i < OPCIONES.length; i += 1) {
      var op = d.createElement('option');
      op.value = OPCIONES[i].valor;
      op.textContent = OPCIONES[i].texto; // texto EXISTENTE, reutilizado
      select.appendChild(op);
    }
    select.value = ''; // «Sin clasificar»: es el estado real de partida

    select.addEventListener('change', function () {
      var elegido = select.value;
      // «Sin clasificar» NO se guarda: volver a decir «no consta» no es una declaración, y
      // escribirlo convertiría un NULL legítimo en un NULL «confirmado» que nadie ha dicho.
      if (DECLARABLES.indexOf(elegido) === -1) return;
      if (typeof opciones.alElegir === 'function') opciones.alElegir(elegido, cliente);
    });

    fila.appendChild(select);
    caja.appendChild(fila);
    return caja;
  }

  var api = {
    MARCADOR: MARCADOR,
    ETIQUETA: ETIQUETA,
    OPCIONES: OPCIONES,
    DECLARABLES: DECLARABLES,
    debePedirlo: debePedirlo,
    bloqueTipoDestinatario: bloqueTipoDestinatario,
  };

  // El `typeof window` permite que la suite CARGUE este fichero y ejecute la regla de verdad.
  if (typeof window !== 'undefined') {
    window.tipoDestinatarioPendiente = api;
    window.bloqueTipoDestinatario = bloqueTipoDestinatario;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
