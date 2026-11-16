// src/modules/auth/app/routes/altaNavegador.ts — SCRUM-1647d (CSP paso 2, tramo de J3: la página de alta)
//
// EL GUION DE `public/register.html`, FUERA DEL HTML.
//
// Hasta SCRUM-1647d vivía en un `<script>` en línea al final de `register.html`. Con `script-src 'self'`
// aplicada (SCRUM-1637, paso 3) no corre: el formulario se enviaría como un GET a la propia página, sin
// `preventDefault`, y no se crearía ninguna cuenta. Y los dos `style="display:none"` (la insignia del
// amigo que invita y la caja de avisos) los ignora `style-src 'self'`: la insignia «Te ha invitado un
// amigo» se vería a TODO el que entra.
//
// LO QUE CAMBIA, y nada más (cero cambios visibles: mueve código, no copy — regla 39):
//  · el código pasa de la página a esta cadena, servida desde `'self'` en `GET /auth/js/alta.js`;
//  · los dos `style="display:none"` de la página pasan a `hidden`; el guion las sigue abriendo con
//    `style.display = 'block'` (CSSOM, que la CSP no bloquea), igual que el de `login.html` (1647c).
// El cuerpo de la cadena es el del `<script>` de `origin/main` = `31858144e` línea a línea, incluido el
// código del alta con invitación de S1 (SCRUM-1685: provincia y las dos preguntas de domicilio,
// `pintarCamposEs`). Única diferencia: tres comentarios citaban con acentos graves, que no caben en
// `String.raw`, y citan con «». No hay oyentes nuevos: la página no tenía manejadores en línea.
// Lo vigilan `tests/scrum1647d-alta-sin-script-en-linea.test.mjs` (0 `<script>` sin `src`, 0 `style=`,
// la ruta por el router real y la copia exacta) y `tests/scrum1685-formulario-de-alta.test.mjs` (el
// alta con invitación de punta a punta, que ahora ejecuta ESTA cadena).
//
// POR QUÉ LO SIRVE EL ROUTER DE `auth` Y NO `public/js/`: `public/**` es carril S2 salvo las rutas
// nombradas (dos-equipos.md §3.2); `src/modules/auth/**` es J3. Mismo patrón que `loginNavegador.ts`.
//
// 🔴 La cadena es CONSTANTE (`String.raw` sin sustituciones): ningún dato de la petición entra en el
// código, que es lo que una CSP con nonce no garantizaría (SCRUM-1632c).

/** Ruta pública del guion, relativa al montaje de `authRouter` en `/auth`. */
export const RUTA_ALTA_JS = '/js/alta.js';

export const ALTA_JS = String.raw`  // Código de referido desde la URL (?ref=CODIGO).
  //
  // SCRUM-336: antes había un segundo origen —lo que la landing hubiera guardado en
  // «localStorage»— y se retiró: almacenar la atribución en el equipo del visitante sin
  // consentimiento no es imprescindible para el servicio pedido (ePrivacy art. 5.3). Ahora el
  // código viaja en la URL desde el enlace de entrada hasta aquí («js/atribucion.js» lo propaga a
  // los CTA que apuntan a esta página), así que la URL es la ÚNICA fuente.
  let refCode = (new URLSearchParams(location.search).get('ref') || '').trim();
  if (refCode) document.getElementById('ref-badge').style.display = 'block';

  // V0-3 + A9.1: atribución — UTM de ESTA URL → "ref:CODIGO". El registro escribe
  // merchants.acquisition_source, que es lo que agrupa el embudo por canal (getPlatformFunnel).
  //
  // SCRUM-336: se retiraron los dos respaldos de almacenamiento. El de «sessionStorage» estaba
  // MUERTO además de ser almacenamiento: el censo derivado no encontró ni una escritura suya en
  // toda la superficie pública, así que esa rama no podía devolver nada.
  const qsP = new URLSearchParams(location.search);
  const utmSrc = (qsP.get('utm_source') || '').trim();
  let acquisitionSource = '';
  if (utmSrc) {
    acquisitionSource = [utmSrc, (qsP.get('utm_medium') || '').trim(), (qsP.get('utm_campaign') || '').trim()]
      .filter(Boolean).join('/');
  } else if (qsP.get('src') === 'profile' || qsP.get('src') === 'qr') {
    // A14.2 (PERFIL-1): registro directo desde el perfil público / QR de furgoneta
    acquisitionSource = qsP.get('src');
  }
  if (!acquisitionSource && refCode) acquisitionSource = 'ref:' + refCode;

  // SCRUM-1685: provincia y domicilio sólo con España (es donde el alta los exige). Con otro país se
  // ocultan y se desactivan, para que el navegador no pida un campo que no se ve.
  const CAMPOS_ES = ['provincia', 'domicilio-foral', 'domicilio-canarias'];
  function pintarCamposEs() {
    const es = document.getElementById('country').value === 'ES';
    document.getElementById('campos-es').hidden = !es;
    for (const id of CAMPOS_ES) document.getElementById(id).disabled = !es;
  }
  document.getElementById('country').addEventListener('change', pintarCamposEs);
  pintarCamposEs();

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name    = document.getElementById('name').value.trim();
    const email   = document.getElementById('email').value.trim();
    const country = document.getElementById('country').value;
    const datosEs = {};
    if (country === 'ES') for (const id of CAMPOS_ES) datosEs[id] = document.getElementById(id).value.trim();
    const btn = document.getElementById('btn');
    btn.disabled = true; btn.textContent = 'Creando cuenta…';
    try {
      const res = await fetch('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, country, ...datosEs, ref: refCode, source: acquisitionSource || undefined }) });
      const data = await res.json();
      if (res.ok) {
        showAlert('✉️ ¡Cuenta creada! Revisa tu email y haz clic en el enlace para acceder.', 'ok');
        btn.textContent = 'Enlace enviado';
        // Redirigir a login tras 3s para que puedan reenviar si no llega
        setTimeout(() => window.location.href = '/login.html', 4000);
      } else {
        const msgs = { invalid_email: 'Email inválido.', name_required: 'Escribe el nombre de tu negocio.' };
        // SCRUM-94: si el backend manda un mensaje claro (p.ej. email ya usado por un operario), mostrarlo tal cual.
        showAlert(data.message || msgs[data.error] || data.error || 'Error al crear la cuenta.', 'error');
        btn.disabled = false; btn.textContent = 'Crear cuenta y acceder';
      }
    } catch { showAlert('Error de conexión.', 'error'); btn.disabled = false; btn.textContent = 'Crear cuenta y acceder'; }
  });

  function showAlert(msg, type) {
    const el = document.getElementById('alert');
    el.textContent = msg; el.className = 'alert ' + type; el.style.display = 'block';
  }
`;
