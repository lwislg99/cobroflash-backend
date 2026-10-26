# SCRUM-1577 · CONFIGURACIÓN · «Añadir condición» y «Quitar» a 44 px de toque (de SCRUM-962b)

> Lo construyó `jv-j3ae` (22-oct) sin número, porque el conector de Jira no cargó en su sesión. `jv-j3ai`
> (23-oct) abrió el ticket (SCRUM-1577, «relates to» SCRUM-962), renombró al número devuelto y midió la
> condición de c.20368 (abajo). SCRUM-962 es del equipo de Luis: aquí no se escribe en su registro; se cita.

**Medido contra:** `origin/main` = `82f3ea4115723db78ca56c4b2e1c426a810a0433` · 2026-10-22T14:47:03Z
**Skill UI:** cargada (`yaqu-premium-ui`), **tarde** (después de escribir el arreglo; ver `A9:`). Checklist AB6 repasado después: botones del inventario AB3 (`btn btn-secondary`, `btn btn-ghost`), dos `style=` en línea MENOS, foco visible igual que antes (anillo `rgba(34,197,94,.3) 0 0 0 3px`, medido a 390 y 929), capturas antes/después en `evidencias/scrum1577/`.
**Microcopy:** ninguna. No se ha tocado ningún literal (`TX.clausulaAnadir`, `TX.clausulaQuitar` siguen igual).
**Carril:** J3 (`settingsView.js`, contenedor de J3). Producción congelada desde el 20-oct: **no se ha visto en yaqu.app**; todo está medido con el árbol servido en local.

A9: aviso → cicatriz J3 «Escribí un arreglo de UI antes de cargar la skill de UI que el encargo pedía; la cargué al ir a escribir la línea «Skill UI» del registro.» — no se pudo comprobar: el orden en que una sesión carga una skill no deja rastro que un test del árbol pueda leer; lo cazó la propia sesión al ir a escribir la línea `**Skill UI:**`

## ¿Es rediseño? Condición de c.20368: el gris de «Quitar» es REPOSO, y pesa menos que «Añadir»

`jv-j3ai` paró antes de empujar (c.20367): las capturas enseñan forma, peso y relleno nuevos. El orquestador
decidió (a), estilo de la casa, **si** el gris de `.btn-ghost` es su reposo y no pesa más que `.btn-secondary`.

- **Es reposo, leído en el CSS:** `public/dashboard/css/styles.css:503-507` da a `.btn-ghost` `background: var(--neutral-100)` (#f1f2ee) sin `:hover` (SCRUM-720e lo subió del hover al reposo a propósito); el hover es `--neutral-200` (#e7e9e3).
- **Es reposo, medido en el navegador:** `evidencias/scrum1577/reposo.mjs` (mismo banco, ratón en 0,0, foco en `BODY`): «Quitar» `rgb(241, 242, 238)` a 390 y 929. **Control:** con el ratón encima, `rgb(231, 233, 227)`. La sonda distingue los dos estados.
- **Pesa menos (contraste WCAG sobre el blanco de la caja):** `.btn-secondary` tiene relleno 1,00, **borde 3,26** y texto 17,52. `.btn-ghost` tiene relleno **1,12**, sin borde y texto 10,14. Sobre `--bg` (#f6f7f5) salen 1,07 / 3,04 / 17,52 contra 1,05 / — / 10,14. Ningún eje da más a «Quitar». Control del cálculo: negro sobre blanco = 21,00.
- **Veredicto: (a), sin cambio de clase.** Lo que se ve como «más lleno» es un relleno de 1,12, por debajo del borde de 3,26 del secundario.
- ⚠️ **Discrepancia sin arreglar (no es mi carril):** `DESIGN.md:186` dice «Ghost: sin fondo ni borde» y `styles.css` le da fondo desde SCRUM-720e. No toco ninguno de los dos. Se nombra en la entrega.

## PASO 0 — el defecto existía hoy

Banco de 962b tal cual (`docs/master/evidencias/scrum962b/configuracion-viva.mjs`) sobre `82f3ea41`: Facturación da «Añadir condición» **22** de toque, los dos `select` **38,9**, y Marca el color **38,7/39**. Igual que en 962b.

## Lo que se arregla (y lo que NO, y por qué)

| control (962b (2)) | antes | ¿arreglado aquí? |
|---|---|---|
| nº 1 · «Añadir condición» (`#clausulas-anadir`) | botón nativo, `style="font-size:13px"`, 22 px | ✅ `class="btn btn-secondary"`, sin `style=` |
| de paso · «Quitar» de cada cláusula (`[data-clausula-quitar]`) | igual que el nº 1, 22 px (962b no lo vio: sus datos no traían cláusulas) | ✅ `class="btn btn-ghost"`, sin `style=` |
| nº 4 y 5 · `select` Retención de IRPF / ¿Qué tipo de actividad tienes? | 38,9 | ❌ **NO.** Pide `styles.css` (como `.qr-campo .input`) o ampliar estilo en línea (como su hermano `fCriterioCaja.style.minHeight`). Lo primero choca con la rama viva `scrum-962f-editor-cuatro-44` (+32 líneas en `styles.css`); lo segundo lo prohíbe el orquestador (regla 4). **Espera a que 962f entre en `main`.** Probado y deshecho: con `style.minHeight = "44px"` daban 44,5–45 a 320/390/929 |
| nº 3 · selector de color (`#brand-color-input`, `height:38px` en línea) | 38,7 (y 32,3 de **ancho** a 320, encogido por el flex) | ❌ **NO**, mismo motivo. Probado y deshecho: `height:44px;flex-shrink:0` daba 44,7–45 de alto y 48 de ancho, sin scroll horizontal |
| nº 2 · enlace `yaqu.app/p/… ↗` | 18 | ❌ **NO**: es «discutible» en 962b (enlace en línea; WCAG 2.5.8 lo exime y DESIGN.md §6 no). Lo decide quien firma la regla |

Por qué `btn-secondary` y `btn-ghost`, y no `btn-sm`: DESIGN.md §5 deja `btn-sm` en 30 px también en móvil. Las dos clases suben a 44 en móvil por `@media (max-width: 768px) { … :not(.btn-sm) { min-height: 44px } }` y se quedan en 36 en escritorio, que es la regla escrita (`minimoPara()`).

## ANTES y DESPUÉS — `evidencias/scrum1577/banco-44.mjs`

Mismo banco que 962b (`_banco-lista.mjs`, vista viva, clic real en la pestaña, árbitro `__areaDeToque`). 5 controles × 320/390/929 = **15 mediciones**. **Control positivo SEMBRADO:** un `<select>` de 20 px pegado al primer objetivo de cada pestaña; tiene que salir corto o la fila es CIEGA (salida 2). Comprobado que sabe decir CIEGO: en mi primera versión la sonda caía en un panel oculto y el banco salió 2 con 21 CIEGOS, no verde.

| control | toque ANTES 320 · 390 · 929 | toque DESPUÉS 320 · 390 · 929 | sonda |
|---|---|---|---|
| «Añadir condición» | 22 · 22 · 22 | **44,5 · 44,6 · 36,7** | 20,2–21 |
| «Quitar» (fila 1) | 22 · 22 · 22 | **44,8 · 44,9 · 37** | 20,2–21 |
| `select` Retención (sin tocar) | 38,7 · 39 · 38,9 | igual | |
| `select` Actividad (sin tocar) | 38,6 · 39 · 38,9 | igual | |
| color de marca (sin tocar) | 38,9 · 38,7 · 39 | igual | |

La tabla «después» de los tres sin tocar es la del árbol entregado, no la de la prueba deshecha. Ancho de página: `scrollWidth` = ancho de ventana a 320/390/929, antes y después.

## Test

`tests/scrum1577-configuracion-44.test.mjs` (sin gate): ① los dos botones llevan su clase de la casa y no `btn-sm`; ② sin `style=` en línea; ③ la regla de móvil que sube `.btn-secondary`/`.btn-ghost` a 44 sigue en `styles.css`.
- **Base en rojo:** con el `settingsView.js` de `origin/main` caen ① y ② (③ pasa: no depende del arreglo).
- **Mutaciones** en el catálogo del meta-guard (`MUTACIONES_QUE_ME_TUMBAN`, 4): `meta-guard-mutaciones.mjs --solo-censo` las cuenta (646 → **650** declaraciones, 171 → 172 ficheros, salida 0). Réplica local en copia fuera del árbol, `evidencias/scrum1577/mutar.mjs`: **base verde, las 4 tumban SU prueba, MAL 0**.

## Tandas

- **Guards de navegador** (`node scripts/guards-visuales.mjs`, con `dist/` de `tsc --noCheck`): **38 guards · 38 verdes · 0 CIEGOS · 0 rojos** (504 s). La primera pasada, sin `dist/`, salió 2 con 5 CIEGOS: no es verde, se repitió.
- **Relacionados:** los 44 ficheros de `tests/` que nombran `settingsView` + el mío + `scrum713c` (trinquete de estilos en JS: sigue en 334, cuenta escrituras a `.style` y no atributos `style=`) + `scrum666b` = **46 ficheros · 433 pass · 0 fail · 0 skipped · 0 cancelled** (TAP a fichero; mis 3 casos aparecen en él).
- **NO corrida:** la suite completa (`npm test`).
- **Repetidas por `jv-j3ai` el 23-oct, tras el renombrado** (`origin/main` sigue en `82f3ea41`, leído con `git ls-remote`): guards de navegador **38 · 38 verdes · 0 CIEGOS · 0 rojos** (509,6 s) · relacionados (45 que nombran `settingsView`, el mío incluido, + `scrum713c` + `scrum666b`) **433 pass · 0 fail · 0 skipped** · 267/273/1294/811c/237/976 + el mío **73 pass · 0 fail** · censo del meta-guard **650 declaraciones, 172 ficheros**, salida 0 · `mutar.mjs` **base verde, 4/4 tumban su prueba, MAL 0**. La primera pasada de 1294/811c salió **ROJA por dos fallos del registro**, no del guard: la cita del aviso A9 cortaba la cicatriz antes del «;» (el guard compara la frase entera), y `**Skill UI:**` no empezaba por «cargada». Arreglado el registro.
- **Y otra vez tras `git merge origin/main` = `d09951f487138503bdce72212886b310ba89259e`** (main se movió a mitad: #2694, #2695, #2697; ninguno toca `settingsView.js`, `styles.css` ni la cicatriz de J3; `dist/` rehecho con `tsc --noCheck`): relacionados + 267/273/1294/811c/237/976 **503 pass · 0 fail · 0 skipped** (los 3 casos de 1577 dentro) · guards de navegador **38 · 38 verdes · 0 CIEGOS · 0 rojos** (546,8 s).

## Sin mirar / pendiente (no es cero)

- **Los campos de cada cláusula** («Título», «Texto»: `input` y `textarea` nativos con `style="width:100%"`) se ven bajos en la captura y **no los he medido**. Mismo bloque, mismo carril; piden clase de campo de la casa + CSS → mismo bloqueo que los `select`.
- Los `select` y el color: **esperan a 962f** (arriba).
- yaqu.app: producción congelada; ver a 390 y 1280 cuando se descongele.

## SCRUM-1577b · partes 2 y 3: los dos `select` de Facturación y el selector de color, a 44 px de toque

**Medido contra:** `origin/main` = `f6a3119675c2584480d846fa0a20572d48cadaa5` · 2026-10-26T16:06:05Z
**Skill UI:** cargada (`yaqu-premium-ui`), antes de tocar el código. DESIGN.md §5 «Inputs / Fields» y §6 «targets ≥44px» leídos. Checklist AB6: targets ≥44 (abajo) · un `style=` en línea MENOS (el del color, que pasa a la hoja tal cual era salvo el alto) · ningún token nuevo (`var(--border)`, los mismos valores) · capturas antes/después en `evidencias/scrum1577/b-*.png` · ancho de página sin desbordar a 320/390/929.
**Microcopy:** ninguna. Ningún literal tocado.
**Carril:** J3 en `settingsView.js` (contenedor de J3). En `public/dashboard/css/styles.css` (contenedor de **S2**) sólo un bloque nuevo marcado «J3 · SCRUM-1577b», al final, como permite `docs/equipo/dos-equipos.md:95-97` (y como hace J2 en ese mismo fichero). No se reescribe nada de S2. Encargo del orquestador `cobroflash-backend-8b` a `jv-j3bn`.

A9: comprobación → `tests/scrum1577-configuracion-44.test.mjs`

El fallo que generaliza: mi primer «después» dio **15/15 verdes** en el banco de 44 con el botón «Sin color (por defecto)» **cortado** a 320 (lo creaba mi arreglo: el color ya no se encoge y la fila no cabe). El banco mide el control, no a su vecino, y `scrollWidth` tampoco lo ve porque la tarjeta recorta. Lo cacé mirando la captura. Ahora lo comprueban el caso ④ del test (exige `flex-wrap: wrap` en la fila; la mutación que lo quita lo tumba) y `captura-1577b.mjs`, que imprime el borde derecho del botón contra el de la tarjeta y dice CORTADO.
De paso, un error mío sin comprobación posible: añadí código al test con un heredoc, con mi cicatriz del 21-oct en contra. Va a `docs/equipo/cicatrices/J3.md`.

### PASO 0 — el defecto existe hoy

- #2692 (962f), el bloqueo del ticket, está en `main`: mergeado `def9d33d3f973dc75bfd7076478523ea1ac06afe` el 2026-10-24T12:53:29Z. Ni rama ni PR de 1577b en el remoto (`ls-remote 'refs/heads/scrum-1577*'` vacío; `gh pr list --search 1577`: #2699 MERGED y un #1577 de otro asunto).
- Banco ANTES (abajo): 6 rojos. Los `select` dan hoy **36,5–37** de toque, no 38,9 como el 22-oct: su alto sale de `.input` (padding sin mínimo), así que depende de la fuente. El color, **38,6–38,9** de alto y, a 320, **18,2 de ancho** (el 22-oct, 32,3).

### Lo que se cambia

- `settingsView.js:802`: el `<input type="color">` pierde su `style=` en línea (un `style=` le gana a la hoja: no había otra forma de subirle el alto).
- `styles.css`, bloque «J3 · SCRUM-1577b» (nivel superior, fuera de toda `@media`: el ticket pide 44 también a 929, como el «Criterio de caja» de la misma pestaña):
  - `#retencion-irpf-tipo, #actividad-tipo { min-height: 44px; }` — por id: `.input` es de todas las pantallas y no se toca.
  - `#brand-color-input { flex: none; width: 48px; height: 44px; … }` — lo que había en línea, con el alto a 44 y `flex: none` para que no se encoja.
  - `:has(> #brand-color-input) { flex-wrap: wrap; }` — su fila salta de línea a 320 (ver `A9:`).
- No se copia el mecanismo de «Criterio de caja» (`fCriterioCaja.style.minHeight` desde JS): `scrum713c` cuenta esas escrituras y es un trinquete.

### ANTES y DESPUÉS — `evidencias/scrum1577/banco-44.mjs` (el de la parte 1, sin cambios)

Corrido con `NODE_PATH` al `node_modules` del checkout compartido (este árbol no tiene, y no he creado ningún junction en él; el banco sólo saca `puppeteer-core` por `createRequire`). 5 controles × 320/390/929 = **15 mediciones**; sonda sembrada de 20 px en cada pestaña, que sale corta (20,2–21) en las 6 filas de pestaña de las dos pasadas: 0 CIEGOS.

| control | toque ANTES 320 · 390 · 929 | toque DESPUÉS 320 · 390 · 929 | caja DESPUÉS (alto×ancho) |
|---|---|---|---|
| `select` Retención de IRPF | 36,7 · 37 · 36,9 | **44,7 · 44,9 · 44,9** | 44×170 |
| `select` ¿Qué tipo de actividad tienes? | 36,5 · 36,7 · 36,9 | **44,5 · 44,7 · 44,9** | 44×121 |
| color de marca | 38,9 · 38,7 · 38,6 (caja 38×**18,2** a 320) | **44,9 · 44,7 · 44,6** | 44×48 en las tres |
| «Añadir condición» (parte 1, sin tocar) | 44,5 · 44,6 · 36,7 | igual | |
| «Quitar» (parte 1, sin tocar) | 44,8 · 44,6 · 37 | igual | |

Banco: ANTES salida 1 (ROJO 6 · CIEGO 0 · VERDE 9); DESPUÉS salida 0 (ROJO 0 · CIEGO 0 · VERDE 15).

`evidencias/scrum1577/captura-1577b.mjs` (nuevo): capturas `b-antes-*`/`b-despues-*` de las dos filas a 320/390/929, ancho de página y el borde del botón de al lado del color. ANTES sirve una copia de `public/` de `origin/main` (`git archive`; `diff --no-index` = sólo mis dos ficheros). Control: la fila «antes» tiene que dar el color a 38×18,2 a 320, y lo da. Página = ventana en las 6 filas de cada versión. Botón contra tarjeta a 320: antes 287/287, primer «después» **316,8/287 CORTADO**, final 194,3/287 (baja de línea entero).

### Test

`tests/scrum1577-configuracion-44.test.mjs`, dos casos nuevos: **④** el color sin `style=`, con `height: 44px` y `flex: none`, y su fila con `flex-wrap: wrap`; **⑤** los dos `select` con `min-height: 44px` fuera de toda `@media`, y sus ids todavía en la vista. La hoja se lee sin comentarios, sin los bloques `@media` (recortados por llaves equilibradas, con suelo: el recorte tiene que quitar algo) y con los selectores anclados a principio de línea.
- **Base en rojo:** el test contra `settingsView.js` y `styles.css` de `origin/main` → ①②③ pasan, **④ y ⑤ caen** (salida 1).
- **Mutaciones:** 4 nuevas en `MUTACIONES_QUE_ME_TUMBAN` (8 en total). `evidencias/scrum1577/mutar.mjs` sobre el commit local `fea74addd06e91030ee436208e5f18ee93818f80`: **base verde, 8/8 tumban SU caso, MAL 0**.

### Sin mirar / pendiente (no es cero)

- **Parte 4** (el enlace de la página pública, DESIGN.md §6): espera decisión. No tocada.
- **Parte 5 · yaqu.app: NO HECHO.** Esta sesión no lo ha intentado.
- **Los campos de cada cláusula** («Título», «Texto»): siguen sin medir, como dijo la parte 1. Fuera del encargo.
- **Foco del color:** no tenía estilo de foco propio antes y no se le ha dado. No medido.
- **Suite entera local: NO CORRIDA** (orden del orquestador: 10 sesiones a la vez y la máquina justa de memoria). Las tandas dirigidas, abajo.

### Tandas (sobre el commit local `97bea8f1da55b60e59340ecd04d44fd9e97b3d65`)

- **Primera pasada, CIEGA:** en este árbol, que no tiene `node_modules`, 100 de 590 cayeron por 96 «Cannot find package 'typescript'», 2 «axios» y 1 «fake-indexeddb». No es un rojo: se repitió en un árbol anidado de usar y tirar (`.claude/worktrees/j3bn-mini` del checkout compartido, con `dist/` de `tsc --noCheck` y sin `prisma generate`), ya quitado.
- **Mini-tanda** = los 15 guards del encargo (237, 976, 824, 836, 419, 702, 700, 719, 1415, 267, 273, 1294, 811c, 713c, 1387) + el mío + todo `tests/` que nombra `settingsView` o `styles.css`: **149 ficheros · 1.391 tests = 1.390 pass + 0 fail + 1 skipped** (cuadra). El salto es `scrum1145` «por la ruta real», gateado por `LIBRO_PG_URL`. Control positivo: mis 5 casos `SCRUM-1577 ①…⑤` están en el TAP; control a cero: `SCRUM-1577 ⑥`, 0.
- **Guards de navegador que montan Configuración** (no hay filtro en `guards-visuales.mjs`: uno a uno): `guard-modo-en-ajustes`, `guard-aviso-bizum`, `guard-completar-lleva-al-campo`, `guard-falta-en-otra-pestana` y `guard-vias-de-cobro`, **salida 0 los cinco**. `guard-objetivo-tactil` sale **2 (0 hallazgos · 4 CIEGOS)**, y **no es mío**: corrido en otro árbol anidado en `origin/main` = `c1331293b01ac32a4357cf1b239dab86853f25ee`, da los mismos 4 ciegos con las líneas idénticas (`diff` vacío). Además ese guard **no mide Configuración** (0 líneas nombran la pantalla o estos tres controles), así que no prueba nada de este cambio: lo prueba el banco de arriba.
- `main` avanzó de `f6a31196` a `c1331293` mientras medía: `git diff --stat` entre los dos sobre mis siete rutas, vacío.
