# SCRUM-918 · Sin conexión: reabrir o recargar la app sin red la dejaba muerta

**Medido contra:** `origin/main` = `2be8fe16a3245322e64837f789189875e0c9f560` · 2026-09-17T14:05:41Z
**Rama:** `scrum-918-arranque-sin-red` · **Estado:** EN PR — literal firmado por delegación (SCRUM-918 comentario 15792, sin cambios).

Nace del PASO 0 «sin conexión» de la Sesión 0 (17-sep-2026). Carril front (Sesión 2).

## PASO 0 · reproducido en staging con corte real

Banco de la Sesión 0 (proxy + corte, copiado con perfil propio para no pisar el suyo), staging `2be8fe16`, 390 px.
Con red: login, `/dashboard/`, el service worker controla la página. Se corta la red. **Control del corte:**
`fetch('/version')` desde la página → falla. Se recarga:

- URL final `chrome-error://chromewebdata/`, texto «No se puede acceder a este sitio web… /login.html… ERR_FAILED».
- Peticiones: `GET /admin/me` falla → `GET /login.html` falla.

**Causa** (leída en el código, no deducida del síntoma):

- `app.js:6-7` — `catch { window.location.href = '/login.html'; }` ante CUALQUIER fallo de `/admin/me`.
- `sw.js` — `/admin/*` siempre va a la red, y `/login.html` no está en el SHELL.
- `api.js` (`_pedir`) YA distinguía los dos casos: un fallo de red lanza con `sinRed: true`, una respuesta con `status`.

## Arreglo (solo front)

- `arranqueSinCobertura.js` (nuevo, puro, en el SHELL del SW y cargado antes de `app.js`):
  `decidirArranque(error, copia)` → fallo **sin red** = arrancar sin cobertura con la copia local; **cualquier respuesta**
  del servidor (401, 403, 500…) = login, como siempre. Si el servidor contesta, `/login.html` también carga.
- La copia es la última respuesta buena de `/admin/me`, en `localStorage` (`yaqu_sesion_sin_cobertura`). Se guarda en
  cada arranque con red. **Registrada en `CLAVES_LOCALES` con `purga: true`**: al cerrar sesión se borra.
- `app.js`: sin red, pinta el aviso (`#sin-cobertura-banner`, `role="status"`, ámbar de Aviso de DESIGN.md), arranca con
  la copia. La telemetría de entorno se sigue llamando suelta (no espera y se traga el fallo; SCRUM-360 exige la
  llamada tal cual). Al volver la red (`online`) revalida `/admin/me`: bien → guarda la copia y
  quita el aviso; respuesta del servidor → login. No recarga la página (podría haber una firma a medias).

**Literal aprobado** (orquestador por delegación del fundador, comentario 15792; ficha `docs/microcopy/2026-09-17-SCRUM-918-aviso-sin-cobertura.md`): «Sin cobertura. Ves lo que ya tenías en el móvil; lo demás se cargará cuando vuelva la conexión.»

## Rojo, positivo y negativo

`npm run guard:arranque-sin-red` — panel real, service worker registrado de verdad (localhost) y **corte real**: el
servidor destruye cada conexión, así que tampoco el SW sale a la red (`setOffline` no lo corta, medido por la S0).

| caso | `2be8fe16` (rojo) | con el arreglo |
|---|---|---|
| A · recargar sin red | error de Chrome | `/dashboard/`, app pintada, aviso |
| C · ⛔ un cliente visto con red, sin red | — (la app ni arranca) | no aparece |
| D · sin copia local, sin red | error de Chrome | `/dashboard/`, aviso, sin app, sin errores |
| E · vuelve la red | — | se quita el aviso |
| B · ✅ 401 con red | `/login.html` | `/login.html` |

Mutantes: `decidirArranque` siempre al login → rojo en el guard (2 hallazgos) y en `tests/scrum918-arranque-sin-red.test.mjs`;
la clave sin registrar para purgar → rojo en el test.

## Declarado

- **Sin copia local** (nunca abrió la app con red desde que entre este cambio) la app no puede pintarse: queda el aviso.
  Es mejor que el error de Chrome, pero no abre el albarán. El primer arranque con red tras desplegar guarda la copia.
- **La copia puede estar desfasada** (rol, flags) mientras no hay red. Las pantallas que piden datos al servidor fallan
  con su propio estado de error: nada se presenta como al día (caso C).
- **El aviso se quita con el evento `online`.** Con cobertura débil el navegador puede no disparar `online`; entonces el
  aviso sigue hasta la siguiente recarga con red.
- **Pendiente en staging tras desplegar:** abrir el albarán ya precargado sin red y llegar a la firma, con el banco de la S0.
