# PENDIENTES DEL FUNDADOR

> Acciones que SOLO puedes hacer tú (config externa, decisiones, parte humana de sprints).
> Lo voy acumulando aquí según avanzo (instrucción 12-jun: "guárdamelas en un documento").
> Cuando hagas una, márcala `[x]` y dime — desbloqueo lo que dependa de ella.

## 🔴 Urgente (bloquea funcionalidad ya desplegada)

- [ ] **Railway · `DEMO_SAFE_NUMBERS`** — V0-2 ya está en prod: el merchant demo NO puede
  enviar WhatsApp a NINGÚN número hasta que pongas esta variable. Pon tu(s) número(s)
  separados por comas, con y sin prefijo para curarte en salud, p. ej.:
  `DEMO_SAFE_NUMBERS=34629965893,629965893`
- [ ] **Stripe · precios nuevos (W1)** — ejecuta `node scripts/setup-stripe-prices.mjs`
  (lee STRIPE_SECRET_KEY de tu .env; es idempotente). Crea por `lookup_key`:
  Pro 29 €/mes · Pro 290 €/año · Founding 14,50 €/mes · Equipo 59 €/mes (no listado).
  El backend los resuelve solo por lookup_key (sin tocar Railway). **Hasta entonces:**
  el botón founding devuelve `price_not_configured` y el checkout Pro cae al precio
  ANTIGUO de la env ($19) aunque la UI ya diga 29 € — no dejes entrar a nadie a pagar
  antes de correr el script. (Si prefieres, dame OK explícito y lo ejecuto yo.)

## 🟠 Sprint VALIDA-0 — tu parte

- [ ] **V0-5 · Bug-bash landing cliente (TUYO):** `/pay/quote` y `/pay/invoice` en 3
  dispositivos reales (Android gama media, iPhone, tablet) contra la spec N del master.
  Resultado → `docs/BUG_BASH_LANDING.md`; fallos → BUGS.md como P0-percepción.
  Ya tienes uno apuntado para verificar: **P2-5** (columna Total recortada a 390px).
- [ ] **V0-6 · Calle (TUYO):** lista 30 contactos · **10 discovery registradas (Apéndice B
  del master) — sin esto el sprint NO cierra** · vídeo 60 s (guion en U1.1) · 10 visitas
  a tiendas · ≥3 founding cobrados con alcance por escrito. Para el alcance necesitas
  `docs/legal/ALCANCE_BETA.md` — dime y te preparo el borrador con el wording del master
  para que lo revises.
- [ ] **Stripe en LIVE** — para cobrar founding DE VERDAD (V0-6): cambiar
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` de Railway a claves live y re-ejecutar
  el script de precios en live.

## 🟡 SIF-1 (prioridad absoluta del master en cuanto esté esto)

- [ ] **S1-0 · Certificado FNMT** + alta en el entorno de pruebas AEAT + cita con asesor
  (bundle legal Y3). Es EL bloqueante de SIF-1; todo lo demás del sprint espera esto.
  (Yo mientras puedo adelantar S1-0b: investigación de la spec técnica AEAT + librería
  de firma XAdES → `docs/SIF_SPEC_NOTES.md`.)

## 🔵 Decisiones que te esperan (no urgentes)

- [ ] **P3-6 · Email del merchant demo:** en prod es `luislaragranado@gmail.com`; la regla 8
  del master dice `demo@yaqu.app`. ¿Actualizo el merchant 1 en prod o corrijo la regla 8?
- [ ] **Plantillas Meta vs justificante (Parte M):** `payment_request_es` y
  `payment_confirmation_es` dicen "factura" literal; para merchants ES reales (modo
  justificante pre-SIF) el copy choca con "el copy NUNCA dice factura". Opciones:
  (a) alta de variante genérica en Meta ("Tu documento de cobro está listo"), o
  (b) asumir el wording hasta SIF-1. Es cambio de master.
- [ ] **Copy oficial del estado `rejected`:** un presupuesto rechazado aún muestra el
  formulario de aceptar en la landing (N3 no define ese estado). Propón el texto y lo
  implemento (p. ej. "Este presupuesto fue rechazado. Pide uno nuevo 👇 [WhatsApp]").

## 🟣 Meta (de sprints anteriores, siguen abiertas)

- [ ] **P3-1:** botón URL dinámica en `quote_decision_es` (`…/pay/quote/{{1}}`) + re-aprobar
  (el workaround del código sigue vivo; al hacerlo se puede retirar).
- [ ] **P3-4:** plantilla de confirmación con botón "Ver factura" → cuando esté aprobada,
  añado el builder y el envío.
- [ ] **P3-3:** recrear las 3 plantillas como categoría **Utility** (mejor coste/entrega).

---
*Última actualización: 12 jun 2026 (cierre V0-1 → V0-4). Historial de qué hay hecho:
`docs/EVIDENCIAS_E2E.md`, Parte U del master y BUGS.md.*
