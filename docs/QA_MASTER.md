# QA MAESTRO — YaQu

> Derivado de `docs/YAQU_MASTER.md` Parte Q (única fuente de verdad). **Crece por sprint:**
> cada sprint que cierra añade aquí sus checks nuevos (`/yaqu-release-check`, paso 3).
> La verificación manual se hace en **yaqu.app** (no localhost), idealmente desde móvil.

## Cómo usar este documento

- Antes de cerrar un sprint: pasar los bloques que toquen lo cambiado + el E2E crítico.
- `npm test` SIEMPRE en verde antes de cada commit (compila + suite contra `dist/`).
- Fallos encontrados → `docs/BUGS.md` con su formato; el sprint no cierra con P0/P1 abiertos.

---

## 1. E2E crítico (RELEASE BLOCKER — se pasa entero en cada cierre de sprint)

registro → onboarding → producto → quote → WhatsApp → landing → firma →
factura/justificante → pago (cada método activo) → estados BD esperados
(`status`, `paidAt`, `paid_via`, eventos) → confirmaciones WA/email → PDF.

- [ ] Registro + onboarding completos (merchant nuevo)
- [ ] Crear producto y quote (Quick Quote <30 s)
- [ ] Envío por WhatsApp: plantilla llega con vars y botón correctos
- [ ] Landing `/pay/quote/:id`: firma (y "Acepto sin firmar") con evidencia ts/IP/UA/método
- [ ] Documento post-pago correcto según flag: factura (demo, con watermark) o justificante
- [ ] Pago por cada método activo del merchant
- [ ] BD: `charge.paid` + `invoice.paid` + `paidAt` + `paid_via` correctos
- [ ] Confirmación WA con nº de documento real + email Resend con PDF
- [ ] "Abrir PDF" regenera on-demand

## 2. Multi-tenant (regla 2)

Sesión del merchant B contra 6 rutas con IDs del merchant A → SIEMPRE 404/403:

- [ ] quote · [ ] invoice · [ ] customer · [ ] charge · [ ] export · [ ] pdf
- [ ] Automatizar en `tests/tenancy.test.mjs` (pendiente de crear — spec en Parte Q)

## 3. Móviles (matriz V0-5)

Android gama media · iPhone · tablet:

- [ ] Landing del cliente (`/pay/quote`, `/pay/invoice`): legible, CTA visible, firma fluida
- [ ] Quick Quote desde móvil
- [ ] Targets ≥44 px, sin scroll horizontal, <1,5 s en 4G

## 4. WhatsApp

- [ ] Builders vs `docs/WHATSAPP_TEMPLATES.md`: `tests/whatsappTemplates.test.mjs` en verde
  (estructura + validación J7 de `expectedVarCount` antes de llamar a Meta)
- [ ] Envío real a número propio por cada plantilla activa
- [ ] "BAJA" respeta `customer.waOptOut`: con el flag activo NO sale ninguna plantilla a ese
  número de ese merchant (hasta WA-0b la baja se marca manualmente desde la ficha)

## 5. Pagos

- [ ] Tarjeta: ok · declinada · abandono de checkout
- [ ] **Webhook duplicado** (Stripe CLI): sin doble `paid`, sin doble WA (idempotencia por
  `event.id` registrada)
- [ ] Connect (post CONNECT-1): fee 0,9 % correcto en Dashboard · fallback sin Connect
  (tarjeta deshabilitada para reales → transferencia/Bizum)

## 6. Bizum manual (post C1-4)

- [ ] Confirmar → cadena post-pago completa (paid + factura + confirmaciones)
- [ ] Deshacer (pre-SIF) limpio · remitida → R1 (runbook R5)
- [ ] Doble confirmación no duplica nada

## 7. SIF / VeriFactu (post S1)

- [ ] Alta, anulación y R1 aceptadas en el entorno de pruebas AEAT
- [ ] Rechazo forzado → retry con backoff → `manual_review` a los 5 intentos
- [ ] `SIF_ENABLED=off` no rompe la emisión local (la cola pausa y reanuda)

## 8. PDFs

- [ ] Quote firmado · factura · R1 con importes en negativo · demo con watermark
- [ ] Regeneración on-demand (nunca `pdfUrl` crudo)

## 9. Permisos (equipo)

- [ ] Rol Técnico NO accede a billing/config/exports/flags (lista de rutas admin)

## 10. Idempotencia general

- [ ] Todo webhook (Stripe, Connect, MP, Meta) registra `provider + event_id` y corta
  repeticiones

---

## Cobertura automatizada actual (`npm test`)

| Test | Cubre |
|---|---|
| `tests/utils.test.mjs` | normalizePhone, calcTotal, makeReference, parseNumericId, esc |
| `tests/invoiceNumber.test.mjs` | series anuales 2026-CF-001, serie R, contadores |
| `tests/vat.test.mjs` | desglose IVA por tipo, rectificativas en negativo |
| `tests/locales.test.mjs` | locales ES/MX/PE |
| `tests/owner.test.mjs` | cuentas owner |
| `tests/whatsappTemplates.test.mjs` | builders + validación J7 vs spec de plantillas |

## Historial por sprint

- **SPAIN (jun-2026):** series anuales, R1, modelo 303, XML RRSIF → checks en bloques 1 y 8.
- **DOCS-F1 (jun-2026):** creación de este documento + validación J7 (bloque 4) + waOptOut
  (bloque 4, check "BAJA").
