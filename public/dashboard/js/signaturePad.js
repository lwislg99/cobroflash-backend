// public/dashboard/js/signaturePad.js — SCRUM-14 (ALBARAN-1)
// Canvas de firma reutilizable en el DASHBOARD: el cliente firma EN EL MÓVIL DEL PRO
// (decisión fundador 13-jul; sin página pública ni link remoto). Patrón visual del
// canvas de firma de la landing de decisión, adaptado a componente vanilla con los
// tokens de DESIGN.md. Uso: window.openSignaturePad({ title, hint, onConfirm }).
// onConfirm recibe el data-URI PNG de la firma; el modal se cierra solo al confirmar.
//
// SCRUM-300 (C5): admite además la DECLARACIÓN de quien firma (nombre + en calidad de qué), que
// es lo que convierte un garabato anónimo en una prueba de entrega.
//   opts.firmante = { sugerencia: 'Nombre del cliente', calidades: [{id, etiqueta, libre}] }
//   onConfirm(dataUri, { firmadoPorNombre, firmadoPorCalidad, firmadoPorCalidadOtra })
// Sin `opts.firmante` el componente se comporta EXACTAMENTE como antes (nadie más lo usa hoy).
(function () {
  // ⚠️ AQUÍ NO SE ESCRIBE NI UN TEXTO, Y ES LA DECISIÓN IMPORTANTE DE ESTE FICHERO.
  //
  // La rama `scrum-300-campos-albaran` copiaba los rótulos y las ranuras a este fichero y ataba
  // las dos listas con un test. Funciona, pero sigue habiendo DOS copias de una microcopy que
  // acaba en un documento que se puede leer en un juzgado. El criterio de la casa (SCRUM-289,
  // escrito) es el otro: **el navegador la RECIBE**. Llegan servidas por `/admin/me` desde
  // `albaranFirmante.ts`, que es su fuente única (regla 30).
  //
  // Sin ellas el bloque NO se pinta y se firma como se firmaba: preferimos perder los campos
  // nuevos a inventarnos un texto.
  const rotulos = () => (window.appAlbaranRotulos || {});
  const ayudas = () => (window.appAlbaranAyudas || {});
  const calidades = () => (Array.isArray(window.appAlbaranFirmanteOpciones) ? window.appAlbaranFirmanteOpciones : []);

  function openSignaturePad(opts) {
    const onConfirm = (opts && opts.onConfirm) || function () {};
    const title = (opts && opts.title) || 'Firma del cliente';
    const hint = (opts && opts.hint) || 'Pide al cliente que firme con el dedo dentro del recuadro.';
    const firmante = (opts && opts.firmante) || null;

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(15,28,23,.45);z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px';
    const card = document.createElement('div');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', title);
    card.style.cssText =
      'background:var(--surface,#fff);border-radius:16px;box-shadow:0 18px 50px rgba(15,28,23,.22);padding:20px;width:100%;max-width:520px';
    overlay.appendChild(card);

    card.innerHTML =
      `<h3 style="margin:0 0 4px;font-size:1.05rem;font-weight:700;color:var(--ink)">${title}</h3>` +
      `<p style="margin:0 0 12px;font-size:13px;color:var(--muted)">${hint}</p>`;

    // ── SCRUM-300: quién firma, ANTES del recuadro ───────────────────────────
    // ⚠️ EN OBRA EL CAMPO VA VACÍO, con la sugerencia como un CHIP DE UN TOQUE. Prerrellenarlo
    // pondría en boca del firmante una declaración que no ha hecho: si firma el encargado y nadie
    // lo corrige, guardaríamos un nombre falso — que se impugna y arrastra al documento entero.
    // (La página pública de firma SÍ lo precarga, y no es una incoherencia: allí quien tiene el
    // móvil en la mano es normalmente el cliente. Superficies distintas, riesgos distintos.)
    const ROT = rotulos(), AYU = ayudas(), CALS = calidades();
    // Sin microcopy servida no se pinta nada: se firma como se firmaba antes de la 300.
    const hayCopy = !!(ROT.firmadoPorNombre && CALS.length);
    let nombreEl = null, otraEl = null;
    if (firmante && hayCopy) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-bottom:12px';
      const lab = document.createElement('label');
      lab.setAttribute('for', 'sp-nombre');
      lab.style.cssText = 'display:block;font-size:13px;font-weight:600;color:var(--ink);margin-bottom:4px';
      lab.textContent = ROT.firmadoPorNombre;
      wrap.appendChild(lab);
      if (AYU.firmadoPorNombre) {
        const ayuda = document.createElement('p');
        ayuda.style.cssText = 'margin:0 0 8px;font-size:12px;color:var(--muted);line-height:1.45';
        ayuda.textContent = AYU.firmadoPorNombre;
        wrap.appendChild(ayuda);
      }
      nombreEl = document.createElement('input');
      nombreEl.id = 'sp-nombre';
      nombreEl.type = 'text';
      nombreEl.autocomplete = 'name';
      nombreEl.maxLength = 160; // tope del asesor: truncar un nombre legal en un documento firmado sale caro
      nombreEl.style.cssText = 'width:100%;min-height:44px;padding:10px 12px;font-size:16px;font-family:inherit;color:var(--ink);background:var(--surface,#fff);border:1.5px solid var(--border);border-radius:10px';
      wrap.appendChild(nombreEl);
      card.appendChild(wrap);

      if (firmante.sugerencia && AYU.chipNombreCliente) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.textContent = AYU.chipNombreCliente.replace('%s', firmante.sugerencia);
        chip.style.cssText =
          'min-height:44px;margin-top:8px;padding:8px 16px;font-size:14px;font-weight:600;font-family:inherit;color:#166534;background:#ecfdf5;border:1.5px solid #a7f3d0;border-radius:999px;cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        chip.addEventListener('click', () => {
          nombreEl.value = firmante.sugerencia;
          // Marca de que ese nombre lo pusimos NOSOTROS y no el profesional. Es lo que permite
          // borrarlo si luego declara que firmó otra persona, sin tocar lo que él haya tecleado.
          nombreEl.dataset.deSugerencia = '1';
          chip.remove();
          nombreEl.focus();
          syncOk();
        });
        wrap.appendChild(chip);
      }

      // En calidad de qué: SIN opción marcada por defecto, por la misma razón que el nombre, y
      // porque el comentario de `firmadoPorCalidad` en `prisma/schema.prisma` lo dice.
      const idLibre = (CALS.find((c) => c.libre) || {}).id;
      const lista = document.createElement('div');
      lista.setAttribute('role', 'radiogroup');
      if (ROT.firmadoPorCalidad) lista.setAttribute('aria-label', ROT.firmadoPorCalidad);
      lista.style.cssText = 'display:flex;flex-direction:column;gap:2px;margin-top:10px';
      CALS.forEach((c) => {
        const fila = document.createElement('label');
        fila.style.cssText = 'display:flex;align-items:center;gap:10px;min-height:44px;font-size:14px;color:var(--ink);cursor:pointer';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'sp-calidad';
        radio.value = c.id;
        radio.style.cssText = 'width:20px;height:20px;accent-color:var(--brand,#16a34a);flex:none';
        const txt = document.createElement('span');
        txt.textContent = c.etiqueta;
        fila.appendChild(radio);
        fila.appendChild(txt);
        lista.appendChild(fila);
        if (c.libre) {
          otraEl = document.createElement('input');
          otraEl.type = 'text';
          otraEl.maxLength = 120;
          otraEl.hidden = true;
          otraEl.setAttribute('aria-label', c.etiqueta);
          otraEl.style.cssText = 'width:100%;min-height:44px;padding:10px 12px;font-size:16px;font-family:inherit;color:var(--ink);background:var(--surface,#fff);border:1.5px solid var(--border);border-radius:10px;margin:4px 0 4px 30px';
          // «Otro» EXIGE su texto: la ranura sola no dice nada, así que el botón sigue bloqueado
          // hasta que se escriba. Mismo criterio que el backend (`resolverCalidadFirmante`).
          otraEl.addEventListener('input', () => syncOk());
          lista.appendChild(otraEl);
        }
      });
      lista.addEventListener('change', () => {
        const sel = lista.querySelector('input[name="sp-calidad"]:checked');
        if (otraEl) {
          otraEl.hidden = !sel || sel.value !== idLibre;
          if (!otraEl.hidden) otraEl.focus();
        }
        // 🔴 SCRUM-300: el nombre PRECARGADO se borra al cambiar de opción.
        //
        // Si el pro declara que firmó alguien que no es el cliente, dejar ahí el nombre del
        // cliente que pusimos nosotros sellaría una declaración falsa —y encima con nuestra
        // sugerencia como culpable—. Solo se borra si sigue siendo NUESTRA sugerencia intacta:
        // lo que haya tecleado él no se toca nunca.
        if (nombreEl && nombreEl.dataset.deSugerencia === '1' && sel && sel.value !== 'el_propio_cliente') {
          nombreEl.value = '';
          delete nombreEl.dataset.deSugerencia;
          nombreEl.focus();
        }
        syncOk();
      });
      // Teclear a mano deja de ser «sugerencia nuestra»: pasa a ser lo que él ha dicho.
      nombreEl.addEventListener('input', () => {
        delete nombreEl.dataset.deSugerencia;
        syncOk();
      });
      card.appendChild(lista);
    }

    // Canvas nítido en pantallas retina (escala por devicePixelRatio)
    const cssW = Math.min(470, Math.max(240, window.innerWidth - 80));
    const cssH = 190;
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.cssText =
      `width:${cssW}px;height:${cssH}px;display:block;background:#fff;border:1px solid var(--border);border-radius:12px;touch-action:none;cursor:crosshair`;
    card.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f1c17';

    let drawing = false;
    let hasInk = false;

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drawing = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      if (!hasInk) {
        hasInk = true;
        syncOk();
      }
    });
    const endStroke = () => { drawing = false; };
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);

    // SCRUM-404 · El aviso vive DENTRO del modal, no en la pantalla de detrás: si el envío falla,
    // el profesional sigue aquí con el cliente delante y tiene que leer qué pasa sin cambiar de
    // sitio. Va ANTES de los botones para que quede junto al que va a volver a pulsar.
    const aviso = document.createElement('p');
    aviso.setAttribute('data-sp-aviso', '');
    aviso.setAttribute('role', 'status');
    aviso.style.cssText = 'margin:12px 0 0;font-size:13px;color:var(--red-600,#dc2626);display:none';
    card.appendChild(aviso);
    function mostrarAviso(texto) { aviso.textContent = texto; aviso.style.display = 'block'; }
    function limpiarAviso() { aviso.textContent = ''; aviso.style.display = 'none'; }

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:14px';
    card.appendChild(btnRow);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn-ghost btn-sm';
    clearBtn.textContent = 'Borrar';
    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, cssW, cssH);
      hasInk = false;
      syncOk();
    });

    // Confirmar exige TRAZO **y** NOMBRE, y si la ranura es la libre, también su texto.
    //
    // Decisión del fundador (6-ago-2026): la COLUMNA es nullable —por los albaranes firmados antes
    // de C5, que no tienen estos campos y siguen siendo válidos— pero el FORMULARIO lo exige,
    // porque es EL valor del ticket: C5 existe porque «guardamos un trazo sin nombre», y un nombre
    // opcional deja el mismo trazo sin nombre en cuanto alguien tenga prisa. En una obra, siempre.
    //
    // Se bloquea el BOTÓN en vez de dejar pulsar y contestar con un error: el pro está de pie, con
    // las manos sucias y el cliente delante. El 400 del backend es el respaldo, no el camino.
    function syncOk() {
      // ⚠️ La CALIDAD sigue siendo opcional: no marcar nada es una respuesta válida y no bloquea.
      // Lo obligatorio es el nombre, y el texto libre SOLO si se ha elegido la ranura «Otro».
      const nombreOk = !nombreEl || nombreEl.value.trim().length > 0;
      const libreOk = !otraEl || otraEl.hidden || otraEl.value.trim().length > 0;
      const listo = hasInk && nombreOk && libreOk;
      okBtn.disabled = !listo;
      okBtn.style.opacity = listo ? '1' : '.6';
    }
    btnRow.appendChild(clearBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary btn-sm';
    cancelBtn.textContent = 'Cancelar';
    btnRow.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.className = 'btn-primary btn-sm';
    okBtn.textContent = 'Confirmar firma';
    okBtn.disabled = true;
    okBtn.style.opacity = '.6';
    btnRow.appendChild(okBtn);

    function close() {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // ─────────────────────────────────────────────────────────────────────────────────────
    // SCRUM-404 · PRIMERO SE CONFIRMA QUE EL TRABAJO ESTÁ A SALVO; DESPUÉS SE CIERRA LA PANTALLA.
    // CERRAR ES LO ÚLTIMO, NUNCA LO PRIMERO.
    //
    // Antes esto era `close(); onConfirm(...)`: el modal desaparecía ANTES de que la firma
    // llegara a ningún sitio. Un envío fallido —el sótano sin cobertura— dejaba el trazo en
    // ninguna parte, y había que pedirle al cliente que firmara OTRA VEZ, delante de él. Ningún
    // dato roto y la peor escena posible; es la misma lección que SCRUM-379.
    //
    // ⚠️ El trazo vive SOLO EN MEMORIA mientras esta pantalla está abierta. **No se persiste**:
    // guardar una firma en el dispositivo es decisión de H5 y arrastra consecuencias de
    // privacidad que aquí no se valoran.
    // ─────────────────────────────────────────────────────────────────────────────────────
    const okTextoInicial = okBtn.textContent;
    okBtn.addEventListener('click', async () => {
      if (!hasInk) return;
      const dataUri = canvas.toDataURL('image/png');

      // 🔴 SUELO: un `toDataURL` que no produce imagen NO se envía. Una firma vacía guardada como
      // buena es peor que un error — queda un albarán «firmado» con un trazo que no existe, y
      // nadie lo mira hasta el día que hace falta como prueba.
      if (!esTrazoUtil(dataUri)) {
        mostrarAviso('No se ha recogido el trazo. Pídele que firme otra vez dentro del recuadro.');
        return;
      }

      // SCRUM-300: la declaración viaja en un SEGUNDO argumento, así que un llamador que solo
      // espere `onConfirm(dataUri)` sigue funcionando exactamente igual.
      // ⚠️ `firmadoPorCalidadOtro` (sin «a» final): es el nombre que leen las DOS rutas de firma.
      const sel = card.querySelector('input[name="sp-calidad"]:checked');
      const declaracion = nombreEl
        ? {
            firmadoPorNombre: nombreEl.value.trim(),
            firmadoPorCalidad: sel ? sel.value : '',
            firmadoPorCalidadOtro: otraEl ? otraEl.value : '',
          }
        : null;

      okBtn.disabled = true;
      okBtn.textContent = 'Guardando…';
      limpiarAviso();
      try {
        // Se ESPERA al llamador. Si `onConfirm` no devuelve una promesa, `await` la resuelve
        // igual y el comportamiento es el de siempre: cerrar a continuación.
        await onConfirm(dataUri, declaracion);
      } catch (e) {
        // NO se cierra: el trazo sigue en el canvas y el botón vuelve a estar disponible, así que
        // se reintenta sin volver a molestar al cliente.
        mostrarAviso((e && e.message) || '[PENDIENTE microcopy oficial · firma no enviada]');
        okBtn.disabled = false;
        okBtn.textContent = 'Reintentar';
        return;
      }
      okBtn.textContent = okTextoInicial;
      close(); // ← LO ÚLTIMO, y solo si el envío fue bien.
    });

    document.body.appendChild(overlay);
    return { close };
  }

  /**
   * SCRUM-404 · ¿ESTE `toDataURL` ES UNA FIRMA DE VERDAD?
   *
   * Un canvas que falla no lanza: devuelve `"data:,"` —o una cadena minúscula— y eso, enviado
   * como firma, produce un albarán «firmado» con un trazo que no existe. El error se descubriría
   * el día que la firma haga falta como prueba, que es el peor día para descubrirlo.
   *
   * PURA a propósito, y expuesta: así su rojo se ejercita sin navegador.
   */
  function esTrazoUtil(dataUri) {
    if (typeof dataUri !== 'string') return false;
    if (!/^data:image\/png;base64,/.test(dataUri)) return false;
    // Un PNG de 1×1 transparente ronda los 100 caracteres de base64. Por debajo de eso no hay
    // trazo posible: el umbral separa «lienzo con algo» de «lienzo que no se pudo leer».
    return dataUri.length > 200;
  }

  window.openSignaturePad = openSignaturePad;
  window.esTrazoUtil = esTrazoUtil; // SCRUM-404: expuesta para su test
})();
