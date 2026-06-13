# PENDIENTES DEL FUNDADOR

> Acciones que SOLO puedes hacer tú (config externa, decisiones, parte humana de sprints).
> Lo voy acumulando aquí según avanzo (instrucción 12-jun: "guárdamelas en un documento").
> Cuando hagas una, márcala `[x]` y dime — desbloqueo lo que dependa de ella.

## ✅ Resuelto el 12-13 jun

- [x] **Railway · `DEMO_SAFE_NUMBERS`** — puesta (`34629965893,629965893`). Verificado en
  prod: el demo solo enviaría WhatsApp a esos números (V0-2 operativo).
- [x] **Stripe · precios nuevos (W1)** — ejecutado con tu OK (modo TEST). Los 4 `lookup_key`
  creados y verificados: pro_monthly (29 €), pro_annual (290 €), founding_monthly (14,50 €),
  equipo_monthly (59 €, no listado). ⚠️ Son de **TEST** — para cobrar de verdad hay que
  re-ejecutar en LIVE (ver "Stripe en LIVE" abajo).
- [x] **P3-6 · Email del merchant demo** — actualizado en prod a `demo@yaqu.app` (regla 8
  se mantiene). `isDemoMerchant` ya casa por id=1 y por email.
- [x] **Plantillas Meta vs justificante** — decidido opción (b): se asume el wording
  actual hasta P3-3; al recrearlas como Utility → copy neutro "tu documento de cobro".
  Anotado como cambio de master en J1. Nada que hacer ahora por tu parte salvo P3-3.
- [x] **Copy del estado `rejected`** — decidido e implementado en la landing (cambio de
  master en N3).

## 🟠 Sprint VALIDA-0 — tu parte

- [ ] **V0-5 · Bug-bash landing cliente (TUYO):** `/pay/quote` y `/pay/invoice` en 3
  dispositivos reales (Android gama media, iPhone, tablet) contra la spec N del master.
  Resultado → `docs/BUG_BASH_LANDING.md`; fallos → BUGS.md como P0-percepción.
  Ya tienes uno apuntado para verificar: **P2-5** (columna Total recortada a 390px).
- [ ] **V0-6 · Calle (TUYO):** lista 30 contactos · **10 discovery registradas (Apéndice B
  del master) — sin esto el sprint NO cierra** · vídeo 60 s (guion en U1.1) · 10 visitas
  a tiendas · ≥3 founding cobrados con alcance por escrito. Borrador del alcance LISTO en
  `docs/legal/ALCANCE_BETA.md` (pendiente visto bueno del asesor antes de usarlo).
- [ ] **Stripe en LIVE** — para cobrar founding DE VERDAD (V0-6): cambiar
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` de Railway a claves live y re-ejecutar
  el script de precios en live.

## 🟡 SIF-1 — TODO va a la cita con el asesor

**One-pager con TODAS las preguntas listo en `docs/legal/PREGUNTAS_ASESOR.md`** (llévalo a
la cita). Resumen de lo que hay que cerrar allí:

- [ ] **S1-0 · Certificado FNMT** + alta en el entorno de pruebas AEAT. Bloqueante físico.
- [ ] **Decisión de representación (pregunta A del one-pager)** — bloquea S1-D (cómo se
  autentica el envío). **S1-D está EN PAUSA hasta esto** (instrucción del fundador).
- [ ] **Datos del PRODUCTOR del SIF** (pregunta B2): razón social + NIF (autónomo vs SL).
- [ ] **NIF del cliente / F1 vs F2** (pregunta B3): límite 400 € de la simplificada.
- [ ] **`TipoRectificativa='I'`** a confirmar (pregunta B4).
- [ ] **Bundle Y3** (preguntas C5-C10): declaración responsable, ToS, anticipos/IVA,
  privacidad/DPA, y visto bueno del **alcance Founding** (`docs/legal/ALCANCE_BETA.md`).
- [ ] **Declaración responsable (S1-E)** — borrador listo en
  `docs/legal/DECLARACION_RESPONSABLE.md`. Te falta: datos del productor (B2), validar con
  el asesor la cláusula de conformidad (C6) y firmarla. Publicarla en la UI es post-8/8.

## 🟣 Meta (de sprints anteriores, siguen abiertas)

- [ ] **P3-1:** botón URL dinámica en `quote_decision_es` (`…/pay/quote/{{1}}`) + re-aprobar
  (el workaround del código sigue vivo; al hacerlo se puede retirar).
- [ ] **P3-4:** plantilla de confirmación con botón "Ver factura" → cuando esté aprobada,
  añado el builder y el envío.
- [ ] **P3-3:** recrear las 3 plantillas como categoría **Utility** (mejor coste/entrega).

---
*Última actualización: 13 jun 2026. Resueltos: DEMO_SAFE_NUMBERS, precios Stripe (test),
P3-6, plantillas Meta (opción b), copy rejected. Pendientes vivos: V0-5/V0-6, Stripe LIVE,
y todo SIF-1 → cita asesor (`docs/legal/PREGUNTAS_ASESOR.md`). Historial de hecho:
`docs/EVIDENCIAS_E2E.md`, Parte U del master, BUGS.md.*
