# Dónde cabe la condición, y cuántos caracteres

**SCRUM-564.** El fundador decidió el 20-ago-2026 **documentar la condición** en vez de
retirar el copy: los diez textos se quedan como están y se les añade lo que hoy falta.

> ⛔ **Aquí no hay ni una palabra de la condición.** Regla 30: el microcopy es del fundador.
> Esto mide **dónde va y cuánto cabe**; la frase la elige él.

> ⚠️ **Generado** (`node scripts/citar-hueco-condicion.mjs`) a partir de la medición en
> navegador de `scripts/medir-hueco-condicion.mjs`. Los textos salen del censo, no de una copia.

---

## El hecho

`PAYMENTS_CONNECT_ENABLED` y `BIZUM_MANUAL_ENABLED` están **apagadas por defecto**. Para un
merchant nuevo **sólo existe la transferencia** — y estos diez textos publicados enumeran tres.

---

## ① Los diez, verificados byte a byte

Identificador **derivado** del HTML (`sección/etiqueta#orden`), texto **literal**, comparado
con `===` y `Buffer.compare` contra el censo **y** contra el fichero. Cero `includes()`.

| identificador | texto literal | ¿nombra un medio? |
|---|---|---|
| `como/p#4` | «Tarjeta, Bizum o transferencia — él elige, tú cobras. Los pendientes se reclaman solos.» | sí |
| `todo/p#3` | «Tarjeta, Bizum o transferencia. Cobra trabajos completos o por adelantado, con recordatorios que persiguen solos.» | sí |
| `precios/li#3` | «Cobro con tarjeta, Bizum y transferencia» | sí |
| `precios/p#2` | «Solo si cobras con tarjeta:» | sí |
| `precios/p#4` | «Bizum y transferencia:» | sí |
| `probar/span#15` | «Paga como quiera» | **no** |
| `probar/span#16` | «Tarjeta, Bizum o transferencia.» | sí |
| `probar/span#42` | «Tarjeta» | sí |
| `probar/span#44` | «Bizum» | sí |
| `faq/div#3` | «Todo: presupuestos, firma y cobro, más clientes, proveedores, productos, gastos, informes y equipo. Es tu herramienta de gestión completa, no solo para cotizar.» | **no** |

### ⚠️ Control positivo — y lo que saca

El control pedía que no entrara en la lista nada que no afirme sobre medios de pago.
**Ocho de los diez nombran un medio concreto** (tarjeta, Bizum o transferencia). **2 no**, y
los dos merecen una lectura distinta, con el texto delante:

- `probar/span#15` — «Paga como quiera»
- `faq/div#3` — «Todo: presupuestos, firma y cobro, más clientes, proveedores, productos, gastos, informes y equipo. Es tu herramienta de gestión completa, no solo para cotizar.»

- `probar/span#15` **sí pertenece**: «Paga como quiera» es el rótulo del paso 5 de la demo y
  la línea siguiente (`probar/span#16`) enumera los tres medios. La promesa de elección es
  suya, aunque los medios los nombre su vecina.
- 🔴 `faq/div#3` **es un veredicto mío demasiado estricto, y lo corrijo aquí.** No nombra
  ningún medio: dice que el producto incluye «cobro», y **cobro por transferencia existe hoy**.
  Enumera nueve capacidades y las nueve están disponibles. **No es falsa.** No la retiro del
  registro en este ticket porque reclasificarla exige declararle ancla a las nueve, que es
  otro trabajo — pero el fundador debe saber que de los diez, **nueve son el caso y una es mía**.

---

## ② Dónde cabe · medido en navegador, a 360 y a 1280 px

| | |
|---|---|
| fecha | 2026-08-21 |
| navegador | Edge headless vía puppeteer-core |
| anchos | 360, 1280 |
| sonda | <small> a 13 px; `display:block` en los sitios de bloque |
| relleno | el PROPIO texto de la unidad, repetido — así «caben N caracteres» son N caracteres de prosa como la que ya está ahí, con su misma métrica, y no de una tira de equis |
| detalles | los <details> del FAQ se abren antes de medir (3 de 4 nacen cerrados): con el desplegable cerrado la sonda no tiene caja y el número saldría inventado |
| arbitroDeToque | SCRUM-562: `closest`, y DESDE EL CENTRO. Nunca `elementsFromPoint().includes()` |

**Qué es cada número:**

- **1 línea** — caracteres que caben en una línea a la anchura de ese hueco.
- **sin mover** — caracteres que caben **sin que la sección cambie de alto**. Por encima de
  ese número, la nota empuja lo que hay debajo. Un `0` significa que cualquier nota empuja.
- **se ve** — la sonda tiene caja y el navegador la devuelve al preguntar por su centro. Un
  `NO` significa **ahí no cabe nada**, aunque los otros números digan otra cosa.

### `como/p#4`

```
Tarjeta, Bizum o transferencia — él elige, tú cobras. Los pendientes se reclaman solos.
```

| sitio | host | ancho 360 | ancho 1280 | veredicto |
|---|---|---|---|---|
| junto al texto | `p` | 39 car. · sin mover 39 | 43 car. · sin mover 43 | CABE UNA NOTA |
| pie del bloque | `div.prod.reveal.on.in` | 46 car. · sin mover 0 | 49 car. · sin mover 49 | CABE UNA NOTA |
| pie de la seccion | `div.wrap` | 52 car. · sin mover 0 | 176 car. · sin mover 0 | CABE UNA NOTA |

- umbral para «cabe una frase»: **26** caracteres (el doble de la palabra más larga del propio texto: 
  la más larga de este texto tiene 13).
- **ADMITE NOTA JUNTO A LA AFIRMACION**

### `todo/p#3`

```
Tarjeta, Bizum o transferencia. Cobra trabajos completos o por adelantado, con recordatorios que persiguen solos.
```

| sitio | host | ancho 360 | ancho 1280 | veredicto |
|---|---|---|---|---|
| junto al texto | `p` | 38 car. · sin mover 2 | 11 car. · sin mover 11 | SOLO UN GUINO, NO UNA FRASE |
| pie del bloque | `div.prod.reveal.on.in` | 44 car. · sin mover 0 | 48 car. · sin mover 0 | CABE UNA NOTA |
| pie de la seccion | `div.wrap` | 🔴 no se ve | 173 car. · sin mover 0 | NO CABE NADA |

- umbral para «cabe una frase»: **26** caracteres (el doble de la palabra más larga del propio texto: 
  la más larga de este texto tiene 13).
- **ADMITE NOTA JUNTO A LA AFIRMACION**

### `precios/li#3`

```
Cobro con tarjeta, Bizum y transferencia
```

| sitio | host | ancho 360 | ancho 1280 | veredicto |
|---|---|---|---|---|
| junto al texto | `li` | 21 car. · sin mover 21 | 6 car. · sin mover 6 | SOLO UN GUINO, NO UNA FRASE |
| pie del bloque | `li` | 36 car. · sin mover 0 | 52 car. · sin mover 0 | CABE UNA NOTA |
| pie de la seccion | `div.wrap` | 51 car. · sin mover 0 | 174 car. · sin mover 0 | CABE UNA NOTA |

- umbral para «cabe una frase»: **26** caracteres (el doble de la palabra más larga del propio texto: 
  la más larga de este texto tiene 13).
- **ADMITE NOTA JUNTO A LA AFIRMACION**

### `precios/p#2`

```
Solo si cobras con tarjeta:
```

| sitio | host | ancho 360 | ancho 1280 | veredicto |
|---|---|---|---|---|
| junto al texto | `p.fee-note` | 10 car. · sin mover 10 | 28 car. · sin mover 28 | SOLO UN GUINO, NO UNA FRASE |
| pie del bloque | `p.fee-note` | 38 car. · sin mover 0 | 56 car. · sin mover 0 | CABE UNA NOTA |
| pie de la seccion | `div.wrap` | 53 car. · sin mover 0 | 183 car. · sin mover 0 | CABE UNA NOTA |

- umbral para «cabe una frase»: **14** caracteres (el doble de la palabra más larga del propio texto: 
  la más larga de este texto tiene 7).
- **ADMITE NOTA JUNTO A LA AFIRMACION**

### `precios/p#4`

```
Bizum y transferencia:
```

| sitio | host | ancho 360 | ancho 1280 | veredicto |
|---|---|---|---|---|
| junto al texto | `p.fee-note` | 10 car. · sin mover 10 | 26 car. · sin mover 26 | SOLO UN GUINO, NO UNA FRASE |
| pie del bloque | `p.fee-note` | 36 car. · sin mover 0 | 54 car. · sin mover 0 | CABE UNA NOTA |
| pie de la seccion | `div.wrap` | 50 car. · sin mover 0 | 175 car. · sin mover 0 | CABE UNA NOTA |

- umbral para «cabe una frase»: **26** caracteres (el doble de la palabra más larga del propio texto: 
  la más larga de este texto tiene 13).
- **ADMITE NOTA JUNTO A LA AFIRMACION**

### `probar/span#15`

```
Paga como quiera
```

| sitio | host | ancho 360 | ancho 1280 | veredicto |
|---|---|---|---|---|
| junto al texto | `span.tt` | 13 car. · sin mover 13 | 42 car. · sin mover 277 | CABE UNA NOTA |
| pie del bloque | `div.try-step` | 5 car. · sin mover 3 | 34 car. · sin mover 320 | SOLO UN GUINO, NO UNA FRASE |
| pie de la seccion | `div.wrap` | 45 car. · sin mover 0 | 159 car. · sin mover 0 | CABE UNA NOTA |

- umbral para «cabe una frase»: **12** caracteres (el doble de la palabra más larga del propio texto: 
  la más larga de este texto tiene 6).
- **ADMITE NOTA JUNTO A LA AFIRMACION**

### `probar/span#16`

```
Tarjeta, Bizum o transferencia.
```

| sitio | host | ancho 360 | ancho 1280 | veredicto |
|---|---|---|---|---|
| junto al texto | `span.ts` | 23 car. · sin mover 7 | 41 car. · sin mover 312 | SOLO UN GUINO, NO UNA FRASE |
| pie del bloque | `div.try-step` | 9 car. · sin mover 4 | 39 car. · sin mover 375 | SOLO UN GUINO, NO UNA FRASE |
| pie de la seccion | `div.wrap` | 52 car. · sin mover 0 | 180 car. · sin mover 0 | CABE UNA NOTA |

- umbral para «cabe una frase»: **26** caracteres (el doble de la palabra más larga del propio texto: 
  la más larga de este texto tiene 13).
- **SOLO AL PIE DE LA SECCION**

### `probar/span#42`

```
Tarjeta
```

| sitio | host | ancho 360 | ancho 1280 | veredicto |
|---|---|---|---|---|
| junto al texto | `span.pt` | 🔴 no se ve | 🔴 no se ve | NO CABE NADA |
| pie del bloque | `span` | 🔴 no se ve | 🔴 no se ve | NO CABE NADA |
| pie de la seccion | `div.wrap` | 54 car. · sin mover 0 | 187 car. · sin mover 0 | CABE UNA NOTA |

- umbral para «cabe una frase»: **14** caracteres (el doble de la palabra más larga del propio texto: 
  la más larga de este texto tiene 7).
- **SOLO AL PIE DE LA SECCION**

### `probar/span#44`

```
Bizum
```

| sitio | host | ancho 360 | ancho 1280 | veredicto |
|---|---|---|---|---|
| junto al texto | `span.pt` | 🔴 no se ve | 🔴 no se ve | NO CABE NADA |
| pie del bloque | `span` | 🔴 no se ve | 🔴 no se ve | NO CABE NADA |
| pie de la seccion | `div.wrap` | 45 car. · sin mover 0 | 154 car. · sin mover 0 | CABE UNA NOTA |

- umbral para «cabe una frase»: **10** caracteres (el doble de la palabra más larga del propio texto: 
  la más larga de este texto tiene 5).
- **SOLO AL PIE DE LA SECCION**

### `faq/div#3`

```
Todo: presupuestos, firma y cobro, más clientes, proveedores, productos, gastos, informes y equipo. Es tu herramienta de gestión completa, no solo para cotizar.
```

| sitio | host | ancho 360 | ancho 1280 | veredicto |
|---|---|---|---|---|
| junto al texto | `div.a` | 24 car. · sin mover 24 | 52 car. · sin mover 52 | CABE UNA NOTA |
| pie del bloque | `details` | 50 car. · sin mover 0 | 121 car. · sin mover 0 | CABE UNA NOTA |
| pie de la seccion | `div.wrap` | 51 car. · sin mover 0 | 172 car. · sin mover 0 | CABE UNA NOTA |

- umbral para «cabe una frase»: **24** caracteres (el doble de la palabra más larga del propio texto: 
  la más larga de este texto tiene 12).
- **ADMITE NOTA JUNTO A LA AFIRMACION**

---

## ③ Los que vuelven al fundador

| grupo | cuántos |
|---|---|
| ✅ admite nota junto a la afirmación | **7** |
| 🔴 sólo al pie de la sección | **3** |
| 🔴 no admite nota en ningún sitio | **0** |

🔴 **«Sólo al pie de la sección» cuenta como que NO admite condición.** Una nota a cuarenta
líneas de la afirmación que condiciona no documenta nada: el cliente lee la promesa y decide
antes de llegar. Si un texto sólo admite eso, **la única salida que le queda es cambiar el
texto, y eso es del fundador.**

- `probar/span#16` — «Tarjeta, Bizum o transferencia.» · junto al texto: 23 car. · pie del bloque: 9 car.
- `probar/span#42` — «Tarjeta» · junto al texto: la sonda no llega a verse en 360 y 1280 px · pie del bloque: la sonda no llega a verse en 360 y 1280 px
- `probar/span#44` — «Bizum» · junto al texto: la sonda no llega a verse en 360 y 1280 px · pie del bloque: la sonda no llega a verse en 360 y 1280 px

Los tres están en **`#probar`**, la maqueta de la demo: cajas de tamaño fijo donde el texto
no fluye como prosa. ⚠️ Y por eso sus números de «sin mover» a 1280 salen altísimos (277, 312,
320, 375): el contenedor se traga el texto sin cambiar de alto. **Esos números no significan
«cabe»** — significan que la caja es rígida. El dato bueno ahí es el de «1 línea».

### 🔴 El caso difícil: `precios/li#3`

«Cobro con tarjeta, Bizum y transferencia», **dentro de la lista de lo que incluye el plan, al
lado del precio**. Medido:

- **junto al texto** — 360: 21 car. · 1280: 6 car.
- **pie del bloque** — 360: 36 car. · 1280: 52 car.
- **pie de la seccion** — 360: 51 car. · 1280: 174 car.

**Junto al texto no cabe: seis caracteres a 1280.** La lista de precios reparte el ancho, y a
1280 la fila está casi llena. Lo único que entra ahí es una **marca** (un asterisco), no una
condición.

El hueco de verdad es **una segunda línea dentro del propio `<li>`**: 36 caracteres a 360 y 52
a 1280. Cabe — pero **empuja** (sin mover: 0), así que la caja de precio crece.

⚠️ **Y esto hay que decirlo aunque no sea una medida:** una fila de la tabla de precios es
donde el cliente decide, y es donde peor entra un asterisco. **Que quepa no significa que
convenga.** La medida dice cuánto entra; si entra ahí o se cambia la fila, es del fundador.

---

## ④ El mecanismo · lo que aporta y lo que le falta a cada uno

⛔ **El mecanismo lo propongo yo; el texto lo escribe el fundador.**

| mecanismo | aporta | le falta |
|---|---|---|
| `<small>` **inline, junto al texto** | se lee con la afirmación delante, sin saltos | el hueco más pequeño de los tres; en `precios/li#3` son 6 car. a 1280, y en `#probar` no se ve |
| **nota al pie del bloque** (`<p>` dentro de la tarjeta / el `<li>`) | 36–56 car., y sigue pegada a la afirmación | **empuja**: «sin mover» es 0 en casi todos, así que la sección crece |
| **marca (`*`) + nota única al pie de la sección** | cabe en los diez, incluidos los tres de `#probar` (45–187 car.) | el cliente decide **antes** de llegar a la nota; documenta para quien ya dudaba |
| `aria-describedby` | lo anuncia el lector de pantalla sin ocupar sitio | **no lo ve quien mira**, y esta condición es comercial, no de accesibilidad. Complemento, nunca la salida |

**El dato que faltaba para elegir la frase**, por si se lee sólo esta línea: junto al texto
caben entre **6 y 43** caracteres según el sitio; al pie del bloque, entre **36 y 56**; al pie
de la sección, entre **45 y 187**.

---

## ⑤ Lo que no se ha tocado

- Ninguno de los diez textos. Ni una palabra.
- Ningún flag, ningún medio de pago. Reglas 18 y 23.
- **Ningún táctil pierde su área** por culpa de la nota: medido en los 30 sitios × 2 anchos
  con el árbitro de SCRUM-562 (`closest`, desde el centro), **0 robos**.
- ⚠️ En `#probar` había **4 táctiles que ya no reciben el toque en su centro antes de tocar
  nada**: son los botones de la maqueta con `visibility:hidden`, que SCRUM-542 ya declaró como
  «presentes pero no tocables». **No los causa la nota.**

