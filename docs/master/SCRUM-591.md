# SCRUM-591 · DOC-01 · Crear cliente desde el selector del documento

**Fecha:** 3-sep-2026 · **Carril:** S3 · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `b57ccbb37f5d3565922696691ce052836f5c23c1` · 2026-09-03T14:03:34+02:00

**Tanda:** 5007 tests, 4923 pass, **0 fail**, 84 skipped — medida DESPUÉS del último cambio, entrada incluida, con main dentro (33 commits en dos mezclas) y Prisma regenerado. Suelo: suelo 4798 · total 5007 · margen 209.

---

**Estado de `main` al empezar, medido y no creído:** `b57ccbb3` (no `9ba054a9`, que era la
referencia del encargo y ya había caducado). `scrum652d-puerta-al-parte` corre **12/12 en verde**,
así que el criterio de esta rama es **cero fallos, sin excepciones**.

## PASO 0

### (a) ENTRADA — y una premisa del encargo que no se sostiene

El selector es **`public/dashboard/js/quotesView.js:382`**:
`createFieldSelect("Cliente", "customer_id")`, y sus opciones se pintan en `~L3104`.

**Existe en TRES vistas**, no en dos:

| Vista | Qué es | Este ticket |
|---|---|---|
| `quotesView.js:382` | el documento (presupuesto) | ✅ **se cablea** |
| `nuevaFacturaModal.js:81` | la factura | ⛔ **camino de emisión — NO se toca** |
| `jobNuevoModal.js` | el Trabajo, que no es documento del bloque G | fuera de carril |

El albarán **no tiene selector propio**: no aparece en el censo.

### 🔴 Y la premisa: en ese selector NO SE PUEDE TECLEAR

El encargo dice *«al teclear en el selector… aparece una opción de alta con lo tecleado dentro»* y
*«el modal con el nombre YA PRELLENADO con lo tecleado»*. Medido: **es un `<select>` nativo**
(`createFieldSelect`, L310-320, construye un `<select>` pelado). En un `<select>` nativo no se
teclea, así que **«lo tecleado» no existe**.

Y no es un descuido que se pueda deshacer de paso: **el comentario del propio código dice que la
migración de `<input>` a `<select>` fue deliberada** (`quotesView.js:2615`: *«un `<select>` avisa
por `change`; el `<input>` que había avisaba por `input`»*).

> ⚠️ Ese comentario **la atribuye a SCRUM-611**, y eso es lo único que he medido: lo pone el
> código. **No he comprobado el historial**, y el asesor avisa de que ese ticket no tiene commits.
> La atribución queda como lo que es —una cita del comentario, no un hecho verificado— y se
> resolverá con `git log` en SCRUM-713.

Convertirlo en buscador es cambiar la forma de la pantalla y proponer un componente nuevo al
inventario AB3 — no es de este ticket y **no se ha hecho**.

**Lo entregado:** una opción de alta en el selector que ya existe. El mecanismo **sí acepta un
nombre y lo prellena** (`abrirNuevo({nombre})`, con su test), así que el día que haya buscador el
prellenado ya funciona: lo que falta es de dónde sacar el texto, no dónde ponerlo.

### (b) MECANISMO — el motor existe, y NO era invocable

`buildModal()` vive en `customersView.js` y trae dentro CONT-01, CONT-02 y CONT-05 enteros. Pero:

* **278 líneas** y **33 símbolos del cierre** de `renderCustomersView` — medido por AST;
* `customersView.js` **no publica nada** en `window`: las únicas funciones de nivel superior son
  `createElement`, `createField` y `renderCustomersView`. **`buildModal` no era alcanzable.**

Así que «darle superficie al motor» exigía **sacarlo del cierre primero**. Ése era el trabajo real,
y el encargo lo había anticipado.

**Las dos mediciones que hicieron el corte seguro:**

* de los 24 símbolos mutables, **CERO se reasignan fuera** del formulario: el resto de la vista sólo
  los LEE;
* del bloque entero, **sólo `openModal` se usa fuera** (los dos botones de la tabla).

### (c) ¿Había ya algo a medias? **No.** Censo vacío: ninguna vista de documento crea clientes hoy.

### (d) LA CAJA, medida en el navegador

Página de medida con `tokens.css` + `styles.css` reales, sirviendo el marcado del documento
(`.view-container > .quotes-layout > .card > .quote-block > .quote-form-row > .field > select`):

| Viewport | Ancho del select | Ancho útil | Caben |
|---|---|---|---|
| **901px** (peor caso: 3 columnas) | 275,7px | **247,7px** | **18** anchos · **29** estrechos · **34** de texto español real |
| 929px | 285px | 257px | 19 · 30 · 35 |
| 390px (móvil, 1 columna) | 364px | 336px | 24 · 39 · 48 |

**El peor caso NO es el móvil**: es justo por encima del corte de 900px, donde la fila son tres
columnas. Fuente medida: `15px Inter`. De referencia, `Selecciona un cliente…` mide 149,3px y cabe
en los tres.

> 🕳️ **Lo que esta medida NO cubre:** el desplegable abierto lo pinta el sistema operativo y no
> está en el DOM, así que no se puede medir desde aquí. Lo medido es la **caja cerrada**.

## Lo construido

| Pieza | Qué es |
|---|---|
| `customersView.js` · IIFE final | el formulario, FUERA del cierre, publicando `window.altaClienteModal` |
| `abrirNuevo({nombre, alGuardar})` | la entrada nueva: abre **el mismo** formulario y devuelve el cliente creado |
| `configurar({avisar, trasGuardar})` | las dos costuras: la vista de Clientes presta su caja de avisos y su recarga |
| `quotesView.js` | la opción de alta **la primera**, el centinela, y el pintado de opciones en **una sola** función |
| `tests/scrum591-alta-desde-el-documento.test.mjs` | 11 tests |

### 🔴 La forma que se probó y se DESCARTÓ, con la medida delante

Primero se sacó el formulario a un fichero nuevo (`altaClienteModal.js`) con su entrada en
`index.html`, en el SHELL de `sw.js` y en las dependencias de carga. Resultado medido:

```
209 tests de la red de clientes → 182 pass, 27 FAIL
```

**27 guards de ocho tickets cerrados** (CONT-01, CONT-02, CONT-05, CONT-06, CONT-07, SCRUM-588,
615, 692) leen `customersView.js` **por ruta**, como TEXTO. Mover el fichero los dejaba a todos
mirando al sitio equivocado.

Se revirtió entero y se rehízo dejando el formulario **en su fichero, dentro de una IIFE**. Lo que
estorbaba era el **cierre**, no el fichero: **209/209**, y el motor igual de alcanzable.

Y no se suben los 24 nombres al ámbito global de los scripts clásicos: `fieldName`, `fieldPhone`…
son genéricos, y eso es sembrar colisiones para la siguiente vista — lo que vigila
`dashboard-colision-declaraciones`. La IIFE publica **un** nombre.

## 🔴 Los rojos, por el mecanismo

Commiteado en verde antes de mutar; cada mutación comprueba que cambió el fichero que dice, y se
restaura y se re-verifica. Control antes y después: `fail=0`.

| Mutación | Cae | Qué nombra |
|---|---|---|
| se quita `comprobarDuplicados` del teléfono | **1** | «EL QUE DECIDE: abrir desde el DOCUMENTO pregunta por duplicados» |
| el documento se construye **su propio** formulario | **2** | «existe UNA sola vez», «la vista del documento NO construye campos» |
| el prellenado va ANTES de abrir (lo borra el `reset`) | **1** | «el nombre tecleado llega PRELLENADO» |
| el formulario vuelve a llamar a `loadCustomers` | **1** | «el formulario no depende de la tabla» |
| el marcador se escribe con la grafía que el censo no cuenta | **1** | «la microcopy está PENDIENTE, y se declara» |
| **CONTROL NEGATIVO** · cambio cosmético (una clase CSS) | **0** ✅ | no cae, como debe |

**El que decide es de COMPORTAMIENTO, no de estructura:** se abre el formulario *como lo abre el
documento* —sin caja de avisos y sin tabla— se escribe un teléfono, se disparan sus oyentes de
`blur` y se comprueba que **sale de verdad** la petición a `/admin/customers/duplicados?...phone=`.
El aviso de CONT-05 llega al alta rápida, que es donde más duplicados nacen.

## Tres cosas que aparecieron al medir, y no se resolvieron a ojo

### ✅ MICROCOPY FIRMADA POR EL ASESOR el 3-sep-2026: «+ Nuevo cliente»

**15 caracteres.** Cabe con margen en el peor caso medido (18 anchos a 901px) y ni se acerca a los
34 de texto español real. **Va la PRIMERA, justo detrás del placeholder** —nunca al final: en un
`<select>` nativo con doscientos clientes, el final de la lista no existe.

**Y es EL MISMO literal que el botón de la lista de Clientes** (SCRUM-599), verificado en el
código: `customersView.js:69`. Un nombre por acción — dos nombres distintos para la misma acción
es cómo un profesional aprende que son dos acciones distintas. El test lo ata **por los dos lados**:
si el botón de Clientes cambia de texto, este guard cae.

**El contador de microcopy pendiente BAJA, con el número delante:**

```
ANTES (con el marcador)  → 15 marcadores pintables en 15 ficheros · quotesView.js: 1
AHORA (literal firmado)  → 14 marcadores pintables en 14 ficheros · quotesView.js: 0
```

> La primera vez que lo medí dio **18 → 17**, y esa cifra ya no vale: entre medias entró
> SCRUM-703 en `main` y sacó `jobNuevoModal.js` del censo. **Se volvió a medir sobre el árbol
> mezclado en vez de copiar el número**, que es exactamente como una cifra correcta se queda vieja
> sin que nadie lo note.

La entrada de `quotesView.js` en el censo de SCRUM-402 se **BORRA**, no se pone a 0: ese censo
sólo lista ficheros CON marcadores, y así el trinquete aprieta en vez de aflojarse.

### ① El marcador que el trinquete NO veía (y que el encargo mandaba usar)

El encargo pedía pintar `[[MICROCOPY-PENDIENTE-DOC-01-OPCION-ALTA]]`. Medido: **el censo de
SCRUM-402 no lo cuenta** — cuenta `[PENDIENTE`, y su propio fichero ya lo dejó escrito («ese
marcador NO lo cuenta este censo»). Un marcador invisible al trinquete es **una frase sin aprobar
en la pantalla de un profesional que nadie está contando**.

Se pinta `[PENDIENTE microcopy · DOC-01 opción de alta]`, **comprobando primero que el trinquete lo
caza** (`quotesView.js (+1)`) y declarando después su entrada en el censo con el motivo — el
precedente es SCRUM-651: *el mecanismo no existe sin texto*, porque una `<option>` sin rótulo no se
puede elegir.

### ② El banco no tenía `reset()`

El formulario **reventaba al abrirse en el banco** (`modalForm.reset is not a function`) mientras en
el navegador lo abre un profesional cada día. Añadido a `_banco-vistas.mjs` con su motivo, como los
seis huecos que ese fichero lleva corregidos. **No crea nodos** — comprobado abajo.

### ③ El control de SCRUM-697 sube de 236 a 237 nodos

Ese control existe para que **un arreglo del banco** no cambie el montaje. La subida **no es del
banco: es del producto** (la `<option>` de alta). **Aislado, no supuesto:** quitando ese
`appendChild` —con el resto del ticket puesto, `reset()` incluido— el control vuelve a **236**. El
número se actualiza con esa medición escrita al lado.

## 🔴 Y al mezclar `main`, la JUSTIFICACIÓN de la firma dejó de ser cierta

El asesor firmó «+ Nuevo cliente» **porque era el mismo literal que el botón de la lista de
Clientes** — un nombre por acción. Lo era cuando lo firmó. Al mezclar `main` dejó de serlo, y lo
cazó **el propio guard de este ticket**, que ataba los dos lados:

| | Cuando se firmó | Ahora, medido |
|---|---|---|
| botón de la lista de Clientes | `"+ Nuevo cliente"` en `customersView.js` | **`"Nuevo cliente"`** —sin el `+`— más un `<kbd>N</kbd>` dentro |
| de dónde sale el texto | del literal de la vista | de `atajoNuevo.TEXTOS.customers` |
| estado de ese texto | aprobado | **`SIN_APROBAR = 3`**: tres ranuras esperando al FUNDADOR |

**Hoy la misma acción tiene DOS nombres en pantalla:** «+ Nuevo cliente» en el documento y
«Nuevo cliente ⌨N» en la lista.

**No lo he resuelto yo.** Cambiar microcopy firmada no es de una sesión, y el texto del otro lado
ni siquiera está aprobado todavía: alinearlos por mi cuenta sería decidir dos veces por encima de
quien firma. Lo que sí se ha hecho es **atar los dos**: el guard fija el literal del documento con
`===` y además fija el rótulo del atajo y su contador `SIN_APROBAR`. Si cualquiera de los dos se
mueve, cae y obliga a decidir. Es más fuerte que la comparación anterior, que sólo miraba un lado.

## 🕳️ Huecos declarados

1. **La factura NO se ha cableado.** `nuevaFacturaModal.js` es **camino de emisión**, y la regla del
   encargo es explícita: leerlo no es STOP, **modificarlo sí**. El mecanismo ya está compartido, así
   que cablearlo es añadir la opción y el `abrirNuevo` — pero eso lo decide el fundador.
2. **No hay «lo tecleado»** mientras el control sea un `<select>` nativo. El mecanismo acepta el
   nombre y lo prellena (probado), pero hoy nadie se lo pasa.
3. **No he verificado en yaqu.app.** Lo medido es: la red de 480 tests de clientes y presupuestos,
   el banco de vistas y la caja del selector en un navegador real con el CSS de producción. La
   pantalla con el modal abierto **encima del documento** no la he visto.
4. **`alGuardar` es de un solo uso y no hay test de que se limpie** entre dos altas seguidas desde
   el documento. Está escrito en el código; no está atado.

## Hallazgos fuera de carril

* `nuevaFacturaModal.js` **ya tiene un buscador** que filtra clientes por texto: la interacción que
  el encargo describe existe en la factura y no en el presupuesto.
* `quotesView.js` ya tiene un autocompletado propio (`pf-autocomplete`, `/admin/products/autocomplete`)
  para el concepto de línea: si algún día el selector de cliente se convierte en buscador, ese
  patrón ya está en la casa.
