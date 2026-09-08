# SCRUM-582 · CONT-09 · Selección múltiple en la lista de clientes

**Fecha:** 4-sep-2026 · **Carril:** S3 · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `1a359f6ea2b90f110bfa40516d8bbcb58a7e0f94` · 2026-09-04T14:58:42+01:00

**Tanda:** 5128 tests, 5044 pass, **0 fail**, 84 skipped — medida DESPUES del ultimo cambio, entrada incluida, con main dentro (26 commits) y Prisma regenerado. Suelo: suelo 4798 · total 5128 · margen 330.

---

**Lo que entrega:** el mecanismo de selección. **Nada más.** Casilla por fila, casilla de
«seleccionar todos» con sus tres estados, y el estado consultable.

⛔ **Ni una acción en bloque**, y hay un test que cae el día que alguien añada un botón a la barra
«para probar». Tampoco va un contenedor de menú vacío: un menú «Acciones» que no hace nada es una
promesa rota cada vez que se pulsa.

⚠️ Y por escrito, aunque hoy no aplique: cualquier acción en bloque que **envíe mensajes** pasa por
la tabla anti-spam de la **regla 28** antes de existir. Seleccionar 300 clientes y mandarles algo es
el peor botón que se puede construir mal.

## PASO 0 — y dos premisas del encargo no se sostienen

### (a) ENTRADA

`pintar()` en `public/dashboard/js/customersView.js:352`. Las celdas se añaden **en el orden de
`FC.COLUMNAS`**, y `colSpanDeLaTabla()` **es** `COLUMNAS.length`: una columna nueva cuadra el
`colSpan` del vacío ella sola. Ése era el trabajo de SCRUM-584 y aquí se cobra.

🔴 **La trampa:** `tr.addEventListener("click", () => openCustomer360(c))` — **la fila entera abre
la ficha del cliente**. Una casilla dentro de esa fila la dispara.

### (b) MECANISMO — existe, y NO se reutiliza. Con la medida delante.

**La selección múltiple YA EXISTE** en `invoicesView.js`: casilla de cabecera (`#inv-check-all`),
`selectedIds`, barra flotante con contador. Pero:

* `selectedIds` se declara **dentro del cierre de `renderInvoicesView`** — medido por AST, la misma
  forma que tenía `buildModal` antes de SCRUM-591: no es invocable desde fuera;
* y las **únicas** piezas de nivel superior de ese fichero (`textoMarcadas`,
  `resultadoMarcadoEnBloque`) son las del **«marcar como pagadas»**, que es **flujo de dinero**.

Extraer un cierre que contiene el camino del dinero para una pantalla de clientes es lo que no se
hace. **Decisión confirmada por el asesor:** el estado se escribe en `filtroClientes.js` —puro y
probable sin navegador— y queda dicho ahí, con su motivo, para el día que facturas quiera
compartirlo. Eso es lo que lo convierte en un mecanismo y no en una copia.

### (c) El selector de columnas de SCRUM-584 — resuelto por construcción

`columnasElegibles()` filtra por `!fija`, así que la columna nueva entra con **`fija: true`** y el
selector **no la lista**. Y `claseDeColumna` sólo pone `col-hide-mobile` a las que lo declaran, así
que con **`ocultaEnMovil: false`** la casilla se ve también en el móvil.

Una casilla que el profesional pudiera apagar sin querer dejaría la selección inalcanzable **y sin
forma de recuperarla**: el control que la enciende estaría detrás de la propia columna.

### (d) 🔴 A 360 px NO hay tarjetas: la tabla de clientes es `table--stack-mobile`

El encargo daba por hecho `table--cards-mobile`. **Medido: no.** `customersView.js:265` construye
`table table--stack-mobile`, y seis vistas más usan la otra clase — clientes no.

Y lo que importa de verdad está en su CSS (`styles.css:2432`):

```css
@media (max-width: 640px) { .table--stack-mobile thead { display: none; } }
```

**A ≤640 px el `thead` entero desaparece**, y con él la casilla de «seleccionar todos». Las de cada
fila sobreviven (son `<td>`, y `td:empty` no las esconde porque llevan el `input` dentro).

**Por eso existe la barra de selección**, con la MISMA casilla de tres estados y el MISMO texto
aprobado: sin ella, en el móvil sólo se podría marcar de una en una — justo el profesional que más
lo necesita. Marcarla selecciona lo visible; desmarcarla lo suelta, así que también sirve de
«limpiar» sin inventar un segundo control ni un texto nuevo.

> 📌 **Consecuencia declarada:** en móvil hay que marcar **una** fila para que aparezca la barra y
> con ella «seleccionar todos». Desde cero no es alcanzable, porque la cabecera está oculta. La
> alternativa —una barra siempre visible— es una pantalla nueva y no es de este ticket.

## Las dos decisiones que este ticket toma, y quedan escritas

1. **«Seleccionar todo» selecciona LO FILTRADO**, no la base entera. Si significara los 300, el
   profesional marcaría a ciegas gente que la pantalla no le enseña.
2. **Al cambiar de filtro, la selección se RECORTA a lo visible.** Guardar lo que ya no se ve deja
   una selección **invisible** —el contador diría «12» con tres filas marcadas— y así es como se
   borra lo que nadie quería borrar. Se pierde trabajo al cambiar de filtro, y ése es el precio:
   lo que se ve es lo que hay.

## 🔴 Los rojos, por el mecanismo

Commiteado en verde antes de mutar; cada mutación comprueba que cambió el fichero que dice, se
restaura y se re-verifica. Control antes y después: `fail=0`.

| Mutación | Cae | Qué nombra |
|---|---|---|
| se rompe el `stopPropagation` de la casilla | **1** | «EL QUE MÁS RABIA DA: marcar NO abre la ficha» |
| desaparece la casilla de la **barra** | **2** | la del móvil, y la de «ni una acción en bloque» |
| se pierde el **tercer estado** | **1** | «los TRES ESTADOS… el del medio es el que importa» |
| «todos» pasa a coger la **base entera** | **3** | «selecciona LO FILTRADO», y dos más |
| la selección **sobrevive** al cambio de filtro | **1** | «se RECORTA a lo visible» |
| la columna pasa a ser **ocultable** | **2** | «NO es ocultable, y va la PRIMERA» |
| **aparece una acción en bloque** | **1** | «⛔ NO HAY NI UNA ACCIÓN EN BLOQUE, y esto es el ticket» |
| **CONTROL NEGATIVO** · renombrar la columna «Alta» | **0** ✅ | no cae, como debe |

El del `stopPropagation` **ejecuta el manejador de verdad** y observa la llamada: no comprueba que
la línea exista, comprueba que se llama.

## ✅ Microcopy — FIRMADA POR EL ASESOR el 4-sep-2026

| Ranura | Texto aprobado |
|---|---|
| nombre accesible de «seleccionar todos» | `Seleccionar todos` |
| contador, singular | `1 cliente seleccionado` |
| contador, plural | `N clientes seleccionados` |

**Provisionales a la espera de la firma del fundador** (regla 30), como las cuatro de SCRUM-580.
La procedencia va AQUÍ y no en `docs/microcopy/`: ese directorio dice en su primera línea que es
el registro de **lo que aprueba el fundador**, y meter ahí una aprobación del asesor corrompería
el registro de las que sí lo son. El precedente está escrito en la propia pieza desde SCRUM-580:
«PROCEDENCIA: `docs/master/SCRUM-580.md`, sección de microcopy».

### 🔴 Singular y plural DE VERDAD, y está medido por qué

No es una preferencia de estilo. La barra de FACTURAS escribe su plural a mano:

```js
n + ' factura' + (n !== 1 ? 's' : '') + ' seleccionada' + (n !== 1 ? 's' : '')
```

…y ese atajo es el que hace alcanzable «1 facturas seleccionadas». Aquí el singular es un texto
PROPIO, no una `s` pegada, y hay un test que cae si vuelve el `(s)`.

El **número es DATO**, no microcopy, y va **sin separador de millares** (decisión del asesor): con
mil clientes marcados, un punto ahí se lee como otra cosa. Atado con `===` para n = 0, 1, 2 y 1000.

### ⚠️ LA CAJA ESTÁ CALCULADA, NO MEDIDA — y el asesor firmó sabiéndolo

Queda escrito porque **un texto aprobado sobre una caja calculada es una hipótesis con forma de
firma**, y quien lo lea dentro de un mes tiene que poder saber cuál de las dos cosas fue.

El cálculo del asesor, sobre el CSS que yo medí: barra `flex` con `padding:10px 14px`, casilla de
18 px y `gap:10px` delante ⇒ a 390 px de viewport quedan **~334 px** para el contador a
`13.5px/600`. «23 clientes seleccionados» son 23 caracteres, y **no hay botón de acciones**
compitiendo por el espacio porque este ticket no construyó ninguno.

🔴 **CONDICIÓN, suya y por escrito:** cuando el MCP del navegador vuelva, **se mide**. Si no cabe,
el que falla es el cálculo y se cambia el texto — no al revés.

### Sobre el nombre accesible de cada fila, y por qué no inventé un texto

El encargo pide que diga **a quién** selecciona. Se usa el **nombre del cliente**: dice a quién y no
inventa copy. Escribir «Seleccionar ‹nombre›» habría sido componer una frase que no ha aprobado
nadie. Si el asesor quiere el verbo delante, lo firma y se pone en una línea.

### El censo de SCRUM-402: entró y salió el mismo día

```
CON el marcador  → 14 marcadores pintables en 14 ficheros
SIN el marcador  → 13 marcadores pintables en 13 ficheros   (-1)
árbol: origin/main = 1a359f6e con la rama scrum-582 dentro · 4-sep-2026
```

La entrada de `filtroClientes.js` se **BORRA**, no se pone a 0 (SCRUM-424/405). Es la SEGUNDA vez
que ese fichero entra y sale: SCRUM-581 retiró sus seis cuando el fundador dijo «nada de marcadores
en pantalla». Éste era uno nuevo, no aquéllos.

### 🛑 Y `SIN_APROBAR` se queda en 7, no baja a 5 — con la evidencia delante

El asesor pidió bajarlo a 5 «son textos aprobados por MÍ, no por el fundador». **Ese contador no
cuenta eso.** Lo dice su propio comentario, y lo dicen los cinco que ya hay dentro:

> 🔴 CUÁNTAS RANURAS DE MICROCOPY SIGUEN SIN **LA FIRMA DEL FUNDADOR**. […] Las CUATRO de
> SCRUM-580 las aprobó el ASESOR […] provisionalmente y a la espera del fundador — **así que
> cuentan aquí**.

Los 5 de partida son 4 (SCRUM-580) + 1 (SCRUM-584), **todos aprobados por el asesor y pendientes
del fundador**. Las dos ranuras de este ticket están **en el mismo estado exacto**. Bajarlas a 5
haría que el mismo número significara dos cosas distintas según la ranura, y dejaría de poder
leerse. **Se queda en 7**, y los dos tests que lo atan siguen exigiéndolo con igualdad exacta.

Si lo que se quiere es que las aprobaciones del asesor dejen de contar, entonces **los otros cinco
también tienen que salir** y el contador pasa a significar otra cosa: eso es un cambio de
convención, y no lo decide una sesión.

## 🕳️ Huecos declarados

1. 🔴 **La caja del contador NO está medida en navegador real.** El servidor MCP de Playwright está
   caído en esta sesión (`CONNECT_TIMEOUT`), así que **no hay número que dar** y no me lo invento.
   Lo que sí consta del CSS: la barra es `display:flex`, `padding:10px 14px`, dentro de `.data-card`
   —que ocupa el ancho de `.view-container`—, con la casilla (18 px) y un `gap` de 10 px delante, y
   el contador a `font-size:13.5px; font-weight:600`. **Falta la medida real, y con ella la firma.**
2. **El objetivo táctil de 44 px no lo he verificado en navegador**, por lo mismo. Las casillas se
   pintan a 18×18 px con el `cursor` y el `accent-color` de la casa; el objetivo real lo da la
   celda que las contiene, y eso hay que verlo. ⚠️ Y **`guard:objetivo-tactil` no avisa** —sale
   verde con un botón de 30 px, SCRUM-711—, así que aquí no hay red.
3. **No he verificado en yaqu.app.** Lo medido es la tanda, el banco de vistas y el CSS leído.
4. **La barra no es alcanzable en móvil con cero seleccionados** (ver (d)). Declarado, no resuelto.

## Hallazgos fuera de carril

* `invoicesView.js` tiene una selección múltiple **completa y acoplada** a su cierre, con su barra y
  su contador: el día que se comparta el mecanismo, ahí hay una segunda opinión que retirar.
* La barra de facturas dice «N facturas seleccionadas» con plural resuelto a mano; el contador de
  aquí está sin aprobar. Cuando se firme, conviene mirar los dos a la vez.

---
---

# APÉNDICE · 6-sep-2026 — EL MECANISMO YA ESTABA. LO QUE FALTABA ERAN LAS MEDIDAS

**Rama:** `scrum-582-medidas-en-navegador` · **medido contra** `origin/main` =
`16bd95731883a6c84ceb57820a493c8fe1500f6d` · 2026-09-06T10:12Z · worktree `cobroflash-backend`

> **PASO 0 · ¿ESTABA HECHO? SÍ, EL MECANISMO.** `3277d79d` está en `main`
> (`git merge-base --is-ancestor` → sí) y sus 14 tests salen **14/14** contra el árbol de hoy.
> Verificado requisito por requisito, no por el número del commit.
>
> **Lo que NO estaba hecho son los dos huecos que esta misma entrada declaró**: la caja sin medir
> en navegador y el objetivo táctil sin verificar. Aquella sesión tenía el MCP de Playwright caído
> y lo dejó por escrito con su condición: *«cuando el MCP del navegador vuelva, se mide»*. Esta
> sesión no ha usado el MCP: ha usado **Edge por `puppeteer-core`**, que es la vía con la que esta
> casa mide cajas desde SCRUM-368. **Se mide.**

---

## 1 · Requisito por requisito, contra el árbol de hoy

| requisito del encargo | ¿está? | dónde, medido |
|---|---|---|
| casilla por fila | ✅ | `customersView.js:527-537` · el banco monta 3 casillas con 3 clientes |
| casilla de cabecera «seleccionar todo» | ✅ | `customersView.js:325-327` (`<th>`) y `:341` (barra del móvil) |
| estado de la selección | ✅ | `let seleccion = []` (`:306`) + `refrescarSeleccion()` (`:368-376`) |
| contador visible | ✅ | «3 clientes seleccionados», medido en navegador (abajo) |
| ⛔ ninguna acción en bloque | ✅ | hay un test que lo EXIGE: «⛔ NO HAY NI UNA ACCIÓN EN BLOQUE» |

**Y los 14 verdes no son decoración.** Se inyectaron tres defectos y se exigió el rojo:

```
LÍNEA BASE (limpio): pass 14 · fail 0
  ROJO OK · seleccionar todo deja de seleccionar              → fail 3
  ROJO OK · vuelve «1 clientes seleccionados» (plural falso)  → fail 1
  MUDA    · la casilla de fila deja de reflejar la selección  ← 🔴
```

## 2 · 🔴 UN REQUISITO DEL TICKET ESTABA SIN GUARD, y lo enseña la muda

Con esta mutación de UNA línea en la vista:

```diff
-  casillaFila.checked = FC.estaMarcado(seleccion, c.id);
+  casillaFila.checked = false;
```

…los **catorce tests siguieron en VERDE**. El mecanismo se podía romper entero —el profesional
marca y no ve lo que ha marcado— y la tanda no se enteraba.

**Por qué se escapaba:** los tests que miran la pantalla la miran **recién montada**, y con la
selección vacía «todas desmarcadas» es indistinguible de «no reflejo nada». Hay que **repintar con
una selección no vacía**, y el camino del producto para eso es la casilla de cabecera.

**Es el único código que toca este PR**: un test —`tras REPINTAR, la casilla de cada fila REFLEJA
la selección`— con su control positivo dentro (desmarcar tiene que volver a apagarlas: sin eso, un
`checked = true` fijo pasaría igual de bien que el código correcto). Ahora:

```
LÍNEA BASE (limpio): pass 15 · fail 0
  ROJO OK · seleccionar todo deja de seleccionar              → fail 4
  ROJO OK · vuelve «1 clientes seleccionados» (plural falso)  → fail 1
  ROJO OK · la casilla de fila deja de reflejar la selección  → fail 1
vivas 3 de 3 · árbol restaurado · re-corrida: pass 15 · fail 0
```

---

## 3 · LA CAJA, MEDIDA EN NAVEGADOR REAL

Edge por `puppeteer-core`, `tokens.css` y `styles.css` **del árbol** servidos desde disco.
🔴 **El marcado no se escribe en el medidor: se SERIALIZA del árbol que monta
`renderCustomersView`** en el banco de vistas, y la versión «sin la columna» se obtiene quitando
el `<th>` **y** la primera `<td>` de cada fila. Un medidor con su propia tabla mide su idea de la
pantalla.

### ¿La casilla nueva cambia el ancho de las demás columnas? **NO. Ni una.**

| columna | 929 px · con | 929 px · sin | Δ | 390 px · con | Δ |
|---|---|---|---|---|---|
| **seleccion** | **46,0** | — | ← la nueva | **18,0** | ← la nueva |
| id | 41,3 | 41,3 | **0,0** | 14,7 | 0,0 |
| nombre | 81,3 | 81,3 | **0,0** | 310,0 | 0,0 |
| telefono | 90,0 | 90,0 | **0,0** | 77,1 | 0,0 |
| email | 65,6 | 65,6 | **0,0** | oculta | — |
| notas | 220,0 | 220,0 | **0,0** | oculta | — |
| etiquetas | 93,5 | 93,5 | **0,0** | oculta | — |
| alta | 57,5 | 57,5 | **0,0** | oculta | — |
| acciones | 250,6 | 250,6 | **0,0** | 310,0 | 0,0 |

**Ninguna columna se estrecha: la tabla CRECE.** A 929 px la suma de columnas pasa de **899,8 px**
(sin) a **945,8 px** (con), en un contenedor de **929,0 px** — o sea que con la casilla la tabla
excede el contenedor en **~16,8 px**. La página **no** desborda horizontalmente (medido:
`scrollWidth <= innerWidth`), así que ese exceso lo absorbe el contenedor de la tabla.
⚠️ **Dónde exactamente va ese desbordamiento NO lo he medido** — se declara, no se supone.

### El contador: la cuenta del asesor se sostiene

Con cero seleccionados la barra está en `display:none`, así que **hay que seleccionar para poder
medirla** (la primera pasada de mi medidor la midió oculta y sacó 0×0). Los textos del peor caso
no se escriben a mano: se le piden al producto, `FC.textoDelContador(n)`.

| | 929 px (contenedor 929) | 390 px (contenedor 390) |
|---|---|---|
| barra | 879,0 × **44,3** px | 364,0 × 67,5 px |
| «3 clientes seleccionados» | 146,1 × 20,9 | 87,9 × 41,8 |
| «23 clientes seleccionados» (25 car.) | 166,3 × 23,3 · **cabe** | 100,1 × 46,5 · **cabe** |
| «300 clientes seleccionados» (26 car.) | 174,4 × 23,3 · **cabe** | 105,0 × 46,5 · **cabe** |

✅ **La condición que el asesor dejó por escrito queda cumplida:** su cálculo (~334 px útiles a
390) era conservador y el texto **cabe de sobra** — el peor caso ocupa **105,0 px**. La firma del
contador ya no descansa sobre una hipótesis.

---

## 4 · 🔴 EL OBJETIVO TÁCTIL: TRES HALLAZGOS REALES

**Primero, la cobertura, medida y no supuesta:** `scripts/guard-objetivo-tactil.mjs` hace
`page.goto('http://127.0.0.1:PUERTO/')` a 1280 y 360 px — **mide la LANDING**. No carga el
dashboard, así que **NO cubre esta pantalla**. La entrada decía «no avisa»; el motivo de fondo es
más simple: nunca la mira.

| dónde | 929 px | 390 px |
|---|---|---|
| casilla de fila (`<td>`) | 46,0 × 171,5 / 108,7 / 171,0 → **cumple** | **18,0 × 23,1 → 🔴 POR DEBAJO** |
| casilla de cabecera (`<th>`) | **46,0 × 43,3 → 🔴 por 0,7 px** | oculta (`thead{display:none}`) → **no medible** |
| casilla de la barra (`<div>`) | 879,0 × 44,3 → cumple | 364,0 × 67,5 → cumple |

🔴 **El hallazgo que importa es el de 390 px**: la casilla de cada fila da un objetivo de
**18,0 × 23,1 px** contra los **44** de AB6 — menos de la mitad de alto y menos de la mitad de
ancho. Y es justo donde el documento sitúa a la víctima: *«el profesional con 300 clientes trabaja
de pie»*. En escritorio la celda estira a 108-171 px de alto y cumple de sobra; en el móvil la
tabla es `table--stack-mobile` y la celda se encoge a la casilla.

El de la cabecera a 929 px (**43,3 px**, falla por **0,7**) es marginal pero es un fallo de AB6.

⚠️ **Ninguno de los tres se arregla aquí**: tocar el alto de las celdas es un cambio de UI de esta
pantalla y no estaba en el encargo, que pedía **medir**. Con el número delante, se decide.

---

## 5 · LAS TRES PREGUNTAS QUE ARRASTRABA

**① ¿«todo» es la página o todos los clientes del filtro?** → **lo VISIBLE/filtrado**, y está
decidido en el código con su motivo (`filtroClientes.js:424`, «SELECCIONAR TODO SELECCIONA LO
FILTRADO, NO LA BASE ENTERA»). Medido en el banco: con 3 filas montadas, marca **3 de 3**.

**② ¿Sobrevive al paginar, filtrar y buscar?**
- **Al filtrar:** sí, RECORTADA — `limitarAVisibles()` deja fuera lo que ya no se ve, y hay test.
- **Al remontar la vista:** **NO, y está medido.** `openCustomer360` hace
  `renderAppView('customer-360')` — **navega, no abre modal**. Al volver, la vista se monta de
  nuevo y `let seleccion = []` **nace vacía**: medido, 3 marcadas → 0.
- **Al buscar:** ⚠️ **NO MEDIDO.** Lo intenté dos veces (mock que ignora `?search=` y mock que lo
  honra); en el banco la lista no repinta con el temporizador de la búsqueda, así que el caso **no
  se ejercita**. No se afirma que sobreviva.

**③ ¿Se ve cuántos hay seleccionados?** Sí, y **con su caja medida** (§3). El texto está **firmado**
(«N clientes seleccionados» / «1 cliente seleccionado»), con singular propio y sin `(s)`.

---

## 6 · LA TRAMPA DEL `.modal-overlay`

Medido: **la selección SOBREVIVE** a pulsar una fila (contador y casillas idénticos antes y
después), y **no queda ningún overlay** en el body — porque esa puerta **no abre modal**: navega.

⚠️ **El caso del modal de EDICIÓN no lo he ejercitado** (se abre desde otra acción). Lo que sí se
puede afirmar por lectura: la selección vive en `let seleccion = []`, **estado de JavaScript del
montaje, no del DOM**, así que un overlay huérfano no puede alterarla — pero eso es lectura, no
medición, y así queda dicho.

---

## 7 · Huecos declarados

1. **La búsqueda no se ejercitó** (§5②). Dos intentos, los dos no medibles en el banco.
2. **Dónde va el desbordamiento de ~16,8 px de la tabla a 929 px** (§3) no está medido.
3. **El modal de edición** no se abrió (§6).
4. **Los tres fallos de objetivo táctil NO se arreglan aquí** (§4): medir era el encargo.
5. **Sin verificar en yaqu.app**, y sin capturas.
6. **La barra sigue sin ser alcanzable en móvil con cero seleccionados**, hueco (4) de la entrada
   original: sigue abierto y no lo toca este PR.
