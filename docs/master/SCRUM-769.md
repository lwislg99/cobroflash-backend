# SCRUM-769 · Las cinco pantallas, mismo patrón — DOS aplicadas y TRES paradas

**Fecha:** 6-sep-2026 · **Carril:** navegación del panel (producto) · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `00c6cb0cc328eb88cea26bc4b672ebad25e51a47` · 2026-09-06T07:54:03+01:00
**Tanda:** 5566 tests, 5478 pass, 0 fail, 88 skipped (salida 0) — con `main` ya mezclado dentro

> El fundador firmó **cinco** rótulos y la decisión de que las cinco pantallas registraran el atajo
> «N» por el mismo mecanismo. **Se han aplicado dos.** Las otras tres se PARAN, y no por alcance:
> la firma daba por hecho que los cinco botones eran la misma clase de botón, y **tres no lo son**.

---

## Lo aplicado

| pantalla | rótulo | atajo |
|---|---|---|
| `jobs` | «Trabajo nuevo» → **«Nuevo trabajo»** | ✅ `registrar('jobs', …)` + `etiquetar` |
| `expenses` | «+ Nuevo gasto» → **«Nuevo gasto»** | ✅ `registrar('expenses', …)` + `etiquetar` |

Los dos rótulos viven en `atajoNuevo.TEXTOS` —el sitio único— y las vistas los recogen con
`etiquetar`. **Nada se reimplementa en línea**: es el patrón de SCRUM-599 y el defecto que
SCRUM-768 acaba de quitar de `invoicesView`.

**`SIN_APROBAR` vale 1 antes y 1 después.** Los dos entran FIRMADOS, así que suben a la vez el
total de `TEXTOS` (4 → 6) y el de aprobados (3 → 5); la igualdad que los ata sigue exacta. La única
ranura a la espera sigue siendo `albaranes`, de SCRUM-606, **que no se ha tocado**.

Registro de la aprobación: `docs/microcopy/2026-09-06-SCRUM-769-las-cinco-pantallas.md`.

## 🔴 Las TRES que se paran — medido, no supuesto

### Productos y Proveedores · el botón primario es un **confirmar**, no un **abrir**

No hay un botón que abra una creación: hay un **formulario en línea siempre visible** y el botón
primario es su **envío**.

* `providersView.js:213` — `id="pf-create-provider"`, dentro del bloque titulado
  `<h3 class="quote-block-title">Nuevo proveedor</h3>` (línea 188).
* `providersView.js:409` — su manejador **lee los campos y crea**; con el nombre vacío devuelve
  `setAlert("error", "name_required")`.
* `productsView.js:480` — la misma forma, con `id="pf-create-product"`.

Dos consecuencias:

1. **El rótulo cambiaría de significado.** «Nuevo proveedor» es lo que se lee para ABRIR un alta;
   aquí rotularía el botón que la CONFIRMA — y quedaría el mismo texto dos veces en la misma
   tarjeta, título y botón, a cinco líneas.
2. **El atajo no encaja.** `registrar` ata la «N» a `boton.click()`, y aquí eso **intenta crear**
   con lo que hubiera escrito. Con el formulario vacío, la «N» dispara un error en la cara.

### Ficha del Trabajo · hay **DOS** «+ Nuevo albarán», y el primario no es el que crea

Medido sobre el DOM ejecutado de `renderJobDetailView`:

| botón | clase | quién escribe su rótulo |
|---|---|---|
| el que ve el censo | `btn-primary` | **`jobNextAction.js:67`** — la escalera aprobada de SCRUM-366 |
| el que da de alta | `btn-secondary btn-sm` | `jobDetailView.js:1157` |

El primario es el **CTA del héroe** y su etiqueta **depende del estado del Trabajo**: dice
«+ Nuevo albarán» sólo mientras no haya ningún albarán; en otro peldaño dice «Cobrar el resto»,
«Recordar» o «Emitir». Esa misma escalera alimenta además la **lista** de Trabajos
(`jobsView.js:375`), así que retirarle el `+ ` cambiaría **dos pantallas**.

Y atar la «N» a ese botón haría que la tecla dispare **lo que toque en ese momento**, incluido
`collect-rest`: **mover dinero desde una tecla**. No se hace.

> La instrucción decía «SÓLO se retira el +; la palabra no se toca, porque su hermana de la lista
> de albaranes sigue con `[PENDIENTE microcopy oficial]` esperando SCRUM-606». Se ha respetado al
> pie de la letra: **no se ha tocado ninguna de las dos**.

## El control que decide — el censo de SCRUM-768

| momento | vistas con botón de crear y SIN atajo |
|---|---|
| **ANTES** | **5** · `renderExpensesView`, `renderJobDetailView`, `renderJobsView`, `renderProductsView`, `renderProvidersView` |
| **DESPUÉS** | **3** · `renderJobDetailView`, `renderProductsView`, `renderProvidersView` |

**No llega a cero, y el motivo está arriba.** El guard baja su lista de cinco a tres **enumerando**
y con el porqué de cada una escrito al lado.

Sigue fallando si el número SUBE: quitado el atajo de **Gastos** —una de las que acaba de
recibirlo—, el censo pasa a cuatro, se pone rojo (**2 fails de 7**) y **nombra** `renderExpensesView`.
Restaurado con `Buffer.compare = 0` y el fichero vuelve a parsear.

## 🔴 LA TRAMPA DEL CENSO SÍ SALTÓ — y no por donde se avisaba

El aviso era: «el criterio es textual (`nuevo|nueva|crear`); este ticket renombra cinco botones,
compruébalo». **Comprobado: los dos rótulos nuevos siguen viéndose** («Nuevo trabajo» y
«Nuevo gasto» empiezan por «Nuevo»). Por ahí no entró.

Entró por otra puerta, y es peor:

> Al renombrar el botón de Gastos, la explicación se escribió como comentario HTML **dentro de la
> plantilla** y llevaba **acentos graves**. Un acento grave CIERRA el literal de plantilla:
> `expensesView.js` **dejó de parsear**, `renderExpensesView` **dejó de publicarse**, y la vista
> **desapareció de la población del censo**.

El censo pasó de **26 vistas a 25** y de **9 botones de crear a 8** — y su lista de «sin atajo»
**bajó de 5 a 3**, que es exactamente lo que este ticket buscaba. **Una pantalla ROTA se leía como
una pantalla ARREGLADA.** El suelo de entonces (`vistas.length >= 20`) no lo veía, porque 25
también es ≥ 20.

Lo cazó la caída de la población. `node --check` lo confirmó nombrando la línea:

```
expensesView.js:101   del atajo no ha cargado; el que manda es `atajoNuevo.TEXTOS.expenses`. -->
                                                               ^^^^^^^^^^
SyntaxError: Unexpected identifier 'atajoNuevo'
```

**Se cierra con un suelo nuevo** (`SCRUM-769 · NINGUNA vista con botón de crear DESAPARECE del
censo`): la población de vistas con botón de crear se **enumera** —las nueve, por nombre— en vez de
restarse de un total. Una vista que se cae se nombra. Es la lección de SCRUM-411 aplicada a la otra
mitad del censo.

## La caja, medida en navegador real (Edge) a 929 y 390 px

Con el CSS de producción y los contenedores reales reproducidos —el `#jobs-nuevo` de Trabajos y la
barra de filtros de Gastos, que es quien le disputa el ancho al botón por su `margin-left:auto`—:

| Botón | 929 · antes | 929 · después | 390 · antes | 390 · después |
|---|---|---|---|---|
| Trabajos | 156,3 × 36,0 | **194,4 × 36,0** | 156,3 × 44,0 | **157,5 × 44,0** |
| Gastos | 161,4 × 36,0 | **179,9 × 36,0** | 161,4 × 44,0 | **143,0 × 44,0** |

* La tecla mide **22,9 × 20,0** a 929 y **se oculta** a 390 (por debajo de 640 px no hay teclado).
  Por eso Gastos **encoge** en móvil —pierde el `+ ` y no gana tecla— y Trabajos crece 1,2 px.
* **Ninguno se sale de su contenedor**; la página **no scrollea en horizontal** (929/929 y 390/390).
* **No pueden partirse**: `.btn-primary` computa `white-space: nowrap`. El único modo de fallo es
  salirse, y es el que se mide.
* **Control positivo:** con un rótulo absurdo de 70 caracteres el mismo medidor devuelve
  `seSale: true` a 390 px. Los cuatro `false` son un dato, no un silencio.

## La tecla, PULSADA DE VERDAD en un navegador — por primera vez

SCRUM-599 y SCRUM-768 ejercitaron la condición con un **objeto de mentira** (`{key:'n',…}`). Aquí
se carga `atajoNuevo.js` en Edge y se pulsan teclas reales, con el evento que fabrica el navegador:

| caso | ¿abre? |
|---|---|
| ① «n» a secas · ② «N» mayúscula | **sí** |
| ③ otra tecla · ④ foco en `<input>` · ⑤ en `<textarea>` · ⑥ en `contenteditable` · ⑦ con modal · ⑧ Ctrl+N · ⑨ Alt+N | no |

Los nueve se comportan como está escrito, y ① y ② son el control positivo que hace que los otros
siete signifiquen algo. El botón se pinta con su rótulo firmado y su `<kbd>`: `Nuevo gastoN`.

### 🔴 Y ese banco destapó un defecto que NO es de este ticket

La primera pasada dio **rojo en ① y ②** — la «n» no abría nada. El motivo:

**`sePuedeDisparar` mira la PRESENCIA de un `.modal-overlay`, no su VISIBILIDAD.** Mi banco tenía
un overlay con `display:none` y la pieza lo contaba como «hay un modal delante».

Y eso pasa en el producto: **`customersView.js:1346` cierra su modal con `modalBackdrop.style.display = "none"`**
y lo deja colgado del `body` para reutilizarlo (`1208` lo añade, `1261` lo reutiliza). Los demás
modales del panel se **borran** (`api.js:284`), y `index.html` no trae ninguno (medido: **0**).

⇒ **Una vez que el profesional abre y cierra la ficha de un cliente, queda un `.modal-overlay`
oculto en el DOM y la «N» deja de funcionar en TODAS las pantallas durante el resto de la sesión.**

Provocado en Edge (caso ⑩): con un overlay oculto en el `body`, la «n» **no abre nada**. No se
arregla aquí —tocaría el criterio de la pieza compartida o el cierre de Clientes, y ninguna de las
dos es de este ticket— y va como hallazgo.

## Lo que queda incoherente y se declara

**El modal que abre «Nuevo trabajo» se sigue titulando «Trabajo nuevo»** (`jobNuevoModal.js:64`).
Los dos textos están aprobados —«Trabajo nuevo» consta en el registro congelado de SCRUM-715— y
ahora el botón y el título de lo que abre ya no dicen lo mismo. Se dice y se deja.

## Huecos declarados

1. **La «N» sigue sin pulsarse sobre la pantalla REAL.** Lo de arriba ejercita la pieza con teclas
   de verdad, pero **no el cableado de `app.js`**: ese manejador vive dentro de `initApp()`, que
   empieza pidiendo `/admin/me` y redirige a `/login.html` sin sesión. El hueco baja de tamaño; no
   se cierra.
2. **El criterio de «botón de crear» sigue siendo TEXTUAL.** Hoy está tapado por la enumeración de
   las nueve, no por el criterio.
3. **Las cajas se miden sobre los contenedores reproducidos**, no sobre la pantalla entera con
   sesión: no cubre un estilo que llegara en tiempo de ejecución.
4. **`renderJobDetailView` sigue en el censo** aunque no sea una lista, y ahora además con dos
   botones del mismo texto. Es hueco de forma, declarado desde SCRUM-768.
5. **Los tres rótulos firmados y sin aplicar** quedan registrados en `docs/microcopy/` con su
   motivo. `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` está congelado (SCRUM-709) y no se toca.

## Ficheros

| fichero | qué |
|---|---|
| `public/dashboard/js/atajoNuevo.js` | entran `jobs` y `expenses` en `TEXTOS`, firmados; `SIN_APROBAR` sigue en 1 |
| `public/dashboard/js/jobsView.js` | rótulo firmado + `etiquetar` + `registrar` |
| `public/dashboard/js/expensesView.js` | ídem; y la explicación FUERA de la plantilla |
| `tests/scrum599-navegacion-documentos-y-atajo.test.mjs` | `APROBADOS` pasa de tres a cinco |
| `tests/scrum768-listas-sin-atajo.test.mjs` | la lista baja a tres, las registradas suben a seis, y nace el suelo de la población |
| `docs/microcopy/2026-09-06-SCRUM-769-las-cinco-pantallas.md` | **nuevo** · las cinco firmas, dos aplicadas y tres no |
| `docs/master/SCRUM-769.md` | **nuevo** · esta entrada |

---

# APÉNDICE · 6-sep-2026 · la firma llegó, y con ella lo que faltaba

**Medido contra:** `origin/main` = `95be56e4dd523b45d3046bda8cf09578ff953ab8` · 2026-09-06T21:39:27+01:00
**Tanda (árbol ya mezclado con `95be56e4…`):** `npm run build` + `node --test --test-reporter=tap
tests/*.test.mjs` → **5699 pruebas · 5603 en verde · 0 rojas · 96 saltadas** · 228,8 s · salida 0.

Los **96 saltos declaran su motivo y suman 96**, que es la comprobación entera: **86** piden base
(`QA_DB_TEST`/`AN_DB_TEST`/`BOT_SUITE_TEST` → `npm run test:staging:gated`), **9** piden un
Postgres desechable (`LIBRO_PG_URL`) y **1** no puede crear un enlace a fichero en esta máquina
(EPERM: Windows lo exige elevado) **y dice que su mecanismo queda cubierto por el control positivo
portable que sí corre**. Ninguno es un salto mudo.

`npm run meta:mutaciones` sobre el mismo árbol → **90 vivas · 0 mudas · 0 ciegas · 0 ficheros
muertos**, salida 0, y las **tres** de este ticket nombradas una a una entre las vivas. (Antes de
mezclar eran **84**: las **6** que faltaban las trajo `main`, no este ticket.)

> **El ancla se movió durante el ticket, y se dice cuál es cuál.** Todo lo de abajo se midió
> primero contra `ff4e1c4a14f474d0fb4095cb0643e069388e4935`; mientras se medía, `main` avanzó a
> `95be56e4…` (entraron SCRUM-767, SCRUM-775 y SCRUM-791). La rama **se mezcló con `main`** y
> **todo se volvió a medir encima**. Los DELTAS —qué registra cada pantalla, qué abre la tecla,
> cuántos caracteres tiene cada rótulo— no dependen de eso; los ABSOLUTOS (recuento de la tanda)
> son los del árbol mezclado.

> La entrada de arriba se escribió con el ticket PARADO en tres de cinco. La firma ya está, y dice
> exactamente lo que se midió: **Trabajos y Gastos SÍ; Productos y Proveedores NO, y su rótulo no
> se toca.** Con estas palabras del fundador:
>
>   > «Colgar N de un botón que confirma es atar una tecla a un guardado. **N abre, no guarda.**»

## Lo que ya estaba hecho, verificado obligación por obligación

**No se ha vuelto a escribir nada de lo que ya funcionaba.** Se ha comprobado contra el árbol:

| obligación | estado | cómo se comprobó |
|---|---|---|
| ① registrar «N» en Trabajos y Gastos, mismo mecanismo | **ya estaba** | `jobsView.js:62-63` y `expensesView.js:127-128`, los dos con `etiquetar` + `registrar` de la pieza. Seis listas registradas en total |
| ② los dos rótulos, literales firmados | **ya estaba** | «Nuevo trabajo» = **13 caracteres / 13 bytes** (`4e7565766f2074726162616a6f`) · «Nuevo gasto» = **11 / 11** (`4e7565766f20676173746f`). Idénticos a la firma, con control positivo del comparador |
| ③ probarlo con teclado real | **faltaba** | hecho, abajo |
| ④ el motivo escrito en Productos y Proveedores | **faltaba** | hecho: comentario en los dos ficheros, con la frase del fundador |

## ③ La «N», con teclado REAL — y ejecutando el despacho del producto

No es una copia del manejador: el bloque `document.addEventListener('keydown', …)` **se extrae de
`app.js` y se ejecuta**. Si no aparece exactamente uno, el banco se declara ciego.

| lista | `appState.view` | qué abre la «N» |
|---|---|---|
| Trabajos | `jobs` | **el alta de Trabajo** ✅ |
| Gastos | `expenses` | **el alta de Gasto** ✅ |
| Productos | `products` | 🔴 **la cotización rápida** |
| Proveedores | `providers` | 🔴 **la cotización rápida** |

**✅ CONTROL NEGATIVO:** escribiendo `nuevo` en un campo de texto, el campo queda con `"nuevo"` y
**no se abre nada**.

**✅ CONTROL POSITIVO:** las cuatro listas que ya tenían «N» —presupuestos, facturas, clientes y
albaranes— la conservan, con su tecla pintada.

## ⚠️ Un dato del encargo que NO cuadra: «no hace nada» son dos cosas

El encargo pedía comprobar que **«pulsar N en Productos y en Proveedores NO HACE NADA»**. Medido:
**no hace nada de esas pantallas, pero sí hace algo** — cae al respaldo de `app.js` y **abre la
cotización rápida**.

No es un defecto nuevo ni de este ticket: es el respaldo que **SCRUM-599 dejó a propósito**
—*«quitarlo sería retirarle un atajo a quien ya lo usa»*— y afecta a **toda** vista sin destino
registrado, no sólo a estas dos.

**No se toca, porque retirarlo es una decisión de producto que cambia el comportamiento en
pantallas que este ticket no ha medido.** Se deja **caracterizado** en el guard: el día que se
decida, alguien tendrá que venir a cambiar ese test, y no se podrá cambiar en silencio.

## ④ El motivo, escrito donde se tropieza con él

En `productsView.js` y en `providersView.js`, pegado a su `createBtn`: que **no** llevan atajo, la
frase del fundador, el motivo medido (el formulario está siempre visible y ese botón **confirma**),
por qué su rótulo tampoco se toca, y un **⛔ si vienes a arreglar el hueco: no lo es**.

## La firma retirada, corregida en el registro

`docs/microcopy/2026-09-06-SCRUM-769-las-cinco-pantallas.md` decía que los **cinco** estaban
aprobados y tres «sin aplicar». **Ya no es cierto**: el fundador retiró la firma de tres. Se
corrige **encima y fechado**, sin reescribir la historia — un registro que dijera «aprobado» sobre
un texto sin firma es justo la mentira que ese directorio existe para impedir.

## 🔴 Y ESA CORRECCIÓN SE LLEVÓ POR DELANTE LAS DOS FIRMAS BUENAS — lo cazó un guard de la casa

**No es una anécdota: es el defecto de esta sesión, y lo encontró la tanda, no la lectura.**
`tests/scrum726-quien-firma-la-microcopy.test.mjs` se puso rojo:

```
+ [ 'docs/microcopy/2026-09-06-SCRUM-769-las-cinco-pantallas.md → firmante: null' ]
- []
```

Al reescribir la cabecera para contar la retirada **desapareció la línea de firma** —`Aprobados por
el fundador`, la única forma que `firmanteDe()` acepta, y sólo **fuera de las citas**—. El registro
pasó a no tener firmante: sus literales dejaban de contar como aprobados, **todos**, incluidos los
dos que sí lo están.

Y al medirlo apareció una **segunda mitad que ningún guard vigilaba**: la cabecera de la tabla
también había cambiado de `Texto aprobado` a `Texto`, y el extractor **sólo lee esa columna**. Con
las dos juntas, `constaAprobado('Nuevo trabajo')` contestaba `[]`. **Nadie lo habría notado**:
ninguna prueba preguntaba por estos dos literales.

**La forma correcta, y por qué es la correcta:** el registro lleva ahora **DOS tablas**.

| tabla | cabecera de la columna | qué produce |
|---|---|---|
| los **dos firmados** | `Texto aprobado` | los extrae → cuentan como aprobados |
| los **tres retirados** | `Texto que se propuso` | **no** los extrae → no cuentan, que es lo que dejaron de ser |

No es un truco: el extractor lee esa columna **desde SCRUM-709**, y una firma parcial no tenía
forma de escribirse. Ésta la tiene, y la tabla de los retirados lo dice en su propio párrafo para
que nadie «unifique» las dos.

**Medido después, con control positivo y negativo en el mismo sitio:**

```
firmante del registro : "fundador"
literales que extrae  : ["Nuevo trabajo", "Nuevo gasto"]     ← exactamente los dos firmados
Nuevo trabajo   → ["docs/microcopy/2026-09-06-SCRUM-769-…"]
Nuevo gasto     → ["docs/microcopy/2026-09-06-SCRUM-769-…"]
Nuevo producto  → []      Nuevo proveedor → []      Nuevo albarán → []
control (texto inventado) → []
```

Queda **sujeto** por `SCRUM-769 · 🔴 el registro de microcopy declara firmados EXACTAMENTE los dos`,
que cae por los dos lados: si **faltan**, la firma buena se ha vuelto a caer; si **sobran**, los
retirados han vuelto por la puerta de atrás. Y su mutación declarada es justo esa puerta —cambiar
la cabecera de la tabla de retirados a `Texto aprobado`—, **verificada viva**.

**De paso, y medido:** tres líneas de prosa citadas con `>` en ese mismo fichero se estaban leyendo
como «textos aprobados». Pasadas a prosa: el registro extrae ahora **2** literales en vez de 5, y
el total del directorio baja de **200 a 197** — ninguno de los tres era un literal de pantalla.

## Lo que NO se ha tocado

⛔ La ficha del Trabajo y su «+ Nuevo albarán» · ⛔ `productsView` y `providersView` más allá del
comentario · ⛔ ningún literal · ⛔ el respaldo de `app.js`.

## Huecos declarados

1. **El puente del banco de teclado.** La pieza y el despacho son del producto; **quién registra
   qué** se mide montando las vistas reales en el banco y se **replica** en la página. La ruta
   completa —`initApp()` con sesión— sigue sin ejercitarse.
2. **`openQuickQuoteModal` es un doble** en ese banco: se cuenta que se llama, no se abre la
   cotización de verdad.
3. **Una sola anchura (929 px)** en la prueba de teclado: mide comportamiento, no caja.
4. 🔴 **La firma se lee por FICHERO, no por fila.** `firmanteDe()` contesta «fundador» para todo el
   registro; **una retirada parcial no cabe en ese dato**. Hoy lo salva la forma —los retirados
   viven en una tabla que el extractor no lee— pero eso es una **convención**, no algo que el
   lector entienda. Si mañana hay un registro con la mitad firmada, el instrumento seguirá
   diciendo «fundador» de todo. Se declara; darle al lector un firmante por fila es otro ticket.
5. **`productsView` y `providersView` sólo llevan un COMENTARIO.** Lo que impide que alguien les
   cuelgue la «N» es el guard, no el código: nada en la pieza rechaza que se registre una vista
   cuyo botón sea un envío. Un `registrar` con destino comprobado sería «imposible» en vez de
   «vigilado»; hoy es lo segundo, y se dice.

## Ficheros

| fichero | qué cambia |
|---|---|
| `public/dashboard/js/productsView.js` | **sólo un comentario** sobre su `createBtn`: no lleva «N», la frase del fundador, el motivo medido y un ⛔ para quien venga a «arreglar el hueco» |
| `public/dashboard/js/providersView.js` | ídem, más la nota de que su bloque ya se titula «Nuevo proveedor» |
| `tests/scrum769-el-motivo-de-las-dos-que-no.test.mjs` | **nuevo** · 7 pruebas: los dos rótulos carácter a carácter, quién registra y quién no sobre las vistas reales, el motivo escrito en las dos pantallas, el registro de microcopy con los dos firmados exactos, el control positivo de las cuatro que ya tenían «N», y el respaldo de `app.js` **caracterizado**. Declara **3** mutaciones, las tres **vivas** |
| `docs/microcopy/2026-09-06-SCRUM-769-las-cinco-pantallas.md` | la retirada de tres firmas, **con la línea de firma restaurada** y la tabla partida en dos |
| `docs/master/SCRUM-769.md` | este apéndice |
