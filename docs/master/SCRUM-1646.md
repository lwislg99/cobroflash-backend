# SCRUM-1646 · CSP paso 2 (S1): sacar el script en línea de la página de firma y del albarán público

Sale de SCRUM-1637 (paso 1 = `Content-Security-Policy-Report-Only` con `script-src 'self'`, PR #3022,
todavía abierto). Sprint PILOTO-1 (SCRUM-1656): se empieza por el albarán público.

## 2026-11-10 · Tramo albarán público (`albaranPublic.routes.ts`)

**Medido contra:** `origin/main` = `5986d520a77dc7076ad86ea656e1550ee75c7215` · 2026-11-10T17:36:45Z (hora de GitHub, `gh api -i zen`)

A9: comprobación → `tests/scrum1646-albaran-sin-script-en-linea.test.mjs`

### ① Qué había (medido en el HTML generado, no en el fuente)

| sitio | qué | qué interpolaba DENTRO del código |
|---|---|---|
| `SIG_JS` (lienzo de firma) | `<script>` en línea | nada |
| `firmanteCamposHtml` | `<script>` en línea | `FIRMANTE_CALIDAD_LIBRE`, `'el_propio_cliente'` |
| guion principal (botón de firmar) | `<script>` en línea | ruta del POST con el token, `albaran.version`, nombre del cliente, negocio y 7 textos (6 de `albaranFirmante.ts` + los de la página) |
| aviso «el parte cambió» | `onclick="location.reload()"` metido con `innerHTML` DENTRO de una cadena | — |

Con `script-src 'self'` aplicada (paso 3) nada de eso corre: el cliente no podría firmar.

### ② Qué se ha construido

- `albaranFirmaNavegador.ts` (nuevo, S1): los tres guiones en UNO, como **cadena constante**
  (`String.raw` sin sustituciones: no puede llevar un dato). Lee todo de un bloque
  `<script type="application/json" id="albaran-firma-datos">` que pinta el servidor, con `<` escrito
  `<` (un «</script>» en un nombre no cierra el bloque). Ningún nodo nace de `innerHTML`: todo
  con `createElement` + `textContent`; el botón «Ver la versión actual» recarga por `addEventListener`.
- Se sirve en `GET /albaran/js/firma.js` desde el propio router (`'self'`), con huella `?v=` = sha1
  del contenido (patrón SCRUM-274): `immutable` SÓLO si la huella cuadra; si no, `no-cache`. Un
  deploy nuevo no puede servirse viejo, y va siempre junto al HTML que lo usa.
  **Por qué no en `public/js/`:** `public/**` es carril S2 (`node scripts/carriles.mjs de
  public/js/firma-albaran.js` → S2). Este código es de la página que pinta el servidor.
- **Textos:** NINGUNO nuevo ni cambiado. Siguen naciendo en `albaranPublic.routes.ts` y en
  `albaranFirmante.ts`, palabra por palabra, y viajan en los datos (regla 39: se mueve código, no
  copy). Única diferencia de forma: «Gracias, {nombre}.» entra por `textContent` con el nombre SIN
  escapar (antes, escapado por `innerHTML`): lo que se lee en pantalla es igual.
- El nombre del cliente sale de UNA línea para el saludo y para «Gracias» (`nombreCliente` /
  `customerName`). SCRUM-1650b (#3041, en main a las 17:44:44Z) reescribía esa misma línea: el
  conflicto se resolvió en la fusión con `nombreCliente = nombreDelDocumento || 'Cliente'`, así que
  «Gracias, …» dice también el nombre CONGELADO (`tests/scrum1650b-…` verde tras la fusión).
- Los `style=` no entran (style-src es otro tramo). Nada del POST de firma cambia.

### ③ Pruebas

- **Censo** (`tests/_navegador-del-parte.mjs`): HTML GENERADO tokenizado por etiquetas y atributos
  (no `grep`) + AST de TypeScript sobre TODO el JS que corre en la página (el de los `<script>` en
  línea y el que se carga por `src`, pedido al router por esa misma `src`): `innerHTML`/`outerHTML`,
  `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `setTimeout('…')`. Control
  positivo dentro del test con cada caso. Sin parser de HTML en las dependencias: tokenizador propio.
- **ROJO visto antes** (código de `origin/main`): página «para firmar» → `enLinea: 3`,
  `innerHTML (línea 40)`, `innerHTML (línea 57)` (el segundo es el del `onclick`); 7 de 10 rojos.
  Con el arreglo: 10/10. Las caras «ya firmado» y «aún no listo» ya estaban limpias.
- **Funciona igual, ejecutándolo:** un navegador de mentira corre el guion servido sobre los ids del
  HTML generado: sin trazo no sale nada; el POST lleva trazo, versión pintada (3) y los tres datos
  del firmante; «¡Parte firmado!» + «Gracias, …»; portal sólo con URL http(s); «el parte cambió»
  recarga; «Otro» abre su hueco y el nombre PRECARGADO se borra (SCRUM-300); un nombre con
  `</script>` se queda en los datos, intacto.
- **Mutantes** en `dist` (`<job 756bdee5>/tmp/mutar1646.mjs <árbol>`): 7/7 muertos (catch con la
  reserva, reserva vieja, recarga sin oyente, versión que no viaja, sin escapar `<`, «Gracias» que
  promete copia, nombre precargado que no se borra).

### ④ Dos guards re-anclados — lo que EXIGEN no cambia (regla 41)

Leían el texto DENTRO del código JS de la página, y ese código ya no está en la página.

| guard | antes | ahora |
|---|---|---|
| `scrum1302d` B, C, D (parte) | regex sobre el `catch` / `d.message||'…'` / `<h1>¡Parte firmado!</h1>` del HTML | se EJECUTA el guion servido y se lee lo que queda en pantalla. Mismos tres textos. Control positivo nuevo con el texto viejo dentro de la página. D mira además el guion servido (sin «copia» ni WhatsApp). Más fuerte: la sonda de texto veía el literal aunque el `catch` no lo pintara |
| `scrum361` «la versión viaja» | `version:${JSON.stringify(albaran.version)}` en el fuente | `version: albaran.version` en los datos Y `version:D.version` en el cuerpo del POST del guion; la búsqueda de hash duplicado cubre ahora los dos ficheros |

La parte del presupuesto de `scrum1302d` no se toca (su tramo es el siguiente).

### ⑤ Lo que falta

- Aceptación 2 (recorrido en yaqu.app con la cabecera del paso 1): #3022 sigue sin entrar. Tras el
  merge de este tramo se recorre en prod con la CSP **aplicada** por el navegador (Playwright
  añade `Content-Security-Policy: script-src 'self'` a la respuesta del documento), que es más
  estricto que el Report-Only.
- Tramo de la firma del presupuesto (`quoteDecisionLanding.routes.ts`), mismo patrón.

## 2026-11-12 · Re-medida sobre main + SCRUM-1723 (`style-src 'self'`) en el albarán público

**Medido contra:** `origin/main` = `03645d4e46cae5e035db5fd51612ecce61377658` · 2026-11-12T14:59:31Z (hora de GitHub, `gh api -i zen`)

A9: comprobación → `tests/scrum1646-albaran-sin-script-en-linea.test.mjs`

### ① Por qué el PR #3048 estaba en rojo (los «✖ failing tests» del run 42871116416)

| test | causa | arreglo |
|---|---|---|
| `scrum98` · ruta pública sin declarar | `GET /albaran/js/firma.js` (la ruta nueva de este tramo) no estaba en `PUBLIC_ACCESS_DECLARED` | declarada `no-sensitive-resource`: guion constante, sin datos ni token (lo comprueba el bloque 2 del test) |
| `scrum49` · «la página pública le da al cliente la versión» | el test buscaba `version:N,` DENTRO de un `<script>` en línea, que es justo lo que este tramo quita | re-anclado: lee `version` del bloque `application/json` `#albaran-firma-datos`, que es de donde la coge el guion. Exige lo mismo (entero presente, 409 sin ella, 200 con ella) |
| `scrum719` · veredicto de mudez | `scrum361` cambió y su ficha caducó | `npm run censo:mudez -- --escribir` (no a mano) |

Antes, `main` metido en la rama (356 commits; merge limpio, sin rebase).

### ② SCRUM-1723: lo que `style-src 'self'` bloquearía, y qué se hizo

SCRUM-1723 midió que, con la CSP **aplicada**, las páginas de pago se pintan sin CSS por el `<style>` en línea. Aquí había lo mismo: **1 `<style>`** en `renderPage` (las tres caras) y **2 `style=`** en el marcado (`#firmante-otro-wrap`, `#sig-error`).

- El `<style>` pasa **tal cual** (mismas reglas, mismo orden, mismo sitio de la cascada, detrás de `/fonts/inter.css`) a `albaranFirmaEstilo.ts`, servido en `GET /albaran/css/firma.css?v=<huella>`, igual que el guion (`immutable` sólo con la huella buena). Ruta declarada `no-sensitive-resource`.
- Los dos `style=` pasan a dos reglas por id al final de ese CSS, copiadas tal cual.
- Guion: `wrap.style.display` pasa de `''` a `'block'` al abrir «Otro», porque ahora lo oculta el CSS y no un `style=`. El div ya era `block`. Lo que el guion cambia por CSSOM (`el.style.x = …`) no lo bloquea `style-src`.
- **Ningún texto tocado** (regla 39).

### ③ Rojo primero, y el instrumento

- Tests nuevos (bloque 5): control (el censo ve un `<style>` y dos `style=` sembrados; ignora el comentario) · las tres caras sin `<style>` ni `style=` y con las hojas desde `'self'` · el CSS con huella, sin datos y con las dos reglas migradas.
- **Rojo visto:** con el router anterior (HEAD) caen **4 de 15**; con el cambio, **15/15**.
- Relacionados: 1646, 98, 1302d, 361, 1302t y 264 → **59/59**. Guards de entrada y los 5 de árbol entero, abajo.

### ④ Cero cambios visibles: capturas con la CSP APLICADA (aceptación de SCRUM-1723)

Chromium (Playwright). **Antes** = HTML del router sin este cambio, **sin** cabecera CSP. **Después** = HTML con el cambio y `Content-Security-Policy` (la `POLITICA_CSP` entera de `csp.ts`) **aplicada**. Mismo guion, misma fuente. Caras: para firmar, con «Otro» abierto, con el aviso «sin firma», ya firmado y aún no listo, a 390 y 1280 px.

- **10 de 10 capturas IGUALES byte a byte.**
- **0 informes de CSP** en las de después.
- **Control positivo:** la página de antes con la CSP aplicada sale **DISTINTA** (desnuda) y con 3 informes, así que el instrumento ve.

Salida y scripts en `docs/master/evidencias/SCRUM-1723/`. ⚠️ Esto es la página pintada con el doble del banco de `tests/_banco-firma-del-parte.mjs`, NO un recorrido en yaqu.app: eso sigue pendiente tras el merge (aceptación 2 de 1646).

### ⑤ Lo que falta

- Recorrido en yaqu.app tras el merge, con la CSP aplicada por Playwright.
- Tramo de la firma del presupuesto (`quoteDecisionLanding.routes.ts`): script **y** estilo, mismo patrón.
- `documentNotFoundHtml` (`src/core/http/publicNotFound.ts`, el 404 del token) no se ha medido aquí.
### ⑥ CI rojo de #3048 (12-nov, noche) y su arreglo

El «build + tests» de `0151e10c8` cayó en UN test: `scrum553-etiquetas-pegadas` — 21 extractores con el `>` pegado sobre un tope de 20. El nuevo era el de este mismo PR: `tests/scrum49-firma-remota.test.mjs:179`, que leía `<script type="application/json" id="albaran-firma-datos">` literal. Se deja hueco a los atributos (`/<script\b[^>]*\bid="albaran-firma-datos"[^>]*>…/`) y se vigila el `id`, que es lo que pinta `albaranPublic.routes.ts:278`.

- Base sin el arreglo: 553 **rojo** (exit 1) nombrando esa línea. Con el arreglo: **16/16** verdes.

## SCRUM-1646c · 2026-11-12 (noche) · script de la firma del PRESUPUESTO (`quoteDecisionLanding`)

**Medido contra:** `origin/main` = `8f235725590f2c984b1709a5331ff26a53f25792` (2026-11-12T15:06:10Z).
Punto de partida: sección ② de la rama `scrum-1646-csp-avisos-publicos` (3 `<script>` en línea + `onclick` por opción).

### Qué cambia (cero textos, cero cambios de conducta)

- Los tres scripts (`TIER_JS`, `SIG_JS` y el del botón) pasan a UNA cadena constante,
  `PRESUPUESTO_FIRMA_JS`, en `src/modules/system/app/routes/quoteDecisionNavegador.ts` (`String.raw`
  sin `${`), servida en `GET /pay/quote/js/firma.js?v=<sha1 10>` (`immutable` sólo con la huella buena,
  si no `no-cache`). Declarada `no-sensitive-resource` en `publicAccessDeclarations.ts` (`/pay` ya era prefijo).
- Lo que iba interpolado (ruta del POST con el token, códigos de recarga, TODOS los textos, nombre del
  negocio, enlace de compartir, trazo del icono) viaja en `<script type="application/json"
  id="presupuesto-firma-datos">`, con `<` → `<`. Los literales se quedan en la ruta, idénticos.
- El `onclick="selectTier(…)"` de cada opción → listener sobre `.tier-card .btn-tier`, que lee el
  `data-tier-id` que la tarjeta ya llevaba.
- El éxito ya no se monta con `innerHTML`: `createElement`/`textContent`, mismo árbol
  (div > div.success-check, h1, p, [p.sin-pago], a.btn-share > svg + texto) y mismos estilos vía CSSOM.
- `TIER_JS` deja de exportarse (sólo lo leía SCRUM-212).

### Tests

- Censo de acoplados (36 ficheros, 284 tests): **10 caían**, en 4 ficheros que ejecutaban o leían el
  script en línea → adaptados para EJECUTAR el guion servido sobre los datos de la página
  (`tests/_navegador-de-la-firma-del-presupuesto.mjs`, nuevo): 1302t, 1302d (mitad presupuesto), 264
  (fila ACEPTAR: expresión del guion + `T.reserva` ligado al literal de la ruta), 1001 (suelo). 212 mira
  la condición del IVA en su forma nueva (`conIva?T.ivaIncluido:''`) además de la vieja.
- 1302t: su `MUTACIONES_QUE_ME_TUMBAN` M1 apuntaba a la rama 5xx en el fuente viejo (quedaba CIEGA):
  movida al guion; aplicada a mano cae SÓLO «un 5xx al aceptar…». Censo de las 3 declaraciones que mutan
  la landing: ninguna ciega.
- 888d: su huella es de `renderQuoteDetail`, que no se toca → sigue verde sin regenerar.
- Nuevo `tests/scrum1646c-presupuesto-sin-script-en-linea.test.mjs` (8): control de sondas · las dos caras
  (un precio, tres opciones) sin script en línea ni `on*=` y con UN guion `'self'` · guion constante · caché
  por huella · un `</script>` en el nombre no abre HTML · elegir opción · éxito · 409 recarga.
  **Mutantes (base 8/8):** M1 script en línea vuelve → caen 2 · M2 immutable siempre → 1 · M3 sin listener
  de opción → 1 · M4 el 409 no recarga → 1.
- Tanda de acoplados tras el cambio: **294 tests · 291 pass · 0 fail · 2 skip** (+553 arreglado: extractor
  con hueco de atributos). `guards:entrada` 15 guards **170/170**; los 5 de árbol entero + 98 + 55: 133, 0 fail.

### ⑥ La vara: capturas con la CSP APLICADA (12-nov, noche)

A9: comprobación → `docs/master/evidencias/SCRUM-1646c/capturas.salida.txt`

Rama con `origin/main` = `95265b07c` metido (merge, sin rebase; conflicto en `scrum1302d` resuelto por
UNIÓN: el parte EJECUTADO de main + el presupuesto EJECUTADO de aquí). Scripts y salida en
`docs/master/evidencias/SCRUM-1646c/`. CSP = `POLITICA_CSP` con `style-src 'self' 'unsafe-inline'` (el
estilo en línea es 1646d). 13 caras/estados × 390 y 1280: un precio y tres opciones (inicial, aviso sin
firma, trazo, elegir opción, éxito con y sin firma), aceptado, rechazado, rechazo (formulario y enviado).

- **Pasada 1 (nombre normal): 26/26 IGUALES byte a byte**, mismo cuerpo de POST, 0 informes CSP.
  Control (main + CSP): distinto en los 14 estados tras pulsar, 3-4 informes, ningún POST.
- **Pasada 2 (negocio `Fontanería & Hijos <Sur> 'Pepe'`): 16/26 IGUALES, 10 DISTINTAS** — las 10 son
  que en **MAIN el botón «Firmar y aceptar» no hace nada** si el nombre del negocio lleva `'`: el tercer
  `<script>` en línea es `SyntaxError: Unexpected identifier 'Pepe'` (el enlace de compartir va con
  `encodeURIComponent`, que no escapa `'`, dentro de un literal JS de comilla simple). Esta rama lo
  arregla de paso (el dato viaja en JSON): firma, POST y éxito con el nombre tal cual. **Es un cambio de
  conducta** → no se empuja sin el OK del orquestador (BUGS.md pendiente de registrar).
- Pendiente: recorrido en yaqu.app tras el merge.

### ⑦ El cambio de conducta, declarado como ARREGLO (12-nov, noche · OK del orquestador para empujar)

A9: comprobación → `tests/scrum1646c-presupuesto-sin-script-en-linea.test.mjs`

- **Es un ARREGLO, no un cambio de diseño:** la única conducta que cambia es la de un defecto de `main` —con
  un `'` en el nombre del negocio el botón no firmaba—. **Prueba compilada** (no razonada): el HTML de main
  pasado por `vm.Script` da `#3 SyntaxError: Unexpected identifier 'Pepe'` en las dos caras
  (`capturas.salida.txt`, instrumento `compilar-en-linea.mjs.txt`). Registrado en `docs/BUGS.md` como
  **P1-1646c** con su población (nombres con apóstrofo; las comillas dobles no se midieron en main).
- **Guard nuevo (9.º test del fichero):** nombre `Fontanería & Hijos <Sur> 'Pepe' "el Rápido"` → sin script
  en línea, POST `accept`, éxito con el nombre tal cual y enlace de compartir correcto. Base 9/9.
  **M5** (en `dist`, restaurado byte a byte): entidad-escapar el `'` del texto de confirmación → cae SÓLO
  ese test (8/9). Un primer mutante con `esc()` NO discriminaba (en el JS compilado `esc` no está en el
  ámbito: ReferenceError, caían 6) y se descartó.
- Rama re-fusionada con `origin/main` (merge sin conflictos) antes del push.

## 12-nov (noche) · SCRUM-1646d — el estilo de la firma del presupuesto desde 'self'

Rama `scrum-1646d-estilo-firma-presupuesto`. `quoteDecisionEstilo.ts` sirve la hoja base, la de opciones y la de
marca (`/pay/quote/css/marca/:color`, color filtrado, 404 sin cuerpo); ~20 `style=` pasan a id/clase. **Vara:**
56/56 capturas IGUALES byte a byte con la POLITICA_CSP entera (style-src 'self'), 390 y 1280, 14 caras, texto y
POST iguales, 0 informes; control (main + CSP) distinto 56/56. Evidencias e instrumentos en
`docs/master/evidencias/SCRUM-1646d/`. Nota: en main la hoja de opciones vivía dentro de la tarjeta y moría al
pintar el éxito; ahora va en `head` (sin efecto visible: capturas iguales).

Los cinco acoplados que el cambio puso en rojo, uno por uno:
- **scrum1325 ×3** — la expresión del color de marca (`/^#[0-9a-fA-F]{6}$/`) se MUDÓ de
  `quoteDecisionLanding.routes.ts` a `quoteDecisionEstilo.ts`; el catálogo `tests/_expresiones-de-texto.json`
  declara por identidad (fichero + fuente), así que se muda su declaración (misma clase `maquina`). Se edita a
  mano: no hay generador (precedente `c03d5cf75`). 19/19.
- **1646c CONDUCTA · elegir una opción** — su CONTROL leía `attrs.style === 'display:none'` del bloque de firma.
  Ahora nace oculto por clase: se exigen las dos mitades (sin `style=` en el HTML, clase `oculto-hasta-elegir`, y
  la regla `display:none` en la hoja servida). Mutante (quitar la clase del dist) → rojo en ese CONTROL. 9/9.
- **888d huella** (8 páginas sin descuento, byte a byte) — re-anclada de `4eaf5218…` a `bd247521…` DEMOSTRANDO
  que la única diferencia es style→clase: `diff-888d.mjs.txt` trocea etiquetas y texto, exige texto idéntico pieza
  a pieza y que cada etiqueta distinta sólo cambie `style=` por clase/id. Control del instrumento 4/4; el árbol
  «antes» reproduce `4eaf5218…`. Resultado: 8/8 explicadas, por DOS etiquetas (`text-align:center` → `centrado`,
  `text-align:center;margin-bottom:4px` → `condiciones-wrap`). Salida en `diff-888d.salida.txt`.

`guard:firma-con-tramos` necesita el arreglo de #3159 (sirve `/pay/quote/(js|css)/`): hasta que mergee, el check
de navegador de esta rama sale CIEGO como en todo PR sobre main.
