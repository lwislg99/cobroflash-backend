# SCRUM-1401 · Diez comentarios del esquema dejan de enumerar valores y nombran quién los decide

**Medido contra:** `origin/main` = `938c73a6b1a18627d064891827a5729ab302bef3` · 2026-10-07T17:09:37Z (hora de GitHub)

A9: aviso → A10 «Un barrido que busca dónde se escribe un campo no ve el objeto que se construye en otro fichero: se cruza con el nombre del campo.» — no se pudo comprobar: es una regla de cómo se escribe un censo por AST, y no hay un instrumento de la casa que compare dos censos entre sí

Sesión J5 (`jv-j5`, 7-oct, equipo de Javier), ticket de `area-j5`.

## Ⓐ Qué se toca

`prisma/schema.prisma`: **11 líneas, y sólo su comentario** (10 propuestas; la primera ocupa dos
líneas). `git diff --numstat` da `11 11`. Ningún campo, ningún tipo, ningún `@default`. Ninguna línea
cambia de sitio. `src/`, `tests/` y `public/` no se tocan.

**La firma.** El esquema se lee (regla 40) y un comentario suyo es el fichero. Las diez líneas se
presentaron al fundador redactadas en SCRUM-1401, comentario 18779, y las firmó: comentario 18780,
respuesta literal «Sí firmo», con cuatro condiciones (dejan de enumerar; donde no hay lista cerrada
la línea lo dice; ni un campo; el preview dice «sin cambios»). La firma la transcribió el
orquestador (`cobroflash-backend-90`); yo la leí en Jira antes de editar, no se la oí al fundador.
Las líneas entran letra por letra como están en el 18779.

## Ⓑ Los controles que mandan

| control | resultado |
|---|---|
| El esquema de antes y el de después, quitando de cada línea lo que va tras `//`, comparados línea a línea | 1.834 líneas los dos · 0 difieren (control: los ficheros enteros SÍ difieren) |
| `node scripts/preview-migracion.mjs --desde <esquema de antes>` | «control positivo: la herramienta responde (33 tablas)» · «sin cambios pendientes» · sale 0 (`evidencias/scrum1401/preview-migracion.txt`) |
| retornos de carro y BOM en el esquema tras editar | 0 y no |

El preview no se pudo correr dentro del worktree: no tiene `node_modules` y la herramienta lo dijo
(«LA HERRAMIENTA NO RESPONDE», sale 1), que es lo que tiene que hacer. Se corrió con el MISMO guion
y el esquema nuevo copiados a una carpeta temporal fuera del repo, enlazada al `node_modules` de
`cobroflash-jv5` (Prisma 6.18.0, la versión de `package.json`). No es la ruta de la casa: lo declaro.

## Ⓒ Lo medido: los catorce no eran catorce iguales

El censo de SCRUM-1342 (36 comentarios que enumeran con «|», 14 que divergen) se repitió sobre el
esquema de `965e3d05`: 36 otra vez, y las líneas de los catorce sin moverse. Cada uno se midió contra
lo que el código ESCRIBE en la columna, por AST sobre los 319 `.ts` de `src/` (0 sin parsear), y
contra el máster (Partes J4, K1, L y MEDIA-1). Instrumentos y salidas en `evidencias/scrum1401/`:

    node docs/master/evidencias/scrum1401/escrituras.cjs <raíz con src/> <ruta a node_modules/typescript>
    node docs/master/evidencias/scrum1401/llamadas.cjs   <raíz con src/> <ruta a node_modules/typescript>

Controles de los dos: `Merchant.plan` da 6 escrituras; un campo, un modelo y una función inventados
dan 0.

| clase | cuántos | líneas |
|---|---|---|
| A · sólo el comentario estaba atrasado: se corrige aquí | 10 | 70+72, 580, 672, 892, 1138, 1198, 1277, 1409, 1563, 1571 |
| B · no diverge del máster: no se toca | 1 | 1412 |
| C · el código escribe un valor que el máster no recoge: PARADO, cambio de máster | 2 | 1270, 1274 |
| D · no es el comentario, es comportamiento: fuera del ticket | 1 | 1157 |

Qué escribe el código en cada una de las diez (el detalle «hoy / código / propuesta», en el 18779):

| línea | campo | lo que decía | lo que escribe el código | quién decide |
|---|---|---|---|---|
| 70+72 | `Merchant.subscriptionStatus` | dos comentarios que se contradecían | lo mismo que la Parte L; el valor de la línea 70 no lo escribe nadie | Parte L y `stripe.routes.ts` |
| 580 | `Quote.origin` | un valor que nadie escribe | un solo escritor, y la revisión lo copia | `maintenance.service.ts`, `revision.ts` |
| 672 | `Quote.createdVia` | dos valores | cuatro, desde tres sitios | `schemas.ts`, `maintenance.service.ts`, `revision.ts` |
| 892 | `Invoice.type` | dos tipos | los tres de la unión | `TipoDocumento` |
| 1138 | `BotSession.state` | seis estados | los siete del máster | Parte K1 |
| 1198 | `CustomerEvent.type` | ocho valores | 17 (15 por 21 llamadas, 2 directos); sobran 2, faltan 11 | nadie: el campo es `string` abierto |
| 1277 | `WhatsAppMessage.relatedType` | tres | los cinco de la unión | `WaRelatedType` |
| 1409 | `Attachment.entityType` | dos, uno sin construir | dos, uno que no estaba | `attachment.service.ts`, `albaranes.routes.ts` |
| 1563 | `EmailMessage.kind` | cuatro y «...» | nueve | `CLASES_DE_CORREO` |
| 1571 | `EmailMessage.relatedType` | tres | dos | `email.service.ts` |

**El bot no era el caso de la regla 27.** El ticket y la ficha lo traían como «un estado que el máster
no tiene». El máster sí recoge el séptimo estado (Parte K1, línea 374, cambio A18 del 7-jul). Código y
máster coinciden; sólo el comentario se había quedado corto.

**El caso de la regla 27 es `WhatsAppMessage`, y no entra aquí.** Para el mensaje entrante el código
escribe un `type` y un `status` (`whatsappLog.service.ts:80-81`) que ni la Parte J4 ni la Parte L
recogen: la palabra del `status` aparece 0 veces en el máster (control: «delivered», 4). Y al revés, el
primer estado de la Parte L no lo escribe ninguna línea de `src/` (es sólo el `@default` de la tabla),
aunque `envioDelDocumento.ts:56` lo lee. Líneas 1270 y 1274 sin tocar; lo decide el fundador.

**Línea 1157 (`QuoteTemplate.paymentTerms`), fuera.** `templates.routes.ts:40` y `:79` guardan lo que
llegue en el cuerpo sin validar. Leído, no ejecutado. Corregir el comentario sin decidir si se valida
sería documentar un hueco.

## Ⓓ De paso, sin arreglar

- **El censo de SCRUM-1342 comparaba el comentario con el código, nunca con el máster.** Por eso dio por
  bueno `QuoteRequest.status`: comentario y código coinciden entre sí, y la Parte L dice otra máquina de
  estados. Los otros 19 que dio por buenos están sin cotejar con la Parte L.
- La misma lista atrasada vive en dos comentarios de `src/`: `registroDeEnvios.ts` (el `relatedType` del
  contexto de envío) y `metrics.service.ts:380`.

Los dos tickets (el de `WhatsAppMessage` y el de `QuoteRequest` con los 19) los abre el orquestador.

## Ⓔ Lo que me salió mal

- **Mi primer barrido no vio dos escrituras.** Buscaba la propiedad dentro de la llamada de Prisma, o en
  un fichero que nombrara al modelo. No vio el `createdVia` de `revision.ts` (el objeto se construye en
  un fichero que no nombra al modelo) ni una llamada a `recordCustomerEvent` hecha por alias en
  `maintenance.service.ts`. Los cazó un recuento por el nombre del campo, no el instrumento. Las dos
  salidas de `evidencias/` son un SUELO: la del 1198 da 20 llamadas y son 21.
- **La base se movió mientras medía.** Medí sobre `965e3d05` y construí sobre `938c73a6`. Entre los dos,
  en lo que este ticket mira, sólo cambió `src/modules/payments/disputes.service.ts`, que tiene una de las
  21 llamadas. No repetí el barrido: ninguna de las diez líneas enumera, así que no dependen de él.

## Ⓕ Lo que NO se ha hecho

- Nada se ha ejecutado contra una base: es AST y lectura.
- La parte ⑤ del ticket (15 líneas `MAPA[clave] ?? defecto`) está sin clasificar: es comportamiento.
- Las líneas 1157, 1270, 1274 y 1412 siguen como estaban.
- No se corrió la tanda completa ni la dirigida (el worktree no tiene `node_modules`): la da el
  obligatorio del CI. En local, sólo los guards de registro que se citan en la entrega.

## Aceptación → dónde se ve

El ticket no trae una lista bajo «Aceptación»; trae «Lo que pide», y es lo que se usa.

| lo que pide (literal) | dónde se ve |
|---|---|
| ① Clasificar los 14 por consecuencia, no por número | sección Ⓒ de este registro |
| ② Decidir qué hace el comentario, y decidirlo UNA vez para todos | `prisma/schema.prisma`, las 11 líneas: remiten a quien decide (firma: comentario 18780) |
| ③ Las dos de `Merchant.subscriptionStatus` (70 y 72): una se va | `prisma/schema.prisma:70` y `:72` |
| ④ Re-medir los TRES sin verificar (1198, 1409, 1412) | sección Ⓒ y `evidencias/scrum1401/` |
| ⑤ Clasificar las 15 líneas de `MAPA[clave] ?? defecto` | NO HECHO → lo reparte el orquestador de Javier |
| ⑥ nada de código cambia de comportamiento | sección Ⓑ: 0 líneas difieren sin comentarios y el preview dice «sin cambios» |
