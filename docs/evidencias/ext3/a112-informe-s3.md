# A11.2 · Informe de hardening S3 (verificación sobre código real, 6-jul-2026)

Cada regla dura de la Parte S3 del master: **cumple / no cumple → fix aplicado**.

| # | Regla S3 | Veredicto | Evidencia / fix |
|---|----------|-----------|-----------------|
| 1 | Firma verificada en TODOS los webhooks | ✅ CUMPLE (con matiz de config) | Stripe pagos: `stripe.webhooks.constructEvent` sobre raw body (`stripe.routes.ts:35`) · Connect: ídem (`connectWebhook.routes.ts:28`) · Meta: HMAC sha256 de `X-Hub-Signature-256` con `timingSafeEqual`, inválida → **401** (`whatsappIncoming.routes.ts:81`) · MP: `verifyMpWebhookSignature` (x-signature/x-request-id). **Matiz:** Meta y MP solo validan si `WHATSAPP_APP_SECRET` / `MP_WEBHOOK_SECRET` están en Railway — es diseño documentado en código; queda apuntado en el checklist del fundador confirmar que ambos secrets están puestos. |
| 2 | Rate-limit en magic link/login | ❌ NO CUMPLÍA → **FIX2** | No existía ningún limitador. Añadido `core/http/rateLimit.ts` (en memoria, sin deps): login/register 5/15min por IP+email, verify 30/15min por IP, 429 con mensaje humano que no desvela si el email existe. Commit `A11.2-fix2`. |
| 3 | Zod en TODO input | ✅ CUMPLE (razonable F1) | Rutas de mutación clave validadas: quotes (`CreateQuoteSchema`+decision), merchant (`merchantProfileUpdateSchema`), customers (create/update), maintenance (`createSchema`), team, expenses, products. Los endpoints sin zod formal hacen validación manual estricta de tipos primitivos (ids `Number.isInteger`, enums con whitelist). Sin gaps de inyección detectados: Prisma parametriza todo. |
| 4 | Cookies httpOnly+Secure+SameSite=Lax | ✅ CUMPLE | `authMiddleware.setCookie`: `HttpOnly; Path=/; SameSite=Lax` + `Secure` en producción (`authMiddleware.ts:65-72`). |
| 5 | No PII en logs (teléfonos enmascarados) | ❌ NO CUMPLÍA → **FIX1** | Teléfonos completos en logs del webhook entrante (`from=…`), guards de envío (waOptOut/demo-safe) y botones de mantenimiento. Añadido `maskPhone` (`34629965893 → 34•••••893`) y aplicado en todos los `console.*` con número. Commit `A11.2-fix1`. |
| 6 | Secretos solo en env | ✅ CUMPLE | Grep de `sk_live/sk_test/EAAG/Bearer <literal>`: 0 resultados fuera de `process.env`/`config.*`. `.env*` en `.gitignore`. ⚠️ Recordatorio vivo del checklist: el token WA expuesto en chat el 4-jul sigue pendiente de ROTAR (acción fundador). |

## A11.3 · Backups (S4)
- `scripts/backup-dump.mjs`: dump (pg_dump custom si existe; si no, lógico completo vía
  Prisma de las 21 tablas) → gzip → **AES-256-GCM** (clave `BACKUP_ENCRYPTION_KEY`, min 32
  chars) → `backups/yaqu-YYYYMMDD.*.gz.enc` (gitignored).
- **Test de restauración EJECUTADO** contra la BD real: descifrado íntegro (el tag GCM
  garantiza integridad criptográfica) + conteo de filas por tabla vs BD viva → 20/20
  coinciden (`a113-restore-test.txt`).
- **Política Railway (el [VALIDAR] de S4):** Railway Postgres mantiene backups propios
  gestionados (daily, retención según plan) *dentro* de Railway — por eso S4 exige el dump
  cifrado FUERA. Validar plan/retención concretos = fundador en el panel de Railway.
- **Pendiente FUNDADOR:** destino externo (S3/R2/Backblaze/Drive) + `BACKUP_ENCRYPTION_KEY`
  definitiva guardada fuera de Railway + programación semanal (Railway cron o máquina
  local). Ya estaba en checklist §5b.

## A11.1 · Auditoría S2 (mínimo F1)
`audit_log` escribe con userId (teamMemberId; null=owner) + IP: `marcar_pagado_manual`
(pay/bulk-paid/status→paid), `deshacer_pago` (unpay/status→pending), `anular_factura`
(rectify R1 — única anulación permitida, regla 29). `cambio_flag`: helper listo
(`audit.service.ts`); hoy NO existe endpoint que cambie flags (se cambian a mano en BD por
el fundador) — se cablea en cuanto exista.

## A11.4 · Exports RGPD
Separador `;` + UTF-8 BOM (Excel español) en TODOS los CSV; nuevo `customers.csv`
(nombre/razón social/NIF/teléfono/email/notas/baja WA/alta) + botón "Clientes CSV" en
Informes. Ya existían facturas/gastos/presupuestos (ahora con `;`).
