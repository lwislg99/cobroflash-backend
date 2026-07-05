# SPRINT DEMO-READY · EXTENSIÓN 3 (Olas 10-23) — DOCUMENTO ÚNICO
### Fortaleza invisible + features visibles adelantadas de U2 + flecos + UI premium total
**Sustituye y engloba a los borradores EXT3/EXT4 anteriores. Olas 1-9 completadas ✅.**

> **📌 ESTADO DE EJECUCIÓN (lo mantiene Claude Code):**
> **A10.0 ✅ (`b5f3ac7`)** nota de gobernanza en master U2 · **Propuestas de mercado ✅
> (`085ee15`)** las 5 en DECISIONES_PENDIENTES.md, ninguna construida · **Schema EXT3 ✅
> (`4293d88`)** lote aditivo completo aprobado y aplicado (vía `db execute` con SQL auditado
> 0-destructivo; el falso positivo del UNIQUE sobre slug nueva exigía un flag vetado) —
> merchants+5, quotes+3, customers+2, tablas jobs/maintenance_plans/audit_log/attachments.
> **OLA 10 ✅ COMPLETA (5-jul):** A10.1 `328c188` (página legal branded /legal/alcance-beta con
> md→html escapado; evidencia legal_acceptances con versión=hash del texto — texto nuevo del
> asesor invalida aceptaciones; GATE 412 en checkout founding; modal iframe+checkbox; ⚠️ el TEXTO
> sigue siendo borrador con placeholders — asesor, en checklist fundador) · A10.2+A10.4 `197b162`
> (FSM Parte L en el webhook único: past_due CONSERVA el plan + banner global "Hay un problema con
> tu pago"+portal; canceled→trial; trial expirado añade "tus datos NUNCA se borran"+exports 1-clic;
> dedupe por event.id LRU — test formal en A12.2) · A10.3 `5041fed` (core/entitlements.ts, ÚNICO
> mapa plan→límites W3: 1/5 usuarios + fair-use; 409 user_limit digno con oferta Equipo; regla 34).
> Evidencias: `docs/evidencias/ext3/a10*` (legal 390+1280, modal, planes, trial expirado — estado
> forzado en demo y RESTAURADO). Gate E2E del checkout real espera precios Stripe (fundador).
> **OLA 13 ✅ COMPLETA (5-jul, `cc39cd7`):** A13.1 modelo jobs + FSM L estricta + ensureJobForQuote
> idempotente en los TRES caminos de accept (público/BO/WhatsApp legacy) · A13.2 vista Trabajos
> (LISTA por fecha — sin calendario grid: En curso/Esta semana/Sin agendar/Más adelante/Terminados/
> Cerrados; agendar datetime, empezar, terminar, cerrar, .ics 2h, notas blur-save) · A13.3 el
> momento de dinero: terminado+tramo pendiente → "💰 Cobrar el resto" → collect-rest con la MISMA
> maquinaria del accept + payment_request ventana-first. Jobs de demo sembrados para los aceptados
> del seed (agendado/en curso/terminado con resto de 586,85 €). Evidencias: `ext3/a13-trabajos-*`.
> **OLA 20 parcial:** A20.2 ✅ "Margen %"+tooltip (i) accesible · A20.3 ✅ rol "Operario" en toda la
> UI (valor interno intacto) `c4f74ca`. Quedan A20.1 (GBB), A20.4 (cliente empresa+docFields),
> A20.5 (fallback J5 completo).
> **OLA 20 🟡 (solo falta A20.1):** A20.2 ✅ + A20.3 ✅ `c4f74ca` · A20.4 ✅ `31391ff` (cliente
> empresa: razón social+NIF en alta/edición/zod — el NIF lo exigirá VeriFactu S1-C; bloque "Datos
> del cliente en el documento" en el creador → quotes.doc_fields; el PDF respeta docFields y la
> razón social sustituye al nombre) · A20.5 ✅ `6dac367` (waFallbackBar compartida: Copiar enlace/
> Email/Reintentar SIEMPRE en fallo — detalle de presupuesto 3 caminos, detalle de factura con
> mensaje humano J5 del server + charge_id, NUEVO /admin/invoices/:id/send-email, crons registran
> wa_send_failed visible en la ficha 360; 131026 → "cópialo y mándaselo por SMS o llámale").
> **A20.1 (GBB) pendiente** — abre el próximo empujón con investigación E2E propia.
> **CHOQUES Olas 1-9 señalados al fundador (resolución al llegar):** A22.3 búsqueda global ya
> existe → completar contra spec · A17 load-catalog ya existe → migrar contenido a data/catalogs
> con schema master · A16.1 → añadir SOLO métricas X2 faltantes. **Decisiones fundador recibidas:**
> rol Técnico → **"Operario"** (A20.3) · push lote EXT3 ✅.

**Tesis:** las Olas 1-9 hicieron que la demo ENAMORE. Esta extensión hace tres cosas:
(A) que el producto AGUANTE clientes reales pagando (Olas 10-12), (B) adelanta las
features VISIBLES de U2 con spec completa en el master (Olas 13-19, decisión del
fundador), y (C) cierra flecos, blinda los flujos de dinero y deja TODA la UI premium
(Olas 20-23). Ventana: ~2 días de trabajo intensivo.

---

## ⚖️ GOBERNANZA (leer primero, Claude Code)

El backlog U2 está gateado a 25 pagantes (regla 13). El FUNDADOR autoriza adelantar la
CONSTRUCCIÓN de los ítems de las Olas 13-19 con estas condiciones:
1. Solo ítems con **spec completa en el master** (Parte R, X2, N3, AB4, V, O). CERO
   invención: si la spec no cubre algo → preguntar, no rellenar.
2. Todo lo que tenga flag en Parte P nace y queda **OFF** (PERFIL, MANT). Activar = fundador.
3. Esto NO cambia GTM ni prioridades de venta (morosidad nº1, guion H2, regla 24 intactos)
   ni desbloquea nada más de U2/Z.
4. **Tarea A10.0 (el primer commit de todo):** anotar en el master, sección U2, nota
   fechada: "Decisión fundador [fecha]: se adelanta la CONSTRUCCIÓN tras flag de JOB-1,
   PERFIL-1, MANT-1, ANALYTICS-1, validUntil/expired, ONBOARD-2 (maquinaria), DASH-PREMIUM-1
   (pulido) y R14/V (blindaje money-flows) durante la ventana pre-demo; re-priorización
   comercial a 25 pagantes intacta (regla 13)." Nunca borrar; solo anotar (regla 16).

**Reglas de SIEMPRE (aplican a todas las olas):** una tarea = un commit = evidencias
Playwright 390/1280 en docs/evidencias/ · Prisma aditivo con diff previo; si db push
propone borrar algo → PARAR · alcance cerrado (hallazgos fuera de tarea → propuesta en
doc, no código) · copys nuevos de UI/canal se PROPONEN al fundador antes de fijarse
(regla 30) · anti-spam J6 intocable (regla 28) · "justificante de cobro", jamás
"factura"; claims fiscales solo guion H2 · nada de mensajes reales de WhatsApp en tests.

---

# BLOQUE A — FORTALEZA (lo invisible que permite cobrar y dormir)

## OLA 10 — Monetización lista para founding

**A10.0 `[CC]`** — Anotación de gobernanza en el master (arriba). Commit propio.

**A10.1 `[CC]` — Contratación founding con aceptación del ALCANCE BETA (regla 25).**
En el checkout founding: paso/checkbox "He leído y acepto el alcance de la beta" con el
contenido de docs/legal/ALCANCE_BETA.md visible (página /legal/alcance-beta), registrando
evidencia (userId, ts, IP, versión del texto). Sin aceptación → no hay checkout. El texto
legal NO se redacta ni se toca: si falta algo, avisar al fundador.

**A10.2 `[CC]` — Estados de suscripción completos (Parte L).**
`trial → active(founding|pro|equipo)` · `trial → expired` (bloqueo SOFT: pantalla digna
"Tu prueba ha terminado" + CTA + datos siempre exportables, jamás borrado) · `active →
past_due` (banner "Hay un problema con tu pago" + portal Stripe) → `active|canceled`.
Fuente única: webhooks Billing; prohibido cambiar plan sin evento o acción admin auditada.
Respetar exención OWNER_EMAILS. Evidencia de cada estado forzado en test.

**A10.3 `[CC]` — Entitlement de usuarios (W3, lo que faltaba de PRECIOS-1).**
Límite de usuarios (1 Pro / 5 Equipo manual) vía plan→flags (regla 34: PROHIBIDO
hardcodear checks de plan en rutas). Al tope: mensaje digno con oferta Equipo. El
fair-use WA ya está (A9.3): no tocar.

**A10.4 `[CC]` — Robustez de webhooks de Billing.**
Evento duplicado no duplica cambios de plan (idempotencia event.id) · fuera de orden no
corrompe estado · firma inválida = 401+log. Con Stripe CLI simulado.

✅ **Gate:** un founding de prueba contrata con alcance aceptado y registrado; su plan
sobrevive a duplicados; el trial expirado se ve digno.

## OLA 11 — Seguridad, auditoría y datos (S2 · S3 · S4)

**A11.1 `[CC]` — Auditoría F1 (S2 mínimo).** Registrar con userId+IP: `marcar_pagado_manual`,
`deshacer_pago`, `anular_factura`, `cambio_flag`. Nada más (AuditLog completo = F2).

**A11.2 `[CC]` — Hardening S3 con informe.** Verificación TOTAL sobre código real
(cumple/no cumple/fix): firma verificada en TODOS los webhooks (Stripe, Connect, MP,
Meta sha256; sin firma = 401+log) · rate-limit magic link/login · Zod en TODO input ·
cookies httpOnly+Secure+SameSite=Lax · PII fuera de logs (teléfonos enmascarados) ·
secretos solo env. Fixes uno a uno, commit por fix.

**A11.3 `[CC + FUNDADOR]` — Backup cifrado fuera de Railway (S4: "ANTES de 25 pagantes").**
`scripts/backup-dump.mjs`: pg_dump + cifrado (clave por env) + subida a destino externo.
Destino y credenciales = FUNDADOR (entrada en PENDIENTES_FUNDADOR); programación semanal.
Documentar política de backups Railway (el [VALIDAR] de S4). **Test de RESTAURACIÓN
documentado** — un backup no probado no es un backup.

**A11.4 `[CC]` — Exports RGPD operativos (R11 parte F1).** CSVs de clientes/presupuestos/
cobros completos y con encoding correcto (Excel español: separador ;, UTF-8 BOM). Es la
respuesta a "¿y si cierras?".

✅ **Gate:** informe S3 en verde, 4 acciones auditadas, backup restaurable, exports OK.

## OLA 12 — QA_MASTER automatizado (⚠️ se ejecuta LA ÚLTIMA de todo el documento)

**A12.1 `[CC]` — Tenancy suite.** `tests/tenancy.test.mjs` (Q): sesión de merchant B
contra rutas con IDs de A (quote, invoice, customer, charge, export, pdf + las nuevas:
pay/, recibo, reseña, connect, jobs, planes, perfil) → SIEMPRE 404/403.

**A12.2 `[CC]` — Idempotencia de webhooks (todos).** Por proveedor (Stripe pagos, Connect,
MP, Meta): mismo evento dos veces → un solo efecto. provider+event_id verificado.

**A12.3 `[CC]` — E2E crítico release-blocker.** `npm run e2e:critico` (Playwright):
registro→onboarding→producto→quote→landing→firma→justificante→pago test→estados BD→
confirmaciones→PDF, contra cuenta demo con reset de seed. El botón "¿despliego tranquilo?".

**A12.4 `[CC]` — Permisos del rol técnico.** Lista de rutas admin-only en array exportado;
test con sesión técnico → 403 siempre; ruta nueva obliga a clasificarla.

**A12.5 `[CC]` — Suite de PDFs.** Quote firmado, justificante (serie J), demo watermark,
regeneración on-demand (R8). Sin factura fiscal (tras flag).

✅ **Gate:** `npm test` + `npm run e2e:critico` en verde, documentados en QA_MASTER.md
como estándar de cierre de cualquier tarea futura.

---

# BLOQUE B — FEATURES VISIBLES (adelanto autorizado de U2, specs Parte R/X2/N3/AB4)

## OLA 13 — JOB-1 · Trabajo mínimo (LA feature de dinero pendiente)

**A13.1 `[CC]` — Modelo y FSM (Parte L).** Job: `pendiente_agendar → agendado(scheduledAt)
→ en_curso → terminado → cerrado`. Auto-creación al quote→accepted. Campos: scheduledAt?,
assignedUserId? (Equipo), notes. (Fotos NO aquí: gate R2, Ola 19.)

**A13.2 `[CC]` — UI "Esta semana".** Lista simple por fecha (NO calendario grid, lo
prohíbe la spec) + cambios de estado + botón **.ics** por trabajo. Nada de Google
Calendar OAuth (cajón F3).

**A13.3 `[CC]` — El momento de dinero.** `terminado` con tramo pendiente → CTA "Cobrar
el resto": cobro del segundo tramo por el flujo normal (/pay, métodos del merchant,
payment_request). V2 del master: el resto JAMÁS se cobra solo; siempre acción del pro.
`cerrado` = todo cobrado o decisión del pro.

✅ **Gate:** presupuesto 50/50 aceptado → Job → terminado → un toque → el cliente tiene
el link del resto. La historia de morosidad, redonda.

## OLA 14 — PERFIL-1 · Perfil público + QR · flag `PUBLIC_PROFILE_ENABLED` (OFF)

**A14.1 `[CC]` — /p/:slug.** Slug único minúsculas-guiones (lista reservada: admin, api,
pay, p, login…; editable 1 vez/30d). PÚBLICO: nombre comercial, logo, gremio(s), zonas
(chips), años exp. (opc.), "Pedir presupuesto por WhatsApp" (wa.me del PRO), link reseñas
si googleReviewUrl, footer "Hecho con YaQu" → ?src=profile. **NUNCA público:** precios,
clientes, volumen, email, NIF, dirección exacta. Flag OFF → 404 digno.

**A14.2 `[CC]` — QR furgoneta.** Generador en BO (PNG alta res) → /p/:slug?src=qr.
Registro atribuido: acquisitionSource ∈ {profile, qr}.

**A14.3 `[CC]` — Demo.** Flag ON solo en cuenta demo: perfil de Fontanería García listo.

✅ **Gate:** /p/fontaneria-garcia impecable a 390px; QR desde otro móvil funciona y
atribuye.

## OLA 15 — MANT-1 · Mantenimientos recurrentes · flag `MAINTENANCE_ENABLED` (OFF)

**A15.1 `[CC]` — Modelo + propuesta al aceptar.** `MaintenancePlan {merchantId, customerId,
quoteId?, title, intervalMonths, nextDueAt, active}`. En quote→accepted (o invoice→paid),
línea que matchea categoría mantenible del gremio → toggle "Crear recordatorio de
mantenimiento" con intervalo prefijado EDITABLE (semillas master: clima 12m, caldera 12m,
termo 12m, descalcificador 6m, cuadro 24m…).

**A15.2 `[CC]` — Ciclo del cron (¡al PRO, jamás al cliente!).** Cron diario 10h → vencidos
→ quote draft (origin='maintenance') → WA AL PRO: "🔧 Toca revisión de [X] de [Cliente].
¿Enviar presupuesto de [importe]?" [Aprobar y enviar] [Posponer 30d] [Cancelar plan].
Anti-spam de la spec LITERAL: 1 propuesta/cliente/90d · waOptOut · horas tranquilas ·
2 rechazos seguidos → plan se pausa solo.

**A15.3 `[CC]` — Métrica.** € con origin='maintenance'/mes en Informes.

✅ **Gate:** plan vencido forzado en demo → propuesta al pro → Aprobar → cliente recibe
presupuesto. Ingresos que se generan solos.

## OLA 16 — ANALYTICS-1 (X2) + presupuestos que caducan (N3)

**A16.1 `[CC]` — Informes premium (spec X2, ni una métrica más).** Tasa de aceptación ·
tiempo medio hasta decisión · cobros por método (paid_via) · € generados por recordatorios
(pago ≤72h tras recordatorio) · € por mantenimiento · top servicios · "facturas antiguas
pendientes" por antigüedad (PROHIBIDO "morosos" en UI). Sin cohortes/BI.

**A16.2 `[CC]` — validUntil + expired.** Campo validUntil (default 30d editable) + cron
sent→expired + landing N3 con copy OFICIAL: "Este presupuesto caducó el [fecha]. Pide uno
actualizado 👇" + botón WA.

✅ **Gate:** Informes cuentan la historia del dinero en 10 segundos; el caducado reconvierte.

## OLA 17 — ONBOARD-2 · Catálogos por gremio (MAQUINARIA; contenido con gate)

**A17.1 `[CC]` — Estructura + carga.** `data/catalogs/{gremio}.json` con schema del master
{nombre, unidad, precioOrientativo:{min,max}, categoria, mantenible?:intervalo}. Selector
de gremio en onboarding → import con margen default → todo editable. Etiqueta visible
"precio orientativo".

**A17.2 `[CC]` — Contenido BORRADOR marcado.** 25-40 ítems/gremio en DRAFT
("status":"draft_pendiente_validacion") + plantillas frecuentes (3-5/gremio: "Cambio de
termo", "Punto de luz", "Pintura piso 80m²"). ⚠️ Regla de contenido del master: los
precios se validan con 2-3 profesionales reales ANTES del seed a merchants reales →
entrada en PENDIENTES_FUNDADOR con checklist (encaja con las 10 discovery).

✅ **Gate:** merchant nuevo elige "Fontanería" → catálogo utilizable en 30s. White-glove
de founding: de 30 min a 5.

## OLA 18 — DASH-PREMIUM-1 · Pulido pantalla a pantalla (AB4; NO rediseño, AB6)

**A18.1-A18.8 `[CC]` — Un commit por pantalla, en este orden:** Lista de presupuestos
(pills + importes Tinta ≥700, cards móvil, filtrable) → Facturas/cobros (pendiente
PRIMERO, antigüedad visible) → Clientes (ficha simple deuda/pagos/presupuestos; cero CRM)
→ Catálogo (buscar, crear rápido, importar; no-ERP) → Configuración (checklist readiness
Parte M con estados claros) → Onboarding (3 pasos visuales) → Trabajos (Ola 13) →
Mantenimientos (Ola 15). Checklist AB6 por pantalla: capturas antes/después, 9.999,99 €,
sin logo, textos largos, empty states, targets ≥44px.

✅ **Gate:** cualquier pantalla de la demo aguanta zoom sin vergüenza.

## OLA 19 (CONDICIONAL: R2 del fundador) — MEDIA-1 parcial · fotos

**A19.1 `[FUNDADOR]`** — Bucket R2 + credenciales → env Railway. Sin esto NO empieza.
**A19.2 `[CC]`** — `src/core/storage/r2.ts` con URLs firmadas (D2).
**A19.3 `[CC]`** — Foto de avería en QuoteRequest (portal; bot cuando MEDIA-1 completo) +
antes/después ancladas a Job. `Attachment {entityType, entityId, url, kind, createdAt}`.
Privacidad de la spec: solo avería/trabajo (no personas); retención 12 meses salvo Job
activo. Audio→STT queda FUERA (proveedor [VALIDAR] en master).

✅ **Gate:** presupuesto con foto + Job con antes/después = paquete anti-disputa y
pro-reseña.

---

# BLOQUE C — FLECOS, MONEY-FLOWS Y UI TOTAL (del repaso completo al master)

## OLA 20 — Flecos huérfanos (del SPRINT_PRE_VENTA que no entraron en Olas 1-9)

**A20.1 `[CC]` — GBB / 3 opciones (PV-FIX-4).** El presupuesto con 3 opciones
(Bueno/Mejor/Premium) no funciona bien / no se entiende. Arreglar flujo + UI clara en
creación Y en landing del cliente (tiers según N1). Verificar E2E con firma de un tier.

**A20.2 `[CC]` — "Markup" → "Margen" + tooltip (PV-FIX-1).** Renombrar en toda la UI +
icono (i) con explicación de una frase al pasar el ratón/tocar.

**A20.3 `[CC]` — Renombrar rol "Técnico" (PV-FIX-RolTecnico).** PROPONER 2-3 nombres al
fundador (p. ej. "Empleado", "Operario") — es copy oficial (regla 30). Implementar el
elegido en UI (el valor interno del enum NO se migra: solo etiquetas).

**A20.4 `[CC]` — Cliente empresa + datos en presupuesto (PV-FIX-2 + PV-FIX-CAMPOS).**
Campos de empresa en cliente (razón social, NIF) — el NIF además es requisito VeriFactu
futuro (hallazgo S1-C). Y en creación de presupuesto: elegir qué datos del cliente se
muestran en el documento (nombre, teléfono, NIF, email).

**A20.5 `[CC]` — Fallback WhatsApp completo (J5).** En TODO fallo de envío (UI y cron):
acciones SIEMPRE ofrecidas — Copiar enlace · Enviar por email · Reintentar. 131026 →
"copia el enlace y mándaselo por SMS o llámale". Cron que falla registra y aparece en BO.
Nunca fallo silencioso.

✅ **Gate:** cero flecos conocidos del pre-venta; envío de WhatsApp sin callejones.

## OLA 21 — Money-flows blindados (Parte V + Runbooks O)

**A21.1 `[CC]` — R14: paquete de evidencia de disputa en 1 clic.** Webhook
`charge.dispute.created` (Connect) → aviso WA/BO al merchant + botón que genera el paquete:
presupuesto firmado + evidencia de aceptación (ts/IP/UA) + justificante + registro de
mensajes de entrega. *La firma digital gana disputas → argumento de venta.*

**A21.2 `[CC]` — Pago parcial y sobrepago, UX honesta (V4/V5).** F1 = NADA automático:
si llega importe distinto, el charge sigue pending + aviso al pro con nota y decisión
manual (runbook). Sobrepago: nota + devolución manual de la diferencia. Jamás des-pagar
(entidad Refund = F2, no construir).

**A21.3 `[CC]` — "Deshacer pago" seguro (R5).** Verificar que el deshacer de Bizum
confirmado por error existe, es admin-only, queda auditado (evento de A11.1) y solo
opera pre-SIF (justificante). Doble confirmación no duplica.

✅ **Gate:** una disputa simulada produce el paquete completo; un pago raro no rompe
nada ni miente.

## OLA 22 — UI premium: pantallas públicas restantes + BO transversal

**A22.1 `[CC]` — Portal del cliente.** La pantalla del historial del cliente final al
nivel de /pay: design system, móvil-first, estados vacíos dignos.

**A22.2 `[CC]` — /precios + páginas legales + login.** /precios al nivel de la landing
nueva; páginas legales (alcance-beta, privacidad cuando llegue del asesor) con plantilla
de documento legible y branded; pantalla de login/magic-link ("revisa tu correo") pulida.

**A22.3 `[CC]` — Búsqueda global en el BO.** Buscador (clientes + presupuestos + cobros)
en la barra del BO — entra en AB4 ("filtrable", "buscar" del catálogo, ficha simple).
Resultados agrupados, teclado ↑↓ Enter, móvil OK.

**A22.4 `[CC]` — Micro-detalles transversales.** Title tags por vista · favicon/estados
de pestaña · transiciones de vista sobrias (≤200ms, prefers-reduced-motion) · números
tabulares en TODO importe que falte · fechas humanas consistentes ("hace 2 días").

✅ **Gate:** no queda NINGUNA pantalla, pública o privada, fuera del design system.

## OLA 23 — Opcionales (solo con OK explícito del fundador)

**OPT-1 · Banner A2HS de PWA (Y1):** "Añade YaQu a tu pantalla de inicio" UNA vez tras
el primer presupuesto enviado. Master lo marca build-trivial F2-early: decisión fundador.
**OPT-2 · Gate foral (regla 33, preparación):** provincia del domicilio fiscal + flag
foral (PV/Navarra) con aviso digno TicketBAI. Inocuo hoy (facturación OFF), listo para
el switch post-SIF.

---

## 📋 PROPUESTAS DE MERCADO → docs/DECISIONES_PENDIENTES.md (NO construir — regla 13)

Del repaso de mercado (PresupuestAPP, STEL, Jobber): el master ya cubre el 95% de lo que
el ICP necesita. Lo que NO está specd se REGISTRA para la revisión de 25 pagantes,
no se construye. Claude Code: crear/actualizar el archivo con estas entradas literales:
- Descuento por línea y descuento global en presupuesto (lo tienen PresupuestAPP/STEL).
- Fecha/hora de visita prevista en el presupuesto (media entre presupuesto y Job).
- Envío programado de presupuesto ("mandar mañana a las 9:00").
- Notas internas por presupuesto visibles solo para el equipo.
- Adjuntar PDF externo (medición/plano) al presupuesto.
Cada una con: valor estimado, coste estimado, y "revisar a 25 pagantes".

---

## ORDEN DE EJECUCIÓN RECOMENDADO (valor de demo/€ por hora, con cortes limpios)

**Día 1:** A10.0 (gobernanza) → Ola 10 (founding puede pagar) → Ola 13 (Job) →
Ola 20 (flecos, rápida) → Ola 14 (Perfil) → Ola 15 (Mantenimientos).
**Día 2:** Ola 16 (Informes+expired) → Ola 11 (seguridad) → Ola 21 (money-flows) →
Ola 17 (catálogos) → Ola 18 (DASH pantalla a pantalla) → Ola 22 (UI pública) →
**Ola 12 SIEMPRE LA ÚLTIMA** (QA total sobre el estado final).
**Condicionales:** Ola 19 solo con R2; Ola 23 solo con OK.
**Si falta tiempo, se corta en este orden (de menos a más doloroso):** 23 → 19 → 22 →
18 → 17 → 21 → 16. **Intocables: 10, 13, 20, 11, 12.**

## LO QUE SIGUE SIN ENTRAR (ni con esta autorización)
BOT-2/IA (gates K2) · FIN-1 (gate ticket) · PARTNERS-1 (gate Y2) · APP-1 (gate 100) ·
SEO-2 · reconcile-stripe/export-zip (SEC-2, F2) · audio→STT ([VALIDAR]) · Refund entity
(V6, F2) · TicketBAI · API pública · todo Z · rediseños totales.

## PENDIENTES DEL FUNDADOR (camino crítico REAL, sin cambios)
Rotar WHATSAPP_ACCESS_TOKEN · verificación Meta + WABA producción (SIM) · Stripe: precios
LIVE + webhook Connect + pago test real + refund documentado · EMAIL_FROM · credenciales
R2 (Ola 19) y destino de backup (A11.3) · OK/decisiones: nombre del rol (A20.3), opcionales
Ola 23 · asesor (bundle legal + SIF) · V0-5 bug-bash 3 dispositivos · vídeo 60s + calle
(V0-6) · ensayo guion 90s ×3.
