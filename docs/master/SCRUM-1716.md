# SCRUM-1716 · Descuento global en € o en % + la casilla sin estilo

Ticket (Jira): decisión del fundador del equipo J del 12-nov-2026, «El descuento global sí que se pueda
elegir euros o %», y defecto visto en su captura: la casilla «DESCUENTO GLOBAL» sale sin estilo.
Carril S2 (`quotesView.js`, `quoteDescuentos.js`, `styles.css`). Encargo del orquestador: c.21652
(primero la casilla; el selector €/% espera a confirmar el enfoque y a la firma de sus rótulos).

**Medido contra:** `origin/main` = `97a7a159ce45ae965fb75c0fa9876e7ff010f7c6` · 2026-11-12T13:56:20Z

A9: comprobación → `tests/scrum267-ancla-de-medicion.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en la re-medición del ancla; la tanda que construyó 1716a no lo declaró. AB6 sobre el diff: un selector más en la regla del campo de línea y en su `:focus`, así que el anillo Foco es el mismo; sin componente, clase, token ni color nuevos; capturas antes/después a 390 y 1280 en `evidencias/scrum1716/`)

Re-medición del ancla (12-nov, tarde; el PR #3115 cayó en SCRUM-267 porque el encabezado no la
llevaba). Lo comprobado contra ese `main`, no supuesto: de los ficheros de esta rama, el único que
`main` ha movido desde `ec7e19e64` es `styles.css` (+180 líneas), y TODAS sus reglas nuevas cuelgan de
`.parte-*`; ninguna toca `.quote-line` ni `.quote-dto-global__campo`. `git merge-tree` con `main`: sin
conflictos. La medición de yaqu.app de 1716a (abajo) es la de su hora y no se ha repetido.
Error propio de S2: 1716a se empujó con «Medido sobre `ec7e19e64`» (sha corto, sin hora) y sin pasar
`npm run guards:entrada`, que lo habría cazado en local; al poner el ancla salieron otros dos que la
falta tapaba (la línea A9 y la declaración de la skill).

## 1716a · La casilla sin estilo · S2 · 12-nov-2026 · rama `scrum-1716-casilla-dto-global`

Medido sobre `origin/main` = `ec7e19e64`.

**Medición en yaqu.app** (sonda S2 `prod-1716-dto.mjs`, sólo GET, con control positivo del corte de
escrituras; editor abierto con `renderAppView('quotes-new')`, y «+ Añadir descuento» pulsado). Se
comparan los estilos CALCULADOS del `<input>` del descuento con los de un campo de línea del mismo
editor:

| | borde | radio | padding | letra | color |
|---|---|---|---|---|---|
| campo de línea | 1px solid `--border` | 12px | 10px 12px | 15px | Tinta |
| descuento global, prod (390 y 1280) | **2px inset gris** | **0** | **0** | **13,33px** | **negro** |
| descuento global, con este cambio (390 y 1280) | igual que la línea | | | | |

Propiedades distintas de la línea: 8 en prod, **0** con la hoja de esta rama (a los dos anchos).
Desborde horizontal 0. Capturas: `evidencias/scrum1716/dto-global-{prod,local}-{390,1280}.png`.

**Declarado:** el paso «Conceptos» está cerrado mientras no hay cliente elegido, así que para medir
se le quitó la clase `is-cerrado` en la página, y para la captura se forzó a la vista el bloque. Eso
no cambia los estilos calculados del campo, que son lo que se compara.

**Causa:** el `<input>` cuelga de `.quote-dto-global__campo`, FUERA de `.quote-line`, y el estilo del
campo (`.quote-line input`, DESIGN.md §Inputs) sólo casaba dentro de una línea. Nunca tuvo regla
propia (`git log -S` sin resultados): el defecto viene de SCRUM-594, no es una regresión.

**Arreglo:** un selector más en la MISMA regla del campo y en su `:focus`
(`styles.css`, bloque `S2: SCRUM-1716`). No hay regla gemela, para que las dos copias no puedan
divergir. Cero textos, cero tokens nuevos, `quotesView.js` sin tocar.

**Test:** `tests/scrum1716-dto-global-con-estilo.test.mjs`, que da 3/3. Las tres mutaciones de su
catálogo tumban cada una SU test y ningún otro. Además, los 100 ficheros de test que leen
`styles.css` dan el MISMO conjunto de rojos con la hoja de main y con la de esta rama (154 = 154;
todos son de entorno, porque el worktree no tiene `node_modules` ni `dist`). Cero rojos nuevos. La
tanda completa la corre el CI.

## 1716b · Enfoque del selector €/% · DECISIÓN DE EJECUCIÓN DEL ORQUESTADOR · 12-nov-2026

El ticket propone, para que lo confirme quien construya: «el % se convierte a euros al escribirlo, y
se guarda y se firma el importe como hoy». S2 lo concretó en cinco puntos (MI LECTURA del código) y el
orquestador (sesión `cobroflash-backend-5f`, mensaje a S2 del 12-nov) los CONFIRMÓ los cinco tal cual,
como decisión de ejecución sobre la firma del ticket. No son textos ni cambian lo firmado:

- **E1 · Base del %:** la suma de líneas ya con su Dto., sin IVA, que es exactamente sobre lo que hoy
  se resta el € global (`quoteDescuentos.totalesConDescuento`, que lo reparte por tipos). Se redondea
  al céntimo.
- **E2 · Mientras el campo está en %, el € se RECALCULA** al cambiar las líneas (el 10 % sigue siendo
  10 %). Se guarda y se firma el € del momento de guardar.
- **E3 · Al reabrir** un presupuesto guardado o una plantilla, el campo está en € (el % no se guarda).
  El borrador local (`localStorage`, no la BD) sí guarda la unidad y lo tecleado.
- **E4 · No se tocan** ni el esquema, ni `calcTotal`, ni el payload (`discountGlobalAmount` sigue en
  €), ni el PDF, el portal o la firma. El campo abre en €, como hoy.
- **E5 ·** No se admite un % por encima de 100.

**Rótulos R1-R5** (selector «€» / «%», sus nombres accesibles «En euros» / «En porcentaje»,
«Equivale a 24,50 €», «El porcentaje no puede pasar de 100.»): el orquestador los ha subido a firma
del fundador. **Ninguno está aplicado.** El selector no se construye hasta que llegue esa firma, con
su literal y su localizador.

**Pendiente en este ticket (1716b):** el selector €/%. No se construye hasta que el orquestador
confirme el enfoque y estén firmados sus rótulos (regla 39). La nota de `quotesView.js:1885-1890`
(SCRUM-594) se actualiza en ese PR, citando este ticket y sin borrar la historia.

---

# SCRUM-1716b · el selector €/% del descuento global · S2 · 12-nov-2026 · rama `scrum-1716b-selector-euro-porcentaje`

**Medido contra:** `origin/main` = `8f235725590f2c984b1709a5331ff26a53f25792` · 2026-11-12T15:14:08Z

A9: comprobación → `tests/scrum1716b-descuento-global-en-porcentaje.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`. AB6: el selector es el `.segmented` del sistema (SCRUM-574), con radios de verdad, sin componente ni token ni color nuevos; dos reglas de maquetación con tokens existentes (`--muted`); el error usa `.aviso-falta-campo` + `.input-error`, que ya existían; 44 px medidos en las dos opciones; foco = el anillo del componente)

**Firma de los textos:** SCRUM-1716 c.21704 (fundador, 12-nov ~16:10, «firmo lo que dices», con su localizador). Están byte a byte: R1 «€» · R2 «%» · R3 «En euros» / «En porcentaje» (nombres accesibles de los dos radios) · R4 «Equivale a 24,50 €» (con el importe calculado, por el formateador común `fmtMoneyEs`) · R5 «El porcentaje no puede pasar de 100.». El grupo se nombra con la etiqueta que ya había, «Descuento global» (`aria-labelledby`): ningún texto más.

**Qué se construye, con E1-E5 tal como están en §1716b:**
- `quoteDescuentos.descuentoGlobalDesdePorcentaje(lineas, %)`, una función pura. **E1:** la base es la `baseImponibleCents` de `totalesConDescuento` con el global nulo (líneas con su Dto., sin IVA y sin cabeceras de apartado), redondeada al céntimo. No es una cuenta aparte. **E5:** si pasa de 100, devuelve `fueraDeRango` y ningún €.
- En `quotesView.js`, `recalcTotals` pasa a `totalesConDescuento` el € convertido. **E2:** se recalcula con cada recorrido. El envío vuelve a llamar a `recalcTotals` justo antes de leerlo, así que viaja el € del momento de guardar. Un % por encima de 100 para el envío con R5.
- **E3:** el borrador guarda la unidad (`descuentoGlobalUnidad`). Una plantilla o un duplicado reabren en €. Un borrador de antes, sin unidad, se lee en €.
- **E4:** no cambian `discountGlobalAmount` (sigue en €), el esquema, `calcTotal`, el PDF, el portal ni la firma. El campo abre en €.
- La nota de SCRUM-594 en `quotesView.js` se AMPLÍA citando este ticket. No se borra nada de ella.

**Medido en navegador** (sonda S2 `local-1716b-pct.mjs`: yaqu.app con los tres ficheros de la rama servidos en local, solo GET, con control positivo del corte; nada se guarda). Una línea de 2 × 50 € al 21 %:

| paso | total | pista | error |
|---|---|---|---|
| sin descuento | 121,00 € | — | — |
| 10 en € | 108,90 € | — | — |
| 10 en % | 108,90 € | «Equivale a 10,00 €» | — |
| precio a 100 (sigue en %) | 217,80 € | «Equivale a 20,00 €» | — |
| 150 en % | 242,00 € (sin descuento) | — | «El porcentaje no puede pasar de 100.», `aria-invalid` |
| 12.5 en %, borrador y reabrir | 211,75 € | «Equivale a 25,00 €», abre en % | — |

Igual a 390 y a 1280. Las dos opciones miden 44 px de alto. Desborde horizontal 0. Sin errores de página.

**Declarado:**
- Sin cliente elegido, el paso de Conceptos sale cerrado y se vuelve a cerrar al recalcular. La sonda le quitó `is-cerrado` 15 veces por pasada.
- «12,5» con coma no entra en un `type=number`, igual que en los demás campos del dinero del editor. Se midió con «12.5».
- La vuelta de una plantilla en € no se ha recorrido en navegador: se lee en el código.

**Tests:** `scrum1716b-descuento-global-en-porcentaje` da 6/6. Con los seis ficheros que miran el descuento o montan la vista, 42/42. `scrum697` y `scrum698` cuentan los nodos de la vista: 258 → 267, con una nota fechada que nombra los 9 nodos por identidad (`div.segmented`, 2 × `label`·`input`·`span`, y las dos `p`). Es todo el delta.

**Error propio:** la primera versión metió el «abrir el campo» en una función, y el guard de SCRUM-888c («el global se restaura detrás de un botón cerrado») cayó porque busca ese gesto dentro de `loadDraft`. Se arregló el código, no el guard (regla 41): el gesto vuelve a estar en línea en los tres sitios.