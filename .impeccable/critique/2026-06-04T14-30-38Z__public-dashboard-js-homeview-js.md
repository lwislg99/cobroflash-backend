---
target: Home del dashboard
total_score: 31
p0_count: 0
p1_count: 0
timestamp: 2026-06-04T14-30-38Z
slug: public-dashboard-js-homeview-js
---
# Critique — Home del dashboard (2ª pasada, tras iteración)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons en KPI y actividad |
| 2 | Match System / Real World | 4 | Lenguaje natural |
| 3 | User Control and Freedom | 3 | Nav siempre disponible |
| 4 | Consistency and Standards | 3 | Eliminado el duplicado de "pendiente de cobro" (ahora héroe único) |
| 5 | Error Prevention | 3 | n/a en home |
| 6 | Recognition Rather Than Recall | 3 | KPIs, actividad, tops, tooltips |
| 7 | Flexibility and Efficiency | 3 | Atajo "N" + filas de actividad accesibles por teclado |
| 8 | Aesthetic and Minimalist | 3 | Número héroe + etiquetas dan foco y jerarquía clara |
| 9 | Error Recovery | 3 | Mensaje de error de métricas |
| 10 | Help and Documentation | 3 | Botón "?" + tooltips + checklist + pista de atajo |
| **Total** | | **31/40** | **Good** |

## Cambios desde la pasada anterior (29 → 31)
- Número héroe "Pendiente de cobro" como foco principal (resuelve #8 y la redundancia mes/semana de #4).
- Atajo de teclado "N" → nueva cotización (#7).
- (Pasada previa) saludo, etiquetas de sección, actividad accesible por teclado, skeleton.

## Pendiente (futuras pasadas)
- Navegación completa por teclado / más atajos (persona Alex).
- Posible densidad: muchas secciones aún apiladas; valorar plegar tops/equipo.
