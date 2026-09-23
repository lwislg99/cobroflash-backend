# Dónde cabría la condición, y cuántos caracteres — ARCHIVO

**SCRUM-564**, archivado por **SCRUM-568**.

> 🔴 **LA DECISIÓN CAMBIÓ, Y ESTA MEDIDA ES LA QUE LA CAMBIÓ.** El 20-ago-2026, después de
> leerla, el fundador decidió **no documentar la condición**: los tres medios se quedan
> enunciados como están. *«Cuando hagamos el go para empezar a vender, todo será verdad. De
> momento no pasa nada.»*
>
> ⛔ **No se escribe ninguna nota.** Lo que sostiene esa decisión es el mecanismo de
> **SCRUM-568** —las afirmaciones ancladas con `tras`, cuyo veredicto cambia solo cuando los
> flags se enciendan—, no una advertencia al visitante.
>
> **Entonces ¿por qué sigue esto aquí?** Porque la medida costó dos intentos y tres trampas,
> y el día que haga falta una nota —si el go llega antes que los flags— el dato ya estará.
> **Es un archivo, no un plan: hoy no hay que hacer nada con estos números.**

> ⚠️ **SCRUM-1086 (23-sep-2026) retiró ocho de los diez textos originales** de `#como`,
> `#precios` y `#probar` (regla 24). Quedan los dos de abajo, sin tocar el mecanismo ni la
> decisión — sólo la superficie que medía se ha encogido.

> ⛔ **Aquí no hay ni una palabra de la condición.** Regla 30: el microcopy es del fundador.
> Esto mide **dónde cabría y cuánto**; la frase, si algún día hace falta, la elige él.

> ⚠️ **Generado** (`node scripts/citar-hueco-condicion.mjs`) a partir de la medición en
> navegador de `scripts/medir-hueco-condicion.mjs`. Los textos salen del censo, no de una copia.

---

## El hecho

`PAYMENTS_CONNECT_ENABLED` y `BIZUM_MANUAL_ENABLED` están **apagadas por defecto**. Para un
merchant nuevo **sólo existe la transferencia** — y estos 2 textos publicados quedan sin verificar (uno enumera medios; el detalle, abajo).

---

## ① Los 2, verificados byte a byte

Identificador **derivado** del HTML (`sección/etiqueta#orden`), texto **literal**, comparado
con `===` y `Buffer.compare` contra el censo **y** contra el fichero. Cero `includes()`.

| identificador | texto literal | ¿nombra un medio? |
|---|---|---|
| `todo/p#3` | «Tarjeta, Bizum o transferencia. Cobra trabajos completos o por adelantado, con recordatorios que persiguen solos.» | sí |
| `faq/div#3` | «Todo: presupuestos y firma, más clientes, proveedores, productos, gastos, informes y equipo. Es tu herramienta de gestión completa, no solo para cotizar.» | **no** |

### ⚠️ Control positivo — y lo que saca

El control pedía que no entrara en la lista nada que no afirme sobre medios de pago.
**1 de los 2 nombra un medio concreto** (tarjeta, Bizum o transferencia). **1 no**, y
se lee aparte, con el texto delante:

- `faq/div#3` — «Todo: presupuestos y firma, más clientes, proveedores, productos, gastos, informes y equipo. Es tu herramienta de gestión completa, no solo para cotizar.»

- 🔴 `faq/div#3` **es un veredicto mío demasiado estricto, y lo corrijo aquí.** No nombra
  ningún medio: dice que el producto incluye «cobro», y **cobro por transferencia existe hoy**.
  SCRUM-1086 ya quitó «cobro» de la enumeración; lo que queda son ocho capacidades y las ocho
  están disponibles. **No es falsa.** No la retiro del registro en este ticket porque
  reclasificarla exige declararle ancla a las ocho, que es otro trabajo.

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

### `faq/div#3`

```
Todo: presupuestos y firma, más clientes, proveedores, productos, gastos, informes y equipo. Es tu herramienta de gestión completa, no solo para cotizar.
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
| ✅ admite nota junto a la afirmación | **2** |
| 🔴 sólo al pie de la sección | **0** |
| 🔴 no admite nota en ningún sitio | **0** |

🔴 **«Sólo al pie de la sección» cuenta como que NO admite condición.** Una nota a cuarenta
líneas de la afirmación que condiciona no documenta nada: el cliente lee la promesa y decide
antes de llegar. Si un texto sólo admite eso, **la única salida que le queda es cambiar el
texto, y eso es del fundador.**

Ninguno hoy: los 2 que quedan admiten nota junto al texto (tabla del punto ②).

---

## ④ El mecanismo · lo que aporta y lo que le falta a cada uno

⛔ **El mecanismo lo propongo yo; el texto lo escribe el fundador.**

| mecanismo | aporta | le falta |
|---|---|---|
| `<small>` **inline, junto al texto** | se lee con la afirmación delante, sin saltos | el hueco más pequeño de los tres |
| **nota al pie del bloque** (`<p>`/`<li>` que la contiene) | más caracteres, y sigue pegada a la afirmación | **empuja**: «sin mover» suele ser 0, así que la sección crece |
| **marca (`*`) + nota única al pie de la sección** | cabe en todos los casos medidos | el cliente decide **antes** de llegar a la nota; documenta para quien ya dudaba |
| `aria-describedby` | lo anuncia el lector de pantalla sin ocupar sitio | **no lo ve quien mira**, y esta condición es comercial, no de accesibilidad. Complemento, nunca la salida |

**El dato que faltaba para elegir la frase**, por si se lee sólo esta línea: junto al texto
caben entre **11 y 52** caracteres según el sitio; al pie del bloque, entre
**44 y 121**; al pie de la sección, entre **51 y 173**.

---

## ⑤ Lo que no se ha tocado

- Este archivo no escribe ninguna nota: mide, no corrige (regla 30, arriba).
- Ningún flag, ningún medio de pago. Reglas 18 y 23.
- ⚠️ El «0 robos» de táctiles y los «30 sitios × 2 anchos» medidos el 21-ago-2026 eran sobre
  los diez originales, ocho de ellos en `#como`/`#precios`/`#probar` — retirados por
  SCRUM-1086. Sobre los dos que quedan no hay una medida de táctiles nueva: ninguno de los
  dos es un elemento pulsable.

