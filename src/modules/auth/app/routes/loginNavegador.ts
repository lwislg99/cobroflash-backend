// src/modules/auth/app/routes/loginNavegador.ts — SCRUM-1647c (CSP paso 2, tramo de J3: la página de acceso)
//
// EL GUION DE `public/login.html`, FUERA DEL HTML.
//
// Hasta SCRUM-1647c vivía en un `<script>` en línea al final de `login.html`, y el enlace «Reenviar
// enlace · Cambiar email» que aparece al acabar la cuenta atrás se pintaba con DOS `onclick=` dentro
// de un `innerHTML`. Con `script-src 'self'` aplicada (SCRUM-1637, paso 3) nada de eso corre: la
// página no podría ni pedir el enlace mágico.
//
// LO QUE CAMBIA, y nada más (cero cambios visibles: mueve código, no copy — regla 39):
//  · el código pasa de la página a esta cadena, servida desde `'self'` en `GET /auth/js/login.js`;
//  · los dos `onclick="sendLink()"` / `onclick="changeEmail()"` pasan a `data-accion="reenviar"` /
//    `data-accion="cambiar"` con UN `addEventListener('click')` delegado en `#resend-row`;
//  · la plantilla `¿No llegó? Puedes reenviar en <strong…>${remaining}s</strong>` pasa a una
//    concatenación con el mismo resultado (dentro de `String.raw` no puede ir otra plantilla).
// Los textos, el orden de las llamadas y la tabla `msgs` están copiados tal cual del HTML de
// `origin/main` = `9cdf6a24d`. Lo vigilan `tests/scrum1647c-login-sin-script-en-linea.test.mjs`
// (0 `on*=` y 0 `<script>` sin `src`, y el recorrido del enlace mágico en un DOM de banco) y
// `tests/scrum264-copy-que-llega-al-cliente.test.mjs` (la expresión que pinta el error).
//
// POR QUÉ LO SIRVE EL ROUTER DE `auth` Y NO `public/js/`: `public/**` es carril S2 salvo las rutas
// nombradas (dos-equipos.md §3.2); `src/modules/auth/**` es J3. Es el mismo patrón que S1 eligió para
// el albarán público (SCRUM-1646, `albaranFirmaNavegador.ts`) por el mismo motivo.
//
// 🔴 La cadena es CONSTANTE (`String.raw` sin sustituciones): ningún dato de la petición entra en el
// código, que es lo que una CSP con nonce no garantizaría (SCRUM-1632c).

/** Ruta pública del guion, relativa al montaje de `authRouter` en `/auth`. */
export const RUTA_LOGIN_JS = '/js/login.js';

export const LOGIN_JS = String.raw`// YaQu · guion de /login.html (SCRUM-1647c: fuera del HTML para que la CSP se pueda aplicar)
  // Si ya hay sesión válida, redirigir al dashboard
  fetch('/admin/me').then(r => { if (r.ok) window.location.href = '/dashboard/'; }).catch(() => {});

  // SCRUM-275: la tabla vive FUERA del «if» a propósito. Estaba declarada dentro, así que
  // «sendLink()» no la tenía ni en el alcance: la página sabía traducir los códigos que llegan
  // por la URL (al pulsar el enlace del correo) y no podía traducir los que devuelve la API
  // (al pedirlo), aunque son la misma clase de código y la misma pantalla.
  const msgs = {
    link_expired:   'El enlace ha caducado o ya fue usado. Solicita uno nuevo.',
    invalid_token:  'Enlace inválido.',
    internal_error: 'Error interno. Inténtalo de nuevo.',
    invalid_email:  'Escribe un correo electrónico válido.',
  };

  // Mostrar errores de URL (vuelve de /auth/verify)
  const params = new URLSearchParams(location.search);
  if (params.get('error')) {
    showAlert(msgs[params.get('error')] || 'Error desconocido.', 'error');
  }

  let countdownTimer = null;

  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    sendLink();
  });

  // SCRUM-1647c: lo que antes eran dos «onclick=» dentro del innerHTML de la cuenta atrás.
  document.getElementById('resend-row').addEventListener('click', (e) => {
    const enlace = e.target && e.target.closest ? e.target.closest('[data-accion]') : null;
    if (!enlace) return;
    const accion = enlace.getAttribute('data-accion');
    if (accion === 'reenviar') sendLink();
    else if (accion === 'cambiar') changeEmail();
  });

  async function sendLink() {
    const emailInput = document.getElementById('email');
    const email = emailInput.value.trim();
    const btn = document.getElementById('btn');

    clearInterval(countdownTimer);
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    document.getElementById('resend-row').style.display = 'none';

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // SCRUM-275: si la respuesta no es JSON (un 500 con cuerpo vacío o HTML), esto lanzaba y
      // el «catch» de abajo lo etiquetaba «Error de conexión», mandando al usuario a mirar su
      // wifi con el servidor caído. Un diagnóstico falso es peor que uno genérico.
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showAlert('✉️ Enlace enviado. Revisa tu bandeja de entrada (y spam).', 'ok');
        emailInput.disabled = true;
        startCountdown(60);
      } else {
        // El texto humano gana al código (SCRUM-151/264); el código queda de reserva para los
        // endpoints que aún no mandan «message» — es mejor que un genérico, se puede buscar.
        showAlert(data.message || msgs[data.error] || data.error || 'Error al enviar el enlace.', 'error');
        btn.disabled = false;
        btn.textContent = 'Enviar enlace de acceso';
      }
    } catch {
      showAlert('Error de conexión. Comprueba tu internet.', 'error');
      btn.disabled = false;
      btn.textContent = 'Enviar enlace de acceso';
    }
  }

  function startCountdown(seconds) {
    const btn = document.getElementById('btn');
    const resendRow = document.getElementById('resend-row');
    let remaining = seconds;

    resendRow.style.display = 'block';
    resendRow.innerHTML = '¿No llegó? Puedes reenviar en <strong id="countdown">' + remaining + 's</strong>';

    countdownTimer = setInterval(() => {
      remaining--;
      const el = document.getElementById('countdown');
      if (el) el.textContent = remaining + 's';

      if (remaining <= 0) {
        clearInterval(countdownTimer);
        btn.disabled = false;
        btn.textContent = 'Enviar enlace de acceso';
        document.getElementById('email').disabled = false;
        resendRow.innerHTML = '¿No llegó? <a data-accion="reenviar">Reenviar enlace</a> · <a data-accion="cambiar">Cambiar email</a>';
      }
    }, 1000);
  }

  function changeEmail() {
    clearInterval(countdownTimer);
    document.getElementById('email').disabled = false;
    document.getElementById('email').value = '';
    document.getElementById('email').focus();
    document.getElementById('btn').disabled = false;
    document.getElementById('btn').textContent = 'Enviar enlace de acceso';
    document.getElementById('alert').style.display = 'none';
    document.getElementById('resend-row').style.display = 'none';
  }

  function showAlert(msg, type) {
    const el = document.getElementById('alert');
    el.innerHTML = msg;
    el.className = 'alert ' + type;
    el.style.display = 'block';
  }
`;
