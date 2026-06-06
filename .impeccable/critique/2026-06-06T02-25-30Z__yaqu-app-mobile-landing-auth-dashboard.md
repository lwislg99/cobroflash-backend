---
target: yaqu.app mobile (landing+auth+dashboard)
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-06-06T02-25-30Z
slug: yaqu-app-mobile-landing-auth-dashboard
---
# Critique (final) — yaqu.app móvil (390px): landing, login, registro, dashboard

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | **+1.** Skeletons cálidos al cargar el Home + estado de error con reintento; listas con "Cargando…". |
| 2 | Match System / Real World | 4 | Español de oficio, cero jerga. |
| 3 | User Control and Freedom | 3 | Cancelar/cerrar en modales y coach-mark (Escape); falta Escape en el modal de presupuesto. |
| 4 | Consistency and Standards | 3 | Tokens únicos (color/radio/sombra), CTA y badges unificados; queda naming `--slate-*` y algún hex suelto. |
| 5 | Error Prevention | 3 | Validación inline + dropdown país + type=email. |
| 6 | Recognition Rather Than Recall | 3 | Sidebar icono+texto, búsqueda "/", cabeceras de columna en el modal. |
| 7 | Flexibility and Efficiency | 3 | Atajo "/", quick-quote, tecla N. |
| 8 | Aesthetic and Minimalist Design | 4 | Dinero en tinta, una voz verde, fold de auth ya sin hueco muerto. |
| 9 | Error Recovery | 4 | **+2.** Errores de campo inline (marca+enfoca+conserva datos) y estado de error con reintento. |
| 10 | Help and Documentation | 4 | Coach-mark con spotlight, FAB de guía, checklist. |
| **Total** | | **35/40** | **Bueno (banda alta) — 0 P0 / 0 P1** |

## Anti-Patterns Verdict

**LLM assessment:** No huele a IA. El producto obedece su propio sistema y las superficies comparten tokens. El Home se lee "de banco": importes en tinta, una acción verde, jerarquía clara. Los estados (carga, vacío, error) ya están cubiertos, que era el principal techo.

**Deterministic scan:** 8 hallazgos `overused-font`/`single-font` (Inter), falsos positivos by-design (familia única en DESIGN.md, permitido en register `product`).

**Visual overlays:** sin overlay en navegador (MCP Playwright caído). Evidencia por render-tests a 390px del código actual a lo largo de la sesión (auth centrada, modal con cabeceras, estado de error con reintento, error inline de campo).

## Overall Impression

Subida sostenida **29 → 32 → 35**. Esta tanda cerró los dos techos que quedaban (estados de carga y recuperación de errores) y remató el polish (modal, auth). Lo que queda es menor y en su mayoría no-visual (naming interno) o techos que piden trabajo transversal en todas las vistas (skeletons en listas, Escape universal en modales).

## What's Working

- **Estados completos:** carga (skeletons cálidos), vacío (legible), error (mensaje + reintento sin perder contexto). Es lo que más subió.
- **Recuperación de errores en formularios:** el modal marca y enfoca el campo que falla y conserva lo escrito.
- **Coherencia total de tokens:** marca, radios y sombras desde `tokens.css`; auth, landing y dashboard alineados.

## Priority Issues

- **[P2] Los skeletons solo viven en el Home.** Las listas (facturas, clientes, gastos…) muestran "Cargando…" en texto, no skeletons. **Por qué importa:** inconsistencia de feedback de carga entre superficies. **Fix:** extraer un helper de skeleton de filas y usarlo en el patrón de lista compartido. **Comando:** `$impeccable harden`

- **[P3] Escape no cierra el modal de presupuesto.** Cierra con ×, Cancelar y clic fuera, pero no con Escape (el coach-mark sí). **Fix:** añadir listener de Escape al abrir el modal. **Comando:** `$impeccable polish`

- **[P3] Naming interno `--slate-*` y algún hex suelto** (p. ej. `#6b756f` en una etiqueta del Home). Capa primitiva propia; no es deriva visual. **Fix:** renombrar/tokenizar en un refactor amplio. **Comando:** `$impeccable extract`

## Persona Red Flags

**Casey (móvil/sol):** labels y empty-states ahora legibles a AA; si falla la red, ve un "Reintentar" en vez de una pantalla a medias. Sin banderas rojas nuevas.

**Jordan (primera vez):** al enviar un presupuesto incompleto, el campo que falta se marca y enfoca: sabe exactamente qué corregir. El coach-mark le señala dónde empezar.

**Sam (a11y):** contraste de texto ya ≥4.5:1 en KPIs, empty-states y badges. Pendiente: verificar con lector de pantalla que los estados de error/carga se anuncian (aria-live).

## Minor Observations

- Considerar `aria-live` en el estado de error y en los toasts para lectores de pantalla.
- Listas usan texto "Cargando…"; migrar a skeletons cerraría del todo la heurística 1.
- `reportsView` usa "—" en slate-300 como placeholder de "sin valor": aceptable, pero por debajo de AA si se considerara contenido.

## Questions to Consider

- ¿Vale la pena un helper de skeleton para listas, o el "Cargando…" en texto es suficiente para el usuario en obra?
- ¿Añadimos `aria-live` a errores/toasts para cerrar la accesibilidad de los estados dinámicos?
