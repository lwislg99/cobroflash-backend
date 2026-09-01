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


---

# APÉNDICE · SCRUM-604 · DOC-14 en el PRESUPUESTO

**Medido contra:** `origin/main` = `4d0ffccd8663f2e622094d2e9ecd2c303a95e08a` · 2026-08-25T03:10:00+01:00

> ⚠️ El ancla es el commit contra el que se MIDIÓ —la base de esta rama, merge del PR #866, que
> es el que trajo el instrumento de leer PDF—, no la punta de `origin/main` de ahora. Esa hora es
> la del trabajo de esta rama, no una lectura de reloj — criterio R14.
>
> Este fichero es el APÉNDICE de la entrada anterior de SCRUM-604 (la de la factura, ya
> mergeada). Se añade al final y no se borra nada, como manda el protocolo.

**Alcance:** se CONSTRUYE el desglose que faltaba en el PDF de **presupuesto**. El de factura no
se toca.

> 🔴 **Este apéndice CIERRA un hueco declarado más arriba.** La entrada anterior dice «el PDF de
> presupuesto no se ha tocado… necesita decisión»: la decisión la tomó el fundador el 25-ago-2026
> y es este apéndice. Los otros huecos de aquella lista —los defectos ① y ②, la etiqueta de la
> cuarta fila y P-DOC-2— **siguen abiertos**.

---

## 1 · Antes y después

**Antes** —medido con el caso de SCRUM-619, y era el hueco real que describía la evidencia del
ticket:

```
Total presupuesto: 117.60 EUR
```

**Ahora:**

```
Base imponible: 105,00 EUR    IVA 21%: 12,60 EUR    Total presupuesto: 117,60 EUR
```

Las cinco formas que se han fijado leyendo el PDF de verdad:

| caso | lo que imprime |
|---|---|
| un solo tipo | `Base imponible: 60,00 EUR · IVA 21%: 12,60 EUR · Total presupuesto: 72,60 EUR` |
| dos tipos con cuota | `… · IVA 21%: 12,60 EUR · IVA 10%: 4,50 EUR · Total presupuesto: 122,10 EUR` |
| **con SUPLIDO (dos bases)** | `Base imponible: 105,00 EUR · IVA 21%: 12,60 EUR · Total presupuesto: 117,60 EUR` |
| **Perú** | `Base imponible: 60,00 EUR · **IGV** 18%: 10,80 EUR · **Total cotización**: 70,80 EUR` |
| sin líneas | `Total presupuesto: 318,45 EUR` (sin desglose: no hay de dónde sacarlo) |

---

## 2 · ¿Sirvieron las etiquetas de la factura? **Sí — y una salió mejor**

La pregunta del cierre, contestada. **Cero microcopy nuevo** (regla 30); los tres rótulos salen de
sitios ya aprobados:

| ranura | de dónde sale | ¿copy nuevo? |
|---|---|---|
| `Base imponible:` | el **mismo literal** del bloque de totales de la factura | no — reutilizado |
| `IVA 21%:` / `IGV 18%:` | **`locale.vatName`**, un campo que ya existía | no — derivado |
| `Total presupuesto:` | el rótulo que este documento **ya imprimía** | no — intacto |

🔴 **Y la del impuesto salió MEJOR que la de la factura.** El bloque de la factura lleva `IVA`
escrito a mano; el del presupuesto lo saca de `locale.vatName`, así que en **Perú imprime `IGV`**,
que es como se llama allí el impuesto. No se ha ido a arreglar la factura —no toca— pero queda
anotado: cuando alguien mire SCRUM-623, ahí hay un `IVA` literal que debería salir del locale.

---

## 3 · ¿Cabe una cuarta fila sin rehacer la maqueta? **Sí, y está vigilado**

La otra pregunta del cierre. Las filas son **datos**, no dibujo:

```ts
const filasDeTotales: Array<{ etiqueta: string; importe: number }> = [];
filasDeTotales.push({ etiqueta: 'Base imponible:', importe: bd.base });
for (const e of bd.entries) { … filasDeTotales.push({ etiqueta: `${locale.vatName} ${e.rate}%:`, … }); }
…
for (const fila of filasDeTotales) { doc.text(…); }
```

El día que el fundador escriba la etiqueta del suplido fuera de la base, añadirla es **empujar una
entrada más** al array. No hay que tocar el pintado, ni las posiciones, ni el salto de página.

**Y no se queda en una promesa:** un test lo comprueba **por AST** —que `filasDeTotales` existe,
que se le empuja y que se pinta recorriéndolo— y cae diciéndolo si alguien vuelve a escribir el
bloque a mano. Es una propiedad del código, así que se mide en el código y no leyendo el PDF.

**No hizo falta parar:** la forma de tres conceptos se dejó abierta a una cuarta sin decidir nada
sobre el suplido. La única decisión que sigue pendiente es su **etiqueta**, que es del fundador.

---

## 4 · Dos cosas que NO son mejoras, y se declaran

### ① Hereda el defecto ① de la factura

Las filas con cuota **cero** no se pintan, así que la base al 0 % —el caso del suplido— no sale en
el desglose. Se hizo **igual que la factura a propósito**: el encargo dice «construye la forma de
TRES conceptos que hay hoy», y divergir aquí habría inventado una segunda forma de documento.

El defecto es de **SCRUM-623** y ahora está en los **dos** documentos: cuando se arregle, hay que
arreglarlo en los dos. Está fijado con la propiedad que sobrevive a un cambio de importes —*un
documento de dos bases imprime las mismas filas de impuesto que uno de una*— así que el arreglo
tendrá que pasar por este test.

### ② El formato del total cambia: `117.60` → `117,60`

El encargo lo permite explícitamente, y **era inevitable**: dejar las filas nuevas en `105,00`
junto a un total en `117.60` habría metido **dos formatos en el mismo bloque**. Toca **una línea**
que pertenece a SCRUM-625; el resto del documento no se ha tocado.

---

## 5 · Verificación

**Commit de partida:** `7fb44ee69df9581dabc601b414324c072598092e`. Inyecciones con bytes de disco
y reversión comprobada con `Buffer.compare`. Árbol limpio tras cada una.

| control | rotura inyectada | resultado |
|---|---|---|
| 🔴 ROJO-1 | cuota mal sumada (`e.cuota += base * taxFrac * 1.1`) | **fail=4** |
| 🔴 ROJO-2 | base que no cuadra con sus líneas (`e.base += base * 2`) | **fail=4** |
| 🔴 ROJO-3 | el total pinta otro número (`+ 1`) | **fail=5** |
| ✅ POSITIVO | — | los 8 en verde con el cálculo intacto |

Los tres **nombran las cifras** (12,60 · 60,00 · 72,60 · 105,00 · 117,60 · 122,10 · 10,80 ·
318,45) y **el caso con suplido está entre los que caen**.

**El PDF de factura no se ha tocado:** sus 6 tests siguen en verde.

### El censo de IVA me paró, y tenía razón

La tanda completa cayó con **un** fallo: `SCRUM-389 · todo el que deriva IVA está CENSADO con su
veredicto`. Al llamar a `calcVatBreakdown` desde el PDF aparecí como **llamador nuevo sin
clasificar**, y ese censo existe porque un llamador que **agregue un periodo** sería una segunda
cifra oficial del mismo trimestre — ya pasó con `/admin/reports/vat`.

Clasificado como **DOCUMENTO**: desglosa **un** presupuesto para imprimirlo, y un presupuesto ni
siquiera entra en el 303.

🔴 **Y de paso destapa algo:** el bloque de totales de la **factura**, en este mismo fichero, **no
aparece en ese censo** — porque no llama a la primitiva: tiene su propio `vatMap` escrito a mano.
Es exactamente la segunda cifra que el censo persigue, sólo que invisible para él porque no pasa
por la puerta que vigila. Está declarada en SCRUM-623/624; queda anotado que **el censo de
SCRUM-389 no la ve**, y eso es un hueco del censo, no de este ticket. El desglose nuevo del
presupuesto sí llama a la primitiva, así que no repite el error.

### El guard de fin de línea, y cómo se resolvió

Al editar, `pdf.service.ts` pasó de **701 a 769 CR** en disco y el guard de SCRUM-480 cayó.
Medido: **blob limpio (0 CR) y disco sucio** — exactamente el caso que el propio guard describe.
Se aplicó el arreglo que él prescribe (guardar el fichero en LF); **no** se tocó `.gitattributes`
ni se añadió excepción. El diff son las 70 líneas del cambio, no el fichero entero.

---

## 6 · Hallazgo declarado, de otro carril

**No existe un formateador de dinero compartido en `src/`.** La misma expresión
`toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` está copiada en
**siete** sitios: `pdf.service` (el `fmt` de la factura), `payBizum.routes`, `albaranPdf.service`
(×2), `albaranPublicVista`, `weeklyDigest.service` y `customerPortal.routes`.

Aquí se añade `fmtImporte` **en vez de** sacar el `fmt` de la factura, porque el encargo dice que
la factura no se toca. Para que la duplicación no se convierta en divergencia, un test **compara
las dos salidas** sobre seis importes y comprueba con `===` que el cuerpo del `fmt` de la factura
sigue siendo el mismo. Divergencia **vigilada** — que es lo que se puede hacer hoy sin tocarla.
Unificarlas es otro ticket y otro carril (regla 9).

## Tests que introduce esta entrada

* `tests/scrum604b-desglose-presupuesto.test.mjs` — las cinco formas del desglose del
  presupuesto, la propiedad de la cuarta fila y la vigilancia de los dos formateadores.
