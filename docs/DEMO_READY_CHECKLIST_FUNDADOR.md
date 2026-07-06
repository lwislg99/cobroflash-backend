# ✅ DEMO-READY · Lo que te queda a TI (checklist consolidada)

> **Qué es esto:** la vista única de TODO lo humano/tuyo que queda de los tres sprints
> DEMO-READY (base + EXT + EXT2), ordenado por impacto hacia la demo. El código de los
> tres sprints está **COMPLETO y desplegado** (Olas 1-6 ✅ · Ola 7 🟡 solo-key · Olas 8-9 ✅).
> La lista maestra de tus pendientes sigue siendo `PENDIENTES_FUNDADOR.md` (detalle paso a
> paso); esto es el resumen ejecutable. Cuando completes algo, dímelo y actualizo ambos.

---

## ✅ 1. IA + VOZ — RESUELTO (6-jul-2026)

- [x] **Voz = dictado gratis del navegador.** No usa ninguna IA de pago: el micro
  transcribe en el propio móvil del cliente. Se enciende con `VOICE_QUOTE_ENABLED=true`
  en Railway (variable, sin coste por uso).
- [x] **"Sugerir con IA" movido de Claude (de pago) a Gemini (tier gratis).** Decisión
  del fundador: no gastar saldo de pago. Clave `GEMINI_API_KEY` (Google AI Studio, gratis)
  en Railway. El código prueba varios modelos gratis en orden y fuerza JSON estructurado.
  **Verificado funcionando en prod por el fundador.** Tope de 40 usos/hora por merchant
  para que nadie dispare la cuota. Ya NO se necesita `ANTHROPIC_API_KEY`.

## 🟠 2. Los GATES HUMANOS de los sprints (nadie puede hacerlos por ti)

- [ ] **Ensayo del guion de 90 s ×3** sobre la cuenta demo (gate de la Ola 6).
      Todo lo que enseñas está en `docs/evidencias/pre-demo/` tal y como se ve hoy.
- [ ] **Un tercero usa el bot** desde su móvil sin instrucciones y no encuentra callejones
      sin salida (gate de la Ola 8). Requiere `BOT_INBOUND_ENABLED=true` en Railway
      (ya lo tuviste activo). La suite automática ya pasa 11/11 — esto es la prueba humana.
- [ ] **Matriz de voz en tus 3 móviles** (tras el punto 1 + `VOICE_QUOTE_ENABLED=true`):
      Chrome Android ×2 y Safari iOS, guion de 2 min por dispositivo al final de
      `docs/VOZ_MATRIX.md`. La degradación ya está verificada; falta el camino feliz.
- [~] **Bug-bash V0-5**: /pay/quote y /pay/invoice en 3 dispositivos reales
      (checklist en `docs/BUG_BASH_LANDING.md`). **PRE-REVISADO por Claude (6-jul) a 360 y
      390 px** (`docs/evidencias/ext3/bugbash/`): quote impecable (importes 4 cifras, tiers,
      sin fuga de coste/margen); invoice tenía el título "Pagar con tarjeta" partido en móvil
      estrecho → **arreglado** (chip Recomendado bajo el texto). **Te queda solo la pasada
      final en tus 3 móviles reales** (Android/iPhone/tablet) — más ligera ya.
- [ ] **Vídeo de 60 s** (guion en V0-6 del master) → me pasas la URL y la pongo en
      `DEMO_VIDEO_URL`. *Opcional para la demo: la maqueta interactiva A4.7 ya cubre el hueco.*

## 🟡 3. Activaciones en Railway (cada una = 1 variable, efecto inmediato)

| Variable | Qué enciende | Cuándo |
|---|---|---|
| `GEMINI_API_KEY` | IA de "Sugerir con IA" (gratis, Google AI Studio) | ✅ **HECHO** |
| `VOICE_QUOTE_ENABLED=true` | El micro de dictado (gratis, navegador) | ✅ **HECHO / cuando quieras** |
| `BOT_INBOUND_ENABLED=true` | El bot del WhatsApp | Cuando quieras probarlo/enseñarlo |
| `DEMO_SAFE_NUMBERS` | Números a los que el demo puede enviar (V0-2: vacío = bloquea todo) | Antes de ensayar con tu móvil real |
| `EMAIL_FROM` = `YaQu <no-reply@yaqu.app>` | Remitente correcto en los emails (dominio verificado en Resend primero) | Antes de demos con email real |
| `WHATSAPP_ACCESS_TOKEN` | ⚠️ Quedó expuesto (4-jul). **Decisión fundador (6-jul): se rehará entero en FASE B con la SIM nueva** — el token viejo se sustituye ahí. Riesgo residual asumido hasta entonces (opcional: revocarlo ya en Meta, 1 min). | FASE B |
| `ANTHROPIC_API_KEY` | (ya NO se usa — sustituida por Gemini) | — |

> **📦 Agrupado:** TODO el bloque de WhatsApp (rotar token, `DEMO_SAFE_NUMBERS`,
> `BOT_INBOUND_ENABLED`, recrear las 5 plantillas, verificación de empresa) se hace de
> una sentada en la **sesión de FASE B** (§5), ahora que el fundador ya tiene la SIM.
> No tiene sentido tocarlo suelto antes.

## 🟠 4. Stripe (cobros reales con tarjeta + founding cobrable)

> **✅ COBRO DEL FOUNDING VALIDADO EN TEST (6-jul-2026).** Probado de punta a punta por el
> fundador: checkout → pago con tarjeta de prueba → webhook → plan activado solo. La clave
> de Stripe, los 4 precios (resueltos por lookup_key) y el webhook (`/webhooks/stripe`) ya
> están en prod. Dos bugs cazados y arreglados en la prueba: (a) `trial_period_days:0` que
> Stripe rechazaba → omitido; (b) el botón "Suscribirme 29€" mudo (querySelector cogía solo
> el 1er plan-btn) → querySelectorAll.
> **Falta para cobrar DE VERDAD:** pasar a LIVE (claves live + webhook live + `setup-stripe-prices.mjs`
> con la key live) — requiere la cuenta Stripe verificada para pagos en vivo. Y el texto del
> alcance-beta completo (§5b) antes de vender founding a clientes reales.

- [ ] **Pasar a LIVE:** claves `sk_live`/`pk_live` en Railway + crear el webhook en modo live
      (`whsec_` live a `STRIPE_WEBHOOK_SECRET`) + `node scripts/setup-stripe-prices.mjs` con la
      key live. Requiere la cuenta Stripe verificada (datos del negocio + banco).
- [ ] **Webhook Connect** (Dashboard → Developers → Webhooks → tipo Connect →
      `https://yaqu.app/webhooks/stripe-connect`, eventos `account.updated`,
      `checkout.session.completed`, `payment_intent.payment_failed`) → copiar el signing
      secret a Railway como `STRIPE_CONNECT_WEBHOOK_SECRET`.
- [ ] Railway: `PAYMENTS_CONNECT_ENABLED=true` (tarjeta solo para merchants con Connect
      activo, regla 18) y `BIZUM_MANUAL_ENABLED=true` (pruébalo con un Bizum real tuyo).
- [ ] **Probar el ciclo Connect en TEST**: Configuración → activar cobros → KYC de prueba
      → pago test → reparto merchant/fee. (El export de fees ya existe: `/admin/exports/fees.csv`.)
- [ ] **Precios LIVE** (V0-4): ejecutar `scripts/setup-stripe-prices.mjs` con la key LIVE
      → el founding de 14,50 € se puede cobrar de verdad.

## 🟠 5. Meta / WABA de producción (FASE B — cuando tengas la SIM)

Runbook completo paso a paso en `PENDIENTES_FUNDADOR.md` §FASE B. Lo esencial:
- [ ] Registrar el número real + método de pago + credenciales nuevas en Railway
      (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, token permanente).
- [ ] **Recrear las 5 plantillas BIEN**: categoría Utility (mata P3-3), URL dinámica
      (mata P3-1) **y botones quick reply** («👍 Lo miro ahora» / «✅ Voy a pagarlo») —
      con eso el ciclo entero cuesta ~0,023 € o CERO si el cliente inicia (el código
      ventana-first ya está desplegado esperándolo).
- [ ] Verificación de empresa (2-10 días, en paralelo) y, si algo no llega,
      suscribir FlashClient en WhatsApp Manager → apps suscritas (ya documentado).

## 🟣 5b. Nuevos de EXT3 (Olas 10-23 en marcha)

- [ ] **Texto del ALCANCE BETA al asesor** (A10.1): la maquinaria de aceptación ya está EN PROD
      (página /legal/alcance-beta + checkbox + evidencia con versión). El texto sigue siendo el
      borrador con placeholders [NIF]/[Nombre] — cuando el asesor lo valide, actualizas
      `docs/legal/ALCANCE_BETA.md` (o me lo pasas) y las aceptaciones antiguas se invalidan solas.
      **PREPARADO (6-jul):** email listo para copiar-pegar en `docs/legal/EMAIL_ASESOR.md` +
      borrador `ALCANCE_BETA.md` + 12 preguntas `PREGUNTAS_ASESOR.md`. **Solo falta que lo
      ENVÍES al asesor** y vuelvas con sus respuestas (bloquea cobrar founding de verdad).
- [ ] **Destino del backup cifrado (A11.3, S4)**: dime DÓNDE guardar el dump semanal fuera de
      Railway (S3/R2/Backblaze/Drive…) + credenciales en Railway. Sin esto el script queda listo
      pero sin destino. Es requisito ANTES de 25 pagantes.
- [ ] **Credenciales R2 (Ola 19, fotos)**: bucket Cloudflare R2 + keys en Railway. Sin esto la
      ola de fotos NO empieza (la tabla attachments ya espera).
- [ ] **Validar precios de los catálogos (A17.2)**: cuando estén los borradores por gremio,
      2-3 profesionales reales por gremio confirman los precios orientativos ANTES del seed a
      merchants reales (encaja con tus 10 discovery).
- [ ] **OK opcionales Ola 23**: banner "añadir a pantalla de inicio" (PWA) y preparación del
      gate foral (PV/Navarra). Solo se construyen si dices que sí.
- [ ] **Plantilla `maintenance_proposal_es` en Meta (Ola 15, OPCIONAL)**: la propuesta de
      mantenimiento al PRO sale como botones de sesión (solo entrega con tu ventana 24h
      abierta — para la demo basta con escribir tú al número antes). Si quieres cobertura
      fuera de ventana, dala de alta con la spec §6 de `docs/WHATSAPP_TEMPLATES.md` y me
      avisas para conectar el fallback.
- [x] **Veto de copys nuevos (regla 30, Ola 14/15) — APROBADOS por el fundador (6-jul).**
      (a) prefill del wa.me del perfil público "Hola, quiero pedir un presupuesto"; (b) textos
      del ciclo de mantenimiento al pro (mensaje con botones + confirmaciones ✅/⏸/✔️).
      Quedan fijados como oficiales.

## 🔵 6. Lo estratégico que sigue su curso (no bloquea la demo)

- [ ] **Asesor fiscal**: decisión de representación (desbloquea S1-D, el envío a pruebas
      AEAT — la ÚNICA pieza técnica de SIF-1 que espera) + revisión de declaración/alcance.
- [ ] **Calle (V0-6)**: 10 discovery registradas + ≥3 founding cobrados-con-alcance
      (`docs/legal/ALCANCE_BETA.md`) + 10 visitas. Sin esto el sprint VALIDA-0 no cierra (regla 19).

---

### El orden que yo seguiría
**Hoy:** `ANTHROPIC_API_KEY` (1) + rotar token WA (3) + `DEMO_SAFE_NUMBERS` (3).
**Esta semana:** ensayo ×3 (2) + tercero con el bot (2) + Stripe test (4).
**Con la SIM:** FASE B completa (5). **En paralelo:** asesor y calle (6).

*Última actualización: 5-jul-2026, cierre de código de EXT2 (`08c7b9f`). Mantenido por Claude Code.*
