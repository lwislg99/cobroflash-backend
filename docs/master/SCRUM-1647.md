# SCRUM-1647c · CSP paso 2, tramo de J3: la página de acceso sin código en línea

**Medido contra:** `origin/main` = `58ccad60a5a1ce1c408480ec6f72da98ec927100` · 2026-11-12T11:32:13Z (cabecera `Date:` de GitHub)

A9: comprobación → `tests/scrum1647c-login-sin-script-en-linea.test.mjs`

Sesión `jv-j3cb` (puesto J3), 12-nov-2026, por encargo del orquestador `cobroflash-backend-a0`.
Es la parte J3 de SCRUM-1647 (pago es J2 en `scrum-1647a`, facturas admin es J1). Cabecera propia
«SCRUM-1647c» a propósito: si otra rama crea este mismo fichero, git entrelaza los dos tramos sin
marcadores, y así cada uno se lee entero bajo su título.

**Skill UI:** cargada tarde — la cargué después de escribir el cambio de `login.html`, no antes como pedía el encargo (misma cicatriz J3 del 22-oct). El cambio no toca nada visible (capturas abajo).

## ① PASO 0 (medido el 12-nov sobre `9cdf6a24d`)

| fichero | `on*=` | `<script>` sin `src` | `style=` | carril |
| --- | --- | --- | --- | --- |
| `public/login.html` | 2 (`:125`, dentro del `innerHTML` de la cuenta atrás) | 1 | 2 | J3 |
| `public/register.html` | 0 | 1 | 2 | J3 (S1 tiene la excepción de provincia/domicilio, SCRUM-1685) |

`register.html` NO entra: el encargo la metía sólo si tenía manejadores, y tiene 0. Su `<script>` en
línea y sus dos `style=` siguen ahí: **con la CSP aplicada (paso 3), el alta se rompe** igual que se
rompía el login. Queda para un tramo siguiente; no está hecho.

Sin rama ni PR previos (`git ls-remote origin 'refs/heads/scrum-1647*'` vacío, ningún commit en main).
Ticket sin comentarios al empezar.

## ② Qué cambia

- `src/modules/auth/app/routes/loginNavegador.ts` (nuevo): el guion entero como cadena CONSTANTE
  (`String.raw`, sin sustituciones), servido en `GET /auth/js/login.js` desde `auth.routes.ts`
  (`no-cache`). **Por qué no `public/js/`:** `node scripts/carriles.mjs de --nueva public/js/login.js`
  → S2. `src/modules/auth/**` es J3. Mismo patrón que S1 en SCRUM-1646 (`albaranFirmaNavegador.ts`).
- Los dos `onclick="sendLink()"` / `onclick="changeEmail()"` → `data-accion="reenviar"` /
  `data-accion="cambiar"` + UN `addEventListener('click')` delegado en `#resend-row`.
- Los dos `style="display:none"` → `hidden` (de paso, A13: con `style-src 'self'` se ignoraban y las
  cajas vacías ocupaban sitio). `.alert` y `.resend-row` no fijan `display`, y el guion las abre con
  `style.display`, que la CSP no bloquea.
- Textos: NINGUNO nuevo ni cambiado (regla 39). Comparación línea a línea guion viejo/nuevo: sólo
  cambian el `innerHTML` de los enlaces, la plantilla de la cuenta atrás (concatenación, mismo
  resultado), el oyente delegado y tres comentarios con acentos graves (no caben en `String.raw`).
- `tests/scrum264-copy-que-llega-al-cliente.test.mjs`: sus tres lecturas de `login.html` leen ahora
  el guion donde vive (`dist/…/loginNavegador.js`). Mismos patrones, misma exigencia.

## ③ Medido

| qué | resultado |
| --- | --- |
| Rojo contra main | `login.html` de `9cdf6a24d`: 2 `on*=` y 1 `<script>` en línea con los contadores del test → rama: 0 y 0 |
| Test nuevo | 10/10; control sembrado (A0 y A4) ve lo fabricado |
| Mutaciones (catálogo `MUTACIONES_QUE_ME_TUMBAN` + `aplicarUna`) | 7/7 muertas, árbol restaurado |
| Chromium, política de 1637 APLICADA (`Content-Security-Policy`, no `-Report-Only`), banco local | main: el login NO pide el enlace (0 peticiones), 2 bloqueos `script-src` + 4 `style-src`. Rama: error por URL, pedir enlace, cuenta atrás, «Reenviar enlace» y «Cambiar email» funcionan; **0 informes CSP** |
| Antes/después visual | main sin CSP vs rama con CSP: tarjeta 420×393 en las dos, capturas **idénticas byte a byte** |
| Build con tipos | `tsc -p .`: salida 0 |
| Guards dirigidos | 124 casos de 15 ficheros (scrum237, 976, 1387, 1637, 264, 329, 334, 378, 670, 701, 1234, 1302i, 1383, 1515…): 122 ok, 1 skip (scrum1515 gateado por `LIBRO_PG_URL`: **no corrido**), 1 rojo esperado = scrum976 ④ pidiendo este registro |

**NO medido:** la tanda entera en local (orden del orquestador: la hace el obligatorio de CI); el
alta con invitación por navegador (no toco `register.html`, `auth.routes.ts` sólo gana una ruta GET;
su test por ruta, scrum1515, salta sin banco desechable); yaqu.app tras el despliegue.
