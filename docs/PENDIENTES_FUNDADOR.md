# PENDIENTES DEL FUNDADOR — tu lista central de tareas

> **Qué es este documento:** la lista ÚNICA de cosas que tienes que hacer TÚ por tu cuenta
> (configuración externa, decisiones, gestiones, la parte "humana" de los sprints). Es tu
> "rama principal" personal: aquí está todo lo que depende de ti, ordenado por prioridad.
> Se actualiza en cada sesión.
>
> **Cómo usarlo con Claude (cualquier chat):** ábrele este archivo y dile *"guíame con mis
> pendientes"*. Cada punto dice qué hacer y por qué; cuando termines uno, dímelo y marco
> `[x]` y desbloqueo lo que dependía de él. Si un punto menciona código o sprints (V0-x,
> S1-x), es solo contexto — lo construyo yo; aquí solo está TU parte.
>
> **Reparto de trabajo (para que un chat nuevo se oriente solo leyendo docs):**
> - **Lo que hago YO (Claude):** las prioridades de construcción están en
>   `docs/YAQU_MASTER.md` → **Parte U (Sprint Registry)**, con cada item marcado
>   ✅/🟡/⏳ según avanza. El detalle técnico vive en los docs que cita el master.
> - **Lo que haces TÚ:** este documento.
> - **Historial de lo ya hecho:** Parte U del master + `docs/BUGS.md` +
>   `docs/EVIDENCIAS_E2E.md` + `docs/MIGRATIONS_PENDING.md`.

## 🆕 Sprint DEMO-READY (3-jul) — activar los WOW construidos (Olas 1 y 2 desplegadas)

El código de CONNECT-1 + Bizum manual + selector de métodos está EN PROD tras
flags OFF (nada cambia hasta que actives). Para encenderlo, EN ESTE ORDEN:

- [ ] **Stripe · webhook Connect:** en el Dashboard de Stripe (modo test primero) →
  Developers → Webhooks → "Add endpoint" de tipo **Connect** apuntando a
  `https://yaqu.app/webhooks/stripe-connect` con eventos `account.updated`,
  `checkout.session.completed` y `payment_intent.payment_failed`. Copia el signing
  secret a Railway como `STRIPE_CONNECT_WEBHOOK_SECRET`.
- [ ] **Railway · `PAYMENTS_CONNECT_ENABLED=true`** — enciende la card "Cobros con
  tarjeta" en Configuración (onboarding Express "2 min, DNI e IBAN") y los direct
  charges con fee 0,9 % (`APPLICATION_FEE_BPS=90` por defecto, no hace falta ponerla).
  ⚠ Con el flag ON, la tarjeta SOLO se ofrece a merchants con Connect activo (o al
  demo) — regla 18.
- [ ] **Railway · `BIZUM_MANUAL_ENABLED=true`** — enciende "Pagar por Bizum" en la
  página de cobro (usa `bizumPhone` de Configuración o tu número de WhatsApp).
  Pruébalo con un Bizum real entre dos móviles tuyos (C1-4).
- [ ] **Probar el ciclo Connect en TEST:** activa cobros desde Configuración con el
  merchant demo → KYC de prueba de Stripe → pago test → el dinero reparte al
  merchant y el fee a la plataforma.

## 🆕 Sprint DEMO-READY (2-jul) — nuevas acciones tuyas

- [ ] **Railway · `EMAIL_FROM`** (A1.4/PV-FIX-3): el nombre viejo en los correos NO está en el
  código (repo limpio, default "YaQu") — está en la variable de Railway. Cámbiala a
  `YaQu <no-reply@yaqu.app>` (o el remitente del dominio que tengas **verificado en Resend**;
  si yaqu.app no está verificado en Resend, verifícalo primero o los emails dejarán de salir).
- [ ] **Carril 0 del sprint doc:** SIM (0.1) · verificación negocio Meta (0.2) · Stripe LIVE
  `setup-stripe-prices.mjs` (0.3) · cita asesor (0.4) · plantillas → Utility (0.5).

## 🔝 Ahora mismo, por orden (lo más importante primero)

1. **Pedir cita con el asesor fiscal** y llevarle `docs/legal/PREGUNTAS_ASESOR.md` — es lo
   que MÁS desbloquea (todo SIF-1: representación, datos del productor, F1/F2, bundle legal).
   Sin esto, SIF-1 (la prioridad nº1 del proyecto) no avanza.
2. **Alta en el entorno de pruebas AEAT** (el certificado FNMT ✅ ya lo tienes, con copia `.pfx`).
3. **V0-5 (bug-bash móvil)** y **V0-6 (calle: 10 discovery + vídeo + 3 founding)** — cierran VALIDA-0.
   La landing ya está **pre-arreglada a nivel de código** (percepción A–G); solo falta tu pasada
   en 3 dispositivos reales para poder grabar el vídeo de V0-6.
4. **Stripe en LIVE** cuando vayas a cobrar founding de verdad.
5. **Meta:** P3-1 (URL dinámica en `quote_decision_es`) y P3-3 (recrear las plantillas como
   **Utility**, hoy en Marketing). No urgente, pero mejora coste/entrega.

*(El detalle de cada uno, más abajo.)*

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

## ✅ Resuelto 15-16 jun

- [x] **Certificado FNMT** conseguido (copia `.pfx`). Queda solo el alta en el entorno de
  pruebas AEAT (sube al punto 2 de prioridades).
- [x] **Envío real de WhatsApp conectado** — `payment_confirmation_invoice_es` (con botón
  "Ver documento" → recibo) sustituye a `payment_confirmation_es`; `merchant_alert_es` es el
  fallback al PRO con ventana 24h cerrada, en pago y en la decisión de presupuesto. Nada por
  tu parte salvo P3-3 (Marketing → Utility).
- [x] **Landing pre-arreglada para V0-6** — 11 remates de percepción (PC-A…K) contra la Parte N
  y el checklist AB6, incluidas las 4 pantallas del cliente (`/pay/quote`, `/pay/invoice`,
  `/pay/bank`, `/recibo`: fecha+método, 400 digno, foco, tokens). Solo falta tu pasada en
  dispositivos (V0-5).

## 🟠 Sprint VALIDA-0 — tu parte

- [ ] **V0-5 · Bug-bash landing cliente (TUYO):** `/pay/quote` y `/pay/invoice` en 3
  dispositivos reales (Android gama media, iPhone, tablet) contra la spec N del master.
  **Checklist concreta lista en `docs/BUG_BASH_LANDING.md`** (15-jun): matriz de dispositivos,
  P2-5 lo primero, cada pantalla mapeada a N1/N2/N3/N5 y tabla de resultados. Córrela en
  yaqu.app; fallos → BUGS.md como P0-percepción.
  **Ya pre-arreglado en code-review (PC-A…K en BUGS.md):** IVA coherente con el Total, botón
  "💬 Tengo una duda", estados/microcopy N5, motion accesible (`prefers-reduced-motion`),
  "Copiar IBAN/referencia", política de señal, y en `/recibo` fecha+método del pago, 400 digno,
  anillo de foco y estilos a tokens. Tu pasada confirma **P2-5 a 390px** y lo que solo se ve en
  móvil real; la landing ya está lista para grabar el vídeo de V0-6.
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

- [~] **S1-0 · Certificado FNMT** ✅ conseguido (15-jun, guardado con copia `.pfx`).
  Falta: alta en el **entorno de pruebas AEAT**. Bloqueante físico parcialmente levantado.
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
- [ ] **Pack gestoría (S1-H)** — borrador listo en `docs/legal/PACK_GESTORIA.md`
  (one-pager para la gestoría de tus clientes). Falta: datos del productor, política F1/F2
  y visto bueno del asesor. Se distribuye solo tras SIF-1 8/8.

## 🟣 Meta (WhatsApp)

- [x] **2 plantillas nuevas Approved (15-jun) y CONECTADAS:** `payment_confirmation_invoice_es`
  sustituye a `payment_confirmation_es` en los webhooks de pago (psp + mp); `merchant_alert_es`
  es el fallback del aviso al PRO con ventana 24h cerrada (opción 1: intento texto → caigo a
  plantilla, sin schema) en pago (psp + mp) y en la **decisión de presupuesto**
  (`quotes.routes.ts`, 16-jun) vía el helper genérico `notifyMerchantAlert`. 76 tests en verde.
  ⚠️ **Quedaron en categoría Marketing** → P3-3 las recategoriza a Utility (mejor coste/entrega).
- [ ] **P3-1:** botón URL dinámica en `quote_decision_es` (`…/pay/quote/{{1}}`) + re-aprobar
  (el workaround del código sigue vivo; al hacerlo se puede retirar).
- [ ] **P3-3:** recrear las 3 plantillas originales como categoría **Utility** (mejor coste/entrega).

## ✅ Resuelto 14-jun

- [x] **Copy del recibo `/recibo/:chargeId`** ahora es condicional: "Descargar factura (nº)"
  para factura (post-SIF) y "Descargar justificante (nº)" para justificante (pre-SIF), según
  el tipo de documento — coherente con V0-0/regla 7. Aplicado también al mensaje de estado y
  al botón de email, con concordancia de género (commit `925925c`).

## 📁 Mapa de documentos (para ti y para cualquier chat de Claude)

- `docs/PENDIENTES_FUNDADOR.md` — **este**: tus tareas.
- `docs/YAQU_MASTER.md` — fuente de verdad del proyecto; **Parte U** = qué construye Claude y en qué orden.
- `docs/legal/PREGUNTAS_ASESOR.md` — one-pager para la cita con el asesor.
- `docs/legal/ALCANCE_BETA.md` — alcance founding (para cobrar la beta con respaldo).
- `docs/legal/DECLARACION_RESPONSABLE.md` — declaración responsable del SIF (S1-E, borrador).
- `docs/legal/PACK_GESTORIA.md` — one-pager para la gestoría de tus clientes (S1-H, borrador).
- `docs/EVIDENCIAS_E2E.md` · `docs/BUGS.md` · `docs/MIGRATIONS_PENDING.md` — historial/QA.

---
*Última actualización: 16 jun 2026. Resuelto esta tanda: certificado FNMT conseguido, envío
WhatsApp real conectado (2 plantillas nuevas), landing percepción A–K pre-arreglada para V0-6
(las 4 pantallas del cliente, /recibo incluido).
Pendientes vivos (TU parte), por orden: **1)** cita asesor (lo que más desbloquea) · **2)** alta
entorno pruebas AEAT · **3)** V0-5 (pasada en 3 dispositivos) + V0-6 (calle: 10 discovery +
vídeo + ≥3 founding) · **4)** Stripe LIVE · **5)** Meta P3-1 (URL dinámica) y P3-3 (Marketing→Utility).*
