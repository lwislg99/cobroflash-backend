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

---

# APÉNDICE · El token, subido — decisión del fundador: opción (ii)

*17-sep-2026 · rama `scrum-691b-el-token-que-no-se-ve`*

**Medido contra:** `origin/main` = `1e7d6de20a94bc67cad1dd8b04f00acfb8ec1507` · 2026-09-17T09:58:17+01:00

> **Se sube el TOKEN, no se reescribe la norma.** Las cinco líneas de `DESIGN.md` que la fase de
> medición señaló (`:154`, `:157`, `:163`, `:194`, `:223`) **no se han tocado**. La Regla
> Plano-por-Defecto se mantiene: el borde hace el trabajo y la sombra responde a estado. Lo que
> estaba mal no era la norma, era el valor.

## ① El valor, y contra qué fondo se calculó

Los dos candidatos, **re-medidos y no releídos**:

| par | antes | ahora |
| --- | --- | --- |
| `--border` vs `--bg` | **1,14** | **3,04** |
| `--border` vs `--surface` | **1,22** | **3,26** |

🔴 **APRIETA `--bg`, y está comprobado, no supuesto.** `--bg` (`#f6f7f5`) es más oscuro que
`--surface` (`#ffffff`), así que un borde oscuro contrasta **menos** contra el lienzo. Con el valor
viejo: 1,14 contra `--bg` frente a 1,22 contra `--surface`. Un valor elegido contra `--surface` se
habría quedado corto contra `--bg` — que es justo lo que el encargo pedía descartar.

**Hay un solo valor que cumple los dos**, así que no hay decisión que devolver:
`--border: #8d8f8b`. Es el **primero** que llega a 3,00 bajando el nivel y **conserva el matiz del
original** (R−2 y B−4 respecto a G): cambia el tono, no el color.

### Modo oscuro: NO EXISTE, y va medido

Cero `prefers-color-scheme`, cero `data-theme`, cero `color-scheme` en **todo** `public/`. No es
que no se haya mirado: se ha buscado y no hay. **El guard vigila que siga sin haberlo**: si alguien
añade un tema, el veredicto no se emite hasta que se le enseñe a medir el otro bloque. Un token que
cumple en claro y no en oscuro es medio arreglo con nombre de arreglo entero.

## ② El guard — de TOKENS, no de superficies

`tests/scrum691-contraste-de-tokens.test.mjs` sobre `scripts/_contraste-de-tokens.mjs`.

**Por qué tokens.** La fase de medición dejó probado que un guard **no puede** decidir si una
superficie necesita contorno: depende del anidamiento del DOM, y 42 ficheros de
`public/dashboard/js/` construyen su marcado con `innerHTML` en ejecución. Un guard que lo
adivinara le daría rojo a la cabecera de un modal. **El contraste de un token es un número y no
depende del DOM.**

| pata | qué hace | ✅ |
| --- | --- | --- |
| **🔴 ROJO REAL** | con el valor que no se veía, los dos pares quedan por debajo del umbral — y comprueba además que el fondo que aprieta sigue siendo `--bg` | sí |
| **✅ VERDE REAL** | con el valor de hoy, los **dos** pares cumplen; un par sin medida no cuenta como par que cumple | sí |
| **🔴 SUELO** | una hoja con tokens que no son color (radios, sombras) → los pares salen **NO MEDIBLES**, no «0 incumplimientos» | sí |
| **🔴 MUTACIÓN** | el ancla se cuenta **antes** de sustituir (exactamente 1), se comprueba que el texto cambió y que el lector ve el valor nuevo | sí |

Mutación declarada para el meta-guard y **ejecutada**: exit 1, cae el test nombrado, restauración
byte a byte verificada contra los bytes de disco.

```
población: 19 tokens de color · 2 pares vigilados · 0 POR DEBAJO de 3.00 · 0 no medibles
           · bloques de tema extra (modo oscuro): 0
```

**Lo que este guard NO cubre, dicho y no escondido:** no sabe si una superficie concreta **usa** el
token. Un `border: 1px solid #ddd` escrito a pelo se le escapa. Vigila que el valor compartido sea
visible, no que todo el mundo lo use.

## ③ Lo que cambia de aspecto

**Se ve en todas las pantallas a la vez.** Medido sobre las 3 hojas (786 reglas):

* **29 reglas** pintan con `var(--border)`, y **las 29 son contorno** — 27 con `border` / `border-<lado>`
  y 2 con `border-color`.
  *(Corrección de mi propia medición: primero conté 27 y dejé 2 como «otras propiedades»; eran
  `border-color`, que también es contorno.)*
* **27 clases distintas**, 25 con presencia en el marcado.

**Las tres más usadas**, por veces que aparecen en el marcado de `public/`:

| veces | clase | qué es |
| --- | --- | --- |
| **139** | `.card` | la tarjeta: la superficie más repetida del producto |
| **108** | `.btn-secondary` | el botón secundario — su borde **es** su forma |
| **96** | `.field` | el campo de formulario |

Detrás: `.detail-section` (43), `.detail-rail` (15), `.segmented` (12).

## 🔴 Hallazgo que NO se ha tocado (regla 9)

**El cambio invierte una jerarquía.** Hoy `--input-border` (`#cdd2cb`) es **más** visible que
`--border`: 1,43 frente a 1,14. Después, `--border` llega a 3,04 y `--input-border` se queda donde
estaba — o sea que **los inputs pasan a tener un contorno más flojo que las tarjetas**, al revés de
lo que declara su propio comentario en la hoja («borde de input mas visible, legible a pleno sol»).

Y 1,43 **también está por debajo** de los 3,00 que pide WCAG 1.4.11: el borde de un input es
igualmente el límite visual de un componente.

**No se ha ajustado.** El encargo lo prohíbe expresamente y la regla 9 también: se mide y se
reporta lo de uno. Queda como decisión del fundador.

## Lo NO tocado

`DESIGN.md` · ningún otro token · ningún estado ni flag (regla 27) · ninguna dependencia (36) ·
ningún bundler ni framework de CSS ni un `style=` en línea (regla 4) · ningún texto de usuario
(regla 30 / A7) · `docs/equipo/00-normas-comunes.md`, que es de la Sesión 0.
**Nada ejecutado contra producción ni contra staging.**

## 🔴 Segundo hallazgo, y me lo hago a mí misma

**La aritmética de contraste ya existía y estaba exportada**: `ratio()`, en
`tests/scrum368-contraste-tokens.test.mjs`. Este apéndice entrega una **segunda implementación**
de la misma fórmula WCAG — que es exactamente el defecto que persigue el guard de SCRUM-534d, una
capa más arriba: un cálculo escrito a mano en vez de delegar en el que ya está.

**Por qué no se resuelve importándolo:** ese `ratio()` vive dentro de un fichero `.test.mjs` que
llama a `test(...)` en el cuerpo del módulo. Importarlo desde `scripts/` **ejecutaría sus tests**
como efecto de la importación — el mismo motivo por el que `meta-guard-mutaciones` lee las
declaraciones por AST en vez de importar los ficheros.

**Por qué no se arregla al revés (que 368 delegue en este módulo), que sería lo correcto:** su
`ratio()` **redondea a dos decimales** (`+(…).toFixed(2)`) y el de aquí no. Un par que hoy mide
4,497 pasa su `>= 4.5` por el redondeo y con aritmética exacta caería. Eso **no es mecánico**: es
cambiar el veredicto de un guard de otro carril. Regla 9: se mide y se reporta.

**Lo que sí queda hecho:** la fórmula de aquí vive en `scripts/_contraste-de-tokens.mjs`, o sea
**fuera de un fichero de test y por tanto importable**, que es la mitad del arreglo que sí estaba
en mi mano. Unificar las dos es un ticket, y la decisión de qué hacer con ese redondeo es del
fundador.

---

# APÉNDICE · Fase c — `--input-border` sube también, y la jerarquía deja de vivir en un comentario

*17-sep-2026 · rama `scrum-691c-el-borde-del-input`*

**Medido contra:** `origin/main` = `8c354ff3404fb2a093d14b30414bc1a8e564c46a` · 2026-09-17T10:16:40+01:00

⚠️ **ESTA RAMA VA ENCIMA DE `scrum-691b-el-token-que-no-se-ve`, que sigue sin mergear.** No se
ramificó de `main` a propósito: la jerarquía se mide contra el `--border` nuevo, y desde `main` ese
valor todavía no existe. Su compare lleva dentro las dos fases.

## ① El valor

| par | antes | ahora |
| --- | --- | --- |
| `--input-border` vs `--bg` | **1,43** | **3,86** |
| `--input-border` vs `--surface` | **1,54** | **4,15** |

🔴 **EL VALOR NO SE ELIGIÓ A OJO NI SE PUSO EN EL MÍNIMO.** Se conserva la **proporción que los dos
tokens ya tenían** antes de este ticket: 1,429 / 1,137 = **1,256**. Aplicada al `--border` nuevo
(3,037) da un objetivo de **3,82**, y `#797e77` es el primer valor que lo alcanza conservando el
matiz del original (R−5 y B−7 respecto a G). Proporción resultante: **1,27**.

No es una relación inventada: es la que el fundador ya tenía entre esos dos tokens, trasladada.

## La jerarquía declarada, y vigilada como número

> **El borde del CAMPO se ve MÁS que el de la tarjeta que lo contiene.**

De dónde sale: **de la propia hoja**, que declara ese token como *«borde de input mas visible
(legible a pleno sol)»*. No es criterio nuevo; es el que ya estaba escrito y que subir `--border`
había invertido en silencio.

🔴 **Sí se puede expresar como número, así que el guard la vigila:**
`contraste(--input-border, fondo) > contraste(--border, fondo)`, **contra los dos fondos** —
invertirse en uno solo ya es invertirse.

⚠️ **Lo que se vigila es que NO SE INVIERTA, no que la distancia sea la de hoy.** Fijar la
proporción en 1,27 convertiría en rojo cualquier ajuste legítimo de cualquiera de los dos tokens.
Lo que no puede volver a pasar es que el orden se dé la vuelta sin que nadie lo note.

## ② Las cinco cifras, y el reparto

```
población: 19 tokens de color · 4 pares vigilados · 0 POR DEBAJO de 3.00 · 0 no medibles
           · bloques de tema extra (modo oscuro): 0
```

| | antes (fase b) | ahora |
| --- | --- | --- |
| tokens de color | 19 | **19** |
| pares vigilados | 2 | **4** |
| por debajo de 3,00 | 0 | **0** |
| no medibles | 0 | **0** |
| bloques de tema extra | 0 | **0** |

### ¿A cuántos tokens le APLICA 1.4.11?

```
reparto 1.4.11: 19 tokens de color · 4 APLICA · 10 no aplica · 5 NO CLASIFICADO
                (cuentan del lado malo) · 4 pares vigilados hoy
```

**El criterio se deriva del USO en las tres hojas, no del nombre del token:** es un límite visual
quien se pinta en `border*` u `outline*`; quien sólo se usa en `color` es texto y le toca el
criterio 1.4.3 a 4,5, que ya vigila SCRUM-368; quien sólo se usa en `background*` es una
superficie, y una superficie no es un límite.

| clase | nº | cuáles |
| --- | --- | --- |
| **APLICA** | **4** | `--border` (38 usos) · `--brand` (16) · `--danger` (3) · `--input-border` (3) |
| no aplica · sólo texto | 5 | `--ink` · `--body` · `--muted` · `--danger-ink` · `--ok-ink` |
| no aplica · sólo fondo | 5 | `--bg` · `--surface` · `--brand-tint` · `--danger-bg` · `--ok-bg` |
| **NO CLASIFICADO** | **5** | `--brand-700`, `--brand-ink`, `--brand-tint-ink` (fondo **Y** texto: depende del nodo) · `--brand-bright` (sólo alimenta otra variable) · `--logo-cyan` (**0 usos**: no se pinta en ninguna hoja) |

🔴 **Los 5 NO CLASIFICADOS cuentan del lado malo.** No poder decidir no es poder aprobar.

### 🔴 Se vigilan 4 pares de 2 tokens; APLICA a 4 tokens. Los otros dos, MEDIDOS y no añadidos

`--brand` da **3,07** sobre `--bg` y **3,30** sobre `--surface`. `--danger`, **4,49** y **4,83**.
**Los dos cumplirían hoy.** No se han añadido al guard: el encargo dice `--input-border` y nada
más (regla 9), y añadirlos crea un trinquete sobre dos tokens de otro carril. **Queda ofrecido y
medido**, que es lo contrario de ampliar a ciegas.

## Dónde se ve

`--input-border` se usa en **3 sitios**: `input, select` (`public/auth.css:78`) y dos campos del
dashboard — `[data-parte-dictado] textarea` y `[data-propuesta] input[type="number"]`
(`public/dashboard/css/styles.css:3018` y `:3102`).

⚠️ **Y aquí mi `grep` se equivocó y el censo tuvo razón.** Buscar `var(--input-border)` devolvía
**una** aparición; el censo decía **tres**. Las dos que faltaban están escritas con **respaldo** —
`var(--input-border, var(--border))`— y el `grep` no las ve porque no cierra el paréntesis ahí.
Un `grep` de `var(--token)` **subcuenta siempre que alguien use la forma con respaldo**.

## Lo NO tocado

`DESIGN.md` · `docs/equipo/00-normas-comunes.md` · `prisma/schema.prisma` · cualquier otro token,
incluidos `--brand` y `--danger` que sí cumplirían · ningún estado ni flag (27) · ninguna
dependencia (36) · ningún bundler, framework de CSS ni `style=` en línea (regla 4) · ningún texto
de usuario (regla 30 / A7). **Nada ejecutado contra producción ni contra staging.**
