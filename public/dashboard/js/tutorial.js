// public/dashboard/js/tutorial.js
// Sistema de ayuda in-app (Sprint TUTORIAL):
//  - Tooltips contextuales que aparecen UNA vez por sección (TUT-1)
//  - Guía de inicio rápido accesible siempre desde un botón flotante (TUT-2)

// ── Tooltips de primer uso ────────────────────────────────────────────────
const TUTORIAL_TIPS = {
  home: {
    selector: '.home-cta',
    text: '👋 Empieza aquí: crea tu primer presupuesto en 30 segundos.',
    position: 'bottom',
  },
  'quotes-new': {
    selector: '#qq-customer-input, .quote-lines-header, input',
    text: '💡 Busca un cliente o créalo al vuelo, y añade los servicios de tu catálogo.',
    position: 'bottom',
  },
  products: {
    selector: 'input[name="name"]',
    text: '💡 Guarda tus servicios con su precio: luego se autocompletan al cotizar.',
    position: 'bottom',
  },
  reports: {
    selector: '.customers-card',
    text: '📊 Aquí ves tu funnel de conversión y qué servicios te rentan más.',
    position: 'bottom',
  },
};

function tutShownTips() {
  try { return JSON.parse(localStorage.getItem('yaqu_tips_shown') || '{}'); }
  catch { return {}; }
}
function tutMarkShown(key) {
  const shown = tutShownTips();
  shown[key] = true;
  try { localStorage.setItem('yaqu_tips_shown', JSON.stringify(shown)); } catch {}
}

function maybeShowSectionTip(view) {
  // QA/headless (Playwright, Edge --headless): sin tooltips — capturas limpias
  if (navigator.webdriver || /Headless/i.test(navigator.userAgent)) return;
  const tip = TUTORIAL_TIPS[view];
  if (!tip) return;
  if (tutShownTips()[view]) return;

  // Esperamos un poco a que la vista termine de renderizar
  setTimeout(() => {
    const target = document.querySelector(tip.selector);
    if (!target) return;
    // El objetivo entra en vista antes de iluminarlo (puede estar bajo el fold)
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => showTutorialTooltip(target, tip.text, tip.position || 'bottom'), 280);
    tutMarkShown(view);
  }, 600);
}

// Coach-mark: ilumina el elemento real (spotlight con anillo de marca sobre un
// scrim que deja pasar el clic), apunta con una flecha y coloca el globo SIN
// taparlo. El único botón verde de la pantalla sigue siendo el CTA real, así que
// "Entendido" va discreto (Regla de Una Sola Voz).
function showTutorialTooltip(target, text, position) {
  closeTutorialTooltip();

  const GAP = 12;       // separación globo↔objetivo
  const PAD = 6;        // aire del anillo alrededor del objetivo
  const EDGE = 12;      // margen mínimo a los bordes de pantalla

  // Scrim + spotlight (recorte vía box-shadow de gran spread; centro libre)
  const spot = document.createElement('div');
  spot.id = 'tut-spotlight';
  spot.style.cssText = `
    position:fixed;z-index:360;pointer-events:none;border-radius:var(--radius-lg);
    box-shadow:0 0 0 9999px rgba(15,28,23,.55), 0 0 0 3px var(--brand);
    opacity:0;transition:opacity .2s;
  `;
  document.body.appendChild(spot);

  // Globo
  const tip = document.createElement('div');
  tip.id = 'tut-tooltip';
  tip.style.cssText = `
    position:fixed;z-index:400;max-width:268px;background:var(--ink);color:#fff;
    font-size:13px;line-height:1.45;padding:12px 14px;border-radius:var(--radius-md);
    box-shadow:var(--shadow-lg);opacity:0;transition:opacity .2s;
  `;
  tip.innerHTML = `
    <div>${text}</div>
    <button id="tut-close" style="margin-top:10px;background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:var(--radius-full);padding:5px 14px;font-size:12px;font-weight:600;cursor:pointer">Entendido</button>
  `;
  document.body.appendChild(tip);

  // Flecha (cuadrado rotado del color del globo)
  const caret = document.createElement('div');
  caret.id = 'tut-caret';
  caret.style.cssText = `position:fixed;z-index:401;width:12px;height:12px;background:var(--ink);transform:rotate(45deg);opacity:0;transition:opacity .2s;`;
  document.body.appendChild(caret);

  const place = () => {
    const rect = target.getBoundingClientRect();

    // Spotlight pegado al objetivo, con el mismo radio que el elemento iluminado
    const tr = getComputedStyle(target).borderRadius;
    spot.style.borderRadius = (tr && tr !== '0px') ? `calc(${tr} + ${PAD}px)` : 'var(--radius-lg)';
    spot.style.top = (rect.top - PAD) + 'px';
    spot.style.left = (rect.left - PAD) + 'px';
    spot.style.width = (rect.width + PAD * 2) + 'px';
    spot.style.height = (rect.height + PAD * 2) + 'px';

    const tw = tip.offsetWidth, th = tip.offsetHeight;
    // Preferimos la posición pedida; si no cabe, volteamos para NO tapar el objetivo
    let below = position !== 'top';
    const spaceBelow = window.innerHeight - rect.bottom - GAP - EDGE;
    const spaceAbove = rect.top - GAP - EDGE;
    if (below && th > spaceBelow && spaceAbove > spaceBelow) below = false;
    if (!below && th > spaceAbove && spaceBelow > spaceAbove) below = true;

    let top = below ? rect.bottom + GAP + PAD : rect.top - PAD - GAP - th;
    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - tw - EDGE));
    top = Math.max(EDGE, Math.min(top, window.innerHeight - th - EDGE));
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';

    // Flecha centrada en el objetivo, pegada al borde del globo que mira hacia él
    const cx = Math.max(left + 12, Math.min(rect.left + rect.width / 2, left + tw - 12));
    caret.style.left = (cx - 6) + 'px';
    caret.style.top = (below ? top - 6 : top + th - 6) + 'px';
  };

  place();
  requestAnimationFrame(() => { spot.style.opacity = '1'; tip.style.opacity = '1'; caret.style.opacity = '1'; });

  const onScrollResize = () => place();
  const onKey = (e) => { if (e.key === 'Escape') closeTutorialTooltip(); };
  window.addEventListener('resize', onScrollResize);
  window.addEventListener('scroll', onScrollResize, true);
  document.addEventListener('keydown', onKey);
  tip._cleanup = () => {
    window.removeEventListener('resize', onScrollResize);
    window.removeEventListener('scroll', onScrollResize, true);
    document.removeEventListener('keydown', onKey);
  };

  tip.querySelector('#tut-close').addEventListener('click', closeTutorialTooltip);
  // Clic fuera del globo (incluido el propio objetivo iluminado) cierra el coach-mark
  setTimeout(() => {
    document.addEventListener('click', function onDoc(e) {
      if (!tip.contains(e.target)) { closeTutorialTooltip(); document.removeEventListener('click', onDoc); }
    });
  }, 100);
}

function closeTutorialTooltip() {
  const tip = document.getElementById('tut-tooltip');
  if (tip && tip._cleanup) tip._cleanup();
  tip?.remove();
  document.getElementById('tut-spotlight')?.remove();
  document.getElementById('tut-caret')?.remove();
}

// ── Guía de inicio rápido (panel lateral) ─────────────────────────────────
const TUTORIAL_GUIDE = [
  {
    q: '¿Cómo envío mi primer presupuesto?',
    steps: [
      'Pulsa "Nueva cotización rápida" en Inicio.',
      'Elige o crea el cliente y añade los servicios.',
      'Pulsa "Enviar por WhatsApp": el cliente lo recibe al instante.',
    ],
  },
  {
    q: '¿Cómo añado mis servicios al catálogo?',
    steps: [
      'Ve a la sección "Productos".',
      'Rellena nombre y precio y guarda. Se autocompletarán al cotizar.',
    ],
  },
  {
    q: '¿Cómo funciona el cobro?',
    steps: [
      'Al crear el presupuesto eliges las condiciones de pago.',
      'Cuando el cliente acepta y firma, se genera la factura.',
      'El cliente paga con tarjeta o transferencia desde el enlace.',
    ],
  },
];

function ensureHelpButton() {
  if (document.getElementById('tut-help-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'tut-help-btn';
  btn.title = 'Guía de inicio';
  btn.textContent = '?';
  btn.style.cssText = `
    position:fixed;bottom:20px;right:20px;z-index:350;width:48px;height:48px;
    border-radius:50%;border:none;background:#0f1c17;color:#fff;font-size:22px;
    font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25);
  `;
  btn.addEventListener('click', openHelpGuide);
  document.body.appendChild(btn);
}

// SCRUM-416 · se expone para que la ayuda del modal abra ESTA misma guía y no otra. Si hubiera
// dos, la del modal se quedaría atrás el día que alguien mejore la del FAB — y nadie lo notaría.
window.openHelpGuide = openHelpGuide;

function openHelpGuide() {
  if (document.getElementById('tut-guide-backdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'tut-guide-backdrop';
  // SCRUM-416 · 600 y no 360. Los modales van a 500 (`styles.css`), así que a 360 este panel se
  // abría DETRÁS de la modal desde la que lo acabas de pedir: un «?» que no enseña nada es peor que
  // no tener «?». La ayuda va encima de lo que explica.
  //
  // ⚠️ Sigue por DEBAJO del overlay de la firma (1200), que es uno de los dos casos declarados sin
  // resolver en `docs/master/SCRUM-416.md`.
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.4);z-index:600;display:flex;justify-content:flex-end';

  const panel = document.createElement('div');
  panel.style.cssText = `
    width:100%;max-width:400px;height:100%;background:#fff;box-shadow:-8px 0 40px rgba(0,0,0,.15);
    padding:24px 22px;overflow-y:auto;transform:translateX(100%);transition:transform .25s;
  `;
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;color:#0f1c17">Guía de inicio</h2>
      <button id="tut-guide-close" style="border:none;background:none;font-size:24px;cursor:pointer;color:#6b756f">&times;</button>
    </div>
    ${TUTORIAL_GUIDE.map((g, i) => `
      <div style="border:1px solid #e7e9e5;border-radius:12px;margin-bottom:10px;overflow:hidden">
        <button class="tut-acc" data-i="${i}" style="width:100%;text-align:left;padding:13px 14px;background:#f7f8f6;border:none;cursor:pointer;font-size:14px;font-weight:600;color:#0f1c17;display:flex;justify-content:space-between;align-items:center">
          <span>${g.q}</span><span style="color:#22c55e">+</span>
        </button>
        <div class="tut-acc-body" data-i="${i}" style="display:none;padding:12px 16px">
          <ol style="margin:0;padding-left:18px;color:#333c37;font-size:14px;line-height:1.7">
            ${g.steps.map((s) => `<li>${s}</li>`).join('')}
          </ol>
        </div>
      </div>
    `).join('')}
    <p style="margin-top:18px;font-size:13px;color:#6b756f">¿Necesitas más ayuda? Escríbenos a <a href="mailto:hola@yaqu.app" style="color:#16a34a">hola@yaqu.app</a></p>
  `;
  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => { panel.style.transform = 'translateX(0)'; });

  const close = () => backdrop.remove();
  panel.querySelector('#tut-guide-close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  panel.querySelectorAll('.tut-acc').forEach((b) => {
    b.addEventListener('click', () => {
      const body = panel.querySelector(`.tut-acc-body[data-i="${b.dataset.i}"]`);
      const open = body.style.display === 'block';
      body.style.display = open ? 'none' : 'block';
      b.querySelector('span:last-child').textContent = open ? '+' : '−';
    });
  });
}
