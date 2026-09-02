# SCRUM-654 · T5 — PASO 0 de medición: ¿sirve lo que ya hay para dictar un parte?

**Medido contra:** `origin/main` = `8a1bbb81c056082b33ab3e1eeaa312d48d4f10c6` · 2026-09-02T15:20:00+02:00
**Rama:** `scrum-654-paso0-voz`
**Alcance:** solo lectura. **No se tocó ni una línea de código.** Lo único escrito es este documento.
**Instrumentos:** búsqueda de texto (`grep`), AST (`typescript`) y **documentación oficial del
proveedor** (enlaces abajo).

> Toda afirmación lleva **fichero y línea**, o el **enlace oficial**. Lo que no se pudo medir va
> como **NO MEDIDO**, con esas palabras. **Gana el código sobre cualquier prompt o documento.**

---

## Titular: la voz YA EXISTE, y no pasa por Gemini

**El dictado está construido desde VOZ-1 y usa el reconocimiento del NAVEGADOR, no una API de
transcripción.** El audio **nunca sale del móvil**. Gemini solo convierte **texto** en líneas.

Eso reordena las tres preguntas: la que importa no es «¿aguanta la cuota de Gemini?», sino
**«¿funciona el reconocimiento del navegador en un sótano?»** — y la respuesta oficial es **no**.

---

## 1 · Qué hay ya

### El transporte: `src/integrations/gemini.ts` (108 líneas, leído entero)

| Qué | Dato | Coordenada |
|---|---|---|
| Endpoint | `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | `gemini.ts:8` y `:30` |
| Autenticación | clave **en la URL** (query string) | `gemini.ts:30` |
| Modelos | `GEMINI_MODEL`, por defecto `gemini-2.5-flash, gemini-2.0-flash, gemini-flash-latest` | `gemini.ts:91` |
| Reintento | recorre la lista **en orden** ante `429`, `404` o respuesta vacía | `gemini.ts:95-105` |
| Tiempo máximo | 20 s | `gemini.ts:51` |
| Salida estructurada | sí, `responseSchema` | `gemini.ts:36-39` |

> ⚠️ La clave viaja en la URL, y el propio fichero lo tiene presente: **nunca imprime el error
> crudo**, porque arrastraría la petición entera (`gemini.ts:54-57`, SCRUM-105). Es un dato a tener
> delante si algún día se añade otro transporte.

### 🔴 ¿Texto o audio? **SOLO TEXTO, y no por descuido**

El cuerpo que se manda lleva **únicamente** `parts: [{ text }]` (`gemini.ts:47-48`), y el tipo de
entrada (`GeminiParams`, `gemini.ts:21-26`) tiene `system`, `user`, `maxTokens`, `temperature` y
`jsonSchema`. **No hay `inlineData`, ni `fileData`, ni `mimeType`** — que es la forma que la API
exige para mandar audio.

**Medido con dos instrumentos, y con su suelo:**

* **Texto**: `geminiComplete` / `isGeminiConfigured` aparecen en **2 ficheros**; el suelo exigía
  ≥2 y se cumplió.
* **AST**: **3 llamadas**, todas en el mismo fichero — `ai.service.ts:20`, `:30` y `:31`. **Embudo
  único.**
* **Audio**: barrido de `inlineData|fileData|audio/` en `src/`: **1 fichero**, y no es de Gemini —
  `whatsappIncoming.routes.ts:184`, que clasifica los adjuntos entrantes de WhatsApp. **Ningún
  fichero manda audio a Gemini.**

### Quién lo llama

`ai.service.ts:31` es el único que llama, y su único consumidor es `ai.routes.ts`, montado en
**`/admin/ai`** (`app.ts:541`). Tres rutas: `/suggest-quote` (`ai.routes.ts:44`),
`/suggest-albaran-lines` (`:93`) y `/quote-message` (`:142`).

### 🔴 Y el dato que cambia el ticket: el dictado ya está, y es del navegador

`ai.service.ts:157-161` lo deja escrito, y el código lo confirma:

> «**EL AUDIO NO SALE DEL MÓVIL**, y conviene que siga así. El dictado es la Web Speech API del
> NAVEGADOR (`public/dashboard/js/voiceInput.js`), no una API de transcripción: no hay fichero de
> audio que guardar, no hay coste por minuto y no hay superficie RGPD nueva. Lo que hace la IA aquí
> es convertir TEXTO en líneas. Si alguna vez se propone “mejorar la transcripción con una API”,
> eso cambia las tres cosas a la vez y es una decisión de otro tamaño.»

`public/dashboard/js/voiceInput.js` (186 líneas, VOZ-1) usa
`window.SpeechRecognition || window.webkitSpeechRecognition` (`:13`), en `es-ES` por defecto
(`:63`), con `continuous = true` para dictado largo (`:115`). Está **precargado por el service
worker** (`sw.js:78`) y **tras un flag**: `VOICE_QUOTE_ENABLED` (cabecera del fichero, `:7-8`).

> 🔴 **Esto significa que T5 tiene que:** partir de que **hay dos piezas y ya existen** —el dictado
> del navegador y el extractor de texto a líneas—, y que **la pregunta de la cuota de Gemini es
> secundaria**: por Gemini solo pasa texto corto. Lo que hay que decidir es si el reconocimiento
> del navegador sirve en obra (pregunta 3).

---

## 2 · «Gratis» tiene letra pequeña — y la letra **ya no está publicada**

**En una frase: los límites por minuto y por día del plan gratuito NO se pueden medir desde la
documentación pública, así que van como NO MEDIDO.**

| Dato | Resultado |
|---|---|
| Peticiones por minuto (RPM), plan gratuito | **NO MEDIDO** |
| Peticiones por día (RPD), plan gratuito | **NO MEDIDO** |
| Tokens por minuto, plan gratuito | **NO MEDIDO** |

La página oficial de límites — <https://ai.google.dev/gemini-api/docs/rate-limits> — **ya no publica
la tabla por modelo**. Dice que los límites «dependen de varios factores (como tu nivel de uso) y
**pueden consultarse en Google AI Studio**», y enlaza allí. **AI Studio exige sesión con la cuenta
del proyecto**, así que el dato **no es público** y este documento no lo estima.

La página de precios — <https://ai.google.dev/gemini-api/docs/pricing> — tampoco los da: el plan
gratuito aparece como «Free of charge» **sin cuantificar velocidad**.

> 🔴 **Quién puede medirlo:** el fundador, entrando en AI Studio con la cuenta del proyecto. Es el
> único sitio donde el número es real, y además es **por cuenta**: un número copiado de un blog
> valdría para otra cuenta, no para ésta.

### Lo que sí está publicado, y conviene tener delante

**El audio se paga distinto que el texto.** En el plan de pago de `gemini-2.5-flash`, la entrada de
audio cuesta **$1,00** por millón de tokens frente a **$0,30** de texto/imagen/vídeo — **3,3× más**
(fuente: página de precios oficial). En el plan gratuito los dos figuran como gratis, sin
cuantificar.

> 🔴 **Esto significa que T5 tiene que:** saber que **mandar audio a Gemini no es “lo mismo pero con
> otro fichero”** — cambia la tarifa y probablemente la cuota. Y que **hoy no hace falta**: el
> diseño actual manda texto ya transcrito por el navegador, que es la opción barata.

### El pico de las tardes, que era la preocupación

**No se puede contestar con datos públicos.** Lo que sí se puede decir con el código delante:

* Por Gemini pasa **una petición por dictado**, no un flujo continuo (`gemini.ts:43`, una sola
  `fetch` por modelo probado).
* Ante un `429` **no falla de golpe**: baja por la lista de modelos (`gemini.ts:95-105`). Eso
  amortigua un pico, **pero no lo mide**: si los tres modelos comparten cuota de cuenta, la lista no
  ayuda. **NO MEDIDO** si la comparten.
* El transporte **no tiene cola ni reintento diferido**: agotada la lista, lanza (`gemini.ts:107`).

---

## 3 · Sin cobertura: hoy **no funciona**, y falla en dos sitios distintos

**En una frase: sin red no hay dictado y no hay extracción, y ninguno de los dos se encola.**

### (a) El reconocimiento del navegador — falla el primero

Documentación oficial (MDN, `SpeechRecognition`):

> «En algunos navegadores, como Chrome, usar Speech Recognition en una página web implica un motor
> de reconocimiento **basado en servidor**. Tu audio se envía a un servicio web para procesarlo, así
> que **no funcionará sin conexión**.»

Existe una propiedad `processLocally` para exigir reconocimiento en el dispositivo, **y
`voiceInput.js` NO la usa** (barrido: cero apariciones). Su soporte tampoco está garantizado.

**Qué hace hoy el código cuando eso pasa** (`voiceInput.js:162-164`): el error `network` cae en la
rama final —«network/aborted/otros: cierre limpio»— y **se para en silencio**. No hay aviso, no hay
cola, no hay reintento. Lo ya dictado se queda en el `textarea`.

⚠️ Los otros errores **sí** avisan (`:147-160`: permiso, servicio no disponible, no-speech). **El de
red es el único que se cierra sin decir nada**, y es justo el de la obra.

### (b) La extracción — falla el segundo

`sw.js:113-117`: toda ruta que empiece por **`/admin/`** va **directa a la red, sin caché**:

```js
if (url.pathname.startsWith('/admin/') || ... ) {
  event.respondWith(fetch(event.request));
  return;
}
```

La IA está en `/admin/ai` (`app.ts:541`), así que **cae ahí**: sin red, la petición falla de
inmediato. **No hay cola, no hay reintento y no hay caché** para ella.

> ⚠️ **Y el contraste que lo hace evidente:** la FIRMA sí tiene cola (`colaDeFirmas.js`, SCRUM-358,
> que encola **antes** de subir). La voz **no tiene equivalente**. La casa ya sabe hacer esto; no
> está hecho aquí.

> 🔴 **Esto significa que T5 tiene que:** aceptar que el flujo del prompt —**grabar offline →
> transcribir al volver → el técnico confirma DESPUÉS**— es el único que funciona en un sótano, y
> que **es un diseño distinto**, no un ajuste. Y trae consecuencias que hoy no existen:
>
> * **Habría que guardar un fichero de audio.** Eso rompe la propiedad que `ai.service.ts:157-161`
>   defiende («no hay fichero de audio que guardar… ni superficie RGPD nueva») y abre **tres cosas a
>   la vez**: almacenamiento, coste por minuto y tratamiento de datos personales — **una voz es un
>   dato personal**. El propio comentario avisa de que eso «es una decisión de otro tamaño».
> * **O bien** se acepta que el dictado **solo funciona con cobertura** y en el sótano se escribe a
>   mano — que es lo que pasa hoy, solo que sin decirlo.
>
> **Las dos son decisiones del fundador**, y la segunda es gratis.

---

## 4 · 🔴 La cantidad inventada: en un parte el argumento de SCRUM-507 se cae

**Primero, una corrección de coordenada.** El encargo sitúa el invento en `ai.service.ts:140`.
**Ahí ya no está**: SCRUM-507 movió el criterio a su propio módulo, y `ai.service.ts:140` es hoy
`return mapearLineasSugeridas(parsed);`. **Gana el código.**

**Dónde está hoy:** `src/modules/ai/domain/lineasSugeridas.ts:42`

```js
return Number.isFinite(n) && n > 0 ? n : 1;
```

Con su criterio escrito al lado (`:34`): *«si no se dice, 1»*.

### Por qué en un parte no vale

En un **presupuesto**, quien revisa **puede comprobar la realidad**: el trabajo no se ha hecho, y
si el número no cuadra se mira.

En un **parte**, la realidad **ya no está**. El técnico salió del edificio y el cable está dentro de
la pared. Y quien valora el parte en la oficina **pone los precios, no vuelve a contar los metros**:
la cantidad le llega dada y la multiplica.

Ese es el cambio: en el presupuesto hay una persona **entre el invento y el cobro que puede
verificar**; en el parte hay una persona que **solo puede confiar**.

⚠️ Y hay un agravante medido: el parte se firma. Si el `1` inventado entra antes de la firma, **el
cliente firma una cantidad que nadie dijo**, y el sello del parte la congela (SCRUM-652 fase B:
`unds` entra en el canónico).

### Qué haría falta para que se distinga a simple vista

**Esto es lo que el encargo pide anotar, y va como propuesta, no como decisión.**

1. **Que la cantidad no propuesta por una persona NO exista.** La forma más barata y la más
   honesta: si el modelo no pudo leer la cantidad, la línea llega **sin cantidad** y el hueco se ve.
   Un hueco se rellena; un `1` no se corrige porque no parece un error.
   ⚠️ Requiere que el tipo admita «sin cantidad», que hoy no admite (`lineasSugeridas.ts:42`
   siempre devuelve número).
2. **Que quede marcado el ORIGEN de cada campo**, no de la línea entera: `cantidad` propuesta por
   máquina es distinto de `descripcion` propuesta por máquina. Un campo por línea, no un booleano
   por línea.
3. **Que se vea en la pantalla sin leer nada** — y aquí hay un precedente en casa que conviene no
   reinventar: SCRUM-507 ya aprobó microcopy para marcar por línea lo que la IA supuso. Reutilizar
   ese mecanismo es más barato que estrenar otro, y evita dos vocabularios para el mismo hecho.
4. **Y que la firma lo respete:** si una cantidad sigue marcada como propuesta, **no debería poder
   firmarse el parte**. Eso es un guard, y es la única de las cuatro que impide el daño en vez de
   señalarlo.

> 🔴 **De quién es cada decisión:** (1) y (2) son de quien construya, con el fundador si cambia el
> contrato de la API. (3) es **microcopy: regla 30, del fundador**. (4) es una regla de producto:
> **del fundador**.

---

## Resumen para planificar T5

| Pregunta | Respuesta | Consecuencia |
|---|---|---|
| 1 · ¿Qué hay? | Gemini **solo texto**, embudo único. **El dictado ya existe** y es del navegador | No hay que integrar voz: hay que decidir si la que hay sirve |
| 2 · Límites del plan gratuito | **NO MEDIDO** — ya no son públicos | Lo mira el fundador en AI Studio. Y el audio se tarifa 3,3× el texto |
| 3 · Sin cobertura | **No funciona**, y falla en dos sitios | Grabar→transcribir→confirmar es otro diseño, con RGPD y coste nuevos |
| 4 · La cantidad inventada | El `1` está en `lineasSugeridas.ts:42` | En un parte nadie puede verificarlo, y además se firma |

## Decisiones pendientes, y de quién son

1. **Consultar los límites reales en AI Studio.** — Fundador. Sin eso, la pregunta 2 no se cierra.
2. **¿Se acepta que el dictado solo funcione con cobertura?** — Fundador. Es la opción gratis.
3. **Si no: ¿se guarda audio?** — Fundador, y arrastra RGPD, almacenamiento y coste por minuto.
4. **Cómo se distingue una cantidad propuesta por la máquina.** — Fundador (microcopy y regla de
   producto); quien construya, el contrato.

## Qué queda NO MEDIDO

1. **RPM / RPD / tokens por minuto del plan gratuito.** No están en la documentación pública.
2. **Si los tres modelos de la lista comparten cuota de cuenta.** De ello depende que el reintento
   de `gemini.ts:95-105` sirva de algo en un pico.
3. **Qué navegador y versión usan los técnicos de Tecnosel.** Decide si `processLocally` es siquiera
   una opción, y no se puede saber desde el código.
