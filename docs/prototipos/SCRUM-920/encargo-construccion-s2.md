# SCRUM-920 · Encargo de construcción para la Sesión 2 (no entra en la cola hasta que lo decida el orquestador)

20-sep-2026 13:15 Z (hora de GitHub; puesta al día tras la firma de 13:22:54 Z) · `origin/main =
f2fa091bfeb8c754ab0dcba5ddb95d0ed3d987d4` · autora: Sesión 4.

El ticket lo dice: «la construcción es de la Sesión 2». Este documento es lo que la Sesión 4 le pasa. **No se construye
nada hasta que (1) el orquestador lo meta en la cola de la S2 y (2) el fundador haya aprobado el prototipo** (lo pide el
orquestador, no la S4).

## 🔴 Decisiones YA tomadas (orquestador, 20-sep-2026, SCRUM-920 comentario 15992)

1. **El alta de gasto sigue siendo MODAL**, no pantalla nueva: es lo que ya está construido y medido (el NIF de 937b vive
   ahí), y cambiarlo es rediseño total contra la norma «una pantalla o un componente por vez». Lo que decide el «en
   segundos» es el número de gestos, no el marco. Se reabre sólo si se demuestra, medido, que el modal cuesta más gestos.
   **El prototipo dibuja el alta como pantalla; la S2 construye el MISMO orden de bloques dentro del modal**
   (`openExpenseModal`, con la firma `openExpenseModal(expense, {job, onSaved})` intacta).
2. **La microcopy está FIRMADA** (firma delegada, comentario 15992), con tres cambios ya aplicados: fuera «justificante»
   («La foto del ticket», «Ver la foto»), fuera el triángulo («Sin foto») y el singular «1 gasto». **«Ver trabajo»**
   reutiliza el literal ya firmado (SCRUM-302), no «Ver el trabajo». La ficha, completa, está en
   `ficha-microcopy-DRAFT.md`: **la S2 la mueve a `docs/microcopy/2026-09-20-SCRUM-920-textos-de-gastos.md` ENTERA, en el
   ÚLTIMO PR (920f), cuando ya está todo pintado** (si entrara antes, `scrum514-aprobado-y-aplicado` se pone rojo con razón).
3. **Sigue SIN firmar:** los dos textos de lectura del ticket (SCRUM-912), aceptar PDF, y cualquier cosa del motor.

Prototipo: `docs/prototipos/SCRUM-920/gastos.html` (se abre con doble clic; la barra negra de arriba cambia de
pantalla y resalta los textos nuevos). Cuentas: `medicion.md`. Dirección: `direccion-de-diseno.md`. Textos:
`textos-propuestos.md`. Lo que hay hoy: `inventario-hoy.md`.

## 0 · Lo que se construye, y lo que NO

**Se construye:** la lista de Gastos, el detalle del gasto (no existe) y el alta, con el diseño del prototipo.
**Ningún campo del alta se retira (14), ninguna ruta ni columna cambia (cero servidor, cero esquema).**

**NO se toca, en ningún PR de esta serie:**

- **El motor del justificante** (`justificante.ts`): ni el veredicto (`deducible`, `no_deducible`, `falta_confirmar`) ni
  la lista de «qué falta», tampoco como «cuarta vía». Lo vigila `tests/scrum324-aviso-simplificado-ui.test.mjs` y
  `medir.mjs` (busca esas palabras en las tres pantallas). El detalle pinta **sólo los datos que el profesional
  apuntó**; sin ninguno, la tarjeta no existe (un «—» por cada vacío ES la lista de «qué falta» por la puerta de atrás).
- **El NIF del proveedor** y por qué no alimenta el veredicto: SCRUM-937 (S1).
- **La lectura del ticket con IA** (SCRUM-912, S1, parada): el andamio de la pestaña «Alta» del prototipo (el
  interruptor «Con lectura del ticket») **no se lleva a producción**.
- **La ruta que no valida la categoría** (SCRUM-943: servidor, PR `scrum-943-categoria-validada`, lo lleva la S4 por encargo del
  orquestador) y **SCRUM-944**, que tiene DOS puntos (leídos del ticket, 20-sep): el **punto 1** es **la clave cruda del KPI
  «Mayor categoría»** (front, **lo lleva la S2**, coordinar con ese PR); el **punto 2** es **el nombre del trabajo** (servidor,
  PR `scrum-944b-nombre-del-trabajo`, lo lleva la S4 por encargo del orquestador). 🔴 Una versión anterior de este
  documento los llamaba al revés.
- **Aceptar PDF** en la foto: ver la fila A3. No se construye sin decisión.

## 1 · Inventario fila a fila

«Hoy» = `public/dashboard/js/expensesView.js` en `origin/main f2fa091b` (líneas de ese fichero). **Texto:** F = ya
existe y está firmado (se reutiliza literal) · **P = propuesto, SIN FIRMAR** (no se pinta hasta que llegue la firma).

### La lista

| # | pieza | hoy | en el prototipo | qué hay que construir | texto |
|---|---|---|---|---|---|
| L1 | cabecera «Gastos» + frase | `:79-81` | igual | nada | F |
| L2 | tres KPI (Gasto del mes · Sin asignar · Mayor categoría) | `loadSummary` `:180-204`, rejilla auto-fit | a 390, **una** tarjeta de tres renglones (188 px, no 270); a 1280, tres | reorganizar el marcado; mismos datos y textos | F |
| L3 | selector de mes (6 meses) | `getMonthOptions` `:168` | igual | nada | F |
| L4 | filtro de categoría | `:95-98` | igual | nada | F |
| L5 | **filtro por trabajo** | no existe | `select` «Todos los trabajos» · «Sin trabajo» · un trabajo por opción | filtrar en el cliente con `item.job` (ya viaja en cada gasto, `:221`); no pedir `/admin/jobs` aquí | **P** «Todos los trabajos», «Sin trabajo» |
| L6 | **chips de la foto** | no existe | «Todos · 9» y «Sin foto · 3», con `aria-pressed` | contar los gastos con y sin `receiptData` | **P→firmado** |
| L7 | «Nuevo gasto» + atajo «N» + «⬇ CSV» | `:99-100`, `:118-129` | a 390 «Nuevo gasto» va **fijo abajo**; el CSV se queda arriba | **mantener** `atajoNuevo.etiquetar/registrar` (SCRUM-769) y `updateExportLink` (el CSV lleva mes y categoría; **decidir** si el filtro por trabajo/foto viaja: hoy no se le pasa a la ruta) | F («Nuevo gasto», «⬇ CSV») |
| L8 | cabecera del mes | no existe | «Septiembre de 2026 · 9 gastos»; con filtros, la **suma de lo que se ve** con su salvedad | pintar; **el total del mes sale UNA vez (en el KPI)** | **P** «Es la suma de lo que estás viendo, no la del mes.» y la cabecera |
| L9 | la lista | `<table min-width:600px>` dentro de `table-scroll` `:238-239`: **600 px en 366 de caja a 390**, se recorre de lado | filas en **rejilla**: a 1280, cinco columnas; a 390, tres renglones. **0 cajas que desbordan** | sustituir la tabla; **no** tocar `.table-scroll .table` global (es de otros 15 usos, ver `patron-tabla-de-lado.md`) | — |
| L10 | concepto + notas + fecha | `:253-255` | igual, sin recortar | nada | F |
| L11 | píldora de categoría | `catPill` `:11-14`, **con `style=` en línea** | mismos cinco colores (`CATEGORY_LABELS`) | mover a clases con los tokens; la norma A7 prohíbe el `style=` | F |
| L12 | **la foto en la fila** | no existe: nada dice si hay foto | miniatura + «Foto guardada», o «Sin foto» | pintar desde `receiptData`. **MEDIDO el 20-sep (`sonda-peso-lista-gastos.mjs`, ruta y servicio reales, base doblada):** la lista pide los gastos con `include` y **sin `select`**, así que trae TODAS las columnas —`receipt_data` (Text, base64) incluida— de hasta 200 filas, y no hay `compression` en `package.json`. Respuesta con foto en cada fila: **20 gastos × 0,49 MiB = 9,8 MiB · 20 × 1,5 MiB = 30 MiB · 60 × 0,49 = 29 MiB · 60 × 1,5 = 90 MiB · 200 × 1,5 = 300 MiB** (el tope de la foto es `FOTO_TECHO_DATAURI` = 1,5 MiB). **NO está medido el tamaño real de una foto guardada ni el peso en staging/producción.** Pintar miniaturas SIN cambiar la ruta empeora esto: antes de 920d hace falta que el servidor no mande la foto en la lista (p. ej. un booleano `tieneFoto` y la foto por otra ruta); el modal de edición hoy lee `expense.receiptData` de la fila de la lista (`expensesView.js:399`, `:514`), así que ese cambio toca también el front. Es **SCRUM-964** (servidor S1 + front S2, prioridad alta, abierto por el orquestador el 20-sep): **920d no debe empezar sin él** | **P→firmado** «Foto guardada», «Sin foto» (un hecho sobre el archivo, sin triángulo) |
| L13 | celda Trabajo | `expenseJobCell` `:66-72`; sin trabajo, «—» | el nombre del trabajo como en Trabajos; sin trabajo, «Sin trabajo»; el proveedor debajo | enlace a 44 px; el nombre «Presupuesto #5 · María López» es **SCRUM-944 punto 2, de SERVIDOR** (rama `scrum-944b-nombre-del-trabajo`): cuando entre, `job.titulo` ya llega compuesto con `tituloDeTrabajo` y **el front lo pinta tal cual, sin recomponerlo** (hoy `jobLabel` `:31` cae a «Trabajo»; ese respaldo queda sin uso) | «Presupuesto sin trabajo» F · «Sin trabajo» **P** |
| L14 | importe | `:262` | a la derecha, `amount` | nada | — |
| L15 | **papelera** | 🗑 de 21 × 29 px pegada a una fila que navega (`:264`), con `confirm()` nativo (`:278`) | va al **«⋯» de la fila** (hoja inferior), a 44 px, con su confirmación | usar `overflowMenu` de AB3 (`api.js:1200`); el borrado y su «¿Eliminar este gasto?» **se conservan**; el 🗑 deja de ser un botón suelto | «🗑 Eliminar» y «¿Eliminar este gasto?» F |
| L16 | las opciones del «⋯» | no existe | Editar · Ver la foto / 📷 Añadir la foto · Ver trabajo / Vincular a un trabajo · 🗑 Eliminar | cada opción tiene que **cambiar el estado al pulsarla** (es el defecto con el que se publicó 917) | **P** las tres primeras |
| L17 | tocar la fila | abre el **modal de edición** (`:251`) | abre el **detalle** de ese gasto | cambiar el destino del clic | — |
| L18 | vacío del mes | `:227-234` | **palabra por palabra** | nada | F |
| L19 | vacío de los filtros | no existe | «Ningún gasto con esos filtros» + «Quitar los filtros» | nuevo | **P** |
| L20 | carga y error | `uiSkeletonCards` `:217`, error `:273` | igual | nada | F |

### El detalle (hoy no existe)

| # | pieza | en el prototipo | qué hay que construir | texto |
|---|---|---|---|---|
| D1 | cabecera | concepto, fecha, categoría, la foto, importe; «Editar» y «Ver trabajo»; el resto en «⋯» | vista nueva. **Hay que darla de alta**: `app.js:444` (título) y `:517` (lista de vistas), y si es un fichero nuevo, la lista de `sw.js`/SHELL y los censos | «Editar» y «Ver trabajo» (**ya firmado**, SCRUM-302) |
| D2 | el justificante grande | tarjeta con la foto, «Ver a tamaño completo», «Cambiar la foto» | pintar `receiptData` | **P** |
| D3 | gasto sin foto | «De este gasto no guardaste ninguna foto.» + «📷 Añadir la foto ahora» | bloque propio | **P** |
| D4 | datos de la factura | tarjeta con **sólo los apuntados** (proveedor, NIF, nº, fecha, base, tipo, cuota); sin ninguno, **no hay tarjeta** | pintar por presencia, nunca «—» | «Datos de la factura del proveedor» **P** |
| D5 | trabajo y proveedor | enlace al trabajo; el gasto suelto lo dice y ofrece vincularlo | igual | «Sin trabajo», «Este gasto no cuenta para el margen de ningún trabajo.», «Vincular a un trabajo» **P** |
| D6 | barra fija | **ninguna** en el detalle (no repite importe ni «Editar») | nada | — |

### El alta

| # | pieza | hoy | en el prototipo | qué hay que construir | texto |
|---|---|---|---|---|---|
| A1 | contenedor | modal de 480 px (`openExpenseModal` `:293-409`), 760 px de alto a 390 | una pantalla con tres bloques y «Añadir gasto» fijo abajo en móvil | **DECIDIDO (orquestador, comentario 15992): MODAL.** Los mismos tres bloques dentro del modal, con «Añadir gasto» siempre visible (pie del modal). Lo que **no** puede cambiar: la firma `openExpenseModal(expense, {job, onSaved})` con la que el detalle del Trabajo (SCRUM-135) y el técnico dan de alta un gasto | — |
| A2 | **bloque 1 · la foto, PRIMERO** (hoy es el campo 14 de 14) | `:393-401` | «📷 Hacer foto», «Elegir foto o archivo», «Ahora no tengo el ticket»; con foto: «Foto guardada», «Verla», «Quitarla» | `input type=file` de siempre (oculto) representado por los botones; **conservar `fotoParaGuardar` y `AVISO_FOTO_NO_SE_ABRE` (SCRUM-947) sin tocar** | **P** (todos) |
| A3 | «foto o archivo» (PDF) | `accept="image/*"` `:400` | `image/*,application/pdf` | **NO construir.** `fotoParaGuardar` redimensiona con `canvas` y un PDF no se abre ahí: caería en «No hemos podido abrir esta foto». Necesita decisión de la S1 (tamaño en `receiptData`) y del fundador. Se queda `image/*` | — |
| A4 | **la frase firmada** | «…salen de los campos **de arriba**.» `:398` (SCRUM-324 E3) | «…de **abajo**.» y **entera, una sola vez**, en el bloque de la foto | **FIRMADO** (F1, comentario 15992). «de arriba» sería falso con la foto primero | F → firmado, una palabra |
| A5 | bloque 2 · qué es y cuánto | Concepto\*, Importe\* + Fecha, Categoría, Trabajo | los cinco juntos, el importe grande | reordenar; mismos `id` y mismo `payload` | F |
| A6 | «cuándo se puede parar» | no existe | «✓ Con esto ya se guarda. Lo de abajo es opcional.» | nuevo | **P** |
| A7 | bloque 3 plegado · datos de la factura | siete campos sueltos | los siete en un `<details>`: Proveedor, **NIF**, Nº, Fecha factura, Base, Tipo IVA, Cuota | mover; **`numeroONull` intacto** (un 0 escrito llega como 0, uno en blanco como `null`) | «3 · Datos de la factura del proveedor», «Opcional» **P** |
| A8 | **el NIF (SCRUM-937b, entró en `main` DESPUÉS del prototipo)** | nace bloqueado sin proveedor y dice «Elige antes el proveedor: el NIF se guarda en su ficha.»; al elegir proveedor se rellena de su ficha o se escribe; tras guardar sin proveedor sale el aviso `AVISO_NIF_SIN_PROVEEDOR` | el prototipo lo lleva desde el 20-sep (`medicion.md` §7, comprobación 43) | **conservar** `aplicarNifSegunProveedor`, el `data-origen="ficha"` y el aviso de después de guardar. **No dejar que el bloque plegado los esconda**: si el NIF está bloqueado y la ayuda dentro de un `<details>` cerrado, el aviso sigue funcionando | F |
| A9 | Notas | `:389-392` | plegadas, «Opcional» | mover | «Opcional» **P** |
| A10 | guardar y errores | `:493-565`; el error va a un banner (`showExpError`) | igual + el foco va al campo que falla | `focus()` en `exp-concept` / `exp-amount` | F («El concepto es obligatorio.», «El importe debe ser mayor que 0.») |
| A11 | editar un gasto | el mismo modal, con la foto de 120 px | el mismo alta con todo rellenado | `isEdit` sigue funcionando; la foto ya guardada se enseña en el bloque 1 | «Editar gasto», «Guardar cambios», «Guardando…» F |
| A12 | el técnico | Gastos se oculta del menú (`app.js:146-152`, SCRUM-107) pero **el alta desde el Trabajo sigue abierta** | — | probar el alta como técnico: la lista/KPI dan 403 y **no deben romper el alta** (`onSaved`) | — |

## 2 · Firmas: qué está firmado y qué NO

**Leyenda de las tablas de arriba:** «P» = texto nuevo; **desde el 20-sep está FIRMADO** (firma delegada, SCRUM-920
comentario 15992, con los tres cambios de arriba). «F» = ya existía y estaba firmado.

| # | qué | estado |
|---|---|---|
| F1 | «de arriba» → «de abajo» (texto firmado por el fundador el 10-ago, SCRUM-324 E3) | **FIRMADO** por el orquestador, comentario 15992 |
| F2 | todos los textos «P» (`textos-propuestos.md`, ya con los cambios; la ficha completa en `ficha-microcopy-DRAFT.md`) | **FIRMADOS**, comentario 15992. La ficha pasa a `docs/microcopy/` **en el PR que los pinta** |
| F3 | los dos textos de la lectura del ticket («Hemos leído el importe y la fecha…», «leído de la foto») | **SIN FIRMAR**: los firma quien firme **SCRUM-912**. No se construyen |
| F4 | aceptar PDF en la foto | **SIN DECIDIR** (S1: tamaño; fundador). Se queda `image/*` |
| F5 | la aprobación del prototipo entero | **PENDIENTE** del fundador, la pide el orquestador. No se empieza sin ella |
| F6 | cualquier frase sobre deducibilidad, «qué falta» o veredicto | **no se propone**: espera al asesor (SCRUM-324 E3) |

⚠️ **Un texto de la lista que NO está firmado y que el prototipo ya no pinta:** «N gastos de M» (la cuenta con filtros).
Se quitó del prototipo el 20-sep: los chips ya dicen cuántos hay. Si la S2 lo quiere, hay que pedir su firma.

## 3 · Orden sugerido (un ticket, una rama, un PR: A17) y lo que vigila

1. **920c · la lista sin tabla**: rejilla, «⋯» con 44 px, KPI compactos, «Sin trabajo». Es el que quita el desborde a 390.
2. **920d · la foto en la lista y los filtros** (L5, L6, L8, L12, L19): depende de medir el peso de la lista (L12).
3. **920e · el detalle** (D1-D6).
4. **920f · el alta dentro del modal** (A2-A12): con F1 firmado; sin PDF (F4) y sin lectura (F3).

**La ficha (`ficha-microcopy-DRAFT.md` → `docs/microcopy/2026-09-20-SCRUM-920-textos-de-gastos.md`) entra ENTERA en el
ÚLTIMO PR (920f), no partida** (decisión del orquestador, 20-sep). Motivo: `scrum514-aprobado-y-aplicado` comprueba una sola
dirección —que todo «Texto aprobado» que esté en `docs/microcopy/` esté pintado en el código—. Pintar antes de que exista
la ficha no lo dispara; meter la ficha antes de pintar, sí. Así que en 920c, d y e **no hay ficha**, y entra cuando ya está
todo pintado. La firma va citada por su NÚMERO (comentario 15992), no por la hora.

🔴 **Corrección de la S4 (20-sep):** `scrum302-rotulos-completos` **NO aplica a Gastos**: sólo lee
`albaranDetailView.js` (`mk('btnX')` contra `ROTULOS_ALBARAN`). Los botones nuevos de Gastos **no** entran ahí. Lo que
SÍ vigila lo nuevo es `scrum514-aprobado-y-aplicado` (todo texto aprobado, pintado), el guard del marcador sin aprobar
(SCRUM-402) y `scrum324-aviso-simplificado-ui`.

**Guards que ya miran `expensesView.js`** (13 tests: `grep expensesView tests/`), y que un cambio de estas piezas
moverá o pondrá en rojo: `scrum324-aviso-simplificado-ui` (nada de veredicto en pantalla), `scrum769-*` y `scrum768-*`
(el atajo «N»), `scrum777-*` (el modal escondido no mata la «N»), `scrum436-*` (un solo formato de euros),
`scrum644-*` (mensaje crudo), `scrum628-*` (cobertura visual), `scrum748-*`, `scrum271-*`, y los censos `_censo-*`
y `_banco-vistas`. **Lo he deducido de los nombres de fichero, no he leído esos tests.** Y es probable (no medido) que
quitar la tabla ancha de Gastos **baje** el trinquete de tablas (`scrum524b-trinquete-de-la-tabla`): un trinquete que
baja hay que anotarlo, no borrarlo.

**Cómo se mide cada PR** (`medir.mjs` es del prototipo; la pantalla real se mide con el banco de la casa): a **390 y
1280**, 0 scroll horizontal (también dentro de la lista), 0 controles < 44 px, **y pulsando**: cada opción del «⋯»
cambia el estado, el chip filtra, la foto se hace y se quita. *Una captura bonita no prueba que el botón funcione.*

## 4 · Para enseñárselo al fundador (lo pide el orquestador, no la S4)

**Qué ve el profesional, hoy frente a la pantalla nueva** (sin jerga):

Hoy, para apuntar un gasto hay que rellenar un formulario largo y la foto del ticket es lo último que se pide; en la
lista no se ve qué gastos tienen su foto, y en el móvil la tabla se sale de la pantalla y hay que arrastrarla de lado
para ver el importe. En la pantalla nueva **lo primero que se hace es la foto del ticket**, con el papel todavía en la
mano; después sólo hacen falta el concepto y el importe, y una línea avisa de que con eso ya se puede guardar. La lista
muestra en cada gasto si tiene foto (con una miniatura) o le falta, y se puede filtrar por «sin foto» y por trabajo; en
el móvil cada gasto cabe entero sin arrastrar y la papelera ya no está pegada al gasto, así que no se borra por
accidente. Y por fin se puede **abrir un gasto para leerlo**, con su foto grande, en vez de caer siempre en el
formulario de edición.

**Dónde están las capturas** (carpeta `docs/prototipos/SCRUM-920/capturas-prototipo/`, ventana entera y ventana normal):
`390-1-lista.png` · `390-2-alta.png` · `390-4-detalle.png` · `390-5-detalle-sin-foto.png` y las mismas a 1280
(`1280-1-lista.png`…). La pantalla de hoy, para comparar: `capturas/390-lista-18sep.png` y `capturas/1280-lista-18sep.png`.
**El prototipo vivo** es `gastos.html` en esa misma carpeta de la rama `scrum-920b-prototipo-gastos`: se puede tocar.

**Lo que hay que decirle sin rodeos:** (1) una palabra de un texto que él firmó cambia («de arriba» → «de abajo»);
(2) no se enseña nada sobre deducibilidad ni sobre «qué le falta» al justificante; (3) lo de leer el ticket con IA está
dibujado como hueco y no existe; (4) aceptar PDF queda propuesto, no decidido.

## 5 · Lo que la S4 no ha mirado

- El peso real de `/admin/expenses` con fotos (L12).
- Si algún guard de `sw.js`/SHELL obliga a registrar la vista nueva del detalle (D1): se sabrá al construirla.
- ~~Qué es exactamente el «punto 1» de SCRUM-944~~ → **resuelto el 20-sep leyendo el ticket**: punto 1 = el KPI con la clave cruda
  (S2, front); punto 2 = el nombre del trabajo (servidor, S4). Ver §0.
- ~~El peso de `/admin/expenses` con fotos (L12)~~ → **medido el 20-sep** (fila L12): el mecanismo sí; el tamaño real de una foto guardada y el peso contra staging, no.
