# SCRUM-1799 · T4 de SCRUM-1787, las filas que quedan de c.22426: ninguna pide «igualar», y lo que dicen se comprueba sobre PDF reales

**Medido contra:** `origin/main` = `f8dc0244675d00709b896101b97c89bd22468923` · 2026-11-24T02:29:41Z (cabecera `Date:` de `gh api -i zen`)

A9: comprobación → `tests/scrum804-la-rama-viva.test.mjs`

La cicatriz va también a `docs/equipo/cicatrices/J1.md`: «Un tramo tiene UNA letra: a la 27ª, hijo nuevo». El encargo dictaba la línea como `aviso → cicatriz … — comprobación: …`, que no es ninguno de los cuatro formatos de la A9 (lo tumbó `scrum1294`); como sí hay comprobación, va la primera forma.

Mutaciones: catálogo → `tests/scrum1799-pdf-factura-filas-restantes.test.mjs`

Nació como tramo 1787aa (#3345, 49ab537e7); renombrado por SCRUM-1799 porque 1787 agotó las letras. Entrega original de jv-j1ir: SCRUM-1787 c.22474. El renombrado lo hizo jv-j1iz (encargo del orquestador J, 24-nov-2026): `git mv` del test a `tests/scrum1799-pdf-factura-filas-restantes.test.mjs`, «SCRUM-1787aa» → «SCRUM-1799» en sus nombres de test y en este tramo, que sale de `docs/master/SCRUM-1787.md`. Por qué: `scripts/_numero-de-rama.mjs` admite UNA letra de tramo, así que la rama `scrum-1787aa-…` no tiene número para el censo y `tests/scrum804-la-rama-viva.test.mjs` pone en rojo el obligatorio de todos los PR mientras exista. Regla 41: no se toca el guard. La rama remota `scrum-1787aa-…` y #3345 siguen ahí: borrarlas es del fundador. Contenido del test: idéntico al de 49ab537e7 salvo esos nombres.

Encargo del orquestador J a jv-j1ir (J1): las filas 3, 4, 11, 12, 14, 15, 16, 17, 18 y 20 de la tabla de SCRUM-1787 c.22426 (1787w construyó la 1, 2, 5-10, 13 y 19). GO regla 40: c.22416. Literales firmados: c.22428. Rama sobre `scrum-1787w-pdf-factura-construido` (PR #3337, aún sin mergear al empezar).

## Qué decía la tabla, fila a fila, y qué se hizo

Ninguna de las diez filas dice «igualar»: no hay cambio de `src/`, ni texto nuevo, ni se toca `drawTableHeader`/`pintarTotalDelApartado`. Lo que sí hay es el riesgo de que el dibujo nuevo de 1787w haya movido algo que la tabla manda dejar igual. Eso se comprueba con PDF fabricados con los mismos datos que 1787v/1787w.

| fila | c.22426 dice | estado | dónde se ve |
|---|---|---|---|
| 3 · nº, fecha, vencimiento | NECESARIA, se queda igual | ya igual: «Nº», «Fecha:», «Vence el» siguen, en orden, a la derecha, entre el título y «Emisor:» | test ③④ |
| 4 · formas de pago | NECESARIA, se queda igual | ya igual: «Formas de pago:» sigue detrás de «Vence el» | test ③④ |
| 11 · dto de línea | NO, pero es el DATO; fuera de T4 | no aplica: la factura no guarda el dto (`facturaSuelta.ts:237`, según c.22426; no releído) | — |
| 12 · «Total del apartado» | no se inventa | no aplica: las cabeceras no llegan a la factura (1786b) | — |
| 14 · Observaciones | igual | ya igual: rótulo y texto con la misma x y la misma separación vertical en los dos PDF | test ⑭ |
| 15 · cláusulas | necesita dato congelado; fuera de T4 | no aplica: la factura no pinta cláusulas (control: el presupuesto sí) | test ⑮ |
| 16 · firma y evidencias | NECESARIA, solo presupuesto | no aplica | — |
| 17 · QR y leyenda VeriFactu | NECESARIA con SIF, se queda igual | ya igual: con sello (datos FABRICADOS) salen QR, leyenda, «VERI*FACTU — …» y huella; sin sello, nada | test ⑰ |
| 18 · marca de agua demo | NECESARIA, se queda igual | ya igual: con `DEMO_WATERMARK` se pinta; sin ella, no | test ⑱ |
| 20 · fuente y páginas | igual | ya igual: solo Helvetica (las mismas variantes en los dos) y sin numerar | test ⑳ |

Ninguna fila NO HECHA. El PDF del presupuesto no cambia: no se tocó `src/`, y el ④ de 1787w (huella de texto y posiciones) sigue en verde.

## Mutaciones

Cuatro, una por fila comprobada con código propio, pasadas por `aplicarUna` (scripts/meta-guard-mutaciones.mjs), una por proceso: «Formas de pago» separada de «Vence el» tumba ③④ (+1 colateral); Observaciones desplazadas 8 pt tumba ⑭; sin la leyenda VERI*FACTU tumba ⑰; sin `drawWatermark()` tumba ⑱. Las cuatro VIVAS; `git status` limpio tras cada pasada.

## Errores míos

- Mi primer test pedía UNA imagen para el QR: el PNG lleva su máscara y son dos objetos. Y pedía la marca de agua en una línea: a 42 pt se parte en dos. Los dos rojos eran del test, no del PDF; los corregí midiendo.
- Mi primer driver de mutaciones pasaba la ruta con `tests/` y `correr` la duplicaba: la pasada limpia salió «0 pasados · 1 caído» y `aplicarUna` dijo CIEGO sin mutar. Lo vi por el CIEGO, no por suerte.
- La cabecera de mi test decía «de las 20 filas»: `scrum737` (cifra sin ancla) la tumbó en la pasada de los cinco de árbol entero. Cambié mi texto, no el guard.

## NO hecho / NO visto

- La suite entera NO se corrió en local (el encargo lo pide así): la corre el check obligatorio del PR.
- Captura lado a lado: no la rehice; no cambia nada que se vea respecto a la de 1787w (`1787w/lado-a-lado.png`).
- yaqu.app: no visto; esta rama solo añade un test.
- Nada contra staging ni producción.
