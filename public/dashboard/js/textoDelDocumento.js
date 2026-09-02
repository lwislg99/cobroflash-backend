// public/dashboard/js/textoDelDocumento.js — SCRUM-593 (DOC-03)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LOS DOS TEXTOS LIBRES DEL DOCUMENTO, EN UN SOLO SITIO
//
// Un texto bajo la cabecera y un mensaje final. Van en presupuesto y albarán; **la FACTURA
// queda fuera** hasta que se resuelva SCRUM-665 (su PDF se REGENERA con el código de hoy, así
// que tocarla cambiaría documentos ya emitidos — regla 29).
//
// ── POR QUÉ UN FICHERO PROPIO Y NO DENTRO DE `quotesView.js` ──────────────────────────
// Es el patrón que la casa ya usa para las piezas compartidas entre formularios
// (`tiposDeIva.js`, `margenCatalogo.js`, `switchTipoArticulo.js`): los dos textos son del
// DOCUMENTO, no de una pantalla, y los van a pintar el presupuesto y el albarán. Meterlo en
// `quotesView.js` habría creado la segunda copia el día que lo use el albarán.
//
// ── 🔴 MULTILÍNEA DE VERDAD, EN LOS TRES CANALES ──────────────────────────────────────
// Lo exige SCRUM-655 (T6). Aquí vive el canal PANTALLA: `white-space: pre-line`. Sin eso el
// navegador colapsa los saltos y un texto de ocho líneas se lee como un párrafo — el mismo
// texto, distinta cosa. El canal PDF lo resuelve `pdf.service.ts` (PDFKit respeta el `\n`) y
// está comprobado con `lineasDePdf` (SCRUM-659).
//
// `pre-line` y no `pre`: `pre` conserva TAMBIÉN los espacios y no envuelve, así que una línea
// larga se saldría de la caja. `pre-line` respeta los saltos y sigue ajustando al ancho, que es
// lo que hace falta.
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 El rótulo del campo de CABECERA · SIN APROBAR.
 *
 * Sale con marcador A PROPÓSITO y **no se deriva de «Observaciones»**: que el bloque final se
 * llame así no dice nada sobre cómo se llama éste, y deducirlo sería inventar microcopy
 * (regla 30). Se ve en pantalla hasta que el fundador lo firme, que es la única forma de que
 * nadie encienda por descuido un rótulo sin aprobar.
 */
const TD_MARCADOR_MICROCOPY = '[PENDIENTE microcopy oficial]';

/**
 * ✅ El rótulo del bloque FINAL · APROBADO por el fundador el 2-sep-2026.
 *
 * PROCEDENCIA: decisión del fundador transmitida al asesor ese día; queda escrita en
 * `docs/master/SCRUM-593.md`. Sin decir DÓNDE consta, «aprobado» es una afirmación que nadie
 * puede comprobar — es lo que exige SCRUM-387.
 *
 * «Observaciones», literal y sin variantes. **NO lleva marcador**: marcar texto firmado
 * obligaría al fundador a refirmarlo, y la regla de la casa es que sólo se marca lo NUEVO.
 */
const TD_TITULO_OBSERVACIONES = 'Observaciones';

/** Los dos campos, declarados en un solo sitio para que la pantalla no los invente. */
const TD_CAMPOS = [
  { clave: 'docHeaderText', rotulo: TD_MARCADOR_MICROCOPY, sinFirmar: true },
  { clave: 'docFooterText', rotulo: TD_TITULO_OBSERVACIONES, sinFirmar: false },
];

/**
 * El `<textarea>` de uno de los dos campos, con su rótulo.
 *
 * Devuelve el nodo en vez de una cadena de HTML: así el texto del profesional nunca se
 * concatena en markup —no hay que acordarse de escaparlo— y un `</textarea>` escrito dentro
 * del campo no puede romper la página.
 */
function textoDelDocumentoCampo(campo, valor) {
  const envoltorio = document.createElement('div');
  envoltorio.className = 'field';

  const etiqueta = document.createElement('label');
  etiqueta.setAttribute('for', 'campo-' + campo.clave);
  etiqueta.textContent = campo.rotulo;
  envoltorio.appendChild(etiqueta);

  const area = document.createElement('textarea');
  area.id = 'campo-' + campo.clave;
  area.name = campo.clave;
  area.rows = 3;
  // 🔴 El salto de línea es DATO, no formato: se escribe tal cual y no se recorta por dentro.
  area.value = valor == null ? '' : String(valor);
  envoltorio.appendChild(area);

  return envoltorio;
}

/**
 * Cómo se PINTA un texto ya guardado (no el editor): respetando sus saltos.
 *
 * `textContent` + `white-space: pre-line`. Nunca `innerHTML`: el texto lo escribe el
 * profesional y meterlo en markup sería una inyección con su nombre.
 */
function textoDelDocumentoPintado(valor) {
  const p = document.createElement('div');
  p.style.whiteSpace = 'pre-line';
  p.textContent = valor == null ? '' : String(valor);
  return p;
}

/**
 * Monta LOS DOS campos en un contenedor, en su orden, de una sola llamada.
 *
 * Existe para que el consumidor no escriba el bucle: un formulario que recorre `TD_CAMPOS` a
 * mano puede pintar uno y olvidarse del otro, o invertirlos, y las dos cosas pasan en verde
 * porque cada campo por separado está bien. Aquí el orden y la totalidad son de la pieza.
 */
function textoDelDocumentoMontar(contenedor, valores) {
  if (!contenedor || typeof contenedor.appendChild !== 'function') return null;
  for (const campo of TD_CAMPOS) {
    contenedor.appendChild(textoDelDocumentoCampo(campo, valores ? valores[campo.clave] : ''));
  }
  return contenedor;
}

/**
 * El CAMINO DE VUELTA: lee lo que el profesional escribió y lo deja listo para el servidor.
 *
 * 🔴 Y DEVUELVE UN VEREDICTO, NO SÓLO VALORES. Si los campos no están montados, esto NO puede
 * contestar `{ docHeaderText: null, docFooterText: null }`: eso es indistinguible de «el
 * profesional los dejó en blanco», y esa confusión BORRA un texto guardado en cuanto alguien
 * edite el presupuesto desde una pantalla que no los monte. Un lector ciego tiene que decir que
 * está ciego — es el mismo suelo que se le exige a los censos de esta casa.
 */
function textoDelDocumentoLeer(raiz) {
  if (!raiz || typeof raiz.querySelector !== 'function') {
    return { ok: false, motivo: 'sin-raiz', valores: null };
  }
  const crudos = {};
  const faltan = [];
  for (const campo of TD_CAMPOS) {
    const nodo = raiz.querySelector('#campo-' + campo.clave);
    if (!nodo) { faltan.push(campo.clave); continue; }
    // El valor entra TAL CUAL: los saltos son dato, no formato. El recorte lo decide el payload.
    crudos[campo.clave] = nodo.value;
  }
  if (faltan.length) return { ok: false, motivo: 'faltan-campos', faltan, valores: null };
  return { ok: true, valores: textoDelDocumentoPayload(crudos) };
}

/** Lo que se manda al servidor. Vacío o sólo espacios → `null`: «no se escribió» no es `''`. */
function textoDelDocumentoPayload(valores) {
  const fuera = {};
  for (const campo of TD_CAMPOS) {
    const v = valores && valores[campo.clave];
    const limpio = v == null ? '' : String(v).trim();
    fuera[campo.clave] = limpio === '' ? null : String(v);
  }
  return fuera;
}

if (typeof window !== 'undefined') {
  window.TD_CAMPOS = TD_CAMPOS;
  window.TD_MARCADOR_MICROCOPY = TD_MARCADOR_MICROCOPY;
  window.TD_TITULO_OBSERVACIONES = TD_TITULO_OBSERVACIONES;
  window.textoDelDocumentoCampo = textoDelDocumentoCampo;
  window.textoDelDocumentoPintado = textoDelDocumentoPintado;
  window.textoDelDocumentoPayload = textoDelDocumentoPayload;
  window.textoDelDocumentoMontar = textoDelDocumentoMontar;
  window.textoDelDocumentoLeer = textoDelDocumentoLeer;
}
