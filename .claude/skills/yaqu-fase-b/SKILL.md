---
name: yaqu-fase-b
description: Runbook de la WABA de PRODUCCIÓN de WhatsApp (número real/SIM) de YaQu — token permanente por Usuario del sistema, 3 variables de Railway, recrear las 5 plantillas, verificación de empresa y nombre para mostrar. Usar al montar o retomar el WhatsApp de producción o cuando el usuario invoque /yaqu-fase-b.
---

# /yaqu-fase-b — WhatsApp de producción (WABA real)

> Consolida el runbook de `docs/PENDIENTES_FUNDADOR.md` §FASE B. Los envíos y el bot viven
> en `src/integrations/whatsapp.ts` (Meta Cloud API directa — **NUNCA n8n**, regla 1).

## Datos de producción (7-jul-2026)
- WABA **"YaQu"** · Business/WABA ID `856548487239404` · número **+34 621 32 04 05**
- Phone Number ID `1116961488178247` · App "FlashClient" ID `808356465468667`

## Pasos
1. **Número + método de pago** en Meta (Configuración de producción → registrar número).
2. **Token permanente** — hacerlo por **Usuario del sistema** (Business Settings → Usuarios →
   Usuarios del sistema → rol Admin → Generar token → app FlashClient → permisos
   `whatsapp_business_messaging` + `whatsapp_business_management`). El botón "Generar
   identificador permanente" exige antes **verificar el email de la CUENTA**
   (`luisdragonball@gmail.com`, NO el del negocio `luislaragranado@gmail.com`).
3. **Railway (3 variables):** `WHATSAPP_ACCESS_TOKEN` (`EAA…` — el fundador lo pega DIRECTO
   en Railway, **nunca en el chat**), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`.
4. **Recrear las 5 plantillas** en categoría Utility → usar `/yaqu-wa-templates`.
5. **Verificación de empresa** (Portfolio comercial → Iniciar verificación) — tarda días, va
   en paralelo. Corregir antes el país del delegado de datos si está mal (debe ser España).
6. **Nombre para mostrar "YaQu"** — ya aprobado; tarda en propagarse (se ve del todo tras la
   verificación de empresa). Hasta entonces aparece el número crudo: es normal, no es fallo.
7. **Probar de verdad:** con `BOT_INBOUND_ENABLED=true`, escribir al número; y un envío de
   plantilla desde la app cuando Meta las apruebe.

## Recordatorios
- Secretos (token `EAA…`, claves) **NUNCA en el chat** → directo a Railway. Si uno aparece en
  la conversación, hay que **revocarlo y regenerarlo**.
- Cambios de plantilla o categoría de Meta = **STOP condition** (OK del fundador, AA1).
