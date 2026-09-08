# SCRUM-676 · Las hojas de estilo del índice, con UN solo lector

**Fecha:** 2-sep-2026 · **Carril:** S3 (instrumentos) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `214f9de744e4ae9ea8238fd7594d32dae1581001` · 2026-09-02T23:05:24+01:00

**Tanda:** 4825 tests, 4741 pass, **0 fail**, 84 skipped — medida DESPUÉS del último cambio, entrada incluida, y con el cliente de Prisma regenerado desde este worktree. Suelo de la tanda: `suelo 4798 · total 4825 · margen 27`.

---

## PASO 0

### ENTRADA

**Al `recursosDe` del ticket no llega ningún usuario: vive en `tests/`.** Es una pieza de la suite
(`tests/_carga-de-pagina.mjs:97`), y sus únicos llamadores son `analizarPagina` en ese mismo fichero
y `tests/scrum378-carga-por-pagina.test.mjs`.

**Y hay que corregir la premisa del encargo**, que él mismo pedía comprobar:

> *«una hoja que el extractor no vea queda fuera de lo que sea que `recursosDe` alimenta —precache,
> sellado con huella, comprobación de existencia—»*

Medido: **`recursosDe` no alimenta ni el precache ni el sellado.** Alimenta el cubo ② de CSS de
SCRUM-378 (qué clases usa una página frente a qué hojas carga) y, vía `aFichero`, sí comprueba
existencia. El precache (`sw.js` ↔ índice) y el sellado con huella los hacen **otros lectores**, y
uno de ellos está en producción. Eso no desactiva el ticket: lo agranda, porque los otros dos
lectores resultaron ser peores.

La entrada de usuario que sí existe es la del **sellado**: `public/dashboard/index.html` se sirve
reescrito por `sellarReferencias` (`src/core/http/huellaEstaticos.ts`), que le pone `?v=<huella>` a
cada referencia local.

### MECANISMO: existe, y es el de SCRUM-670

`tests/_scripts-de-la-pagina.mjs` ya era **el único sitio donde se lee una etiqueta de un marcado**,
con `sinComentarios` exportado, un lector de valores de atributo que acepta comillas dobles, simples
o ninguna, y la doctrina de `ilegibles`. El trabajo no era inventar nada: era **darle superficie** a
ese motor para la población que faltaba.

## ① El censo de lectores: DOS instrumentos, y el segundo encontró lo que el primero no

| Instrumento | Principio | Encontró |
|---|---|---|
| textual | buscar la cadena `<link` en `.mjs/.ts/.js` | 2 lectores |
| **AST** | enumerar las **regex literales** del código y filtrar las que mencionan `link`/`href`/`stylesheet` | **3 lectores** |

El que faltaba es el que más pesa: **`src/core/http/huellaEstaticos.ts` — PRODUCCIÓN**. Su regex
(`/\b(src|href)\s*=\s*"([^"]*)"/gi`) no contiene la cadena `<link`, así que el instrumento textual
no podía verlo. Con un solo instrumento, este ticket habría cerrado creyendo que había dos lecturas.

`tests/scrum274-huella-estaticos.test.mjs` **no** es un cuarto lector: consume el de producción.

## ② 🔴 Las tres lecturas, medidas — y el acuerdo que no valía nada

Sobre `dashboard/index.html` las tres daban **exactamente lo mismo**: `/tokens.css` y
`./css/styles.css`. Sobre las formas que hoy no están en el índice:

| caso | `recursosDe` | `_banco-vistas` | sellado (producción) |
|---|---|---|---|
| comillas SIMPLES | 1 | **0** 🔴 | **0** 🔴 |
| partida en dos líneas | 1 | 1 | 1 |
| `<link>` COMENTADA | 0 | **1** 🔴 | **1** 🔴 |
| atributo de más | 1 | 1 | 1 |
| `?v=` en el href | **0** 🔴 | 1 | 1 |
| `href` antes de `rel` | 1 | **0** 🔴 | 1 |
| `rel="preload"` | **1** 🔴 | 0 | **1** 🔴 |

**Ninguna columna está bien entera.** Es SCRUM-670 otra vez: tres instrumentos coincidiendo en el
caso fácil, y los tres equivocados en cuanto el marcado se mueve.

Dos detalles que lo sacan de lo hipotético:

* **El índice real TIENE una `<link>` con `href` antes de `rel`** — la hoja remota de fuentes. O
  sea que el defecto de `_banco-vistas` no era un caso inventado: estaba en el fichero.
* **El `?v=` tampoco es inventado:** lo añade el sellado de producción. Sobre un marcado ya
  servido, `recursosDe` habría contado **cero hojas** y no habría dicho nada.

## ③ ¿Podía derivar del extractor de `<script>`? Medido antes de decidir: **no la función, sí el fichero**

`scriptsDeLaPagina` clasifica por `type=module` y `defer`/`async`, que no existen en un `<link>`; y
una hoja se decide por `rel`, que no existe en un `<script>`. Forzar una función para las dos
poblaciones habría sido peor que dos.

**Lo que sí se reusa es donde estaban los defectos:** `sinComentarios`, el lector de valores de
atributo y la doctrina de `ilegibles`. Por eso `hojasDeLaPagina` vive **en el mismo fichero**: sigue
habiendo un solo sitio donde se lee una etiqueta.

## Lo construido

| Pieza | Qué es |
|---|---|
| `hojasDeLaPagina(html)` | el extractor. PURA. Devuelve `{locales, remotas, otras, ilegibles}` |
| `cegueraDeLasHojas(res, minimo, donde)` | «no supe mirar» ≠ «no hay hojas» |
| `recursosDe` | deriva de ella (y pierde sus dos defectos) |
| `hojasDelDashboard` (`_banco-vistas`) | deriva de ella (y pierde los suyos) |
| `tests/scrum676-hojas-del-indice.test.mjs` | 20 tests |

Y de paso, en carril: **`_carga-de-pagina.mjs` tenía su propio `sinComentariosHtml`** — una **cuarta
opinión** sobre qué es un comentario HTML, escrita a mano al lado del `sinComentarios` que el
extractor exporta justo para evitarlo. Ahora usa el de la casa.

### La clasificación, y por qué `rel` y no la extensión

La población se decide **como la decide el navegador**: por `rel`. `rel` es una **lista de fichas**
(`rel="preload stylesheet"` es HTML legal), así que se parte y se busca `stylesheet`. Decidir por
«el href acaba en `.css`» era lo que hacía `recursosDe`, y por eso contaba un `preload` como hoja
aplicada y perdía las que llevan query. **Precargar no es aplicar.**

Local y remota van separadas: el índice carga dos locales **más una remota** (SCRUM-666), y meter la
de Google en la población local sería exigir un fichero del árbol que no existe.

## 🔴 Los rojos, por el mecanismo — cinco mutaciones, cada una con post-condición

Commiteado en verde **antes** de mutar. Cada mutación comprueba que el fichero que dice cambiar
cambió de verdad, y se restaura y se re-verifica.

| Mutación | Cae | Qué nombra |
|---|---|---|
| el lector de `href` deja de aceptar comillas simples | **2** | «comillas SIMPLES», «valor SIN comillas» |
| el extractor deja de quitar comentarios | **1** | «`<link>` COMENTADA: NO se cuenta» |
| se deja de mirar `rel` | **4** | las dos hojas del índice, la remota, las «otras», el `preload` |
| lo ilegible se cuenta de menos y se calla | **1** | «lo que no se sabe leer va a ILEGIBLES» |
| aparece una SEGUNDA lectura de `<link>` en `tests/` | **1** | el censo de lectores |

Control antes: `fail=0`. Control después de restaurar todo: `fail=0`.

## Controles

| Control | Resultado |
|---|---|
| **NEGATIVO del refactor** · las NUEVE páginas de `public/` | el extractor nuevo da **la misma población que el viejo en las nueve**. Cero diferencias |
| **NEGATIVO** · reordenar las `<link>` | el conjunto no cambia — **y se reordena sobre el marcado SIN comentarios**, porque mover líneas del HTML crudo puede sacar una etiqueta de su comentario y cambiar la población de verdad |
| **NEGATIVO** · un `<script>` de más | no mueve las hojas |
| **SUELO** · cero `<link>` | «EXTRACTOR CIEGO», con el motivo escrito |
| **CONTROL DEL SUELO** · el índice real | **no** se declara ciego (si no, el test de arriba aprobaría un instrumento roto) |
| el otro lado del filo · `<link>` sin `href` | **no** es ilegible: no pide recurso. Sin esto el guard gritaría por etiquetas correctas |
| **TRINQUETE** · una sola regex de `<link>` en `tests/`, y en el extractor | verde, y probado que cae al añadir otra |

### 🔴 Y el guard se cazó a sí mismo. Cuarta vez hoy

El censo de lectores contaba **dos regex de su propio fichero**: la del control negativo
(`/<link\b/i`) y la del propio filtro (`/<link/i`). Se arregló **sin relajar el censo** —la
comprobación pasa a ser por cadena, no por regex— y queda escrito en los dos sitios por qué.

### Y un trinquete AJENO cazó este ticket. Se le dio la razón

La tanda completa salió con **un rojo**: SCRUM-553, *«el número de etiquetas con el `>` pegado NO
SUBE»* — **21, y el tope es 20**. El infractor era este mismo guard.

Medido antes de decidir: **el extractor nuevo NO es el culpable.** `APERTURA_LINK` es
`/<link\b([^>]*)>/gi`, que deja hueco a los atributos igual que su hermana de `<script>`, y el censo
no la cuenta. Lo que contaba era una **aserción** mía: `assert.match(deScripts, /<script src>/)`.

Y al cambiarla a `includes('<script src>')` **seguía contando**, porque un `includes` también es un
buscador y el literal seguía llevando el `>` pegado. El arreglo definitivo es quitar el `>` del
ancla — que no pierde nada, porque lo que se comprueba es que el mensaje nombra su población.

**El tope no se ha tocado.** Ese número sólo puede bajar, y ajustarlo para que quepa el código
nuevo es exactamente lo que no se hace. Censo tras el arreglo: **20, y de este ticket 0**.

## 🕳️ Huecos declarados

1. **El sellado de producción NO se ha tocado.** Sigue siendo un lector aparte, con sus dos defectos
   medidos. Es otro carril y contesta otra pregunta (sella **todo** `src`/`href`, no sólo hojas).
   Va abajo como hallazgo.
2. **`recursosDe.hojas` ahora incluye las remotas** (antes las perdía por accidente, porque la URL
   de Google no acaba en `.css`). No cambia nada aguas abajo —`aFichero` devuelve `null` para las
   remotas y se filtran—, pero **no lo he verificado más allá de sus consumidores actuales**.
3. **No he mirado las páginas públicas servidas desde `src/`** (los HTML de `payBizum`, `receipt`,
   `albaranPublic`…). Tienen `<link>` y ninguno de estos guards los mira. No es este ticket.
