# Los cinco rótulos del atajo «N» — trabajo, gasto, producto, proveedor y albarán

**Aprobados por el fundador** el 6-sep-2026, en **SCRUM-769**.
**Aplicados DOS de los cinco.** Los otros tres quedan aprobados y **sin aplicar**, con su motivo
medido más abajo. No es una acotación de alcance: es que la firma daba por hecho que los cinco
botones eran la misma clase de botón, y **tres no lo son**.

## Textos aprobados, literales

| Ranura | Texto anterior | Texto aprobado | ¿aplicado? |
|---|---|---|---|
| `atajoNuevo.TEXTOS.jobs` | Trabajo nuevo | **Nuevo trabajo** | ✅ sí |
| `atajoNuevo.TEXTOS.expenses` | + Nuevo gasto | **Nuevo gasto** | ✅ sí |
| `productsView` · `#pf-create-product` | Crear producto | **Nuevo producto** | ⛔ **no** |
| `providersView` · `#pf-create-provider` | Crear proveedor | **Nuevo proveedor** | ⛔ **no** |
| `jobDetailView` · botón primario | + Nuevo albarán | **Nuevo albarán** | ⛔ **no** |

Los textos van literales: mayúscula inicial, sin punto final y **sin el `+`**.

## Los dos aplicados — dónde se pintan

Los dos salen de **un solo sitio**, `public/dashboard/js/atajoNuevo.js` (`TEXTOS`), y de ahí los
recoge cada pantalla con `etiquetar`. Nada se reimplementa en línea: es el patrón de SCRUM-599 y el
defecto que SCRUM-768 quitó de `invoicesView`.

| Texto | Quién lo pinta | Cómo |
|---|---|---|
| Nuevo trabajo | `public/dashboard/js/jobsView.js` | `atajoNuevo.etiquetar(bNuevo, 'jobs')` + `registrar('jobs', …)` — abre el modal de Trabajo nuevo |
| Nuevo gasto | `public/dashboard/js/expensesView.js` | `atajoNuevo.etiquetar(expNuevoBtn, 'expenses')` + `registrar('expenses', …)` — abre `openExpenseModal(null)` |

### Las cajas, medidas en navegador real (Edge)

Con el CSS de producción y los contenedores reales de cada pantalla reproducidos —el `#jobs-nuevo`
de Trabajos y la barra de filtros de Gastos, que es la que le disputa el ancho al botón porque
lleva `margin-left:auto`—:

| Botón | 929 px · antes | 929 px · después | 390 px · antes | 390 px · después |
|---|---|---|---|---|
| Trabajos | 156,3 × 36,0 | **194,4 × 36,0** | 156,3 × 44,0 | **157,5 × 44,0** |
| Gastos | 161,4 × 36,0 | **179,9 × 36,0** | 161,4 × 44,0 | **143,0 × 44,0** |

* La tecla mide **22,9 × 20,0** a 929 px y **se oculta** a 390 (`styles.css` la apaga por debajo de
  640: en una pantalla sin teclado no significa nada). Por eso a 390 px Gastos **encoge** —pierde
  el `+ ` y no gana tecla— y Trabajos crece 1,2 px.
* **Ninguno se sale de su contenedor** y la página **no scrollea en horizontal** a ninguno de los
  dos anchos (929/929 y 390/390).
* **No pueden partirse en dos líneas**: `.btn-primary` computa `white-space: nowrap`. El único modo
  de fallo posible es salirse, y es el que se mide.
* **Control positivo del instrumento:** con un rótulo absurdo de 70 caracteres, el mismo medidor
  devuelve `seSale: true` a 390 px. Los cuatro `false` de arriba son un dato, no un silencio.

## ⛔ Los tres SIN APLICAR, y por qué — medido, no supuesto

`docs/MICROCOPY_APROBADA_SIN_APLICAR.md` está **congelado** (SCRUM-709), así que la parte sin
aplicar se declara aquí, en el mismo fichero que su aprobación.

### 1 y 2 · «Nuevo producto» y «Nuevo proveedor» — el botón es un **confirmar**, no un **abrir**

En `productsView` y `providersView` **no hay un botón que abra una creación**: hay un formulario en
línea **siempre visible**, y el botón primario es su **envío**.

* `providersView.js:213` — `<button class="btn btn-primary" id="pf-create-provider">Crear proveedor</button>`,
  dentro del bloque que ya se titula `<h3 class="quote-block-title">Nuevo proveedor</h3>` (línea 188).
* `providersView.js:409` — su manejador **lee los campos y crea**: `if (!name) return setAlert("error", "name_required")`.
* `productsView.js:480` — la misma forma, con `#pf-create-product`.

Dos consecuencias, y las dos piden decisión:

1. **El rótulo cambiaría de significado.** «Nuevo proveedor» es lo que se lee para **abrir** un
   alta; aquí rotularía el botón que la **confirma** — y en Proveedores quedaría el mismo texto dos
   veces seguidas: título del bloque y botón, a cinco líneas de distancia.
2. **El atajo «N» no encaja.** `registrar` ata la «N» a `boton.click()`; aquí eso **intenta crear**
   con lo que hubiera escrito en el formulario. Con los campos vacíos, la «N» dispararía un
   `name_required` en la cara del profesional.

### 3 · «Nuevo albarán» — hay **DOS** botones con ese texto, y el primario no es el que crea

Medido sobre el DOM ejecutado de `renderJobDetailView`: **dos** botones dicen «+ Nuevo albarán».

| botón | clase | quién escribe su rótulo |
|---|---|---|
| el que ve el censo | `btn-primary` | **`jobNextAction.js:67`** — la escalera aprobada de SCRUM-366 |
| el que da de alta | `btn-secondary btn-sm` | `jobDetailView.js:1157` |

El primario es el **CTA del héroe**, y su etiqueta **depende del estado del Trabajo**: hoy dice
«+ Nuevo albarán» porque no hay ningún albarán todavía; en otro peldaño dice «Cobrar el resto»,
«Recordar» o «Emitir». Además esa misma escalera alimenta la **lista** de Trabajos
(`jobsView.js:375`), así que retirarle el `+ ` cambiaría **dos pantallas**, no una.

Y el atajo tampoco encaja: atar la «N» al primario haría que la tecla dispare **lo que toque en ese
momento**, incluido `collect-rest` — o sea, **mover dinero desde una tecla**.

> La instrucción de la firma era «SÓLO se retira el +, la palabra no se toca, porque su hermana de
> la lista de albaranes sigue con `[PENDIENTE microcopy oficial]` esperando SCRUM-606». Eso se ha
> respetado al pie de la letra: **no se ha tocado ninguna de las dos**.

## Qué NO cambia

* **`SIN_APROBAR` sigue valiendo 1**, antes y después. Los dos rótulos que entran nacen **firmados**,
  así que suben el total de `TEXTOS` (de 4 a 6) y el de aprobados (de 3 a 5) a la vez. La única
  ranura a la espera sigue siendo `albaranes`, de SCRUM-606.
* **No se ha tocado `[PENDIENTE microcopy oficial] Nuevo albarán`** de la lista de albaranes.
* **Ningún otro literal de esas pantallas.** Ni títulos, ni columnas, ni estados vacíos.

## Lo que queda incoherente y NO es de este ticket

**El modal que abre «Nuevo trabajo» se sigue titulando «Trabajo nuevo»** (`jobNuevoModal.js:64`).
Los dos textos están aprobados —«Trabajo nuevo» consta en el registro congelado de SCRUM-715— y
ahora el botón y el título de lo que abre ya no dicen lo mismo. Se declara y se deja: cambiar el
título del modal es otra firma.
