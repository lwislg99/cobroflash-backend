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
| salió de verdad | 200 `{sent:true}` | fila `sent` con un `wamid` de Meta |

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
