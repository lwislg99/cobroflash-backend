// public/dashboard/js/puertaSerie.js — SCRUM-D1 (bloque D)
//
// LA PUERTA DE ÚLTIMA OPORTUNIDAD: «¿ya has facturado este año?», en Configuración.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE ARREGLA
//
// El Paso 2 del asistente pregunta por la numeración, así que a quien se da de alta HOY sí se le
// pregunta. Lo que no existía es la SEGUNDA oportunidad: quien ya pasó el onboarding —o se lo
// saltó— no tenía dónde contestar. Y es justo el perfil que importa: el que viene de otro
// programa con facturas ya emitidas y descubre el problema cuando ya ha emitido tres mal
// numeradas con nosotros.
//
// Medido antes de construir: `puertaSerieDisponible` se calcula y se publica en `/admin/me`, y
// había CERO ocurrencias en todo `public/`. El backend ya decía a quién le corresponde y no había
// ninguna pantalla que lo leyera.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS TRES REGLAS DE ESTA PANTALLA
//
//   ① EL VEREDICTO NO SE CALCULA AQUÍ. Se consume `window.appPuertaSerieDisponible`, que el
//      servidor deriva con `debeOfrecerArranqueDeSerie` — la MISMA regla que usa
//      `resolveSeriesSeq` al emitir. Si el navegador comprobara `invoiceSeriesYear !== año` por su
//      cuenta habría dos criterios sobre cuándo se puede tocar la numeración, y el de fuera es el
//      fácil de equivocar.
//
//   ② LA VISTA PREVIA EN VIVO NO ES UN ADORNO. Es lo único que convierte «41» en «2026-CF-042»
//      delante de sus ojos ANTES de que sea irreversible. Sin ella el aviso de «ya no se puede
//      cambiar» no protege nada: el usuario no sabría qué está confirmando. Y tampoco se calcula
//      aquí: se le pide al servidor, que la resuelve con quien de verdad decide al emitir.
//
//   ③ EL MICROCOPY ES EL YA APROBADO del Paso 2 del asistente. Reutilizar un rótulo aprobado no
//      es redactarlo (regla 30) — y que las dos pantallas digan lo MISMO es parte del punto:
//      quien vuelva a verla tiene que reconocerla.

/** El año sale de la fecha actual, nunca cableado — igual que en el asistente. */
function anioEnCurso() {
  return new Date().getFullYear();
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1216b · EL NÚMERO DE ARRANQUE: los textos y la validación, en UN sitio para las dos
// pantallas (este fichero y el paso 2 del asistente, que los usa desde `window`).
//
// Textos FIRMADOS, literales. Los de la pregunta, por el fundador en persona (SCRUM-1216,
// comentario 17347); los tres de error, por el orquestador por delegación (comentario 17349). El
// año va por parámetro, nunca cableado (SCRUM-313): el texto firmado dice «2026» porque se firmó
// en 2026.
// ─────────────────────────────────────────────────────────────────────────────────────────
const SERIE_TEXTOS = Object.freeze({
  titulo: (anio) => `¿Ya has emitido facturas en ${anio}?`,
  ayudaTitulo: 'Si vienes de otro programa, de una plantilla o del papel, cuenta igual.',
  etiquetaCampo: (anio) => `¿Cuál fue el número de tu última factura de ${anio}?`,
  ayudaCampo: 'YaQu empezará en el siguiente, para que no repitas un número que ya has usado.',
  errorNumeroFalta: 'Escribe el número de tu última factura. Por ejemplo: 41.',
  errorNumeroNoValido: 'Tiene que ser un número entero, del 1 en adelante. Por ejemplo: 41.',
  errorNumeroGrande: 'Ese número es demasiado alto. Revisa el número de tu última factura.',
});

/**
 * ¿Qué tiene de malo lo tecleado? El texto del error, o `null` si se puede mandar.
 *
 * «Falta» sólo si de verdad no hay nada: con `<input type="number">`, teclear letras deja
 * `.value` en `''` igual que vacío, pero `validity.badInput` lo delata. A quien SÍ escribió algo no
 * se le dice «escribe» (comentario 17349). El TOPE no se comprueba aquí: lo pone el servidor
 * (`MAX_NUMERO_SERIE`) y su código se traduce en `textoErrorSerie`. Copiar la constante aquí
 * sería el segundo sitio que un día dice otra cosa.
 */
function errorNumeroArranque(valor, letrasTecleadas) {
  const v = String(valor == null ? '' : valor).trim();
  if (v === '') return letrasTecleadas ? SERIE_TEXTOS.errorNumeroNoValido : SERIE_TEXTOS.errorNumeroFalta;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return SERIE_TEXTOS.errorNumeroNoValido;
  return null;
}

/**
 * El texto de un rechazo del servidor al declarar el arranque, decidido por CÓDIGO (`err.code`),
 * nunca por el texto. Los dos 400 llegan sin `message`; el 409 trae su texto aprobado (SCRUM-291).
 */
function textoErrorSerie(e, porDefecto) {
  const code = e && (e.code || (e.data && e.data.error));
  if (code === 'numero_invalido') return SERIE_TEXTOS.errorNumeroNoValido;
  if (code === 'numero_fuera_de_rango') return SERIE_TEXTOS.errorNumeroGrande;
  if (e && e.data && e.data.titulo) return `${e.data.titulo}. ${e.message}`;
  return (e && e.message) || porDefecto;
}

/**
 * ¿Se pinta la puerta? SOLO lo que dijo el servidor. Se acepta un veredicto inyectado para poder
 * ejercitar los dos lados en la suite sin navegador.
 */
function puertaSerieVisible(veredicto) {
  // 🔴 SCRUM-1216a · EN `receipt` NUNCA. Con la facturación apagada YaQu no emite nada (regla 24),
  // y `puertaSerieDisponible` no mira el modo: sin esto, un profesional español con el flag en OFF
  // veía en Ajustes una pregunta sobre la numeración de sus facturas. Guardar no la cerraría para
  // siempre: el 1-ene `invoiceSeriesYear` deja de ser el año en curso, y quien no emite nunca no
  // lo vuelve a escribir. Se mira el modo, como ya hace la vista previa (SCRUM-1029).
  if (typeof window !== 'undefined' && window.appModoEmision === 'receipt') return false;
  const v = veredicto === undefined ? (typeof window !== 'undefined' ? window.appPuertaSerieDisponible : undefined) : veredicto;
  return v === true;
}

/**
 * El motivo por el que el campo Serie sale BLOQUEADO, o `null` si no lo está.
 * Se DERIVA de lo que publica el servidor (`serieEmitida.emitidas`), no de una regla local.
 */
function motivoSerieBloqueada(resumen) {
  const r = resumen === undefined ? (typeof window !== 'undefined' ? window.appSerieEmitida : null) : resumen;
  if (!r || !r.emitidas) return null;
  const n = r.emitidas;
  return n === 1
    ? `Ya has emitido 1 factura con esta serie (${r.ejemplo}). La numeración no se puede cambiar.`
    : `Ya has emitido ${n} facturas con esta serie (la última, ${r.ejemplo}). La numeración no se puede cambiar.`;
}

/**
 * Pinta la puerta dentro de `panel`. Devuelve el nodo creado, o `null` si no corresponde —
 * y que devuelva `null` es la mitad del trabajo: la puerta NO se le enseña a quien ya emitió.
 */
function renderPuertaSerie(panel, opciones) {
  const o = opciones || {};
  if (!puertaSerieVisible(o.veredicto)) return null;

  const anio = o.anio || anioEnCurso();
  const caja = document.createElement('div');
  caja.id = 'puerta-serie';
  caja.className = 'field';
  caja.style.cssText = 'border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-bottom:16px;background:var(--neutral-50)';

  // SCRUM-1216b · textos FIRMADOS (SCRUM-1216, comentarios 17347 y 17349), los MISMOS que el paso 2
  // del asistente, desde `SERIE_TEXTOS`. Se retiró el campo «Serie»: tras el corte de SCRUM-780 el
  // prefijo no entra en la factura ordinaria (firma del 7-sep, intacta). Y ya no está «Seguimos por
  // ahí…» (SCRUM-1216a).
  const T = SERIE_TEXTOS;
  caja.innerHTML =
    `<h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:var(--ink)">${T.titulo(anio)}</h3>` +
    `<p style="margin:0 0 10px;font-size:13px;color:#6b756f">${T.ayudaTitulo}</p>` +
    '<div id="ps-elec" style="display:flex;gap:10px;margin:4px 0 16px">' +
      '<button type="button" id="ps-si" class="btn-secondary" style="flex:1;min-height:44px">Sí</button>' +
      '<button type="button" id="ps-no" class="btn-secondary" style="flex:1;min-height:44px">No, empiezo ahora</button>' +
    '</div>' +
    '<div id="ps-detalle" style="display:none">' +
      `<label for="ps-numero" style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">${T.etiquetaCampo(anio)}</label>` +
      '<input id="ps-numero" type="number" min="1" step="1" inputmode="numeric" placeholder="41" aria-describedby="ps-numero-ayuda" style="width:100%;min-height:44px;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px"/>' +
      `<p id="ps-numero-ayuda" style="font-size:12px;color:#6b756f;margin:6px 0 0">${T.ayudaCampo}</p>` +
      '<div id="ps-previa" aria-live="polite" style="margin-top:14px;background:#f4f7f4;border:1px solid #cdd2cb;border-radius:10px;padding:12px;display:none">' +
        '<p style="margin:0 0 4px;font-size:13px;color:#333c37">Tu primera factura con YaQu será: ' +
          '<strong id="ps-previa-numero" style="font-size:15px;white-space:nowrap"></strong></p>' +
        '<p style="margin:0;font-size:12px;color:#6b756f">Compruébalo bien: cuando emitas esa factura, este número ya no se puede cambiar.</p>' +
      '</div>' +
    '</div>' +
    // Fuera del detalle a propósito: un fallo al guardar «No, empiezo ahora» también se enseña.
    '<p id="ps-error" role="alert" style="display:none;font-size:13px;color:#b91c1c;margin:10px 0 0"></p>' +
    '<button type="button" id="ps-guardar" class="btn-primary" style="min-height:44px;margin-top:14px;display:none">Es correcto</button>';

  panel.insertBefore(caja, panel.firstChild);

  const detalle = caja.querySelector('#ps-detalle');
  const previa  = caja.querySelector('#ps-previa');
  const salida  = caja.querySelector('#ps-previa-numero');
  const numero  = caja.querySelector('#ps-numero');
  const error   = caja.querySelector('#ps-error');
  const guardar = caja.querySelector('#ps-guardar');
  const btnSi   = caja.querySelector('#ps-si');
  const btnNo   = caja.querySelector('#ps-no');

  // DESIGN.md §Inputs: «Error: borde Peligro + texto de ayuda en Peligro».
  const avisar = (texto) => {
    error.textContent = texto;
    error.style.display = 'block';
    numero.style.borderColor = '#dc2626';
    numero.setAttribute('aria-invalid', 'true');
  };
  const limpiar = () => {
    error.style.display = 'none';
    numero.style.borderColor = '#cdd2cb';
    numero.removeAttribute('aria-invalid');
  };
  const letrasTecleadas = () => !!(numero.validity && numero.validity.badInput);

  let vieneDeOtroSitio = null;
  const marcar = (elegido) => {
    vieneDeOtroSitio = elegido;
    btnSi.className = elegido ? 'btn-primary' : 'btn-secondary';
    btnNo.className = elegido ? 'btn-secondary' : 'btn-primary';
    detalle.style.display = elegido ? 'block' : 'none';
    guardar.style.display = 'block';
    limpiar();
    if (elegido) numero.focus();
  };

  // La previa se la pide al SERVIDOR (mismo endpoint que el asistente): quien calcula el número
  // es quien lo va a emitir. Dos sitios calculándolo es cómo la previa dice una cosa y la
  // factura otra.
  let pedido = 0;
  const refrescarPrevia = async () => {
    limpiar();
    // SCRUM-1029 (superficie G, regla 24): en `receipt` (ES real, facturación apagada) YaQu no
    // emite ninguna factura — se OCULTA el bloque entero («Tu primera factura con YaQu será…»)
    // en vez de reescribirlo. (Desde SCRUM-1216a la puerta entera no se pinta en `receipt`.)
    if (window.appModoEmision === 'receipt') { previa.style.display = 'none'; return; }
    // Mientras escribe no se le riñe: sin número válido, sólo se esconde la previa.
    if (errorNumeroArranque(numero.value, letrasTecleadas())) { previa.style.display = 'none'; return; }
    const mio = ++pedido;
    try {
      const r = await apiRequest('/admin/onboarding/serie/previa', {
        method: 'POST',
        body: JSON.stringify({ vieneDeOtroSitio: true, ultimoNumero: Number(numero.value) }),
      });
      if (mio !== pedido) return; // llegó tarde: manda la última pulsación
      salida.textContent = r.proximoNumero;
      previa.style.display = 'block';
    } catch (e) {
      if (mio !== pedido) return;
      previa.style.display = 'none';
      avisar(textoErrorSerie(e, 'No se pudo calcular el número.'));
    }
  };

  btnSi.addEventListener('click', () => { marcar(true); refrescarPrevia(); });
  btnNo.addEventListener('click', () => marcar(false));
  numero.addEventListener('input', refrescarPrevia);

  guardar.addEventListener('click', async () => {
    if (vieneDeOtroSitio === null) return;
    // SCRUM-1200: con «Sí», un número que no vale NO se manda y el botón NO se queda mudo.
    if (vieneDeOtroSitio) {
      const motivo = errorNumeroArranque(numero.value, letrasTecleadas());
      if (motivo) { avisar(motivo); numero.focus(); return; }
    }
    guardar.disabled = true;
    try {
      await apiRequest('/admin/onboarding/serie', {
        method: 'POST',
        body: JSON.stringify(vieneDeOtroSitio
          ? { vieneDeOtroSitio: true, ultimoNumero: Number(numero.value) }
          : { vieneDeOtroSitio: false }),
      });
      if (o.onGuardado) o.onGuardado();
    } catch (e) {
      guardar.disabled = false;
      avisar(textoErrorSerie(e, 'No se pudo guardar.'));
    }
  });

  return caja;
}

if (typeof window !== 'undefined') {
  window.renderPuertaSerie = renderPuertaSerie;
  window.puertaSerieVisible = puertaSerieVisible;
  window.motivoSerieBloqueada = motivoSerieBloqueada;
  window.SERIE_TEXTOS = SERIE_TEXTOS;
  window.errorNumeroArranque = errorNumeroArranque;
  window.textoErrorSerie = textoErrorSerie;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderPuertaSerie, puertaSerieVisible, motivoSerieBloqueada, anioEnCurso,
    SERIE_TEXTOS, errorNumeroArranque, textoErrorSerie,
  };
}
