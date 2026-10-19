# SCRUM-1236 — Los textos que afirman algo falso fuera del panel (landing, legales, bot)

**Medido contra:** `origin/main` = `48fc00f6a90089b0f172b58c49413d889288bec0` · 2026-10-16T11:27:28Z

Carril S4 (microcopy) · lo medido del 14 al 15-oct-2026 vive en Jira (c.19745, c.19791, c.19813, c.19822).
Este registro empieza con lo que dejó pendiente c.19822: los 5 PDF que salieron CIEGOS.
A9: sin fallo que generalice — cabecera del registro: lo medido, y su error, van en el tramo de abajo

## 1236 — los PDF de presupuesto, leídos por dentro (S4, s4-16oct)

**Medido contra:** `origin/main` = `48fc00f6a90089b0f172b58c49413d889288bec0` · 2026-10-16T11:27:28Z

Producción servía ese mismo SHA (/version).

**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún texto: sólo se leen PDF servidos.

**La pregunta de c.19822:** los 5 PDF que enlaza el portal del cliente 83 salieron ciegos para `privacidad:92`
(«IP y navegador nunca se exponen públicamente»), porque van comprimidos y en sus bytes no se ve el texto.
**¿Se puede leer su texto?** Sí, y sin dependencias nuevas. Los dos generadores (`pdf.service.ts:335` y `:797`)
usan las fuentes estándar de pdfkit (Helvetica, WinAnsi): basta con inflar cada stream con el `zlib` de node
y leer los operadores `Tj`/`TJ`. Lo hace `docs/master/evidencias/SCRUM-1236/pdf-texto.mjs`.

**Controles, antes de mirar** (`control-salida-16oct.txt`):

| control | lo que se esperaba | lo recibido |
|---|---|---|
| PDF COMPRIMIDO hecho aquí con el pdfkit del repo, con IP, `Mozilla/5.0` y acentos | en los bytes crudos no se ve; el extractor sí | crudo: `Mozilla` no aparece (la ceguera de ayer, reproducida) · extractor: IP, navegador y acentos, los tres |
| PDF REAL con evidencia: albarán #47, firmado (`GET /admin/albaranes/47/pdf`, panel QA) | el certificado se lee | «Certificado de evidencias de la firma», Firmante, Sello temporal, Canal, SHA-256 · 0 IP · 0 navegador |
| su negativo: albarán #46, sin firmar | sin certificado | sin certificado |

**Los 5, por la vía pública** (portal del cliente 83 y `/pay/quote/<token>/pdf`, SIN cookie; los tokens no se
imprimen; `sonda-pdfs-salida-16oct.txt`): 200 `application/pdf` los cinco, 2.085-2.268 B, 1 stream inflado y
0 fallidos cada uno. Cada uno trae texto conocido (su número —#1, #2, #3, #3.1, #5— y «Cliente de pruebas
QA»). **0 IPv4, 0 IPv6, 0 navegador y 0 certificado** en los cinco: ninguno de esos presupuestos está firmado
(c.19813: el único aceptado, el #206, tiene `evidence:null`).

**Veredicto:** los 5 dejan de estar CIEGOS. Leídos, no exponen IP ni navegador. `privacidad:92` sigue
«ni falso ni comprobado», por lo mismo que en c.19822: la superficie que decide (la página pública de un
documento FIRMADO, y el PDF de un presupuesto firmado) espera la regla para firmar en QA.

- **De paso, un fallo del extractor que cazó su propio control:** en el #47 la 1.ª versión contó 3 streams,
  uno «sin inflar». No era del PDF. La regex `stream\n` casaba dentro de `endstream\n` y tomaba como stream
  el hueco entre dos objetos. Ahora salta el `endstream` entero: el #47 da 2 de 2 inflados, y los otros no
  cambian. Sin el control del #47, ese «1 fallido» se habría leído como «hay algo que no se puede leer».
A9: sin fallo que generalice — el falso stream lo cazó el control del #47 antes del veredicto, y el arreglo va en el mismo extractor que lo usa

## 1236b — con la regla para firmar en QA, `/albaran/<firmaToken>` sigue sin alcanzarse (S4, s4-16oct)

**Medido contra:** `origin/main` = `555c65fa91cd12d54d735a40b90e479805b276fa` · 2026-10-16T11:53:07Z

Producción servía `37c52e17d62319300469075474d99399eafd2af1` (/version). Entre las dos sólo está el #2510
(`exports.routes.ts`), que no toca nada de lo leído aquí.

**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún texto.

**La regla llegó** (R25 del orquestador, 16-oct, con el sí del fundador: firmar un parte y un albarán en la
cuenta de QA). **Pero firmar no es lo que faltaba.** Para ver la página pública de un parte firmado hay que
tener su `firmaToken`, y ese token:

| pregunta | lo que hay | dónde |
|---|---|---|
| ¿quién lo crea? | sólo el envío «para firmar» por WhatsApp, justo antes de mandar el mensaje | `albaranWhatsApp.service.ts:133`, la única escritura de `firmaToken` en `src/` |
| ¿lo devuelve el panel? | no. `GET /admin/albaranes/46` y `/47` en yaqu.app (cuenta QA) no traen `firmaToken`, y los dos dicen `enviadoParaFirma:false` | medido hoy, 11:5xZ |
| ¿lo guarda el registro de envíos? | no. La fila de WA-0b guarda teléfono, plantilla, estado y coste, pero no el cuerpo | `whatsappLog.service.ts:42-56` |
| ¿lo enseña el portal del cliente? | no. El portal no lista ni partes ni albaranes | `customerPortal.routes.ts` |

O sea: el enlace sólo existe dentro de un WhatsApp de verdad, y lo lee el móvil del cliente 83, no el equipo.
Mandarlo es una salida a Meta que cuesta dinero y llega a un teléfono real, y R25 no lo cubre: cubre firmar,
no enviar. **No se ha firmado nada.** Firmar es irreversible (R25 ②/③), y una firma en obra no abre la página
remota. Lo único que daría es un PDF con certificado, y eso ya está medido con el #47 (tramo de arriba: 0 IP,
0 navegador). Una firma que no mide nada no cuenta como medida (R25 ⑥).

**Lo que sí se sabe, leído (no medido en producción):** la rama `firmado` de `GET /albaran/:token`
(`albaranPublic.routes.ts:258-263`) pinta la cabecera del negocio, «Este parte de trabajo ya está firmado.» y
el nombre del cliente, y nada de `evidenciaFirma`. El `POST …/firmar` contesta `{ ok, portalUrl? }` o
`{ ok, already }` (`:383`, `:491`). Las dos vías de firma (remota `:437-438`, en obra
`albaranes.routes.ts:1056-1058`) guardan IP y navegador en la evidencia, y el PDF no los imprime
(`albaranPdf.service.ts:414`).

**Veredicto:** `privacidad:92` se queda **DECLARADO no medible en producción por el equipo**. No es falso y
no está comprobado. El PDF firmado está medido; la página pública del firmado está leída, no vista. Para
verla hace falta una de dos, y las dos son del fundador: ① pulsar «Enviar para firmar» en el #46 (cuenta QA)
y abrir el enlace desde el móvil que lo recibe, o ② autorizar que el equipo mande ese WhatsApp y le pase el
enlace. Con el enlace en la mano: se mide la página del #46 emitido, se firma en obra desde el panel (R25,
con el #47 de gemelo ya firmado y el estado anotado antes) y se vuelve a pedir el MISMO enlace, que entonces
cae en la rama `firmado`.
A9: sin fallo que generalice — la premisa «falta la regla de firmar» la dejé escrita yo arriba sin leer de dónde sale el token; se corrige aquí, en el mismo registro

## 1236d — «Enviar para firmar» en el #46: autorizado por el fundador, NO enviado (S4, 18-oct)

**Medido contra:** `origin/main` = `06c6289d46d5998493ec014fa26ff3353946b58b` · 2026-10-18T17:42:18Z

Producción servía ese mismo SHA (/version). Sólo registro: no se toca código, y en la cuenta de QA no se ha
creado ni cambiado nada (sólo GET).

**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún texto.

A9: aviso → cicatriz S4 «di como vía para ver la página de firma «pulsar Enviar para firmar y abrir el enlace desde el móvil que lo recibe» sin mirar que el móvil del cliente 83 es inventado» — no se pudo comprobar: es una premisa de un registro y ningún test lee los datos de la cuenta de QA

**Qué pasó.** El orquestador encargó el envío con la autorización del fundador. La cita se leyó en su origen:
`ed676fd1-feb4-4658-bda2-01f4bf9fb3fc.jsonl`, turno `type:"user"` `2026-10-18T17:31:26.351Z`, «lo de un minuto
pues hazlo tu si imagino que peudes», en respuesta a «4 · Un minuto: el albarán #46… o dinos que lo mandemos
nosotros». **El clasificador de permisos de la sesión de S4 lo denegó** («Real-World Transactions») y no se ha
rodeado: un sí del fundador no levanta un bloqueo del harness, y pedírselo a otra sesión sería saltarse la misma
decisión. Lo levanta el fundador: lo pulsa él, o da el permiso en la sesión que lo vaya a hacer.

**Línea base, leída hoy en yaqu.app (cuenta QA, sólo GET):**
- `GET /admin/albaranes/46` → 200 · `AB260001`, `estado:"emitido"`, `enviadoParaFirma:false`, `lineas:[]`,
  cliente 83 con `puedeRecibirWhatsApp:true`.
- `GET /admin/customers/83/whatsapp` → 200 · `waOptOut:false` y UNA sola fila: id 450, 2026-10-06,
  `quote_decision_es`, `failed`, `error:"wa_opt_out"`. **Ningún envío a este cliente ha llegado nunca a Meta.**
- El móvil del cliente 83 es `34000001268` (medida del orquestador): inventado.

**Qué respuesta corresponde a qué causa**, leído en el código. El #46 va por `sendWhatsAppWindowFirst`; sin
ventana abierta (el cliente 83 no ha escrito nunca) cae a `sendWhatsAppTemplate`. La ruta convierte el resultado
con `sendResultJson` (`albaranes.routes.ts`), y lo que no es un motivo conocido acaba en `whatsapp_send_failed`
(`albaranWhatsApp.service.ts:181`):

| causa | respuesta del POST | fila nueva en `GET /admin/customers/83/whatsapp` |
|---|---|---|
| producción SIN token o SIN phone id | 200 `{sent:false, error:"not_configured"}` | `failed` · `error:"not_configured"` (`whatsapp.ts:351`) |
| cliente dado de baja (J3) | 200 `{sent:false, error:"wa_opt_out"}` | `failed` · `error:"wa_opt_out"` (como la 450) |
| tope diario del comercio o del cliente | 200 `{sent:false, error:"daily_cap"}` o `"customer_daily_cap"` | `failed` con ese motivo |
| plantilla que no casa con su spec (J7) | 200 `{sent:false, error:"whatsapp_send_failed"}` | `failed` · `error:"template_invalid: …"` |
| **Meta rechaza** (número falso, 131026, plantilla, token caducado…) | 200 `{sent:false, error:"whatsapp_send_failed"}`: **el código de Meta NO viaja** | `error` = el JSON que devolvió Meta (`whatsapp.ts:482`) |
| 🔴 `WHATSAPP_DRY_RUN=1` en producción | 200 **`{sent:true}`**: un «salió» FALSO (`whatsapp.ts:26`, `:451`) | fila `sent` con un `wamid.dryrun.…` |
| 🔴 **Meta ACEPTA y la entrega falla después** (número inexistente: 131026) — **medido el 18-oct, abajo** | 200 **`{sent:true}`** | primero `sent` con su `wamid`; minutos después, el webhook la pasa a `failed` · `error:"131026: Message undeliverable"` |
| entregado de verdad | 200 `{sent:true}` | `sent`, y luego `delivered` / `read` por el webhook |

**`{sent:true}` no distingue TRES situaciones:** dry-run, aceptado por Meta y no entregado, y entregado. Sólo
la fila del historial, leída DESPUÉS, las separa.

**Para medir el punto 2.1 de `docs/producto/ESTADO-DEL-PRODUCTO.md`** (¿está montado el WhatsApp de producción?)
no basta la respuesta del POST: hay que leer también la fila nueva del historial. `not_configured`, rechazo de
Meta, dry-run y éxito se distinguen ahí y sólo ahí. Ninguna ruta GET dice si las credenciales están puestas
(fuera de `whatsapp.ts`, nadie lee `WHATSAPP_ACCESS_TOKEN` ni `WHATSAPP_PHONE_NUMBER_ID`).

**El token, con el envío o sin él.** `albaranWhatsApp.service.ts:133` lo escribe ANTES de llamar a Meta, así que
un rechazo (o un `not_configured`) no impide que exista. Pero no hay forma de LEERLO: la respuesta es
`sendSuccessBody()` vacío o `sendFailureBody(motivo)` (sin enlace), el albarán sólo da el booleano
`enviadoParaFirma`, y `WhatsAppMessage` no guarda el cuerpo. **Con el móvil inventado, el enlace no le llega a
nadie.** Corrijo el veredicto de 1236b: su vía ① («pulsar y abrir el enlace desde el móvil que lo recibe»)
**no sirve** mientras el cliente 83 tenga ese número.

**Veredicto:** `privacidad:92` sigue **DECLARADO no medible en producción por el equipo**, ahora con el motivo
exacto: hace falta un móvil REAL que controle el fundador en el cliente 83 (y el envío), o leer la base.

🔵 **Visto y no tocado (K1, de J2):** si falla, el profesional lee «No se pudo enviar por WhatsApp. Copia el
enlace y mándaselo por SMS o llámale.» (`sendOutcome.ts:41`), y la pantalla del albarán no le enseña ningún
enlace que copiar. Lo lleva el orquestador a `para-javier.md`.

### 18-oct, ~18:10Z · el fundador lo pulsó: el WhatsApp de producción está VIVO, y la pantalla dice «enviado» de un mensaje que no llegó

El fundador pulsó «Enviar para firmar» en el #46, dos veces. **Medido por S4, sólo GET, cuenta QA**:

| fuente | lo que dice |
|---|---|
| `GET /admin/customers/83/whatsapp` | fila **451**, `template`, `albaran_para_firmar_es`, `failed`, `error:"131026: Message undeliverable"`, 17:53:05Z · fila **452**, igual, 17:53:59Z |
| `GET /admin/albaranes/46` | `estado:"emitido"`, **`enviadoParaFirma:true`** |
| respuesta del POST | `{"ok":true,"sent":true}`. **Dato del orquestador** (captura de la pestaña de red del fundador), **no medido por S4** |

**El punto 2.1 de `docs/producto/ESTADO-DEL-PRODUCTO.md` queda MEDIDO:** `131026` es un código de Meta, así que
la petición llegó a Meta y Meta contestó. Token y phone id están puestos, y la plantilla `albaran_para_firmar_es`
existe y se usó. Lo que falló es el número inventado del cliente 83. (El fichero 2.1 es de S0: aquí sólo consta
la medida.)

**🔴 El defecto: la pantalla le dice al profesional que se envió, y el cliente no recibe nada.** Medido y
declarado, **NO arreglado**:

1. **¿Podía saberlo el servidor al contestar? No.** El `error` tiene la forma `código: título`, que es la que
   escribe el WEBHOOK de estados (`whatsappIncoming.routes.ts:118-120` → `updateWaMessageStatus`,
   `whatsappLog.service.ts:277`). El camino síncrono guarda otra forma: el JSON entero de Meta
   (`whatsapp.ts:482`). Y el webhook sólo encuentra la fila por su `wamid`, así que Meta devolvió primero un
   200 con `wamid` (la fila quedó `sent`) y avisó del 131026 después. Cuando el POST contestó, el fallo no
   existía todavía.
2. **La píldora «enviado para firmar» no mira el envío.** La deriva `albaranes.routes.ts:920` de
   `enviadoParaFirmaAt`, y `albaranWhatsApp.service.ts:133` lo escribe ANTES de llamar a Meta. Leído, no
   medido: la píldora sale también cuando el envío falla en el acto (`not_configured`, baja, topes), porque el
   campo ya está escrito. La pinta `albaranDetailView.js:515`.
3. **Nadie vuelve a mirar.** Ni la ficha del albarán ni su ruta leen `WhatsAppMessage` (búsqueda en
   `albaranes.routes.ts`: 0). El estado de entrega sólo se ve en la ficha del CLIENTE
   (`customerDetailView.js:226`, historial de WhatsApp). La píldora se queda en «enviado» para siempre.
4. **Y cuesta plazas de J6:** dos pulsaciones son dos plantillas en el día de ese cliente (tope 3).

**De quién es arreglarlo: lo decide el orquestador.** La respuesta y el campo salen del servidor
(`src/modules/jobs/**` → S1). La píldora es `albaranDetailView.js` (S4). El texto que diga «no llegó» sería
K1 nuevo, con firma.

## 1236e — lo que sale de 1236d hacia el otro equipo, y la decisión sobre la píldora (S4, 18-oct)

**Medido contra:** `origin/main` = `183895cdef71c5655a3978352b716a79e1ca2b2b` · 2026-10-18T18:08:48Z

Sólo registro y `docs/equipo/para-javier.md`. No se toca código.

**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún texto.

A9: aviso → cicatriz S4 «le dije al orquestador que el ③ de SCRUM-914 «no espera a nadie» sin haber leído sus comentarios: el c.19408 ya decía que espera a J3» — no se pudo comprobar: leer los comentarios de un ticket antes de afirmar su estado es un acto de quien escribe, y ningún test lee Jira

**La decisión del orquestador sobre 1236d** (18-oct, por mensaje entre sesiones; resumida aquí, no es cita del
fundador): el `{sent:true}` era honesto. El defecto es la píldora. Va en dos mitades y sin texto nuevo:
- **S1:** que el albarán exponga el estado REAL de la última entrega.
- **S4:** que la píldora salga sólo si la última entrega no falló. Quitar una afirmación falsa no pide firma;
  añadir «no llegó, reenvíalo» sí, y el orquestador se lo pide al fundador. S4 espera a la mitad de S1.

**Por qué el defecto se paga dos veces:** un botón que dice «enviado» de algo que no llegó invita a volver a
pulsarlo, y cada pulsación es un envío de verdad. Medido en el #46: dos pulsaciones, dos plantillas (filas
451 y 452), **2 de las 3 plazas diarias de J6** de ese cliente. **Y la tercera se gastó igual:** con el móvil real
del fundador en el cliente 83, el envío de las 18:09:36Z llegó (fila 453, `delivered`), y el de las 18:09:53Z
salió con «Este cliente ya recibió varios mensajes hoy (límite anti-spam)» (fila 454, `failed`,
`customer_daily_cap`). Tres plazas del día, una sola entrega útil.

**`docs/equipo/para-javier.md`:** se amplía la §17 («⬇ Clientes CSV», 31 px, medido por S3) y se abre la
§25, con tres puntos: el PDF de 1442 (J1, releído por S4 desde la captura de S2), el webhook de Stripe (J2,
receta literal de S1, pendiente del OK del fundador) y SCRUM-914 esperando a J3 (c.19414 sin respuesta).
**El aviso «Copia el enlace…» NO va a para-javier:** `src/lib/sendOutcome.ts` es **S1**
(`carriles.mjs`, `dos-equipos.md:136`), no J2. Y el texto no es falso en todas partes: donde la pantalla
pinta `waFallbackBar` (`api.js:982`), sí hay un «📋 Copiar enlace». Es falso en la ficha del albarán, que no
lo pinta. Es nuestro, y se lo digo al orquestador.

### 18-oct, ~18:30Z · 🔴 el enlace de firma llega ROTO: `/albaran/{{1}}<token>`

**El camino completo (enviar, recibir, pulsar, firmar) no se había probado NUNCA de punta a punta.** El
registro de 1236b lo dejó dicho: el enlace «sólo existe dentro de un WhatsApp de verdad» y nadie del equipo
lo tenía. Hoy el fundador le puso su móvil real al cliente 83, el WhatsApp llegó y, al pulsar «Ver y firmar»,
el móvil abrió (URL que nos pasa el orquestador, copiada por el fundador):
`yaqu.app/albaran/%7B%7B1%7D%7D94ccccca9dcd166e5228b4394cad8ff37`. `%7B%7B1%7D%7D` es `{{1}}`: la URL lleva el
marcador LITERAL y el token detrás. La página contesta, con razón, que el enlace no corresponde a nada.

**① Qué mandamos nosotros como sufijo — MEDIDO en el código: sólo el token.** `buildAlbaranParaFirmar`
(`whatsappTemplates.ts`) llama a `urlButton(p.token)`, que envía `parameters: [{ type: 'text', text:
String(suffix) }]` (`:131-137`). El token es `crypto.randomBytes(16).toString('hex')`
(`albaranWhatsApp.service.ts:132`): 32 hex. **Y la fila 453 es `type:"template"`:** el mensaje que llegó fue
por plantilla, no por la vía «ventana», que construye la URL entera en nuestro código. La base de la URL es la
que está registrada en Meta.
- ⚠️ **Un dato que no cuadra:** detrás del `{{1}}` de esa URL hay **33** caracteres, y nuestro token tiene
  32. O la URL se copió con uno de más, o Meta mete algo más. **Hace falta la URL copiada tal cual del móvil**
  para saberlo; no la he visto yo.

**② Las otras plantillas con sufijo dinámico: el riesgo es el MISMO, y desde aquí NO se puede medir.** Las
cuatro usan el mismo `urlButton` y mandan sólo el sufijo: `quote_decision_es` (`/pay/quote/{{1}}`),
`payment_request_es` (`/pay/invoice/{{1}}`), `payment_confirmation_invoice_es` (`/recibo/{{1}}`) y
`albaran_para_firmar_es`. Lo que está registrado en Meta como base de cada botón no se ve desde el código ni
desde la base: lo tiene que mirar el fundador en WhatsApp Manager. **No lo doy por roto ni por sano.**

**Lo que puede haberlo causado — MI LECTURA, no verificada contra Meta:** nuestras dos guías dicen que la URL
base «termina en `/{{1}}`» (`docs/WHATSAPP_TEMPLATES.md:52` y `.claude/skills/yaqu-wa-templates/SKILL.md:20`).
Si el editor de Meta, al elegir URL DINÁMICA, añade él mismo el `{{1}}` del final, quien teclee la base con
`{{1}}` siguiendo nuestra guía deja un marcador de más, y el resultado es justo `…/{{1}}<token>`. Además,
la tabla de la skill tiene cinco plantillas y **no incluye `albaran_para_firmar_es`**, que es la que ha fallado.

**Qué mirar en WhatsApp Manager, plantilla por plantilla** (no se toca nada: es STOP del fundador): el botón
de URL de las cuatro debe mostrar la base SIN `{{1}}` tecleado, con un solo marcador dinámico al final.
**Prueba de punta a punta que lo confirmaría, cuando haya plazas de J6 otra vez:** mandar al cliente 83
(con el móvil real) un presupuesto y pulsar «Ver presupuesto».

⛔ **No se ha tocado nada:** ni las plantillas (STOP del fundador), ni el builder, ni las guías.

### 18-oct, ~18:50Z · la barra «Copiar enlace» en el albarán: hoy NO se puede · y dos cambios en para-javier

**¿Puede la ficha del albarán pintar `waFallbackBar` (`api.js:982`, S2 contenedor)? Hoy no. Medido:**
- **No hay enlace que darle.** `GET /admin/albaranes/46` (hoy, cuenta QA) no trae ningún campo con el token,
  y el POST tampoco lo devuelve. Presupuesto y factura sí lo tienen (`quote.payToken`, `invoice.payToken`).
- **No hay envío de albarán por email**, y la barra pinta SIEMPRE ese botón. Desactivado, el único motivo
  escrito es «Este cliente no tiene email guardado», que aquí sería falso.
- **Y no cubriría el caso de hoy:** el 131026 llega por el webhook después de un `sent:true`, y la barra sale
  con `sent:false`.

**Decisión del orquestador (18-oct):** S1 expone al comercio dueño el enlace de firma, siguiendo el precedente
de `payToken`. Eso además abre el camino de `privacidad:92`. Lo de la barra se aparca hasta ver qué queda.
**Mientras tanto, «Copia el enlace…» en la ficha del albarán es FALSO, y queda declarado aquí.**

**En `docs/equipo/para-javier.md` §25:**
- **25.2:** el webhook de Stripe pasa de «pendiente del OK» a **AUTORIZADO**, con la cita leída por S4 en el
  fichero: «si autorizo», `ed676fd1-feb4-4658-bda2-01f4bf9fb3fc.jsonl`, `uuid
  1c5a7185-addc-4245-9438-ef4f0313eb81`, `2026-10-18T18:35:52.798Z`, `type:"user"`, en respuesta a una pregunta
  hecha sola sobre ese fallo.
- **25.4 (nuevo, J1):** «📋 Copiar enlace» copia `location.origin` (la portada) cuando la factura no trae
  `payToken` (`invoiceDetailView.js:405` y `:421`). El gemelo es nuestro: `jobDetailView.js:1475`, S2
  (`dos-equipos.md:152`). Lo reparte el orquestador.



## 1236f — `privacidad:92`, la página pública de firma del #46 EMITIDO, vista (S4, 19-oct)

**Medido contra:** `origin/main` = `cd85e34b1e5bfaf561f010f550296bd94b659e75` (prod servía ese mismo SHA, `/version`)
· hora de GitHub al escribir: 2026-10-19T06:40:20Z
A9: sin fallo que generalice — es una medida, no un arreglo

**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún texto: sólo se miran páginas servidas, con GET.

Con SCRUM-49c en main, `GET /admin/albaranes/46` trae `firmaToken`, y la página pública se alcanza sin enviar
nada. Sonda: `evidencias/SCRUM-1236/1236f/sonda.mjs`; salida: `1236f/medida-19oct.json`. **Todo lo que no es GET
se aborta y se cuenta** (sólo cayó `POST /admin/entorno`, del panel). El token no se imprime ni se guarda.

**Qué se buscó.** La sonda abre `/albaran/<token>` sin cookie, con un navegador de marca propia
(`SondaS4-49d-NAVEGADOR-MARCA`) y con la IP que Cloudflare le ve (`/cdn-cgi/trace`), y busca las dos en el HTML y en
el texto, más cualquier IPv4. **Control positivo:** la misma búsqueda sobre un texto que lleva las dos las caza
(`ipPropia: true`, `marcaNavegador: true`).

| superficie | estado | IP propia | navegador | IPv4 | veredicto |
|---|---|---|---|---|---|
| `/albaran/<token>` del #46 | `emitido`, 200, «Firmar parte de trabajo» | no | no | ninguna | **no expone** |

La única aparición de « IP » es el aviso que DICE que se registra («fecha, hora, IP y navegador de esta firma»,
`albaranPublic.routes.ts:136`): informa, no expone.

**Veredicto:** `privacidad:92` queda **VISTO en la página emitida**. La rama `firmado` de esa misma página sigue
**leída, no vista**: pinta sólo la cabecera del negocio y «Gracias, <nombre>» (`albaranPublic.routes.ts:258-263`),
sin leer `evidenciaFirma`.

**Por qué no se ha visto la rama `firmado`:** el plan de 1236b era firmar el #46 en obra desde el panel (R25) y
volver a pedir el mismo enlace. **R25 lo excluye hoy:** el perfil fiscal de la cuenta QA está vacío
(`GET /admin/merchant`: `legalName` y `taxId` a `null`), y firmar así está fuera de R25. Rellenarlo con
`sembrar-casos.mjs perfil-fiscal` haría que el #47, ya firmado, dejara de verificar (lo avisa el propio script). Esa
decisión no es de S4. Y además hay que esperar a ver SCRUM-49d en yaqu.app ANTES: es el único albarán con la
entrega en `fallido`, y firmado deja de servir para esa medida.

Releído sobre `cd85e34b`: `POST /admin/albaranes/:id/firmar` (`albaranes.routes.ts:1035-1126`) no llama a ningún
envío; guarda la IP y el navegador de quien firma en `evidenciaFirma`. Si se firma con la sonda, su marca y su IP
quedan dentro, y la medida de la rama `firmado` buscaría exactamente eso.