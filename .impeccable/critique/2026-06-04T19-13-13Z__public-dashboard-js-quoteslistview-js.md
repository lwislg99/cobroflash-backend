---
target: cotizaciones (lista + detalle)
total_score: 20
p0_count: 0
p1_count: 3
timestamp: 2026-06-04T19-13-13Z
slug: public-dashboard-js-quoteslistview-js
---
# Critique — Cotizaciones (lista + detalle)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Carga = alerta de texto, no skeleton; alerta verde de "N presupuestos" persistente en cada carga |
| 2 | Match System / Real World | 3 | Buen español; pero filtran códigos crudos ("Canal: backoffice", FULL_UPFRONT en prompt, "Cobro #12") |
| 3 | User Control and Freedom | 2 | Aceptar/Rechazar vía `prompt()` nativo, sin escape elegante ni resumen; sin deshacer |
| 4 | Consistency and Standards | 2 | Emoji vs SVG, colores fríos hardcodeados vs tokens cálidos, ghost+borde, "€" fijo |
| 5 | Error Prevention | 2 | Aceptar/generar factura sin confirmación con resumen; decisiones irreversibles |
| 6 | Recognition Rather Than Recall | 3 | Tabla visible, pero el detalle entierra el total y muestra códigos |
| 7 | Flexibility and Efficiency | 2 | Sin atajos, sin acciones masivas, fila exige botón; CSV bien |
| 8 | Aesthetic and Minimalist Design | 1 | Detalle = 8 cards anidadas + muros de campos "—"; todo el mismo peso visual |
| 9 | Error Recovery | 1 | `alert()` con mensajes crudos ("error_desconocido") |
| 10 | Help and Documentation | 2 | Algún tooltip; sin ayuda contextual en el detalle |
| **Total** | | **20/40** | **Aceptable (límite bajo) — el detalle arrastra a la lista** |

## Anti-Patterns Verdict

**LLM assessment:** La lista pasa como producto correcto pero genérico. El **detalle no pasa el test de producto**: el patrón de 8 `customers-card` anidadas dentro de otra `customers-card` es exactamente el "nested cards are always wrong" de la skill, y produce un muro sin jerarquía donde el dato más importante (el total) tiene el mismo peso que "Canal: —". El uso de `prompt()`/`alert()` nativos para aceptar/rechazar rompe de golpe la sensación premium fintech que persigue DESIGN.md.

**Deterministic scan:** `detect.mjs` sobre los dos `.js` → `[]` (limpio). El detector analiza markup, no JS que construye DOM, así que no captura los colores fríos inline; verificados manualmente.

**Visual overlays:** No disponibles. Vistas autenticadas del SPA (requieren login `pf_session`); no se inyectó overlay. Señal de fallback: revisión manual del código fuente + tokens de `css/styles.css`.

## Overall Impression
La lista es funcional y casi en sistema; el detalle es donde se cae. La mayor oportunidad: **convertir el detalle de "8 cards apiladas" en una jerarquía de pago de confianza** (cabecera con estado + total prominente, secciones planas separadas por divisores, no cards anidadas) y **sustituir `prompt`/`alert` por UI inline**. En paralelo, alinear los colores fríos hardcodeados (#6b7280, #9ca3af, #374151, #111827, #e5e7eb, #f9fafb…) con los tokens cálidos del sistema.

## What's Working
- **Timeline de estado** (`buildStatusTimeline`): la mejor pieza. Comunica el ciclo Creada→Cobrada de un vistazo, con conectores y estado actual. Solo necesita pasar a tokens (el celeste #0ea5e9 y rojo #ef4444 son fríos/off-brand).
- **Autoguardado de notas internas** con debounce y feedback "✓ Guardado" — buen patrón de status.
- **Empty state accionable** de la lista (CTA a Quick Quote) — en línea con onboarding.

## Priority Issues

- **[P1] Cards anidadas en el detalle (ban absoluto).** 8 `customers-card` dentro de una `customers-card` exterior. **Por qué importa:** elimina la jerarquía, todo pesa igual, sube la carga cognitiva (Visual Noise Floor); es el tell #1 de "hecho por IA" según la propia skill. **Fix:** una sola superficie; secciones internas separadas por título + divisor de 1px (`--border`), no por card. Cabecera de estado y total destacados arriba. *Comando:* `$impeccable layout`.

- **[P1] El importe no respeta la "Regla del Importe".** En la lista `formatMoney` pinta "1234.00 EUR" como texto de cuerpo; en el detalle el total es el 3er `<p>` idéntico a "Base imponible". **Por qué importa:** es una app de dinero; el total debe leerse al instante en tinta, peso ≥700, tabular. **Fix:** total en `--ink`, 700, `font-variant-numeric: tabular-nums`, tamaño mayor; base/IVA secundarios. *Comando:* `$impeccable layout`.

- **[P1] `prompt()`/`alert()` para aceptar, rechazar y generar factura.** **Por qué importa:** rompe la estética, no es accesible, no preserva el trabajo y muestra "error_desconocido". Son las acciones de mayor valor de la pantalla. **Fix:** panel inline (o modal del sistema) con resumen de la decisión, campo de motivo validado, y banner de error/éxito en vez de `alert`. *Comando:* `$impeccable harden` / `$impeccable clarify`.

- **[P2] Colores fríos hardcodeados en JS, desalineados con los tokens cálidos.** #6b7280, #9ca3af, #374151, #111827, #f3f4f6, #e5e7eb, #f9fafb, #dcfce7, #166534, #0ea5e9, #ef4444 conviven con `--slate-*` cálidos (#f7f8f6, #6b756f…). **Por qué importa:** rompe la "Regla del Neutro Cálido"; el gris frío "de hospital" justo lo que DESIGN.md prohíbe. **Fix:** reemplazar por `var(--muted)`, `var(--ink)`, `var(--slate-*)`, `var(--brand)`, `var(--border)`, `var(--brand-tint)`. *Comando:* `$impeccable colorize`.

- **[P2] Muros de campos vacíos y toolbar sobrecargada.** Detalle: bloque "Decisión" = 6 `<p>` casi todos "—". Lista: header con 5 controles (búsqueda + estado + 2 fechas + CSV + crear) que se desordenan en móvil; columnas "Método" y "Cobro #id" de bajo valor. **Por qué importa:** ruido y carga; el móvil es el contexto primario (obra, pulgar). **Fix:** ocultar campos vacíos / lista de definición; mover filtros a `.data-card-toolbar`; colapsar columnas de bajo valor en móvil o quitarlas. *Comando:* `$impeccable distill` / `$impeccable adapt`.

- **[P3] Moneda "€" hardcodeada en el detalle.** `price.toFixed(2)+" €"` y totales "EUR" fijos ignoran MXN/COP. **Por qué importa:** YaQu es LATAM-first; un merchant mexicano ve € en sus conceptos. **Fix:** usar la moneda de la quote / `window.appLocale.currency` como ya hace `fmtAmt`. *Comando:* `$impeccable harden`.

## Persona Red Flags

**Alex (Power User):** Sin atajos de teclado; sin acciones masivas en la lista (no puede aprobar/exportar en lote); cada fila exige clic en "Ver detalle"; aceptar implica encadenar 2 `prompt()`. Lento y paternalista.

**Sam (A11y):** `prompt()`/`alert()` rompen el flujo de lector de pantalla y no tienen foco gestionado; significado por color en el timeline sin texto de estado; varios grises fríos sobre fondos tintados rozan el 4.5:1. La decisión de mayor riesgo (aceptar/rechazar dinero) es la menos accesible.

**Casey (Móvil):** Toolbar de 5 controles se apila en una columna estrecha; tabla de 8 columnas obliga a scroll horizontal; `prompt()` nativo en móvil es incómodo; acciones primarias arriba, no en zona del pulgar.

## Minor Observations
- Botón "Duplicar" es `btn-ghost` con `border` inline → contradice el vocabulario (ghost = sin borde).
- Imagen de firma sobre `#f9fafb` frío; debería ser `--slate-50`.
- Timeline "current" en celeste #0ea5e9 → usar `--info` (#2563eb) o brand.
- La alerta verde "N presupuestos" tras cada carga es status innecesario; mover el conteo al header.
- Iconos emoji (📋📝🧾💰) conviven con el resto de SVG del sistema → decidir un vocabulario.

## Questions to Consider
- ¿Qué necesita ver el profesional en 2 segundos al abrir un presupuesto: el estado y el total, o el desglose? (Eso define la jerarquía del detalle.)
- ¿Aceptar/rechazar desde el back-office es flujo real frecuente, o el 95% pasa por el cliente vía WhatsApp? (Define cuánto invertir en ese panel.)
- ¿Las columnas "Método" y "Cobro" las usa alguien, o son deuda de cuando no había detalle?
