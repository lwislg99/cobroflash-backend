# SCRUM-1601 · El webhook de WhatsApp aplicaba transiciones de `WhatsAppMessage.status` que la Parte L no fija

## J2 · SCRUM-1601 · medición por la ruta real y ajuste de `shouldApplyStatus` a la Parte L

**Medido contra:** `origin/main` = `bd2369c069766ee0c7fcab3be68701d347801a56` · 2026-10-23T20:46:26Z (hora de GitHub; sesión J2 `jv-j2ax`, por encargo del orquestador `cobroflash-backend-62`)

A9: comprobación → `tests/scrum1601-transiciones-del-webhook-wa.test.mjs`

[Escrito por J2, una sesión; no por el fundador.] El hallazgo es de J5 (SCRUM-1499 c.20654 §6), que
ejecutó la función suelta. Aquí se mide por donde llegan de verdad los estados: `POST /webhooks/whatsapp`
firmado, a la app entera de `dist/app.js`, con un evento `statuses` fabricado por par y una fila con
`waMessageId` por par (base en memoria; `WHATSAPP_DRY_RUN`; `fetch` revienta si alguien lo llama).

### La matriz medida ANTES del arreglo (42 pares: 6 orígenes × 7 destinos)

`deleted` es un estado inventado por el banco, para ver qué hace con lo desconocido.

| origen \ destino | queued | sent | delivered | read | failed | received | deleted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| queued | no | SÍ | SÍ | SÍ | SÍ | no | no |
| sent | no | no | SÍ | SÍ | SÍ | no | no |
| delivered | no | no | no | SÍ | **SÍ** | no | no |
| read | no | no | no | no | **SÍ** | no | no |
| failed | **SÍ** | **SÍ** | **SÍ** | **SÍ** | **SÍ** | no | no |
| received | **SÍ** | **SÍ** | **SÍ** | **SÍ** | **SÍ** | no | no |

Coincide celda a celda con la que J5 sacó de la función suelta (`docs/master/evidencias/scrum1499/transiciones.txt`).
Controles: el webhook leyó 42 filas de 42, una fila testigo sin evento no se movió, y las cinco flechas de la
Parte L se aplican (con el error de Meta guardado en `sent → failed`).

En negrita, las que la Parte L (`queued → sent → delivered → read` · `queued|sent → failed(error)` · `received`
sin transiciones) no fija. **Cuáles se alcanzan de verdad** (leído en el código, no en una base):
- `delivered|read → failed`: sí, son filas que el propio webhook avanzó.
- `failed → …`: sí para una fila que pasó a `failed` POR el webhook (`sent → failed`); las `failed` que escribe
  el envío no llevan `waMessageId` (las 8 llamadas de `whatsapp.ts`). El daño: un `sent` o `delivered` que llega
  tarde BORRABA el fallo, y `failed → failed` pisaba el error con el del segundo aviso.
- `received → …`: no se alcanza hoy (`recordInboundWaMessage` no guarda `waMessageId`); se cierra igual.
- `queued → …`: tampoco (la reserva sólo recibe `waMessageId` al pasar a `sent`).

### El cambio

`src/modules/messaging/domain/whatsappLog.service.ts`, `shouldApplyStatus`: de un origen fuera de la cadena
(`failed`, `received` o desconocido) no se sale; `failed` sólo desde `queued` o `sent`. Nada más: ni una
transición nueva, ni un envío nuevo (regla 28), ni la ruta.

`tests/whatsappLog.test.mjs` decía «failed siempre se aplica (aunque ya esté read)» y afirmaba `read → failed`
verdadero: codificaba el defecto contra la Parte L, y se cambia con el código (no es un guard que se relaje:
ahora afirma más casos, y al revés).

Rojo primero: contra el `dist` de antes, el test nuevo da 3 de 5 (caen «HACIA failed» y «DESDE failed»).
Después, 5 de 5, y 12 de 12 con `whatsappLog.test.mjs`. Mutaciones (declaradas en el test y aplicadas a mano,
compilando cada vez): quitar `if (cur < 0) return false;` tumba sólo «DESDE failed»; volver a `return true;`
para `failed` tumba sólo «HACIA failed». Fuente restaurado y cotejado con `cmp`.

### Lo que NO se ha juzgado: los saltos hacia delante — propuesta, sin construir (regla 27)

El código aplica `queued → delivered`, `queued → read` y `sent → read`. La Parte L dibuja la cadena y no dice
si un salto vale. De los tres, sólo `sent → read` se alcanza (las `queued` no tienen `waMessageId`). Cerrarlo
perdería un `read` real si el `delivered` llega después, y el comentario del código dice que Meta puede
entregar los avisos fuera de orden (no he encontrado documentación de Meta en el repositorio que lo mida). El
test los mide y los imprime, pero no los afirma. **Propuesta para el máster, no aplicada:** añadir a la línea
de `WhatsAppMessage` de la Parte L «los avisos de entrega sólo avanzan por la cadena y pueden saltarse un
eslabón (`sent → read`)». Lo decide el fundador.

### Lo que no he medido
- Si Meta manda de verdad `failed` después de `delivered`: no hay documentación de Meta en el repositorio que lo
  diga, y producción no se mira. Si lo hiciera, desde hoy ese `failed` no se guarda; el fallo sí sale en los
  logs de Railway (`[WA webhook] POST recibido`), pero no el contenido del estado.
- Ninguna base real: sólo el banco en memoria.

## SCRUM-1601b · 23-oct: el salto `sent → read`, FIRMADO, aplicado a la Parte L (carril un jefe, por encargo)

**Medido contra:** `origin/main` = `ba587af0205aef949bdedc4b7d479e5ca598950e` · 2026-10-23T22:07:09Z (hora de GitHub)
A9: aviso → cicatriz J4 «pedí cinco tickets ENTEROS a Jira, con todos sus comentarios devueltos al chat, cuando de cuatro sólo necesitaba uno o dos comentarios, y crucé los 200k a mitad del encargo» — no se pudo comprobar: volví a pedir SCRUM-1499 entero (9 comentarios) para leer sólo c.20703; esta vez no crucé los 200k, pero la herramienta sigue sin dejar pedir un comentario suelto y nada obliga a mandar la salida a fichero

J4 (`jv-j4aa`, equipo de Javier). Carril «un jefe», aplicado por encargo del orquestador `cobroflash-backend-62`.
Firma del fundador: **c.20673** («Sí, se añade»), que responde a la propuesta de c.20671 §3. Se aplica
después de #2783 (1499b), que tocaba la misma línea: mergeado como `94583f1ac` (c.20703).

- **Parte L, línea 409:** se AÑADE al final, copiado de c.20673, «Los avisos de entrega sólo avanzan por la
  cadena y pueden saltarse un eslabón (`sent → read`).» y una nota en el formato de las que ya lleva la línea:
  *(SCRUM-1601: el salto no estaba fijado en esta línea; entra por decisión del fundador, SCRUM-1601 c.20673.)*
  No se borra nada.
- **Cotejo por programa:** diff del máster +1 −1, 1.913 líneas antes y después (no se mueve ninguna); la línea
  409 contiene la frase firmada byte a byte; sin NBSP ni CRLF en el fichero.
- **No se añade** (c.20673): volver atrás desde `failed`. La Parte J no se toca: desde 1499b apunta aquí.
- **Control: ¿algún test lee la Parte L y dice ahora otra cosa que el código de #2785?** Ninguno la PARSEA:
  `tests/scrum1601-transiciones-del-webhook-wa.test.mjs` y `tests/whatsappLog.test.mjs` llevan las flechas
  escritas a mano (`FIJADAS`, 5) y los saltos en un conjunto aparte (`SALTOS`) que miden sin afirmar. Los
  otros 24 ficheros que nombran «Parte L» son de otras entidades (albaranes, facturas, trabajos).
- 🔴 **Discrepancia, sin tocar código (regla 27; va al orquestador):** `shouldApplyStatus` aplica, además de
  `sent → read`, `queued → delivered` y `queued → read`. La línea firmada nombra sólo `sent → read`, y
  `queued → read` se salta DOS eslabones. Según el registro de 1601 (arriba), ninguna de las dos se alcanza
  (las `queued` no llevan `waMessageId`); eso está leído, no re-medido aquí. Y el comentario de cabecera de
  `scrum1601-transiciones-del-webhook-wa.test.mjs:15-16` sigue diciendo que si los saltos están fijados «es
  una pregunta»: carril J2.
- Sin mirar: yaqu.app (el máster no se sirve). No transiciono (A13).
