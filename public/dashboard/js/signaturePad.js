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
  // ⚠️ ESTOS TEXTOS SON COPIA DE `src/modules/jobs/domain/albaranFirmaCopy.ts`.
  // El dashboard es JS vanilla y no puede importar el TS, así que hay dos listas — y una atada a
  // la otra: `tests/scrum300-albaran-campos.test.mjs` compara este objeto con el módulo y se pone
  // rojo si divergen. Dos copias sin nada que las ate es como se pierde el microcopy aprobado.
  const COPY = {
    nombreLabel: 'Nombre de quien firma',
    nombreAyuda: 'Una firma sin nombre no identifica a nadie. Con el nombre, el albarán vale como prueba de entrega si algún día hay discusión.',
    chip: 'Es %s',
  };
  // Los `id` son datos (van a la BD); las etiquetas están PENDIENTES de aprobación y se pintan
  // con el marcador a la vista, como en portabilidad. Mismo trato que COPY: el test las compara.
  const PENDIENTE = '[PENDIENTE microcopy oficial]';
  const CALIDADES = [
    { id: 'cliente', etiqueta: PENDIENTE },
    { id: 'familiar_o_conviviente', etiqueta: PENDIENTE },
    { id: 'encargado_o_personal_obra', etiqueta: PENDIENTE },
    { id: 'portero_o_conserje', etiqueta: PENDIENTE },
    { id: 'otra_persona', etiqueta: PENDIENTE, libre: true },
  ];

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
    // El campo va VACÍO y la sugerencia es un chip de un toque: prerrellenarlo pondría en boca
    // del firmante una declaración que no ha hecho, y si firma el encargado sin corregirlo
    // guardaríamos un nombre falso — que se impugna y arrastra al documento entero.
    let nombreEl = null, otraEl = null;
    if (firmante) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-bottom:12px';
      wrap.innerHTML =
        `<label for="sp-nombre" style="display:block;font-size:13px;font-weight:600;color:var(--ink);margin-bottom:4px">${COPY.nombreLabel}</label>` +
        `<p style="margin:0 0 8px;font-size:12px;color:var(--muted);line-height:1.45">${COPY.nombreAyuda}</p>` +
        `<input id="sp-nombre" type="text" autocomplete="name" maxlength="120" style="width:100%;min-height:44px;padding:10px 12px;font-size:16px;font-family:inherit;color:var(--ink);background:var(--surface,#fff);border:1.5px solid var(--border);border-radius:10px"/>`;
      card.appendChild(wrap);
      nombreEl = wrap.querySelector('#sp-nombre');

      if (firmante.sugerencia) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.textContent = COPY.chip.replace('%s', firmante.sugerencia);
        chip.style.cssText =
          'min-height:44px;margin-top:8px;padding:8px 16px;font-size:14px;font-weight:600;font-family:inherit;color:#166534;background:#ecfdf5;border:1.5px solid #a7f3d0;border-radius:999px;cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        chip.addEventListener('click', () => {
          nombreEl.value = firmante.sugerencia;
          chip.remove();
          nombreEl.focus();
          syncOk();
        });
        wrap.appendChild(chip);
      }

      // En calidad de qué: SIN opción marcada por defecto, por la misma razón que el nombre.
      const cals = firmante.calidades || CALIDADES;
      if (cals.length) {
        const lista = document.createElement('div');
        lista.setAttribute('role', 'radiogroup');
        lista.style.cssText = 'display:flex;flex-direction:column;gap:2px;margin-top:10px';
        cals.forEach((c) => {
          const lab = document.createElement('label');
          lab.style.cssText = 'display:flex;align-items:center;gap:10px;min-height:44px;font-size:14px;color:var(--ink);cursor:pointer';
          lab.innerHTML =
            `<input type="radio" name="sp-calidad" value="${c.id}" style="width:20px;height:20px;accent-color:var(--brand,#16a34a);flex:none"/><span></span>`;
          lab.querySelector('span').textContent = c.etiqueta;
          lista.appendChild(lab);
          if (c.libre) {
            otraEl = document.createElement('input');
            otraEl.type = 'text';
            otraEl.maxLength = 120;
            otraEl.hidden = true;
            otraEl.setAttribute('aria-label', c.etiqueta);
            otraEl.style.cssText = 'width:100%;min-height:44px;padding:10px 12px;font-size:16px;font-family:inherit;color:var(--ink);background:var(--surface,#fff);border:1.5px solid var(--border);border-radius:10px;margin:4px 0 4px 30px';
            lista.appendChild(otraEl);
          }
        });
        lista.addEventListener('change', () => {
          if (!otraEl) return;
          const sel = lista.querySelector('input[name="sp-calidad"]:checked');
          otraEl.hidden = !sel || sel.value !== 'otra_persona';
          if (!otraEl.hidden) otraEl.focus();
        });
        card.appendChild(lista);
        wrap._lista = lista;
      }
      nombreEl.addEventListener('input', () => syncOk());
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

    // Confirmar exige trazo Y nombre: sin nombre no se puede firmar (SCRUM-300). Se bloquea el
    // botón en vez de dejar pulsar y contestar con un error — el pro está de pie en una obra.
    function syncOk() {
      const nombreOk = !firmante || (nombreEl && nombreEl.value.trim().length > 0);
      const listo = hasInk && nombreOk;
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

    okBtn.addEventListener('click', () => {
      if (!hasInk) return;
      if (firmante && !(nombreEl && nombreEl.value.trim())) return;
      const dataUri = canvas.toDataURL('image/png');
      const sel = card.querySelector('input[name="sp-calidad"]:checked');
      const declaracion = firmante
        ? {
            firmadoPorNombre: nombreEl.value.trim(),
            firmadoPorCalidad: sel ? sel.value : '',
            firmadoPorCalidadOtra: otraEl ? otraEl.value : '',
          }
        : null;
      close();
      onConfirm(dataUri, declaracion);
    });

    document.body.appendChild(overlay);
    return { close };
  }

  window.openSignaturePad = openSignaturePad;
})();
