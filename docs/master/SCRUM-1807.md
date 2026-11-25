# SCRUM-1807 · apartados del presupuesto

## SCRUM-1807e · el apartado en el EDITOR (S2, 25-nov-2026)

**Medido contra:** `origin/main` = `724f33f69039a1f6de55f4ea3cde791790b110bb` · 2026-11-25T14:29:46Z
A9: comprobación → `tests/scrum794-un-solo-anadir-linea.test.mjs`
A9: comprobación → `tests/scrum632-los-dos-cortes-de-la-linea.test.mjs`
Mutaciones: catálogo → `tests/scrum1807e-editor-apartados.test.mjs`

Puesto S2. Rama `scrum-1807e-editor-apartados`. Skill `yaqu-premium-ui` cargada antes de tocar la pantalla. Ficheros: `public/dashboard/js/quotesView.js`, `public/dashboard/js/quoteApartados.js` y `public/dashboard/css/styles.css`, los tres del carril S2.

**Decisiones y textos.** SCRUM-1786 c.22269 firma P2 (el «Salón» es el apartado que ya existe, SCRUM-655), P3 (el modo se elige por apartado) y los literales «Total del apartado», «Mostrar al cliente:», «Desglosado», «Agrupado» y «Varios». SCRUM-1656 c.22787 firma la opción A y el botón «+ Añadir apartado». El orquestador precisó dónde va «Varios»: en la COLUMNA de IVA, sólo en agrupado; con un único tipo, ese tipo («21 %»: es un valor, no un texto). El resto de rótulos ya existían en esta pantalla: «Concepto», «Descripción», «↑  Subir», «↓  Bajar», «🗑️  Eliminar línea», «Acciones de la línea» y «Arrastra para reordenar». No hay ni un texto más.

### Lo medido antes de construir (la premisa estaba rota)

El ticket decía «editor: descripción, subtotal y selector». **El editor no tenía apartados.** `quotesView.js` sólo nombraba la marca en un comentario («este editor no crea cabeceras»), y en `src/` sólo la conoce la puerta (`schemas.ts`). Ninguna pantalla creaba una cabecera, y las que llegaban por la API se perdían al duplicar (BUGS.md, entrada SCRUM-1807e). Se paró y se preguntó. **Opción A** (elegida): firmar el botón y construir el tramo entero. Descartadas: **B**, conservar y pintar sin poder crear, que deja la pantalla sin uso porque ninguna cabecera nace en la UI; y **C**, aparcar el tramo, que deja vivo el defecto de duplicar.

### Qué hace

| pieza | dónde | qué |
|---|---|---|
| «+ Añadir apartado» | `quotesView.js` | secundario, detrás de «+ Añadir línea». La cabecera nace al final de la lista y el foco va a su concepto. No sale en el documento suelto, cuyo emisor no lleva cabeceras |
| la cabecera | `addApartado` | una tarjeta `.quote-line--apartado` de la MISMA lista y la MISMA rejilla que una línea, así que Subir, Bajar, el arrastre y `syncLinesOrder` la mueven sin saber nada de ella. Lleva concepto, el selector «Mostrar al cliente:» (sin la clave = Desglosado, como en SCRUM-1807d), la columna de IVA, «Total del apartado», «⋯» y la descripción a todo lo ancho |
| el total | `resumenDeApartados` (pura) | la suma de lo que ENSEÑA cada fila del editor, CON IVA (c.22389: «cada vista suma como sus líneas»). Ninguna cuenta nueva: las cifras entran ya hechas |
| la columna de IVA | `ivaDelApartado` (pura) | en agrupado, «Varios» si sus líneas llevan varios tipos y el tipo si sólo llevan uno. En desglosado queda vacía, pero el hueco se conserva (como `.is-de-siempre`, SCRUM-915h). Un renglón en blanco no aporta su tipo |
| lo que viaja | `cabeceraParaPayload` (pura) | `{concept, apartado: true}`, más `description` y `agrupado: true` sólo si los hay (ausente ≠ vacío). Con «Incluir descripción en el PDF», la descripción va además pegada al concepto, como en una línea (SCRUM-603) |
| conservar | `addLine`, borrador, «Guardar plantilla», `cargarPlantilla` | `addLine` despacha a `addApartado` si llega `apartado: true`. Eso cubre «Duplicar», el borrador, las plantillas y la IA |
| lo que NO cuenta una cabecera | `lineasQueCobran()` | la propuesta de descuento pactado, la vista previa, «Continuar», «al menos una línea válida», el documento suelto y el suelo de «Eliminar línea». Si se borra la última línea que cobra y quedan cabeceras, nace un renglón en blanco: nunca queda una lista de sólo títulos |

Quitar una cabecera NO borra sus líneas: pasan al apartado de arriba, o a ninguno.

### Capturas (yaqu.app, cuenta QA, mis tres ficheros servidos por interceptación; datos de EJEMPLO)

Guion: `docs/master/evidencias/SCRUM-1807/captura-1807e-editor.mjs`. Medida: `captura-1807e-medida.json`. Fotos: `captura-1807e-editor-390.png`, `-1280.png` y `-1920.png`. Las escrituras se interceptan: la única fue `POST /admin/entorno`, que no llegó a prod. Errores de página: 0. Desborde lateral: no, en los tres anchos.

| ancho | «Varios» (caja) | chip «IVA 10 %» de una línea (caja) | Total del apartado |
|---|---|---|---|
| 390 | 46 · 298 × 44 | 46 · 298 × 44 | 231,00 € y 12.099,99 € |
| 1280 (el editor mide 544 px: va plegado) | 306 · 518 × 44 | 306 · 518 × 44 | igual |
| 1920 (fila única) | **853 · 168 × 44** | **853 · 168 × 44** | igual |

**La columna de IVA cuadra al píxel con la del chip en los tres anchos.** Lo enseñaron las capturas, en tres vueltas, y no la lectura del código:
1. Con el paso «Conceptos» CERRADO, «+ Añadir apartado» asomaba en su cabecera. Se añadió a la lista `.quote-paso.is-cerrado … { display: none }`. La captura lo mide (`botonConPasoCerrado: false`).
2. A 1920, «TOTAL DEL APARTADO» ensanchaba su columna y la fila corría 18 px. Ahora tiene un tope de 96 px, sólo en la fila única.
3. Después se pasaba 28 px al otro lado, porque le faltaba el asa «⠿» que tiene la línea. Se le puso (la misma pieza y el mismo texto), y de paso la cabecera se arrastra.

### El test (`tests/scrum1807e-editor-apartados.test.mjs`)

El banco de vistas monta el editor de verdad, lee lo que pinta y captura el cuerpo del POST /quote/create. Ocho casos: «Duplicar» conserva las dos cabeceras con su modo y su descripción · rótulos firmados, ni una coma más · el total suma lo que enseñan las filas · «Varios», el tipo único, y nada en desglosado · el POST lleva las cabeceras en su sitio · CONTROL: sin apartados, el POST no lleva ninguna clave nueva · «+ Añadir apartado», con el borrador que la guarda y la devuelve · las piezas puras.

**Rojo primero:** sobre los tres ficheros de `origin/main`, 1 de 8. El que pasa es el control. Con el cambio, 8 de 8.

**Mutaciones** (`correr` + `aplicarUna`, base limpia 8 / 0 / 0): **6 de 6 CAEN**. Son: sin el despacho de `addLine` · la cabecera sale del POST · «Varios» se cambia por la lista de tipos · el total no suma · el borrador pierde el modo · `agrupado` no viaja.

### Vecinos (tanda dirigida: 203 ficheros que nombran el editor, la pieza o la hoja)

Primera pasada: 1.745 de 1.755, con 9 caídos. Se arregló el CÓDIGO, nunca un aserto (regla 41):
- `scrum229`: un segundo `lines.forEach` en `recalcTotals`. Las cabeceras se apuntan en el mismo recorrido y se pintan después, desde su propia lista.
- `scrum632`: su ancla de texto («appendChild» de la descripción de la LÍNEA) encontraba antes la de la cabecera. La variable de la cabecera se llama ahora `descApartadoTd`, y el comentario ya no repite el ancla.
- `scrum794`: su suelo se lee con la línea literal `if (lines.length === 1) {`. Se queda intacta, y el caso de las cabeceras va en una rama aparte, delante.
- `scrum697` y `scrum698`: cuentan los nodos que monta el editor, y hay uno más, 267 → 268. **Re-anclados por IDENTIDAD**, con su línea fechada, igual que 1716b, 1144 y 1180: es el `button.quote-add-apartado`. Sin cabeceras no se monta nada más.
- `scrum1340`: pedía este registro con la skill declarada. Es éste.

Después, los cinco ficheros y el nuevo, en verde. 🔴 La tanda dirigida corrió con el `dist/` de antes de regenerar el cliente de Prisma (el orquestador lo regeneró a mitad). Esos 203 ficheros no los he vuelto a correr enteros: los seis que cayeron sí. La suite entera la corre el check obligatorio.

### Lo que NO hace, y queda declarado

- **La vista previa** («Así lo verá el cliente») no pinta los apartados: sigue enseñando las líneas que cobran. Sería un quinto sitio que agrupa (PDF, firma, portal, editor) y no está en este tramo.
- **La puerta del servidor** conserva `agrupado` desde el tramo d de S1 (#3446, aún OPEN a las 14:30Z). Sin él, `z.object` borra la clave en silencio. El test mide la mitad del front: que el cuerpo la lleve.
- **En móvil, «Varios» va solo.** Sin la palabra «IVA» delante, como sí la lleva el chip de una línea («IVA 10 %»). Ponérsela sería texto nuevo, así que lo dejo como observación para el fundador.
- No se ha visto en yaqu.app con la rama en `main`: eso es la r42, después del merge.
