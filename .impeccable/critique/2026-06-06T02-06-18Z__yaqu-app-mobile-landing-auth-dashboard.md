---
target: yaqu.app mobile (landing+auth+dashboard)
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-06-06T02-06-18Z
slug: yaqu-app-mobile-landing-auth-dashboard
---
# Critique (re-run) — yaqu.app móvil (390px): landing, login, registro, dashboard

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Coach-mark ahora apunta al elemento; faltan skeletons de carga (no verificable). |
| 2 | Match System / Real World | 4 | Español de oficio, cero jerga. |
| 3 | User Control and Freedom | 3 | Coach-mark con Escape + clic-fuera + "Entendido"; verificar Esc en modales. |
| 4 | Consistency and Standards | 3 | **+1.** Etiqueta CTA unificada, radios/sombras/marca con fuente única (tokens.css), badges con un solo color. Queda el ramp `--slate-*` interno. |
| 5 | Error Prevention | 3 | Formularios mínimos, dropdown país, type=email. |
| 6 | Recognition Rather Than Recall | 3 | Sidebar icono+texto, búsqueda con "/". |
| 7 | Flexibility and Efficiency | 3 | Atajo "/", quick-quote. |
| 8 | Aesthetic and Minimalist Design | 4 | **+1.** Fin del número rojo y del overlay que tapaba el CTA; dinero en tinta, jerarquía clara, un solo verde dominante. |
| 9 | Error Recovery | 2 | No verificable desde estático; confirmar errores inline en formularios. |
| 10 | Help and Documentation | 4 | **+1.** Coach-mark con spotlight que apunta y no bloquea, FAB de guía y checklist de configuración. |
| **Total** | | **32/40** | **Bueno (banda media) — resueltos todos los P0/P1** |

## Anti-Patterns Verdict

**LLM assessment:** No huele a IA. La deriva marketing↔producto que penalizaba la corrida anterior está cerrada: las tres superficies comparten color de marca, radios y sombras desde `tokens.css`. El Home ya obedece las reglas del propio sistema (Regla del Importe, Una Sola Voz).

**Deterministic scan (detect.mjs):** sin cambios — 8 hallazgos `overused-font`/`single-font` (Inter), falsos positivos by-design (familia única comprometida en DESIGN.md, permitido en register `product`).

**Visual overlays:** sin overlay en navegador (MCP Playwright caído); evidencia por capturas a 390px del estado de código actual + lectura de fuente.

## Overall Impression

Subida limpia de **29 → 32**. Lo que frenaba antes no era el gusto sino la disciplina, y eso es justo lo que se corrigió: el dinero vuelve a tinta, hay una sola voz verde, una sola etiqueta de conversión, un solo color de conteo, y `tokens.css` es la única fuente de marca/radios/sombras. El producto se siente más "de banco" y más cohesionado. Lo que queda es polish menor y un par de techos no verificables desde estático (estados de carga, errores inline).

## What's Working

- **El Home ahora respeta su propio sistema:** importes en tinta con el estado en un chip, una única acción verde dominante, KPIs legibles. Es la mejora más visible.
- **Coherencia entre superficies:** landing, auth y dashboard comparten tokens; las cards redondean igual (16px) en marketing y producto.
- **Coach-mark de primer uso bien resuelto:** ilumina el CTA real, apunta con flecha, no lo tapa, se cierra con Escape o clic fuera.

## Priority Issues

- **[P2] Espacio muerto bajo la card de auth en móvil alto.** En 390×844 queda un vacío grande bajo `login.html`/`register.html`. **Por qué importa:** desaprovecha el fold y deja la pantalla "a medias". **Fix:** anclar la card más arriba (o centrar con un máximo) y, si cabe, reforzar confianza bajo ella (sello "sin tarjeta", logos de pago). **Comando:** `$impeccable layout`

- **[P3] El primer campo del registro con borde verde permanente (autofocus) puede leerse como validación.** Junto a los demás campos en gris, parece "correcto/incorrecto". **Fix:** usar solo el anillo de foco estándar, no un borde verde de relleno. **Comando:** `$impeccable polish`

- **[P3] Naming interno `--slate-*` en el dashboard.** Capa primitiva propia (valores correctos, neutros cálidos), pero el nombre `slate` choca con el vocabulario del sistema. No es deriva visual. **Fix:** renombrar a la nomenclatura neutra del sistema cuando toque un refactor amplio (alta churn, bajo valor ahora). **Comando:** `$impeccable extract`

## Persona Red Flags

**Casey (móvil/sol):** mejora clara — labels KPI legibles a AA, el primer CTA del Home ya no queda tapado por el coach-mark, los gastos en tinta no disparan falsa alarma.

**Jordan (primera vez):** una sola etiqueta "Empezar gratis" elimina la duda "¿es lo mismo?"; el beneficio positivo ya no lleva borde rojo confuso. El coach-mark le señala exactamente dónde empezar.

**Sam (a11y):** contraste de labels/meta ahora ≥4.5:1; badges con texto blanco sobre info = 5:1. Pendiente: verificar foco/errores inline en formularios con lector de pantalla.

## Minor Observations

- Estados de carga: confirmar que las vistas usan skeletons y no spinners (techo de la heurística 1).
- Errores inline de formularios no verificables desde estático (techo de la heurística 9).
- El item activo "Inicio" sigue siendo el único verde del sidebar: correcto.

## Questions to Consider

- ¿Merece un pase de `harden` para cubrir estados de carga (skeletons) y mensajes de error inline, los dos techos que quedan?
- ¿La card de auth debería llevar refuerzo de confianza debajo (sin tarjeta / métodos de pago) para llenar el fold y subir conversión?
