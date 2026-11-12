# SCRUM-1687 · El censo de almacenamiento sigue el VALOR del receptor, no su texto

**Medido contra:** `origin/main` = `4d80438549d8dfb6b188331e71ee8e3613413718` · 2026-11-11T18:51Z (hora de GitHub)

A9: comprobación → `tests/scrum1687-censo-almacen-por-alias.test.mjs`

Lo escribe S3 (equipo de Luis). Ficheros tocados: `tests/_censo-almacenamiento-publico.mjs` (arreglo) y
`tests/scrum1687-censo-almacen-por-alias.test.mjs` (nuevo). Ningún fichero de `public/`.

## El defecto (lo midió S4 el 10-nov-2026; lo re-medí hoy)

El censo decidía si una llamada era de almacenamiento mirando el TEXTO del receptor
(`/(^|\.)localStorage$/`). Por eso `const a = window.localStorage; a.setItem(…)` y
`function f(almacen) { almacen.setItem(…) }` **no existían** para él, y al revés: un parámetro que se
llamase `localStorage` y valiese otra cosa sí entraba.

Re-medido hoy con una sonda independiente (todas las llamadas `X.setItem/getItem/removeItem` de
`public/`, sin decidir nada sobre el receptor): **29 llamadas; el censo veía 22; 7 ciegas.** Entre ellas,
**dos escrituras reales**, no una:

| | escritura | cómo llega el almacén |
|---|---|---|
| la que dio S4 | `public/dashboard/js/arranqueSinCobertura.js:45` · `almacen.setItem(CLAVE_SESION_SIN_COBERTURA, …)` | PARÁMETRO; `app.js:12` y `:875` pasan `window.localStorage` |
| **nueva, hoy** | `public/dashboard/js/almacenLocal.js:436` · `teclas.setItem(PREFIJO_FIRMA_RECHAZADA + …)` | ALIAS: `const teclas = teclasDelNavegador()`, que devuelve `localStorage` |

Las otras 5 eran sus lecturas y borrados, más el `removeItem` del propio bucle de purga.

## El arreglo

No se le enseña al censo «otro nombre» (sería el mismo defecto con otro texto). Se sigue el **valor**
por el AST, sobre un índice de TODO `public/`, porque los scripts del panel son globales entre ficheros:

- un nombre → su declaración en el ámbito que lo contiene (o la única global de `public/`), si no se reasigna;
- un parámetro → el argumento en esa posición en **todas** las llamadas a la función;
- una llamada → todos los `return` de la función;
- `c ? a : b`, `&&`, `||`, `??`; `null`/`undefined` no aportan almacén.

**Fail-closed:** lo que no se sabe seguir hasta UN almacén sale como `NO_RESUELTO`
(`'(almacén no resuelto)'`), con el texto del receptor en el campo nuevo `receptor`. **Se ve; no
desaparece.** Así sale, por ejemplo, un nombre declarado dos veces, un `let` reasignado, una variable
desestructurada o de bucle, un parámetro sin llamadas o con dos almacenes distintos, y una función que
además se pasa como valor (alguien la llama sin que se vea la llamada).

Campos: `receptor` **añadido**; `almacen` puede valer ahora `NO_RESUELTO`; los demás no cambian, tampoco
el formato de `id`.

## Control positivo, y cotejo contra el censo viejo

- **ROJO primero:** con el censo de `origin/main`, el test nuevo daba **6 de 7 en rojo**. El séptimo
  (ninguna escritura sin resolver) pasaba en vacío, como debe: ese estado no existía.
- **Cotejo fila a fila** del censo viejo contra el nuevo, sobre el mismo `public/`: viejo 22, nuevo 29.
  Las **22 de antes, idénticas** (ninguna desaparece ni cambia de almacén, de escritura o de clave). Las
  **7 nuevas**: 6 resueltas a `localStorage` con su clave; 1 `NO_RESUELTO`, el `removeItem` del bucle de
  purga (`almacenLocal.js:534`, el almacén llega desestructurado de un `for…of` sobre los dos almacenes;
  es un borrado y no cambia ningún veredicto).
- **El censo GOBIERNA, medido por mutación** (temporal, en mi worktree, no commiteada): quitar
  `yaqu_sesion_sin_cobertura` de `CLAVES_LOCALES` pone en rojo `scrum457 · toda escritura del panel está en
  el registro` con `arranqueSinCobertura.js:45 → yaqu_sesion_sin_cobertura`; quitar `yaqu_firma_rechazada_`
  lo pone en rojo con `almacenLocal.js:436`. Sin mutación, verde. Con el censo viejo, esas dos mutaciones
  salían VERDES: era el defecto.

## Qué se ha decidido con el caso vivo: se REGISTRA, no se corrige

Las dos claves ya estaban en `CLAVES_LOCALES` con `purga: true` y su motivo (`almacenLocal.js:104` y
`:118`). Pasar el almacén por parámetro es una forma legítima (así se prueba sin navegador) y ahora el censo
la sigue, así que **no hay código que corregir**. Lo que cambia es quién lo vigila: hasta hoy, la de
`arranqueSinCobertura.js` solo la ataba un test escrito a mano (`scrum918`); desde hoy, el censo, como
cualquier otra escritura. Además, los ficheros de `public/dashboard/` son de S2 y S4: este ticket no los toca.

## Verde

- Los 7 casos nuevos y los consumidores del censo (`scrum457`, `scrum336`, `scrum584`, `scrum846b`) y
  `scrum918`: **60 de 60**.
- La suite completa: ver el comentario del ticket (cifra con su población).
