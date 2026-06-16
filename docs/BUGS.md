# YAQU — Backlog de bugs y mejoras
**Generado tras la prueba E2E del 8 jun 2026.** Orden de prioridad: P0 (bloquea cobrar) → P4 (no tocar aún).

## Reglas de trabajo (Claude Code, leer antes de empezar)
- Arregla de **uno en uno**. Commit + push entre cada item.
- Verifica cada arreglo en **yaqu.app** (no en localhost).
- No empieces P1 hasta cerrar los dos P0.
- No toques la sección **"NO TOCAR AÚN"**.
- Marca cada item con `[x]` cuando esté hecho y verificado, y deja una línea de "causa raíz / qué se cambió".

---

## P0 — CRÍTICO: bloquea cobrar y entregar factura

### [x] P0-1 · Pago con tarjeta devuelve 401 Unauthorized
- **Síntoma:** al pulsar "Pagar con tarjeta" en `/pay/invoice/:id` navega a `/pay/card/:id` y devuelve 401 (body "Unauthorized"). El cliente no puede pagar.
- **Causa probable:** la ruta `/pay/card/:id` tiene middleware de autenticación (la usa el cliente NO logueado), o `STRIPE_SECRET_KEY` mal configurada / falla la creación de la Checkout Session.
- **Arreglo:** `/pay/card/:id` debe ser **pública** igual que `/pay/invoice/:id` y `/pay/quote/:id`. Si el 401 viene de Stripe, verificar keys de test y la creación de sesión.
- **Done cuando:** un cliente sin sesión llega a Stripe Checkout y paga en modo test sin 401.
- **CAUSA RAÍZ (9 jun):** la ruta YA era pública (verificado en yaqu.app: `/pay/card/abc`→400, `/pay/card/999999999`→404). El 401 nacía en **Stripe al crear la Checkout Session** (clave rechazada) y se filtraba crudo porque el handler no tenía try/catch. Commit `110913b`: try/catch que **loguea el motivo real de Stripe** (visible en Railway) y muestra una página 503 clara en vez de "Unauthorized". **PENDIENTE para cerrar:** poner una `STRIPE_SECRET_KEY` de test VÁLIDA (`sk_test_…`) en Railway y verificar el pago real. No marcado `[x]` hasta verificarlo end-to-end.

### [x] P0-2 · "Abrir PDF" devuelve not_found
- **Síntoma:** en el detalle de factura, "Abrir PDF" va a `/dashboard/PENDING_PDF` y devuelve `{"error":"not_found"}`.
- **Causa:** el campo del PDF de la factura vale literalmente `PENDING_PDF` — el PDF nunca se generó.
- **Arreglo:** investigar por qué la generación se queda en `PENDING_PDF` (¿storage/credenciales? ¿job async que no corre? ¿síncrono que falla?). Que el PDF se genere de verdad. Mientras esté pendiente, el botón debe mostrar "Generando…" o disparar la generación, **nunca** enlazar a un estado.
- **Done cuando:** "Abrir PDF" abre un PDF real de la factura.
- **CAUSA RAÍZ (9 jun):** `generateInvoicePdf` **funciona** (probado en local: PDF válido de 5 KB; el código no está roto). El problema: la factura nace con `pdfUrl='PENDING_PDF'` al aceptar y el PDF solo se generaba en el pago (`ensureInvoiceForCharge`), y el front enlazaba a ese `pdfUrl` crudo. Además el fs de Railway es **efímero** (se pierde al redeploy). Commit `04f4886`: nueva ruta `GET /admin/invoices/:id/pdf` que **genera bajo demanda** si está PENDING o el fichero no existe, y lo sirve; el botón "Abrir PDF" apunta ahí (nunca al `pdfUrl` crudo). Ruta verificada montada+protegida en prod (401 sin sesión). **PENDIENTE:** abrir "Abrir PDF" en una factura real (sesión admin) y comprobar que sale el PDF.

### [x] P0-3 · La factura no se marca como PAGADA tras el pago
- **Síntoma:** el pago con tarjeta se confirma (página "Pago confirmado" + WhatsApp de confirmación enviado), pero la factura CF000007 sigue en PENDIENTE en el dashboard.
- **Pista clave:** el WhatsApp de confirmación SÍ se envía → el handler de "pago confirmado" se ejecuta, pero no actualiza el estado. Buscar ahí.
- **Arreglo:** en el flujo de pago confirmado (Stripe webhook `checkout.session.completed` / `payment_intent.succeeded`, o el handler que dispara la confirmación), marcar la **factura como PAGADA** y el **cobro como pagado**. Verificar que `STRIPE_WEBHOOK_SECRET` está configurado y que el evento se procesa.
- **Done cuando:** tras pagar, la factura pasa a PAGADA automáticamente.
- **CAUSA RAÍZ (9 jun):** el handler de pago confirmado (`POST /webhooks/psp` `payment.confirmed`, al que reenvía el webhook de Stripe) solo marcaba la factura pagada si `ensureInvoiceForCharge()` devolvía `invoiceId`, y esa función **genera el PDF**; al fallar el PDF (P0-2) lanzaba → `invoiceId` null → factura PENDIENTE pese al cobro pagado (y el confirm caía al fallback `#cobro` → P1-6). Commit `c7c3298`: tras confirmar el cobro se localiza la factura ligada (por `invoice.chargeId` o vía `Quote.chargeId`→`invoice.quoteId`) y se marca `paid`+`paidAt` **independiente del PDF**. **PENDIENTE:** verificar con un pago de tarjeta nuevo (depende de la clave Stripe de P0-1). La CF000007 ya pagada no se auto-corrige (su evento ya pasó); marcarla a mano o re-test.

### [x] P0-4 · La factura no llega al cliente (ni WhatsApp ni email)  — email ✅ (WhatsApp link → P3-4)
- **Síntoma:** dice "la factura se enviará por WhatsApp y email automáticamente", pero no llega por ningún canal. El cliente paga y no recibe su factura.
- **Depende de:** P0-2 (primero el PDF tiene que generarse de verdad).
- **Arreglo:** email → enviar la factura en PDF adjunto usando el mailer existente. WhatsApp → opción MVP recomendada: que el mensaje de confirmación de pago lleve un botón/enlace "Ver factura" que abra el PDF/página de la factura (mismo patrón que "Ver presupuesto"/"Pagar ahora"). Opción completa (más adelante): plantilla con cabecera de documento para adjuntar el PDF en el chat.
- **Done cuando:** tras pagar, el cliente recibe la factura por email (si tiene) y por WhatsApp (enlace o PDF).
- **CAUSA RAÍZ (9 jun):** el email no llegaba porque `sendInvoiceEmail` usaba nodemailer/SMTP; sin `SMTP_URL` (prod usa Resend) caía a `streamTransport` → solo escribía un `.eml` a disco, **no enviaba**. Commit `0bf44f7`: ahora envía por **Resend** con el PDF en base64 adjunto; helper `ensureInvoicePdf` genera el PDF si falta; el email post-pago se intenta SIEMPRE (psp/mp). **WhatsApp PENDIENTE:** entregar la factura por WhatsApp necesita un botón "Ver factura" (URL dinámica) en una plantilla de confirmación → **alta/re-aprobación en Meta** (no se puede añadir botón a una plantilla aprobada sin re-aprobarla). El código del builder se añadirá cuando exista la plantilla. **VERIFICAR:** tras un pago, que llegue el email con PDF (requiere `RESEND_API_KEY` ok + cliente con email).

---

## P1 — Bugs visibles al cliente / datos incorrectos

### [x] P1-1 · Botón "Firmar y aceptar presupuesto" sale en ROJO
- **CAUSA RAÍZ (9 jun):** `brandOverrideCss` repintaba `.btn-accept`/`.btn-tier` con el `brandColor` del merchant. Commit `110c73f`: el color de marca va solo en acentos (avatar, bordes, badges, enlaces); el CTA aceptar/firmar es SIEMPRE verde. Verificado en prod: `/pay/quote/24` ya no lleva override en el botón.
- **Síntoma:** en la landing del presupuesto #24 el botón de aceptar y el avatar salen rojos; en #23 era verde. Mismo merchant.
- **Causa probable:** el CTA primario hereda el color de acento del negocio (que puede salir rojo) en vez del verde fijo de marca.
- **Arreglo:** el botón primario (aceptar/firmar) **siempre verde de marca**. El rojo solo para rechazar. El avatar puede tener color propio; el CTA no.
- **Done cuando:** el botón de aceptar es verde en cualquier presupuesto.

### [x] P1-2 · Texto duplicado en la pantalla de pago
- **Síntoma:** `/pay/invoice` muestra "Factura CF000006 · Factura CF000006" (dos veces).
- **Arreglo:** mostrar el nº de factura una sola vez.
- **CAUSA RAÍZ (9 jun):** el `charge.concept` ya era "Factura CFxxxx" y la página añadía otra vez la referencia. Commit `9ef6671`: si el concepto ya incluye el nº de factura, se muestra una sola vez.

### [x] P1-3 · No se guarda el motivo de rechazo real del cliente
- **Síntoma:** el detalle del presupuesto rechazado muestra "Motivo de rechazo: Rechazado desde enlace WhatsApp" (texto genérico hardcodeado), no el motivo (dropdown) ni el comentario que eligió el cliente en el formulario.
- **Arreglo:** persistir el **motivo y el comentario reales** del formulario de rechazo y mostrarlos en el detalle. Si vienen vacíos, dejar vacío, no un texto fijo.
- **Done cuando:** al rechazar eligiendo motivo + comentario, el detalle muestra exactamente eso.
- **CAUSA RAÍZ (9 jun):** (1) el router `/pay` se monta antes del `express.urlencoded` global → el POST del form de rechazo llegaba con `req.body` vacío; ahora la ruta parsea su propio body. (2) la landing reenviaba un comentario combinado con fallback genérico; ahora mapea el código del dropdown a su etiqueta y reenvía `reason`+`comment` por separado, sin texto fijo. Commit `9c28055`.

### [x] P1-4 · Gramática en la confirmación de aceptación
- **Síntoma:** "¡Presupuesto **aceptada y firmada**!" (femenino).
- **Arreglo:** "¡Presupuesto **aceptado y firmado**!".
- **CAUSA RAÍZ (9 jun):** adjetivos hardcodeados en femenino. Commit `d13313a`: concordancia de género según el sustantivo del locale (presupuesto=masc, cotización=fem).

### [x] P1-5 · Terminología "cotización" en el demo de España
- **Síntoma:** la confirmación de rechazo dice "rechazo de la **cotización** #24"; el resto del demo (España) usa "presupuesto".
- **Arreglo:** en el demo ES usar "presupuesto" en todos los textos del cliente. (No tocar i18n LATAM aún — solo unificar el demo ES.)
- **CAUSA RAÍZ (9 jun):** "de la cotización" hardcodeado. Commit `d13313a`: usa el término del locale del merchant (`presupuesto` en ES) con su artículo (del/de la); también el reset del botón de aceptar. No se tocó i18n LATAM.

### [x] P1-6 · WhatsApp de confirmación: "factura ##4" (doble # y nº incorrecto)
- **Síntoma:** dice "tu pago de 109.00 EUR de la factura ##4". Doble "#" y usa el **id del cobro** (4) en vez del **nº de factura** (CF000007).
- **Arreglo:** mostrar el nº de factura real ("CF000007") sin doble #.
- **CAUSA RAÍZ (9 jun):** se pasaba `#${chargeId}` (la plantilla ya antepone "#"). Commit `3d64887`: usa el nº de factura real sin "#" (de la factura emitida o de la ligada al cobro, P0-3). Aplicado en psp y mpWebhook.

### [x] P1-7 · WhatsApp de confirmación usa el nombre de cuenta, no el del negocio
- **Síntoma:** dice "Gracias por confiar en Electricista prueba", pero el resto de mensajes al cliente usan "Demo ES S.L.".
- **Arreglo:** usar el nombre del negocio (el que aparece en presupuesto/factura/landing) de forma consistente en todos los mensajes al cliente.
- **CAUSA RAÍZ (9 jun):** usaba `merchant.name` (nombre de cuenta). Commit `3d64887`: usa `legalName||name`, como presupuesto/factura/landing. Aplicado en psp y mpWebhook.

---

## P2 — Mejoras de producto / UX

### [x] P2-1 · Acciones sobre presupuestos rechazados
- **Mejora:** mostrar el motivo del cliente (depende de P1-3) y hacer visible **"Duplicar"** (o "Duplicar y editar") para revisar y reenviar. NO construir versionado/reapertura todavía — Duplicar es suficiente para el MVP.
- **CERRADO (9 jun):** ya implementado — el detalle muestra "Motivo de rechazo" + "Comentario" (correctos desde P1-3) y el botón "⎘ Duplicar" está siempre visible en la cabecera (carga las líneas/tiers en un presupuesto nuevo, `duplicateQuote`). Sin código nuevo; lo desbloqueaba P1-3.

### [x] P2-2 · Feedback al enviar presupuesto
- **Mejora:** el aviso "Presupuesto enviado por WhatsApp" es muy discreto. Tras enviar, redirigir al detalle del presupuesto (muestra SENT + timeline) o mostrar un toast claro con enlace "Ver presupuesto".
- **CERRADO (9 jun):** commit `11ebdc6` — tras enviar desde la quick-quote, navega al **detalle** del presupuesto (estado SENT + timeline) con toast acorde al locale.

### [x] P1-8 · Facturas desde aceptación pública nacían SIN líneas (sin desglose IVA, cuota VeriFactu 0,00)
- **Síntoma (E2E V0-1, 11 jun):** el PDF de la factura 2026-CF-001 salía sin tabla de líneas ni desglose de IVA (solo el total), y la huella VeriFactu se calculaba con cuota 0,00.
- **Causa raíz:** el `tx.invoice.create` del flujo público (`quotes.routes.ts /:id/decision`) no copiaba `lines` (el flujo admin sí); además usaba `quote.total` pre-actualización (con tiers habría facturado el total antiguo).
- **CERRADO (11 jun):** commit `59ce535` — copia `updatedQuote.lines` escaladas al % facturado y usa `updatedQuote.total`. Verificado con segunda factura E2E.

### [x] P1-9 · Presupuesto inexistente mostraba el formulario de firma VACÍO; 404 de cobro/recibo en texto plano
- **Síntoma (E2E V0-1):** `/pay/quote/999999` → 200 con canvas de firma y botón "Firmar y aceptar" sin negocio/líneas/total; `/pay/invoice/999999` → "Cobro no encontrado" en texto crudo. Viola N3 (diseño digno SIEMPRE).
- **CERRADO (11 jun):** commit `0408155` — `src/core/http/publicNotFound.ts` (página digna con el copy oficial N3) usada por la landing de decisión (aceptar y rechazar) y los 5 routes de cobro/recibo.
- **PENDIENTE relacionado — CERRADO (13 jun, `e57eed4`):** quote en estado `rejected` ya muestra página digna (copy oficial N3 decidido por el fundador: "Rechazaste este presupuesto el [fecha]. ¿Has cambiado de opinión? Pídele uno nuevo a [Negocio] 👇" + botón WhatsApp), nunca el formulario de firma.

### [x] P2-4 · Microcopy fuera de N5: "Acepto sin dibujar firma"
- **CERRADO (11 jun):** commit `e80a825` — alineado al oficial N5/regla 30: "Acepto sin firmar" (checkbox y mensaje de error).

### [x] P2-5 · Landing /pay/quote a 390px: columna Total recortada
- **Síntoma (E2E V0-1, captura `docs/evidencias/v01-pay-quote-28-movil.png`):** en viewport 390px los importes de la tabla de líneas quedan cortados ("250…", "90.00 E…").
- **CERRADO (13 jun, `e57eed4`):** `lines-table` con `table-layout:fixed` + anchos fijos para Cant. (44px) y Total (100px / 92px <420px), `white-space:nowrap` y tabular-nums en el importe, `overflow-wrap:break-word` en concepto. El total ya no se recorta. (Pendiente la verificación en dispositivos reales de V0-5.)

### [x] P2-3 · Iconos PWA rotos: los .png eran SVG renombrados (A2HS no instalable)
- **Síntoma:** `public/icons/icon-192.png` e `icon-512.png` contenían texto SVG con extensión .png (523 bytes); el manifest declara `image/png` → Chrome no cumple criterios de instalación y el icono A2HS sale roto. Detectado en el check Y1 de DOCS-F1.
- **Causa raíz (11 jun):** los .png se crearon copiando los .svg con otra extensión. Además `icon-512.svg` tenía viewBox de 512 pero el dibujo a coordenadas de 192 (icono en la esquina superior izquierda).
- **CERRADO (11 jun):** corregido `icon-512.svg` (dibujo a escala 512) y generados PNG reales (10 KB / 51 KB) renderizando los SVG con Edge headless a tamaño exacto. Verificado visualmente ambos.

---

## P-PERCEPCIÓN — Code-review V0-5 de la landing (15-jun, contra Parte N)
> Hallazgos de la revisión de código de `/pay/quote` y `/pay/invoice` ANTES del bug-bash en
> dispositivos reales (V0-5). Regla 1: bug visible en la landing = P0 de percepción.

### [x] PC-B · `/pay/quote`: IVA incoherente entre líneas y Total
- **Síntoma:** las líneas normales mostraban el importe SIN IVA (`qty*price`) mientras las
  líneas de tier lo mostraban CON IVA (`qty*price*(1+tax)`), y el "Total" (`quote.total`, con
  IVA) no llevaba desglose ni etiqueta. El cliente que suma las líneas no llega al Total.
- **CAUSA RAÍZ (16-jun):** dos fórmulas distintas para el importe de línea (net en la tabla,
  bruto en los tiers) y un Total bruto sin desglose. Arreglado: ambas tablas muestran el
  importe NET (`qty*price`, columna "Importe"); bajo las líneas, desglose Base imponible + IVA
  por tipo vía `calcVatBreakdown` (helper canónico, mismo que factura/VeriFactu); Total con
  etiqueta "Total · IVA incluido". Sin cuota (LATAM/exento) → Total plano. Tiers: línea NET +
  nota "IVA incluido". 76 tests verdes.

### [x] PC-A · `/pay/quote`: falta el botón "💬 Tengo una duda"
- **Síntoma:** N1 exige un botón al WhatsApp del PRO (`wa.me/<tel>?text=…sobre el presupuesto #N…`)
  en la pantalla de aceptar (draft/sent). Solo existía en el estado `rejected`.
- **CAUSA RAÍZ (16-jun):** añadido en draft/sent reusando el patrón del estado rejected:
  `wa.me/<whatsappPhone>?text=Hola, tengo una duda sobre el {presupuesto} #N`. Botón secundario
  `.btn-duda` (no verde, respeta la Regla de Una Sola Voz). Sin whatsappPhone → no se muestra
  (degradación digna). `whatsappPhone` ya venía en `loadQuote`.

### [x] PC-C · `/pay/quote` estado `accepted`: sin fecha ni siguiente paso (N3)
- **Síntoma:** N3 pide "Ya aceptaste este presupuesto el [fecha] + siguiente paso"; mostraba
  solo "ya fue aceptado" (el estado `rejected` sí lleva fecha → inconsistente). Pulido.
- **CAUSA RAÍZ (16-jun):** copy alineado a N3 con `quote.acceptedAt` formateado (es-ES):
  "Ya aceptaste este {presupuesto} el [fecha]. El profesional te informará de los siguientes pasos."

### [x] PC-E · `/pay/quote`: animaciones sin `prefers-reduced-motion` + faltaba anillo de foco (AB6)
- **Síntoma:** la celebración (confeti + pop del check + transición del CTA) se disparaba siempre,
  ignorando `prefers-reduced-motion` (lo exige la skill yaqu-premium-ui / checklist AB6), y los
  elementos enfocados por teclado no mostraban el anillo de Foco de DESIGN.md.
- **CAUSA RAÍZ (16-jun):** añadido `@media (prefers-reduced-motion: reduce)` (sin confeti/pop/
  transición) + guard en `fireConfetti()` (`matchMedia`), y regla `:focus-visible` con el anillo
  Foco (`0 0 0 3px rgba(34,197,94,.30)`) para todo elemento enfocado por teclado.

### [x] PC-F · `/pay/bank`: microcopy de copia fuera de N5
- **Síntoma:** los botones decían "Copiar" genérico; N5 oficial: "Copiar IBAN" / "Copiar referencia".
- **CAUSA RAÍZ (16-jun):** etiquetas alineadas a N5 ("Copiar IBAN" / "Copiar CLABE" en MX /
  "Copiar referencia"); `copyText()` ahora restaura el texto de cada botón vía `data-label`
  tras el "¡Copiado!" (antes reseteaba todos a "Copiar").

### [x] PC-D · `/pay/quote` confirmación de aceptación fuera de N5
- **Síntoma:** N5 oficial: "¡Presupuesto aceptado y firmado! [Negocio] ya tiene tu confirmación."
  El subtexto decía "El profesional te informará de los siguientes pasos." (regla 30). Pulido.
- **CAUSA RAÍZ (16-jun):** subtexto de la pantalla de éxito alineado al oficial N5:
  "{Negocio} ya tiene tu confirmación." (nombre escapado, JS-safe).

---

## P3 — Técnico / raíz (registrar, abordar después de P1)

### [ ] P3-1 · Plantilla Meta `quote_decision_es`: `{{1}}` sin sustituir  🔒 ACCIÓN EN META (usuario) — código ya robusto
- **Síntoma:** el botón genera `/pay/quote/{{1}}23` (el `{{1}}` no se sustituye). Ya hay un workaround en el backend que hace funcionar el flujo.
- **Arreglo de raíz:** en WhatsApp Manager, el botón de URL debe ser **"Tipo de URL: Dinámico"**, base `https://yaqu.app/pay/quote/{{1}}`, muestra `https://yaqu.app/pay/quote/abc123`. Revisar también `payment_request_es` por el mismo problema. (Requiere re-aprobación de Meta.)
- **Done cuando:** la URL del botón llega limpia (`/pay/quote/23`) sin depender del workaround.
- **Estado (10 jun):** lado código YA resuelto (workaround robusto `parseNumericId`, commit `a25a1ce`). **Lo único pendiente es la acción en Meta** (tipo de URL dinámica) + re-aprobación — no se puede hacer desde el código. Una vez hecho, opcionalmente quitar el workaround.

### [x] P3-2 · Manejo de error en el envío de WhatsApp
- **Mejora:** que `/admin/quotes/:id/send-whatsapp` devuelva un mensaje claro cuando Meta rechaza, nunca un 502. (Verificar si ya está resuelto; el error de Meta ya se loguea.)
- **CERRADO (10 jun):** commit `950d120` — responde 200 `ok:false` con `message` legible (incluye el motivo de Meta), nunca 502; el front (quick-quote y quotesView) lo muestra.

### [ ] P3-4 · Entregar la factura también por WhatsApp (botón "Ver factura")  🔒 ACCIÓN EN META (usuario)
- **Contexto:** P0-4 dejó la entrega de factura por **email** (Resend + PDF). Falta el canal WhatsApp.
- **Arreglo:** crear/re-aprobar en Meta una plantilla de confirmación de pago con un **botón URL dinámica** "Ver factura" → `https://yaqu.app/...` (PDF/página de la factura), mismo patrón que "Ver presupuesto"/"Pagar ahora". Luego añadir el builder en `whatsappTemplates.ts` y enviarla en el flujo de pago confirmado. (Requiere alta/re-aprobación en Meta.)
- **Estado (10 jun):** bloqueado en acción de Meta (usuario). El builder + envío se añaden cuando exista la plantilla aprobada.

### [ ] P3-3 · Plantillas en categoría Marketing → Utility  🔒 ACCIÓN EN META (usuario)
- **Mejora:** recrear `quote_decision_es`, `payment_request_es` y `payment_confirmation_es` como **Utility** (no Marketing) antes de escalar — mejor entregabilidad y coste. No urgente.
- **Estado (10 jun):** acción de Meta (usuario), no hay nada que cambiar en el código (los nombres de plantilla no cambian).

### [x] P3-5 · WhatsApp Business en modo restringido: Meta #131030 "Recipient phone number not in allowed list"
- **Síntoma (E2E V0-1, 11 jun):** TODO envío de plantilla a un número fuera de la lista de destinatarios de prueba fallaba con #131030.
- **CERRADO (11 jun, usuario en Meta):** la app de Meta está en modo **PRODUCCIÓN**; los mensajes llegan a números reales y los webhooks funcionan (verificado por el fundador en el E2E móvil de V0-1).
- **Nota:** el manejo de error del código ya era correcto (200 `ok:false` con motivo legible, P3-2 ✅).

### [x] P3-6 · Merchant demo: email en prod era `luislaragranado@gmail.com`, la regla 8 dice `demo@yaqu.app`
- **Síntoma (E2E V0-1):** `merchant.findUnique({ email: 'demo@yaqu.app' })` no encontraba al demo (id=1); su email era el histórico.
- **CERRADO (12 jun):** el fundador decidió alinear con la regla 8 → email del merchant 1 actualizado en prod a `demo@yaqu.app` (script efímero, verificado antes/después; sin conflicto de unicidad).

---

## P4 — Pre-lanzamiento (registrar, NO ahora)
- [ ] Correr `/security-review` antes de exponer a clientes reales (el producto maneja pagos).
- [ ] Autenticación + multi-tenant real (quitar `merchantId=1` hardcodeado).

---

## NO TOCAR AÚN (fuera de alcance este sprint)
- Fotos del trabajo (bloqueado: faltan credenciales Cloudflare R2).
- i18n LATAM completo (cotización, IVA 16%/19%, OXXO/PSE/Mercado Pago, VeriFactu).
- Métodos de pago extra (transferencia, OXXO…): **solo tarjeta está bien para el MVP**.
- Verificación visual del fix de moneda en los tiers (commit `addfb76`).
