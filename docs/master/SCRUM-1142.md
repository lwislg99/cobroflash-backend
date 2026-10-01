# SCRUM-1142 · Anular factura y Emitir rectificativa a 44 px de área de toque (hermano de SCRUM-786)

**Medido contra:** `origin/main` = `46195e86903cdccc85a04327c0a68577773c4693` · 2026-09-30T23:06:09Z
**Rama:** `scrum-1142-toque-44-anular-rectificativa`.
**Sesión:** J1 (relevo del 1-oct). **Skill UI:** `yaqu-premium-ui` cargada — tarde, después de editar;
el cambio es sólo añadir una clase que ya existe (sin tokens, estilos inline ni texto nuevos).

## PASO 0 · la premisa

- `git grep accion-irreversible-btn-44` sobre `origin/main`: ningún botón de `invoiceDetailView.js` la
  lleva. Nada lo resolvía con otra redacción.
- **Lo que el ticket no sabía:** «Emitir factura rectificativa» NO se pinta como `btn-danger btn-sm`.
  Su destino es `overflow` en pending y paid (`invoiceActionsRegistry.js`), así que `ubicarAccion`
  le reescribe el `className` y `overflowMenu` lo convierte en `.overflow-item` dentro del «⋯».
  Poner la clase al crearlo no serviría: se la come la reescritura.

Área de toque REAL medida en Edge con el árbitro del guard (`__areaDeToque` de
`scripts/_medidor-de-toque.mjs`, elementsFromPoint con scroll), página pintada por el producto con
JS vivo (`scripts/_banco-lista.mjs`), factura `pending`, rol admin, «⋯» y modal abiertos pulsando:

| acción | 390 antes | 929 antes | 390 después | 929 después |
|---|---|---|---|---|
| «Anular factura…» (`btn-secondary btn-sm`) | 31 | 30,5 | 45 | 44,5 |
| «Anular factura» del modal (`#anul-si`, `btn-danger btn-sm`) | 31 | 30,7 | 45 | 44,7 |
| «Emitir factura rectificativa» (`.overflow-item` del «⋯») | 51,7 | 42 | 51,7 | 44,6 |

## Lo hecho

`public/dashboard/js/invoiceDetailView.js`, sólo la clase opt-in `accion-irreversible-btn-44`:
en `btnAnular`, en el `#anul-si` del modal y en `btnRectify` **después** de `ubicarAccion`.
Sin tocar `.btn-sm`, `.overflow-item`, `overflowMenu`, textos, flujo ni validaciones.

## Efecto colateral, declarado

«Cancelar» del modal (`#anul-no`) pasa de 30,7 a 44,7 px **sin llevar la clase**: comparte fila
`display:flex` con `#anul-si` y el `align-items` por defecto lo estira. No es irreversible y ganar
área no rompe nada; se deja y se dice. El «×» del modal (`modal-close`) sigue en 30,7 (no es de
este ticket). Si `.btn-sm` sube un día a 44, la clase opt-in queda redundante, no rota.

## Comprobación

- `tests/scrum1142-irreversibles-factura-44.test.mjs` (5 casos): monta la ficha con el banco y
  mira el botón que pinta el producto — los ítems del «⋯» capturados al pasar por `overflowMenu` y
  el modal abierto pulsando. Suelo, tres positivos y control (ningún no-irreversible, «Cancelar»
  incluido, lleva la clase). Rojo visto primero: 3 fallos con el código de `origin/main`.
  Mutación: la clase puesta ANTES de `ubicarAccion` → cae el caso ②.
- `tests/scrum1167-irreversible-gana-la-cascada.test.mjs`: tres filas más con las clases exactas;
  la regla que gana es la de 44 px, sin `!important`.

A9: comprobación → `tests/scrum1142-irreversibles-factura-44.test.mjs`
