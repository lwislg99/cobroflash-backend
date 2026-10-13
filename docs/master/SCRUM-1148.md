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

---

## Parte 3 · Lista de presupuestos: «⬇ CSV» y los botones de cada fila (defecto de paso)

**Medido contra:** `origin/main` = `5f1bb361ae5b6b0d720b28b54c624f5d8483ff3b` · 2026-10-07T15:12:16Z
A9: comprobación → `tests/scrum1148-tactil-lista-presupuestos.test.mjs`
A9: comprobación → `scripts/guard-lista-trabajos.mjs`
(Dos fallos propios. Uno: la primera versión del test contaba llaves sobre la hoja ENTERA y dio un rojo
falso —«la regla de escritorio está dentro de otro bloque»— porque los comentarios de `styles.css`
citan reglas con sus llaves; era el instrumento, no el producto, y ahora el test quita los comentarios
antes de leer. Dos: la primera versión del arreglo (`3b17f051`) ponía dos clases nuevas en el marcado
de la lista, y `guard:lista-trabajos` salió ROJO —«Presupuestos HA CAMBIADO»— al correrlo antes de
empujar. Se arregló el código, no el guard: el alto va sólo en la hoja y `quotesListView.js` vuelve a
ser el de `main`. El traspaso de la sesión anterior ya decía «dar CLASE al contenedor»: era una
instrucción que nadie había ejecutado contra ese guard.)
**Rama:** `scrum-1148-tactil-lista-presupuestos` · commits `3b17f0517d42a20b53c44148c6099acbebe88ba4`
(primera versión, con clases) y `ec5ecc8646f7f0cc51adff5065f5cac9bdfd7966` (la que vale: sólo la hoja).
**Sesión:** S2 (`s2-7octt`). **Skill UI:** cargada (`yaqu-premium-ui`). Sección AÑADIDA: las partes 1 y 2 no se tocan.

No estaba en la lista del ticket: salió al medir en yaqu.app las pantallas de las partes 1 y 2 (7-oct,
c.18653). Es un defecto encontrado de paso y va aquí, sin ticket nuevo (A13).

### Antes y después — área de toque real en yaqu.app (cuenta QA, Chromium sin cabeza, sólo GET)

Sonda `sondas-s2/tactil-lista.mjs` (fuera del repo; usa `scripts/_medidor-de-toque.mjs`). «Antes» es lo
que sirve producción (build `5f1bb361`); «después» es el `styles.css` de esta rama servido por la sonda
encima de producción, con testigo de que lo servido es lo que se ejecuta (y de que el JS no cambia).
Población: 9 pulsables por ancho (2 pestañas, «⬇ CSV», «Nuevo presupuesto», 5 «Ver detalle»), 36 en total.

| Ancho (mínimo) | «⬇ CSV» antes → después | «Ver detalle» ×5 antes → después | cortos antes → después |
|---|---|---|---|
| 390 (44) | 31 → 45 px | 44,5-44,9 → igual (ya los cubría `.table--cards-mobile`) | 1 → 0 |
| 700 (44) | 31 → 45 px | 30,7-30,8 → 44,7-44,8 px | 6 → 0 |
| 929 (36) | 31 → 37 px | 30,6-30,9 → 36,6-36,9 px | 6 → 0 |
| 1280 (36) | 31 → 37 px | 30,6-30,8 → 36,6-36,8 px | 6 → 0 |

**19 cortos de 36 antes; 0 de 36 después.** La fila de 700 no se conocía: la regla de móvil de la tabla
corta en 640 y el mínimo táctil se exige hasta 768, así que entre los dos «Ver detalle» medía 30,7.
«⬇ CSV» queda a la misma altura que «Nuevo presupuesto», su vecino (45 en móvil, 37 en escritorio).

### Qué se construyó

- `styles.css`, y NADA MÁS de producto: `.data-card:has(#quotes-count) .data-card-header > div > .btn-sm`
  y `.data-card:has(#quotes-count) td.cell-actions > div > .btn-sm` a `min-height: 36px`, y a `44px`
  dentro de `@media (max-width: 768px)`. Sólo tamaño; `.btn-sm` global no se toca. Los mínimos son los
  de DESIGN.md (44 en móvil, 36 en escritorio a propósito).
- **`quotesListView.js` NO cambia** (`git diff origin/main` vacío para ese fichero). El ancla es
  `#quotes-count`, que la lista ya lleva y que `tests/scrum432-plantillas-pestana.test.mjs` vigila. Es
  el mismo mecanismo `:has()` que usó SCRUM-986 para el chip de WhatsApp, por el mismo guard.
- `tests/scrum1148-tactil-lista-presupuestos.test.mjs` (3 casos). **Es un proxy y se dice:** node no
  pinta, así que no mide píxeles; ata que cada `.btn-sm` de esos dos sitios esté donde el selector lo
  busca (hijo de un `div`, nieto de la cabecera o de `td.cell-actions`, dentro de la tarjeta que lleva
  el ancla) y que la hoja les dé el mínimo a cada lado del corte. El corte y los mínimos los lee de
  `scripts/_medidor-de-toque.mjs`. Control positivo, cuatro mutaciones y cae 1 de 3 en cada una:
  `styles.css` de `origin/main` · el corte de la hoja a 640 · «⬇ CSV» colgado directo de la cabecera ·
  el ancla renombrada. Con la rama: 3 de 3.

### Desviación DECLARADA

La opción ③ del 21-sep es «regla por contenedor con su clase» (así van las partes 1 y 2). Aquí la regla
va por un ancla que ya existía, sin clase nueva, porque una clase nueva cambia el HTML de la lista y
`guard:lista-trabajos` lo exige idéntico al de la base. **Consecuencia que conviene saber:** ese guard
compara el HTML, así que un cambio de aspecto hecho sólo en la hoja no lo ve; lo que vigila este cambio
es el test de arriba y la medida en navegador. Vecinas medidas con la hoja de la rama a 390 y 929
(`tactil-prod.mjs`): editor, Plantillas y Cobros, 0 cortos y las mismas cifras que en producción.

### Lo que NO se ha hecho, dicho

- **«✓ Aprobar»** (la fila pendiente de aprobar) está cubierto por la misma regla y por el test en el
  banco, pero **no se ha medido en navegador**: la cuenta QA no tiene ningún presupuesto en ese estado.
- **La lista de presupuestos sigue sin ser una superficie de `guard-objetivo-tactil.mjs`**: no había
  excepción que retirar y no se ha añadido la pantalla al guard (sería otro cambio, en otro carril).
- No medido: otro navegador, un móvil real, la lista con más de cinco filas.
- Pendiente tras el despliegue: `node sondas-s2/tactil-lista.mjs` sin argumento → 0 cortos.
