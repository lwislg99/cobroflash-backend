# SCRUM-1167 · «Borrar proveedor» medía 30 px en escritorio: la clase de 44 px perdía la cascada

**Medido contra:** `origin/main` = `c30b4ed43e27b79d65f8e8aabefd7154058e6245` · 2026-09-27T16:12:37Z
**Rama:** `scrum-1167-borrar-proveedor-44`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`).

## El defecto

«Borrar» proveedor (`providersView.js:388`) lleva `btn btn-danger btn-sm accion-irreversible-btn-44`.
`.btn.btn-sm { min-height: 30px }` pesa (0,2,0) y `.accion-irreversible-btn-44 { min-height: 44px }`
pesa (0,1,0), así que gana la de 30. SCRUM-786 se cerró con un test que comprobaba que el botón
**llevara la clase**, no que midiera 44, y con el guard táctil sin vigilar Proveedores.

## Rojo ANTES del arreglo (en navegador, Edge)

Con Proveedores reincorporada al guard y **sin tocar el CSS** (`node scripts/guard-objetivo-tactil.mjs`,
exit 1):

| Ancho | «Borrar» (área de toque) | Veredicto |
|---|---|---|
| 929 | 30,7 px (caja CSS 30) | ✖ `IRREVERSIBLE 30.7px < 44 … la clase pierde la cascada` |
| 390 | 44,6 px | cumple (en móvil llega por otra regla) |

A 929 salieron además «Editar» y «Desactivar» (`BUTTON.btn.btn-secondary.btn-sm`) a 30,7 px.

## El arreglo (código, sin `!important`)

`styles.css`: la regla pasa a ser
`.btn.btn-sm.accion-irreversible-btn-44, .accion-irreversible-btn-44 { min-height: 44px; }`.
El selector compuesto pesa (0,3,0) y le gana a `.btn.btn-sm`. La regla sola se queda para quien no
lleva `.btn` («Borrar» plantilla, «Emitir» albarán), que ya ganaba por orden. `.btn-sm` global no se toca.

## Verde DESPUÉS

- Guard en navegador (exit 0): «Borrar» **44,7 px a 929** y **44,6 px a 390**.
- `getBoundingClientRect().height` de «Borrar» en Edge: **44 a 390 y 44 a 929**. Capturas:
  `docs/master/evidencias/scrum1167/scrum1167-proveedores-390.png` y `…-929.png`. Son del banco
  serializado con la CSS real en Edge, **no de yaqu.app**, que queda pendiente tras el despliegue.

## Los tres instrumentos, uno a uno

1. **El test ahora mide el efecto** (`tests/scrum1167-irreversible-gana-la-cascada.test.mjs`, 6 tests,
   en la tanda obligatoria). El banco es un mini-DOM **sin motor de maquetación**: no sabe la altura de
   nada. **Ése es el hallazgo, y se dice.** Lo que sí puede hacer sin navegador es resolver la cascada
   de `styles.css` para las clases **exactas** de cada irreversible y decir qué `min-height` gana:
   especificidad y, a igualdad, la última. Límites declarados en el fichero: solo reglas de nivel
   superior (fuera de `@media`) y selectores hechos solo de clases. Lleva suelo (ve la regla
   `.btn.btn-sm` a 30) y control (el mismo botón sin la clase da 30).
   - **Contra el CSS de main: 1 falla / 5 pasan (6).** Cae «Borrar» proveedor con
     «gana `.btn.btn-sm` con 30 px». «Borrar» plantilla y «Emitir» pasan también en main: ya
     ganaban por orden. Son controles de que el cálculo no marca en rojo todo lo que lleva la clase.
   - Con el arreglo: 6/6.
   - La altura en píxeles la juzga el guard, no este test.
2. **El guard vuelve a vigilar Proveedores** (`guard-objetivo-tactil.mjs`, superficie `renderProvidersView`)
   con una comprobación nueva: toda acción marcada con `accion-irreversible-btn-44` debe llegar a
   **44 px en todos los anchos** (también en escritorio, donde el mínimo general es 36). Estos botones
   **no pasan por la lista de excepciones**, y la superficie declara qué irreversible TIENE que
   encontrar (`irreversibles: ['Borrar']`): si falta, sale CIEGO, no verde.
   - Cortos declarados uno a uno, medidos con la lista **vacía**: 3 a 929 («Editar», «Desactivar»,
     «Borrar»); «Borrar» se ARREGLA; «Editar» y «Desactivar» (`.btn-sm` de siempre, no irreversibles)
     se declaran con su motivo. `distintosEsperados: 2` es el número medido, no uno puesto a ojo.
   - El test nuevo comprueba también que el guard siga declarando Proveedores con «Borrar»: es el
     patrón de SCRUM-1111 (un guard que se pone verde retirando la pantalla que vigilaba).
3. **El test de SCRUM-786 no se ha tocado.** Sigue pasando: su literal
   `.accion-irreversible-btn-44 { min-height: 44px; }` sigue apareciendo una vez (es la última línea de
   la lista de selectores). Ese test comprueba que las clases **estén**; que **midan** lo comprueban
   ahora el guard y el test de este ticket.

## Suite

Ver el comentario de entrega en Jira (cifra medida tras el merge de main).

## Fuera de este ticket

- «Borrar» plantilla y «Emitir» albarán no están en ninguna superficie del guard (el banco no monta
  Plantillas por `:last-child`, SCRUM-786). Su cascada sí la calcula el test de este ticket.
