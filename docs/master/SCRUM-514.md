# SCRUM-514 · Los textos aprobados que no llegaban a la pantalla

**Fecha:** 3-sep-2026 · **Carril:** microcopy (regla 30) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `09fb0c5b2988b6b658204c48f4e6f8e10568ea1d` · 2026-09-03T14:05:18+01:00

**Tanda:** **5.010 pruebas · 4.926 en verde · 0 fallos · 84 saltadas** — con `main` mergeado dentro
y medida DESPUÉS del último cambio de código.

---

## 🔴 LO PRIMERO: NO QUEDABA NADA POR APLICAR

El encargo decía que un fontanero está leyendo **ahora mismo** rótulos con
`[PENDIENTE microcopy oficial]` en pantallas cuyo texto el fundador firmó hace tres semanas, y que
quedaban **once pantallas pendientes**.

**Se midió contra la fuente —que es la única que manda (regla 30)— y la premisa está caída.** La
propia cabecera de `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` ya lo decía en su primera línea:
*«Estado: aplicado todo lo de las tandas A–E»* y *«13 marcadores siguen vivos y NO son un
descuido: son los fiscales y aparcados»*.

### El cruce, sistemático y no por muestreo

| | |
|---|---|
| textos aprobados extraídos de las tablas de la fuente | **97** |
| ficheros de `public/` y `src/` barridos | **351** |
| **aprobados que NO aparecen en el código** | **3** |

Y los tres estaban ya decididos:

| texto | qué es |
|---|---|
| `Modo no reconocido` | respaldo del **modo de emisión** (`settingsView.js:213`) — **regla 26**, aparcado |
| `No hemos podido identificar qué emite esta cuenta…` | la otra mitad del mismo respaldo (`:219`) — regla 26 |
| `{N} facturas` | **falso positivo del cruce**: es una PLANTILLA y el código la COMPONE (`n + ' facturas'`, `libroRegistroView.js:49`). **Aplicada.** |

## Las tres trampas del encargo, medidas una a una

| lo que decía el encargo | lo medido |
|---|---|
| «quedan dos multilínea: `quoteSuplido.js` y `portabilidadCompleta.ts`» | **cero marcadores en los dos**. Ya aplicados. |
| «`exportView.js:330` no estaba en la lista; aplica las dos líneas» | **el texto ya está aplicado**, y la segunda línea la **RETIRÓ el fundador el 17-ago**: *«no se aplica ni se aplicará»*, con su motivo (pagar `white-space: pre-line` por un adorno). **Aplicarla habría reabierto una decisión cerrada.** |
| «el fichero tiene 81 textos, no 88» | mi extractor saca **97 celdas** de las últimas columnas de **todas** las tablas, addenda de septiembre incluidos. **No es comparable con el 81 sin definir la unidad**, y no fuerzo la comparación: un recuento heredado no es un dato mío, y uno mío sin unidad declarada tampoco. |

## Y de los 14 marcadores vivos, ninguno tiene texto aprobado

El censo de SCRUM-402 declara **14 marcas pintadas en 14 ficheros**, y su test está en verde.
Cruzados con la fuente:

* **10 no aparecen en ella**: son marcadores de trabajo, sin aprobación que aplicar.
* `exportView.js` (4 marcas escritas) → **libro de facturas emitidas**, fiscal. No se toca.
* `libroRegistroView.js` · `settingsView.js` (`PENDIENTE_MODO_EMISION`) · `semaforoFiscal.js`
  (`PENDIENTE_ASESOR`) → **aparcados por enumeración explícita** del encargo.
* `jobDetailView.js` → el propio censo lo explica: el fundador firmó «Parte de trabajo» y **no** el
  aviso de cuando no se puede abrir el parte, que es el que sigue marcado.

> **No se aplicó ni una pantalla, y la regla dura del encargo se cumple por partida doble:** «se
> para en pantalla completa, nunca a mitad». Aquí no había ninguna que empezar.

---

## Lo construido: la otra mitad de la regla 30

El ticket nació porque **nadie sabía qué quedaba**, y responderlo exigía un cruce a mano que
caducaba al día siguiente. Eso es lo que se cierra:

* **SCRUM-402** vigila que no se **pinte** un marcador sin aprobar.
* **Éste** vigila que todo lo **aprobado** esté pintado.

Hasta hoy sólo existía la primera mitad: se podía aprobar un texto, no aplicarlo nunca, y **ninguna
tanda decía nada**. Es exactamente lo que pasó tres semanas con los rótulos del 17-ago.

**La lista NO se copia al test**: se lee de la fuente en cada ejecución, así que el guard cambia con
ella sin que nadie lo actualice. Lleva **suelo por los dos lados** —que la fuente se lea y que el
corpus se barra— y un control de que el cruce **sabe decir sí y sabe decir no**: sin eso, un cero
podría ser un corpus vacío.

Los **aparcados van con su motivo y con quién los desbloquea**, y hay un aserto que los saca de la
lista el día que se apliquen: una excepción que sobrevive a su motivo parece una decisión y ya no
protege nada.

### El rojo, probado por el mecanismo — cuatro mutaciones con post-condición

| se rompe a propósito | cae |
|---|---|
| un texto aplicado se cambia por otro **plausible** (`Volver a generar el PDF` → `Regenerar el PDF`) | el guard, **nombrando el texto** |
| lo mismo en otra pantalla (`Cobrar por Bizum` → `Cobro con Bizum`) | el guard, **nombrando el texto** |
| un **aparcado se aplica** | «cada APARCADO sigue sin aplicar», nombrándolo |
| el extractor deja de leer las tablas | el **suelo**, antes de que un cero falso pase por bueno |

Y dos **controles negativos**: un texto que sólo vive en el código no cuenta como aprobado —el guard
mira en una sola dirección—, y el extractor no se traga rutas ni constantes.

## 🔴 Y EL GUARD CAZÓ ALGO EL DÍA QUE NACIÓ — una DIVERGENCIA DE APROBACIONES

Al mergear `main` (10 commits nuevos) el guard se puso rojo con **«+ Nueva factura»**, y no es un
olvido: **es el mismo rótulo aprobado dos veces con distinta grafía.**

| dónde | qué dice | cuándo |
|---|---|---|
| la fuente, Bloque 6 | `+ Nueva factura` (con el «+») | 17-ago-2026 |
| el código, tras **SCRUM-599** | `Nueva factura` (sin el «+») | 3-sep-2026 |

**Lo trajo mi propio ticket anterior**: en SCRUM-599 se aplicó el literal que dio el asesor en
aquel encargo, sin que nadie mirara que la fuente ya tenía ese rótulo aprobado con el «+».

🔴 **No lo decidí yo**: las dos eran aprobaciones, y la regla 30 dice que el microcopy lo aprueba
el asesor **sin excepción**. Se declaró en `APARCADOS` esperando su palabra.

### ✅ DECIDIDO el 3-sep-2026: gana `Nueva factura`, SIN el `+`

El motivo, y queda en la **fuente** para que nadie lo revierta: SCRUM-599 aprobó los **cuatro**
botones primarios de la misma familia —`Nuevo presupuesto`, `Nuevo albarán`, `Nueva factura`,
`Nuevo cliente`— medidos en navegador real. **Dejar el `+` en uno solo rompe la familia**, y en un
botón el `+` no informa: el botón ya se ve como botón.

> ⚠️ **Y lo que NO es una incoherencia:** en **SCRUM-591** se aprobó `+ Nuevo cliente` **CON** `+`
> y **se queda**. Allí es una `<option>` dentro de un `<select>` lleno de nombres de clientes, y el
> `+` es **lo único** que distingue una acción de un nombre. **Botón sin `+`, opción de lista con
> `+`.** Uniformarlos rompería el que sí informa.

**El código ya estaba bien y no se ha tocado.** Se corrigió la **fuente** (commit propio, SCRUM-709)
y se **borró la entrada de `APARCADOS`**: el guard vuelve a vigilar ese rótulo sin excepción.

> Es la mejor prueba de que el guard hacía falta: **nació y en dos horas encontró una divergencia
> que nadie había visto**, incluida la que yo mismo introduje ayer.

## 🔴 Y AL MERGEAR, EL GUARD NACÍA CIEGO DE UN OJO

Con `main` entró **SCRUM-709**, que parte la fuente en **dos**: `docs/microcopy/` —una aprobación,
un fichero, donde van las NUEVAS— y el registro, ahora **congelado**. Este guard leía **sólo el
congelado**, que es exactamente la ceguera que ese módulo avisa: *«un lector que mirase sólo uno de
los dos daría no consta sobre aprobaciones reales»*. Un texto aprobado hoy y no aplicado **no lo
habría visto nadie**, que es justo para lo que existe este guard.

Se arregla usando **su** lector (`_microcopy-aprobada.mjs`) y **no un segundo barrido propio**: dos
barridos de lo mismo divergen. De cada sitio se extrae lo que ese sitio usa —la última columna de
las tablas en el registro; las **citas bajo «Texto aprobado»** en un fichero de aprobación—, y las
citas se limitan a esa sección a propósito: el registro está lleno de notas en `>` que no son copy.

> **Comprobado que no es decorativo**, que era lo fácil de dar por hecho: al cambiar el texto
> aprobado en `docs/microcopy/2026-09-03-SCRUM-402-abrir-parte-fallo.md` por otro plausible, el
> guard **cae y lo nombra**. Ve el sitio nuevo de verdad.

## La fuente, corregida (commit propio)

El addendum de la dirección de facturación decía **«APROBADAS, NO APLICADAS»** y daba SCRUM-579 por
parado con el `ALTER` sólo en DEV. **Era cierto cuando se escribió el 2-sep**; ese ticket se cerró
después y el renglón se quedó atrás, así que **la fuente única llevaba un día mandando aplicar algo
que ya estaba hecho**. Medido por contenido —no por número de línea— antes de tocarlo: las cinco
etiquetas están en `customersView.js`, una vez cada una.

Va en **commit propio y sólo de la fuente**, por SCRUM-709: ese fichero ha chocado siete veces en
dos días.

## Ficheros

`tests/scrum514-aprobado-y-aplicado.test.mjs` (**nuevo**, 6 tests) ·
`docs/MICROCOPY_APROBADA_SIN_APLICAR.md` (corrección de estado, commit aparte) · esta entrada.

**No se ha tocado:** ni un texto de pantalla —no había ninguno que aplicar— · los 38 marcadores
fiscales · `libroRegistroView` · `semaforoFiscal` · `settingsView` · `prisma/schema.prisma` · el
camino de emisión · `quotesView.js` (SCRUM-591 y 594 en vuelo) · `scripts/_suelo-de-la-tanda.mjs`.

## Los huecos que declaro

1. **El cruce es por SUBCADENA sobre el código fuente**, no por AST: un texto aprobado que
   apareciera sólo dentro de un comentario contaría como aplicado. No he medido si eso pasa hoy.
2. **Las plantillas quedan fuera del cruce** (las que llevan `{…}`). El guard no puede afirmar nada
   de ellas más allá de su parte fija; `{N} facturas` está aplicada, pero lo comprobé a mano.
3. **No he verificado en pantalla real** ninguno de los textos: el guard mira el código, no el
   navegador. Que un rótulo esté en el fuente no prueba que se pinte — eso lo mira SCRUM-402 por su
   lado, y las dos mitades juntas siguen sin ser «lo he visto con mis ojos».
4. **No cuadré el 81 del encargo.** Mi número mide otra cosa y lo digo en vez de forzar la
   comparación; qué partidas agrupa el fichero frente a lo que contó quien dijo 81 no lo sé.
5. **El extractor sólo lee TABLAS.** Un texto aprobado escrito en prosa o en un bloque de código
   suelto dentro de la fuente no entra en el cruce.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `exportView.js:328` lleva un comentario que dice «Microcopy PROPUESTA, sin aprobar» justo encima del texto que **sí** es el aprobado desde el 17-ago: quien lo lea puede «corregir» un texto firmado creyendo que es un borrador.
* La cabecera de la fuente dice «13 marcadores siguen vivos» y el censo de SCRUM-402 declara hoy **14** (entró `jobDetailView.js` con el Sprint Tecnosel): los dos números miden cosas distintas, pero el 13 ha envejecido y ya no cuadra con nada.
* El censo de SCRUM-402 cuenta **1** para `exportView.js` mientras el fichero tiene **4** literales `[PENDIENTE` pintados: su detector cuenta por otra unidad, y esa diferencia no está explicada en ninguno de los dos sitios.
