// public/dashboard/js/quoteApartados.js — SCRUM-655 (T6, sprint Tecnosel)
//
// APARTADOS, NUMERACIÓN DERIVADA Y DESCRIPCIÓN LARGA, EN FUNCIONES PURAS.
//
// Vive aquí y no dentro de `quotesDetailView.js` por el mismo motivo que `quoteMargen.js` y
// `quoteSuplido.js`: una vista del dashboard no se puede importar desde `node:test`, así que lo
// único que se le podría exigir es la FORMA de su fuente. Y aquí hay que exigir RESULTADO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA DESCRIPCIÓN LARGA, Y POR QUÉ NO LLEVA `white-space: pre-line`
//
// La descripción de una línea viaja DENTRO del concepto, detrás de un `\n` (SCRUM-603). En
// pantalla eso se pierde: `quotesDetailView.js` la mete como HTML —`<td>${escHtml(l.concept)}</td>`—
// y el HTML colapsa los saltos. Ocho renglones de texto técnico salían en una línea corrida.
//
// El reflejo es `white-space: pre-line`. **No se usa, y es deliberado:** un estilo protege un
// salto que en el HTML ya no existe como estructura, y desde un test de Node no hay forma de
// comprobar que esté puesto — el CSS no se lee desde ahí. Así que la descripción se convierte en
// **ESTRUCTURA**: un elemento por renglón. Sobrevive sin depender de una propiedad de estilo, y
// un aplanamiento se ve en el resultado, que es donde el test mira.
//
// (Esta casa ya pagó lo contrario: se puso `pre-line` en dos textos y ninguno lo necesitaba —uno
// no tenía saltos y el otro iba a un `.txt`—. «Multilínea» no describe el texto: describe el CANAL.)
(function (root) {
  'use strict';

  /**
   * La clave de la marca. TIENE que ser la misma que `MARCA_APARTADO` de
   * `src/modules/quotes/domain/apartados.ts`: si se separan, la pantalla pinta apartados que el
   * total no sabe saltarse. `tests/scrum655-apartados.test.mjs` compara las dos cadenas.
   */
  var MARCA_APARTADO = 'apartado';

  /** ¿Es cabecera de apartado? Solo el booleano `true`. Mismo criterio que el dominio. */
  function esApartado(linea) {
    return !!linea && typeof linea === 'object' && linea[MARCA_APARTADO] === true;
  }

  /**
   * NUMERA por POSICIÓN. Devuelve un array paralelo; no muta lo que recibe.
   *
   * 🔴 NO SE TECLEA NUNCA. Si el número lo escribiera una persona, dos líneas acabarían con el
   * mismo `1.02` y «quítame la 1.03» dejaría de tener respuesta. Derivado, mover una línea
   * recoloca todo solo y dos líneas NO PUEDEN compartir número: cada uno sale del par
   * (apartado, posición dentro del apartado).
   *
   * Sin apartados no se numera nada —`numero: null` en todas— y la pantalla queda como hoy. Y una
   * línea ANTERIOR a la primera cabecera tampoco recibe número: no está en ningún apartado, y
   * darle un «0.01» sería inventarse una sección que nadie escribió.
   */
  function numerarLineas(lineas) {
    var src = Array.isArray(lineas) ? lineas : [];
    var salida = [];
    var apartado = 0;
    var dentro = 0;
    for (var i = 0; i < src.length; i++) {
      if (esApartado(src[i])) {
        apartado += 1;
        dentro = 0;
        salida.push({ indice: i, cabecera: true, apartado: apartado, numero: String(apartado) });
        continue;
      }
      if (apartado === 0) {
        salida.push({ indice: i, cabecera: false, apartado: null, numero: null });
        continue;
      }
      dentro += 1;
      salida.push({
        indice: i,
        cabecera: false,
        apartado: apartado,
        numero: apartado + '.' + (dentro < 10 ? '0' + dentro : String(dentro)),
      });
    }
    return salida;
  }

  /** Cuántos apartados hay. Lo usa el suelo de ceguera de quien pinte. */
  function cuantosApartados(lineas) {
    return (Array.isArray(lineas) ? lineas : []).filter(esApartado).length;
  }

  /**
   * Parte el concepto en TÍTULO y RENGLONES de descripción.
   *
   * Mismas reglas que `partirConceptoYDescripcion` del PDF (SCRUM-603) —primera línea el título,
   * el resto la descripción, se descartan los renglones vacíos— pero devolviendo los renglones
   * SUELTOS, porque en pantalla cada uno va a ser un elemento y en el PDF era un bloque de texto.
   */
  function partirConcepto(texto) {
    var bruto = typeof texto === 'string' ? texto : '';
    var partes = bruto.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    return { titulo: partes.length ? partes[0] : '', renglones: partes.slice(1) };
  }

  /**
   * LA CELDA DEL CONCEPTO, YA CONSTRUIDA. Devuelve un `<div>` con el título y, si la hay, un
   * elemento POR RENGLÓN de descripción.
   *
   * Se construye con `createElement` + `textContent` y NO con una cadena de HTML: así el texto del
   * profesional no puede inyectar marcado, sin depender de que alguien se acuerde de escapar.
   */
  function celdaConcepto(doc, concepto) {
    var partido = partirConcepto(concepto);
    var caja = doc.createElement('div');
    caja.className = 'quote-line-concepto';

    var titulo = doc.createElement('div');
    titulo.className = 'quote-line-titulo';
    titulo.textContent = partido.titulo || '—';
    caja.appendChild(titulo);

    for (var i = 0; i < partido.renglones.length; i++) {
      var r = doc.createElement('div');
      r.className = 'quote-line-desc';
      r.textContent = partido.renglones[i];
      caja.appendChild(r);
    }
    return caja;
  }

  // ─────────────────────────────────────────────────────────────────────────────────────────
  // SCRUM-1807e · EL APARTADO EN EL EDITOR: su total, su IVA y lo que viaja.
  //
  // Decisión del fundador: SCRUM-1786 c.22269 (P2, P3 y los literales) y SCRUM-1656 c.22787
  // («+ Añadir apartado»). La clave `agrupado` la escribió S1 en la puerta (SCRUM-1807d). El
  // recorrido es el mismo que el de `capitulos()` del dominio (SCRUM-1807c): una cabecera abre
  // apartado, y sus líneas son las que la siguen hasta la próxima cabecera.
  // ─────────────────────────────────────────────────────────────────────────────────────────

  /**
   * TOTAL E IVA DE CADA APARTADO, en un solo recorrido. `filas` es la lista del editor, en orden,
   * con `{ apartado: true }` en las cabeceras y `{ total, vatPerc, enBlanco }` en las líneas.
   * Devuelve una lista PARALELA: en la posición de cada cabecera, `{ total, tipos }`, y `null` en
   * las líneas. `tipos` son los tipos de IVA DISTINTOS de sus líneas, en el orden en que salen.
   *
   * El total suma lo mismo que enseña cada fila del editor (c.22389: «cada vista suma como sus
   * líneas»), y por eso las cifras entran ya hechas: aquí no se calcula ningún importe. Una línea
   * EN BLANCO (sin concepto y sin precio) no aporta su tipo, porque nadie lo ha elegido: es el
   * renglón libre del cuadernillo, que nace con el IVA por defecto.
   */
  function resumenDeApartados(filas) {
    var src = Array.isArray(filas) ? filas : [];
    var salida = [];
    var abierto = null;
    for (var i = 0; i < src.length; i++) {
      var f = src[i] || {};
      if (f.apartado === true) {
        abierto = { total: 0, tipos: [] };
        salida.push(abierto);
        continue;
      }
      salida.push(null);
      if (!abierto) continue;
      var t = Number(f.total);
      if (Number.isFinite(t)) abierto.total = Math.round((abierto.total + t) * 100) / 100;
      if (f.enBlanco) continue;
      var v = Number(f.vatPerc);
      if (Number.isFinite(v) && abierto.tipos.indexOf(v) === -1) abierto.tipos.push(v);
    }
    return salida;
  }

  /**
   * LO QUE SE PINTA EN LA COLUMNA DE IVA DE UN APARTADO AGRUPADO (c.22269 y su encargo, c.22787):
   * con varios tipos, «Varios» (literal firmado); con uno, ese tipo («21 %»), que es un valor y no
   * un texto nuevo; sin líneas que lo digan, nada. `fmt` es el que formatea el número en pantalla.
   */
  function ivaDelApartado(tipos, fmt) {
    var lista = Array.isArray(tipos) ? tipos : [];
    if (lista.length > 1) return 'Varios';
    if (lista.length === 1) return (typeof fmt === 'function' ? fmt(lista[0]) : String(lista[0])) + ' %';
    return '';
  }

  /**
   * LA CABECERA, TAL COMO VIAJA en `lines` (POST /quote/create): concepto, la marca y, sólo si
   * las hay, la descripción y `agrupado`. Mismo criterio que el coste y el descuento de la línea:
   * lo que no se ha escrito NO viaja (ausente ≠ vacío). `agrupado: false` tampoco: sin la clave la
   * cabecera es desglosada (SCRUM-1807d, compatibilidad con las cabeceras de antes). Con
   * «Incluir descripción en el PDF» marcada, la descripción va además pegada al concepto tras un
   * salto, igual que en una línea (SCRUM-603): es lo que el PDF sabe leer.
   *
   * Sin concepto no hay cabecera (`null`): un título vacío no es un apartado.
   */
  function cabeceraParaPayload(concepto, descripcion, incluirDescripcion, agrupado) {
    var titulo = typeof concepto === 'string' ? concepto.trim() : '';
    if (!titulo) return null;
    var desc = typeof descripcion === 'string' ? descripcion.trim() : '';
    var out = { concept: incluirDescripcion && desc ? titulo + '\n' + desc : titulo };
    out[MARCA_APARTADO] = true;
    if (desc) out.description = desc;
    if (agrupado === true) out.agrupado = true;
    return out;
  }

  root.resumenDeApartados = resumenDeApartados;
  root.ivaDelApartado = ivaDelApartado;
  root.cabeceraParaPayload = cabeceraParaPayload;
  root.MARCA_APARTADO = MARCA_APARTADO;
  root.esApartado = esApartado;
  root.numerarLineas = numerarLineas;
  root.cuantosApartados = cuantosApartados;
  root.partirConcepto = partirConcepto;
  root.celdaConcepto = celdaConcepto;
})(typeof window !== 'undefined' ? window : globalThis);
