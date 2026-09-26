# SCRUM-1148 · 44 px por contenedor en el editor de presupuesto (grupo B de SCRUM-786, parte 1)

**Medido contra:** `origin/main` = `c3031d89ac3ecf7c9b54d11bf6e5bca2fd99f1b8` · 2026-09-26T12:35:00Z
**Rama:** `scrum-1148-tactil-presupuesto`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`).

Una pantalla por PR: esto es SOLO el editor de presupuesto. Plantillas y pestañas van en PR aparte.
Los botones de forma de cobro (Bizum / tarjeta / transferencia) **no se tocan**: STOP de cobro,
se consultan con el orquestador al llegar.

## Antes y después — `node scripts/guard-objetivo-tactil.mjs` (Edge, área de toque real)

| Objetivo | Antes (929 / 390) | Después |
|---|---|---|
| «✨ Sugerir con IA» `BUTTON.btn-ghost.btn-sm` | 30,7 / 30,5 px, excusado | cumple en los dos |
| «📋 Usar plantilla» `BUTTON.btn-ghost.btn-sm.quote-header-btn` | 30,7 / 30,5 px, excusado | cumple en los dos |
| «+ Añadir descuento» `BUTTON.btn-ghost.btn-sm` | 30 / 29,6 px, excusado | cumple a 929; 43,6 a 390 **en el banco** (ver abajo) |

## Qué se construyó

`styles.css`: `.quote-lines-header > .btn-sm, .quote-dto-global > .btn-sm { min-height: 44px; }`.
Regla acotada a su contenedor (opción ③ del 21-sep); `.btn-sm` global no se toca; sin JS.

`guard-objetivo-tactil.mjs` (lo pide la aceptación: la excepción se RETIRA):
- Retirada la excepción `…quote-header-btn` («Usar plantilla»): la nombró el detector de sobrantes.
- `distintosEsperados` del editor 4 → 2, nombrando los dos que salen (mismo procedimiento que SCRUM-711).
- La excepción `BUTTON.btn-ghost.btn-sm` queda SOLO para «+ Añadir descuento», con motivo nuevo.

## «+ Añadir descuento» a 43,6 px: es el banco, no el producto — medido

Caja 44 px (427,55→471,55). `elementsFromPoint` en el borde inferior devuelve el `<span>`
«Descuento global» del campo del descuento. En el producto ese campo nace con `hidden = true`
y nunca convive con el botón (el clic los intercambia); `[hidden]` es `display:none !important`
(SCRUM-731). Pero el mini-DOM del banco no refleja la PROPIEDAD `hidden` como atributo, y la
página serializada pinta los dos a la vez. No se tapa con CSS: se declara y queda anotado.
Pendiente de medir en `yaqu.app` a 390 px tras el despliegue.
