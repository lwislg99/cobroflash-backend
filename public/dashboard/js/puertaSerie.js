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

/**
 * ¿Se pinta la puerta? SOLO lo que dijo el servidor. Se acepta un veredicto inyectado para poder
 * ejercitar los dos lados en la suite sin navegador.
 */
function puertaSerieVisible(veredicto) {
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

  // Microcopy APROBADO del Paso 2 del asistente, literal.
  caja.innerHTML =
    `<h3 style="margin:0 0 10px;font-size:15px;font-weight:700;color:var(--ink)">¿Ya has facturado en ${anio}?</h3>` +
    '<div id="ps-elec" style="display:flex;gap:10px;margin:4px 0 16px">' +
      '<button type="button" id="ps-si" class="btn-secondary" style="flex:1;min-height:44px">Sí</button>' +
      '<button type="button" id="ps-no" class="btn-secondary" style="flex:1;min-height:44px">No, empiezo ahora</button>' +
    '</div>' +
    '<div id="ps-detalle" style="display:none">' +
      `<label style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">¿Cuál fue el número de tu última factura de ${anio}?</label>` +
      '<div style="display:flex;gap:10px">' +
        '<div style="flex:0 0 40%">' +
          '<label for="ps-prefijo" style="font-size:12px;color:#6b756f;display:block;margin-bottom:4px">Serie</label>' +
          '<input id="ps-prefijo" type="text" maxlength="10" style="width:100%;min-height:44px;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px"/>' +
        '</div>' +
        '<div style="flex:1">' +
          '<label for="ps-numero" style="font-size:12px;color:#6b756f;display:block;margin-bottom:4px">Número</label>' +
          '<input id="ps-numero" type="number" min="1" inputmode="numeric" placeholder="41" style="width:100%;min-height:44px;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px"/>' +
        '</div>' +
      '</div>' +
      '<p style="font-size:12px;color:#6b756f;margin:8px 0 14px">Seguimos por ahí para que tu numeración no tenga saltos.</p>' +
      '<div id="ps-previa" aria-live="polite" style="background:#f4f7f4;border:1px solid #cdd2cb;border-radius:10px;padding:12px;display:none">' +
        '<p style="margin:0 0 4px;font-size:13px;color:#333c37">Tu primera factura con YaQu será: ' +
          '<strong id="ps-previa-numero" style="font-size:15px;white-space:nowrap"></strong></p>' +
        '<p style="margin:0;font-size:12px;color:#6b756f">Compruébalo bien: cuando emitas esa factura, este número ya no se puede cambiar.</p>' +
      '</div>' +
      '<p id="ps-error" role="alert" style="display:none;font-size:13px;color:#b91c1c;margin:10px 0 0"></p>' +
    '</div>' +
    '<button type="button" id="ps-guardar" class="btn-primary" style="min-height:44px;margin-top:14px;display:none">Es correcto</button>';

  panel.insertBefore(caja, panel.firstChild);

  const detalle = caja.querySelector('#ps-detalle');
  const previa  = caja.querySelector('#ps-previa');
  const salida  = caja.querySelector('#ps-previa-numero');
  const numero  = caja.querySelector('#ps-numero');
  const prefijo = caja.querySelector('#ps-prefijo');
  const error   = caja.querySelector('#ps-error');
  const guardar = caja.querySelector('#ps-guardar');
  const btnSi   = caja.querySelector('#ps-si');
  const btnNo   = caja.querySelector('#ps-no');
  if (o.prefijoActual) prefijo.value = o.prefijoActual;

  let vieneDeOtroSitio = null;
  const marcar = (elegido) => {
    vieneDeOtroSitio = elegido;
    btnSi.className = elegido ? 'btn-primary' : 'btn-secondary';
    btnNo.className = elegido ? 'btn-secondary' : 'btn-primary';
    detalle.style.display = elegido ? 'block' : 'none';
    guardar.style.display = 'block';
    if (elegido) numero.focus();
  };

  // La previa se la pide al SERVIDOR (mismo endpoint que el asistente): quien calcula el número
  // es quien lo va a emitir. Dos sitios calculándolo es cómo la previa dice una cosa y la
  // factura otra.
  let pedido = 0;
  const refrescarPrevia = async () => {
    const n = Number(numero.value);
    error.style.display = 'none';
    if (!Number.isInteger(n) || n < 1) { previa.style.display = 'none'; return; }
    const mio = ++pedido;
    try {
      const r = await apiRequest('/admin/onboarding/serie/previa', {
        method: 'POST',
        body: JSON.stringify({ vieneDeOtroSitio: true, ultimoNumero: n, serie: prefijo.value.trim() }),
      });
      if (mio !== pedido) return; // llegó tarde: manda la última pulsación
      salida.textContent = r.proximoNumero;
      previa.style.display = 'block';
    } catch (e) {
      if (mio !== pedido) return;
      previa.style.display = 'none';
      error.textContent = (e && e.data && e.data.titulo) ? `${e.data.titulo}. ${e.message}`
        : (e && e.message) || 'No se pudo calcular el número.';
      error.style.display = 'block';
    }
  };

  btnSi.addEventListener('click', () => { marcar(true); refrescarPrevia(); });
  btnNo.addEventListener('click', () => marcar(false));
  numero.addEventListener('input', refrescarPrevia);
  prefijo.addEventListener('input', refrescarPrevia);

  guardar.addEventListener('click', async () => {
    if (vieneDeOtroSitio === null) return;
    guardar.disabled = true;
    try {
      await apiRequest('/admin/onboarding/serie', {
        method: 'POST',
        body: JSON.stringify({
          vieneDeOtroSitio,
          ultimoNumero: vieneDeOtroSitio ? Number(numero.value) : undefined,
          serie: vieneDeOtroSitio ? prefijo.value.trim() : undefined,
        }),
      });
      if (o.onGuardado) o.onGuardado();
    } catch (e) {
      guardar.disabled = false;
      error.textContent = (e && e.message) || 'No se pudo guardar.';
      error.style.display = 'block';
    }
  });

  return caja;
}

if (typeof window !== 'undefined') {
  window.renderPuertaSerie = renderPuertaSerie;
  window.puertaSerieVisible = puertaSerieVisible;
  window.motivoSerieBloqueada = motivoSerieBloqueada;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderPuertaSerie, puertaSerieVisible, motivoSerieBloqueada, anioEnCurso };
}
