# SPRINT DEMO-READY · EXTENSIÓN (Olas 4-6)
### Continuación de docs/SPRINT_DEMO_READY.md — Olas 1-3 completadas ✅

**Contexto:** las Olas 1-3 están en main y verificándose. Queda margen antes de la demo →
se amplía el sprint con tres olas nuevas: **Ola 4 (landing pública)**, **Ola 5 (estrategia
de ventana de WhatsApp — coste ~0€)** y **Ola 6 (pack premium de pulido)**.

**Mismas reglas:** una tarea = un commit = verificación en yaqu.app (+ Playwright con
evidencias en docs/evidencias/). Prohibido: claims fiscales fuera del guion H2, tocar
`INVOICING_ES_ENABLED`, reordenar el registro, refactors fuera de alcance. Prisma aditivo.
Flags nuevas arrancan OFF; activación = fundador (PENDIENTES_FUNDADOR).

> **📌 ESTADO DE EJECUCIÓN (5-jul-2026 · lo mantiene Claude Code):**
> **Sprint base (Olas 1-3): ✅ COMPLETO Y VERIFICADO** — detalle en SPRINT_DEMO_READY.md. Extras post-cierre:
> bot E2E real funcionando (causa raíz entrantes: `subscribed_apps` de la WABA solo tenía la app de debug de
> Meta → FlashClient suscrita vía Graph API) · bot copy v2 (`46962e6`, master K1 actualizado) · saludos no
> disparan handoff · identidad tolera teléfonos con "+" · recibo tolera URLs sucias de plantilla (`456b98c`).
> Lado fundador pendiente (PENDIENTES_FUNDADOR): rotar `WHATSAPP_ACCESS_TOKEN` (expuesto en chat) · FASE B
> WABA producción (SIM) · webhook Connect + flags · EMAIL_FROM · Carril 0.
> **Extensión (Olas 4-6):** A6.1 ✅ (`d1d5262`: seed "Fontanería García" — 7 clientes/8 productos/12
> presupuestos/5 facturas/5 cobros; reset con `node scripts/seed-demo.mjs`) · **A4.7 guion v2 APROBADO
> (fundador, 5-jul): "dos actos"** — Acto 1 = 4 escenas guiadas del dinero (<30s, auto-play: Home dinero
> en juego → crear 450 € → cliente firma en móvil → cobro+toast); Acto 2 = chips de exploración (bot WA
> con "pagar pendiente", clientes 360, catálogo, gastos y margen, informes, solicitudes, proveedores) —
> cada chip 1 captura real + micro-animación; "informes personalizados" se enseña como Informes reales
> (honestidad: la maqueta = el producto). Capturas del dashboard (390px) las aporta el fundador al llegar
> a A4.7; las públicas las hace Claude con Edge headless. · **Ola 4 A4.1–A4.6 ✅ COMPLETA (5-jul,
> `08cb3f4`→`e4b8c3a`):** hero morosidad + mockup real + PURGA fiscal (grep=solo los 2 hits del guion H2
> en la FAQ) · 3 pasos zigzag con capturas reales + reveal IO · #demo con carrusel real y hueco de vídeo
> (DEMO_VIDEO_URL) · precios 29/290 + founding contador real (/public/founding-status) + copy 0,9 % ·
> FAQ 9 objeciones H6 (VeriFactu = H2 literal) + footer serio · OG 1200×630 real (img/og.png) +
> favicon + preload LCP. · **A4.7 ✅ COMPLETA (5-jul, `915d11d`+`bacd28f`):** el bloqueo de capturas se
> resolvió SIN fundador — pipeline headless propio (magic link `type:'magic_link'` minteado en BD → Edge
> `--headless` con perfil persistente → deep-links `/dashboard/#vista`; tutorial.js se auto-silencia en
> headless `915d11d`). Capturas 390px limpias en `public/img/landing/` + `docs/evidencias/demo-caps/`.
> 🔴 **RETIRADA el 5-ago-2026 (SCRUM-376). El párrafo de abajo describe algo que NUNCA llegó a estar
> publicado, y se deja escrito en vez de borrarlo porque un hueco silencioso es como nació el
> problema.** Medido: `public/index.html` carga solo `js/atribucion.js` y no menciona `idemo` ni una
> vez — nadie cargaba `landing-demo.js`. La documentación lo daba por publicado y un test lo citaba
> como si existiera en pantalla. Qué lleva la landing lo decide el **bloque F**, que está por hacer:
> encenderla habría sido tomar una decisión de producto por la puerta de atrás. Está en el historial
> de git y el bloque F puede resucitarla A PROPÓSITO, que es distinto de heredarla por inercia.
>
> ~~Demo publicada~~ (retirada): `public/js/landing-demo.js` (vanilla, sin líbs) — Acto 1 = 4 escenas (<30s, auto 7s,
> hotspot clicable, dots+pausa, arranque perezoso IO, reduced-motion sin auto-play); Acto 2 = 5 chips
> (bot WA con pagar-pendiente recreado, clientes, catálogo, informes, solicitudes; SIN gastos/proveedores
> — el seed no tiene gastos y la maqueta solo enseña lo real). Carrusel A4.3 retirado; DEMO_VIDEO_URL
> sigue teniendo prioridad si algún día hay vídeo. Cero "factura"/fiscal en la maqueta (regla 26). ·
> **Fix móvil dashboard (5-jul, `9b5a5c1`):** scroll lateral a 390px eliminado (`min-width:0` en
> .main/.view-container + `overflow-x:clip`), reportado por el fundador con DevTools. ·
> **Ola 5 ✅ COMPLETA (5-jul):** A5.1 `57d2983` (tabla de coste por ciclo en WHATSAPP_TEMPLATES.md:
> hoy ~0,11–0,23 €/ciclo → ventana-first ~0,023 €) · A5.2+A5.3 `8076118` (entrantes como `type:'inbound'`
> en el log WA-0b — una fila por merchant con ese teléfono; `isServiceWindowOpen` 23,5 h;
> `sendWhatsAppWindowFirst()` texto 0 € + fallback plantilla, waOptOut respetado; aplicado a
> payment_request, recordatorios 7/14 d y payment_confirmation_invoice/recibo-reseña; copy de ventana
> cumple regla 24/26 — "justificante" para J-…; quote_decision queda como ÚNICA plantilla del ciclo;
> SIN cambios de schema) · A5.4 `972b795` (J8: bloque `channel` plantilla-vs-ventana + ahorro € en la
> tarjeta de Informes). **Los quick replies que abren ventana en cada paso = acción del fundador en Meta**
> (al recrear plantillas en FASE B; ya documentado con ejemplos en PENDIENTES_FUNDADOR §FASE B.5). ·
> **Ola 6 (5-jul):** A6.2 ✅ `8db5e70` (showToast global en api.js con variantes ok/warn/error, cero
> alert() en el BO, uiSkeletonCards para Gastos/Solicitudes, /recibo con check celebratorio animado al
> llegar recién pagado `?card=success`/`?celebrate=1`; la firma ya celebraba) · A6.3 ✅ `f153609`
> (checklist de Home con progreso X/Y y los pasos que venden: logo, IBAN/Bizum, WhatsApp, reseñas
> Google, NIF, primer presupuesto; el wizard de 5 pasos ya cumplía el resto de la spec) · A6.4 ✅
> `d154adc` (emailLayout.ts compartido email-safe: magic link, invitación, presupuesto con importe en
> tinta, justificante/factura; escEmail en nombres) · A6.5 ✅ `bdaad11` (empty states dignos en
> Facturas/Proveedores/Equipo + 404 global con marca para navegadores, JSON para API) · A6.7 ✅
> `36b8425` (merchants.home_prefs JSONB aditiva — diff previsualizado y **aprobado explícitamente por
> el fundador en sesión** — botón Personalizar solo-admin + panel de checkboxes de 6 bloques,
> persistencia en BD, default todo visible; registrada en MIGRATIONS_PENDING.md). ·
> **A6.6 (cierre) ✅ COMPLETA (5-jul, `bd5b0a3`→`da7bf9e`):** barrido de las 18 pantallas del guion a
> **390×844@2x REAL** → `docs/evidencias/demo-final/` (BO completo + firma/pago/recibo/404 del cliente).
> **Hallazgo de tooling:** `msedge --headless --screenshot` clampa la ventana a ~500px — TODAS las
> capturas "390" anteriores eran layout de 492px recortado (sus "overflows" eran artefactos). Pipeline
> nuevo: `scripts/capture-demo.mjs` (puppeteer-core sobre el Edge instalado, viewport real, purga del
> service worker del PWA + reload; perfil autenticado vía magic link). **P1 reales encontrados y
> ARREGLADOS:** (1) dinero client-facing en formato anglo ("326.70 EUR") → `formatMoneyEs()` es-ES
> ("326,70 €") en firma/pay/recibo `bd5b0a3`; (2) Crear presupuesto medía 650px en un móvil de 390 —
> raíz: pistas `1fr` crecen al min-content de la tabla de líneas → `minmax(0,1fr)` en
> quotes-layout/form-rows `af957e6` + tabla en carril propio `.quote-lines-scroll` `9019b24`;
> (3) TODAS las tablas del BO recortaban columnas (estado/acciones) en móvil → carril con scroll
> propio a ≤768px `483b160`. P2/P3 anotados (no bloquean demo): botón "Pagar con tarjeta" envuelve
> apretado con el chip RECOMENDADO a 390 · banner del recibo dice "estamos generando tu factura"
> cuando ya existe · totales del BO interno en formato punto (merchant-facing).
>
> **🏁 SPRINT EXT COMPLETO (Olas 4, 5 y 6 — 5-jul-2026).** Todo verificado en yaqu.app. Queda del
> lado del fundador: rotar `WHATSAPP_ACCESS_TOKEN`, FASE B WABA producción (con quick replies §B.5),
> P3-3 Utility, webhook Connect + flags, EMAIL_FROM, vídeo 60s (`DEMO_VIDEO_URL`) y ensayar el guion
> de 90s 3 veces sobre la cuenta demo (gate humano de la Ola 6).

---

## OLA 4 — Landing pública yaqu.app (la que ve la gente ANTES de entrar)

> La landing es la cara del producto para los 20 contactos: la verán ANTES o DESPUÉS de la
> demo, y decide si "esto es serio" o "esto es un proyecto de garaje". Spec base: Parte W1
> del master + BUG_BASH_LANDING.md. Móvil-first radical: la van a abrir desde WhatsApp.

**A4.1 `[CC]` — Hero que vende cobro.**
- H1 con la promesa de cobro (línea del master: "¿Cuántas señales has dejado de cobrar este
  mes?") + subtítulo de una frase (presupuesto en 30s → firma → señal cobrada, por WhatsApp).
- CTA primario único ("Empieza gratis" → registro) + CTA secundario "Ver demo de 60 s".
- Mockup/screenshot real del flujo en un frame de móvil (usar capturas reales del producto,
  no ilustraciones genéricas).
- PROHIBIDO en toda la landing: "factura", "VeriFactu", claims fiscales (pre-SIF). Si existe
  sección VeriFactu, SOLO con el wording del guion H2.

**A4.2 `[CC]` — Sección "cómo funciona" en 3 pasos.**
1) Crea el presupuesto en 30 segundos → 2) Tu cliente lo firma desde su móvil → 3) Cobra la
señal antes de empezar. Cada paso con captura real. Animación sutil al hacer scroll (CSS,
sin librerías pesadas).

**A4.3 `[CC]` — Hueco del vídeo de 60 s.**
Bloque preparado para el vídeo (V0-6): póster + play. Mientras no exista el vídeo, mostrar
un carrusel de 3-4 capturas del flujo real. Que insertar el vídeo luego sea cambiar UNA url.

**A4.4 `[CC]` — Precio único + founding.**
Reusar la tarjeta de /precios (Pro 29/290 + banner founding 14,50 de por vida con contador
REAL — nada de contadores fake). Copy del 0,9% claro: "Solo si cobras con tarjeta: 0,9%.
Bizum y transferencia: 0€."

**A4.5 `[CC]` — FAQ (8-10 reales) + footer serio.**
FAQ desde las objeciones de H6 del master ("ya lo hago gratis por WhatsApp", "¿y si mi
cliente no usa apps?", "¿me vale para VeriFactu?" → respuesta = guion H2 literal, etc.).
Footer: aviso legal, privacidad, cookies (enlaces reales del bundle legal), contacto.

**A4.6 `[CC]` — Performance y detalle fino.**
Lighthouse móvil ≥90 (spec W1): imágenes comprimidas (webp), lazy-load, cero JS innecesario.
Favicon + meta OG/Twitter (título, descripción, imagen) para que el link de yaqu.app se vea
premium al compartirse POR WHATSAPP — es literalmente cómo va a llegar a los prospectos.

**A4.7 `[CC]` — Demo interactiva embebida (patrón Holded).** ✅ HECHA (5-jul, `bacd28f` — "dos actos" v2: 4 escenas + 5 chips, capturas propias vía Edge headless; detalle en ESTADO).
Bloque central de la landing: un frame que SIMULA el producto y el visitante puede clicar.
- **Alcance acotado (no es el BO real, es una maqueta guiada):** 3-4 "escenas" clicables:
  (1) Home con dinero en juego → clic en "Nueva cotización" → (2) crear presupuesto (líneas
  precargadas apareciendo con animación, total subiendo) → clic en "Enviar por WhatsApp" →
  (3) mockup de móvil: el cliente recibe el WA, toca "Aceptar y firmar", firma animada →
  (4) pantalla de cobro: método elegido, check de pagado + "💰 García te ha pagado 450 €".
- Implementación: HTML/CSS/JS vanilla, capturas/HTML estático del producto REAL como base,
  hotspots clicables con pulso sutil, transiciones CSS. Cero librerías pesadas (gate
  Lighthouse ≥90 de A4.6 sigue vigente). Auto-avance suave si el usuario no clica en 6-8s,
  con controles de pausa/retroceso.
- En móvil (mayoría del tráfico): misma pieza adaptada o fallback a carrusel animado de las
  4 escenas — decidir según rendimiento real, nunca sacrificar carga.
- Datos de la maqueta = los del seed de A6.1 (Fontanería García): coherencia total con lo
  que verán si piden demo real.
- Copy de cierre bajo el frame: "Así de fácil. Pruébalo con tus datos →" (CTA registro).
- PROHIBIDO dentro de la maqueta: la palabra "factura" o claims fiscales; el documento
  final se llama justificante (regla 26).

✅ **Gate Ola 4:** abres yaqu.app en un móvil y en 5 segundos entiendes qué es, para quién
y qué hacer. El link compartido por WhatsApp muestra preview digna. La demo interactiva
cuenta el flujo completo en <30 segundos de clics.

---

## OLA 5 — Estrategia de ventana: WhatsApp a coste ~0 (patrón "Simyo")

> Descubrimiento clave del fundador: los quick replies. Cuando el cliente TOCA un botón,
> cuenta como mensaje entrante → abre ventana de servicio de 24h → los mensajes siguientes
> (texto libre y utility) son GRATIS. Diseñar todo el flujo para que el cliente siempre
> tenga un botón que tocar = pagar solo el PRIMER mensaje de cada ciclo.

**A5.1 `[CC]` — Auditoría de flujo por coste.**
Mapear el ciclo completo (presupuesto → decisión → cobro → confirmación → reseña) y marcar
cada mensaje: ¿plantilla de pago o mensaje en ventana? Objetivo: SOLO el primer mensaje del
ciclo (quote_decision) es plantilla pagada; todo lo demás cae en ventana abierta.
Entregable: tabla en docs/WHATSAPP_TEMPLATES.md con coste antes/después por ciclo.

**A5.2 `[CC]` — Quick replies que abren ventana en cada paso.**
- Revisar que las plantillas usan botones quick reply (no solo URL): un botón URL NO abre
  ventana (el cliente no envía nada); un quick reply SÍ.
  ⚠️ Los botones de `quote_decision_es` (Aceptar y firmar / Ver antes / Rechazar) ya son
  el patrón correcto — replicarlo en el resto.
- Tras cada tap del cliente: responder DENTRO de la ventana con mensajes de texto/interactivos
  gratuitos (no plantillas) siempre que la ventana esté abierta.
- En el envío: lógica "¿hay ventana abierta con este número?" → sí: mensaje libre (0€) ·
  no: plantilla (pagada). Registrar `sentVia: 'template'|'window'` para medir.
- Gate: requiere webhook de entrantes activo (`BOT_INBOUND_ENABLED`, ya construido en A3.1).

**A5.3 `[CC]` — Confirmaciones y reseña dentro de la ventana.**
El momento del pago casi siempre ocurre con ventana abierta (el cliente acaba de interactuar):
payment_confirmation y el link de reseña (A2.5) deben intentar SIEMPRE la vía ventana antes
de gastar plantilla. Fallback a plantilla solo si la ventana expiró.

**A5.4 `[CC]` — Métrica de coste en admin interno.**
Contador simple (por día/merchant): mensajes por plantilla vs por ventana + coste estimado.
Alimenta la alerta de gasto de A3.2. Es también un argumento de venta interno: saber que tu
coste marginal de WhatsApp por trabajo es céntimos.

✅ **Gate Ola 5:** un ciclo completo de demo gasta 1 plantilla (~0,017€ post-Utility) y el
resto viaja gratis por ventana. Documentado con la tabla antes/después.

---

## OLA 6 — Pack premium (pulido que se NOTA en demo)

> Criterio de entrada: cosas visibles en el guion de 90s o en los 3 primeros minutos de un
> merchant nuevo. Nada de features nuevas grandes.

**A6.1 `[CC]` — Cuenta demo impecable (lo primero de la ola).**
La demo se enseña sobre demo@yaqu.app: sembrarla con datos BONITOS y creíbles — logo,
nombre "Fontanería García" (o similar), 6-8 clientes con nombres reales españoles, 10-12
presupuestos repartidos por estados (con importes realistas 180-2.400€), 3-4 cobros hechos,
1 pendiente (para el "dinero en juego" de la Home). Script `scripts/seed-demo.mjs`
idempotente para resetearla antes de cada demo. Los números que se ven en pantalla SON el
argumento de venta.

**A6.2 `[CC]` — Micro-interacciones del flujo estrella.**
- Página de firma del cliente: transición suave al firmar + pantalla de éxito clara.
- Página /pay: al completar pago, confirmación celebratoria (check animado CSS, sin librerías).
- Toasts consistentes en el BO para cada acción (enviado, guardado, cobrado).
- Skeletons en cargas >300ms (spec del design system) donde falten.

**A6.3 `[CC]` — Onboarding de merchant en 3 minutos.**
Pulir el wizard de alta (lo vivirán los founding delante de ti): pasos claros, checklist de
Home ("Te falta: logo · IBAN/Bizum · link de reseñas") con progreso visible, y que al acabar
el wizard exista ya 1 producto y pueda crear su primer presupuesto sin fricción.

**A6.4 `[CC]` — Emails a la altura.**
Las plantillas de Resend (magic link, presupuesto, justificante) con el mismo diseño premium:
logo YaQu, tipografía, botón CTA claro, footer legal. Un email cutre delata al producto.

**A6.5 `[CC]` — Estados vacíos y de error con dignidad.**
Revisar TODAS las pantallas del BO en estado vacío (merchant nuevo): ilustración ligera +
1 frase + CTA (spec design system). Página 404/error genérica con marca. Nada de pantallas
en blanco ni "undefined".

**A6.6 `[CC]` — Barrido visual final con Playwright.**
Capturas móvil 390px de TODAS las pantallas del guion de demo (Home, crear, modal, detalle,
firma cliente, /pay, confirmación, reseña, justificante PDF) → docs/evidencias/demo-final/.
Revisión contra design system: espaciados, tipografías, colores fuera de token. Lista de
hallazgos y fix de los P1 visuales.

**A6.7 `[CC · último de la ola]` — Home "personalizable" versión ligera.**
NO es DASH-PREMIUM-1 (nada de drag&drop ni layouts). Versión de medio día:
- Botón "Personalizar" en la Home → panel con checkboxes para mostrar/ocultar cada bloque
  (dinero en juego, KPIs, últimos presupuestos, cobros pendientes, accesos rápidos…).
- Persistencia: columna JSON aditiva en el usuario (`homePrefs`), default = todo visible.
- Valor en demo: la frase "y esto te lo configuras a tu gusto".
- Condición de entrada: SOLO si Olas 4 y 5 están cerradas. Si hay que recortar, se recorta esto.

✅ **Gate Ola 6:** el fundador ensaya el guion de 90s tres veces sobre la cuenta demo
sembrada y no encuentra NADA que le dé vergüenza enseñar.

---

## ORDEN Y DEPENDENCIAS

1. **A6.1 primero** (cuenta demo sembrada — la necesitan el ensayo, la maqueta A4.7 y el resto).
2. **Ola 4 completa** (landing; A4.7 al final de la ola, cuando existan las capturas reales
   pulidas del resto del sprint).
3. **Ola 5** (ventana WhatsApp — A5.2 depende de que actives `BOT_INBOUND_ENABLED`, que ya
   está en PENDIENTES_FUNDADOR; el código puede prepararse antes tras flag).
4. **Resto de Ola 6** (A6.2 → A6.5), **A6.7 solo si sobra tiempo**, y cierre con **A6.6**
   (barrido final, siempre lo último).

## CHECKLIST AMPLIADA (se suma a la del sprint base)
☐ Landing: 5 segundos de claridad en móvil + preview OG digna al compartir por WhatsApp
☐ Landing sin UN SOLO claim fiscal (grep "factura|VeriFactu|Hacienda" en public/)
☐ Ciclo de demo = 1 plantilla pagada, resto por ventana (tabla antes/después en repo)
☐ Cuenta demo sembrada + script de reset
☐ Emails con diseño premium
☐ Demo interactiva (A4.7) contando el flujo en <30s de clics, sin claims fiscales
☐ Barrido visual final hecho y P1 visuales corregidos
○ (Bonus) Home personalizable versión checkboxes (A6.7) — recortable sin dolor
