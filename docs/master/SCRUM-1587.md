# SCRUM-1587 · el botón «Enviar de nuevo» del aviso de correo fallido de Cobros, a 44 px de toque

**Medido contra:** `origin/main` = `391212830da7698fed4bccf1da95f668292710ee` · 2026-10-23T13:38:55Z (hora de GitHub al escribir: 2026-10-23T13:42:32Z)
A9: comprobación → `tests/scrum1587-reenviar-correo-cobros-44.test.mjs`
**Skill UI:** cargada · antes de tocar `styles.css` (`yaqu-premium-ui`, con DESIGN.md §5 Buttons leído: `btn-sm` se queda en 30 a la vista a propósito)

Puesto J2 (`jv-j2af`) · rama `scrum-1587a-reenviar-correo-44`. Encargo del orquestador del equipo de Javier
(`cobroflash-backend-62`). Sale de SCRUM-1583 (c.20496 y c.20499, `jv-j2ad`). El hook de arranque dijo «SIN IDENTIDAD»
(SCRUM-1498); el puesto lo da el encargo, y se dice aquí.

## PASO 0

Sin commits en `origin/main` con «SCRUM-1587», sin rama `scrum-1587*` en el remoto (control positivo: 112 ramas
`scrum-` sí salen) y sin `docs/master/SCRUM-1587.md`. Jira: descripción leída entera, **0 comentarios**; etiquetas
`ab6`, `area-j2`, `equipo-javier`. **Corriendo, no leyendo:** el instrumento de 1583 con `--con-aviso`, sobre `fbf9701d1`,
dio el botón a **30,7 / 30,7 / 30,9** px de toque a 320 / 390 / 1280. El defecto existía hoy.

## Carril

`node scripts/carriles.mjs de public/dashboard/js/cobrosView.js` → **J2** (`dos-equipos.md:144`) ·
`… de public/dashboard/css/styles.css` → **S2 (contenedor)** (`dos-equipos.md:150`): bloque nuevo marcado
`── J2 · SCRUM-1587 ──`, pegado debajo del de SCRUM-1583, sin quitar ninguna línea ajena. `cobrosView.js` **no se toca**.
`… de scripts/_datos-del-censo.mjs` → **S3**: el contrato del censo no se toca (ver «Lo que no arreglo»).

## El arreglo

```css
td.cell-id [data-correo-no-salio] > button { position: relative; }
td.cell-id [data-correo-no-salio] > button::before { content: ""; position: absolute; inset: -8px 0; }
```

- **Ancla sin clase nueva:** `[data-correo-no-salio]` sólo lo pone `avisoCorreoNoSalio` (`cobrosView.js`). Ni marcado
  nuevo, ni texto nuevo, ni estilo en línea nuevo (regla 4). `.btn-sm` global no se toca (SCRUM-786, opción ③).
- **Por qué `::before` y no `min-height`:** DESIGN.md §5 deja `btn-sm` en 30 px a la vista a propósito, y el ticket pide
  sólo toque. El `::before` crece el área que recibe el toque sin mover nada: la fila mide lo mismo y las capturas salen
  idénticas (abajo).
- **Por qué 8 y no 7:** el `::before` se ancla a la caja de RELLENO y `.btn-secondary` lleva 1 px de borde. Con `-7px`
  el instrumento midió **43** en las tres anchuras (fallo propio, abajo); con `-8px`, 45.

## Medición en Edge (`docs/master/evidencias/SCRUM-1587/medir.mjs`)

Población declarada: las filas del contrato de `/admin/cobros` con `invoiceId` (1), a las que el instrumento le pone
`correoNoSalio` sólo para medir. Por anchura: 1 botón y 1 enlace (el de SCRUM-1583, en la misma celda).

| anchura | antes (caja · toque) | después (caja · toque) | fila (con semilla) | enlace de 1583 (toque) |
| --- | --- | --- | --- | --- |
| 320 | 30 · 30,7 | 30 · 45 | 211,7 = | 45 = |
| 390 | 30 · 30,7 | 30 · 45 | 211,7 = | 45 = |
| 1280 | 30 · 30,9 | 30 · 45 | 167,9 = | 47 = |

Controles, todos corridos:

- **Semilla** (botón `btn-secondary btn-sm` sembrado en la misma celda FUERA del aviso, que la regla no alcanza): sale
  corta, 30,7 / 30,7 / 30,9, en las tres anchuras — demuestra también que la regla no es `.btn-sm` a secas.
- **`--sin-semilla`:** CIEGO en las tres, salida 2.
- **`--mutar`** (regla anulada con una hoja inyectada): vuelven 30,7 / 30,7 / 30,9, salida 1.
- **`--captura`:** la fila con y sin la regla, **3 de 3 idénticas byte a byte** (10.777 / 10.962 / 11.447 B), con la
  captura repetida idéntica (determinismo) y el `::before` pintado DISTINTO (el comparador ve).
- **El instrumento de 1583** (`--con-aviso`) sigue en verde, salida 0, y su columna del aviso pasa de 30,7 / 30,7 / 30,9
  a 45 / 45 / 45.

## Censo y guards de navegador

`npm run censo:tactil-panel` (salida 0): Cobros **7 medidos · 0 cortos** a 929 y a 390, igual que antes, y los distintos
bajo 44 siguen en **71**: el censo **no ve** este botón, porque su contrato trae `correoNoSalio: null`. Este arreglo no
mueve su número, y por eso la medición de arriba es la única que lo ve. `guard:objetivo-tactil` (salida 0): 0 hallazgos ·
0 ciegos; `guard:lista-trabajos` (salida 0) en verde. Ninguno de los dos vigila Cobros.

## El test (corre en cada PR)

`tests/scrum1587-reenviar-correo-cobros-44.test.mjs`, 2 casos: la regla y su `inset` (con el borde descontado:
30 − 2 × 1 + 2 × N ≥ 44), y que Cobros, con `correoNoSalio` puesto en la fila, pinta el botón hijo directo de
`[data-correo-no-salio]` dentro de `td.cell-id`. Mutaciones, las cinco lo tumban (1 de 2 cae en cada una):
sin el `::before` · `inset: -7px` (el 43 medido) · sin `position: relative` · sin el aviso sembrado (CIEGO) · el botón
envuelto en un `span` en `cobrosView.js`. Base sin mutar: 2 de 2.

## Lo que no arreglo

- **El contrato del censo** (`scripts/_datos-del-censo.mjs`, carril **S3**) trae `correoNoSalio: null` en su única fila de
  Cobros, así que `censo:tactil-panel` nunca pinta este aviso. Ponerle un aviso en la fila cambiaría la fila que miden
  otros (el enlace de 1583, el censo de toda la vista): es decisión de su dueño. Queda nombrado para S3; la medición
  vive aquí y en el test de arriba.

## Sin medir

- yaqu.app: no está mergeado al escribir esto.
- La matriz de dispositivos real (V0-5).
- Qué hace el botón al pulsarlo con el área ampliada: el `::before` es hijo del botón, así que el clic le llega a él;
  medido sólo con `elementsFromPoint`, no con un clic.

## Fallos propios

- Escribí `inset: -7px` contando 30 + 2 × 7 = 44 sin mirar que el `::before` se ancla al relleno y el botón lleva 1 px de
  borde. El instrumento dijo 43 en las tres anchuras; una sonda con `elementsFromPoint` en los bordes lo explicó. Lo
  ataja el test: su cuenta descuenta el borde y la mutación `-7px` lo tumba.
