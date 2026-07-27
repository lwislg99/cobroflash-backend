# YAQU — DOCUMENTO MAESTRO v5.3 UNIFICADO
**10 junio 2026 · ÚNICA FUENTE DE VERDAD · Reemplaza a: YAQU_MASTER_V5, PARCHE_V5.1, ADDENDUM_V5.2 y DELTA_V5.3 (todas las precedencias ya resueltas en este documento).**

> **Instrucción para Claude Code (única tarea de instalación):** guardar este archivo como `docs/YAQU_MASTER.md`, mover los 4 documentos anteriores a `docs/historico/`, commit `docs: YAQU_MASTER v5.3 unificado`. No hay nada que fusionar ni interpretar: este documento ya es la fusión.
> **Sprint activo:** VALIDA-0 (Parte U). **Prioridad absoluta de F1:** SIF-1.
> **Etiquetas de fase:** `F1-doc` (definición vigente ya) · `F1-build` (código permitido en F1) · `F2-spec` (verdad para su sprint; PROHIBIDO construir antes) · `F3/F4/cajón`.
> Si una tarea necesita un estado, flag, transición o texto que no está aquí: NO se inventa — se propone cambio de master primero (regla 27).

---

# PROJECT BRIEF — YAQU EN 12 LÍNEAS (leer SIEMPRE primero)

YaQu es una herramienta **WhatsApp-first para profesionales de oficios en España**: fontaneros, electricistas, reformistas, climatización, cerrajeros y pintores. Resuelve dos dolores: presupuestos lentos/poco profesionales que mueren "en visto", y trabajos que empiezan sin señal cobrada. Permite crear el presupuesto en 30 segundos (tecleando o dictando), enviarlo por WhatsApp con botones nativos, conseguir aceptación/firma del cliente desde su móvil, cobrar señal o total, y — **cuando el gate fiscal SIF-1 esté cerrado** — emitir facturas VeriFactu con declaración responsable del fabricante. **Hasta entonces, la beta vende presupuestos, firma y cobro con justificante no fiscal: nunca "facturación" ni claims fiscales** (reglas 17, 24, 26). Foco F1: **SIF-1 es la prioridad absoluta** sobre cualquier feature. Modelo comercial: **un único plan público — YaQu Pro 19,90 €/mes (199 €/año) + 0,9 % solo en cobros con tarjeta; Bizum manual y transferencia sin fee** (founding: 9,90 € de por vida, 20 plazas). Canal core: WhatsApp (Meta Cloud API directa, jamás n8n). El producto es móvil-first y la pantalla más pulida debe ser SIEMPRE la landing del cliente final. España-first (marketing mono-país hasta F3); LATAM en F3 con socio y sin claim de factura. NO se construye ahora: app nativa, marketplace, CRM complejo, contabilidad, multi-país activo, IA libre (Parte Z). **Claude Code debe:** obedecer el Sprint Registry (Parte U) sin reordenar, no inventar estados/flags/textos (Partes L, P, N5, K1), respetar las stop conditions (AA1.4) y priorizar SIF-1 sobre todo.

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
1. **Suscripción — UN plan público:** "YaQu Pro — 19,90 €/mes (o 199 €/año) + 0,9 % solo cuando cobras con tarjeta. Todo incluido." Founding = banner de lanzamiento (9,90 €/mes de por vida, 20 plazas, contador real). Equipo = oferta manual 59 € no listada en F1. Detalle completo: Parte W.
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
6. Competencia ES: **PresupuestAPP (9,99 €) es competidor de ciclo casi completo** (firma+cobro+VeriFactu+voz, ver Z3), PresuNow y Billin "gratis" Kit Digital NO cierran el círculo del dinero. **Moat de YaQu = WhatsApp API nativa con botones + firma + factura VeriFactu + cobro integrado con take rate + recordatorios + simplicidad radical, de punta a punta.** No competir en precio de presupuestos; ganar en profundidad de cobro.
7. **El dolor económico nº1 del ICP es la MOROSIDAD, no la factura** (research 13-jun-2026, fuentes en Apéndice A): PMP medio España 80,5 días y **construcción 96,5 días** (el peor sector, justo el ICP) según el Observatorio de Morosidad de CEPYME (2º sem. 2025); la morosidad **afecta al ~44 % de los autónomos** (ATA, cierre 2025) y cuesta de media **5.350 €/año** a cada pequeña empresa (CEPYME, 2T 2025). Esto es la munición de venta real — más fuerte que VeriFactu, cuyo aplazamiento a 2027 ha enfriado el miedo fiscal (regla 26b).

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

> **✅ SCRUM-109 (23-jul-2026) — `Expense.teamMemberId` (carril A, bloqueante de SCRUM-107 V2):** nace de SCRUM-107, que abrió `POST /admin/expenses` al técnico (compra material en el almacén, lo registra desde la furgoneta) pero tuvo que dejar GET/PUT/DELETE en admin **por falta de dato**: sin autoría no hay forma de distinguir "su gasto" del de un compañero. Campo aditivo/nullable, mismo patrón que `Job.operarioId` (SCRUM-52): `null` = propietario, sin relación Prisma declarada a propósito (así se hace en este proyecto para estos campos de autoría — `Quote.teamMemberId` tampoco la tiene). `createExpense` lo rellena con `req.teamMemberId` de la sesión; **inmutable** — no forma parte de `updateExpense`, mismo criterio que la autoría congelada de `Job` (SCRUM-22). Schema aplicado STAGING → GO del fundador → PROD (ver `docs/MIGRATIONS_PENDING.md`). **Desbloquea, no implementa:** el filtrado row-level (GET del técnico ve solo los suyos, 404 en el ajeno, patrón SCRUM-23) y retirar el ocultamiento del nav son la V2 de SCRUM-107, carril B (Javier) — esta tarea solo sirve el campo.

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
> **✅ SCRUM-43 · UI numeración + confirmación (12-jul-2026, hallazgos de la suite v1.1):** (1) **"Actividad reciente" del Home usa `quoteNumber`** (numeración por merchant, A1.2) en vez del id global de BD: `metrics.service.ts` añade `quoteNumber` al payload de `recentActivity` (aditivo; `recentQuotes` ya traía el campo con `include`) y `homeView.js` pinta `#${quoteNumber ?? id}` (mismo fallback pre-backfill que `displayQuoteNumber`) en meta y aria-label; el **id global sigue siendo la clave de navegación** (`data-quote-id` → quotes-detail). Mismo número en Home, lista y detalle. (2) **"Marcar como pagada" pide confirmación** (decisión del fundador: opción a — es dinero): `window.confirm` nativo con el texto **"¿Marcar como pagada la factura {número} de {importe}?"** en los DOS sitios con el botón — `quotesDetailView.js` (antes de deshabilitar el botón y hacer el PUT) y `jobDetailView.js` (ANTES del prompt de importe A21.2, que sigue INTACTO: la verificación de importe y `payment-anomaly` no cambian). Cancelar = la factura no cambia de estado. Sin backend nuevo, sin schema.
> **✅ SCRUM-44 · suite de regresión v1.4 (12/13-jul-2026):** `docs/QA/SUITE_REGRESION.md` alineada con la UI real (la v1.1 pasó por ramas alternativas, pero el doc describe ahora lo que la UI enseña; la v1.3 de SCRUM-14 —sección 5 Albaranes— entró antes en `main`, así que estas alineaciones se integran ENCIMA como v1.4): assert 6 ya NO busca el literal "Pendiente" en la lista de Facturas (el estado pendiente se infiere del botón "Marcar como pagada" visible por tramo); el CTA de cabecera tras pagar el primer tramo es **"Ver cobro pendiente"** (no "Ver justificante"); y el assert de confirmación al marcar pagada ahora SÍ existe (SCRUM-43): diálogo nativo con número e importe, aceptado vía `browser_handle_dialog` del Playwright MCP.
> **✅ SCRUM-45 · cache-busting del dashboard, V1 = B+C (16-jul-2026; cierra también la raíz de SCRUM-46):** los usuarios veían el dashboard VIEJO tras cada deploy — el culpable era `public/sw.js` (SHELL cache-first sin revalidación + `CACHE_NAME` manual), no el HTTP (`express.static` ya revalida con `max-age=0`+ETag; `app.disable('etag')` de app.ts no afecta a estáticos). **(B)** `sw.js` pasa a **NETWORK-FIRST** para estáticos (red primero + refresco de caché runtime; sin red → fallback a caché = offline conservado), SHELL alineado 16→30 entradas (los 28 `<script>` reales de index.html + tokens.css + styles.css), bump FINAL a `yaqu-v4` (network-first elimina los bumps por deploy), `skipWaiting`+`claim` intactos (propagación auto verificada en SCRUM-46). **(C)** `GET /version` público devuelve `BUILD_ID` (= `RAILWAY_GIT_COMMIT_SHA`, inyectada por Railway; fallback dev = timestamp de arranque; en `core/config/env.ts`), `/health` unificado al mismo id (mata la '0.1.0' hardcodeada), y `app.js` sondea `/version` (90 s + al recuperar foco) → toast persistente **"Hay una versión nueva de YaQu. Recarga para actualizar." [Recargar]** (copy K1 aprobado; nunca recarga automática). El SW deja pasar `/version` y `/health` sin caché. Tests: `tests/version.test.mjs` (BUILD_ID). **La opción A (versionar los 28 `<script src>` con `?v=hash` + immutable) queda como V2 opcional de performance** — no necesaria para el bug. Gate humano: con la app abierta, deploy → toast → Recargar trae lo nuevo sin Ctrl+Shift+R.

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
Un plan público (Parte W): **Pro 19,90 €/mes (199 €/año) + 0,9 % solo tarjeta — todo incluido**; founding 9,90 € de por vida (20 plazas, banner con contador real); Equipo 59 € manual no listado. Trial 14 días sin tarjeta. NO competir en precio con Billin/Kit Digital: el ancla es "un trabajo de 1.500 € que no se te escapa paga 6 años de YaQu".

## H2. Mensaje en dos etapas
- **Etapa 1 (pre-SIF):** categoría = "herramienta para presupuestar, firmar y cobrar señales por WhatsApp". PROHIBIDO: "VeriFactu listo", "cumple con Hacienda", venderlo como software de facturación. **Guion único ante "¿me vale para VeriFactu?" (regla 26):** *"Te contesto como fabricante: la facturación VeriFactu está construida y en certificación — con declaración responsable del productor, que es lo que tu gestor te pedirá. Por ley no puedo activarla hasta cerrarla; por eso la beta es de presupuestos y cobros. Los founding la estrenáis al cerrarse, sin cambio de precio. Si quieres, le paso a tu gestor el detalle técnico cuando lo publique."*
- **Etapa 2 (post-SIF):** "Presupuesto, firma, señal cobrada y facturación VeriFactu con declaración responsable del fabricante, en una sola herramienta." Declaración descargable + pack gestoría (S1-H). Mensajería por audiencia: fontanero → cobro primero, VeriFactu como seguro; gestoría → VeriFactu primero.

## H3. Canales por coste/retorno
1) Red caliente + visitas presenciales a tiendas de material (Madrid). 2) Grupos WhatsApp/Facebook de gremio (auténtico, no spam) + Habitissimo/Cronoshare como fuente de pros. 3) **Gestorías** (piloto 2-3 con pack S1-H; programa formal solo con gate Y2). 4) SEO de la ola + TikTok/Reels con la demo de voz (F2: SEO-2). 5) Distribuidores de material (F2).

## H4. Plan de calle 30 días (arranca con VALIDA-0)
**S1:** 10 conversaciones discovery (Apéndice B; no vender: preguntar) + 10 visitas a tiendas (flyer QR al vídeo; trato verbal: "30 € por alta que pague"). **S2:** cerrar 3-5 founding de red caliente con onboarding white-glove (TÚ cargas catálogo y primera cotización en 30 min). **S3:** grupos de gremio + 2 referidos por founding ("1 mes gratis por compañero"). **S4:** 2 gestorías piloto + repaso de métricas y decisión.

## H5. Guiones
> **Ángulo maestro (research 13-jun):** el gancho nº1 es **el dinero/la morosidad**, no VeriFactu. Datos de calle (Apéndice A): en construcción se tarda **96 días de media en cobrar**, la morosidad le cuesta **5.350 €/año** al pequeño negocio y afecta a **casi la mitad de los autónomos**. VeriFactu es el seguro de fondo ("ya cumples"), no el titular.
- **WhatsApp (frío templado):** "Hola [Nombre], soy Tu, [conexión]. Estoy montando una herramienta para [gremio] que hace una cosa muy concreta: el cliente recibe tu presupuesto por WhatsApp, lo firma con el dedo y te paga la señal antes de que empieces. Te enseño en 60 segundos cómo funciona (vídeo). A los 20 primeros os lo dejo a mitad de precio de por vida. ¿Te lo mando?"
- **Llamada (30 s):** "¿Te pillo en obra? Rápido: ¿cuánto dinero te deben ahora mismo de trabajos ya hechos? En este sector se tarda de media tres meses en cobrar. Eso arreglo: señal cobrada antes de empezar y recordatorios que persiguen al que no paga, solos. ¿Te paso un vídeo de 1 minuto?"
- **Llamada (variante presupuestos):** "¿Cuántos presupuestos mandaste el mes pasado por WhatsApp? ¿Y cuántos se quedaron en visto? Presupuesto que se firma solo y señal cobrada antes de empezar. ¿Te paso el vídeo?"
- **Presencial:** demo en TU móvil en 90 s con cuenta demo (modo seguro): dicta → envía a tu número → firma → pago test. Cierre: "Los 20 primeros, 9,90 al mes para siempre y te lo dejo montado yo en media hora."

## H6. Objeciones → respuestas
"Ya lo hago por WhatsApp gratis" → "Exacto, por eso esto ES WhatsApp. El tuyo no firma, no cobra la señal y no persigue al moroso solo." · "Mis clientes son mayores" → "Dos botones: Firmar y Pagar. Y si no, transferencia: tú llevas el control y el PDF." · "Yo no pido señal" → "¿Cuántas veces te han anulado con el material comprado? Pruébalo en UN trabajo grande." (si abunda: dato de discovery, apuntar) · "Mi gestor me lleva todo" → "Tu gestor te hace los impuestos; esto te consigue el SÍ y la señal. Y cuando llegue lo de Hacienda en 2027, ya estás dentro." · "Hay uno a 9,99" → "El de 9,99 te hace el papel. Este te trae el dinero: firma + señal + recordatorios que persiguen al moroso. ¿Cuánto te deben ahora mismo? Eso es lo que esto te ahorra." · "El Kit Digital me lo da gratis" → "Lo gratis te hace facturas. ¿Te cobra la señal por WhatsApp?" · "0,9 % es mucho" → "4,5 € en una señal de 500 € por tener el dinero esa noche. Bizum y transferencia, gratis." · "No tengo tiempo de aprender" → "Te lo monto yo en 30 minutos y la primera la hacemos juntos dictando." · "¿Y si cierras?" → "Tus datos se exportan en CSV cuando quieras y las facturas son tuyas. Sin permanencia." · "Ahora no" → "¿Te aviso cuando lo de Hacienda sea obligatorio? Quédate el vídeo."

## H7. Mensajes que funcionan
"¿Cuántas señales has dejado de cobrar este mes?" · "¿Cuánto te deben ahora mismo de trabajos ya hechos?" · "En este sector se tarda 3 meses en cobrar. Tú, esa misma noche." · "Cobra la señal antes de descargar la furgoneta" · "El presupuesto que se firma solo" · (post-SIF) "Y cuando llegue VeriFactu, ya estás dentro".

---

# PARTE I — REGLAS (1-36; cerradas)

**Técnicas heredadas:** 1) NUNCA n8n — WhatsApp solo vía `src/integrations/whatsapp.ts` (Meta Cloud API directa). 2) Multi-tenant: toda query filtra por `req.merchantId`. 3) Prisma sin TTY: `db push` (procedimiento canónico `scripts/db-push-prod` — host-check→preview→GO→push→documentar, SCRUM-40), nunca `migrate dev`; `prisma/migrations` archivada en `docs/historico/prisma-migrations-frozen-2026-03/` (congelada mar-2026; volver a migrate = SCRUM-40 opción A). Preview del diff antes de tocar prod. 4) Frontend vanilla, sin frameworks ni build. 5) Emails por Resend. 6) Crons in-process. 7) Rutas `/admin/*` con `pf_session`. 8) Demo merchant `demo@yaqu.app` id=1 (watermark, DEMO_SAFE_NUMBERS, fuera de métricas).
**Técnicas v5+:** 9) Código nuevo lee `getCountryConfig()` — nada hardcodeado por país (capa mínima en F1). 10) Todo cobro con tarjeta pasa por Connect cuando el merchant lo tenga activo. 11) Artefactos nuevos a R2 desde F2 (no fs local). 12) Ningún claim fiscal en UI/marketing que el motor del país no cumpla (LATAM sin PAC: "nota/recibo").
**Estratégicas:** 13) Prohibido replanificar antes de 25 pagantes (dudas → `docs/DECISIONES_PENDIENTES.md`). 14) Marketing mono-país hasta F3; arquitectura country-aware desde ya. 15) Una feature nueva exige matar o posponer otra (WIP limit). 16) Cada sprint cerrado actualiza este documento (mover a ✅; nunca borrar, tachar con motivo).
**Legales/claims:** 17) Ningún claim regulatorio sin su sprint legal cerrado (VeriFactu ⇒ SIF-1 + declaración). 18) Tarjeta para clientes reales SOLO con Connect activo en ese merchant; mientras, transferencia/Bizum manual. 19) VALIDA-0 no se cierra sin 10 discovery registradas y criterios de alarma evaluados. 20) Toda cifra del master lleva fuente o [VALIDAR]; lo [VALIDAR] no entra en argumentarios. 21) Partida real anual de asesoría fiscal/legal.
**Pagos/UX:** 22) El selector de pago se ordena por probabilidad de cobro del MERCHANT, no por el fee de YaQu; `paid_via` se registra en el 100 % de los cobros (card/bizum_manual/transfer/cash). 23) Prohibido procesar pagos de clientes finales en la cuenta Stripe de plataforma: PSP = cuenta conectada del merchant o nada.
**VeriFactu operativo:** 24) `INVOICING_ES_ENABLED=false` para merchants ES reales hasta SIF-1 v2 completo; facturas demo con marca de agua SIEMPRE. 25) Cobro a founding pre-SIF exige alcance por escrito (`docs/legal/ALCANCE_BETA.md`). 26) La pregunta "¿me vale para VeriFactu?" se responde SOLO con el guion H2. 26b) **El aplazamiento de VeriFactu a 2027 (RDL 15/2025) enfrió el miedo fiscal; el gancho comercial nº1 es la MOROSIDAD/el cobro, y VeriFactu es el pilar de confianza nº2 ("ya cumples, sin pensar"), nunca el titular.** El GTM no se apoya en la fecha (ya hubo un aplazamiento).
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
| `payment_confirmation_invoice_es` | ⏳ alta en Meta (usuario) · **builder+spec listos 14-jun** | Sustituirá a la anterior con botón "Ver documento" (→ `/recibo/{{1}}`; copy neutro factura/justificante) | webhook psp/mp | builder al aprobarse | ~0,023 € |
| `merchant_alert_es` | ⏳ alta en Meta (usuario) · **builder+spec listos 14-jun** | Notificación al PRO con ventana cerrada (decisión/pago) | decisión/pago | sendWhatsAppText* | ~0,023 € |
*Notificaciones al PRO viajan como service message si su ventana 24h está abierta (coste 0); si no, `merchant_alert_es`.
**Acciones en Meta pendientes (usuario):** URL dinámica en `quote_decision_es` (P3-1, workaround vivo) · `payment_confirmation_invoice_es` · `merchant_alert_es` · categoría Utility en las 3 existentes.
**Decisión fundador 12-jun-26 (tensión con Parte M/justificantes):** se ASUME el wording "factura" de `payment_request_es`/`payment_confirmation_es` hasta la sesión de Meta de P3-3; al recrearlas como Utility se usará copy neutro **"tu documento de cobro"** (válido para factura y justificante). Hasta entonces, merchants ES reales en modo justificante reciben el wording actual — riesgo asumido y acotado pre-SIF.

## J2. Template vs service message `F1-doc`
Service (coste 0) SOLO dentro de la ventana 24h abierta por mensaje ENTRANTE. Template Utility para todo lo iniciado por negocio fuera de ventana. En código: comprobar `lastInboundAt > now-24h` antes de texto libre; si no, plantilla o nada.

## J3. Opt-in y bajas `F1-doc + F1-build mínimo`
Opt-in: checkbox al crear cliente (texto legal; el merchant declara que el cliente le dio el teléfono para sus documentos); la primera plantilla siempre identifica al negocio. Baja: entrante "BAJA"/"STOP" → `customer.waOptOut=true` + bloqueo de envíos a ese número para ese merchant + aviso al pro. **F1-build:** campo `waOptOut` + check en `sendWhatsAppTemplate`; el procesado del entrante llega con WA-0b/BOT-1 — hasta entonces, baja manual desde ficha.

## J4. Estados de mensaje y log — WA-0b `F2-spec (early; permitido en huecos de SIF-1)`
Tabla `WhatsAppMessage {id, merchantId, customerId?, type:'template'|'service', templateName?, waMessageId, status, error?, relatedType?, relatedId?, costEstimate, createdAt}`. Estados: `queued → sent → delivered → read` | `→ failed(error)`; fuente: webhook `/webhooks/whatsapp` (rama `statuses`, activable antes que el bot). UI: chip de entrega en detalle de quote/factura.
**🟡 GROUNDWORK 13-jun-26 (en hueco de SIF-1):** modelo `WhatsAppMessage` (schema), servicio TOLERANTE `messaging/domain/whatsappLog.service.ts` (record + updateStatus + getDeliveryStatus + `shouldApplyStatus` puro, no retrocede estado salvo failed), captura de `waMessageId` en `sendWhatsAppTemplate` (metadata `log`), rama `statuses` del webhook procesando delivered/read/failed, call-sites quote/invoice etiquetados, tests 5/5. db push de la tabla **✅ aplicado** (13-jun) + **chip de entrega en UI ✅** (`waDeliveryChip` en api.js + `.wa-chip` en styles.css con tokens; pintado en detalle de quote y factura, estados sent/delivered/read/failed, captura visual verificada). **WA-0b operativo de extremo a extremo** (log → estados webhook → chip); falta solo verlo con tráfico real de WhatsApp. Sigue F2: métricas de coste/entrega (J8) y log de service messages en más call-sites.

> **✅ SCRUM-115 (23-jul-2026) — el fallo deja de desaparecer sin rastro:** hasta ahora `sendWhatsAppTemplate` solo llamaba a `recordWaMessage` en el camino de ÉXITO — cada rama de fallo (`not_configured`, `demo_safe_numbers`, `wa_opt_out`, `daily_cap`, `customer_daily_cap`, `template_invalid`, error de Meta) devolvía `{ok:false}` sin dejar fila en WA-0b; `sendWhatsAppText` no registraba NADA, ni éxito ni fallo. Ahora ambas registran `status:'failed', error:<motivo>` en cada rama de fallo (aditivo: nuevas filas, ninguna firma ni forma de return cambia). Los topes A3.2 (diario) y J6 (por cliente) se filtran ahora por `waMessageId: { not: null }` en vez de solo `type:'template'` — solo cuentan intentos que de verdad llegaron a Meta, así que un fallo ya no consume cupo (un mensaje que SÍ llegó y luego falla en entrega vía webhook conserva su `waMessageId` y sigue contando igual que antes: el filtro no cambia ese caso). `sendWhatsAppText` NO registra su propio éxito — evita duplicar la fila que ya escribe `sendWhatsAppWindowFirst` cuando el texto de ventana sale bien. **Lado front:** 3 sitios decían "✓ Enviado" sin mirar el resultado real — `jobDetailView.js` (rama `recordar`, no miraba nada) e `invoiceDetailView.js` (botón "Recordar pago", miraba `r.ok` en vez de `d.sent`) para el mismo endpoint `/admin/invoices/:id/send-reminder`; y la barra compartida `waFallbackBar` (`api.js`, usada por 4 sitios: facturas ×2, presupuestos, trabajos) que solo miraba si la promesa no rechazaba, ciega al `200+ok:false` de los 4 endpoints `send-email`. Cluster con **SCRUM-116** (registro falso `reminder7SentAt`/`14SentAt` que desactivaba el cron de recordatorios — ya mergeado, ver `invoicesAdmin.routes.ts`) y **SCRUM-117** (la métrica `reminderEur` cuenta histórico no fiable — decisión del fundador, sin código). Tests: `scrum115-wa-fallo-registrado.test.mjs` (gateado) confirma en staging real que un guard bloqueado deja `status:'failed', waMessageId:null` en ambas funciones.

## J5. Fallback si WhatsApp falla `F1-doc` (parcial vía P3-2 ✅)
Error Meta → 200 `ok:false` con motivo legible (hecho). Acciones SIEMPRE ofrecidas: **Copiar enlace** · **Enviar por email** · **Reintentar**. 131026 (sin WhatsApp) → "copia el enlace y mándaselo por SMS o llámale". Nunca fallo silencioso: cron que falla un envío lo registra y aparece en BO.

## J6. Anti-spam (política dura) `F1-doc`
Máx 1 recordatorio/presupuesto y 2/factura (7/14d) · mantenimientos solo con aprobación del pro y máx 1 propuesta/cliente/90d · cero Marketing, cero no-transaccional · automatismos 09:00-21:00 hora del merchant · tope duro 3 mensajes-iniciados-por-negocio/cliente/día (guard `F2-early`). Violar esto = ban del número = producto muerto.

## J7. Catálogo técnico `F1-build`
`src/integrations/whatsapp/templates.ts`: un builder por plantilla `{name, lang, buildBodyVars(ctx), buildButtonParam(ctx), expectedVarCount}` + validación de nº de vars ANTES de llamar a Meta (evita #132000); call-sites migran a builders. Test `tests/whatsapp-templates.test.mjs` compara contra `docs/WHATSAPP_TEMPLATES.md`.

## J8. Métricas de coste y entrega `F2-spec`
Por merchant/mes: enviados/entregados/leídos/fallidos + coste €; por plantilla: tasa de entrega; alerta runbook si <90 % en 7 días.
**✅ DONE 13-jun-26 (sobre WA-0b):** `getWhatsAppMetrics` (funnel derivado read⊃delivered⊃sent + coste sumando `costEstimate` + tasa por plantilla + alerta 7d <90% con muestra ≥10), endpoint `GET /admin/metrics/whatsapp`, tarjeta en Informes (se oculta si 0 envíos este mes). Tests `aggregateWaRows` 72/72. Datos reales en cuanto haya tráfico WhatsApp.

---

# PARTE K — BOT WHATSAPP ENTRANTE

## K1. BOT-1 (sin IA libre: botones y flujos cerrados) `F2-spec` · flag `BOT_INBOUND_ENABLED`
**Identidad (el número es COMPARTIDO entre merchants):** buscar teléfono entrante en `Customer`: 1 merchant → contexto fijado · varios → lista "¿Con qué negocio quieres hablar?" · ninguno → respuesta única ("Este número envía presupuestos y facturas de negocios que usan YaQu...") sin captura, fin. `BotSession {phone, merchantId?, state: menu|choosing_merchant|asking_description|asking_zone|confirming_request|done|handoff, data, expiresAt=+24h}`.
**Menú** (mensaje de lista; Meta limita botones a 3): 📄 Ver mis presupuestos · 💳 Pagar pendiente · 🛠 Pedir presupuesto · 💬 Hablar con [Negocio].
**Flujos:** Ver presupuestos → últimos 3 con estado + link `/pay/quote/:id` (si 0: ofrecer pedir). Pagar pendiente → charges pending + link `/pay/invoice/:chargeId` (si 0: "🎉"). Pedir presupuesto → 2 preguntas una a una **con validación** (A18: descarta saludos/basura, no guarda "Zona: Hola") → **confirmación con botones `[✅ Enviar]`/`[✏️ Reescribir]`** (estado `confirming_request`) → solo al pulsar Enviar se crea `QuoteRequest {merchantId, customerId|leadPhone, description, zone, source:'whatsapp_bot'}` → WA al pro con resumen + link BO → confirmación al cliente. **"cancelar"** en cualquier paso de la captación vuelve al menú sin crear nada. Hablar con [Negocio] → reenvía texto+número al pro, marca `handoff` (bot mudo 24h) (el pro responde desde SU WhatsApp).
**Copy oficial v2.1 (fundador, 5-jul-2026 tarde — tabla A8.1 completa aprobada en sesión; fuente exacta en `botFlow.service.ts` + `whatsappIncoming.routes.ts`):** deltas sobre v2 → dinero SIEMPRE es-ES ("2.383,70 €") en todo el bot y avisos al pro · nº de presupuesto VISIBLE (`quoteNumber`), nunca el id interno (también en el flujo clásico Acepto/No) · "Pagar pendiente" cierra con "Pagas desde el enlace, con pago seguro y cifrado" (sin prometer métodos que el merchant no tenga) · "🎉 ¡Estás al día!" va seguido del menú · handoff al pro CON CONTEXTO ("Contexto: estaba viendo sus presupuestos / mirando sus pagos / pidiendo un presupuesto / en el menú", vía `data.lastAction`) y expectativa "el asistente queda en silencio 24 h" · bordes A8.2 aprobados: botón de menú caducado → "Ese menú ya caducó — te dejo el de ahora 👇" + menú fresco; media no soportada (imagen/vídeo/ubicación/sticker/documento, además de audio) → "🙏 De momento solo entiendo texto. ¿Me lo escribes en un mensaje?".
**Texto de sesión del ENVÍO de presupuesto (A5.5, fundador 5-jul-2026 — se usa en vez de la plantilla `quote_decision_es` cuando la ventana de 24 h está abierta, p. ej. presupuesto nacido de una solicitud del bot; mismo contenido que la plantilla):**
> Hola {nombre} 👋
> {Negocio} te ha preparado tu presupuesto:
> 📄 *Presupuesto #{nº}* · *{total es-ES}*
> Ábrelo, revísalo y fírmalo desde aquí 👇
> {BASE}/pay/quote/{id}

**Copy v2 (base, fundador 5-jul-2026):** menú con descripciones por fila ("Pendientes de ver o firmar" / "Tus cobros abiertos, con enlace seguro" / "Te lo pido en 2 preguntas" / "Te escribirá personalmente"); pedir presupuesto = "📝 Cuéntame qué necesitas — cuanto más detalle, mejor. Por ejemplo: …" (SIN mención de audio hasta MEDIA-1) y "📍 ¿En qué zona está el trabajo? (barrio o municipio)"; handoff = "✅ Hecho, le he avisado. [Negocio] te escribirá en cuanto pueda desde su número personal."; **los saludos (hola/buenas/menú…) muestran el menú y NO cuentan como texto fuera de flujo** (el handoff de 2ª vez queda para texto libre real, con explicación honesta: "soy un asistente sencillo, los precios te los da [Negocio]"); audio → "🙏 De momento solo entiendo texto…".
**Copy A18 (fundador, 7-jul-2026 — captación robusta; fuente exacta en `botFlow.service.ts`):** el flujo "pedir presupuesto" ahora VALIDA y CONFIRMA. Deltas: descripción inválida (saludo suelto o < ~4 caracteres útiles) → "🙂 ¿Me cuentas un poco más? Por ejemplo: 'se me ha roto un grifo en la cocina y pierde agua'. (o escribe *cancelar* para salir)"; la pregunta de zona añade "Si no aplica, escribe 'a domicilio'." y acepta "no lo sé"/"a domicilio"; zona inválida → "📍 Dime la zona (barrio o municipio), por ejemplo 'Chamberí'…"; **confirmación** = mensaje de botones "📋 Voy a enviar esto a {Negocio}: • Necesito: '{desc}' • Zona: {zona}. ¿Lo envío?" con `[✅ Enviar]`/`[✏️ Reescribir]`; Reescribir → "✏️ Vale, empezamos de nuevo. Cuéntame qué necesitas."; cancelar → "Sin problema, lo dejamos 👍" + menú. **Fix B1 (mismo día):** el atajo de decisión Acepto/No (`whatsappIncoming.routes.ts`) NO se aplica si el número está a mitad de la captación (`asking_description|asking_zone|confirming_request`) — antes "vale/ok/no" dentro del flujo podía aceptar/rechazar por error un presupuesto enviado.
**Copy A23 BOT PRO (fundador, 7-jul-2026 — mensajes de servicio de máximo nivel; VERIFICADO contra los docs de Meta: todos estos tipos SOLO se entregan con la ventana de 24 h ABIERTA, que el bot siempre cumple al responder a un entrante → 0 €):** el bot pasa de URLs crudas a **botones-enlace** (`cta_url`): "Ver presupuestos" → un botón *Ver y firmar* por presupuesto (dinero en *negrita*); "Pagar pendiente" → un botón *Pagar [importe]* por cobro; aviso al PRO de nueva solicitud → botón *Abrir en YaQu* (dashboard). Además: **marca el entrante como leído + "escribiendo…"** antes de responder (`markInboundRead`); el paso de zona ofrece **compartir ubicación** (`location_request_message`) o escribirla, y la **ubicación entrante** (`type:location`) se usa como zona. Sin enlaces visibles. Senders nuevos en `src/integrations/whatsapp.ts`: `sendWhatsAppCtaUrl` · `sendWhatsAppDocument` · `sendWhatsAppLocationRequest` · `markInboundRead`. **Ventana-first con botón (misma tanda):** los envíos que sustituyen plantillas cuando la ventana está abierta — presupuesto (`sendQuote.service.ts`), factura (`invoiceWhatsApp.service.ts`), recordatorios de pago (`invoiceReminder.service.ts`) y confirmación de pago (`sendPaymentConfirmationInvoice`) — también salen ahora como **botón-enlace** (Ver y firmar / Pagar / Ver recibo) con dinero **es-ES** y sin URL cruda: `sendWhatsAppWindowFirst` gana `windowCta`; el texto plano queda de reserva y la plantilla sigue siendo el fallback fuera de ventana. **Reseña Google (A2.5):** la solicitud de reseña post-pago (`psp.routes`/`mpWebhook`) también sale como **botón-enlace ⭐** (antes URL cruda) y en `/recibo/:id` el botón de Google es la **acción primaria** cuando el merchant tiene `googleReviewUrl` en ajustes; la valoración interna (privada al pro) baja a secundaria. Sigue mostrándose a TODOS sin gating por estrellas (políticas Google/UE). **Fases siguientes (no en esta tanda):** WhatsApp **Flows** para la captación (requiere alta/publicación del Flow en Meta) y **fotos del cliente → adjunto** a la solicitud (bloqueado en credenciales **R2**; `Attachment` ya en schema).
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
**Albaran (NO fiscal) `F3-adelantado (SCRUM-14, 13-jul-2026)`:** `borrador → emitido → firmado`. borrador/emitido = editable (`version++` con traza en AuditLog); emitir = idempotente; `firmado` = TERMINAL y congelado (signatureUrl + firmadoAt; el PDF se regenera con el bloque de firma; editar → 409 `albaran_locked`). Numeración `ALB-YYYY-NNN`: serie propia POR MERCHANT, correlativa, reset anual, **independiente de la serie fiscal de facturas** — el albarán JAMÁS pasa por getEmissionMode/VeriFactu/serie J- ni lleva QR o importes (regla 24; líneas = concepto/cantidad/unidad, SIN precios). Fotos vía `Attachment entityType:'albaran'`.
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

**A22 LANDING (7-jul-2026, aprobado por el fundador tras 6 iteraciones de prototipo): REDISEÑO + REPOSICIONAMIENTO de `public/index.html`.** La landing pasa del gancho "cobra la señal antes de empezar" (morosidad, H5/H7) a **"El ERP por WhatsApp para los oficios · Del presupuesto al cobro, sin salir de WhatsApp"**: la señal por adelantado queda como **OPCIÓN**, no como base (se vende gestión completa, no "cobro de señales"). Estructura: barra de anuncio (plazas fundadoras con **contador REAL** vía `/public/founding-status`, se oculta si 0), héroe con **demo de producto animada 100% CSS** (presupuesto→WhatsApp→firma→cobrado), demo interactiva "Pruébalo tú" (crear→enviar→firmar→factura→pagar), sección **"Todo en uno · Seis herramientas"** (presupuestos/firma · cobros · WhatsApp+bot · clientes/proveedores · productos/catálogo · gastos/informes/equipo) con tarjetas hover estilo Holded, precios (plan único 29 €/founding 14,50), FAQ, CTA. Secciones alternadas blanco/verde-suave; marca **luminosa** (DESIGN.md, nunca oscura). **El copy oficial de esta landing = el de `public/index.html`** (fuente de verdad; N5 anterior queda para el flujo de pago/firma). Demo interactiva inline (el viejo `js/landing-demo.js` queda sin usar).

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
> **✅ CONSTRUIDO (EXT3 Ola 15, 6-jul-2026, autorización A10.0):** semillas por gremio +
> toggle en el presupuesto aceptado (intervalo editable) + cron diario 10h → quote draft
> `origin='maintenance'` → WhatsApp AL PRO con botones de sesión [Aprobar y enviar]
> [Posponer 30d] [Cancelar plan] (webhook verifica que responde el whatsappPhone del
> merchant; "Aprobar" reutiliza EXACTAMENTE el envío normal K1 extraído a
> sendQuote.service). Anti-spam literal: 1 propuesta/cliente/90d · waOptOut · horas
> tranquilas (9-21 Madrid) · 2 aplazamientos seguidos → pausa sola. Métrica € por
> origin en Informes (KPI "De mantenimientos" si >0). Flag MAINTENANCE_ENABLED por
> merchant — ON solo demo. Fuera de ventana 24h el aviso al pro degrada con dignidad
> (draft visible en BO + evento 360); plantilla opcional `maintenance_proposal_es`
> especificada en WHATSAPP_TEMPLATES §6 (alta en Meta = fundador; J6 intacto).
Casos semilla por gremio (el pro siempre edita): clima → revisión A/A pre-verano (12m), caldera pre-invierno (12m) · fontanería → termo/calentador (12m), descalcificador (6m) · electricidad → revisión cuadro (24m) · cerrajería → engrase (24m, opc.) · pintura → repaso comunidades (36m) · reformas → visita post-obra garantía (12m).
Proponer: en quote→accepted (o invoice→paid), si una línea matchea categoría mantenible del gremio → toggle "Crear recordatorio de mantenimiento" con intervalo prefijado editable. Modelo: `MaintenancePlan {merchantId, customerId, quoteId?, title, intervalMonths, nextDueAt, active}`.
Ciclo: cron diario 10h → vencidos → quote `draft` desde líneas del plan (`origin='maintenance'`) → **WA al PRO** (nunca directo al cliente): "🔧 Toca revisión de [X] de [Cliente]. ¿Enviar presupuesto de [importe]? [Aprobar y enviar] [Posponer 30d] [Cancelar plan]" → aprobar = flujo normal.
Métrica: € cobrados con `origin='maintenance'`/mes (KPI Home). Anti-spam: 1 propuesta/cliente/90d · respeta `waOptOut` · horas tranquilas · 2 rechazos seguidos → plan se pausa solo.

## PERFIL-1 · Perfil público · flag `PUBLIC_PROFILE_ENABLED`
> **✅ CONSTRUIDO (EXT3 Ola 14, 6-jul-2026, autorización A10.0):** /p/:slug con todo lo público
> de la spec y 404 digno con flag OFF; reglas de slug en servidor (reservados+único+1/30d);
> tarjeta "Tu página pública" en Configuración; QR PNG 1024 (`/admin/merchant/public-profile-qr`,
> lib `qrcode`); atribución `?src=profile|qr` cableada en landing/precios/register (first-touch
> V0-3). Flag por-merchant vía columna `merchants.flags` (Parte P) — ON solo en demo. Prefill del
> wa.me: "Hola, quiero pedir un presupuesto" (derivado del label oficial; veto del fundador
> pendiente, regla 30).
> **✅ QR→BOT (8-jul-2026, feature fundador):** el botón del perfil abre el BOT de YaQu (config
> `WHATSAPP_BOT_PHONE`, número compartido) con el merchant en el texto (via su slug `/p/<slug>`),
> NO el WhatsApp del pro. El bot (`handleQrEntry` en botFlow) resuelve el merchant por slug (solo
> perfil público ACTIVO), CREA/asocia el cliente con su teléfono (name provisional "Cliente nuevo")
> y arranca la solicitud A18 — **única captación de desconocidos permitida en K1, y solo con un QR/
> enlace explícito del negocio**. Copy K1 nueva del saludo QR: *"👋 ¡Hola! Te paso con *{negocio}*.
> Cuéntame en una frase qué necesitas y les envío tu solicitud de presupuesto."* Sin `WHATSAPP_BOT_PHONE`
> configurado → el botón cae al wa.me del pro (comportamiento anterior). Mejora pendiente: usar el
> nombre de perfil de WhatsApp del remitente en vez de "Cliente nuevo".
`/p/:slug` (slug único minúsculas-guiones; lista reservada admin/api/pay/p/login…; editable 1 vez/30d). **Público:** nombre comercial, logo, gremio(s), zonas (chips), años de experiencia (opc.), botón "Pedir presupuesto por WhatsApp" (wa.me del PRO prefilled; si BOT activo, alternativa al número YaQu), link reseñas Google si `googleReviewUrl` (reseñas propias = F3), footer "Hecho con YaQu" → `?src=profile`. **NUNCA público:** precios, clientes, volumen, email, NIF, dirección exacta. **QR:** generador en BO (PNG alta res para furgoneta/tarjeta) → `/p/:slug?src=qr`. Loop medido: registros con `acquisitionSource∈{profile,qr}`.

## ONBOARD-2 · Catálogos por gremio
> **✅ CONSTRUIDO (EXT3 Ola 17, 6-jul-2026, autorización A10.0):** data/catalogs/{gremio}.json
> con el schema literal (nombre/unidad/precioOrientativo{min,max}/categoria/mantenible) — 25-28
> ítems/gremio + 3-5 plantillas/gremio; TODO en `status:'draft_pendiente_validacion'` (regla de
> contenido: 2-3 profesionales reales por gremio validan ANTES del seed a merchants reales —
> checklist fundador). load-catalog: ES usa el fichero (precio=punto medio, descripción con
> etiqueta "Precio orientativo (min–max) — ajústalo a tu zona", siembra plantillas si no hay),
> LATAM mantiene el catálogo TS clásico; idempotente. CSV sigue como vía avanzada.
`data/catalogs/{fontaneria|electricidad|climatizacion|cerrajeria|pintura|reformas}.json` — 25-40 ítems/gremio: `{nombre, unidad, precioOrientativo:{min,max}, categoria, mantenible?:intervalo}`. **Regla de contenido:** precios ORIENTATIVOS etiquetados; el contenido se redacta EN EL SPRINT y se valida con 2-3 profesionales reales por gremio antes del seed — el master define estructura, no inventa 200 precios. Carga: selector de gremio → import con margen default aplicado → todo editable. Duplicar producto sí; catálogo entre merchants no. Plantillas de presupuesto frecuentes (3-5/gremio: "Cambio de termo", "Punto de luz", "Pintura piso 80 m²") → sistema de plantillas existente, seed por gremio. CSV se mantiene como vía avanzada (tarifas de distribuidor).

## JOB-1 · Trabajo mínimo — feature de DINERO, no de organización
> **✅ CONSTRUIDO (EXT3 Ola 13, 5-jul-2026, autorización A10.0):** modelo+FSM L, auto-creación en los 3 accepts, vista lista por fecha con .ics, y CTA "Cobrar el resto" (V2: siempre acción del pro) reutilizando la maquinaria de tramos del accept. Sin OAuth, sin grid, sin fotos (gate R2).
> **✅ SCRUM-10 · TRABAJO-1 (8-jul-2026):** el `Job` se EXTIENDE (aditivo, no se recrea) a "contenedor Trabajo" con 4 columnas nuevas: `titulo` (String?, criterio nº+cliente, poblado en el accept), `direccion` (String?, dirección de la obra — sin fuente hoy → null, se llenará en la UI futura de crear/editar trabajo), `totalAceptado` (Decimal(12,2)?, total del Quote CONGELADO en el accept), `totalCobrado` (Decimal(12,2) NOT NULL default 0, MATERIALIZADO — la lógica de sumar los Charge pagados = SCRUM-13/COBROS-1). Poblados en `ensureJobForQuote`; `serializeJob` los devuelve con fallback a derivado para Jobs anteriores. Importes en Decimal(12,2) como el resto del sistema (no céntimos). NO toca Charge/pagos (AA1.4). Habilita SCRUM-11/12/13 y SCRUM-22.
> **✅ SCRUM-13 · COBROS-1 (9-jul-2026):** `Job.totalCobrado` se MATERIALIZA. `recalcJobCobradoForCharge` (job.service) suma DESDE CERO los `Charge` en estado `paid` del Quote del Job (idempotente: un webhook duplicado no cuenta 2×) y se invoca AL FINAL de `/webhooks/psp` y `/webhooks/mp` (fire-and-forget; la cadena de pago existente NO se toca — AA1.4). `serializeJob` deriva el semáforo `Pagado/Parcial/Pendiente` (`estadoCobroFor`, totalCobrado vs totalAceptado) para SCRUM-11. Alcance estricto: SOLO webhooks (tarjeta/Mercado Pago); el cobro manual Bizum/transferencia (que marca la Invoice pero no el Charge ni pasa por webhook) = SCRUM-28 (COBROS-2).
> **✅ SCRUM-28 · COBROS-2 (9-jul-2026):** el recálculo de `Job.totalCobrado` cubre TAMBIÉN el cobro manual (Bizum/transferencia). El núcleo se refactoriza a `recalcJobCobradoForQuote(quoteId)` = SUMA DESDE CERO del `total` de las **Invoices en estado `paid`** del Quote — la Invoice pagada es el denominador común de "cobrado" para TODOS los métodos (tarjeta/MP vía webhook y Bizum/transferencia manual), 1 tramo = 1 Invoice → sin doble conteo. `recalcJobCobradoForCharge` (webhooks) y el nuevo `recalcJobCobradoForInvoice` (invocado AL FINAL de `updateInvoiceStatusAdmin`, fire-and-forget) quedan como wrappers finos que resuelven el Quote y llaman al núcleo. `updateInvoiceStatusAdmin` no cambia (marca paid, permisos y audit intactos). **SCRUM-13 queda MADURADA:** "cobrado" = suma de Invoices `paid` (no Charges) → single-source-of-truth. Idempotente.
> **✅ SCRUM-11 · TRABAJO-2 (9-jul-2026):** la lista de Trabajos (`jobsView.js`) hace visible el cobro (PURO FRONT, el dato ya viaja de SCRUM-13/28): (1A) **pill de cobro** junto al importe reutilizando `.status-pill` canónico (Pagado→accepted verde, Parcial→pending ámbar, Pendiente→draft neutro, mismo mapeo que invoices); (1B) **barra de % cobrado** (`totalCobrado/totalAceptado`) con el **nuevo componente compartido `.progress`** (ver AB3 + DESIGN.md §5); (1C) **filtro** segmentado por estado de cobro (Todos/Pendiente/Parcial/Pagado + conteo) con botones del inventario, filtra antes del agrupado (no lo rompe). Sin backend, sin schema. Pendiente-nota: migrar los pills de estado FSM hand-styled (`JOB_STATE_META`) a `.status-pill` = otra tarea.
> **✅ SCRUM-12 · TRABAJO-3 (10-jul-2026):** existe el **detalle del Trabajo** (`jobDetailView.js`, se abre al clicar una tarjeta → `renderAppView('jobs-detail',{jobId})`; caso de router fuera de `HASH_VIEWS`). Endpoint **solo lectura** `GET /admin/jobs/:id` (`serializeJobDetail`, tenancy `findFirst{id,merchantId}`→404) que espeja `getQuoteDetailAdmin` con su propio fetch: **`invoices[]` con `status`/`paidAt`/`chargeId`** (GAP cerrado) + `charge` anidado + `customer.email` (todo **aditivo**, sin schema, sin tocar webhooks ni la cadena de pago). UI: layout `.detail-page` canónico — cabecera (totales aceptado/cobrado/pendiente + semáforo `.status-pill` + barra `.progress`), **timeline de documentos** (lista de actividad cronológica, patrón `customerDetailView`) y **bloque de cobros** por tramo que **REUTILIZA** las acciones del invoice-detail: Cobrar el resto (`collect-rest`), Marcar pagada (`PUT invoices/:id/status` + `payment-anomaly` A21.2), Confirmar Bizum (`confirm-bizum`, doble toque), Recordar (`send-reminder`), Reenviar WA (`resend-whatsapp` + `waFallbackBar`); todo vía `apiRequest`, y **tras cada acción re-fetch de `GET /admin/jobs/:id`** (semáforo/barra/timeline al día). `progressBar(pct,estado)` extraído a helper compartido (ver AB3/DESIGN §5); la lista quedó byte-idéntica. Pill de cobro **duplicado** a propósito (centralizar = SCRUM-30). **⚠️ Acoplamiento a vigilar:** el recálculo de `totalCobrado` en el **Bizum manual** depende de que `confirm-bizum` siga rebotando a `/webhooks/psp` (SCRUM-13); si eso cambiara, se rompería.
> **✅ SCRUM-66 · TRABAJO-4, selector tipoOperacion (22-jul-2026):** el diferenciador nº1 según la investigación (`docs/legal/INVESTIGACION_ALBARANES.md` §4.4) — NINGÚN software del mercado (ni español ni field service) modela esta distinción fiscal. `Job.tipoOperacion` string `OPERACIONES_SUELTAS|TRABAJO_UNICO` (aditivo, NOT NULL default `TRABAJO_UNICO` = el caso ACTUAL de YaQu, 1 presupuesto aceptado = 1 trabajo → los Jobs existentes quedan bien sin backfill). Distingue **varias operaciones sueltas** (varias visitas al mismo cliente → agrupables en recapitulativa mensual, art. 13 RD 1619/2012) de **un trabajo único** (una prestación → factura al concluir, puede cruzar meses). Constante de dominio `JOB_TIPOS_OPERACION` en `job.service.ts` (patrón `ALBARAN_MODOS_VALORACION`). Editable en el detalle del Trabajo vía `PATCH /admin/jobs/:id` (validación estricta → 400 `invalid_tipo_operacion`; SIEMPRE editable mientras el Job esté abierto — el candado es de SCRUM-17), expuesto en `serializeJob`/`serializeJobDetail`. UI (`jobDetailView.js`): selector de DOS TARJETAS con lenguaje de oficio (🔧 "Varios avisos o visitas sueltas" / 🏗️ "Una obra o reforma de varios días") + pie "Nos ayuda a preparar tus facturas correctamente. Si tienes dudas, confírmalo con tu asesor." **COPY corregido respecto al ticket** (el original prometía la agrupación mensual, que aún no existe: el MOTOR que respeta la bandera es SCRUM-17 — prometerlo sería vender lo que no hay). `recordAudit('tipo_operacion_elegido')` SOLO al cambio real (traza de que la decisión la toma el usuario/su asesor — caveat del ticket; la frontera tracto único/sucesivo es casuística: DGT V1659-25/V0077-25, TEAC 23/03/2010). **V1 = schema + selector + persistencia + audit; NO construye el motor de recapitulativa/rotura por mes natural (eso es SCRUM-17).** Tests: `tests/scrum66-tipo-operacion.test.mjs` (puro: enum cerrado; gateado staging: default `TRABAJO_UNICO`, PATCH valida enum, audit del cambio + idempotencia, tenancy 404). Doc de usuario: `docs/COMO_FUNCIONA_YAQU.md` §2.
> **⚠️ SCRUM-14 · ALBARAN-1 (13-jul-2026): del cajón F3 salió el albarán/parte de trabajo.** El gate "validar con 2-3 gremios antes de construir" fue OMITIDO CONSCIENTEMENTE por decisión del fundador (comentario del 13-jul en Jira SCRUM-14; el asesor recomendó validar primero y queda registrado el desacuerdo — riesgo asumido de re-trabajo). Alcance V1: entidad `Albaran` NO fiscal colgando del Job, estados en Parte L, serie propia `ALB-YYYY-NNN` (no fiscal, independiente de facturas), SIN precios, firma opcional en el móvil del pro, SIN WhatsApp (solo PDF descargable), fotos vía Attachment. Checklists y materiales SIGUEN en el cajón F3.
Por qué: `terminado` es el trigger limpio del segundo tramo (V2) y el ancla de fotos/mantenimiento/asignación. Por qué mínimo: checklists, partes de trabajo y materiales = Jobber-clone → cajón F3.
Auto-creación al accepted. Estados: ver L. Campos: `scheduledAt?`, `assignedUserId?` (Equipo), `notes` internas, fotos (gate R2). UI: lista "Esta semana" (lista simple por fecha, NO calendario grid) + botón **.ics** "Añadir a mi calendario" por trabajo. NO incluye: Google Calendar OAuth (cajón F3), recordatorio de visita al cliente (F3: requeriría plantilla Meta nueva), vista mensual.
> **✅ SCRUM-65 · ALBARAN-4, albarán VALORADO (17-jul-2026):** levanta el "SIN precios" de SCRUM-14 — hallazgo legal verificado (`docs/legal/INVESTIGACION_ALBARANES.md` §1.3, fuentes Wolters Kluwer/Cegid/Anfix/Billeo/Factorial): el albarán PUEDE llevar precios ("albarán valorado") y **sigue SIN validez fiscal** (no devenga IVA, no sustituye a la factura). `Albaran.modoValoracion` string `SIN_VALORAR|VALORADO` (aditivo, default `SIN_VALORAR` = comportamiento intacto; congelado desde `emitido`, editable solo en `borrador` como el resto del documento). Las líneas (`lineas Json`) admiten `precioUnitario?`/`tipoIva?` opcionales — `tipoIva` en tanto por ciento entero (21/10/4/0), distinto de la fracción 0.21 de `Quote.lines[].tax`. `validarLineas(input, modo)` exige AMBOS campos en TODAS las líneas si `VALORADO`, y los rechaza si `SIN_VALORAR`. `calcAlbaranTotales` en **enteros de céntimos** (redondeo por línea, nunca floats acumulados), **sin desglose de cuota por tipo de IVA** (a propósito: un albarán valorado no debe leerse como una factura) — expuesto en `serializeAlbaran().totales`. UI (`jobDetailView.js`): toggle "Incluir precios en el parte" + subtexto "El parte sigue sin ser una factura" al crear (y en el editor mientras siga en borrador); columnas precio/IVA + total orientativo en vivo (misma aritmética que el backend). Prerequisito duro de SCRUM-17 (factura recapitulativa).
> **✅ SCRUM-67 · ALBARAN-5, PDF legalmente impecable (17-jul-2026, mismo PR que SCRUM-65):** rotulación reforzada en el PDF del albarán, EN AMBOS MODOS — leyenda **"Documento sin validez fiscal. No es una factura."** (reemplaza el pie anterior); **fecha de emisión** (`Albaran.createdAt`) Y **fecha de entrega/ejecución** (`Albaran.fecha`, la que cuenta para el mes natural de SCRUM-17) mostradas por separado; **Receptor** (nombre/NIF del cliente si `Customer.legalName`/`taxId` existen, snapshot — sin domicilio: tampoco lo imprime hoy el PDF de factura fiscal) junto al Emisor ya existente; **Referencia** al Trabajo/presupuesto origen (`Job.titulo`) separada de **Obra** (`Job.direccion`). Solo en modo VALORADO: columnas precio unitario/importe por línea + bloque de totales (base + total) con la leyenda **"Importes orientativos; el IVA y la factura se emitirán conforme a la normativa vigente."** — sin desglose de cuota. Tests: `tests/albaran.test.mjs` (puros: validación ambos modos, aritmética de céntimos con caso 45€×2h+100€ y caso de redondeo 1.1×10×3; gateado end-to-end contra staging: legacy sin modo, VALORADO con candado tras emitir, PDF 200/application-pdf en ambos modos — el contenido VISUAL de las leyendas se verifica con Playwright MCP, no hay parser de PDF en el repo).
> **✅ SCRUM-68 · ALBARAN-6, evidencias probatorias de la firma (22-jul-2026):** refuerza la fuerza probatoria de la firma (remota e in situ) sin tocar el flujo ni los estados (Parte L intacta). Nueva columna `Albaran.evidenciaFirma Json?` (aditiva, nullable) sellada al firmar: `{ v, canal(remoto|in_situ), firmadoAt (reloj del SERVIDOR, ISO — no el del cliente), ip, ua, tokenId (=`firmaToken` en remoto; `null` in situ), firmante (nombre del cliente del albarán), hashAlg:'sha256', contentHash }`. El `contentHash` es SHA-256 del **CONTENIDO canónico** del albarán (numero/fecha/modoValoracion/líneas/obra/referencia/cliente/emisor/nif/notas serializados de forma determinista, claves fijas, `null` explícito) — **no del binario del PDF** (§1.3 de `docs/legal/INVESTIGACION_ALBARANES.md`): lo que se firma es el contenido, y cualquier alteración posterior cambia el hash (prueba de integridad). `computeAlbaranContentHash` + `buildFirmaEvidencia` en `albaran.service.ts`; captura de `ip`/`ua` vía `requestIp(req)` + `user-agent` en AMBOS endpoints de firma (`albaranes.routes.ts` in situ, `albaranPublic.routes.ts` remoto). El PDF (`albaranPdf.service.ts`) añade un bloque **"Certificado de evidencias"** (firmante, sello temporal con hora del servidor, canal legible, hash) con la advertencia de que la fuerza probatoria la valora la autoridad competente. **PRIVACIDAD — invariante duro (RGPD):** `ip`/`ua` son datos personales → viven SOLO en la columna `evidencia_firma`; NUNCA se exponen: `serializeAlbaran` no los saca (ni `evidenciaFirma` entero), el PDF pinta hash/firmante/canal pero **jamás** ip/ua, y la página pública `/albaran/:token` y el JSON de `POST /firmar` no los filtran (todo cubierto por test). Tests: `tests/scrum68-evidencias-firma.test.mjs` — 4 puros del hash (hex de 64, determinismo, sensibilidad a cualquier cambio de contenido, `null`≠`''`) + 1 gateado end-to-end contra staging (sella ambos canales con tokenId correcto + verifica que ip/ua/hash NUNCA se exponen en respuesta/HTML/serializer + PDF con certificado 200). Migración: `evidencia_firma JSONB` aditiva (sin default, sin UNIQUE → `db push` sin `--accept-data-loss`) — staging ✅, prod ⏳ (db push tras el merge, con preview + OK del fundador; ver `docs/MIGRATIONS_PENDING.md`).
> **✅ SCRUM-17 · FISCAL-2, factura recapitulativa con motor de rotura por mes natural (22-jul-2026):** consolida albaranes firmados de un Trabajo en factura(s) recapitulativa(s) (art. 13 RD 1619/2012). **Diferenciador nº1:** si la selección cruza meses NO rechaza → genera **N facturas, una por mes** (motor de ROTURA, patrón Sage 200), avisando antes ("se crearán 2 facturas: marzo y abril"). Construido sobre SCRUM-65 (albarán VALORADO: los importes ya viven en las líneas) y SCRUM-66 (respeta `tipoOperacion`: un `TRABAJO_UNICO` nunca ofrece recapitulativa). **Schema aditivo:** `Albaran.invoiceId Int?` (+índice; badge "Facturado" DERIVADO de `invoiceId != null`, FSM Parte L intacta — regla 27) · `Invoice.albaranRefs Json?` (`[{albaranId, numero, fecha}]`, identifica las operaciones agrupadas — art. 6 Reglamento + advertencia TEAC). **Dominio puro** (`albaran.service.ts`): `validarConsolidacion` (firmado + VALORADO + no facturado + cliente único + no TRABAJO_UNICO; NO valida el mes — eso es rotura) + `groupByRotura` (clave = mes natural de `fecha`; **`tipoIva` NO rompe** — decisión fundador 22-jul: una factura admite desglose multi-IVA y el builder lo calcula de `lines`). **`emitInvoice()` compartido** nace en `invoicing.service.ts` (antes vacío; lo usará FISCAL-1/SCRUM-16): política **LAZY** de PDF/QR (PENDING; VeriFactu se aplica en `ensureInvoicePdf`). **Los 4 call-sites duplicados NO se migran** (dos aplican VeriFactu inline → cambiarlo rompería comportamiento; regla 9 — reportado). **Endpoint** `POST /admin/jobs/:id/consolidar-albaranes`: admin only (los técnicos no emiten facturas), **gate por `getEmissionMode`** (modo `receipt` → 409: la recapitulativa es documento fiscal puro, SIN variante justificante J-), **UNA `$transaction`** que emite N facturas con guard anti-doble-consolidación (`updateMany where invoiceId:null`; si el count no cuadra → rollback total) + **guard fiscal post-emisión** (`isReceiptNumber(number) → rollback`: una recapitulativa jamás sale J-). UI (`jobDetailView.js`): botón "Consolidar en factura" (solo si `OPERACIONES_SUELTAS` + partes elegibles) → modo selección con checkbox → **modal de rotura** (preview de N facturas por mes) → badge "Facturado". Doc de usuario: `docs/COMO_FUNCIONA_YAQU.md` §5 (honesto: latente hasta la certificación; visible en demo). **HALLAZGO → SCRUM-81 (High):** `allocateInvoiceNumber` resuelve `getEmissionMode` con `select` SIN `merchant.flags` → si `INVOICING_ES_ENABLED` se activara por override de merchant, el gate (con flags) y la numeración (sin flags) discreparían; el guard post-emisión lo cubre, pero debe arreglarse antes de activar el flag a un real. **Tests:** `tests/scrum17-recapitulativa.test.mjs` (11 puros + 1 gateado staging: 2 meses→2 facturas, IVA mixto 218.90, `albaranRefs`, re-facturar 409, SIN_VALORAR 400, TRABAJO_UNICO 409, receipt 409, tenancy 404). **LATENTE tras `INVOICING_ES_ENABLED=OFF` — nada activo a reales** (regla 24); agenda fiscal P6-P10 pendiente de dictamen (ver `SESION_ACTUAL_SCRUM-17.md`). Migración `invoice_id`+`albaran_refs` aditiva: staging ✅, prod ⏳ (db push tras el merge, con GO del fundador).

## MEDIA-1 · Foto y audio
Alcance: (a) foto de la avería adjunta a QuoteRequest (desde bot y portal); (b) audio del cliente por WhatsApp → STT → `description` del QuoteRequest [VALIDAR proveedor: Whisper/Deepgram, ~0,01 €/min]; (c) fotos antes/después ancladas a Job. Modelo: `Attachment {entityType, entityId, url, kind:'photo'|'audio', createdAt}`. Gates: credenciales R2 + `BOT_INBOUND_ENABLED` (para b). Privacidad: fotos solo de la avería/trabajo (no personas); audio se borra ≤30 días tras transcribir; retención fotos 12 meses salvo Job activo.

**FASE 3 — (a) foto→QuoteRequest ✅ IMPLEMENTADO (7-jul-2026).** Sin R2: se guarda el binario en Postgres (`Attachment.data` BYTEA + `mime`, columnas aditivas; `Attachment` abstrae el backend → migrar a R2 luego = plug-in). Pipeline: entrante `type:'image'` en `whatsappIncoming.routes` → `handleIncomingPhoto` (botFlow) → `downloadWhatsAppMedia(media_id)` (whatsapp.ts: GET /{id}→url temporal→bytes con token) → `saveQuoteRequestPhoto` (attachment.service) adjunta a la solicitud <48 h del cliente (prioriza el merchant de la sesión) → confirma con copy K1 nueva: *"📎 ¡Foto recibida! La he añadido a tu solicitud para que {negocio} la vea al preparar el presupuesto."* (sin solicitud reciente → cae al amable de handleUnsupportedMedia). BO: galería de miniaturas en la tarjeta de Solicitudes; servido con tenancy en `GET /admin/attachments/:id`. Solo mensajes de servicio (ventana abierta → 0 €). Suite del bot: paso 8.2. Pendiente aún (b) audio→STT y (c) antes/después (Job) + migración opcional a R2.

---

# PARTE S — SEGURIDAD, PERMISOS, AUDITORÍA Y RGPD

## S1. Roles `F1-doc (implementado; esta tabla es la verdad)`
| Capacidad | Admin | Técnico |
|---|---|---|
| Quotes/clientes/productos crear-ver · enviar WA · ver landing | ✅ | ✅ |
| Facturas: emitir/anular/R1 | ✅ | ❌ (ver sí) |
| Marcar pagado / deshacer | ✅ | ❌ |
| Configuración, datos fiscales, Connect, flags · billing/plan · equipo · exports | ✅ | ❌ |
Ruta nueva = declara rol mínimo; default Admin-only. **Lo hace cumplir un test, no la disciplina** (SCRUM-55).
> **✅ SCRUM-147 (27-jul-2026) — el rol se pregunta por CAPACIDAD, y lo desconocido cae al lado seguro:** nace del recon de SCRUM-137 (rol "comercial"). SCRUM-55 convirtió una denylist de rol en allowlist y dejó la lección escrita en `jobs.routes.ts:470`… **tres líneas más abajo de otras DOS que se quedaron sin convertir**: el filtro row-level de SCRUM-23 (`if (req.userRole === 'tecnico') where.operarioId = …`, lista y detalle de Trabajos). Al ser denylist, **cualquier rol que no fuera exactamente `'tecnico'` se saltaba el filtro** y vería TODOS los Trabajos del merchant — el rol pensado para tener los MISMOS permisos que el operario habría tenido MÁS. No mordía porque solo hay dos roles; habría explotado con el primero que se añadiera, que es justo el que lo destapó. **Fix:** `src/core/http/roleCapabilities.ts` — `seesAllJobs` es **allowlist de `'admin'`**, así que un rol desconocido (o ausente) queda RESTRINGIDO. **Con una asimetría deliberada y documentada:** en las MÉTRICAS (`isFieldMember`) el conjunto cerrado es el EXCLUIDO (admin/propietario), de modo que un rol nuevo **aparece** en el equipo de campo en vez de desaparecer — blindarlo en la misma dirección que el gate habría creado la otra mitad del problema. **Además:** `team.routes.ts` **valida** el rol (400 `invalid_role`) en vez de **coaccionarlo en silencio** — antes cualquier valor ≠ `'admin'` se reescribía a `'tecnico'`, así que pedir `role:'comercial'` creaba un técnico sin avisar (y hacía imposible crear el rol por API). **Tests:** 6 puros sin gate, con un guard ESTRUCTURAL que falla si vuelve a aparecer `req.userRole === 'tecnico'` en el fuente — el arreglo es una CLASE, no dos líneas. Probado en rojo por partida doble: reintroduciendo la denylist (el guard la nombra con fichero y línea) e invirtiendo `seesAllJobs` a denylist (cae el test del rol desconocido). **Desbloquea SCRUM-137**, que queda pendiente de decidir rol-vs-puesto.
> **✅ SCRUM-55 (22-jul-2026, absorbe SCRUM-54):** hasta hoy esta regla no la hacía cumplir NADA — 124 rutas
> bajo `/admin`, 79 llegaban a un Operario sin declaración de rol, y la 125 iba a nacer abierta igual. Ahora
> un test de enumeración recorre TODAS las rutas montadas bajo `/admin` y **falla si alguna no declara rol**:
> o lleva `requireRole(...)` (en el montaje, en un `router.use` o en la propia ruta), o está en la lista de
> visibles para Técnico **con motivo** (`src/core/http/adminRouteDeclarations.ts`). Ni lo uno ni lo otro =
> build roja nombrando método y path. **Corre en `npm test` NORMAL, sin gate** (`tests/scrum55-admin-fail-closed.test.mjs`):
> no toca BD ni levanta servidor. El "sin gate" es deliberado — A12.4 solo corría en `test:staging` y se cayó
> ENTERA sin que nadie se enterara: una red que solo funciona en staging no es una red. El test caza además
> dos fallos que antes eran invisibles: **entradas muertas** (declaraciones que apuntan a rutas inexistentes —
> así vivió `GET /admin/billing/summary`, que pasaba el test porque el `requireRole` del montaje devolvía 403
> antes del 404) y el **salto del helper `mountAdmin`** (Express 5 no conserva el prefijo del montaje, así que
> un `app.use` suelto dejaría sus rutas fuera de la auditoría). **Complementa a A12.4, no lo sustituye:** aquel
> comprueba el 403 de COMPORTAMIENTO con sesión de técnico; este garantiza que su lista esté COMPLETA. Corolario
> operativo: los gates de rol van con `requireRole` (marcado con `__requiredRole`), **nunca con un `if` inline**
> dentro del handler — protege igual pero es invisible para la red; y donde el router entero sea Admin, el gate
> va en el MONTAJE (los 4 routers así montados tenían 0 agujeros; los que gateaban ruta a ruta los tenían justo
> en las añadidas después). Estado de la auditoría y rutas aún sin clasificar: U2.
> **✅ SCRUM-92 (22-jul-2026, AUTH):** `/auth/login` (`requestMagicLink`) solo buscaba la cuenta
> en `Merchant` — un Operario (`TeamMember`) salía por un `return` silencioso: sin token, sin
> email, con la pantalla mintiéndole ("recibirás el enlace en breve", que nunca llegaba).
> Afectaba a TODOS los operarios desde el **segundo** acceso (el primero funciona vía
> `inviteTeamMember`, otro camino) — cerrar sesión, cambiar de móvil o que caduque la cookie los
> dejaba fuera para siempre, sin más salida que el Admin reenviando la invitación (que nadie
> sabía que hacía falta). Bloqueaba el plan Equipo. Fix: `requestMagicLink` también busca en
> `TeamMember` y emite el MISMO `AuthSession {merchantId, teamMemberId, type:'magic_link'}` que
> ya crea `inviteTeamMember` — `verifyMagicLink`/`getSession`/`authMiddleware.ts` **no se
> tocan**, así que el rol/tenancy de la sesión resultante no es lógica nueva (verificado
> end-to-end en el test: token real → verify real → cookie real → 403 real en ruta admin-only
> con la sesión del operario). `suspended` = mismo trato que "no existe" (logueado en servidor,
> nunca revelado al usuario); `invited` se deja pasar a propósito (se activa al canjear, como
> la invitación). Preguntas abiertas del ticket resueltas contra el schema: multi-merchant
> imposible (`TeamMember.email` `@unique` global); colisión Merchant/TeamMember con el mismo
> email — rara pero posible — gana el Merchant. Respuesta 200 genérica de `/auth/login` intacta
> (anti-enumeración). Único archivo tocado: `auth.service.ts`. Sin schema. Hallazgo colateral NO
> corregido (`docs/BUGS.md` P0-AUTH-1): `registerMerchant` (`/auth/register`) no comprueba
> `TeamMember.email`, mismo tipo de colisión pero auto-inducida — fuera de alcance.
> **✅ SCRUM-94 (23-jul-2026, AUTH):** cierra ese hallazgo colateral de SCRUM-92. `registerMerchant`
> (`/auth/register`) solo comprobaba `Merchant.email`; un operario podía registrarse con SU email y
> crear un Merchant nuevo, y desde entonces su magic link daba precedencia a ese Merchant (SCRUM-92)
> → perdía el acceso como operario, sin que el Admin pudiera arreglarlo. Fix (opción 1): si el email
> es un `TeamMember` **no suspendido** (active O invited — el invited también quedaría ensombrecido) y
> no es Merchant, se RECHAZA el alta con **409 `email_belongs_to_team`** y mensaje claro pero GENÉRICO
> (no revela la empresa), sin crear merchant fantasma. `suspended` sí puede registrar su negocio (ya
> no entra como operario, es legítimo). Coste asumido a conciencia por el fundador: el 409 hace un
> email de operario distinguible de uno nuevo (`/register` deja de ser 200-para-todo) — se filtra
> "este email es de algún equipo", sin empresa; valor bajo para un atacante, frente a la variante
> silenciosa, que metería a alguien que quería CREAR su negocio en la cuenta de su jefe sin
> explicación (peor: usuario legítimo perdido). Archivos: `auth.service.ts`, `auth.routes.ts`,
> `register.html` (ahora muestra `message`). Test gateado nuevo. Sin schema.
> **✅ SCRUM-73 (22-jul-2026):** `GET /admin/exports/verifactu.xml` NO cumplía esta tabla — generaba
> registros RRSIF (huellas + encadenamiento) sin consultar `INVOICING_ES_ENABLED` y era accesible a
> Técnico. Con SIF-1 sin cerrar y el flag OFF, los merchants ES reales emiten justificantes (J-), no
> facturas fiscales — un XML VeriFactu sobre ese estado no representa registros válidos (reglas
> 24/26: riesgo de que un merchant lo presente como "ya cumplo VeriFactu"). Fix: gate a
> `INVOICING_ES_ENABLED` (confirmado como el flag canónico — Parte P: gobierna "factura fiscal ES a
> reales", que es justo lo que exporta este XML; `SIF_ENABLED` gobierna la remisión a AEAT, un paso
> posterior e independiente) → **404 neutro y CERO registros generados** con el flag OFF, gate ANTES
> de tocar la BD de facturas; `requireRole('admin')` + alta en `ADMIN_ONLY_ROUTES` (patrón SCRUM-54).
> Sin tocar la lógica de generación del XML ni el encadenamiento de huellas. Test end-to-end contra
> staging con una factura F1 real con huella: técnico→403, flag OFF→404 sin fuga (ni el número de
> factura aparece en ningún body), flag ON (override por merchant)→200 con el registro correcto.
> **✅ SCRUM-82 (23-jul-2026):** completa el hueco que dejó SCRUM-25 a propósito — el ZIP
> (`GET /admin/exports/datos.zip`) ya tenía el gate `INVOICING_ES_ENABLED` (reutilizado de SCRUM-73)
> y la omisión limpia con el flag OFF, pero la rama ON no hacía NADA: el XML seguía sin entrar, EN
> SILENCIO. Peor aún — confirmado leyendo el código, no solo descrito en el ticket —: con el flag ON
> el `LEEME.txt` dejaba de avisar "no incluye el XML" sin que el XML llegara a incluirse de verdad:
> un aviso que se apaga solo cuando lo que anuncia sigue sin ser cierto, justo el día que nadie
> volvería a mirar el LEEME. Fix: constructor RRSIF extraído de `GET /verifactu.xml` a
> `buildVerifactuRegistrosXml()` (`verifactu.service.ts`) — MISMA fuente para el endpoint suelto y el
> ZIP, cero divergencia posible; `GET /verifactu.xml` pasa a ser gate + llamada al servicio, mismo
> comportamiento exacto. **Decisión del fundador — un XML por AÑO NATURAL que toque el rango pedido**
> (no por el rango en sí): el registro RRSIF se organiza por ejercicio y la cadena de huellas es
> anual — recortar por meses rompería el encadenamiento, mezclar años no representaría un registro
> válido. **Fail-closed deliberado** (asimetría con los PDF del mismo ZIP, que sí toleran fallos
> parciales con aviso): si la generación del XML falla, el ZIP entero se aborta ANTES de la primera
> cabecera — "mejor un error que un paquete que dice de más" (cita literal del fundador). El LEEME
> nombra cada archivo real (`verifactu_AAAA.xml`) en vez de un booleano genérico. Verificado con el
> flag ON en staging real, 2 años cruzando el rango: el XML de cada ejercicio dentro del ZIP es
> idéntico al de `GET /verifactu.xml?year=N` suelto salvo `fechaGeneracion` (timestamp de la llamada,
> no un dato de la factura — normalizado antes de comparar). Confirmado en Railway: OWNER_EMAILS
> aparte, ningún merchant real tenía el override activado — la fuga del LEEME era teórica hoy y
> se habría vuelto real el día que se encendiera el flag. Sin schema.
> **✅ SCRUM-98 · Guard A (23-jul-2026):** nace de la auditoría SCRUM-88 (`docs/AUDITORIA_SUPERFICIE_PUBLICA.md`),
> que encontró SEIS puertas de la misma fuga (SCRUM-72/74/85/87/90/95) descubiertas por tropiezo, cada fix
> destapando la siguiente — nadie se preguntaba de forma sistemática "¿esta ruta PÚBLICA resuelve su recurso
> por un id adivinable o por algo verificado?". Mismo mecanismo que SCRUM-55 pero en el otro extremo: un test
> de enumeración (`tests/scrum98-public-access-fail-closed.test.mjs`) recorre TODA la superficie pública
> (todo lo montado antes de `requireAuth`, o gateado solo por `requireInternalSecret`/firma) y **falla si
> alguna ruta no declara categoría de acceso** — `token` (campo opaco único), `internal`, `signed-webhook`
> (firma fail-closed), `session-gated` (`requireAuth` real) o `no-sensitive-resource` — en
> `src/core/http/publicAccessDeclarations.ts`. **Sin marcador en middleware** (a diferencia de `requireRole`
> con `__requiredRole`): no hay una comprobación de runtime compartida que "token" pueda aprovechar, cada
> handler hace su propio `findFirst`/`findUnique` — un marcador ahí sería teatro, no protección; la
> declaración vive solo en el archivo y un humano la revisa en el diff (mismo patrón que `TECNICO_ALLOWED`).
> `PUBLIC_PREFIXES` se extrajo a este archivo como fuente única, compartida con
> `tests/scrum55-admin-fail-closed.test.mjs` (antes vivía duplicada ahí); `/dev` sigue en la lista para que
> SCRUM-55 no lo marque huérfano, pero Guard A lo excluye de su propia exigencia (`GUARD_A_EXCLUDED_PREFIXES`)
> porque solo se monta fuera de producción. **Estado al clasificar: 40 rutas públicas → 31 declaradas + 3
> prefijos declarados en bloque (`/webhooks/psp`, `/charges`, `/invoice` — confían en que `requireInternalSecret`
> siga puesto en el montaje de `app.ts`; limitación conocida, documentada, sin test que la cruce todavía) + 9
> aparcadas con ratchet (`PUBLIC_ACCESS_PENDING_MAX=9`, solo mengua) y plazo 30-sep-2026: las 7 de la familia
> `Quote` (nunca migró a token opaco, a diferencia de `Charge`/`Albaran` — `/pay/quote/:id[/accept|reject]`,
> `POST /quote/:id/accept|reject|decision`; esta última es SCRUM-95) y las 2 de webhooks fail-open
> (`/webhooks/mp`, `/webhooks/whatsapp` — SCRUM-99). **Límite honesto** (mismo que SCRUM-55 con la lógica de
> rol): no verifica que un handler declarado `token` valide bien el token, solo que alguien lo afirmó y lo
> revisó — el complemento natural sería un test de comportamiento, mismo papel que `tenancy-permisos.test.mjs`.
> `npm test`: 192 · 164 pass · 0 fail · 28 skip (gateados), sin regresión en SCRUM-55.
> **✅ SCRUM-102 (23-jul-2026):** hallazgo MEDIO de SCRUM-88 — `fees.csv` (facturación de TODA la
> plataforma) y `platform-funnel` dependían SOLO de `isOwnerEmail()` (comparación contra la env var
> `OWNER_EMAILS`); verificado que hoy está bien puesta en prod, así que era endurecimiento, no
> incidente. Precedente SCRUM-99 (un secreto de webhook faltó en prod sin que nadie lo supiera): la
> seguridad de un dato multi-tenant no depende solo de una env var bien escrita. Fix: columna
> aditiva `Merchant.isPlatformOwner` (`Boolean @default(false)`) + `isVerifiedPlatformOwner()`
> (`env.ts`), que exige AMBOS factores (email en `OWNER_EMAILS` Y el flag en BD). Amplío a los 4
> usos reales de `isOwnerEmail` (fees.csv, platform-funnel, perk "Pro sin caducidad" de
> `GET /admin/me`, exención de paywall en `requireActivePlan`), no solo los dos con dato
> multi-tenant — mismo concepto en los cuatro sitios, aprobado por el fundador. `warnEmptyOwnerEmails()`
> (mismo patrón que `warnMissingWebhookSecrets` de SCRUM-99) avisa al arrancar en producción si
> `OWNER_EMAILS` queda vacía. **Orden de despliegue deliberado** (decisión del fundador, evita la
> ventana de auto-bloqueo): schema a staging → tests gateados → schema a PROD (columna en `false`,
> inofensivo mientras el código viejo no la lee) → UPDATE marcando el owner real en PROD → recién
> entonces se mergea el PR que despliega el código nuevo. Detalle del push (host-check, preview,
> verificación, UPDATE) en `docs/MIGRATIONS_PENDING.md`. Hallazgo colateral (NO corregido aquí, fuera
> de alcance): el cleanup de `tests/scrum74-recibo-token.test.mjs` falla por orden de borrado FK
> (`customer.deleteMany()` antes que `customer_events`) — a capturar como ticket aparte.
> **✅ SCRUM-105 (23-jul-2026) — CIERRE de la auditoría SCRUM-88:** agrupa los hallazgos BAJOS e
> INFORMATIVOS más los dos residuos que quedaron abiertos. `SESSION_SECRET` (fallback hardcodeado,
> código muerto confirmado — no se usaba en ningún sitio) eliminado. `INTERNAL_API_SECRET`
> documentado en `docs/RUNBOOKS.md` (R16): debe fijarse con `crypto.randomBytes(32)`, nunca a mano.
> `Referrer-Policy: strict-origin-when-cross-origin` global en `app.ts`. `console.error(tag, err)`
> con objeto crudo → `err?.message || 'error desconocido'` en los 10 sitios nombrados por la
> auditoría (`gemini.ts:54` con prioridad — la API key de Gemini ya viaja en la URL de la línea 30
> del mismo archivo — más `psp.routes.ts` ×6, `mpWebhook.routes.ts`, `team.routes.ts`,
> `dev.routes.ts`). **Los 3 informativos, criterio aplicado caso a caso:** el verify-token del
> handshake de WhatsApp pasa a `crypto.timingSafeEqual` (mismo patrón que el resto de secretos del
> código, coste cero); `Merchant.referralCode` (sufijo `Math.random()`) y el `Cobro #id` cosmético
> de `receipt.routes.ts` quedan ACEPTADOS sin cambio — ninguno protege un dato sensible ni añade
> riesgo real, y tocarlos sería consistencia cosmética sin beneficio (el código de referido es
> deliberadamente compartible/adivinable por diseño; el id de recibo solo aparece como texto ya
> detrás del `receiptToken`). **Residuo SCRUM-99:** `/webhooks/mp` y `/webhooks/whatsapp`
> reclasificados de `PUBLIC_ACCESS_PENDING` a `PUBLIC_ACCESS_DECLARED` (`kind: 'signed-webhook'`) —
> Guard A queda con **0 rutas aparcadas** de las 40 públicas, la auditoría completa clasificada.
> **Residuo SCRUM-102:** el fallo de `scrum74-recibo-token.test.mjs` no era orden de borrado (ya
> borraba `customerEvent` antes que `customer`) sino una RACE — `recordCustomerEvent` en
> `receipt.routes.ts` (POST feedback) es fire-and-forget y el 303 puede volver antes de que el
> INSERT aterrice; el cleanup ahora reintenta el par `customerEvent`+`customer` (hasta 5 veces,
> 100ms de espera) en vez de asumir que un solo borrado ordenado basta. Verificado 3/3 pases limpios
> contra staging real. **Con este ticket, SCRUM-88 queda completa: 18 hallazgos, todos con ticket
> propio o descartados a conciencia (SCRUM-95/96/97/98/99/101/102/105).**

## S2. Audit `F1-build mínimo + F2 completo`
F1: registrar en la tabla de eventos existente `marcar_pagado_manual`, `deshacer_pago`, `anular_factura`, `cambio_flag` (con userId+ip). F2: `AuditLog{merchantId,userId,action,entityType,entityId,meta,ip,createdAt}` para login, datos fiscales, Connect onboard, export, archivado cliente, cambios de plan; vista Admin.

## S3. Seguridad técnica (reglas duras) `F1-doc`
Cookies httpOnly+Secure+SameSite=Lax · rate-limit en magic link/login · Zod en TODO input · secretos solo env · **firma verificada en TODOS los webhooks** (Stripe, Connect, MP, Meta sha256; sin firma válida = 401+log) · no PII en logs (teléfonos enmascarados) · `npm audit` en CI `F2`.

## S4. RGPD y datos `F1-doc + acciones`
Bases: ejecución de contrato (merchant); interés legítimo/relación precontractual (cliente final, SOLO transaccional). Subencargados a publicar: Railway, Stripe, Meta, Resend, Anthropic, Mercado Pago (+R2 al llegar). Privacidad + DPA antes del primer pagante (B2.4). **Retención:** facturas y registros de facturación = plazos legales mercantiles/fiscales **[confirmar con asesor]**; NO se borran ni al cancelar cuenta. **Supresión cliente final:** anonimizar (nombre→"Cliente eliminado", phone/email→null) preservando facturas; prohibido borrado físico con facturas. **Cancelación merchant:** soft 30 días (solo lectura + export) → anonimizar lo no fiscal → conservar lo fiscal. Export = CSVs + zip PDFs + XML RRSIF (post-SIF). **Backups:** verificar política Railway **[VALIDAR]** + dump cifrado semanal fuera de Railway ANTES de 25 pagantes (`scripts/backup-dump.mjs` `F2-early`).
> **✅ SCRUM-93 (23-jul-2026, RGPD/Y3):** análisis completo de bases jurídicas por
> tratamiento + encargados necesarios en `docs/legal/RGPD_TRATAMIENTO_DATOS.md` (deriva de
> este mismo S4 y de `PACK_GESTORIA.md`/`PREGUNTAS_ASESOR.md`). Hallazgo: YaQu es
> **responsable** para los datos del profesional pero **encargado (art. 28)** para los datos
> del cliente final — confirma y detalla la línea "interés legítimo/relación precontractual
> (cliente final, SOLO transaccional)" de arriba. **Política de privacidad
> (`public/privacidad.html`) reescrita y publicada** (decisión del fundador: la versión
> anterior, vigente desde 3-jun-2026, no cubría IBAN/NIF/teléfono del profesional, dirección
> del cliente final ni la evidencia de firma — publicar la versión completa mientras se
> espera validación del asesor protege más que mantener la incompleta). **Aviso de firma para
> el cliente final: decidido PASIVO** (no casilla, no `LegalAcceptance`) — la base de
> IP/user-agent es ejecución del contrato + interés legítimo (eIDAS/Ley 6/2020), no
> consentimiento, que es revocable y no debe usarse para evidencia ya prestada; falta
> implementarlo en la página pública de firma (tarea de producto aparte). Confirma que hace
> falta Registro de Actividades de Tratamiento (art. 30 RGPD) — la excepción de <250
> empleados no aplica (tratamiento no ocasional). 6 preguntas nuevas para el asesor en
> `PREGUNTAS_ASESOR.md` punto 9.
> **✅ SCRUM-74 (22-jul-2026, 🔴 seguridad/RGPD, la otra puerta de SCRUM-72 D5):**
> `GET /recibo/:chargeId[/pdf]` y `POST /recibo/:chargeId/feedback` eran públicos por diseño
> (cliente final sin login) pero identificados por `Charge.id` — entero autoincremental
> ENUMERABLE, sin ningún secreto: cualquiera podía recorrer `/recibo/1`, `/recibo/2`… y ver/
> descargar NIF del emisor, nombre/email/teléfono del cliente final e importes de OTROS
> merchants. Fix (decisión del fundador, opción 1 — clona `Albaran.firmaToken` de SCRUM-49):
> `Charge.receiptToken` opaco (`crypto.randomBytes(16).hex`, `@unique`, perezoso vía
> `ensureChargeReceiptToken()`). Los 3 endpoints del router pasan a `findUnique` por token — el
> id numérico ya no resuelve nada. Alcance ampliado a los 3 (no solo `/pdf`, que era lo único
> nombrado en el ticket) tras un STOP explícito: la página HTML es el enlace real que llega por
> WhatsApp y necesita el token para enlazar al PDF protegido — dejarla en `chargeId` habría
> dejado la fuga abierta por la puerta principal. Generadores de enlace actualizados (WhatsApp,
> Stripe success/cancel, redirects post-pago, `/dev/*`, `receipt_url` legacy de `charges.routes.ts`).
> El botón dinámico de `payment_confirmation_invoice_es` **NO requirió re-aprobación en Meta**:
> la URL base aprobada no cambia, solo el valor runtime del sufijo (mismo mecanismo ya probado
> por `albaran_para_firmar_es`) — `docs/WHATSAPP_TEMPLATES.md` §4 actualizado. Schema vía
> `db execute` (falso positivo del `@unique`, patrón EXT3/SCRUM-49) aplicado a STAGING con
> host-check + GO del fundador; PROD pendiente del merge (`docs/MIGRATIONS_PENDING.md`).
> Enlaces `/recibo/:chargeId` ya enviados dejan de funcionar (asumido, sin clientes reales aún).
> **Hallazgo colateral NO corregido** (`docs/BUGS.md` P1-SEC-8): `/pay/card/:id`,
> `/pay/bizum/:chargeId`, `/pay/invoice/:chargeId` comparten el mismo patrón de `chargeId`
> enumerable en la RUTA (no solo en el destino de un redirect) — fuera del alcance pedido.
> **✅ SCRUM-85 (22-jul-2026, 🔴 seguridad/RGPD, la TERCERA puerta de la misma fuga —
> SCRUM-72 → SCRUM-74 → esta):** cierra P1-SEC-8. `/pay/card`, `/pay/bizum` y `/pay/invoice`
> reutilizan `Charge.receiptToken` (ya existía desde SCRUM-74 — **sin schema nuevo**), mismo
> patrón `findUnique` por token. Alcance real MUCHO mayor que "3 rutas": 13 generadores de
> enlace tuvieron que seguir para no dejar el flujo roto o con enlaces viejos conviviendo con
> los nuevos — `whatsappTemplates.ts` (`buildPaymentRequest`), `invoiceWhatsApp.service.ts`,
> `invoiceReminder.service.ts` (recordatorios 7/14d), `botFlow.service.ts` (bot),
> `invoicesAdmin.routes.ts`, `customerPortal.routes.ts` (portal `/cliente/:token`),
> `charges.routes.ts` (legacy, ya gateado), `jobs.routes.ts`, y `receipt.routes.ts` (su propio
> botón "Pagar con tarjeta", que se quedó en `chargeId` en SCRUM-74 porque `/pay/card` aún no
> estaba tokenizado). **Y el FRONTEND del dashboard** (`invoiceDetailView.js`,
> `jobDetailView.js`): construían `/pay/invoice/${chargeId}` client-side para el botón real
> "Enlace de pago" y la barra de fallback de WhatsApp fallido — sin arreglarlos habría sido una
> regresión funcional real (404), no solo un hueco de seguridad; se detectó y corrigió como
> parte del mismo cierre (backend ahora expone `payToken` junto a `chargeId`, que se conserva
> para la acción admin `/admin/charges/:chargeId/confirm-bizum`, no pública). El botón dinámico
> de `payment_request_es` tampoco requirió re-aprobación en Meta (mismo razonamiento que
> SCRUM-74 §4) — `docs/WHATSAPP_TEMPLATES.md` §2 actualizado. STOP de alcance confirmado por el
> fundador antes de cerrar (AskUserQuestion). Sin schema. **Hallazgo colateral NO corregido**
> (`docs/BUGS.md` P1-SEC-9): `/pay/bank/:id` y `/pay/mp/:id[/result]` comparten el mismo
> patrón — `/pay/bank` es el más sensible de los cinco (expone IBAN/CLABE del merchant).
> **✅ SCRUM-90 (22-jul-2026, 🔴 seguridad/RGPD, la QUINTA y ÚLTIMA puerta de la misma
> fuga — SCRUM-72 → SCRUM-74 → SCRUM-85 → esta):** cierra P1-SEC-9. `/pay/bank` y `/pay/mp`
> reutilizan `Charge.receiptToken` (SIN schema nuevo). `/pay/bank` era el más sensible de
> los cinco: exponía el **IBAN/CLABE del PROFESIONAL** (no del cliente final) — enumerable
> habilitaba recolectar cuentas bancarias de TODOS los merchants, riesgo de fraude por
> suplantación ("cambio de cuenta" en factura falsa). Alcance MUCHO más pequeño que SCRUM-85
> (6 archivos, no 16): `payBank.routes.ts`, `payMp.routes.ts` (2 endpoints), `mercadopago.ts`
> (`createMpPreference`: nuevo param `payToken` para los `back_urls`; `chargeId` se conserva
> SOLO para `external_reference`, reconciliación interna del webhook de MP, no pública), y
> los 3 generadores ya señalados con breadcrumbs `P1-SEC-9` en SCRUM-85
> (`payInvoice.routes.ts`'s `transfer.href`, `receipt.routes.ts`'s `payBtns`,
> `charges.routes.ts`'s `paybank_url`/`paymp_url` legacy). Sin frontend afectado esta vez
> (ni `/pay/bank` ni `/pay/mp` se enlazan desde el dashboard) y ningún botón de plantilla
> Meta apunta a estas rutas → sin re-aprobación que verificar. STOP de rutas + aviso previo
> a tocar staging, ambos confirmados por el fundador antes de cerrar. Sin schema.
> **Con esto quedan cerradas las CINCO puertas de la misma fuga**
> (SCRUM-72 estático público → SCRUM-74 `/recibo` → SCRUM-85 `/pay/card`+`/pay/bizum`+
> `/pay/invoice` → SCRUM-90 `/pay/bank`+`/pay/mp`).

---

# PARTE U — SPRINT REGISTRY (cola única — regla 31)

## U1. F1 (orden estricto; ∥ = en huecos de espera del anterior)

> ### 📌 ESTADO DE EJECUCIÓN (al 16-jun-2026 · lo mantiene Claude Code; detalle en `docs/EVIDENCIAS_E2E.md`, `docs/BUGS.md`, `docs/MIGRATIONS_PENDING.md`, `docs/PENDIENTES_FUNDADOR.md`)
> **Leyenda:** ✅ hecho y verificado · 🟡 borrador/parcial · ⏸ en pausa por decisión · ⏳ pendiente (humano/externo).
>
> **VALIDA-0** (U1.1): V0-0 ✅ (`INVOICING_ES_ENABLED` off + justificante `J-` + watermark DEMO) · V0-1 ✅ DONE (E2E móvil completo confirmado por el fundador; `EVIDENCIAS_E2E.md`) · V0-2 ✅ (`DEMO_SAFE_NUMBERS`) · V0-3 ✅ (funnel: `acquisitionSource`/`paid_via`/`quote_created_via` + vista BO) · V0-4 🟡 (página `/precios` + founding con contador real; precios Stripe en **TEST**, falta LIVE) · V0-5 ⏳ HUMANO (bug-bash dispositivos; checklist `docs/BUG_BASH_LANDING.md` lista 15-jun + percepción pre-arreglada en code-review: PC-B IVA, PC-A botón duda, PC-C/PC-D estados/microcopy, PC-E motion/AB6, PC-F N5 /pay/bank, PC-G política de señal V8, PC-H fecha/método en el recibo, PC-I 400 digno, PC-J foco AB6 en /recibo+/pay/invoice+/pay/bank, PC-K refactor estilos inline→tokens en /recibo) · V0-6 ⏳ HUMANO (calle: 10 discovery + vídeo + ≥3 founding).
> **DOCS-F1** (U1.2): ✅ COMPLETO — skills (`/yaqu-sprint`, `/yaqu-release-check`, `yaqu-premium-ui`, `yaqu-verifactu-sif`), hook `guard-dangerous`, `frontend-design` instalada, J7 builders+test, `RUNBOOKS.md`, `QA_MASTER.md`, flags (`core/flags.ts`), J3 `waOptOut`, check manifest PWA (Y1).
> **TOOLING-CODEX** (post-DOCS-F1, al 29-jun): espejo de la constitución y el tooling para el harness de Codex — `AGENTS.md` (equivalente a `CLAUDE.md`, derivado de este master, regla 35), `.codex/` (`config.toml` MCP Playwright + `hooks.json` + `hooks/guard-dangerous.sh` réplica del de `.claude/`), y skills espejo en `.agents/skills/` (`yaqu-*` + `impeccable`). ⚠️ **`impeccable` es skill de TERCEROS** (regla 36): presente en el repo; pendiente de que su permanencia quede ratificada por el fundador (ver nota en AA2).
> **SIF-1** (U1.3): S1-0 🟡 HUMANO (cert FNMT ✅ conseguido 15-jun con copia `.pfx`; falta alta en el entorno de pruebas AEAT + cita asesor) · S1-0b ✅ (`SIF_SPEC_NOTES.md`: VERI*FACTU NO exige XAdES → 100% Node) · S1-A ✅ (`AUDITORIA_RRSIF.md`: huella regenerada a formato oficial, vector de prueba AEAT en verde) · S1-B ✅ (modalidad documentada) · S1-C ✅ (registros alta/R1/anulación validados contra XSD oficial) · S1-D ⏸ PAUSA (espera decisión de representación del asesor) · S1-E 🟡 (`docs/legal/DECLARACION_RESPONSABLE.md` borrador) · S1-F ⏳ (revisión asesor) · S1-G ⏳ (cert + producción AEAT) · S1-H 🟡 (`docs/legal/PACK_GESTORIA.md` borrador).
> **Canal WhatsApp** (Parte J, en huecos de SIF-1): J3 ✅ · WA-0b (J4) ✅ (log + estados webhook + chip de entrega + tabla en prod) · J8 ✅ (métricas coste/entrega) · plantillas `payment_confirmation_invoice_es` y `merchant_alert_es` ✅ **Approved (15-jun) y CONECTADAS** (`e922495`, `b5fa810`): la 1ª sustituye a `payment_confirmation_es` en los webhooks de pago (botón "Ver documento" → `/recibo/:token`, token opaco desde SCRUM-74); la 2ª es el fallback al PRO con ventana 24h cerrada vía `notifyMerchantAlert` en pago (psp+mp, 15-jun) y en decisión de presupuesto (`quotes.routes.ts`, 16-jun). ⚠️ quedaron en categoría **Marketing** → recategorizar a Utility (P3-3).
> **CONNECT-1** (U1.4, avanzada "en huecos" durante DEMO-READY/EXT, jun-jul): C1-0 ✅ (flags+columnas `stripeAccountId`/`connectStatus`/`bizumPhone` en prod) · C1-1 ✅ (onboarding Express `connect.routes.ts` + webhook separado `connectWebhook.routes.ts` + card en Configuración) · C1-2 ✅ código (DIRECT charge con `application_fee_amount` en `payCard.routes.ts`; falta pago test real + refund documentado → RUNBOOK_PAGOS, acción fundador con Stripe) · C1-3 ✅ (copy 0,9 % en precios/Configuración + export owner `GET /admin/exports/fees.csv`, 5-jul) · C1-4 ✅ (Bizum manual asistido E2E visto por el fundador 4-jul) · C1-5 ✅ (selector W4 verificado en el barrido A6.6 a 390 real). **Activación = fundador:** webhook Connect en Stripe + `STRIPE_CONNECT_WEBHOOK_SECRET` + flags (PENDIENTES_FUNDADOR).
> **VOZ-1 · PRECIOS-1 · GTM-1**: ⏳ no iniciadas (van tras SIF-1).

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
- **V0-5 · Bug-bash landing cliente:** /pay/quote y /pay/invoice en 3 dispositivos reales (Android gama media, iPhone, tablet) contra la spec N. Done: `docs/BUG_BASH_LANDING.md` todo ✅; fallos → BUGS.md P0-percepción y se arreglan antes de grabar. **🟡 EN PREP 15-16-jun:** checklist `docs/BUG_BASH_LANDING.md` creada (matriz 3 dispositivos, P2-5 primero, mapeo N1-N5) + 4 hallazgos del code-review pre-arreglados y registrados en BUGS.md (sección P-PERCEPCIÓN): **PC-B** desglose IVA coherente con el Total `2f2c949` · **PC-A** botón "💬 Tengo una duda" `b488aa6` · **PC-C/PC-D** estado `accepted` con fecha + microcopy N5 `c566352` · **PC-E** motion accesible (`prefers-reduced-motion`) + anillo de foco AB6 `36ca2ef` · **PC-F** N5 en `/pay/bank` ("Copiar IBAN"/"Copiar referencia") `0a479a2` · **PC-G** política de señal V8 ("La señal no es reembolsable" en 50/50) `101a49d` · **PC-H** fecha+método en el recibo pagado `b6c45bb` · **PC-I** 400 digno (`documentNotFoundHtml`) en `/recibo`+`/pay/invoice`+`/pay/bank` + dead code `4a83a1f` · **PC-J** anillo de foco AB6 en esas tres `a5a531d` · **PC-K** refactor de estilos inline→clases/tokens DESIGN.md en `/recibo` `d34b12d`. Verificado código: P2-5 con `table-layout:fixed`; E (`/pay/bank` copiar con feedback) ✅ (microcopy N5 alineado en PC-F); F (`PUBLIC_BASE_URL` en prod) ✅ sondeado en prod (rechazo por formulario devuelve 400 limpio, no 500 → no es bug). Falta SOLO la pasada en 3 dispositivos reales (HUMANO).
- **V0-6 (HUMANO) · Calle:** lista 30 contactos (sheet) · **10 discovery registradas (Apéndice B) — sin esto el sprint NO cierra (regla 19)** · vídeo 60 s (guion: 0-8s "¿Cuántas señales has dejado de cobrar este mes?" → 8-25s dictado/creación en la furgoneta → 25-40s al cliente le llega el WA, abre, firma → 40-52s paga la señal; al pro: "💰 García te ha pagado 450 €" → 52-60s "YaQu. Cobra antes de empezar." + precio; la factura solo con marca de agua, cero claims fiscales) · 10 visitas a tiendas. **Founding:** cobrables YA con alcance por escrito (`docs/legal/ALCANCE_BETA.md`: "presupuestos+firma+cobro; la facturación VeriFactu se activa al cerrar la certificación, sin cambio de precio"); alternativa conservadora: reserva firmada sin cargo. **NO TOCAR antes de grabar:** countries completa, R2, SEO, refactors, nada fuera del camino de la demo. Done sprint: vídeo + 10 discovery + ≥3 founding cobrados-con-alcance (o reservas) + criterios de alarma evaluados.

### U1.2 · DOCS-F1
J7 builders+test · `waOptOut` + check · `docs/RUNBOOKS.md` (O) · `docs/QA_MASTER.md` (Q) · lectura de flags (P) · **CLAUDE.md + skills `/yaqu-sprint`, `/yaqu-release-check` y `yaqu-premium-ui` + hook anti-comandos-peligrosos (AA2)** · **UI-0:** instalar skill oficial `frontend-design` de Anthropic con revisión del fundador (AB7) · check manifest PWA (Y1). Todo aditivo; una tarea-un commit.
> **✅ SCRUM-75 (22-jul-2026):** el script `test` de `package.json` listaba los archivos de test
> EXPLÍCITAMENTE (deuda ya apuntada en P3-7/BUGS.md) — 5 archivos gateados reales
> (`scrum47-enviar-albaran-wa`, `scrum49-firma-remota`, `scrum50-bot-albaranes`,
> `scrum57-operario-propagacion`, y un 5º descubierto en esta misma tarea,
> `scrum68-evidencias-firma`) nunca se habían dado de alta → `npm test` los omitía en silencio
> (falsa cobertura). Verificados uno a uno, gateados contra staging: los 4 originales pasan
> 100 % en solitario. Root fix: `test` pasó a `node --test --test-force-exit tests/*.test.mjs` —
> Node 24 expande el glob él mismo (confirmado que NO recoge `tests/_staging-db.mjs` ni nada
> fuera de `tests/`, a diferencia del auto-discovery implícito de `node --test` sin argumentos,
> que sí se sale del directorio). Un test nuevo en `tests/` queda cubierto sin tocar
> `package.json` nunca más. Hallazgo colateral (NO corregido, registrado en BUGS.md P3-10): la
> suite gateada COMPLETA (`QA_DB_TEST=1 npm test`), corrida junta por primera vez gracias a este
> fix, es no-determinista bajo concurrencia contra staging (archivos que siempre pasan sueltos
> fallan al azar en el conjunto) — no bloquea este PR (sin schema, sin tocar staging) pero el
> exit code de la suite gateada completa no es hoy un gate de CI fiable.
> **✅ SCRUM-78 (22-jul-2026):** cierra los dos hallazgos colaterales de SCRUM-75. **P3-10**
> (no-determinismo bajo concurrencia): evaluadas 3 opciones (serie / aislamiento de datos por
> test / separar comandos), el fundador eligió separar `npm test` (rápido, sin cambios) de un
> `npm run test:staging` nuevo (gateado, `--test-concurrency=1`, EN SERIE) — se descartó aislar
> datos porque la mayoría de archivos YA usan merchant efímero y el síntoma (columna que "no
> existe" de forma transitoria) encajaba con contención del pool de Postgres, no con colisión de
> datos. Verificado: 2 ejecuciones seguidas de `QA_DB_TEST=1 npm run test:staging` dan el
> **mismo resultado exacto** (144 · 141 pass · 1 fail determinista · 2 skip) — cero ruido de
> concurrencia. **P3-9** (tests atados al merchant `id=1`, quemado por SCRUM-42): corregidos los
> 2 pedidos — `tenancy-permisos.test.mjs` y `webhooks-idempotencia.test.mjs` ahora crean su
> propio merchant/customer/quote/invoice efímero (patrón ya usado en `scrum23`/`scrum73`/etc.).
> Al arreglar el segundo apareció un bug latente enmascarado por el crash del `id=1`: el POST a
> `/webhooks/psp` no llevaba `x-internal-secret` (P0-SEC-1) → 404 silencioso; corregido con
> `internalHeaders()`. Al verificar `test:staging` en serie aparecieron 3 archivos MÁS con el
> mismo root cause (`pdfs.test.mjs` A12.5d, `a55-window-quote.test.mjs`, `bot-suite.test.mjs`) —
> fuera del alcance pedido (2 archivos exactos), documentados en BUGS.md P3-9 y anotados con
> `⚠️ P3-9` en cada archivo para que no se pierdan; candidatos a una tarea propia. Sin schema.
> **✅ SCRUM-80 (22-jul-2026, parcial):** el más barato de los 3 restantes de P3-9 —
> `tests/pdfs.test.mjs` (`A12.5d`) — corregido con el mismo patrón (merchant+customer+quote
> efímero), verificado 4/4 en solitario. `a55-window-quote.test.mjs` y `bot-suite.test.mjs`
> quedan SIN tocar a propósito: dependen de `DEMO_SAFE_NUMBERS`/semántica de merchant demo real,
> no de un simple id ancla, y migrarlos es más laborioso — candidatos a tarea propia. **No se
> pudo cerrar la verificación de `npm run test:staging` 100 % verde** en esta tarea: tras el fix
> salieron 10 fallos nuevos sin relación (`albaranes.invoice_id` no existía momentáneamente),
> causados por DOS sesiones concurrentes tocando staging a la vez (SCRUM-17 con un `db push` en
> curso, SCRUM-79 limpiando merchants huérfanos) — confirmado con el fundador, no es regresión de
> este PR. `pdfs.test.mjs` se verificó siempre aislado de ese ruido. Pendiente: re-correr
> `test:staging` completo cuando staging esté quieta. Sin schema.

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
> **PRECIOS-1 avance (EXT3 Ola 10, 5-jul-2026):** estados de suscripción L completos en el webhook único (past_due conserva plan + banner/portal; canceled→trial; idempotencia event.id) ✅ · entitlement usuarios W3 vía `core/entitlements.ts` (regla 34, 409 digno con oferta Equipo) ✅ · fair-use visible ya estaba (A9.3) ✅ · contratación founding con ALCANCE BETA aceptado y evidenciado (legal_acceptances, versión=hash; regla 25) ✅. Falta SOLO fundador: precios Stripe LIVE + texto del alcance validado por asesor.
PRECIOS-1: activar facturación a founding (post-SIF) + límite usuarios + contador fair-use WA + verificación upgrade/downgrade. GTM-1: landing yaqu.app v2 (héroe promesa de cobro, vídeo, 3 pasos, precios, FAQ 10 reales, CTA; Lighthouse móvil ≥90) + claim VeriFactu YA legal + declaración descargable + pack gestoría circulando + UTM/atribución en registro. SEO programático y calculadora de sanción → F2 (SEO-2, contenido para gestorías).

## U2. F2 (backlog ordenado por defecto; gate global 25 pagantes)
WA-0b → BOT-1 → MANT-1 → JOB-1 → MEDIA-1 → ONBOARD-2 → ANALYTICS-1 (X2) → **DASH-PREMIUM-1** (pulido del dashboard pantalla a pantalla según Parte AB; nunca rediseño total) → PERFIL-1 → PARTNERS-1 (gate Y2) → SEO-2 → SEC-2 (audit completo + `backup-dump` + `reconcile-stripe` + export-zip) → validUntil/expired → APP-1 (gate >100 pagantes) → FIN-1 (gate Z) → BOT-2 (gates K2). BIZUM-WATCH = recurrente trimestral (sep-26, dic-26, mar-27: si Stripe Bizum gana Connect support → activar + test fee).
**Nota:** U2 NO es compromiso: al alcanzar 25 pagantes se re-prioriza con los datos de F1 (regla 13) antes de abrir el primer sprint F2.

> **Decisión fundador 5-jul-2026 (A10.0, SPRINT_DEMO_READY_EXT3):** se adelanta la CONSTRUCCIÓN
> tras flag de JOB-1, PERFIL-1, MANT-1, ANALYTICS-1, validUntil/expired, ONBOARD-2 (maquinaria),
> DASH-PREMIUM-1 (pulido) y R14/V (blindaje money-flows) durante la ventana pre-demo;
> re-priorización comercial a 25 pagantes intacta (regla 13). Condiciones: specs SOLO del master,
> flags de Parte P nacen y quedan OFF (activar = fundador), GTM/prioridades de venta intactos.
> Nada más de U2/Z se desbloquea. (Nota añadida, nunca borrada — regla 16.)

> **✅ SCRUM-55 (22-jul-2026, carril B · absorbe SCRUM-54 · adelanto de SEC-2):** auditoría completa de
> rutas `/admin` — **124 rutas auditadas**, Nivel 1 (dinero/fiscal) cerrado y red fail-closed corriendo en
> `npm test` (doctrina y mecanismo en **S1**). Quedan **25 rutas sin clasificar**, en tandas 2-3, con **plazo
> 30-sep-2026**: pasado ese plazo el test falla. La lista de cuáles son vive SOLO en
> `src/core/http/adminRouteDeclarations.ts` y cambia en cada tanda — **no se duplica aquí a propósito**
> (una lista copiada en docs se queda obsoleta y luego alguien la cita). El máster dice que existen y dónde
> mirar; el código dice cuáles.

## U3. F3 / F4
F3: LATAM-1 (i18n MX/CO end-to-end, MP/SPEI/PSE, sin claim de factura, plantillas por locale re-aprobadas) · CFDI-1 (PAC add-on) · DIAN-1 · Chile · IA precios por zona (gate ≥10K líneas) · reseñas en plataforma · Google Calendar OAuth · API pública (gate Z) · TicketBAI (gate Z). F4: Parte Z.

---

# PARTE V — MONEY FLOWS `F1-doc · piezas build en F2`
**V1. Esquemas:** F1 = 100 % y 50/50. Hitos N tramos = F2-spec ligado a JOB-1 (cada hito = charge; trigger manual del pro).
> **✅ SCRUM-32 · money (10-jul-2026):** el **reparto del importe** de cada tramo se centraliza en `billingPlan.ts` (`distributeStageAmounts`/`getStageAmount`): **céntimos enteros** y el **ÚLTIMO tramo absorbe el resto** (`totalCents − Σ anteriores`) → la suma de tramos == total, **EXACTA** (par e impar; adiós al "151,26 de 151,25"). Usado por los **3 call-sites** de cobro (aceptar `/quote/:id/decision`, generar factura BO `/admin/quotes/:id/invoice`, cobrar el resto `/admin/jobs/:id/collect-rest`) en vez de `total × %` en float. **Base para planes personalizados (SCRUM-27).** No toca el `Charge` (sigue copiando `Invoice.total`), ni webhooks, ni la materialización de `totalCobrado` (SCRUM-13/28); sin schema. El reparto fino línea-a-línea del último tramo (`scaledLines` del PDF, ≤1 cént.) queda para las facturas de anticipo (SCRUM-16/17 → V3).
> **⚠️ REINTERPRETADO por SCRUM-141 (27-jul-2026) — leer antes de tocar `distributeStageAmounts`:** la función y su invariante (los tramos suman el total, exacto) **no cambian**; cambia **quién la consume**. `Invoice.total` ya NO se copia de aquí: se **DERIVA de las líneas** de esa factura (`grossOfLines`, `invoiceLines.service.ts`). Motivo: el total y las líneas se redondeaban por caminos distintos y podían diferir 1 céntimo, y esos dos números van a **dos campos de la MISMA huella VeriFactu** (`importeTotal` ← total · `cuotaTotal` ← líneas), que se sella, se encadena (`vfPrevHash`) y es **inmutable** (regla 29) — el descuadre solo se corregía con una R1. Decisión del fundador: **una factura es un documento AUTÓNOMO** (Hacienda no mira el presupuesto del que salió, mira si sus líneas suman su total), así que manda la coherencia interna. Este reparto sigue usándose como **objetivo** (`reconcileToTarget`) y se alcanza en el **~99,2 %** de los tramos; cuando el importe es *matemáticamente inalcanzable* (base y cuota redondean saltándolo) la suma de las facturas queda a **1-2 céntimos** del total del presupuesto — medido sobre 45.000 tramos, con tope en `tests/scrum141-factura-final.test.mjs` y explicado al usuario en `COMO_FUNCIONA_YAQU.md` §4. **NO restaurar el acoplamiento antiguo** para que la suma cuadre siempre: reintroduce el descuadre SELLADO, que es el daño irreversible.
> **✅ SCRUM-149 (27-jul-2026) — una factura SIN LÍNEAS ya no se puede sellar:** nace del recon de SCRUM-142. `createInvoiceFromQuoteAdmin` (`quoteAdmin.ts`) era **código muerto** —importada en `quotesAdmin.routes.ts`, ninguna ruta la llamaba— que, de cablearse, habría emitido factura con **dos** defectos fiscales: **sin copiar las líneas** (→ `calcVatCuotaTotal` da 0,00 → la huella VeriFactu sellaría **cero IVA repercutido** sobre un importe que sí lo lleva, y la huella es inmutable y encadenada: solo se corrige con R1) e **ignorando el plan de tramos** (`total: quote.total` completo, saltándose SCRUM-27/32/141). Es el mismo "bug E2E V0-1" que la ruta viva documenta como corregido, **fosilizado en un camino paralelo**. **Retirada** (decisión del fundador: conservarla "por si acaso" es guardar un arma cargada; si el caso hace falta se construye bien desde cero, no resucitando algo que nace con el bug dentro). **Guard fail-closed** en `applyVeriFactu`: sin líneas se LANZA `invoice_without_lines_not_sealable` en vez de sellar — preferir no sellar antes que sellar mal, mismo patrón que el rechazo de justificantes que ya existía, y los call-sites ya capturan (el PDF sale sin QR: fallo visible y reparable, al contrario que una cadena con una cuota falsa dentro). Reutiliza la lectura de `lines` que la función ya hacía: **cero consultas de más**. **Tests:** 5, de COMPORTAMIENTO real (no estructurales — `applyVeriFactu` acepta el cliente Prisma por parámetro, así que se ejercita con un doble), incluido que el orden de comprobaciones no cambia el motivo del rechazo de un J-. Probado en rojo: al quitar el guard caen exactamente los 2 asserts del fail-closed y ninguno más. **GAP registrado aparte → SCRUM-151**: un presupuesto con `MANUAL`/`SIN_CONDICIONES` tiene `plan = []` y por tanto **no es facturable por ninguna vía** (ambos endpoints devuelven 409); el fundador confirma que algún día debe poder serlo, pero se construirá desde cero.
> **✅ SCRUM-141 · FISCAL-1a (27-jul-2026):** primera mitad de SCRUM-16, **partida tras el recon** porque P1 (cuándo se emite y fecha la factura de anticipo) resultó ser **arquitectura, no política**: `verifactu.service.ts:158` sella `invoice.createdAt` en una huella inmutable y encadenada, así que "construir ahora y encender el flag después" dejaría la fecha de devengo mal sellada. La EMISIÓN del anticipo es **SCRUM-142**, bloqueada por el dictamen. **Lo construible sin dictamen, aquí:** (1) **`invoiceLines.service.ts`** — `Invoice.total` se DERIVA de las líneas de la factura, cerrando los **3** `TODO(SCRUM-16/17)` (el recon viejo listaba 2 y con líneas desfasadas). `stageLines` reparte cada precio entre tramos (el último = resto, invariante de SCRUM-32 aplicada A NIVEL DE LÍNEA) y `reconcileToTarget` **intenta** además cuadrar con el importe aritmético del plan — lo logra en el ~99,2 %; cuando el importe es *matemáticamente inalcanzable* (base y cuota redondean por separado y saltan ese valor — demostrado: 250,77 con una línea al 4 %) manda la coherencia interna y la suma queda a 1-2 cént. **La coherencia dentro de la huella no falla NUNCA**, que es lo único irreparable. (2) **`finalInvoice.service.ts`** — motor PURO de la factura final: líneas negativas de deducción **una por tipo de IVA** (deducir en una sola línea obligaría a elegir un tipo y descuadraría el 303) + `Invoice.deductsRefs` (espejo de `albaranRefs`); documento sin líneas → se deduce su bruto y se **marca `sinDesglose`** en vez de inventar un tipo. (3) **`billingPlanView`** pasa a usar el mismo cálculo que la emisión: la UI no puede prometer un importe distinto del que llega en la factura. **SIN SCHEMA** — `Invoice.deductsRefs` estaba en el plan aprobado, pero al quedar el endpoint fuera de alcance **nada la escribiría**: se aplaza a SCRUM-142 junto con su escritor, por el mismo criterio que `devengoAt` (una columna sin quien la rellene es el caso de `vat_default`, SCRUM-132). El tipo `DeductRef` vive ya en el motor puro, que no toca Prisma. **Sin endpoint a propósito** — en el modelo actual los tramos ya suman el 100 %, así que una "final" solo podría emitir 0 €; se monta en SCRUM-142, cuando exista el anticipo como documento distinto. **Tests:** 13 puros sin gate, incluido fuzz de **45.000 tramos** con topes sobre el coste aceptado (≤1,5 % con deriva, ≤2 cént.). Ver la nota de REINTERPRETACIÓN en SCRUM-32 arriba y `COMO_FUNCIONA_YAQU.md` §4 (explicación al usuario).
> **✅ SCRUM-27 · PAGOS-FLEX (10-jul-2026):** **planes de cobro por tramos PERSONALIZADOS** (30/40/30, hitos, mensualidades) además de los presets. `Quote.customBillingPlan Json?` guarda `[{percentage, label}]` (aditivo); `resolveBillingPlan(quote)` (billingPlan.ts) devuelve el plan custom si existe, si no el preset (`getBillingPlan`, **sin tocar**) — usado por los **3 call-sites** de cobro y por `serializeJob` (Pendiente/semáforo). El **reparto exacto** lo hace `distributeStageAmounts` (SCRUM-32, **sin tocar**). `Invoice.stageLabel String?` (aditivo) **congela la etiqueta** del tramo al crear la factura y viaja al **detalle del Trabajo** (timeline + bloque de cobros); la etiqueta a la **factura/WhatsApp = SCRUM-33**. Validación al crear: ≥1 tramo, etiqueta no vacía, `% > 0`, **suman 100 %** exacto (rechazo 400 es-ES). Editor de tramos en `quotesView.js` (clon de `addLine`, filas etiqueta+%, suma en vivo verde/rojo, bloquea guardar). **No toca** `Charge`, webhooks, `totalCobrado` (SCRUM-13/28) ni `scaledLines`. **Copy nuevo del editor (dashboard):** "Plan personalizado (por tramos)" · "Tramos de cobro" · "+ Añadir tramo" · placeholder "Etiqueta (p. ej. Anticipo)" / "%" · "Eliminar tramo" · "Suman X % ✓" / "Suman X % — deben sumar 100 %" · error "Revisa los tramos: cada uno necesita etiqueta y porcentaje, y deben sumar 100 %."
> **✅ SCRUM-34 · PAGOS-FLEX UX (11-jul-2026):** la generación del **siguiente tramo** tiene **puerta de UI en el quote-detail SIN exigir trabajo Terminado** (respaldada por `POST /admin/quotes/:id/invoice`, que nunca lo exigió; los hitos se cobran a mitad de obra). Los serializers de quote-detail (`getQuoteDetailAdmin`) y job (`serializeJob`) exponen el **plan resuelto + `nextStage`** (helper puro `buildBillingPlanView` en `billingPlanView.ts`, mismo CONTEO que las rutas de cobro, importes exactos de `distributeStageAmounts`) + `hasCustomPlan` (distingue custom del default FULL_UPFRONT de `paymentTerms=null`) + `status`/`stageLabel` por invoice del quote-detail. "Condiciones de pago" del quote-detail pinta el plan custom (`"{label} {pct}% · …"`); presets byte-idénticos. **Textos de CTA canónicos:** quote-detail custom → **"Generar siguiente tramo: {label} ({importe})"**; job-detail custom con 2+ pendientes → **"🪙 Cobrar siguiente tramo: {label} ({importe del tramo})"**; con el último → **"💰 Cobrar el resto ({importe})"** (texto de hoy, importe exacto de `nextStage.amount`, no el float de `remaining`). `collect-rest` y su exigencia de `terminado` NO cambian (V2 intacta: emitir sigue siendo acción del pro). CTAs viejos de invoices del quote-detail (`status` ahora viaja) = verificación en SCRUM-35; rediseño del job-detail = SCRUM-31.
> **✅ SCRUM-31 · REDISEÑO del detalle del Trabajo (jul-2026, front):** la pantalla estrella (centro de mando) estaba ordenada por CUÁNDO se construyó cada pieza (57/65/66/47/49/17…), no por lo que necesita el fontanero. Rediseño en **6 fases mergeables** (jerarquía **1 estado + 1 acción + 1 lista**), cada una su PR y su verificación 390/1280: **F1** héroe (estado del Trabajo AHORA visible + CTA de cobro arriba + cliente tap-to-call; helper `jobStatusMeta`); **F2** editor de líneas del albarán → **bottom-sheet** (arregla el 390px); **F3** botonera por documento = **1 primaria + overflow «⋯»** (componente `overflowMenu`, en AB3; nunca oculta primaria/Marcar PAGADA/PDF); **F4** **CTA contextual** del héroe (resolver PURO `jobNextAction`, escalera aprobada: cobrar > recordar ≥7d+teléfono > firmar > emitir > nuevo albarán); **F5** **FUSIÓN** de Documentos+Albaranes+Cobros en UNA lista cronológica ascendente `.job-doc-row` (AB3, acotada) — mata el timeline read-only y la triple duplicación; presupuesto/albarán/factura son filas con icono + estado + fecha (año+hora, sin pérdida) + importe Tinta≥700 + acciones; "Nuevo albarán"/"Consolidar" pasan a acciones SOBRE la lista; **F6** **config plegada** (Tipo de trabajo → línea editable, Datos → segundo plano). Solo front (vanilla, DESIGN.md/AB): **reutiliza endpoints existentes, cero backend/schema**. Resuelve los 4 hallazgos de la ficha (estado FSM visible, morosidad en el héroe, fechas unificadas, sin factura duplicada).
> **✅ SCRUM-33 · PAGOS-FLEX, etiqueta del tramo en factura y WhatsApp (23-jul-2026, COMPLETO):**
> SCRUM-27 llevó `Invoice.stageLabel` al centro de mando (detalle del Trabajo); esta tarea lo lleva
> a los documentos que ve el CLIENTE. **Verificado ANTES de tocar código** (zona dinero/fiscal, STOP
> AA1.4): `computeVeriFactuHash` (`verifactu.service.ts:55-75`) solo usa NIF/serie/fecha/tipo/cuota/
> importe/huella-anterior — el concepto/líneas de texto NO alimentan el hash, así que cambiar el
> texto visible no rompe la cadena de huellas. Y hoy no hay ninguna factura F1 fiscal real de
> merchant ES en producción (`INVOICING_ES_ENABLED` OFF, regla 24) — solo demo (con marca de agua)
> o justificantes J-. Riesgo real: prácticamente nulo.
>
> **Factura:** `Charge.concept` (creado en `invoiceWhatsApp.service.ts:60`) pasa de
> `"Factura 2026-CF-001"` a `"Factura 2026-CF-001 — Anticipo"` cuando `stageLabel` existe (null en
> presets → se omite) — se propaga solo con el valor del campo a los 6+ sitios que ya renderizan
> `Charge.concept` (recibo público, pago transferencia/Bizum/tarjeta/MP, bot WhatsApp), sin tocar
> cada uno. PDF de factura (`pdf.service.ts`, `generateInvoicePdf`): nuevo param `stageLabel?`,
> impreso en la cabecera junto a Nº/Fecha — propagado en los 3 call-sites (`ensureInvoicePdf`, el
> flujo charge→factura de `lib/invoicing.ts`, `POST /admin/invoices/:id/regenerate-pdf`).
>
> **WhatsApp — SIN tocar la plantilla de Meta (mejor que lo planteado inicialmente):** el ticket
> pedía una variable `{{5}}` nueva en `payment_request_es`, lo que exige re-aprobación de Meta. Se
> descartó al verificar que Meta rechaza variables de plantilla vacías, y los presets no tienen
> `stageLabel` (`null`) — una `{{5}}` dedicada habría necesitado un valor de relleno inventado que
> no existe en ningún otro canal del producto. En su lugar, `appendStageLabel()`
> (`invoiceNumber.service.ts`) mete el label DENTRO del valor que ya se manda para la variable
> "número de documento" existente — Meta aprueba el CUERPO fijo, no los valores de cada envío. Cero
> cambio de plantilla, cero re-aprobación, desplegado ya. Verificado con el builder real: mensaje
> completo renderizado con y sin `stageLabel`, ambos pasan `validateTemplateComponents` (J7).
>
> `npm test`: 207 · 178 pass · 0 fail · 29 skip. Sin schema, sin tocar Meta.
>
> **✅ SCRUM-117 · métrica honesta de recordatorios (23-jul-2026, tercera cara del cluster 115/116/117):**
> `reminderEur` (reports x2, `reports.routes.ts:147`) contaba como «€ recuperado por recordatorios»
> facturas cuya `reminderXSentAt` se escribió aunque el WhatsApp FALLARA — la métrica que mide si los
> recordatorios funcionan contaba los que no salieron, y en la peor dirección (parecen más eficaces).
> El **origen** ya lo cerró SCRUM-116 (deploy 23-jul 15:22 UTC): desde ahí `reminderXSentAt` = «se envió».
> Lo que este ticket resuelve es el **histórico + la presentación**: el dato para distinguir un
> recordatorio real de uno marcado en falso NUNCA se guardó (los fallos pre-116 no dejaron rastro), así
> que **no hay recálculo retroactivo posible**; y nulear las fechas pre-fix está descartado (son el
> **candado de idempotencia del cron** — nulearlas reenviaría recordatorios de facturas ya pagadas).
> **Medido antes de decidir** (COUNT read-only contra prod): de 3 facturas pagadas con fecha de
> recordatorio (las 3 pre-fix), **0 suman a `reminderEur`** → inflación real **0 filas / 0,00 €**.
> **Decisión (fundador): documentar, sin cambio funcional** — montar un suelo de fiabilidad para
> proteger 0 datos infra-reportaría para siempre una era vacía. Queda un comentario en la propia métrica
> (frontera 23-jul + resultado del count) para que nadie lea `reminderEur` creyéndolo limpio; si algún
> día abarca un periodo con volumen real pre-116, se reabre con un suelo **de lectura** (`>= fecha`),
> nunca tocando el histórico. Solo la lectura; sin schema, sin write, sin cron, sin test.
>
> **✅ SCRUM-119 · verificación REAL del cierre de IDOR en `/pay/card` (23-jul-2026, pagos):**
> el cierre del IDOR de `/pay/card` (SCRUM-85, cadena SCRUM-72→74→85→90) NO estaba VERIFICADO: el
> handler hacía `if (!stripe) return 501` ANTES del `findUnique` del token, así que sin
> `STRIPE_SECRET_KEY` el token válido y el id numérico daban la MISMA respuesta (501) — ningún assert
> distinguía «IDOR cerrado» de «Stripe ausente». Era la única de las 4 rutas de pago que miraba su
> integración antes de resolver el recurso. Peor: `node:test` aborta el bloque en el primer assert que
> falla (`scrum85:71`, `501 !== 404`), enterrando lo de debajo — incluido el **assert de aislamiento
> entre inquilinos** (cruce A/B, líneas 90-95). **Fix de RAÍZ:** mover `if (!stripe)` debajo del
> `findUnique`+404+redirect → el id inexistente da 404 esté Stripe o no, el bloque deja de abortar y se
> desbloquean bizum + el cruce A/B; alinea `/pay/card` con `/pay/mp`, `/pay/bank`, `/pay/bizum`.
> **Honestidad (criterio SCRUM-121):** el test ya aceptaba `[303, 501]` en el token; se añade un
> `t.diagnostic` EN VOZ ALTA cuando es 501 (Stripe ausente → el redirect real a Checkout NO se ejerce;
> el IDOR sí queda verificado, numérico 404 ≠ token 501). Ni verde fingido ni skip mudo. Verificado en
> staging sin Stripe: scrum85 pasa entero, el cruce A/B corre. `npm test` 242 · 209 pass · 0 fail. Sin schema.
>
> **✅ SCRUM-130 · guard r23: la tarjeta va a la cuenta CONECTADA del merchant, o NADA (24-jul-2026, pagos):**
> hallazgo del recon SCRUM-124 (prohibiciones sin mecanismo). La regla 23 y C1-2 ya especificaban
> «tarjeta deshabilitada para reales salvo demo», pero el backend NO lo verificaba: sin Connect,
> `payCard.routes.ts` creaba la Checkout Session en la cuenta de PLATAFORMA para CUALQUIER merchant —
> solo lo tapaba el selector de la UI. Dinero de clientes finales en la cuenta equivocada = regulatorio
> (el merchant es merchant-of-record). **Guard:** función PURA `cardChargeDecision({useConnect, isDemo})`
> → `connect` / `demo_platform` (regla 18) / `refuse` (real sin Connect → **409**, no cae a plataforma).
> DEBAJO del `if (!stripe) 501` → solo muerde con Stripe (prod); staging y scrum85 sin cambio de
> comportamiento hoy. Test PURO (`scrum130-card-charge-connect`) + `scrum85` actualizado (`[303,501,409]`).
> Sin schema. **INERTE en producción HOY** (ningún merchant real tiene Stripe LIVE aún, **SCRUM-41
> abierta**): es defensa PREVENTIVA — el día que se active Stripe, impide que el primer cobro con tarjeta
> de un merchant sin Connect caiga en la cuenta de plataforma. La protección que se agradece tarde.
>
> **✅ SCRUM-129 · retirado n8n VIVO de `/charges/:id/send` + guard de la regla nº1 (24-jul-2026):**
> hallazgo de otra sesión (lineage del recon SCRUM-124). `charges.routes.ts` tenía `POST /:id/send` con
> n8n vivo (`axios.post` a una URL de webhook de n8n) en una ruta de COBROS — viola la regla 1 (WhatsApp
> = Meta Cloud API directa, jamás n8n). Y MENTÍA: sin la URL configurada (lo esperable, n8n prohibido)
> se saltaba el envío pero creaba el `Event type:'sent'` y respondía `{ok:true}`; además esquivaba todos
> los guards de `whatsapp.ts` (topes J6, opt-out J3, dry-run, WA-0b). Verificado SIN callers → RETIRAR,
> no migrar. Todo el n8n del repo era muerto: se retiró el endpoint + `src/integrations/n8n.ts`
> (`emitToN8n`, nunca llamado) + las env vars de n8n. **Guard estructural** (`scrum129-n8n-guard`,
> `npm test` normal): ningún fichero de código cablea n8n; calca el guard de r28 (SCRUM-124) — walk de
> todo el repo, self-exclusión (SCRUM-125), sin allowlist. Vigila el mecanismo (la config), no la prosa
> histórica ("ya NO usa n8n" debe poder escribirse). Sin schema.
> **✅ SCRUM-139 F1 · la línea de presupuesto deja de ser una fila de tabla (27-jul-2026, front):** primera fase del rediseño del editor ("de formulario de datos a cuadernillo"). **El gate del ticket —"feedback real primero"— se cumplió solo**: SCRUM-132/133/134/140 salieron todas de usar esta pantalla. **La medida que ordenó el diseño:** `.quote-lines-table` tenía `min-width:560px` dentro de un `overflow-x:auto`, así que en un móvil de 390 px cada línea se rellenaba **scrolleando de lado por 7 columnas** — eso *es* la sensación de "meter precios" que reportó el fundador, y con el pulgar en obra es inservible (AB1: móvil REAL). **Decisión del fundador: MÓVIL PRIMERO, asumiendo furgoneta** (producto WhatsApp-first; si funciona con el pulgar en obra funciona en el escritorio, al revés no) — así se cierra la pregunta que el ticket dejaba abierta. **Hallazgo que cambió el ORDEN de las fases:** pre-dibujar 2-3 líneas vacías (la idea del "cuadernillo") **empeora** las cosas mientras la línea siga siendo una fila que scrollea de lado — tres filas vacías con scroll son tres trámites, no una invitación. Por eso el cuadernillo es F2 y no F1. **F1 entrega:** componente `.quote-line` (alta en AB3 arriba), cabecera de tabla eliminada (cada campo lleva su etiqueta), inputs a **44 px** de alto (antes 7 px de padding), total de línea en Tinta ≥700, anillo Foco de DESIGN.md, y **un solo DOM** para todas las anchuras. El contrato de `lineObj` (`conceptInput`/`qtyInput`/`priceInput`/`markupInput`/`vatInput`/`totalCell`/`priceHint`) se conserva INTACTO, así que payload, borrador, `recalcTotals`, plantillas, IA y autocompletado siguen sin tocarse: cambia el DOM, no el contrato. **Fases siguientes:** F2 cuadernillo · F3 total protagonista (Signature KPI) · F4 margen/IVA a hoja inferior (AB3) · F5 acciones al `overflowMenu` · F6 plantillas sin salir. ⚠️ **QA visual AB6 PENDIENTE**: la verificación renderizada (capturas móvil/tablet/escritorio) quedó bloqueada por contención del navegador en la sesión, no por el cambio; verificado sí: build, 264 tests, sintaxis y cero referencias huérfanas a la tabla. **No se cierra la fase como validada visualmente hasta que alguien la vea en pantalla.**
> **✅ SCRUM-140 · la plantilla viaja como ARGUMENTO, no por un canal global (27-jul-2026, front):** cierra la CLASE que SCRUM-134 solo pudo mitigar. La plantilla seleccionada pasaba de una vista a otra por `sessionStorage['pf_load_template']` — canal global, implícito, con dos escritores y un lector — y de ese diseño salieron sus dos fallos: el **off-by-one** (el escritor navegaba antes de escribir y el lector corre SÍNCRONO dentro de esa navegación → abría la plantilla anterior) y la **huérfana** (lo escrito y no consumido pre-rellenaba un «+ Nuevo presupuesto» normal con líneas que nadie pidió). El fix de 134 fue correcto pero **defensivo**: swap de orden + sello `_ts` con ventana de 15 s. Quedaban tres cosas incómodas — el contrato "escribe justo antes de navegar" no lo imponía nada (un tercer escritor podía volver a invertirlo), `_ts` era una **heurística temporal** (una navegación lenta podía descartar una plantilla legítima), y el acoplamiento era **invisible en las firmas**. Ahora: `renderAppView('quotes-new', { template })` → `renderQuotesView(container, template)`. Desaparece el orden como variable (es un parámetro), desaparece el estado residual (no hay huérfana posible), sobra el sello y su umbral, y el acoplamiento queda visible. **La plantilla NO se persiste en `appState`** a propósito: es de un solo uso, y guardarla reintroduciría exactamente la huérfana. De las **7** navegaciones a `quotes-new`, solo 2 llevan plantilla; las otras 5 (nuevo presupuesto, desde cliente, desde factura, desde solicitud, deep-link por hash) antes podían recoger lo que otra vista hubiera dejado escrito y ahora reciben `null`. `sessionStorage` **retirado del todo**, no como fallback: mantenerlo habría conservado la clase que el ticket elimina (escritor y lector viven en el mismo bundle, así que no hay escenario de versiones mezcladas). **Tests:** 6, guard ESTRUCTURAL con su límite escrito (vanilla de navegador, no importable en node: verifica que el canal no vuelve y que el argumento se pasa y se recibe, no que el navegador lo renderice). Los 4 asserts centrales probados en rojo con la regresión real: reintroducir la clave, reintroducir `_ts`, dejar de pasar el argumento y persistirlo en `appState`. La verificación de comportamiento sigue siendo el guion de staging de SCRUM-134 (A→A, B→B, nuevo→vacío).
> **✅ SCRUM-132 · el "IVA por defecto" PISABA el IVA real de las líneas (27-jul-2026, front):** el IVA de una línea llega en **dos unidades** según su origen — `vat` en PORCENTAJE (21: borrador de localStorage, autocompletado de producto) y `tax` en FRACCIÓN (0,21: plantillas y líneas de la IA, contrato del backend) — y `addLine` **solo leía `vat`**: en las otras tres rutas `initial.vat` era `undefined`, caía al `else` y el general **pisaba** el IVA de la línea. Efecto visible: guardar una plantilla al 10 % y reabrirla la devolvía al 21 %. **Fix contenido en el RECEPTOR** (`addLine` normaliza las dos unidades) para no tocar los call-sites, que eran zona de SCRUM-134 — coordinación explícita: 134 primero (estructura, mueve esas líneas), 132 encima (conversión de dato). **El recon corrigió la premisa del ticket** (que decía que el general "no siembra las líneas nuevas"): el `+ Añadir línea` manual SÍ sembraba; el defecto real era el opuesto. Y **no es un residuo inocuo**: `vat_default` entra en el repo el 26-nov-2025, ocho meses antes del modelo multi-IVA de SCRUM-65 — es diseño mono-IVA sin retirar, no un modelo rival. **El bug NO era latente pese a `INVOICING_ES_ENABLED=OFF`**: el flag protege el *documento* fiscal, no el *dato* — el IVA corrupto se congela al crear el presupuesto y viaja `Quote.lines` → `Invoice.lines` al aceptar, alimentando el 303 y la cuota de la huella el día que se encienda. **Decisión del fundador:** NO retirar el campo (tiene consumidor legítimo: quien factura casi todo al 21 %); el general **siembra, nunca pisa**. De paso: `tax: (l.tax || 0)` en la carga de plantilla colapsaba "sin IVA especificado" en "0 %" — y el 0 % es un tipo LEGÍTIMO desde SCRUM-65 (21/10/4/0), así que ambos casos dejaban de distinguirse; y la conversión cruda `String(v * 100)` escribía `21.000000000000004` en el campo (centralizada en `fractionToPercent`). **Tests:** guard ESTRUCTURAL (`tests/scrum132-iva-unidad.test.mjs`, 4 asserts) — `quotesView.js` es vanilla de navegador y no se puede importar en node, así que verifica que la FORMA del arreglo sigue ahí, no que el navegador la ejecute; límite escrito en el propio fichero. Los 4 probados en rojo inyectando la regresión real uno a uno, y **uno de ellos se corrigió al probarlo**: el regex usaba `\w+` y no cazaba `String(initial.tax * 100)` (con punto) — pasaba en verde sobre la forma más probable de reintroducir el bug.
> **✅ SCRUM-134 · seleccionar una plantilla abría OTRA: off-by-one de estado (24-jul-2026, front):**
> «Usar plantilla» (`templatesView.js`) navegaba ANTES de escribir la plantilla en `sessionStorage`, y
> el lector corre SÍNCRONO dentro de esa navegación (`renderQuotesView` no es async → `loadInitialData`
> llega al `getItem` sin ningún `await` por delante) → el editor leía SIEMPRE el valor de la vez
> ANTERIOR; en el primer uso, con la clave vacía, restauraba el borrador pendiente. **Lo probó un control
> natural del propio repo:** «Duplicar» (`quotesDetailView`) escribe y LUEGO navega —orden correcto, nunca
> se reportó roto— con el MISMO lector; el bug era el orden del escritor, no el lector. **Segundo bug**
> destapado en el recon: la clave escrita no se consumía y quedaba HUÉRFANA → un «+ Nuevo presupuesto»
> normal aparecía con líneas que nadie pidió y suprimía el borrador (líneas = dinero). **Fix:** swap del
> orden + sello de frescura `_ts` en ambos escritores, y el lector acepta solo plantillas selladas y
> recientes (<15 s) —lo que además neutraliza las huérfanas ya presentes en sesiones del build roto—.
> Colateral de precedencia: en `loadDraft`, `vatDefault` se restaura ahora ANTES de crear las líneas.
> **Verificado en vivo contra staging** (mismo script y fixtures, solo cambian los 3 JS): antes A→vacío,
> B→A, nuevo→B; después A→A, B→B, nuevo→vacío. **El IVA de plantillas NO se toca: es SCRUM-132** — se
> verificó que `addLine` lee `initial.vat` mientras al guardar se escribe `tax: vatPerc/100` (desajuste de
> clave Y de unidad), así que hoy ambos caminos descartan el IVA de la plantilla. Sin schema.
>
> **✅ SCRUM-133 · "+ Añadir línea" DEBAJO de la última fila (24-jul-2026, front/UX):** añadir línea es
> la acción MÁS repetida del editor de presupuestos y su único control vivía ARRIBA: tras rellenar una
> línea había que volver arriba con scroll, y esa fricción se paga en CADA línea del flujo core
> ("presupuesto en 30 s"). Se añade un segundo control pegado a la última fila. **Decisión de UI
> (carril A): CONVIVE, no sustituye** — con lista larga las dos puntas sirven (arriba al volver de una
> plantilla, abajo al encadenar líneas) y el de la cabecera agrupa con "Sugerir con IA"/"Usar plantilla",
> que son las otras formas de poblar líneas. **Cero tokens nuevos:** reutiliza el patrón del editor de
> albarán (`jobDetailView`, SCRUM-31 F2: ghost + "+ Añadir línea") y el lenguaje de esta misma pantalla
> (borde discontinuo + `--neutral-*`); clase compartida `.quote-add-line` en `styles.css` (nada de
> estilos inline), ancho completo y **min-height 44 px** por el target al pulgar de DESIGN.md (el
> `.btn-ghost` base se queda en 36 px). **Ambos** botones pasan por `addLineAndFocus()`: crea la línea y
> deja el cursor en su concepto (`focus({preventScroll})` + `scrollIntoView({block:'nearest'})` → sin
> salto brusco y sin animación que gatear con `prefers-reduced-motion`). `type="button"` explícito: sin
> él, dentro del `<form>`, el clic ENVIARÍA el presupuesto. Verificado en staging a 390 y 1280 con
> capturas antes/después: sin el fix el foco se queda en `BODY`; con él cae en el `INPUT` de la última
> fila. `.quote-add-line` es **variante de botón acotada a esta pantalla**, no componente nuevo de AB3:
> si aparece un 2.º uso real se generaliza (misma doctrina que `.job-doc-row` → `.doc-row`). Solo front,
> sin backend, sin schema; no toca cálculo, totales ni fiscal.
>
> **✅ SCRUM-135 · el gasto se asocia a un TRABAJO, no tecleando el id de una cotización (24-jul-2026,
> gastos/UX + tenencia):** el gasto se guarda en `Expense.quoteId` (**COTIZACIÓN**), pero lo que el pro
> ve en pantalla es el **TRABAJO** (`Job`), que tiene su **propio** id — `Job #57` y `Cotización #57`
> son registros distintos. La UI mezclaba los dos vocabularios: campo "ID de la cotización", ayuda
> "vincula este gasto a un trabajo", y columna titulada "Trabajo" que pintaba "Cotización #N". Quien
> leía "Trabajo #57" y tecleaba 57 vinculaba el gasto a **otra cosa, en silencio**. No era solo
> fricción: era mis-asociación por defecto al seguir la etiqueta. **(1) Selector de Trabajos** en el
> modal, alimentado por `GET /admin/jobs` (endpoint YA existente → **ninguna ruta nueva** que declarar
> en el ratchet de SCRUM-113). **"Abiertos" = todos menos `cerrado`** (decisión del fundador). Los Jobs
> **sin presupuesto** salen **DESHABILITADOS con el motivo**, no escondidos (criterio SCRUM-89): sin
> `quoteId` no hay nada que guardar. Al **editar**, si la vinculación actual apunta a un trabajo cerrado
> (o a una cotización que nunca fue trabajo) esa opción **se conserva marcada** — sin eso, abrir el modal
> y guardar movía un dato que nadie tocó, que es de lo que más erosiona la confianza; ídem si falla la
> carga de la lista. **(2) "+ Añadir gasto" en la ficha del Trabajo**, ya vinculado y sin preguntar id:
> es el **alta rápida "desde la furgoneta"** que SCRUM-107 aparcó hasta que existiera
> `Expense.teamMemberId` (SCRUM-109, ya en prod). **SIN veta `isTecnico`** (decisión del fundador): a
> diferencia de las acciones de dinero, `POST /admin/expenses` está abierto al técnico a propósito y la
> autoría se rellena sola; es además su **único** camino, porque su nav de Gastos está oculto (`app.js`).
> Solo aparece **si el Trabajo tiene presupuesto** — ahí NO aplica "deshabilitar con explicación", porque
> no es restricción de rol sino que no hay nada que hacer. **(3) Vocabulario:** la columna "Trabajo"
> nombra el trabajo y enlaza a SU ficha, **exactamente como `jobsView` (solo el título, sin prefijo de
> id)**: esa pantalla no enseña el id del Job en ningún sitio, así que anteponerlo metía un **tercer**
> número junto al "Presupuesto #N" del título por defecto — el lío que el ticket viene a quitar, no a
> mover de sitio. **TENENCIA (regla 2, hallazgo del recon):** `quoteId`/`providerId` se escribían **a
> pelo** — la FK garantiza que la fila EXISTE, no que sea de este merchant, así que un gasto podía
> apuntar a la cotización de **otro negocio**. La fuga era pequeña mientras `listExpenses` solo
> devolviera `quote.id`, pero este mismo ticket **ensancha** ese camino → habría pasado a ser lectura
> cross-tenant. El guard va en el **DOMINIO** (`assertRefsOwned` en `createExpense`/`updateExpense`), no
> en la ruta: un futuro tercer llamador no se lo salta por olvido. El `PUT` comprobaba la tenencia del
> **gasto** pero no la de la referencia **nueva**. **Mismo código de error** para "no existe" y "no es
> tuya": distinguirlas haría del endpoint un **oráculo** para enumerar ids ajenos. 4 tests gateados,
> **verificados EN ROJO dos veces** (quitando el guard de `createExpense` fallan 2 y la guarda de
> presencia sigue verde → falla el guard, no el fixture; quitándolo de `updateExpense` falla solo el del
> PUT). **RENDIMIENTO:** el trabajo de cada gasto se resuelve en `listExpenses` con **UNA** query para
> toda la página. La primera versión lo pedía a `/admin/jobs` desde el front y, **medido contra
> staging, ese endpoint tardaba 2910 ms frente a 1270 ms** del de gastos (N+1 de `serializeJob`, ver
> **SCRUM-58**): la lista se quedaba esperando por un adorno. Verificado con click-through real (servidor
> local contra la BD de staging) como **admin y como OPERARIO**, con el gasto del operario guardado con su
> `teamMemberId`. Sin schema; no toca cálculo de margen ni nada fiscal.
>
> **✅ SCRUM-136 · un solo hub de Equipo: el operario es un ROL, no un apartado (24-jul-2026,
> equipo/UX):** el ticket decía que Equipo y Operarios estaban partidos **en dos**. Eran **TRES**: el
> mismo roster se listaba en `teamView` (alta/roles/estado, `GET /admin/team`), en `operariosView`
> (dinero por operario, `GET /admin/metrics/operarios`) y en el panel "Rendimiento del equipo" del
> **Inicio** (presupuestos del mes, `GET /admin/metrics/team`). Las tres **sintetizaban por separado la
> fila del propietario** — porque el propietario **no es un TeamMember** (`teamMemberId null` =
> propietario en `authMiddleware`) — y las tres escribían el rol distinto para el MISMO valor de schema
> (`tecnico`): dos decían "Operario" y el Inicio decía "Técnico". **(1)** `GET /admin/team` devuelve
> ahora el roster **con su resumen** por miembro (presupuestos del mes, trabajos abiertos, pendiente),
> vía `teamOverview.service.ts`. Se **enriquece la ruta existente** en vez de abrir
> `/admin/team/overview`: ya es admin-only y ya es "el equipo", así que una ruta nueva sería superficie
> que declarar en el ratchet (SCRUM-113) para el mismo dato, y dos peticiones donde basta una. Aditivo:
> mismo array, mismos campos, solo se **añade** `resumen`. **(2)** `teamView` pasa de tabla a **lista de
> cards** (AB3): con 5 cifras nuevas por miembro una tabla pide 9 columnas que en móvil se apilan en una
> torre ilegible, y la card es el patrón de la vista que absorbe. **(3)** "Operarios" **sale del nav y
> del index**; el `case 'operarios'` de `app.js` se conserva como **redirección** a `team` (hay
> marcadores y enlaces vivos, y el guard de rol es el mismo); `operariosView.js` se borra. **(4)**
> Vocabulario **único**: "Operario" también en el Inicio, y ese panel deja de ser un callejón —enlaza al
> hub— pero **se queda**, porque un vistazo en el dashboard es otro trabajo distinto de gestionar el
> equipo. **DOS VENTANAS, ETIQUETADAS:** el resumen mezcla presupuestos del **MES** (por
> `Quote.teamMemberId`, quien lo creó) con trabajos del **HISTÓRICO** (por `Job.operarioId`, quien lo
> originó). Deliberado —son preguntas distintas y ya se agregaban así—, y la UI **escribe la ventana al
> lado del número** ("este mes" / "de N en total") para no mentir; hay test que lo congela. **HALLAZGO
> (del rojo): `/admin/team` tiene GATE DOBLE** — quitar `router.use(requireRole('admin'))` NO abre la
> ruta porque `app.ts` ya la monta con `requireRole`; hubo que quitar **los dos** para ver el test
> fallar. No se retira ninguno (redundancia barata que sobrevive a reorganizar `app.ts`) y queda escrito
> en el código para que nadie dé por bueno un verde tras tocar uno solo. **PERMISOS:** lo que pedía el
> ticket ("solo propietario y admins gestionan miembros") **ya se cumplía**; ahora está congelado por
> test — y ahora importa más, porque la respuesta lleva el **dinero pendiente de cada compañero**, no
> solo nombres. **FUERA:** el detalle por miembro (click → sus presupuestos/trabajos) — hoy ni
> `/admin/quotes` ni `/admin/jobs` aceptan filtro por `teamMemberId`, así que es superficie nueva en dos
> módulos más → ticket aparte. **Sin schema:** `role` es `String`, no enum de Prisma.
>
> **✅ SCRUM-138 · export selectivo + "Descargar datos" sale de Configuración a Finanzas (24-jul-2026,
> export/S4):** el paquete para el asesor o para una inspección vivía **enterrado en Configuración**,
> donde no lo encuentra nadie: es **dinero**, no una preferencia de la cuenta. Ahora es apartado propio
> en **Finanzas**, junto a Informes/Facturas/Gastos (`public/dashboard/js/exportView.js`, vista nueva).
> **Zona compartida (anunciada antes de tocar):** de `settingsView.js` solo se quita la llamada a
> `renderExportDataCard` y la función, que se muda entera; nada más de ese fichero se toca. **SELECTIVO:**
> antes solo se elegía el PERIODO, ahora también **qué** llevarse, de seis datasets. La decisión vive en
> una función **PURA** (`seleccionExport.ts`) separada del armado del ZIP — lo que se prueba son GATES, y
> un gate se prueba mejor donde se decide que a través de un ZIP de 40 MB. **LOS GATES DE SCRUM-25 NO SE
> RELAJAN:** *admin-only* sin cambios (router con `requireRole` + guard de rol en la vista, igual que
> `settings`/`team`); **el XML VeriFactu sigue atado a `INVOICING_ES_ENABLED`** (regla 24/26, SCRUM-73) —
> marcar "Facturas" **NO** lo enciende, es un **AND, nunca un OR**, y está **verificado EN ROJO**
> (cambiando `&&` por `||` el test falla con "REGLA 24 ROTA"); **gate POR dataset** — pedir uno no
> arrastra otro, y los PDF/XML solo entran con las facturas (sin ellas ni se consultan: ahorra el render
> medido en SCRUM-83). **Fallo seguro:** selección vacía o ilegible = **TODO**, nunca "nada" — un ZIP
> vacío que parece correcto es peor que uno completo, el mismo criterio que ya rige el paquete
> incompleto. **`gastos.csv` entra en el paquete POR PRIMERA VEZ:** solo existía como descarga suelta,
> así que el asesor abría el ZIP y veía **ingresos sin costes**. Mismas columnas que el CSV suelto; por
> fecha DEL GASTO, no de alta (criterio SCRUM-106); **no** alimenta `clientes.csv`, porque un gasto
> apunta a una cotización y no a un cliente (SCRUM-135). **EL LEEME NO PUEDE MENTIR:** enumeraba los 5
> CSV a pelo; ahora describe **solo** lo que lleva, avisa arriba si el paquete es **PARCIAL** (para que
> una ausencia no se lea como "no facturó nada") y apunta a Finanzas en vez de a Configuración.
> **HALLAZGO DEL CLICK-THROUGH** (abriendo un ZIP real, no un test): pedir "clientes + gastos" daba un
> `clientes.csv` con **solo la cabecera** —lleva los REFERENCIADOS por los documentos del paquete
> (SCRUM-104) y no había ninguno— bajo un LEEME que prometía "todos los clientes con algún documento".
> Ahora lo dice y explica cómo arreglarlo; **ningún test de backend lo habría visto**. **Verificación:**
> `npm test` 315/0; 13/13 gateados del export en verde tras el refactor (incluidos técnico→403 y flag
> OFF); ZIP selectivo descargado **y abierto** contra la BD de staging. Sin schema.
>
> **🟡 SCRUM-145 (144a) · payload VeriFactu conforme a los XSD — PARCIAL (24-jul-2026, fiscal):**
> nace del recon de SCRUM-144, que **corrigió una premisa**: el «Modelo C» tal como se planteó **no
> existe** — la AEAT **no tiene canal de subida de XML** en la Sede (la remisión del art. 15 RRSIF es
> servicio web SOAP con certificado, y la app gratuita *«no permite exportar registros para continuar
> la facturación en otro SIF»*). La decisión de transporte queda en **SCRUM-146 (144b)**; este payload
> es **común a los tres modelos**, así que se construye sin esperar nada. **Todo sigue tras
> `INVOICING_ES_ENABLED` OFF (regla 24).**
> **HECHO (sin schema):** el XML pasa de «inspirado en» a conforme en estructura — raíz real
> **`sum:RegFactuSistemaFacturacion`** con los dos namespaces oficiales (antes `<RegistrosFacturacion>`
> sin ns), envoltorio **`RegistroFactura`** y el elemento **`RegistroAlta`** (antes se usaba
> `RegistroFacturacionAlta`, que es el nombre del **TIPO**, no del elemento); **`SistemaInformatico`
> completo** (9 campos) alimentado por env desde la declaración responsable, con **FAIL-CLOSED**: sin
> datos del productor **lanza** en vez de emitir un registro fiscal con placeholders;
> **`Encadenamiento/RegistroAnterior`** ahora identifica la factura anterior COMPLETA (emisor + nº +
> fecha + huella) resolviéndola por su huella —sin columna nueva—, y si la cadena no se puede acreditar
> **lanza** en vez de fingir `PrimerRegistro`; **`Destinatarios`** solo se emite con NIF del cliente
> (antes salía `NombreRazon` suelto → **XML inválido**); guard de **1000 registros** por envío (tope del
> XSD). **Test propio** (`scrum145-verifactu-xsd`, sin gate) que **extrae del XSD** los elementos
> obligatorios y las ramas de cada `choice` en tiempo de test — si la AEAT publica un campo nuevo, se
> entera solo. **Alcance dicho en voz alta:** NO es validación XSD completa (sin `xmllint` ni libxmljs
> no hay forma sin dependencia nativa); tipos/longitudes/cardinalidades los validará el entorno de
> pruebas AEAT en S1-D. **La huella NO se toca** (cadenas persistidas intactas).
> **PENDIENTE — bloqueado por SCHEMA (necesita GO del fundador, AA1.4 + una sola mano en
> `schema.prisma`):** (a) `vf_timestamp` para emitir el instante REAL que entró en la huella — hoy se
> emite `createdAt` **con el formato correcto pero valor no verificable por un tercero**; (b) el
> **registro de ANULACIÓN**, que necesita persistir su propia huella. **PENDIENTE — dictamen del
> asesor (no se inventa en código):** si una F1 sin destinatario identificado debe marcarse
> `FacturaSinIdentifDestinatarioArt61d` o emitirse como **F2 simplificada**; y qué
> `TipoRectificativa` (S/I) corresponde a nuestras R1.

**V2. Trigger del segundo tramo:** **✅ VERIFICADO (SCRUM-10/13, 9-jul-2026): el resto NUNCA se cobra solo** (confirmado en código: `/admin/jobs/:id/collect-rest` vía `getNextBillingStage`, siempre acción del pro). Regla: el resto NUNCA se cobra solo; trigger = acción del pro ("Trabajo terminado → Cobrar resto"; con JOB-1: estado `terminado`) → cobro/factura del resto + payment_request.
**V3. Anticipos [VALIDAR asesor en S1-F]:** señal con factura = **factura de anticipo con IVA**; la final descuenta el anticipo. Pre-SIF: señal con recibo no fiscal (coherente con flag). Post-SIF: implementar el dictamen (regla 32).
**V4. Pago parcial:** F1 = NO automático (pending + decisión del pro, runbook). F2 = `amountReceived` + estado `partial` si los datos lo piden.
**V5. Sobrepago:** nota + devolución manual de la diferencia; F2 con Refund.
**V6. Refund (F2):** `Refund {chargeId, amount, method, reason, status:'pending'|'done'|'failed'}`. Tarjeta = Stripe refund en cuenta conectada; Bizum/transfer = manual. Factura emitida → **R1 parcial** (regla 29). Jamás des-pagar el charge.
**V7. Disputas (direct charges → cuenta del MERCHANT):** webhook `charge.dispute.created` → aviso + paquete de evidencia en 1 clic (runbook R14). La firma digital gana disputas → argumento de venta.
**V8. Cancelación tras señal:** default "la señal no es reembolsable" (configurable), visible en la landing junto a condiciones. Si devuelve → V6 (+R1 si facturada).
**V9. Referencias:** Bizum erróneo R5 · transferencia tardía R6 · webhook perdido R3 · idempotencia Q.

---

# PARTE W — PACKAGING & ENTITLEMENTS `F1-doc · se implementa en PRECIOS-1 (regla 34)`
**W1. Estructura comercial:** UN plan público — **"YaQu Pro — 19,90 €/mes (o 199 €/año) + 0,9 % solo cuando cobras con tarjeta. Todo incluido."** Founding = banner sobre Pro (19,90 tachado → **9,90 €/mes de por vida**, 20 plazas, contador real). **Equipo NO público en F1:** oferta manual 59 €/mes (hasta 5 usuarios, aprobaciones/asignación — ya existen); precio en Stripe no listado; se publica en F2 con equipos reales. Tercer plan visible: nunca antes de 300 pagantes. **Sin Starter** (ancla contra el 9,99 limitado y castiga el uso que queremos). **Sin add-ons hasta F3** (CFDI €/timbre, usuarios extra, BOT-2 IA). **Take rate plano 0,9 %**, comunicado como ventaja ("Bizum y transferencia, gratis"). Demo 60 s: "19,90 al mes todo incluido, 0,9 % solo si cobras con tarjeta, y a los 20 primeros, mitad de precio para siempre."
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
> **✅ CONSTRUIDO (EXT3 Ola 16, 6-jul-2026, autorización A10.0):** la lista F2 está completa
> en Informes — tasa de aceptación/tiempo a decisión/top servicios ya vivían en el funnel;
> € mantenimiento (A15.3, KPI si >0); NUEVO /admin/reports/x2: cobros por método
> (charge.method, sin charge = marcado a mano), € ≤72h tras recordatorio y pendiente por
> antigüedad (0-7/8-30/31-60/60+, copy neutro). Ni cohortes ni BI. También A16.2:
> quotes.validUntil (default 30d editable al crear) + cron horario sent→expired + landing
> N3 "Este presupuesto caducó el [fecha]. Pide uno actualizado 👇" + decisión 410 + pill
> CADUCADO en BO.
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

## Z2. Banco de oportunidades (research 13-jun-2026; NO se construye antes de 25 pagantes — regla 13)
Ideas validadas por el mercado, documentadas aquí para revisión a los 25 pagantes. Las que ya tienen sprint en el master se marcan; el resto son candidatas a re-priorizar U2.
| Oportunidad | Encaje | Estado / dónde |
|---|---|---|
| **Reseñas Google automáticas al cobrar** (link por WA tras pago) | Alto: usa el momento de pago, canal WA, ROI de captación | **Candidata fuerte a U2** (alto valor/bajo coste; ya existe `googleReviewUrl` en onboarding) |
| **IA voz/foto → presupuesto** | Ya es requisito de entrada del vertical, no diferenciador | Ya en master: VOZ-1 (F1) + MEDIA-1 (F2) |
| **Recordatorios de cobro automáticos** | Núcleo anti-morosidad | Ya en master: J1 (24h/7d/14d) ✅ |
| **Mantenimientos recurrentes RITE** (calderas/clima, ingreso recurrente) | Alto: ingreso + cobro recurrente | Ya en master: MANT-1 (F2) |
| **Banco de precios por gremio/zona** ("cobran 23 % más") | Refuerza "no presupuestar de memoria" | Candidata U2 (parte de ONBOARD-2 catálogos por gremio) |
| **Fotos antes/después** (anti-disputa + reseñas) | Fácil, barato | Ya en master: MEDIA-1 (F2) |
| **Factoring/adelanto de cobro al merchant** | Fintech sobre el flujo; ataca la morosidad directamente | Cajón F3-F4 (capital + datos de impago; ya en Z1 "microfactoring") |
| **BNPL al cliente final** (pago a plazos del trabajo) | Fintech; ServiceTitan/Housecall+Affirm lo hacen | Cajón F2 tardía (ya en Z1 "FIN-1", gate ticket ≥1.200 €) |
| **Scoring de morosos compartido entre merchants** | Muy diferenciador + efecto red, pero **riesgo RGPD alto** | Cajón F4 con dictamen legal previo (datos de empresa, no particulares) |
| **Cuenta/tarjeta para el merchant, cashback** | Embedded banking largo plazo | Cajón F4 (tras volumen de pagos) |

## Z3. Competencia directa a vigilar (no construir; inteligencia de mercado)
- **PresupuestAPP (presupuesta.eu) — el competidor MÁS directo y MÁS barato (9,99 €):** ya tiene firma, cobro por tramos vía Stripe, VeriFactu (hash+QR), voz, PWA offline y recordatorios. **Defensa de YaQu: NO competir en precio sino en profundidad de cobro (Connect + take rate + Bizum) + WhatsApp API nativa con botones + simplicidad radical + onboarding white-glove.** No vender "presupuestos" (ahí pierde por precio); vender "cobro y fin de la morosidad".
- **STEL Order:** ya hace WhatsApp + tarjeta + VeriFactu certificado, pero empaquetado como ERP/SAT pesado por usuario (curva alta, config compleja). Defensa: precio único plano y simplicidad frente a su complejidad.
- **Holded/Quipu:** VeriFactu anunciado pero (a feb-2026) no operativo en producción → ventana de ventaja si YaQu lo tiene operativo antes. Pero son gestión de escritorio, no cobro en obra.
- **Presu.app / Motor de Presupuestos / Presux:** presupuesto+voz+IA baratos, sin cobro nativo ni firma con peso legal. El espacio "presupuesto rápido" se está comoditizando <10 € → **el foso de YaQu es el cobro, no el presupuesto** (reafirma A1).

---

# VISIÓN NORTE — Paridad total por packs `decisión del fundador, 14-jul-2026`

> Declaración de dirección a largo plazo. **NO es un plan de construcción ni modifica nada
> de este master** (ver punto 3): es el norte contra el que se capturan ideas y se juzgará
> la revisión de la Parte Z cuando toque.

1. **Meta a largo plazo.** YaQu alcanzará **paridad funcional total** con los softwares de
   facturación/gestión del sector (referencia: el doc de investigación del proyecto —
   research del 13-jun-2026 integrado en Z2/Z3 y reconciliado en
   `docs/historico/RECONCILIACION_master_14jun.md`) y los **superará en completitud e
   intuitividad**. La comercialización será por **PACKS/módulos** (p. ej. Cobros, Fiscal,
   Equipo, Documentos, Contabilidad): el pro compone su YaQu con los packs que su negocio
   necesita, sin pagar ni sufrir la complejidad de los que no.
2. **Regla operativa: NADA se descarta jamás.** Toda pieza de la competencia (Z3) y toda
   idea del fundador se **captura como ticket en Jira** con su fase y su gate — aunque hoy
   viva en el cajón F4 o en "❌ nunca" de Z1. El descarte definitivo no existe; existe el
   gate que aún no se ha alcanzado. (Los "❌ nunca" de Z1 conservan su significado operativo
   actual: no se construyen bajo el régimen vigente; su reconsideración pertenece a la
   enmienda del punto 3.)
3. **EXPLÍCITO — qué NO cambia:** esta visión **NO modifica la Parte Z ni la regla 13**.
   La secuencia de construcción antes de 25 pagantes sigue gobernada por este master tal
   cual está (cola única U, prioridad SIF-1, gates de Z). La revisión de la Parte Z a la
   luz de esta visión (qué entra en qué pack, qué gates se ajustan) se hará como
   **enmienda formal del master AL alcanzar 25 pagantes**, junto con la re-priorización
   comercial que la regla 13 ya prevé.

---

# PARTE AA — CLAUDE CODE OPERATING SYSTEM `F1-doc (canónico aquí; CLAUDE.md lo implementa — regla 35)`

## AA1. Protocolo de sesión (obligatorio)
1. Leer `CLAUDE.md` (auto) → abrir `docs/YAQU_MASTER.md` → localizar el **sprint activo en U**. Duda → preguntar, nunca asumir.
2. Una tarea → una RAMA (`scrum-<n>-<slug>`) → commit de feature (+ commit del máster aparte, misma rama) → PR a `main`. `main` protegida: push directo BLOQUEADO. El merge del PR lo hace un HUMANO, nunca Claude. `git pull` de `main` antes de empezar cada tarea. Plan de archivos ANTES de tocar código (`/yaqu-sprint`).
3. Tests relevantes en verde antes de commit; verificación en **yaqu.app** (no localhost) antes de cerrar tarea.
4. **Stop conditions — parar y pedir OK del fundador si la tarea toca:** claims fiscales/VeriFactu · dinero real o flujo de cobro en producción · plantillas/categoría de Meta · cambios de schema no aditivos · datos de clientes (export/borrado) · flags de P a nivel global.
5. Prohibido inventar estados, transiciones, flags o textos de landing/bot (L, P, N5, K1; reglas 27 y 30). Necesidad nueva = propuesta de cambio de master.
6. Bugs → `docs/BUGS.md` con el formato existente; nada de arreglos "de paso" sin registrar.
7. Cierre de sprint: `/yaqu-release-check` (QA del sprint + docs actualizados + done/evidencias en U) y actualizar el master (✅, nunca borrar).
8. Producción: deploy = MERGE del PR a `main` (Railway auto-deploy desde `main`; push directo bloqueado por protección de rama). Nada destructivo contra la BD de prod sin preview del diff y confirmación (hook AA2).
9. **Staging exprés + E2E automatizado (SCRUM-38):** entorno Railway separado sobre el MISMO `main` (distinción SOLO por env vars: BD propia, `WHATSAPP_DRY_RUN=1` y SIN `WHATSAPP_ACCESS_TOKEN`, SIN `RESEND_API_KEY`/`SMTP_URL`, Stripe TEST con su propio webhook, `DISABLE_CRONS=true`). Tras cada merge+deploy, Claude Code ejecuta la **suite de regresión** (`docs/QA/SUITE_REGRESION.md`, Playwright MCP) contra staging y REPORTA hallazgos (regla 9 de proceso: ticket aparte, no arreglar sobre la marcha); el primer E2E de features de dinero lo sigue verificando un humano en yaqu.app. El login de test `POST /auth/test-login` existe SOLO con las tres cerraduras fail-closed `E2E_TEST_LOGIN_ENABLED` + `E2E_TEST_LOGIN_SECRET` + `E2E_TEST_LOGIN_EMAILS`, env vars que **JAMÁS existen en producción** (allí la ruta cae al 404 estándar, indistinguible de inexistente). Schema de staging con `db push` — el MISMO mecanismo que prod (la carpeta `prisma/migrations` está congelada desde mar-2026; `migrate deploy` dejaría un schema viejo). Los briefs de tarea incluyen sección "E2E AUTOMATIZADO" con el guion a ejecutar tras el merge.

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

AGENTS.md                          ← espejo de CLAUDE.md para el harness de Codex (derivado
                                      del master, regla 35): mismas 10 reglas, AA1, stop conditions
.codex/                            ← tooling equivalente para Codex (TOOLING-CODEX)
  config.toml                      ← MCP servers (Playwright)
  hooks.json                       ← PreToolUse → guard-dangerous
  hooks/guard-dangerous.sh         ← réplica del hook de `.claude/`
.agents/skills/                    ← espejo de skills para Codex: yaqu-* + `impeccable` (terceros)
```
Nota de plataforma: los slash commands personalizados están fusionados con las skills; `.claude/skills/` es la vía recomendada (una skill homónima tiene precedencia sobre un command). El tooling se mantiene duplicado en `.claude/` (Claude Code) y `.codex/` + `.agents/` (Codex); al tocar uno, revisar el espejo.
**Descartado con motivo:** skills "guardian"/"executor" autónomas (es protocolo → CLAUDE.md) · skill de WhatsApp (test J7 + RUNBOOKS, determinista) · skill de QA aparte (es `/yaqu-release-check`) · skill de Prisma (es un hook) · subagents (sin valor para trabajo secuencial de un founder; revisar F2).
**Excepción a la regla 36 (plugins de terceros):** la skill `impeccable` (UI) está instalada en `.agents/skills/impeccable/`. Se documenta aquí por transparencia; su permanencia queda **pendiente de ratificación explícita del fundador** — si no se ratifica, retirar.

---

# PARTE AB — PREMIUM UI / DESIGN SYSTEM `F1-doc (UI-0 = esta parte + skill; el build grande es F2)`

## AB1. Principios visuales
Premium, simple, cálido, rápido. Claridad de Stripe + confianza de Wise (la doctrina de DESIGN.md: "el recibo de confianza"). Mobile-first REAL (pulgar, obra, pleno sol). **Todo gira alrededor del dinero en juego**: presupuesto, señal, cobro, factura, pendiente — el producto parece caro cuando habla del dinero del usuario, no de sus features. Prohibido el aspecto de panel-admin genérico / Bootstrap / "hecho por IA".

## AB2. Design tokens
**DESIGN.md es la ÚNICA fuente de tokens** (colores incl. semánticos y de estado, tipografía Inter con su jerarquía, radios, sombras Reposo/Elevado/Flotante/Foco, spacing, status pills). PROHIBIDO inventar colores, fuentes o sombras nuevas. Si falta un token (p. ej. iconografía, skeleton, motion): derivarlo de los existentes y **proponerlo como cambio a DESIGN.md [VALIDAR CON DESIGN.md]** antes de usarlo en más de una pantalla. Motion: sobrio, ≤200 ms, siempre con `prefers-reduced-motion`. Iconografía: un solo set lineal coherente [VALIDAR: definir set en UI-0; sin dependencias pesadas].

## AB3. Inventario de componentes base (reutilizar SIEMPRE; componente nuevo = añadirlo aquí)
Botón primario/secundario/ghost/danger (DESIGN.md) · card y KPI-card · tabla→cards apiladas en móvil · modal y drawer · banner/aviso · chips de estado de quote/invoice (status pills DESIGN.md) · chip de entrega WhatsApp (J4) · input/select/textarea con label y error · upload de foto (F2) · empty state (ilustración ligera + 1 frase + CTA primario) · skeleton/loading (en cargas >300 ms) · toast · timeline de documento · selector de método de pago (N2/W4) · contador founding · **barra de progreso (`.progress`/`.progress-fill`)** — % cobrado/uso, track neutro + fill de estado verde/ámbar, con tokens y `prefers-reduced-motion`; helper JS compartido **`progressBar(pct, estado)`** (api.js, SCRUM-12) para pintarla desde cualquier vista sin duplicar el markup (SCRUM-11/12; ver DESIGN.md §5) · **menú de acciones (overflow «⋯»)** (SCRUM-31 F3; helper `overflowMenu(actionEls)` en api.js) — kebab que agrupa las acciones SECUNDARIAS cuando una fila/card tiene >2 (AB1 Una Sola Voz: 1 primaria visible + resto en overflow). Trigger `aria-haspopup=menu`/`aria-expanded`; panel `role=menu` con `menuitem`; teclado ↑↓/Home/End/Enter/Esc/Tab; foco al abrir→1.er ítem y al cerrar→trigger (`preventScroll`); cierre por clic-fuera/Esc/scroll; uno abierto a la vez; **popover anclado (con flip) en desktop y HOJA INFERIOR (`.modal-overlay`, como F2) en ≤640px**; sombra Flotante, motion ≤150 ms con `prefers-reduced-motion`. **Nunca esconde**: la acción primaria, **Marcar como PAGADA** (momento del dinero), **PDF** (lectura frecuente) ni **EDITAR el documento** ("Editar líneas": acción muy frecuente, más que Foto/Enviar — añadido en SCRUM-31 tras verificar que escondida no se descubría); **sí esconde**: lo destructivo, lo raro y lo de admin. Reutilizable en jobDetail, jobsView y listas de presupuestos/facturas/clientes · **fila de documento (`.job-doc-row`, ACOTADA al detalle de Trabajo)** — fila para listar documento/actividad con acción: icono de tipo + título + meta (pill `.status-pill` + fecha única es-ES + importe en Tinta ≥700) + 1 acción primaria + overflow «⋯»; unifica los tres semáforos sobre `.status-pill`. Base de la lista fusionada del detalle de Trabajo (SCRUM-31 F5); **se generaliza a `.doc-row` cuando haya un 2.º uso real** (customerDetail/quotesDetail/invoices), no antes. · **línea de presupuesto editable (`.quote-line`)** (SCRUM-139 F1) — TARJETA por línea del editor de presupuesto: concepto a ancho completo (protagonista), campos numéricos con su propia etiqueta (`.quote-line__label`, estilo Label de DESIGN.md — sustituye a los `<th>` al desaparecer la cabecera de tabla), total de línea en Tinta ≥700 tabular (Regla del Importe) y acciones al pie. UNA COLUMNA en móvil, la MISMA tarjeta en rejilla horizontal en ≥768 px: **un solo DOM, cero scroll lateral en cualquier anchura**. NO se reutilizó `.job-doc-row` a propósito: aquella es para LISTAR un documento con una acción, no para EDITAR campos — forzarla habría sido usar el componente equivocado por cumplir el inventario. Acotada al editor de presupuesto; se generaliza si aparece un 2.º uso real (mismo criterio que `.job-doc-row`). Regla: **cero estilos inline aleatorios**; clases/tokens compartidos.

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
| **Morosidad: PMP construcción 96,5 días · España 80,5 días · afecta ~44 % autónomos · cuesta 5.350 €/año a la pequeña empresa** | ✅ (munición de venta nº1) | Observatorio Morosidad CEPYME 2º sem. 2025 (Informa D&B/CESCE) + ATA cierre 2025 |
| **Adopción VeriFactu baja: 8 % implementado, 15 % en piloto** (el miedo fiscal no vende solo) | ✅ | Observatorio TeamSystem/Ipsos, 30-oct-2025 |
| Tolteck cerró ES y deriva a Billin | **[VALIDAR: web .com sigue activa]** | tolteck.com/es-es |
| **PresupuestAPP (presupuesta.eu): competidor MÁS directo — firma + cobro Stripe por tramos + VeriFactu + voz + PWA, a 9,99 €** | ✅ (research 13-jun) | presupuesta.eu — defensa: cobro+WA nativo+simplicidad, no precio |
| **STEL Order: WhatsApp + tarjeta + VeriFactu certificado, pero ERP pesado por usuario (24-60 €)** | ✅ (research 13-jun) | stelorder.com — defensa: simplicidad + precio plano |
| Holded/Quipu: VeriFactu anunciado, no operativo en prod (feb-2026) | **[VALIDAR estado actual]** | webs oficiales |
| PresuNow sin cobro integrado / sin WA API nativa | **[VALIDAR con trial]** | su web (inferido) |
| Stripe Bizum: Checkout/Links/refunds/disputas SÍ · **Connect NO** | ✅ (10-jun) | docs.stripe.com/payments/bizum → BIZUM-WATCH trimestral |
| Límites Bizum: 500-1.000 €/op según banco · 2.000 €/día · 60 recepciones/mes | ✅ | Stripe/Openbank + bancos |
| WhatsApp utility ES ~0,025 $/msg · servicio en ventana 24h gratis (Meta cobra por mensaje entregado desde jul-2025 — modelar margen recordatorios) | ✅ | tarifas Meta 2026 |
| Volumen vía plataforma 1.200 €/merchant/mes · adopción 40-60 % | **[SUPUESTO → discovery + telemetría]** | variable del modelo dual |
| Gestorías como canal masivo (prescriptor crítico ante VeriFactu) | **[VALIDAR piloto 2-3]** | research 13-jun (TeamSystem/Softwariza3) |
| Embedded finance multiplica ingresos 2-5x en vertical SaaS (umbral acelerar fintech: >40 % cobros con tarjeta) | ✅ (referencia fase 3) | a16z/BCG (research 13-jun) |
| CFDI/PAC, DIAN, informalidad oficios MX 95-99 % | ✅ | SAT/DataMéxico/Alegra (research 10-jun) |
| ServiceTitan ~$9-10B cap · Jobber ~$150M ARR (prueba de categoría) | ✅ | NASDAQ/prensa 2024-25 |

# APÉNDICE B — DISCOVERY: 30 PREGUNTAS (10 mínimo antes de cerrar VALIDA-0; registrar en sheet)
**Contexto:** 1) ¿Qué haces y desde cuándo? 2) ¿Solo o con cuánta gente? 3) ¿Trabajos/mes? 4) ¿Ticket típico y el mayor del año? 5) ¿De dónde llegan los clientes?
**Presupuesto hoy:** 6) Enséñame el último que mandaste (que lo ENSEÑE). 7) ¿Cuánto tardas y cuándo lo haces? 8) ¿Cuántos el mes pasado? 9) ¿Cuántos en visto? 10) ¿Haces seguimiento? 11) ¿Has perdido trabajos por tardar?
**Señal y cobro:** 12) Últimos 5 trabajos: ¿señal? ¿cuánta? 13) ¿Cómo te la pagaron (efectivo/Bizum/transfer/tarjeta)? 14) ¿Te han anulado con material comprado? ¿Qué perdiste? 15) ¿Cuánto te deben AHORA? 16) ¿Qué haces cuando no pagan? 17) Si el cliente pudiera firmar y pagar la señal desde el móvil, ¿tus clientes de ESTA semana lo habrían hecho?
**WhatsApp:** 18) ¿% de clientes que te escriben por WA? 19) ¿Mandas presupuestos por ahí? ¿Texto, foto o PDF? 20) ¿WhatsApp Business o normal? 21) ¿Te incomodaría que los mensajes salieran de un número de empresa con tu nombre?
**Fiscal:** 22) ¿Facturas todos los trabajos? (sin juzgar) 23) ¿Quién te lleva "lo de Hacienda"? 24) ¿Te suena VeriFactu? ¿Qué piensas hacer? 25) ¿Módulos o estimación directa? 26) ¿Usas algún programa? ¿Qué odias de él?
**Cierre/pricing:** 27) Si esto te consiguiera UN trabajo más al mes, ¿qué vale en euros? 28) ¿19,90 €/mes: caro, normal o barato? (silencio) 29) ¿0,9 % de un cobro con tarjeta por tener el dinero esa noche: sí o no? 30) ¿Qué tendría que hacer para que dijeras "lo quiero YA"?
**Criterios de alarma (predefinidos):** ≥7/10 no cobran señal NI piensan pedirla → promesa primaria pasa a "que no te dejen en visto + recordatorios", señal = upsell · ≥7/10 delegan todo en gestoría y no les suena VeriFactu → canal gestorías sube, SEO de pánico baja · ≥5/10 dicen que sus clientes no firmarían en el móvil → reforzar "Acepto sin firmar" + aceptación por respuesta de WhatsApp.

---
*YAQU_MASTER v5.3 UNIFICADO (rev. 13-jun-2026: research de mercado integrado — ángulo morosidad en GTM/H, banco de oportunidades Z2, competencia Z3, claims actualizados; sin cambio de estrategia ni de sprints, regla 13 intacta) — base 10 jun 2026. Sprint activo: VALIDA-0 (+ S1-0 humano día 1). Prioridad absoluta: SIF-1. Próxima revisión estratégica permitida: 25 pagantes (regla 13). Historial: v4 (may-26) → v5 + parche v5.1 + addendum v5.2 + delta v5.3 (10-jun-26) → rev. research (13-jun-26) → este documento.*
