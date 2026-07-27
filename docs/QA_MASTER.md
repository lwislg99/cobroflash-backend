# QA MAESTRO — YaQu

> Derivado de `docs/YAQU_MASTER.md` Parte Q (única fuente de verdad). **Crece por sprint:**
> cada sprint que cierra añade aquí sus checks nuevos (`/yaqu-release-check`, paso 3).
> La verificación manual se hace en **yaqu.app** (no localhost), idealmente desde móvil.

> **📌 Último QA total (A9.5, 5-jul-2026):** barrido completo con viewport móvil REAL
> (390×844@2x, `scripts/capture-demo.mjs`) → `docs/evidencias/pre-demo/` (BO completo +
> flujo cliente + landing) · bot verificado por suite automática `tests/bot-suite.test.mjs`
> (11/11, payloads Meta simulados, 0 mensajes reales; `BOT_SUITE_TEST=1`) · ciclo
> cero-plantillas fijado por `tests/a55-window-quote.test.mjs` (`A55_DB_TEST=1`) ·
> `npm test`: 81 tests (79 pass + 2 skip gateados) · **0 P0 / 0 P1 abiertos.**
> Pendiente HUMANO: gate Ola 8 (un tercero usa el bot sin instrucciones), matriz de voz en
> 3 móviles (VOZ_MATRIX), bug-bash V0-5, ensayo 90 s ×3.

## Cómo usar este documento

- Antes de cerrar un sprint: pasar los bloques que toquen lo cambiado + el E2E crítico.
- `npm test` SIEMPRE en verde antes de cada commit (compila + suite contra `dist/`).
- Fallos encontrados → `docs/BUGS.md` con su formato; el sprint no cierra con P0/P1 abiertos.

## ⭐ ESTÁNDAR DE CIERRE (Ola 12 EXT3 — vale para CUALQUIER tarea futura)

```bash
npm test                                   # unit + gateadas en skip (81+)
QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm test   # + tenancy, permisos Operario,
                                           #   idempotencia de webhooks y PDFs
                                           #   (filas efímeras propias en la BD
                                           #   del .env; limpieza total)
npm run e2e:critico                        # LA cadena de dinero entera con un
                                           # merchant efímero: registro →
                                           # onboarding → catálogo → presupuesto
                                           # → firma → justificante J → pago test
                                           # → estados BD → PDFs. "¿Despliego
                                           # tranquilo?" = esto en 🟢.
```

- `tests/tenancy-permisos.test.mjs` (A12.1+A12.4): sesión de un merchant B contra
  IDs del A → 403/404 SIEMPRE; sesión técnico recorre `ADMIN_ONLY_ROUTES`
  (`src/core/http/adminOnlyRoutes.ts` — ruta sensible nueva = AÑADIRLA AHÍ) → 403.
- `tests/webhooks-idempotencia.test.mjs` (A12.2): event.id de Stripe/Connect y wamid
  de Meta deduplicados; `payment.confirmed` duplicado en /webhooks/psp NO re-paga
  (queda registrado como duplicate).
- `tests/pdfs.test.mjs` (A12.5): quote firmado vs sin firmar, justificante serie J
  sin QR, watermark DEMO, regeneración on-demand ×2 (R8).
- El pago con Checkout REAL de Stripe test queda pendiente de claves del fundador;
  hasta entonces "pago test" = /webhooks/psp (la misma cadena post-pago).

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

### ⚠️ Un gate puede estar DUPLICADO — quitar uno y ver verde NO prueba nada

Hallado en **SCRUM-136** al verificar un test en rojo: `/admin/team` está protegido **dos
veces** — en el montaje (`mountAdmin(app, '/admin/team', requireRole('admin'), teamRouter)`
en `app.ts`) **y** dentro del router (`router.use(requireRole('admin'))`). Quitar **uno solo**
deja la ruta igual de cerrada, así que el test sigue en verde y parece que el gate que has
tocado "no hacía falta". Hubo que quitar **los dos** para verlo fallar.

**Qué hacer con esto:**

- Al verificar un guard de permisos en rojo, si el test **no** se pone rojo, **no concluyas
  que el test es malo**: busca primero si hay un segundo gate. Un verde tras quitar un gate es
  ambiguo, no tranquilizador.
- **Antes de retirar** un `requireRole` que parezca redundante, localiza el otro y comprueba
  que sigue en pie. La redundancia es barata; quitar el que resultaba ser el único, no.
- Cuando existan los dos, **déjalo escrito en el código** (en ambos sitios), para que el
  siguiente no repita la investigación.
- Nunca des por probado un permiso con un verde: pruébalo con el **403 real** de una sesión
  del rol que NO debe pasar, **y con una guarda de presencia delante** (que el rol que SÍ debe
  pasar recibe 200). Un 403 para todo el mundo —ruta rota, servidor mal montado— también deja
  el assert de abajo en verde sin haber probado nada.

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
