# SCRUM-1148 · 44 px por contenedor en el editor de presupuesto (grupo B de SCRUM-786, parte 1)

**Medido contra:** `origin/main` = `c3031d8929b268ed37a13b7674f81785aa61a9ed` · 2026-09-26T12:35:00Z
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

---

## Parte 2 · Plantillas: «+ Nuevo presupuesto» de la cabecera a 44 px

**Rama:** `scrum-1148-tactil-plantillas` · commit de producto `47ee5676` (s2-26b, 26-sep-2026),
registro y merge de main por S2 el 27-sep-2026. Sección AÑADIDA: la parte 1 de arriba no se toca.
Base de la rama al empujar: `origin/main` = `37bda5dbc6991cc33a54ee7248020be30d2f977f` (ancla
generada con `scripts/equipo/ancla.mjs` a 2026-09-27T15:52:48Z).

Una pantalla por PR: esto es SOLO Plantillas.

| Objetivo | Antes (929 / 390) | Después (929 / 390) |
|---|---|---|
| «+ Nuevo presupuesto» `BUTTON.btn-primary.btn-sm` en la cabecera | 31,0 / 30,6 px | 45,0 / 44,6 px |
| «📋 Usar», «Renombrar», «Borrar» (filas) | ya 44 px | sin tocar |
| Pestañas «Historial · Plantillas» | ya 44 px | sin tocar |

Medido por s2-26b en **Chrome real con el JS del producto** (no en el banco). No lo he vuelto a medir
hoy: la cifra es suya, y el código de producto no ha cambiado desde entonces (el merge de main no toca
`templatesView.js` ni la regla nueva de `styles.css`).

**Qué se construyó:** `styles.css`: `.plantillas-cabecera > .btn-sm { min-height: 44px; }`, y la
cabecera de `templatesView.js` lleva la clase `plantillas-cabecera`. Regla acotada a su contenedor
(opción ③ del 21-sep), solo tamaño; `.btn-sm` global no se toca; sin JS nuevo.

**Guard táctil:** Plantillas no es una superficie de `guard-objetivo-tactil.mjs`, así que no hay
excepción que retirar. (La de `BUTTON.btn-primary.btn-sm` «+ Nuevo presupuesto» que hay en ese
fichero es de la ficha 360, `renderCustomer360View`, que es de J2: no se toca.)

**Sin test automático propio, y lo digo como hueco:** ni el guard táctil ni ningún test mide
Plantillas. La evidencia es la medición en Chrome real de arriba; queda pendiente la de `yaqu.app` a
390 px tras el despliegue. Meter Plantillas como superficie del guard sería otro ticket.
