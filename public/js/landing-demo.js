// A4.7 — Demo interactiva "dos actos" (patrón maqueta guiada, guion v2 aprobado).
// ACTO 1: la historia del dinero en 4 escenas (<30s, auto-avance 7s, clicable).
// ACTO 2: chips de exploración con capturas REALES del producto (datos del seed
// "Fontanería García" — coherencia total con la demo real).
// Vanilla puro. PROHIBIDO aquí: "factura"/claims fiscales (regla 26).
(function () {
  'use strict';

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var AUTO_MS = 7000;

  // ── Escenas del ACTO 1 ────────────────────────────────────────────────
  // Cada escena: html del contenido del "móvil" + hotspot (posición %) + caption.
  var SCENES = [
    {
      caption: 'Tu dinero, claro: lo pendiente de cobrar y lo que espera el sí.',
      hotspot: { x: 50, y: 46, label: 'Nueva cotización' },
      html: '<img src="/img/landing/home-390.png" alt="Panel de YaQu: dinero en juego" loading="lazy"/>' +
            '<div class="idemo-chip idemo-chip-money">💶 6.576,35 € en juego</div>',
    },
    {
      caption: 'Eliges del catálogo y el total se calcula solo. 30 segundos.',
      hotspot: { x: 50, y: 78, label: 'Enviar por WhatsApp' },
      html:
        '<div class="idemo-mock">' +
        '  <div class="idemo-mock-card">' +
        '    <div class="idemo-mock-title">Nuevo presupuesto · María García</div>' +
        '    <div class="idemo-mock-line"><span>Reforma de baño: fontanería</span><strong>320,00 €</strong></div>' +
        '    <div class="idemo-mock-line"><span>Mano de obra (2 h)</span><strong>70,00 €</strong></div>' +
        '    <div class="idemo-mock-line"><span>IVA (21%)</span><strong>81,90 €</strong></div>' +
        '    <div class="idemo-mock-total"><span>Total</span><strong>471,90 €</strong></div>' +
        '  </div>' +
        '</div>',
    },
    {
      caption: 'A María le llega el WhatsApp. Lo abre y firma con el dedo.',
      hotspot: { x: 50, y: 88, label: 'Aceptar y firmar' },
      html:
        '<div class="idemo-wa">' +
        '  <div class="idemo-wa-head">Fontanería García</div>' +
        '  <div class="idemo-wa-bubble">' +
        '    <strong>Tu presupuesto está listo</strong><br/>Hola María 👋<br/>' +
        '    Fontanería García te envía el presupuesto <strong>#5</strong> por <strong>471,90 €</strong>.<br/>' +
        '    Ábrelo, revísalo y fírmalo desde aquí.' +
        '    <div class="idemo-wa-btn">📄 Ver presupuesto</div>' +
        '  </div>' +
        '  <img class="idemo-wa-shot" src="/img/landing/firma-390.png" alt="Landing de firma" loading="lazy"/>' +
        '</div>',
    },
    {
      caption: 'Elige cómo pagar y tú cobras la señal antes de empezar.',
      hotspot: { x: 50, y: 56, label: 'Pagar 471,90 €' },
      final: true,
      html: '<img src="/img/landing/pago-390.png" alt="El cliente elige cómo pagar" loading="lazy"/>' +
            '<div class="idemo-paid" hidden><div class="idemo-paid-check">✓</div>' +
            '<div class="idemo-paid-toast">💰 María te ha pagado <strong>471,90 €</strong></div></div>',
    },
  ];

  // ── Chips del ACTO 2 (todo capturas/recreaciones REALES) ─────────────
  var CHIPS = [
    {
      id: 'bot', label: '🤖 Bot de WhatsApp',
      caption: 'Tu número trabaja solo: pide presupuestos y cobra pendientes.',
      html:
        '<div class="idemo-wa">' +
        '  <div class="idemo-wa-head">Fontanería García</div>' +
        '  <div class="idemo-wa-bubble idemo-wa-out">hola</div>' +
        '  <div class="idemo-wa-bubble">Hola 👋 Soy el asistente de Fontanería García. Dime qué necesitas:' +
        '    <div class="idemo-wa-btn">📄 Mis presupuestos</div>' +
        '    <div class="idemo-wa-btn">💳 Pagar pendiente</div>' +
        '    <div class="idemo-wa-btn">🛠 Pedir presupuesto</div>' +
        '  </div>' +
        '  <div class="idemo-wa-bubble idemo-wa-out">💳 Pagar pendiente</div>' +
        '  <div class="idemo-wa-bubble">Esto es lo que tienes pendiente:<br/><strong>2.383,70 €</strong> · Reforma de baño' +
        '    <div class="idemo-wa-btn">👉 Pagar seguro</div>' +
        '  </div>' +
        '</div>',
    },
    { id: 'clientes', label: '👥 Clientes', caption: 'Cada cliente con su historial: presupuestos, cobros y valoraciones.', img: '/img/landing/customers-390.png' },
    { id: 'catalogo', label: '📦 Catálogo', caption: 'Tus servicios con precio guardados: línea nueva en dos toques.', img: '/img/landing/products-390.png' },
    { id: 'informes', label: '📊 Informes', caption: 'Cuánto entra, cuánto sale y tu beneficio, mes a mes.', img: '/img/landing/reports-390.png' },
    { id: 'solicitudes', label: '📥 Solicitudes', caption: 'Lo que piden tus clientes (también por el bot) cae aquí.', img: '/img/landing/quote-requests-390.png' },
  ];

  function build(slot) {
    var root = document.createElement('div');
    root.className = 'idemo';
    root.innerHTML =
      '<div class="idemo-stage">' +
      '  <div class="idemo-phone"><div class="idemo-screen"></div>' +
      '    <button class="idemo-hotspot" type="button"><span class="idemo-pulse"></span><span class="idemo-hotlabel"></span></button>' +
      '  </div>' +
      '  <div class="idemo-side">' +
      '    <div class="idemo-caption"></div>' +
      '    <div class="idemo-progress">' + SCENES.map(function (_s, i) {
              return '<button class="idemo-dot" data-i="' + i + '" aria-label="Escena ' + (i + 1) + '"></button>';
            }).join('') +
      '      <button class="idemo-pause" aria-label="Pausar">⏸</button>' +
      '    </div>' +
      '    <div class="idemo-explore-label">Y además…</div>' +
      '    <div class="idemo-chips">' + CHIPS.map(function (c) {
              return '<button class="idemo-chipbtn" data-chip="' + c.id + '">' + c.label + '</button>';
            }).join('') +
      '    </div>' +
      // SCRUM-368: microcopy APROBADA por el fundador. Fuera «Así de fácil.»: un botón dice qué
      // pasa al pulsarlo, no aplaude la demo que el usuario acaba de ver. (Y de paso cabe con A1.)
      '    <a class="btn btn-primary idemo-cta" href="/register.html">Pruébalo con tus datos →</a>' +
      '  </div>' +
      '</div>';
    slot.appendChild(root);

    var screen = root.querySelector('.idemo-screen');
    var hotspot = root.querySelector('.idemo-hotspot');
    var hotlabel = root.querySelector('.idemo-hotlabel');
    var captionEl = root.querySelector('.idemo-caption');
    var dots = Array.prototype.slice.call(root.querySelectorAll('.idemo-dot'));
    var pauseBtn = root.querySelector('.idemo-pause');
    var chipBtns = Array.prototype.slice.call(root.querySelectorAll('.idemo-chipbtn'));

    var idx = 0, timer = null, paused = false, mode = 'story'; // story | chip

    function setScene(i) {
      mode = 'story';
      idx = (i + SCENES.length) % SCENES.length;
      var s = SCENES[idx];
      screen.innerHTML = s.html;
      captionEl.textContent = s.caption;
      hotspot.style.left = s.hotspot.x + '%';
      hotspot.style.top = s.hotspot.y + '%';
      hotlabel.textContent = s.hotspot.label;
      hotspot.hidden = false;
      dots.forEach(function (d, j) { d.classList.toggle('on', j === idx); });
      chipBtns.forEach(function (b) { b.classList.remove('on'); });
      restart();
    }

    function finishStory() {
      // Momento WOW final: check + toast de cobro
      var paid = screen.querySelector('.idemo-paid');
      if (paid) { paid.hidden = false; hotspot.hidden = true; }
      stop();
    }

    function advance() {
      if (mode !== 'story') return;
      if (SCENES[idx].final) { finishStory(); return; }
      setScene(idx + 1);
    }

    function setChip(id) {
      var c = CHIPS.filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      mode = 'chip';
      stop();
      screen.innerHTML = c.img
        ? '<img src="' + c.img + '" alt="' + c.caption + '" loading="lazy"/>'
        : c.html;
      captionEl.textContent = c.caption;
      hotspot.hidden = true;
      dots.forEach(function (d) { d.classList.remove('on'); });
      chipBtns.forEach(function (b) { b.classList.toggle('on', b.dataset.chip === id); });
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() {
      stop();
      if (REDUCED || paused) return;
      timer = setInterval(advance, AUTO_MS);
    }

    hotspot.addEventListener('click', advance);
    dots.forEach(function (d) { d.addEventListener('click', function () { paused = false; setScene(Number(d.dataset.i)); }); });
    chipBtns.forEach(function (b) { b.addEventListener('click', function () { setChip(b.dataset.chip); }); });
    pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.textContent = paused ? '▶' : '⏸';
      pauseBtn.setAttribute('aria-label', paused ? 'Reanudar' : 'Pausar');
      if (paused) stop(); else restart();
    });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', function () { if (mode === 'story') restart(); });

    // Arranque perezoso: no consumir tiempo hasta que el bloque sea visible
    if ('IntersectionObserver' in window) {
      stop();
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { setScene(0); io.disconnect(); } });
      }, { threshold: 0.3 });
      io.observe(root);
      // pinta la primera escena sin timer para que no esté vacío
      screen.innerHTML = SCENES[0].html;
      captionEl.textContent = SCENES[0].caption;
      hotspot.style.left = SCENES[0].hotspot.x + '%';
      hotspot.style.top = SCENES[0].hotspot.y + '%';
      hotlabel.textContent = SCENES[0].hotspot.label;
    } else {
      setScene(0);
    }
  }

  window.buildInteractiveDemo = build;
})();
