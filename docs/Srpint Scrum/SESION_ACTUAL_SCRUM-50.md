# TAREA ACTIVA — SCRUM-50 · Bot de WhatsApp adaptado a albaranes (V1 MÍNIMO)

> Gobierna: `docs/YAQU_MASTER.md` + el ticket **SCRUM-50** + este brief. NO dependas del chat.
> Flujo: `git checkout main && git pull` → rama `scrum-50-bot-albaranes` → PR (lo crea Luis a mano, NO uses gh) → merge de Luis → suite QA.
> 🚨 ZONA SENSIBLE: webhook entrante de WhatsApp + envío al pro. Guards completos.

---

## DECISIÓN DE ALCANCE DEL FUNDADOR (16-jul) — V1 MÍNIMO
De las 3 piezas del ticket, solo se hacen las que aportan valor HOY (0 clientes):
- ✅ **PIEZA 3 (HACER):** el cliente que escribe sobre un albarán NO debe recibir "no tienes presupuestos pendientes" (bug de cara al cliente). Avisar al pro vía `merchant_alert_es`.
- ✅ **PIEZA 2 parcial (HACER, solo el acuse barato):** manejar `msg.type === 'button'` (el tap de «👍 Recibido» de plantilla) para no ignorarlo. Registrar el acuse. SIN schema.
- 🔵 **PIEZA 1 (DIFERIDA → SCRUM-62):** window-first para ahorrar plantilla. Es optimización de coste; con 0 clientes es ruido (regla 13). NO se toca aquí.
- 🔵 **`recibidoAt` en Albaran (DIFERIDO):** "dato bonito para el pro", enlace heurístico (por teléfono, no id), no pedido por nadie. NO se añade schema en esta tarea.

## 0. CONTEXTO REAL (del recon 16-jul — confírmalo, no lo re-descubras)
- Webhook entrante: `whatsappIncoming.routes.ts:70-170`. Maneja `text` (:124), `interactive` (:130, button_reply/list_reply), `location`, `image`, y UNSUPPORTED_TYPES. **NO hay rama para `msg.type === 'button'`** (así entrega Meta el tap de un quick-reply de PLANTILLA: `{button:{text,payload}}`, distinto de `interactive`). Hoy el «Recibido»: abre la ventana (`recordInboundWaMessage`, :119) ✅ pero cae sin match → se ignora en silencio (no misfire del menú, pero sin acuse).
- `handleIncomingText:309-314`: si un cliente escribe y NO tiene presupuesto pendiente → responde "No tienes presupuestos pendientes". Este es el bug de la pieza 3.
- `notifyMerchantAlert` (`whatsappNotifications.ts:158`, builder `buildMerchantAlert` `whatsappTemplates.ts:205`): ya hace window-first (texto si ventana abierta, plantilla `merchant_alert_es` si no). Ya se usa para la baja J3 (:239). Params: merchantId, merchantPhone, customerName, action, detail, freeText. **Reutilizable tal cual.**
- Enlace del «Recibido» al albarán es HEURÍSTICO (payload de plantilla estático, sin id) → por teléfono → su `albaran_firmado_es` más reciente. NO es enlace duro (por eso no marcamos recibidoAt en V1).

## 1. QUÉ HAY QUE HACER (alcance EXACTO)

### 1.1 PIEZA 3 — cliente escribe sobre un albarán → avisar al pro (no responder mal)
En `handleIncomingText` (`whatsappIncoming.routes.ts`), ANTES de caer en el "no tienes presupuestos pendientes":
- Si el cliente no tiene presupuesto pendiente PERO ha recibido un albarán recientemente (heurística por teléfono → `WhatsAppMessage` con `relatedType:'albaran'` reciente, o su albarán más reciente), entonces:
  - Enviar `notifyMerchantAlert` al pro: "un cliente ha respondido a un albarán" (action + freeText con el texto del cliente, para que el pro lo vea y responda él).
  - Responder al cliente un acuse mínimo y digno (ventana ya abierta por su propio mensaje): algo tipo "¡Gracias por tu mensaje! Se lo hemos hecho llegar a {negocio}, te contactarán enseguida." NO el menú genérico, NO "no tienes presupuestos".
- Si NO hay ni presupuesto ni albarán reciente → comportamiento actual (sin cambio).
- Todo envío pasa por los guards (notifyMerchantAlert ya lo hace).

### 1.2 PIEZA 2 (acuse) — manejar `msg.type === 'button'` (tap de «Recibido»)
- Añadir la rama `msg.type === 'button'` en el switch del webhook (:70-170), junto a las existentes.
- Extraer `button.text` / `button.payload`. Si corresponde al quick-reply «Recibido» de `albaran_firmado_es`:
  - Registrar el acuse (log/console con el contexto; la ventana ya se abre sola por el inbound). NO responder con menú.
  - Opcional barato: un ack de sesión "¡Gracias! 🙌" en la ventana abierta (SIN plantilla, es sesión gratis). Si añade complejidad, omitir — con no responder mal basta.
- NO marcar `recibidoAt` (sin schema en V1).

## 2. LO QUE NO INCLUYE
- NADA de window-first / `sendWhatsAppDocument` (→ SCRUM-62). Los envíos siguen mandando plantilla.
- NADA de schema (`recibidoAt` diferido).
- NO tocar la lógica de presupuestos existente más allá del branch nuevo de albarán.
- NO Invoice/Charge/pagos.

## 3. 🚨 STOP CONDITIONS (AA1.4)
- Enséñame el diff del **webhook** (`whatsappIncoming.routes.ts`) antes de cerrar — es superficie entrante, quiero ver que el branch de albarán no rompe el flujo de presupuestos existente.
- Guards completos en el aviso al pro (notifyMerchantAlert ya los tiene).
- Si algo empuja a window-first, a `sendWhatsAppDocument`, o a schema → PARA (es la 62 o está fuera).
- Hallazgos → reporte (regla 9).

## 4. E2E AUTOMATIZADO (suite → v1.8)
Asserts (gateado, dry-run): cliente con albarán reciente escribe texto → se dispara notifyMerchantAlert al pro (WA-0b) y el cliente recibe acuse digno (NO "no tienes presupuestos"); cliente sin nada → comportamiento actual; tap `button` «Recibido» → no misfire del menú, acuse registrado. Tras merge: re-seed + suite v1.8 vía MCP + reporte.

## 5. DEFINICIÓN DE HECHO (Gate)
- Branch de albarán en handleIncomingText + rama `button` en el webhook. Sin schema.
- build + test verdes; suite v1.8 verde vía MCP.
- E2E humano opcional (con cliente limpio): responder por WhatsApp a un albarán recibido y ver que le llega el aviso al pro + acuse digno al cliente.
- PR con descripción; SCRUM-50 a "En revisión" → Finalizada tras verificación.

## 6. JIRA
Al abrir PR: SCRUM-50 → "En revisión" con plan, diffs, tests, suite. NO transicionar a Finalizada. Window-first documentado como fuera de alcance (→ SCRUM-62).
