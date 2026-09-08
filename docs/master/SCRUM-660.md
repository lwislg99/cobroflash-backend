# SCRUM-660 · El IVA por defecto del documento también se elige

**Medido contra:** `origin/main` = `49e9375a4f545600f6b2ebe06b9ce236950cc368` · 2026-09-02T12:15:08Z

> ⚠️ Rama **apilada sobre `origin/scrum-611-tipo-iva-elegible`**, que NO está mergeada. El motivo
> está en §1: el motor de este ticket vive ahí, y construir sobre `main` habría duplicado la lista
> de tipos.

---

## 1 · PASO 0 — lo que se midió antes de una línea de código

### ENTRADA · desde dónde llega el usuario

`public/dashboard/js/quotesView.js:385` — el campo **«IVA por defecto (%)»** del editor de
presupuesto, dentro del bloque de Líneas. Se pinta al abrir «Crear presupuesto»
(`renderQuotesView`), y **no hay otra puerta**: no existe en ninguna otra pantalla ni en ajustes.

### MECANISMO · ¿existe ya construido?

**Sí, y ése es el hallazgo que cambió dónde había que trabajar.** SCRUM-611 construyó
`public/dashboard/js/tiposDeIva.js` —`montar()`, `ponerValor()`, `opciones()`, con los cuatro
tipos españoles en **un solo sitio**— para el selector de la LÍNEA. Su propio comentario nombra
este ticket:

> «el "IVA por defecto" del documento es otro campo LIBRE (`quotesView.js:385`)»
> y «La lista vive en `tiposDeIva.js`, en UN SOLO SITIO, para el día del IGIC (SCRUM-646).»

### 🔴 Y una premisa del encargo que NO se sostiene sobre el árbol

El encargo dice «SCRUM-611 ya está en main». **No lo está**, y se comprobó de tres formas:

| Comprobación | Resultado |
|---|---|
| ¿el IVA de la línea es un `<select>` en `main`? | **No**: `document.createElement("input")`, `type="number"` |
| ¿está mergeada `origin/scrum-611-tipo-iva-elegible`? | **No** (`merge-base --is-ancestor` dice que no) |
| ¿hay algún commit de 611 en `main`? | **No**. El único «611» del histórico es el **PR #611**, que es de SCRUM-428 |

**Consecuencia práctica:** construir sobre `main` obligaba a escribir un segundo `[21, 10, 4, 0]`
—exactamente el defecto que `tiposDeIva.js` existe para impedir— y dejaba el control visual de
«los dos selectores» sin un segundo selector que mirar. Por eso esta rama se **apila sobre 611**:
el protocolo dice que si el motor existe, el trabajo es **darle superficie, no rehacerlo**.

## 2 · Las cuatro mediciones que pedía el encargo

### ① Qué valores distintos tiene hoy el campo — **la pregunta no se puede contestar como está**

**`vat_default` NO EXISTE EN LA BASE.** No hay columna en `quotes` ni en `merchants`, y no
aparece en `src/`: vive **sólo en el autoguardado del navegador** (`localStorage`). Un censo «en
las tres bases» del campo mediría un cero que no significa nada.

Lo que **sí** llega a la base —y al PDF, y al importe que el cliente firma— es el `tax` de cada
LÍNEA, que es donde ese valor tecleado acaba teniendo consecuencia. Ahí se censó, por identidad:

| Base | Resultado |
|---|---|
| dev | `0` (3 líneas) y `0.21` (9 líneas) — **todos tipos válidos** |
| staging | `0` (9 líneas) y **1 línea de presupuesto + 1 de factura SIN la clave `tax`** |
| producción | *(no se ejecutó desde aquí: ninguna clave de este árbol va a producción)* |

### 🔴 EL SUELO · el cero está medido, no supuesto

Un cero sin control positivo es una pregunta sin responder. Se escribió **a propósito** un
`tax: 2.1` (el 210 % que saldría de teclear «210» en el campo) en un presupuesto de DEV:

```
ANTES   · filas con veredicto raro: 0
DURANTE · filas con veredicto raro: 1
          presupuesto · valor=2.1 · *** FUERA DE RANGO: >1 (parece un % sin dividir) ***
          ✅ lo caza
RESTAURADO · id=1: BYTES IDÉNTICOS al original · filas raras: 0
```

La mutación llevó **post-condición**: se comprobó que había cambiado **ese** presupuesto, no
«alguno», y la reversión se verificó con `Buffer.compare`.

### ② CUÁNDO se propaga a las líneas — **al crear, y NO reescribe lo ya escrito**

* `addLine` lee `fieldVatDefault.input.value` **al crear** la línea, sólo como reserva.
* El oyente del campo **no toca las líneas existentes**: su propio comentario lo dice
  («actualizar IVA de nuevas líneas, pero no tocamos las existentes») y sólo repinta y autoguarda.

**El segundo defecto que el encargo temía —que cambiar el defecto reescribiera líneas ya
escritas— NO EXISTE.** No hay nada que reportar aparte.

### ③ ¿Puede el documento acabar con un tipo que ninguna línea usa?

**Sí, pero no queda huérfano en ninguna parte**, porque el campo no se persiste (§①). Si el
profesional cambia el defecto y no crea líneas nuevas, ese valor muere con la pestaña. El campo
es una **reserva de UI**, no un dato del documento — y eso es lo que hace que cerrarlo sea barato.

### ④ Los caminos de LLAMADA, no sólo los de datos

`addLine` —que es quien lee el defecto— se invoca desde **ocho** sitios: el cuadernillo inicial,
el botón «+ Añadir línea», la restauración del **borrador**, las **plantillas**, las líneas
sugeridas por la **IA**, el duplicado, la conversión desde petición y el reset. Si el campo lleva
basura, esos ocho caminos la propagan.

**Y las plantillas NO llevan el defecto**: `QuoteTemplate` guarda `lines`, `tiers` y
`paymentTerms` — no hay `vatDefault`. Lo que viaja en una plantilla es el `tax` de cada línea.

## 3 · Qué se construyó

**Cuatro piezas, todas en `quotesView.js`, ninguna nueva:**

1. El campo pasa de `createField(... "number")` a `createFieldSelect` + `tiposDeIva`. **La lista
   NO se copia**: sale del módulo que ya existe.
2. `fieldVatDefault.input = fieldVatDefault.select` — el resto del fichero (seis sitios) sigue
   usando el mismo nombre. **Un diff de una pieza en vez de siete.**
3. 🔴 La restauración del borrador pasa a `ponerValor`, **no `.value`**. Un borrador puede traer
   un 16 % —`locale.defaultVat` estampa 16, 18 y 19 por país— y asignarlo a pelo a un `<select>`
   lo dejaría **en blanco**: el IVA del documento cambiaría solo, al restaurar, sin que nadie lo
   pida. `ponerValor` **añade** la opción que falta.
4. El oyente escucha `input` **y** `change`. Al elegir en un `<select>` el navegador dispara
   `change`; quedarse sólo con `input` dejaba algo que decide el IVA de las líneas siguientes
   colgando de un detalle del navegador.

**No es cerrado**, por la misma razón que el de la línea: esconder un 16 % cambiaría el IVA de un
documento sin que nadie lo pida. Los cuatro españoles siempre, y el que venga si no es ninguno.

### MICROCOPY: ninguna

El rótulo **«IVA por defecto (%)» no cambia** —ya estaba aprobado— y las opciones son NÚMEROS,
que son dato. **No hay marcador que declarar y el censo de SCRUM-402 no sube.** Poner un marcador
donde hay copy aprobada la sustituiría por un provisional, que es peor.

## 4 · 🔴 El hueco de SCRUM-611, cerrado — y lo que hizo falta para poder cerrarlo

611 declaró al entregar: *«son controles de fuente y de regla, no de pantalla. Si alguien dejara
el `<select>` sin insertar o tras un `display:none`, todos seguirían verdes. Necesita navegador.»*

Al ir a escribir ese control apareció el motivo por el que nadie lo había hecho:

> **`renderQuotesView` REVENTABA a media pintada en el banco de vistas**, con
> `window.addEventListener is not a function`. **Medido y preexistente**: pasa igual con la vista
> de `origin/main`, sin ningún cambio de producto.

La consecuencia era peor que un test de menos: la pantalla se pintaba hasta ese punto y paraba,
así que **sus líneas nunca llegaban a existir en el banco** y todo lo que vive en una línea era
estructuralmente inalcanzable para cualquier control de pantalla. Se añadió
`window.addEventListener`/`removeEventListener` al banco —guardando los oyentes, como hacen los
nodos, no tragándoselos— y la vista pasa a pintar **243 nodos sin error**.

### Y un segundo hallazgo, de diseño, que el control tuvo que respetar

El selector de IVA de la LÍNEA **no cuelga de la fila**: desde SCRUM-139 F4 vive en la **hoja de
ajustes**, que se abre con el chip «IVA 21 % · Margen …», y se monta en el `body`. Un control que
no pulsara habría dicho «no existe» y habría sido un **falso hallazgo**, no un defecto. El control
**pulsa**, como el profesional.

### El control, y su rojo

| Comprobación | Documento | Línea |
|---|---|---|
| es un `<select>` con los cuatro tipos | ✅ | ✅ |
| **insertado** en el documento | ✅ | ✅ *(tras pulsar el chip)* |
| **no oculto** — él ni ningún ancestro | ✅ | ✅ |

El detector de ocultación tiene su propio control: ve `display:none` **en el padre**, en el propio
nodo, `visibility:hidden` en `cssText` y el atributo `hidden` — y dice que se ve cuando se ve.

### ⚠️ HUECO DECLARADO, que este control NO cierra

**El banco no aplica CSS externo.** Un `display:none` escrito en `styles.css` para una clase de
estos nodos **no se detecta aquí**. Se cubre lo alcanzable desde el DOM —no insertado, ocultación
por estilo en línea o atributo—; el resto sigue necesitando navegador de verdad. **El hueco de
611 queda a medias cerrado, no cerrado**, y se dice con esas palabras.

## Tests que introduce esta entrada

* `tests/scrum660-iva-defecto-del-documento.test.mjs` — 8 pruebas: suelo del escáner, el
  `<select>` del documento con sus cuatro tipos, los DOS selectores insertados y alcanzables
  (pulsando el chip), los DOS no ocultos, el control del detector de ocultación, que un tipo no
  español se enseña en vez de perderse, que el borrador se restaura por `ponerValor`, y el
  control negativo del rótulo aprobado.
* `tests/_banco-vistas.mjs` — `window.addEventListener`/`removeEventListener`, sin los cuales
  `renderQuotesView` no se puede montar entera.
