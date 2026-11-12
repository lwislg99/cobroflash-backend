# SCRUM-1716 · Descuento global en € o en % + la casilla sin estilo

Ticket (Jira): decisión del fundador del equipo J del 12-nov-2026, «El descuento global sí que se pueda
elegir euros o %», y defecto visto en su captura: la casilla «DESCUENTO GLOBAL» sale sin estilo.
Carril S2 (`quotesView.js`, `quoteDescuentos.js`, `styles.css`). Encargo del orquestador: c.21652
(primero la casilla; el selector €/% espera a confirmar el enfoque y a la firma de sus rótulos).

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

**Pendiente en este ticket (1716b):** el selector €/%. No se construye hasta que el orquestador
confirme el enfoque y estén firmados sus rótulos (regla 39). La nota de `quotesView.js:1885-1890`
(SCRUM-594) se actualiza en ese PR, citando este ticket y sin borrar la historia.
