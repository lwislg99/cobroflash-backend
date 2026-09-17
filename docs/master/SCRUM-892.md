# SCRUM-892 · Firma del cliente en «3 opciones»: el recuadro nacía sin tamaño y el servidor aceptaba la firma vacía

**Medido contra:** `origin/main` = `12ca4167f030987e4d9d5615428fc14c82a92921` · 2026-09-16T19:56:32Z
**Rama:** `scrum-892-firma-vacia` · **Carril:** producto (Sesión 0) · **Nace de:** SCRUM-882b, punto b1
**Estado:** texto del rechazo FIRMADO (delegación, comentario 15660); pendiente de empujar, desplegar y verificar en staging.

⏱ Horas de GitHub (cabecera `Date:` de `gh api -i zen`).

> La cliente elegía una de las «3 opciones», firmaba con el dedo y no veía nada. El servidor aceptaba
> esa firma vacía, sellaba la evidencia sobre ella y el panel decía «Firmado digitalmente». Ahora el
> recuadro toma tamaño al mostrarse, el servidor rechaza lo que no tiene trazo y el panel solo dice
> «firmado» si hay firma de verdad.

## PASO 0 · reproducido corriendo, en local (sin base y sin staging)

La página de aceptación, renderizada por la ruta real compilada con Prisma doblado, abierta en Chromium
a 390×844 táctil. Se elige opción, se dibuja con el ratón y se intercepta el envío.

| Modo | Densidad | Lienzo al cargar | Lienzo al mostrarse | Lo que se envía |
| --- | --- | --- | --- | --- |
| «3 opciones» | 1 | 0×0 | **0×0** (en pantalla 304×150) | `data:,` · **6 caracteres** |
| «3 opciones» | 3 | 0×0 | **0×0** (en pantalla 304×150) | `data:,` · **6 caracteres** |
| un precio (control) | 1 | 304×150 | 304×150 | PNG · 5.770 caracteres |
| un precio (control) | 3 | 912×450 | 912×450 | PNG · 26.482 caracteres |

- **El recuadro:** `quoteDecisionLanding.routes.ts:641` pinta el bloque de firma con `display:none` cuando
  hay tramos, y `resize()` se llamaba una sola vez al cargar (`:456`). Un elemento oculto mide 0, así que
  el lienzo se quedaba en 0×0. Además, cada `resize` de ventana lanzaba `getImageData… source width is 0`.
- **El servidor:** `quotes.routes.ts:482` solo comprobaba que `signatureData` no fuera vacío como texto, y
  `data:,` no lo es. Invocando el handler con la firma `data:,` y `tierId`: **200**, `signatureUrl = "data:,"`,
  **`evidenciaFirma` sellada** y el PDF regenerado.
- **El panel:** `quotesDetailView.js:242` pintaba «✅ Firmado digitalmente» con cualquier `signatureUrl`
  no vacío.

## Qué es «vacía»: medido, no a ojo

`canvas.toDataURL('image/png')` en Chromium 1223:

| Lienzo | Caracteres |
| --- | --- |
| vacío 1×1 | 142 |
| vacío 304×150 | 2.142 |
| un trazo de 1 px en 304×150 | 2.262 |
| firma real a 390 px, densidad 1 | 5.770 |
| **vacío 912×450 (densidad 3)** | **13.146** |

Un lienzo vacío a densidad 3 es más largo que una firma real a densidad 1: **ningún umbral de longitud
separa las dos cosas.** El criterio es de píxeles (`src/modules/quotes/domain/firmaConTrazo.ts`): el lienzo
tiene fondo transparente, un píxel transparente son cuatro ceros, y una firma con trazo tiene al menos un
byte distinto de cero. Se lee sin deshacer los filtros del PNG: si todos los bytes filtrados son cero, la
imagen reconstruida también lo es, y al revés. Sin dependencias nuevas (`zlib` de Node).

Se da por vacía: lo que no es `data:image/png;base64,` (incluidos `data:,` y la cadena vacía), un PNG
ilegible, cortado, de 0 de lado, entrelazado o sin canal alfa, y un PNG con todos los píxeles transparentes.
Clasificadas bien las 12 muestras, incluido un trazo de 1 px en la última esquina de 912×450.

## El arreglo

1. **El recuadro:** `resize()` no toca un lienzo oculto, y un `ResizeObserver` lo dimensiona al mostrarse
   con esa MISMA función, la que ya usaba bien el modo normal. Con el arreglo, «3 opciones» envía lo mismo
   que el modo normal: 5.762 caracteres a densidad 1 y 26.474 a densidad 3, sin errores.
2. **El servidor:** `POST /quote/:token/decision` responde **422 `firma_vacia`** si llega una firma sin
   trazo, en los dos modos. Va después de «ya aceptado» y «caducado», y antes de escribir nada. «Acepto sin
   firmar» (`signatureData: null`) sigue valiendo, sin firma ni sello.
3. **El panel:** `GET /admin/quotes/:id` devuelve `firmaConTrazo`, calculado con el mismo criterio, y la
   pastilla «Firmado digitalmente» solo se pinta si es `true`.

Sin schema. No se toca ninguna aceptación guardada: el #7 de staging sigue con `signatureUrl = "data:,"`,
y ahora el panel simplemente no dice que esté firmado.

## Pruebas, en rojo antes que en verde

- **`tests/scrum892-firma-vacia.test.mjs`** (en `npm test`), 11 casos. Con la ruta, el panel y la vista de
  `main` caen **4**: el ROJO («3 opciones» + `data:,` → hoy 200), «todos los modos» (un precio con un lienzo
  vacío de 912×450, y la cadena vacía) y los dos del panel. Los 7 invariantes pasan en los dos lados:
  - el criterio con las muestras medidas;
  - una firma con trazo se acepta y se sella en los dos modos;
  - «Acepto sin firmar» sigue valiendo;
  - una aceptación ya guardada responde `already_accepted` sin escribir;
  - el PDF de una firma con trazo lleva sus **2 imágenes** y el de `data:,` ninguna.
- **`npm run guard:firma-con-tramos`** (navegador, fuera de la tanda, lo corre `guards:visuales` en CI).
  Rojo quitando solo el cambio del lienzo: «3 opciones» 0×0 y 6 caracteres sin trazo; el modo normal, que
  hace de control, firma. Con el arreglo, los cuatro casos con trazo.
- ⚠️ **Un rojo que no valía:** la primera vez puse el fichero entero de `origin/main`, que ya había
  avanzado y exigía `discountGlobalAmount` en la página. El guard se estrelló antes de medir. Se rehízo
  quitando solo mi cambio del lienzo y el doble trae ahora ese campo.

## El texto del rechazo · ✅ FIRMADO

Lo lee la cliente en rojo bajo el recuadro de firma (la página pinta `message`):

> No nos ha llegado tu firma. Dibújala otra vez en el recuadro o marca «Acepto sin firmar».

Vive en `COPY_FIRMA_VACIA` (`firmaConTrazo.ts`). Propuesto en el comentario 15626 (16-sep 22:01 CEST)
y **firmado sin cambios por el orquestador por delegación del fundador** en el comentario **15660**
(17-sep-2026 10:05 CEST). Consta en `docs/microcopy/2026-09-17-SCRUM-892-firma-vacia.md`.

## Lo que NO cubre, declarado

- **Firefox y Safari no se han medido.** Lo esperable es que también codifiquen el lienzo con alfa y sin
  entrelazar, pero aquí solo se midió Chromium (Playwright) y el navegador que resuelve `_navegador.mjs`
  (el guard). Si uno no lo hiciera, su firma se rechazaría: se vería en la verificación, no en silencio.
- **El albarán y el parte** tienen su propia firma (`albaranPublic.routes.ts:380`, `albaranes.routes.ts:972`,
  `partes.routes.ts:571` y `:642`). Rechazan `data:,` por el prefijo, pero un PNG vacío con tamaño pasaría.
  **No medido** si su página puede llegar a mandarlo. No es aceptación de presupuesto: se reporta y no se toca.
- **Lo guardado** conserva su `decisionComment` «Aceptado con firma digital», que el panel sigue enseñando
  en «Comentario». Cambiarlo sería tocar datos guardados.
- **La verificación en staging** (regla 3) se hace después del merge, con una aceptación nueva en «3 opciones».
