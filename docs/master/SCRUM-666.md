# SCRUM-666 · El banco de vistas ya mira el CSS externo — y dice cuándo no sabe mirar

**Medido contra:** `origin/main` = `001f44fd8ff35a0fb41ad9f3052e9611f57075e1` · 2026-09-02T13:23:01Z

> Rama apilada sobre `scrum-660-iva-defecto-del-documento`, con `origin/main` mezclado dentro.
> El ancla se ha REMEDIDO en cada mezcla de `main`: `61c90617`…, luego
> `fdc98cf03e82be7952d5cefb692edc3eef2eaa63`, y ahora la de arriba.
> El hueco lo declaré yo al entregar 660; el instrumento que lo cierra vive en el mismo banco.

---

## 1 · PASO 0

### ENTRADA

**No hay entrada de usuario: este ticket no toca producto.** El «usuario» es cualquier control de
visibilidad que se escriba de aquí en adelante, y su puerta es `tests/_banco-vistas.mjs`.

### MECANISMO · existe a medias, y ése fue el hallazgo

| | |
|---|---|
| ¿lee el banco alguna hoja de estilos? | **NO. Cero.** No abría ninguna |
| ¿existe un matcher de selectores? | **SÍ**: `casaSimple` / `casa` / `buscar` (SCRUM-451) |
| ¿sabe declararse ciego? | **SÍ**: `reg.selectoresNoSoportados`, y el fichero lleva tres tickets (451, 444, 634) desterrando el `null` mudo |

O sea: **el motor de selectores estaba construido y sólo le faltaba de dónde leer**. El trabajo era
darle superficie, no rehacerlo — y por eso no hizo falta ninguna dependencia (regla 36 intacta:
sólo `node:fs` y lo que ya había).

## 2 · Las tres mediciones, antes de escribir código

### ① Cuántas reglas pueden ocultar — **y no es una sola hoja**

El índice declara **dos hojas locales** (`/tokens.css` y `./css/styles.css`) más una remota de
Google Fonts, que no se lee ni se debe. **Comprobado, no supuesto.**

| | |
|---|---|
| reglas totales | **625** (tokens.css 1 · styles.css 624) |
| pueden ocultar | **31** |
| por forma | `display:none` **24** · `opacity:0` **7** |
| dentro de `@keyframes` | **7** — y son las 7 de `opacity:0` |
| dentro de `@media` | 13 |

**Los fotogramas no ocultan**: un `opacity:0` dentro de `@keyframes` describe un instante de una
animación. Contarlos habría llenado el aviso de falsos positivos, así que se descartan y quedan
**24 reglas** de verdad.

### ② Cuántas resuelve el matcher que YA existe

**35 partes de selector · resuelve 22 · el 63 %.** Lo que no resuelve: `::-webkit-scrollbar`,
`:not()`, `>`, `:empty`, `:has()`.

### ③ 🔴 El subconjunto barato — **la apuesta era razonable y los números la refutan**

El encargo apostaba a que las reglas que ocultan serían simples y el matcher las resolvería casi
todas. **Global sí (63 %). Pero donde importa, no:**

> **Las DOS reglas que ocultan campos del editor de líneas —justo lo que mide el control de
> SCRUM-660— usan `.quote-line--vacia:not(:focus-within) > …`, y el matcher NO resuelve ninguna.**

63 % global, **0 % en el caso que motivó el ticket**. Y eso decidió el diseño entero: un lector
que aplicara sólo lo que sabe resolver diría **«se ve» precisamente donde no sabe mirar**.

## 3 · Qué se construyó

Tres piezas en `tests/_banco-vistas.mjs`, ninguna dependencia nueva:

* **`hojasDelDashboard(raiz)`** — las hojas LOCALES que declara el índice. Las remotas se ignoran.
* **`reglasQueOcultan(raiz, hojas?)`** — trocea con pila de llaves (para no romperse con `@media`
  y `@keyframes`) y devuelve las reglas que ocultan, con su forma y su bloque `@`.
* **`ocultoPorCss(nodo, reglas)` — TRES respuestas, y la tercera es el ticket:**

| respuesta | cuándo |
|---|---|
| `oculto: true` | una regla que el matcher **sabe resolver** casa con el nodo o con un ancestro |
| `oculto: false` | ninguna casa, y ninguna quedó sin resolver |
| **`oculto: null`** + `ciego: [...]` | hay reglas que **mencionan una clase del nodo** y cuyo selector **no se sabe resolver** |

Esa tercera es la doctrina del fichero aplicada aquí. Y el filtro de «mencionan una clase del
nodo» no es adorno: sin él, cualquier selector raro de la hoja dejaría **todo** en «no lo sé», el
aviso sería ruido y nadie lo miraría — que es como muere un guard.

**El control de SCRUM-660 ya lo usa**: `quienLoEsconde` consulta el CSS después del marcado, y
trata la ceguera como fallo.

## 4 · La evidencia

### 🔴 EL ROJO POR EL MECANISMO — el que decide si esto ha hecho algo

Se añadió a `styles.css` una regla que oculta el selector de IVA **de la línea**, con
post-condición de que **ese** fichero cambió:

| Regla inyectada en `styles.css` | Resultado |
|---|---|
| ① `.quote-ajustes-modal select { display:none }` — la de la LÍNEA | **CAE** el control de 660 |
| ② `.quote-form-row .field { display:none }` — la del DOCUMENTO | **CAEN 2** |
| ③ `.quote-ajustes-modal:not(.abierta) > select { display:none }` — no resoluble | **CAE por CEGUERA declarada** |
| ④ **NEGATIVO:** `{ color: #333; margin-top: 4px; }` | **no cae nada** (8/8) |

Las cuatro revertidas con `Buffer.compare` sobre bytes de disco.

### SUELO

* Apuntado a **un fichero que no existe** → **LANZA** (`ENOENT`), no devuelve cero.
* Apuntado a `tokens.css`, que **no tiene ninguna regla de ocultación** → **LANZA** con el mensaje
  de SUELO. «No hay reglas» y «no supe abrir el fichero» son el mismo número con significados
  opuestos, y el segundo tiene que doler.
* Sobre las hojas de verdad, ≥ 10 reglas y **ningún fotograma colado**.

### 🔴 Un defecto del lector que cazó su propio CONTROL NEGATIVO

`ocultoPorCss` **no miraba `formas`**: una regla de color con un selector que casara devolvía
«oculto». Lo encontró el control negativo, no una lectura del código. Corregido, y el caso queda
escrito en el test con su procedencia.

Y el mismo test me engañó primero a mí: usé `.quote-line__label` como «nodo corriente» y **no lo
es** —hay una regla real que lo menciona—, así que el lector se declaraba ciego **con razón**. El
rojo era del fixture. Cambiado a una clase que no aparece en ninguna hoja.

## 5 · ⚠️ Lo que sigue sin cubrirse — declarado, no supuesto

* **El matcher no resuelve `>`, `+`, `~`, `*` ni pseudoclases**, y **las dos reglas del editor de
  líneas son de ésas**. Ahí el banco **no contesta «se ve»: se declara ciego**. El hueco no
  desaparece — **cambia de clase**: deja de ser un verde falso y pasa a ser un aviso.
* **No hay cascada ni especificidad**: si una regla oculta y otra posterior muestra, esto dice
  «oculto». Es el lado conservador, pero no es CSS de verdad.
* **`@media` no se evalúa**: sus reglas se leen como si aplicaran siempre. Conservador también.
* Un `:has()` o un `@container` nuevos **seguirían necesitando navegador**.
* **No verifiqué** otros caminos de apertura de la hoja de ajustes: el control sigue usando el
  chip. Sigue abierto, como en 660.

## 6 · Los tres merges de `SCRIPTS_DEL_DASHBOARD`, y el tercero ya no fue un conflicto

Esta rama mezcló `main` tres veces y el mismo sitio chocó las tres. Queda escrito porque el
tercero es la prueba de que el arreglo funciona.

**Primero (sexta colisión del contador).** Los números chocaron —67 en la rama, 68 en main—, así
que se veía. Se resolvió **contando sobre el índice ya mezclado** (`grep -c "<script src="` → 69),
no eligiendo un lado, y se conservaron los dos comentarios.

**Segundo (séptima colisión, y de las SILENCIOSAS).** Los dos lados decían `69` —main llegó ahí
con SCRUM-611 y esta rama no añade ningún `<script>`—, así que git dejó la línea del valor **fuera
de los marcadores** y sólo chocaron los comentarios. Medido sobre el índice ya mezclado:

| medida | resultado |
| --- | --- |
| `grep -c "<script src=" public/dashboard/index.html` | **69** |
| `grep -o "<script src="` (control: dos en una línea contarían distinto) | **69** |
| duplicados en el índice | **0** |
| los 69 ficheros existen en disco | **sí** |
| orden | `tiposDeIva` 247 < `quotesView` 248 · `switchTipoArticulo` 250 y `margenCatalogo` 251 < `productsView` 252 |

🔴 **Y ahí se corrigió la regla.** Los dos lados documentaban **el mismo script** (`tiposDeIva.js`,
SCRUM-611): la rama con la flecha caduca «66 → 67», main con la «68 → 69» ya recalculada. La regla
que el fichero venía repitiendo —«se conservan los comentarios de los dos lados, cada uno documenta
un script real»— **sólo vale cuando cada lado documenta un script DISTINTO**. Aplicarla ahí habría
dejado **dos entradas para un solo script con flechas contradictorias**, que es la corrupción que
el fichero ya arrastraba con **SCRUM-575 / `nifEspanol.js`** («63 -> 64» y «64 → 65»). Así se supo
cómo nació aquélla: no por descuido de nadie, sino por **aplicar correctamente una regla mal
enunciada**.

Se probó el suelo en rojo: con `68` declarado y 69 reales caen **los dos** guards nombrando la
cifra — `guard-colisión` («se leyeron 69 y se esperaban 68») y el SUELO de SCRUM-417 («BANCO
CIEGO: 69 … 68»).

**Tercero — y aquí ya no hubo nada que resolver a mano.** `main` traía **SCRUM-662** (Luis): el
contador sustituido por una **lista de nombres**. Se tomó **su lado entero**, sin pelearlo y sin
reintroducir el número. Esta rama sólo **añade** 134 líneas a `tests/_banco-vistas.mjs` —
`hojasDelDashboard`, `reglasQueOcultan`, `ocultoPorCss`— y no toca la lista: `git diff origin/main`
sobre la región del contador sale **vacío**.

**La asimetría que dio el argumento**, y que sigue siendo el aprendizaje: el número lo vigilaban
dos guards, así que un valor corto caía en la primera tanda. **Al REGISTRO no lo vigilaba nadie**,
y ahí es donde quedó el destrozo real: la entrada duplicada de SCRUM-575 se leyó durante días. Con
nombres, un duplicado es el mismo nombre dos veces y se ve sin leer prosa.

## Tests que introduce esta entrada

* `tests/scrum666-banco-lee-css.test.mjs` — 8 pruebas: los tres suelos (hojas encontradas, fichero
  inexistente que lanza, hoja sin reglas que lanza), la respuesta de tres estados, la ceguera
  declarada, que **no** se declara ciego por reglas ajenas, el control negativo de color y margen,
  y el reparto medido (57 %) fijado con margen para que avise si sube o baja mucho.
* `tests/_banco-vistas.mjs` — `hojasDelDashboard`, `reglasQueOcultan`, `ocultoPorCss`.
* `tests/scrum660-iva-defecto-del-documento.test.mjs` — `quienLoEsconde` consulta ya el CSS.


---

# SCRUM-666b · «¿la esconde una regla?» no es «¿tiene alguna?»

**Medido contra:** `origin/main` = `d9f60f7e89cc600e4d518af50ad2a977ed1876ba` · 2026-09-04T14:10:05+02:00
**Rama:** `scrum-666-el-banco-ve-el-css`

## 1 · PASO 0 (regla 39) — el ticket estaba medio arreglado, y el hueco era otro

El encargo decía: «el banco de vistas no aplica CSS externo». **Eso ya no es cierto.** Lo cerró
este mismo ticket en el PR #916 (`45a2474c`), y el banco lee las dos hojas locales desde entonces.

Pero la pantalla desnuda llegó a producción **después**. Así que el hueco no era el que decía el
enunciado, y encontrarlo era el trabajo:

| pregunta | ¿la sabía contestar el banco? |
|---|---|
| ¿una regla de la hoja ESCONDE este nodo? | **SÍ**, desde el #916 — `ocultoPorCss` |
| ¿este nodo tiene ALGUNA regla? | **NO. Nadie se la había hecho.** |

```
ocultoPorCss(<div class="clase-que-nadie-ha-escrito-jamas">) → { oculto: false }
```

`false` se lee como «se ve». Y una clase sin ni una regla no se ve: **se pinta desnuda.** El banco
daba la respuesta buena y la peor noticia posible con el mismo verde.

## 2 · El alcance, medido antes de tocar nada

| | |
|---|---|
| hojas locales del índice | 2 (`tokens.css`, `css/styles.css`, 117 KB) |
| clases que DEFINEN | **377** |
| scripts que declara el índice | **77** |
| atributos `class=` leídos | **664**, ilegibles **0** |
| vistas que el banco publica / montan | 26 / **21** |
| ficheros que consumen el banco | **41** |
| controles que usaban las hojas | **5** (660, 661b, 666, 689, 690) |
| **clases pintadas SIN ni una regla** | **29, en 15 ficheros** |

Tres ficheros al **100 %** —todas sus clases desnudas—, y uno es el del fundador:

```
parteDetailView.js  4 de 4      globalSearch.js  1 de 1      tutorial.js  2 de 2
```

### 🔴 El dato que decidió el diseño

De esas 29, **un barrido por lo PINTADO sólo ve 13**. Las 4 del parte **no**: en el banco esa vista
se va por su rama de error y pinta 2 nodos sin una sola clase. Medir «lo que se pintó» habría
dejado fuera justamente el caso que motivó el ticket, así que **el barrido que manda es el
ESTÁTICO**, sobre el fuente.

Y la población son los **77 scripts del índice**, no los 27 `*View.js`: restringirla perdía 8
clases y dos ficheros enteros, los dos al 100 % (`globalSearch.js`, `tutorial.js`).

## 3 · El coste, porque se preguntó

| | |
|---|---|
| leer las dos hojas (117 KB) | **4,2 ms** |
| trocearlas | **6,8 ms** |
| un montaje del banco, de referencia | 70 ms |
| **el CSS sobre la suite entera** | **+5 tests, 94 s → 94 s** |

No triplica nada: es el **16 % de UN montaje** del banco, y el banco se monta una vez por vista. El
barrido entero (77 ficheros + 2 hojas) tarda menos que montar una sola pantalla.

## 4 · Las tres veces que el instrumento mintió, y cómo se vieron

Ninguna la cazó una revisión. Las tres las cazó la medición, y por eso están escritas:

1. **El lector no entraba en `@media`.** Declaraba huérfanas `col-hide-mobile`,
   `table--cards-mobile` y `quote-line__qty`, **las tres definidas dentro de una media query**. Un
   lector que no entra en el `@media` no encuentra menos: **encuentra las de otro sitio.**
2. **La interpolación pegada al nombre.** `class="status-pill status-pill-${v}"` producía el token
   `status-pill-`, que no es una clase: es **la mitad de un nombre**. Habría mandado a alguien a
   escribir una regla inventada. Ahora la interpolación contamina el token que toca y se descarta.
3. **La autorreferencia, por los dos lados a la vez.** `styles.css:1276` explica *en un comentario*
   una regla `.quote-lines-table` que ya no existe → contarla habría dado por vestida una clase
   desnuda. Y `quotesView.js:786` cita `class="quote-lines-table"` para contar que se retiró →
   contarla habría inventado una huérfana que nadie pinta. Se resuelve quitando comentarios ANTES
   de mirar: en el CSS a mano, en el JS con `soloCodigo` (SCRUM-693/694).

## 5 · La verificación

### 🔴 El rojo que importa, y que CAE CON EL MECANISMO VIEJO

Inyectada una clase real sin regla en `exportView.js`:

| | |
|---|---|
| el guard nuevo | 🔴 **rojo**, nombrando `.clase-nueva-sin-regla-999 (en exportView.js)` |
| los 7 controles de CSS/vistas que ya había | ✅ **71 de 71 en verde** |

Entre esos siete está **el propio SCRUM-666**, el que lee las hojas. Ése es el ticket entero en dos
filas: el mecanismo viejo da por bueno el defecto que llegó a producción.

### Los cuatro rojos, uno a uno

| inyección | qué cae |
|---|---|
| clase huérfana nueva en un fuente | el trinquete, con clase **y** fichero |
| barrido recortado a 3 scripts | el **suelo** — «sólo ha leído 3 script(s)», no un cero limpio |
| el lector deja de entrar en `@media` | el control del `@media`, **el trinquete y el control positivo** |
| `clasesEscritas` sin `soloCodigo` | el control de comentarios, y el trinquete |

Los tres últimos tumban más de un test **a propósito**: un lector roto no produce un fallo, produce
una cosecha de falsos, y eso tiene que notarse por varios sitios a la vez.

### ✅ Control positivo

**62 de 77 scripts sin ninguna clase huérfana.** Es lo que hace creíble el hallazgo del parte: no
es que todo esté mal — es que **esa** pantalla lo está. Si casi todo saliera sucio, lo roto sería
el lector de hojas y no el panel, y el guard lo dice con esas palabras.

### ✅ Control negativo

**Suite completa: 5068 · 4984 pass · 0 fail · 84 skipped.** Ni un rojo ajeno: aplicar la
comprobación de CSS no ha enrojecido nada que midiera otra cosa. `guards:entrada` **21/21, exit 0**.

## 6 · ⚠️ Coordinación — el guard no castiga a quien arregla

La sesión 2 está vistiendo `#parte-detail` **mientras esto corre**, y la 4 sus rótulos.

* **Arreglar una clase NO pone esto en rojo.** Cuando gana su regla, su línea de `CONOCIDAS` sobra
  y un test la **nombra en verde** para que se borre. Un guard que se pusiera rojo cuando alguien
  arregla algo castigaría justo la conducta que persigue.
* **Lo que sí es rojo** es una clase huérfana **nueva**. Si la sesión 2 añade marcado con clases
  sin regla, cae — y eso es lo que se quiere.
* **No se ha tocado** `parteDetailView.js` ni `styles.css`: sus 4 clases se **declaran**, no se
  arreglan.

## 7 · Ficheros

* `tests/_banco-vistas.mjs` — `clasesDeLasHojas(raiz, hojas?)` (con suelo: <100 clases LANZA) y
  `clasesEscritas(fuente, nombre)` (devuelve `ilegibles`, para que un cero por no mirar no pase
  por un cero limpio). Cero dependencias nuevas (regla 36).
* `tests/scrum666b-toda-clase-pintada-tiene-regla.test.mjs` — 9 tests: el suelo, el rojo, la caída
  del mecanismo viejo, el trinquete de 29, el control positivo y tres controles negativos.

## ⛔ No tocado

`public/dashboard/js/parteDetailView.js` · `public/dashboard/css/styles.css` · `public/tokens.css` ·
`ocultoPorCss` y `reglasQueOcultan` (SCRUM-666 sigue igual) · el `continue-on-error` de los dos
vigías · la rama `scrum-653-dos-firmas`, que sigue bloqueada esperando el ALTER de Javier.
