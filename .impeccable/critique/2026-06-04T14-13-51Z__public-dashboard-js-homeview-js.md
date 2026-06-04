---
target: Home del dashboard
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-06-04T14-13-51Z
slug: public-dashboard-js-homeview-js
---
# Critique — Home del dashboard (public/dashboard/js/homeView.js)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Activity feed cargaba con texto "Cargando…" (sin skeleton) |
| 2 | Match System / Real World | 4 | Lenguaje natural en ES, sin jerga |
| 3 | User Control and Freedom | 3 | Nav siempre disponible; sin acciones destructivas |
| 4 | Consistency and Standards | 3 | Métricas mes vs semana con marcos solapados |
| 5 | Error Prevention | 3 | n/a en home (validación vive en quick quote) |
| 6 | Recognition Rather Than Recall | 3 | KPIs visibles, actividad, top listas, tooltips |
| 7 | Flexibility and Efficiency | 2 | Sin atajos de teclado; filas de actividad no accionables por teclado |
| 8 | Aesthetic and Minimalist | 2 | Muro de cards de peso similar, sin foco único; redundancia mes/semana |
| 9 | Error Recovery | 3 | Mensaje de error de métricas presente |
| 10 | Help and Documentation | 3 | Botón "?" + tooltips + setup checklist |
| **Total** | | **29/40** | **Good (28-35)** |

## Anti-Patterns Verdict
- LLM: no parece "hecho por IA" tras el pase premium; riesgo principal = "muro de cards" de igual peso sin foco.
- Detector (detect.mjs sobre index.html): 1 warning "overused-font: Inter". Aceptado conscientemente (legibilidad para usuarios no técnicos a pleno sol).
- Browser overlay: no disponible (sin automación de navegador en esta sesión).

## Overall Impression
El Home funciona y ya respira premium, pero abre sin un punto focal claro: 3 acciones + 4-5 KPIs + resumen semanal + actividad + tops + equipo, todo con peso visual parecido. La mayor oportunidad: dar un ancla cálida arriba y "trocear" con etiquetas.

## What's Working
- Acciones rápidas accionables y claras (≤3) arriba.
- KPIs con skeleton y cifras en tinta tabular.
- Sparkline + tendencias semanales aportan contexto sin saturar.

## Priority Issues
- [P1] Sin foco/ancla ni calidez al abrir. Fix: header de saludo "Buenos días, {nombre} 👋".
- [P1] Filas de actividad click-only (div onclick) → inaccesibles por teclado/lector. Fix: role=button, tabindex, Enter/Espacio, aria-label.
- [P2] Falta chunking: acciones rápidas y KPIs sin etiqueta de sección. Fix: labels "Acciones rápidas" / "Resumen".
- [P2] Estado de carga de actividad en texto plano. Fix: skeleton rows.
- [P3] Inter sobreusada (detector). Aceptado por legibilidad.

## Persona Red Flags
- Sam (a11y): div onclick sin foco ni rol → no alcanzable por teclado/SR. (Corregido.)
- Alex (power user): sin atajos de teclado; pendiente.
- Tomás (fontanero en obra, móvil): quería el número clave de un vistazo; el saludo + etiquetas ayudan a orientar, pero persiste leve redundancia mes/semana.

## Minor Observations
- "Cobrado este mes" (KPI) y "Cobrado esta semana" (resumen) conviven; las etiquetas de plazo desambiguan, pero vigilar.

## Questions to Consider
- ¿Debería el Home tener un único número héroe (pendiente de cobro) por encima del resto?
