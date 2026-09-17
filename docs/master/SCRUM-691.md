# SCRUM-691 · 16-sep-2026 · Contorno + elevación: medido antes de escribirlo, y hay una contradicción que decide el fundador

**Medido contra:** `origin/main` = `8634ac04c5e8761aceca8088da8b8afe0c7ef5c1` · 2026-09-16T11:30:43Z
**Rama:** `scrum-691-contorno-y-elevacion` · **Carril:** medición + decisión · **Gate:** sin gate

⛔ Esto **mide**. No se escribe la norma en `DESIGN.md` todavía, porque lo medido choca con cuatro
líneas que ya están ahí y el encargo dice que eso lo decide el fundador. `src/` y `public/` intactos.
Ninguna herramienta nueva (regla 4), ninguna dependencia (regla 36).

---

## 0 · OBLIGACIÓN 0 y búsqueda por MECANISMO

| | |
|---|---|
| rama `scrum-691…` en origin | **ninguna** |
| `main` que la nombre | **ninguna** |
| `docs/master/SCRUM-691.md` | no existía |
| buscado por MECANISMO (`box-shadow`, `border:`, `outline`, «contorno», «elevación») | 4 tests y 5 scripts tocan el asunto |

**Lo que hay, y NO es esto:** `scrum689-pestanas-clientes-con-css` y `scrum690-contraste-segmented`
exigen borde **y** elevación **en dos superficies concretas** —pestañas y segmented— como señales
que no dependen del color. Son dos casos, no una norma. **No está hecho**, así que sigo.

---

## 1 · 🔴 LA PREMISA DEL TICKET, RE-MEDIDA (no releída)

El enunciado dice: «`--surface` y `--bg` son casi el mismo color (1,07:1) y `--border` contra `--bg`
da 1,14:1 — todo el sistema se apoya en la tinta». **Confirmado al decimal**, calculando el
contraste WCAG sobre los tokens de `public/tokens.css`:

| par | contraste | umbral 1.4.11 (no textual) |
|---|---|---|
| `--surface` (#ffffff) vs `--bg` (#f6f7f5) | **1,07** | 🔴 no llega a 3,00 |
| `--border` (#e7e9e5) vs `--bg` | **1,14** | 🔴 no llega |
| `--border` vs `--surface` | **1,22** | 🔴 no llega |
| `--ink` (#0f1c17) vs `--surface` | **17,52** | ✅ — aquí sí hay contraste |

> 🔒 **El ticket tiene razón y el matiz importa para la norma:** no es que las superficies no lleven
> contorno; es que **el contorno que llevan está a 1,14** contra el lienzo. Una norma que ordene
> «contorno» sin decir **cuánto contraste** ordena algo que ya se cumple y no se ve.

---

## 2 · (a) EL CENSO · POBLACIÓN y reparto

**Criterio, declarado antes del número.** *Superficie* = regla CSS que pinta un plano blanco
(`var(--surface)`, `#fff`, `white`); los fondos de **acento** no cuentan, porque ésos ya se
distinguen por color y el defecto medido es que el blanco no se distingue del lienzo. *Contorno* =
`border`/`border-<lado>` con valor visible. *Elevación* = `box-shadow` distinto de `none`. Cuentan
las reglas hermanas del mismo elemento (`.card` + `.card:hover`), **no** las de sus ancestros.

**POBLACIÓN: 3 hojas · 742 reglas CSS · 43 superficies.**

| | nº |
|---|---|
| contorno **Y** elevación | **19** |
| sólo contorno | **20** |
| sólo elevación | **4** |
| 🔴 ninguna de las dos | **0** |

**Control positivo del clasificador:** discrimina los cinco casos sintéticos —ambas, sólo borde,
sólo sombra, ninguna, `border: 0`— y **no** cuenta un fondo de acento como superficie. Sin eso, el
«0 sin ninguna de las dos» sería ceguera y no resultado.

> ⚠️ **Mis dos primeras cifras fueron falsas, y las corrijo aquí porque el número final no se
> entiende sin ellas.** Dije 12 y luego 11 «con ambas», y **son 19**. Dos defectos míos:
> ① la familia fusionaba `.modal .header` con `.modal`, así que una cabecera heredaba el borde de su
> contenedor —un descendiente no es un estado—; ② rechazaba todo valor que empezara por `0`, y eso
> mataba `box-shadow: 0 1px 2px …`: **25 sombras literales del árbol**, que son casi todas. El
> primer número de una sombra es el desplazamiento, no un ancho. Con ese fallo el censo habría
> dicho que el producto casi no usa elevación, que es **lo contrario** de lo que pasa.

---

## 3 · 🔴 (b) LO QUE YA ESTÁ ESCRITO EN `DESIGN.md` Y CONTRADICE LA NORMA NUEVA

**No se ha borrado ni tocado una letra.** Son cinco líneas, y todas dicen lo mismo: **el borde hace
el trabajo y la sombra es una respuesta a estado**, no un delimitador en reposo.

| línea | lo que dice, literal |
|---|---|
| `DESIGN.md:154` | «las superficies descansan planas con un borde de 1px cálido; **la sombra aparece como respuesta a estado** (hover, modal, dropdown) o para separar lo flotante» |
| `DESIGN.md:157` | «**Reposo** …: cards en estado normal, **casi imperceptible; el borde hace el trabajo**» |
| `DESIGN.md:163` | «**La Regla Plano-por-Defecto.** Las superficies son planas en reposo (borde 1px + sombra Reposo). **La sombra Elevado solo aparece al hover.** Si una card "levita" sin que la toques, la sombra es demasiado» |
| `DESIGN.md:194` | «**Border:** 1px Borde (#e7e9e5) — **el borde, no la sombra, define la card en reposo**» |
| `DESIGN.md:223` | «**Do** definir cards con borde 1px cálido + sombra Reposo; **elevar solo al hover**» |

**La contradicción, en una frase:** la Opción B eleva a norma **las dos** señales; `DESIGN.md` dice
hoy que **sólo una** delimita en reposo y que la otra es reacción. Y encima —§1— la señal a la que
`DESIGN.md` confía el trabajo está medida en **1,14**.

> 🔒 **Esto lo decide el fundador, y por eso no escribo la norma.** Hay tres salidas y no son
> equivalentes: **(i)** reescribir esas cinco líneas para que la elevación delimite en reposo, lo que
> cambia el aspecto del producto entero; **(ii)** mantener la Regla Plano-por-Defecto y **subir el
> contraste de `--border`** hasta 3,00, que es un cambio de token y no de norma; **(iii)** las dos.
> La (ii) es la única que ataca lo que el ticket midió sin tocar el lenguaje visual.

---

## 4 · 🔴 ② ¿PUEDE UN GUARD DISTINGUIR «superficie que DEBERÍA llevar contorno» de «superficie que no»?

**NO. No en general, y el motivo es medible, no una impresión.**

Lo que decide si una superficie blanca necesita delimitarse es **sobre qué descansa**: sobre `--bg`
es invisible (1,07); sobre una superficie ya delimitada —la cabecera dentro de un modal— no necesita
nada, y ponerle borde sería ruido. Ese dato **no está en el CSS**: está en el anidamiento del DOM.

**Y aquí el anidamiento no es estático:** **42 ficheros** de `public/dashboard/js/` construyen su
marcado con `innerHTML`, concatenando cadenas en tiempo de ejecución. Un guard que lea las hojas de
estilo no puede saber quién es el padre de `.foo`, porque el padre depende de qué vista lo pinte.

**Lo que un guard SÍ puede hacer, y conviene no confundirlo con distinguir:**

* Comprobar hechos **sintácticos**: que una regla declare borde o sombra. Eso es lo que hace el
  censo de §2, y es honesto.
* Comprobar una **lista declarada** de clases del sistema —`.card`, `.modal`, `.dropdown`…—. Eso no
  es distinguir: es **enumerar**, y la enumeración la mantiene una persona. Es exactamente lo que
  hacen SCRUM-689 y SCRUM-690 para dos superficies.
* Vigilar el **contraste de los tokens**, que sí es puramente numérico y no depende del DOM: que
  `--border` contra `--bg` no BAJE de donde esté. Ése sí sería un guard sin falsos rojos.

> 🔒 **Por qué digo que no en vez de construirlo.** Un guard que adivine el padre daría rojo a la
> cabecera de un modal por no llevar borde. Un rojo injusto no sólo miente: **enseña a desactivar el
> guard**, y entonces se pierde también lo que el guard sí veía. Si el fundador quiere red aquí, la
> honesta es la del **contraste de tokens**, no la del contorno por superficie.

---

## 5 · Lo NO tocado

`DESIGN.md` (**leído, no corregido**) · `public/` y su CSS · `src/` · ningún token · ninguna
herramienta ni bundler (regla 4) · ninguna dependencia (regla 36) · ningún estado ni flag (27).
**Nada ejecutado contra producción ni contra staging.**
