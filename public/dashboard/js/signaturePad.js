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
      close();
      onConfirm(dataUri);
    });

    document.body.appendChild(overlay);
    return { close };
  }

  window.openSignaturePad = openSignaturePad;
})();
