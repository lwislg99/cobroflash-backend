# SCRUM-1843 · «Marcar como cobrada» a 44 px de toque, por contenedor

**Medido contra:** `origin/main` = `25ddbe90bba5cbf75e6fd125fc8045ad040f0497` · 2026-11-25T02:24:03Z (base de la rama y árbol medido; al anclar, el `origin/main` local ya iba 6 commits por delante, y ninguno toca `public/`, `scripts/` ni `DESIGN.md`)

A9: comprobación → `tests/scrum1843-marcar-cobrada-44.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar la hoja). Sin tokens, clases, componentes ni textos nuevos: una regla de tamaño acotada a su contenedor. **Microcopy:** ninguna.

Carril J1, a mano: `styles.css` es contenedor de S2 y J1 añade SU bloque marcado (`docs/equipo/dos-equipos.md`).
Rama `scrum-1843-marcar-cobrada-44`. Sesión `jv-j1kr` (ayudante del puesto J1).

## El defecto

En la ficha de una factura `pending` sin Bizum disponible, la primaria es `btnTogglePaid`
(`invoiceActionsRegistry.js`, `cuando: 'bizum-no-disponible'`) y `ubicarAccion` le pone `btn-primary btn-sm`:
caja de 30 px y 30,7-31,0 de toque (censo táctil de SCRUM-936f). DESIGN.md exime a `.btn-sm` con una frontera:
«una acción primaria de pantalla nunca usa la variante pequeña». Ésta la usaba.

## Qué se construyó

`public/dashboard/css/styles.css`, bloque `/* J1: SCRUM-1843 · … */` … `/* J1: fin del bloque SCRUM-1843 */`,
debajo del de SCRUM-1787n:

    .j1-prog ~ .detail-next > div > .btn-sm { min-height:44px; }

- Sólo tamaño; `.btn-sm` global no se toca; `invoiceDetailView.js` no cambia (`git diff` vacío). Sin token de
  44 en `tokens.css` ni en DESIGN.md: el literal, como 1148 y 1559g.
- **El ancla** es `.j1-prog`, la línea de progreso que precede a `.detail-next` en la tarjeta del resumen. Ya
  existía (SCRUM-1787b) y sólo la escribe esta ficha: `quotesDetailView.js` también pinta `.detail-next` y no
  puede cambiar. Sin clase nueva en el marcado (la trampa de SCRUM-1148 parte 3 con `guard:lista-trabajos`).
- Pesa (0,3,1) y gana a `.btn.btn-sm` (0,2,0) aunque el bloque vaya al principio de la hoja (A10, SCRUM-1756j).
- **Barra entera y no sólo la primaria — decisión de este tramo.** Es la misma fila de la misma pantalla
  (el criterio de 1559g para la ficha del presupuesto, que ya tiene su barra a 44 por `.presupuesto-ficha
  .btn-sm`), y la primaria cambia de ocupante según el estado (Bizum con la bandera encendida): una regla
  sólo para `btn-primary` dejaría «Descargar PDF» y «Enviar por WhatsApp» a 30,7 junto a una primaria de 44.
  La cabecera («← Volver a facturas») queda FUERA: es el control.

`tests/scrum1843-marcar-cobrada-44.test.mjs` (2 casos):
- ① en navegador: la vista REAL montada con el banco (`appModoEmision='fiscal'`, factura `pending` sin cobro en
  vuelo), serializada y servida con las hojas del índice (las de `censo:tactil-panel`), medida con
  `__areaDeToque` a 390 y 1280. Controles CIEGO: el botón existe UNA vez con `btn-primary btn-sm`, no hay
  Bizum, la fuente cargó, un botón SEMBRADO de 30 px sale corto. Exige ≥ 44 a la primaria y a sus dos
  hermanas, y que «← Volver a facturas» mida lo mismo que en rojo (31 ± 1 px). Sin navegador, salta con motivo.
- ② sin navegador: cada selector del bloque cuelga de `.j1-prog ~ .detail-next > div >`, y la CLASE `j1-prog`
  (no el prefijo: `j1-prog-paso` no cuenta) sólo la escribe `public/dashboard/js/invoiceDetailView.js` entre
  todos los `.js`/`.html` de `public/`.

## Antes y después — área de toque (árbitro `__areaDeToque`, Edge, fuente Inter cargada)

| Objetivo (ficha `pending`) | 390 antes → después | 1280 antes → después |
|---|---|---|
| «Marcar como cobrada» `btn-primary btn-sm` (caja 30 → 44) | 30,7 → 44,7 | 30,7 → 44,7 |
| «Descargar PDF» `btn-secondary btn-sm` (misma barra) | 30,7 → 44,7 | 30,7 → 44,7 |
| «Enviar por WhatsApp» `btn-secondary btn-sm` (misma barra) | 30,7 → 44,7 | 30,7 → 44,7 |
| «⋯» (ya 44 por `.overflow-trigger`) | 44,7 → 44,7 | 44,7 → 44,7 |
| CONTROL «← Volver a facturas» (cabecera, fuera) | 31,0 → 31,0 | 31,0 → 31,0 |
| «Anular factura…» (sección propia, SCRUM-1142) | 44,9 → 44,9 | 44,9 → 44,9 |

El test ANTES de la regla: 0 de 2 en verde — «🔴 «Marcar como cobrada» mide 30.7 px de toque a 390 px (mínimo
44, AB6)» y «🔴 `styles.css` no tiene UN bloque «/* J1: SCRUM-1843 … */» con su cierre». Con la regla: 2 de 2.

`npm run censo:tactil-panel` (salida 0 las dos veces; 29 vistas, 28 montadas, 88 páginas × anchura, 0 sondas
sin cazar): `renderInvoiceDetailView` 9 medidos / **6 → 3** cortos a 929 y a 390. «Marcar como cobrada» sale
de la fila `BUTTON.btn-primary.btn-sm` (3 → 2 elementos) y PDF y WhatsApp de `BUTTON.btn-secondary.btn-sm`
(16 → 14); distintos por debajo de 44: 115 → 112. **Ninguna otra línea del censo cambia** (`diff` de las dos
salidas): tampoco `renderQuoteDetailView`, la otra pantalla con `.detail-next`. Los 3 cortos que quedan en la
ficha son «← Volver a facturas» y los dos `INPUT.input` (36 y 34,8 px), fuera de este ticket.

`node scripts/guard-objetivo-tactil.mjs`, antes (árbol de la base copiado con `git archive` al TEMP) y
después: salidas IDÉNTICAS, «0 hallazgos · 4 ciegos → salida 2». Los 4 ciegos son «FUENTE ROTA en /: 3 de 41
caras» en la LANDING (`landing.css`, las tres caras `local('DejaVu Sans')`, que esta máquina Windows no tiene):
del entorno, no de esta regla. La ficha de factura no es superficie de ese guard y la excepción
`BUTTON.btn-primary.btn-sm` es de la ficha 360 («+ Nuevo presupuesto», J2), a la que el ancla no llega: no
queda nada SOBRANTE y el guard no se toca (la puerta de SCRUM-1841 c.22708 no hizo falta).

Capturas de la ficha pendiente, recortadas a la cabecera y el resumen:
`evidencias/SCRUM-1843/ficha-pendiente-antes-390.png`, `…-antes-1280.png`, `…-despues-390.png` y
`…-despues-1280.png`.

## Medido de paso, sin tocar

Justificante PAGADO: «Marcar como pendiente» vive en el «⋯» como `.overflow-item`. A 1280 (menú flotante)
mide 42,0 px (caja 41,7): cumple los 36 de escritorio de DESIGN.md, corto contra 44. A 390 (hoja inferior,
`.overflow-sheet`) mide 51,7. Arreglarlo exige tocar `.overflow-item` global: no se hace aquí.

## Lo que NO se ha hecho o medido, dicho

- yaqu.app: pendiente tras el despliegue (la medida es del banco con las hojas reales, no de producción).
- La primaria Bizum (bandera encendida) y los estados `paid`/`annulled`/`R1` de la barra: cubiertos por la
  misma regla, no medidos en navegador (el estado `paid` sí, de paso: PDF y WhatsApp a 44,9).
- Un solo navegador (Edge), ningún móvil real.

## Errores propios

- Para medir el «antes» del guard intenté devolver `styles.css` a la base REESCRIBIENDO el fichero del árbol
  (`git show HEAD:… > …`). Lo paró `.claude/hooks/guard-dangerous.sh`; medí sobre una copia de la base en el
  TEMP, sin tocar el árbol.
- Las uniones de esa copia las creé primero con `cmd //c mklink` y salieron con destino `C:\C:\…`: lo vio
  la comprobación de después (`ls` vacío) antes de lanzar nada, y se rehicieron con PowerShell.

# SCRUM-1843b · relevo: el filtro propio del test pasa a `soloEjecutable`

**Medido contra:** `origin/main` = `bdd808ebe9bae708028e8aab87c52bc7b0ee6a28` · 2026-11-25T02:59:14Z (hora de la cabecera `Date:` de GitHub; rama `scrum-1843-marcar-cobrada-44` con punta `ff08fd780494103beed2b4ccf8287eea7a2094f2`, 23 commits detrás de ese `origin/main`, sin mergearlo: CI prueba el merge)

A9: comprobación → `tests/scrum700-filtros-de-comentario.test.mjs`

**El rojo (dato del orquestador, run 45533291047, no lo bajé yo):** 14.444 tests, 1 fail:
`SCRUM-700 · 🔴 el número de filtros que CIEGAN CÓDIGO no sube` → «92 > 91». El 92 era
`tests/scrum1843-marcar-cobrada-44.test.mjs`, con `s.replace(/\/\*[\s\S]*?\*\//g, '')` para trocear el bloque.

**El arreglo (regla 41: el tope de 91 no se toca):** el quitacomentarios es el de la casa, `ejecutableDe`
de `tests/_guard-texto.mjs` (que llama a `soloEjecutable` y le añade el suelo de SCRUM-1395), con
`almohadillaEsComentario: false` y el ancla `.j1-prog ~ .detail-next > div > `, como los dos precedentes
de CSS (`scrum1587-reenviar-correo-cobros-44` y `scrum1145-pestana-sitios`). Los dos usan el mismo helper:
no había un «otro precedente» con otro filtro.

**Control, antes y después, sobre el bloque REAL (958 B):** el filtro propio sacaba **1 regla** y
`ejecutableDe` saca **1 regla**, y es la misma (conjuntos comparados, no cuentas):
`.j1-prog ~ .detail-next > div > .btn-sm { min-height:44px; }`.

**Lo que el helper SÍ se come, medido con un caso sembrado:** toma `//` por comentario también en CSS.
Sobre `.c{…}` / `.a{background:url(https://x.y/z.png)}` / `#b{…}` en tres líneas, el filtro propio saca 3
reglas y el helper 2: se come `//x.y/z.png)}` hasta el fin de línea, y `#b` acaba DENTRO del cuerpo de `.a`,
sin pasar por la comprobación del ancla. `#b` sobrevive (la almohadilla apagada funciona). En el bloque de
hoy no hay `url(` ni `//` fuera de comentarios, y por eso el control da igual. Para que el día que lo haya
no pase en verde, el caso ② cuenta las llaves que quedan tras el filtro y exige una de cada por regla:
con la siembra cae con «tras quitar comentarios hay 3 «{» y 2 «}» para 2 reglas» (exit 1), y el árbol
volvió a su sha256. Esa siembra la hizo un guion del TEMP de la sesión, que no está en git: no cuenta
como mutación repetible (A3). El defecto del helper es de `tests/_guard-texto.mjs`, que no es de este carril: se
reporta al orquestador, no se arregla aquí.

**Verdes, en local, uno por comando:** `npm run build` (tsc con tipos) salida 0 ·
`scrum700-filtros-de-comentario` 5/5 · `scrum1843-marcar-cobrada-44` 2/2 con navegador (0 saltados) ·
`scrum237` + `scrum976` 19/19 · `scrum1294` y `scrum267` y `npm run guards:entrada`, tras escribir este tramo.
No he corrido la suite entera (el encargo lo prohíbe).

**Errores propios:** el control positivo de mi `grep -F '.replace(/\/\*'` sobre `scrum700` (que lleva el
filtro peligroso a propósito) dio 0: lo escribe de otra forma. Valió como positivo el mismo `grep` sobre la
versión de `HEAD` del test, que dio 1.

# SCRUM-1843c · relevo: veredicto de mudez al día tras merge de main

**Medido contra:** `origin/main` = `c83ebdbea13a426c2a3e3b5655fca37567d62300` · 2026-11-25T03:27:20Z (hora de la cabecera `Date:` de GitHub; `git merge origin/main` dentro de `scrum-1843-marcar-cobrada-44` desde la punta `f0cbe95947c68d5452380d9e85cd5733a5d20228`, que iba 38 commits detrás; tras el merge, 0 detrás)

A9: comprobación → `tests/scrum719-el-suelo-de-los-doce.test.mjs`

**El rojo (dato del orquestador, run 45537041067, no lo bajé yo):** 14.474 tests, 14.461 pass, 1 fail:
`tests/scrum719-el-suelo-de-los-doce.test.mjs:399` · «SCRUM-1395b · ① el veredicto guardado de
`censo:mudez` cubre la población…» → `scrum1843-marcar-cobrada-44.test.mjs · sin ficha`. Desde 1843b el
test llama a `ejecutableDe`, así que entra en la población de `censo:mudez` (los guards que mencionan el
filtro), y no tenía ficha en `tests/_veredicto-mudez.json`.

**El arreglo (regla 41: ni el guard ni el json a mano):** `git merge origin/main` sin conflictos
(`public/dashboard/css/styles.css` se fusionó solo; frente a `origin/main` la rama sólo le añade sus 12
líneas, 0 quitadas) → `npm run build` (tsc con tipos, salida 0) → `npm run censo:mudez -- --escribir`
sobre el árbol fusionado, con TEMP sin espacios. El json sale del merge, no de la rama sola: CI prueba el merge.

**Lo que dijo el censo, con su población:** 144 guards mencionan el filtro; a medir, 1 de 144 (los otros
143 con ficha al día) → VIVO 1 · MUDO 0 · CIEGO 0 · NO APLICA 0 · YA ROJO 0. `tests/_guard-texto.mjs`
comprobado idéntico al original tras la mutación, y `git status` después del censo: sólo el json modificado.

**El diff del json:** 1 fichero, **+1 línea, 0 quitadas**:
`"scrum1843-marcar-cobrada-44.test.mjs": ["VIVO","cea7b65ed0617354"]`. **0 fichas caducadas de otros**: los
38 commits de main que entraron con el merge no dejaron ninguna ficha vieja (el censo habría vuelto a medir
cualquiera que hubiera caducado, y midió sólo una).

**Verdes, en local, sobre el árbol fusionado y con el json comiteado (TAP a fichero fuera del árbol; 0
saltados en todos):** `npm run build` (tsc con tipos) salida 0 · `scrum719-el-suelo-de-los-doce` 37/37 ·
`scrum1843-marcar-cobrada-44` 2/2 con navegador · `scrum700` + `scrum237` + `scrum976` 24/24 ·
`scrum1294` + `scrum267` 18/18 y `npm run guards:entrada` salida 0 (16 guards, 177 tests), corridos sobre
este tramo antes de añadirle este párrafo: se repiten tras el commit y el resultado va en la entrega · los
5 de árbol entero que `guards:entrada` pide a mano (`scrum195`, `scrum414`, `scrum694`, `scrum710b`,
`scrum737`) 38/38. No he corrido la suite entera (el encargo lo prohíbe).

**Errores propios:** en el mensaje de arranque al orquestador le di «con las cicatrices J1 leídas, ~115k»
de contexto: era una estimación, no una medida. La primera medida después de esa lectura dio 127.332.
