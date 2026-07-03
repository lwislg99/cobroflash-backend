# SPRINT DEMO-READY · YaQu
### El camino a enseñar la mejor demo posible en días (y todo lo demás si da tiempo)

**Meta:** en pocos días, demo en vivo a los primeros contactos con un producto que (a) no se
rompe, (b) entra por los ojos, (c) tiene 1-2 momentos WOW, y (d) el fundador responde cualquier
pregunta con propiedad.

**Principio del documento:** hay cosas con **latencia externa** (Meta verifica cuando quiere,
la SIM tarda en llegar, el asesor tiene agenda). Todo eso se **dispara el DÍA 0** y mientras
esperan, se avanza código. Nada de esperar parado.

**Para Claude Code:** tareas `[CC]` una a una, un commit por tarea, verificar en yaqu.app.
Prohibido: reordenar el Sprint Registry, inventar estados/flags/copy, tocar `INVOICING_ES_ENABLED`
para merchants reales (regla 24), claims fiscales fuera del guion H2 (regla 26).
Stop conditions (dinero/producción/AEAT/Meta) = las ejecuta o aprueba el fundador.

> **📌 ESTADO DE EJECUCIÓN (3-jul-2026 · lo mantiene Claude Code):**
> **Ola 1 ✅ COMPLETA:** A1.1 `f50abd3` (verificado por el fundador) · A1.2 `6d037dc` + db push + backfill (verificado: #1..#3) · A1.3 `1afd010` · A1.4 `7ef3c5c` (repo limpio; queda `EMAIL_FROM` en Railway → PENDIENTES_FUNDADOR).
> **Ola 2 ✅ COMPLETA (código):** A2.1 `24d5408` tras flags OFF (db push aditivo aplicado con OK; activación = PENDIENTES_FUNDADOR) · A2.2 `86533ec` · A2.3 `94f3566` · A2.4 `347427e` (PDF verificado visualmente) · A2.5 `07466f5` · A2.6 `e2cf9db`. Fixes post-verificación: `ba32f38` (displayNum + pulido crear), `00588bb` (Regla del Importe), `e5a4402` (totales una voz + empty state).
> **Verificación del fundador:** EN CURSO (punto 2, modal post-crear); checklist en memoria de Claude.
> **Ola 3 ⏳:** stretch sin decidir (solo con la demo de 90s ensayada).

---

# CARRIL 0 · DÍA 0 — disparar TODO lo que tiene espera externa (fundador, hoy)

| # | Acción | Latencia típica | Nota |
|---|--------|-----------------|------|
| 0.1 | **Comprar SIM (Simyo o similar)** para el número oficial de YaQu | 1-3 días envío | Ver guía G1. El número NO debe haberse usado nunca en la app normal de WhatsApp |
| 0.2 | **Iniciar verificación de negocio en Meta Business Manager** | 1-5 días (a veces más) | Se puede iniciar YA, sin esperar la SIM. Ver guía G2 |
| 0.3 | **Ejecutar `scripts/setup-stripe-prices.mjs`** → precios a LIVE | inmediato | Stop condition dinero. Sin esto un founding no puede pagar |
| 0.4 | **Pedir cita al asesor** (bundle: privacidad+DPA+cookies+ToS con condiciones económicas y 0,9%) | agenda del asesor | Bloquea el primer COBRO, no la demo. Ver guía G4 sobre facturas |
| 0.5 | **Sesión de plantillas en Meta**: al tener la WABA lista, recategorizar las 5 a **Utility** | revisión de Meta: minutos-48h | −67% de coste (~0,05€→~0,017€). Ver guía G3 |

> Regla del carril: cada mañana, primero revisar si Meta/SIM/asesor han avanzado; si no, seguir
> con la ola de código que toque.

---

# CARRIL A · CÓDIGO — olas en orden estricto

## OLA 1 — "Que no se rompa" (P0, antes de ensayar la demo siquiera)

**A1.1 `[CC · P0]` — FIX draft atascado (PV-FIX-11).**
Presupuesto aceptado por admin se queda en `draft` sin opción de enviar → flujo muerto.
Revisar la máquina de estados de Quote: tras aceptar (admin), estado válido + CTA siguiente
disponible. Done: ciclo completo draft→enviado→aceptado→cobrado reproducible en yaqu.app.

**A1.2 `[CC · P0]` — Numeración de presupuestos POR MERCHANT (punto 12 + PV-FIX-6).**
Hoy el número sale del autoincrement global de la BD: el primer presupuesto de un merchant nuevo
puede ser "#35" → canta muchísimo en demo. Contador secuencial por merchant (p. ej. campo
`quoteNumber` por merchant, o tabla de secuencias), formato legible ("P-0001" o "#1"). Aplicar
igual al justificante (serie J del merchant). Aditivo, sin romper links existentes.

**A1.3 `[CC · P0]` — Errores del rol técnico (PV-FIX-9 y 10).**
(a) Técnico no ve Configuración (ocultar sección + guard en backend).
(b) Presupuesto por encima de su límite → mensaje digno: "Enviado a un administrador para
aprobación", nunca stacktrace.

**A1.4 `[CC · P1]` — Nombre viejo "PresuFácil" fuera de los correos (PV-FIX-3).**
Todas las plantillas de email (Resend) → YaQu. Un grep por el repo de "presufacil|PresuFácil|
cobroflash" en textos visibles al usuario.

✅ **Gate de la Ola 1:** puedes hacer el ciclo entero delante de alguien sin errores ni textos raros.

## OLA 2 — "Que enamore" (los WOW de la demo)

**A2.1 `[CC · WOW#1]` — CONNECT-1 mínimo + página de cobro con selector de método (punto 6).**
Es el clímax de la demo: el cliente final abre el link y paga ahí mismo.
- C1-0: flags + campos Prisma (`stripeAccountId`, `connectStatus`) — YA especificado.
- C1-1: onboarding Express ("Activar cobros con tarjeta · 2 min, DNI e IBAN").
- C1-2: Direct Charge sobre la cuenta conectada con `application_fee` 0,9%.
- C1-4: Bizum manual asistido (móvil+importe+concepto copiables, doble confirmación).
- **Página `/pay` propia**: el cliente NO va directo a Stripe; aterriza en una página YaQu
  (estilo la de aceptar presupuesto) y elige entre los métodos que el merchant habilitó
  (tarjeta / Bizum / transferencia con "Copiar IBAN"). Si solo hay uno habilitado, solo ve ese.
- **Selector al crear** presupuesto/factura: ☐ Tarjeta (+0,9%) ☐ Bizum ☐ Transferencia,
  con default configurable por cliente.
> Si Meta aún no ha verificado la WABA cuando esto esté listo: la demo se enseña con un
> teléfono de test dado de alta. El WOW funciona igual.

**A2.2 `[CC · WOW#2]` — Detalle de presupuesto guiado por estado (punto 9 / imagen 1).**
La timeline actual + **UN CTA primario según estado**:
- `draft` → botón verde gigante "Enviar por WhatsApp"
- `enviado` → "Marcar aceptado / rechazado" con nota "(esto normalmente lo hace tu cliente
  desde su móvil)" — paso manual permitido
- `aceptado` → "Cobrar señal / Generar cobro"
- `cobrado` → "Ver justificante" / "Duplicar"
Secundarias discretas (Duplicar, PDF, Recordar). La pantalla se explica sola en demo.

**A2.3 `[CC · WOW#3]` — Modal post-crear: previsualizar y elegir (puntos 10 + 11).**
Al crear el presupuesto: previsualización del PDF + botones
**[Enviar por WhatsApp] [Enviar por email] [Descargar PDF] [Seguir editando]**.
Sustituye el check de envío automático. Enviar por email usa la plantilla Resend con el link
del presupuesto. Descargar = el PDF ya generado.

**A2.4 `[CC · WOW#4]` — Justificante de cobro PREMIUM (punto 13, versión legal).**
NO se activan "facturas de verdad" (regla 24, sanción de fabricante — ver guía G4).
Lo que sí: rediseñar el documento para que dé orgullo: logo del merchant, tipografía y layout
limpios (design system), numeración de serie J por merchant (A1.2), datos del emisor completos,
pie claro "Justificante de cobro — este documento acredita el cobro recibido". Mismo template
servirá para la factura VeriFactu al activarse post-SIF.

**A2.5 `[CC · WOW#5]` — Reseñas post-pago, versión legal (punto 7).**
1) FIX del bug: `googleReviewUrl` no se guarda (+ test Playwright).
2) Página post-pago "¿Qué tal fue el trabajo?" con estrellas:
   - **A TODOS** se les muestra el botón "Déjale una reseña en Google" (si hay URL).
   - El feedback (estrellas+comentario) se guarda SIEMPRE en privado para el merchant.
   - ⚠️ PROHIBIDO condicionar la publicación a X estrellas (review gating: viola políticas de
     Google y normativa UE de reseñas). El efecto real es el mismo: los contentos van a Google.
3) Enganche: tras `charge.paid`, el link de valoración va en el mensaje/página de confirmación.

**A2.6 `[CC · WOW#6]` — Home premium (punto 8, versión de días).**
NO dashboard configurable (eso es DASH-PREMIUM-1, post-clientes). Sí: pulir la Home actual —
"💶 dinero en juego" arriba grande (pendiente de cobrar / en presupuestos vivos), 3 KPI-cards
limpias, botón gigante "Nueva cotización", empty states dignos. Solo CSS/layout + queries ya
existentes; cero features nuevas.

✅ **Gate de la Ola 2:** demo de 90 segundos ensayada: crear (30s) → modal enviar → WhatsApp
al cliente → abre, firma → página de pago, elige método, paga → "💰 te han pagado" →
justificante premium → página de reseña. Ese es el guion.

## OLA 3 — "Si llego" (stretch, solo con Olas 1-2 cerradas)

**A3.1 `[CC · stretch]` — BOT-1 mínimo viable (puntos 3 y 5).**
Sí: "solicitar presupuesto" funciona a través del bot. Versión mínima demoable:
- Webhook de entrantes + `BotSession` + identidad (número compartido: 1 merchant→contexto fijo;
  varios→lista; desconocido→respuesta única sin captura).
- Menú de lista (máx 3 botones Meta): Ver presupuestos · Pagar pendiente · Pedir presupuesto.
- Pedir presupuesto: 2 preguntas → `QuoteRequest` → WhatsApp al pro con resumen + link BO.
- Handoff "Hablar con [Negocio]" → aviso al pro, bot mudo 24h.
- Bonus de coste: todo lo que el bot responde va DENTRO de la ventana de 24h → **gratis**.
> Si no da tiempo: se cuenta como "lo siguiente que sale", no se enseña a medias.

**A3.2 `[CC · stretch]` — Topes anti-abuso de WhatsApp (PV-WA-CAPS).**
Tope de plantillas/día por merchant + respeto estricto de `waOptOut` + alerta interna de gasto
diario. Barato y protege el número compartido.

---

# CARRIL B · GUÍAS PASO A PASO (fundador)

## G1 · Comprar la SIM (punto 1 tuyo)
1. Compra una SIM de prepago o tarifa mínima (Simyo vale). Requisitos del número:
   - Puede **recibir SMS o llamada** de verificación (imprescindible).
   - **Nunca registrado** en la app normal de WhatsApp / WhatsApp Business App. Si lo estuvo,
     hay que eliminar la cuenta desde la app ANTES de registrarlo en Cloud API.
   - Una vez en Cloud API, ese número **deja de poder usarse** en la app normal. Es solo API.
2. Guarda el número y ten la SIM a mano el día del registro (te llega el código ahí).

## G2 · WABA a producción (el bloqueante nº1 para demos reales)
1. **Meta Business Manager → Configuración del negocio → Centro de seguridad → Verificación
   del negocio.** Documentación: datos fiscales del negocio, web (yaqu.app), teléfono/email
   verificables. → Esto se inicia HOY, sin esperar la SIM.
2. En **WhatsApp Manager**: añadir el número nuevo a tu MISMA WABA → verificación por
   SMS/llamada (la SIM en mano).
3. Aprobar el **display name** ("YaQu") — Meta lo revisa.
4. Al completar verificación + número: la cuenta pasa de test (5 destinatarios) a producción
   (límite inicial ~250 conversaciones únicas/día, sube solo con buen uso).
5. **Las plantillas viven en la WABA, no en el número**: tus 5 aprobadas sirven tal cual con
   el número nuevo. NO hay que recrearlas (punto 4 tuyo: resuelto).

## G3 · Plantillas → Utility (ahorro ~67%)
1. En WhatsApp Manager → Plantillas: revisa la categoría de las 5.
2. Para las clasificadas Marketing: editar/re-enviar pidiendo categoría **Utility** (son
   transaccionales: presupuesto, cobro, confirmación — encajan en la definición de Meta).
3. Recuerda las reglas: variables `{{N}}` nunca al principio ni al final del cuerpo; copy
   neutro "tu documento de cobro" (decisión 12-jun) al recrear.
4. Coste tras el cambio: ~0,017€/msg vs ~0,05€. Y utility dentro de ventana de 24h abierta = 0€.

## G4 · Facturas: cómo hablar de esto con tus primeros demos (punto 13)
**Lo que NO se puede (ley, no opinión):** activar "facturas de verdad" antes de cerrar SIF-1.
Desde 29-jul-2025 solo se comercializa software de facturación adaptado al RRSIF; hacerlo mal
expone al fabricante a hasta 150.000€/ejercicio (regla 24). `INVOICING_ES_ENABLED` sigue OFF.

**Lo que SÍ tienes para vender YA:** presupuesto + firma + cobro + **justificante de cobro
premium** (A2.4). El justificante acredita el cobro — tu gancho es la morosidad, no la factura.

**Guion único si preguntan "¿me vale para VeriFactu?" (regla 26, literal):**
> "Te contesto como fabricante: la facturación VeriFactu está construida y en certificación —
> con declaración responsable del productor, que es lo que tu gestor te pedirá. Por ley no puedo
> activarla hasta cerrarla; por eso la beta es de presupuestos y cobros. Los founding la estrenáis
> al cerrarse, sin cambio de precio. Si quieres, le paso a tu gestor el detalle técnico cuando
> lo publique."

**Y tu idea buena: pregúntales CÓMO facturan hoy (discovery, Apéndice B ampliado):**
- "¿Cómo haces hoy la factura cuando cobras un trabajo? ¿Excel, Word, programa, la hace tu gestor?"
- "¿La haces tú o te la pide/hace la gestoría a fin de mes?"
- "¿Te piden factura todos los clientes o solo empresas?"
- "¿Sabes lo de VeriFactu para 2027? ¿Te lo ha contado tu gestor?"
→ Con 10 respuestas sabrás si tus founding necesitan la factura YA (probable: muchos la resuelven
vía gestoría o a posteriori) y cómo aterrizar la Etapa 2 post-SIF. Registra las respuestas.

---

# CHECKLIST "DEMO-READY" (para saber cuándo parar de construir)

☐ Ciclo completo sin errores en yaqu.app (Ola 1)
☐ Números de presupuesto/justificante por merchant, legibles
☐ WABA en producción (o, si Meta tarda: teléfono del prospecto dado de alta como test para SU demo)
☐ Stripe LIVE + un pago founding de prueba actualiza `merchant.plan`
☐ Página de cobro con selector de método funcionando (WOW#1)
☐ Detalle de presupuesto guiado por estado (WOW#2)
☐ Modal post-crear con WhatsApp/email/PDF (WOW#3)
☐ Justificante premium (WOW#4)
☐ Reseña post-pago (WOW#5) — versión legal, sin gating
☐ Home pulida (WOW#6)
☐ Guion de demo de 90s ensayado 3 veces + guion H2 memorizado
☐ Bundle legal en marcha con asesor (bloquea el primer cobro, no la demo)
○ (Bonus) BOT-1 mínimo — solo si sobró tiempo

---

# ORDEN DE EJECUCIÓN RESUMIDO

**Día 0 (hoy):** Carril 0 entero (SIM + verificación Meta + Stripe LIVE + cita asesor)
**Mientras llega lo externo:** Ola 1 (A1.1 → A1.4) → Ola 2 (A2.1 → A2.6)
**Cuando Meta verifique:** número a la WABA + display name + recategorizar plantillas (G3)
**Si sobra tiempo:** Ola 3 (bot + topes)
**Último día antes de la primera demo:** ensayo del guion de 90s, 3 veces, en tu móvil.
