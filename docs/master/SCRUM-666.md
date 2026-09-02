# SCRUM-666 · El banco de vistas ya mira el CSS externo — y dice cuándo no sabe mirar

**Medido contra:** `origin/main` = `fdc98cf03e82be7952d5cefb692edc3eef2eaa63` · 2026-09-02T12:57:13Z  ·  (remedido tras mezclar main por segunda vez; la anterior fue `61c90617` · 2026-09-02T12:35:08Z)

> Rama apilada sobre `scrum-660-iva-defecto-del-documento`, con `origin/main` mezclado dentro.
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

## 6 · El conflicto de `SCRIPTS_DEL_DASHBOARD` — dos merges, y el segundo corrige la REGLA

**Primer merge (sexta colisión).** Los números chocaron —67 en la rama, 68 en main—, así que el
conflicto se veía. Se resolvió **contando sobre el índice ya mezclado** (`grep -c "<script src="`
→ **69**), no eligiendo un lado ni sumando, y **se conservaron los dos comentarios**.

**Segundo merge (séptima colisión, y de las SILENCIOSAS).** Al volver a mezclar `main`, los dos
lados decían `69` —main llegó ahí con SCRUM-611 y esta rama no añade ningún `<script>`—, así que
git dejó `export const SCRIPTS_DEL_DASHBOARD = 69;` **fuera de los marcadores** y sólo chocaron
los comentarios. Medido sobre el índice ya mezclado, sin heredar de ningún lado:

| medida | resultado |
| --- | --- |
| `grep -c "<script src=" public/dashboard/index.html` | **69** |
| `grep -o "<script src="` (control: dos en una línea contarían distinto) | **69** |
| duplicados en el índice | **0** |
| los 69 ficheros existen en disco | **sí** |
| orden | `tiposDeIva` 247 < `quotesView` 248 · `switchTipoArticulo` 250 y `margenCatalogo` 251 < `productsView` 252 |

🔴 **Y aquí se corrige la regla, que es el hallazgo.** Los dos lados documentaban **el mismo
script** (`tiposDeIva.js`, SCRUM-611): la rama con la flecha caduca «66 → 67», escrita antes de
mezclar; main con la «68 → 69» ya recalculada y el orden verificado por línea. La regla que el
fichero venía repitiendo —«se conservan los comentarios de los dos lados, cada uno documenta un
script real»— **sólo vale cuando cada lado documenta un script DISTINTO**. Aplicarla aquí habría
dejado **dos entradas para un solo script con flechas contradictorias**.

Que es exactamente la corrupción que el fichero ya arrastra con **SCRUM-575 / `nifEspanol.js`**
(«63 -> 64» y «64 → 65»). **Ahora se sabe cómo nació**: no por un descuido de quien resolvió aquel
merge, sino por **aplicar correctamente una regla mal enunciada**. Es un dato sobre el diseño, no
sobre nadie.

La regla, enunciada bien y escrita ya en `tests/_banco-vistas.mjs`:

* lados que documentan scripts **distintos** → se conservan los dos y se recuenta el valor;
* lados que documentan el **mismo** script → se conserva **uno**, el de la flecha recalculada sobre
  el árbol mezclado, y se descarta el caduco. No es elegir un lado por gusto: es tirar una entrada
  que habla de un árbol que ya no existe.

**La asimetría que hace que esto importe:** el número lo vigilan dos guards, así que un valor corto
cae en la primera tanda —comprobado: con 68 declarado y 69 reales caen `guard-colisión` y el SUELO
de SCRUM-417, los dos nombrando la cifra—. **Al registro no lo vigila nadie**, y el daño de esta
clase de conflicto no es un número equivocado: es una entrada falsa que se lee durante meses.

Con una **lista de nombres** en vez de un recuento este conflicto no existiría: `'tiposDeIva.js'`
aparece una vez en cada lado, la unión de los dos conjuntos es trivialmente correcta, no hay
flechas que recalcular, y una duplicación se ve porque el nombre sale dos veces. Es **SCRUM-663**,
y esta séptima colisión es su séptima evidencia.

## Tests que introduce esta entrada

* `tests/scrum666-banco-lee-css.test.mjs` — 8 pruebas: los tres suelos (hojas encontradas, fichero
  inexistente que lanza, hoja sin reglas que lanza), la respuesta de tres estados, la ceguera
  declarada, que **no** se declara ciego por reglas ajenas, el control negativo de color y margen,
  y el reparto medido (57 %) fijado con margen para que avise si sube o baja mucho.
* `tests/_banco-vistas.mjs` — `hojasDelDashboard`, `reglasQueOcultan`, `ocultoPorCss`.
* `tests/scrum660-iva-defecto-del-documento.test.mjs` — `quienLoEsconde` consulta ya el CSS.
