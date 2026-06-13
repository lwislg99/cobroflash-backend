# YAQU — DOCUMENTO MAESTRO v5.3 UNIFICADO
**10 junio 2026 · ÚNICA FUENTE DE VERDAD · Reemplaza a: YAQU_MASTER_V5, PARCHE_V5.1, ADDENDUM_V5.2 y DELTA_V5.3 (todas las precedencias ya resueltas en este documento).**

> **Instrucción para Claude Code (única tarea de instalación):** guardar este archivo como `docs/YAQU_MASTER.md`, mover los 4 documentos anteriores a `docs/historico/`, commit `docs: YAQU_MASTER v5.3 unificado`. No hay nada que fusionar ni interpretar: este documento ya es la fusión.
> **Sprint activo:** VALIDA-0 (Parte U). **Prioridad absoluta de F1:** SIF-1.
> **Etiquetas de fase:** `F1-doc` (definición vigente ya) · `F1-build` (código permitido en F1) · `F2-spec` (verdad para su sprint; PROHIBIDO construir antes) · `F3/F4/cajón`.
> Si una tarea necesita un estado, flag, transición o texto que no está aquí: NO se inventa — se propone cambio de master primero (regla 27).

---

# PROJECT BRIEF — YAQU EN 12 LÍNEAS (leer SIEMPRE primero)

YaQu es una herramienta **WhatsApp-first para profesionales de oficios en España**: fontaneros, electricistas, reformistas, climatización, cerrajeros y pintores. Resuelve dos dolores: presupuestos lentos/poco profesionales que mueren "en visto", y trabajos que empiezan sin señal cobrada. Permite crear el presupuesto en 30 segundos (tecleando o dictando), enviarlo por WhatsApp con botones nativos, conseguir aceptación/firma del cliente desde su móvil, cobrar señal o total, y — **cuando el gate fiscal SIF-1 esté cerrado** — emitir facturas VeriFactu con declaración responsable del fabricante. **Hasta entonces, la beta vende presupuestos, firma y cobro con justificante no fiscal: nunca "facturación" ni claims fiscales** (reglas 17, 24, 26). Foco F1: **SIF-1 es la prioridad absoluta** sobre cualquier feature. Modelo comercial: **un único plan público — YaQu Pro 29 €/mes (290 €/año) + 0,9 % solo en cobros con tarjeta; Bizum manual y transferencia sin fee** (founding: 14,50 € de por vida, 20 plazas). Canal core: WhatsApp (Meta Cloud API directa, jamás n8n). El producto es móvil-first y la pantalla más pulida debe ser SIEMPRE la landing del cliente final. España-first (marketing mono-país hasta F3); LATAM en F3 con socio y sin claim de factura. NO se construye ahora: app nativa, marketplace, CRM complejo, contabilidad, multi-país activo, IA libre (Parte Z). **Claude Code debe:** obedecer el Sprint Registry (Parte U) sin reordenar, no inventar estados/flags/textos (Partes L, P, N5, K1), respetar las stop conditions (AA1.4) y priorizar SIF-1 sobre todo.

**Flujo core:**
```
Merchant crea presupuesto (texto o voz)
  → cliente recibe WhatsApp (plantilla con botón)
  → cliente abre landing /pay/quote/:id
  → firma con el dedo o "Acepto sin firmar" (evidencia ts/IP/UA)
  → se genera justificante no fiscal — o factura VeriFactu si INVOICING_ES_ENABLED (post SIF-1)
  → cliente paga señal/total (tarjeta Connect · Bizum manual · transferencia)
  → merchant recibe confirmación por WhatsApp; factura/justificante al cliente por email
  → recordatorios automáticos persiguen lo pendiente (24h / 7d / 14d)
  → F2 añade: Job (segundo tramo), mantenimientos, perfil público, bot entrante y media
```

---

# PARTE A — NORTE CLARO

## A1. Qué es YaQu en una frase
**YaQu es el sistema de cobro por WhatsApp para los oficios.** El profesional crea la cotización en 30 segundos (tecleando o dictando), el cliente la recibe por WhatsApp, la firma con el dedo y paga la señal sin salir de la conversación. Los recordatorios persiguen al moroso automáticamente; **con el gate fiscal cerrado (SIF-1, regla 24) la factura VeriFactu se emite sola — antes de SIF-1 el flujo entrega justificante no fiscal.**
- **Promesa primaria (calle):** "Cobra la señal antes de empezar y no persigas a nadie nunca más."
- **Pilar de confianza nº2 (y gancho del canal gestorías):** facturación VeriFactu con declaración responsable del fabricante — **prohibido como claim hasta cerrar SIF-1** (regla 17; guion provisional en H2).
- **Lo que NO vendemos:** "software de presupuestos" (commodity a 9,99 €) ni "software de facturación" (lo regalan Billin/Alegra).
- Dominio: yaqu.app · Repo: github.com/lwislg99/cobroflash-backend · Deploy: Railway auto-deploy desde main.

## A2. Modelo de negocio (DUAL)
1. **Suscripción — UN plan público:** "YaQu Pro — 29 €/mes (o 290 €/año) + 0,9 % solo cuando cobras con tarjeta. Todo incluido." Founding = banner de lanzamiento (14,50 €/mes de por vida, 20 plazas, contador real). Equipo = oferta manual 59 € no listada en F1. Detalle completo: Parte W.
2. **Take rate:** 0,9 % de cada cobro con tarjeta vía Stripe Connect (application fee). Bizum manual y transferencia: sin fee (ventaja comercial). Futuro sobre el flujo: financiación y servicios (Z).
> Regla de oro: cuanto más dinero del oficio fluya por YaQu, más gana YaQu. Toda decisión de producto se evalúa con: "¿hace fluir más dinero por la plataforma?"

## A3. ICP
Profesional de servicios a domicilio (fontanero, electricista, reformista, pintor, climatización, cerrajero), solo o con equipo de 1-10, móvil-first, que hoy presupuesta por WhatsApp/papel y pierde trabajos por lentitud y por no cobrar señal. **Geografía F1-F2: España.** Plan Equipo (manual) para instaladoras de 3-10 técnicos.
**Verticales vetados en F1-F2:** estética, tatuadores, clínicas, academias, eventos, talleres. "Servicios a domicilio" ya son 6+ gremios; horizontalizar mata la densidad del boca a boca.

## A4. Por qué España primero (resumen del research 10-jun-2026; fuentes en Apéndice A)
1. **VeriFactu:** obligatorio 1-ene-2027 (sociedades) y 1-jul-2027 (autónomos) — RD-ley 15/2025. Sanción usuario hasta 50.000 €/ejercicio.
2. **Hecho del productor (decisivo):** desde el **29-jul-2025** solo se puede comercializar software de facturación totalmente adaptado al RRSIF; el RD-ley 15/2025 mantuvo esa fecha. Sanción fabricante: **150.000 €/ejercicio y tipo de software** + 1.000 €/sistema sin declaración responsable (art. 201 bis LGT). Consecuencia: el módulo de factura NO se comercializa a merchants ES reales hasta SIF-1 completo (flag `INVOICING_ES_ENABLED`, regla 24).
3. **Tolteck (competidor vertical líder) cerró España por VeriFactu** y derivó sus clientes a Billin: clientes huérfanos del nicho exacto.
4. El fundador vive en Madrid: GTM presencial, red caliente, iLAB.
5. LATAM bloqueado de inicio: en México la factura legal es CFDI vía PAC (el PDF no vale) y la informalidad en oficios llega al 95-99 %; en Colombia Alegra regala facturación DIAN (~4,5 USD/mes). LATAM = F3, quote-to-cash con socio, sin claim de factura.
6. Competencia ES (PresuNow, PresupuestAPP 9,99 €, Billin "gratis" Kit Digital) NO cierra el círculo del dinero. **Moat de YaQu = WhatsApp API nativa con botones + firma + factura VeriFactu + cobro integrado + recordatorios, de punta a punta.**

## A5. Métricas norte
| Fase | Fecha | Métrica de dinero | Métrica de uso |
|---|---|---|---|
| F1 | 30 sep 2026 | 25 pagantes + **% de cobros del merchant vía plataforma** (instrumentar desde el día 1) | ≥5 cotizaciones/semana por merchant activo |
| F2 | 31 jul 2027 | 300-1.000 pagantes (9-29 K€ MRR) | ≥40 % de cobros vía plataforma |
| F3 | 31 dic 2028 | +LATAM: 2.000-4.000 pagantes | NRR >100 % |
| F4 | 2029+ | Plataforma del dinero del oficio | — |

---

# PARTE B — PAÍSES Y REGULACIÓN

## B1. Tabla de decisión
| # | País | Cuándo | Propuesta allí | Pagos | Documento fiscal | Riesgo principal |
|---|---|---|---|---|---|---|
| 1 | **España** | AHORA | Ciclo completo + VeriFactu | Tarjeta (Stripe Connect), transferencia, Bizum manual; Bizum-PSP en watch | Factura VeriFactu (SIF-1 en curso) | Competencia "gratis" Kit Digital → vender cobro, no factura |
| 2 | **México** | F3 | Quote-to-cash (cotización+firma+cobro+recordatorios); factura = add-on | Mercado Pago (hecho), tarjeta, SPEI; OXXO después | CFDI 4.0 vía PAC SOLO como add-on | Informalidad del ICP; jamás prometer "factura" sin PAC |
| 3 | **Colombia** | F3 (con MX) | Quote-to-cash; convivir con Alegra | PSE, Nequi/Daviplata (agregador), tarjeta, MP | DIAN vía proveedor = add-on | Ticket bajo → empujar take rate |
| 4 | **Chile** | F3 tardío | Ciclo completo; mercado formal | Webpay/Transbank o MP | SII electrónica | Mercado pequeño |
| 5 | **Brasil** | F4, con equipo | Quote-to-cash + **Pix** | Pix, tarjeta, boleto | NFS-e (compleja, en reforma) | pt-BR + competencia local |
| 6 | **EEUU hispano** | F4, con capital | Jobber-en-español | Stripe nativo, ACH | Ninguno | CAC alto, incumbentes |
| 7 | **Argentina** | Último | — | MP domina | ARCA | Macro/inflación |

## B2. Checklist regulatorio España (orden = bloqueantes primero)
1. **[BLOQUEANTE LEGAL antes de facturar a reales]** Conformidad RRSIF completa + **declaración responsable del fabricante** (art. 13 RRSIF). Exposición: 150.000 €/ejercicio + 1.000 €/sistema (201 bis). → SIF-1 v2 (U1).
2. **[BLOQUEANTE OPERATIVO antes de tarjeta real]** Stripe Connect (CONNECT-1). Hasta entonces, cobros reales SOLO transferencia/Bizum manual; tarjeta limitada a demo/test (regla 18).
3. Certificado digital FNMT (HUMANO, día 1) → desbloquea SIF-1.
4. Bundle legal con asesor (Y3): declaración + ToS (incl. condiciones económicas) + anticipos/IVA + privacidad/DPA/cookies + conservación. Antes del primer pagante: privacidad+DPA publicadas.
5. Plantillas Meta a categoría Utility (acción usuario en Meta, pendiente).
6. **Gate foral:** domicilio fiscal en País Vasco/Navarra → facturación ES off + aviso TicketBAI (regla 33).

## B3. Checklist LATAM (F3, no antes)
- México: contrato PAC (evaluar Facturama API), add-on "Factura CFDI" con coste por timbre; merchant aporta RFC+CSD. - Colombia: proveedor DIAN como add-on o export hacia Alegra (alianza > guerra). - Mercado Pago: alta de aplicación por país; webhooks IPN ya integrados.

## B4. Matiz ICP↔VeriFactu (no inflar)
~426.000 autónomos en construcción (12,4 % de 3,44 M) es el SECTOR. La obligación VeriFactu EXCLUYE: módulos (estimación objetiva), recargo de equivalencia, territorios forales y quien factura sin sistema informático. Subset obligado real: **[VALIDAR — estimación 150-300K]**. El ICP se define por el DOLOR DE COBRO; VeriFactu cualifica un subset y abre gestorías.

---

# PARTE C — PRODUCTO

## C1. Core (la promesa; estado)
| Feature | Estado |
|---|---|
| Cotización completa + Quick Quote 30s + GBB 3 opciones | ✅ |
| **Cotización por VOZ** | ❌ → VOZ-1 (U1 #5) |
| Envío WhatsApp API Meta nativa con botones | ✅ |
| Firma con el dedo + evidencia | ✅ · variante "Acepto sin firmar": spec N1 — verificar/añadir en V0-5 |
| Factura + VeriFactu local (hash, QR, R1, series, 303, XML) | ✅ emisión local · envío SIF ⏳ SIF-1 · **conformidad por AUDITAR (S1-A)** |
| Cobro: tarjeta / transferencia / Mercado Pago | ✅ (tarjeta migra a Connect → CONNECT-1; Bizum manual → C1-4) |
| Recordatorios automáticos (cotización 24h; factura 7/14d) | ✅ |
| Portal del cliente + solicitar presupuesto | ✅ |
| Catálogo + import CSV + IA sugiere líneas + IA mensaje WA | ✅ |
| Equipo/roles/aprobaciones; gastos y margen; exports | ✅ |

## C2. Premium / diferenciales (orden por impacto en dinero)
1. **Take rate vía Connect** (CONNECT-1) — modelo de negocio + requisito legal de flujo de fondos.
2. **Mantenimientos recurrentes** (Parte R · MANT-1) — anti-churn del merchant y de YaQu.
3. **Bot WhatsApp entrante** (BOT-1, K1) — convierte el número en captador de trabajos.
4. **JOB-1 Trabajo mínimo** (Parte R · JOB-1) — el estado `terminado` dispara el cobro del segundo tramo.
5. **Perfil público + QR** (Parte R · PERFIL-1) — loop viral B2B2C.
6. **Financiación del ticket** (FIN-1, F2 tardía, gate en Z).
7. MEDIA-1 (foto avería + audio→QuoteRequest + antes/después, Parte R · MEDIA-1) · catálogos por gremio (Parte R · ONBOARD-2) · precios por zona (F3, gate datos).

## C3. Visión final (no sprint): **voice-first total** — "tu oficina es WhatsApp": operar todo por voz/chat. Se llega vía VOZ-1 → BOT-1 → BOT-2, nunca de golpe. Resto de ideas grandes: Parte Z (cajón con gates).

---

# PARTE D — ARQUITECTURA

## D1. Principios
Monolito modular Node 20 + TypeScript + Express 5 + Prisma 6 + PostgreSQL en Railway. **Sin microservicios, sin bundler, frontend vanilla.** Se añaden capas, no se reescribe.

## D2. Capas nuevas y fase
```
src/core/countries/           ← F1 MÍNIMA: es.ts + getCountryConfig() (impuestos, términos,
                                 paymentMethods, fiscalEngine). Resto de países: F3.
src/modules/payments/connect/ ← CONNECT-1 (F1)
src/modules/fiscal/verifactu/ ← SIF-1 (F1): sif.client.ts + cola VfSubmission
src/modules/voice/            ← VOZ-1 (F1)
src/modules/inbound/          ← BOT-1 (F2)
src/modules/maintenance/      ← MANT-1 (F2)
src/core/flags.ts             ← F1 (lectura; tabla FeatureFlag + env)
src/core/queue/ (BullMQ)      ← F2 si >500 envíos/día (hoy: crons in-process)
src/core/storage/r2.ts        ← F2 (fs Railway es efímero)
```

## D3. Decisiones técnicas cerradas
- **Pagos:** Stripe Connect **Express** + **DIRECT CHARGES** sobre la cuenta conectada (`stripeAccount`) con `application_fee_amount` (`APPLICATION_FEE_BPS=90`). El merchant es merchant-of-record (disputas/refunds en su cuenta). La suscripción del SaaS va por Billing en la cuenta de plataforma (flujo separado). Mercado Pago se mantiene para F3.
- **Bizum:** Stripe Bizum NO soporta Connect a día de hoy [VALIDADO 10-jun, docs.stripe.com] → **Bizum manual asistido** (C1-4) + **BIZUM-WATCH** trimestral; MONEI solo si la telemetría lo pide (U2). El fee del 0,9 % aplica SOLO a tarjeta (W1); Bizum manual y transferencia van sin fee. PROHIBIDO procesar pagos de clientes finales en la cuenta de plataforma (regla 23).
- **Voz:** Web Speech API en cliente (Chrome Android = mayoría ICP), textarea editable; fallback F2: audio→Whisper/Deepgram [VALIDAR coste].
- **Storage:** R2 con URLs firmadas (F2) para firmas/fotos/PDF nuevos.
- **Flags:** precedencia merchant > país > env global (Parte P).

---

# PARTE E — FRONTEND PREMIUM
DESIGN.md es la ley (claridad Stripe + calidez Wise, "El recibo de confianza", Regla de Una Sola Voz, Regla del Importe). Tres énfasis de percepción:
1. **La landing del cliente final es la pantalla nº1** (la ven 10x más personas que el dashboard): nivel obsesivo, spec completa en Parte N. Bug visible ahí = P0 de percepción.
2. **Home = tu dinero en juego:** cifra única arriba ("Tienes 4.300 € en juego" = pendiente de aceptar + pendiente de cobrar), Display/Tinta/tabular; debajo las 3 KPI.
3. **Celebración sobria al cobrar:** cifra en grande + micro-animación (respeta `prefers-reduced-motion`).
Percepción premium = velocidad + cero bugs visibles + copy humano. Antes que cualquier rediseño: estos tres puntos.

---

# PARTE F — ROADMAP POR FASES

## F1 · "Primeros 25 pagantes" — jun a sep 2026 (España) · VERIFACTU-FIRST
```
Semanas 1-2 · VALIDA-0  (+ S1-0 humano día 1: FNMT + alta AEAT + asesor con bundle Y3)
              ∥ DOCS-F1 (tooling + docs, en huecos)
Semanas 2-6 · SIF-1 v2  ← PRIORIDAD ABSOLUTA del recurso técnico
              ∥ CONNECT-1 SOLO en huecos de espera externa de SIF-1
Semana  6   · VOZ-1
Semanas 6-7 · PRECIOS-1 (activación facturación a founding) + GTM-1 etapa 2
```
**Gates:** SIF-1 = gate de venta fuerte, de TODO claim fiscal y de `INVOICING_ES_ENABLED`. CONNECT-1 = gate solo de tarjeta real. Conflicto un día dado → gana SIF-1 SIEMPRE.

## F2 · "La ola VeriFactu" — oct 2026 a jul 2027 (España)
Backlog ordenado en U2 (re-priorizable a los 25 pagantes). Gate de salida: 300-1.000 pagantes, ≥40 % cobros vía plataforma.

## F3 · "LATAM con socio" — ago 2027 a dic 2028: LATAM-1 (MX+CO), CFDI-1, DIAN-1, Chile; mensaje = cobrar, no facturar; Wayra/partner local.

## F4 · "Plataforma del dinero del oficio" — 2029+: financiación/adelantos, derivación, Brasil (Pix), EEUU hispano. Requiere equipo/capital.

---

# PARTE H — GTM Y PRICING (España F1-F2)

## H1. Pricing
Un plan público (Parte W): **Pro 29 €/mes (290 €/año) + 0,9 % solo tarjeta — todo incluido**; founding 14,50 € de por vida (20 plazas, banner con contador real); Equipo 59 € manual no listado. Trial 14 días sin tarjeta. NO competir en precio con Billin/Kit Digital: el ancla es "un trabajo de 1.500 € que no se te escapa paga 4 años de YaQu".

## H2. Mensaje en dos etapas
- **Etapa 1 (pre-SIF):** categoría = "herramienta para presupuestar, firmar y cobrar señales por WhatsApp". PROHIBIDO: "VeriFactu listo", "cumple con Hacienda", venderlo como software de facturación. **Guion único ante "¿me vale para VeriFactu?" (regla 26):** *"Te contesto como fabricante: la facturación VeriFactu está construida y en certificación — con declaración responsable del productor, que es lo que tu gestor te pedirá. Por ley no puedo activarla hasta cerrarla; por eso la beta es de presupuestos y cobros. Los founding la estrenáis al cerrarse, sin cambio de precio. Si quieres, le paso a tu gestor el detalle técnico cuando lo publique."*
- **Etapa 2 (post-SIF):** "Presupuesto, firma, señal cobrada y facturación VeriFactu con declaración responsable del fabricante, en una sola herramienta." Declaración descargable + pack gestoría (S1-H). Mensajería por audiencia: fontanero → cobro primero, VeriFactu como seguro; gestoría → VeriFactu primero.

## H3. Canales por coste/retorno
1) Red caliente + visitas presenciales a tiendas de material (Madrid). 2) Grupos WhatsApp/Facebook de gremio (auténtico, no spam) + Habitissimo/Cronoshare como fuente de pros. 3) **Gestorías** (piloto 2-3 con pack S1-H; programa formal solo con gate Y2). 4) SEO de la ola + TikTok/Reels con la demo de voz (F2: SEO-2). 5) Distribuidores de material (F2).

## H4. Plan de calle 30 días (arranca con VALIDA-0)
**S1:** 10 conversaciones discovery (Apéndice B; no vender: preguntar) + 10 visitas a tiendas (flyer QR al vídeo; trato verbal: "30 € por alta que pague"). **S2:** cerrar 3-5 founding de red caliente con onboarding white-glove (TÚ cargas catálogo y primera cotización en 30 min). **S3:** grupos de gremio + 2 referidos por founding ("1 mes gratis por compañero"). **S4:** 2 gestorías piloto + repaso de métricas y decisión.

## H5. Guiones
- **WhatsApp (frío templado):** "Hola [Nombre], soy Tu, [conexión]. Estoy montando una herramienta para [gremio] que hace una cosa muy concreta: el cliente recibe tu presupuesto por WhatsApp, lo firma con el dedo y te paga la señal antes de que empieces. Te enseño en 60 segundos cómo funciona (vídeo). A los 20 primeros os lo dejo a mitad de precio de por vida. ¿Te lo mando?"
- **Llamada (30 s):** "¿Te pillo en obra? Rápido: ¿cuántos presupuestos mandaste el mes pasado por WhatsApp? ¿Y cuántos se quedaron en visto? Eso arreglo: presupuesto que se firma solo y señal cobrada antes de empezar. ¿Te paso un vídeo de 1 minuto?"
- **Presencial:** demo en TU móvil en 90 s con cuenta demo (modo seguro): dicta → envía a tu número → firma → pago test. Cierre: "Los 20 primeros, 14,50 al mes para siempre y te lo dejo montado yo en media hora."

## H6. Objeciones → respuestas
"Ya lo hago por WhatsApp gratis" → "Exacto, por eso esto ES WhatsApp. El tuyo no firma, no cobra la señal y no persigue al moroso solo." · "Mis clientes son mayores" → "Dos botones: Firmar y Pagar. Y si no, transferencia: tú llevas el control y el PDF." · "Yo no pido señal" → "¿Cuántas veces te han anulado con el material comprado? Pruébalo en UN trabajo grande." (si abunda: dato de discovery, apuntar) · "Mi gestor me lleva todo" → "Tu gestor te hace los impuestos; esto te consigue el SÍ y la señal. Y cuando llegue lo de Hacienda en 2027, ya estás dentro." · "Hay uno a 9,99" → "El de 9,99 te hace el papel. Este te trae el dinero: firma + señal + recordatorios." · "El Kit Digital me lo da gratis" → "Lo gratis te hace facturas. ¿Te cobra la señal por WhatsApp?" · "0,9 % es mucho" → "4,5 € en una señal de 500 € por tener el dinero esa noche. Bizum y transferencia, gratis." · "No tengo tiempo de aprender" → "Te lo monto yo en 30 minutos y la primera la hacemos juntos dictando." · "¿Y si cierras?" → "Tus datos se exportan en CSV cuando quieras y las facturas son tuyas. Sin permanencia." · "Ahora no" → "¿Te aviso cuando lo de Hacienda sea obligatorio? Quédate el vídeo."

## H7. Mensajes que funcionan
"¿Cuántas señales has dejado de cobrar este mes?" · "Cobra la señal antes de descargar la furgoneta" · "El presupuesto que se firma solo" · (post-SIF) "Y cuando llegue VeriFactu, ya estás dentro".

---

# PARTE I — REGLAS (1-36; cerradas)

**Técnicas heredadas:** 1) NUNCA n8n — WhatsApp solo vía `src/integrations/whatsapp.ts` (Meta Cloud API directa). 2) Multi-tenant: toda query filtra por `req.merchantId`. 3) Prisma sin TTY: `db push`, nunca `migrate dev`; preview del diff antes de tocar prod. 4) Frontend vanilla, sin frameworks ni build. 5) Emails por Resend. 6) Crons in-process. 7) Rutas `/admin/*` con `pf_session`. 8) Demo merchant `demo@yaqu.app` id=1 (watermark, DEMO_SAFE_NUMBERS, fuera de métricas).
**Técnicas v5+:** 9) Código nuevo lee `getCountryConfig()` — nada hardcodeado por país (capa mínima en F1). 10) Todo cobro con tarjeta pasa por Connect cuando el merchant lo tenga activo. 11) Artefactos nuevos a R2 desde F2 (no fs local). 12) Ningún claim fiscal en UI/marketing que el motor del país no cumpla (LATAM sin PAC: "nota/recibo").
**Estratégicas:** 13) Prohibido replanificar antes de 25 pagantes (dudas → `docs/DECISIONES_PENDIENTES.md`). 14) Marketing mono-país hasta F3; arquitectura country-aware desde ya. 15) Una feature nueva exige matar o posponer otra (WIP limit). 16) Cada sprint cerrado actualiza este documento (mover a ✅; nunca borrar, tachar con motivo).
**Legales/claims:** 17) Ningún claim regulatorio sin su sprint legal cerrado (VeriFactu ⇒ SIF-1 + declaración). 18) Tarjeta para clientes reales SOLO con Connect activo en ese merchant; mientras, transferencia/Bizum manual. 19) VALIDA-0 no se cierra sin 10 discovery registradas y criterios de alarma evaluados. 20) Toda cifra del master lleva fuente o [VALIDAR]; lo [VALIDAR] no entra en argumentarios. 21) Partida real anual de asesoría fiscal/legal.
**Pagos/UX:** 22) El selector de pago se ordena por probabilidad de cobro del MERCHANT, no por el fee de YaQu; `paid_via` se registra en el 100 % de los cobros (card/bizum_manual/transfer/cash). 23) Prohibido procesar pagos de clientes finales en la cuenta Stripe de plataforma: PSP = cuenta conectada del merchant o nada.
**VeriFactu operativo:** 24) `INVOICING_ES_ENABLED=false` para merchants ES reales hasta SIF-1 v2 completo; facturas demo con marca de agua SIEMPRE. 25) Cobro a founding pre-SIF exige alcance por escrito (`docs/legal/ALCANCE_BETA.md`). 26) La pregunta "¿me vale para VeriFactu?" se responde SOLO con el guion H2.
**Operativos:** 27) Estados/transiciones (L) y flags (P) son CERRADOS; necesidad nueva = cambio de master antes de codificar. 28) Anti-spam J6 es regla de canal: ningún sprint añade envíos automáticos sin pasar por su tabla. 29) Una factura emitida JAMÁS se edita ni borra; solo R1 o anulación con su registro. 30) Microcopy de landing (N5) y respuestas del bot (K1) son oficiales: cambios de texto = cambio de master.
**v5.3:** 31) El Sprint Registry (U) es la cola única; Claude Code no reordena ni intercala sin cambio de master. 32) Tratamiento de anticipos (factura de anticipo/IVA) según dictamen del asesor ANTES de activar facturación de señales post-SIF. 33) Onboarding bloquea facturación ES a domicilios forales (PV/Navarra) con aviso digno; TicketBAI = cajón F3. 34) Entitlements solo vía plan→flags (W); prohibido hardcodear checks de plan en rutas. 35) `CLAUDE.md` y las skills de `.claude/` son DERIVADOS de este master; si divergen, gana `docs/YAQU_MASTER.md`. 36) Prohibido instalar plugins/skills/hooks de terceros en este repo (pagos + datos fiscales) sin revisión explícita del fundador.

---

# PARTE J — WHATSAPP COMO CANAL CORE (WA-0)

## J1. Matriz de plantillas Utility `F1-doc`
`docs/WHATSAPP_TEMPLATES.md` sigue siendo la spec canónica de ESTRUCTURA (vars, botones). Esta matriz añade el CUÁNDO y el coste; código y Meta deben coincidir EXACTO con ambas.
| Plantilla | Estado | Cuándo | Disparador | Emisor | Coste ES |
|---|---|---|---|---|---|
| `quote_decision_es` | ✅ | Envío de presupuesto + recordatorio 24h | manual + cron 1h | quotesAdmin / reminder.service | ~0,023 € |
| `payment_request_es` | ✅ | Factura lista + recordatorios 7/14d | aceptación / resend / cron 10h | invoicesAdmin / invoiceReminder | ~0,023 € |
| `payment_confirmation_es` | ✅ | Pago confirmado | webhook psp/mp | whatsappNotifications | ~0,023 € |
| `payment_confirmation_invoice_es` | ⏳ alta en Meta (usuario) | Sustituirá a la anterior con botón "Ver factura" | webhook psp/mp | builder al aprobarse | ~0,023 € |
| `merchant_alert_es` | ⏳ alta en Meta (usuario) | Notificación al PRO con ventana cerrada | decisión/pago | sendWhatsAppText* | ~0,023 € |
*Notificaciones al PRO viajan como service message si su ventana 24h está abierta (coste 0); si no, `merchant_alert_es`.
**Acciones en Meta pendientes (usuario):** URL dinámica en `quote_decision_es` (P3-1, workaround vivo) · `payment_confirmation_invoice_es` · `merchant_alert_es` · categoría Utility en las 3 existentes.
**Decisión fundador 12-jun-26 (tensión con Parte M/justificantes):** se ASUME el wording "factura" de `payment_request_es`/`payment_confirmation_es` hasta la sesión de Meta de P3-3; al recrearlas como Utility se usará copy neutro **"tu documento de cobro"** (válido para factura y justificante). Hasta entonces, merchants ES reales en modo justificante reciben el wording actual — riesgo asumido y acotado pre-SIF.

## J2. Template vs service message `F1-doc`
Service (coste 0) SOLO dentro de la ventana 24h abierta por mensaje ENTRANTE. Template Utility para todo lo iniciado por negocio fuera de ventana. En código: comprobar `lastInboundAt > now-24h` antes de texto libre; si no, plantilla o nada.

## J3. Opt-in y bajas `F1-doc + F1-build mínimo`
Opt-in: checkbox al crear cliente (texto legal; el merchant declara que el cliente le dio el teléfono para sus documentos); la primera plantilla siempre identifica al negocio. Baja: entrante "BAJA"/"STOP" → `customer.waOptOut=true` + bloqueo de envíos a ese número para ese merchant + aviso al pro. **F1-build:** campo `waOptOut` + check en `sendWhatsAppTemplate`; el procesado del entrante llega con WA-0b/BOT-1 — hasta entonces, baja manual desde ficha.

## J4. Estados de mensaje y log — WA-0b `F2-spec (early; permitido en huecos de SIF-1)`
Tabla `WhatsAppMessage {id, merchantId, customerId?, type:'template'|'service', templateName?, waMessageId, status, error?, relatedType?, relatedId?, costEstimate, createdAt}`. Estados: `queued → sent → delivered → read` | `→ failed(error)`; fuente: webhook `/webhooks/whatsapp` (rama `statuses`, activable antes que el bot). UI: chip de entrega en detalle de quote/factura.

## J5. Fallback si WhatsApp falla `F1-doc` (parcial vía P3-2 ✅)
Error Meta → 200 `ok:false` con motivo legible (hecho). Acciones SIEMPRE ofrecidas: **Copiar enlace** · **Enviar por email** · **Reintentar**. 131026 (sin WhatsApp) → "copia el enlace y mándaselo por SMS o llámale". Nunca fallo silencioso: cron que falla un envío lo registra y aparece en BO.

## J6. Anti-spam (política dura) `F1-doc`
Máx 1 recordatorio/presupuesto y 2/factura (7/14d) · mantenimientos solo con aprobación del pro y máx 1 propuesta/cliente/90d · cero Marketing, cero no-transaccional · automatismos 09:00-21:00 hora del merchant · tope duro 3 mensajes-iniciados-por-negocio/cliente/día (guard `F2-early`). Violar esto = ban del número = producto muerto.

## J7. Catálogo técnico `F1-build`
`src/integrations/whatsapp/templates.ts`: un builder por plantilla `{name, lang, buildBodyVars(ctx), buildButtonParam(ctx), expectedVarCount}` + validación de nº de vars ANTES de llamar a Meta (evita #132000); call-sites migran a builders. Test `tests/whatsapp-templates.test.mjs` compara contra `docs/WHATSAPP_TEMPLATES.md`.

## J8. Métricas de coste y entrega `F2-spec`
Por merchant/mes: enviados/entregados/leídos/fallidos + coste €; por plantilla: tasa de entrega; alerta runbook si <90 % en 7 días.

---

# PARTE K — BOT WHATSAPP ENTRANTE

## K1. BOT-1 (sin IA libre: botones y flujos cerrados) `F2-spec` · flag `BOT_INBOUND_ENABLED`
**Identidad (el número es COMPARTIDO entre merchants):** buscar teléfono entrante en `Customer`: 1 merchant → contexto fijado · varios → lista "¿Con qué negocio quieres hablar?" · ninguno → respuesta única ("Este número envía presupuestos y facturas de negocios que usan YaQu...") sin captura, fin. `BotSession {phone, merchantId?, state: menu|asking_description|asking_zone|done|handoff, data, expiresAt=+24h}`.
**Menú** (mensaje de lista; Meta limita botones a 3): 📄 Ver mis presupuestos · 💳 Pagar pendiente · 🛠 Pedir presupuesto · 💬 Hablar con [Negocio].
**Flujos:** Ver presupuestos → últimos 3 con estado + link `/pay/quote/:id` (si 0: ofrecer pedir). Pagar pendiente → charges pending + link `/pay/invoice/:chargeId` (si 0: "🎉"). Pedir presupuesto → 2 preguntas una a una ("¿Qué necesitas? Puedes mandar audio." / "¿Zona aproximada?") → `QuoteRequest {merchantId, customerId|leadPhone, description, zone, source:'whatsapp_bot'}` → WA al pro con resumen + link BO → confirmación al cliente. Hablar con [Negocio] → reenvía texto+número al pro, marca `handoff` (bot mudo 24h) y responde "✅ Avisado. [Nombre] te escribirá desde su número personal." (el pro responde desde SU WhatsApp).
**Ventana:** todas las respuestas del bot = service messages (coste 0); el bot JAMÁS inicia con plantilla.
**El bot NUNCA (BOT-1 y BOT-2):** da/negocia precios · promete plazos · modifica/acepta/rechaza presupuestos · responde dudas fiscales/legales · pide datos de pago · conversación libre (texto fuera de flujo → reenseñar menú; 2ª vez → handoff). No pide DNI, datos bancarios ni dirección exacta.

## K2. BOT-2 (IA con guardrails) `F2 tardía` · gate: BOT-1 estable 30 días + >50 conversaciones/mes
Solo en ventana de servicio · system prompt cerrado y versionado en repo · intents = los 4 flujos + FAQ del negocio (horario, zonas, oficios del perfil) · todo lo demás → handoff · prohibiciones K1 como reglas duras + filtro de salida (precios/promesas → bloquear y handoff) · logging completo · kill-switch `BOT_AI_ENABLED` por merchant · eval de 30 conversaciones antes de activar · se identifica siempre: "asistente de [Negocio] (automático)".

---

# PARTE L — STATE MACHINES OFICIALES `F1-doc · FUENTE DE VERDAD (regla 27)`

**Quote:** `draft → sent → accepted | rejected`. draft→sent: envío (timeline + recordatorio programado). sent→accepted: decisión cliente con/sin firma (evidencia ts/IP/UA/método; factura(s) según paymentTerms; WA al pro; PDF). sent→rejected: motivo+comentario persistidos; WA al pro. Terminales: accepted/rejected (acción permitida: **Duplicar** → nuevo draft; jamás reabrir). `expired` `F2` (requiere `validUntil` default 30d + cron; landing N3).
**Invoice:** `pending → paid` (paidAt, paid_via; confirmación WA/email; reseña Google si configurada) · `pending → annulled` (SOLO con registro de anulación VeriFactu post-SIF) · corrección = **R1 vinculada** (regla 29: una emitida JAMÁS se edita/borra). Deshacer un paid erróneo: SOLO si no remitida al SIF; si remitida → R1 (runbook R5).
**Charge:** `pending → paid(paid_via: card|bizum_manual|transfer|cash)` · `pending → cancelled`. paid terminal; devoluciones = entidad `Refund` F2 (V6), nunca des-pagar.
**QuoteRequest:** `new → seen → converted(quoteId) | discarded(reason)`.
**Customer:** `active → archived` (prohibido borrar con facturas → anonimizar, S4). Flag ortogonal: `waOptOut`.
**WhatsAppMessage:** `queued → sent → delivered → read` · `queued|sent → failed(error)`.
**VfSubmission:** `pending → sent → accepted` · `sent → rejected(error) → pending(retry, attempts++)` · `attempts≥5 → manual_review`. accepted terminal.
**Subscription (merchant.plan):** `trial → active(founding|pro|equipo)` · `trial → expired` (bloqueo soft) · `active → past_due → active|canceled` · `active → canceled`. Fuente: webhooks Stripe Billing; jamás cambiar plan sin evento o acción admin auditada.
**Job `F2 (Parte R · JOB-1)`:** `pendiente_agendar → agendado(scheduledAt) → en_curso → terminado → cerrado`. Auto-creación en quote→accepted; `terminado` → CTA "Cobrar el resto" si hay tramo pendiente; `cerrado` = todo cobrado o decisión del pro.
**Merchant readiness (checklist, no FSM):** `onboarded` (wizard) · `notify_ready` (whatsappPhone) · `charge_ready` (IBAN o bizumPhone o Connect activo) · `card_ready` (connectStatus=active) · `fiscal_ready_es` (legalName+NIF+dirección+serie + flag) · `selling` (≥1 quote sent). **"Lista para vender" = onboarded + ≥1 producto + notify_ready.** Enviar factura-con-cobro exige `charge_ready`.

---

# PARTE M — ONBOARDING DEL MERCHANT (ONBOARD-1) `F1-doc (wizard existe; deltas F2 salvo gates de copy)`
- **Obligatorios:** nombre negocio, país, **gremio** (selector; alimenta R3 en F2), whatsappPhone, primer producto (o saltar).
- **Opcionales (checklist Home):** logo, IBAN, bizumPhone, googleReviewUrl, datos fiscales, email.
- **Qué bloquea qué (copy claro en checklist):** Enviar presupuestos → nada extra (plantillas de plataforma; requiere teléfono del cliente). Cobro → sin `charge_ready`, modal inline "Añade tu IBAN o tu Bizum para que te puedan pagar". Tarjeta → Connect ("Activar cobros con tarjeta · 2 min, DNI e IBAN"). Facturación ES → datos fiscales completos + flag post-SIF; sin ellos el documento post-pago es **"justificante de cobro"** (sin numeración de factura, sin QR) — el copy NUNCA dice "factura". **Foral (PV/Navarra)** → facturación off + aviso TicketBAI (regla 33).
- **Demo merchant:** regla 8. **Catálogo inicial:** F1 = CSV + manual; F2 = catálogo por gremio (Parte R · ONBOARD-2).

---

# PARTE N — LANDING DEL CLIENTE FINAL `F1 (la ejecuta el bug-bash V0-5)`

## N1. `/pay/quote/:id`
Header: logo del negocio (fallback inicial sobre brand-tint) + nombre comercial/legal + "Presupuesto #N" + validez si existe. Cuerpo: líneas (solo precios de venta, JAMÁS costes/márgenes), tiers GBB si hay, total con IVA desglosado (ES), condiciones de pago en una frase humana ("Señal del 50 % al aceptar · resto al terminar") + política de señal (V8). Aceptar: canvas de firma fluido + **"Acepto sin firmar"** (checkbox + nombre tecleado); ambas guardan evidencia ts/IP/UA/método. CTA SIEMPRE verde de marca. Rechazar: dropdown motivo + comentario, persistidos tal cual. "💬 Tengo una duda" → `wa.me/<tel del PRO>?text=Hola, sobre el presupuesto %23N…`

## N2. `/pay/invoice/:chargeId`
Selector según matriz W4/pagos: ≤500 € → **Bizum + Tarjeta** botones, transferencia enlace · 500-1.000 € → Tarjeta principal, Bizum secundario · >1.000 € → Tarjeta + transferencia (Bizum oculto). Nº de factura UNA vez. Transferencia: IBAN + referencia con Copiar. Bizum manual: móvil del pro + importe + concepto copiables + "El profesional confirmará tu pago".

## N3. Estados (diseño digno SIEMPRE, jamás JSON crudo)
Pagado → recibo verde, cifra grande, "Descargar factura (PDF)" (o "justificante"), fecha/método. Aceptado ya → "Ya aceptaste este presupuesto el [fecha]" + siguiente paso. **Rechazado → "Rechazaste este presupuesto el [fecha]. ¿Has cambiado de opinión? Pídele uno nuevo a [Negocio] 👇" + botón WA** *(copy añadido por decisión del fundador 12-jun-26; implementado)*. Caducado `F2` → "Este presupuesto caducó el [fecha]. Pide uno actualizado 👇" + botón WA. No encontrado → "Este enlace no corresponde a ningún documento activo..." Error de pago/genérico → mensaje claro + Reintentar + botón duda. Cero stacktraces.

## N4. Performance
<1,5 s en 4G · HTML servido del servidor (vanilla) · sin librerías pesadas · imágenes lazy · Lighthouse móvil ≥90 · matriz de dispositivos = V0-5.

## N5. Microcopy OFICIAL (regla 30; Claude Code no inventa textos aquí)
Botones: "Firmar y aceptar" · "Acepto sin firmar" · "No me interesa" · "Pagar [importe]" · "Copiar IBAN" · "Copiar referencia" · "He pagado por Bizum" (lado pro: "Confirmar Bizum recibido"). Confirmaciones: "¡Presupuesto aceptado y firmado! [Negocio] ya tiene tu confirmación." · "Pago recibido. ¡Gracias!" Tono DESIGN.md: claro, humano, cero jerga de pasarela.

---

# PARTE O — RUNBOOKS `F1-doc → docs/RUNBOOKS.md` (formato: Síntoma → Dónde mirar → Acción → Qué decir al merchant → Prevención)
- **R1 · WhatsApp no llega:** logs Railway (+ WhatsAppMessage.status en F2). 131026 → cliente sin WA → "copia el enlace y mándaselo". #132000/132001 → bug de vars: NO reintentar, issue. Mientras: Copiar enlace.
- **R2 · Plantilla rechazada/pausada por Meta:** fallback manual (mensaje completo prearmado para el WhatsApp personal del pro); corregir/re-someter en Meta (usuario); no tocar nombres en código.
- **R3 · Pago cobrado pero webhook perdido:** Dashboard Stripe → buscar session por importe+fecha → si paid: marcar manual cobro+factura (auditado, `paid_via='card'`, nota event id). Prevención: `scripts/reconcile-stripe.mjs` `F2` + idempotencia por event.id.
- **R4 · Connect `restricted`:** banner "Stripe necesita un dato más" + link onboarding; tarjeta se desactiva sola (vuelve transfer/Bizum); avisar al merchant.
- **R5 · Bizum confirmado por error:** factura NO remitida a SIF → "Deshacer pago" (admin, auditado). Remitida → R1 + nueva factura si procede. Nunca editar la emitida.
- **R6 · Transferencia que no llega:** pending por diseño; recordatorios 7/14d actúan; reenviar datos con un toque. No marcar pagado "por confianza".
- **R7 · SIF rechaza registros:** leer `VfSubmission.lastError` → dato de factura: corregir vía R1 si emitida; estructural (XSD/firma): `SIF_ENABLED=false` + avisar asesor; la emisión local sigue y la cola remite al reanudar. Documentar en VERIFACTU_EVIDENCIAS.
- **R8 · "Abrir PDF" falla:** la ruta on-demand regenera; si re-falla → log de pdf.service; nunca enlazar pdfUrl crudo.
- **R9 · Email no llega:** Resend dashboard → bounce/spam → verificar email, reenviar; si dominio: DNS yaqu.app.
- **R10 · Anular/rectificar factura:** importe erróneo → R1; duplicado total → anulación (post-SIF con su registro). Flujo único, sin ediciones.
- **R11 · Merchant pide sus datos / se va:** export CSVs + zip PDFs `F2` + XML RRSIF (post-SIF). Plazos y anonimización: S4.
- **R12 · Rollback de flags:** tabla P; orden: apagar flag → verificar flujo legacy → comunicar. `WHATSAPP_TEMPLATES_ENABLED` global solo en incidente Meta grave.
- **R13 · "Mi cliente tiene una inspección":** entregar export XML RRSIF + facturas PDF + declaración responsable + guía de 1 página (pack gestoría S1-H).
- **R14 · Disputa de tarjeta (direct charges → cae en la cuenta del MERCHANT):** webhook `charge.dispute.created` (Connect) → aviso WA/BO + **paquete de evidencia en 1 clic**: presupuesto firmado, evidencia de aceptación (ts/IP/UA), factura, mensajes de entrega. *La firma digital es el arma anti-disputa: úsese en ventas.*

---

# PARTE P — FEATURE FLAGS `F1-doc + F1-build (lectura)` · precedencia merchant > país > env · cambios auditados
| Flag | Scope | Default | Activa | Desbloquea | Depende de | Rollback |
|---|---|---|---|---|---|---|
| `WHATSAPP_TEMPLATES_ENABLED` | global | **ON** | env | canal saliente | plantillas Approved | solo incidente grave (R12) |
| `INVOICING_ES_ENABLED` | país ES / merchant | **OFF** | admin tras SIF-1 v2 8/8 | factura fiscal ES a reales | SIF-1 + datos fiscales | seguro: vuelve a "justificante" |
| `SIF_ENABLED` | global ES | OFF | admin tras pruebas AEAT | remisión a AEAT | certificado + S1-D | seguro: cola pausa, emisión local sigue |
| `PAYMENTS_CONNECT_ENABLED` | global | OFF | admin tras CONNECT-1 | tarjeta real + fee | C1-1..C1-3 | seguro: transfer/Bizum |
| `BIZUM_MANUAL_ENABLED` | global/merchant | OFF | admin tras C1-4 | opción Bizum en landing | bizumPhone | seguro: se oculta |
| `VOICE_QUOTE_ENABLED` | global | OFF | admin tras eval VZ-2 | botón micro | eval ≥8/10 | flag off |
| `BOT_INBOUND_ENABLED` | global → merchant | OFF | admin F2 | bot K1 | webhook + WA-0b | entrantes solo log |
| `BOT_AI_ENABLED` | merchant | OFF | admin F2 tardía | IA del bot (K2) | gates K2 | kill-switch: vuelve a botones |
| `PUBLIC_PROFILE_ENABLED` | merchant | OFF | merchant opt-in F2 | /p/:slug | PERFIL-1 | 404 digno |
| `MAINTENANCE_ENABLED` | merchant | OFF | merchant opt-in F2 | planes + cron | MANT-1 | cron ignora |
Gates que NO son flags: venta fuerte/claims ⇐ SIF-1 · tarjeta real ⇐ Connect del merchant · F2 ⇐ 25 pagantes.

---

# PARTE Q — QA MAESTRO `F1-doc → docs/QA_MASTER.md` (crece por sprint)
- **E2E crítico (release blocker):** registro→onboarding→producto→quote→WA→landing→firma→factura/justificante→pago (cada método)→estados BD esperados (status, paidAt, paid_via, eventos)→confirmaciones WA/email→PDF.
- **Multi-tenant:** sesión del merchant B contra 6 rutas con IDs de A (quote, invoice, customer, charge, export, pdf) → SIEMPRE 404/403. `tests/tenancy.test.mjs`.
- **Móviles:** matriz V0-5 (Android medio, iPhone, tablet): landing + quick-quote + firma.
- **WhatsApp:** builders vs docs (test J7) · envío real a número propio por plantilla · "BAJA" respeta `waOptOut`.
- **Pagos:** tarjeta ok/declinada/abandono · **webhook duplicado** (Stripe CLI) → sin doble paid/WA (idempotencia por event.id registrada) · Connect: fee correcto en Dashboard · fallback sin Connect.
- **Bizum manual:** confirmar → cadena post-pago · deshacer (pre-SIF) limpio · doble confirmación no duplica.
- **SIF (post S1):** alta/anulación/R1 aceptadas en pruebas · rechazo forzado → retry → manual_review · `SIF_ENABLED=off` no rompe emisión.
- **PDFs:** quote firmado, factura, R1 negativa, demo watermark, regeneración on-demand.
- **Permisos:** Técnico no accede a billing/config/exports/flags (lista de rutas).
- **Idempotencia general:** todo webhook (Stripe, Connect, MP, Meta) registra provider+event_id y corta repeticiones.

---

# PARTE R — SPECS F2 (construir SOLO en su sprint del registry)
> Specs identificadas por NOMBRE de sprint. Los códigos R1-R14 son EXCLUSIVOS de los runbooks (Parte O) — no confundir.

## MANT-1 · Mantenimientos recurrentes
Casos semilla por gremio (el pro siempre edita): clima → revisión A/A pre-verano (12m), caldera pre-invierno (12m) · fontanería → termo/calentador (12m), descalcificador (6m) · electricidad → revisión cuadro (24m) · cerrajería → engrase (24m, opc.) · pintura → repaso comunidades (36m) · reformas → visita post-obra garantía (12m).
Proponer: en quote→accepted (o invoice→paid), si una línea matchea categoría mantenible del gremio → toggle "Crear recordatorio de mantenimiento" con intervalo prefijado editable. Modelo: `MaintenancePlan {merchantId, customerId, quoteId?, title, intervalMonths, nextDueAt, active}`.
Ciclo: cron diario 10h → vencidos → quote `draft` desde líneas del plan (`origin='maintenance'`) → **WA al PRO** (nunca directo al cliente): "🔧 Toca revisión de [X] de [Cliente]. ¿Enviar presupuesto de [importe]? [Aprobar y enviar] [Posponer 30d] [Cancelar plan]" → aprobar = flujo normal.
Métrica: € cobrados con `origin='maintenance'`/mes (KPI Home). Anti-spam: 1 propuesta/cliente/90d · respeta `waOptOut` · horas tranquilas · 2 rechazos seguidos → plan se pausa solo.

## PERFIL-1 · Perfil público · flag `PUBLIC_PROFILE_ENABLED`
`/p/:slug` (slug único minúsculas-guiones; lista reservada admin/api/pay/p/login…; editable 1 vez/30d). **Público:** nombre comercial, logo, gremio(s), zonas (chips), años de experiencia (opc.), botón "Pedir presupuesto por WhatsApp" (wa.me del PRO prefilled; si BOT activo, alternativa al número YaQu), link reseñas Google si `googleReviewUrl` (reseñas propias = F3), footer "Hecho con YaQu" → `?src=profile`. **NUNCA público:** precios, clientes, volumen, email, NIF, dirección exacta. **QR:** generador en BO (PNG alta res para furgoneta/tarjeta) → `/p/:slug?src=qr`. Loop medido: registros con `acquisitionSource∈{profile,qr}`.

## ONBOARD-2 · Catálogos por gremio
`data/catalogs/{fontaneria|electricidad|climatizacion|cerrajeria|pintura|reformas}.json` — 25-40 ítems/gremio: `{nombre, unidad, precioOrientativo:{min,max}, categoria, mantenible?:intervalo}`. **Regla de contenido:** precios ORIENTATIVOS etiquetados; el contenido se redacta EN EL SPRINT y se valida con 2-3 profesionales reales por gremio antes del seed — el master define estructura, no inventa 200 precios. Carga: selector de gremio → import con margen default aplicado → todo editable. Duplicar producto sí; catálogo entre merchants no. Plantillas de presupuesto frecuentes (3-5/gremio: "Cambio de termo", "Punto de luz", "Pintura piso 80 m²") → sistema de plantillas existente, seed por gremio. CSV se mantiene como vía avanzada (tarifas de distribuidor).

## JOB-1 · Trabajo mínimo — feature de DINERO, no de organización
Por qué: `terminado` es el trigger limpio del segundo tramo (V2) y el ancla de fotos/mantenimiento/asignación. Por qué mínimo: checklists, partes de trabajo y materiales = Jobber-clone → cajón F3.
Auto-creación al accepted. Estados: ver L. Campos: `scheduledAt?`, `assignedUserId?` (Equipo), `notes` internas, fotos (gate R2). UI: lista "Esta semana" (lista simple por fecha, NO calendario grid) + botón **.ics** "Añadir a mi calendario" por trabajo. NO incluye: Google Calendar OAuth (cajón F3), recordatorio de visita al cliente (F3: requeriría plantilla Meta nueva), vista mensual.

## MEDIA-1 · Foto y audio
Alcance: (a) foto de la avería adjunta a QuoteRequest (desde bot y portal); (b) audio del cliente por WhatsApp → STT → `description` del QuoteRequest [VALIDAR proveedor: Whisper/Deepgram, ~0,01 €/min]; (c) fotos antes/después ancladas a Job. Modelo: `Attachment {entityType, entityId, url, kind:'photo'|'audio', createdAt}`. Gates: credenciales R2 + `BOT_INBOUND_ENABLED` (para b). Privacidad: fotos solo de la avería/trabajo (no personas); audio se borra ≤30 días tras transcribir; retención fotos 12 meses salvo Job activo.

---

# PARTE S — SEGURIDAD, PERMISOS, AUDITORÍA Y RGPD

## S1. Roles `F1-doc (implementado; esta tabla es la verdad)`
| Capacidad | Admin | Técnico |
|---|---|---|
| Quotes/clientes/productos crear-ver · enviar WA · ver landing | ✅ | ✅ |
| Facturas: emitir/anular/R1 | ✅ | ❌ (ver sí) |
| Marcar pagado / deshacer | ✅ | ❌ |
| Configuración, datos fiscales, Connect, flags · billing/plan · equipo · exports | ✅ | ❌ |
Ruta nueva = declara rol mínimo; default Admin-only.

## S2. Audit `F1-build mínimo + F2 completo`
F1: registrar en la tabla de eventos existente `marcar_pagado_manual`, `deshacer_pago`, `anular_factura`, `cambio_flag` (con userId+ip). F2: `AuditLog{merchantId,userId,action,entityType,entityId,meta,ip,createdAt}` para login, datos fiscales, Connect onboard, export, archivado cliente, cambios de plan; vista Admin.

## S3. Seguridad técnica (reglas duras) `F1-doc`
Cookies httpOnly+Secure+SameSite=Lax · rate-limit en magic link/login · Zod en TODO input · secretos solo env · **firma verificada en TODOS los webhooks** (Stripe, Connect, MP, Meta sha256; sin firma válida = 401+log) · no PII en logs (teléfonos enmascarados) · `npm audit` en CI `F2`.

## S4. RGPD y datos `F1-doc + acciones`
Bases: ejecución de contrato (merchant); interés legítimo/relación precontractual (cliente final, SOLO transaccional). Subencargados a publicar: Railway, Stripe, Meta, Resend, Anthropic, Mercado Pago (+R2 al llegar). Privacidad + DPA antes del primer pagante (B2.4). **Retención:** facturas y registros de facturación = plazos legales mercantiles/fiscales **[confirmar con asesor]**; NO se borran ni al cancelar cuenta. **Supresión cliente final:** anonimizar (nombre→"Cliente eliminado", phone/email→null) preservando facturas; prohibido borrado físico con facturas. **Cancelación merchant:** soft 30 días (solo lectura + export) → anonimizar lo no fiscal → conservar lo fiscal. Export = CSVs + zip PDFs + XML RRSIF (post-SIF). **Backups:** verificar política Railway **[VALIDAR]** + dump cifrado semanal fuera de Railway ANTES de 25 pagantes (`scripts/backup-dump.mjs` `F2-early`).

---

# PARTE U — SPRINT REGISTRY (cola única — regla 31)

## U1. F1 (orden estricto; ∥ = en huecos de espera del anterior)
| # | Sprint | Tipo | ¿Ahora? | Depende de | Flags | Done (resumen) | Rollback |
|---|---|---|---|---|---|---|---|
| 0 | **FUSION-0** | doc | ✅ resuelto por ESTE documento — queda: guardarlo en `docs/YAQU_MASTER.md` + archivar fuentes + commit | — | — | master único en repo | restaurar histórico |
| 1 | **VALIDA-0** | build+humano | ✅ | 0 | INVOICING_ES off | E2E evidenciado + 10 discovery + ≥3 founding con alcance + vídeo | flags/fixes atómicos |
| 1b | **S1-0 humano** (FNMT + alta entorno pruebas AEAT + asesor con bundle Y3) | humano | ✅ día 1 ∥ | — | — | certificado emitido + cita asesor | n/a |
| 2 | **DOCS-F1** | doc+build-mini | ✅ ∥ | 0 | — | docs+tooling creados; builders test verde; hook bloquea `migrate dev` | aditivo |
| 3 | **SIF-1 v2** | research+build+legal | ✅ **PRIORIDAD ABSOLUTA** | 1b | SIF_ENABLED | 8/8 (S1-A..H) + factura real aceptada | SIF off (emisión local sigue) |
| 4 | **CONNECT-1** | build | ✅ solo en huecos de 3 | 1 | PAYMENTS_CONNECT, BIZUM_MANUAL | cobro real con fee + Bizum manual E2E | flags off → transfer |
| 5 | **VOZ-1** | build | ✅ tras 3 | — | VOICE_QUOTE | eval ≥8/10 + telemetría | flag off |
| 6 | **PRECIOS-1** (reducido, W3) | build | ✅ | 3 | por plan | activación facturación + 2 entitlements + precio Equipo NO listado | precios previos |
| 7 | **GTM-1 etapa 2** | build+humano | ✅ | 3 | — | landing v2 + claim legal + declaración descargable + pack gestoría + UTM | quitar claim |

### U1.1 · VALIDA-0 (tareas atómicas)
- **V0-0 · Flag de facturación ES:** `INVOICING_ES_ENABLED=false` para merchants ES reales no-demo hasta SIF-1 (flag por merchant/país). Demo conserva facturas con marca de agua "DEMO — no válida fiscalmente" en PDF y pantalla. Done: imposible emitir factura fiscal a un real. Rollback: flag.
- **V0-1 · Verificación E2E con evidencias:** ciclo completo en yaqu.app desde móvil (quote→WA→firma→justificante/factura demo→pago tarjeta TEST→estados BD: charge.paid, invoice.paid+paidAt → email Resend con PDF → WA confirmación con nº correcto → "Abrir PDF"). Fixes que salgan: uno a uno, commit por fix. Done: `docs/EVIDENCIAS_E2E.md` con capturas/IDs + screen-record sin un solo fallo. **✅ DONE 11-jun-26:** automatizado (9 pasos en prod, `EVIDENCIAS_E2E.md` + `docs/evidencias/`) con 3 fixes cazados (P1-8 facturas sin lines `59ce535` · P1-9 not-found indigno `0408155` · P2-4 microcopy N5 `e80a825`) + ciclo completo desde móvil confirmado por el fundador (Meta en PRODUCCIÓN, webhooks OK; screen-record en su custodia).
- **V0-2 · Modo demo seguro:** `DEMO_SAFE_NUMBERS` en env; si merchant demo y destino ∉ lista → bloquear y loguear. Done: imposible spamear desde demo. Rollback: quitar guard. **✅ DONE 12-jun-26** (`00da376`): guard central en plantillas Y textos (`whatsappPolicy.ts`, lista vacía = bloquea todo), tests 5/5. ⏳ Falta `DEMO_SAFE_NUMBERS` en Railway (PENDIENTES_FUNDADOR).
- **V0-3 · Funnel mínimo:** eventos registro→1ª quote→sent→accepted→cobrada con `acquisitionSource` (UTM), `paid_via`, `quote_created_via`. Vista simple en BO. Done: funnel de un merchant test legible. Rollback: revert del commit (hooks aditivos). **✅ DONE 12-jun-26** (`343d30b`): columnas aditivas `merchants.acquisition_source` + `quotes.created_via` (db push autorizado), captura UTM/ref en registro, `paid_via` = `charge.method` (ya se fijaba al pagar), funnel de plataforma SOLO owner en Informes (`/admin/metrics/platform-funnel`).
- **V0-4 · Página de precios + founding:** UNA tarjeta (Pro 29/290) + banner founding 14,50 de por vida con contador real (var en BD, sin fake). Stripe prices: PRO, PRO_ANNUAL, FOUNDING (+ EQUIPO creado, no listado). Done: un founding puede pagar hoy y `merchant.plan` se actualiza por webhook. Rollback: ocultar página. **🟡 CASI DONE 12-jun-26** (`90d9ed8`): `/precios` pública (W1, sin claims fiscales) + banner founding con contador real (count plan='founding') + checkout founding con gate de plazas + plansView 29/290 €; el webhook ya mapeaba metadata.plan. **Falta SOLO ejecutar `scripts/setup-stripe-prices.mjs`** (stop condition dinero — PENDIENTES_FUNDADOR) para que el pago founding funcione.
- **V0-5 · Bug-bash landing cliente:** /pay/quote y /pay/invoice en 3 dispositivos reales (Android gama media, iPhone, tablet) contra la spec N. Done: `docs/BUG_BASH_LANDING.md` todo ✅; fallos → BUGS.md P0-percepción y se arreglan antes de grabar.
- **V0-6 (HUMANO) · Calle:** lista 30 contactos (sheet) · **10 discovery registradas (Apéndice B) — sin esto el sprint NO cierra (regla 19)** · vídeo 60 s (guion: 0-8s "¿Cuántas señales has dejado de cobrar este mes?" → 8-25s dictado/creación en la furgoneta → 25-40s al cliente le llega el WA, abre, firma → 40-52s paga la señal; al pro: "💰 García te ha pagado 450 €" → 52-60s "YaQu. Cobra antes de empezar." + precio; la factura solo con marca de agua, cero claims fiscales) · 10 visitas a tiendas. **Founding:** cobrables YA con alcance por escrito (`docs/legal/ALCANCE_BETA.md`: "presupuestos+firma+cobro; la facturación VeriFactu se activa al cerrar la certificación, sin cambio de precio"); alternativa conservadora: reserva firmada sin cargo. **NO TOCAR antes de grabar:** countries completa, R2, SEO, refactors, nada fuera del camino de la demo. Done sprint: vídeo + 10 discovery + ≥3 founding cobrados-con-alcance (o reservas) + criterios de alarma evaluados.

### U1.2 · DOCS-F1
J7 builders+test · `waOptOut` + check · `docs/RUNBOOKS.md` (O) · `docs/QA_MASTER.md` (Q) · lectura de flags (P) · **CLAUDE.md + skills `/yaqu-sprint`, `/yaqu-release-check` y `yaqu-premium-ui` + hook anti-comandos-peligrosos (AA2)** · **UI-0:** instalar skill oficial `frontend-design` de Anthropic con revisión del fundador (AB7) · check manifest PWA (Y1). Todo aditivo; una tarea-un commit.

### U1.3 · SIF-1 v2 — "VeriFactu cerrado al 100 %" = las 8 obligatorias
- **S1-0 (HUMANO):** certificado FNMT + alta entorno pruebas AEAT + cita asesor (bundle Y3).
- **S1-0b · Investigación (1-2 días, entregable obligatorio):** spec técnica AEAT (servicio web, XSD, firma) + decidir librería XAdES en Node **[VALIDAR; si el ecosistema Node es débil, microservicio mínimo Java/.NET SOLO para la firma — excepción justificada]** → `docs/SIF_SPEC_NOTES.md` + crear skill `.claude/skills/yaqu-verifactu-sif/SKILL.md`. **✅ DONE 12-jun-26:** resuelto el [VALIDAR] con fuentes AEAT — en modalidad VERI*FACTU **NO se exige XAdES** (solo en no-VERI*FACTU): 100 % Node con mTLS nativo, sin microservicio. Endpoints prod/pruebas, XSDs, flujo de control (TiempoEsperaEnvio ≥60 s, máx 1.000 reg/envío) y estados de respuesta documentados en SIF_SPEC_NOTES.md; skill creada.
- **S1-A · Auditoría de conformidad de lo YA construido** contra la Orden HAC/1177/2024: campos/orden/formato exactos de la huella SHA-256, URL de cotejo oficial del QR, leyenda. Si no casa → se regenera. Entregable: `docs/AUDITORIA_RRSIF.md` (diff spec↔código). **✅ DONE 12-jun-26:** 3 no conformidades encontradas y REGENERADAS (cadena de huella a formato oficial `campo=valor&`, primer registro con huella VACÍA, FechaHoraHuso ISO con huso; leyenda literal en PDF). Conformidad demostrada: el **vector de prueba oficial AEAT pasa** en `tests/verifactu.test.mjs`. QR ya era conforme. Hallazgos del export XML asignados a S1-C (persistir vf_timestamp, RegistroAnterior completo, SistemaInformatico, anulación).
- **S1-B · Modalidad documentada:** YaQu opera como SIF en modalidad **VERI*FACTU (remisión)** (evita firma por registro y registro de eventos del modo no-remisión). Permanencia en la modalidad el año natural. **✅ DONE 12-jun-26:** documentada en `docs/SIF_SPEC_NOTES.md` §1 y blindada en la skill `yaqu-verifactu-sif` (prohíbe XAdES/EventosSIF; `TipoUsoPosibleSoloVerifactu=S`).
- **S1-C · Registros completos:** alta + **anulación + R1** generados y validados contra XSD oficial. **✅ DONE 12-jun-26** (`registro.builder.ts` + XSDs vendorizados): alta F1, R1 (TipoRectificativa I + FacturasRectificadas) y anulación con huellas reales encadenadas **VALIDADOS contra SuministroLR.xsd con .NET** (`scripts/gen-registros-sample.mjs` + `validate-registros-xsd.ps1`); huella de anulación implementada [VALIDAR vector en pruebas]. Pendiente para S1-D: cablear a facturas reales + persistir `vf_timestamp` (columna aditiva) + datos reales del productor (PENDIENTES_FUNDADOR). ⚠️ Hallazgo: F1 exige NIF del destinatario — no lo capturamos (decisión asesor: NIF en ficha vs F2 ≤400 €).
- **S1-D · Envío en pruebas AEAT:** `src/modules/fiscal/verifactu/sif.client.ts` + cola `VfSubmission {invoiceId,status,attempts,lastError}` + retry backoff + incidencias/subsanación + logs legibles. Done: ≥10 registros (alta/anulación/R1) aceptados consecutivos.
- **S1-E · Declaración responsable REAL** (art. 13 RRSIF: nombre del SIF, versión, componentes, productor y NIF, fecha, conformidad), **versionada por release**, publicada visible y entregable a cada merchant. **🟡 BORRADOR 13-jun-26:** plantilla con placeholders en `docs/legal/DECLARACION_RESPONSABLE.md` (fiel al art. 13, coherente con el bloque `SistemaInformatico` de los registros S1-C). Falta: datos reales del productor (B2 del one-pager), revisión del asesor (C5/C6) y publicación en UI (`yaqu.app/legal/declaracion-responsable` + descarga desde Configuración) — esto último solo tras 8/8.
- **S1-F · Revisión fiscal externa** (300-600 €) de declaración + alcance + **anticipos/IVA (V3)**. Entregable: conformidad archivada.
- **S1-G · Evidencias:** `docs/VERIFACTU_EVIDENCIAS.md` (capturas, IDs, fechas) + paso a PRODUCCIÓN AEAT con ≥1 factura real remitida y aceptada.
- **S1-H · Pack gestoría:** one-pager técnico (modalidad, declaración, funcionamiento, qué pedirle al cliente). **🟡 BORRADOR 13-jun-26:** `docs/legal/PACK_GESTORIA.md` (modalidad VERI*FACTU, conformidad, funcionamiento, datos a pedir, export R13, qué NO sustituye). Falta: datos del productor, política F1/F2 y revisión del asesor. Distribución solo tras 8/8.
**Solo con 8/8 ✅:** claim VeriFactu + `INVOICING_ES_ENABLED` a reales + GTM-1 etapa 2.

### U1.4 · CONNECT-1
- **C1-0:** flags/env (`PAYMENTS_CONNECT_ENABLED`, `APPLICATION_FEE_BPS=90`, `STRIPE_CONNECT_WEBHOOK_SECRET`) + Prisma aditivo `merchant.stripeAccountId`, `merchant.connectStatus('none'|'pending'|'active'|'restricted')` (preview diff). 
- **C1-1 · Onboarding Express:** `POST /admin/connect/onboard` (accounts.create type express + Account Link) · `GET /admin/connect/return|refresh` · webhook `account.updated` → connectStatus por `charges_enabled` · card "Cobros" en Configuración ("2 min, DNI e IBAN"). Done: merchant test completa KYC. Rollback: flag off.
- **C1-2 · DIRECT charge:** si `connectStatus='active'` → Checkout Session **sobre la cuenta conectada** (`{stripeAccount}`) con `payment_intent_data.application_fee_amount = round(amount*FEE_BPS/10000)`; si no → tarjeta deshabilitada para reales (transfer/Bizum) salvo demo. **CRÍTICO:** endpoint de webhooks Connect separado, mapear `metadata.chargeId`, NO romper la cadena factura→paid. Done: pago test reparte fondos al merchant y fee a plataforma; refund de prueba documentado en `docs/RUNBOOK_PAGOS.md`. Rollback: flag off.
- **C1-3 · Transparencia:** copy 0,9 % en precios y Configuración + export CSV mensual de fees (contabilidad propia).
- **C1-4 · Bizum manual asistido:** opción "Pagar por Bizum" sin PSP: móvil del merchant (`merchant.bizumPhone`, default whatsappPhone editable) + importe + concepto copiables; el merchant confirma con DOBLE toque ("¿Has recibido 450 € de García en tu Bizum?") → `charge.paid` + `paid_via='bizum_manual'` → misma cadena post-pago. Probar con Bizum real entre dos móviles propios. Riesgo asumido: confirmación declarativa (como efectivo). Rollback: `BIZUM_MANUAL_ENABLED` off.
- **C1-5 · Selector de pago (matriz N2/W4)** testeado en los 3 dispositivos del bug-bash.

### U1.5 · VOZ-1
- **VZ-1 · Captura:** `public/dashboard/js/voiceInput.js` (webkitSpeechRecognition, lang del locale) en Quick Quote y formulario; transcript a textarea SIEMPRE editable; sin soporte (iOS errático: probar) → solo textarea/ocultar micro. Matriz en `docs/VOZ_MATRIX.md` (Chrome Android x2, desktop, Safari iOS; micro/permisos/https/ruido).
- **VZ-2 · Pipe + eval:** texto → endpoint `ai/suggest-quote` (prompt ajustado a habla coloquial de obra: "ponme dos puntos de luz y la manguera esa de 20"); líneas propuestas cargadas con match de catálogo. `scripts/voice-eval.mjs` con 10 transcripciones fijas → **≥8/10 con ≥80 % de líneas correctas** (resultados en repo).
- **VZ-3 · Telemetría:** evento `quote_created_via='voice'|'text'`. Rollback: dictado sirve como texto aunque la IA se apague (flag).

### U1.6 · PRECIOS-1 (reducido, ver W3) · U1.7 · GTM-1 etapa 2
PRECIOS-1: activar facturación a founding (post-SIF) + límite usuarios + contador fair-use WA + verificación upgrade/downgrade. GTM-1: landing yaqu.app v2 (héroe promesa de cobro, vídeo, 3 pasos, precios, FAQ 10 reales, CTA; Lighthouse móvil ≥90) + claim VeriFactu YA legal + declaración descargable + pack gestoría circulando + UTM/atribución en registro. SEO programático y calculadora de sanción → F2 (SEO-2, contenido para gestorías).

## U2. F2 (backlog ordenado por defecto; gate global 25 pagantes)
WA-0b → BOT-1 → MANT-1 → JOB-1 → MEDIA-1 → ONBOARD-2 → ANALYTICS-1 (X2) → **DASH-PREMIUM-1** (pulido del dashboard pantalla a pantalla según Parte AB; nunca rediseño total) → PERFIL-1 → PARTNERS-1 (gate Y2) → SEO-2 → SEC-2 (audit completo + `backup-dump` + `reconcile-stripe` + export-zip) → validUntil/expired → APP-1 (gate >100 pagantes) → FIN-1 (gate Z) → BOT-2 (gates K2). BIZUM-WATCH = recurrente trimestral (sep-26, dic-26, mar-27: si Stripe Bizum gana Connect support → activar + test fee).
**Nota:** U2 NO es compromiso: al alcanzar 25 pagantes se re-prioriza con los datos de F1 (regla 13) antes de abrir el primer sprint F2.

## U3. F3 / F4
F3: LATAM-1 (i18n MX/CO end-to-end, MP/SPEI/PSE, sin claim de factura, plantillas por locale re-aprobadas) · CFDI-1 (PAC add-on) · DIAN-1 · Chile · IA precios por zona (gate ≥10K líneas) · reseñas en plataforma · Google Calendar OAuth · API pública (gate Z) · TicketBAI (gate Z). F4: Parte Z.

---

# PARTE V — MONEY FLOWS `F1-doc · piezas build en F2`
**V1. Esquemas:** F1 = 100 % y 50/50. Hitos N tramos = F2-spec ligado a JOB-1 (cada hito = charge; trigger manual del pro).
**V2. Trigger del segundo tramo:** **[VERIFICAR comportamiento actual en código]**. Regla: el resto NUNCA se cobra solo; trigger = acción del pro ("Trabajo terminado → Cobrar resto"; con JOB-1: estado `terminado`) → cobro/factura del resto + payment_request.
**V3. Anticipos [VALIDAR asesor en S1-F]:** señal con factura = **factura de anticipo con IVA**; la final descuenta el anticipo. Pre-SIF: señal con recibo no fiscal (coherente con flag). Post-SIF: implementar el dictamen (regla 32).
**V4. Pago parcial:** F1 = NO automático (pending + decisión del pro, runbook). F2 = `amountReceived` + estado `partial` si los datos lo piden.
**V5. Sobrepago:** nota + devolución manual de la diferencia; F2 con Refund.
**V6. Refund (F2):** `Refund {chargeId, amount, method, reason, status:'pending'|'done'|'failed'}`. Tarjeta = Stripe refund en cuenta conectada; Bizum/transfer = manual. Factura emitida → **R1 parcial** (regla 29). Jamás des-pagar el charge.
**V7. Disputas (direct charges → cuenta del MERCHANT):** webhook `charge.dispute.created` → aviso + paquete de evidencia en 1 clic (runbook R14). La firma digital gana disputas → argumento de venta.
**V8. Cancelación tras señal:** default "la señal no es reembolsable" (configurable), visible en la landing junto a condiciones. Si devuelve → V6 (+R1 si facturada).
**V9. Referencias:** Bizum erróneo R5 · transferencia tardía R6 · webhook perdido R3 · idempotencia Q.

---

# PARTE W — PACKAGING & ENTITLEMENTS `F1-doc · se implementa en PRECIOS-1 (regla 34)`
**W1. Estructura comercial:** UN plan público — **"YaQu Pro — 29 €/mes (o 290 €/año) + 0,9 % solo cuando cobras con tarjeta. Todo incluido."** Founding = banner sobre Pro (29 tachado → **14,50 €/mes de por vida**, 20 plazas, contador real). **Equipo NO público en F1:** oferta manual 59 €/mes (hasta 5 usuarios, aprobaciones/asignación — ya existen); precio en Stripe no listado; se publica en F2 con equipos reales. Tercer plan visible: nunca antes de 300 pagantes. **Sin Starter** (ancla contra el 9,99 limitado y castiga el uso que queremos). **Sin add-ons hasta F3** (CFDI €/timbre, usuarios extra, BOT-2 IA). **Take rate plano 0,9 %**, comunicado como ventaja ("Bizum y transferencia, gratis"). Demo 60 s: "29 al mes todo incluido, 0,9 % solo si cobras con tarjeta, y a los 20 primeros, mitad de precio para siempre."
**W2. Pro incluye TODO (nada se capa):** presupuestos/facturas/clientes ilimitados · WhatsApp fair use soft 300 plantillas/mes (aviso, nunca corte) · voz · firma+evidencia+GBB+recordatorios · facturación ES VeriFactu (post-SIF) · cobros todos los métodos · mantenimientos (F2) · perfil+QR (F2) · **BOT-1 incluido para todos cuando llegue** (BOT-2 IA = Equipo/add-on F3, con costes reales) · exportaciones (RGPD: siempre) · soporte email+WA. Equipo añade: 5 usuarios, aprobaciones/asignación, fair use 1.000, soporte prioritario.
**W3. Entitlements a IMPLEMENTAR — solo dos:** límite de usuarios (1 Pro / 5 Equipo manual) + contador fair-use WA (soft). Todo lo demás = incluido = cero checks.
**W4. Selector de pago (referencia de N2):** ≤500 € → Bizum + Tarjeta (botones), transferencia (enlace) · 500-1.000 € → Tarjeta principal · >1.000 € → Tarjeta + transferencia (Bizum oculto por límites bancarios del pagador: 500-1.000 €/op según banco, 2.000 €/día).

---

# PARTE X — DECISIONES IA/MEDIA Y ANALYTICS

## X1. Matriz de decisión (cerrada)
| Feature | Decisión | Fase | Gate |
|---|---|---|---|
| VOZ-1 dictado→presupuesto | ✅ | F1 (U1 #5) | eval ≥8/10 |
| IA mejora mensajes WA | ✅ YA EXISTE | — | — |
| BOT-1 botones | ✅ (K1) | F2 | WA-0b |
| BOT-2 IA guardrails | ✅ (K2) | F2 tardía | K2 |
| Foto avería → QuoteRequest |  ✅ (Parte R · MEDIA-1) | F2 | R2 |
| Audio cliente → STT → QuoteRequest | ✅ (Parte R · MEDIA-1; en España se mandan audios) | F2 | BOT + STT [VALIDAR] |
| Fotos antes/después | ✅ (Parte R · MEDIA-1, ancla Job) | F2 | R2 |
| Foto → sugerir líneas (visión) | ⏸ cajón | F3 | VOZ >40 % de quotes + 100 pagantes |
| OCR ticket gasto | ⏸ cajón | F4 | ≥30 % usan gastos manual |
| IA precios por zona | ⏸ | F3 | ≥10K líneas propias |
| IA "detecta" mantenimientos | ❌ DESCARTADA | — | MANT-1 ya lo hace con reglas |
| Agenda standalone / Google Calendar OAuth | ❌ / cajón F3 | — | JOB-1 (lista semanal + .ics) cubre; OAuth si ≥30 % lo piden |

## X2. ANALYTICS-1 `F2-spec` (F1 intocable: 3 KPIs + % plataforma + funnel)
F2: tasa de aceptación · tiempo medio hasta decisión · cobros por método (paid_via) · **€ generados por recordatorios** (atribución: pago ≤72h tras recordatorio) · € por mantenimiento (origin) · top servicios · "facturas antiguas pendientes" (por antigüedad; NO se llama "morosos"). F3: comparativas por zona. Sobran: gráficas complejas, cohortes, BI.

---

# PARTE Y — MICRO-SECCIONES

## Y1. PWA-0 `F1-doc + build trivial F2-early`
**[VERIFICAR en repo]** manifest + service worker + iconos. Banner A2HS una sola vez tras el primer presupuesto enviado ("Añade YaQu a tu pantalla de inicio"). Offline = solo shell + aviso (NUNCA edición offline). **Push web = ❌: WhatsApp ES el push de YaQu.** Wrapper Capacitor = APP-1, gate >100 pagantes.

## Y2. PARTNERS-0 `F1-doc (operativa manual)` → PARTNERS-1 `F2 con gate`
F1: enlaces `yaqu.app/?ref=<slug>` → `acquisitionSource` · sheet de partners (tienda/gestoría, acuerdo, altas) · comisión manual registrada · 2-3 gestorías piloto con pack S1-H · tiendas: trato verbal simple ("30 € por alta que pague"). **Gate del panel partner:** ≥10 pagantes vía partners O 3 partners activos pidiéndolo. Antes: cero código.

## Y3. Legal extra `F1-doc + encargo único al asesor`
**Bundle [VALIDAR todo con él]:** declaración responsable (S1-E) · Términos del SaaS con límites de responsabilidad (merchant responde de la veracidad de los datos de sus facturas; YaQu de la conformidad técnica del SIF) · **condiciones económicas en los ToS** (suscripción, take rate 0,9 % en tarjeta, relación Stripe Connect, merchant-of-record del profesional) · **anticipos/IVA** (V3) · privacidad + DPA + cookies (banner mínimo: solo técnicas first-party) · plazos de conservación (S4). Runbooks asociados: R13 (inspección), R14 (disputa).

---

# PARTE Z — NO CONSTRUIR (con gate de revisión)
| Item | Estado | Se revisa cuando… |
|---|---|---|
| App nativa completa | ❌ horizonte actual | APP-1 wrapper cubre (gate 100 pagantes) |
| Marketplace / derivación entre gremios | Cajón F4 | ≥2.000 merchants activos |
| Contabilidad completa (libros, 303/130 presentación) | ❌ nunca | exports al gestor; jamás competir con gestorías (son canal) |
| OCR de gastos | Cajón F4 | ≥30 % usan gastos manual |
| Open Banking / conciliación | Cajón F4 | ≥500 pagantes ES |
| Financiación "paga en 3" (FIN-1) | F2 tardía (U2) | ticket medio ≥1.200 € + volumen Connect |
| Microfactoring de señales | Cajón F4 | capital + 12 meses de datos de impago |
| Seguros de impago | Cajón F4 | partner asegurador + volumen |
| White label | ❌ F1-F3 | ≥3 peticiones enterprise pagando |
| API pública | Cajón F3 | ≥3 clientes pagantes pidiendo integración concreta |
| Multi-país activo (marketing) | F3 (regla 14) | 300 pagantes ES |
| IA conversacional libre | ❌ (BOT-2 es la vía) | gates K2 |
| CRM con pipeline | ❌ nunca | QuoteRequest + ficha 360 bastan |
| TicketBAI foral | Cajón F3 | ≥25 solicitudes forales |
| Google Calendar OAuth | Cajón F3 | ≥30 % lo piden / adopción Equipo |
| Verticales fuera de hogar/oficios · React/reescritura front · n8n | ❌ nunca | — |

---

# PARTE AA — CLAUDE CODE OPERATING SYSTEM `F1-doc (canónico aquí; CLAUDE.md lo implementa — regla 35)`

## AA1. Protocolo de sesión (obligatorio)
1. Leer `CLAUDE.md` (auto) → abrir `docs/YAQU_MASTER.md` → localizar el **sprint activo en U**. Duda → preguntar, nunca asumir.
2. Una tarea → un commit → push. Plan de archivos ANTES de tocar código (skill `/yaqu-sprint`).
3. Tests relevantes en verde antes de commit; verificación en **yaqu.app** (no localhost) antes de cerrar tarea.
4. **Stop conditions — parar y pedir OK del fundador si la tarea toca:** claims fiscales/VeriFactu · dinero real o flujo de cobro en producción · plantillas/categoría de Meta · cambios de schema no aditivos · datos de clientes (export/borrado) · flags de P a nivel global.
5. Prohibido inventar estados, transiciones, flags o textos de landing/bot (L, P, N5, K1; reglas 27 y 30). Necesidad nueva = propuesta de cambio de master.
6. Bugs → `docs/BUGS.md` con el formato existente; nada de arreglos "de paso" sin registrar.
7. Cierre de sprint: `/yaqu-release-check` (QA del sprint + docs actualizados + done/evidencias en U) y actualizar el master (✅, nunca borrar).
8. Producción: deploy = push a main. Nada destructivo contra la BD de prod sin preview del diff y confirmación (hook AA2).

## AA2. Artefactos de tooling (se crean en DOCS-F1)
```
CLAUDE.md                          ← constitución (~100 líneas): puntero a este master,
                                      10 reglas duras, protocolo AA1, stop conditions
.claude/
  settings.json                    ← hooks
  hooks/guard-dangerous.sh         ← PreToolUse: bloquea `prisma migrate dev`,
                                      `db push` sin preview confirmado, `--force`,
                                      `rm -rf` fuera del workspace
  skills/
    yaqu-sprint/SKILL.md           ← /yaqu-sprint: registry → sprint activo → plan →
                                      OK → UNA tarea → done/rollback
    yaqu-release-check/SKILL.md    ← /yaqu-release-check: cierre de sprint (AA1.7)
    yaqu-verifactu-sif/SKILL.md    ← se crea en S1-0b
    yaqu-payments/SKILL.md         ← se crea en CONNECT-1
    yaqu-premium-ui/SKILL.md       ← se crea en DOCS-F1 (UI-0): obliga a leer DESIGN.md +
                                      Parte AB antes de tocar UI; checklist visual AB6;
                                      una pantalla/componente por cambio, jamás rediseño total
```
Nota de plataforma: los slash commands personalizados están fusionados con las skills; `.claude/skills/` es la vía recomendada (una skill homónima tiene precedencia sobre un command).
**Descartado con motivo:** skills "guardian"/"executor" autónomas (es protocolo → CLAUDE.md) · skill de WhatsApp (test J7 + RUNBOOKS, determinista) · skill de QA aparte (es `/yaqu-release-check`) · skill de Prisma (es un hook) · subagents (sin valor para trabajo secuencial de un founder; revisar F2) · plugins de terceros (regla 36).

---

# PARTE AB — PREMIUM UI / DESIGN SYSTEM `F1-doc (UI-0 = esta parte + skill; el build grande es F2)`

## AB1. Principios visuales
Premium, simple, cálido, rápido. Claridad de Stripe + confianza de Wise (la doctrina de DESIGN.md: "el recibo de confianza"). Mobile-first REAL (pulgar, obra, pleno sol). **Todo gira alrededor del dinero en juego**: presupuesto, señal, cobro, factura, pendiente — el producto parece caro cuando habla del dinero del usuario, no de sus features. Prohibido el aspecto de panel-admin genérico / Bootstrap / "hecho por IA".

## AB2. Design tokens
**DESIGN.md es la ÚNICA fuente de tokens** (colores incl. semánticos y de estado, tipografía Inter con su jerarquía, radios, sombras Reposo/Elevado/Flotante/Foco, spacing, status pills). PROHIBIDO inventar colores, fuentes o sombras nuevas. Si falta un token (p. ej. iconografía, skeleton, motion): derivarlo de los existentes y **proponerlo como cambio a DESIGN.md [VALIDAR CON DESIGN.md]** antes de usarlo en más de una pantalla. Motion: sobrio, ≤200 ms, siempre con `prefers-reduced-motion`. Iconografía: un solo set lineal coherente [VALIDAR: definir set en UI-0; sin dependencias pesadas].

## AB3. Inventario de componentes base (reutilizar SIEMPRE; componente nuevo = añadirlo aquí)
Botón primario/secundario/ghost/danger (DESIGN.md) · card y KPI-card · tabla→cards apiladas en móvil · modal y drawer · banner/aviso · chips de estado de quote/invoice (status pills DESIGN.md) · chip de entrega WhatsApp (J4) · input/select/textarea con label y error · upload de foto (F2) · empty state (ilustración ligera + 1 frase + CTA primario) · skeleton/loading (en cargas >300 ms) · toast · timeline de documento · selector de método de pago (N2/W4) · contador founding. Regla: **cero estilos inline aleatorios**; clases/tokens compartidos.

## AB4. Sensación por pantalla (dashboard)
**Home:** "dinero en juego" arriba (Parte E), 3 KPIs, acciones rápidas (Nueva cotización gigante). **Quick Quote:** <30 s, una columna, autocomplete del catálogo, micro de voz, cero campos opcionales visibles. **Lista de presupuestos:** orientada a estado/dinero (pills + importes en Tinta ≥700), filtrable, cards en móvil. **Detalle:** timeline + estado + UN CTA primario verde + secundarias discretas (Duplicar, PDF, Recordar). **Facturas/cobros:** lo pendiente de cobrar PRIMERO, antigüedad visible. **Clientes:** ficha simple — deuda/pagos/presupuestos, historial (ENT-3), cero CRM. **Catálogo:** usable, no ERP: buscar, crear rápido, importar. **Configuración:** checklist de readiness (M) con estados claros — Connect, fiscal, WhatsApp, Bizum/IBAN. **Onboarding:** 3 pasos visuales, nunca formulario largo. **Estados vacíos:** siempre enseñan la acción primaria ("Crea tu primera cotización en 30 segundos"). **Errores:** dignos, accionables, cero stacktraces. 

## AB5. Landing comercial (estructura premium para GTM-1)
Héroe con la promesa de cobro ("¿Cuántas señales has dejado de cobrar este mes?") → vídeo 60 s → 3 pasos → dolor/prueba social founding → precio único (W1) → FAQ (10 reales) → CTA. **Sección VeriFactu: SOLO post-SIF**, o pre-SIF únicamente con el wording del guion H2. Performance: Lighthouse móvil ≥90.

## AB6. Reglas técnicas + QA visual
Vanilla, sin React/Tailwind/build, sin dependencias pesadas, sin reescritura: **cambios por pantalla/componente, JAMÁS "rediseño total" de golpe**. Accesibilidad básica: contraste AA, focus visible (anillo Foco), labels, targets ≥44 px, aria donde aplique. QA visual por cambio: capturas antes/después · matriz Android/iPhone/tablet (V0-5) · empty/error/loading · textos largos · importes grandes (9.999,99 €) · merchant sin logo · cliente sin WhatsApp · modo demo con watermark.

## AB7. Fases y skills
**UI-0 (F1-doc, dentro de DOCS-F1):** esta parte + crear `.claude/skills/yaqu-premium-ui/SKILL.md` + instalar la skill oficial **`frontend-design` de Anthropic** (repo anthropics/claude-code) **con revisión del fundador — excepción documentada y permitida de la regla 36 por ser primera parte (Anthropic), no un tercero**. **Jerarquía vinculante: DESIGN.md + Parte AB > `yaqu-premium-ui` > `frontend-design` oficial** — la oficial aporta técnica y ambición estética; la nuestra impone tokens, vanilla y dinero-primero; si chocan, gana la nuestra. **V0-5** sigue puliendo SOLO la landing del cliente. **GTM-1** construye la landing comercial (AB5). **DASH-PREMIUM-1 (F2, post-25 pagantes):** pulido del dashboard pantalla a pantalla según AB4 — salvo mejoras pequeñas imprescindibles para la demo, nada del dashboard compite con SIF-1 en F1.

---

# APÉNDICE A — CLAIMS Y FUENTES (regla 20: cifra con fuente o [VALIDAR]; lo [VALIDAR] no entra en ventas)
| Claim | Estado | Fuente / acción |
|---|---|---|
| VeriFactu: 1/1/2027 sociedades, 1/7/2027 autónomos | ✅ | RD-ley 15/2025 (BOE 3-dic-2025) · ya hubo UN aplazamiento → no apostar todo el GTM a la fecha |
| Productor: solo software adaptado desde 29-jul-2025 (fecha mantenida por RDL 15/2025) | ✅ | AEAT FAQ + Orden HAC/1177/2024 (regla 9 meses) |
| Sanciones: usuario 50.000 €/ej · fabricante 150.000 €/ej y tipo · 1.000 €/sistema sin declaración | ✅ | Art. 201 bis LGT + FAQ AEAT |
| Exclusiones: módulos, recargo equivalencia, forales, SII | ✅ | RD 1007/2023 |
| ~426K autónomos construcción (12,4 % de 3,44 M) | ✅ sector / subset obligado **[VALIDAR: 150-300K]** | MITES/SegSoc oct-2025 |
| Tolteck cerró ES y deriva a Billin | ✅ | tolteck.com/es-es |
| PresuNow sin cobro integrado / sin WA API nativa | **[VALIDAR con trial]** | su web (inferido) |
| PresupuestAPP 9,99 €/15 presupuestos | **[VALIDAR]** | fuente secundaria única |
| Stripe Bizum: Checkout/Links/refunds/disputas SÍ · **Connect NO** | ✅ (10-jun) | docs.stripe.com/payments/bizum → BIZUM-WATCH trimestral |
| Límites Bizum: 500-1.000 €/op según banco · 2.000 €/día · 60 recepciones/mes | ✅ | Stripe/Openbank + bancos |
| WhatsApp utility ES ~0,025 $/msg · servicio en ventana 24h gratis | ✅ | tarifas Meta 2026 |
| Volumen vía plataforma 1.200 €/merchant/mes · adopción 40-60 % | **[SUPUESTO → discovery + telemetría]** | variable del modelo dual |
| Gestorías como canal masivo | **[VALIDAR piloto 2-3]** | — |
| CFDI/PAC, DIAN, informalidad oficios MX 95-99 % | ✅ | SAT/DataMéxico/Alegra (research 10-jun) |
| ServiceTitan ~$9-10B cap · Jobber ~$150M ARR (prueba de categoría) | ✅ | NASDAQ/prensa 2024-25 |

# APÉNDICE B — DISCOVERY: 30 PREGUNTAS (10 mínimo antes de cerrar VALIDA-0; registrar en sheet)
**Contexto:** 1) ¿Qué haces y desde cuándo? 2) ¿Solo o con cuánta gente? 3) ¿Trabajos/mes? 4) ¿Ticket típico y el mayor del año? 5) ¿De dónde llegan los clientes?
**Presupuesto hoy:** 6) Enséñame el último que mandaste (que lo ENSEÑE). 7) ¿Cuánto tardas y cuándo lo haces? 8) ¿Cuántos el mes pasado? 9) ¿Cuántos en visto? 10) ¿Haces seguimiento? 11) ¿Has perdido trabajos por tardar?
**Señal y cobro:** 12) Últimos 5 trabajos: ¿señal? ¿cuánta? 13) ¿Cómo te la pagaron (efectivo/Bizum/transfer/tarjeta)? 14) ¿Te han anulado con material comprado? ¿Qué perdiste? 15) ¿Cuánto te deben AHORA? 16) ¿Qué haces cuando no pagan? 17) Si el cliente pudiera firmar y pagar la señal desde el móvil, ¿tus clientes de ESTA semana lo habrían hecho?
**WhatsApp:** 18) ¿% de clientes que te escriben por WA? 19) ¿Mandas presupuestos por ahí? ¿Texto, foto o PDF? 20) ¿WhatsApp Business o normal? 21) ¿Te incomodaría que los mensajes salieran de un número de empresa con tu nombre?
**Fiscal:** 22) ¿Facturas todos los trabajos? (sin juzgar) 23) ¿Quién te lleva "lo de Hacienda"? 24) ¿Te suena VeriFactu? ¿Qué piensas hacer? 25) ¿Módulos o estimación directa? 26) ¿Usas algún programa? ¿Qué odias de él?
**Cierre/pricing:** 27) Si esto te consiguiera UN trabajo más al mes, ¿qué vale en euros? 28) ¿29 €/mes: caro, normal o barato? (silencio) 29) ¿0,9 % de un cobro con tarjeta por tener el dinero esa noche: sí o no? 30) ¿Qué tendría que hacer para que dijeras "lo quiero YA"?
**Criterios de alarma (predefinidos):** ≥7/10 no cobran señal NI piensan pedirla → promesa primaria pasa a "que no te dejen en visto + recordatorios", señal = upsell · ≥7/10 delegan todo en gestoría y no les suena VeriFactu → canal gestorías sube, SEO de pánico baja · ≥5/10 dicen que sus clientes no firmarían en el móvil → reforzar "Acepto sin firmar" + aceptación por respuesta de WhatsApp.

---
*YAQU_MASTER v5.3 UNIFICADO (rev. pulida: Project Brief + Parte AB + auditoría de referencias) — 10 jun 2026. Sprint activo: VALIDA-0 (+ S1-0 humano día 1). Prioridad absoluta: SIF-1. Próxima revisión estratégica permitida: 25 pagantes (regla 13). Historial: v4 (may-26) → v5 + parche v5.1 + addendum v5.2 + delta v5.3 (10-jun-26) → este documento.*
