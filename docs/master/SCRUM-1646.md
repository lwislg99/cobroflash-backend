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
