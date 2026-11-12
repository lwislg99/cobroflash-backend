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
# SCRUM-1647d · CSP paso 2, tramo de J3: la página de alta sin código en línea

**Medido contra:** `origin/main` = `c8195b2608c32624f39d1145cf031c93091d9161` · 2026-11-12T12:07:59Z (cabecera `Date:` de GitHub)

A9: aviso → cicatriz J3 «Sexta vez del mismo fallo con otra puerta: pasé código por `node -e` en bash y un `\n` de una cadena se convirtió en un salto de línea real; lo cacé al leer el fichero y lo corregí con Edit.» — no se pudo comprobar: cómo escribe una sesión en un fichero no deja rastro en el árbol

Sesiones `jv-j3cc` (puesto J3), 12-nov-2026, por encargo del orquestador `cobroflash-backend-a0`: la
primera escribió el cambio y paró por contexto (Jira c.21664); la de relevo hizo el merge, las
mutaciones, el navegador y este tramo. Cabecera propia «SCRUM-1647d» por la misma razón que 1647c.

**Skill UI:** cargada por la sesión de relevo antes de tocar nada; el cambio de `register.html` lo
escribió la primera sesión, que no dejó dicho si la había cargado. El cambio no toca nada visible
(capturas abajo).

## ① PASO 0

- `register.html` en main (`9cdf6a24d`, tabla de 1647c): 0 `on*=`, 1 `<script>` en línea, 2 `style=`. Lo dejó
  pendiente el tramo 1647c: con la CSP aplicada, el alta se rompe.
- Sin rama `scrum-1647d*` en el remoto ni commits en main. #3108 (pago, J2) entró a las 11:55:09Z; #3106
  (login, 1647c) sigue OPEN y esta rama lo lleva dentro.
- `publicAccessDeclarations.ts` y tres tests de S1: excepción de carril firmada en c.21658, declarada
  en `dos-equipos.md` §3.4 junto a la de J2 (c.21631), carriles regenerados tras el merge (`comprobar`: IGUAL).

## ② Qué cambia

- `src/modules/auth/app/routes/altaNavegador.ts` (nuevo): el guion de `register.html` como cadena
  CONSTANTE (`String.raw`), servido en `GET /auth/js/alta.js` desde `auth.routes.ts`. Es el de main
  línea a línea, con el alta con invitación de S1 (SCRUM-1685, `pintarCamposEs`); sólo tres comentarios
  pasan de acentos graves a «». Ningún oyente nuevo: la página no tenía manejadores en línea.
- Los dos `style="display:none"` (insignia del amigo y caja de avisos) → `hidden`.
- Dos líneas en `publicAccessDeclarations.ts`: `GET /auth/js/login.js` (la de 1647c, que sin ella deja
  `scrum98` en rojo) y `GET /auth/js/alta.js`, las dos `no-sensitive-resource`.
- `scrum1685-formulario-de-alta`, `scrum264` y `scrum336`: sólo cambia DÓNDE leen el guion. Ninguna aserción.
- De paso: los dos extractores de `scrum1647c` con el `>` pegado, que `scrum553` cazaba.
- Textos: NINGUNO nuevo ni cambiado (regla 39).

## ③ Medido

| qué | resultado |
| --- | --- |
| Rojo contra main | contadores del test sobre el `register.html` de main: 1 `<script>` en línea y 2 `style=` → rama: 0 y 0 |
| Test nuevo | `tests/scrum1647d-alta-sin-script-en-linea.test.mjs`, 6 casos; control sembrado A0 |
| Mutaciones (`MUTACIONES_QUE_ME_TUMBAN` + `correr`/`aplicarUna` de `scripts/meta-guard-mutaciones.mjs`) | línea base 6 pasan, 0 caen, 0 saltan, 0 movidos · **5 de 5 tumban su caso**, 0 colaterales. Control del instrumento: una mutación inocua (un espacio en el `<title>`) sale MUDA. `git status` limpio y `dist/` sin restos después |
| Chromium (Edge 157.0.4341.46, el de `scripts/_navegador.mjs`) con la política de 1637 APLICADA | ver ④ |
| Build con tipos | `tsc -p .` tras el merge de main: salida 0 |

## ④ El alta en navegador, con la política aplicada

Banco: `evidencias/SCRUM-1647/1647d/` (`servidor-alta.cjs`, `recorrido-alta.mjs`, `resultado.json`,
`salida.txt`, 16 capturas). Método de 1647e (J2): la `app` real de dos `dist/` (main construido aparte con
su `public/`; la rama, el de este árbol), prisma doblado (0 lecturas en los cuatro escenarios), y la cabecera
`-Report-Only` de `cspSoloInforme` reescrita como `Content-Security-Policy` con el mismo valor. El
`POST /auth/register` se intercepta en el navegador y contesta 200: se mide si el guion corre, no el alta del
servidor (que no cambia). Recorrido: `/register.html?ref=AMIGO1647D`, país a Portugal y vuelta a España,
nombre, email, provincia y las dos preguntas de domicilio, enviar, esperar la redirección.

| escenario | alta completa | POST con `ref` y `source: ref:…` | informes `script-src` | insignia sin `?ref` | URL final |
| --- | --- | --- | --- | --- | --- |
| A · main sin política | sí | 1 | 0 | oculta | `/login.html` |
| **B · main CON política (control)** | **no** | 0 | 2 (+4 `style-src-attr`) | **visible** | `/register.html?` (el formulario se envía como GET) |
| **C · rama CON política** | **sí** | 1 | **0** (0 informes de ninguna directiva, también en `/login.html` tras la redirección) | oculta | `/login.html` |
| D · rama sin política | sí | 1 | 0 | oculta | `/login.html` |

- Controles: el sembrado (`/__sembrado`: `<script>` en línea + `onerror`) da 2 informes `script-src` con la
  política y 0 sin ella. B no completa el alta y A sí: el banco aplica la política y sabe hacer el alta.
- Visual (390 y 1280 px, con y sin invitación, sha256 del PNG): **A↔D 4/4 idénticas byte a byte** (el
  cambio de código no cambia nada a la vista). A↔C también 4/4 y D↔C 4/4: `register.html` sólo carga CSS de
  fichero, así que aquí `style-src` (c.21665, SCRUM-1723) no deja nada sin pintar. A↔B 0/4: en main con la
  política se ve la insignia «Te ha invitado un amigo» a todo el que entra y la caja de avisos vacía.
- El recorrido sale 2 (CIEGO) si falta una hoja de estilo, fuente, guion o imagen propios. Control: sin
  `auth.css` en el main extraído salió 2 nombrando `auth.css`; con ella, 0.

## No medido, y se dice

- Tanda entera local: NO CORRIDA (día de cola; la hace el obligatorio). `scrum1515` (alta con invitación
  contra base) salta sin `LIBRO_PG_URL`: no corrido.
- Otros navegadores que Chromium. yaqu.app tras el despliegue.
- Fallos míos de esta tanda, en el banco y antes de dar cifras: un puerto fijo ya cogido por otra sesión
  (EADDRINUSE; ahora pide puertos libres al sistema) y un primer filtro de «recurso que falta» que contaba
  el 404 sembrado, el `favicon.ico` y el `401 /admin/me` del login: salió CIEGO, y lo acoté a recursos de pintado.
