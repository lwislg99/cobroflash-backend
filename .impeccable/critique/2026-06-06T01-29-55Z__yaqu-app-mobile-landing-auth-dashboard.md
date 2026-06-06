---
target: yaqu.app mobile (landing+auth+dashboard)
total_score: 29
p0_count: 0
p1_count: 3
timestamp: 2026-06-06T01-29-55Z
slug: yaqu-app-mobile-landing-auth-dashboard
---
# Critique — yaqu.app móvil (390px): landing, login, registro, dashboard

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | KPIs, badges y coach-mark dan estado; falta verificar skeletons de carga (spinners vs skeleton). |
| 2 | Match System / Real World | 4 | Español claro, voz de oficio ("presupuesto", "Cobra antes de empezar"), cero jerga. |
| 3 | User Control and Freedom | 3 | Auth con ida/vuelta clara; coach-mark con "Entendido". Falta confirmar Esc/cancelar en modales. |
| 4 | Consistency and Standards | 2 | Mismo destino /register con 3 etiquetas distintas; escala de radios del dashboard (14/10) ≠ tokens (16/12); colores KPI hardcodeados. |
| 5 | Error Prevention | 3 | Formularios mínimos, dropdown de país, type=email; sin verificar validación inline. |
| 6 | Recognition Rather Than Recall | 3 | Sidebar con icono+texto, búsqueda global, autocompletar. |
| 7 | Flexibility and Efficiency | 3 | Búsqueda con atajo "/", quick-quote; pocos atajos más. |
| 8 | Aesthetic and Minimalist Design | 3 | Landing/auth limpios; el Home compite (varios verdes + número rojo + overlay sobre el CTA). |
| 9 | Error Recovery | 2 | No verificable desde estático; confirmar mensajes de error inline en formularios. |
| 10 | Help and Documentation | 3 | Coach-mark de onboarding + FAB "?" + checklist de configuración. |
| **Total** | | **29/40** | **Bueno (banda baja) — base sólida, cerrar deriva y regla del importe** |

## Anti-Patterns Verdict

**LLM assessment:** No huele a "hecho por IA". Landing y auth tienen voz propia, verde contenido, tipografía con jerarquía. El riesgo no es la planitud sino la **deriva artesanal entre superficies** (marketing vs producto) y la **violación de las propias reglas del design system** en el Home.

**Deterministic scan (detect.mjs):** 8 hallazgos, todos `overused-font` / `single-font` (Inter en las 4 páginas). **Falsos positivos para este proyecto:** el DESIGN.md compromete Inter como familia única y el register `product` lo permite explícitamente ("One family is often right"). No accionar.

**Visual overlays:** No se inyectó overlay en navegador (MCP Playwright `Failed to connect`; capturas tomadas vía Playwright directo desde la caché de npx). Sin overlay [Human] disponible — fallback: revisión sobre capturas a 390px + lectura de fuente.

## Overall Impression

Producto que **inspira confianza** y se entiende a la primera — el objetivo de marca está casi logrado. Lo que lo frena no es el gusto sino la **disciplina**: el dashboard rompe dos reglas que el propio DESIGN.md declara sagradas (Regla del Importe y Una Sola Voz) y mantiene su propia escala de radios/neutros, así que la unificación marketing↔producto sigue a medias. La mayor oportunidad: hacer que el Home obedezca el sistema que ya existe.

## What's Working

- **Auth (login/registro):** ejemplar. Un solo botón verde en píldora, card 16px, badge de prueba en verde, foco visible, copy humano. Es la superficie más limpia.
- **Voz y jerarquía del importe en la KPI principal:** "PENDIENTE DE COBRO €2350,00" en tinta, grande, tabular — exactamente la "cifra de cobro" que pide el norte de diseño.
- **Sidebar móvil:** off-canvas oscuro con overlay, item activo con acento verde, badges de conteo alineados a la derecha. Patrón estándar bien ejecutado.

## Priority Issues

- **[P1] El dinero se pinta fuera de Tinta en los KPIs del Home.** "Gastos este mes" va en rojo `#dc2626` (hardcodeado) y "Beneficio neto" en verde/rojo + borde de 2px de color. **Por qué importa:** viola la *Regla del Importe* (todo importe en Tinta #0f1c17, ≥700) y la *Regla de Una Sola Voz* (el verde debe ser solo la acción, ≤10%); el rojo en gastos sugiere error/alarma cuando un gasto es normal. Además son hex sueltos, no tokens. **Fix:** importes en `var(--ink)`; el signo/estado a un chip o flecha pequeña al lado, no en el número; cambiar el borde de color por el borde neutro estándar. Usar tokens, no `#dc2626`/`#22c55e` inline. **Comando:** `$impeccable colorize`

- **[P1] Texto de bajo contraste: `--slate-400 (#949b92)` ≈ 2.8:1 sobre blanco.** Se usa en `.kpi-label` (las etiquetas MAYÚSCULAS sobre cada número), `.kpi-sub` y `.activity-meta`. **Por qué importa:** falla WCAG AA (4.5:1) en texto pequeño, justo lo que el PRODUCT.md exige (AA + legible a pleno sol en obra). Las etiquetas que nombran cada cifra son de las primeras en perderse al sol. **Fix:** subir labels/meta a `--muted (#6b756f)` o más oscuro; reservar slate-400 solo para iconos decorativos. **Comando:** `$impeccable audit`

- **[P1] Una sola acción, tres etiquetas en la landing.** El mismo destino `/register.html` se llama "Probar gratis" (nav), "Empezar gratis" (hero), "Probar gratis" (precios) y "Crear mi cuenta gratis" (CTA final). **Por qué importa:** rompe Consistencia y diluye el mensaje de conversión; el usuario duda si son lo mismo. **Fix:** un único verbo+objeto para registrarse en toda la página (p. ej. "Empezar gratis"), y "Entrar" para login. **Comando:** `$impeccable clarify`

- **[P2] La unificación dashboard↔tokens.css sigue a medias.** El dashboard ya hereda los tokens semánticos de color, pero conserva su **propia escala de radios** (`--radius-lg:14px` / `--radius-md:10px` vs 16/12 del sistema), su ramp `--slate-*` y verdes hardcodeados. **Por qué importa:** las cards del producto redondean 2px menos que las de marketing → deriva sutil pero perceptible entre superficies, justo lo que la última sesión intentó cerrar. **Fix:** alinear radios/sombras del dashboard a tokens.css (o subir los faltantes a tokens.css y consumirlos); renombrar `--slate-*` a la vocabulario neutro del sistema. **Comando:** `$impeccable extract`

- **[P2] El coach-mark de onboarding tapa el CTA que promociona.** El tooltip oscuro "Empieza aquí: crea tu primer presupuesto" se solapa con "Acciones rápidas" y cubre parte del botón verde "Crear nuevo", y apila otro botón verde ("Entendido") sobre el FAB "?". **Por qué importa:** el primer gesto que pedimos queda parcialmente oculto; dos verdes compitiendo en el primer pantallazo. **Fix:** posicionar el tooltip sin solapar el target (resaltar el botón, flecha desde abajo), o secuenciar: primero resalta, al pulsar "Entendido" desaparece. **Comando:** `$impeccable onboard`

## Persona Red Flags

**Casey (móvil distraído, una mano, a pleno sol):** las etiquetas de KPI en slate-400 desaparecen al sol (P1 contraste). El coach-mark tapa el primer CTA (P2). El número de gastos en rojo le hace pensar que algo va mal de un vistazo. Acciones principales del Home arriba, no en zona de pulgar.

**Jordan (primera vez):** en la landing duda si "Probar gratis" y "Empezar gratis" llevan al mismo sitio (P1 etiquetas). En el Home, el borde rojo del "Beneficio neto" positivo confunde (rojo = ¿malo?) cuando es una cifra buena.

**Sam (lector de pantalla / baja visión):** contraste por debajo de AA en labels y metadatos (P1). El estado se comunica por color en los badges del sidebar (rojo/azul/ámbar) sin etiqueta de severidad — significado solo por color.

## Minor Observations

- **Badges del sidebar con semántica de color ad hoc:** Solicitudes en rojo (parece error, son solicitudes), Presupuestos en azul, Facturas en ámbar. Unificar el criterio (¿conteo neutro vs urgencia real?).
- **Auth en móvil alto:** queda mucho espacio muerto bajo la card en 390×844; la card está algo baja respecto al "anclada arriba" buscado.
- **Saludo "Buenas noches" por hora:** correcto, solo verificar zonas horarias del merchant.
- **Registro:** el primer campo con borde verde permanente (autofocus) junto a los demás en gris puede leerse como validación; es solo foco.

## Questions to Consider

- ¿Y si en el Home ningún importe llevara color y el estado (gasto/beneficio, sube/baja) viviera solo en un chip o flecha pequeña? ¿Se leería más como "app de banco"?
- ¿Merece la pena que tokens.css sea la única fuente de radios y sombras, y que el dashboard no defina ninguno propio?
- ¿Una sola etiqueta de registro en toda la landing subiría la conversión al eliminar la duda "¿es lo mismo?"?
