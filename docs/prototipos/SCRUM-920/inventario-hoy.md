# SCRUM-920 · La pantalla de Gastos de HOY, medida

Medido en **staging** el 17-sep-2026 sobre `11cc872a`, con la sesión QA, a 1280 × 900 y a 390 × 844 táctil.
Capturas en `capturas/`. **Este documento es sólo el inventario: el prototipo lo construye la sesión siguiente.**

> ⚠️ **Staging tenía CERO gastos.** Para poder medir la lista con filas se sembraron **cuatro gastos de prueba**
> (ver §6). Sin ellos, la lista sólo se podía medir en su estado vacío, y sacar conclusiones de ahí sería el mismo
> «cero que se lee como limpio» que ya nos mordió hoy en otra medición.

## 1 · La lista

| | 1280 | 390 |
|---|---|---|
| columnas y su ancho | Concepto 503 · Categoría 145 · Trabajo 127 · Importe 137 · *(sin rótulo)* 71 | Concepto 328 · Categoría 92 · Trabajo 80 · Importe 87 · *(sin rótulo)* 41 |
| alto de la página | 900 px | 989 px |
| scroll horizontal **de la página** | no | no |
| controles por debajo de 44 px (sin contar el menú lateral) | **10** | **9** |

**Arriba:** tres KPI —«Gasto del mes», «Sin asignar a trabajo», «Mayor categoría»—, un selector de mes (6 meses),
un filtro de categoría (Materiales · Desplazamiento · Herramientas · Subcontrata · Otros), «Nuevo gasto» con su
atajo «N» y «⬇ CSV».

### 1.1 · Lo que estas cuentas significan

**① El justificante NO aparece en la lista.** Las columnas son Concepto · Categoría · Trabajo · Importe · 🗑.
**No hay nada que diga si un gasto tiene su foto o no.** En la matriz de competencia esta fila se llama «gastos y
justificantes», y el justificante es justo lo que no se ve. El dato existe: `receiptData` viaja en cada gasto
(comprobado en `/admin/expenses`, claves del objeto).

**② La tabla se recorre de lado a 390 px.** No es scroll de la página —eso da `false`— sino **de su caja**: la tabla
lleva `min-width:600px` dentro de un `table-scroll` (`expensesView.js:239`) y a 390 px sus columnas suman **628 px**.
O sea, para ver el importe hay que arrastrar. Es exactamente el defecto que SCRUM-139 F1 midió en el editor de
presupuesto y llamó inservible con el pulgar en obra, **y que allí se arregló**.

> 🔴 **Y esto apunta más lejos que esta pantalla.** Si el mismo patrón de tabla ancha con scroll lateral reaparece
> pantalla por pantalla, **el arreglo no es pantalla por pantalla**. Queda dicho aquí para que el orquestador decida
> si abre un ticket transversal; no se resuelve dentro de 920.

**③ El botón de borrar mide 21 × 29 px, y la fila navega.** El 🗑 de cada fila es el control más pequeño de la
pantalla, y está dentro de una fila cuyo `onclick` abre el gasto. Un blanco de 21 px para un borrado, pegado a un
gesto de navegación, en una pantalla pensada para el móvil.

**④ Los demás controles pequeños:** los dos `select` de filtro (36 px de alto), «⬇ CSV» (62 × 30), «Nuevo gasto»
(183 × 36) y el enlace «Trabajo» de cada fila (46 × 16).

## 2 · El alta: catorce campos, y la foto la última

Orden real del formulario, medido:

1. Concepto \* · 2. Importe \* · 3. Base imponible · 4. Tipo de IVA · 5. Cuota de IVA · 6. Nº de factura del
proveedor · 7. Fecha de la factura · 8. Fecha · 9. Categoría · 10. Trabajo (opcional) · 11. Proveedor (opcional) ·
12. NIF del proveedor · 13. Notas · **14. Foto del ticket (opcional)**

El ticket pide «apuntar un gasto en segundos desde el móvil, foto del ticket primero». Hoy la foto es **el campo
catorce de catorce**, y sólo dos son obligatorios. El alto del modal es 760 px a 390 y 860 a 1280.

Textos de hoy que se conservan: «Guardamos la foto como tu copia. Los datos fiscales los pones tú», «Vincula este
gasto a un trabajo para calcular el margen.», «— Sin trabajo —», «— Sin proveedor —», «Añadir gasto»,
«Guardar cambios», «Guardando…».

## 3 · 🔴 El motor del justificante YA está conectado, y no se pinta

`src/modules/expenses/domain/justificante.ts` clasifica cada gasto con **tres** veredictos —`deducible`,
`no_deducible`, `falta_confirmar`— y devuelve **qué le falta**, en códigos: `importe`, `nif_proveedor`, `fecha`,
`cuota_desglosada`, `numero_factura_proveedor`, `nif_destinatario_en_el_documento`. La ruta lo devuelve en cada alta
(`expenses.routes.ts`, `justificante` en el 201). **La pantalla no enseña nada de eso, a propósito**: decir «con un
ticket no puedes deducir el IVA» es una afirmación fiscal, y el producto no hace afirmaciones fiscales sin el asesor
(SCRUM-324 E3, decisión del fundador de 10-ago-2026). Las tres frases candidatas siguen **sin responder** en
`docs/legal/PREGUNTAS_ASESOR.md` §539-542.

Medido al sembrar los gastos: los cuatro volvieron con su veredicto y su lista de `faltan`. Por ejemplo, el ticket de
almacén: `no_deducible · faltan: nif_proveedor, cuota_desglosada, numero_factura_proveedor`.

**El hueco de diseño, y es de este ticket:** el límite dice «se muestra el dato, no se afirma qué desgrava». Los
códigos de `faltan` **son datos del documento, no afirmaciones fiscales**: «le falta el NIF del proveedor» es un
hecho; «no puedes deducir el IVA» es una afirmación. Enseñar lo que falta **sin nombrar la deducción** deja ver el
motor que ya está conectado sin invadir lo que espera al asesor. Es una cuarta vía que las opciones A, B y C de
`PREGUNTAS_ASESOR.md` no contemplan, y **hay que proponerla al orquestador, no construirla por cuenta propia.**

## 4 · 🔴 Una posible incoherencia, medida y con su código delante

El formulario tiene el campo **«NIF del proveedor»** (el 12.º) y la ruta **lo guarda**
(`nifProveedor: nifProveedor ? String(nifProveedor) : null`). Pero al clasificar el justificante usa
**`proveedor?.taxId`** —el NIF del Proveedor VINCULADO—, no el que el profesional acaba de teclear.

Medido: sembré un gasto con el desglose entero **y** `nifProveedor: 'B12345678'`, y volvió con
`faltan: ['nif_proveedor']`.

**No lo llamo defecto, y por eso lo dejo como pregunta.** Puede ser deliberado: un veredicto fiscal no debería
apoyarse en un campo de texto libre que nadie ha verificado. Pero entonces la pantalla está pidiendo un dato que no
cuenta para el único cálculo que lo usa, y eso no se dice en ninguna parte. **Es carril de la S1 decidir cuál de las
dos cosas es.**

## 5 · Lo que NO se puede perder

Ninguna función se retira: los tres KPI, el filtro por mes, el filtro por categoría, la exportación a CSV con los
filtros aplicados, el atajo «N», el enlace al Trabajo desde la fila, el proveedor bajo el Trabajo, las notas y la
fecha bajo el concepto, el borrado, y el alta desde el detalle del Trabajo (`SCRUM-135`, con su propio `onSaved`).

## 6 · Los gastos de prueba que quedan en staging

Sembrados el 17-sep-2026 con el merchant **QA Staging** (NO se tocó el merchant QA 2). Todos llevan
«SCRUM-920» en el concepto y «Gasto de prueba de SCRUM-920» en las notas, para que se puedan encontrar y borrar:

| concepto | importe | foto | Trabajo | desglose |
|---|---|---|---|---|
| SCRUM-920 · Material de almacén (ticket) | 84,70 € | sí | presupuesto 1876 | no |
| SCRUM-920 · Compresor (factura del proveedor) | 423,50 € | sí | presupuesto 1876 | sí, entero |
| SCRUM-920 · Gasolina | 62,15 € | **no** | — | no |
| SCRUM-920 · Subcontrata de albañilería | 310,00 € | sí | — | no |

Los cuatro dieron `201`. La respuesta no trae `id` en la raíz (viene en `item`), así que **los ids no se apuntaron**;
se localizan por el concepto.

## 7 · Siguiente paso exacto

Con este inventario delante: prototipo HTML con las tres piezas que pide el ticket —**alta guiada con la foto
primero**, **lista por mes con totales y filtro por trabajo**, y **detalle del gasto con su justificante visible**—,
medido a 390 y 1280 con 0 scroll horizontal (también **dentro** de la tabla) y 0 controles por debajo de 44 px.
Textos nuevos subrayados y propuestos. **Nada fiscal afirmado**: lo de §3 se propone, no se decide.
