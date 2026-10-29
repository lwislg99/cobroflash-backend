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
