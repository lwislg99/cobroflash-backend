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

## 🔝 Ahora mismo, por orden (lo más importante primero)

1. **Pedir cita con el asesor fiscal** y llevarle `docs/legal/PREGUNTAS_ASESOR.md` — es lo
   que MÁS desbloquea (todo SIF-1: certificado, representación, datos del productor, F1/F2,
   bundle legal). Sin esto, SIF-1 (la prioridad nº1 del proyecto) no avanza.
2. **Certificado FNMT** + alta en el entorno de pruebas AEAT (puedes ir tramitándolo en paralelo).
3. **V0-5 (bug-bash móvil)** y **V0-6 (calle: 10 discovery + vídeo + 3 founding)** — cierran VALIDA-0.
4. **Stripe en LIVE** cuando vayas a cobrar founding de verdad.

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

## 🟠 Sprint VALIDA-0 — tu parte

- [ ] **V0-5 · Bug-bash landing cliente (TUYO):** `/pay/quote` y `/pay/invoice` en 3
  dispositivos reales (Android gama media, iPhone, tablet) contra la spec N del master.
  **Checklist concreta lista en `docs/BUG_BASH_LANDING.md`** (15-jun): matriz de dispositivos,
  P2-5 lo primero, cada pantalla mapeada a N1/N2/N3/N5 y tabla de resultados. Córrela en
  yaqu.app; fallos → BUGS.md como P0-percepción.
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
  plantilla, sin schema). 76 tests en verde. ⚠️ **Quedaron en categoría Marketing** → P3-3 las
  recategoriza a Utility (mejor coste/entrega). Falta el fallback en la decisión de presupuesto
  (`quotes.routes.ts`) — follow-up apuntado.
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
*Última actualización: 13 jun 2026. Resueltos: DEMO_SAFE_NUMBERS, precios Stripe (test),
P3-6, plantillas Meta (opción b), copy rejected. Borradores legales listos: alcance,
preguntas asesor, declaración responsable, pack gestoría. Pendientes vivos: cita asesor
(lo que más desbloquea), certificado FNMT, V0-5/V0-6, Stripe LIVE.*
