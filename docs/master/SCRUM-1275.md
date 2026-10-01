# SCRUM-1275 · Facturas: pulsar una fila no abre la factura

**Medido contra:** `origin/main` = `82cb31c81e3fa7357819af7370a4fcf53bff6682` · 2026-09-29T15:44:51Z (J1)

## El defecto

`public/dashboard/js/invoicesView.js`: SCRUM-845 (`b7adfd68`, 9-sep-2026) declaró la casilla del lote
con `const cb` **dentro** de `if (window.sePuedeMarcarPagadaEnLote(inv)) { … }`, y el clic de la fila,
**fuera** de ese bloque, hacía `if (e.target === cb) return;`. `const` tiene ámbito de bloque: el
manejador lanzaba `ReferenceError: cb is not defined` antes de llamar a `renderAppView`. Ninguna fila
—con casilla o sin ella— abría su factura, y la fila no tiene otro control para abrirla.

Diagnóstico del equipo de Luis; aquí se **reprodujo** antes de tocar nada.

## Rojo primero

`tests/scrum1275-la-fila-abre-la-factura.test.mjs` monta `renderInvoicesView` en el banco de vistas
(`_banco-vistas.mjs`) con una factura pendiente (lleva casilla) y una pagada (no la lleva), y entrega el
clic al oyente de la fila con el `target` pulsado, como al burbujear en el navegador.

| Caso | `main` (sin arreglo) | Con `let cb = null` | Arreglo **sin** `e.target === cb` |
|---|---|---|---|
| Suelo: pendiente con casilla, pagada sin ella | ok | ok | ok |
| ① fila con casilla → navega a su factura | **rojo** (`ReferenceError: cb is not defined`) | ok | ok |
| ② casilla → NO navega | **rojo** (`ReferenceError`) | ok | **rojo** (navega) |
| ③ fila sin casilla → navega a su factura | **rojo** (`ReferenceError`) | ok | ok |

La tercera columna es la mutación que vigila ②: un arreglo que quite la comparación hace pasar ① y ③.

## El arreglo

`let cb = null;` antes del `if`, y `cb = document.createElement('input')` dentro. Una línea de lógica;
ningún texto de usuario, ningún cambio visual.

## ¿El mismo patrón en otros sitios? (norma A7: se reporta, no se arregla de paso)

Medición propia, con el comprobador de TypeScript (`allowJs` + `checkJs`, `noEmit`) sobre los 95
ficheros de `public/dashboard/js/`: de los errores `TS2304` («Cannot find name»), los que nombran algo
**declarado en su propio fichero** (`const|let|var|function|class <nombre>`), que es la forma de `cb`.

- **Control con `main`:** salen 2 — `invoicesView.js:696 cb` y `documentoAsignados.js:109 miembros`.
- **Con el arreglo:** sale 1 — `miembros`, que es una línea de JSDoc (`@param opts { miembros, … }`),
  no código.

Conclusión, **acotada**: la forma «bloque que declara, código de fuera que usa» sólo estaba en `cb`.
Los otros 68 nombres sin resolver son globales entre ficheros (`renderAppView`, `cabeceraModal`…) que
TypeScript no ve porque se publican en `window` en tiempo de ejecución; **esta medición no comprueba que
cada uno exista**. Eso es lo que medirá el guard de SCRUM-1280 (equipo de Luis), que ya midió `cb` como
único caso real: coincide con lo de aquí, pero lo de los globales entre ficheros es medición suya.

## Verificación en producción

Pendiente del merge y del despliegue: se comprueba con `<meta name="yaqu-build">` de `index.html`.
