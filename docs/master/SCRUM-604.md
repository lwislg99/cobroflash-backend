# SCRUM-604 · DOC-14 · El desglose del PDF: ya existe en la factura, y le faltan dos cosas

**Medido contra:** `origin/main` = `b8ea7364133904671f881d687ff1673f97050379` · 2026-08-25T01:30:00+01:00

> ⚠️ El ancla es el commit contra el que se MIDIÓ —la base de esta rama, merge del PR #864
> (SCRUM-619)—, no la punta de `origin/main` de ahora. Esa hora es la del trabajo de esta rama,
> no una lectura de reloj — criterio R14.

**Alcance:** MIDE y CARACTERIZA. No cambia ni una cifra ni un rótulo de ningún documento.
Entrega además un **instrumento que la casa no tenía**: leer el TEXTO de un PDF.

---

## 🛑 PARA Y DILO ① · La premisa del encargo es falsa, y lo es en la dirección buena

El encargo dice *«esto es pintar en el PDF lo que ya sabes que el sistema calcula»*. **Ya está
pintado.** El PDF de **FACTURA** imprime las tres líneas desde el bloque «4. TOTALES» de
`pdf.service.ts`. Medido leyendo el documento generado:

```
Base imponible:60,00 EUR   IVA 21%:12,60 EUR   TOTAL:72,60 EUR
```

El ticket de Jira declara **dos veces** «no se ha abierto el repositorio», y su evidencia es
`Total presupuesto: 1210 EUR` en el **PDF de presupuesto #32**. Abierto el repositorio y medido
con el mismo caso de SCRUM-619, el PDF de **PRESUPUESTO** dice:

```
Total presupuesto: 117.60 EUR
```

Sin base imponible y sin cuota. **El hueco de DOC-14 está en el presupuesto, no en la factura** —
que es exactamente lo que decía la evidencia del ticket. El encargo lo asignó a la factura.

*(La nota del bloque G del documento de origen dice que los tickets «aplican a los dos
documentos», así que el presupuesto entra en el alcance del ticket aunque no en el del encargo.
No se ha construido: se declara, porque el encargo dice «no lo reinterpretes ni lo completes con
criterio propio».)*

De regalo, una diferencia entre los dos documentos que nadie ha decidido: la factura formatea
`117,60` (coma) y el presupuesto `117.60` (punto).

---

## 🛑 PARA Y DILO ② · La decisión que asumiste es falsa: las dos hipótesis del suplido SÍ cambian la FORMA

El encargo dice, asumiéndolo explícitamente:

> «Si mañana la respuesta cambia, lo que cambia es el CÁLCULO […] no la forma del desglose. Base
> imponible, cuota e importe total siguen siendo las mismas tres líneas.»

**Medido: no.** El motor que implementa la hipótesis alternativa ya está escrito
(`suplidos.ts`, `desgloseConSuplidos`) y **devuelve un campo que hoy no tiene fila**:

```ts
base: number;      // base imponible SIN suplidos
cuota: number;
entries: VatRateEntry[];
suplidos: number;  // ← «Fuera de la base, dentro del total»
total: number;
```

O sea:

| | hoy (dentro de la base) | alternativa (fuera de la base) |
|---|---|---|
| filas del bloque | Base imponible · IVA 21% · **TOTAL** | Base imponible · IVA 21% · **suplidos** · TOTAL |
| nº de conceptos | **3** | **4** |

**Es una fila nueva, no una cifra distinta.** Y una fila nueva necesita una **etiqueta**, que es
microcopy del fundador (regla 30) y que **no existe** — así que la hipótesis alternativa no se
puede ni maquetar sin que él escriba antes ese texto.

Se dice porque el encargo lo pidió: *«prefiero enterarme por ti que por el fundador»*.

---

## Los dos defectos del bloque que SÍ existe

### ① La base al 0 % no se imprime

`pdf.service.ts` salta la fila cuando la cuota es cero (`if (g.vat === 0) return;`). Con el caso
de SCRUM-619 —60,00 al 21 % más 45,00 de suplido al 0 %— el documento imprime:

```
Base imponible:105,00 EUR   IVA 21%:12,60 EUR   TOTAL:117,60 EUR
```

**El total cuadra** (105 + 12,60 = 117,60): no es un error de dinero. Lo que falla es que el
desglose **no deja reconstruir qué parte de la base lleva qué tipo** — quien lo lea ve 105,00 de
base y 12,60 de IVA al 21 %, y 105 × 21 % son 22,05. Los 45,00 al 0 % no salen en el bloque de
totales por ningún lado (sí en la tabla de líneas, donde deben estar).

Dicho como propiedad y no como cifra —que es lo que sobrevive a un cambio de importes—:
**una factura con DOS bases imprime el mismo número de filas de IVA que una con UNA.**

Y es el caso que el producto vende como ventaja frente a Holded (F8). En una factura el desglose
es contenido obligatorio, no decoración: eso lo dice el propio ticket.

### ② El total impreso se recalcula e ignora el guardado

Habiendo líneas, el PDF ignora `params.total` y pinta su propia suma. **Medido:** con
`total: '999.99'` y unas líneas que suman 122,10, el documento imprime **122,10**.

Si alguna vez el total almacenado —el que se **sella**— y esta suma se separasen, el papel diría
una cosa y el registro otra, **y el papel no avisa**. Hay una rama donde sí manda el guardado: la
del `else`, para facturas antiguas sin líneas copiadas (imprime `Total: 318,45 EUR`). Se
caracteriza también, porque hace falsa cualquier afirmación general de «el PDF nunca usa el total
guardado».

**Ninguno de los dos se arregla aquí.** Cambiar lo que imprime un documento fiscal es tocar el
camino de emisión (reglas 29/38) y necesita GO. Este ticket sólo **lee**, que es lo que la regla
38 permite sin pedirlo.

---

## El instrumento: leer lo que el PDF IMPRIME

Hasta hoy la suite comprobaba los PDF **por tamaño en bytes**: `pdfs.test.mjs` afirma que el
watermark está porque *«el fichero con watermark pesa más que el fichero sin él»*. Eso distingue
«hay algo más» de «no hay nada más» y **no distingue nada sobre lo que el documento dice**: un
desglose con la cuota equivocada pesa exactamente igual que uno correcto.

`tests/_texto-del-pdf.mjs` lee el texto, con `zlib` y **sin dependencias nuevas** (regla 36).

**Lleva dos suelos, porque el supuesto que lo hace posible puede caducar.** Hoy los tipos son los
estándar (`/Helvetica`, `/WinAnsiEncoding`, **sin `/ToUnicode`**) y el texto viaja en cadenas
hexadecimales dentro de arrays `TJ`. Si algún día se embebe un tipo propio, los bytes pasarían a
ser códigos de glifo: entonces **se declara CIEGO** en vez de devolver vacío — que se leería como
«el documento no dice eso».

Ese suelo ya trabajó: la primera versión buscaba literales `(…)` entre paréntesis —lo que uno
escribe primero— y encontraba **cero**. Sin el suelo, ese cero habría pasado por «el PDF no
imprime el desglose», que es justo la conclusión falsa que este ticket venía a evitar.

---

## Verificación

**Commit de partida:** `32c8443206e0f2a01b96710dbc73eae82881d2e4`. Inyecciones sobre
`pdf.service.ts` (701 CR en disco → el blob no serviría) guardando los **bytes de disco** y
revirtiendo con `Buffer.compare`. Árbol limpio tras cada una.

| control | rotura inyectada | resultado |
|---|---|---|
| 🔴 ROJO-1 | cuota mal sumada (`base * t * 1.1`) | **fail=4** |
| 🔴 ROJO-2 | base que no cuadra con sus líneas (`base * 2`) | **fail=4** |
| 🔴 ROJO-3 | el total no suma base + cuota (`+ 1`) | **fail=4** |
| ✅ POSITIVO | — | con el cálculo intacto, los 6 en verde |

Los tres rojos **nombran las cifras concretas** (12,60 · 60,00 · 72,60 · 105,00 · 117,60 ·
122,10), y el caso con **suplido** está entre los que caen.

### 🔴 Dos defectos de mi propio test, cazados antes de entregarlo

1. **Una afirmación falsa.** Escribí que los 45,00 del suplido «no aparecen por ningún lado», y
   su propio test la tumbó: **sí aparecen**, en la tabla de líneas, que es donde deben estar. La
   afirmación ancha era falsa; la estrecha —no están en el **bloque de totales**— es la que
   importa y es la que quedó.
2. **Verificaba con `includes()`, que está prohibido.** Y no era sólo la regla: al romper el
   cálculo, el test caía **sin decir qué imprime ahora** — sólo que la cadena esperada no estaba.
   Ahora compara el bloque **entero** con `===`, así que el fallo enseña las dos versiones y el
   defecto se lee solo. Los rojos de arriba están medidos **después** de ese cambio.

---

## Huecos declarados

* **P-DOC-2 (pregunta abierta del ticket): ¿la landing del cliente muestra el desglose?**
  Medido con su límite: `src/modules/quotes/app/routes/quotes.routes.ts` —la ruta que sirve
  `/pay/quote/:token`— **no contiene «Base imponible» ni agrupación por tipo de IVA**, y las
  páginas de pago (`payBizum`, `payBank`) tampoco. **Límite:** se ha medido por el contenido de
  esas rutas, no renderizando la página en un navegador; si el desglose se montara en un
  fragmento que no he mirado, esta medición no lo vería. Con ese límite: **la landing tampoco lo
  muestra**, así que la nota del ticket —«si la landing tampoco lo muestra, DOC-14 es más grande
  de lo que parece»— se cumple.
* **El PDF de presupuesto** no se ha tocado. Es donde está el hueco real de DOC-14 y necesita
  decisión: entra en el ticket por la nota del bloque G, pero el encargo lo asignó a la factura.
* **La etiqueta de la cuarta fila** (hipótesis «suplido fuera de la base») no existe y no se ha
  escrito: `[copy: fundador]`.
* **Los dos defectos ① y ②** quedan sin arreglar a propósito: necesitan GO.

## Tests que introduce esta entrada

* `tests/scrum604-desglose-en-el-pdf.test.mjs` — qué imprime hoy el bloque de totales de la
  factura, en cuatro formas, con el caso de suplido entre ellas.
