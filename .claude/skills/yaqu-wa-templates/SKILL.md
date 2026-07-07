---
name: yaqu-wa-templates
description: Dar la estructura EXACTA para crear o verificar una plantilla de WhatsApp de YaQu en Meta (categoría Utility/"Servicio", cuerpo, variables en orden, pie, botón, muestras en EUR). Usar al recrear plantillas en WhatsApp Manager, al depurar un rechazo #132000/#132001, o cuando el usuario invoque /yaqu-wa-templates.
---

# /yaqu-wa-templates — Plantillas de WhatsApp (estructura exacta)

> Fuentes de verdad (leer SIEMPRE antes de dictar nada, y cruzarlas):
> - `docs/WHATSAPP_TEMPLATES.md` — spec canónica (cuerpo literal, variables, pie, botón).
> - `src/integrations/whatsappTemplates.ts` — `WA_TEMPLATE_SPECS` (nº exacto de variables
>   + si lleva botón) y los builders. El código rellena por **POSICIÓN**: si el nº de
>   variables o el botón no cuadran con Meta, el envío se rechaza (#132000).

## Reglas duras al crear/recrear en Meta (WhatsApp Manager)
- **Categoría = "Servicio"** (así traduce Meta *Utility* en español). NUNCA Marketing (más
  caro, peor entrega, límites) ni Autenticación. Si Meta la reclasifica a Marketing, apelar.
- **Idioma = Spanish (`es`)**; nombre de la plantilla y **orden de variables EXACTOS**.
- **Muestras de variables en EUR** (p. ej. `350,00 EUR`): Meta la revisa como plantilla
  española. Nada de `$… MXN` u otras monedas.
- **Botón URL dinámica:** la URL base termina en `/{{1}}`; la muestra lleva una URL de
  ejemplo. El código envía SOLO el sufijo (el id), no la URL completa.
- **Quick replies** (si se añaden, p. ej. «👍 Lo miro ahora» / «✅ Voy a pagarlo»): el botón
  URL debe quedar el **PRIMERO (índice 0)** — el código manda el id ahí. Si el editor
  reordena o no deja mezclar botones, dejar solo el botón URL. **Tocar plantillas/categoría =
  STOP condition → OK del fundador (AA1).**

## Las 5 plantillas (resumen; el detalle EXACTO está en `docs/WHATSAPP_TEMPLATES.md`)
| Plantilla | Cat | Vars (en orden) | Botón |
|---|---|---|---|
| `quote_decision_es` | Utility | cliente · negocio · nº presu · total€ | URL "Ver presupuesto" → `/pay/quote/{{1}}` |
| `payment_request_es` | Utility | cliente · negocio · nº factura · importe€ | URL "Pagar ahora" → `/pay/invoice/{{1}}` |
| `payment_confirmation_es` | Utility | cliente · importe€ · nº factura · negocio | (ninguno) |
| `payment_confirmation_invoice_es` | Utility | cliente · importe€ · nº doc · negocio | URL "Ver documento" → `/recibo/{{1}}` |
| `merchant_alert_es` | Utility | cliente · qué pasó · importe/ref | URL **ESTÁTICA** "Abrir YaQu" → `/dashboard/` |

## Procedimiento
1. Leer las dos fuentes de verdad y localizar la plantilla por nombre.
2. Dictar el bloque exacto: categoría, idioma, título (si lo lleva), **cuerpo literal** con
   `{{n}}`, pie, botón (tipo + URL base) y muestras en EUR.
3. Verificar contra `WA_TEMPLATE_SPECS`: `expectedVarCount` y `hasUrlButton` deben cuadrar.
4. Si el usuario reporta **#132000** → nº de variables/botones no coincide con la aprobada;
   **#132001** → nombre/idioma de plantilla no encontrado.
