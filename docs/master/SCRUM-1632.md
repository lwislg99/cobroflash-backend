# SCRUM-1632 · el enlace de firma que el cliente recibe por WhatsApp llega roto

## 29-oct-2026 · S4 · qué debe llevar el botón de las cuatro plantillas con enlace (sólo medir; no se ha tocado código ni plantilla)

**Medido contra:** `origin/main` = `5deff8b3b7b0f8a8d3cd037baabbca454ea7aa29` · 2026-10-29T09:54:39Z
(producción = el mismo commit, `GET https://yaqu.app/version` a las ~09:43Z).

A9: sin fallo que generalice — sólo medir; la lección candidata (nuestras guías mandan teclear el `{{1}}` en la base) está SIN confirmar contra Meta, y si se confirma va a su propio ticket con su guard

Encargo del orquestador del equipo de Luis: filas **2.9** y **2.10** de `docs/producto/ESTADO-DEL-PRODUCTO.md`.

⛔ **Ninguna sesión ve el panel de Meta, tampoco ésta.** Lo que hay puesto hoy en WhatsApp Manager
**no lo he visto**. Todo lo de abajo sale de nuestra especificación y del código, y es la instrucción
para que el fundador mire y, si lo decide, pegue. **Tocar una plantilla es STOP del fundador** (AA1.4).
Aquí no se propone ninguna plantilla, texto ni destinatario nuevo (regla 28): se dice qué dirección debe
llevar el botón de las que ya existen, según nuestra propia especificación.

### La tabla — lo que hay que mirar en WhatsApp Manager

Las cuatro mandan **sólo el sufijo** en el botón de índice 0: `urlButton(token)` → `parameters: [{ type:
'text', text: token }]` (`src/integrations/whatsappTemplates.ts:131-137`). El token es siempre
`crypto.randomBytes(16).toString('hex')`: **32 caracteres hexadecimales**.

| plantilla | lo que mandamos (sufijo) | lo que el botón debe ABRIR | lo que se pone en WhatsApp Manager (botón «Visitar sitio web») |
|---|---|---|---|
| `albaran_para_firmar_es` · «Ver y firmar» | `Albaran.firmaToken` (`albaranWhatsApp.service.ts:132,140`) | `https://yaqu.app/albaran/<token>` | Tipo de URL **Dinámica** · campo URL: **`https://yaqu.app/albaran/`** · muestra: `https://yaqu.app/albaran/0123456789abcdef0123456789abcdef` |
| `quote_decision_es` · «Ver presupuesto» | `Quote.decisionToken` (`sendQuote.service.ts:95`, `reminder.service.ts:82`) | `https://yaqu.app/pay/quote/<token>` | Tipo de URL **Dinámica** · campo URL: **`https://yaqu.app/pay/quote/`** · muestra: `https://yaqu.app/pay/quote/0123456789abcdef0123456789abcdef` |
| `payment_request_es` · «Pagar ahora» | `Charge.receiptToken` (`invoiceWhatsApp.service.ts:134`, `invoiceReminder.service.ts:208`, `invoicesAdmin.routes.ts:753`) | `https://yaqu.app/pay/invoice/<token>` | Tipo de URL **Dinámica** · campo URL: **`https://yaqu.app/pay/invoice/`** · muestra: `https://yaqu.app/pay/invoice/0123456789abcdef0123456789abcdef` |
| `payment_confirmation_invoice_es` · «Ver documento» | `Charge.receiptToken` (`whatsappNotifications.ts:93`) | `https://yaqu.app/recibo/<token>` | Tipo de URL **Dinámica** · campo URL: **`https://yaqu.app/recibo/`** · muestra: `https://yaqu.app/recibo/0123456789abcdef0123456789abcdef` |

**Lo que debe verse al terminar, en las cuatro:** un solo `{{1}}`, al final, y nada escrito a mano
detrás de la última barra. **Si en el campo de la URL hay un `{{1}}` tecleado, ése es el que sobra.**
`…/albaran/{{1}}{{1}}`, o un `{{1}}` en el texto MÁS el marcador que pone Meta, es el defecto.

Las cuatro rutas existen y son públicas por token (`src/core/http/publicAccessDeclarations.ts:140,144,149,166`).
Las direcciones salen de `docs/WHATSAPP_TEMPLATES.md` §1, §2, §4 y §8 y de
`docs/SPEC_SCRUM47_ALBARAN_FIRMADO_WA.md:63`.

### Por qué la columna dice la base SIN `{{1}}` — MI LECTURA, no verificada contra Meta

- **El defecto que se vio** (`docs/master/SCRUM-1236.md:220-237`, 18-oct): `yaqu.app/albaran/%7B%7B1%7D%7D<token>`.
  El token llegó detrás: el botón ES dinámico (una URL estática no lleva sufijo). Lo que sobra es un
  `{{1}}` LITERAL en la base.
- **Cómo puede haber entrado:** nuestras guías mandan teclear la base CON el marcador:
  `docs/WHATSAPP_TEMPLATES.md:52` («la URL base termina en `/{{1}}`»), `.claude/skills/yaqu-wa-templates/SKILL.md:20`
  y, para esta plantilla, `docs/SPEC_SCRUM47_ALBARAN_FIRMADO_WA.md:63` y `:137`, que dice que el
  fundador la dio de alta el 14-jul con `https://yaqu.app/albaran/{{1}}`. Si el editor de WhatsApp
  Manager, con la URL en «Dinámica», añade él el `{{1}}`, quien siga nuestra guía deja uno de más, y el
  resultado es exactamente `…/{{1}}<token>`.
- **Lo que dice de ese editor una fuente externa — de TERCEROS, no de Meta:** la guía de Jotform
  (jotform.com/help/creating-and-managing-whatsapp-business-message-template/) dice que en ese campo
  se escribe la URL base y que «Meta automatically appends the template variable». No he encontrado la
  frase en la documentación de Meta. **Por eso es lectura, no medida.**
- ⚠️ **Por qué no basta con mirar el panel:** ya pasó una vez. En julio, P3-1 (`docs/BUGS.md:1172-1182`)
  vio `/pay/quote/{{1}}23` y `/pay/invoice/{{1}}0`, y `docs/ERRORES_ASESOR.md:150-155` registra que, al
  abrir el panel, «la plantilla ya estaba en modo dinámico y correcta». Si el panel enseña
  `…/pay/invoice/{{1}}` y nuestra guía dice que la base termina en `/{{1}}`, **lo que se ve parece
  correcto aunque sea el defecto**. La comprobación que vale es la de abajo: pulsar el botón.

### Hallazgo: tres de las cuatro rutas NO toleran el `{{1}}`, y la cuarta sí — por eso no se notaba

| ruta | cómo lee el token | con `{{1}}<token>` |
|---|---|---|
| `/pay/quote/:token` | `parseToken(req.params.token)` (`quoteDecisionLanding.routes.ts:646,900,969,1057`; `quotes.routes.ts:357`), que quita `{{…}}` (`src/core/utils/utils.ts:288-293`) | **abre bien** |
| `/pay/invoice/:token` | `req.params.token` en crudo (`payInvoice.routes.ts:23`) | no encuentra nada |
| `/recibo/:token` | en crudo (`receipt.routes.ts:31,502,535`) | no encuentra nada |
| `/albaran/:token` | en crudo (`albaranPublic.routes.ts:238,251,381`) | **404** «Documento no disponible» |

Consecuencia: **si `quote_decision_es` tiene el mismo `{{1}}` de más, el cliente no lo nota**, porque la
página del presupuesto lo limpia (es el apaño de P3-1, que pasó de `parseNumericId` a `parseToken` en
SCRUM-95). Así que el presupuesto puede estar mal en Meta y funcionar. Los otros tres, no.

**No lo he tocado:** las tres rutas y `utils.ts` son de **S1** (`node scripts/carriles.mjs de` →
`dos-equipos.md:136`); `whatsappTemplates.ts` es de **J2** (`dos-equipos.md:124`). Y `/pay/invoice` y
`/recibo` son camino de cobro. Si se quiere que el enlace funcione con Meta como esté, ése es el arreglo de
nuestro lado, con su precedente; lo decide quien reparte.

### Lo que medí hoy, y lo que NO dice

`GET https://yaqu.app/albaran/<x>` es de sólo lectura (`albaranPublic.routes.ts:249-267`: busca y pinta, no
escribe). A las ~09:43Z, con el token copiado el 18-oct (`SCRUM-1236.md:226`):

| variante | estado |
|---|---|
| control, token inventado de 32 hex | 404 |
| el copiado, tal cual (33 caracteres) | 404 |
| sus primeros 32 | 404 |
| sus últimos 32 | 404 |
| con `%7B%7B1%7D%7D` delante | 404 |

**No prueba nada sobre la plantilla:** el control también da 404. Sólo dice que ese token ya no existe
hoy en ninguna de sus formas (y que, publicado en un repo público, no abre nada). La rareza del 18-oct
sigue sin explicar: detrás del `{{1}}` había **33** caracteres y nuestro token tiene **32**.

### Lo que NO se ha podido comprobar, y por qué

1. **Qué hay puesto en Meta en ninguna de las cuatro.** Sólo lo ve el fundador.
2. **Que el editor de Meta añada él el `{{1}}`.** Fuente de terceros, no de Meta (arriba).
3. **De punta a punta.** Hace falta mandar un WhatsApp real y pulsarlo. El 18-oct el clasificador denegó a
   una sesión S4 el envío del albarán («Real-World Transactions», `docs/master/SCRUM-1236.md`); hoy no lo
   he intentado: mandar un WhatsApp real a un cliente no entra en el encargo.
4. **Si lo que llega a `/pay/invoice` y `/recibo` está roto hoy.** Nadie lo ha pulsado desde julio.

**La comprobación que lo cierra, sin tocar Meta primero:** el fundador manda desde la cuenta QA
un «Enviar para firmar» a su propio móvil y, en el móvil, mantiene pulsado «Ver y firmar» → «Copiar
enlace». Si contiene `%7B%7B1%7D%7D`, la base tiene el `{{1}}` de más. Lo mismo con un presupuesto: ahí
la página abre igual, así que **lo que hay que mirar es la URL copiada, no si la página abre**.

### Qué no se ha tocado

Ni las plantillas (STOP del fundador), ni el código, ni las guías (`WHATSAPP_TEMPLATES.md:52`,
`SKILL.md:20`). Si se confirma la lectura, la línea de las guías que dice «la URL base termina en `/{{1}}`»
es la que lo provocó, y corregirla va en su propio ticket.

## 29-oct-2026 · S4 · 1632b: nuestras guías, corregidas (el campo URL va SIN `{{1}}`)

**Medido contra:** `origin/main` = `5deff8b3b7b0f8a8d3cd037baabbca454ea7aa29` (hora de GitHub al empezar: 2026-10-29T10:13:22Z).
Rama `scrum-1632b-guias-campo-url-sin-llaves`. Encargo del orquestador del equipo de Luis (tarea 1), sobre la tabla de c.21201.

A9: comprobación → `tests/scrum1632b-campo-url-sin-llaves.test.mjs`

⛔ **No he visto el panel de Meta y no afirmo nada de lo que hay puesto.** No se ha tocado ninguna plantilla, ni código de `src/`.

### Qué instruían, hasta hoy, nuestras tres fuentes

| fuente | qué decía del campo URL | ¿contradice la tabla de c.21201? |
|---|---|---|
| `docs/WHATSAPP_TEMPLATES.md:52` | «la URL base termina en `/{{1}}`» (+ §1:132, §2:166, §4:242 con `…/{{1}}`; §8:322 `/albaran/{{token}}`, otra notación) | **sí** |
| `.claude/skills/yaqu-wa-templates/SKILL.md:20,30,31,33` | lo mismo: «la URL base termina en `/{{1}}`» y la tabla con `/pay/quote/{{1}}`, `/pay/invoice/{{1}}`, `/recibo/{{1}}` | **sí** |
| `docs/SPEC_SCRUM47_ALBARAN_FIRMADO_WA.md:63,137` | `https://yaqu.app/albaran/{{1}}`; :137 deja constancia de que así se dio de alta el 14-jul | **sí** |

**Entre ellas no se contradicen:** las tres dicen lo mismo, y las tres contradicen la tabla de c.21201. Y hay **otras tres** que el encargo no nombraba y dicen igual: `docs/BUGS.md:1174` (el «arreglo de raíz» de P3-1 vuelve a escribir la base con `{{1}}`), `docs/PENDIENTES_FUNDADOR.md:92,227` (la lista que el fundador sigue al recrear las plantillas).

**Por qué decían eso, y no es un capricho:** es lo que pide la **API** de Meta. La página de componentes de plantilla de Meta (developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components, leída hoy) dice del `url`: «Supports 1 variable, appended to the end of the URL string», ejemplo `https://www.luckyshrub.com/shop?promo={{1}}`. Pero **no creamos plantillas por API**: `git grep message_templates -- src scripts docs .claude` = 0. Se dan de alta en el **editor**, y del editor sólo hay fuentes de terceros (Jotform, Qiscus, Clickatell…, búsqueda de hoy) que dicen que añade el `{{1}}` solo. **Ninguna de Meta.** Nuestras guías describían la API y se usaban en el editor.

### Qué he cambiado (sólo documentación + un guard)

- `docs/WHATSAPP_TEMPLATES.md` «Reglas comunes»: la regla nueva (campo SIN `{{1}}`, «un solo `{{1}}`, al final»), la tabla de las cuatro (la de c.21201), el **porqué** con P3-1 (`BUGS.md:1172`) de precedente, **la prueba que vale escrita** (copiar el enlace del botón en el móvil y buscar `%7B%7B1%7D%7D`; abrir el panel NO vale) y la pregunta que sólo Meta resuelve. §1, §2, §4 y §8 apuntan a la regla.
- `docs/SPEC_SCRUM47_ALBARAN_FIRMADO_WA.md:63` corregida; `:137` NO reescrita (es constancia de lo que se hizo el 14-jul): lleva una nota debajo.
- `docs/BUGS.md` P3-1, `docs/PENDIENTES_FUNDADOR.md:92,227` y `docs/ERRORES_ASESOR.md` #3: notas fechadas, sin borrar nada. La de #3 importa: **la lección de julio puede ser la contraria** (el enlace del móvil era la prueba buena; el panel se juzgó contra nuestra regla, que pedía el `{{1}}`).
- `parseToken` en el camino de la firma: escrito como **«pendiente de decisión»** (c.21202), no como hecho.
- **Guard** `tests/scrum1632b-campo-url-sin-llaves.test.mjs`: la spec canónica no puede volver a enseñar un campo con `{{1}}`/`{{token}}` (fuera de las citas `>`), y tiene que llevar las cuatro filas, la regla y la prueba del móvil. **Visto en rojo** contra `origin/main:docs/WHATSAPP_TEMPLATES.md`: acusa :52, :132, :166, :242 y :322 y falla la tabla. La primera versión del detector no veía :322 (sin dominio); la mutación lo destapó y se amplió.

### Lo que NO he cambiado, y por qué

- 🔴 **`.claude/skills/yaqu-wa-templates/SKILL.md` sigue diciendo «termina en `/{{1}}`».** `.claude/**` es «de un jefe» (`docs/equipo/dos-equipos.md:204`; `carriles.mjs de` lo confirma). No lo he tocado. Hasta que se firme, la skill contradice la spec, aunque la propia skill manda leer la spec («el detalle EXACTO está en `docs/WHATSAPP_TEMPLATES.md`»). **El texto propuesto** para que lo firme un jefe:
  - `:20` → `- **Botón URL dinámica:** en WhatsApp Manager, «Tipo de URL: Dinámico» y el campo SIN `{{1}}` (base acabada en `/`, p. ej. `https://yaqu.app/albaran/`). Al terminar, UN SOLO `{{1}}`, al final. La prueba es copiar el enlace del botón en el móvil (sin `%7B%7B1%7D%7D`), no mirar el panel. Motivo: `docs/WHATSAPP_TEMPLATES.md`, «Reglas comunes». El código envía SOLO el sufijo (el token).`
  - `:30,31,33` → `→ campo `https://yaqu.app/pay/quote/`` / `…/pay/invoice/` / `…/recibo/` (abre `/<ruta>/<token>`), y añadir la fila de `albaran_para_firmar_es` → campo `https://yaqu.app/albaran/`.
- `docs/YAQU_MASTER.md:302` (`→ /recibo/{{1}}`) y los comentarios de `src/integrations/whatsappTemplates.ts` describen la URL que se abre, no cómo se rellena el campo: no instruyen. No los he tocado (master bloqueado; `src/` no es mío).

### ❓ La pregunta que sólo Meta resuelve

¿El editor de WhatsApp Manager añade él el `{{1}}` al elegir «Dinámico»? La regla «un solo `{{1}}`, al final» vale en los dos casos. **La prueba del móvil dice cuál es el nuestro.** Hasta que alguien la haga, la causa es lectura.

## 29-oct-2026 · S1 · 1632c: la página de firma limpia el token con `parseToken` (arreglo (b))

**Medido contra:** `origin/main` = `eafca9fe154c26d38b05a748ca816ba098943724` (hora de GitHub: 2026-10-29T17:42:45Z).
Rama `scrum-1632c-firma-tolera-la-url-sucia`. GO del orquestador por delegación del fundador: c.21220 («1 nos e decide tu»).

A9: comprobación → `tests/scrum1632c-firma-tolera-la-url-sucia.test.mjs`

### Qué cambia (`src/modules/jobs/app/routes/albaranPublic.routes.ts`)

| línea | antes | después |
|---|---|---|
| import (:10) | `{ esc }` | `{ esc, parseToken }` — necesario para las otras tres; no mueve ni extrae nada |
| `:251` (GET) | `loadContext(req.params.token)` | `loadContext(parseToken(req.params.token))` — **autorizado** |
| `:381` (POST) | `firmaToken: req.params.token` | `firmaToken: parseToken(req.params.token)` — **autorizado** |
| `:328` (la ruta del POST que la página pinta en su `<script>`) | `` `/albaran/${req.params.token}/firmar` `` | `` `/albaran/${parseToken(req.params.token)}/firmar` `` — 🔴 **FUERA de lo autorizado: pedido aparte al orquestador** |

**Por qué `:328`, medido y no leído:** con SÓLO los dos sitios autorizados, la página abre con cualquier
URL cuya parte hex sea el token, y `:328` mete la URL cruda en el `<script>` con `JSON.stringify`, que no
escapa `<`. El caso ④ del test lo demuestra: una URL que limpia da el token del parte llevaba
`</script>` + un script nuevo DENTRO de la página. Antes del cambio no pasaba porque la página sólo se
pintaba si la URL ERA el token exacto. No hay CSP en `src/` (`git grep -i content-security-policy` = 0).
Con `:328` limpia, lo que se pinta es siempre hex.

### Las mayúsculas (el control que mandaba)

`parseToken` pasa a minúscula. **Escritores de `firmaToken` en toda la historia de `main`**
(`git log -G firmaToken -p -- src scripts prisma`, líneas añadidas): UNO, `albaranWhatsApp.service.ts:132-133`,
`albaran.firmaToken || crypto.randomBytes(16).toString('hex')`. El SQL crudo (`firma_token`) sólo aparece en
el ALTER de SCRUM-49, que crea la columna a NULL. `randomBytes(n).toString('hex')`: 200.000 muestras, 0 con
mayúscula (control: `/[A-F]/` casa con `'ABC'`). ⚠️ **La base de PRODUCCIÓN no la he leído** (ninguna sesión
tiene su clave): lo que digo es que ningún camino del código, hoy ni antes, pudo escribir una mayúscula.

### Tests

- Rojo antes del cambio: 8 casos, 3 caen (① GET, ① POST, ④); ② y ③ pasan.
- Con sólo los dos sitios autorizados: 7/8, cae ④ (arriba).
- Con `:328`: 8/8. Vecinos (los 18 ficheros que nombran `albaranPublic`): 130 tests, 0 fallos, 1 saltado.
  Y 100 ficheros más que barren `parseToken`/`params.token`/rutas de `jobs`: 844, 2 fallos de
  `scrum1266b` (dictado del panel), que solo da 15/15: carga, ajeno al diff.

### Lo que NO se ha podido probar

- **De punta a punta con WhatsApp real:** no lo he intentado. Mandar un «Enviar para firmar» y abrir el botón
  en un móvil es lo único que lo ve entero; ninguna sesión tiene un móvil con WhatsApp. El test pide las
  dos rutas de verdad (`dist`) con la base doblada.
- **La base de producción** (las mayúsculas, arriba).
- **Lo que hay en Meta:** sigue como esté (fila 2.10, STOP del fundador). Con esto la FIRMA abre igual.

### De paso

- `docs/WHATSAPP_TEMPLATES.md:88-91` decía «pendiente de decisión, no hecho»: actualizado. `/pay/invoice` y
  `/recibo` siguen pasando el token en crudo (`payInvoice.routes.ts:23`, `receipt.routes.ts:31`, carril J2): no tocados.
### El rojo del PR #2998 y su arreglo (29-oct, ~18:40Z, S1 relevo)

«build + tests» cayó con 2 de 12.982 (job 123632236082), los dos del propio PR. Decisión del orquestador
en el encargo del relevo.

- **`tests/scrum68-evidencias-firma.test.mjs:158` — fixture cambiado, DECLARADO.** Había
  `'tok68-' + randomBytes(16).toString('hex')`; `parseToken` quita lo que no es hex, la ruta buscaba
  `68…` y «firmar remoto» daba 404. Pongo `randomBytes(16).toString('hex')` a secas. La forma vieja era
  **imposible en producción**: el único escritor de `firmaToken` (`albaranWhatsApp.service.ts:132`) hace
  hex puro (arriba, «Las mayúsculas»). **Ninguna aserción tocada**: el test sigue afirmando lo mismo
  sobre el sellado (canal, `tokenId` = token usado, ip, ua, sha256, firmante declarado, privacidad).
  Ese test va gateado por base (`QA_DB_TEST`/`LIBRO_PG_URL`): en local sale SKIP; lo juzga el CI.
- **`tests/scrum1632c-firma-tolera-la-url-sucia.test.mjs` ③ — nombres literales** (lo pide `scrum1415`):
  el bucle con nombre en plantilla pasa a cuatro `test()` con su nombre escrito y una función común.
  Mismos cuatro casos, mismas aserciones.
- Local: `scrum1632c` + `scrum1415` + `scrum68` → 19 tests, 18 pass, 0 fail, 1 SKIP (el de base).