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

---

*Unión de los dos tramos revisada a mano tras el merge `bc9de86d6` (SCRUM-1572): las dos ramas crearon
este registro y git lo unió contra una base vacía. Arriba, el tramo J3 (SCRUM-1647c); abajo, el J2.*

---

# SCRUM-1647 · CSP paso 2, mitad del equipo de Javier · tramo J2: las tres páginas de pago sin código en línea

**Medido contra:** `origin/main` = `31858144e08886024d72808c5da1479a5122219a` · 2026-11-12T11:34:50Z (cabecera `Date` de GitHub; la rama lleva ese main mergeado y ninguno de sus commits toca los ficheros de este tramo)

A9: aviso → cicatriz J2 «otra vez la muestra local de guards elegida a mano: no llevaba scrum553, y un control de mi test con el `>` pegado tumbó el obligatorio de #3098» — no se pudo comprobar: esta vez scrum553 SÍ estaba en la muestra y cazó tres etiquetas literales antes de empujar; que esté o no lo sigue decidiendo la sesión, y ningún guard obliga a correrlo

Lo escribe J2 (`jv-j2bs`). Sólo el tramo J2 del ticket (`payBank`, `payBizum`, `payInvoice`); las líneas de J1 (`invoicesAdmin.routes.ts`) y J3 (`public/login.html`) siguen sin hacer.

## PASO 0

- Ticket, comentarios y etiquetas leídos el 12-nov: `area-j1`, `area-j2`, `area-j3`, `equipo-javier`. Sin rama `scrum-1647*`, sin PR, sin commits en main.
- La cabecera del paso 1 (SCRUM-1637) está en main: `src/core/http/csp.ts`, montada en `src/app.ts` (`app.use(cspSoloInforme)`), y el test de este tramo la ve en la respuesta de `/pay/bank`.
- Medido en `origin/main` = `9cdf6a24d` (el de arranque), por `grep` del fuente de las tres rutas:

| fichero | `on*=` | `<script>` en línea |
| --- | --- | --- |
| `payBank.routes.ts` | 3 · `onclick="copyText(…)"` (CLABE, IBAN, referencia) | 1 (`copyText`) |
| `payBizum.routes.ts` | 1 · `onerror` del logo | 1 (los botones de copiar) |
| `payInvoice.routes.ts` | 1 · `onerror` del logo | 0 |

El ticket contaba los 5 `on*=` y no los dos `<script>`; con `script-src 'self'` caen igual, así que entran en este tramo.

## Qué se ha cambiado

Patrón de S1 en SCRUM-1646 (`albaranFirmaNavegador.ts`, PR #3048):

- **`src/modules/billing/app/routes/pagoNavegador.ts` (nuevo):** el guion, una cadena CONSTANTE (`String.raw`, sin `${`). Lo sirve `GET /pay/js/pago.js?v=<huella>` desde el router de `payInvoice` (`immutable` sólo con la huella buena; si no, `no-cache`). Cada página lo enlaza en su `<head>` con `data-pagina` = `banco` | `bizum` | `factura` (constante del servidor, nunca un dato).
- **Copiar:** los botones de `/pay/bank` llevan `data-copy="${esc(…)}"` en lugar del `onclick`; el guion escucha el clic por delegación. Mismo comportamiento que antes en cada página: en `/pay/bank`, clase `copied`, 2000 ms y el respaldo con `execCommand`; en `/pay/bizum`, 1600 ms y sin respaldo.
- **El logo que no carga:** sin `onerror`; el guion escucha `error` en FASE DE CAPTURA en el documento (el `error` de una imagen no burbujea) y oculta el `.logo-img`. El `<script src>` va en el `<head>`, síncrono, así que el escuchador existe antes de que se cree el `<img>`.
- **Ningún texto nuevo ni cambiado** (regla 39): «¡Copiado!» y los rótulos son los de antes. Nada del cobro tocado: ni consultas, ni estados, ni el POST de Bizum.
- **`src/core/http/publicAccessDeclarations.ts` (carril S1): UNA línea**, la declaración de `GET /pay/js/pago.js` como `no-sensitive-resource`. Sin ella `scrum98` sale rojo (es lo que tiene #3048 en rojo con `/albaran/js/firma.js`: job `130022347058`). Excepción firmada por el fundador en SCRUM-1647 c.21631, declarada en `docs/equipo/dos-equipos.md` §3.4 y regenerada con `node scripts/carriles.mjs generar`.

## El test, en rojo primero

`tests/scrum1647-pago-sin-manejadores-en-linea.test.mjs`, 9 casos, por la ruta de verdad (`dist/app.js` con sus montajes; sólo prisma es un doble en `require.cache`; ni BD ni red). Cuenta `on*=` dentro de ETIQUETAS y `<script>` sin `src` en el HTML servido de `/pay/bank` (IBAN y CLABE), `/pay/bizum` y `/pay/invoice`, con un control positivo sembrado (un HTML fabricado con un `onerror` y un `<script>` en línea que tiene que dar 1 y 1). Comprueba que el `data-copy` descodificado es lo que copiaba el `onclick` (IBAN, CLABE y una referencia con `&"<'`), sirve el guion y lo ejecuta en `node:vm` contra un DOM doble.

- Rojo: las tres rutas de `origin/main` (`9cdf6a24d`) compiladas con el test de la rama: **5 caen** (las cuatro páginas y el guion servido), 4 pasan (el control sembrado y los 3 de comportamiento, que miden el guion nuevo y no las rutas). Con la rama, 9 de 9.
- Mutaciones: las 6 de `MUTACIONES_QUE_ME_TUMBAN`, corridas con `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (línea base limpia: 9 pasan, 0 caen, 0 saltan): **6 de 6 tumban su caso**, sin colaterales. Árbol y `dist/` restaurados (comprobado con `git status` y buscando los textos mutados en el fuente y en el compilado: sólo salen en comentarios).
- Build con tipos (`tsc -p .`, sin `--noCheck`): salida 0, también después del merge de main.
- Muestra local: 35 ficheros (el nuevo, los de las páginas de pago, scrum98, 1637, 237, 976, 1387, 1415, 411, 553, 700, 719, 723, 737, 747, 812, 921c, 1177, 1295, 1295b…): 296 casos, 293 pasan, 2 se saltan (scrum85 y scrum90, gateados por base) y **1 cayó: scrum553**, por tres etiquetas literales con el `>` pegado en mi test. Arreglado en el test (la etiqueta esperada sale de `etiquetaGuionDePago`), y después 58 de 58 en los seis que importan, `guards:entrada` 15 de 15 y los 5 de árbol entero que nombra, 38 de 38. Suite entera local: NO CORRIDA (día de cola; lo dice el obligatorio).

## No medido, y se dice

- **El navegador de verdad.** El comportamiento se mide en un DOM doble, no en Edge ni Chrome. Que con la CSP puesta la consola de las tres páginas no dé informes de `script-src` (la aceptación del ticket) es un recorrido en yaqu.app tras el merge, y no lo he hecho.
- **`style-src 'self'`**: las tres páginas siguen con `<style>` y `style=` en línea, y la política del paso 1 también los informa. El ticket pide sólo `script-src`; queda para el tramo de estilos, si lo hay.
- `scrum85` y `scrum90` (las rutas de pago contra base) no han corrido en local: están gateados.

# SCRUM-1647e · las tres páginas de pago en navegador real con la CSP de 1637 APLICADA (solo medición)

**Medido contra:** `origin/main` = `ec7e19e64eab26361a3d5ebae929b60474ae08ba` · 2026-11-12T11:51:49Z (cabecera `Date` de GitHub; la rama lleva además `scrum-1647a-csp-pago` @ `f4e9be9cc`, que aún no estaba en main)

A9: comprobación → `docs/master/evidencias/SCRUM-1647/recorrido.mjs`

Lo escribe J2 (`jv-j2bu`). Jira: SCRUM-1647 c.21665. Sin cambios en `src/`: solo evidencias.

- **Banco:** `servidor-csp.cjs` levanta la `app` real de un `dist/` con prisma doblado y datos fabricados (sin base, sin red, sin Stripe, ninguna `DATABASE_URL*` en el entorno). La cabecera `-Report-Only` de `cspSoloInforme` se reescribe desde fuera como `Content-Security-Policy`, con el mismo valor. `recorrido.mjs` usa el navegador de `scripts/_navegador.mjs` (Edge 157, Chromium). Cuatro escenarios: A main sin política, B main con política (control), C rama con política, D rama sin política.
- **Comportamiento con la política aplicada (C):** «copiar» 5/5 (el portapapeles real tiene el valor exacto; antes de cada clic se escribe un centinela). Logo roto oculto en Bizum y en factura. **0 informes `script-src`**. El control B da copiar 0/5, logo visible y 3+2+1 informes `script-src`. El control sembrado `/__sembrado` da 2 con la política y 0 sin ella.
- **Visual (390 y 1280 px, sha256 del PNG, iguales de una pasada a otra):** A↔D 6/6 idénticas byte a byte, es decir, el cambio de 1647a no se ve. A↔C 0/6.
- 🔴 **El paso 3 (aplicar la CSP) queda BLOQUEADO:** con `style-src 'self'`, el `<style>` en línea y los `style=` de las tres páginas se bloquean, y **se pintan SIN CSS, también en main** (B↔C idénticas en transferencia). Se desbloquea sacando el CSS en línea a un fichero servido desde `'self'`. Fuera de la aceptación de este ticket (que es `script-src`); el orquestador abre el ticket de J2.
- **El fallo propio, ya convertido en comprobación:** en la primera pasada A↔D salía distinto porque extraje el main sin `public/` y no cargaba `/fonts/inter.css`. Ahora `recorrido.mjs` sale 2 (CIEGO) si un recurso propio que no sea el logo roto a propósito da 4xx/5xx. Comprobado: sin `public/` sale 2 con 18 recursos; con `public/` sale 0 con 0.
- **No medido:** yaqu.app (1647a no está desplegado); Firefox y Safari; `/pay/bank` con CLABE; el botón «Simular pago confirmado» (aparece por `NODE_ENV=test`; no se pulsó). Suite entera local: NO CORRIDA.
- Cómo se repite: `node docs/master/evidencias/SCRUM-1647/recorrido.mjs <dist de main con public/ al lado> dist <salida>`.
