// public/dashboard/js/signaturePad.js — SCRUM-14 (ALBARAN-1)
// Canvas de firma reutilizable en el DASHBOARD: el cliente firma EN EL MÓVIL DEL PRO
// (decisión fundador 13-jul; sin página pública ni link remoto). Patrón visual del
// canvas de firma de la landing de decisión, adaptado a componente vanilla con los
// tokens de DESIGN.md. Uso: window.openSignaturePad({ title, hint, onConfirm }).
// onConfirm recibe el data-URI PNG de la firma; el modal se cierra solo al confirmar.
(function () {
  function openSignaturePad(opts) {
    const onConfirm = (opts && opts.onConfirm) || function () {};
    const title = (opts && opts.title) || 'Firma del cliente';
    const hint = (opts && opts.hint) || 'Pide al cliente que firme con el dedo dentro del recuadro.';

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

    // ── SCRUM-300 (C5): QUIÉN firma y EN CALIDAD DE QUÉ ────────────────────────────────
    // Van ARRIBA y PRECARGADOS con el caso mayoritario (el propio cliente), no porque quede
    // bonito sino porque es lo que mantiene el flujo en 2 toques + 1 trazo: quien no tenga nada
    // que cambiar no los toca. El pro está en obra, de pie, con las manos sucias y el cliente
    // esperando — si firmar pasara de tres toques a ocho, estaría mal aunque funcionase.
    //
    // ⚠️ Los textos NO se escriben aquí: llegan servidos en `window.appAlbaranFirmanteOpciones`
    // y `window.appAlbaranRotulos` desde su fuente única en el backend (regla 30). Sin ellos el
    // bloque NO se pinta: es preferible firmar como se firmaba a inventarse una microcopy.
    const firmante = (opts && opts.firmante) || null;
    const opciones = (window.appAlbaranFirmanteOpciones || []);
    const rotulos = (window.appAlbaranRotulos || {});
    let nombreInput = null, calidadSel = null, otroInput = null;

    if (firmante && opciones.length && rotulos.firmadoPorNombre && rotulos.firmadoPorCalidad) {
      const campo = (labelText) => {
        const w = document.createElement('div');
        w.style.cssText = 'margin-bottom:10px';
        const l = document.createElement('label');
        l.style.cssText = 'display:block;font-size:13px;font-weight:600;color:var(--ink);margin-bottom:4px';
        l.textContent = labelText;
        w.appendChild(l);
        card.appendChild(w);
        return w;
      };
      const estilo = 'width:100%;padding:10px 12px;font-size:15px;font-family:inherit;color:var(--ink);' +
        'background:var(--surface,#fff);border:1px solid var(--border);border-radius:10px;min-height:44px';

      const wNombre = campo(rotulos.firmadoPorNombre);
      nombreInput = document.createElement('input');
      nombreInput.type = 'text';
      nombreInput.style.cssText = estilo;
      nombreInput.maxLength = 160;
      // Precargado con el del cliente: el caso mayoritario es que firme él.
      nombreInput.value = firmante.nombre || '';
      wNombre.appendChild(nombreInput);

      const wCalidad = campo(rotulos.firmadoPorCalidad);
      calidadSel = document.createElement('select');
      calidadSel.style.cssText = estilo;
      opciones.forEach((o) => {
        const op = document.createElement('option');
        op.value = o.ranura;
        op.textContent = o.texto;
        calidadSel.appendChild(op);
      });
      wCalidad.appendChild(calidadSel);

      const wOtro = campo('');
      wOtro.style.display = 'none';
      otroInput = document.createElement('input');
      otroInput.type = 'text';
      otroInput.style.cssText = estilo;
      otroInput.maxLength = 120;
      const ranuraLibre = opciones.find((o) => o.libre);
      otroInput.placeholder = ranuraLibre ? ranuraLibre.texto : '';
      wOtro.appendChild(otroInput);
      calidadSel.addEventListener('change', () => {
        const libre = (opciones.find((o) => o.ranura === calidadSel.value) || {}).libre === true;
        wOtro.style.display = libre ? '' : 'none';
        if (libre) otroInput.focus();
      });
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
        okBtn.disabled = false;
        okBtn.style.opacity = '1';
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
      okBtn.disabled = true;
      okBtn.style.opacity = '.6';
    });
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
      const dataUri = canvas.toDataURL('image/png');
      // SCRUM-300: los datos del firmante viajan en un SEGUNDO argumento, así que un llamador
      // que solo espere `onConfirm(dataUri)` sigue funcionando igual.
      const extras = calidadSel
        ? {
            firmadoPorNombre: nombreInput ? nombreInput.value : '',
            firmadoPorCalidad: calidadSel.value,
            firmadoPorCalidadOtro: otroInput ? otroInput.value : '',
          }
        : {};
      close();
      onConfirm(dataUri, extras);
    });

    document.body.appendChild(overlay);
    return { close };
  }

  window.openSignaturePad = openSignaturePad;
})();
