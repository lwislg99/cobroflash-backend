// public/dashboard/js/voiceInput.js — VZ-1 (VOZ-1, master U1.5)
// Dictado por voz hacia un <textarea> SIEMPRE editable (la voz propone, el
// humano corrige). Filosofía: allowlist conservadora + prueba de humo real en
// el primer tap. Degradación SILENCIOSA: si algo no cuadra, el micro no se
// pinta (o se retira) y queda el textarea — jamás un botón roto.
//
// Gate de producto: solo se pinta con el flag VOICE_QUOTE_ENABLED activo
// (window.appVoiceEnabled, servido por /admin/me). Rollback sin deploy.

(function () {
  'use strict';

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS se disfraza de Mac
  }
  // SCRUM-360 (H5 · fase 1): la detección SE FUE a `api.js` (`entornoDeLaApp`), que es el primer
  // script del dashboard y ya está precacheado. Aquí queda sólo la lectura — **la copia NO se
  // conserva**: dos detecciones del mismo hecho derivan en silencio, que es justo el defecto que
  // SCRUM-436 y SCRUM-447 acaban de cerrar con los formateadores de euros.
  //
  // El comportamiento NO cambia: la compartida distingue tres estados y aquí sólo interesa uno, así
  // que «no se pudo evaluar» sigue dando `false`, igual que antes.
  function isStandalonePWA() {
    return window.entornoDeLaApp ? window.entornoDeLaApp() === window.ENTORNO_INSTALADA : false;
  }

  // ── Paso 1 del plan: gate estático (si falla, NI SE PINTA) ────────────────
  function voiceSupportProbe() {
    if (window.appVoiceEnabled !== true) return false;            // flag OFF
    if (!SR) return false;                                        // sin API (Firefox…)
    if (!window.isSecureContext) return false;                    // exige https
    if (isIOS() && isStandalonePWA()) return false;               // iOS PWA: API declarada pero rota
    if (sessionStorage.getItem('voiceUnsupported') === '1') return false; // humo falló antes
    return true;
  }
  window.voiceSupportProbe = voiceSupportProbe;

  function toast(msg) {
    if (typeof showToast === 'function') showToast(msg, 'warn');
  }

  // 🔴 SCRUM-654 · MICROCOPY SIN APROBAR (regla 30): el texto lo aprueba el fundador y sale con
  // marcador hasta que lo firme. Se propone que diga LAS DOS COSAS —que hace falta conexión y que
  // puede escribirlo a mano—: un aviso que solo da la mala noticia deja al técnico parado.
  //
  // Y la coletilla es la MISMA que ya usan los otros dos avisos de este fichero («escribe el
  // trabajo y listo»): misma situación, mismas palabras. Estrenar una redacción aquí daría dos
  // formas de decir lo mismo en la misma pantalla.
  var AVISO_SIN_CONEXION =
    '[PENDIENTE microcopy oficial] El dictado necesita conexión — escribe el trabajo y listo';

  // Retira TODOS los micros de la página (humo fallido → fuera para la sesión)
  function killAllMics() {
    try { sessionStorage.setItem('voiceUnsupported', '1'); } catch (_e) {}
    document.querySelectorAll('.voice-mic-btn').forEach(function (b) { b.remove(); });
    document.querySelectorAll('.voice-interim').forEach(function (i) { i.remove(); });
  }

  /**
   * Monta el botón de dictado junto a un textarea.
   * opts.onVoiceUsed: callback la primera vez que entra texto por voz (telemetría VZ-3).
   * Devuelve true si se pintó el micro.
   */
  function attachVoiceInput(textarea, opts) {
    opts = opts || {};
    if (!textarea || !voiceSupportProbe()) return false;
    if (textarea.dataset.voiceAttached === '1') return true; // idempotente
    textarea.dataset.voiceAttached = '1';

    var lang = (window.appLocale && window.appLocale.speechLang) || 'es-ES';

    // Botón micro (target ≥44px, AB6) + zona de texto provisional (interim)
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'voice-mic-btn';
    btn.setAttribute('aria-label', 'Dictar por voz');
    btn.title = 'Dictar por voz';
    btn.innerHTML = '🎤 <span class="voice-mic-label">Dictar</span>';

    var interim = document.createElement('div');
    interim.className = 'voice-interim';
    interim.setAttribute('aria-live', 'polite');

    textarea.insertAdjacentElement('afterend', interim);
    interim.insertAdjacentElement('afterend', btn);

    var rec = null;
    var listening = false;
    var gotStart = false;
    var voiceUsedFired = false;

    function setListening(on) {
      listening = on;
      btn.classList.toggle('listening', on);
      btn.innerHTML = on
        ? '<span class="voice-dot" aria-hidden="true"></span> Escuchando… (toca para parar)'
        : '🎤 <span class="voice-mic-label">Dictar</span>';
      if (!on) interim.textContent = '';
    }

    function appendFinal(text) {
      var t = String(text || '').trim();
      if (!t) return;
      var cur = textarea.value;
      textarea.value = cur ? cur.replace(/\s*$/, '') + ' ' + t : t;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      if (!voiceUsedFired) {
        voiceUsedFired = true;
        textarea.dataset.voiceUsed = '1'; // hook VZ-3 (telemetría)
        if (typeof opts.onVoiceUsed === 'function') { try { opts.onVoiceUsed(); } catch (_e) {} }
      }
    }

    function stop() {
      if (rec) { try { rec.stop(); } catch (_e) {} }
      setListening(false);
    }

    function start() {
      rec = new SR();
      rec.lang = lang;
      rec.continuous = true;       // dictado largo (el pro habla en la furgoneta)
      rec.interimResults = true;
      gotStart = false;

      // Paso 2 del plan: watchdog de humo — 3s sin onstart = no soportado de verdad
      var watchdog = setTimeout(function () {
        if (!gotStart) {
          stop();
          killAllMics();
          toast('El dictado no está disponible en este navegador — escribe el trabajo y listo');
        }
      }, 3000);

      rec.onstart = function () {
        gotStart = true;
        clearTimeout(watchdog);
        setListening(true);
      };

      rec.onresult = function (ev) {
        var interimText = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var r = ev.results[i];
          if (r.isFinal) appendFinal(r[0] && r[0].transcript);
          else interimText += (r[0] && r[0].transcript) || '';
        }
        interim.textContent = interimText;
      };

      rec.onerror = function (ev) {
        clearTimeout(watchdog);
        var code = (ev && ev.error) || '';
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
          // Paso 2: sin permiso/servicio → fuera el micro esta sesión
          stop();
          killAllMics();
          toast(code === 'not-allowed'
            ? 'Sin permiso de micrófono — escribe el trabajo y listo'
            : 'El dictado no está disponible en este navegador — escribe el trabajo y listo');
          return;
        }
        if (code === 'no-speech') {
          // Paso 3: error en caliente, mensaje humano y seguimos
          stop();
          toast('No te he oído — prueba otra vez más cerca del micro');
          return;
        }
        // 🔴 SCRUM-654 · EL FALLO MUDO, Y ERA EL QUE MÁS IBA A PASAR.
        //
        // `network` caía aquí abajo, en la rama de «cierre limpio», y se paraba SIN DECIR NADA.
        // Los otros tres errores —permiso, servicio, no-speech— sí avisaban: éste era el único
        // callado, y es el que ocurre SIEMPRE en la obra. Medido en el PASO 0 de este ticket:
        // el reconocimiento de Chrome es server-based y no funciona sin conexión (MDN), así que
        // en un garaje o un cuarto técnico el técnico toca el micro, no pasa nada, y no sabe por
        // qué. La segunda vez ya no lo toca — y se pierde la función entera por un aviso que falta.
        //
        // ⚠️ El defecto NO era que la voz no funcione sin cobertura: eso está decidido y se acepta
        // (el parte se escribe a mano, que es lo innegociable y ya funciona). El defecto era que no
        // funcionara Y NO LO DIJERA.
        //
        // ⚠️ Y NO se retira el micro (`killAllMics`) como hacen permiso y servicio: quedarse sin
        // cobertura es TEMPORAL. Al salir del sótano el dictado vuelve a funcionar, y un micro
        // retirado para toda la sesión castigaría al técnico por haber entrado en un garaje.
        if (code === 'network') {
          stop();
          toast(AVISO_SIN_CONEXION);
          return;
        }
        // aborted/otros: cierre limpio; lo ya dictado se queda en el textarea
        stop();
      };

      rec.onend = function () {
        clearTimeout(watchdog);
        setListening(false);
      };

      try { rec.start(); } catch (_e) {
        clearTimeout(watchdog);
        killAllMics();
        toast('El dictado no está disponible en este navegador — escribe el trabajo y listo');
      }
    }

    btn.addEventListener('click', function () {
      if (listening) stop();
      else start();
    });

    return true;
  }
  window.attachVoiceInput = attachVoiceInput;
})();
