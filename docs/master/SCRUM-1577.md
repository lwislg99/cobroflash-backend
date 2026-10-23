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

## Sin mirar / pendiente (no es cero)

- **Los campos de cada cláusula** («Título», «Texto»: `input` y `textarea` nativos con `style="width:100%"`) se ven bajos en la captura y **no los he medido**. Mismo bloque, mismo carril; piden clase de campo de la casa + CSS → mismo bloqueo que los `select`.
- Los `select` y el color: **esperan a 962f** (arriba).
- yaqu.app: producción congelada; ver a 390 y 1280 cuando se descongele.
