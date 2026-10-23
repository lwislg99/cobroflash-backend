# SCRUM-1499 · La Parte J deja de enumerar los valores de `WhatsAppMessage` y apunta a la Parte L (redacción para firmar)

**Medido contra:** `origin/main` = `b6dd5d1a8d64abd0bf835141e8d9bac6d5d2055f` · 2026-10-23T20:22:22Z (hora de GitHub)

A9: sin fallo que generalice — las dos medidas de este tramo llevan su control dentro (el censo, una semilla que sin ella dice CIEGO; la función, ejecutada desde su propio texto) y ninguna cifra del encargo se usó sin volver a medirla.

Sesión J5 (`jv-j5ae`, 23-oct, equipo de Javier), ticket de `area-j5`. Encargo del orquestador
(`cobroflash-backend-62`) tras la decisión del fundador en SCRUM-1499 c.20652, respuesta literal
«Se amplía el máster», que pide redactar el cambio y **no firma ningún texto todavía**.

## Ⓐ Qué hay en este PR, y qué no

Sólo este registro y `docs/master/evidencias/scrum1499/` (los dos instrumentos y sus salidas).
**`docs/YAQU_MASTER.md` NO se toca**: lo cambia un jefe con la firma del fundador (regla 35).
`src/`, `tests/`, `public/` y `prisma/schema.prisma` no se tocan.

La redacción, lista para «✅ lo firmo / ❌ no», está en **SCRUM-1499 c.20654**. Aquí va la misma, para
que quien la aplique la tenga en el repositorio.

## Ⓑ Qué escribe hoy el código en `WhatsAppMessage.type` y `.status`

`node docs/master/evidencias/scrum1499/censo-wa.cjs .` — AST sobre **333 ficheros `.ts` de `src/`, 0 sin
parsear**: el `data` de cada escritura de Prisma sobre `whatsAppMessage` y cada llamada a
`recordWaMessage` / `updateWaMessageStatus`, alias de importación incluidos. **40 hallazgos**
(`censo-wa.txt`).

| control | resultado |
|---|---|
| positivo SEMBRADO por el propio instrumento (un `create` con valores inventados y una llamada por alias) | VISTO |
| el mismo, quitando la semilla (`--sin-semilla`) | CIEGO, código 1 (`censo-wa-sin-semilla.txt`) |
| cero: el mismo `create` sobre un modelo mal escrito | 0 |

| columna | valor | quién lo escribe |
|---|---|---|
| `type` | `template` | `reservarPlantilla` (`whatsappLog.service.ts:179`) y `recordWaMessage` en `whatsapp.ts:344` y `:451` |
| `type` | `service` | 13 llamadas a `recordWaMessage` en `whatsapp.ts` |
| `type` | `inbound` | sólo `recordInboundWaMessage` (`whatsappLog.service.ts:257`) |
| `status` | `queued` | sólo `reservarPlantilla` (`:181`) |
| `status` | `sent` / `failed` | las 15 llamadas a `recordWaMessage`, las 15 con el valor explícito (el `?? 'sent'` de `:50` hoy no lo usa ninguna), y la resolución de la reserva (`:219-220`) |
| `status` | `received` | sólo `recordInboundWaMessage` (`:258`), siempre junto a `type` `inbound` |
| `status` | `delivered` / `read` | sólo el webhook (`whatsappIncoming.routes.ts:123` → `updateWaMessageStatus`), que copia el estado de Meta si `shouldApplyStatus` lo deja |

La unión `WaMsgType` (`whatsappLog.service.ts:16`) cierra los tres tipos en el código, y su comentario
(`:14-15`) da el significado de cada uno.

## Ⓒ Qué dice hoy el máster

- **Parte J (J4), `docs/YAQU_MASTER.md:315`**, 383 B, leída entera: enumera `type` con dos valores (le
  falta `inbound`) y enumera los estados de los salientes.
- **Parte L, `:409`**, 548 B, leída entera: fija los valores de `status`, `received` incluido
  (SCRUM-1529c). **De `type` no dice nada**, y su propia nota avisa de que la Parte J repite la lista.

Un puntero de la Parte J a la Parte L vale para `status`, pero para `type` apuntaría a un sitio que no
lo tiene. Por eso la redacción son **dos cambios, que se firman por separado**.

## Ⓓ Cambio ① — Parte J, línea 315 (una línea por una línea)

ANTES:

```
Tabla `WhatsAppMessage {id, merchantId, customerId?, type:'template'|'service', templateName?, waMessageId, status, error?, relatedType?, relatedId?, costEstimate, createdAt}`. Estados: `queued → sent → delivered → read` | `→ failed(error)`; fuente: webhook `/webhooks/whatsapp` (rama `statuses`, activable antes que el bot). UI: chip de entrega en detalle de quote/factura.
```

DESPUÉS:

```
Tabla `WhatsAppMessage {id, merchantId, customerId?, type, templateName?, waMessageId, status, error?, relatedType?, relatedId?, costEstimate, createdAt}`. Los valores de `type` y de `status`, y las transiciones de `status`, los fija la Parte L («WhatsAppMessage»); aquí no se repiten. Los estados de entrega de los salientes llegan por el webhook `/webhooks/whatsapp` (rama `statuses`, activable antes que el bot). UI: chip de entrega en detalle de quote/factura.
```

## Ⓔ Cambio ② — Parte L, línea 409 (se añade al final; no se borra nada)

ANTES:

```
**WhatsAppMessage:** `queued → sent → delivered → read` · `queued|sent → failed(error)`. `received`: estado de los mensajes ENTRANTES, sin transiciones fijadas aquí (regla 27: nadie las ha medido); son las filas que sostienen la ventana de 24 h. *(13-oct-2026, SCRUM-1529c: `received` no estaba en esta línea; entra por decisión del fundador ⑦, SCRUM-1529 c.19228, aplicada con su autorización c.19299. La tabla `WhatsAppMessage` de la Parte J repite la lista de los salientes y NO se ha tocado: el permiso cubre sólo la Parte L.)*
```

DESPUÉS:

```
**WhatsAppMessage:** `queued → sent → delivered → read` · `queued|sent → failed(error)`. `received`: estado de los mensajes ENTRANTES, sin transiciones fijadas aquí (regla 27: nadie las ha medido); son las filas que sostienen la ventana de 24 h. *(13-oct-2026, SCRUM-1529c: `received` no estaba en esta línea; entra por decisión del fundador ⑦, SCRUM-1529 c.19228, aplicada con su autorización c.19299. La tabla `WhatsAppMessage` de la Parte J repite la lista de los salientes y NO se ha tocado: el permiso cubre sólo la Parte L.)* `type`: `template` (plantilla de Meta, de pago) | `service` (texto o interactivo dentro de la ventana de 24 h, 0 €) | `inbound` (mensaje ENTRANTE del cliente; va siempre con `status` `received`). *(SCRUM-1499: `type` no estaba en esta Parte; entra por decisión del fundador, SCRUM-1499 c.20652, con este texto firmado en c.‹número del comentario de firma›. Desde entonces la tabla de la Parte J deja de repetir las listas y apunta aquí.)*
```

El único hueco es el número del comentario de firma: no existe hasta que se firme, y lo rellena quien
aplique. La Parte L sí enumera, a propósito: es la fuente (regla 27); lo que deja de enumerar es lo que
la copiaba (c.18780 de SCRUM-1401, condición ①). «Va siempre con `received`» es lo medido: 1 de 1
escrituras de `inbound`, y esa fila no lleva `waMessageId`, así que el webhook no la alcanza.

La alternativa que no se recomienda: que la Parte J apunte `type` a `WaMsgType`. Ahorra el cambio ②,
pero el máster no recogería `inbound` (contra el c.20652) y quien decidiría los tipos sería el código.

Los dos ANTES de arriba se cotejaron byte a byte contra `git show origin/main:docs/YAQU_MASTER.md`,
líneas 315 y 409: iguales.

## Ⓕ Lo que queda fuera, y lo que no se ha medido

- **Los comentarios del esquema** (`prisma/schema.prisma:1284` y `:1288` hoy; el ticket decía 1270 y
  1274) siguen enumerando. No se tocan hasta que esto esté firmado y aplicado, y entonces piden su
  propia firma (regla 40).
- **El `queued` que el ticket daba por no escrito** lo escribe `reservarPlantilla` desde SCRUM-1513.
- **De paso, sin arreglar y fuera de esta decisión:** `node docs/master/evidencias/scrum1499/transiciones.cjs .`
  saca `shouldApplyStatus` y `STATUS_RANK` del fichero real por AST y los ejecuta (`transiciones.txt`;
  control: `queued → sent` sí, `read → delivered` no). Deja pasar `delivered → failed`, `read → failed`
  y, desde `failed`, a `queued`, `sent`, `delivered` y `read`; la Parte L sólo fija
  `queued|sent → failed`. **Que esas transiciones ocurran está sin medir:** sólo las puede provocar el
  webhook, y sólo sobre filas con `waMessageId`. Se nombra para que lo decida el orquestador.
- Nada contra una base. Del resto del máster sólo se barrió la lista `'template'|'service'`: sale en
  la línea 315 y en ninguna otra.
