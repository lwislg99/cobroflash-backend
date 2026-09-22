# SCRUM-875 · Las tres cajas que perdió el guard del 776, recuperadas montando la página de verdad

**Medido contra:** `origin/main` = `e62cd0db8876a4aef48139860b6072907caeca41` · 2026-09-16T12:45:56+02:00
**Rama:** `scrum-875-las-tres-cajas-de-la-pagina`, partida de ese `main`.
**Encargo (decisiones del fundador sobre lo que SCRUM-867 dejó dicho):**
1. `ariaDialogo()` **se retira**: una página no es un diálogo.
2. `guard:caja-documento-suelto` recupera las tres cajas que perdió con el modal —**montando la
   página de verdad**, cada una con su rojo—. Si alguna no se puede medir sin reproducir, se dice y
   queda declarada.

---

## 1 · PASO 0 · ¿se puede montar la página sin reproducirla? **Sí, y ninguna caja ha hecho falta reproducirla**

Desde SCRUM-867 el guard medía dos cajas de cinco: título, acción primaria y error al emitir vivían
en el modal retirado. Hoy las pinta la **página** del documento suelto, y el guard la monta así:

| pieza | de dónde sale |
| --- | --- |
| los scripts | **los del índice**, derivados de `public/dashboard/index.html` y cargados en su orden —como `guard-marcadores-en-pantalla`—, no una lista escrita en el guard |
| la página | **`renderDocumentoSueltoView`**, la misma función que llama el router |
| el título y el botón | los **nodos reales**: `h2.quotes-title` y `button.btn.btn-primary` |
| el error | **su camino real**: se rellena el documento, se pulsa «Emitir», la API contesta 500 sin mensaje y la página pinta su aviso con `setAlert` → `rotulosDelDocumento.errorAlEmitir()`. **No se inyecta texto** |
| lo único de la PRUEBA | la **sesión** y la **API**, que las sirve el propio guard |

**Excluido y DECLARADO:** `onboardingView.js`. El asistente de alta se planta encima de todo cuando
cree que el merchant es nuevo y taparía la página que se mide; `guard-marcadores-en-pantalla` lo
excluye por lo mismo.

### La primera corrida: las cinco cajas caben

| pantalla | caja | justificante @929 | justificante @390 | factura @929 | factura @390 |
| --- | --- | --- | --- | --- | --- |
| listado | título de listado | 633×46,5 · 1 l. | 366×46,5 · 1 l. | 633×46,5 · 1 l. | 366×46,5 · 1 l. |
| listado | columna Nº | 101,1×23,3 · 1 l. | 78,3×46,5 · 2 l. | 86,2×23,3 · 1 l. | 50,0×46,5 · 2 l. |
| **página** | **título de la página** | 591×26,3 · 1 l. | 324×26,3 · 1 l. | 591×26,3 · 1 l. | 324×26,3 · 1 l. |
| **página** | **botón primario** | 186,9×36 | 186,9×44 | 151,6×36 | 151,6×44 |
| **página** | **error al emitir** (59 / 54 car.) | 591×42,3 · 2 l. | 324×62,5 · 3 l. | 591×42,3 · 2 l. | 324×62,5 · 3 l. |

Envolver en varias líneas NO es un hallazgo; desbordar o salirse del viewport, sí. El «2 líneas» del
botón no es envolver: el relleno infla su alto, y el árbitro es `scrollWidth > clientWidth`.

---

## 2 · Los suelos de la página: si alguno falla, NO hay número

* **El CSS del árbol se aplicó** (el sidebar computa ancho).
* **El detector sabe decir que no, en CADA pantalla**: una caja de 80 px con una frase de 59
  caracteres tiene que salir desbordada, también en la página montada.
* **La página se montó**: más de 80 nodos.
* **Cada texto medido es IDÉNTICO al rótulo de la fuente** en ese modo. Si no, se estaría midiendo
  otra caja.
* **El alta llegó a la red**: el «Emitir» tiene que haber hecho exactamente un `POST /admin/invoices`.
  Si no, el aviso medido sería el de otra cosa —una validación del formulario, por ejemplo—.

---

## 3 · Las tres cajas recuperadas, cada una con su rojo

Instrumento: `docs/master/evidencias/SCRUM-875/rojos-875.mjs`, sobre el guard ya comiteado
(`ac0cdc55`). Para cada caja añade al final de `styles.css` una regla que la obliga a desbordar
(ancho fijo, `nowrap`, `overflow: hidden`), corre el guard y exige **exit 1**, que el hallazgo nombre
**esa** caja y que **no** nombre las otras dos. Después restaura `styles.css` byte a byte.

| rojo | regla añadida | exit | cajas que caen |
| --- | --- | --- | --- |
| base | — (CSS intacto) | **0** | ninguna |
| a | `.quotes-title` estrecho | **1** | **título de la página**, sola |
| b | `.btn.btn-primary` estrecho | **1** | **botón primario**, sola |
| c | `.alert.error` estrecho | **1** | **error al emitir**, sola |

Tras los tres: `styles.css` restaurado byte a byte.

---

## 4 · `ariaDialogo()` se retira

* **`rotulosDelDocumento.js`**: fuera la función. Su único consumidor era el modal viejo (medido en
  SCRUM-867).
* **`scrum776`**: seis firmados en lugar de siete. La excepción `SIN_CONSUMIDOR_DESDE_867` pasa a ser
  **`RETIRADOS`**, con un test que impide que la función vuelva a la fuente sin firma. **Probado en
  rojo**: devuelta la función a la fuente, ese test cae; restaurado el fichero —mismo blob—, verde.
* **`scrum514`**: «Crear una factura nueva» está **aprobado** en el registro congelado
  (`docs/MICROCOPY_APROBADA_SIN_APLICAR.md`, fila 44) y deja de estar aplicado. Se **aparca con su
  motivo**; **no se desaprueba**, porque la firma ocurrió. Si algún día hay un diálogo, su texto se
  aprueba entonces.
* **`scrum601`**: **medido, no se mueve.** Esos dos literales ya no contaban en el censo desde que
  SCRUM-867 los dejó sin consumidor. Se dice porque lo esperable era que bajara, y no bajó.

---

## 5 · Lo que queda declarado

* **Nada de la PÁGINA se ha reproducido.** Las tres cajas se miden sobre sus nodos reales.
* **Las dos cajas del LISTADO siguen como las dejó SCRUM-776**: una tabla con las clases y el CSS del
  árbol cuyas dos celdas se escriben desde la fuente única, no la vista `renderInvoicesView` montada.
  No son parte de este encargo y no se han tocado; queda escrito para que nadie crea que el guard
  entero monta pantallas.
* **Guard fuera de `npm test`**, como hasta ahora: la suite no arranca navegador. Lo corre en cada PR
  el job «guards de navegador» del CI.

---

## 6 · Lo que NO se ha tocado

* Ni una línea de `quotesView.js`, `invoicesView.js` ni de la emisión. El `POST /admin/invoices` que
  el guard provoca lo contesta **su propio servidor de prueba**: no sale de la máquina.
* `styles.css`: sólo se muta dentro del instrumento de rojos, y se restaura byte a byte.
* **Cero producción y cero staging.**

## Tests que introduce esta entrada

* `tests/scrum776-una-sola-voz.test.mjs` — **modificado**: seis firmados, `RETIRADOS` y el test que impide que `ariaDialogo()` vuelva sin firma.
* `tests/scrum514-aprobado-y-aplicado.test.mjs` — **modificado**: «Crear una factura nueva» aparcado con su motivo.
