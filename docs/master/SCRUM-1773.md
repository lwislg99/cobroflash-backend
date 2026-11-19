# SCRUM-1773 · guard trinquete de `style="` y `on*=` en cadenas de `public/dashboard/js`

## SCRUM-1773a · 19-nov: la tabla congelada del día, por AST, con sus dos mitades (J3)

**Medido contra:** `origin/main` = `6cabd3d42c1e0c7ba531a91ab94471c17c288949` · 2026-11-19T17:55:17Z (cabecera `Date:` de GitHub; sesión J3 `jv-j3cm`, por encargo del orquestador `cobroflash-backend-c7`; la rama salió de `d4a0fc951` y lleva fusionado este main, el del merge de 1756j)

A9: comprobación → `tests/scrum1773-trinquete-style-en-innerhtml.test.mjs`

Mutaciones: catálogo → `tests/scrum1773-trinquete-style-en-innerhtml.test.mjs` (4/4 cazadas con `correr` + `aplicarUna`; la inocua de control sale MUDA; `evidencias/SCRUM-1773/mutar.mjs.txt` y `rojo-y-mutaciones.salida.txt`).

**Qué hace.** `tests/scrum1773-trinquete-style-en-innerhtml.test.mjs` recorre los 98 `.js` de `public/dashboard/js/**` y cuenta, por AST de typescript (la misma idea que `rangosTs` del censo 1756g: solo vale un acierto que EMPIEZA dentro de un literal de cadena o de plantilla), los `style="` y los `on*=`. Congela la tabla por fichero (`CONGELADA_STYLE`, `CONGELADA_ON`, un número por línea) y cae si un fichero SUBE, si entra uno NUEVO con n > 0, o si uno BAJA sin recongelar: bajar exige tocar la tabla y añadir a `HISTORIAL` una línea fechada con el total, porque otro caso exige que la tabla sume la última línea. No arregla ningún fichero del panel.

**Congelado hoy: 565 `style=` + 6 `on*=` en 24 ficheros de 98.** Frente al censo 1756g (880 + 6 en 36), fichero a fichero:

| diferencia | ficheros | por qué |
|---|---|---|
| −228 | `onboardingView.js`, `plansView.js`, `settingsView.js`, `teamView.js`, `tutorial.js` | 1756h (J3) ya en main: los cinco a 0 |
| −61 | `cobrosView.js`, `csvImport.js`, `customerDetailView.js`, `customersView.js` | 1756i (J2) ya en main: los cuatro a 0 |
| −28 | `invoiceDetailView.js`, `invoicesView.js`, `puertaSerie.js` | 1756j (J1) ya en main: los tres a 0 |
| +2 | `quoteRequestsView.js` (14 → 16) | dos cadenas concatenadas que abren con `'style="`: el punto ciego del `\sstyle=` del censo, el mismo de c.22142 |
| 0 | los otros 22 | iguales al censo, y los 6 `on*=` también |

Cuadra: 880 − 228 − 61 − 28 + 2 = 565. El caso de `settingsView.js` de c.22142 ya no está en el árbol (1756h lo bajó), así que la forma concatenada la prueba la siembra. Primero congelé sobre `d4a0fc951` (593 en 27). Antes de empujar, main recibió 1756j: lo fusioné, lo volví a medir con el mismo medidor y la tabla quedó en 565 en 24. Quien baje un fichero a partir de ahora verá el rojo de «no baja en silencio» y recongela con su línea fechada.

**Controles.** Siembra fuera del árbol (un directorio temporal: el árbol no se mueve): la forma concatenada, una plantilla con `style=` y `onclick=` → 2 + 1, en sus líneas. Control cero con comentario, `el.style = …`, `data-style=`, una expresión regular y un `«style="…"»` citado → 0. Suelo: población 0, o 0 aciertos con la tabla llena, es CIEGO. Rojo visto también con un fichero NUEVO real en `public/dashboard/js/` (creado y borrado en el mismo comando): caen los dos casos que tienen que caer, con `fichero:línea` y la receta.

**Error mío.** La primera versión aceptaba delante del atributo cualquier carácter que no fuera letra, cifra, `_` ni `-`, y contaba un `style=` de más en `exportView.js`: un `«style="min-height:44px"»` citado dentro de un comentario HTML de una plantilla. Lo cacé al cruzar fichero a fichero con el censo. Ahora delante vale un blanco o una comilla, y ese caso está en el control cero (la comprobación de la línea A9). Además, la primera pasada de guards la corrí sin `dist/` (tercera vez, con la cicatriz J3 del 12-nov escrita): 836 salió rojo por ficheros de `dist/` que no existían. Lo leí en el texto del rojo, construí `dist/` con `--noCheck` (sin tocar `src/`) y repetí: 17/17. Y escribí en los comentarios del guard dos recuentos sin ancla: el de 36 ficheros y el de 27 ficheros. `scrum737` cayó (83 frente a 81), y ahora los dos llevan su sha y su fecha en la misma línea.

**NO MEDIDO.** Un `style=` precedido de un blanco dentro de un comentario HTML de una plantilla sí contaría. Medido por línea: de las 36 líneas de `public/dashboard/js` con `<!--`, solo dos llevan además `style=`. Una es el `«style=` citado de `exportView.js`; la otra, en `productsView.js`, es un atributo real que va antes del comentario. Un comentario HTML de varias líneas no lo he mirado. `setAttribute('style')`, `javascript:` y `el.style` no son de este guard. yaqu.app: no aplica, el guard no cambia nada que se despliegue.
