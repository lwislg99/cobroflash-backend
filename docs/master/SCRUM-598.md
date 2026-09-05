# SCRUM-598 · DOC-08 · El margen sale del documento

**Fecha:** 2-sep-2026 · **Carril:** documento (línea y pie) + el re-anclaje de F9 · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `45a2474ce1816f6f5b6def92b5d2b1af59677082` · 2026-09-02T14:31:19+01:00

**Tanda:** 4427 tests, 4348 pass, 0 fail, 79 skipped (los 79 declaran su motivo) — medida DESPUES del ultimo cambio, entrada incluida.

---

## 🛑 LO PRIMERO: F9 NO SE RETIRA, **SE MUDA**. Y ÉSTA ES LA MITAD QUE LO HACE LEGÍTIMO

Al retirar el margen saltó `scrum600-un-solo-front-documento`:

> «SE HA PERDIDO **F9** (coste y margen existen en el producto (markup por línea)). El encargo de
> SCRUM-600 **lo declara innegociable**: si se ha quitado a propósito, **es cambio de máster ANTES
> de codificar**, no un borrado de paso.»

**El diagnóstico era correcto y sigue siéndolo:** F9 dice «coste y margen existen **EN EL
PRODUCTO**», y desde CAT-01 (SCRUM-609) el coste y el margen viven en el **catálogo**, con su campo
y su aritmética (`margenCatalogo.js`). Lo que este ticket retira es el margen del **DOCUMENTO**, que
es otra cosa. Lo que caducó fue el **ancla del detector**: apuntaba a `markupTd.appendChild(markupInput)`
dentro de `quotesView.js`, o sea que medía la capacidad **por su dirección vieja**.

**Pero ese detector ERA el mecanismo que hacía innegociable a F9.** Retirarlo sin sustituto
convierte una regla en una costumbre: mañana alguien quita el margen **del catálogo** y no salta
nada, y no lo sabríamos hasta que se quejara un profesional. Una retirada sin sustituto es media
retirada.

> **F9 SIGUE VIGENTE. Su detector CAMBIA DE DOMICILIO porque la capacidad cambió de domicilio.**
> No se ha tocado ningún umbral, no se ha relajado ninguna regla y la red de SCRUM-600 sigue
> teniendo **OCHO** entradas: siete ancladas por línea en `LOS_OCHO` y F9 con detector propio en
> `F9_EN_EL_CATALOGO`. Decisión de fondo: fundador, 24-ago-2026 (CAT-01).

---

## PASO 0

**ENTRADA.** El profesional llega al margen por **dos** sitios de la misma pantalla
(`public/dashboard/js/quotesView.js`), los dos detrás del **chip gris** de la fila:

| dónde | qué era |
|---|---|
| el chip de la fila | `resumenAjustes(...)` componía «IVA 21 % · Margen 20 %» — **decía IVA y contenía dos cosas** |
| la hoja «Ajustes de la línea» | el campo **Margen %**, entre SUPLIDO y el IVA |
| el pie de totales | la fila **«Margen 18,00 € (18 %)»** |

Y para el re-anclaje, la **entrada nueva**: el margen del catálogo se toca desde
`public/dashboard/js/productsView.js`, en **dos formularios distintos del mismo fichero** — el
**alta** (`id="pf-create-product"`) y la **edición** (`id="pf-edit-save"`).

**MECANISMO.** Estaba entero y funcionando en los dos sitios: en el documento el margen se leía de
la línea, multiplicaba el precio base, se agregaba en el pie y se guardaba en el borrador; en el
catálogo el margen **se deriva** de coste y precio (`margenCatalogo.js`) y se cablea a los dos
formularios. El trabajo era **retirar el del documento sin que se pierda nada por el camino** y
**darle superficie de vigilancia al del catálogo**, no rehacer ninguno de los dos.

---

## Las tres mediciones que el encargo pedía

### ① ¿El `markup` de un borrador VIEJO tiene efecto al restaurarlo? **SÍ — y por eso hay drenaje**

Medido: el borrador guarda el **precio BASE** (`priceInput.value`, que es la base) y el **margen
aparte**; el precio final se recomponía al enviar (`finalPrice = safePrice * (1 + safeMarkup / 100)`).

**No es un doble margen diferido.** Es el caso contrario, y también es un defecto: si al restaurar
se ignorara el margen, un borrador con base 100 y margen 20 —que valía **120**— pasaría a valer
**100**. *El precio bajaría solo, sin que nadie lo pida.*

CONT-01 manda: «nunca se esconde un campo que tiene algo escrito». Así que **el margen se DRENA: se
incorpora al precio y la clave se borra.** El precio final no cambia; cambia dónde vive el número.

> ⚠️ **Redondea a dos decimales, y se dice.** Un borrador con base 33,33 y margen 20 % enviaba
> 39,996 y ahora enviará **40,00** — cuatro milésimas, en un campo que el profesional ve y puede tocar.

### ② ¿Las plantillas llevan `markup`? **NO**

Medido el 2-sep-2026 sobre este árbol: `markup` aparece **cero veces en todo `src/`** y cero veces
en `templatesView.js`. Las líneas que viajan al servidor pasan por `QuoteLineSchema`, que **no lo
declara** — y `z.object` borra las claves que no conoce (lo dice su propio comentario de SCRUM-500).
**No hay nada que drenar ahí.**

### ③ ¿Qué pasa con lo que dejó SCRUM-610? **Su causa desaparece**

SCRUM-610 ponía el margen a cero al elegir del catálogo para evitar el **doble margen**, con el
motivo escrito «a cero y no escondido, porque el pro lo ve». Después de DOC-08 el pro **no lo ve**:
el campo no existe. **La protección no se relaja — desaparece lo que protegía.** La línea se retira,
no se deja como no-op.

---

## Lo construido · ① el margen sale del documento

| se quita | dónde |
|---|---|
| el campo **Margen %** de la hoja de ajustes | el `campoLinea("Margen %")` y su input |
| el **margen del chip** | `resumenAjustes(..., safeVat, 0)` → el chip ya sólo dice lo que contiene |
| la fila **«Margen»** del pie | el `<div class="quote-totals__apoyo">` y toda su acumulación |

Y con ellos: el margen deja de **guardarse** en el borrador, deja de **recomponer** el precio que
viaja, y el aviso «Final: …» queda vacío, porque eso ya no puede pasar.

**Se queda intacto:** SUPLIDO (F8), el selector de IVA de la línea y el del documento, y las
funciones puras de `quoteMargen.js`.

`tests/scrum598-el-margen-sale-del-documento.test.mjs` lo sujeta con **tres detectores separados**,
uno por puerta, para que el rojo diga CUÁL; probado con las tres (a cada uno su defecto, y salta él
y sólo él); control negativo (quitar SUPLIDO no lo tumba); suelo del desnudado; y el drenaje se
**ejecuta**, no se lee.

---

## Lo construido · ② F9, RE-ANCLADO EN SU CASA NUEVA

`F9_EN_EL_CATALOGO` y `faltaEnF9(...)` en `tests/_censo-dos-fronts.mjs`, con su control positivo en
`scrum600` y **su rojo en `scrum598`**.

**POR IDENTIDAD, NO POR POSICIÓN** — que es exactamente lo que caducó la vez anterior. Un campo se
reconoce por su **`name`**: es como lo busca el propio código (`querySelector('[name="cost"]')`) y
como viaja al servidor. Reordenar el formulario, renombrar la variable que lo sostiene o mover el
bloque **no** hacen caer esto; quitar el campo, **sí**.

Vigila seis cosas, y **devuelve QUÉ falta, no un booleano**:

1. el campo **Coste** (`name="cost"`) en el formulario de **ALTA**;
2. el campo **Margen %** (`name="margen"`) en el de **ALTA**;
3. y los dos mismos en el de **EDICIÓN** — se miran por separado porque **el alta y la edición ya
   divergieron una vez en este fichero** (el IVA salió de uno antes que del otro);
4. que el **COSTE VIAJE** al servidor en los dos: no basta con pintarlo. Es la lección de F8, que
   empezó dando verde el día que la marca dejaba de llegar;
5. el **cableado de la derivación** (`margenCatalogo.autocompletar` y `margenCatalogo.margenDesde`):
   sin él el campo queda pintado y muerto, que es la peor forma de no funcionar;
6. la **aritmética** (`margenDesde` / `precioDesde` / `autocompletar` en `margenCatalogo.js`).

**EL ROJO, PROBADO CON NUEVE PIEZAS.** A cada una se le da su defecto sobre una copia **en memoria**
y se exige que el detector **caiga con UN solo hallazgo** y que lo **nombre**: con 0 sería
decorativo, con más de 1 acusaría de más y no diría dónde mirar. Cada mutación lleva
**post-condición**: si el trozo no aparece exactamente las veces que se dice, el caso falla en vez
de «probar» sobre un fichero que no ha cambiado.

**LOS DOS CONTROLES NEGATIVOS.**

* **Que el margen salga del DOCUMENTO no lo hace caer.** Es EL control de este ticket: el guard de
  F9 no puede quejarse justo del cambio que se ha decidido hacer. Y se dice por qué no puede: el
  documento **no está en su población**, y eso también se comprueba.
* **Tocar el PROVEEDOR tampoco.** Un guard que se queja de cambios legítimos acaba desactivado — y
  entonces tampoco protege del que importa.

**SUELO.** Sin población no hay veredicto: si no ve **ni un** bloque de HTML o **ni un** objeto de
producto, se declara **CIEGO** y revienta, en vez de contestar «falta todo». Un cero de un
instrumento roto se lee igual que un catálogo sin campos, y son la noticia contraria.

**Y LA CUENTA VUELVE A SER OCHO.** `scrum600` suma `LOS_OCHO` (siete) + `F9_EN_EL_CATALOGO` y exige
`F7…F14`. Si mañana alguien borra la entrada de F9, **esa cuenta lo dice**: es lo que impide que una
mudanza acabe siendo una retirada silenciosa.

### 🔴 La novena pieza la encontró INTERROGAR al detector, no verlo verde

Con el detector ya en verde le hice la pregunta que debería saber contestar: *¿y si alguien no borra
el campo sino que lo **comenta**?* Envolví «Coste» en `<!-- ... -->` y contestó **«no falta nada»**.

El AST protege de los comentarios **de JS** —no son nodos— pero un `<!-- -->` va **dentro** del
literal de plantilla, así que para el árbol sigue siendo texto pintado. Es el falso verde de
SCRUM-515 con otra ropa, y **desactivar es la forma barata de perder una función**. Se quitan antes
de mirar, y el caso queda fijado en el rojo.

---

## 🔴 DOS DEFECTOS MÍOS DEL COMMIT ANTERIOR, arreglados aquí

Los dos estaban en ficheros de este mismo carril y los dos los introduje yo en `0affbe91`.

### ① FALSO VERDE en `scrum610` — una regla «derivada de la vista» que no derivaba de nada

Al retirar el ancla del margen quedó esto:

```js
const PONE_MARGEN_A_CERO = VISTA.includes(ANCLAS['🔴 SCRUM-610: el margen se pone a CERO al elegir']);
```

La clave ya **no estaba** en `ANCLAS`, así que daba `undefined`; `includes(undefined)` busca la
**cadena `"undefined"`**, que aparece **14 veces** en `quotesView.js`; y la regla salía `true`. O
sea: el modelo seguía simulando «el margen se pone a cero al elegir», **un comportamiento que la
vista ya no tiene**, y los dos casos que dependían de él pasaban sin tocar la pantalla. El propio
fichero avisa de esto en su cabecera: *«un test que no puede fallar por el cambio que dice vigilar
es decoración con forma de aserción»*.

**Se arregla el MECANISMO, no el caso.** El acceso a `ANCLAS` pasa ahora por `reglaDeLaVista()`, que
**revienta con la clave delante** en vez de contestar en silencio; el suelo lo prueba (`assert.throws`)
y lo verifiqué en rojo mutando el fichero. El modelo del precio se **deriva** del ancla que sí
existe (`finalPrice = safePrice`) o se declara **CIEGO**. Y el suelo gana un contador de anclas: con
`ANCLAS` vacío el bucle no iteraba y el suelo pasaba por no comprobar nada.

Con eso, dos casos quedan **retirados con su motivo** (su sujeto —el margen en la línea— ya no
existe) y uno se **reescribe** por el otro lado: aunque una línea llegue con `markup` puesto, el
precio del documento es el escrito y **no se multiplica por nada**.

### ② Un comentario que afirmaba en presente algo FALSO sobre el mecanismo

El comentario de SCRUM-610 decía que el margen «viaja también en las **PLANTILLAS**». **Es falso**
(medición ② de arriba). Estaba escrito en **presente** y se leía como una **observación** cuando era
una suposición: así es como una frase falsa sobrevive al código que describía y le cuesta un carril
al siguiente que se la crea. Se retira y se deja escrito qué se midió, cuándo y con qué.

---

## Lo que caía y he reapuntado, con su motivo

| test | qué le pasó |
|---|---|
| `scrum600` + `_censo-dos-fronts` | **F9 mudado** (arriba). El detector nuevo vive ahí y la cuenta vuelve a ocho |
| `scrum229` ×3 | fijaban la PRESENCIA del margen en el pie; ahora fijan su **ausencia**. Los 9 casos de las funciones puras siguen intactos |
| `scrum610` ×5 | tres anclas retiradas (desaparece su causa), el falso verde arreglado en su mecanismo y dos casos retirados/reescritos |
| `scrum132` | reancló el orden del restaurador — **misma invariante, otra forma** |
| `scrum139 F4` | la hoja ya no lleva `markupTd` |
| `scrum286` | su suelo era «≥ 92 lecturas de `.value`»; **recontado a 77, con el número del DETECTOR y no con el mío** — mi propia regex decía 80 y habría dejado el suelo por encima de lo que el detector ve |

🔴 **Y una rotura real que introduje y cazó la tanda** (commit anterior): quedó un
`ajustesCampos.appendChild(markupTd)` sin su variable, y la pantalla de presupuestos **reventaba
entera**. Lo encontró `scrum660`, no yo. Es la diferencia entre `node --check` y ejecutar.

## Los huecos que declaro

1. **No he verificado en navegador** ni la hoja de ajustes ni el pie: he medido el fuente y he
   ejecutado la regla del drenaje. **Sigue abierto.**
2. **No he probado un borrador REAL** de `localStorage` de punta a punta: el drenaje se ejecuta como
   función pura, y que el restaurador la llama se comprueba sobre el fuente. **Sigue abierto.**
3. **El redondeo del drenaje** (dos decimales) mueve hasta cuatro milésimas el precio de un borrador
   viejo con base no redonda. Declarado, no medido contra borradores reales. **Sigue abierto.**
4. **No he medido producción.** **Sigue abierto.**
5. 🆕 **El detector de F9 mide MARCADO, no VISIBILIDAD.** Comprueba que los campos se pintan y se
   cablean, no que se vean en pantalla — y hay un mecanismo que **los esconde a propósito**:
   `switchTipoArticulo` oculta coste y margen en el lado **SERVICIO** (salvo si tienen algo escrito,
   invariante ② de CONT-01). Es correcto para lo que F9 afirma («existen en el producto»), pero
   quien busque «¿los ve el profesional?» necesita navegador, y eso no está aquí.
6. 🆕 **El re-anclaje no cubre el back**: F9 se vigila en el front del catálogo. Que la columna
   `cost` siga existiendo en el modelo es de `prisma/schema.prisma`, que es del fundador y no se toca.

## Ficheros

**Código:** `public/dashboard/js/quotesView.js` (el margen fuera del documento + el comentario falso).

**Tests:** `tests/scrum598-el-margen-sale-del-documento.test.mjs` (**nuevo** en el commit anterior;
aquí gana el rojo de F9 y sus controles) · `tests/_censo-dos-fronts.mjs` (el detector nuevo) ·
`tests/scrum600-un-solo-front-documento.test.mjs` · `tests/scrum229-…` · `tests/scrum610-…` ·
`tests/scrum132-iva-unidad.test.mjs` · `tests/scrum139-hoja-ajustes.test.mjs` ·
`tests/scrum286-bloques-orden.test.mjs` · esta entrada.

**No se ha tocado:** `prisma/schema.prisma` · `pdf.service.ts` ni `src/lib/invoicing.ts` ·
`tests/_banco-vistas.mjs` · `public/dashboard/sw.js` · los selectores de IVA · `QuoteLineSchema` ·
`public/dashboard/js/quoteMargen.js` · **el margen en el catálogo**, que es su casa nueva: este
ticket le pone un guard, no le cambia una línea.
**Ningún microcopy nuevo:** sólo desaparecen campos. Ningún rótulo se ha reordenado ni reescrito.

## Estado del arbol

* `origin/main` avanzó **tres veces** mientras se cerraba esto (`61c90617` → `fdc98cf0` → `443a9e22`
  → `45a2474c`). Se ha **MERGEADO main DENTRO** de la rama las dos veces —no rebase, la historia no
  se reescribe—, sin conflicto. Lo que trajo la última (`quoteApartados.js`, `quotesDetailView.js`,
  `_banco-vistas.mjs`) **no toca ningún fichero de este carril**: comprobado con `git diff` explícito.
* Cliente de Prisma regenerado desde ESTE worktree y `dist/` reconstruido DESPUÉS de mezclar main.
* `npm run guards:entrada` en verde. Cero CR en disco en los ficheros tocados.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `priceInput.dataset.pfBasePrice` se sigue escribiendo en cinco sitios y **ya no lo lee nadie**: estado muerto (SCRUM-669).
* `public/dashboard/js/quoteMargen.js` se sigue cargando en el índice y **el documento ya no lo consume** (SCRUM-669; colisiona con SCRUM-663).
* El elemento `priceHint` («Final: …») queda **siempre vacío** (SCRUM-669).
* En el árbol hay tres ficheros **sin seguimiento** que no son de este carril y llevan ahí desde antes: `docs/Sprint Scrum/SESION_ACTUAL_SCRUM-104_fase2.md`, `docs/Sprint Scrum/SESION_ACTUAL_SCRUM-118.md` y uno llamado literalmente `how f11e445e`, que tiene pinta de `git show` mal escrito.

---

# SCRUM-598 · APÉNDICE · La frontera MARGEN / COSTE, medida el 5-sep-2026

**Fecha:** 5-sep-2026 · **Carril:** verificación · **Gate:** sin gate — no entra código
**Medido contra:** `origin/main` = `2f8a70570a0427707cb75550dfb68ed50eec1cc9` · 2026-09-05T17:44:03+01:00
**No se ha construido nada.** Ni guard nuevo, ni microcopy, ni esquema. Dos inyecciones, revertidas
por bytes. Esta entrada sólo mide.

## Por qué esto no estaba en «Los huecos que declaro», y no es un olvido

El 2-sep, cuando se retiró el margen del documento, **`costeUnitario` todavía no existía**.

| | commit | hora |
|---|---|---|
| SCRUM-598 · el margen SALE del documento | `139ebbd1` | 2-sep **14:35** |
| SCRUM-661 · el coste ENTRA en la línea | `2e3e7685` | 2-sep **15:03** |

`139ebbd1` es **ancestro** de `2e3e7685`. Los dos trabajos fueron **secuenciales, nunca
simultáneos**, así que la pregunta «¿quitar el margen se lleva por delante el coste?» **no se podía
formular todavía**. Hoy los dos están vivos a la vez y sí se puede — y P6 se firmó el 5-sep con la
salida B, que hace de `costeUnitario` una decisión y no un detalle.

**La pregunta, entonces:** ¿está la frontera VIGILADA, o sólo está bien hoy por casualidad?

## Las dos inyecciones, y qué cayó con cada una

Árbol limpio en `2f8a7057`, verde base **31/31** en los tres ficheros. Testigos de bytes guardados
antes de tocar.

### ① Alguien DEVUELVE el margen al documento

Inyectado en `quotesView.js` un `campoLinea("Margen %")` con su input, **en el hueco donde vivía** y
copiando la forma del `Dto. %` que lo ocupa hoy — un defecto creíble, no uno escrito para caer.
Comprobado que la inyección se aplicó y que `node --check` pasa: el fichero es válido, el defecto es
real.

| resultado | |
|---|---|
| **caen 4 tests, los cuatro de `scrum598`** | «EL MARGEN NO ESTÁ EN NINGUNA DE LAS TRES PUERTAS», «EL ROJO NOMBRA LA PUERTA», y **los dos controles negativos** |
| **de `scrum661` / `661b`: cae 0** | el coste no se entera, que es lo correcto |

### ② Alguien RETIRA `costeUnitario` «por limpieza»

Retirada la declaración de `QuoteLineSchema` (`schemas.ts:113`), que es exactamente el gesto que
haría quien pasara a limpiar un campo que cree muerto.

| resultado | |
|---|---|
| 🔴 **NI SIQUIERA COMPILA** | `error TS2339: Property 'costeUnitario' does not exist on type…` — lo delata el propio `superRefine` que prohíbe coste en una cabecera (`schemas.ts:191`) |
| **caen 9 tests en CUATRO ficheros** | `scrum619` (vocabulario de línea) · `scrum661` · `scrum661b` · `scrum712` (decimales) |
| **de `scrum598`: cae 0** | el margen no se entera, que es lo correcto |

## El veredicto

> **La frontera está vigilada en las DOS direcciones, por guards DISTINTOS, y sin solaparse.**
> Devolver el margen tumba sólo a 598; retirar el coste tumba sólo a los del coste — y antes de
> llegar al test, **rompe la compilación**.

O sea que la consecuencia operativa que P6 dejó escrita —«ningún ticket futuro puede retirar
`costeUnitario` por limpieza»— **no depende de que alguien lea el ticket**: hay mecanismo, y es el
tipo, que es el escalón más alto (hacerlo imposible), no un guard que hubiera que recordar correr.

## 🔬 Un falso positivo MÍO, y lo digo porque casi publico su número

La primera pasada de la inyección ① dio **8 rojos**, cuatro de ellos de `scrum661`. Habría escrito
«devolver el margen rompe el coste», que es justo la mina que venía a descartar — y **habría sido
falso**.

La causa: en la inyección ② había recompilado con el campo retirado, y al revertir el **fuente** no
recompilé. `dist/` seguía sin `costeUnitario`. **Los rojos de 661 eran del `dist/` rancio, no del
defecto.** Se repitió la medición con `npm run build` de por medio y el resultado limpio es el de
arriba: 4 rojos, todos de 598.

**La lección, que ya está escrita en esta casa y hoy volvió a morder:** después de revertir un
fuente que compila, **la reversión no ha terminado hasta que `dist/` la refleja**. `Buffer.compare`
sobre el fuente daba 0 y aun así el árbol mentía.

## Lo que sigue sin medirse

1. **Navegador: sigue abierto.** Los huecos 1, 2 y 3 de la entrada del 2-sep siguen exactamente
   igual — esta medición es de fuente y de ejecución en Node, no de pantalla.
2. **Producción: sin medir.** No se puede desde un árbol de trabajo.
3. **El margen NEGATIVO.** `margenDesde(150, 100)` devuelve **−50**, ejecutado hoy. Es aritmética
   correcta —vender por debajo del coste ES margen negativo— pero **nadie ha decidido qué enseña la
   ficha** en ese caso, y el guard de CAT-01 sólo cubre el imposible por arriba (≥ 100 % con coste).
   No es de este ticket; se anota porque es la pregunta que quedó viva de CAT-01.
