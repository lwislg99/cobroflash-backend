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
 * ✅ El rótulo del campo de CABECERA · APROBADO por el fundador el 2-sep-2026.
 *
 * «Añadir texto en el documento», literal y sin variantes. PROCEDENCIA: decisión del fundador de
 * ese día, transcrita en `docs/master/SCRUM-593.md`. Sin decir DÓNDE consta, «aprobado» es una
 * afirmación que nadie puede comprobar (SCRUM-387).
 *
 * 🔴 ES DEL FORMULARIO, NO DEL PAPEL, y ésa es la otra mitad de la misma decisión: **en el PDF ese
 * bloque NO lleva rótulo**, se imprime sólo el texto. Por eso este literal vive aquí y no en
 * `pdf.service.ts`, donde antes había un marcador que llegó a imprimirse en un documento que ve
 * el cliente del profesional.
 */
const TD_TITULO_CABECERA = 'Añadir texto en el documento';

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
  { clave: 'docHeaderText', rotulo: TD_TITULO_CABECERA, sinFirmar: false },
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
 * Qué campos pide quien llama. Sin argumento, LOS DOS.
 *
 * 🔴 EXISTE PORQUE LOS DOS DOCUMENTOS NO PIDEN LO MISMO. El presupuesto lleva los dos textos; el
 * ALBARÁN lleva sólo la cabecera, porque su pie ya existe y es `notas` —que ya se imprime— y
 * duplicarlo daría dos sitios para lo mismo. Sin esto, el albarán tendría que montar el campo a
 * mano y se quedaría fuera del suelo del lector, que es justo lo que evita un borrado silencioso.
 *
 * SUELO: una clave que no existe devuelve `null` —no una lista vacía—. Ignorarla en silencio
 * dejaría a quien se equivoque de nombre con un formulario sin campos y un `ok: true`, que es
 * exactamente el fallo mudo que esta pieza persigue.
 */
function textoDelDocumentoCampos(claves) {
  if (claves == null) return TD_CAMPOS;
  const pedidas = Array.isArray(claves) ? claves : [claves];
  const fuera = [];
  for (const c of pedidas) {
    const campo = TD_CAMPOS.find((x) => x.clave === c);
    if (!campo) return null;
    fuera.push(campo);
  }
  return fuera;
}

/**
 * Monta LOS DOS campos en un contenedor, en su orden, de una sola llamada.
 *
 * Existe para que el consumidor no escriba el bucle: un formulario que recorre `TD_CAMPOS` a
 * mano puede pintar uno y olvidarse del otro, o invertirlos, y las dos cosas pasan en verde
 * porque cada campo por separado está bien. Aquí el orden y la totalidad son de la pieza.
 */
function textoDelDocumentoMontar(contenedor, valores, claves) {
  if (!contenedor || typeof contenedor.appendChild !== 'function') return null;
  const cuales = textoDelDocumentoCampos(claves);
  if (!cuales) return null;
  for (const campo of cuales) {
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
function textoDelDocumentoLeer(raiz, claves) {
  if (!raiz || typeof raiz.querySelector !== 'function') {
    return { ok: false, motivo: 'sin-raiz', valores: null };
  }
  const cuales = textoDelDocumentoCampos(claves);
  if (!cuales) return { ok: false, motivo: 'clave-desconocida', valores: null };
  const crudos = {};
  const faltan = [];
  for (const campo of cuales) {
    const nodo = raiz.querySelector('#campo-' + campo.clave);
    if (!nodo) { faltan.push(campo.clave); continue; }
    // El valor entra TAL CUAL: los saltos son dato, no formato. El recorte lo decide el payload.
    crudos[campo.clave] = nodo.value;
  }
  if (faltan.length) return { ok: false, motivo: 'faltan-campos', faltan, valores: null };
  return { ok: true, valores: textoDelDocumentoPayload(crudos, claves) };
}

/** Lo que se manda al servidor. Vacío o sólo espacios → `null`: «no se escribió» no es `''`. */
function textoDelDocumentoPayload(valores, claves) {
  const fuera = {};
  for (const campo of textoDelDocumentoCampos(claves) || []) {
    const v = valores && valores[campo.clave];
    const limpio = v == null ? '' : String(v).trim();
    fuera[campo.clave] = limpio === '' ? null : String(v);
  }
  return fuera;
}

if (typeof window !== 'undefined') {
  window.TD_CAMPOS = TD_CAMPOS;
  window.TD_TITULO_CABECERA = TD_TITULO_CABECERA;
  window.TD_TITULO_OBSERVACIONES = TD_TITULO_OBSERVACIONES;
  window.textoDelDocumentoCampo = textoDelDocumentoCampo;
  window.textoDelDocumentoPintado = textoDelDocumentoPintado;
  window.textoDelDocumentoPayload = textoDelDocumentoPayload;
  window.textoDelDocumentoCampos = textoDelDocumentoCampos;
  window.textoDelDocumentoMontar = textoDelDocumentoMontar;
  window.textoDelDocumentoLeer = textoDelDocumentoLeer;
}
