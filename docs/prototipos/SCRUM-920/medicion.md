# SCRUM-920 · Medición del prototipo

Chromium local (puppeteer-core), `file://`, 18-sep-2026, rama `scrum-920b-prototipo-gastos` sobre
`origin/main = 16733a223b3d09d3fdf03bf03c67a2b278b4906c`. Instrumento: `medir.mjs` (se vuelve a correr con
`node docs/prototipos/SCRUM-920/medir.mjs --capturas docs/prototipos/SCRUM-920/capturas-prototipo`). Capturas en
`capturas-prototipo/` (ventana y página entera).

| Anchura | Errores de consola | Scroll horizontal de la página | Cajas que desbordan (también dentro de la lista) | Controles < 44 px | Frases vetadas |
|---|---|---|---|---|---|
| 1280 × 900 | 0 | no | **0** en las 4 pantallas | **0** | **0** |
| 390 × 844 táctil | 0 | no | **0** en las 4 pantallas | **0** | **0** |

**Resultado: TODO EN VERDE, 42 comprobaciones de comportamiento por anchura, 0 rojos** (18-sep; el 20-sep son 43 —§7—
y la pestaña de inventario queda «no medida» en controles y cifras).

## 1 · El instrumento, y por qué hay que creerle

- **Pulsa y mira el ESTADO después.** Cada comprobación de comportamiento pulsa y pregunta por una consecuencia
  observable: cuántas filas quedan, qué dice el aviso, dónde está el foco, si la hoja sigue abierta. Las cuatro
  opciones del «⋯» se pulsan una a una (el defecto con el que se publicó 917).
- **Pulsa como un dedo**, no con `el.click()`: lleva el blanco al centro de la ventana, pregunta con
  `elementFromPoint` qué hay ENCIMA y hace clic en esas coordenadas. Si otro elemento lo tapa, lo apunta. Lo destapó
  el borrador: a 390 el chip «Sin foto» «no filtraba», y lo que pasaba es que **la barra fija de abajo lo tapaba**.
  Hoy: **0 blancos tapados**.
- **Tres controles positivos que tienen que DISPARAR** antes de fiarse de un cero: se siembra una caja de 600 px en
  una de 200 con scroll, un botón de 20 × 20 y la frase «este gasto es deducible»; el detector tiene que ver los tres,
  y los ve en las dos anchuras. Si no, el informe dice CIEGO y cuenta como rojo.
- **El `€` va escrito `€`**: pasado por PowerShell el carácter se corrompe y el contador de cifras deja de ver
  ninguna (medido en 917). Población en cada pantalla: 22 controles y 11 cifras en la lista, 21 y 0 en el alta, 7 y 3
  en el detalle — un cero de controles pequeños sobre 22 controles vistos no es ceguera.
- **Las frases vetadas** (veredicto del motor, «le falta», «deducible», «desgrava»…) se buscan en lista, alta y
  detalle. La pestaña de inventario no cuenta: DESCRIBE lo que no se puede decir.

## 2 · El borrador que se encontró, medido antes de tocarlo

La tanda de la noche del 17-sep murió dejando `gastos.html` y `medir.mjs` **sin commitear** en `wt-scrum-902`.
Nadie sabía que existían. Se midieron con su propio instrumento antes de tocarlos: **8 rojos**.

| rojo del borrador | qué era | arreglo |
|---|---|---|
| Inventario a 390: la página se recorre de lado (634 > 390) | la fila que describe el defecto, `<table style="min-width:600px">`, iba sin escapar a `innerHTML` y **creaba una tabla de 600 px de verdad** dentro de la celda | lo que va entre comillas invertidas se escapa como `<code>` |
| Chip «Sin foto» no filtra a 390 | la barra fija lo tapaba y el clic se lo llevaba ella | la barra fija de la lista sólo lleva «Nuevo gasto»; el instrumento ahora detecta blancos tapados |
| 13 campos en el alta, no 14 | la foto eran botones sin su `input` de fichero | el input de hoy vuelve, oculto, y los botones lo representan |
| Miga «Gastos» de 39 × 44 px (alta y detalle) | ancho mínimo | 44 px |

Y cuatro defectos que el instrumento del borrador **no miraba**:

| defecto | medida | arreglo |
|---|---|---|
| El total del mes, repetido | **3 veces** en la primera pantalla de 390 (KPI, cabecera del mes y barra fija) | **1** (medido) |
| El detalle de la Gasolina pintaba **6 «—»** bajo «Datos de la factura del proveedor» | es la lista de «qué le falta» del motor por la puerta de atrás | sólo los datos apuntados; sin ninguno, no hay tarjeta (medido: 0 datos, 0 guiones) |
| `alt="${P('…')}"` en tres imágenes | el `<span>` del subrayado dentro del atributo cerraba sus comillas | `alt` en texto plano |
| Datos de ejemplo de los 4 gastos reales, inventados | proveedores, fechas, categorías y nombre del trabajo no eran los de staging | los de la base de staging (SELECT del 18-sep) |

## 3 · Antes → después, con las cuentas

| | hoy en staging (18-sep) | en el prototipo |
|---|---|---|
| Caja de la lista que se recorre de lado a 390 | **600 px de contenido en 366 de caja** | **0 cajas que desbordan** |
| Controles < 44 px (sin el menú lateral) | **10** a 1280 · **9** a 390 (17-sep) | **0 · 0** |
| La papelera de cada fila | 21 × 29 px, pegada a una fila que navega | en el «⋯», a 44 px, con su confirmación |
| ¿Se ve si el gasto tiene su foto? | **no**, en ninguna columna | **sí**, en cada fila: miniatura + «Foto guardada», o «Sin foto»; y un chip «Sin foto · 3» |
| Posición de la foto en el alta | campo **14 de 14** | **la primera**: a 390, la foto en y=437 y el concepto en y=849 |
| Campos del alta | 14 | **14** (ninguno se retira) |
| «Añadir gasto» en móvil | al final de un modal de 760 px | fijo abajo, visible siempre |
| Filtro por trabajo | no existe | existe; con filtro, la suma de lo que se ve y su salvedad |
| El total del mes | 1 vez (KPI) | **1 vez** (sin filtros) |
| Nombre del trabajo en la fila | «Trabajo» (titulo nulo) | «Presupuesto #5 · María López», como en Trabajos |
| ¿Se puede LEER un gasto? | no: la fila abre el modal de edición | sí: pantalla de detalle con el justificante grande |
| Alto de los tres KPI a 390 | ~270 px (dos tarjetas + una; leído de la captura) | **188 px** (una tarjeta, tres renglones) |
| Primera fila, medida desde el titular, a 390 | ~515 px (leído de la captura) | **500 px** |
| Alto de una fila a 390 | ~78 px **enseñando 1 de 5 columnas** | **202 px enseñándolo todo** |

**La última fila, dicha claro:** a 390 cada gasto ocupa más alto que hoy. Es el precio de que se vea el importe, la
categoría, el justificante y el trabajo **sin arrastrar**; hoy la fila es baja porque cuatro de sus cinco columnas
están fuera de la pantalla. Y la primera fila sigue a ~500 px del titular: los KPI se compactaron, pero entraron el
filtro por trabajo y los dos chips, que pide el ticket.

## 4 · Las comprobaciones (las mismas en las dos anchuras)

La lista pinta sus 9 filas · cada fila dice si tiene foto (6 con, 3 sin) · la miniatura se pinta · el total del mes
sale una vez · «Nuevo gasto» se ve una vez · el trabajo se llama como en Trabajos · el chip «Sin foto» filtra (3) y
«Todos» devuelve 9 · el filtro por trabajo deja 2 · con filtro la cabecera suma 508,20 € y su salvedad no repite el
total · filtro imposible → 0 filas y su vacío · «Quitar los filtros» devuelve 9 · el vacío de hoy, palabra por
palabra, y se deshace · el «⋯» abre 4 opciones y **ninguna está muerta** · la hoja se cierra por el fondo y por la
«×» · la fila abre el detalle de ESE gasto · el justificante grande · 6 datos de factura en el Compresor · «Ver a
tamaño completo» abre la foto · un gasto sin foto lo dice y ofrece añadirla · **sin datos de factura, ni tarjeta ni
«—»** · en el detalle no hay barra fija · el primer bloque del alta es la foto, y está encima del concepto en píxeles ·
14 campos · la frase firmada entera, una vez, con «de abajo» · «Añadir gasto» se ve una vez · «Hacer foto» cambia el
estado y «Quitarla» lo deshace · sin el andamio de 912 no llega nada leído, ni con él si no hay foto · con él y con
foto, importe (84,70) y fecha llegan marcados y hay aviso · guardar sin concepto avisa y lleva el foco · sin importe,
igual · con los dos, guarda · los datos del proveedor llegan plegados y se abren · el inventario no inyecta HTML ·
ningún blanco estaba tapado.

## 5 · Excepciones declaradas

- **`btn-sm` a 44 px de alto.** `DESIGN.md` la exime a 30 px con su motivo; aquí se mide contra el pulgar en obra
  y no se aprovecha la exención (como en 915, 917 y 916).
- **La pestaña de inventario tiene 0 controles y 0 cifras: en ella esos dos detectores están «NO MEDIDO», no «en
  verde»** (ver §7). Sus frases vetadas no cuentan porque describe lo que no se puede decir.
- **Datos de ejemplo:** los 4 primeros gastos son los reales de staging (merchant QA Staging, SELECT de sólo lectura
  del 18-sep). Los 5 siguientes se AÑADEN, y se dice: con cuatro filas no se puede enseñar el filtro por trabajo ni un
  total que merezca la pena. Ninguno inventa un campo que la pantalla de hoy no tenga.
- **La foto es un ticket dibujado en SVG**, para no meter binarios ni pedir red.

## 6 · Propuestas que no son de esta sesión

- **Aceptar PDF** en el campo de la foto («foto o archivo», dice el ticket). Hoy `accept="image/*"`; lo que se guarda
  es base64 en `receiptData`, y su tamaño lo decide la S1.
- **Qué campos lee la lectura del ticket**: SCRUM-912. Aquí se dibujan dos (importe y fecha).
- **El nombre del trabajo y la clave cruda del KPI**: SCRUM-944. **La ruta que no valida la categoría**: SCRUM-943.
- **La tabla que se recorre de lado en otras pantallas**: `patron-tabla-de-lado.md`.

## 7 · Repetición sobre el árbol fusionado (20-sep-2026)

Lo de arriba se midió el 18-sep sobre `origin/main = 16733a22`. La rama estuvo dos días sólo en local; el
20-sep, a las 13:05 Z (hora de GitHub), se mergeó `origin/main = f2fa091bfeb8c754ab0dcba5ddb95d0ed3d987d4` (184
commits, 0 conflictos) y se volvió a correr `medir.mjs` sobre el árbol fusionado, con la salida a un fichero fuera del
árbol y el código de salida leído aparte.

- **Veredicto sobre lo que SÍ se midió: TODO EN VERDE, `EXIT=0`, 86 comprobaciones de comportamiento (43 por
  anchura × 2), 0 rojos.** La primera pasada del 20-sep dio 84 (42 × 2); la 43.ª es la del NIF, de abajo.
- **Población, por anchura (1280 y 390 salen igual):** lista 22 controles y 11 cifras en €; alta 21 y 0; detalle 7 y 3;
  **inventario 0 y 0**. Errores de consola: 0 en las dos.
- 🔴 **Lo que NO está medido, dicho con su nombre.** En la pestaña de inventario los detectores de «controles < 44 px» y
  de «cifras» tienen **población 0: ahí NO SE HAN MEDIDO, no están «en verde»** (corrección del orquestador, 20-sep).
  Tiene 0 controles porque es un texto, pero un cero sobre una población vacía no prueba nada. Las frases vetadas
  tampoco cuentan ahí: describe lo que no se puede decir. Lo único que se mide en esa pestaña es geometría (scroll
  horizontal de la página y cajas que desbordan), y el instrumento **no imprime la población de ese detector**: hueco
  declarado, no arreglado en esta sesión.
- **Controles positivos: los tres disparan en las dos anchuras** (desborde · controles < 44 px · frase vetada). Sin eso,
  los ceros de arriba no valdrían nada.
- **Ningún blanco tapado al pulsarlo** (0), y las 4 opciones del «⋯» cambian el estado al pulsarlas.
- **Lo que cambió entre las dos pasadas (y por qué):** al mergear se vio que `main` había avanzado en la pantalla que
  el prototipo imita. **SCRUM-937b** (ya en `main`) bloquea el «NIF del proveedor» mientras no haya proveedor y lo dice
  con un texto ya firmado («Elige antes el proveedor: el NIF se guarda en su ficha.»); el prototipo lo tenía editable
  siempre. Se corrigió el prototipo y se añadió la comprobación 43 (`medir.mjs`): sin proveedor, bloqueado y con su
  ayuda; con proveedor, se escribe y la ayuda se va. **Vista en rojo:** con la inyección de quitar `readonly` (1 línea
  cambiada, `git diff --numstat` 1/1) `medir.mjs` sale con `EXIT=1` y marca ✗; restaurada, `EXIT=0`. Commit del arreglo
  `5dfcde5a`. Las capturas de `capturas-prototipo/` **no se regeneraron**: el NIF vive dentro del bloque plegado y no
  sale en ninguna.
- **Tercera pasada, tras la firma de la microcopy (SCRUM-920 comentario 15992):** el prototipo pasa a los textos
  firmados —«La foto del ticket», «Ver la foto», «Sin foto» sin triángulo, «Ver trabajo», «Todos · N» con su
  espacio— y **se quita «N gastos de M»** (texto sin firmar). Vuelve a dar **86 comprobaciones ✓, 0 ✗, `EXIT=0`, TODO
  EN VERDE**, con la misma población (22/11, 21/0, 7/3, inventario 0/0) y los tres controles positivos disparando. Se
  regeneraron las capturas de lista y detalle (las únicas donde cambia un texto visible).
- **Lo que llegó a `main` y no es visible en el prototipo:** SCRUM-947 (la foto grande se reduce antes de guardar y,
  si no se puede abrir, dice «No hemos podido abrir esta foto. Prueba con otra o haz una captura de pantalla del
  ticket.», firmado). No cambia el diseño, pero la construcción tiene que **conservarlo** (ver
  `encargo-construccion-s2.md`).
