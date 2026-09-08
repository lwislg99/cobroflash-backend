# SCRUM-739 · Informes deja de escribir el dinero por su cuenta

**Fecha:** 4-sep-2026 · **Carril:** dinero / presentación · **Gate:** todo en `npm test`; sin BD

**Medido contra:** `origin/main` = `8dec48e44333c0cdfdbaed61c7f6c17c32244c41` · 2026-09-04T20:45:00Z

**Tanda:** 5309 tests, 5220 pass, **1 fail**, 88 skipped — corrida DESPUES del ultimo cambio,
entrada incluida. El fallo **no es de este ticket**: es `SCRUM-176b`, que construye una ruta con
`new URL(import.meta.url).pathname` y da rojo en cualquier checkout cuya ruta lleve un espacio,
verde en CI. Sigue sin arreglar en `main`; S5 lo tiene en su carril.

---

## La víctima

El profesional abre **Informes** y ve `6050,00` donde el resto de su producto —el PDF, la factura,
el albarán, el portal del cliente— escribe `6.050,00`. Y el tramo en el que falla no es cualquiera:
**1.000 a 9.999 €, que es el importe corriente de un trabajo.** Por debajo de 1.000 y por encima de
10.000 coincide, y **eso es lo que lo hacía invisible**.

---

## PASO 0

### ENTRADA

`public/dashboard/js/reportsView.js` — la pantalla de Informes. **Cinco** sitios de dinero:

| línea | qué es |
|---|---|
| `:157` | el `fmt` de la tabla de meses y de los KPI |
| `:294` | el `fmt` del IVA por trimestre |
| `:644` | la celda «cobrado» de la tabla de embudo |
| `:734` | el `fmt` de la tabla de servicios |
| `:849` | el tooltip del gráfico de barras |

### MECANISMO — 🔴 existía, y ESO cambia el ticket

| pieza | dónde | qué hace |
|---|---|---|
| `formatMoneyEs` / `fmtMoneyEs` | backend y front | el importe **con símbolo** |
| **`formatImporteEs`** | **sólo backend** | el importe **SIN símbolo** — SCRUM-636 |
| `fmtMoneyEsOAusente` | front | la variante del «—» del libro (SCRUM-436) |

**El front tenía el «con símbolo» y NO tenía el «sin símbolo».** Ésa es la razón medida de que
Informes se escribiera el suyo: **necesitaba un número sin `€`** —el símbolo va en un `<span>` más
pequeño en el KPI, y en la cabecera de la columna en las tablas— **y no había ninguno al que
llamar**. No fue descuido: fue un hueco.

Así que esto **no es escribir un sexto formateador**: es traer al front la variante que el backend
ya tenía, y cablear los cinco sitios.

---

## Lo que se construye

### `fmtImporteEs` en `api.js` — y por qué no puede divergir

Las opciones salen de dentro de `fmtMoneyEs` a una función propia, `opcionesDeDinero(currency)`, y
**las dos la comparten**. `fmtImporteEs` no reformatea: le pide al **mismo** formateador que
descomponga su salida (`formatToParts`) y le quita la pieza `currency`.

> No es que estén escritas iguales: **es que son la misma llamada.**

El backend deja escrito el aviso que esto convierte en imposible: *«comparte cuerpo con
`formatMoneyEs` a propósito —mismo `Intl`, mismas opciones— salvo `style`. Si divergieran, el
símbolo dejaría de ser lo único que las separa.»* Un aviso es una promesa; compartir el objeto es
una garantía.

⚠️ El recorte del espacio se hace **a los dos lados**: en `es-ES` el símbolo va detrás con espacio
duro, pero en otras plazas va delante, y este código no tiene por qué saber en cuál está.

### Los cinco sitios

Dos de ellos (`loadVat`, `renderServices`) **no tienen `currency` en alcance**. Se omite, y está
medido que no pierde nada: con `min` y `max` de decimales fijados a 2, **EUR, MXN, USD, JPY y CLP
dan exactamente el mismo importe sin símbolo**. Hay un test que lo ata.

### 🔴 El sexto sitio NO entra, y va declarado

`reportsView.js:845` — el **rótulo del eje** del gráfico: `Math.round(maxVal * f).toLocaleString('es-ES')`.

Es un **entero sin decimales**, y `fmtImporteEs` fuerza dos. Pasarlo por el sitio único cambiaría
`6050` por `6.050,00` en un eje: **añadiría decimales donde hoy no los hay**, que es cambiar lo que
se ve, no cómo se escribe. Tiene el mismo defecto de agrupación (`6050` debería ser `6.050`) pero
necesita una **tercera** forma —agrupar sin forzar decimales— y eso es otro ticket. Queda como
hallazgo, y el test fija que **quede exactamente UNO**: si aparece un segundo `toLocaleString`, cae.

---

## La trampa de este ticket, ejercitada y no prometida

> «EL ROJO TIENE QUE USAR UN IMPORTE DE CUATRO CIFRAS ENTERAS. Si el test usa 117,60 o 12.345,67 no
> prueba NADA: esos dos ya coinciden hoy.»

El test **lleva dentro la implementación vieja** (`COMO_ESTABA`) y comprueba las dos mitades:

- que `COMO_ESTABA(6050) === '6050,00'` — **si esto dejara de reproducir el defecto, no habría
  ticket**, y el verde de al lado no significaría nada;
- que la vieja y la nueva **difieren** con 6.050;
- y, en el control negativo, que con `0`, `0,5`, `117,60`, `999,99`, `12.345,67` y `100.000`
  **no cambia ni un carácter**. Esos seis están ahí para lo contrario de lo que parece: para dejar
  fijado que no se han movido, y para dejar escrito por qué no valen como prueba del arreglo.

Además se barre **toda la banda** (1.000 → 9.999 de 37 en 37, 244 valores) exigiendo el patrón
`d.ddd,dd`, con suelo: menos de 200 valores comprobados falla.

**Y la cifra no se mueve.** Se deshace el formato y se compara con el valor de partida: es el
límite que puso el encargo —«si cambia alguna cifra, PARA»— comprobado, no respetado de palabra.

---

## Mutación · seis defectos, seis cazados

Post-condición en cada uno: cambió el fichero que dice y el otro quedó intacto. No hay `dist/` que
vigilar: todo es JS del navegador, que se carga tal cual.

| # | defecto inyectado | quién lo caza |
|---|---|---|
| ① | la variante vuelve al `toLocaleString` a pelo | 5 tests |
| ② | se cae el `useGrouping: 'always'` de la variante | 4 tests |
| ③ | …el del **con símbolo** (las diez vistas que lo usan) | 2 tests |
| ④ | la variante se escribe sus propias opciones | el test de las opciones compartidas |
| ⑤ | un sitio de Informes vuelve a formatear por su cuenta | el censo de la vista |
| ⑥ | la variante **redondea** distinto (cambiar la cifra) | 6 tests |

Control negativo: sin mutar, cero rojos. Tras restaurar, cero rojos y las huellas vuelven.

---

## El CR, y por qué esto sale en la entrada

`reportsView.js` llegaba con **1.022 CR en disco** (`text=set eol=lf` — el CASO B de SCRUM-570: el
blob es LF y el disco CRLF). Escribir en él lo mete en la población del guard de SCRUM-533, que los
quiere a **cero** — y el guard cayó, con razón.

Limpiado con `npm run cr:limpiar`. **El diff de git es el MISMO antes y después: 32 / 5.** Quitar
1.022 CR no movió una línea en el repositorio, porque el blob ya era LF. Es exactamente la
distinción que documenta SCRUM-570 y que aquí se pagó de verdad.

---

## Microcopy

**Ninguna.** Este ticket no estrena ni un texto: cambia cómo se escribe un número que ya se
escribía. No se ha pintado ningún marcador y el censo de SCRUM-402 no se mueve.

---

## Tests

- `tests/scrum739-informes-al-sitio-unico.test.mjs` — los 12. Las funciones del front se cargan del
  `api.js` **de verdad**, con el banco de vistas (`cargarDashboard`), no recortando el fuente.

---

## Huecos declarados · lo que NO verifiqué

- **No he abierto la pantalla de Informes en un navegador.** Se comprueba la función y que la vista
  la llama, no el píxel: si un `<span>` del `€` quedara mal colocado, esto seguiría verde.
- **No he medido las otras diez vistas que usan `fmtMoneyEs`** una a una; lo que se comprueba es
  que su salida no ha cambiado respecto al backend en toda la banda y fuera de ella.
- **El rótulo del eje sigue sin agrupar** (`6050` en vez de `6.050`): declarado arriba, no
  arreglado.
- **No he corrido `npm run guards:visuales`**: miden la landing, que no comparte estos ficheros,
  pero **no lo he ejecutado**.

---

## Hallazgos fuera de carril

- **Tres sitios convierten el punto en coma a mano** en vez de pasar por el sitio único:
  `exports.routes.ts`, `exportData.ts` y `fiscal/evidencias/paquete.ts`. **Anotado y fuera**, como
  pidió el encargo.
- **`fmtQty` del PDF del albarán** (`albaranPdf.service.ts:132`) tiene la misma falta de agrupación,
  pero en **cantidades**: 1.500 unidades se imprimen `1500`. **VA APARTE, y el motivo no es de
  reparto sino de daño**: el sitio único fuerza dos decimales, así que pasar por él convertiría una
  cantidad de `1,5` en `1,50` — cambiaría lo impreso en un documento firmado, que es justo lo que el
  encargo prohíbe. Necesita su propia variante «agrupar sin forzar decimales», la misma que pide el
  rótulo del eje.
