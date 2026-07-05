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
  function isStandalonePWA() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true; // Safari iOS legacy
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
        // network/aborted/otros: cierre limpio; lo ya dictado se queda en el textarea
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
