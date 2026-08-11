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
    <div id="tut-soporte" style="margin-top:18px;border-top:1px solid #e7e9e5;padding-top:16px">
      <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#0f1c17">Escríbenos</p>
      <label for="tut-soporte-txt" style="display:block;font-size:13px;color:#6b756f;margin-bottom:6px">¿Qué ha pasado?</label>
      <textarea id="tut-soporte-txt" rows="4" maxlength="4000" style="width:100%;box-sizing:border-box;padding:10px 12px;font:inherit;font-size:14px;color:#0f1c17;background:#fff;border:1px solid #cdd2cb;border-radius:10px;resize:vertical"></textarea>
      <button id="tut-soporte-enviar" type="button" style="margin-top:8px;width:100%;min-height:44px;padding:11px;font:inherit;font-size:15px;font-weight:700;color:#fff;background:#16a34a;border:none;border-radius:10px;cursor:pointer">Enviar</button>
      <p id="tut-soporte-estado" role="status" aria-live="polite" style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#6b756f"></p>
    </div>
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

  montarEscribenos(panel);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-406 · «ESCRÍBENOS» — el mensaje llega a alguien, y el contexto viaja con él.
//
// Aquí había un `mailto:`, y un `mailto:` **abre el cliente de correo del móvil** —que en un móvil
// de trabajo puede no estar configurado— y se lleva el hilo a la bandeja personal del profesional,
// fuera del producto para siempre. Además llegaba sin nada: ni quién, ni desde dónde.
//
// El `mailto:` NO desaparece: sigue ahí como salida cuando el envío no sale (abajo). Lo que cambia
// es cuál es el camino normal.
//
// MICROCOPY (regla 30): los cuatro textos —«Escríbenos», «¿Qué ha pasado?», «Enviar» y la
// confirmación— están APROBADOS y se escriben literales. La confirmación **no promete plazo** a
// propósito: «en 24 h» es una promesa que hoy no hay quien sostenga.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Confirmación APROBADA. Solo se pinta si el servidor dijo que salió. */
const SOPORTE_OK = 'Lo hemos recibido. Te contestamos por correo.';
/**
 * El fallo NO es texto nuevo: es el literal de `SEND_FAILURE_MESSAGES.email_send_failed`
 * (`src/lib/sendOutcome.ts`, SCRUM-126), que el servidor ya devuelve en `message`. Aquí solo se
 * necesita para cuando el servidor **no contesta**. El guard comprueba que los dos son idénticos:
 * copy aprobada duplicada es copy que acaba divergiendo.
 */
const SOPORTE_FALLO = 'No se pudo enviar el email. Puedes reintentarlo.';

function montarEscribenos(panel) {
  const caja = panel.querySelector('#tut-soporte-txt');
  const boton = panel.querySelector('#tut-soporte-enviar');
  const estado = panel.querySelector('#tut-soporte-estado');
  if (!caja || !boton || !estado) return;

  /** La salida de siempre, por si el envío no sale. El texto que escribió NO se borra. */
  const conSalida = (texto) => {
    const dir = window.CONTACTO_YAQU || 'hola@yaqu.app';
    estado.style.color = '#b45309';
    estado.innerHTML = '';
    estado.appendChild(document.createTextNode(texto + ' '));
    const a = document.createElement('a');
    a.href = 'mailto:' + dir;
    a.textContent = dir;
    a.style.color = '#16a34a';
    estado.appendChild(a);
  };

  boton.addEventListener('click', async () => {
    const mensaje = (caja.value || '').trim();
    if (!mensaje) { caja.focus(); return; }
    boton.disabled = true;
    try {
      const r = await apiRequest('/admin/soporte', {
        method: 'POST',
        // La PANTALLA es lo único que aporta el cliente: el resto del contexto —quién, y si va
        // instalada o en pestaña— lo lee el servidor de donde ya vive (SCRUM-360 fase 2).
        body: JSON.stringify({ mensaje, pantalla: location.hash || '/' }),
      });
      // 🔴 `sent` es la ÚNICA verdad sobre si salió (SCRUM-126). `ok` no la sustituye: el servidor
      // responde 200 también cuando el correo no ha salido, y confundirlos es exactamente cómo se
      // construye un formulario que dice «recibido» sin haber recibido nada.
      if (r && r.sent === true) {
        estado.style.color = '#166534';
        estado.textContent = SOPORTE_OK;
        caja.value = '';
        caja.disabled = true;
        boton.style.display = 'none';
        return;
      }
      conSalida((r && r.message) || SOPORTE_FALLO);
      boton.disabled = false;
    } catch (e) {
      // ⚠️ DECISIÓN, no descuido: SCRUM-459 marca la mutación vencida como `incierto` —«no sé si
      // llegó»— y avisa de que decir «no salió» invita a repetir. Aquí se trata como fallo IGUAL,
      // porque lo que se repite es **un correo de soporte**: recibirlo dos veces no cuesta nada, y
      // callarse deja al profesional sin saber si alguien le va a contestar. En una firma o un
      // cobro la decisión sería la contraria. Si el fundador quiere un tercer texto para este
      // estado, es una línea — hoy no existe copy aprobada para él y no se inventa (regla 30).
      conSalida(SOPORTE_FALLO);
      boton.disabled = false;
    }
  });
}
