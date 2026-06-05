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
  const tip = TUTORIAL_TIPS[view];
  if (!tip) return;
  if (tutShownTips()[view]) return;

  // Esperamos un poco a que la vista termine de renderizar
  setTimeout(() => {
    const target = document.querySelector(tip.selector);
    if (!target) return;
    showTutorialTooltip(target, tip.text, tip.position || 'bottom');
    tutMarkShown(view);
  }, 600);
}

function showTutorialTooltip(target, text, position) {
  document.getElementById('tut-tooltip')?.remove();

  const rect = target.getBoundingClientRect();
  const tip = document.createElement('div');
  tip.id = 'tut-tooltip';
  tip.style.cssText = `
    position:fixed;z-index:400;max-width:260px;background:#0f1c17;color:#fff;
    font-size:13px;line-height:1.45;padding:11px 14px;border-radius:12px;
    box-shadow:0 12px 30px rgba(0,0,0,.25);opacity:0;transition:opacity .2s;
  `;
  tip.innerHTML = `
    <div>${text}</div>
    <button id="tut-close" style="margin-top:8px;background:#22c55e;color:#052e16;border:none;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">Entendido</button>
  `;
  document.body.appendChild(tip);

  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let top, left;
  if (position === 'top') {
    top = rect.top - th - 10;
    left = rect.left + rect.width / 2 - tw / 2;
  } else {
    top = rect.bottom + 10;
    left = rect.left + rect.width / 2 - tw / 2;
  }
  // Mantener dentro de la pantalla
  left = Math.max(12, Math.min(left, window.innerWidth - tw - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - th - 12));
  tip.style.top = top + 'px';
  tip.style.left = left + 'px';
  requestAnimationFrame(() => { tip.style.opacity = '1'; });

  const close = () => tip.remove();
  tip.querySelector('#tut-close').addEventListener('click', close);
  setTimeout(() => {
    document.addEventListener('click', function onDoc(e) {
      if (!tip.contains(e.target)) { close(); document.removeEventListener('click', onDoc); }
    });
  }, 100);
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

function openHelpGuide() {
  if (document.getElementById('tut-guide-backdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'tut-guide-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.4);z-index:360;display:flex;justify-content:flex-end';

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
