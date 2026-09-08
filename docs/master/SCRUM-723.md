# SCRUM-723 · el guard de 603b comparaba contra un objetivo MÓVIL

**Medido contra:** `origin/main` = `d502c3f474650c505fd78874073d71eebfba1e14` · 2026-09-04T16:04:52+01:00

## Qué pasó, y por qué no era un fallo de quien lo sufrió

El 4-sep-2026 el guard `SCRUM-603b · EL PDF DE LA FACTURA NO SE HA TOCADO` se puso **rojo en la
rama de SCRUM-605**, que no había tocado el PDF de la factura. Lo medido entonces:

| | |
|---|---|
| blob de `pdf.service.ts` en mi disco | `c19b1965` |
| blob en `origin/main` | `320fb2a3` |
| diff de mi rama contra su base, para ese fichero | **vacío** |
| quién lo movió | `b252fc00` — *SCRUM-594 (DOC-04): descuento por línea (%) y global (EUR) en el PRESUPUESTO*, entrado en `main` |

El guard leía **la punta de `origin/main`**. Con eso no mide lo que hace la rama: mide la
distancia entre dos cosas que se mueven, y una de las dos se movió sola. Un guard que acusa a
quien no ha hecho nada se acaba ignorando — y entonces ya no protege la factura de nadie.

> **NO SE RELAJA LO QUE EL GUARD EXIGE. Se cambia CONTRA QUÉ compara.** El recorte que compara
> (`cuerpoDeLaFactura`) queda **exactamente igual**, byte a byte y sin interpretación. Lo único
> que cambia es la otra mitad de la comparación.

## El arreglo

La referencia estable de una rama es su **punto de partida**: `git merge-base HEAD origin/main`,
que es un commit y no se mueve.

**El motor no nace aquí, se importa.** `baseDeLaRama` ya existía en `tests/_censo-eol.mjs` desde
SCRUM-533 —con su lista de referencias de respaldo y su `null` honesto cuando no puede resolver—.
Escribir un segundo `merge-base` sería tener dos que divergen el día que alguien arregle uno. Lo
que se añade en `tests/_base-de-la-rama.mjs` es **superficie**: leer un fichero *en* esa base.

**En CI sale la misma cuenta**, y no por casualidad: en un PR, `actions/checkout` deja como `HEAD`
el commit de **mezcla**, cuyo árbol ya lleva `main` dentro. Ahí `merge-base` devuelve la punta de
`main` y la diferencia contra el disco vuelve a ser, exactamente, lo que aporta la rama. El job de
la suite ya lleva `fetch-depth: 0` desde SCRUM-388, así que la base resuelve.

**Y CIEGO antes que verde:** si no hay base, o el fichero no se puede leer en ella, el guard **cae
diciendo qué le falta**. No cae hacia `origin/main` — eso devolvería el defecto sin que nadie se
entere— ni informa de un verde: «no sé» y «no ha cambiado» dan exactamente el mismo color si nadie
los separa.

## El caso que fallaba, REPRODUCIDO antes de arreglar nada

En un repositorio **sintético** (`repoDeRamaYMain`), porque probarlo contra `main` de verdad
exigiría que `main` se moviera durante el test — o sea, exigiría suerte:

| escenario | lógica VIEJA (punta de `origin/main`) | lógica NUEVA (base de la rama) |
|---|---|---|
| rama **limpia** + `main` tocó la factura | 🔴 **ROJO** (acusa a quien no hizo nada) | ✅ verde |
| la **rama** cambia el PDF de la factura | 🔴 rojo | 🔴 **ROJO** |
| la **rama** lo cambia y `main` está quieto | 🔴 rojo | 🔴 **ROJO** |
| no hay ninguna referencia que resolver | (reventaba) | **CIEGO**, declarado |

Los dos veredictos viven **en el mismo test**: «ahora está verde» no dice nada si no se ve el rojo
de al lado. Por eso la lógica vieja se conserva ahí dentro, y su retirada tiene fecha: el día que
se borre ese caso, no antes.

> 🔴 **Y el fixture cazó algo al escribirlo**: esta máquina tiene `core.autocrlf=true` a nivel
> system, así que el `checkout` escribía CRLF mientras `git show` devolvía LF y **todo** salía
> rojo por el fin de línea, incluida la lógica buena. El repo de verdad no lo sufre porque su
> `.gitattributes` promete LF en disco (SCRUM-533). El fixture reproduce **eso**, no la máquina.

## El agujero que 603b dejó DECLARADO, atado

603b escribió que se acotaba al **cuerpo** de `generateInvoicePdf` y que, si alguien movía código
de la factura fuera de esa función, dejaba de verlo. No es teórico: mover diez líneas a un
ayudante del módulo cambia lo que imprime la factura y deja en el cuerpo una llamada donde antes
había código.

Se ata midiendo el **ámbito alcanzable** (`tests/_ambito-de-la-factura.mjs`): la función **más
todo lo que el módulo declara y ella alcanza**, directa o indirectamente. Hoy son **cinco piezas**,
declaradas **por nombre y no por línea** (referenciar por posición caduca — SCRUM-710):

`MARCADOR_MICROCOPY_DESGLOSE` · `NOMBRE_IMPUESTO_POR_DEFECTO` · `fmtImporte` ·
`generateInvoicePdf` · `loadLogoBuffer` — **23.288 caracteres** comparados frente a los 22.040 del
recorte anterior.

Es un **superconjunto estricto**: todo lo que caía antes sigue cayendo, y ahora también cae mover
el código a un ayudante. Y tiene su lado que **absuelve**, medido con fuentes en la mano: un
ayudante que sólo usa el **presupuesto** NO entra — si entrara, el guard volvería a bloquear el
fichero entero, que es justo lo que 603b arregló.

Por AST y no por texto: `softBreakLongTokens` aparece en comentarios y en cadenas del propio
módulo, y un recorte por texto ampliaría el ámbito por una simple mención.

## El censo, con suelo

`tests/_censo-referencia-movil.mjs` — ¿quién más compara contra `origin/main` o contra otra
referencia móvil, en vez de contra su punto de partida?

**825 ficheros** de `tests/` y `scripts/` · **18** llaman a git · **133** llamadas · **3**
`merge-base`.

**Cuatro hallazgos, cada uno con su motivo escrito:**

| dónde | por qué sigue ahí |
|---|---|
| `scripts/censo-reparto.mjs` (`ls-tree`, `rev-parse`) | su pregunta ES sobre la punta: «¿qué hay hecho ahora mismo en `main`?». No corre en CI (SCRUM-387) |
| `scripts/vigilante-de-despliegue.mjs` (`rev-parse`) | igual: «¿el commit que dice producción está en `main`, y cuántos lleva de retraso?». Contra una base no significaría nada |
| `tests/scrum723-…` (`show`) | la lógica **vieja**, conservada para poder enseñar el rojo. Repo sintético; se retira con el caso ① |

> 🔴 **EL CENSO SE QUEDÓ CORTO DOS VECES, Y LAS DOS LO CAZÓ ÉL MISMO.**
>
> 1. **Los envoltorios.** La primera versión sólo veía `execFileSync('git', …)` a pelo: **38**
>    llamadas en todo el árbol. Casi todo el git de esta casa se escribe como
>    `const g = (...a) => execFileSync('git', a)` y luego `g('show', …)`. Con los envoltorios son
>    **133** — y aparece un hallazgo que era invisible, el del vigía del despliegue. Lo destapó su
>    propio test, que usa ese idioma y salía absuelto. **Un censo ciego al idioma más común del
>    árbol devuelve un árbol limpio que no existe.**
> 2. **La referencia por parámetro.** `tests/_censo-tickets.mjs` la recibe como
>    `ref = 'origin/main'` y la mete en el git de abajo. Seguir la cadena sería análisis de flujo;
>    **declararla** la deja a la vista en vez de dejarla fuera. Son cuatro ficheros, listados.

El suelo mide la **población**, no los hallazgos: si el censo lee menos de 400 ficheros, ve menos
de 10 con git, cuenta menos de 100 llamadas o no encuentra ni un `merge-base`, **falla** — porque
«0 hallazgos» y «no supe mirar» dan el mismo verde. Y el clasificador se prueba por los dos lados:
acusa un `git show origin/main:` que se le da en la mano, absuelve un `merge-base` (que es la
solución, no el problema), absuelve `HEAD` (el árbol bajo prueba), no cuenta menciones en
comentarios —la trampa de SCRUM-203— y no llama envoltorio a una función que no arranca git.

## Visto en ROJO, no razonado

Cuatro mutaciones sobre el árbol de verdad, cada una revertida con post-condición
(`Buffer.compare` contra los bytes de disco, no contra el blob — SCRUM-570) y `git status` limpio
después:

| mutación | guard de 603b (cuerpo) | guard de 723 (ámbito) |
|---|---|---|
| una línea **dentro** de `generateInvoicePdf` | 🔴 **ROJO** | 🔴 **ROJO** |
| una línea en **`fmtImporte`** — ayudante que la factura alcanza, fuera de su cuerpo | ✅ verde | 🔴 **ROJO** |
| un guard nuevo que compara contra la punta, sin declararlo | — | 🔴 **ROJO** (el censo) |
| la factura empieza a llamar a un ayudante nuevo | — | 🔴 **ROJO** (el ámbito declarado) |

> La **segunda fila es el ticket entero**: el agujero de 603b no es una hipótesis, se ve. Con el
> cambio dentro de un ayudante, aquel guard da verde mientras lo que imprime la factura ha
> cambiado. El de SCRUM-723 lo caza.

## Ficheros

| fichero | qué es |
|---|---|
| `tests/_base-de-la-rama.mjs` | **nuevo** · superficie sobre el `baseDeLaRama` que ya existía: leer un fichero en la base |
| `tests/_ambito-de-la-factura.mjs` | **nuevo** · el ámbito alcanzable de `generateInvoicePdf`, por AST |
| `tests/_censo-referencia-movil.mjs` | **nuevo** · el censo, con envoltorios y referencia indirecta |
| `tests/scrum723-guard-contra-su-base.test.mjs` | **nuevo** · los ocho casos: el que fallaba, el positivo, el ciego, el agujero y el censo |
| `tests/scrum603b-descripcion-en-el-albaran.test.mjs` | re-anclado a la base de la rama; lo que exige queda intacto |

**No se toca el camino de emisión.** Todo lo de este ticket **lee**: ni una línea de
`src/modules/invoicing/`, ni de `prisma/schema.prisma`, ni microcopy.

## Lo que este ticket NO arregla

* `tests/scrum387-censo-reparto.test.mjs` sigue diciendo en su mensaje que «CI no tiene
  `origin/main` fetcheado». **Eso dejó de ser cierto en SCRUM-388**, que puso `fetch-depth: 0` en
  el checkout del job de la suite. El guard sigue siendo correcto —un guard de PR no debe ir a
  buscar su referencia fuera del árbol— pero su motivo escrito caducó. Es de otro carril: se
  reporta, no se toca (regla 9).
* La referencia que viaja por **parámetro** hasta un git (`_censo-tickets.mjs`) queda **declarada,
  no seguida**. Cerrarlo pide análisis de flujo, y eso es otro ticket.
